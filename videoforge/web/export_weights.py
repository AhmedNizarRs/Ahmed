"""Export Real-ESRGAN compact checkpoints for the in-browser (WebGL2) engine.

    python web/export_weights.py            # writes web/models/*.json

Each conv layer is re-packed into the layout the fragment shader reads from a
uniform buffer: for every group of 4 output channels, for every group of 4
input channels, for each of the 9 taps, one column-major mat4 with
M[col=c][row=r] = weight[4*o + r, 4*i + c, ky, kx].  Bias and PReLU slopes
follow as vec4 per output group.  Values are stored as float16, base64.
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from videoforge.models import _state_dict  # noqa: E402

MODELS = {
    "general": ("realesr-general-x4v3.pth", 32),
    "general-wdn": ("realesr-general-wdn-x4v3.pth", 32),
    "anime": ("realesr-animevideov3.pth", 16),
}


def pack_conv(w: np.ndarray) -> np.ndarray:
    cout, cin = w.shape[:2]
    no, ni = -(-cout // 4), -(-cin // 4)
    padded = np.zeros((no * 4, ni * 4, 3, 3), np.float32)
    padded[:cout, :cin] = w
    # [o, r, i, c, ky, kx] -> [o, i, tap(ky,kx), c, r]
    p = padded.reshape(no, 4, ni, 4, 3, 3).transpose(0, 2, 4, 5, 3, 1)
    return p.reshape(-1), no, ni


def pad4(v: np.ndarray) -> np.ndarray:
    out = np.zeros(-(-len(v) // 4) * 4, np.float32)
    out[: len(v)] = v
    return out


def export(key: str, filename: str, num_conv: int, out_dir: Path) -> dict:
    sd = {k: v.float().numpy() for k, v in _state_dict(filename).items()}
    layers, chunks, offset = [], [], 0
    for idx in range(0, 2 * num_conv + 3, 2):
        w, b = sd[f"body.{idx}.weight"], sd[f"body.{idx}.bias"]
        packed, no, ni = pack_conv(w)
        act = f"body.{idx + 1}.weight" in sd
        parts = [packed, pad4(b)]
        if act:
            parts.append(pad4(sd[f"body.{idx + 1}.weight"]))
        flat = np.concatenate(parts)
        layers.append({"ni": ni, "no": no, "act": act, "offset": offset})
        chunks.append(flat)
        offset += flat.size
    data = np.concatenate(chunks).astype("<f2")
    doc = {"key": key, "scale": 4, "layers": layers, "count": int(data.size),
           "data": base64.b64encode(data.tobytes()).decode()}
    out = out_dir / f"{key}.json"
    out.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"{out.name}: {len(layers)} layers, {data.size:,} values, {out.stat().st_size / 1e6:.2f} MB")
    return doc


if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent / "models"
    out_dir.mkdir(exist_ok=True)
    for key, (fn, n) in MODELS.items():
        export(key, fn, n, out_dir)
