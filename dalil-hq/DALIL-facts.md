# DALIL: company facts (single source of truth)

Every DALIL agent reads this file before doing any work. If a number or claim is not here, do not invent it: mark it `[TO CONFIRM]` and ask a founder.

Last updated: 2026-11-26. Sources: founder decisions of 2026-11-26 (sticker-only product, registered company, IP in progress), the AcTax investment readiness review and cash-flow model (October 2026), and the DALIL landing page.

> **Founders: keep this file current.** When a price, milestone or customer changes, change it here first. All six departments will pick it up.

---

## 1. One line

**DALIL makes the existing path speak.** A thin braille sticker that makes any door handle, handrail or wall readable by touch. No app. No battery. No renovation.

> **Product change, 2026-11-26 (founder decision):** DALIL now sells the **sticker only**. The 3D-printed clip, the door model and the handrail model are retired. The website (`dalil/site/`) still describes the clip and needs updating.

- Arabic name: دليل ("guide")
- Website: https://dalil-team.com (the old `dalil-invest.netlify.app` forwards there)
- Public email: dalilwayfinding@gmail.com
- Base: Sharjah, UAE. Founded at the University of Sharjah.
- Stage: pre-revenue, pre-seed. **Registered company** (founder, 2026-11-26; AcTax noted a SPARK licence in progress in October 2026: confirm the licence details). **IP: trademark and design registration in progress**, not yet granted.

## 2. The problem

- **21.8 million people** in MENA (the Middle East and North Africa) live with moderate-to-severe vision impairment.
- Floor numbers, exits and room names are on walls, out of reach of a hand. Independence ends at the door.
- The handrail is already in their hand, and it is completely blank.

## 3. The product (sticker range, from 2026-11-26)

A thin adhesive sticker carrying **braille only**. It sticks on door handles, handrails and walls.

| Size | Use | Size (prototype geometry) | What is on it |
|---|---|---|---|
| **S, door** (the main product) | Lever handles | 26.4 x 14 mm for a 3-cell message | Braille only |
| **M, rail** | Handrails, poles | 63.6 x 14 mm for 9 cells | Braille only |
| **L, wall** | Beside doors and lifts | 76 x 32.5 mm for 2 lines | Braille, plus one small flat printed ID line for the installer (not for the reader) |

- Safety yellow `#FFC700`, one material: the dots are the same yellow.
- 0.5 mm flat, 1.0 mm at a dot. Dots are rounded domes, 1.5 mm base, 0.5 mm high, 2.5 mm spacing, 6.2 mm cell pitch (inside ISO 17049). Tapered 3 mm edge.
- Peel and press. No tools, no drilling. Each install is surveyed and printed to fit.
- Arabic and English braille. Every message is checked by a braille reader before production.
- **No glow, no raised numbers, no rib code, no print on S and M.** Those belonged to the retired clip.
- Geometry and STL files: `departments/product/cad/` (`generate_wall_plates.py range`). Research: `departments/product/sticker-concept-research.md`.

## 4. Competition

| | DALIL | Wall tactile signs | Apps and beacons |
|---|---|---|---|
| Found by | The hand, on the rail | Searching a wall | A phone screen |
| Cost | AED 130 | AED 180–400 | Hardware and an app |
| Install time | 1 week | About 6 weeks | Weeks |
| Arabic braille | Built in | Often English only | Audio only |

Positioning: **Cheaper. Faster. No apps, no batteries.** Tone toward competitors: "We welcome competition."

AcTax (October 2026): online ADA braille signs sell at AED 82 to 119 each before fitting, so the AED 180 to 400 comparison needs UAE quotes. Do not claim "first in the UAE". Handrail products exist abroad (Marahrens, Germany; JIS T 0921, Japan) and Dubai Municipality installed a 319 m braille handrail at Dubai Frame (2023).

## 5. Market (UAE only)

**10k buildings. AED 170M market.**

| Segment | Buildings | Market |
|---|---|---|
| Towers | 3k | AED 62M |
| Education | 2k | AED 33M |
| Hotels | 1k | AED 33M |
| Healthcare | 3k | AED 28M |
| Government and culture | 700 | AED 9M |
| Malls, airports and metro | 150 | AED 5M |

## 6. Pricing and unit economics

- **Priced per floor. Everything included.**
- Average building: **AED 18k**, everything included. **58% margin.**
- A hospital: **AED 87k installed**, against **AED 118k–263k plus installation** for imported wall signs.
- Included: site visit and measuring, custom-fit clips and door tags, installation, accessibility map.
- Plus a **yearly care plan**.
- **AED 130 per clip** (website comparison table, against AED 180–400 per wall tactile sign). Quotes use AED 130 per point (clip or door tag) until a per-floor rate is set. Check: 138 points ≈ AED 18k average building; 669 points ≈ AED 87k hospital.
- **AcTax recommendation (October 2026, used in the November 2026 pitch deck):** list AED 150 a point, AED 130 for the first 10 reference sites; average building AED 20,700 at 150 (63% margin) or AED 17,940 at 130 (58%); care plan 10% a year from year 2; survey AED 1,500 credited to the order; minimum AED 7,500 a site; government frameworks 10 to 15% off for 5+ buildings. Unit costs (AED 54.5 a point today) are clip-era estimates and must be re-quoted for the sticker `[TO CONFIRM]`.
- Per-floor rate and care-plan price: `[TO CONFIRM]`. Door-tag price assumed AED 130, like a clip: `[TO CONFIRM]`. Set them in `dalil-hq/data/pricing.json`.

## 7. Roadmap (first 24 months)

| Month | Milestone | Detail |
|---|---|---|
| 1 | Set up | Workshop and printers ready |
| 6 | Certified | Fire and braille approved |
| 12 | First customers | First paying buildings installed |
| 24 | 22 buildings | AED 346k revenue in year 2 |

Start date of month 1: `[TO CONFIRM]`.

## 8. Go-to-market

- Order: **our own campus (University of Sharjah) → Sharjah → the UAE.**
- Sectors being approached: education, government, community, healthcare, transport, culture, real estate, innovation.
- Desired partner: **Sheraa** (Sharjah Entrepreneurship Center) and investors.

## 9a. Funding (AcTax plan, October 2026)

- Ask: **AED 400k in two tranches**: AED 250k at closing, AED 150k around month 10 on milestones (braille certified; material and fire test with Civil Defence acceptance; three pilots live with a user-test report; AED 50k+ of paid orders or letters of intent).
- Valuation: **AED 1.2M pre-money** (fair value about AED 1.0M, range 0.8 to 1.4M). Investor 17.2% after tranche 1, 22.1% after tranche 2, capped at 25%.
- 24-month base case (cash-flow model, CF4): 22 paying buildings; revenue AED 15,750 in year 1 and AED 339,727 in year 2; lowest cash AED 51,953 in month 9; AED 119,698 at month 24.
- Five-year base case (AcTax): buildings 1 + 2 pilots / 21 / 40 / 70 / 110; revenue AED 34k / 342k / 762k / 1,434k / 2,410k; EBITDA AED (221)k / 33k / 204k / 455k / 907k. Founders' estimates, unaudited.

## 9. Team

| Person | Role | Owns |
|---|---|---|
| **Ahmed Nazar** | Founder | The product itself: specifications, classification, marketing, production and the information behind every product. |
| **Mohammed Alarcon** | Co-founder, sales and business development | Sales, presentations and client relationships: positioning, communicating value, turning opportunities into business. |

Contact emails: ahmednazar422@gmail.com (Ahmed), dalilwayfinding@gmail.com (shared).

Closing line: "Two founders. One city. Every handrail can speak."

## 10. Systems already running

- Landing page on Netlify, with the waitlist form `investor-lead` (name, email, phone/WhatsApp, organisation, interests: investing / DALIL in my building / mentoring or partnering / following progress, investor type, ticket size, message).
- Sign-ups are emailed to both founders and can be copied to a Google Sheet.
- Privacy-first PostHog analytics on the page.
- QR code for the closing slide in `dalil/qr/`.
- Design system in `dalil/DESIGN.md`.

## 11. Open questions (founders to answer)

- [ ] Per-floor price and yearly care-plan price (and confirm door tags are AED 130 like clips)
- [ ] Funding ask: amount, instrument, use of funds (kept off the website on purpose)
- [x] Company registered (founder, 2026-11-26). Still to confirm: licence type and authority (AcTax: SPARK), and the mainland or government-vendor route.
- [ ] Month-1 start date of the roadmap
- [ ] Which fire and braille approvals exactly, and from which authority
- [ ] IP: trademark and design registration in progress (founder, 2026-11-26). Filing numbers and dates `[TO CONFIRM]`.
- [ ] Current pilots, letters of intent, or warm leads
