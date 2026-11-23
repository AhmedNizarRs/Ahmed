# Safety rules

`scripts/check_layout.py` enforces the rules marked ✔. Source tags are explained in `sources.md`. When sources differ, the stricter value wins.

## Raised beds

| Rule | Value | Source | Checked |
|---|---|---|---|
| A bed counts as **raised** when its sleeping surface (mattress top) is above | 0.60 m (or the foundation underside is above 0.76 m) | [EN747] [CPSC] | ✔ |
| Guardrails on **both long sides** of a raised bed; a wall-side rail is still needed unless the bed is fixed tight to the wall with no gap | required | [CPSC] | ✔ (`guardrail: true`) |
| Guardrail top above the mattress top | ≥ 0.16 m (CPSC minimum is 0.13 m) | [EN747] [CPSC] | ✔ (`guardrail_height`) |
| Gap between a guardrail end and the bed end | ≤ 0.38 m | [CPSC] | |
| Openings in rails and ends | Avoid gaps that could trap a head; keep them under about 60 mm or over 230 mm | [CPSC] [EN747] | |
| Maximum top-mattress thickness | 0.15–0.20 m, chosen so the guardrail rule still holds | [RET] | ✔ (via guardrail height) |
| Minimum age for the upper bed | 6 years | [CPSC] | ✔ (warns if an occupant is under 6) |
| Access by fixed ladder or storage steps, with anti-slip treads and a grab point at the top | required | [CPSC] [DI 16, 47, 60] | ✔ (an access element must `serve` the bed) |
| Step rise: give `rise`/`tread` on `steps` | > 0.25 m error; > 0.22 m or tread < 0.22 m warns as steep (handrail, alternating treads) | [std] | ✔ |

## Headroom

| Rule | Value | Source | Checked |
|---|---|---|---|
| Ceiling above the raised mattress top: recommended | ≥ 0.84 m (sitting up) | [RET] | ✔ warning |
| Ceiling above the raised mattress top: minimum | ≥ 0.76 m | [RET] | ✔ error |
| Lower bunk: underside of upper bed above the lower mattress | same as above: ≥ 0.84 m recommended, ≥ 0.76 m minimum | [RET] | ✔ |
| Clear height under a loft at a desk (seated) | ≥ 1.5 m | [std] | ✔ |
| Clear height under a loft for walking through | ≥ 1.9 m | [std] [DI 42] | ✔ |
| Clear height under a loft for a den or sofa (sitting only) | ≥ 1.0 m | [std] | ✔ |
| Room ceiling for a habitable room (US) | ≥ 2.13 m (7 ft); check the local code | IRC R305 (unverified here) | |

Quick feasibility check: a loft over a desk needs about 1.5 m under it, plus about 0.25 m of platform and mattress, plus 0.84 m of headroom. That is roughly 2.6 m of ceiling. With less height, use a half-height bed (about 0.8 m) or an offset or side-by-side layout instead.

## Windows and egress

- **Every sleeping area needs its own escape window.** When a partition or interior door splits a room, each part with a bed must reach an egress window without going through the closed door [IRC]. ✔ (error; model partitions and interior doors as `partition` / `door` elements at least 1.8 m tall)
- Each bedroom keeps at least one **escape window** operable and reachable. Don't put tall fixed furniture in front of it. Its sill must be ≤ 1.12 m, or there must be a fixed step [IRC]. ✔ (the checker warns when an element above 1.0 m tall blocks a window marked `egress`)
- Raised beds or guardrails next to a window need **window guards or restrictors** [DI 42]. ✔ warning
- Bay-window desks and beds are fine. Keep window handles reachable.

## Structure

- Build raised beds as steel or solid timber frames, fixed to the floor, walls or ceiling, or standing on their own columns [DI 80, 82]. Have the anchoring confirmed by a professional.
- **Never cut niches or openings into load-bearing walls** [DI 69, 82]. If the user doesn't know which walls are load-bearing, assume they all are. ✔ (error if a `niche` sits on a wall marked `load_bearing`)
- Cantilevers beyond the facade, as in micro-units [DI 34, 48, 57], always need an engineer and planning permission. Never present one as a DIY option.

## Circulation and doors

- The door swing area stays clear. ✔
- **Getting into bed:** a floor bed needs a free strip at least 0.6 m deep and 0.9 m long along one long side. A double bed (≥ 1.2 m wide) needs that on both sides, or the brief must state that one sleeper gets in from the foot. ✔ (warning)
- **Convertible furniture** (wall beds, fold-down desks): list `states` in the layout, such as `["night", "day"]`, and give each element its per-state overrides. Each state is checked on its own, so the open desk and the lowered bed both have to fit. ✔
- The space in front of wardrobes, drawers, desks and steps stays clear for the depth given in `dimensions.md`. ✔
- Padded wall panels beside raised beds; rounded corners in kids' rooms [DI many].

## Room-type checks
The checker turns on extra rules based on `room.type`. The values and sources are in each room module:
- `kitchen`: work aisle and walkway clearances; work-triangle total and leg lengths (`rooms/kitchen.md`).
- `bathroom`: toilet side and front clearance, basin front clearance, shower size and entry clearance (`rooms/bathroom.md`).
- `living`, `dining`, `living_dining`: distance from the sofa to the coffee table (`rooms/living-dining.md`).
- any room with a `stairs` element: riser, tread, width and headroom (`rooms/entry-circulation.md`).
- **Window falls (every room):** if an opening has `drop_outside` > 1.83 m and its sill is < 0.61 m above the floor, it needs fall protection [IRC R312.2, verify]. The checker warns, and also warns when climbable furniture (beds, desks, seats, steps) stands under a window with a big outside drop.

## Electrical

- Outlets go in before cladding. An electrician does wet-area and in-furniture wiring. LED strips in steps run on low voltage [DI 62].
