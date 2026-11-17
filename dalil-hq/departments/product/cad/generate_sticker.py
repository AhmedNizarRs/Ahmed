#!/usr/bin/env python3
"""DALIL sticker: parametric STL generator (round-1 prototype geometry).

Numbers come from dalil-hq/departments/product/sticker-concept-research.md.
Nothing here is a final specification. Dot height, relief and edge ramp are
test variables for round 1. All units are millimetres.

Run:  python3 generate_sticker.py            (writes the STL files next to this script)
Needs: numpy, trimesh, shapely, manifold3d, matplotlib, fonttools
"""
import json
import math
import os

import numpy as np
import trimesh
from manifold3d import CrossSection, JoinType, Manifold, OpType
from matplotlib.font_manager import FontProperties
from matplotlib.textpath import TextPath
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# ---- braille cell (research memo section 6; inside ISO 17049 and ADA ranges) ----
DOT_D = 1.5          # dot base diameter
DOT_SPACING = 2.5    # centre to centre inside a cell, both directions
CELL_PITCH = 6.2     # dot 1 to dot 1 of the next cell
# ---- sticker body (memo section 4) ----
BASE_T = 0.5         # flat thickness (flexible-resin route; glow-film route is 0.2 + dots)
EDGE_T = 0.1         # thickness at the very edge
RAMP = 3.0           # width of the tapered edge
CORNER_R = 4.0       # outer corner radius (memo: 3 mm or more)
MARGIN = 2.0         # plateau margin around the content
GAP = 8.0            # braille to numeral

# Unicode braille: U+2800 + bits (dot1=1, dot2=2, dot3=4, dot4=8, dot5=16, dot6=32)
# DEMO text. Arabic "الطابق" (floor) = alef, lam, ta(emphatic), alef, ba, qaf, then number sign + 2.
# THE ARABIC BRAILLE MUST BE CHECKED BY A BRAILLE READER BEFORE ANY USE (memo section 6).
DEMO_ARABIC = "⠁⠇⠾⠁⠃⠟" + "⠀" + "⠼⠃"
CALIBRATION = "⠿" + "⠀" + "⠼⠃"


def dots_of(ch):
    bits = ord(ch) - 0x2800
    return [i for i in range(6) if bits & (1 << i)]     # 0..5 = dots 1..6


def dome_radius(h, a=DOT_D / 2):
    return (a * a + h * h) / (2 * h)


def rounded_rect(length, width, r):
    inner = CrossSection.square((max(length - 2 * r, 0.01), max(width - 2 * r, 0.01)), center=True)
    return inner.offset(r, JoinType.Round, circular_segments=48)


def dome(h, steps=10, segments=48):
    """Spherical-cap dot. Base radius 0.75 mm, apex h above the base, sunk 0.1 mm into the body."""
    a = DOT_D / 2
    R = dome_radius(h)
    prof = [(0.0, -0.1), (a, -0.1), (a, 0.0)]
    for k in range(1, steps + 1):                # arc from the dot edge up to the apex
        r = a * (1 - k / steps)
        prof.append((r, math.sqrt(R * R - r * r) - (R - h)))
    return Manifold.revolve(CrossSection([np.array(prof)]), segments)


def numeral_polygon(char, height):
    tp = TextPath((0, 0), char, size=100, prop=FontProperties(fname=FONT))
    polys = [Polygon(p) for p in tp.to_polygons() if len(p) > 2]
    poly = polys[0]
    for q in polys[1:]:
        poly = poly.symmetric_difference(q)
    minx, miny, maxx, maxy = poly.bounds
    s = height / (maxy - miny)
    from shapely import affinity
    poly = affinity.scale(poly, s, s, origin=(minx, miny))
    minx, miny, maxx, maxy = poly.bounds
    return affinity.translate(poly, -minx, -miny)


def poly_to_manifold(poly, z0, z1):
    poly = orient(poly, 1.0)
    rings = [np.array(poly.exterior.coords)[:-1]] + [np.array(r.coords)[:-1][::-1] for r in poly.interiors]
    ext = Manifold.extrude(CrossSection(rings), z1 - z0)
    return ext.translate((0, 0, z0))


def build_flat(text, dot_h=0.5, numeral=None, numeral_h=16.0, relief=0.5, base_t=BASE_T):
    """Return (Manifold, info). x runs along the rail, y across it, z up. Bottom face at z=0."""
    cells = len(text)
    braille_len = (cells - 1) * CELL_PITCH + DOT_SPACING + DOT_D
    body_w = 2 * RAMP + (DOT_SPACING + DOT_D) + 2 * MARGIN
    content_len = braille_len
    num_w = 0.0
    if numeral:
        npoly = numeral_polygon(numeral, numeral_h)
        num_w = npoly.bounds[2]
        content_len += GAP + num_w
        body_w = max(body_w, numeral_h + 1.0 + 2 * RAMP)   # 0.5 mm clear of the tapered edge
    length = content_len + 2 * (RAMP + MARGIN)
    x_left = -length / 2 + RAMP + MARGIN             # left edge of the content
    outer = Manifold.extrude(rounded_rect(length, body_w, CORNER_R), EDGE_T)
    inner = Manifold.extrude(rounded_rect(length - 2 * RAMP, body_w - 2 * RAMP, max(CORNER_R - RAMP, 0.5)), base_t)
    body = Manifold.batch_hull([outer, inner])
    parts = [body]
    dome_m = dome(dot_h)
    centres = []
    for i, ch in enumerate(text):
        cx = x_left + DOT_D / 2 + i * CELL_PITCH
        for d in dots_of(ch):
            col = 0 if d < 3 else 1
            row = d if d < 3 else d - 3
            x = cx + col * DOT_SPACING
            y = (1 - row) * DOT_SPACING
            centres.append((x, y))
            parts.append(dome_m.translate((x, y, base_t)))
    info = {"length": length, "width": body_w, "dots": len(centres), "dot_centres": centres,
            "braille_len": braille_len, "base_t": base_t, "dot_h": dot_h}
    if numeral:
        nx0 = x_left + braille_len + GAP
        ny0 = -numeral_h / 2
        # numeral edge eased in three 0.1 mm steps (finer than an SLA layer)
        for inset, z0, z1 in ((0.0, base_t - 0.05, base_t + relief - 0.2),
                              (0.1, base_t + relief - 0.2, base_t + relief - 0.1),
                              (0.2, base_t + relief - 0.1, base_t + relief)):
            p = npoly.buffer(-inset, join_style=1) if inset else npoly
            from shapely import affinity
            parts.append(poly_to_manifold(affinity.translate(p, nx0, ny0), z0, z1))
        info["numeral_box"] = (nx0, ny0, nx0 + num_w, ny0 + numeral_h)
        info["relief"] = relief
    return Manifold.batch_boolean(parts, OpType.Add), info


def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3].astype(float),
                           faces=np.asarray(mesh.tri_verts), process=True)


def bend_onto_rail(m, rail_d, edge=0.5, axis_along="x"):
    """Wrap the flat sticker onto a round rail. Bottom face lands exactly on the rail surface.
    The rail axis is x, its centre sits at z = -rail_d/2, the sticker is centred on top."""
    R = rail_d / 2
    mesh = to_trimesh(m.refine_to_length(edge))
    v = mesh.vertices.copy()
    th = v[:, 1] / R
    rho = R + v[:, 2]
    out = np.column_stack([v[:, 0], rho * np.sin(th), rho * np.cos(th) - R])
    return trimesh.Trimesh(vertices=out, faces=mesh.faces, process=True)


def rail_mesh(rail_d, length, z_axis_offset=0.0):
    cyl = trimesh.creation.cylinder(radius=rail_d / 2, height=length, sections=180)
    cyl.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    cyl.apply_translation([0, 0, -rail_d / 2])
    return cyl


def check(mesh, info, label):
    rep = {"file": label, "watertight": bool(mesh.is_watertight), "winding_consistent": bool(mesh.is_winding_consistent),
           "volume_mm3": round(float(mesh.volume), 2), "bounds_mm": [round(float(x), 3) for x in mesh.extents]}
    return rep


def verify_flat(mesh, info):
    v = mesh.vertices
    out = {}
    tops = []
    for (x, y) in info["dot_centres"]:
        near = v[(np.hypot(v[:, 0] - x, v[:, 1] - y) < 0.05)]
        tops.append(near[:, 2].max())
    tops = np.array(tops)
    out["dot_peak_above_rail_mm"] = [round(float(tops.min()), 4), round(float(tops.max()), 4)]
    out["dot_height_above_base_mm"] = round(float(tops.mean() - info["base_t"]), 4)
    xs = sorted({round(c[0], 3) for c in info["dot_centres"]})
    out["dot_count"] = info["dots"]
    # in-cell and cell spacing straight from the model
    ys = sorted({round(c[1], 3) for c in info["dot_centres"]})
    out["row_spacing_mm"] = sorted({round(b - a, 3) for a, b in zip(ys, ys[1:])})
    out["column_x_positions_first_cells"] = xs[:4]
    # base thickness on the plateau (sample a clear point)
    out["flat_total_thickness_mm"] = info["base_t"]
    out["strip_size_mm"] = [round(info["length"], 2), round(info["width"], 2)]
    out["max_height_mm"] = round(float(v[:, 2].max()), 4)
    return out


def main():
    results = {}
    # A: braille + raised number, 22 mm wide
    mA, iA = build_flat(DEMO_ARABIC, dot_h=0.5, numeral="2", numeral_h=16.0, relief=0.5)
    tA = to_trimesh(mA)
    tA.export(os.path.join(HERE, "dalil-sticker-A-braille-number_flat.stl"))
    results["A_flat"] = {**check(tA, iA, "dalil-sticker-A-braille-number_flat.stl"), **verify_flat(tA, iA)}
    bA = bend_onto_rail(mA, 32.0)
    bA.export(os.path.join(HERE, "dalil-sticker-A-braille-number_on-rail-d32.stl"))
    results["A_rail32"] = check(bA, iA, "dalil-sticker-A-braille-number_on-rail-d32.stl")
    R = 16.0
    d = np.linalg.norm(bA.vertices[:, 1:] - np.array([0, -R]), axis=1)
    bottom = bA.vertices[(np.abs(d - R) < 0.002)]
    results["A_rail32"]["vertices_on_rail_surface"] = int(len(bottom))
    results["A_rail32"]["max_radial_height_mm"] = round(float(d.max() - R), 4)

    # B: braille only, 14 mm wide
    mB, iB = build_flat(DEMO_ARABIC, dot_h=0.5)
    tB = to_trimesh(mB)
    tB.export(os.path.join(HERE, "dalil-sticker-B-braille-only_flat.stl"))
    results["B_flat"] = {**check(tB, iB, "dalil-sticker-B-braille-only_flat.stl"), **verify_flat(tB, iB)}
    bB = bend_onto_rail(mB, 32.0)
    bB.export(os.path.join(HERE, "dalil-sticker-B-braille-only_on-rail-d32.stl"))
    results["B_rail32"] = check(bB, iB, "dalil-sticker-B-braille-only_on-rail-d32.stl")

    # C: calibration plate, three strips with dot heights 0.4 / 0.5 / 0.6 (top to bottom)
    plate_parts = []
    gap_y = 4.0
    ys = []
    infos = []
    for k, h in enumerate((0.4, 0.5, 0.6)):
        m, i = build_flat(CALIBRATION, dot_h=h)
        infos.append(i)
        plate_parts.append((m, h, i))
    total_w = sum(i["width"] for _, _, i in plate_parts) + gap_y * 2
    y = total_w / 2
    placed = []
    for m, h, i in plate_parts:
        y -= i["width"] / 2
        placed.append(m.translate((0, y, 0)))
        y -= i["width"] / 2 + gap_y
    cal = Manifold.batch_boolean(placed, OpType.Add)
    tC = to_trimesh(cal)
    tC.export(os.path.join(HERE, "dalil-calibration-dot-heights_0.4-0.5-0.6_flat.stl"))
    results["C_calibration"] = check(tC, infos[0], "dalil-calibration-dot-heights_0.4-0.5-0.6_flat.stl")

    # rail dummy for previews only
    rail_mesh(32.0, 360.0).export(os.path.join(HERE, "preview-only_rail-d32.stl"))

    with open(os.path.join(HERE, "model-check.json"), "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
