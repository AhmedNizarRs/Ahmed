"""Generate the tileable textures for the Owns Cafe model.

travertine.jpg / travertine_bump.jpg - vein-cut travertine cladding like the site photos: 90 x 60 cm slabs,
                     each with its own warped layering, ripple marks, pits and tone; 3 mm joints. 360 cm repeat.
plaster.jpg        - precast plaster panels for the neighbouring buildings, 600 cm repeat
paver.jpg          - grey-beige 30 x 15 cm pavers in running bond, 120 cm repeat
asphalt.jpg        - dark asphalt with aggregate, 200 cm repeat
floor_tile.jpg     - warm white marble 60 x 120 tiles, 120 cm repeat
oak.jpg, brass.jpg - oak grain (100 cm), brushed brass (50 cm)
Run: python3 make_textures.py <out_dir>
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "textures"
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(11)


def save(arr, name, q=92):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(out, name), quality=q)


def vnoise(h, w, cell, r):
    """Smooth value noise (non-periodic), cell = feature size in px."""
    gh, gw = int(h / cell) + 4, int(w / cell) + 4
    small = Image.fromarray(r.random((gh, gw)).astype(np.float32), mode="F")
    big = small.resize((int(gw * cell), int(gh * cell)), Image.BICUBIC)
    a = np.asarray(big)[int(cell):int(cell) + h, int(cell):int(cell) + w]
    return (a - a.mean()) / (a.std() + 1e-9)


def fbm(h, w, cell, r, oct=4):
    acc, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for o in range(oct):
        acc += amp * vnoise(h, w, max(cell / 2 ** o, 2), r)
        tot += amp
        amp *= 0.5
    return acc / tot


def pnoise(n, slope, r):
    """Periodic (tileable) noise via FFT filtering; slope ~2 = soft, ~1 = grainy."""
    f = np.fft.fftfreq(n)
    k = np.sqrt(f[None, :] ** 2 + f[:, None] ** 2)
    k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k ** slope
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec))
    return (a - a.mean()) / a.std()


# ------------------------------------------------------------------ travertine
PPC = 6                        # px per cm
SW, SH = 90 * PPC, 60 * PPC    # slab 90 x 60 cm
NX, NY = 4, 6                  # 360 x 360 cm texture
TONES = [((228, 216, 196), .50, 0.9), ((210, 193, 166), .24, 0.7), ((238, 229, 212), .14, 0.6),
         ((168, 154, 134), .08, 0.12), ((190, 172, 146), .04, 0.25)]


def layer_profile(r, t0=-20, t1=80, res=24):
    n = int((t1 - t0) * res)
    prof = np.zeros((n, 3))
    pos = 0
    cols = [np.array(c, float) for c, _, _ in TONES]
    p = np.array([w for _, w, _ in TONES]); p /= p.sum()
    while pos < n:
        i = r.choice(len(TONES), p=p)
        th = max(1, int(r.lognormal(np.log(TONES[i][2] * res), 0.6)))
        prof[pos:pos + th] = cols[i] * (1 + r.normal(0, 0.012))
        pos += th
    k = np.exp(-0.5 * (np.arange(-6, 7) / 2.2) ** 2); k /= k.sum()
    for c in range(3):
        prof[:, c] = np.convolve(np.pad(prof[:, c], 6, mode="edge"), k, "valid")
    return np.linspace(t0, t1, n), prof


def slab(r):
    h, w = SH, SW
    v, u = np.mgrid[0:h, 0:w] / PPC                     # cm; v measured from slab top
    lam = r.uniform(22, 55)
    warp = (r.uniform(1.0, 2.6) * np.sin(2 * np.pi * u / lam + r.uniform(0, 6.3))
            + 2.6 * fbm(h, w, 32 * PPC, r) + 0.6 * fbm(h, w, 7 * PPC, r))
    ripple = 0.35 * np.sin(2 * np.pi * (u / r.uniform(3.5, 5.5) + 0.6 * fbm(h, w, 10 * PPC, r)))
    ripple *= np.clip(fbm(h, w, 14 * PPC, r) * 1.5, 0, 1)   # ripple marks only in patches
    t = v + warp + ripple + r.uniform(-0.03, 0.03) * u
    ts, prof = layer_profile(r)
    img = np.stack([np.interp(t, ts, prof[:, c]) for c in range(3)], -1)
    grain = fbm(h, w, 0.5 * PPC, r, 2)
    img *= (1 + 0.012 * grain)[..., None]
    warmth = r.normal(0, 0.008)
    img *= np.array([1 + warmth, 1, 1 - warmth])[None, None, :] * r.uniform(0.965, 1.03)
    # pits: small dark elongated holes following the layers
    height = 0.55 + 0.05 * grain
    npit = int(r.uniform(40, 120))
    for _ in range(npit):
        cx, cy = r.uniform(0, w), r.uniform(0, h)
        rx, ry = r.uniform(1.5, 7), r.uniform(0.6, 2.2)
        x0, x1 = int(max(cx - rx - 1, 0)), int(min(cx + rx + 2, w))
        y0, y1 = int(max(cy - ry - 1, 0)), int(min(cy + ry + 2, h))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        m = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
        img[y0:y1, x0:x1][m] *= r.uniform(0.62, 0.8)
        height[y0:y1, x0:x1][m] = 0.15
    return img, height


tex = np.zeros((SH * NY, SW * NX, 3))
hgt = np.zeros((SH * NY, SW * NX))
for j in range(NY):
    for i in range(NX):
        im, hh = slab(np.random.default_rng(1000 + j * 10 + i))
        tex[j * SH:(j + 1) * SH, i * SW:(i + 1) * SW] = im
        hgt[j * SH:(j + 1) * SH, i * SW:(i + 1) * SW] = hh
J = 1   # 3 mm joint = ~2 px straddling each slab edge (also at texture borders, so it tiles)
for j in range(NY):
    y = j * SH
    tex[y:y + J] *= 0.72; tex[y - J:y] *= 0.72 if y else 1
    hgt[y:y + J] = 0.05; hgt[(y - J) % hgt.shape[0]] = 0.05
for i in range(NX):
    x = i * SW
    tex[:, x:x + J] *= 0.72; tex[:, (x - J) % tex.shape[1]] *= 0.72
    hgt[:, x:x + J] = 0.05; hgt[:, (x - J) % hgt.shape[1]] = 0.05
tex[-J:] *= 0.72; tex[:, -J:] *= 0.72
save(tex, "travertine.jpg")
save(np.repeat((hgt * 255)[..., None], 3, -1), "travertine_bump.jpg")

# ------------------------------------------------------------------ plaster (precast panels)
N = 1536
pn = pnoise(N, 1.6, rng) * 0.035 + pnoise(N, 1.0, rng) * 0.02
pl = np.array([186, 174, 158]) * (1 + pn)[..., None]
y, x = np.mgrid[0:N, 0:N]
stain = np.clip(pnoise(N, 2.2, rng), 0, None) * 0.025
pl *= (1 - stain)[..., None]
for k in range(0, N, N // 4):            # panel joints every 150 cm vertically (600 cm tile)
    pl[k:k + 2] *= 0.78
for k in range(0, N, N // 2):            # every 300 cm horizontally
    pl[:, k:k + 2] *= 0.78
save(pl, "plaster.jpg")

# ------------------------------------------------------------------ pavers 30 x 15 cm running bond
N = 1024
ppc = N / 120.0
pv = np.zeros((N, N, 3))
base = np.array([176, 169, 157])
for row in range(8):
    y0, y1 = int(row * 15 * ppc), int((row + 1) * 15 * ppc)
    off = 15 * ppc if row % 2 else 0
    for col in range(-1, 5):
        x0, x1 = int(col * 30 * ppc + off), int((col + 1) * 30 * ppc + off)
        c = base * (1 + rng.normal(0, 0.035))
        xs = np.arange(x0, x1) % N
        pv[y0:y1][:, xs] = c
        pv[y0:y1][:, xs[:2]] *= 0.6
    pv[y0:y0 + 2] *= 0.6
pv *= (1 + 0.025 * pnoise(N, 1.0, rng))[..., None]
pv *= (1 - 0.04 * np.clip(pnoise(N, 2.0, rng), 0, None))[..., None]
save(pv, "paver.jpg")

# ------------------------------------------------------------------ asphalt
N = 1024
a = pnoise(N, 0.6, rng)
asp = np.array([44, 44, 46]) * (1 + 0.12 * a)[..., None]
speck = (rng.random((N, N)) > 0.985)
asp[speck] *= 1.9
asp *= (1 + 0.1 * pnoise(N, 2.0, rng))[..., None]
save(asp, "asphalt.jpg")

# ------------------------------------------------------------------ floor marble (60 x 120 tiles, 120 cm repeat)
N = 1024
y, x = np.mgrid[0:N, 0:N] / N
wv = pnoise(N, 1.8, rng)
veins = np.abs(np.sin(2 * np.pi * (x * 2 + y * 3) + wv * 1.6))
veins = (1 - veins) ** 30
fl = np.array([236, 231, 222]) - (veins * 22)[..., None] - (pnoise(N, 1.5, rng) * 4)[..., None]
g = 3
fl[:, 0:g] = fl[:, N // 2:N // 2 + g] = [190, 184, 175]
fl[0:g, :] = [190, 184, 175]
save(fl, "floor_tile.jpg")

# ------------------------------------------------------------------ oak
gr = pnoise(N, 1.4, rng)
rings = np.sin(2 * np.pi * (x * 40 + gr * 0.4)) * 0.5 + 0.5
oak = np.array([196, 160, 118]) * (0.88 + 0.12 * rings[..., None]) - (gr * 6)[..., None]
save(oak, "oak.jpg")

# ------------------------------------------------------------------ brushed brass
streak = np.repeat(rng.random((N, 1)), N, axis=1)
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))) / 255
br = np.array([196, 160, 92]) * (0.85 + 0.15 * streak[..., None])
save(br, "brass.jpg")
print("textures written to", out)
