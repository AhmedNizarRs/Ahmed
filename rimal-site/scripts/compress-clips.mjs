// Compresses screen recordings for the web.
//   Input:  ../assets/clips/<name>.(mp4|mov|m4v|webm|mkv)   (repo root)
//   Output: public/clips/<name>.mp4  (H.264, max 1280px wide, no audio, fast start)
//           public/clips/<name>.jpg  (poster frame)
// Name each recording after the `clip` value in src/content/products.ts
// (autocad, revit, sketchup, 3dsmax, ai). Requires ffmpeg on your PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { extname, basename, join } from 'node:path';

const SRC = new URL('../../assets/clips/', import.meta.url).pathname;
const OUT = new URL('../public/clips/', import.meta.url).pathname;
if (!existsSync(SRC)) {
  console.log(`No clips folder at ${SRC}. Add recordings there first.`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f));
if (!files.length) console.log('No recordings found in assets/clips.');

for (const f of files) {
  const name = basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const input = join(SRC, f);
  const mp4 = join(OUT, `${name}.mp4`);
  const jpg = join(OUT, `${name}.jpg`);
  console.log(`→ ${f}  →  clips/${name}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', input,
    '-an', // muted: no audio track at all
    '-t', '20', // keep it short
    '-vf', "scale='min(1280,iw)':-2,fps=30",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4,
  ]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg]);
}
console.log('Done. Rebuild the site to show the clips.');
