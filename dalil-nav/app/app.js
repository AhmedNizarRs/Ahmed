// DALIL visitor app. No build step, no dependencies.
// Reads dalil-map v1 files (docs/map-format.md): every route is precomputed, so there is no routing engine here.

/* =========================================================================
   Strings (EN / AR). Arabic needs a native-speaker check before launch.
   ========================================================================= */
const STR = {
  en: {
    langShort: 'ع', switchLang: 'التبديل إلى العربية (Switch to Arabic)',
    searchLabel: 'Search places', searchPh: 'Search for a room, place, or service', scan: 'Scan a DALIL tag',
    categories: 'Find the nearest', cat_toilet: 'Restroom', cat_lift: 'Elevator', cat_stairs: 'Stairs', cat_prayer: 'Prayer', cat_accessible: 'Accessible',
    youAreAt: 'You are at', change: 'Change', mapHeading: 'Map preview', compass: 'Compass. The top of the plan is shown as north.',
    fullscreen: 'Show map full screen', exitFullscreen: 'Exit full screen', recenter: 'Recenter map', layers: 'Show place names on the map',
    chooseDest: 'Choose a destination', chooseHint: 'Search above, or pick a category to find the nearest one.',
    eta: 'ETA', distance: 'Distance', start: 'Start Navigation', save: 'Save this place', unsave: 'Remove from saved',
    tab_home: 'Home', tab_map: 'Map', tab_saved: 'Saved', tab_settings: 'Settings', mainNav: 'Main',
    allPlaces: 'All places on this floor', savedEmpty: 'No saved places yet. Tap the heart on a destination to keep it here.',
    language: 'Language', set_voice: 'Spoken directions', set_vibrate: 'Vibrate on turns', set_stepfree: 'Step-free routes',
    set_large: 'Large text', set_contrast: 'High contrast', set_motion: 'Reduce motion', building: 'Building', loadMap: 'Load a map file',
    about: 'DALIL is a supplementary wayfinding aid. Follow building signs and staff directions, and ask staff for help at any time.',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', floorsLabel: 'Floors', floorUp: 'Floor up', floorDown: 'Floor down',
    imAtTag: "I'm at this tag ✓", goingTo: 'Going to', prevStep: 'Previous step', nextStep: 'Next step', repeat: 'Repeat this step',
    simulate: 'Simulate walk', pause: 'Pause', allSteps: 'All steps', endNav: 'End navigation',
    arrived: 'You have arrived', savePlace: 'Save this place', saved: 'Saved', done: 'Done',
    whereAreYou: 'Where are you?', pickTag: 'Choose the DALIL tag you are standing at. Each tag has a raised code and the same name in braille.', cancel: 'Cancel',
    nfcReady: 'Hold the top of your phone against the DALIL tag.', nfcNone: 'This browser cannot read tags. Choose your tag from the list.',
    nfcFail: 'Could not start the tag reader. Choose your tag from the list.', nfcUnknown: 'This tag is not part of a map loaded in the app.',
    dalilTag: 'DALIL tag', results: n => n === 1 ? '1 place found' : `${n} places found`, noResults: 'No places match.',
    stepFreeOn: 'Step-free routes on', stepFreeOff: 'Step-free routes off',
    noStepFreeTitle: 'No step-free route to this place.',
    noStepFreeBody: 'A door or step on the way is too narrow for a wheelchair. Ask staff for help, or turn off Accessible to see the walking route.',
    noRoute: 'No route was found between these two places on this map.', alreadyHere: 'You are already here.',
    noneOfCat: c => `There is no ${c.toLowerCase()} on this floor.`, noneReachable: c => `No ${c.toLowerCase()} can be reached by a step-free route from here.`,
    nearest: (c, n, d) => `Nearest ${c.toLowerCase()}: ${n}, ${d}.`,
    locSet: n => `You are at ${n}.`, confirmed: n => `Confirmed: you are at ${n}.`,
    min: n => `${n} min`, m: n => `${n} m`, forDist: d => `for ${d}`, left: d => `${d} to go`, then: 'Then',
    stepOf: (i, n) => `Step ${i} of ${n}`, remainTime: s => `about ${s}`,
    routeTo: (n, d, t) => `Route to ${n}: ${d}, ${t}.`, navStarted: n => `Navigation to ${n} started.`,
    floorG: 'G', floorName: f => f.name, mapLoaded: n => `Loaded ${n}.`, mapBad: 'This file is not a DALIL map (dalil-map JSON).',
    mapSessionOnly: 'Loaded for this visit only: the file is too large to keep on this phone.',
    planImg: (b, f, n) => `Floor plan of ${b}, ${f}. ${n}`, mapAlt: 'The directions are also listed in text below the map.',
    offline: 'Ready to use offline.',
    cats: { entrance: 'Entrance', exit: 'Exit', reception: 'Reception', lift: 'Elevator', stairs: 'Stairs', ramp: 'Ramp', toilet: 'Restroom', toilet_acc: 'Accessible restroom', prayer: 'Prayer room', wudu: 'Wudu area', baby: 'Baby care', room: 'Room', corridor: 'Corridor', parking: 'Parking' },
  },
  ar: {
    langShort: 'EN', switchLang: 'Switch to English (التبديل إلى الإنجليزية)',
    searchLabel: 'ابحث عن مكان', searchPh: 'ابحث عن غرفة أو مكان أو خدمة', scan: 'امسح نقطة دليل',
    categories: 'ابحث عن الأقرب', cat_toilet: 'دورات المياه', cat_lift: 'المصعد', cat_stairs: 'الدرج', cat_prayer: 'المصلى', cat_accessible: 'سهل الوصول',
    youAreAt: 'موقعك', change: 'تغيير', mapHeading: 'معاينة الخريطة', compass: 'البوصلة. أعلى المخطط يظهر كاتجاه الشمال.',
    fullscreen: 'عرض الخريطة بملء الشاشة', exitFullscreen: 'الخروج من ملء الشاشة', recenter: 'إعادة توسيط الخريطة', layers: 'إظهار أسماء الأماكن على الخريطة',
    chooseDest: 'اختر وجهتك', chooseHint: 'ابحث في الأعلى، أو اختر فئة لتجد أقرب مكان منها.',
    eta: 'الوقت المتوقع', distance: 'المسافة', start: 'ابدأ التوجيه', save: 'احفظ هذا المكان', unsave: 'إزالة من المحفوظة',
    tab_home: 'الرئيسية', tab_map: 'الخريطة', tab_saved: 'المحفوظة', tab_settings: 'الإعدادات', mainNav: 'القائمة الرئيسية',
    allPlaces: 'كل الأماكن في هذا الطابق', savedEmpty: 'لا توجد أماكن محفوظة بعد. اضغط على القلب في أي وجهة لتحفظها هنا.',
    language: 'اللغة', set_voice: 'الإرشاد الصوتي', set_vibrate: 'الاهتزاز عند المنعطفات', set_stepfree: 'مسارات بدون درج',
    set_large: 'نص كبير', set_contrast: 'تباين عالٍ', set_motion: 'تقليل الحركة', building: 'المبنى', loadMap: 'تحميل ملف خريطة',
    about: 'دليل وسيلة مساندة لإيجاد الطريق. اتبع لافتات المبنى وتوجيهات الموظفين، واطلب المساعدة منهم في أي وقت.',
    zoomIn: 'تكبير', zoomOut: 'تصغير', floorsLabel: 'الطوابق', floorUp: 'الطابق الأعلى', floorDown: 'الطابق الأسفل',
    imAtTag: 'أنا عند هذه النقطة ✓', goingTo: 'الوجهة', prevStep: 'الخطوة السابقة', nextStep: 'الخطوة التالية', repeat: 'أعد هذه الخطوة',
    simulate: 'محاكاة المشي', pause: 'إيقاف مؤقت', allSteps: 'كل الخطوات', endNav: 'إنهاء التوجيه',
    arrived: 'لقد وصلت', savePlace: 'احفظ هذا المكان', saved: 'تم الحفظ', done: 'تم',
    whereAreYou: 'أين أنت؟', pickTag: 'اختر نقطة دليل التي تقف عندها. على كل نقطة رمز بارز والاسم نفسه بطريقة برايل.', cancel: 'إلغاء',
    nfcReady: 'قرّب أعلى هاتفك من نقطة دليل.', nfcNone: 'هذا المتصفح لا يقرأ النقاط. اختر نقطتك من القائمة.',
    nfcFail: 'تعذّر تشغيل قارئ النقاط. اختر نقطتك من القائمة.', nfcUnknown: 'هذه النقطة ليست ضمن خريطة محمّلة في التطبيق.',
    dalilTag: 'نقطة دليل', results: n => n === 1 ? 'تم العثور على مكان واحد' : n === 2 ? 'تم العثور على مكانين' : n <= 10 ? `تم العثور على ${n} أماكن` : `تم العثور على ${n} مكاناً`, noResults: 'لا توجد أماكن مطابقة.',
    stepFreeOn: 'تم تشغيل المسارات بدون درج', stepFreeOff: 'تم إيقاف المسارات بدون درج',
    noStepFreeTitle: 'لا يوجد مسار بدون درج إلى هذا المكان.',
    noStepFreeBody: 'في الطريق باب أو درجة لا تناسب الكرسي المتحرك. اطلب المساعدة من الموظفين، أو أوقف خيار «سهل الوصول» لترى مسار المشي.',
    noRoute: 'لم يتم العثور على مسار بين هذين المكانين في هذه الخريطة.', alreadyHere: 'أنت في هذا المكان الآن.',
    noneOfCat: c => `لا يوجد ${c} في هذا الطابق.`, noneReachable: c => `لا يمكن الوصول إلى ${c} بمسار بدون درج من هنا.`,
    nearest: (c, n, d) => `الأقرب (${c}): ${n}، ${d}.`,
    locSet: n => `موقعك الآن: ${n}.`, confirmed: n => `تم التأكيد: أنت عند ${n}.`,
    min: n => n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`, m: n => `${n} م`,
    forDist: d => `لمسافة ${d}`, left: d => `متبقٍ ${d}`, then: 'ثم',
    stepOf: (i, n) => `الخطوة ${i} من ${n}`, remainTime: s => `حوالي ${s}`,
    routeTo: (n, d, t) => `المسار إلى ${n}: ${d}، ${t}.`, navStarted: n => `بدأ التوجيه إلى ${n}.`,
    floorG: 'G', floorName: f => (/^(ground|g)$/i.test(f.id) || /^ground$/i.test(f.name)) ? 'الطابق الأرضي' : f.name,
    mapLoaded: n => `تم تحميل ${n}.`, mapBad: 'هذا الملف ليس خريطة دليل (dalil-map JSON).',
    mapSessionOnly: 'تم التحميل لهذه الزيارة فقط: الملف أكبر من أن يُحفظ على هذا الهاتف.',
    planImg: (b, f, n) => `مخطط ${b}، ${f}. ${n}`, mapAlt: 'الإرشادات مكتوبة أيضاً تحت الخريطة.',
    offline: 'جاهز للاستخدام بدون إنترنت.',
    cats: { entrance: 'مدخل', exit: 'مخرج', reception: 'الاستقبال', lift: 'مصعد', stairs: 'درج', ramp: 'منحدر', toilet: 'دورة مياه', toilet_acc: 'دورة مياه مهيأة', prayer: 'مصلى', wudu: 'مكان الوضوء', baby: 'غرفة رعاية الأطفال', room: 'غرفة', corridor: 'ممر', parking: 'موقف سيارات' },
  },
};

// Chip → point categories. "Accessible" is a mode toggle, not a category.
const CHIP_CATS = { toilet: ['toilet', 'toilet_acc'], lift: ['lift'], stairs: ['stairs', 'ramp'], prayer: ['prayer', 'wudu'] };
// Extra words people type, per category.
const CAT_WORDS = {
  toilet: 'toilet restroom wc bathroom washroom loo دورة مياه حمام', toilet_acc: 'accessible toilet restroom wc دورة مياه حمام مهيأة',
  lift: 'lift elevator مصعد مصاعد', stairs: 'stairs staircase درج سلم', ramp: 'ramp منحدر', prayer: 'prayer mosque masjid musalla مصلى مسجد صلاة',
  wudu: 'wudu ablution وضوء', reception: 'reception desk information استقبال', entrance: 'entrance entry مدخل', exit: 'exit مخرج',
  baby: 'baby nursing رضاعة اطفال', parking: 'parking car موقف', corridor: 'corridor hall ممر', room: 'room غرفة',
};
const CAT_ICONS = {
  toilet: '<circle cx="8" cy="5" r="1.6"/><circle cx="16" cy="5" r="1.6"/><path d="M6 9h4v5H9v6H7v-6H6zM16 8.5l-3 6h2v5.5h2v-5.5h2z"/>',
  lift: '<rect x="5" y="7" width="14" height="13" rx="1.5"/><path d="M12 7v13M8.5 2.5 7 4.5h3zM15.5 4.5 14 2.5h3z"/>',
  stairs: '<path d="M4 20h4v-4h4v-4h4V8h4"/>', prayer: '<path d="M5 20v-8a7 7 0 0 1 14 0v8zM12 5V3M9.5 20v-4a2.5 2.5 0 0 1 5 0v4"/>',
  entrance: '<path d="M14 4h5v16h-5M4 12h11M11 8l4 4-4 4"/>', reception: '<path d="M4 15h16v4H4zM8 15V9a4 4 0 0 1 8 0v6"/>',
  room: '<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r=".8"/>', corridor: '<path d="M4 20 9 4M20 20 15 4M12 7v2M12 12v2M12 17v2"/>',
  node: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', pin: '<path d="M12 21s6-5.5 6-10.5a6 6 0 0 0-12 0C6 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
};
CAT_ICONS.toilet_acc = CAT_ICONS.toilet; CAT_ICONS.ramp = CAT_ICONS.stairs; CAT_ICONS.wudu = CAT_ICONS.prayer; CAT_ICONS.exit = CAT_ICONS.entrance;

const TURN_ICONS = {
  straight: '<path d="M12 21V4M6 10l6-6 6 6"/>',
  right: '<path d="M6 21v-8a4 4 0 0 1 4-4h9M15 5l4 4-4 4"/>',
  left: '<path d="M18 21v-8a4 4 0 0 0-4-4H5M9 5 5 9l4 4"/>',
  'bear-right': '<path d="M8 21v-7l9-9M11 5h6v6"/>',
  'bear-left': '<path d="M16 21v-7L7 5M13 5H7v6"/>',
  around: '<path d="M8 21V10a4 4 0 0 1 8 0v5M12 11l4 4 4-4"/>',
  arrive: '<path d="M12 21s6-5.5 6-10.5a6 6 0 0 0-12 0C6 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
  node: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/>',
  start: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
};
const svgIco = (inner, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${inner}</svg>`;

/* =========================================================================
   Settings and storage (all reads/writes guarded: private mode may throw)
   ========================================================================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const mq = q => window.matchMedia && window.matchMedia(q).matches;
const settings = Object.assign({
  lang: (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en',
  voice: true, vibrate: true, stepFree: false, large: false,
  contrast: mq('(prefers-contrast: more)'), motion: mq('(prefers-reduced-motion: reduce)'),
}, store.get('dalil.settings', {}));
const saveSettings = () => store.set('dalil.settings', settings);
const T = () => STR[settings.lang];
const t = (key, ...a) => { const v = T()[key] ?? STR.en[key] ?? key; return typeof v === 'function' ? v(...a) : v; };

/* =========================================================================
   State
   ========================================================================= */
const state = {
  maps: [],           // all loaded dalil-map objects
  map: null,          // current floor
  fromId: null, toId: null, chip: null,
  saved: store.get('dalil.saved', []),
};
const spoken = [];   // for tests and debugging
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pt = id => state.map?.points.find(p => p.id === id) || null;
const pname = p => p ? (settings.lang === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)) : '';
const pnameOther = p => settings.lang === 'ar' ? p.nameEn : p.nameAr;
const catName = c => T().cats[c] || STR.en.cats[c] || c;
const mode = () => settings.stepFree ? 'chair' : 'walk';
const routeOf = (from, to, m = mode()) => state.map?.routes?.[m]?.[`${from}>${to}`] || null;
const fmtM = d => t('m', Math.max(1, Math.round(d)));
const fmtMin = s => t('min', Math.max(1, Math.round(s / 60)));
const floorShort = f => /^(ground|g)$/i.test(f.id) || /^ground$/i.test(f.name) ? t('floorG') : String(f.name || f.id).slice(0, 3);
const buildings = () => {
  const b = new Map();
  for (const m of state.maps) { if (!b.has(m.building.id)) b.set(m.building.id, { ...m.building, floors: [] }); b.get(m.building.id).floors.push(m); }
  return [...b.values()];
};

/* =========================================================================
   Route steps → positions along the path
   Steps carry text, not geometry, so each "walk N m" leg is placed by its
   distance and scaled so the legs add up to the real path length.
   ========================================================================= */
function cumulative(path) { const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return c; }
function pointAt(path, cum, d) {
  const L = cum[cum.length - 1]; d = Math.max(0, Math.min(L, d));
  let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1, f = (d - cum[i - 1]) / seg;
  return { x: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, y: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f, i };
}
function headingAt(path, cum, d) {   // plan degrees, 0 = plan right, 90 = plan up
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
   Map view: SVG plan inside a CSS-3D camera (perspective + tilt + rotation)
   ========================================================================= */
const BASE = 10; // px per metre in world space
class MapView {
  constructor(el, opts = {}) {
    this.el = el; this.opts = opts;
    this.cam = { x: 0, y: 0, k: 1, rot: 0, tilt: 0, ax: .5, ay: .5 };
    el.innerHTML = '<div class="map-tilt"><div class="map-world"></div></div>';
    this.tiltEl = el.firstChild; this.world = this.tiltEl.firstChild;
    this.markers = [];
    this.fitTarget = null;
    if (opts.interactive) { el.classList.add('interactive'); this.bindGestures(); }
    new ResizeObserver(() => { if (this.fitTarget) this.fit(this.fitTarget, false); else this.apply(); }).observe(el);
  }
  setMap(map) {
    this.map = map;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    for (const w of map.plan.walls) for (const [x, y] of w) grow(x, y);
    for (const p of map.points) grow(p.x, p.y);
    const pad = 3;
    this.b = { minX: minX - pad, maxY: maxY + pad, W: maxX - minX + 2 * pad, H: maxY - minY + 2 * pad };
    const P = ([x, y]) => `${(x - this.b.minX).toFixed(2)} ${(this.b.maxY - y).toFixed(2)}`;
    const d = lines => lines.filter(l => l.length > 1).map(l => 'M' + l.map(P).join('L')).join('');
    const walls = d(map.plan.walls), doors = d(map.plan.doors || []);
    const { W, H } = this.b;
    this.world.innerHTML =
      `<svg width="${W * BASE}" height="${H * BASE}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <rect class="plan-floor" x="${pad - 1}" y="${pad - 1}" width="${W - 2 * pad + 2}" height="${H - 2 * pad + 2}" rx="1.5"/>
        <path class="plan-shadow" d="${walls}"/><path class="plan-doors" d="${doors}"/><path class="plan-walls" d="${walls}"/>
        <g class="route-layer"><path class="route-done" d=""/><path class="route-glow" d=""/><path class="route-main" d=""/><path class="route-flow" d=""/></g>
      </svg>`;
    this.svgRoute = { done: this.world.querySelector('.route-done'), glow: this.world.querySelector('.route-glow'), main: this.world.querySelector('.route-main'), flow: this.world.querySelector('.route-flow') };
    this.markers = []; this.you = null; this.dest = null;
    this.renderPoints();
  }
  px(x, y) { return [(x - this.b.minX) * BASE, (this.b.maxY - y) * BASE]; }
  pathD(path) { return path && path.length > 1 ? 'M' + path.map(([x, y]) => `${(x - this.b.minX).toFixed(2)} ${(this.b.maxY - y).toFixed(2)}`).join('L') : ''; }
  setRoute(path, done) {
    const d = this.pathD(path);
    this.svgRoute.glow.setAttribute('d', d); this.svgRoute.main.setAttribute('d', d); this.svgRoute.flow.setAttribute('d', d);
    this.svgRoute.done.setAttribute('d', this.pathD(done));
  }
  addMarker(cls, html, x, y) {
    const el = document.createElement('div'); el.className = 'mk ' + cls; el.innerHTML = `<div class="mk-inner">${html}</div>`;
    this.world.appendChild(el); const m = { el, x, y }; this.markers.push(m); this.placeMarker(m); return m;
  }
  moveMarker(m, x, y) { m.x = x; m.y = y; this.placeMarker(m); }
  removeMarker(m) { if (!m) return; m.el.remove(); this.markers = this.markers.filter(o => o !== m); }
  placeMarker(m) {
    const [px, py] = this.px(m.x, m.y), c = this.cam;
    // Markers lie on the floor plane, kept screen-up and a constant size. (Upright markers get depth-sorted
    // behind the tilted floor in Chromium, so they stay flat.)
    m.el.style.transform = `translate(${px}px,${py}px) rotate(${-c.rot}deg) scale(${1 / c.k}) translateZ(1px)`;
  }
  renderPoints() {
    for (const m of this.markers.filter(m => m.point)) this.removeMarker(m);
    for (const p of this.map.points) {
      if (this.opts.points === 'nodes' && !p.dalilNode) continue;
      const label = `<span class="pt-dot${p.dalilNode ? ' node' : ''}"></span><span class="pt-label">${esc(pname(p))}</span>`;
      const html = this.opts.interactive ? `<button type="button" data-pick="${esc(p.id)}" aria-label="${esc(pname(p))}">${label}</button>` : label;
      const m = this.addMarker('mk-point', html, p.x, p.y); m.point = p.id;
    }
  }
  setYou(p, headingDeg) {
    if (!p) { this.removeMarker(this.you); this.you = null; return; }
    if (!this.you) this.you = this.addMarker('mk-you', '<div class="you-dot"><svg viewBox="0 0 24 24"><path d="M12 3 20 20 12 15.5 4 20z"/></svg></div>', p.x, p.y);
    else this.moveMarker(this.you, p.x, p.y);
    this.you.heading = headingDeg ?? 90;
    this.orientYou();
  }
  orientYou() { if (this.you) this.you.el.querySelector('svg').style.transform = `rotate(${90 - this.you.heading + this.cam.rot}deg)`; }
  setDest(p) {
    if (!p) { this.removeMarker(this.dest); this.dest = null; return; }
    if (!this.dest) this.dest = this.addMarker('mk-pin', '<svg viewBox="0 0 40 48"><path class="pin-body" d="M20 47S36 30.5 36 18A16 16 0 0 0 4 18c0 12.5 16 29 16 29z"/><circle class="pin-hole" cx="20" cy="18" r="6"/></svg>', p.x, p.y);
    else this.moveMarker(this.dest, p.x, p.y);
  }
  size() { return [this.el.clientWidth || 1, this.el.clientHeight || 1]; }
  // Fit plan coordinates [[x,y],...] into the view.
  fit(target, animate = true) {
    this.fitTarget = target;
    const pts = target.pts.map(([x, y]) => this.px(x, y));
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    const [vw, vh] = this.size(), padX = target.padX ?? 40, padTop = target.padTop ?? 40, padBot = target.padBot ?? 40;
    const k = Math.min((vw - 2 * padX) / Math.max(c - a, 20), (vh - padTop - padBot) / Math.max(d - b, 20), target.maxK ?? 4);
    const cy = (b + d) / 2 - ((padTop - padBot) / 2) / k;
    this.setCam({ x: (a + c) / 2, y: cy, k, rot: 0, tilt: target.tilt ?? 0, ax: .5, ay: .5 }, animate);
  }
  setCam(c, animate) {
    Object.assign(this.cam, c);
    this.el.classList.toggle('anim', !!animate && !document.documentElement.classList.contains('reduce-motion'));
    this.apply();
  }
  apply() {
    const [vw, vh] = this.size(), c = this.cam;
    this.tiltEl.style.transformOrigin = `${c.ax * 100}% ${c.ay * 100}%`;
    this.tiltEl.style.transform = `rotateX(${c.tilt}deg)`;
    this.world.style.transform = `translate(${vw * c.ax}px,${vh * c.ay}px) rotate(${c.rot}deg) scale(${c.k}) translate(${-c.x}px,${-c.y}px)`;
    for (const m of this.markers) this.placeMarker(m);
    this.orientYou();
    this.opts.onCam?.(c);
  }
  bindGestures() {
    const ptrs = new Map(); let last = null;
    this.el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); this.el.setPointerCapture(e.pointerId); this.fitTarget = null; });
    this.el.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) { this.cam.x -= (e.clientX - prev[0]) / this.cam.k; this.cam.y -= (e.clientY - prev[1]) / this.cam.k; }
      else if (ptrs.size === 2) {
        const [p, q] = [...ptrs.values()], dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (last) this.cam.k = Math.max(.05, Math.min(8, this.cam.k * dist / last)); last = dist;
      }
      this.el.classList.remove('anim'); this.apply();
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) last = null; };
    this.el.addEventListener('pointerup', up); this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, false); }, { passive: false });
  }
  zoom(f, animate = true) { this.fitTarget = null; this.setCam({ k: Math.max(.05, Math.min(8, this.cam.k * f)) }, animate); }
}

/* =========================================================================
   Speech, vibration, announcements
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
function announce(text, assertive = false) {
  const el = assertive ? $('#liveAssertive') : $('#live');
  el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30);
}
function buzz(pattern) { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(pattern); } catch { } }
let toastTimer;
function toast(text, ms = 3200) { const el = $('#toast'); el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

/* =========================================================================
   Loading maps
   ========================================================================= */
const isMap = m => m && m.format === 'dalil-map' && Array.isArray(m.points) && m.routes && m.plan && m.building && m.floor;
function addMap(m) {
  const i = state.maps.findIndex(o => o.building.id === m.building.id && o.floor.id === m.floor.id);
  if (i >= 0) state.maps[i] = m; else state.maps.push(m);
}
async function loadBundled() {
  const list = await fetch('maps.json').then(r => r.json());
  const maps = await Promise.all(list.maps.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)));
  for (const m of maps) if (isMap(m)) addMap(m);
  for (const m of store.get('dalil.userMaps', [])) if (isMap(m)) addMap(m);
}
async function loadFile(file) {
  let m; try { m = JSON.parse(await file.text()); } catch { m = null; }
  if (!isMap(m)) { $('#loadMsg').textContent = t('mapBad'); return; }
  addMap(m);
  const user = store.get('dalil.userMaps', []).filter(o => !(o.building.id === m.building.id && o.floor.id === m.floor.id));
  user.push(m);
  const kept = store.set('dalil.userMaps', user);
  $('#loadMsg').textContent = t('mapLoaded', `${m.building.name} · ${t('floorName', m.floor)}`) + (kept ? '' : ' ' + t('mapSessionOnly'));
  selectFloor(m, { keepFrom: false });
  renderSettings();
}

/* =========================================================================
   Home screen
   ========================================================================= */
let homeMap, floorMap, navMap;

function defaultFrom(map) {
  return (map.points.find(p => p.category === 'entrance' && p.dalilNode) || map.points.find(p => p.dalilNode) || map.points[0])?.id || null;
}
function selectFloor(map, { keepFrom = false } = {}) {
  state.map = map;
  if (!keepFrom || !pt(state.fromId)) state.fromId = defaultFrom(map);
  if (!pt(state.toId)) state.toId = null;
  state.chip = null;
  store.set('dalil.last', { b: map.building.id, f: map.floor.id });
  homeMap.setMap(map); floorMap.setMap(map); navMap.setMap(map);
  renderFloorRail(); renderHome(); renderPlaceList(); renderSaved(); renderSettings();
}
function setFrom(id, { say = true, confirm = false } = {}) {
  const p = pt(id); if (!p) return false;
  state.fromId = id;
  if (state.toId === id) state.toId = null;
  renderHome(); renderSearch();
  if (say) { const msg = confirm ? t('confirmed', pname(p)) : t('locSet', pname(p)); announce(msg); toast(msg); }
  return true;
}
function setDest(id, { chip = null, say = true } = {}) {
  if (!pt(id)) return;
  state.toId = id; state.chip = chip;
  closeResults();
  renderHome();
  if (say) {
    const r = routeOf(state.fromId, id), p = pt(id);
    announce(r ? t('routeTo', pname(p), fmtM(r.distance_m), fmtMin(r.seconds)) : pname(p));
  }
}
function renderFloorRail() {
  const rail = $('#floorRail'), b = buildings().find(b => b.id === state.map.building.id);
  const floors = [...b.floors].reverse();
  const cur = floors.indexOf(state.map);
  rail.setAttribute('aria-label', t('floorsLabel'));
  rail.innerHTML =
    `<button class="rail-arrow icon-btn flat" type="button" data-step="-1" aria-label="${esc(t('floorUp'))}" ${cur <= 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></button>` +
    floors.map((f, i) => `<button class="floor-btn" type="button" data-floor="${i}" aria-pressed="${f === state.map}" aria-label="${esc(t('floorName', f.floor))}">${esc(floorShort(f.floor))}</button>`).join('') +
    `<button class="rail-arrow icon-btn flat" type="button" data-step="1" aria-label="${esc(t('floorDown'))}" ${cur >= floors.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>`;
  rail.onclick = e => {
    const fb = e.target.closest('[data-floor]'), st = e.target.closest('[data-step]');
    const idx = fb ? +fb.dataset.floor : st ? cur + +st.dataset.step : -1;
    if (floors[idx] && floors[idx] !== state.map) selectFloor(floors[idx]);
  };
}
function metaLine(map) { return `${map.building.name}  •  ${t('floorName', map.floor)}`; }

function renderHome() {
  const map = state.map, from = pt(state.fromId), to = pt(state.toId);
  $('#fromName').textContent = from ? pname(from) : '—';
  $$('.chip[data-cat]').forEach(c => c.classList.toggle('is-active', c.dataset.cat === state.chip));
  $('#chipAccessible').setAttribute('aria-pressed', String(settings.stepFree));

  const heading = from?.facingDeg ?? 90;
  homeMap.setYou(from, heading);
  homeMap.setDest(to);
  const msg = $('#routeMsg'); msg.className = 'route-msg'; msg.innerHTML = '';
  const fav = $('#btnFav'), banner = $('#homeBanner');
  let route = null;
  if (!to) {
    $('#destName').textContent = t('chooseDest');
    $('#destMeta').textContent = metaLine(map);
    msg.textContent = t('chooseHint');
    fav.hidden = true; $('#routeStats').hidden = true; banner.hidden = true;
  } else {
    $('#destName').textContent = pname(to);
    $('#destMeta').textContent = `${catName(to.category)}  •  ${metaLine(map)}`;
    fav.hidden = false;
    const isSaved = isFav(to.id); fav.setAttribute('aria-pressed', String(isSaved)); fav.setAttribute('aria-label', t(isSaved ? 'unsave' : 'save'));
    route = state.fromId === state.toId ? null : routeOf(state.fromId, state.toId);
    if (state.fromId === state.toId) msg.textContent = t('alreadyHere');
    else if (!route && settings.stepFree) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noStepFreeTitle'))}</strong>${esc(t('noStepFreeBody'))}`; }
    else if (!route) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noRoute'))}</strong>`; }
    $('#routeStats').hidden = !route;
    if (route) {
      $('#statEta').textContent = fmtMin(route.seconds);
      $('#statDist').textContent = fmtM(route.distance_m);
      const { steps } = buildSteps(route), first = steps.find(s => s.kind === 'move' || s.kind === 'node');
      if (first) {
        banner.hidden = false;
        banner.querySelector('.turn-ico').innerHTML = svgIco(TURN_ICONS[first.turn] || TURN_ICONS.straight);
        banner.querySelector('.turn-title').textContent = stepShort(first);
        banner.querySelector('.turn-sub').textContent = first.kind === 'move' ? t('forDist', fmtM(first.d1 - first.d0)) : '';
      } else banner.hidden = true;
    } else banner.hidden = true;
  }
  $('#btnStart').disabled = !route;
  homeMap.setRoute(route?.path || null);
  const img = to && route ? t('routeTo', pname(to), fmtM(route.distance_m), fmtMin(route.seconds)) + ' ' + t('mapAlt') : t('mapAlt');
  $('#homeMap').setAttribute('aria-label', t('planImg', map.building.name, t('floorName', map.floor), img));
  fitHome();
}
function fitHome() {
  const from = pt(state.fromId), to = pt(state.toId), route = to && from && from !== to ? routeOf(from.id, to.id) : null;
  const banner = !$('#homeBanner').hidden, expanded = $('.map-card').classList.contains('expanded');
  const pts = route ? [...route.path] : state.map.plan.walls.flat();
  homeMap.fit({ pts, tilt: route ? 32 : 18, padX: 56, padTop: banner ? 130 : 80, padBot: route ? 70 : 60, maxK: expanded ? 3 : 2.2 });
}

/* ---------- Search ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
function searchPoints(q) {
  const nq = norm(q); if (!nq) return [];
  const words = nq.split(/\s+/);
  const scored = [];
  for (const p of state.map.points) {
    const names = norm(`${p.nameEn} ${p.nameAr}`), cats = norm(`${catName(p.category)} ${STR.en.cats[p.category] || ''} ${STR.ar.cats[p.category] || ''} ${CAT_WORDS[p.category] || ''}`);
    if (!words.every(w => names.includes(w) || cats.includes(w))) continue;
    const starts = norm(pname(p)).startsWith(nq) ? 0 : names.includes(nq) ? 1 : 2;
    const r = p.id === state.fromId ? null : routeOf(state.fromId, p.id);
    scored.push({ p, r, score: starts * 1e6 + (r ? r.distance_m : 9e5) });
  }
  return scored.sort((a, b) => a.score - b.score);
}
function renderSearch() {
  const q = $('#search').value, list = $('#results');
  if (!q.trim()) { closeResults(); return; }
  const res = searchPoints(q);
  list.hidden = false;
  list.innerHTML = res.length ? res.map(({ p, r }) =>
    `<li><button type="button" data-pick="${esc(p.id)}">
      <span class="res-ico">${svgIco(CAT_ICONS[p.category] || CAT_ICONS.pin)}</span>
      <span class="res-main"><span class="res-name">${esc(pname(p))}</span><span class="res-sub">${esc([pnameOther(p), catName(p.category)].filter(Boolean).join(' · '))}</span></span>
      <span class="res-dist">${r ? esc(fmtM(r.distance_m)) : ''}</span></button></li>`).join('')
    : `<li class="res-empty">${esc(t('noResults'))}</li>`;
  $('#resultsStatus').textContent = res.length ? t('results', res.length) : t('noResults');
}
function closeResults() { $('#results').hidden = true; $('#results').innerHTML = ''; }

/* ---------- Category chips ---------- */
function pickNearest(cat) {
  const label = t('cat_' + cat), cands = state.map.points.filter(p => CHIP_CATS[cat].includes(p.category) && p.id !== state.fromId);
  if (!cands.length) { const m = t('noneOfCat', label); toast(m); announce(m); return; }
  let best = null;
  for (const p of cands) { const r = routeOf(state.fromId, p.id); if (r && (!best || r.distance_m < best.r.distance_m)) best = { p, r }; }
  if (!best) { const m = settings.stepFree ? t('noneReachable', label) : t('noRoute'); toast(m); announce(m); return; }
  setDest(best.p.id, { chip: cat, say: false });
  const m = t('nearest', label, pname(best.p), fmtM(best.r.distance_m)); announce(m); toast(m);
}
function setStepFree(on) {
  settings.stepFree = on; saveSettings();
  $('#setStepFree').checked = on;
  renderHome(); renderSearch();
  announce(t(on ? 'stepFreeOn' : 'stepFreeOff'));
}

/* ---------- Saved ---------- */
const favKey = id => `${state.map.building.id}/${state.map.floor.id}/${id}`;
const isFav = id => state.saved.includes(favKey(id));
function toggleFav(id, force) {
  const k = favKey(id), has = state.saved.includes(k), want = force ?? !has;
  if (want && !has) state.saved.push(k); if (!want && has) state.saved = state.saved.filter(x => x !== k);
  store.set('dalil.saved', state.saved); renderSaved();
  if (state.toId === id) renderHome();
  return want;
}
function renderSaved() {
  const items = state.saved.map(k => { const [b, f, id] = k.split('/'); const m = state.maps.find(m => m.building.id === b && m.floor.id === f); const p = m?.points.find(p => p.id === id); return p ? { k, m, p } : null; }).filter(Boolean);
  $('#savedEmpty').hidden = items.length > 0;
  $('#savedList').innerHTML = items.map(({ k, m, p }) => {
    const n = settings.lang === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn;
    return `<li><button class="place" type="button" data-saved="${esc(k)}"><span class="res-ico">${svgIco(CAT_ICONS[p.category] || CAT_ICONS.pin)}</span><span class="res-main"><span class="res-name">${esc(n)}</span><span class="res-sub">${esc(metaLine(m))}</span></span></button>
      <button class="icon-btn flat" type="button" data-unsave="${esc(k)}" aria-label="${esc(t('unsave'))}: ${esc(n)}">${svgIco('<path d="M6 6l12 12M18 6 6 18"/>', 'ico')}</button></li>`;
  }).join('');
}

/* ---------- Map tab ---------- */
function renderPlaceList() {
  const map = state.map;
  $('#mapSub').textContent = metaLine(map);
  $('#floorMap').setAttribute('aria-label', t('planImg', map.building.name, t('floorName', map.floor), ''));
  $('#placeList').innerHTML = map.points.map(p => {
    const r = p.id === state.fromId ? null : routeOf(state.fromId, p.id);
    return `<li><button class="place" type="button" data-pick="${esc(p.id)}"><span class="res-ico">${svgIco(CAT_ICONS[p.category] || CAT_ICONS.pin)}</span><span class="res-main"><span class="res-name">${esc(pname(p))}</span><span class="res-sub">${esc([catName(p.category), p.dalilNode ? t('dalilTag') : ''].filter(Boolean).join(' · '))}</span></span><span class="res-dist">${r ? esc(fmtM(r.distance_m)) : ''}</span></button></li>`;
  }).join('');
}

/* ---------- Settings ---------- */
function renderSettings() {
  $$('input[name="lang"]').forEach(r => { r.checked = r.value === settings.lang; });
  $('#setVoice').checked = settings.voice; $('#setVibrate').checked = settings.vibrate; $('#setStepFree').checked = settings.stepFree;
  $('#setLarge').checked = settings.large; $('#setContrast').checked = settings.contrast; $('#setMotion').checked = settings.motion;
  const sel = $('#setBuilding');
  sel.innerHTML = state.maps.map((m, i) => `<option value="${i}" ${m === state.map ? 'selected' : ''}>${esc(metaLine(m))}</option>`).join('');
}
function applyDisplay() {
  const h = document.documentElement;
  h.lang = settings.lang; h.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  h.classList.toggle('large', settings.large); h.classList.toggle('contrast', settings.contrast); h.classList.toggle('reduce-motion', settings.motion);
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('meta[name="theme-color"]').content = settings.contrast ? '#000000' : '#0B0C0E';
}
function rerenderAll() {
  applyDisplay();
  if (!state.map) return;
  homeMap.renderPoints(); floorMap.renderPoints(); navMap.renderPoints();
  renderFloorRail(); renderHome(); renderSearch(); renderPlaceList(); renderSaved(); renderSettings();
  if (nav.active) renderNavStep(false);
}
function setLang(l) { settings.lang = l; saveSettings(); rerenderAll(); }

/* ---------- Tabs ---------- */
function showScreen(name) {
  for (const s of ['home', 'map', 'saved', 'settings']) $('#screen-' + s).hidden = s !== name;
  $$('.tab').forEach(b => { const on = b.dataset.screen === name; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (name === 'map') requestAnimationFrame(() => floorMap.fit({ pts: state.map.plan.walls.flat(), padX: 20, padTop: 20, padBot: 20, maxK: 3 }, false));
  if (name === 'home') requestAnimationFrame(fitHome);
  window.scrollTo(0, 0);
}

/* =========================================================================
   Navigation mode
   ========================================================================= */
const nav = { active: false, route: null, steps: [], cum: [], L: 0, i: 0, pos: 0, sim: false, dwell: 0, raf: 0, last: 0, rot: 0, toId: null };

function startNav() {
  const route = routeOf(state.fromId, state.toId); if (!route) return;
  const { steps, cum, L } = buildSteps(route);
  Object.assign(nav, { active: true, route, steps, cum, L, i: 0, pos: 0, sim: false, dwell: 0, toId: state.toId, rot: null });
  $('#app').inert = true; $('#nav').hidden = false;
  navMap.setDest(pt(state.toId));
  $('#navDest').textContent = pname(pt(state.toId));
  renderStepList();
  goStep(0, { focus: true, intro: t('navStarted', pname(pt(state.toId))) });  // nav is visible now, so the map has its size
}
function endNav() {
  stopSim();
  nav.active = false;
  try { speechSynthesis?.cancel(); } catch { }
  $('#nav').hidden = true; $('#arrived').hidden = true; $('#app').inert = false;
  renderHome();
  $('#btnStart').focus();
}
function renderStepList() {
  $('#stepList').innerHTML = nav.steps.map((s, i) => `<li data-i="${i}" class="${i === nav.i ? 'is-current' : i < nav.i ? 'is-done' : ''}" ${i === nav.i ? 'aria-current="step"' : ''}>${esc(stepText(s))}</li>`).join('');
}
function goStep(i, { focus = false, speakIt = true, intro = '' } = {}) {
  i = Math.max(0, Math.min(nav.steps.length - 1, i));
  const prev = nav.i; nav.i = i; nav.dwell = 0;
  const s = nav.steps[i];
  nav.pos = s.d0;
  renderNavStep(true);
  if (speakIt) {
    const text = stepText(s);
    announce(`${intro ? intro + ' ' : ''}${t('stepOf', i + 1, nav.steps.length)}. ${text}`);
    speak(text);
    if (i !== prev || i === 0) {
      if (s.kind === 'move' && s.turn !== 'straight') buzz(s.turn === 'around' ? [80, 60, 80, 60, 80] : [70, 50, 70]);
      else if (s.kind === 'node') buzz([200]);
      else if (s.kind === 'arrive') buzz([100, 60, 100, 60, 260]);
    }
  }
  if (focus) $('#navStepText').focus();
  if (s.kind === 'arrive') { stopSim(); setTimeout(showArrival, 700); }
}
function renderNavStep(updateList) {
  const s = nav.steps[nav.i];
  $('#navIco').innerHTML = svgIco(TURN_ICONS[s.turn] || TURN_ICONS.straight);
  $('#navStepNum').textContent = t('stepOf', nav.i + 1, nav.steps.length);
  $('#navStepText').textContent = stepText(s);
  $('#btnTag').hidden = s.kind !== 'node';
  $('#btnPrev').disabled = nav.i === 0; $('#btnNext').disabled = nav.i >= nav.steps.length - 1;
  $('#navDest').textContent = pname(pt(nav.toId));
  if (updateList) renderStepList(); else { renderStepList(); }
  $('#navMap').setAttribute('aria-label', t('mapAlt'));
  updateNavPos(true);
}
function updateNavPos(animate) {
  const s = nav.steps[nav.i], { path } = nav.route;
  const p = pointAt(path, nav.cum, nav.pos);
  // Sub-line: distance left on this leg, then a preview of the next step.
  const next = nav.steps[nav.i + 1];
  let sub = '';
  if (s.kind === 'move') sub = t('left', fmtM(s.d1 - nav.pos));
  if (next && s.kind !== 'arrive') sub += (sub ? '  ·  ' : '') + `${t('then')}: ${stepShort(next)}`;
  $('#navStepSub').textContent = sub;
  const remain = Math.max(0, nav.L - nav.pos);
  $('#navRemain').textContent = fmtM(remain);
  $('#navRemainTime').textContent = t('remainTime', fmtMin(nav.route.seconds * remain / (nav.L || 1)));
  // Done / remaining route.
  const done = path.slice(0, p.i).concat([[p.x, p.y]]), rest = [[p.x, p.y]].concat(path.slice(p.i));
  navMap.setRoute(rest, done);
  // Heading up. For start and node steps, look along the next leg.
  const h = headingAt(path, nav.cum, nav.pos + (s.kind === 'move' ? 0 : 0.01));
  const [px, py] = navMap.px(p.x, p.y);
  let rot = -90 + h;  // screen rotation that puts the heading at the top
  if (nav.rot != null) { while (rot - nav.rot > 180) rot -= 360; while (rot - nav.rot < -180) rot += 360; }
  nav.rot = rot;
  const [vw] = navMap.size();
  navMap.setCam({ x: px, y: py, k: Math.max(.6, Math.min(3.2, vw / (24 * BASE))), rot, tilt: 52, ax: .5, ay: .58 }, animate);
  navMap.setYou({ x: p.x, y: p.y }, h);
}
function confirmTag() {
  const s = nav.steps[nav.i]; if (s.kind !== 'node') return;
  setFrom(s.node, { say: true, confirm: true });
  buzz([40]);
  goStep(nav.i + 1);
}
// Simulated walk for demos: ~3 m/s, short pauses on start and tag steps.
function toggleSim() { nav.sim ? stopSim() : startSim(); }
function startSim() {
  if (nav.steps[nav.i].kind === 'arrive') goStep(0);
  nav.sim = true; nav.last = performance.now();
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'true'); b.querySelector('span').textContent = t('pause');
  const tick = now => {
    if (!nav.sim) return;
    const dt = Math.min(.1, (now - nav.last) / 1000); nav.last = now;
    const s = nav.steps[nav.i];
    if (s.kind === 'move') {
      nav.pos = Math.min(s.d1, nav.pos + 3 * dt);
      updateNavPos(false);
      if (nav.pos >= s.d1 - 1e-6) goStep(nav.i + 1);
    } else if (s.kind !== 'arrive') {
      nav.dwell += dt;
      if (nav.dwell > 1.6) { if (s.kind === 'node') setFrom(s.node, { say: false }); goStep(nav.i + 1); }
    }
    nav.raf = requestAnimationFrame(tick);
  };
  nav.raf = requestAnimationFrame(tick);
}
function stopSim() {
  nav.sim = false; cancelAnimationFrame(nav.raf);
  const b = $('#btnSim'); b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = t('simulate');
}
function showArrival() {
  if (!nav.active) return;
  const to = pt(nav.toId);
  $('#arrivedName').textContent = pname(to);
  $('#arrivedStats').textContent = `${fmtM(nav.route.distance_m)} · ${fmtMin(nav.route.seconds)}`;
  $('#btnArrivedSave').textContent = isFav(nav.toId) ? t('saved') : t('savePlace');
  $('#arrived').hidden = false; $('#nav').inert = true;
  $('#arrivedTitle').focus();
}
function finishArrival() {
  $('#nav').inert = false;
  if (pt(nav.toId)) { state.fromId = nav.toId; state.toId = null; state.chip = null; }
  endNav();
}

/* =========================================================================
   Deep links and DALIL tags
   #at-P013 · #at-P001&to-P007 · #b=<building>&f=<floor>&at-P001
   /t/<building>/<floor>/<point> (NFC URL) · ?t=<building>/<floor>/<point>
   ========================================================================= */
function parseLink(href) {
  const out = {};
  let u; try { u = new URL(href, location.href); } catch { return out; }
  const tag = (s) => { const m = s.match(/(?:^|\/)t\/([^/]+)\/([^/]+)\/([^/?#]+)/); if (m) { out.b = decodeURIComponent(m[1]); out.f = decodeURIComponent(m[2]); out.at = decodeURIComponent(m[3]); } };
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
  } else if (link.at && !map.points.some(p => p.id === link.at)) {
    map = state.maps.find(m => m.points.some(p => p.id === link.at)) || map;
  }
  if (map !== state.map) selectFloor(map);
  if (link.at) setFrom(link.at, { confirm: fromTag });
  if (link.to) setDest(link.to);
  return true;
}
async function openTagPicker() {
  const dlg = $('#dlgTag'), status = $('#nfcStatus');
  const pts = [...state.map.points].sort((a, b) => (b.dalilNode - a.dalilNode));
  $('#tagList').innerHTML = pts.map(p => `<li><button class="place" type="button" value="${esc(p.id)}" data-tag="${esc(p.id)}"><span class="res-ico">${svgIco(p.dalilNode ? CAT_ICONS.node : (CAT_ICONS[p.category] || CAT_ICONS.pin))}</span><span class="res-main"><span class="res-name">${esc(pname(p))}</span><span class="res-sub">${esc(p.dalilNode ? `${t('dalilTag')} · ${p.id}` : catName(p.category))}</span></span></button></li>`).join('');
  status.textContent = 'NDEFReader' in window ? t('nfcReady') : t('nfcNone');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  if ('NDEFReader' in window) {
    const ctl = new AbortController();
    dlg.addEventListener('close', () => ctl.abort(), { once: true });
    try {
      const reader = new window.NDEFReader();
      await reader.scan({ signal: ctl.signal });
      reader.onreading = ev => {
        const dec = new TextDecoder();
        for (const rec of ev.message.records) {
          if (rec.recordType === 'url' || rec.recordType === 'absolute-url' || rec.recordType === 'text') {
            const link = parseLink(dec.decode(rec.data));
            if (link.at) { dlg.close(); applyLink(link, { fromTag: true }); buzz([40]); return; }
          }
        }
        status.textContent = t('nfcUnknown');
      };
    } catch { status.textContent = t('nfcFail'); }
  }
}

/* =========================================================================
   Wiring
   ========================================================================= */
function bind() {
  $('#btnLang').onclick = () => setLang(settings.lang === 'ar' ? 'en' : 'ar');
  const search = $('#search');
  search.addEventListener('input', renderSearch);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const b = $('#results button[data-pick]'); if (b) { e.preventDefault(); setDest(b.dataset.pick); search.value = ''; } }
    else if (e.key === 'ArrowDown') { const b = $('#results button'); if (b) { e.preventDefault(); b.focus(); } }
    else if (e.key === 'Escape') { search.value = ''; closeResults(); }
  });
  $('#results').addEventListener('keydown', e => {
    const items = $$('#results button'), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : search).focus(); }
    if (e.key === 'Escape') { search.value = ''; closeResults(); search.focus(); }
  });
  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      setDest(pick.dataset.pick); $('#search').value = '';
      if ($('#screen-home').hidden) showScreen('home');
      return;
    }
    const sv = e.target.closest('[data-saved]');
    if (sv) { const [b, f, id] = sv.dataset.saved.split('/'); const m = state.maps.find(m => m.building.id === b && m.floor.id === f); if (m && m !== state.map) selectFloor(m); setDest(id); showScreen('home'); return; }
    const us = e.target.closest('[data-unsave]');
    if (us) { state.saved = state.saved.filter(k => k !== us.dataset.unsave); store.set('dalil.saved', state.saved); renderSaved(); if (state.toId) renderHome(); return; }
    if (!e.target.closest('.search-wrap')) closeResults();
  });
  $$('.chip[data-cat]').forEach(c => { c.onclick = () => pickNearest(c.dataset.cat); });
  $('#chipAccessible').onclick = () => setStepFree(!settings.stepFree);
  $('#btnScan').onclick = openTagPicker;
  $('#btnFrom').onclick = openTagPicker;
  $('#tagList').addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) { e.preventDefault(); $('#dlgTag').close(); setFrom(b.dataset.tag); } });
  $('#btnFav').onclick = () => { if (state.toId) { const on = toggleFav(state.toId); announce(t(on ? 'saved' : 'unsave')); } };
  $('#btnStart').onclick = startNav;
  $('#btnRecenter').onclick = fitHome;
  $('#btnCompass').onclick = fitHome;
  const card = $('#screen-home .map-card');
  const setFull = on => {
    card.classList.toggle('expanded', on);
    $('#btnFullscreen').dataset.i18nAria = on ? 'exitFullscreen' : 'fullscreen';
    $('#btnFullscreen').setAttribute('aria-label', t(on ? 'exitFullscreen' : 'fullscreen'));
    requestAnimationFrame(fitHome);
  };
  $('#btnFullscreen').onclick = () => setFull(!card.classList.contains('expanded'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && card.classList.contains('expanded')) setFull(false); });
  $('#btnLayers').onclick = () => { const on = !$('#homeMap').classList.contains('show-labels'); $('#homeMap').classList.toggle('show-labels', on); $('#btnLayers').setAttribute('aria-pressed', String(on)); };
  $$('.tab').forEach(b => { b.onclick = () => showScreen(b.dataset.screen); });
  $('#btnZoomIn').onclick = () => floorMap.zoom(1.3); $('#btnZoomOut').onclick = () => floorMap.zoom(1 / 1.3);

  // Settings
  $$('input[name="lang"]').forEach(r => r.addEventListener('change', () => setLang(r.value)));
  const toggle = (id, key, after) => $(id).addEventListener('change', e => { settings[key] = e.target.checked; saveSettings(); after?.(); });
  toggle('#setVoice', 'voice', () => { if (!settings.voice) try { speechSynthesis.cancel(); } catch { } });
  toggle('#setVibrate', 'vibrate');
  $('#setStepFree').addEventListener('change', e => setStepFree(e.target.checked));
  toggle('#setLarge', 'large', rerenderAll); toggle('#setContrast', 'contrast', rerenderAll); toggle('#setMotion', 'motion', rerenderAll);
  $('#setBuilding').addEventListener('change', e => { const m = state.maps[+e.target.value]; if (m) selectFloor(m); });
  $('#fileMap').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });

  // Navigation
  $('#btnNext').onclick = () => goStep(nav.i + 1);
  $('#btnPrev').onclick = () => goStep(nav.i - 1);
  $('#btnRepeat').onclick = () => { const s = nav.steps[nav.i]; announce(stepText(s)); speak(stepText(s)); };
  $('#btnSim').onclick = toggleSim;
  $('#btnTag').onclick = confirmTag;
  $('#btnEndNav').onclick = endNav;
  $('#btnArrivedDone').onclick = finishArrival;
  $('#btnArrivedSave').onclick = () => { toggleFav(nav.toId, true); $('#btnArrivedSave').textContent = t('saved'); };
  document.addEventListener('keydown', e => {
    if (!nav.active || !$('#arrived').hidden || e.target.closest('input,select,textarea')) return;
    if (e.key === 'Escape') endNav();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const fwd = (e.key === 'ArrowRight') !== (settings.lang === 'ar'); goStep(nav.i + (fwd ? 1 : -1)); }
  });
  window.addEventListener('hashchange', () => applyLink(parseLink(location.href)));
}

async function init() {
  applyDisplay();
  homeMap = new MapView($('#homeMap'), {});
  floorMap = new MapView($('#floorMap'), { interactive: true });
  floorMap.el.classList.add('show-labels');
  navMap = new MapView($('#navMap'), { points: 'nodes', onCam: c => { $('#btnCompass svg').style.transform = `rotate(${c.rot}deg)`; } });
  homeMap.opts.onCam = c => { $('#btnCompass svg').style.transform = `rotate(${c.rot}deg)`; };
  bind();
  await loadBundled();
  if (!state.maps.length) { $('#destName').textContent = t('mapBad'); return; }
  const last = store.get('dalil.last', null);
  const link = parseLink(location.href);
  const start = (link.b && state.maps.find(m => m.building.id === link.b && (!link.f || m.floor.id === link.f)))
    || (last && state.maps.find(m => m.building.id === last.b && m.floor.id === last.f)) || state.maps[0];
  selectFloor(start);
  applyLink(link, { fromTag: /\/t\//.test(location.pathname) });
  document.documentElement.classList.add('ready');
}

window.DALIL_APP = { state, settings, spoken, nav, parseLink, buildSteps, ready: init() };

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
