# Owns Cafe | Coffee & More: 3D model for 3ds Max

Built from the CAD plan (`cad/Owns_Cafe.dxf`, units cm), the partition elevation in the same file, your site photos and the inspiration render.

## Open it in 3ds Max (2017 or newer)

1. Unzip `Owns_Cafe_3dsMax.zip` anywhere and keep `Owns_Cafe_build.ms` next to the `textures` folder.
2. In 3ds Max: **Scripting > Run Script...**, then pick `Owns_Cafe_build.ms`.
3. Click **Yes**. It starts a new scene (and asks you to save the current one first), builds about 220 named objects on 14 layers, adds lights and 4 cameras, and saves **`Owns_Cafe.max`** in the same folder. It takes under a minute.

If the script fails on your version, use **File > Import > `Owns_Cafe.obj`** instead (units: cm). You get the same geometry with simpler materials.

## What's in the model

| Layer | Contents | Source |
|---|---|---|
| 01_Shell | 20 cm walls, corner and right piers, column, toilet annex, roof | CAD plan |
| 02_Floors_Ceilings | 60×120 marble-look floor, false ceiling at 370 cm with downlight holes | CAD and elevation |
| 03_Interior_Walls | white linings inside the stone shell | design |
| 04_Partition | 12 cm partition: kitchen door 90×210, 60×40 pass-through hatch at 80–120 cm, the two wave curves (sand plaster above, oak band, white below) and the **"Owns" letters taken from the CAD outlines** in brass | CAD elevation (finishes are my choice) |
| 05_Shopfront | angled front: narrow glass, stone pier, tall black portal (glass below, stone sign panel above with a backlit "Owns / COFFEE & MORE"), corner pier, 110 cm glass entrance door with transoms | CAD and photos |
| 06_DriveThru | drive-thru window in the long wall, steel sill, black canopy with LED, "DRIVE THRU →" sign | CAD and inspiration |
| 07_Counter | 279×70 service counter with the chamfered end (travertine body, quartz top, LED strip), espresso machine, grinders, POS, pastry case, back counter, 3 brass pendants | CAD and design |
| 08_Seating | oak bar along the glass and 3 stools, two-seat table, oak display shelves | CAD and design |
| 09_Kitchen_WC | kitchen counters, cooktop, sink, toilet fixtures, doors | CAD |
| 10_Site / 11_Planters | sidewalk, curbs, road with yellow lines, neighbour unit, back building, street lamp, 2 olive trees in planters | photos and inspiration |
| 12_Exterior_Lighting / 13_Lights | LED base strips, 20 grazing uplights, interior downlights (3000 K), pendants, kitchen and WC lights, street lamp. All photometric (cd, Kelvin) | inspiration |
| 14_Cameras | `CAM_Exterior_Corner` (matches the inspiration angle), `CAM_Exterior_DriveThru`, `CAM_Interior_ToPartition`, `CAM_Interior_ToFront`. Physical cameras with vertical tilt correction | |

Materials are Physical Materials, so they work in Arnold, ART, V-Ray and Corona (convert if needed). Textures in `textures/` are generated and tileable. Swap in real travertine, marble and oak scans for final renders.

## Assumptions to check on site

- **Building height 580 cm** (top of the stone) is estimated from the photos; only the 370 cm ceiling comes from the drawings.
- **Front split** (narrow glass 62 cm, pier 40 cm, portal 162 cm) is read off the photos. The plan shows the whole angled run as one glazing line.
- **Drive-thru window** sill 95 cm, head 205 cm: assumed.
- Partition colours, furniture beyond the CAD (stools, table, shelves, pendants, back counter) and the signage are design proposals.

## Rendering tips

- Night look: dark blue background is set. Exposure is EV 4 on the exterior cameras and EV 5.5 inside. Lower the EV to brighten.
- In Arnold, add an Arnold Skydome light at low intensity (dark blue) for a moonlit sky fill.

## Rebuild from the CAD file

```bash
python3 tools/make_textures.py textures
python3 tools/build_scene.py cad/Owns_Cafe.dxf scene.json
python3 tools/export.py scene.json .
```

To change a dimension, edit `tools/build_scene.py` (all values in cm) and run the last two commands again.
