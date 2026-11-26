#!/usr/bin/env python3
"""Build timeline.json from the VO script and word timings.

Usage:
  python3 build_timeline.py              # estimated timings (2.7 words/s), marked ESTIMATED
  python3 build_timeline.py words.json   # real word timings: [{"w": "...", "t": start, "end": end}, ...]
Every beat comes from a word cue, so a new VO take retimes the whole film in one run.
"""
import json
import re
import sys

FPS, W, H = 30, 1080, 1920
LINES = [
    ("hook", "Five measurements that make any room look professionally designed. Save this."),
    ("art", "One. Hang art with its centre one hundred and forty-five centimetres from the floor. It's called the fifty-seven inch rule."),
    ("coffee", "Two. Keep your coffee table forty to fifty centimetres from the sofa. Close enough to reach your cup."),
    ("pendant", "Three. Hang a pendant seventy-five to ninety centimetres above the dining table."),
    ("dining", "Four. Give every seat at the table sixty centimetres of width."),
    ("walk", "Five. Keep walkways at least ninety centimetres wide. That's the kitchen planners' minimum."),
    ("recap", "Screenshot this cheat sheet."),
    ("cta", "Follow Rimal Interiors for a new design rule every day."),
]
PROMPT = "\n\n".join(t for _, t in LINES)


def tokens(text):
    return [w for w in re.split(r"\s+", text.strip()) if w]


def clean(w):
    return re.sub(r"[^a-z0-9'-]", "", w.lower())


def estimate():
    t, out = 0.3, []
    for i, (sid, text) in enumerate(LINES):
        if sid == "recap":
            t += 0.6  # room for the silence before the hero
        for w in tokens(text):
            d = 0.16 + 0.045 * len(clean(w))
            out.append({"w": w, "t": round(t, 3), "end": round(t + d, 3)})
            t += d + (0.28 if w.endswith((".", ",")) else 0.04)
        t += 0.35
    return out


def main():
    real = len(sys.argv) > 1
    words = json.load(open(sys.argv[1])) if real else estimate()
    # Align script tokens to the word list in order (ASR may differ slightly; match by position).
    toks = [(sid, w) for sid, text in LINES for w in tokens(text)]
    if len(words) != len(toks):
        sys.exit(f"word count mismatch: script {len(toks)} vs timings {len(words)}")
    lines = {}
    for (sid, w), x in zip(toks, words):
        lines.setdefault(sid, []).append({"w": w, "t": x["t"], "end": x["end"]})

    def at(sid, key, which="t", n=0):
        hits = [x for x in lines[sid] if clean(x["w"]).startswith(key)]
        return round(hits[n][which], 3)

    dur = round(lines["cta"][-1]["end"] + 2.4, 2)
    s = {sid: round(lines[sid][0]["t"] - (0.12 if sid != "hook" else 0.3), 3) for sid, _ in LINES}
    s["hook"] = 0.0
    s["cta"] = s["recap"]  # the cheat sheet stays on screen under the CTA
    order = ["hook", "art", "coffee", "pendant", "dining", "walk", "recap"]
    ends = {sid: (s[order[i + 1]] if i + 1 < len(order) else dur) for i, sid in enumerate(order)}

    beats = {
        "hook": {"tape": 0.0, "save": at("hook", "save")},
        "art": {"cut": s["art"], "draw": at("art", "hang"), "count": at("art", "hundred"),
                "land": at("art", "centimetres", "end"), "rule": at("art", "fifty")},
        "coffee": {"cut": s["coffee"], "draw": at("coffee", "coffee"), "count": at("coffee", "forty"),
                   "land": at("coffee", "centimetres", "end"), "cup": at("coffee", "cup")},
        "pendant": {"cut": s["pendant"], "draw": at("pendant", "pendant"), "count": at("pendant", "seventy"),
                    "land": at("pendant", "centimetres", "end"), "table": at("pendant", "table")},
        "dining": {"cut": s["dining"], "draw": at("dining", "seat"), "count": at("dining", "sixty"),
                   "land": at("dining", "centimetres", "end")},
        "walk": {"cut": s["walk"], "draw": at("walk", "walkways"), "count": at("walk", "ninety"),
                 "land": at("walk", "wide", "end"), "source": at("walk", "kitchen")},
        "recap": {"cut": s["recap"], "hero": s["recap"] + 0.12, "follow": at("cta", "follow"),
                  "still": round(lines["cta"][-1]["end"] + 0.3, 3)},
    }
    scenes = []
    why = {
        "hook": "chapter cut on the spoken 'One'", "art": "chapter cut on 'Two'", "coffee": "chapter cut on 'Three'",
        "pendant": "chapter cut on 'Four'", "dining": "chapter cut on 'Five'",
        "walk": "the five rules collect into one cheat sheet (payoff)",
    }
    for sid in order:
        sc = {"id": sid, "start": s[sid], "end": ends[sid], "beats": beats[sid]}
        if sid in why:
            sc["transitionOut"] = {"type": "hard cut + colour flip" if sid != "walk" else "slam to cheat sheet", "why": why[sid]}
        scenes.append(sc)

    hero = beats["recap"]["hero"]
    last_vo_before = lines["walk"][-1]["end"]
    texts = [
        {"id": "hook", "text": "5 measurements", "from": 0.0, "to": s["art"] - 0.05, "role": "hook", "px": 112},
        {"id": "hook2", "text": "that make any room look designed", "from": 0.0, "to": s["art"] - 0.05, "role": None, "px": 58},
        {"id": "cta0", "text": "@rimalinterior", "from": 0.0, "to": s["art"] - 0.05, "role": "cta", "px": 50},
        {"id": "r1", "text": "145 cm", "from": beats["art"]["land"], "to": s["coffee"], "role": None, "px": 230},
        {"id": "rule", "text": "57-inch rule", "from": beats["art"]["rule"] + 0.25, "to": s["coffee"], "role": "term", "px": 64},
        {"id": "r2", "text": "40–50 cm", "from": beats["coffee"]["land"], "to": s["pendant"], "role": None, "px": 200},
        {"id": "r3", "text": "75–90 cm", "from": beats["pendant"]["land"], "to": s["dining"], "role": None, "px": 200},
        {"id": "r4", "text": "60 cm", "from": beats["dining"]["land"], "to": s["walk"], "role": None, "px": 230},
        {"id": "r5", "text": "90 cm", "from": beats["walk"]["land"], "to": s["recap"], "role": None, "px": 230},
        {"id": "walkway", "text": "walkway", "from": beats["walk"]["draw"] - 0.2, "to": s["recap"], "role": "term", "px": 72},
        {"id": "sheet", "text": "Cheat sheet", "from": hero + 0.6, "to": dur, "role": None, "px": 96},
        {"id": "cta1", "text": "@rimalinterior", "from": beats["recap"]["follow"] + 0.4, "to": dur, "role": "cta", "px": 56},
    ]
    vo = [{"id": sid, "text": text.replace("fifty-seven inch rule", "57-inch rule fifty-seven inch rule"),
           "from": lines[sid][0]["t"], "to": lines[sid][-1]["end"],
           "words": [{"w": x["w"], "t": x["t"]} for x in lines[sid]]} for sid, text in LINES]
    tl = {
        "meta": {"w": W, "h": H, "fps": FPS, "dur": dur, "clock": "voice", "register": "kinetic", "loop": False,
                 "grid": "none", "hookWaiver": None,
                 "vo": {"status": "RENDERED" if real else "ESTIMATED", "file": "audio/vo.mp3" if real else None}},
        "vo": vo,
        "scenes": scenes,
        "cuts": [s[x] for x in order[1:]],
        "hero": {"t": hero, "what": "all five rules slam into one cheat-sheet card"},
        "silences": [{"from": round(last_vo_before + 0.15, 3), "to": round(hero - 0.02, 3)}],
        "texts": texts,
        "terms": ["57-inch rule", "walkway"],
        "sfx": [
            {"at": f"{x}.cut", "offset": 0.0, "src": "whoosh-thud", "gain": 0.25, "why": "chapter slam"} for x in ["art", "coffee", "pendant", "dining", "walk"]
        ] + [{"at": "recap.hero", "offset": 0.0, "src": "big impact", "gain": 0.35, "why": "payoff, loudest non-voice"}],
        "facts": "FACTS.md",
    }
    json.dump(tl, open("timeline.json", "w"), indent=1, ensure_ascii=False)
    open("vo_prompt.txt", "w").write(PROMPT)
    print(f"timeline.json written, dur {dur} s, {'RENDERED' if real else 'ESTIMATED'} timings, silence {tl['silences']}")


if __name__ == "__main__":
    main()
