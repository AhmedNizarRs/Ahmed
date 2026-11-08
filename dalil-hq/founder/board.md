# DALIL · What the board said

Run: 2026-11-08, `/founder-board`. The three memos are in `board/` (`offers.md`, `monopoly.md`, `product.md`); the brief they read is `board/brief.md`. Each lens is a summary of a published framework, not the view of its author.

## 1. The vote

**3 fund if, 0 fund, 0 pass. Average score 4.0 / 10.**

| Lens | Score | Vote |
|---|---|---|
| Offers | 4 | FUND IF |
| Monopoly | 4 | FUND IF |
| Product | 4 | FUND IF |

All three like the insight and the shape of the offer. None will fund it as it stands, because nothing has been proven yet: not with users, not on a rail, not with a buyer.

## 2. The risks more than one member raised

1. **Nobody who will read it has used it** (all three). No user testing with people who are blind or have low vision yet, no logged durability tests, the spec is a v0 draft. The core promise (the hand finds it without searching, the ribs can be told apart, the braille reads cleanly on a curved rail) is untested.
2. **It sits on a safety rail, and the certification route is unknown** (all three). Which approvals, from which authority, at what cost and lead time: [TO CONFIRM]. Month 6 is on the roadmap with nothing started. A clip that loosens, turns or cracks on a handrail is a hazard, not just a refund.
3. **The margin is a claim, not a calculation** (all three). The 58% margin sits next to a material cost per clip, print time, failure rate and site-visit and install cost that are all [TO CONFIRM].
4. **No proven way to reach and close the buyer** (Offers, Monopoly). One target in the pipeline, the University of Sharjah, and the person who can sign has not been found. No pilot, no letter of intent, waitlist count [TO CONFIRM]. The cost of winning one building is unknown.
5. **Replacement or add-on?** (Offers, Monopoly). If a UAE or Sharjah code still requires wall tactile signs, DALIL is an extra cost on top of them. The "cheaper than wall signs" comparison (AED 130 against AED 180–400; hospital AED 87k against AED 118k–263k) would then stop working, and the buyer needs a different reason to pay.

Raised by one member only:
- **No moat against a copycat** (Monopoly). Printing is easy to get, IP is [TO CONFIRM], and the price gap is under three times, not ten. A signage supplier already selling to the same facilities teams could add a rail clip.
- **Too many mounts, too many handoffs** (Product). Seven mounting contexts across eight sectors, each measured, printed, installed, mapped and maintained. Every handoff is a place where quality slips. Who notices a missing clip a year later?
- **Leading on price makes it a commodity** (Offers). The pitch opens with "cheaper". Lead with what only DALIL does instead.

## 3. Conditions: the checklist

Each item names the place in the pack, or the DALIL department, that tests it.

**Proof with real people**
- [ ] First round of user testing with people who are blind and people with low vision, on printed clips on a real stair rail, before any paid sale. Record find time, read accuracy for each rib type and comfort of grip, and write down what failed. (`dalil-accessibility`, `/dalil-user-test`. Simulated buyers in `/founder-consumer` cannot stand in for this.)
- [ ] An Arabic braille reader checks a printed sample against the chosen standard. (`dalil-product`, `dalil-accessibility`)

**A product you can stand behind**
- [ ] Written v1 spec for one mount: braille dimensions, material, glow duration, with pass/fail thresholds set before testing. (`dalil-product`)
- [ ] Logged tests: grip load and pull-off, cleaning chemicals, wear, UV and heat, glow. (`dalil-product`, `product/test-log.csv`)
- [ ] The certification route named (which approvals, which authority), and an accredited UAE lab's view on whether a handrail clip needs one, before Month 6 is promised. (`dalil-product`, `product/certification-tracker.md`)
- [ ] The service mapped end to end (site visit, measure, print, install, map, care check), with one owner per handoff and a process for replacing a missing clip. (`/founder-ops`)

**A buyer and a reason to buy**
- [ ] A named decision-maker and a signed pilot or letter of intent, starting with the University of Sharjah. (`dalil-sales`)
- [ ] The buyer's trigger written down: the regulation, tender or mandate that makes a building buy this year. (`dalil-sales`, `/founder-competitors`)
- [ ] Whether DALIL replaces wall signs under local code or comes on top of them. (`dalil-product`, with a professional's sign-off)
  - Partly answered for Dubai: the Dubai Universal Design Code puts braille signage on the door jamb at 1500 mm and asks for English Grade 1 braille, so DALIL looks like an add-on there. Sharjah and the Fire and Life Safety Code still `[TO CONFIRM]`. See `competitors.md` §4d.

**Numbers that check**
- [ ] Margin rebuilt from real costs: cost per clip, print time, failure rate, site-visit and installation labour. (`/founder-cfo`)
- [ ] Cost to win one building. (`/founder-cfo`, `/founder-marketing`)
- [ ] Per-floor rate and care-plan price set. (`/founder-pricing`, `dalil-hq/data/pricing.json`)
- [ ] Check the year-2 figure against the average building: AED 346k across 22 buildings is about AED 15.7k a building, below the AED 18k average. Is the mix of buildings different, or does one number need updating? (`/founder-cfo`)
- [x] Named competitors, what they charge and what their customers complain about, including whether braille on handrails already exists anywhere. (`/founder-competitors`, done 2026-11-08: it exists in six countries, in the Gulf and at the Dubai Frame; see `competitors.md`)

**An offer and a moat**
- [ ] Lead the offer with "found by the hand, works in a blackout, installed in a week", not with price. Add a guarantee the CFO can afford (for example, free replacement under the care plan) and a clear name for the per-floor package. (`/founder-offer`)
- [ ] Design registration or patent filing started. (A UAE IP lawyer decides.)
- [ ] One community partner engaged on the tactile grammar, so it can become the local convention. (`dalil-accessibility`)

## 4. Where they disagree

- **Narrow or broad.** The Product lens wants one mount (the campus stair handrail) and everything else cut until it works. The Monopoly lens sees one tactile grammar across many places as the way to a standard, and so a moat. These fit together in sequence: the grammar can be the long game, but only once one mount is proven.
- **Price.** The Offers lens thinks there is room to charge more, given the hospital comparison. The Monopoly lens warns that a price gap under three times is not a defence. Both reject "cheaper" as the main reason to buy.
- **What counts as proof.** The Offers lens asks for a guarantee to raise the buyer's confidence. The Product lens says no guarantee replaces real users reading the clip. Both are needed; the testing comes first.

## 5. The strongest version the board can see

Narrower than the pitch. DALIL starts as **one product in one place**: a clip for stair handrails Ø30–50 mm, on the University of Sharjah campus, tested and refined with people who are blind and people with low vision before anyone pays. It is sold not as a cheaper wall sign but as the only sign the hand meets without searching and the only one that still works in a blackout, with installation in a week and a care plan that replaces any clip that fails. The proof from the campus (find time, read accuracy, logged durability, a named approval route) becomes the sales material for Sharjah. The tactile grammar, built with a community partner and protected by a design filing, becomes the convention other buildings and suppliers follow. Schools, hospitals, metro, buses, airports and malls come after, one mount at a time. The pitch today covers eight sectors and seven mounts at once; the board would fund the stair handrail first.

_The board applies published frameworks to the facts in `DALIL-facts.md`. Not financial, legal or certification advice._
