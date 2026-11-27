// A bare real-world map for DALIL's mapping tools (placing a plan on Earth, drawing a building on the satellite
// photo). Satellite first, because roofs are what you match against; it falls through to the next map when one
// cannot load, and ends on a plain background that works offline. The point you are working on is always the
// centre of the map, under a fixed crosshair: moving the picture under a cross is far more exact on a phone than
// tapping with a fingertip that hides the spot.
import { loadMapLibre } from './outdoor.js';
import { providerOrder, loadStyle, plainStyle, PLAIN } from './providers.js';

/**
 * el: container. center [lng, lat] + zoom, or bounds [[w, s], [e, n]]. cfg: config.maps. choice: provider id.
 * onStyle(map): called after every style load, to (re)add the tool's own sources and layers.
 * cross: how far down the map the fixed cross sits (0.5 = the middle).
 * Returns { map, maplibregl, provider (what is showing), satellite (bool), setBase(choice), center() (under the cross),
 *           moveTo(lngLat) (bring a place under the cross), destroy() }.
 */
export async function createGeoMap(el, { center = [55.4907, 25.3186], zoom = 17, bounds = null, cfg = {}, choice = 'esri-imagery-labels', dark = false, onStyle = null, onProvider = null, padding = 60, cross = 0.5 } = {}) {
  const maplibregl = await loadMapLibre();
  let order = providerOrder(choice, cfg), idx = -1, active = PLAIN;
  async function nextStyle() {
    while (++idx < order.length) { const p = order[idx]; try { const s = await loadStyle(p, { dark, cfg }); active = p; return s; } catch { /* next */ } }
    active = PLAIN; return plainStyle(dark);
  }
  const style = await nextStyle();
  const m = new maplibregl.Map({ container: el, style, attributionControl: false, maxZoom: 21.5, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    ...(bounds ? { bounds, fitBoundsOptions: { padding, maxZoom: 20 } } : { center, zoom }) });
  m.touchZoomRotate?.disableRotation?.();     // north stays up: one less thing to get wrong while matching corners
  let attr = null;
  const setAttribution = () => { if (attr) m.removeControl(attr); attr = new maplibregl.AttributionControl({ compact: true, customAttribution: active.attribution || '' }); m.addControl(attr, 'top-right'); const fold = () => el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); fold(); setTimeout(fold, 0); m.once('load', fold); };
  setAttribution();
  m.on('resize', () => setTimeout(() => el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'), 0));
  const ctl = {
    map: m, maplibregl, get provider() { return active; }, get satellite() { return active.kind === 'satellite'; },
    // The cross sits `cross` of the way down the map (above the middle when a panel covers the bottom).
    crossPoint() { const c = m.getContainer(); return [c.clientWidth / 2, c.clientHeight * cross]; },
    center() { const c = m.unproject(ctl.crossPoint()); return [c.lng, c.lat]; },
    /** Bring a place under the cross. */
    moveTo(lngLat, { zoom = null, duration = 400 } = {}) { const c = m.getContainer(); m.easeTo({ center: lngLat, ...(zoom != null ? { zoom } : {}), offset: [0, (cross - 0.5) * c.clientHeight], duration }); },
    async setBase(next) { order = providerOrder(next, cfg); idx = -1; switching = true; const s = await nextStyle(); loads = 0; errs = 0; t0 = performance.now(); m.setStyle(s, { diff: false }); switching = false; setAttribution(); onProvider?.(active); return active; },
    destroy() { try { m.remove(); } catch { /* already gone */ } },
  };
  m.on('style.load', () => onStyle?.(m));
  // Tiles that keep failing before any arrive: move to the next map.
  let loads = 0, errs = 0, t0 = performance.now(), switching = false;
  const OURS = /^(pl|sk)-/;
  m.on('data', e => { if (e.dataType === 'source' && e.tile && !OURS.test(e.sourceId || '')) loads++; });
  m.on('error', async e => {
    if (OURS.test(e.sourceId || '') || active === PLAIN || switching) return;
    errs++; if (loads > 0 || errs < 3 || performance.now() - t0 > 20000) return;
    switching = true; const s = await nextStyle(); loads = 0; errs = 0; t0 = performance.now(); m.setStyle(s, { diff: false }); switching = false; setAttribution(); onProvider?.(active);
  });
  await new Promise(res => { m.once('load', res); setTimeout(res, 8000); });
  if (m.isStyleLoaded()) onStyle?.(m);
  onProvider?.(active);
  return ctl;
}

/** Set or create a GeoJSON source. */
export function setSource(m, id, data) { const s = m.getSource(id); if (s) s.setData(data); else m.addSource(id, { type: 'geojson', data }); }
export const fc = (features = []) => ({ type: 'FeatureCollection', features });
export const lineF = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } });
export const pointF = (coord, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: coord } });
export const polyF = (ring, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } });
