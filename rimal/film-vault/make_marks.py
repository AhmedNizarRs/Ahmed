#!/usr/bin/env python3
"""Build vo/marks.json from the ASR word times of the continuous ElevenLabs take.
Line boundaries are the whisper word boundaries, nudged to the quietest 20 ms within +-0.10 s so no phoneme is clipped.
Cue offsets (the moment a counter should stop, a tool name is spoken...) come from the word times too."""
import json, os, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 16000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "vo/raw.mp3"), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32); END = len(x) / SR
W = 0.02; n = int(W * SR)
def quiet(t):
    best, bt = 9, t
    for c in np.arange(max(0.05, t - 0.10), min(END - 0.05, t + 0.10), 0.005):
        i = int(c * SR); r = np.sqrt(np.mean(x[i:i + n] ** 2))
        if r < best: best, bt = r, c
    return round(float(bt), 3)
# first-word start of each line, and the word times used for cues (from `cut_vo.py words` on this take)
START = {"L1": 0.00, "L2": 3.58, "L3": 5.20, "L4": 7.56, "L5": 10.20, "L6": 14.64, "L7": 19.76, "L8": 22.64, "L9": 25.72, "L10": 27.68, "L11": 32.02, "L12": 35.86, "L13": 38.00, "L14": 39.72, "L15": 41.58}
CUES = {"L1": {"mo": 2.24}, "L4": {"hizma": 8.04}, "L5": {"lib": 11.62, "num": 13.88}, "L6": {"num": 16.72, "control": 17.56}, "L7": {"num": 21.70}, "L8": {"num": 24.60},
        "L9": {"kitchen": 26.52}, "L10": {"scripts": 28.82, "windows": 29.94, "doors": 30.62, "kitchens": 31.30}, "L11": {"num": 34.88}, "L14": {"faqat": 41.16}, "L15": {"hizma": 42.44, "send": 43.58}}
ids = list(START); cuts = [0.0] + [quiet(START[i]) for i in ids[1:]] + [round(END, 3)]
marks = [{"id": i, "s": cuts[k], "e": cuts[k + 1], "cues": CUES.get(i, {})} for k, i in enumerate(ids)]
json.dump(marks, open(os.path.join(HERE, "vo/marks.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for m in marks: print(m["id"], m["s"], m["e"], round(m["e"] - m["s"], 2))
