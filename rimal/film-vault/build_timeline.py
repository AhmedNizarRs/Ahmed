#!/usr/bin/env python3
"""Build timeline.json from the measured word timings (vo/words.json) and the VO edit map.
Every beat is derived from a word, so a re-take or re-edit is one re-run."""
import json
from pathlib import Path

here = Path(__file__).parent
W = json.loads((here / "vo/words.json").read_text())

def remap(t):  # same cut list as vo/edit_vo.sh
    if t < 24.62: return t + 0.4
    if t < 26.06: return t + 1.3
    return max(t, 27.24) + 0.42

def ws(i): return round(remap(W[i]["t"]), 3)
def we(i): return round(remap(min(W[i]["e"], 26.05) if 24.62 <= W[i]["t"] < 26.06 else W[i]["e"]), 3)

LINES = [  # (id, script text, first word idx, last word idx)
    ("L1", "حقيبة الأدوات المعمارية الشاملة.", 0, 3),
    ("L2", "كل أداة تحتاجها، في تنزيل واحد.", 4, 9),
    ("L3", "أكثر من 3000 بلوك أوتوكاد ديناميكي.", 10, 15),
    ("L4", "مكتبة عائلات ريفيت، 26 جيجابايت.", 16, 21),
    ("L5", "إضافات سكتش أب،", 22, 24),
    ("L6", "وسكربتات ثري دي ماكس.", 25, 28),
    ("L7", "وزخارف إسلامية جاهزة.", 29, 31),
    ("L8", "لماذا ترسم كل شيء من الصفر؟", 32, 37),
    ("L9", "ابدأ التصميم.", 38, 39),
    ("L10", "كل هذا بأقل من 25 دولاراً.", 41, 46),
    ("L11", "من رمال.", 47, 48),
]
vo = [{"id": i, "text": txt, "from": ws(a), "to": we(b),
       "words": [{"w": W[k]["w"], "t": ws(k)} for k in range(a, b + 1)]} for i, txt, a, b in LINES]
L = {l["id"]: l for l in vo}
def w_of(line, n): return L[line]["words"][n]["t"]

DUR = 34.5
hero = round(25.55, 3)
beats = {
    # scene: (start, end, {beat: t})
    "vault":  (0.0, 6.9, {"drawBox": 0.6, "drawArrow": w_of("L2", 0), "arrowDone": round(L["L2"]["to"] - 0.1, 3)}),
    "cad":    (6.9, 10.7, {"draw": 6.9, "term": w_of("L3", 2), "done": 10.2}),
    "revit":  (10.7, 14.5, {"draw": 10.75, "term": w_of("L4", 2), "done": 14.0}),
    "su":     (14.5, 16.3, {"draw": 14.7, "term": w_of("L5", 0), "done": 16.0}),
    "max":    (16.3, 18.4, {"draw": 16.35, "term": w_of("L6", 0), "done": 18.1}),
    "star":   (18.4, 21.9, {"draw": 18.45, "term": w_of("L7", 0), "done": 20.7}),
    "turn":   (21.9, hero, {"rise": w_of("L8", 0), "still": 24.85}),
    "hero":   (hero, 27.4, {"split": hero, "filled": round(hero + 1.4, 3)}),
    "end":    (27.4, DUR, {"price": w_of("L10", 4), "stamp": w_of("L11", 0), "cta": round(L["L11"]["to"] + 0.2, 3)}),
}
why = {
    "vault": "follow the ball to the next tool (next item on the list)",
    "cad": "follow the ball (next item)", "revit": "follow the ball (next item)",
    "su": "follow the ball (next item)", "max": "follow the ball (next item)",
    "star": "camera rises to show how little one ball has drawn (the turn)",
    "turn": "silence breaks into the hero (cause: the question; effect: everything at once)",
    "hero": "hold on the filled table; the price lands on it",
}
scenes = []
for sid, (a, b, bt) in beats.items():
    s = {"id": sid, "start": a, "end": b, "beats": bt}
    if sid in why: s["transitionOut"] = {"type": "continuous", "dur": 0, "why": why[sid], "bridge": "ball"}
    scenes.append(s)

def T(id, text, a, b, role=None, px=None, zone="top"):
    return {"id": id, "text": text, "from": round(a, 3), "to": round(b, 3), "role": role, "px": px, "zone": zone}

texts = [
    T("hook", "حقيبة الأدوات المعمارية الشاملة", 0.0, 6.0, "hook", 100),
    T("sub2", "كل أداة تحتاجها، في تنزيل واحد", L["L2"]["from"], 6.2, None, 54),
    T("cta0", "رمال · الرابط في البايو", 0.0, 6.2, "cta", 48, "bottom"),
    T("cad", "أكثر من 3000 بلوك أوتوكاد ديناميكي", w_of("L3", 0), 10.55, "term", 64),
    T("revit", "عائلات ريفيت · 26 GB", w_of("L4", 1), 13.95, "term", 92),
    T("su", "إضافات سكتش أب", 14.4, 18.45, "term", 84),
    T("max", "وسكربتات ثري دي ماكس", w_of("L6", 0), 18.45, None, 84, "top2"),
    T("star", "زخارف إسلامية جاهزة", 18.95, 21.4, None, 92),
    T("why", "لماذا ترسم كل شيء من الصفر؟", w_of("L8", 0), 24.85, None, 84),
    T("go", "ابدأ التصميم، لا البحث.", w_of("L9", 0) - 0.05, 29.1, None, 92),
    T("price", "$24.99", w_of("L10", 4), DUR, None, 190),
    T("was", "$84.96", w_of("L10", 4) + 0.25, DUR, None, 60),
    T("name2", "حقيبة الأدوات المعمارية الشاملة", w_of("L10", 4) + 0.25, DUR, None, 54),
    T("cta1", "الرابط في البايو", L["L11"]["to"] + 0.2, DUR, "cta", 56, "bottom"),
    T("url", "kingahmed10.gumroad.com", L["L11"]["to"] + 0.35, DUR, None, 44, "bottom"),
]

tl = {
    "meta": {"w": 1080, "h": 1920, "fps": 60, "dur": DUR, "clock": "voice", "register": "clean",
             "loop": False, "grid": "none", "hookWaiver": None,
             "vo": {"status": "RENDERED", "file": "vo/vo_edit.wav", "voice": "ElevenLabs · Mohammed Ali · eleven_v3",
                    "timings": "faster-whisper medium word timestamps, remapped through vo/edit_vo.sh"}},
    "objects": [{"id": "ball", "role": "constant", "what": "brass ball ploughing the groove"},
                {"id": "table", "role": "constant", "what": "dark sand table, 1800x3200 world units (9:16)"}],
    "vo": vo,
    "scenes": scenes,
    "hero": {"t": hero, "what": "the ball splits; the star tessellation fills the table"},
    "silences": [{"from": 24.85, "to": hero}],
    "cuts": [],
    "sfx": [{"at": "hero.split", "offset": 0, "src": "boom+rush", "gain": 0, "why": "payoff"},
            {"at": "end.stamp", "offset": 0.05, "src": "chime", "gain": -10, "why": "brand stamp"}],
    "captions": [{"from": l["from"], "to": max(l["to"], l["from"] + 0.9), "text": l["text"], "src": f"vo:{l['id']}"} for l in vo],
    "texts": texts,
    "terms": ["أوتوكاد", "ريفيت", "سكتش أب"],
}
(here / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
for l in vo: print(l["id"], l["from"], l["to"], l["text"])
