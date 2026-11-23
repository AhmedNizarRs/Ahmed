#!/usr/bin/env python3
"""Check a room layout JSON against references/safety.md, references/dimensions.md
and the room module for its room.type (kitchen, bathroom, living, stairs...).

Usage: python3 check_layout.py layout.json [--plan] [--json]

Prints ERROR / WARN lines and exits 1 if any ERROR. --plan also prints ASCII
top views (floor level and upper level, 1 char = 10 cm). If the layout lists
"states" (e.g. night/day for fold-down furniture), each state is checked and
drawn separately. --json prints one JSON object instead, for other tools to
read: {"errors": [...], "warnings": [...], "ok": bool}, plus "plans" with
--plan. Standard library only.
"""
import json
import sys

EPS = 0.005

RAISED_TOP = 0.60          # [EN747] sleeping surface
RAISED_UNDERSIDE = 0.76    # [CPSC] foundation underside
RAIL_MIN = 0.13            # [CPSC]
RAIL_REC = 0.16            # [EN747] summaries
HEADROOM_MIN = 0.76        # [RET]
HEADROOM_REC = 0.84        # [RET]
UPPER_MIN_AGE = 6          # [CPSC]
UNDER_CLEAR = {"desk": 1.5, "den": 1.0, "sofa": 1.0, "seat": 1.0}  # [std]
WALK_UNDER = 1.9           # [std]
OUTLET_REACH = 1.0
BEDSIDE = 0.6              # [BO] [IDE] free depth beside a bed
BEDSIDE_RUN = 0.9          # [std] free length of that strip needed to get in
DOUBLE_WIDTH = 1.2         # beds this wide sleep two
BARRIERS = {"partition", "door"}
GRID = 0.05
NO_COLLIDE = {"curtain", "board", "hooks", "niche", "chair", "route", "mirror"}
STEP_RISE_MAX = 0.25       # [std] steep box steps / alternating treads, handrail needed
STEP_COMFORT = (0.22, 0.22)  # [std] rise max, tread min for comfortable storage stairs
FLOOR_OBSTACLE_Z = 1.0     # anything starting below this blocks floor clearance

# Kitchen [NKBA]
KITCHEN_WORK = {"counter", "sink", "cooktop", "oven", "fridge", "dishwasher", "island"}
WORK_AISLE = 1.07
WALKWAY = 0.91
TRIANGLE_MAX = 7.9
LEG_MIN, LEG_MAX = 1.2, 2.7
# Bathroom [IRC-P] minimum / [NKBA] recommended
WC_SIDE = (0.38, 0.46)
WC_FRONT = (0.53, 0.76)
LAV_FRONT = 0.53
SHOWER_SIDE = (0.76, 0.91)
SHOWER_AREA = 0.58
SHOWER_FRONT = (0.61, 0.76)
# Living [RET-L]
COFFEE_GAP = (0.36, 0.46)
# Stairs [IRC-S]
STAIR_RISE_MAX = 0.196
STAIR_TREAD_MIN = 0.254
STAIR_WIDTH_MIN = 0.914
STAIR_HEADROOM = 2.03
# Window falls [IRC R312.2]
FALL_DROP = 1.83
FALL_SILL = 0.61
CLIMBABLE = {"bed", "desk", "seat", "sofa", "steps", "platform", "table", "counter"}


class Report:
    def __init__(self):
        self.errors, self.warns = [], []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warns.append(msg)


def xy_overlap(a, b):
    return (min(a[1], b[1]) - max(a[0], b[0]) > EPS) and (min(a[3], b[3]) - max(a[2], b[2]) > EPS)


def rect(e):
    return (e["x"], e["x"] + e["w"], e["y"], e["y"] + e["d"])


def z_overlap(a, b):
    return min(a["z"] + a["h"], b["z"] + b["h"]) - max(a["z"], b["z"]) > EPS


def wall_point(room, wall, offset):
    W, D = room["width"], room["depth"]
    return {"S": (offset, 0.0), "N": (offset, D), "W": (0.0, offset), "E": (W, offset)}.get(wall)


def wall_span_rect(room, wall, offset, width, depth):
    """Rectangle of floor `depth` deep, in front of a wall span."""
    W, D = room["width"], room["depth"]
    if wall == "S":
        return (offset, offset + width, 0.0, depth)
    if wall == "N":
        return (offset, offset + width, D - depth, D)
    if wall == "W":
        return (0.0, depth, offset, offset + width)
    return (W - depth, W, offset, offset + width)


def fronts(e):
    """An element's used sides: 'front' may be one direction or a list (islands, dining tables)."""
    f = e.get("front")
    if not f:
        return []
    return f if isinstance(f, list) else [f]


def front_rect(e, direction=None):
    x0, x1, y0, y1 = rect(e)
    c = e["clearance"]
    return {
        "+x": (x1, x1 + c, y0, y1),
        "-x": (x0 - c, x0, y0, y1),
        "+y": (x0, x1, y1, y1 + c),
        "-y": (x0, x1, y0 - c, y0),
    }[direction or fronts(e)[0]]


def dist_point_rect(p, r):
    dx = max(r[0] - p[0], 0, p[0] - r[1])
    dy = max(r[2] - p[1], 0, p[1] - r[3])
    return (dx * dx + dy * dy) ** 0.5


def is_flush(o, room):
    """Thin wall-mounted item (folded desk, board) that doesn't block a standing person."""
    if min(o["w"], o["d"]) >= 0.1:
        return False
    x0, x1, y0, y1 = rect(o)
    return x0 <= EPS or y0 <= EPS or x1 >= room["width"] - EPS or y1 >= room["depth"] - EPS


def check_bedside(b, room, solid, rep):
    """Floor beds: count long sides with a free BEDSIDE-deep strip [BO] [IDE]."""
    x0, x1, y0, y1 = rect(b)
    c = BEDSIDE
    if b["d"] >= b["w"]:   # length along y: long sides face -x / +x
        strips = [(x0 - c, x0, y0, y1), (x1, x1 + c, y0, y1)]
    else:
        strips = [(x0, x1, y0 - c, y0), (x0, x1, y1, y1 + c)]
    along_y = b["d"] >= b["w"]
    free = 0
    for s in strips:
        if s[0] < -EPS or s[2] < -EPS or s[1] > room["width"] + EPS or s[3] > room["depth"] + EPS:
            continue
        # A platform the bed stands on (top at or below the bed base) is a step, not an obstacle.
        lo, hi = (s[2], s[3]) if along_y else (s[0], s[1])
        cuts = sorted(
            ((max(o["y"], lo), min(o["y"] + o["d"], hi)) if along_y else (max(o["x"], lo), min(o["x"] + o["w"], hi)))
            for o in solid
            if o is not b and o["z"] < FLOOR_OBSTACLE_Z and o["z"] + o["h"] > b["z"] + EPS
            and not is_flush(o, room) and xy_overlap(s, rect(o)))
        run, pos = 0.0, lo
        for a, z_ in cuts:
            run = max(run, a - pos)
            pos = max(pos, z_)
        run = max(run, hi - pos)
        if run >= BEDSIDE_RUN - EPS:
            free += 1
    width = min(b["w"], b["d"])
    if width >= DOUBLE_WIDTH and free < 2:
        rep.warn(f"{b['id']}: double bed with {free} accessible long side(s); "
                 f"one sleeper must climb over or in from the foot")
    elif free == 0:
        rep.warn(f"{b['id']}: no long side has a {BEDSIDE} × {BEDSIDE_RUN} m free strip to get in")


def free_ahead(e, solid, room, direction=None):
    """Free floor distance from e's face in `direction` (default its front) to the
    nearest wall or floor obstacle within e's width band."""
    direction = direction or fronts(e)[0]
    x0, x1, y0, y1 = rect(e)
    W, D = room["width"], room["depth"]
    best = {"+x": W - x1, "-x": x0, "+y": D - y1, "-y": y0}[direction]
    for o in solid:
        if o is e or o["z"] >= FLOOR_OBSTACLE_Z:
            continue
        a0, a1, b0, b1 = rect(o)
        if direction in ("+y", "-y"):
            if min(a1, x1) - max(a0, x0) <= EPS:
                continue
            gap = b0 - y1 if direction == "+y" else y0 - b1
        else:
            if min(b1, y1) - max(b0, y0) <= EPS:
                continue
            gap = a0 - x1 if direction == "+x" else x0 - a1
        if gap >= -EPS:
            best = min(best, max(gap, 0.0))
    return best


def side_room(e, solid, room):
    """Distance from e's centreline to the nearest wall/obstacle on each side,
    measured across its front direction (for toilets)."""
    x0, x1, y0, y1 = rect(e)
    W, D = room["width"], room["depth"]
    front = fronts(e)[0]
    if front in ("+y", "-y"):
        c, lo_wall, hi_wall, band = (x0 + x1) / 2, 0.0, W, (y0, y1)
    else:
        c, lo_wall, hi_wall, band = (y0 + y1) / 2, 0.0, D, (x0, x1)
    left, right = c - lo_wall, hi_wall - c
    for o in solid:
        if o is e or o["z"] >= FLOOR_OBSTACLE_Z:
            continue
        a0, a1, b0, b1 = rect(o)
        if front in ("+y", "-y"):
            span, (o_lo, o_hi) = (b0, b1), (a0, a1)
        else:
            span, (o_lo, o_hi) = (a0, a1), (b0, b1)
        if min(span[1], band[1]) - max(span[0], band[0]) <= EPS:
            continue
        if o_hi <= c + EPS:
            left = min(left, c - o_hi)
        elif o_lo >= c - EPS:
            right = min(right, o_lo - c)
    return left, right


def centre(e):
    return (e["x"] + e["w"] / 2, e["y"] + e["d"] / 2)


def check_room_type(layout, solid, rep):
    room = layout["room"]
    rtype = room.get("type", "bedroom")
    els = layout["elements"]

    has_kitchen = any(e["type"] in ("sink", "cooktop") for e in els) and rtype in ("kitchen", "studio", "living_dining", "dining")
    if has_kitchen:
        for e in els:
            if e["type"] not in KITCHEN_WORK:
                continue
            if not e.get("front"):
                rep.warn(f"{e['id']}: kitchen element without 'front'; aisle can't be checked")
                continue
            for d in fronts(e):
                gap = free_ahead(e, solid, room, d)
                side = f" ({d})" if len(fronts(e)) > 1 else ""
                if gap < WALKWAY - EPS:
                    rep.warn(f"{e['id']}{side}: {gap:.2f} m free in front < {WALKWAY} m walkway [NKBA]")
                elif gap < WORK_AISLE - EPS:
                    rep.warn(f"{e['id']}{side}: work aisle {gap:.2f} m < {WORK_AISLE} m for one cook [NKBA]")
        pts = {}
        for t in ("sink", "cooktop", "fridge"):
            found = [e for e in els if e["type"] == t]
            if found:
                pts[t] = centre(found[0])
        one_wall = len(pts) == 3 and (
            max(p[0] for p in pts.values()) - min(p[0] for p in pts.values()) < 0.3
            or max(p[1] for p in pts.values()) - min(p[1] for p in pts.values()) < 0.3)
        if one_wall:
            pass  # one-wall kitchen: the triangle rule doesn't apply (rooms/kitchen.md)
        elif len(pts) == 3:
            legs = [("sink", "cooktop"), ("cooktop", "fridge"), ("fridge", "sink")]
            total = 0.0
            for a, b in legs:
                d = ((pts[a][0] - pts[b][0]) ** 2 + (pts[a][1] - pts[b][1]) ** 2) ** 0.5
                total += d
                if not LEG_MIN - EPS <= d <= LEG_MAX + EPS:
                    rep.warn(f"work triangle {a}–{b} = {d:.2f} m, outside {LEG_MIN}–{LEG_MAX} m [NKBA]")
            if total > TRIANGLE_MAX + EPS:
                rep.warn(f"work triangle total {total:.2f} m > {TRIANGLE_MAX} m [NKBA]")
        else:
            rep.warn("kitchen without sink, cooktop and fridge; work triangle not checked")

    if rtype == "bathroom":
        for e in els:
            t = e["type"]
            if t in ("toilet", "vanity", "shower", "bathtub") and not e.get("front"):
                rep.warn(f"{e['id']}: give 'front' so clearances can be checked")
                continue
            if t == "toilet":
                front = free_ahead(e, solid, room)
                if front < WC_FRONT[0] - EPS:
                    rep.error(f"{e['id']}: {front:.2f} m clear in front of toilet < {WC_FRONT[0]} m [IRC-P]")
                elif front < WC_FRONT[1] - EPS:
                    rep.warn(f"{e['id']}: {front:.2f} m clear in front of toilet < recommended {WC_FRONT[1]} m [NKBA]")
                for side, dist in zip(("left", "right"), side_room(e, solid, room)):
                    if dist < WC_SIDE[0] - EPS:
                        rep.error(f"{e['id']}: centreline to {side} obstruction {dist:.2f} m < {WC_SIDE[0]} m [IRC-P]")
                    elif dist < WC_SIDE[1] - EPS:
                        rep.warn(f"{e['id']}: centreline to {side} obstruction {dist:.2f} m < recommended {WC_SIDE[1]} m [NKBA]")
            elif t == "vanity":
                front = free_ahead(e, solid, room)
                if front < LAV_FRONT - EPS:
                    rep.error(f"{e['id']}: {front:.2f} m clear in front of basin < {LAV_FRONT} m [IRC-P]")
            elif t == "shower":
                small, area = min(e["w"], e["d"]), e["w"] * e["d"]
                if small < SHOWER_SIDE[0] - EPS or area < SHOWER_AREA - EPS:
                    rep.error(f"{e['id']}: shower {e['w']:.2f}×{e['d']:.2f} m below 0.76×0.76 m / 0.58 m² [IRC-P]")
                elif small < SHOWER_SIDE[1] - EPS:
                    rep.warn(f"{e['id']}: shower side {small:.2f} m < recommended {SHOWER_SIDE[1]} m [NKBA]")
                front = free_ahead(e, solid, room)
                if front < SHOWER_FRONT[0] - EPS:
                    rep.error(f"{e['id']}: {front:.2f} m clear at shower entry < {SHOWER_FRONT[0]} m [IRC-P]")
                elif front < SHOWER_FRONT[1] - EPS:
                    rep.warn(f"{e['id']}: {front:.2f} m clear at shower entry < recommended {SHOWER_FRONT[1]} m [NKBA]")

    if rtype in ("living", "dining", "living_dining", "studio"):
        sofas = [e for e in els if e["type"] == "sofa" and e.get("front")]
        for t in (e for e in els if e["type"] == "coffee_table"):
            gaps = [free_ahead(s, [t], room) for s in sofas]
            gaps = [g for g in gaps if g < 2.0]
            if gaps and not COFFEE_GAP[0] - EPS <= min(gaps) <= COFFEE_GAP[1] + EPS:
                rep.warn(f"{t['id']}: {min(gaps):.2f} m from sofa, outside {COFFEE_GAP[0]}–{COFFEE_GAP[1]} m [RET-L]")

    for s in (e for e in els if e["type"] == "stairs"):
        rise, tread = s.get("rise"), s.get("tread")
        width = s.get("stair_width", min(s["w"], s["d"]))
        if rise is None or tread is None:
            rep.warn(f"{s['id']}: give 'rise' and 'tread' to check the stair")
        else:
            if rise > STAIR_RISE_MAX + EPS:
                rep.error(f"{s['id']}: riser {rise} m > {STAIR_RISE_MAX} m [IRC-S]")
            if tread < STAIR_TREAD_MIN - EPS:
                rep.error(f"{s['id']}: tread {tread} m < {STAIR_TREAD_MIN} m [IRC-S]")
        if width < STAIR_WIDTH_MIN - EPS:
            rep.error(f"{s['id']}: stair width {width:.2f} m < {STAIR_WIDTH_MIN} m [IRC-S]")
        if s.get("headroom") is not None and s["headroom"] < STAIR_HEADROOM - EPS:
            rep.error(f"{s['id']}: stair headroom {s['headroom']} m < {STAIR_HEADROOM} m [IRC]")

    for w in room["openings"]:
        if w["type"] not in ("window", "bay_window") or w.get("drop_outside", 0) <= FALL_DROP or w.get("restrictor"):
            continue
        sill = w.get("sill", 0.9)
        if sill < FALL_SILL - EPS:
            rep.warn(f"window {w['id']}: sill {sill} m with {w['drop_outside']} m drop outside; "
                     f"add fall protection [IRC R312.2]")
        zone = wall_span_rect(room, w["wall"], w["offset"], w["width"], 0.6)
        for e in solid:
            top = e["z"] + e["h"]
            if e["type"] in CLIMBABLE and xy_overlap(zone, rect(e)) and top <= sill + EPS \
               and sill - top < FALL_SILL - EPS:
                rep.warn(f"{e['id']}: climbable, {sill - top:.2f} m below window {w['id']} sill with a "
                         f"{w['drop_outside']} m drop; fit window restrictors")


def check_egress_per_area(room, els, rep):
    """Every bed must share a floor area with an egress window. Partitions and
    interior doors (closed) split the floor into areas [IRC R310]."""
    W, D = room["width"], room["depth"]
    cols, rows = round(W / GRID), round(D / GRID)
    walls_ = [e for e in els if e["type"] in BARRIERS and e["h"] >= 1.8]
    pad = 0.03  # so thin doors/partitions still cover grid centres

    def centre(r, c):
        return (c + 0.5) * GRID, (r + 0.5) * GRID

    def is_wall(r, c):
        x, y = centre(r, c)
        return any(e["x"] - pad <= x <= e["x"] + e["w"] + pad and e["y"] - pad <= y <= e["y"] + e["d"] + pad
                   for e in walls_)

    area = [[None] * cols for _ in range(rows)]
    n = 0
    for r in range(rows):
        for c in range(cols):
            if area[r][c] is not None or is_wall(r, c):
                continue
            stack = [(r, c)]
            area[r][c] = n
            while stack:
                i, j = stack.pop()
                for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if 0 <= a < rows and 0 <= b < cols and area[a][b] is None and not is_wall(a, b):
                        area[a][b] = n
                        stack.append((a, b))
            n += 1

    if not any(e["type"] == "bed" for e in els):
        return
    windows = [o for o in room["openings"] if o["type"] in ("window", "bay_window") and o.get("egress")]
    if not windows:
        rep.warn("no window is marked egress; every bedroom needs an escape opening [IRC]")
        return
    reach = set()
    for w in windows:
        for k in range(round(w["offset"] / GRID), round((w["offset"] + w["width"]) / GRID)):
            cell = {"S": (0, k), "N": (rows - 1, k), "W": (k, 0), "E": (k, cols - 1)}[w["wall"]]
            if 0 <= cell[0] < rows and 0 <= cell[1] < cols and area[cell[0]][cell[1]] is not None:
                reach.add(area[cell[0]][cell[1]])
    for b in (e for e in els if e["type"] == "bed"):
        ids = [area[r][c] for r in range(rows) for c in range(cols)
               if area[r][c] is not None and xy_overlap(rect(b), (c * GRID, (c + 1) * GRID, r * GRID, (r + 1) * GRID))]
        if ids and not set(ids) & reach:
            rep.error(f"{b['id']}: its area (closed off by partitions/doors) has no egress window [IRC]")


def apply_state(layout, state):
    """Return a copy of the layout with one state's element overrides applied."""
    out = json.loads(json.dumps(layout))
    els = []
    for e in out["elements"]:
        over = e.pop("states", {}).get(state, {})
        if over.get("hidden"):
            continue
        e.update({k: v for k, v in over.items() if k != "hidden"})
        els.append(e)
    out["elements"] = els
    return out


def check_all(layout):
    """Check the base layout, then each named state (day/night...) on its own."""
    states = layout.get("states") or []
    if not states:
        return check(apply_state(layout, None))
    reports = {s: check(apply_state(layout, s)) for s in states}
    rep = Report()
    for kind in ("errors", "warns"):
        common = set.intersection(*(set(getattr(r, kind)) for r in reports.values()))
        out = getattr(rep, kind)
        out += [m for m in getattr(reports[states[0]], kind) if m in common]  # same in every state
        for s, r in reports.items():
            out += [f"[{s}] {m}" for m in getattr(r, kind) if m not in common]
    return rep


def check(layout):
    rep = Report()
    for key in ("version", "room", "occupants", "zones", "elements", "reveal_path"):
        if key not in layout:
            rep.error(f"missing top-level field '{key}'")
    if rep.errors:
        return rep

    room = layout["room"]
    W, D, H = room["width"], room["depth"], room["height"]
    walls = room.get("walls", {})
    els = layout["elements"]
    by_id = {e["id"]: e for e in els}
    ages = {o["id"]: o.get("age") for o in layout["occupants"]}
    zone_ids = {z["id"] for z in layout["zones"]}

    for e in els:
        for k in ("x", "y", "z", "w", "d", "h"):
            if k not in e:
                rep.error(f"{e.get('id', '?')}: missing '{k}'")
    if rep.errors:
        return rep

    # Bounds
    for e in els:
        if e["type"] == "niche":
            continue
        if e["x"] < -EPS or e["y"] < -EPS or e["z"] < -EPS or \
           e["x"] + e["w"] > W + EPS or e["y"] + e["d"] > D + EPS or e["z"] + e["h"] > H + EPS:
            rep.error(f"{e['id']}: outside the room ({W}×{D}×{H} m)")
        if e.get("zone") and e["zone"] not in zone_ids:
            rep.warn(f"{e['id']}: zone '{e['zone']}' is not defined")

    # Collisions
    solid = [e for e in els if e["type"] not in NO_COLLIDE]
    for i, a in enumerate(solid):
        for b in solid[i + 1:]:
            if xy_overlap(rect(a), rect(b)) and z_overlap(a, b):
                rep.error(f"{a['id']} and {b['id']} overlap")

    # Doors
    for o in room["openings"]:
        if o["type"] == "door" and o.get("swing", "in") == "in":
            sw = wall_span_rect(room, o["wall"], o["offset"], o["width"], o["width"])
            for e in solid:
                if e["z"] < 2.0 and xy_overlap(sw, rect(e)):
                    rep.error(f"{e['id']} blocks the swing of door {o['id']}")

    # Routes: circulation paths that must stay clear (e.g. door to door behind a sofa)
    for r in (e for e in els if e["type"] == "route"):
        for o in solid:
            if o["z"] < FLOOR_OBSTACLE_Z and xy_overlap(rect(r), rect(o)):
                rep.error(f"{o['id']} blocks route {r['id']}")
        width = min(r["w"], r["d"])
        if width < 0.6 - EPS:
            rep.warn(f"route {r['id']}: {width:.2f} m wide < 0.6 m small-room minimum")

    # Front clearances
    for e in els:
        if not (e.get("front") and e.get("clearance")):
            continue
        for d in fronts(e):
            fr = front_rect(e, d)
            if fr[0] < -EPS or fr[2] < -EPS or fr[1] > W + EPS or fr[3] > D + EPS:
                rep.error(f"{e['id']}: front clearance ({e['clearance']} m, {d}) runs outside the room")
            for o in solid:
                if o is e or o["z"] >= FLOOR_OBSTACLE_Z or o["id"] == e.get("serves"):
                    continue
                if xy_overlap(fr, rect(o)):
                    rep.error(f"{o['id']} sits in the {e['clearance']} m clearance in front of {e['id']} ({d})")
        if e["type"] == "wardrobe" and e.get("doors") == "hinged" and e["clearance"] < 0.6:
            rep.warn(f"{e['id']}: hinged doors with only {e['clearance']} m clearance; consider sliding doors")

    # Beds
    access = {e.get("serves") for e in els if e["type"] in ("steps", "ladder")}
    for b in (e for e in els if e["type"] == "bed"):
        top = b["z"] + b["h"]
        if not (top > RAISED_TOP + EPS or b["z"] > RAISED_UNDERSIDE + EPS):
            check_bedside(b, room, solid, rep)
            continue
        bid = b["id"]
        if not b.get("guardrail"):
            rep.error(f"{bid}: raised bed (mattress top {top:.2f} m) without guardrails")
        rail = b.get("guardrail_height")
        if rail is None:
            rep.warn(f"{bid}: guardrail_height not given (needs ≥ {RAIL_REC} m above mattress)")
        elif rail < RAIL_MIN - EPS:
            rep.error(f"{bid}: guardrail {rail} m above mattress < {RAIL_MIN} m [CPSC]")
        elif rail < RAIL_REC - EPS:
            rep.warn(f"{bid}: guardrail {rail} m above mattress < {RAIL_REC} m [EN747]")
        if bid not in access:
            rep.error(f"{bid}: raised bed has no steps/ladder with serves='{bid}'")
        age = ages.get(b.get("owner"))
        if age is not None and age < UPPER_MIN_AGE:
            rep.error(f"{bid}: occupant {b['owner']} is {age}; upper beds need age ≥ {UPPER_MIN_AGE} [CPSC]")

        ceiling = H
        for o in els:
            if o is not b and o["z"] >= top - EPS and xy_overlap(rect(o), rect(b)):
                ceiling = min(ceiling, o["z"])
        head = ceiling - top
        if head < HEADROOM_MIN - EPS:
            rep.error(f"{bid}: headroom {head:.2f} m above mattress < {HEADROOM_MIN} m")
        elif head < HEADROOM_REC - EPS:
            rep.warn(f"{bid}: headroom {head:.2f} m above mattress < recommended {HEADROOM_REC} m")

        for o in els:
            if o is b or not xy_overlap(rect(o), rect(b)) or o["z"] + o["h"] > b["z"] + EPS:
                continue
            if o["type"] == "bed":
                gap = b["z"] - (o["z"] + o["h"])
                if gap < HEADROOM_MIN - EPS:
                    rep.error(f"{o['id']} under {bid}: {gap:.2f} m above lower mattress < {HEADROOM_MIN} m")
                elif gap < HEADROOM_REC - EPS:
                    rep.warn(f"{o['id']} under {bid}: {gap:.2f} m above lower mattress < recommended {HEADROOM_REC} m")
                continue
            need = WALK_UNDER if o.get("walk_under") else UNDER_CLEAR.get(o["type"])
            if need and b["z"] < need - EPS:
                rep.error(f"{o['id']} under {bid}: clear height {b['z']:.2f} m < {need} m")

        for w in room["openings"]:
            if w["type"] in ("window", "bay_window"):
                near = wall_span_rect(room, w["wall"], w["offset"], w["width"], 0.3)
                if xy_overlap(near, rect(b)) and top > w.get("sill", 0.9) and not w.get("restrictor"):
                    rep.warn(f"{bid}: raised bed next to window {w['id']}; fit window guards/restrictors")

    # Steps and ladders up to beds or lofts
    for st in (e for e in els if e["type"] == "steps" and e.get("rise") is not None):
        rise, tread = st["rise"], st.get("tread", 0)
        if rise > STEP_RISE_MAX + EPS:
            rep.error(f"{st['id']}: step rise {rise} m > {STEP_RISE_MAX} m; use a ladder or a longer run")
        elif rise > STEP_COMFORT[0] + EPS or tread < STEP_COMFORT[1] - EPS:
            rep.warn(f"{st['id']}: steep steps (rise {rise}, tread {tread}); add a handrail, and use alternating treads [std]")

    # Ordinary windows covered by tall furniture
    for w in room["openings"]:
        if w["type"] not in ("window", "bay_window") or w.get("egress"):
            continue
        sill = w.get("sill", 0.9)
        zone = wall_span_rect(room, w["wall"], w["offset"], w["width"], 0.3)
        for e in solid:
            if e["z"] < sill and e["z"] + e["h"] > sill + 0.1 and xy_overlap(zone, rect(e)):
                rep.warn(f"{e['id']} covers window {w['id']}")

    # Egress window
    check_egress_per_area(room, els, rep)
    for w in room["openings"]:
        if w.get("egress"):
            if w.get("sill", 0) > 1.12 + EPS:
                rep.warn(f"window {w['id']}: egress sill {w['sill']} m > 1.12 m [IRC]; add a fixed step")
            zone = wall_span_rect(room, w["wall"], w["offset"], w["width"], 0.6)
            for e in solid:
                if e["z"] < 1.0 and e["z"] + e["h"] > 1.0 and xy_overlap(zone, rect(e)):
                    rep.warn(f"{e['id']} blocks egress window {w['id']}")

    # Niches
    for e in els:
        if e["type"] == "niche":
            wall = e.get("wall")
            lb = walls.get(wall, {}).get("load_bearing")
            if lb is None:
                rep.error(f"{e['id']}: niche in wall {wall} of unknown structure; confirm it is not load-bearing")
            elif lb:
                rep.error(f"{e['id']}: niche cut into load-bearing wall {wall}")

    # Outlets
    outlets = [wall_point(room, s["wall"], s["offset"]) for s in layout.get("services", [])
               if s["type"] in ("outlet", "usb") and s["wall"] != "ceiling"]
    for e in els:
        if e["type"] in ("bed", "desk"):
            if not any(p and dist_point_rect(p, rect(e)) <= OUTLET_REACH for p in outlets):
                rep.warn(f"{e['id']}: no outlet within {OUTLET_REACH} m")

    check_room_type(layout, solid, rep)

    # Reveal path
    for s in layout["reveal_path"]:
        cx, cy, cz = s["camera"]
        if not (0 <= cx <= W and 0 <= cy <= D and 0 <= cz <= H):
            rep.warn(f"reveal stop '{s['stop']}': camera outside the room")
        if s.get("zone") and s["zone"] not in zone_ids:
            rep.warn(f"reveal stop '{s['stop']}': zone '{s['zone']}' is not defined")
    return rep


def ascii_plan(layout, upper):
    room = layout["room"]
    cols, rows = round(room["width"] * 10), round(room["depth"] * 10)
    grid = [["." for _ in range(cols)] for _ in range(rows)]
    legend = []
    sym = iter("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
    for e in layout["elements"]:
        shown = (e["z"] >= FLOOR_OBSTACLE_Z or e["z"] + e["h"] >= 1.8) if upper else e["z"] < FLOOR_OBSTACLE_Z
        if e["type"] in ("niche", "route") or not shown:
            continue
        c = next(sym, "#")
        legend.append(f"{c}={e['id']}")
        for r in range(rows):
            for k in range(cols):
                # any overlap with the cell, so thin boards and doors still show
                if xy_overlap(rect(e), (k / 10, (k + 1) / 10, r / 10, (r + 1) / 10)):
                    grid[r][k] = c
    lines = ["".join(row) for row in reversed(grid)]  # N at top
    title = "UPPER LEVEL (z ≥ 1.0 m, plus full-height items)" if upper else "FLOOR LEVEL (z < 1.0 m)"
    return f"{title}   N↑  W| |E  S↓\n" + "\n".join(lines) + "\n" + "  ".join(legend)


def result(layout, plan=False, rep=None):
    """The check result as a dict: errors, warnings, ok, and ASCII plans per state if asked."""
    rep = rep or check_all(layout)
    out = {"errors": rep.errors, "warnings": rep.warns, "ok": not rep.errors}
    if plan and "room" in layout:
        out["plans"] = {
            (s or "default"): {"floor": ascii_plan(apply_state(layout, s), False),
                               "upper": ascii_plan(apply_state(layout, s), True)}
            for s in (layout.get("states") or [None])}
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "-h" in sys.argv or "--help" in sys.argv:
        print(__doc__)
        sys.exit(0)
    if not args:
        print(__doc__)
        sys.exit(2)
    try:
        with open(args[0]) as f:
            layout = json.load(f)
    except OSError as e:
        sys.exit(f"Can't open {args[0]}: {e.strerror}")
    except json.JSONDecodeError as e:
        sys.exit(f"{args[0]} is not valid JSON: {e.msg} (line {e.lineno}, column {e.colno})")
    rep = check_all(layout)
    if "--json" in sys.argv:
        print(json.dumps(result(layout, "--plan" in sys.argv, rep), ensure_ascii=False, indent=2))
        sys.exit(1 if rep.errors else 0)
    for m in rep.errors:
        print("ERROR:", m)
    for m in rep.warns:
        print("WARN: ", m)
    print(f"{len(rep.errors)} error(s), {len(rep.warns)} warning(s)")
    if "--plan" in sys.argv and "room" in layout:
        for s in layout.get("states") or [None]:
            view = apply_state(layout, s)
            for upper in (False, True):
                print()
                if s:
                    print(f"[{s}]", end=" ")
                print(ascii_plan(view, upper))
    sys.exit(1 if rep.errors else 0)


if __name__ == "__main__":
    main()
