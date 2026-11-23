#!/usr/bin/env python3
"""Room metrics, layout edits and option comparison. Standard library only.

Usage: python3 layout_tools.py metrics layout.json [--state night]
       python3 layout_tools.py compare a.json b.json [c.json ...]

The MCP server exposes these as room_metrics, edit_layout and compare_layouts.
All sizes are metres, areas m², volumes m³.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_layout as cl  # noqa: E402

GRID = 0.05                 # floor sampling step for free-floor area
NOT_OBJECTS = {"route", "niche", "curtain", "board", "hooks", "mirror"}   # don't take floor space
STORAGE = {"wardrobe", "closet", "cabinet", "drawers", "shelf", "tv_unit", "pooja_unit"}
WORKTOP = {"counter", "sink", "cooktop", "island"}
SEAT_WIDTH = 0.6            # one seat per 0.6 m of sofa or bench
IRC_GLAZING = 0.08          # [IRC R303.1] glazing ≥ 8 % of the floor area of habitable rooms
WINDOW_H = 1.2


class EditError(ValueError):
    """An edit operation that can't be applied (unknown id, bad field)."""


def _r(v, n=2):
    return round(v + 0.0, n)


def metrics(layout, state=None):
    """Numbers that describe how well a layout uses its room, for one state."""
    if state is None and layout.get("states"):
        state = layout["states"][0]
    view = cl.apply_state(layout, state)
    room = view["room"]
    W, D, H = room["width"], room["depth"], room.get("height", 2.7)
    els = [e for e in view.get("elements", []) if e.get("type") not in NOT_OBJECTS]

    # free floor: sample the floor on a grid and count cells nothing low stands on
    floor_items = [cl.rect(e) for e in els if (e.get("z", 0) or 0) < cl.FLOOR_OBSTACLE_Z]
    nx, ny = max(1, round(W / GRID)), max(1, round(D / GRID))
    covered = 0
    for i in range(nx):
        x = (i + 0.5) * W / nx
        col = [r for r in floor_items if r[0] <= x < r[1]]
        if not col:
            continue
        for j in range(ny):
            y = (j + 0.5) * D / ny
            if any(r[2] <= y < r[3] for r in col):
                covered += 1
    floor_area = W * D
    free = floor_area * (1 - covered / (nx * ny))

    def longer(e):
        return max(e["w"], e["d"])

    beds = [e for e in els if e["type"] == "bed"]
    sleeping = sum(2 if min(e["w"], e["d"]) >= cl.DOUBLE_WIDTH else 1 for e in beds)
    seats = sum(max(1, int(longer(e) / SEAT_WIDTH)) for e in els if e["type"] in ("sofa", "seat", "swing"))
    seats += sum(1 for e in els if e["type"] == "chair")
    storage = sum(e["w"] * e["d"] * e.get("h", 0) for e in els if e["type"] in STORAGE)
    hanging = sum(longer(e) for e in els if e["type"] in ("wardrobe", "closet") and e.get("h", 0) >= 1.0)
    worktop = sum(longer(e) for e in els if e["type"] in WORKTOP)
    ops = room.get("openings", [])
    windows = [o for o in ops if o.get("type") != "door"]
    glazing = sum(o["width"] * o.get("height", WINDOW_H) for o in windows)
    zones = {}
    for e in els:
        if e.get("zone"):
            zones[e["zone"]] = zones.get(e["zone"], 0) + 1
    rep = cl.check_all(layout)
    return {
        "state": state,
        "room": {"name": room.get("name"), "type": room.get("type"), "width": W, "depth": D, "height": H},
        "floor_area_m2": _r(floor_area),
        "free_floor_m2": _r(free),
        "free_floor_pct": _r(100 * free / floor_area, 1),
        "volume_m3": _r(floor_area * H),
        "elements": len(els),
        "sleeping_places": sleeping,
        "seats": seats,
        "storage_volume_m3": _r(storage),
        "hanging_rail_m": _r(hanging),
        "worktop_run_m": _r(worktop),
        "doors": len(ops) - len(windows),
        "windows": len(windows),
        "glazing_m2": _r(glazing),
        "glazing_ratio": _r(glazing / floor_area, 3),
        "meets_irc_glazing_8pct": glazing / floor_area >= IRC_GLAZING,
        "elements_per_zone": zones,
        "check": {"errors": len(rep.errors), "warnings": len(rep.warns), "ok": not rep.errors},
    }


# ---------------------------------------------------------------- edits

ROTATE_FRONT = {"+x": "+y", "+y": "-x", "-x": "-y", "-y": "+x"}   # quarter turn anticlockwise (plan view)
EDITABLE = {"x", "y", "z", "w", "d", "h", "label", "type", "zone", "front", "owner", "clearance",
            "material", "doors", "guardrail", "guardrail_height", "serves", "states", "note", "wall"}


def edit(layout, operations):
    """Apply edit operations to a copy of the layout. Returns (new_layout, changes)."""
    if not isinstance(operations, list) or not operations:
        raise EditError("operations must be a non-empty list")
    out = json.loads(json.dumps(layout))
    els = out.setdefault("elements", [])
    changes = []

    def find(eid):
        for e in els:
            if e.get("id") == eid:
                return e
        raise EditError(f"no element with id {eid!r}; ids are {[e.get('id') for e in els]}")

    for n, op in enumerate(operations, 1):
        if not isinstance(op, dict) or "op" not in op:
            raise EditError(f"operation {n} needs an 'op' field")
        kind = op["op"]
        if kind == "add":
            e = op.get("element")
            if not isinstance(e, dict) or not all(k in e for k in ("id", "type", "x", "y", "w", "d")):
                raise EditError(f"operation {n}: add needs element with id, type, x, y, w, d (and h, z)")
            if any(x.get("id") == e["id"] for x in els):
                raise EditError(f"operation {n}: id {e['id']!r} already exists")
            els.append(dict(e))
            changes.append(f"added {e['id']}")
        elif kind == "remove":
            e = find(op.get("id"))
            els.remove(e)
            changes.append(f"removed {e['id']}")
        elif kind == "move":
            e = find(op.get("id"))
            for k in ("x", "y", "z"):
                if k in op:
                    e[k] = _num(op[k], n, k)
                if "d" + k in op:
                    e[k] = round(e.get(k, 0) + _num(op["d" + k], n, "d" + k), 4)
            changes.append(f"moved {e['id']} to x={e['x']}, y={e['y']}, z={e.get('z', 0)}")
        elif kind == "resize":
            e = find(op.get("id"))
            for k in ("w", "d", "h"):
                if k in op:
                    v = _num(op[k], n, k)
                    if v <= 0:
                        raise EditError(f"operation {n}: {k} must be positive")
                    e[k] = v
            changes.append(f"resized {e['id']} to {e['w']} × {e['d']} × {e.get('h')}")
        elif kind == "rotate":
            # quarter turn about the element's centre: swap width and depth, turn the front
            e = find(op.get("id"))
            cx, cy = e["x"] + e["w"] / 2, e["y"] + e["d"] / 2
            e["w"], e["d"] = e["d"], e["w"]
            e["x"], e["y"] = round(cx - e["w"] / 2, 4), round(cy - e["d"] / 2, 4)
            f = e.get("front")
            if isinstance(f, str) and f in ROTATE_FRONT:
                e["front"] = ROTATE_FRONT[f]
            elif isinstance(f, list):
                e["front"] = [ROTATE_FRONT.get(v, v) for v in f]
            changes.append(f"rotated {e['id']} (now {e['w']} × {e['d']}, front {e.get('front')})")
        elif kind == "set":
            e = find(op.get("id"))
            fields = op.get("fields")
            if not isinstance(fields, dict) or not fields:
                raise EditError(f"operation {n}: set needs a fields object")
            bad = sorted(set(fields) - EDITABLE)
            if bad:
                raise EditError(f"operation {n}: can't set {bad}; settable fields are {sorted(EDITABLE)}")
            for k, v in fields.items():
                if v is None:
                    e.pop(k, None)
                else:
                    e[k] = v
            changes.append(f"set {', '.join(sorted(fields))} on {e['id']}")
        elif kind == "set_room":
            fields = op.get("fields")
            if not isinstance(fields, dict) or not fields:
                raise EditError(f"operation {n}: set_room needs a fields object")
            out["room"].update(fields)
            changes.append(f"set room {', '.join(sorted(fields))}")
        else:
            raise EditError(f"operation {n}: unknown op {kind!r}; use add, remove, move, resize, rotate, set or set_room")
    return out, changes


def _num(v, n, k):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise EditError(f"operation {n}: {k} must be a number")
    return v


# ---------------------------------------------------------------- comparison

KEY_METRICS = ("free_floor_pct", "storage_volume_m3", "sleeping_places", "seats", "worktop_run_m", "glazing_ratio")


def compare(options):
    """Compare 2-6 layout options. options: [{"name", "layout", "state"?}]."""
    rows = []
    for k, opt in enumerate(options):
        layout = opt["layout"]
        m = metrics(layout, opt.get("state"))
        res = cl.result(layout)
        rows.append({"name": opt.get("name") or layout.get("room", {}).get("name") or f"option {k + 1}",
                     "errors": len(res["errors"]), "warnings": len(res["warnings"]), "ok": res["ok"],
                     "first_errors": res["errors"][:3],
                     **{key: m[key] for key in KEY_METRICS}})
    ranked = sorted(rows, key=lambda r: (r["errors"], r["warnings"], -r["free_floor_pct"], -r["storage_volume_m3"]))
    best = ranked[0]
    why = ("it has no errors" if best["ok"] else f"it has the fewest errors ({best['errors']})")
    if len(ranked) > 1 and ranked[1]["errors"] == best["errors"]:
        if ranked[1]["warnings"] != best["warnings"]:
            why += f" and fewer warnings ({best['warnings']} vs {ranked[1]['warnings']})"
        else:
            why += f" and more free floor ({best['free_floor_pct']}% vs {ranked[1]['free_floor_pct']}%)"
    return {"options": rows, "ranking": [r["name"] for r in ranked],
            "summary": f"{best['name']} ranks first: {why}. Ranking is by errors, then warnings, then free floor, then storage; it is a starting point, not a verdict on taste or budget."}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "-h" in sys.argv or "--help" in sys.argv or len(args) < 2:
        print(__doc__)
        sys.exit(0 if ("-h" in sys.argv or "--help" in sys.argv) else 2)
    cmd, files = args[0], args[1:]
    state = None
    if "--state" in sys.argv:
        i = sys.argv.index("--state")
        state = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
        files = [f for f in files if f != state]
    try:
        layouts = [json.loads(Path(f).read_text()) for f in files]
    except OSError as e:
        sys.exit(f"Can't open {e.filename}: {e.strerror}")
    except json.JSONDecodeError as e:
        sys.exit(f"Not valid JSON: {e.msg} (line {e.lineno}, column {e.colno})")
    if cmd == "metrics":
        print(json.dumps(metrics(layouts[0], state), indent=2, ensure_ascii=False))
    elif cmd == "compare" and len(layouts) >= 2:
        print(json.dumps(compare([{"name": Path(f).stem, "layout": L} for f, L in zip(files, layouts)]), indent=2, ensure_ascii=False))
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
