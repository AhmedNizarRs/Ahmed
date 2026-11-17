# DALIL sticker concept: research memo

Owner: Ahmed Nazar (`dalil-product`). Written 2026-11-17 after the University of Sharjah specialist meeting.
Status: **research, not a decision.** Nothing here changes `DALIL-facts.md` or the v0 spec until the founders say so.
Marking: `[VERIFY]` = I could not confirm it from a source I read. `[TO CONFIRM]` = a founder must answer.

---

## 1. What the specialist told us

A specialist at the University of Sharjah (name `[TO CONFIRM]`) reviewed the clip and said:

1. The product is too big. Keep only the top part: the braille and the sign.
2. Make it a sticker. It sticks anywhere and uses less material.
3. Make it thin, so it does not bother people with normal vision and does not hurt their hands.
4. Drop the side ribs (the 2-rib and 3-rib patterns). Focus on the message: braille, and letters only if they do not get in the way of the braille.

This is expert feedback, not a user test. It is logged in `accessibility/feedback-log.csv` as E1.

## 2. The short answers

| Question | Answer |
|---|---|
| Can it be a sticker? | **Yes.** Thin adhesive braille strips are a normal product. Handrail braille markers already exist. The hard parts are the dots (height and softness) and keeping the edges stuck on a Ø32 mm rail. |
| How thin? | **About 0.3–0.7 mm flat, 0.8–1.2 mm at the top of a dot.** The dots are the limit, not the sticker. Dots below about 0.4 mm are risky to read. See section 4. |
| Comfortable for sighted hands? | Yes, if the dots are fully rounded, the edges taper over 3 mm or more, the surface is matte and the strip is short. A 0.5 mm bump is about the size of a paint seam. We still test it with people. |
| Raised or engraved? | **Raised.** Every braille standard I found specifies raised, rounded dots. Engraved (sunken) dots are not braille. |
| Which material? | Best first bet: a **thin photoluminescent film as the base, with clear raised dots on top**. Second: **flexible resin or TPU** for strips that must wrap a round rail. |
| Fit every handrail? | **No single piece fits everything.** One design family in three formats: strip, wrap band, door patch. Each is measured and printed to fit, as DALIL already does. |
| Fit every door handle? | **Not yet proven.** Levers vary a lot and a hand grips them. Survey real levers first (template: `handle-survey.csv`). The door leaf next to the lever may be the better place. |
| Should we drop the ribs? | Probably yes, **but they did a job: the hand found the clip before reading.** We must test a replacement. See section 9. |

## 3. Honest risks first

These could change the plan, so they come before the design.

1. **Not everyone who is blind reads braille.** One UK access consultant cites about 7% (RNIB) in the UK and under 10% (National Federation of the Blind) in the US. Source: PBC Today, 2023. A raised number or arrow reaches people braille does not. This is a reason to **keep a raised number**, even though the specialist said to focus on braille.
2. **The same article argues against tactile data on handrails.** It says the RNIB does not recommend it, that slow readers could stop on stairs, and that reading direction (up or down) is unclear. It is one opinion in the UK, written for UK law. It is not a ruling for the UAE, but our user tests must answer it. ISO 17049 and the European standard do recommend it (floor number at the ends of stair handrails).
3. **Handrail rules.** The US ADA says a handrail's gripping surface "shall not be obstructed along their tops or sides" (505.6) and must have "rounded edges" and no "sharp or abrasive elements" (505.8). The US rules do not govern the UAE. A thin tapered sticker is far easier to defend than a clip. The UAE and Sharjah position is `[VERIFY]` with the municipality. Dubai uses its own Universal Design Code, not the ADA.
4. **Not new.** Braille handrail markers exist: stainless-steel markers (Kinetics Industries), a handrail braille band (Be My Vision, India), 3D-printed aluminium handrail signs for Deutsche Bahn (Constellium), an older US patent (US 5,284,444) for braille on the side of a handrail, and a Hong Kong specification that calls for braille and tactile floor numbers on handrails. What DALIL adds (a retrofit, any rail, Arabic braille, glow, fitted per building) must be checked by an IP lawyer. `[TO CONFIRM]`
5. **Month 6 "Certified".** If the product changes from a clip to a film, the fire and braille tests change too. See section 12.

## 4. How thin, and what sets it

```
        dot (clear, domed)  ●
 ──────────────────────────  base film  (PL film 0.2, or flexible resin 0.4–0.6)
 ──────────────────────────  adhesive    (about 0.1  [VERIFY datasheet])
 ══════════════════════════  handrail
```

| Layer | Target | Why | Source |
|---|---|---|---|
| Adhesive | about 0.1 mm | Thin acrylic transfer or foam tape | `[VERIFY]` datasheet |
| Base | 0.2 mm (photoluminescent film) or 0.4–0.6 mm (flexible resin) | PL film is sold at 0.2–0.22 mm. Flexible resin: minimum wall 0.4 mm, recommended 0.6 mm | T2 Siberica sheet; Formlabs |
| Dot height | **0.5 mm; test 0.4 / 0.5 / 0.6** | ISO 17049 allows 0.3–0.7 mm and says over 0.5 mm outdoors and in vehicles. ADA signs need 0.6–0.9 mm | ISO 17049; ADA 703.3 |
| **Flat area** | **0.3–0.7 mm** | Base plus adhesive | calculated |
| **At a dot peak** | **0.8–1.2 mm** | Adds the dot | calculated |

Why not thinner dots? Pharmacy packs use dots about 0.2 mm high (ISO 17351). A braille-printing supplier says that height is "indiscernible to untrained fingers". A rail is read on the move, by a hand, in a hurry. So we stay near ISO's own range.

**Why thin helps the sticker stay on.** A film's bending stiffness rises with the cube of its thickness. Going from 0.2 mm to 0.6 mm makes it 27 times stiffer. Stiff film "flags" (lifts at the edges) on small diameters. That is a documented cause of label failure on curved surfaces.

## 5. Raised or engraved?

**Raised, rounded dots.**

- ISO 17049: the dot profile "shall be rounded. It shall not be flat or pointed." Base 1.0–1.7 mm, height 0.3–0.7 mm.
- Every other standard I found (ADA, Braille Authority of North America, Braille Australia, Braille Literacy Canada) describes raised domes.
- A finger reads by feeling a dot rise against the pad. A sunken pattern does not do that.

Do not use a flat-topped or stepped dot. A published test of FDM-printed braille (0.4 mm nozzle) got truncated cones "with sharp edges", about 0.38 mm high against 0.5 mm designed, and about 1.0 mm wide against 1.3 mm designed. That fails the standard and feels sharp.

If you want to see engraved for yourself, a 10-minute test with one braille reader settles it. I would not spend more on it.

## 6. Braille specification to test

| Parameter | ISO 17049:2013 | ADA 703.3 (US) | Test target |
|---|---|---|---|
| Dot base diameter | 1.0–1.7 mm | 1.5–1.6 mm | 1.5 mm |
| Dot height | 0.3–0.7 mm (above 0.5 outdoors) | 0.6–0.9 mm | 0.4 / 0.5 / 0.6 mm |
| Dot shape | rounded | domed | spherical cap, radius about 0.75–0.8 mm |
| Dot spacing in a cell | 2.2–2.8 (down), 2.0–2.8 (across) | 2.3–2.5 | 2.5 mm |
| Cell pitch (dot 1 to next dot 1) | 5.1–6.8 mm | 6.1–7.6 mm | 6.2 mm |
| Line pitch | 10–15 mm | 10–10.2 mm | 10 mm |
| Direction on a handrail | parallel to the rail | not covered | along the rail |

- The final UAE specification is **`[VERIFY]`** against the Dubai Universal Design Code and the Sharjah rules. I read the public sample of ISO 17049, not the paid full text.
- Code: **Unified Arabic Braille** is what a Dubai signage supplier names. A bilingual sign needs two codes (Arabic and English). The number sign is dots 3456, then the digit. Which direction Arabic braille is read along a rail, and which way up or down the stairs, is `[VERIFY]` with a native braille reader. Every string is checked by a braille reader before it goes on a customer's rail (spec §4).
- **Size on the rail.** One line of braille is only **4.0 mm wide** (2.5 mm between columns plus one dot). It is long, not wide:

| Message length | At 5.1 mm pitch | At 6.2 mm | At 6.8 mm |
|---|---|---|---|
| 6 cells | 30 mm | 35 mm | 38 mm |
| 9 cells | 45 mm | 54 mm | 58 mm |
| 12 cells | 60 mm | 72 mm | 79 mm |

Two lines side by side (Arabic and English) need about 16.5 mm of width. Arabic and English one after the other need the length.

## 7. How to make it (production routes)

| Route | How | Dot quality | Fits | Notes |
|---|---|---|---|---|
| **A. Raised UV print on adhesive film** (sign-shop flatbed) | Inkjet builds the dot in layers, cured by UV | Vendors say ADA-compliant. We must measure our own samples | Custom per-building messages. No tooling | Outsource first. Can print **clear dots on glow film**. Ask for a sample with measured dot height |
| **B. Flexible resin printed in our workshop** | SLA printing in 50 µm layers | Smooth domes. Best dot shape of the in-house options | Prototypes and short runs | Printer model `[TO CONFIRM]`. Flexible 80A V2 is "not tested for skin safety (ISO 10993)". BioMed Flex 80A lists skin-contact approval but needs a compatible printer |
| **C. Screen-printed raised varnish** | Thick UV varnish, one screen per message | Good, repeatable | Standard messages: floor 1–20, Exit, Lift | A screen per message |
| **D. Embossed or thermoformed film** | Die presses the dot | Hollow domes can **collapse under a finger** unless back-filled `[VERIFY]` | Volume only | Tooling cost per message |
| **E. Moulded TPU or silicone strip** | Injection mould | Good | Thousands of identical pieces | Later, once messages are fixed |
| **F. FDM TPU** | Our own filament printer | Fails the standard (see section 5). Flexible dots are too soft. | Look-and-feel mock-ups only | Do not ship |
| **G. 3D-printed aluminium** | Laser powder-bed fusion | Fine | Not a sticker | Deutsche Bahn handrail signs. Shows demand; wrong route for us |

**Volume check.** The roadmap says 22 buildings by Month 24 (`DALIL-facts.md` §7). At 138 points per average building (§6 check) that is about **3,000 pieces** in two years, in many different messages (my arithmetic). That is too few for tooling. Routes A and B fit.

**Recommendation.** Round 1: route B (we print) and route A (sign shop) in parallel, same artwork. Compare the dots with a ruler gauge and with blind readers.

## 8. Materials

| Material | Use | For | Against |
|---|---|---|---|
| **Photoluminescent (PL) film, 0.2 mm, adhesive-backed** | Base layer | Already thin, already glows, sold with adhesive. ISO 17398 / 16069 products exist | Flexible laminate, not stretch. Test it on Ø32 mm |
| **Clear UV dot ink on top** | Dots | Glow shows through | Wear and scratch resistance unknown |
| **TPU / polyurethane, 85–95A** | Base for wrapping bands | Tough, flexible, good grip | Sources disagree on bleach. One chemical guide rates sodium hypochlorite "Unsuitable" for TPU, another rates dilute bleach good for cast polyurethane. Test with the client's actual cleaner |
| **Flexible resin 80A** | Prototype base | Fine detail, thin walls | Skin-safety note above |
| **Rigid PET / polycarbonate film** | Flat rails only | Crisp dots | Too stiff for small round rails |
| **Silicone** | Not recommended | Very flexible | Tacky, gathers dust, dots too soft to read (my judgement) |

A beginner guide on printing braille at home warns that flexible and TPU filaments make dots "too soft to be readable". So the dots want to be firm while the base stays flexible. That points to **firm dots on a flexible, thin base** (route A) or a harder TPU grade for the dots, and we test both.

## 9. Without the ribs: how does the hand find it?

The ribs did the "Find" step. The tactile grammar (`DALIL-facts.md` §3) used them to say what kind of message follows. A flat sticker has fewer ways to be noticed. Three options, all thin. All three go into test round 1.

| Option | What it is | Cost to the thin profile |
|---|---|---|
| **1. Nothing** | The edge of the sticker is the signal. The hand meets a 0.4–0.6 mm step | None |
| **2. Lead-in bar** | One raised bar, about 1 mm wide, 10 mm long, before the braille. Number of bars could stand for type: 1 information, 2 safety, 3 end of stairs | Small |
| **3. Category cell** | The first braille cell says the type | None, but it needs a braille reader to hear it |

The measure: **while sliding a hand along the rail at walking pace, what share of people notice that something is there?** A target of `[TO CONFIRM with testers, e.g. 9 in 10]`.

**Placement.** ISO 17049 puts handrail braille at the **ends** of a stair handrail, and says handrails with braille should have extensions, "preferably of at least 300 mm", at both ends of the stairs. On a retrofit we cannot add extensions, so choose the level stretch of rail at the landing. Test this with users.

## 10. Letters and numbers

- Keep **one raised number** and an arrow where it applies. This serves people who do not read braille (section 3).
- ADA characters: at least 16 mm tall, at least 0.8 mm raised, stroke 10–30% of the height, non-glare finish. This is the US rule. The UAE rule is `[VERIFY]`.
- With a 3 mm tapered edge on each side, a 16 mm figure needs a strip about **23 mm** wide (variant A in the CAD files). A braille-only strip can be **14 mm** (variant B). A 23 mm strip wraps 82° on a Ø32 mm rail, so it needs a flexible base. (Corrected 2026-11-17 after modelling; the first draft said 16 mm.)
- A 0.8 mm raised number is taller than our braille dots. We test a lower relief (0.5 mm) with **wide strokes** to keep the strip thin.
- Large letters are optional. Words belong in braille.

## 11. Will it fit every handrail and door handle?

### Round rails (Ø30–50 mm, vertical poles Ø32 mm)

Height the edge of a **stiff strip that stays flat** stands off a round rail (calculated). A flexible strip follows the rail instead; see `cad/previews/06_fit-on-rails.png`:

| Rail Ø | 12 mm strip | 16 mm strip | 20 mm strip | 25 mm strip |
|---|---|---|---|---|
| 30 mm | 1.3 mm | 2.3 mm | 3.8 mm | 6.7 mm |
| 32 mm | 1.2 mm | 2.1 mm | 3.5 mm | 6.0 mm |
| 40 mm | 0.9 mm | 1.7 mm | 2.7 mm | 4.4 mm |
| 50 mm | 0.7 mm | 1.3 mm | 2.1 mm | 3.4 mm |

**Rule:** keep stiff film to **12–16 mm wide**. Go to 20 mm only in an elastomer.

### Three formats, one grammar

| Format | Shape | For | Hold |
|---|---|---|---|
| **S: Strip** | Flat strip 12–16 mm wide, 50–90 mm long, round corners (3 mm or more), tapered edge | Stair rails, flat, oval, timber, hospital corridor rails | Adhesive |
| **W: Wrap band** | A band that goes right round, with a short overlap. Circumference: Ø30 = 94 mm, Ø32 = 101 mm, Ø40 = 126 mm, Ø50 = 157 mm | Vertical poles (bus, metro), thin lever shafts | Adhesive **plus the overlap** (adhesive to adhesive), a good defence against lift |
| **D: Door patch** | Flat patch | Door leaf or back plate beside the lever; flat part of a lever | Adhesive |

Each is measured on site and printed to fit, as DALIL already does.

### Surfaces

| Surface | Adhesive family | Note |
|---|---|---|
| Stainless, aluminium, powder-coat, paint, glass | High-energy acrylic | Wipe with isopropyl alcohol, dry, press firmly |
| Plastic handles (PP, PE, PVC, ABS), some powder coats | **Low-surface-energy** acrylic, such as 3M 300LSE or VHB LSE | 3M says 300LSE has "good anti-lifting properties on both flat and curved surfaces" |
| Varnished timber | Test first | A strong adhesive can lift the varnish on removal |
| Soft PVC handrail covers | Test first | Plasticiser may weaken acrylic adhesive `[VERIFY]` |

Temperature (3M data): 300LSE rated up to 95 °C long-term and 150 °C short-term. VHB LSE tape applies best at 21–38 °C. In a UAE summer, install indoors, or on a cooled rail. Surface temperatures in the sun `[VERIFY]`. Humid air on a cold, air-conditioned rail can leave condensation under the adhesive, so dry the rail before pressing.

### Door handles: the honest answer

- A lever is gripped by the whole hand. **Reading while pushing it down is awkward.** Where does a hand land first? We do not know yet. Test it.
- Lever shapes and finishes vary (round, rectangular, D, curved; steel, brass, painted, plastic). Only the straight section takes a flat strip.
- Three places to test: **(1)** the door leaf or plate beside the lever (flat, easy, but it is now a small wall sign); **(2)** the top face of the lever near the pivot, where fingers pass; **(3)** a wrap band round the round-section shaft.
- **Survey first.** Our first campus is the University of Sharjah. Photograph and log 30 levers. Use `handle-survey.csv`. Then choose one to three lever "fit families".
- **Fire doors.** Stickers on fire-rated door leaves may be restricted. Ask Civil Defence or the test lab. `[VERIFY]`

## 12. Comfort, wear and certification

### Comfort rules for sighted and blind hands

1. Fully rounded dot tops. No flat tops, no stepped layers.
2. Edge ramp: a 0.4–0.6 mm step over **at least 3 mm** gives about 8–11 degrees.
3. Corners rounded, 3 mm radius or more.
4. Matte, smooth, not tacky. Easy to wipe.
5. As short as the message allows. Braille only where it is read.
6. No exposed edge facing the direction of travel. Overlaps face away from it.
7. Dot colour: clear on glow film, or brand yellow `#FFC700`. Contrast ratio is checked for low vision.
8. Nothing sharp or abrasive. This is also the ADA wording (505.8).

### Proposed tests (pass marks to be set with a lab and testers)

| Test | How | Pass idea |
|---|---|---|
| **Comfort, sighted** | 12 adults slide a hand along a mock-up rail 20 times, then rate it 0–10 for "noticeable" and "uncomfortable". Control rail without sticker | Median "barely noticeable". Nobody reports pain or a catch |
| **Snag** | Sleeve, glove, long fingernail, wet hand | No lift, no catch |
| **Reading** | 4–6 braille readers read 0.4 / 0.5 / 0.6 mm dots at walking pace | Accuracy and time. Compare heights |
| **Find** | Same people slide along the rail without being told where | Section 9 measure |
| **Adhesion** | Peel at 24 h and 72 h on each surface. Heat soak. Humidity. Thermal cycles | No edge lift |
| **Cleaning** | 200 wipes each: isopropyl alcohol, quaternary ammonium, diluted bleach | No tack, no dot flattening |
| **Wear** | 5,000 hand passes (rig or people) | Dot height held within a set tolerance |
| **Glow** | Lab measurement | Report only. No claim yet |

### Fire, glow, certification (see `certification-tracker.md`)

- The Month-6 target said "fire and braille approved". A thin laminate (film, ink, adhesive) is a different test item from a moulded clip. Ask the lab what a laminate needs. `[VERIFY]`
- Photoluminescent films are sold with ISO 17398 / 16069 data. One maker lists "not less than 100 mcd/m² after 10 minutes and 15 mcd/m² after 60 minutes" for its way-guidance grade. That is **their** grade. DALIL must not quote it as ours until we test our own build.
- Professional sign-off stays with a lab, the municipality and Civil Defence.

## 13. What changes if we adopt the sticker

These are not changed yet. Founders decide first.

| Where | What would change |
|---|---|
| `DALIL-facts.md` §3 | Product description ("clip", "snaps on"), the tactile grammar (ribs) and the fit table |
| `DALIL-facts.md` §4 and §6 | The AED 130 per clip price and the "install time" claim. Material cost drops. Whether price, margin or both move is a founders' decision. `[TO CONFIRM]` |
| Website, deck, quotes | "Clip" wording, product images, and `data/pricing.json` |
| Roadmap | Month 6 certification scope |
| Brand line idea | "Clip. Find. Read." becomes "Stick. Find. Read." `[TO CONFIRM]` |

## 14. Plan (first 6 weeks, start date `[TO CONFIRM]`)

| Week | Do |
|---|---|
| 1 | Follow-up questions to the specialist (below). Order samples: PL film, two adhesive types, UV-printed samples from two sign shops. Print flexible-resin strips: 3 dot heights × 3 edge shapes |
| 2 | Survey 30 campus levers and rails (`handle-survey.csv`). Fit, peel and comfort tests with the team |
| 3 | Fix the round-1 design. Write the test plan with `/dalil-user-test`. Recruit 4–6 braille readers (paid, consent, per `accessibility/principles.md`) |
| 4–5 | Round 1 with users. Log results in `test-log.csv` and `feedback-log.csv` |
| 6 | Founders decide: sticker, clip, or both |

### Questions for the specialist (send only with a founder's OK)

1. Which dot height did you have in mind, and for which readers?
2. Can you introduce 4–6 braille readers and a contact at an association?
3. Do you advise keeping a raised number or arrow?
4. Which approval do buyers in Sharjah trust for braille, and who issues it?
5. Who at Sharjah Civil Defence or an accredited lab can tell us what a thin film needs?
6. Would you be our named adviser? (Consent first.)

## 15. Decisions needed from the founders

1. **Make the sticker the main direction for round 1?** My view: yes. The evidence supports it. Keep the clip files as a fallback.
2. **Drop the ribs for round 1** and test the three "find" options in section 9?
3. **Keep one raised number** beside the braille?
4. **Budget** to pay testers and to buy samples: `[TO CONFIRM]`.
5. **Who contacts the specialist,** and in what words? I can draft; you send.
6. **Price and margin** if the sticker is cheaper to make: `[TO CONFIRM]`.

## 16. What I could not confirm

- The specialist's name and exact words beyond your summary.
- The full ISO 17049 text (I used the public sample) and any UAE or Sharjah rule on handrail braille.
- The 2009 study on dot height for medicine labels (the page would not load; I used only the abstract line and the pharmacy figures).
- Adhesive thickness figures, and UAE rail surface temperatures.
- Kinetics Industries' marker dimensions (their page has none).
- A forum comment that UV braille needs 58–64 ink layers. I did not use it.
- Whether hollow embossed dots collapse (my engineering judgement, from how a dome behaves under load).

## 17. CAD model and pictures (added 2026-11-17)

Folder: `cad/`. Everything is generated from numbers in this memo by `cad/generate_sticker.py`, and checked by slicing the mesh (`cad/model-check.json`).

| File | What |
|---|---|
| `dalil-sticker-A-braille-number_flat.stl` | Variant A: braille line plus raised number, 83.0 × 23.0 mm, flat as printed |
| `dalil-sticker-B-braille-only_flat.stl` | Variant B: braille only, 63.6 × 14.0 mm |
| `dalil-calibration-dot-heights_0.4-0.5-0.6_flat.stl` | Three strips with dot heights 0.4, 0.5, 0.6 mm for the round-1 reading test |
| `dalil-sticker-A-…_on-rail-d32.stl`, `dalil-sticker-B-…_on-rail-d32.stl` | The same strips wrapped on a Ø32 mm rail. For fit checks and pictures, not for printing |
| `preview-only_rail-d32.stl` | Dummy rail for pictures |
| `previews/01…07` | Renders and drawings |

Measured from the mesh: all files watertight; dot height 0.500 mm above the base; dot base ⌀1.50 mm; in-cell spacing 2.5 mm; cell pitch 6.2 mm; flat top 16.0 mm wide; number 16.00 mm tall; edge taper 3.0 mm over 0.4 mm (7.6°); wrapped strip sits exactly on the rail surface.

Limits: demo braille text is Arabic "الطابق" + number sign + 2 and **must be checked by a braille reader**. The adhesive layer is not modelled. Colours in the pictures are illustrative. The lever picture uses an assumed ⌀19 mm bar. The wrap band (format W) and door patch (format D) are not modelled yet.

## 18. Sources (read 2026-11-17)

- ISO 17049:2013 sample, via iTeh: https://cdn.standards.iteh.ai/samples/58086/fb6f17bed4ff425fa03583afabdafb97/ISO-17049-2013.pdf
- ADA Chapter 7, braille and raised characters: https://www.access-board.gov/ada/chapter/ch07/
- ADA/ABA Chapter 5, handrails (505.6–505.8): https://www.access-board.gov/aba/chapter/ch05/
- Braille Authority of North America, size and spacing: https://www.brailleauthority.org/size-and-spacing-braille-characters
- Braille Literacy Canada, signage guidelines 2024: https://www.brailleliteracycanada.ca/storage/standards/BLC%20Accessible%20Signage%20Guidelines%202024.pdf
- Braille Australia, physical specifications: https://brailleaustralia.org/about-braille/physical-specifications-for-braille/
- Arabic braille code: https://www.pharmabraille.com/braille-codes/arabic-braille-code/
- Dubai braille signage and the Universal Design Code (Sun Studio): https://www.sunstudio.ae/insights/braille-wayfinding-signage-dubai-requirements/
- "Adding tactile data to handrails might not come in handy", PBC Today, 2023: https://www.pbctoday.co.uk/news/building-control-news/adding-tactile-data-handrails-might-not-come-in-handy/129951/
- Braille handrail markers: http://www.kineticsindustries.com/product-information/braille-handrails/ ; https://bemyvision.in/product/braille-indicator-for-handrail ; https://patents.google.com/patent/US5284444A/en ; http://www.oneandonehk.com/Division8.pdf
- 3D-printed aluminium handrail signs (Constellium, Deutsche Bahn): https://www.constellium.com/about-us/stories/promoting-inclusive-mobility-with-3d-printed-braille-handrail-signs
- FDM braille quality study: https://www.astrj.com/pdf-191928-113771?filename=Quality-Assessment-of-Bra.pdf
- Pharmacy braille height (ISO 17351, Xaar): https://www.xaar.com/media/m5xliuim/implementing-braille-printing-in-labelling-packaging-with-xaar-s-versatex-printbar-issue-1.pdf ; https://www.pharmabraille.com/optical-inspection-of-braille-font-height-and-shape/
- UV-printed raised braille: https://www.jpplus.com/blogs/uv-braille-signage-how-to-print-ada-compliant-braille-signs
- Flexible resins: https://formlabs.com/support/Using-Flexible-Resin/ ; https://formlabs.com/products/materials/
- Printing braille at home (flexible filament warning): https://braille3d.com/beginners-guide-to-3d-printing-braille-at-home/
- Photoluminescent film: https://www.t2siberica.com/wp-content/uploads/2020/07/VIzLite-DT-PSA-Ficha-tecnica.pdf ; https://everglow.de/wp-content/uploads/2020/03/Katalog_EverGlow_2020_v4_Engl_Final.pdf
- 3M adhesives: https://multimedia.3m.com/mws/media/1868856O/3m-thin-bonding-selection-guide-en.pdf ; https://www.strouse.com/hubfs/3M%20VHB%20LSE-110WF%20TDS.pdf
- Labels lifting on curved surfaces (flagging): https://www.beontag.com/blog/self-adhesive-labels/
- Chemical resistance: https://www.buitink-technology.com/pdf/tpu-chemical-resistance.pdf ; https://psiurethanes.com/urethane-and-polyurethane-chemical-compatibility/ ; https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/chemical-disinfectants.html
