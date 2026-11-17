# DALIL sticker: CAD, round 1

Generated from `../sticker-concept-research.md`. Test geometry, not a final specification. Millimetres.

Regenerate: `python3 generate_sticker.py` (STL files and `model-check.json`), then `python3 draw_sheets.py` (spec and fit sheets).
Needs numpy, trimesh, shapely, manifold3d, matplotlib, networkx, fonttools.

Print the `_flat.stl` files flat, dots up, in flexible resin (Flexible 80A class), or send the artwork to a sign shop for raised UV print. Do not use a filament printer: dots fail the standard.
The `_on-rail-d32.stl` and `preview-only_` files are for checking fit and making pictures, not for printing.

**The braille text is a demo.** A braille reader must check every string before it is used.
