# Moving arrow and camera guide line: how they work

Code: `app/tracker.js` (sensors, steps, route matching), `app/camera.js` (camera, guide line, QR), wiring in
`app/app.js` (navigation section). No GPS indoors, no beacons: this is **dead reckoning** (compass + step count)
snapped to the route and corrected at DALIL signs. It is an estimate, and the app says so.

## Sensors

| What | Browser source | Notes |
|---|---|---|
| Orientation | `deviceorientationabsolute` (Android Chrome), `deviceorientation` + `webkitCompassHeading` (iPhone) | Turned into the W3C rotation matrix. The direction you face is the level direction of the screen's top edge plus the back camera, so it works with the phone flat, tilted or upright. |
| Steps | `devicemotion` → `accelerationIncludingGravity` | Smoothed magnitude minus its slow average; one step per peak (> 1.15 m/s², at least 280 ms apart). A lone bump is ignored until a second step follows. |
| Permission | `DeviceOrientationEvent.requestPermission()` / `DeviceMotionEvent.requestPermission()` | Asked inside the Start tap (iPhone requires a tap). Denied or no sensors → "Step by step · tap Next as you go". |

Sensors and the camera need **HTTPS** (or localhost).

## From compass to floor plan

The plan's own "up" is not north. `beta` = the compass bearing of the plan's +y axis.
- **Prior**: the map's `geo.bearing` (minus `geo.declination` if the map gives it), when the phone has an absolute
  compass; or what this phone learned on this floor in the last 30 days (`localStorage` `dalil.cal`).
- **Learned from the walk**: on straight parts of the route, each step gives `beta = route direction − 90° + heading`.
  A running circular mean (recent steps count most). Readings 50° or more away from the estimate are set aside.
  Ten such readings in a row that agree with each other, and are not a U-turn, replace the estimate.
  This also absorbs magnetic declination and steady magnetic disturbance from the building.
- The arrow is "live" when there is a trusted prior or after about 4 steps of learning. Until then the sign shows
  the step's turn and the status says "Walk a few steps to line up the arrow".
- Floors: if both maps have `geo`, the estimate turns by the difference of their bearings; otherwise it is learned again.

## Moving along the route

- Each step moves you `stride × cos(angle between where you face and the route)` along the current leg, never backwards.
- Stride by walking pace (Settings): slow 0.55 m, normal 0.68 m, fast 0.78 m. Re-learned at DALIL signs
  (distance walked ÷ steps, between 0.45 and 0.95 m).
- **Wrong way**: three steps facing more than 120° away from the route stop progress and say "Wrong way · turn around".
- **Corners**: turning onto the next corridor within 6 m before a corner snaps you to it; still facing the old
  direction holds you at the corner (the arrow then points round it).
- Steps move on by themselves; a heads-up "In 5 m: Turn left" is spoken and buzzed before each turn, floor change
  and arrival. Floor changes wait for "I'm on Level 2 now" (the web has no barometer).
- **DALIL signs and tags** (NFC tap, QR scan, or "Yes, I'm at …"): within 2.5 m of the route they set the position
  exactly; anywhere else in the building they plan a new route from there.

## Camera guide line

- Rear camera (`getUserMedia`, `facingMode: environment`), full view, canvas on top.
- Route points ahead (up to 28 m) are placed on the floor 1.35 m below the phone, rotated into the compass frame
  with `beta`, then projected with the phone's rotation matrix. Focal length from a 66° field of view across the
  long side of the picture and the cover scaling of the video. Parts behind the camera are clipped.
- Drawn: a 0.6 m yellow ribbon with dark edges, arrows every 1.5 m gliding forward (still with Reduce motion),
  the destination as a ring and a post with its name (or "To Level 2" at the lift).
- If the line is out of view: an edge arrow and "The line is to your left / right", "Turn around to see the line",
  or "Point the camera at the floor ahead".
- It also reads DALIL sign QR codes every 0.45 s: `BarcodeDetector` where available (Android Chrome), else jsQR.
- Needs the motion sensors; without them the app explains and stays on the map. Not offered in kiosk mode.

## Accuracy: what to expect

- Heading: phone compasses are often 5–20° off indoors near steel and electrics. Learning from the walk removes
  the steady part; brief disturbances pass through the smoothing.
- Distance: step counting is usually within about 5–10% on a normal walk, worse when shuffling, pushing a
  wheelchair (few or no detectable steps: use Next) or on stairs (ignored during floor changes).
- So position drifts by a few metres per 50 m between signs. Corners and signs remove it. Place DALIL signs at
  decision points (lifts, junctions, entrances) and keep straight runs between signs under about 40 m.

## Field test protocol (real phones, real building)

1. Serve the app over HTTPS (any static host). Use one Android phone (Chrome) and one iPhone (Safari).
2. Print the tag URLs from the Mapper's NFC CSV as QR codes; put them at the entrance, lifts and a junction.
3. For 5 routes (straight, two turns, a floor change, a long corridor, back the way you came), record:
   - the moment "Following your steps" appears;
   - the step where the arrow first points wrong by more than 30°;
   - the distance error at each turn, paced against the plan;
   - whether the heads-up came before the turn;
   - whether wrong way fired correctly and only then.
4. Camera: hold the phone at chest height and note where the ribbon sits relative to the real corridor centre
   at 3 m and 10 m. If it is consistently off, change `CAM_HEIGHT` or `CAM_FOV` in `camera.js`.
5. Repeat with Reduce motion, Arabic and extra-large text. Log results in `docs/field-tests/` (new folder).
