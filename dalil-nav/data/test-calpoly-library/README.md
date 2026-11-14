# Test project: Robert E. Kennedy Library, Cal Poly (Levels 1–2)

A dry run of the DALIL service on a real university building, before doing it for a client.

> **Internal testing only.** These are Cal Poly's public facilities drawings and directory maps.
> Cal Poly is **not** a DALIL client, pilot or partner. Don't show it as one; in a demo, say
> "public drawings used for testing".

## What the "client" gave us (inputs)

| File | What it is |
|---|---|
| `building035-0_floor1.dxf`, `building035-0_floor2.dxf` | CAD plans (saved from Cal Poly's DWG), inches |
| `Level1-Map-and-Directory.pdf`, `Level2-Map-and-Directory.pdf` | Official 2025 visitor maps with room names |

## What we produced (outputs)

| File | Use |
|---|---|
| `dalil-map_kennedy-library-cal-poly-test_level-1.json` / `_level-2.json` | Navigation maps loaded by the visitor app |
| `dalil-project_…_level-1.json` / `_level-2.json` | Mapper projects: open in `mapper/index.html` to see or edit the points |
| `dalil-nfc-tags_…csv` | URLs to write on the NFC tags (5 tags: entrance and lifts) |
| `preview_level-1.png` / `preview_level-2.png` | The plans with all points, as the Mapper shows them |
| `build-maps.cjs` | Rebuilds everything above from the DXFs: `node data/test-calpoly-library/build-maps.cjs` |
| `georef.py`, `overture_kennedy.json` | Adds the real-world position (`geo`) and Overture's building outline to both maps. Run after `build-maps.cjs`: `python data/test-calpoly-library/georef.py data/test-calpoly-library/overture_kennedy.json` |

**Level 1:** 26 places, 650/650 walking routes, 650/650 step-free routes.
**Level 2:** 32 places, 992/992 walking routes, 870/992 step-free (see finding 1).
The two floors are joined by 2 lift banks (step-free) and 5 stairways, so the app can route from
any place on Level 1 to any place on Level 2.

## How it was done

1. Loaded each DXF in the Mapper. Units came from the file (inches). Layer roles were suggested
   correctly from the names (A-WALL, A-GLAZ, A-COLS = wall; A-DOOR = door).
2. Level 1 is drawn in survey coordinates, turned 11.3°. The new **Straighten** button squares it.
3. Places came from the drawing itself where it labels them (room numbers, lifts E1xx/E2xx,
   stairs S1xx/S2xx, toilet icons). The entrance, service desks and gallery came from the official
   map, fitted onto the CAD with the lifts and stairs (about ±2 m).
4. Lifts and stairs that line up on both floors got the same **floor link** code (LIFT-W, LIFT-E,
   STAIR-C, STAIR-W, STAIR-NW, STAIR-NE, STAIR-SE). Checked: the pairs line up within 1.5 m.
5. Built the walkable map, exported, loaded both floors in the app, tested routes between floors.

## Findings: what a site visit would have to check

1. **Classroom 216A has no step-free route.** It is entered through a corner door from a small
   vestibule; in the drawing that doorway is narrower than the 0.8 m wheelchair clearance.
   Measure the door on site. The official map confirms the corner door.
2. **Put lift tags in the lift lobby, not in the shaft.** The first Level 2 lift point sat inside
   the closed lift shaft and nothing could reach it. Moved 2 m out into the lobby.
3. **Which way people face when they step off the stairs is unknown.** The first instruction after
   the stairs ("Turn to your 11 o'clock") uses a default direction. Set each stair's facing on site.
4. **The CAD has an older room-information layer.** It disagrees with the 2025 map in places
   (e.g. it lists 115 as a restroom; it is now the Digital Scholarship Studio). The room-number
   labels match the 2025 map, so those were used.
5. **Arabic names are drafts.** They need a native-speaker check.
6. **The courtyard is outdoors**, so it is not a destination (routes stay indoors).

## Lesson for the product

Map files used to grow with the square of the number of places (every pair had a stored route:
1.7–2.1 MB per floor here). **Done:** the app now works out routes itself from the walkable grid,
so each floor is about 150 KB however many places it has. The Mapper's **Find places in drawing**
also finds all of the places above automatically (70 on Level 1 in about 2 s), including moving the
Level 2 lift points out of their shafts.

## Placed on the real map

- Level 1 comes from the CAD's own California State Plane coordinates, so its position is exact: main entrance at 35.30158° N, 120.66358° W.
- Level 2 is fitted to Level 1 on its 7 lifts and stairs (median error 1.0 m).
- Overture Maps' outline of "Robert E. Kennedy Library" (5 floors, 14.4 m, from OpenStreetMap and Microsoft) sits a median 2.3 m from our outline. The difference comes partly from site walls in the drawing.
