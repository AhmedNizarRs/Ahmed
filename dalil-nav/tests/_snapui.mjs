import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => localStorage.setItem('dalil.locAsked', '1'));
await page.goto('http://localhost:8765/app/'); await page.waitForFunction(() => window.DALIL_APP?.state?.map);
// a photo of an evacuation plan, taken a bit crooked (perspective), on a grey wall
const png = await page.evaluate(() => {
  const s = document.createElement('canvas'); s.width = 1000; s.height = 700; const x = s.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 1000, 700); x.strokeStyle = '#222'; x.lineWidth = 5;
  const L = (a, b2, c2, d) => { x.beginPath(); x.moveTo(a, b2); x.lineTo(c2, d); x.stroke(); }, X = m => 100 + m * 20, Y = m => 110 + m * 20;
  L(X(0), Y(0), X(40), Y(0)); L(X(40), Y(0), X(40), Y(24)); L(X(0), Y(24), X(18.5), Y(24)); L(X(20), Y(24), X(40), Y(24)); L(X(0), Y(0), X(0), Y(24));
  L(X(0), Y(10), X(4), Y(10)); L(X(5), Y(10), X(16), Y(10)); L(X(17), Y(10), X(30), Y(10)); L(X(31), Y(10), X(40), Y(10)); L(X(13), Y(0), X(13), Y(10)); L(X(27), Y(0), X(27), Y(10));
  L(X(0), Y(14), X(8), Y(14)); L(X(9), Y(14), X(17), Y(14)); L(X(22), Y(14), X(33), Y(14)); L(X(34), Y(14), X(40), Y(14)); L(X(17), Y(14), X(17), Y(24)); L(X(22), Y(14), X(22), Y(24));
  x.fillStyle = '#111'; x.font = '22px sans-serif'; x.fillText('LAB 1', X(4), Y(5)); x.fillText('PRAYER', X(31), Y(5)); x.font = 'bold 34px sans-serif'; x.fillText('EVACUATION PLAN', 330, 60);
  x.strokeStyle = '#0a0'; x.lineWidth = 8; L(X(5), Y(12), X(18), Y(12));
  const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const y = c.getContext('2d'); y.fillStyle = '#9a9a96'; y.fillRect(0, 0, 1200, 900);
  y.setTransform(1, 0.04, -0.03, 1, 110, 90); y.drawImage(s, 0, 0);
  return c.toDataURL('image/png');
});
const buf = Buffer.from(png.split(',')[1], 'base64');
await page.evaluate(() => { document.querySelector('#btnSheet')?.click(); });
await page.evaluate(() => document.querySelector('#btnSnapHome').click());
await page.waitForSelector('#snPick:not([hidden])'); await page.screenshot({ path: out + '/s1.png' });
await page.setInputFiles('#snFile2', { name: 'plan.png', mimeType: 'image/png', buffer: buf });
await page.waitForSelector('#snWork:not([hidden])'); await page.waitForTimeout(300);
// drag the corners onto the sheet's corners (photo px → screen)
const toScreen = async (px, py) => page.evaluate(([px, py]) => { const c = document.querySelector('#snCanvas'), r = c.getBoundingClientRect(); return [r.left + px * r.width / c.width, r.top + py * r.height / c.height]; }, [px, py]);
const sheet = [[110, 90], [110 + 1000, 90 + 40], [110 + 1000 - 21, 90 + 40 + 700], [110 - 21, 90 + 700]];   // where the transform put the sheet corners
const now = await page.evaluate(() => window.__snc = null);
const cur = await page.evaluate(() => { const A = window.DALIL_APP; return null; });
for (let i = 0; i < 4; i++) {
  const from = await page.evaluate(i => { const c = document.querySelector('#snCanvas'), r = c.getBoundingClientRect(); const k = [[.06, .06], [.94, .06], [.94, .94], [.06, .94]][i]; return [r.left + k[0] * r.width, r.top + k[1] * r.height]; }, i);
  const to = await toScreen(...sheet[i]);
  await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 5 }); await page.mouse.up();
}
await page.screenshot({ path: out + '/s2.png' });
await page.click('#snNext'); await page.waitForTimeout(400); await page.screenshot({ path: out + '/s3.png' });
await page.click('#snNext'); await page.waitForTimeout(200);
// size: tap A and B on a 40 m wall: plan px of the warped image ~ X(0)..X(40) along y=0 top wall → use the corners: warped W=1000 maps the sheet width
const wpt = async (sx, sy) => page.evaluate(([sx, sy]) => { const c = document.querySelector('#snCanvas'), r = c.getBoundingClientRect(); return [r.left + sx / 1000 * c.width * r.width / c.width, r.top + sy / 700 * c.height * r.height / c.height]; }, [sx, sy]);
await page.mouse.click(...await wpt(100, 330)); await page.mouse.click(...await wpt(900, 330));
await page.fill('#snLen', '40'); await page.click('#snLenGo'); await page.waitForTimeout(200);
const scaleTxt = await page.textContent('.sn-scale'); await page.screenshot({ path: out + '/s4.png' });
await page.click('#snNext'); await page.waitForTimeout(200);
const add = async (sx, sy, name, cat) => { await page.mouse.click(...await wpt(sx, sy)); await page.waitForSelector('#dlgPlace[open]'); await page.fill('#placeEn', name); await page.selectOption('#placeCat', cat); await page.click('#formPlace button[type=submit]'); await page.waitForTimeout(150); };
const X = m => 100 + m * 20, Y = m => 110 + m * 20;
await add(X(19.2), Y(23), 'Main entrance', 'entrance'); await add(X(6), Y(5), 'Lab 1', 'lab'); await add(X(33), Y(5), 'Prayer room', 'prayer'); await add(X(8), Y(19), 'Toilets (men)', 'toilet');
const unreach = await page.evaluate(() => document.querySelector('#snCtl .warn')?.textContent || null);
await page.screenshot({ path: out + '/s5.png' });
await page.click('#snNext'); await page.fill('#snBld', 'Snap Test Hall'); await page.click('#snNext');
await page.waitForFunction(() => window.DALIL_APP.page() === 'home');
const st = await page.evaluate(() => ({ b: window.DALIL_APP.state.map.building.name, n: window.DALIL_APP.state.map.points.length }));
await page.evaluate(() => window.DALIL_APP.go('search')); await page.fill('#search', 'prayer'); await page.waitForTimeout(300);
const card = await page.evaluate(() => document.querySelector('.nearest-card')?.innerText.replace(/\s+/g, ' '));
await page.click('.nc-go'); await page.waitForTimeout(500);
const route = await page.evaluate(() => ({ dest: document.querySelector('#destName').textContent, dist: document.querySelector('#statDist')?.textContent }));
await page.screenshot({ path: out + '/s6.png' });
console.log(JSON.stringify({ scaleTxt, unreach, st, card, route }), 'errors', errs); await b.close();
