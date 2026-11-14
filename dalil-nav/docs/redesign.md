# DALIL visitor app: redesign (November 2026)

## 1. Audit of the previous app

| # | Problem | Why it mattered |
|---|---|---|
| 1 | **Start Navigation was below the fold.** Home stacked search, 5 chips, location, a map card, a floor rail and the destination sheet; on a phone the sheet sat behind the tab bar. | The single most important action needed scrolling. |
| 2 | **Map squeezed into a card.** The plan was a small tilted preview; a separate Map tab held the real, tappable map. | Two maps, two mental models; tapping a spot needed a tab change. |
| 3 | **Four tabs for one task.** Home / Map / Saved / Settings, for an app whose job is "find → go". | Clutter and extra taps; Saved was a dead end away from search. |
| 4 | **"Accessible" chip mixed with destinations.** A route mode sat among Restroom/Elevator/Stairs/Prayer. | Looked like a category; its state was easy to miss. |
| 5 | **Floor rail moved the visitor.** Tapping a floor changed where the app thought you were. | Browsing another floor teleported you; routes were wrong afterwards. |
| 6 | **No recents, no frequent places, no recent searches.** | Returning visitors had to search again every time. |
| 7 | **Search was a drop-down over the map**, with no filters, no grouping by floor and a one-line empty state. | Hard to scan in a big building; no recovery hint. |
| 8 | **Destination card lacked facts**: no room number, no step-free availability until you toggled a mode. | Users found out about access problems late. |
| 9 | **Navigation looked live but wasn't.** Nothing said positions are step-by-step (no indoor positioning), and "Simulate walk" looked like the real thing. | Could mislead people into trusting a moving dot. |
| 10 | **Nav panel too tall**: the position marker sat hidden behind it on phones. | The key element of navigation was invisible. |
| 11 | **No loading or failure state.** If maps failed, the sheet showed an error string. | Blank or broken first impression. |
| 12 | **Toast on every open** ("You are at …"). | Noise. |
| 13 | **Heavy glows** (route glow, button glows, background aurora). | Looked generic; reduced map legibility. |
| 14 | **Only one theme**, no daylight option. | Dark UI in bright corridors is hard to read. |
| 15 | **Bidirectional text bugs**: Arabic names with digits rendered scrambled in LTR rows. | Unreadable labels. |
| 16 | **Map buttons inside `role="img"`** and labels covering the plan when zoomed out. | Screen-reader and touch problems. |
| 17 | **One 1,100-line `app.js`.** | Hard to change safely. |

## 2. Concept: "the lit path"

The building is quiet graphite. The only warm light is the route, in DALIL's own safety yellow (#FFC700, unchanged from the product and logo). The logo's parts become the interface's signs: its **ring and dot** is the destination marker, its **bar** is the route line. The map is the canvas of the app; everything else floats on it and gets out of the way.

Choices that follow from that:
- **Map first, one panel.** A full-screen map and one bottom sheet (peek / half / full, draggable, keyboard-operable) replace the four tabs. Settings is a single page from the top bar. On wide screens the sheet docks as a side panel.
- **Yellow means "go".** Yellow is used only for the route, the destination, the primary button and the current floor. Places use a cool blue (services) or grey (rooms), so the route always stands out.
- **No glow.** The route is a yellow line with a dark casing, readable on dark and light floors alike. Depth comes from surfaces and one soft shadow level.
- **Honest navigation.** A badge says "Step-by-step · tap Next as you walk" or, when simulating, "Simulated preview · not your real position" in a different colour.

## 3. Design system (in `app/styles.css`)

| Token group | Values |
|---|---|
| Brand | `--brand #FFC700`, `--on-brand #15130A` |
| Dark surfaces | canvas `#0C0D10`, floor `#14161A`, surface `#15171B`, surface-2 `#1D2025`, surface-3 `#262A31` |
| Light surfaces | canvas `#E4E2DC`, floor `#FBFAF7`, surface `#FFFFFF`, surface-2 `#F3F2EE` |
| Text | dark: `#F2F1EC` / `#A9AFB8` / `#8A919B`; light: `#16181C` / `#4F5660` / `#6A717B` (all ≥ 4.5:1 on their surface) |
| Status | info (floors, services) `#8DB6FF` / light `#2457C5`; ok `#4CD69E`; warn `#FF8A7A` |
| High contrast | yellow `#FFE600` on black, no transparency or shadows, white route |
| Type | Geist (Latin), system Arabic; 12.5 / 14 / 16 / 18 / 22 / 28 px; weights 400–700; tabular numbers for distances |
| Space | 4-pt: 4, 8, 12, 16, 20, 24, 32 |
| Radius | 10 (chips, small), 14 (cards, inputs, buttons), 20 (sheet, dialogs). No pill-everything. |
| Touch | 48 px minimum (44 px for compact secondary controls), primary actions 56 px |
| Motion | 0.28 s, `cubic-bezier(.2,.8,.2,1)`; all off with Reduce motion |

Components: top bar, glass map controls, floor switch (current floor marked with a dot), bottom sheet with grip, search field, filter chips, category tiles, place cards (horizontal rails), list rows, route card, switch row, fact chips, step preview, instruction card, mode badge, progress bar, arrival card, settings page with segmented controls and switches, dialogs, toast.

## 4. Screens and journey

**Open → Find → Review → Start → Follow → Arrive**
1. **Home** (sheet at half): search, building · floor, "You are at … Change", Find the nearest (Restroom, Elevator, Stairs, Prayer, Café, Help desk; only the ones this building has), Saved, Recent, then Frequent places (from this phone) or Key places here.
2. **Search** (sheet full): filters (All, This floor, Rooms, Restrooms, Lifts & stairs, Food, Prayer, Services, depending on the building), results grouped by floor with distances, recent searches, empty and no-result states with a hint.
3. **Place**: name, category, floor, building; time and distance; "By lift/stairs to Level 2"; Start, Save, Share; Step-free switch; facts (room number, step-free available or not, accessible restroom); first steps of the route with "Show all". The map shows the route fitted above the sheet.
4. **Navigation**: heading-up tilted map, position kept in the open band between the instruction card and the panel; big instruction with turn icon; "then" preview; floor-change banner; tag confirmation button; mode badge; progress bar; remaining distance and time; Previous / Next / Repeat / Preview; full step list; End.
5. **Arrival**: success mark, destination, distance and time, Done, Save.
6. **Settings**: Theme (System / Dark / Light), Language, Navigation (step-free, voice, vibration), Accessibility (large text, high contrast, reduce motion), Building map (choose building, load a map file). Notifications are not offered: the app has no server to send them.
7. **Dropped pin**: tap the floor → "Directions here" or "Save as my spot".

## 5. Code changes

- `app.js` split into `i18n.js` (strings and icons), `mapview.js` (map renderer), `router.js` (routing, unchanged), `app.js` (state and screens).
- New: bottom-sheet controller, search view with filters and grouping, recents / frequent / recent searches (localStorage), viewing a floor without moving the visitor, place facts, route preview, boot screen with retry, theme system, settings page, hidden dots under markers, bidi isolation for mixed Arabic/Latin names, floor-change banner, progress bar, honest mode badge.
- Kept: routing, multi-floor plans, deep links, NFC/tag picker, share + QR, kiosk mode, offline service worker, voice, vibration, live region.

## 6. Testing

- `npm test`: 13/13 pass (the previous 11, updated to the new structure, plus "loading failure → retry" and "recents, recent searches, theme and language").
- `tests/test_mapper.py`: unchanged, passes.
- Checked by screenshot at 390 × 844 (iPhone 13) and 1440 × 900: home, search (results, filter, no results), place (same floor and other floor), navigation (step-by-step and preview), arrival, settings, light theme, Arabic RTL, high contrast.
- Sheet: drag to peek / half / full and tap the handle to cycle, verified in a browser.
- **Not verified:** real phones (iOS Safari, Android Chrome), VoiceOver and TalkBack, real NFC tags, spoken voices, vibration, battery and performance on low-end phones.

## 7. Remaining limits (need data or services)

- **No live position.** DALIL locates people at tags only; the app says so. Continuous positioning would need phone motion sensors (planned) or hardware.
- **Building names have no Arabic** in the map files, so they show in English in Arabic mode.
- **Notifications and analytics** need a backend (the facility dashboard).
- **Map labels come from CAD**; nicer names need the building's room list.
