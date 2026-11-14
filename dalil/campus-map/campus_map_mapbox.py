#!/usr/bin/env python3
"""
University of Sharjah: 3D campus map with Mapbox GL JS.

What this script does (standard library only, Python 3.8+):
  1. Downloads the campus buildings and named places from OpenStreetMap (Overpass API),
     keeps only the ones inside the University of Sharjah main-campus outline, and caches them.
  2. Writes one self-contained web page, campus_map.html, using Mapbox GL JS v3:
       - Mapbox Standard style with indoor maps switched on (showIndoor) + the IndoorControl
         floor selector from https://www.mapbox.com/indoor-maps
       - the campus buildings as 3D blocks, the study-area outline, and named place labels
       - From / To walking routes (Mapbox Directions API), a moving dot along the route
       - a camera fly-through, light presets, top view, and a click-to-copy coordinate picker
  3. Optionally serves the page on your computer and opens it in your browser.

IMPORTANT about indoor floors: Mapbox's built-in indoor floor plans cover supported venues
such as airports. The University of Sharjah is not one of them, so the floor selector stays
empty here until Mapbox adds coverage or you supply your own indoor data (see README notes
at the bottom of this file). Nothing about floors, rooms or building heights is invented:
heights come from OpenStreetMap tags, otherwise a generic 9 m block that the page marks as
"estimated".

Usage:
    export MAPBOX_TOKEN=pk.xxxxx            # public token from https://account.mapbox.com
    python campus_map_mapbox.py             # build, serve on http://localhost:8000, open browser
    python campus_map_mapbox.py --no-serve  # only write campus_map.html
    python campus_map_mapbox.py --selftest  # run the built-in checks and exit

Options:
    --token TOKEN       Mapbox public token (default: $MAPBOX_TOKEN). If you leave it out, the
                        page asks for it in the browser and keeps it in that browser only.
    --osm-file FILE     Use a saved Overpass JSON answer instead of downloading.
    --refresh           Ignore the cache and download again.
    --offline           Never touch the network from Python (cache or --osm-file only).
    --out FILE          Output page (default: campus_map.html next to this script).
    --no-serve          Only write the page; do not start the local server.
    --port N            Port for --serve (default 8000).
    --gl-version VER    Mapbox GL JS version (default v3.35.0, the version Mapbox's own indoor
                        example uses).

Map data: (c) OpenStreetMap contributors (ODbL). Basemap: (c) Mapbox.
The token written into campus_map.html is a *public* token, but still restrict it by URL in your
Mapbox account and do not commit the generated page.
"""

import argparse
import functools
import http.server
import json
import math
import os
import socketserver
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE_FILE = HERE / ".cache" / "uos_osm.json"
CACHE_TTL_S = 7 * 24 * 3600
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# ---------------------------------------------------------------------------
# Study area: University of Sharjah main campus (University City, Sharjah).
# Outline and centre: OpenStreetMap way 376417463 (ODbL), simplified from ~130 to 37 points.
# Points are (longitude, latitude).
# ---------------------------------------------------------------------------
CAMPUS = {
    "name": "University of Sharjah",
    "name_ar": "جامعة الشارقة",
    "center": (55.4789690, 25.2878292),  # (lng, lat)
    "bbox": {"s": 25.2781087, "w": 55.4704809, "n": 25.2976964, "e": 55.4876880},
    "boundary": [
        (55.4704809, 25.2810542), (55.4726224, 25.2797786), (55.4747146, 25.2785052),
        (55.4753411, 25.2781087), (55.4760374, 25.2790628), (55.4774198, 25.2809484),
        (55.4786353, 25.2825909), (55.4800463, 25.2845219), (55.4808550, 25.2856168),
        (55.4860637, 25.2927022), (55.4876084, 25.2947964), (55.4876880, 25.2951254),
        (55.4875621, 25.2955557), (55.4857422, 25.2964664), (55.4835269, 25.2975293),
        (55.4831784, 25.2976964), (55.4826155, 25.2975789), (55.4821013, 25.2968600),
        (55.4819271, 25.2965932), (55.4810119, 25.2953792), (55.4797637, 25.2936842),
        (55.4780536, 25.2913541), (55.4778482, 25.2909268), (55.4776218, 25.2907690),
        (55.4763059, 25.2889766), (55.4759870, 25.2885537), (55.4757443, 25.2880534),
        (55.4756181, 25.2880522), (55.4753112, 25.2876284), (55.4739962, 25.2858332),
        (55.4740303, 25.2857689), (55.4739523, 25.2856081), (55.4737684, 25.2853560),
        (55.4736326, 25.2852582), (55.4735703, 25.2852528), (55.4713155, 25.2821778),
        (55.4705422, 25.2811385),
    ],
    "source": "Map data © OpenStreetMap contributors (ODbL)",
}

# ---------------------------------------------------------------------------
# Small geometry helpers (flat metres around the campus centre; fine at 2 km scale)
# ---------------------------------------------------------------------------
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LNG = 111320.0
LAT0 = CAMPUS["center"][1]
LNG0 = CAMPUS["center"][0]
_K = math.cos(math.radians(LAT0))


def to_local(lng, lat):
    return ((lng - LNG0) * M_PER_DEG_LNG * _K, (lat - LAT0) * M_PER_DEG_LAT)


def signed_area(pts):
    a = 0.0
    for i, (x1, y1) in enumerate(pts):
        x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2.0


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def point_in_polygon(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def building_height(tags):
    """Height in metres from OSM tags. Returns (metres, estimated?)."""
    raw = str(tags.get("height", "")).replace(",", ".").replace("m", "").strip()
    try:
        h = float(raw)
        if h > 0:
            return min(h, 200.0), False
    except ValueError:
        pass
    try:
        levels = float(tags.get("building:levels", ""))
        if levels > 0:
            return min(levels * 3.5, 200.0), True
    except ValueError:
        pass
    return 9.0, True  # unknown: a low generic block, flagged as estimated


# ---------------------------------------------------------------------------
# OpenStreetMap download (Overpass) with cache
# ---------------------------------------------------------------------------
def overpass_query():
    b = CAMPUS["bbox"]
    bb = "{},{},{},{}".format(b["s"], b["w"], b["n"], b["e"])
    return (
        "[out:json][timeout:60];("
        'way["building"]({bb});'
        'way["name"]["amenity"]({bb});'
        'node["name"]["amenity"]({bb});'
        ");out geom tags;"
    ).format(bb=bb)


def download_osm():
    body = ("data=" + urllib.parse.quote(overpass_query())).encode()
    last = None
    for attempt in range(2):
        for url in ENDPOINTS:
            try:
                req = urllib.request.Request(
                    url, data=body,
                    headers={"Content-Type": "application/x-www-form-urlencoded",
                             "User-Agent": "campus-map-prototype/1.0"})
                with urllib.request.urlopen(req, timeout=90) as r:
                    data = json.loads(r.read().decode("utf-8"))
                if "elements" in data:
                    return data["elements"]
                last = RuntimeError("Overpass answer had no 'elements'")
            except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
                last = e
                print("  {} failed: {}".format(url, e), file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError("Could not download OpenStreetMap data: {}".format(last))


def load_elements(args):
    if args.osm_file:
        with open(args.osm_file, encoding="utf-8") as f:
            data = json.load(f)
        return (data["elements"] if isinstance(data, dict) else data), "file " + args.osm_file
    if CACHE_FILE.exists() and not args.refresh:
        age = time.time() - CACHE_FILE.stat().st_mtime
        if age < CACHE_TTL_S or args.offline:
            with open(CACHE_FILE, encoding="utf-8") as f:
                return json.load(f), "cache"
    if args.offline:
        raise RuntimeError("--offline set but there is no cache. Run once online, or pass --osm-file.")
    print("Downloading campus data from OpenStreetMap ...")
    elements = download_osm()
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(elements, f)
    return elements, "live"


# ---------------------------------------------------------------------------
# OSM elements -> GeoJSON
# ---------------------------------------------------------------------------
def has_arabic(s):
    return any("؀" <= ch <= "ۿ" for ch in s)


def names(tags):
    raw = tags.get("name", "")
    en = tags.get("name:en") or ("" if has_arabic(raw) else raw)
    ar = tags.get("name:ar") or (raw if has_arabic(raw) else "")
    return (en or ar), ar


def process(elements):
    campus_local = [to_local(lng, lat) for lng, lat in CAMPUS["boundary"]]
    buildings, pois_by_name = [], {}

    def add_poi(p):
        key = p["properties"]["name"].lower()
        old = pois_by_name.get(key)
        if old is None or old["properties"]["area_m2"] < p["properties"]["area_m2"]:
            pois_by_name[key] = p  # same name twice: keep the larger

    for el in elements:
        tags = el.get("tags", {})
        label, ar = names(tags)
        if el.get("type") == "node":
            if not label or "lat" not in el:
                continue
            x, y = to_local(el["lon"], el["lat"])
            if point_in_polygon(x, y, campus_local):
                add_poi({"type": "Feature",
                         "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
                         "properties": {"id": "n%s" % el["id"], "name": label, "name_ar": ar,
                                        "area_m2": 40.0, "kind": "place"}})
            continue
        if el.get("type") != "way" or len(el.get("geometry", [])) < 4:
            continue
        coords = [(g["lon"], g["lat"]) for g in el["geometry"]]
        if coords[0] != coords[-1]:
            continue  # an open line, not a footprint
        local = [to_local(*c) for c in coords[:-1]]
        cx, cy = centroid(local)
        if not point_in_polygon(cx, cy, campus_local):
            continue
        is_building = "building" in tags
        height, estimated = building_height(tags) if is_building else (0.6, True)
        area = abs(signed_area(local))
        lng = LNG0 + cx / (M_PER_DEG_LNG * _K)
        lat = LAT0 + cy / M_PER_DEG_LAT
        buildings.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [[list(c) for c in coords]]},
            "properties": {"id": "w%s" % el["id"], "name": label, "name_ar": ar,
                           "height": round(height, 1), "height_estimated": estimated,
                           "named": bool(label), "area_m2": round(area, 1),
                           "kind": "building" if is_building else "place"}})
        if label:
            add_poi({"type": "Feature",
                     "geometry": {"type": "Point", "coordinates": [round(lng, 7), round(lat, 7)]},
                     "properties": {"id": "w%s" % el["id"], "name": label, "name_ar": ar,
                                    "area_m2": round(area, 1), "kind": "building" if is_building else "place"}})

    pois = sorted(pois_by_name.values(), key=lambda f: f["properties"]["name"].lower())
    return ({"type": "FeatureCollection", "features": buildings},
            {"type": "FeatureCollection", "features": pois})


# ---------------------------------------------------------------------------
# The web page
# ---------------------------------------------------------------------------
PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Campus Map Mapbox</title>
<meta name="robots" content="noindex">
<link href="https://api.mapbox.com/mapbox-gl-js/__GLVER__/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/__GLVER__/mapbox-gl.js"></script>
<style>
  :root { --bg:#0B0C0E; --bg2:#121418; --bg3:#1A1D22; --fg:#F2F1EC; --fg2:#A9B0BA; --fg3:#8A929D;
          --edge:#747C87; --accent:#FFC700; --glow:#8BF5B0; --err:#FF8A7A;
          --mono: ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  * { box-sizing:border-box; }
  html,body { height:100%; margin:0; background:var(--bg); color:var(--fg); font:15px/1.45 var(--sans); }
  #map { position:fixed; inset:0; }
  button,select,input { font:inherit; color:inherit; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .panel { position:fixed; z-index:5; top:16px; left:16px; width:344px; max-height:calc(100% - 32px); display:flex; flex-direction:column;
           background:rgba(18,20,24,.95); border:1px solid #2a2e35; border-radius:12px; overflow:hidden; }
  .panel[hidden],#toggle[hidden] { display:none; }
  header { padding:12px 16px 10px; border-bottom:1px solid #23272d; }
  .top { display:flex; justify-content:space-between; align-items:center; }
  .eyebrow { font:500 11px var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--fg3); margin:0 0 4px; }
  h1 { font-size:18px; margin:0; font-weight:650; } h1 span { color:var(--fg2); font-weight:400; margin-inline-start:6px; }
  .body { padding:12px 16px 16px; overflow:auto; display:grid; gap:14px; }
  label,.lbl { display:block; font:500 11px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--fg3); margin-bottom:4px; }
  select { width:100%; background:var(--bg3); border:1px solid var(--edge); border-radius:8px; padding:9px 10px; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .btn { background:var(--bg3); border:1px solid var(--edge); border-radius:8px; padding:8px 12px; cursor:pointer; }
  .btn:hover { border-color:var(--fg2); } .btn.primary { background:var(--accent); color:#0B0C0E; border-color:var(--accent); font-weight:600; }
  .btn[aria-pressed=true] { border-color:var(--accent); color:var(--accent); } .btn.primary[aria-pressed=true] { color:#0B0C0E; }
  .stat { font:500 13px var(--mono); color:var(--fg2); } .stat b { color:var(--glow); font-weight:600; }
  .checks label { display:flex; gap:6px; align-items:center; margin:0; text-transform:none; letter-spacing:0; font:14px var(--sans); color:var(--fg); }
  .checks { display:flex; gap:14px; flex-wrap:wrap; }
  #places { list-style:none; margin:0; padding:0; max-height:160px; overflow:auto; border:1px solid #23272d; border-radius:8px; }
  #places button { width:100%; text-align:start; background:none; border:0; border-bottom:1px solid #1d2026; padding:7px 10px; cursor:pointer; display:flex; justify-content:space-between; gap:10px; }
  #places button:hover { background:var(--bg3); } #places .ar { color:var(--fg3); }
  .hint { color:var(--fg3); font-size:13px; margin:0; } #status { min-height:1.4em; color:var(--fg2); font-size:13px; margin:0; } #status.err { color:var(--err); }
  .note { border:1px solid #2a2e35; border-radius:8px; padding:8px 10px; color:var(--fg2); font-size:13px; background:var(--bg2); }
  #toggle { position:fixed; z-index:6; top:16px; left:16px; }
  #alert { position:fixed; z-index:9; left:50%; bottom:16px; transform:translateX(-50%); width:min(640px,calc(100% - 32px)); background:#2a1512; border:1px solid var(--err); border-radius:10px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start; }
  #alert[hidden] { display:none; } #alert p { margin:0; flex:1; white-space:pre-line; }
  #gate { position:fixed; inset:0; z-index:10; display:grid; place-items:center; padding:16px; background:var(--bg); }
  #gate[hidden] { display:none; }
  .card { width:min(480px,100%); background:var(--bg2); border:1px solid #2a2e35; border-radius:14px; padding:22px; display:grid; gap:14px; }
  .card h2 { margin:0; font-size:20px; } .card p { margin:0; color:var(--fg2); }
  .card input { width:100%; background:var(--bg3); border:1px solid var(--edge); border-radius:8px; padding:9px 10px; }
  #gateErr { color:var(--err); } .readout { font:500 13px var(--mono); }
  @media (max-width:640px) { .panel { top:auto; bottom:0; left:0; right:0; width:auto; max-height:52%; border-radius:14px 14px 0 0; } #toggle { top:auto; bottom:16px; } }
</style>
</head>
<body>
<div id="map" role="application" aria-label="3D map of the University of Sharjah campus"></div>

<aside class="panel" id="panel" aria-label="Campus controls" hidden>
  <header>
    <div class="top"><p class="eyebrow">Study area · prototype</p><button class="btn" id="hide" style="padding:2px 10px">Hide</button></div>
    <h1>University of Sharjah <span lang="ar" dir="rtl">جامعة الشارقة</span></h1>
  </header>
  <div class="body">
    <div class="stat" id="stats" aria-live="polite"></div>
    <div><label for="from">From</label><select id="from"></select></div>
    <div><label for="to">To</label><select id="to"></select></div>
    <div class="row"><button class="btn" id="swap">Swap</button><button class="btn" id="clear">Clear route</button></div>
    <p class="hint" id="routeInfo">Pick two places to get a walking route.</p>
    <div class="row">
      <button class="btn primary" id="tour" aria-pressed="false">Fly the campus</button>
      <button class="btn" id="top" aria-pressed="false">Top view</button>
    </div>
    <div><label for="light">Light</label>
      <select id="light"><option value="day">Day</option><option value="dusk">Dusk</option><option value="dawn">Dawn</option><option value="night">Night</option></select></div>
    <div class="checks" role="group" aria-label="Layers">
      <label><input type="checkbox" id="lyBoundary" checked> Boundary</label>
      <label><input type="checkbox" id="lyBuildings" checked> Buildings</label>
      <label><input type="checkbox" id="lyLabels" checked> Labels</label>
      <label><input type="checkbox" id="lyIndoor" checked> Indoor maps</label>
    </div>
    <div><span class="lbl" id="placesLbl">Named places</span><ul id="places" aria-labelledby="placesLbl"></ul></div>
    <div><span class="lbl">Pick coordinates</span>
      <div class="row"><span class="readout" id="coords">Click the map</span><button class="btn" id="copy">Copy</button></div></div>
    <p class="note"><b>Floors:</b> Mapbox's built-in indoor floor plans cover supported venues such as airports. The floor selector (top right) fills in only where Mapbox has indoor data. For this campus it stays empty until you add your own indoor data.</p>
    <p id="status" role="status"></p>
    <p class="hint" id="credit"></p>
  </div>
</aside>
<button class="btn" id="toggle" hidden>Show controls</button>
<div id="alert" role="alert" hidden><p id="alertText"></p><button class="btn" id="alertClose" style="padding:2px 10px">Close</button></div>

<section id="gate" hidden aria-labelledby="gateTitle">
  <form class="card" id="gateForm">
    <p class="eyebrow">DALIL · campus map prototype</p>
    <h2 id="gateTitle">Add your Mapbox token</h2>
    <p>Paste a <b>public</b> access token (starts with <code>pk.</code>) from your Mapbox account. It stays in this browser only.</p>
    <div><label for="tok">Mapbox public token</label><input id="tok" type="password" autocomplete="off" spellcheck="false" placeholder="pk.…"></div>
    <p id="gateErr" role="alert"></p>
    <div class="row"><button class="btn primary" type="submit">Open the map</button></div>
  </form>
</section>

<script>
const DATA = /*__DATA__*/null;
const EMBEDDED_TOKEN = "__TOKEN__";
const $ = (id) => document.getElementById(id);
const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOME = { center: DATA.campus.center, zoom: 16.2, pitch: 60, bearing: 25 };
const GLOW = '#8BF5B0', ACCENT = '#FFC700';
const S = { map: null, pois: [], from: null, to: null, route: null, lastClick: null, touring: false, raf: 0, indoor: null };

function alertBanner(msg) { $('alertText').textContent = msg; $('alert').hidden = false; console.error(msg); }
$('alertClose').addEventListener('click', () => { $('alert').hidden = true; });

async function probe(token) {
  // Asks Mapbox directly, so a blank map comes with a reason.
  const tests = [['style', 'https://api.mapbox.com/styles/v1/mapbox/standard?access_token='],
                 ['map tiles', 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?secure&access_token=']];
  const problems = [];
  for (const [name, url] of tests) {
    try {
      const r = await fetch(url + encodeURIComponent(token));
      if (!r.ok) problems.push(name + ': Mapbox answered HTTP ' + r.status + (r.status === 401 || r.status === 403 ? ' (token invalid, missing scopes, or URL-restricted: add http://localhost:8000 to its allowed URLs)' : ''));
    } catch (e) {
      problems.push(name + ': request blocked (' + e.message + '). Check VPN, firewall, school/work network or an ad-blocker.');
    }
  }
  if (location.protocol === 'file:') problems.push('This page was opened as a file. Run the Python script with its built-in server and open http://localhost:8000/campus_map.html instead.');
  if (problems.length) alertBanner('The map cannot load its data:\n' + problems.join('\n'));
}

function setStatus(msg, err) { const el = $('status'); el.textContent = msg || ''; el.className = err ? 'err' : ''; }

function getToken() {
  const q = new URLSearchParams(location.search).get('token');
  if (q) safe(() => localStorage.setItem('mapbox-token', q));
  return q || EMBEDDED_TOKEN || safe(() => localStorage.getItem('mapbox-token'), '') || '';
}

function start(token) {
  $('gate').hidden = true; $('panel').hidden = false;
  mapboxgl.accessToken = token;
  if (mapboxgl.setRTLTextPlugin) safe(() => mapboxgl.setRTLTextPlugin(
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js', null, true));
  const map = S.map = new mapboxgl.Map({
    container: 'map', style: 'mapbox://styles/mapbox/standard',
    center: HOME.center, zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing,
    minZoom: 12,
    config: { basemap: { showIndoor: true, lightPreset: 'day' } }
  });
  probe(token);
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
  // Floor selector from Mapbox Indoor Maps (experimental; only fills in over supported venues).
  if (mapboxgl.IndoorControl) { S.indoor = new mapboxgl.IndoorControl(); map.addControl(S.indoor, 'top-right'); }
  else setStatus('This Mapbox GL JS build has no IndoorControl.', true);
  map.on('error', (e) => {
    const err = (e && e.error) || {}, msg = err.message || String(err);
    console.error('Mapbox error:', err);
    if (err.status === 401 || /access token|401/i.test(msg)) { showGate('Mapbox rejected this token (' + msg + '). Check the token and its URL restrictions.'); safe(() => localStorage.removeItem('mapbox-token')); return; }
    alertBanner('Map problem: ' + msg + (err.status ? ' (HTTP ' + err.status + ')' : ''));
  });
  let reported = false;
  map.on('idle', () => {
    if (reported || !map.getLayer('buildings')) return; reported = true;
    const n = map.queryRenderedFeatures({ layers: ['buildings'] }).length;
    const c = map.getCenter();
    console.log('Campus map: ' + n + ' buildings drawn; centre ' + c.lng.toFixed(5) + ',' + c.lat.toFixed(5) + ' zoom ' + map.getZoom().toFixed(2));
    if (!n) alertBanner('The map loaded but no campus buildings are on screen. Press F12, open Console, and send the red lines to Claude.');
  });
  map.on('style.load', onStyle);
  map.on('click', onMapClick);
  map.on('dragstart', () => { if (S.touring) stopTour(); });
}

function showGate(msg) { $('gate').hidden = false; $('panel').hidden = true; $('gateErr').textContent = msg || ''; if (S.map) { S.map.remove(); S.map = null; } }

function onStyle() {
  const map = S.map;
  safe(() => map.setConfigProperty('basemap', 'show3dObjects', false)); // our blocks replace the basemap's, no overlap
  map.addSource('campus-boundary', { type: 'geojson', data: DATA.campus.boundaryGeojson });
  map.addSource('campus-buildings', { type: 'geojson', data: DATA.buildings });
  map.addSource('campus-pois', { type: 'geojson', data: DATA.pois });
  map.addSource('route', { type: 'geojson', data: emptyFc() });
  map.addSource('walker', { type: 'geojson', data: emptyFc() });
  map.addSource('ends', { type: 'geojson', data: emptyFc() });

  const failed = [];
  const addLayer = (l) => { try { map.addLayer(l); } catch (e) { failed.push(l.id); console.error('addLayer ' + l.id, e); } };
  addLayer({ id: 'boundary-fill', type: 'fill', slot: 'middle', source: 'campus-boundary',
    paint: { 'fill-color': ACCENT, 'fill-opacity': 0.06, 'fill-emissive-strength': 1 } });
  addLayer({ id: 'boundary-line', type: 'line', slot: 'middle', source: 'campus-boundary',
    paint: { 'line-color': ACCENT, 'line-width': 3, 'line-emissive-strength': 1 } });
  addLayer({ id: 'buildings', type: 'fill-extrusion', slot: 'middle', source: 'campus-buildings',
    paint: {
      'fill-extrusion-color': ['case', ['get', 'named'], ACCENT, '#7e8da0'],
      'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.72, 'fill-extrusion-emissive-strength': 0.4 } });
  addLayer({ id: 'route-halo', type: 'line', slot: 'top', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': GLOW, 'line-width': 14, 'line-opacity': 0.25, 'line-emissive-strength': 1 } });
  addLayer({ id: 'route-line', type: 'line', slot: 'top', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': GLOW, 'line-width': 5, 'line-emissive-strength': 1 } });
  addLayer({ id: 'ends', type: 'circle', slot: 'top', source: 'ends',
    paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#0B0C0E', 'circle-stroke-width': 2, 'circle-emissive-strength': 1 } });
  addLayer({ id: 'walker', type: 'circle', slot: 'top', source: 'walker',
    paint: { 'circle-radius': 7, 'circle-color': GLOW, 'circle-blur': 0.3, 'circle-emissive-strength': 1 } });
  addLayer({ id: 'labels', type: 'symbol', slot: 'top', source: 'campus-pois',
    layout: {
      'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-anchor': 'top', 'text-offset': [0, 0.6], 'symbol-sort-key': ['-', 0, ['get', 'area_m2']], 'text-optional': true },
    paint: { 'text-color': '#F2F1EC', 'text-halo-color': '#0B0C0E', 'text-halo-width': 1.6, 'text-emissive-strength': 1 } });

  if (failed.length) alertBanner('These layers could not be added: ' + failed.join(', '));
  map.on('click', 'labels', (e) => { const p = S.pois.find((q) => q.id === e.features[0].properties.id); if (p) choose(p); });
  map.on('mouseenter', 'labels', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'labels', () => (map.getCanvas().style.cursor = ''));
  initPanel();
}

const emptyFc = () => ({ type: 'FeatureCollection', features: [] });

let panelReady = false;
function initPanel() {
  if (panelReady) return; panelReady = true;
  S.pois = DATA.pois.features.map((f) => ({ id: f.properties.id, name: f.properties.name, ar: f.properties.name_ar,
    area: f.properties.area_m2, ll: f.geometry.coordinates }));
  const nb = DATA.buildings.features.length, est = DATA.buildings.features.filter((f) => f.properties.height_estimated && f.properties.kind === 'building').length;
  $('stats').innerHTML = '<b>' + nb + '</b> footprints · <b>' + S.pois.length + '</b> named places · ' + est + ' heights estimated (' + DATA.source + ')';
  if (!S.pois.length) setStatus('No named places came back from OpenStreetMap. Use Pick coordinates to note your own.');
  ['from', 'to'].forEach((id) => {
    const sel = $(id); sel.appendChild(new Option('Choose a place…', ''));
    S.pois.forEach((p, i) => sel.appendChild(new Option(p.name, String(i))));
    sel.addEventListener('change', () => { S[id] = sel.value === '' ? null : S.pois[+sel.value]; updateRoute(); });
  });
  const ul = $('places');
  S.pois.forEach((p) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; const n = document.createElement('span'); n.textContent = p.name; b.appendChild(n);
    if (p.ar && p.ar !== p.name) { const a = document.createElement('span'); a.className = 'ar'; a.lang = 'ar'; a.dir = 'rtl'; a.textContent = p.ar; b.appendChild(a); }
    b.addEventListener('click', () => choose(p)); li.appendChild(b); ul.appendChild(li);
  });
  $('credit').textContent = DATA.campus.source + ' · © Mapbox';
  $('swap').onclick = () => { [S.from, S.to] = [S.to, S.from]; syncSelects(); updateRoute(); };
  $('clear').onclick = () => { S.from = S.to = null; syncSelects(); updateRoute(); setStatus(''); };
  $('tour').onclick = () => (S.touring ? stopTour() : runTour());
  $('top').onclick = () => {
    const on = $('top').getAttribute('aria-pressed') !== 'true'; $('top').setAttribute('aria-pressed', String(on));
    camera({ pitch: on ? 0 : HOME.pitch, bearing: on ? 0 : HOME.bearing }, 900);
  };
  $('light').onchange = () => safe(() => S.map.setConfigProperty('basemap', 'lightPreset', $('light').value));
  const vis = (layers, on) => layers.forEach((l) => S.map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'));
  $('lyBoundary').onchange = (e) => vis(['boundary-fill', 'boundary-line'], e.target.checked);
  $('lyBuildings').onchange = (e) => vis(['buildings'], e.target.checked);
  $('lyLabels').onchange = (e) => vis(['labels'], e.target.checked);
  $('lyIndoor').onchange = (e) => {
    safe(() => S.map.setConfigProperty('basemap', 'showIndoor', e.target.checked));
    if (S.indoor) { if (e.target.checked) S.map.addControl(S.indoor, 'top-right'); else S.map.removeControl(S.indoor); }
  };
  $('copy').onclick = () => {
    if (!S.lastClick) return; const t = S.lastClick.lat.toFixed(6) + ', ' + S.lastClick.lng.toFixed(6);
    (navigator.clipboard ? navigator.clipboard.writeText(t).then(() => setStatus('Copied ' + t), () => setStatus('Copy blocked by the browser.', true))
                         : setStatus('Copy is not available in this browser.', true));
  };
  $('hide').onclick = () => { $('panel').hidden = true; $('toggle').hidden = false; };
  $('toggle').onclick = () => { $('panel').hidden = false; $('toggle').hidden = true; };
}

function syncSelects() {
  $('from').value = S.from ? String(S.pois.indexOf(S.from)) : '';
  $('to').value = S.to ? String(S.pois.indexOf(S.to)) : '';
}

function choose(p) {
  if (!S.from || (S.from && S.to)) { S.from = p; S.to = null; } else { S.to = p; }
  syncSelects(); updateRoute(); camera({ center: p.ll, zoom: 18, pitch: 62 }, 1400);
}

function camera(opts, ms) {
  if (reduceMotion || !ms) S.map.jumpTo(opts); else S.map.easeTo(Object.assign({ duration: ms }, opts));
}

/* ---------- walking route (Mapbox Directions API) ---------- */

const haversine = (a, b) => { const R = 6371008.8, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function lineLength(c) { let d = 0; for (let i = 1; i < c.length; i++) d += haversine(c[i - 1], c[i]); return d; }

function pointAlong(c, d) {
  for (let i = 1; i < c.length; i++) {
    const s = haversine(c[i - 1], c[i]);
    if (d <= s && s > 0) { const t = d / s; return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]; }
    d -= s;
  }
  return c[c.length - 1];
}

let routeToken = 0;
async function updateRoute() {
  const map = S.map, token = ++routeToken; cancelAnimationFrame(S.raf);
  map.getSource('walker').setData(emptyFc());
  const ends = [];
  if (S.from) ends.push({ type: 'Feature', properties: { color: GLOW }, geometry: { type: 'Point', coordinates: S.from.ll } });
  if (S.to) ends.push({ type: 'Feature', properties: { color: ACCENT }, geometry: { type: 'Point', coordinates: S.to.ll } });
  map.getSource('ends').setData({ type: 'FeatureCollection', features: ends });
  if (!S.from || !S.to) { map.getSource('route').setData(emptyFc()); $('routeInfo').textContent = 'Pick two places to get a walking route.'; return; }
  let coords, note;
  try {
    const [a, b] = [S.from.ll, S.to.ll];
    const url = 'https://api.mapbox.com/directions/v5/mapbox/walking/' + a.join(',') + ';' + b.join(',') +
      '?geometries=geojson&overview=full&access_token=' + encodeURIComponent(mapboxgl.accessToken);
    const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); if (!j.routes || !j.routes.length) throw new Error('no route');
    coords = j.routes[0].geometry.coordinates;
    note = Math.round(j.routes[0].distance) + ' m, about ' + Math.max(1, Math.round(j.routes[0].duration / 60)) + ' min on foot (Mapbox Directions, outdoor paths only).';
  } catch (e) {
    coords = [S.from.ll, S.to.ll];
    note = Math.round(lineLength(coords)) + ' m straight line (walking directions unavailable: ' + e.message + ').';
  }
  if (token !== routeToken) return; // a newer pick replaced this one
  map.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  $('routeInfo').textContent = note + ' The route ends at the building centre, not at an entrance.';
  const bounds = coords.reduce((bb, c) => bb.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
  if (!reduceMotion) map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: window.innerWidth > 640 ? 380 : 40, right: 40 }, pitch: 55, duration: 1200, maxZoom: 18 });
  if (!reduceMotion) animateWalker(coords, token);
}

function animateWalker(coords, token) {
  const total = lineLength(coords), t0 = performance.now();
  const step = (now) => {
    if (token !== routeToken) return;
    const phase = Math.min(1, ((now - t0) % 12000) / 10000); // 10 s along the route, 2 s pause
    S.map.getSource('walker').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pointAlong(coords, phase * total) } });
    S.raf = requestAnimationFrame(step);
  };
  S.raf = requestAnimationFrame(step);
}

/* ---------- tour and picking ---------- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function flyAndWait(opts) {
  return new Promise((res) => { if (reduceMotion) { S.map.jumpTo(opts); return res(); }
    S.map.once('moveend', res); S.map.flyTo(Object.assign({ essential: true }, opts)); });
}
async function runTour() {
  S.touring = true; $('tour').setAttribute('aria-pressed', 'true'); $('tour').textContent = 'Stop flying';
  const stops = S.pois.slice().sort((a, b) => b.area - a.area).slice(0, 6);
  await flyAndWait(Object.assign({ duration: 1800 }, HOME));
  for (let i = 0; i < stops.length && S.touring; i++) {
    setStatus('Now: ' + stops[i].name);
    await flyAndWait({ center: stops[i].ll, zoom: 18.2, pitch: 65, bearing: (i * 55 + 20) % 360, duration: 2600 });
    if (S.touring) await wait(1800);
  }
  if (S.touring) await flyAndWait(Object.assign({ duration: 2200 }, HOME));
  stopTour();
}
function stopTour() { S.touring = false; S.map.stop(); $('tour').setAttribute('aria-pressed', 'false'); $('tour').textContent = 'Fly the campus'; setStatus(''); }

function onMapClick(e) {
  S.lastClick = e.lngLat;
  $('coords').textContent = e.lngLat.lat.toFixed(6) + ', ' + e.lngLat.lng.toFixed(6);
}

$('gateForm').addEventListener('submit', (ev) => {
  ev.preventDefault(); const t = $('tok').value.trim();
  if (!/^pk\./.test(t)) { $('gateErr').textContent = 'That does not look like a public token. It should start with pk.'; return; }
  safe(() => localStorage.setItem('mapbox-token', t)); start(t);
});

const token = getToken();
if (token) start(token); else $('gate').hidden = false;
</script>
</body>
</html>
"""


def build_page(token, gl_version, buildings, pois, source):
    boundary_ring = [list(p) for p in CAMPUS["boundary"]] + [list(CAMPUS["boundary"][0])]
    data = {
        "campus": {
            "name": CAMPUS["name"],
            "center": list(CAMPUS["center"]),
            "bbox": CAMPUS["bbox"],
            "source": CAMPUS["source"],
            "boundaryGeojson": {
                "type": "Feature", "properties": {"name": CAMPUS["name"]},
                "geometry": {"type": "Polygon", "coordinates": [boundary_ring]},
            },
        },
        "buildings": buildings,
        "pois": pois,
        "source": source,
    }
    # '</' is escaped so the data can never close the <script> tag early.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return (PAGE.replace("/*__DATA__*/null", payload)
                .replace("__TOKEN__", token.replace('"', ""))
                .replace("__GLVER__", gl_version))


# ---------------------------------------------------------------------------
# Serve + self-test + main
# ---------------------------------------------------------------------------
def serve(folder, filename, port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(folder))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        url = "http://localhost:{}/{}".format(port, filename)
        print("Serving {} (Ctrl+C to stop)".format(url))
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


def selftest():
    # geometry
    sq = [(0, 0), (10, 0), (10, 10), (0, 10)]
    assert abs(signed_area(sq) - 100) < 1e-9
    assert point_in_polygon(5, 5, sq) and not point_in_polygon(11, 5, sq)
    assert building_height({"height": "12 m"}) == (12.0, False)
    assert building_height({"building:levels": "4"}) == (14.0, True)
    assert building_height({}) == (9.0, True)
    assert has_arabic("جامعة") and not has_arabic("Library")
    # the campus centre is inside the campus outline
    outline = [to_local(*p) for p in CAMPUS["boundary"]]
    assert point_in_polygon(*to_local(*CAMPUS["center"]), outline)
    # processing a tiny fake Overpass answer
    lng, lat = CAMPUS["center"]
    d = 0.0002
    ring = [(lng, lat), (lng + d, lat), (lng + d, lat + d), (lng, lat + d), (lng, lat)]
    elements = [
        {"type": "way", "id": 1, "tags": {"building": "yes", "name": "Test Hall", "name:ar": "قاعة", "building:levels": "3"},
         "geometry": [{"lat": a, "lon": o} for o, a in ring]},
        {"type": "way", "id": 2, "tags": {"building": "yes"},  # unnamed, outside the campus
         "geometry": [{"lat": a + 1, "lon": o} for o, a in ring]},
        {"type": "node", "id": 3, "lat": lat, "lon": lng, "tags": {"amenity": "cafe", "name": "Test Cafe"}},
    ]
    b, p = process(elements)
    assert len(b["features"]) == 1 and b["features"][0]["properties"]["height"] == 10.5
    assert [f["properties"]["name"] for f in p["features"]] == ["Test Cafe", "Test Hall"]
    page = build_page("pk.test", "v3.35.0", b, p, "selftest")
    assert "</script><script" not in page and "pk.test" in page and "__GLVER__" not in page
    print("selftest ok")


def main():
    ap = argparse.ArgumentParser(description="University of Sharjah 3D campus map (Mapbox GL JS).")
    ap.add_argument("--token", default=os.environ.get("MAPBOX_TOKEN", ""))
    ap.add_argument("--osm-file")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--out", default=str(HERE / "campus_map.html"))
    ap.add_argument("--serve", action="store_true", help="(default) serve and open the page")
    ap.add_argument("--no-serve", action="store_true", help="only write the HTML file")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--gl-version", default="v3.35.0")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        selftest()
        return 0

    try:
        elements, source = load_elements(args)
    except RuntimeError as e:
        print("Error:", e, file=sys.stderr)
        return 1
    buildings, pois = process(elements)
    out = Path(args.out).resolve()
    out.write_text(build_page(args.token.strip(), args.gl_version, buildings, pois, source), encoding="utf-8")
    print("Wrote {}  ({} footprints, {} named places, data: {})".format(
        out, len(buildings["features"]), len(pois["features"]), source))
    if not args.token:
        print("No token given: the page will ask for your Mapbox public token in the browser.")
    if not args.no_serve:
        serve(out.parent, out.name, args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
