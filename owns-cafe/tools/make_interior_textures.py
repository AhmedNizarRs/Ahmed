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
