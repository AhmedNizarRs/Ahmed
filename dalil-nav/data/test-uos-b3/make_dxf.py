#!/usr/bin/env python3
"""
University of Sharjah, Men's Central Laboratories B3, Ground Floor: the published floor plan (PDF) -> DXF walls
(metres) + the places, for the DALIL Mapper.

INTERNAL TEST ONLY. The plan is the University of Sharjah Central Laboratories Directorate's "B3 Ground Floor"
building layout, supplied by the founder. The university is not a DALIL client or pilot. The PDF is kept out of
the repository (.pictures/ is git-ignored): put it at .pictures/B3-Ground.pdf before running.

    python3 data/test-uos-b3/make_dxf.py        (from dalil-nav/; needs pymupdf, Pillow, numpy)
    node data/test-uos-b3/build-maps.cjs        (then builds the navigation map with the Mapper)

How the plan becomes walls: the PDF page (a picture plus some vector lines) is rendered at 2481 x 1754 px. Dark grey/black straight runs of 0.9 m
or more (18 px), up to 10 px thick (a double wall line), become wall lines; coloured text, door arcs, the X marks and short text strokes
drop out. The title, logos and legend block are masked.
Scale: the drawing has no scale bar. From satellite imagery (Esri World Imagery, z19, 0.27 m/px) the building's
roof measures about 106 m x 61 m; the drawing's outer walls measure 2083 x 1201 px. Both give 0.0508 m/px
(19.7 px per metre), agreeing within 1%. A single door then reads 1.0-1.1 m, as expected.
Position: Google Maps place "Men's Central Laboratories B3" (25.2870679, 55.4778081); the plan's centre sits
about 12 m south-east of that pin on the roof. Direction: the roof edges run at 34° / 124°; the open service
court (pump room, substation) faces the road to the south-east, so the drawing's "up" is 124° from north.
About ±5 m and ±2°, not surveyed.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PIC = HERE / ".pictures"
PX_PER_M = 19.7
BEARING = 124.0
PIN = (55.4778081, 25.2870679)                      # Google Maps place pin (lng, lat)
CENTRE_PX = (1242.5, 825.5)                         # middle of the outer walls in the picture
CENTRE_FROM_PIN_M = (10.17, -6.38)                  # east, north (measured on the satellite image)
GEO_SOURCE = ("Google Maps place pin + roof outline in Esri World Imagery (106 x 61 m, edges at 34°/124°); "
              "about ±5 m and ±2°, not surveyed")
CROP = (150, 160, 2340, 1690)                       # x0, y0, x1, y1: the plan (the page frame is outside)
MASKS = [(990, 50, 1462, 690)]                      # title, logos, legend
MINLEN, MAXTHICK = 18, 10


def picture():
    # The whole page rendered at the picture's own resolution: some walls are vector lines over the picture.
    png = PIC / "b3_ground_page.png"
    if not png.exists():
        import pymupdf
        page = pymupdf.open(PIC / "B3-Ground.pdf")[0]
        z = 2481 / page.rect.width
        page.get_pixmap(matrix=pymupdf.Matrix(z, z)).save(png)
    return np.array(Image.open(png).convert("RGB")).astype(int)


def runs(row, minlen):
    d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
    s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    return [(a, b - 1) for a, b in zip(s, e) if b - a >= minlen]


def rects(mask, minlen, maxthick):
    """Runs along each row, merged with overlapping runs on the next rows -> (x0, x1, y0, y1)."""
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


def wall_segments():
    rgb = picture()
    L = rgb.mean(2); sat = rgb.max(2) - rgb.min(2)
    m = (L < 190) & (sat < 60)
    x0, y0, x1, y1 = CROP
    keep = np.zeros_like(m); keep[y0:y1, x0:x1] = True
    for a, b, c, d in MASKS: keep[b:d, a:c] = False
    m &= keep
    segs = [((a, (c + d) / 2), (b, (c + d) / 2)) for a, b, c, d in rects(m, MINLEN, MAXTHICK)]
    segs += [(((c + d) / 2, a), ((c + d) / 2, b)) for a, b, c, d in rects(m.T, MINLEN, MAXTHICK)]
    return segs


def frame(segs):
    xs = [p[0] for s in segs for p in s]; ys = [p[1] for s in segs for p in s]
    return min(xs), max(ys)          # the Mapper puts a drawing's lower-left corner at 0,0


def to_m(corner, px, py):
    return round((px - corner[0]) / PX_PER_M, 3), round((corner[1] - py) / PX_PER_M, 3)


def geo(corner):
    cx, cy = to_m(corner, *CENTRE_PX)
    lat0 = PIN[1]
    mlng = 111412.84 * math.cos(math.radians(lat0)); mlat = 111132.92 - 559.82 * math.cos(2 * math.radians(lat0))
    clng, clat = PIN[0] + CENTRE_FROM_PIN_M[0] / mlng, PIN[1] + CENTRE_FROM_PIN_M[1] / mlat
    b = math.radians(BEARING)
    e = cx * math.cos(b) + cy * math.sin(b); n = -cx * math.sin(b) + cy * math.cos(b)
    return {"origin": [round(clng - e / mlng, 8), round(clat - n / mlat, 8)], "bearing": BEARING, "scale": 1.0, "source": GEO_SOURCE}


def dxf(segs, corner):
    out = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    for a, b in segs:
        (xa, ya), (xb, yb) = to_m(corner, *a), to_m(corner, *b)
        if math.hypot(xb - xa, yb - ya) < 0.15: continue
        out += ["0", "LINE", "8", "A-WALL", "10", str(xa), "20", str(ya), "30", "0", "11", str(xb), "21", str(yb), "31", "0"]
    out += ["0", "ENDSEC", "0", "EOF"]
    return "\n".join(out) + "\n"


# Places, read off the drawing (positions in the 1654 px wide preview; x1.5 = picture pixels). Names are the
# drawing's own labels; door codes (MD19…) are the drawing's. Toilets are not marked men/women on the drawing.
# Arabic names are drafts: they need a native-speaker check.
PLACES = [
    # name EN, name AR, category, x, y, options
    ["Entrance MD19", "المدخل MD19", "entrance", 632, 1060, {"node": True, "face": 0}],
    ["Entrance MD20", "المدخل MD20", "entrance", 1018, 1060, {"node": True, "face": 180}],
    ["Entrance MD5", "المدخل MD5", "entrance", 1330, 172, {"face": 270}],
    ["Entrance Lobby", "بهو المدخل", "reception", 825, 1060, {"node": True, "face": 90}],
    ["Lift (west)", "المصعد (الغربي)", "lift", 598, 895, {}],
    ["Lift (east)", "المصعد (الشرقي)", "lift", 1055, 895, {}],
    ["Stairs (west)", "الدرج (الغربي)", "stairs", 560, 955, {}],
    ["Stairs (east)", "الدرج (الشرقي)", "stairs", 1090, 955, {}],
    ["Toilets (west)", "دورات المياه (الغربية)", "toilet", 555, 815, {}],
    ["Toilets (east)", "دورات المياه (الشرقية)", "toilet", 1090, 815, {}],
    ["Analytical Chemistry Lab", "مختبر الكيمياء التحليلية", "room", 210, 280, {}],
    ["Ultrasound Lab / Radiographic Skills Lab", "مختبر الموجات فوق الصوتية / مختبر مهارات التصوير الشعاعي", "room", 210, 410, {}],
    ["Sand Casting Lab", "مختبر السباكة الرملية", "room", 190, 490, {}],
    ["General Chemistry Lab (west)", "مختبر الكيمياء العامة (الغربي)", "room", 210, 615, {}],
    ["Organic Chemistry Lab", "مختبر الكيمياء العضوية", "room", 205, 850, {}],
    ["Pharmaceutical Technology Lab", "مختبر التقنية الصيدلانية", "room", 410, 880, {}],
    ["Biotechnology Research Lab", "مختبر أبحاث التقنية الحيوية", "room", 415, 640, {}],
    ["General Chemistry Lab (centre)", "مختبر الكيمياء العامة (الأوسط)", "room", 600, 650, {}],
    ["Materials & Mechanics Lab / Structures & Materials Lab", "مختبر المواد والميكانيكا / مختبر الإنشاءات والمواد", "room", 830, 740, {}],
    ["Mechanics Lab", "مختبر الميكانيكا", "room", 825, 915, {}],
    ["Lecture Room", "قاعة المحاضرات", "room", 935, 915, {}],
    ["Multi Purpose Workshop / Engineering Workshop", "الورشة متعددة الأغراض / الورشة الهندسية", "room", 1160, 620, {}],
    ["Geotechnical Lab", "مختبر الجيوتقنية", "room", 1250, 870, {}],
    ["Fluid Mechanics Lab / Wind Energy Lab", "مختبر ميكانيكا الموائع / مختبر طاقة الرياح", "room", 1445, 265, {}],
    ["Fluid Mechanics Lab (CEE)", "مختبر ميكانيكا الموائع (الهندسة المدنية والبيئية)", "room", 1445, 470, {}],
    ["Radiation Detection Lab", "مختبر الكشف الإشعاعي", "room", 1445, 640, {}],
    ["Applied Radiation Measurement Lab", "مختبر القياس الإشعاعي التطبيقي", "room", 1445, 830, {}],
]


if __name__ == "__main__":
    segs = wall_segments()
    corner = frame(segs)
    (HERE / "b3_ground.dxf").write_text(dxf(segs, corner))
    pts = [[en, ar, cat, *to_m(corner, x * 1.5, y * 1.5), opt] for en, ar, cat, x, y, opt in PLACES]
    floors = [{"dxf": "b3_ground.dxf", "floor": "Ground Floor", "points": pts, "geo": geo(corner)}]
    (HERE / "floors.json").write_text(json.dumps({"building": "UoS Central Labs B3 (test)", "floors": floors}, ensure_ascii=False, indent=1))
    print("Ground Floor: {} wall segments, {} places, corner {} -> b3_ground.dxf, floors.json".format(len(segs), len(pts), corner))
