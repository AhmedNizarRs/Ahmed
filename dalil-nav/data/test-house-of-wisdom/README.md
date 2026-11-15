# House of Wisdom, Sharjah: indoor map dry run (INTERNAL TEST ONLY)

The House of Wisdom (Foster + Partners, 2020) is **not a DALIL client or pilot**. This folder tests turning published
floor-plan pictures into a DALIL navigation map. Keep it out of anything public, such as sales material or open links.

**Sources.** Foster + Partners' "Ground floor plan" and "Mezzanine floor plan", published on ArchDaily (2021,
© Foster + Partners). `make_dxf.py` downloads them when it runs; the pictures are not stored in the repository.

## Rebuild

From `dalil-nav/`:

```bash
python3 data/test-house-of-wisdom/make_dxf.py
```

```bash
node data/test-house-of-wisdom/build-maps.cjs
```

The first command needs Pillow and numpy. The second drives the DALIL Mapper headless (Playwright).

## How it was made

1. **Walls from pixels** (`vectorize.py`):
   - bold lines (3 px and up: the four cores, the auditorium) become walls at any length;
   - medium lines (2 px) become walls only when 3 m or longer, so furniture stays out.
2. **Added by hand from the drawing** (`make_dxf.py`):
   - the façade (a thin curtain wall in the drawing), with three 2 m doorways: west (main entrance, per Foster),
     east, and the revolving door on the top edge;
   - the auditorium's front doorway;
   - on the mezzanine, the edges of the open voids over the reception and courtyard, and the meeting pod.
3. **Scale:** the drawings' 10 m bar = 120 px. The building comes out 59.7 m square, and the two floors are aligned on
   the four cores.
4. **Position on Earth:**
   - Location: Foster + Partners' Plus Code 8G94+9C8 (Al Juraina 1) = 25.31841 N, 55.50608 E, used as the façade centre.
     The Google Maps pin for the building falls within a few metres of it.
   - Direction: from satellite imagery. The roof is a square turned 16° from north, and its four dark roof squares sit
     over the four cores. Foster's "visitors enter from its western edge" picks which way round it goes, so plan
     "up" points to 16°.
   - The north and Makkah arrows printed on the published drawings are about 50° off the imagery, so they are not used.
   - Accuracy is about ±5 m and ±2°. It is not surveyed.
5. **The Mapper** builds the walkable grid, links the floors (lifts LIFT-NW/NE; stairs STAIR-NW/NE/C/SW/SE) and
   exports. All 21 ground-floor and 14 mezzanine places are reachable.

## What is certain and what is not

- **From the drawing:**
  - entrances, auditorium (tiered seats), courtyard garden, lifts and stairs in the cores, WC cubicles;
  - rooms with tables or desks: meeting room, study area, reading lounges, meeting pod;
  - book stacks.
- **Named from Foster + Partners' description, position read from the furniture (estimated):**
  - café, children's area, exhibition hall, reception desk.
- **Not placed, because the drawings don't show where they are:**
  - prayer room and women-only area (on the mezzanine, per Foster);
  - archive;
  - which core rooms are offices or plant rooms.
- **Not modelled as walls:**
  - glass walls (courtyard glazing), bookshelves and furniture. Routes can pass where shelves stand.
- **Arabic names:** drafts. They need a native-speaker check.

## To make it real

Ask the House of Wisdom for its CAD plans and a room list, survey the prayer room and women-only area, place DALIL
signs at the entrances, lifts and stairs, and check the alignment on site with a phone.
