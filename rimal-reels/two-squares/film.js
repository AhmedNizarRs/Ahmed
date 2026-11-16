/* Rimal Interiors reel: "Every star is just two squares".
   Page contract: DUR, FPS, seek(t), READY. Time is the only input. */
(() => {
  const TL = window.TL, B = TL.beats, LB = TL.labels, AR = TL.meta.lang === "ar";
  const W = 1080, H = 1920, DUR = TL.meta.dur, FPS = TL.meta.fps;
  const cv = document.getElementById("c"), ctx = cv.getContext("2d");

  const C = {
    bg: "#120c09", surface: "#1b1410", surface2: "#241a14", line: "#3a2b21",
    ink: "#efe4d2", ink2: "#b8a58d", gold: "#c9974a", goldHi: "#e6bd76", onInk: "#1a0f0a",
    wood: "#140b07", dusk: "#3d2819",
  };
  const F = AR
    ? { cap: "600 80px PlexAr", label: "600 34px PlexAr", mono: "500 40px PlexAr", foot: "500 30px PlexAr",
        title: "700 112px Kufi", sub: "500 42px PlexAr", handle: "500 54px Jost", kick: "600 34px PlexAr" }
    : { cap: "600 84px Jost", label: "600 32px Jost", mono: "500 40px Mono", foot: "400 28px Jost",
        title: "400 128px Marcellus", sub: "400 44px Jost", handle: "500 54px Jost", kick: "600 30px Mono" };

  /* ---------- time helpers ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const eIn = (x) => x * x * x;
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  // closed-form damped spring 0 -> 1, dt seconds since start
  const spring = (dt, f = 2.4, z = 0.72) => {
    if (dt <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * dt));
  };
  const mix = (c1, c2, k) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`;
  };

  /* ---------- lattice geometry ---------- */
  const O = [540, 760];          // world origin: the hero star's centre
  const A = 260;                 // lattice spacing; star radius = A/2 (tips touch)
  const R = A / 2;
  const NI = 5, NJ = 7;          // lattice extent each side of the hero star

  function squarePts(cx, cy, r, rot) {
    const pts = [];
    for (let k = 0; k < 4; k++) { const a = rot + Math.PI / 4 + (k * Math.PI) / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }

  function tiling488() {
    const polys = [], s = A / (1 + Math.SQRT2), Ro = s / (2 * Math.sin(Math.PI / 8)), q = s / Math.SQRT2;
    for (let j = -NJ; j <= NJ; j++) for (let i = -NI; i <= NI; i++) {
      const x = O[0] + i * A, y = O[1] + j * A, oct = [];
      for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; oct.push([x + Ro * Math.cos(a), y + Ro * Math.sin(a)]); }
      polys.push(oct);
      const cx = x + A / 2, cy = y + A / 2;
      polys.push([[cx, cy - q], [cx + q, cy], [cx, cy + q], [cx - q, cy]]);
    }
    return polys;
  }
  const POLYS = tiling488();

  // Hankin's method, the same as the Pattern Lab on rimal's site.
  function hankin(thetaDeg) {
    const th = (thetaDeg * Math.PI) / 180, segs = [];
    const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
    for (const poly of POLYS) {
      const n = poly.length;
      let cx = 0, cy = 0;
      poly.forEach((p) => { cx += p[0]; cy += p[1]; });
      cx /= n; cy /= n;
      const mids = [], dirs = [];
      let edge = 0;
      for (let i = 0; i < n; i++) {
        const P = poly[i], Q = poly[(i + 1) % n], dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy);
        edge = len; mids.push([(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2]); dirs.push([dx / len, dy / len]);
      }
      const inward = (v, m) => {
        const r1 = rot(v, th), r2 = rot(v, -th), tx = cx - m[0], ty = cy - m[1];
        return r1[0] * tx + r1[1] * ty >= r2[0] * tx + r2[1] * ty ? r1 : r2;
      };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, p1 = mids[i], p2 = mids[j];
        const r1 = inward(dirs[i], p1), r2 = inward([-dirs[j][0], -dirs[j][1]], p2);
        const cr = r1[0] * r2[1] - r1[1] * r2[0];
        if (Math.abs(cr) < 1e-9) continue;
        const qx = p2[0] - p1[0], qy = p2[1] - p1[1];
        const s = (qx * r2[1] - qy * r2[0]) / cr, u = (qx * r1[1] - qy * r1[0]) / cr;
        if (s <= 0 || u <= 0 || s > edge * 3 || u > edge * 3) continue;
        const X = [p1[0] + r1[0] * s, p1[1] + r1[1] * s];
        segs.push([p1[0], p1[1], X[0], X[1]], [p2[0], p2[1], X[0], X[1]]);
      }
    }
    return segs;
  }

  // stamp order: rings of equal distance from the hero star, intervals shrinking (acceleration)
  const STARS = [];
  for (let j = -NJ; j <= NJ; j++) for (let i = -NI; i <= NI; i++) STARS.push({ i, j, d: Math.hypot(i, j) });
  const ringDs = [...new Set(STARS.map((s) => +s.d.toFixed(4)))].sort((a, b) => a - b);
  STARS.forEach((s) => { s.ring = ringDs.indexOf(+s.d.toFixed(4)); });
  const stampTime = (ring) => (ring === 0 ? -1 : B["grid.start"] + 0.12 + 2.1 * (1 - Math.pow(0.74, ring)));

  /* ---------- camera ---------- */
  let cam = { S: [540, 760], Z: 1 };
  const toScr = (x, y) => [(x - O[0]) * cam.Z + cam.S[0], (y - O[1]) * cam.Z + cam.S[1]];
  function poly(pts, close = true) {
    ctx.beginPath();
    pts.forEach((p, k) => { const q = toScr(p[0], p[1]); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    if (close) ctx.closePath();
  }
  function strokeSegs(segs, color, width, alpha = 1) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath();
    for (const s of segs) { const a = toScr(s[0], s[1]), b = toScr(s[2], s[3]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.restore();
  }

  /* ---------- the star (two squares) ---------- */
  function starOutline(cx, cy, r) {   // union of the two squares: 8 tips, 8 inner corners
    const pts = [], rc = (r / Math.SQRT2) / Math.cos(Math.PI / 8);
    for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 8, rr = k % 2 ? rc : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    return pts;
  }
  function drawStar(cx, cy, opt) {
    const { scale = 1, rotB = Math.PI / 4, aA = 1, aB = 1, color = C.gold, colorB = color, width = 3, fill = null, scaleB = 1, outline = 0 } = opt;
    const r = R * scale;
    if (fill) {
      ctx.fillStyle = fill;
      poly(starOutline(cx, cy, r)); ctx.fill();
    }
    if (outline > 0) {
      ctx.lineJoin = "round"; ctx.lineWidth = width; ctx.globalAlpha = outline; ctx.strokeStyle = color;
      poly(starOutline(cx, cy, r)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.lineJoin = "round"; ctx.lineWidth = width;
    if (aA > 0) { ctx.globalAlpha = aA; ctx.strokeStyle = color; poly(squarePts(cx, cy, r, 0)); ctx.stroke(); }
    if (aB > 0) { ctx.globalAlpha = aB; ctx.strokeStyle = colorB; poly(squarePts(cx, cy, r * scaleB, rotB)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* ---------- text helpers ---------- */
  function text(str, x, y, font, color, align = "center", spacing = "0px", alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = "rgba(10,6,4,0.85)"; ctx.shadowBlur = 14; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
    ctx.textBaseline = "middle"; ctx.letterSpacing = spacing; ctx.direction = AR && /[\u0600-\u06ff]/.test(str) ? "rtl" : "ltr";
    ctx.fillText(str, x, y); ctx.restore();
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function chapterPill(t) {
    const sc = ["hook", "star", "grid", "angle", "room", "cta"];
    const chOf = { hook: 0, star: 0, grid: 1, angle: 2, room: 3, cta: 4 };
    const sid = TL.scenes.find((s) => t >= s.start && t < s.end)?.id || "cta";
    const ch = chOf[sid];
    const num = AR ? ` · ${"١٢٣٤٥"[ch]}` : `0${ch + 1} · `;
    ctx.save(); ctx.font = F.label; ctx.letterSpacing = AR ? "0px" : "3px";
    const wNum = ctx.measureText(num).width, wLab = ctx.measureText(LB.ch[ch]).width;
    const w = wNum + wLab + 64, x = 540 - w / 2, y = 134;
    rrect(x, y, w, 70, 35); ctx.fillStyle = "rgba(27,20,16,0.82)"; ctx.fill();
    ctx.strokeStyle = "rgba(239,228,210,0.10)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.direction = "ltr";
    if (AR) {
      ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.fillStyle = C.ink;
      ctx.fillText(`${"١٢٣٤٥"[ch]} · ${LB.ch[ch]}`, 540, y + 36);
    } else {
      ctx.fillStyle = C.ink2; ctx.fillText(num, x + 32, y + 36);
      ctx.fillStyle = C.ink; ctx.fillText(LB.ch[ch], x + 32 + wNum, y + 36);
    }
    // progress dashes
    for (let k = 0; k < 5; k++) {
      const kk = AR ? 4 - k : k;
      ctx.fillStyle = kk <= ch ? C.ink : "rgba(239,228,210,0.22)";
      rrect(540 - 145 + k * 60, y + 92, 46, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  function footnote(t) {
    const src = t >= B["grid.term"] && t < B["angle.start"] + 0.3;
    const a = src ? prog(t, B["grid.term"], B["grid.term"] + 0.2) * (1 - prog(t, B["angle.start"] + 0.1, B["angle.start"] + 0.3)) : 0;
    const x = AR ? W - 64 : 64, al = AR ? "right" : "left";
    text(LB.foot, x, 1546, F.foot, C.ink2, al, "0px", 0.75 * (1 - a));
    if (a > 0) text(LB.source, x, 1546, F.foot, C.ink, al, "0px", a);
  }

  /* ---------- captions: pill walks the words ---------- */
  function captions(t, y) {
    const c = TL.captions.find((c) => t >= c.from && t < c.to);
    if (!c) return;
    const words = c.text.split(" ");
    ctx.save(); ctx.font = F.cap; ctx.textBaseline = "middle"; ctx.direction = AR ? "rtl" : "ltr";
    let size = parseInt(F.cap.split(" ")[1]);
    const gap = size * 0.28;
    let ws = words.map((w) => ctx.measureText(w).width);
    let total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    let k = Math.min(1, 940 / total);
    if (k < 1) { size = Math.floor(size * k); ctx.font = F.cap.replace(/\d+px/, size + "px"); ws = words.map((w) => ctx.measureText(w).width); total = ws.reduce((a, b) => a + b, 0) + gap * k * (words.length - 1); }
    const g = gap * Math.min(1, k);
    // x positions in reading order
    const xs = []; let cur = AR ? 540 + total / 2 : 540 - total / 2;
    for (let i = 0; i < words.length; i++) {
      if (AR) { xs.push(cur - ws[i]); cur -= ws[i] + g; } else { xs.push(cur); cur += ws[i] + g; }
    }
    const n = words.length, dur = c.to - c.from;
    const step = Math.min(0.32, (dur * 0.62) / n);
    const fi = clamp((t - c.from) / step, 0, n - 1);
    const i0 = Math.floor(fi), i1 = Math.min(n - 1, i0 + 1), m = eOut(clamp((fi - i0) / 0.35));
    const px = lerp(xs[i0], xs[i1], i1 === i0 ? 0 : m), pw = lerp(ws[i0], ws[i1], i1 === i0 ? 0 : m);
    const rise = (1 - eOut(prog(t, c.from, c.from + 0.14))) * 14;
    const yy = y + rise;
    // soft shadow band for legibility over the lattice
    ctx.shadowColor = "rgba(10,6,4,0.85)"; ctx.shadowBlur = 26;
    const padX = size * 0.2, ph = size * 1.18;
    ctx.textAlign = "left"; ctx.fillStyle = C.ink; ctx.shadowColor = "rgba(10,6,4,0.9)"; ctx.shadowBlur = 22;
    for (let i = 0; i < n; i++) ctx.fillText(words[i], xs[i], yy + size * 0.04);
    ctx.shadowColor = "rgba(10,6,4,0.6)"; ctx.shadowBlur = 18;
    rrect(px - padX, yy - ph / 2, pw + padX * 2, ph, size * 0.24);
    ctx.fillStyle = C.ink; ctx.fill();
    ctx.shadowBlur = 0; ctx.clip();
    ctx.fillStyle = C.onInk;
    for (let i = 0; i < n; i++) ctx.fillText(words[i], xs[i], yy + size * 0.04);
    ctx.restore();
  }

  /* ---------- scenes ---------- */
  function background(color = C.bg) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
    // hue-tinted vignette, no pure black
    const g = ctx.createRadialGradient(540, 820, 200, 540, 900, 1250);
    g.addColorStop(0, "rgba(59,31,23,0.32)"); g.addColorStop(1, "rgba(10,6,4,0.55)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // The opening wall, the hero star's close-up and the grid stamp all draw from here.
  function latticeStars(t) {
    const zoomIn = eIO(prog(t, B["star.start"], B["star.zoomEnd"]));
    const zoomOut = eIO(prog(t, B["grid.start"], B["grid.start"] + 1.3));
    const Zclose = 300 / R;
    let Z = lerp(0.94, 1.04, eIO(prog(t, 0, B["star.start"])));
    Z = lerp(Z, Zclose, zoomIn);
    Z = lerp(Z, 0.85, zoomOut);
    // slow drift so reading holds never go dead
    Z *= 1 + 0.035 * eIO(prog(t, B["star.zoomEnd"], B["grid.start"])) + 0.05 * eIO(prog(t, B["grid.start"] + 1.3, B["angle.start"] + 0.8));
    cam = { S: [540, 760], Z };
    const wid = 3.2;

    // crosses: the gaps tinted with a ripple from the centre
    const crossA = prog(t, B["grid.cross"], B["grid.cross"] + 0.9);
    const crossOff = 1 - prog(t, B["angle.start"], B["angle.start"] + 0.6);
    if (crossA > 0 && crossOff > 0) {
      ctx.save(); ctx.globalAlpha = 0.34 * crossOff;
      const r = 40 + 1500 * eOut(crossA);
      const g = ctx.createRadialGradient(540, 760, 0, 540, 760, r);
      g.addColorStop(0, C.gold); g.addColorStop(0.92, C.gold); g.addColorStop(1, "rgba(201,151,74,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    const others = t < B["grid.start"]
      ? 1 - prog(t, B["star.start"] + 0.1, B["star.zoomEnd"] - 0.1)
      : 0;
    const linesOff = 1 - prog(t, B["angle.start"], B["angle.start"] + 0.7); // square interiors dissolve into Hankin
    for (const s of STARS) {
      const cx = O[0] + s.i * A, cy = O[1] + s.j * A;
      if (s.ring === 0) continue;
      let a, sc = 1;
      if (t < B["grid.start"]) a = others;
      else {
        const ts = stampTime(s.ring), k = prog(t, ts, ts + 0.24);
        a = k; sc = lerp(0.55, 1, spring(t - ts, 2.6, 0.7));
      }
      a *= linesOff;
      if (a <= 0.003) continue;
      const fill = crossA > 0 ? C.bg : null;
      ctx.globalAlpha = a;
      if (fill) { ctx.globalAlpha = 1; drawStar(cx, cy, { scale: sc, aA: 0, aB: 0, fill: mix(C.bg, "#2a1b12", 0.25) }); }
      drawStar(cx, cy, { scale: sc, aA: a * 0.3, aB: a * 0.3, width: wid * 0.8, outline: a, });
    }
    heroStar(t, wid, linesOff, crossA);
  }

  function heroStar(t, wid, linesOff, crossA) {
    const cx = O[0], cy = O[1];
    let aA = 1, aB = 1, rotB = Math.PI / 4, scaleB = 1, colorB = C.gold;
    if (t >= B["star.start"] && t < B["grid.start"]) {
      // drop the second square, then copy it back and turn it 45 degrees
      const drop = prog(t, B["star.dropB"], B["star.dropB"] + 0.3);
      const copy = t >= B["star.copy"];
      if (!copy) aB = 1 - drop;
      else {
        aB = prog(t, B["star.copy"], B["star.copy"] + 0.18);
        scaleB = lerp(1.14, 1, spring(t - B["star.copy"], 2.2, 0.7));
        const turn = spring(t - B["star.turn"], 1.5, 0.78);
        rotB = t < B["star.turn"] ? 0 : (Math.PI / 4) * turn;
        colorB = mix(C.goldHi, C.gold, prog(t, B["star.turnEnd"], B["star.turnEnd"] + 0.6));
      }
    }
    const inner = lerp(0.3, 1, prog(t, B["star.start"], B["star.zoomEnd"])) * (1 - 0.7 * prog(t, B["grid.start"] + 0.2, B["grid.start"] + 1.2));
    const outl = (1 - prog(t, B["star.start"], B["star.zoomEnd"])) + prog(t, B["grid.start"] + 0.2, B["grid.start"] + 1.2);
    if (crossA > 0) drawStar(cx, cy, { aA: 0, aB: 0, fill: mix(C.bg, "#2a1b12", 0.25) });
    drawStar(cx, cy, { aA: aA * inner * linesOff, aB: aB * inner * linesOff, rotB, scaleB, colorB, width: wid, outline: clamp(outl) * linesOff });

    if (t >= B["star.start"] && t < B["grid.start"] + 0.6) {
      // 45 degree arc readout
      const arcA = prog(t, B["star.turn"] - 0.1, B["star.turn"] + 0.1) * (1 - prog(t, B["star.tips"] + 0.4, B["star.tips"] + 0.8));
      if (arcA > 0 && rotB > 0.01) {
        const [sx, sy] = toScr(cx, cy), rr = R * cam.Z + 54;
        const turn = rotB;
        ctx.save(); ctx.globalAlpha = arcA; ctx.strokeStyle = C.ink2; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(sx, sy, rr, -Math.PI / 4 - turn, -Math.PI / 4, false); ctx.stroke(); ctx.setLineDash([]);
        const am = -Math.PI / 4 - turn / 2;
        text(`${Math.min(45, Math.round((turn * 180) / Math.PI))}°`, sx + Math.cos(am) * (rr + 62), sy + Math.sin(am) * (rr + 62), F.mono, C.goldHi, "center");
        ctx.restore();
      }
      // eight tips, counted with accelerating ticks
      const tipsA = 1 - prog(t, B["grid.start"] + 0.2, B["grid.start"] + 0.6);
      const offs = [0, 0.16, 0.3, 0.42, 0.52, 0.6, 0.67, 0.73];
      for (let k = 0; k < 8; k++) {
        const tk = B["star.tips"] + offs[k];
        if (t < tk) continue;
        const ang = -Math.PI / 2 + (k * Math.PI) / 4;
        const [px, py] = toScr(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
        const pop = spring(t - tk, 3, 0.55);
        ctx.save(); ctx.globalAlpha = tipsA; ctx.fillStyle = C.goldHi;
        ctx.beginPath(); ctx.arc(px, py, 11 * pop, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // the name
      const nameA = prog(t, 8.44, 8.64) * (1 - prog(t, B["grid.start"] + 0.3, B["grid.start"] + 0.6));
      if (nameA > 0) text(LB.name, 540, 1138, F.mono, C.goldHi, "center", AR ? "0px" : "4px", nameA);
    }
  }

  function termLabel(t) {
    const a = prog(t, B["grid.term"], B["grid.term"] + 0.18) * (1 - prog(t, B["angle.start"] + 0.2, B["angle.start"] + 0.45));
    if (a > 0) {
      ctx.save(); ctx.font = F.mono; ctx.letterSpacing = AR ? "0px" : "4px";
      const w = ctx.measureText(LB.term).width + 56;
      rrect(540 - w / 2, 1100, w, 76, 38); ctx.globalAlpha = a; ctx.fillStyle = "rgba(18,12,9,0.88)"; ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      text(LB.term, 540, 1139, F.mono, C.goldHi, "center", AR ? "0px" : "4px", a);
    }
  }

  function thetaAt(t) {
    return lerp(45, 72.5, eIO(prog(t, B["angle.morph"], B["angle.morphEnd"])));
  }

  function angleScene(t) {
    const Z = lerp(0.85, 0.76, eIO(prog(t, B["angle.start"], B["room.start"])));
    cam = { S: [540, 760], Z };
    const th = thetaAt(t);
    // the hidden grid, shown on "Same grid."
    const gridA = 0.55 * prog(t, 17.3, 17.6) * (1 - prog(t, 19.3, 19.8));
    if (gridA > 0) {
      ctx.save(); ctx.globalAlpha = gridA; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]);
      for (const p of POLYS) { poly(p); ctx.stroke(); }
      ctx.restore();
    }
    strokeSegs(hankin(th), C.gold, 3.4, prog(t, B["angle.start"] + 0.1, B["angle.start"] + 0.7));
    // contact-angle readout, like the Pattern Lab slider
    const ra = prog(t, B["angle.start"] + 0.5, B["angle.start"] + 0.8) * (1 - prog(t, B["room.start"] - 0.3, B["room.start"]));
    if (ra > 0) slider(t, th, 1080, ra, 45, 72.5);
  }

  function slider(t, th, y, a, lo, hi) {
    ctx.save(); ctx.globalAlpha = a;
    rrect(140, y - 70, 800, 150, 30); ctx.fillStyle = "rgba(18,12,9,0.9)"; ctx.fill();
    ctx.strokeStyle = "rgba(239,228,210,0.12)"; ctx.lineWidth = 2; ctx.stroke();
    const x0 = 190, x1 = 890, k = (th - lo) / (hi - lo);
    const kx = AR ? x1 - (x1 - x0) * k : x0 + (x1 - x0) * k;
    ctx.lineCap = "round"; ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(239,228,210,0.18)"; ctx.beginPath(); ctx.moveTo(x0, y + 30); ctx.lineTo(x1, y + 30); ctx.stroke();
    ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.moveTo(AR ? x1 : x0, y + 30); ctx.lineTo(kx, y + 30); ctx.stroke();
    ctx.fillStyle = C.goldHi; ctx.beginPath(); ctx.arc(kx, y + 30, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    text(LB.angle, AR ? x1 : x0, y - 22, F.label, C.ink2, AR ? "right" : "left", AR ? "0px" : "3px", a);
    text(`${th.toFixed(1)}°`, AR ? x0 : x1, y - 22, F.mono, C.ink, AR ? "left" : "right", "0px", a);
  }

  /* ---------- the room (mashrabiya) ---------- */
  const VP = [540, 790], BW = [200, 470, 880, 1110], WR = [330, 520, 750, 1040];
  const fp = (X, s, lat) => [540 + (X - 540 - lat * (s - 1)) * s, VP[1] + 320 * s];  // floor point at depth s

  function homography(q) {
    // unit square -> quad q = [p00, p10, p11, p01]
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
  }

  function roomScene(t) {
    const tin = eIO(prog(t, B["room.start"], B["room.inEnd"]));
    const roomA = prog(t, B["room.start"] + 0.3, B["room.inEnd"]);
    const L = expoOut(prog(t, B.hero, B.hero + 0.18));            // sunlight
    const push = eIO(prog(t, B["room.push"], B["cta.start"]));
    const th = 72.5;
    const segs = hankin(th);

    ctx.save();
    // slow push into the light on the floor (the breath before the CTA)
    const pz = (1 + 0.32 * push) * (1 + 0.04 * eIO(prog(t, B["room.inEnd"], B.hero)) + 0.03 * prog(t, B.hero, B["room.push"])), pc = [540, 1360];
    ctx.translate(pc[0], pc[1]); ctx.scale(pz, pz); ctx.translate(-pc[0], -pc[1]);

    if (roomA > 0) {
      ctx.globalAlpha = roomA;
      const P = (pts, fill) => { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
      const lit = (c) => mix(c, "#5a3a22", 0.35 * L);
      P([[BW[0], BW[1]], [BW[2], BW[1]], [1380, 0], [-300, 0]], lit("#130d09"));
      P([[BW[0], BW[1]], [BW[0], BW[3]], [-660, 1920], [-300, 0]], lit("#1a120d"));
      P([[BW[2], BW[1]], [BW[2], BW[3]], [1740, 1920], [1380, 0]], lit("#1a120d"));
      P([[BW[0], BW[3]], [BW[2], BW[3]], [1740, 1920], [-660, 1920]], lit("#17100c"));
      P([[BW[0], BW[1]], [BW[2], BW[1]], [BW[2], BW[3]], [BW[0], BW[3]]], lit("#22180f"));
      // floor tiles converging on the vanishing point
      ctx.strokeStyle = "rgba(90,66,48,0.35)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let X = BW[0]; X <= BW[2] + 1; X += 85) { const a = fp(X, 1, 0), b = fp(X, 3.6, 0); ctx.moveTo(...a); ctx.lineTo(...b); }
      for (const s of [1.25, 1.62, 2.12, 2.85]) { const a = fp(-400, s, 0), b = fp(1500, s, 0); ctx.moveTo(...a); ctx.lineTo(...b); }
      ctx.stroke();
      ctx.strokeStyle = "rgba(120,90,62,0.45)"; ctx.lineWidth = 2; ctx.beginPath();
      [[BW[0], BW[1], -300, 0], [BW[2], BW[1], 1380, 0], [BW[0], BW[3], -660, 1920], [BW[2], BW[3], 1740, 1920]].forEach(([a, b, c, d]) => { ctx.moveTo(a, b); ctx.lineTo(c, d); });
      ctx.rect(BW[0], BW[1], BW[2] - BW[0], BW[3] - BW[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // clip shrinks from the full frame into the window: the pattern becomes the screen
    const clip = [lerp(0, WR[0], tin), lerp(0, WR[1], tin), lerp(W, WR[2], tin), lerp(H, WR[3], tin)];
    const zW = 0.42;
    cam = { S: [lerp(540, 540, tin), lerp(760, 780, tin)], Z: lerp(0.76, zW, tin) };
    ctx.save();
    ctx.beginPath(); ctx.rect(clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1]); ctx.clip();
    ctx.fillStyle = mix(C.bg, C.dusk, tin); ctx.fillRect(0, 0, W, H);
    if (L > 0) {
      const g = ctx.createRadialGradient(610, 690, 20, 560, 780, 420);
      g.addColorStop(0, "#fff4dc"); g.addColorStop(1, "#f0c47e");
      ctx.globalAlpha = L; ctx.fillStyle = g; ctx.fillRect(WR[0], WR[1], WR[2] - WR[0], WR[3] - WR[1]); ctx.globalAlpha = 1;
    }
    const lineCol = tin < 1 ? mix(C.gold, C.wood, tin) : C.wood;
    strokeSegs(segs, lineCol, lerp(3.4, 8.5, tin));
    ctx.restore();
    if (tin > 0.98) {   // window frame
      ctx.strokeStyle = "#0e0805"; ctx.lineWidth = 12; ctx.strokeRect(WR[0], WR[1], WR[2] - WR[0], WR[3] - WR[1]);
    }

    if (L > 0) {
      const lat = lerp(60, -10, eIO(prog(t, B.hero, B["cta.start"])));
      const sF = 1.08, sN = 2.2;
      const q = [fp(WR[0], sN, lat), fp(WR[2], sN, lat), fp(WR[2], sF, lat), fp(WR[0], sF, lat)];
      const Hm = homography(q);
      const reveal = eOut(prog(t, B.hero, B.hero + 0.55));
      // beam
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const bg = ctx.createLinearGradient(0, WR[1], 0, q[0][1]);
      bg.addColorStop(0, `rgba(240,196,126,${0.16 * L})`); bg.addColorStop(1, `rgba(240,196,126,${0.04 * L})`);
      ctx.fillStyle = bg; ctx.beginPath();
      ctx.moveTo(WR[0], WR[1]); ctx.lineTo(WR[2], WR[1]); ctx.lineTo(WR[2], WR[3]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[0][0], q[0][1]); ctx.lineTo(WR[0], WR[3]);
      ctx.closePath(); ctx.fill(); ctx.restore();
      // the patch, revealed from the wall towards us
      const v0 = 1 - reveal;
      const quad = [Hm(0, v0), Hm(1, v0), Hm(1, 1), Hm(0, 1)];
      ctx.save(); ctx.beginPath(); quad.forEach((p, k) => (k ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.clip();
      const pg = ctx.createLinearGradient(0, q[2][1], 0, q[0][1]);
      pg.addColorStop(0, "rgba(255,236,200,0.95)"); pg.addColorStop(1, "rgba(230,189,118,0.62)");
      ctx.fillStyle = pg; ctx.fillRect(-200, 900, 1500, 1100);
      ctx.strokeStyle = "rgba(34,22,14,0.92)"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.beginPath();
      for (const s of segs) {
        const a = toScr(s[0], s[1]), b = toScr(s[2], s[3]);
        const ua = (a[0] - WR[0]) / (WR[2] - WR[0]), va = (a[1] - WR[1]) / (WR[3] - WR[1]);
        const ub = (b[0] - WR[0]) / (WR[2] - WR[0]), vb = (b[1] - WR[1]) / (WR[3] - WR[1]);
        if (Math.min(ua, ub) < -0.3 || Math.max(ua, ub) > 1.3 || Math.min(va, vb) < -0.3 || Math.max(va, vb) > 1.3) continue;
        ctx.moveTo(...Hm(ua, va)); ctx.lineTo(...Hm(ub, vb));
      }
      ctx.stroke(); ctx.restore();
      // warm bounce light in the room
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const wg = ctx.createRadialGradient(470, 1330, 60, 470, 1300, 900);
      wg.addColorStop(0, `rgba(240,196,126,${0.22 * L})`); wg.addColorStop(1, "rgba(240,196,126,0)");
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- CTA ---------- */
  function ctaScene(t) {
    const dt = t - B["cta.start"];
    cam = { S: [540, 760], Z: 0.8 };
    const th = 66 + 8 * Math.sin(dt * 0.9 - 0.4);            // the wall keeps redesigning itself
    strokeSegs(hankin(th), C.gold, 3, 0.38);
    const g = ctx.createLinearGradient(0, 380, 0, 1400);
    g.addColorStop(0, "rgba(18,12,9,0)"); g.addColorStop(0.5, "rgba(18,12,9,0.55)"); g.addColorStop(1, "rgba(18,12,9,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const s = lerp(0.94, 1, spring(dt, 2.2, 0.8)), a = prog(dt, 0, 0.2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(540, 790); ctx.scale(s, s); ctx.translate(-540, -790);
    rrect(140, 470, 800, 640, 36); ctx.fillStyle = "rgba(27,20,16,0.95)"; ctx.fill();
    ctx.strokeStyle = "rgba(201,151,74,0.55)"; ctx.lineWidth = 2; ctx.stroke();
    // mini star mark: two squares
    cam = { S: [540, 600], Z: 0.36 };
    drawStar(O[0], O[1], { width: 3, color: C.goldHi });
    text(LB.cardKick, 540, 712, F.kick, C.gold, "center", AR ? "0px" : "5px");
    text(LB.cardTitle, 540, 818, F.title, C.ink, "center");
    text(LB.cardSub, 540, 912, F.sub, C.ink2, "center");
    ctx.restore();
    if (a > 0) slider(t, th, 1012, a * prog(dt, 0.3, 0.6), 50, 82);
    text(LB.handle, 540, 1180, F.handle, C.ink, "center", "1px", prog(dt, 0.5, 0.8));
  }

  /* ---------- frame ---------- */
  function seek(t) {
    t = clamp(t, 0, DUR - 1e-6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0;
    background();
    let capY = 1290;
    if (t < B["angle.start"] + 0.8) latticeStars(t);
    if (t >= B["angle.start"] && t < B["room.start"]) angleScene(t);
    if (t >= B["room.start"] && t < B["cta.start"]) { roomScene(t); capY = 372; }
    if (t >= B["cta.start"]) ctaScene(t);
    termLabel(t);
    chapterPill(t);
    footnote(t);
    captions(t, capY);
  }

  window.DUR = DUR; window.FPS = FPS; window.seek = seek;
  window.READY = (async () => {
    const fams = AR ? ["600 80px PlexAr", "500 40px PlexAr", "700 112px Kufi", "500 54px Jost"]
                    : ["600 84px Jost", "400 28px Jost", "500 40px Mono", "400 128px Marcellus"];
    await Promise.all(fams.map((f) => document.fonts.load(f, AR ? "مربّعان ۞" : "Ab ۞")));
    await document.fonts.ready;
    seek(0);
    return true;
  })();
})();
