# Test scenarios (build-order step 2)

Run each prompt through the skill. A pass means the layout JSON gets 0 checker errors and the stated expectation holds.

| # | Prompt | Expect |
|---|---|---|
| 1 | "My 10-year-old's room is 2.6 × 3.0 m with a 2.75 m ceiling. He needs a desk, and the wardrobe door hits the bed." | Loft over a desk (pattern A), sliding wardrobe, diagnosis names the door clash |
| 2 | "Twins aged 9, room 3.4 × 3.4 m, ceiling 2.8 m. They fight over the bunk bed." | Offset or side-by-side layout, not a stacked bunk; mirrored storage |
| 3 | "Three kids aged 5, 8 and 12 in a 4 × 3.5 m room, ceiling 2.9 m." | Multi-bed system; the 5-year-old is not on an upper bed |
| 4 | "Couple in a 3 × 3.2 m bedroom. She needs a vanity, he works from home." | Platform with split step drawers; split desk; niches instead of nightstands |
| 5 | "Teen girl, 2.4 m ceiling, 2.8 × 2.9 m room, wants a hideout to game in." | Recognizes a loft over a desk won't fit; half-height bed or den with ≥ 1.0 clear; asks about window/door |
| 6 | "Brother 14 and sister 11 share 3.2 × 4.2 m." | A partition with a door or frosted glass; equal zones |
| 7 | Photo only (no numbers) | Estimates from the door, marks `estimated: true`, asks to confirm the width and ceiling |
| 8 | "Make a niche in the wall behind the bed" (structure unknown) | Asks about load-bearing; the checker errors until it's confirmed |
| 9 | Voice-style ramble: "uh so it's like a small room maybe three metres, two boys, they need desks" | Pulls out the facts; asks at most 5 focused questions |
| 10 | "4 m² micro-room, can't even lie flat" | Fold-up or pull-out bed; any structural extension is flagged for an engineer |

## Whole-home scenarios (added with the residential scope)

| # | Prompt | Expect |
|---|---|---|
| 11 | "Narrow kitchen 2.4 × 3.2 m, two of us keep bumping into each other." | Galley with an aisle ≥ 1.07 m, a tight triangle, a full-height pantry (`examples/galley-kitchen.json`) |
| 12 | "Tiny 1.7 × 2.5 m bathroom, the floor floods after every shower." | Glass wet/dry split, linear drain, toilet and basin clearances met, door opening outward (`examples/compact-bathroom.json`) |
| 13 | "25 m² studio, I work from home and hate that my bed is always visible." | Zones by curtain and wall bed with day/night states, one-wall kitchen by the entry, table that doubles as a desk (`examples/studio-apartment.json`) |
| 14 | "Plan my 2-bedroom flat: couple plus a 7-year-old, one bathroom." (floor plan given) | A home plan first: room allocation, adjacency, wet stack, main route; then per-room layouts |
| 15 | "Living room 3.5 × 4.5 m, people walk right in front of the TV." | Circulation behind the sofa, coffee table 0.36–0.46 m away, storage wall |
| 16 | "We want a loft stair in our duplex, ceiling 5 m." | Stair meeting riser/tread/width/headroom; guards on the open side |

## Regional and whole-house scenarios (added with the home-tour research)

| # | Prompt | Expect |
|---|---|---|
| 17 | "East-facing 30×40 ft plot in Bengaluru, G+1, couple + parents + one child. We follow Vastu and need a pooja room." | Asks how strictly they follow Vastu; parents' room on the ground floor near the pooja room; kitchen SE and pooja NE (or explains trade-offs); dry kitchen plus utility; site sketch with car and pedestrian entry |
| 18 | "3BHK flat in Pune, we cook Indian food daily and have a maid twice a day." | Keeps or creates a utility balcony; deep drawers for cookers; pooja unit; loft storage; maid's access to the utility without crossing bedrooms |
| 19 | "Victorian terrace in London, two kids, I want to see them while I cook." | Open kitchen with sight lines; keeps original features; mudroom or drop zone; storage under the stairs |
| 20 | "Plan our house on a sloping site, family of five, we love hosting." | Split levels following the slope; privacy by floor; hosting level; courtyard or deck; site sketch |
