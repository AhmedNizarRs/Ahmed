// DALIL visitor app. No build step. Pages: Home, Search, Route, Where am I, Floor map, Settings, Getting here, Navigation.
// Modules: i18n.js (strings, icons) · mapview.js (floor plan) · router.js (on-device routing) · tracker.js (compass and
// steps) · camera.js (camera guide line, QR) · outdoor.js + providers.js (street maps). QR codes: vendor/qrcode.js (MIT).
import { Router } from './router.js';
import { STR, TILE_CATS, CAT_WORDS, CAT_ICONS, TURN_ICONS, TURN_ANGLE, UI, svgIco } from './i18n.js';
import { MapView, BASE } from './mapview.js';
import { geoTransform, haversine } from './outdoor.js';
import { Tracker, Follower, wrap180 } from './tracker.js';
import { CameraGuide, QRScanner, openCamera, closeCamera, cameraError } from './camera.js';
import { availableProviders, allProviders } from './providers.js';
import { Locator, planFromGeo, locationGranted } from './locate.js';
import { Survey, strideFromHeight } from './survey.js';

/* =========================================================================
   Settings, storage and the building's config (every read/write guarded: private mode may throw)
   ========================================================================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const mq = q => window.matchMedia && window.matchMedia(q).matches;
const SETTINGS_V = 4;
const saved0 = store.get('dalil.settings', {});
// v3: Night is the new default look, and motion is always on (there is no step-by-step mode any more).
if (saved0.v !== SETTINGS_V) { if (saved0.large) saved0.textSize = 'large'; if ((saved0.v ?? 0) < 4) delete saved0.theme; delete saved0.large; delete saved0.sensors; saved0.v = SETTINGS_V; }   // v4: Day becomes the default look
const settings = Object.assign({
  v: SETTINGS_V, lang: (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en',
  theme: 'light', textSize: 'normal', voice: true, vibrate: true, stepFree: false, pace: 'normal', mapProvider: 'auto', gps: true, mapLayers: {}, mapOpacity: 85,
  contrast: mq('(prefers-contrast: more)'), motion: mq('(prefers-reduced-motion: reduce)'),
}, saved0);
const saveSettings = () => store.set('dalil.settings', settings);
const STRIDE = { slow: 0.55, normal: 0.68, fast: 0.78 };
const SPEED = { slow: 0.8, normal: 1.1, fast: 1.35 };
const T = () => STR[settings.lang];
const t = (key, ...a) => { const v = T()[key] ?? STR.en[key] ?? key; return typeof v === 'function' ? v(...a) : v; };
const DEFAULT_CFG = { institution: {}, help: {}, buildings: {}, maps: { order: ['openfreemap', 'versatiles'], keys: {} }, analytics: { endpoint: null }, features: { camera: true, motion: true } };
let cfg = DEFAULT_CFG;
async function loadConfig() {
  try { const r = await fetch('config.json', { cache: 'no-cache' }); if (r.ok) { const c = await r.json(); cfg = { ...DEFAULT_CFG, ...c, maps: { ...DEFAULT_CFG.maps, ...c.maps }, features: { ...DEFAULT_CFG.features, ...c.features } }; } } catch { /* defaults */ }
}
const helpCfg = () => ({ ...cfg.help, ...(cfg.buildings?.[state.map?.building.id]?.help || {}) });

/* =========================================================================
   State
   ========================================================================= */
const state = {
  maps: [], map: null, viewMap: null, fromId: null, toKey: null, chip: null, filter: 'all', kiosk: null,
  routeLeg: 0, saved: store.get('dalil.saved', []),
};
const spoken = [];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ico = name => svgIco(UI[name] || '');
// All the plan's points (walls, and walked corridors for surveyed buildings) for fitting the view.
const planPts = m => m.plan.walls.flat().concat((m.plan.corridors || []).flat());
const catIco = c => svgIco(CAT_ICONS[c] || CAT_ICONS.room);
const fillIcons = (root = document) => root.querySelectorAll('[data-ico]').forEach(el => { if (!el.firstChild) el.innerHTML = ico(el.dataset.ico); });
const pt = id => state.map?.points.find(p => p.id === id) || null;
const bname = b => b ? ((settings.lang === 'ar' && b.nameAr) || b.name) : '';
const pname = p => p ? (settings.lang === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)) : '';
const catName = c => T().cats[c] || STR.en.cats[c] || c;
const mode = () => settings.stepFree ? 'chair' : 'walk';
const isService = c => ['toilet', 'toilet_acc', 'lift', 'stairs', 'ramp', 'prayer', 'wudu', 'cafe', 'reception', 'entrance', 'exit', 'baby'].includes(c);
const coarse = () => mq('(pointer: coarse)');
const cap = s => s[0].toUpperCase() + s.slice(1);

/* =========================================================================
   Privacy-safe usage counts for the building (off unless config.analytics.endpoint is set).
   No device id, no names, no positions: only which places are searched for and routed to.
   ========================================================================= */
const analytics = {
  q: [], sent: [],
  add(e, p = {}) {
    if (!cfg.analytics?.endpoint) return;
    this.q.push({ e, t: Math.floor(Date.now() / 3.6e6) * 3.6e6, b: state.map?.building.id, f: state.map?.floor.id, lang: settings.lang, ...p });
    if (this.q.length >= 20) this.flush();
  },
  flush() {
    const url = cfg.analytics?.endpoint; if (!url || !this.q.length) return;
    const body = JSON.stringify({ v: 1, events: this.q.splice(0) }); this.sent.push(body);
    try { if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => { }); } catch { }
  },
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') analytics.flush(); });

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
// Walking time at the visitor's own pace (route files assume about 1.1 m/s).
const secsFor = plan => plan ? Math.round(plan.seconds * SPEED.normal / SPEED[settings.pace]) : 0;
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
const fmtDist = d => d < 1000 ? fmtM(d) : t('km', (d / 1000).toFixed(d < 10000 ? 1 : 0));
const floorShort = f => /^(ground|g)$/i.test(f.id) || /^ground\b/i.test(f.name || '') || /^ground-floor$/i.test(f.id) ? t('floorG') : /(\d+)/.test(f.name || '') ? f.name.match(/(\d+)/)[1] : /^mezz/i.test(f.name || '') ? 'M' : String(f.name || f.id).slice(0, 3);
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
// The action alone ("Bear right"), without the walk after it or a closing full stop: the HUD shows one short line.
const stepShort = s => (settings.lang === 'ar' ? (s.ar || '').split(/،\s*ثم\s*/)[0] : (s.en || '').split(/,\s*then\s*/i)[0]).replace(/\s*\.\s*$/, '');

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
    u.rate = settings.pace === 'slow' ? .85 : .95; speechSynthesis.speak(u);
  } catch { /* speech is optional */ }
}
function announce(text, assertive = false) { const el = assertive ? $('#liveAssertive') : $('#live'); el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); }
function buzz(pattern) { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(pattern); } catch { } }
let toastTimer;
function toast(text, ms = 3600) { const el = $('#toast'); el.textContent = text; el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

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
  $('#loadMsg').textContent = t('mapLoaded', `${bname(m.building)} · ${floorName(m.floor)}`) + (kept ? '' : ' ' + t('mapSessionOnly'));
  selectFloor(m);
}

/* =========================================================================
   Pages: one at a time, each with a Back button; the phone's back button works too
   ========================================================================= */
const PAGES = { home: '#pgHome', search: '#pgSearch', route: '#pgRoute', where: '#pgWhere', map: '#pgMap', settings: '#pgSettings', outdoor: '#pgOutdoor', nav: '#nav', survey: '#pgSurvey' };
const stack = ['home'];
let pageNow = 'home', histOK = true, skipPop = 0;
function display(name) {
  if (!PAGES[name]) name = 'home';
  if (name === 'route' && !destRef()) name = 'home';
  if (name === 'nav' && !nav.active) name = state.toKey ? 'route' : 'home';
  const prev = pageNow;
  for (const [k, sel] of Object.entries(PAGES)) $(sel).hidden = k !== name;
  pageNow = name;
  document.documentElement.classList.toggle('navigating', name === 'nav');
  if (prev !== name) leavePage(prev, name);
  enterPage(name, prev);
}
function go(name) {
  if (name === pageNow) { enterPage(name, name); return; }
  stack.push(name);
  if (histOK) try { history.pushState({ dalil: stack.length }, ''); } catch { histOK = false; }
  display(name);
}
// The screen changes at once; the browser history follows (so a frame without history can never leave the app).
function back() {
  if (stack.length <= 1) { display('home'); return; }
  stack.pop(); display(stack[stack.length - 1]);
  if (histOK) { skipPop++; try { history.back(); } catch { skipPop--; } }
}
function goHome() {
  const n = stack.length - 1; stack.length = 1;
  display('home');
  if (n > 0 && histOK) { skipPop++; try { history.go(-n); } catch { skipPop--; } }
}
window.addEventListener('popstate', e => {
  if (skipPop > 0) { skipPop--; return; }
  const n = e.state?.dalil || 1;
  stack.length = Math.max(1, Math.min(stack.length, n));
  display(stack[stack.length - 1] || 'home');
});
function enterPage(name, prev) {
  if (name === 'home') renderHome();
  else if (name === 'search') { renderSearch(); if (prev !== 'search') requestAnimationFrame(() => $('#search').focus()); }
  else if (name === 'route') { state.routeLeg = 0; renderRoute(); if (prev !== 'route') requestAnimationFrame(() => $('#destName').focus({ preventScroll: true })); }
  else if (name === 'where') renderWhere();
  else if (name === 'map') { state.viewMap ||= state.map; renderFloorMap(); }
  else if (name === 'settings') renderSettings();
  else if (name === 'outdoor') openOutdoor();
  else if (name === 'survey') renderSurvey();
  if (!['nav', 'route', 'search', 'home'].includes(name) && prev !== name) requestAnimationFrame(() => $(PAGES[name]).querySelector('[data-back]')?.focus?.({ preventScroll: true }));
}
function leavePage(name) {
  if (name === 'survey') svStop();
  if (name === 'where') stopWhere();
  if (name === 'map') { pinPoint = null; $('#pinCard').hidden = true; }
  if (name === 'outdoor') { outdoorSeq++; outdoorCtl?.destroy(); outdoorCtl = null; }
  if (name === 'nav' && nav.active) endNav({ silent: true });
  if (name === 'search') { $('#search').value = ''; state.filter = 'all'; }
}

/* =========================================================================
   Location and destination
   ========================================================================= */
let homeMap, routeMap, mainMap, navMap;
const defaultFrom = map => (map.points.find(p => p.category === 'entrance' && p.dalilNode) || map.points.find(p => p.dalilNode) || map.points[0])?.id || null;
function selectFloor(map, { keepFrom = false } = {}) {
  state.map = map; state.viewMap = map;
  if (!keepFrom || !pt(state.fromId)) state.fromId = defaultFrom(map);
  if (!resolve(state.toKey)) state.toKey = null;
  state.chip = null;
  store.set('dalil.last', { b: map.building.id, f: map.floor.id });
  $('#ghSub').textContent = t('gettingHereSub'); proximityHint();
  renderAll();
  const f = locator.fresh(120000); if (f && !nav.active) { if (map.geo) homeFix(f); else nearCheck(); }   // GPS already known: inside or outside this building? any DALIL building near?
}
function setFrom(id, { say = true, confirm = false } = {}) {
  const p = pt(id); if (!p) return false;
  state.fromId = id; state.viewMap = state.map; state.fromManual = true; state.outside = null;
  if (state.toKey === keyOf(state.map, p)) state.toKey = null;
  renderAll();
  if (say) { const msg = confirm ? t('confirmed', pname(p)) : t('locSet', pname(p)); announce(msg); toast(msg); }
  if (confirm) analytics.add('tag', { at: id });
  return true;
}
function setDest(key, { chip = null, say = true } = {}) {
  const d = resolve(key); if (!d) return;
  state.toKey = key; state.chip = chip; state.viewMap = state.map;
  go('route');
  const r = planTo(key);
  if (say) announce(r ? t('routeTo', pname(d.p), fmtM(r.distance_m), fmtMin(secsFor(r))) : pname(d.p));
  analytics.add('route', { to: d.p.virtual ? 'pin' : d.p.id, cat: d.p.category, ok: !!r });
}
function renderAll() {
  if (!state.map) return;
  renderHome();
  if (pageNow === 'search') renderSearch();
  if (pageNow === 'route') renderRoute();
  if (pageNow === 'map') renderFloorMap();
  if (pageNow === 'where') renderWhere();
  renderSettings();
}

/* ---------- Rows ---------- */
function rowHTML(m, p, { dist = null, floor = false, q = '' } = {}) {
  return `<li><button class="row-btn" type="button" data-pick="${esc(keyOf(m, p))}"${q ? ` data-q="${esc(q)}"` : ''}>
    <span class="r-ico${isService(p.category) ? ' svc' : ''}">${catIco(p.category)}</span>
    <span class="r-main"><span class="r-name">${esc(pname(p))}</span><span class="r-sub">${esc(catName(p.category))}${p.doors ? ` · ${esc(t('doorN', p.doors.split(' ')[0]))}` : ''}${floor ? ` · ${esc(floorName(m.floor))}` : ''}</span></span>
    <span class="r-end">${dist != null ? `<span>${esc(fmtM(dist))}</span>` : ''}</span></button></li>`;
}
const presentCats = () => { const s = new Set(); for (const m of bFloors()) for (const p of m.points) s.add(p.category); return s; };

/* ---------- Home ---------- */
function renderHome() {
  if (!state.map) return;
  const from = pt(state.fromId), multi = bFloors().length > 1, here = presentCats(), bid = state.map.building.id;
  const inst = settings.lang === 'ar' ? (cfg.institution?.nameAr || cfg.institution?.name) : cfg.institution?.name;
  $('#bldName').innerHTML = `<bdi>${esc([inst, bname(state.map.building)].filter(Boolean).join(' · '))}</bdi>`;
  $('#fromName').textContent = from ? `${pname(from)}${multi ? ` · ${floorName(state.map.floor)}` : ''}` : t('fromUnknown');
  $('#liGettingHere').hidden = !state.map.geo;
  renderHolo(from); renderGpsBits();
  if (!$('#homeSheet').classList.contains('open')) $('#homeSheetBody').scrollTop = 0;   // the sheet always peeks at its top
  // Tiles: the essentials this building has, with the walk to the nearest one
  const cats = Object.keys(TILE_CATS).filter(c => TILE_CATS[c].some(k => here.has(k))).slice(0, 6);
  renderBuildings();
  $('#homeChips').innerHTML = (buildingsList().length > 1 ? `<button class="hm-chip hm-chip-bld" type="button" id="chipBuildings"><span class="ico">${svgIco(UI.building)}</span><span>${esc(t('indoorMaps'))}</span></button>` : '') + cats.map(c => `<button class="hm-chip" type="button" data-cat="${c}"><span class="ico">${catIco(c === 'help' ? 'help' : TILE_CATS[c][0])}</span><span>${esc(t('cat_' + c))}</span></button>`).join('');
  $('#tiles').innerHTML = cats.map(c => {
    let best = null;
    for (const p of state.map.points) if (TILE_CATS[c].includes(p.category) && p.id !== state.fromId) { const d = distFor(state.map, from, p); if (d != null && (best == null || d < best)) best = d; }
    return `<li><button class="tile" type="button" data-cat="${c}" aria-label="${esc(t('nearestOf', t('cat_' + c)))}${best != null ? ', ' + esc(fmtM(best)) : ''}"><span class="tile-ico">${catIco(c === 'help' ? 'help' : TILE_CATS[c][0])}</span><span><span class="tile-name">${esc(t('cat_' + c))}</span>${best != null ? `<span class="tile-sub">${esc(fmtM(best))}</span>` : ''}</span></button></li>`;
  }).join('');
  // Saved places (this building) and My spot
  const saved = state.saved.map(k => { const [b, f, id] = k.split('/'); if (b !== bid) return null; const m = mapByFloor(f), p = m && pointOf(m, id); return p ? { m, p } : null; }).filter(Boolean);
  const sp = store.get('dalil.spot', null); if (sp && sp.b === bid) { const m = mapByFloor(sp.f), p = m && pointOf(m, '@spot'); if (p) saved.unshift({ m, p }); }
  $('#secSaved').hidden = !saved.length;
  $('#savedList').innerHTML = saved.map(s => rowHTML(s.m, s.p, { dist: s.m === state.map ? distFor(s.m, from, s.p) : null, floor: multi })).join('');
  const recent = store.get('dalil.recent', []).filter(r => r.b === bid).map(r => resolve(r.k)).filter(Boolean).filter(r => !saved.some(s => s.m === r.m && s.p.id === r.p.id)).slice(0, 4);
  $('#secRecent').hidden = !recent.length;
  $('#recentList').innerHTML = recent.map(r => rowHTML(r.m, r.p, { dist: r.m === state.map ? distFor(r.m, from, r.p) : null, floor: multi })).join('');
}

// The hologram on Home: the floor you are on, tilted in 3D, with your beacon.
// Home is a map, like a phone's maps app: the real map with the floor plan on top when the building is placed on
// Earth (geo), otherwise the floor plan itself. Floors switch on the right; "you" is the blue dot.
let homeCtl = null, homeCtlFor = null, homeFloor = null, homeLoading = null;
const SHEET_PAD = { top: 150, bottom: 230, left: 24, right: 64 };
function renderHolo(from) { renderHomeMap(from); }
function homeFloors() { return bFloors(); }
async function renderHomeMap(from = pt(state.fromId)) {
  if (pageNow !== 'home' || !state.map) return;
  const floors = homeFloors();
  if (!homeFloor || !floors.includes(homeFloor)) homeFloor = state.map;
  $('#homeFloors').hidden = floors.length < 2;
  $('#homeFloors').innerHTML = floors.slice().reverse().map(m => `<button type="button" class="hm-floor${m === homeFloor ? ' is-on' : ''}" data-hfloor="${esc(m.floor.id)}" aria-pressed="${m === homeFloor}" aria-label="${esc(floorName(m.floor))}">${esc(floorShort(m.floor))}</button>`).join('');
  const geo = !!state.map.geo;
  $('#homeGL').hidden = !geo; $('#homeMap').hidden = geo; $('#btnLayers').hidden = !geo;
  if (!geo) {
    if (homeCtl) { try { homeCtl.destroy(); } catch { } homeCtl = null; homeCtlFor = null; }   // a building not placed on Earth: its plan
    homeMap.setMap(homeFloor);
    homeMap.setYou(homeFloor === state.map ? from : null, from?.facingDeg ?? 90);
    homeMap.setRoute(null); homeMap.setDest(null);
    requestAnimationFrame(() => homeMap.fit({ pts: planPts(homeFloor), padTop: 170, padBot: 250, padL: 20, padR: 70, maxK: 3, tilt: 30 }, false));
    return;
  }
  const bid = state.map.building.id;
  if (homeCtl && homeCtlFor !== bid) {                    // another DALIL building on the same map: move there
    homeCtlFor = bid; homeCtl.setFloor(homeFloor); homeFrame(); renderBuildings();
  }
  if (!homeCtl || homeCtlFor !== bid) {
    if (homeLoading === bid) return;                      // one map at a time per building (a second call waits for it)
    homeLoading = bid;
    try { homeCtl?.destroy(); } catch { } homeCtl = null; homeCtlFor = null;
    try {
      const floor = homeFloor;                            // read before waiting: the floor can change meanwhile
      const { createOutdoorMap } = await import('./outdoor.js');
      const choice = settings.mapProvider === 'auto' ? (cfg.maps?.homeBase || 'esri-imagery-labels') : settings.mapProvider;
      const ctl = await createOutdoorMap($('#homeGL'), { map: floor, dark: document.documentElement.dataset.theme === 'dark' || settings.contrast, lang: settings.lang,
        attribution: t('attrPlan'), providers: { choice, cfg: cfg.maps }, layers: settings.mapLayers, opacity: settings.mapOpacity / 100,
        pins: true, onPick: id => { const m = homeFloor; setDest(keyOf(m, pointOf(m, id))); }, iconFor: c => svgIco(c === 'building' ? UI.building : CAT_ICONS[c] || CAT_ICONS.room), padding: SHEET_PAD,
        onProvider: () => renderLayerControls('home') });
      homeCtl = ctl; homeCtlFor = bid;                   // kept even if you left Home meanwhile: it shows again on return
      renderBuildings(); homeFrame();
    } catch { return; } finally { homeLoading = null; }
    if (pageNow !== 'home' || state.map?.building.id !== bid) return;
  } else homeCtl.setFloor(homeFloor);
  homeCtl.resize();
  homeYou(from);
}
// The blue dot: GPS when it is live, otherwise the place you said you are at (on the floor shown).
function homeYou(from = pt(state.fromId)) {
  if (!homeCtl || !state.map?.geo) return;
  const f = locator.fresh(60000);
  if (f) { homeCtl.setYou([f.lng, f.lat], tracker.heading ?? null); homeCtl.setMe(f.lng, f.lat, f.acc); return; }
  if (from && homeFloor === state.map) homeCtl.setYou(geoTransform(state.map.geo)(from.x, from.y), null); else homeCtl.setYou(null);
}
function setHomeFloor(m) { if (!m || m === homeFloor) return; homeFloor = m; announce(t('viewFloor', floorName(m.floor))); renderHomeMap(); }
// The Home sheet follows your finger like a phone maps app: drag the handle or the building name up to open it,
// down to close it; a quick flick is enough. When closed, a tap anywhere on it (not on a button) opens it.
// The handle stays a button (tap, or a screen reader's double tap), so dragging is never the only way.
function bindSheetDrag() {
  const sh = $('#homeSheet'), body = $('#homeSheetBody'); let d = null;
  sh.addEventListener('pointerdown', e => {
    const open = sh.classList.contains('open'), onHandle = !!e.target.closest('#btnSheet'), ctl = e.target.closest('button, a, input, select, label');
    const inHead = !!e.target.closest('.hm-head') && !ctl;
    if (!onHandle && !inHead && (open || ctl)) return;          // open sheet: its body scrolls; buttons stay buttons
    if (open && !onHandle && body.scrollTop > 0) return;
    d = { y: e.clientY, t: performance.now(), h: sh.getBoundingClientRect().height, open, id: e.pointerId, moved: false, onHandle };
  });
  addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y; if (!d.moved && Math.abs(dy) < 8) return;
    if (!d.moved) { d.moved = true; sh.classList.add('dragging'); }
    sh.style.maxHeight = Math.max(90, d.h - dy) + 'px';
  });
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    const g = d; d = null; sh.classList.remove('dragging'); sh.style.maxHeight = '';
    if (!g.moved) { if (!g.onHandle && !g.open && e.type === 'pointerup') setSheet(true); return; }   // a tap on the handle is its click
    const dy = e.clientY - g.y, v = dy / Math.max(1, performance.now() - g.t);
    setSheet(v < -0.35 ? true : v > 0.35 ? false : g.open ? dy < 80 : dy < -60);
    sh.dataset.dragged = '1'; setTimeout(() => { delete sh.dataset.dragged; }, 80);
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
}
function setSheet(open) {
  $('#homeSheet').classList.toggle('open', open); $('#btnSheet').setAttribute('aria-expanded', String(open));
  if (!open) $('#homeSheetBody').scrollTop = 0;
}
// Buildings with a DALIL indoor map (every building in maps.json). Those placed on Earth show on the home map,
// and when your location is near one the app offers it (or opens it when you are clearly inside it).
function buildingsList() {
  const by = new Map();
  for (const m of state.maps) { const b = by.get(m.building.id) || { id: m.building.id, name: bname(m.building), maps: [] }; b.maps.push(m); by.set(b.id, b); }
  for (const b of by.values()) {
    const g = b.maps.find(m => m.geo);
    if (g) { const xs = planPts(g), T = geoTransform(g.geo); let a = Infinity, c = -Infinity, d = Infinity, e = -Infinity;
      for (const [x, y] of xs) { a = Math.min(a, x); c = Math.max(c, x); d = Math.min(d, y); e = Math.max(e, y); }
      b.at = T((a + c) / 2, (d + e) / 2); b.radius = Math.hypot(c - a, e - d) / 2; }
  }
  return [...by.values()];
}
let nearDismissed = null;
function openBuilding(id, { say = true } = {}) {
  const b = buildingsList().find(x => x.id === id); if (!b) return;
  setSheet(false); $('#nearCard').hidden = true;
  if (state.map.building.id !== id) { homeFloor = null; selectFloor(b.maps[0]); state.fromManual = false; if (say) { const msg = t('openedBuilding', b.name); toast(msg); announce(msg); } }
  else renderHome();
  if (homeCtl) homeFrame();
}
// Show the building, and you too when GPS puts you within 1.5 km of it (so you see where it is from where you stand).
function homeFrame() {
  if (!homeCtl) return;
  const f = locator.fresh(120000), b = buildingsList().find(x => x.id === state.map.building.id);
  homeCtl.frame(undefined, f && b?.at && haversine([f.lng, f.lat], b.at) < 1500 ? [f.lng, f.lat] : null);
}
// Which building is near you (GPS), and what to offer: open it, or nothing.
function nearCheck() {
  const f = locator.fresh(60000); const card = $('#nearCard');
  if (!f || pageNow !== 'home') { card.hidden = true; return; }
  let best = null;
  for (const b of buildingsList()) if (b.at) { const d = haversine([f.lng, f.lat], b.at); if (!best || d < best.d) best = { b, d }; }
  if (!best || best.d > 400 + best.b.radius) { card.hidden = true; return; }
  const cur = best.b.id === state.map.building.id, inside = best.d <= best.b.radius + Math.min(25, f.acc);
  if (!cur && inside && !state.fromManualBuilding) { openBuilding(best.b.id); return; }   // clearly inside another DALIL building
  if (!cur && !state.fromManualBuilding && !state.autoNear) {     // near a DALIL building but showing one that is not placed here
    const curB = buildingsList().find(b => b.id === state.map.building.id), far = !curB?.at || haversine([f.lng, f.lat], curB.at) > 2000;
    if (far) { state.autoNear = true; openBuilding(best.b.id); return; }
  }
  if (cur || nearDismissed === best.b.id) { card.hidden = true; return; }
  $('#nearTitle').textContent = t('nearTitle', best.b.name); $('#nearSub').textContent = t('nearSub', fmtDist(edgeDist(best.b, f)));
  card.hidden = false; card.dataset.bld = best.b.id;
}
let rbT = 0; function renderBuildingsThrottled() { const n = Date.now(); if (n - rbT > 15000) { rbT = n; renderBuildings(); } }
const edgeDist = (b, f) => f && b.at ? Math.max(0, haversine([f.lng, f.lat], b.at) - b.radius) : null;   // what the near card says too
function renderBuildings() {
  const list = buildingsList(), f = locator.fresh(600000);
  $('#secBuildings').hidden = list.length < 2;
  const rows = list.map(b => ({ b, d: edgeDist(b, f) })).sort((x, y) => (x.d ?? 1e12) - (y.d ?? 1e12));
  const near = rows.filter(r => !f || r.d == null || r.d <= 50000 || r.b.id === state.map.building.id), far = rows.filter(r => !near.includes(r));
  const row = ({ b, d }) => {
    const cur = b.id === state.map.building.id;
    const sub = [cur ? t('openNow') : d != null ? (d < 1 ? t('youAreInside') : t('bldAway', fmtDist(d))) : '', t('floorsCount', b.maps.length), b.at ? '' : t('noGeoYet')].filter(Boolean).join(' · ');
    return `<li><button class="row-btn${cur ? ' is-current' : ''}" type="button" data-building="${esc(b.id)}"${cur ? ' aria-current="true"' : ''}><span class="r-ico"><span class="ico">${svgIco(UI.building)}</span></span><span class="r-main"><span class="r-name">${esc(b.name)}</span><span class="r-sub">${esc(sub)}</span></span><span class="ico r-chev flip-rtl">${svgIco(UI.fwd)}</span></button></li>`;
  };
  $('#buildingList').innerHTML = near.map(row).join('') + (far.length ? (state.showFarBld ? far.map(row).join('') : `<li><button class="row-btn more-bld" type="button" id="btnMoreBld"><span class="r-main"><span class="r-name">${esc(t('moreBuildings', far.length))}</span></span></button></li>`) : '');
  homeCtl?.setBuildings(list.filter(b => b.at).map(b => ({ id: b.id, name: b.name, lngLat: b.at, current: b.id === state.map.building.id })), id => { state.fromManualBuilding = true; openBuilding(id); });
}
// Base map and layer controls, shared by Home (the Layers button) and the real-map page.
function renderLayerControls(where) {
  if (where !== 'home') return;
  const all = allProviders(cfg.maps).filter(p => p.available), cur = settings.mapProvider === 'auto' ? (cfg.maps?.homeBase || 'esri-imagery-labels') : settings.mapProvider;
  const row = (type, name, val, label, on, sub = '') => `<label class="opt"><input type="${type}" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''}><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
  $('#homeBases').innerHTML = all.map(p => row('radio', 'homeBase', p.id, `${t(p.kind === 'satellite' ? 'kindSatellite' : 'kindStreets')} · ${p.name}`, p.id === (homeCtl?.provider?.id || cur), p.key ? t('provKey') : p.test ? t('provTest') : t('provFree'))).join('')
    + row('radio', 'homeBase', 'plain', t('provider_plain'), (homeCtl?.provider?.id || cur) === 'plain');
  $('#homeKeyNote').hidden = allProviders(cfg.maps).every(p => p.available); $('#homeKeyNote').textContent = t('keyNote');
  $('#homeChecks').innerHTML = ['plan', 'places', 'outline', 'entrances', 'me'].map(k => row('checkbox', 'homeLayer', k, t('lyr_' + k), settings.mapLayers[k] ?? true)).join('');
}

/* ---------- Search ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
const FILTERS = { rooms: ['room', 'lab'], toilets: ['toilet', 'toilet_acc', 'baby'], lifts: ['lift', 'stairs', 'ramp'], food: ['cafe'], prayer: ['prayer', 'wudu'], services: ['reception', 'entrance', 'exit'] };
const FILTER_LABEL = { rooms: 'filterRooms', toilets: 'filterToilets', lifts: 'filterLifts', food: 'filterFood', prayer: 'filterPrayer', services: 'filterServices' };
function searchPoints(q) {
  const nq = norm(q), words = nq ? nq.split(/\s+/) : [], from = pt(state.fromId), scored = [];
  const f = state.filter, cats = FILTERS[f];
  for (const m of bFloors()) {
    if (f === 'floor' && m !== state.map) continue;
    for (const p of m.points) {
      if (cats && !cats.includes(p.category)) continue;
      if (m === state.map && p.id === state.fromId) continue;
      const names = norm(`${p.nameEn} ${p.nameAr} ${p.doors || ''}`), catText = norm(`${catName(p.category)} ${STR.en.cats[p.category] || ''} ${STR.ar.cats[p.category] || ''} ${CAT_WORDS[p.category] || ''}`);
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
  $('#searchFilters').innerHTML = list.map(k => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${state.filter === k}">${esc(t(k === 'all' ? 'filterAll' : k === 'floor' ? 'filterFloor' : FILTER_LABEL[k]))}</button>`).join('');
}
let searchTimer = 0;
function renderSearch() {
  if (!state.map) return;
  renderFilters();
  const q = $('#search').value.trim(), browsing = !q && state.filter !== 'all';
  $('#btnSearchClear').hidden = !q;
  const searches = store.get('dalil.searches', []);
  $('#secSearches').hidden = !!q || browsing || !searches.length;
  $('#recentSearches').innerHTML = searches.map(s => `<li><button class="row-btn" type="button" data-search="${esc(s)}"><span class="r-ico">${ico('history')}</span><span class="r-main"><span class="r-name">${esc(s)}</span></span></button></li>`).join('');
  $('#searchHint').hidden = !!q || browsing;
  if (!q && !browsing) { $('#results').innerHTML = ''; $('#noResults').hidden = true; $('#resultsStatus').textContent = ''; return; }
  const res = searchPoints(q), multi = bFloors().length > 1;
  $('#noResults').hidden = res.length > 0;
  $('#noResultsTitle').textContent = q ? t('noResultsFor', q) : t('noResults');
  $('#btnNoResHelpDesk').hidden = !bFloors().some(m => m.points.some(p => p.category === 'reception'));
  let html = '', group = null;
  const out = outsideNow(); if (out && res.length) html += `<li class="group-title res-note" role="presentation">${esc(t('distFromStart', pname(pt(out.id))))}</li>`;
  for (const r of res.slice(0, 80)) {
    const g = r.m === state.map ? 'here' : r.m.floor.id;
    if (multi && g !== group) { group = g; html += `<li class="group-title" role="presentation">${esc(g === 'here' ? t('groupHere') : floorName(r.m.floor))}</li>`; }
    html += rowHTML(r.m, r.p, { dist: r.d, q });
  }
  $('#results').innerHTML = html;
  $('#resultsStatus').textContent = res.length ? t('results', res.length) : t('noResults');
  clearTimeout(searchTimer);
  if (q && !res.length) searchTimer = setTimeout(() => analytics.add('search_none', { q: q.slice(0, 40) }), 1500);
}
function rememberSearch(q) { q = (q || '').trim(); if (!q) return; const s = store.get('dalil.searches', []).filter(x => x.toLowerCase() !== q.toLowerCase()); s.unshift(q); store.set('dalil.searches', s.slice(0, 6)); }

/* ---------- Nearest of a category ---------- */
function pickNearest(cat) {
  const label = t('cat_' + cat), cands = [];
  for (const m of bFloors()) for (const p of m.points) if (TILE_CATS[cat].includes(p.category) && !(m === state.map && p.id === state.fromId)) cands.push({ m, p });
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

/* ---------- Route ready ---------- */
const roomNo = p => { if (['lift', 'stairs', 'pin', 'corridor'].includes(p.category)) return null; const m = (p.nameEn || '').match(/\(?\b([A-Z]?\d{2,4}[A-Z]?)\b\)?\s*$/); return m ? m[1] : null; };
function openOutsideStart() {
  const out = outsideNow(), e = pt(out.id), ll = state.map.geo ? geoTransform(state.map.geo)(e.x, e.y) : null;
  $('#outDlgTitle').textContent = t('outTitle', fmtDist(out.d));
  $('#outDlgBody').textContent = t('outStartBody', pname(e));
  const a = $('#btnOutWalk'); a.hidden = !ll; if (ll) a.href = `https://www.google.com/maps/dir/?api=1&destination=${ll[1].toFixed(6)},${ll[0].toFixed(6)}&travelmode=walking`;
  $('#btnOutMap').hidden = !state.map.geo;
  openDlg($('#dlgOutside'));
}
function renderRoute() {
  const dest = destRef(); if (!dest) return;
  const to = dest.p, here = dest.m === state.map && state.fromId === to.id;
  const route = here ? null : planTo(state.toKey), multi = bFloors().length > 1;
  $('#placeIco').innerHTML = catIco(to.category);
  $('#destName').textContent = pname(to);
  $('#destMeta').innerHTML = [`<span>${esc(catName(to.category))}</span>`, multi || dest.m !== state.map ? `<span class="badge">${esc(floorName(dest.m.floor))}</span>` : '', `<bdi>${esc(bname(dest.m.building))}</bdi>`].join('');
  const isSaved = isFav(state.toKey);
  $('#btnFav').setAttribute('aria-pressed', String(isSaved)); $('#favText').textContent = t(isSaved ? 'saved' : 'save');
  const msg = $('#routeMsg'); msg.className = 'route-msg'; msg.innerHTML = '';
  const out = outsideNow(), outMsg = () => {
    const e = pt(out.id), ll = state.map.geo ? geoTransform(state.map.geo)(e.x, e.y) : null, dest = ll ? `${ll[1].toFixed(6)},${ll[0].toFixed(6)}` : '';
    msg.className = 'route-msg out';
    msg.innerHTML = `<strong>${esc(t('outTitle', fmtDist(out.d)))}</strong>${esc(t(here ? 'outBodyHere' : 'outBody', pname(e)))}`
      + (ll ? `<a class="btn secondary out-dir" href="https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking" target="_blank" rel="noopener"><span class="ico">${ico('walk')}</span><span>${esc(t('outDirections'))}</span></a>` : '');
  };
  if (here) { if (out) outMsg(); else msg.textContent = t('alreadyHere'); }
  else if (!route && settings.stepFree) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noStepFreeTitle'))}</strong>${esc(t('noStepFreeBody'))}`; }
  else if (!route) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noRoute'))}</strong>`; }
  else if (out) outMsg();
  else if (route.closures) msg.textContent = t('closureNote');
  $('#routeStats').hidden = !route;
  if (route) {
    $('#statEta').textContent = String(Math.max(1, Math.round(secsFor(route) / 60)));
    $('#statDist').textContent = String(Math.max(1, Math.round(route.distance_m)));
    $('#routeVia').hidden = !route.via;
    if (route.via) $('#routeVia').innerHTML = `${svgIco(TURN_ICONS[route.via.lift ? 'lift' : 'stairs'])}<span>${esc(t(route.via.lift ? 'viaLift' : 'viaStairs', floorName(route.via.toMap.floor)))}</span>`;
  }
  $('#btnStart').disabled = !route; $('#btnStartCam').disabled = !route;
  $('#startText').textContent = t(state.kiosk ? 'watchRoute' : 'start');
  $('#btnStartCam').hidden = !!state.kiosk || cfg.features.camera === false || !navigator.mediaDevices?.getUserMedia;
  $('#btnShare').hidden = !route;
  $('#optStepFree').checked = settings.stepFree;
  const facts = [], rn = roomNo(to);
  const fi = n => `<span class="ico">${ico(n)}</span>`;
  if (rn) facts.push(`<li>${fi('pin')}${esc(t('factRoom', rn))}</li>`);
  if (to.doors) facts.push(`<li>${fi('pin')}${esc(t('factDoors', to.doors.split(' ').join(', ')))}</li>`);
  if (to.category === 'toilet_acc') facts.push(`<li class="ok">${fi('wheel')}${esc(t('accToilet'))}</li>`);
  if (!here) { const chair = settings.stepFree ? route : planTo(state.toKey, 'chair'); facts.push(chair ? `<li class="ok">${fi('check')}${esc(t('accYes'))}</li>` : `<li class="no">${fi('alert')}${esc(t('accNo'))}</li>`); }
  $('#placeFacts').innerHTML = facts.join('');
  const prev = route ? planSteps(route).steps.filter(s => s.kind === 'move' || s.kind === 'node' || s.kind === 'floor' || s.kind === 'arrive') : [];
  $('#secPreview').hidden = !prev.length;
  $('#stepsSummary').textContent = t('allSteps', prev.length);
  $('#previewSteps').innerHTML = prev.map(s => `<li><span class="p-ico">${svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight)}</span><span>${esc(stepText(s))}</span></li>`).join('');
  const kq = $('#kioskQR'); kq.hidden = !(state.kiosk && route); if (state.kiosk && route) kq.querySelector('.qr').innerHTML = qrSvg(shareLink());
  renderRouteMap(route, dest);
}
function renderRouteMap(route, dest) {
  const leg = route?.legs[Math.min(state.routeLeg, (route?.legs.length || 1) - 1)], m = leg?.map || dest.m;
  routeMap.setMap(m);
  routeMap.setRoute(leg && leg.route.distance_m > 0 ? leg.route.path : null);
  const from = pt(state.fromId);
  routeMap.setYou(null);
  const confirmed = !outsideNow() && (state.fromManual || (gps.fromId === state.fromId && Date.now() - gps.at < 60000));
  routeMap.setStart(m === state.map ? from : null, { icon: svgIco(confirmed ? UI.locate : CAT_ICONS[from?.category] || UI.walk), label: confirmed ? t('youStartHere') : t('routeStart', pname(from)) });
  const pinOpts = p => ({ icon: catIco(p.category), name: pname(p) });
  if (dest.m === m) routeMap.setDest(dest.p, '', pinOpts(dest.p));
  else if (route?.via && route.legs[0].map === m) routeMap.setDest(route.via.pa, t('toFloor', floorName(dest.m.floor)), pinOpts(route.via.pa));
  else routeMap.setDest(null);
  routeMap.hidePoints([m === state.map ? state.fromId : null, dest.m === m ? dest.p.id : null, route?.via?.pa?.id]);
  $('#routeMap').setAttribute('aria-label', t('routeMap', pname(dest.p)));
  const pts = leg && leg.route.distance_m > 0 ? leg.route.path : [[dest.p.x - 15, dest.p.y - 15], [dest.p.x + 15, dest.p.y + 15]];
  requestAnimationFrame(() => routeMap.fit({ pts, padTop: 70, padBot: 60, padL: 50, padR: 50, maxK: 3, tilt: 36 }, false));
}

/* ---------- Saved ---------- */
const favKey = key => `${state.map.building.id}/${key.replace('|', '/')}`;
const isFav = key => !!key && state.saved.includes(favKey(key));
function toggleFav(key, force) {
  const k = favKey(key), has = state.saved.includes(k), want = force ?? !has;
  if (want && !has) state.saved.push(k); if (!want && has) state.saved = state.saved.filter(x => x !== k);
  store.set('dalil.saved', state.saved);
  renderHome(); if (pageNow === 'route') renderRoute();
  return want;
}
function rememberTrip(key) {
  const bid = state.map.building.id;
  const r = store.get('dalil.recent', []).filter(x => !(x.b === bid && x.k === key)); r.unshift({ b: bid, k: key }); store.set('dalil.recent', r.slice(0, 12));
  const f = store.get('dalil.freq', {}); f[`${bid}/${key}`] = (f[`${bid}/${key}`] || 0) + 1; store.set('dalil.freq', f);
}

/* ---------- Floor map (browse every floor, drop a pin) ---------- */
let pinPoint = null;
function renderFloorMap() {
  const vm = state.viewMap || state.map; if (!vm || pageNow !== 'map') return;
  mainMap.setMap(vm); $('#btnRealMap').hidden = !vm.geo;
  const from = pt(state.fromId);
  mainMap.setYou(vm === state.map ? from : null, from?.facingDeg ?? 90);
  mainMap.setRoute(null);
  mainMap.setDest(pinPoint && pinPoint.f === vm.floor.id ? pinPoint : null);
  mainMap.hidePoints([vm === state.map ? state.fromId : null]);
  $('#mapTitle').innerHTML = `<bdi>${esc(bname(vm.building))}</bdi> · <bdi>${esc(floorName(vm.floor))}</bdi>`;
  $('#mainMap').setAttribute('aria-label', t('mapOf', bname(vm.building), floorName(vm.floor)) + ' ' + t('mapTip'));
  const floors = [...bFloors()].reverse(), rail = $('#floorRail');
  rail.setAttribute('aria-label', t('floorsLabel'));
  rail.innerHTML = floors.length < 2 ? '' : floors.map(f => `<button class="floor-btn${f === state.map ? ' here' : ''}" type="button" data-floor="${esc(f.floor.id)}" aria-pressed="${f === vm}" aria-label="${esc(t('viewFloor', floorName(f.floor)))}${f === state.map ? '. ' + esc(t('yourFloor')) : ''}">${esc(floorShort(f.floor))}</button>`).join('');
  $('#mapTip').hidden = !!pinPoint;
  requestAnimationFrame(() => mainMap.fit({ pts: planPts(vm), padTop: 110, padBot: pinPoint ? 200 : 90, padL: 12, padR: 12, maxK: 2.6 }, false));
}
function onMapTap({ x, y }) {
  const vm = state.viewMap, R = routerOf(vm);
  if (!R) return;
  if (!R.walkable(x, y)) { toast(t('pinOutside')); return; }
  pinPoint = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, f: vm.floor.id };
  $('#pinText').textContent = t('pinAt', floorName(vm.floor));
  $('#pinCard').hidden = false; $('#mapTip').hidden = true;
  mainMap.setDest(pinPoint);
  announce(t('pinAt', floorName(vm.floor)));
}
const pinKey = () => pinPoint ? `${pinPoint.f}|@${pinPoint.x},${pinPoint.y}` : null;

/* ---------- Where am I (QR sign, NFC tag, or a list) ---------- */
let whereScan = null, whereStream = null, nfcCtl = null;
function renderWhere() {
  if (!state.map) return;
  const q = norm($('#whereFilter').value), floors = [state.map, ...bFloors().filter(m => m !== state.map)], multi = floors.length > 1;
  let html = '';
  for (const m of floors) {
    const pts = m.points.filter(p => !q || norm(`${p.nameEn} ${p.nameAr} ${catName(p.category)}`).includes(q))
      .sort((a, b) => (b.dalilNode - a.dalilNode) || pname(a).localeCompare(pname(b)));
    if (!pts.length) continue;
    if (multi) html += `<li class="group-title" role="presentation">${esc(floorName(m.floor))}</li>`;
    html += pts.map(p => `<li><button class="row-btn" type="button" data-where="${esc(keyOf(m, p))}"><span class="r-ico${p.dalilNode ? ' svc' : ''}">${p.dalilNode ? ico('qr') : catIco(p.category)}</span><span class="r-main"><span class="r-name">${esc(pname(p))}</span><span class="r-sub">${esc(p.dalilNode ? t('dalilTag') : catName(p.category))}</span></span>${m === state.map && p.id === state.fromId ? `<span class="r-end"><span class="ico">${ico('check')}</span></span>` : ''}</button></li>`).join('');
  }
  $('#tagList').innerHTML = html;
  if ('NDEFReader' in window && !nfcCtl) startNfc();
}
function startNfc() {
  $('#nfcLine').hidden = false;
  nfcCtl = new AbortController();
  try {
    const reader = new window.NDEFReader();
    reader.scan({ signal: nfcCtl.signal }).then(() => { $('#nfcStatus').textContent = t('nfcReady'); }).catch(() => { $('#nfcStatus').textContent = t('nfcFail'); });
    reader.onreading = ev => {
      const dec = new TextDecoder();
      for (const rec of ev.message.records) if (['url', 'absolute-url', 'text'].includes(rec.recordType)) { if (useTagText(dec.decode(rec.data))) return; }
      $('#nfcStatus').textContent = t('nfcUnknown');
    };
  } catch { $('#nfcStatus').textContent = t('nfcFail'); }
}
/** A tag or sign was read (NFC or QR). Returns true when it was a DALIL point we know. */
function useTagText(text) {
  const link = parseLink(text);
  if (!link.at) return false;
  if (nav.active) return navTag(link);
  if (!applyLink(link, { fromTag: true })) return false;
  buzz([40]);
  if (pageNow === 'where') back();
  return true;
}
async function startWhereScan() {
  const status = $('#scanStatus');
  $('#scanView').hidden = false; $('#btnScanStart').hidden = true; status.textContent = t('whereScanning');
  try {
    whereStream = await openCamera($('#scanVideo'));
    if (pageNow !== 'where') { stopWhere(); return; }
    whereScan = new QRScanner($('#scanVideo'), text => { if (!useTagText(text)) status.textContent = t('scanUnknown'); }).start();
  } catch (e) { $('#scanView').hidden = true; $('#btnScanStart').hidden = false; status.textContent = t('scan' + cap(cameraError(e))); }
}
function stopWhere() {
  whereScan?.stop(); whereScan = null; closeCamera($('#scanVideo'), whereStream); whereStream = null;
  nfcCtl?.abort(); nfcCtl = null;
  $('#scanView').hidden = true; $('#btnScanStart').hidden = false; $('#scanStatus').textContent = ''; $('#whereFilter').value = '';
}

/* ---------- Settings page ---------- */
function providerOptions() {
  const opts = [['auto', t('provider_auto')], ...availableProviders(cfg.maps).map(p => [p.id, `${t(p.kind === 'satellite' ? 'kindSatellite' : 'kindStreets')} · ${p.name} (${p.key ? t('provKey') : t('provFree')})`]), ['plain', t('provider_plain')]];
  return opts.map(([v, l]) => `<option value="${esc(v)}" ${settings.mapProvider === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
}
function renderSettings() {
  for (const [name, val] of [['lang', settings.lang], ['theme', settings.theme], ['textSize', settings.textSize], ['pace', settings.pace]]) $$(`input[name="${name}"]`).forEach(r => { r.checked = r.value === val; });
  $('#setGps').checked = settings.gps; $('#setVoice').checked = settings.voice; $('#setVibrate').checked = settings.vibrate; $('#setStepFree').checked = settings.stepFree;
  $('#setContrast').checked = settings.contrast; $('#setMotion').checked = settings.motion;
  $('#setBuilding').innerHTML = state.maps.map((m, i) => `<option value="${i}" ${m === state.map ? 'selected' : ''}>${esc(`${bname(m.building)} · ${floorName(m.floor)}`)}</option>`).join('');
  $('#setProvider').innerHTML = providerOptions();
  $('#privacyStats').hidden = !cfg.analytics?.endpoint;
}
function resolvedTheme() { return settings.theme === 'system' ? (mq('(prefers-color-scheme: dark)') ? 'dark' : 'light') : settings.theme; }
function applyDisplay() {
  const h = document.documentElement;
  h.lang = settings.lang; h.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  h.dataset.theme = resolvedTheme();
  h.classList.toggle('ts-large', settings.textSize === 'large'); h.classList.toggle('ts-xl', settings.textSize === 'xl');
  h.classList.toggle('contrast', settings.contrast); h.classList.toggle('reduce-motion', settings.motion);
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('meta[name="theme-color"]').content = settings.contrast ? '#000000' : resolvedTheme() === 'dark' ? '#07090D' : '#FFFFFF';
}
function rerenderAll() {
  applyDisplay();
  if (!state.map) return;
  for (const v of [homeMap, routeMap, mainMap, navMap]) v.renderPoints();
  renderAll();
  if (nav.active) { renderNavStep(); renderMode(); }
}
function setLang(l) { settings.lang = l; saveSettings(); try { homeCtl?.destroy(); } catch { } homeCtl = null; homeCtlFor = null; rerenderAll(); }

/* =========================================================================
   Navigation: a heads-up display that moves with you. There is no "Next": the compass and the step counter
   move you along the route (tracker.js), floor changes go on by themselves (a lift ride, or the steps of a
   staircase) and DALIL signs re-anchor you. With motion off the app says so and offers to switch it on,
   continue with signs only, or watch a clearly labelled preview. It never pretends to know where you are.
   ========================================================================= */
const tracker = new Tracker();
const nav = { active: false, plan: null, legs: [], steps: [], leg: -1, i: 0, pos: 0, sim: false, dwell: 0, raf: 0, last: 0, rot: null, toKey: null,
  mode: 'off', view: 'map', follower: null, arrow: 0, soonFor: -1, started: 0, loop: 0, everStepped: false, here: null, pathDir: 0, transfer: null, kiosk: false, offReason: '' };
let camGuide = null, navScan = null;
const STAIR_STEPS = 20;      // steps per floor on a staircase (risers plus landing)
const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

function startNav({ camera = false, preview = false } = {}) {
  const plan = planTo(state.toKey); if (!plan) return;
  // Ask for motion inside this tap: iPhones only allow it from a user gesture.
  const sensors = !preview && cfg.features.motion !== false ? tracker.start() : null;
  const { legs, steps } = planSteps(plan), dest = destRef();
  rememberTrip(state.toKey);
  gpsStart();
  Object.assign(nav, { active: true, retried: false, var: 9, plan, legs, steps, leg: -1, i: 0, pos: 0, sim: false, dwell: 0, toKey: state.toKey, rot: null, mode: sensors ? 'starting' : 'off',
    view: 'map', follower: null, arrow: 0, soonFor: -1, started: performance.now(), everStepped: false, transfer: null, kiosk: preview, offReason: preview ? 'preview' : 'none' });
  $('#nav').classList.remove('tracking'); hideMotionCard();
  setViewUI('map');
  go('nav');
  $('#navDest').textContent = t('toDest', pname(dest.p));
  goStep(0, { focus: true, intro: t('navStarted', pname(dest.p)) });
  if (camera) setView('cam');
  analytics.add('nav_start', { to: dest.p.virtual ? 'pin' : dest.p.id, view: camera ? 'cam' : preview ? 'preview' : 'map' });
  if (locator.fresh(60000)) fuseFix(locator.fix);   // the latest fix (it may have come in on Home)
  if (sensors) sensors.then(sensorsResult);
  else if (preview) startSim();
  renderMode();
  startLoop();
}
function sensorsResult(s) {
  if (!nav.active) return;
  if (s.orientation && s.motion) { enableTracking(); return; }
  nav.mode = 'off'; nav.offReason = embedded ? 'embedded' : s.denied ? 'denied' : 'none';
  showMotionCard(); renderMode(); renderHud();
}
function showMotionCard() {
  const off = nav.active && nav.mode === 'off' && !nav.sim && !nav.kiosk && !nav.signsOnly && !gpsLive();
  $('#motionCard').hidden = !off; $('#nav').classList.toggle('motion-off', off);
  if (!off) return;
  // Asking again only helps when permission was refused. In a preview frame or on a device without sensors,
  // "Allow motion" can never work, so the preview becomes the main button instead of a button that does nothing.
  const canAsk = nav.offReason === 'denied' || !nav.offReason;
  $('#btnAllowMotion').hidden = !canAsk;
  $('#btnPreview').classList.toggle('primary', !canAsk); $('#btnPreview').classList.toggle('secondary', canAsk);
  $('#motionTitle').textContent = t(canAsk ? 'motionTitle' : 'motionTitleNoSensors');
  const body = t({ embedded: 'motionEmbedded', denied: 'motionDenied', none: 'motionNone' }[nav.offReason] || 'motionBody');
  $('#motionBody').textContent = nav.retried ? `${t('motionStill')} ${body}` : body;
}
function hideMotionCard() { $('#motionCard').hidden = true; $('#nav').classList.remove('motion-off'); }
function allowMotion() {
  const p = tracker.start();          // this tap is the permission prompt on iPhone
  nav.retried = true; nav.mode = 'starting'; nav.signsOnly = false; hideMotionCard(); renderMode();
  p.then(sensorsResult);
}
function endNav({ silent = false } = {}) {
  if (!nav.active) return;
  stopSim(); saveCalibration();
  if (nav.i < nav.steps.length - 1) analytics.add('nav_stop', { step: nav.i + 1, of: nav.steps.length });
  nav.active = false; nav.signsOnly = false; cancelAnimationFrame(nav.loop);
  tracker.onStep = null; tracker.stop(); tracker.reset(); navMap.setAccuracy(null); gps.used = false;
  stopCam();
  try { speechSynthesis?.cancel(); } catch { }
  $('#arrived').hidden = true; if ($('#dlgSteps').open) $('#dlgSteps').close();
  hideMotionCard(); $('#floorCard').hidden = true;
  if (!silent && pageNow === 'nav') back();
}
// Prior for the compass → plan angle: what this phone learned here before, else the building's bearing.
function priorFor(map) {
  const st = store.get('dalil.cal', {})[`${map.building.id}|${map.floor.id}`];
  if (st && Date.now() - st.t < 30 * 864e5 && st.abs === tracker.absolute) return { beta: st.beta, trusted: true, weight: 4 };
  if (map.geo && tracker.absolute) return { beta: map.geo.bearing - (map.geo.declination || 0), trusted: true, weight: 3 };
  return null;
}
function saveCalibration() {
  const f = nav.follower, leg = nav.legs[nav.leg]; if (!f || !leg || f.samples < 6 || f.beta == null) return;
  const all = store.get('dalil.cal', {}); all[`${leg.map.building.id}|${leg.map.floor.id}`] = { beta: Math.round(f.beta * 10) / 10, abs: tracker.absolute, t: Date.now() }; store.set('dalil.cal', all);
}
function enableTracking() {
  const leg = nav.legs[nav.steps[nav.i].leg];
  nav.mode = 'track'; hideMotionCard();
  nav.follower = new Follower({ stride: STRIDE[settings.pace] });
  const pr = priorFor(leg.map); if (pr) nav.follower.setPrior(pr.beta, { weight: pr.weight, trusted: pr.trusted });
  nav.follower.setLeg(leg.route.path, leg.cum); nav.follower.anchor(nav.pos, { learn: false });
  tracker.onStep = onTrackerStep;
  $('#nav').classList.add('tracking');
  if (nav.steps[nav.i].kind === 'floor') nav.transfer = { steps0: tracker.steps, lifts0: tracker.liftEvents };
  renderMode(); renderNavStep();
}
function onTrackerStep(ts) {
  if (!nav.active || nav.mode !== 'track' || nav.sim) return;
  const s = nav.steps[nav.i];
  if (s.kind === 'arrive') return;
  nav.everStepped = true; nav.var += 0.15;
  if (s.kind === 'floor') { floorStep(ts); return; }
  const wasWrong = nav.follower.wrong;
  nav.pos = nav.follower.step(tracker.heading, { steady: tracker.steady() });
  if (nav.follower.wrong && !wasWrong) { speak(t('wrongWay')); announce(t('wrongWay'), true); buzz([300, 100, 300]); }
  syncStepToPos();
  updateNavPos(false);
  renderMode();
}
// Floor change without a tap: a lift ride (felt by the accelerometer) then walking out, or a staircase's steps.
function floorsApart() { const fl = bFloors(), v = nav.plan.via; return Math.max(1, Math.abs(fl.indexOf(v.toMap) - fl.indexOf(nav.legs[0].map))); }
function floorStep(ts) {
  const via = nav.plan.via, tr = nav.transfer ||= { steps0: tracker.steps - 1, lifts0: tracker.liftEvents };
  const taken = tracker.steps - tr.steps0;
  if (via.lift) {
    const gap = ts - tracker.prevStep, rode = tracker.liftEvents > tr.lifts0;
    if ((rode && gap > 4000) || gap > 20000 || taken > 14) advanceFloor();
  } else {
    renderFloorCard(taken);
    if (taken >= STAIR_STEPS * floorsApart()) advanceFloor();
  }
}
function advanceFloor() {
  if (nav.steps[nav.i]?.kind !== 'floor') return;
  nav.transfer = null; buzz([60, 40, 60]);
  goStep(nav.i + 1, { intro: t('floorReached', floorName(nav.plan.via.toMap.floor)) });
}
function renderFloorCard(taken = 0) {
  const s = nav.steps[nav.i], show = nav.active && s?.kind === 'floor';
  $('#floorCard').hidden = !show; if (!show) return;
  const via = nav.plan.via, f = floorName(via.toMap.floor), total = STAIR_STEPS * floorsApart();
  $('#floorIco').innerHTML = svgIco(TURN_ICONS[via.lift ? 'lift' : 'stairs']);
  $('#floorTitle').textContent = t(via.lift ? 'liftTitle' : 'stairsTitle', via.up, f);
  $('#floorBody').textContent = via.lift ? t('liftBody', pname(via.pb)) : t('stairsBody', Math.min(taken, total), total);
  $('#floorMeter').hidden = via.lift;
  if (!via.lift) $('#floorMeter span').style.width = `${Math.min(100, 100 * taken / total)}%`;
}
// Tracking moves the position; the current step follows it.
function syncStepToPos() {
  let i = nav.i;
  while (i < nav.steps.length - 1) {
    const s = nav.steps[i], n = nav.steps[i + 1];
    if (s.kind === 'floor' || n.leg !== s.leg) break;
    const L = nav.legs[s.leg].L;
    if (n.kind === 'floor' || n.kind === 'arrive') { if (nav.pos >= L - 0.8) i++; else break; }
    else if (s.kind === 'move' ? nav.pos >= s.d1 - 0.5 : nav.pos >= s.d0 + (s.kind === 'node' ? 2 : 0.3)) i++;
    else break;
  }
  if (i !== nav.i) goStep(i, { keepPos: true });
  // Heads-up a few metres before the next turn, floor change or the destination.
  const s = nav.steps[nav.i], n = nextManeuver(nav.i);
  if (s && n && nav.soonFor !== nav.i && n.leg === s.leg && s.kind !== 'floor') {
    const rem = n.d0 - nav.pos, turn = n.kind === 'move' && n.turn !== 'straight';
    if (rem <= 6 && rem > 1.2 && (turn || n.kind === 'floor' || n.kind === 'arrive')) {
      nav.soonFor = nav.i;
      const msg = n.kind === 'arrive' ? t('aheadDest', pname(resolve(nav.toKey)?.p), fmtM(rem)) : t('soon', fmtM(rem), stepShort(n));
      speak(msg); announce(msg); buzz([60]);
    }
  }
}
function renderMode() {
  const s = nav.steps[nav.i];
  const m = nav.sim ? 'preview' : nav.mode === 'starting' ? 'starting' : nav.mode === 'off' ? 'off'
    : s?.kind === 'floor' ? 'floor' : nav.follower?.wrong ? 'wrong' : !nav.follower?.usable ? 'align'
    : !nav.everStepped && performance.now() - nav.started > 6000 ? 'still' : 'follow';
  const g = gpsLive() && !nav.sim, mm = m === 'off' && g ? 'gps' : m;
  const el = $('#navMode'); el.dataset.mode = mm === 'gps' ? 'follow' : mm;
  $('#navModeText').textContent = t({ preview: 'modePreview', starting: 'modeStarting', off: 'modeOff', floor: 'modeFloor', wrong: 'modeWrong', align: 'modeAlign', still: 'modeStill', follow: 'modeFollow', gps: 'modeGps' }[mm])
    + (g && mm !== 'floor' ? ` · ${t('gpsAcc', Math.round(gps.acc))}` : '');
  el.title = t(m === 'preview' ? 'previewNote' : 'modeFollowHint');
  $('#hudCard').classList.toggle('wrong', m === 'wrong');
  $('#camNote').textContent = nav.mode === 'track' && nav.follower?.usable ? t('camNote') : nav.mode === 'off' ? t('camNoMotion') : t('camAlign');
}
function renderStepList() {
  $('#stepList').innerHTML = nav.steps.map((s, i) => `<li class="${i === nav.i ? 'is-current' : i < nav.i ? 'is-done' : ''}" ${i === nav.i ? 'aria-current="step"' : ''}><span class="p-ico">${svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight)}</span><span class="s-text">${esc(stepText(s))}</span></li>`).join('');
}
function goStep(i, { focus = false, speakIt = true, intro = '', keepPos = false } = {}) {
  i = Math.max(0, Math.min(nav.steps.length - 1, i));
  const prev = nav.i; nav.i = i; nav.dwell = 0;
  const s = nav.steps[i];
  if (!keepPos) { nav.pos = s.d0; nav.var = 4; if (nav.follower && nav.leg === s.leg) nav.follower.anchor(nav.pos, { learn: false }); }
  nav.transfer = s.kind === 'floor' ? { steps0: tracker.steps, lifts0: tracker.liftEvents } : null;
  renderNavStep();
  if (speakIt) {
    const text = stepText(s);
    announce(`${intro ? intro + ' ' : ''}${t('stepOf', i + 1, nav.steps.length)}. ${text}`);
    speak(intro && i !== prev ? `${intro} ${text}` : text);
    if (i !== prev || i === 0) {
      if (s.kind === 'move' && s.turn !== 'straight') buzz(s.turn === 'around' ? [80, 60, 80, 60, 80] : [70, 50, 70]);
      else if (s.kind === 'node') buzz([200]); else if (s.kind === 'floor') buzz([120, 80, 120]); else if (s.kind === 'arrive') buzz([100, 60, 100, 60, 260]);
    }
  }
  if (focus) $('#navStepText').focus({ preventScroll: true });
  if (s.kind === 'arrive') { stopSim(); setTimeout(showArrival, 700); }
}
function renderNavStep() {
  const s = nav.steps[nav.i];
  $('#navIco').innerHTML = svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight);
  $('#navStepNum').textContent = t('stepOf', nav.i + 1, nav.steps.length);
  renderStepList();
  renderFloorCard(nav.transfer ? tracker.steps - nav.transfer.steps0 : 0);
  updateNavPos(true);
}
// The next thing to do (a turn, a floor change or arriving), skipping DALIL-sign steps you just walk past.
function nextManeuver(i) { for (let k = i + 1; k < nav.steps.length; k++) { const x = nav.steps[k]; if (x.kind === 'move' || x.kind === 'floor' || x.kind === 'arrive') return x; } return null; }
const maneuverText = x => !x ? '' : x.kind === 'arrive' ? t('arriveAt', pname(resolve(nav.toKey)?.p)) : stepShort(x);
const firstMove = () => nav.steps.find(x => x.kind === 'move');
// The HUD: what to do and when. Right after a turn point it says the turn ("Now"); otherwise it counts down to the next one.
function hudState() {
  const s = nav.steps[nav.i];
  if (s.kind === 'arrive') return { dist: null, main: stepText(s), sub: '', turn: 'arrive' };
  if (s.kind === 'floor') return { dist: null, main: stepShort(s), sub: '', turn: s.turn };
  const cur = s.kind === 'start' ? firstMove() || s : s;
  const fresh = cur.kind === 'move' && cur.turn !== 'straight' && nav.pos - cur.d0 < 2;
  if (fresh) { const n = nextManeuver(cur.i); return { dist: 'now', main: stepShort(cur), sub: n ? `${t('then')}: ${maneuverText(n)}` : '', turn: cur.turn }; }
  const n = nextManeuver(nav.i), n2 = n && nextManeuver(n.i);
  const rem = n && n.leg === s.leg ? Math.max(0, n.d0 - nav.pos) : Math.max(0, (s.d1 ?? nav.pos) - nav.pos);
  return { dist: rem, main: n ? maneuverText(n) : stepShort(s), sub: n2 && n.kind !== 'arrive' ? `${t('then')}: ${maneuverText(n2)}` : '', turn: 'straight' };
}
function renderHud() {
  if (!nav.active) return;
  const h = hudState(), d = $('#hudDist');
  if (h.dist === 'now') d.textContent = t('now');
  else if (h.dist == null) d.textContent = '';
  else { const [v, ...u] = fmtM(h.dist).split(' '); d.innerHTML = `<span class="v">${esc(v)}</span><span class="u">${esc(u.join(' '))}</span>`; }
  $('#navStepText').textContent = h.main;
  $('#navStepSub').textContent = h.sub; $('#navStepSub').hidden = !h.sub;
  $('#hudCard').classList.toggle('soon', h.dist === 'now' || (typeof h.dist === 'number' && h.dist <= 8));   // the banner pulses near a turn
  nav.hud = h;
}
// Turn bubbles for the leg on screen (each turn of the route, with its arrow; tap = hear it).
function drawTurns() {
  const s = nav.steps[nav.i]; if (!s) return;
  const leg = nav.legs[s.leg];
  navMap.setTurns(nav.steps.map((st, i) => ({ st, i })).filter(({ st }) => st.leg === s.leg && st.kind === 'move' && st.turn && st.turn !== 'straight')
    .map(({ st, i }) => { const p = pointAt(leg.route.path, leg.cum, st.d0); return { x: p.x, y: p.y, key: i, html: svgIco(TURN_ICONS[st.turn] || TURN_ICONS.straight) }; }));
}
function legChanged(prevLeg, leg) {
  drawTurns();
  const f = nav.follower; if (!f) return;
  const a = prevLeg?.map.geo, b = leg.map.geo;
  if (prevLeg && a && b) f.shiftFrame(b.bearing - a.bearing); else if (prevLeg) f.resetFrame();
  if (f.prior == null && f.samples < 1) { const pr = priorFor(leg.map); if (pr) f.setPrior(pr.beta, { weight: pr.weight, trusted: pr.trusted }); }
  f.setLeg(leg.route.path, leg.cum); f.anchor(nav.pos, { learn: false });
}
function facingNow() { return nav.mode === 'track' && nav.follower?.usable && !nav.sim ? nav.follower.facingPlan(tracker.heading) : null; }
function updateNavPos(animate) {
  if (!nav.active) return;
  const s = nav.steps[nav.i], leg = nav.legs[s.leg], path = leg.route.path;
  if (nav.leg !== s.leg) {
    const prevLeg = nav.legs[nav.leg]; nav.leg = s.leg; nav.rot = null; navMap.setMap(leg.map);
    const d = resolve(nav.toKey), dp = d && d.m === leg.map ? d.p : nav.plan.via?.pa || null; navMap.setDest(dp, d && d.m !== leg.map ? t('toFloor', floorName(d.m.floor)) : '', dp ? { icon: catIco(dp.category), name: pname(dp) } : {});
    legChanged(prevLeg, leg);
    animate = false;
  }
  renderHud();
  const p = pointAt(path, leg.cum, nav.pos);
  const total = nav.legs.reduce((a, l) => a + l.L, 0) || 1;
  const remain = Math.max(0, leg.L - nav.pos) + nav.legs.slice(s.leg + 1).reduce((a, l) => a + l.L, 0);
  $('#navRemain').textContent = t('remain', fmtM(remain), fmtMin(secsFor(nav.plan) * remain / total));
  const pct = Math.round(100 * (1 - remain / total));
  $('#navProgress span').style.width = `${pct}%`; $('#navProgress').setAttribute('aria-valuenow', String(pct));
  navMap.setRoute([[p.x, p.y]].concat(path.slice(p.i)), path.slice(0, p.i).concat([[p.x, p.y]]));
  const h = headingAt(path, leg.cum, nav.pos + (s.kind === 'move' ? 0 : 0.01)), face = facingNow();
  nav.here = p; nav.pathDir = h;
  const [px, py] = navMap.px(p.x, p.y);
  let rot = -90 + (face ?? h);
  if (nav.rot != null) { while (rot - nav.rot > 180) rot -= 360; while (rot - nav.rot < -180) rot += 360; }
  nav.rot = rot;
  const [vw, vh] = navMap.size();
  navMap.setCam({ x: px, y: py, k: Math.max(.6, Math.min(3.2, vw / (22 * BASE))), rot, tilt: 52, ax: .5, ay: vh > 700 ? .66 : .7 }, animate);
  navMap.setYou({ x: p.x, y: p.y }, face ?? h);
  navMap.markTurnsDone(k => nav.steps[k] && nav.steps[k].leg === s.leg && nav.steps[k].d0 < nav.pos - 0.5);
  if (face == null) drawArrow();
}
// The big arrow: live (where to walk, relative to where you face) when tracking; otherwise the turn to make now.
function arrowGoal() {
  const s = nav.steps[nav.i], face = facingNow();
  if (s.kind === 'floor' || s.kind === 'arrive') return null;
  if (face == null) return nav.hud?.dist === 'now' ? (TURN_ANGLE[nav.hud.turn] ?? 0) : 0;
  const leg = nav.legs[s.leg], a = pointAt(leg.route.path, leg.cum, nav.pos), b = pointAt(leg.route.path, leg.cum, Math.min(leg.L, nav.pos + 3));
  const dir = Math.hypot(b.x - a.x, b.y - a.y) > 0.2 ? Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI : nav.pathDir;
  return -wrap180(dir - face);
}
function drawArrow(smooth = false) {
  const goal = arrowGoal(), el = $('#navArrow');
  el.classList.toggle('icon', goal == null);
  if (goal == null) return;
  nav.arrow = smooth ? nav.arrow + 0.22 * wrap180(goal - nav.arrow) : goal;
  el.querySelector('.arrow-big').style.transform = `rotate(${nav.arrow.toFixed(1)}deg)`;
  el.dataset.angle = String(Math.round(wrap180(nav.arrow)));
}
// One loop while navigating: live arrow, heading-up map, the camera line and the status line.
function startLoop() {
  cancelAnimationFrame(nav.loop);
  let lastMap = 0, lastMode = 0;
  const tick = now => {
    if (!nav.active) return;
    if (nav.mode === 'track' && !nav.sim && nav.follower?.usable) {
      drawArrow(!settings.motion);
      if (now - lastMap > 120 && nav.view === 'map') { lastMap = now; updateNavPos(false); }
    }
    if (nav.view === 'cam' && camGuide) camGuide.update(camFrame());
    if (now - lastMode > 1000) { lastMode = now; renderMode(); }
    nav.loop = requestAnimationFrame(tick);
  };
  nav.loop = requestAnimationFrame(tick);
}
function camFrame() {
  const s = nav.steps[nav.i], leg = nav.legs[s.leg];
  if (!leg || !tracker.R || !(nav.mode === 'track' && nav.follower?.usable) || nav.sim) return null;
  const p = pointAt(leg.route.path, leg.cum, nav.pos), last = nav.legs.length - 1 === s.leg, d = resolve(nav.toKey);
  const target = last ? d?.p : nav.plan.via?.pa;
  return { R: tracker.R, beta: nav.follower.beta, pos: p, ahead: [[p.x, p.y], ...leg.route.path.slice(p.i)], dest: target ? { x: target.x, y: target.y, label: last ? pname(d.p) : t('toFloor', floorName(nav.plan.via.toMap.floor)) } : null, motion: !settings.motion };
}
// The part of the camera picture under the top and bottom panels (the guide keeps its labels out of it).
function camInsets() {
  const c = $('#navCam').getBoundingClientRect(), top = $('#nav .hud-top').getBoundingClientRect(), bot = $('#nav .hud-bottom').getBoundingClientRect();
  return { top: top.height ? Math.max(0, top.bottom - c.top) : 0, bottom: bot.height ? Math.max(0, c.bottom - bot.top) : 0 };
}
function setViewUI(v) {
  $('#btnView').setAttribute('aria-pressed', String(v === 'cam'));
  $('#navCam').hidden = v !== 'cam'; $('#navMap').hidden = v === 'cam'; $('#camNote').hidden = v !== 'cam';
}
// The camera works without motion too (it still reads DALIL signs); the guide line needs the sensors.
async function setView(v) {
  if (v === 'cam' && (state.kiosk || cfg.features.camera === false)) return;
  nav.view = v; setViewUI(v);
  if (v === 'map') { stopCam(); updateNavPos(false); return; }
  camGuide ||= new CameraGuide($('#navCam'), { onHint: h => { const el = $('#camHint'); el.hidden = !h; if (h) el.textContent = t('camHint' + cap(h)); }, insets: camInsets });
  try {
    if (camGuide.running) return;
    await camGuide.start();
    if (!nav.active || nav.view !== 'cam') { stopCam(); return; }
    navScan = new QRScanner(camGuide.video, text => { useTagText(text); }).start();
  } catch (e) {
    toast(t('cam' + cap(cameraError(e))));
    if (nav.active) { nav.view = 'map'; setViewUI('map'); updateNavPos(false); }
  }
}
function stopCam() { navScan?.stop(); navScan = null; camGuide?.stop(); $('#camHint').hidden = true; }
// Closest point of a path to (x, y): its distance and how far along the path it is.
function projectOnPath(path, cum, x, y) {
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const f = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0, d = Math.hypot(ax + f * dx - x, ay + f * dy - y);
    if (d < best.d) best = { d, s: cum[i - 1] + f * (cum[i] - cum[i - 1]) };
  }
  return best;
}
// The step that covers distance s on leg li.
function stepAt(li, s) {
  const L = nav.legs[li].L; let k = -1;
  nav.steps.forEach((x, i) => { if (x.leg !== li || x.kind === 'floor' || (x.kind === 'arrive' && s < L - 0.6)) return; if (x.d0 <= s + 0.05) k = i; });
  return Math.max(0, k);
}
// A DALIL sign or tag during navigation: on (or next to) the route, here or on the floor you are heading to,
// it confirms where you are; anywhere else it plans a new route from there.
/* ---------- Location on Earth (GPS), blended with the steps ----------
   The browser's position (GPS + Wi-Fi + cell, as map apps use) is placed on the plan through map.geo.
   It pulls the position along the route by how sure each side is (a 1-D Kalman blend): GPS by its reported
   accuracy, the steps by how far you walked since the last fix or sign. Fixes far from the route are shown, not used. */
const locator = new Locator(), GPS_MAX_ACC = 30;
const gps = { used: false, acc: null, at: 0, fromId: null };
const gpsAllowed = () => settings.gps && cfg.features?.gps !== false && !state.kiosk && !!navigator.geolocation;
const gpsMapHere = () => state.maps.some(m => m.geo);   // any DALIL building on Earth: needed to notice you are near one
const gpsLive = () => gps.used && Date.now() - gps.at < 60000;   // phones report again when you move
function gpsStart() { if (gpsAllowed() && gpsMapHere()) { locator.start(onFix, onGpsError); renderGpsBits(); } }
function gpsStop() { locator.stop(); gps.used = false; gps.fromId = null; navMap?.setAccuracy(null); homeMap?.setAccuracy(null); renderGpsBits(); }
function onGpsError(kind) { gps.used = false; if (kind === 'denied' && gps.userAsked) toast(t('gpsDenied')); renderGpsBits(); if (nav.active) { renderMode(); showMotionCard(); } }
function fixOn(map, f) { if (!map?.geo) return null; const p = planFromGeo(map.geo)(f.lng, f.lat); return { x: p.x, y: p.y, acc: f.acc }; }
function onFix(f) { if (nav.active) fuseFix(f); else homeFix(f); }
function fuseFix(f) {
  const s = nav.steps[nav.i]; if (!s || nav.sim) return;
  const leg = nav.legs[s.leg], q = fixOn(leg.map, f);
  navMap.setAccuracy(q, q?.acc); gps.acc = q?.acc ?? null;
  const wasLive = gpsLive(); gps.used = false;
  if (q && s.kind !== 'floor' && s.kind !== 'arrive' && q.acc <= GPS_MAX_ACC) {
    const pr = projectOnPath(leg.route.path, leg.cum, q.x, q.y);
    if (pr.d <= q.acc * 1.5 + 4) {
      const tracking = nav.mode === 'track' && nav.follower;
      const v = tracking ? nav.var : Math.max(nav.var, 400), K = v / (v + q.acc * q.acc);   // no steps: GPS alone moves you
      nav.pos = Math.max(0, Math.min(leg.L, nav.pos + K * (pr.s - nav.pos))); nav.var = (1 - K) * v;
      if (tracking) nav.follower.nudge(nav.pos);
      gps.used = true; gps.at = Date.now();
      syncStepToPos(); updateNavPos(false);
    }
  }
  renderMode(); if (wasLive !== gpsLive() && nav.mode === 'off') showMotionCard();
}
// GPS puts you outside this building: the indoor route starts at its nearest entrance, and the app says so
// (it never claims you are inside a building you are not in). Cleared when you choose a place yourself.
const boxOf = new WeakMap();
function planBox(m) {
  let b = boxOf.get(m); if (b) return b;
  b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of planPts(m).concat(m.points.map(p => [p.x, p.y]))) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  boxOf.set(m, b); return b;
}
function outsideOf(m, q) {
  const [a, b, c, d] = planBox(m), off = Math.hypot(Math.max(a - q.x, 0, q.x - c), Math.max(b - q.y, 0, q.y - d));
  if (off <= q.acc + 10) return null;                                    // inside, or too close to tell
  let best = null, bd = Infinity;
  for (const p of m.points) if (p.category === 'entrance' && !p.virtual) { const e = Math.hypot(p.x - q.x, p.y - q.y); if (e < bd) { bd = e; best = p; } }
  best ||= pt(defaultFrom(m)); if (!best) return null;
  return { id: best.id, d: Math.hypot(best.x - q.x, best.y - q.y), b: m.building.id, f: m.floor.id, at: Date.now() };
}
const outsideNow = () => { const o = state.outside; return o && o.b === state.map?.building.id && o.f === state.map?.floor.id && o.id === state.fromId && Date.now() - o.at < 180000 ? o : null; };
// On Home: "You are here" = the nearest place to the GPS position, unless you chose one yourself.
function homeFix(f) {
  nearCheck();
  const m = state.map, q = fixOn(m, f); gps.acc = q?.acc ?? null;
  homeMap?.setAccuracy(q, q?.acc); homeYou(); nearCheck(); renderBuildingsThrottled();
  const out = q && q.acc <= 80 && !state.fromManual ? outsideOf(m, q) : null;
  if (out) {
    const changed = state.fromId !== out.id || !outsideNow(); state.outside = out; gps.fromId = null;
    if (changed) { state.fromId = out.id; renderAll(); homeFrame(); }
    renderGpsBits(); return;
  }
  if (state.outside) { state.outside = null; if (!state.fromManual) renderAll(); }
  if (q && q.acc <= GPS_MAX_ACC && !state.fromManual) {
    let best = null, bd = Infinity;
    for (const p of m.points) { if (p.virtual) continue; const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = p; } }
    if (best && bd <= q.acc + 10) { gps.fromId = best.id; gps.at = Date.now(); if (state.fromId !== best.id) { state.fromId = best.id; renderAll(); } }
  }
  renderGpsBits();
}
function renderGpsBits() {
  const near = gps.fromId && gps.fromId === state.fromId && Date.now() - gps.at < 60000 && gps.acc != null;
  $('#fromEyebrow').textContent = outsideNow() ? t('outsideEyebrow') : near ? t('youAreHereGps', Math.round(gps.acc)) : state.fromManual ? t('youAreHere') : t('startPoint');
  $('#btnLocate').hidden = !(gpsAllowed() && state.map?.geo) || locator.on;
}
function navTag(link) {
  const li = nav.steps[nav.i].leg, leg = nav.legs[li];
  const m = link.b ? state.maps.find(x => x.building.id === link.b && (!link.f || x.floor.id === link.f)) : leg.map;
  const p = m && pointOf(m, link.at);
  if (!p || m.building.id !== leg.map.building.id) { toast(t('scanUnknown')); return false; }
  buzz([40]);
  for (const k of [li, li + 1]) {
    const L = nav.legs[k]; if (!L || L.map !== m) continue;
    const pr = projectOnPath(L.route.path, L.cum, p.x, p.y);
    if (pr.d >= 2.5) continue;
    nav.pos = pr.s; nav.var = 1; if (k === li) nav.follower?.anchor(pr.s);
    const i = stepAt(k, pr.s), s = nav.steps[i];
    goStep(s.kind === 'node' && s.node === p.id ? Math.min(nav.steps.length - 1, i + 1) : i, { keepPos: true });
    toast(t('tagConfirmed', pname(p)));
    return true;
  }
  rerouteFrom(m, link.at);
  return true;
}
function rerouteFrom(m, pointId) {
  const keep = nav.follower;
  if (m !== state.map) selectFloor(m); state.fromId = pointId;
  const plan = planTo(nav.toKey);
  if (!plan) { toast(t('noRoute')); return; }
  const { legs, steps } = planSteps(plan);
  Object.assign(nav, { plan, legs, steps, leg: -1, i: 0, pos: 0, soonFor: -1 });
  if (keep) { const pr = priorFor(legs[0].map); if (!pr) keep.resetFrame(); }
  const msg = t('rerouted', pname(pt(pointId)));
  toast(msg);
  goStep(0, { intro: msg });
  analytics.add('reroute', { at: pointId });
}
function toggleSim() { nav.sim ? stopSim() : startSim(); }
function startSim() {
  if (nav.steps[nav.i].kind === 'arrive') goStep(0);
  nav.sim = true; nav.last = performance.now(); hideMotionCard(); renderMode();
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'true'); b.querySelector('.ctrl-txt').textContent = t('previewStop'); b.querySelector('.ico').innerHTML = ico('pause');
  const tick = now => {
    if (!nav.sim) return;
    const dt = Math.min(.1, (now - nav.last) / 1000); nav.last = now;
    const s = nav.steps[nav.i];
    if (s.kind === 'move') { nav.pos = Math.min(s.d1, nav.pos + 2.5 * dt); updateNavPos(false); if (nav.pos >= s.d1 - 1e-6) goStep(nav.i + 1); }
    else if (s.kind !== 'arrive') { nav.dwell += dt; if (nav.dwell > 1.6) goStep(nav.i + 1); }
    nav.raf = requestAnimationFrame(tick);
  };
  nav.raf = requestAnimationFrame(tick);
}
function stopSim() {
  const was = nav.sim; nav.sim = false; cancelAnimationFrame(nav.raf);
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'false'); b.querySelector('.ctrl-txt').textContent = t('previewWalk'); b.querySelector('.ico').innerHTML = ico('play');
  if (nav.active && was) { if (nav.follower) nav.follower.anchor(nav.pos, { learn: false }); renderMode(); showMotionCard(); }
}
function showArrival() {
  if (!nav.active) return;
  const to = resolve(nav.toKey)?.p;
  $('#arrivedName').textContent = pname(to);
  $('#arrivedStats').textContent = `${fmtM(nav.plan.distance_m)} · ${fmtMin(secsFor(nav.plan))}`;
  $('#btnArrivedSave').textContent = isFav(nav.toKey) ? t('saved') : t('savePlace');
  $('#arrived').hidden = false; hideMotionCard(); $('#floorCard').hidden = true;
  $('#arrivedTitle').focus();
  analytics.add('arrive', { to: to?.virtual ? 'pin' : to?.id, s: Math.round((performance.now() - nav.started) / 1000) });
}
function finishArrival() {
  const d = resolve(nav.toKey);
  endNav({ silent: true });
  if (d && !d.p.virtual) { if (d.m !== state.map) selectFloor(d.m); state.fromId = d.p.id; }
  state.toKey = null; state.chip = null;
  goHome(); renderAll();
}

/* =========================================================================
   Deep links and DALIL tags
   #at-P013 · #at-P001&to-P007 · #b=<building>&f=<floor>&at-P001 · /t/<b>/<f>/<p> (NFC, QR) · #kiosk
   ========================================================================= */
function parseLink(href) {
  const out = {};
  let u; try { u = new URL(href, location.href); } catch { return out; }
  const tag = s => { const m = s.match(/(?:^|\/)t\/([^/]+)\/([^/]+)\/([^/?#&]+)/); if (m) { out.b = decodeURIComponent(m[1]); out.f = decodeURIComponent(m[2]); out.at = decodeURIComponent(m[3]); } };
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
  if (link.at && !map.points.some(p => p.id === link.at)) { if (fromTag) toast(t('nfcUnknown')); return false; }
  if (link.b) state.fromManualBuilding = true;          // a link or sign for this building: don't swap it for a nearby one
  if (map !== state.map) selectFloor(map);
  if (link.at) setFrom(link.at, { confirm: fromTag, say: fromTag });
  if (link.to) {
    const key = link.to.includes('|') ? link.to : [state.map, ...bFloors()].map(m => m.points.some(p => p.id === link.to) ? keyOf(m, { id: link.to }) : null).find(Boolean);
    if (key) setDest(key);
  }
  return true;
}

/* =========================================================================
   Sharing, kiosk
   ========================================================================= */
function shareLink(key = state.toKey) {
  const u = new URL(location.href); u.search = '';
  u.hash = `b=${state.map.building.id}&f=${state.map.floor.id}&at-${state.fromId}${key ? `&to-${encodeURIComponent(key)}` : ''}`;
  return u.toString();
}
function qrSvg(text) { if (!window.qrcode) return ''; const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: { text: t('kioskQR') } }); }
const openDlg = d => { if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); };
function openShare() {
  const url = shareLink(), d = destRef();
  $('#shareQR').innerHTML = qrSvg(url); $('#shareUrl').value = url;
  $('#btnShareNative').hidden = !navigator.share;
  $('#dlgShare').dataset.title = d ? pname(d.p) : 'DALIL';
  openDlg($('#dlgShare'));
}
let kioskTimer = 0;
function kioskIdle() {
  clearTimeout(kioskTimer); if (!state.kiosk) return;
  kioskTimer = setTimeout(() => {
    if (nav.active) endNav({ silent: true });
    $$('dialog[open]').forEach(d => d.close());
    const m = state.maps.find(m => m.building.id === state.kiosk.b && m.floor.id === state.kiosk.f);
    if (m && m !== state.map) selectFloor(m);
    state.fromId = state.kiosk.at; state.toKey = null; state.chip = null;
    goHome(); renderAll(); announce(t('kioskReset'));
  }, 90_000);
}

/* =========================================================================
   Help: call the building, go to the help desk, re-locate, or show a card to staff
   ========================================================================= */
function nearestNamed(map, x, y) { let best = null, bd = 1e9; for (const p of map.points) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; }
function openHelp() {
  const h = helpCfg(), call = $('#helpCall');
  call.hidden = !h.phone;
  if (h.phone) { call.href = 'tel:' + String(h.phone).replace(/[^+\d]/g, ''); $('#helpCallText').textContent = `${t('helpCall', settings.lang === 'ar' ? (h.labelAr || h.label || catName('reception')) : (h.label || STR.en.cats.reception))} · ${h.phone}`; }
  $('#helpDesk').hidden = !presentCats().has('reception');
  $('#staffCard').hidden = true; $('#helpShow').setAttribute('aria-expanded', 'false');
  openDlg($('#dlgHelp'));
  analytics.add('help', { page: pageNow, step: nav.active ? nav.i + 1 : null });
}
function staffCard() {
  let at = pt(state.fromId), atFloor = state.map.floor;
  if (nav.active && nav.here) { const leg = nav.legs[nav.steps[nav.i].leg]; at = nearestNamed(leg.map, nav.here.x, nav.here.y) || at; atFloor = leg.map.floor; }
  const to = (nav.active ? resolve(nav.toKey) : destRef())?.p;
  const block = L => {
    const S = STR[L], nm = p => L === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn;
    return `<div class="lang-block" lang="${L}" dir="${L === 'ar' ? 'rtl' : 'ltr'}"><p><strong>${esc(S.staffNeed)}</strong></p>${at ? `<p><span class="k">${esc(S.staffAt)}</span>${esc(nm(at))} · ${esc(S.floorName(atFloor))}</p>` : ''}${to ? `<p><span class="k">${esc(S.staffTo)}</span><strong>${esc(nm(to))}</strong></p>` : ''}</div>`;
  };
  return block(settings.lang) + block(settings.lang === 'ar' ? 'en' : 'ar');
}

/* =========================================================================
   Getting here: street map (providers.js, with failover) with the plan layered on top
   ========================================================================= */
let outdoorCtl = null, outdoorSeq = 0;
async function openOutdoor() {
  const map = state.map; if (!map?.geo) { back(); return; }
  const seq = ++outdoorSeq;
  $('#outBuilding').textContent = bname(map.building);
  $('#outStatus').textContent = t('outLoading');
  $('#outMap').setAttribute('aria-label', t('outMapLabel', bname(map.building)));
  renderOutLayers(map);
  const T = geoTransform(map.geo), entr = map.points.find(p => p.category === 'entrance') || map.points[0];
  const [lng, lat] = T(entr.x, entr.y), ll = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  $('#lnkGmaps').href = `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
  $('#lnkAmaps').href = `https://maps.apple.com/?daddr=${ll}&dirflg=w`;
  try {
    const { createOutdoorMap } = await import('./outdoor.js');
    const attribution = [t('attrPlan'), map.building_context ? t('attrOverture') : ''].filter(Boolean).join(' · ');
    outdoorCtl?.destroy(); outdoorCtl = null;
    const ctl = await createOutdoorMap($('#outMap'), { map, dark: document.documentElement.dataset.theme === 'dark' || settings.contrast, lang: settings.lang, attribution, onStatus: outStatus,
      onProvider: (p, failed) => { $('#outStatus').textContent = providerLine(p, failed); }, providers: { choice: settings.mapProvider, cfg: cfg.maps },
      layers: settings.mapLayers, opacity: settings.mapOpacity / 100 });
    if (seq !== outdoorSeq || pageNow !== 'outdoor') { ctl.destroy(); return; }
    outdoorCtl = ctl; ctl.setRoute(outRoute(map)); if (outFloor && outFloor !== map) ctl.setFloor(outFloor);
    $('#outStatus').textContent = providerLine(ctl.provider, ctl.failed);
  } catch { if (seq === outdoorSeq) $('#outStatus').textContent = t('outFail'); }
}
// Base map list (every provider; ones without the building's key are shown but switched off) and layer checkboxes.
let outFloor = null;
function renderOutLayers(map) {
  const all = allProviders(cfg.maps), row = (type, name, val, label, on, dis = false, sub = '') =>
    `<label class="opt${dis ? ' off' : ''}"><input type="${type}" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
  const base = [row('radio', 'outBase', 'auto', t('provider_auto'), settings.mapProvider === 'auto')];
  for (const kind of ['streets', 'satellite']) for (const p of all.filter(p => p.kind === kind))
    base.push(row('radio', 'outBase', p.id, `${t(kind === 'satellite' ? 'kindSatellite' : 'kindStreets')} · ${p.name}`, settings.mapProvider === p.id, !p.available, p.available ? (p.key ? t('provKey') : p.test ? t('provTest') : t('provFree')) : t('needsKey')));
  base.push(row('radio', 'outBase', 'plain', t('provider_plain'), settings.mapProvider === 'plain'));
  $('#outBases').innerHTML = base.join('');
  const missing = [...new Set(all.filter(p => !p.available).map(p => p.key))];
  $('#outKeyNote').hidden = !missing.length; $('#outKeyNote').textContent = t('keyNote');
  const hasRoute = !!outRoute(map);
  $('#outChecks').innerHTML = ['plan', 'places', 'outline', 'entrances', 'route', 'me'].filter(k => k !== 'route' || hasRoute)
    .map(k => row('checkbox', 'outLayer', k, t('lyr_' + k), settings.mapLayers[k] ?? true)).join('');
  const floors = bFloors().filter(m => m.geo);
  $('#outFloorsSet').hidden = floors.length < 2; outFloor = outFloor && floors.includes(outFloor) ? outFloor : map;
  $('#outFloors').innerHTML = floors.map((m, i) => row('radio', 'outFloor', String(i), floorName(m.floor), m === outFloor)).join('');
  $('#outOpacity').value = settings.mapOpacity;
}
// The planned route on the floor shown, as [lng, lat] points (the first leg on that floor), or null.
function outRoute(map) {
  if (!state.toKey || !map?.geo) return null;
  const plan = planTo(state.toKey); if (!plan) return null;
  const leg = planSteps(plan).legs.find(l => l.map === (outFloor || map)); if (!leg) return null;
  const T = geoTransform(leg.map.geo); return leg.route.path.map(([x, y]) => T(x, y));
}
function providerLine(p, failed = []) {
  if (!p || p.kind === 'plain') return settings.mapProvider === 'plain' ? t('outProvider', t('provider_plain')) : t('outNoStreet');
  return failed.length ? t('outFallback', failed[0], p.name) : t('outProvider', p.name);
}
function outStatus(kind, info) {
  const el = $('#outStatus');
  if (kind === 'pos') el.textContent = info.dist <= 40 ? t('outInside') : t('outDist', fmtDist(info.dist));
  else el.textContent = t(kind === 'denied' ? 'locDenied' : 'locUnavailable');
}
// If the visitor already allowed location for this site, say how far away the building is (never prompts).
async function proximityHint() {
  const map = state.map; if (!map?.geo || !navigator.geolocation || !navigator.permissions) return;
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' }); if (p.state !== 'granted') return;
    navigator.geolocation.getCurrentPosition(pos => {
      if (state.map !== map) return;
      const T = geoTransform(map.geo), e = map.points.find(q => q.category === 'entrance') || map.points[0];
      const d = haversine([pos.coords.longitude, pos.coords.latitude], T(e.x, e.y));
      if (d > 150) $('#ghSub').textContent = t('nearBuilding', fmtDist(d));
    }, () => { }, { maximumAge: 60000, timeout: 8000 });
  } catch { }
}
function setProvider(v) { settings.mapProvider = v; saveSettings(); $('#setProvider').value = v; if (pageNow === 'outdoor') openOutdoor(); }


/* =========================================================================
   Survey: map a building with no floor plan by walking it (survey.js). The compass and step counter draw the
   trail, the person marks places, coming back to a place straightens the trail, lifts and stairs link floors.
   The walk is saved on the phone as it goes, so a closed tab or a phone call loses nothing.
   ========================================================================= */
const SV_KEY = 'dalil.survey';
const SV_CATS = ['entrance', 'room', 'lab', 'toilet', 'toilet_acc', 'lift', 'stairs', 'prayer', 'cafe', 'reception', 'exit'];
const sv = { s: null, cat: 'entrance', pick: null, maps: null, wake: null, saveN: 0, view: null };
const svLoad = () => { const d = store.get(SV_KEY, null); return d?.v === 2 && d.floors?.length ? Object.assign(new Survey({ building: d.building }), d, { _cache: null }) : null; };   // v1 walks can't be continued
const svSave = () => { if (sv.s) { const { _cache, ...rest } = sv.s; store.set(SV_KEY, rest); } };
const SV_QUICK = ['room', 'toilet', 'lift', 'stairs', 'entrance'];
function renderSurvey() {
  const live = !!sv.s && !sv.maps && !sv.review;
  $('#svSetup').hidden = live || !!sv.maps || !!sv.review; $('#svLive').hidden = !live; $('#svDone').hidden = !sv.maps; $('#svReview').hidden = !sv.review || !!sv.maps;
  if (!live && !sv.maps) {
    $('#svFloor').value ||= t('svFloorDefault');
    const old = svLoad(); $('#btnSvResume').hidden = !old;
    if (old) $('#btnSvResume').lastElementChild.textContent = `${t('svResume')}: ${old.building}`;
  }
  if (live) { svDraw(); $('#svQuick').innerHTML = SV_QUICK.map(c => `<button type="button" class="sv-qbtn" data-svq="${c}"><span class="ico">${catIco(c)}</span><span>${esc(catName(c))}</span></button>`).join(''); }
}
async function svStart(resume = false) {
  let s = null;
  if (resume) s = svLoad();
  else {
    const name = $('#svBuilding').value.trim(); if (!name) { toast(t('svNeedName')); $('#svBuilding').focus(); return; }
    const cm = +$('#svHeight').value; s = new Survey({ building: name, stride: cm >= 120 && cm <= 220 ? strideFromHeight(cm) : STRIDE[settings.pace] });
  }
  if (!s) return;
  const sensors = tracker.start();          // inside the tap: the iPhone asks for motion here
  if (!locator.on && settings.gps && navigator.geolocation) locator.start(onFix, onGpsError);
  const res = await sensors;
  if (!(res.orientation && res.motion)) { tracker.stop(); toast(t('svNeedSensors'), 6000); return; }
  if (!resume) {
    const f = locator.fresh(30000);
    s.startFloor($('#svFloor').value.trim() || t('svFloorDefault'), { origin: f && f.acc <= 50 ? { lng: f.lng, lat: f.lat, acc: f.acc } : null });
  }
  sv.s = s; sv.maps = null; sv.view = null; svSave();
  tracker.onStep = svStep;
  try { sv.wake = await navigator.wakeLock?.request('screen'); } catch { sv.wake = null; }
  renderSurvey();
  svStatus(s.floor.places.length ? t('svWalk', s.steps) : t('svFirstPlaceHint'));
  announce(t('svWalk', s.steps));
}
function svStep() {
  const s = sv.s; if (!s || s.paused || pageNow !== 'survey') return;
  if (!s.step(tracker.heading, { turning: tracker.rate > 110 })) return;   // turning on the spot is not a step forward
  // No GPS at the door yet? Take the first good fix in the first few steps, moved back to where you started.
  if (!s.origin && s.steps < 12) {
    const f = locator.fresh(8000);
    if (f && f.acc <= 50) { const r = Math.PI / 180, mlng = 111412.84 * Math.cos(f.lat * r), mlat = 111132.92 - 559.82 * Math.cos(2 * f.lat * r);
      s.origin = { lng: f.lng - s.pos.x / mlng, lat: f.lat - s.pos.y / mlat, acc: f.acc }; }
  }
  if (++sv.saveN % 10 === 0) svSave();
  svNearCheck();
  svDraw(); if (s.steps % 5 === 0 || s.floor.places.length) $('#svStats').textContent = t('svStats', Math.round(s.dist), svPlaces().length);
}
function svStop() {
  if (sv.s) svSave();
  if (tracker.onStep === svStep) { tracker.onStep = null; if (!nav.active) tracker.stop(); }
  sv.wake?.release?.().catch(() => {}); sv.wake = null;
  if (!sv.maps) sv.s = null;     // the walk stays saved: "Continue the unfinished walk"
}
const svPlaces = () => { const seen = new Map(); (sv.s?.floors || []).forEach((f, i) => f.places.forEach(p => seen.set(p.link || i + ':' + p.id, p))); return [...seen.values()]; };   // a lift on two floors is one place
function svStatus(text) { $('#svStatus').textContent = text; }
// The live trail: a little SVG, north up, scaled to fit, with you as the blue dot.
function svDraw() {
  const s = sv.s, el = $('#svMap'); if (!s?.floor) return;
  $('#svFloorNow').textContent = s.floor.name;
  $('#svStats').textContent = t('svStats', Math.round(s.dist), svPlaces().length);
  const here = s.pos, pl = s.floor.places.map(p => ({ ...p, ...s.placeXY(p) })), lines = s.trail(), pts = lines.flat().concat(pl.map(p => [p.x, p.y]), [[here.x, here.y]]);
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  const pad = 4, span = Math.max(16, c - a + 2 * pad, d - b + 2 * pad), cx = (a + c) / 2, cy = (b + d) / 2;
  el.setAttribute('viewBox', `${cx - span / 2} ${-cy - span / 2} ${span} ${span}`);
  const P = ([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`, w = (span / 60).toFixed(2);
  el.innerHTML = lines.map(L => `<polyline class="sv-trail" points="${L.map(P).join(' ')}" stroke-width="${(1.8).toFixed(2)}"/><polyline class="sv-line" points="${L.map(P).join(' ')}" stroke-width="${w}"/>`).join('')
    + pl.map(p => `<g class="sv-pl sv-${esc(p.category)}"><circle cx="${p.x.toFixed(2)}" cy="${(-p.y).toFixed(2)}" r="${(span / 45).toFixed(2)}"/><text x="${p.x.toFixed(2)}" y="${(-p.y - span / 28).toFixed(2)}" font-size="${(span / 26).toFixed(2)}">${esc(p.nameEn)}</text></g>`).join('')
    + `<g class="sv-you" transform="translate(${P([here.x, here.y])}) rotate(${tracker.heading ?? 0})"><circle r="${(span / 30).toFixed(2)}"/><path d="M0 ${(-span / 14).toFixed(2)} L${(span / 40).toFixed(2)} ${(-span / 28).toFixed(2)} L${(-span / 40).toFixed(2)} ${(-span / 28).toFixed(2)}z"/></g>`;
}
function svQuickAdd(cat) {
  const s = sv.s; if (!s) return;
  const n = svPlaces().filter(p => p.category === cat).length + 1, label = STR.en.cats[cat] || cat;
  const p = s.addPlace({ nameEn: `${label} ${n}`, nameAr: `${STR.ar.cats[cat] || ''} ${n}`.trim(), category: cat });
  svSave(); svDraw(); buzz(30);
  const msg = t('svAdded', settings.lang === 'ar' ? p.nameAr : p.nameEn); svStatus(msg); announce(msg);
}
function svNearCheck() {
  const p = sv.s.nearbyPlace(), b = $('#btnSvNear');
  if (!p) { b.hidden = true; sv.nearId = null; return; }
  if (sv.nearId !== p.id) { sv.nearId = p.id; $('#svNearText').textContent = t('svNearAsk', p.nameEn); b.hidden = false; buzz([20, 60, 20]); announce(t('svNearAsk', p.nameEn)); }
}
function svOpenPlace() {
  sv.cat = sv.s.floor.places.length ? 'room' : 'entrance';
  $('#svCats').innerHTML = SV_CATS.map(c => `<button type="button" role="radio" class="sv-cat" data-svcat="${c}" aria-checked="${c === sv.cat}"><span class="ico">${catIco(c)}</span><span>${esc(t('cats')[c] || c)}</span></button>`).join('');
  $('#svName').value = ''; $('#svNameAr').value = '';
  openDlg($('#dlgSvPlace'));
}
function svSavePlace() {
  const typed = $('#svName').value.trim(), nameEn = typed || STR.en.cats[sv.cat] || sv.cat, nameAr = $('#svNameAr').value.trim() || (typed ? '' : STR.ar.cats[sv.cat] || '');
  const p = sv.s.addPlace({ nameEn, nameAr, category: sv.cat });
  $('#dlgSvPlace').close(); svSave(); svDraw();
  const msg = t('svAdded', p.nameEn); svStatus(msg); announce(msg); navigator.vibrate?.(40);
}
function svOpenPick(kind) {
  const fl = sv.s.floor, list = kind === 'floor' ? fl.places.filter(p => p.category === 'lift' || p.category === 'stairs') : fl.places;
  if (!list.length) { toast(t(kind === 'floor' ? 'svNoLinks' : 'svNoPlaces')); return; }
  sv.pick = kind;
  $('#svPickTitle').textContent = t(kind === 'floor' ? 'svPickFloor' : 'svPickBack');
  $('#svNewFloorWrap').hidden = kind !== 'floor';
  if (kind === 'floor') $('#svNewFloor').value = '';
  $('#svPickList').innerHTML = list.map(p => `<li><button class="row-btn" type="button" data-svplace="${esc(p.id)}"><span class="r-ico"><span class="ico">${catIco(p.category)}</span></span><span class="r-main"><span class="r-name">${esc(p.nameEn)}</span></span></button></li>`).join('');
  openDlg($('#dlgSvPick'));
}
function svPicked(id) {
  const s = sv.s;
  if (sv.pick === 'floor') {
    const name = $('#svNewFloor').value.trim(); if (!name) { $('#svNewFloor').focus(); return; }
    s.changeFloor(id, name); $('#dlgSvPick').close();
    const msg = t('svNewFloorNow', name); svStatus(msg); announce(msg);
  } else {
    const err = s.backAt(id); $('#dlgSvPick').close();
    const msg = t('svFixed', fmtM(err)); svStatus(msg); announce(msg);
  }
  svSave(); svDraw();
}
function svFinish() {
  const s = sv.s; if (!svPlaces().length) { toast(t('svNoPlaces')); return; }
  sv.review = true; svSave(); renderSurvey(); svRenderReview(); announce(t('svReviewTitle'));
  $('#pgSurvey .page-body').scrollTop = 0;
}
// Review: how good each floor is, the names, and (with GPS) a line-up with the satellite photo.
function svRenderReview() {
  const s = sv.s, pct = d => `${(d * 100).toFixed(1)} %`;
  $('#svQuality').innerHTML = s.floors.map((fl, i) => {
    const q = s.quality(i), msg = q.rating === 'unchecked' ? t('svQ_unchecked') : t('svQ_' + q.rating, pct(q.drift));
    return `<div class="svq svq-${q.rating}"><strong>${esc(t('svQLine', fl.name, Math.round(q.dist), q.loops))}</strong><span>${esc(msg)}</span></div>`;
  }).join('');
  $('#svNameList').innerHTML = s.floors.flatMap((fl, fi) => fl.places.map((p, pi) => `<li><span class="sv-nm-ico">${catIco(p.category)}</span><input type="text" value="${esc(p.nameEn)}" data-fi="${fi}" data-pi="${pi}" aria-label="${esc(catName(p.category))}"><small>${esc(fl.name)}</small></li>`)).join('');
  $('#svAlignSec').hidden = !s.origin;
  if (s.origin) svAlignMap();
}
async function svAlignMap() {
  const m = sv.s.toMaps()[0];
  if (sv.alignCtl) { sv.alignCtl.setFloor(m); return; }
  try {
    const { createOutdoorMap } = await import('./outdoor.js');
    sv.alignCtl = await createOutdoorMap($('#svAlignMap'), { map: m, lang: settings.lang, attribution: t('attrPlan'), providers: { choice: cfg.maps?.homeBase || 'esri-imagery-labels', cfg: cfg.maps }, padding: 30 });
  } catch { $('#svAlignSec').hidden = true; }
}
function svAlignBy(k, v) {
  const a = sv.s.align; if (k === 'scale') a.scale = Math.max(0.8, Math.min(1.2, (a.scale || 1) + v)); else a[k] = (a[k] || 0) + v;
  svSave(); svAlignMap();
}
function svSaveMaps() {
  const s = sv.s;
  for (const inp of $$('#svNameList input')) { const p = s.floors[+inp.dataset.fi].places[+inp.dataset.pi], v = inp.value.trim(); if (v && v !== p.nameEn) { p.nameEn = v; p.nameAr = ''; } }
  try { sv.alignCtl?.destroy(); } catch { } sv.alignCtl = null; sv.review = false;
  const maps = s.toMaps();
  const user = store.get('dalil.userMaps', []).filter(o => o.building.id !== maps[0].building.id);
  for (const m of maps) { state.maps = state.maps.filter(o => !(o.building.id === m.building.id && o.floor.id === m.floor.id)); addMap(m); user.push(m); }
  store.set('dalil.userMaps', user);
  try { localStorage.removeItem(SV_KEY); } catch { /* private mode */ }
  sv.maps = maps;
  if (tracker.onStep === svStep) { tracker.onStep = null; tracker.stop(); }
  $('#svDoneText').textContent = t('svDoneText', s.building, maps.length, svPlaces().length) + (s.origin ? '' : ' ' + t('svGpsNone'));
  renderSurvey(); announce(t('svDoneTitle'));
  analytics.add('survey_done', { floors: maps.length, places: svPlaces().length });
}
function svShare() {
  const maps = sv.maps; if (!maps) return;
  const body = JSON.stringify(maps.length === 1 ? maps[0] : { format: 'dalil-maps', maps }, null, 1);
  const name = `dalil-map_${maps[0].building.id}_survey.json`, file = new File([body], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file], title: maps[0].building.name }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function svOpenMap() {
  const m = sv.maps?.[0]; if (!m) return;
  sv.maps = null; sv.s = null;
  goHome(); homeFloor = null; selectFloor(state.maps.find(o => o.building.id === m.building.id && o.floor.id === m.floor.id) || m); state.fromManual = false;
  if (homeCtl) homeCtl.frame();
}
function bindSurvey() {
  $('#btnSurvey').onclick = $('#btnSurveyHome').onclick = () => { sv.maps = null; go('survey'); };
  $('#btnSvStart').onclick = () => svStart(false);
  $('#btnSvResume').onclick = () => svStart(true);
  $('#btnSvPlace').onclick = svOpenPlace;
  $('#svQuick').addEventListener('click', e => { const b = e.target.closest('[data-svq]'); if (b) svQuickAdd(b.dataset.svq); });
  $('#btnSvNear').onclick = () => { if (!sv.nearId) return; const err = sv.s.backAt(sv.nearId); $('#btnSvNear').hidden = true; sv.nearId = null; svSave(); svDraw(); const msg = t('svFixed', fmtM(err)); svStatus(msg); announce(msg); buzz(40); };
  $('#btnSvSaveMap').onclick = svSaveMaps;
  $('#btnSvKeepWalking').onclick = () => { sv.review = false; try { sv.alignCtl?.destroy(); } catch { } sv.alignCtl = null; renderSurvey(); };
  $('#svReview').addEventListener('click', e => { const b = e.target.closest('[data-al]'); if (!b) return; const [k, v] = b.dataset.al.split(':'); svAlignBy(k, +v); });
  $('#btnSvSave').onclick = svSavePlace;
  $('#svName').addEventListener('keydown', e => { if (e.key === 'Enter') svSavePlace(); });
  $('#btnSvBack').onclick = () => svOpenPick('back');
  $('#btnSvFloor').onclick = () => svOpenPick('floor');
  $('#btnSvPause').onclick = () => { const s = sv.s; if (!s) return; s.paused = !s.paused; $('#btnSvPause').setAttribute('aria-pressed', s.paused); $('#btnSvPause').textContent = t(s.paused ? 'svGoOn' : 'svPause'); svStatus(s.paused ? t('svPaused') : t('svWalk', s.steps)); };
  $('#btnSvFinish').onclick = svFinish;
  $('#btnSvShare').onclick = svShare;
  $('#btnSvOpen').onclick = svOpenMap;
  $('#svCats').addEventListener('click', e => { const b = e.target.closest('[data-svcat]'); if (!b) return; sv.cat = b.dataset.svcat; $$('#svCats [data-svcat]').forEach(x => x.setAttribute('aria-checked', x === b)); if (!$('#svName').value) $('#svName').focus(); });
  $('#svPickList').addEventListener('click', e => { const b = e.target.closest('[data-svplace]'); if (b) svPicked(b.dataset.svplace); });
}

/* =========================================================================
   Wiring
   ========================================================================= */
function bind() {
  $('#btnLang').onclick = () => setLang(settings.lang === 'ar' ? 'en' : 'ar');
  $('#btnSettings').onclick = () => go('settings');
  bindSurvey();
  $('#btnSearchOpen').onclick = () => go('search');
  $('#btnFrom').onclick = () => go('where');
  $('#btnScanHome').onclick = () => { go('where'); startWhereScan(); };
  $('#btnFloorMap').onclick = () => { state.viewMap = state.map; go('map'); };
  $('#btnGettingHere').onclick = () => go('outdoor');
  document.addEventListener('click', e => {
    if (e.target.closest('[data-back]')) { back(); return; }
    if (e.target.closest('[data-help]')) { openHelp(); return; }
    const close = e.target.closest('[data-close]'); if (close) { close.closest('dialog')?.close(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { if (pick.dataset.q) rememberSearch(pick.dataset.q); setDest(pick.dataset.pick); return; }
    const cat = e.target.closest('[data-cat]'); if (cat) { pickNearest(cat.dataset.cat); return; }
    const rs = e.target.closest('[data-search]');
    if (rs) { $('#search').value = rs.dataset.search; renderSearch(); $('#search').focus(); return; }
    const wh = e.target.closest('[data-where]');
    if (wh) { const [f, id] = wh.dataset.where.split('|'), m = mapByFloor(f); if (m && m !== state.map) selectFloor(m); setFrom(id); back(); }
  });
  // Dialogs close on a tap on the backdrop.
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  // Search
  const search = $('#search');
  search.addEventListener('input', () => renderSearch());
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const b = $('#results button[data-pick]'); if (b) { e.preventDefault(); rememberSearch(search.value); setDest(b.dataset.pick); } }
    else if (e.key === 'ArrowDown') { const b = $('#results button, #recentSearches button'); if (b) { e.preventDefault(); b.focus(); } }
  });
  $('#btnSearchClear').onclick = () => { search.value = ''; renderSearch(); search.focus(); };
  $('#btnClearSearches').onclick = () => { store.set('dalil.searches', []); renderSearch(); };
  $('#searchFilters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { state.filter = b.dataset.filter; renderSearch(); } });
  $('#pgSearch').addEventListener('keydown', e => {
    const items = $$('#pgSearch .row-btn'), i = items.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : search).focus(); }
  });
  // Route page
  $('#optStepFree').addEventListener('change', e => setStepFree(e.target.checked));
  $('#btnFav').onclick = () => { if (state.toKey) { const on = toggleFav(state.toKey); announce(t(on ? 'saved' : 'unsave')); toast(t(on ? 'saved' : 'unsave')); } };
  $('#btnStart').onclick = () => { if (outsideNow() && !state.kiosk) { openOutsideStart(); return; } startNav({ preview: !!state.kiosk }); };
  $('#btnOutAtDoor').onclick = () => { $('#dlgOutside').close(); setFrom(state.fromId, { say: false }); startNav(); };
  $('#btnOutMap').onclick = () => { $('#dlgOutside').close(); go('outdoor'); };
  $('#btnNoResHelp').onclick = () => openHelp();
  $('#btnNoResHelpDesk').onclick = () => pickNearest('help');
  $('#btnStartCam').onclick = () => startNav({ camera: true });
  $('#btnShare').onclick = openShare;
  $('#btnShareCopy').onclick = async () => { const v = $('#shareUrl').value; try { await navigator.clipboard.writeText(v); toast(t('copied')); } catch { $('#shareUrl').select(); } };
  $('#btnShareNative').onclick = async () => { try { await navigator.share({ title: 'DALIL', text: $('#dlgShare').dataset.title, url: $('#shareUrl').value }); } catch { } };
  // Where am I
  $('#btnScanStart').onclick = startWhereScan;
  $('#whereFilter').addEventListener('input', renderWhere);
  // Floor map
  $('#btnPinGo').onclick = () => { const k = pinKey(); if (k) { pinPoint = null; $('#pinCard').hidden = true; setDest(k); } };
  $('#btnPinSave').onclick = () => { if (!pinPoint) return; store.set('dalil.spot', { b: state.map.building.id, f: pinPoint.f, x: pinPoint.x, y: pinPoint.y }); pinPoint = null; $('#pinCard').hidden = true; renderFloorMap(); renderHome(); toast(t('spotSaved')); announce(t('spotSaved')); };
  $('#btnClosePin').onclick = () => { pinPoint = null; $('#pinCard').hidden = true; renderFloorMap(); };
  $('#btnRecenter').onclick = () => { state.viewMap = state.map; renderFloorMap(); };
  $('#btnZoomIn').onclick = () => mainMap.zoom(1.3); $('#btnZoomOut').onclick = () => mainMap.zoom(1 / 1.3);
  $('#floorRail').addEventListener('click', e => { const b = e.target.closest('[data-floor]'); if (!b) return; const m = mapByFloor(b.dataset.floor); if (m && m !== state.viewMap) { state.viewMap = m; pinPoint = null; $('#pinCard').hidden = true; renderFloorMap(); announce(t('viewFloor', floorName(m.floor))); } });
  // Settings
  $$('input[name="lang"]').forEach(r => r.addEventListener('change', () => setLang(r.value)));
  $$('input[name="theme"]').forEach(r => r.addEventListener('change', () => { settings.theme = r.value; saveSettings(); applyDisplay(); }));
  $$('input[name="textSize"]').forEach(r => r.addEventListener('change', () => { settings.textSize = r.value; saveSettings(); rerenderAll(); }));
  $$('input[name="pace"]').forEach(r => r.addEventListener('change', () => { settings.pace = r.value; saveSettings(); if (nav.follower) nav.follower.stride = STRIDE[r.value]; renderAll(); }));
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (settings.theme === 'system') applyDisplay(); });
  const toggle = (id, key, after) => $(id).addEventListener('change', e => { settings[key] = e.target.checked; saveSettings(); after?.(); });
  toggle('#setVoice', 'voice', () => { if (!settings.voice) try { speechSynthesis.cancel(); } catch { } });
  toggle('#setVibrate', 'vibrate');
  toggle('#setGps', 'gps', () => settings.gps ? gpsStart() : gpsStop());
  $('#btnLocate').onclick = () => { state.fromManual = false; gps.userAsked = true; gpsStart(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { gps.paused = locator.on; locator.stop(); } else if (gps.paused) { gps.paused = false; gpsStart(); } });
  $('#setStepFree').addEventListener('change', e => setStepFree(e.target.checked));
  toggle('#setContrast', 'contrast', rerenderAll); toggle('#setMotion', 'motion', rerenderAll);
  $('#setBuilding').addEventListener('change', e => { const m = state.maps[+e.target.value]; if (m) { state.toKey = null; selectFloor(m); } });
  $('#setProvider').addEventListener('change', e => setProvider(e.target.value));
  $('#outBases').addEventListener('change', e => { const v = e.target.value; settings.mapProvider = v; saveSettings(); $('#setProvider').value = v; outdoorCtl?.setBase(v); });
  $('#outChecks').addEventListener('change', e => { settings.mapLayers = { ...settings.mapLayers, [e.target.value]: e.target.checked }; saveSettings(); outdoorCtl?.setLayer(e.target.value, e.target.checked); if (e.target.value === 'me' && e.target.checked && outdoorCtl) outdoorCtl.locate(); });
  $('#outFloors').addEventListener('change', e => { outFloor = bFloors().filter(m => m.geo)[+e.target.value]; outdoorCtl?.setFloor(outFloor); outdoorCtl?.setRoute(outRoute(state.map)); });
  $('#outOpacity').addEventListener('input', e => { settings.mapOpacity = +e.target.value; saveSettings(); outdoorCtl?.setOpacity(settings.mapOpacity / 100); });
  $('#btnRealMap').onclick = () => { outFloor = state.viewMap; go('outdoor'); };
  $('#fileMap').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
  // Getting here
  $('#btnMyLoc').onclick = () => outdoorCtl ? outdoorCtl.locate() : outStatus('unavailable');
  // Navigation
  $('#btnRepeat').onclick = () => {
    const h = nav.hud || hudState(), msg = typeof h.dist === 'number' && h.dist > 1 ? t('soon', fmtM(h.dist), h.main) : h.main;
    announce(msg); speak(msg);
  };
  $('#btnSim').onclick = () => { toggleSim(); $('#dlgSteps').close(); };
  $('#btnEndNav').onclick = () => endNav();
  $('#btnSteps').onclick = () => { renderStepList(); openDlg($('#dlgSteps')); };
  $('#btnView').onclick = () => setView(nav.view === 'cam' ? 'map' : 'cam');
  $('#btnAllowMotion').onclick = allowMotion;
  $('#btnPreview').onclick = startSim;
  $('#btnSignsOnly').onclick = () => { nav.signsOnly = true; hideMotionCard(); };
  // Home map controls
  $('#navMap').addEventListener('click', e => { const b = e.target.closest('[data-turn]'); if (!b) return; const st = nav.steps[+b.dataset.turn]; if (st) { const msg = stepText(st); speak(msg); announce(msg); buzz([30]); b.classList.add('ping'); setTimeout(() => b.classList.remove('ping'), 600); } });
  $('#hudCard').addEventListener('click', () => $('#btnRepeat').click());
  $('#btnSheet').onclick = () => { if ($('#homeSheet').dataset.dragged) return; setSheet(!$('#homeSheet').classList.contains('open')); };
  bindSheetDrag();
  document.addEventListener('pointerdown', e => { if (e.target.closest('.btn.primary, .tile, .hm-fab, .turn-bub')) buzz(8); }, { passive: true });   // a light tick under the finger (Android)
  $('#homeChips').addEventListener('click', e => { if (e.target.closest('#chipBuildings')) { setSheet(true); requestAnimationFrame(() => $('#secBuildings').scrollIntoView({ block: 'start' })); } });
  $('#buildingList').addEventListener('click', e => { if (e.target.closest('#btnMoreBld')) { state.showFarBld = true; renderBuildings(); return; } const b = e.target.closest('[data-building]'); if (b) { state.fromManualBuilding = true; openBuilding(b.dataset.building); } });
  $('#btnNearOpen').onclick = () => { state.fromManualBuilding = true; openBuilding($('#nearCard').dataset.bld); };
  $('#btnNearClose').onclick = () => { nearDismissed = $('#nearCard').dataset.bld; $('#nearCard').hidden = true; };
  $('#homeFloors').addEventListener('click', e => { const b = e.target.closest('[data-hfloor]'); if (b) setHomeFloor(mapByFloor(b.dataset.hfloor)); });
  $('#btnScanTop').onclick = () => { go('where'); startWhereScan(); };
  $('#btnDirections').onclick = () => go('search');
  $('#btnLocateMe').onclick = () => {
    gps.userAsked = true;
    if (state.map?.geo) { state.fromManual = false; gpsStart(); const f = locator.fresh(60000); if (f && homeCtl) homeCtl.flyTo([f.lng, f.lat]); else if (homeCtl) { const p = pt(state.fromId); if (p) homeCtl.flyTo(geoTransform(state.map.geo)(p.x, p.y)); } }
    else { setHomeFloor(state.map); renderHomeMap(); }
  };
  $('#btnLayers').onclick = () => { renderLayerControls('home'); $('#dlgLayers').showModal(); };
  $('#homeBases').addEventListener('change', e => { settings.mapProvider = e.target.value; saveSettings(); homeCtl?.setBase(e.target.value); });
  $('#homeChecks').addEventListener('change', e => { settings.mapLayers = { ...settings.mapLayers, [e.target.value]: e.target.checked }; saveSettings(); homeCtl?.setLayer(e.target.value, e.target.checked); });
  $('#tabExplore').onclick = () => setSheet(false);
  $('#tabSaved').onclick = () => { setSheet(true); requestAnimationFrame(() => ($('#secSaved').hidden ? $('#secRecent').hidden ? $('#tiles') : $('#secRecent') : $('#secSaved')).scrollIntoView({ block: 'start' })); };
  $('#tabScan').onclick = () => { go('where'); startWhereScan(); };
  $('#tabSettings').onclick = () => go('settings');
  $('#btnArrivedDone').onclick = finishArrival;
  $('#btnArrivedSave').onclick = () => { toggleFav(nav.toKey, true); $('#btnArrivedSave').textContent = t('saved'); };
  // Help
  $('#helpDesk').onclick = () => { $('#dlgHelp').close(); if (nav.active) endNav({ silent: true }); pickNearest('help'); };
  $('#helpScan').onclick = () => { $('#dlgHelp').close(); if (nav.active) { setView('cam'); toast(t('whereScanning')); } else { go('where'); startWhereScan(); } };
  $('#helpShow').onclick = () => { const c = $('#staffCard'), open = c.hidden; c.innerHTML = open ? staffCard() : ''; c.hidden = !open; $('#helpShow').setAttribute('aria-expanded', String(open)); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, kioskIdle, { passive: true }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
      if (!$('#arrived').hidden) { finishArrival(); return; }
      if (pageNow !== 'home') { back(); return; }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && nav.active && nav.view === 'cam' && !camGuide?.stream?.active) { camGuide?.stop(); setView('cam'); } });
  window.addEventListener('hashchange', () => applyLink(parseLink(location.href)));
  $('#btnRetry').onclick = () => { $('#bootError').hidden = true; $('#bootText').hidden = false; $('#bootBar').hidden = false; boot(); };
}

async function boot() {
  try { await loadBundled(); } catch { /* handled below */ }
  if (!state.maps.length) { $('#bootText').hidden = true; $('#bootBar').hidden = true; $('#bootError').hidden = false; $('#btnRetry').focus(); return false; }
  const last = store.get('dalil.last', null), link = parseLink(location.href);
  const start = (link.b && state.maps.find(m => m.building.id === link.b && (!link.f || m.floor.id === link.f)))
    || (last && state.maps.find(m => m.building.id === last.b && m.floor.id === last.f)) || state.maps[0];
  try { history.replaceState({ dalil: 1 }, ''); } catch { }
  selectFloor(start);
  display('home');
  applyLink(link, { fromTag: /\/t\//.test(location.pathname) });
  if (link.kiosk) { state.kiosk = { b: state.map.building.id, f: state.map.floor.id, at: state.fromId }; document.documentElement.classList.add('kiosk'); renderAll(); kioskIdle(); }
  analytics.add('open', { kiosk: !!link.kiosk, tag: !!link.at });
  const b = $('#boot'); b.classList.add('done'); setTimeout(() => { b.hidden = true; }, 380);
  document.documentElement.classList.add('ready');
  return true;
}
async function init() {
  applyDisplay(); fillIcons();
  homeMap = new MapView($('#homeMap'), { points: 'none', label: pname });
  routeMap = new MapView($('#routeMap'), { label: pname, points: 'key', iconFor: c => svgIco(CAT_ICONS[c] || CAT_ICONS.room) });
  mainMap = new MapView($('#mainMap'), { interactive: true, label: pname, pickKey: keyOf, onTap: p => onMapTap(p), onCam: c => $('#mainMap').classList.toggle('show-labels', c.k * BASE >= 16) });
  navMap = new MapView($('#navMap'), { points: 'nodes', label: pname, iconFor: c => svgIco(CAT_ICONS[c] || CAT_ICONS.room) });
  bind();
  await loadConfig();
  const r = await boot();
  // Location: on if already allowed; otherwise asked once on the first visit (like a maps app), so the app can
  // tell when you are at a building with an indoor map.
  if (await locationGranted()) gpsStart();
  else if (!store.get('dalil.locAsked', false) && !state.kiosk) { store.set('dalil.locAsked', true); gpsStart(); }
  return r;
}

window.DALIL_APP = { state, settings, spoken, nav, tracker, analytics, parseLink, buildSteps, routeFor, pointOf, go, page: () => pageNow, config: () => cfg,
  views: () => ({ routeMap, mainMap, navMap, floorMap: mainMap }), outdoor: () => outdoorCtl, homeMap: () => homeCtl, survey: () => sv, camera: () => camGuide, gps: () => ({ ...gps, on: locator.on, state: locator.state }), ready: init() };

if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
