(() => {
  "use strict";

  /* =========================================================
     Shop settings. Edit these to match your business.
     ========================================================= */
  const CONFIG = {
    orderEmail: "orders@example.com", // Replace with the inbox that should receive orders.
    currency: "USD",
    locale: "en-US",
    baseFee: 6,          // per custom piece, covers setup and slicing
    machineRate: 1.6,    // per hour of printer time
    maxSize: 240,        // longest side the printer can make, in mm
    speeds: { "0.28": 18, "0.2": 12, "0.12": 7 }, // grams per hour for each finish
    materials: {
      PLA:   { density: 1.24, perGram: 0.05, note: "Rigid with crisp detail. The best all-rounder." },
      PETG:  { density: 1.27, perGram: 0.06, note: "Tougher and heat resistant. Good outdoors and around water." },
      TPU:   { density: 1.21, perGram: 0.09, note: "Flexible and grippy. Bends without breaking." },
      Resin: { density: 1.12, perGram: 0.14, note: "Finest detail at 0.05 mm layers. Best for small, intricate pieces." },
    },
  };

  const COLORS = [
    { id: "bone", name: "Bone", hex: "#e7e3da" },
    { id: "graphite", name: "Graphite", hex: "#3a3d43" },
    { id: "orange", name: "Signal orange", hex: "#ff7a17" },
    { id: "cobalt", name: "Cobalt", hex: "#3d5afe" },
    { id: "forest", name: "Forest", hex: "#2f7a55" },
    { id: "rose", name: "Rose", hex: "#e48aa2" },
    { id: "silver", name: "Silk silver", hex: "#b8bec8" },
  ];
  const SIZES = [
    { id: "S", label: "Small", scale: 0.75, price: 0.7 },
    { id: "M", label: "Medium", scale: 1, price: 1 },
    { id: "L", label: "Large", scale: 1.3, price: 1.5 },
  ];

  // Sample catalog: replace names, prices and descriptions with your own.
  const PRODUCTS = [
    { id: "twist-vase", name: "Twist Vase", cat: "Home", material: "PETG", mm: 180, axis: "tall", price: 24, color: "bone",
      desc: "A spiral vase with soft ribs that catch the light. Printed watertight, so it holds fresh flowers.",
      build: (m) => new THREE.Mesh(shellGeometry({ h: 1.8, w: 1.2, profile: PROFILES.vase, twist: Math.PI / 2, ribs: 8 }), m) },
    { id: "hex-planter", name: "Hex Planter", cat: "Home", material: "PETG", mm: 120, axis: "tall", price: 19, color: "forest", flat: true,
      desc: "A twisted hexagonal pot for succulents and small herbs.",
      build: (m) => new THREE.Mesh(shellGeometry({ h: 1.2, w: 1.3, profile: PROFILES.planter, sides: 6, twist: Math.PI / 5 }), m) },
    { id: "lamp-shade", name: "Ribbed Lamp Shade", cat: "Home", material: "PLA", mm: 200, axis: "tall", price: 36, color: "bone",
      desc: "A ribbed shade that throws soft stripes of light. Use with LED bulbs only.",
      build: (m) => new THREE.Mesh(shellGeometry({ h: 2.0, w: 1.8, profile: PROFILES.shade, ribs: 18, ribDepth: 0.05, cap: false }), m) },
    { id: "infinity-knot", name: "Infinity Knot", cat: "Home", material: "Silk PLA", mm: 140, axis: "wide", price: 28, color: "silver",
      desc: "A trefoil knot sculpture in silk filament with a soft metallic sheen.",
      build: (m) => new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.16, 220, 22, 2, 3), m) },
    { id: "phone-stand", name: "Angle Phone Stand", cat: "Desk", material: "PLA", mm: 90, axis: "tall", price: 14, color: "graphite",
      desc: "Holds a phone at a comfortable angle for calls, recipes and video.",
      build: (m) => phoneStand(m) },
    { id: "low-poly-planet", name: "Low-Poly Planet", cat: "Desk", material: "PLA", mm: 100, axis: "wide", price: 18, color: "rose", flat: true,
      desc: "A faceted planet with a tilted ring. A small desk piece that looks good from every side.",
      build: (m) => planet(m) },
    { id: "flexi-snake", name: "Flexi Snake", cat: "Toys", material: "PLA", mm: 300, axis: "long", price: 15, color: "orange", flat: true,
      desc: "Printed in one piece with moving joints, so it wiggles straight off the printer.",
      build: (m) => snake(m) },
    { id: "fidget-gear", name: "Planetary Fidget Gear", cat: "Toys", material: "PLA", mm: 70, axis: "wide", price: 12, color: "cobalt",
      desc: "Planetary gears that turn together. Satisfying to spin and quiet enough for meetings.",
      build: (m) => fidgetGear(m) },
  ];
  const HERO_SEQUENCE = ["twist-vase", "infinity-knot", "hex-planter", "lamp-shade"];

  /* =========================================================
     Helpers
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = reduceQuery.matches;
  reduceQuery.addEventListener("change", () => { reduce = reduceQuery.matches; });

  const money = new Intl.NumberFormat(CONFIG.locale, { style: "currency", currency: CONFIG.currency, maximumFractionDigits: 0 });
  const fmtMoney = (n) => money.format(n);
  const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
  const sizeById = (id) => SIZES.find((s) => s.id === id) || SIZES[1];
  const productById = (id) => PRODUCTS.find((p) => p.id === id);
  const priceFor = (p, sizeId) => Math.round(p.price * sizeById(sizeId).price);
  const fmtHours = (h) => {
    const mins = Math.max(10, Math.round(h * 60));
    const hh = Math.floor(mins / 60), mm = mins % 60;
    return hh ? `${hh} h ${String(mm).padStart(2, "0")} m` : `${mm} m`;
  };

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };

  let toastTimer = 0;
  function toast(message, action) {
    const el = $("#toast");
    el.textContent = "";
    el.append(message);
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = action.label;
      btn.addEventListener("click", () => { el.hidden = true; action.run(); });
      el.append(btn);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  const webglOK = (() => {
    if (!window.THREE) return false;
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch { return false; }
  })();

  /* =========================================================
     3D: materials, geometry, viewers
     ========================================================= */
  const T = window.THREE;
  const lin = (hex) => new T.Color(hex).convertSRGBToLinear();

  // Standard material plus printed layer lines, a cut height and a hot band at the cut.
  function printMaterial(hex, { flat = false, layer = 0.016 } = {}) {
    const m = new T.MeshStandardMaterial({
      color: lin(hex), roughness: 0.58, metalness: 0.04, side: T.DoubleSide, flatShading: flat,
    });
    m.userData.u = {
      uLayer: { value: layer },
      uCut: { value: 1000 },
      uGlow: { value: lin("#ff7a17") },
    };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, m.userData.u);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vWorldY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vWorldY;\nuniform float uLayer;\nuniform float uCut;\nuniform vec3 uGlow;")
        .replace("#include <color_fragment>", [
          "#include <color_fragment>",
          "if (vWorldY > uCut) discard;",
          "float lf = fract(vWorldY / uLayer);",
          "diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(0.0, 0.35, lf) * smoothstep(1.0, 0.65, lf);",
        ].join("\n"))
        .replace("#include <emissivemap_fragment>", [
          "#include <emissivemap_fragment>",
          "float heat = 1.0 - smoothstep(0.0, uLayer * 2.5, uCut - vWorldY);",
          "totalEmissiveRadiance += uGlow * heat * 1.8;",
        ].join("\n"));
    };
    return m;
  }

  const PROFILES = {
    vase: (t) => 0.6 + 0.4 * Math.sin(Math.PI * (0.1 + 0.85 * t)),
    planter: (t) => 0.8 + 0.2 * t,
    shade: (t) => 0.78 + 0.22 * Math.sin(Math.PI * t),
  };

  // A thin-walled surface of revolution with twist and ribs (vases, planters, shades).
  function shellGeometry({ h, w, profile, sides = 96, twist = 0, ribs = 0, ribDepth = 0.06, cap = true, rings = 90 }) {
    const pos = [], idx = [];
    const cols = sides + 1;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = t * h;
      const R = (w / 2) * profile(t);
      const rot = twist * t;
      for (let k = 0; k <= sides; k++) {
        const th = (k / sides) * Math.PI * 2;
        const rr = R * (1 + (ribs ? ribDepth * Math.cos(ribs * th) : 0));
        const a = th + rot;
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < sides; k++) {
        const a = i * cols + k, b = a + cols;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    if (cap) {
      const c = pos.length / 3;
      pos.push(0, 0, 0);
      for (let k = 0; k < sides; k++) idx.push(c, k + 1, k);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function gearShape(teeth, rOut, rRoot, hole) {
    const s = new T.Shape();
    const n = teeth * 4;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 4 === 1 || i % 4 === 2 ? rOut : rRoot;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    if (hole) { const p = new T.Path(); p.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(p); }
    return s;
  }
  const extrudeUp = (shape, depth) => {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1, curveSegments: 28 });
    g.rotateX(-Math.PI / 2);
    return g;
  };

  function fidgetGear(m) {
    const g = new T.Group();
    const ring = new T.Shape();
    ring.absarc(0, 0, 0.86, 0, Math.PI * 2, false);
    const inner = new T.Path();
    inner.absarc(0, 0, 0.74, 0, Math.PI * 2, true);
    ring.holes.push(inner);
    g.add(new T.Mesh(extrudeUp(ring, 0.2), m));
    g.add(new T.Mesh(extrudeUp(gearShape(12, 0.27, 0.22, 0.07), 0.2), m));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const planetGear = new T.Mesh(extrudeUp(gearShape(10, 0.21, 0.17, 0.05), 0.2), m);
      planetGear.position.set(Math.cos(a) * 0.495, 0, Math.sin(a) * 0.495);
      planetGear.rotation.y = a * 1.7;
      g.add(planetGear);
    }
    return g;
  }

  function phoneStand(m) {
    const s = new T.Shape();
    [[-0.6, 0], [0.6, 0], [0.6, 0.22], [0.5, 0.22], [0.5, 0.08], [0.0, 0.08], [-0.38, 0.98], [-0.5, 0.94], [-0.14, 0.08], [-0.6, 0.08]]
      .forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const g = new T.ExtrudeGeometry(s, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
    g.translate(0, 0, -0.375);
    return new T.Mesh(g, m);
  }

  function planet(m) {
    const g = new T.Group();
    g.add(new T.Mesh(new T.IcosahedronGeometry(0.6, 1), m));
    const ringGeo = new T.TorusGeometry(0.92, 0.035, 6, 72);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new T.Mesh(ringGeo, m);
    ringMesh.rotation.z = 0.38;
    g.add(ringMesh);
    return g;
  }

  function snake(m) {
    const g = new T.Group();
    const N = 22;
    const freq = Math.PI * 2.2;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = (t - 0.5) * 3;
      const z = Math.sin(t * freq) * 0.35;
      const ang = Math.atan2(Math.cos(t * freq) * 0.35 * freq, 3);
      let geo, y;
      if (i === N - 1) {
        geo = new T.BoxGeometry(0.3, 0.15, 0.24);
        y = 0.075;
      } else {
        const r = 0.05 + 0.09 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
        geo = new T.CylinderGeometry(r, r, 0.11, 6);
        geo.rotateZ(Math.PI / 2);
        y = r;
      }
      const seg = new T.Mesh(geo, m);
      seg.position.set(x, y, z);
      seg.rotation.y = -ang;
      g.add(seg);
    }
    return g;
  }

  // Scale an object so its longest side equals `size`, centred on the plate.
  function normalize(obj, size) {
    const pivot = new T.Group();
    pivot.add(obj);
    pivot.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj);
    const dim = box.getSize(new T.Vector3());
    obj.scale.multiplyScalar(size / Math.max(dim.x, dim.y, dim.z));
    pivot.updateMatrixWorld(true);
    box.setFromObject(obj);
    const c = box.getCenter(new T.Vector3());
    obj.position.x -= c.x;
    obj.position.z -= c.z;
    obj.position.y -= box.min.y;
    pivot.updateMatrixWorld(true);
    return pivot;
  }

  function buildProduct(p, colorId, scale = 1, layer = 0.016) {
    const mat = printMaterial(colorById(colorId).hex, { flat: !!p.flat, layer });
    const obj = normalize(p.build(mat), 1.6 * scale);
    return { obj, mat };
  }

  function addLights(scene) {
    scene.add(new T.HemisphereLight(0xdfe6ff, 0x0b0b0c, 0.6));
    const key = new T.DirectionalLight(0xfff1e2, 2.1);
    key.position.set(3, 5, 3.5);
    scene.add(key);
    const rim = new T.DirectionalLight(0x9fb7ff, 1.2);
    rim.position.set(-4, 2.5, -3);
    scene.add(rim);
    const low = new T.DirectionalLight(0xff8a3d, 0.45);
    low.position.set(0, -2, 4);
    scene.add(low);
  }

  function makePlate(radius = 1.25) {
    const g = new T.Group();
    const base = new T.Mesh(
      new T.CylinderGeometry(radius, radius, 0.05, 96),
      new T.MeshStandardMaterial({ color: lin("#17191d"), roughness: 0.85, metalness: 0.15 })
    );
    base.position.y = -0.026;
    g.add(base);
    const grid = new T.PolarGridHelper(radius * 0.96, 12, 5, 96, 0x2f3238, 0x2a2d32);
    grid.position.y = 0.002;
    g.add(grid);
    const rim = new T.Mesh(
      new T.TorusGeometry(radius, 0.006, 6, 160),
      new T.MeshBasicMaterial({ color: lin("#ff7a17"), transparent: true, opacity: 0.55 })
    );
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    return g;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose());
    });
  }

  // Turntable viewer: one renderer per canvas, drag to spin, renders only while visible.
  class Viewer {
    constructor(canvas, { plateRadius = 1.25, auto = 0.3, radius = null, dir = [1, 0.62, 1.3], onFrame = null } = {}) {
      this.canvas = canvas;
      this.auto = auto;
      this.fixedRadius = radius;
      this.dir = new T.Vector3(...dir).normalize();
      this.onFrame = onFrame;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(30, 1, 0.01, 100);
      addLights(this.scene);
      this.turntable = new T.Group();
      this.scene.add(this.turntable);
      if (plateRadius) { this.plate = makePlate(plateRadius); this.turntable.add(this.plate); }
      this.holder = new T.Group();
      this.turntable.add(this.holder);
      this.angle = 0.55; this.vel = 0; this.dragging = false;
      this.visible = false; this.running = false; this.last = 0;

      let lastX = 0;
      canvas.addEventListener("pointerdown", (e) => {
        this.dragging = true; lastX = e.clientX; this.vel = 0;
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add("is-dragging");
        this.start();
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        this.angle += dx * 0.01;
        this.vel = dx * 0.01;
        if (reduce) this.render();
      });
      const end = () => { this.dragging = false; canvas.classList.remove("is-dragging"); };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);

      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.start(); }).observe(canvas);
      document.addEventListener("visibilitychange", () => this.start());
    }
    resize() {
      const { clientWidth: w, clientHeight: h } = this.canvas;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.frame();
      this.render();
    }
    setObject(obj) {
      this.holder.children.slice().forEach((c) => { this.holder.remove(c); disposeTree(c); });
      this.holder.position.set(0, 0, 0);
      this.holder.add(obj);
      this.frame();
      this.render();
    }
    frame() {
      let radius = this.fixedRadius, centerY;
      const box = new T.Box3().setFromObject(this.holder);
      if (box.isEmpty()) { radius = radius || 1; centerY = 0.5; }
      else {
        const sphere = box.getBoundingSphere(new T.Sphere());
        radius = radius || sphere.radius;
        centerY = this.fixedRadius ? radius * 0.62 : sphere.center.y;
      }
      const vFov = T.MathUtils.degToRad(this.camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
      const dist = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.06;
      const target = new T.Vector3(0, centerY, 0);
      this.camera.position.copy(this.dir).multiplyScalar(dist).add(target);
      this.camera.lookAt(target);
      this.camera.updateProjectionMatrix();
    }
    start() {
      if (this.running || !this.visible || document.hidden) return;
      if (reduce && !this.dragging) { this.render(); return; }
      this.running = true;
      this.last = performance.now();
      const tick = (now) => {
        if (!this.visible || document.hidden || (reduce && !this.dragging)) { this.running = false; this.render(); return; }
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        if (!this.dragging) {
          this.vel *= 0.93;
          this.angle += this.vel + this.auto * dt;
        }
        if (this.onFrame) this.onFrame(dt);
        this.render();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    render() {
      this.turntable.rotation.y = this.angle;
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Offscreen renderer for product thumbnails, cached per product and colour.
  const thumbs = new Map();
  let thumbStage = null;
  function thumbnail(p, colorId) {
    const key = `${p.id}|${colorId}`;
    if (thumbs.has(key)) return thumbs.get(key);
    if (!webglOK) return "";
    if (!thumbStage) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 560;
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(560, 560, false);
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor(0x000000, 0);
      const scene = new T.Scene();
      addLights(scene);
      const plate = makePlate(1.2);
      scene.add(plate);
      const camera = new T.PerspectiveCamera(30, 1, 0.01, 100);
      thumbStage = { renderer, scene, camera, plate };
    }
    const { renderer, scene, camera } = thumbStage;
    const { obj } = buildProduct(p, colorId);
    obj.rotation.y = 0.6;
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const sphere = new T.Box3().setFromObject(obj).getBoundingSphere(new T.Sphere());
    const r = Math.max(sphere.radius, 0.75);
    const dist = (r / Math.sin(T.MathUtils.degToRad(15))) * 1.02;
    const target = new T.Vector3(0, sphere.center.y * 0.92, 0);
    camera.position.copy(new T.Vector3(1, 0.72, 1.25).normalize().multiplyScalar(dist).add(target));
    camera.lookAt(target);
    renderer.render(scene, camera);
    let url = renderer.domElement.toDataURL("image/webp", 0.9);
    if (!url.startsWith("data:image/webp")) url = renderer.domElement.toDataURL("image/png");
    scene.remove(obj);
    disposeTree(obj);
    thumbs.set(key, url);
    return url;
  }

  /* =========================================================
     Hero: a print bed that prints the catalog on loop
     ========================================================= */
  function initHero() {
    const canvas = $("#hero-canvas");
    const jobEl = $("#hero-job"), layerEl = $("#hero-layer"), barEl = $("#hero-progress");
    if (!canvas || !webglOK) {
      canvas?.closest(".hero-stage")?.setAttribute("hidden", "");
      return;
    }

    let seq = 0, job = null, phase = "print", tPhase = 0;
    const PRINT_TIME = 9, HOLD_TIME = 2.2, EJECT_TIME = 0.9;

    // Hotend and gantry, fixed in world space above the turntable.
    const head = new T.Group();
    const metal = new T.MeshStandardMaterial({ color: lin("#2a2c31"), roughness: 0.4, metalness: 0.7 });
    const block = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.16), metal);
    block.position.y = 0.16;
    const nozzle = new T.Mesh(new T.ConeGeometry(0.04, 0.09, 20), new T.MeshStandardMaterial({ color: lin("#c99a4a"), roughness: 0.35, metalness: 0.9 }));
    nozzle.rotation.x = Math.PI;
    nozzle.position.y = 0.065;
    const tip = new T.Mesh(new T.SphereGeometry(0.014, 12, 12), new T.MeshBasicMaterial({ color: lin("#ffb066") }));
    tip.position.y = 0.018;
    const glow = new T.PointLight(0xff7a17, 1.4, 0.7, 2);
    glow.position.y = 0.02;
    head.add(block, nozzle, tip, glow);
    const rail = new T.Mesh(new T.BoxGeometry(2.9, 0.03, 0.03), metal);
    rail.position.y = 0.24;

    const viewer = new Viewer(canvas, { auto: 0.12, radius: 1.2, dir: [1, 0.55, 1.35], onFrame: step });
    const railHolder = new T.Group();
    railHolder.add(rail);
    viewer.scene.add(head, railHolder);

    let headAngle = 0;
    function load() {
      const p = productById(HERO_SEQUENCE[seq % HERO_SEQUENCE.length]);
      const built = buildProduct(p, p.color, 1, 0.02);
      viewer.setObject(built.obj);
      // Radial extent per height band, so the nozzle hugs the outer wall.
      const bins = new Array(48).fill(0);
      const H = new T.Box3().setFromObject(built.obj).max.y;
      const v = new T.Vector3();
      built.obj.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          const b = Math.min(47, Math.max(0, Math.floor((v.y / H) * 48)));
          bins[b] = Math.max(bins[b], Math.hypot(v.x, v.z));
        }
      });
      for (let i = 1; i < 48; i++) if (!bins[i]) bins[i] = bins[i - 1];
      job = { p, mat: built.mat, H, bins, layers: Math.round(p.mm / 0.2) };
      jobEl.textContent = p.name;
      phase = "print"; tPhase = 0;
      if (reduce) { setCut(1); head.visible = false; railHolder.visible = false; }
    }
    function setCut(k) {
      const y = job.H * k;
      job.mat.userData.u.uCut.value = k >= 1 ? 1000 : y;
      const layer = Math.min(job.layers, Math.round(k * job.layers));
      layerEl.textContent = k >= 1 ? `Done, ${job.layers} layers` : `Layer ${layer} of ${job.layers}`;
      barEl.style.width = `${Math.round(k * 100)}%`;
      const b = Math.min(47, Math.floor(k * 47));
      const r = job.bins[b] + 0.02;
      head.position.set(Math.cos(headAngle) * r, y + 0.005, Math.sin(headAngle) * r);
      railHolder.position.set(0, y + 0.005, head.position.z);
    }
    function step(dt) {
      if (!job) return;
      tPhase += dt;
      headAngle += dt * (phase === "print" ? 9 : 2);
      if (phase === "print") {
        const k = Math.min(1, tPhase / PRINT_TIME);
        setCut(k);
        if (k >= 1) { phase = "hold"; tPhase = 0; }
      } else if (phase === "hold") {
        const y = job.H + 0.15 + Math.min(1, tPhase / 0.6) * 0.25;
        head.position.y = y;
        railHolder.position.y = y;
        if (tPhase > HOLD_TIME) { phase = "eject"; tPhase = 0; }
      } else if (phase === "eject") {
        const k = Math.min(1, tPhase / EJECT_TIME);
        viewer.holder.position.x = k * k * 3;
        if (k >= 1) { seq++; load(); }
      }
    }
    load();
    if (reduce) setCut(1);
  }

  /* =========================================================
     Shop grid
     ========================================================= */
  function swatchGroup(container, name, selectedId, onChange) {
    container.textContent = "";
    COLORS.forEach((c) => {
      const label = document.createElement("label");
      label.className = "swatch";
      label.title = c.name;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = c.id;
      input.checked = c.id === selectedId;
      input.setAttribute("aria-label", c.name);
      const dot = document.createElement("span");
      dot.style.setProperty("--c", c.hex);
      label.append(input, dot);
      input.addEventListener("change", () => onChange(c.id));
      container.append(label);
    });
  }

  function renderProducts() {
    const grid = $("#product-grid");
    grid.textContent = "";
    PRODUCTS.forEach((p) => {
      const li = document.createElement("li");
      li.className = "product";
      li.dataset.cat = p.cat;
      li.innerHTML = `
        <button class="product-media" type="button"></button>
        <div class="product-body">
          <h3 class="product-name"></h3>
          <p class="product-price"></p>
          <p class="product-meta"></p>
          <button class="icon-btn product-add" type="button"><i class="ph ph-plus" aria-hidden="true"></i></button>
        </div>`;
      const media = $(".product-media", li);
      media.setAttribute("aria-label", `View ${p.name} in 3D`);
      const src = thumbnail(p, p.color);
      if (src) {
        const img = new Image(560, 560);
        img.src = src;
        img.alt = `${p.name} in ${colorById(p.color).name} ${p.material}`;
        img.decoding = "async";
        media.append(img);
      }
      $(".product-name", li).textContent = p.name;
      $(".product-price", li).textContent = fmtMoney(p.price);
      $(".product-meta", li).textContent = `${p.material} · ${p.mm} mm ${p.axis}`;
      const add = $(".product-add", li);
      add.setAttribute("aria-label", `Add ${p.name} to cart`);
      add.addEventListener("click", () => addToCart(p.id, "M", p.color, 1));
      media.addEventListener("click", () => openQuickView(p.id));
      grid.append(li);
    });

    $$(".filters .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const f = chip.dataset.filter;
        $$(".filters .chip").forEach((c) => {
          const on = c === chip;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-pressed", String(on));
        });
        $$(".product", grid).forEach((li) => li.classList.toggle("is-hidden", f !== "all" && li.dataset.cat !== f));
      });
    });
  }

  /* =========================================================
     Quick view
     ========================================================= */
  const qv = { id: null, color: null, size: "M", qty: 1, viewer: null, mat: null };
  function openQuickView(id) {
    const p = productById(id);
    const dlg = $("#quickview");
    qv.id = id; qv.color = p.color; qv.size = "M"; qv.qty = 1;
    $("#qv-cat").textContent = p.cat;
    $("#qv-name").textContent = p.name;
    $("#qv-desc").textContent = p.desc;
    swatchGroup($("#qv-swatches"), "qv-color", qv.color, (c) => { qv.color = c; updateQuickView(true); });
    const sizes = $("#qv-sizes");
    sizes.textContent = "";
    SIZES.forEach((s) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio"; input.name = "qv-size"; input.value = s.id; input.checked = s.id === qv.size;
      const span = document.createElement("span");
      span.textContent = `${s.label} ${Math.round(p.mm * s.scale)} mm`;
      label.append(input, span);
      input.addEventListener("change", () => { qv.size = s.id; updateQuickView(false, true); });
      sizes.append(label);
    });
    dlg.showModal();
    if (webglOK && !qv.viewer) {
      qv.viewer = new Viewer($("#qv-canvas"), { auto: 0.35, radius: 1.6 * 1.3 * 0.6 });
    }
    if (!webglOK) $(".qv-stage").hidden = true;
    updateQuickView(true, true);
  }
  function updateQuickView(rebuild, resize) {
    const p = productById(qv.id);
    const size = sizeById(qv.size);
    $("#qv-price").textContent = fmtMoney(priceFor(p, qv.size));
    $("#qv-color-name").textContent = colorById(qv.color).name;
    $("#qv-qty").textContent = qv.qty;
    const specs = $("#qv-specs");
    specs.textContent = "";
    [["Material", p.material], ["Size", `${Math.round(p.mm * size.scale)} mm ${p.axis}`], ["Layers", "0.20 mm"]].forEach(([k, v]) => {
      const d = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      d.append(dt, dd);
      specs.append(d);
    });
    if (!qv.viewer) return;
    if (rebuild || resize) {
      const built = buildProduct(p, qv.color, size.scale);
      qv.viewer.setObject(built.obj);
      qv.viewer.resize();
    }
  }
  $("#qv-minus").addEventListener("click", () => { qv.qty = Math.max(1, qv.qty - 1); $("#qv-qty").textContent = qv.qty; });
  $("#qv-plus").addEventListener("click", () => { qv.qty = Math.min(99, qv.qty + 1); $("#qv-qty").textContent = qv.qty; });
  $("#qv-add").addEventListener("click", () => {
    addToCart(qv.id, qv.size, qv.color, qv.qty);
    $("#quickview").close();
  });

  /* =========================================================
     Cart
     ========================================================= */
  let cart = (store.get("drli3d-cart") || []).filter((it) => productById(it.id));
  const cartCount = () => cart.reduce((n, it) => n + it.qty, 0);
  const subtotal = () => cart.reduce((n, it) => n + priceFor(productById(it.id), it.size) * it.qty, 0);

  function saveCart() { store.set("drli3d-cart", cart); renderCart(); }

  function addToCart(id, size, color, qty) {
    const key = `${id}|${size}|${color}`;
    const found = cart.find((it) => it.key === key);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push({ key, id, size, color, qty });
    saveCart();
    const count = $("#cart-count");
    count.classList.remove("bump");
    void count.offsetWidth;
    count.classList.add("bump");
    toast(`${productById(id).name} added`, { label: "View cart", run: openCart });
  }

  function renderCart() {
    const n = cartCount();
    const count = $("#cart-count");
    count.textContent = n;
    count.classList.toggle("has-items", n > 0);
    $("#cart-open").setAttribute("aria-label", `Open cart, ${n} ${n === 1 ? "item" : "items"}`);

    const list = $("#cart-items");
    list.textContent = "";
    cart.forEach((it) => {
      const p = productById(it.id);
      const li = document.createElement("li");
      li.className = "cart-item";
      const img = new Image(72, 72);
      img.alt = "";
      img.src = thumbnail(p, it.color);
      const name = document.createElement("p");
      name.className = "cart-item-name";
      name.textContent = p.name;
      const price = document.createElement("p");
      price.className = "cart-item-price";
      price.textContent = fmtMoney(priceFor(p, it.size) * it.qty);
      const opts = document.createElement("p");
      opts.className = "cart-item-opts";
      opts.textContent = `${sizeById(it.size).label}, ${colorById(it.color).name}`;
      const controls = document.createElement("div");
      controls.className = "cart-item-controls";
      controls.innerHTML = `
        <button class="icon-btn" type="button" data-act="minus"><i class="ph ph-minus" aria-hidden="true"></i></button>
        <output></output>
        <button class="icon-btn" type="button" data-act="plus"><i class="ph ph-plus" aria-hidden="true"></i></button>
        <button class="icon-btn" type="button" data-act="remove"><i class="ph ph-trash" aria-hidden="true"></i></button>`;
      $("output", controls).textContent = it.qty;
      $('[data-act="minus"]', controls).setAttribute("aria-label", `One fewer ${p.name}`);
      $('[data-act="plus"]', controls).setAttribute("aria-label", `One more ${p.name}`);
      $('[data-act="remove"]', controls).setAttribute("aria-label", `Remove ${p.name}`);
      controls.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (!act) return;
        if (act === "minus") it.qty -= 1;
        if (act === "plus") it.qty = Math.min(99, it.qty + 1);
        if (act === "remove" || it.qty < 1) cart = cart.filter((x) => x !== it);
        saveCart();
      });
      li.append(img, name, price, opts, controls);
      list.append(li);
    });
    const empty = cart.length === 0;
    $("#cart-empty").hidden = !empty;
    $("#cart-foot").hidden = empty;
    list.hidden = empty;
    $("#cart-subtotal").textContent = fmtMoney(subtotal());
  }

  function showCartView(which) {
    $("#cart-view").hidden = which !== "cart";
    $("#checkout-form").hidden = which !== "checkout";
    $("#cart-confirm").hidden = which !== "confirm";
    $("#cart-title").textContent = which === "checkout" ? "Your details" : which === "confirm" ? "Order ready" : "Your cart";
  }
  function openCart() {
    showCartView("cart");
    renderCart();
    $("#cart").showModal();
  }
  $("#cart-open").addEventListener("click", openCart);
  $("#cart-checkout").addEventListener("click", () => {
    showCartView("checkout");
    $("#co-name").focus();
  });
  $("#checkout-back").addEventListener("click", () => showCartView("cart"));
  $("#checkout-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validate(form)) return;
    const d = Object.fromEntries(new FormData(form));
    const lines = cart.map((it) => {
      const p = productById(it.id);
      return `${it.qty} × ${p.name} (${sizeById(it.size).label}, ${colorById(it.color).name})  ${fmtMoney(priceFor(p, it.size) * it.qty)}`;
    });
    const summary = [
      "Order request for Dr Li 3D",
      "",
      `Name: ${d.name.trim()}`,
      `Email: ${d.email.trim()}`,
      `Ship to: ${d.address.trim().replace(/\s*\n\s*/g, ", ")}`,
      "",
      "Items:",
      ...lines,
      "",
      `Subtotal: ${fmtMoney(subtotal())} (shipping to be confirmed)`,
      d.notes.trim() ? `\nNotes: ${d.notes.trim()}` : "",
    ].join("\n").trim();
    $("#cart-summary").textContent = summary;
    $("#cart-mail").href = mailto(`Order request from ${d.name.trim()}`, summary);
    showCartView("confirm");
    $("#cart-confirm").focus();
  });

  /* =========================================================
     Forms, dialogs, copy
     ========================================================= */
  function validate(form) {
    let first = null;
    $$("[required]", form).forEach((input) => {
      const wrap = input.closest(".input");
      const err = wrap && $(".input-error", wrap);
      const v = input.value.trim();
      let ok = v !== "";
      if (ok && input.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (input.type === "number") { const n = Number(v); ok = Number.isInteger(n) && n >= +input.min && n <= +input.max; }
      wrap?.classList.toggle("has-error", !ok);
      if (err) {
        err.hidden = ok;
        if (!err.id) err.id = `${input.id}-error`;
        input.setAttribute("aria-describedby", err.id);
      }
      input.setAttribute("aria-invalid", String(!ok));
      if (!ok && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  }
  document.addEventListener("input", (e) => {
    const wrap = e.target.closest?.(".input.has-error");
    if (!wrap) return;
    wrap.classList.remove("has-error");
    const err = $(".input-error", wrap);
    if (err) err.hidden = true;
    e.target.setAttribute("aria-invalid", "false");
  });

  const mailto = (subject, body) =>
    `mailto:${CONFIG.orderEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  $$("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
      if (e.target.closest("[data-close]")) dlg.close();
    });
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const el = document.getElementById(btn.dataset.copy);
    try {
      await navigator.clipboard.writeText(el.textContent);
      toast("Copied to clipboard");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast("Selected. Press Ctrl+C or Cmd+C to copy.");
    }
  });

  /* =========================================================
     Custom design studio
     ========================================================= */
  function initStudio() {
    const st = {
      shape: "vase", height: 180, width: 120, twist: 90, ribs: 8, sides: 96,
      material: "PLA", color: "bone", quality: "0.2", scale: 120, infill: 20,
      stl: null, file: null, areaMM2: 0, dims: [120, 120, 180],
    };
    let viewer = null, mat = null, reprint = 0, queued = false;
    const canvas = $("#studio-canvas");

    if (webglOK) {
      viewer = new Viewer(canvas, {
        plateRadius: 1.3, auto: 0.18, radius: 1.75, dir: [1, 0.7, 1.35],
        onFrame: (dt) => {
          if (reprint > 0 && mat) {
            reprint = Math.max(0, reprint - dt);
            const H = new T.Box3().setFromObject(viewer.holder).max.y;
            mat.userData.u.uCut.value = reprint > 0 ? H * (1 - reprint / 0.8) : 1000;
          }
        },
      });
    } else {
      canvas.closest(".studio-stage").hidden = true;
    }

    const layerFor = (q) => ({ "0.28": 0.026, "0.2": 0.019, "0.12": 0.012 })[q] || 0.019;

    function rebuild(animate) {
      const layer = st.material === "Resin" ? 0.008 : layerFor(st.quality);
      const hex = colorById(st.color).hex;
      let geometry;
      if (st.shape === "upload") {
        if (!st.stl) { geometry = null; }
        else {
          const k = st.scale / st.stl.longest / 100;
          geometry = st.stl.geometry.clone();
          geometry.scale(k, k, k);
          const s = st.stl.size;
          st.dims = [s.x, s.z, s.y].map((d) => Math.round(d * k * 100));
        }
      } else {
        geometry = shellGeometry({
          h: st.height / 100, w: st.width / 100,
          profile: PROFILES[st.shape], sides: st.sides,
          twist: (st.twist * Math.PI) / 180,
          ribs: st.sides > 8 ? st.ribs : 0,
          ribDepth: st.shape === "shade" ? 0.05 : 0.06,
          cap: st.shape !== "shade",
          rings: 80,
        });
        st.areaMM2 = surfaceArea(geometry) * 10000;
        st.dims = [st.width, st.width, st.height];
      }
      if (viewer) {
        if (geometry) {
          mat = printMaterial(hex, { flat: st.shape !== "upload" && st.sides <= 8, layer });
          const mesh = new T.Mesh(geometry, mat);
          const g = new T.Group();
          g.add(mesh);
          viewer.setObject(g);
          if (animate && !reduce) { reprint = 0.8; viewer.start(); }
        } else {
          viewer.setObject(new T.Group());
          mat = null;
        }
      } else if (geometry) {
        geometry.dispose();
      }
      updateReadouts();
    }

    function schedule(animate = false) {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; rebuild(animate); });
    }

    function updateReadouts() {
      $("#studio-dims").textContent = st.shape === "upload" && !st.stl
        ? (st.file ? "Preview needs an STL file" : "Waiting for your file")
        : `${st.dims[0]} × ${st.dims[1]} × ${st.dims[2]} mm`;
      const est = estimate();
      $("#est-weight").textContent = est ? `${Math.round(est.grams)} g` : "None";
      $("#est-time").textContent = est ? fmtHours(est.hours) : "None";
      $("#est-price").textContent = est ? fmtMoney(est.price) : "Quote";
      $("#color-name").textContent = colorById(st.color).name;
      $("#material-note").textContent = CONFIG.materials[st.material].note;
    }

    function estimate() {
      const m = CONFIG.materials[st.material];
      let volume, heightMM;
      if (st.shape === "upload") {
        if (!st.stl) return null;
        const k = st.scale / st.stl.longest;
        const V = st.stl.volume * k ** 3;
        const A = st.stl.area * k ** 2;
        const shell = Math.min(V, A * 1.2);
        volume = shell + Math.max(0, V - shell) * (st.infill / 100);
        heightMM = st.stl.size.y * k;
      } else {
        volume = st.areaMM2 * 1.2; // 1.2 mm wall
        heightMM = st.height;
      }
      const grams = (volume / 1000) * m.density;
      const hours = st.material === "Resin"
        ? (heightMM / 0.05) * 9 / 3600
        : grams / CONFIG.speeds[st.quality];
      const fine = st.quality === "0.12" && st.material !== "Resin" ? 1.15 : 1;
      const price = Math.ceil(CONFIG.baseFee + grams * m.perGram + hours * CONFIG.machineRate * fine);
      return { grams, hours, price };
    }

    // Inputs
    const bindRange = (id, key, fmt, animate = false) => {
      const input = $(`#in-${id}`);
      const out = $(`#out-${id}`);
      const sync = () => {
        st[key] = Number(input.value);
        out.textContent = fmt(st[key]);
        input.style.setProperty("--fill", `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
      };
      input.addEventListener("input", () => { sync(); schedule(animate); });
      sync();
    };
    bindRange("height", "height", (v) => `${v} mm`);
    bindRange("width", "width", (v) => `${v} mm`);
    bindRange("twist", "twist", (v) => `${v}°`);
    bindRange("ribs", "ribs", (v) => (v ? String(v) : "None"));
    bindRange("scale", "scale", (v) => `${v} mm`);
    bindRange("infill", "infill", (v) => `${v}%`);

    $$('input[name="shape"]').forEach((r) => r.addEventListener("change", () => {
      st.shape = r.value;
      const upload = st.shape === "upload";
      $("#upload-zone").hidden = !upload;
      $("#upload-controls").hidden = !upload;
      $("#shape-controls").hidden = upload;
      if (!upload) {
        const presets = { vase: [180, 120, 90, 8], planter: [120, 140, 30, 0], shade: [200, 180, 0, 18] }[st.shape];
        [["height", 0], ["width", 1], ["twist", 2], ["ribs", 3]].forEach(([id, i]) => {
          const input = $(`#in-${id}`);
          input.value = presets[i];
          input.dispatchEvent(new Event("input"));
        });
      }
      schedule(true);
    }));
    $$('input[name="sides"]').forEach((r) => r.addEventListener("change", () => {
      st.sides = Number(r.value);
      $("#in-ribs").disabled = st.sides <= 8;
      schedule(true);
    }));
    $$('input[name="material"]').forEach((r) => r.addEventListener("change", () => {
      st.material = r.value;
      $$('input[name="quality"]').forEach((q) => { q.disabled = st.material === "Resin"; });
      schedule(true);
    }));
    $$('input[name="quality"]').forEach((r) => r.addEventListener("change", () => { st.quality = r.value; schedule(true); }));
    swatchGroup($("#studio-swatches"), "studio-color", st.color, (c) => {
      st.color = c;
      if (mat) mat.color.copy(lin(colorById(c).hex));
      viewer?.render();
      updateReadouts();
    });

    // File upload
    const fileInput = $("#file-input");
    const dropzone = $("#dropzone");
    const fileError = $("#file-error");
    const showFileError = (msg) => { fileError.textContent = msg; fileError.hidden = !msg; };
    async function handleFile(file) {
      showFileError("");
      if (!file) return;
      if (file.size > 60 * 1024 * 1024) { showFileError("That file is over 60 MB. Email it to us directly instead."); return; }
      st.file = file.name;
      st.stl = null;
      $("#dropzone-title").textContent = file.name;
      if (/\.stl$/i.test(file.name)) {
        try {
          const buf = await file.arrayBuffer();
          st.stl = parseSTL(buf);
          const longest = Math.min(CONFIG.maxSize, Math.max(20, Math.round(st.stl.longest / 5) * 5));
          const scaleInput = $("#in-scale");
          scaleInput.value = longest;
          scaleInput.dispatchEvent(new Event("input"));
          $("#dropzone-hint").textContent = `${st.stl.triangles.toLocaleString()} triangles. Adjust the size below.`;
        } catch (err) {
          showFileError("We could not read that STL. Check it exports as a closed mesh, or send it with your request and we will take a look.");
          $("#dropzone-hint").textContent = "Choose another file to try again.";
        }
      } else {
        $("#dropzone-hint").textContent = "We will review this file with your request. Live preview and pricing work with STL files.";
      }
      schedule(true);
    }
    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
    ["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("is-over"); }));
    dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

    // Request form
    const form = $("#custom-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const d = Object.fromEntries(new FormData(form));
      const est = estimate();
      const shapeLabel = { vase: "Vase", planter: "Planter", shade: "Lamp shade" }[st.shape];
      const sidesLabel = { 96: "Round", 8: "Octagon", 6: "Hexagon" }[st.sides];
      const design = st.shape === "upload"
        ? `Your file: ${st.file || "not attached yet"}`
        : `${shapeLabel} (${sidesLabel}, ${st.twist}° twist${st.sides > 8 && st.ribs ? `, ${st.ribs} ribs` : ""})`;
      const summary = [
        "Custom design request for Dr Li 3D",
        "",
        `Name: ${d.name.trim()}`,
        `Email: ${d.email.trim()}`,
        "",
        `Design: ${design}`,
        st.shape !== "upload" || st.stl ? `Size: ${st.dims[0]} × ${st.dims[1]} × ${st.dims[2]} mm` : "",
        `Material: ${st.material}, ${colorById(st.color).name}`,
        st.material === "Resin" ? "Finish: Resin, 0.05 mm" : `Finish: ${st.quality} mm layers`,
        st.shape === "upload" && st.stl ? `Infill: ${st.infill}%` : "",
        `Quantity: ${d.qty}`,
        d.date ? `Needed by: ${d.date}` : "",
        est ? `Estimate: ${fmtMoney(est.price)} each (${Math.round(est.grams)} g, ${fmtHours(est.hours)})` : "Estimate: to be quoted",
        d.notes.trim() ? `\nNotes: ${d.notes.trim()}` : "",
      ].filter(Boolean).join("\n");
      $("#custom-summary").textContent = summary;
      $("#custom-attach").textContent = st.file ? `Remember to attach ${st.file} to the email.` : "";
      $("#custom-mail").href = mailto(`Custom design request from ${d.name.trim()}`, summary);
      form.hidden = true;
      const confirm = $("#custom-confirm");
      confirm.hidden = false;
      confirm.focus();
    });
    $("#custom-edit").addEventListener("click", () => {
      $("#custom-confirm").hidden = true;
      form.hidden = false;
      $("#cf-name").focus();
    });

    rebuild(false);
  }

  function surfaceArea(geometry) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    let area = 0;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const i0 = index ? index.getX(i) : i, i1 = index ? index.getX(i + 1) : i + 1, i2 = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    return area;
  }

  // Binary or ASCII STL to a Y-up geometry sitting on the plate, plus its volume and area in mm.
  function parseSTL(buffer) {
    const dv = new DataView(buffer);
    let positions;
    const binary = buffer.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buffer.byteLength;
    if (binary) {
      const n = dv.getUint32(80, true);
      positions = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const off = 84 + i * 50 + 12;
        for (let j = 0; j < 9; j++) positions[i * 9 + j] = dv.getFloat32(off + j * 4, true);
      }
    } else {
      const text = new TextDecoder().decode(buffer);
      const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
      const out = [];
      let match;
      while ((match = re.exec(text))) out.push(+match[1], +match[2], +match[3]);
      positions = new Float32Array(out);
    }
    if (positions.length < 9 || positions.some((v) => !Number.isFinite(v))) throw new Error("Empty or invalid STL");
    // STL is Z-up: (x, y, z) becomes (x, z, -y)
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      positions[i + 1] = positions[i + 2];
      positions[i + 2] = -y;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const c = bb.getCenter(new T.Vector3());
    geometry.translate(-c.x, -bb.min.y, -c.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new T.Vector3());

    let volume = 0, area = 0;
    const a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3();
    for (let i = 0; i < positions.length; i += 9) {
      a.set(positions[i], positions[i + 1], positions[i + 2]);
      b.set(positions[i + 3], positions[i + 4], positions[i + 5]);
      d.set(positions[i + 6], positions[i + 7], positions[i + 8]);
      volume += a.dot(b.clone().cross(d)) / 6;
      area += b.clone().sub(a).cross(d.clone().sub(a)).length() / 2;
    }
    return {
      geometry, size,
      longest: Math.max(size.x, size.y, size.z),
      volume: Math.abs(volume), area,
      triangles: positions.length / 9,
    };
  }

  /* =========================================================
     Reveal on scroll
     ========================================================= */
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const els = $$(".product, .step, .mat, .closing h2");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add("will-reveal");
      el.style.setProperty("--d", `${(i % 4) * 70}ms`);
      io.observe(el);
    });
  }

  /* =========================================================
     Boot
     ========================================================= */
  const boot = () => {
    renderProducts();
    renderCart();
    try { initHero(); } catch (err) { console.warn("Hero 3D unavailable", err); }
    initStudio();
    initReveal();
  };
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(boot, boot);
})();
