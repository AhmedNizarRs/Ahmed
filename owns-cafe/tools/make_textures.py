"""Generate tileable textures for the Owns Cafe model.

travertine.jpg  - beige stone with horizontal wavy veining (like the site photos), 200 x 200 cm tile
floor_tile.jpg  - light warm marble, 60 x 120 cm tiles with grout, 120 x 120 cm repeat
oak.jpg         - light oak grain, 100 x 100 cm repeat
brass.jpg       - brushed brass streaks
Run: python3 make_textures.py <out_dir>
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "textures"
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)
N = 1024


def tile_noise(n, octaves, seed):
    """Periodic value noise built from random Fourier modes (tiles seamlessly)."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    acc = np.zeros((n, n))
    for o in range(octaves):
        f = 2 ** o
        for _ in range(4):
            kx, ky = r.integers(-f, f + 1, 2)
            if kx == 0 and ky == 0:
                kx = 1
            ph = r.uniform(0, 2 * np.pi)
            acc += np.cos(2 * np.pi * (kx * x + ky * y) + ph) / (f ** 0.9)
    acc -= acc.min()
    return acc / acc.max()


def save(arr, name, q=90):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(out, name), quality=q)


# ---- travertine: horizontal bands warped by low-frequency waves ----
y, x = np.mgrid[0:N, 0:N] / N
warp = tile_noise(N, 3, 1) * 0.10 + 0.025 * np.sin(2 * np.pi * (3 * x + 0.3 * np.sin(2 * np.pi * x)))
fine = tile_noise(N, 6, 2)
bands = np.sin(2 * np.pi * (y * 26 + warp * 9)) * 0.5 + 0.5
bands2 = np.sin(2 * np.pi * (y * 71 + warp * 20 + fine * 0.6)) * 0.5 + 0.5
v = 0.62 * bands ** 3 + 0.38 * bands2 ** 6
base = np.array([214, 200, 180]) / 255.0
dark = np.array([150, 135, 117]) / 255.0
mix = (v * 0.75 + fine * 0.25)[..., None]
img = base * (1 - mix * 0.55) + dark * (mix * 0.55)
pores = (np.array(Image.fromarray((rng.random((N, N)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) > 150)[..., None] * 0.07
img = (img - pores) * 255
# panel joints every 100 cm horizontally / 50 cm vertically (200 cm tile -> 2 x 4 panels)
img[:, ::N // 2] *= 0.82
img[::N // 4, :] *= 0.86
save(img, "travertine.jpg")

# ---- floor: warm white marble, 60x120 tiles, texture covers 120x120 cm ----
veins = np.abs(np.sin(2 * np.pi * (x * 2 + y * 3 + tile_noise(N, 5, 4) * 1.6)))
veins = (1 - veins) ** 30
fl = np.array([236, 231, 222]) - (veins * 22)[..., None] - (tile_noise(N, 6, 5) * 10)[..., None]
g = 3
fl[:, 0:g] = fl[:, N // 2:N // 2 + g] = [190, 184, 175]  # tile joints at 0 / 60 cm in x
fl[0:g, :] = [190, 184, 175]                            # joint at 0 cm in y (120 cm tile)
save(fl, "floor_tile.jpg")

# ---- oak ----
gr = tile_noise(N, 6, 6)
rings = np.sin(2 * np.pi * (x * 40 + gr * 3)) * 0.5 + 0.5
oak = np.array([196, 160, 118]) * (0.86 + 0.14 * rings[..., None]) - (gr * 18)[..., None]
save(oak, "oak.jpg")

# ---- brushed brass ----
streak = np.repeat(rng.random((N, 1)), N, axis=1)
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))) / 255
br = np.array([196, 160, 92]) * (0.85 + 0.15 * streak[..., None])
save(br, "brass.jpg")
print("textures written to", out)
