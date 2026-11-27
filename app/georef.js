// DALIL georeferencing: where a floor plan sits on Earth, worked out from points you match between the plan and
// the satellite photo (founder, Nov 2026: "when I import a floor plan the location should be accurate and synced
// between the exterior and interior maps").
//
// A map's `geo` is { origin: [lng, lat] (where plan 0,0 is), bearing (plan +y, degrees clockwise from north),
// scale (real metres per plan metre) }. The same convention as outdoor.js geoTransform and locate.js planFromGeo:
//   east  = scale · ( x·cos b + y·sin b)
//   north = scale · (−x·sin b + y·cos b)
// With plan z = x + i·y and world w = east + i·north this is w = a·z + t, a = scale·e^(−i·b): a similarity
// (move + turn + one size). Two matched points fix it exactly; more points are solved by least squares, and the
// leftover misfit of each point says how good the match is.

const R = Math.PI / 180;
// Metres per degree at a latitude: the same two-term form the app's other modules use, so plan ↔ world round-trips exactly.
const mpd = lat => ({ lng: 111412.84 * Math.cos(lat * R), lat: 111132.92 - 559.82 * Math.cos(2 * lat * R) });

/** [lng, lat] → [east, north] metres from `ref`, and back. */
export function enu(ref) {
  const m = mpd(ref[1]);
  return { to: ([lng, lat]) => [(lng - ref[0]) * m.lng, (lat - ref[1]) * m.lat], from: ([e, n]) => [ref[0] + e / m.lng, ref[1] + n / m.lat] };
}
/** Plan metres → [lng, lat] for a geo (same maths as outdoor.js geoTransform). */
export function planToWorld(geo) {
  const b = geo.bearing * R, k = geo.scale || 1, m = mpd(geo.origin[1]), c = Math.cos(b), s = Math.sin(b);
  return (x, y) => [geo.origin[0] + k * (x * c + y * s) / m.lng, geo.origin[1] + k * (-x * s + y * c) / m.lat];
}
/** [lng, lat] → plan metres for a geo. */
export function worldToPlan(geo) {
  const b = geo.bearing * R, k = geo.scale || 1, m = mpd(geo.origin[1]), c = Math.cos(b), s = Math.sin(b);
  return (lng, lat) => { const e = (lng - geo.origin[0]) * m.lng / k, n = (lat - geo.origin[1]) * m.lat / k; return [e * c - n * s, e * s + n * c]; };
}
const wrap180 = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
const round = (v, d) => { const f = 10 ** d; return Math.round(v * f) / f; };
export const tidyGeo = g => ({ origin: [round(g.origin[0], 8), round(g.origin[1], 8)], bearing: round(wrap180(g.bearing), 3), scale: round(g.scale, 5) });

/**
 * Fit a plan to the world from matched points.
 * pairs: [{ plan: [x, y], world: [lng, lat] }], at least 2 (1 is enough when `bearing` and `scale` are both given).
 * opts.scale: keep this size (e.g. 1 when the plan was measured with a tape) and only move and turn it.
 * opts.bearing: keep this direction (with one point).
 * Returns { geo, rms, residuals (metres per pair), baseline (metres between the farthest pair), scaleFree }, or
 * { error } when the points cannot fix the plan (too few, or on top of each other).
 */
export function fitGeo(pairs, { scale = null, bearing = null } = {}) {
  const P = (pairs || []).filter(p => p && p.plan && p.world && p.plan.every(Number.isFinite) && p.world.every(Number.isFinite));
  if (!P.length) return { error: 'none' };
  if (P.length === 1) {
    if (bearing == null) return { error: 'few' };
    const k = scale || 1, b = bearing * R, [x, y] = P[0].plan, m = mpd(P[0].world[1]);
    const e = k * (x * Math.cos(b) + y * Math.sin(b)), n = k * (-x * Math.sin(b) + y * Math.cos(b));
    return { geo: tidyGeo({ origin: [P[0].world[0] - e / m.lng, P[0].world[1] - n / m.lat], bearing, scale: k }), rms: 0, residuals: [0], baseline: 0, scaleFree: k };
  }
  let base = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) base = Math.max(base, Math.hypot(P[i].plan[0] - P[j].plan[0], P[i].plan[1] - P[j].plan[1]));
  if (base < 1e-6) return { error: 'same' };
  // Solve about a reference point, then once more about the origin it gives (so the metres-per-degree used here are
  // the ones geoTransform will use at that origin).
  let ref = [P.reduce((a, p) => a + p.world[0], 0) / P.length, P.reduce((a, p) => a + p.world[1], 0) / P.length], out = null;
  for (let pass = 0; pass < 3; pass++) {
    const E = enu(ref), W = P.map(p => E.to(p.world)), n = P.length;
    const zx = P.reduce((a, p) => a + p.plan[0], 0) / n, zy = P.reduce((a, p) => a + p.plan[1], 0) / n;
    const wx = W.reduce((a, w) => a + w[0], 0) / n, wy = W.reduce((a, w) => a + w[1], 0) / n;
    let sr = 0, si = 0, zz = 0;                                  // S = Σ (w − w̄)·conj(z − z̄)
    P.forEach((p, i) => { const a = p.plan[0] - zx, b = p.plan[1] - zy, c = W[i][0] - wx, d = W[i][1] - wy; sr += c * a + d * b; si += d * a - c * b; zz += a * a + b * b; });
    const mag = Math.hypot(sr, si); if (mag < 1e-12) return { error: 'same' };
    const kFree = mag / zz, k = scale || kFree, ar = k * sr / mag, ai = k * si / mag;      // a = k·e^(−i·b)
    const tx = wx - (ar * zx - ai * zy), ty = wy - (ai * zx + ar * zy);
    const residuals = P.map((p, i) => Math.hypot(ar * p.plan[0] - ai * p.plan[1] + tx - W[i][0], ai * p.plan[0] + ar * p.plan[1] + ty - W[i][1]));
    const origin = E.from([tx, ty]);
    out = { geo: { origin, bearing: -Math.atan2(ai, ar) / R, scale: k }, rms: Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / n), residuals, baseline: base * k, scaleFree: kFree };
    ref = origin;
  }
  out.geo = tidyGeo(out.geo);
  return out;
}

/** Fine-tune a geo by hand: move it east/north (metres), turn it (degrees, clockwise) and resize it (factor) about
 *  a plan point `pivot` (the plan's middle), so turning does not swing the building away. */
export function nudgeGeo(geo, { east = 0, north = 0, turn = 0, size = 1 } = {}, pivot = [0, 0]) {
  const world = planToWorld(geo)(pivot[0], pivot[1]), m = mpd(world[1]);
  const moved = [world[0] + east / m.lng, world[1] + north / m.lat];
  return fitGeo([{ plan: pivot, world: moved }], { bearing: geo.bearing + turn, scale: (geo.scale || 1) * size }).geo;
}

/** Another floor of a building whose floor moved from geo `a0` to `a1`: move it the same way (`b0` = its geo, box = its plan box). */
export function carryGeo(a0, a1, b0, box) {
  const out = planToWorld(b0), back = worldToPlan(a0), on = planToWorld(a1);
  const pts = [[box.minX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]];
  return fitGeo(pts.map(p => { const w = out(p[0], p[1]), q = back(w[0], w[1]); return { plan: p, world: on(q[0], q[1]) }; })).geo;
}

/** A ring of [lng, lat] that belongs to a plan (an outline traced with it), after the plan moved from geo `a0` to `a1`. */
export function moveRing(ring, a0, a1) {
  const back = worldToPlan(a0), on = planToWorld(a1);
  return ring.map(([lng, lat]) => { const q = back(lng, lat); return on(q[0], q[1]).map(v => Math.round(v * 1e7) / 1e7); });
}

/** How far a matched point may be off, in words: 'good' | 'ok' | 'rough'. Two points always fit exactly, so the
 *  rating then comes from how far apart they are (a short baseline turns a 1 m tapping error into a big twist). */
export function fitRating({ rms, baseline }, n) {
  if (n >= 3) return rms <= 1.5 ? 'good' : rms <= 4 ? 'ok' : 'rough';
  return baseline >= 25 ? 'ok' : 'rough';
}

/** The plan's box in plan metres from its walls, corridors and places. */
export function planBox(map) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const add = ([x, y]) => { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; };
  for (const L of map.plan?.walls || []) L.forEach(add);
  for (const L of map.plan?.corridors || []) L.forEach(add);
  for (const p of map.points || []) add([p.x, p.y]);
  if (a === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1, cx: .5, cy: .5 };
  return { minX: a, minY: b, maxX: c, maxY: d, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 };
}

/** "25.3186, 55.4907", "25.3186 55.4907" or a maps link with @lat,lng / ?q=lat,lng → [lng, lat], or null. */
export function parseLatLng(text) {
  const s = String(text || '');
  const m = s.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|ll|query|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i) || s.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}
