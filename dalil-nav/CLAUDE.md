# DALIL — indoor navigation for large buildings

DALIL (دليل, "guide") is a building-accessibility venture. The physical product is a set of 3D-printed tactile clips (handrails, door handles) for blind and low-vision users. This repo is the digital layer, which works like GPS inside a building:

1. **DALIL Mapper** (`mapper/`) is the internal tool the DALIL team uses as a paid service. It turns a building's CAD floor plan into a navigation map.
2. **DALIL visitor app** (`app/`) is what the building's visitors use: search a place, get a route, and follow turn-by-turn voice directions. Phase 1 PWA is built (see below).

DALIL nodes are physical tags (tactile clip + NFC sticker + high-contrast code) at fixed points. Tapping one tells the phone exactly where the user is, so no beacons or batteries are needed.

## Owner
Ahmed Nazar is an interior architecture student and working designer (UAE). He works in AutoCAD in **centimetres**, uses Lovable and no-code tools, and prefers terse, structured, immediately usable output. Arabic and English must both be first-class (Gulf market, RTL).

## Business model (decided)
- **#1 CAD plans to navigation maps:** a one-off setup fee per floor. This is the Mapper, and it is built.
- **#2 Facility manager dashboard:** monthly subscription with wayfinding analytics, such as where people get lost. Not built.
- **#3 Hospitals** are the first market. Appointment SMS/WhatsApp messages include a route link.
- **Features that come with the package:** step-free/quiet route modes, a finder for essentials like the prayer room and wudu area, a "help me" button on nodes, and pre-visit route links.
- **Skip:** emergency exit routing. It's a life-safety liability.

## DALIL Mapper: current state (`mapper/index.html`, a single self-contained file)
- Input is DXF (a hand-written ASCII DXF parser covering LINE, LWPOLYLINE with bulges, POLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE, TEXT, MTEXT, nested INSERT blocks, and OCS mirroring). It can also take an image or PDF, which you calibrate and then trace walls on (the PDF route uses pdf.js from cdnjs).
- Units come from `$INSUNITS`. If that's missing, they're guessed from sheet text ("SCALE IN FEET") or from a plausible building size.
- Layer roles are wall, door, mixed (walls + doors), context and hidden. They're auto-suggested from layer names. If the names are just numbers, they're guessed from geometry: the layer with the most arcs = doors, closed squares = columns, long straight layers = walls.
- Walkable grid: wall segments are rasterised into an occupancy grid inflated by a clearance (walking 0.25 m, wheelchair 0.40 m). The cell size is adaptive, 10 cm or more, with a cap of about 1.5M cells.
- "Ignore lone lines across openings": single 1.2–3.6 m lines that span between walls with no parallel wall face are dropped (door frames or thresholds in record drawings). Lines on the building envelope are protected by an outside mask built with a 0.95 m seal.
- "Keep routes indoors": cells reachable from outside, using a 2.5 m seal, are blocked.
- Opening tool: the user drags across a blocking line to clear a 0.9 m gap.
- Routing: A* (8-connected, no corner cutting) for testing. Dijkstra from each source for the export. Paths are smoothed with string-pulling over line-of-sight on the inflated grid.
- Instructions in EN and AR:
  - The first leg is given as a clock direction relative to the node's `facing`.
  - Turns: under 20° = straight, 20–55° = bear, 55–145° = turn, over 145° = turn around.
  - When the route passes a DALIL node (within 1.6 m), the step reads "You are at DALIL node X. Tap it to confirm."
  - Arabic plural rules are handled (متر / مترين / أمتار / متراً, and the same for خطوة).
- Export: `dalil-map_<building>_<floor>.json` (see `docs/map-format.md`), an NFC tag CSV, and a project save/load file.
- The Mapper is published as a claude.ai artifact. In that sandbox, downloads and TTS go through `window.claude.use('downloads'|'tts')`, with plain-browser fallbacks.
- Plan rotation: "Rotate plan" / **Straighten** (dominant wall angle) for drawings in rotated survey coordinates. Saved in the project (`rot`).
- Floor links: a point's "Floor link" code (e.g. `LIFT-W`), exported as `link`. Same code on each floor = vertical connection.
- **Find places in drawing** (`autoPlaces`): reads room-number labels (layers like *RNUM/VNUM/ROOM*), lift/stair labels (E101, S102, "ELEV", "STAIR", مصعد, درج), words (toilet, prayer, café, entrance…) and symbol blocks on icon layers (men/women/bath/lactation). Merges lift/stair banks within 4 m, then moves points stuck in closed pockets (lift shafts) to the nearest reachable spot. Keeps block insert names (`rawInserts`) for this.
- **Closure** tool: drag across a corridor; exported as `closures` (the app routes around them; Mapper test routes ignore them).
- Export v2 (default): `nav` walkable grids (RLE, base64) for on-device routing, no stored routes. "Also store every route" restores the v1 behaviour (files grow with places²).
- **World position** (export panel): two points + their lat/lng → `geo` (origin, bearing, scale) via `geoFromTwo`; saved in the project. Warns if scale is >5% off 1.
- Projects now save the guessed units (`guessU`); older projects re-guess on open (fixed a bug where unit-less drawings reopened 30× too small).
- Limits: one floor per project file (multi-floor buildings = one export per floor, joined by `link` codes).

## Visitor app: current state (`app/`, PWA, no build step)
- Files: `index.html`, `styles.css` (design system + all screens), `app.js` (state, pages, navigation), `i18n.js` (EN/AR strings, icons), `mapview.js` (floor-plan renderer), `router.js` (on-device routing), `tracker.js` (compass + step counting + route matching), `camera.js` (camera guide line, QR reading), `providers.js` (street-map providers + failover), `outdoor.js` (Getting here map), `config.json` (per-institution settings), `sw.js` (offline cache, bump `VERSION` on any app change), `manifest.webmanifest`, `maps.json` (bundled maps, pointing at `../data/`), `vendor/` (MapLibre BSD-3, qrcode MIT, jsQR Apache-2.0), `icons/`, `fonts/`.
- Serve the **project folder** (not `app/` alone), because the bundled maps live in `../data/`: `npm run serve`, then open `http://localhost:8080/app/`. Deploy `app/` and `data/` side by side on **HTTPS** (camera and motion sensors need it). Client setup: `docs/institution-setup.md`.
- **Design (redesign 2, Nov 2026, "Follow the yellow line", `docs/redesign.md`):** light by default (dark, same-as-phone, high contrast in Settings), big type, 56–68 px buttons, text size Normal / Large / Extra large (`ts-large` / `ts-xl` on `<html>`, everything in rem). One page at a time with a Back button: `#pgHome`, `#pgSearch`, `#pgRoute`, `#pgWhere`, `#pgMap`, `#pgSettings`, `#pgOutdoor`, `#nav`; `go(page)` / `back()` keep a stack mirrored in `history` (the phone's back button works). No hidden gestures. Help (`[data-help]`) on every page: call the building only if `config.help.phone` is set, take me to the help desk, scan a sign, a card for staff in EN + AR. Home tiles = the building's essentials with the walk to the nearest. Settings is a row on Home (no corner icon).
- **Navigation:** black sign with a giant yellow arrow; Map or Camera view; Stop · Back · Repeat · Next (three controls on small phones with big text; the Steps list jumps to any step). Modes in the status line: `steps` (no sensors: tap Next), `track` (sensors), preview (simulated, only from the Steps list). Tracking (`docs/motion-and-camera.md`): permission asked in the Start tap; `Follower` learns `beta` (compass → plan) from the walk or from `geo.bearing` / a saved calibration (`dalil.cal`), moves the position per step (pace: slow 0.55 / normal 0.68 / fast 0.78 m), auto-advances steps, says "In 5 m: …" before turns, detects wrong way, snaps at corners. DALIL signs (NFC, QR, "Yes, I'm at …") within 2.5 m of the route set the position; elsewhere they re-plan from there. Floor changes wait for "I'm on Level 2 now".
- `state.viewMap` = floor being viewed on the Floor map; `state.map` = floor the visitor is on (browsing never moves the visitor). Recents `dalil.recent`, frequent `dalil.freq`, recent searches `dalil.searches`, settings `dalil.settings` (v2; v1 theme/large migrated).
- Usage counts: `analytics` in `app.js`, only when `config.analytics.endpoint` is set; no ids, positions or names; time rounded to the hour.
- Map view: the plan is an SVG in metres inside a CSS 3D camera (perspective + tilt + rotation). Markers lie flat on the floor plane (upright ones get sorted behind it in Chromium). Route = yellow line with a dark casing (no glow); destination = the logo's ring-and-dot.
- Step → path position: steps carry text only, so each "walk N m" leg is placed by its distance, scaled so the legs add up to the real path length (`buildSteps`). Turn icons come from the English step text.
- Deep links: `#at-P013`, `#at-P001&to-P007`, `#b=<building>&f=<floor>&at-P001`, `#t/<b>/<f>/<p>`, and the NFC path `/t/<b>/<f>/<p>` (the service worker serves the app for it; a server needs the same rewrite).
- "Where are you?" page: QR scan of DALIL signs (camera; `BarcodeDetector`, else jsQR), Web NFC on Android Chrome, or a list. The "Avoid stairs" switch on the route page (and in Settings) = step-free mode (`routes.chair`).
- Multi-floor: destinations are keys `<floorId>|<pointId>` (`state.toKey`). `planRoute` joins two floors through points sharing a `link` (lift = step-free, stairs walking only), `planSteps` merges the legs with a "Take the lift/stairs …" step, and navigation swaps the floor plan mid-route. Floor order = order in `maps.json` (bottom to top).
- On-device routing: `router.js` (`Router`: decodes `map.nav`, applies `closures`, one cached Dijkstra field per start, path by descending the field, same string-pulling and EN/AR wording as the Mapper). `routeFor(map, A, B)` uses stored routes when present, else the router. Leg 2 of multi-floor plans searches from the destination (`fromEnd`) so all lifts/stairs share one field.
- Floor map page: tap the floor to drop a pin (`<floor>|@x,y`): "Directions here" or "Save as my spot" (`@spot`, localStorage `dalil.spot`; in Saved and in search "my spot"). Place names on the map appear only when zoomed in.
- Share route: link (`#b=…&f=…&at-…&to-<key>`) + QR code (`vendor/qrcode.js`, MIT) + Web Share. Kiosk mode: `#kiosk&…` (fixed location, QR to continue on a phone, 90 s idle reset).
- **Getting here** (`outdoor.js`, only for maps with `geo`): MapLibre (vendored, lazy) + the provider list in `providers.js` (OpenFreeMap, VersaTiles free; Esri, MapTiler, Stadia, Mapbox with the client's key in `config.json`), failover when a style can't load or its tiles keep failing, ending on a plain map that still shows walls, outline (`building_context` or hull) and entrances; GPS on tap; Google/Apple Maps links. Home shows the distance to the building only if location permission was already granted. MapLibre's CSS sets the container to `position: relative`, so `#outMap` is positioned by id.
- Providers, licences and accuracy: `docs/data-providers.md`.
- `docs/pointr-comparison.md`: feature map against Pointr and the next steps.
- `window.DALIL_APP` exposes state, settings, `nav`, `tracker`, `analytics`, `page()`, `go()`, the spoken-text log, `views()`, `outdoor()`, `camera()` for tests.

## Test data (`data/`)
- `hospital-bldg1000-floor1.dxf`: a real hospital record drawing (Fort Sam Houston, TX). It's in feet, has no INSUNITS, and its layers are numbered: 1 = exterior walls, 2 = columns, 26 = doors (plus header lines), 27 = windows, 28 = walls, 18 = title block. The source is Georgia Tech's robot-lab page, which has floors B and 1–8.
- `dalil-project_hospital-building-1000_ground.json` is the matching Mapper project with 8 points. `dalil-map_hospital-building-1000_ground.json` is its export (56/56 walking and 56/56 wheelchair routes).
- `dalil-map_sample-hospital_ground.json`: the synthetic sample (14 points, including toilets, prayer room and lift). Clinic 2 has a 70 cm door, so the wheelchair route to it must fail.
- `test-office-mm.dxf`: a test file with mm units, site coordinates, a bulge arc, nested and mirrored blocks, and MTEXT.
- `test-calpoly-library/`: dry-run project on Cal Poly's Kennedy Library, Levels 1–2 (public drawings, internal testing only, never shown as a client). `build-maps.cjs` drives the Mapper headless to rebuild both floors (then run `georef.py overture_kennedy.json` to add `geo` and the Overture outline; needs `pip install pyproj shapely`); its README lists the findings.

## Tests
`tests/test_mapper.py` drives the Mapper headless with Playwright (Chromium). Run it with `pip install playwright && playwright install chromium && python tests/test_mapper.py`. Keep it green after any Mapper change.
`tests/test_visitor_app.mjs` covers the visitor app's acceptance checks (Node Playwright, starts its own local server; simulates the compass and step sensors, uses Chromium's fake camera and a generated QR-sign video, and stubs the map providers to test failover). Run it with `npm install && npx playwright install chromium && npm test`. Keep it green after any app change.

## Design language
- Visitor app: redesign 2, Nov 2026 ("Follow the yellow line", `docs/redesign.md`): white surfaces, black text, brand yellow #FFC700 only for "this way" (route, arrow, primary buttons, tile icons); directions on a black sign. Logo unchanged. Tokens at the top of `app/styles.css`. Before/after: `docs/redesign-2-before-after.png`. The original mockup is `design/visitor-app-mockup.png`.
- Mapper: clean black/white/blue (#0B0F14 / #FFFFFF / #1F6FEB). No brown.

## Rules
- Bilingual EN/AR everywhere, with RTL handled properly.
- Accessibility first: screen-reader live regions for steps, large text, high contrast, haptics, and voice.
- Never claim certification or compliance with Dubai/Sharjah codes. Wording is "preparation" or "supplementary".
- Keep the Mapper a single file with no build step unless there's a strong reason to change that.
