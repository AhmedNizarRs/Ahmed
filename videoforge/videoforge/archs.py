"""Network definitions for the open models VideoForge runs.

These are independent re-implementations written so that the layer names line
up with the publicly released checkpoints:

* SRVGGCompact - the compact per-frame super-resolution net from Real-ESRGAN
  (BSD-3-Clause, Xintao Wang et al.).
* RRDBNet     - the heavier ESRGAN generator (same project/licence).
* IFNet       - the RIFE v4.7 optical-flow interpolation net
  (MIT, Zhewei Huang et al., "Real-Time Intermediate Flow Estimation").
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


# --------------------------------------------------------------------------
# Super-resolution
# --------------------------------------------------------------------------
class SRVGGCompact(nn.Module):
    """Plain conv stack + pixel shuffle, with a nearest-neighbour skip."""

    def __init__(self, num_feat: int = 64, num_conv: int = 32, scale: int = 4):
        super().__init__()
        self.scale = scale
        layers: list[nn.Module] = [nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_feat)]
        for _ in range(num_conv):
            layers += [nn.Conv2d(num_feat, num_feat, 3, 1, 1), nn.PReLU(num_feat)]
        layers.append(nn.Conv2d(num_feat, 3 * scale * scale, 3, 1, 1))
        self.body = nn.Sequential(*layers)
        self.shuffle = nn.PixelShuffle(scale)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.shuffle(self.body(x))
        return out + F.interpolate(x, scale_factor=self.scale, mode="nearest")


class _DenseBlock(nn.Module):
    def __init__(self, nf: int, gc: int):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.act = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feats = [x]
        for conv in (self.conv1, self.conv2, self.conv3, self.conv4):
            feats.append(self.act(conv(torch.cat(feats, 1))))
        return x + 0.2 * self.conv5(torch.cat(feats, 1))


class _RRDB(nn.Module):
    def __init__(self, nf: int, gc: int):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = (_DenseBlock(nf, gc) for _ in range(3))

    def forward(self, x):
        return x + 0.2 * self.rdb3(self.rdb2(self.rdb1(x)))


class RRDBNet(nn.Module):
    """ESRGAN generator (x4)."""

    def __init__(self, nf: int = 64, nb: int = 23, gc: int = 32, scale: int = 4):
        super().__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[_RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.act = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.act(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.act(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.act(self.conv_hr(feat)))


# --------------------------------------------------------------------------
# Frame interpolation (RIFE 4.7 layout)
# --------------------------------------------------------------------------
_grid_cache: dict[tuple, torch.Tensor] = {}


def backward_warp(img: torch.Tensor, flow: torch.Tensor) -> torch.Tensor:
    """Sample `img` at positions displaced by `flow` (in pixels)."""
    n, _, h, w = flow.shape
    key = (str(flow.device), flow.dtype, h, w)
    if key not in _grid_cache:
        ys = torch.linspace(-1.0, 1.0, h, device=flow.device, dtype=flow.dtype)
        xs = torch.linspace(-1.0, 1.0, w, device=flow.device, dtype=flow.dtype)
        gy, gx = torch.meshgrid(ys, xs, indexing="ij")
        _grid_cache[key] = torch.stack((gx, gy), 0).unsqueeze(0)
    norm = torch.tensor([(w - 1.0) / 2.0, (h - 1.0) / 2.0], device=flow.device, dtype=flow.dtype)
    grid = _grid_cache[key] + flow / norm.view(1, 2, 1, 1)
    return F.grid_sample(img, grid.permute(0, 2, 3, 1), mode="bilinear",
                         padding_mode="border", align_corners=True)


def _conv(cin, cout, k=3, s=1, p=1):
    return nn.Sequential(nn.Conv2d(cin, cout, k, s, p), nn.LeakyReLU(0.2, True))


class _ResConv(nn.Module):
    def __init__(self, c: int):
        super().__init__()
        self.conv = nn.Conv2d(c, c, 3, 1, 1)
        self.beta = nn.Parameter(torch.ones(1, c, 1, 1))
        self.act = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        return self.act(self.conv(x) * self.beta + x)


class _IFBlock(nn.Module):
    def __init__(self, cin: int, c: int):
        super().__init__()
        self.conv0 = nn.Sequential(_conv(cin, c // 2, 3, 2, 1), _conv(c // 2, c, 3, 2, 1))
        self.convblock = nn.Sequential(*[_ResConv(c) for _ in range(8)])
        self.lastconv = nn.Sequential(nn.ConvTranspose2d(c, 4 * 6, 4, 2, 1), nn.PixelShuffle(2))

    def forward(self, x, flow, scale):
        x = F.interpolate(x, scale_factor=1.0 / scale, mode="bilinear", align_corners=False)
        if flow is not None:
            flow = F.interpolate(flow, scale_factor=1.0 / scale, mode="bilinear",
                                 align_corners=False) / scale
            x = torch.cat((x, flow), 1)
        out = self.lastconv(self.convblock(self.conv0(x)))
        out = F.interpolate(out, scale_factor=scale, mode="bilinear", align_corners=False)
        return out[:, :4] * scale, out[:, 4:5]


class IFNet(nn.Module):
    """Coarse-to-fine bidirectional flow estimator; outputs the in-between frame."""

    def __init__(self):
        super().__init__()
        self.block0 = _IFBlock(7 + 8, 192)
        self.block1 = _IFBlock(8 + 4 + 8, 128)
        self.block2 = _IFBlock(8 + 4 + 8, 96)
        self.block3 = _IFBlock(8 + 4 + 8, 64)
        self.encode = nn.Sequential(nn.Conv2d(3, 16, 3, 2, 1), nn.ConvTranspose2d(16, 4, 4, 2, 1))

    def forward(self, img0, img1, t: float = 0.5, scale: float = 1.0):
        scales = [8 / scale, 4 / scale, 2 / scale, 1 / scale]
        f0, f1 = self.encode(img0), self.encode(img1)
        tmap = torch.full_like(img0[:, :1], float(t))
        flow = mask = None
        w0, w1 = img0, img1
        for i, block in enumerate((self.block0, self.block1, self.block2, self.block3)):
            if flow is None:
                flow, mask = block(torch.cat((img0, img1, f0, f1, tmap), 1), None, scales[i])
            else:
                wf0 = backward_warp(f0, flow[:, :2])
                wf1 = backward_warp(f1, flow[:, 2:4])
                d_flow, mask = block(torch.cat((w0, w1, wf0, wf1, tmap, mask), 1), flow, scales[i])
                flow = flow + d_flow
            w0 = backward_warp(img0, flow[:, :2])
            w1 = backward_warp(img1, flow[:, 2:4])
        m = torch.sigmoid(mask)
        return w0 * m + w1 * (1 - m)
