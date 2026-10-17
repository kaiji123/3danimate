#!/usr/bin/env python3
"""Synthesize a tense music bed and story SFX with numpy. Nothing to license.

Run from the project root:  python scripts/generate_sfx.py [--seconds 75] [--bpm 96]
Writes public/sfx/{music,scratch,coin,cash,whoosh,thud,click,riser}.wav

Music: minor progression Am-F-C-E, detuned-saw pad, soft kick on every beat,
off-beat "ticking" hats, Karplus-Strong pizzicato arpeggio. Mix it under the
voice at ~0.16 volume with fades (see templates/src/ShortVideo.tsx).
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def write(name: str, x: np.ndarray, out: Path):
    x = np.asarray(x, dtype=np.float64)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 0.89  # about -1 dBFS
    data = (x * 32767).astype(np.int16)
    with wave.open(str(out / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"  {out / name}.wav  {len(x) / SR:.2f}s")


def t_(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def env(n: int, a: float, r: float) -> np.ndarray:
    """Linear attack, exponential release (seconds)."""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    return e * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))


def lowpass_fast(x: np.ndarray, cutoff: float, taps: int = 255) -> np.ndarray:
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cutoff / SR * n) * np.hamming(taps)
    return np.convolve(x, h / h.sum(), mode="same")


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f: float, t: np.ndarray) -> np.ndarray:
    return 2 * ((f * t) % 1.0) - 1


def pluck(f: float, sec: float) -> np.ndarray:
    """Karplus-Strong string."""
    n, p = int(sec * SR), max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out * env(n, 0.002, 0.25)


def music(seconds: float, bpm: float) -> np.ndarray:
    beat = 60 / bpm
    bar = 4 * beat
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59]]  # Am F C E
    total = int(seconds * SR)
    mix = np.zeros(total + SR)
    # pad: two detuned saws per note, low-passed, one chord per bar
    for b in range(int(np.ceil(seconds / bar))):
        start = int(b * bar * SR)
        t = t_(bar)
        ch = chords[b % 4]
        pad = sum(saw(midi(n) * 0.999, t) + saw(midi(n) * 1.004, t) for n in ch)
        pad = lowpass_fast(pad, 900) * env(len(t), 0.4, bar * 2) * 0.08
        bass = np.sin(2 * np.pi * midi(ch[0] - 24) * t) * env(len(t), 0.02, bar) * 0.25
        seg = pad + bass
        mix[start:start + len(seg)] += seg[: len(mix) - start]
        # arpeggio: 8th notes up the chord
        for k in range(8):
            note = ch[k % 3] + (12 if k >= 4 else 0)
            s = start + int(k * beat / 2 * SR)
            pl = pluck(midi(note), beat) * 0.18
            mix[s:s + len(pl)] += pl[: max(0, len(mix) - s)]
    # drums
    kick_t = t_(0.25)
    kick = np.sin(2 * np.pi * (45 + 80 * np.exp(-kick_t * 30)) * kick_t) * env(len(kick_t), 0.002, 0.08)
    hat = rng.normal(0, 1, int(0.04 * SR))
    hat = (hat - lowpass_fast(hat, 6000)) * env(len(hat), 0.001, 0.012)
    for i in range(int(seconds / beat)):
        s = int(i * beat * SR)
        mix[s:s + len(kick)] += kick[: len(mix) - s] * 0.5
        h = s + int(beat / 2 * SR)
        mix[h:h + len(hat)] += hat[: max(0, len(mix) - h)] * 0.12
    mix = mix[:total]
    fade = int(1.5 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    return mix


def scratch() -> np.ndarray:
    t = t_(0.7)
    noise = rng.normal(0, 1, len(t))
    noise = noise - lowpass_fast(noise, 1500)
    strokes = (np.sin(2 * np.pi * 7 * t) > 0).astype(float)  # back-and-forth strokes
    return noise * lowpass_fast(strokes, 40) * env(len(t), 0.01, 0.6)


def coin() -> np.ndarray:
    t = t_(0.9)
    return sum(np.sin(2 * np.pi * f * t) * a for f, a in [(2093, 1), (2637, 0.6), (4186, 0.3)]) \
        * env(len(t), 0.001, 0.25)


def cash() -> np.ndarray:
    t = t_(1.2)
    ding = sum(np.sin(2 * np.pi * f * t) for f in (1568, 1976, 2349)) * env(len(t), 0.001, 0.4)
    drawer = rng.normal(0, 1, len(t)) * env(len(t), 0.005, 0.05)
    return ding * 0.6 + lowpass_fast(drawer, 2500) * 0.6


def whoosh() -> np.ndarray:
    t = t_(0.8)
    noise = rng.normal(0, 1, len(t))
    shape = np.sin(np.pi * t / t[-1]) ** 2
    lo = lowpass_fast(noise, 600)
    hi = lowpass_fast(noise, 3000)
    mix_ = lo * (1 - t / t[-1]) + hi * (t / t[-1])  # sweep upwards
    return mix_ * shape


def thud() -> np.ndarray:
    t = t_(0.5)
    body = np.sin(2 * np.pi * (60 + 60 * np.exp(-t * 25)) * t) * env(len(t), 0.001, 0.12)
    hit = lowpass_fast(rng.normal(0, 1, len(t)), 800) * env(len(t), 0.001, 0.03)
    return body + hit * 0.5


def click() -> np.ndarray:
    t = t_(0.08)
    return (rng.normal(0, 1, len(t)) - lowpass_fast(rng.normal(0, 1, len(t)), 2000)) * env(len(t), 0.0005, 0.008)


def riser() -> np.ndarray:
    t = t_(1.5)
    f = 200 * (8 ** (t / t[-1]))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return (tone * 0.5 + lowpass_fast(rng.normal(0, 1, len(t)), 4000) * 0.3) * (t / t[-1]) ** 2


def main():
    args = sys.argv[1:]
    seconds = float(args[args.index("--seconds") + 1]) if "--seconds" in args else 75
    bpm = float(args[args.index("--bpm") + 1]) if "--bpm" in args else 96
    out = Path("public") / "sfx"
    out.mkdir(parents=True, exist_ok=True)
    print("synthesizing (the music bed takes ~30 s)...")
    for name, fn in [("scratch", scratch), ("coin", coin), ("cash", cash), ("whoosh", whoosh),
                     ("thud", thud), ("click", click), ("riser", riser)]:
        write(name, fn(), out)
    write("music", music(seconds, bpm), out)


if __name__ == "__main__":
    main()
