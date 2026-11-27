// On-device routing for dalil-map v2 files (map.nav = walkable grids exported by the Mapper).
// Same algorithm and wording as the Mapper: 8-connected grid, no corner cutting, string-pulled paths,
// bilingual turn-by-turn steps. One distance field per source is cached, so a route or a distance
// from the same start costs one search; later routes from that start are almost free.

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

function decodeGrid(nav, b64) {
  const bin = atob(b64), N = nav.W * nav.H, occ = new Uint8Array(N);
  let i = 0, k = 0, cur = 0;
  while (i < bin.length && k <= N) {
    let v = 0, mul = 1, byte;
    do { byte = bin.charCodeAt(i++); v += (byte & 127) * mul; mul *= 128; } while (byte & 128);
    if (cur) occ.fill(1, k, Math.min(N, k + v));
    k += v; cur ^= 1;
  }
  return occ;
}
const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(a[0] + t * dx - px, a[1] + t * dy - py); };

// Easiest route, not just the shortest (founder, Nov 2026: "the easiest path, the closest path"): a cell close to a wall
// costs a little more, so routes keep to the middle of corridors and open halls instead of squeezing past furniture,
// door frames and room corners. It never adds more than a few metres; distances shown are still true metres.
const EASE_M = 1.0, EASE_K = 0.5;
function clearance(g) {
  const { W, H, occ } = g, d = new Float32Array(W * H), INF = 1e9;
  for (let k = 0; k < W * H; k++) d[k] = occ[k] ? 0 : INF;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!d[k]) continue; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1); if (j > 0) { v = Math.min(v, d[k - W] + 1); if (i > 0) v = Math.min(v, d[k - W - 1] + 1.414); if (i < W - 1) v = Math.min(v, d[k - W + 1] + 1.414); } d[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (!d[k]) continue; let v = d[k];
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1); if (j < H - 1) { v = Math.min(v, d[k + W] + 1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + 1.414); if (i > 0) v = Math.min(v, d[k + W - 1] + 1.414); } d[k] = v; }
  return d;
}
class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop(); if (k.length) { let i = 0; const n = k.length; while (true) { const l = 2 * i + 1, r = l + 1; let m = i, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) m = r; if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; }
}

export class Router {
  constructor(map) { this.map = map; this.grids = {}; this.fields = new Map(); }

  grid(mode) {
    if (this.grids[mode]) return this.grids[mode];
    const n = this.map.nav, occ = decodeGrid(n, n[mode]);
    const g = { W: n.W, H: n.H, x0: n.x0, y0: n.y0, cell: n.cell, occ };
    // Temporary closures block a band along their line (already-inflated grid, so a line from wall to wall seals the corridor).
    for (const c of this.map.closures || []) {
      const w = Math.max(0.3, (c.width_m || 0.6) / 2), [ax, ay] = c.a, [bx, by] = c.b;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - w - g.x0) / g.cell)), i1 = Math.min(g.W - 1, Math.floor((Math.max(ax, bx) + w - g.x0) / g.cell));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - w - g.y0) / g.cell)), j1 = Math.min(g.H - 1, Math.floor((Math.max(ay, by) + w - g.y0) / g.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist(g.x0 + (i + 0.5) * g.cell, g.y0 + (j + 0.5) * g.cell, c.a, c.b) <= w) occ[j * g.W + i] = 1;
    }
    g.clr = clearance(g);
    return (this.grids[mode] = g);
  }

  snap(g, x, y) {
    let i = Math.min(g.W - 1, Math.max(0, Math.floor((x - g.x0) / g.cell))), j = Math.min(g.H - 1, Math.max(0, Math.floor((y - g.y0) / g.cell)));
    if (!g.occ[j * g.W + i]) return j * g.W + i;
    const maxR = Math.ceil(2.5 / g.cell);
    for (let rr = 1; rr <= maxR; rr++) {
      let best = -1, bd = 1e9;
      for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rr) continue;
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= g.W || b >= g.H) continue;
        const k = b * g.W + a; if (!g.occ[k]) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; } }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // Can a person stand here? (within 2.5 m of free space)
  walkable(x, y, mode = 'walk') { return this.snap(this.grid(mode), x, y) >= 0; }

  // Full Dijkstra from one spot; cached (small LRU, a field is 4 bytes per cell).
  field(mode, x, y) {
    const key = `${mode}|${x.toFixed(2)},${y.toFixed(2)}`;
    if (this.fields.has(key)) { const f = this.fields.get(key); this.fields.delete(key); this.fields.set(key, f); return f; }
    const g = this.grid(mode), src = this.snap(g, x, y);
    const f = { src, dist: null };
    if (src >= 0) {
      const { W, H, occ, clr } = g, dist = new Float32Array(W * H).fill(Infinity), len = new Float32Array(W * H).fill(Infinity), done = new Uint8Array(W * H), hp = new Heap();
      const easeCells = EASE_M / g.cell, wgt = n => 1 + (clr[n] < easeCells ? EASE_K * (1 - clr[n] / easeCells) : 0);
      dist[src] = 0; len[src] = 0; hp.push(0, src);
      while (hp.size) {
        const k = hp.pop(); if (done[k]) continue; done[k] = 1;
        const i = k % W, j = (k / W) | 0, dk = dist[k];
        for (const [di, dj, c] of NB) {
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const n = b * W + a; if (occ[n] || done[n]) continue;
          if (di && dj && (occ[j * W + a] || occ[b * W + i])) continue;
          const nd = dk + c * wgt(n); if (nd < dist[n]) { dist[n] = nd; len[n] = len[k] + c; hp.push(nd, n); }
        }
      }
      f.dist = dist; f.len = len;
    }
    this.fields.set(key, f);
    while (this.fields.size > 12) this.fields.delete(this.fields.keys().next().value);
    return f;
  }

  // Grid distance in metres from A to B (fast once A's field exists).
  distance(mode, A, B) {
    const g = this.grid(mode), f = this.field(mode, A.x, A.y), t = this.snap(g, B.x, B.y);
    return f.dist && t >= 0 && isFinite(f.dist[t]) ? f.len[t] * g.cell : null;
  }

  los(g, ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / (g.cell * 0.4));
    for (let s = 1; s < n; s++) { const x = ax + (bx - ax) * s / n, y = ay + (by - ay) * s / n; const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((y - g.y0) / g.cell); if (i < 0 || j < 0 || i >= g.W || j >= g.H || g.occ[j * g.W + i]) return false; }
    return true;
  }

  // Route A → B. fromEnd: search from B instead (shares one field for many starts, e.g. every lift to one room).
  route(mode, A, B, { fromEnd = false, points = this.map.points } = {}) {
    const g = this.grid(mode), S = fromEnd ? B : A, T = fromEnd ? A : B;
    const f = this.field(mode, S.x, S.y), t = this.snap(g, T.x, T.y);
    if (!f.dist || t < 0 || !isFinite(f.dist[t])) return null;
    // Walk down the distance field from T to S. (A fewest-turns search was tried, Nov 2026: on the test buildings it
    // found the same corners at twice the time, so the corridor-centre cost above is the "easiest route" part.)
    const { W, H, occ } = g, dist = f.dist, cells = [t];
    let k = t, guard = W * H;
    while (k !== f.src && guard--) {
      const i = k % W, j = (k / W) | 0; let best = -1, bd = dist[k];
      for (const [di, dj] of NB) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
        const n = b * W + a; if (occ[n] || (di && dj && (occ[j * W + a] || occ[b * W + i]))) continue;
        if (dist[n] < bd) { bd = dist[n]; best = n; }
      }
      if (best < 0) return null; k = best; cells.push(k);
    }
    if (!fromEnd) cells.reverse();          // now A … B
    return this.finish(g, cells, A, B, mode, points);
  }

  finish(g, cells, A, B, mode, points) {
    const { W } = g;
    const pts = cells.map(c => [g.x0 + (c % W + 0.5) * g.cell, g.y0 + (((c / W) | 0) + 0.5) * g.cell]);
    pts[0] = [A.x, A.y]; if (pts.length > 1) pts[pts.length - 1] = [B.x, B.y]; else pts.push([B.x, B.y]);
    const path = [pts[0]]; let a = 0;
    while (a < pts.length - 1) { let b = a + 1; while (b + 1 < pts.length && this.los(g, pts[a][0], pts[a][1], pts[b + 1][0], pts[b + 1][1])) b++; path.push(pts[b]); a = b; }
    const ins = instructions(path, A, B, mode, points, this.map.nav.speed);
    const r2 = v => Math.round(v * 100) / 100;
    return { distance_m: r2(ins.distance), seconds: Math.round(ins.seconds), path: path.map(q => [r2(q[0]), r2(q[1])]), steps: ins.steps };
  }
}

// ---- Turn-by-turn wording (kept identical to the Mapper's export) ----
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
const norm = d => { while (d > 180) d -= 360; while (d <= -180) d += 360; return d; };
// Plain words for directions (founder, Nov 2026: "an old man can use it, a child can use it"). No clock faces, no
// "bear", no "sharp": Go straight · Turn right · Go a little right · Turn around · Keep going. Also rewrites the
// wording stored in older map files. The clock number is kept in `clock` (Settings → Clock directions shows it).
const PLAIN_EN = [
  [/\s*\((\d{1,2}) o'clock\)/i, ''], [/\bGo straight ahead\b/g, 'Go straight'], [/\bTurn sharp (left|right)\b/g, 'Turn $1'],
  [/\bBear (left|right)\b/g, 'Go a little $1'], [/^Continue /, 'Keep going straight '], [/\bthen continue /, 'then keep going straight '],
  [/ \(DALIL node\)/, ' (DALIL sign)'], [/You are at DALIL node “([^”]*)”\. Tap it to confirm\./, 'You are at the DALIL sign “$1”.'],
];
const PLAIN_AR = [
  [/\s*\(اتجاه الساعة \d{1,2}\)/, ''], [/اتجه إلى الأمام/g, 'امشِ إلى الأمام'], [/انعطف بحدة إلى (اليمين|اليسار)/g, 'انعطف إلى $1'],
  [/انعطف إلى اليمين/g, 'اتجه يمينًا'], [/انعطف إلى اليسار/g, 'اتجه يسارًا'], [/اتجه قليلاً إلى (اليمين|اليسار)/g, 'مِل قليلًا إلى $1'],
  [/استدر إلى الخلف/g, 'استدر للخلف'], [/^تابع المشي /, 'استمر في المشي '], [/ \(نقطة دليل\)/, ' (علامة دليل)'],
  [/أنت الآن عند نقطة دليل «([^»]*)»\. المسها للتأكيد\./, 'أنت الآن عند علامة دليل «$1».'],
];
const CLOCK_PLAIN = h => { h = ((h % 12) + 12) % 12;
  return h === 0 ? ['Go straight', 'امشِ إلى الأمام'] : h <= 2 ? ['Go a little right', 'مِل قليلًا إلى اليمين'] : h <= 5 ? ['Turn right', 'اتجه يمينًا']
    : h === 6 ? ['Turn around', 'استدر للخلف'] : h <= 9 ? ['Turn left', 'اتجه يسارًا'] : ['Go a little left', 'مِل قليلًا إلى اليسار']; };
export function plainStep(s) {
  if (!s || s.plain) return s;
  const ck = (s.en || '').match(/\((\d{1,2}) o'clock\)/i);
  let en = s.en || '', ar = s.ar || '', ck2 = null;
  // Older files: "Turn to your 11 o'clock" / "استدر نحو اتجاه الساعة 11" → words.
  en = en.replace(/^Turn to your (\d{1,2}) o'clock/i, (_, h) => { ck2 = +h; return CLOCK_PLAIN(+h)[0]; });
  ar = ar.replace(/^استدر نحو اتجاه الساعة (\d{1,2})/, (_, h) => CLOCK_PLAIN(+h)[1]);
  for (const [a, b] of PLAIN_EN) en = en.replace(a, b);
  for (const [a, b] of PLAIN_AR) ar = ar.replace(a, b);
  const clock = ck ? +ck[1] : ck2;
  return { ...s, en, ar, plain: true, ...(clock ? { clock } : {}) };
}
// The first turn: words, then the clock direction in brackets (plainStep moves it into `clock`).
const CLOCK_WORDS = { 1: ['Bear right', 'اتجه قليلاً إلى اليمين'], 2: ['Bear right', 'اتجه قليلاً إلى اليمين'], 3: ['Turn right', 'انعطف إلى اليمين'], 4: ['Turn sharp right', 'انعطف بحدة إلى اليمين'], 5: ['Turn sharp right', 'انعطف بحدة إلى اليمين'], 6: ['Turn around', 'استدر إلى الخلف'], 7: ['Turn sharp left', 'انعطف بحدة إلى اليسار'], 8: ['Turn sharp left', 'انعطف بحدة إلى اليسار'], 9: ['Turn left', 'انعطف إلى اليسار'], 10: ['Bear left', 'اتجه قليلاً إلى اليسار'], 11: ['Bear left', 'اتجه قليلاً إلى اليسار'] };
// Douglas–Peucker: the route's small kinks (a traced plan's jagged walls, string-pulling around a door frame) are not
// turns a person makes. Instructions are read from the path simplified to ~1 m; the drawn route keeps every point.
export function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function instructions(fullPath, A, B, mode, points, speed = {}) {
  const path = simplify(fullPath, 1.0);
  const legs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const len = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); if (len < 1e-6) continue; const h = ang(path[i], path[i + 1]);
    const last = legs[legs.length - 1];
    if (last && (Math.abs(norm(h - last.h)) < 30 || len < 0.6)) { last.len += len; last.end = path[i + 1]; }
    else legs.push({ h, len, start: path[i], end: path[i + 1] });
  }
  for (let i = legs.length - 1; i > 0; i--) if (legs[i].len < 0.8) { legs[i - 1].len += legs[i].len; legs[i - 1].end = legs[i].end; legs.splice(i, 1); }
  // A short jog between two slight turns ("bear right 2 m, bear left 2 m") is one leg, not two steps.
  for (let i = legs.length - 2; i > 0; i--) if (legs[i].len < 3 && Math.abs(norm(legs[i].h - legs[i - 1].h)) <= 55 && Math.abs(norm(legs[i + 1].h - legs[i].h)) <= 55) { legs[i - 1].len += legs[i].len; legs[i - 1].end = legs[i].end; legs.splice(i, 1); }
  // Small bends one after another ("Go a little right", then "Go a little right" again) are one walk: a bend of 40° or
  // less (or up to 55° next to a piece under 4 m) is folded in: you just follow the corridor (founder's on-site test: "Now Go a little right / Then: Go a little right").
  for (let i = legs.length - 1; i > 0; i--) {
    const a = legs[i - 1], b = legs[i];
    const bend = Math.abs(norm(b.h - (a.hOut ?? a.h)));
    if (bend <= 40 || (bend <= 55 && Math.min(a.len, b.len) < 4)) {
      a.len += b.len; a.end = b.end; a.hOut = b.hOut ?? b.h; legs.splice(i, 1);   // the next turn is measured from where you walk at the end
    }
  }
  const total = legs.reduce((a, l) => a + l.len, 0);
  const m = d => Math.max(1, Math.round(d)), st = d => Math.max(1, Math.round(d / 0.7));
  const arM = n => n === 1 ? 'متراً واحداً' : n === 2 ? 'مترين' : (n <= 10 ? `${n} أمتار` : `${n} متراً`);
  const arS = n => n === 1 ? 'خطوة واحدة' : n === 2 ? 'خطوتين' : (n <= 10 ? `${n} خطوات` : `${n} خطوة`);
  const walkTxt = d => { const a = m(d), b = st(d); return mode === 'chair' ? { en: `continue ${a} m`, ar: `تابع ${arM(a)}` } : { en: `walk ${a} m (about ${b} steps)`, ar: `امشِ ${arM(a)} (حوالي ${arS(b)})` }; };
  const steps = [];
  steps.push({ en: `Start at ${A.nameEn}${A.dalilNode ? ' (DALIL node)' : ''}.`, ar: `ابدأ من ${A.nameAr || A.nameEn}${A.dalilNode ? ' (نقطة دليل)' : ''}.` });
  const cum = [0]; for (let i = 0; i < path.length - 1; i++) cum.push(cum[i] + Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]));
  const onRoute = [];
  for (const p of points) {
    if (!p.dalilNode || p.id === A.id || p.id === B.id) continue; let best = 1e9, bs = 0;
    for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(a[0] + t * dx - p.x, a[1] + t * dy - p.y); if (d < best) { best = d; bs = cum[i] + t * Math.sqrt(L2); } }
    if (best < 1.6) onRoute.push({ p, s: bs });
  }
  onRoute.sort((a, b) => a.s - b.s);
  let L0 = 0;
  legs.forEach((l, i) => {
    let turnEn, turnAr;
    if (i === 0) {
      const rel = norm(l.h - (A.facingDeg ?? 90)); let ck = Math.round(-rel / 30); ck = ((ck % 12) + 12) % 12; if (ck === 0) ck = 12;
      if (ck === 12) { turnEn = 'Go straight ahead'; turnAr = 'اتجه إلى الأمام'; }
      else { const w = CLOCK_WORDS[ck]; turnEn = `${w[0]} (${ck} o'clock)`; turnAr = `${w[1]} (اتجاه الساعة ${ck})`; }
    } else {
      const d = norm(l.h - (legs[i - 1].hOut ?? legs[i - 1].h)), side = d > 0 ? 'left' : 'right', sideAr = d > 0 ? 'اليسار' : 'اليمين';
      if (Math.abs(d) > 145) { turnEn = 'Turn around'; turnAr = 'استدر إلى الخلف'; }
      else if (Math.abs(d) > 55) { turnEn = `Turn ${side}`; turnAr = `انعطف إلى ${sideAr}`; }
      else { turnEn = `Bear ${side}`; turnAr = `اتجه قليلاً إلى ${sideAr}`; }
    }
    const L1 = L0 + l.len; const here = onRoute.filter(o => o.s > L0 + 0.3 && o.s <= L1 + 0.3 && !(i === legs.length - 1 && o.s > L1 - 0.8));
    let pos = L0, first = true;
    const chunk = d => { const w = walkTxt(d); if (first) { steps.push({ en: `${turnEn}, then ${w.en}.`, ar: `${turnAr}، ثم ${w.ar}.` }); first = false; } else { const a = m(d), b = st(d); steps.push(mode === 'chair' ? { en: `Continue ${a} m.`, ar: `تابع ${arM(a)}.` } : { en: `Continue ${a} m (about ${b} steps).`, ar: `تابع المشي ${arM(a)} (حوالي ${arS(b)}).` }); } };
    for (const o of here) {
      const d = Math.min(o.s, L1) - pos; if (d >= 0.8 || first) chunk(Math.max(d, 0.5)); pos = Math.min(o.s, L1);
      steps.push({ en: `You are at DALIL node “${o.p.nameEn}”. Tap it to confirm.`, ar: `أنت الآن عند نقطة دليل «${o.p.nameAr || o.p.nameEn}». المسها للتأكيد.`, node: o.p.id });
    }
    const rest = L1 - pos; if (first || rest >= 0.8) chunk(first ? l.len : rest);
    L0 = L1;
  });
  steps.push({ en: `You have arrived at ${B.nameEn}.`, ar: `لقد وصلت إلى ${B.nameAr || B.nameEn}.` });
  const v = mode === 'chair' ? (speed.chair || 0.8) : (speed.walk || 1.1);
  return { distance: total, seconds: total / v, steps: steps.map(plainStep) };
}
