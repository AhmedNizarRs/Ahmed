#!/usr/bin/env python3
"""DALIL wall plates and long rail strips: the same sticker system at a larger scale.

Reuses the dot, spacing and edge numbers from generate_sticker.py. Layout rules for walls
(US ADA 703.3.2, used here only as a layout guide, UAE rule [VERIFY]):
braille sits below the text, at least 9.5 mm clear of other tactile characters.
Raised letters are 16 mm tall (ADA minimum). Letters are DejaVu Sans Bold, a placeholder
for the DALIL typeface. Latin braille is uncontracted (grade 1) and is a DEMO:
a braille reader must check every string.

Run:  python3 generate_wall_plates.py
"""
import json
import os
import sys

import numpy as np
import trimesh
from manifold3d import Manifold, OpType
from matplotlib.font_manager import FontProperties
from matplotlib.textpath import TextPath
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate_sticker as g  # noqa: E402

LETTER_H = 16.0
BRAILLE_GAP = 9.5     # clear space between the print and the braille
# Grade 1 (uncontracted) English braille, dot numbers
_EN = {"a": "1", "b": "12", "c": "14", "d": "145", "e": "15", "f": "124", "g": "1245", "h": "125", "i": "24", "j": "245",
       "k": "13", "l": "123", "m": "134", "n": "1345", "o": "135", "p": "1234", "q": "12345", "r": "1235", "s": "234",
       "t": "2345", "u": "136", "v": "1236", "w": "2456", "x": "1346", "y": "13456", "z": "1356"}


def cell(dots):
    return chr(0x2800 + sum(1 << (int(d) - 1) for d in dots))


def braille_en(text):
    """Uncontracted English braille. Digits get a number sign (dots 3456) and use letters a-j."""
    out, num = [], False
    for ch in text.lower():
        if ch == " ":
            out.append("⠀"); num = False
        elif ch.isdigit():
            if not num:
                out.append(cell("3456")); num = True
            out.append(cell(_EN["abcdefghij"[int(ch) - 1] if ch != "0" else "j"]))
        elif ch in _EN:
            out.append(cell(_EN[ch])); num = False
        elif ch == "-":
            out.append(cell("36")); num = False
        else:
            raise ValueError("no braille for " + repr(ch))
    return "".join(out)


def _cap_scale():
    tp = TextPath((0, 0), "H", size=100, prop=FontProperties(fname=g.FONT))
    ys = np.concatenate([np.asarray(p)[:, 1] for p in tp.to_polygons()])
    return LETTER_H / (ys.max() - ys.min())


def text_geom(s):
    """Letters as a shapely geometry: baseline at y=0, left edge at x=0, cap height 16 mm."""
    tp = TextPath((0, 0), s, size=100, prop=FontProperties(fname=g.FONT))
    polys = [Polygon(p) for p in tp.to_polygons() if len(p) > 2]
    geom = polys[0]
    for q in polys[1:]:
        geom = geom.symmetric_difference(q)       # even-odd: holes in A, O, R, P
    k = _cap_scale()
    geom = affinity.scale(geom, k, k, origin=(0, 0))
    minx = geom.bounds[0]
    return affinity.translate(geom, -minx, 0)


def arrow_left():
    """Left arrow, 16 mm tall, 20 mm long."""
    pts = [(0, 8), (9, 16), (9, 11), (20, 11), (20, 5), (9, 5), (9, 0)]
    return Polygon(pts)


def poly_layers(geom, z0_base, relief):
    """Raised shape with its edge eased in three 0.1 mm steps (finer than an SLA layer)."""
    parts = []
    for inset, z0, z1 in ((0.0, z0_base - 0.05, z0_base + relief - 0.2),
                          (0.1, z0_base + relief - 0.2, z0_base + relief - 0.1),
                          (0.2, z0_base + relief - 0.1, z0_base + relief)):
        shp = geom.buffer(-inset, join_style=1) if inset else geom
        geoms = list(shp.geoms) if isinstance(shp, MultiPolygon) else [shp]
        for p in geoms:
            if not p.is_empty and p.area > 0.05:
                parts.append(g.poly_to_manifold(p, z0, z1))
    return parts


def build_plate(print_text=None, arrow=False, braille="", relief=0.5, base_t=g.BASE_T, dot_h=0.5):
    """A wall plate: raised print line on top, braille line at least 9.5 mm below it. x along the plate."""
    items, print_w = [], 0.0
    x = 0.0
    if arrow:
        a = arrow_left(); items.append(a); x = 20.0 + 4.0
    if print_text:
        t = affinity.translate(text_geom(print_text), x, 0); items.append(t); x = t.bounds[2]
    print_w = x
    braille_len = (len(braille) - 1) * g.CELL_PITCH + g.DOT_SPACING + g.DOT_D if braille else 0.0
    cw = max(print_w, braille_len)
    # vertical layout: print spans y 0..16; braille dots start BRAILLE_GAP below y=0
    top_row_y = -(BRAILLE_GAP + g.DOT_D / 2)
    content_bot = top_row_y - 2 * g.DOT_SPACING - g.DOT_D / 2 if braille else 0.0
    content_top = LETTER_H if items else (top_row_y + g.DOT_D / 2)
    ch = content_top - content_bot
    edge = g.RAMP + g.MARGIN
    length, width = cw + 2 * edge, ch + 2 * edge
    outer = Manifold.extrude(g.rounded_rect(length, width, g.CORNER_R), g.EDGE_T)
    inner = Manifold.extrude(g.rounded_rect(length - 2 * g.RAMP, width - 2 * g.RAMP, max(g.CORNER_R - g.RAMP, 0.5)), base_t)
    parts = [Manifold.batch_hull([outer, inner])]
    ox, oy = -cw / 2, -(content_top + content_bot) / 2          # centre the content box on the plate
    if items:
        shape = unary_union(items)
        shape = affinity.translate(shape, ox, oy)
        parts += poly_layers(shape, base_t, relief)
    centres = []
    dome = g.dome(dot_h)
    for i, chx in enumerate(braille):
        for d in g.dots_of(chx):
            col = 0 if d < 3 else 1
            row = d if d < 3 else d - 3
            px = ox + g.DOT_D / 2 + i * g.CELL_PITCH + col * g.DOT_SPACING
            py = oy + top_row_y - row * g.DOT_SPACING
            centres.append((px, py)); parts.append(dome.translate((px, py, base_t)))
    info = {"length": length, "width": width, "dots": len(centres), "cells": len(braille), "dot_centres": centres,
            "print_w": print_w, "braille_len": braille_len, "base_t": base_t, "dot_h": dot_h}
    return Manifold.batch_boolean(parts, OpType.Add), info


def main():
    out, rep = {}, {}
    jobs = {
        "wall-plate-W1_room-15_flat.stl": dict(print_text="ROOM 15", braille=braille_en("room 15")),
        "wall-plate-W2_exit-left_flat.stl": dict(print_text="EXIT", arrow=True, braille=braille_en("exit")),
        "wall-plate-W3_prayer-room_flat.stl": dict(print_text="PRAYER ROOM", braille=braille_en("prayer room")),
    }
    for fn, kw in jobs.items():
        m, info = build_plate(**kw)
        t = g.to_trimesh(m); t.export(os.path.join(HERE, fn))
        rep[fn] = {"watertight": bool(t.is_watertight), "size_mm": [round(info["length"], 1), round(info["width"], 1)],
                   "extents_mm": [round(float(v), 3) for v in t.extents], "cells": info["cells"], "dots": info["dots"],
                   "braille_len_mm": round(info["braille_len"], 1), "volume_mm3": round(float(t.volume), 1)}
    # long rail strip: "rooms 201-215", braille only, 14 mm wide
    m, info = g.build_flat(braille_en("rooms 201 to 215"), dot_h=0.5)
    t = g.to_trimesh(m); fn = "strip-C_rooms-201-to-215_flat.stl"; t.export(os.path.join(HERE, fn))
    rep[fn] = {"watertight": bool(t.is_watertight), "size_mm": [round(info["length"], 1), round(info["width"], 1)],
               "extents_mm": [round(float(v), 3) for v in t.extents], "cells": len(braille_en("rooms 201 to 215")),
               "dots": info["dots"], "braille_len_mm": round(info["braille_len"], 1)}
    # strip A wrapped on a 40 mm stair rail, for the stairs picture (not for printing)
    mA, iA = g.build_flat(g.DEMO_ARABIC, dot_h=0.5, numeral="2", numeral_h=16.0, relief=0.5)
    g.bend_onto_rail(mA, 40.0).export(os.path.join(HERE, "dalil-sticker-A-braille-number_on-rail-d40.stl"))
    with open(os.path.join(HERE, "places-model-check.json"), "w") as f:
        json.dump(rep, f, indent=2)
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    main()
