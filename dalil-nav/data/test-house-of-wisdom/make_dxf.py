#!/usr/bin/env python3
"""
House of Wisdom (Sharjah): floor-plan pictures -> DXF walls (metres) + the places, for the DALIL Mapper.

INTERNAL TEST ONLY. The drawings are Foster + Partners' published plans (ArchDaily, 2021, "Ground floor plan" and
"Mezzanine floor plan", © Foster + Partners). The House of Wisdom is not a DALIL client or pilot. The pictures are
downloaded when you run this, not stored in the repository.

    python3 data/test-house-of-wisdom/make_dxf.py      (from dalil-nav/; needs Pillow and numpy)
    node data/test-house-of-wisdom/build-maps.cjs      (then builds the navigation maps with the Mapper)

How the plan becomes walls (see vectorize.py):
  - bold lines (3 px and thicker: cores, auditorium) become walls at any length;
  - medium lines (2 px) become walls only when long and straight (3 m or more), so furniture stays out;
  - added by hand from the drawing: the façade (a thin curtain wall in the drawing) with its three entrances,
    the doorway into the auditorium, and on the mezzanine the edges of the open voids (thin balustrades in the
    drawing) and the meeting pod over the courtyard.
Scale: the drawings' own 10 m bar = 120 px (so 12 px per metre); the building measures about 59.7 m square.
Floors are aligned on the four cores (mezzanine picture = ground picture shifted by -127, +118 px).
"""
import json
import math
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from vectorize import walls  # noqa: E402

PICS = {
    "ground": "https://images.adsttc.com/media/images/604a/14b5/f91c/8113/8000/0372/large_jpg/2731_FP728892.jpg",
    "mezzanine": "https://images.adsttc.com/media/images/604a/149f/f91c/8113/8000/0371/large_jpg/2731_FP728893.jpg",
}
CACHE = HERE / ".pictures"          # git-ignored
PX_PER_M = 12.0                     # 10 m scale bar = 120 px on both drawings
CORNER = {"ground": (667, 962), "mezzanine": (545, 1080)}   # bottom-left façade corner in each picture (pixels) = plan 0,0
CENTRE = {"ground": (1024.5, 605), "mezzanine": (900, 723.5)}  # façade centre (pixels)

# Where the building is (plan 0,0 = the centre of the façade square) and which way it faces.
# Location: Foster + Partners' project page gives Plus Code 8G94+9C8 (Al Juraina 1, Sharjah) -> 25.3184125, 55.5060781.
# Bearing: the drawings' north arrow points 36.6° clockwise from "up"; the Makkah arrow agrees within 4° (251° from
# north in the drawing vs a true Qibla bearing of about 255° from Sharjah). So plan +y ("up") points to 325° (−35°).
CENTRE_LNGLAT = (55.5060781, 25.3184125)
BEARING = -35.0
GEO_SOURCE = "Plus Code 8G94+9C8 (Foster + Partners) and the drawing's north arrow; about ±5 m and ±3°, not surveyed"


def geo_for(floor):
    """The DALIL `geo` (lng/lat of plan 0,0 + bearing) so that the façade centre lands on the Plus Code position."""
    cx, cy = to_m(floor, *CENTRE[floor])
    b = math.radians(BEARING); lng0, lat0 = CENTRE_LNGLAT
    mlng = 111412.84 * math.cos(math.radians(lat0)); mlat = 111132.92 - 559.82 * math.cos(2 * math.radians(lat0))
    e = cx * math.cos(b) + cy * math.sin(b); n = -cx * math.sin(b) + cy * math.cos(b)
    return {"origin": [round(lng0 - e / mlng, 8), round(lat0 - n / mlat, 8)], "bearing": BEARING, "scale": 1.0, "source": GEO_SOURCE}


def to_m(floor, px, py):
    x0, y0 = CORNER[floor]   # the Mapper puts a drawing's lower-left corner at 0,0, so the plan frame starts there
    return round((px - x0) / PX_PER_M, 3), round((y0 - py) / PX_PER_M, 3)


def fetch(floor):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / (floor + ".jpg")
    if not f.exists():
        print("Downloading", PICS[floor])
        req = urllib.request.Request(PICS[floor], headers={"User-Agent": "dalil-test/1.0"})
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return f


def cut(segs, box):
    """Removes the parts of horizontal/vertical segments inside a pixel box (x0, y0, x1, y1): a doorway."""
    x0, y0, x1, y1 = box
    out = []
    for (a, b, k) in segs:
        (ax, ay), (bx, by) = a, b
        if ay == by and y0 <= ay <= y1:      # horizontal
            lo, hi = sorted((ax, bx))
            if hi < x0 or lo > x1: out.append((a, b, k)); continue
            if lo < x0: out.append(((lo, ay), (x0, ay), k))
            if hi > x1: out.append(((x1, ay), (hi, ay), k))
        elif ax == bx and x0 <= ax <= x1:    # vertical
            lo, hi = sorted((ay, by))
            if hi < y0 or lo > y1: out.append((a, b, k)); continue
            if lo < y0: out.append(((ax, lo), (ax, y0), k))
            if hi > y1: out.append(((ax, y1), (ax, hi), k))
        else:
            out.append((a, b, k))
    return out


def ring(pts):
    return [(pts[i], pts[(i + 1) % len(pts)], "hand") for i in range(len(pts))]


def facade(x0, y0, x1, y1, gaps):
    """The façade square as segments, leaving the entrance gaps: {'W': (ya, yb), 'E': ..., 'N': (xa, xb), 'S': ...}."""
    segs = []
    def side(a, b, gap):
        (ax, ay), (bx, by) = a, b
        if not gap: segs.append((a, b, "hand")); return
        g0, g1 = gap
        if ax == bx: segs.extend([((ax, ay), (ax, g0), "hand"), ((ax, g1), (ax, by), "hand")])
        else: segs.extend([((ax, ay), (g0, ay), "hand"), ((g1, ay), (bx, by), "hand")])
    side((x0, y0), (x1, y0), gaps.get("N")); side((x0, y1), (x1, y1), gaps.get("S"))
    side((x0, y0), (x0, y1), gaps.get("W")); side((x1, y0), (x1, y1), gaps.get("E"))
    return segs


def floor_segments(floor):
    segs = [(tuple(a), tuple(b), k) for a, b, k in walls(str(fetch(floor)))]
    if floor == "ground":
        segs = cut(segs, (977, 750, 1073, 766))            # auditorium: the doorway between its two front rooms
        # façade with the west entrance (main, Foster: "visitors enter from its western edge"), the east doors
        # and the revolving door on the top edge. Each is a 2 m doorway at the middle of the drawn door set: the
        # Mapper's "keep routes indoors" treats wider gaps as open air.
        segs += facade(667, 248, 1382, 962, {"W": (593, 617), "E": (593, 617), "N": (1015, 1039)})
    else:
        segs += facade(545, 367, 1255, 1080, {})
        o = (515, 345)                                       # the mezzanine points below were read off a crop at this offset
        P = lambda x, y: (x + o[0], y + o[1])
        # Open voids (double-height space over the reception and the courtyard): not walkable. Their edge goes round
        # the meeting pod, which is reached from the south.
        segs += ring([P(232, 22), P(533, 22), P(533, 503), P(447, 503), P(447, 430), P(318, 430), P(318, 503), P(232, 503)])
        segs += [(P(318, 478), P(360, 478), "hand"), (P(410, 478), P(447, 478), "hand")]   # pod front wall, door 360–410
    return segs


def dxf(segs, floor):
    out = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    for a, b, k in segs:
        (x1, y1), (x2, y2) = to_m(floor, *a), to_m(floor, *b)
        if math.hypot(x2 - x1, y2 - y1) < 0.15: continue
        out += ["0", "LINE", "8", "A-WALL", "10", str(x1), "20", str(y1), "30", "0", "11", str(x2), "21", str(y2), "31", "0"]
    out += ["0", "ENDSEC", "0", "EOF"]
    return "\n".join(out) + "\n"


# Places, read off the drawings (pixel positions in each picture). Names come from what the drawing shows
# (auditorium seating, stairs, lift cars, WC cubicles, entrance doors) or from Foster + Partners' description of
# the floors; "est." in the comment = the drawing has no label, so the position is our reading of the furniture.
# Arabic names are drafts: they need a native-speaker check.
PLACES = {
    "ground": [
        # name EN, name AR, category, px, py, options                       source
        ["West Entrance (main)", "المدخل الغربي (الرئيسي)", "entrance", 690, 605, {"node": True, "face": 0}],      # doors in façade; Foster: main entrance on the west
        ["East Entrance", "المدخل الشرقي", "entrance", 1358, 605, {"node": True, "face": 180}],                    # doors in façade
        ["Revolving Door Entrance", "مدخل الباب الدوار", "entrance", 1027, 282, {"face": 270}],                    # revolving door drawn on the top edge
        ["Reception", "الاستقبال", "reception", 790, 618, {"node": True, "face": 0}],                             # curved desk facing the west doors (est.)
        ["Courtyard Garden", "حديقة الفناء", "room", 1020, 610, {}],                                               # planted courtyard, Foster
        ["Exhibition Hall", "قاعة المعارض", "room", 1020, 400, {}],                                                 # large open hall; Foster: exhibition spaces (est.)
        ["Café", "المقهى", "cafe", 800, 455, {}],                                                                  # counter with stools and tables; Foster: café (est.)
        ["Children's Area", "منطقة الأطفال", "room", 755, 690, {}],                                                # play furniture; Foster: children's space (est.)
        ["Reading Area and Book Stacks", "منطقة القراءة ورفوف الكتب", "room", 1240, 610, {}],                      # shelving rows; Foster: reading area
        ["Auditorium", "المسرح", "room", 1025, 800, {}],                                                           # tiered seating
        ["Meeting Room", "غرفة الاجتماعات", "room", 1080, 925, {}],                                                # room with a table
        ["Study Area", "منطقة الدراسة", "room", 1255, 895, {}],                                                    # desks
        ["Toilets (North-East Core)", "دورات المياه (القلب الشمالي الشرقي)", "toilet", 1300, 400, {}],              # WC cubicles
        ["Toilets (South-East Core)", "دورات المياه (القلب الجنوبي الشرقي)", "toilet", 1300, 850, {}],              # WC cubicles
        ["North-West Lift", "المصعد الشمالي الغربي", "lift", 888, 375, {"link": "LIFT-NW"}],                        # lift car inside the stair core; the core opens east
        ["North-East Lift", "المصعد الشمالي الشرقي", "lift", 1162, 375, {"link": "LIFT-NE"}],                     # the core opens west
        ["North-West Staircase", "الدرج الشمالي الغربي", "stairs", 888, 340, {"link": "STAIR-NW"}],               # sculptural stair (Foster), opening east
        ["North-East Staircase", "الدرج الشمالي الشرقي", "stairs", 1162, 340, {"link": "STAIR-NE"}],
        ["Central Stair", "الدرج المركزي", "stairs", 855, 700, {"link": "STAIR-C"}],                              # straight stair in the west hall
        ["South-West Stair", "الدرج الجنوبي الغربي", "stairs", 800, 850, {"link": "STAIR-SW"}],
        ["South-East Stair", "الدرج الجنوبي الشرقي", "stairs", 1240, 850, {"link": "STAIR-SE"}],
    ],
    "mezzanine": [
        ["North-West Lift", "المصعد الشمالي الغربي", "lift", 675, 590, {"link": "LIFT-NW"}],                       # core door, south side
        ["North-East Lift", "المصعد الشمالي الشرقي", "lift", 1100, 595, {"link": "LIFT-NE"}],
        ["North-West Staircase", "الدرج الشمالي الغربي", "stairs", 715, 590, {"link": "STAIR-NW"}],
        ["North-East Staircase", "الدرج الشمالي الشرقي", "stairs", 1140, 595, {"link": "STAIR-NE"}],
        ["Central Stair", "الدرج المركزي", "stairs", 690, 805, {"link": "STAIR-C"}],
        ["South-West Stair", "الدرج الجنوبي الغربي", "stairs", 665, 965, {"link": "STAIR-SW"}],
        ["South-East Stair", "الدرج الجنوبي الشرقي", "stairs", 1115, 965, {"link": "STAIR-SE"}],
        ["West Reading Lounge", "صالة القراءة الغربية", "room", 700, 650, {}],                                      # tables and lounge chairs; Foster: reading lounges
        ["East Reading Lounge", "صالة القراءة الشرقية", "room", 1085, 700, {}],                                    # long tables and shelving
        ["Meeting Pod", "كبسولة الاجتماعات", "room", 900, 800, {}],                                                # pod with a long table over the courtyard (Foster: pods)
        ["Exhibition Area (Mezzanine)", "منطقة المعارض (الميزانين)", "room", 900, 960, {}],                         # display plinths; Foster: exhibition areas
        ["Lounge", "الصالة", "room", 1120, 1030, {}],                                                              # round seats
        ["Toilets (South-West Core)", "دورات المياه (القلب الجنوبي الغربي)", "toilet", 612, 925, {}],               # WC cubicles
        ["Toilets (South-East Core)", "دورات المياه (القلب الجنوبي الشرقي)", "toilet", 1180, 925, {}],
    ],
}

if __name__ == "__main__":
    floors = []
    for floor, label in (("ground", "Ground Floor"), ("mezzanine", "Mezzanine")):
        segs = floor_segments(floor)
        name = "how_%s.dxf" % floor
        (HERE / name).write_text(dxf(segs, floor))
        pts = [[en, ar, cat, *to_m(floor, px, py), opt] for en, ar, cat, px, py, opt in PLACES[floor]]
        floors.append({"dxf": name, "floor": label, "points": pts, "geo": geo_for(floor)})
        print("{}: {} wall segments, {} places -> {}".format(label, len(segs), len(pts), name))
    (HERE / "floors.json").write_text(json.dumps({"building": "House of Wisdom (test)", "floors": floors}, ensure_ascii=False, indent=1))
    print("wrote floors.json")
