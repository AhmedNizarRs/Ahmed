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
  await page.click('#results button[data-pick="ground|P007"]');
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
  await page.fill('#search', 'clinic 2');
  await page.click('#results button[data-pick="ground|P010"]');
  // The place card already says there is no step-free route, before the switch is on.
  assert.match(await page.textContent('#placeFacts'), /No step-free route/);
  await page.click('#optStepFree');
  assert.ok(await page.isChecked('#optStepFree'));
  assert.match(await page.textContent('#routeMsg'), /no step-free route/i);
  assert.ok(await page.isDisabled('#btnStart'));
  assert.equal(SAMPLE.routes.chair['P001>P010'], undefined);
  // Walking route still exists once step-free is off.
  await page.click('#optStepFree');
  assert.ok(await page.isEnabled('#btnStart'));
  // A step-free route that exists uses routes.chair.
  await page.click('#optStepFree');
  await page.click('#btnClosePlace');
  await page.fill('#search', 'pharmacy');
  await page.click('#results button[data-pick="ground|P008"]');
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
  await page.click('.cat[data-cat="toilet"]');
  const best = ['P005', 'P006'].sort((a, b) => SAMPLE.routes.walk[`P001>${a}`].distance_m - SAMPLE.routes.walk[`P001>${b}`].distance_m)[0];
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.toKey), `ground|${best}`);
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
  const [icon, input] = await Promise.all(['.search-field > .ico', '#search'].map(s => page.locator(s).boundingBox()));
  assert.ok(icon.x > input.x, 'search icon is on the right in RTL');

  await page.fill('#search', 'المصلى');
  await page.click('#results button[data-pick="ground|P007"]');
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

test('test building (Kennedy Library): routes between floors by stairs, or by lift when step-free (routed on the phone)', async () => {
  const L1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-1.json'), 'utf8'));
  const L2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-2.json'), 'utf8'));
  assert.ok(L1.nav && !Object.keys(L1.routes.walk).length, 'compact v2 file: grid, no stored routes');
  const { ctx, page, errors } = await open('#b=kennedy-library-cal-poly-test&f=level-1&at-P001');
  assert.equal(await page.textContent('#fromName'), 'Main Entrance (South)');
  assert.deepEqual(await page.$$eval('.floor-btn', b => b.map(x => x.textContent)), ['2', '1']);
  const room = L2.points.find(p => p.nameEn === 'Study Room 216K');
  await page.fill('#search', '216K');
  await page.click(`#results button[data-pick="level-2|${room.id}"]`);
  assert.match(await page.textContent('#destMeta'), /Level 2/);
  assert.ok(await page.isEnabled('#btnStart'));
  await page.click('#btnStart');
  let st = await steps(page);
  const t = st.findIndex(s => /^Take the (stairs|lift) up to Level 2/.test(s));
  assert.ok(t > 0, 'has a floor change step');
  assert.equal(st[0], 'Start at Main Entrance (South) (DALIL node).');
  assert.equal(st.at(-1), 'You have arrived at Study Room 216K.');
  const plan = await page.evaluate(() => { const v = window.DALIL_APP.nav.plan.via; return { pa: v.pa.id, pb: v.pb.id }; });
  assert.equal(L1.points.find(p => p.id === plan.pa).link, L2.points.find(p => p.id === plan.pb).link);
  for (let i = 0; i < st.length - 1; i++) await page.click('#btnNext');
  await page.waitForSelector('#arrived:not([hidden])');
  await page.click('#btnArrivedDone');
  assert.equal(await page.textContent('#fromName'), 'Study Room 216K');
  await page.goto(base + '#f=level-1&b=kennedy-library-cal-poly-test&at-P001');
  await page.evaluate(() => window.DALIL_APP.ready);
  await page.fill('#search', '216K');
  await page.click(`#results button[data-pick="level-2|${room.id}"]`);
  await page.click('#optStepFree');
  assert.match(await page.textContent('#routeVia'), /By lift to Level 2/);
  await page.click('#btnStart');
  st = await steps(page);
  assert.ok(st.some(s => /^Take the lift up to Level 2/.test(s)) && !st.some(s => /stairs/i.test(s)), 'step-free uses the lift');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('tap anywhere on the map for directions, and save it as My spot', async () => {
  const { ctx, page, errors } = await open('#b=kennedy-library-cal-poly-test&f=level-1&at-P001');
  await page.waitForTimeout(500);
  // A walkable spot near the Gallery that is on the visible map itself (not under the panel or a place dot).
  const findSpot = () => page.evaluate(async () => {
    const { Router } = await import('./router.js');
    const m = window.DALIL_APP.state.map, R = new Router(m), fm = window.DALIL_APP.views().floorMap;
    const r = document.querySelector('#mainMap').getBoundingClientRect(), top = document.querySelector('.topbar').getBoundingClientRect().bottom + 20;
    const bottom = document.querySelector('#sheet').getBoundingClientRect().top - 20;
    for (let y = top; y < bottom; y += 23) for (let x = r.left + 30; x < r.right - 90; x += 23) {
      const el = document.elementFromPoint(x, y); if (!el || !el.closest('#mainMap') || el.closest('.mk')) continue;
      const p = fm.screenToPlan(x, y); if (R.walkable(p.x, p.y) && R.distance('walk', m.points[0], p) != null) return { x, y };
    }
  });
  let scr = await findSpot();
  assert.ok(scr, 'found an open spot');
  await page.mouse.click(scr.x, scr.y);
  await page.waitForSelector('#pinCard:not([hidden])');
  await page.click('#btnPinSave');
  assert.match(await page.textContent('#toast'), /Saved as your spot/);
  await page.waitForTimeout(500);   // the panel and map settle back to the home view
  scr = await findSpot();
  await page.mouse.click(scr.x, scr.y);
  await page.waitForSelector('#pinCard:not([hidden])');
  await page.click('#btnPinGo');
  assert.equal(await page.textContent('#destName'), 'Dropped pin');
  assert.ok(await page.isEnabled('#btnStart'));
  await page.click('#btnStart');
  assert.equal((await steps(page)).at(-1), 'You have arrived at Dropped pin.');
  await page.click('#btnEndNav');
  // My spot is in Saved (on home) and in search.
  await page.click('#btnClosePlace');
  assert.match(await page.textContent('#savedList'), /My spot/);
  await page.fill('#search', 'my spot');
  await page.click('#results button[data-pick="level-1|@spot"]');
  assert.equal(await page.textContent('#destName'), 'My spot');
  assert.ok(await page.isEnabled('#btnStart'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a temporary closure makes the route go around it', async () => {
  const { ctx, page, errors } = await open();
  const r = await page.evaluate(async () => {
    const { Router } = await import('./router.js');
    const m = window.DALIL_APP.state.maps.find(x => x.building.id === 'sample-hospital');
    const A = m.points.find(p => p.id === 'P001'), B = m.points.find(p => p.id === 'P007');
    const before = new Router(m).route('walk', A, B);
    // Close the corridor across the middle of the first leg, 8 m wide.
    const [a, b] = before.path, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    const closed = { ...m, closures: [{ id: 'C01', a: [mx - nx * 4, my - ny * 4], b: [mx + nx * 4, my + ny * 4], width_m: 0.6 }] };
    const after = new Router(closed).route('walk', A, B);
    const crosses = (p, q, c, d) => { const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); return o(p, q, c) !== o(p, q, d) && o(c, d, p) !== o(c, d, q); };
    const hit = after ? after.path.some((p, i) => i && crosses(after.path[i - 1], p, closed.closures[0].a, closed.closures[0].b)) : null;
    return { before: before.distance_m, after: after?.distance_m ?? null, hit };
  });
  assert.ok(r.after === null || (r.after > r.before && r.hit === false), JSON.stringify(r));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('share a route as a link and QR code; the link reopens the same route; kiosk mode', async () => {
  const { ctx, page, errors } = await open('#at-P013');
  await page.fill('#search', 'pharmacy');
  await page.click('#results button[data-pick="ground|P008"]');
  await page.click('#btnShare');
  await page.waitForSelector('#dlgShare[open]');
  assert.ok(await page.$('#shareQR svg'), 'QR code drawn');
  const url = await page.inputValue('#shareUrl');
  const p2 = await ctx.newPage();
  await p2.goto(url); await p2.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await p2.textContent('#fromName'), 'Corridor East');
  assert.equal(await p2.textContent('#destName'), 'Pharmacy');
  // Kiosk: fixed location, no "Change", QR to continue on a phone.
  const k = await ctx.newPage();
  await k.goto(base + '#kiosk&at-P003'); await k.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await k.isHidden('#btnFrom'));
  await k.fill('#search', 'prayer'); await k.click('#results button[data-pick="ground|P007"]');
  assert.ok(await k.isVisible('#kioskQR svg'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('loading failure shows a retry screen, and retry recovers', async () => {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route('**/maps.json', r => r.fulfill({ status: 503, body: 'down' }));
  await page.goto(base);
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await page.isVisible('#bootError'));
  assert.match(await page.textContent('#bootError'), /Couldn’t load the building map/);
  await page.unroute('**/maps.json');
  await page.click('#btnRetry');
  await page.waitForSelector('#boot', { state: 'hidden' });
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await ctx.close();
});

test('home remembers recent places and searches; theme and language switch from settings', async () => {
  const { ctx, page, errors } = await open();
  await page.fill('#search', 'pharm');
  await page.click('#results button[data-pick="ground|P008"]');
  await page.click('#btnStart');
  await page.click('#btnEndNav');
  await page.click('#btnClosePlace');
  assert.ok(await page.isVisible('#secRecent'));
  assert.match(await page.textContent('#recentList'), /Pharmacy/);
  await page.click('#search');
  assert.match(await page.textContent('#recentSearches'), /pharm/);
  await page.click('#btnSearchBack');
  await page.click('#btnSettings');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.check('input[name="theme"][value="light"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  await page.check('input[name="lang"][value="ar"]');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await page.click('#btnSettingsBack');
  assert.ok(await page.isHidden('#settings'));
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
