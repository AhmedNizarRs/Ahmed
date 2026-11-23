"""Furniture shapes for the 3D export: each layout element becomes a few parts.

`parts(e, room, elements)` returns [(material, (x0, x1, y0, y1, z0, z1)), ...] in
layout metres. Every part stays inside the element's own box (w × d × h at z),
so the model keeps the sizes the checker tested. The one exception is a bed's
guardrail, which rises `guardrail_height` above the mattress as the layout says.

Shapes are drawn in a local frame: `a` runs across the front (0..A), `b` runs
from the back (0) to the front (B), `z` from the bottom (0) to the top (H).
The front comes from the element's `front` field ("+x", "-x", "+y", "-y");
without one it faces away from the nearest wall. Beds use their own frame:
the head is the short end nearest a wall.

Material names are keys of MATERIALS, or "paint:<type>" / "fabric:<type>",
which take the element type's colour from the 2D plan.
"""

FRONT_T = 0.018     # door and drawer front thickness
HANDLE_T = 0.012    # handles stand proud of the fronts by this much
GAP = 0.004         # gap between fronts
PLINTH = 0.08       # toe kick height under floor cabinets
TOUCH = 0.03        # within this of a wall counts as against it

# name: (sRGB hex, metallic, roughness)
MATERIALS = {
    "wood": ("#b98b5c", 0.0, 0.6),
    "wood_dark": ("#7a5236", 0.0, 0.6),
    "linen": ("#f3f0ea", 0.0, 0.9),
    "metal": ("#b8bcc2", 0.9, 0.35),
    "steel": ("#d5d8db", 0.6, 0.3),
    "ceramic": ("#f7f7f4", 0.0, 0.15),
    "stone": ("#d6cfc4", 0.0, 0.4),
    "black_glass": ("#161616", 0.0, 0.08),
    "cork": ("#b58b5a", 0.0, 0.95),
    "panel": ("#ebe8e2", 0.0, 0.7),
}

BOX_TYPES = {"platform", "den", "other", "partition", "divider"}


# ---------------------------------------------------------------- frames

def _rect(e):
    return e["x"], e["x"] + e["w"], e["y"], e["y"] + e["d"]


def _wall_gaps(e, room):
    """Distance from each side of the element's box to the room wall on that side."""
    x0, x1, y0, y1 = _rect(e)
    return {"-x": x0, "+x": room["width"] - x1, "-y": y0, "+y": room["depth"] - y1}


def _front(e, room):
    f = e.get("front")
    if isinstance(f, list) and f:   # several open sides: model the first one as the front
        f = f[0]
    if f in ("+x", "-x", "+y", "-y"):
        return f
    gaps = _wall_gaps(e, room)
    back = min(gaps, key=gaps.get)
    return {"-x": "+x", "+x": "-x", "-y": "+y", "+y": "-y"}[back]


def _thin_front(e, room):
    """For thin items (doors, boards, hooks): face across the thin side, away from the nearer wall."""
    gaps = _wall_gaps(e, room)
    sides = ("-y", "+y") if e["w"] >= e["d"] else ("-x", "+x")
    back = min(sides, key=gaps.get)
    return {"-x": "+x", "+x": "-x", "-y": "+y", "+y": "-y"}[back]


def _bed_front(e, room):
    """Point from the head to the foot: the head is the short end nearest a wall."""
    gaps = _wall_gaps(e, room)
    ends = ("-y", "+y") if e["d"] >= e["w"] else ("-x", "+x")
    head = min(ends, key=gaps.get)
    return {"-x": "+x", "+x": "-x", "-y": "+y", "+y": "-y"}[head]


class Frame:
    def __init__(self, e, front):
        self.e, self.front = e, front
        self.x0, self.x1, self.y0, self.y1 = _rect(e)
        self.z = e.get("z", 0) or 0
        self.A, self.B = (e["w"], e["d"]) if front in ("+y", "-y") else (e["d"], e["w"])
        self.H = e.get("h", 0.02)

    def box(self, a0, a1, b0, b1, z0, z1):
        """Local (a, b, z) box → layout (x0, x1, y0, y1, z0, z1)."""
        f = self.front
        if f == "+y":
            x, y = (self.x0 + a0, self.x0 + a1), (self.y0 + b0, self.y0 + b1)
        elif f == "-y":
            x, y = (self.x1 - a1, self.x1 - a0), (self.y1 - b1, self.y1 - b0)
        elif f == "+x":
            x, y = (self.x0 + b0, self.x0 + b1), (self.y1 - a1, self.y1 - a0)
        else:
            x, y = (self.x1 - b1, self.x1 - b0), (self.y0 + a0, self.y0 + a1)
        return (x[0], x[1], y[0], y[1], self.z + z0, self.z + z1)

    def side_layout(self, side):
        """Layout side ("-x" …) of a local side ("left" a=0, "right" a=A, "back" b=0, "front" b=B)."""
        turn = {"+y": {"left": "-x", "right": "+x", "back": "-y", "front": "+y"},
                "-y": {"left": "+x", "right": "-x", "back": "+y", "front": "-y"},
                "+x": {"left": "+y", "right": "-y", "back": "-x", "front": "+x"},
                "-x": {"left": "-y", "right": "+y", "back": "+x", "front": "-x"}}
        return turn[self.front][side]


def _against(fr, room, side):
    return _wall_gaps(fr.e, room)[fr.side_layout(side)] <= TOUCH


# ---------------------------------------------------------------- building blocks

def _split(A, n):
    step = A / n
    return [(k * step + GAP / 2, (k + 1) * step - GAP / 2) for k in range(n)]


def _fronts(out, fr, mat, z0, z1, n=None, drawers=0, handle="vertical", sliding=False, b_back=None):
    """Carcass plus door (or drawer) fronts and handles over z0..z1."""
    A, B = fr.A, fr.B
    face = B - HANDLE_T
    body_b = face - FRONT_T * (2 if sliding else 1)
    out.append(("panel" if mat.startswith("paint") else mat, fr.box(0, A, b_back or 0, body_b, z0, z1)))
    if drawers:
        rows = [(z0 + (z1 - z0) * k / drawers + GAP / 2, z0 + (z1 - z0) * (k + 1) / drawers - GAP / 2)
                for k in range(drawers)]
        for r0, r1 in rows:
            out.append((mat, fr.box(GAP, A - GAP, body_b, face, r0, r1)))
            hw = min(0.3, A * 0.4)
            hz = r1 - min(0.05, (r1 - r0) / 3)
            out.append(("metal", fr.box(A / 2 - hw / 2, A / 2 + hw / 2, face, B, hz - 0.012, hz)))
        return
    n = n or max(1, round(A / 0.55))
    for k, (a0, a1) in enumerate(_split(A, n)):
        if sliding:  # alternate panels on two tracks, slightly overlapping
            b0 = body_b + (FRONT_T if k % 2 else 0)
            a0, a1 = max(0, a0 - 0.02), min(A, a1 + 0.02)
            out.append((mat, fr.box(a0, a1, b0, b0 + FRONT_T, z0 + GAP, z1 - GAP)))
            hx = a0 + 0.04 if k % 2 else a1 - 0.06
            out.append(("metal", fr.box(hx, hx + 0.02, face, B, z0 + (z1 - z0) * 0.4, z0 + (z1 - z0) * 0.6)))
            continue
        out.append((mat, fr.box(a0, a1, body_b, face, z0 + GAP, z1 - GAP)))
        hinge_left = k % 2 == 0
        hx = a1 - 0.05 if hinge_left else a0 + 0.03
        if handle == "vertical":
            hl = min(0.3, (z1 - z0) * 0.3)
            if z1 - z0 > 1.2:   # tall door: handle near 1.05 m off the floor, kept on the door
                hz = max(z0 + hl + 0.05, min(z1 - 0.1, 1.05 - fr.z))
            else:
                hz = z0 + (z1 - z0) / 2 + hl / 2
            out.append(("metal", fr.box(hx, hx + 0.02, face, B, hz - hl, hz)))
        else:
            hw = min(0.2, (a1 - a0) * 0.5)
            hz = z1 - 0.06
            out.append(("metal", fr.box((a0 + a1) / 2 - hw / 2, (a0 + a1) / 2 + hw / 2, face, B, hz - 0.012, hz)))


def _legs(out, fr, mat, z1, t=0.045, inset=0.02):
    A, B = fr.A, fr.B
    for a in (inset, A - inset - t):
        for b in (inset, B - inset - t):
            out.append((mat, fr.box(a, a + t, b, b + t, 0, z1)))


def _body_mat(e, default):
    m = (e.get("material") or "").lower()
    if "steel" in m or "metal" in m or "iron" in m:
        return "metal"
    if "wood" in m or "ply" in m or "veneer" in m:
        return "wood"
    return default


# ---------------------------------------------------------------- shapes

def _cabinet(e, room, out, mat=None):
    fr = Frame(e, _front(e, room))
    mat = mat or _body_mat(e, "paint:" + e["type"])
    on_floor = fr.z < 0.01 and fr.H > 0.5
    z0 = PLINTH if on_floor else 0
    if on_floor:
        out.append(("panel", fr.box(0, fr.A, 0, fr.B - 0.06, 0, PLINTH)))
    tall = fr.H > 1.2
    sliding = e.get("doors") == "sliding"
    drawers = 0
    label = (e.get("label") or "").lower()
    if e["type"] == "drawers" or ("drawer" in label and not tall):
        drawers = max(2, min(5, round((fr.H - z0) / 0.2)))
    _fronts(out, fr, mat, z0, fr.H, drawers=drawers, sliding=sliding,
            n=max(2, round(fr.A / 0.9)) if sliding else None,
            handle="vertical" if tall or fr.z > 0.01 else "horizontal")


def _counter(e, room, out, top="stone"):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    wt = 0.03
    label = (e.get("label") or "").lower()
    out.append(("panel", fr.box(0, A, 0, B - 0.06, 0, PLINTH)))
    base_top = H - wt
    if e["type"] == "cooktop" and "oven" in label:
        body_b = B - HANDLE_T - FRONT_T
        out.append(("panel", fr.box(0, A, 0, body_b, PLINTH, base_top)))
        out.append(("black_glass", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, PLINTH + 0.1, base_top - 0.12)))
        out.append(("metal", fr.box(A * 0.2, A * 0.8, B - HANDLE_T, B, base_top - 0.17, base_top - 0.155)))
        out.append(("paint:counter", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, base_top - 0.11, base_top - GAP)))
    else:
        drawers = 3 if "drawer" in label else 0
        _fronts(out, fr, "paint:counter", PLINTH, base_top, drawers=drawers, handle="horizontal")
    if e["type"] == "sink":
        # worktop with a hole, and a steel bowl under it
        ha0, ha1 = A / 2 - min(0.25, A * 0.35), A / 2 + min(0.25, A * 0.35)
        hb0, hb1 = B * 0.2, B * 0.78
        out += [(top, fr.box(0, ha0, 0, B, base_top, H)), (top, fr.box(ha1, A, 0, B, base_top, H)),
                (top, fr.box(ha0, ha1, 0, hb0, base_top, H)), (top, fr.box(ha0, ha1, hb1, B, base_top, H)),
                ("steel", fr.box(ha0, ha1, hb0, hb1, base_top - 0.18, base_top - 0.17))]
        return
    if e["type"] == "cooktop":
        out.append((top, fr.box(0, A, 0, B, base_top, H - 0.005)))
        m = min(0.05, A * 0.1)
        out.append(("black_glass", fr.box(m, A - m, B * 0.08, B * 0.92, H - 0.005, H)))
        return
    out.append((top, fr.box(0, A, 0, B, base_top, H)))


def _appliance(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    body_b = B - HANDLE_T - FRONT_T
    t = e["type"]
    out.append(("steel" if t == "fridge" else "ceramic", fr.box(0, A, 0, body_b, 0, H)))
    if t == "fridge":
        split = H * 0.35
        for z0, z1 in ((0.02, split - GAP), (split + GAP, H - 0.02)):
            out.append(("steel", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, z0, z1)))
            hz0, hz1 = (z1 - 0.3, z1 - 0.05) if z0 < 0.1 else (z0 + 0.05, z0 + 0.35)
            out.append(("metal", fr.box(A - 0.06, A - 0.04, B - HANDLE_T, B, hz0, hz1)))
    elif t == "oven":
        out.append(("black_glass", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, H * 0.1, H * 0.85)))
        out.append(("metal", fr.box(A * 0.2, A * 0.8, B - HANDLE_T, B, H * 0.86, H * 0.88)))
    else:  # washer, dishwasher
        win = min(A, H) * (0.55 if t in ("washer", "dryer") else 0.0)
        if win:
            zc = H * 0.45
            out.append(("black_glass", fr.box(A / 2 - win / 2, A / 2 + win / 2, body_b, B - HANDLE_T, zc - win / 2, zc + win / 2)))
        else:
            out.append(("ceramic", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, 0.08, H - 0.1)))
        out.append(("panel", fr.box(GAP, A - GAP, body_b, B - HANDLE_T, H - 0.09, H - GAP)))


def _bed(e, room, out, elements):
    fr = Frame(e, _bed_front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    frame_mat = _body_mat(e, "wood")
    frame_top = max(H - 0.2, H * 0.45)
    out.append((frame_mat, fr.box(0, A, 0, B, 0, frame_top)))
    m = 0.02
    out.append(("linen", fr.box(m, A - m, m, B - m, frame_top, H - 0.03)))
    pillow_b = min(0.4, B * 0.2)
    out.append(("fabric:bed", fr.box(m, A - m, pillow_b + 0.05, B - m, H - 0.03, H)))
    n = 2 if A >= 1.2 else 1
    for a0, a1 in _split(A - 2 * m - 0.1, n):
        out.append(("linen", fr.box(m + 0.05 + a0, m + 0.05 + a1, 0.06, pillow_b, H - 0.03, H)))
    if e.get("guardrail"):
        _guardrail(e, room, fr, out, elements, frame_mat)


def _guardrail(e, room, fr, out, elements, mat):
    A, B, H = fr.A, fr.B, fr.H
    gh = e.get("guardrail_height", 0.15)
    t = 0.03
    server = next((s for s in elements if s.get("serves") == e["id"]), None)
    for side in ("left", "right", "front", "back"):
        if _against(fr, room, side):
            continue
        along_a = side in ("front", "back")
        L = A if along_a else B
        lo, hi = 0.0, L
        if server is not None and not along_a:
            # leave a 0.5 m gap at the end of the rail nearest the steps or ladder
            sx, sy = server["x"] + server["w"] / 2, server["y"] + server["d"] / 2
            near_back = _dist(fr.box(0, A, 0, 0.01, 0, 0), sx, sy) < _dist(fr.box(0, A, B - 0.01, B, 0, 0), sx, sy)
            lo, hi = (0.5, L) if near_back else (0, L - 0.5)
        if along_a:
            b0 = 0 if side == "back" else B - t
            out.append((mat, fr.box(lo, hi, b0, b0 + t, H + gh - t, H + gh)))
            for a in (lo, hi - t):
                out.append((mat, fr.box(a, a + t, b0, b0 + t, H, H + gh)))
        else:
            a0 = 0 if side == "left" else A - t
            out.append((mat, fr.box(a0, a0 + t, lo, hi, H + gh - t, H + gh)))
            for b in (lo, hi - t):
                out.append((mat, fr.box(a0, a0 + t, b, b + t, H, H + gh)))


def _dist(box, x, y):
    cx, cy = (box[0] + box[1]) / 2, (box[2] + box[3]) / 2
    return (cx - x) ** 2 + (cy - y) ** 2


def _sofa(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    fab = "fabric:" + ("sofa" if e["type"] in ("sofa", "seat") else e["type"])
    base = min(0.2, H * 0.25)
    seat = min(0.45, H * 0.55)
    back_t = min(0.2, B * 0.25)
    arm = min(0.15, A * 0.1)
    out.append(("wood_dark", fr.box(0, A, 0, B, 0, base)))
    out.append((fab, fr.box(0, A, 0, back_t, base, H)))
    arm_h = min(H, seat + 0.18)
    out += [(fab, fr.box(0, arm, back_t, B, base, arm_h)), (fab, fr.box(A - arm, A, back_t, B, base, arm_h))]
    inner = A - 2 * arm
    for a0, a1 in _split(inner, max(1, round(inner / 0.65))):
        out.append((fab, fr.box(arm + a0, arm + a1, back_t, B, base, seat)))


def _chair(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    seat = min(0.46, H * 0.55)
    _legs(out, fr, "wood", seat - 0.04, t=0.035)
    out.append(("fabric:chair", fr.box(0, A, 0, B, seat - 0.04, seat)))
    if H > seat + 0.1:
        out.append(("wood", fr.box(0, A, 0, 0.04, seat, H)))


def _table(e, room, out):
    fr = Frame(e, _front(e, room))
    H = fr.H
    top_t = 0.04 if e["type"] == "coffee_table" else 0.03
    mat = _body_mat(e, "wood")
    _legs(out, fr, "metal" if e["type"] == "desk" and mat == "wood" else "wood_dark", H - top_t)
    out.append((mat, fr.box(0, fr.A, 0, fr.B, H - top_t, H)))
    if e["type"] == "coffee_table" and H > 0.25:
        out.append((mat, fr.box(0.07, fr.A - 0.07, 0.07, fr.B - 0.07, 0.08, 0.1)))


def _tv_unit(e, room, out):
    fr = Frame(e, _front(e, room))
    _legs(out, fr, "metal", 0.1, t=0.03, inset=0.04)
    sub = dict(e, z=fr.z + 0.1, h=fr.H - 0.1)
    _fronts(out, Frame(sub, fr.front), "wood", 0, fr.H - 0.1, handle="horizontal")


def _shelf(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    mat = _body_mat(e, "wood")
    t = 0.018
    if H < 0.1:
        out.append((mat, fr.box(0, A, 0, B, 0, H)))
        return
    out += [(mat, fr.box(0, t, 0, B, 0, H)), (mat, fr.box(A - t, A, 0, B, 0, H)),
            ("panel", fr.box(t, A - t, 0, 0.006, 0, H))]
    n = max(2, round(H / 0.35))
    for k in range(n + 1):
        z = min(H - t, k * (H - t) / n)
        out.append((mat, fr.box(t, A - t, 0.006, B, z, z + t)))


def _steps(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    rise = 0.18 if e["type"] == "stairs" else 0.25
    n = max(2, round(H / rise))
    mat = _body_mat(e, "wood")
    for k in range(n):
        # step k runs from the back to its nosing, each one shorter, so the stack climbs away from the front
        out.append((mat if k % 2 == 0 else "wood_dark", fr.box(0, A, 0, B * (n - k) / n, H * k / n, H * (k + 1) / n)))


def _ladder(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    mat = _body_mat(e, "wood")
    t = min(0.04, A * 0.15)
    out += [(mat, fr.box(0, t, 0, B, 0, H)), (mat, fr.box(A - t, A, 0, B, 0, H))]
    k = 0.28
    while k < H - 0.05:
        out.append((mat, fr.box(t, A - t, B / 2 - 0.015, B / 2 + 0.015, k - 0.015, k + 0.015)))
        k += 0.28


def _toilet(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    label = (e.get("label") or "").lower()
    panel = min(0.15, B * 0.3)
    out.append(("panel", fr.box(0, A, 0, panel, 0, H)))
    bw = min(A, 0.38)
    a0, a1 = A / 2 - bw / 2, A / 2 + bw / 2
    bottom = 0.22 if "wall" in label else 0
    out.append(("ceramic", fr.box(a0 + 0.04, a1 - 0.04, panel, B - 0.04, bottom, 0.3)))
    out.append(("ceramic", fr.box(a0, a1, panel, B, 0.3, 0.39)))
    out.append(("ceramic", fr.box(a0 + 0.01, a1 - 0.01, panel, B - 0.01, 0.39, 0.41)))
    out.append(("metal", fr.box(A / 2 - 0.1, A / 2 + 0.1, panel, panel + 0.006, min(H - 0.15, 1.0), min(H - 0.05, 1.1))))


def _vanity(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    label = (e.get("label") or "").lower()
    top = 0.12
    z0 = 0.3 if "floating" in label or "wall" in label else 0
    _fronts(out, fr, "wood", z0, H - top, handle="horizontal")
    out.append(("ceramic", fr.box(0, A, 0, B, H - top, H)))
    out.append(("steel", fr.box(A * 0.25, A * 0.75, B * 0.25, B * 0.8, H - 0.001, H)))


def _basin(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    out.append(("ceramic", fr.box(A * 0.35, A * 0.65, 0, B * 0.35, 0, H - 0.15)))
    out.append(("ceramic", fr.box(0, A, 0, B, H - 0.15, H)))


def _shower(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    tray = 0.04
    out.append(("ceramic", fr.box(0, A, 0, B, 0, tray)))
    out.append(("metal", fr.box(A * 0.2, A * 0.8, B * 0.45, B * 0.55, tray, tray + 0.004)))
    g = 0.008
    for side in ("left", "right", "front"):
        if _against(fr, room, side):
            continue
        if side == "front":
            opening = 0.5 if A > 0.85 else 0
            out.append(("_glass", fr.box(0, A - opening, B - g, B, tray, H)))
        elif side == "left":
            out.append(("_glass", fr.box(0, g, 0, B, tray, H)))
        else:
            out.append(("_glass", fr.box(A - g, A, 0, B, tray, H)))
    out.append(("metal", fr.box(A / 2 - 0.012, A / 2 + 0.012, 0, 0.024, 1.0, H - 0.05)))
    out.append(("metal", fr.box(A / 2 - 0.1, A / 2 + 0.1, 0.024, 0.25, H - 0.07, H - 0.05)))


def _bath(e, room, out):
    fr = Frame(e, _front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    r = 0.07
    out += [("ceramic", fr.box(0, A, 0, B, 0, 0.08)),
            ("ceramic", fr.box(0, r, 0, B, 0, H)), ("ceramic", fr.box(A - r, A, 0, B, 0, H)),
            ("ceramic", fr.box(r, A - r, 0, r, 0, H)), ("ceramic", fr.box(r, A - r, B - r, B, 0, H))]


def _curtain(e, room, out):
    x0, x1, y0, y1 = _rect(e)
    z0, z1 = e.get("z", 0) or 0, (e.get("z", 0) or 0) + e.get("h", 0.02)
    along_x = e["w"] >= e["d"]
    L = e["w"] if along_x else e["d"]
    n = max(4, round(L / 0.12))
    thin = (e["d"] if along_x else e["w"])
    for k in range(n):
        a0, a1 = L * k / n, L * (k + 1) / n
        off = (0, thin * 0.5) if k % 2 else (thin * 0.5, thin)
        if along_x:
            out.append(("fabric:curtain", (x0 + a0, x0 + a1, y0 + off[0], y0 + off[1], z0, z1)))
        else:
            out.append(("fabric:curtain", (x0 + off[0], x0 + off[1], y0 + a0, y0 + a1, z0, z1)))


def _board(e, room, out):
    fr = Frame(e, _thin_front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    t = 0.02
    out += [("cork", fr.box(t, A - t, 0, B, t, H - t)),
            ("wood", fr.box(0, A, 0, B, 0, t)), ("wood", fr.box(0, A, 0, B, H - t, H)),
            ("wood", fr.box(0, t, 0, B, t, H - t)), ("wood", fr.box(A - t, A, 0, B, t, H - t))]


def _hooks(e, room, out):
    fr = Frame(e, _thin_front(e, room))
    A, B, H = fr.A, fr.B, fr.H
    out.append(("wood", fr.box(0, A, 0, B * 0.4, 0, H)))
    n = max(2, round(A / 0.12))
    for a0, a1 in _split(A, n):
        c = (a0 + a1) / 2
        out.append(("metal", fr.box(c - 0.008, c + 0.008, B * 0.4, B, H * 0.3, H * 0.45)))


def _door(e, room, out):
    fr = Frame(e, _thin_front(e, room))
    out.append(("wood", fr.box(0, fr.A, 0, fr.B, 0, fr.H)))
    out.append(("metal", fr.box(fr.A - 0.12, fr.A - 0.05, 0, fr.B, min(1.0, fr.H * 0.5), min(1.03, fr.H * 0.5 + 0.03))))


SHAPES = {
    "bed": "bed",
    "sofa": _sofa, "seat": _sofa, "swing": _sofa,
    "chair": _chair,
    "desk": _table, "table": _table, "coffee_table": _table,
    "wardrobe": _cabinet, "closet": _cabinet, "cabinet": _cabinet, "storage": _cabinet, "drawers": _cabinet, "pooja_unit": _cabinet,
    "tv_unit": _tv_unit,
    "shelf": _shelf,
    "counter": _counter, "island": _counter, "sink": _counter, "cooktop": _counter,
    "fridge": _appliance, "oven": _appliance, "washer": _appliance, "dryer": _appliance, "dishwasher": _appliance,
    "toilet": _toilet, "vanity": _vanity, "basin": _basin, "shower": _shower, "bath": _bath, "bathtub": _bath,
    "stairs": _steps, "steps": _steps, "ladder": _ladder,
    "curtain": _curtain, "board": _board, "hooks": _hooks, "door": _door,
}


def parts(e, room, elements=()):
    """Parts for one element, or None to draw it as a single box."""
    shape = SHAPES.get(e["type"])
    if shape is None or e["type"] in BOX_TYPES:
        return None
    if e.get("w", 0) < 0.05 and e.get("d", 0) < 0.05:
        return None
    out = []
    if shape == "bed":
        _bed(e, room, out, elements)
    else:
        shape(e, room, out)
    return [(m, b) for m, b in out if b[1] - b[0] > 1e-4 and b[3] - b[2] > 1e-4 and b[5] - b[4] > 1e-4]
