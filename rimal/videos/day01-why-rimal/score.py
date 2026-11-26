#!/usr/bin/env python3
"""Synthesize the Day 1 score from timeline.json (80 BPM, D Hijaz) plus the picture's grain-speed envelope.

Usage: python3 score.py timeline.json out/env.json out/score.wav [--no-music]
Layers: pad chords, Karplus-Strong plucks (oud-like), frame drum, sand pour/sweep driven by grain
speed, wood ticks on each stamped block, riser into a hard-stop silence, payoff impact.
--no-music keeps only the material sounds (sand, ticks, impact) for a music-free version.
Deterministic: fixed seeds, no randomness at play time.
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
args = [a for a in sys.argv[1:] if not a.startswith("--")]
NO_MUSIC = "--no-music" in sys.argv
TL = json.load(open(args[0]))
ENV = json.load(open(args[1]))
OUT = args[2]

DUR = TL["meta"]["dur"]
BPM = TL["meta"]["bpm"]
BEAT = 60.0 / BPM
N = int(DUR * SR)
B = {f"{s['id']}.{k}": v for s in TL["scenes"] for k, v in s.get("beats", {}).items()}
SIL0, SIL1 = TL["silences"][0]["from"], TL["silences"][0]["to"]
HERO = TL["hero"]["t"]
rng = np.random.default_rng(3)

L = np.zeros(N)
Rt = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    sig = sig[: N - i0] if i0 >= 0 else sig[-i0:]
    i0 = max(0, i0)
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + len(sig)] += sig * gain * lg * np.sqrt(2)
    Rt[i0:i0 + len(sig)] += sig * gain * rg * np.sqrt(2)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hz(name):
    names = {"C": -9, "C#": -8, "D": -7, "Eb": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "Ab": -1, "A": 0, "Bb": 1, "B": 2}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o - 4)) / 12)


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def fade_in(x, ms=25):
    n = min(len(x), int(ms * SR / 1000))
    x[:n] *= np.linspace(0, 1, n)
    return x


# ---------- instruments ----------
def pluck(f, dur=1.8, bright=0.5, seed=0):
    """Karplus-Strong with a slightly damped loop: a nylon/oud-like pluck."""
    n = int(dur * SR)
    p = int(SR / f)
    r = np.random.default_rng(seed)
    buf = lp(r.uniform(-1, 1, p), 2500 + 4000 * bright, 1)
    out = np.zeros(n)
    loss = 0.996
    for i in range(n):
        j = i % p
        out[i] = buf[j]
        buf[j] = loss * 0.5 * (buf[j] + buf[(j + 1) % p])
    env = np.minimum(1, np.arange(n) / (0.003 * SR)) * np.exp(-np.arange(n) / (SR * dur * 0.45))
    return fade_in(norm(out) * env, 2)


def pad(freqs, dur, attack=1.2, release=1.0):
    t = np.arange(int(dur * SR)) / SR
    x = np.zeros_like(t)
    for k, f in enumerate(freqs):
        for d in (-0.15, 0.0, 0.17):
            ph = rng.uniform(0, 2 * np.pi)
            x += np.sin(2 * np.pi * (f + d) * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * (f + d) * t + ph) + 0.08 * np.sin(2 * np.pi * 3 * (f + d) * t)
    x *= 1 + 0.08 * np.sin(2 * np.pi * 0.21 * t)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)
    return norm(lp(x, 1800)) * np.clip(env, 0, 1)


def dum(dur=0.6):
    t = np.arange(int(dur * SR)) / SR
    f = 55 + 65 * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    click = bp(rng.uniform(-1, 1, len(t)), 800, 3000) * np.exp(-t / 0.006) * 0.4
    return fade_in(norm(x + click), 1)


def tek(dur=0.12):
    t = np.arange(int(dur * SR)) / SR
    x = bp(rng.uniform(-1, 1, len(t)), 2500, 7000) * np.exp(-t / 0.025) + 0.3 * np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.015)
    return fade_in(norm(x), 1)


def tick(variant):
    dur = 0.12
    t = np.arange(int(dur * SR)) / SR
    f, nb = (1180, (1800, 3600)) if variant == 0 else (930, (2400, 5200))
    x = 0.8 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018) + bp(rng.uniform(-1, 1, len(t)), *nb) * np.exp(-t / 0.008)
    return fade_in(norm(x), 1)


def noise_bed(env_per_frame, lo, hi, fps=30):
    e = np.interp(np.arange(N) / SR, np.arange(len(env_per_frame)) / fps, env_per_frame)
    e = lp(e, 12, 1)
    x = bp(rng.uniform(-1, 1, N), lo, hi, 2)
    return x * np.clip(e, 0, None)


# ---------- score ----------
beat = lambda n: n * BEAT  # bar b, beat k -> beat(4*b + k)

if not NO_MUSIC:
    # Pad chords: D5 -> Gm -> Eb (the Hijaz bII, tension) -> hard stop -> D major resolution.
    add(pad([hz("D2"), hz("A2"), hz("D3")], beat(16) + 0.6, attack=1.5), 0.0, 0.16)
    add(pad([hz("G2"), hz("D3"), hz("Bb3")], beat(4) + 0.6), beat(16), 0.15)
    add(pad([hz("Eb2"), hz("Bb2"), hz("G3")], SIL0 - beat(20), attack=0.8, release=0.02), beat(20), 0.17)
    add(pad([hz("D2"), hz("A2"), hz("D3"), hz("F#3")], DUR - HERO, attack=0.05, release=2.5), HERO, 0.20)

    # Plucked melody in D Hijaz (beat index, note, gain).
    melody = [
        (0, "D4", .5), (2, "A3", .4), (3, "Eb4", .42), (4, "F#4", .45), (6, "Eb4", .4), (7, "D4", .38),
        (8, "D4", .32), (11, "A3", .28), (12, "G3", .3), (14, "A3", .28),
        (16, "G4", .4), (18, "Bb4", .42), (19, "A4", .4),
        (20, "G4", .38), (22, "F#4", .36), (24, "Eb4", .38), (25, "D4", .36), (26, "Eb4", .34), (26.5, "F#4", .34),
        (29, "F#4", .4), (30, "A4", .42), (31, "D5", .46),
        (33, "A4", .36), (34, "F#4", .34), (35, "Eb4", .3), (36, "D4", .44),
    ]
    for i, (b, n, g) in enumerate(melody):
        dur = 2.6 if b >= 36 else 1.6
        add(pluck(hz(n), dur, 0.55, seed=i), beat(b), g, pan=0.15 * np.sin(i * 1.7))

    # Frame drum: dum on bar downbeats from the dissolve; a fuller pattern through the repeats.
    for bar in (2, 3, 4):
        add(dum(), beat(4 * bar), 0.42)
    for bar in (5, 6):
        add(dum(), beat(4 * bar), 0.45)
        add(dum(), beat(4 * bar + 2), 0.30)
        for k in (1, 1.5, 3, 3.5):
            add(tek(), beat(4 * bar + k), 0.16, pan=-0.2)
    for k in (26.75, 27.0 - 1 / 8):  # tiny fill into the silence
        add(tek(), beat(k), 0.14, pan=0.2)
    add(dum(), beat(32), 0.30)

    # Riser into the silence (stamp0 -> silence), hard stop.
    r0, r1 = B["repeat.stamp0"], SIL0
    n = int((r1 - r0) * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(hz("D3") * (1 + t / (r1 - r0))) / SR) * 0.3
    nz = rng.uniform(-1, 1, n)
    ris = (lp(nz, 6000) * 0.5 + tone) * (t / (r1 - r0)) ** 2
    add(ris, r0, 0.14)

# Material sounds (kept in the no-music version too).
sand = np.array([e["sand"] for e in ENV])
sweep = np.array([e["sweep"] for e in ENV])
add(noise_bed(sand / max(1e-6, sand.max()), 1400, 7500), 0.0, 0.20, pan=-0.1)
add(noise_bed(sweep / max(1e-6, sweep.max()), 1600, 8500), 0.0, 0.18, pan=0.1)

# Morph whoosh: low noise swell as the dune lines bend into walls.
m0 = B["interior.morph"]
n = int(1.6 * SR)
t = np.arange(n) / SR
w = lp(rng.uniform(-1, 1, n), 900) * np.sin(np.pi * t / 1.6) ** 2
add(norm(w), m0, 0.10)

# Wood ticks on each stamped block, alternating samples, gain stepping down, panned by side.
pans = [-0.3, -0.35, -0.15, 0.25, -0.1, 0.3, -0.1, 0.3, -0.1, 0.3]
for i in range(10):
    g = 0.30 - 0.012 * i
    add(tick(i % 2), B[f"repeat.stamp{i}"], g, pan=pans[i])

# Payoff: sub drop + bright chord stab, the loudest moment.
n = int(1.8 * SR)
t = np.arange(n) / SR
sub = np.sin(2 * np.pi * np.cumsum(45 + 30 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.55)
stab = np.zeros(n)
for f in (hz("D3"), hz("F#3"), hz("A3"), hz("D4"), hz("A4")):
    stab += np.sign(np.sin(2 * np.pi * f * t)) * 0.25 + np.sin(2 * np.pi * f * t)
stab = lp(stab, 3200) * np.exp(-t / 0.35)
add(fade_in(norm(sub), 3), HERO, 0.55)
add(fade_in(norm(stab), 3), HERO, 0.32)

# Hard silence: gate the whole mix (15 ms ramps), so no tail fills it.
g = np.ones(N)
i0, i1 = int(SIL0 * SR), int(SIL1 * SR) - int(0.004 * SR)
r = int(0.015 * SR)
g[i0:i1] = 0
g[i0 - r:i0] = np.linspace(1, 0, r)
for x in (L, Rt):
    x *= g
    # Low-end discipline: tame 20-120 Hz a little except the payoff sub.
mix = np.stack([L, Rt], axis=1)
mix /= max(1e-9, np.max(np.abs(mix))) / 0.7
fo = int(1.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2

with wave.open(OUT, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("wrote", OUT, "no-music" if NO_MUSIC else "")
