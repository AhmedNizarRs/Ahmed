#!/usr/bin/env python3
"""MCP server for the Residential Space Designer (stdio, standard library only).

Run:  python3 mcp_server.py

Tools:
  validate_layout   check a layout against the safety and design rules (structured result)
  room_metrics      free floor, storage, sleeping places, seats, worktop, daylight (structured)
  edit_layout       move, resize, rotate, add, remove or change elements, then re-check (structured)
  compare_layouts   rank 2-6 layout options by errors, warnings, free floor and storage (structured)
  floor_plan_png    a PNG picture of the plan, so the model can see it, with a numbered legend
  floor_plan_svg    an architectural SVG floor plan (or plain boxes) with door swings and dimensions
  layout_to_gltf    a 3D model (glTF 2.0) with furniture shaped by type
  get_layout_schema the JSON Schema a layout must follow
  list_references   the skill's reference files and example layouts
  read_reference    read one of those files

Resources: every reference, template and example as rsd://skill/<path>, plus a
template for completing paths. Prompts: design_room and review_layout, which
clients like Claude Code show as slash commands. Completions for prompt
arguments and resource paths.

Protocol: dual-era. Legacy clients (2025-11-25 and earlier) open with
initialize; modern clients (2026-07-28) send per-request _meta and may probe
with server/discover. JSON-RPC 2.0 over stdin/stdout, one message per line.
Logs go to stderr only.
"""
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(HERE))
import check_layout as cl  # noqa: E402
import floor_plan_svg as svg  # noqa: E402
import layout_to_gltf as gl  # noqa: E402
import layout_tools as lt  # noqa: E402
import plan_drawing  # noqa: E402
import plan_png  # noqa: E402

VERSION = "1.3.0"  # kept equal to .claude-plugin/plugin.json by the tests
MODERN = ["2026-07-28"]
LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
META_VERSION = "io.modelcontextprotocol/protocolVersion"
READABLE_DIRS = ("references", "templates", "examples")
READABLE_SUFFIXES = (".md", ".json")
URI_PREFIX = "rsd://skill/"
CACHE = {"ttlMs": 3600000, "cacheScope": "public"}   # the files and lists only change with a new version

ICON = ("data:image/svg+xml;base64," + base64.b64encode(
    b"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#b4532a'/>"
    b"<path d='M7 25V13l9-6 9 6v12h-6v-7h-6v7z' fill='#fff'/></svg>").decode())
SERVER_INFO = {
    "name": "residential-space-designer", "version": VERSION, "title": "Residential Space Designer",
    "description": "Design, check, measure, draw and model every room of a home, Indian and Western.",
    "websiteUrl": "https://puvankumarv.github.io/residential-space-designer/",
    "icons": [{"src": ICON, "mimeType": "image/svg+xml", "sizes": ["any"]}],
}
CAPABILITIES = {
    "tools": {"listChanged": False},
    "resources": {"subscribe": False, "listChanged": False},
    "prompts": {"listChanged": False},
    "completions": {},
}
INSTRUCTIONS = (
    "Tools for designing homes room by room. Get the layout format from get_layout_schema, write the layout, "
    "run validate_layout until it has no errors, fix things with edit_layout (it re-checks for you), look at "
    "the result with floor_plan_png, measure it with room_metrics, and weigh options with compare_layouts. "
    "Then hand over floor_plan_svg or a 3D model from layout_to_gltf. Design guidance is in the references "
    "(resources rsd://skill/..., or list_references / read_reference)."
)

LAYOUT_ARG = {
    "description": "The layout, as a JSON object (or a string holding JSON) that follows get_layout_schema.",
    "type": ["object", "string"],
}
STATE_ARG = {"type": "string", "description": "Which state to use, e.g. \"day\" or \"night\". Defaults to the first state."}
READ_ONLY = {"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False}
STRINGS = {"type": "array", "items": {"type": "string"}}
CHECK_SCHEMA = {
    "type": "object",
    "properties": {"errors": STRINGS, "warnings": STRINGS, "ok": {"type": "boolean"},
                   "plans": {"type": "object", "description": "ASCII plans per state, when plan is true."}},
    "required": ["errors", "warnings", "ok"],
}
METRICS_SCHEMA = {
    "type": "object",
    "properties": {
        "state": {"type": ["string", "null"]},
        "room": {"type": "object"},
        "floor_area_m2": {"type": "number"}, "free_floor_m2": {"type": "number"},
        "free_floor_pct": {"type": "number", "description": "Floor not covered by anything starting below 1 m."},
        "volume_m3": {"type": "number"}, "elements": {"type": "integer"},
        "sleeping_places": {"type": "integer"}, "seats": {"type": "integer"},
        "storage_volume_m3": {"type": "number"}, "hanging_rail_m": {"type": "number"},
        "worktop_run_m": {"type": "number"}, "doors": {"type": "integer"}, "windows": {"type": "integer"},
        "glazing_m2": {"type": "number"}, "glazing_ratio": {"type": "number"},
        "meets_irc_glazing_8pct": {"type": "boolean", "description": "IRC R303.1: glazing at least 8% of floor area."},
        "elements_per_zone": {"type": "object"},
        "check": {"type": "object"},
    },
    "required": ["floor_area_m2", "free_floor_pct", "storage_volume_m3", "sleeping_places", "glazing_ratio", "check"],
}

TOOLS = [
    {
        "name": "validate_layout",
        "title": "Validate a room layout",
        "description": (
            "Check a room layout against code minimums and design standards: collisions, door swings, "
            "clearances, raised-bed safety, escape windows, kitchen aisles and work triangle, bathroom "
            "fixture clearances, stairs, window falls, and each day/night state. Returns errors (must fix), "
            "warnings (should review) and ok. Set plan to true to also get ASCII top views."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "layout": LAYOUT_ARG,
                "plan": {"type": "boolean", "description": "Also return ASCII floor and upper-level plans.", "default": False},
            },
            "required": ["layout"],
        },
        "outputSchema": CHECK_SCHEMA,
        "annotations": READ_ONLY,
    },
    {
        "name": "room_metrics",
        "title": "Measure a layout",
        "description": (
            "Measure how well a layout uses its room: floor area, free floor (m² and %), storage volume, "
            "wardrobe hanging rail, sleeping places, seats, worktop run, doors, windows, glazing ratio "
            "against the IRC 8% rule, elements per zone, and the error/warning counts."
        ),
        "inputSchema": {"type": "object", "properties": {"layout": LAYOUT_ARG, "state": STATE_ARG}, "required": ["layout"]},
        "outputSchema": METRICS_SCHEMA,
        "annotations": READ_ONLY,
    },
    {
        "name": "edit_layout",
        "title": "Edit a layout and re-check it",
        "description": (
            "Apply edits to a layout and return the new layout with its check result, so a fix and its "
            "validation take one call. Operations run in order: "
            "{op:'move', id, x?, y?, z?, dx?, dy?, dz?}, {op:'resize', id, w?, d?, h?}, "
            "{op:'rotate', id} (quarter turn about its centre; front turns too), "
            "{op:'add', element:{id, type, x, y, z, w, d, h, ...}}, {op:'remove', id}, "
            "{op:'set', id, fields:{...}} (null removes a field), {op:'set_room', fields:{...}}. "
            "The input layout is not changed; save the returned one."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "layout": LAYOUT_ARG,
                "operations": {"type": "array", "minItems": 1, "items": {
                    "type": "object", "required": ["op"],
                    "properties": {"op": {"type": "string", "enum": ["move", "resize", "rotate", "add", "remove", "set", "set_room"]}}}},
            },
            "required": ["layout", "operations"],
        },
        "outputSchema": {
            "type": "object",
            "properties": {"layout": {"type": "object"}, "changes": STRINGS, "check": CHECK_SCHEMA},
            "required": ["layout", "changes", "check"],
        },
        "annotations": READ_ONLY,
    },
    {
        "name": "compare_layouts",
        "title": "Compare layout options",
        "description": (
            "Compare 2 to 6 layout options for the same room: errors, warnings, free floor, storage, sleeping "
            "places, seats, worktop and glazing for each, ranked by errors, then warnings, then free floor, "
            "then storage, with a one-line summary."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"options": {"type": "array", "minItems": 2, "maxItems": 6, "items": {
                "type": "object", "required": ["layout"],
                "properties": {"name": {"type": "string"}, "layout": LAYOUT_ARG, "state": STATE_ARG}}}},
            "required": ["options"],
        },
        "outputSchema": {
            "type": "object",
            "properties": {"options": {"type": "array", "items": {"type": "object"}}, "ranking": STRINGS, "summary": {"type": "string"}},
            "required": ["options", "ranking", "summary"],
        },
        "annotations": READ_ONLY,
    },
    {
        "name": "floor_plan_png",
        "title": "Look at the floor plan",
        "description": (
            "Draw the layout as a PNG image you can look at: north up, walls, doors with swings, windows, "
            "floor items filled by type and raised items (loft beds, wall cabinets) hatched. Each element "
            "has a number; the legend comes back as text. Use it to see overlaps and flow at a glance."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"layout": LAYOUT_ARG, "state": STATE_ARG,
                           "scale": {"type": "number", "minimum": 20, "maximum": 150, "default": 60, "description": "Pixels per metre."}},
            "required": ["layout"],
        },
        "annotations": READ_ONLY,
    },
    {
        "name": "floor_plan_svg",
        "title": "Draw a floor plan",
        "description": (
            "Draw a room layout as an SVG floor plan, north up, 1 m = 100 px. The default 'architectural' style "
            "draws it like an architect: hatched walls, door leaves and swings, glazed windows, furniture as "
            "symbols (beds with pillows, sofas with arms, hob rings, sink and toilet bowls, stair treads), "
            "raised items such as loft beds dashed as overhead, dimension lines, a north arrow and a scale bar; "
            "each item has a hover title with its size. 'plain' draws filled, labelled boxes. Returns the SVG "
            "markup. For layouts with states (day/night), pass state; the first state is the default."
        ),
        "inputSchema": {"type": "object", "properties": {
            "layout": LAYOUT_ARG, "state": STATE_ARG,
            "style": {"type": "string", "enum": ["architectural", "plain"], "default": "architectural",
                      "description": "Drawing style."}}, "required": ["layout"]},
        "annotations": READ_ONLY,
    },
    {
        "name": "layout_to_gltf",
        "title": "Build a 3D model",
        "description": (
            "Turn a room layout into a 3D model: glTF 2.0 JSON with the data embedded, so it can be saved "
            "as a .gltf file and opened in Blender, a web glTF viewer or an OS 3D viewer. Walls are cut "
            "around doors and windows, every element is shaped by type at its real size (beds, sofas, "
            "cabinets with doors, counters with worktops, appliances, sanitaryware) in wood, fabric, metal, "
            "ceramic or stone, and an 'entry' node marks where to stand inside the door. No ceiling, so it "
            "can be viewed from above. scripts/blender_walkthrough.py renders a still or walkthrough video from it."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "layout": LAYOUT_ARG, "state": STATE_ARG,
                "boxes": {"type": "boolean", "description": "Draw each element as one plain coloured box instead of a shaped model."},
            },
            "required": ["layout"],
        },
        "annotations": READ_ONLY,
    },
    {
        "name": "get_layout_schema",
        "title": "Get the layout schema",
        "description": "Return the JSON Schema for layouts: units (metres), axes, room types, element types and fields.",
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": READ_ONLY,
    },
    {
        "name": "list_references",
        "title": "List design references",
        "description": (
            "List the skill's design references (room modules, Indian and Western regional modules, "
            "dimensions, safety, storage, services, materials, sources), templates and example layouts."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": READ_ONLY,
    },
    {
        "name": "read_reference",
        "title": "Read a design reference",
        "description": "Read one file listed by list_references, e.g. \"references/rooms/kitchen.md\" or \"examples/studio-apartment.json\".",
        "inputSchema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "Path relative to the skill folder, as list_references gives it."}},
            "required": ["path"],
        },
        "annotations": READ_ONLY,
    },
]

ROOM_TYPES = json.loads((SKILL / "templates" / "layout.schema.json").read_text())["properties"]["room"]["properties"]["type"]["enum"]
REGIONS = ["indian", "western"]
ROOM_MODULE = {  # room type → the room module to embed in the design_room prompt
    "kitchen": "kitchen.md", "bathroom": "bathroom.md", "living": "living-dining.md", "dining": "living-dining.md",
    "living_dining": "living-dining.md", "entry": "entry-circulation.md", "corridor": "entry-circulation.md",
    "stairs": "entry-circulation.md", "office": "home-office.md", "balcony": "balcony-laundry.md",
    "laundry": "balcony-laundry.md", "utility": "balcony-laundry.md", "verandah": "exterior.md",
    "courtyard": "exterior.md", "terrace": "exterior.md", "exterior": "exterior.md", "studio": "whole-home.md",
}

PROMPTS = [
    {
        "name": "design_room",
        "title": "Design a room",
        "description": "Design one room from a short brief, check it against the rules, and draw it.",
        "arguments": [
            {"name": "room_type", "description": f"One of: {', '.join(ROOM_TYPES)}", "required": True},
            {"name": "size", "description": "Inner size, e.g. \"3.4 x 3.4 m, 2.7 m high\", and where the door and windows are.", "required": True},
            {"name": "occupants", "description": "Who uses it: ages, how many, any needs.", "required": False},
            {"name": "region", "description": "indian or western (sets the regional module).", "required": False},
            {"name": "brief", "description": "Anything else: budget, style, must-haves.", "required": False},
        ],
        "icons": [{"src": ICON, "mimeType": "image/svg+xml", "sizes": ["any"]}],
    },
    {
        "name": "review_layout",
        "title": "Review a layout",
        "description": "Check, measure and look at an existing layout, then propose and apply fixes.",
        "arguments": [{"name": "layout", "description": "The layout JSON.", "required": True}],
        "icons": [{"src": ICON, "mimeType": "image/svg+xml", "sizes": ["any"]}],
    },
]


class ToolError(Exception):
    """A problem with the tool's input, reported back to the model as isError."""


class RpcError(Exception):
    def __init__(self, code, message, data=None):
        super().__init__(message)
        self.code, self.data = code, data


# ---------------------------------------------------------------- helpers

def _layout(value, what="layout"):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as e:
            raise ToolError(f"{what} is not valid JSON: {e.msg} (line {e.lineno}, column {e.colno})")
    if not isinstance(value, dict):
        raise ToolError(f"{what} must be a JSON object")
    room = value.get("room")
    if not isinstance(room, dict) or not all(isinstance(room.get(k), (int, float)) and not isinstance(room.get(k), bool)
                                             for k in ("width", "depth")):
        raise ToolError(f"{what}.room needs numeric width and depth")
    if not isinstance(value.get("elements", []), list):
        raise ToolError(f"{what}.elements must be a list")
    value.setdefault("elements", [])
    return value


def _state(layout, state):
    if state is not None and state not in (layout.get("states") or []):
        raise ToolError(f"unknown state {state!r}; this layout has {layout.get('states') or 'no states'}")
    return state


def _guard(fn, *a, **k):
    """Turn malformed-field crashes inside the layout code into a tool error the model can act on."""
    try:
        return fn(*a, **k)
    except lt.EditError as e:
        raise ToolError(str(e))
    except (KeyError, TypeError, ValueError, AttributeError) as e:
        raise ToolError(f"layout has a missing or malformed field ({type(e).__name__}: {e}); see get_layout_schema")


def _readable():
    files = []
    for d in READABLE_DIRS:
        files += [p for p in sorted((SKILL / d).rglob("*")) if p.is_file() and p.suffix in READABLE_SUFFIXES]
    return files


def _rel(p):
    return p.relative_to(SKILL).as_posix()


def _read_rel(rel):
    rel = str(rel or "").strip().lstrip("/")
    target = (SKILL / rel).resolve()
    if target not in {p.resolve() for p in _readable()}:
        return None
    return target


def _mime(p):
    return "application/json" if p.suffix == ".json" else "text/markdown"


def _title(p):
    if p.suffix == ".md":
        for line in p.read_text().splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    return p.stem.replace("-", " ").replace("_", " ").capitalize()


def structured(data):
    """A tool result with structuredContent and the same JSON as text for older clients."""
    return {"content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False, indent=2)}], "structuredContent": data}


def text(t):
    return {"content": [{"type": "text", "text": t}]}


# ---------------------------------------------------------------- tools

def validate_layout(args):
    layout = _layout(args.get("layout"))
    return structured(_guard(cl.result, layout, args.get("plan") is True))


def room_metrics(args):
    layout = _layout(args.get("layout"))
    return structured(_guard(lt.metrics, layout, _state(layout, args.get("state"))))


def edit_layout(args):
    layout = _layout(args.get("layout"))
    new, changes = _guard(lt.edit, layout, args.get("operations"))
    _layout(new, "edited layout")
    return structured({"layout": new, "changes": changes, "check": _guard(cl.result, new)})


def compare_layouts(args):
    opts = args.get("options")
    if not isinstance(opts, list) or not 2 <= len(opts) <= 6:
        raise ToolError("options must be a list of 2 to 6 {name, layout} objects")
    clean = []
    for k, o in enumerate(opts, 1):
        if not isinstance(o, dict):
            raise ToolError(f"option {k} must be an object with a layout")
        layout = _layout(o.get("layout"), f"option {k} layout")
        clean.append({"name": o.get("name"), "layout": layout, "state": _state(layout, o.get("state"))})
    return structured(_guard(lt.compare, clean))


def floor_plan_png(args):
    layout = _layout(args.get("layout"))
    state = _state(layout, args.get("state"))
    scale = args.get("scale", 60)
    if isinstance(scale, bool) or not isinstance(scale, (int, float)) or not 20 <= scale <= 150:
        raise ToolError("scale must be a number from 20 to 150 (pixels per metre)")
    png = _guard(plan_png.render, layout, state, scale)
    rows = _guard(plan_png.legend, layout, state)
    legend = "\n".join(f"{n}. {label} ({typ}{', raised' if up else ''})" for n, _, label, typ, up in rows)
    return {"content": [
        {"type": "image", "data": base64.b64encode(png).decode(), "mimeType": "image/png"},
        {"type": "text", "text": f"Floor plan of {layout['room'].get('name', 'the room')}"
                                 f"{f' ({state})' if state else ''}, north up. Hatched = raised.\n{legend}"},
    ]}


def floor_plan_svg(args):
    layout = _layout(args.get("layout"))
    state = _state(layout, args.get("state"))
    style = args.get("style", "architectural")
    if style not in ("architectural", "plain"):
        raise ToolError("style must be 'architectural' or 'plain'")
    return text(_guard(svg.render if style == "plain" else plan_drawing.render, layout, state))


def layout_to_gltf(args):
    layout = _layout(args.get("layout"))
    state = _state(layout, args.get("state"))
    return text(_guard(lambda: gl.to_gltf_text(*gl.build(layout, state, boxes=args.get("boxes") is True))))


def get_layout_schema(args):
    return text((SKILL / "templates" / "layout.schema.json").read_text())


def list_references(args):
    lines = [_rel(p) for p in _readable()]
    return text("Files you can pass to read_reference (also resources at rsd://skill/<path>):\n" + "\n".join(lines))


def read_reference(args):
    target = _read_rel(args.get("path"))
    if target is None:
        raise ToolError(f"{args.get('path')!r} is not a readable reference; call list_references for the list")
    return text(target.read_text())


HANDLERS = {
    "validate_layout": validate_layout,
    "room_metrics": room_metrics,
    "edit_layout": edit_layout,
    "compare_layouts": compare_layouts,
    "floor_plan_png": floor_plan_png,
    "floor_plan_svg": floor_plan_svg,
    "layout_to_gltf": layout_to_gltf,
    "get_layout_schema": get_layout_schema,
    "list_references": list_references,
    "read_reference": read_reference,
}


# ---------------------------------------------------------------- resources, prompts, completions

def resources_list(params, modern):
    return {"resources": [{"uri": URI_PREFIX + _rel(p), "name": _rel(p), "title": _title(p),
                           "mimeType": _mime(p), "size": p.stat().st_size} for p in _readable()]}


def resource_templates(params, modern):
    return {"resourceTemplates": [{
        "uriTemplate": URI_PREFIX + "{path}", "name": "skill-file", "title": "Skill reference, template or example",
        "description": "Any file under references/, templates/ or examples/, e.g. rsd://skill/references/rooms/kitchen.md",
    }]}


def resources_read(params, modern):
    uri = str(params.get("uri", ""))
    target = _read_rel(uri[len(URI_PREFIX):]) if uri.startswith(URI_PREFIX) else None
    if target is None:
        # 2026-07-28 moved "resource not found" to -32602; earlier revisions use -32002
        raise RpcError(-32602 if modern else -32002, "Resource not found", {"uri": uri})
    return {"contents": [{"uri": uri, "mimeType": _mime(target), "text": target.read_text()}]}


def _embedded(rel):
    p = SKILL / rel
    return {"role": "user", "content": {"type": "resource", "resource": {
        "uri": URI_PREFIX + rel, "mimeType": _mime(p), "text": p.read_text()}}}


def prompts_get(params, modern):
    name, args = params.get("name"), params.get("arguments") or {}
    if name == "design_room":
        rt = str(args.get("room_type", "")).strip()
        size = str(args.get("size", "")).strip()
        if not rt or not size:
            raise RpcError(-32602, "design_room needs room_type and size")
        region = str(args.get("region", "")).strip().lower()
        lines = [f"Design a {rt.replace('_', ' ')} for this brief.", f"Size and openings: {size}."]
        if args.get("occupants"):
            lines.append(f"Occupants: {args['occupants']}.")
        if args.get("brief"):
            lines.append(f"Brief: {args['brief']}.")
        lines += [
            "",
            "Work like this:",
            "1. Read the room module and safety notes attached here; ask me only for what is missing and essential.",
            "2. Write a layout JSON that follows get_layout_schema (metres, origin at the south-west inner corner).",
            "3. Run validate_layout. Fix every error with edit_layout, and review each warning.",
            "4. Look at it with floor_plan_png and check flow, door swings and what you see from the door.",
            "5. Report room_metrics (free floor, storage, sleeping places, daylight).",
            "6. If there are two good ideas, build both and use compare_layouts.",
            "7. Finish with the layout JSON, a short design note, and offer floor_plan_svg or layout_to_gltf.",
        ]
        msgs = [{"role": "user", "content": {"type": "text", "text": "\n".join(lines)}}]
        module = ROOM_MODULE.get(rt)
        if rt in ("bedroom", "kids_bedroom"):
            for f in ("patterns.md", "sleep-strategies.md") if rt == "kids_bedroom" else ("patterns.md",):
                if (SKILL / "references" / "rooms" / "bedroom" / f).exists():
                    msgs.append(_embedded(f"references/rooms/bedroom/{f}"))
        if module and (SKILL / "references" / "rooms" / module).exists():
            msgs.append(_embedded(f"references/rooms/{module}"))
        if region in REGIONS:
            msgs.append(_embedded(f"references/regional/{'india' if region == 'indian' else 'western'}.md"))
        msgs.append(_embedded("references/safety.md"))
        return {"description": f"Design a {rt}", "messages": msgs}
    if name == "review_layout":
        layout = args.get("layout")
        if not layout:
            raise RpcError(-32602, "review_layout needs layout")
        return {"description": "Review a layout", "messages": [{"role": "user", "content": {"type": "text", "text": (
            "Review this room layout. Run validate_layout and room_metrics, look at it with floor_plan_png, "
            "then list the problems in order of importance (safety first). Propose concrete fixes, apply them "
            "with edit_layout until validate_layout has no errors, and show the before and after metrics.\n\n"
            f"```json\n{layout}\n```")}}]}
    raise RpcError(-32602, f"Unknown prompt: {name}")


def complete(params, modern):
    ref, arg = params.get("ref") or {}, params.get("argument") or {}
    value = str(arg.get("value", "")).lower()
    options = []
    if ref.get("type") == "ref/prompt" and ref.get("name") == "design_room":
        options = {"room_type": ROOM_TYPES, "region": REGIONS}.get(arg.get("name"), [])
    elif ref.get("type") == "ref/resource" and ref.get("uri") == URI_PREFIX + "{path}" and arg.get("name") == "path":
        options = [_rel(p) for p in _readable()]
    hits = [o for o in options if value in o.lower()]
    hits.sort(key=lambda o: (not o.lower().startswith(value), o))
    return {"completion": {"values": hits[:100], "total": len(hits), "hasMore": len(hits) > 100}}


# ---------------------------------------------------------------- dispatch

def _call_tool(params, modern):
    name = params.get("name")
    if name not in HANDLERS:
        raise RpcError(-32602, f"Unknown tool: {name}")
    args = params.get("arguments") or {}
    if not isinstance(args, dict):
        return {**text("arguments must be an object"), "isError": True}
    try:
        return {**HANDLERS[name](args), "isError": False}
    except ToolError as e:
        # input problems are tool execution errors, so the model can read them and correct itself
        return {**text(str(e)), "isError": True}


METHODS = {
    "tools/list": lambda p, m: {"tools": TOOLS},
    "tools/call": _call_tool,
    "resources/list": resources_list,
    "resources/templates/list": resource_templates,
    "resources/read": resources_read,
    "prompts/list": lambda p, m: {"prompts": PROMPTS},
    "prompts/get": prompts_get,
    "completion/complete": complete,
}
CACHEABLE = {"tools/list", "prompts/list", "resources/list", "resources/read", "resources/templates/list"}


def handle(msg):
    """Return the response dict for one JSON-RPC message, or None for notifications."""
    method, mid = msg.get("method"), msg.get("id")
    params = msg.get("params") if isinstance(msg.get("params"), dict) else {}
    if mid is None:  # notification (e.g. notifications/initialized): no reply
        return None
    meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
    asked = meta.get(META_VERSION)
    modern = asked is not None

    def ok(result):
        if modern:  # 2026-07-28: every result says it is complete and who answered; lists can be cached
            result = {**result, "resultType": "complete",
                      "_meta": {**result.get("_meta", {}), "io.modelcontextprotocol/serverInfo": SERVER_INFO}}
            if method in CACHEABLE:
                result.update(CACHE)
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    def err(code, message, data=None):
        e = {"code": code, "message": message}
        if data is not None:
            e["data"] = data
        return {"jsonrpc": "2.0", "id": mid, "error": e}

    if modern and asked not in MODERN + LEGACY:
        return err(-32022, "Unsupported protocol version", {"supported": MODERN + LEGACY, "requested": asked})
    if method == "server/discover":
        return ok({"supportedVersions": MODERN + LEGACY, "capabilities": CAPABILITIES,
                   "_meta": {"io.modelcontextprotocol/serverInfo": SERVER_INFO},
                   "instructions": INSTRUCTIONS, **CACHE})
    if method == "initialize":
        version = params.get("protocolVersion")
        return ok({
            "protocolVersion": version if version in LEGACY else LEGACY[0],
            "capabilities": CAPABILITIES,
            "serverInfo": SERVER_INFO,
            "instructions": INSTRUCTIONS,
        })
    if method == "ping":
        return ok({})
    if method in METHODS:
        try:
            return ok(METHODS[method](params, modern))
        except RpcError as e:
            return err(e.code, str(e), e.data)
    return err(-32601, f"Method not found: {method}")


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}
        else:
            try:
                reply = handle(msg) if isinstance(msg, dict) else {
                    "jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid request"}}
            except Exception as e:  # keep the server alive; report the failure to the client
                print(f"internal error: {e!r}", file=sys.stderr)
                reply = {"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32603, "message": "Internal error"}}
        if reply is not None:
            sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
