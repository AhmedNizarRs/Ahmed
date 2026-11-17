# What makes DALIL different (Nov 2026)

A University of Sharjah contact told the founder: don't copy another app; if you take an idea, make it better. This page lists what the big indoor-navigation products do, where they leave gaps, and what DALIL does about each gap. It is based on a short web search (sources at the end), not a full market study. Check any claim here before you use it in a pitch.

## What the big products do

| | Pointr | MazeMap | Mappedin / Esri |
|---|---|---|---|
| Making the map | From the building's floor plans; Pointr's AI tool MapScale keeps maps updated | Built from floor plans by MazeMap | Mappedin: AI makes maps from floor-plan files in minutes. Esri: Floor Plan Editor (web) |
| Live "blue dot" | Needs a positioning technology: BLE beacons, Wi-Fi or geomagnetic | Plugs in a positioning provider (Wi-Fi, BLE, geomagnetic) | Depends on the deployment |
| Visitors open it | In the hospital's app (e.g. Epic MyChart), or by QR/NFC ("Pointr Express") | App and web | App and web |
| Hospital focus | Strong (Epic integration, routes to appointments, "mark my car") | Universities and hospitals; "nearest toilet" | Malls, venues, campuses |

**What they have in common:** they need floor-plan files plus either hardware or a positioning partner, and a professional team to set them up. That suits big hospital groups with IT budgets. It doesn't suit the many Gulf buildings that have no usable CAD file and no budget for beacons.

## Where DALIL is different

1. **A map from the plan on the wall, in minutes, on a phone.** Almost every building has a fire evacuation plan on the wall near the lifts and stairs. In DALIL you photograph it, drag 4 corners, and the app finds the walls. It drops room names, symbols and the coloured escape arrows. You walk a few metres to set the size and tap the rooms to name them. No CAD file, no laptop, no mapping team. (`app/snapplan.js`; Home → *Map from a photo of the wall plan*.) The competitors we found start from floor-plan *files*.
2. **No beacons, no batteries.** Position comes from steps and compass, checked by the visitor:
   - "Are you at Toilets (men)?" near the end;
   - "Not here?" during the route;
   - the place you arrived at becomes the confirmed start of the next route;
   - DALIL signs (QR/NFC) wherever exact position matters.
   
   Indoors, GPS can only show its circle and never moves you; it pulled the founder 12 m back on a test walk. This is honest about what a phone can do. Competitors sell accuracy that comes from hardware.
3. **Made for the Gulf:**
   - search finds the nearest **men's or women's** restroom or prayer room;
   - you set your choice once, or say it in the search ("ladies toilet");
   - at a prayer room the app shows the **Qibla** direction;
   - Arabic search ignores harakat and letter variants (أ/ا, ة/ه);
   - every screen works right-to-left.
4. **Plain words for everyone.** "Go straight", "Turn right", "Go a little left", with no clock faces or "bear right". The clock is an option for blind users who are taught it. Small bends are folded into the walk, so routes have about a third fewer steps (Fine Arts: 9.8 → 6.4 per route).
5. **Accessibility is the company's whole focus:** voice on every step, large text, high contrast, haptics, step-free routes, and tactile signs.
6. **Easiest route, not just the shortest.** Routes keep to the middle of corridors and away from walls, furniture and door frames. That adds at most about 1% to the distance. (We also tried a "fewest turns" search. On our test buildings it found the same corners at twice the time, so we dropped it; the corridors already decide the turns.)

**What is not different:** Pointr also opens maps by QR/NFC without an app, and MazeMap also finds the nearest toilet. DALIL's difference there is the men's/women's choice, the Arabic search and the plain wording, not the feature itself.

## Ways to map a building in DALIL, easiest first

| Method | What you need | Time per floor (estimate) | Accuracy |
|---|---|---|---|
| **Photo of the wall plan** (new) | A phone, the evacuation plan on the wall | 10–15 min | As good as the drawing; size from one walk |
| CAD file → Mapper | The DWG/DXF from the facilities team | 30–60 min | Best (the real drawing) |
| LiDAR scan → Mapper | iPhone/iPad Pro with LiDAR | 20–40 min walking | ±5 cm on walls |
| Walk it (survey v2) | A phone | 20–40 min walking | 3–7 % drift, corrected at loops |

The times are estimates, not measured on a real building yet.

## Limits to be honest about

- A photo of a wall plan is only as good as the drawing. Evacuation plans are often simplified and sometimes out of date. Before using a map with visitors, walk the main routes once.
- Some plans draw doors as thin lines across the opening. The app may read those as walls; the *Open a doorway* tool fixes them, and the app lists any place it can't reach.
- Without signs, position from steps and compass drifts a few metres over long walks. The "Are you at…?" check and DALIL signs are how DALIL deals with that. They are part of the product, not an extra.

## Next experiments

1. Photograph the real evacuation plans at Fine Arts and B3. Time the whole flow and compare the result with the maps traced from the PDFs.
2. Five visitors, three routes each, with signs at two junctions. Count how many arrive without asking anyone.

## Sources (Nov 2026)

- Pointr, "Pointr Wayfinding is live in the Epic Showroom" (pointr.tech/blog/pointr-in-epic-showroom): MyChart deep links, restrooms, Pointr Express via QR/NFC, MapScale.
- Pointr, "Indoor Mapping and Navigation for Hospitals" (pointr.tech/blog/indoor-mapping-and-navigation-for-hospitals-healthcare-facilities): maps-only vs. blue dot; BLE, Wi-Fi, geomagnetic positioning.
- MazeMap, "Indoor Positioning for Blue-Dot Navigation" (mazemap.com/solutions/indoor-positioning): positioning providers (Wi-Fi, BLE, sensor fusion, geomagnetic).
- Mappedin, "AI Mapping" (mappedin.com/ai-mapping): maps from floor plans in minutes.
- Esri, "Easy Indoor Map Making with Floor Plan Editor" (esri.com/arcgis-blog).
