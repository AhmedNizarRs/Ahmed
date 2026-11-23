# Sleep strategy decision tree

This is the master decision. Pick the strategy first, then check its height needs in `dimensions.md` → Room heights. In the design brief, name the chosen branch and say in one line why each rejected branch loses.

```
Occupants = 1
├─ room ≥ ~8 m², no study need       → PLATFORM bed against a wall or in the bay window, drawers under [18, 70]
├─ room 5–9 m², needs desk + storage → LOFT bed with desk / closet / den under (ceiling ≥ 2.6 for a desk) [1, 6, 16, 22, 27]
│     variants: pull-out desk under the loft [6, 16, 64, 84]; walk-in closet under the bed [22, 42, 98];
│               gaming den under the bed with a hidden door [1, 7, 41, 78, 92]
├─ room 5–8 m², low ceiling (< 2.6)  → HALF-HEIGHT bed (mattress top ~0.8) + storage under + desk alongside [21, 24]
├─ ceiling 2.4–2.6, wants a den/hideout → LOW LOFT (underside ≥ 1.0) over a sitting-only den; desk beside it, not under it
└─ micro-unit ≤ 4 m²                 → FOLD-UP wall bed [36], PULL-OUT sofa-bed from drawers [12, 23];
                                        structural extensions only with an engineer [34, 48, 57]

Occupants = 2 children
├─ default: avoid the classic stacked bunk (headroom and privacy complaints) [10, 54, 75]
├─ SIDE-BY-SIDE raised platforms + central divider cabinet: wide rooms [10, 51, 75, 94]
├─ OFFSET L-BUNK in a corner, upper and lower not overlapping: compact rooms [54]
├─ UPPER BED ON BACK-TO-BACK WARDROBES, lower bed by the window: long rooms [73]
└─ classic bunk only with ≥ 0.84 headroom up top and comfortable lower clearance (ceiling ≥ 2.9) [42]
   Upper sleeper must be ≥ 6 years old [CPSC]

Occupants = 3–12 children → steel-frame multi-bed system on vertical columns, storage-box stairs,
                            a long shared desk row, a drawer section per child [8, 62, 79, 86]

Couple → raised platform with storage + his/her step drawers; split desk (WFH + vanity) [30, 74, 83, 87, 97]

Teen + sibling of the other sex → full partition with a door or frosted glass panel [54, 86]
```

## Questions that decide the branch
1. Ceiling height? Below 2.6 m rules out a loft over a desk; 2.4–2.6 m still allows a low loft over a sitting-only den (`../../dimensions.md` → Room heights).
2. Ages? Under 6 rules out the upper bed for that child.
3. Does each person need a desk? Then lofts or wardrobe-supported beds free the floor.
4. Is privacy the main complaint? Then use dividers, offset beds or dens.
5. Room proportion: a long, narrow room suits a linear sequence; a square room suits a corner L.
