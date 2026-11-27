// Unit tests for the mapping maths (no browser): georef.js (a plan's position on Earth from matched corners) and
// sketch.js (a building drawn on the satellite photo → a DALIL map). Run: node --test tests/test_mapping_units.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitGeo, planToWorld, worldToPlan, nudgeGeo, carryGeo, moveRing, parseLatLng, fitRating, planBox, enu } from '../app/georef.js';
import { planFromGeo } from '../app/locate.js';
import { outlineAxis, squareUp, outlineSize, snapPoint, snapHeadingToAxis, anchorWalk, newSketch, linkPlace, addFloor, sketchToMaps } from '../app/sketch.js';
import { Router } from '../app/router.js';

const truth = { origin: [55.50571232, 25.31822848], bearing: 16, scale: 0.9731 }, T = planToWorld(truth);
const corners = [[0, 0], [80, 0], [80, 45], [10, 52]];
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 100700, (a[1] - b[1]) * 110800);   // rough, at 25° N

test('matched corners give the plan its exact place, direction and size (2 points, or more)', () => {
  for (const n of [2, 4]) {
    const f = fitGeo(corners.slice(0, n).map(p => ({ plan: p, world: T(...p) })));
    assert.ok(Math.abs(f.geo.bearing - 16) < 1e-3 && Math.abs(f.geo.scale - 0.9731) < 1e-4, JSON.stringify(f.geo));
    const back = worldToPlan(f.geo)(...T(40, 20));
    assert.ok(Math.hypot(back[0] - 40, back[1] - 20) < 0.02, `round trip ${back}`);
    assert.ok(f.rms < 0.01);
  }
});

test('the fit uses the same maths as the GPS → plan conversion (locate.js)', () => {
  const p = planFromGeo(truth)(...T(33, 12));
  assert.ok(Math.hypot(p.x - 33, p.y - 12) < 1e-6);
});

test('corners tapped a metre off: the misfit is reported, a measured size can be kept, bad input is refused', () => {
  const noisy = corners.map((p, i) => { const w = T(...p); return { plan: p, world: [w[0] + (i % 2 ? 1 : -1) * 1e-5, w[1] + (i > 1 ? 1 : -1) * 0.8e-5] }; });
  const f = fitGeo(noisy);
  assert.ok(f.rms > 0.3 && f.rms < 2.5, `rms ${f.rms}`);
  assert.equal(fitRating(f, 4), f.rms <= 1.5 ? 'good' : 'ok');
  assert.equal(fitGeo(noisy, { scale: 1 }).geo.scale, 1);
  assert.equal(fitGeo([{ plan: [1, 1], world: [55, 25] }, { plan: [1, 1], world: [55.1, 25] }]).error, 'same');
  assert.equal(fitGeo([{ plan: [1, 1], world: [55, 25] }]).error, 'few');
  assert.equal(fitRating({ rms: 0, baseline: 8 }, 2), 'rough');          // two corners 8 m apart: the direction is weak
});

test('fine-tuning by hand: 1 m north is 1 m north; turning and resizing happen about the plan, not about its corner', () => {
  const a = T(40, 20), north = planToWorld(nudgeGeo(truth, { north: 1 }, [40, 20]))(40, 20);
  assert.ok(Math.abs((north[1] - a[1]) * 110800 - 1) < 0.03 && Math.abs(north[0] - a[0]) < 1e-7);
  const g = nudgeGeo(truth, { turn: 5, size: 1.02 }, [40, 20]);
  assert.ok(metres(planToWorld(g)(40, 20), a) < 0.02);
  assert.ok(Math.abs(g.bearing - 21) < 1e-3 && Math.abs(g.scale - 0.9731 * 1.02) < 1e-4);
});

test('the other floors of a building follow when one floor is moved', () => {
  const b0 = { origin: T(5, -3), bearing: 16, scale: 0.9731 }, a1 = nudgeGeo(truth, { east: 4, turn: 2 }, [0, 0]);
  const b1 = carryGeo(truth, a1, b0, { minX: 0, minY: 0, maxX: 30, maxY: 20 });
  assert.ok(metres(planToWorld(a1)(15, 4), planToWorld(b1)(10, 7)) < 0.02);
});

test('an outline traced with the plan moves with it', () => {
  const moved = nudgeGeo(truth, { east: 3, north: -2, turn: 4 }, [40, 20]), ring = corners.map(p => T(...p));
  moveRing(ring, truth, moved).forEach((w, i) => assert.ok(metres(w, planToWorld(moved)(...corners[i])) < 0.03));
});

test('coordinates can be pasted as numbers or as a maps link', () => {
  assert.deepEqual(parseLatLng('25.3186, 55.4907'), [55.4907, 25.3186]);
  assert.deepEqual(parseLatLng('https://www.google.com/maps/place/x/@25.318228,55.505712,18z'), [55.505712, 25.318228]);
  assert.equal(parseLatLng('hello'), null);
});

const turn20 = ([x, y]) => { const r = 20 * Math.PI / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };
const roof = [[0, 0], [60.4, 1.1], [59.7, 41], [-0.6, 40.2]].map(turn20);      // a 60 × 40 m roof, 20° off north, tapped by hand

test('a roof traced by hand: its grid is found and its corners squared', () => {
  assert.ok(Math.abs(outlineAxis(roof) - 20) < 1.5);
  const sq = squareUp(roof);
  for (let i = 0; i < 4; i++) {
    const p = sq[i], q = sq[(i + 1) % 4], r = sq[(i + 2) % 4], dot = (q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1]);
    assert.ok(Math.abs(dot) / (Math.hypot(q[0] - p[0], q[1] - p[1]) * Math.hypot(r[0] - q[0], r[1] - q[1])) < 1e-9, 'square corner');
  }
  const size = outlineSize(sq); assert.ok(Math.abs(size.w - 60) < 1 && Math.abs(size.h - 40) < 1, JSON.stringify(size));
});

test('corridor points join line ends, land on lines they touch, and run straight with the building', () => {
  const lines = [[[0, 0], [20, 0]]];
  assert.deepEqual(snapPoint([19.4, 0.5], { lines }).pt, [20, 0]);
  const on = snapPoint([10, 0.6], { lines }); assert.equal(on.snapped, 'line'); assert.ok(Math.abs(on.pt[1]) < 1e-9);
  const st = snapPoint([10, 15], { lines: [], prev: [9, 5], axis: 0 }); assert.equal(st.snapped, 'axis'); assert.ok(Math.abs(st.pt[0] - 9) < 1e-9);
  assert.equal(snapPoint([15, 15], { lines: [], prev: [5, 5], axis: 0 }).snapped, null);      // a real diagonal stays diagonal
  assert.equal(snapHeadingToAxis(84, 0), 90);
  assert.equal(snapHeadingToAxis(135, 0), 135);
});

test('a walked corridor with a compass 12° out and steps 8 % long is put right by one fix at the far end', () => {
  const real = []; for (let i = 0; i <= 30; i++) real.push([i, 0]); for (let i = 1; i <= 20; i++) real.push([30, i]);
  const walked = real.map(([x, y]) => { const r = 12 * Math.PI / 180, k = 1.08; return [k * (x * Math.cos(r) - y * Math.sin(r)), k * (x * Math.sin(r) + y * Math.cos(r))]; });
  const before = Math.hypot(walked.at(-1)[0] - 30, walked.at(-1)[1] - 20);
  assert.ok(before > 6, `the walk alone ends ${before.toFixed(1)} m off`);
  const fix = anchorWalk(walked, [30, 20]);
  assert.ok(Math.hypot(fix.pts.at(-1)[0] - 30, fix.pts.at(-1)[1] - 20) < 1e-9);
  assert.ok(Math.hypot(fix.pts[30][0] - 30, fix.pts[30][1]) < 1e-6, 'the corner is back where it is');
  assert.ok(Math.abs(fix.turn - 12) < 1e-6 && Math.abs(fix.size - 1 / 1.08) < 1e-6);
});

test('a building drawn on the satellite photo becomes a DALIL map in the same place, with every place reachable', () => {
  const sk = newSketch({ name: 'Test Hall', ref: [55.4907, 25.3186] }); sk.outline = roof;
  const place = (n, c, x, y) => { const [e, nn] = turn20([x, y]); return linkPlace(sk, { nameEn: n, nameAr: '', category: c, e, n: nn }); };
  sk.floors[0].name = 'Ground floor';
  sk.floors[0].lines = [[[2, 20], [58, 20]].map(turn20), [[30, 20], [30, 38]].map(turn20)];
  sk.floors[0].places = [place('Main Entrance', 'entrance', 1, 20), place('Room 1', 'room', 15, 26), place('Lift', 'lift', 57, 20), place('Prayer Room', 'prayer', 30, 37)];
  addFloor(sk, 'First floor');
  assert.equal(sk.floors[1].places.length, 1, 'the lift is already on the next floor');
  sk.floors[1].lines = [[[57, 20], [20, 20]].map(turn20)]; sk.floors[1].places.push(place('Office', 'room', 22, 17));
  const maps = sketchToMaps(sk); assert.equal(maps.length, 2);
  const m = maps[0]; assert.equal(m.source.type, 'sketch'); assert.equal(m.building_context.footprint.length, 5); assert.equal(m.plan.walls[0].length, 5);
  // On Earth exactly where each place was tapped.
  const E = enu(sk.ref), W = planToWorld(m.geo);
  m.points.forEach((p, i) => { const src = sk.floors[0].places[i], en = E.to(W(p.x, p.y)); assert.ok(Math.hypot(en[0] - src.e, en[1] - src.n) < 0.03, `${p.nameEn} is ${en} not ${[src.e, src.n]}`); });
  // The plan is drawn square to the page with the long side across, though the building is 20° off north.
  const box = planBox(m); assert.ok(box.w > box.h);
  const [a, b] = m.plan.walls[0]; assert.ok(Math.abs(a[1] - b[1]) < 0.05 || Math.abs(a[0] - b[0]) < 0.05);
  const R = new Router(m);
  for (const p of m.points.slice(1)) assert.ok(R.distance('walk', m.points[0], p) > 1, `${p.nameEn} can be reached`);
  const d = R.distance('walk', m.points[0], m.points[1]); assert.ok(Math.abs(d - 20) < 3.5, `entrance → Room 1 is about 14 m along and 6 m in: ${d}`);
  assert.equal(maps[1].points.find(p => p.category === 'lift').link, m.points.find(p => p.category === 'lift').link);
  assert.deepEqual(maps.map(x => x.building.id), [sk.id, sk.id]);
});
