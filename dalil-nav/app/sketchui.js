// "Draw it on the satellite photo": the screen for sketch.js (#pgSketch). Four steps: find the building, trace its
// roof, draw the corridors and tap the places, save. The point you are working on is always under the fixed cross.
// Corridors can also be walked: your steps draw the line on the satellite photo, and dragging the map back to where
// you really are straightens everything walked since the last fix.
import { createGeoMap, setSource, fc, lineF, pointF, polyF } from './geomap.js';
import { enu } from './georef.js';
import { simplify } from './survey.js';
import { newSketch, squareUp, outlineAxis, outlineSize, snapPoint, snapHeadingToAxis, anchorWalk, linkPlace, addFloor, sketchToMaps, spurs } from './sketch.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CROSS = 0.4, MIN_ZOOM = 17.8, DRAFT = 'dalil.sketch', KEPT = 'dalil.sketches';
const STEPS = ['find', 'outline', 'draw', 'save'], QUICK = ['entrance', 'room', 'toilet', 'lift', 'stairs'];
let K = null;

/** ctx: { t, toast, announce, buzz, cfg, dark, fix(), askLocation(), tracker, stride(), store, catIco, catName, pname,
 *         placeDialog(rec, { onSave, onDelete }), unreachable(map) → [names], saveMaps(maps) → kept?, openMap(map), share(maps) }.
 *  edit: a saved sketch to carry on with (from "My maps"). */
export async function openSketch({ ctx, edit = null }) {
  closeSketch();
  K = { ctx, sk: edit, step: edit ? 'draw' : 'find', tool: 'corridor', cur: null, undo: [], gm: null, markers: [], walk: null, saved: null, seq: Symbol() };
  bindOnce(); render();
  const seq = K.seq, f = ctx.fix?.(), draft = ctx.store.get(DRAFT, null);
  K.draft = !edit && draft?.sk?.outline ? draft : null;
  try {
    const center = edit ? edit.ref : f ? [f.lng, f.lat] : ctx.lastCenter?.() || [55.4907, 25.3186];
    const gm = await createGeoMap($('#skMap'), { center, zoom: edit || f ? 18.5 : 15.5, cfg: ctx.cfg, dark: !!ctx.dark, cross: CROSS, onStyle: addLayers, onProvider: () => { if (K && K.seq === seq) render(); } });
    if (!K || K.seq !== seq) { gm.destroy(); return; }
    K.gm = gm; addLayers(gm.map);
    gm.map.on('move', () => { if (K?.cur && K.step === 'draw') drawCur(); });
    gm.map.on('dragend', e => { if (e.originalEvent) walkFix(); });
    if (edit) frame();
    render(); draw();
  } catch { if (K && K.seq === seq) { K.noMap = true; render(); } }
}
export function closeSketch() {
  if (!K) return; walkStop(true);
  for (const mk of K.markers) mk.remove();
  try { K.gm?.destroy(); } catch { /* gone */ }
  K = null;
}
export const sketchState = () => K;
export const keptSketches = store => store.get(KEPT, {}) || {};

const E = () => enu(K.sk.ref);
const fl = () => K.sk.floors[K.sk.f];
const outlineShown = () => K.sk.outline.length >= 3 && K.sk.square ? squareUp(K.sk.outline) : K.sk.outline;
const axis = () => K.sk.outline.length >= 3 ? outlineAxis(outlineShown()) : null;
function keep() { if (K?.sk) K.ctx.store.set(DRAFT, { sk: K.sk, cur: K.cur, step: K.step }); }
function snapshot() { K.undo.push(JSON.stringify({ outline: K.sk.outline, floors: K.sk.floors, cur: K.cur, links: K.sk.links })); if (K.undo.length > 40) K.undo.shift(); }
function undo() {
  const s = K.undo.pop(); if (!s) return; const d = JSON.parse(s);
  K.sk.outline = d.outline; K.sk.floors = d.floors; K.sk.links = d.links; K.cur = d.cur; if (K.walk) walkStop(true);
  keep(); draw(); render();
}

/* ---------- drawing on the map ---------- */
function addLayers(m) {
  if (m.getSource('sk-outline')) return;
  for (const id of ['sk-outline', 'sk-lines', 'sk-spurs', 'sk-cur', 'sk-verts', 'sk-me']) m.addSource(id, { type: 'geojson', data: fc() });
  m.addLayer({ id: 'sk-outline-fill', type: 'fill', source: 'sk-outline', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#FFC700', 'fill-opacity': 0.14 } });
  m.addLayer({ id: 'sk-outline-halo', type: 'line', source: 'sk-outline', paint: { 'line-color': '#1F1F1F', 'line-opacity': 0.5, 'line-width': 5 } });
  m.addLayer({ id: 'sk-outline-line', type: 'line', source: 'sk-outline', paint: { 'line-color': '#FFC700', 'line-width': 2.5 } });
  m.addLayer({ id: 'sk-lanes', type: 'line', source: 'sk-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8AB4F8', 'line-opacity': 0.5, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 15, 0.42, 22, 54] } });
  m.addLayer({ id: 'sk-spurs', type: 'line', source: 'sk-spurs', paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.8, 'line-width': 1.5, 'line-dasharray': [1.5, 1.5] } });
  m.addLayer({ id: 'sk-lines-halo', type: 'line', source: 'sk-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B3A82', 'line-width': 5 } });
  m.addLayer({ id: 'sk-lines', type: 'line', source: 'sk-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 2 } });
  m.addLayer({ id: 'sk-cur-halo', type: 'line', source: 'sk-cur', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B3A82', 'line-width': 6 } });
  m.addLayer({ id: 'sk-cur', type: 'line', source: 'sk-cur', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#4C8DF6', 'line-width': 3 } });
  m.addLayer({ id: 'sk-verts', type: 'circle', source: 'sk-verts', paint: { 'circle-radius': ['case', ['==', ['get', 'k'], 'raw'], 3, 6], 'circle-color': ['case', ['==', ['get', 'k'], 'raw'], '#FFFFFF', '#FFC700'], 'circle-stroke-color': '#1F1F1F', 'circle-stroke-width': 2 } });
  m.addLayer({ id: 'sk-me-acc', type: 'circle', source: 'sk-me', filter: ['==', ['get', 'k'], 'acc'], paint: { 'circle-color': '#8DB6FF', 'circle-opacity': 0.18, 'circle-radius': ['get', 'r'] } });
  m.addLayer({ id: 'sk-me', type: 'circle', source: 'sk-me', filter: ['==', ['get', 'k'], 'dot'], paint: { 'circle-radius': 6, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#3B7BFF', 'circle-stroke-width': 3 } });
  if (K?.sk) draw();
}
function drawCur() {
  const m = K.gm?.map; if (!m?.getSource('sk-cur') || !K.sk) return; const e = E();
  if (!K.cur?.length) { setSource(m, 'sk-cur', fc()); return; }
  const tip = K.walk?.on ? null : target().pt, pts = tip ? K.cur.concat([tip]) : K.cur;
  setSource(m, 'sk-cur', fc(pts.length > 1 ? [lineF(pts.map(e.from))] : []));
}
function draw() {
  const m = K?.gm?.map; if (!m?.getSource('sk-outline') || !K.sk) return; const e = E(), o = outlineShown();
  const ring = o.map(e.from);
  setSource(m, 'sk-outline', fc(o.length >= 3 ? [polyF(ring.concat([ring[0]]))] : o.length === 2 ? [lineF(ring)] : []));
  const f = fl(), sp = K.step === 'outline' ? { spurs: [] } : spurs(f.lines.filter(L => L.length > 1), f.places);
  setSource(m, 'sk-lines', fc(K.step === 'outline' ? [] : f.lines.filter(L => L.length > 1).map(L => lineF(L.map(e.from)))));
  setSource(m, 'sk-spurs', fc(sp.spurs.map(L => lineF(L.map(e.from)))));
  const verts = K.step === 'outline' ? K.sk.outline.map(p => pointF(e.from(p), { k: K.sk.square && K.sk.outline.length >= 3 ? 'raw' : 'pt' })).concat(K.sk.square && o.length >= 3 ? o.map(p => pointF(e.from(p), { k: 'pt' })) : [])
    : (K.cur || []).map(p => pointF(e.from(p), { k: 'pt' }));
  setSource(m, 'sk-verts', fc(verts));
  drawCur();
  for (const mk of K.markers) mk.remove(); K.markers = [];
  if (K.step !== 'outline' && K.step !== 'find') f.places.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `sk-place cat-${p.category}`;
    b.innerHTML = `<span class="skp-ico">${K.ctx.catIco(p.category)}</span><span class="skp-name"></span>`;
    const name = K.ctx.pname(p); b.querySelector('.skp-name').textContent = name; b.setAttribute('aria-label', name);
    b.addEventListener('click', ev => { ev.stopPropagation(); editPlace(i); });
    K.markers.push(new K.gm.maplibregl.Marker({ element: b, anchor: 'bottom' }).setLngLat(e.from([p.e, p.n])).addTo(m)); b.setAttribute('aria-label', name);
  });
}
function drawMe() {
  const m = K?.gm?.map, f = K?.ctx.fix?.(); if (!m?.getSource('sk-me')) return;
  if (!f) { setSource(m, 'sk-me', fc()); return; }
  const mpp = 156543.03 * Math.cos(f.lat * Math.PI / 180) / 2 ** m.getZoom();
  setSource(m, 'sk-me', fc([pointF([f.lng, f.lat], { k: 'acc', r: Math.max(8, Math.min(400, f.acc / mpp)) }), pointF([f.lng, f.lat], { k: 'dot' })]));
}
function frame() {
  const m = K?.gm?.map; if (!m || !K.sk) return; const e = E(), pts = K.sk.outline.concat(K.sk.floors.flatMap(f => f.lines.flat())).map(e.from); if (!pts.length) return;
  const bb = new K.gm.maplibregl.LngLatBounds(pts[0], pts[0]); pts.forEach(p => bb.extend(p));
  m.fitBounds(bb, { padding: { top: 100, bottom: 320, left: 40, right: 40 }, maxZoom: 20, duration: 0 });
}
/** The spot under the cross in sketch metres, snapped the way a new corridor point would be. */
function target() {
  const raw = E().to(K.gm.center());
  if (K.step !== 'draw' || K.tool !== 'corridor') return { pt: raw, snapped: null };
  const f = fl(), lines = f.lines.concat(K.cur && K.cur.length > 1 ? [K.cur.slice(0, -1)] : []);
  return snapPoint(raw, { lines, prev: K.cur?.[K.cur.length - 1] || null, axis: axis(), straight: K.sk.straight });
}
// Points are placed zoomed in: at street zoom one pixel is more than a metre.
function closeEnough() {
  const m = K.gm?.map; if (!m) return false;
  if (m.getZoom() >= MIN_ZOOM) return true;
  K.gm.moveTo(K.gm.center(), { zoom: 19, duration: 450 }); K.ctx.toast(K.ctx.t('skZoomed')); return false;
}

/* ---------- the walk: your steps draw the corridor ---------- */
async function walkStart() {
  const { tracker, toast, t } = K.ctx; if (!closeEnough()) return;
  const res = await tracker.start(); if (!K) return;
  if (!(res.orientation && res.motion)) { tracker.stop(); if (K.ctx.motionHelp) K.ctx.motionHelp(res, walkStart); else toast(t('skNoMotion'), 6000); return; }
  snapshot();
  const at = target().pt; if (!K.cur?.length) K.cur = [at]; else if (Math.hypot(K.cur[K.cur.length - 1][0] - at[0], K.cur[K.cur.length - 1][1] - at[1]) > 0.5) K.cur.push(at);
  K.walk = { on: true, n: 0, from: K.cur.length - 1, bias: K.walk?.bias || 0, stride: K.walk?.stride || K.ctx.stride(), prev: tracker.onStep };
  tracker.onStep = walkStep;
  try { K.walk.wake = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
  render(); K.ctx.announce(t('skWalking'));
}
function walkStep() {
  const w = K?.walk; if (!w?.on) return; const { tracker } = K.ctx;
  if (tracker.heading == null || tracker.rate > 110) return;                 // turning on the spot is not a step forward
  const h = (K.sk.straight ? snapHeadingToAxis(tracker.heading + w.bias, axis()) : tracker.heading + w.bias) * Math.PI / 180;
  const p = K.cur[K.cur.length - 1], q = [p[0] + w.stride * Math.sin(h), p[1] + w.stride * Math.cos(h)];
  K.cur.push(q); w.n++;
  K.gm.moveTo(E().from(q), { duration: 260 }); drawCur();
  if (w.n % 8 === 0) { keep(); const el = $('#skWalkN'); if (el) el.textContent = K.ctx.t('skWalkN', w.n, Math.round(w.n * w.stride)); }
}
// You dragged the map while walking: that is where you really are. Everything since the last fix turns and stretches to end there.
function walkFix() {
  const w = K?.walk; if (!w?.on || !K.cur || K.cur.length - w.from < 2) return;
  const piece = K.cur.slice(w.from), here = E().to(K.gm.center()), was = piece[piece.length - 1], moved = Math.hypot(here[0] - was[0], here[1] - was[1]);
  if (moved < 0.4) return;
  const fix = anchorWalk(piece, here), len = piece.reduce((a, p, i) => i ? a + Math.hypot(p[0] - piece[i - 1][0], p[1] - piece[i - 1][1]) : 0, 0);
  K.cur.splice(w.from, piece.length, ...fix.pts);
  if (len >= 8) { w.bias = Math.max(-30, Math.min(30, w.bias + fix.turn)); w.stride = Math.max(0.4, Math.min(1.0, w.stride * Math.max(0.8, Math.min(1.25, fix.size)))); }   // learn from it for the next stretch
  w.from = K.cur.length - 1; keep(); drawCur(); draw();
  const msg = K.ctx.t('skFixed', moved < 9.5 ? moved.toFixed(1) : Math.round(moved)); K.ctx.toast(msg); K.ctx.announce(msg); K.ctx.buzz?.(30);
}
function walkStop(silent = false) {
  const w = K?.walk; if (!w?.on) return; const { tracker } = K.ctx;
  w.on = false; if (tracker.onStep === walkStep) { tracker.onStep = w.prev || null; if (!K.ctx.navActive?.()) tracker.stop(); }
  w.wake?.release?.().catch(() => { });
  if (!silent) { render(); draw(); }
}

/* ---------- places ---------- */
function addPlace(category, named = false) {
  if (!closeEnough()) return; const { ctx } = K, at = E().to(K.gm.center());
  const push = rec => { snapshot(); const p = linkPlace(K.sk, { ...rec, e: at[0], n: at[1] }); fl().places.push(p); keep(); draw(); render(); const msg = ctx.t('placeAdded', ctx.pname(p)); ctx.toast(msg); ctx.announce(msg); ctx.buzz?.(30); };
  if (named) { ctx.placeDialog(null, { onSave: push }); return; }
  const n = new Set(K.sk.floors.flatMap(f => f.places).filter(p => p.category === category).map(p => p.link || p)).size + 1;   // a lift on two floors is one lift
  push({ nameEn: `${ctx.catName(category, 'en')} ${n}`, nameAr: `${ctx.catName(category, 'ar')} ${n}`, category });
}
function editPlace(i) {
  const p = fl().places[i], { ctx } = K; if (!p) return;
  ctx.placeDialog(p, {
    onSave: rec => { snapshot(); fl().places[i] = linkPlace(K.sk, { ...rec, e: p.e, n: p.n, ...(p.link && rec.category === p.category ? { link: p.link } : {}) }); keep(); draw(); render(); },
    onDelete: () => { snapshot(); fl().places.splice(i, 1); keep(); draw(); render(); },
  });
}

/* ---------- the steps ---------- */
function render() {
  if (!K) return; const { t } = K.ctx, s = K.step, i = STEPS.indexOf(s), page = $('#pgSketch'); page.dataset.step = s;
  $('#skTitle').textContent = K.sk?.name || t('skTitle');
  const noSat = K.noMap || (K.gm && !K.gm.satellite), warn = noSat ? `<p class="route-msg warn" role="status">${esc(t('plNoSat'))}</p>` : '';
  let hint = '', ctl = '', next = t('snNext'), canNext = true;
  if (K.saved) {
    $('#skStep').textContent = t('skSavedTitle'); $('#skHint').textContent = t('skSavedText', K.sk.name, K.saved.length, K.saved.reduce((a, m) => a + m.points.length, 0));
    $('#skCtl').innerHTML = `<button id="skOpen" class="btn primary xl" type="button">${esc(t('svOpen'))}</button><button id="skNextFloor" class="btn secondary" type="button"><span class="ico">${K.ctx.ico('plus')}</span><span>${esc(t('skNextFloor'))}</span></button><button id="skShare" class="btn secondary" type="button"><span class="ico">${K.ctx.ico('share')}</span><span>${esc(t('svShare'))}</span></button>`;
    $('#skNav').hidden = true; page.querySelector('.gt-cross').hidden = true; return;
  }
  $('#skNav').hidden = false; page.querySelector('.gt-cross').hidden = s === 'save';
  if (s === 'find') {
    hint = t('skHintFind');
    ctl = warn + (K.draft ? `<button id="skResume" class="btn secondary" type="button">${esc(t('skResume', K.draft.sk.name))}</button>` : '')
      + `<label class="field"><span>${esc(t('svBuildingName'))}</span><input id="skName" type="text" maxlength="60" autocomplete="off" value="${esc(K.name || '')}"></label>`;
  } else if (s === 'outline') {
    const n = K.sk.outline.length, sz = outlineSize(outlineShown());
    hint = t(n < 1 ? 'skHintOutline1' : n < 3 ? 'skHintOutline2' : 'skHintOutline3'); canNext = n >= 3;
    ctl = (n >= 3 ? `<p class="gt-result gt-ok">${esc(t('skOutlineIs', n, Math.round(sz.w), Math.round(sz.h)))}</p>` : '')
      + `<button id="skAdd" class="btn primary xl" type="button">${esc(t('skAddCorner'))}</button>
      <div class="pair"><button id="skUndo" class="btn secondary" type="button" ${K.undo.length ? '' : 'disabled'}>${esc(t('snUndo'))}</button><label class="gt-check"><input id="skSquare" type="checkbox" ${K.sk.square ? 'checked' : ''}><span>${esc(t('skSquare'))}</span></label></div>`;
  } else if (s === 'draw') {
    const f = fl(), nl = f.lines.filter(L => L.length > 1).length, walking = !!K.walk?.on, open = (K.cur?.length || 0) > 0;
    hint = walking ? t('skHintWalk') : K.tool === 'corridor' ? t(open ? 'skHintLine2' : 'skHintLine1') : t('skHintPlace');
    canNext = nl >= 1 && f.places.length >= 2 && !walking; next = t('skReview');
    const tools = `<div class="gt-seg" role="tablist"><button type="button" role="tab" data-tool="corridor" aria-selected="${K.tool === 'corridor'}">${esc(t('skToolLine'))}<small>${nl}</small></button><button type="button" role="tab" data-tool="place" aria-selected="${K.tool === 'place'}">${esc(t('skToolPlace'))}<small>${f.places.length}</small></button></div>`;
    if (K.tool === 'corridor') ctl = tools + (walking
      ? `<p id="skWalkN" class="gt-result gt-ok num">${esc(t('skWalkN', K.walk.n, Math.round(K.walk.n * K.walk.stride)))}</p><button id="skWalkStop" class="btn primary xl" type="button">${esc(t('skWalkStop'))}</button>`
      : `<button id="skAdd" class="btn primary xl" type="button">${esc(t(open ? 'skAddPoint' : 'skStartLine'))}</button>
        <div class="trio"><button id="skEnd" class="btn secondary" type="button" ${open && K.cur.length > 1 ? '' : 'disabled'}>${esc(t('skEndLine'))}</button><button id="skWalk" class="btn secondary" type="button"><span class="ico">${K.ctx.ico('walk')}</span><span>${esc(t('skWalk'))}</span></button><button id="skUndo" class="btn secondary" type="button" ${K.undo.length ? '' : 'disabled'}>${esc(t('snUndo'))}</button></div>
        <label class="gt-check"><input id="skStraight" type="checkbox" ${K.sk.straight ? 'checked' : ''}><span>${esc(t('skStraight'))}</span></label>`);
    else ctl = tools + `<div class="sv-quick sk-quick">${QUICK.map(c => `<button type="button" class="sv-qbtn" data-skq="${c}"><span class="ico">${K.ctx.catIco(c)}</span><span>${esc(K.ctx.catName(c))}</span></button>`).join('')}</div>
      <div class="pair"><button id="skNamed" class="btn secondary" type="button">${esc(t('skNamed'))}</button><button id="skUndo" class="btn secondary" type="button" ${K.undo.length ? '' : 'disabled'}>${esc(t('snUndo'))}</button></div>`;
  } else {
    const maps = sketchToMaps(K.sk), mine = maps.find(m => m.floor.level === K.sk.f), bad = mine ? K.ctx.unreachable(mine) : [];
    hint = t('skHintSave'); next = t('snSave');
    ctl = (bad.length ? `<p class="route-msg warn" role="status">${esc(t('skUnreach', bad.join(', ')))}</p>` : `<p class="gt-result gt-good">${esc(t('skAllReach', fl().places.length))}</p>`)
      + `<label class="field"><span>${esc(t('snFloorName'))}</span><input id="skFloor" type="text" maxlength="40" autocomplete="off" value="${esc(fl().name || t('snGround'))}"></label>`;
  }
  $('#skStep').textContent = `${t('snStepN', i + 1, STEPS.length)} · ${t('skT_' + s)}`; $('#skHint').textContent = hint; $('#skCtl').innerHTML = ctl;
  const nx = $('#skNext'); nx.textContent = next; nx.disabled = !canNext; $('#skPrev').textContent = t(i ? 'snPrev' : 'cancel');
  drawMe();
}
function go(step) { if (K.walk?.on) walkStop(true); K.step = step; if (step !== 'draw') K.cur = null; keep(); render(); draw(); if (step === 'save') frame(); }
function nextStep() {
  const { t, toast } = K.ctx, s = K.step;
  if (s === 'find') {
    const name = $('#skName').value.trim(); if (!name) { toast(t('svNeedName')); $('#skName').focus(); return; }
    if (!K.gm) { toast(t('plNoSat')); return; }
    if (!K.sk) K.sk = newSketch({ name, ref: K.gm.center() }); else K.sk.name = name;
    K.name = name; if (K.gm.map.getZoom() < 18) K.gm.moveTo(K.gm.center(), { zoom: 18.6 });
    go('outline'); K.ctx.announce(t('skHintOutline1')); return;
  }
  if (s === 'outline') { if (K.sk.outline.length < 3) return; go('draw'); K.ctx.announce(t('skHintLine1')); return; }
  if (s === 'draw') { if (K.cur?.length > 1) endLine(); go('save'); return; }
  const f = fl(); f.name = $('#skFloor').value.trim() || t('snGround');
  const maps = sketchToMaps(K.sk); if (!maps.length) { toast(t('skNeedMore')); return; }
  const kept = K.ctx.saveMaps(maps); K.saved = maps;
  const all = keptSketches(K.ctx.store); all[K.sk.id] = K.sk; K.ctx.store.set(KEPT, all); K.ctx.store.set(DRAFT, null);
  render(); const msg = t('skSavedTitle') + (kept ? '' : ' ' + t('mapSessionOnly')); toast(msg); K.ctx.announce(msg);
}
function endLine() {
  if (!K.cur || K.cur.length < 2) { K.cur = null; return; }
  if (K.walk?.on) walkStop(true);
  const end = K.cur[K.cur.length - 1], L = simplify(K.cur, 0.3); L[L.length - 1] = end; fl().lines.push(L); K.cur = null; K.walk = K.walk ? { ...K.walk, on: false } : null;
}
let bound = false;
function bindOnce() {
  if (bound) return; bound = true;
  $('#skZoomIn').onclick = () => K?.gm?.map.easeTo({ zoom: K.gm.map.getZoom() + 0.7, duration: 200 });
  $('#skZoomOut').onclick = () => K?.gm?.map.easeTo({ zoom: K.gm.map.getZoom() - 0.7, duration: 200 });
  $('#skLocate').onclick = () => { const f = K?.ctx.fix?.(); if (f && K.gm) { K.gm.moveTo([f.lng, f.lat], { zoom: Math.max(18.5, K.gm.map.getZoom()), duration: 500 }); drawMe(); } else K?.ctx.askLocation?.(); };
  $('#skNext').onclick = () => K && nextStep();
  $('#skPrev').onclick = () => { if (!K) return; const i = STEPS.indexOf(K.step); if (i > 0) go(STEPS[i - 1]); else K.ctx.back(); };
  $('#skCtl').addEventListener('change', e => {
    if (!K?.sk) return;
    if (e.target.id === 'skSquare') { K.sk.square = e.target.checked; keep(); draw(); render(); }
    if (e.target.id === 'skStraight') { K.sk.straight = e.target.checked; keep(); drawCur(); }
  });
  $('#skCtl').addEventListener('input', e => { if (e.target.id === 'skName' && K) K.name = e.target.value; });
  $('#skCtl').addEventListener('click', e => {
    if (!K) return; const b = e.target.closest('button'); if (!b) return; const { t, toast, announce } = K.ctx;
    if (b.dataset.tool) { if (K.walk?.on) walkStop(true); K.tool = b.dataset.tool; render(); drawCur(); return; }
    if (b.dataset.skq) { addPlace(b.dataset.skq); return; }
    switch (b.id) {
      case 'skResume': { const d = K.draft; K.sk = d.sk; K.cur = d.cur || null; K.name = d.sk.name; K.draft = null; K.gm?.moveTo(d.sk.ref, { zoom: 18.5, duration: 0 }); go(STEPS.includes(d.step) && d.step !== 'find' ? d.step : 'outline'); frame(); break; }
      case 'skAdd': {
        if (!K.gm || !closeEnough()) return;
        snapshot();
        if (K.step === 'outline') { K.sk.outline.push(E().to(K.gm.center())); announce(t('skCornerN', K.sk.outline.length)); }
        else { const s = target(); if (K.cur?.length && Math.hypot(K.cur[K.cur.length - 1][0] - s.pt[0], K.cur[K.cur.length - 1][1] - s.pt[1]) < 0.3) { K.undo.pop(); toast(t('skMoveFirst')); return; } (K.cur ||= []).push(s.pt); if (s.snapped === 'corner' || s.snapped === 'line') { K.ctx.buzz?.(20); toast(t('skJoined')); } }
        K.ctx.buzz?.(12); keep(); draw(); render(); break;
      }
      case 'skEnd': snapshot(); endLine(); keep(); draw(); render(); announce(t('skLineDone', fl().lines.length)); break;
      case 'skUndo': undo(); break;
      case 'skWalk': walkStart(); break;
      case 'skWalkStop': walkStop(); keep(); break;
      case 'skNamed': addPlace(null, true); break;
      case 'skOpen': { const m = K.saved[K.saved.length - 1], c = K.ctx; closeSketch(); c.openMap(m); break; }
      case 'skShare': K.ctx.share(K.saved); break;
      case 'skNextFloor': { const name = t('skFloorN', K.sk.floors.length + 1); addFloor(K.sk, name); K.saved = null; K.undo = []; K.cur = null; K.tool = 'corridor'; go('draw'); toast(t('skNextFloorTip')); break; }
    }
  });
}
