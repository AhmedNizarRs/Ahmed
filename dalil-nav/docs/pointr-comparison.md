# DALIL vs Pointr: feature map

Internal working note. Pointr facts come from pointr.tech (home, Indoor Navigation, Express, MapScale and
Indoor Positioning pages), read 2026-11-14. Quote Pointr only from their own pages; don't add numbers they
don't publish. Never present this table publicly as a "we beat them" claim: compare facts.

| Pointr (their words) | DALIL | Status |
|---|---|---|
| **Pointr Express**: app-free maps by "QR codes", "NFC", "iMessage", "Link" | Web app opened from the NFC tag in each clip, a QR code, or a shared link; works offline after the first visit | ✓ built |
| "Instant wayfinding to any destination selected on the map or via search" | Search in EN/AR, category chips (nearest), **tap any spot on the map** | ✓ built |
| "Step-by-step wayfinding" | Turn-by-turn steps, clock directions, step counts, voice, vibration | ✓ built |
| Multi-floor, "Site-Wide Wayfinding" | Floors joined by lift/stair link codes; navigation switches floors mid-route | ✓ built (one building) |
| "Accessibility mode to avoid stairs or enable turn-by-turn voice guidance", "Accessible Wayfinding with VoiceOver" | Step-free routes that say plainly when there is none; screen-reader live region; large text; yellow-on-black high contrast; full Arabic RTL; **tactile braille clips on the rails themselves** | ✓ built, and DALIL goes further for blind users |
| "Mark My Car" | **My spot**: tap the map, save it, get directions back later | ✓ built |
| "Customizable routes (e.g., temporary construction changes)" | **Temporary closures** drawn in the Mapper; the app routes around them | ✓ built (Mapper); a dashboard toggle is next |
| MapScale: "Auto room/furniture identification", "Automatic path generation", "minutes, not weeks" | Mapper: **Find places in drawing** reads room numbers, lifts, stairs, toilets and other symbols from the CAD; walkable map and routes are automatic. Kennedy Library Level 1: 70 places in about 2 s | ✓ built for CAD; scanned/PDF plans still traced by hand |
| Sharing (iMessage, link) | **Share route**: link + QR code, opens with the same start and destination (works for hospital appointment SMS/WhatsApp) | ✓ built |
| Kiosk ("Multi-platform across Mobile, Web and Kiosk") | **Kiosk mode** (`#kiosk`): fixed location, QR to continue on a phone, resets after 90 s idle | ✓ built |
| Blue dot: "Bluetooth Low Energy", "Sub-3 meter accuracy", beacons with "5+ years battery life" | No beacons, no batteries: location is exact at every tag (NFC/QR), steps in between | Different by design. Next: phone motion sensors between tags |
| Wayfinding / search analytics, heatmaps, footfall | — | Next: needs a backend (facility manager dashboard, business model #2) |
| "Indoor-to-outdoor campus wayfinding" | — | Next: outdoor paths between buildings |
| Integrations: SDKs (iOS/Android/Web), REST API, webhooks, Epic MyChart, IMDF | Deep links (`#at-…&to-…`), open JSON map format | Next: IMDF export, embeddable widget |

## Where DALIL is better (true today)

1. **Works for people who can't see the screen.** The clip on the handrail carries braille, a raised number and a
   glow, and its NFC tag tells the phone where you are. Pointr's accessibility is in the app.
2. **No hardware to maintain.** No beacons, no batteries, no site survey for radio signals.
3. **Arabic first**, right-to-left throughout, Arabic voice, Arabic step grammar.
4. **Works offline** once opened: basements and stairwells with no signal.
5. **Small map files** (about 150 KB per floor): routes are worked out on the phone.

## Next, in order

1. Facility dashboard: closures on/off, rename rooms, search and route analytics (privacy-safe).
2. Import a room list (Excel/CSV) to name rooms, e.g. from the building's directory.
3. Motion sensors (steps + compass) between tags, re-anchored at each tag.
4. Outdoor paths between buildings for campuses.
5. IMDF export and an embeddable widget for the client's own app or website.
