// Build the folder that is published for testing on a phone (GitHub Pages, branch gh-pages of this repository):
//   node tools/build-pages.mjs [outDir]        (default: dist-pages/, not kept in git)
// It holds only what the visitor app needs: app/ and the maps listed in app/maps.json, plus
//   index.html  → opens app/
//   404.html    → GitHub Pages has no rewrites: a DALIL sign's link (…/app/t/<building>/<floor>/<point>) lands on
//                 the 404 page, which sends it on to …/app/#t/<building>/<floor>/<point>
//   .nojekyll   → serve the files as they are
// The test build asks search engines not to list it (the bundled maps are for internal testing only).
// Publishing = committing that folder as the gh-pages branch (see CLAUDE.md, "Phone test build").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist-pages'));
if (OUT === ROOT || ROOT.startsWith(OUT + path.sep)) throw new Error('refusing to build into the project folder itself');

for (const e of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (e !== '.git') fs.rmSync(path.join(OUT, e), { recursive: true, force: true });   // keep a .git there: it may be the gh-pages checkout
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'app'), path.join(OUT, 'app'), { recursive: true });
const maps = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/maps.json'), 'utf8')).maps;
for (const u of maps) {
  const src = path.resolve(ROOT, 'app', u), dst = path.resolve(OUT, 'app', u);
  if (!src.startsWith(ROOT + path.sep) || !dst.startsWith(OUT + path.sep)) throw new Error('map outside the project: ' + u);
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
}
const page = path.join(OUT, 'app/index.html'), html = fs.readFileSync(page, 'utf8');
if (!/name="robots"/.test(html)) fs.writeFileSync(page, html.replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n<meta name="theme-color"'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'index.html'), '<!doctype html>\n<meta charset="utf-8">\n<title>DALIL · دليل</title>\n<meta name="robots" content="noindex">\n<meta http-equiv="refresh" content="0; url=app/">\n<p><a href="app/">Open DALIL</a></p>\n');
fs.writeFileSync(path.join(OUT, '404.html'), `<!doctype html>
<meta charset="utf-8">
<title>DALIL · دليل</title>
<meta name="robots" content="noindex">
<script>
  // A DALIL sign's link (…/app/t/<building>/<floor>/<place>) is sent on to the app, which reads the same three
  // parts from the # part of the address. Anything else unknown opens the app.
  var m = location.pathname.match(/^(.*\\/app)\\/t\\/([^/]+)\\/([^/]+)\\/([^/]+)\\/?$/);
  location.replace(m ? m[1] + '/#t/' + m[2] + '/' + m[3] + '/' + m[4] : (location.pathname.split('/').slice(0, 2).join('/') || '') + '/app/');
</script>
<p>Opening DALIL…</p>
`);
fs.writeFileSync(path.join(OUT, 'README.md'), '# DALIL visitor app: test build\n\nPublished files only (`app/` and its demo maps), built from `dalil-nav/` with `node tools/build-pages.mjs`.\nDo not edit here: change `dalil-nav/` on the working branch and publish again. The demo maps are for internal testing only.\n');
const count = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.name === '.git' ? 0 : e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`Built ${OUT}: ${count(OUT)} files, ${maps.length} maps`);
