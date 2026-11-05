#!/usr/bin/env python3
"""DALIL quote calculator.

Reads rates from dalil-hq/data/pricing.json and a building description (JSON),
then prints a price table. Uses the per-floor rate when set, otherwise AED 130 per point
(clip or door tag), the price on the DALIL website.

Usage:
    python3 .claude/skills/dalil-quote/quote.py --input building.json
    python3 .claude/skills/dalil-quote/quote.py --floors 4 --clips 48 --door-tags 30 --type education
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PRICING = ROOT / "dalil-hq" / "data" / "pricing.json"


def aed(n):
    return f"AED {n:,.0f}"


def main():
    p = argparse.ArgumentParser(description="DALIL quote calculator")
    p.add_argument("--input", help="JSON file describing the building")
    p.add_argument("--client", default="")
    p.add_argument("--building", default="")
    p.add_argument("--type", default="tower")
    p.add_argument("--floors", type=int)
    p.add_argument("--clips", type=int, default=0)
    p.add_argument("--door-tags", dest="door_tags", type=int, default=0)
    p.add_argument("--care-plan", dest="care_plan", action="store_true")
    p.add_argument("--json", action="store_true", help="print the result as JSON")
    a = p.parse_args()

    b = vars(a).copy()
    if a.input:
        b.update(json.loads(Path(a.input).read_text()))
    if not b.get("floors"):
        sys.exit("Need the number of floors (--floors or \"floors\" in the input file).")

    cfg = json.loads(PRICING.read_text())
    r = cfg["rates"]
    mult = cfg["multipliers_by_building_type"].get(b["type"], 1.0)

    bm = cfg["benchmarks"]
    per_floor = r.get("per_floor_aed")
    lines = []
    if per_floor is not None:
        method = "per floor"
        lines.append(("Floors", b["floors"], per_floor * mult))
        if b.get("door_tags"):
            lines.append(("Door tags", b["door_tags"], r["door_tag_unit_aed"]))
    else:
        method = "per point (AED %d each, from the website)" % r["clip_unit_aed"]
        if not (b.get("clips") or b.get("door_tags")):
            sys.exit("Per-floor rate not set, so the quote is per point: give --clips and/or --door-tags.\n"
                     f"Rough guide: an average building is about {bm['implied_points_average_building']} points "
                     f"(AED {bm['average_building_aed']:,}), a hospital about {bm['implied_points_hospital']}.")
        if b.get("clips"):
            lines.append(("Handrail clips", b["clips"], r["clip_unit_aed"] * mult))
        if b.get("door_tags"):
            lines.append(("Door tags", b["door_tags"], r["door_tag_unit_aed"] * mult))
    if r.get("site_visit_aed"):
        lines.append(("Site visit and measuring", 1, r["site_visit_aed"]))

    subtotal = sum(q * u for _, q, u in lines)
    vat = subtotal * cfg["vat"]["rate"] if cfg["vat"]["registered"] else 0.0
    total = subtotal + vat
    care_rate = r.get("care_plan_per_year_aed")
    care = care_rate if b.get("care_plan") else None

    result = {
        "client": b.get("client", ""), "building": b.get("building", ""), "type": b["type"],
        "lines": [{"item": n, "qty": q, "unit_aed": u, "total_aed": q * u} for n, q, u in lines],
        "method": method,
        "floors": b["floors"],
        "clips_in_scope": b.get("clips", 0),
        "subtotal_aed": subtotal, "vat_aed": vat, "total_aed": total,
        "care_plan_per_year_aed": care,
        "care_plan_requested": bool(b.get("care_plan")),
        "validity_days": cfg["quote_validity_days"],
    }
    if a.json:
        print(json.dumps(result, indent=2))
        return

    print(f"DALIL quote — {result['client']} {result['building']} ({b['type']})")
    print("-" * 60)
    for l in result["lines"]:
        print(f"{l['item']:<28}{l['qty']:>6} x {aed(l['unit_aed']):>12} = {aed(l['total_aed']):>12}")
    if per_floor is not None and result["clips_in_scope"]:
        print(f"{'Clips (included)':<28}{result['clips_in_scope']:>6}")
    print(f"Pricing: {method}. Floors in scope: {b['floors']}")
    print("Included: site visit and measuring, custom-fit clips, installation, accessibility map")
    print("-" * 60)
    print(f"{'Subtotal':<48}{aed(subtotal):>12}")
    if cfg["vat"]["registered"]:
        print(f"{'VAT 5%':<48}{aed(vat):>12}")
    print(f"{'Total':<48}{aed(total):>12}")
    if b.get("care_plan"):
        print(f"{'Yearly care plan (optional)':<48}{aed(care) if care is not None else 'to confirm':>12}")
    print(f"Valid for {result['validity_days']} days. Final price confirmed after the site visit.")


if __name__ == "__main__":
    main()
