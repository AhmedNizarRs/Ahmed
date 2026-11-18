# DALIL sticker: CAD, round 1

Generated from `../sticker-concept-research.md`. Test geometry, not a final specification. Millimetres.

Regenerate: `python3 generate_sticker.py` (STL files and `model-check.json`), then `python3 draw_sheets.py` (spec and fit sheets).
Needs numpy, trimesh, shapely, manifold3d, matplotlib, networkx, fonttools.

Print the `_flat.stl` files flat, dots up, in flexible resin (Flexible 80A class), or send the artwork to a sign shop for raised UV print. Do not use a filament printer: dots fail the standard.
The `_on-rail-d32.stl` and `preview-only_` files are for checking fit and making pictures, not for printing.

**The braille text is a demo.** A braille reader must check every string before it is used.

## Added 2026-11-18: wall plates and places

`python3 generate_wall_plates.py` writes `wall-plate-W1/W2/W3_*_flat.stl`, `strip-C_rooms-201-to-215_flat.stl` and `places-model-check.json`.
Pictures: `previews/08`–`13`. Scene and compositing sources are in `render/` (three.js scenes rendered in headless Chromium; needs `npm i three`).
Wall plate relief and dot height are 0.5 mm test values. A plate meant to meet a signage code needs 0.8 mm letters and 0.6–0.9 mm dots: change `relief` and `dot_h`.
Latin braille on the plates is uncontracted grade 1 and is a demo.
