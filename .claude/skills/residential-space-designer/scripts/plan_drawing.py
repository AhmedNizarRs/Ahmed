#!/usr/bin/env python3
"""Draw a layout as an architectural floor plan (SVG). Standard library only.

Usage: python3 plan_drawing.py layout.json > plan.svg [--state night] [--no-style]

Unlike floor_plan_svg.py's coloured boxes, this draws the room the way an
architect would: hatched walls, door leaves with their swing, glazed windows,
furniture as symbols (pillows on beds, sofa arms and cushions, hob rings, sink
bowls, toilet bowls, stair treads with an UP arrow), raised items such as loft
beds dashed as "overhead", a light tint per use, dimension lines with ticks, a
north arrow and a scale bar. Every element is a <g> with a <title> giving its
name and size, so a browser shows it on hover.

All colours come from CSS classes. By default the SVG carries its own <style>
(ink on white); --no-style leaves them out so a web page can theme the plan
with its own variables (classes: d-wall, d-hatch, d-line, d-thin, d-dash,
d-fill-<group>, d-lab, d-dim, d-glass, d-door, d-arc, d-note).
"""
import json
import math
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_layout as cl  # noqa: E402
import furniture as fu  # noqa: E402

SCALE = 100          # px per metre
MARGIN = 84          # room for dimension lines, north arrow and scale bar
WALL = 0.15          # drawn wall thickness, m
RAISED_Z = 1.0
SKIP = {"route"}
NO_LABEL = {"sink", "cooktop", "steps", "stairs", "toilet", "shower", "bath", "bathtub", "basin", "washer",
            "dryer", "ladder", "chair"}   # the symbol says what it is; the name is in the hover title
NICE = {"tv": "TV", "tv_unit": "TV unit", "wc": "WC"}

GROUP = {  # use groups for the light tint
    "bed": "sleep", "steps": "sleep", "ladder": "sleep",
    "sofa": "live", "seat": "live", "swing": "live", "coffee_table": "live", "tv_unit": "live",
    "desk": "work", "table": "work", "chair": "work", "board": "work",
    "counter": "kitchen", "sink": "kitchen", "cooktop": "kitchen", "oven": "kitchen", "fridge": "kitchen",
    "dishwasher": "kitchen", "island": "kitchen", "washer": "kitchen", "dryer": "kitchen",
    "toilet": "bath", "shower": "bath", "bath": "bath", "bathtub": "bath", "vanity": "bath", "basin": "bath",
    "wardrobe": "store", "closet": "store", "cabinet": "store", "drawers": "store", "shelf": "store",
    "pooja_unit": "store", "hooks": "store",
}

DEFAULT_STYLE = """
.d-bg{fill:#ffffff}.d-floor{fill:#ffffff}
.d-wall{fill:#1b2330}.d-hatch{stroke:#ffffff;stroke-width:1;opacity:.35}
.d-line{fill:none;stroke:#1b2330;stroke-width:1.4;stroke-linejoin:round}
.d-thin{fill:none;stroke:#1b2330;stroke-width:.8}
.d-dash{fill:none;stroke:#1f6feb;stroke-width:1.3;stroke-dasharray:6 4}
.d-solid{fill:#1b2330}
.d-glass{stroke:#1f6feb;stroke-width:1.2}
.d-door{stroke:#1b2330;stroke-width:2.2}.d-arc{fill:none;stroke:#1b2330;stroke-width:.8;stroke-dasharray:4 3}
.d-lab{font:500 11px system-ui,sans-serif;fill:#1b2330;paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round}
.d-dim{font:500 11px ui-monospace,monospace;fill:#55606f}.d-dimline{stroke:#55606f;stroke-width:.8;fill:none}
.d-note{font:600 11px ui-monospace,monospace;letter-spacing:.08em;fill:#55606f}
.d-up{font:600 9.5px ui-monospace,monospace;letter-spacing:.06em;fill:#1f6feb;paint-order:stroke;stroke:#ffffff;stroke-width:3px}
.d-fill-sleep{fill:#7c5cff;fill-opacity:.12}.d-fill-live{fill:#e2a33b;fill-opacity:.14}
.d-fill-work{fill:#3d8bff;fill-opacity:.12}.d-fill-kitchen{fill:#1fb58a;fill-opacity:.13}
.d-fill-bath{fill:#22b3c9;fill-opacity:.13}.d-fill-store{fill:#8492a6;fill-opacity:.14}
.d-fill-other{fill:#8492a6;fill-opacity:.08}
.d-el:hover .d-line{stroke:#1f6feb}
"""


class Drawer:
    def __init__(self, room):
        self.room = room
        self.W, self.D = room["width"], room["depth"]
        self.out = []
        # extra space outside each wall for doors that swing out, so dimensions clear them
        self.out_swing = {w: 0.0 for w in "SNEW"}
        for o in room.get("openings", []):
            if o.get("type") == "door" and o.get("swing") == "out" and o.get("wall") in self.out_swing:
                self.out_swing[o["wall"]] = max(self.out_swing[o["wall"]], o["width"])
        self.ml = MARGIN + self.out_swing["W"] * SCALE
        self.mt = MARGIN + self.out_swing["N"] * SCALE
        self.mr = MARGIN + self.out_swing["E"] * SCALE
        self.mb = MARGIN + self.out_swing["S"] * SCALE

    def P(self, x, y):
        return self.ml + x * SCALE, self.mt + (self.D - y) * SCALE

    def add(self, s):
        self.out.append(s)


class Local:
    """Local frame of an element: a across its front (0..A), b from back (0) to front (B)."""

    def __init__(self, dr, e, front):
        self.dr, self.e, self.f = dr, e, front
        self.x0, self.x1, self.y0, self.y1 = cl.rect(e)
        self.A, self.B = (e["w"], e["d"]) if front in ("+y", "-y") else (e["d"], e["w"])

    def xy(self, a, b):
        f = self.f
        if f == "+y":
            x, y = self.x0 + a, self.y0 + b
        elif f == "-y":
            x, y = self.x1 - a, self.y1 - b
        elif f == "+x":
            x, y = self.x0 + b, self.y1 - a
        else:
            x, y = self.x1 - b, self.y0 + a
        return self.dr.P(x, y)

    def rect(self, a0, b0, a1, b1, cls="d-line", rx=0):
        (px0, py0), (px1, py1) = self.xy(a0, b0), self.xy(a1, b1)
        x, y = min(px0, px1), min(py0, py1)
        w, h = abs(px1 - px0), abs(py1 - py0)
        return f'<rect class="{cls}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"{f" rx={chr(34)}{rx:.1f}{chr(34)}" if rx else ""}/>'

    def line(self, a0, b0, a1, b1, cls="d-thin"):
        (x0, y0), (x1, y1) = self.xy(a0, b0), self.xy(a1, b1)
        return f'<line class="{cls}" x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}"/>'

    def circle(self, a, b, r, cls="d-thin"):
        x, y = self.xy(a, b)
        return f'<circle class="{cls}" cx="{x:.1f}" cy="{y:.1f}" r="{r * SCALE:.1f}"/>'

    def ellipse(self, a, b, ra, rb, cls="d-thin"):
        x, y = self.xy(a, b)
        rx, ry = (ra, rb) if self.f in ("+y", "-y") else (rb, ra)
        return f'<ellipse class="{cls}" cx="{x:.1f}" cy="{y:.1f}" rx="{rx * SCALE:.1f}" ry="{ry * SCALE:.1f}"/>'

    def poly(self, pts, cls="d-thin", closed=False):
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in (self.xy(a, b) for a, b in pts))
        return f'<{"polygon" if closed else "polyline"} class="{cls}" points="{p}"/>'


# ---------------------------------------------------------------- symbols

def _storage(L, tall, sliding=False):
    A, B = L.A, L.B
    s = [L.line(0, B - 0.05, A, B - 0.05)]
    if tall:  # full-height storage: hanging rail and hangers, or a cross
        if L.e["type"] in ("wardrobe", "closet"):
            s.append(L.line(0.04, B / 2, A - 0.04, B / 2, "d-thin"))
            n = max(3, int(A / 0.12))
            for k in range(1, n):
                a = A * k / n
                s.append(L.line(a - 0.025, B / 2 - 0.12, a + 0.025, B / 2 + 0.12))
        else:
            s += [L.line(0, 0, A, B - 0.05), L.line(A, 0, 0, B - 0.05)]
    if sliding:
        s.append(L.line(A * 0.1, B - 0.02, A * 0.55, B - 0.02))
        s.append(L.line(A * 0.45, B - 0.035, A * 0.9, B - 0.035))
    return s


def symbol(dr, e, elements):
    t = e["type"]
    if t == "bed":
        L = Local(dr, e, fu._bed_front(e, dr.room))
        A, B = L.A, L.B
        s = []
        n = 2 if A >= 1.2 else 1
        pw = (A - 0.1 - 0.05 * (n - 1)) / n
        for k in range(n):
            a0 = 0.05 + k * (pw + 0.05)
            s.append(L.rect(a0, 0.06, a0 + pw, min(0.34, B * 0.17), "d-thin", 4))
        fold = min(0.55, B * 0.28)
        s.append(L.line(0, fold, A, fold))
        s.append(L.poly([(A * 0.55, fold), (A, fold + 0.28), (A, fold)], "d-thin"))
        return L, s
    if t in ("wardrobe", "closet", "cabinet", "drawers", "storage", "pooja_unit"):
        L = Local(dr, e, fu._front(e, dr.room))
        return L, _storage(L, e.get("h", 0) >= 1.5, e.get("doors") == "sliding")
    if t in ("sofa", "seat", "swing"):
        L = Local(dr, e, fu._front(e, dr.room))
        A, B = L.A, L.B
        back, arm = min(0.2, B * 0.25), min(0.16, A * 0.1)
        s = [L.rect(0, 0, A, back, "d-thin", 3), L.rect(0, back, arm, B, "d-thin", 3), L.rect(A - arm, back, A, B, "d-thin", 3)]
        inner = A - 2 * arm
        n = max(1, round(inner / 0.65))
        for k in range(1, n):
            a = arm + inner * k / n
            s.append(L.line(a, back, a, B - 0.03))
        return L, s
    if t in ("desk", "table", "coffee_table", "island"):
        L = Local(dr, e, fu._front(e, dr.room))
        s = [L.rect(0.03, 0.03, L.A - 0.03, L.B - 0.03, "d-thin", 4)] if t != "island" else [L.line(0, L.B - 0.04, L.A, L.B - 0.04)]
        return L, s
    if t == "chair":
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.line(0.04, 0.06, L.A - 0.04, 0.06)]
    if t == "tv_unit":
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.rect(L.A * 0.1, 0.04, L.A * 0.9, 0.09, "d-solid")]
    if t in ("counter", "sink", "cooktop", "oven", "dishwasher", "washer", "dryer", "fridge"):
        L = Local(dr, e, fu._front(e, dr.room))
        A, B = L.A, L.B
        s = []
        if t in ("counter", "sink", "cooktop", "island"):
            s.append(L.line(0, B - 0.03, A, B - 0.03))
        if t == "sink":
            bw = min(0.5, A * 0.7)
            s.append(L.rect(A / 2 - bw / 2, B * 0.18, A / 2 + bw / 2, B * 0.8, "d-thin", 8))
            s.append(L.circle(A / 2, B * 0.5, 0.025))
            s.append(L.circle(A / 2, B * 0.1, 0.02, "d-solid"))
        elif t == "cooktop":
            for a, b, r in ((0.3, 0.3, 0.09), (0.7, 0.3, 0.07), (0.3, 0.7, 0.07), (0.7, 0.7, 0.09)):
                s.append(L.circle(A * a, B * b, min(r, A * 0.15)))
                s.append(L.circle(A * a, B * b, min(r, A * 0.15) * 0.45))
        elif t == "fridge":
            s += [L.line(0.04, 0.04, A - 0.04, B - 0.06), L.line(0, B - 0.06, A, B - 0.06)]
        elif t in ("washer", "dryer", "dishwasher"):
            s.append(L.circle(A / 2, B / 2, min(A, B) * 0.32))
        elif t == "oven":
            s.append(L.rect(A * 0.15, B * 0.2, A * 0.85, B * 0.75, "d-thin", 3))
        return L, s
    if t == "toilet":
        L = Local(dr, e, fu._front(e, dr.room))
        A, B = L.A, L.B
        tank = min(0.18, B * 0.35)
        bw = min(A * 0.48, 0.2)
        return L, [L.rect(A / 2 - min(A * 0.45, 0.25), 0, A / 2 + min(A * 0.45, 0.25), tank, "d-thin", 3),
                   L.ellipse(A / 2, tank + (B - tank) / 2, bw, (B - tank) / 2 - 0.01),
                   L.ellipse(A / 2, tank + (B - tank) / 2 + 0.02, bw * 0.65, (B - tank) / 2 - 0.08)]
    if t in ("vanity", "basin"):
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.ellipse(L.A / 2, L.B * 0.55, min(L.A * 0.32, 0.22), L.B * 0.28), L.circle(L.A / 2, L.B * 0.12, 0.02, "d-solid")]
    if t == "shower":
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.line(0, 0, L.A, L.B), L.line(L.A, 0, 0, L.B), L.circle(L.A / 2, L.B / 2, 0.05, "d-floor d-thin")]
    if t in ("bath", "bathtub"):
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.rect(0.07, 0.07, L.A - 0.07, L.B - 0.07, "d-thin", 14), L.circle(L.A / 2, 0.2, 0.025)]
    if t in ("steps", "stairs"):
        L = Local(dr, e, fu._front(e, dr.room))
        A, B = L.A, L.B
        n = max(2, round(e.get("h", 1) / (0.18 if t == "stairs" else 0.25)))
        s = [L.line(0, B * k / n, A, B * k / n) for k in range(1, n)]
        s.append(L.line(A / 2, B * 0.92, A / 2, B * 0.12, "d-line"))
        s.append(L.poly([(A / 2 - 0.06, B * 0.22), (A / 2, B * 0.1), (A / 2 + 0.06, B * 0.22)], "d-line"))
        return L, s
    if t == "ladder":
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.line(0.03, 0, 0.03, L.B), L.line(L.A - 0.03, 0, L.A - 0.03, L.B)]
    if t == "shelf":
        L = Local(dr, e, fu._front(e, dr.room))
        return L, [L.line(0, L.B * 0.5, L.A, L.B * 0.5)]
    if t == "curtain":
        L = Local(dr, e, fu._thin_front(e, dr.room))
        n = max(6, int(L.A / 0.1))
        return L, [L.poly([(L.A * k / n, L.B * (0.15 if k % 2 else 0.85)) for k in range(n + 1)], "d-thin")]
    if t == "door":
        L = Local(dr, e, fu._thin_front(e, dr.room))
        return L, [L.line(0, L.B / 2, L.A, L.B / 2, "d-door")]
    L = Local(dr, e, fu._front(e, dr.room))
    return L, []


# ---------------------------------------------------------------- drawing

def _label_fits(e, label):
    w, d = e["w"] * SCALE, e["d"] * SCALE
    long_side, short = max(w, d), min(w, d)
    return short >= 16 and long_side >= len(label) * 6.4 + 10


def _name(e):
    if e.get("label"):
        return e["label"]
    return NICE.get(e["type"]) or e["type"].replace("_", " ").capitalize()


def _short(e):
    short = _name(e)
    for cut in (",", "+", "(", " with ", " under ", " doubles "):
        short = short.split(cut)[0]
    return short.strip()


def _label(dr, e):
    if e["type"] in NO_LABEL:
        return ""
    short = _short(e)
    if len(short) > 22:
        short = short[:21].rstrip() + "…"
    if not _label_fits(e, short):
        return ""
    x0, x1, y0, y1 = cl.rect(e)
    cx, cy = dr.P((x0 + x1) / 2, (y0 + y1) / 2)
    rot = f' transform="rotate(-90 {cx:.1f} {cy:.1f})"' if e["d"] > 1.6 * e["w"] and e["w"] * SCALE < len(short) * 6.4 + 10 else ""
    return f'<text class="d-lab" x="{cx:.1f}" y="{cy + 4:.1f}" text-anchor="middle"{rot}>{escape(short)}</text>'


def _walls(dr):
    W, D, T = dr.W, dr.D, WALL
    (ox0, oy0), (ox1, oy1) = dr.P(-T, D + T), dr.P(W + T, -T)
    (ix0, iy0), (ix1, iy1) = dr.P(0, D), dr.P(W, 0)
    path = (f"M{ox0:.1f},{oy0:.1f}H{ox1:.1f}V{oy1:.1f}H{ox0:.1f}Z "
            f"M{ix0:.1f},{iy0:.1f}V{iy1:.1f}H{ix1:.1f}V{iy0:.1f}Z")
    s = [f'<path class="d-wall" fill-rule="evenodd" d="{path}"/>',
         '<clipPath id="wallclip"><path fill-rule="evenodd" d="' + path + '"/></clipPath>',
         '<g clip-path="url(#wallclip)">']
    step = 7
    span = int((ox1 - ox0) + (oy1 - oy0))
    for k in range(0, span, step):
        s.append(f'<line class="d-hatch" x1="{ox0 + k:.1f}" y1="{oy0:.1f}" x2="{ox0 + k - (oy1 - oy0):.1f}" y2="{oy1:.1f}"/>')
    s.append("</g>")
    return s


def _opening(dr, o):
    W, D, T = dr.W, dr.D, WALL
    a0, a1 = o["offset"], o["offset"] + o["width"]
    wall = o.get("wall")
    if wall not in ("S", "N", "E", "W"):
        return []
    if wall == "S":
        cut = (a0, a1, -T, 0)
    elif wall == "N":
        cut = (a0, a1, D, D + T)
    elif wall == "W":
        cut = (-T, 0, a0, a1)
    else:
        cut = (W, W + T, a0, a1)
    (x0, y0), (x1, y1) = dr.P(cut[0], cut[3]), dr.P(cut[1], cut[2])
    s = [f'<rect class="d-floor" x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}"/>']
    horiz = wall in ("S", "N")
    if o["type"] != "door":
        for f in (0.2, 0.5, 0.8):  # glazing lines inside the wall thickness
            if horiz:
                yy = y0 + (y1 - y0) * f
                s.append(f'<line class="d-glass" x1="{x0:.1f}" y1="{yy:.1f}" x2="{x1:.1f}" y2="{yy:.1f}"/>')
            else:
                xx = x0 + (x1 - x0) * f
                s.append(f'<line class="d-glass" x1="{xx:.1f}" y1="{y0:.1f}" x2="{xx:.1f}" y2="{y1:.1f}"/>')
        for edge in ((x0, y0, x0, y1), (x1, y0, x1, y1)) if horiz else ((x0, y0, x1, y0), (x0, y1, x1, y1)):
            s.append(f'<line class="d-thin" x1="{edge[0]:.1f}" y1="{edge[1]:.1f}" x2="{edge[2]:.1f}" y2="{edge[3]:.1f}"/>')
        return s
    if o.get("swing") == "sliding":
        if horiz:
            yy = (y0 + y1) / 2
            s.append(f'<line class="d-door" x1="{x0:.1f}" y1="{yy - 2:.1f}" x2="{(x0 + x1) / 2 + 6:.1f}" y2="{yy - 2:.1f}"/>')
            s.append(f'<line class="d-door" x1="{(x0 + x1) / 2 - 6:.1f}" y1="{yy + 2:.1f}" x2="{x1:.1f}" y2="{yy + 2:.1f}"/>')
        return s
    # hinge at the offset end, on the room face; leaf drawn open at 90°, arc to the other jamb
    face = {"S": 0, "N": D, "W": 0, "E": W}[wall]
    inward = {"S": 1, "N": -1, "W": 1, "E": -1}[wall] * (-1 if o.get("swing") == "out" else 1)
    r = o["width"]
    if horiz:
        hx, hy = dr.P(a0, face)
        lx, ly = dr.P(a0, face + inward * r)
        ex, ey = dr.P(a1, face)
    else:
        hx, hy = dr.P(face, a0)
        lx, ly = dr.P(face + inward * r, a0)
        ex, ey = dr.P(face, a1)
    cross = (lx - hx) * (ey - hy) - (ly - hy) * (ex - hx)
    sweep = 1 if cross > 0 else 0
    R = r * SCALE
    s.append(f'<line class="d-door" x1="{hx:.1f}" y1="{hy:.1f}" x2="{lx:.1f}" y2="{ly:.1f}"/>')
    s.append(f'<path class="d-arc" d="M{lx:.1f},{ly:.1f} A{R:.1f},{R:.1f} 0 0,{sweep} {ex:.1f},{ey:.1f}"/>')
    return s


def _dims(dr):
    W, D, T = dr.W, dr.D, WALL
    s = []
    off = 0.32 + dr.out_swing["S"]
    (x0, y), (x1, _) = dr.P(0, -T - off), dr.P(W, -T - off)
    s.append(f'<line class="d-dimline" x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}"/>')
    for x in (x0, x1):
        s.append(f'<line class="d-dimline" x1="{x - 4:.1f}" y1="{y + 4:.1f}" x2="{x + 4:.1f}" y2="{y - 4:.1f}"/>')
        s.append(f'<line class="d-dimline" x1="{x:.1f}" y1="{y - 9:.1f}" x2="{x:.1f}" y2="{y + 5:.1f}"/>')
    s.append(f'<text class="d-dim" x="{(x0 + x1) / 2:.1f}" y="{y - 6:.1f}" text-anchor="middle">{W:.2f} m</text>')
    off = 0.32 + dr.out_swing["W"]
    (x, y0), (_, y1) = dr.P(-T - off, D), dr.P(-T - off, 0)
    s.append(f'<line class="d-dimline" x1="{x:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y1:.1f}"/>')
    for yy in (y0, y1):
        s.append(f'<line class="d-dimline" x1="{x - 4:.1f}" y1="{yy + 4:.1f}" x2="{x + 4:.1f}" y2="{yy - 4:.1f}"/>')
        s.append(f'<line class="d-dimline" x1="{x - 5:.1f}" y1="{yy:.1f}" x2="{x + 9:.1f}" y2="{yy:.1f}"/>')
    cy = (y0 + y1) / 2
    s.append(f'<text class="d-dim" x="{x - 6:.1f}" y="{cy:.1f}" text-anchor="middle" transform="rotate(-90 {x - 6:.1f} {cy:.1f})">{D:.2f} m</text>')
    return s


def _furniture(dr, view):
    out = []
    els = [e for e in view.get("elements", []) if e.get("type") not in SKIP]
    floor = [e for e in els if (e.get("z", 0) or 0) < RAISED_Z]
    raised = [e for e in els if (e.get("z", 0) or 0) >= RAISED_Z]
    for e in sorted(floor, key=lambda e: e.get("z", 0) or 0) + raised:
        up = e in raised
        label = _name(e)
        title = f"{label} · {e['w']:.2f} × {e['d']:.2f} m, {e.get('h', 0):.2f} m high" + (f", {e.get('z', 0):.2f} m up" if up else "")
        x0, x1, y0, y1 = cl.rect(e)
        (px0, py0), (px1, py1) = dr.P(x0, y1), dr.P(x1, y0)
        g = [f'<g class="d-el" data-id="{escape(e["id"])}"><title>{escape(title)}</title>']
        thin = e["type"] in ("curtain", "board", "hooks", "door")
        if e["type"] in ("partition", "divider"):
            g.append(f'<rect class="d-wall" x="{px0:.1f}" y="{py0:.1f}" width="{px1 - px0:.1f}" height="{py1 - py0:.1f}"/>')
        elif up:
            g.append(f'<rect class="d-dash" x="{px0:.1f}" y="{py0:.1f}" width="{px1 - px0:.1f}" height="{py1 - py0:.1f}" rx="2"/>')
        else:
            if not thin:
                grp = GROUP.get(e["type"], "other")
                g.append(f'<rect class="d-fill-{grp}" x="{px0:.1f}" y="{py0:.1f}" width="{px1 - px0:.1f}" height="{py1 - py0:.1f}" rx="2"/>')
            _, sym = symbol(dr, e, els)
            if not thin:
                g.append(f'<rect class="d-line" x="{px0:.1f}" y="{py0:.1f}" width="{px1 - px0:.1f}" height="{py1 - py0:.1f}" rx="2"/>')
            g += sym
            if not thin:
                g.append(_label(dr, e))
        if up and not thin:
            # overhead items: a small tag in the inside corner, so it doesn't sit on what's below
            tag = f"↑ {_short(e).upper()} · {e.get('z', 0):.2f} M"
            if (px1 - px0) > len(tag) * 6.2 + 12 and (py1 - py0) > 16:
                g.append(f'<text class="d-up" x="{px1 - 6:.1f}" y="{py1 - 6:.1f}" text-anchor="end">{escape(tag)}</text>')
        g.append("</g>")
        out.append("".join(g))
    return out


def render(layout, state=None, style=True):
    if state is None and layout.get("states"):
        state = layout["states"][0]
    view = cl.apply_state(layout, state)
    room = view["room"]
    dr = Drawer(room)
    W, D = dr.W, dr.D
    cw, ch = int(W * SCALE + dr.ml + dr.mr), int(D * SCALE + dr.mt + dr.mb)
    title = escape(room.get("name", "Room") + (f" ({state})" if state else ""))
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" class="drawing" role="img" aria-label="Floor plan: {title}">',
         f"<title>{title}</title>"]
    if style:
        s.append(f"<style>{DEFAULT_STYLE}</style>")
        s.append(f'<rect class="d-bg" width="{cw}" height="{ch}"/>')
    (fx0, fy0), (fx1, fy1) = dr.P(0, D), dr.P(W, 0)
    s.append(f'<rect class="d-floor" x="{fx0:.1f}" y="{fy0:.1f}" width="{fx1 - fx0:.1f}" height="{fy1 - fy0:.1f}"/>')
    s += _furniture(dr, view)
    s += _walls(dr)
    for o in room.get("openings", []):
        s += _opening(dr, o)
    s += _dims(dr)
    # north arrow and scale bar
    nx, ny = cw - 26, 24
    s.append(f'<g class="d-north"><circle class="d-thin" cx="{nx:.1f}" cy="{ny:.1f}" r="11"/>'
             f'<polygon class="d-solid" points="{nx:.1f},{ny - 9:.1f} {nx + 4:.1f},{ny + 4:.1f} {nx:.1f},{ny + 1:.1f} {nx - 4:.1f},{ny + 4:.1f}"/>'
             f'<text class="d-note" x="{nx:.1f}" y="{ny + 25:.1f}" text-anchor="middle">N</text></g>')
    sx, sy = cw - 30 - SCALE, ch - 22
    s.append(f'<g class="d-scale"><rect class="d-solid" x="{sx:.1f}" y="{sy:.1f}" width="{SCALE / 2:.1f}" height="4"/>'
             f'<rect class="d-thin" x="{sx + SCALE / 2:.1f}" y="{sy:.1f}" width="{SCALE / 2:.1f}" height="4"/>'
             f'<text class="d-dim" x="{sx:.1f}" y="{sy - 5:.1f}" text-anchor="middle">0</text>'
             f'<text class="d-dim" x="{sx + SCALE:.1f}" y="{sy - 5:.1f}" text-anchor="middle">1 m</text></g>')
    area = W * D
    s.append(f'<text class="d-note" x="{dr.ml - WALL * SCALE:.1f}" y="{dr.mt - WALL * SCALE - 14:.1f}">'
             f'{escape(room.get("name", "Room").upper())} · {area:.1f} M²{(" · " + state.upper()) if state else ""}</text>')
    s.append("</svg>")
    return "\n".join(s)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "-h" in sys.argv or "--help" in sys.argv:
        print(__doc__)
        sys.exit(0)
    state = None
    if "--state" in sys.argv:
        i = sys.argv.index("--state")
        state = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
        args = [a for a in args if a != state]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    layout = json.loads(Path(args[0]).read_text())
    print(render(layout, state, style="--no-style" not in sys.argv))


if __name__ == "__main__":
    main()
