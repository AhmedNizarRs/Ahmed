---
name: dalil-quote
description: Build a DALIL quote and proposal for a building (per-floor pricing, clips, door tags, installation, accessibility map, yearly care plan, optional VAT), compared with imported wall tactile signs. Use when the founder asks for a quote, price, estimate, proposal or offer for a building, school, hospital, tower, hotel, mall or government site.
---

# DALIL quote and proposal

## Steps

1. **Collect the building details.** Ask only for what's missing:
   - Client name, building name, emirate, building type (tower, education, hotel, healthcare, government, mall_airport_metro)
   - Number of floors, number of staircases
   - Estimated clips (handrail points) and door tags. If unknown, say they're confirmed at the site visit.
   - Rail types (round Ø30–50 mm, flat, oval, timber, Ø32 poles, lever handles)
   - Care plan: yes or no

2. **Run the calculator** with the details in a JSON file:

```bash
python3 .claude/skills/dalil-quote/quote.py --input building.json
```

   Example input:
```json
{"client": "Example School", "building": "Block A", "type": "education",
 "floors": 4, "staircases": 2, "clips": 48, "door_tags": 30, "care_plan": true}
```

   The script reads `dalil-hq/data/pricing.json`. If a needed rate is `null`, it stops and lists what's missing. **Do not guess the rate.** Ask a founder to fill it in `pricing.json`, or give only an *indicative* range from the benchmarks, clearly labelled "Indicative, to be confirmed after the site visit."

3. **Write the proposal** (save to `dalil-hq/departments/sales/proposals/<client>-<YYYY-MM-DD>.md`):
   1. The problem in their building (one paragraph, specific to their type)
   2. What DALIL does: Clip, Find, Read. Touch, sight, darkness.
   3. Scope: floors, staircases, clips, door tags, rail types
   4. What's included: site visit and measuring, custom-fit clips and door tags, installation, accessibility map
   5. Price table from the calculator, plus the yearly care plan
   6. Comparison with imported wall signs (from `DALIL-facts.md`: AED 180–400 per sign, about 6 weeks to install; hospital benchmark AED 118k–263k plus installation)
   7. Timeline: site visit → printing → installation in about 1 week
   8. Next step: book the site visit
   9. Validity: from `pricing.json` (`quote_validity_days`)

4. For a polished file, use `anthropic-skills:docx` or `anthropic-skills:pdf`. Offer an Arabic version.

## Rules
- Never promise certification status that `dalil-hq/departments/product/certification-tracker.md` doesn't show.
- Charge VAT only if `vat.registered` is true in `pricing.json`.
- The price is final only after the site visit. Say so on every proposal.
