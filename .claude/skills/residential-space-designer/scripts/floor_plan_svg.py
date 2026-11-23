#!/usr/bin/env python3
"""Draw a layout JSON as an SVG floor plan (top view, north up, 1 m = 100 px).

Usage: python3 floor_plan_svg.py layout.json [--state night] > plan.svg

Floor-level items are filled; raised items (z >= 1.0 m, such as loft beds and
wall cabinets) are drawn dashed on top so both levels read in one picture.
Doors show their swing, windows a double line, routes a hatched strip.
Standard library only.
"""
import json
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_layout as cl  # noqa: E402

SCALE = 100   # px per metre
MARGIN = 50

FILL = {
    "bed": "#c9d8f0", "sofa": "#e8d3b9", "seat": "#e8d3b9", "swing": "#e8d3b9",
    "desk": "#d9e8c9", "table": "#d9e8c9", "chair": "#eef3e6",
    "wardrobe": "#e2d5ec", "cabinet": "#e2d5ec", "shelf": "#ece4f2", "storage": "#e2d5ec",
    "counter": "#f0dcc9", "sink": "#cfe6ec", "cooktop": "#f2c9c0", "oven": "#f2c9c0",
    "fridge": "#dfe4ea", "dishwasher": "#dfe4ea", "island": "#f0dcc9",
    "toilet": "#cfe6ec", "basin": "#cfe6ec", "shower": "#cfe6ec", "bath": "#cfe6ec", "bathtub": "#cfe6ec", "vanity": "#cfe6ec",
    "washer": "#dfe4ea", "dryer": "#dfe4ea", "closet": "#e2d5ec",
    "stairs": "#e6e1d6", "steps": "#e6e1d6", "ladder": "#e6e1d6", "platform": "#ede8dd",
    "partition": "#9aa3ad", "pooja_unit": "#f6e2a8",
}
DEFAULT_FILL = "#eeeeee"
INK = "#2b2b2b"


def _xy(room, x, y):
    """Layout metres to SVG pixels (SVG y grows downward, so flip)."""
    return MARGIN + x * SCALE, MARGIN + (room["depth"] - y) * SCALE


def _label(e):
    return e.get("label") or e["id"]


CHAR_W = 0.58  # average glyph width as a fraction of font size
MIN_FONT, MAX_FONT = 7.0, 12.0


def _fit(label, w, h):
    """Pick (text, font size, rotated) so the label fits inside a w×h px box, or None."""
    if w > 1.6 * h and h < 14:
        return None
    rotate = h > 1.6 * w            # tall, narrow box: run the text up the box
    long_side, short_side = (h, w) if rotate else (w, h)
    pad = long_side - 6
    size = min(MAX_FONT, short_side * 0.6, pad / max(len(label) * CHAR_W, 1))
    if size < MIN_FONT:
        if short_side * 0.6 < MIN_FONT:
            return None
        size = MIN_FONT
        keep = int(pad / (size * CHAR_W)) - 1
        if keep < 3:
            return None
        label = label[:keep].rstrip() + "…"
    return label, size, rotate


def _element(room, e):
    x0, x1, y0, y1 = cl.rect(e)
    px, py = _xy(room, x0, y1)
    w, h = (x1 - x0) * SCALE, (y1 - y0) * SCALE
    raised = e.get("z", 0) >= cl.FLOOR_OBSTACLE_Z
    t = e["type"]
    if t == "route":
        return (f'<rect x="{px:.1f}" y="{py:.1f}" width="{w:.1f}" height="{h:.1f}" '
                f'fill="url(#route)" stroke="#3c8d5a" stroke-dasharray="4 3"><title>{escape(_label(e))} (keep clear)</title></rect>')
    style = (f'fill="none" stroke="#5a4a8a" stroke-width="1.5" stroke-dasharray="6 4"' if raised
             else f'fill="{FILL.get(t, DEFAULT_FILL)}" stroke="{INK}" stroke-width="1"')
    out = [f'<g><title>{escape(_label(e))} ({t}, z {e.get("z", 0)} m, h {e.get("h", 0)} m)</title>',
           f'<rect x="{px:.1f}" y="{py:.1f}" width="{w:.1f}" height="{h:.1f}" {style}/>']
    text = _fit(_label(e), w, h)
    if text:
        label, size, rotate = text
        colour = "#5a4a8a" if raised else INK
        if rotate:
            cx, cy = px + w / 2 + size * 0.35, py + h / 2
            out.append(f'<text x="{cx:.1f}" y="{cy:.1f}" font-size="{size:.1f}" text-anchor="middle" '
                       f'transform="rotate(-90 {cx:.1f} {cy:.1f})" fill="{colour}">{escape(label)}</text>')
        else:
            # raised labels sit at the top edge so they don't sit on the floor item's label
            cy = py + size + 3 if raised else py + h / 2 + size * 0.35
            out.append(f'<text x="{px + w / 2:.1f}" y="{cy:.1f}" font-size="{size:.1f}" text-anchor="middle" '
                       f'fill="{colour}">{escape(label)}</text>')
    out.append("</g>")
    return "".join(out)


def _opening(room, o):
    W, D = room["width"], room["depth"]
    a, b = o["offset"], o["offset"] + o["width"]
    ends = {"S": ((a, 0), (b, 0)), "N": ((a, D), (b, D)),
            "W": ((0, a), (0, b)), "E": ((W, a), (W, b))}.get(o["wall"])
    if not ends:
        return ""
    (x0, y0), (x1, y1) = (_xy(room, *ends[0]), _xy(room, *ends[1]))
    out = [f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#ffffff" stroke-width="7"/>']
    if o["type"] == "window":
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#4a90c2" stroke-width="6"/>')
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#ffffff" stroke-width="2"/>')
    else:
        r = o["width"] * SCALE
        inward = {"S": (0, -1), "N": (0, 1), "W": (1, 0), "E": (-1, 0)}[o["wall"]]  # SVG direction into room
        if o.get("swing", "in") == "out":
            inward = (-inward[0], -inward[1])
        if o.get("swing") in ("in", "out", None):
            lx, ly = x0 + inward[0] * r, y0 + inward[1] * r
            sweep = 1 if (o["wall"] in ("S", "E")) ^ (o.get("swing") == "out") else 0
            out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{lx:.1f}" y2="{ly:.1f}" stroke="{INK}" stroke-width="1.5"/>')
            out.append(f'<path d="M {lx:.1f} {ly:.1f} A {r:.1f} {r:.1f} 0 0 {sweep} {x1:.1f} {y1:.1f}" '
                       f'fill="none" stroke="{INK}" stroke-width="0.8" stroke-dasharray="3 3"/>')
    return f'<g><title>{escape(o["id"])} ({o["type"]})</title>{"".join(out)}</g>'


def render(layout, state=None):
    """Return an SVG string for one state of the layout (None = base layout)."""
    if state is None and layout.get("states"):
        state = layout["states"][0]
    view = cl.apply_state(layout, state)
    room = view["room"]
    W, D = room["width"], room["depth"]
    vw, vh = W * SCALE + 2 * MARGIN, D * SCALE + 2 * MARGIN + 30
    els = view.get("elements", [])
    floor = [e for e in els if e.get("z", 0) < cl.FLOOR_OBSTACLE_Z and e["type"] != "route"]
    raised = [e for e in els if e.get("z", 0) >= cl.FLOOR_OBSTACLE_Z]
    routes = [e for e in els if e["type"] == "route"]
    title = room.get("name", "Layout") + (f" — {state}" if state else "")
    x0, y0 = _xy(room, 0, D)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw:.0f} {vh:.0f}" '
        f'width="{vw:.0f}" height="{vh:.0f}" font-family="Helvetica, Arial, sans-serif">',
        '<defs><pattern id="route" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        '<line x1="0" y1="0" x2="0" y2="8" stroke="#3c8d5a" stroke-width="1.5" opacity="0.5"/></pattern></defs>',
        f'<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{MARGIN}" y="{MARGIN - 22}" font-size="15" font-weight="bold" fill="{INK}">{escape(title)}</text>',
        f'<text x="{MARGIN}" y="{MARGIN - 7}" font-size="10" fill="#666">'
        f'{W:g} × {D:g} m, ceiling {room.get("height", 0):g} m · dashed = raised (z ≥ 1 m)</text>',
        f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{W * SCALE:.1f}" height="{D * SCALE:.1f}" fill="#fbfaf7"/>',
    ]
    parts += [_element(room, e) for e in routes + floor + raised]
    parts.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{W * SCALE:.1f}" height="{D * SCALE:.1f}" '
                 f'fill="none" stroke="{INK}" stroke-width="6"/>')
    parts += [_opening(room, o) for o in room.get("openings", [])]
    # wall letters, north arrow, 1 m scale bar
    cx, cy = MARGIN + W * SCALE / 2, MARGIN + D * SCALE / 2
    for letter, (lx, ly) in {"N": (cx, MARGIN - 8 + 0), "S": (cx, MARGIN + D * SCALE + 18),
                             "W": (MARGIN - 18, cy), "E": (MARGIN + W * SCALE + 18, cy)}.items():
        if letter != "N":
            parts.append(f'<text x="{lx:.1f}" y="{ly:.1f}" font-size="11" text-anchor="middle" fill="#999">{letter}</text>')
    by = MARGIN + D * SCALE + 40
    parts.append(f'<line x1="{MARGIN}" y1="{by}" x2="{MARGIN + SCALE}" y2="{by}" stroke="{INK}" stroke-width="2"/>'
                 f'<text x="{MARGIN + SCALE + 6}" y="{by + 4}" font-size="10" fill="{INK}">1 m</text>')
    ax = MARGIN + W * SCALE - 10
    parts.append(f'<path d="M {ax} {by - 14} l 5 12 l -5 -3 l -5 3 z" fill="{INK}"/>'
                 f'<text x="{ax + 9}" y="{by}" font-size="10" fill="{INK}">N (wall)</text>')
    parts.append("</svg>")
    return "\n".join(parts)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not args or "-h" in sys.argv or "--help" in sys.argv:
        print(__doc__)
        sys.exit(0 if args or "-h" in sys.argv or "--help" in sys.argv else 2)
    state = None
    if "--state" in sys.argv:
        i = sys.argv.index("--state")
        state = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
        args = [a for a in args if a != state]
    try:
        layout = json.loads(Path(args[0]).read_text())
    except OSError as e:
        sys.exit(f"Can't open {args[0]}: {e.strerror}")
    except json.JSONDecodeError as e:
        sys.exit(f"{args[0]} is not valid JSON: {e.msg} (line {e.lineno}, column {e.colno})")
    print(render(layout, state))


if __name__ == "__main__":
    main()
