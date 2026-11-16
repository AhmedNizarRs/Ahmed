#!/usr/bin/env python3
"""Synthesize the score and SFX from timeline.en.json (same grid for both languages).
D Hijaz plucks (Karplus-Strong, oud-like), a low drone, soft pulse, risers and one big hit
on the hero. Writes score_raw.wav (48 kHz stereo); loudness is normalised later with ffmpeg."""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
TL = json.loads((HERE / "timeline.en.json").read_text())
B, DUR = TL["beats"], TL["meta"]["dur"]
SR = 48000
BEAT = 60 / TL["meta"]["bpm"]
N = int((DUR + 1.5) * SR)
mixL = np.zeros(N); mixR = np.zeros(N)
rng = np.random.default_rng(7)

def place(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    sig = sig[: N - i] * gain
    mixL[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    mixR[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))

def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def pluck(freq, dur=1.6, bright=0.5):
    n = int(dur * SR); p = int(SR / freq)
    buf = rng.uniform(-1, 1, p)
    out = np.zeros(n)
    # vectorised KS: process in blocks of one period
    prev = buf.copy()
    for k in range(0, n, p):
        m = min(p, n - k)
        out[k:k + m] = prev[:m]
        nxt = 0.5 * (prev + np.roll(prev, -1)) * (0.996 - 0.004 * (1 - bright))
        prev = nxt
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    return out / (np.abs(out).max() + 1e-9)

def sine(freq, dur, d=0.5, a=0.01):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * env(n, a, d)

def bell(freq, dur=2.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(w * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (dur * 0.35 / r ** 0.5))
            for r, w in [(1, 1), (2.76, 0.4), (5.4, 0.2), (8.93, 0.08)])
    return s * np.minimum(1, t / 0.003)

def noise(dur, d=0.2, lp=None, hp=None, a=0.005):
    n = int(dur * SR); x = rng.standard_normal(n)
    if lp:
        k = int(SR / lp); x = np.convolve(x, np.ones(k) / k, "same")
    if hp:
        k = int(SR / hp); x = x - np.convolve(x, np.ones(k) / k, "same")
    return x * env(n, a, d)

def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 52 + 70 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)

def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 200 * (8 ** (t / dur))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + noise(dur, d=99, hp=900, a=dur) * 0.0
    nz = rng.standard_normal(n); k = 24; nz = nz - np.convolve(nz, np.ones(k) / k, "same")
    return (s + nz * 0.25) * (t / dur) ** 2

def whoosh(dur=0.7, rev=False):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n); k = 18; nz = np.convolve(nz, np.ones(k) / k, "same")
    e = np.sin(np.pi * t / dur) ** 2
    return nz * e

# D Hijaz: D Eb F# G A Bb C
HZ = {"D3": 146.83, "Eb3": 155.56, "F#3": 185.0, "G3": 196.0, "A3": 220.0, "Bb3": 233.08, "C4": 261.63,
      "D4": 293.66, "Eb4": 311.13, "F#4": 369.99, "G4": 392.0, "A4": 440.0, "Bb4": 466.16, "D5": 587.33,
      "A2": 110.0, "D2": 73.42, "F#5": 739.99, "A5": 880.0}

def silent(t):
    s = TL["silences"][0]
    return s["from"] - 0.05 <= t < s["to"]

# ---- drone (off in the silence, swells after the hero) ----
t = np.arange(N) / SR
drone = (np.sin(2 * np.pi * HZ["D2"] * t) * 0.5 + np.sin(2 * np.pi * HZ["A2"] * t) * 0.3
         + np.sin(2 * np.pi * HZ["D3"] * t) * 0.12) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t))
g = np.interp(t, [0, 0.3, B["room.start"], B["room.silence"] - 0.1, B["room.silence"], B["hero"], B["hero"] + 0.05,
                  B["cta.start"], DUR - 1.5, DUR + 0.5],
                 [0.0, 0.10, 0.12, 0.05, 0.0, 0.0, 0.16, 0.13, 0.10, 0.0])
mixL += drone * g; mixR += drone * g

# ---- ostinato: 8th-note plucks ----
pat = ["D4", "A3", "Eb4", "D4", "F#4", "D4", "G4", "F#4", "D4", "A3", "Eb4", "D4", "C4", "Bb3", "A3", "F#3"]
cache = {}
def P(name, dur=1.4):
    key = (name, dur)
    if key not in cache: cache[key] = pluck(HZ[name], dur)
    return cache[key]

step = BEAT / 2
k = 0
tt = 0.0
while tt < DUR - 0.3:
    note = pat[k % len(pat)]
    dense = (tt < B["room.start"]) or (tt >= B["cta.start"])
    sparse_ok = B["hero"] + 0.6 <= tt < B["cta.start"] and k % 4 == 0
    if (dense or sparse_ok) and not silent(tt) and not (B["room.start"] <= tt < B["hero"]):
        gain = 0.16 if k % 2 else 0.22
        if tt < 1.0: gain *= tt  # fade the first notes in over 1 s
        if tt >= DUR - 2.5: gain *= max(0, (DUR - 0.3 - tt) / 2.2)
        place(P(note), tt, gain, pan=0.25 if k % 2 else -0.25)
    k += 1; tt = k * step

# ---- pulse: soft kick on beats from the star close-up through chapter 3 ----
for i in range(int(B["star.start"] / BEAT), int(B["room.start"] / BEAT)):
    place(kick(), i * BEAT, 0.32)
for i in range(int(B["cta.start"] / BEAT), int((DUR - 1.25) / BEAT)):
    place(kick(), i * BEAT, 0.26)
# shaker on 8ths in the grid + angle chapters
for i in range(int(B["grid.start"] / step), int(B["room.start"] / step)):
    place(noise(0.08, d=0.03, hp=5000), i * step, 0.05 if i % 2 else 0.08, pan=0.3)

# ---- accents ----
place(bell(HZ["A4"], 2.0), 1.875, 0.10, pan=0.2)                     # "is just two squares" lands
place(kick(), 1.875, 0.35)
place(noise(0.05, d=0.02, hp=3000), B["star.dropB"], 0.10)            # square drops away
place(bell(HZ["D5"], 1.5), B["star.copy"], 0.08, pan=-0.3)            # copy
place(whoosh(0.8), B["star.turn"], 0.10)                              # the turn
for off in [0, 0.16, 0.3, 0.42, 0.52, 0.6, 0.67, 0.73]:               # eight tips
    place(noise(0.03, d=0.012, hp=4000), B["star.tips"] + off, 0.18, pan=rng.uniform(-0.5, 0.5))
place(bell(HZ["F#5"], 2.4), 8.44, 0.10)                               # the name
# stamps: one pluck per ring, rising
rings = ["D4", "Eb4", "F#4", "G4", "A4", "Bb4", "D5", "D5", "D5", "D5"]
for r in range(1, 11):
    ts = B["grid.start"] + 0.12 + 2.1 * (1 - 0.74 ** r)
    place(P(rings[r - 1], 1.0), ts, 0.2 * (0.92 ** r), pan=(-1) ** r * 0.3)
# crosses: chord swell
for nme in ["D3", "A3", "F#4", "D4"]:
    place(pluck(HZ[nme], 2.4), B["grid.cross"], 0.16)
place(bell(HZ["A5"], 1.6), B["grid.term"], 0.06)
# angle morph riser, lands on "New pattern."
place(riser(B["angle.morphEnd"] - B["angle.morph"]), B["angle.morph"], 0.12)
place(kick(), B["angle.new"], 0.18); place(bell(HZ["D5"], 1.8), B["angle.new"], 0.05)
# into the window
place(whoosh(1.1), B["room.start"] - 0.2, 0.14)
# ---- HERO: the loudest moment, after real silence ----
hero = B["hero"]
n = int(2.4 * SR); th = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-th / 0.08)) / SR) * np.exp(-th / 0.9)
place(boom, hero, 0.95)
place(noise(1.6, d=0.35, lp=2500, a=0.002), hero, 0.35)
for nme, gg in [("D5", 0.22), ("A5", 0.14), ("F#5", 0.12)]:
    place(bell(HZ[nme], 4.0), hero, gg)
for nme in ["D3", "A3", "D4", "F#4"]:
    place(pluck(HZ[nme], 3.0), hero, 0.2)
# CTA
place(kick(), B["cta.start"], 0.25); place(bell(HZ["D5"], 2.5), B["cta.start"], 0.12)
place(bell(HZ["A4"], 2.0), B["cta.free"], 0.08)
for nme in ["D3", "A3", "D4", "F#4", "A4"]:
    place(pluck(HZ[nme], 3.0), DUR - 2.5, 0.14)

# hard-mute the designed silence, with tiny fades
s0, s1 = TL["silences"][0]["from"], TL["silences"][0]["to"]
i0, i1 = int(s0 * SR), int(s1 * SR); f = int(0.04 * SR)
ramp = np.ones(N); ramp[i0:i1] = 0; ramp[i0 - f:i0] = np.linspace(1, 0, f)
mixL *= ramp; mixR *= ramp
# re-place the hero after muting (it starts exactly at s1)
stereo = np.stack([mixL, mixR], 1)
stereo = stereo[: int((DUR + 0.0) * SR)]
fade = int(0.6 * SR); stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
stereo /= np.abs(stereo).max() / 0.89

import wave
pcm = (stereo * 32767).astype(np.int16)
with wave.open(str(HERE / "score_raw.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("score_raw.wav", stereo.shape[0] / SR, "s")
