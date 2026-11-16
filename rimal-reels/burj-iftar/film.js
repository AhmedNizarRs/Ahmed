/* Rimal Interiors reel: why Burj Khalifa's top floors break their fast later.
   Style: blocky 3D host + cube sidekick on the moon, phone-UI cards, step pills, word-pill captions.
   Page contract: DUR, FPS, seek(t), READY. Time is the only input. */
(() => {
  const TL = window.TL, A = TL.anchors, W = 1080, H = 1920, DUR = TL.meta.dur, FPS = TL.meta.fps;
  const T = THREE;

  /* ---------- helpers ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const spring = (dt, f = 2.4, z = 0.6) => {
    if (dt <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * dt));
  };
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const AR_DIG = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

  /* ---------- renderer ---------- */
  const glc = document.getElementById("gl");
  const renderer = new T.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color(0x050608);
  const camera = new T.PerspectiveCamera(40, W / H, 0.05, 3000);

  // environment for reflections: a tiny gradient sky
  const envCanvas = document.createElement("canvas"); envCanvas.width = 256; envCanvas.height = 128;
  { const g = envCanvas.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#0b1020"); gr.addColorStop(0.48, "#3a4660"); gr.addColorStop(0.52, "#c08850"); gr.addColorStop(1, "#5a5650");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
  const envTex = new T.CanvasTexture(envCanvas); envTex.mapping = T.EquirectangularReflectionMapping; envTex.encoding = T.sRGBEncoding;
  const pmrem = new T.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(envTex).texture;
  scene.environment = envMap;

  /* ---------- lights ---------- */
  const hemi = new T.HemisphereLight(0x8fa6c8, 0x2a2624, 0.45); scene.add(hemi);
  const sunLight = new T.DirectionalLight(0xffe2b8, 2.6);
  sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 16; sc.bottom = -4; sc.near = 1; sc.far = 120;
  sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight); scene.add(sunLight.target);
  const fill = new T.DirectionalLight(0x9db8ff, 0.45); scene.add(fill);
  const rim = new T.DirectionalLight(0xfff0d8, 0.9); scene.add(rim);

  /* ---------- textures ---------- */
  function noiseCanvas(w, h, paint) { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); return c; }
  function valueNoise(seedv) {
    const N = 256, P = new Float32Array(N * N); let s = seedv;
    for (let i = 0; i < N * N; i++) { s = (s * 16807) % 2147483647; P[i] = s / 2147483647; }
    const at = (x, y) => P[((y & 255) * N) + (x & 255)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    };
  }
  const vn = valueNoise(7);
  const fbm = (x, y) => { let a = 0, f = 1, amp = 0.5; for (let o = 0; o < 5; o++) { a += amp * vn(x * f, y * f); f *= 2.03; amp *= 0.5; } return a; };

  const sunTex = new T.CanvasTexture(noiseCanvas(256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 9, y / 9), k = (y * w + x) * 4;
      img.data[k] = 255; img.data[k + 1] = 120 + 110 * n; img.data[k + 2] = 20 + 60 * n * n; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  })); sunTex.encoding = T.sRGBEncoding;
  const glowTex = new T.CanvasTexture(noiseCanvas(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,200,120,0.9)"); gr.addColorStop(0.25, "rgba(255,150,60,0.35)"); gr.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }));
  const earthTex = new T.CanvasTexture(noiseCanvas(512, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 38 + 40, y / 38), cl = fbm(x / 14 + 9, y / 22 + 3), k = (y * w + x) * 4;
      const lat = Math.abs(y / h - 0.5) * 2;
      let r = 20, gg = 60, b = 140;
      if (n > 0.53) { const d = fbm(x / 10, y / 10); r = 70 + 90 * d; gg = 100 + 50 * d; b = 50 + 20 * d; if (lat < 0.35 && d > 0.55) { r = 190; gg = 160; b = 105; } }
      if (lat > 0.86) { r = gg = b = 235; }
      if (cl > 0.6) { const c = clamp((cl - 0.6) * 4); r = lerp(r, 245, c); gg = lerp(gg, 245, c); b = lerp(b, 250, c); }
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  })); earthTex.encoding = T.sRGBEncoding;
  const visorTex = new T.CanvasTexture(noiseCanvas(256, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "#7a2fd0"); gr.addColorStop(0.3, "#1fbf8a"); gr.addColorStop(0.55, "#21c2a0"); gr.addColorStop(0.8, "#3a6be0"); gr.addColorStop(1, "#8a2fd0");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(255,255,255,0.25)"); v.addColorStop(0.5, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  })); visorTex.encoding = T.sRGBEncoding;

  /* ---------- sky ---------- */
  { const n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 1500, s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = Math.abs(r * u) * 0.9 + 20; pos[i * 3 + 2] = r * s * Math.sin(th); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }))); }
  const sun = new T.Group();
  const sunBall = new T.Mesh(new T.SphereGeometry(16, 48, 32), new T.MeshBasicMaterial({ map: sunTex, toneMapped: false }));
  const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  glow.scale.set(120, 120, 1); sun.add(sunBall); sun.add(glow); scene.add(sun);
  const earth = new T.Mesh(new T.SphereGeometry(22, 64, 48), new T.MeshStandardMaterial({ map: earthTex, roughness: 0.85, metalness: 0, emissive: 0x0a1424, emissiveIntensity: 0.4 }));
  earth.position.set(150, 120, -330); earth.rotation.set(0.3, 1.2, 0.2); scene.add(earth);

  /* ---------- moon ground ---------- */
  {
    const geo = new T.PlaneGeometry(440, 440, 220, 220); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3);
    const craters = []; for (let i = 0; i < 160; i++) craters.push([rnd() * 440 - 220, rnd() * 440 - 220, 1.5 + Math.pow(rnd(), 2.5) * 22]);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d0 = Math.hypot(x, z);
      let y = (fbm(x / 18 + 50, z / 18 + 50) - 0.5) * 1.6;
      for (const [cx, cz, r] of craters) { const d = Math.hypot(x - cx, z - cz) / r; if (d < 1.4) y += d < 1 ? -0.35 * r * 0.18 * (1 - d * d) : 0.25 * r * 0.18 * (1.4 - d) * (d - 1) * 6; }
      y *= clamp((d0 - 9) / 30);            // flat stage around the cast
      p.setY(i, y);
      const c = 0.2 + 0.07 * (fbm(x / 4, z / 4) - 0.5);
      cols[i * 3] = c; cols[i * 3 + 1] = c * 0.985; cols[i * 3 + 2] = c * 0.96;
    }
    geo.setAttribute("color", new T.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    ground.receiveShadow = true; scene.add(ground);
  }

  /* ---------- materials ---------- */
  const M = (c, r = 0.65, m = 0, extra = {}) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  const mat = {
    skin: M(0xd9946a, 0.55), hair: M(0x8a5636, 0.7), brow: M(0x6b3f27, 0.7), stache: M(0x7a4a30, 0.75),
    shirt: M(0xc0261f, 0.8), jeans: M(0x1d2a4a, 0.8), shoe: M(0xf2f2f2, 0.6), sole: M(0x2b2b2b, 0.8),
    frame: M(0x24307a, 0.3, 0.3), visor: new T.MeshStandardMaterial({ map: visorTex, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.4 }),
    mouth: M(0x3a1424, 0.6), teeth: M(0xffffff, 0.4), eye: new T.MeshBasicMaterial({ color: 0xe9f6ff }),
    cube: M(0xb03a24, 0.55), cubeDark: M(0x1a0f0c, 0.5),
  };
  const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => {
    const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true;
    if (parent) parent.add(me); return me;
  };

  /* ---------- host character ---------- */
  function makeHost() {
    const root = new T.Group();
    const legL = new T.Group(), legR = new T.Group();
    box(0.3, 0.62, 0.32, mat.jeans, 0, -0.31, 0, legL); box(0.32, 0.12, 0.44, mat.shoe, 0, -0.66, 0.05, legL); box(0.33, 0.04, 0.45, mat.sole, 0, -0.73, 0.05, legL);
    box(0.3, 0.62, 0.32, mat.jeans, 0, -0.31, 0, legR); box(0.32, 0.12, 0.44, mat.shoe, 0, -0.66, 0.05, legR); box(0.33, 0.04, 0.45, mat.sole, 0, -0.73, 0.05, legR);
    legL.position.set(-0.18, 0.75, 0); legR.position.set(0.18, 0.75, 0); root.add(legL, legR);
    const torso = new T.Group(); torso.position.set(0, 0.75, 0); root.add(torso);
    box(0.78, 0.66, 0.44, mat.shirt, 0, 0.33, 0, torso);
    // ribbed collar
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; box(0.07, 0.07, 0.07, mat.shirt, Math.cos(a) * 0.2, 0.68, Math.sin(a) * 0.15, torso); }
    box(0.26, 0.12, 0.24, mat.skin, 0, 0.72, 0, torso);
    const arm = (side) => {
      const g = new T.Group(); g.position.set(side * 0.5, 0.6, 0);
      box(0.22, 0.42, 0.26, mat.shirt, 0, -0.18, 0, g); box(0.19, 0.24, 0.22, mat.skin, 0, -0.5, 0, g);
      torso.add(g); return g;
    };
    const armL = arm(-1), armR = arm(1);
    // head
    const head = new T.Group(); head.position.set(0, 0.78, 0); torso.add(head);
    box(1.0, 1.08, 0.94, mat.skin, 0, 0.56, 0, head);
    box(0.12, 0.26, 0.2, mat.skin, -0.55, 0.52, -0.02, head); box(0.12, 0.26, 0.2, mat.skin, 0.55, 0.52, -0.02, head);
    // voxel hair: layered slabs, seeded
    seed = 23;
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 26; i++) {
        const w = 0.22 + rnd() * 0.3, x = -0.52 + rnd() * 1.04, z = -0.5 + rnd() * 0.95, y = 1.12 + layer * 0.07 + rnd() * 0.04;
        const s = box(w, 0.09, 0.14 + rnd() * 0.12, mat.hair, x, y, z, head); s.rotation.y = (rnd() - 0.5) * 0.5;
      }
    }
    for (let i = 0; i < 22; i++) { const s = box(0.14 + rnd() * 0.2, 0.1, 0.1, mat.hair, -0.5 + rnd() * 1.0, 0.75 + rnd() * 0.4, -0.5 - rnd() * 0.04, head); s.rotation.z = (rnd() - 0.5) * 0.4; }
    for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) box(0.08, 0.12, 0.14 + rnd() * 0.1, mat.hair, sx * (0.51 + rnd() * 0.04), 0.82 + rnd() * 0.32, -0.42 + rnd() * 0.5, head);
    const browL = box(0.24, 0.07, 0.06, mat.brow, -0.22, 0.86, 0.48, head), browR = box(0.24, 0.07, 0.06, mat.brow, 0.22, 0.86, 0.48, head);
    // visor (wraparound strip) + frame
    const vis = new T.Mesh(new T.CylinderGeometry(0.62, 0.6, 0.26, 40, 1, true, -1.15, 2.3), mat.visor);
    vis.position.set(0, 0.64, -0.12); vis.scale.set(1, 1, 1.05); head.add(vis);
    vis.material.side = T.DoubleSide;
    const band = new T.Mesh(new T.CylinderGeometry(0.635, 0.635, 0.06, 40, 1, true, -1.25, 2.5), mat.frame);
    band.position.set(0, 0.78, -0.12); band.scale.set(1, 1, 1.05); band.material.side = T.DoubleSide; head.add(band);
    box(0.08, 0.2, 0.08, mat.frame, 0, 0.62, 0.53, head);
    for (const sx of [-1, 1]) box(0.06, 0.06, 0.5, mat.frame, sx * 0.56, 0.74, -0.18, head);
    const eyeL = box(0.12, 0.07, 0.01, mat.eye, -0.2, 0.62, 0.475, head), eyeR = box(0.12, 0.07, 0.01, mat.eye, 0.2, 0.62, 0.475, head);
    eyeL.castShadow = eyeR.castShadow = false;
    // nose, moustache (pixel blocks), mouth
    box(0.16, 0.2, 0.14, mat.skin, 0, 0.44, 0.52, head);
    [[-0.27, 0.31], [-0.19, 0.31], [-0.11, 0.31], [-0.03, 0.31], [0.05, 0.31], [0.13, 0.31], [0.21, 0.31], [-0.27, 0.25], [0.21, 0.25], [-0.31, 0.21], [0.25, 0.21]]
      .forEach(([x, y]) => box(0.09, 0.07, 0.05, mat.stache, x + 0.03, y, 0.49, head));
    const mouthG = new T.Group(); mouthG.position.set(0, 0.17, 0.475); head.add(mouthG);
    const mouth = box(0.22, 0.1, 0.03, mat.mouth, 0, -0.05, 0, mouthG); const teeth = box(0.2, 0.035, 0.035, mat.teeth, 0, -0.015, 0.002, mouthG);
    mouth.geometry.translate(0, 0.05, 0); mouth.position.y = -0.1;
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { root, torso, head, armL, armR, legL, legR, browL, browR, mouth, teeth, eyeL, eyeR };
  }

  /* ---------- cube sidekick ---------- */
  function roundedBox(w, h, d, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2); return g;
  }
  function makeCube() {
    const root = new T.Group();
    const body = new T.Group(); root.add(body); body.position.y = 0.62;
    const b = new T.Mesh(roundedBox(0.9, 0.78, 0.7, 0.08), mat.cube); b.castShadow = b.receiveShadow = true; body.add(b);
    const eye = (sx) => { const g = new T.Group(); g.position.set(sx * 0.17, 0.06, 0.36);
      const l1 = box(0.12, 0.03, 0.02, mat.cubeDark, -0.04, 0, 0, g); l1.rotation.z = 0.75; const l2 = box(0.12, 0.03, 0.02, mat.cubeDark, 0.04, 0, 0, g); l2.rotation.z = -0.75; body.add(g); return g; };
    const eL = eye(-1), eR = eye(1);
    const armL = new T.Group(), armR = new T.Group();
    box(0.1, 0.2, 0.14, mat.cube, 0, -0.08, 0, armL); box(0.1, 0.2, 0.14, mat.cube, 0, -0.08, 0, armR);
    armL.position.set(-0.5, 0.05, 0); armR.position.set(0.5, 0.05, 0); armL.rotation.z = 0.5; armR.rotation.z = -0.5; body.add(armL, armR);
    box(0.12, 0.24, 0.12, mat.cube, -0.22, 0.12, 0, root); box(0.12, 0.24, 0.12, mat.cube, 0.22, 0.12, 0, root);
    return { root, body, eL, eR, armL, armR };
  }

  /* ---------- tower (stylised Burj Khalifa) ---------- */
  const TH = 12;                       // tower height in scene units
  const uniforms = { uSunY: { value: -10 }, uRing80: { value: 0 }, uRing150: { value: 0 }, uWarm: { value: 0 } };
  const towerMat = new T.MeshStandardMaterial({ color: 0xaab8c8, roughness: 0.22, metalness: 0.85, envMapIntensity: 1.2 });
  towerMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWY; uniform float uSunY, uRing80, uRing150, uWarm;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float floors = smoothstep(0.42, 0.5, abs(fract(vWY * 7.0) - 0.5)) * 0.18;
        gl_FragColor.rgb *= 1.0 - floors;
        float lit = smoothstep(uSunY - 0.12, uSunY + 0.12, vWY);
        vec3 dusk = gl_FragColor.rgb * vec3(0.16, 0.18, 0.26);
        vec3 gold = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.3, 0.92, 0.6) + vec3(0.16, 0.07, 0.0) * (1.0 - smoothstep(uSunY, uSunY + 2.5, vWY)), uWarm);
        gl_FragColor.rgb = mix(dusk, gold, lit);
        float r80 = (1.0 - smoothstep(0.0, 0.07, abs(vWY - ${(0.47 * TH).toFixed(2)}))) * uRing80;
        float r150 = (1.0 - smoothstep(0.0, 0.07, abs(vWY - ${(0.66 * TH).toFixed(2)}))) * uRing150;
        gl_FragColor.rgb += vec3(1.0, 0.75, 0.35) * (r80 + r150) * 1.6;`);
  };
  function makeTower() {
    const g = new T.Group();
    const core = new T.Mesh(new T.CylinderGeometry(0.34, 0.42, TH * 0.82, 6), towerMat); core.position.y = TH * 0.41; g.add(core);
    const spire = new T.Mesh(new T.CylinderGeometry(0.03, 0.2, TH * 0.24, 8), towerMat); spire.position.y = TH * 0.82 + TH * 0.12 - 0.02; g.add(spire);
    // three wings, setbacks spiralling up
    const levels = 21;
    for (let w = 0; w < 3; w++) {
      const ang = (w * 2 * Math.PI) / 3 + Math.PI / 2;
      let y0 = 0;
      for (let i = 0; i < levels; i++) {
        if (i % 3 !== w && i !== levels - 1) continue;
        const y1 = TH * (0.12 + 0.68 * (i / (levels - 1)));
        const len = 1.25 * (1 - 0.78 * (y0 / (TH * 0.8)));
        const m = new T.Mesh(new T.BoxGeometry(0.46, y1 - y0, len), towerMat);
        m.position.set(Math.cos(ang) * len / 2, (y0 + y1) / 2, Math.sin(ang) * len / 2); m.rotation.y = -ang + Math.PI / 2;
        m.castShadow = m.receiveShadow = true; g.add(m); y0 = y1;
      }
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /* ---------- glass elevator cab ---------- */
  function makeCab() {
    const g = new T.Group();
    const glass = new T.Mesh(new T.BoxGeometry(1.4, 3.1, 1.4), new T.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }));
    glass.position.y = 1.55; g.add(glass);
    const fr = M(0xd8dde4, 0.3, 0.8);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(0.06, 3.1, 0.06, fr, x, 1.55, z, g);
    box(1.46, 0.08, 1.46, fr, 0, 0.0, 0, g); box(1.46, 0.08, 1.46, fr, 0, 3.1, 0, g);
    return g;
  }

  const host = makeHost(), cube = makeCube(), tower = makeTower(), cab = makeCab();
  scene.add(host.root, cube.root, tower, cab);
  const TOWER_POS = new T.Vector3(-1.6, 0, -3.2); tower.position.copy(TOWER_POS);

  /* ---------- mouth envelope ---------- */
  function mouthAt(t) {
    if (TL.env) { const i = Math.floor(t * TL.env.fps); return TL.env.v[clamp(i, 0, TL.env.v.length - 1)] || 0; }
    for (const l of TL.lines) for (const w of l.words) if (t >= w.t && t < w.end) return 0.35 + 0.55 * Math.abs(Math.sin((t - w.t) * 21));
    return 0;
  }

  /* ---------- shots ---------- */
  const SUN_HIGH = new T.Vector3(-140, 150, -320), SUN_SET = new T.Vector3(-150, -19, -350);
  const SUN_CLOSE = new T.Vector3(-62, 92, -320);          // framed behind the host in close-ups
  const SUN_R = 16;
  const EARTH_FAR = new T.Vector3(150, 120, -330), EARTH_CLOSE = new T.Vector3(56, 60, -300);
  function setSun(p) {
    earth.position.copy(p === SUN_CLOSE ? EARTH_CLOSE : EARTH_FAR);
    sun.position.copy(p);
    sunLight.position.copy(p).normalize().multiplyScalar(60); sunLight.target.position.set(0, 0, -2);
    const h = clamp(p.y / 150);
    sunLight.intensity = lerp(0, 1, clamp((p.y + SUN_R * 0.6) / 14)) * lerp(1.3, 2.6, h);
    sunLight.color.setHSL(0.08, 0.9, lerp(0.62, 0.86, h));
    hemi.intensity = lerp(0.32, 0.55, clamp(p.y / 40 + 0.4));
    // which height still sees the sun past the horizon (the ground edge ~200 units away)
    // the ground edge hides the sun's top edge below this height (ray to the plane edge, f ~ 0.6)
    uniforms.uSunY.value = Math.max(-10, -1.5 * (p.y + SUN_R));
    uniforms.uWarm.value = clamp(1 - (p.y - 5) / 60);
  }

  const shots = [
    { id: "hook", to: A["f80.from"] - 0.1 },
    { id: "tower", to: A.three - 0.05 },
    { id: "shock", to: A["why.from"] - 0.1 },
    { id: "sunset", to: A["twice.from"] - 0.1 },
    { id: "watch", to: A.lift - 0.15 },
    { id: "lift", to: A["cta.from"] - 0.1 },
    { id: "cta", to: DUR + 1 },
  ];
  const shotAt = (t) => { let from = 0; for (const s of shots) { if (t < s.to) return { ...s, from }; from = s.to; } return { ...shots[shots.length - 1], from }; };

  function pose(t, P) {
    // P: {at:[x,z], rotY, talk, brow, armR, armL, lookUp, shock, wave}
    const h = host;
    h.root.position.set(P.at[0], P.y || 0, P.at[1]); h.root.rotation.y = P.rotY || 0;
    const m = P.talk ? mouthAt(t) : 0;
    const open = clamp(m * 1.0 + (P.shock || 0) * 0.9);
    h.mouth.scale.set(1 + (P.shock || 0) * 0.15, 0.6 + open * 2.6, 1); h.teeth.visible = open > 0.12;
    h.browL.position.y = 0.86 + (P.brow || 0) * 0.08; h.browR.position.y = 0.86 + (P.brow || 0) * 0.08;
    h.browL.rotation.z = (P.browTilt || 0); h.browR.rotation.z = -(P.browTilt || 0);
    const breathe = Math.sin(t * 2.1) * 0.012;
    h.torso.position.y = 0.75 + breathe; h.torso.rotation.z = Math.sin(t * 1.3) * 0.015;
    h.head.rotation.set(-(P.lookUp || 0) + Math.sin(t * 1.7) * 0.02 + m * 0.04, (P.headY || 0) + Math.sin(t * 0.9) * 0.04, Math.sin(t * 1.1) * 0.025);
    h.armR.rotation.set(0, 0, -(P.armR || 0.08)); h.armL.rotation.set(0, 0, (P.armL || 0.08));
    const blink = (t % 3.7) < 0.12 ? 0.15 : 1; h.eyeL.scale.y = h.eyeR.scale.y = blink;
  }
  function cubePose(t, at, rotY = 0, hop = 0, show = 1) {
    cube.root.visible = show > 0.01;
    cube.root.position.set(at[0], 0, at[1]); cube.root.rotation.y = rotY;
    const bounce = Math.abs(Math.sin(t * 6)) * 0.06 * hop;
    cube.body.position.y = 0.62 + bounce + Math.sin(t * 2.3) * 0.01;
    cube.body.scale.setScalar(show);
    cube.armL.rotation.z = 0.5 + Math.sin(t * 6) * 0.4 * hop; cube.armR.rotation.z = -0.5 - Math.sin(t * 6 + 1) * 0.4 * hop;
  }
  function look(pos, target, fov) { camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(target); }
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const LV = (a, b, k) => a.clone().lerp(b, k);

  let ui = {};   // what the UI layer should draw this frame

  function stage(t) {
    const s = shotAt(t), k = prog(t, s.from, s.to);
    tower.visible = true; cab.visible = false; uniforms.uRing80.value = 0; uniforms.uRing150.value = 0;
    ui = { shot: s.id };
    fill.position.set(4, 3, 8); rim.position.set(-3, 4, -6);
    if (s.id === "hook" || s.id === "shock" || s.id === "cta") tower.visible = false;
    if (s.id === "hook") {
      setSun(SUN_CLOSE);
      pose(t, { at: [0, 0], talk: true, brow: 0.2, browTilt: 0.12 + 0.1 * Math.sin(t * 2), headY: -0.08 });
      cubePose(t, [2.6, 0.4], -0.4, 0, 0);
      look(LV(V(0, 2.12, 4.0), V(0, 2.12, 3.6), eIO(k)), V(0, 2.12, 0), 40);
      ui.cards = t;
    } else if (s.id === "tower") {
      setSun(SUN_HIGH);
      pose(t, { at: [0.9, 0.0], rotY: -0.6, talk: true, lookUp: 0.35, headY: -0.3 });
      cubePose(t, [1.9, 0.7], -0.6, 0.5, 1);
      uniforms.uRing80.value = prog(t, A.f80, A.f80 + 0.3); uniforms.uRing150.value = prog(t, A.f150, A.f150 + 0.3);
      const tilt = eIO(k);
      look(V(4.2, lerp(1.2, 2.2, tilt), 15.5), V(-0.6, lerp(3.4, 7.2, eIO(prog(t, A.f80 - 0.3, A.f150 + 0.4))), -2.5), 44);
      ui.rings = true;
    } else if (s.id === "shock") {
      setSun(SUN_CLOSE);
      const sh = spring(t - s.from, 3, 0.5);
      pose(t, { at: [0, 0], talk: true, shock: 0.7 * sh, brow: 0.9 * sh, headY: 0.05 });
      cubePose(t, [2.6, 0.4], -0.4, 0, 0);
      look(LV(V(0.3, 2.1, 3.7), V(0.25, 2.1, 3.2), eOut(k)), V(0, 2.1, 0), 40);
    } else if (s.id === "sunset") {
      const sk = eIO(prog(t, A.why, A.street + 0.4));
      setSun(LV(SUN_HIGH, SUN_SET, sk));
      pose(t, { at: [1.2, 0.6], rotY: -0.7, talk: false, lookUp: 0.25 });
      cubePose(t, [2.3, 1.2], -0.8, 0, 1);
      look(LV(V(5.5, 2.0, 17.5), V(4.6, 2.4, 16.0), eIO(k)), V(-3.6, 5.4, -3), 44);
      ui.diagram = prog(t, A.horizon - 0.1, A.horizon + 0.25);
    } else if (s.id === "watch") {
      const sk = prog(t, s.from, A.below + 0.4);
      setSun(LV(V(35, -7, -350), V(35, -19, -350), eIO(sk)));
      pose(t, { at: [0.6, 4.2], rotY: Math.PI - 0.2, talk: false, lookUp: 0.05 });
      cubePose(t, [-0.4, 4.6], Math.PI + 0.1, 0, 1);
      look(V(1.6, 1.5, 15.5), V(0, 2.4, -60), 36);
    } else if (s.id === "lift") {
      setSun(V(35, -19, -350));
      cab.visible = true;
      const ride = eIO(prog(t, s.from + 0.1, A.again - 0.15));
      const y = lerp(0, 8.4, ride);
      const cabPos = V(TOWER_POS.x + 1.55, y, TOWER_POS.z + 1.4); cab.position.copy(cabPos);
      const cheer = spring(t - A.again, 2.2, 0.55);
      pose(t, { at: [cabPos.x, cabPos.z], y: y + 0.05, rotY: Math.PI - 0.5 + 0.0, talk: false, armR: 0.08 + 2.4 * cheer, lookUp: -0.05 });
      cubePose(t, [3, 3], 0, 0, 0);
      look(V(cabPos.x + 1.8, y + 2.5, cabPos.z + 9.5), V(cabPos.x - 1.0, y + 0.2, cabPos.z - 45), 44);
      ui.counter = { k: ride, t };
    } else {
      setSun(SUN_CLOSE);
      pose(t, { at: [0, 0], talk: true, brow: 0.25, headY: 0.06 });
      const pop = spring(t - s.from - 0.4, 2.4, 0.55);
      cubePose(t, [1.25, 1.2], -0.5, 1, clamp(pop));
      look(LV(V(0.35, 2.0, 4.6), V(0.3, 2.0, 4.2), eIO(k)), V(0.3, 1.85, 0), 42);
      ui.comment = t;
    }
  }

  /* ---------- UI layer (2D) ---------- */
  const out = document.getElementById("out"), g2 = out.getContext("2d");
  const FONT = { cap: "600 82px PlexAr", pill: "600 36px PlexAr", small: "500 32px PlexAr", big: "600 120px PlexAr", mid: "600 56px PlexAr", clock: "600 170px PlexAr" };
  function rr(x, y, w, h, r) { g2.beginPath(); g2.roundRect(x, y, w, h, r); }
  function txt(s, x, y, font, color, align = "center", alpha = 1, dir = "rtl") {
    g2.save(); g2.globalAlpha = alpha; g2.font = font; g2.fillStyle = color; g2.textAlign = align; g2.textBaseline = "middle"; g2.direction = dir;
    g2.shadowColor = "rgba(0,0,0,0.55)"; g2.shadowBlur = 16; g2.fillText(s, x, y); g2.restore();
  }
  function pill(t, dimTxt, boldTxt, a) {
    if (a <= 0) return;
    g2.save(); g2.globalAlpha = a; g2.font = FONT.pill; g2.direction = "rtl";
    const s = boldTxt ? `${dimTxt} · ${boldTxt}` : dimTxt;
    const w = g2.measureText(s).width + 64, x = 540 - w / 2, y = 130;
    rr(x, y, w, 76, 38); g2.fillStyle = "rgba(28,28,30,0.82)"; g2.fill(); g2.strokeStyle = "rgba(255,255,255,0.10)"; g2.lineWidth = 2; g2.stroke();
    g2.textBaseline = "middle"; g2.textAlign = "right";
    const wb = boldTxt ? g2.measureText(boldTxt).width : 0, wd = g2.measureText(dimTxt + (boldTxt ? " · " : "")).width;
    g2.fillStyle = "rgba(255,255,255,0.62)"; g2.fillText(dimTxt + (boldTxt ? " ·" : ""), x + w - 32, y + 39);
    if (boldTxt) { g2.fillStyle = "#fff"; g2.fillText(boldTxt, x + w - 32 - wd, y + 39); }
    g2.restore();
  }
  function card(y, small, big, unit, a, icon) {
    if (a <= 0) return;
    const s = 0.92 + 0.08 * eOut(a);
    g2.save(); g2.globalAlpha = clamp(a * 1.5); g2.translate(540, y + 85); g2.scale(s, s); g2.translate(-540, -(y + 85));
    rr(150, y, 780, 170, 34); g2.fillStyle = "rgba(24,24,26,0.92)"; g2.fill(); g2.strokeStyle = "rgba(255,255,255,0.08)"; g2.lineWidth = 2; g2.stroke();
    // icon tile (right side, RTL)
    rr(790, y + 25, 120, 120, 22); g2.fillStyle = "#2c2c30"; g2.fill();
    g2.fillStyle = "#c9974a"; if (icon) icon(850, y + 85);
    g2.direction = "rtl"; g2.textAlign = "right"; g2.textBaseline = "middle";
    g2.font = FONT.small; g2.fillStyle = "rgba(255,255,255,0.6)"; g2.fillText(small, 760, y + 46);
    g2.font = FONT.big; g2.fillStyle = "#fff"; g2.fillText(big, 760, y + 112);
    const wb = g2.measureText(big).width; g2.font = FONT.mid; g2.fillText(unit, 760 - wb - 22, y + 120);
    g2.restore();
  }
  const towerIcon = (cx, cy) => { g2.beginPath(); g2.moveTo(cx, cy - 46); g2.lineTo(cx + 6, cy - 10); g2.lineTo(cx + 16, cy + 6); g2.lineTo(cx + 22, cy + 42); g2.lineTo(cx - 22, cy + 42); g2.lineTo(cx - 16, cy + 6); g2.lineTo(cx - 6, cy - 10); g2.closePath(); g2.fill(); };

  function captions(t) {
    const c = TL.captions.find((c) => t >= c.from && t < c.to);
    if (!c) return;
    g2.save(); g2.font = FONT.cap; g2.direction = "rtl"; g2.textBaseline = "middle";
    const words = c.words.map((w) => w.w), ws = words.map((w) => g2.measureText(w).width), gap = 22;
    let total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1), k = Math.min(1, 960 / total);
    if (k < 1) { g2.font = FONT.cap.replace("82px", Math.floor(82 * k) + "px"); }
    const wsk = words.map((w) => g2.measureText(w).width); total = wsk.reduce((a, b) => a + b, 0) + gap * k * (words.length - 1);
    const xs = []; let cur = 540 + total / 2;
    for (let i = 0; i < words.length; i++) { xs.push(cur - wsk[i]); cur -= wsk[i] + gap * k; }
    const y = 1330;
    let ai = 0; c.words.forEach((w, i) => { if (t >= w.t - 0.02) ai = i; });
    g2.textAlign = "left"; g2.fillStyle = "#fff"; g2.shadowColor = "rgba(0,0,0,0.8)"; g2.shadowBlur = 22;
    words.forEach((w, i) => { if (i !== ai) g2.fillText(w, xs[i], y); });
    g2.shadowBlur = 14; g2.shadowColor = "rgba(0,0,0,0.5)";
    rr(xs[ai] - 18, y - 56, wsk[ai] + 36, 112, 26); g2.fillStyle = "#fff"; g2.fill(); g2.shadowBlur = 0;
    g2.fillStyle = "#111"; g2.fillText(words[ai], xs[ai], y + 2);
    g2.restore();
  }

  function drawUI(t) {
    const s = ui.shot;
    // step pill
    const P = {
      hook: ["برج خليفة", "رمضان"], tower: ["فتوى دبي", "٢٠١١"], shock: ["فتوى دبي", "٢٠١١"],
      sunset: ["السبب", "الأفق"], watch: ["الغروب", "مرتين"], lift: ["المصعد", "دقيقة واحدة"], cta: ["علّق «أدوات»", "← وخذ الرابط"],
    }[s];
    pill(t, P[0], P[1], 1);
    if (s === "hook") {
      txt("٦:٤١", 600, 330, FONT.clock, "#fff", "center", 1, "ltr");
      txt("م", 760, 360, "600 60px PlexAr", "#fff", "center", 1);
      const c0 = A.burj - 0.2, c1 = A.burj + 0.55, c2 = A.same + 0.05;
      card(470, "الدور الأرضي", "٦:٤١", "الإفطار", prog(t, c0, c0 + 0.22), towerIcon);
      card(660, "الدور ٨٠", "٦:٤٣", "الإفطار", prog(t, c1, c1 + 0.22), towerIcon);
      card(850, "الدور ١٥٠", "٦:٤٤", "الإفطار", prog(t, c2, c2 + 0.22), towerIcon);
      txt("أوقات توضيحية", 540, 1060, "500 28px PlexAr", "rgba(255,255,255,0.55)", "center", prog(t, c2, c2 + 0.3));
    }
    if (ui.rings) {
      const tag = (name, at, yScreen, xScreen, label) => {
        const a = prog(t, at, at + 0.25); if (a <= 0) return;
        g2.save(); g2.globalAlpha = a; rr(xScreen - 10, yScreen - 50, 330, 100, 30); g2.fillStyle = "rgba(24,24,26,0.9)"; g2.fill();
        g2.strokeStyle = "#e6bd76"; g2.lineWidth = 3; g2.stroke(); g2.restore();
        txt(name, xScreen + 300, yScreen - 2, "600 40px PlexAr", "#fff", "right", a);
        txt(label, xScreen + 20, yScreen - 2, "600 40px PlexAr", "#e6bd76", "left", a);
      };
      // project ring heights to screen
      const p80 = V(TOWER_POS.x + 0.6, 0.47 * TH, TOWER_POS.z).project(camera), p150 = V(TOWER_POS.x + 0.5, 0.66 * TH, TOWER_POS.z).project(camera);
      const sx = (p) => (p.x * 0.5 + 0.5) * W, sy = (p) => (-p.y * 0.5 + 0.5) * H;
      tag("الدور ٨٠", A.two - 0.1, clamp(sy(p80), 330, 1120), clamp(sx(p80) + 40, 60, 700), "+٢ د");
      tag("الدور ١٥٠", A.three - 0.4, clamp(sy(p150), 330, 1120), clamp(sx(p150) + 40, 60, 700), "+٣ د");
      txt("المصدر: ذا ناشونال · دائرة الشؤون الإسلامية بدبي، ٢٠١١", 540, 1560, "500 28px PlexAr", "rgba(255,255,255,0.75)", "center", prog(t, A.f80, A.f80 + 0.3));
    }
    if (s === "shock") {
      txt("ليش؟!", 540, 330, "700 150px Kufi", "#fff", "center", spring(t - A.three, 3, 0.6) * 0);
    }
    if (ui.diagram > 0) diagram(t, ui.diagram);
    if (ui.counter) {
      const a = prog(t, A.lift - 0.1, A.lift + 0.2), n = Math.round(124 * ui.counter.k);
      if (a > 0) {
        g2.save(); g2.globalAlpha = a; rr(110, 300, 860, 240, 34); g2.fillStyle = "rgba(24,24,26,0.92)"; g2.fill(); g2.restore();
        txt("المصعد · من الأرض إلى الدور ١٢٤", 920, 350, FONT.small, "rgba(255,255,255,0.6)", "right", a);
        txt(AR_DIG(n), 920, 440, FONT.big, "#fff", "right", a, "ltr");
        txt("/ ١٢٤", 600, 452, FONT.mid, "rgba(255,255,255,0.6)", "right", a);
        txt("≈ ٦٠ ثانية", 160, 452, FONT.mid, "#e6bd76", "left", a);
        for (let i = 0; i < 12; i++) { g2.save(); g2.globalAlpha = a; rr(920 - (i + 1) * 66, 500, 56, 14, 7); g2.fillStyle = i < Math.round(12 * ui.counter.k) ? "#e6bd76" : "rgba(255,255,255,0.15)"; g2.fill(); g2.restore(); }
      }
    }
    if (s === "cta") commentBox(t);
    captions(t);
  }

  function diagram(t, a) {
    g2.save(); g2.globalAlpha = a; g2.translate(60, 250); g2.scale(0.62, 0.62); g2.translate(-110, -270);
    rr(110, 270, 860, 520, 34); g2.fillStyle = "rgba(20,20,24,0.92)"; g2.fill(); g2.strokeStyle = "rgba(255,255,255,0.08)"; g2.lineWidth = 2; g2.stroke();
    // earth arc
    g2.save(); rr(110, 270, 860, 520, 34); g2.clip();
    g2.beginPath(); g2.arc(540, 2200, 1560, Math.PI * 1.32, Math.PI * 1.68); g2.lineTo(1100, 900); g2.lineTo(0, 900); g2.closePath();
    g2.fillStyle = "#3b2f28"; g2.fill(); g2.strokeStyle = "#8a7766"; g2.lineWidth = 3; g2.stroke();
    // tower
    const bx = 690, by = 2200 - Math.sqrt(1560 * 1560 - 150 * 150);
    g2.fillStyle = "#c8d2de"; g2.beginPath(); g2.moveTo(bx - 14, by); g2.lineTo(bx + 14, by); g2.lineTo(bx + 3, by - 230); g2.lineTo(bx - 3, by - 230); g2.closePath(); g2.fill();
    // sun just under the ground-level horizon
    const sunX = 170, sunY = 590;
    const gr = g2.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70); gr.addColorStop(0, "#ffd27a"); gr.addColorStop(1, "rgba(255,160,60,0)");
    g2.fillStyle = gr; g2.fillRect(sunX - 80, sunY - 80, 160, 160);
    g2.fillStyle = "#ffb347"; g2.beginPath(); g2.arc(sunX, sunY, 26, 0, Math.PI * 2); g2.fill();
    const k = prog(t, A.horizon, A.horizon + 0.9), k2 = prog(t, A.horizon + 0.9, A.horizon + 1.8);
    // ray from the street: blocked
    g2.setLineDash([10, 10]); g2.lineWidth = 4;
    g2.strokeStyle = "#ff6b5a"; g2.beginPath(); g2.moveTo(bx - 20, by - 4); g2.lineTo(lerp(bx - 20, 420, k), lerp(by - 4, by - 8, k)); g2.stroke();
    // ray from the top: reaches the sun
    g2.strokeStyle = "#e6bd76"; g2.beginPath(); g2.moveTo(bx, by - 230); g2.lineTo(lerp(bx, sunX + 20, k2), lerp(by - 230, sunY - 6, k2)); g2.stroke();
    g2.setLineDash([]);
    g2.restore();
    txt("الشارع: غابت", 760, by + 40, "600 36px PlexAr", "#ff8b7a", "right", a * prog(t, A.horizon + 0.5, A.horizon + 0.8));
    txt("القمة: لسّه طالعة", 860, by - 270, "600 36px PlexAr", "#e6bd76", "right", a * prog(t, A.horizon + 1.4, A.horizon + 1.7));
    txt("رسم توضيحي، ليس بمقياس رسم", 540, 760, "500 26px PlexAr", "rgba(255,255,255,0.5)", "center", a);
    g2.restore();
  }

  function commentBox(t) {
    const a = prog(t, A["cta.from"], A["cta.from"] + 0.25);
    if (a <= 0) return;
    const y = 300;
    g2.save(); g2.globalAlpha = a;
    rr(110, y, 860, 190, 34); g2.fillStyle = "rgba(24,24,26,0.94)"; g2.fill(); g2.restore();
    txt("تعليق", 540, y + 38, FONT.small, "rgba(255,255,255,0.6)", "center", a);
    g2.save(); g2.globalAlpha = a; rr(150, y + 74, 780, 92, 46); g2.fillStyle = "#2c2c30"; g2.fill();
    g2.fillStyle = "#c9974a"; g2.beginPath(); g2.arc(880, y + 120, 32, 0, Math.PI * 2); g2.fill(); g2.restore();
    txt("ر", 880, y + 118, "700 34px PlexAr", "#1a0f0a", "center", a);
    const word = "أدوات", n = Math.round(clamp((t - A.type) / 0.5) * word.length);
    txt(word.slice(0, n) + ((t * 2) % 1 < 0.5 && n < word.length ? "|" : ""), 830, y + 120, "600 48px PlexAr", "#fff", "right", a);
    txt("نشر", 200, y + 120, "600 40px PlexAr", "#3b82f6", "left", a * (n >= word.length ? 1 : 0.4));
  }

  /* ---------- frame ---------- */
  function seek(t) {
    t = clamp(t, 0, DUR - 1e-4);
    stage(t);
    renderer.render(scene, camera);
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalAlpha = 1;
    g2.drawImage(glc, 0, 0);
    drawUI(t);
  }
  window.DUR = DUR; window.FPS = FPS; window.seek = seek;
  window.READY = (async () => {
    await Promise.all(["600 82px PlexAr", "500 32px PlexAr", "700 150px Kufi"].map((f) => document.fonts.load(f, "مربّعان")));
    await document.fonts.ready; seek(0); return true;
  })();
})();
