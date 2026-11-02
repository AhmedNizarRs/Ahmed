"""End-to-end smoke test on synthetic clips.

    python tests/smoke_test.py

Checks:
  1. every model loads its released checkpoint with strict key matching;
  2. RIFE's mid-frame for a moving pattern beats a plain 50/50 blend;
  3. the full pipeline (upscale + 24->60 fps + audio) produces a valid file.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from videoforge import Settings, enhance_video  # noqa: E402
from videoforge.enhance import Interpolator, Upscaler  # noqa: E402
from videoforge.models import UPSCALE_MODELS, load_upscaler_net  # noqa: E402
from videoforge.video import probe  # noqa: E402


def textured(h: int, w: int, dx: float) -> np.ndarray:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    x = x - dx
    img = np.stack([
        128 + 100 * np.sin(x / 9.0) * np.cos(y / 13.0),
        128 + 100 * np.sin((x + y) / 17.0),
        128 + 100 * np.cos(x / 23.0 - y / 7.0),
    ], -1)
    return np.clip(img, 0, 255).astype(np.uint8)


def test_models_load():
    for key in UPSCALE_MODELS:
        load_upscaler_net(key, 0.5)
    print("ok  all upscalers load (strict)")


def test_interpolation_quality():
    a, mid, b = textured(128, 192, 0), textured(128, 192, 6), textured(128, 192, 12)
    out = Interpolator(scene_threshold=0)(a, b, 0.5).astype(np.float32)
    blend = (a.astype(np.float32) + b) / 2
    crop = (slice(8, -8), slice(16, -16))
    err_rife = np.abs(out - mid)[crop].mean()
    err_blend = np.abs(blend - mid)[crop].mean()
    print(f"ok  RIFE mid-frame error {err_rife:.2f} vs naive blend {err_blend:.2f}")
    assert err_rife < err_blend * 0.5, "interpolation should beat blending by a wide margin"


def test_upscale_shape():
    img = textured(60, 80, 0)
    out = Upscaler("anime", tile=32)(img, (160, 120))
    assert out.shape == (120, 160, 3)
    print("ok  tiled upscale produces requested size")


def test_pipeline(tmp: Path):
    src = tmp / "in.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y",
                    "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=24:duration=1",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
                    str(src)], check=True)
    dst = tmp / "out.mp4"
    r = enhance_video(src, dst, Settings(model="general", scale=2, fps=60, sharpen=0.3))
    info = probe(dst)
    print(f"ok  pipeline wrote {info.width}x{info.height} @ {float(info.fps):.2f} fps, "
          f"{r['frames_written']} frames, audio={info.has_audio}")
    assert (info.width, info.height) == (320, 180)
    assert abs(float(info.fps) - 60) < 0.01
    assert info.has_audio


if __name__ == "__main__":
    test_models_load()
    test_upscale_shape()
    test_interpolation_quality()
    with tempfile.TemporaryDirectory() as d:
        test_pipeline(Path(d))
    print("all smoke tests passed")
