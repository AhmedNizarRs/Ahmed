// Acceptance test for the DALIL visitor app (docs/visitor-app-spec.md → "Acceptance").
//
// Setup:  npm install            (from dalil-nav/; installs Playwright)
//         npx playwright install chromium
// Run:    npm test               (or: node --test tests/test_visitor_app.mjs)
//
// Serves the project folder on a local port (the app fetches ../data/*.json and registers a service worker,
// so it needs http, not file://) and drives the app in a phone-sized Chromium. Phone sensors are simulated
// with DeviceOrientation/DeviceMotion events, the camera with Chromium's fake camera (and a generated video
// of a DALIL sign's QR code), and the street-map providers by intercepting their requests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dalil-map_sample-hospital_ground.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const SENSORS = ['accelerometer', 'gyroscope', 'magnetometer'];

let server, base, browser, camBrowser, qrBrowser, tmp;
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
  // A camera that films a DALIL sign: the QR code of the tag URL for Corridor East.
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dalil-test-'));
  const y4m = path.join(tmp, 'sign-P013.y4m');
  fs.writeFileSync(y4m, qrVideo(`${base}t/sample-hospital/ground/P013`));
  const fake = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
  camBrowser = await chromium.launch({ args: fake });
  qrBrowser = await chromium.launch({ args: [...fake, `--use-file-for-fake-video-capture=${y4m}`] });
});
after(async () => { await browser?.close(); await camBrowser?.close(); await qrBrowser?.close(); server?.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

// Two frames of 640×480 YUV 4:2:0 with a QR code in the middle (Chromium loops the file).
function qrVideo(text) {
  const qrcode = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'app/vendor/qrcode.js'), 'utf8') + '\n;qrcode', {});
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const W = 640, H = 480, n = q.getModuleCount(), s = Math.floor(400 / (n + 8)), x0 = Math.floor((W - n * s) / 2), y0 = Math.floor((H - n * s) / 2);
  const Y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) for (let dy = 0; dy < s; dy++) Y.fill(16, (y0 + r * s + dy) * W + x0 + c * s, (y0 + r * s + dy) * W + x0 + (c + 1) * s);
  const UV = Buffer.alloc(W * H / 2, 128), frame = Buffer.concat([Buffer.from('FRAME\n'), Y, UV]);
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F5:1 Ip A1:1 C420jpeg\n`), frame, frame]);
}

async function open(hash = '', opts = {}, b = browser) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + hash);
  await page.evaluate(() => window.DALIL_APP.ready);
  return { ctx, page, errors };
}
const steps = page => page.$$eval('#stepList li .s-text', li => li.map(l => l.textContent.trim()));
const pageIs = (page, name) => page.waitForFunction(n => window.DALIL_APP.page() === n, name);
async function search(page, q) { if (await page.isHidden('#pgSearch')) await page.click('#btnSearchOpen'); await page.fill('#search', q); }
async function pick(page, q, key) { await search(page, q); await page.click(`#results button[data-pick="${key}"]`); await pageIs(page, 'route'); }

// A simulated person: holds the phone in front (tilted up `pitch`°), faces along the route, steps at 1.8 Hz.
// BETA = compass bearing of the plan's +y axis in this pretend building. Time is simulated, so it runs fast.
async function walk(page, { seconds = 6, pitch = 60, beta = 25, face = 'route', live = false } = {}) {
  return page.evaluate(async ({ seconds, pitch, beta, face, live }) => {
    const A = window.DALIL_APP, n = A.nav, tr = A.tracker;
    const heading = () => {
      const leg = n.legs[n.steps[n.i].leg], cum = leg.cum, path = leg.route.path; let i = 1;
      while (i < cum.length - 1 && cum[i] <= n.pos + 0.4) i++;
      const th = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]) * 180 / Math.PI;
      return ((90 + beta - th + (face === 'back' ? 180 : 0)) % 360 + 360) % 360;
    };
    const t0 = (window.__simT ||= performance.now());
    for (let k = 0; k < seconds * 50; k++) {
      if (!n.active || !document.querySelector('#arrived').hidden) break;
      const t = t0 + k * 20, H = heading(), alpha = (360 - H) % 360, g = 9.81 + 2.6 * Math.sin(2 * Math.PI * 1.8 * t / 1000);
      if (live) {
        window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta: pitch, gamma: 0, absolute: true }));
        window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: g, z: 0.3 }, interval: 20 }));
        await new Promise(r => setTimeout(r, 20));
      } else { tr.orient({ alpha, beta: pitch, gamma: 0, absolute: true }, true, t); tr.motion({ accelerationIncludingGravity: { x: 0, y: g, z: 0.3 } }, t); }
    }
    window.__simT = t0 + seconds * 1000;
    return { i: n.i, pos: n.pos, mode: n.mode, usable: !!n.follower?.usable, beta: n.follower?.beta ?? null, wrong: !!n.follower?.wrong };
  }, { seconds, pitch, beta, face, live });
}
// Real sensor events for a moment, so the app sees the sensors and switches to tracking.
async function wakeSensors(page) {
  await walk(page, { seconds: 0.4, live: true });
  await page.waitForFunction(() => window.DALIL_APP.nav.mode === 'track');
}

test('sample hospital loads; search "prayer" and navigate step by step: steps match routes.walk["P001>P007"]', async () => {
  const { ctx, page, errors } = await open();
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await pick(page, 'prayer', 'ground|P007');
  assert.equal(await page.textContent('#destName'), 'Prayer Room');
  const r = SAMPLE.routes.walk['P001>P007'];
  assert.equal(await page.textContent('#statDist'), `${Math.round(r.distance_m)} m`);
  assert.ok(await page.isEnabled('#btnStart'));

  await page.click('#btnStart');
  await page.waitForSelector('#nav:not([hidden])');
  assert.deepEqual(await steps(page), r.steps.map(s => s.en));
  // No sensors in this browser: honest step-by-step mode, moved on by Next.
  await page.waitForFunction(() => document.querySelector('#navMode').dataset.mode === 'steps');
  assert.match(await page.textContent('#navModeText'), /Step by step/);
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
  await pageIs(page, 'home');
  assert.equal(await page.textContent('#fromName'), 'Prayer Room');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('motion sensors: the arrow learns the compass from your walk, follows your steps, warns before turns and when going the wrong way', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: SENSORS });
  await pageIs(page, 'route');
  await page.click('#btnStart');
  await wakeSensors(page);
  // No building bearing in this file: the first steps along the route teach the app the compass angle.
  assert.equal(await page.$eval('#navMode', e => e.dataset.mode), 'align');
  let s = await walk(page, { seconds: 4 });
  assert.ok(s.usable, 'calibrated after a few steps');
  assert.ok(Math.abs(s.beta - 25) < 3, `learned beta ≈ 25°, got ${s.beta}`);
  assert.ok(s.pos > 3, `moved along the route: ${s.pos}`);
  await page.waitForFunction(() => document.querySelector('#navMode').dataset.mode === 'follow');
  assert.match(await page.textContent('#navModeText'), /Following your steps/);
  // Facing along the corridor, the big arrow points straight ahead.
  await page.waitForFunction(() => Math.abs(+document.querySelector('#navArrow').dataset.angle) < 15);
  // Turn around and keep walking: "wrong way", and the position does not move on.
  const before = s.pos;
  s = await walk(page, { seconds: 2.5, face: 'back' });
  assert.ok(s.wrong, 'wrong way detected');
  assert.ok(Math.abs(s.pos - before) < 0.8, 'no progress while walking away');
  await page.waitForFunction(() => document.querySelector('#navMode').dataset.mode === 'wrong');
  assert.ok((await page.evaluate(() => window.DALIL_APP.spoken)).some(x => /wrong way/i.test(x)));
  // Back on track: walk to the end. Steps move on by themselves, with a heads-up before each turn.
  s = await walk(page, { seconds: 40 });
  await page.waitForSelector('#arrived:not([hidden])');
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  assert.ok(spoken.some(x => /^In \d+ m: Bear right/.test(x)), 'heads-up before the bend');
  assert.ok(spoken.includes(SAMPLE.routes.walk['P001>P007'].steps.at(-2).en), 'later steps were spoken without tapping Next');
  // What was learned here is kept for next time (this phone, this floor).
  await page.click('#btnArrivedDone');
  const cal = await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.cal')));
  assert.ok(Math.abs(cal['sample-hospital|ground'].beta - 25) < 3);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('camera mode: a yellow guide line is drawn on the floor ahead; it says where to look when the line is out of view', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: [...SENSORS, 'camera'] }, camBrowser);
  await page.click('#btnStartCam');
  await wakeSensors(page);
  await walk(page, { seconds: 4, pitch: 80 });
  await page.waitForFunction(() => window.DALIL_APP.nav.view === 'cam' && document.querySelector('#navCam video').readyState >= 2);
  assert.ok(await page.isVisible('#navCam'));
  assert.ok(await page.isHidden('#navMap'));
  await walk(page, { seconds: 0.5, pitch: 80, live: true });
  await page.waitForFunction(() => window.DALIL_APP.camera().drawn > 5);
  const px = await page.evaluate(() => {
    const c = document.querySelector('#navCam canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let y = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 90) y++;
    return y;
  });
  assert.ok(px > 2000, `yellow ribbon pixels: ${px}`);
  assert.match(await page.textContent('#camNote'), /Guide line/);
  // Face the other way: the line is behind you.
  await walk(page, { seconds: 0.6, pitch: 80, face: 'back', live: true });
  await page.waitForFunction(() => /Turn around/.test(document.querySelector('#camHint').textContent) && !document.querySelector('#camHint').hidden);
  // Back to the map.
  await page.click('#btnViewMap');
  assert.ok(await page.isVisible('#navMap'));
  assert.equal(await page.evaluate(() => window.DALIL_APP.camera().running), false, 'camera released');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('camera mode needs the motion sensors: without them the app explains and stays on the map', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: ['camera'] }, camBrowser);
  await page.click('#btnStartCam');
  await page.waitForFunction(() => window.DALIL_APP.nav.view === 'map' && !window.DALIL_APP.nav.pending, null, { timeout: 5000 });
  assert.match(await page.textContent('#toast'), /Motion access was not allowed|No motion sensors/);
  assert.ok(await page.isVisible('#navMap'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('scan a DALIL sign with the camera: sets where you are; during navigation an off-route sign re-plans the route', async () => {
  const { ctx, page, errors } = await open('', { permissions: [...SENSORS, 'camera'] }, qrBrowser);
  await page.click('#btnScanHome');
  await pageIs(page, 'where');
  await page.waitForFunction(() => window.DALIL_APP.page() === 'home', null, { timeout: 15000 });   // read the sign, went back
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  assert.match(await page.textContent('#toast'), /Confirmed: you are at Corridor East/);
  // Navigate from the main entrance; the camera sees the Corridor East sign, which is not on this route.
  await page.goto(base + '#at-P001&to-P007'); await page.evaluate(() => window.DALIL_APP.ready);
  await page.click('#btnStartCam');
  await wakeSensors(page);
  await page.waitForFunction(() => /New route from Corridor East/.test(document.querySelector('#toast').textContent), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.fromId), 'P013');
  assert.match((await steps(page))[0], /^Start at Corridor East/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('tag steps show "Yes, I\'m at …" and the preview walk reaches the arrival screen', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P008');
  const r = SAMPLE.routes.walk['P001>P008'];
  await page.click('#btnStart');
  const nodeIdx = r.steps.findIndex(s => s.node);
  for (let i = 0; i < nodeIdx; i++) await page.click('#btnNext');
  assert.ok(await page.isVisible('#btnTag'));
  assert.match(await page.textContent('#btnTag'), /Yes, I’m at Corridor East/);
  await page.click('#btnTag');
  assert.equal(await page.textContent('#navStepText'), r.steps[nodeIdx + 1].en);
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.fromId), 'P013');
  await page.click('#btnPrev'); await page.click('#btnPrev'); await page.click('#btnPrev');
  await page.click('#btnSteps');
  await page.click('#btnSim');
  await page.keyboard.press('Escape');
  assert.match(await page.textContent('#navModeText'), /Preview · not your real position/);
  await page.waitForSelector('#arrived:not([hidden])', { timeout: 40_000 });
  assert.equal(await page.textContent('#arrivedName'), 'Pharmacy');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Avoid stairs to Clinic 2 shows "no step-free route"', async () => {
  const { ctx, page, errors } = await open();
  await pick(page, 'clinic 2', 'ground|P010');
  assert.match(await page.textContent('#placeFacts'), /No step-free route/);
  await page.click('#optStepFree');
  assert.ok(await page.isChecked('#optStepFree'));
  assert.match(await page.textContent('#routeMsg'), /no step-free route/i);
  assert.ok(await page.isDisabled('#btnStart'));
  assert.equal(SAMPLE.routes.chair['P001>P010'], undefined);
  await page.click('#optStepFree');
  assert.ok(await page.isEnabled('#btnStart'));
  // A step-free route that exists uses routes.chair.
  await page.click('#optStepFree');
  await page.click('#pgRoute [data-back]');
  await pick(page, 'pharmacy', 'ground|P008');
  assert.equal(await page.textContent('#statDist'), `${Math.round(SAMPLE.routes.chair['P001>P008'].distance_m)} m`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('opening #at-P013 sets the location to "Corridor East"; the NFC/QR URL path works too', async () => {
  const { ctx, page, errors } = await open('#at-P013');
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  await page.goto(base + '#t/sample-hospital/ground/P014');
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'East Exit');
  const link = await page.evaluate(() => window.DALIL_APP.parseLink('https://dalil.app/t/sample-hospital/ground/P003'));
  assert.deepEqual(link, { b: 'sample-hospital', f: 'ground', at: 'P003' });
  // "Where are you?" list
  await page.click('#btnFrom');
  await pageIs(page, 'where');
  await page.fill('#whereFilter', 'lift');
  await page.click('#tagList button[data-where="ground|P003"]');
  await pageIs(page, 'home');
  assert.equal(await page.textContent('#fromName'), 'Lift Lobby');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home tiles pick the nearest place of a kind by route distance', async () => {
  const { ctx, page } = await open('#at-P001');
  const names = await page.$$eval('.tile .tile-name', t => t.map(x => x.textContent));
  assert.deepEqual(names.slice(0, 3), ['Restrooms', 'Elevator', 'Prayer room']);
  await page.click('.tile[data-cat="toilet"]');
  const best = ['P005', 'P006'].sort((a, b) => SAMPLE.routes.walk[`P001>${a}`].distance_m - SAMPLE.routes.walk[`P001>${b}`].distance_m)[0];
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.toKey), `ground|${best}`);
  await pageIs(page, 'route');
  await ctx.close();
});

test('Arabic UI is fully RTL and the Arabic steps read correctly', async () => {
  const { ctx, page, errors } = await open();
  await page.click('#btnLang');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.getAttribute('html', 'lang'), 'ar');
  assert.equal(await page.getAttribute('#search', 'placeholder'), 'رقم الغرفة أو الاسم أو الخدمة');
  // Every translated label is Arabic (no English left behind), apart from the switch back to English.
  const leftovers = await page.$$eval('[data-i18n]', els => els.filter(e => !e.closest('#btnLang')).map(e => e.textContent.trim()).filter(t => /[A-Za-z]{3,}/.test(t) && !/[؀-ۿ]/.test(t)));
  assert.deepEqual(leftovers, []);
  assert.equal(await page.textContent('#fromName'), 'المدخل الرئيسي');
  assert.equal(await page.textContent('.tile[data-cat="toilet"] .tile-name'), 'دورات المياه');
  await page.click('#btnSearchOpen');
  const [icon, input] = await Promise.all(['#pgSearch .search-field > .ico', '#search'].map(s => page.locator(s).boundingBox()));
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
  assert.equal(await page.textContent('#fromName'), 'Main Entrance (South) · Level 1');
  await page.click('#btnFloorMap');
  await pageIs(page, 'map');
  assert.deepEqual(await page.$$eval('.floor-btn', b => b.map(x => x.textContent)), ['2', '1']);
  await page.click('#pgMap [data-back]');
  await pageIs(page, 'home');
  const room = L2.points.find(p => p.nameEn === 'Study Room 216K');
  await pick(page, '216K', `level-2|${room.id}`);
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
  for (let i = 0; i < t; i++) await page.click('#btnNext');
  assert.match(await page.textContent('#btnFloorDone'), /I’m on Level 2 now/);
  await page.click('#btnFloorDone');
  for (let i = t + 1; i < st.length - 1; i++) await page.click('#btnNext');
  await page.waitForSelector('#arrived:not([hidden])');
  await page.click('#btnArrivedDone');
  assert.equal(await page.textContent('#fromName'), 'Study Room 216K · Level 2');
  await page.goto(base + '#f=level-1&b=kennedy-library-cal-poly-test&at-P001');
  await page.evaluate(() => window.DALIL_APP.ready);
  await pick(page, '216K', `level-2|${room.id}`);
  await page.click('#optStepFree');
  assert.match(await page.textContent('#routeVia'), /By lift to Level 2/);
  await page.click('#btnStart');
  st = await steps(page);
  assert.ok(st.some(s => /^Take the lift up to Level 2/.test(s)) && !st.some(s => /stairs/i.test(s)), 'step-free uses the lift');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('floor map: tap anywhere for directions, and save it as My spot', async () => {
  const { ctx, page, errors } = await open('#b=kennedy-library-cal-poly-test&f=level-1&at-P001');
  await page.click('#btnFloorMap');
  await pageIs(page, 'map');
  await page.waitForTimeout(400);
  const findSpot = () => page.evaluate(async () => {
    const { Router } = await import('./router.js');
    const m = window.DALIL_APP.state.map, R = new Router(m), fm = window.DALIL_APP.views().floorMap;
    const r = document.querySelector('#mainMap').getBoundingClientRect(), top = document.querySelector('#pgMap .bar').getBoundingClientRect().bottom + 20;
    const bottom = document.querySelector('#pgMap .map-foot').getBoundingClientRect().top - 20;
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
  scr = await findSpot();
  await page.mouse.click(scr.x, scr.y);
  await page.waitForSelector('#pinCard:not([hidden])');
  await page.click('#btnPinGo');
  await pageIs(page, 'route');
  assert.equal(await page.textContent('#destName'), 'Dropped pin');
  await page.click('#btnStart');
  assert.equal((await steps(page)).at(-1), 'You have arrived at Dropped pin.');
  await page.click('#btnEndNav');
  await pageIs(page, 'route');
  await page.click('#pgRoute [data-back]');
  await pageIs(page, 'map');
  await page.click('#pgMap [data-back]');
  await pageIs(page, 'home');
  assert.match(await page.textContent('#savedList'), /My spot/);
  await pick(page, 'my spot', 'level-1|@spot');
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
  await pick(page, 'pharmacy', 'ground|P008');
  await page.click('#btnShare');
  await page.waitForSelector('#dlgShare[open]');
  assert.ok(await page.$('#shareQR svg'), 'QR code drawn');
  const url = await page.inputValue('#shareUrl');
  const p2 = await ctx.newPage();
  await p2.goto(url); await p2.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await p2.textContent('#destName'), 'Pharmacy');
  assert.equal(await p2.evaluate(() => window.DALIL_APP.state.fromId), 'P013');
  const k = await ctx.newPage();
  await k.goto(base + '#kiosk&at-P003'); await k.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await k.isHidden('#btnFrom'));
  await k.click('#btnSearchOpen'); await k.fill('#search', 'prayer'); await k.click('#results button[data-pick="ground|P007"]');
  assert.ok(await k.isVisible('#kioskQR svg'));
  assert.ok(await k.isHidden('#btnStartCam'), 'no camera on a fixed kiosk');
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

test('home remembers recent places and searches; the phone\'s back button works; settings: theme, language, text size', async () => {
  const { ctx, page, errors } = await open();
  await pick(page, 'pharm', 'ground|P008');
  await page.click('#btnStart');
  await page.click('#btnEndNav');
  await pageIs(page, 'route');
  await page.goBack();                       // the phone's back button
  await pageIs(page, 'search');
  await page.goBack();
  await pageIs(page, 'home');
  assert.ok(await page.isVisible('#secRecent'));
  assert.match(await page.textContent('#recentList'), /Pharmacy/);
  await page.click('#btnSearchOpen');
  assert.match(await page.textContent('#recentSearches'), /pharm/);
  await page.click('#btnSearchBack');
  await pageIs(page, 'home');
  await page.click('#btnSettings');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'light is the default');
  await page.click('input[name="theme"][value="dark"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  // Extra large text: everything scales, buttons included.
  const h0 = await page.$eval('#pgSettings [data-back]', e => e.getBoundingClientRect().height);
  await page.click('input[name="textSize"][value="xl"]');
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('ts-xl')));
  const h1 = await page.$eval('#pgSettings [data-back]', e => e.getBoundingClientRect().height);
  assert.ok(h1 > h0 * 1.25, `buttons grow with the text: ${h0} → ${h1}`);
  await page.click('input[name="lang"][value="ar"]');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await page.click('#pgSettings [data-back]');
  await pageIs(page, 'home');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.settings')));
  assert.equal(stored.textSize, 'xl'); assert.equal(stored.theme, 'dark');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every button is at least 48 px and text is readable (contrast) on the main screens', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007');
  const check = async scope => page.evaluate(sc => {
    const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/rgba\(.*, 0\)$/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
    const small = [], low = [];
    for (const el of document.querySelectorAll(`${sc} button, ${sc} a.btn, ${sc} input[type=search]`)) {
      const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden]')) continue;
      if (el.closest('.mk')) continue;
      if (Math.min(r.width, r.height) < 47.5) small.push(`${el.id || el.className} ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
      const fg = getComputedStyle(el).color, L1 = lum(fg), L2 = lum(bgOf(el)), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      if (el.textContent.trim() && !el.disabled && ratio < 4.5) low.push(`${el.id || el.className} ${ratio.toFixed(2)}`);
    }
    return { small, low };
  }, scope);
  for (const sc of ['#pgRoute']) { const r = await check(sc); assert.deepEqual(r.small, [], `small targets on ${sc}`); assert.deepEqual(r.low, [], `low contrast on ${sc}`); }
  await page.click('#pgRoute [data-back]'); await pageIs(page, 'home');
  const h = await check('#pgHome'); assert.deepEqual(h.small, []); assert.deepEqual(h.low, []);
  await pick(page, 'prayer', 'ground|P007');
  await page.click('#btnStart');
  const n = await check('#nav'); assert.deepEqual(n.small, []); assert.deepEqual(n.low, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('help: no made-up phone number; with the building\'s number it offers a call, and a card to show staff in both languages', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007');
  await page.click('#pgRoute [data-help]');
  await page.waitForSelector('#dlgHelp[open]');
  assert.ok(await page.isHidden('#helpCall'), 'no number in config → no call button');
  await page.click('#helpShow');
  const card = await page.textContent('#staffCard');
  assert.match(card, /I need help finding my way/); assert.match(card, /Main Entrance/); assert.match(card, /Prayer Room/);
  assert.match(card, /أحتاج مساعدة/); assert.match(card, /المصلى/);
  await page.click('#helpDesk');
  await page.waitForFunction(() => window.DALIL_APP.state.toKey === 'ground|P002');   // Reception
  await ctx.close();
  // An institution that fills in its number.
  const c2 = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const p2 = await c2.newPage();
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/config.json'), 'utf8')); cfg.help.phone = '+971 6 000 0000';
  await p2.route('**/config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg) }));
  await p2.goto(base); await p2.evaluate(() => window.DALIL_APP.ready);
  await p2.click('#pgHome [data-help]');
  assert.ok(await p2.isVisible('#helpCall'));
  assert.equal(await p2.getAttribute('#helpCall', 'href'), 'tel:+97160000000');
  assert.match(await p2.textContent('#helpCall'), /Call Reception · \+971 6 000 0000/);
  assert.deepEqual(errors, []);
  await c2.close();
});

test('institution usage counts: off by default; when configured, anonymous events are sent (no personal data)', async () => {
  const { ctx, page } = await open('#at-P001&to-P007');
  assert.equal(await page.evaluate(() => window.DALIL_APP.analytics.q.length), 0, 'nothing collected without an endpoint');
  await ctx.close();
  const c2 = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const p2 = await c2.newPage();
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/config.json'), 'utf8')); cfg.analytics.endpoint = 'https://stats.example.org/dalil';
  await p2.route('**/config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg) }));
  const posted = [];
  await p2.route('https://stats.example.org/**', r => { posted.push(r.request().postData()); r.fulfill({ status: 204 }); });
  await p2.goto(base); await p2.evaluate(() => window.DALIL_APP.ready);
  await p2.click('#btnSearchOpen'); await p2.fill('#search', 'xyzzy');
  await p2.waitForTimeout(1700);   // a search that finds nothing is counted (after a pause in typing)
  await p2.fill('#search', 'prayer'); await p2.click('#results button[data-pick="ground|P007"]');
  await p2.click('#btnStart');
  await p2.evaluate(() => window.DALIL_APP.analytics.flush());
  await p2.waitForTimeout(300);
  const events = (await p2.evaluate(() => window.DALIL_APP.analytics.sent)).flatMap(b => JSON.parse(b).events);
  const kinds = events.map(e => e.e);
  for (const k of ['open', 'search_none', 'route', 'nav_start']) assert.ok(kinds.includes(k), k);
  assert.equal(events.find(e => e.e === 'search_none').q, 'xyzzy');
  assert.equal(events.find(e => e.e === 'route').to, 'P007');
  for (const e of events) { assert.deepEqual(Object.keys(e).filter(k => /id|user|device|lat|lng|ip/i.test(k) && k !== 'to'), []); assert.equal(e.t % 3.6e6, 0, 'time rounded to the hour'); }
  await c2.close();
});

test('Getting here: the floor plan on a street map; providers fail over (OpenFreeMap → VersaTiles → plain map)', async () => {
  const opts = { ...devices['Pixel 7'], serviceWorkers: 'block', geolocation: { latitude: 35.3001, longitude: -120.6620 }, permissions: ['geolocation'] };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  // OpenFreeMap is down; VersaTiles answers with a (minimal) style.
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 503, body: 'down' }));
  await page.route('https://tiles.versatiles.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3efe6' } }] }) }));
  await page.goto(base); await page.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await page.isHidden('#btnGettingHere'), 'only buildings with a world position offer it');
  await page.goto(base + '#b=kennedy-library-cal-poly-test&f=level-1&at-P001'); await page.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await page.isVisible('#btnGettingHere'));
  await page.waitForFunction(() => /away/.test(document.querySelector('#ghSub').textContent));   // location already allowed → distance
  await page.click('#btnGettingHere');
  await page.waitForFunction(() => window.DALIL_APP.outdoor());
  const o = await page.evaluate(() => { const c = window.DALIL_APP.outdoor(); return { provider: c.provider.id, failed: c.failed, target: c.target, layers: c.map.getStyle().layers.map(l => l.id), walls: c.geojson.walls.features.length }; });
  assert.equal(o.provider, 'versatiles'); assert.deepEqual(o.failed, ['OpenFreeMap']);
  assert.match(await page.textContent('#outStatus'), /OpenFreeMap didn’t load, so this is VersaTiles/);
  for (const id of ['outline-fill', 'walls', 'entr-ring', 'me-dot']) assert.ok(o.layers.includes(id), id);
  assert.ok(o.walls > 1000);
  // Main entrance of Kennedy Library from the survey-coordinate CAD: 35.30158, -120.66358 (±1e-4 ≈ 10 m).
  assert.ok(Math.abs(o.target[1] - 35.30158) < 1e-4 && Math.abs(o.target[0] + 120.66358) < 1e-4, JSON.stringify(o.target));
  assert.match(await page.getAttribute('#lnkGmaps', 'href'), /destination=35\.3015\d+,-120\.6635\d+&travelmode=walking/);
  await page.click('#btnMyLoc');
  await page.waitForFunction(() => /from the main entrance/.test(document.querySelector('#outStatus').textContent));
  // Keyed providers only appear when the building has a key.
  const opts1 = await page.$$eval('#outProvider option', o => o.map(x => x.value));
  assert.deepEqual(opts1, ['auto', 'openfreemap', 'versatiles', 'plain']);
  // Both free maps down: the plain map still shows the building and says why.
  await page.route('https://tiles.versatiles.org/**', r => r.fulfill({ status: 503, body: 'down' }));
  await page.selectOption('#outProvider', 'versatiles');
  await page.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'plain');
  assert.match(await page.textContent('#outStatus'), /needs an internet connection/);
  await page.click('#pgOutdoor [data-back]');
  await pageIs(page, 'home');
  assert.deepEqual(errors, []);
  await ctx.close();
  // A building with a Mapbox key: offered, and if its tiles fail the map moves on to the next provider.
  const c3 = await browser.newContext(opts); const p3 = await c3.newPage();
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/config.json'), 'utf8')); cfg.maps.keys.mapbox = 'pk.test'; cfg.maps.order = ['mapbox', 'versatiles'];
  await p3.route('**/config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg) }));
  await p3.route('https://api.mapbox.com/**', r => r.fulfill({ status: 401, body: 'bad key' }));
  await p3.route('https://tiles.versatiles.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3efe6' } }] }) }));
  await p3.goto(base + '#b=kennedy-library-cal-poly-test&f=level-1&at-P001'); await p3.evaluate(() => window.DALIL_APP.ready);
  await p3.click('#btnGettingHere');
  await p3.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'versatiles', null, { timeout: 20000 });
  assert.match(await p3.textContent('#outStatus'), /Mapbox didn’t load, so this is VersaTiles/);
  assert.ok((await p3.$$eval('#outProvider option', o => o.map(x => x.value))).includes('mapbox-satellite'));
  await c3.close();
});

test('works offline after the first visit (service worker)', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).some(r => r.url.includes('dalil-map_sample')));
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map(r => new URL(r.url).pathname));
  for (const f of ['tracker.js', 'camera.js', 'providers.js', 'vendor/jsqr/jsQR.js', 'config.json']) assert.ok(cached.some(u => u.endsWith(f)), `cached ${f}`);
  await ctx.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await ctx.close();
});
