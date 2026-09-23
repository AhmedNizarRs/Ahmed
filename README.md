# Rimal Interiors website

Bilingual (English / Arabic) storefront for Rimal Interiors' architectural tools, built with [Astro](https://astro.build) as a static site.

- English: `/` · Arabic: `/ar/` · the switch in the header swaps language in place and remembers the choice.

## Run it

```bash
npm install
npm run dev      # local preview at http://localhost:4321
npm run build    # static site in dist/, ready for any static host
```

## Where to edit

| What | File |
| --- | --- |
| Products, their purchase links, descriptions, specs (both languages) | `src/data/products.ts` |
| Instagram, Linktree, WhatsApp links | `src/data/site.ts` |
| All other page text (both languages) | `src/i18n/strings.ts` |
| Layout and styling | `src/components/Page.astro`, `src/styles/global.css` |
| Brand images (cut from the supplied logo) | `src/assets/brand/` |

**Product links:** each product has a `link` field. While it is empty, the product's button says "Buy via Linktree" and opens the Linktree page. Paste the product's own checkout URL into `link` and the button becomes "Buy now" and goes straight there.

**WhatsApp:** set `whatsapp` in `src/data/site.ts` to `https://wa.me/<number>` (international format, no `+`) to show a WhatsApp button.

**Domain:** once the site has a domain, set `site` in `astro.config.mjs` so language links and the social preview image use full URLs.

Design decisions are recorded in `DESIGN.md`; product facts in `PRODUCT.md`.
