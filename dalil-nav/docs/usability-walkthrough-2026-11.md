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

## Needs improving (not done)
1. **First screen shows the Sample Hospital** and "You are here: Main Entrance" on the UoS campus. With GPS near a mapped building, open on that building or on a neutral "Nearby indoor maps" view; never claim a place in a building without geo.
2. **Indoor maps list is not sorted by distance**: B3 (174 m) is last, Cal Poly (13,266 km) above it. Sort by distance; hide far test buildings.
3. **Distances disagree**: the card says 108 m (to the building edge), the list 174 m (to the centre). Use one.
4. **Starting directions while outside** begins "Now: turn to your 11 o'clock" as if at the entrance. Start with a first step "Walk to Entrance MD19 (138 m)" (outdoor map + GPS), then go indoors.
5. **Search results show distances from the entrance** (27 m, 52 m) while you are 138 m away. Show "from the entrance" or add the outdoor part.
6. **No results for common words**: "library", "coffee", "professor office", door codes like "MD9", room codes like "012B". Add synonyms per building, door/room codes from the drawing, and offer "Ask at the help desk" when nothing matches.
7. **Home pins all look alike** (yellow square, no labels until zoomed in). Use category icons (lab, toilet, lift) and show names for the nearest few.
8. **Your own blue dot is not in view** on Home when you are outside: frame both you and the building.
9. **Clock directions** ("turn to your 9 o'clock") suit blind users but many sighted visitors find them hard: say "Turn left (9 o'clock)".
10. **Tiny zigzag steps** ("Bear right, walk 2 m. Bear left, walk 2 m"): merge legs under 3 m.
11. **"Room" for every lab**: show "Lab" (add a `lab` category or read it from the name).
12. **Motion card wording** ("Allow it in your browser settings") is technical for a visitor; explain in one line why (it follows your steps) and how on iPhone.
13. **Building names are English-only in Arabic** ("UoS Central Labs B3 (test)"): add `building.nameAr`.
