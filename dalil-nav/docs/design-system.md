# DALIL visitor app: design system (Nov 2026, design pass 6)

The app is one product with one calm system: a phone maps app look (the founder's choice) with DALIL's yellow for
"do this" and blue for "this way / you". Tokens live at the top of `app/styles.css`; this file is the rulebook.

## Principles
1. **The next step is always obvious and in reach.** One primary (yellow) button per screen, at the bottom where the thumb is (the route page's Start sits in a sticky bar).
2. **Say only what is true.** "You are here" only when GPS, a sign, a link or the visitor confirmed it; otherwise "Starting point" / "Not in this building".
3. **Calm surfaces, meaningful colour.** No gradients or glows on controls; colour carries meaning only.
4. **Motion explains, never decorates.** Every animation shows where something came from or that a tap worked; all of it stops with Reduce motion (setting or system).
5. **Big and bilingual.** 48 px minimum targets (56–68 px for main actions), WCAG AA contrast, EN + AR with full RTL.

## Colour (Day, default)
| Role | Token / value | Used for |
|---|---|---|
| Brand / action | `--brand` #FFC700, text `--on-brand` #1F1F1F | primary buttons, destination pin, category tiles |
| Route / guidance | `--route` #1A73E8, edge #1557B0 | route line, instruction banner, turn bubbles |
| You | `--you` #2F7BFF | your dot, start disc |
| Success / step-free | #188038 | arrival, "Step-free route available", lifts and stairs chips |
| Warning / end | red (`.hud-btn.end`, `.route-msg.warn`) | End, no route |
| Surfaces | #FFFFFF page, #F1F3F4 cards, line #DADCE0 | everything else |
| Ink | #1F1F1F / #3C4043 / #5F6368 | primary / secondary / tertiary text |
Night and High contrast redefine the same tokens; High contrast is black, white and #FFE600 only.

## Type
- One interface face: **Geist** (Latin), **IBM Plex Sans Arabic**; numbers use tabular figures (`.num`). Geist Mono only for codes and URLs.
- Scale (rem): 0.875 labels (`.eyebrow`, sentence case, 600) · 1 body small · 1.125 body · 1.25 summary line · 1.625–1.875 titles · 2.5 big stats.
- No spaced-out uppercase labels.

## Space, shape, depth
- Spacing steps: 0.25 · 0.5 · 0.75 · 1 · 1.25 · 1.5 rem; page gutter `--gut`.
- Radius: `--r` (cards, buttons), `--r-lg` (tiles, big buttons), full round for pills and map markers.
- Depth: one soft shadow for floating things (sheet, map controls, sticky bar, pins); flat cards on the page.

## Components
- **Buttons:** primary (flat yellow, darker on press), secondary (white + 1 px line), tertiary (grey); press = scale 0.97 + darker fill; disabled = 40 %.
- **Rows** (`.row-btn`): icon square · name + one-line sub (category · door) · value on the end (distance).
- **Tiles** (Find the nearest): icon in a yellow square, name, distance.
- **Sheets/dialogs** (`.sheet-dlg`): title + close in `.dlg-head`, actions stacked, primary first.
- **Map markers** (`mapview.js`): route = solid blue with darker edge + white arrows every 5 m; start = white disc + icon + label; destination = yellow pin with the place's icon and name; key places = white icon chips (blue toilets, green lifts/stairs, black entrances); labs on the real map = purple flask.
- **Home sheet:** drag or tap; order = building + where you are → Find the nearest → Indoor maps → Saved → Recent → more.

## Motion
- Durations: 120 ms press, 260–320 ms page and sheet, 2.2 s pulses; easing `--ease`.
- Page enter: fade + 10 px rise. Lists: rows fade up one after another (30 ms apart, max 150 ms).
- Pulses only on things that need attention (destination, "you", a turn within 8 m).
- Haptics: a light tick on primary actions, tiles and map buttons (Android; the Vibration setting turns it off).

## States
- **Loading:** the boot screen with the logo; map tiles fail over silently to the next provider.
- **Empty:** search with nothing typed explains what to type; no results offers "Ask at the help desk" and "Get help".
- **Error:** no route / no step-free route as a yellow warning card with what to do; GPS off only after you asked for it.
- **Success:** the arrival card (tick, place, distance, "Look for the sign to make sure").
