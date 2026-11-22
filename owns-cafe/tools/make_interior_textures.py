"""Interior palette textures from Poly Haven scans (CC0, polyhaven.com), tinted to the Owns interior scheme.

Keeps the scan's real surface variation (luminance only, contrast scaled) and recolours it:
  int_plaster.jpg     walls / ceiling   - warm greige lime plaster      (from white_plaster_02)
  int_mocha.jpg       partition accent  - deep mocha textured plaster    (from plastered_wall_04)
  int_microcement.jpg floor             - warm mid-grey polished microcement (from smooth_concrete_floor)
  int_oak.jpg         joinery           - natural white oak veneer       (from white_oak_veneer)
  int_quartz.jpg      counter top       - honed cream solid surface      (from white_plaster_02, very low contrast)
Run: python3 make_interior_textures.py <textures_dir>
"""
import sys, os
import numpy as np
from PIL import Image

T = sys.argv[1] if len(sys.argv) > 1 else "textures"


def recolour(src, dst, tint, contrast, size=2048):
    a = np.asarray(Image.open(os.path.join(T, src)).convert("RGB").resize((size, size), Image.LANCZOS)).astype(float)
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    rel = lum / lum.mean()
    out = np.array(tint, float)[None, None, :] * (1 + contrast * (rel - 1))[..., None]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(T, dst), quality=92)
    print(dst, out.reshape(-1, 3).mean(0).round())


recolour("ph_white_plaster_02_diff.jpg", "int_plaster.jpg", (232, 226, 216), 0.18)
recolour("ph_plastered_wall_04_diff.jpg", "int_mocha.jpg", (96, 74, 61), 0.7)
recolour("ph_smooth_concrete_floor_diff.jpg", "int_microcement.jpg", (156, 150, 141), 0.55)
recolour("ph_white_plaster_02_diff.jpg", "int_quartz.jpg", (238, 233, 224), 0.06)
# oak: keep the scan's own colour, just a touch lighter and warmer
a = np.asarray(Image.open(os.path.join(T, "ph_white_oak_veneer_diff.jpg")).convert("RGB")).astype(float)
a = a * np.array([1.18, 1.14, 1.08])
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(T, "int_oak.jpg"), quality=92)
print("int_oak.jpg", a.reshape(-1, 3).mean(0).round())


# ---- white marble (Calacatta-like): soft grey veins on warm white, 240 cm repeat, tileable
def pnoise(n, slope, r):
    f = np.fft.fftfreq(n)
    k = np.sqrt(f[None, :] ** 2 + f[:, None] ** 2); k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k ** slope
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec))
    return (a - a.mean()) / a.std()


r = np.random.default_rng(21)
N = 2048
w1 = pnoise(N, 2.2, r); w2 = pnoise(N, 1.6, r); fine = pnoise(N, 1.0, r)
y, x = np.mgrid[0:N, 0:N] / N
field = np.sin(2 * np.pi * (x * 1 + y * 2) + 2.2 * w1 + 0.6 * w2)
veins = np.exp(-(np.abs(field) / 0.035) ** 1.2)                  # thin main veins
field2 = np.sin(2 * np.pi * (x * 3 - y * 1) + 3.0 * w2 + 0.8 * fine)
veins2 = 0.45 * np.exp(-(np.abs(field2) / 0.02) ** 1.3)           # fine secondary veins
cloud = 0.03 * pnoise(N, 2.4, r)
base = np.array([242, 239, 234], float)
vein_col = np.array([150, 148, 146], float)
v = np.clip(veins + veins2, 0, 1)[..., None]
out = base * (1 + cloud)[..., None] * (1 - v) + vein_col * v
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(T, "int_marble.jpg"), quality=92)
print("int_marble.jpg", out.reshape(-1, 3).mean(0).round())
recolour("ph_white_plaster_02_diff.jpg", "int_taupe.jpg", (156, 143, 129), 0.35)

# ---- preserved cushion moss (biophilic wall): clumpy greens + height map, 120 cm repeat, tileable
r = np.random.default_rng(33)
N = 2048
big = pnoise(N, 2.0, r); mid = pnoise(N, 1.4, r); grain = pnoise(N, 0.6, r)
clumps = np.clip(0.55 * big + 0.35 * mid, -2.5, 2.5)
height = 1 / (1 + np.exp(-2.2 * clumps)) * 0.75 + 0.25 * (grain * 0.5 + 0.5)
hue = pnoise(N, 2.6, r)
c_dark = np.array([46, 62, 30]); c_mid = np.array([86, 104, 48]); c_light = np.array([132, 142, 70])
t = np.clip(height, 0, 1)[..., None]
col = np.where(t < 0.5, c_dark + (c_mid - c_dark) * (t / 0.5), c_mid + (c_light - c_mid) * ((t - 0.5) / 0.5))
col = col * (1 + 0.08 * hue)[..., None] * (1 + 0.1 * grain)[..., None]
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(T, "int_moss.jpg"), quality=92)
Image.fromarray((np.clip(height, 0, 1) * 255).astype(np.uint8)).convert("RGB").save(os.path.join(T, "int_moss_h.jpg"), quality=92)
print("int_moss.jpg", col.reshape(-1, 3).mean(0).round())
