# DALIL flexible sticker v1: print files

| File | Use |
|---|---|
| `dalil-sticker_2.stl` | One material: print everything in TPU |
| `dalil-sticker_2_base.stl` + `dalil-sticker_2_glow.stl` | Two materials: pad and braille in yellow TPU, number and ribs in glow-in-the-dark TPU (same coordinates; load both as one object) |
| `dalil-sticker_2_preview.png` | What it looks like |
| `make_sticker.py` | Makes a new sticker: `python3 make_sticker.py --number 5 --ribs 2` (ribs: 3 = information, 2 = safety, 1 = end of stairs; needs `pip install manifold3d trimesh matplotlib shapely`) |

**Size:** 80 × 32 mm, 1.6 mm pad, 2.4 mm at the dots. Rounded corners, sloped edges. Flat back for 3M VHB-type tape.

**Print settings (starting point, test them):**
- TPU 95A (the 85A grade is softer but harder to print), 0.2 mm layers (0.12 mm for sharper braille)
- 100 % infill (it bends evenly)
- Print flat, back down, no supports
- Slow: 15–25 mm/s
- Nozzle 220–235 °C, bed 40–60 °C
- Dry the TPU first

**Before using it with people:** a braille reader checks the dots. Braille follows ADA §703.3 sizes (dot 1.6 mm wide, 0.65 mm high); confirm the UAE standard. The number "2" in braille (⠼⠃, number sign + b) is the same in Arabic and English braille `[VERIFY with reader]`.
