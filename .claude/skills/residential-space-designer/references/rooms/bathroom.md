# Bathroom

Source tags are explained in `../sources.md`. ✔ means `scripts/check_layout.py` checks it (with `room.type: "bathroom"`). Code values are minimums. NKBA values are recommendations.

## Master decision: fixture arrangement
Keep the toilet on its existing soil stack if you can, because moving it is the biggest cost. Then choose:
| Arrangement | Fits when |
|---|---|
| **All on one wall** | Narrow rooms, 1.5–1.7 m wide |
| **Shower across the far end** | Long narrow rooms, using the full room width as the shower |
| **Wet room** (no tray, the whole floor drains) | Under about 3 m²; fully waterproofed |
| **Wet/dry split with glass** | Most small bathrooms [DI 14, 31, 56] |
| **Separate toilet compartment** | Shared family bathrooms with more space |

## Diagnostics
| Symptom | Usual fix |
|---|---|
| Water everywhere after showering | Glass wet/dry split; linear drain [DI 14, 31] |
| Nowhere to put things | A floor-to-ceiling mirror cabinet with a towel slot [DI 56] |
| Dust and mould under the vanity | Floating or open-bottom vanity [DI 63] |
| Kids can't reach the basin | Pull-out step in the vanity plinth [DI 90] |
| Bulky cistern | Concealed cistern with a wall-hung toilet [DI 14, 31] |

## Rules
| Rule | Value | Source | Checked |
|---|---|---|---|
| Toilet centreline to the side wall or fixture | ≥ 0.38 m (15 in); 0.46 m recommended | [IRC-P] [NKBA] | ✔ error / warning |
| Clear space in front of the toilet | ≥ 0.53 m (21 in); 0.76 m recommended | [IRC-P] [NKBA] | ✔ error / warning |
| Clear space in front of the basin (lavatory) | ≥ 0.53 m (21 in) | [IRC-P] | ✔ |
| Shower interior | ≥ 0.76 × 0.76 m and ≥ 0.58 m² (900 in²); 0.91 × 0.91 m recommended | [IRC-P] [NKBA] | ✔ error / warning |
| Clear space in front of the shower entry | ≥ 0.61 m (24 in); 0.76 m recommended | [IRC-P] [NKBA] | ✔ error / warning |

**Full-width showers:** the checker measures the entry clearance across the shower's whole width. For a shower across the far end, split it into the wet tray (`shower`, `front` toward the room) only as wide as the glass opening, and model the fixed glass panel as a `partition`, so the clearance applies to the opening, not the whole room width.
| Toilet compartment | ≥ 0.76 × 1.52 m; 0.91 × 1.68 m recommended | [IRC-P] [NKBA] | |
| Waterproofing | Two coats, then a 48 h flood test before tiling | [DI 14, 31] | |

- Electrical: ground-fault (GFCI/RCD) protection and wet-zone rules. Always an electrician's job.
- Ventilation: an extract fan ducted outside, especially in windowless bathrooms.
- Doors: an outward-opening or sliding door makes small bathrooms safer and frees space. ✔ (the door swing check applies)

## Storage moves
Mirror cabinet across the full wall; a niche in the shower wall (non-load-bearing walls only); over-toilet cabinet; vanity drawers instead of doors; a towel ladder.

## Reveal order
Door view → wet zone → dry zone with vanity → storage → a detail shot (drain, niche, lighting) → wide shot.
