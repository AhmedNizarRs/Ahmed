// DALIL visitor app service worker: works offline once loaded.
// Bump VERSION whenever app files change.
const VERSION = 'dalil-app-v5';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'mapview.js', 'router.js', 'outdoor.js', 'vendor/qrcode.js', 'maps.json', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/geist-latin.woff2', 'fonts/plex-arabic-dalil.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
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
    // NFC tag URLs (/t/<building>/<floor>/<point>) open the app shell.
    const isTag = req.mode === 'navigate' && /\/t\/[^/]+\/[^/]+\/[^/]+$/.test(new URL(req.url).pathname);
    const key = isTag ? 'index.html' : req;
    const cached = await c.match(key, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then(r => { if (r.ok && !isTag) c.put(req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    const r = await fresh;
    return r || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  })());
});
