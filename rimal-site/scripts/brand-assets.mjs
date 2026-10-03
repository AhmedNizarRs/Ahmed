// Cuts the supplied logo (../assets/logo.png) into transparent brand pieces.
// Run once after replacing the logo: `node scripts/brand-assets.mjs`
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = new URL('../../assets/logo.png', import.meta.url).pathname;
const OUT = new URL('../src/assets/brand/', import.meta.url).pathname;
const PUB = new URL('../public/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const BG = [data[0], data[1], data[2]];

// Key out the cream paper: alpha grows with distance from the background colour,
// then un-mix the background so anti-aliased edges keep their true colour.
function keyed({ left, top, width, height }, recolorDark) {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((top + y) * W + (left + x)) * 3;
      const o = (y * width + x) * 4;
      const p = [data[i], data[i + 1], data[i + 2]];
      const d = Math.hypot(p[0] - BG[0], p[1] - BG[1], p[2] - BG[2]);
      const a = Math.max(0, Math.min(1, (d - 10) / 70));
      for (let c = 0; c < 3; c++) {
        out[o + c] = a > 0 ? Math.max(0, Math.min(255, (p[c] - BG[c] * (1 - a)) / a)) : 0;
      }
      if (recolorDark) {
        const lum = 0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2];
        const chroma = Math.max(out[o], out[o + 1], out[o + 2]) - Math.min(out[o], out[o + 1], out[o + 2]);
        // Only the brown ink (dark, low chroma) flips to cream; dune shading stays gold.
        if (lum < 90 && chroma < 48) { out[o] = 243; out[o + 1] = 233; out[o + 2] = 219; }
      }
      out[o + 3] = Math.round(a * 255);
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 });
}

const full = { left: 40, top: 160, width: 944, height: 700 };
const mark = { left: 40, top: 160, width: 944, height: 285 };
const lockup = { left: 40, top: 160, width: 944, height: 485 };

// Light versions (cream ink) for the dark site.
await keyed(full, true).png().toFile(OUT + 'logo-full-light.png');
await keyed(lockup, true).png().toFile(OUT + 'logo-lockup-light.png');

// Favicons: the dune mark on walnut.
const dunes = await keyed(mark).png().toBuffer();
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
  const inner = await sharp(dunes).resize({ width: Math.round(size * 0.86), height: Math.round(size * 0.86), fit: 'inside' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 21, g: 16, b: 12, alpha: 1 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toFile(PUB + name);
}
console.log('brand assets written');
