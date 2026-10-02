# Transparent cutout of the RIMAL logo: alpha from colour distance to the corner background.
import numpy as np
from PIL import Image
im = np.asarray(Image.open("assets/logo.png").convert("RGB")).astype(np.float32)
h, w, _ = im.shape
corners = np.concatenate([im[:12, :12].reshape(-1, 3), im[:12, -12:].reshape(-1, 3), im[-12:, :12].reshape(-1, 3), im[-12:, -12:].reshape(-1, 3)])
bg = np.median(corners, axis=0)
d = np.sqrt(((im - bg) ** 2).sum(-1))
lo, hi = 10.0, 60.0                       # <lo -> fully transparent, >hi -> opaque
a = np.clip((d - lo) / (hi - lo), 0, 1)
# un-premultiply against the bg so soft edges keep the original colour (no cream halo)
rgb = im.copy()
m = a > 0.01
rgb[m] = np.clip((im[m] - bg * (1 - a[m, None])) / a[m, None], 0, 255)
out = np.dstack([rgb, a * 255]).astype(np.uint8)
ys, xs = np.where(a > 0.05)
pad = 8
out = out[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad]
Image.fromarray(out, "RGBA").save("assets/logo-cutout.png")
print("bg", bg, "crop", out.shape)
