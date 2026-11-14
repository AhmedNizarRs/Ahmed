// DALIL camera guide: the rear camera, with the route drawn as a yellow line on the floor ahead of you.
// The line uses the phone's orientation (tracker.js) and your estimated position on the route, so it is
// a guide, not a measurement: it is as good as the compass and the step count. DALIL tags re-anchor it.
// Also: QR scanning of DALIL signs (BarcodeDetector where the browser has it, else vendored jsQR, Apache-2.0).
import { planToSensor, screenAxes, screenAngle } from './tracker.js';

export const CAM_HEIGHT = 1.35;   // metres: a phone held in front of the chest
export const CAM_FOV = 66;        // degrees across the long side of the picture (typical main camera)
const NEAR = 0.3, RIBBON = 0.3, AHEAD = 28;

/** Camera errors → a reason the app can explain. */
export function cameraError(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'denied';
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'none';
  if (n === 'NotSupportedError' || n === 'TypeError') return 'unsupported';
  return 'failed';
}
export async function openCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera API'), { name: 'NotSupportedError' });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay rules: the stream still shows once allowed */ }
  return stream;
}
export function closeCamera(video, stream) { try { stream?.getTracks().forEach(t => t.stop()); } catch { } if (video) video.srcObject = null; }

// Sutherland–Hodgman: keep the part of a camera-space polygon in front of the near plane.
function clipNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
  }
  return out;
}

export class CameraGuide {
  /** root gets a <video> and a <canvas>. onHint(kind) gets 'left' | 'right' | 'behind' | 'up' | null. */
  constructor(root, { onHint } = {}) {
    root.classList.add('cam');
    root.innerHTML = '<video class="cam-video" playsinline muted autoplay></video><canvas class="cam-draw" aria-hidden="true"></canvas>';
    this.root = root; this.video = root.querySelector('video'); this.canvas = root.querySelector('canvas'); this.ctx = this.canvas.getContext('2d');
    this.onHint = onHint; this.hint = null; this.stream = null; this.running = false; this.frame = null; this.drawn = 0;
  }
  async start() { this.stream = await openCamera(this.video); this.running = true; this.loop(); return this; }
  stop() { this.running = false; cancelAnimationFrame(this.raf); closeCamera(this.video, this.stream); this.stream = null; this.setHint(null); }
  /** The app calls this with the latest pose and route: { R, beta, pos:{x,y}, ahead:[[x,y],…], dest:{x,y,label}|null, motion } */
  update(frame) { this.frame = frame; }
  setHint(h) { if (h !== this.hint) { this.hint = h; this.onHint?.(h); } }
  loop() {
    if (!this.running) return;
    try { this.draw(performance.now()); } catch { /* never let drawing break navigation */ }
    this.raf = requestAnimationFrame(() => this.loop());
  }
  size() {
    const r = this.root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== W * dpr || this.canvas.height !== H * dpr) { this.canvas.width = W * dpr; this.canvas.height = H * dpr; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Focal length in CSS px: the picture is scaled to cover the view (object-fit: cover).
    const vw = this.video.videoWidth || 1280, vh = this.video.videoHeight || 720, s = Math.max(W / vw, H / vh);
    const fv = (Math.max(vw, vh) / 2) / Math.tan(CAM_FOV / 2 * Math.PI / 180);
    return { W, H, f: fv * s, cx: W / 2, cy: H / 2 };
  }
  draw(now) {
    const ctx = this.ctx, v = this.size(), fr = this.frame;
    ctx.clearRect(0, 0, v.W, v.H);
    if (!fr || !fr.R || fr.beta == null || !fr.pos || !fr.ahead || fr.ahead.length < 2) { this.setHint(null); return; }
    const R = fr.R, ax = screenAxes(screenAngle()), h = CAM_HEIGHT;
    // World point (plan x, y and height above the floor) → camera space [right, up, depth].
    const cam = (x, y, z = 0) => {
      const [E, N] = planToSensor(x - fr.pos.x, y - fr.pos.y, fr.beta), U = z - h;
      const dx = R[0][0] * E + R[1][0] * N + R[2][0] * U, dy = R[0][1] * E + R[1][1] * N + R[2][1] * U, dz = R[0][2] * E + R[1][2] * N + R[2][2] * U;
      return [dx * ax.right[0] + dy * ax.right[1], dx * ax.up[0] + dy * ax.up[1], -dz];
    };
    const scr = p => [v.cx + v.f * p[0] / p[2], v.cy - v.f * p[1] / p[2]];
    const polyPath = (pts3) => { const c = clipNear(pts3); if (c.length < 3) return false; const s = c.map(scr); ctx.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]); ctx.closePath(); return true; };
    // Sample the route ahead every 0.35 m.
    const S = [], a = fr.ahead; let acc = 0;
    for (let i = 1; i < a.length && acc < AHEAD; i++) {
      const [x0, y0] = a[i - 1], [x1, y1] = a[i], L = Math.hypot(x1 - x0, y1 - y0); if (L < 1e-6) continue;
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      for (let d = 0; d < L && acc + d <= AHEAD; d += 0.35) S.push({ x: x0 + ux * d, y: y0 + uy * d, ux, uy, s: acc + d });
      acc += L;
    }
    const last = a[a.length - 1]; if (S.length) { const p = S[S.length - 1]; S.push({ x: last[0], y: last[1], ux: p.ux, uy: p.uy, s: acc }); }
    // The ribbon: one filled path so overlaps at corners are not darker.
    ctx.beginPath(); let any = false;
    for (let i = 1; i < S.length; i++) {
      const p = S[i - 1], q = S[i];
      any = polyPath([cam(p.x - p.uy * RIBBON, p.y + p.ux * RIBBON), cam(q.x - q.uy * RIBBON, q.y + q.ux * RIBBON), cam(q.x + q.uy * RIBBON, q.y - q.ux * RIBBON), cam(p.x + p.uy * RIBBON, p.y - p.ux * RIBBON)]) || any;
    }
    ctx.fillStyle = 'rgba(255,199,0,0.58)'; ctx.fill();
    // Edges for contrast on light floors.
    for (const side of [1, -1]) {
      ctx.beginPath(); let pen = false;
      for (const p of S) { const c = cam(p.x - side * p.uy * RIBBON, p.y + side * p.ux * RIBBON); if (c[2] < NEAR) { pen = false; continue; } const s = scr(c); if (!pen) { ctx.moveTo(s[0], s[1]); pen = true; } else ctx.lineTo(s[0], s[1]); }
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(17,17,17,0.7)'; ctx.stroke();
    }
    // Chevrons every 1.5 m, gliding forward (still if reduced motion is on).
    const off = fr.motion === false ? 0.6 : (now / 1000 * 0.9) % 1.5;
    ctx.beginPath();
    for (let s = off; s < acc && s < AHEAD; s += 1.5) {
      const p = S.find(q => q.s >= s); if (!p) break;
      const { x, y, ux, uy } = p, n = 0.2;
      polyPath([cam(x + ux * 0.22, y + uy * 0.22), cam(x - uy * n - ux * 0.12, y + ux * n - uy * 0.12), cam(x - ux * 0.02, y - uy * 0.02), cam(x + uy * n - ux * 0.12, y - ux * n - uy * 0.12)]);
    }
    ctx.fillStyle = 'rgba(17,17,17,0.78)'; ctx.fill();
    // Destination: a ring on the floor and a post with its name.
    if (fr.dest && acc <= AHEAD + 0.5) {
      const ring = [], ring2 = [];
      for (let k = 0; k < 28; k++) { const t = k / 28 * Math.PI * 2; ring.push(cam(fr.dest.x + Math.cos(t) * 0.75, fr.dest.y + Math.sin(t) * 0.75)); ring2.push(cam(fr.dest.x + Math.cos(t) * 0.35, fr.dest.y + Math.sin(t) * 0.35)); }
      ctx.beginPath(); if (polyPath(ring)) { ctx.lineWidth = 6; ctx.strokeStyle = '#FFC700'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke(); }
      ctx.beginPath(); if (polyPath(ring2)) { ctx.fillStyle = '#111'; ctx.fill(); }
      const b = cam(fr.dest.x, fr.dest.y, 0), t = cam(fr.dest.x, fr.dest.y, 1.9);
      if (b[2] > NEAR && t[2] > NEAR) {
        const sb = scr(b), st = scr(t);
        ctx.beginPath(); ctx.moveTo(sb[0], sb[1]); ctx.lineTo(st[0], st[1]); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
        if (fr.dest.label) {
          ctx.font = '600 16px Geist, system-ui, sans-serif'; const w = ctx.measureText(fr.dest.label).width + 24;
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect?.(st[0] - w / 2, st[1] - 34, w, 32, 16); ctx.fill();
          ctx.fillStyle = '#FFC700'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fr.dest.label, st[0], st[1] - 18);
        }
      }
    }
    this.drawn++;
    // Where to look if the line is not in view.
    const tgt = S.find(q => q.s >= 3.5) || S[S.length - 1], c = cam(tgt.x, tgt.y);
    const fwd = [-R[0][2], -R[1][2], -R[2][2]];
    let hint = null;
    if (fwd[2] > 0.3) hint = 'up';
    else if (c[2] < NEAR) hint = Math.abs(c[0]) < Math.abs(c[2]) * 0.6 ? 'behind' : c[0] > 0 ? 'right' : 'left';
    else { const sx = v.cx + v.f * c[0] / c[2]; if (sx < 0) hint = 'left'; else if (sx > v.W) hint = 'right'; }
    this.setHint(hint);
    if (hint === 'left' || hint === 'right') {
      const x = hint === 'left' ? 34 : v.W - 34, y = v.H * 0.55, dir = hint === 'left' ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(x + dir * 18, y); ctx.lineTo(x - dir * 12, y - 24); ctx.lineTo(x - dir * 12, y + 24); ctx.closePath();
      ctx.fillStyle = '#FFC700'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke();
    }
  }
}

/** Reads DALIL sign QR codes from a playing <video>. onCode(text) fires once per new code. */
export class QRScanner {
  constructor(video, onCode, { every = 450 } = {}) { this.video = video; this.onCode = onCode; this.every = every; this.timer = 0; this.busy = false; this.last = ''; this.lastAt = 0; this.canvas = null; this.engine = null; }
  async engineReady() {
    if (this.engine) return this.engine;
    try {
      if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats?.())?.includes('qr_code')) {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        return (this.engine = async v => (await det.detect(v))[0]?.rawValue || null);
      }
    } catch { /* fall through to jsQR */ }
    if (!window.jsQR) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/jsqr/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    this.canvas ||= document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    return (this.engine = async v => {
      const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return null;
      const k = Math.min(1, 640 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
      this.canvas.width = cw; this.canvas.height = ch; ctx.drawImage(v, 0, 0, cw, ch);
      const img = ctx.getImageData(0, 0, cw, ch), r = window.jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' });
      return r?.data || null;
    });
  }
  start() { this.stop(); this.timer = setInterval(() => this.scan(), this.every); return this; }
  stop() { clearInterval(this.timer); this.timer = 0; }
  async scan() {
    if (this.busy || this.video.readyState < 2) return;
    this.busy = true;
    try {
      const eng = await this.engineReady(), text = await eng(this.video), t = performance.now();
      if (text && (text !== this.last || t - this.lastAt > 5000)) { this.last = text; this.lastAt = t; this.onCode(text); }
    } catch { /* keep scanning */ } finally { this.busy = false; }
  }
}
