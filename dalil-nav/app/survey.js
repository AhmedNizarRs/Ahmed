// DALIL survey: map a building without a floor plan by walking it.
// The phone's compass + step counter (tracker.js) draw your trail in metres (x = east, y = north, from where you
// started); you mark places as you reach them; coming back to a marked place pulls the trail back into line;
// lifts and stairs link the floors. The result is a normal DALIL map (format 2): the walked corridors become the
// walkable grid the router uses, the places become search results, and the GPS fix at the start puts it on Earth.
// It maps where you walked, not the walls: corridors are drawn as lanes (plan.corridors), and plan.walls is empty.

const CORRIDOR = 0.9;        // metres either side of your trail that count as walkable
const CELL = 0.2;            // walkable grid cell (metres)
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'x';

export class Survey {
  constructor({ building, stride = 0.68 }) {
    this.building = building; this.stride = stride;
    this.floors = []; this.f = -1; this.pos = { x: 0, y: 0 }; this.origin = null; this.links = 0; this.steps = 0; this.dist = 0; this.paused = false;
  }
  get floor() { return this.floors[this.f]; }
  /** Start (or start a new floor) at x, y. origin = { lng, lat, acc } from GPS at the entrance (first floor only). */
  startFloor(name, { x = 0, y = 0, origin = null } = {}) {
    if (origin) this.origin = origin;
    this.floors.push({ name, id: slug(name), segs: [[{ x, y, k: 0 }]], places: [] });
    this.f = this.floors.length - 1; this.pos = { x, y };
  }
  /** One step, facing `heading` (degrees clockwise from north). */
  step(heading) {
    if (this.paused || heading == null || !this.floor) return;
    const h = heading * Math.PI / 180;
    this.pos = { x: this.pos.x + this.stride * Math.sin(h), y: this.pos.y + this.stride * Math.cos(h) };
    const seg = this.floor.segs[this.floor.segs.length - 1];
    seg.push({ x: this.pos.x, y: this.pos.y, k: ++this.steps }); this.dist += this.stride;
  }
  addPlace({ nameEn, nameAr = '', category = 'room', link = null }) {
    const fl = this.floor, id = 'P' + String(fl.places.length + 1).padStart(3, '0');
    const p = { id, nameEn, nameAr, category, x: this.pos.x, y: this.pos.y, k: this.steps, ...(link ? { link } : {}) };
    fl.places.push(p); return p;
  }
  /** You are back at a place you marked: spread the error since then along the trail (loop closure). */
  backAt(placeId) {
    const fl = this.floor, p = fl.places.find(q => q.id === placeId); if (!p) return 0;
    const dx = p.x - this.pos.x, dy = p.y - this.pos.y, err = Math.hypot(dx, dy), k0 = p.k, k1 = this.steps;
    if (k1 > k0) for (const seg of fl.segs) for (const q of seg) if (q.k > k0) { const f = (q.k - k0) / (k1 - k0); q.x += dx * f; q.y += dy * f; }
    for (const q of fl.places) if (q.k > k0 && q !== p) { const f = (q.k - k0) / Math.max(1, k1 - k0); q.x += dx * f; q.y += dy * f; }
    this.pos = { x: p.x, y: p.y }; fl.segs.push([{ x: p.x, y: p.y, k: this.steps }]);
    return err;
  }
  /** Take the lift or stairs at `placeId` to a new floor: the new floor starts at the same spot, linked to it. */
  changeFloor(placeId, newName) {
    const fl = this.floor, p = fl.places.find(q => q.id === placeId); if (!p) return null;
    if (!p.link) p.link = (p.category === 'lift' ? 'LIFT-' : 'STAIR-') + (++this.links);
    const existing = this.floors.findIndex(x => x.name === newName);
    if (existing >= 0) { this.f = existing; this.pos = { x: p.x, y: p.y }; this.floor.segs.push([{ x: p.x, y: p.y, k: this.steps }]); }
    else this.startFloor(newName, { x: p.x, y: p.y });
    if (!this.floor.places.some(q => q.link === p.link)) { const q = this.addPlace({ nameEn: p.nameEn, nameAr: p.nameAr, category: p.category, link: p.link }); q.x = p.x; q.y = p.y; }
    return this.floor;
  }
  /** The trail as polylines (for drawing). */
  trail(fi = this.f) { return (this.floors[fi]?.segs || []).filter(s => s.length > 1).map(s => s.map(q => [q.x, q.y])); }
  /** One DALIL map per floor. */
  toMaps() {
    const bid = slug(this.building), when = new Date().toISOString();
    return this.floors.map((fl, i) => buildFloorMap({
      building: { id: bid, name: this.building }, floor: { id: fl.id || 'floor-' + (i + 1), name: fl.name, level: i },
      lines: this.trail(i).map(simplify), places: fl.places, origin: this.origin, when,
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

export function buildFloorMap({ building, floor, lines, places, origin, when = new Date().toISOString() }) {
  const pts = lines.flat().concat(places.map(p => [p.x, p.y]));
  if (!pts.length) pts.push([0, 0]);
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  // Move the plan so its corner (with a 3 m margin) is 0,0, as the Mapper does; the GPS origin moves with it.
  const ox = Math.floor(a - 3), oy = Math.floor(b - 3), sh = ([x, y]) => [x - ox, y - oy];
  lines = lines.map(L => L.map(sh)); places = places.map(p => ({ ...p, x: p.x - ox, y: p.y - oy }));
  if (origin) { const r = Math.PI / 180, mlng = 111412.84 * Math.cos(origin.lat * r), mlat = 111132.92 - 559.82 * Math.cos(2 * origin.lat * r); origin = { ...origin, lng: origin.lng + ox / mlng, lat: origin.lat + oy / mlat }; }
  const x0 = 0, y0 = 0, W = Math.ceil((c + 3 - ox) / CELL), H = Math.ceil((d + 3 - oy) / CELL);
  const grid = r => {
    const occ = new Uint8Array(W * H).fill(1);
    const carve = (p, q) => {
      const i0 = Math.max(0, Math.floor((Math.min(p[0], q[0]) - r - x0) / CELL)), i1 = Math.min(W - 1, Math.floor((Math.max(p[0], q[0]) + r - x0) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(p[1], q[1]) - r - y0) / CELL)), j1 = Math.min(H - 1, Math.floor((Math.max(p[1], q[1]) + r - y0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist([x0 + (i + .5) * CELL, y0 + (j + .5) * CELL], p, q) <= r) occ[j * W + i] = 0;
    };
    for (const L of lines) for (let k = 1; k < L.length; k++) carve(L[k - 1], L[k]);
    for (const p of places) carve([p.x, p.y], [p.x, p.y]);
    return occ;
  };
  const r2 = v => Math.round(v * 100) / 100;
  return {
    format: 'dalil-map', version: 2, generated: when,
    building, floor, units: 'm',
    source: { type: 'survey', method: 'walked with a phone (compass + step counter)', note: 'Corridors are where the surveyor walked; walls are not mapped.' },
    clearance: { walk: 0, wheelchair: 0 }, grid: { cell: CELL },
    points: places.map((p, i) => ({ id: p.id || 'P' + String(i + 1).padStart(3, '0'), nameEn: p.nameEn, nameAr: p.nameAr || '', category: p.category, dalilNode: p.category === 'entrance', facingDeg: 90, x: r2(p.x), y: r2(p.y), ...(p.link ? { link: p.link } : {}) })),
    plan: { walls: [], doors: [], corridors: lines.map(L => L.map(([x, y]) => [r2(x), r2(y)])), corridorWidth: CORRIDOR * 2 },
    ...(origin ? { geo: { origin: [origin.lng, origin.lat], bearing: 0, scale: 1, source: `DALIL survey: GPS at the start (±${Math.round(origin.acc)} m) and the compass` } } : {}),
    closures: [],
    nav: { encoding: 'rle-varint-base64', cell: CELL, x0, y0, W, H, speed: { walk: 1.1, chair: 0.8 }, walk: encodeGrid(grid(CORRIDOR)), chair: encodeGrid(grid(CORRIDOR - 0.15)) },
    routes: { walk: {}, chair: {} },
  };
}
