#!/usr/bin/env python3
"""Draw a layout as a small PNG floor plan, so a model (or a person) can look at it.

Usage: python3 plan_png.py layout.json plan.png [--state night] [--scale 60]

Same conventions as floor_plan_svg.py: north up, walls dark, doors with their
swing, windows blue. Floor items are filled in their type colour; raised items
(loft beds, wall cabinets, z >= 1 m) are drawn as a hatched outline on top.
Each element carries a number; legend() returns the matching names.
Pure standard library (zlib), so the MCP server can return it as an image.
"""
import json
import math
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_layout as cl  # noqa: E402
from floor_plan_svg import FILL, DEFAULT_FILL  # noqa: E402

MARGIN = 28
WALL_PX = 6
RAISED_Z = 1.0
SKIP = {"route"}
INK = (43, 43, 43)
WALL = (70, 66, 60)
WINDOW = (74, 144, 194)
FLOOR = (250, 248, 243)
BG = (255, 255, 255)
MAX_PX = 1600   # keep images a sensible size for a model's context

# 3 × 5 digits, one string per row
DIGITS = {
    "0": ("111", "101", "101", "101", "111"), "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"), "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"), "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"), "7": ("111", "001", "001", "001", "001"),
    "8": ("111", "101", "111", "101", "111"), "9": ("111", "101", "111", "001", "111"),
}


def _rgb(hex_colour):
    return tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))


class Canvas:
    def __init__(self, w, h, colour=BG):
        self.w, self.h = w, h
        self.px = [bytearray(bytes(colour) * w) for _ in range(h)]

    def dot(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][3 * x:3 * x + 3] = bytes(c)

    def rect(self, x0, y0, x1, y1, c):
        x0, x1 = max(0, int(round(min(x0, x1)))), min(self.w, int(round(max(x0, x1))))
        y0, y1 = max(0, int(round(min(y0, y1)))), min(self.h, int(round(max(y0, y1))))
        if x1 <= x0:
            return
        row = bytes(c) * (x1 - x0)
        for y in range(y0, y1):
            self.px[y][3 * x0:3 * x1] = row

    def outline(self, x0, y0, x1, y1, c, t=1):
        self.rect(x0, y0, x1, y0 + t, c)
        self.rect(x0, y1 - t, x1, y1, c)
        self.rect(x0, y0, x0 + t, y1, c)
        self.rect(x1 - t, y0, x1, y1, c)

    def hatch(self, x0, y0, x1, y1, c, step=7):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                if (x + y) % step == 0:
                    self.dot(x, y, c)

    def line(self, x0, y0, x1, y1, c, dash=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            if dash and (k // dash) % 2:
                continue
            t = k / n
            self.dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c)

    def number(self, cx, cy, text, scale=2):
        gw, gh = 4 * scale * len(text) + scale, 7 * scale
        x0, y0 = int(cx - gw / 2), int(cy - gh / 2)
        self.rect(x0, y0, x0 + gw, y0 + gh, BG)
        self.outline(x0, y0, x0 + gw, y0 + gh, INK)
        for k, ch in enumerate(text):
            for r, row in enumerate(DIGITS[ch]):
                for col, bit in enumerate(row):
                    if bit == "1":
                        gx, gy = x0 + scale + k * 4 * scale + col * scale, y0 + scale + r * scale
                        self.rect(gx, gy, gx + scale, gy + scale, INK)

    def png(self):
        raw = b"".join(b"\0" + bytes(row) for row in self.px)

        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def _items(view):
    return [e for e in view.get("elements", []) if e.get("type") not in SKIP]


def legend(layout, state=None):
    """[(number, id, label, type, raised)] in the order the numbers are drawn."""
    view = cl.apply_state(layout, state or (layout.get("states") or [None])[0])
    return [(k + 1, e["id"], e.get("label") or e["id"], e["type"], (e.get("z", 0) or 0) >= RAISED_Z)
            for k, e in enumerate(_items(view))]


def render(layout, state=None, scale=60):
    """PNG bytes of the plan."""
    if state is None and layout.get("states"):
        state = layout["states"][0]
    view = cl.apply_state(layout, state)
    room = view["room"]
    W, D = room["width"], room["depth"]
    scale = min(scale, (MAX_PX - 2 * MARGIN) / max(W, D))
    cw, ch = int(W * scale + 2 * MARGIN), int(D * scale + 2 * MARGIN)
    cv = Canvas(cw, ch)

    def P(x, y):
        return MARGIN + x * scale, MARGIN + (D - y) * scale

    x0, y0 = P(0, D)
    x1, y1 = P(W, 0)
    cv.rect(x0 - WALL_PX, y0 - WALL_PX, x1 + WALL_PX, y1 + WALL_PX, WALL)
    cv.rect(x0, y0, x1, y1, FLOOR)

    items = list(enumerate(_items(view), 1))
    floor = [(n, e) for n, e in items if (e.get("z", 0) or 0) < RAISED_Z]
    raised = [(n, e) for n, e in items if (e.get("z", 0) or 0) >= RAISED_Z]
    for n, e in sorted(floor, key=lambda ne: ne[1].get("z", 0) or 0):
        ex0, ex1, ey0, ey1 = cl.rect(e)
        a, b = P(ex0, ey1)
        c, d = P(ex1, ey0)
        cv.rect(a, b, c, d, _rgb(FILL.get(e["type"], DEFAULT_FILL)))
        cv.outline(a, b, c, d, INK)
    for n, e in raised:
        ex0, ex1, ey0, ey1 = cl.rect(e)
        a, b = P(ex0, ey1)
        c, d = P(ex1, ey0)
        col = tuple(max(0, v - 90) for v in _rgb(FILL.get(e["type"], DEFAULT_FILL)))
        cv.hatch(a, b, c, d, col)
        cv.outline(a, b, c, d, col, 2)

    for o in room.get("openings", []):
        a, b = o["offset"], o["offset"] + o["width"]
        ends = {"S": ((a, 0), (b, 0)), "N": ((a, D), (b, D)), "W": ((0, a), (0, b)), "E": ((W, a), (W, b))}.get(o.get("wall"))
        if not ends:
            continue
        (p0x, p0y), (p1x, p1y) = P(*ends[0]), P(*ends[1])
        horiz = o["wall"] in ("S", "N")
        t = WALL_PX
        box = (min(p0x, p1x), (p0y if horiz else min(p0y, p1y)), max(p0x, p1x), (p0y if horiz else max(p0y, p1y)))
        bx0, by0, bx1, by1 = (box[0], box[1] - t, box[2], box[1] + t) if horiz else (box[0] - t, box[1], box[0] + t, box[3])
        cv.rect(bx0, by0, bx1, by1, FLOOR if o["type"] == "door" else BG)
        if o["type"] != "door":
            cv.rect(*((bx0, by0 + 2, bx1, by0 + 4) if horiz else (bx0 + 2, by0, bx0 + 4, by1)), WINDOW)
            cv.rect(*((bx0, by1 - 4, bx1, by1 - 2) if horiz else (bx1 - 4, by0, bx1 - 2, by1)), WINDOW)
            continue
        if o.get("swing") == "sliding":
            continue
        r = o["width"] * scale
        inward = {"S": (0, -1), "N": (0, 1), "W": (1, 0), "E": (-1, 0)}[o["wall"]]
        if o.get("swing") == "out":
            inward = (-inward[0], -inward[1])
        along = ((p1x - p0x) / r, (p1y - p0y) / r)
        cv.line(p0x, p0y, p0x + inward[0] * r, p0y + inward[1] * r, INK)
        steps = max(12, int(r))
        prev = None
        for k in range(steps + 1):
            ang = (math.pi / 2) * k / steps
            q = (p0x + r * (math.cos(ang) * inward[0] + math.sin(ang) * along[0]),
                 p0y + r * (math.cos(ang) * inward[1] + math.sin(ang) * along[1]))
            if prev and k % 4 < 2:
                cv.line(prev[0], prev[1], q[0], q[1], INK)
            prev = q

    for n, e in items:
        ex0, ex1, ey0, ey1 = cl.rect(e)
        a, b = P(ex0, ey1)
        c, d = P(ex1, ey0)
        if abs(c - a) < 10 and abs(d - b) < 10:
            continue
        cv.number((a + c) / 2, (b + d) / 2, str(n))

    # north arrow: a small N-pointing triangle in the top margin
    nx = cw - MARGIN / 2 - 4
    for k in range(10):
        cv.rect(nx - k / 2, 6 + k, nx + k / 2 + 1, 7 + k, INK)
    return cv.png()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "-h" in sys.argv or "--help" in sys.argv:
        print(__doc__)
        sys.exit(0)
    opts = {}
    for flag in ("--state", "--scale"):
        if flag in sys.argv:
            i = sys.argv.index(flag)
            opts[flag] = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
            args = [a for a in args if a != opts[flag]]
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    layout = json.loads(Path(args[0]).read_text())
    Path(args[1]).write_bytes(render(layout, opts.get("--state"), float(opts.get("--scale") or 60)))
    for n, eid, label, typ, up in legend(layout, opts.get("--state")):
        print(f"{n:>2}  {label} ({typ}{', raised' if up else ''})")


if __name__ == "__main__":
    main()
