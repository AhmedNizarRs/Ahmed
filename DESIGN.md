---
name: Rimal Interiors
description: A materials sample board for a studio's digital CAD and BIM tools, in Arabic and English.
colors:
  walnut-deep: "#160f0b"
  walnut: "#1e1510"
  walnut-board: "#2a1d16"
  walnut-rule: "#3b2a20"
  paper: "#f4efe9"
  paper-rule: "#ddd0bc"
  ink: "#3a2418"
  ink-soft: "#6b5040"
  sand-gold: "#c49652"
  sand-gold-light: "#d9b272"
  sand-highlight: "#e6cfa2"
  gold-deep: "#85592a"
  board-text: "#f1e9dc"
  board-text-soft: "#c8b69b"
typography:
  display:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(2.3rem, 4.2vw, 3.7rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  display-ar:
    fontFamily: "Reem Kufi Variable, Readex Pro Variable, sans-serif"
    fontSize: "clamp(2.3rem, 4.2vw, 3.7rem)"
    fontWeight: 600
    lineHeight: 1.35
  heading:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(1.7rem, 2.8vw, 2.4rem)"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "Readex Pro Variable, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 330
    lineHeight: 1.65
  label:
    fontFamily: "Readex Pro Variable, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  paper: "2px"
  control: "4px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  sm: "0.75rem"
  md: "1.5rem"
  section: "clamp(4rem, 9vw, 7.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.sand-gold}"
    textColor: "{colors.walnut-deep}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.35rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.sand-gold-light}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1.35rem"
    height: "48px"
  language-switch:
    textColor: "{colors.sand-highlight}"
    rounded: "{rounded.pill}"
    padding: "0.45rem 0.95rem"
  specimen:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
  spec-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "0.35rem 1.1rem"
---

# Design System: Rimal Interiors

## Overview

The site is an interior designer's materials sample board. The page ground is a deep walnut board; every product is a paper specimen pinned to it with a brass pin, carrying a line drawing and a spec tag. Colour, type and ornament come straight from the Rimal logo: sand gold from the dune mark, deep brown ink from the wordmark, the logo's cream as paper, and the geometric knot as the only ornament.

Arabic and English are equals. Every rule below is written in logical properties (start/end, block/inline) so the whole page mirrors for right-to-left without separate styling.

## Colors

### Primary
**Sand gold** is the single action colour: primary buttons, pins, rules, board corners, step numbers. It never fills large areas.

### Neutral
**Walnut** (three steps) is the ground: page, header/footer, and the lighter board panel. **Paper** is every surface that carries a product or a tag, always with **ink** text. **Board text** and its soft variant are the only text colours on walnut.

### Named Rules
- **Paper carries ink.** Text on paper is ink or ink-soft; text on walnut is board-text or board-text-soft. Never cream on paper or brown on walnut.
- **Gold is for acting and pinning.** If it is not a control, a pin, a rule, or a measured value, it is not gold.

## Typography

Marcellus (flared classical capitals, close to the wordmark) sets English display and headings. Reem Kufi, a geometric Kufi that echoes the knot mark, sets Arabic display and headings. Readex Pro sets all body text in both scripts, so the two languages share one text voice.

### Hierarchy
Display (hero), heading (section and product names), body, label (spec rows, small UI). Arabic gets taller line-heights (1.35 display, 1.85 body) to clear the Kufi ascenders and descenders.

## Layout

One centred column, max 1200px, fluid gutter. Hero is two columns (copy, board) collapsing to one below 880px. Library entries alternate the specimen side on desktop and stack specimen-first on mobile. Sections breathe more above than below; one paper band (studio) breaks the walnut run mid-page.

## Elevation & Depth

Paper is pinned, not floating: a tight contact shadow plus a long soft drop (`pinned`). Hover or selection lifts it (`lifted`). No other elevation exists.

## Shapes

Paper corners are almost square (2px). Controls are 4px. The language switch is the only pill. Pins are circles; the knot is the only other ornamental shape.

## Components

### Buttons
Primary is sand gold with walnut text, on walnut. Ink buttons are used on paper. Quiet links are underlined text with a leading icon; the underline darkens on hover.

### Specimen (signature component)
Paper card with a brass pin centred at the top, a line drawing, and a label. On the hero board specimens sit at small tilts and straighten and lift on hover or focus. Picking one scrolls to its library entry and outlines that entry's specimen in gold.

### Spec tag
Paper ticket listing Software, Contents, Size/Details in dashed-rule rows with tabular numerals.

### Navigation
Sticky walnut header: dune mark with RIMAL / INTERIORS lockup (always left-to-right), text links with a gold underline that grows on hover, and the language switch as a pill naming the other language in that language.

## Do's and Don'ts

### Do:
- Put every new product on a paper specimen with a pin, a drawing, and a spec tag.
- Add every string to both languages in `src/i18n/strings.ts` or the product data, and mark it with `data-i18n`.
- Use logical CSS properties so right-to-left keeps working.

### Don't:
- Don't invent prices, reviews, or specs; unknown rows read "On the product page".
- Don't add eyebrow labels above headings, gradient text, or glass panels.
- Don't use gold for body text on paper; use ink.
