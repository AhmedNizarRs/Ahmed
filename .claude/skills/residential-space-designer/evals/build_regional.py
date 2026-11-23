#!/usr/bin/env python3
"""Write the layouts for regional scenarios 17-20 into evals/runs/.

Each file is one room the skill chose to detail for that scenario. The home
plans (room allocation, adjacency, site sketch) are in evals/results.md.
Door/window positions and setbacks the prompts didn't give are assumptions,
listed in each layout's notes.
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "runs")


def el(id, type, x, y, z, w, d, h, **kw):
    return dict(id=id, type=type, x=x, y=y, z=z, w=w, d=d, h=h, **kw)


def stop(stop, zone, camera, target, line):
    return dict(stop=stop, zone=zone, camera=camera, target=target, line=line)


def z(id, purpose, owner="shared"):
    return {"id": id, "purpose": purpose, "owner": owner}


def layout(name, rtype, w, d, h, walls, openings, occupants, zones, elements, services, reveal, notes):
    return {
        "version": "1",
        "room": {"name": name, "type": rtype, "width": w, "depth": d, "height": h, "walls": walls,
                 "openings": openings},
        "occupants": occupants, "zones": zones, "elements": elements,
        "services": services, "reveal_path": reveal, "notes": notes,
    }


S = {}

# 17a. Bengaluru Vastu house: dry kitchen in the SE corner + utility behind it.
S["17a-vastu-kitchen-utility"] = layout(
    "Dry kitchen + utility (SE corner)", "kitchen", 3.0, 4.2, 3.0, {},
    [{"id": "to_dining", "type": "door", "wall": "W", "offset": 3.2, "width": 0.9, "swing": "in"},
     {"id": "utility_out", "type": "door", "wall": "S", "offset": 2.0, "width": 0.8, "swing": "out"},
     {"id": "win_e", "type": "window", "wall": "E", "offset": 1.4, "width": 0.9, "sill": 1.0}],
    [{"id": "family", "role": "couple + parents + child"}],
    [z("utility", "storage"), z("prep", "cooking"), z("cook", "cooking"), z("cold", "storage")],
    [el("partition_w", "partition", 0, 1.2, 0, 0.1, 0.1, 3.0),
     el("utility_door", "door", 0.1, 1.2, 0, 0.8, 0.1, 2.1, label="Door to utility"),
     el("partition_e", "partition", 0.9, 1.2, 0, 2.1, 0.1, 3.0),
     el("washer", "washer", 0, 0, 0, 0.6, 0.6, 0.85, zone="utility", front="+y"),
     el("utility_sink", "other", 0.7, 0, 0, 0.6, 0.5, 0.75, zone="utility", label="Low vessel-washing sink"),
     el("drying_rack", "other", 1.4, 0.2, 2.3, 1.4, 0.6, 0.1, zone="utility", label="Ceiling drying rack"),
     el("fridge", "fridge", 0, 1.9, 0, 0.7, 0.7, 1.85, zone="cold", front="+x"),
     el("sink", "sink", 1.0, 1.3, 0, 0.8, 0.6, 0.9, zone="prep", front="+y", label="Sink, dishwasher beside"),
     el("counter_s", "counter", 1.8, 1.3, 0, 0.6, 0.6, 0.9, zone="prep", front="+y"),
     el("corner", "cabinet", 2.4, 1.3, 0, 0.6, 0.6, 0.9, zone="prep", label="Corner carousel (no blind corner)"),
     el("counter_e1", "counter", 2.4, 1.9, 0, 0.6, 0.5, 0.9, zone="prep", front="-x"),
     el("cooktop", "cooktop", 2.4, 2.4, 0, 0.6, 0.6, 0.9, zone="cook", front="-x",
        label="Hob on the east wall (cook faces east)"),
     el("counter_e2", "counter", 2.4, 3.0, 0, 0.6, 0.6, 0.9, zone="cook", front="-x",
        label="Deep drawers for pressure cookers and kadai"),
     el("pantry", "cabinet", 2.4, 3.6, 0, 0.6, 0.6, 2.4, zone="cold", label="Tall pantry, appliance garage"),
     el("chimney", "cabinet", 2.55, 2.4, 1.65, 0.45, 0.6, 0.6, label="Ducted chimney")],
    [{"type": "outlet", "wall": "E", "offset": 1.8, "height": 1.1},
     {"type": "outlet", "wall": "S", "offset": 0.3, "height": 1.0, "serves": "washer"}],
    [stop("door", "prep", [0.4, 3.9, 1.6], [2.2, 2.2, 1.0], "SE corner kitchen, as Vastu asks, with morning light from the east."),
     stop("cook", "cook", [1.2, 3.0, 1.6], [2.7, 2.7, 1.0], "The hob faces east; deep drawers hold the cookers and kadai."),
     stop("utility", "utility", [0.5, 2.2, 1.6], [1.0, 0.4, 0.8], "Behind a door: washing machine, a low tap for vessels and a ceiling drying rack."),
     stop("wide", "cold", [0.3, 4.0, 2.0], [2.0, 1.8, 0.9], "A tight triangle, with the fridge by the door so nobody crosses the cook.")],
    ["Assumed east road, 30×40 ft plot; the kitchen sits in the SE corner of the ground floor.",
     "Utility opens to the south side setback for drying and staff access without crossing the house.",
     "Gas line and chimney ducting by professionals."])

# 17b. Parents' bedroom: ground floor SW, next to the pooja room, no steps.
S["17b-parents-bedroom"] = layout(
    "Parents' bedroom (SW, ground floor)", "bedroom", 3.3, 3.6, 3.0, {},
    [{"id": "door", "type": "door", "wall": "E", "offset": 0.6, "width": 0.9, "swing": "in"},
     {"id": "bath", "type": "door", "wall": "N", "offset": 0.2, "width": 0.8, "swing": "out"},
     {"id": "win_w", "type": "window", "wall": "W", "offset": 1.0, "width": 1.5, "sill": 0.75, "egress": True}],
    [{"id": "grandfather", "age": 72, "role": "elder"}, {"id": "grandmother", "age": 68, "role": "elder"}],
    [z("sleep", "sleep", "grandfather"), z("dress", "dressing"), z("read", "leisure")],
    [el("bed", "bed", 0.9, 0, 0, 1.5, 2.05, 0.5, zone="sleep", label="Queen bed, head to the south, low 0.5 m height"),
     el("ns_left", "cabinet", 0.45, 0, 0, 0.45, 0.45, 0.55, zone="sleep", label="Nightstand with night light"),
     el("ns_right", "cabinet", 2.4, 0, 0, 0.45, 0.45, 0.55, zone="sleep"),
     el("wardrobe", "wardrobe", 1.1, 3.0, 0, 2.2, 0.6, 2.4, zone="dress", front="-y", clearance=0.6, doors="sliding",
        label="Sliding wardrobe, nothing above 1.8 m used daily"),
     el("chair", "seat", 0.1, 2.4, 0, 0.7, 0.6, 0.9, zone="read", label="Reading chair with arms")],
    [{"type": "outlet", "wall": "W", "offset": 0.3, "height": 0.6, "serves": "bed"},
     {"type": "outlet", "wall": "E", "offset": 0.3, "height": 0.6, "serves": "bed"}],
    [stop("door", "sleep", [3.0, 1.8, 1.6], [1.6, 1.0, 0.5], "Grandparents stay on the ground floor, a few steps from the pooja room."),
     stop("bed", "sleep", [2.8, 2.8, 1.5], [1.6, 0.8, 0.5], "A low bed they can reach from both sides, with night lights at each side."),
     stop("read", "read", [2.4, 1.5, 1.4], [0.4, 2.7, 0.7], "A reading chair by the west window for the afternoons.")],
    ["No level changes from the entrance to this room or its bath (elders).",
     "Attached bath: grab bars, anti-skid tiles, a seat in the shower, and an outward-opening door.",
     "Assumed attached bath to the north; pooja room adjoining to the NE of the hall."])

# 18. Pune 3BHK: parallel kitchen + utility balcony; maid reaches the utility via the kitchen only.
S["18-pune-flat-kitchen-utility"] = layout(
    "3BHK flat kitchen + utility balcony", "kitchen", 2.7, 4.4, 2.9, {},
    [{"id": "door", "type": "door", "wall": "S", "offset": 0.1, "width": 0.9, "swing": "in"},
     {"id": "utility_win", "type": "window", "wall": "N", "offset": 0.2, "width": 2.3, "sill": 1.0,
      "drop_outside": 20}],
    [{"id": "family", "role": "family"}, {"id": "maid", "role": "staff (twice daily)"}],
    [z("cold", "storage"), z("prep", "cooking"), z("cook", "cooking"), z("utility", "laundry")],
    [el("fridge", "fridge", 0, 0.95, 0, 0.7, 0.7, 1.85, zone="cold", front="+x"),
     el("counter_w", "counter", 0, 1.65, 0, 0.6, 0.75, 0.9, zone="prep", front="+x"),
     el("sink", "sink", 0, 2.4, 0, 0.6, 0.8, 0.9, zone="prep", front="+x", label="Sink next to the utility door"),
     el("counter_e1", "counter", 2.1, 0, 0, 0.6, 0.8, 0.9, zone="cook", front="-x"),
     el("cooktop", "cooktop", 2.1, 0.8, 0, 0.6, 0.6, 0.9, zone="cook", front="-x"),
     el("counter_e2", "counter", 2.1, 1.4, 0, 0.6, 1.0, 0.9, zone="cook", front="-x",
        label="Deep drawers: cookers, kadai, tawa"),
     el("pantry", "cabinet", 2.1, 2.4, 0, 0.6, 0.8, 2.2, zone="cook", label="Tall pantry"),
     el("lofts", "cabinet", 0, 0.95, 2.2, 0.6, 2.25, 0.7, label="Lofts for festival vessels and bulk storage"),
     el("partition_w", "partition", 0, 3.2, 0, 1.8, 0.1, 2.9),
     el("utility_door", "door", 1.8, 3.2, 0, 0.8, 0.1, 2.1, label="Sliding glass door to utility"),
     el("partition_e", "partition", 2.6, 3.2, 0, 0.1, 0.1, 2.9),
     el("washer", "washer", 0, 3.8, 0, 0.6, 0.6, 0.85, zone="utility", front="-y"),
     el("utility_sink", "other", 0.7, 3.9, 0, 0.6, 0.5, 0.6, zone="utility", label="Low tap and sink for vessel washing"),
     el("drying", "other", 1.4, 3.6, 2.3, 1.2, 0.6, 0.1, zone="utility", label="Ceiling drying rack")],
    [{"type": "outlet", "wall": "W", "offset": 2.0, "height": 1.1},
     {"type": "outlet", "wall": "E", "offset": 1.9, "height": 1.1},
     {"type": "outlet", "wall": "W", "offset": 4.1, "height": 1.0, "serves": "washer"}],
    [stop("door", "prep", [0.6, 0.2, 1.6], [1.4, 3.0, 1.0], "A parallel kitchen with a 1.4 m aisle, so two people can work."),
     stop("cook", "cook", [1.0, 1.5, 1.6], [2.4, 1.2, 1.0], "Deep drawers by the hob for daily Indian cooking."),
     stop("utility", "utility", [1.4, 2.8, 1.6], [0.8, 4.1, 0.8], "The utility balcony keeps washing and vessel cleaning out of the kitchen.")],
    ["Maid's route: main door → dining → kitchen → utility; never through bedrooms. If the flat has a service entry, use it.",
     "Pooja unit goes on the NE wall of the dining/living area, not in the kitchen (see the home plan in results.md).",
     "Check society rules before glazing or grilling the utility balcony."])

# 19. London Victorian terrace: rear kitchen-diner-family with sight lines to the kids.
S["19-london-terrace-kitchen-diner"] = layout(
    "Rear kitchen-diner-family room", "living_dining", 5.0, 6.5, 2.7,
    {"E": {"load_bearing": True}, "W": {"load_bearing": True}},
    [{"id": "hall", "type": "door", "wall": "S", "offset": 0.2, "width": 0.9, "swing": "in"},
     {"id": "garden", "type": "door", "wall": "N", "offset": 0.5, "width": 4.0, "swing": "sliding"}],
    [{"id": "parents", "role": "couple"}, {"id": "kids", "age": 5, "role": "two children"}],
    [z("cook", "cooking"), z("family", "leisure"), z("dining", "dining"), z("play", "play")],
    [el("tall", "cabinet", 4.4, 0, 0, 0.6, 0.6, 2.3, zone="cook", label="Tall larder"),
     el("fridge", "fridge", 4.3, 0.6, 0, 0.7, 0.7, 1.85, zone="cook", front="-x"),
     el("counter_e1", "counter", 4.4, 1.3, 0, 0.6, 1.1, 0.9, zone="cook", front="-x"),
     el("cooktop", "cooktop", 4.4, 2.4, 0, 0.6, 0.6, 0.9, zone="cook", front="-x"),
     el("counter_e2", "counter", 4.4, 3.0, 0, 0.6, 1.0, 0.9, zone="cook", front="-x"),
     el("island_s", "island", 2.3, 1.6, 0, 0.9, 0.6, 0.9, zone="cook", front="+x"),
     el("sink", "sink", 2.3, 2.2, 0, 0.9, 0.8, 0.9, zone="cook", front="+x",
        label="Island sink: the cook faces the family area and garden"),
     el("island_n", "island", 2.3, 3.0, 0, 0.9, 0.6, 0.9, zone="cook", front="+x"),
     el("sofa", "sofa", 0, 1.2, 0, 0.9, 2.2, 0.85, zone="family", front="+x"),
     el("coffee", "coffee_table", 1.3, 1.8, 0, 0.5, 1.0, 0.4, zone="family"),
     el("toys", "cabinet", 0, 3.6, 0, 0.45, 0.8, 0.9, zone="play", label="Low toy storage, kids can reach"),
     el("bench", "seat", 0, 4.6, 0, 0.45, 1.6, 0.45, zone="play", label="Boot bench by the garden door"),
     el("table", "table", 2.2, 4.8, 0, 1.6, 0.9, 0.75, zone="dining")],
    [{"type": "outlet", "wall": "E", "offset": 2.0, "height": 1.1},
     {"type": "outlet", "wall": "W", "offset": 1.0, "height": 0.3}],
    [stop("hall", "family", [0.6, 0.4, 1.6], [3.0, 5.0, 1.0], "The dark back rooms become one bright room facing the garden."),
     stop("sink", "cook", [4.0, 2.6, 1.6], [0.6, 2.4, 0.6], "From the island sink you can see the sofa, the toys and the garden."),
     stop("garden", "dining", [2.5, 3.8, 1.5], [2.5, 6.4, 1.2], "The table sits by the sliding doors; boots go on the bench."),
     stop("wide", "play", [4.6, 0.3, 2.1], [1.5, 4.5, 0.6], "The original hall and stairs stay; the stair cupboard becomes the pantry.")],
    ["Party walls (E, W) are load-bearing: no niches; any opening needs a structural engineer and a party wall agreement.",
     "Keep the original hall floor tiles, cornices and stair (respect original fabric).",
     "Drop zone for coats and shoes in the hall; under-stair cupboard as pantry or utility."])

# 20. Sloping site, family of five, hosting: the street-level hosting floor.
S["20-sloping-hosting-level"] = layout(
    "Hosting level (street side, upper)", "living_dining", 7.0, 9.0, 3.0, {},
    [{"id": "entry", "type": "door", "wall": "S", "offset": 0.3, "width": 1.0, "swing": "in"},
     {"id": "deck", "type": "door", "wall": "N", "offset": 1.0, "width": 5.0, "swing": "sliding"},
     {"id": "view", "type": "window", "wall": "W", "offset": 2.0, "width": 4.0, "sill": 0.9, "drop_outside": 3.5}],
    [{"id": "family", "role": "family of five"}],
    [z("entry", "entry"), z("living", "leisure"), z("dining", "dining"), z("kitchen", "cooking")],
    [el("stair", "stairs", 5.8, 0.5, 0, 1.0, 4.0, 1.0, rise=0.175, tread=0.28, headroom=2.4,
        label="Stair down to the family level, guarded opening"),
     el("fridge", "fridge", 6.3, 5.0, 0, 0.7, 0.7, 1.85, zone="kitchen", front="-x"),
     el("counter1", "counter", 6.4, 5.7, 0, 0.6, 0.9, 0.9, zone="kitchen", front="-x"),
     el("cooktop", "cooktop", 6.4, 6.6, 0, 0.6, 0.6, 0.9, zone="kitchen", front="-x"),
     el("counter2", "counter", 6.4, 7.2, 0, 0.6, 1.6, 0.9, zone="kitchen", front="-x"),
     el("island_s", "island", 4.4, 5.6, 0, 0.8, 0.8, 0.9, zone="kitchen", front="+x"),
     el("sink", "sink", 4.4, 6.4, 0, 0.8, 0.8, 0.9, zone="kitchen", front="+x"),
     el("island_n", "island", 4.4, 7.2, 0, 0.8, 0.8, 0.9, zone="kitchen", front="+x"),
     el("table", "table", 1.0, 6.2, 0, 2.5, 1.0, 0.75, zone="dining", label="Table for 10"),
     el("sofa", "sofa", 0.7, 1.8, 0, 0.9, 2.5, 0.85, zone="living", front="+x",
        label="Kept 0.7 m off the view window (3.5 m drop outside)"),
     el("coffee", "coffee_table", 2.0, 2.6, 0, 0.8, 1.0, 0.4, zone="living"),
     el("sofa2", "sofa", 3.2, 2.0, 0, 0.9, 2.0, 0.85, zone="living", front="-x")],
    [{"type": "outlet", "wall": "E", "offset": 6.2, "height": 1.1},
     {"type": "outlet", "wall": "W", "offset": 1.0, "height": 0.3}],
    [stop("entry", "entry", [0.8, 0.5, 1.6], [3.5, 6.0, 1.2], "Arrive at street level straight into the hosting floor."),
     stop("living", "living", [3.6, 1.0, 1.4], [0.5, 3.0, 0.8], "The sofas face each other with the valley view to the west."),
     stop("kitchen", "kitchen", [3.0, 6.8, 1.6], [6.4, 6.8, 1.0], "The island lets the cook host while guests sit around it."),
     stop("deck", "dining", [2.0, 5.0, 1.6], [3.5, 9.0, 1.2], "The table for ten opens onto the deck through sliding doors.")],
    ["Site falls about 3.5 m from east (street) to west; bedrooms are on the lower levels (see the home plan).",
     "Stair geometry follows IRC R311.7 values; check the local code."])

os.makedirs(OUT, exist_ok=True)
for name, data in S.items():
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
print("wrote", len(S), "layouts to", OUT)
