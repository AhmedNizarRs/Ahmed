// Makes the DALIL QR code: qr-dalil.svg and a 2000 px qr-dalil.png.
// Ink #111315 on white, error correction H, quiet zone of at least 4 modules,
// the DALIL mark in the centre. Then reads the PNG back to prove it opens the right URL.
//
// Usage (needs Node 18+):
//   npm install qrcode@1.5.4 jsqr@1.4.0 pngjs@7.0.0 playwright
//   node make-qr.js https://dalil-team.com/?src=qr ../qr
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const { chromium } = require('playwright');

const url = process.argv[2];
const outDir = process.argv[3] || '.';
if (!url) { console.error('Give the URL to encode.'); process.exit(1); }

const INK = '#111315', YELLOW = '#FFC700', SIZE = 2000;
const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
const n = qr.modules.size;
// Total width in modules: the smallest divisor of 2000 that leaves a quiet zone of 4 or more,
// so every module is a whole number of pixels in the PNG.
let total = n + 8; while (SIZE % total !== 0) total++;
const q = (total - n) / 2;

// Centre box for the mark: about a quarter of the code's width, odd so it sits dead centre.
let box = Math.round(n * 0.24); if (box % 2 === 0) box++;
const b0 = (n - box) / 2, b1 = b0 + box;
const inBox = (r, c) => r >= b0 && r < b1 && c >= b0 && c < b1;

let d = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
  if (qr.modules.get(r, c) && !inBox(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
}
const bx = b0 + q, pad = 0.6;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${SIZE}" height="${SIZE}" shape-rendering="crispEdges">
<title>QR code: ${url}</title>
<rect width="${total}" height="${total}" fill="#FFFFFF"/>
<path d="${d}" fill="${INK}"/>
<rect x="${bx + 0.25}" y="${bx + 0.25}" width="${box - 0.5}" height="${box - 0.5}" rx="1.2" fill="#FFFFFF" shape-rendering="geometricPrecision"/>
<svg x="${bx + pad}" y="${bx + pad}" width="${box - 2 * pad}" height="${box - 2 * pad}" viewBox="34 12 276 276" shape-rendering="geometricPrecision">
<rect x="150" y="142" width="150" height="16" fill="${INK}"/>
<path d="M216.19,201.72 A84,84 0 1 1 216.19,98.28" fill="none" stroke="${YELLOW}" stroke-width="44"/>
<circle cx="150" cy="150" r="34" fill="${INK}"/>
</svg>
</svg>
`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const svgPath = path.join(outDir, 'qr-dalil.svg');
  const pngPath = path.join(outDir, 'qr-dalil.png');
  fs.writeFileSync(svgPath, svg);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  await browser.close();

  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const found = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  console.log(`QR version ${qr.version}, ${n}x${n} modules, error correction H, quiet zone ${q} modules, ${SIZE / total} px per module`);
  console.log(`Centre box ${box}x${box} modules (${(100 * box * box / (n * n)).toFixed(1)}% of the code)`);
  console.log(`PNG ${png.width}x${png.height}, decodes to: ${found ? found.data : 'NOTHING'}`);
  if (!found || found.data !== url) { console.error('The QR code does not read back correctly.'); process.exit(2); }
  console.log('Read-back matches the URL.');
})();
