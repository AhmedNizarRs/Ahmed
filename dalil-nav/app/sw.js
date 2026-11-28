// DALIL visitor app service worker: works offline once loaded.
// Bump VERSION whenever app files change.
const VERSION = 'dalil-app-v44';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'mapview.js', 'router.js', 'outdoor.js', 'providers.js', 'tracker.js', 'camera.js', 'locate.js', 'survey.js', 'snapplan.js', 'georef.js', 'geomap.js', 'placeui.js', 'sketch.js', 'sketchui.js', 'vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  'vendor/qrcode.js', 'vendor/jsqr/jsQR.js', 'maps.json', 'config.json', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/geist-latin.woff2', 'fonts/geist-mono.woff2', 'fonts/plex-arabic-400.woff2', 'fonts/plex-arabic-600.woff2', 'fonts/plex-arabic-dalil.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));   // straight from the host: its 10-minute browser cache must not hand a new version old files
    // Bundled demo maps, listed in maps.json.
    try {
      const list = await (await fetch('maps.json')).json();
      await c.addAll(list.maps);
    } catch { /* maps are cached on first use instead */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Stale-while-revalidate for same-origin GETs: instant from cache, refreshed in the background.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    // A DALIL sign's link (…/t/<building>/<floor>/<point>) goes to the app with the same three parts after the #.
    // (Serving the app at the sign's own address broke it: its styles and scripts are relative, so they were asked
    // for under /t/<building>/<floor>/ and not found. Found on the first phone build, Nov 2026.)
    const tag = req.mode === 'navigate' && new URL(req.url).pathname.match(/\/t\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
    if (tag) return Response.redirect(`${new URL('./', self.registration.scope).href}#t/${tag[1]}/${tag[2]}/${tag[3]}`, 302);
    const cached = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    const r = await fresh;
    return r || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  })());
});
