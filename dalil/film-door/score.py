"""Synthesize the DALIL door film score from timeline.json (numpy only). Writes score_raw.wav.
Every cue reads a named beat; nothing is typed in by hand."""
import json, wave, sys
import numpy as np

T = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "timeline.json"))
SR = 48000
DUR = T["meta"]["dur"]
BEAT = 60.0 / T["meta"]["bpm"]
BAR = 4 * BEAT
N = int(DUR * SR) + SR // 2
mix = np.zeros((N, 2))
SC = {s["id"]: s for s in T["scenes"]}
def beat(scene, name): return SC[scene]["beats"][name]
rng = np.random.default_rng(204)

def hz(midi): return 440.0 * 2 ** ((midi - 69) / 12)
def env_adsr(n, a, r, sr=SR):
    e = np.ones(n); ai = int(a * sr); ri = int(r * sr)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e
def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); sig = sig[: max(0, N - i)]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l * 1.414
    mix[i:i + len(sig), 1] += sig * gain * r * 1.414

def pad_voice(f, dur, detune=0.004):
    t = np.arange(int(dur * SR)) / SR; s = np.zeros_like(t)
    for d in (-detune, 0, detune):
        for h in range(1, 7):
            s += np.sin(2 * np.pi * f * (1 + d) * h * t + rng.uniform(0, 6.28)) / h ** 1.6
    return s / 6

def pad(chord, t0, t1, gain, fc=1400, a=0.9, r=0.9):
    dur = t1 - t0; s = sum(pad_voice(hz(m), dur) for m in chord)
    s = onepole_lp(s, fc) * env_adsr(len(s), a, r)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.25 * np.arange(len(s)) / SR)
    add(s * trem, t0, gain, -0.15); add(np.roll(s, 240) * trem, t0, gain, 0.15)

def kick(t, g=0.5):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 48 + 70 * np.exp(-tt * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    add(np.sin(ph) * np.exp(-tt * 9), t, g)

def click(t, g, f=1800):
    n = int(0.09 * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n) * np.exp(-tt * 160)
    tone = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 55)
    thump = np.sin(2 * np.pi * 130 * tt) * np.exp(-tt * 35)
    add(0.5 * np.diff(noise, prepend=0) + 0.6 * tone + 0.8 * thump, t, g)

def tick(t, g, f):
    n = int(0.05 * SR); tt = np.arange(n) / SR
    add(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 90), t, g, 0.2)

def whoosh(t0, t1, g):
    n = int((t1 - t0) * SR); s = onepole_lp(rng.standard_normal(n), 900)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    add(s * e, t0, g, -0.3)

def bell(t, f, g, decay=2.2):
    n = int(3.5 * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for ratio, amp, dk in ((1, 1, 1), (2.76, .45, 1.8), (5.4, .2, 2.6), (8.93, .08, 3.5)):
        s += amp * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt * decay * dk)
    add(s, t, g, 0.1)

def boom(t, g):
    n = int(2.4 * SR); tt = np.arange(n) / SR
    f = 38 + 30 * np.exp(-tt * 6); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * 1.6)
    air = onepole_lp(rng.standard_normal(n), 2500) * np.exp(-tt * 9) * 0.25
    add(body + air, t, g)

# --- Harmony (2 bars per chord until the blackout) ---
out = beat("dark", "out"); hero = beat("glow", "hero")
Dmaj7 = [50, 57, 61, 66]; Bm7 = [47, 54, 57, 62]; Gmaj7 = [43, 50, 54, 59]; Asus = [45, 52, 57, 62]; Dmaj9 = [50, 57, 64, 66, 73]
t = 0.0
for chord in (Dmaj7, Bm7, Gmaj7, Asus):
    t1 = min(t + 2 * BAR, out)
    if t1 > t: pad(chord, t, t1 + (0.12 if t1 == out else 0.5), 0.10, a=(0.05 if t == 0 else 0.6), r=(0.12 if t1 == out else 0.6))
    t += 2 * BAR
pad(Dmaj9, hero, DUR + 0.2, 0.11, fc=2200, a=1.6, r=1.8)

# --- Pulse: soft kick from the problem scene to the blackout, denser in the read scene ---
k = SC["problem"]["start"]
while k < out - 0.05:
    kick(k, 0.30 if k < SC["read"]["start"] else 0.36)
    k += 2 * BEAT if k < SC["read"]["start"] else BEAT

# --- SFX, each anchored to a named beat ---
whoosh(SC["clip"]["start"] + 0.1, beat("clip", "anticipate") + 0.1, 0.10)
click(beat("clip", "snap"), 0.55)
tick(beat("read", "numeral"), 0.20, 900)
for i, f in enumerate((1800, 2000, 2250, 2500)): tick(beat("read", f"cell{i + 1}"), 0.26, f)
click(out, 0.42, f=700)          # the relay of the lights going out
boom(hero, 1.0)                   # the payoff: loudest moment
for i, m in enumerate((74, 81, 90)): bell(hero + 0.02 + i * 0.05, hz(m), 0.10, decay=0.7)
bell(beat("end", "card"), hz(86), 0.16)

# Real silence before the payoff (hard gate between the relay tail and the boom).
for s in T["silences"]:
    a, b = int((s["from"]) * SR), int(s["to"] * SR); mix[a:b] *= 0.0

mix = mix[: int(DUR * SR)]
mix /= max(1e-9, np.abs(mix).max()) / 0.7
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open("score_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("score_raw.wav", round(len(mix) / SR, 3), "s")
