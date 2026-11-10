#!/usr/bin/env python3
"""Builds timeline.json — the one clock for picture, sound, captions and QA.

The clock is the voice. Each VO line has a measured duration (vo/lines.json, written by cut_vo.py)
or, until the VO exists, an estimate. Lines are laid end to end with designed gaps; every beat,
camera move, SFX and caption below is derived from line starts/ends and word cues, never typed
as a bare time.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30

# id, spoken text, estimated seconds, gap BEFORE the line, word cues as fractions of the line (estimates)
LINES = [
    ("L1",  "أكثر شي يضيّع وقت المعماري، مو التصميم نفسه.", 3.3, 0.35, {"mo": 0.62}),
    ("L2",  "البحث عن الأدوات.", 1.4, 0.25, {}),
    ("L3",  "تخيّل لو كلها عندك من البداية.", 2.3, 0.45, {}),
    ("L4",  "هاي هي حزمة المهندس المعماري الشاملة.", 2.8, 0.35, {"hizma": 0.28}),
    ("L5",  "إذا شغلك على ريفيت، مكتبة فاميليز بحجم ستة وعشرين جيجابايت.", 4.6, 1.00, {"lib": 0.36, "num": 0.66}),
    ("L6",  "لأوتوكاد، أكثر من ثلاثة آلاف بلوك ذكي، تتحكم بأبعادها خلال ثواني.", 5.2, 1.20, {"num": 0.22, "control": 0.62}),
    ("L7",  "وفوقها، أكثر من ستة آلاف بلوك إضافي.", 3.0, 0.50, {"num": 0.34}),
    ("L8",  "لسكتش أب، أكثر من ثلاثين إضافة احترافية،", 3.0, 1.00, {"num": 0.38}),
    ("L9",  "ومن ضمنها مولّد المطابخ.", 1.9, 0.75, {"kitchen": 0.45}),
    ("L10", "ولثري دي ماكس، سكربتات تولّد النوافذ والأبواب والمطابخ.", 4.2, 0.60, {"scripts": 0.30, "windows": 0.52, "doors": 0.70, "kitchens": 0.86}),
    ("L11", "وحتى الذكاء الاصطناعي، أكثر من خمسة آلاف برومت جاهز.", 4.0, 0.90, {"num": 0.50}),
    ("L12", "خلّي أدواتك كلها بمكان واحد.", 2.3, 0.90, {}),
    ("L13", "وكم رح تدفع مقابل كل هذا؟", 2.1, 0.35, {}),
    ("L14", "خمسة وعشرين دولار فقط.", 2.0, 0.80, {"faqat": 0.72}),
    ("L15", "اكتب كلمة حزمة بالتعليقات، ونرسل لك الرابط.", 3.4, 0.70, {"hizma": 0.28, "send": 0.58}),
]
TAIL = 1.7          # still hold after the last word
CELL = {            # 3x3 sheet, visited as a ring that closes on the centre (right-to-left, like the script)
    "title": (2, 0), "revit": (1, 0), "autocad": (0, 0), "blocks": (0, 1), "sketchup": (0, 2),
    "kitchen": (1, 2), "max": (2, 2), "ai": (2, 1), "price": (1, 1),
}


def centre(name):
    c, r = CELL[name]
    return (c * W + W / 2, r * H + H / 2)


def main():
    measured = {}
    p = os.path.join(HERE, "vo", "lines.json")
    if os.path.exists(p):
        measured = {l["id"]: l for l in json.load(open(p, encoding="utf-8"))}
    status = "RENDERED" if measured else "ESTIMATED"

    vo, cues, t = [], {}, 0.0
    for lid, text, est, gap, frac in LINES:
        m = measured.get(lid)
        dur = m["dur"] if m else est
        t += gap
        line = {"id": lid, "text": text, "from": round(t, 3), "to": round(t + dur, 3)}
        if m:
            line["file"] = m["file"]
            line["words"] = [{"w": w["w"], "t": round(t + w["s"], 3)} for w in m.get("words", [])]
        vo.append(line)
        cues[f"{lid}.s"], cues[f"{lid}.e"] = line["from"], line["to"]
        for k, f in frac.items():
            off = m["cues"][k] if m and k in m.get("cues", {}) else f * dur
            cues[f"{lid}.{k}"] = round(t + off, 3)
        t += dur
    dur = round((t + TAIL) * FPS) / FPS
    c = lambda k: cues[k]

    # ---- camera: one move per entry, [t0, t1] -> (zoom, x, y) ----
    cam = [{"t0": 0, "t1": 0, "zoom": 1, "x": centre("title")[0], "y": centre("title")[1], "ease": "hold", "why": "open on the hook"}]

    def whip(name, line, lead=0.45, tail=0.10, why=""):
        x, y = centre(name)
        cam.append({"t0": round(c(line + ".s") - lead, 3), "t1": round(c(line + ".s") + tail, 3), "zoom": 1, "x": x, "y": y, "ease": "whip", "why": why, "to": name})

    whip("revit", "L5", why="next tool: the sheet continues to the left")
    whip("autocad", "L6", why="next tool")
    whip("blocks", "L7", why="'on top of that': drop down the sheet")
    whip("sketchup", "L8", why="next tool")
    whip("kitchen", "L9", 0.32, 0.16, why="'including': the neighbour cell")
    whip("max", "L10", why="next tool")
    whip("ai", "L11", why="last tool, back up the sheet")
    gx, gy = centre("price")
    cam.append({"t0": round(c("L12.s") - 0.15, 3), "t1": round(c("L12.s") + 1.55, 3), "zoom": 1 / 3, "x": gx, "y": gy, "ease": "inout", "why": "zoom extents: every tool is on one sheet", "to": "grid"})
    cam.append({"t0": round(c("L14.s") - 0.30, 3), "t1": round(c("L14.s") + 0.05, 3), "zoom": 0.56, "x": gx, "y": gy, "ease": "out", "why": "payoff: push into the empty centre as the price lands", "to": "price"})
    cam.append({"t0": round(c("L15.s") - 0.25, 3), "t1": round(c("L15.s") + 0.75, 3), "zoom": 0.5, "x": gx, "y": gy + 150, "ease": "inout", "why": "make room for the comment field", "to": "cta"})

    hit = round(c("L14.s") - 0.26, 3)          # payoff hit sits in the pause before the line that names the price
    cues.update({
        "hook.search": c("L2.s"), "hook.imagine": round(c("L3.s") - 0.05, 3), "hook.sweep": round(c("L3.e") - 0.42, 3), "title.in": round(c("L3.e") - 0.42 + 0.34, 3),
        "grid.start": cam[-3]["t0"], "grid.land": cam[-3]["t1"], "question.in": round(c("L13.s") - 0.05, 3),
        "price.hit": hit, "cta.in": round(c("L15.s") - 0.25, 3), "end": dur,
    })
    for m in cam[1:8]:
        cues[m["to"] + ".go"], cues[m["to"] + ".land"] = m["t0"], m["t1"]
    cues["max.draw"] = round(cues["max.land"] + 0.3, 3)

    names = ["title", "revit", "autocad", "blocks", "sketchup", "kitchen", "max", "ai"]
    bounds = [0.0] + [cues[n + ".land"] for n in names[1:]] + [cues["grid.start"]]
    scenes = [{"id": "hook", "start": 0.0, "end": cues["title.in"], "beats": {"search": cues["hook.search"], "imagine": cues["hook.imagine"], "sweep": cues["hook.sweep"]},
               "cueRef": {"search": "L2.start", "imagine": "L3.start", "sweep": "L3.end - 0.42"},
               "transitionOut": {"type": "cause-effect", "dur": 0.5, "why": "the crosshair sweeps the scattered searches into one point; the point opens into the vault's title", "bridge": "crosshair"}}]
    why = {"revit": "next step along the sheet (whip left)", "autocad": "next step (whip left)", "blocks": "'on top of that' — drop down",
           "sketchup": "next step (drop down)", "kitchen": "'including' — slide to the neighbour", "max": "next step (whip right)", "ai": "last tool (rise)"}
    scenes.append({"id": "title", "start": cues["title.in"], "end": cues["revit.land"], "beats": {"hizma": cues["L4.hizma"]}, "cueRef": {"hizma": "L4.حزمة"},
                   "transitionOut": {"type": "whip pan", "dur": 0.55, "why": why["revit"], "bridge": "crosshair"}})
    for i, n in enumerate(names[1:], start=1):
        beats = {k.split(".")[1]: v for k, v in cues.items() if k.startswith(f"L{i + 4}.") and not k.endswith((".s", ".e"))} if n != "kitchen" else {"kitchen": cues["L9.kitchen"]}
        nxt = names[i + 1] if i + 1 < len(names) else None
        scenes.append({"id": n, "start": bounds[i], "end": bounds[i + 1], "beats": beats,
                       "transitionOut": {"type": "whip pan", "dur": 0.55, "why": why[nxt], "bridge": "crosshair"} if nxt else
                       {"type": "scale through (zoom extents)", "dur": 1.7, "why": "'keep all your tools in one place': the eight cells turn out to be one sheet", "bridge": "crosshair"}})
    scenes += [
        {"id": "grid", "start": cues["grid.start"], "end": hit, "beats": {"land": cues["grid.land"], "question": cues["question.in"]},
         "cueRef": {"question": "L13.start"}, "transitionOut": {"type": "push in", "dur": 0.35, "why": "the answer fills the one empty cell", "bridge": "crosshair"}},
        {"id": "price", "start": hit, "end": cues["cta.in"], "beats": {"hit": hit, "faqat": cues["L14.faqat"]}, "cueRef": {"hit": "L14.start - 0.26"},
         "transitionOut": {"type": "next step", "dur": 1.0, "why": "the standing CTA chip opens into the comment field", "bridge": "cta chip"}},
        {"id": "cta", "start": cues["cta.in"], "end": dur, "beats": {"hizma": cues["L15.hizma"], "send": cues["L15.send"]}, "cueRef": {"hizma": "L15.حزمة", "send": "L15.ونرسل"}},
    ]

    # ---- sound: every cue is relative to a beat ----
    sfx = [
        {"at": "hook.search", "offset": 0.0, "src": "tick", "gain": 0.16, "why": "first search lands"},
        {"at": "hook.sweep", "offset": 0.0, "src": "suck", "gain": 0.22, "why": "searches collapse into the crosshair"},
        {"at": "title.hizma", "offset": 0.0, "src": "thud", "gain": 0.15, "why": "the name lands"},
        {"at": "title.whip", "offset": 0.0, "src": "whoosh", "gain": 0.17, "why": "first whip"},
        {"at": "revit.num", "offset": 0.0, "src": "pluck_hi", "gain": 0.14, "why": "26 GB stops"},
        {"at": "autocad.num", "offset": 0.0, "src": "pluck_hi", "gain": 0.12, "why": "3000 stops"},
        {"at": "autocad.drop", "offset": 0.0, "src": "whoosh_low", "gain": 0.16, "why": "drop down the sheet"},
        {"at": "blocks.num", "offset": 0.0, "src": "pluck_hi", "gain": 0.12, "why": "6000 stops"},
        {"at": "sketchup.num", "offset": 0.0, "src": "pluck_hi", "gain": 0.11, "why": "30 stops"},
        {"at": "sketchup.slide", "offset": 0.0, "src": "whoosh", "gain": 0.13, "why": "slide to the kitchen tool"},
        {"at": "max.draw", "offset": 0.0, "src": "pen", "gain": 0.10, "why": "line art draws"},
        {"at": "ai.num", "offset": 0.0, "src": "pluck_hi", "gain": 0.12, "why": "5000 stops"},
        {"at": "grid.start", "offset": 0.0, "src": "riser", "gain": 0.20, "why": "zoom extents builds to the question"},
        {"at": "price.hit", "offset": 0.0, "src": "impact", "gain": 0.62, "why": "PAYOFF: loudest non-voice sound, in the pause before the price is said"},
        {"at": "price.faqat", "offset": 0.0, "src": "sparkle", "gain": 0.10, "why": "'only'"},
        {"at": "cta.hizma", "offset": 0.0, "src": "keys", "gain": 0.12, "why": "typing the word"},
        {"at": "cta.send", "offset": 0.0, "src": "pluck_hi", "gain": 0.14, "why": "sent"},
    ]
    silences = [{"from": round(c("L13.e") + 0.08, 3), "to": round(hit - 0.02, 3)}]

    # ---- on-screen text (role-marked for QA) and subtitles ----
    texts = [
        {"id": "hook", "text": "أكثر شي يضيّع وقت المعماري؟", "from": 0.0, "to": cues["hook.imagine"], "role": "hook", "px": 150, "box": [60, 380, 960, 360]},
        {"id": "hook2", "text": "البحث عن الأدوات", "from": round(cues["hook.search"] + 0.45, 3), "to": cues["hook.imagine"], "role": "hook", "px": 140, "box": [60, 900, 960, 190]},
        {"id": "imagine", "text": "تخيّل لو كلها عندك من البداية", "from": round(cues["hook.imagine"] + 0.95, 3), "to": cues["hook.sweep"], "px": 122},
        {"id": "cta-chip", "text": "اكتب «حزمة» بالتعليقات", "from": 2.3, "to": cues["cta.in"], "role": "cta", "px": 50, "box": [230, 1404, 620, 90]},
        {"id": "name", "text": "حزمة المهندس المعماري الشاملة", "from": round(cues["L4.hizma"] + 0.7, 3), "to": cues["revit.go"], "role": "term", "px": 120, "box": [80, 620, 920, 560]},
        {"id": "revit", "text": "مكتبة فاميليز ريفيت", "from": round(cues["revit.land"] + 0.85, 3), "to": cues["autocad.go"], "role": "term", "px": 78},
        {"id": "revit-n", "text": "26 GB", "from": cues["L5.num"], "to": cues["autocad.go"], "px": 250},
        {"id": "autocad", "text": "+3000 بلوك ذكي لأوتوكاد", "from": round(cues["L6.num"] + 0.25, 3), "to": cues["blocks.go"], "px": 76},
        {"id": "blocks", "text": "+6000 بلوك إضافي", "from": cues["L7.num"], "to": cues["sketchup.go"], "px": 76},
        {"id": "sketchup", "text": "إضافة احترافية لسكتش أب", "from": round(cues["sketchup.land"] + 0.95, 3), "to": cues["kitchen.go"], "px": 60},
        {"id": "sketchup-n", "text": "+30", "from": cues["L8.num"], "to": cues["kitchen.go"], "px": 186},
        {"id": "kitchen", "text": "مولد المطابخ", "from": round(cues["kitchen.land"] + 0.7, 3), "to": cues["max.go"], "px": 120},
        {"id": "max", "text": "سكربتات ثري دي ماكس", "from": round(cues["L10.scripts"] + 0.3, 3), "to": cues["ai.go"], "px": 92},
        {"id": "ai", "text": "+5000 برومت جاهز", "from": round(cues["L11.num"] + 0.3, 3), "to": cues["grid.start"], "px": 84},
        {"id": "question", "text": "كم رح تدفع مقابل كل هذا؟", "from": round(cues["question.in"] + 0.5, 3), "to": hit, "px": 88},
        {"id": "price", "text": "25$ فقط", "from": round(hit + 0.3, 3), "to": dur, "role": "term", "px": 300},
        {"id": "cta", "text": "اكتب «حزمة» بالتعليقات", "from": round(cues["L15.hizma"] + 0.5, 3), "to": dur, "role": "cta", "px": 60},
    ]
    captions = [{"from": l["from"], "to": round(min(l["to"] + 0.25, vo[i + 1]["from"] if i + 1 < len(vo) else dur), 3), "text": l["text"], "src": "vo:" + l["id"]} for i, l in enumerate(vo)]

    tl = {
        "meta": {"w": W, "h": H, "fps": FPS, "dur": dur, "clock": "voice", "register": "clean", "loop": False, "grid": "none",
                 "hookWaiver": None, "vo": {"status": status, "file": "vo/vo.wav" if measured else None, "rateWps": None}},
        "objects": [
            {"id": "crosshair", "role": "constant", "what": "gold CAD crosshair: it drafts every window, leads every camera move and ends as the caret that types the CTA"},
            {"id": "cta chip", "role": "bridge", "what": "standing comment prompt that opens into the comment field at the end"},
            {"id": "price", "role": "hero", "what": "25$ filling the one empty cell of the sheet"},
        ],
        "cells": CELL, "vo": vo, "cues": cues, "scenes": scenes, "camera": cam,
        "cuts": [], "hero": {"t": hit, "what": "25$ lands in the empty centre cell"},
        "silences": silences, "sfx": sfx, "captions": captions, "texts": texts,
        "terms": ["حزمة المهندس المعماري الشاملة", "ريفيت"],
    }
    # QA reads sfx 'at' as scene.beat; make every referenced beat resolvable from scenes
    sb = {s["id"]: s for s in scenes}
    for e in sfx:
        sid, b = e["at"].split(".")
        key = e["at"] if e["at"] in cues else None
        tval = cues.get(e["at"])
        if tval is None:
            tval = cues.get({"title.hizma": "L4.hizma", "revit.num": "L5.num", "autocad.num": "L6.num", "blocks.num": "L7.num", "sketchup.num": "L8.num",
                             "max.draw": "max.draw", "title.whip": "revit.go", "autocad.drop": "blocks.go", "sketchup.slide": "kitchen.go", "ai.num": "L11.num", "price.faqat": "L14.faqat", "cta.hizma": "L15.hizma", "cta.send": "L15.send"}[e["at"]])
        sb[sid]["beats"].setdefault(b, tval)
        e["t"] = round(tval + e["offset"], 3)
    json.dump(tl, open(os.path.join(HERE, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"timeline.json: {dur:.2f} s, {int(round(dur * FPS))} frames, VO {status}")


if __name__ == "__main__":
    main()
