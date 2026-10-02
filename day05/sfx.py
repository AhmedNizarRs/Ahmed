"""Synthesize sfx.wav for Day 05 — sound effects only, no music, no voice.

Every cue below is aligned to the exact time of its visual event in index.html.
"""
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 39.6
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(5)


def bp(x, lo, hi, order=4):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def add(t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    j = min(N, i + len(sig))
    if i >= N:
        return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan))
    R[i:j] += s * np.sqrt(0.5 * (1 + pan))


def env(n, a=0.003, d=0.1):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


# ---------- sound palette ----------
def pencil(dur):
    n = int(dur * SR)
    x = bp(rng.standard_normal(n), 1800, 6500)
    t = np.arange(n) / SR
    strokes = 0.5 + 0.5 * np.sin(2 * np.pi * 7.3 * t + 2 * np.sin(2 * np.pi * 1.1 * t))   # scratchy AM
    grit = (rng.random(n) > 0.997).astype(float)
    grit = np.convolve(grit, np.exp(-np.arange(200) / 30), "same")
    fade = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.08)
    return (x * strokes * 0.6 + bp(grit * rng.standard_normal(n), 2500, 8000) * 0.8) * fade


def pop(f=880):
    t = tvec(0.07)
    fr = f * (1 + 0.6 * np.exp(-t / 0.01))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.002, 0.02)


def whoosh(dur=0.38, up=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    t = np.arange(n) / SR
    out = np.zeros(n)
    seg = 512
    for k in range(0, n, seg):        # moving band-pass sweep
        c = (600 + 3400 * (k / n)) if up else (4000 - 3400 * (k / n))
        out[k:k + seg] = bp(x[max(0, k - 2048):k + seg], c * 0.6, c * 1.4, 2)[-len(out[k:k + seg]):]
    return out * np.sin(np.pi * t / dur) ** 2


def thump():
    t = tvec(0.5)
    body = np.sin(2 * np.pi * (55 + 40 * np.exp(-t / 0.03)) * t) * env(len(t), 0.002, 0.16)
    click = bp(rng.standard_normal(len(t)), 1000, 5000) * env(len(t), 0.001, 0.012)
    return body * 1.0 + click * 0.5


def impact():
    t = tvec(0.6)
    return lp(rng.standard_normal(len(t)), 900) * env(len(t), 0.002, 0.09) * 1.4


def buzz():
    t = tvec(0.28)
    sq = np.sign(np.sin(2 * np.pi * 116 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 123 * t)) * 0.5
    return lp(sq, 1800) * np.minimum(1, t / 0.01) * np.minimum(1, (0.28 - t) / 0.04) * 0.55


def bonk():
    t = tvec(0.25)
    f = 220 * np.exp(-t / 0.12) + 110
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.07)
    knock = bp(rng.standard_normal(len(t)), 300, 2200) * env(len(t), 0.0005, 0.01)
    return tone + knock * 0.6


def chime(notes=(1318.5, 1661.2, 1975.5), gap=0.07):
    out = np.zeros(int((gap * len(notes) + 0.6) * SR))
    for k, f in enumerate(notes):
        t = tvec(0.55)
        s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * env(len(t), 0.002, 0.13)
        i = int(k * gap * SR)
        out[i:i + len(s)] += s * (0.8 + 0.1 * k)
    return out


def tick(f=2600):
    t = tvec(0.025)
    return np.sin(2 * np.pi * f * t) * env(len(t), 0.0005, 0.004)


def key():
    t = tvec(0.04)
    return hp(rng.standard_normal(len(t)), 2500) * env(len(t), 0.0005, 0.006) + np.sin(2 * np.pi * 180 * t) * env(len(t), 0.001, 0.008) * 0.6


def swipe():
    t = tvec(0.22)
    return hp(rng.standard_normal(len(t)), 3000) * np.sin(np.pi * t / 0.22) ** 2 * 0.8


# ---------- cue sheet (seconds) — mirrors index.html ----------
CUES = []
def cue(t, name, sig, gain=1.0, pan=0.0):
    CUES.append((round(t, 3), name))
    add(t, sig, gain, pan)

# HOOK: plan draws itself (walls 0.1–1.1, door 0.9, toilet 1.2–1.9, vanity 1.5–2.1, shower 1.8–2.4)
cue(0.10, "pencil walls", pencil(1.0), 0.32, -0.2)
cue(1.20, "pencil fixtures", pencil(1.25), 0.26, 0.2)
cue(0.50, "title thump", thump(), 0.85)
cue(0.52, "title impact", impact(), 0.45)
cue(1.30, "subtitle pop", pop(760), 0.35)
# MISTAKE 1
cue(3.45, "whoosh scene 1", whoosh(), 0.3)
cue(3.60, "chip pop", pop(980), 0.4)
cue(3.80, "heading pop", pop(820), 0.3)
cue(4.60, "dim pop", pop(700), 0.3)
cue(5.20, "body circle pop", pop(620), 0.3)
cue(5.60, "WRONG buzz", buzz(), 0.55)
cue(5.60, "WRONG bonk", bonk(), 0.7)
for k in range(10):                     # count-up 30 -> 40 cm
    cue(7.0 + k * 0.08, "tick", tick(2400 + 60 * k), 0.35, 0.3)
cue(8.00, "clearance pop", pop(700), 0.3)
cue(8.60, "RIGHT chime", chime(), 0.45)
cue(8.80, "line pop", pop(900), 0.22)
cue(9.40, "line pop", pop(900), 0.22)
# MISTAKE 2
cue(11.25, "whoosh scene 2", whoosh(), 0.3)
cue(11.40, "chip pop", pop(980), 0.4)
cue(11.60, "heading pop", pop(820), 0.3)
cue(12.20, "door swing", whoosh(0.65, up=False), 0.22, -0.3)
cue(12.90, "WRONG bonk", bonk(), 0.75)
cue(12.92, "WRONG buzz", buzz(), 0.5)
cue(13.60, "line pop", pop(900), 0.22)
cue(14.90, "door swing out", whoosh(0.6), 0.18, -0.3)
cue(15.60, "RIGHT chime", chime(), 0.45)
cue(16.20, "line pop", pop(900), 0.22)
# MISTAKE 3
cue(19.05, "whoosh scene 3", whoosh(), 0.3)
cue(19.20, "chip pop", pop(980), 0.4)
cue(19.40, "heading pop", pop(820), 0.3)
cue(20.20, "label pop", pop(700), 0.3)
cue(20.80, "body circle pop", pop(620), 0.3)
cue(21.40, "WRONG buzz", buzz(), 0.55)
cue(21.40, "WRONG bonk", bonk(), 0.7)
for k in range(20):                     # count-up 70 -> 90 cm
    cue(22.8 + k * 0.05, "tick", tick(2200 + 40 * k), 0.3, -0.3)
cue(24.00, "RIGHT chime", chime(), 0.45)
cue(24.20, "line pop", pop(900), 0.22)
cue(24.80, "line pop", pop(900), 0.22)
# RECAP
cue(26.85, "whoosh recap", whoosh(), 0.3)
cue(27.00, "panel pop", pop(700), 0.3)
cue(27.30, "check pop 1", pop(1046), 0.45)
cue(27.90, "check pop 2", pop(1174), 0.45)
cue(28.50, "check pop 3", pop(1318), 0.45)
cue(29.10, "line pop", pop(880), 0.25)
# CTA
cue(30.05, "whoosh cta", whoosh(), 0.3)
cue(30.30, "bookmark pop", pop(1046), 0.45)
cue(30.50, "line pop", pop(880), 0.22)
cue(31.20, "line pop", pop(880), 0.22)
cue(31.90, "keyword pop", pop(1174), 0.4)
cue(32.40, "box pop", pop(700), 0.25)
for k, tk in enumerate([32.7, 32.9, 33.1, 33.3]):
    cue(tk, "key click", key(), 0.5, 0.15)
cue(33.60, "send swipe", swipe(), 0.4)
cue(33.90, "bubble chime", chime((1568.0, 2093.0), 0.06), 0.3)
cue(34.50, "bubble chime", chime((1318.5, 1760.0), 0.06), 0.3)
# END CARD
cue(35.45, "whoosh end", whoosh(0.5), 0.3)
cue(35.70, "logo impact", impact(), 0.25)
cue(35.70, "logo chime", chime((1046.5, 1568.0), 0.09), 0.25)
cue(36.60, "made-by pop", pop(820), 0.2)
cue(37.30, "follow pop", pop(820), 0.2)

# ---------- small reverb tail, soft limiter, fade-out ----------
ir_t = np.arange(int(0.45 * SR)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.11)
ir = lp(ir, 5000)
ir /= np.abs(ir).sum() / 6
for ch in (L, R):
    wet = np.convolve(ch, ir)[:N]
    ch += 0.12 * wet
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade_n = int(1.2 * SR)
mix[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None]
peak = np.abs(mix).max()
mix *= 0.8 / peak if peak > 0.8 else 1.0
wavfile.write("sfx.wav", SR, (mix * 32767).astype(np.int16))

# ---------- verification: no sustained musical content ----------
win = int(0.05 * SR)
rms = np.sqrt(np.convolve((mix ** 2).mean(1), np.ones(win) / win, "same"))
active = rms > 0.02
longest, run = 0, 0
for a in active[::win]:
    run = run + 1 if a else 0
    longest = max(longest, run)
print(f"cues={len(CUES)} peak={np.abs(mix).max():.3f} longest_continuous_sound={longest * 0.05:.2f}s")
with open("cues.txt", "w") as f:
    f.writelines(f"{t:7.3f}  {name}\n" for t, name in sorted(CUES))
