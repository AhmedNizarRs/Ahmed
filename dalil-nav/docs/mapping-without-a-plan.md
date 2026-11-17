# Mapping a building that has no floor plan

Two ways, both ending in a normal DALIL map (search, routes, voice directions, world position).

| | **A. LiDAR scan → Mapper** | **B. Smart walk (visitor app)** |
|---|---|---|
| Phone | iPhone / iPad **Pro** (LiDAR) | any phone with a compass and step counter |
| What you get | real walls, rooms, doorways | the corridors you walked + the places you marked |
| Accuracy | about ±5 cm on walls | ~1–3 % of the distance walked once loops are closed (snapped to the building grid) |
| Time | ~10–20 min per floor of scanning + 10 min in the Mapper | as long as walking every corridor once and coming back |
| Best for | paid client work, anything that needs room shapes | a quick first map, buildings you can't scan |

## A. LiDAR scan → Mapper (most accurate)
1. **Scan** one floor with a free LiDAR scanning app (for example Scaniverse or 3D Scanner App; check the app's current export options). Walk slowly along every wall, keep the phone at chest height, point it at the walls (not the floor), and include every room you want routable. Glass is invisible to LiDAR.
2. **Export** the scan as **OBJ** (mesh) or **PLY** (mesh or point cloud). Keep it in metres (the apps' default).
3. **Mapper → 3D scan** → pick the file. The Mapper finds the floor (the busiest height at the bottom), cuts the scan at **1.3 m and 1.7 m** above it — above desks and counters, below door heads — and turns the cut into walls on a `SCAN-WALLS` layer. Up axis is detected (Y-up, which iPhone apps use; Z if clearly thinner).
4. Check it: **Straighten** if the scan is turned; draw missing glass walls with **Wall**; clear a door that came out closed with **Opening**.
5. Add places (**Point**, or **Find places**), the **World position** (two points + lat/lng), and export as usual. One scan per floor; join floors with lift/stairs **Floor link** codes.

## B. Smart walk (no plan, no LiDAR)
In the visitor app: **Home sheet → Map a building by walking it**.
1. Type the building, floor and **your height** (sets your step length: 0.415 × height). Stand at the main entrance, tap **Start** (it asks for motion; GPS at the door puts the map on Earth).
2. **Walk along the middle of each corridor**, phone held flat in front of you, at a normal pace.
3. At each place tap what it is: **Room · Restroom · Elevator · Stairs · Entrance** (one tap; names come later). Or **Add a place with its name** if you want to type the sign now.
4. **Come back past places you added.** When you are near one, the app asks *"Back at Entrance 1? Tap to straighten the map"*. Every tap is a loop; all loops are solved together. Aim for at least one loop per floor (out and back counts).
5. Lifts/stairs: stand at them and tap **Change floor**; on the new floor carry on. Going back down continues the old floor from the same lift.
6. **Finish → Check your map**:
   - **Accuracy per floor:** *Good* (< 3 % drift), *OK* (< 7 %), *Rough*, or *Not checked yet* (no loop closed).
   - **Line it up with the satellite photo** (with GPS): turn ±1°/5°, move 1 m, scale ±2 % until the corridors sit inside the building.
   - **Names:** type each place's sign name.
   - **Save the map** → usable at once on the phone; **Share the map file** to publish it.

### Why the walk is now accurate
- **Compass drift indoors** (10–30° near steel and wiring) is removed by snapping: the building's grid is found from your whole walk (dominant heading modulo 90°) and every step within 20° of it is snapped. In tests a 120 m loop with a compass error growing to 15° closed exactly; the old method missed by 5.9 m (4.9 %).
- **Loops are solved together** (least squares on the step vectors with every loop as an exact constraint), so overlapping loops share the correction instead of undoing each other.
- **Turning on the spot** no longer counts as walking forward.
- What it can't know: walls and room shapes (it maps where you walked), and the building's true north (fixed by the satellite line-up or the GPS at the door).


## C. Photo of the wall plan (Nov 2026, easiest)

Almost every building has a fire evacuation plan on the wall near the lifts and stairs. Home → *Map from a photo of the wall plan*:
1. Take the photo.
2. Drag the 4 corners.
3. Check the walls DALIL found; rub open any doorway it closed.
4. Walk a few metres to set the size, or type one known length.
5. Tap the rooms to name them.
6. Save.

The whole flow runs on the phone (`app/snapplan.js`); see `docs/what-makes-dalil-different.md` for limits.
