// Street and satellite maps for "Getting here". The app tries them in order and moves on when one fails
// (style can't be fetched, or its tiles keep failing), and ends on a plain map that needs no internet.
// Free providers need no key. Keyed ones use the building's own account key from config.json. Keys in a
// web app are visible to anyone, so restrict each key to the building's web address in the provider's dashboard.
// Terms checked 2026-11-14 on each provider's site (docs/data-providers.md). Re-check before launch.

export const PROVIDERS = [
  { id: 'openfreemap', name: 'OpenFreeMap', kind: 'streets', terms: 'Free, commercial use allowed, no key. Attribution required.',
    style: dark => `https://tiles.openfreemap.org/styles/${dark ? 'positron' : 'liberty'}`, darken: true },
  { id: 'versatiles', name: 'VersaTiles', kind: 'streets', terms: 'Free and open (public tile server), no key. Attribution required.',
    style: dark => `https://tiles.versatiles.org/assets/styles/${dark ? 'colorful-dark' : 'colorful'}/style.json` },
  { id: 'esri', name: 'Esri', kind: 'satellite', key: 'esri', terms: 'ArcGIS Location Platform account (free tier for basemap tiles). “Powered by Esri” must show.',
    style: (dark, k) => `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=${encodeURIComponent(k)}`, attribution: 'Powered by Esri' },
  { id: 'esri-streets', name: 'Esri', kind: 'streets', key: 'esri', terms: 'As above.',
    style: (dark, k) => `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/${dark ? 'navigation-night' : 'navigation'}?token=${encodeURIComponent(k)}`, attribution: 'Powered by Esri' },
  { id: 'maptiler', name: 'MapTiler', kind: 'streets', key: 'maptiler', terms: 'Commercial use needs a paid plan (the free plan is non-commercial).',
    style: (dark, k) => `https://api.maptiler.com/maps/${dark ? 'streets-v2-dark' : 'streets-v2'}/style.json?key=${encodeURIComponent(k)}` },
  { id: 'maptiler-satellite', name: 'MapTiler', kind: 'satellite', key: 'maptiler', terms: 'As above.',
    style: (dark, k) => `https://api.maptiler.com/maps/hybrid/style.json?key=${encodeURIComponent(k)}` },
  { id: 'stadia', name: 'Stadia Maps', kind: 'streets', key: 'stadia', terms: 'Commercial use needs a paid plan (Starter or above). Key, or the site’s domain registered with Stadia.',
    style: (dark, k) => `https://tiles.stadiamaps.com/styles/${dark ? 'alidade_smooth_dark' : 'alidade_smooth'}.json${k && k !== 'domain' ? `?api_key=${encodeURIComponent(k)}` : ''}` },
  { id: 'mapbox', name: 'Mapbox', kind: 'streets', key: 'mapbox', raster: true, terms: 'Free tier, then pay as you go (Static Tiles API).', attribution: '© Mapbox © OpenStreetMap',
    tiles: (dark, k) => [`https://api.mapbox.com/styles/v1/mapbox/${dark ? 'dark-v11' : 'streets-v12'}/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(k)}`] },
  { id: 'mapbox-satellite', name: 'Mapbox', kind: 'satellite', key: 'mapbox', raster: true, terms: 'As above.', attribution: '© Mapbox © OpenStreetMap © Maxar',
    tiles: (dark, k) => [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(k)}`] },
];
export const PLAIN = { id: 'plain', name: 'Plain', kind: 'plain' };

const keyFor = (p, cfg) => !p.key ? '' : (cfg?.keys?.[p.key] || (p.key === 'stadia' && cfg?.stadiaDomainAuth ? 'domain' : ''));
/** Providers this building can use (free ones, plus keyed ones whose key is in config.json). */
export function availableProviders(cfg = {}) { return PROVIDERS.filter(p => !p.key || keyFor(p, cfg)); }
/** The order to try. choice = a provider id, or 'auto' (config order first, then the other street maps). */
export function providerOrder(choice = 'auto', cfg = {}) {
  const avail = availableProviders(cfg);
  if (choice === 'plain') return [];
  const picked = avail.find(p => p.id === choice);
  const pref = (cfg.order || ['openfreemap', 'versatiles']).map(id => avail.find(p => p.id === id)).filter(Boolean);
  const head = picked ? [picked] : pref;
  const sameKind = avail.filter(p => !head.includes(p) && p.kind === (picked?.kind || 'streets'));
  const streets = avail.filter(p => !head.includes(p) && !sameKind.includes(p) && p.kind === 'streets');
  return [...head, ...sameKind, ...streets];
}

/** Recolour a light vector style for the dark theme (no second tile source needed). */
export function darken(style) {
  const fill = id => /water/.test(id) ? '#16222E' : /park|grass|wood|landcover|landuse/.test(id) ? '#171C19' : /building/.test(id) ? '#22262C' : '#14161A';
  for (const l of style.layers || []) {
    const p = l.paint ||= {};
    if (l.type === 'background') p['background-color'] = '#0F1114';
    else if (l.type === 'fill') { p['fill-color'] = fill(l.id); delete p['fill-pattern']; p['fill-outline-color'] = '#2A2E35'; }
    else if (l.type === 'line') p['line-color'] = /water|river/.test(l.id) ? '#1E3042' : /boundary|admin/.test(l.id) ? '#3A3F47' : '#2C3036';
    else if (l.type === 'symbol' && l.layout?.['text-field']) { p['text-color'] = '#8A919B'; p['text-halo-color'] = '#0F1114'; }
  }
  return style;
}
export const plainStyle = dark => ({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#0F1114' : '#EEEDE8' } }] });

/** A provider's MapLibre style. Vector styles are fetched first, so a provider that is down fails here. */
export async function loadStyle(p, { dark = false, cfg = {}, timeout = 7000 } = {}) {
  const k = keyFor(p, cfg);
  if (p.raster) return { version: 8, sources: { base: { type: 'raster', tiles: p.tiles(dark, k), tileSize: 512, maxzoom: 22, attribution: p.attribution } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] };
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(p.style(dark, k), { signal: ctl.signal });
    if (!r.ok) throw new Error(`${p.id} ${r.status}`);
    const s = await r.json();
    if (!s || s.version !== 8 || !Array.isArray(s.layers)) throw new Error(`${p.id} bad style`);
    return dark && p.darken ? darken(s) : s;
  } finally { clearTimeout(tm); }
}
