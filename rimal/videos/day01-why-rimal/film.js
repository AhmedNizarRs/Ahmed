// Rimal Interiors, Day 1: "Why we're called Rimal".
// Every frame is a pure function of t. Beats come from timeline.json (the one source of truth).
(() => {
  const W = 1080, H = 1920;
  const COL = {
    bg: "#120c09", ink: [239, 228, 210], gold: [201, 151, 74], goldHi: [230, 189, 118],
    dune: [168, 132, 84],
  };
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");

  // ---------- math ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, d) => clamp((t - a) / d);
  function bezierEase(x1, y1, x2, y2) {
    const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, m = x;
      for (let i = 0; i < 24; i++) { m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
      return by(m);
    };
  }
  const eOut = bezierEase(0.16, 1, 0.3, 1);     // entrances
  const eIn = bezierEase(0.6, 0, 0.9, 0.35);    // exits
  const eIO = bezierEase(0.65, 0, 0.35, 1);     // moves between states
  const cubic = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
  };

  // ---------- polylines ----------
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }
  function resample(pts, n) {
    const L = polyLen(pts), out = [];
    let seg = 1, acc = 0;
    for (let i = 0; i < n; i++) {
      const target = (L * i) / (n - 1);
      while (seg < pts.length - 1 && acc + Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]) < target) {
        acc += Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]);
        seg++;
      }
      const a = pts[seg - 1], b = pts[seg];
      const sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const u = clamp((target - acc) / sl);
      out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
    }
    return out;
  }
  function strokePartial(pts, p) {
    if (p <= 0) return;
    const L = polyLen(pts) * Math.min(1, p);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const sl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + sl >= L) {
        const u = (L - acc) / (sl || 1);
        ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
        break;
      }
      ctx.lineTo(pts[i][0], pts[i][1]);
      acc += sl;
    }
    ctx.stroke();
  }
  function samplePolys(polys, n, rnd) {
    const lens = polys.map((p) => polyLen(p.pts));
    const total = lens.reduce((a, b) => a + b, 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      let d = rnd() * total, k = 0;
      while (k < polys.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
      const pts = polys[k].pts;
      let acc = 0;
      for (let j = 1; j < pts.length; j++) {
        const sl = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
        if (acc + sl >= d || j === pts.length - 1) {
          const u = clamp((d - acc) / (sl || 1));
          out.push({ x: lerp(pts[j - 1][0], pts[j][0], u), y: lerp(pts[j - 1][1], pts[j][1], u), c: polys[k].c });
          break;
        }
        acc += sl;
      }
    }
    return out;
  }

  // ---------- world geometry ----------
  const M = 140;                // points per bridge line
  const K = 12;                 // bridge lines: dune ridges -> walls
  const DUNE_X0 = 70, DUNE_X1 = 1010;
  function duneY(k, x) {
    const p1 = Math.exp(-Math.pow((x - 430) / (x < 430 ? 300 : 150), 2)); // gentle windward, steep slip face
    const p2 = 0.62 * Math.exp(-Math.pow((x - 790) / (x < 790 ? 220 : 120), 2));
    const A = 330 * (1 - k / 13);
    return 1010 + k * 30 - A * (p1 + p2) + 5 * Math.sin(x * 0.018 + k * 1.3);
  }
  const dunePts = [];
  for (let k = 0; k < K; k++) {
    const pts = [];
    for (let j = 0; j < M; j++) {
      const x = lerp(DUNE_X0, DUNE_X1, j / (M - 1));
      pts.push([x, duneY(k, x)]);
    }
    dunePts.push(pts);
  }
  // Floor plan: room 170..910 x 720..1360, walls 20 px thick, door gap 560..700 on the bottom wall.
  const R = { x0: 170, x1: 910, y0: 720, y1: 1360, th: 20 };
  const arc = [];
  for (let i = 0; i <= 24; i++) {
    const a = -(Math.PI / 2) * (i / 24);
    arc.push([560 + 140 * Math.cos(a), 1350 + 140 * Math.sin(a)]);
  }
  const planRaw = [
    { pts: [[R.x0, R.y0], [R.x1, R.y0]], w: 3.5 },                                   // outer top
    { pts: [[R.x0 + R.th, R.y0 + R.th], [R.x1 - R.th, R.y0 + R.th]], w: 2 },          // inner top (feature wall)
    { pts: [[R.x0, R.y0], [R.x0, R.y1]], w: 3.5 },                                    // outer left
    { pts: [[R.x0 + R.th, R.y0 + R.th], [R.x0 + R.th, R.y1 - R.th]], w: 2 },
    { pts: [[R.x1, R.y0], [R.x1, R.y1]], w: 3.5 },                                    // outer right
    { pts: [[R.x1 - R.th, R.y0 + R.th], [R.x1 - R.th, R.y1 - R.th]], w: 2 },
    { pts: [[R.x0, R.y1], [560, R.y1]], w: 3.5 },                                     // outer bottom left
    { pts: [[R.x0 + R.th, R.y1 - R.th], [560, R.y1 - R.th]], w: 2 },
    { pts: [[700, R.y1], [R.x1, R.y1]], w: 3.5 },                                     // outer bottom right
    { pts: [[700, R.y1 - R.th], [R.x1 - R.th, R.y1 - R.th]], w: 2 },
    { pts: arc, w: 1.5 },                                                             // door swing
    { pts: [[560, 1350], [560, 1210]], w: 2.5 },                                      // door leaf
  ];
  // Order dune lines top->bottom onto walls so lines travel short distances.
  const planOrder = [0, 1, 2, 3, 4, 5, 10, 11, 6, 7, 8, 9];
  const planPts = planOrder.map((i) => resample(planRaw[i].pts, M));
  const planW = planOrder.map((i) => planRaw[i].w);

  // Furniture: living zone left, dining zone right. Each item = list of polylines.
  function chair(cx, cy, side) {
    const s = 20, b = side * (s + 7);
    return [rect(cx - s, cy - s, cx + s, cy + s), [[cx + b, cy - s + 2], [cx + b, cy + s - 2]]];
  }
  const items = [
    { name: "sofa", polys: [rect(220, 1190, 500, 1290), rect(220, 1262, 500, 1290), rect(220, 1190, 246, 1290), rect(474, 1190, 500, 1290),
        [[322, 1190], [322, 1262]], [[398, 1190], [398, 1262]]] },
    { name: "armchair", polys: [rect(215, 985, 305, 1075), rect(215, 985, 238, 1075)] },
    { name: "coffee", polys: [rect(335, 1045, 455, 1125), rect(347, 1057, 443, 1113)] },
    { name: "table", polys: [rect(650, 950, 800, 1170)] },
  ];
  [990, 1060, 1130].forEach((y) => items.push({ name: "chairL", polys: chair(615, y, -1) }));
  [990, 1060, 1130].forEach((y) => items.push({ name: "chairR", polys: chair(835, y, 1) }));
  // Interleave chairs left/right so the repeats ping-pong across the table.
  const chairOrder = [4, 7, 5, 8, 6, 9];
  const itemOrder = [0, 1, 2, 3, ...chairOrder];

  // Mashrabiya band on the feature wall: 8-point stars (square + 45° square), inner diamond.
  const band = { x0: 215, x1: 865, y0: 765, y1: 875 };
  function sq(cx, cy, h, rot) {
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const a = rot + Math.PI / 4 + (i * Math.PI) / 2;
      pts.push([cx + h * Math.SQRT2 * Math.cos(a), cy + h * Math.SQRT2 * Math.sin(a)]);
    }
    return pts;
  }
  const tiles = [];
  for (let i = 0; i < 5; i++) {
    const cx = 280 + i * 130, cy = 820;
    tiles.push([sq(cx, cy, 38, 0), sq(cx, cy, 38, Math.PI / 4), sq(cx, cy, 17, Math.PI / 4), sq(cx, cy, 55, 0)]);
  }
  const bandLines = [[[band.x0, band.y0], [band.x1, band.y0]], [[band.x0, band.y1], [band.x1, band.y1]]];

  // ---------- state built at load ----------
  let TL, B = {};
  let grains1 = [], grains2 = [];
  let glyphBox = null, bgCanvas = null, logoImg = null;
  const LOGO = { w: 640, h: 640 * 163 / 560, cx: 540, cy: 820 };
  LOGO.x = LOGO.cx - LOGO.w / 2; LOGO.y = LOGO.cy - LOGO.h / 2;
  const WORD = { text: "رمال", font: '700 340px "Reem Kufi"', x: 540, y: 905 };

  const cam = (t) => 1 + 0.18 * eIO(prog(t, B["hero.hero"], 2.5));
  const PIV = [540, 1000];

  function buildBackground() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = W; bgCanvas.height = H;
    const g = bgCanvas.getContext("2d");
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    const light = g.createRadialGradient(540, 900, 0, 540, 900, 950);
    light.addColorStop(0, "rgba(201,151,74,0.10)");
    light.addColorStop(0.55, "rgba(201,151,74,0.035)");
    light.addColorStop(1, "rgba(201,151,74,0)");
    g.fillStyle = light; g.fillRect(0, 0, W, H);
    const vig = g.createRadialGradient(540, 960, 600, 540, 960, 1250);
    vig.addColorStop(0, "rgba(8,5,3,0)");
    vig.addColorStop(1, "rgba(8,5,3,0.55)");
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
  }

  function buildGrains1() {
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const g = off.getContext("2d");
    g.font = WORD.font; g.textAlign = "center"; g.direction = "rtl"; g.fillStyle = "#fff";
    g.fillText(WORD.text, WORD.x, WORD.y);
    const data = g.getImageData(0, 0, W, H).data;
    const px = [];
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 140) {
        px.push([x, y]);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    glyphBox = { x0, x1, y0, y1 };
    const rnd = mulberry32(7);
    const N = 5000;
    const perLine = Math.ceil(N / K);
    const tDis = B["sand.dissolve"], tCon = B["sand.contour"];
    for (let i = 0; i < N; i++) {
      const p = px[Math.floor(rnd() * px.length)];
      const k = i % K;
      const s = clamp((Math.floor(i / K) + rnd() * 0.9) / perLine);
      const tx = lerp(DUNE_X0, DUNE_X1, s);
      const ux = (p[0] - x0) / Math.max(1, x1 - x0);
      grains1.push({
        x0: p[0], y0: p[1], k, s, tx, ty: duneY(k, tx),
        jit: (rnd() * 2 - 1) * (4 + 6 * rnd()),
        rel: tDis + 0.8 * ux + 0.12 * rnd(),
        dur: 1.25 + 0.45 * rnd(),
        c1x: 120 + 220 * rnd(), c1y: -50 - 90 * rnd(),
        c2x: -60 - 110 * rnd(), c2y: -90 - 80 * rnd(),
        slide: tCon + 0.6 * s,
        size: 2.0 + 1.0 * rnd(),
      });
    }
  }

  // Anticipation: during the hook's reading hold, wind starts lifting a few grains off the
  // letters, more and more often, so the dissolve at 6.0 s is set up rather than sudden.
  let lift = [];
  function buildLift() {
    const rnd = mulberry32(23);
    const src = grains1;
    for (let i = 0; i < 260; i++) {
      const g = src[Math.floor(rnd() * src.length)];
      lift.push({
        x0: g.x0, y0: g.y0,
        ts: 2.6 + 3.3 * Math.sqrt(rnd()),          // denser toward the dissolve
        life: 0.9 + 0.6 * rnd(),
        dx: 70 + 150 * rnd(), dy: -20 - 50 * rnd(),
        size: 1.6 + 1.0 * rnd(),
      });
    }
  }
  function liftPos(p, t) {
    const u = (t - p.ts) / p.life;
    if (u < 0 || u > 1) return null;
    const e = eOut(u);
    return [p.x0 + p.dx * e, p.y0 + p.dy * e + 12 * Math.sin(u * 3.1), u];
  }
  function drawLift(t) {
    if (t < 2.6 || t > B["sand.dissolve"] + 1.6) return;
    for (const p of lift) {
      const q = liftPos(p, t);
      if (!q) continue;
      ctx.fillStyle = rgba(mixC(COL.goldHi, COL.dune, q[2]), 0.9 * (1 - q[2]));
      ctx.fillRect(q[0] - p.size / 2, q[1] - p.size / 2, p.size, p.size);
    }
  }

  function grain1Pos(g, t) {
    if (t < g.rel) return [g.x0, g.y0, 0];
    const u = eIO(prog(t, g.rel, g.dur));
    const ty = g.ty + g.jit * (1 - eIO(prog(t, g.slide, 0.9)));
    if (u >= 1) return [g.tx, ty, 1];
    return [
      cubic(g.x0, g.x0 + g.c1x, g.tx + g.c2x, g.tx, u),
      cubic(g.y0, g.y0 + g.c1y, ty + g.c2y, ty, u),
      u,
    ];
  }

  function worldPolysAtGather() {
    const polys = [];
    planPts.forEach((pts) => polys.push({ pts, c: COL.ink }));
    items.forEach((it) => it.polys.forEach((pts) => polys.push({ pts, c: COL.ink })));
    tiles.forEach((tl) => tl.forEach((pts) => polys.push({ pts, c: COL.goldHi })));
    bandLines.forEach((pts) => polys.push({ pts, c: COL.goldHi }));
    return polys;
  }

  function buildGrains2() {
    const off = document.createElement("canvas");
    off.width = Math.round(LOGO.w); off.height = Math.round(LOGO.h);
    const g = off.getContext("2d");
    g.drawImage(logoImg, 0, 0, off.width, off.height);
    const data = g.getImageData(0, 0, off.width, off.height).data;
    const px = [];
    for (let y = 0; y < off.height; y++) for (let x = 0; x < off.width; x++) {
      const i = (y * off.width + x) * 4;
      if (data[i + 3] > 160) px.push([x, y, data[i], data[i + 1], data[i + 2]]);
    }
    const rnd = mulberry32(11);
    const N = 5200;
    const z = 1.18;
    const src = samplePolys(worldPolysAtGather(), N, rnd);
    const tG = B["end.gather"];
    for (let i = 0; i < N; i++) {
      const s = src[i];
      const sx = PIV[0] + (s.x - PIV[0]) * z, sy = PIV[1] + (s.y - PIV[1]) * z;
      const p = px[Math.floor(rnd() * px.length)];
      const tx = LOGO.x + p[0], ty = LOGO.y + p[1];
      const d = Math.hypot(tx - sx, ty - sy) / 900;
      grains2.push({
        x0: sx, y0: sy, tx, ty, c0: s.c, c1: [p[2], p[3], p[4]],
        rel: tG + 0.15 + 0.3 * clamp(d) + 0.1 * rnd(),
        dur: 0.9 + 0.3 * rnd(),
        c1x: (rnd() * 2 - 1) * 90, c1y: -110 - 90 * rnd(),
        c2x: (rnd() * 2 - 1) * 120, c2y: -130 - 60 * rnd(),
        size: 2.0 + 0.9 * rnd(),
      });
    }
  }

  function grain2Pos(g, t) {
    const u = eIO(prog(t, g.rel, g.dur));
    return [
      cubic(g.x0, g.x0 + g.c1x, g.tx + g.c2x, g.tx, u),
      cubic(g.y0, g.y0 + g.c1y, g.ty + g.c2y, g.ty, u),
      u,
    ];
  }

  // ---------- text ----------
  // A text block: lines of segments [{s, c}], centred at x=540.
  const BLOCKS = [];
  function block(id, lines, font, size, y0, lh, enter, exit, alpha = 1) {
    BLOCKS.push({ id, lines: lines.map((l) => (typeof l === "string" ? [{ s: l, c: COL.ink }] : l)), font, size, y0, lh, enter, exit, alpha });
  }
  function drawBlock(b, t) {
    const a = b.enter === null ? 1 : eOut(prog(t, b.enter, 0.6));
    const o = b.exit === null ? 0 : eIn(prog(t, b.exit, 0.3));
    const alpha = a * (1 - o) * b.alpha;
    if (alpha <= 0.001) return;
    const dy = (1 - a) * 24 - o * 12;
    ctx.font = b.font;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    b.lines.forEach((segs, i) => {
      const wTot = segs.reduce((acc, sg) => acc + ctx.measureText(sg.s).width, 0);
      let x = 540 - wTot / 2;
      segs.forEach((sg) => {
        ctx.fillStyle = rgba(sg.c, alpha);
        ctx.fillText(sg.s, x, b.y0 + i * b.lh + dy);
        x += ctx.measureText(sg.s).width;
      });
    });
  }
  function blockBox(b) {
    ctx.font = b.font;
    const segs = b.lines[0];
    const w = segs.reduce((acc, sg) => acc + ctx.measureText(sg.s).width, 0);
    const m = ctx.measureText(segs.map((s) => s.s).join(""));
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
    return [Math.round(540 - w / 2) - 4, Math.round(b.y0 - asc) - 4, Math.round(w) + 8, Math.round(asc + desc) + 8];
  }

  function defineTexts() {
    const D = (px) => `${px}px "Marcellus"`;
    const J = (px, w = 500) => `${w} ${px}px "Jost"`;
    const out = B["hook.out"];
    block("hook", ["This word", "means sand."], D(96), 96, 400, 106, null, out);
    block("name", ["Rimal"], D(64), 64, 1045, 70, null, out);
    block("t2", ["And it's the whole idea", "behind our tools."], D(60), 60, 1190, 72, B["hook.line2"], out);
    block("cta0", ["@rimalinterior"], J(52), 52, 1420, 60, null, out);
    block("t3", ["Dunes are shaped by", "thousands of small,", "patient moves."], D(64), 64, 330, 78, 6.4, B["sand.textOut"]);
    block("t4", ["Good interiors", "are too."], D(84), 84, 380, 96, 11.9, 14.8);
    block("t5", ["Our tools take the", "repeated moves."], D(64), 64, 400, 80, 15.0, 20.2);
    block("t6", ["So your time goes", [{ s: "into the ", c: COL.ink }, { s: "design.", c: COL.goldHi }]], D(72), 72, 400, 88, 20.8, 24.7);
    block("brand", ["Rimal Interiors"], D(96), 96, 1080, 100, 25.9, null);
    block("soft", ["Tools for AutoCAD · Revit", "SketchUp · 3ds Max"], J(44, 400), 44, 1170, 60, 25.98, null, 0.86);
    block("cta1", ["@rimalinterior · link in bio"], J(48), 48, 1390, 60, 26.4, null);
  }

  // ---------- scene drawing ----------
  function drawWord(t) {
    const tDis = B["sand.dissolve"];
    if (t >= tDis + 1.0) return;
    ctx.save();
    if (t >= tDis) {
      // Wind front sweeps left->right; letters behind it are already grains.
      const front = glyphBox.x0 - 10 + (glyphBox.x1 - glyphBox.x0 + 20) * ((t - tDis) / 0.8);
      ctx.beginPath();
      ctx.rect(front, 0, W - front, H);
      ctx.clip();
    }
    ctx.font = WORD.font; ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.fillStyle = rgba(COL.goldHi, 1);
    ctx.fillText(WORD.text, WORD.x, WORD.y);
    ctx.restore();
  }

  function drawGrains1(t) {
    const tDis = B["sand.dissolve"];
    if (t < tDis || t > 11.3) return;
    const front = glyphBox.x0 - 10 + (glyphBox.x1 - glyphBox.x0 + 20) * ((t - tDis) / 0.8);
    for (const g of grains1) {
      if (t < g.rel && g.x0 >= front) continue;      // still part of the solid letter
      const fade = 1 - prog(t, g.slide + 0.95, 0.5);
      if (fade <= 0) continue;
      const [x, y, u] = grain1Pos(g, t);
      const c = mixC(COL.goldHi, COL.dune, clamp(u * 1.4));
      ctx.fillStyle = rgba(c, fade);
      ctx.fillRect(x - g.size / 2, y - g.size / 2, g.size, g.size);
    }
  }

  function linePoints(k, t) {
    const u = eIO(prog(t, B["interior.morph"] + 0.03 * k, 1.4));
    if (u <= 0) return { pts: dunePts[k], u: 0 };
    const a = dunePts[k], b = planPts[k];
    return { pts: a.map((p, j) => [lerp(p[0], b[j][0], u), lerp(p[1], b[j][1], u)]), u };
  }

  function drawLines(t) {
    const tCon = B["sand.contour"];
    if (t < tCon + 0.6) return;
    const fadeOut = 1 - prog(t, B["end.gather"], 0.35);
    if (fadeOut <= 0) return;
    for (let k = 0; k < K; k++) {
      const { pts, u } = linePoints(k, t);
      // Line appears where its grains have finished sliding onto it.
      const reveal = clamp((t - (tCon + 0.7)) / 0.6);
      const c = mixC(COL.dune, COL.ink, u);
      ctx.strokeStyle = rgba(c, fadeOut * (0.85 + 0.15 * u));
      ctx.lineWidth = lerp(2, planW[k], u);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      strokePartial(pts, reveal);
    }
  }

  function drawItems(t) {
    if (t < B["repeat.stamp0"]) return;
    const fadeOut = 1 - prog(t, B["end.gather"], 0.35);
    if (fadeOut <= 0) return;
    itemOrder.forEach((idx, n) => {
      const ts = B[`repeat.stamp${n}`];
      const a = eOut(prog(t, ts, 0.22));
      if (a <= 0) return;
      const it = items[idx];
      let cx = 0, cy = 0, cnt = 0;
      it.polys.forEach((p) => p.forEach((q) => { cx += q[0]; cy += q[1]; cnt++; }));
      cx /= cnt; cy /= cnt;
      const s = lerp(1.14, 1, a);
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      ctx.strokeStyle = rgba(COL.ink, 0.82 * a * fadeOut);
      ctx.lineWidth = 2; ctx.lineJoin = "round";
      it.polys.forEach((p) => strokePartial(p, 1));
      ctx.restore();
    });
  }

  function drawPattern(t) {
    const tH = B["hero.hero"];
    if (t < tH) return;
    const fadeOut = 1 - prog(t, B["end.gather"], 0.35);
    if (fadeOut <= 0) return;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(COL.goldHi, fadeOut);
    ctx.lineWidth = 2.5;
    bandLines.forEach((pts) => strokePartial(pts, eIO(prog(t, tH, 0.5))));
    const fill = eIO(prog(t, tH + 1.0, 1.0)) * fadeOut;
    tiles.forEach((tl, i) => {
      const t0 = tH + 0.15 + 0.22 * i;
      if (fill > 0) {
        ctx.fillStyle = rgba(COL.goldHi, 0.07 * fill);
        [tl[0], tl[1]].forEach((pts) => {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
          ctx.fill();
        });
      }
      ctx.strokeStyle = rgba(COL.goldHi, fadeOut);
      tl.forEach((pts, j) => strokePartial(pts, eIO(prog(t, t0 + 0.12 * j, 0.55))));
    });
  }

  function drawGrains2(t) {
    const tG = B["end.gather"];
    if (t < tG) return;
    const show = clamp((t - tG) / 0.25);
    const logoA = eIO(prog(t, B["end.logo"] - 0.15, 0.5));
    const ga = show * (1 - logoA);
    if (ga > 0.001) {
      for (const g of grains2) {
        const [x, y, u] = grain2Pos(g, t);
        ctx.fillStyle = rgba(mixC(g.c0, g.c1, clamp(u * 1.2)), ga);
        ctx.fillRect(x - g.size / 2, y - g.size / 2, g.size, g.size);
      }
    }
    if (logoA > 0) {
      ctx.globalAlpha = logoA;
      ctx.drawImage(logoImg, LOGO.x, LOGO.y, LOGO.w, LOGO.h);
      ctx.globalAlpha = 1;
    }
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    drawWord(t);
    drawLift(t);
    drawGrains1(t);
    // World layer (plan, furniture, pattern) under the camera.
    const z = cam(t);
    ctx.save();
    ctx.translate(PIV[0], PIV[1]); ctx.scale(z, z); ctx.translate(-PIV[0], -PIV[1]);
    drawLines(t);
    drawItems(t);
    drawPattern(t);
    ctx.restore();
    drawGrains2(t);
    BLOCKS.forEach((b) => drawBlock(b, t));
  }

  // ---------- page contract ----------
  window.READY = (async () => {
    TL = await (await fetch("timeline.json")).json();
    TL.scenes.forEach((s) => Object.entries(s.beats || {}).forEach(([k, v]) => (B[`${s.id}.${k}`] = v)));
    window.DUR = TL.meta.dur;
    window.FPS = TL.meta.fps;
    window.CUES = TL;
    await Promise.all([
      document.fonts.load('96px "Marcellus"'),
      document.fonts.load('500 48px "Jost"'),
      document.fonts.load('400 44px "Jost"'),
      document.fonts.load('700 340px "Reem Kufi"', "رمال"),
    ]);
    await document.fonts.ready;
    logoImg = new Image();
    logoImg.src = "../../assets/img/dunes.png";
    await logoImg.decode();
    buildBackground();
    buildGrains1();
    buildLift();
    buildGrains2();
    defineTexts();
    render(0);
  })();
  window.seek = async (t) => { await window.READY; render(t); };
  window.BOXES = () => Object.fromEntries(BLOCKS.map((b) => [b.id, blockBox(b)]));
  // Mean grain speed (px/frame) for the sound: sand pour and sand sweep follow the picture.
  window.ENV = (t) => {
    const dt = 1 / 30;
    let s1 = 0, n1 = 0, s2 = 0, n2 = 0, s0 = 0;
    // Lifted grains: a faint hiss before the dissolve (the sound arrives a little ahead of the picture).
    for (const p of lift) {
      const a = liftPos(p, t), b = liftPos(p, t - dt);
      if (a && b) s0 += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    if (t >= B["sand.dissolve"] && t <= 11.3) {
      for (const g of grains1) {
        const a = grain1Pos(g, t), b = grain1Pos(g, t - dt);
        s1 += Math.hypot(a[0] - b[0], a[1] - b[1]); n1++;
      }
    }
    if (t >= B["end.gather"]) {
      for (const g of grains2) {
        const a = grain2Pos(g, t), b = grain2Pos(g, t - dt);
        s2 += Math.hypot(a[0] - b[0], a[1] - b[1]); n2++;
      }
    }
    return { sand: (n1 ? s1 / n1 : 0) + s0 / 60, sweep: n2 ? s2 / n2 : 0 };
  };
})();
