// DALIL "Snap the wall plan": a navigation map from a photo of the fire evacuation plan that hangs near the lifts and
// stairs of almost every building (founder, Nov 2026: "make it so easy to map buildings that don't have a floor plan").
// Photo → straighten (4 corners, perspective) → walls found automatically (dark, grey lines; colour, text and symbols
// dropped) → doorways opened / walls drawn with a finger → size from one walk or one known length → places tapped →
// a normal DALIL map (format 2) with walkable grids for on-phone routing.
import { encodeGrid } from './survey.js';

/** 3×3 homography taking the 4 points `from` to the 4 points `to` (each [[x,y]×4]). */
export function homography(from, to) {
  const A = [], b = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = from[k], [u, v] = to[k];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}
const applyH = (H, x, y) => { const w = H[2][0] * x + H[2][1] * y + H[2][2]; return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w]; };

/** Output size for a straightened plan: the quad's own proportions, long side `long` px. */
export function warpSize(corners, long = 1000) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const w = Math.max(d(corners[0], corners[1]), d(corners[3], corners[2])), h = Math.max(d(corners[0], corners[3]), d(corners[1], corners[2]));
  const k = long / Math.max(w, h, 1);
  return { W: Math.max(20, Math.round(w * k)), H: Math.max(20, Math.round(h * k)) };
}
/** Straighten: source ImageData + corners (TL, TR, BR, BL in source px) → a W×H ImageData looking straight on. */
export function warp(src, corners, W, H) {
  const out = new ImageData(W, H), Hm = homography([[0, 0], [W, 0], [W, H], [0, H]], corners), s = src.data, o = out.data, sw = src.width, sh = src.height;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const [x, y] = applyH(Hm, i + 0.5, j + 0.5), xi = Math.floor(x), yi = Math.floor(y), k = (j * W + i) * 4;
    if (xi < 0 || yi < 0 || xi >= sw || yi >= sh) { o[k] = o[k + 1] = o[k + 2] = 255; o[k + 3] = 255; continue; }
    const q = (yi * sw + xi) * 4; o[k] = s[q]; o[k + 1] = s[q + 1]; o[k + 2] = s[q + 2]; o[k + 3] = 255;
  }
  return out;
}

/** Walls from a straightened plan: dark, colourless pixels (evacuation routes, exits and symbols are coloured), local
 *  contrast against the paper (photos are unevenly lit), then small blobs (text, icons, hatching) removed.
 *  strength 0..1: higher keeps fainter lines. Returns Uint8Array mask (1 = wall), W×H, rows top to bottom. */
export function traceWalls(img, { strength = 0.5 } = {}) {
  const { width: W, height: H, data: d } = img, N = W * H, lum = new Float32Array(N), sat = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const r = d[k * 4], g = d[k * 4 + 1], b = d[k * 4 + 2]; lum[k] = 0.299 * r + 0.587 * g + 0.114 * b; sat[k] = Math.max(r, g, b) - Math.min(r, g, b); }
  // Paper brightness around each pixel: a box blur of radius ~3 % of the image (integral image).
  const R = Math.max(6, Math.round(Math.max(W, H) * 0.03)), I = new Float64Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) { let row = 0; for (let i = 0; i < W; i++) { row += lum[j * W + i]; I[(j + 1) * (W + 1) + i + 1] = I[j * (W + 1) + i + 1] + row; } }
  const mask = new Uint8Array(N), ratio = 0.5 + 0.3 * Math.max(0, Math.min(1, strength));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x0 = Math.max(0, i - R), x1 = Math.min(W, i + R + 1), y0 = Math.max(0, j - R), y1 = Math.min(H, j + R + 1);
    const mean = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    const k = j * W + i; if (lum[k] < mean * ratio && lum[k] < 170 && sat[k] < 70) mask[k] = 1;
  }
  // Drop small connected blobs: letters, numbers, icons. Walls join up into long pieces.
  const minLen = Math.max(10, Math.round(Math.max(W, H) * 0.035)), lab = new Int32Array(N), stack = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || lab[s]) continue;
    lab[s] = 1; stack.push(s); const comp = []; let a = W, b = H, c = 0, e = 0;
    while (stack.length) {
      const k = stack.pop(); comp.push(k); const i = k % W, j = (k / W) | 0;
      if (i < a) a = i; if (i > c) c = i; if (j < b) b = j; if (j > e) e = j;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= W || y >= H) continue; const n = y * W + x; if (mask[n] && !lab[n]) { lab[n] = 1; stack.push(n); } }
    }
    const span = Math.max(c - a + 1, e - b + 1), fill = comp.length / ((c - a + 1) * (e - b + 1));
    if (span < minLen || (fill > 0.6 && span < minLen * 3)) for (const k of comp) mask[k] = 0;   // small, or a solid block (logo, legend box)
  }
  return mask;
}

/** Final walls: traced, plus what was drawn (edit = 1), minus what was erased (edit = 2). */
export function combine(traced, edit) { const m = new Uint8Array(traced.length); for (let k = 0; k < m.length; k++) m[k] = edit[k] === 2 ? 0 : edit[k] === 1 ? 1 : traced[k]; return m; }

/** Distance (px) from every pixel to the nearest wall pixel, chamfer 3-4. */
function wallDist(mask, W, H) {
  const N = W * H, d = new Float32Array(N), INF = 1e9;
  for (let k = 0; k < N; k++) d[k] = mask[k] ? 0 : INF;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!d[k]) continue; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1); if (j > 0) { v = Math.min(v, d[k - W] + 1); if (i > 0) v = Math.min(v, d[k - W - 1] + 1.414); if (i < W - 1) v = Math.min(v, d[k - W + 1] + 1.414); } d[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (!d[k]) continue; let v = d[k];
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1); if (j < H - 1) { v = Math.min(v, d[k + W] + 1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + 1.414); if (i > 0) v = Math.min(v, d[k + W - 1] + 1.414); } d[k] = v; }
  return d;
}

/** Wall lines for drawing the plan: top and left edges of the wall pixels, as straight runs (plan metres, y up). */
function wallLines(mask, W, H, mpp, minRun = 3) {
  const out = [], y = j => (H - j) * mpp, x = i => i * mpp;
  for (let j = 0; j < H; j++) { let s = -1; for (let i = 0; i <= W; i++) { const on = i < W && mask[j * W + i] && (j === 0 || !mask[(j - 1) * W + i]); if (on && s < 0) s = i; if (!on && s >= 0) { if (i - s >= minRun) out.push([[x(s), y(j)], [x(i), y(j)]]); s = -1; } } }
  for (let i = 0; i < W; i++) { let s = -1; for (let j = 0; j <= H; j++) { const on = j < H && mask[j * W + i] && (i === 0 || !mask[j * W + i - 1]); if (on && s < 0) s = j; if (!on && s >= 0) { if (j - s >= minRun) out.push([[x(i), y(s)], [x(i), y(j)]]); s = -1; } } }
  const r2 = v => Math.round(v * 100) / 100;
  return out.map(L => L.map(([a, b]) => [r2(a), r2(b)]));
}

/** A DALIL map from the wall mask. places: [{ nameEn, nameAr, category, gender?, doors?, px, py }] in image px.
 *  mpp: metres per image pixel. keepInside: block what is reachable from the picture's edge (outside the building). */
export function maskToMap({ mask, W, H, mpp, places = [], building, floor, keepInside = true, calibration = null, when = new Date().toISOString() }) {
  const dist = wallDist(mask, W, H), N = W * H, rows = (occ) => { const f = new Uint8Array(N); for (let j = 0; j < H; j++) f.set(occ.subarray((H - 1 - j) * W, (H - j) * W), j * W); return f; };
  // Outside: flood from the picture's edge through space that is not within 0.8 m of a wall (seals doorways ≤ 1.6 m).
  let outside = null;
  if (keepInside) {
    const seal = 0.8 / mpp, o = new Uint8Array(N), q = [];
    const push = k => { if (!o[k] && dist[k] > seal) { o[k] = 1; q.push(k); } };
    for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); } for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
    while (q.length) { const k = q.pop(), i = k % W, j = (k / W) | 0; if (i > 0) push(k - 1); if (i < W - 1) push(k + 1); if (j > 0) push(k - W); if (j < H - 1) push(k + W); }
    let free = 0, out = 0; for (let k = 0; k < N; k++) if (dist[k] > seal) { free++; if (o[k]) out++; }
    outside = out < free * 0.6 ? o : null;    // the walls leak (an open side): don't block, or the whole building would go
  }
  const grid = r => { const occ = new Uint8Array(N); for (let k = 0; k < N; k++) occ[k] = dist[k] * mpp < r || (outside && outside[k]) ? 1 : 0; return rows(occ); };
  const r2 = v => Math.round(v * 100) / 100, slug = s => (String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan');
  return {
    format: 'dalil-map', version: 2, generated: when,
    building, floor, units: 'm',
    source: { type: 'plan-photo', version: 1, method: 'photo of the wall plan, straightened, walls traced on the phone', metresPerPixel: Math.round(mpp * 10000) / 10000, ...(calibration ? { scaleFrom: calibration.how } : {}) },
    clearance: { walk: 0.25, wheelchair: 0.4 }, grid: { cell: r2(mpp * 100) / 100 },
    points: places.map((p, i) => ({ id: p.id || 'P' + String(i + 1).padStart(3, '0'), nameEn: p.nameEn, nameAr: p.nameAr || '', category: p.category || 'room', ...(p.gender ? { gender: p.gender } : {}), ...(p.doors ? { doors: p.doors } : {}), dalilNode: false, facingDeg: 90, x: r2((p.px + 0.5) * mpp), y: r2((H - p.py - 0.5) * mpp) })),
    plan: { walls: wallLines(mask, W, H, mpp), doors: [] },
    closures: [],
    nav: { encoding: 'rle-varint-base64', cell: mpp, x0: 0, y0: 0, W, H, speed: { walk: 1.1, chair: 0.8 }, walk: encodeGrid(grid(0.25)), chair: encodeGrid(grid(0.4)) },
    routes: { walk: {}, chair: {} },
    _slug: slug(building?.name),
  };
}
