(() => {
  "use strict";

  const root = document.documentElement;
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  let reduce = reduceQuery.matches;

  /* ---------- Storage (may be unavailable) ---------- */
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  };

  /* ---------- Theme ---------- */
  const savedTheme = store.get("theme");
  if (savedTheme === "light" || savedTheme === "dark") root.dataset.theme = savedTheme;

  const isDark = () => {
    const t = root.dataset.theme;
    return t ? t === "dark" : darkQuery.matches;
  };

  let palette = {};
  const themeListeners = [];
  const readPalette = () => {
    const cs = getComputedStyle(root);
    const v = (name) => cs.getPropertyValue(name).trim();
    palette = {
      paper: v("--paper"), surface: v("--surface"), ink: v("--ink"), ink2: v("--ink-2"),
      line: v("--line"), cobalt: v("--cobalt"), onCobalt: v("--on-cobalt"), accent: v("--accent-ink"),
    };
  };
  const emitTheme = () => {
    readPalette();
    syncToggle();
    themeListeners.forEach((fn) => fn());
  };

  const toggle = document.querySelector("[data-theme-toggle]");
  function syncToggle() {
    if (!toggle) return;
    const dark = isDark();
    toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    const icon = toggle.querySelector("i");
    if (icon) icon.className = "ph " + (dark ? "ph-sun" : "ph-moon");
  }
  toggle?.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    store.set("theme", next);
  });
  darkQuery.addEventListener("change", emitTheme);
  new MutationObserver(emitTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  reduceQuery.addEventListener("change", () => { reduce = reduceQuery.matches; });
  readPalette();
  syncToggle();

  /* ---------- Canvas helpers ---------- */
  function setupCanvas(canvas, onResize) {
    const ctx = canvas.getContext("2d");
    const state = { ctx, w: 0, h: 0, dpr: 1 };
    let timer = 0;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.w = rect.width; state.h = rect.height; state.dpr = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      onResize(state);
    };
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, state.w ? 120 : 0);
    }).observe(canvas);
    return state;
  }

  // Runs `step` every frame while `el` is on screen and the tab is visible.
  function runWhileVisible(el, step) {
    let visible = false, running = false;
    const tick = (t) => {
      if (!visible || document.hidden || reduce) { running = false; return; }
      step(t);
      requestAnimationFrame(tick);
    };
    const start = () => {
      if (!running && visible && !document.hidden && !reduce) {
        running = true;
        requestAnimationFrame(tick);
      }
    };
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }).observe(el);
    document.addEventListener("visibilitychange", start);
    reduceQuery.addEventListener("change", start);
    return { start };
  }

  const localPoint = (canvas, e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const fontsReady = document.fonts ? document.fonts.load("800 100px Geist").catch(() => {}) : Promise.resolve();

  /* ---------- Hero: particle wordmark ---------- */
  (function hero() {
    const canvas = document.getElementById("hero-canvas");
    if (!canvas) return;
    let parts = [];
    let gap = 6;
    const pointer = { x: -1e4, y: -1e4 };
    let firstBuild = true;

    const s = setupCanvas(canvas, () => build());

    function build() {
      if (!s.w) return;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(s.w));
      off.height = Math.max(1, Math.floor(s.h));
      const o = off.getContext("2d");
      const word = "AHMED";
      let size = Math.min(s.h * 0.62, s.w / 2.9);
      const setFont = () => { o.font = `800 ${size}px Geist, system-ui, sans-serif`; };
      setFont();
      const width = o.measureText(word).width;
      if (width > s.w * 0.96) { size *= (s.w * 0.96) / width; setFont(); }
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillText(word, off.width / 2, off.height / 2 + size * 0.04);

      const data = o.getImageData(0, 0, off.width, off.height).data;
      gap = Math.max(4, Math.round(size / 24));
      const targets = [];
      for (let y = Math.floor(gap / 2); y < off.height; y += gap) {
        for (let x = Math.floor(gap / 2); x < off.width; x += gap) {
          if (data[(y * off.width + x) * 4 + 3] > 140) targets.push(x, y);
        }
      }

      const next = [];
      for (let i = 0; i < targets.length; i += 2) {
        const prev = parts[i / 2];
        const p = prev || {
          x: firstBuild ? Math.random() * s.w : targets[i],
          y: firstBuild ? Math.random() * s.h : targets[i + 1],
          vx: 0, vy: 0, hot: Math.random() < 0.09,
        };
        p.tx = targets[i];
        p.ty = targets[i + 1];
        next.push(p);
      }
      parts = next;
      firstBuild = false;
      if (reduce) parts.forEach((p) => { p.x = p.tx; p.y = p.ty; });
      draw();
    }

    function step() {
      const radius = Math.max(70, s.w * 0.1);
      const r2 = radius * radius;
      for (const p of parts) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / radius) * 5.5;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }
        p.vx += (p.tx - p.x) * 0.04;
        p.vy += (p.ty - p.y) * 0.04;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;
      }
      draw();
    }

    function draw() {
      const { ctx } = s;
      ctx.clearRect(0, 0, s.w, s.h);
      const size = Math.max(2, gap * 0.62);
      const half = size / 2;
      ctx.fillStyle = palette.ink;
      for (const p of parts) if (!p.hot) ctx.fillRect(p.x - half, p.y - half, size, size);
      ctx.fillStyle = palette.accent;
      for (const p of parts) if (p.hot) ctx.fillRect(p.x - half, p.y - half, size, size);
    }

    canvas.addEventListener("pointermove", (e) => { const pt = localPoint(canvas, e); pointer.x = pt.x; pointer.y = pt.y; });
    canvas.addEventListener("pointerleave", () => { pointer.x = -1e4; pointer.y = -1e4; });
    canvas.addEventListener("pointercancel", () => { pointer.x = -1e4; pointer.y = -1e4; });
    canvas.addEventListener("pointerdown", (e) => {
      if (reduce) return;
      const pt = localPoint(canvas, e);
      for (const p of parts) {
        const dx = p.x - pt.x, dy = p.y - pt.y;
        const d = Math.hypot(dx, dy) || 1;
        const kick = 18 + Math.random() * 26;
        p.vx += (dx / d) * kick;
        p.vy += (dy / d) * kick;
      }
    });

    themeListeners.push(draw);
    fontsReady.then(() => build());
    runWhileVisible(canvas, step);
  })();

  /* ---------- Lab: throwable type ---------- */
  (function throwable() {
    const canvas = document.getElementById("throw-canvas");
    const resetBtn = document.getElementById("throw-reset");
    if (!canvas) return;
    const letters = [..."DRAGMEAROUND"];
    let bodies = [];
    let grabbed = null;
    let grabOffset = { x: 0, y: 0 };
    let lastMove = { x: 0, y: 0, t: 0 };

    const s = setupCanvas(canvas, () => {
      if (!bodies.length) reset();
      else {
        const r = radius();
        for (const b of bodies) {
          b.r = r;
          b.x = Math.min(Math.max(b.x, r), s.w - r);
          b.y = Math.min(b.y, s.h - r);
        }
        draw();
      }
    });

    const radius = () => Math.max(20, Math.min(s.w / 9, s.h / 7.5));

    function reset() {
      if (!s.w) return;
      const r = radius();
      if (reduce) {
        // Lay letters out in rows from the floor; no falling.
        const perRow = Math.max(1, Math.floor(s.w / (r * 2.1)));
        bodies = letters.map((ch, i) => ({
          ch, r, a: 0, vx: 0, vy: 0, kind: i % 3,
          x: r * 1.1 + (i % perRow) * r * 2.1,
          y: s.h - r - Math.floor(i / perRow) * r * 2.05,
        }));
      } else {
        bodies = letters.map((ch, i) => ({
          ch, r, kind: i % 3,
          x: r + Math.random() * (s.w - r * 2),
          y: -r * 2 - i * r * 1.1,
          vx: (Math.random() - 0.5) * 3,
          vy: 0,
          a: (Math.random() - 0.5) * 0.8,
        }));
      }
      draw();
      loop.start();
    }

    function step() {
      const g = Math.max(0.3, s.h / 900);
      for (const b of bodies) {
        if (b === grabbed) continue;
        b.vy += g;
        b.vx *= 0.996;
        b.vy *= 0.996;
        b.x += b.vx;
        b.y += b.vy;
        b.a += b.vx / b.r * 0.9;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
        if (b.x > s.w - b.r) { b.x = s.w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
        if (b.y > s.h - b.r) {
          b.y = s.h - b.r;
          b.vy = Math.abs(b.vy) < 1.2 ? 0 : -Math.abs(b.vy) * 0.42;
          b.vx *= 0.9;
        }
      }
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
        }
      }
      draw();
    }

    function collide(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) return;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const overlap = min - d;
      const aw = a === grabbed ? 0 : b === grabbed ? 1 : 0.5;
      const bw = 1 - aw;
      a.x -= nx * overlap * aw; a.y -= ny * overlap * aw;
      b.x += nx * overlap * bw; b.y += ny * overlap * bw;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) {
        const imp = -(1 + 0.35) * rv / 2;
        if (a !== grabbed) { a.vx -= imp * nx; a.vy -= imp * ny; }
        if (b !== grabbed) { b.vx += imp * nx; b.vy += imp * ny; }
      }
    }

    function draw() {
      const { ctx } = s;
      ctx.clearRect(0, 0, s.w, s.h);
      for (const b of bodies) {
        const fills = [
          [palette.cobalt, palette.onCobalt, null],
          [palette.ink, palette.paper, null],
          [palette.paper, palette.ink, palette.line],
        ];
        const [fill, text, stroke] = fills[b.kind];
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        ctx.beginPath();
        ctx.arc(0, 0, b.r - 1, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = text;
        ctx.font = `750 ${b.r * 1.05}px Geist, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.ch, 0, b.r * 0.05);
        ctx.restore();
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      const pt = localPoint(canvas, e);
      let hit = null;
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        if (Math.hypot(b.x - pt.x, b.y - pt.y) <= b.r) { hit = b; break; }
      }
      if (!hit) return;
      grabbed = hit;
      // Draw the grabbed letter on top.
      bodies.splice(bodies.indexOf(hit), 1);
      bodies.push(hit);
      grabOffset = { x: pt.x - hit.x, y: pt.y - hit.y };
      lastMove = { x: pt.x, y: pt.y, t: performance.now() };
      hit.vx = 0; hit.vy = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-grabbing");
      loop.start();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!grabbed) return;
      const pt = localPoint(canvas, e);
      const now = performance.now();
      const dt = Math.max(8, now - lastMove.t);
      grabbed.vx = ((pt.x - lastMove.x) / dt) * 16;
      grabbed.vy = ((pt.y - lastMove.y) / dt) * 16;
      lastMove = { x: pt.x, y: pt.y, t: now };
      grabbed.x = Math.min(Math.max(pt.x - grabOffset.x, grabbed.r), s.w - grabbed.r);
      grabbed.y = Math.min(pt.y - grabOffset.y, s.h - grabbed.r);
      if (reduce) draw();
    });
    const release = () => {
      if (!grabbed) return;
      const cap = 38;
      grabbed.vx = Math.max(-cap, Math.min(cap, grabbed.vx));
      grabbed.vy = Math.max(-cap, Math.min(cap, grabbed.vy));
      if (reduce) { grabbed.vx = 0; grabbed.vy = 0; }
      grabbed = null;
      canvas.classList.remove("is-grabbing");
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    resetBtn?.addEventListener("click", reset);

    const loop = runWhileVisible(canvas, step);
    themeListeners.push(draw);
    fontsReady.then(draw);
  })();

  /* ---------- Lab: spotlight grid ---------- */
  (function spotlight() {
    const canvas = document.getElementById("grid-canvas");
    if (!canvas) return;
    const target = { x: -1e4, y: -1e4 };
    const pos = { x: -1e4, y: -1e4 };
    let hasPointer = false;

    const s = setupCanvas(canvas, () => draw());

    function step(t) {
      if (!hasPointer) {
        target.x = s.w / 2 + Math.cos(t * 0.0007) * s.w * 0.32;
        target.y = s.h / 2 + Math.sin(t * 0.0011) * s.h * 0.3;
      }
      if (pos.x < -1000) { pos.x = target.x; pos.y = target.y; }
      pos.x += (target.x - pos.x) * 0.12;
      pos.y += (target.y - pos.y) * 0.12;
      draw();
    }

    function draw() {
      const { ctx } = s;
      ctx.clearRect(0, 0, s.w, s.h);
      const spacing = 22;
      const R = Math.max(110, Math.min(s.w, s.h) * 0.55);
      ctx.fillStyle = palette.onCobalt;
      for (let y = spacing / 2; y < s.h; y += spacing) {
        for (let x = spacing / 2; x < s.w; x += spacing) {
          const d = Math.hypot(x - pos.x, y - pos.y);
          const k = Math.max(0, 1 - d / R);
          const e = k * k;
          ctx.globalAlpha = 0.28 + e * 0.72;
          const r = 1.1 + e * 4.4;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    canvas.addEventListener("pointermove", (e) => {
      hasPointer = true;
      const pt = localPoint(canvas, e);
      target.x = pt.x; target.y = pt.y;
      if (reduce) { pos.x = pt.x; pos.y = pt.y; draw(); }
    });
    canvas.addEventListener("pointerleave", () => { hasPointer = false; });

    themeListeners.push(draw);
    runWhileVisible(canvas, step);
  })();

  /* ---------- Lab: decode ---------- */
  (function decode() {
    const btn = document.getElementById("decode-btn");
    const wordEl = document.getElementById("decode-word");
    const langEl = document.getElementById("decode-lang");
    const live = document.getElementById("decode-live");
    if (!btn || !wordEl) return;
    const words = [
      ["Hello", "English"], ["Marhaba", "Arabic"], ["Bonjour", "French"], ["Hola", "Spanish"],
      ["Ciao", "Italian"], ["Merhaba", "Turkish"], ["Konnichiwa", "Japanese"], ["Hallo", "German"],
    ];
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#%&*+=?<>";
    let index = 0, raf = 0, visible = false, lastChange = performance.now();

    function scrambleTo([text, lang]) {
      cancelAnimationFrame(raf);
      langEl.textContent = lang;
      live.textContent = `${text}, ${lang}`;
      lastChange = performance.now();
      if (reduce) { wordEl.textContent = text; return; }
      const from = wordEl.textContent;
      const len = Math.max(from.length, text.length);
      const queue = [];
      for (let i = 0; i < len; i++) {
        const start = Math.floor(Math.random() * 10);
        queue.push({ from: from[i] || "", to: text[i] || "", start, end: start + 8 + Math.floor(Math.random() * 14), ch: "" });
      }
      let frame = 0;
      const update = () => {
        let done = 0;
        wordEl.textContent = "";
        for (const q of queue) {
          if (frame >= q.end) { done++; wordEl.append(q.to); }
          else if (frame >= q.start) {
            if (!q.ch || Math.random() < 0.3) q.ch = glyphs[Math.floor(Math.random() * glyphs.length)];
            const span = document.createElement("span");
            span.className = "glyph";
            span.textContent = q.ch;
            wordEl.append(span);
          } else wordEl.append(q.from);
        }
        if (done < queue.length) { frame++; raf = requestAnimationFrame(update); }
        else wordEl.textContent = text;
      };
      update();
    }

    const next = () => { index = (index + 1) % words.length; scrambleTo(words[index]); };
    btn.addEventListener("click", next);

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(btn);
    setInterval(() => {
      if (visible && !reduce && !document.hidden && performance.now() - lastChange > 3200) next();
    }, 400);
  })();

  /* ---------- Lab: ripples ---------- */
  (function ripples() {
    const canvas = document.getElementById("ripple-canvas");
    if (!canvas) return;
    let rings = [];
    let last = { x: -1e4, y: -1e4 };
    let lastSpawn = 0;

    const s = setupCanvas(canvas, () => { if (reduce) drawStatic(s.w / 2, s.h / 2); else draw(); });

    const spawn = (x, y, max, strong) => {
      rings.push({ x, y, r: 2, max, life: 1, strong });
      lastSpawn = performance.now();
    };

    function step(t) {
      if (performance.now() - lastSpawn > 2200 && rings.length === 0) {
        spawn(s.w * (0.25 + Math.random() * 0.5), s.h * (0.3 + Math.random() * 0.5), 90, false);
      }
      for (const ring of rings) {
        ring.r += (ring.max - ring.r) * 0.05 + 0.35;
        ring.life -= ring.strong ? 0.012 : 0.016;
      }
      rings = rings.filter((ring) => ring.life > 0);
      draw();
    }

    function draw() {
      const { ctx } = s;
      ctx.clearRect(0, 0, s.w, s.h);
      for (const ring of rings) {
        ctx.globalAlpha = Math.max(0, ring.life);
        ctx.strokeStyle = ring.strong ? palette.accent : palette.paper;
        ctx.lineWidth = ring.strong ? 2 : 1.25;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function drawStatic(x, y) {
      const { ctx } = s;
      ctx.clearRect(0, 0, s.w, s.h);
      ctx.strokeStyle = palette.paper;
      ctx.lineWidth = 1.25;
      [18, 40, 66, 96].forEach((r, i) => {
        ctx.globalAlpha = 1 - i * 0.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    canvas.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const pt = localPoint(canvas, e);
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 22) {
        spawn(pt.x, pt.y, 50 + Math.random() * 40, false);
        last = pt;
      }
    });
    canvas.addEventListener("pointerdown", (e) => {
      const pt = localPoint(canvas, e);
      if (reduce) { drawStatic(pt.x, pt.y); return; }
      [0, 120, 240].forEach((delay) => setTimeout(() => spawn(pt.x, pt.y, 160 + delay / 2, true), delay));
    });

    themeListeners.push(() => (reduce ? drawStatic(s.w / 2, s.h / 2) : draw()));
    runWhileVisible(canvas, step);
  })();

  /* ---------- About: split words for the scroll-linked reveal ---------- */
  (function splitWords() {
    const el = document.querySelector("[data-words]");
    if (!el) return;
    const wrapText = (node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = part;
        frag.append(span);
      });
      node.replaceWith(frag);
    };
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) wrapText(node);
      else if (node.nodeType === Node.ELEMENT_NODE) node.classList.add("w");
    });
  })();

  /* ---------- Reveal on scroll (only for elements below the fold) ---------- */
  (function reveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const els = [...document.querySelectorAll("[data-reveal]")];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add("will-reveal");
      el.style.setProperty("--d", `${(i % 4) * 80}ms`);
      io.observe(el);
    });
  })();

  /* ---------- Magnetic button ---------- */
  (function magnetic() {
    if (!matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll("[data-magnetic]").forEach((zone) => {
      const btn = zone.querySelector(".btn");
      zone.addEventListener("pointermove", (e) => {
        if (reduce) return;
        const r = zone.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        zone.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
        if (btn) btn.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`;
      });
      zone.addEventListener("pointerleave", () => {
        zone.style.transform = "";
        if (btn) btn.style.transform = "";
      });
    });
  })();
})();
