# Mapping a building (with or without a floor plan)

Everything starts in the visitor app at **Home sheet → Add a building** (also in Settings). Every way ends in a
normal DALIL map: search, routes, voice directions, and a position on the real map.

The screens, in order: `docs/mapping-round-2.png`.

| | You need | What you get | Position on the real map |
|---|---|---|---|
| **Import a floor plan** (photo or picture) | any picture of the plan: an exported drawing, a screenshot, or the evacuation plan on the wall | real walls, rooms and doorways | by matching two corners with the satellite photo (sets the size too) |
| **A DALIL map file** | the Mapper's export (CAD drawing or LiDAR scan) | the most detailed map | from the Mapper, or matched in the app the same way |
| **Draw it on the satellite photo** (new) | nothing but the building | its outline, the corridors you draw or walk, the places you tap | exact from the start: it is drawn on the real map |
| **Walk it** | a phone with a compass and step counter | the corridors you walked and the places you marked | GPS at the door, or matched with the satellite photo afterwards |

## Put it on the real map (the step that makes inside and outside agree)

A floor plan on its own floats: the app cannot show the blue dot in it, cannot say you are outside the building,
and cannot draw it on the street or satellite map. **Put it on the real map** fixes that for any map
(`app/placeui.js`, maths in `app/georef.js`):

1. **Corner 1 on your plan.** Drag the plan until the cross sits on a corner of the building, tap *Use this corner*.
2. **The same corner on the satellite photo.** Drag the photo until the cross sits on that corner of the roof
   (zoom in close), tap *It is this corner*. *Find the building* takes pasted coordinates or a maps link.
3. **Corner 2**, as far from the first as possible. Two corners fix the place, the direction and the size.
4. **Check the fit.** The plan is drawn in white over the photo with its size on the ground ("40 × 24 m"). Add a
   third corner to see how well they agree ("corners agree within 0.3 m"), or fine-tune by hand (0.5 m, 0.5°, 1 %).

Why a cross and not a tap: a fingertip hides the spot it is placing and is about 1 cm wide; moving the picture under
a fixed cross is exact to a pixel.

How exact: two corners 50 m apart, each placed within 0.5 m, give the direction within about 0.8° and the size
within about 1.5 %. Satellite imagery itself can sit a few metres off true position, so the map agrees with the
photo you matched (and with phone GPS, which is no better than a few metres).

Where it is used:
- **Import a floor plan**, step 3 (*Size and place*): the match replaces "walk to set the size" (still there as a
  second choice, with a typed length).
- **Maps on this phone** (Add a building): *Put it on the real map* / *Adjust its place* for any map you made or
  loaded, including Mapper exports. The building's other floors follow (same move, or through a shared lift or
  stairs code). *Share the map file* gives the file with its position; the Mapper reads it back with
  *Position from a map file*.
- **Walk it**, on the review screen: *Match two corners on the satellite photo* (works with no GPS at the door).

## Import a floor plan (photo or picture)

1. Choose the picture or take the photo. 2. Drag the 4 corners (a magnifier shows the exact spot under your
finger; *Use the whole photo* for an exported drawing). 3. Check the walls DALIL found; rub open any doorway it
closed. 4. **Match two corners with the satellite photo.** 5. Tap the rooms to name them. 6. Save.

The photo is straightened with smooth (bilinear) sampling, so thin wall lines stay clean. Limits: see
`docs/what-makes-dalil-different.md`.

## Draw it on the satellite photo (no plan at all)

For a building with no drawing anywhere. The roof is visible from above, so the building's outline is traced first;
it is already in the right place and at the right size, and everything else is drawn inside it
(`app/sketchui.js`, geometry in `app/sketch.js`).

1. **Find the building**: move the map until the cross is on it, type its name.
2. **Trace the roof**: cross on a corner → *Add corner*, round the building. *Square the corners* (on by default)
   makes the hand-tapped outline rectangular along the building's own grid.
3. **Corridors and places**:
   - *Corridors*: *Start a corridor here* → move along it → *Add point* at every turn → *End line*. Lines keep
     straight with the building, and a point near another line joins it exactly ("Joined to the corridor").
   - *Walk it*: stand where the cross is, tap *Walk it* and walk. Your steps draw the corridor on the photo
     (headings straightened to the building's grid, so an indoor compass that is 10° out does not matter). If the
     cross drifts, **drag the map back to where you really are**: everything walked since the last fix turns and
     stretches to end there, and the app learns your step length and compass error for the next stretch.
   - *Places*: cross on the spot → *Entrance · Room · Restroom · Elevator · Stairs* (one tap, named later by
     tapping the pin) or *Other, with a name*. A place beside a corridor is linked to it automatically.
4. **Save**. The review says if any place cannot be reached. *Add the next floor* keeps the outline and brings the
   lifts and stairs along, so the floors are joined.

The drawing is kept as you go (leave and come back: *Continue: <name>*), and a saved one can be reopened from
*Maps on this phone → Edit the drawing*.

What it cannot know: inner walls and room shapes (it maps where people walk). For those, use a floor plan or a
LiDAR scan.

## Walk it (smart walk v2)

1. Type the building, floor and **your height** (sets your step length: 0.415 × height). Stand at the main
   entrance, tap **Start** (GPS at the door puts the map on Earth).
2. **Walk along the middle of each corridor**, phone held flat in front of you.
3. At each place tap what it is: **Room · Restroom · Elevator · Stairs · Entrance**.
4. **Come back past places you added**: *"Back at Entrance 1? Tap to straighten the map"*. Every tap is a loop; all
   loops are solved together.
5. Lifts/stairs: **Change floor**.
6. **Finish → Check your map**: accuracy per floor (*Good* < 3 % drift, *OK* < 7 %, *Rough*, *Not checked yet*),
   **Match two corners on the satellite photo** (most exact) or nudge it by hand, names, **Save**.

Why it holds together: the compass is snapped to the building's grid (found from the whole walk), loops are solved
together by least squares, and turning on the spot is not counted as a step.

## LiDAR scan → Mapper (most detail without a drawing)

1. Scan one floor with a LiDAR scanning app (iPhone/iPad Pro). 2. Export **OBJ** or **PLY** in metres.
3. **Mapper → 3D scan**: the floor is found, the scan is cut at 1.3 m and 1.7 m, the cut becomes walls.
4. **Straighten**, draw missing glass with **Wall**, clear closed doors with **Opening**.
5. Add places, export, then give it its position in the app (*A DALIL map file → Put it on the real map*).
