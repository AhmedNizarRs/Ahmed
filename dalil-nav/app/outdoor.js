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
  const doors = (map.plan.doors || []).filter(w => w.length > 1).map(w => ({ type: 'Feature', properties: { kind: 'door' }, geometry: { type: 'LineString', coordinates: w.map(([x, y]) => T(x, y)) } }));
  const places = map.points.filter(p => !p.virtual && p.nameEn).map(p => ({ id: p.id, nameEn: p.nameEn, nameAr: p.nameAr || p.nameEn, category: p.category, lngLat: T(p.x, p.y) }));
  const entrances = map.points.filter(p => p.category === 'entrance' || p.category === 'exit')
    .map(p => ({ type: 'Feature', properties: { kind: 'entrance', id: p.id, nameEn: p.nameEn, nameAr: p.nameAr || p.nameEn, main: p.category === 'entrance' }, geometry: { type: 'Point', coordinates: T(p.x, p.y) } }));
  return { doors: { type: 'FeatureCollection', features: doors }, places, walls: { type: 'FeatureCollection', features: walls }, outline: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'outline' }, geometry: { type: 'Polygon', coordinates: [ring] } }] }, entrances: { type: 'FeatureCollection', features: entrances }, bounds: bbox(ring) };
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
// Layer groups the visitor can switch on and off (checkboxes on the page).
export const LAYERS = ['plan', 'places', 'outline', 'entrances', 'route', 'me'];
const GROUPS = { plan: ['walls', 'doors'], outline: ['outline-fill', 'outline-line'], entrances: ['entr-ring', 'entr-label'], route: ['route-casing', 'route-line'], me: ['me-acc', 'me-dot'] };

export async function createOutdoorMap(el, { map, dark, lang, onStatus, onProvider, attribution, providers = {}, layers = {}, opacity = 0.85, pins = false, onPick = null, iconFor = null, padding = 60 }) {
  const maplibregl = await loadMapLibre();
  let order = providerOrder(providers.choice || 'auto', providers.cfg || {});
  const failed = [], vis = Object.fromEntries(LAYERS.map(k => [k, layers[k] ?? true]));
  let idx = -1, active = PLAIN;
  async function nextStyle() {
    while (++idx < order.length) {
      const p = order[idx];
      try { const s = await loadStyle(p, { dark, cfg: providers.cfg || {} }); active = p; return s; } catch { failed.push(p.name); }
    }
    active = PLAIN; return plainStyle(dark);
  }
  const style = await nextStyle();
  let gj = floorGeoJSON(map), routeData = { type: 'FeatureCollection', features: [] }, placeMarkers = [];
  const m = new maplibregl.Map({ container: el, style, bounds: gj.bounds, fitBoundsOptions: { padding, maxZoom: 18.6 }, attributionControl: false, maxZoom: 20.5 });
  let attr = null;
  const setAttribution = () => { if (attr) m.removeControl(attr); attr = new maplibregl.AttributionControl({ compact: true, customAttribution: [attribution, active.attribution].filter(Boolean).join(' · ') }); m.addControl(attr, 'bottom-right'); el.dataset.logo = active.logo || '';
    // Start as the small (i) button: the credits open on tap, so they never cover the map.
    const fold = () => el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); fold(); setTimeout(fold, 0); m.once('load', fold); };
  setAttribution();
  const accent = '#FFC700', ink = dark ? '#E9E7E1' : '#2B2E33', OURS = new Set(['outline', 'walls', 'doors', 'entrances', 'me', 'route']);
  let meData = { type: 'FeatureCollection', features: [] };
  // DALIL's own layers go on top of whichever street map is showing (again after every style switch).
  const addOverlays = () => {
    if (m.getSource('outline')) return;
    m.addSource('outline', { type: 'geojson', data: gj.outline });
    m.addSource('walls', { type: 'geojson', data: gj.walls });
    m.addSource('doors', { type: 'geojson', data: gj.doors });
    m.addSource('route', { type: 'geojson', data: routeData });
    m.addSource('entrances', { type: 'geojson', data: gj.entrances });
    m.addSource('me', { type: 'geojson', data: meData });
    m.addLayer({ id: 'outline-fill', type: 'fill', source: 'outline', paint: { 'fill-color': accent, 'fill-opacity': dark ? .12 : .18 } });
    m.addLayer({ id: 'outline-line', type: 'line', source: 'outline', paint: { 'line-color': accent, 'line-width': 2 } });
    // On satellite the plan is drawn light with a dark edge, so it reads over roofs and trees.
    const sat = active.kind === 'satellite', planInk = sat ? '#FFFFFF' : ink;
    m.addLayer({ id: 'walls', type: 'line', source: 'walls', minzoom: 15, paint: { 'line-color': planInk, 'line-opacity': opacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, .4, 18, 1.1, 21, 2.4] } });
    m.addLayer({ id: 'doors', type: 'line', source: 'doors', minzoom: 17, paint: { 'line-color': accent, 'line-opacity': opacity * .8, 'line-width': ['interpolate', ['linear'], ['zoom'], 17, .5, 21, 1.6] } });
    m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B0D10', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 20, 10] } });
    m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2.5, 20, 6] } });
    m.addLayer({ id: 'entr-ring', type: 'circle', source: 'entrances', paint: { 'circle-radius': 8, 'circle-color': '#15130A', 'circle-stroke-color': accent, 'circle-stroke-width': 4 } });
    if (m.getStyle().glyphs) m.addLayer({ id: 'entr-label', type: 'symbol', source: 'entrances', layout: { 'text-field': ['get', lang === 'ar' ? 'nameAr' : 'nameEn'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'], 'text-optional': true }, paint: { 'text-color': ink, 'text-halo-color': dark ? '#0F1114' : '#FFFFFF', 'text-halo-width': 1.5 } });
    m.addLayer({ id: 'me-acc', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'acc'], paint: { 'circle-color': '#8DB6FF', 'circle-opacity': .15, 'circle-radius': ['get', 'r'] } });
    m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', ['get', 'kind'], 'dot'], paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#3B7BFF', 'circle-stroke-width': 3 } });
  };
  const applyVis = () => { for (const [g, ids] of Object.entries(GROUPS)) for (const id of ids) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', vis[g] ? 'visible' : 'none');
    for (const mk of placeMarkers) mk.getElement().hidden = !vis.places; };
  m.on('style.load', () => { addOverlays(); applyVis(); });
  // Room and place names as small HTML labels (they work on every base map, with or without fonts in its style).
  const drawPlaces = () => {
    for (const mk of placeMarkers) mk.remove();
    placeMarkers = gj.places.map(p => {
      const e = document.createElement(pins ? 'button' : 'div');
      e.className = `${pins ? 'out-pin' : 'out-place'} cat-${p.category}`;
      e.innerHTML = pins ? `<span class="op-pin">${iconFor ? iconFor(p.category) : ''}</span><span class="op-name"></span>` : '<span class="op-dot"></span><span class="op-name"></span>';
      const name = lang === 'ar' ? p.nameAr : p.nameEn;
      e.querySelector('.op-name').textContent = name; e.hidden = !vis.places;
      if (pins) { e.type = 'button'; e.setAttribute('aria-label', name); e.dataset.place = p.id; e.addEventListener('click', ev => { ev.stopPropagation(); onPick?.(p.id); }); }
      const mk = new maplibregl.Marker({ element: e, anchor: pins ? 'bottom-left' : 'left', offset: pins ? [-14, 0] : [0, 0] }).setLngLat(p.lngLat).addTo(m);
      if (pins) e.setAttribute('aria-label', name); else e.setAttribute('aria-hidden', 'true');   // MapLibre names every marker "Map marker"
      return mk;
    });
    const showNames = () => { el.classList.toggle('out-names', m.getZoom() >= 18.5); el.classList.toggle('out-pins', m.getZoom() >= 17.2); el.classList.toggle('out-far', m.getZoom() < 16.5); }; showNames(); m.on('zoom', showNames);
  };
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
    m.setStyle(s, { diff: false }); switching = false;
    if (ctl) { ctl.provider = active; ctl.streets = active !== PLAIN; }
    setAttribution(); onProvider?.(active, failed.slice());
  });
  await new Promise(res => { m.once('load', res); setTimeout(res, 8000); });
  if (m.isStyleLoaded()) { addOverlays(); applyVis(); }
  drawPlaces();
  const mainEntr = gj.entrances.features.find(f => f.properties.main) || gj.entrances.features[0];
  const target = mainEntr ? mainEntr.geometry.coordinates : [(gj.bounds[0][0] + gj.bounds[1][0]) / 2, (gj.bounds[0][1] + gj.bounds[1][1]) / 2];
  let watch = null, youMk = null, bldMks = [];
  ctl = {
    map: m, streets: active !== PLAIN, provider: active, failed, target, geojson: gj, vis,
    /** Show or hide a layer group: 'plan' | 'places' | 'outline' | 'entrances' | 'route' | 'me'. */
    setLayer(name, on) { vis[name] = !!on; applyVis(); },
    /** Change the base map (a provider id, 'auto' or 'plain'); falls through to the next one if it fails. */
    async setBase(choice) {
      order = providerOrder(choice, providers.cfg || {}); idx = -1; failed.length = 0; switching = true;
      const s = await nextStyle(); loads = 0; errs = 0; t0 = performance.now();
      m.setStyle(s, { diff: false }); switching = false; ctl.provider = active; ctl.streets = active !== PLAIN; setAttribution();
      onProvider?.(active, failed.slice()); return active;
    },
    /** Overlay another floor of the same building (needs its own geo). */
    setFloor(next) { if (!next?.geo) return; gj = floorGeoJSON(next); ctl.geojson = gj; for (const k of ['walls', 'doors', 'outline', 'entrances']) m.getSource(k)?.setData(gj[k]); drawPlaces(); },
    setOpacity(v) { opacity = v; if (m.getLayer('walls')) m.setPaintProperty('walls', 'line-opacity', v); if (m.getLayer('doors')) m.setPaintProperty('doors', 'line-opacity', v * .8); },
    /** The planned route on this floor, as [lng, lat] points, or null. */
    setRoute(coords) { routeData = { type: 'FeatureCollection', features: coords?.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] }; m.getSource('route')?.setData(routeData); },
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
    /** "You are here" (a place, or a GPS position): the blue dot, with a cone when the heading is known. */
    setYou(lngLat, heading = null) {
      if (!lngLat) { youMk?.remove(); youMk = null; return; }
      if (!youMk) { const e = document.createElement('div'); e.className = 'out-you'; e.innerHTML = '<span class="oy-cone"></span><span class="oy-pulse"></span><span class="oy-dot"></span>'; youMk = new maplibregl.Marker({ element: e, rotationAlignment: 'map' }).setLngLat(lngLat).addTo(m); }
      youMk.setLngLat(lngLat); const cone = youMk.getElement().querySelector('.oy-cone');
      cone.hidden = heading == null; if (heading != null) cone.style.transform = `rotate(${heading}deg)`;
    },
    /** Show the building (or a point) with room left for the panels around the map. */
    frame(pad = padding) { m.fitBounds(gj.bounds, { padding: pad, maxZoom: 18.6, duration: 0 }); },
    flyTo(lngLat, zoom = 19) { m.easeTo({ center: lngLat, zoom: Math.max(m.getZoom(), zoom), duration: 600 }); },
    resize() { m.resize(); },
    /** Every building with a DALIL indoor map, as a marker you can tap: [{ id, name, lngLat, current }]. */
    setBuildings(list, onBuilding) {
      for (const mk of bldMks) mk.remove();
      bldMks = list.map(b => {
        const e = document.createElement('button'); e.type = 'button'; e.className = 'out-bld' + (b.current ? ' current' : '');
        e.innerHTML = `<span class="ob-ico">${iconFor ? iconFor('building') : ''}</span><span class="ob-name"></span>`;
        e.querySelector('.ob-name').textContent = b.name;
        e.addEventListener('click', ev => { ev.stopPropagation(); onBuilding?.(b.id); });
        const mk = new maplibregl.Marker({ element: e, anchor: 'bottom' }).setLngLat(b.lngLat).addTo(m);
        e.setAttribute('aria-label', b.name); return mk;
      });
    },
    /** Zoom out to show these points (other buildings, or you and a building). */
    show(points, pad = padding) { if (!points.length) return; const bb = new maplibregl.LngLatBounds(points[0], points[0]); points.forEach(p => bb.extend(p)); m.fitBounds(bb, { padding: pad, maxZoom: 18.6, duration: 600 }); },
    destroy() { if (watch != null) navigator.geolocation.clearWatch(watch); for (const mk of [...placeMarkers, ...bldMks]) mk.remove(); youMk?.remove(); m.remove(); },
  };
  return ctl;
}
