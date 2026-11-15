# Usability walkthrough: a lost visitor at the University of Sharjah (Nov 2026)

Simulated, not a real user test: Claude played a first-time visitor on an iPhone-sized screen, GPS about 150 m from
Central Labs B3, location allowed, motion not available (simulator). UoS B3 is internal test data, not a client.
Screenshots were kept out of the repo.

## Worked well
- The "indoor map available, 108 m away, Open" card appears by itself near B3. That is the best moment in the app.
- English search is forgiving: "toilet", "bathroom", "wc" all find the toilets; "chemistry" finds the 4 chemistry labs.
- Route page: big time and distance, "Step-free route available", a clear blue route.
- Outside the building: "You're about 138 m from this building. Go to Entrance MD19 first" + walking directions.
- Preview walk is labelled "Preview · not your real position"; arrival screen is clear ("Look for the sign to make sure").
- Arabic UI is right-to-left and consistent.

## Fixed during the walkthrough
- **Arabic search returned every place** (the text clean-up removed all Arabic letters). Now "مختبر" finds only labs, "حمام" the toilets, and vowel marks are ignored.
- **Opening B3 from the nearby card said "You are here: Entrance MD19"** while GPS was 150 m away (only a deep link re-checked). Now any building opened while GPS is known is checked.

## Fixed after the walkthrough (all 13)
1. **First screen:** with GPS near a mapped building while showing one that isn't placed (or is over 2 km away), the app opens the nearby building by itself (once; a building chosen by hand or by a link stays). "You are here" is only shown when GPS, a sign, a link or the visitor confirms it; otherwise "Starting point".
2. **Indoor maps list:** nearest first; buildings over 50 km away are folded under "Show N more, far away".
3. **One distance:** the card and the list both measure to the building's edge ("You're inside" at 0).
4. **Start while outside:** a sheet first: "You're about 138 m from this building. The indoor directions start at Entrance MD19…" with walking directions, "Show the way on the map", and "I'm at the entrance now".
5. **Honest distances in search:** while outside, one line above the results: "Distances from Entrance MD19, where the indoor route starts".
6. **Search coverage:** door numbers from the drawing are searchable and shown ("Lab · Door 034", "MD9" finds the workshop); more words for rooms (class, hall, office); when nothing matches: "Ask at the help desk" and "Get help".
7. **Pins:** labs are a purple flask, not the room square; key places (entrances, toilets, lifts, help desk) are named from zoom 17.2; labels that would overlap are hidden.
8. **Your blue dot** is framed with the building when you are within 1.5 km.
9. **Turns in plain words first:** "Turn left (9 o'clock)", "Bear right (2 o'clock)" (app router and Mapper, EN + AR).
10. **No tiny zigzags:** a leg under 3 m between two slight turns is merged (app router and Mapper).
11. **"Lab" category** (`lab`) in the app, the Mapper (list + auto-places from "lab"/"laboratory"/مختبر/معمل) and B3's data.
12. **Motion message** explains why (it follows your steps) and how on iPhone.
13. **Arabic building names** (`building.nameAr`) for every bundled map; drafts for a native-speaker check.
