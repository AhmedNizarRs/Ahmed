# dalil-map JSON (v1, v2)

Exported by the DALIL Mapper. The visitor app consumes it. All coordinates are in **metres**, on a plan-local origin, with **y pointing up**.

```jsonc
{
  "format": "dalil-map", "version": 1, "generated": "ISO date",
  "building": { "id": "hospital-building-1000", "name": "Hospital Building 1000" },
  "floor":    { "id": "ground", "name": "Ground" },
  "units": "m",
  "source": { "type": "dxf", "drawingUnits": "ft" },          // or { type:"image", metresPerPixel }
  "clearance": { "walk": 0.25, "wheelchair": 0.4 },
  "grid": { "cell": 0.1 },
  "points": [{
    "id": "P001", "nameEn": "Main Entrance", "nameAr": "المدخل الرئيسي",
    "category": "entrance",            // entrance|exit|reception|lift|stairs|ramp|toilet|toilet_acc|prayer|wudu|baby|cafe|room|corridor|parking
    "dalilNode": true,                 // physical tactile + NFC tag here
    "facingDeg": 90,                   // direction the user faces at the tag; 0=plan right, 90=plan up
    "x": 12.3, "y": 4.5,
    "nfcUrl": "https://dalil.app/t/<building>/<floor>/P001",  // only on nodes
    "link": "LIFT-W"                   // optional: lift/stairs code shared across floors (see below)
  }],
  "plan": {
    "walls": [[[x,y],[x,y], ...], ...],   // polylines
    "doors": [[[x,y], ...], ...],
    "openings": [{ "a":[x,y], "b":[x,y], "width_m":0.9 }]
  },
  "routes": {
    "walk":  { "P001>P004": { "distance_m": 36.2, "seconds": 33, "path": [[x,y],...],
                              "steps": [{ "en":"...", "ar":"...", "node":"P013"? }] } },
    "chair": { ... }                      // missing key = no wheelchair-accessible route
  }
}
```

Notes
- Routes are precomputed between **every ordered pair** of points, so the app needs no routing engine. A missing pair in `chair` means there is no step-free route.
- Steps that carry `node` are DALIL-node confirmations. The app should show a "Tap tag / I'm here" action on those.
- NFC URL scheme: `<base>/<buildingId>/<floorId>/<pointId>`. Opening it should set "You are here" = that point.

Several floors
- Export one file per floor, with the same `building.id` and a different `floor.id`. List them in the app's `maps.json` from the lowest floor to the highest; that order decides "up" and "down".
- A lift or staircase that connects floors gets the same `link` code on every floor it serves (for example `LIFT-W`). The app joins two floors through any shared link: a route on the first floor to the link point, "Take the lift/stairs up to Level 2", then a route on the second floor from the matching point.
- Step-free mode only uses links whose points are `lift` on both floors.
- Drawings in rotated survey coordinates can be squared with the Mapper's **Straighten** button before placing points; the rotation is saved in the project file.

Version 2 (current Mapper export)
- Adds `nav`: the walkable grids the Mapper built, already inflated by the clearance, so the app routes on the phone:
  `{ "encoding": "rle-varint-base64", "cell": 0.1, "x0": …, "y0": …, "W": …, "H": …, "speed": {"walk": 1.1, "chair": 0.8}, "walk": "<b64>", "chair": "<b64>" }`.
  Each grid is run lengths over the W×H cells (row by row, starting with a free run), as LEB128 varints, base64. A set cell is blocked.
- `routes.walk` / `routes.chair` are empty unless the Mapper's "Also store every route" box was ticked. When stored routes exist (and there are no closures), the app uses them as is; otherwise it computes them from `nav`.
- Adds `closures`: `[{ "id": "C01", "nameEn": "Temporary closure", "nameAr": "إغلاق مؤقت", "a": [x,y], "b": [x,y], "width_m": 0.6 }]`. The app blocks a band along each line, so a closure drawn from wall to wall seals a corridor and routes go around it.
- Category `cafe` was added. The app also uses virtual places: `@spot` (the visitor's saved spot) and `@x,y` (a dropped pin), in keys like `level-1|@12.5,30.2`.
- Size: Kennedy Library floors are about 150 KB each in v2 (they were 1.7–2.1 MB with every route stored).

World position (optional, v2)
- `geo`: `{ "origin": [lng, lat], "bearing": -12.8, "scale": 1.00003, "source": "…" }`. `origin` is the real position of plan point (0, 0); `bearing` is the direction of the plan's +y axis in degrees clockwise from true north; `scale` is real metres per plan metre (≈ 1). Plan (x, y) → east = scale·(x·cos b + y·sin b), north = scale·(−x·sin b + y·cos b), then metres → degrees at the origin latitude (`app/outdoor.js` `geoTransform`).
- Set it in the Mapper (**World position**: two points + their lat/lng) or compute it exactly from survey-coordinate CAD (`data/test-calpoly-library/georef.py`).
- `building_context` (optional): `{ "footprint": [[lng, lat], …], "height_m", "floors", "source" }`, e.g. from Overture Maps (ODbL; keep the attribution).
- See `docs/data-providers.md`.
