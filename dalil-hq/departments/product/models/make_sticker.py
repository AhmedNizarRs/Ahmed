"""DALIL flexible sticker v1: print-ready STL files.

Soft TPU pad that bends round door handles and handrails (Ø20–50 mm) and lies flat on walls.
Top: tactile ribs (message type), a raised number, braille. Back: flat, for 3M VHB-type tape.
Rounded corners and sloped edges so a hand slides over it.

Run:  python3 make_sticker.py --number 2 --ribs 3
Out:  dalil-sticker_<number>.stl            one material (all TPU)
      dalil-sticker_<number>_base.stl       two materials: pad + braille (yellow TPU)
      dalil-sticker_<number>_glow.stl       two materials: number + ribs (glow-in-the-dark TPU)

Braille sizes follow ADA 2010 §703.3 (dot base 1.5–1.6 mm, height 0.6–0.9 mm, 2.3–2.5 mm in a cell,
6.1–7.6 mm cell to cell). The braille must be checked by a braille reader before any customer order.
"""
import argparse, math
import numpy as np
import manifold3d as m3
import trimesh
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
from shapely.geometry import Polygon
from shapely.ops import unary_union

# ---- sizes (mm) ----
L, W = 80.0, 32.0          # pad length (along the rail) and width (around the rail)
T = 1.6                    # pad thickness: thin enough to bend, thick enough to hold the dots
SLOPE = 3.0                # the top face is 3 mm smaller on every side: a gentle ramp at the edges (~28°)
R_CORNER = 5.0             # rounded corners
DOT_BASE, DOT_H = 1.6, 0.65          # braille dot: base diameter, height (domed)
DOT_PITCH, CELL_PITCH = 2.4, 6.4     # in a cell, cell to cell
RAISE = 0.8                # raised number and ribs height
SEG = 48

# Braille cells: dots 1-6 (1,2,3 = left column top→bottom; 4,5,6 = right column)
NUMBER_SIGN = (3, 4, 5, 6)
DIGITS = {'1': (1,), '2': (1, 2), '3': (1, 4), '4': (1, 4, 5), '5': (1, 5), '6': (1, 2, 4), '7': (1, 2, 4, 5), '8': (1, 2, 5), '9': (2, 4), '0': (2, 4, 5)}


def rounded_rect(w, h, r):
    r = min(r, w / 2 - 0.01, h / 2 - 0.01)
    return m3.CrossSection.square([w - 2 * r, h - 2 * r]).translate([r - w / 2, r - h / 2]).offset(r, m3.JoinType.Round, circular_segments=SEG)


def pad():
    bottom = m3.Manifold.extrude(rounded_rect(L, W, R_CORNER), 0.01)
    top = m3.Manifold.extrude(rounded_rect(L - 2 * SLOPE, W - 2 * SLOPE, R_CORNER - SLOPE / 2), 0.01).translate([0, 0, T - 0.01])
    return m3.Manifold.batch_hull([bottom, top])


def dot(x, y):
    a, h = DOT_BASE / 2, DOT_H
    R = (a * a + h * h) / (2 * h)                     # sphere whose cap is a×h
    s = m3.Manifold.sphere(R, SEG).translate([x, y, T + h - R])
    keep = m3.Manifold.cube([2 * R, 2 * R, R + 1]).translate([x - R, y - R, T - 0.3])   # cap above the pad (+ a little below to fuse)
    return s ^ keep


def braille(text, x0, yc):
    cells = []
    for ch in text:
        if ch.isdigit():
            if not cells or cells[-1] != 'NUM': cells.append('NUM')
            cells.append(DIGITS[ch])
    out = []
    for i, c in enumerate(cells):
        dots = NUMBER_SIGN if c == 'NUM' else c
        cx = x0 + i * CELL_PITCH
        for d in dots:
            col = 0 if d <= 3 else 1
            row = (d - 1) % 3
            out.append(dot(cx + col * DOT_PITCH, yc + DOT_PITCH - row * DOT_PITCH))
    return out, len(cells)


def ribs(n, x0):
    """n rounded ribs across the width: the hand feels the type of message first (Information = 3, Safety = 2, End of stairs = 1)."""
    out = []
    for i in range(n):
        x = x0 + i * 2.6
        rib = m3.Manifold.cylinder(W - 2 * SLOPE - 6, 0.8, 0.8, SEG).rotate([90, 0, 0]).translate([x, (W - 2 * SLOPE - 6) / 2, T - 0.05])
        out.append(rib ^ m3.Manifold.cube([2, W, 1.0]).translate([x - 1, -W / 2, T - 0.2]))
    return out


def raised_text(txt, xc, yc, height=13.0):
    tp = TextPath((0, 0), txt, size=height, prop=FontProperties(family='DejaVu Sans', weight='bold'))
    polys = [Polygon(p) for p in tp.to_polygons() if len(p) >= 3]
    # outer rings and holes: even-odd fill
    shape = None
    for p in sorted(polys, key=lambda q: -q.area):
        if not p.is_valid: p = p.buffer(0)
        shape = p if shape is None else (shape.difference(p) if shape.contains(p) else shape.union(p))
    minx, miny, maxx, maxy = shape.bounds
    geoms = getattr(shape, 'geoms', [shape])
    parts = []
    for g in geoms:
        rings = [list(g.exterior.coords)[:-1]] + [list(r.coords)[:-1] for r in g.interiors]
        cs = m3.CrossSection([[(x - (minx + maxx) / 2 + xc, y - (miny + maxy) / 2 + yc) for x, y in r] for r in rings], m3.FillRule.EvenOdd)
        parts.append(m3.Manifold.extrude(cs, RAISE + 0.2).translate([0, 0, T - 0.2]))
    return parts, (maxx - minx)


def to_trimesh(man):
    mesh = man.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--number', default='2'); ap.add_argument('--ribs', type=int, default=3); ap.add_argument('--out', default='.')
    a = ap.parse_args()
    base = pad()
    rib_parts = ribs(a.ribs, -L / 2 + SLOPE + 5)
    num_parts, num_w = raised_text(a.number, -L / 2 + SLOPE + 5 + a.ribs * 2.6 + 4 + 7, 0)
    dots, ncells = braille(a.number, 6.0, 0)
    base_full = m3.Manifold.batch_boolean([base] + dots, m3.OpType.Add)
    glow = m3.Manifold.batch_boolean(rib_parts + num_parts, m3.OpType.Add)
    full = base_full + glow
    glow_only = glow - base_full
    import os
    os.makedirs(a.out, exist_ok=True)
    n = a.number
    for name, man in [(f'dalil-sticker_{n}.stl', full), (f'dalil-sticker_{n}_base.stl', base_full), (f'dalil-sticker_{n}_glow.stl', glow_only)]:
        tm = to_trimesh(man); tm.export(os.path.join(a.out, name))
        print(name, 'watertight' if tm.is_watertight else 'NOT WATERTIGHT', 'size', np.round(tm.extents, 2), 'mm', 'volume', round(tm.volume / 1000, 2), 'cm3')
    print('braille cells', ncells, '(number sign + digits)')


if __name__ == '__main__':
    main()
