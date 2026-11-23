---
name: architect-workflow
description: Design a floor plan or interior layout with logic instead of guessing, and draw it as a real DXF/PDF plan. Runs a fixed sequence (brief, room programme, adjacency and circulation, accessibility, drawing, independent check, code pass, handover). Use when the user asks for a plan, floor plan, layout, AutoCAD/DXF drawing, space planning, fit-out, villa, apartment, clinic, office, shop or "design this space", or wants an existing plan checked.
---

# Architect workflow

Every plan goes through the same eight steps, in order. Do not jump to drawing. The point of this skill is that each decision has a reason and each number has a source.

## Hard rules

- **No invented numbers.** Dimensions and code values come from the skills below or from the user. If a value is missing, write `[TO CONFIRM]` and say who confirms it. The numeric rules this workflow uses are in `templates/rules.uae.json`, with their sources.
- **Draft, never construction-ready.** Every drawing is labelled `DRAFT FOR REVIEW, NOT FOR CONSTRUCTION`. A licensed architect signs, and Sharjah Municipality / Civil Defence (or the plot's authority) approves. Claude drafts and checks.
- **Measured, not typed.** Room areas come from the drawn walls (`arch_rooms_detect`), never from what was intended.
- **Look at it.** After every draw, open the PNG and read it. Check that the picture agrees with the numbers.
- **Units are millimetres.**

## Tools and skills this workflow uses

| Need | Use |
|---|---|
| Draw DXF/PDF (walls, doors, windows, rooms, schedules, dimensions) | `autocad` MCP (`.mcp.json`), or `scripts/plan_cli.py` if the MCP is not loaded |
| Independent logic check | `scripts/check_plan.py` |
| Residential rooms: clearances, furniture, kitchen triangle, beds, stairs | `residential-space-designer` skill and its `check_layout.py` |
| UAE codes, authorities, climate | `architect-skills-uae:country-uae`, `building-codes` |
| Accessibility numbers | `architect-skills-uae:accessibility-design` |
| Escape routes, travel distance, fire doors | `architect-skills-uae:fire-life-safety` |
| Room sizing logic | `architect-skills-uae:spatial-planning` |
| Daylight, acoustics, services, materials | `daylighting-design`, `acoustic-design`, `building-services`, `material-selection` |
| Sharjah submission rules (sheets, layers, titles) | `anthropic-skills:sharjah-municipality-drawing-rules` |
| Sheet set, notes, details | `architect-skills-uae:construction-documentation` |
| 3D view | Trimble SketchUp MCP, or `layout_to_gltf.py` in the residential skill |

Load the UAE skills you need before step 3. Quote the value and its skill when you use it.

## The eight steps

### 1. Brief
Ask only for what is missing, in one message:
- Emirate, authority, plot size and shape, orientation (north arrow), floors, existing walls or a base plan
- Who uses it (ages, number, anyone with mobility, vision, hearing or cognitive needs), and how each room is used day to day
- Budget level, style, must-keeps, deal-breakers
- Whether this is new build, renovation or fit-out (structure and wet-core positions are fixed in the last two)

### 2. Room programme
Write a table before any geometry: room, function, users, minimum area and its source, daylight needed, privacy level, wet or dry, accessible (yes/no), and what it must connect to or must not open into. Save it as `brief.json` (see `templates/brief.example.json`). Check the total against the plot or shell area and say plainly if it does not fit.

### 3. Adjacency and circulation (before drawing)
Decide the logic in words first:
- **Zones**: public (entrance, majlis, guest WC), family, private (bedrooms), service (kitchen, laundry, store).
- **Entrance sequence**: how does a visitor arrive, and what do they see first? Guests reach the majlis and guest WC without crossing family or private zones. Service access is separate from the front door where the plot allows.
- **Wet core**: stack and group kitchens, bathrooms and laundry so plumbing runs are short. Keep bathroom doors off the living room's view.
- **Circulation spine**: one clear route. Every room is reachable from the entrance through doors. Dead-end corridors are justified or removed.
- **Climate (hot-arid)**: fewer and shaded openings on the west and south, daylight from the north, buffer rooms (store, stairs, services) on the hot side, shaded outdoor room. Cite `country-uae` and `daylighting-design`.
- **Accessibility**: the accessible route is continuous and level from entrance to every accessible room, with turning space where needed.

Give the user a short bubble diagram as text (zones and links) and the one or two decisions that matter most. If there are real alternatives, give two options with a recommendation, not a menu.

### 4. Draw
In this order, using the `autocad` MCP (or `plan_cli.py`):
1. `drawing_new`, then `drawing_plan` (sheet size, scale, layers).
2. `arch_plan_from_spec` with the whole spec: walls with thicknesses, openings (offset is from the wall start to the opening's start edge), stairs, labelled rooms, dimension chains on open sides, door and room schedules.
3. `arch_catalogue_insert` for furniture and sanitary fixtures, only after the shell is checked.
4. Title block and the DRAFT note.

`plan_cli.py` does steps 1 and 2 plus the exports from a `spec.json`:
```
uv run --with "fastmcp>=3.4.5,<4" --with "autocad-mcp-pro[pdf]==1.8.0" \
  python .claude/skills/architect-workflow/scripts/plan_cli.py spec.json OUTDIR
```
It writes `plan.dxf`, `plan.pdf`, `plan.png` and `rooms.json`.

### 5. Verify (up to three rounds)
```
uv run --with shapely python .claude/skills/architect-workflow/scripts/check_plan.py \
  spec.json OUTDIR/rooms.json brief.json
```
It checks room presence and minimum area, turning circle in accessible rooms, door widths, reachability from the entrance, required and forbidden door links, and windows. Fix every FAIL by changing the design, then redraw. Never loosen the brief or the rules to get a pass. Then open `plan.png` and look: proportions, door swings that clash, furniture blocking a door, wasted corridor.

For residential rooms also run the residential skill's checker on the furniture layout (`check_layout.py`). Treat its numbers as US/EU minimums, and UAE values win where they differ.

### 6. Code pass
List, per topic, what was checked and what is open:
- Accessibility (`accessibility-design`, `country-uae` section 6)
- Fire and life safety: exits, travel distance, door swing direction, compartmentation (`fire-life-safety`)
- Sharjah drawing rules (`sharjah-municipality-drawing-rules`)
- Ventilation, daylight, services, setbacks, parking (`building-codes`, `building-services`, `daylighting-design`)

Anything not confirmed from a source goes into an open-issues list as `[TO CONFIRM]` with the person who decides (architect, structural engineer, MEP engineer, Civil Defence consultant).

### 7. Handover
Give the user: the DXF and PDF, the PNG, the programme table, a one-page design rationale (why this layout, in plain language), the check output, and the open-issues list. Labels in Arabic and English for anything public, and flag Arabic for a native-speaker check.

### 8. Record
If the work belongs to a project folder, save the brief, spec, outputs and open issues there so the next session starts from them.

## Common mistakes to avoid
- Drawing first and justifying later.
- Typing room areas instead of reading them from the drawing.
- Using US/EU numbers where a UAE rule exists, or presenting any value as a code requirement without a source.
- A beautiful plan where the bedroom door opens into the kitchen, or a guest must walk through the family room to reach the WC.
- Treating "no FAIL" as approval.

## DALIL link
If the plan is for DALIL's handrail clips, draw the accessible route as its own layer and mark every handrail run, door and level change. That is the layer a DALIL quote and tactile map start from. Read `dalil-hq/DALIL-facts.md` first and use its numbers only.
