#!/usr/bin/env python3
"""Voice-led timeline for the Burj Khalifa iftar reel (Arabic).

Reads vo_words.json (ElevenLabs Scribe words: [{"text","start","end"}]) when present and maps
them onto the script; otherwise estimates timings (status ESTIMATED). Also reads vo_env.json
(mouth envelope per frame) when present. Writes timeline.json and timeline.js.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
FPS = 30

LINES = [
    ("hook", "تدري إن سكان برج خليفة… ما يفطرون كلهم بنفس الوقت؟"),
    ("f80", "اللي ساكن فوق الدور الثمانين، يأخّر فطوره دقيقتين."),
    ("f150", "وفوق الدور مية وخمسين؟ ثلاث دقايق!"),
    ("why", "ليش؟ كل ما ارتفعت، الأفق ينزل قدامك… فالشمس تظل طالعة لك، وهي غايبة عن الشارع."),
    ("twice", "يعني تقدر تشوف الغروب مرتين: مرة تحت… وتطلع بالمصعد في دقيقة، وتشوفه مرة ثانية!"),
    ("cta", "اكتب «أدوات» بالتعليقات… ونرسل لك رابط أدواتنا للمعماريين."),
]
# anchors: (name, line id, word as written in the script) -> time of that word's start
ANCHORS = [
    ("burj", "hook", "برج"), ("same", "hook", "بنفس"),
    ("f80", "f80", "الثمانين،"), ("two", "f80", "دقيقتين."),
    ("f150", "f150", "مية"), ("three", "f150", "ثلاث"),
    ("why", "why", "ليش؟"), ("horizon", "why", "الأفق"), ("street", "why", "الشارع."),
    ("twice", "twice", "مرتين:"), ("below", "twice", "تحت…"), ("lift", "twice", "بالمصعد"),
    ("again", "twice", "ثانية!"), ("type", "cta", "«أدوات»"), ("tools", "cta", "أدواتنا"),
]

def norm(w):
    w = re.sub(r"[^؀-ۿ]", "", w)
    return w.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي").replace("ّ", "")

words = []  # script words with times
vo_path = HERE / "vo_words.json"
if vo_path.exists():
    stt = [w for w in json.loads(vo_path.read_text()) if norm(w["text"])]
    status = "RENDERED"
    j = 0
    for lid, text in LINES:
        for w in text.split():
            # find the next STT word matching this script word (fuzzy), else interpolate later
            best = None
            for k in range(j, min(j + 6, len(stt))):
                a, b = norm(stt[k]["text"]), norm(w)
                if a and b and (a == b or a in b or b in a or a[:3] == b[:3]):
                    best = k
                    break
            if best is not None:
                words.append({"w": w, "line": lid, "t": stt[best]["start"], "end": stt[best]["end"]})
                j = best + 1
            else:
                words.append({"w": w, "line": lid, "t": None, "end": None})
    # interpolate missing
    for i, w in enumerate(words):
        if w["t"] is None:
            prev = next((words[k] for k in range(i - 1, -1, -1) if words[k]["t"] is not None), None)
            nxt = next((words[k] for k in range(i + 1, len(words)) if words[k]["t"] is not None), None)
            a = prev["end"] if prev else 0.0
            b = nxt["t"] if nxt else a + 0.4
            w["t"], w["end"] = a + 0.02, max(a + 0.05, b - 0.02)
    dur = round(words[-1]["end"] + 1.6, 3)
else:
    status = "ESTIMATED"
    t = 0.25
    for lid, text in LINES:
        for w in text.split():
            d = 0.16 + 0.055 * len(norm(w))
            words.append({"w": w, "line": lid, "t": round(t, 3), "end": round(t + d, 3)})
            t += d + 0.04
            if w.endswith(("…", "؟", "!", ".", "،", ":")):
                t += 0.28
        t += 0.35
    dur = round(t + 1.2, 3)

lines = []
for lid, text in LINES:
    ws = [w for w in words if w["line"] == lid]
    lines.append({"id": lid, "text": text, "from": ws[0]["t"], "to": ws[-1]["end"], "words": [{"w": w["w"], "t": w["t"], "end": w["end"]} for w in ws]})

anchors = {}
for name, lid, word in ANCHORS:
    ws = [w for w in words if w["line"] == lid and w["w"] == word]
    anchors[name] = ws[0]["t"]
for l in lines:
    anchors[l["id"] + ".from"] = l["from"]
    anchors[l["id"] + ".to"] = l["to"]

# captions: chunks of up to 3 words, broken at punctuation
caps = []
for l in lines:
    chunk = []
    for i, w in enumerate(l["words"]):
        chunk.append(w)
        last = i == len(l["words"]) - 1
        if len(chunk) == 3 or w["w"].endswith(("…", "؟", "!", ".", "،", ":")) or last:
            nxt = l["words"][i + 1]["t"] if not last else w["end"] + 0.35
            caps.append({"from": chunk[0]["t"], "to": nxt, "words": chunk})
            chunk = []

env = json.loads((HERE / "vo_env.json").read_text()) if (HERE / "vo_env.json").exists() else None

TL = {
    "meta": {"w": 1080, "h": 1920, "fps": FPS, "dur": dur, "clock": "voice", "register": "kinetic",
             "vo": {"status": status, "file": "vo.mp3" if status == "RENDERED" else None}},
    "lines": lines, "anchors": anchors, "captions": caps, "env": env,
}
(HERE / "timeline.json").write_text(json.dumps(TL, ensure_ascii=False, indent=1))
(HERE / "timeline.js").write_text("window.TL = " + json.dumps(TL, ensure_ascii=False) + ";\n")
print(f"{status}: dur={dur}s, {len(words)} words, {len(caps)} caption chunks")
for k, v in anchors.items():
    if "." not in k:
        print(f"  {k:8s} {v:6.2f}")
