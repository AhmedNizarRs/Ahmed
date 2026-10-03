(() => {
  "use strict";

  const STORE_URL = "https://linktr.ee/rimalinteriors";

  // PLACEHOLDER CATALOG. Replace names, descriptions, formats and links with the
  // real products from the Rimal Interiors store. `art` picks the card drawing:
  // pattern, furniture, iso, board, texture or plan.
  const TOOLS = [
    { name: "Arabic Geometric Patterns", cat: "surface", label: "Vectors", format: "DXF · SVG", art: "pattern",
      desc: "Star and girih patterns as clean vectors for screens, panels, CNC cutting and renders.", url: STORE_URL },
    { name: "Furniture Block Library", cat: "cad", label: "CAD blocks", format: "DWG", art: "furniture",
      desc: "Plan blocks for sofas, beds, dining sets and joinery, drawn to real sizes.", url: STORE_URL },
    { name: "Interior 3D Model Pack", cat: "cad", label: "3D models", format: "SKP", art: "iso",
      desc: "Ready-to-place models for living, dining and bedroom layouts.", url: STORE_URL },
    { name: "Presentation Board Template", cat: "present", label: "Template", format: "PSD", art: "board",
      desc: "Layered boards for concept, materials and final renders.", url: STORE_URL },
    { name: "Material & Texture Pack", cat: "surface", label: "Textures", format: "JPG", art: "texture",
      desc: "Stone, wood, plaster and fabric textures for your renders.", url: STORE_URL },
    { name: "Space Planning Guide", cat: "present", label: "Guide", format: "PDF", art: "plan",
      desc: "Clearances, circulation and room sizes for homes, on printable sheets.", url: STORE_URL },
  ];

  /* ---------------- Basics ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceQ = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = reduceQ.matches;
  reduceQ.addEventListener("change", () => { reduce = reduceQ.matches; });
  const finePointer = matchMedia("(pointer: fine)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* unavailable */ } },
  };

  let toastTimer = 0;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  /* ---------------- Theme ---------------- */
  const lightQ = matchMedia("(prefers-color-scheme: light)");
  const saved = store.get("rimal-theme");
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  const isLight = () => (root.dataset.theme ? root.dataset.theme === "light" : lightQ.matches);
  let palette = {};
  const themeListeners = [];
  function readPalette() {
    const cs = getComputedStyle(root);
    const v = (n) => cs.getPropertyValue(n).trim();
    palette = { bg: v("--bg"), surface: v("--surface"), line: v("--line"), ink: v("--ink"), ink2: v("--ink-2"),
      gold: v("--gold"), goldHi: v("--gold-hi"), goldInk: v("--gold-ink"), duneLine: v("--dune-line"), duneHot: v("--dune-hot") };
  }
  const toggle = $("[data-theme-toggle]");
  function syncToggle() {
    const light = isLight();
    toggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    $("i", toggle).className = "ph " + (light ? "ph-moon" : "ph-sun");
  }
  function emitTheme() { readPalette(); syncToggle(); themeListeners.forEach((f) => f()); }
  toggle.addEventListener("click", () => {
    const next = isLight() ? "dark" : "light";
    root.dataset.theme = next;
    store.set("rimal-theme", next);
  });
  lightQ.addEventListener("change", emitTheme);
  new MutationObserver(emitTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  readPalette();
  syncToggle();

  /* ---------------- Simplex noise (shared by the shader and the HUD) ---------------- */
  const mod289 = (x) => x - 289 * Math.floor(x / 289);
  const permute = (x) => mod289((x * 34 + 1) * x);
  const fract = (x) => x - Math.floor(x);
  function snoise(vx, vy) {
    const C0 = 0.211324865405187, C1 = 0.366025403784439, C2 = -0.577350269189626, C3 = 0.024390243902439;
    const s = (vx + vy) * C1;
    let ix = Math.floor(vx + s), iy = Math.floor(vy + s);
    const t = (ix + iy) * C0;
    const x0x = vx - ix + t, x0y = vy - iy + t;
    const i1x = x0x > x0y ? 1 : 0, i1y = x0x > x0y ? 0 : 1;
    const x1x = x0x + C0 - i1x, x1y = x0y + C0 - i1y;
    const x2x = x0x + C2, x2y = x0y + C2;
    ix = mod289(ix); iy = mod289(iy);
    const p = [0, i1y, 1].map((o, k) => permute(permute(iy + o) + ix + [0, i1x, 1][k]));
    const d = [x0x * x0x + x0y * x0y, x1x * x1x + x1y * x1y, x2x * x2x + x2y * x2y];
    const xs = [[x0x, x0y], [x1x, x1y], [x2x, x2y]];
    let sum = 0;
    for (let k = 0; k < 3; k++) {
      let m = Math.max(0.5 - d[k], 0);
      m = m * m; m = m * m;
      const x = 2 * fract(p[k] * C3) - 1;
      const h = Math.abs(x) - 0.5;
      const a0 = x - Math.floor(x + 0.5);
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      sum += m * (a0 * xs[k][0] + h * xs[k][1]);
    }
    return 130 * sum;
  }
  function duneHeight(px, pz, t) {
    const warp = 0.35 * snoise(px * 0.1, pz * 0.1);
    const n = snoise(px * 0.16 + t * 0.015, pz * 0.42 + warp);
    let ridge = 1 - Math.abs(n);
    ridge = ridge * ridge * ridge;
    const base = snoise(px * 0.07 + 3.7, pz * 0.07 + 1.3) * 0.5 + 0.5;
    const rip = snoise(px * 1.4 + t * 0.12, pz * 3.2) * 0.01;
    return ridge * (0.5 + 1.2 * base) + rip;
  }

  /* ---------------- Hero: topographic dunes ---------------- */
  const GLSL_NOISE = `
    vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    float duneHeight(vec2 p, float t) {
      float warp = 0.35 * snoise(p * 0.1);
      float n = snoise(vec2(p.x * 0.16 + t * 0.015, p.y * 0.42 + warp));
      float ridge = 1.0 - abs(n);
      ridge = ridge * ridge * ridge;
      float base = snoise(p * 0.07 + vec2(3.7, 1.3)) * 0.5 + 0.5;
      float rip = snoise(vec2(p.x * 1.4 + t * 0.12, p.y * 3.2)) * 0.01;
      return ridge * (0.5 + 1.2 * base) + rip;
    }`;

  function initDunes() {
    const canvas = $("#dunes");
    const hero = $(".hero");
    const T = window.THREE;
    if (!canvas || !T) return;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(0, 4.4, 9.5);
    camera.lookAt(0, 0, -3.5);

    const small = window.innerWidth < 768;
    const geo = new T.PlaneGeometry(46, 42, small ? 200 : 340, small ? 180 : 320);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -11);

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new T.Vector2(0, 2) },
      uPush: { value: 0 },
      uLine: { value: new T.Color(palette.duneLine) },
      uHot: { value: new T.Color(palette.duneHot) },
      uDensity: { value: 7.5 },
    };
    const material = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      extensions: { derivatives: true },
      vertexShader: `
        uniform float uTime; uniform vec2 uMouse; uniform float uPush;
        varying float vH; varying vec2 vXZ; varying float vDepth; varying float vNear;
        ${GLSL_NOISE}
        void main() {
          vec3 p = position;
          float h = duneHeight(p.xz, uTime);
          float d = length(p.xz - uMouse);
          float near = exp(-d * d * 0.9);
          h += uPush * (0.55 * near + 0.06 * sin(d * 6.0 - uTime * 3.0) * exp(-d * 0.7));
          p.y = h;
          vH = h; vXZ = p.xz; vNear = near;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uLine; uniform vec3 uHot; uniform float uDensity; uniform float uPush;
        varying float vH; varying vec2 vXZ; varying float vDepth; varying float vNear;
        void main() {
          float c = vH * uDensity;
          float w = fwidth(c);
          float line = 1.0 - smoothstep(0.0, w * 1.4, abs(fract(c - 0.5) - 0.5));
          float c5 = c / 5.0;
          float w5 = fwidth(c5);
          float major = 1.0 - smoothstep(0.0, w5 * 1.6, abs(fract(c5 - 0.5) - 0.5));
          vec2 g = vXZ * 0.5;
          vec2 gw = fwidth(g);
          vec2 gl = 1.0 - smoothstep(vec2(0.0), gw * 1.2, abs(fract(g - 0.5) - 0.5));
          float grid = max(gl.x, gl.y) * 0.12;
          float fade = smoothstep(40.0, 7.0, vDepth) * smoothstep(1.5, 4.0, vDepth);
          float glow = vNear * uPush;
          vec3 col = mix(uLine, uHot, clamp(major * 0.7 + glow, 0.0, 1.0));
          float a = (line * 0.5 + major * 0.5 + grid + vH * 0.05) * fade;
          a = clamp(a + line * glow * 0.6, 0.0, 1.0);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    scene.add(new T.Mesh(geo, material));

    themeListeners.push(() => {
      uniforms.uLine.value.set(palette.duneLine);
      uniforms.uHot.value.set(palette.duneHot);
      if (!running) render();
    });

    const ray = new T.Raycaster();
    const plane = new T.Plane(new T.Vector3(0, 1, 0), -0.6);
    const ndc = new T.Vector2();
    const hit = new T.Vector3();
    const target = new T.Vector2(0, 2);
    let pushTarget = 0, lastMove = -1e9, time = 0, running = false, visible = true;
    const hx = $("#hud-x"), hy = $("#hud-y"), hh = $("#hud-h");

    function updateHud(x, z) {
      const h = duneHeight(x, z, time) + uniforms.uPush.value * 0.55 * Math.exp(-((x - uniforms.uMouse.value.x) ** 2 + (z - uniforms.uMouse.value.y) ** 2) * 0.9);
      hx.textContent = (x * 10).toFixed(2);
      hy.textContent = (-z * 10).toFixed(2);
      hh.textContent = (h * 10).toFixed(2);
    }

    hero.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        target.set(hit.x, hit.z);
        pushTarget = 1;
        lastMove = performance.now();
        if (reduce) { uniforms.uMouse.value.copy(target); uniforms.uPush.value = 1; render(); }
        updateHud(hit.x, hit.z);
      }
    });

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1 ? 55 : 42;
      camera.updateProjectionMatrix();
      render();
    }
    function render() { renderer.render(scene, camera); }

    let last = performance.now();
    function tick(now) {
      if (!visible || document.hidden || reduce) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      uniforms.uTime.value = time;
      // When nobody is steering, a slow gust wanders across the dunes.
      if (now - lastMove > 3500) {
        target.set(Math.sin(time * 0.23) * 6, -2 + Math.cos(time * 0.17) * 3);
        pushTarget = 0.7;
        if (Math.floor(time * 4) % 2 === 0) updateHud(uniforms.uMouse.value.x, uniforms.uMouse.value.y);
      } else {
        pushTarget *= 0.985;
      }
      uniforms.uMouse.value.lerp(target, 0.08);
      uniforms.uPush.value += (pushTarget - uniforms.uPush.value) * 0.06;
      render();
      requestAnimationFrame(tick);
    }
    function start() {
      if (running || !visible || document.hidden || reduce) { if (reduce) render(); return; }
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);
    document.addEventListener("visibilitychange", start);
    reduceQ.addEventListener("change", start);
    updateHud(0, 2);
  }

  /* ---------------- Geometry: star patterns (Hankin's method) ---------------- */
  function tilingPolygons(type, a, W, H) {
    const polys = [];
    const add = (pts) => polys.push(pts);
    if (type === "square") {
      for (let y = -a; y < H + a; y += a) for (let x = -a; x < W + a; x += a) add([[x, y], [x + a, y], [x + a, y + a], [x, y + a]]);
    } else if (type === "hex") {
      const R = a / Math.sqrt(3);
      const vy = 1.5 * R;
      for (let j = -1, y = -R; y < H + R * 2; j++, y += vy) {
        for (let x = (j & 1 ? a / 2 : 0) - a; x < W + a; x += a) {
          const pts = [];
          for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + (k * Math.PI) / 3; pts.push([x + R * Math.cos(t), y + R * Math.sin(t)]); }
          add(pts);
        }
      }
    } else if (type === "tri") {
      const h = (a * Math.sqrt(3)) / 2;
      for (let j = -1; j * h < H + h; j++) {
        const y = j * h, off = j & 1 ? a / 2 : 0;
        for (let x = -a + off; x < W + a; x += a) {
          add([[x, y + h], [x + a, y + h], [x + a / 2, y]]);
          add([[x + a / 2, y], [x + a, y + h], [x + a * 1.5, y]]);
        }
      }
    } else {
      // 4.8.8: octagons on a square lattice with small squares in the gaps.
      const s = a / (1 + Math.SQRT2);
      const R = s / (2 * Math.sin(Math.PI / 8));
      const q = s / Math.SQRT2;
      for (let y = -a; y < H + a; y += a) {
        for (let x = -a; x < W + a; x += a) {
          const oct = [];
          for (let k = 0; k < 8; k++) { const t = Math.PI / 8 + (k * Math.PI) / 4; oct.push([x + R * Math.cos(t), y + R * Math.sin(t)]); }
          add(oct);
          const cx = x + a / 2, cy = y + a / 2;
          add([[cx, cy - q], [cx + q, cy], [cx, cy + q], [cx - q, cy]]);
        }
      }
    }
    return polys;
  }

  function hankin(polys, thetaDeg, delta) {
    const th = (thetaDeg * Math.PI) / 180;
    const segs = [];
    const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
    for (const poly of polys) {
      const n = poly.length;
      let cx = 0, cy = 0;
      poly.forEach((p) => { cx += p[0]; cy += p[1]; });
      cx /= n; cy /= n;
      const mids = [], dirs = [];
      let edge = 0;
      for (let i = 0; i < n; i++) {
        const A = poly[i], B = poly[(i + 1) % n];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy);
        edge = len;
        mids.push([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]);
        dirs.push([dx / len, dy / len]);
      }
      const inward = (v, m) => {
        const r1 = rot(v, th), r2 = rot(v, -th);
        const tx = cx - m[0], ty = cy - m[1];
        return r1[0] * tx + r1[1] * ty >= r2[0] * tx + r2[1] * ty ? r1 : r2;
      };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const d1 = dirs[i], d2 = dirs[j];
        const p1 = [mids[i][0] + d1[0] * delta, mids[i][1] + d1[1] * delta];
        const p2 = [mids[j][0] - d2[0] * delta, mids[j][1] - d2[1] * delta];
        const r1 = inward(d1, mids[i]);
        const r2 = inward([-d2[0], -d2[1]], mids[j]);
        const cross = r1[0] * r2[1] - r1[1] * r2[0];
        if (Math.abs(cross) < 1e-9) continue;
        const qx = p2[0] - p1[0], qy = p2[1] - p1[1];
        const s = (qx * r2[1] - qy * r2[0]) / cross;
        const t = (qx * r1[1] - qy * r1[0]) / cross;
        if (s <= 0 || t <= 0 || s > edge * 3 || t > edge * 3) continue;
        const X = [p1[0] + r1[0] * s, p1[1] + r1[1] * s];
        segs.push([p1[0], p1[1], X[0], X[1]], [p2[0], p2[1], X[0], X[1]]);
      }
    }
    return segs;
  }

  /* ---------------- Card blueprints ---------------- */
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const circlePts = (cx, cy, r, n = 56, a0 = 0, a1 = Math.PI * 2) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
    return pts;
  };
  const rotRect = (cx, cy, w, h, ang) => rectPts(-w / 2, -h / 2, w, h).map(([x, y]) => [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const ART = {
    pattern(W, H) {
      const a = Math.max(70, Math.min(W, H) / 3.2);
      const segs = hankin(tilingPolygons("488", a * 0.55, W, H), 72.5, 0);
      return { paths: segs.map((s) => ({ pts: [[s[0], s[1]], [s[2], s[3]]], w: 1.4 })), labels: [] };
    },
    furniture(W, H) {
      const s = Math.min(W, H) * 0.82, ox = (W - s) / 2, oy = (H - s) / 2;
      const P = (x, y) => [ox + x * s, oy + y * s];
      const R = (x, y, w, h) => rectPts(...P(x, y), w * s, h * s);
      const paths = [];
      const add = (pts, w = 1.2, hot = false) => paths.push({ pts, w, hot });
      add(R(0.04, 0.06, 0.5, 0.18), 1.6);
      add(R(0.04, 0.06, 0.5, 0.05));
      [0, 1, 2].forEach((i) => add(R(0.07 + i * 0.15, 0.12, 0.14, 0.1)));
      add(R(0.14, 0.33, 0.3, 0.13), 1.2, true);
      add(R(0.64, 0.06, 0.18, 0.18), 1.6);
      add(R(0.67, 0.09, 0.12, 0.13));
      const [tx, ty] = P(0.72, 0.66);
      add(circlePts(tx, ty, 0.12 * s), 1.6, true);
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2;
        add(rotRect(tx + Math.cos(t) * 0.19 * s, ty + Math.sin(t) * 0.19 * s, 0.08 * s, 0.07 * s, t));
      }
      add(R(0.04, 0.54, 0.36, 0.42), 1.6);
      add(R(0.07, 0.57, 0.13, 0.08));
      add(R(0.24, 0.57, 0.13, 0.08));
      add([P(0.04, 0.74), P(0.4, 0.74)]);
      return { paths, labels: [{ x: P(0.04, 0.5)[0], y: P(0.04, 0.5)[1], t: "SOFA 2200" }, { x: P(0.56, 0.91)[0], y: P(0.56, 0.91)[1], t: "DINING Ø1200" }] };
    },
    iso(W, H) {
      const k = Math.min(W / 9, H / 7.5);
      const cx = W / 2, cy = H * 0.4;
      const I = (x, y, z) => [cx + (x - y) * Math.cos(Math.PI / 6) * k, cy + (x + y) * Math.sin(Math.PI / 6) * k - z * k];
      const paths = [];
      const add = (pts, w = 1.2, hot = false) => paths.push({ pts, w, hot });
      add([I(0, 0, 0), I(4, 0, 0), I(4, 4, 0), I(0, 4, 0), I(0, 0, 0)], 1.6);
      add([I(0, 0, 0), I(0, 0, 3), I(4, 0, 3), I(4, 0, 0)], 1.6);
      add([I(0, 0, 3), I(0, 4, 3), I(0, 4, 0)], 1.6);
      for (let i = 1; i < 4; i++) { add([I(i, 0, 0), I(i, 4, 0)], 0.6); add([I(0, i, 0), I(4, i, 0)], 0.6); }
      const arch = [I(1.3, 0, 0.7), I(1.3, 0, 1.8)];
      for (let i = 0; i <= 24; i++) { const t = Math.PI - (i / 24) * Math.PI; arch.push(I(2 + Math.cos(t) * 0.7, 0, 1.8 + Math.sin(t) * 0.7)); }
      arch.push(I(2.7, 0, 0.7), I(1.3, 0, 0.7));
      add(arch, 1.4, true);
      const b = (x0, y0, x1, y1, z) => {
        add([I(x0, y0, 0), I(x1, y0, 0), I(x1, y1, 0), I(x0, y1, 0), I(x0, y0, 0)]);
        add([I(x0, y0, z), I(x1, y0, z), I(x1, y1, z), I(x0, y1, z), I(x0, y0, z)], 1.4);
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => add([I(x, y, 0), I(x, y, z)]));
      };
      b(2.2, 2.0, 3.6, 3.0, 0.9);
      b(0.4, 1.6, 1.0, 3.4, 1.5);
      return { paths, labels: [] };
    },
    board(W, H) {
      const m = Math.min(W, H) * 0.08;
      const w = W - m * 2, h = H - m * 2;
      const paths = [];
      const add = (pts, wt = 1.2, hot = false) => paths.push({ pts, w: wt, hot });
      add(rectPts(m, m, w, h), 1.6);
      const lw = w * 0.56;
      add(rectPts(m + 10, m + 10, lw - 15, h - 20 - h * 0.16));
      const ax = m + 10 + (lw - 15) / 2, ar = (lw - 15) * 0.28, ay = m + 10 + (h - 20 - h * 0.16) * 0.42;
      add([[ax - ar, m + h - 20 - h * 0.16 + 10], [ax - ar, ay], ...circlePts(ax, ay, ar, 30, Math.PI, Math.PI * 2), [ax + ar, ay], [ax + ar, m + h - 20 - h * 0.16 + 10]], 1.4, true);
      const rx = m + lw + 5, rw = w - lw - 15;
      const ph = (h - 30) / 3;
      add(rectPts(rx, m + 10, rw, ph - 5));
      for (let i = 0; i < 4; i++) add(circlePts(rx + rw * (0.15 + i * 0.23), m + 10 + (ph - 5) / 2, Math.min(rw * 0.09, ph * 0.25), 28), 1.2, i === 1);
      add(rectPts(rx, m + 10 + ph, rw, ph - 5));
      for (let i = 0; i < 4; i++) add([[rx + 10, m + 10 + ph + 14 + i * 10], [rx + rw * (i === 3 ? 0.5 : 0.85), m + 10 + ph + 14 + i * 10]], 0.8);
      add(rectPts(rx, m + 10 + ph * 2, rw, ph - 5));
      add([[rx + rw * 0.2, m + 10 + ph * 2 + 8], [rx + rw * 0.2, m + 5 + ph * 3 - 8]], 0.8);
      add([[rx + 8, m + 10 + ph * 2 + (ph - 5) / 2], [rx + rw - 8, m + 10 + ph * 2 + (ph - 5) / 2]], 0.8);
      add([[m + 10, m + h - h * 0.08], [m + w * 0.4, m + h - h * 0.08]], 1.6);
      add([[m + 10, m + h - h * 0.08 + 9], [m + w * 0.25, m + h - h * 0.08 + 9]], 0.8);
      return { paths, labels: [] };
    },
    texture(W, H) {
      seed = 11;
      const cols = 3, rows = 2, gap = 10;
      const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows;
      const paths = [];
      const add = (pts, w = 1, hot = false) => paths.push({ pts, w, hot });
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = gap + c * (cw + gap), y = gap + r * (ch + gap), kind = r * cols + c;
        add(rectPts(x, y, cw, ch), 1.4, kind === 4);
        if (kind === 0) for (let i = 1; i < 9; i++) { const pts = []; for (let j = 0; j <= 20; j++) pts.push([x + (cw * j) / 20, y + (ch * i) / 9 + Math.sin(j * 0.6 + i) * 3]); add(pts, 0.8); }
        if (kind === 1) for (let i = 0; i < 4; i++) { add([[x, y + (ch * (i + 1)) / 4], [x + cw, y + (ch * (i + 1)) / 4]], 0.8); const off = i % 2 ? cw / 4 : 0; for (let j = off; j < cw; j += cw / 2) add([[x + j, y + (ch * i) / 4], [x + j, y + (ch * (i + 1)) / 4]], 0.8); }
        if (kind === 2) for (let i = 0; i < 26; i++) add(circlePts(x + 8 + rand() * (cw - 16), y + 8 + rand() * (ch - 16), 1.5 + rand() * 4, 10), 0.8);
        if (kind === 3) for (let i = -ch; i < cw; i += 9) { add([[x + Math.max(0, i), y + Math.max(0, -i)], [x + Math.min(cw, i + ch), y + Math.min(ch, ch - (i + ch - cw > 0 ? i + ch - cw : 0))]], 0.6); }
        if (kind === 4) for (let i = 0; i < 3; i++) { const pts = []; let px = x + rand() * cw * 0.3, py = y; for (let j = 0; j <= 16; j++) { pts.push([Math.min(x + cw, Math.max(x, px)), y + (ch * j) / 16]); px += (rand() - 0.3) * cw * 0.12; } add(pts, 1, true); }
        if (kind === 5) for (let i = 0; i < 70; i++) { const px = x + 6 + rand() * (cw - 12), py = y + 6 + rand() * (ch - 12); add([[px - 1.5, py], [px + 1.5, py]], 0.8); }
      }
      return { paths, labels: [] };
    },
    plan(W, H) {
      const m = 28, w = W - m * 2, h = H - m * 2.2;
      const paths = [];
      const add = (pts, wt = 1.2, hot = false) => paths.push({ pts, w: wt, hot });
      const x0 = m, y0 = m;
      add(rectPts(x0, y0, w, h), 2.4);
      add(rectPts(x0 + 6, y0 + 6, w - 12, h - 12), 1);
      const vx = x0 + w * 0.42, vx2 = x0 + w * 0.72, hy = y0 + h * 0.55;
      add([[vx, y0 + 6], [vx, hy - 34]], 2);
      add([[vx, hy], [vx, y0 + h - 6]], 2);
      add([[x0 + 6, hy], [vx - 40, hy]], 2);
      add([[vx + 6, hy], [vx2, hy]], 2);
      add([[vx2, y0 + 6], [vx2, y0 + h - 6]], 2);
      add([[vx, hy - 34], ...circlePts(vx, hy, 34, 16, -Math.PI / 2, 0)], 1, true);
      add([[vx - 40, hy], ...circlePts(vx - 40, hy, 34, 16, -Math.PI / 2, -Math.PI)], 1, true);
      [[x0 + w * 0.12, x0 + w * 0.3], [x0 + w * 0.5, x0 + w * 0.64], [x0 + w * 0.8, x0 + w * 0.94]].forEach(([a, b]) => {
        add([[a, y0], [b, y0]], 0.8); add([[a, y0 + 3], [b, y0 + 3]], 0.8);
      });
      const dy = y0 + h + 18;
      add([[x0, dy], [x0 + w, dy]], 0.8);
      [x0, vx, vx2, x0 + w].forEach((x) => add([[x - 4, dy + 4], [x + 4, dy - 4]], 1));
      return { paths, labels: [
        { x: (x0 + vx) / 2 - 14, y: dy - 6, t: "4200" }, { x: (vx + vx2) / 2 - 14, y: dy - 6, t: "3000" }, { x: (vx2 + x0 + w) / 2 - 14, y: dy - 6, t: "3200" },
        { x: x0 + 18, y: y0 + 28, t: "LIVING" }, { x: vx + 18, y: y0 + 28, t: "KITCHEN" }, { x: vx2 + 14, y: y0 + 28, t: "BED 1" },
      ] };
    },
  };

  function drawArt(ctx, art, W, H, progress, pointer) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let stroke = palette.ink2;
    let hot = palette.gold;
    if (pointer) {
      const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.max(W, H) * 0.45);
      g.addColorStop(0, palette.goldHi);
      g.addColorStop(1, palette.ink2);
      stroke = g;
    }
    for (const p of art.paths) {
      const len = p.len;
      ctx.setLineDash(progress >= 1 ? [] : [len * progress, len + 1]);
      ctx.strokeStyle = p.hot ? hot : stroke;
      ctx.globalAlpha = p.hot ? 1 : 0.85;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.min(1, progress * 1.4);
    ctx.fillStyle = palette.goldInk;
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    art.labels.forEach((l) => ctx.fillText(l.t, l.x, l.y));
    ctx.globalAlpha = 1;
  }

  function renderTools() {
    const grid = $("#tool-grid");
    TOOLS.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "tool";
      li.dataset.cat = t.cat;
      li.innerHTML = `
        <div class="tool-art"><canvas aria-hidden="true"></canvas></div>
        <div class="tool-body">
          <div class="tool-top"><span class="tool-cat"></span><span class="tool-format"></span></div>
          <h3></h3>
          <p></p>
          <a class="tool-get" target="_blank" rel="noopener">Get it <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>
        </div>`;
      $(".tool-cat", li).textContent = t.label;
      $(".tool-format", li).textContent = t.format;
      $("h3", li).textContent = t.name;
      $("p", li).textContent = t.desc;
      const link = $(".tool-get", li);
      link.href = t.url;
      link.setAttribute("aria-label", `Get ${t.name} on the Rimal Interiors store`);
      grid.append(li);

      const canvas = $("canvas", li);
      const ctx = canvas.getContext("2d");
      let art = null, W = 0, H = 0, progress = reduce ? 1 : 0, pointer = null, animating = false;
      const build = () => {
        art = ART[t.art](W, H);
        art.paths.forEach((p) => {
          let L = 0;
          for (let k = 1; k < p.pts.length; k++) L += Math.hypot(p.pts[k][0] - p.pts[k - 1][0], p.pts[k][1] - p.pts[k - 1][1]);
          p.len = L;
        });
      };
      const draw = () => { if (art) drawArt(ctx, art, W, H, progress, pointer); };
      new ResizeObserver(() => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
        draw();
      }).observe(canvas);
      themeListeners.push(draw);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting || animating || progress >= 1) return;
        io.disconnect();
        animating = true;
        const t0 = performance.now();
        const step = (now) => {
          progress = Math.min(1, (now - t0) / 1800);
          progress = 1 - Math.pow(1 - progress, 3);
          draw();
          if (progress < 1) requestAnimationFrame(step); else animating = false;
        };
        requestAnimationFrame(step);
      }, { threshold: 0.25 });
      if (!reduce) io.observe(li);

      if (finePointer) {
        li.addEventListener("pointermove", (e) => {
          const r = li.getBoundingClientRect();
          const mx = e.clientX - r.left, my = e.clientY - r.top;
          li.style.setProperty("--mx", `${mx}px`);
          li.style.setProperty("--my", `${my}px`);
          const cr = canvas.getBoundingClientRect();
          pointer = { x: e.clientX - cr.left, y: e.clientY - cr.top };
          if (!reduce) {
            const rx = ((my / r.height) - 0.5) * -5;
            const ry = ((mx / r.width) - 0.5) * 6;
            li.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
          }
          if (!animating) draw();
        });
        li.addEventListener("pointerleave", () => {
          pointer = null;
          li.style.transform = "";
          if (!animating) draw();
        });
      }
    });

    $$(".filters .chip").forEach((chip) => chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      $$(".filters .chip").forEach((c) => { const on = c === chip; c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", String(on)); });
      grid.classList.toggle("is-filtered", f !== "all");
      $$(".tool", grid).forEach((li) => li.classList.toggle("is-hidden", f !== "all" && li.dataset.cat !== f));
    }));
  }

  /* ---------------- Pattern lab ---------------- */
  const COLORWAYS = {
    night: { bg: "#120c09", line: "#c9974a", hi: "#f0c47e" },
    sand: { bg: "#f3eee6", line: "#3b1f17", hi: "#b5823a" },
    cocoa: { bg: "#3b1f17", line: "#e9dcc6", hi: "#e6bd76" },
  };
  const TILING_NAMES = { 488: "Star & cross", square: "Square", hex: "Hexagon", tri: "Triangle" };
  // Below 90 - 180/n the rays of an n-sided cell meet outside it and no star forms.
  const STAR_MIN = { 488: 67.5, square: 45, hex: 60, tri: 30 };

  function initLab() {
    const canvas = $("#lab-canvas");
    const ctx = canvas.getContext("2d");
    const st = { tiling: "488", angle: 72.5, gap: 0, scale: 110, weight: 2, colorway: "night" };
    let W = 0, H = 0, segs = [], pointer = null, playing = false, playT = 0;

    const compute = (w, h, k = 1) => hankin(tilingPolygons(st.tiling, st.scale * k, w, h), st.angle, st.gap * k);

    function draw() {
      if (!W) return;
      const c = COLORWAYS[st.colorway];
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = "round";
      ctx.lineWidth = st.weight;
      if (pointer) {
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.max(W, H) * 0.4);
        g.addColorStop(0, c.hi);
        g.addColorStop(1, c.line);
        ctx.strokeStyle = g;
      } else {
        ctx.strokeStyle = c.line;
      }
      ctx.beginPath();
      for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
      ctx.stroke();
      $("#lab-meta").textContent = `${segs.length.toLocaleString()} line segments, ${TILING_NAMES[st.tiling].toLowerCase()} grid`;
    }
    function update() { segs = compute(W, H); draw(); }

    new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      update();
    }).observe(canvas);

    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      draw();
    });
    canvas.addEventListener("pointerleave", () => { pointer = null; draw(); });

    const ranges = [
      ["angle", (v) => `${v}°`], ["gap", (v) => `${v}`], ["scale", (v) => `${v} px`], ["weight", (v) => `${v}`],
    ];
    const syncRange = (key, fmt) => {
      const input = $(`#lab-${key}`);
      input.value = st[key];
      $(`#lab-${key}-out`).textContent = fmt(st[key]);
      input.style.setProperty("--fill", `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
    };
    ranges.forEach(([key, fmt]) => {
      const input = $(`#lab-${key}`);
      input.addEventListener("input", () => { st[key] = Number(input.value); syncRange(key, fmt); update(); });
      syncRange(key, fmt);
    });
    $$('input[name="tiling"]').forEach((r) => r.addEventListener("change", () => {
      st.tiling = r.value;
      // Stars need an angle above 90 - 180/n for each polygon in the grid.
      const defaults = { 488: 72.5, square: 72, hex: 70, tri: 50 };
      st.angle = defaults[st.tiling];
      syncRange("angle", ranges[0][1]);
      update();
    }));
    $$('input[name="colorway"]').forEach((r) => r.addEventListener("change", () => { st.colorway = r.value; draw(); }));

    const playBtn = $("#lab-play");
    function setPlaying(on) {
      playing = on;
      playBtn.setAttribute("aria-pressed", String(on));
      playBtn.innerHTML = on ? '<i class="ph ph-pause" aria-hidden="true"></i> Pause' : '<i class="ph ph-play" aria-hidden="true"></i> Animate';
      if (on) {
        let last = performance.now();
        const step = (now) => {
          if (!playing) return;
          playT += (now - last) / 1000;
          last = now;
          const lo = STAR_MIN[st.tiling] + 2, hi = 86;
          st.angle = Math.round((lo + (hi - lo) * (0.5 + 0.5 * Math.sin(playT * 0.6))) * 2) / 2;
          syncRange("angle", ranges[0][1]);
          update();
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }
    playBtn.addEventListener("click", () => setPlaying(!playing));

    $("#lab-shuffle").addEventListener("click", () => {
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      st.tiling = pick(["488", "488", "square", "hex", "tri"]);
      st.angle = Math.round((STAR_MIN[st.tiling] + 3 + Math.random() * (85 - STAR_MIN[st.tiling] - 3)) * 2) / 2;
      st.gap = pick([0, 0, 3, 5, 8]);
      st.scale = Math.round((70 + Math.random() * 100) / 5) * 5;
      st.weight = pick([1, 1.5, 2, 2.5, 3]);
      st.colorway = pick(Object.keys(COLORWAYS));
      $(`input[name="tiling"][value="${st.tiling}"]`).checked = true;
      $(`input[name="colorway"][value="${st.colorway}"]`).checked = true;
      ranges.forEach(([k, f]) => syncRange(k, f));
      update();
    });

    function svgMarkup() {
      const size = 1000;
      const k = size / W;
      const out = compute(size, size * (H / W), k);
      const c = COLORWAYS[st.colorway];
      const r = (n) => Math.round(n * 100) / 100;
      const d = out.map((s) => `M${r(s[0])} ${r(s[1])}L${r(s[2])} ${r(s[3])}`).join("");
      const h = r(size * (H / W));
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${h}" width="${size}" height="${h}">` +
        `<rect width="100%" height="100%" fill="${c.bg}"/>` +
        `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="${r(st.weight * k)}" stroke-linecap="round"/></svg>`;
    }
    $("#lab-download").addEventListener("click", () => {
      const blob = new Blob([svgMarkup()], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rimal-pattern-${st.tiling}-${st.angle}.svg`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Downloading your SVG pattern");
    });
    $("#lab-copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(svgMarkup());
        toast("SVG copied. Paste it into Illustrator, Figma or a text file.");
      } catch {
        toast("Copy is blocked here. Use Download SVG instead.");
      }
    });
  }

  /* ---------------- Instagram handle wave ---------------- */
  function initInsta() {
    const handle = $(".insta-handle");
    const text = handle.textContent;
    handle.textContent = "";
    [...text].forEach((ch) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch;
      handle.append(s);
    });
    if (!finePointer) return;
    const chars = $$(".ch", handle);
    const link = $("#insta-link");
    link.addEventListener("pointermove", (e) => {
      if (reduce) return;
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = (e.clientX - (r.left + r.width / 2)) / 90;
        const k = Math.exp(-d * d);
        c.style.transform = `translateY(${-k * 18}px)`;
        c.style.color = k > 0.35 ? "var(--gold-ink)" : "";
      });
    });
    link.addEventListener("pointerleave", () => chars.forEach((c) => { c.style.transform = ""; c.style.color = ""; }));
  }

  /* ---------------- Reveal ---------------- */
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    $$(".tool, .steps li, .about-copy, .insta-link").forEach((el, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add("will-reveal");
      el.style.setProperty("--d", `${(i % 3) * 90}ms`);
      io.observe(el);
    });
  }

  /* ---------------- Boot ---------------- */
  const boot = () => {
    readPalette();
    try { initDunes(); } catch (err) { console.warn("Dunes unavailable", err); }
    renderTools();
    initLab();
    initInsta();
    initReveal();
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(boot, boot);
})();
