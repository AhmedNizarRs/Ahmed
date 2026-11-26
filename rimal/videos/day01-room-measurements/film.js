// Rimal Interiors, Day 1: "5 measurements that make any room look designed".
// Every frame is a pure function of t. All beats come from timeline.json (built from VO word timings).
(() => {
  const W = 1080, H = 1920;
  const C = {
    ink: "#15110e", cream: "#fff4e6", yellow: "#ffd23f", tomato: "#ff5a36", cobalt: "#2f5bff",
    green: "#23b26d", pink: "#ff8fc7", white: "#ffffff",
  };
  // One ground colour per chapter: every colour flip is a new rule.
  const THEME = {
    hook: { bg: C.yellow, ink: C.ink, acc: C.tomato, shade: "#f0bf1f" },
    art: { bg: C.tomato, ink: C.ink, acc: C.cream, shade: "#e84a28" },
    coffee: { bg: C.cobalt, ink: C.white, acc: C.yellow, shade: "#2449e0" },
    pendant: { bg: C.ink, ink: C.cream, acc: C.yellow, shade: "#2a221c" },
    dining: { bg: C.green, ink: C.ink, acc: C.cream, shade: "#1c9a5d" },
    walk: { bg: C.pink, ink: C.ink, acc: C.cobalt, shade: "#f277b3" },
    recap: { bg: C.cream, ink: C.ink, acc: C.tomato, shade: "#f1e3cf" },
  };
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, d) => clamp((t - a) / d);
  function bez(x1, y1, x2, y2) {
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
  const eOut = bez(0.16, 1, 0.3, 1), eIn = bez(0.6, 0, 0.9, 0.35), eIO = bez(0.65, 0, 0.35, 1);
  // Closed-form spring from 0 to 1 starting at t0 (zeta < 1 gives one visible overshoot).
  function spring(t, t0, f = 2.4, z = 0.62) {
    const tau = t - t0;
    if (tau <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
  }

  // ---------- drawing helpers ----------
  const AB = (px) => `${px}px "Archivo Black"`;
  const IN = (px, w = 800) => `${w} ${px}px "Inter"`;
  function text(s, x, y, font, color, align = "center", alpha = 1) {
    ctx.font = font; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pill(s, cx, cy, font, bg, fg, padX = 30, h = 72) {
    ctx.font = font;
    const w = ctx.measureText(s).width + padX * 2;
    rrect(cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = fg; ctx.fillText(s, cx, cy + 2);
    ctx.textBaseline = "alphabetic";
    return w;
  }
  function line(x0, y0, x1, y1, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // Dimension line from (x0,y0) to (x1,y1), drawn up to progress p, with end ticks and arrowheads.
  function dim(x0, y0, x1, y1, p, color, w = 6) {
    if (p <= 0) return;
    const xe = lerp(x0, x1, p), ye = lerp(y0, y1, p);
    line(x0, y0, xe, ye, color, w);
    const ang = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(ang), ny = Math.cos(ang);
    line(x0 - nx * 26, y0 - ny * 26, x0 + nx * 26, y0 + ny * 26, color, w);
    const head = (x, y, a) => {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 30 * Math.cos(a - 0.42), y - 30 * Math.sin(a - 0.42));
      ctx.lineTo(x - 30 * Math.cos(a + 0.42), y - 30 * Math.sin(a + 0.42));
      ctx.closePath(); ctx.fill();
    };
    head(x0, y0, ang + Math.PI);
    head(xe, ye, ang);
    if (p >= 1) line(x1 - nx * 26, y1 - ny * 26, x1 + nx * 26, y1 + ny * 26, color, w);
  }

  // ---------- state ----------
  let TL, B = {}, S = [];
  const scene = (t) => { let cur = S[0]; for (const s of S) if (t >= s.start) cur = s; return cur; };

  // Shared chapter frame: progress chip, headline (complete on the cut frame), big number, source.
  function chapter(t, sc, th, n, head, value, inches, source, b) {
    // Camera punch on the cut: 1.035 -> 1 in 0.25 s.
    const punch = 1 + 0.035 * (1 - eOut(prog(t, sc.start, 0.25)));
    ctx.translate(540, 960); ctx.scale(punch, punch); ctx.translate(-540, -960);
    pill(`${n}/5`, 540, 270, IN(40), th.ink, th.bg, 28, 64);
    head.forEach((l, i) => text(l, 540, 410 + i * 84, AB(76), th.ink));
    // Counter: value counts up while the voice says it; the unit and inches arrive only when it lands.
    const land = b.land;
    if (t >= b.count) {
      const u = eOut(prog(t, b.count, Math.max(0.3, land - b.count)));
      const landed = t >= land;
      const pop = landed ? 1 + 0.08 * (1 - eOut(prog(t, land, 0.3))) : 1;
      ctx.save();
      ctx.translate(540, 700); ctx.scale(pop, pop); ctx.translate(-540, -700);
      const big = value.length > 3 ? 190 : 230;
      if (landed) {
        ctx.font = AB(big); const wv = ctx.measureText(value).width;
        ctx.font = AB(Math.round(big * 0.45)); const wu = ctx.measureText(" cm").width;
        const x0 = 540 - (wv + wu) / 2;
        text(value, x0, 770, AB(big), th.ink, "left");
        text(" cm", x0 + wv, 770, AB(Math.round(big * 0.45)), th.ink, "left");
        text(inches, 540, 850, IN(52), th.ink, "center", eOut(prog(t, land, 0.3)));
      } else {
        const first = parseInt(value, 10);
        text(String(Math.round(first * u)), 540, 770, AB(big), th.ink);
      }
      ctx.restore();
      if (landed && source) text(source, 540, 1520, IN(32, 600), th.ink, "center", 0.8 * eOut(prog(t, land + 0.2, 0.4)));
    }
  }

  // ---------- scenes ----------
  function drawHook(t, sc) {
    const th = THEME.hook, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    text("5", 540, 720, AB(430), th.ink);
    text("MEASUREMENTS", 540, 860, AB(100), th.ink);
    text("that make any room", 540, 960, IN(58), th.ink);
    text("look designed", 540, 1030, IN(58), th.ink);
    // Tape measure pulls out across the frame.
    const u = eOut(prog(t, b.tape + 0.1, 1.0));
    const x0 = 250, x1 = lerp(x0, 960, u), y = 1150;
    rrect(x0, y, x1 - x0, 64, 6); ctx.fillStyle = th.acc; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y, x1 - x0, 64); ctx.clip();
    for (let i = 0, x = x0 + 14; x < 980; i++, x += 14) {
      line(x, y, x, y + (i % 10 === 0 ? 34 : i % 5 === 0 ? 24 : 14), th.ink, 3);
      if (i % 10 === 0 && i > 0) text(String(i), x + 4, y + 58, IN(20), th.ink, "left");
    }
    ctx.restore();
    rrect(110, y - 38, 160, 140, 28); ctx.fillStyle = th.ink; ctx.fill();
    ctx.beginPath(); ctx.arc(190, y + 32, 36, 0, Math.PI * 2); ctx.fillStyle = th.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(190, y + 32, 14, 0, Math.PI * 2); ctx.fillStyle = th.ink; ctx.fill();
    // Save chip pops on "Save".
    const s = spring(t, b.save, 2.6, 0.6);
    if (s > 0) {
      ctx.save(); ctx.translate(540, 1300); ctx.scale(s, s); ctx.translate(-540, -1300);
      const w = pill("SAVE THIS", 560, 1300, AB(46), th.ink, th.bg, 40, 92);
      // Bookmark icon at the pill's left edge.
      const bx = 560 - w / 2 - 50;
      ctx.fillStyle = th.ink; ctx.beginPath();
      ctx.moveTo(bx - 24, 1256); ctx.lineTo(bx + 24, 1256); ctx.lineTo(bx + 24, 1344); ctx.lineTo(bx, 1322); ctx.lineTo(bx - 24, 1344);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    text("@rimalinterior", 540, 1440, IN(50), th.ink);
  }

  function drawArt(t, sc) {
    const th = THEME.art, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    chapter(t, sc, th, 1, ["ART CENTRE", "FROM FLOOR"], "145", "57 in", "Gallery hanging standard", b);
    const floorY = 1420;
    line(110, floorY, 970, floorY, th.ink, 8);
    // Frame drops onto its hook.
    const d = spring(t, b.draw, 2.2, 0.62);
    const fy = lerp(560, 1090, d), fx = 640;
    if (t >= b.draw) {
      line(fx, fy - 150, fx, fy - 120, th.ink, 5);
      rrect(fx - 160, fy - 120, 320, 240, 8); ctx.fillStyle = th.ink; ctx.fill();
      rrect(fx - 138, fy - 98, 276, 196, 4); ctx.fillStyle = C.cream; ctx.fill();
      ctx.beginPath(); ctx.arc(fx - 40, fy - 10, 52, 0, Math.PI * 2); ctx.fillStyle = C.yellow; ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 10, fy + 90); ctx.lineTo(fx + 70, fy - 50); ctx.lineTo(fx + 130, fy + 90); ctx.closePath(); ctx.fillStyle = C.cobalt; ctx.fill();
      // Centre mark + leader to the dimension line.
      ctx.setLineDash([14, 12]); line(fx, fy, 300, fy, th.ink, 4); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2); ctx.fillStyle = th.ink; ctx.fill();
    }
    // Dimension grows from the floor to the centre while the number counts.
    dim(300, floorY, 300, 1090, eIO(prog(t, b.count, Math.max(0.4, b.land - b.count))), th.ink);
    const r = spring(t, b.rule, 2.6, 0.6);
    if (r > 0) {
      ctx.save(); ctx.translate(660, 1300); ctx.rotate(-0.06); ctx.scale(r, r);
      pill("57-INCH RULE", 0, 0, AB(52), th.ink, th.bg, 34, 96);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCoffee(t, sc) {
    const th = THEME.coffee, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    chapter(t, sc, th, 2, ["SOFA TO", "COFFEE TABLE"], "40–50", "16–20 in", "Common living-room guideline", b);
    // Top view: sofa (complete on the cut), table slides in on "coffee".
    rrect(220, 960, 640, 170, 34); ctx.fillStyle = th.shade; ctx.fill();
    rrect(220, 960, 640, 56, 28); ctx.fillStyle = "#1b3fd0"; ctx.fill();
    [250, 440, 630].forEach((x) => { rrect(x, 1020, 180, 96, 18); ctx.strokeStyle = th.ink; ctx.lineWidth = 4; ctx.stroke(); });
    text("SOFA", 540, 1092, IN(36), th.ink);
    const u = eOut(prog(t, b.draw, 0.55));
    if (u > 0) {
      const ty = lerp(1600, 1330, u);
      rrect(350, ty, 380, 130, 22); ctx.fillStyle = th.ink; ctx.fill();
      text("TABLE", 470, ty + 80, IN(36), th.bg);
      // Cup pops on "cup".
      const c = spring(t, b.cup, 2.8, 0.6);
      if (c > 0) {
        ctx.save(); ctx.translate(670, ty + 40); ctx.scale(c, c);
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = th.acc; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = "#6b3f1d"; ctx.fill();
        ctx.restore();
      }
    }
    dim(540, 1130, 540, 1330, eIO(prog(t, b.count, Math.max(0.4, b.land - b.count))), th.acc);
    ctx.restore();
  }

  function drawPendant(t, sc) {
    const th = THEME.pendant, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    chapter(t, sc, th, 3, ["PENDANT ABOVE", "DINING TABLE"], "75–90", "30–36 in", "Lighting-maker guideline", b);
    // Table (complete on the cut).
    const top = 1300;
    rrect(250, top, 580, 26, 6); ctx.fillStyle = th.ink; ctx.fill();
    line(300, top + 26, 300, 1440, th.ink, 14); line(780, top + 26, 780, 1440, th.ink, 14);
    line(120, 1440, 960, 1440, th.ink, 6);
    // Pendant drops on "pendant" and swings to rest (damped pendulum).
    if (t >= b.draw) {
      const d = eOut(prog(t, b.draw, 0.45));
      const swing = 0.22 * Math.exp(-3.2 * (t - b.draw)) * Math.sin(7.5 * (t - b.draw));
      const len = lerp(40, 180, d);
      ctx.save(); ctx.translate(540, 900); ctx.rotate(swing);
      line(0, 0, 0, len, th.ink, 4);
      // Light pool turns on when the value lands.
      const on = eOut(prog(t, b.land, 0.5));
      if (on > 0) {
        ctx.fillStyle = `rgba(255,210,63,${0.22 * on})`;
        ctx.beginPath(); ctx.moveTo(-90, len + 60); ctx.lineTo(90, len + 60); ctx.lineTo(260, top - 900); ctx.lineTo(-260, top - 900); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(0, len + 60, 120, 70, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = th.acc; ctx.fill();
      ctx.restore();
    }
    dim(880, 900 + 180 + 60, 880, top, eIO(prog(t, b.count, Math.max(0.4, b.land - b.count))), th.acc);
    ctx.restore();
  }

  function drawDining(t, sc) {
    const th = THEME.dining, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    chapter(t, sc, th, 4, ["TABLE WIDTH", "PER SEAT"], "60", "24 in", "Common dining guideline", b);
    // Top view table; chairs pop one by one on "seat".
    const x0 = 300, x1 = 780, y0 = 1080, y1 = 1300, seg = (x1 - x0) / 3;
    rrect(x0, y0, x1 - x0, y1 - y0, 16); ctx.fillStyle = th.ink; ctx.fill();
    for (let i = 0; i < 6; i++) {
      const s = spring(t, b.draw + 0.1 * i, 2.8, 0.62);
      if (s <= 0) continue;
      const cx = x0 + seg * (i % 3) + seg / 2, cy = i < 3 ? y0 - 70 : y1 + 70;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      rrect(-54, -46, 108, 92, 18); ctx.fillStyle = th.shade; ctx.fill();
      rrect(-54, i < 3 ? -46 : 30, 108, 16, 8); ctx.fillStyle = th.ink; ctx.fill();
      ctx.restore();
    }
    // Seat segments: brackets under the table, one per seat, sweep across as "sixty" is said.
    const p = prog(t, b.count, Math.max(0.4, b.land - b.count));
    for (let i = 0; i < 3; i++) {
      const pi = clamp(p * 3 - i);
      if (pi <= 0) continue;
      const a = x0 + seg * i + 8, z = a + (seg - 16) * eOut(pi);
      const yy = 1440;
      line(a, yy, z, yy, th.ink, 6); line(a, yy - 22, a, yy + 22, th.ink, 6);
      if (pi >= 1) line(a + seg - 16, yy - 22, a + seg - 16, yy + 22, th.ink, 6);
    }
    ctx.restore();
  }

  function drawWalk(t, sc) {
    const th = THEME.walk, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    chapter(t, sc, th, 5, ["WALKWAY", "WIDTH"], "90", "36 in · at least", "NKBA kitchen guideline", b);
    // Top view: island left, counter right, walkway between.
    rrect(150, 920, 300, 520, 18); ctx.fillStyle = th.ink; ctx.fill();
    rrect(690, 920, 240, 520, 18); ctx.fillStyle = th.ink; ctx.fill();
    text("ISLAND", 300, 1190, IN(34), th.bg); text("COUNTER", 810, 1190, IN(34), th.bg);
    // Footsteps walk up the gap on "walkways".
    for (let i = 0; i < 6; i++) {
      const s = eOut(prog(t, b.draw + 0.14 * i, 0.25));
      if (s <= 0) continue;
      const fx = 570 + (i % 2 ? 26 : -26), fy = 1400 - i * 82;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(s, s);
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 26, 0, 0, Math.PI * 2); ctx.fillStyle = th.acc; ctx.fill();
      ctx.restore();
    }
    dim(450, 1000, 690, 1000, eIO(prog(t, b.count, Math.max(0.4, b.land - b.count))), th.acc);
    ctx.restore();
  }

  const ROWS = [
    ["ART CENTRE FROM FLOOR", "145 cm", C.tomato, C.ink],
    ["SOFA TO COFFEE TABLE", "40–50 cm", C.cobalt, C.white],
    ["PENDANT ABOVE TABLE", "75–90 cm", C.ink, C.yellow],
    ["TABLE WIDTH PER SEAT", "60 cm", C.green, C.ink],
    ["WALKWAY WIDTH", "90 cm+", C.pink, C.ink],
  ];
  function drawRecap(t, sc) {
    const th = THEME.recap, b = sc.beats;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    const tt = eOut(prog(t, b.hero, 0.35));
    text("CHEAT SHEET", 540, 360 + (1 - tt) * 30, AB(96), th.ink, "center", tt);
    // Rows slam in from the right, intervals tightening: 0.14, 0.10, 0.07, 0.05.
    const gaps = [0, 0.14, 0.24, 0.31, 0.36];
    ROWS.forEach(([label, val, bg, fg], i) => {
      const u = eOut(prog(t, b.hero + gaps[i], 0.32));
      if (u <= 0) return;
      const y = 440 + i * 165, x = 80 + (1 - u) * 1000;
      rrect(x, y, 920, 140, 28); ctx.fillStyle = bg; ctx.fill();
      text(label, x + 44, y + 84, IN(38), fg, "left");
      text(val, x + 920 - 44, y + 96, AB(64), fg, "right");
    });
    const f = spring(t, b.follow, 2.4, 0.7);
    if (f > 0) {
      ctx.save(); ctx.translate(540, 1350); ctx.scale(f, f); ctx.translate(-540, -1350);
      pill("@rimalinterior", 540, 1350, IN(56), C.ink, C.yellow, 44, 104);
      ctx.restore();
      text("A new design rule every day", 540, 1462, IN(40, 600), th.ink, "center", eOut(prog(t, b.follow + 0.3, 0.4)));
    }
  }

  const DRAW = { hook: drawHook, art: drawArt, coffee: drawCoffee, pendant: drawPendant, dining: drawDining, walk: drawWalk, recap: drawRecap };
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const sc = scene(t);
    DRAW[sc.id](t, sc);
  }

  window.READY = (async () => {
    TL = await (await fetch("timeline.json")).json();
    S = TL.scenes;
    window.DUR = TL.meta.dur; window.FPS = TL.meta.fps; window.CUES = TL;
    await Promise.all([document.fonts.load('100px "Archivo Black"'), document.fonts.load('800 40px "Inter"'), document.fonts.load('600 40px "Inter"')]);
    await document.fonts.ready;
    render(0);
  })();
  window.seek = async (t) => { await window.READY; render(t); };
  // Text bounds in delivery pixels (for qa_video.py size/contrast checks).
  window.BOXES = () => {
    const box = (s, font, cx, base, align = "center") => {
      ctx.font = font; const m = ctx.measureText(s);
      const w = m.width, x = align === "center" ? cx - w / 2 : cx;
      return [Math.round(x) - 4, Math.round(base - m.actualBoundingBoxAscent) - 4, Math.round(w) + 8, Math.round(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 8];
    };
    return {
      hook: box("MEASUREMENTS", AB(100), 540, 860), hook2: box("that make any room", IN(58), 540, 960),
      cta0: box("@rimalinterior", IN(50), 540, 1440), sheet: box("CHEAT SHEET", AB(96), 540, 360),
      cta1: box("@rimalinterior", IN(56), 540, 1370), walkway: box("WALKWAY", AB(76), 540, 410),
    };
  };
})();
