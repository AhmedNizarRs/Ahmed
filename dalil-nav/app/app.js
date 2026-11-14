// DALIL visitor app. No build step, no dependencies (QR codes: vendor/qrcode.js, MIT).
// Modules: i18n.js (strings, icons) · mapview.js (map renderer) · router.js (on-device routing).
import { Router } from './router.js';
import { STR, CHIP_CATS, CAT_WORDS, CAT_ICONS, TURN_ICONS, UI, svgIco } from './i18n.js';
import { MapView, BASE } from './mapview.js';

/* =========================================================================
   Settings and storage (every read/write guarded: private mode may throw)
   ========================================================================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const mq = q => window.matchMedia && window.matchMedia(q).matches;
const settings = Object.assign({
  lang: (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en',
  theme: 'dark', voice: true, vibrate: true, stepFree: false, large: false,
  contrast: mq('(prefers-contrast: more)'), motion: mq('(prefers-reduced-motion: reduce)'),
}, store.get('dalil.settings', {}));
const saveSettings = () => store.set('dalil.settings', settings);
const T = () => STR[settings.lang];
const t = (key, ...a) => { const v = T()[key] ?? STR.en[key] ?? key; return typeof v === 'function' ? v(...a) : v; };

/* =========================================================================
   State
   ========================================================================= */
const state = {
  maps: [],            // every loaded dalil-map (one per floor)
  map: null,           // the floor the visitor is on
  viewMap: null,       // the floor shown on the map (can differ while browsing floors)
  fromId: null,        // where the visitor is (point id on state.map)
  toKey: null,         // destination "<floorId>|<pointId>" in the current building
  chip: null, view: 'browse', filter: 'all', previewAll: false, kiosk: null,
  saved: store.get('dalil.saved', []),
};
const spoken = [];     // for tests and debugging
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ico = name => svgIco(UI[name] || '');
const catIco = c => svgIco(CAT_ICONS[c] || CAT_ICONS.room);
const fillIcons = (root = document) => {
  root.querySelectorAll('[data-ico]').forEach(el => { if (!el.firstChild) el.innerHTML = ico(el.dataset.ico); });
  root.querySelectorAll('[data-cat-ico]').forEach(el => { if (!el.firstChild) el.innerHTML = catIco(el.dataset.catIco); });
};

const pt = id => state.map?.points.find(p => p.id === id) || null;
const pname = p => p ? (settings.lang === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)) : '';
const pnameOther = p => settings.lang === 'ar' ? p.nameEn : p.nameAr;
const catName = c => T().cats[c] || STR.en.cats[c] || c;
const mode = () => settings.stepFree ? 'chair' : 'walk';
const isService = c => ['toilet', 'toilet_acc', 'lift', 'stairs', 'ramp', 'prayer', 'wudu', 'cafe', 'reception', 'entrance', 'exit', 'baby'].includes(c);

/* =========================================================================
   Routing (stored routes for v1 files, otherwise on the phone from map.nav)
   ========================================================================= */
const routers = new WeakMap();
const routerOf = map => { if (!map?.nav) return null; let r = routers.get(map); if (!r) routers.set(map, r = new Router(map)); return r; };
const hasStored = (map, m) => { map.__stored ??= {}; return map.__stored[m] ??= !!(map.routes?.[m] && Object.keys(map.routes[m]).length); };
const memo = new Map();
function routeFor(map, A, B, m = mode(), opts = {}) {
  if (!map || !A || !B || A === B || (A.id === B.id && !A.virtual)) return null;
  if (!A.virtual && !B.virtual && !(map.closures || []).length && hasStored(map, m)) return map.routes[m][`${A.id}>${B.id}`] || null;
  const R = routerOf(map); if (!R) return null;
  const k = `${map.building.id}|${map.floor.id}|${m}|${A.x},${A.y}>${B.x},${B.y}`;
  if (!memo.has(k)) { memo.set(k, R.route(m, A, B, opts)); if (memo.size > 300) memo.delete(memo.keys().next().value); }
  return memo.get(k);
}
function distFor(map, A, B, m = mode()) {
  if (!A || !B || A.id === B.id) return null;
  if (!A.virtual && !B.virtual && !(map.closures || []).length && hasStored(map, m)) return map.routes[m][`${A.id}>${B.id}`]?.distance_m ?? null;
  return routerOf(map)?.distance(m, A, B) ?? null;
}
// Virtual places: "@spot" (the visitor's saved spot) and "@x,y" (a dropped pin).
function pointOf(map, id) {
  if (!map || !id) return null;
  if (id === '@spot') { const sp = store.get('dalil.spot', null); return sp && sp.b === map.building.id && sp.f === map.floor.id ? { id, virtual: true, nameEn: STR.en.mySpot, nameAr: STR.ar.mySpot, category: 'pin', x: sp.x, y: sp.y, facingDeg: 90 } : null; }
  if (id[0] === '@') { const [x, y] = id.slice(1).split(',').map(Number); return isFinite(x) && isFinite(y) ? { id, virtual: true, nameEn: STR.en.pinName, nameAr: STR.ar.pinName, category: 'pin', x, y, facingDeg: 90 } : null; }
  return map.points.find(q => q.id === id) || null;
}
const bFloors = () => state.map ? state.maps.filter(m => m.building.id === state.map.building.id) : [];
const mapByFloor = fid => bFloors().find(m => m.floor.id === fid) || null;
const keyOf = (m, p) => `${m.floor.id}|${p.id}`;
function resolve(key) { if (!key) return null; const [f, id] = key.split('|'); const m = mapByFloor(f); const p = pointOf(m, id); return p ? { m, p, key } : null; }
const destRef = () => resolve(state.toKey);
const stay = P => ({ distance_m: 0, seconds: 0, path: [[P.x, P.y], [P.x, P.y]], steps: [{ en: `Start at ${P.nameEn}.`, ar: `ابدأ من ${P.nameAr || P.nameEn}.` }, { en: `You have arrived at ${P.nameEn}.`, ar: `لقد وصلت إلى ${P.nameAr || P.nameEn}.` }] });
// One leg on the same floor, or two legs joined by a lift or stairs (points sharing a "link" code).
function planRoute(fm, fromId, tm, toId, m = mode()) {
  if (!fm || !tm) return null;
  const A = pointOf(fm, fromId), B = pointOf(tm, toId); if (!A || !B) return null;
  if (fm === tm) { if (fromId === toId) return null; const r = routeFor(fm, A, B, m); return r ? { legs: [{ map: fm, route: r }], distance_m: r.distance_m, seconds: r.seconds, via: null, closures: !!(fm.closures || []).length } : null; }
  const fl = bFloors(), up = fl.indexOf(tm) > fl.indexOf(fm), n = Math.max(1, Math.abs(fl.indexOf(tm) - fl.indexOf(fm)));
  let best = null;
  for (const pa of fm.points) {
    if (!pa.link) continue; const pb = tm.points.find(q => q.link === pa.link); if (!pb) continue;
    const lift = pa.category === 'lift' && pb.category === 'lift';
    if (m === 'chair' && !lift) continue;
    const r1 = pa.id === fromId ? stay(A) : routeFor(fm, A, pa, m), r2 = pb.id === toId ? stay(B) : routeFor(tm, pb, B, m, { fromEnd: true });
    if (!r1 || !r2) continue;
    const seconds = r1.seconds + r2.seconds + (lift ? 40 + 8 * n : 18 * n);
    if (!best || seconds < best.seconds) best = { legs: [{ map: fm, route: r1 }, { map: tm, route: r2 }], distance_m: r1.distance_m + r2.distance_m, seconds, via: { pa, pb, lift, up, toMap: tm }, closures: !!((fm.closures || []).length + (tm.closures || []).length) };
  }
  return best;
}
const planTo = (key, m = mode()) => { const d = resolve(key); return d ? planRoute(state.map, state.fromId, d.m, d.p.id, m) : null; };
function transferStep(via) {
  const fEn = STR.en.floorName(via.toMap.floor), fAr = STR.ar.floorName(via.toMap.floor);
  return via.lift
    ? { en: STR.en.liftTo(via.up, fEn, via.pb.nameEn), ar: STR.ar.liftTo(via.up, fAr, via.pb.nameAr || via.pb.nameEn), kind: 'floor', turn: 'lift' }
    : { en: STR.en.stairsTo(via.up, fEn), ar: STR.ar.stairsTo(via.up, fAr), kind: 'floor', turn: 'stairs' };
}
function planSteps(plan) {
  const legs = plan.legs.map(l => ({ ...l, ...buildSteps(l.route) })), out = [];
  legs.forEach((leg, li) => {
    let st = leg.steps.map(x => ({ ...x, leg: li }));
    if (li < legs.length - 1) { st = st.slice(0, -1); out.push(...st, { ...transferStep(plan.via), leg: li, d0: leg.L, d1: leg.L, dist: 0 }); }
    else out.push(...(li > 0 ? st.slice(1) : st));
  });
  out.forEach((x, i) => { x.i = i; });
  return { legs, steps: out };
}
const fmtM = d => t('m', Math.max(1, Math.round(d)));
const fmtMin = s => t('min', Math.max(1, Math.round(s / 60)));
const floorShort = f => /^(ground|g)$/i.test(f.id) || /^ground$/i.test(f.name) ? t('floorG') : /(\d+)/.test(f.name || '') ? f.name.match(/(\d+)/)[1] : String(f.name || f.id).slice(0, 3);
const floorName = f => t('floorName', f);

/* ---------- Step geometry: each "walk N m" step placed along the path ---------- */
function cumulative(path) { const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return c; }
function pointAt(path, cum, d) {
  const L = cum[cum.length - 1]; d = Math.max(0, Math.min(L, d));
  let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1, f = (d - cum[i - 1]) / seg;
  return { x: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, y: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f, i };
}
function headingAt(path, cum, d) {
  const L = cum[cum.length - 1], a = pointAt(path, cum, Math.min(d, L - 0.3)), b = pointAt(path, cum, Math.min(L, Math.max(d, 0) + 1.2));
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) { const n = path.length; return Math.atan2(path[n - 1][1] - path[n - 2][1], path[n - 1][0] - path[n - 2][0]) * 180 / Math.PI; }
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}
function turnOf(en) {
  const s = (en || '').toLowerCase();
  if (/arrived/.test(s)) return 'arrive';
  if (/dalil node|tap it/.test(s)) return 'node';
  if (/^start/.test(s)) return 'start';
  const clk = s.match(/(\d+)\s*o'clock/);
  if (clk) { const h = +clk[1] % 12; return h === 0 ? 'straight' : h <= 2 ? 'bear-right' : h <= 4 ? 'right' : h <= 7 ? 'around' : h <= 9 ? 'left' : 'bear-left'; }
  if (/turn around/.test(s)) return 'around';
  if (/bear right|slight(ly)? right/.test(s)) return 'bear-right';
  if (/bear left|slight(ly)? left/.test(s)) return 'bear-left';
  if (/turn right/.test(s)) return 'right';
  if (/turn left/.test(s)) return 'left';
  return 'straight';
}
function buildSteps(route) {
  const cum = cumulative(route.path), L = cum[cum.length - 1], n = route.steps.length;
  const steps = route.steps.map((s, i) => {
    const m = (s.en || '').match(/(\d+(?:\.\d+)?)\s*m\b/);
    const kind = i === 0 ? 'start' : i === n - 1 ? 'arrive' : s.node ? 'node' : m ? 'move' : 'info';
    return { ...s, i, kind, turn: kind === 'move' ? turnOf(s.en) : kind, dist: m ? +m[1] : 0 };
  });
  const sum = steps.reduce((a, s) => a + (s.kind === 'move' ? s.dist : 0), 0), f = sum > 0 ? L / sum : 1;
  let c = 0;
  for (const s of steps) { s.d0 = c; if (s.kind === 'move') c += s.dist * f; if (s.kind === 'arrive') c = L; s.d1 = c; }
  return { steps, cum, L };
}
const stepText = s => settings.lang === 'ar' ? (s.ar || s.en) : (s.en || s.ar);
const stepShort = s => settings.lang === 'ar' ? (s.ar || '').split(/،\s*ثم\s*/)[0] : (s.en || '').split(/,\s*then\s*/i)[0];

/* =========================================================================
   Feedback: speech, vibration, live region, toast
   ========================================================================= */
let voices = [];
if ('speechSynthesis' in window) { const lv = () => { voices = speechSynthesis.getVoices(); }; lv(); speechSynthesis.addEventListener?.('voiceschanged', lv); }
function speak(text) {
  spoken.push(text);
  if (!settings.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), lang = settings.lang;
    u.lang = lang === 'ar' ? 'ar-AE' : 'en-GB';
    const v = voices.find(v => v.lang.toLowerCase().replace('_', '-') === u.lang.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    u.rate = .95; speechSynthesis.speak(u);
  } catch { /* speech is optional */ }
}
function announce(text, assertive = false) { const el = assertive ? $('#liveAssertive') : $('#live'); el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); }
function buzz(pattern) { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(pattern); } catch { } }
let toastTimer;
function toast(text, ms = 3200) { const el = $('#toast'); el.textContent = text; el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

/* =========================================================================
   Loading maps
   ========================================================================= */
const isMap = m => m && m.format === 'dalil-map' && Array.isArray(m.points) && (m.routes || m.nav) && m.plan && m.building && m.floor;
function addMap(m) { const i = state.maps.findIndex(o => o.building.id === m.building.id && o.floor.id === m.floor.id); if (i >= 0) state.maps[i] = m; else state.maps.push(m); }
async function loadBundled() {
  const res = await fetch('maps.json'); if (!res.ok) throw new Error('maps.json ' + res.status);
  const list = await res.json();
  const maps = await Promise.all(list.maps.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));
  for (const m of maps) if (isMap(m)) addMap(m);
  for (const m of store.get('dalil.userMaps', [])) if (isMap(m)) addMap(m);
}
async function loadFile(file) {
  let m; try { m = JSON.parse(await file.text()); } catch { m = null; }
  if (!isMap(m)) { $('#loadMsg').textContent = t('mapBad'); return; }
  addMap(m);
  const user = store.get('dalil.userMaps', []).filter(o => !(o.building.id === m.building.id && o.floor.id === m.floor.id)); user.push(m);
  const kept = store.set('dalil.userMaps', user);
  $('#loadMsg').textContent = t('mapLoaded', `${m.building.name} · ${floorName(m.floor)}`) + (kept ? '' : ' ' + t('mapSessionOnly'));
  selectFloor(m);
}

/* =========================================================================
   Location and destination
   ========================================================================= */
let mainMap, navMap;
const defaultFrom = map => (map.points.find(p => p.category === 'entrance' && p.dalilNode) || map.points.find(p => p.dalilNode) || map.points[0])?.id || null;
function selectFloor(map, { keepFrom = false } = {}) {
  state.map = map; state.viewMap = map;
  if (!keepFrom || !pt(state.fromId)) state.fromId = defaultFrom(map);
  if (!resolve(state.toKey)) state.toKey = null;
  state.chip = null;
  store.set('dalil.last', { b: map.building.id, f: map.floor.id });
  navMap.setMap(map);
  if (!state.toKey && state.view === 'place') setView('browse');
  renderAll();
}
function setFrom(id, { say = true, confirm = false } = {}) {
  const p = pt(id); if (!p) return false;
  state.fromId = id; state.viewMap = state.map;
  if (state.toKey === keyOf(state.map, p)) { state.toKey = null; if (state.view === 'place') setView('browse'); }
  renderAll();
  if (say) { const msg = confirm ? t('confirmed', pname(p)) : t('locSet', pname(p)); announce(msg); toast(msg); }
  return true;
}
function setDest(key, { chip = null, say = true } = {}) {
  const d = resolve(key); if (!d) return;
  state.toKey = key; state.chip = chip; state.previewAll = false; state.viewMap = state.map;
  $('#search').value = '';
  setView('place');
  renderAll();
  if (say) { const r = planTo(key); announce(r ? t('routeTo', pname(d.p), fmtM(r.distance_m), fmtMin(r.seconds)) : pname(d.p)); }
  requestAnimationFrame(() => $('#destName').focus({ preventScroll: true }));
}
function clearDest() { state.toKey = null; state.chip = null; setView('browse'); renderAll(); }

/* =========================================================================
   Bottom sheet: peek / half / full, draggable, keyboard-operable
   ========================================================================= */
const sheetEl = () => $('#sheet');
const wide = () => mq('(min-width: 900px)');
const SNAPS = { browse: ['peek', 'half', 'full'], search: ['full'], place: ['peek', 'half', 'full'], pin: ['fit'] };
let snap = 'half';
function sheetHeights() {
  const el = sheetEl(), full = el.offsetHeight, H = $('#app').clientHeight, grip = $('.sheet-grip').offsetHeight;
  let peek = grip + 54;
  if (state.view === 'place') peek = 22 + $('#viewPlace .place-head').offsetHeight + ($('#routeStats').hidden ? 0 : $('#routeStats').offsetHeight + 16) + 18;
  const fit = Math.min(full, 22 + ($('#viewPin').scrollHeight || 160) + 32);
  return { peek: Math.min(full, peek), half: Math.min(full, Math.max(peek + 80, Math.round(H * .52))), full, fit };
}
function applySheet(animate = true) {
  const el = sheetEl();
  if (wide()) { document.documentElement.style.setProperty('--sheet-vis', '0px'); el.style.removeProperty('--sheet-y'); return; }
  const h = sheetHeights(), vis = h[snap] ?? h.half;
  el.classList.toggle('dragging', !animate);
  el.style.setProperty('--sheet-y', `${Math.max(0, h.full - vis)}px`);
  document.documentElement.style.setProperty('--sheet-vis', `${vis}px`);
  el.dataset.snap = snap;
  $('.sheet-body').style.overflowY = snap === 'peek' ? 'hidden' : '';
  $('#btnGrip').setAttribute('aria-label', t(snap === 'full' ? 'collapsePanel' : 'expandPanel'));
  $('#btnGrip').setAttribute('aria-expanded', String(snap === 'full'));
}
function setSnap(s, animate = true) { snap = (SNAPS[state.view] || ['half']).includes(s) ? s : SNAPS[state.view][0]; applySheet(animate); fitMain(animate); }
function setView(v) {
  state.view = v; sheetEl().dataset.view = v;
  for (const [id, name] of [['#viewBrowse', 'browse'], ['#viewSearch', 'search'], ['#viewPlace', 'place'], ['#viewPin', 'pin']]) $(id).hidden = name !== v;
  const want = { browse: snap === 'full' || snap === 'fit' ? 'half' : snap, search: 'full', place: 'half', pin: 'fit' }[v];
  $('.sheet-body').scrollTop = 0;
  requestAnimationFrame(() => setSnap(want));
}
function bindSheet() {
  const grip = $('.sheet-grip'); let drag = null, justDragged = false;
  grip.addEventListener('pointerdown', e => {
    if (wide() || e.target.closest('input, .search-field button, #btnSearchBack')) return;
    const h = sheetHeights(); drag = { y: e.clientY, vis: h[snap] ?? h.half, h, moved: false };
  });
  // Track the drag on the window: the finger soon leaves the handle, and capturing on press would swallow taps.
  window.addEventListener('pointermove', e => {
    if (!drag) return; const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    const vis = Math.max(drag.h.peek * .7, Math.min(drag.h.full, drag.vis - dy));
    sheetEl().classList.add('dragging'); sheetEl().style.setProperty('--sheet-y', `${drag.h.full - vis}px`);
    document.documentElement.style.setProperty('--sheet-vis', `${vis}px`); drag.cur = vis;
  });
  const end = () => {
    if (!drag) return; const d = drag; drag = null; sheetEl().classList.remove('dragging');
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    const allowed = SNAPS[state.view] || ['half'];
    const best = allowed.reduce((a, s) => Math.abs(d.h[s] - d.cur) < Math.abs(d.h[a] - d.cur) ? s : a, allowed[0]);
    setSnap(best);
  };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  $('#btnGrip').addEventListener('click', () => { if (justDragged) return; const allowed = SNAPS[state.view]; setSnap(allowed[(allowed.indexOf(snap) + 1) % allowed.length]); });
  window.addEventListener('resize', () => { applySheet(false); fitMain(false); });
}

/* =========================================================================
   Rendering
   ========================================================================= */
function renderAll() {
  if (!state.map) return;
  renderTopbar(); renderFloorRail(); renderBrowse();
  if (state.view === 'search') renderSearch();
  if (state.view === 'place') renderPlace();
  renderMap(); renderSettings();
}
function renderTopbar() {
  $('#placePill').innerHTML = `<bdi>${esc(state.map.building.name)}</bdi> · <bdi>${esc(floorName(state.map.floor))}</bdi>`;
  $('#btnPlace').setAttribute('aria-label', `${t('building')}: ${state.map.building.name}, ${floorName(state.map.floor)}`);
}
function renderFloorRail() {
  const rail = $('#floorRail'), floors = [...bFloors()].reverse();
  rail.hidden = floors.length < 2;
  rail.setAttribute('aria-label', t('floorsLabel'));
  rail.innerHTML = floors.map(f => `<button class="floor-btn${f === state.map ? ' here' : ''}" type="button" data-floor="${esc(f.floor.id)}" aria-pressed="${f === state.viewMap}" aria-label="${esc(t('viewFloor', floorName(f.floor)))}${f === state.map ? '. ' + esc(t('yourFloor')) : ''}">${esc(floorShort(f.floor))}</button>`).join('');
}
function renderMap() {
  const vm = state.viewMap; if (!vm) return;
  mainMap.setMap(vm);
  const dest = destRef(), from = pt(state.fromId);
  const plan = dest && !(dest.m === state.map && dest.p.id === state.fromId) && state.view === 'place' ? planTo(state.toKey) : null;
  mainMap.setYou(vm === state.map ? from : null, from?.facingDeg ?? 90);
  const leg = plan?.legs.find(l => l.map === vm);
  mainMap.setRoute(leg && leg.route.distance_m > 0 ? leg.route.path : null);
  if (state.view === 'pin' && pinPoint) mainMap.setDest(pinPoint);
  else if (dest && state.view === 'place') {
    if (dest.m === vm) mainMap.setDest(dest.p);
    else if (plan?.via && plan.legs[0].map === vm) mainMap.setDest(plan.via.pa, t('toFloor', floorName(dest.m.floor)));
    else mainMap.setDest(null);
  } else mainMap.setDest(null);
  mainMap.hidePoints([vm === state.map ? state.fromId : null, state.view === 'place' && dest?.m === vm ? dest.p.id : null, state.view === 'place' && plan?.via && plan.legs[0].map === vm ? plan.via.pa.id : null]);
  $('#mainMap').setAttribute('aria-label', t('mapOf', vm.building.name, floorName(vm.floor)));
  fitMain();
}
function fitMain(animate = true) {
  if (!mainMap?.map) return;
  const vm = state.viewMap, dest = destRef();
  const plan = state.view === 'place' && dest ? planTo(state.toKey) : null, leg = plan?.legs.find(l => l.map === vm);
  let pts = vm.plan.walls.flat();
  if (leg && leg.route.distance_m > 0) pts = leg.route.path;
  else if (state.view === 'pin' && pinPoint) pts = [[pinPoint.x - 12, pinPoint.y - 12], [pinPoint.x + 12, pinPoint.y + 12]];
  const top = ($('.topbar').offsetHeight || 64) + 12, vis = wide() ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-vis')) || 0;
  mainMap.fit({ pts, padTop: top, padBot: wide() ? 28 : vis + 20, padL: wide() ? 440 : 24, padR: 76, maxK: leg ? 3.2 : 2.6 }, animate);
}

/* ---------- Rows and cards ---------- */
function rowHTML(m, p, { dist = null, floor = false, extra = '', q = '' } = {}) {
  const sub = catName(p.category);
  return `<li><button class="row-btn" type="button" data-pick="${esc(keyOf(m, p))}"${q ? ` data-q="${esc(q)}"` : ''}>
    <span class="r-ico${isService(p.category) ? ' svc' : ''}">${catIco(p.category)}</span>
    <span class="r-main"><span class="r-name">${esc(pname(p))}</span><span class="r-sub">${esc(sub)}</span></span>
    <span class="r-end">${dist != null ? `<span>${esc(fmtM(dist))}</span>` : ''}${floor ? `<span class="badge floor">${esc(floorShort(m.floor))}</span>` : ''}${extra}</span></button></li>`;
}
function cardHTML(key, m, p, sub) {
  return `<li><button class="card-btn" type="button" data-pick="${esc(key)}"><span class="r-ico${isService(p.category) ? ' svc' : ''}">${catIco(p.category)}</span><span class="c-name">${esc(pname(p))}</span><span class="c-sub">${esc(sub)}</span></button></li>`;
}
const presentCats = () => { const s = new Set(); for (const m of bFloors()) for (const p of m.points) s.add(p.category); return s; };

/* ---------- Browse ---------- */
function renderBrowse() {
  const from = pt(state.fromId), multi = bFloors().length > 1, here = presentCats();
  $('#fromName').textContent = from ? pname(from) : '—';
  $$('.cat[data-cat]').forEach(c => { c.hidden = !CHIP_CATS[c.dataset.cat].some(k => here.has(k)); c.classList.toggle('is-active', c.dataset.cat === state.chip); });
  const bid = state.map.building.id, distSub = (m, p) => { const d = m === state.map ? distFor(m, from, p) : null; return [multi ? floorName(m.floor) : '', d != null ? fmtM(d) : ''].filter(Boolean).join(' · ') || catName(p.category); };
  // Saved (this building) and My spot
  const saved = state.saved.map(k => { const [b, f, id] = k.split('/'); if (b !== bid) return null; const m = mapByFloor(f), p = m && pointOf(m, id); return p ? { key: `${f}|${id}`, m, p } : null; }).filter(Boolean);
  const sp = store.get('dalil.spot', null); if (sp && sp.b === bid) { const m = mapByFloor(sp.f), p = m && pointOf(m, '@spot'); if (p) saved.unshift({ key: `${sp.f}|@spot`, m, p }); }
  $('#secSaved').hidden = !saved.length;
  $('#savedList').innerHTML = saved.map(s => cardHTML(s.key, s.m, s.p, distSub(s.m, s.p))).join('');
  // Recent destinations
  const recent = store.get('dalil.recent', []).filter(r => r.b === bid).map(r => { const d = resolve(r.k); return d ? { key: r.k, ...d } : null; }).filter(Boolean).slice(0, 8);
  $('#secRecent').hidden = !recent.length;
  $('#recentList').innerHTML = recent.map(r => cardHTML(r.key, r.m, r.p, distSub(r.m, r.p))).join('');
  // Frequent (from this phone's own history), otherwise the essentials of this floor
  const freq = Object.entries(store.get('dalil.freq', {})).filter(([k, n]) => n >= 2 && k.startsWith(bid + '/')).sort((a, b) => b[1] - a[1]).map(([k]) => resolve(k.slice(bid.length + 1))).filter(Boolean).slice(0, 5);
  let items = freq;
  if (!items.length) {
    const want = ['entrance', 'reception', 'toilet', 'toilet_acc', 'lift', 'cafe', 'prayer', 'baby'], seen = new Set();
    items = state.map.points.filter(p => want.includes(p.category) && p.id !== state.fromId)
      .map(p => ({ m: state.map, p, d: distFor(state.map, from, p) })).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))
      .filter(x => { const c = x.p.category.replace('_acc', ''); if (seen.has(c)) return false; seen.add(c); return true; }).slice(0, 5);
  }
  $('#keyTitle').textContent = t(freq.length ? 'secFrequent' : 'secKey');
  $('#secKey').hidden = !items.length;
  $('#keyList').innerHTML = items.map(x => rowHTML(x.m, x.p, { dist: x.m === state.map ? (x.d ?? distFor(x.m, from, x.p)) : null, floor: multi && x.m !== state.map })).join('');
}

/* ---------- Search ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
const FILTERS = { rooms: ['room'], toilets: ['toilet', 'toilet_acc', 'baby'], lifts: ['lift', 'stairs', 'ramp'], food: ['cafe'], prayer: ['prayer', 'wudu'], services: ['reception', 'entrance', 'exit'] };
const FILTER_LABEL = { rooms: 'filterRooms', toilets: 'filterToilets', lifts: 'filterLifts', food: 'filterFood', prayer: 'filterPrayer', services: 'filterServices' };
function searchPoints(q) {
  const nq = norm(q), words = nq ? nq.split(/\s+/) : [], from = pt(state.fromId), scored = [];
  const f = state.filter, cats = FILTERS[f];
  for (const m of bFloors()) {
    if (f === 'floor' && m !== state.map) continue;
    for (const p of m.points) {
      if (cats && !cats.includes(p.category)) continue;
      if (m === state.map && p.id === state.fromId) continue;
      const names = norm(`${p.nameEn} ${p.nameAr}`), catText = norm(`${catName(p.category)} ${STR.en.cats[p.category] || ''} ${STR.ar.cats[p.category] || ''} ${CAT_WORDS[p.category] || ''}`);
      if (words.length && !words.every(w => names.includes(w) || catText.includes(w))) continue;
      const starts = !nq ? 1 : norm(pname(p)).startsWith(nq) ? 0 : names.includes(nq) ? 1 : 2;
      const d = m === state.map ? distFor(m, from, p) : null;
      scored.push({ p, m, d, score: starts * 1e6 + (m === state.map ? 0 : 5e5) + (d ?? 4e5) });
    }
  }
  if (nq && /spot|car|park|مكان|سيار|موقف/.test(nq)) { const sp = store.get('dalil.spot', null), m = sp && mapByFloor(sp.f); const p = m && pointOf(m, '@spot'); if (p && sp.b === state.map.building.id) scored.unshift({ p, m, d: null, score: -1 }); }
  return scored.sort((a, b) => a.score - b.score);
}
function renderFilters() {
  const here = presentCats(), multi = bFloors().length > 1;
  const list = ['all', ...(multi ? ['floor'] : []), ...Object.keys(FILTERS).filter(k => FILTERS[k].some(c => here.has(c)))];
  if (!list.includes(state.filter)) state.filter = 'all';
  $('#searchFilters').innerHTML = list.map(k => `<button class="filter" type="button" data-filter="${k}" aria-pressed="${state.filter === k}">${esc(t(k === 'all' ? 'filterAll' : k === 'floor' ? 'filterFloor' : FILTER_LABEL[k]))}</button>`).join('');
}
function renderSearch() {
  renderFilters();
  const q = $('#search').value.trim(), browsing = !q && state.filter !== 'all' && state.filter !== 'floor';
  const searches = store.get('dalil.searches', []);
  $('#secSearches').hidden = !!q || browsing || !searches.length;
  $('#recentSearches').innerHTML = searches.map(s => `<li><button class="row-btn" type="button" data-search="${esc(s)}"><span class="r-ico">${ico('history')}</span><span class="r-main"><span class="r-name">${esc(s)}</span></span></button></li>`).join('');
  $('#searchHint').hidden = !!q || browsing || state.filter === 'floor';
  if (!q && !browsing && state.filter !== 'floor') { $('#results').innerHTML = ''; $('#noResults').hidden = true; return; }
  const res = searchPoints(q), multi = bFloors().length > 1;
  $('#noResults').hidden = res.length > 0;
  $('#noResultsTitle').textContent = t('noResultsFor', q);
  let html = '', group = null;
  for (const r of res.slice(0, 80)) {
    const g = r.m === state.map ? 'here' : r.m.floor.id;
    if (multi && g !== group) { group = g; html += `<li class="group-title" role="presentation">${esc(g === 'here' ? t('groupHere') : floorName(r.m.floor))}</li>`; }
    html += rowHTML(r.m, r.p, { dist: r.d, q });
  }
  $('#results').innerHTML = html;
  $('#resultsStatus').textContent = res.length ? t('results', res.length) : t('noResults');
}
function openSearch() { if (state.view !== 'search') { setView('search'); renderSearch(); } }
function closeSearch() { $('#search').value = ''; state.filter = 'all'; setView(state.toKey ? 'place' : 'browse'); renderAll(); }
function rememberSearch(q) { q = (q || '').trim(); if (!q) return; const s = store.get('dalil.searches', []).filter(x => x.toLowerCase() !== q.toLowerCase()); s.unshift(q); store.set('dalil.searches', s.slice(0, 6)); }

/* ---------- Nearest of a category ---------- */
function pickNearest(cat) {
  const label = t('cat_' + cat), cands = [];
  for (const m of bFloors()) for (const p of m.points) if (CHIP_CATS[cat].includes(p.category) && !(m === state.map && p.id === state.fromId)) cands.push({ m, p });
  if (!cands.length) { const msg = t('noneOfCat', label); toast(msg); announce(msg); return; }
  let best = null; const from = pt(state.fromId);
  for (const { m, p } of cands.filter(c => c.m === state.map)) { const d = distFor(m, from, p); if (d != null && (!best || d < best.d)) best = { m, p, d }; }
  if (best) best.r = planRoute(state.map, state.fromId, best.m, best.p.id);
  if (!best?.r) { best = null; for (const { m, p } of cands.filter(c => c.m !== state.map)) { const r = planRoute(state.map, state.fromId, m, p.id); if (r && (!best || r.seconds < best.r.seconds)) best = { m, p, r }; } }
  if (!best) { const msg = settings.stepFree ? t('noneReachable', label) : t('noRoute'); toast(msg); announce(msg); return; }
  setDest(keyOf(best.m, best.p), { chip: cat, say: false });
  announce(t('nearest', label, pname(best.p), fmtM(best.r.distance_m)));
}
function setStepFree(on) {
  settings.stepFree = on; saveSettings();
  $('#setStepFree').checked = on; $('#optStepFree').checked = on;
  renderAll();
  announce(t(on ? 'stepFreeOn' : 'stepFreeOff'));
}

/* ---------- Place (destination + route review) ---------- */
const roomNo = p => { if (['lift', 'stairs', 'pin', 'corridor'].includes(p.category)) return null; const m = (p.nameEn || '').match(/\(?\b([A-Z]?\d{2,4}[A-Z]?)\b\)?\s*$/); return m ? m[1] : null; };
function renderPlace() {
  const dest = destRef(); if (!dest) return;
  const to = dest.p, here = dest.m === state.map && state.fromId === to.id;
  const route = here ? null : planTo(state.toKey), multi = bFloors().length > 1;
  $('#placeIco').innerHTML = catIco(to.category);
  $('#destName').textContent = pname(to);
  $('#destMeta').innerHTML = `<span class="meta-line">${multi || dest.m !== state.map ? `<span class="badge floor">${esc(floorName(dest.m.floor))}</span>` : ''}<span>${esc(catName(to.category))}</span></span><bdi class="meta-bld">${esc(dest.m.building.name)}</bdi>`;
  const isSaved = isFav(state.toKey), fav = $('#btnFav');
  fav.setAttribute('aria-pressed', String(isSaved)); fav.setAttribute('aria-label', t(isSaved ? 'unsave' : 'save'));
  const msg = $('#routeMsg'); msg.className = 'route-msg'; msg.innerHTML = '';
  if (here) msg.textContent = t('alreadyHere');
  else if (!route && settings.stepFree) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noStepFreeTitle'))}</strong>${esc(t('noStepFreeBody'))}`; }
  else if (!route) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noRoute'))}</strong>`; }
  else if (route.closures) msg.textContent = t('closureNote');
  $('#routeStats').hidden = !route;
  if (route) {
    $('#statEta').textContent = fmtMin(route.seconds);
    $('#statDist').textContent = fmtM(route.distance_m);
    $('#routeVia').hidden = !route.via;
    if (route.via) $('#routeVia').innerHTML = `${svgIco(TURN_ICONS[route.via.lift ? 'lift' : 'stairs'], 'ico')}<span>${esc(t(route.via.lift ? 'viaLift' : 'viaStairs', floorName(route.via.toMap.floor)))}</span>`;
  }
  $('#btnStart').disabled = !route;
  $('#btnShare').hidden = !route;
  $('#optStepFree').checked = settings.stepFree;
  // Facts: room number and step-free access
  const facts = [], rn = roomNo(to);
  if (rn) facts.push(`<li>${ico('pin')}${esc(t('factRoom', rn))}</li>`);
  if (to.category === 'toilet_acc') facts.push(`<li class="ok">${ico('wheel')}${esc(t('accToilet'))}</li>`);
  if (!here) { const chair = settings.stepFree ? route : planTo(state.toKey, 'chair'); facts.push(chair ? `<li class="ok">${ico('check')}${esc(t('accYes'))}</li>` : `<li class="no">${ico('alert')}${esc(t('accNo'))}</li>`); }
  $('#placeFacts').innerHTML = facts.join('');
  $$('#placeFacts .ico, #placeFacts svg').forEach(s => s.classList.add('ico'));
  // Route preview
  const prev = route ? planSteps(route).steps.filter(s => s.kind === 'move' || s.kind === 'node' || s.kind === 'floor' || s.kind === 'arrive') : [];
  const show = state.previewAll ? prev : prev.slice(0, 4);
  $('#secPreview').hidden = !prev.length;
  $('#previewSteps').innerHTML = show.map(s => `<li class="${s.kind === 'floor' ? 'floor' : ''}"><span class="p-ico">${svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight)}</span><span>${esc(stepText(s))}</span></li>`).join('')
    + (prev.length > show.length ? `<li><button id="btnAllSteps" class="text-btn" type="button">${esc(t('moreSteps', prev.length))}</button></li>` : '');
  const kq = $('#kioskQR'); kq.hidden = !(state.kiosk && route); if (state.kiosk && route) kq.querySelector('.qr').innerHTML = qrSvg(shareLink());
}

/* ---------- Saved ---------- */
const favKey = key => `${state.map.building.id}/${key.replace('|', '/')}`;
const isFav = key => !!key && state.saved.includes(favKey(key));
function toggleFav(key, force) {
  const k = favKey(key), has = state.saved.includes(k), want = force ?? !has;
  if (want && !has) state.saved.push(k); if (!want && has) state.saved = state.saved.filter(x => x !== k);
  store.set('dalil.saved', state.saved);
  renderBrowse(); if (state.view === 'place') renderPlace();
  return want;
}
function rememberTrip(key) {
  const bid = state.map.building.id;
  const r = store.get('dalil.recent', []).filter(x => !(x.b === bid && x.k === key)); r.unshift({ b: bid, k: key }); store.set('dalil.recent', r.slice(0, 12));
  const f = store.get('dalil.freq', {}); f[`${bid}/${key}`] = (f[`${bid}/${key}`] || 0) + 1; store.set('dalil.freq', f);
}

/* ---------- Settings page ---------- */
function renderSettings() {
  $$('input[name="lang"]').forEach(r => { r.checked = r.value === settings.lang; });
  $$('input[name="theme"]').forEach(r => { r.checked = r.value === settings.theme; });
  $('#setVoice').checked = settings.voice; $('#setVibrate').checked = settings.vibrate; $('#setStepFree').checked = settings.stepFree;
  $('#setLarge').checked = settings.large; $('#setContrast').checked = settings.contrast; $('#setMotion').checked = settings.motion;
  $('#setBuilding').innerHTML = state.maps.map((m, i) => `<option value="${i}" ${m === state.map ? 'selected' : ''}>${esc(`${m.building.name} · ${floorName(m.floor)}`)}</option>`).join('');
}
function openSettings(section) {
  $('#settings').hidden = false; $('#app').inert = true;
  if (section) $(section)?.scrollIntoView({ block: 'start' });
  $('#btnSettingsBack').focus();
}
function closeSettings() { $('#settings').hidden = true; $('#app').inert = false; $('#btnSettings').focus(); }
function resolvedTheme() { return settings.theme === 'system' ? (mq('(prefers-color-scheme: light)') ? 'light' : 'dark') : settings.theme; }
function applyDisplay() {
  const h = document.documentElement;
  h.lang = settings.lang; h.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  h.dataset.theme = resolvedTheme();
  h.classList.toggle('large', settings.large); h.classList.toggle('contrast', settings.contrast); h.classList.toggle('reduce-motion', settings.motion);
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('meta[name="theme-color"]').content = settings.contrast ? '#000000' : resolvedTheme() === 'light' ? '#E4E2DC' : '#0C0D10';
}
function rerenderAll() {
  applyDisplay();
  if (!state.map) return;
  mainMap.renderPoints(); navMap.renderPoints();
  renderAll(); applySheet(false);
  if (nav.active) renderNavStep();
}
function setLang(l) { settings.lang = l; saveSettings(); rerenderAll(); }

/* =========================================================================
   Navigation
   ========================================================================= */
const nav = { active: false, plan: null, legs: [], steps: [], leg: -1, i: 0, pos: 0, sim: false, dwell: 0, raf: 0, last: 0, rot: 0, toKey: null };
function startNav() {
  const plan = planTo(state.toKey); if (!plan) return;
  const { legs, steps } = planSteps(plan), dest = destRef();
  rememberTrip(state.toKey);
  Object.assign(nav, { active: true, plan, legs, steps, leg: -1, i: 0, pos: 0, sim: false, dwell: 0, toKey: state.toKey, rot: null });
  $('#app').inert = true; $('#nav').hidden = false;
  $('#navDest').textContent = pname(dest.p);
  renderMode(); renderStepList();
  goStep(0, { focus: true, intro: t('navStarted', pname(dest.p)) + ' ' + t('modeStepHint') });
}
function endNav() {
  stopSim(); nav.active = false;
  try { speechSynthesis?.cancel(); } catch { }
  $('#nav').hidden = true; $('#arrived').hidden = true; $('#nav').inert = false; $('#app').inert = false;
  renderAll();
  ($('#btnStart').disabled ? $('#search') : $('#btnStart')).focus();
}
function renderMode() {
  $('#navMode').classList.toggle('preview', nav.sim);
  $('#navModeText').textContent = t(nav.sim ? 'modePreviewShort' : 'modeStepShort');
  $('#navMode').title = t(nav.sim ? 'modePreviewHint' : 'modeStepHint');
}
function renderStepList() {
  $('#stepList').innerHTML = nav.steps.map((s, i) => `<li data-i="${i}" class="${i === nav.i ? 'is-current' : i < nav.i ? 'is-done' : ''}" ${i === nav.i ? 'aria-current="step"' : ''}>${esc(stepText(s))}</li>`).join('');
}
function goStep(i, { focus = false, speakIt = true, intro = '' } = {}) {
  i = Math.max(0, Math.min(nav.steps.length - 1, i));
  const prev = nav.i; nav.i = i; nav.dwell = 0;
  const s = nav.steps[i]; nav.pos = s.d0;
  renderNavStep();
  if (speakIt) {
    const text = stepText(s);
    announce(`${intro ? intro + ' ' : ''}${t('stepOf', i + 1, nav.steps.length)}. ${text}`);
    speak(text);
    if (i !== prev || i === 0) {
      if (s.kind === 'move' && s.turn !== 'straight') buzz(s.turn === 'around' ? [80, 60, 80, 60, 80] : [70, 50, 70]);
      else if (s.kind === 'node') buzz([200]); else if (s.kind === 'floor') buzz([120, 80, 120]); else if (s.kind === 'arrive') buzz([100, 60, 100, 60, 260]);
    }
  }
  if (focus) $('#navStepText').focus();
  if (s.kind === 'arrive') { stopSim(); setTimeout(showArrival, 700); }
}
function renderNavStep() {
  const s = nav.steps[nav.i];
  $('#navIco').innerHTML = svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight);
  $('.instr').classList.toggle('floor', s.kind === 'floor');
  $('#navStepNum').textContent = t('stepOf', nav.i + 1, nav.steps.length);
  $('#navStepText').textContent = stepText(s);
  $('#btnTag').hidden = s.kind !== 'node';
  $('#btnPrev').disabled = nav.i === 0; $('#btnNext').disabled = nav.i >= nav.steps.length - 1;
  $('#navDest').textContent = pname(resolve(nav.toKey)?.p);
  const ahead = s.kind !== 'floor' && nav.steps.slice(nav.i + 1, nav.i + 3).find(x => x.kind === 'floor');
  $('#navFloor').hidden = !ahead;
  if (ahead) $('#navFloorText').textContent = t('floorAhead', floorName(nav.plan.via.toMap.floor));
  renderStepList();
  $('#navMap').setAttribute('aria-label', t('mapAlt'));
  updateNavPos(true);
}
function updateNavPos(animate) {
  const s = nav.steps[nav.i], leg = nav.legs[s.leg], path = leg.route.path;
  if (nav.leg !== s.leg) {
    nav.leg = s.leg; nav.rot = null; navMap.setMap(leg.map);
    const d = resolve(nav.toKey); navMap.setDest(d && d.m === leg.map ? d.p : nav.plan.via?.pa || null, d && d.m !== leg.map ? t('toFloor', floorName(d.m.floor)) : '');
    animate = false;
  }
  const p = pointAt(path, leg.cum, nav.pos), next = nav.steps[nav.i + 1];
  let sub = '';
  if (s.kind === 'move') sub = t('left', fmtM(s.d1 - nav.pos));
  if (next && s.kind !== 'arrive') sub += (sub ? '  ·  ' : '') + `${t('then')}: ${stepShort(next)}`;
  $('#navStepSub').textContent = sub;
  const total = nav.legs.reduce((a, l) => a + l.L, 0) || 1;
  const remain = Math.max(0, leg.L - nav.pos) + nav.legs.slice(s.leg + 1).reduce((a, l) => a + l.L, 0);
  $('#navRemain').textContent = fmtM(remain);
  $('#navRemainTime').textContent = t('remainTime', fmtMin(nav.plan.seconds * remain / total));
  const pct = Math.round(100 * (1 - remain / total));
  $('#navProgress span').style.width = `${pct}%`; $('#navProgress').setAttribute('aria-valuenow', String(pct));
  navMap.setRoute([[p.x, p.y]].concat(path.slice(p.i)), path.slice(0, p.i).concat([[p.x, p.y]]));
  const h = headingAt(path, leg.cum, nav.pos + (s.kind === 'move' ? 0 : 0.01));
  const [px, py] = navMap.px(p.x, p.y);
  let rot = -90 + h;
  if (nav.rot != null) { while (rot - nav.rot > 180) rot -= 360; while (rot - nav.rot < -180) rot += 360; }
  nav.rot = rot;
  // Keep "you" in the open band between the instruction card and the panel, low enough to see what's ahead.
  const [vw, vh] = navMap.size(), top = $('.nav-top').getBoundingClientRect().bottom, bot = $('.nav-panel').getBoundingClientRect().top;
  const ay = Math.min(.9, Math.max(.35, (top + (bot - top) * .78) / vh));
  navMap.setCam({ x: px, y: py, k: Math.max(.6, Math.min(3.2, vw / (24 * BASE))), rot, tilt: 50, ax: .5, ay }, animate);
  navMap.setYou({ x: p.x, y: p.y }, h);
}
function confirmTag() { const s = nav.steps[nav.i]; if (s.kind !== 'node') return; setFrom(s.node, { say: true, confirm: true }); buzz([40]); goStep(nav.i + 1); }
function toggleSim() { nav.sim ? stopSim() : startSim(); }
function startSim() {
  if (nav.steps[nav.i].kind === 'arrive') goStep(0);
  nav.sim = true; nav.last = performance.now(); renderMode();
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'true'); b.querySelector('.ctrl-txt').textContent = t('pause'); b.querySelector('.ico').innerHTML = ico('pause');
  const tick = now => {
    if (!nav.sim) return;
    const dt = Math.min(.1, (now - nav.last) / 1000); nav.last = now;
    const s = nav.steps[nav.i];
    if (s.kind === 'move') { nav.pos = Math.min(s.d1, nav.pos + 3 * dt); updateNavPos(false); if (nav.pos >= s.d1 - 1e-6) goStep(nav.i + 1); }
    else if (s.kind !== 'arrive') { nav.dwell += dt; if (nav.dwell > 1.6) { if (s.kind === 'node') setFrom(s.node, { say: false }); goStep(nav.i + 1); } }
    nav.raf = requestAnimationFrame(tick);
  };
  nav.raf = requestAnimationFrame(tick);
}
function stopSim() {
  nav.sim = false; cancelAnimationFrame(nav.raf);
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'false'); b.querySelector('.ctrl-txt').textContent = t('preview'); b.querySelector('.ico').innerHTML = ico('play');
  if (nav.active) renderMode();
}
function showArrival() {
  if (!nav.active) return;
  const to = resolve(nav.toKey)?.p;
  $('#arrivedName').textContent = pname(to);
  $('#arrivedStats').textContent = `${fmtM(nav.plan.distance_m)} · ${fmtMin(nav.plan.seconds)}`;
  $('#btnArrivedSave').textContent = isFav(nav.toKey) ? t('saved') : t('savePlace');
  $('#arrived').hidden = false; $('#nav').inert = true;
  $('#arrivedTitle').focus();
}
function finishArrival() {
  $('#nav').inert = false;
  const d = resolve(nav.toKey);
  if (d && !d.p.virtual) { if (d.m !== state.map) selectFloor(d.m); state.fromId = d.p.id; }
  state.toKey = null; state.chip = null; setView('browse');
  endNav();
  navMap.setMap(state.map); nav.leg = -1;
}

/* =========================================================================
   Deep links and DALIL tags
   #at-P013 · #at-P001&to-P007 · #b=<building>&f=<floor>&at-P001 · /t/<b>/<f>/<p> (NFC) · #kiosk
   ========================================================================= */
function parseLink(href) {
  const out = {};
  let u; try { u = new URL(href, location.href); } catch { return out; }
  const tag = s => { const m = s.match(/(?:^|\/)t\/([^/]+)\/([^/]+)\/([^/?#]+)/); if (m) { out.b = decodeURIComponent(m[1]); out.f = decodeURIComponent(m[2]); out.at = decodeURIComponent(m[3]); } };
  tag(u.pathname);
  if (u.searchParams.get('t')) tag('t/' + u.searchParams.get('t'));
  for (const k of ['b', 'f', 'at', 'to']) if (u.searchParams.get(k)) out[k] = u.searchParams.get(k);
  const h = decodeURIComponent(u.hash.replace(/^#/, ''));
  if (h) {
    tag(h);
    for (const part of h.split('&')) {
      let m;
      if ((m = part.match(/^(at|to)[-=](.+)$/))) out[m[1]] = m[2];
      else if ((m = part.match(/^([bf])=(.+)$/))) out[m[1]] = m[2];
      else if (part === 'kiosk') out.kiosk = true;
    }
  }
  return out;
}
function applyLink(link, { fromTag = false } = {}) {
  if (!link.at && !link.to && !link.b) return false;
  let map = state.map;
  if (link.b) {
    const cands = state.maps.filter(m => m.building.id === link.b);
    map = cands.find(m => !link.f || m.floor.id === link.f) || cands[0] || null;
    if (!map) { if (fromTag) toast(t('nfcUnknown')); return false; }
  } else if (link.at && !map.points.some(p => p.id === link.at)) map = state.maps.find(m => m.points.some(p => p.id === link.at)) || map;
  if (link.f && !link.b) map = state.maps.find(m => m.building.id === map.building.id && m.floor.id === link.f) || map;
  if (map !== state.map) selectFloor(map);
  if (link.at) setFrom(link.at, { confirm: fromTag, say: fromTag });
  if (link.to) {
    const key = link.to.includes('|') ? link.to : [state.map, ...bFloors()].map(m => m.points.some(p => p.id === link.to) ? keyOf(m, { id: link.to }) : null).find(Boolean);
    if (key) setDest(key);
  }
  return true;
}
async function openTagPicker() {
  const dlg = $('#dlgTag'), status = $('#nfcStatus');
  const pts = [...state.map.points].sort((a, b) => (b.dalilNode - a.dalilNode));
  $('#tagList').innerHTML = pts.map(p => `<li><button class="row-btn" type="button" data-tag="${esc(p.id)}"><span class="r-ico${p.dalilNode ? ' svc' : ''}">${p.dalilNode ? ico('tag') : catIco(p.category)}</span><span class="r-main"><span class="r-name">${esc(pname(p))}</span><span class="r-sub">${esc(p.dalilNode ? `${t('dalilTag')} · ${p.id}` : catName(p.category))}</span></span></button></li>`).join('');
  status.textContent = 'NDEFReader' in window ? t('nfcReady') : t('nfcNone');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  if ('NDEFReader' in window) {
    const ctl = new AbortController(); dlg.addEventListener('close', () => ctl.abort(), { once: true });
    try {
      const reader = new window.NDEFReader(); await reader.scan({ signal: ctl.signal });
      reader.onreading = ev => {
        const dec = new TextDecoder();
        for (const rec of ev.message.records) if (['url', 'absolute-url', 'text'].includes(rec.recordType)) { const link = parseLink(dec.decode(rec.data)); if (link.at) { dlg.close(); applyLink(link, { fromTag: true }); buzz([40]); return; } }
        status.textContent = t('nfcUnknown');
      };
    } catch { status.textContent = t('nfcFail'); }
  }
}

/* =========================================================================
   Dropped pins, My spot, sharing, kiosk
   ========================================================================= */
let pinPoint = null;
function onMapTap({ x, y }) {
  const vm = state.viewMap, R = routerOf(vm);
  if (!R) return;   // v1 maps (stored routes only) cannot route to an arbitrary spot
  if (!R.walkable(x, y)) { toast(t('pinOutside')); return; }
  pinPoint = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, f: vm.floor.id };
  $('#pinText').textContent = t('pinAt', floorName(vm.floor));
  setView('pin'); renderMap();
  announce(t('pinAt', floorName(vm.floor)));
}
const pinKey = () => pinPoint ? `${pinPoint.f}|@${pinPoint.x},${pinPoint.y}` : null;
function shareLink(key = state.toKey) {
  const u = new URL(location.href); u.search = '';
  u.hash = `b=${state.map.building.id}&f=${state.map.floor.id}&at-${state.fromId}${key ? `&to-${encodeURIComponent(key)}` : ''}`;
  return u.toString();
}
function qrSvg(text) { if (!window.qrcode) return ''; const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: { text: t('kioskQR') } }); }
function openShare() {
  const url = shareLink(), d = destRef();
  $('#shareQR').innerHTML = qrSvg(url); $('#shareUrl').value = url;
  $('#btnShareNative').hidden = !navigator.share;
  $('#dlgShare').dataset.title = d ? pname(d.p) : 'DALIL';
  $('#dlgShare').showModal ? $('#dlgShare').showModal() : $('#dlgShare').setAttribute('open', '');
}
let kioskTimer = 0;
function kioskIdle() {
  clearTimeout(kioskTimer); if (!state.kiosk) return;
  kioskTimer = setTimeout(() => {
    if (nav.active) endNav();
    $('#arrived').hidden = true; $('#nav').inert = false;
    const m = state.maps.find(m => m.building.id === state.kiosk.b && m.floor.id === state.kiosk.f);
    if (m && m !== state.map) selectFloor(m);
    state.fromId = state.kiosk.at; state.toKey = null; state.chip = null; $('#search').value = '';
    setView('browse'); renderAll(); announce(t('kioskReset'));
  }, 90_000);
}

/* =========================================================================
   Wiring
   ========================================================================= */
function bind() {
  bindSheet();
  $('#btnLang').onclick = () => setLang(settings.lang === 'ar' ? 'en' : 'ar');
  $('#btnSettings').onclick = () => openSettings();
  $('#btnPlace').onclick = () => openSettings('#setMapSec');
  $('#btnSettingsBack').onclick = closeSettings;
  const search = $('#search');
  search.addEventListener('focus', openSearch);
  search.addEventListener('input', () => { openSearch(); renderSearch(); });
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const b = $('#results button[data-pick]'); if (b) { e.preventDefault(); rememberSearch(search.value); setDest(b.dataset.pick); } }
    else if (e.key === 'ArrowDown') { const b = $('#results button, #recentSearches button'); if (b) { e.preventDefault(); b.focus(); } }
    else if (e.key === 'Escape') closeSearch();
  });
  $('#btnSearchBack').onclick = closeSearch;
  $('#btnClearSearches').onclick = () => { store.set('dalil.searches', []); renderSearch(); };
  $('#searchFilters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { state.filter = b.dataset.filter; renderSearch(); } });
  $('#viewSearch').addEventListener('keydown', e => {
    const items = $$('#viewSearch .row-btn'), i = items.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : search).focus(); }
  });
  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { if (pick.dataset.q) rememberSearch(pick.dataset.q); setDest(pick.dataset.pick); return; }
    const rs = e.target.closest('[data-search]');
    if (rs) { search.value = rs.dataset.search; renderSearch(); search.focus(); return; }
    if (e.target.closest('#btnAllSteps')) { state.previewAll = true; renderPlace(); }
  });
  $$('.cat[data-cat]').forEach(c => { c.onclick = () => pickNearest(c.dataset.cat); });
  $('#optStepFree').addEventListener('change', e => setStepFree(e.target.checked));
  $('#btnScan').onclick = openTagPicker; $('#btnFrom').onclick = openTagPicker;
  $('#tagList').addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) { e.preventDefault(); $('#dlgTag').close(); setFrom(b.dataset.tag); } });
  $('#btnFav').onclick = () => { if (state.toKey) { const on = toggleFav(state.toKey); announce(t(on ? 'saved' : 'unsave')); toast(t(on ? 'saved' : 'unsave')); } };
  $('#btnStart').onclick = startNav;
  $('#btnClosePlace').onclick = clearDest;
  $('#btnClosePin').onclick = () => { pinPoint = null; setView('browse'); renderMap(); };
  $('#btnShare').onclick = openShare;
  $('#btnShareCopy').onclick = async () => { const v = $('#shareUrl').value; try { await navigator.clipboard.writeText(v); toast(t('copied')); } catch { $('#shareUrl').select(); } };
  $('#btnShareNative').onclick = async () => { try { await navigator.share({ title: 'DALIL', text: $('#dlgShare').dataset.title, url: $('#shareUrl').value }); } catch { } };
  $('#btnPinGo').onclick = () => { const k = pinKey(); if (k) { pinPoint = null; setDest(k); } };
  $('#btnPinSave').onclick = () => { if (!pinPoint) return; store.set('dalil.spot', { b: state.map.building.id, f: pinPoint.f, x: pinPoint.x, y: pinPoint.y }); pinPoint = null; setView('browse'); renderAll(); toast(t('spotSaved')); announce(t('spotSaved')); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, kioskIdle, { passive: true }));
  $('#btnRecenter').onclick = () => { state.viewMap = state.map; renderFloorRail(); renderMap(); };
  $('#btnZoomIn').onclick = () => mainMap.zoom(1.3); $('#btnZoomOut').onclick = () => mainMap.zoom(1 / 1.3);
  $('#floorRail').addEventListener('click', e => { const b = e.target.closest('[data-floor]'); if (!b) return; const m = mapByFloor(b.dataset.floor); if (m && m !== state.viewMap) { state.viewMap = m; renderFloorRail(); renderMap(); announce(t('viewFloor', floorName(m.floor))); } });
  // Settings
  $$('input[name="lang"]').forEach(r => r.addEventListener('change', () => setLang(r.value)));
  $$('input[name="theme"]').forEach(r => r.addEventListener('change', () => { settings.theme = r.value; saveSettings(); applyDisplay(); }));
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (settings.theme === 'system') applyDisplay(); });
  const toggle = (id, key, after) => $(id).addEventListener('change', e => { settings[key] = e.target.checked; saveSettings(); after?.(); });
  toggle('#setVoice', 'voice', () => { if (!settings.voice) try { speechSynthesis.cancel(); } catch { } });
  toggle('#setVibrate', 'vibrate');
  $('#setStepFree').addEventListener('change', e => setStepFree(e.target.checked));
  toggle('#setLarge', 'large', rerenderAll); toggle('#setContrast', 'contrast', rerenderAll); toggle('#setMotion', 'motion', rerenderAll);
  $('#setBuilding').addEventListener('change', e => { const m = state.maps[+e.target.value]; if (m) { state.toKey = null; setView('browse'); selectFloor(m); } });
  $('#fileMap').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
  // Navigation
  $('#btnNext').onclick = () => goStep(nav.i + 1);
  $('#btnPrev').onclick = () => goStep(nav.i - 1);
  $('#btnRepeat').onclick = () => { const s = nav.steps[nav.i]; announce(stepText(s)); speak(stepText(s)); };
  $('#btnSim').onclick = toggleSim;
  $('#btnTag').onclick = confirmTag;
  $('#btnEndNav').onclick = endNav;
  $('#btnArrivedDone').onclick = finishArrival;
  $('#btnArrivedSave').onclick = () => { toggleFav(nav.toKey, true); $('#btnArrivedSave').textContent = t('saved'); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#settings').hidden) return closeSettings();
      if (nav.active && $('#arrived').hidden) return endNav();
      if (!nav.active && state.view === 'place' && !e.target.closest('input')) return clearDest();
      if (!nav.active && state.view === 'pin') { pinPoint = null; setView('browse'); renderMap(); }
    }
    if (!nav.active || !$('#arrived').hidden || e.target.closest('input,select,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const fwd = (e.key === 'ArrowRight') !== (settings.lang === 'ar'); goStep(nav.i + (fwd ? 1 : -1)); }
  });
  window.addEventListener('hashchange', () => applyLink(parseLink(location.href)));
  $('#btnRetry').onclick = () => { $('#bootError').hidden = true; $('#bootText').hidden = false; $('#bootBar').hidden = false; boot(); };
}

async function boot() {
  try { await loadBundled(); } catch { /* handled below */ }
  if (!state.maps.length) { $('#bootText').hidden = true; $('#bootBar').hidden = true; $('#bootError').hidden = false; $('#btnRetry').focus(); return false; }
  const last = store.get('dalil.last', null), link = parseLink(location.href);
  const start = (link.b && state.maps.find(m => m.building.id === link.b && (!link.f || m.floor.id === link.f)))
    || (last && state.maps.find(m => m.building.id === last.b && m.floor.id === last.f)) || state.maps[0];
  selectFloor(start);
  applyLink(link, { fromTag: /\/t\//.test(location.pathname) });
  if (link.kiosk) { state.kiosk = { b: state.map.building.id, f: state.map.floor.id, at: state.fromId }; document.documentElement.classList.add('kiosk'); renderAll(); kioskIdle(); }
  applySheet(false); fitMain(false);
  const b = $('#boot'); b.classList.add('done'); setTimeout(() => { b.hidden = true; }, 380);
  document.documentElement.classList.add('ready');
  return true;
}
async function init() {
  applyDisplay(); fillIcons();
  mainMap = new MapView($('#mainMap'), { interactive: true, label: pname, pickKey: keyOf, onTap: p => onMapTap(p), onCam: c => $('#mainMap').classList.toggle('show-labels', c.k * BASE >= 16) });
  navMap = new MapView($('#navMap'), { points: 'nodes', label: pname });
  bind();
  return boot();
}

window.DALIL_APP = { state, settings, spoken, nav, parseLink, buildSteps, routeFor, pointOf, views: () => ({ mainMap, navMap, floorMap: mainMap }), ready: init() };

if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
