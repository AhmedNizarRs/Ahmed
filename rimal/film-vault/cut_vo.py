#!/usr/bin/env python3
"""Turn the ElevenLabs take into per-line clips with measured durations and word cues.

1) python3 cut_vo.py words vo/raw.mp3        -> prints every recognised word with its time and the pauses (needs faster-whisper)
2) write vo/marks.json: [{"id": "L1", "s": 0.00, "e": 3.10, "cues": {"mo": 2.05}}, ...]  (times in the raw take)
3) python3 cut_vo.py cut vo/raw.mp3          -> vo/L*.wav (trimmed, 12 ms fades) + vo/lines.json, which build_timeline.py picks up
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode, src = sys.argv[1], sys.argv[2]
if mode == "words":
    import numpy as np
    from faster_whisper import WhisperModel
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    segs, _ = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "medium", device="cpu", compute_type="int8").transcribe(
        np.frombuffer(raw, dtype=np.float32), language="ar", word_timestamps=True, beam_size=5)
    prev = 0.0
    for s in segs:
        for w in s.words:
            gap = w.start - prev
            print(f"{w.start:7.2f} {w.end:7.2f}  {'|| pause %.2f' % gap if gap > 0.18 else '':16s} {w.word}")
            prev = w.end
elif mode == "cut":
    marks = json.load(open(os.path.join(HERE, "vo", "marks.json"), encoding="utf-8"))
    lines = []
    for m in marks:
        out = os.path.join("vo", m["id"] + ".wav"); d = m["e"] - m["s"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{m['s']:.3f}", "-t", f"{d:.3f}", "-i", src, "-ac", "1", "-ar", "48000",
                        "-af", f"afade=t=in:d=0.012,afade=t=out:st={d - 0.03:.3f}:d=0.03", os.path.join(HERE, out)], check=True)
        lines.append({"id": m["id"], "file": out, "dur": round(d, 3), "cues": {k: round(v - m["s"], 3) for k, v in m.get("cues", {}).items()}})
    json.dump(lines, open(os.path.join(HERE, "vo", "lines.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("vo/lines.json:", len(lines), "lines,", round(sum(l["dur"] for l in lines), 2), "s of speech")
