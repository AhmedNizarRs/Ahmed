# Visitor app: original Phase 1 spec

> Historical: the first brief. The app has since been redesigned twice; the current design is in `redesign.md`,
> the moving arrow and camera line in `motion-and-camera.md`, site setup in `institution-setup.md`.
> The acceptance checks below are still covered by `npm test`.

Goal: the app a building's **visitors** use after DALIL has mapped that building. Match `design/visitor-app-mockup.png`.

## Stack (suggested)
- Phase 1 is an installable **PWA**: a single-page web app, mobile-first, that works offline once loaded. That's the fastest route to real users, because an NFC sticker opens a URL and needs no app-store install.
- Read `dalil-map` JSON files (`docs/map-format.md`). Bundle `data/dalil-map_*.json` as demo buildings, and add a "load map file" option for new buildings.
- Phase 2 (later): wrap it with Capacitor or rebuild in React Native for native NFC and background audio.

## Screens and features
1. **Home** (as in the mockup)
   - DALIL logo with the Arabic name, and an EN/ع language toggle (full RTL).
   - Search ("Search for a room, place, or service") across EN and AR names.
   - A scan icon that "scans" a DALIL tag. Use Web NFC where it's available, with a fallback list of nodes.
   - Category chips: Restroom, Elevator, Stairs, Prayer, Accessible. A chip picks the **nearest** matching point, measured by route distance from the current location.
   - Map card:
     - Plan walls drawn from `plan.walls`, with the route glowing in yellow.
     - "You are here" marker and destination pin.
     - Compass, turn banner (the next instruction and its distance), floor rail (floors from the loaded maps), recenter and fullscreen.
   - Bottom sheet: destination name, building · floor, ETA, distance, and the **Start Navigation** button.
   - Bottom nav: Home, Map, Saved, Settings.
2. **Navigation mode**
   - The map is tilted in 3D (CSS perspective) and rotated so the current heading points up.
   - A large instruction card. Next/previous step controls.
   - "Simulate walk" animation along `path`, for demos.
   - Voice reads each step aloud (Web Speech, with an Arabic voice when AR is selected).
   - `navigator.vibrate` on turns.
   - On node steps, an "I'm at this tag ✓" button.
   - An arrival screen at the end.
3. **Accessible mode** switches to the `routes.chair` routes. If there's no step-free route, say so clearly.
4. **Deep link:** `#at-P003`, or the NFC URL path, sets the current location.
5. **Saved** holds favourite destinations (localStorage).
6. **Settings:** language, voice on/off, large text, high contrast, reduce motion.

## Accessibility (non-negotiable)
- An `aria-live="polite"` region announces each step.
- All controls are labelled. Touch targets are 48 px or larger. The layout works fully with a screen reader and without the map.
- Contrast is AA or better. High-contrast mode is yellow on black.

## Acceptance
- Load the sample hospital. Search "prayer" and start navigation. The steps match `routes.walk["P001>P007"]`.
- Accessible mode to Clinic 2 shows "no step-free route" (Clinic 2 has a 70 cm door).
- Opening `#at-P013` sets the location to "Corridor East".
- Arabic UI is fully RTL and the Arabic steps read correctly.
- Add a Playwright test for these checks in `tests/`.
