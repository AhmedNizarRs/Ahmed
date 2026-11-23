# Living and dining

Source tags are explained in `../sources.md`. ✔ means `scripts/check_layout.py` checks it (with `room.type` of `living`, `dining` or `living_dining`).

## Master decision: seating focus and circulation
Pick the focus first: TV, a view or window, or conversation. Seating faces the focus. The main circulation route runs **behind or beside** the seating group, never through it.

| Layout | Fits when |
|---|---|
| Sofa facing the TV wall | Narrow rooms; the classic layout |
| L-sofa in a corner | Small rooms; frees the centre. A corner platform sofa with drawers saves more [DI 26] |
| Two sofas facing each other | Conversation-first rooms; needs width |
| Dining at the window, lounge at the back | Open plan; daylight for meals |
| Fold-down or extendable dining | Studios and micro-flats |

## Diagnostics
| Symptom | Usual fix |
|---|---|
| People walk between the sofa and the TV | Re-route the path behind the sofa; float the sofa off the wall |
| Coffee table too far away or blocking legs | 0.36–0.46 m from the sofa front |
| Loose furniture, no storage | A full TV wall of cabinets; platform sofa with drawers [DI 26] |
| Dining chairs hit walls | Use a bench on the wall side; round table in tight spots |

## Rules
| Rule | Value | Source | Checked |
|---|---|---|---|
| Sofa front to coffee table | 0.36–0.46 m (14–18 in) | [RET-L] | ✔ warns outside the range |
| Main walkway | ≥ 0.9 m; small-room minimum 0.6 m | [BO] [IDE] | ✔ via front clearances |
| TV viewing distance | About 1.5–2.5 × the screen diagonal | [std] | |
| Dining: width per diner | 0.61 m | [NKBA] | |
| Dining: clearance behind a chair | 0.81 m (no traffic) to 1.12 m (people walk behind) | [NKBA] | ✔ give the table `front` as a list of the sides with chairs, e.g. `["+y", "-y"]` |
| **Main route stays clear** | Draw the path (front door → inner door, door → balcony) as a `route` element ≥ 0.9 m wide | [BO] | ✔ error if anything stands on it |
| General lighting | 50–150 lux, plus task lamps at seats | [IES] | |

## Storage moves
A TV wall with closed cabinets and open display niches; window-seat storage; platform seating with drawers [DI 26]; a sideboard that doubles as a room divider in open plan.

## Reveal order
Entry view → seating focus → storage wall → dining → wide shot.
