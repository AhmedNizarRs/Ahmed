"""Frame-level processors: super-resolution and frame interpolation."""
from __future__ import annotations

import math

import numpy as np
import torch
import torch.nn.functional as F

from .models import load_interpolator_net, load_upscaler_net, pick_device


def to_tensor(frame: np.ndarray, device, dtype) -> torch.Tensor:
    """HxWx3 uint8 RGB -> 1x3xHxW float in [0, 1]."""
    t = torch.from_numpy(frame).to(device).permute(2, 0, 1).unsqueeze(0)
    return t.to(dtype) / 255.0


def to_frame(t: torch.Tensor) -> np.ndarray:
    t = (t.clamp(0, 1) * 255.0).round().byte()
    return t.squeeze(0).permute(1, 2, 0).contiguous().cpu().numpy()


class Upscaler:
    """Runs a 4x SR net on a frame and resizes to the requested output size.

    Large frames are processed in overlapping tiles so memory stays bounded.
    """

    native_scale = 4

    def __init__(self, model: str = "general", denoise: float = 0.5, device: str = "auto",
                 tile: int = 384, tile_pad: int = 16, half: bool | None = None):
        self.device = pick_device(device)
        self.half = (self.device.type == "cuda") if half is None else half
        self.dtype = torch.float16 if self.half else torch.float32
        self.net = load_upscaler_net(model, denoise).to(self.device, self.dtype)
        self.tile, self.tile_pad = tile, tile_pad

    @torch.inference_mode()
    def _run(self, x: torch.Tensor) -> torch.Tensor:
        _, _, h, w = x.shape
        s = self.native_scale
        if not self.tile or (h <= self.tile and w <= self.tile):
            return self.net(x)
        out = torch.empty((1, 3, h * s, w * s), device=x.device, dtype=x.dtype)
        t, p = self.tile, self.tile_pad
        for y0 in range(0, h, t):
            for x0 in range(0, w, t):
                y1, x1 = min(y0 + t, h), min(x0 + t, w)
                py0, px0 = max(y0 - p, 0), max(x0 - p, 0)
                py1, px1 = min(y1 + p, h), min(x1 + p, w)
                res = self.net(x[:, :, py0:py1, px0:px1])
                oy, ox = (y0 - py0) * s, (x0 - px0) * s
                out[:, :, y0 * s:y1 * s, x0 * s:x1 * s] = \
                    res[:, :, oy:oy + (y1 - y0) * s, ox:ox + (x1 - x0) * s]
        return out

    def __call__(self, frame: np.ndarray, out_size: tuple[int, int] | None = None) -> np.ndarray:
        """frame: HxWx3 uint8. out_size: (width, height); default is 4x."""
        x = to_tensor(frame, self.device, self.dtype)
        y = self._run(x).float()
        if out_size is not None and (y.shape[3], y.shape[2]) != tuple(out_size):
            y = F.interpolate(y, size=(out_size[1], out_size[0]), mode="bicubic",
                              antialias=True, align_corners=False)
        return to_frame(y)


class Interpolator:
    """RIFE-based in-between frame synthesis with simple scene-cut detection."""

    def __init__(self, device: str = "auto", half: bool | None = None,
                 scene_threshold: float = 0.12):
        self.device = pick_device(device)
        self.half = (self.device.type == "cuda") if half is None else half
        self.dtype = torch.float16 if self.half else torch.float32
        self.net = load_interpolator_net().to(self.device, self.dtype)
        self.scene_threshold = scene_threshold

    @staticmethod
    def scene_change(a: np.ndarray, b: np.ndarray, threshold: float) -> bool:
        """Mean absolute difference of small greyscale thumbnails."""
        if threshold <= 0:
            return False
        step_y = max(1, a.shape[0] // 64)
        step_x = max(1, a.shape[1] // 64)
        ga = a[::step_y, ::step_x].astype(np.float32).mean(2)
        gb = b[::step_y, ::step_x].astype(np.float32).mean(2)
        return float(np.abs(ga - gb).mean()) / 255.0 > threshold

    @torch.inference_mode()
    def __call__(self, a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
        if self.scene_change(a, b, self.scene_threshold):
            return (a if t < 0.5 else b).copy()
        h, w = a.shape[:2]
        # Flow scale: run the coarse levels at lower res for big frames.
        scale = 1.0 if max(h, w) <= 1280 else 0.5
        mult = int(64 / scale)
        ph, pw = math.ceil(h / mult) * mult, math.ceil(w / mult) * mult
        x0 = F.pad(to_tensor(a, self.device, self.dtype), (0, pw - w, 0, ph - h), mode="replicate")
        x1 = F.pad(to_tensor(b, self.device, self.dtype), (0, pw - w, 0, ph - h), mode="replicate")
        out = self.net(x0, x1, t, scale)[:, :, :h, :w]
        return to_frame(out.float())
