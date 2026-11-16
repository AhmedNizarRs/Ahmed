#!/usr/bin/env python3
"""
University of Sharjah, College of Fine Arts and Design, Ground Floor: the plan picture the founder supplied -> DXF
walls (metres) + the places, for the DALIL Mapper.

INTERNAL TEST ONLY. The university is not a DALIL client or pilot. The picture (a ground-floor layout with the
colleges marked 1–8) is kept out of the repository (.pictures/ is git-ignored): put it at .pictures/plan.png.

    python3 data/test-uos-fine-arts/make_dxf.py     (from dalil-nav/; needs Pillow, numpy)
    node data/test-uos-fine-arts/build-maps.cjs     (then builds the navigation map with the Mapper)

How the plan becomes walls: dark grey/black straight runs of 0.9 m or more, up to 10 px thick, become wall lines.
The picture has overlays: red fire-equipment marks (on walls and in doorways) and big red numbers are dropped;
the green boxes marking the colleges are dropped with their outlines, while lines seen through them (dark green)
are kept. A fire mark on a wall can leave a gap of up to ~1 m in that wall. The legend and the north arrow are masked.
Scale: the drawing's own room sizes: central lobby 11.80 × 11.80 m, halls 7.8 × 31.80 m, 3.8 m corridors and
4.3 × 3.8 m studios all measure 17.96 px per metre (12.4 px/m on the 2000 px copy × 1.448).
Direction: the north arrow points down-left 34° below horizontal, so the drawing's "up" is 124° from north — the
same campus grid as the satellite roof (edges at 34°/124°) and the Central Labs B3 next door.
Position: Google Maps place "Arts College" (25.2958675, 55.4835124) and the satellite roof: the entrance porch
faces the roundabout to the north-west; its outer door is anchored at its spot in Esri World Imagery.
About ±5 m and ±2°, not surveyed. Some outer roof parts in the photo (canopies, a wing to the south-west) are not
in the drawing.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
PIC = HERE / ".pictures"
K = 2896 / 2000                        # picture px per px of the 2000 px copy the places were read from
PX_PER_M = 17.96
BEARING = 124.0
# The entrance porch's outer door: picture px (on the 2000 px copy) and where it is on Earth (Esri tile px at z19)
ANCHOR_PX = (783 * K, 1118 * K)
ANCHOR_TILE = (342944 * 256 + 742.3, 224042 * 256 + 793.3, 19)
GEO_SOURCE = ("Google Maps place \"Arts College\" + the entrance porch and roof grid in Esri World Imagery; drawing north "
              "arrow agrees (124°); about ±5 m and ±2°, not surveyed")
CROP = (int(40 * K), int(10 * K), int(1418 * K), int(1128 * K))
MASKS = [(int(480 * K), int(1010 * K), int(690 * K), int(1160 * K))]          # north arrow
MINLEN, MAXTHICK = 18, 10
# Doorways the trace closed (door swings on the drawing, positions on the 2000 px copy): (x, y, half-size in m)
OPENINGS = [
    (657, 117, 0.9),     # double door: west hall -> small lobby (top-left of the Multipurpose Hall)
    (709, 118, 0.9),     # double door: small lobby -> Multipurpose Hall
    (673, 139, 0.6),     # door: small lobby -> 2 m corridor
    (702, 334, 0.6),     # door: ramp corridor -> theatre room / stair hall
    (791, 232, 0.6),     # door: Multipurpose Hall -> stair hall
    (847, 234, 0.6),     # door: Multipurpose Hall (lower right) -> stair vestibule
    (840, 250, 0.7), (840, 264, 0.7), (840, 278, 0.7), (835, 288, 0.7),   # ESTIMATED: through the stair vestibule to the lift lobby
]
# The arcades' bay lines cross the 3.2 m corridors: they are not walls (vertical lines inside these bands go)
ARCADES = [(318, 662, 574, 614), (858, 1402, 523, 561)]


def tile_to_lnglat(x, y, z):
    n = 2 ** z
    lng = x / 256 / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y / 256) / n))))
    return lng, lat


def runs(row, minlen):
    d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
    s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    return [(a, b - 1) for a, b in zip(s, e) if b - a >= minlen]


def rects(mask, minlen, maxthick):
    open_, done = [], []
    for y in range(mask.shape[0]):
        nxt = []
        for x0, x1 in runs(mask[y], minlen):
            hit = next((r for r in open_ if min(x1, r[1]) - max(x0, r[0]) > 0.7 * min(x1 - x0, r[1] - r[0])), None)
            if hit: open_.remove(hit); nxt.append([min(x0, hit[0]), max(x1, hit[1]), hit[2], y])
            else: nxt.append([x0, x1, y, y])
        done += open_; open_ = nxt
    done += open_
    return [r for r in done if r[3] - r[2] + 1 <= maxthick]


def wall_mask():
    rgb = np.array(Image.open(PIC / "plan.png").convert("RGB")).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = rgb.mean(2); sat = rgb.max(2) - rgb.min(2)
    black = (L < 190) & (sat < 60)
    under_green = (g > r + 12) & (g > b + 8) & (L < 150)             # lines seen through the green boxes
    green = (g > r + 25) & (g > b + 20) & (L > 120)                    # the boxes themselves
    gbox = np.array(Image.fromarray((green * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))) > 0
    # The green boxes' own outlines are not walls: drop dark-green pixels within 5 px of each box's edge.
    from scipy import ndimage
    lab, n = ndimage.label(green)
    edge = np.zeros_like(green)
    for sl in ndimage.find_objects(lab):
        if sl is None or (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start) < 4000: continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        for yy in (y0, y1): edge[max(0, yy - 6):yy + 6, x0 - 6:x1 + 6] = True
        for xx in (x0, x1): edge[y0 - 6:y1 + 6, max(0, xx - 6):xx + 6] = True
    m = black | (under_green & ~edge)        # red fire-equipment marks and red numbers are not walls (they sit in doorways too)
    x0, y0, x1, y1 = CROP
    keep = np.zeros_like(m); keep[y0:y1, x0:x1] = True
    for a, b_, c, d in MASKS: keep[b_:d, a:c] = False
    return m & keep


def wall_segments():
    m = wall_mask()
    segs = [((a, (c + d) / 2), (b, (c + d) / 2)) for a, b, c, d in rects(m, MINLEN, MAXTHICK)]
    segs += [(((c + d) / 2, a), ((c + d) / 2, b)) for a, b, c, d in rects(m.T, MINLEN, MAXTHICK)]
    return segs


def carve(segs):
    out = []
    boxes = [(x * K, y * K, h * PX_PER_M) for x, y, h in OPENINGS]
    for a, b in segs:
        horiz = abs(a[1] - b[1]) < abs(a[0] - b[0])
        if not horiz and any(x0 * K < a[0] < x1 * K and min(a[1], b[1]) > y0 * K - 14 and max(a[1], b[1]) < y1 * K + 14 for x0, x1, y0, y1 in ARCADES): continue   # only lines lying within the arcade
        pieces = [(a, b)]
        for cx, cy, h in boxes:
            nxt = []
            for p, q in pieces:
                if horiz and abs(p[1] - cy) < h:
                    lo, hi = sorted((p[0], q[0]))
                    if lo < cx + h and hi > cx - h:
                        if lo < cx - h: nxt.append(((lo, p[1]), (cx - h, p[1])))
                        if hi > cx + h: nxt.append(((cx + h, p[1]), (hi, p[1])))
                        continue
                if not horiz and abs(p[0] - cx) < h:
                    lo, hi = sorted((p[1], q[1]))
                    if lo < cy + h and hi > cy - h:
                        if lo < cy - h: nxt.append(((p[0], lo), (p[0], cy - h)))
                        if hi > cy + h: nxt.append(((p[0], cy + h), (p[0], hi)))
                        continue
                nxt.append((p, q))
            pieces = nxt
        out += pieces
    return out


def frame(segs):
    xs = [p[0] for s in segs for p in s]; ys = [p[1] for s in segs for p in s]
    return min(xs), max(ys)


def to_m(corner, px, py):
    return round((px - corner[0]) / PX_PER_M, 3), round((corner[1] - py) / PX_PER_M, 3)


def geo(corner):
    ax, ay = to_m(corner, *ANCHOR_PX)
    lng0, lat0 = tile_to_lnglat(*ANCHOR_TILE)
    mlng = 111412.84 * math.cos(math.radians(lat0)); mlat = 111132.92 - 559.82 * math.cos(2 * math.radians(lat0))
    b = math.radians(BEARING)
    e = ax * math.cos(b) + ay * math.sin(b); n = -ax * math.sin(b) + ay * math.cos(b)
    return {"origin": [round(lng0 - e / mlng, 8), round(lat0 - n / mlat, 8)], "bearing": BEARING, "scale": 1.0, "source": GEO_SOURCE}


def dxf(segs, corner):
    out = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    for a, b in segs:
        (xa, ya), (xb, yb) = to_m(corner, *a), to_m(corner, *b)
        if math.hypot(xb - xa, yb - ya) < 0.15: continue
        out += ["0", "LINE", "8", "A-WALL", "10", str(xa), "20", str(ya), "30", "0", "11", str(xb), "21", str(yb), "31", "0"]
    out += ["0", "ENDSEC", "0", "EOF"]
    return "\n".join(out) + "\n"


# Places, read off the drawing (positions on the 2000 px copy). Names: the drawing's labels and its legend (1–8).
# Arabic names are drafts: they need a native-speaker check.
PLACES = [
    # name EN, name AR, category, x, y, options
    ["Main Entrance", "المدخل الرئيسي", "entrance", 783, 1075, {"node": True, "face": 90}],
    ["Entrance Hall", "بهو المدخل", "reception", 783, 960, {"node": True, "face": 90}],
    ["Gallery", "المعرض", "room", 783, 760, {}],
    ["Central Lobby", "البهو المركزي", "room", 783, 560, {}],
    ["Café", "المقهى", "cafe", 760, 400, {}],
    ["Multipurpose Hall", "القاعة متعددة الأغراض", "room", 780, 170, {}],
    ["Lift", "المصعد", "lift", 828, 300, {}],
    ["Toilets (men)", "دورات مياه الرجال", "toilet", 708, 690, {}],
    ["Toilets (women)", "دورات مياه النساء", "toilet", 856, 690, {}],
    ["Fine Arts College", "كلية الفنون الجميلة", "room", 1055, 715, {}],
    ["Graphic Design College", "كلية التصميم الجرافيكي", "room", 1055, 375, {}],
    ["Interior Design College (north)", "كلية التصميم الداخلي (الشمالية)", "room", 512, 430, {}],
    ["Interior Design College (south)", "كلية التصميم الداخلي (الجنوبية)", "room", 512, 715, {}],
    ["Lecture Theatre", "المسرح", "room", 250, 590, {}],
    ["Faculty Offices", "مكاتب أعضاء هيئة التدريس", "room", 232, 320, {}],
    ["Dean's Office", "مكتب العميد", "room", 120, 300, {}],
    ["Library", "المكتبة", "room", 150, 875, {}],
    ["Computer Room", "غرفة الحاسوب", "room", 262, 760, {}],
    ["Studio Hall", "قاعة الاستوديو", "room", 440, 140, {}],
    ["Sculpture Studio", "استوديو النحت", "room", 1150, 350, {}],
    ["Metal Workshop", "ورشة المعادن", "room", 1300, 330, {}],
    ["Wood Workshop", "ورشة الخشب", "room", 1262, 455, {}],
    ["Printing Workshop", "ورشة الطباعة", "room", 1300, 760, {}],
    ["Print Making", "استوديو الطباعة الفنية", "room", 1052, 850, {}],
    ["Service Entrance (north-west)", "مدخل الخدمة (الشمالي الغربي)", "entrance", 340, 118, {}],
    ["Service Entrance (north-east)", "مدخل الخدمة (الشمالي الشرقي)", "entrance", 1224, 124, {}],
    ["Service Entrance (south-west)", "مدخل الخدمة (الجنوبي الغربي)", "entrance", 340, 962, {}],
    ["Service Entrance (south-east)", "مدخل الخدمة (الجنوبي الشرقي)", "entrance", 1224, 962, {}],
]


if __name__ == "__main__":
    segs = carve(wall_segments())
    corner = frame(segs)
    (HERE / "fine_arts_ground.dxf").write_text(dxf(segs, corner))
    pts = [[en, ar, cat, *to_m(corner, x * K, y * K), opt] for en, ar, cat, x, y, opt in PLACES]
    floors = [{"dxf": "fine_arts_ground.dxf", "floor": "Ground Floor", "points": pts, "geo": geo(corner)}]
    (HERE / "floors.json").write_text(json.dumps({"building": "UoS Fine Arts and Design (test)", "buildingAr": "كلية الفنون الجميلة والتصميم - جامعة الشارقة (تجريبي)", "floors": floors}, ensure_ascii=False, indent=1))
    print("Ground Floor: {} wall segments, {} places, corner {} -> fine_arts_ground.dxf, floors.json".format(len(segs), len(pts), corner))
