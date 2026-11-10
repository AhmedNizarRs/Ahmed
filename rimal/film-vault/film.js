/* Rimal — The Ultimate Architect Tools Vault. Every frame is a pure function of t (no timers, no transitions).
   Page contract: window.DUR, FPS, READY, seek(t), BLUR(t), CUES. All times come from timeline.json. */
(() => {
  const W = 1080, H = 1920;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, t0, d) => clamp((t - t0) / d);
  const bez = (x1, y1, x2, y2) => (u) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let s = u;
    for (let i = 0; i < 10; i++) {
      const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s - u;
      const dx = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      s = clamp(s - x / dx);
    }
    return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  };
  const eOut = bez(0.16, 1, 0.3, 1), eIn = bez(0.6, 0, 0.9, 0.35), eIO = bez(0.65, 0, 0.35, 1), eDraw = bez(0.5, 0, 0.15, 1), eCount = bez(0.2, 0.55, 0.3, 1);
  const eWhip = (u) => { u = clamp(u); return u < 0.5 ? 8 * u * u * u * u : 1 - 8 * Math.pow(1 - u, 4); };
  const spring = (tau, f = 2.6, z = 0.55) => {
    if (tau <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
  };
  const mix = (c1, c2, u) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], u))).join(",")})`;
  const GOLD_HI = [230, 189, 118], FRAME = [96, 74, 56], INK = [239, 228, 210], INK2 = [184, 165, 141];

  let TL, C, ORG = {}, VPS = {}, DRAWS = [], KEYS = [], PULSES = [], PILLS = [], TYPED = [], TABS = {}, ART = {};

  /* ---------- camera ---------- */
  function camera(t) {
    const M = TL.camera;
    let z = Math.log(M[0].zoom), x = M[0].x, y = M[0].y;
    for (let i = 1; i < M.length; i++) {
      const m = M[i];
      if (t <= m.t0) break;
      const u = prog(t, m.t0, m.t1 - m.t0);
      const e = m.ease === "whip" ? eWhip(u) : m.ease === "out" ? eOut(u) : eIO(u);
      z = lerp(z, Math.log(m.zoom), e); x = lerp(x, m.x, e); y = lerp(y, m.y, e);
    }
    let creep = 0;                                  // a slow push while a cell is held; given back during the move out
    for (let i = 0; i < 8; i++) {
      const a = M[i].t1, b = M[i + 1].t0, c = M[i + 1].t1;
      if (t > a && t < c) creep = 0.022 * prog(t, a, b - a) * (1 - eIO(prog(t, b, c - b)));
    }
    return { z: Math.exp(z) * (1 + creep), x, y };
  }
  const w2s = (cam, wx, wy) => [W / 2 + (wx - cam.x) * cam.z, H / 2 + (wy - cam.y) * cam.z];

  /* ---------- type ---------- */
  function splitWords(el) {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w";
            const wi = document.createElement("span"); wi.className = "wi"; wi.textContent = tok;
            w.appendChild(wi); frag.appendChild(w); out.push(wi);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
    el._w = out;
  }
  // words rise out of their baseline at tIn (staggered) and, if tOut is given, leave upward
  function words(el, t, tIn, o = {}) {
    const stag = o.stag ?? 0.07, dur = o.dur ?? 0.6, tOut = o.out ?? Infinity, oStag = o.outStag ?? 0.03, oDur = o.outDur ?? 0.26;
    el._w.forEach((wi, i) => {
      const a = eOut(prog(t, tIn + i * stag, dur)), b = eIn(prog(t, tOut + i * oStag, oDur));
      const vis = a > 0 && b < 1;
      wi.style.visibility = vis ? "visible" : "hidden";
      wi.style.transform = `translateY(${((1 - a) * 108 - b * 108).toFixed(2)}%)`;
    });
  }
  function rise(el, t, tIn, o = {}) {              // small UI: travel + opacity together
    const a = eOut(prog(t, tIn, o.dur ?? 0.45)), b = o.out !== undefined ? eIn(prog(t, o.out, 0.22)) : 0;
    el.style.opacity = (clamp(a * 2.2) * (1 - b)).toFixed(3);
    el.style.transform = `translateY(${((1 - a) * (o.dy ?? 22) - b * 14).toFixed(2)}px)`;
  }
  function buildCounter(el) {
    const v = el.dataset.count;
    el._v = +v; el._from = Math.pow(10, v.length - 1);
    // each slot is as wide as the digit it will stop on, so the row never shifts while it counts
    el._d = [...v].map((ch) => { const s = document.createElement("span"); s.className = "d"; s.textContent = ch; el.appendChild(s); s.style.width = (s.getBoundingClientRect().width + 2).toFixed(1) + "px"; return s; });
  }
  // the count is a graphic; it stops exactly on its value at tLand and then never moves
  function counter(row, t, tLand, o = {}) {
    const num = row.querySelector(".num"), t0 = Math.min(tLand - 0.85, o.start ?? Infinity), dur = tLand - t0;
    const a = eOut(prog(t, t0 - 0.12, 0.5));
    const val = Math.round(lerp(num._from, num._v, eCount(prog(t, t0, dur))));
    const s = String(val);
    num._d.forEach((d, i) => { d.textContent = s[i]; });
    row.style.opacity = clamp(a * 2.5).toFixed(3);
    row.style.transform = `translateY(${((1 - a) * 70).toFixed(2)}px)`;
    const unit = row.querySelector(".unit");
    if (unit) { const u = eOut(prog(t, tLand + 0.04, 0.4)); unit.style.opacity = clamp(u * 2).toFixed(3); unit.style.transform = `translateX(${((1 - u) * -26).toFixed(2)}px)`; }
  }

  /* ---------- drafted windows ---------- */
  function buildVp(el, cell) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const clip = document.createElement("div"); clip.className = "vp-clip";
    const img = document.createElement("img"); img.className = "f"; clip.appendChild(img);
    [...el.children].forEach((ch) => clip.appendChild(ch));
    el.appendChild(clip);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "vp-frame"); svg.setAttribute("width", w + 12); svg.setAttribute("height", h + 12);
    svg.innerHTML = `<rect fill="none" stroke-width="3"/><path fill="none" stroke="#e6bd76" stroke-width="5" d="M${w + 12} 34V0H${w - 22}M0 ${h - 22}V${h + 12}H34"/>`;
    el.appendChild(svg);
    return { el, clip, img, rect: svg.firstChild, ticks: svg.lastChild, w, h, x: el.offsetLeft, y: el.offsetTop, cell, name: el.dataset.clip, n: +el.dataset.n, off: +(el.dataset.off || 0), cur: "" };
  }
  // the crosshair drags a rubber-band rectangle from the top-right corner; the footage is inside it
  function vpDraw(v, t) {
    const p = eDraw(prog(t, v.t0, v.dur)), q = prog(t, v.t0 + v.dur, 0.45);
    v.el.style.visibility = p > 0 ? "visible" : "hidden";
    v.clip.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(3)}% ${((1 - p) * 100).toFixed(3)}%)`;
    v.rect.setAttribute("x", (4.5 + (1 - p) * v.w).toFixed(2)); v.rect.setAttribute("y", 4.5);
    v.rect.setAttribute("width", Math.max(0, p * v.w + 3).toFixed(2)); v.rect.setAttribute("height", Math.max(0, p * v.h + 3).toFixed(2));
    v.rect.setAttribute("stroke", mix(GOLD_HI, FRAME, q));
    v.ticks.style.opacity = q.toFixed(3);
    if (v.shadow) v.shadow.style.opacity = q.toFixed(3);
  }
  const corner = (v, t) => { const p = eDraw(prog(t, v.t0, v.dur)); return [ORG[v.cell][0] + v.x + (1 - p) * v.w, ORG[v.cell][1] + v.y + p * v.h]; };
  function frameSrc(v, t) {
    const n = v.n, per = 2 * (n - 1);
    let k = (v.off + Math.max(0, Math.floor((t - v.t0) * 30 + 1e-6))) % per;
    if (k >= n) k = per - k;
    return `footage/${v.name}/${String(k + 1).padStart(4, "0")}.jpg`;
  }

  /* ---------- 3ds Max line art (schematic) ---------- */
  const ARTS = {
    w: { ink: ["M150 60H650V640H150Z", "M182 92H618V608H182Z", "M400 92V608", "M182 250H618", "M120 660H680", "M132 660V684H668V660"],
         thin: ["M230 140L290 200", "M255 140L290 175", "M450 300L530 380", "M475 300L530 355"], gold: ["M150 716H650", "M150 702V730", "M650 702V730"] },
    d: { ink: ["M240 40H560V680H240Z", "M262 62H538V680", "M262 680V62", "M300 100H500V640H300Z", "M476 300V430", "M190 680H610"],
         thin: ["M330 150L400 220", "M355 150L400 195", "M468 300H484", "M468 430H484"], gold: ["M618 40V680", "M604 40H632", "M604 680H632"] },
    k: { ink: ["M60 396H740V422H60Z", "M80 422V668H720V422", "M293 422V668", "M506 422V668", "M293 505H506", "M293 588H506", "M80 60H720V250H80Z", "M293 60V250", "M506 60V250"],
         thin: ["M100 668V690H700V668", "M170 452H205", "M380 462H420", "M380 545H420", "M380 628H420", "M595 452H630", "M270 215V180", "M316 215V180", "M529 215V180"],
         gold: ["M80 716H720", "M80 702V730", "M720 702V730"] },
  };
  function buildArt(svg) {
    for (const k of Object.keys(ARTS)) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const mk = (d, cls) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); p.setAttribute("pathLength", 1); p.setAttribute("stroke-dasharray", "1 1"); if (cls) p.setAttribute("class", cls); g.appendChild(p); return p; };
      ART[k] = { g, paths: [...ARTS[k].ink.map((d) => mk(d)), ...ARTS[k].thin.map((d) => mk(d, "thin")), ...ARTS[k].gold.map((d) => mk(d, "gold"))] };
      svg.appendChild(g);
    }
  }
  function artDraw(k, t, tIn, tOut, slow = 1) {
    const a = ART[k], n = a.paths.length;
    const out = tOut === undefined ? 0 : eIn(prog(t, tOut - 0.16, 0.16));
    a.g.style.visibility = t >= tIn - 0.12 && out < 1 ? "visible" : "hidden";
    a.paths.forEach((p, i) => {
      const u = eDraw(prog(t, tIn - 0.12 + (i / n) * 0.28 * slow, 0.34 * slow)) * (1 - out);
      p.setAttribute("stroke-dashoffset", (1 - u).toFixed(4));
      p.style.visibility = u > 0.002 ? "visible" : "hidden";
    });
  }

  /* ---------- crosshair: one continuous path through the whole film ---------- */
  function buildCross() {
    const c = C, P = (cell, x, y) => [ORG[cell][0] + x, ORG[cell][1] + y];
    const K = (t, p) => KEYS.push({ t, x: p[0], y: p[1] });
    let prev = null, last = -9;
    PILLS.forEach((p) => {
      const pos = P("title", p.x - p.side * 230, p.y + 4);
      if (prev && p.t - 0.24 > last) K(p.t - 0.24, prev);
      K(p.t + 0.12, pos); prev = pos; last = p.t + 0.12;
    });
    K(c["hook.imagine"] + 0.3, P("title", 540, 1010)); K(c["hook.sweep"] - 0.1, P("title", 540, 1010));
    K(c["hook.sweep"] + 0.3, P("title", 540, 880));
    K(c["title.in"] + 0.1, P("title", 540, 880));
    K(c["L4.hizma"] + 0.5, P("title", 940, 1207));
    K(c["L4.hizma"] + 1.0, P("title", 140, 1207));
    for (const d of DRAWS) { K(d.t0, corner(d, d.t0)); K(d.t0 + d.dur, corner(d, d.t0 + d.dur)); PULSES.push(d.t0, d.t0 + d.dur); }
    K(c["L6.control"] - 0.05, P("autocad", 700, 1013)); K(c["L6.control"] + 0.8, P("autocad", 150, 1013));
    K(c["L9.kitchen"] + 0.3, P("kitchen", 70, 1307)); K(c["L9.kitchen"] + 0.8, P("kitchen", 1010, 1307));
    ["w", "d", "k"].forEach((k, i) => { const tb = TABS[k]; const tt = [c["max.land"] + 0.3, c["L10.doors"], c["L10.kitchens"]][i]; K(tt - 0.05, P("max", tb.x + tb.w, tb.y + tb.h + 4)); K(tt + 0.2, P("max", tb.x, tb.y + tb.h + 4)); });
    K(c["ai.land"] + 0.1, P("ai", 150, 1240));
    K(c["L11.num"] - 0.1, P("ai", 150, 700));
    K(c["grid.start"], P("ai", 150, 700));
    K(c["grid.land"], P("price", 540, 960));
    K(c["question.in"] + 0.5, P("price", 540, 1560));
    K(c["price.hit"] - 0.3, P("price", 540, 1560));
    K(c["price.hit"], P("price", 540, 900));
    PULSES.push(c["price.hit"], c["hook.sweep"] + 0.3);
    KEYS.sort((a, b) => a.t - b.t);
  }
  function cross(t) {
    for (const d of DRAWS) if (t >= d.t0 && t <= d.t0 + d.dur) return corner(d, t);
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const u = eIO(prog(t, a.t, Math.max(1e-6, b.t - a.t)));
    return [lerp(a.x, b.x, u), lerp(a.y, b.y, u)];
  }

  /* ---------- background: dune contours, drifting, parallaxed by the camera ---------- */
  function drawBg(ctx, t, cam) {
    ctx.fillStyle = "#120c09"; ctx.fillRect(0, 0, W, H);
    const s = Math.pow(cam.z, 0.35), ox = cam.x * 0.16, gap = 176, N = 13, oy = cam.y * 0.16;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    for (let i = 0; i < N + 6; i++) {
      const k = i + Math.floor(oy / gap), base = k * gap - oy - 3 * gap;
      const ph = k * 1.31;
      ctx.beginPath();
      for (let x = -700; x <= W + 700; x += 24) {
        const X = x + ox;
        const y = base + 62 * Math.sin(X * 0.0037 + ph + t * 0.05) + 30 * Math.sin(X * 0.0093 + ph * 2.1 - t * 0.033) + 12 * Math.sin(X * 0.021 + ph * 0.7);
        x === -700 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(168,132,84,${(((k % 3) + 3) % 3 === 0 ? 0.34 : 0.17).toFixed(2)})`;
      ctx.lineWidth = 1.6 / s; ctx.stroke();
    }
    ctx.restore();
    // dune ridges along the foot of every cell: three depths, parallaxed sideways, travelling with the sheet vertically
    const fade = clamp((cam.z - 0.62) / 0.3);
    if (fade > 0) {
      let dy = (((cam.y - H / 2) % H) + H) % H; if (dy > H / 2) dy -= H;
      const L = [[1650, 86, 0.22, "#150e0a", 0.2, 0.4], [1712, 78, 0.38, "#19110c", 0.3, 2.3], [1790, 70, 0.62, "#1f150e", 0.46, 4.1]];
      ctx.globalAlpha = fade;
      for (const off of [-H, 0, H]) {
        if (Math.abs(off - dy) > H) continue;
        for (const [base, amp, par, fill, rim, ph] of L) {
          const y0 = base + off - dy + (1 - cam.z) * 400;
          ctx.beginPath(); ctx.moveTo(-20, H + 40 + Math.max(0, off - dy));
          for (let x = -20; x <= W + 20; x += 16) {
            const X = x + cam.x * par;
            ctx.lineTo(x, y0 - amp * (0.55 * Math.sin(X * 0.0031 + ph) + 0.3 * Math.sin(X * 0.0068 + ph * 1.7) + 0.15 * Math.sin(X * 0.0131 + ph * 0.6)));
          }
          ctx.lineTo(W + 20, H + 40 + Math.max(0, off - dy)); ctx.closePath();
          ctx.fillStyle = fill; ctx.fill();
          ctx.beginPath();
          for (let x = -20; x <= W + 20; x += 16) {
            const X = x + cam.x * par, y = y0 - amp * (0.55 * Math.sin(X * 0.0031 + ph) + 0.3 * Math.sin(X * 0.0068 + ph * 1.7) + 0.15 * Math.sin(X * 0.0131 + ph * 0.6));
            x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(201,151,74,${rim})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- the film ---------- */
  async function seek(t) {
    const c = C, cam = camera(t);
    $("world").style.transform = `translate(${(W / 2 - cam.x * cam.z).toFixed(3)}px,${(H / 2 - cam.y * cam.z).toFixed(3)}px) scale(${cam.z.toFixed(5)})`;
    drawBg(seek.ctx, t, cam);

    /* hook */
    const sw = c["hook.sweep"];
    const im = c["hook.imagine"];
    words($("hook1"), t, -1, { out: im });
    words($("hook2").firstElementChild, t, c["L1.mo"] - 0.12, { out: im + 0.05 });
    words($("imagine"), t, im + 0.12, { stag: 0.08, out: sw });
    $("strike").style.width = "0";
    const h3 = $("hook3"), sl = eOut(prog(t, c["hook.search"] - 0.05, 0.5));
    words(h3, t, c["hook.search"] - 0.05, { stag: 0.06, dur: 0.5, out: im + 0.1 });
    h3.style.transform = `scale(${lerp(1.14, 1, sl).toFixed(4)})`; h3.style.transformOrigin = "100% 60%";
    const kick = $("kicker"), ko = eIn(prog(t, sw, 0.25));
    kick.style.opacity = (1 - ko).toFixed(3); kick.style.transform = `translateY(${(-ko * 30).toFixed(2)}px)`;
    PILLS.forEach((p, i) => {
      const a = eOut(prog(t, p.t, 0.34)), b = eIn(prog(t, sw + (PILLS.length - 1 - i) * 0.022, 0.34));
      const fl = Math.sin(t * 1.3 + i * 2.1) * 7;                               // the pile never quite settles
      const x = lerp(lerp(p.x + p.side * 1100, p.x + fl, a), 540, b), y = lerp(p.y + Math.cos(t * 1.1 + i * 1.7) * 5, 880, b);
      p.el.style.visibility = a > 0 && b < 1 ? "visible" : "hidden";
      if (p.type) { const nch = Math.ceil(p.txt.length * prog(t, p.t + 0.12, p.type)); if (p.shown !== nch) { p.shown = nch; p.span.textContent = p.txt.slice(0, nch) || "\u200b"; } }
      p.el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) translate(-50%,-50%) rotate(${lerp(p.r * 3, p.r, a).toFixed(3)}deg) scale(${lerp(1, 0.04, b).toFixed(4)})`;
    });

    /* title */
    const ti = c["title.in"], hz = c["L4.hizma"];
    const lg = $("t-logo"), la = eOut(prog(t, ti, 0.6));
    lg.style.opacity = clamp(la * 3).toFixed(3);
    lg.style.transform = `translateY(${((1 - la) * 515).toFixed(2)}px) scale(${lerp(0.12, 1, la).toFixed(4)})`;
    const tb = $("t-brand"), ba = eOut(prog(t, ti + 0.3, 0.6));
    tb.style.opacity = ba.toFixed(3); tb.style.letterSpacing = lerp(0.6, 0.32, ba).toFixed(3) + "em";
    words($("t-1"), t, hz - 0.22, { dur: 0.55 });
    $("t-1").style.transform = `scale(${lerp(1.12, 1, eOut(prog(t, hz - 0.22, 0.7))).toFixed(4)})`;
    words($("t-2"), t, hz + 0.12, { stag: 0.1 });
    words($("t-3"), t, hz + 0.4);
    const td = $("t-dim"), da = eDraw(prog(t, hz + 0.5, 0.5));
    td.style.visibility = da > 0 ? "visible" : "hidden"; td.style.clipPath = `inset(-10px -10px -10px ${((1 - da) * 100).toFixed(2)}%)`;
    rise($("t-en"), t, hz + 0.85);

    /* tool cells */
    for (const d of DRAWS) vpDraw(d, t);
    const tag = (id, cell) => rise($(id), t, c[cell + ".land"] - 0.22, { dy: -18 });
    tag("revit-tag", "revit"); tag("autocad-tag", "autocad"); tag("blocks-tag", "blocks"); tag("sketchup-tag", "sketchup"); tag("kitchen-tag", "kitchen"); tag("max-tag", "max"); tag("ai-tag", "ai");

    words($("revit-cap"), t, c["revit.land"] + 0.12);
    counter($("revit-num"), t, c["L5.num"], { start: Math.max(c["revit.land"] + 0.18, c["L5.num"] - 1.6) });

    counter($("autocad-num"), t, c["L6.num"], { start: Math.max(c["autocad.land"] + 0.18, c["L6.num"] - 1.6) });
    words($("autocad-cap"), t, c["L6.num"] - 0.25);
    const pl = $("autocad-plate"), pa = eOut(prog(t, c["L6.control"] - 0.3, 0.45));
    pl.style.opacity = clamp(pa * 2).toFixed(3); pl.style.transform = `translateY(${((1 - pa) * 40).toFixed(2)}px)`;
    words(pl.firstElementChild, t, c["L6.control"] - 0.22, { stag: 0.08 });
    const ad = $("autocad-dim"), ae = eIO(prog(t, c["L6.control"], 0.8));
    ad.style.width = lerp(260, 810, ae).toFixed(2) + "px"; ad.style.opacity = prog(t, c["L6.control"] - 0.15, 0.15).toFixed(3);

    counter($("blocks-num"), t, c["L7.num"], { start: Math.max(c["blocks.land"] + 0.18, c["L7.num"] - 1.6) });
    words($("blocks-cap"), t, c["blocks.land"] + 0.1, { stag: 0.12 });

    counter($("sketchup-num"), t, c["L8.num"], { start: Math.max(c["sketchup.land"] + 0.18, c["L8.num"] - 1.6) });
    words($("sketchup-cap"), t, c["sketchup.land"] + 0.12, { stag: 0.09 });

    words($("kitchen-pre"), t, c["kitchen.land"] - 0.15);
    words($("kitchen-cap"), t, c["kitchen.land"] - 0.02, { stag: 0.1 });
    const kd = $("kitchen-dim"), ka = eDraw(prog(t, c["L9.kitchen"] + 0.3, 0.5));
    kd.style.visibility = ka > 0 ? "visible" : "hidden"; kd.style.clipPath = `inset(-10px ${((1 - ka) * 100).toFixed(2)}% -10px -10px)`;
    rise($("kitchen-en"), t, c["L9.kitchen"] + 0.7);

    words($("max-cap"), t, c["max.land"] - 0.05, { stag: 0.09 });
    const cw = c["L10.windows"], cd = c["L10.doors"], ck = c["L10.kitchens"];
    rise($("max-tabs"), t, c["max.land"] + 0.1);
    const wIn = c["max.land"] + 0.3;
    [["w", wIn, cd], ["d", cd, ck], ["k", ck, Infinity]].forEach(([k, a, b]) => {
      const on = prog(t, a - 0.05, 0.25) * (1 - prog(t, b - 0.1, 0.18));
      TABS[k].el.style.color = mix(INK2, INK, on); TABS[k].bar.style.width = (eOut(on) * 100).toFixed(2) + "%";
    });
    artDraw("w", t, wIn, cd - 0.02, 1.8); artDraw("d", t, cd, ck - 0.02); artDraw("k", t, ck);
    const pw = prog(t, wIn + 0.95, Math.max(0.3, cd - 0.35 - (wIn + 0.95)));
    ART.w.g.setAttribute("transform", `translate(400 0) scale(${(1 - 0.26 * Math.sin(Math.PI * eIO(pw)) ** 2 * (pw < 0.5 ? 1 : -0.35)).toFixed(4)} 1) translate(-400 0)`);
    const kw = eIO(prog(t, ck + 0.55, 0.7));
    ART.k.g.setAttribute("transform", `translate(400 0) scale(${lerp(0.82, 1, kw).toFixed(4)} 1) translate(-400 0)`);
    rise($("max-sch"), t, wIn + 0.4);

    $("ai-scroll").style.transform = `translateY(${(-((t - c["ai.land"]) * 46) - 180).toFixed(2)}px)`;
    counter($("ai-num"), t, c["L11.num"], { start: Math.max(c["ai.land"] + 0.18, c["L11.num"] - 1.6) });
    words($("ai-cap"), t, c["L11.num"] - 0.2, { stag: 0.1 });
    words($("ai-cap2"), t, c["L11.num"] + 0.12, { stag: 0.1 });
    rise($("ai-ex"), t, c["ai.land"] + 0.3);

    /* centre: the question, then the answer */
    const hit = c["price.hit"];
    words($("question"), t, c["question.in"], { stag: 0.13, dur: 0.55, out: hit - 0.2, outStag: 0.012, outDur: 0.16 });
    const pp = $("p-price"), s1 = spring(t - hit, 3.1, 0.5);
    pp.style.visibility = t >= hit ? "visible" : "hidden";
    pp.style.transform = `scale(${lerp(1.55, 1, s1).toFixed(4)})`;
    words($("p-top"), t, hit + 0.14, { stag: 0.1 });
    words($("p-only"), t, c["L14.faqat"] - 0.15, { dur: 0.5 });
    const plg = $("p-logo"), pla = eOut(prog(t, hit + 0.45, 0.6));
    plg.style.opacity = pla.toFixed(3); plg.style.transform = `translateY(${((1 - pla) * 30).toFixed(2)}px)`;
    $("scrim").style.opacity = (0.66 * eOut(prog(t, hit, 0.5))).toFixed(3);

    /* standing CTA chip -> comment field */
    const chip = $("chip"), ci = c["cta.in"], m = eIO(prog(t, ci, 0.7));
    const ca = eOut(prog(t, 1.85, 0.5)) * (1 - eIn(prog(t, c["grid.start"] - 0.1, 0.3))) + (t >= ci ? eOut(prog(t, ci, 0.5)) : 0);
    const L = lerp(230, 110, m), T = lerp(1404, 1140, m), CW = lerp(620, 860, m), CH = lerp(90, 140, m);
    chip.style.left = L.toFixed(2) + "px"; chip.style.top = (T + (1 - ca) * 36).toFixed(2) + "px"; chip.style.width = CW.toFixed(2) + "px"; chip.style.height = CH.toFixed(2) + "px";
    chip.style.borderRadius = (CH / 2).toFixed(2) + "px"; chip.style.opacity = clamp(ca * 2.5).toFixed(3);
    const lo = eIn(prog(t, ci, 0.25));
    $("chip-label").style.opacity = (1 - lo).toFixed(3); $("chip-label").style.transform = `translateY(${(-lo * 26).toFixed(2)}px)`;
    const typeT0 = c["L15.hizma"] - 0.2, nCh = clamp(Math.floor((t - typeT0) / 0.09) + 1, 0, 4);
    $("chip-typed").textContent = "حزمة".slice(0, nCh);
    const caret = $("caret"), cv = prog(t, ci + 0.45, 0.1);
    caret.style.opacity = (cv * (t > typeT0 + 0.5 && Math.floor((t - typeT0) * 2.2) % 2 === 1 ? 0 : 1)).toFixed(2);
    caret.style.right = (54 + TYPED[nCh] + 10) + "px";
    const send = $("chip-send"), sa = spring(t - (c["L15.send"] - 0.3), 3, 0.6), press = Math.exp(-Math.pow((t - c["L15.send"]) / 0.09, 2));
    send.style.transform = `scale(${(sa * (1 - 0.16 * press)).toFixed(4)})`; send.style.visibility = sa > 0 ? "visible" : "hidden";
    rise($("cta-top"), t, ci + 0.3);
    words($("cta-bot"), t, c["L15.send"] - 0.02, { stag: 0.09 });

    /* crosshair */
    const [wx, wy] = cross(t), [sx, sy] = w2s(cam, wx, wy);
    const g = $("cross-g");
    g.setAttribute("transform", `translate(${sx.toFixed(2)},${sy.toFixed(2)})`);
    g.style.opacity = (1 - prog(t, hit + 0.02, 0.18)).toFixed(3);
    let ring = 0, rt = 1;
    for (const p of PULSES) if (t >= p && t < p + 0.36) { rt = (t - p) / 0.36; ring = 1 - rt; }
    $("cross-ring").setAttribute("r", (12 + eOut(rt) * 34).toFixed(2)); $("cross-ring").style.opacity = ring.toFixed(3);

    /* footage: only the windows on screen load a frame */
    const jobs = [];
    for (const v of DRAWS) {
      const [x0, y0] = w2s(cam, ORG[v.cell][0] + v.x, ORG[v.cell][1] + v.y);
      if (t < v.t0 - 0.05 || x0 > W || y0 > H || x0 + v.w * cam.z < 0 || y0 + v.h * cam.z < 0) continue;
      const src = frameSrc(v, t);
      if (src !== v.cur) { v.cur = src; v.img.src = src; jobs.push(v.img.decode().catch(() => {})); }
    }
    if (jobs.length) await Promise.all(jobs);
  }

  window.BLUR = (t) => {                           // subframes for this output frame, from on-screen camera speed
    const a = camera(t - 1 / 60), b = camera(t + 1 / 60);
    const z = (a.z + b.z) / 2, v = Math.hypot((b.x - a.x) * z, (b.y - a.y) * z) + Math.abs(Math.log(b.z / a.z)) * 900;
    return v < 3 ? 1 : clamp(Math.ceil((v * 0.5) / 7), 2, 16);
  };

  window.READY = (async () => {
    TL = await (await fetch("timeline.json")).json();
    C = TL.cues; window.DUR = TL.meta.dur; window.FPS = TL.meta.fps; window.CUES = TL;
    for (const [name, [col, row]] of Object.entries(TL.cells)) ORG[name] = [col * W, row * H];
    await document.fonts.load('600 80px "Reem Kufi"'); await document.fonts.load('400 80px "Marcellus"');
    await document.fonts.load('500 30px "JetBrains Mono"'); await document.fonts.load('600 50px "IBM Plex Sans Arabic"'); await document.fonts.load('500 50px "IBM Plex Sans Arabic"');
    await document.fonts.ready;

    // searches that pile up, faster and faster (0.4 -> 0.25 -> 0.15 -> 0.12 ...)
    const hs = C["hook.search"];
    const Q = [["revit families free download", 1, 640, 1118, -2, -1, -2, 0], ["تحميل بلوكات أوتوكاد", 0, 800, 1222, 1.5, 1, hs * 0.18, 0.55], ["sketchup plugins pack", 1, 700, 1326, -1.5, -1, hs * 0.5, 0.5],
      ["بلوكات أثاث ريفيت", 0, 170, 1132, 2.5, 1, hs + 0.15, 0], ["3ds max kitchen script", 1, 290, 1228, -2.5, -1, hs + 0.5, 0], ["مكتبة فاميليز جاهزة", 0, 230, 1334, 2, 1, hs + 0.75, 0],
      ["islamic pattern dwg", 1, 560, 1176, -3.5, -1, hs + 0.93, 0], ["بلوكات مطابخ سكتش أب", 0, 500, 1282, 3, 1, hs + 1.06, 0]];
    Q.forEach(([txt, ltr, x, y, r, side, tAbs, type]) => {
      const el = document.createElement("div"); el.className = "pill"; el.dir = ltr ? "ltr" : "rtl";
      el.innerHTML = `<svg width="38" height="38" viewBox="0 0 38 38"><circle cx="16" cy="16" r="11" fill="none" stroke="#c9974a" stroke-width="3.5"/><path d="M25 25l9 9" stroke="#c9974a" stroke-width="3.5" stroke-linecap="round"/></svg><span>${txt}</span>`;
      el.style.left = "0"; el.style.top = "0";
      $("pills").appendChild(el);
      PILLS.push({ el, x, y, r, side, t: tAbs, type, txt, span: el.lastElementChild });
    });

    document.querySelectorAll("[data-words]").forEach(splitWords);
    document.querySelectorAll(".num[data-count]").forEach(buildCounter);
    const vp = (id, cell, t0, dur = 0.5) => { const v = buildVp($(id), cell); v.t0 = t0; v.dur = dur; DRAWS.push(v); return v; };
    vp("vp-revit", "revit", C["revit.land"] - 0.12); vp("vp-autocad", "autocad", C["autocad.land"] - 0.12); vp("vp-blocks", "blocks", C["blocks.land"] - 0.12);
    vp("vp-plgn", "sketchup", C["sketchup.land"] - 0.12);
    const wv = vp("vp-wind", "sketchup", C["L8.num"] - 0.6, 0.45);
    wv.shadow = document.createElement("div"); wv.shadow.style.cssText = "position:absolute;inset:0;box-shadow:0 34px 80px rgb(0 0 0 / .7);"; wv.el.insertBefore(wv.shadow, wv.clip);
    vp("vp-ktchn", "kitchen", C["kitchen.land"] - 0.12);

    buildArt($("max-art"));
    [["w", "tab-w"], ["d", "tab-d"], ["k", "tab-k"]].forEach(([k, id]) => {
      const el = $(id), bar = document.createElement("i"); el.appendChild(bar);
      TABS[k] = { el, bar, x: $("max-tabs").offsetLeft + el.offsetLeft, y: $("max-tabs").offsetTop + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    });
    const P = ["interior render, majlis, warm oak, soft daylight, 35mm", "floor plan options for a 12 x 18 m villa, 4 bedrooms", "material palette: travertine, brushed brass, walnut",
      "facade study, mashrabiya screen, golden hour", "client brief for a boutique hotel lobby", "lighting schedule for an open kitchen and dining", "concept statement for a desert courtyard house",
      "furniture layout, 6 x 4 m living room, two entries", "specification notes for natural stone flooring", "moodboard: calm, sand tones, linen, long shadows", "elevation options, two storeys, deep-set windows",
      "render prompt: bathroom, fluted marble, warm cove light", "space programme for a 300 m2 clinic", "joinery details for a walk-in wardrobe"];
    $("ai-scroll").innerHTML = [...P, ...P, ...P].map((p) => `<p>${p}</p>`).join("");
    const ty = $("chip-typed"); TYPED = [0, 1, 2, 3, 4].map((n) => { ty.textContent = "حزمة".slice(0, n); return ty.offsetWidth; }); ty.textContent = "";
    buildCross();
    seek.ctx = $("bg").getContext("2d");
    await seek(0);
    await Promise.all([...document.images].map((im) => (im.complete ? 0 : im.decode().catch(() => {}))));
  })();
  window.seek = seek;
})();
