// DALIL motion tracking: which way you face (compass) and how far you have walked (step counting),
// matched to the route. Indoors there is no GPS, so this is an estimate (dead reckoning). DALIL tags
// (tap or scan) and the corners of the route correct it as you go.
//
// Frames
//   Sensor frame: x = east, y = north of the phone's compass (magnetic north, or an arbitrary but
//   steady north on phones without an absolute compass), z = up. Bearings: degrees clockwise from that north.
//   Plan frame: the map file's metres, x right, y up. Plan angles: degrees counter-clockwise from +x.
//   beta = the sensor bearing of the plan's +y axis.  Plan angle θ and bearing H:  θ = 90 + beta − H.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const wrap180 = a => { const r = ((a + 180) % 360 + 360) % 360 - 180; return r === -180 ? 180 : r; };
export const wrap360 = a => ((a % 360) + 360) % 360;
export const planAngle = (bearing, beta) => wrap180(90 + beta - bearing);
export const bearingOf = (theta, beta) => wrap360(90 + beta - theta);
/** Plan vector (metres) → sensor frame [east, north]. */
export function planToSensor(dx, dy, beta) { const b = beta * D2R, c = Math.cos(b), s = Math.sin(b); return [dx * c + dy * s, -dx * s + dy * c]; }
const blendAngle = (a, b, k) => wrap180(a + k * wrap180(b - a));

/** W3C DeviceOrientation rotation matrix R = Rz(alpha)·Rx(beta)·Ry(gamma): device → sensor frame. Columns = device axes. */
export function rotationMatrix(alpha, beta, gamma) {
  const a = alpha * D2R, b = beta * D2R, g = gamma * D2R;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}
/** Screen axes in device coordinates for screen.orientation.angle 0 / 90 / 180 / 270. */
export function screenAxes(angle = 0) {
  const t = angle * D2R, s = Math.round(Math.sin(t)), c = Math.round(Math.cos(t));
  return { up: [s, c, 0], right: [c, -s, 0] };
}
export const screenAngle = () => { try { return screen.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : 0); } catch { return 0; } };

/** The bearing you face: the level direction of the screen's top edge plus the back camera.
 *  Phone flat: the top edge points ahead. Phone upright (camera): the camera points ahead. In between, both do. */
export function facing(R, angle = 0) {
  const { up } = screenAxes(angle);
  const fx = R[0][0] * up[0] + R[0][1] * up[1] - R[0][2], fy = R[1][0] * up[0] + R[1][1] * up[1] - R[1][2];
  return Math.hypot(fx, fy) < 1e-6 ? null : wrap360(Math.atan2(fx, fy) * R2D);
}

/** Steps from the accelerometer: smoothed magnitude minus its slow average, one count per peak.
 *  A lone bump (tapping the screen) is ignored until a second step follows within maxGap. */
export class StepDetector {
  constructor({ high = 1.15, low = 0.25, minGap = 280, maxGap = 1800 } = {}) { Object.assign(this, { high, low, minGap, maxGap }); this.reset(); }
  reset() { this.fast = null; this.base = null; this.t = null; this.armed = true; this.last = -1e9; this.pending = false; }
  /** mag: |acceleration including gravity| in m/s², t: ms. Returns how many steps to count (0, 1 or 2). */
  push(mag, t) {
    if (this.fast == null) { this.fast = this.base = mag; this.t = t; return 0; }
    const dt = Math.min(120, Math.max(1, t - this.t)); this.t = t;
    this.fast += (1 - Math.exp(-dt / 40)) * (mag - this.fast);
    this.base += (1 - Math.exp(-dt / 900)) * (mag - this.base);
    const d = this.fast - this.base;
    if (!this.armed) { if (d < this.low) this.armed = true; return 0; }
    if (d < this.high || t - this.last < this.minGap) return 0;
    this.armed = false;
    const gap = t - this.last; this.last = t;
    if (gap > this.maxGap) { this.pending = true; return 0; }
    const n = this.pending ? 2 : 1; this.pending = false; return n;
  }
}

/** Phone sensors → a smoothed facing bearing (sensor frame), the latest rotation matrix and step events. */
export class Tracker {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now; this.detector = new StepDetector(); this.on = false;
    this.onStep = null;               // (t) => void
    this.reset();
  }
  reset() {
    this.R = null; this.raw = null; this.heading = null; this.hx = 0; this.hy = 0; this.tH = null; this.rate = 0;
    this.absolute = false; this.iosOff = null; this.gotAbs = -1e9; this.motionSeen = false; this.orientSeen = false;
    this.steps = 0; this.lastStep = -1e9; this.denied = false; this.detector.reset();
  }
  /** Call from a tap: iOS shows its permission prompt here. Resolves once it knows which sensors send data. */
  start() {
    const asks = [];
    for (const E of [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent]) {
      try { if (typeof E?.requestPermission === 'function') asks.push(E.requestPermission()); } catch { /* not in a gesture */ }
    }
    this.listen();
    return (async () => {
      const res = await Promise.allSettled(asks);
      this.denied = res.some(r => r.status === 'rejected' || (r.value && r.value !== 'granted'));
      const t0 = this.now();
      while (this.now() - t0 < 1500 && !(this.orientSeen && this.motionSeen)) await new Promise(r => setTimeout(r, 100));
      return { orientation: this.orientSeen, motion: this.motionSeen, denied: this.denied };
    })();
  }
  listen() {
    if (this.on || typeof window === 'undefined') return; this.on = true;
    this.h = { abs: e => this.orient(e, true), rel: e => this.orient(e, false), motion: e => this.motion(e) };
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', this.h.abs);
    window.addEventListener('deviceorientation', this.h.rel);
    window.addEventListener('devicemotion', this.h.motion);
  }
  stop() {
    if (!this.on) return; this.on = false;
    window.removeEventListener('deviceorientationabsolute', this.h.abs);
    window.removeEventListener('deviceorientation', this.h.rel);
    window.removeEventListener('devicemotion', this.h.motion);
  }
  /** One orientation reading. absEvent = it came from 'deviceorientationabsolute'. */
  orient(e, absEvent = false, t = this.now()) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    if (!absEvent && t - this.gotAbs < 1500) return;       // Android sends both; the absolute one wins
    if (absEvent) this.gotAbs = t;
    let alpha = e.alpha, absolute = absEvent || e.absolute === true;
    const ang = screenAngle(), wch = e.webkitCompassHeading;
    if (!absolute && typeof wch === 'number' && wch >= 0) {
      // iPhone: alpha starts from an arbitrary direction; webkitCompassHeading gives magnetic north.
      // Learn the offset while the phone is closer to flat (where both agree), keep it when upright.
      const hRel = facing(rotationMatrix(alpha, e.beta, e.gamma), ang);
      if (hRel != null) { const c = wrap180(wch - hRel); this.iosOff = this.iosOff == null ? c : Math.abs(e.beta) < 60 ? blendAngle(this.iosOff, c, 0.08) : this.iosOff; }
      alpha = wrap360(alpha - (this.iosOff ?? 0)); absolute = true;
    }
    const R = rotationMatrix(alpha, e.beta, e.gamma), H = facing(R, ang);
    this.R = R; this.absolute = absolute; this.orientSeen = true;
    if (H == null) return;
    this.raw = H;
    const dt = this.tH == null ? 1000 : Math.min(500, Math.max(1, t - this.tH));
    const prev = this.heading;
    const k = 1 - Math.exp(-dt / 140);
    if (this.tH == null) { this.hx = Math.cos(H * D2R); this.hy = Math.sin(H * D2R); }
    else { this.hx += k * (Math.cos(H * D2R) - this.hx); this.hy += k * (Math.sin(H * D2R) - this.hy); }
    this.tH = t; this.heading = wrap360(Math.atan2(this.hy, this.hx) * R2D);
    if (prev != null) { const r = Math.abs(wrap180(this.heading - prev)) / (dt / 1000); this.rate += (1 - Math.exp(-dt / 400)) * (r - this.rate); }
  }
  motion(e, t = this.now()) {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null || a.z == null) return;
    this.motionSeen = true;
    const n = this.detector.push(Math.hypot(a.x, a.y, a.z), t);
    for (let i = 0; i < n; i++) { this.steps++; this.lastStep = t; this.onStep?.(t); }
  }
  walking(t = this.now()) { return t - this.lastStep < 2200; }
  steady() { return this.rate < 35; }
}

/** Matches steps and heading to one leg of the route (a polyline in plan metres).
 *  Learns beta (compass → plan) from the walk itself, so a wrong or missing building bearing heals. */
export class Follower {
  constructor({ stride = 0.68 } = {}) {
    this.stride = stride; this.cal = { x: 0, y: 0, w: 0 }; this.prior = null; this.priorW = 0; this.priorTrusted = false;
    this.beta = null; this.out = { x: 0, y: 0, n: 0 }; this.wrongN = 0; this.wrong = false;
    this.path = null; this.cum = null; this.L = 0; this.pos = 0; this.corners = []; this.anchorPos = 0; this.anchorSteps = 0; this.stepsTotal = 0;
  }
  setPrior(beta, { weight = 3, trusted = false } = {}) { this.prior = beta == null ? null : wrap180(beta); this.priorW = weight; this.priorTrusted = trusted && beta != null; this.recompute(); }
  get samples() { return this.cal.w; }
  /** True when the arrow can point the real way: a trusted prior, or enough of your own walking. */
  get usable() { return this.beta != null && (this.priorTrusted || this.cal.w >= 4); }
  recompute() {
    let x = this.cal.x, y = this.cal.y, w = this.cal.w;
    if (this.prior != null) { x += this.priorW * Math.cos(this.prior * D2R); y += this.priorW * Math.sin(this.prior * D2R); w += this.priorW; }
    this.beta = w > 0 && Math.hypot(x, y) > 1e-9 ? wrap180(Math.atan2(y, x) * R2D) : null;
  }
  sample(b) {
    b = wrap180(b);
    if (this.beta != null && Math.abs(wrap180(b - this.beta)) > 50) {
      // Not where we expected. Several in a row that agree with each other (and are not a U-turn) win.
      this.out.x += Math.cos(b * D2R); this.out.y += Math.sin(b * D2R); this.out.n++;
      const m = Math.hypot(this.out.x, this.out.y) / this.out.n, mean = Math.atan2(this.out.y, this.out.x) * R2D;
      if (this.out.n >= 10 && m > 0.9 && Math.abs(wrap180(mean - this.beta)) < 135) {
        this.cal = { x: this.out.x / this.out.n * 6, y: this.out.y / this.out.n * 6, w: 6 }; this.prior = null; this.priorTrusted = false; this.out = { x: 0, y: 0, n: 0 }; this.recompute();
      }
      return false;
    }
    this.out = { x: 0, y: 0, n: 0 };
    const f = 0.95; this.cal.x = this.cal.x * f + Math.cos(b * D2R); this.cal.y = this.cal.y * f + Math.sin(b * D2R); this.cal.w = this.cal.w * f + 1;
    this.recompute(); return true;
  }
  setLeg(path, cum) {
    this.path = path; this.cum = cum; this.L = cum[cum.length - 1]; this.pos = 0; this.anchorPos = 0; this.anchorSteps = this.stepsTotal; this.wrongN = 0; this.wrong = false;
    this.corners = [];
    for (let i = 1; i < path.length - 1; i++) {
      const tin = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]) * R2D, tout = Math.atan2(path[i + 1][1] - path[i][1], path[i + 1][0] - path[i][0]) * R2D;
      const turn = wrap180(tout - tin);
      if (Math.abs(turn) > 35 && cum[i] - cum[i - 1] > 0.6 && cum[i + 1] - cum[i] > 0.6) this.corners.push({ d: cum[i], tin, tout, turn });
    }
  }
  /** A new floor whose plan is turned by delta degrees relative to the last one: keep what was learned. */
  shiftFrame(delta) {
    const c = Math.cos(delta * D2R), s = Math.sin(delta * D2R), { x, y } = this.cal;
    this.cal.x = x * c - y * s; this.cal.y = x * s + y * c;
    if (this.prior != null) this.prior = wrap180(this.prior + delta);
    this.recompute();
  }
  /** A new floor with no known relation to the last one: learn again. */
  resetFrame() { this.cal = { x: 0, y: 0, w: 0 }; this.prior = null; this.priorTrusted = false; this.out = { x: 0, y: 0, n: 0 }; this.recompute(); }
  /** Plan direction of the path at distance d (degrees). */
  dirAt(d) {
    const { path, cum } = this; let i = 1; while (i < cum.length - 1 && cum[i] <= d) i++;
    return Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]) * R2D;
  }
  straightAt(d) { return d > 1 && d < this.L - 1 && !this.corners.some(c => Math.abs(c.d - d) < 2.2); }
  nextCorner(d) { return this.corners.find(c => c.d > d - 0.6) || null; }
  /** Correct the position (a tag, Next/Back, or a floor change). Learns your step length when it can. */
  anchor(d, { learn = true } = {}) {
    const n = this.stepsTotal - this.anchorSteps, walked = d - this.anchorPos;
    if (learn && n >= 12 && walked > 6) this.stride = Math.min(0.95, Math.max(0.45, 0.5 * this.stride + 0.5 * walked / n));
    this.pos = Math.max(0, Math.min(this.L, d)); this.anchorPos = this.pos; this.anchorSteps = this.stepsTotal; this.wrongN = 0; this.wrong = false;
  }
  /** One step. H = the bearing you face (sensor frame) or null. Returns the new position along the leg. */
  step(H, { steady = true } = {}) {
    this.stepsTotal++;
    if (!this.path) return this.pos;
    let pos = this.pos, adv = this.stride;
    const tpath = this.dirAt(pos);
    if (H != null && steady && this.straightAt(pos)) this.sample(tpath - 90 + H);
    if (H != null && this.usable) {
      const tu = planAngle(H, this.beta), rel = wrap180(tu - tpath);
      if (Math.abs(rel) > 120) { this.wrongN++; adv = 0; } else { this.wrongN = 0; adv = this.stride * Math.max(0, Math.cos(rel * D2R)); }
      this.wrong = this.wrongN >= 3;
      const c = this.nextCorner(pos);
      if (c && !this.wrong) {
        const toOut = Math.abs(wrap180(tu - c.tout)), toIn = Math.abs(wrap180(tu - c.tin));
        if (toOut < 30 && toIn > 45 && pos > c.d - 6 && pos < c.d) pos = c.d;                                   // turned at the corner: you are there
        else if (Math.abs(c.turn) > 55 && toIn < 25 && toOut > 50 && pos + adv > c.d + 0.4) adv = Math.max(0, c.d + 0.4 - pos); // still going the old way: wait at the corner
      }
    }
    this.pos = Math.max(0, Math.min(this.L, pos + adv));
    return this.pos;
  }
  /** Where you face in plan degrees, or null. */
  facingPlan(H) { return H != null && this.beta != null ? planAngle(H, this.beta) : null; }
}
