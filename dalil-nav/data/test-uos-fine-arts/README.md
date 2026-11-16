# University of Sharjah, College of Fine Arts and Design: Ground Floor (internal test)

**Internal testing only.** The University of Sharjah is not a DALIL client or pilot. The source is a ground-floor
layout picture with the colleges marked 1–8, supplied by the founder. The picture is not stored in the repository:
put it at `.pictures/plan.png` to rebuild (needs Pillow, numpy, scipy).

```
python3 data/test-uos-fine-arts/make_dxf.py      # from dalil-nav/ → fine_arts_ground.dxf + floors.json
node data/test-uos-fine-arts/build-maps.cjs      # runs the Mapper headless → dalil-map_*.json, project, tag CSV, preview
```

## What is certain
- Walls: traced from the drawing (black straight lines ≥ 0.9 m). Red fire-equipment marks, the red numbers and the green college boxes (with their outlines) are not walls; lines seen through the boxes are kept.
- Names: the drawing's labels and its legend (1 Main Entrance, 2 Fine Arts, 3 Graphic Design, 4 & 5 Interior Design, 6 Theatre, 7 Faculty offices, 8 Library).
- All 28 places can be reached on foot from the Main Entrance.

## What is measured or estimated
- **Scale:** the drawing's room sizes (central lobby 11.80 × 11.80 m, halls 7.8 × 31.80 m, 3.8 m corridors, 4.3 × 3.8 m studios) give 17.96 px per metre.
- **Direction:** the drawing's north arrow (down-left, 34° below horizontal) → its "up" is 124° from north, the same grid as the roof in satellite imagery and B3.
- **Position:** the Google Maps place "Arts College" and the entrance porch in Esri World Imagery; the central lobby's dome lands on the dome in the photo. About ±5 m and ±2°; not surveyed.
- **Hand-added doorways** (`OPENINGS` in `make_dxf.py`), where the trace closed a door drawn with a swing: the west hall ↔ small lobby, small lobby ↔ Multipurpose Hall, small lobby ↔ 2 m corridor, ramp corridor ↔ theatre room, Multipurpose Hall ↔ stair hall (two doors). **Estimated:** the way from the Multipurpose Hall's lower-right door through the stair vestibule to the lift lobby (the drawing is unclear there).
- The arcades' bay lines (drawn across the 3.2 m arcade corridors) are not walls.
- **No step-free route yet** to the Multipurpose Hall, the Lift and the Wood Workshop: the drawn doorways there are narrower than the wheelchair clearance. Check on site.
- The large block to the south-west (with the star courtyard) and some canopies in the satellite photo are not in the drawing, so they are not mapped. Only the ground floor was supplied; lifts and stairs have no floor links yet.
- Arabic names are drafts and need a native-speaker check.
