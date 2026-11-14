// DALIL visitor app. No build step, no dependencies (QR codes: vendor/qrcode.js, MIT).
import { Router } from './router.js';
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
    floorG: 'G', floorName: f => f.name,
    liftTo: (up, f, n) => `Take the lift ${up ? 'up' : 'down'} to ${f}. Step out at ${n}.`, stairsTo: (up, f) => `Take the stairs ${up ? 'up' : 'down'} to ${f}.`,
    viaLift: f => `By lift to ${f}`, viaStairs: f => `By stairs to ${f}`,
    pinName: 'Dropped pin', mySpot: 'My spot', pinHelp: 'Tap the map to choose any spot, for example where you parked.', pinGo: 'Directions here', pinSave: 'Save as my spot',
    spotSaved: 'Saved as your spot. Find it in Saved, or search “my spot”.', pinOutside: 'Choose a spot inside the building.', pinAt: f => `Spot on ${f}`,
    share: 'Share route', shareTitle: 'Share these directions', shareHint: 'Scan with a phone camera, or send the link. It opens with the same start and destination.',
    copy: 'Copy link', copied: 'Link copied.', shareNative: 'Share…', close: 'Close', kioskQR: 'Scan to take these directions on your phone',
    closureNote: 'Avoids a temporary closure.', kioskReset: 'Starting over for the next visitor.', mapLoaded: n => `Loaded ${n}.`, mapBad: 'This file is not a DALIL map (dalil-map JSON).',
    mapSessionOnly: 'Loaded for this visit only: the file is too large to keep on this phone.',
    planImg: (b, f, n) => `Floor plan of ${b}, ${f}. ${n}`, mapAlt: 'The directions are also listed in text below the map.',
    offline: 'Ready to use offline.',
    cats: { entrance: 'Entrance', exit: 'Exit', reception: 'Reception', lift: 'Elevator', stairs: 'Stairs', ramp: 'Ramp', toilet: 'Restroom', toilet_acc: 'Accessible restroom', prayer: 'Prayer room', wudu: 'Wudu area', baby: 'Baby care', cafe: 'Café', room: 'Room', corridor: 'Corridor', parking: 'Parking', pin: 'Pin' },
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
    floorG: 'G', floorName: f => (/^(ground|g)$/i.test(f.id) || /^ground$/i.test(f.name)) ? 'الطابق الأرضي' : /(\d+)/.test(f.name || '') ? `الطابق ${f.name.match(/(\d+)/)[1]}` : f.name,
    liftTo: (up, f, n) => `استقل المصعد ${up ? 'صعوداً' : 'نزولاً'} إلى ${f}. اخرج عند ${n}.`, stairsTo: (up, f) => `${up ? 'اصعد' : 'انزل'} الدرج إلى ${f}.`,
    viaLift: f => `بالمصعد إلى ${f}`, viaStairs: f => `بالدرج إلى ${f}`,
    pinName: 'نقطة على الخريطة', mySpot: 'مكاني', pinHelp: 'اضغط على الخريطة لاختيار أي مكان، مثل مكان سيارتك.', pinGo: 'الاتجاهات إلى هنا', pinSave: 'احفظه كمكاني',
    spotSaved: 'تم الحفظ كمكانك. ستجده في المحفوظة، أو ابحث عن «مكاني».', pinOutside: 'اختر مكاناً داخل المبنى.', pinAt: f => `نقطة في ${f}`,
    share: 'مشاركة المسار', shareTitle: 'شارك هذه الإرشادات', shareHint: 'امسح الرمز بكاميرا الهاتف أو أرسل الرابط. يفتح بنقطة البداية والوجهة نفسيهما.',
    copy: 'نسخ الرابط', copied: 'تم نسخ الرابط.', shareNative: 'مشاركة…', close: 'إغلاق', kioskQR: 'امسح الرمز لتأخذ الإرشادات على هاتفك',
    closureNote: 'يتجنب إغلاقاً مؤقتاً.', kioskReset: 'البدء من جديد للزائر التالي.',
    mapLoaded: n => `تم تحميل ${n}.`, mapBad: 'هذا الملف ليس خريطة دليل (dalil-map JSON).',
    mapSessionOnly: 'تم التحميل لهذه الزيارة فقط: الملف أكبر من أن يُحفظ على هذا الهاتف.',
    planImg: (b, f, n) => `مخطط ${b}، ${f}. ${n}`, mapAlt: 'الإرشادات مكتوبة أيضاً تحت الخريطة.',
    offline: 'جاهز للاستخدام بدون إنترنت.',
    cats: { entrance: 'مدخل', exit: 'مخرج', reception: 'الاستقبال', lift: 'مصعد', stairs: 'درج', ramp: 'منحدر', toilet: 'دورة مياه', toilet_acc: 'دورة مياه مهيأة', prayer: 'مصلى', wudu: 'مكان الوضوء', baby: 'غرفة رعاية الأطفال', cafe: 'مقهى', room: 'غرفة', corridor: 'ممر', parking: 'موقف سيارات', pin: 'نقطة' },
  },
};

// Chip → point categories. "Accessible" is a mode toggle, not a category.
const CHIP_CATS = { toilet: ['toilet', 'toilet_acc'], lift: ['lift'], stairs: ['stairs', 'ramp'], prayer: ['prayer', 'wudu'] };
// Extra words people type, per category.
const CAT_WORDS = {
  toilet: 'toilet restroom wc bathroom washroom loo دورة مياه حمام', toilet_acc: 'accessible toilet restroom wc دورة مياه حمام مهيأة',
  lift: 'lift elevator مصعد مصاعد', stairs: 'stairs staircase درج سلم', ramp: 'ramp منحدر', prayer: 'prayer mosque masjid musalla مصلى مسجد صلاة',
  wudu: 'wudu ablution وضوء', reception: 'reception desk information استقبال', entrance: 'entrance entry مدخل', exit: 'exit مخرج',
  baby: 'baby nursing lactation رضاعة اطفال', cafe: 'cafe café coffee food مقهى قهوة كافيه', parking: 'parking car موقف', corridor: 'corridor hall ممر', room: 'room غرفة',
};
const CAT_ICONS = {
  toilet: '<circle cx="8" cy="5" r="1.6"/><circle cx="16" cy="5" r="1.6"/><path d="M6 9h4v5H9v6H7v-6H6zM16 8.5l-3 6h2v5.5h2v-5.5h2z"/>',
  lift: '<rect x="5" y="7" width="14" height="13" rx="1.5"/><path d="M12 7v13M8.5 2.5 7 4.5h3zM15.5 4.5 14 2.5h3z"/>',
  stairs: '<path d="M4 20h4v-4h4v-4h4V8h4"/>', prayer: '<path d="M5 20v-8a7 7 0 0 1 14 0v8zM12 5V3M9.5 20v-4a2.5 2.5 0 0 1 5 0v4"/>',
  entrance: '<path d="M14 4h5v16h-5M4 12h11M11 8l4 4-4 4"/>', reception: '<path d="M4 15h16v4H4zM8 15V9a4 4 0 0 1 8 0v6"/>',
  room: '<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r=".8"/>', corridor: '<path d="M4 20 9 4M20 20 15 4M12 7v2M12 12v2M12 17v2"/>',
  node: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', pin: '<path d="M12 21s6-5.5 6-10.5a6 6 0 0 0-12 0C6 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
};
CAT_ICONS.cafe = '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5c-.6 1 .6 2 0 3M12 2.5c-.6 1 .6 2 0 3"/>';
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
  lift: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 3v18M8.5 9.5 10 7.5l1.5 2M12.5 14.5l1.5 2 1.5-2"/>',
  stairs: '<path d="M3 20h5v-4h4v-4h4V8h5"/>',
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
  fromId: null, toKey: null, chip: null,   // toKey = "<floorId>|<pointId>" within the current building
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
// Routes: stored ones (v1 files) when they exist, otherwise worked out on the phone from map.nav (v2 files).
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
// Quick distance for lists (grid distance on v2 maps).
function distFor(map, A, B, m = mode()) {
  if (!A || !B || A.id === B.id) return null;
  if (!A.virtual && !B.virtual && !(map.closures || []).length && hasStored(map, m)) return map.routes[m][`${A.id}>${B.id}`]?.distance_m ?? null;
  return routerOf(map)?.distance(m, A, B) ?? null;
}
const routeOf = (from, to, m = mode(), map = state.map) => routeFor(map, pointOf(map, from), pointOf(map, to), m);
// Virtual places: "@spot" (the visitor's saved spot) and "@x,y" (a dropped pin).
function pointOf(map, id) {
  if (!map || !id) return null;
  if (id === '@spot') { const sp = store.get('dalil.spot', null); return sp && sp.b === map.building.id && sp.f === map.floor.id ? { id, virtual: true, nameEn: STR.en.mySpot, nameAr: STR.ar.mySpot, category: 'pin', x: sp.x, y: sp.y, facingDeg: 90 } : null; }
  if (id[0] === '@') { const [x, y] = id.slice(1).split(',').map(Number); return isFinite(x) && isFinite(y) ? { id, virtual: true, nameEn: STR.en.pinName, nameAr: STR.ar.pinName, category: 'pin', x, y, facingDeg: 90 } : null; }
  return map.points.find(q => q.id === id) || null;
}
// Floors of the current building, in the order the maps were listed (bottom to top).
const bFloors = () => state.map ? state.maps.filter(m => m.building.id === state.map.building.id) : [];
const mapByFloor = fid => bFloors().find(m => m.floor.id === fid) || null;
const keyOf = (m, p) => `${m.floor.id}|${p.id}`;
function resolve(key) { if (!key) return null; const [f, id] = key.split('|'); const m = mapByFloor(f); const p = pointOf(m, id); return p ? { m, p, key } : null; }
const destRef = () => resolve(state.toKey);
const stay = P => ({ distance_m: 0, seconds: 0, path: [[P.x, P.y], [P.x, P.y]], steps: [{ en: `Start at ${P.nameEn}.`, ar: `ابدأ من ${P.nameAr || P.nameEn}.` }, { en: `You have arrived at ${P.nameEn}.`, ar: `لقد وصلت إلى ${P.nameAr || P.nameEn}.` }] });
// A route plan: one leg on the same floor, or two legs joined by a lift or stairs (points sharing a "link" code).
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
// All steps of a plan, each tagged with its leg and its distance range on that leg's path.
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
        <path class="plan-closure" d="${d((map.closures || []).map(c => [c.a, c.b]))}"/>
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
      const html = this.opts.interactive ? `<button type="button" data-pick="${esc(keyOf(this.map, p))}" aria-label="${esc(pname(p))}">${label}</button>` : label;
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
  // Plan metres → screen (flat, unrotated view), the inverse of screenToPlan.
  planToScreen(x, y) {
    const r = this.el.getBoundingClientRect(), c = this.cam, [vw, vh] = this.size(), [wx, wy] = this.px(x, y);
    return { x: r.left + vw * c.ax + (wx - c.x) * c.k, y: r.top + vh * c.ay + (wy - c.y) * c.k };
  }
  // Screen → plan metres (valid for the flat, unrotated Map tab view).
  screenToPlan(cx, cy) {
    const r = this.el.getBoundingClientRect(), c = this.cam, [vw, vh] = this.size();
    const wx = (cx - r.left - vw * c.ax) / c.k + c.x, wy = (cy - r.top - vh * c.ay) / c.k + c.y;
    return { x: wx / BASE + this.b.minX, y: this.b.maxY - wy / BASE };
  }
  bindGestures() {
    const ptrs = new Map(); let last = null, start = null, moved = false;
    this.el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); this.el.setPointerCapture(e.pointerId); this.fitTarget = null; if (ptrs.size === 1) { start = [e.clientX, e.clientY]; moved = false; } else moved = true; });
    this.el.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) moved = true;
      if (!moved) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) { this.cam.x -= (e.clientX - prev[0]) / this.cam.k; this.cam.y -= (e.clientY - prev[1]) / this.cam.k; }
      else if (ptrs.size === 2) {
        const [p, q] = [...ptrs.values()], dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (last) this.cam.k = Math.max(.05, Math.min(8, this.cam.k * dist / last)); last = dist;
      }
      this.el.classList.remove('anim'); this.apply();
    });
    const up = e => {
      const tap = ptrs.has(e.pointerId) && ptrs.size === 1 && !moved && e.type === 'pointerup';
      ptrs.delete(e.pointerId); if (ptrs.size < 2) last = null;
      if (tap && this.opts.onTap) this.opts.onTap(this.screenToPlan(e.clientX, e.clientY));
    };
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
const isMap = m => m && m.format === 'dalil-map' && Array.isArray(m.points) && (m.routes || m.nav) && m.plan && m.building && m.floor;
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
  if (!resolve(state.toKey)) state.toKey = null;
  state.chip = null;
  store.set('dalil.last', { b: map.building.id, f: map.floor.id });
  homeMap.setMap(map); floorMap.setMap(map); navMap.setMap(map);
  renderFloorRail(); renderHome(); renderPlaceList(); renderSaved(); renderSettings();
}
function setFrom(id, { say = true, confirm = false } = {}) {
  const p = pt(id); if (!p) return false;
  state.fromId = id;
  if (state.toKey === keyOf(state.map, p)) state.toKey = null;
  renderHome(); renderSearch();
  if (say) { const msg = confirm ? t('confirmed', pname(p)) : t('locSet', pname(p)); announce(msg); toast(msg); }
  return true;
}
function setDest(key, { chip = null, say = true } = {}) {
  const d = resolve(key); if (!d) return;
  state.toKey = key; state.chip = chip;
  closeResults();
  renderHome();
  if (say) {
    const r = planTo(key);
    announce(r ? t('routeTo', pname(d.p), fmtM(r.distance_m), fmtMin(r.seconds)) : pname(d.p));
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
  const map = state.map, from = pt(state.fromId), dest = destRef(), to = dest?.p || null;
  $('#fromName').textContent = from ? pname(from) : '—';
  $$('.chip[data-cat]').forEach(c => c.classList.toggle('is-active', c.dataset.cat === state.chip));
  $('#chipAccessible').setAttribute('aria-pressed', String(settings.stepFree));

  const heading = from?.facingDeg ?? 90;
  homeMap.setYou(from, heading);
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
    $('#destMeta').textContent = `${catName(to.category)}  •  ${metaLine(dest.m)}`;
    fav.hidden = false;
    const isSaved = isFav(state.toKey); fav.setAttribute('aria-pressed', String(isSaved)); fav.setAttribute('aria-label', t(isSaved ? 'unsave' : 'save'));
    const here = dest.m === map && state.fromId === to.id;
    route = here ? null : planTo(state.toKey);
    if (here) msg.textContent = t('alreadyHere');
    else if (!route && settings.stepFree) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noStepFreeTitle'))}</strong>${esc(t('noStepFreeBody'))}`; }
    else if (!route) { msg.className = 'route-msg warn'; msg.innerHTML = `<strong>${esc(t('noRoute'))}</strong>`; }
    $('#routeStats').hidden = !route;
    if (route) {
      $('#statEta').textContent = fmtMin(route.seconds);
      $('#statDist').textContent = fmtM(route.distance_m);
      const { steps } = planSteps(route), first = steps.find(s => s.kind === 'move' || s.kind === 'node' || s.kind === 'floor');
      if (route.via) msg.textContent = t(route.via.lift ? 'viaLift' : 'viaStairs', t('floorName', route.via.toMap.floor));
      if (route.closures) msg.textContent = [msg.textContent, t('closureNote')].filter(Boolean).join(' ');
      if (first) {
        banner.hidden = false;
        banner.querySelector('.turn-ico').innerHTML = svgIco(TURN_ICONS[first.turn] || TURN_ICONS.straight);
        banner.querySelector('.turn-title').textContent = stepShort(first);
        banner.querySelector('.turn-sub').textContent = first.kind === 'move' ? t('forDist', fmtM(first.d1 - first.d0)) : '';
      } else banner.hidden = true;
    } else banner.hidden = true;
  }
  $('#btnStart').disabled = !route;
  $('#btnShare').hidden = !route;
  const kq = $('#kioskQR'); if (kq) { kq.hidden = !(state.kiosk && route); if (state.kiosk && route) kq.querySelector('.qr').innerHTML = qrSvg(shareLink()); }
  homeMap.setRoute(route?.legs[0].route.path || null);
  homeMap.setDest(dest ? (dest.m === map ? to : route?.via?.pa || null) : null);
  const img = to && route ? t('routeTo', pname(to), fmtM(route.distance_m), fmtMin(route.seconds)) + ' ' + t('mapAlt') : t('mapAlt');
  $('#homeMap').setAttribute('aria-label', t('planImg', map.building.name, t('floorName', map.floor), img));
  fitHome();
}
function fitHome() {
  const plan = state.toKey ? planTo(state.toKey) : null, path = plan?.legs[0].route.path;
  const route = path && plan.legs[0].route.distance_m > 0 ? path : null;
  const banner = !$('#homeBanner').hidden, expanded = $('.map-card').classList.contains('expanded');
  const pts = route ? [...route] : state.map.plan.walls.flat();
  homeMap.fit({ pts, tilt: route ? 32 : 18, padX: 56, padTop: banner ? 130 : 80, padBot: route ? 70 : 60, maxK: expanded ? 3 : 2.2 });
}

/* ---------- Search ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
function searchPoints(q) {
  const nq = norm(q); if (!nq) return [];
  const words = nq.split(/\s+/);
  const scored = [], multi = bFloors().length > 1;
  for (const m of bFloors()) for (const p of m.points) {
    const names = norm(`${p.nameEn} ${p.nameAr}`), cats = norm(`${catName(p.category)} ${STR.en.cats[p.category] || ''} ${STR.ar.cats[p.category] || ''} ${CAT_WORDS[p.category] || ''}`);
    if (!words.every(w => names.includes(w) || cats.includes(w))) continue;
    const starts = norm(pname(p)).startsWith(nq) ? 0 : names.includes(nq) ? 1 : 2;
    const d = m === state.map ? distFor(m, pt(state.fromId), p) : (hasStored(m, mode()) ? planRoute(state.map, state.fromId, m, p.id)?.distance_m : null);
    const r = d != null ? { distance_m: d } : null;
    scored.push({ p, m, r, multi, score: starts * 1e6 + (m === state.map ? 0 : 5e5) + (r ? r.distance_m : 4e5) });
  }
  // The visitor's saved spot.
  if (/spot|car|park|مكان|سيار|موقف/.test(nq)) { const sp = store.get('dalil.spot', null), m = sp && mapByFloor(sp.f); const p = m && pointOf(m, '@spot'); if (p && sp.b === state.map.building.id) scored.unshift({ p, m, r: null, multi, score: -1 }); }
  return scored.sort((a, b) => a.score - b.score);
}
function renderSearch() {
  const q = $('#search').value, list = $('#results');
  if (!q.trim()) { closeResults(); return; }
  const res = searchPoints(q);
  list.hidden = false;
  list.innerHTML = res.length ? res.map(({ p, m, r, multi }) =>
    `<li><button type="button" data-pick="${esc(keyOf(m, p))}">
      <span class="res-ico">${svgIco(CAT_ICONS[p.category] || CAT_ICONS.pin)}</span>
      <span class="res-main"><span class="res-name">${esc(pname(p))}</span><span class="res-sub">${esc([pnameOther(p), catName(p.category), multi ? t('floorName', m.floor) : ''].filter(Boolean).join(' · '))}</span></span>
      <span class="res-dist">${r ? esc(fmtM(r.distance_m)) : ''}</span></button></li>`).join('')
    : `<li class="res-empty">${esc(t('noResults'))}</li>`;
  $('#resultsStatus').textContent = res.length ? t('results', res.length) : t('noResults');
}
function closeResults() { $('#results').hidden = true; $('#results').innerHTML = ''; }

/* ---------- Category chips ---------- */
function pickNearest(cat) {
  const label = t('cat_' + cat), cands = [];
  for (const m of bFloors()) for (const p of m.points) if (CHIP_CATS[cat].includes(p.category) && !(m === state.map && p.id === state.fromId)) cands.push({ m, p });
  if (!cands.length) { const m = t('noneOfCat', label); toast(m); announce(m); return; }
  let best = null; const from = pt(state.fromId);
  for (const { m, p } of cands.filter(c => c.m === state.map)) { const d = distFor(m, from, p); if (d != null && (!best || d < best.d)) best = { m, p, d }; }
  if (best) best.r = planRoute(state.map, state.fromId, best.m, best.p.id);
  if (!best?.r) { best = null; for (const { m, p } of cands.filter(c => c.m !== state.map)) { const r = planRoute(state.map, state.fromId, m, p.id); if (r && (!best || r.seconds < best.r.seconds)) best = { m, p, r }; } }
  if (!best) { const m = settings.stepFree ? t('noneReachable', label) : t('noRoute'); toast(m); announce(m); return; }
  setDest(keyOf(best.m, best.p), { chip: cat, say: false });
  const m = t('nearest', label, pname(best.p), fmtM(best.r.distance_m)); announce(m); toast(m);
}
function setStepFree(on) {
  settings.stepFree = on; saveSettings();
  $('#setStepFree').checked = on;
  renderHome(); renderSearch();
  announce(t(on ? 'stepFreeOn' : 'stepFreeOff'));
}

/* ---------- Saved ---------- */
const favKey = key => `${state.map.building.id}/${key.replace('|', '/')}`;
const isFav = key => !!key && state.saved.includes(favKey(key));
function toggleFav(key, force) {
  const k = favKey(key), has = state.saved.includes(k), want = force ?? !has;
  if (want && !has) state.saved.push(k); if (!want && has) state.saved = state.saved.filter(x => x !== k);
  store.set('dalil.saved', state.saved); renderSaved();
  if (state.toKey === key) renderHome();
  return want;
}
function renderSaved() {
  const items = state.saved.map(k => { const [b, f, id] = k.split('/'); const m = state.maps.find(m => m.building.id === b && m.floor.id === f); const p = m?.points.find(p => p.id === id); return p ? { k, m, p } : null; }).filter(Boolean);
  const sp = store.get('dalil.spot', null), spm = sp && state.maps.find(m => m.building.id === sp.b && m.floor.id === sp.f);
  $('#savedEmpty').hidden = items.length > 0 || !!spm;
  $('#savedList').innerHTML = (spm ? `<li><button class="place" type="button" data-saved="${esc(`${sp.b}/${sp.f}/@spot`)}"><span class="res-ico">${svgIco(CAT_ICONS.pin)}</span><span class="res-main"><span class="res-name">${esc(t('mySpot'))}</span><span class="res-sub">${esc(metaLine(spm))}</span></span></button>
      <button class="icon-btn flat" type="button" data-unspot aria-label="${esc(t('unsave'))}: ${esc(t('mySpot'))}">${svgIco('<path d="M6 6l12 12M18 6 6 18"/>', 'ico')}</button></li>` : '') + items.map(({ k, m, p }) => {
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
    const d = p.id === state.fromId ? null : distFor(map, pt(state.fromId), p), r = d != null ? { distance_m: d } : null;
    return `<li><button class="place" type="button" data-pick="${esc(keyOf(map, p))}"><span class="res-ico">${svgIco(CAT_ICONS[p.category] || CAT_ICONS.pin)}</span><span class="res-main"><span class="res-name">${esc(pname(p))}</span><span class="res-sub">${esc([catName(p.category), p.dalilNode ? t('dalilTag') : ''].filter(Boolean).join(' · '))}</span></span><span class="res-dist">${r ? esc(fmtM(r.distance_m)) : ''}</span></button></li>`;
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
  $('#pinCard').hidden = true; pinPoint = null;
  if (name === 'map') { floorMap.setDest(null); $('#pinHelp').hidden = !routerOf(state.map); }
  if (name === 'map') requestAnimationFrame(() => floorMap.fit({ pts: state.map.plan.walls.flat(), padX: 20, padTop: 20, padBot: 20, maxK: 3 }, false));
  if (name === 'home') requestAnimationFrame(fitHome);
  window.scrollTo(0, 0);
}

/* =========================================================================
   Navigation mode
   ========================================================================= */
const nav = { active: false, plan: null, legs: [], steps: [], leg: -1, i: 0, pos: 0, sim: false, dwell: 0, raf: 0, last: 0, rot: 0, toKey: null };

function startNav() {
  const plan = planTo(state.toKey); if (!plan) return;
  const { legs, steps } = planSteps(plan), dest = destRef();
  Object.assign(nav, { active: true, plan, legs, steps, leg: -1, i: 0, pos: 0, sim: false, dwell: 0, toKey: state.toKey, rot: null });
  $('#app').inert = true; $('#nav').hidden = false;
  $('#navDest').textContent = pname(dest.p);
  renderStepList();
  goStep(0, { focus: true, intro: t('navStarted', pname(dest.p)) });  // nav is visible now, so the map has its size
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
      else if (s.kind === 'floor') buzz([120, 80, 120]);
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
  $('#navDest').textContent = pname(resolve(nav.toKey)?.p);
  if (updateList) renderStepList(); else { renderStepList(); }
  $('#navMap').setAttribute('aria-label', t('mapAlt'));
  updateNavPos(true);
}
function updateNavPos(animate) {
  const s = nav.steps[nav.i], leg = nav.legs[s.leg], path = leg.route.path;
  if (nav.leg !== s.leg) {   // a new floor: swap the plan under the camera
    nav.leg = s.leg; nav.rot = null; navMap.setMap(leg.map);
    const d = resolve(nav.toKey); navMap.setDest(d && d.m === leg.map ? d.p : nav.plan.via?.pa || null);
    animate = false;
  }
  const p = pointAt(path, leg.cum, nav.pos);
  // Sub-line: distance left on this leg, then a preview of the next step.
  const next = nav.steps[nav.i + 1];
  let sub = '';
  if (s.kind === 'move') sub = t('left', fmtM(s.d1 - nav.pos));
  if (next && s.kind !== 'arrive') sub += (sub ? '  ·  ' : '') + `${t('then')}: ${stepShort(next)}`;
  $('#navStepSub').textContent = sub;
  const total = nav.legs.reduce((a, l) => a + l.L, 0) || 1;
  const remain = Math.max(0, leg.L - nav.pos) + nav.legs.slice(s.leg + 1).reduce((a, l) => a + l.L, 0);
  $('#navRemain').textContent = fmtM(remain);
  $('#navRemainTime').textContent = t('remainTime', fmtMin(nav.plan.seconds * remain / total));
  // Done / remaining route.
  const done = path.slice(0, p.i).concat([[p.x, p.y]]), rest = [[p.x, p.y]].concat(path.slice(p.i));
  navMap.setRoute(rest, done);
  // Heading up. For start and node steps, look along the next leg.
  const h = headingAt(path, leg.cum, nav.pos + (s.kind === 'move' ? 0 : 0.01));
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
  if (d) { if (d.m !== state.map) selectFloor(d.m); state.fromId = d.p.id; state.toKey = null; state.chip = null; }
  endNav();
  navMap.setMap(state.map); nav.leg = -1;
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
  } else if (link.at && !map.points.some(p => p.id === link.at)) {
    map = state.maps.find(m => m.points.some(p => p.id === link.at)) || map;
  }
  if (link.f && !link.b) map = state.maps.find(m => m.building.id === map.building.id && m.floor.id === link.f) || map;
  if (map !== state.map) selectFloor(map);
  if (link.at) setFrom(link.at, { confirm: fromTag });
  if (link.to) {   // "P007" (this floor first, then the others) or "<floor>|P007"
    const key = link.to.includes('|') ? link.to : [state.map, ...bFloors()].map(m => m.points.some(p => p.id === link.to) ? keyOf(m, { id: link.to }) : null).find(Boolean);
    if (key) setDest(key);
  }
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
/* =========================================================================
   Dropped pins, My spot, sharing, kiosk
   ========================================================================= */
let pinPoint = null;
function onMapTap({ x, y }) {
  const R = routerOf(state.map);
  if (!R) return;  // v1 maps (stored routes only) cannot route to arbitrary spots
  if (!R.walkable(x, y)) { toast(t('pinOutside')); return; }
  pinPoint = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  floorMap.setDest({ x: pinPoint.x, y: pinPoint.y });
  $('#pinText').textContent = t('pinAt', t('floorName', state.map.floor));
  $('#pinCard').hidden = false;
  announce(t('pinAt', t('floorName', state.map.floor)));
}
function pinKey() { return pinPoint ? `${state.map.floor.id}|@${pinPoint.x},${pinPoint.y}` : null; }
function shareLink(key = state.toKey) {
  const u = new URL(location.href); u.search = '';
  u.hash = `b=${state.map.building.id}&f=${state.map.floor.id}&at-${state.fromId}${key ? `&to-${encodeURIComponent(key)}` : ''}`;
  return u.toString();
}
function qrSvg(text) {
  if (!window.qrcode) return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: { text: t('kioskQR') } });
}
function openShare() {
  const url = shareLink(), d = destRef();
  $('#shareQR').innerHTML = qrSvg(url);
  $('#shareUrl').value = url;
  $('#btnShareNative').hidden = !navigator.share;
  $('#dlgShare').dataset.title = d ? pname(d.p) : 'DALIL';
  $('#dlgShare').showModal ? $('#dlgShare').showModal() : $('#dlgShare').setAttribute('open', '');
}
let kioskTimer = 0;
function kioskIdle() {
  clearTimeout(kioskTimer);
  if (!state.kiosk) return;
  kioskTimer = setTimeout(() => {
    if (nav.active) endNav();
    $('#arrived').hidden = true; $('#nav').inert = false;
    const m = state.maps.find(m => m.building.id === state.kiosk.b && m.floor.id === state.kiosk.f);
    if (m && m !== state.map) selectFloor(m);
    state.fromId = state.kiosk.at; state.toKey = null; state.chip = null; $('#search').value = ''; closeResults();
    showScreen('home'); renderHome(); announce(t('kioskReset'));
  }, 90_000);
}

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
    if (sv) { const [b, f, id] = sv.dataset.saved.split('/'); const m = state.maps.find(m => m.building.id === b && m.floor.id === f); if (m && m.building.id !== state.map.building.id) selectFloor(m); setDest(`${f}|${id}`); showScreen('home'); return; }
    if (e.target.closest('[data-unspot]')) { try { localStorage.removeItem('dalil.spot'); } catch { } renderSaved(); return; }
    const us = e.target.closest('[data-unsave]');
    if (us) { state.saved = state.saved.filter(k => k !== us.dataset.unsave); store.set('dalil.saved', state.saved); renderSaved(); if (state.toKey) renderHome(); return; }
    if (!e.target.closest('.search-wrap')) closeResults();
  });
  $$('.chip[data-cat]').forEach(c => { c.onclick = () => pickNearest(c.dataset.cat); });
  $('#chipAccessible').onclick = () => setStepFree(!settings.stepFree);
  $('#btnScan').onclick = openTagPicker;
  $('#btnFrom').onclick = openTagPicker;
  $('#tagList').addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) { e.preventDefault(); $('#dlgTag').close(); setFrom(b.dataset.tag); } });
  $('#btnFav').onclick = () => { if (state.toKey) { const on = toggleFav(state.toKey); announce(t(on ? 'saved' : 'unsave')); } };
  $('#btnStart').onclick = startNav;
  $('#btnShare').onclick = openShare;
  $('#btnShareCopy').onclick = async () => { const v = $('#shareUrl').value; try { await navigator.clipboard.writeText(v); toast(t('copied')); } catch { $('#shareUrl').select(); } };
  $('#btnShareNative').onclick = async () => { try { await navigator.share({ title: 'DALIL', text: $('#dlgShare').dataset.title, url: $('#shareUrl').value }); } catch { } };
  $('#btnPinGo').onclick = () => { const k = pinKey(); if (!k) return; $('#pinCard').hidden = true; setDest(k); showScreen('home'); };
  $('#btnPinSave').onclick = () => { if (!pinPoint) return; store.set('dalil.spot', { b: state.map.building.id, f: state.map.floor.id, x: pinPoint.x, y: pinPoint.y }); $('#pinCard').hidden = true; renderSaved(); toast(t('spotSaved')); announce(t('spotSaved')); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, kioskIdle, { passive: true }));
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
  $('#btnArrivedSave').onclick = () => { toggleFav(nav.toKey, true); $('#btnArrivedSave').textContent = t('saved'); };
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
  // Place names appear once zoomed in enough to read them without covering the plan.
  floorMap = new MapView($('#floorMap'), { interactive: true, onTap: p => onMapTap(p), onCam: c => $('#floorMap').classList.toggle('show-labels', c.k * BASE >= 16) });
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
  if (link.kiosk) { state.kiosk = { b: state.map.building.id, f: state.map.floor.id, at: state.fromId }; document.documentElement.classList.add('kiosk'); renderHome(); kioskIdle(); }
  document.documentElement.classList.add('ready');
}

window.DALIL_APP = { state, settings, spoken, nav, parseLink, buildSteps, routeFor, pointOf, views: () => ({ homeMap, floorMap, navMap }), ready: init() };

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
