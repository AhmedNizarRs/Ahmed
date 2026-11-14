// Acceptance test for the DALIL visitor app (docs/visitor-app-spec.md → "Acceptance").
//
// Setup:  npm install            (from dalil-nav/; installs Playwright)
//         npx playwright install chromium
// Run:    npm test               (or: node --test tests/test_visitor_app.mjs)
//
// Serves the project folder on a local port (the app fetches ../data/*.json and registers a service worker,
// so it needs http, not file://) and drives the app in a phone-sized Chromium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dalil-map_sample-hospital_ground.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

let server, base, browser;
before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/app/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(hash = '', opts = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + hash);
  await page.evaluate(() => window.DALIL_APP.ready);
  return { ctx, page, errors };
}
const steps = page => page.$$eval('#stepList li', li => li.map(l => l.textContent.trim()));

test('sample hospital loads; search "prayer" and navigate: steps match routes.walk["P001>P007"]', async () => {
  const { ctx, page, errors } = await open();
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await page.fill('#search', 'prayer');
  await page.click('#results button[data-pick="P007"]');
  assert.equal(await page.textContent('#destName'), 'Prayer Room');
  const r = SAMPLE.routes.walk['P001>P007'];
  assert.equal(await page.textContent('#statDist'), `${Math.round(r.distance_m)} m`);
  assert.ok(await page.isEnabled('#btnStart'));

  await page.click('#btnStart');
  await page.waitForSelector('#nav:not([hidden])');
  assert.deepEqual(await steps(page), r.steps.map(s => s.en));
  // Step through with Next: the big card and the live region follow the route's steps.
  for (let i = 0; i < r.steps.length; i++) {
    assert.equal(await page.textContent('#navStepText'), r.steps[i].en);
    await page.waitForFunction(t => document.querySelector('#live').textContent.includes(t), r.steps[i].en);
    if (i < r.steps.length - 1) await page.click('#btnNext');
  }
  await page.waitForSelector('#arrived:not([hidden])');
  assert.equal(await page.textContent('#arrivedName'), 'Prayer Room');
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  for (const s of r.steps) assert.ok(spoken.includes(s.en), `spoken: ${s.en}`);
  await page.click('#btnArrivedDone');
  assert.equal(await page.textContent('#fromName'), 'Prayer Room');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('tag steps show "I\'m at this tag" and simulate walk reaches the arrival screen', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P008');
  const r = SAMPLE.routes.walk['P001>P008'];
  await page.click('#btnStart');
  const nodeIdx = r.steps.findIndex(s => s.node);
  for (let i = 0; i < nodeIdx; i++) await page.click('#btnNext');
  assert.ok(await page.isVisible('#btnTag'));
  await page.click('#btnTag');
  assert.equal(await page.textContent('#navStepText'), r.steps[nodeIdx + 1].en);
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  await page.click('#btnPrev'); await page.click('#btnPrev'); await page.click('#btnPrev');
  await page.click('#btnSim');
  await page.waitForSelector('#arrived:not([hidden])', { timeout: 40_000 });
  assert.equal(await page.textContent('#arrivedName'), 'Pharmacy');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Accessible mode to Clinic 2 shows "no step-free route"', async () => {
  const { ctx, page, errors } = await open();
  await page.click('#chipAccessible');
  assert.equal(await page.getAttribute('#chipAccessible', 'aria-pressed'), 'true');
  await page.fill('#search', 'clinic 2');
  await page.click('#results button[data-pick="P010"]');
  assert.match(await page.textContent('#routeMsg'), /no step-free route/i);
  assert.ok(await page.isDisabled('#btnStart'));
  assert.equal(SAMPLE.routes.chair['P001>P010'], undefined);
  // Walking route still exists once Accessible is off.
  await page.click('#chipAccessible');
  assert.ok(await page.isEnabled('#btnStart'));
  // A step-free route that exists uses routes.chair.
  await page.click('#chipAccessible');
  await page.fill('#search', 'pharmacy');
  await page.click('#results button[data-pick="P008"]');
  assert.equal(await page.textContent('#statDist'), `${Math.round(SAMPLE.routes.chair['P001>P008'].distance_m)} m`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('opening #at-P013 sets the location to "Corridor East"; NFC URL path works too', async () => {
  const { ctx, page, errors } = await open('#at-P013');
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  await page.goto(base + '#t/sample-hospital/ground/P014');
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'East Exit');
  const link = await page.evaluate(() => window.DALIL_APP.parseLink('https://dalil.app/t/sample-hospital/ground/P003'));
  assert.deepEqual(link, { b: 'sample-hospital', f: 'ground', at: 'P003' });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('category chip picks the nearest point by route distance', async () => {
  const { ctx, page } = await open('#at-P001');
  await page.click('.chip[data-cat="toilet"]');
  const best = ['P005', 'P006'].sort((a, b) => SAMPLE.routes.walk[`P001>${a}`].distance_m - SAMPLE.routes.walk[`P001>${b}`].distance_m)[0];
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.toId), best);
  await ctx.close();
});

test('Arabic UI is fully RTL and the Arabic steps read correctly', async () => {
  const { ctx, page, errors } = await open();
  await page.click('#btnLang');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.getAttribute('html', 'lang'), 'ar');
  assert.equal(await page.getAttribute('#search', 'placeholder'), 'ابحث عن غرفة أو مكان أو خدمة');
  // Every translated label is Arabic (no English left behind), apart from deliberate Latin like "EN".
  const leftovers = await page.$$eval('[data-i18n]', els => els.map(e => e.textContent.trim()).filter(t => /[A-Za-z]{3,}/.test(t) && !/[؀-ۿ]/.test(t)));
  assert.deepEqual(leftovers, []);
  assert.equal(await page.textContent('#fromName'), 'المدخل الرئيسي');
  // Layout really flips: the search icon sits on the right.
  const [icon, input] = await Promise.all(['.search > .ico', '#search'].map(s => page.locator(s).boundingBox()));
  assert.ok(icon.x > input.x, 'search icon is on the right in RTL');

  await page.fill('#search', 'المصلى');
  await page.click('#results button[data-pick="P007"]');
  assert.equal(await page.textContent('#destName'), 'المصلى');
  await page.click('#btnStart');
  const r = SAMPLE.routes.walk['P001>P007'];
  assert.deepEqual(await steps(page), r.steps.map(s => s.ar));
  assert.equal(await page.textContent('#navStepText'), r.steps[0].ar);
  assert.equal(await page.$eval('#navStepText', e => getComputedStyle(e).direction), 'rtl');
  await page.click('#btnNext');
  assert.equal(await page.textContent('#navStepText'), r.steps[1].ar);
  assert.ok((await page.evaluate(() => window.DALIL_APP.spoken)).includes(r.steps[1].ar));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('works offline after the first visit (service worker)', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).some(r => r.url.includes('dalil-map_sample')));
  await ctx.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await ctx.close();
});
