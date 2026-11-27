// "Put it on the real map": match two (or more) corners between a floor plan and the satellite photo, see the plan
// laid over the building, fine-tune, done. Gives the map its `geo`, so the inside map and the outside map are one
// picture: the blue dot, "Getting here", nearby-building detection and the compass all use it.
//
// Both halves work the same way: the picture moves under a fixed cross, and a button takes the point under the
// cross. Screen: #pgPlace in index.html. Maths: georef.js.
import { createGeoMap, setSource, fc, lineF, pointF } from './geomap.js';
import { fitGeo, nudgeGeo, fitRating, planBox, planToWorld, parseLatLng } from './georef.js';
import { floorGeoJSON } from './outdoor.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let P = null;       // the open session

/**
 * map: a DALIL map (plan in metres; `geo` optional: an earlier position to start from).
 * bg: optional { image (canvas), w, h } drawn under the plan from (0, 0) to (w, h) plan metres (the photo of the plan).
 * ctx: { t, toast, announce, cfg (config.maps), fix() → { lng, lat } | null, dark }.
 * start: [lng, lat] to open the satellite photo at, when there is no geo and no GPS.
 * onDone({ geo, pairs, rms, rating, size: [w, h] metres on the ground }) / onCancel().
 */
export async function openPlacer({ map, bg = null, ctx, start = null, onDone, onCancel = null, title = '' }) {
  closePlacer();
  const box = planBox(map);
  P = { map, bg, ctx, onDone, onCancel, box, pairs: [], pending: null, stage: 'plan', geo: null, manual: false, view: { cx: box.cx, cy: box.cy, k: 1 }, title, gm: null, seq: Symbol() };
  $('#plTitle').textContent = title;
  fitPlan(); bindOnce(); render();
  const seq = P.seq;
  try {
    const f = ctx.fix?.(), center = map.geo ? planToWorld(map.geo)(box.cx, box.cy) : f ? [f.lng, f.lat] : start || ctx.lastCenter?.() || [55.4907, 25.3186];
    const gm = await createGeoMap($('#plMap'), { center, zoom: map.geo || f || start ? 18 : 15.5, cfg: ctx.cfg, dark: !!ctx.dark, cross: CROSS, onStyle: addLayers, onProvider: () => { if (P && P.seq === seq) render(); } });
    if (!P || P.seq !== seq) { gm.destroy(); return; }
    P.gm = gm; addLayers(gm.map);
    if (map.geo) { P.geo = { ...map.geo }; P.manual = true; P.stage = 'check'; }     // already placed: open on the check, ready to fine-tune
    render();
  } catch { if (P && P.seq === seq) { P.noMap = true; render(); } }
}
export function closePlacer() { if (!P) return; try { P.gm?.destroy(); } catch { /* gone */ } P = null; }
export const placerState = () => P;

/* ---------- the plan under the cross ---------- */
function canvasSize() { const cv = $('#plPlan'), r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); return { cv, w: Math.max(1, r.width), h: Math.max(1, r.height), d }; }
function fitPlan() {
  const { w, h } = canvasSize(), b = P.box, pad = 1.25;
  // Leave room for the panel at the bottom: the cross sits a little above the middle.
  P.view = { cx: b.cx, cy: b.cy, k: Math.min(w / (Math.max(b.w, 1) * pad), (h * 0.55) / (Math.max(b.h, 1) * pad)) };
}
const CROSS = 0.42;                      // how far down the page the cross sits (CSS: .gt-cross { top: 42% })
const crossY = h => h * CROSS;
function drawPlan() {
  if (!P) return; const { cv, w, h, d } = canvasSize(), x = cv.getContext('2d'), v = P.view;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
  const S = ([px, py]) => [w / 2 + (px - v.cx) * v.k, crossY(h) - (py - v.cy) * v.k];
  if (P.bg) { const [x0, y0] = S([0, P.bg.h]); x.imageSmoothingEnabled = true; x.drawImage(P.bg.image, x0, y0, P.bg.w * v.k, P.bg.h * v.k); }
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink').trim() || '#1F1F1F';
  const path = L => { L.forEach((p, i) => { const [a, b] = S(p); if (i) x.lineTo(a, b); else x.moveTo(a, b); }); };
  if ((P.map.plan.corridors || []).length) { x.strokeStyle = 'rgba(26,115,232,.28)'; x.lineWidth = Math.max(3, (P.map.plan.corridorWidth || 1.8) * v.k); x.lineCap = x.lineJoin = 'round'; x.beginPath(); for (const L of P.map.plan.corridors) path(L); x.stroke(); }
  if (!P.bg) { x.strokeStyle = ink; x.lineWidth = 1.6; x.lineCap = 'round'; x.beginPath(); for (const L of P.map.plan.walls) if (L.length > 1) path(L); x.stroke(); }
  // Places, as a reminder of what is where (names once zoomed in).
  x.font = '600 12px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top';
  for (const p of P.map.points || []) { const [a, b] = S([p.x, p.y]); x.beginPath(); x.arc(a, b, 3.5, 0, 7); x.fillStyle = '#1A73E8'; x.fill(); if (v.k > 4 && p.nameEn) { x.lineWidth = 3; x.strokeStyle = '#fff'; x.strokeText(P.ctx.pname ? P.ctx.pname(p) : p.nameEn, a, b + 6); x.fillStyle = '#1F1F1F'; x.fillText(P.ctx.pname ? P.ctx.pname(p) : p.nameEn, a, b + 6); } }
  const dots = P.pairs.map((q, i) => [q.plan, i + 1]); if (P.pending) dots.push([P.pending, P.pairs.length + 1]);
  for (const [pt, n] of dots) { const [a, b] = S(pt); x.beginPath(); x.arc(a, b, 13, 0, 7); x.fillStyle = '#FFC700'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#1F1F1F'; x.stroke(); x.fillStyle = '#1F1F1F'; x.font = '700 14px system-ui, sans-serif'; x.textBaseline = 'middle'; x.fillText(String(n), a, b + .5); }
}
// The reminder on the satellite side: the plan, small, with the corner you picked.
function drawThumb() {
  const cv = $('#plThumb canvas'), d = Math.min(2, window.devicePixelRatio || 1), w = 104, h = 104, pt = P.pending; if (!pt) return;
  cv.width = w * d; cv.height = h * d; const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  const b = P.box, k = Math.min((w - 16) / Math.max(b.w, 1), (h - 16) / Math.max(b.h, 1)), S = ([px, py]) => [w / 2 + (px - b.cx) * k, h / 2 - (py - b.cy) * k];
  if (P.bg) { const [x0, y0] = S([0, P.bg.h]); x.drawImage(P.bg.image, x0, y0, P.bg.w * k, P.bg.h * k); }
  else { x.strokeStyle = '#5F6368'; x.lineWidth = 1; x.beginPath(); for (const L of P.map.plan.walls.concat(P.map.plan.corridors || [])) L.forEach((p, i) => { const [a, c] = S(p); if (i) x.lineTo(a, c); else x.moveTo(a, c); }); x.stroke(); }
  const [a, c] = S(pt); x.beginPath(); x.arc(a, c, 7, 0, 7); x.fillStyle = '#FFC700'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#1F1F1F'; x.stroke();
}
function bindPlanGestures() {
  const cv = $('#plPlan'), pts = new Map(); let last = null;
  const zoomAt = (f, sx, sy) => { const { w, h } = canvasSize(), v = P.view, k2 = Math.max(0.3, Math.min(400, v.k * f)); const px = v.cx + (sx - w / 2) / v.k, py = v.cy - (sy - crossY(h)) / v.k; v.cx = px - (sx - w / 2) / k2; v.cy = py + (sy - crossY(h)) / k2; v.k = k2; drawPlan(); };
  cv.addEventListener('pointerdown', e => { if (!P) return; cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = null; });
  cv.addEventListener('pointermove', e => {
    if (!P || !pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = cv.getBoundingClientRect();
    if (pts.size === 1) { P.view.cx -= (e.clientX - prev[0]) / P.view.k; P.view.cy += (e.clientY - prev[1]) / P.view.k; drawPlan(); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top]; if (last) { const v = P.view; v.cx -= (mid[0] - last.mid[0]) / v.k; v.cy += (mid[1] - last.mid[1]) / v.k; zoomAt(dist / last.dist, mid[0], mid[1]); } last = { dist, mid }; }
  });
  const up = e => { pts.delete(e.pointerId); last = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!P) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  // Arrow keys move the plan (and +/− zoom): the cross can be placed without a pointer.
  cv.addEventListener('keydown', e => { if (!P) return; const step = 24 / P.view.k, m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]; if (m) { e.preventDefault(); P.view.cx += m[0]; P.view.cy += m[1]; drawPlan(); } else if (e.key === '+' || e.key === '=') zoomBy(1.3); else if (e.key === '-') zoomBy(1 / 1.3); });
  new ResizeObserver(() => { if (P && P.stage === 'plan') drawPlan(); }).observe(cv);
}
function zoomBy(f) {
  if (!P) return;
  if (P.stage === 'plan') { P.view.k = Math.max(0.3, Math.min(400, P.view.k * f)); drawPlan(); }
  else P.gm?.map.easeTo({ zoom: P.gm.map.getZoom() + (f > 1 ? 0.6 : -0.6), duration: 200 });
}

/* ---------- the satellite photo under the cross ---------- */
function addLayers(m) {
  if (m.getSource('pl-walls')) return;
  for (const id of ['pl-outline', 'pl-walls', 'pl-corr', 'pl-pts']) m.addSource(id, { type: 'geojson', data: fc() });
  m.addLayer({ id: 'pl-outline-fill', type: 'fill', source: 'pl-outline', paint: { 'fill-color': '#FFC700', 'fill-opacity': 0.12 } });
  m.addLayer({ id: 'pl-corr', type: 'line', source: 'pl-corr', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8AB4F8', 'line-opacity': 0.75, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 15, 0.42, 22, 54] } });
  m.addLayer({ id: 'pl-walls-halo', type: 'line', source: 'pl-walls', paint: { 'line-color': '#0B1A33', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.6, 20, 4.5] } });
  m.addLayer({ id: 'pl-walls', type: 'line', source: 'pl-walls', paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 20, 2] } });
  m.addLayer({ id: 'pl-pts', type: 'circle', source: 'pl-pts', paint: { 'circle-radius': 9, 'circle-color': '#FFC700', 'circle-stroke-color': '#1F1F1F', 'circle-stroke-width': 2.5 } });
  drawOverlay();
}
function drawOverlay() {
  const m = P?.gm?.map; if (!m || !m.getSource('pl-walls')) return;
  const show = P.stage === 'check' && P.geo;
  if (show) { const gj = floorGeoJSON({ ...P.map, building_context: null, geo: P.geo }); setSource(m, 'pl-walls', gj.walls); setSource(m, 'pl-corr', gj.corridors); setSource(m, 'pl-outline', gj.outline); }
  else for (const id of ['pl-walls', 'pl-corr', 'pl-outline']) setSource(m, id, fc());
  setSource(m, 'pl-pts', fc(P.pairs.map((q, i) => pointF(q.world, { n: i + 1 }))));
}
function frameOverlay() {
  const m = P?.gm?.map; if (!m || !P.geo) return;
  const T = planToWorld(P.geo), b = P.box, cs = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].map(([x, y]) => T(x, y));
  const bb = new P.gm.maplibregl.LngLatBounds(cs[0], cs[0]); cs.forEach(c => bb.extend(c));
  const panel = document.querySelector('#pgPlace .gt-panel')?.offsetHeight || 300, h = m.getContainer().clientHeight;
  m.fitBounds(bb, { padding: { top: 100, bottom: Math.min(panel + 24, h - 220), left: 36, right: 36 }, maxZoom: 20, duration: 500 });
}

/* ---------- the steps ---------- */
function solve() {
  const fit = fitGeo(P.pairs); if (fit.error) return null;
  P.fit = fit; P.geo = fit.geo; P.manual = false; return fit;
}
const sizeOf = geo => [P.box.w * (geo.scale || 1), P.box.h * (geo.scale || 1)];
function render() {
  if (!P) return; const { t } = P.ctx, n = P.pairs.length + 1, st = P.stage, page = $('#pgPlace');
  page.dataset.stage = st;
  $('#plPlan').hidden = st !== 'plan'; $('#plThumb').hidden = st !== 'world'; page.querySelector('.gt-cross').hidden = st === 'check';
  $('#plLocate').hidden = st === 'plan';
  const sat = P.gm?.satellite, noSat = P.noMap || (P.gm && !sat);
  let step = '', hint = '', ctl = '';
  if (st === 'plan') {
    step = t('plStepPlan', n); hint = t(n === 1 ? 'plHintPlan1' : n === 2 ? 'plHintPlan2' : 'plHintPlanMore');
    ctl = `<button id="plUse" class="btn primary xl" type="button">${esc(t('plUsePlan'))}</button>` + (P.pairs.length >= 2 ? `<button id="plToCheck" class="btn secondary" type="button">${esc(t('plBackToCheck'))}</button>` : '');
    requestAnimationFrame(drawPlan);
  } else if (st === 'world') {
    step = t('plStepWorld', n); hint = t('plHintWorld');
    ctl = (noSat ? `<p class="route-msg warn" role="status">${esc(t('plNoSat'))}</p>` : '')
      + `<button id="plSet" class="btn primary xl" type="button">${esc(t('plUseWorld'))}</button>
      <div class="pair"><button id="plRedo" class="btn secondary" type="button">${esc(t('plRedoPlan'))}</button><button id="plFind" class="btn secondary" type="button">${esc(t('plFind'))}</button></div>
      <form id="plFindBox" class="gt-find" hidden><label class="field"><span>${esc(t('plFindLabel'))}</span><input id="plCoords" type="text" inputmode="text" autocomplete="off" placeholder="25.3186, 55.4907"></label><button class="btn secondary" type="submit">${esc(t('plGo'))}</button></form>`;
    drawThumb();
  } else {
    const [w, h] = sizeOf(P.geo), fit = P.fit, np = P.pairs.length;
    const rating = P.manual || !fit ? null : fitRating(fit, np);
    step = t('plStepCheck');
    hint = t('plHintCheck');
    const facts = [t('plSize', Math.round(w), Math.round(h))];
    if (!P.manual && fit) facts.push(np >= 3 ? t('plFitWithin', fit.rms < 0.95 ? fit.rms.toFixed(1) : Math.round(fit.rms)) : t('plFitTwo', Math.round(fit.baseline)));
    ctl = `<p class="gt-result gt-${rating || 'ok'}">${esc(facts.join(' · '))}</p>`
      + (rating === 'rough' ? `<p class="route-msg warn" role="status">${esc(t(np >= 3 ? 'plRough' : 'plShortBase'))}</p>` : '')
      + `<button id="plDone" class="btn primary xl" type="button">${esc(t('plDone'))}</button>
      <div class="pair"><button id="plMore" class="btn secondary" type="button">${esc(t('plMore'))}</button><button id="plAgain" class="btn secondary" type="button">${esc(t('plAgain'))}</button></div>
      <details class="gt-tune"><summary>${esc(t('plTune'))}</summary><div class="gt-tune-grid" role="group" aria-label="${esc(t('plTune'))}">
        ${[['north:0.5', '↑', 'plN'], ['south:0.5', '↓', 'plS'], ['west:0.5', '←', 'plW'], ['east:0.5', '→', 'plE'], ['turn:-0.5', '⟲', 'plTurnL'], ['turn:0.5', '⟳', 'plTurnR'], ['size:0.99', '−', 'plSmaller'], ['size:1.01', '+', 'plBigger']].map(([v, s, k]) => `<button class="pill" type="button" data-nudge="${v}" aria-label="${esc(t(k))}"><span aria-hidden="true">${s}</span><small>${esc(t(k + 'S'))}</small></button>`).join('')}
      </div></details>`;
    drawOverlay();
  }
  $('#plStep').textContent = step; $('#plHint').textContent = hint; $('#plCtl').innerHTML = ctl;
  if (st !== 'check') drawOverlay();
}
function nudge(spec) {
  const [k, v] = spec.split(':'), n = +v, b = P.box;
  const d = k === 'north' ? { north: n } : k === 'south' ? { north: -n } : k === 'east' ? { east: n } : k === 'west' ? { east: -n } : k === 'turn' ? { turn: n } : { size: n };
  P.geo = nudgeGeo(P.geo, d, [b.cx, b.cy]); P.manual = true; drawOverlay();
  const [w, h] = sizeOf(P.geo); const r = document.querySelector('#plCtl .gt-result'); if (r) r.textContent = P.ctx.t('plSize', Math.round(w), Math.round(h));
}
let bound = false;
function bindOnce() {
  if (bound) return; bound = true; bindPlanGestures();
  $('#plZoomIn').onclick = () => zoomBy(1.4); $('#plZoomOut').onclick = () => zoomBy(1 / 1.4);
  $('#plLocate').onclick = () => { const f = P?.ctx.fix?.(); if (f && P.gm) P.gm.moveTo([f.lng, f.lat], { zoom: Math.max(18, P.gm.map.getZoom()), duration: 500 }); else P?.ctx.askLocation?.(); };
  $('#plCtl').addEventListener('submit', e => { e.preventDefault(); const c = parseLatLng($('#plCoords').value); if (!c) { P.ctx.toast(P.ctx.t('plBadCoords')); return; } P.gm?.moveTo(c, { zoom: 18.5, duration: 0 }); $('#plFindBox').hidden = true; });
  $('#plCtl').addEventListener('click', e => {
    if (!P) return; const b = e.target.closest('button'); if (!b) return; const { t, toast, announce } = P.ctx;
    if (b.dataset.nudge) { nudge(b.dataset.nudge); return; }
    switch (b.id) {
      case 'plUse': {
        const pt = [P.view.cx, P.view.cy], bx = P.box, m = Math.max(bx.w, bx.h) * 0.25;
        if (pt[0] < bx.minX - m || pt[0] > bx.maxX + m || pt[1] < bx.minY - m || pt[1] > bx.maxY + m) { toast(t('plOffPlan')); return; }
        if (P.pairs.some(q => Math.hypot(q.plan[0] - pt[0], q.plan[1] - pt[1]) < Math.max(bx.w, bx.h) * 0.15)) { toast(t('plTooClose')); return; }
        P.pending = pt; P.stage = 'world';
        // The second corner: start the photo roughly where it should be (the first match and a north-up guess).
        if (P.pairs.length === 1 && P.gm) { const g = fitGeo([P.pairs[0]], { bearing: P.map.geo?.bearing ?? 0, scale: P.map.geo?.scale ?? 1 }).geo; if (g) P.gm.moveTo(planToWorld(g)(pt[0], pt[1])); }
        else if (P.pairs.length >= 2 && P.geo && P.gm) P.gm.moveTo(planToWorld(P.geo)(pt[0], pt[1]), { zoom: Math.max(19, P.gm.map.getZoom()) });
        render(); announce(t('plHintWorld')); break;
      }
      case 'plToCheck': P.pending = null; P.stage = 'check'; render(); break;
      case 'plRedo': P.pending = null; P.stage = 'plan'; render(); break;
      case 'plFind': $('#plFindBox').hidden = !$('#plFindBox').hidden; if (!$('#plFindBox').hidden) $('#plCoords').focus(); break;
      case 'plSet': {
        if (!P.gm) { toast(t('plNoSat')); return; }
        P.pairs.push({ plan: P.pending, world: P.gm.center() }); P.pending = null;
        if (P.pairs.length < 2) { P.stage = 'plan'; render(); announce(t('plHintPlan2')); break; }
        if (!solve()) { P.pairs.pop(); toast(t('plTooClose')); P.stage = 'plan'; render(); break; }
        P.stage = 'check'; render(); frameOverlay();
        const [w, h] = sizeOf(P.geo); announce(t('plSize', Math.round(w), Math.round(h))); break;
      }
      case 'plMore': P.stage = 'plan'; render(); break;
      case 'plAgain': P.pairs = []; P.pending = null; P.geo = null; P.fit = null; P.manual = false; P.stage = 'plan'; fitPlan(); render(); break;
      case 'plDone': {
        const s = P, [w, h] = sizeOf(s.geo), rating = s.manual || !s.fit ? 'ok' : fitRating(s.fit, s.pairs.length);
        const res = { geo: { ...s.geo }, pairs: s.pairs.slice(), rms: s.manual ? null : s.fit?.rms ?? null, rating, size: [w, h], manual: s.manual };
        closePlacer(); s.onDone?.(res); break;
      }
    }
  });
}
