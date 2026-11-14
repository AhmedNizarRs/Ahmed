# dalil-map JSON (v1)

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
