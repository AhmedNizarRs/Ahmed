// "Getting here": the building on a real street map, with the floor plan layered on top.
// Renderer: MapLibre GL JS (vendor/maplibre, BSD-3), loaded only when this view opens.
// Street map: OpenFreeMap vector tiles (free, no key; attribution shown by MapLibre).
// Building outline: Overture Maps (ODbL) when the map file carries it, otherwise the plan's own outline.

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

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

// Recolour the light OpenFreeMap style for the dark theme (no second tile source needed).
function darken(style) {
  const fill = id => /water/.test(id) ? '#16222E' : /park|grass|wood|landcover|landuse/.test(id) ? '#171C19' : /building/.test(id) ? '#22262C' : '#14161A';
  for (const l of style.layers) {
    const p = l.paint ||= {};
    if (l.type === 'background') p['background-color'] = '#0F1114';
    else if (l.type === 'fill') { p['fill-color'] = fill(l.id); delete p['fill-pattern']; p['fill-outline-color'] = '#2A2E35'; }
    else if (l.type === 'line') p['line-color'] = /water|river/.test(l.id) ? '#1E3042' : /boundary|admin/.test(l.id) ? '#3A3F47' : '#2C3036';
    else if (l.type === 'symbol' && l.layout?.['text-field']) { p['text-color'] = '#8A919B'; p['text-halo-color'] = '#0F1114'; }
  }
  return style;
}

/** Open the outdoor map in `el`. Returns a controller, or throws if MapLibre can't load. */
export async function createOutdoorMap(el, { map, dark, lang, label, onStatus, attribution }) {
  const maplibregl = await loadMapLibre();
  let style, streets = true;
  try {
    const r = await fetch(STYLE_URL, { cache: 'force-cache' }); if (!r.ok) throw new Error(r.status);
    style = await r.json(); if (dark) style = darken(style);
  } catch {
    streets = false;
    style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#0F1114' : '#EEEDE8' } }] };
  }
  const gj = floorGeoJSON(map);
  const m = new maplibregl.Map({ container: el, style, bounds: gj.bounds, fitBoundsOptions: { padding: 60 }, attributionControl: false, maxZoom: 20.5 });
  m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: attribution }), 'bottom-right');
  const ready = new Promise(res => m.on('load', res));
  await ready;
  const accent = '#FFC700', ink = dark ? '#E9E7E1' : '#2B2E33';
  m.addSource('outline', { type: 'geojson', data: gj.outline });
  m.addSource('walls', { type: 'geojson', data: gj.walls });
  m.addSource('entrances', { type: 'geojson', data: gj.entrances });
  m.addSource('me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  m.addLayer({ id: 'outline-fill', type: 'fill', source: 'outline', paint: { 'fill-color': accent, 'fill-opacity': dark ? .12 : .18 } });
  m.addLayer({ id: 'outline-line', type: 'line', source: 'outline', paint: { 'line-color': accent, 'line-width': 2 } });
  m.addLayer({ id: 'walls', type: 'line', source: 'walls', minzoom: 16.5, paint: { 'line-color': ink, 'line-opacity': .8, 'line-width': ['interpolate', ['linear'], ['zoom'], 16.5, .5, 18, 1, 20, 1.8] } });
  m.addLayer({ id: 'entr-ring', type: 'circle', source: 'entrances', paint: { 'circle-radius': 8, 'circle-color': '#15130A', 'circle-stroke-color': accent, 'circle-stroke-width': 4 } });
  if (style.glyphs) m.addLayer({ id: 'entr-label', type: 'symbol', source: 'entrances', layout: { 'text-field': ['get', lang === 'ar' ? 'nameAr' : 'nameEn'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'], 'text-optional': true }, paint: { 'text-color': ink, 'text-halo-color': dark ? '#0F1114' : '#FFFFFF', 'text-halo-width': 1.5 } });
  m.addLayer({ id: 'me-acc', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'acc'], paint: { 'circle-color': '#8DB6FF', 'circle-opacity': .15, 'circle-radius': ['get', 'r'] } });
  m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'dot'], paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#3B7BFF', 'circle-stroke-width': 3 } });
  const mainEntr = gj.entrances.features.find(f => f.properties.main) || gj.entrances.features[0];
  const target = mainEntr ? mainEntr.geometry.coordinates : [(gj.bounds[0][0] + gj.bounds[1][0]) / 2, (gj.bounds[0][1] + gj.bounds[1][1]) / 2];
  let watch = null;
  const ctl = {
    map: m, streets, target, geojson: gj,
    setMe(lng, lat, acc) {
      const mpp = 156543.03 * Math.cos(lat * Math.PI / 180) / 2 ** m.getZoom();
      m.getSource('me').setData({ type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { kind: 'acc', r: Math.max(8, acc / mpp) }, geometry: { type: 'Point', coordinates: [lng, lat] } },
        { type: 'Feature', properties: { kind: 'dot' }, geometry: { type: 'Point', coordinates: [lng, lat] } }] });
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
