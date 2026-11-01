"""Synthesizes Vigil's sound effects (16-bit mono WAV, 44.1 kHz).

Run: python3 tools/make_sounds.py Vigil/Sounds
Everything is generated from scratch, so there are no licensing questions.
"""
import sys
import wave
from pathlib import Path

import numpy as np

RATE = 44100
rng = np.random.default_rng(7)


def t(seconds):
    return np.arange(int(seconds * RATE)) / RATE


def reverb(signal, seconds=2.5, decay=3.0, mix=0.35):
    """Cheap hall reverb: convolve with exponentially decaying noise."""
    n = int(seconds * RATE)
    impulse = rng.standard_normal(n) * np.exp(-decay * np.arange(n) / RATE * (5 / seconds))
    impulse[: int(0.01 * RATE)] *= np.linspace(0, 1, int(0.01 * RATE))
    impulse /= np.sqrt(np.sum(impulse ** 2))
    size = len(signal) + n
    fft = 1 << (size - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(signal, fft) * np.fft.rfft(impulse, fft), fft)[: len(signal) + n]
    out = np.zeros(len(signal) + n)
    out[: len(signal)] += signal * (1 - mix)
    out += wet * mix
    return out


def lowpass(signal, cutoff):
    a = np.exp(-2 * np.pi * cutoff / RATE)
    out = np.empty_like(signal)
    acc = 0.0
    for i, x in enumerate(signal):
        acc = (1 - a) * x + a * acc
        out[i] = acc
    return out


def bell(f0, seconds, strength=1.0):
    """Church bell: inharmonic partials, the lower ones ringing longest."""
    ratios = [0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 2.662, 3.011, 4.166, 5.433, 6.796]
    gains = [0.55, 0.9, 0.6, 0.35, 0.8, 0.3, 0.25, 0.2, 0.15, 0.08, 0.05]
    decays = [0.9, 0.7, 1.1, 1.4, 1.2, 2.0, 2.3, 2.6, 3.5, 4.5, 6.0]
    x = t(seconds)
    out = np.zeros_like(x)
    for r, g, d in zip(ratios, gains, decays):
        detune = 1 + rng.uniform(-0.002, 0.002)
        out += g * np.sin(2 * np.pi * f0 * r * detune * x + rng.uniform(0, 6.28)) * np.exp(-d * x / 1.6)
    strike = rng.standard_normal(len(x)) * np.exp(-x * 90) * 0.25
    out = (out + strike) * strength
    out *= np.minimum(1, x / 0.002)
    return out


def organ(freqs, seconds, attack=0.6, release=0.8):
    """Pipe organ: drawbar-like harmonics with a slow tremulant."""
    x = t(seconds)
    out = np.zeros_like(x)
    drawbars = {1: 1.0, 2: 0.6, 3: 0.35, 4: 0.3, 6: 0.15, 8: 0.12}
    for f in freqs:
        for h, g in drawbars.items():
            out += g * np.sin(2 * np.pi * f * h * x + rng.uniform(0, 6.28))
    out *= 1 + 0.06 * np.sin(2 * np.pi * 5.2 * x)
    env = np.minimum(1, x / attack) * np.minimum(1, (seconds - x) / release)
    return out * env / len(freqs)


def music_box_note(f, seconds=1.4):
    x = t(seconds)
    tone = np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 4.02 * x) * np.exp(-x * 9) + 0.2 * np.sin(2 * np.pi * f * 2 * x)
    return tone * np.exp(-x * 3.2) * np.minimum(1, x / 0.003)


def place(track, sound, at):
    start = int(at * RATE)
    end = min(len(track), start + len(sound))
    track[start:end] += sound[: end - start]


def note(name):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    letter, octave = name[0], int(name[-1])
    semis = names[letter] + (1 if "#" in name else 0) - (1 if "b" in name[1:-1] else 0) + (octave - 4) * 12
    return 440 * 2 ** (semis / 12)


def save(path, signal, peak=0.89):
    signal = signal / (np.max(np.abs(signal)) + 1e-9) * peak
    fade = int(0.02 * RATE)
    signal[-fade:] *= np.linspace(1, 0, fade)
    data = (signal * 32767).astype("<i2").tobytes()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    print(f"{path.name}: {len(signal) / RATE:.1f} s")


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # The call: three tolls of a great bell over a low organ chord (alarm + notification sound, < 30 s).
    toll = np.zeros(int(14 * RATE))
    for i in range(3):
        place(toll, bell(110, 6.5), i * 3.4)
    place(toll, organ([note("D2"), note("A2"), note("D3"), note("F3")], 12, attack=2.5, release=3) * 0.35, 0.2)
    save(out / "toll.wav", reverb(toll, 3.0, mix=0.4)[: int(17 * RATE)])

    # Ringtone for the in-app call: Dies Irae on a music box over a bell, loops cleanly.
    ring = np.zeros(int(8 * RATE))
    melody = ["F5", "E5", "F5", "D5", "E5", "C5", "D5", "D5"]
    for i, n in enumerate(melody):
        place(ring, music_box_note(note(n)) * 0.6, 0.25 + i * 0.42)
        place(ring, music_box_note(note(n) / 2) * 0.25, 0.25 + i * 0.42)
    place(ring, bell(146.8, 4.5, 0.5), 0.0)
    place(ring, bell(146.8, 3.5, 0.35), 4.2)
    save(out / "ring.wav", reverb(ring, 1.5, mix=0.3)[: len(ring)])

    # Ambience while the voice reads the tasks: a dark organ drone, crossfaded so it loops.
    seconds = 12
    drone = organ([note("D2"), note("A2"), note("D3")], seconds + 2, attack=0.01, release=0.01)
    drone += organ([note("F3"), note("C4")], seconds + 2, attack=0.01, release=0.01) * 0.5 * (1 + np.sin(2 * np.pi * t(seconds + 2) / 6)) / 2
    drone = lowpass(drone, 1400)
    n = seconds * RATE
    xf = 2 * RATE
    loop = drone[:n].copy()
    loop[:xf] = drone[:xf] * np.linspace(0, 1, xf) + drone[n:n + xf] * np.linspace(1, 0, xf)
    save(out / "drone.wav", loop, peak=0.5)

    # Task done: a small bright bell.
    save(out / "complete.wav", reverb(bell(880, 2.2, 1.0) + bell(1318.5, 2.2, 0.4), 1.2, mix=0.3))

    # Tap: a soft knock on wood.
    x = t(0.12)
    knock = np.sin(2 * np.pi * 190 * x) * np.exp(-x * 60) + lowpass(rng.standard_normal(len(x)), 1800) * np.exp(-x * 120) * 1.5
    save(out / "tap.wav", knock, peak=0.6)

    # Delete: a candle blown out.
    x = t(0.7)
    breath = lowpass(rng.standard_normal(len(x)), 900) * np.sin(np.pi * np.minimum(1, x / 0.55)) ** 2
    save(out / "extinguish.wav", breath, peak=0.6)

    # Hang up: one low muffled toll.
    save(out / "hangup.wav", reverb(lowpass(bell(73.4, 3.0), 1200), 2.0, mix=0.4), peak=0.8)

    # Answer: an organ chord swelling in.
    save(out / "answer.wav", reverb(organ([note("D3"), note("F3"), note("A3"), note("D4")], 1.8, attack=0.25, release=0.9), 2.0, mix=0.4))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Vigil/Sounds")
