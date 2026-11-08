#!/usr/bin/env python3
"""Synthesize the score from timeline.json + vo/sounddata.json, duck it under the VO, write mix.wav.
Elements: a warm D drone with a Hijaz colour, sand hiss driven by the ball's speed, an oud-like pluck
on each tool, real silence before the hero, a sub-boom + sand rush (one tick per pattern line) on the
hero, and a bell under the stamp."""
import json, wave
import numpy as np
from pathlib import Path

here = Path(__file__).parent
SR = 48000
TL = json.loads((here / "timeline.json").read_text())
SD = json.loads((here / "vo/sounddata.json").read_text())
DUR = TL["meta"]["dur"]; N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(5)
B = {s["id"]: s["beats"] for s in TL["scenes"]}
HERO = TL["hero"]["t"]; SIL0 = TL["silences"][0]["from"]
STAMP = B["end"]["stamp"]

def env_lin(points):  # piecewise-linear envelope from (time, value) pairs
    xs, ys = zip(*points); return np.interp(t, xs, ys)

def bandnoise(lo, hi, n):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    X *= ((f > lo) & (f < hi)) * 1.0
    y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)

mix = np.zeros(N)

# 1. Drone: D2 + A2 + D3 + F#3, slow beating; Eb shimmer during the turn (Hijaz colour)
def tone(f, amp, detune=0.0015):
    return amp * (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * (1 + detune) * t + 1.3))
drone = tone(73.42, 0.5) + tone(110.0, 0.32) + tone(146.83, 0.22) + tone(185.0, 0.12)
drone += 0.10 * np.sin(2 * np.pi * 155.56 * t) * env_lin([(0, 0), (21.9, 0), (23.0, 1), (24.6, 1), (24.85, 0), (DUR, 0)])
drone_env = env_lin([(0, 0.0), (1.2, 0.7), (21.9, 0.8), (24.2, 1.0), (24.85, 0.0), (HERO, 0.0), (HERO + 0.6, 1.1), (31.0, 0.9), (DUR - 0.8, 0.6), (DUR, 0.0)])
mix += 0.08 * drone * drone_env

# 2. Sand hiss driven by the ball's speed (the material at work)
ball = np.array(SD["ball"]); fps = 60
spd = np.r_[0, np.hypot(*np.diff(ball, axis=0).T)] * fps          # world units / s
spd = np.convolve(spd, np.ones(5) / 5, mode="same")
spd_t = np.interp(t, np.arange(len(spd)) / fps, spd)
hiss = bandnoise(900, 5200, N)
hiss_amp = np.clip(spd_t / 1400, 0, 1) ** 0.7 * (t < HERO)
mix += 0.11 * hiss * hiss_amp

# 3. Oud-like pluck (Karplus-Strong) on each tool, notes from D Hijaz
def pluck(f, dur=1.6, amp=1.0):
    n = int(dur * SR); p = int(SR / f); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return amp * out * np.exp(-np.arange(n) / (0.6 * SR))
def place(sig, at, gain=1.0):
    i = int(at * SR); j = min(N, i + len(sig))
    if i < N: mix[i:j] += gain * sig[:j - i]
for at, f in [(B["cad"]["term"], 146.83), (B["revit"]["term"], 185.0), (B["su"]["term"], 220.0),
              (B["max"]["term"], 196.0), (B["star"]["term"], 293.66)]:
    place(pluck(f), at, 0.16)

# 4. Hero: sub-boom + sand rush + one tick per pattern line appearing
k = np.arange(int(2.2 * SR)) / SR
boom = np.sin(2 * np.pi * (38 * k + (60 - 38) * (1 - np.exp(-k * 3)) / 3)) * np.exp(-k * 1.6)
boom += 0.4 * np.sin(2 * np.pi * 76 * k) * np.exp(-k * 3.0)
place(boom * np.minimum(1, k / 0.012), HERO, 0.55)
rush = bandnoise(200, 3500, int(1.8 * SR)); kk = np.arange(len(rush)) / SR
place(rush * np.minimum(1, kk / 0.05) * np.exp(-kk * 1.7), HERO, 0.20)
tick = bandnoise(2500, 9000, 240) * np.exp(-np.arange(240) / 50)
for st in [x for x in SD["tess"] if x < STAMP - 1.0]:   # lattice only; the ring traces silently before the bell
    place(tick, st, 0.035 * rng.uniform(0.5, 1.0))

# 5. Bell under the stamp (inharmonic partials on D5)
kb = np.arange(int(3.0 * SR)) / SR
bell = sum(a * np.sin(2 * np.pi * 587.33 * r * kb) * np.exp(-kb * d) for r, a, d in [(1, 1, 1.4), (2.0, 0.4, 2.2), (2.76, 0.25, 3.0), (5.4, 0.1, 5.0)])
place(bell * np.minimum(1, kb / 0.004), STAMP + 0.05, 0.05)

# real silence before the hero: hard zero the music bed there (VO is silent too)
mix[(t >= SIL0) & (t < HERO)] = 0.0

# duck under the VO
def read_wav(p):
    w = wave.open(str(p)); x = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0
    return x[:N] if len(x) >= N else np.pad(x, (0, N - len(x)))
vo = read_wav(here / "vo/vo_edit.wav")
win = int(0.05 * SR); e = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode="same"))
duck = 1 - 0.55 * np.clip(e / 0.03, 0, 1)
duck = np.convolve(duck, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
music = mix * duck
out = vo * 1.0 + music
peak = np.abs(out).max(); out = out / peak * 0.89
np.save(here / "vo/music_only.npy", music.astype(np.float32))
w = wave.open(str(here / "mix_raw.wav"), "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
# report the loudest non-voice moment (100 ms windows)
m = np.abs(music); W = int(0.1 * SR); r = np.convolve(m ** 2, np.ones(W) / W, mode="same")
print("loudest non-voice at", round(np.argmax(r) / SR, 2), "s; hero", HERO)
