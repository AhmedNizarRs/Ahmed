#!/usr/bin/env python3
"""Independent logic check of a drawn plan against the brief and the rules.

  uv run --with shapely python check_plan.py SPEC.json ROOMS.json BRIEF.json [RULES.json]

SPEC   the spec given to arch_plan_from_spec (walls, openings)
ROOMS  rooms.json written by plan_cli.py (measured room outlines)
BRIEF  the programme (see templates/brief.example.json)
RULES  numeric rules (default templates/rules.uae.json). Never edit values without a cited source.

Checks: room present and big enough, accessible rooms fit the turning circle, door widths,
every room reachable from an entrance, required and forbidden door connections, windows.
Assumes the opening `width` in the spec is the CLEAR opening. Exit code 1 if any FAIL.
"""
import json, math, os, sys
from shapely.geometry import Point, Polygon
from shapely import maximum_inscribed_circle

HERE = os.path.dirname(os.path.abspath(__file__))
fails, warns, infos = [], [], []


def along(axis, d):
    """Point at distance d along a polyline axis."""
    for (x1, y1), (x2, y2) in zip(axis, axis[1:]):
        seg = math.hypot(x2 - x1, y2 - y1)
        if d <= seg or (x2, y2) == tuple(axis[-1]):
            t = d / seg if seg else 0
            return Point(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
        d -= seg
    return Point(*axis[-1])


def main(spec_p, rooms_p, brief_p, rules_p):
    spec, rooms_j, brief, rules = (json.load(open(p)) for p in (spec_p, rooms_p, brief_p, rules_p))
    walls = {w["id"]: w for w in spec["walls"]}
    polys = {}
    for r in rooms_j["rooms"]:
        lab = r.get("label") or {}
        name = lab.get("name")
        if name:
            polys[name] = (Polygon(r["loop"]), r["area_m2"])

    entrance = set(brief.get("entrance_doors", []))
    doors = [o for o in spec["openings"] if o["kind"] == "door"]
    windows = [o for o in spec["openings"] if o["kind"] == "window"]

    # --- rooms: present, area, turning circle
    for rm in brief["rooms"]:
        n = rm["name"]
        if n not in polys:
            fails.append(f"{n}: not found in the drawing (no label inside a closed room)")
            continue
        poly, area = polys[n]
        mn = rm.get("min_area_m2")
        if mn and area < mn:
            fails.append(f"{n}: area {area:.2f} m2 is below the brief's {mn} m2")
        else:
            infos.append(f"{n}: {area:.2f} m2" + (f" (min {mn})" if mn else ""))
        if rm.get("accessible"):
            d = maximum_inscribed_circle(poly, tolerance=10).length * 2  # diameter of the largest circle that fits
            need = rules["turning_circle_mm"]
            (fails if d < need else infos).append(f"{n}: largest clear circle {d:.0f} mm vs turning circle {need} mm")
        if rm.get("type") == "circulation":
            w = maximum_inscribed_circle(poly, tolerance=10).length * 2
            need = rules["route_clear_width_mm"]
            (fails if w < need else infos).append(f"{n}: route width about {w:.0f} mm vs {need} mm")

    # --- openings: which rooms each one touches
    def rooms_at(op):
        w = walls[op["wall"]]
        p = along(w["axis"], op["offset"] + op["width"] / 2)
        reach = w.get("thickness", 200) * 0.75 + 50
        return p, [n for n, (poly, _) in polys.items() if poly.distance(p) <= reach]

    graph = {n: set() for n in polys}
    outside_doors = set()
    for d in doors:
        tag = d["id"]
        need = rules["door_clear_entrance_mm"] if tag in entrance else rules["door_clear_internal_mm"]
        (fails if d["width"] < need else infos).append(f"door {tag}: {d['width']} mm vs {need} mm ({'entrance' if tag in entrance else 'internal'})")
        _, near = rooms_at(d)
        if len(near) >= 2:
            a, b = near[:2]
            graph[a].add(b); graph[b].add(a)
        elif len(near) == 1 and tag in entrance:
            outside_doors.add(near[0])
        elif len(near) == 1:
            warns.append(f"door {tag}: connects {near[0]} to the outside but is not listed in entrance_doors")
        else:
            warns.append(f"door {tag}: not next to any labelled room")

    # --- reachability from the entrance
    if not outside_doors:
        fails.append("no entrance door reaches a labelled room (check brief.entrance_doors)")
    else:
        seen, stack = set(), list(outside_doors)
        while stack:
            n = stack.pop()
            if n not in seen:
                seen.add(n); stack += list(graph[n] - seen)
        for n in polys:
            if n not in seen:
                fails.append(f"{n}: cannot be reached from the entrance through doors")
        infos.append("reachable from entrance: " + ", ".join(sorted(seen)))

    # --- adjacency demands
    for rm in brief["rooms"]:
        for other in rm.get("must_connect", []):
            if other not in graph.get(rm["name"], set()):
                fails.append(f"{rm['name']} must have a direct door to {other}")
        for other in rm.get("forbid_direct_door", []):
            if other in graph.get(rm["name"], set()):
                fails.append(f"{rm['name']} must NOT open directly into {other}")

    # --- windows and glazing
    wins = {n: 0.0 for n in polys}
    for wdw in windows:
        _, near = rooms_at(wdw)
        for n in near[:1]:
            wins[n] += wdw["width"] * wdw.get("height", 1200) / 1e6
    for rm in brief["rooms"]:
        n = rm["name"]
        if n in polys and rm.get("needs_window"):
            if wins[n] == 0:
                fails.append(f"{n}: needs a window and has none")
            else:
                ratio = wins[n] / polys[n][1]
                gmin = rules.get("glazing_ratio_min")
                if gmin and ratio < gmin:
                    warns.append(f"{n}: glazing {ratio:.0%} of floor area, reference value {gmin:.0%} [TO CONFIRM for UAE]")
                else:
                    infos.append(f"{n}: glazing {ratio:.0%} of floor area")

    for t, items in (("FAIL", fails), ("WARN", warns), ("ok  ", infos)):
        for i in items:
            print(f"{t}  {i}")
    print(f"\n{len(fails)} fail, {len(warns)} warn. Not a code approval: a licensed architect and the authority decide.")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) not in (3, 4):
        sys.exit(__doc__)
    main(a[0], a[1], a[2], a[3] if len(a) == 4 else os.path.join(HERE, "..", "templates", "rules.uae.json"))
