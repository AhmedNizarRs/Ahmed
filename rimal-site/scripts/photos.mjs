// Crops the source photos in ../assets/photos into the images the site uses.
// Run after replacing a source photo: `node scripts/photos.mjs`
// Coordinates are in source pixels (sources are 2048 × 1152).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = new URL('../../assets/photos/', import.meta.url).pathname;
const OUT = new URL('../src/assets/photos/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const jobs = [
  // full frames
  { out: 'hero.jpg', src: 'hero.jpg' },
  { out: 'hero-rtl.jpg', src: 'hero.jpg', flop: true },
  { out: 'spotlight.jpg', src: 'autocad.jpg' },
  { out: 'final.jpg', src: 'revit.jpg' },
  // program cards (3:4)
  { out: 'card-autocad.jpg', src: 'autocad.jpg', crop: [600, 300, 615, 820] },
  { out: 'card-revit.jpg', src: 'revit.jpg', crop: [640, 32, 840, 1120] },
  { out: 'card-sketchup.jpg', src: 'hero.jpg', crop: [900, 272, 660, 880] },
  { out: 'card-3dsmax.jpg', src: 'hero.jpg', crop: [1440, 340, 608, 811] },
  { out: 'card-ai.jpg', src: 'autocad.jpg', crop: [1150, 0, 600, 800] },
  // detail tiles (4:5)
  { out: 'tile-furniture.jpg', src: 'hero.jpg', crop: [940, 640, 320, 400] },
  { out: 'tile-decor.jpg', src: 'hero.jpg', crop: [1160, 320, 280, 350] },
  { out: 'tile-islamic.jpg', src: 'revit.jpg', crop: [780, 400, 400, 500] },
  { out: 'tile-architectural.jpg', src: 'revit.jpg', crop: [1060, 380, 440, 550] },
];

for (const j of jobs) {
  let img = sharp(SRC + j.src);
  if (j.crop) {
    const [left, top, width, height] = j.crop;
    img = img.extract({ left, top, width, height });
  }
  if (j.flop) img = img.flop();
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(OUT + j.out);
}
console.log(`wrote ${jobs.length} images`);
