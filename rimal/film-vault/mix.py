#!/usr/bin/env python3
"""Score, SFX and voice for the film, all placed from timeline.json. Writes out/mix.wav (mastered to -14 LUFS).

The voice is the clock, so the music is a bed: a D-hijaz drone, a soft frame-drum pulse and oud-like plucks
(Karplus-Strong). The pulse is re-anchored on the two moments that matter — the bundle's name and the price —
so those land on a downbeat. Real silence precedes the price; the impact under it is the loudest non-voice sound.
usage: mix.py [--novoice]
"""
import json, os, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(os.path.join(HERE, "timeline.json"), encoding="utf-8"))
C, DUR = TL["cues"], TL["meta"]["dur"]
N = int(round(DUR * SR)) + SR
rng = np.random.default_rng(7)
L, R = np.zeros(N), np.zeros(N)
music_L, music_R = np.zeros(N), np.zeros(N)


def put(buf_pair, sig, t, gain=1.0, pan=0.0, peak_align=False):
    """Place sig so that its start (or its measured peak) is at time t."""
    sig = np.asarray(sig)
    if peak_align:
        win = int(0.01 * SR)
        env = np.sqrt(np.convolve(sig ** 2, np.ones(win) / win, mode="same"))
        t -= np.argmax(env) / SR
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: max(0, N - i)]
    buf_pair[0][i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    buf_pair[1][i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def env_ad(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / d)


def onepole(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); z = 0.0
    for i, v in enumerate(x):
        z = (1 - a) * v + a * z; y[i] = z
    return y


def lowpass(x, fc):
    # FFT brick-ish low-pass with a soft knee: cheap and phase-clean for short buffers
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    return np.fft.irfft(X / (1 + (f / hi) ** 4) / (1 + (lo / f) ** 4), len(x))


def pluck(freq, dur=1.6, bright=0.5, decay=0.996):
    """Karplus-Strong string, one period per step (vectorised)."""
    p = int(round(SR / freq)); n = int(dur * SR)
    buf = rng.uniform(-1, 1, p); buf = lowpass(np.tile(buf, 4), 1500 + 6000 * bright)[:p]; buf -= buf.mean()
    out = np.empty((n // p + 1) * p)
    for k in range(n // p + 1):
        out[k * p:(k + 1) * p] = buf
        buf = decay * 0.5 * (buf + np.roll(buf, 1))
    out = out[:n] * np.minimum(1, np.arange(n) / (0.002 * SR))
    return out * np.linspace(1, 0, n) ** 0.5


def hz(semi_from_d4): return 293.66 * 2 ** (semi_from_d4 / 12)


HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12]            # D Eb F# G A Bb C D

# ---------- SFX library ----------
def sfx(name):
    if name == "tick":
        n = int(0.05 * SR); return bandpass(rng.normal(0, 1, n), 1800, 6000) * env_ad(n, 0.001, 0.012)
    if name == "keys":
        out = np.zeros(int(0.5 * SR))
        for i in range(4):
            n = int(0.04 * SR); k = bandpass(rng.normal(0, 1, n), 900 + 300 * i, 4200) * env_ad(n, 0.001, 0.01)
            j = int(i * 0.09 * SR); out[j:j + n] += k * (0.8 + 0.2 * (i % 2))
        return out
    if name in ("whoosh", "whoosh_low"):
        n = int(0.6 * SR); t = np.arange(n) / n
        x = rng.normal(0, 1, n); lo, hi = (220, 2400) if name == "whoosh" else (120, 1300)
        a, b = bandpass(x, lo, hi), bandpass(x, lo * 2.2, hi * 2.4)
        return (a * (1 - t) + b * t) * np.sin(np.pi * t) ** 2.4
    if name == "suck":
        n = int(0.42 * SR); t = np.arange(n) / n
        s = np.sin(2 * np.pi * np.cumsum(180 + 900 * t ** 2.2) / SR) * 0.5 + bandpass(rng.normal(0, 1, n), 500, 5000) * 0.6
        return s * t ** 2.5 * (1 - np.maximum(0, (t - 0.97) / 0.03))
    if name == "thud":
        n = int(0.5 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * np.cumsum(46 + 70 * np.exp(-t / 0.03)) / SR) * env_ad(n, 0.003, 0.14) + 0.25 * bandpass(rng.normal(0, 1, n), 300, 2500) * env_ad(n, 0.001, 0.02)
    if name == "pluck_hi":
        return pluck(hz(12 + 7), 0.9, 0.8, 0.992) + 0.6 * pluck(hz(12), 0.9, 0.7, 0.992)
    if name == "pen":
        n = int(0.34 * SR); t = np.arange(n) / n
        return bandpass(rng.normal(0, 1, n), 2500, 9000) * (0.55 + 0.45 * np.sin(2 * np.pi * 11 * t)) * np.sin(np.pi * t) ** 0.8
    if name == "riser":
        d = C["price.hit"] - 0.02 - (TL["silences"][0]["to"] - TL["silences"][0]["from"]) - C["grid.start"]
        n = int(d * SR); t = np.arange(n) / n
        s = bandpass(rng.normal(0, 1, n), 400, 7000) * 0.5 + 0.35 * np.sin(2 * np.pi * np.cumsum(hz(-12) * (1 + 1.0 * t ** 2)) / SR)
        s *= t ** 2.2
        s[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))          # hard stop into the silence
        return s
    if name == "impact":
        n = int(1.8 * SR); t = np.arange(n) / SR
        sub = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.05)) / SR) * env_ad(n, 0.002, 0.42)
        crack = bandpass(rng.normal(0, 1, n), 150, 5000) * env_ad(n, 0.001, 0.07)
        chord = sum(pluck(hz(s), 1.8, 0.9, 0.9975) for s in (-24, -12, -5, 0, 4, 7))
        return 1.0 * sub + 0.5 * crack + 0.16 * chord
    if name == "sparkle":
        out = np.zeros(int(1.2 * SR))
        for i, s in enumerate((12, 16, 19, 24)):
            p = pluck(hz(s), 0.8, 0.9, 0.99); j = int(i * 0.07 * SR); out[j:j + len(p)] += p[: len(out) - j] * (1 - 0.15 * i)
        return out
    raise KeyError(name)


def norm(x): return x / (np.max(np.abs(x)) + 1e-9)


# ---------- score ----------
BPM = 96; BEAT = 60 / BPM
sil = TL["silences"][0]; HIT = C["price.hit"]; NAME = C["L4.hizma"]; END = DUR
M = (music_L, music_R)

# drone pad (enters under the hook, opens on the name, stops dead for the silence, returns as a tonic chord on the price)
t = np.arange(N) / SR
def pad(semis, t0, t1, gain, attack=1.5, release=0.6):
    e = np.clip((t - t0) / attack, 0, 1) * np.clip((t1 - t) / release, 0, 1)
    s = sum(np.sin(2 * np.pi * hz(x) * (1 + 0.0012 * d) * t + i) for i, x in enumerate(semis) for d in (-1, 1))
    s = s * (0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t))
    music_L[:] += s * e * gain; music_R[:] += np.roll(s, 37) * e * gain
pad((-12, -5), 0.0, sil["from"], 0.024, 1.2, 0.012)
pad((-12, -5, 0), NAME - 0.1, sil["from"], 0.012, 1.2, 0.012)
pad((-12, -5, 0, 4), HIT, END + 0.5, 0.02, 0.05, 1.8)
sub = np.sin(2 * np.pi * hz(-24) * t)
for a, b, g in ((NAME - 0.1, sil["from"], 0.03), (HIT, END + 0.5, 0.035)):
    e = np.clip((t - a) / 0.8, 0, 1) * np.clip((b - t) / (0.012 if b == sil["from"] else 1.8), 0, 1)
    music_L[:] += sub * e * g; music_R[:] += sub * e * g

dum = norm(sfx("thud")); n_tk = int(0.07 * SR); tek = norm(bandpass(rng.normal(0, 1, n_tk), 1500, 7000) * env_ad(n_tk, 0.001, 0.016))
ka = norm(bandpass(rng.normal(0, 1, n_tk), 700, 3000) * env_ad(n_tk, 0.001, 0.02))
PAT = "D.T.D.T.D.TkD.T."                       # one bar of eighths x2: maqsum-ish, light
MOTIF = [(0, 0), (1.5, 4), (2, 5), (3, 7), (4, 5), (5.5, 4), (6, 1), (7, 0)]   # (beat, hijaz semitone) over two bars

def groove(t0, t1, level, melody=True, fills=False):
    k = 0
    while t0 + k * BEAT / 2 < t1 - 0.05:
        ts = t0 + k * BEAT / 2; ch = PAT[k % len(PAT)]
        if ch == "D": put(M, dum, ts, 0.085 * level)
        elif ch == "T": put(M, tek, ts, 0.05 * level, pan=0.25)
        elif ch == "k": put(M, ka, ts, 0.04 * level, pan=-0.25)
        k += 1
    if melody:
        bar2 = 8 * BEAT; j = 0
        while t0 + j * bar2 < t1 - 1.0:
            for b, s in MOTIF:
                ts = t0 + j * bar2 + b * BEAT
                if ts < t1 - 0.3:
                    put(M, pluck(hz(s + (12 if j % 2 else 0)), 1.4, 0.55), ts, 0.055 * level, pan=0.15 if j % 2 else -0.15)
            j += 1

# the hook has no pulse: just the drone and a low string, so the search ticks read
for i, ts in enumerate(np.arange(0.2, C["hook.sweep"] - 0.6, 4 * BEAT)):
    put(M, pluck(hz(-12), 2.4, 0.3, 0.998), ts, 0.16)
groove(NAME, C["revit.go"], 0.8, melody=False)
groove(C["revit.go"] + (BEAT - (C["revit.go"] - NAME) % BEAT) % BEAT, C["grid.start"], 1.0)
gs = C["grid.start"] + (BEAT - (C["grid.start"] - NAME) % BEAT) % BEAT
groove(gs, sil["from"] - 0.05, 0.75, melody=False)
groove(HIT + 2 * BEAT, END - 1.6, 0.7)
put(M, pluck(hz(-12), 3.0, 0.5, 0.9985), END - 1.7, 0.16); put(M, pluck(hz(0), 3.0, 0.6, 0.9985), END - 1.7, 0.09)

# gate: the music stops dead for the silence and ends with a fade
gate = np.ones(N)
a, b = int(sil["from"] * SR), int((HIT - 0.004) * SR)
gate[a - int(0.012 * SR):a] = np.linspace(1, 0, int(0.012 * SR)); gate[a:b] = 0
gate[int((END - 0.9) * SR):] *= np.clip((END - 0.05 - t[int((END - 0.9) * SR):]) / 0.85, 0, 1)
music_L *= gate; music_R *= gate

# ---------- SFX from the timeline ----------
S = (np.zeros(N), np.zeros(N))
ALIGN = {"whoosh": 0.275, "whoosh_low": 0.275}       # whooshes peak mid-move, not at its start
for e in TL["sfx"]:
    s = norm(sfx(e["src"]))
    if e["src"] in ALIGN: put(S, s, e["t"] + ALIGN[e["src"]], e["gain"], peak_align=True)
    elif e["src"] == "suck": put(S, s, e["t"] + 0.34 - len(s) / SR, e["gain"])
    elif e["src"] == "riser": put(S, s, e["t"], e["gain"])
    elif e["src"] in ("impact", "thud", "tick", "pluck_hi"): put(S, s, e["t"], e["gain"], peak_align=True)
    else: put(S, s, e["t"], e["gain"])
for k, v in C.items():                                  # the pile of searches: one tick each, stepping down
    pass
ticks = [C["hook.search"] * 0.18, C["hook.search"] * 0.5] + [C["hook.search"] + d for d in (0.15, 0.5, 0.75, 0.93, 1.06)]
for i, ts in enumerate(ticks):
    put(S, norm(sfx("tick")), ts + 0.1, 0.15 - 0.012 * i, pan=0.3 * (-1) ** i, peak_align=True)
S[0][a:b] = 0; S[1][a:b] = 0

# ---------- voice ----------
V = (np.zeros(N), np.zeros(N)); have_vo = False
if "--novoice" not in sys.argv:
    for line in TL["vo"]:
        f = line.get("file")
        if not f: continue
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, f), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
        put(V, np.frombuffer(raw, dtype=np.float32).astype(float), line["from"]); have_vo = True
if have_vo:
    # duck the bed under speech (about 8 dB), with a slow release so it breathes between lines
    env = np.abs(V[0]); win = int(0.05 * SR); env = np.convolve(env, np.ones(win) / win, mode="same")
    env = np.maximum.accumulate(env[::-1] * 0)[::-1] + env
    rel = np.exp(-1 / (0.35 * SR)); d = np.empty(N); z = 0.0
    for i in range(0, N, 64):
        z = max(env[i], z * rel ** 64); d[i:i + 64] = z
    duck = 1 - 0.6 * np.clip(d / (0.25 * np.max(d) + 1e-9), 0, 1)
    music_L *= duck; music_R *= duck
    vg = 0.5 / (np.sqrt(np.mean(V[0][np.abs(V[0]) > 0.01] ** 2)) + 1e-9) * 0.2
    V[0][:] *= vg; V[1][:] *= vg

mg = 1.0 if have_vo else 1.5
L = music_L * mg + S[0] + V[0]; R = music_R * mg + S[1] + V[1]
mixed = np.stack([L, R], 1)[: int(round(DUR * SR))]
mixed[: int(0.025 * SR)] *= np.linspace(0, 1, int(0.025 * SR))[:, None]
assert np.isfinite(mixed).all(), "NaN in mix"
mixed = mixed / max(1.0, np.max(np.abs(mixed)) / 0.95)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
pre = os.path.join(HERE, "out", "premix.wav")
with wave.open(pre, "wb") as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes((np.clip(mixed, -1, 1) * 8388607).astype("<i4").astype(np.int32).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())

# master: two-pass loudnorm to -14 LUFS, true peak -1.8 dBTP (AAC raises peaks a little)
p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.8:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(p1[p1.rindex("{"):])
af = f"loudnorm=I=-14:TP=-1.8:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
out = os.path.join(HERE, "out", "mix.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af", af, "-ar", str(SR), out], check=True)
print("mix.wav written;", "with voice" if have_vo else "NO VOICE (music + SFX only)", "| premix I =", m["input_i"], "LUFS")
