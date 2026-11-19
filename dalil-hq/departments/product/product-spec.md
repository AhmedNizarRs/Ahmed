# DALIL clip: product spec

Owner: Ahmed Nazar (`dalil-product`). Current version: **v0.2 (draft)**. Change only with a new version and a line in the history.

## 1. What it is
A 3D-printed clip that snaps onto a handrail or handle, carrying braille, a raised number and a photoluminescent glow. No app, no battery, no tools to install.

## 2. Fit
| Rail type | Size | Status |
|---|---|---|
| Round stair handrail | Ø30–50 mm | `[spec]` |
| Flat corridor rail (hospitals) | `[mm]` | `[spec]` |
| Oval rail | `[mm]` | `[spec]` |
| Timber rail | `[mm]` | `[spec]` |
| Vertical grab pole (buses, metro) | Ø32 mm | `[spec]` |
| Lever door handle (schools, towers) | `[mm]` | `[spec]` |

## 3. Tactile grammar
| Rib type | Rib pattern | Meaning |
|---|---|---|
| Information | `[describe]` | Lift ahead, Prayer room, Rooms 201 to 215 |
| Safety | `[describe]` | Ground floor, Exit, turn left |
| End of stairs | `[describe]` | End of stairs |

The hand meets the ribs first, then reads.

## 4. Braille and numbers
- Code: Arabic braille `[confirm code and grade]`, plus English braille `[yes/no]`.
- Dot height, diameter, spacing: `[mm, per the chosen standard]`.
- Raised numeral height and stroke: `[mm]`.
- Every braille string is checked by a braille reader before printing for a customer.

## 5. Material and glow
- Material: `[filament or resin, brand, grade]`. **Candidates to test (v0.1):** hard face ASA (print) → PC or PC/ABS (moulding), flame-retardant grade; soft grip liner TPU 85A–95A, overmoulded; glow from a strontium aluminate insert; lock with a stainless pin-Torx screw or a one-way ratchet; acrylic foam tape on flat rails. Not PLA (softens at 55–65 °C). See `manufacturing-brief-2026-11-19.md`.
- Photoluminescent pigment: `[type, loading %]`
- Glow performance: `[mcd/m² after 10 and 60 minutes]`, tested to `[standard]`
- Colour: safety yellow `#FFC700` daytime

## 6. Durability (targets, then results in `test-log.csv`)
Grip and slide-past, impact, UV and heat (UAE summer), cleaning chemicals, tamper resistance, fire.

## 7. Print process
Printer `[model]`, settings `[layer, infill, temperature]`, time per clip `[min]`, material cost per clip `[AED]`, failure rate `[%]`.

## 8. Version history
| Version | Date | Change | By |
|---|---|---|---|
| v0 | 2026-11-05 | Spec file created from the website description | Claude (dalil-product) |
| v0.2 | 2026-11-19 | Founder: the product is a **flexible sticker** (door handles, handrails and walls), soft to the hand. First print model in `models/` (80 × 32 × 1.6 mm TPU pad, ribs, raised number, braille, sloped edges, VHB tape back). | Claude (dalil-product) |
| v0.1 | 2026-11-19 | Candidate materials, anti-tamper locks, braille dimensions (ADA 703.3) and manufacturer questions added, for Ahmed's manufacturer meeting (`manufacturing-brief-2026-11-19.md`). All to be tested. | Claude (dalil-product) |
