# DALIL: company facts (single source of truth)

Every DALIL agent reads this file before doing any work. If a number or claim is not here, do not invent it: mark it `[TO CONFIRM]` and ask a founder.

Last updated: 2026-11-05. Source: the DALIL landing page (`dalil/site/index.html`), which follows the v7 investor deck.

> **Founders: keep this file current.** When a price, milestone or customer changes, change it here first. All six departments will pick it up.

---

## 1. One line

**DALIL makes the existing path speak.** A 3D-printed clip that turns any handrail into braille, raised numbers and a glow in the dark. No app. No battery.

- Arabic name: دليل ("guide")
- Website: https://dalil-team.com (the old `dalil-invest.netlify.app` forwards there)
- Public email: dalilwayfinding@gmail.com
- Base: Sharjah, UAE. Founded at the University of Sharjah.
- Stage: pre-revenue, pre-seed. Building the waitlist of investors, mentors and first buildings.

## 2. The problem

- **21.8 million people** in MENA (the Middle East and North Africa) live with moderate-to-severe vision impairment.
- Floor numbers, exits and room names are on walls, out of reach of a hand. Independence ends at the door.
- The handrail is already in their hand, and it is completely blank.

## 3. The product

A small clip that snaps onto a handrail or handle and makes it readable.

**How it works: Clip, Find, Read**
1. **Clip.** Snaps on in seconds. No tools.
2. **Find.** A hand sliding along the rail meets it without searching.
3. **Read.** Braille and a raised number, for example "Floor 2. Exit left."

**No app. No battery. No renovation.**

**Tactile grammar.** Ribs on the clip tell the hand what kind of message it is before it reads:
| Rib type | Example messages |
|---|---|
| Information | Lift ahead, Prayer room, Rooms 201 to 215 |
| Safety | Ground floor, Exit, turn left |
| End of stairs | End of stairs |

**Every level of sight**
- **Touch:** braille for people who are blind (Arabic braille built in).
- **Sight:** high contrast and raised numbers for people with low vision.
- **Darkness:** photoluminescent glow for everyone when the lights fail.

**Where it goes (one module, same grammar)**
| Place | Fits |
|---|---|
| Stairs | Stair handrails, Ø30–50 mm |
| Schools | Classroom doors, lever handles |
| Hospitals | Corridor rails: flat, oval, timber |
| Metro | Carriage poles, platform rails |
| Buses | Grab poles, Ø32 mm vertical |
| Airports | Terminal and boarding-bridge rails |
| Towers | Stair-core doors, lever handles |
| Malls | Balustrade handrails |

Each install is **measured on site and printed to fit**. Brand colour: safety yellow `#FFC700` (the real product colour).

## 4. Competition

| | DALIL | Wall tactile signs | Apps and beacons |
|---|---|---|---|
| Found by | The hand, on the rail | Searching a wall | A phone screen |
| Cost | AED 130 | AED 180–400 | Hardware and an app |
| Install time | 1 week | About 6 weeks | Weeks |
| Works in a blackout | Yes, it glows | No | Only with a phone |
| Arabic braille | Built in | Often English only | Audio only |

Positioning: **Cheaper. Faster. No apps, no batteries.** Tone toward competitors: "We welcome competition."

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
- [ ] Company legal setup: licence type, free zone or mainland, date
- [ ] Month-1 start date of the roadmap
- [ ] Which fire and braille approvals exactly, and from which authority
- [ ] IP status: design registration or patent filed?
- [ ] Current pilots, letters of intent, or warm leads
