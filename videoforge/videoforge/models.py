"""Model registry, weight download/caching and device selection."""
from __future__ import annotations

import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import torch

from . import archs

CACHE_DIR = Path(os.environ.get("VIDEOFORGE_CACHE", Path.home() / ".cache" / "videoforge"))

_RE = "https://github.com/xinntao/Real-ESRGAN/releases/download"
WEIGHTS = {
    "realesr-general-x4v3.pth": f"{_RE}/v0.2.5.0/realesr-general-x4v3.pth",
    "realesr-general-wdn-x4v3.pth": f"{_RE}/v0.2.5.0/realesr-general-wdn-x4v3.pth",
    "realesr-animevideov3.pth": f"{_RE}/v0.2.5.0/realesr-animevideov3.pth",
    "RealESRGAN_x4plus.pth": f"{_RE}/v0.1.0/RealESRGAN_x4plus.pth",
    "rife47.pth": "https://github.com/Fannovel16/ComfyUI-Frame-Interpolation/releases/download/models/rife47.pth",
}


@dataclass(frozen=True)
class UpscaleModel:
    key: str
    label: str
    description: str
    weights: str
    supports_denoise: bool = False


UPSCALE_MODELS: dict[str, UpscaleModel] = {
    m.key: m
    for m in (
        UpscaleModel("general", "General (fast)",
                     "Live action / real footage. Compact net, adjustable denoise.",
                     "realesr-general-x4v3.pth", supports_denoise=True),
        UpscaleModel("anime", "Animation (fast)",
                     "Cartoons, anime, flat-shaded CG. Very fast.",
                     "realesr-animevideov3.pth"),
        UpscaleModel("quality", "High quality (slow)",
                     "Heavier ESRGAN generator. Sharper detail, ~10x slower; GPU recommended.",
                     "RealESRGAN_x4plus.pth"),
    )
}


def pick_device(name: str = "auto") -> torch.device:
    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def weight_path(filename: str) -> Path:
    """Return the local path to a weight file, downloading it on first use."""
    path = CACHE_DIR / filename
    if path.exists():
        return path
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    url = WEIGHTS[filename]
    print(f"[videoforge] downloading {filename} ...", file=sys.stderr)
    tmp = path.with_suffix(".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(path)
    return path


def _state_dict(filename: str) -> dict:
    sd = torch.load(weight_path(filename), map_location="cpu", weights_only=True)
    for k in ("params_ema", "params", "state_dict"):
        if isinstance(sd, dict) and k in sd:
            sd = sd[k]
            break
    return {k.removeprefix("module."): v for k, v in sd.items()}


def load_upscaler_net(key: str, denoise: float = 0.5) -> torch.nn.Module:
    spec = UPSCALE_MODELS[key]
    if key == "general":
        net = archs.SRVGGCompact(num_feat=64, num_conv=32, scale=4)
        strong = _state_dict(spec.weights)
        if denoise >= 1.0:
            sd = strong
        else:
            # Real-ESRGAN ships a "weak denoise" twin; blending the two
            # checkpoints gives a continuous denoise-strength control.
            weak = _state_dict("realesr-general-wdn-x4v3.pth")
            a = max(0.0, float(denoise))
            sd = {k: a * strong[k] + (1 - a) * weak[k] for k in strong}
    elif key == "anime":
        net = archs.SRVGGCompact(num_feat=64, num_conv=16, scale=4)
        sd = _state_dict(spec.weights)
    elif key == "quality":
        net = archs.RRDBNet(nf=64, nb=23, gc=32, scale=4)
        sd = _state_dict(spec.weights)
    else:
        raise KeyError(key)
    net.load_state_dict(sd, strict=True)
    return net.eval()


def load_interpolator_net() -> torch.nn.Module:
    net = archs.IFNet()
    net.load_state_dict(_state_dict("rife47.pth"), strict=True)
    return net.eval()
