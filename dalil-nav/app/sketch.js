// DALIL "Draw it on the satellite photo": a navigation map for a building with no floor plan, made on the real map
// (founder, Nov 2026: "work out a new solution on mapping places without a floor plan"; the walked survey alone was
// "not accurate" because nothing tied it to the real building).
//
// The idea: the roof is visible from above, so the building's outline is traced on the satellite photo first. That
// outline is already in the right place on Earth and at the right size, and everything else is drawn inside it:
// corridors (tapped point by point, or walked: your steps draw the line and you drag it back whenever it drifts),
// then the places. Because the map is drawn on the real map, the inside and the outside can never disagree.
//
// Everything here is plain geometry in local metres [east, north] from a reference point `ref` ([lng, lat]); the
// screen lives in app.js. The result is a normal DALIL map (format 2) built by survey.js buildFloorMap.
import { buildFloorMap } from './survey.js';
import { enu } from './georef.js';

const R = Math.PI / 180;
const wrap90 = a => ((a % 90) + 90) % 90;
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'building';
const rot = ([x, y], deg) => { const c = Math.cos(deg * R), s = Math.sin(deg * R); return [x * c - y * s, x * s + y * c]; };

/** The building's grid from its outline: the direction of its edges modulo 90° (0..90, anticlockwise from east),
 *  longer edges counting more. null for a round or irregular outline. */
export function outlineAxis(poly) {
  let sx = 0, sy = 0, len = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]) * 4; sx += L * Math.cos(t); sy += L * Math.sin(t); len += L;
  }
  if (!len || Math.hypot(sx, sy) / len < 0.5) return null;
  return wrap90(Math.atan2(sy, sx) / R / 4);
}

/** Square the corners: edges within `tol`° of the building's grid become exactly parallel to it (roof corners tapped
 *  by hand are never quite square). Slanted edges are left alone. */
export function squareUp(poly, tol = 12) {
  const axis = outlineAxis(poly); if (axis == null || poly.length < 3) return poly.map(p => p.slice());
  const P = poly.map(p => rot(p, -axis)), n = P.length, kind = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], ang = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) / R), h = Math.min(ang, 180 - ang);
    kind.push(h <= tol ? 'h' : Math.abs(90 - ang) <= tol ? 'v' : null);
  }
  // A horizontal edge shares one y; a vertical edge shares one x. Each corner takes its y from the horizontal edge
  // it belongs to and its x from the vertical one.
  const out = P.map(p => p.slice());
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (kind[i] === 'h') { const y = (P[i][1] + P[j][1]) / 2; out[i][1] = out[j][1] = y; }
    if (kind[i] === 'v') { const x = (P[i][0] + P[j][0]) / 2; out[i][0] = out[j][0] = x; }
  }
  return out.map(p => rot(p, axis));
}

/** Size of the outline along its own grid: { w, h } in metres (longer side first), and its area. */
export function outlineSize(poly) {
  if (poly.length < 2) return { w: 0, h: 0, area: 0 };
  const axis = outlineAxis(poly) || 0, P = poly.map(p => rot(p, -axis));
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
  let area = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
  return { w: Math.max(a, b), h: Math.min(a, b), area: Math.abs(area) / 2 };
}

const closest = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0; return [a[0] + t * dx, a[1] + t * dy]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The nearest point on any of the lines: { pt, d, li (line), si (segment) }, or null. */
export function nearestOnLines(p, lines) {
  let best = null;
  lines.forEach((L, li) => { for (let i = 1; i < L.length; i++) { const q = closest(p, L[i - 1], L[i]), d = dist(p, q); if (!best || d < best.d) best = { pt: q, d, li, si: i - 1 }; } });
  return best;
}

/** Where a new corridor point really goes. In order: onto a corner or line end within `join` metres (so lines meet
 *  exactly), onto a line it almost touches (a junction), else straightened to the building's grid from the last
 *  point when the direction is within `tol`° of it. Returns { pt, snapped: 'corner' | 'line' | 'axis' | null }. */
export function snapPoint(p, { lines = [], prev = null, axis = null, join = 1.2, tol = 10, straight = true } = {}) {
  let best = null;
  for (const L of lines) for (const v of L) { const d = dist(p, v); if (d <= join && (!best || d < best.d)) best = { pt: v.slice(), d }; }
  if (best) return { pt: best.pt, snapped: 'corner' };
  const near = nearestOnLines(p, lines);
  if (near && near.d <= join * 0.75) return { pt: near.pt, snapped: 'line' };
  if (straight && prev && axis != null && dist(p, prev) > 0.5) {
    const ang = Math.atan2(p[1] - prev[1], p[0] - prev[0]) / R, rel = ang - axis, q = Math.round(rel / 90) * 90;
    if (Math.abs(rel - q) <= tol) { const dir = (axis + q) * R, L = (p[0] - prev[0]) * Math.cos(dir) + (p[1] - prev[1]) * Math.sin(dir); return { pt: [prev[0] + L * Math.cos(dir), prev[1] + L * Math.sin(dir)], snapped: 'axis' }; }
  }
  return { pt: p.slice(), snapped: null };
}

/** A walked heading (degrees clockwise from north) straightened to the building's grid (axis: anticlockwise from east). */
export function snapHeadingToAxis(heading, axis, tol = 20) {
  if (axis == null || heading == null) return heading;
  const east = 90 - heading, rel = east - axis, q = Math.round(rel / 90) * 90;         // compass → anticlockwise from east
  return Math.abs(rel - q) <= tol ? 90 - (axis + q) : heading;
}

/** You walked from pts[0] and the app thinks you are at the last point, but you are really at `target` (you dragged
 *  the map): turn and stretch the whole walked piece about its start so that it ends there. Fixes both a compass that
 *  is a few degrees out and a step length that is a little long or short. Returns { pts, turn (deg), size }. */
export function anchorWalk(pts, target) {
  if (pts.length < 2) return { pts: pts.map(p => p.slice()), turn: 0, size: 1 };
  const o = pts[0], e = pts[pts.length - 1], vx = e[0] - o[0], vy = e[1] - o[1], L2 = vx * vx + vy * vy;
  if (L2 < 1) {                                                // hardly moved: slide the piece, more toward its end
    const dx = target[0] - e[0], dy = target[1] - e[1], n = pts.length - 1;
    return { pts: pts.map((p, i) => [p[0] + dx * i / n, p[1] + dy * i / n]), turn: 0, size: 1 };
  }
  const tx = target[0] - o[0], ty = target[1] - o[1], qr = (tx * vx + ty * vy) / L2, qi = (ty * vx - tx * vy) / L2;   // q = t / v (complex)
  return { pts: pts.map(p => { const x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + qr * x - qi * y, o[1] + qi * x + qr * y]; }), turn: -Math.atan2(qi, qr) / R, size: Math.hypot(qr, qi) };
}

/** Short links from each place to the corridor it sits beside (a place tapped inside its room, off the line, would
 *  otherwise be cut off). Returns { spurs: [[place, point on a corridor]], far: [places with no corridor within max] }. */
export function spurs(lines, places, { max = 40, min = 0.3 } = {}) {
  const out = [], far = [];
  for (const p of places) { const n = nearestOnLines([p.e, p.n], lines); if (!n || n.d > max) far.push(p); else if (n.d > min) out.push([[p.e, p.n], n.pt]); }
  return { spurs: out, far };
}

/** A fresh sketch. floors: [{ name, lines: [[[e, n]…]…], places: [{ nameEn, nameAr, category, e, n, link?, gender?, doors? }] }]. */
export function newSketch({ name = '', ref }) {
  return { v: 1, name, ref, id: `${slug(name)}-${Date.now().toString(36)}`, outline: [], square: true, straight: true, floors: [{ name: '', lines: [], places: [] }], f: 0, links: 0 };
}

/** Lift and stairs places get a link code, so the same lift on the next floor joins the floors. */
export function linkPlace(sk, p) {
  if ((p.category === 'lift' || p.category === 'stairs') && !p.link) p.link = (p.category === 'lift' ? 'LIFT-' : 'STAIR-') + (++sk.links);
  return p;
}
/** Start the next floor: same building and outline, with this floor's lifts and stairs already in place. */
export function addFloor(sk, name) {
  const from = sk.floors[sk.f];
  sk.floors.push({ name, lines: [], places: from.places.filter(p => p.link).map(p => ({ ...p })) });
  sk.f = sk.floors.length - 1; return sk.floors[sk.f];
}

/** One DALIL map per floor that has at least a corridor and a place. */
export function sketchToMaps(sk, when = new Date().toISOString()) {
  const outline = sk.outline.length >= 3 ? (sk.square ? squareUp(sk.outline) : sk.outline) : [];
  const axis = outline.length ? outlineAxis(outline) : null, size = outlineSize(outline);
  // Draw the plan with the building's long side across the page: plan = the east/north sketch turned by `bearing`.
  let bearing = 0;
  if (axis != null) { const P = outline.map(p => rot(p, -axis)), w = Math.max(...P.map(p => p[0])) - Math.min(...P.map(p => p[0])), h = Math.max(...P.map(p => p[1])) - Math.min(...P.map(p => p[1])); bearing = -(w >= h ? axis : axis + 90); }
  bearing = ((bearing + 180) % 360 + 360) % 360 - 180; if (bearing > 90) bearing -= 180; else if (bearing <= -90) bearing += 180;   // never upside down: plan up stays within 90° of north
  bearing = Math.round(bearing * 1000) / 1000;
  const turn = p => rot(p, bearing), E = enu(sk.ref);
  const ring = outline.length ? outline.concat([outline[0]]) : [], footprint = ring.map(p => E.from(p).map(v => Math.round(v * 1e7) / 1e7));
  const maps = [];
  sk.floors.forEach((fl, i) => {
    if (!fl.lines.some(L => L.length > 1) || !fl.places.length) return;
    const lines = fl.lines.filter(L => L.length > 1), sp = spurs(lines, fl.places);
    maps.push(buildFloorMap({
      building: { id: sk.id, name: sk.name }, floor: { id: slug(fl.name) === 'building' ? `floor-${i + 1}` : slug(fl.name), name: fl.name || `Floor ${i + 1}`, level: i },
      lines: lines.concat(sp.spurs).map(L => L.map(turn)), walls: ring.length ? [ring.map(turn)] : [],
      places: fl.places.map((p, k) => { const [x, y] = turn([p.e, p.n]); return { id: 'P' + String(k + 1).padStart(3, '0'), nameEn: p.nameEn || p.nameAr, nameAr: p.nameAr || '', category: p.category || 'room', x, y, ...(p.link ? { link: p.link } : {}), ...(p.gender ? { gender: p.gender } : {}), ...(p.doors ? { doors: p.doors } : {}) }; }),
      origin: { lng: sk.ref[0], lat: sk.ref[1], acc: 0 }, align: { rot: bearing, dx: 0, dy: 0, scale: 1 }, when,
      source: { type: 'sketch', version: 1, method: 'drawn on the satellite photo: the roof outline traced first, corridors and places drawn inside it', note: 'Corridors are where they were drawn or walked; inner walls are not mapped.', ...(size.w ? { outline_m: [Math.round(size.w), Math.round(size.h)] } : {}) },
      geoSource: 'DALIL sketch: drawn directly on satellite imagery, so the plan and the real map share one position (accuracy = the imagery, typically a few metres)',
      context: footprint.length ? { footprint, source: 'Roof outline traced on satellite imagery in the DALIL app' } : null,
    }));
  });
  return maps;
}
