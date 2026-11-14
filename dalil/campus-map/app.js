/* DALIL campus map: University of Sharjah in 3D.
   Google Maps JavaScript API (vector map + WebGLOverlayView) with three.js drawing into the
   map's own WebGL context, so the overlay is hidden behind real 3D buildings. */
(function () {
  'use strict';

  var C = window.CAMPUS, G = window.CampusGeo, THREE = window.THREE;
  var frame = G.makeFrame(C.center.lat, C.center.lng);
  var boundaryLocal = C.boundary.map(function (p) { return frame.toLocal(p[1], p[0]); });

  var KEY_STORE = 'campus-map-key';
  var DATA_STORE = 'campus-map-osm-v1';
  var DATA_TTL_MS = 7 * 24 * 3600 * 1000;
  var ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  var COLOR = { accent: 0xffc700, glow: 0x8bf5b0, steel: 0x7e8da0 };
  var HOME_CAM = { center: C.center, zoom: 16.2, heading: 25, tilt: 60 };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    map: null, overlay: null, buildings: [], pois: [],
    from: null, to: null, waypoints: [], drawMode: false,
    markers: [], lastClick: null, flyToken: 0, touring: false,
    routePts: [], routeLen: 0,
  };
  var scene, camera, renderer;
  var groups = {};
  var live = { walker: null, walkerRing: null, beams: [] };

  function $(id) { return document.getElementById(id); }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  /* ---------- status and gate ---------- */

  function setStatus(msg, isErr) {
    var el = $('status');
    el.textContent = msg || '';
    el.className = isErr ? 'err' : '';
  }

  function showGate(msg) {
    $('gate').hidden = false;
    $('panel').hidden = true;
    $('toggle').hidden = true;
    $('gateErr').textContent = msg || '';
  }

  function showApp() {
    $('gate').hidden = true;
    $('panel').hidden = false;
  }

  function storedKey() {
    var q = new URLSearchParams(location.search).get('key');
    if (q) { safe(function () { localStorage.setItem(KEY_STORE, q); }); return q; }
    return safe(function () { return localStorage.getItem(KEY_STORE); }, '') || '';
  }

  /* ---------- loading Google Maps ---------- */

  function loadMaps(key) {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.importLibrary) return resolve();
      window.__campusMapsReady = resolve;
      window.gm_authFailure = function () {
        showGate('Google did not accept this key. Check that Maps JavaScript API is enabled for its project and that the key allows this address.');
      };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
        '&v=weekly&loading=async&callback=__campusMapsReady';
      s.async = true;
      s.onerror = function () { reject(new Error('Could not reach Google Maps. Check your connection.')); };
      document.head.appendChild(s);
    });
  }

  /* ---------- OpenStreetMap data ---------- */

  function overpassQuery() {
    var b = C.bbox, bb = [b.s, b.w, b.n, b.e].join(',');
    return '[out:json][timeout:30];(' +
      'way["building"](' + bb + ');' +
      'way["name"]["amenity"](' + bb + ');' +
      'node["name"]["amenity"](' + bb + ');' +
      ');out geom tags;';
  }

  function fetchWithTimeout(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms);
    opts.signal = ctl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(t); });
  }

  async function loadOsm() {
    var cached = safe(function () { return JSON.parse(localStorage.getItem(DATA_STORE)); }, null);
    if (cached && Date.now() - cached.t < DATA_TTL_MS && cached.elements) {
      return { elements: cached.elements, from: 'cache' };
    }
    var lastErr;
    for (var i = 0; i < ENDPOINTS.length; i++) {
      try {
        var res = await fetchWithTimeout(ENDPOINTS[i], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(overpassQuery()),
        }, 28000);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var json = await res.json();
        if (!json.elements) throw new Error('empty answer');
        safe(function () { localStorage.setItem(DATA_STORE, JSON.stringify({ t: Date.now(), elements: json.elements })); });
        return { elements: json.elements, from: 'live' };
      } catch (e) { lastErr = e; }
    }
    if (cached && cached.elements) return { elements: cached.elements, from: 'old cache' };
    throw lastErr || new Error('no answer');
  }

  var ARABIC = /[؀-ۿ]/;

  function processOsm(elements) {
    var buildings = [], byName = {};
    elements.forEach(function (el) {
      var tags = el.tags || {};
      var raw = tags.name || '';
      var en = tags['name:en'] || (ARABIC.test(raw) ? '' : raw);
      var ar = tags['name:ar'] || (ARABIC.test(raw) ? raw : '');
      var label = en || ar;

      if (el.type === 'node') {
        if (!label || el.lat == null) return;
        var p = frame.toLocal(el.lat, el.lon);
        if (!G.pointInPolygon(p.x, p.y, boundaryLocal)) return;
        addPoi({ id: 'n' + el.id, name: label, ar: ar, c: p, latlng: { lat: el.lat, lng: el.lon }, area: 40, ring: null, h: 0, tags: tags });
        return;
      }
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) return;
      var ring = el.geometry.map(function (g) { return frame.toLocal(g.lat, g.lon); });
      var a = ring[0], z = ring[ring.length - 1];
      if (Math.abs(a.x - z.x) < 0.01 && Math.abs(a.y - z.y) < 0.01) ring.pop();
      if (ring.length < 3) return;
      var c = G.centroid(ring);
      if (!G.pointInPolygon(c.x, c.y, boundaryLocal)) return;
      var isBuilding = !!tags.building;
      var b = {
        id: 'w' + el.id, ring: ring, c: c, latlng: frame.toLatLng(c.x, c.y),
        h: isBuilding ? G.buildingHeight(tags).m : 0.6,
        name: label, ar: ar, area: Math.abs(G.signedArea(ring)), tags: tags,
      };
      buildings.push(b);
      if (label) addPoi(b);
    });

    function addPoi(p) {
      var k = p.name.toLowerCase();
      if (!byName[k] || byName[k].area < p.area) byName[k] = p; // same name twice: keep the larger
    }
    var pois = Object.keys(byName).map(function (k) { return byName[k]; });
    pois.sort(function (x, y) { return x.name.localeCompare(y.name); });
    state.buildings = buildings;
    state.pois = pois;
  }

  /* ---------- three.js scene ---------- */

  function disposeGroup(g) {
    while (g.children.length) {
      var o = g.children.pop();
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData.shared) o.material.dispose();
    }
  }

  function mat(color, opacity, extra) {
    var m = new THREE.MeshBasicMaterial(Object.assign({
      color: color, transparent: true, opacity: opacity, depthWrite: false, side: THREE.DoubleSide,
    }, extra || {}));
    m.userData.shared = false;
    return m;
  }

  // Flat ribbon along a polyline (or closed ring) in the XY plane at height z.
  function ribbonGeometry(pts, width, z, closed) {
    var n = pts.length, pos = [], idx = [], half = width / 2;
    function dir(a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    for (var i = 0; i < n; i++) {
      var prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(i - 1, 0)];
      var next = closed ? pts[(i + 1) % n] : pts[Math.min(i + 1, n - 1)];
      var d1 = i === 0 && !closed ? dir(pts[0], pts[1]) : dir(prev, pts[i]);
      var d2 = i === n - 1 && !closed ? dir(pts[n - 2], pts[n - 1]) : dir(pts[i], next);
      var n1 = { x: -d1.y, y: d1.x }, n2 = { x: -d2.y, y: d2.x };
      var mx = n1.x + n2.x, my = n1.y + n2.y, ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      var scale = 1 / Math.max(0.45, mx * n1.x + my * n1.y); // miter, clamped at sharp corners
      pos.push(pts[i].x + mx * half * scale, pts[i].y + my * half * scale, z,
               pts[i].x - mx * half * scale, pts[i].y - my * half * scale, z);
    }
    var segs = closed ? n : n - 1;
    for (var s = 0; s < segs; s++) {
      var a = s * 2, b = ((s + 1) % n) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  function wallGeometry(pts, height) {
    var pos = [], idx = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var p = pts[i];
      pos.push(p.x, p.y, 0, p.x, p.y, height);
    }
    for (var s = 0; s < n; s++) {
      var a = s * 2, b = ((s + 1) % n) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  function buildBoundary() {
    disposeGroup(groups.boundary);
    var shape = new THREE.Shape(boundaryLocal.map(function (p) { return new THREE.Vector2(p.x, p.y); }));
    var fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(COLOR.accent, 0.06));
    fill.position.z = 0.8;
    groups.boundary.add(fill);
    groups.boundary.add(new THREE.Mesh(wallGeometry(boundaryLocal, 16), mat(COLOR.accent, 0.1)));
    groups.boundary.add(new THREE.Mesh(ribbonGeometry(boundaryLocal, 6, 1.6, true), mat(COLOR.accent, 0.95)));
  }

  function buildBuildings() {
    disposeGroup(groups.buildings);
    var fill = mat(COLOR.steel, 0.26), fillNamed = mat(COLOR.accent, 0.4);
    var line = new THREE.LineBasicMaterial({ color: 0xa9b0ba, transparent: true, opacity: 0.45 });
    var lineNamed = new THREE.LineBasicMaterial({ color: COLOR.accent, transparent: true, opacity: 0.9 });
    [fill, fillNamed, line, lineNamed].forEach(function (m) { m.userData.shared = true; });
    state.buildings.forEach(function (b) {
      try {
        var shape = new THREE.Shape(b.ring.map(function (p) { return new THREE.Vector2(p.x, p.y); }));
        var geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
        groups.buildings.add(new THREE.Mesh(geo, b.name ? fillNamed : fill));
        groups.buildings.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), b.name ? lineNamed : line));
      } catch (e) { /* skip a malformed footprint */ }
    });
  }

  function buildMarks() {
    disposeGroup(groups.marks);
    live.beams = [];
    [[state.from, COLOR.glow], [state.to, COLOR.accent]].forEach(function (pair) {
      var poi = pair[0];
      if (!poi) return;
      var beamGeo = new THREE.CylinderGeometry(1.4, 1.4, 140, 12, 1, true);
      beamGeo.rotateX(Math.PI / 2);
      beamGeo.translate(0, 0, 70);
      var beam = new THREE.Mesh(beamGeo, mat(pair[1], 0.4, { blending: THREE.AdditiveBlending }));
      beam.position.set(poi.c.x, poi.c.y, 0);
      var ring = new THREE.Mesh(new THREE.RingGeometry(10, 13, 40), mat(pair[1], 0.8));
      ring.position.set(poi.c.x, poi.c.y, 1.2);
      groups.marks.add(beam, ring);
      live.beams.push(beam, ring);
    });
  }

  function routePoints() {
    if (!state.from || !state.to) return [];
    return [state.from.c].concat(state.waypoints, [state.to.c]);
  }

  function buildRoute() {
    disposeGroup(groups.route);
    live.walker = live.walkerRing = null;
    var pts = routePoints();
    state.routePts = pts;
    state.routeLen = pts.length > 1 ? G.pathLength(pts) : 0;
    if (pts.length > 1) {
      groups.route.add(new THREE.Mesh(ribbonGeometry(pts, 13, 2.2, false), mat(COLOR.glow, 0.2)));
      groups.route.add(new THREE.Mesh(ribbonGeometry(pts, 4.5, 2.8, false), mat(COLOR.glow, 0.95)));
      state.waypoints.forEach(function (w) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), mat(COLOR.glow, 1));
        s.position.set(w.x, w.y, 4);
        groups.route.add(s);
      });
      live.walker = new THREE.Mesh(new THREE.SphereGeometry(5.5, 18, 12), mat(COLOR.glow, 1, { blending: THREE.AdditiveBlending }));
      live.walkerRing = new THREE.Mesh(new THREE.RingGeometry(7, 10, 36), mat(COLOR.glow, 0.7, { blending: THREE.AdditiveBlending }));
      groups.route.add(live.walker, live.walkerRing);
    }
    updateRouteInfo();
  }

  function updateRouteInfo() {
    var el = $('routeInfo');
    if (!state.from || !state.to) {
      el.textContent = 'Pick two places. The route is a straight line until you draw the real path: turn on Draw path, then click along the walkway.';
    } else {
      var kind = state.waypoints.length ? state.waypoints.length + ' drawn point' + (state.waypoints.length > 1 ? 's' : '') : 'straight line, not a real walkway';
      el.textContent = Math.round(state.routeLen) + ' m (' + kind + ').';
    }
  }

  function refresh() {
    if (state.overlay) state.overlay.requestRedraw();
  }

  function setupOverlay() {
    var overlay = new google.maps.WebGLOverlayView();
    overlay.onAdd = function () {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera();
      ['boundary', 'buildings', 'marks', 'route'].forEach(function (k) {
        groups[k] = new THREE.Group();
        scene.add(groups[k]);
      });
      buildBoundary();
      buildBuildings();
      buildMarks();
      buildRoute();
      applyLayers();
    };
    overlay.onContextRestored = function (opts) {
      var gl = opts.gl;
      renderer = new THREE.WebGLRenderer(Object.assign({ canvas: gl.canvas, context: gl }, gl.getContextAttributes()));
      renderer.autoClear = false; // the map has already drawn the basemap
    };
    overlay.onContextLost = function () {
      if (renderer) { renderer.dispose(); renderer = null; }
    };
    overlay.onDraw = function (opts) {
      if (!renderer) return;
      var m = opts.transformer.fromLatLngAltitude({ lat: C.center.lat, lng: C.center.lng, altitude: 0 });
      camera.projectionMatrix.fromArray(m);
      var animating = animate(performance.now() / 1000);
      renderer.render(scene, camera);
      renderer.resetState();
      if (animating) overlay.requestRedraw();
    };
    overlay.onRemove = function () {
      Object.keys(groups).forEach(function (k) { disposeGroup(groups[k]); });
    };
    overlay.setMap(state.map);
    state.overlay = overlay;
  }

  // Moves the walker and pulses the marks. Returns true while something is moving.
  function animate(t) {
    var moving = false;
    if (live.walker && state.routePts.length > 1) {
      var phase = Math.min(1, (t % 12) / 10); // 10 s along the route, 2 s pause
      var p = G.pointAt(state.routePts, phase * state.routeLen);
      live.walker.position.set(p.x, p.y, 8);
      live.walkerRing.position.set(p.x, p.y, 1.5);
      var s = 1 + 0.35 * Math.sin(t * 5);
      live.walkerRing.scale.set(s, s, 1);
      moving = true;
    }
    if (live.beams.length) {
      var o = 0.55 + 0.35 * Math.sin(t * 2.4);
      live.beams.forEach(function (b) { b.material.opacity = b.geometry.type === 'RingGeometry' ? 0.5 + 0.4 * Math.sin(t * 2.4) : o * 0.7; });
      moving = true;
    }
    return moving;
  }

  function applyLayers() {
    if (!groups.boundary) return;
    groups.boundary.visible = $('lyBoundary').checked;
    groups.buildings.visible = $('lyBuildings').checked;
    var showLabels = $('lyLabels').checked;
    state.markers.forEach(function (m) { m.map = showLabels ? state.map : null; });
    refresh();
  }

  /* ---------- places, markers, selection ---------- */

  function fillSelects() {
    ['from', 'to'].forEach(function (id) {
      var sel = $(id);
      sel.innerHTML = '';
      sel.appendChild(new Option('Choose a place…', ''));
      state.pois.forEach(function (p, i) { sel.appendChild(new Option(p.name, String(i))); });
      sel.value = '';
    });
    var ul = $('places');
    ul.innerHTML = '';
    state.pois.forEach(function (p) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      var n = document.createElement('span'); n.textContent = p.name;
      b.appendChild(n);
      if (p.ar && p.ar !== p.name) {
        var a = document.createElement('span'); a.className = 'ar'; a.lang = 'ar'; a.dir = 'rtl'; a.textContent = p.ar;
        b.appendChild(a);
      }
      b.addEventListener('click', function () { choose(p); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function choose(p) {
    if (!state.from) setFrom(p); else setTo(p);
    flyTo({ center: p.latlng, zoom: 18, heading: state.map.getHeading(), tilt: 62 }, 1400);
  }

  function setFrom(p) { state.from = p; state.waypoints = []; syncSelects(); onRouteChanged(); }
  function setTo(p) { state.to = p; state.waypoints = []; syncSelects(); onRouteChanged(); }

  function syncSelects() {
    $('from').value = state.from ? String(state.pois.indexOf(state.from)) : '';
    $('to').value = state.to ? String(state.pois.indexOf(state.to)) : '';
    state.markers.forEach(function (m) {
      m.content.classList.toggle('sel', m.poi === state.from || m.poi === state.to);
    });
  }

  function onRouteChanged() {
    if (groups.route) { buildMarks(); buildRoute(); }
    updateRouteInfo();
    refresh();
  }

  async function makeMarkers() {
    state.markers.forEach(function (m) { m.map = null; });
    state.markers = [];
    var lib = await google.maps.importLibrary('marker');
    var top = state.pois.slice().sort(function (a, b) { return b.area - a.area; }).slice(0, 40);
    top.forEach(function (p) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'poi';
      el.textContent = p.name;
      var m = new lib.AdvancedMarkerElement({
        map: $('lyLabels').checked ? state.map : null,
        position: p.latlng, content: el, title: p.name, zIndex: Math.round(p.area),
        collisionBehavior: google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
      });
      m.poi = p;
      m.addListener('click', function () { choose(p); });
      state.markers.push(m);
    });
  }

  /* ---------- camera ---------- */

  function currentCam() {
    var c = state.map.getCenter();
    return { center: { lat: c.lat(), lng: c.lng() }, zoom: state.map.getZoom(), heading: state.map.getHeading() || 0, tilt: state.map.getTilt() || 0 };
  }

  function flyTo(target, ms) {
    var token = ++state.flyToken;
    if (reduceMotion || !ms) { state.map.moveCamera(target); return Promise.resolve(); }
    return new Promise(function (resolve) {
      var s = currentCam(), t0 = performance.now();
      var dh = ((((target.heading - s.heading) % 360) + 540) % 360) - 180; // shortest turn
      function step(now) {
        if (token !== state.flyToken) return resolve();
        var k = Math.min(1, (now - t0) / ms);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        state.map.moveCamera({
          center: {
            lat: s.center.lat + (target.center.lat - s.center.lat) * e,
            lng: s.center.lng + (target.center.lng - s.center.lng) * e,
          },
          zoom: s.zoom + (target.zoom - s.zoom) * e,
          heading: s.heading + dh * e,
          tilt: s.tilt + (target.tilt - s.tilt) * e,
        });
        if (k < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function runTour() {
    var btn = $('tour');
    if (state.touring) { stopTour(); return; }
    state.touring = true;
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = 'Stop flying';
    var stops = state.pois.slice().sort(function (a, b) { return b.area - a.area; }).slice(0, 6);
    await flyTo(HOME_CAM, 1800);
    for (var i = 0; i < stops.length && state.touring; i++) {
      setStatus('Now: ' + stops[i].name);
      await flyTo({ center: stops[i].latlng, zoom: 18.2, heading: (i * 55 + 20) % 360, tilt: 65 }, 2600);
      if (state.touring) await wait(1800);
    }
    if (state.touring) await flyTo(HOME_CAM, 2200);
    stopTour();
  }

  function stopTour() {
    state.touring = false;
    state.flyToken++;
    $('tour').setAttribute('aria-pressed', 'false');
    $('tour').textContent = 'Fly the campus';
    setStatus('');
  }

  /* ---------- controls ---------- */

  function wireControls() {
    $('from').addEventListener('change', function () {
      var i = $('from').value; state.from = i === '' ? null : state.pois[+i]; state.waypoints = []; syncSelects(); onRouteChanged();
    });
    $('to').addEventListener('change', function () {
      var i = $('to').value; state.to = i === '' ? null : state.pois[+i]; state.waypoints = []; syncSelects(); onRouteChanged();
    });
    $('draw').addEventListener('click', function () {
      state.drawMode = !state.drawMode;
      $('draw').setAttribute('aria-pressed', String(state.drawMode));
      setStatus(state.drawMode ? 'Click the map along the real walkway, in order from the start to the destination.' : '');
    });
    $('undo').addEventListener('click', function () { state.waypoints.pop(); onRouteChanged(); });
    $('clear').addEventListener('click', function () {
      state.from = state.to = null; state.waypoints = [];
      state.drawMode = false; $('draw').setAttribute('aria-pressed', 'false');
      syncSelects(); onRouteChanged(); setStatus('');
    });
    $('tour').addEventListener('click', runTour);
    $('sat').addEventListener('click', function () {
      var on = $('sat').getAttribute('aria-pressed') !== 'true';
      $('sat').setAttribute('aria-pressed', String(on));
      state.map.setMapTypeId(on ? 'hybrid' : 'roadmap');
    });
    $('top').addEventListener('click', function () {
      var on = $('top').getAttribute('aria-pressed') !== 'true';
      $('top').setAttribute('aria-pressed', String(on));
      flyTo(on ? { center: state.map.getCenter().toJSON(), zoom: state.map.getZoom(), heading: 0, tilt: 0 }
               : { center: state.map.getCenter().toJSON(), zoom: state.map.getZoom(), heading: HOME_CAM.heading, tilt: HOME_CAM.tilt }, 900);
    });
    ['lyBoundary', 'lyBuildings', 'lyLabels'].forEach(function (id) { $(id).addEventListener('change', applyLayers); });
    $('copy').addEventListener('click', function () {
      if (!state.lastClick) return;
      var txt = state.lastClick.lat.toFixed(6) + ', ' + state.lastClick.lng.toFixed(6);
      var done = function () { setStatus('Copied ' + txt); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { setStatus('Copy blocked by the browser.', true); });
      else setStatus('Copy is not available in this browser.', true);
    });
    $('hide').addEventListener('click', function () { $('panel').hidden = true; $('toggle').hidden = false; });
    $('toggle').addEventListener('click', function () { $('panel').hidden = false; $('toggle').hidden = true; });
    $('credit').textContent = C.source + ' · three.js (MIT)';
  }

  function onMapClick(e) {
    var ll = e.latLng.toJSON();
    state.lastClick = ll;
    $('coords').textContent = ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6);
    if (state.drawMode) {
      if (!state.from || !state.to) { setStatus('Choose From and To first, then draw the path between them.', true); return; }
      state.waypoints.push(frame.toLocal(ll.lat, ll.lng));
      onRouteChanged();
    }
  }

  /* ---------- start ---------- */

  async function initMap() {
    var lib = await google.maps.importLibrary('maps');
    var pad = 0.004;
    state.map = new lib.Map($('map'), {
      center: HOME_CAM.center, zoom: HOME_CAM.zoom, heading: HOME_CAM.heading, tilt: HOME_CAM.tilt,
      mapId: 'DEMO_MAP_ID', renderingType: google.maps.RenderingType.VECTOR,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
      gestureHandling: 'greedy', clickableIcons: false,
      restriction: {
        latLngBounds: { south: C.bbox.s - pad, west: C.bbox.w - pad, north: C.bbox.n + pad, east: C.bbox.e + pad },
        strictBounds: false,
      },
    });
    state.map.addListener('click', onMapClick);
    state.map.addListener('dragstart', function () { if (state.touring) stopTour(); });
    setupOverlay();
  }

  async function loadCampus() {
    $('stats').textContent = 'Loading campus buildings from OpenStreetMap…';
    try {
      var r = await loadOsm();
      processOsm(r.elements);
      fillSelects();
      await makeMarkers();
      if (groups.buildings) buildBuildings();
      refresh();
      var named = state.pois.length;
      $('stats').innerHTML = '<b>' + state.buildings.length + '</b> buildings · <b>' + named + '</b> named places (' + r.from + ')';
      if (!named) setStatus('No named places found in OpenStreetMap for this area. Use Pick coordinates to add your own.');
    } catch (e) {
      $('stats').textContent = 'Could not load buildings from OpenStreetMap.';
      setStatus('Boundary and coordinate picking still work. Reload to try again.', true);
    }
  }

  async function boot(key) {
    $('gateErr').textContent = '';
    try {
      await loadMaps(key);
      showApp();
      await initMap();
      wireControls();
      await loadCampus();
    } catch (e) {
      showGate(e.message || 'Something went wrong while opening the map.');
    }
  }

  $('gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var k = $('key').value.trim();
    if (!k) { $('gateErr').textContent = 'Paste your key first.'; return; }
    safe(function () { localStorage.setItem(KEY_STORE, k); });
    boot(k);
  });

  var existing = storedKey();
  if (existing) boot(existing); else showGate('');
})();
