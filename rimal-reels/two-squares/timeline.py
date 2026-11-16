#!/usr/bin/env python3
"""Single source of truth for the Rimal "two squares" reel.

Writes timeline.json (for QA scripts) and timeline.js (for the page).
Music clock: designed grid, 96 BPM, 4/4 -> beat 0.625 s, bar 2.5 s, 13 bars = 32.5 s.
Usage: python3 timeline.py [en|ar]
"""
import json
import sys
from pathlib import Path

LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
BPM = 96
BEAT = 60 / BPM          # 0.625
BAR = 4 * BEAT           # 2.5
def b(n):                # time of beat n
    return round(n * BEAT, 4)

DUR = 13 * BAR           # 32.5

# ---- named beats (seconds), all on the grid ------------------------------------------
B = {
    "hook.start": 0.0, "hook.slam": b(4),                       # "two squares" lands on bar 1
    "star.start": b(6), "star.zoomEnd": b(7.4), "star.dropB": b(7.4),
    "star.copy": b(8), "star.turn": b(10.4), "star.turnEnd": b(11.7),
    "star.tips": b(12), "star.name": b(14),
    "grid.start": b(16), "grid.stampsEnd": b(19.2), "grid.cross": b(20), "grid.term": b(22),
    "angle.start": b(24), "angle.morph": b(25.5), "angle.morphEnd": b(29.5), "angle.new": b(30),
    "room.start": b(32), "room.inEnd": b(34), "room.silence": b(35.1),
    "hero": b(36),                                                # 22.5 s = 69 %
    "room.push": b(41), "cta.start": b(44), "cta.free": b(46), "cta.link": b(48),
}

# ---- captions: chunks of 1-4 words; pill walks the words, then rests on `rest` ---------
CAP = {
  "en": [
    ("hook.start", 1.875, "Every star on this wall", None),
    (None, 3.75, "is just two squares.", "hook"),
    ("star.start", 5.0, "Take one square.", None),
    ("star.copy", 6.25, "Copy it.", None),
    (None, 7.5, "Turn it 45°.", None),
    ("star.tips", 8.44, "Eight points.", None),
    (None, 10.0, "Rub el Hizb.", "term"),
    ("grid.start", 10.94, "Repeat it", None),
    (None, 12.5, "on a grid…", None),
    ("grid.cross", 13.75, "the gaps become crosses.", None),
    ("grid.term", 15.0, "Star-and-cross.", "term"),
    ("angle.start", 15.94, "Now change", None),
    (None, 17.5, "one angle.", None),
    (None, 18.75, "Same grid.", None),
    ("angle.new", 20.0, "New pattern.", None),
    (20.0, 20.94, "Cut it into", None),
    (None, 22.4, "a mashrabiya…", "term"),
    (22.6, 24.06, "and the sun draws it", None),
    (None, 25.6, "on your floor.", None),
    (27.6, 28.75, "Make your own,", None),
    ("cta.free", 29.7, "free.", None),
    (None, DUR, "Pattern Lab · link in bio", "cta"),
  ],
  # Arabic: draft, needs a native-speaker check before posting.
  "ar": [
    ("hook.start", 1.875, "كل نجمة في هذا الجدار", None),
    (None, 3.75, "ما هي إلا مربّعان.", "hook"),
    ("star.start", 5.0, "خذ مربّعاً واحداً.", None),
    ("star.copy", 6.25, "انسخه.", None),
    (None, 7.5, "أدِره ٤٥ درجة.", None),
    ("star.tips", 8.44, "ثماني رؤوس.", None),
    (None, 10.0, "اسمها: ربع الحزب", "term"),
    ("grid.start", 10.94, "كرّرها", None),
    (None, 12.5, "على شبكة…", None),
    ("grid.cross", 13.75, "فتصير الفراغات صلباناً.", None),
    ("grid.term", 15.0, "نجمة وصليب.", "term"),
    ("angle.start", 15.94, "والآن غيّر", None),
    (None, 17.5, "زاوية واحدة.", None),
    (None, 18.75, "الشبكة نفسها.", None),
    ("angle.new", 20.0, "نقشة جديدة.", None),
    (20.0, 20.94, "اقطعها", None),
    (None, 22.4, "مشربيةً…", "term"),
    (22.6, 24.06, "فترسمها الشمس", None),
    (None, 25.6, "على أرضيّتك.", None),
    (27.6, 28.75, "صمّم نقشتك،", None),
    ("cta.free", 29.7, "مجاناً.", None),
    (None, DUR, "مختبر الزخارف · الرابط في البايو", "cta"),
  ],
}

LABELS = {
  "en": {"ch": ["TWO SQUARES", "THE GRID", "ONE ANGLE", "MASHRABIYA", "PATTERN LAB"],
         "name": "RUB EL HIZB", "term": "STAR-AND-CROSS",
         "source": "Tile panel · Iran, probably Kashan, 1260–70 · The Met",
         "angle": "CONTACT ANGLE", "foot": "Illustration · Rimal Interiors",
         "cardKick": "FREE TOOL", "cardTitle": "Pattern Lab", "cardSub": "by Rimal Interiors",
         "handle": "@rimalinterior"},
  "ar": {"ch": ["مربّعان", "الشبكة", "زاوية واحدة", "المشربية", "مختبر الزخارف"],
         "name": "ربع الحزب", "term": "نجمة وصليب",
         "source": "لوح بلاط · إيران، ١٢٦٠–١٢٧٠ · متحف المتروبوليتان",
         "angle": "زاوية التلاقي", "foot": "رسم توضيحي · رمال للتصميم الداخلي",
         "cardKick": "أداة مجانية", "cardTitle": "مختبر الزخارف", "cardSub": "من رمال للتصميم الداخلي",
         "handle": "@rimalinterior"},
}

def resolve(x):
    return B[x] if isinstance(x, str) else x

caps, prev_to = [], 0.0
for frm, to, text, role in CAP[LANG]:
    f = prev_to if frm is None else resolve(frm)
    caps.append({"from": round(f, 4), "to": round(to, 4), "text": text, "role": role})
    prev_to = to

scenes = [
    {"id": "hook", "start": 0.0, "end": B["star.start"]},
    {"id": "star", "start": B["star.start"], "end": B["grid.start"]},
    {"id": "grid", "start": B["grid.start"], "end": B["angle.start"]},
    {"id": "angle", "start": B["angle.start"], "end": B["room.start"]},
    {"id": "room", "start": B["room.start"], "end": B["cta.start"]},
    {"id": "cta", "start": B["cta.start"], "end": DUR},
]
for s in scenes:
    s["beats"] = {k.split(".", 1)[1]: v for k, v in B.items() if k.split(".")[0] == s["id"]}
scenes[4]["beats"]["hero"] = B["hero"]
trans = {
    "hook": ("push-in", "zoom into one star of the wall: the subject of the next beat"),
    "star": ("pull-out", "the single star is stamped into the grid: next step"),
    "grid": ("line-morph", "same lattice, interior lines dissolve into Hankin lines"),
    "angle": ("shrink-into-window", "the pattern becomes the mashrabiya screen: object changes role"),
    "room": ("hard cut on bar 11", "chapter slam to the CTA; bookends the opening wall"),
}
for s in scenes[:-1]:
    t, why = trans[s["id"]]
    s["transitionOut"] = {"type": t, "dur": 0.8, "why": why}

texts = []
for c in caps:
    if c["role"] in ("hook", "cta", "term"):
        texts.append({"id": c["role"] + "_" + str(len(texts)), "text": c["text"], "from": c["from"],
                      "to": c["to"], "role": c["role"], "px": 84, "box": [100, (318 if B["room.start"] <= c["from"] < B["cta.start"] else 1236), 880, 110]})

TL = {
    "meta": {"w": 1080, "h": 1920, "fps": 30, "dur": DUR, "lang": LANG, "clock": "music",
             "register": "editorial", "loop": False, "bpm": BPM, "meter": "4/4", "bars": 13, "t0": 0.0,
             "grid": "designed", "hookWaiver": "CTA (Pattern Lab, link in bio) closes the film; handle footnote is visible from frame 0",
             "vo": {"status": "NONE", "file": None, "rateWps": None}},
    "objects": [{"id": "lattice", "role": "constant", "what": "the star lattice: wall, grid, screen, floor shadow"},
                {"id": "star", "role": "hero", "what": "one 8-point star made of two squares"}],
    "beats": B,
    "scenes": scenes,
    "captions": caps,
    "texts": texts,
    "terms": ["Rub el Hizb", "star-and-cross", "mashrabiya"] if LANG == "en" else ["ربع الحزب", "نجمة وصليب", "مشربية"],
    "labels": LABELS[LANG],
    "cuts": [B["cta.start"]],
    "hero": {"t": B["hero"], "what": "sunlight switches on through the mashrabiya and draws the pattern on the floor"},
    "silences": [{"from": B["room.silence"], "to": B["hero"]}],
    "reads": [{"what": c["text"], "from": c["from"], "to": c["to"]} for c in caps],
}

out = Path(__file__).parent
(out / f"timeline.{LANG}.json").write_text(json.dumps(TL, ensure_ascii=False, indent=1))
(out / f"timeline.{LANG}.js").write_text("window.TL = " + json.dumps(TL, ensure_ascii=False) + ";\n")
print(f"wrote timeline.{LANG}.json/js  dur={DUR}s  captions={len(caps)}  hero={B['hero']}")
