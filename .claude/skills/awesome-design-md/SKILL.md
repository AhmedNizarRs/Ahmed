---
name: awesome-design-md
description: Library of 70+ ready-made DESIGN.md design systems inspired by real brands (Stripe, Linear, Vercel, Apple, Airbnb, Notion, Supabase, Spotify, Tesla and more) with colors, typography, spacing, radii and component rules. Use when the user wants a site or UI "in the style of" a brand, asks for a DESIGN.md, or wants a concrete, cohesive visual direction instead of generic defaults.
---

# Awesome Design (DESIGN.md library)

Source: https://github.com/VoltAgent/awesome-design-md (MIT, see `LICENSE`).

Each folder under `designs/` holds one `DESIGN.md`: YAML front matter with design tokens
(colors, type scale, radii, spacing) followed by prose rules for layout, components and tone.

## How to use

1. Pick the design that matches the request. List the options with `ls designs/`.
   If the user names a brand, use that folder; otherwise suggest two or three that fit the product.
2. Read `designs/<brand>/DESIGN.md` in full before writing any UI code.
3. If the user wants it in the project, copy it to the project root as `DESIGN.md`.
4. Build the UI from its tokens and rules: map its colors, fonts, radii and spacing to CSS
   variables or the Tailwind theme, and follow its component guidance.

These are design analyses inspired by public sites. Use them for direction; do not copy
logos, trademarks or proprietary assets, and do not present the result as the real brand's site.
