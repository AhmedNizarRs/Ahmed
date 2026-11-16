#!/usr/bin/env python3
"""Sound effects only (no music), placed from timeline.json anchors. Writes sfx.wav (48 kHz stereo)."""
import json, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent
TL = json.loads((HERE / "timeline.json").read_text())
A, DUR, SR = TL["anchors"], TL["meta"]["dur"], 48000
N = int((DUR + 1) * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)

def place(sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N: return
    sig = sig[: N - i] * g
    L[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan)); R[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, k): return np.convolve(x, np.ones(k) / k, "same")
def whoosh(d=0.45, up=True):
    t = tt(d); n = rng.standard_normal(len(t)); e = np.sin(np.pi * t / d) ** 2
    lo = lp(n, 6); hi = n - lp(n, 40)
    m = t / d if up else 1 - t / d
    return (lo * (1 - m) + hi * m * 0.6) * e
def ding(f=1320, d=0.9):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.01 * t) + 0.2 * np.sin(2 * np.pi * f * 3 * t)) * np.exp(-t / 0.22) * np.minimum(1, t / 0.002)
def pop(f=520):
    t = tt(0.12); fr = f * (1 + 2 * np.exp(-t / 0.01)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.035)
def tick():
    t = tt(0.03); return (rng.standard_normal(len(t)) - lp(rng.standard_normal(len(t)), 8)) * np.exp(-t / 0.006)
def shimmer(d=1.0):
    t = tt(d); s = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / (0.25 + 0.1 * k)) for k, f in enumerate([1760, 2217, 2637, 3520]))
    return s * np.minimum(1, t / 0.01) * 0.4
def boing():
    t = tt(0.5); f = 180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.2); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
def thump():
    t = tt(0.35); f = 45 + 80 * np.exp(-t / 0.03); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
def riser(d):
    t = tt(d); f = 90 * 4 ** (t / d); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    n = rng.standard_normal(len(t)); n = n - lp(n, 30)
    return (s + n * 0.15) * (t / d) ** 1.5
def whir(d):
    t = tt(d); f = 110 + 330 * (t / d); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.12
    n = lp(rng.standard_normal(len(t)), 10) * 0.25
    e = np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.1)
    return (s + n) * e

shots = [A["f80.from"] - 0.1, A["three"] - 0.05, A["why.from"] - 0.1, A["twice.from"] - 0.1, A["lift"] - 0.15, A["cta.from"] - 0.1]
place(whoosh(0.5), 0.0, 0.25)
for t in shots: place(whoosh(0.4), t - 0.2, 0.35, pan=0.2)
for t in [A["burj"] - 0.2, A["burj"] + 0.55, A["same"] + 0.05]: place(ding(), t, 0.22)
place(shimmer(), A["f80"], 0.25); place(shimmer(), A["f150"], 0.25)
place(pop(600), A["two"] - 0.1, 0.4); place(pop(700), A["three"] - 0.4, 0.4)
place(thump(), A["three"], 0.7); place(boing(), A["three"] + 0.05, 0.3)
place(riser(A["street"] - A["why"]), A["why"], 0.18)
place(pop(500), A["horizon"] - 0.1, 0.35)
place(whoosh(0.8, up=False), A["below"], 0.25)
d = A["again"] - A["lift"]; place(whir(d), A["lift"], 0.3)
for k in range(12): place(tick(), A["lift"] + 0.1 + d * (k / 12) ** 0.8, 0.25)
place(ding(988, 1.4), A["again"], 0.3); place(ding(1318, 1.4), A["again"] + 0.12, 0.25); place(shimmer(1.2), A["again"], 0.3)
place(pop(450), A["cta.from"], 0.35)
for k in range(5): place(tick(), A["type"] + k * 0.1, 0.4)
place(pop(800), A["cta.from"] + 0.4, 0.3)
place(pop(650), A["type"] + 0.55, 0.3)

st = np.stack([L, R], 1)[: int(DUR * SR)]
st /= max(1e-9, np.abs(st).max()) / 0.7
with wave.open(str(HERE / "sfx.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print("sfx.wav", DUR)
