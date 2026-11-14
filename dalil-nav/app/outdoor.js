// "Getting here": the building on a real street map, with the floor plan layered on top.
// Renderer: MapLibre GL JS (vendor/maplibre, BSD-3), loaded only when this view opens.
// Street maps: providers.js (OpenFreeMap and VersaTiles free; Esri, MapTiler, Stadia, Mapbox with the building's key),
// tried in order with automatic failover, ending on a plain map that works offline.
// Building outline: Overture Maps (ODbL) when the map file carries it, otherwise the plan's own outline.
import { providerOrder, loadStyle, plainStyle, PLAIN } from './providers.js';

// Plan metres -> [lng, lat] using the map's `geo` (origin = plan 0,0; bearing = plan +y, clockwise from north).
export function geoTransform(geo) {
  const [lng0, lat0] = geo.origin, b = geo.bearing * Math.PI / 180, k = geo.scale || 1;
  const mlng = 111412.84 * Math.cos(lat0 * Math.PI / 180), mlat = 111132.92 - 559.82 * Math.cos(2 * lat0 * Math.PI / 180);
  return (x, y) => { const e = k * (x * Math.cos(b) + y * Math.sin(b)), n = k * (-x * Math.sin(b) + y * Math.cos(b)); return [lng0 + e / mlng, lat0 + n / mlat]; };
}
export function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Convex hull (monotone chain) as a fallback building outline.
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// GeoJSON for one floor map: walls, building outline, entrances.
export function floorGeoJSON(map) {
  const T = geoTransform(map.geo), walls = [], all = [];
  for (const w of map.plan.walls) { if (w.length < 2) continue; const line = w.map(([x, y]) => T(x, y)); walls.push({ type: 'Feature', properties: { kind: 'wall' }, geometry: { type: 'LineString', coordinates: line } }); for (const c of line) all.push(c); }
  let ring = map.building_context?.footprint;
  if (!ring) { const h = hull(all.filter((_, i) => i % 3 === 0)); ring = h.concat([h[0]]); }
  const entrances = map.points.filter(p => p.category === 'entrance' || p.category === 'exit')
    .map(p => ({ type: 'Feature', properties: { kind: 'entrance', id: p.id, nameEn: p.nameEn, nameAr: p.nameAr || p.nameEn, main: p.category === 'entrance' }, geometry: { type: 'Point', coordinates: T(p.x, p.y) } }));
  return { walls: { type: 'FeatureCollection', features: walls }, outline: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'outline' }, geometry: { type: 'Polygon', coordinates: [ring] } }] }, entrances: { type: 'FeatureCollection', features: entrances }, bounds: bbox(ring) };
}
function bbox(ring) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [[a, b], [c, d]]; }

let libPromise = null;
export function loadMapLibre(base = 'vendor/maplibre/') {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return libPromise ??= new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'maplibre-gl.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = base + 'maplibre-gl.js'; s.onload = () => res(window.maplibregl); s.onerror = () => { libPromise = null; rej(new Error('maplibre')); };
    document.head.appendChild(s);
  });
}

/** Open the outdoor map in `el`. Returns a controller, or throws if MapLibre can't load.
 *  providers: { choice, cfg }. onProvider(active, failedNames) reports which map is showing. */
export async function createOutdoorMap(el, { map, dark, lang, onStatus, onProvider, attribution, providers = {} }) {
  const maplibregl = await loadMapLibre();
  const order = providerOrder(providers.choice || 'auto', providers.cfg || {}), failed = [];
  let idx = -1, active = PLAIN;
  async function nextStyle() {
    while (++idx < order.length) {
      const p = order[idx];
      try { const s = await loadStyle(p, { dark, cfg: providers.cfg || {} }); active = p; return s; } catch { failed.push(p.name); }
    }
    active = PLAIN; return plainStyle(dark);
  }
  const style = await nextStyle();
  const gj = floorGeoJSON(map);
  const m = new maplibregl.Map({ container: el, style, bounds: gj.bounds, fitBoundsOptions: { padding: 60 }, attributionControl: false, maxZoom: 20.5 });
  const custom = [attribution, active.attribution].filter(Boolean).join(' · ');
  const attr = new maplibregl.AttributionControl({ compact: true, customAttribution: custom });
  m.addControl(attr, 'bottom-right');
  const accent = '#FFC700', ink = dark ? '#E9E7E1' : '#2B2E33', OURS = new Set(['outline', 'walls', 'entrances', 'me']);
  let meData = { type: 'FeatureCollection', features: [] };
  // DALIL's own layers go on top of whichever street map is showing (again after every style switch).
  const addOverlays = () => {
    if (m.getSource('outline')) return;
    m.addSource('outline', { type: 'geojson', data: gj.outline });
    m.addSource('walls', { type: 'geojson', data: gj.walls });
    m.addSource('entrances', { type: 'geojson', data: gj.entrances });
    m.addSource('me', { type: 'geojson', data: meData });
    m.addLayer({ id: 'outline-fill', type: 'fill', source: 'outline', paint: { 'fill-color': accent, 'fill-opacity': dark ? .12 : .18 } });
    m.addLayer({ id: 'outline-line', type: 'line', source: 'outline', paint: { 'line-color': accent, 'line-width': 2 } });
    m.addLayer({ id: 'walls', type: 'line', source: 'walls', minzoom: 16.5, paint: { 'line-color': ink, 'line-opacity': .8, 'line-width': ['interpolate', ['linear'], ['zoom'], 16.5, .5, 18, 1, 20, 1.8] } });
    m.addLayer({ id: 'entr-ring', type: 'circle', source: 'entrances', paint: { 'circle-radius': 8, 'circle-color': '#15130A', 'circle-stroke-color': accent, 'circle-stroke-width': 4 } });
    if (m.getStyle().glyphs) m.addLayer({ id: 'entr-label', type: 'symbol', source: 'entrances', layout: { 'text-field': ['get', lang === 'ar' ? 'nameAr' : 'nameEn'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'], 'text-optional': true }, paint: { 'text-color': ink, 'text-halo-color': dark ? '#0F1114' : '#FFFFFF', 'text-halo-width': 1.5 } });
    m.addLayer({ id: 'me-acc', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'acc'], paint: { 'circle-color': '#8DB6FF', 'circle-opacity': .15, 'circle-radius': ['get', 'r'] } });
    m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'dot'], paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#3B7BFF', 'circle-stroke-width': 3 } });
  };
  m.on('style.load', addOverlays);
  // Failover once the style is in: if its tiles keep failing and none arrive, move to the next map.
  // (Listening from the start: failed tiles can arrive before the map's 'load' event.)
  let ctl = null, loads = 0, errs = 0, t0 = performance.now(), switching = false;
  m.on('data', e => { if (e.dataType === 'source' && e.tile && !OURS.has(e.sourceId)) loads++; });
  m.on('error', async e => {
    if (OURS.has(e.sourceId) || active === PLAIN || switching) return;
    errs++;
    if (loads > 0 || errs < 3 || performance.now() - t0 > 20000) return;
    switching = true; failed.push(active.name);
    const s = await nextStyle(); loads = 0; errs = 0; t0 = performance.now();
    m.setStyle(s); switching = false;
    if (ctl) { ctl.provider = active; ctl.streets = active !== PLAIN; }
    onProvider?.(active, failed.slice());
  });
  await new Promise(res => { m.once('load', res); setTimeout(res, 8000); });
  if (m.isStyleLoaded()) addOverlays();
  const mainEntr = gj.entrances.features.find(f => f.properties.main) || gj.entrances.features[0];
  const target = mainEntr ? mainEntr.geometry.coordinates : [(gj.bounds[0][0] + gj.bounds[1][0]) / 2, (gj.bounds[0][1] + gj.bounds[1][1]) / 2];
  let watch = null;
  ctl = {
    map: m, streets: active !== PLAIN, provider: active, failed, target, geojson: gj,
    setMe(lng, lat, acc) {
      const mpp = 156543.03 * Math.cos(lat * Math.PI / 180) / 2 ** m.getZoom();
      meData = { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { kind: 'acc', r: Math.max(8, acc / mpp) }, geometry: { type: 'Point', coordinates: [lng, lat] } },
        { type: 'Feature', properties: { kind: 'dot' }, geometry: { type: 'Point', coordinates: [lng, lat] } }] };
      m.getSource('me')?.setData(meData);
    },
    locate() {
      if (!navigator.geolocation) { onStatus?.('unavailable'); return; }
      if (watch != null) navigator.geolocation.clearWatch(watch);
      let first = true;
      watch = navigator.geolocation.watchPosition(pos => {
        const { longitude: lng, latitude: lat, accuracy } = pos.coords;
        ctl.setMe(lng, lat, accuracy);
        if (first) { first = false; const b = new maplibregl.LngLatBounds(gj.bounds[0], gj.bounds[1]); b.extend([lng, lat]); m.fitBounds(b, { padding: 70, maxZoom: 18.5 }); }
        onStatus?.('pos', { dist: haversine([lng, lat], target), accuracy });
      }, err => onStatus?.(err.code === 1 ? 'denied' : 'unavailable'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    },
    destroy() { if (watch != null) navigator.geolocation.clearWatch(watch); m.remove(); },
  };
  return ctl;
}
