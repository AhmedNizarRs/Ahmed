# Design System: DALIL investor page

This file describes the design system that is built into `site/assets/css/site.css`. Use it when you add a section or a page, or when you brief a designer or an AI tool, so new work matches what is already there.

## 1. Visual theme and atmosphere

A dark, cinematic page that feels like a stairwell at night: near-black walls, brushed-steel rails, and one safety-yellow clip where the hand should go. The product glows in the dark, so the page lives in the dark. One switch on the page turns the lights off completely and lets the clip's green glow take over.

- **Density: 4 of 10, airy.** Sections are 96 to 176 px apart, with one idea per section and short lines.
- **Variance: 7 of 10, offset and asymmetric.**
  - A bottom-left hero over full-bleed video.
  - Split grids at 6:5, 5:7 and 8:4.
  - A bento grid of three steps, one tall.
  - A sideways walk through eight places.
  - A rising handrail for the roadmap.
- **Motion: 6 of 10, every movement has a reason.**
  - The headline decodes from braille.
  - The hand glides along the rail.
  - Words light up on the blank handrail.
  - The film frame opens up as it arrives.
  - The places pan sideways.
  - The roadmap rail fills month by month.
  - Charts grow from their baseline.

## 2. Color palette and roles

| Token | Name | Hex | Role |
|---|---|---|---|
| `--bg` | Stairwell Black | `#0B0C0E` | Page background |
| `--bg-2` | Raised Panel | `#121418` | Cards, form, rail demo |
| `--bg-3` | Lifted Panel | `#1A1D22` | DALIL column, toggles, unreached milestones |
| `--fg` | Bone White | `#F2F1EC` | Main text |
| `--fg-2` | Steel Grey | `#A9B0BA` | Secondary text |
| `--fg-3` | Dim Steel | `#8A929D` | Labels, hints, captions |
| `--line`, `--line-2` | Hairlines | white at 9% and 16% | Card edges, dividers |
| `--control` | Control Edge | `#747C87` | Input and chip borders |
| `--accent` | Safety Yellow | `#FFC700` | The single accent: primary buttons, the clip, big figures, chart bars, focus rings |
| `--glow` | Glow Green | `#8BF5B0` | Only the product's own glow, in the lights-off state |
| `--error` | Signal Red | `#FF8A7A` | Form errors |

Yellow is fully saturated because it is DALIL's brand colour and the product's real colour. It is the only accent. Green is the material's photoluminescent glow, not a second UI colour.

### Contrast (WCAG 2.2 AA, measured on `--bg`)

| Pair | Ratio |
|---|---|
| Bone White text | 17.3:1 |
| Steel Grey text | 9.0:1 |
| Dim Steel text | 6.2:1 |
| Yellow text | 12.5:1 |
| Ink on yellow (buttons) | 12.5:1 |
| Glow Green | 14.7:1 |

Never dim text with `opacity`: use the grey tokens. The roadmap's unreached months are grey, not faded.

## 3. Typography rules

- **Typeface:** Geist, self-hosted as one variable file (weights 300 to 800), preloaded with `font-display: optional` so it never swaps mid-read. Geist Mono for labels, figures and data.
- **Hero headline:** `clamp(2.75rem, 8.4vw, 6.75rem)`, weight 600, tracking −0.045em, line height 0.98, two lines.
- **Section headings:** `clamp(2.1rem, 5.6vw, 4.25rem)`, weight 600, tracking −0.03em, `text-wrap: balance`, at most 18 characters wide per line.
- **Statements** (No app. No battery. No renovation.): up to 5.25rem, with the last phrase in yellow.
- **Big figures** (21.8M, AED 18k, AED 500k): weight 300, tight tracking, tabular figures, in yellow.
- **Body:** 17 px, line height 1.6. Lead paragraphs are capped at 46 characters wide.
- **Labels:** Geist Mono, small caps-style uppercase, 0.08 to 0.14em tracking. Eyebrows are rationed to three on the page (The problem, Financials, The ask).
- **Copy:** sentence case, curly quotes, `…` for loading text, no em or en dashes (ranges use "to" or a hyphen), a non-breaking space inside amounts (`AED&nbsp;170M`).

## 4. Component stylings

### Buttons

- **Primary:** a full pill in Safety Yellow with an ink label. A circular "orb" holds the arrow, and the orb slides right on hover. Pressing scales the button to 0.97.
- **Ghost:** a translucent dark pill with a hairline edge, used for "Watch the film".
- **One label per intent:** "Join the waitlist" in the nav, the hero and the form.

### Navigation

A floating pill, detached from the top edge, with a frosted background and four section links on screens 960 px and wider. Under that width it shows only the logo and the button.

### Cards

- **Shape:** 24 px corners, `--bg-2` fill and a hairline inner edge.
- **Variety:** at least two cards in every group differ, with a yellow fill, a yellow glow gradient or a photo.

### Rail demo

- **Rail:** a steel tube drawn with gradients.
- **Clips:** three yellow clips showing their rib count and a raised mark.
- **Hand:** a ringed white circle, built as an ARIA slider with keyboard steps.
- **Readout:** shows the rib category, the message and its braille.

### Toggles

- **Lights switch:** a pill track with a sliding knob. It turns green and glows when the lights are off.
- **Rib keys:** pills that fill yellow when pressed.
- **State:** both use `aria-pressed`.

### Charts

- **Bars:** single-hue yellow on no background track, labelled directly in Geist Mono, growing from their baseline.
- **Comparison:** the competitor range is neutral grey, so nothing relies on colour alone.

### Form

- **Layout:** label above, hint below the label, error below the field.
- **Inputs:** 54 px tall with 14 px corners and a Control Edge border. Focus turns the border yellow with a soft yellow ring.
- **Interest options:** pill chips that fill yellow with a check icon when picked.
- **Errors:** the error summary takes focus and links to each field.

### Video frames

- **Corners:** 20 to 28 px, with a lazy-loaded AVIF poster under each video.
- **Playback:** the video fades in only once it is actually playing.
- **Film:** the play button is a large yellow disc.

## 5. Layout principles

- **Container:** 1240 px maximum. Side padding is 20 px on phones and 32 px from 640 px, and it also clears the notch on landscape phones.
- **Breakpoints:** mobile first, then 640 px (two columns for fields, modules and cards) and 960 px (split grids, the pinned sideways walk, the rising-rail roadmap, the sticky form intro).
- **Full height:** the hero uses `min-height: 100dvh`, never `100vh`.
- **Overflow:** no horizontal page scroll at any width from 320 to 1920 px. Only the comparison table and the places strip scroll sideways, each inside its own focusable region.
- **Layers:** z-index 40 is the fixed film-grain overlay (pointer-events none), 50 the nav and 60 the skip link.

## 6. Motion and interaction

- **Curves:** `cubic-bezier(0.16, 1, 0.3, 1)` for movement and `cubic-bezier(0.32, 0.72, 0, 1)` for spring-like presses and toggles. Nothing animates `top`, `left`, `width` or `height`, only `transform` and `opacity`.
- **Headline:** the braille decode keeps the headline's own line breaks, so nothing moves (layout shift 0).
- **ScrollTrigger:** GSAP ScrollTrigger is self-hosted and loads only when the browser is idle or the visitor interacts. Effects are set up once scrolling settles.
  - The sideways walk's scroll length is reserved in advance, so setting it up never moves the page.
  - CSS smooth scrolling switches off while ScrollTrigger runs, and in-page links are smoothed in script and move focus to their target.
- **Videos:** these only play while on screen, and never when the visitor has asked for reduced motion or less data.
- **Reduced motion:** no decode, no glide, no pin, no reveals, no autoplay and no marquee. The lights switch jumps straight to the glowing frame.

## 7. Anti-patterns (never do these on this page)

### Content

- No invented numbers. Every figure comes from the v7 deck.
- No organisation logos or names presented as customers or partners: none has signed yet.
- No claim that the Arabic braille is already approved: that is a month-6 milestone.

### Visual

- No second accent colour, no gradient text, no neon glow except the product's own green, no pure black (`#000000`).
- No em or en dashes in visible text.
- No emojis.
- No inline `style` attributes or inline scripts: the Content Security Policy blocks them, so values live in CSS (for example `.bar[data-v="62"]`).
- No `window.addEventListener("scroll")` handlers.

### Form

- No placeholder text standing in for labels.
- No disabling paste.
- No hiding errors in tooltips.
