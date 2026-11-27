// DALIL survey v2: map a building without a floor plan by walking it — made accurate enough to navigate by.
//
// What goes wrong when you walk-map with a phone, and what this does about each:
//  1. The compass drifts indoors (steel, wiring: 10–30°). Buildings are built on a grid, so the main corridor
//     directions are found from the whole walk (the dominant heading, modulo 90°) and every step within 20° of
//     one of them is snapped to it. Straight corridors come out straight, square corners square.
//  2. Step length differs per person: it comes from your height (0.415 × height), or a pace setting.
//  3. Error builds up along the walk. Every time you are back at a place you marked (you say so, or the app
//     notices and asks), that is a loop. All loops are solved together (least squares on the step vectors with
//     the loops as exact constraints), so overlapping loops share the correction instead of fighting.
//  4. Turning on the spot makes the step counter fire: steps taken while turning fast are not counted forward.
//  5. You need to know if the map is good: each loop's mismatch, as a % of its length, gives the drift, and the
//     floor is rated Good (< 3 %), OK (< 7 %) or Rough — or "Unchecked" when you never closed a loop.
// The result is a normal DALIL map (format 2): walked corridors become the walkable grid, places become search
// results, the GPS fix at the entrance (and an optional manual line-up with the satellite photo) puts it on Earth.

const CORRIDOR = 0.9;        // metres either side of your trail that count as walkable
const CELL = 0.2;            // walkable grid cell (metres)
const SNAP_TOL = 20;         // degrees: steps this close to a building axis are snapped to it
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'x';
const D2R = Math.PI / 180, wrap = a => ((a % 360) + 360) % 360, wrap180 = a => { a = wrap(a); return a > 180 ? a - 360 : a; };

export const strideFromHeight = cm => Math.max(0.45, Math.min(0.95, 0.415 * cm / 100));

/** The building's grid: the dominant heading modulo 90° (circular mean of 4·heading). null when unclear. */
export function buildingAxis(headings) {
  let sx = 0, sy = 0;
  for (const h of headings) { sx += Math.cos(4 * h * D2R); sy += Math.sin(4 * h * D2R); }
  if (!headings.length || Math.hypot(sx, sy) / headings.length < 0.35) return null;   // no clear grid (round or diagonal building)
  return wrap(Math.atan2(sy, sx) / D2R / 4);
}
/** Snap a heading to the nearest of the 4 axis directions if within SNAP_TOL, else keep it. */
export function snapHeading(h, axis) {
  if (axis == null) return h;
  const rel = wrap180(h - axis), q = Math.round(rel / 90) * 90;
  return Math.abs(rel - q) <= SNAP_TOL ? wrap(axis + q) : h;
}
// A 5-step running median of headings (steps sway left and right as you walk).
function smooth(hs) {
  return hs.map((_, i) => {
    const w = hs.slice(Math.max(0, i - 2), i + 3), ref = hs[i];
    const rel = w.map(h => wrap180(h - ref)).sort((a, b) => a - b);
    return wrap(ref + rel[rel.length >> 1]);
  });
}

/**
 * Least-squares loop closure. Edge vectors d[0..n-1] (step j goes from node j to node j+1); loops say node a and
 * node b are the same place (a < b). Find corrections c with the smallest Σ|c|² such that every loop closes:
 * Σ_{j=a..b-1} (d_j + c_j) = 0. Closed form: c = −Gᵀ (G Gᵀ)⁻¹ r, where G's rows are 0/1 over each loop's steps.
 */
export function closeLoops(d, loops) {
  const m = loops.length; if (!m) return d.map(v => [v[0], v[1]]);
  const r = loops.map(({ a, b }) => { let x = 0, y = 0; for (let j = a; j < b; j++) { x += d[j][0]; y += d[j][1]; } return [x, y]; });
  const M = loops.map(p => loops.map(q => Math.max(0, Math.min(p.b, q.b) - Math.max(p.a, q.a))));   // G Gᵀ: shared steps
  const solve = rhs => {                                   // Gaussian elimination with partial pivoting (m is small)
    const A = M.map((row, i) => [...row, rhs[i]]);
    for (let c = 0; c < m; c++) {
      let p = c; for (let i = c + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
      [A[c], A[p]] = [A[p], A[c]]; const v = A[c][c] || 1e-9;
      for (let i = 0; i < m; i++) if (i !== c) { const f = A[i][c] / v; for (let k = c; k <= m; k++) A[i][k] -= f * A[c][k]; }
    }
    return A.map((row, i) => row[m] / (row[i] || 1e-9));
  };
  const lx = solve(r.map(v => v[0])), ly = solve(r.map(v => v[1]));
  return d.map((v, j) => { let cx = 0, cy = 0; loops.forEach((l, i) => { if (j >= l.a && j < l.b) { cx += lx[i]; cy += ly[i]; } }); return [v[0] - cx, v[1] - cy]; });
}

export class Survey {
  constructor({ building, stride = 0.68 }) {
    this.v = 2; this.building = building; this.stride = stride;
    this.floors = []; this.f = -1; this.origin = null; this.links = 0; this.steps = 0; this.dist = 0; this.paused = false;
    this.align = { rot: 0, dx: 0, dy: 0, scale: 1 };     // manual line-up with the satellite photo (degrees, metres, factor)
  }
  get floor() { return this.floors[this.f]; }
  /** Start (or start a new floor) at x, y. origin = { lng, lat, acc } from GPS at the entrance (first floor only). */
  startFloor(name, { x = 0, y = 0, origin = null } = {}) {
    if (origin) this.origin = origin;
    this.floors.push({ name, id: slug(name), start: [x, y], h: [], breaks: [0], places: [], loops: [] });
    this.f = this.floors.length - 1; this._cache = null;
  }
  /** One step, facing `heading` (degrees clockwise from north). turning = the phone is turning fast (not a step forward). */
  step(heading, { turning = false } = {}) {
    if (this.paused || heading == null || !this.floor || turning) return false;
    this.floor.h.push(wrap(heading)); this.steps++; this.dist += this.stride; this._cache = null;
    return true;
  }
  /** Step index on this floor where you are now. */
  get k() { return this.floor ? this.floor.h.length : 0; }
  /** Solved positions for a floor: [[x, y] per node] (node 0 = where the floor started), plus the axis and drift. */
  solve(fi = this.f) {
    const fl = this.floors[fi]; if (!fl) return { pos: [], axis: null, loops: [] };
    if (this._cache && this._cache.fi === fi && this._cache.n === fl.h.length && this._cache.nl === fl.loops.length) return this._cache.res;
    // A jump (back on this floor by lift or stairs) puts you at the matching place: node k = node `to`, no steps between.
    const jumps = new Map((fl.jumps || []).map(j => [j.k, j.to])), walk = fl.h.filter((_, j) => !jumps.has(j));
    const hs = smooth(fl.h.map((h, j) => jumps.has(j) ? (fl.h[j - 1] ?? h) : h)), axis = buildingAxis(smooth(walk));
    const d = hs.map((h, j) => { if (jumps.has(j)) return [0, 0]; const r = snapHeading(h, axis) * D2R; return [this.stride * Math.sin(r), this.stride * Math.cos(r)]; });
    const loops = fl.loops.filter(l => ![...jumps.keys()].some(k => k >= l.a && k < l.b));   // loops across a jump are not plain sums
    const loopsBefore = loops.map(({ a, b }) => { let x = 0, y = 0; for (let j = a; j < b; j++) { x += d[j][0]; y += d[j][1]; } return { a, b, err: Math.hypot(x, y), len: (b - a) * this.stride }; });
    const e = closeLoops(d, loops);
    const pos = [fl.start.slice()];
    e.forEach((v, j) => { const p = jumps.has(j) ? pos[jumps.get(j)].slice() : pos[pos.length - 1]; pos.push([p[0] + v[0], p[1] + v[1]]); });
    const res = { pos, axis, loops: loopsBefore };
    this._cache = { fi, n: fl.h.length, nl: fl.loops.length, res };
    return res;
  }
  get pos() { const s = this.solve(); const p = s.pos[s.pos.length - 1] || [0, 0]; return { x: p[0], y: p[1] }; }
  addPlace({ nameEn, nameAr = '', category = 'room', link = null }) {
    const fl = this.floor, id = 'P' + String(fl.places.length + 1).padStart(3, '0');
    const p = { id, nameEn, nameAr, category, k: this.k, ...(link ? { link } : {}) };
    fl.places.push(p); return p;
  }
  placeXY(p, fi = this.f) { const s = this.solve(fi); const q = s.pos[Math.min(p.k, s.pos.length - 1)] || [0, 0]; return { x: q[0], y: q[1] }; }
  /** You are back at a place you marked: a loop. Returns how far off the walk was (metres) before the fix. */
  backAt(placeId) {
    const fl = this.floor, p = fl.places.find(q => q.id === placeId); if (!p) return 0;
    const before = this.pos, at = this.placeXY(p), err = Math.hypot(before.x - at.x, before.y - at.y);
    if (this.k > p.k) { fl.loops.push({ a: p.k, b: this.k }); this._cache = null; }
    return err;
  }
  /** A marked place close to where you are now, walked past a while ago: worth asking "back at it?". */
  nearbyPlace(radius = 3, minSteps = 15) {
    const fl = this.floor; if (!fl) return null; const here = this.pos; let best = null, bd = radius;
    for (const p of fl.places) {
      if (this.k - p.k < minSteps || fl.loops.some(l => l.b > this.k - 8)) continue;   // just walked from it, or a loop was just closed
      const q = this.placeXY(p), dd = Math.hypot(q.x - here.x, q.y - here.y); if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  }
  /** Take the lift or stairs at `placeId` to a new floor: the new floor starts at the same spot, linked to it. */
  changeFloor(placeId, newName) {
    const fl = this.floor, p = fl.places.find(q => q.id === placeId); if (!p) return null;
    if (!p.link) p.link = (p.category === 'lift' ? 'LIFT-' : 'STAIR-') + (++this.links);
    const at = this.placeXY(p), existing = this.floors.findIndex(x => x.name === newName);
    if (existing >= 0) {                              // back on a floor you mapped: continue from its matching lift/stairs
      this.f = existing; const fl2 = this.floor, q = fl2.places.find(o => o.link === p.link);
      if (q) { fl2.jumps = (fl2.jumps || []).concat([{ k: fl2.h.length, to: q.k }]); fl2.h.push(fl2.h[fl2.h.length - 1] ?? 0); }
      fl2.breaks.push(fl2.h.length);                  // the trail restarts here (a jump, not a walk)
    } else this.startFloor(newName, { x: at.x, y: at.y });
    if (!this.floor.places.some(q => q.link === p.link)) this.addPlace({ nameEn: p.nameEn, nameAr: p.nameAr, category: p.category, link: p.link });
    this._cache = null; return this.floor;
  }
  /** The trail as polylines (for drawing). */
  trail(fi = this.f) {
    const fl = this.floors[fi]; if (!fl) return [];
    const { pos } = this.solve(fi), cuts = [...new Set([0, ...fl.breaks, pos.length - 1])].sort((a, b) => a - b), out = [];
    for (let i = 0; i < cuts.length - 1; i++) { const s = pos.slice(cuts[i], cuts[i + 1] + 1); if (s.length > 1) out.push(s); }
    return out;
  }
  /** Accuracy of a floor: { rating: 'good'|'ok'|'rough'|'unchecked', drift (fraction), loops, dist }. */
  quality(fi = this.f) {
    const fl = this.floors[fi], { loops } = this.solve(fi), dist = (fl?.h.length || 0) * this.stride;
    if (!loops.length) return { rating: 'unchecked', drift: null, loops: 0, dist };
    const err = loops.reduce((a, l) => a + l.err, 0), len = loops.reduce((a, l) => a + l.len, 0), drift = len ? err / len : 0;
    return { rating: drift < 0.03 ? 'good' : drift < 0.07 ? 'ok' : 'rough', drift, loops: loops.length, dist };
  }
  /** One DALIL map per floor. */
  toMaps() {
    const bid = slug(this.building), when = new Date().toISOString();
    return this.floors.map((fl, i) => buildFloorMap({
      building: { id: bid, name: this.building }, floor: { id: fl.id || 'floor-' + (i + 1), name: fl.name, level: i },
      lines: this.trail(i).map(L => simplify(L)), places: fl.places.map(p => ({ ...p, ...this.placeXY(p, i) })),
      origin: this.origin, align: this.align, quality: this.quality(i), when,
    }));
  }
}

// Douglas–Peucker: keep the shape, drop the step-by-step wobble (tolerance 0.35 m).
export function simplify(pts, tol = 0.35) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let best = -1, bd = tol;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[i], pts[a], pts[b]); if (d > bd) { bd = d; best = i; } }
    if (best > 0) { keep[best] = 1; st.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function segDist([px, py], [ax, ay], [bx, by]) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0; return Math.hypot(ax + t * dx - px, ay + t * dy - py); }

/** Run lengths over the grid (row by row, starting with a free run) as LEB128 varints, base64 (map format 2). */
export function encodeGrid(occ) {
  const bytes = []; let cur = 0, run = 0;
  const put = v => { do { let b = v & 127; v = Math.floor(v / 128); if (v) b |= 128; bytes.push(b); } while (v); };
  for (let i = 0; i < occ.length; i++) { if (occ[i] !== cur) { put(run); run = 0; cur ^= 1; } run++; }
  put(run);
  let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(s);
}

/** geo for a plan whose (0,0) sits `ox, oy` metres from the start, the start at GPS `origin`, with a manual line-up. */
export function surveyGeo(origin, ox, oy, align = { rot: 0, dx: 0, dy: 0, scale: 1 }) {
  if (!origin) return null;
  const r = Math.PI / 180, mlng = 111412.84 * Math.cos(origin.lat * r), mlat = 111132.92 - 559.82 * Math.cos(2 * origin.lat * r);
  const b = (align.rot || 0) * r, k = align.scale || 1;
  // plan point (x, y) → east/north from the start: rotate by the line-up angle, scale, then shift
  const e = k * (ox * Math.cos(b) + oy * Math.sin(b)) + (align.dx || 0), n = k * (-ox * Math.sin(b) + oy * Math.cos(b)) + (align.dy || 0);
  return { origin: [origin.lng + e / mlng, origin.lat + n / mlat], bearing: align.rot || 0, scale: k };
}

// walls (optional): outline polylines drawn with the plan (the building's edge traced on the satellite photo).
// source / geoSource / context (optional): what made the map, how it was placed, and building_context to carry.
export function buildFloorMap({ building, floor, lines, places, origin, align, quality, walls = [], source = null, geoSource = null, context = null, when = new Date().toISOString() }) {
  const pts = lines.flat().concat(places.map(p => [p.x, p.y]), walls.flat());
  if (!pts.length) pts.push([0, 0]);
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  // Move the plan so its corner (with a 3 m margin) is 0,0, as the Mapper does; the GPS origin moves with it.
  const ox = Math.floor(a - 3), oy = Math.floor(b - 3), sh = ([x, y]) => [x - ox, y - oy];
  lines = lines.map(L => L.map(sh)); walls = walls.map(L => L.map(sh)); places = places.map(p => ({ ...p, x: p.x - ox, y: p.y - oy }));
  const W = Math.ceil((c + 3 - ox) / CELL), H = Math.ceil((d + 3 - oy) / CELL);
  const grid = r => {
    const occ = new Uint8Array(W * H).fill(1);
    const carve = (p, q) => {
      const i0 = Math.max(0, Math.floor((Math.min(p[0], q[0]) - r) / CELL)), i1 = Math.min(W - 1, Math.floor((Math.max(p[0], q[0]) + r) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(p[1], q[1]) - r) / CELL)), j1 = Math.min(H - 1, Math.floor((Math.max(p[1], q[1]) + r) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist([(i + .5) * CELL, (j + .5) * CELL], p, q) <= r) occ[j * W + i] = 0;
    };
    for (const L of lines) for (let k = 1; k < L.length; k++) carve(L[k - 1], L[k]);
    for (const p of places) carve([p.x, p.y], [p.x, p.y]);
    return occ;
  };
  const r2 = v => Math.round(v * 100) / 100, geo = surveyGeo(origin, ox, oy, align);
  return {
    format: 'dalil-map', version: 2, generated: when,
    building, floor, units: 'm',
    source: source || { type: 'survey', version: 2, method: 'walked with a phone: compass snapped to the building grid, steps from height, loops solved together', note: 'Corridors are where the surveyor walked; walls are not mapped.', ...(quality ? { quality: { rating: quality.rating, drift: quality.drift == null ? null : Math.round(quality.drift * 1000) / 1000, loops: quality.loops, distance_m: Math.round(quality.dist) } } : {}) },
    clearance: { walk: 0, wheelchair: 0 }, grid: { cell: CELL },
    points: places.map((p, i) => ({ id: p.id || 'P' + String(i + 1).padStart(3, '0'), nameEn: p.nameEn, nameAr: p.nameAr || '', category: p.category, ...(p.gender ? { gender: p.gender } : {}), ...(p.doors ? { doors: p.doors } : {}), dalilNode: p.category === 'entrance', facingDeg: 90, x: r2(p.x), y: r2(p.y), ...(p.link ? { link: p.link } : {}) })),
    plan: { walls: walls.map(L => L.map(([x, y]) => [r2(x), r2(y)])), doors: [], corridors: lines.map(L => L.map(([x, y]) => [r2(x), r2(y)])), corridorWidth: CORRIDOR * 2 },
    ...(context ? { building_context: context } : {}),
    ...(geo ? { geo: { ...geo, source: geoSource || `DALIL survey: GPS at the start (±${Math.round(origin.acc)} m), compass snapped to the building grid${align && (align.rot || align.dx || align.dy || align.scale !== 1) ? ', lined up by hand with the satellite photo' : ''}` } } : {}),
    closures: [],
    nav: { encoding: 'rle-varint-base64', cell: CELL, x0: 0, y0: 0, W, H, speed: { walk: 1.1, chair: 0.8 }, walk: encodeGrid(grid(CORRIDOR)), chair: encodeGrid(grid(CORRIDOR - 0.15)) },
    routes: { walk: {}, chair: {} },
  };
}
