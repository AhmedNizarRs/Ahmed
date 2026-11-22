# Owns Cafe | Coffee & More: 3D model for 3ds Max

Built from the CAD plan (`cad/Owns_Cafe.dxf`, units cm), the partition elevation in the same file, your site photos and the inspiration render. The renders in `renders/` are Cycles (path-traced) renders of this exact model.

## Open it in 3ds Max (2017 or newer)

Option A, native build (recommended):
1. Unzip `Owns_Cafe_3dsMax.zip` and keep `Owns_Cafe_build.ms` next to the `textures` folder.
2. In 3ds Max: **Scripting > Run Script...**, then pick `Owns_Cafe_build.ms` and click **Yes**.
3. It starts a new scene (asks to save the current one first), builds about 250 finished meshes with rounded edges, Physical Materials, photometric lights and 5 physical cameras, then saves **`Owns_Cafe.max`** next to the script. The file is large (about 5.5 MB of mesh data), so allow a minute or two.

Option B: **File > Import > `Owns_Cafe.fbx`**. Same meshes with UVs, textures embedded, plus cameras and lights. Materials will need a quick pass (glass and LEDs come in as plain materials).
Option C: `Owns_Cafe.obj` (cm, Y-up) for any other software. `Owns_Cafe.blend` is the Blender scene used for the renders.

## Design

**Interior: biophilic / organic modern.** Nature comes in through plants and natural textures rather than wood.
- **Partition:** a preserved-moss wall above the wave carries the white, halo-lit "Owns" logo. The wave band is brushed champagne metal with hidden LEDs, and a ceiling slot washes light down the moss.
- **Plants:** an indoor olive tree in a clay planter between the window bar and the desk, three trailing plants hanging over the window bar, and small potted plants on the shelves.
- **Desk:** white marble body and top with 3 cm rounded edges. The glass bakery case traces the desk's angled corner.
- **Soft materials:** bouclé stool seats and jute drum pendant shades.
- **Shelves:** slim champagne metal with LED strips underneath, holding matte ceramics in sand, terracotta and white.
- **Walls and ceiling:** greige lime plaster.
- **Floor:** warm grey microcement.

The surfaces use Poly Haven scans (CC0), recoloured by `tools/make_interior_textures.py`, with roughness and normal maps.

- **Sleek edges everywhere:** every object is a finished mesh with rounded edges and corners (0.3–2 cm depending on material), with crisp flat faces and soft highlights on the edges.
- **Reception desk:** travertine body, quartz top with a hidden LED strip, and on top only:
  - a **glass bakery case** with brass corner posts, a glass shelf and LED strips, holding croissants, pains au chocolat, muffins and cookies;
  - a **slim cashier**: a tablet on a stand plus a card reader.
- **Partition (back wall), with hidden lighting:**
  - the oak wave band floats 3 cm off the wall, with LED strips hidden in the gap that wash light up and down the wall along both curves;
  - the **"Owns" logo** (letters traced from your CAD) is brass, standing 2.5 cm off the wall, with an LED layer behind it, so the letters glow with a halo;
  - a recessed ceiling slot hides an LED wall-washer that lights the whole partition from above.
- **Exterior:**
  - vein-cut travertine in 90 × 60 cm slabs (each slab with its own layering, pits and tone; 3 mm joints, with relief);
  - the "Owns / COFFEE & MORE" sign has letters standing off a stone panel that hidden grazers wash with light, and a halo glows behind the letters;
  - dark "DRIVE THRU →" letters with a halo glow;
  - satin glass above the ceiling line;
  - continuous linear LED grazers at the foot of every stone face, for an even warm wash up to the parapet with no scallops;
  - a softly lit neighbouring shop;
  - olive trees with branching trunks and silvery leaves;
  - textured pavers, asphalt and neighbouring plaster.
- **Drive-thru lane:** a 3.9 m asphalt lane along the long wall, with a raised curb strip at the wall (the grazers sit in it), a median curb to the side street, a white edge line, arrows and painted "DRIVE THRU" lettering.
- **Car:** a white Nissan Patrol 2021 waits at the drive-thru window with its headlights on (layer 15_Car, file `car/Nissan_Patrol_2021.fbx`).
- **Shell, shopfront, drive-thru, kitchen, toilet:** from the CAD and photos.

| Layer | Contents |
|---|---|
| 01_Shell | walls, piers, column, toilet annex, roof |
| 02_Floors_Ceilings | marble-look floor, false ceiling at 370 cm, downlight holes, LED wall-washer slot |
| 03_Interior_Walls | white linings |
| 04_Partition | partition, floating oak wave and hidden LEDs, halo-lit logo, kitchen door, pass-through hatch |
| 05_Shopfront | angled glazing, black portal with backlit "Owns / COFFEE & MORE", entrance door |
| 06_DriveThru | window, canopy, "DRIVE THRU →" sign |
| 07_Counter | reception desk, bakery case and pastries, cashier, back counter, pendants |
| 08_Seating | window bar and stools, table and chairs, display shelves |
| 09_Kitchen_WC | kitchen counters, cooktop, sink, toilet fixtures |
| 10_Site / 11_Planters / 12_Exterior_Lighting | street, sidewalk, neighbours, street lamp, olive trees, uplights and base LEDs |
| 13_Lights / 14_Cameras | photometric lights (cd, Kelvin) and physical cameras |

## Rendering in 3ds Max

- **Night city:** `hdri/neuer_zollhof_2k.hdr` (Poly Haven, CC0; modern buildings at night) is set as the environment map at output 0.01, rotated 42°. Keep the `hdri` folder next to the script. In Arnold, plug it into a Skydome light. In V-Ray or Corona, use it in a Dome or Sun-Sky environment and lower its strength until the sky is deep navy.
- **Grazers:** the `Light_Grazer_*` lights are photometric rectangle lights lying along the foot of each wall, aimed up and tilted 12° toward the stone.

- LEDs, the logo halo and the signs are emissive materials. The script also adds small photometric "helper" lights behind them (names `Light_Wave_*`, `Light_Logo_Halo_*`, `Light_Partition_Wash_*`, `Light_Bakery_Case`), so the glow shows in any renderer. Delete them if your renderer lights well from emissive surfaces (Corona, V-Ray).
- Exposure: EV 4 on the exterior cameras, EV 5.5 inside. Lower the EV to brighten. Use a camera white balance of about 3500 K inside and 4300 K outside, so the 3000 K lights read warm but whites stay white.
- In Arnold, add a dim dark-blue Skydome light for the night sky.

## Assumptions to check on site

- **Building height 580 cm** is estimated from the photos; only the 370 cm ceiling comes from the drawings.
- **Front split** (narrow glass 62 cm, pier 40 cm, portal 162 cm) is read off the photos.
- **Drive-thru window** sill 95 cm, head 205 cm: assumed.
- Partition colours, the furniture beyond the CAD and the signage are design proposals.

## Rebuild from the CAD file

```bash
python3 tools/make_textures.py textures
python3 tools/build_scene.py cad/Owns_Cafe.dxf scene.json
python3 tools/mesher.py scene.json meshes.json
python3 tools/export.py meshes.json .
```

To re-render, run `tools/blender_scene.py` with Blender's Python (the `bpy` module) using the same flags as the final renders:

```bash
python tools/blender_scene.py meshes.json textures renders --hdri hdri/neuer_zollhof_2k.hdr --hdri_strength 0.01 --hdri_rot 42 --render all --samples 96 --fbx --blend
```

All dimensions live in `tools/build_scene.py` (cm), materials in `tools/materials.py`, and edge radii in `tools/mesher.py`.

## Credits

- Car: this work is based on "Nissan Patrol 2021" (https://sketchfab.com/3d-models/nissan-patrol-2021-9a2cda9f9a11474aa069e1895ff93443) by Nieve5677 (https://sketchfab.com/niev), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified: materials assigned, scaled to 5.17 m, decimated (`tools/prepare_car.py`). Keep this credit wherever the renders or model are shared.
- HDRI: "Neuer Zollhof" from Poly Haven (CC0).
- Interior textures: white_plaster_02, plastered_wall_04, smooth_concrete_floor leather_white, curly_teddy_natural (bouclé) and hessian_230 (jute) from Poly Haven (CC0). The moss is generated by tools/make_interior_textures.py.
