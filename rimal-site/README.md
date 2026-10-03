# RIMAL Interiors — website

Bilingual (Arabic first, English at `/en/`) storefront for RIMAL Interiors. It sells the
**Ultimate Architect Tools Vault** (حزمة المهندس المعماري الشاملة) and leaves room for more products.
Every buy button opens the Gumroad product page in a new tab. There is no payment code on this site.

Built with [Astro](https://astro.build) as plain static HTML. The only JavaScript is about 4.5 KB
(gzipped): scroll reveals, the phone buy bar and lazy clips. Everything still works without it.

## Run it

Needs Node 22.12 or newer.

```bash
cd rimal-site
npm install
npm run dev       # http://localhost:4321  (Arabic)  ·  /en/ (English)
npm run build     # static site in dist/
npm run preview   # serve the built site locally
```

## Deploy to Vercel (zero config)

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo and set **Root Directory** to `rimal-site`.
   Vercel detects Astro and needs no other settings.
3. Optional: add the environment variable `PUBLIC_GUMROAD_VAULT_URL` to point the buy buttons
   somewhere else without touching code.
4. Once you connect your domain, put it in `SITE_URL` in `src/config.ts`. Canonical links, the
   sitemap, `robots.txt` and share cards all use it. Then redeploy.

Or from the terminal: `cd rimal-site && npx vercel`.

## Where things live

| What | File |
| --- | --- |
| Gumroad link, site URL, Instagram, owner name | `src/config.ts` |
| **Products** (the Vault and future products) | `src/content/products.ts` |
| All page text, Arabic and English | `src/content/copy.ts` |
| Colours, type, buttons | `src/styles/global.css` |
| Page sections | `src/components/*.astro` (assembled in `Page.astro`) |
| Photos used by the site | `src/assets/photos/` (generated, see below) |
| Logo pieces | `src/assets/brand/` (generated from `../assets/logo.png`) |

## Add a product

Open `src/content/products.ts`. Below the Vault there are three placeholders marked
`// PLACEHOLDERS`. To make one real:

```ts
{
  id: 'autocad-blocks',
  status: 'live',                       // 'soon' = "Coming soon" card, no buy button
  name: { ar: 'بلوكات AutoCAD', en: 'AutoCAD Blocks' },
  tagline: { ar: '…', en: '…' },
  price: 12,                            // USD
  buyUrl: 'https://kingahmed10.gumroad.com/l/xxxx',
  programs: ['AutoCAD'],
  image: 'card-autocad',                // optional: a file in src/assets/photos (no .jpg)
},
```

Save, then `npm run build` (or just push; Vercel rebuilds). The store section and the footer pick
it up automatically. Numbers and English words inside Arabic text are wrapped for correct
right-to-left display automatically, so type them normally.

## Screen recordings (clips)

The site is ready to show a muted, looping screen recording under each program in the
"What's in each folder" list. To add them:

1. Put your recordings in `assets/clips/` at the repo root, named after the program:
   `autocad.mp4`, `revit.mp4`, `sketchup.mp4`, `3dsmax.mp4`, `ai.mp4` (`.mov` is fine too).
2. Run `npm run clips` (needs `ffmpeg`). It creates small, muted H.264 files and poster frames in
   `public/clips/`. Clips are cut to 20 seconds and 1280 px wide, with the audio removed.
3. Rebuild. A clip only appears if its file exists. Clips load and play only while on screen,
   never with sound, and show controls instead of autoplaying for visitors who prefer reduced motion.

## Photos and logo

- `npm run photos` re-crops `../assets/photos/*.jpg` into `src/assets/photos/`. Crop boxes are
  listed in `scripts/photos.mjs`. To use your own renders, replace a source file (or point a crop
  at a new file) and run it again.
- `npm run brand` cuts `../assets/logo.png` into transparent light-on-dark logo files and favicons.
- The current photos are AI-generated mood images, not client projects or product screenshots.
  The footer says "Imagery is illustrative". Swap in your own renders when you have them.
- Share images `public/og-ar.jpg` and `public/og-en.jpg` are 1200×630.

## Quality notes

- Lighthouse (mobile, local build): Performance 94 (Arabic) / 98+ (English), Accessibility 100,
  Best Practices 100, SEO 100.
- Respects `prefers-reduced-motion`: no entrance animations, no clip autoplay.
- No sound anywhere, no countdowns, no reviews, no invented numbers.
- SEO: per-language title/description, `hreflang`, canonical, Open Graph/Twitter cards,
  sitemap, `robots.txt`, and `Product` + `Organization` structured data (no ratings).
