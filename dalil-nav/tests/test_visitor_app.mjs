// Acceptance test for the DALIL visitor app (docs/visitor-app-spec.md → "Acceptance").
//
// Setup:  npm install            (from dalil-nav/; installs Playwright)
//         npx playwright install chromium
// Run:    npm test               (or: node --test tests/test_visitor_app.mjs)
//
// Serves the project folder on a local port (the app fetches ../data/*.json and registers a service worker,
// so it needs http, not file://) and drives the app in a phone-sized Chromium. There is no "Next" button:
// directions move with the person, so every walk here is simulated through the phone's sensors
// (DeviceOrientation/DeviceMotion), including floor changes by stairs and by lift. The camera is Chromium's
// fake camera (and a generated video of a DALIL sign's QR code); map providers are stubbed to test failover.
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
const KENNEDY = '#b=kennedy-library-cal-poly-test&f=level-1&at-P001';

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

// A simulated person holding the phone in front (tilted `pitch`°), facing along the route, walking at 1.8 steps/s.
// beta = the compass bearing of the plan's +y axis in this pretend building ('geo' = what the map file says).
// mode 'still' = standing (no steps), with an optional lift ride felt by the accelerometer.
// Time is simulated (fast) unless live, which sends real browser events.
async function walk(page, { seconds = 6, pitch = 60, beta = 25, face = 'route', live = false, mode = 'walk', lift = false, until = null } = {}) {
  return page.evaluate(async ({ seconds, pitch, beta, face, live, mode, lift, until }) => {
    const A = window.DALIL_APP, n = A.nav, tr = A.tracker, stop = until ? new Function('nav', `return (${until})`) : () => false;
    const heading = () => {
      const leg = n.legs[n.steps[n.i].leg], cum = leg.cum, path = leg.route.path; let i = 1;
      while (i < cum.length - 1 && cum[i] <= n.pos + 0.4) i++;
      const B = beta === 'geo' ? leg.map.geo.bearing : beta;
      const th = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]) * 180 / Math.PI;
      return ((90 + B - th + (face === 'back' ? 180 : 0)) % 360 + 360) % 360;
    };
    const t0 = (window.__simT ||= performance.now());
    let k = 0;
    for (; k < seconds * 50; k++) {
      if (!n.active || !document.querySelector('#arrived').hidden || stop(n)) break;
      const t = t0 + k * 20, H = heading(), alpha = (360 - H) % 360, u = k * 20;
      const g = mode === 'walk' ? 9.81 + 2.6 * Math.sin(2 * Math.PI * 1.8 * t / 1000)
        : 9.81 + (lift && u > 2000 && u < 3500 ? 0.8 : lift && u > seconds * 1000 - 3500 && u < seconds * 1000 - 2000 ? -0.8 : 0);
      if (live) {
        window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta: pitch, gamma: 0, absolute: true }));
        window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: g, z: 0.3 }, interval: 20 }));
        await new Promise(r => setTimeout(r, 20));
      } else { tr.orient({ alpha, beta: pitch, gamma: 0, absolute: true }, true, t); tr.motion({ accelerationIncludingGravity: { x: 0, y: g, z: 0.3 } }, t); }
    }
    window.__simT = t0 + k * 20;
    return { i: n.i, kind: n.steps[n.i]?.kind, leg: n.steps[n.i]?.leg, pos: n.pos, mode: n.mode, usable: !!n.follower?.usable, beta: n.follower?.beta ?? null, wrong: !!n.follower?.wrong };
  }, { seconds, pitch, beta, face, live, mode, lift, until });
}
// Real sensor events for a moment, so the app sees the sensors and starts following.
async function wakeSensors(page, beta = 25, pitch = 60) {
  await walk(page, { seconds: 0.4, live: true, beta, pitch });
  await page.waitForFunction(() => window.DALIL_APP.nav.mode === 'track');
}

test('sample hospital: search "prayer", start, and the directions move with you to the end (no Next button)', async () => {
  const { ctx, page, errors } = await open('', { permissions: SENSORS });
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await pick(page, 'prayer', 'ground|P007');
  assert.equal(await page.textContent('#destName'), 'Prayer Room');
  const r = SAMPLE.routes.walk['P001>P007'];
  assert.equal(await page.textContent('#statDist'), String(Math.round(r.distance_m)));
  await page.click('#btnStart');
  await page.waitForSelector('#nav:not([hidden])');
  assert.equal(await page.$('#btnNext'), null, 'there is no Next button');
  assert.deepEqual(await steps(page), r.steps.map(s => s.en));
  await wakeSensors(page);
  await walk(page, { seconds: 60 });
  await page.waitForSelector('#arrived:not([hidden])');
  assert.equal(await page.textContent('#arrivedName'), 'Prayer Room');
  // Every step was announced as the walker reached it, in order.
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  let at = -1;
  for (const s of r.steps) { const j = spoken.findIndex((x, i) => i > at && x.includes(s.en)); assert.ok(j > at, `spoken in order: ${s.en}`); at = j; }
  await page.click('#btnArrivedDone');
  await pageIs(page, 'home');
  assert.equal(await page.textContent('#fromName'), 'Prayer Room');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('moving arrow: learns the compass from your walk, counts down to the next turn, warns before turns and when going the wrong way', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: SENSORS });
  await pageIs(page, 'route');
  await page.click('#btnStart');
  await wakeSensors(page);
  assert.equal(await page.$eval('#navMode', e => e.dataset.mode), 'align');
  let s = await walk(page, { seconds: 4 });
  assert.ok(s.usable, 'calibrated after a few steps');
  assert.ok(Math.abs(s.beta - 25) < 3, `learned beta ≈ 25°, got ${s.beta}`);
  assert.ok(s.pos > 3, `moved along the route: ${s.pos}`);
  await page.waitForFunction(() => document.querySelector('#navMode').dataset.mode === 'follow');
  assert.match(await page.textContent('#navModeText'), /Following your steps/);
  await page.waitForFunction(() => Math.abs(+document.querySelector('#navArrow').dataset.angle) < 15);
  // The display counts down to the next turn: "N m · Bear right".
  assert.match(await page.textContent('#hudDist'), /^\d+m$/);
  assert.equal(await page.textContent('#navStepText'), 'Bear right');
  const d1 = parseInt(await page.textContent('#hudDist'), 10);
  await walk(page, { seconds: 1.5 });
  assert.ok(parseInt(await page.textContent('#hudDist'), 10) < d1, 'distance counts down as you walk');
  // Turn around and keep walking: "wrong way", and no progress.
  const before = (await walk(page, { seconds: 0 })).pos;
  s = await walk(page, { seconds: 2.5, face: 'back' });
  assert.ok(s.wrong, 'wrong way detected');
  assert.ok(Math.abs(s.pos - before) < 0.8, 'no progress while walking away');
  await page.waitForFunction(() => document.querySelector('#navMode').dataset.mode === 'wrong');
  assert.ok(await page.$eval('#hudCard', e => e.classList.contains('wrong')));
  assert.ok((await page.evaluate(() => window.DALIL_APP.spoken)).some(x => /wrong way/i.test(x)));
  s = await walk(page, { seconds: 40 });
  await page.waitForSelector('#arrived:not([hidden])');
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  assert.ok(spoken.some(x => /^In \d+ m: Bear right/.test(x)), 'heads-up before the bend');
  await page.click('#btnArrivedDone');
  const cal = await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.cal')));
  assert.ok(Math.abs(cal['sample-hospital|ground'].beta - 25) < 3, 'what was learned is kept for next time');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('motion off: the app says so (never "tap Next"), offers Allow motion, signs only, or a labelled preview', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P008');   // no sensor permission in this browser
  await page.click('#btnStart');
  await page.waitForSelector('#motionCard:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#motionCard'), /Turn on motion/);
  assert.match(await page.textContent('#motionBody'), /Motion is off, so DALIL can’t follow your steps/);
  assert.ok(await page.isVisible('#btnAllowMotion'));
  assert.equal(await page.$('#btnNext'), null);
  assert.doesNotMatch(await page.textContent('#nav'), /tap Next/i);
  // Signs only: the card goes; the status says motion is off.
  await page.click('#btnSignsOnly');
  assert.ok(await page.isHidden('#motionCard'));
  assert.match(await page.textContent('#navModeText'), /Motion is off/);
  // Preview: clearly labelled, walks to the end by itself.
  await page.click('#btnSteps');
  await page.click('#btnSim');
  assert.match(await page.textContent('#navModeText'), /Preview · not your real position/);
  await page.waitForSelector('#arrived:not([hidden])', { timeout: 40_000 });
  assert.equal(await page.textContent('#arrivedName'), 'Pharmacy');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('walking past a DALIL sign on the route needs no tap; scanning one confirms the position', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P008', { permissions: SENSORS });
  const r = SAMPLE.routes.walk['P001>P008'], node = r.steps.find(s => s.node);
  await page.click('#btnStart');
  await wakeSensors(page);
  await walk(page, { seconds: 60 });
  await page.waitForSelector('#arrived:not([hidden])');
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  assert.ok(spoken.some(x => x.includes(node.en)), 'the sign step was announced as you passed it');
  assert.equal(await page.textContent('#arrivedName'), 'Pharmacy');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('camera mode: a blue guide line on the floor ahead; it says where to look when the line is out of view', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: [...SENSORS, 'camera'] }, camBrowser);
  await page.click('#btnStartCam');
  await wakeSensors(page, 25, 80);
  // The line needs the plan lined up with the compass: about five steps along a straight bit.
  const w = await walk(page, { seconds: 10, pitch: 80, until: 'nav.follower?.usable' });
  assert.ok(w.usable, 'tracking lined up after a few steps');
  await page.waitForFunction(() => window.DALIL_APP.nav.view === 'cam' && document.querySelector('#navCam video').readyState >= 2);
  assert.ok(await page.isVisible('#navCam'));
  assert.equal(await page.getAttribute('#btnView', 'aria-pressed'), 'true');
  await walk(page, { seconds: 0.5, pitch: 80, live: true });
  await page.waitForFunction(() => window.DALIL_APP.camera().drawn > 5);
  const px = await page.evaluate(() => {
    const c = document.querySelector('#navCam canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let y = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && d[i + 2] > 180 && d[i] < 90 && d[i + 1] < 160) y++;   // the blue ribbon
    return y;
  });
  assert.ok(px > 2000, `blue ribbon pixels: ${px}`);
  assert.match(await page.textContent('#camNote'), /Guide line/);
  await walk(page, { seconds: 0.6, pitch: 80, face: 'back', live: true });
  await page.waitForFunction(() => /Turn around/.test(document.querySelector('#camHint').textContent) && !document.querySelector('#camHint').hidden);
  await page.click('#btnView');
  assert.ok(await page.isVisible('#navMap'));
  assert.equal(await page.evaluate(() => window.DALIL_APP.camera().running), false, 'camera released');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('camera without motion: the camera still opens (it reads signs) and the app explains there is no guide line', async () => {
  const { ctx, page, errors } = await open('#at-P001&to-P007', { permissions: ['camera'] }, camBrowser);
  await page.click('#btnStartCam');
  await page.waitForSelector('#motionCard:not([hidden])', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#navCam video').readyState >= 2);
  assert.match(await page.textContent('#camNote'), /Motion is off/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('scan a DALIL sign with the camera: sets where you are; during navigation an off-route sign re-plans the route', async () => {
  const { ctx, page, errors } = await open('', { permissions: [...SENSORS, 'camera'] }, qrBrowser);
  await page.click('#btnScanHome');
  await pageIs(page, 'where');
  await page.waitForFunction(() => window.DALIL_APP.page() === 'home', null, { timeout: 15000 });
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  assert.match(await page.textContent('#toast'), /Confirmed: you are at Corridor East/);
  await page.goto(base + '#at-P001&to-P007'); await page.evaluate(() => window.DALIL_APP.ready);
  await page.click('#btnStartCam');
  await wakeSensors(page);
  await page.waitForFunction(() => /New route from Corridor East/.test(document.querySelector('#toast').textContent), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.fromId), 'P013');
  assert.match((await steps(page))[0], /^Start at Corridor East/);
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
  await page.click('#optStepFree');
  await page.click('#pgRoute [data-back]');
  await pick(page, 'pharmacy', 'ground|P008');
  assert.equal(await page.textContent('#statDist'), String(Math.round(SAMPLE.routes.chair['P001>P008'].distance_m)));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('opening #at-P013 sets the location to "Corridor East"; the NFC/QR URL path works too; "Where are you?" list', async () => {
  const { ctx, page, errors } = await open('#at-P013');
  assert.equal(await page.textContent('#fromName'), 'Corridor East');
  await page.goto(base + '#t/sample-hospital/ground/P014');
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'East Exit');
  const link = await page.evaluate(() => window.DALIL_APP.parseLink('https://dalil.app/t/sample-hospital/ground/P003'));
  assert.deepEqual(link, { b: 'sample-hospital', f: 'ground', at: 'P003' });
  await page.click('#btnFrom');
  await pageIs(page, 'where');
  await page.fill('#whereFilter', 'lift');
  await page.click('#tagList button[data-where="ground|P003"]');
  await pageIs(page, 'home');
  assert.equal(await page.textContent('#fromName'), 'Lift Lobby');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home tiles pick the nearest place of a kind by route distance; the hologram shows your floor', async () => {
  const { ctx, page } = await open('#at-P001');
  const names = await page.$$eval('.tile .tile-name', t => t.map(x => x.textContent));
  assert.deepEqual(names.slice(0, 3), ['Restrooms', 'Elevator', 'Prayer room']);
  assert.ok(await page.$('#homeMap .you-dot'), 'your beacon on the hologram');
  await page.click('.tile[data-cat="toilet"]');
  const best = ['P005', 'P006'].sort((a, b) => SAMPLE.routes.walk[`P001>${a}`].distance_m - SAMPLE.routes.walk[`P001>${b}`].distance_m)[0];
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.toKey), `ground|${best}`);
  await pageIs(page, 'route');
  await ctx.close();
});

test('Arabic UI is fully RTL and the Arabic steps read correctly', async () => {
  const { ctx, page, errors } = await open('', { permissions: SENSORS });
  await page.click('#btnLang');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.getAttribute('html', 'lang'), 'ar');
  assert.equal(await page.getAttribute('#search', 'placeholder'), 'رقم الغرفة أو الاسم أو الخدمة');
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
  assert.equal(await page.$eval('#navStepText', e => getComputedStyle(e).direction), 'rtl');
  assert.equal(await page.textContent('#navStepText'), r.steps[1].ar.split('، ثم')[0]);
  await wakeSensors(page);
  await walk(page, { seconds: 8 });
  const spoken = await page.evaluate(() => window.DALIL_APP.spoken);
  assert.ok(spoken.includes(r.steps[0].ar) && spoken.some(x => x.includes(r.steps[1].ar)), 'Arabic steps spoken');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Kennedy Library: up the stairs to Level 2 without a tap (the staircase steps are counted), then on to the room', async () => {
  const L1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-1.json'), 'utf8'));
  const L2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-2.json'), 'utf8'));
  assert.ok(L1.nav && !Object.keys(L1.routes.walk).length, 'compact v2 file: grid, no stored routes');
  const { ctx, page, errors } = await open(KENNEDY, { permissions: SENSORS });
  assert.equal(await page.textContent('#fromName'), 'Main Entrance (South) · Level 1');
  await page.click('#btnFloorMap');
  await pageIs(page, 'map');
  assert.deepEqual(await page.$$eval('.floor-btn', b => b.map(x => x.textContent)), ['2', '1']);
  await page.click('#pgMap [data-back]');
  await pageIs(page, 'home');
  const room = L2.points.find(p => p.nameEn === 'Study Room 216K');
  await pick(page, '216K', `level-2|${room.id}`);
  assert.match(await page.textContent('#destMeta'), /Level 2/);
  await page.click('#btnStart');
  const st = await steps(page);
  assert.ok(st.some(s => /^Take the stairs up to Level 2/.test(s)), 'walking route uses the stairs');
  const plan = await page.evaluate(() => { const v = window.DALIL_APP.nav.plan.via; return { pa: v.pa.id, pb: v.pb.id }; });
  assert.equal(L1.points.find(p => p.id === plan.pa).link, L2.points.find(p => p.id === plan.pb).link);
  await wakeSensors(page, 'geo');
  // The building's own bearing (geo) lines the arrow up from the first step.
  assert.ok(await page.evaluate(() => window.DALIL_APP.nav.follower.usable), 'arrow ready at once in a placed building');
  let s = await walk(page, { seconds: 120, beta: 'geo', until: "nav.steps[nav.i].kind === 'floor'" });
  assert.equal(s.kind, 'floor', 'reached the stairs by walking');
  assert.ok(await page.isVisible('#floorCard'));
  assert.match(await page.textContent('#floorTitle'), /Take the stairs up to Level 2/);
  s = await walk(page, { seconds: 30, beta: 'geo', until: "nav.steps[nav.i].kind !== 'floor'" });
  assert.equal(s.leg, 1, 'on Level 2 after the staircase, with no tap');
  assert.ok((await page.evaluate(() => window.DALIL_APP.spoken)).some(x => /You are on Level 2/.test(x)));
  await walk(page, { seconds: 150, beta: 'geo' });
  await page.waitForSelector('#arrived:not([hidden])');
  await page.click('#btnArrivedDone');
  assert.equal(await page.textContent('#fromName'), 'Study Room 216K · Level 2');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Kennedy Library step-free: by lift, and the floor changes when the ride is felt and you walk out', async () => {
  const L2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-2.json'), 'utf8'));
  const room = L2.points.find(p => p.nameEn === 'Study Room 216K');
  const { ctx, page, errors } = await open(KENNEDY, { permissions: SENSORS });
  await pick(page, '216K', `level-2|${room.id}`);
  await page.click('#optStepFree');
  assert.match(await page.textContent('#routeVia'), /By lift to Level 2/);
  await page.click('#btnStart');
  const st = await steps(page);
  assert.ok(st.some(s => /^Take the lift up to Level 2/.test(s)) && !st.some(s => /stairs/i.test(s)));
  await wakeSensors(page, 'geo');
  let s = await walk(page, { seconds: 150, beta: 'geo', until: "nav.steps[nav.i].kind === 'floor'" });
  assert.equal(s.kind, 'floor');
  assert.match(await page.textContent('#floorTitle'), /Take the lift up to Level 2/);
  s = await walk(page, { seconds: 14, beta: 'geo', mode: 'still', lift: true });     // waiting and riding: no steps
  assert.equal(s.kind, 'floor', 'still in the lift');
  assert.ok(await page.evaluate(() => window.DALIL_APP.tracker.liftEvents >= 1), 'the ride was felt');
  s = await walk(page, { seconds: 3, beta: 'geo' });                                   // walking out
  assert.equal(s.leg, 1, 'on Level 2 once you walk out of the lift');
  await walk(page, { seconds: 150, beta: 'geo' });
  await page.waitForSelector('#arrived:not([hidden])');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The phone's position on Earth (faked here) placed on the plan through map.geo, as a map app would show it.
const geoOf = (geo, x, y) => { const [lng0, lat0] = geo.origin, b = geo.bearing * Math.PI / 180, k = geo.scale || 1;
  const mlng = 111412.84 * Math.cos(lat0 * Math.PI / 180), mlat = 111132.92 - 559.82 * Math.cos(2 * lat0 * Math.PI / 180);
  const e = k * (x * Math.cos(b) + y * Math.sin(b)), n = k * (-x * Math.sin(b) + y * Math.cos(b)); return { longitude: lng0 + e / mlng, latitude: lat0 + n / mlat }; };
test('GPS: home picks the place nearest to you; during directions the position follows your location (fixes off the route are ignored)', async () => {
  const L1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-calpoly-library/dalil-map_kennedy-library-cal-poly-test_level-1.json'), 'utf8'));
  const near = L1.points.filter(p => !p.virtual)[12];
  const { ctx, page, errors } = await open('#b=kennedy-library-cal-poly-test&f=level-1', { permissions: ['geolocation'], geolocation: { ...geoOf(L1.geo, near.x + 1, near.y), accuracy: 6 } });
  await page.waitForFunction(id => window.DALIL_APP.state.fromId === id, near.id);
  assert.match(await page.textContent('#fromEyebrow'), /Near you · GPS ±6 m/);
  // Home is the real map for buildings placed on Earth: the blue dot and the GPS accuracy circle are on it.
  await page.waitForSelector('#homeGL .out-you');
  await page.waitForFunction(() => window.DALIL_APP.homeMap?.()?.map.getSource('me')?._data?.features?.length === 2);
  // Directions without motion sensors: GPS alone moves you along the route.
  const dest = L1.points.filter(p => !p.virtual && p.id !== near.id).map(p => ({ p, d: Math.hypot(p.x - near.x, p.y - near.y) })).sort((a, b) => b.d - a.d)[0].p;
  await pick(page, dest.nameEn, `level-1|${dest.id}`);
  await page.click('#btnStart');
  const leg = await page.evaluate(() => { const n = window.DALIL_APP.nav; return { path: n.legs[0].route.path, cum: n.legs[0].cum, L: n.legs[0].L }; });
  const s = leg.L * 0.6; let i = 1; while (leg.cum[i] < s) i++;
  const f = (s - leg.cum[i - 1]) / (leg.cum[i] - leg.cum[i - 1]), x = leg.path[i - 1][0] + f * (leg.path[i][0] - leg.path[i - 1][0]), y = leg.path[i - 1][1] + f * (leg.path[i][1] - leg.path[i - 1][1]);
  await ctx.setGeolocation({ ...geoOf(L1.geo, x, y), accuracy: 5 });
  await page.waitForFunction(s => Math.abs(window.DALIL_APP.nav.pos - s) < 3, s, { timeout: 15000 });
  await page.waitForFunction(() => /Following your location · GPS ±5 m/.test(document.querySelector('#navModeText').textContent));
  assert.ok(await page.isHidden('#motionCard'), 'no "turn on motion" card while GPS carries you');
  const before = await page.evaluate(() => window.DALIL_APP.nav.pos);
  await ctx.setGeolocation({ ...geoOf(L1.geo, x + 60, y + 60), accuracy: 5 });   // 85 m away from the route
  await page.waitForTimeout(1500);
  assert.ok(Math.abs(await page.evaluate(() => window.DALIL_APP.nav.pos) - before) < 0.5, 'a fix far from the route is not used');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home is a map: search bar, category chips, floor switcher, tappable pins, bottom sheet and tabs', async () => {
  const { ctx, page, errors } = await open('#b=house-of-wisdom-test&f=ground-floor');
  for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://*.tile.opentopomap.org/**', 'https://tiles.openfreemap.org/**', 'https://tiles.versatiles.org/**']) await page.route(h, r => r.fulfill({ status: 503 }));
  await page.waitForFunction(() => window.DALIL_APP.homeMap?.());
  assert.ok(await page.isVisible('#homeGL') && await page.isHidden('#homeMap'), 'a building placed on Earth gets the real map');
  assert.match(await page.textContent('#btnSearchOpen'), /Search here/);
  assert.ok((await page.$$eval('#homeChips [data-cat]', c => c.map(x => x.dataset.cat))).includes('toilet'));
  assert.deepEqual(await page.$$eval('#homeFloors button', b => b.map(x => [x.textContent, x.getAttribute('aria-pressed')])), [['M', 'false'], ['G', 'true']]);
  // Floors switch the plan shown, not where you are
  await page.click('#homeFloors button:has-text("M")');
  await page.waitForFunction(() => window.DALIL_APP.homeMap().geojson.places.some(p => p.nameEn === 'Meeting Pod'));
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.map.floor.id), 'ground-floor');
  // Tapping a pin opens that place's route
  await page.evaluate(() => [...document.querySelectorAll('#homeGL [data-place]')].find(e => e.getAttribute('aria-label') === 'Meeting Pod').click());
  await pageIs(page, 'route');
  assert.equal(await page.textContent('#destName'), 'Meeting Pod');
  await page.click('#pgRoute [data-back]'); await pageIs(page, 'home');
  // A chip goes to the nearest of its kind
  await page.click('#homeChips [data-cat="toilet"]'); await pageIs(page, 'route');
  assert.match(await page.textContent('#destName'), /Toilets/);
  await page.click('#pgRoute [data-back]'); await pageIs(page, 'home');
  // Sheet and tabs
  assert.equal(await page.getAttribute('#btnSheet', 'aria-expanded'), 'false');
  await page.click('#btnSheet'); assert.equal(await page.getAttribute('#btnSheet', 'aria-expanded'), 'true');
  await page.click('#tabExplore'); assert.equal(await page.getAttribute('#btnSheet', 'aria-expanded'), 'false');
  await page.click('#tabSettings'); await pageIs(page, 'settings'); await page.click('#pgSettings [data-back]'); await pageIs(page, 'home');
  // Layers: base maps and layer checkboxes on the home map
  await page.click('#btnLayers');
  assert.ok(await page.isVisible('#dlgLayers') && (await page.$$eval('#homeBases input', i => i.map(x => x.value))).includes('esri-imagery'));
  await page.uncheck('#homeChecks input[value="places"]');
  assert.ok(await page.$$eval('#homeGL .out-pin', e => e.length > 5 && e.every(x => x.hidden)));
  await page.click('#dlgLayers [data-close]');
  // Directions button asks where to go
  await page.click('#btnDirections'); await pageIs(page, 'search');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('indoor maps find you: near a DALIL building the app offers it; inside one it opens by itself (no Settings)', async () => {
  const stub = async page => { for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://*.tile.opentopomap.org/**', 'https://tiles.openfreemap.org/**', 'https://tiles.versatiles.org/**']) await page.route(h, r => r.fulfill({ status: 503 })); };
  // About 250 m from the House of Wisdom, with the sample hospital (not placed on Earth) open: the nearby building opens
  let { ctx, page, errors } = await open('', { permissions: ['geolocation'], geolocation: { latitude: 25.3165, longitude: 55.5045, accuracy: 20 } });
  await stub(page);
  await page.waitForFunction(() => window.DALIL_APP.state.map.building.id === 'house-of-wisdom-test');
  assert.match(await page.textContent('#toast'), /Opened the indoor map of House of Wisdom/);
  await page.waitForFunction(() => window.DALIL_APP.homeMap()?.map.getLayer('walls'));
  // The list of indoor maps: nearest first, far ones folded away
  await page.click('#chipBuildings');
  const ids = await page.$$eval('#buildingList [data-building]', b => b.map(x => x.dataset.building));
  assert.equal(ids[0], 'house-of-wisdom-test', 'nearest first');
  assert.ok(!ids.includes('kennedy-library-cal-poly-test'), 'California is folded away');
  await page.click('#btnMoreBld');
  assert.ok((await page.$$eval('#buildingList [data-building]', b => b.map(x => x.dataset.building))).includes('kennedy-library-cal-poly-test'));
  // Choosing another building by hand wins; the nearby one is then only offered
  await page.click('#buildingList [data-building="sample-hospital"]');
  await page.waitForFunction(() => window.DALIL_APP.state.map.building.id === 'sample-hospital');
  await page.waitForSelector('#nearCard:not([hidden])');
  assert.match(await page.textContent('#nearTitle'), /House of Wisdom \(test\): indoor map available/);
  assert.equal(await page.textContent('#fromEyebrow'), 'Starting point', 'never "you are here" in a building GPS cannot place you in');
  await page.click('#btnNearOpen');
  await page.waitForFunction(() => window.DALIL_APP.state.map.building.id === 'house-of-wisdom-test');
  assert.deepEqual(errors, []);
  await ctx.close();
  // Standing inside it: it opens by itself
  ({ ctx, page, errors } = await open('', { permissions: ['geolocation'], geolocation: { latitude: 25.3184, longitude: 55.5061, accuracy: 10 } }));
  await stub(page);
  await page.waitForFunction(() => window.DALIL_APP.state.map.building.id === 'house-of-wisdom-test');
  assert.match(await page.textContent('#toast'), /Opened the indoor map of House of Wisdom/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('floor map: tap anywhere for directions, and save it as My spot', async () => {
  const { ctx, page, errors } = await open(KENNEDY);
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

test('share a route as a link and QR code; the link reopens the same route; kiosk mode shows a preview, not motion', async () => {
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
  assert.equal(await k.textContent('#startText'), 'Watch the route');
  await k.click('#btnStart');
  await k.waitForFunction(() => window.DALIL_APP.nav.sim === true);
  assert.ok(await k.isHidden('#motionCard'), 'a kiosk never asks for motion');
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

test('home remembers recent places and searches; the phone\'s back button works; settings: look, language, text size', async () => {
  const { ctx, page, errors } = await open();
  await pick(page, 'pharm', 'ground|P008');
  await page.click('#btnStart');
  await page.click('#btnEndNav');
  await pageIs(page, 'route');
  await page.goBack();
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
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'Day is the default');
  await page.click('input[name="theme"][value="dark"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.click('input[name="theme"][value="light"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
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
  assert.equal(stored.textSize, 'xl'); assert.equal(stored.theme, 'light');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Home sheet: drag it up and down like a maps app; a tap on its handle or title still works', async () => {
  const { ctx, page, errors } = await open('#b=uos-central-labs-b3-test&f=ground-floor');
  const isOpen = () => page.evaluate(() => document.querySelector('#homeSheet').classList.contains('open'));
  const drag = async (sel, dy) => { const r = await page.locator(sel).boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y + dy * i / 8); await page.waitForTimeout(30); } await page.mouse.up(); await page.waitForTimeout(400); };
  assert.equal(await isOpen(), false);
  await drag('#btnSheet', -300); assert.equal(await isOpen(), true, 'dragged up: open');
  await drag('#btnSheet', 300); assert.equal(await isOpen(), false, 'dragged down: closed');
  await drag('#bldName', -250); assert.equal(await isOpen(), true, 'the building name drags too');
  await drag('#bldName', 250); assert.equal(await isOpen(), false);
  await page.click('#bldName'); await page.waitForTimeout(300); assert.equal(await isOpen(), true, 'a tap on the closed sheet opens it');
  await page.click('#btnSheet'); await page.waitForTimeout(300); assert.equal(await isOpen(), false, 'the handle is still a button');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Arabic: building names are Arabic too', async () => {
  const { ctx, page, errors } = await open('#b=uos-central-labs-b3-test&f=ground-floor');
  await page.click('#btnSheet').catch(() => {}); await page.click('#btnLang');
  await page.waitForFunction(() => document.documentElement.lang === 'ar');
  assert.match(await page.textContent('#bldName'), /مبنى المختبرات المركزية B3/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('GPS outside the building: never "you are here" inside it; the route starts at the nearest entrance, with walking directions there', async () => {
  const B3 = '#b=uos-central-labs-b3-test&f=ground-floor';
  const stub = async page => { for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://tiles.openfreemap.org/**', 'https://tiles.versatiles.org/**']) await page.route(h, r => r.fulfill({ status: 503 })); };
  // About 350 m away, in another building
  let { ctx, page, errors } = await open(B3, { permissions: ['geolocation'], geolocation: { latitude: 25.2895, longitude: 55.4750, accuracy: 15 } });
  await stub(page);
  await page.waitForFunction(() => document.querySelector('#fromEyebrow').textContent.includes('Not in this building'));
  await search(page, 'Toilets (east)');
  await page.click('#results button[data-pick]');
  await pageIs(page, 'route');
  assert.match(await page.textContent('#routeMsg'), /You’re about \d+ m from this building.*Go to Entrance MD\d+ first/);
  assert.match(await page.getAttribute('#routeMsg a.out-dir', 'href'), /google\.com\/maps\/dir\/\?api=1&destination=25\.28\d+,55\.47\d+&travelmode=walking/);
  assert.match(await page.textContent('#routeMsg'), /^((?!No step-free).)*$/s, 'the toilets are step-free');
  assert.deepEqual(errors, []);
  await ctx.close();
  // Standing inside B3: no "outside" message
  ({ ctx, page, errors } = await open(B3, { permissions: ['geolocation'], geolocation: { latitude: 25.28701, longitude: 55.47791, accuracy: 10 } }));
  await stub(page);
  await page.waitForFunction(() => window.DALIL_APP.gps().state === 'on' && window.DALIL_APP.gps().acc != null);
  await page.waitForTimeout(500);
  assert.doesNotMatch(await page.textContent('#fromEyebrow'), /Not in this building/);
  await search(page, 'Geotechnical'); await page.click('#results button[data-pick]'); await pageIs(page, 'route');
  assert.doesNotMatch(await page.textContent('#routeMsg'), /from this building/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a lost visitor on campus: Arabic search finds the right places; opening the nearby building from the card knows you are outside', async () => {
  const stub = async page => { for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://tiles.openfreemap.org/**', 'https://tiles.versatiles.org/**']) await page.route(h, r => r.fulfill({ status: 503 })); };
  const { ctx, page, errors } = await open('', { permissions: ['geolocation'], geolocation: { latitude: 25.2882, longitude: 55.4767, accuracy: 12 } });
  await stub(page);
  await page.waitForFunction(() => window.DALIL_APP.state.map.building.id === 'uos-central-labs-b3-test');   // opened by itself: the nearest indoor map
  await page.waitForFunction(() => document.querySelector('#fromEyebrow').textContent.includes('Not in this building'));
  await page.click('#btnSearchOpen');
  const names = async q => { await page.fill('#search', q); await page.waitForTimeout(150); return page.$$eval('#results button[data-pick]', b => b.map(x => x.innerText)); };
  const labs = await names('مختبر');
  assert.ok(labs.length >= 10 && labs.every(n => /Lab/.test(n)), `Arabic "lab" finds only labs: ${labs.length}`);
  const wc = await names('حمام');
  assert.deepEqual(wc.map(n => n.split('\n')[0]).sort(), ['Toilets (east)', 'Toilets (west)']);
  assert.equal((await names('مُختَبر الكيمياء')).length, 4, 'harakat ignored; two words narrow it');
  // Door numbers from the drawing, labs labelled as labs, honest distances while outside
  assert.match((await names('034'))[0], /Analytical Chemistry Lab\nLab · Door 034/);
  assert.match((await names('MD9'))[0], /Multi Purpose Workshop/);
  await names('Organic'); assert.match(await page.textContent('#results'), /Distances from Entrance MD\d+, where the indoor route starts/);
  // Nothing matches: offer the help desk and help
  await names('library');
  assert.ok(await page.isVisible('#noResults')); assert.ok(await page.isVisible('#btnNoResHelpDesk')); assert.ok(await page.isVisible('#btnNoResHelp'));
  // A route while outside: Start first sends you to the entrance
  await page.fill('#search', 'Organic'); await page.click('#results button[data-pick]'); await pageIs(page, 'route');
  assert.match(await page.textContent('#placeFacts'), /Door 029/);
  await page.click('#btnStart');
  await page.waitForSelector('#dlgOutside[open]');
  assert.match(await page.textContent('#dlgOutside'), /from this building.*Entrance MD\d+.*I’m at the entrance now/s);
  await page.click('#btnOutAtDoor');
  await pageIs(page, 'nav');
  const st = await steps(page);
  assert.ok(!st.some(x => /Turn to your/.test(x)), 'plain words first: ' + st[1]);
  assert.ok(!st.some((x, i) => i && /^Bear (left|right), then walk [12] m/.test(x) && /^Bear/.test(st[i + 1] || '')), 'no 1–2 m zigzags');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no floor plan: walk the building to map it (survey); places, back-at-a-place, a lift to a new floor; then directions work', async () => {
  const { ctx, page, errors } = await open('', { permissions: [...SENSORS, 'geolocation'], geolocation: { latitude: 25.2900, longitude: 55.4100, accuracy: 6 } });
  await page.click('#btnSheet').catch(() => {});
  await page.evaluate(() => document.querySelector('#btnSurveyHome').click());
  await pageIs(page, 'survey');
  await page.fill('#svBuilding', 'Test Hall');
  // The phone's sensors are on (real events) so Start sees them
  await page.evaluate(() => { window.__sv = setInterval(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 60, gamma: 0, absolute: true })); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.81, z: 0.3 }, interval: 20 })); }, 20); });
  await page.waitForFunction(() => window.DALIL_APP.gps().fix || true);
  await page.click('#btnSvStart');
  await page.waitForSelector('#svLive:not([hidden])');
  await page.evaluate(() => clearInterval(window.__sv));
  const stroll = (H, seconds) => page.evaluate(({ H, seconds }) => {
    const tr = window.DALIL_APP.tracker, t0 = (window.__simT ||= performance.now() + 5000);
    let k = 0; for (; k < seconds * 50; k++) { const t = t0 + k * 20; tr.orient({ alpha: (360 - H) % 360, beta: 60, gamma: 0, absolute: true }, true, t); tr.motion({ accelerationIncludingGravity: { x: 0, y: 9.81 + 2.6 * Math.sin(2 * Math.PI * 1.8 * t / 1000), z: 0.3 } }, t); }
    window.__simT = t0 + k * 20; return window.DALIL_APP.survey().s.pos;
  }, { H, seconds });
  const place = async (cat, name) => { await page.click('#btnSvPlace'); await page.click(`#svCats [data-svcat="${cat}"]`); if (name) await page.fill('#svName', name); await page.click('#btnSvSave'); };
  await place('entrance', 'Main Entrance');
  let p = await stroll(0, 8);                    // north along the corridor
  assert.ok(p.y > 7 && Math.abs(p.x) < 1.5, `walked north: ${JSON.stringify(p)}`);
  await place('lift', 'Lift A');
  await stroll(90, 6);                            // east
  await place('room', 'Room 101');
  await stroll(270, 6.5);                         // back west, a bit too far
  await page.click('#btnSvBack'); await page.click('#svPickList [data-svplace="P002"]');
  assert.match(await page.textContent('#svStatus'), /Straightened/);
  assert.ok(await page.$$eval('#svMap .sv-line', l => l.length) >= 1, 'the trail is drawn');
  // Lift A to the first floor
  await page.click('#btnSvFloor'); await page.fill('#svNewFloor', 'First floor'); await page.click('#svPickList [data-svplace="P002"]');
  assert.equal(await page.textContent('#svFloorNow'), 'First floor');
  await stroll(90, 7);
  await place('room', 'Room 201');
  // Saved as it goes: a reload would offer to continue
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.survey')).floors.length), 2);
  await page.click('#btnSvFinish');
  await page.waitForSelector('#svDone:not([hidden])');
  assert.match(await page.textContent('#svDoneText'), /Test Hall: 2 floors, 4 places/);
  const m = await page.evaluate(() => window.DALIL_APP.state.maps.filter(x => x.building.id === 'test-hall').map(x => ({ f: x.floor.name, n: x.points.length, geo: !!x.geo, src: x.source.type, corr: x.plan.corridors.length })));
  assert.deepEqual(m.map(x => [x.f, x.n, x.geo, x.src]), [['Ground floor', 3, true, 'survey'], ['First floor', 2, true, 'survey']]);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.userMaps')).filter(x => x.building.id === 'test-hall').length), 2, 'kept on the phone');
  // Open it: from the entrance to Room 201 on the first floor, by the lift
  await page.click('#btnSvOpen');
  await pageIs(page, 'home');
  assert.equal(await page.evaluate(() => window.DALIL_APP.state.map.building.name), 'Test Hall');
  await search(page, 'Room 201');
  await page.click('#results button[data-pick]');
  await pageIs(page, 'route');
  assert.match(await page.textContent('#routeVia'), /lift to First floor/i);
  await page.click('#btnStart');
  const st = (await steps(page)).join(' | ');
  assert.match(st, /Take the lift up to First floor/, st);
  assert.match(st, /Room 201/, st);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every button is at least 48 px and text is readable (contrast) on the main screens, Night and Day', async () => {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    await ctx.addInitScript(th => localStorage.setItem('dalil.settings', JSON.stringify({ v: 4, theme: th, lang: 'en' })), theme);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '#at-P001&to-P007'); await page.evaluate(() => window.DALIL_APP.ready);
    const check = async scope => page.evaluate(sc => {
      const rgb = c => c.match(/[\d.]+/g).map(Number);
      const lum = c => { const [r, g, b] = rgb(c).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, a = rgb(c)[3]; if (a === undefined || a > .5) return c; } return getComputedStyle(document.body).backgroundColor; };
      const small = [], low = [];
      for (const el of document.querySelectorAll(`${sc} button, ${sc} a.btn, ${sc} input[type=search]`)) {
        const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden]') || el.closest('.mk')) continue;
        if (Math.min(r.width, r.height) < 47.5) small.push(`${el.id || el.className} ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
        const L1 = lum(getComputedStyle(el).color), L2 = lum(bgOf(el)), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        if (el.textContent.trim() && !el.disabled && ratio < 4.5) low.push(`${el.id || el.className} ${ratio.toFixed(2)}`);
      }
      return { small, low };
    }, scope);
    let r = await check('#pgRoute'); assert.deepEqual(r.small, [], `small targets on route (${theme})`); assert.deepEqual(r.low, [], `low contrast on route (${theme})`);
    await page.click('#pgRoute [data-back]'); await pageIs(page, 'home');
    r = await check('#pgHome'); assert.deepEqual(r.small, [], `home (${theme})`); assert.deepEqual(r.low, [], `home (${theme})`);
    await pick(page, 'prayer', 'ground|P007');
    await page.click('#btnStart');
    await page.waitForSelector('#motionCard:not([hidden])');
    r = await check('#nav'); assert.deepEqual(r.small, [], `nav (${theme})`); assert.deepEqual(r.low, [], `nav (${theme})`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
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
  await page.waitForFunction(() => window.DALIL_APP.state.toKey === 'ground|P002');
  await ctx.close();
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
  await p2.route('https://stats.example.org/**', r => r.fulfill({ status: 204 }));
  await p2.goto(base); await p2.evaluate(() => window.DALIL_APP.ready);
  await p2.click('#btnSearchOpen'); await p2.fill('#search', 'xyzzy');
  await p2.waitForTimeout(1700);
  await p2.fill('#search', 'prayer'); await p2.click('#results button[data-pick="ground|P007"]');
  await p2.click('#btnStart');
  await p2.evaluate(() => window.DALIL_APP.analytics.flush());
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
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 503, body: 'down' }));
  for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://*.tile.opentopomap.org/**']) await page.route(h, r => r.fulfill({ status: 503, body: 'down' }));
  await page.route('https://tiles.versatiles.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3efe6' } }] }) }));
  await page.goto(base + '#b=sample-hospital'); await page.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await page.isHidden('#btnGettingHere'), 'only buildings with a world position offer it');
  await page.goto(base + KENNEDY); await page.evaluate(() => window.DALIL_APP.ready);
  assert.ok(await page.isVisible('#btnGettingHere'));
  await page.waitForFunction(() => /away/.test(document.querySelector('#ghSub').textContent));
  await page.click('#btnGettingHere');
  await page.waitForFunction(() => window.DALIL_APP.outdoor());
  const o = await page.evaluate(() => { const c = window.DALIL_APP.outdoor(); return { provider: c.provider.id, failed: c.failed, target: c.target, layers: c.map.getStyle().layers.map(l => l.id), walls: c.geojson.walls.features.length }; });
  assert.equal(o.provider, 'versatiles'); assert.deepEqual(o.failed, ['OpenFreeMap']);
  assert.match(await page.textContent('#outStatus'), /OpenFreeMap didn’t load, so this is VersaTiles/);
  for (const id of ['outline-fill', 'walls', 'entr-ring', 'me-dot']) assert.ok(o.layers.includes(id), id);
  assert.ok(o.walls > 1000);
  assert.ok(Math.abs(o.target[1] - 35.30158) < 1e-4 && Math.abs(o.target[0] + 120.66358) < 1e-4, JSON.stringify(o.target));
  assert.match(await page.getAttribute('#lnkGmaps', 'href'), /destination=35\.3015\d+,-120\.6635\d+&travelmode=walking/);
  await page.click('#btnMyLoc');
  await page.waitForFunction(() => /from the main entrance/.test(document.querySelector('#outStatus').textContent));
  // Map and layers: every base map is listed (keyed ones switched off until the building adds its key), layers are checkboxes.
  await page.click('#outLayers summary');
  assert.deepEqual(await page.$$eval('#outBases input:not([disabled])', o => o.map(x => x.value)),
    ['auto', 'openfreemap', 'versatiles', 'esri-street', 'esri-topo', 'osm', 'carto', 'opentopomap', 'esri-imagery', 'esri-imagery-labels', 'plain']);
  assert.match(await page.textContent('#outBases label:has(input[value="esri-imagery"])'), /Satellite · Esri World Imagery.*free for testing/s);
  assert.ok(await page.isDisabled('#outBases input[value="google-satellite"]') && await page.isDisabled('#outBases input[value="esri"]'));
  assert.deepEqual(await page.$$eval('#outChecks input', o => o.map(x => x.value)), ['plan', 'places', 'outline', 'entrances', 'me']);
  const visOf = id => page.evaluate(id => window.DALIL_APP.outdoor().map.getLayoutProperty(id, 'visibility') ?? 'visible', id);
  await page.uncheck('#outChecks input[value="plan"]');
  assert.equal(await visOf('walls'), 'none'); assert.equal(await visOf('doors'), 'none'); assert.equal(await visOf('outline-line'), 'visible');
  await page.uncheck('#outChecks input[value="places"]');
  assert.ok(await page.$$eval('.out-place', e => e.length > 20 && e.every(x => x.hidden)), 'room and place labels hidden');
  await page.check('#outChecks input[value="plan"]'); assert.equal(await visOf('walls'), 'visible');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.settings')).mapLayers.places), false, 'layer choices remembered');
  await page.fill('#outOpacity', '40'); await page.dispatchEvent('#outOpacity', 'input');
  assert.equal(await page.evaluate(() => window.DALIL_APP.outdoor().map.getPaintProperty('walls', 'line-opacity')), 0.4);
  await page.route('https://tiles.versatiles.org/**', r => r.fulfill({ status: 503, body: 'down' }));
  await page.check('#outBases input[value="versatiles"]');
  await page.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'plain');
  assert.match(await page.textContent('#outStatus'), /needs an internet connection/);
  await page.click('#pgOutdoor [data-back]');
  await pageIs(page, 'home');
  assert.deepEqual(errors, []);
  await ctx.close();
  const c3 = await browser.newContext(opts); const p3 = await c3.newPage();
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/config.json'), 'utf8')); cfg.maps.keys.mapbox = 'pk.test'; cfg.maps.order = ['mapbox', 'versatiles'];
  await p3.route('**/config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg) }));
  await p3.route('https://api.mapbox.com/**', r => r.fulfill({ status: 401, body: 'bad key' }));
  await p3.route('https://tiles.versatiles.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3efe6' } }] }) }));
  await p3.goto(base + KENNEDY); await p3.evaluate(() => window.DALIL_APP.ready);
  await p3.click('#btnGettingHere');
  await p3.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'versatiles', null, { timeout: 20000 });
  assert.match(await p3.textContent('#outStatus'), /Mapbox didn’t load, so this is VersaTiles/);
  assert.ok(await p3.isEnabled('#outBases input[value="mapbox-satellite"]'));
  await c3.close();
  // Google satellite through the official Map Tiles API (session, then tiles), with the Google logo shown.
  const c4 = await browser.newContext(opts); const p4 = await c4.newPage(); const g = JSON.parse(JSON.stringify(cfg)); g.maps.keys = { google: 'AIza-test' }; g.maps.order = ['openfreemap'];
  let session = null;
  await p4.route('**/config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(g) }));
  await p4.route('https://tiles.openfreemap.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eee' } }] }) }));
  await p4.route('https://tile.googleapis.com/v1/createSession**', r => { session = JSON.parse(r.request().postData()); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ session: 'S1', expiry: '9999' }) }); });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p4.route('https://tile.googleapis.com/v1/2dtiles/**', r => r.fulfill({ contentType: 'image/png', body: png }));
  await p4.goto(base + KENNEDY); await p4.evaluate(() => window.DALIL_APP.ready);
  await p4.click('#btnGettingHere'); await p4.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'openfreemap');
  await p4.click('#outLayers summary'); await p4.check('#outBases input[value="google-satellite"]');
  await p4.waitForFunction(() => window.DALIL_APP.outdoor()?.provider.id === 'google-satellite');
  assert.equal(session.mapType, 'satellite');
  await p4.waitForFunction(() => window.DALIL_APP.outdoor().map.getLayer('walls'));
  assert.equal(await p4.getAttribute('#outMap', 'data-logo'), 'Google');
  assert.match(await p4.evaluate(() => window.DALIL_APP.outdoor().map.getStyle().sources.base.tiles[0]), /^https:\/\/tile\.googleapis\.com\/v1\/2dtiles\/\{z\}\/\{x\}\/\{y\}\?session=S1&key=AIza-test$/);
  await c4.close();
});

test('works offline after the first visit (service worker)', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).some(r => r.url.includes('dalil-map_sample')));
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map(r => new URL(r.url).pathname));
  for (const f of ['tracker.js', 'camera.js', 'providers.js', 'vendor/jsqr/jsQR.js', 'config.json', 'fonts/geist-mono.woff2', 'fonts/plex-arabic-400.woff2']) assert.ok(cached.some(u => u.endsWith(f)), `cached ${f}`);
  await ctx.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.DALIL_APP.ready);
  assert.equal(await page.textContent('#fromName'), 'Main Entrance');
  await ctx.close();
});
