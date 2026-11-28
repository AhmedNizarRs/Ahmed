// DALIL location: the phone's position on Earth (the browser's Geolocation API, which on phones is the same
// fused GPS + Wi-Fi + cell position that map apps use), placed on the floor plan through the map's `geo`
// (the alignment of the plan on the real map, set in the Mapper's World position step).
//
// Indoors that position is often 5–30 m off and never says which floor you are on, so it is blended with the
// step tracking rather than trusted on its own (see app.js, fuseFix). It never leaves the phone.

// [lng, lat] -> plan metres. The inverse of outdoor.js geoTransform (origin = plan 0,0; bearing = plan +y
// clockwise from north; scale = plan metres to real metres).
export function planFromGeo(geo) {
  const [lng0, lat0] = geo.origin, b = geo.bearing * Math.PI / 180, k = geo.scale || 1;
  const mlng = 111412.84 * Math.cos(lat0 * Math.PI / 180), mlat = 111132.92 - 559.82 * Math.cos(2 * lat0 * Math.PI / 180);
  return (lng, lat) => {
    const e = (lng - lng0) * mlng / k, n = (lat - lat0) * mlat / k;
    return { x: e * Math.cos(b) - n * Math.sin(b), y: e * Math.sin(b) + n * Math.cos(b) };
  };
}

/** Closest point of a polyline to (x, y): distance along it (d) and distance away from it (off). */
export function projectOnPath(path, cum, x, y) {
  let best = { d: 0, off: Infinity };
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    const u = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2)), px = x0 + u * dx, py = y0 + u * dy;
    const off = Math.hypot(x - px, y - py);
    if (off < best.off) best = { d: cum[i - 1] + u * (cum[i] - cum[i - 1]), off };
  }
  return best;
}

/** A position worse than this many metres is only a rough area (Wi-Fi, mobile masts, or the phone's "Precise
    Location" switched off): it is drawn as an area, never as "you are exactly here". */
export const ROUGH_ACC = 100;

/** Watches the position. onFix({ lng, lat, acc, t }); onError('denied' | 'unavailable'). */
export class Locator {
  constructor() { this.watch = null; this.fix = null; this.state = 'idle'; }
  get on() { return this.watch != null; }
  start(onFix, onError) {
    if (this.watch != null) return true;
    if (!navigator.geolocation) { this.state = 'unavailable'; onError?.('unavailable'); return false; }
    this.state = 'asking';
    this.watch = navigator.geolocation.watchPosition(p => {
      this.state = 'on';
      const fix = { lng: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy || 999, t: Date.now() };
      // A phone sometimes follows a good GPS fix with a rough Wi-Fi or mobile-mast one: keep the good one while it is fresh.
      const last = this.fix;
      if (last && fix.t - last.t < 15000 && fix.acc > ROUGH_ACC && fix.acc > 3 * last.acc) return;
      this.fix = fix;
      onFix?.(this.fix);
    }, e => {
      this.state = e.code === 1 ? 'denied' : 'unavailable';
      if (e.code === 1) this.stop();
      onError?.(this.state);
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    return true;
  }
  stop() { if (this.watch != null) navigator.geolocation.clearWatch(this.watch); this.watch = null; if (this.state !== 'denied') this.state = 'idle'; }
  fresh(ms = 12000) { return this.fix && Date.now() - this.fix.t < ms ? this.fix : null; }
}

/** Already allowed? (never prompts) */
export async function locationGranted() {
  try { return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted'; } catch { return false; }
}
