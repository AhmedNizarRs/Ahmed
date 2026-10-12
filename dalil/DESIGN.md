# Design System: DALIL investor page

This file describes the design system that is built into `site/assets/css/site.css`. Use it when you add a section or a new page, or when you brief a designer or an AI tool, so new work matches what is already there.

## 1. Visual theme and atmosphere

A calm, architectural page that feels like a well-lit building core: warm off-white walls, ink-black handrails and one bright safety yellow where the hand should go. The yellow always marks the clip itself or the next action, never decoration.

- **Density: 3 of 10, gallery airy.** Generous section padding (72 to 84 px on phones, 120 to 136 px on desktop), one idea per section and short lines of text.
- **Variance: 5 of 10, offset but orderly.** Split hero (7:5), a 5:7:4 card row for the levels of sight, a sideways strip for places. Nothing overlaps.
- **Motion: 4 of 10, quiet CSS.** The yellow clip slides along a drawn handrail as you scroll, and cards fade up as they arrive. No looping animation except the 1.1 s busy bar while the form sends.

Two dark ink bands (the problem and the opportunity) and the dark footer give the page a rhythm: light for the product, dark for the stakes and the money.

## 2. Color palette and roles

| Token | Name | Hex | Role |
|---|---|---|---|
| `--yellow` | Safety Yellow | `#FFC700` | The single accent: primary buttons, the clip on the rail, stat figures on ink, the touch card, tranche 1 |
| `--yellow-press` | Pressed Yellow | `#F0BB00` | Hover and busy state of yellow buttons |
| `--ink` | Handrail Ink | `#111315` | Main text, dark bands, footer, focus rings on light backgrounds |
| `--paper` | Wall Paper | `#F7F5F0` | Page background |
| `--white` | Clean Surface | `#FFFFFF` | Alternate section background, form, cards |
| `--slate` | Brand Slate | `#8C96A5` | Secondary text on ink only |
| `--muted` | Reading Grey | `#555F6D` | Secondary text on paper and white |
| `--line` | Hairline | `rgb(17 19 21 / 0.12)` | Card borders, table rules, dividers |
| `--line-strong` | Control Edge | `#6E7682` | Input, checkbox-card and icon-button borders |
| `--error` | Error Red | `#B42318` | Error text, error borders |
| `--error-bg` | Error Wash | `#FDF1EF` | Background of invalid fields and the error summary |

Yellow is fully saturated because it is the DALIL brand colour and the product's real colour; it is the only accent on the page.

### Contrast rules (WCAG 2.2 AA, measured)

| Pair | Ratio | Use |
|---|---|---|
| Ink on paper | 17.1:1 | Body text |
| Muted on paper | 5.9:1 | Secondary text on the page background |
| Muted on white | 6.5:1 | Secondary text on cards and the form |
| Slate on ink | 6.2:1 | Secondary text in dark bands |
| Ink on yellow | 11.9:1 | Button labels |
| Yellow on ink | 11.9:1 | Big figures in dark bands |
| Error on white | 6.6:1 | Field errors |
| Control edge on white | 4.6:1 | Input borders (needs 3:1) |

Never use these as text:

- **Slate on paper** (2.7:1). On light backgrounds use Reading Grey instead.
- **Yellow on paper or white** (1.4:1). Yellow is only ever a fill there.

## 3. Typography rules

- **Typeface:** Manrope, self-hosted as one variable file (`assets/fonts/manrope-latin.woff2`, weights 400 to 800, `font-display: swap`). The Arabic دليل in the logo uses a 2.7 KB subset of IBM Plex Sans Arabic.
- **Display (h1):** `clamp(2.6rem, 9vw, 5rem)`, weight 750, line height 1.02, tracking −0.04em. Fixed at 4.25rem on desktop so the headline sits on two lines.
- **Section headings (h2):** `clamp(1.95rem, 6vw, 3.25rem)`, weight 750, tracking −0.03em, `text-wrap: balance`.
- **Card headings (h3):** 1.25rem (1.5rem for the three steps), weight 750.
- **Body:** 1.0625rem (17 px), line height 1.6, `text-wrap: pretty`. Lead paragraphs are 1.125 to 1.375rem in Reading Grey, capped at 34ch. Body copy is capped at 52 to 62ch.
- **Big figures:** weight 800, tracking −0.035 to −0.045em. Comparison table and tranche amounts use `tabular-nums`.
- **Labels:** small uppercase with 0.06 to 0.14em tracking, used only for eyebrows, the market region, tranche names and table headers.
- **Copy style:** sentence case everywhere, curly quotes, `…` for loading text, a non-breaking space inside amounts and units (`AED&nbsp;500,000`, `2&nbsp;seconds`).

## 4. Component stylings

- **Primary button:** Safety Yellow fill, Handrail Ink label, 12 px corners, at least 56 px tall, weight 750. Hover darkens to Pressed Yellow; press scales to 0.98. The arrow icon nudges down 2 px on hover. One per screen.
- **Secondary button:** transparent with a 1.5 px ink edge (drawn as an inset shadow), used for "Back to the page" and the desktop header link.
- **Text link:** bold, underlined, 12 px vertical padding for a comfortable tap area. Hover thickens the underline from 1 px to 2 px.
- **Icon button (gallery arrows):** 48 px square, white, 1.5 px Control Edge border, `aria-label` on every one. Disabled at either end of the strip.
- **Cards:** used only where they group a picture with its caption, or hold a figure. White or paper fill, 1 px Hairline border, 12 px corners, no shadow. Images inside cards use 8 px corners.
- **Inputs:** label above, hint under the label, error under the field. White, 56 px tall, 1.5 px Control Edge border, 12 px corners, 17 px text so iPhones don't zoom. Focus adds a 3 px ink outline. Invalid fields get an Error Red border and Error Wash fill.
- **Checkbox cards:** the whole 56 px row is the tap target. A checked row gets an ink border and a pale yellow fill (`#FFF8DB`).
- **Error summary:** appears above the form when sending fails validation and takes focus. It lists every problem as a link that moves focus to the field.
- **Loading:** the send button reads "Sending your details…" and a short ink highlight slides along its bottom edge.
- **Tags:** a small ink pill reading "Visualisation" on every in-situ picture; a dashed slate box for the `[SOURCE]` placeholder.
- **Sticky phone button:** below 960 px, a full-width yellow button pinned to the bottom of the screen. It hides while the hero button or the form is on screen, and leaves the tab order when hidden.

## 5. Layout principles

- **Container:** 1200 px maximum, centred, with 16 px side padding on phones and 32 px from 640 px. Padding also clears the notch when a phone is held sideways.
- **Breakpoints:** mobile first at 390 px, then 640 px (two columns for cards and choices) and 960 px (split hero, horizontal rail, form beside its intro).
- **Grids:** CSS Grid throughout:
  - hero 7:5;
  - problem 5:6;
  - levels of sight 5:7:4;
  - form 4:6.
- **Sideways strips:** "Where it works" scrolls sideways at every width, with snap points and arrow buttons from 640 px. The visualisations scroll sideways on phones and become a three-up grid from 640 px.
- **Spacing:** sections have slightly more space below than above (72/84 px, 120/136 px).
- **Overflow:** the page never scrolls sideways (checked at 320, 375, 390, 768, 1024, 1440 and 1920 px).
- **Shape:** 12 px corners on buttons, inputs, cards and photos; 8 px on images inside cards; full pills only for small tags and sector labels; circles for the two team portraits.

## 6. Motion and interaction

- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for movement; 0.15 to 0.2 s colour changes on hover.
- **Rail clip:** a CSS scroll-driven animation (`animation-timeline: view()`) moves the yellow clip down the rail on phones and across it on desktop. It only uses `transform`, so it runs on the compositor. Browsers without scroll timelines show the clip parked at the first step.
- **Reveals:** cards and headings below the fold fade up 16 px over 0.7 s via IntersectionObserver. Cards in the same row arrive 70 ms apart. Nothing visible at load is hidden.
- **Reduced motion:** with `prefers-reduced-motion: reduce` there are no reveals, no rail animation, no smooth scrolling and near-instant transitions.
- **Forced colours (Windows high contrast):** yellow buttons and cards get a 2 px system-colour border; the clip keeps its own colours.

## 7. Anti-patterns (never do these on this page)

### Content

- No invented numbers, testimonials, customers, awards or partner logos.
- No organisation named as a partner: none has signed yet.
- No airport or aircraft imagery.
- No claim that DALIL is profitable or that revenue covers costs.
- No claim that the Arabic braille is certified. It is being verified.
- Say "up to 3× cheaper", never "3× cheaper".
- Keep the `[SOURCE]` tag next to the 21.8 million figure until the source is added.
- Caption every in-situ picture "Visualisation".

### Visual

- No second accent colour, no gradients on text, no glows, no pure black (`#000000`).
- No yellow or slate text on light backgrounds.
- No emojis.
- No inline `style` attributes or inline scripts: the Content Security Policy blocks them.
- No animation of `top`, `left`, `width` or `height`.
- No looping decorative motion.

### Form

- No placeholder text standing in for labels.
- No disabling paste.
- No hiding errors in tooltips.
