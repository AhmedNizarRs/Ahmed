# University of Sharjah, Central Laboratories B3: Ground Floor (internal test)

**Internal testing only.** The University of Sharjah is not a DALIL client or pilot. The source is the Central
Laboratories Directorate's published "B3 Ground Floor" building layout (PDF), supplied by the founder. The PDF is
not stored in the repository: put it at `.pictures/B3-Ground.pdf` to rebuild.

```
python3 data/test-uos-b3/make_dxf.py      # from dalil-nav/; needs pymupdf, Pillow, numpy → b3_ground.dxf + floors.json
node data/test-uos-b3/build-maps.cjs      # runs the Mapper headless → dalil-map_*.json, project, tag CSV, preview
```

## What is certain
- Walls: traced from the drawing (rendered page, dark grey straight lines ≥ 0.9 m). 866 wall segments.
- Place names and door codes (MD19, MD20, MD5…) are the drawing's own labels. All 27 places can be reached from Entrance MD19.

## What is measured or estimated
- **Scale:** no scale bar on the drawing. Esri World Imagery (0.27 m/px) shows the roof as about 106 × 61 m; the
  drawing's outer walls are 2083 × 1201 px, which gives 19.7 px per metre from both sides (within 1%). Doors then read 1.0–1.1 m.
- **Position and direction:** the Google Maps place "Men's Central Laboratories B3" (25.2870679, 55.4778081) and the
  roof outline: edges at 34° / 124°, the service court (pump room, substation) faces the road to the south-east,
  so the drawing's "up" is 124° from north. The traced plan overlays the roof within about 1–2 m. About ±5 m and ±2°; not surveyed.
- **Lift and stair points** are at their doors (lift cars and stair flights are closed shapes on the plan).
- **Door numbers** (`doors`, e.g. Analytical Chemistry Lab = 034) are the numbers printed next to each room's door on the drawing; check on site. Labs use the `lab` category. Arabic building name is a draft.
- **Toilets** are not marked men's/women's on the drawing, so each block is one "Toilets" place.
- **Entrance MD13** is left out: the drawing closes its vestibule off from the corridor with a line, and we did not guess a door.
- Arabic names are drafts and need a native-speaker check. Only the ground floor was supplied, so lifts and stairs have no floor links yet.
