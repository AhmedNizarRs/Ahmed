// Acceptance tests for the mapping tools in the visitor app (Nov 2026, round 2):
//   · Add a building: one place for every way to make a map, and the maps kept on the phone
//   · Import a floor plan, then put it on the real map by matching corners with the satellite photo
//   · No floor plan: draw the building on the satellite photo (roof outline, corridors drawn or walked, places)
//   · The walked survey can be matched with the satellite photo too
// Run: npm test (or: node --test tests/test_mapping_flows.mjs). Map tiles are stubbed: nothing here needs the internet.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const SENSORS = ['accelerometer', 'gyroscope', 'magnetometer'];
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
// A made-up site in open desert west of Sharjah: far from every bundled building, so nothing opens by itself.
const SITE = { latitude: 25.2000, longitude: 55.7000 };
const MLNG = 111412.84 * Math.cos(SITE.latitude * Math.PI / 180), MLAT = 111132.92 - 559.82 * Math.cos(2 * SITE.latitude * Math.PI / 180);
/** A point `e` metres along and `n` metres across a building whose long side runs 16° clockwise from east. */
const onSite = (e, n) => { const r = 16 * Math.PI / 180; return [SITE.longitude + (e * Math.cos(r) + n * Math.sin(r)) / MLNG, SITE.latitude + (-e * Math.sin(r) + n * Math.cos(r)) / MLAT]; };
const metres = (a, b) => Math.hypot((a[0] - b[0]) * MLNG, (a[1] - b[1]) * MLAT);

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

async function open(opts = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // Satellite and street tiles: a blank tile each (the tools only need a map to move under the cross).
  for (const h of ['https://server.arcgisonline.com/**', 'https://tile.openstreetmap.org/**', 'https://*.basemaps.cartocdn.com/**', 'https://*.tile.opentopomap.org/**']) await page.route(h, r => r.fulfill({ contentType: 'image/png', body: TILE }));
  for (const h of ['https://tiles.openfreemap.org/**', 'https://tiles.versatiles.org/**']) await page.route(h, r => r.fulfill({ status: 503 }));
  await page.goto(base); await page.evaluate(() => window.DALIL_APP.ready);
  return { ctx, page, errors };
}
const pageIs = (page, name) => page.waitForFunction(n => window.DALIL_APP.page() === n, name);
const toastIs = (page, re) => page.waitForFunction(s => new RegExp(s).test(document.querySelector('#toast').textContent) && !document.querySelector('#toast').hidden, re.source);

/* ---------- "Put it on the real map": helpers that work the screen the way a finger does ---------- */
// Drag the plan until plan point (x, y) is under the cross.
async function planUnderCross(page, [x, y]) {
  for (let i = 0; i < 4; i++) {
    const v = await page.evaluate(() => ({ ...window.DALIL_APP.placer().view })), dx = -(x - v.cx) * v.k, dy = (y - v.cy) * v.k;
    if (Math.hypot(dx, dy) < 0.3) return;
    const c = await page.locator('#plPlan').boundingBox(), sx = c.x + c.width / 2, sy = c.y + c.height * 0.3;
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + dx, sy + dy, { steps: 3 }); await page.mouse.up();
  }
}
// Bring a place on Earth under the cross of whichever map tool is open.
const worldUnderCross = (page, tool, lngLat) => page.evaluate(([tool, c]) => window.DALIL_APP[tool]().gm.moveTo(c, { zoom: 19.5, duration: 0 }), [tool, lngLat]);
async function matchCorner(page, plan, world) {
  await planUnderCross(page, plan); await page.click('#plUse');
  await page.waitForSelector('#plSet'); await worldUnderCross(page, 'placer', world); await page.click('#plSet');
}

// The drawing used for the import: a 40 × 24 m building at 20 px per metre on a 1000 × 700 sheet, with a title.
const X = m => 100 + m * 20, Y = m => 110 + m * 20;
const drawing = page => page.evaluate(() => {
  const s = document.createElement('canvas'); s.width = 1000; s.height = 700; const x = s.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 1000, 700); x.strokeStyle = '#222'; x.lineWidth = 5;
  const L = (a, b, c, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }, X = m => 100 + m * 20, Y = m => 110 + m * 20;
  L(X(0), Y(0), X(40), Y(0)); L(X(40), Y(0), X(40), Y(24)); L(X(0), Y(24), X(18.5), Y(24)); L(X(20), Y(24), X(40), Y(24)); L(X(0), Y(0), X(0), Y(24));
  L(X(0), Y(10), X(4), Y(10)); L(X(5), Y(10), X(16), Y(10)); L(X(17), Y(10), X(30), Y(10)); L(X(31), Y(10), X(40), Y(10)); L(X(13), Y(0), X(13), Y(10)); L(X(27), Y(0), X(27), Y(10));
  L(X(0), Y(14), X(8), Y(14)); L(X(9), Y(14), X(17), Y(14)); L(X(22), Y(14), X(33), Y(14)); L(X(34), Y(14), X(40), Y(14)); L(X(17), Y(14), X(17), Y(24)); L(X(22), Y(14), X(22), Y(24));
  x.fillStyle = '#111'; x.font = '22px sans-serif'; x.fillText('LAB 1', X(4), Y(5)); x.fillText('PRAYER', X(31), Y(5)); x.font = 'bold 34px sans-serif'; x.fillText('GROUND FLOOR PLAN', 320, 60);
  return s.toDataURL('image/png');
});
// The drawing's metres (x along the top wall, y down) on Earth: its top-left corner is the site point.
const drawnAt = (mx, my) => onSite(mx, -my);

test('Add a building: every way to map in one place; the old shortcuts lead there', async () => {
  const { ctx, page, errors } = await open();
  await page.click('#btnSheet'); await page.click('#btnMakeHome'); await pageIs(page, 'make');
  assert.deepEqual(await page.$$eval('#pgMake .gt-card strong', c => c.map(x => x.textContent)), ['Photo or picture of the plan', 'A DALIL map file', 'Draw it on the satellite photo', 'Walk it']);
  assert.ok(await page.isVisible('#myMapsEmpty'), 'no maps of your own yet');
  for (const b of await page.$$('#pgMake .gt-card')) { const r = await b.boundingBox(); assert.ok(r.height >= 64, 'a card is a comfortable target'); assert.ok(await b.evaluate(e => e.scrollHeight <= e.clientHeight + 1), 'nothing is cut off inside a card'); }
  await page.click('#btnSnapHome'); await pageIs(page, 'snap');
  assert.ok(await page.isHidden('#snBar'), 'no Back / Next before a picture is chosen');
  await page.click('#pgSnap [data-back]'); await pageIs(page, 'make');
  await page.click('#btnSurveyHome'); await pageIs(page, 'survey'); await page.click('#pgSurvey [data-back]'); await pageIs(page, 'make');
  await page.click('#pgMake [data-back]'); await pageIs(page, 'home');
  await page.click('#tabSettings'); await page.click('#btnMakeSet'); await pageIs(page, 'make');
  // Arabic
  await page.evaluate(() => document.querySelector('input[name="lang"][value="ar"]').click());
  await page.evaluate(() => window.DALIL_APP.go('make'));
  assert.equal(await page.textContent('#pgMake .bar-title'), 'أضف مبنى');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('import a floor plan and put it on the real map: two corners matched with the satellite photo give its size and its place; the inside and the outside agree', async () => {
  const { ctx, page, errors } = await open({ permissions: ['geolocation'], geolocation: { latitude: 25.21, longitude: 55.71, accuracy: 6 } });   // about 1.5 km from the site
  const png = await drawing(page);
  await page.evaluate(() => document.querySelector('#btnSnapHome').click()); await pageIs(page, 'snap');
  await page.setInputFiles('#snFile2', { name: 'plan.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
  await page.waitForSelector('#snWork:not([hidden])');
  assert.equal(await page.$$eval('#snDots li', l => l.map(x => x.className).join(',')), 'on,,,,', 'progress: step 1 of 5');
  // Dragging a corner shows the magnifier (the finger hides the spot it is placing)
  const cv = await page.locator('#snCanvas').boundingBox();
  await page.mouse.move(cv.x + cv.width * 0.06, cv.y + cv.height * 0.06); await page.mouse.down(); await page.mouse.move(cv.x + cv.width * 0.1, cv.y + cv.height * 0.12, { steps: 3 });
  assert.ok(await page.evaluate(() => !!window.DALIL_APP.snap().loupe), 'magnifier while the finger is down');
  await page.mouse.up(); assert.equal(await page.evaluate(() => window.DALIL_APP.snap().loupe), null);
  await page.click('#snWhole'); await page.click('#snNext'); await page.click('#snNext');                          // corners → walls → size and place
  assert.match(await page.textContent('#snTitle'), /Step 3 of 5 · Size and place/);
  assert.match(await page.textContent('.sn-card.best'), /Match it with the satellite photo/);
  await page.click('#snMatch'); await pageIs(page, 'place'); await page.waitForFunction(() => window.DALIL_APP.placer()?.gm);
  assert.match(await page.textContent('#plStep'), /Corner 1 · on your plan/);
  // The draft is at a guessed 5 cm per pixel; the match finds the real size. Picture pixel → the draft's metres:
  const plan = (mx, my) => [(X(mx) + 0.5) * 0.05, (700 - Y(my) - 0.5) * 0.05];
  await planUnderCross(page, plan(0, 0)); await page.click('#plUse');
  assert.match(await page.textContent('#plStep'), /Corner 1 · on the satellite photo/);
  assert.ok(await page.isVisible('#plThumb'), 'a small plan shows which corner you picked');
  await page.click('#plFind'); await page.fill('#plCoords', `${SITE.latitude}, ${SITE.longitude}`); await page.click('#plFindBox button[type=submit]');   // "Find the building": pasted coordinates
  await page.waitForFunction(([lng, lat]) => { const c = window.DALIL_APP.placer().gm.center(); return Math.abs(c[0] - lng) < 1e-6 && Math.abs(c[1] - lat) < 1e-6; }, [SITE.longitude, SITE.latitude]);
  await page.click('#plSet');
  assert.match(await page.textContent('#plStep'), /Corner 2 · on your plan/);
  // A second corner right next to the first is refused (it could not fix the direction)
  await planUnderCross(page, plan(1, 1)); await page.click('#plUse'); await toastIs(page, /Too close to a corner you already used/);
  await matchCorner(page, plan(40, 24), drawnAt(40, 24));
  assert.match(await page.textContent('#plStep'), /Check the fit/);
  assert.match(await page.textContent('#plCtl .gt-result'), /40 × 24 m on the ground · 2 corners, 47 m apart/);
  assert.ok(await page.evaluate(() => window.DALIL_APP.placer().gm.map.getSource('pl-walls').serialize().data.features.length > 20), 'the plan is drawn over the photo');
  // A third corner, tapped 40 cm off: the fit says how well they agree
  await page.click('#plMore'); await matchCorner(page, plan(40, 0), drawnAt(40.3, 0.3));
  assert.match(await page.textContent('#plCtl .gt-result'), /corners agree within 0\.[1-4] m/);
  await page.click('#plDone'); await pageIs(page, 'snap');
  assert.match(await page.textContent('#snOnMap'), /On the real map · 50 × 35 m/);       // the 1000 × 700 px sheet at 20 px per metre
  const mpp = await page.evaluate(() => window.DALIL_APP.snap().mpp); assert.ok(Math.abs(mpp - 0.05) < 0.0006, `metres per pixel from the match: ${mpp}`);
  await page.click('#snNext');
  const at = (sx, sy) => page.evaluate(([sx, sy]) => { const c = document.querySelector('#snCanvas'), r = c.getBoundingClientRect(); return [r.left + sx * r.width / c.width, r.top + sy * r.height / c.height]; }, [sx, sy]);
  const add = async (mx, my, name, cat) => { await page.mouse.click(...await at(X(mx), Y(my))); await page.waitForSelector('#dlgPlace[open]'); await page.fill('#placeEn', name); await page.selectOption('#placeCat', cat); await page.click('#formPlace button[type=submit]'); };
  await add(19.2, 23, 'Main entrance', 'entrance'); await add(6, 5, 'Lab 1', 'lab'); await add(33, 5, 'Prayer room', 'prayer');
  await page.click('#snNext'); assert.equal(await page.$('#snCtl .warn'), null, 'no "not on the real map" warning');
  await page.fill('#snBld', 'Imported Hall'); await page.click('#snNext'); await pageIs(page, 'home');
  const m = await page.evaluate(() => { const m = window.DALIL_APP.state.map; return { name: m.building.name, geo: m.geo, pts: m.points.map(p => [p.nameEn, p.x, p.y]) }; });
  assert.equal(m.name, 'Imported Hall');
  assert.ok(Math.abs(m.geo.bearing - 16) < 0.6 && Math.abs(m.geo.scale - 1) < 1e-4, JSON.stringify(m.geo));
  assert.match(m.geo.source, /3 matched corners, agreeing within 0\.\d m/);
  // Every place is on Earth where the drawing says it is (within half a metre): the entrance, the lab, the prayer room
  const world = await page.evaluate(async () => { const { planToWorld } = await import('./georef.js'), m = window.DALIL_APP.state.map, T = planToWorld(m.geo); return m.points.map(p => T(p.x, p.y)); });
  for (const [i, [mx, my]] of [[19.2, 23], [6, 5], [33, 5]].entries()) assert.ok(metres(world[i], drawnAt(mx, my)) < 0.5, `${m.pts[i][0]} is ${metres(world[i], drawnAt(mx, my)).toFixed(2)} m off`);
  // Home is the real map now, and it frames the building (not the whole world)
  await page.waitForFunction(() => window.DALIL_APP.homeMap?.());
  assert.ok(await page.isVisible('#homeGL') && await page.isHidden('#homeMap'));
  await page.waitForFunction(() => window.DALIL_APP.homeMap().map.getZoom() > 16);
  // Outside and inside agree: stand in Lab 1 (GPS ±4 m) and the app says you are at Lab 1
  const lab = drawnAt(6, 5); await ctx.setGeolocation({ longitude: lab[0], latitude: lab[1], accuracy: 4 });
  await page.waitForFunction(() => /Lab 1/.test(document.querySelector('#fromName').textContent));
  // 30 m outside the building the app does not put you in a room
  const out = drawnAt(-30, 12); await ctx.setGeolocation({ longitude: out[0], latitude: out[1], accuracy: 5 });
  await page.waitForFunction(() => !!window.DALIL_APP.state.outside);

  // Maps on this phone: adjust its place, rename it, delete it
  await page.evaluate(() => window.DALIL_APP.go('make'));
  assert.match(await page.textContent('#myMaps'), /Imported Hall.*1 floor · On the real map/s);
  await page.click('[data-mymap]'); await page.waitForSelector('#dlgMapAct[open]');
  assert.match(await page.textContent('#maPlaceText'), /Adjust its place on the real map/);
  await page.click('#maPlace'); await pageIs(page, 'place'); await page.waitForFunction(() => window.DALIL_APP.placer()?.gm);
  assert.match(await page.textContent('#plStep'), /Check the fit/);                   // already placed: it opens on the check
  await page.click('.gt-tune summary'); await page.click('[data-nudge="east:0.5"]'); await page.click('[data-nudge="east:0.5"]');
  await page.click('#plDone'); await pageIs(page, 'make'); await toastIs(page, /On the real map now/);
  const moved = await page.evaluate(async () => { const { planToWorld } = await import('./georef.js'), m = window.DALIL_APP.state.maps.find(x => x.building.name === 'Imported Hall'), kept = JSON.parse(localStorage.getItem('dalil.userMaps')).find(x => x.building.name === 'Imported Hall'); return { now: planToWorld(m.geo)(m.points[0].x, m.points[0].y), kept: planToWorld(kept.geo)(kept.points[0].x, kept.points[0].y), src: m.geo.source }; });
  assert.ok(Math.abs((moved.now[0] - world[0][0]) * MLNG - 1) < 0.05 && Math.abs((moved.now[1] - world[0][1]) * MLAT) < 0.05, 'moved 1 m east');
  assert.deepEqual(moved.kept, moved.now, 'the copy kept on the phone moved too');
  assert.match(moved.src, /fine-tuned by hand/);
  await page.click('[data-mymap]'); await page.fill('#maName', 'Science Hall'); await page.click('#maRenameForm button[type=submit]');
  assert.match(await page.textContent('#myMaps'), /Science Hall/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.userMaps'))[0].building.name), 'Science Hall');
  await page.click('[data-mymap]'); await page.click('#maDelete');
  assert.match(await page.textContent('#maSureText'), /Delete “Science Hall” from this phone\? This cannot be undone\./);
  await page.click('#maDeleteNo'); assert.ok(await page.isVisible('#maOpen'), 'Cancel keeps it');
  await page.click('#maDelete'); await page.click('#maDeleteYes');
  assert.ok(await page.isVisible('#myMapsEmpty'));
  assert.deepEqual(await page.evaluate(() => [JSON.parse(localStorage.getItem('dalil.userMaps')).length, window.DALIL_APP.state.maps.some(x => x.building.name === 'Science Hall'), window.DALIL_APP.state.map.building.name !== 'Science Hall']), [0, false, true]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no floor plan: draw the building on the satellite photo (roof squared, corridors joined, places); it is saved in the right place; the next floor is walked and straightened by a drag', async () => {
  const { ctx, page, errors } = await open({ permissions: [...SENSORS, 'geolocation'], geolocation: { ...SITE, accuracy: 5 } });
  await page.evaluate(() => document.querySelector('#btnSketchHome').click()); await pageIs(page, 'sketch');
  await page.waitForFunction(() => window.DALIL_APP.sketch()?.gm);
  assert.match(await page.textContent('#skStep'), /Step 1 of 4 · Find the building/);
  await page.click('#skNext'); await toastIs(page, /Type the building.s name first|name/i);          // a name first
  await page.fill('#skName', 'Desert Hall'); await page.click('#skNext');
  assert.match(await page.textContent('#skStep'), /Step 2 of 4 · Trace the roof/);
  assert.ok(await page.isDisabled('#skNext'), 'an outline needs 3 corners');
  const put = (e, n) => worldUnderCross(page, 'sketch', onSite(e, n));
  // The roof is 50 × 40 m; the corners are tapped up to 0.8 m off, as a hand does
  for (const [e, n] of [[0, 0], [50.6, 0.8], [49.5, 40], [-0.7, 39.4]]) { await put(e, n); await page.click('#skAdd'); }
  assert.match(await page.textContent('#skCtl .gt-result'), /4 corners · about 50 × (39|40) m/);
  assert.ok(await page.isChecked('#skSquare'));
  await page.click('#skUndo'); assert.equal(await page.evaluate(() => window.DALIL_APP.sketch().sk.outline.length), 3);
  await put(-0.7, 39.4); await page.click('#skAdd');
  await page.click('#skNext');
  assert.match(await page.textContent('#skStep'), /Step 3 of 4 · Corridors and places/);
  // Zoomed out, a tap does not place a point: the app zooms in first
  await page.evaluate(() => window.DALIL_APP.sketch().gm.map.jumpTo({ zoom: 16 })); await page.click('#skAdd'); await toastIs(page, /Zoomed in so the point is exact/);
  assert.equal(await page.evaluate(() => (window.DALIL_APP.sketch().cur || []).length), 0);
  await page.waitForFunction(() => window.DALIL_APP.sketch().gm.map.getZoom() >= 18.9);
  // The main corridor, tapped a little crooked: it comes out straight with the building
  await put(1, 20); await page.click('#skAdd'); await put(48, 21.3); await page.click('#skAdd'); await page.click('#skEnd');
  const { main, roof } = await page.evaluate(async () => { const { squareUp } = await import('./sketch.js'), sk = window.DALIL_APP.sketch().sk; return { main: sk.floors[0].lines[0], roof: squareUp(sk.outline) }; });
  const slope = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, ang = slope(main[0], main[1]), edge = slope(roof[0], roof[1]);
  assert.ok(Math.abs(ang - edge) < 0.01, `exactly parallel to the roof's long edge: ${ang.toFixed(2)}° vs ${edge.toFixed(2)}°`);
  assert.ok(Math.abs(edge - -16) < 1.5, `and the traced roof is within a degree or so of the real building (−16°): ${edge.toFixed(2)}°`);
  // A side corridor started 0.6 m off the main one joins it exactly
  await put(25, 20.6); await page.click('#skAdd'); await toastIs(page, /Joined to the corridor/);
  await put(25.2, 37); await page.click('#skAdd'); await page.click('#skEnd');
  assert.match(await page.textContent('[data-tool="corridor"] small'), /2/);
  assert.ok(await page.isDisabled('#skNext'), 'places are needed before the review');
  await page.click('[data-tool="place"]');
  await put(0.5, 20); await page.click('[data-skq="entrance"]'); await put(12, 27); await page.click('[data-skq="room"]');
  await put(47, 20.5); await page.click('[data-skq="lift"]'); await put(25, 38); await page.click('[data-skq="toilet"]');
  assert.deepEqual(await page.$$eval('#skMap .sk-place .skp-name', n => n.map(x => x.textContent)), ['Entrance 1', 'Room 1', 'Elevator 1', 'Restroom 1']);
  // Tap a place to rename it
  await page.click('#skMap .sk-place:nth-of-type(2)', { force: true }).catch(() => page.evaluate(() => document.querySelectorAll('#skMap .sk-place')[1].click()));
  await page.waitForSelector('#dlgPlace[open]'); await page.fill('#placeEn', 'Library'); await page.click('#formPlace button[type=submit]');
  await page.click('#skNext');
  assert.match(await page.textContent('#skStep'), /Step 4 of 4 · Save/);
  assert.match(await page.textContent('#skCtl .gt-result'), /All 4 places are connected/);
  await page.fill('#skFloor', 'Ground floor'); await page.click('#skNext');
  assert.match(await page.textContent('#skHint'), /Desert Hall: 1 floor, 4 places, already in the right place on the real map/);

  // The next floor: same outline, the lift is already there; this corridor is walked
  await page.click('#skNextFloor');
  assert.deepEqual(await page.evaluate(() => { const s = window.DALIL_APP.sketch().sk; return [s.floors.length, s.f, s.floors[1].places.map(p => p.nameEn)]; }), [2, 1, ['Elevator 1']]);
  await put(47, 20.5);
  await page.evaluate(() => { window.__sv = setInterval(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 60, gamma: 0, absolute: true })); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.81, z: 0.3 }, interval: 20 })); }, 20); });
  await page.click('#skWalk'); await page.waitForSelector('#skWalkStop'); await page.evaluate(() => clearInterval(window.__sv));
  // Walk west along the building for 22 s; the compass reads 9° off (286° − 16° = 270° is the true way)
  await page.evaluate(() => {
    const tr = window.DALIL_APP.tracker, t0 = performance.now() + 5000, H = 286 + 9;
    for (let k = 0; k < 22 * 50; k++) { const t = t0 + k * 20; tr.orient({ alpha: (360 - H) % 360, beta: 60, gamma: 0, absolute: true }, true, t); tr.motion({ accelerationIncludingGravity: { x: 0, y: 9.81 + 2.6 * Math.sin(2 * Math.PI * 1.8 * t / 1000), z: 0.3 } }, t); }
  });
  const walked = await page.evaluate(() => { const k = window.DALIL_APP.sketch(); return { n: k.walk.n, cur: k.cur, stride: k.walk.stride }; });
  assert.ok(walked.n >= 30, `steps drew the corridor: ${walked.n}`);
  const end = walked.cur.at(-1), first = walked.cur[0], dir = Math.atan2(end[1] - first[1], end[0] - first[0]) * 180 / Math.PI;
  assert.ok(Math.abs(Math.abs(dir) - 164) < 1.6, `the 9° compass error is gone: the walk runs with the building (${dir.toFixed(1)}°)`);
  // You know you are at the far door now: drag the map there. Everything walked since the start stretches to end there.
  const c = await page.locator('#skMap').boundingBox(), sx = c.x + c.width / 2, sy = c.y + c.height * 0.25;
  await page.waitForTimeout(400);                                 // let the follow-me glide finish
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 14, { steps: 5 }); await page.mouse.up();
  await toastIs(page, /Straightened: moved \d/);
  const fixed = await page.evaluate(() => { const k = window.DALIL_APP.sketch(), g = k.gm.center(); return { end: k.cur.at(-1), stride: k.walk.stride, lng: g[0], lat: g[1], ref: k.sk.ref }; });
  const here = [(fixed.lng - fixed.ref[0]) * MLNG, (fixed.lat - fixed.ref[1]) * MLAT];
  assert.ok(Math.hypot(here[0] - fixed.end[0], here[1] - fixed.end[1]) < 0.05, 'the walked line now ends under the cross');
  assert.notEqual(fixed.stride, walked.stride, 'the step length is learned from the fix');
  await page.click('#skWalkStop'); await page.click('#skEnd');
  await page.click('[data-tool="place"]'); await page.click('[data-skq="room"]');
  await page.click('#skNext'); await page.fill('#skFloor', 'First floor'); await page.click('#skNext');
  assert.match(await page.textContent('#skHint'), /Desert Hall: 2 floors, 6 places/);
  await page.click('#skOpen'); await pageIs(page, 'home');

  const maps = await page.evaluate(async () => {
    const { planToWorld } = await import('./georef.js');
    return window.DALIL_APP.state.maps.filter(x => x.building.name === 'Desert Hall').map(m => ({ f: m.floor.name, src: m.source.type, geo: m.geo, ring: m.building_context.footprint.length, walls: m.plan.walls.length, corr: m.plan.corridors.length, pts: m.points.map(p => ({ n: p.nameEn, link: p.link || null, w: planToWorld(m.geo)(p.x, p.y) })) }));
  });
  assert.deepEqual(maps.map(m => [m.f, m.src, m.ring, m.walls]), [['Ground floor', 'sketch', 5, 1], ['First floor', 'sketch', 5, 1]]);
  const g = maps[0];
  assert.ok(g.geo.scale === 1 && Math.abs(g.geo.bearing - 16) < 1.2, `drawn square to the page, on Earth at 16°: ${JSON.stringify(g.geo)}`);
  for (const [name, e, n] of [['Entrance 1', 0.5, 20], ['Library', 12, 27], ['Elevator 1', 47, 20.5], ['Restroom 1', 25, 38]]) { const p = g.pts.find(q => q.n === name); assert.ok(p && metres(p.w, onSite(e, n)) < 0.3, `${name} is where it was tapped`); }
  const lifts = maps.map(m => m.pts.find(p => p.link)); assert.equal(lifts[0].link, lifts[1].link); assert.ok(metres(lifts[0].w, lifts[1].w) < 0.05, 'the lift is in the same spot on both floors');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dalil.userMaps')).filter(x => x.building.name === 'Desert Hall').length), 2, 'kept on the phone');
  assert.equal(await page.evaluate(() => localStorage.getItem('dalil.sketch')), 'null', 'the draft is cleared once saved');
  // Maps on this phone: a drawn map can be opened again to carry on drawing
  await page.evaluate(() => window.DALIL_APP.go('make'));
  assert.match(await page.textContent('#myMaps'), /Desert Hall.*2 floors · On the real map/s);
  await page.click('[data-mymap]'); assert.ok(await page.isVisible('#maEdit'), 'a drawn map can be edited later');
  await page.click('#maEdit'); await pageIs(page, 'sketch'); await page.waitForFunction(() => window.DALIL_APP.sketch()?.gm);
  assert.match(await page.textContent('#skStep'), /Step 3 of 4/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a drawn map routes like any other; a draft survives leaving the screen', async () => {
  const { ctx, page, errors } = await open({ permissions: ['geolocation'], geolocation: { latitude: 25.21, longitude: 55.71, accuracy: 6 } });
  await page.evaluate(() => document.querySelector('#btnSketchHome').click()); await pageIs(page, 'sketch'); await page.waitForFunction(() => window.DALIL_APP.sketch()?.gm);
  const put = (e, n) => worldUnderCross(page, 'sketch', onSite(e, n));
  await put(25, 20); await page.fill('#skName', 'Route Hall'); await page.click('#skNext');
  for (const [e, n] of [[0, 0], [50, 0], [50, 40], [0, 40]]) { await put(e, n); await page.click('#skAdd'); }
  await page.click('#skNext'); await put(1, 20); await page.click('#skAdd'); await put(25, 20); await page.click('#skAdd');
  // Leave in the middle of a line: nothing is lost
  await page.click('#pgSketch [data-back]'); await pageIs(page, 'home');
  await page.evaluate(() => document.querySelector('#btnSketchHome').click()); await pageIs(page, 'sketch'); await page.waitForFunction(() => window.DALIL_APP.sketch()?.gm);
  assert.match(await page.textContent('#skResume'), /Continue: Route Hall/);
  await page.click('#skResume');
  assert.deepEqual(await page.evaluate(() => { const k = window.DALIL_APP.sketch(); return [k.step, k.sk.outline.length, k.cur.length]; }), ['draw', 4, 2]);
  await put(48, 20); await page.click('#skAdd'); await page.click('#skEnd');
  await put(25, 20); await page.click('#skAdd'); await put(25, 37); await page.click('#skAdd'); await page.click('#skEnd');
  await page.click('[data-tool="place"]');
  await put(0.5, 20); await page.click('[data-skq="entrance"]'); await put(25, 38); await page.click('[data-skq="toilet"]');
  // A place nowhere near a corridor is flagged in the review
  await page.click('[data-tool="corridor"]'); await put(5, 3); await page.click('#skAdd'); await put(9, 3); await page.click('#skAdd'); await page.click('#skEnd');
  await page.click('[data-tool="place"]'); await put(7, 3); await page.click('[data-skq="room"]');
  await page.click('#skNext');
  assert.match(await page.textContent('#skCtl .warn'), /No corridor reaches: Room 1/);
  await page.click('#skPrev'); await page.click('[data-tool="corridor"]');
  await put(5, 3); await page.click('#skAdd'); await put(5, 20); await page.click('#skAdd'); await page.click('#skEnd');     // join it to the main corridor
  await page.click('#skNext'); assert.match(await page.textContent('#skCtl .gt-result'), /All 3 places are connected/);
  await page.click('#skNext'); await page.click('#skOpen'); await pageIs(page, 'home');
  await page.click('#btnSearchOpen'); await page.fill('#search', 'restroom'); await page.click('.nc-go, #results button[data-pick]'); await pageIs(page, 'route');
  const d = +(await page.textContent('#statDist'));
  assert.ok(Math.abs(d - 42) < 5, `entrance → restroom along the corridors, about 24.5 + 17 m: ${d}`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the walked survey can be matched with the satellite photo, even with no GPS at the door', async () => {
  const { ctx, page, errors } = await open({ permissions: SENSORS });
  await page.evaluate(() => document.querySelector('#btnSurveyHome').click()); await pageIs(page, 'survey');
  await page.fill('#svBuilding', 'Walk Hall');
  await page.evaluate(() => { window.__sv = setInterval(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 60, gamma: 0, absolute: true })); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.81, z: 0.3 }, interval: 20 })); }, 20); });
  await page.click('#btnSvStart'); await page.waitForSelector('#svLive:not([hidden])'); await page.evaluate(() => clearInterval(window.__sv));
  const stroll = (H, seconds) => page.evaluate(({ H, seconds }) => {
    const tr = window.DALIL_APP.tracker, t0 = (window.__simT ||= performance.now() + 5000);
    let k = 0; for (; k < seconds * 50; k++) { const t = t0 + k * 20; tr.orient({ alpha: (360 - H) % 360, beta: 60, gamma: 0, absolute: true }, true, t); tr.motion({ accelerationIncludingGravity: { x: 0, y: 9.81 + 2.6 * Math.sin(2 * Math.PI * 1.8 * t / 1000), z: 0.3 } }, t); }
    window.__simT = t0 + k * 20; return window.DALIL_APP.survey().s.pos;
  }, { H, seconds });
  await page.click('[data-svq="entrance"]'); const far = await stroll(0, 20); await page.click('[data-svq="room"]');
  await page.click('#btnSvFinish'); await page.waitForSelector('#svReview:not([hidden])');
  assert.ok(await page.isHidden('#svAlignSec'), 'no GPS at the door: nothing to nudge yet');
  await page.click('#btnSvMatch'); await pageIs(page, 'place'); await page.waitForFunction(() => window.DALIL_APP.placer()?.gm);
  assert.equal(await page.evaluate(() => window.DALIL_APP.survey().s.building), 'Walk Hall', 'the walk is still open behind the match');
  // The walk went "north" by the compass for far.y metres; really the corridor runs 16° east of north.
  const pts = await page.evaluate(() => window.DALIL_APP.placer().map.points.map(p => [p.x, p.y]));
  await matchCorner(page, pts[0], onSite(0, 0)); await matchCorner(page, pts[1], onSite(0, far.y * 1.05));       // and the steps were 5 % short
  assert.match(await page.textContent('#plStep'), /Check the fit/);
  await page.click('#plDone'); await pageIs(page, 'survey'); await page.waitForSelector('#svReview:not([hidden])');
  await toastIs(page, /Matched: the walk is/);
  assert.ok(await page.isVisible('#svAlignSec'), 'placed now: the fine line-up is offered too');
  await page.click('#btnSvSaveMap'); await page.waitForSelector('#svDone:not([hidden])');
  const out = await page.evaluate(async () => { const { planToWorld } = await import('./georef.js'), m = window.DALIL_APP.state.maps.find(x => x.building.name === 'Walk Hall'), T = planToWorld(m.geo); return { geo: m.geo, w: m.points.map(p => T(p.x, p.y)) }; });
  assert.ok(metres(out.w[0], onSite(0, 0)) < 0.3 && metres(out.w[1], onSite(0, far.y * 1.05)) < 0.3, 'both places are where they were matched');
  assert.ok(Math.abs(out.geo.scale - 1.05) < 0.01 && Math.abs(out.geo.bearing - 16) < 0.5, JSON.stringify(out.geo));
  assert.deepEqual(errors, []);
  await ctx.close();
});
