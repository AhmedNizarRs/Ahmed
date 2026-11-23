#!/usr/bin/env python3
"""Write the scenario layouts in evals/runs/ (one JSON per scenario).

Each layout is the skill's answer to the matching prompt in scenarios.md.
Door/window positions the prompt didn't give are assumptions, listed in notes.
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "runs")


def el(id, type, x, y, z, w, d, h, **kw):
    return dict(id=id, type=type, x=x, y=y, z=z, w=w, d=d, h=h, **kw)


def stop(stop, zone, camera, target, line):
    return dict(stop=stop, zone=zone, camera=camera, target=target, line=line)


def layout(name, w, d, h, walls, openings, occupants, zones, elements, services, reveal, notes):
    return {
        "version": "1",
        "room": {"name": name, "width": w, "depth": d, "height": h, "walls": walls, "openings": openings},
        "occupants": occupants, "zones": zones, "elements": elements,
        "services": services, "reveal_path": reveal, "notes": notes,
    }


def z(id, purpose, owner="shared"):
    return {"id": id, "purpose": purpose, "owner": owner}


S = {}

# 1. Boy, 10, 2.6 x 3.0 x 2.75. Needs desk; wardrobe door hits bed.  -> pattern A
S["01-study-loft"] = layout(
    "Study loft, boy 10", 2.6, 3.0, 2.75, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 1.7, "width": 0.8, "swing": "in"},
     {"id": "win", "type": "window", "wall": "N", "offset": 1.0, "width": 1.2, "sill": 0.9, "egress": True}],
    [{"id": "boy", "age": 10, "role": "child", "needs": ["study"]}],
    [z("entry", "entry"), z("sleep", "sleep", "boy"), z("study", "study", "boy"), z("dress", "dressing", "boy"), z("play", "leisure", "boy")],
    [el("loft", "bed", 0, 1.0, 1.55, 0.95, 2.0, 0.25, zone="sleep", owner="boy", guardrail=True, guardrail_height=0.18,
        material="steel_square_tube_galv"),
     el("steps", "steps", 0, 1.0, 0, 0.95, 0.5, 1.55, zone="sleep", front="+x", clearance=0.6, serves="loft",
        label="Storage stair cabinet"),
     el("desk", "desk", 0, 1.5, 0, 0.6, 1.5, 0.75, zone="study", owner="boy", front="+x", clearance=0.6,
        label="Desk + bookshelves under loft"),
     el("wardrobe", "wardrobe", 2.0, 1.0, 0, 0.6, 1.3, 2.4, zone="dress", owner="boy", front="-x", clearance=0.6,
        doors="sliding", label="Sliding-door wardrobe (fixes door clash)")],
    [{"type": "outlet", "wall": "W", "offset": 2.2, "height": 0.85, "serves": "desk"},
     {"type": "usb", "wall": "W", "offset": 1.3, "height": 2.0, "serves": "loft"}],
    [stop("entry", "entry", [2.2, 0.3, 1.6], [0.5, 2.2, 1.2], "The bed used to block the wardrobe. Now it's up in the air."),
     stop("desk", "study", [1.4, 1.6, 1.1], [0.3, 2.3, 0.8], "Underneath, a full desk with 1.55 m of clear height."),
     stop("steps", "sleep", [1.5, 0.9, 1.2], [0.4, 1.25, 0.8], "The steps are drawers on the way up."),
     stop("wardrobe", "dress", [0.9, 1.9, 1.4], [2.3, 1.9, 1.2], "Sliding doors, so the wardrobe always opens."),
     stop("wide", "play", [2.4, 0.2, 2.2], [1.0, 2.0, 0.8], "Floor in the middle is free to play.")],
    ["Assumed door on S wall, window on N wall.", "Headroom above loft mattress 0.95 m.",
     "Under-loft desk clearance 1.55 m is [std]."])

# 3. Kids 5, 8, 12 in 4.0 x 3.5 x 2.9.  -> pattern G; 5-year-old on a floor bed
S["03-three-kids"] = layout(
    "Three kids 5/8/12", 4.0, 3.5, 2.9, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 0.2, "width": 0.8, "swing": "in"},
     {"id": "win", "type": "window", "wall": "E", "offset": 0.5, "width": 1.2, "sill": 0.9, "egress": True}],
    [{"id": "k5", "age": 5}, {"id": "k8", "age": 8}, {"id": "k12", "age": 12}],
    [z("entry", "entry"), z("sleep12", "sleep", "k12"), z("study12", "study", "k12"), z("sleep8", "sleep", "k8"),
     z("sleep5", "sleep", "k5"), z("study", "study"), z("dress", "dressing"), z("play", "leisure")],
    [el("bed12", "bed", 0, 1.5, 1.6, 0.95, 2.0, 0.25, zone="sleep12", owner="k12", guardrail=True, guardrail_height=0.18,
        material="steel_square_tube_galv"),
     el("ladder12", "ladder", 0, 1.35, 0, 0.95, 0.15, 1.85, zone="sleep12", front="-y", clearance=0.6, serves="bed12"),
     el("desk12", "desk", 0, 1.5, 0, 0.6, 1.05, 0.75, zone="study12", owner="k12", front="+x", clearance=0.6),
     el("bed8", "bed", 1.4, 2.55, 1.6, 2.0, 0.95, 0.25, zone="sleep8", owner="k8", guardrail=True, guardrail_height=0.18,
        material="steel_square_tube_galv"),
     el("bed5", "bed", 1.4, 2.55, 0, 2.0, 0.95, 0.45, zone="sleep5", owner="k5", label="Floor bed + drawers"),
     el("steps8", "steps", 0.95, 2.55, 0, 0.45, 0.95, 1.6, zone="sleep8", front="-y", clearance=0.6, serves="bed8",
        label="Box stairs, drawers per child"),
     el("desk_row", "desk", 3.4, 0.7, 0, 0.6, 1.8, 0.75, zone="study", front="-x", clearance=0.6,
        label="Shared window desk row (k5 + k8)"),
     el("wardrobe", "wardrobe", 1.1, 0, 0, 2.2, 0.6, 2.6, zone="dress", front="+y", clearance=0.6, doors="sliding",
        label="3 equal sections")],
    [{"type": "outlet", "wall": "W", "offset": 2.0, "height": 0.85, "serves": "desk12"},
     {"type": "outlet", "wall": "N", "offset": 2.4, "height": 0.6, "serves": "bed5"},
     {"type": "usb", "wall": "N", "offset": 2.8, "height": 2.1, "serves": "bed8"},
     {"type": "outlet", "wall": "E", "offset": 1.6, "height": 0.85, "serves": "desk_row"}],
    [stop("entry", "entry", [0.6, 0.4, 1.6], [2.5, 2.8, 1.2], "Three kids, one room, and everyone gets a bed of their own."),
     stop("bed12", "sleep12", [1.6, 1.0, 1.9], [0.4, 2.5, 1.8], "The oldest sleeps up high with a private desk underneath."),
     stop("bunk", "sleep8", [2.4, 1.5, 1.3], [2.4, 3.0, 1.0], "The youngest stays on the floor bed, with the middle child above."),
     stop("desks", "study", [2.4, 1.6, 1.2], [3.7, 1.6, 0.8], "Daylight homework row at the window."),
     stop("wardrobe", "dress", [2.2, 1.6, 1.4], [2.2, 0.2, 1.3], "One wardrobe, three equal sections.")],
    ["Assumed door S, window E.", "k5 is on the floor bed: the upper bed needs age ≥ 6 [CPSC].",
     "Lower bed under bed8 has 1.15 m to sit up."])

# 4. Couple 3.0 x 3.2 x 2.6; vanity + WFH  -> pattern H
S["04-couple"] = layout(
    "Couple, vanity + WFH", 3.0, 3.2, 2.6, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 0.1, "width": 0.8, "swing": "in"},
     {"id": "win", "type": "window", "wall": "E", "offset": 1.0, "width": 1.2, "sill": 0.9, "egress": True}],
    [{"id": "a", "role": "partner", "needs": ["vanity"]}, {"id": "b", "role": "partner", "needs": ["wfh"]}],
    [z("entry", "entry"), z("sleep", "sleep"), z("work", "study", "b"), z("vanity", "study", "a"), z("dress", "dressing")],
    [el("platform", "platform", 0, 1.2, 0, 1.8, 2.0, 0.3, zone="sleep", front="-y", clearance=0.6,
        label="Platform, his/her step drawers"),
     el("bed", "bed", 0.1, 1.2, 0.3, 1.6, 2.0, 0.3, zone="sleep", label="Queen mattress on platform"),
     el("head_cab", "cabinet", 0, 2.9, 1.6, 1.8, 0.3, 0.6, zone="sleep", label="Headboard cabinet + reading lights"),
     el("desk", "desk", 2.55, 1.25, 0, 0.45, 1.8, 0.75, zone="work", front="-x", clearance=0.6,
        label="Split desk: WFH half + vanity half with mirror"),
     el("wardrobe", "wardrobe", 1.0, 0, 0, 1.9, 0.6, 2.4, zone="dress", front="+y", clearance=0.6, doors="sliding",
        label="Split his/her")],
    [{"type": "outlet", "wall": "W", "offset": 2.9, "height": 0.6, "serves": "bed"},
     {"type": "outlet", "wall": "N", "offset": 1.85, "height": 0.6, "serves": "bed"},
     {"type": "outlet", "wall": "E", "offset": 1.6, "height": 0.85, "serves": "desk"},
     {"type": "outlet", "wall": "E", "offset": 2.6, "height": 1.1, "serves": "desk"}],
    [stop("entry", "entry", [0.5, 0.3, 1.6], [1.5, 2.5, 0.8], "One small room, two jobs: a vanity and a home office."),
     stop("bed", "sleep", [2.2, 0.9, 1.4], [0.9, 2.2, 0.6], "The bed sits on drawers, his on one side, hers on the other."),
     stop("desk", "work", [1.5, 1.4, 1.2], [2.8, 2.1, 0.9], "One desk at the window: laptop at one end, mirror at the other."),
     stop("wardrobe", "dress", [1.9, 1.5, 1.4], [1.9, 0.2, 1.3], "Sliding wardrobe, split down the middle.")],
    ["Assumed door S, window E.", "Bedside access 0.6 m on the right side only; left partner gets in from the foot (trade-off).",
     "Headboard shelving instead of niches because wall structure is unknown."])

# 5. Teen girl, 2.8 x 2.9 x 2.4, gaming hideout. Loft over desk does NOT fit -> half-loft over den
S["05-low-ceiling-den"] = layout(
    "Teen den, 2.4 m ceiling", 2.8, 2.9, 2.4, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 2.0, "width": 0.8, "swing": "in"},
     {"id": "win", "type": "window", "wall": "N", "offset": 1.0, "width": 1.2, "sill": 0.9, "egress": True}],
    [{"id": "teen", "age": 15, "role": "teen", "needs": ["gaming", "privacy"]}],
    [z("entry", "entry"), z("sleep", "sleep", "teen"), z("den", "leisure", "teen"), z("study", "study", "teen"),
     z("dress", "dressing", "teen")],
    [el("bed", "bed", 0, 0.9, 1.0, 0.95, 2.0, 0.25, zone="sleep", owner="teen", guardrail=True, guardrail_height=0.18,
        material="steel_square_tube_galv"),
     el("den", "den", 0, 1.4, 0, 0.95, 1.5, 1.0, zone="den", owner="teen", label="Gaming den, curtain + LED"),
     el("steps", "steps", 0, 0.9, 0, 0.95, 0.5, 1.0, zone="sleep", front="+x", clearance=0.6, serves="bed"),
     el("desk", "desk", 1.6, 2.35, 0, 1.2, 0.55, 0.75, zone="study", owner="teen", front="-y", clearance=0.6),
     el("wardrobe", "wardrobe", 2.25, 0.9, 0, 0.55, 0.8, 2.3, zone="dress", owner="teen", front="-x", clearance=0.6,
        doors="sliding"),
     el("curtain", "curtain", 0.95, 1.4, 0, 0.02, 1.5, 1.0, zone="den")],
    [{"type": "outlet", "wall": "W", "offset": 2.0, "height": 0.4, "serves": "den"},
     {"type": "usb", "wall": "W", "offset": 1.5, "height": 1.3, "serves": "bed"},
     {"type": "outlet", "wall": "N", "offset": 2.3, "height": 0.85, "serves": "desk"}],
    [stop("entry", "entry", [2.2, 0.3, 1.5], [0.5, 2.0, 1.0], "A 2.4 m ceiling is too low for a full loft, so the bed sits halfway up."),
     stop("den", "den", [1.6, 1.6, 0.8], [0.4, 2.1, 0.5], "Behind the curtain, a gaming den with room to sit up."),
     stop("bed", "sleep", [1.6, 1.4, 1.6], [0.4, 1.9, 1.2], "Up top: 1.15 m of headroom and its own reading light."),
     stop("desk", "study", [2.0, 1.2, 1.2], [2.2, 2.7, 0.8], "The desk takes the window light.")],
    ["Assumed door S, window N.", "Rejected: loft over desk (needs ≈2.6 m ceiling; this room is 2.4 m).",
     "Den clear height 1.0 m: sitting only."])

# 6. Brother 14 + sister 11, 3.2 x 4.2 x 2.7 -> partition + door
S["06-siblings-partition"] = layout(
    "Brother 14 + sister 11", 3.2, 4.2, 2.7, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 2.3, "width": 0.8, "swing": "in"},
     {"id": "win_s", "type": "window", "wall": "W", "offset": 0.5, "width": 1.0, "sill": 0.9, "egress": True},
     {"id": "win_b", "type": "window", "wall": "N", "offset": 1.2, "width": 1.2, "sill": 0.9, "egress": True}],
    [{"id": "bro", "age": 14, "role": "teen"}, {"id": "sis", "age": 11, "role": "child"}],
    [z("entry", "entry"), z("sleep_s", "sleep", "sis"), z("study_s", "study", "sis"), z("dress_s", "dressing", "sis"),
     z("sleep_b", "sleep", "bro"), z("study_b", "study", "bro"), z("dress_b", "dressing", "bro")],
    [el("partition", "partition", 0, 2.05, 0, 2.3, 0.1, 2.7, label="Gypsum partition, frosted glass top band",
        material="gypsum_board"),
     el("slide_door", "door", 2.3, 2.06, 0, 0.9, 0.08, 2.1, label="Frosted sliding door to brother's room",
        material="glass_frosted"),
     el("bed_s", "bed", 0, 0, 0, 2.0, 0.9, 0.45, zone="sleep_s", owner="sis", label="Bed with drawers"),
     el("desk_s", "desk", 0, 1.0, 0, 0.55, 1.05, 0.75, zone="study_s", owner="sis", front="+x", clearance=0.6),
     el("wardrobe_s", "wardrobe", 1.2, 1.5, 0, 1.1, 0.55, 2.4, zone="dress_s", owner="sis", front="-y", clearance=0.6,
        doors="sliding"),
     el("loft_b", "bed", 0, 2.2, 1.55, 0.95, 2.0, 0.25, zone="sleep_b", owner="bro", guardrail=True,
        guardrail_height=0.18, material="steel_square_tube_galv"),
     el("steps_b", "steps", 0, 2.2, 0, 0.95, 0.5, 1.55, zone="sleep_b", front="+x", clearance=0.6, serves="loft_b"),
     el("desk_b", "desk", 0, 2.7, 0, 0.6, 1.5, 0.75, zone="study_b", owner="bro", front="+x", clearance=0.6),
     el("wardrobe_b", "wardrobe", 2.65, 3.1, 0, 0.55, 1.1, 2.4, zone="dress_b", owner="bro", front="-x", clearance=0.6,
        doors="sliding")],
    [{"type": "outlet", "wall": "W", "offset": 0.2, "height": 0.6, "serves": "bed_s"},
     {"type": "outlet", "wall": "W", "offset": 1.6, "height": 0.85, "serves": "desk_s"},
     {"type": "outlet", "wall": "W", "offset": 3.5, "height": 0.85, "serves": "desk_b"},
     {"type": "usb", "wall": "W", "offset": 3.0, "height": 2.0, "serves": "loft_b"}],
    [stop("entry", "entry", [2.7, 0.3, 1.6], [1.2, 2.1, 1.4], "A brother and sister who needed their own space now each have a room."),
     stop("sis", "sleep_s", [2.4, 1.2, 1.3], [0.8, 0.5, 0.5], "Her side: bed, window desk, sliding wardrobe."),
     stop("door", "entry", [2.7, 1.2, 1.5], [2.75, 2.1, 1.2], "A frosted sliding door lets light through but not looks."),
     stop("bro", "sleep_b", [2.0, 2.6, 1.6], [0.4, 3.3, 1.5], "His side: a loft over a desk, by the second window.")],
    ["Assumed the room has two windows (W and N) so each part keeps an escape window. With one window, the partition "
     "must not cut it off: use a glass-topped partition and confirm with local code.",
     "The brother passes through the sister's zone to his door; alternative is a central entry vestibule."])

# 10. Micro-room 2.0 x 2.0 x 2.6 -> fold-down wall bed (night state shown)
S["10-micro-unit"] = layout(
    "Micro-room 4 m²", 2.0, 2.0, 2.6, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 1.2, "width": 0.8, "swing": "sliding"},
     {"id": "win", "type": "window", "wall": "N", "offset": 0.6, "width": 0.8, "sill": 1.0, "egress": True}],
    [{"id": "adult", "role": "adult"}],
    [z("sleep", "sleep", "adult"), z("storage", "storage", "adult"), z("work", "study", "adult")],
    [el("bed_housing", "cabinet", 0, 0, 0, 0.45, 2.0, 2.2, zone="storage", label="Wall-bed housing + side storage"),
     el("bed", "bed", 0.45, 0.02, 0, 0.95, 1.96, 0.45, zone="sleep", owner="adult", label="Fold-down wall bed",
        states={"day": {"hidden": True}}),
     el("desk", "other", 1.95, 0.9, 0.4, 0.05, 0.8, 0.8, zone="work", label="Fold-down desk",
        states={"day": {"type": "desk", "x": 1.45, "z": 0, "w": 0.55, "h": 0.75, "front": "-x", "clearance": 0.6}}),
     el("shelf", "shelf", 1.7, 0.1, 1.8, 0.3, 1.8, 0.5, zone="storage", label="Overhead shelf")],
    [{"type": "outlet", "wall": "W", "offset": 1.0, "height": 0.6, "serves": "bed"},
     {"type": "outlet", "wall": "E", "offset": 1.3, "height": 0.85}],
    [stop("day", "work", [1.6, 0.3, 1.5], [0.5, 1.5, 1.0], "By day, a wall of cabinets and a desk."),
     stop("night", "sleep", [1.7, 0.2, 1.6], [0.8, 1.2, 0.4], "At night the bed folds down full length."),
     stop("storage", "storage", [1.5, 1.0, 1.4], [0.2, 1.0, 1.2], "Every wall is storage, top to bottom.")],
    ["States: night = bed down, desk folded; day = bed folded into its housing, desk open.",
     "Sliding door: an inward swing would hit the deployed bed.",
     "Rejected: cantilever/extension beyond the facade (needs an engineer and permits).",
     "Inner length 2.0 m only just fits a 1.9 m mattress; confirm the exact measurement."])

S["10-micro-unit"]["states"] = ["night", "day"]

os.makedirs(OUT, exist_ok=True)
for name, data in S.items():
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
print("wrote", len(S), "layouts to", OUT)
