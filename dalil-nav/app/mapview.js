// DALIL map renderer: the floor plan as SVG (metres) inside a CSS camera (pan, zoom, rotate, tilt).
// Used for the main map (flat, interactive) and the navigation view (tilted, heading-up).
export const BASE = 10; // px per metre in world space
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class MapView {
  // opts: interactive, points: 'all' | 'nodes' | 'none', label(p), pickKey(map, p), onTap({x,y}), onCam(cam)
  constructor(el, opts = {}) {
    this.el = el; this.opts = opts;
    this.cam = { x: 0, y: 0, k: 1, rot: 0, tilt: 0, ax: .5, ay: .5 };
    el.innerHTML = '<div class="map-tilt"><div class="map-world"></div></div>';
    this.tiltEl = el.firstChild; this.world = this.tiltEl.firstChild;
    this.markers = []; this.fitTarget = null; this.map = null;
    if (opts.interactive) { el.classList.add('interactive'); this.bindGestures(); }
    new ResizeObserver(() => { if (!this.map) return; if (this.fitTarget) this.fit(this.fitTarget, false); else this.apply(); }).observe(el);
  }

  setMap(map) {
    if (this.map === map) return;
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
        <rect class="plan-floor" x="${pad - 1}" y="${pad - 1}" width="${W - 2 * pad + 2}" height="${H - 2 * pad + 2}" rx="1"/>
        <path class="plan-doors" d="${doors}"/><path class="plan-walls" d="${walls}"/>
        <path class="plan-closure" d="${d((map.closures || []).map(c => [c.a, c.b]))}"/>
        <g class="route-layer"><path class="route-done" d=""/><path class="route-casing" d=""/><path class="route-main" d=""/><path class="route-flow" d=""/></g>
      </svg>`;
    const q = s => this.world.querySelector(s);
    this.svgRoute = { done: q('.route-done'), casing: q('.route-casing'), main: q('.route-main'), flow: q('.route-flow') };
    this.markers = []; this.you = null; this.dest = null;
    this.renderPoints();
  }
  px(x, y) { return [(x - this.b.minX) * BASE, (this.b.maxY - y) * BASE]; }
  pathD(path) { return path && path.length > 1 ? 'M' + path.map(([x, y]) => `${(x - this.b.minX).toFixed(2)} ${(this.b.maxY - y).toFixed(2)}`).join('L') : ''; }
  setRoute(path, done) {
    if (!this.map) return;
    const d = this.pathD(path);
    for (const k of ['casing', 'main', 'flow']) this.svgRoute[k].setAttribute('d', d);
    this.svgRoute.done.setAttribute('d', this.pathD(done));
  }

  addMarker(cls, html, x, y) {
    const el = document.createElement('div'); el.className = 'mk ' + cls; el.innerHTML = `<div class="mk-inner">${html}</div>`;
    this.world.appendChild(el); const m = { el, x, y }; this.markers.push(m); this.placeMarker(m); return m;
  }
  moveMarker(m, x, y) { m.x = x; m.y = y; this.placeMarker(m); }
  removeMarker(m) { if (!m) return; m.el.remove(); this.markers = this.markers.filter(o => o !== m); }
  // Markers lie on the floor plane, screen-up and a constant size (upright ones get sorted behind a tilted floor).
  placeMarker(m) { const [px, py] = this.px(m.x, m.y), c = this.cam; m.el.style.transform = `translate(${px}px,${py}px) rotate(${-c.rot}deg) scale(${1 / c.k}) translateZ(1px)`; }

  renderPoints() {
    if (!this.map) return;
    for (const m of this.markers.filter(m => m.point)) this.removeMarker(m);
    const mode = this.opts.points || 'all';
    if (mode === 'none') return;
    for (const p of this.map.points) {
      if (mode === 'nodes' && !p.dalilNode) continue;
      const name = this.opts.label ? this.opts.label(p) : p.nameEn;
      const inner = `<span class="pt-dot pt-${esc(p.category)}${p.dalilNode ? ' node' : ''}"></span><span class="pt-label">${esc(name)}</span>`;
      const html = this.opts.interactive && this.opts.pickKey ? `<button type="button" class="pt-btn" tabindex="-1" data-pick="${esc(this.opts.pickKey(this.map, p))}" aria-label="${esc(name)}">${inner}</button>` : inner;
      const m = this.addMarker('mk-point', html, p.x, p.y); m.point = p.id;
    }
  }
  // Hide the place dots that sit under the "you" or destination marker.
  hidePoints(ids = []) { const set = new Set(ids); for (const m of this.markers) if (m.point) m.el.style.visibility = set.has(m.point) ? 'hidden' : ''; }
  setYou(p, headingDeg) {
    if (!p) { this.removeMarker(this.you); this.you = null; return; }
    if (!this.you) this.you = this.addMarker('mk-you', '<div class="you"><span class="you-pulse"></span><span class="you-cone"></span><span class="you-dot"></span></div>', p.x, p.y);
    else this.moveMarker(this.you, p.x, p.y);
    this.you.heading = headingDeg ?? 90; this.orientYou();
  }
  orientYou() { if (this.you) this.you.el.querySelector('.you-cone').style.transform = `rotate(${90 - this.you.heading + this.cam.rot}deg)`; }
  // Destination: the DALIL ring-and-dot. An optional caption (e.g. "To Level 2") sits under it.
  setDest(p, caption = '') {
    if (!p) { this.removeMarker(this.dest); this.dest = null; return; }
    const html = `<div class="dest"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="dest-ring" cx="20" cy="20" r="13"/><circle class="dest-core" cx="20" cy="20" r="5.5"/></svg>${caption ? `<span class="dest-cap">${esc(caption)}</span>` : ''}</div>`;
    if (this.dest) this.removeMarker(this.dest);
    this.dest = this.addMarker('mk-dest', html, p.x, p.y);
  }

  size() { return [this.el.clientWidth || 1, this.el.clientHeight || 1]; }
  // Fit plan points into the part of the view not covered by panels.
  fit(target, animate = true) {
    if (!this.map) return;
    this.fitTarget = target;
    const pts = target.pts.map(([x, y]) => this.px(x, y));
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    const [vw, vh] = this.size();
    const pl = target.padL ?? 32, pr = target.padR ?? 32, pt = target.padTop ?? 32, pb = target.padBot ?? 32;
    const k = Math.max(.05, Math.min((vw - pl - pr) / Math.max(c - a, 30), (vh - pt - pb) / Math.max(d - b, 30), target.maxK ?? 4));
    this.setCam({ x: (a + c) / 2 - ((pl - pr) / 2) / k, y: (b + d) / 2 - ((pt - pb) / 2) / k, k, rot: 0, tilt: target.tilt ?? 0, ax: .5, ay: .5 }, animate);
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
  planToScreen(x, y) { // flat, unrotated view
    const r = this.el.getBoundingClientRect(), c = this.cam, [vw, vh] = this.size(), [wx, wy] = this.px(x, y);
    return { x: r.left + vw * c.ax + (wx - c.x) * c.k, y: r.top + vh * c.ay + (wy - c.y) * c.k };
  }
  screenToPlan(cx, cy) {
    const r = this.el.getBoundingClientRect(), c = this.cam, [vw, vh] = this.size();
    const wx = (cx - r.left - vw * c.ax) / c.k + c.x, wy = (cy - r.top - vh * c.ay) / c.k + c.y;
    return { x: wx / BASE + this.b.minX, y: this.b.maxY - wy / BASE };
  }
  bindGestures() {
    const ptrs = new Map(); let last = null, start = null, moved = false;
    this.el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); this.el.setPointerCapture(e.pointerId); if (ptrs.size === 1) { start = [e.clientX, e.clientY]; moved = false; } else moved = true; });
    this.el.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) moved = true;
      if (!moved) return;
      this.fitTarget = null;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) { this.cam.x -= (e.clientX - prev[0]) / this.cam.k; this.cam.y -= (e.clientY - prev[1]) / this.cam.k; }
      else if (ptrs.size === 2) { const [p, q] = [...ptrs.values()], dist = Math.hypot(p[0] - q[0], p[1] - q[1]); if (last) this.cam.k = Math.max(.05, Math.min(8, this.cam.k * dist / last)); last = dist; }
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
