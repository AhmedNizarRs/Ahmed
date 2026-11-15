#!/usr/bin/env python3
"""
University of Sharjah: 3D campus map with Mapbox GL JS.

What this script does (standard library only, Python 3.8+):
  1. Downloads the campus buildings and named places from OpenStreetMap (Overpass API),
     keeps only the ones inside the University of Sharjah main-campus outline, and caches them.
  2. Writes one self-contained web page, campus_map.html, using Mapbox GL JS v3:
       - a BASE MAP switcher (see "Base maps" below): Mapbox, Google, Esri, OpenStreetMap,
         CARTO and OpenTopoMap; the campus layers stay on top of whichever base map you pick
       - Mapbox Standard style with indoor maps switched on (showIndoor) + the IndoorControl
         floor selector from https://www.mapbox.com/indoor-maps
       - the campus buildings as 3D blocks, the study-area outline, and named place labels
       - From / To walking routes (Mapbox Directions API), a moving dot along the route
       - a camera fly-through, light presets, top view, and a click-to-copy coordinate picker
  3. Optionally serves the page on your computer and opens it in your browser.

BASE MAPS (the "Base map" list in the panel; your choice is remembered in the browser):
  Mapbox   Standard (3D, indoor, light presets), Standard Satellite, Satellite Streets, Streets,
           Outdoors, Light, Dark, Navigation Night. Uses your Mapbox token.
  Google   Roads, Satellite, Satellite + labels, Terrain. Through Google's official Map Tiles API
           only: needs a Google Maps Platform key with "Map Tiles API" enabled and billing set up
           (Google gives a monthly free quota). Give it with --google-key or $GOOGLE_MAPS_KEY,
           or paste it in the page when you pick a Google map. Raw google.com tile URLs are NOT
           used: they break Google's terms and Google blocks them.
  Esri     World Imagery (satellite), Imagery + labels, World Street Map, World Topographic,
           Light Gray. Public Esri services: attribution required; commercial use needs an
           ArcGIS account.
  Others   OpenStreetMap, CARTO Light / Dark / Voyager, OpenTopoMap. Free with attribution for
           light use (OSM's tile policy forbids heavy traffic; CARTO is free for non-commercial).
  Light presets and Mapbox indoor floors only exist on the Mapbox Standard styles.

INDOOR LAYOUTS: the page has a floor selector. Every source below is placed on the real map (georeferenced):
  (a) OpenStreetMap indoor mapping, downloaded automatically: rooms, corridors, areas, walls, doors, entrances,
      lifts and shops/amenities with a level (Simple Indoor Tagging and the older buildingpart/room tags,
      including multipolygon rooms), for the campus or any --indoor-bbox in the world;
  (b) the official building directory (codes and names in English and Arabic, from the University's public
      campus map) matched to the building footprints; it lists buildings, not rooms;
  (c) indoor maps you point it at, from a file or any URL (GitHub links work): GeoJSON (--indoor-file),
      IMDF archives (--imdf), DALIL Mapper exports (--dalil-map), and floor-plan pictures placed by control
      points (--plan-image).
No public room-level layout of the University of Sharjah exists online (checked 2026-11-15: the University
publishes a building map, not floor plans), so rooms appear here when OpenStreetMap mappers add them or when
you supply a layout (from the University's facilities office, your own survey, or the DALIL Mapper).
Mapbox's own Indoor Maps data covers airports and similar venues, and its custom-indoor service
is by arrangement with Mapbox, so for this campus the rooms have to come from (a) or (b).

IMPORTANT about indoor floors: Mapbox's built-in indoor floor plans cover supported venues
such as airports. The University of Sharjah is not one of them, so the floor selector stays
empty here until Mapbox adds coverage or you supply your own indoor data (see README notes
at the bottom of this file). Nothing about floors, rooms or building heights is invented:
heights come from OpenStreetMap tags, otherwise a generic 9 m block that the page marks as
"estimated".

Usage:
    export MAPBOX_TOKEN=pk.xxxxx            # public token from https://account.mapbox.com
    export GOOGLE_MAPS_KEY=AIza...          # optional: Google base maps (Map Tiles API)
    python campus_map_mapbox.py             # build, serve on http://localhost:8000, open browser
    python campus_map_mapbox.py --no-serve  # only write campus_map.html
    python campus_map_mapbox.py --selftest  # run the built-in checks and exit

Options:
    --token TOKEN       Mapbox public token (default: $MAPBOX_TOKEN). If you leave it out, the
                        page asks for it in the browser and keeps it in that browser only.
    --google-key KEY    Google Maps Platform key for the Google base maps (default: $GOOGLE_MAPS_KEY).
                        If you leave it out, the page asks for it when you pick a Google map.
    --base ID           Base map to open with (default: standard). IDs are listed in the page.
    --osm-file FILE     Use a saved Overpass JSON answer instead of downloading.
    --indoor-file SRC   GeoJSON indoor rooms with a "level" property: a path or any URL, e.g. a GitHub link (repeatable).
    --imdf SRC          An IMDF indoor map (Apple Indoor Mapping Data Format: .zip, folder or URL) (repeatable).
    --dalil-map SRC[@LEVEL]  A DALIL Mapper export that has a world position (walls + labelled places) (repeatable).
    --plan-image "SRC|LEVEL|px,py,lng,lat;px,py,lng,lat[;...]"
                        A floor-plan picture (PNG/JPG, path or URL) placed on the map by control points:
                        a pixel and the real latitude/longitude it shows. 2 points = move/rotate/scale,
                        3+ = best fit with the error in metres. Use pictures you are allowed to use.
    --indoor-bbox S,W,N,E  Also harvest OpenStreetMap indoor data in this box (anywhere in the world).
    --make-indoor-template   Write uos_indoor_template.geojson showing the format, then exit.
    --no-indoor         Do not look for OpenStreetMap indoor data.
    --refresh           Ignore the cache and download again.
    --offline           Never touch the network from Python (cache or --osm-file only).
    --out FILE          Output page (default: campus_map.html next to this script).
    --no-serve          Only write the page; do not start the local server.
    --port N            Port for --serve (default 8000).
    --gl-version VER    Mapbox GL JS version (default v3.35.0, the version Mapbox's own indoor
                        example uses).

Map data: (c) OpenStreetMap contributors (ODbL). Basemaps: (c) their providers (shown on the map).
Tokens and keys written into campus_map.html are browser keys that anyone using the page can see:
restrict each one to your page's address in the provider's console, and do not commit the page.
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

# Base map ids the page knows (kept here too so --base can be checked and the self-test can compare).
BASE_IDS = [
    "standard", "standard-satellite", "mb-satellite-streets", "mb-streets", "mb-outdoors", "mb-light", "mb-dark", "mb-nav-night",
    "google-roadmap", "google-satellite", "google-hybrid", "google-terrain",
    "esri-imagery", "esri-imagery-labels", "esri-street", "esri-topo", "esri-gray",
    "osm", "carto-light", "carto-dark", "carto-voyager", "opentopomap",
]

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
            "properties": {"id": "w%s" % el["id"], "name": label, "name_ar": ar, "ref": tags.get("ref", ""),
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
# Indoor layouts: OpenStreetMap indoor=* features and/or your own GeoJSON
# ---------------------------------------------------------------------------
INDOOR_CACHE = HERE / ".cache" / "uos_osm_indoor.json"
DOWNLOAD_DIR = HERE / ".cache" / "downloads"

# ---------------------------------------------------------------------------
# Official building directory: every building code and name on the University of Sharjah main campus,
# from the University's public campus map (sharjah.ac.ae, "uosmap-2026.pdf", read 2026-11-15).
# The PDF has no room-level floor plans; it gives building codes and names. Codes are matched to
# OpenStreetMap footprints by their `ref` tag or name; unmatched codes are listed in the page as "not placed".
# ---------------------------------------------------------------------------
DIRECTORY_SOURCE = "University of Sharjah campus map (sharjah.ac.ae, uosmap-2026.pdf)"
DIRECTORY_URL = "https://www.sharjah.ac.ae/-/media/project/uos/sites/uos/discover-uos/uos-map/uosmap-2026.pdf"
UOS_DIRECTORY = [  # (code, English, Arabic, what is inside)
    ("A1", "Ibn Rushd Building", "مبنى ابن رشد", "College of Sharia and Islamic Studies; Research Institute of Science and Engineering"),
    ("A2", "Ibn Khaldun Building", "مبنى ابن خلدون", "College of Arts, Humanities and Social Sciences; College of Law"),
    ("A3", "Ibn Al-Haytham Building", "مبنى ابن الهيثم", "College of Graduate Studies"),
    ("A4", "Dining Hall (Men)", "مجمع المطاعم", ""),
    ("A5", "Men's Students Center", "مركز الطلاب", ""),
    ("A6", "Men's Students Forum", "منتدى الطلاب", ""),
    ("A7", "Library Building (Men)", "مبنى المكتبة", ""),
    ("A8", "Classrooms A8", "قاعات دراسية", ""),
    ("A9", "Business and Computing Building", "", "College of Business Administration; College of Computing and Informatics"),
    ("A10", "Classrooms A10", "قاعات دراسية", ""),
    ("A11", "College of Sciences", "كلية العلوم", ""),
    ("A12", "Classrooms A12", "قاعات دراسية", ""),
    ("A13", "College of Engineering (Men)", "كلية الهندسة", ""),
    ("A14", "Classrooms A14", "قاعات دراسية", ""),
    ("A16", "Sports Complex - Men", "المجمع الرياضي - طلاب", ""),
    ("A17", "Innovation Hub", "مركز الابتكار", ""),
    ("A19", "University of Sharjah Stadium", "استاد جامعة الشارقة", ""),
    ("A20", "Classrooms A20", "قاعات دراسية", ""),
    ("C1", "Al Ghazali Building", "مبنى الغزالي", "College of Sharia and Islamic Studies; College of Law"),
    ("C2", "Al Farabi Building", "مبنى الفارابي", "College of Arts, Humanities and Social Sciences; College of Public Policy"),
    ("C3", "Arts, Humanities and Social Sciences (Women)", "", "College of Arts, Humanities and Social Sciences"),
    ("C4", "Dining Hall (Women)", "مجمع المطاعم", ""),
    ("C5", "Women's Students Center", "مركز الطالبات", ""),
    ("C6", "Women's Students Forum", "منتدى الطالبات", ""),
    ("C7", "Library Building (Women)", "مبنى المكتبة", ""),
    ("C8", "Classrooms C8", "قاعات دراسية", ""),
    ("C9", "College of Computing and Informatics (Women)", "كلية الحوسبة والمعلوماتية", ""),
    ("C10", "College of Business Administration (Women)", "كلية إدارة الأعمال", ""),
    ("C11", "College of Communication", "كلية الاتصال", ""),
    ("C12", "Classrooms C12", "قاعات دراسية", ""),
    ("C13", "College of Engineering (Women)", "كلية الهندسة", ""),
    ("C14", "Classrooms C14", "قاعات دراسية", ""),
    ("C15", "Sports Complex - Women", "المجمع الرياضي - طالبات", ""),
    ("C16", "Classrooms C16", "قاعات دراسية", ""),
    ("E1", "Jabir Bin Hayyan Building", "مبنى جابر بن حيان", "College of Pharmacy; College of Health Sciences"),
    ("E2", "Al Razi Auditorium", "مسرح الرازي", ""),
    ("E3", "Administration, Colleges of Medical and Health Sciences", "", ""),
    ("E4", "Library Building (Medical)", "مبنى المكتبة", ""),
    ("E5", "College of Medicine", "كلية الطب", ""),
    ("E6", "Research Institute for Medical and Health Sciences", "معهد البحوث الطبية والعلوم الصحية", ""),
    ("E7", "Ibn Sina Building", "مبنى ابن سينا", "Clinical Surgical Training Center; Diabetes Center"),
    ("E8", "Dining Hall (Medical)", "مجمع المطاعم", ""),
    ("E9", "College of Dental Medicine", "كلية طب الأسنان", ""),
    ("E11", "University Dental Hospital Sharjah", "مستشفى الأسنان الجامعي بالشارقة", ""),
    ("G6", "Administration - Men", "", ""),
    ("H10", "Administration - Women", "", ""),
]


def match_directory(buildings):
    """Puts the directory codes on the OpenStreetMap footprints (by ref, then by name). Returns the directory rows
    with where each one is (lng, lat) or None, and marks matched footprints with their code."""
    rows = []
    feats = buildings["features"]
    by_ref = {str(f["properties"].get("ref", "")).upper(): f for f in feats if f["properties"].get("ref")}
    for code, en, ar, inside in UOS_DIRECTORY:
        f = by_ref.get(code)
        if f is None:
            key = en.lower().split(" (")[0]
            f = next((g for g in feats if g["properties"].get("name") and (g["properties"]["name"].lower() == key or
                      (len(key) > 8 and key in g["properties"]["name"].lower()))), None)
        where = None
        if f is not None:
            ring = f["geometry"]["coordinates"][0][:-1]
            where = [round(sum(c[0] for c in ring) / len(ring), 7), round(sum(c[1] for c in ring) / len(ring), 7)]
            f["properties"]["code"] = code
            if not f["properties"].get("name"):
                f["properties"]["name"], f["properties"]["named"] = en, True
        rows.append({"code": code, "name": en, "name_ar": ar, "inside": inside, "at": where})
    return rows


# ---------------------------------------------------------------------------
# Fetching inputs from files or the web (GitHub raw links, APIs, any https URL), cached
# ---------------------------------------------------------------------------
def fetch_bytes(src, offline=False):
    """Reads a local path, or downloads an http(s) URL once (cached in .cache/downloads)."""
    if not str(src).startswith(("http://", "https://")):
        return Path(src).read_bytes()
    import hashlib
    url = str(src)
    if "github.com/" in url and "/blob/" in url:  # a GitHub page link -> the raw file
        url = url.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/", 1)
    cached = DOWNLOAD_DIR / (hashlib.sha1(url.encode()).hexdigest()[:16] + "_" + url.rstrip("/").split("/")[-1].split("?")[0][-60:])
    if cached.exists():
        return cached.read_bytes()
    if offline:
        raise RuntimeError("--offline set and {} is not cached".format(url))
    print("Downloading " + url)
    req = urllib.request.Request(url, headers={"User-Agent": "campus-map-prototype/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(data)
    return data


def norm_level(v):
    """'0;1' -> '0', 1.0 -> '1', ' -1 ' -> '-1'. Levels are compared as text on the page."""
    first = str(v).split(";")[0].strip()
    try:
        f = float(first)
        return str(int(f)) if f == int(f) else str(f)
    except ValueError:
        return first


# ---------------------------------------------------------------------------
# Source 1: OpenStreetMap indoor mapping (Simple Indoor Tagging, plus the older buildingpart/room tags)
# ---------------------------------------------------------------------------
def indoor_query(bbox=None):
    b = bbox or CAMPUS["bbox"]
    bb = "{},{},{},{}".format(b["s"], b["w"], b["n"], b["e"])
    return ("[out:json][timeout:90];("
            'nwr["indoor"]({bb});'                       # rooms, corridors, areas, walls, doors, levels
            'nwr["buildingpart"]({bb});'                 # older indoor tagging
            'nwr["room"]({bb});'
            'nwr["door"]["level"]({bb});'
            'node["entrance"]({bb});'
            'node["highway"="elevator"]({bb});'
            'nwr["level"]["amenity"]({bb});'
            'nwr["level"]["shop"]({bb});'
            'relation["type"="level"]({bb});'
            ");out geom tags;").format(bb=bb)


def load_indoor_elements(args):
    if args.no_indoor or args.osm_file:
        return []
    bbox = parse_bbox(args.indoor_bbox) if getattr(args, "indoor_bbox", None) else None
    cache = INDOOR_CACHE if not bbox else INDOOR_CACHE.with_name("osm_indoor_{s}_{w}_{n}_{e}.json".format(**bbox))
    try:
        if cache.exists() and not args.refresh:
            if time.time() - cache.stat().st_mtime < CACHE_TTL_S or args.offline:
                with open(cache, encoding="utf-8") as f:
                    return json.load(f)
        if args.offline:
            return []
        body = ("data=" + urllib.parse.quote(indoor_query(bbox))).encode()
        for attempt in range(3):
            for url in ENDPOINTS:
                try:
                    req = urllib.request.Request(url, data=body, headers={
                        "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "campus-map-prototype/1.0"})
                    with urllib.request.urlopen(req, timeout=120) as r:
                        els = json.loads(r.read().decode("utf-8")).get("elements", [])
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    with open(cache, "w", encoding="utf-8") as f:
                        json.dump(els, f)
                    return els
                except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
                    print("  indoor query {} failed: {}".format(url, e), file=sys.stderr)
            time.sleep(10 * (attempt + 1))  # public Overpass servers are often busy: back off and retry
    except Exception as e:  # indoor data is optional: never stop the map for it
        print("  indoor data skipped: {}".format(e), file=sys.stderr)
    return []


def parse_bbox(text):
    s, w, n, e = [float(v) for v in str(text).split(",")]
    if not (s < n and w < e):
        raise ValueError("--indoor-bbox must be south,west,north,east")
    return {"s": s, "w": w, "n": n, "e": e}


def join_rings(segments):
    """Joins way geometries (lists of [lng, lat]) end to end into closed rings (multipolygon outer members)."""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]: ring += s[1:]
                elif s[-1] == ring[-1]: ring += s[::-1][1:]
                elif s[-1] == ring[0]: ring = s[:-1] + ring
                elif s[0] == ring[0]: ring = s[::-1][:-1] + ring
                else: continue
                segs.pop(i); changed = True; break
        if len(ring) >= 4 and ring[0] == ring[-1]:
            rings.append(ring)
    return rings


INDOOR_KINDS = {"room", "corridor", "area", "wall", "door", "level", "stairs", "elevator", "toilets", "entrance", "amenity"}


def osm_kind(tags):
    if tags.get("highway") == "elevator": return "elevator"
    if "entrance" in tags: return "entrance"
    if tags.get("door"): return "door"
    if tags.get("stairs") == "yes" or tags.get("highway") == "steps": return "stairs"
    if tags.get("amenity") == "toilets" or tags.get("room") == "toilets": return "toilets"
    k = tags.get("indoor") or tags.get("buildingpart") or ("room" if "room" in tags else None)
    if k in ("verticalpassage",): return "stairs"
    if k: return k
    return "amenity" if (tags.get("amenity") or tags.get("shop")) else "room"


def process_indoor(elements, extra_files=(), clip=True):
    """OpenStreetMap indoor elements (+ GeoJSON files) -> one FeatureCollection with level, kind, name, source."""
    campus_local = [to_local(lng, lat) for lng, lat in CAMPUS["boundary"]]
    feats = []

    def inside(coords):
        if not clip: return True
        cx, cy = centroid([to_local(*c) for c in coords])
        return point_in_polygon(cx, cy, campus_local)

    for el in elements:
        tags = el.get("tags", {})
        level = tags.get("level") or tags.get("repeat_on") or tags.get("level:ref")
        if level is None or tags.get("type") == "level" or tags.get("indoor") == "level":
            continue  # a level outline itself is not a room
        name, ar = names(tags)
        label = name or tags.get("ref", "") or tags.get("room:ref", "")
        props = {"level": norm_level(level), "kind": osm_kind(tags), "name": label, "name_ar": ar, "source": "OpenStreetMap"}
        if el.get("type") == "node":
            if "lat" in el and inside([[el["lon"], el["lat"]]]):
                feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]}, "properties": props})
            continue
        if el.get("type") == "way":
            coords = [[g["lon"], g["lat"]] for g in el.get("geometry", [])]
            if len(coords) < 2 or not inside(coords):
                continue
            closed = len(coords) >= 4 and coords[0] == coords[-1]
            geom = {"type": "Polygon", "coordinates": [coords]} if closed and props["kind"] not in ("wall", "door") else {"type": "LineString", "coordinates": coords}
            feats.append({"type": "Feature", "geometry": geom, "properties": props})
        elif el.get("type") == "relation" and tags.get("type") == "multipolygon":
            outers = [[[g["lon"], g["lat"]] for g in m.get("geometry", [])] for m in el.get("members", []) if m.get("role") in ("outer", "") and m.get("geometry")]
            for ring in join_rings(outers):
                if inside(ring):
                    feats.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": dict(props)})
    for path in extra_files:
        feats.extend(load_geojson_layout(path))
    return {"type": "FeatureCollection", "features": feats}


# ---------------------------------------------------------------------------
# Source 2: your own GeoJSON (traced on geojson.io, exported from QGIS, downloaded from GitHub ...)
# ---------------------------------------------------------------------------
def load_geojson_layout(src, offline=False):
    gj = json.loads(fetch_bytes(src, offline).decode("utf-8"))
    out = []
    for ft in (gj.get("features", []) if gj.get("type") == "FeatureCollection" else [gj]):
        pr = dict(ft.get("properties") or {})
        lvl = pr.get("level", pr.get("floor", pr.get("ordinal")))
        if ft.get("geometry") is None or lvl in (None, ""):
            print("  skipped a feature without geometry or level in " + str(src), file=sys.stderr)
            continue
        pr["level"] = norm_level(lvl)
        pr["kind"] = str(pr.get("kind") or pr.get("indoor") or pr.get("category") or "room")
        pr["name"] = str(pr.get("name") or pr.get("ref") or "")
        pr["source"] = "file: " + str(src).split("/")[-1]
        out.append({"type": "Feature", "geometry": ft["geometry"], "properties": pr})
    return out


# ---------------------------------------------------------------------------
# Source 3: IMDF (Apple's Indoor Mapping Data Format, the format venues publish indoor maps in).
# A .zip or a folder with level.geojson, unit.geojson, opening.geojson, amenity.geojson, occupant.geojson,
# anchor.geojson. Already georeferenced (WGS84). Floors come from each level's "ordinal".
# ---------------------------------------------------------------------------
def load_imdf(src, offline=False):
    import io, zipfile
    files = {}
    p = Path(str(src))
    if not str(src).startswith(("http://", "https://")) and p.is_dir():
        for f in p.glob("*.geojson"):
            files[f.name.lower()] = json.loads(f.read_text(encoding="utf-8"))
    else:
        with zipfile.ZipFile(io.BytesIO(fetch_bytes(src, offline))) as z:
            for n in z.namelist():
                if n.lower().endswith(".geojson"):
                    files[n.split("/")[-1].lower()] = json.loads(z.read(n).decode("utf-8"))
    get = lambda n: files.get(n + ".geojson", {}).get("features", [])
    label = lambda nm: (nm or {}).get("en") or next(iter((nm or {}).values()), "") if isinstance(nm, dict) else (nm or "")
    levels = {f["id"]: f["properties"] for f in get("level")}
    lvl = lambda lid: norm_level(levels.get(lid, {}).get("ordinal", "0"))
    anchors = {f["id"]: f["properties"].get("unit_id") for f in get("anchor")}
    occ = {}
    for f in get("occupant"):
        u = anchors.get(f["properties"].get("anchor_id"))
        if u: occ[u] = label(f["properties"].get("name"))
    out, tag = [], "IMDF: " + str(src).split("/")[-1]
    for f in get("unit"):
        pr = f["properties"]
        if f.get("geometry") and pr.get("level_id") in levels:
            name = label(pr.get("name")) or occ.get(f["id"], "")
            out.append({"type": "Feature", "geometry": f["geometry"], "properties": {"level": lvl(pr["level_id"]), "kind": pr.get("category", "room"),
                        "name": name, "name_ar": (pr.get("name") or {}).get("ar", "") if isinstance(pr.get("name"), dict) else "", "source": tag}})
    for f in get("opening"):
        pr = f["properties"]
        if f.get("geometry") and pr.get("level_id") in levels:
            out.append({"type": "Feature", "geometry": f["geometry"], "properties": {"level": lvl(pr["level_id"]), "kind": "door", "name": "", "source": tag}})
    units = {f["id"]: f["properties"].get("level_id") for f in get("unit")}
    for f in get("amenity"):
        pr = f["properties"]; uid = (pr.get("unit_ids") or [None])[0]
        if f.get("geometry") and units.get(uid) in levels:
            out.append({"type": "Feature", "geometry": f["geometry"], "properties": {"level": lvl(units[uid]), "kind": pr.get("category", "amenity"),
                        "name": label(pr.get("name")), "source": tag}})
    return out


# ---------------------------------------------------------------------------
# Source 4: DALIL Mapper exports (dalil-map_<building>_<floor>.json) aligned with the Mapper's World position
# (`geo`: origin, bearing, scale). Walls become lines, places become labelled points, on their floor.
# ---------------------------------------------------------------------------
def geo_transform(geo):
    lng0, lat0 = geo["origin"]; b = math.radians(geo["bearing"]); k = geo.get("scale") or 1
    mlng = 111412.84 * math.cos(math.radians(lat0)); mlat = 111132.92 - 559.82 * math.cos(2 * math.radians(lat0))
    def T(x, y):
        e = k * (x * math.cos(b) + y * math.sin(b)); n = k * (-x * math.sin(b) + y * math.cos(b))
        return [round(lng0 + e / mlng, 8), round(lat0 + n / mlat, 8)]
    return T


def load_dalil_map(src, level=None, offline=False):
    m = json.loads(fetch_bytes(src, offline).decode("utf-8"))
    if not m.get("geo"):
        raise RuntimeError("{} has no world position: set it in the DALIL Mapper (World position) and export again".format(src))
    T = geo_transform(m["geo"])
    floor = m.get("floor") or {}
    lv = norm_level(level if level is not None else floor.get("level", floor.get("ordinal", floor.get("id", "0"))))
    tag = "DALIL map: " + (m.get("building", {}).get("name") or str(src).split("/")[-1])
    out = []
    for w in (m.get("plan") or {}).get("walls", []):
        if len(w) >= 2:
            out.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": [T(x, y) for x, y in w]}, "properties": {"level": lv, "kind": "wall", "name": "", "source": tag}})
    for p in m.get("points", []):
        if p.get("virtual"): continue
        out.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": T(p["x"], p["y"])},
                    "properties": {"level": lv, "kind": p.get("category", "room"), "name": p.get("nameEn", ""), "name_ar": p.get("nameAr", ""), "source": tag}})
    return out


# ---------------------------------------------------------------------------
# Source 5: a floor-plan picture (PNG/JPG: a scan, a photo of the evacuation plan, an image from a website you
# may use) placed on the map with control points: pixel (x, y) -> (lng, lat). 2 points = move/rotate/scale,
# 3 or more = affine fit (least squares) with the error reported in metres.
# ---------------------------------------------------------------------------
def image_size(data):
    import struct
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data):
            if data[i] != 0xFF: i += 1; continue
            marker = data[i + 1]; size = struct.unpack(">H", data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", data[i + 5:i + 9]); return w, h
            i += 2 + size
    raise ValueError("only PNG and JPEG pictures are supported")


def fit_image(points):
    """points: [(px, py, lng, lat), ...] -> (f(px, py) -> [lng, lat], rms metres)."""
    if len(points) < 2:
        raise ValueError("give at least 2 control points: px,py,lng,lat;px,py,lng,lat")
    loc = [(px, py) + to_local(lng, lat) for px, py, lng, lat in points]
    if len(loc) == 2:  # similarity: image y points down, map y points up
        (x1, y1, X1, Y1), (x2, y2, X2, Y2) = loc
        a = complex(x2 - x1, -(y2 - y1)); A = complex(X2 - X1, Y2 - Y1)
        if abs(a) == 0: raise ValueError("the two control points are the same pixel")
        s = A / a
        f = lambda x, y: (complex(X1, Y1) + s * complex(x - x1, -(y - y1)))
        mf = lambda x, y: (f(x, y).real, f(x, y).imag)
    else:  # affine least squares: X = a x + b y + c, Y = d x + e y + g
        def solve(target):
            M = [[0.0] * 3 for _ in range(3)]; v = [0.0] * 3
            for x, y, X, Y in loc:
                r = (x, y, 1.0); t = X if target == 0 else Y
                for i in range(3):
                    v[i] += r[i] * t
                    for j in range(3): M[i][j] += r[i] * r[j]
            for i in range(3):  # Gauss-Jordan
                piv = max(range(i, 3), key=lambda k: abs(M[k][i]))
                M[i], M[piv] = M[piv], M[i]; v[i], v[piv] = v[piv], v[i]
                if abs(M[i][i]) < 1e-12: raise ValueError("control points are in a line: spread them out")
                for k in range(3):
                    if k != i:
                        c = M[k][i] / M[i][i]
                        for j in range(3): M[k][j] -= c * M[i][j]
                        v[k] -= c * v[i]
            return [v[i] / M[i][i] for i in range(3)]
        ca, cb = solve(0), solve(1)
        mf = lambda x, y: (ca[0] * x + ca[1] * y + ca[2], cb[0] * x + cb[1] * y + cb[2])
    err = [math.hypot(mf(x, y)[0] - X, mf(x, y)[1] - Y) for x, y, X, Y in loc]
    rms = math.sqrt(sum(e * e for e in err) / len(err))
    to_ll = lambda X, Y: [round(LNG0 + X / (M_PER_DEG_LNG * _K), 8), round(LAT0 + Y / M_PER_DEG_LAT, 8)]
    return (lambda x, y: to_ll(*mf(x, y))), rms


def load_plan_image(src, level, points_text, name="", offline=False):
    import base64
    data = fetch_bytes(src, offline)
    w, h = image_size(data)
    pts = [tuple(float(v) for v in p.split(",")) for p in points_text.split(";") if p.strip()]
    if any(len(p) != 4 for p in pts):
        raise ValueError("control points are px,py,lng,lat separated by ';'")
    f, rms = fit_image(pts)
    mime = "image/png" if data[:4] == b"\x89PNG" else "image/jpeg"
    if len(data) > 8e6:
        print("  warning: {} is {:.1f} MB; the page embeds it, so it will be slow. Shrink it first.".format(src, len(data) / 1e6), file=sys.stderr)
    return {"level": norm_level(level), "name": name or str(src).split("/")[-1], "rms_m": round(rms, 2),
            "coordinates": [f(0, 0), f(w, 0), f(w, h), f(0, h)],  # top-left, top-right, bottom-right, bottom-left
            "url": "data:{};base64,{}".format(mime, base64.b64encode(data).decode())}


def write_indoor_template():

    lng, lat = CAMPUS["center"]
    d = 0.00012
    def sq(o, a):
        return [[lng + o, lat + a], [lng + o + d, lat + a], [lng + o + d, lat + a + d], [lng + o, lat + a + d], [lng + o, lat + a]]
    gj = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"level": "0", "kind": "room", "name": "EXAMPLE room - delete me", "example": True},
         "geometry": {"type": "Polygon", "coordinates": [sq(0, 0)]}},
        {"type": "Feature", "properties": {"level": "0", "kind": "corridor", "name": "", "example": True},
         "geometry": {"type": "Polygon", "coordinates": [sq(d, 0)]}},
        {"type": "Feature", "properties": {"level": "1", "kind": "room", "name": "EXAMPLE room, floor 1 - delete me", "example": True},
         "geometry": {"type": "Polygon", "coordinates": [sq(0, 0)]}},
    ]}
    out = HERE / "uos_indoor_template.geojson"
    out.write_text(json.dumps(gj, indent=2), encoding="utf-8")
    print("Wrote " + str(out))
    print("Replace the examples with your real rooms. Trace them on https://geojson.io (draw polygons,")
    print("then add properties: level = \"0\", \"1\", \"-1\" ...; kind = room | corridor | stairs | toilets ...;")
    print("name = the room label). Then run: python campus_map_mapbox.py --indoor-file your_file.geojson")


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
  select:disabled { opacity:.5; }
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
  .dir { list-style:none; margin:0; padding:0; max-height:180px; overflow:auto; border:1px solid #23272d; border-radius:8px; }
  .dir button { width:100%; text-align:start; background:none; border:0; border-bottom:1px solid #1d2026; padding:7px 10px; cursor:pointer; display:grid; grid-template-columns:3.2em 1fr; gap:8px; }
  .dir button:hover { background:var(--bg3); } .dir .code { font:600 12px var(--mono); color:var(--accent); } .dir .off { color:var(--fg3); } .dir small { display:block; color:var(--fg3); }
  .hint { color:var(--fg3); font-size:13px; margin:0; } #status { min-height:1.4em; color:var(--fg2); font-size:13px; margin:0; } #status.err { color:var(--err); }
  .note { border:1px solid #2a2e35; border-radius:8px; padding:8px 10px; color:var(--fg2); font-size:13px; background:var(--bg2); }
  #toggle { position:fixed; z-index:6; top:16px; left:16px; }
  #alert { position:fixed; z-index:9; left:50%; bottom:16px; transform:translateX(-50%); width:min(640px,calc(100% - 32px)); background:#2a1512; border:1px solid var(--err); border-radius:10px; padding:12px 14px; display:flex; gap:12px; align-items:flex-start; }
  #alert[hidden] { display:none; } #alert p { margin:0; flex:1; white-space:pre-line; }
  #gate, #gGate { position:fixed; inset:0; z-index:10; display:grid; place-items:center; padding:16px; background:var(--bg); }
  #gGate { background:rgba(11,12,14,.86); }
  #gate[hidden], #gGate[hidden] { display:none; }
  .card { width:min(480px,100%); background:var(--bg2); border:1px solid #2a2e35; border-radius:14px; padding:22px; display:grid; gap:14px; }
  .card h2 { margin:0; font-size:20px; } .card p { margin:0; color:var(--fg2); }
  .card input { width:100%; background:var(--bg3); border:1px solid var(--edge); border-radius:8px; padding:9px 10px; }
  #gateErr, #gGateErr { color:var(--err); } .readout { font:500 13px var(--mono); }
  #googleLogo { position:fixed; z-index:4; left:12px; bottom:12px; font:700 18px/1 Arial, sans-serif; color:#fff; text-shadow:0 0 3px rgba(0,0,0,.9); pointer-events:none; }
  #googleLogo[hidden] { display:none; }
  @media (max-width:640px) { .panel { top:auto; bottom:0; left:0; right:0; width:auto; max-height:52%; border-radius:14px 14px 0 0; } #toggle { top:auto; bottom:16px; } #googleLogo { bottom:auto; top:12px; } }
</style>
</head>
<body>
<div id="map" role="application" aria-label="3D map of the University of Sharjah campus"></div>
<div id="googleLogo" hidden>Google</div>

<aside class="panel" id="panel" aria-label="Campus controls" hidden>
  <header>
    <div class="top"><p class="eyebrow">Study area · prototype</p><button class="btn" id="hide" style="padding:2px 10px">Hide</button></div>
    <h1>University of Sharjah <span lang="ar" dir="rtl">جامعة الشارقة</span></h1>
  </header>
  <div class="body">
    <div class="stat" id="stats" aria-live="polite"></div>
    <div><label for="base">Base map</label><select id="base"></select>
      <p class="hint" id="baseInfo" style="margin-top:6px"></p></div>
    <div><label for="from">From</label><select id="from"></select></div>
    <div><label for="to">To</label><select id="to"></select></div>
    <div class="row"><button class="btn" id="swap">Swap</button><button class="btn" id="clear">Clear route</button></div>
    <p class="hint" id="routeInfo">Pick two places to get a walking route.</p>
    <div class="row">
      <button class="btn primary" id="tour" aria-pressed="false">Fly the campus</button>
      <button class="btn" id="top" aria-pressed="false">Top view</button>
    </div>
    <div><label for="light">Light (Mapbox Standard only)</label>
      <select id="light"><option value="day">Day</option><option value="dusk">Dusk</option><option value="dawn">Dawn</option><option value="night">Night</option></select></div>
    <div class="checks" role="group" aria-label="Layers">
      <label><input type="checkbox" id="lyBoundary" checked> Boundary</label>
      <label><input type="checkbox" id="lyBuildings" checked> Buildings</label>
      <label><input type="checkbox" id="lyLabels" checked> Labels</label>
      <label><input type="checkbox" id="lyIndoor" checked> Indoor maps</label>
    </div>
    <div><span class="lbl" id="placesLbl">Named places</span><ul id="places" aria-labelledby="placesLbl"></ul></div>
    <div><span class="lbl" id="dirLbl">Buildings (official campus map)</span><ul id="directory" class="dir" aria-labelledby="dirLbl"></ul>
      <p class="hint" id="dirInfo" style="margin-top:6px"></p></div>
    <div><span class="lbl">Pick coordinates</span>
      <div class="row"><span class="readout" id="coords">Click the map</span><button class="btn" id="copy">Copy</button></div></div>
    <div><span class="lbl" id="floorsLbl">Indoor layouts</span>
      <div class="row" id="floors" role="group" aria-labelledby="floorsLbl"></div>
      <p class="hint" id="indoorInfo" style="margin-top:6px"></p></div>
    <p class="note"><b>Mapbox floors:</b> Mapbox's built-in indoor floor plans cover supported venues such as airports. The floor selector (top right) fills in only where Mapbox has indoor data, and only on the Mapbox Standard base maps. For this campus it stays empty until you add your own indoor data.</p>
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

<section id="gGate" hidden aria-labelledby="gGateTitle">
  <form class="card" id="gGateForm">
    <p class="eyebrow">Google base maps</p>
    <h2 id="gGateTitle">Add your Google Maps key</h2>
    <p>Google maps come through Google's official <b>Map Tiles API</b>. Paste a Google Maps Platform key with "Map Tiles API" enabled (and billing set up in Google Cloud). It stays in this browser only. Restrict it to this page's address in Google Cloud.</p>
    <div><label for="gtok">Google Maps key</label><input id="gtok" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…"></div>
    <p id="gGateErr" role="alert"></p>
    <div class="row"><button class="btn primary" type="submit">Use Google maps</button><button class="btn" type="button" id="gCancel">Cancel</button></div>
  </form>
</section>

<script>
const DATA = /*__DATA__*/null;
const EMBEDDED_TOKEN = "__TOKEN__";
const EMBEDDED_GOOGLE_KEY = "__GOOGLE_KEY__";
const START_BASE = "__BASE__";
const $ = (id) => document.getElementById(id);
const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOME = { center: DATA.campus.center, zoom: 16.2, pitch: 60, bearing: 25 };
const GLOW = '#8BF5B0', ACCENT = '#FFC700';
const S = { map: null, pois: [], from: null, to: null, route: null, routeCoords: null, lastClick: null, touring: false, raf: 0, indoor: null,
            base: null, standard: true, level: null, layerVis: { boundary: true, buildings: true, labels: true } };

/* ---------- base maps ----------
   Every base map is a Mapbox GL style. Raster tile services become a small style with one raster source
   (plus label overlays); the campus layers are added on top again after every switch (onStyle). */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const ESRI_ATTR = 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, HERE, Garmin, OpenStreetMap contributors, GIS User Community';
const CARTO_ATTR = '© OpenStreetMap contributors © CARTO';
const BASEMAPS = [
  { id: 'standard', group: 'Mapbox', name: 'Mapbox Standard (3D, indoor, light)', style: 'mapbox://styles/mapbox/standard', standard: true },
  { id: 'standard-satellite', group: 'Mapbox', name: 'Mapbox Standard Satellite', style: 'mapbox://styles/mapbox/standard-satellite', standard: true },
  { id: 'mb-satellite-streets', group: 'Mapbox', name: 'Mapbox Satellite Streets', style: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'mb-streets', group: 'Mapbox', name: 'Mapbox Streets', style: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'mb-outdoors', group: 'Mapbox', name: 'Mapbox Outdoors', style: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'mb-light', group: 'Mapbox', name: 'Mapbox Light', style: 'mapbox://styles/mapbox/light-v11' },
  { id: 'mb-dark', group: 'Mapbox', name: 'Mapbox Dark', style: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'mb-nav-night', group: 'Mapbox', name: 'Mapbox Navigation Night', style: 'mapbox://styles/mapbox/navigation-night-v1' },
  { id: 'google-roadmap', group: 'Google (Map Tiles API key)', name: 'Google Maps (roads)', google: { mapType: 'roadmap' } },
  { id: 'google-satellite', group: 'Google (Map Tiles API key)', name: 'Google Satellite', google: { mapType: 'satellite' } },
  { id: 'google-hybrid', group: 'Google (Map Tiles API key)', name: 'Google Satellite + labels', google: { mapType: 'satellite', layerTypes: ['layerRoadmap'] } },
  { id: 'google-terrain', group: 'Google (Map Tiles API key)', name: 'Google Terrain', google: { mapType: 'terrain', layerTypes: ['layerRoadmap'] } },
  { id: 'esri-imagery', group: 'Esri', name: 'Esri World Imagery (satellite)', tiles: [ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'], attr: ESRI_ATTR, maxzoom: 19 },
  { id: 'esri-imagery-labels', group: 'Esri', name: 'Esri Imagery + labels', tiles: [ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'], attr: ESRI_ATTR, maxzoom: 19,
    overlays: [ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'] },
  { id: 'esri-street', group: 'Esri', name: 'Esri World Street Map', tiles: [ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}'], attr: ESRI_ATTR, maxzoom: 19 },
  { id: 'esri-topo', group: 'Esri', name: 'Esri World Topographic', tiles: [ESRI + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], attr: ESRI_ATTR, maxzoom: 19 },
  { id: 'esri-gray', group: 'Esri', name: 'Esri Light Gray', tiles: [ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], attr: ESRI_ATTR, maxzoom: 16 },
  { id: 'osm', group: 'Open data', name: 'OpenStreetMap', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attr: '© OpenStreetMap contributors', maxzoom: 19 },
  { id: 'carto-light', group: 'Open data', name: 'CARTO Light (Positron)', tiles: ['a', 'b', 'c'].map((s) => 'https://' + s + '.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'), attr: CARTO_ATTR, maxzoom: 20 },
  { id: 'carto-dark', group: 'Open data', name: 'CARTO Dark (Dark Matter)', tiles: ['a', 'b', 'c'].map((s) => 'https://' + s + '.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'), attr: CARTO_ATTR, maxzoom: 20 },
  { id: 'carto-voyager', group: 'Open data', name: 'CARTO Voyager', tiles: ['a', 'b', 'c'].map((s) => 'https://' + s + '.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'), attr: CARTO_ATTR, maxzoom: 20 },
  { id: 'opentopomap', group: 'Open data', name: 'OpenTopoMap', tiles: ['a', 'b', 'c'].map((s) => 'https://' + s + '.tile.opentopomap.org/{z}/{x}/{y}.png'), attr: '© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)', maxzoom: 17 },
];
const baseById = (id) => BASEMAPS.find((b) => b.id === id) || BASEMAPS[0];

function rasterStyle(b, tiles, attr, tileSize) {
  const src = (t, a) => Object.assign({ type: 'raster', tiles: t, tileSize: tileSize || 256, maxzoom: b.maxzoom || 22 }, a ? { attribution: a } : {});
  const style = { version: 8, glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf', sources: { base: src(tiles, attr) },
                  layers: [{ id: 'base', type: 'raster', source: 'base' }] };
  (b.overlays || []).forEach((u, i) => { style.sources['ov' + i] = src([u]); style.layers.push({ id: 'ov' + i, type: 'raster', source: 'ov' + i }); });
  return style;
}

function googleKey() { return EMBEDDED_GOOGLE_KEY || safe(() => localStorage.getItem('google-maps-key'), '') || ''; }
const googleSessions = {};
async function googleStyle(b) {
  const key = googleKey();
  if (!key) throw Object.assign(new Error('needs a Google key'), { needKey: true });
  const cacheKey = JSON.stringify(b.google);
  let s = googleSessions[cacheKey];
  if (!s || Date.now() > s.until) {
    // https://developers.google.com/maps/documentation/tile/session_tokens
    const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ language: 'en-US', region: 'AE', scale: 'scaleFactor2x', highDpi: true }, b.google)) });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error('Google answered HTTP ' + r.status + (r.status === 403 ? ' (enable "Map Tiles API" and billing for this key, and allow this page’s address)' : '') + (txt ? ': ' + txt.slice(0, 160) : ''));
    }
    const j = await r.json();
    s = googleSessions[cacheKey] = { id: j.session, until: Date.now() + 10 * 24 * 3600e3 };
  }
  return rasterStyle(b, ['https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=' + encodeURIComponent(s.id) + '&key=' + encodeURIComponent(key)],
                     'Map data © Google', 256);
}

async function styleFor(b) {
  if (b.style) return b.style;
  if (b.google) return googleStyle(b);
  return rasterStyle(b, b.tiles, b.attr, 256);
}

async function setBase(id, { first = false } = {}) {
  const b = baseById(id);
  let style;
  try { style = await styleFor(b); }
  catch (e) {
    if (e.needKey) { askGoogleKey(id); return false; }
    alertBanner('Could not switch to ' + b.name + ': ' + e.message);
    $('base').value = S.base || 'standard';
    return false;
  }
  S.base = b.id; S.standard = !!b.standard;
  safe(() => localStorage.setItem('campus-base', b.id));
  $('base').value = b.id;
  $('light').disabled = !S.standard;
  $('googleLogo').hidden = !b.google;
  $('baseInfo').textContent = b.google ? 'Google Map Tiles API. Google logo and data credit must stay visible.'
    : b.tiles ? 'Free tiles with attribution, for light use (shown bottom right).' : S.standard ? '3D buildings, light presets and Mapbox indoor floors available.' : '';
  if (!first) S.map.setStyle(style, { diff: false }); // onStyle adds the campus layers back
  return style;
}

function initBaseSelect() {
  const sel = $('base'); let group = null, og = null;
  BASEMAPS.forEach((b) => {
    if (b.group !== group) { group = b.group; og = document.createElement('optgroup'); og.label = group; sel.appendChild(og); }
    og.appendChild(new Option(b.name, b.id));
  });
  sel.addEventListener('change', () => setBase(sel.value));
}

let pendingGoogle = null;
function askGoogleKey(id) { pendingGoogle = id; $('gGateErr').textContent = ''; $('gGate').hidden = false; $('base').value = S.base || 'standard'; setTimeout(() => $('gtok').focus(), 0); }
$('gGateForm').addEventListener('submit', async (ev) => {
  ev.preventDefault(); const k = $('gtok').value.trim();
  if (!/^AIza[0-9A-Za-z_\-]{20,}$/.test(k)) { $('gGateErr').textContent = 'That does not look like a Google Maps key (it starts with AIza).'; return; }
  safe(() => localStorage.setItem('google-maps-key', k)); $('gGate').hidden = true;
  if (pendingGoogle) setBase(pendingGoogle);
});
$('gCancel').addEventListener('click', () => { $('gGate').hidden = true; pendingGoogle = null; });

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

async function start(token) {
  $('gate').hidden = true; $('panel').hidden = false;
  mapboxgl.accessToken = token;
  if (mapboxgl.setRTLTextPlugin) safe(() => mapboxgl.setRTLTextPlugin(
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js', null, true));
  if (!$('base').options.length) initBaseSelect();
  const wanted = new URLSearchParams(location.search).get('base') || safe(() => localStorage.getItem('campus-base'), '') || START_BASE || 'standard';
  let style = await setBase(baseById(wanted).id, { first: true });
  if (!style) style = await setBase('standard', { first: true }); // e.g. a Google map remembered but no key here
  const map = S.map = new mapboxgl.Map({
    container: 'map', style,
    center: HOME.center, zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing,
    minZoom: 12,
    config: S.standard ? { basemap: { showIndoor: true, lightPreset: 'day' } } : undefined
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
    if (e && e.tile) return; // a missing tile on a raster base map is not worth a banner
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
  if (S.standard) {
    safe(() => map.setConfigProperty('basemap', 'show3dObjects', false)); // our blocks replace the basemap's, no overlap
    safe(() => map.setConfigProperty('basemap', 'showIndoor', $('lyIndoor').checked));
    safe(() => map.setConfigProperty('basemap', 'lightPreset', $('light').value));
  }
  map.addSource('campus-boundary', { type: 'geojson', data: DATA.campus.boundaryGeojson });
  map.addSource('campus-buildings', { type: 'geojson', data: DATA.buildings });
  map.addSource('campus-pois', { type: 'geojson', data: DATA.pois });
  map.addSource('campus-indoor', { type: 'geojson', data: DATA.indoor });
  map.addSource('route', { type: 'geojson', data: emptyFc() });
  map.addSource('walker', { type: 'geojson', data: emptyFc() });
  map.addSource('ends', { type: 'geojson', data: emptyFc() });

  const failed = [];
  // Slots only exist in the Mapbox Standard styles; on other base maps layers simply stack in order.
  const addLayer = (l) => { if (!S.standard) { l = Object.assign({}, l); delete l.slot; } try { map.addLayer(l); } catch (e) { failed.push(l.id); console.error('addLayer ' + l.id, e); } };
  addLayer({ id: 'boundary-fill', type: 'fill', slot: 'middle', source: 'campus-boundary',
    paint: { 'fill-color': ACCENT, 'fill-opacity': 0.06, 'fill-emissive-strength': 1 } });
  addLayer({ id: 'boundary-line', type: 'line', slot: 'middle', source: 'campus-boundary',
    paint: { 'line-color': ACCENT, 'line-width': 3, 'line-emissive-strength': 1 } });
  addLayer({ id: 'buildings', type: 'fill-extrusion', slot: 'middle', source: 'campus-buildings',
    paint: {
      'fill-extrusion-color': ['case', ['get', 'named'], ACCENT, '#7e8da0'],
      'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': S.level !== null ? 0.12 : 0.72, 'fill-extrusion-emissive-strength': 0.4 } });
  const kindColor = ['match', ['get', 'kind'], 'corridor', '#5b6b7c', 'stairs', '#8BF5B0', 'toilets', '#7aa7ff', 'area', '#3a4656', ACCENT];
  addLayer({ id: 'indoor-fill', type: 'fill', slot: 'top', source: 'campus-indoor', layout: { visibility: 'none' },
    paint: { 'fill-color': kindColor, 'fill-opacity': 0.55, 'fill-emissive-strength': 1 } });
  addLayer({ id: 'indoor-outline', type: 'line', slot: 'top', source: 'campus-indoor', layout: { visibility: 'none' },
    paint: { 'line-color': '#F2F1EC', 'line-width': 1.2, 'line-emissive-strength': 1 } });
  addLayer({ id: 'indoor-points', type: 'circle', slot: 'top', source: 'campus-indoor', layout: { visibility: 'none' }, filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 17, 3, 20, 7], 'circle-color': ['match', ['get', 'kind'], 'door', '#F2F1EC', 'entrance', ACCENT, 'elevator', '#8BF5B0', 'stairs', '#8BF5B0', '#7aa7ff'],
             'circle-stroke-color': '#0B0C0E', 'circle-stroke-width': 1.5, 'circle-emissive-strength': 1 } });
  (DATA.planImages || []).forEach((im, i) => {
    map.addSource('plan-img-' + i, { type: 'image', url: im.url, coordinates: im.coordinates });
    addLayer({ id: 'plan-img-' + i, type: 'raster', slot: 'middle', source: 'plan-img-' + i, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 } });
  });
  addLayer({ id: 'indoor-labels', type: 'symbol', slot: 'top', source: 'campus-indoor', minzoom: 17.5,
    layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-optional': true },
    paint: { 'text-color': '#F2F1EC', 'text-halo-color': '#0B0C0E', 'text-halo-width': 1.4, 'text-emissive-strength': 1 } });
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
  initPanel();
  // After a base-map switch: put back what the visitor had (layer checkboxes, indoor level, route).
  const vis = (layers, on) => layers.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'));
  vis(['boundary-fill', 'boundary-line'], $('lyBoundary').checked); vis(['buildings'], $('lyBuildings').checked); vis(['labels'], $('lyLabels').checked);
  if (S.level !== null) setLevel(S.level, { noFly: true });
  drawEnds();
  if (S.routeCoords) { map.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: S.routeCoords } }); if (!reduceMotion) animateWalker(S.routeCoords, routeToken); }
}

const emptyFc = () => ({ type: 'FeatureCollection', features: [] });

let panelReady = false;
function initPanel() {
  if (panelReady) return; panelReady = true;
  const map = S.map; // label clicks: registered once, they keep working across base-map switches
  map.on('click', 'labels', (e) => { const p = S.pois.find((q) => q.id === e.features[0].properties.id); if (p) choose(p); });
  map.on('mouseenter', 'labels', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'labels', () => (map.getCanvas().style.cursor = ''));
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
  initIndoor(); initDirectory();
  $('credit').textContent = DATA.campus.source + ' · base map credits bottom right';
  $('swap').onclick = () => { [S.from, S.to] = [S.to, S.from]; syncSelects(); updateRoute(); };
  $('clear').onclick = () => { S.from = S.to = null; syncSelects(); updateRoute(); setStatus(''); };
  $('tour').onclick = () => (S.touring ? stopTour() : runTour());
  $('top').onclick = () => {
    const on = $('top').getAttribute('aria-pressed') !== 'true'; $('top').setAttribute('aria-pressed', String(on));
    camera({ pitch: on ? 0 : HOME.pitch, bearing: on ? 0 : HOME.bearing }, 900);
  };
  $('light').onchange = () => { if (S.standard) safe(() => S.map.setConfigProperty('basemap', 'lightPreset', $('light').value)); };
  const vis = (layers, on) => layers.forEach((l) => S.map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'));
  $('lyBoundary').onchange = (e) => vis(['boundary-fill', 'boundary-line'], e.target.checked);
  $('lyBuildings').onchange = (e) => vis(['buildings'], e.target.checked);
  $('lyLabels').onchange = (e) => vis(['labels'], e.target.checked);
  $('lyIndoor').onchange = (e) => {
    if (S.standard) safe(() => S.map.setConfigProperty('basemap', 'showIndoor', e.target.checked));
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

function initDirectory() {
  const rows = DATA.directory || [], ul = $('directory');
  rows.forEach((r) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    const c = document.createElement('span'); c.className = 'code'; c.textContent = r.code;
    const n = document.createElement('span'); n.textContent = r.name; if (!r.at) n.className = 'off';
    if (r.inside || r.name_ar) { const sm = document.createElement('small'); sm.textContent = [r.name_ar, r.inside].filter(Boolean).join(' · '); n.appendChild(sm); }
    b.append(c, n);
    b.onclick = () => r.at ? camera({ center: r.at, zoom: 18.3, pitch: 60 }, 1400) : setStatus(r.code + ' is not placed on the map yet: no OpenStreetMap footprint carries ref=' + r.code + ' or its name.');
    li.appendChild(b); ul.appendChild(li);
  });
  const placed = rows.filter((r) => r.at).length;
  $('dirInfo').textContent = rows.length ? placed + ' of ' + rows.length + ' buildings placed on the map (' + DATA.directorySource + '). The campus map lists buildings, not rooms.' : '';
}

const INDOOR_LAYERS = ['indoor-fill', 'indoor-outline', 'indoor-labels', 'indoor-points'];
function initIndoor() {
  const feats = DATA.indoor.features, box = $('floors'), imgs = DATA.planImages || [];
  if (!feats.length && !imgs.length) {
    $('indoorInfo').textContent = 'No indoor layouts yet. OpenStreetMap has none tagged for this campus, and Mapbox’s own indoor data does not cover it. Add your rooms with --indoor-file (run the script with --make-indoor-template for the format).';
    return;
  }
  const levels = Array.from(new Set(feats.map((f) => String(f.properties.level)).concat(imgs.map((im) => String(im.level))))).sort((a, b) => parseFloat(a) - parseFloat(b));
  const bySource = {}; feats.forEach((f) => { bySource[f.properties.source] = (bySource[f.properties.source] || 0) + 1; });
  const parts = Object.entries(bySource).map(([k, n]) => n + ' from ' + k).concat(imgs.map((im) => 'plan picture "' + im.name + '" (fit error ' + im.rms_m + ' m)'));
  const named = feats.filter((f) => f.properties.name).length;
  $('indoorInfo').textContent = feats.length + ' indoor shapes (' + named + ' labelled) on ' + levels.length + ' level' + (levels.length > 1 ? 's' : '') + ': ' + parts.join('; ') + '. Pick a level, then zoom in.';
  const mk = (label, lvl) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label;
    b.setAttribute('aria-pressed', String(lvl === null)); b.dataset.level = lvl === null ? '' : lvl; b.onclick = () => setLevel(lvl); box.appendChild(b); };
  mk('Outdoor', null); levels.forEach((l) => mk('Level ' + l, l));
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn'; go.textContent = 'Go to indoor data'; go.onclick = fitIndoor; box.appendChild(go);
}
function indoorBounds() {
  const bb = new mapboxgl.LngLatBounds(); let any = false;
  const walk = (c) => { if (typeof c[0] === 'number') { bb.extend(c); any = true; } else c.forEach(walk); };
  DATA.indoor.features.forEach((f) => walk(f.geometry.coordinates)); (DATA.planImages || []).forEach((im) => walk(im.coordinates)); return any ? bb : null;
}
function fitIndoor() { const bb = indoorBounds(); if (bb) S.map.fitBounds(bb, { padding: 80, maxZoom: 19.5, pitch: 45, duration: reduceMotion ? 0 : 1200 }); }
function setLevel(lvl, { noFly = false } = {}) {
  const map = S.map, on = lvl !== null, f = ['==', ['to-string', ['get', 'level']], on ? lvl : ''];
  S.level = lvl;
  map.setFilter('indoor-fill', ['all', f, ['==', ['geometry-type'], 'Polygon']]);
  map.setFilter('indoor-outline', f); map.setFilter('indoor-labels', f);
  INDOOR_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'));
  (DATA.planImages || []).forEach((im, i) => map.getLayer('plan-img-' + i) && map.setLayoutProperty('plan-img-' + i, 'visibility', on && String(im.level) === lvl ? 'visible' : 'none'));
  map.setPaintProperty('buildings', 'fill-extrusion-opacity', on ? 0.12 : 0.72); // see through the blocks to the floor
  document.querySelectorAll('#floors button[data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === (on ? lvl : ''))));
  if (on && !noFly && map.getZoom() < 17.5) fitIndoor();
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

function drawEnds() {
  const ends = [];
  if (S.from) ends.push({ type: 'Feature', properties: { color: GLOW }, geometry: { type: 'Point', coordinates: S.from.ll } });
  if (S.to) ends.push({ type: 'Feature', properties: { color: ACCENT }, geometry: { type: 'Point', coordinates: S.to.ll } });
  S.map.getSource('ends')?.setData({ type: 'FeatureCollection', features: ends });
}

let routeToken = 0;
async function updateRoute() {
  const map = S.map, token = ++routeToken; cancelAnimationFrame(S.raf);
  map.getSource('walker').setData(emptyFc());
  drawEnds();
  if (!S.from || !S.to) { S.routeCoords = null; map.getSource('route').setData(emptyFc()); $('routeInfo').textContent = 'Pick two places to get a walking route.'; return; }
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
  S.routeCoords = coords;
  map.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  $('routeInfo').textContent = note + ' The route ends at the building centre, not at an entrance.';
  const bounds = coords.reduce((bb, c) => bb.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
  if (!reduceMotion) map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: window.innerWidth > 640 ? 380 : 40, right: 40 }, pitch: 55, duration: 1200, maxZoom: 18 });
  if (!reduceMotion) animateWalker(coords, token);
}

function animateWalker(coords, token) {
  cancelAnimationFrame(S.raf);
  const total = lineLength(coords), t0 = performance.now();
  const step = (now) => {
    if (token !== routeToken || !S.map.getSource('walker')) return;
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


def build_page(token, gl_version, buildings, pois, source, indoor=None, google_key="", base="standard", plan_images=None, directory=None):
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
        "indoor": indoor or {"type": "FeatureCollection", "features": []},
        "planImages": plan_images or [],
        "directory": directory or [],
        "directorySource": DIRECTORY_SOURCE,
        "source": source,
    }
    # '</' is escaped so the data can never close the <script> tag early.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    clean = lambda s: "".join(ch for ch in s if ch.isalnum() or ch in "._-")  # keys/tokens only ever contain these
    return (PAGE.replace("/*__DATA__*/null", payload)
                .replace("__TOKEN__", clean(token))
                .replace("__GOOGLE_KEY__", clean(google_key))
                .replace("__BASE__", base if base in BASE_IDS else "standard")
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
    assert "__GOOGLE_KEY__" not in page and "__BASE__" not in page and "__TOKEN__" not in page
    # every base map id the page lists is known to Python (and the other way round)
    import re
    page_ids = re.findall(r"\{ id: '([a-z0-9-]+)', group:", PAGE)
    assert page_ids == BASE_IDS, (page_ids, BASE_IDS)
    # keys are embedded as plain key characters only, and an unknown --base falls back to standard
    pg = build_page('pk.a"b', "v3.35.0", b, p, "t", google_key="AIza<x>y", base="nope")
    assert 'const EMBEDDED_TOKEN = "pk.ab"' in pg and 'const EMBEDDED_GOOGLE_KEY = "AIzaxy"' in pg and 'const START_BASE = "standard"' in pg
    assert 'const START_BASE = "esri-imagery"' in build_page("pk.t", "v3.35.0", b, p, "t", base="esri-imagery")
    # Google tiles only through the official Map Tiles API
    assert "tile.googleapis.com/v1/createSession" in PAGE and "mt0.google" not in PAGE and "mt1.google" not in PAGE
    ind = process_indoor([
        {"type": "way", "id": 9, "tags": {"indoor": "room", "level": "1;2", "name": "Lab"},
         "geometry": [{"lat": a, "lon": o} for o, a in ring]},
        {"type": "way", "id": 10, "tags": {"indoor": "room"}, "geometry": [{"lat": a, "lon": o} for o, a in ring]},  # no level
    ])
    assert len(ind["features"]) == 1 and ind["features"][0]["properties"]["level"] == "1"
    assert norm_level(" -1 ") == "-1" and norm_level(2.0) == "2" and norm_level("0;1") == "0"
    assert "indoor-fill" in build_page("pk.t", "v3.35.0", b, p, "t", ind)
    # OSM indoor: nodes, doors, relations (multipolygon rooms from two ways), level outlines skipped
    half1 = [{"lat": a, "lon": o} for o, a in ring[:3]]; half2 = [{"lat": a, "lon": o} for o, a in ring[2:]]
    ind2 = process_indoor([
        {"type": "node", "id": 20, "lat": lat, "lon": lng, "tags": {"door": "hinged", "level": "0"}},
        {"type": "relation", "id": 21, "tags": {"type": "multipolygon", "indoor": "room", "level": "1", "ref": "M201"},
         "members": [{"role": "outer", "geometry": half1}, {"role": "outer", "geometry": half2}]},
        {"type": "way", "id": 22, "tags": {"indoor": "level", "level": "0"}, "geometry": [{"lat": a, "lon": o} for o, a in ring]},
        {"type": "way", "id": 23, "tags": {"buildingpart": "corridor", "level": "0"}, "geometry": [{"lat": a, "lon": o} for o, a in ring]},
    ])
    kinds = sorted((f["properties"]["kind"], f["geometry"]["type"], f["properties"]["name"]) for f in ind2["features"])
    assert kinds == [("corridor", "Polygon", ""), ("door", "Point", ""), ("room", "Polygon", "M201")], kinds
    # IMDF folder: a level, a named unit, an opening, an occupant through an anchor
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        poly = {"type": "Polygon", "coordinates": [[list(c) for c in ring]]}
        def w(n, feats): Path(td, n + ".geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
        w("level", [{"id": "L1", "type": "Feature", "geometry": poly, "properties": {"ordinal": 2, "name": {"en": "Level 3"}}}])
        w("unit", [{"id": "U1", "type": "Feature", "geometry": poly, "properties": {"level_id": "L1", "category": "classroom", "name": {"en": "Room 301", "ar": "قاعة 301"}}},
                   {"id": "U2", "type": "Feature", "geometry": poly, "properties": {"level_id": "L1", "category": "office", "name": None}}])
        w("opening", [{"id": "O1", "type": "Feature", "geometry": {"type": "LineString", "coordinates": [list(ring[0]), list(ring[1])]}, "properties": {"level_id": "L1"}}])
        w("anchor", [{"id": "A1", "type": "Feature", "geometry": {"type": "Point", "coordinates": list(ring[0])}, "properties": {"unit_id": "U2"}}])
        w("occupant", [{"id": "C1", "type": "Feature", "geometry": None, "properties": {"anchor_id": "A1", "name": {"en": "Dean's Office"}}}])
        im = load_imdf(td)
    assert sorted((f["properties"]["kind"], f["properties"]["name"], f["properties"]["level"]) for f in im) == \
        [("classroom", "Room 301", "2"), ("door", "", "2"), ("office", "Dean's Office", "2")]
    # DALIL Mapper export -> georeferenced walls and labelled places
    with tempfile.TemporaryDirectory() as td:
        mp = Path(td, "m.json"); mp.write_text(json.dumps({"geo": {"origin": [lng, lat], "bearing": 90, "scale": 1}, "floor": {"id": "level-1", "level": 1},
            "plan": {"walls": [[[0, 0], [10, 0]]]}, "points": [{"x": 0, "y": 10, "nameEn": "Lab 1", "category": "room"}]}))
        dm = load_dalil_map(str(mp))
    wall = dm[0]["geometry"]["coordinates"]; pt = dm[1]["geometry"]["coordinates"]
    assert dm[1]["properties"]["name"] == "Lab 1" and dm[0]["properties"]["level"] == "1"
    assert abs(to_local(*wall[1])[1] + 10) < 0.2 and abs(to_local(*pt)[0] - 10) < 0.2  # bearing 90: plan +x points south, +y east
    # floor-plan picture fit: 3 exact control points give ~0 m error; corners follow the transform
    f3, rms = fit_image([(0, 0, lng, lat), (1000, 0, lng + 0.001, lat), (0, 500, lng, lat - 0.0005)])
    assert rms < 0.01 and abs(f3(1000, 500)[0] - (lng + 0.001)) < 1e-7 and abs(f3(1000, 500)[1] - (lat - 0.0005)) < 1e-7
    f2, rms2 = fit_image([(0, 0, lng, lat), (1000, 0, lng + 0.001, lat)])
    assert rms2 < 0.01 and abs(f2(0, 1000)[1] - lat) > 0.0005  # 2 points: image down = map south
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + (640).to_bytes(4, "big") + (480).to_bytes(4, "big") + b"\x08\x02\x00\x00\x00"
    assert image_size(png) == (640, 480)
    assert join_rings([[[0, 0], [1, 0], [1, 1]], [[1, 1], [0, 1], [0, 0]]]) == [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
    # directory: matched by ref, then by name; the page gets the rows
    bd = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[list(c) for c in ring]]}, "properties": {"ref": "A1", "name": ""}},
        {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[list(c) for c in ring]]}, "properties": {"name": "Ibn Sina Building"}}]}
    rows = {r["code"]: r for r in match_directory(bd)}
    assert rows["A1"]["at"] and rows["E7"]["at"] and rows["C1"]["at"] is None and bd["features"][0]["properties"]["name"] == "Ibn Rushd Building"
    assert len(UOS_DIRECTORY) == len({c for c, *_ in UOS_DIRECTORY})
    pg = build_page("pk.t", "v3.35.0", b, p, "t", ind2, directory=list(rows.values()))
    assert '"code":"A1"' in pg and "plan-img-" in pg and "indoor-points" in pg
    print("selftest ok")


def main():
    ap = argparse.ArgumentParser(description="University of Sharjah 3D campus map (Mapbox GL JS).")
    ap.add_argument("--token", default=os.environ.get("MAPBOX_TOKEN", ""))
    ap.add_argument("--google-key", default=os.environ.get("GOOGLE_MAPS_KEY", ""))
    ap.add_argument("--base", default="standard", help="base map to open with: " + ", ".join(BASE_IDS))
    ap.add_argument("--osm-file")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--out", default=str(HERE / "campus_map.html"))
    ap.add_argument("--serve", action="store_true", help="(default) serve and open the page")
    ap.add_argument("--no-serve", action="store_true", help="only write the HTML file")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--gl-version", default="v3.35.0")
    ap.add_argument("--indoor-file", action="append", default=[], help="GeoJSON rooms with a level (path or URL, repeatable)")
    ap.add_argument("--imdf", action="append", default=[], help="IMDF indoor map: .zip, folder or URL (repeatable)")
    ap.add_argument("--dalil-map", action="append", default=[], help="DALIL Mapper export with a world position, FILE or FILE@LEVEL (repeatable)")
    ap.add_argument("--plan-image", action="append", default=[], help='floor-plan picture placed by control points: "FILE|LEVEL|px,py,lng,lat;px,py,lng,lat[;...]" (repeatable)')
    ap.add_argument("--indoor-bbox", help="also harvest OpenStreetMap indoor data here: south,west,north,east (anywhere in the world)")
    ap.add_argument("--no-indoor", action="store_true")
    ap.add_argument("--make-indoor-template", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        selftest()
        return 0
    if args.make_indoor_template:
        write_indoor_template()
        return 0
    if args.base not in BASE_IDS:
        print("Unknown --base {}. Choose one of: {}".format(args.base, ", ".join(BASE_IDS)), file=sys.stderr)
        return 2

    try:
        elements, source = load_elements(args)
    except RuntimeError as e:
        print("Error:", e, file=sys.stderr)
        return 1
    buildings, pois = process(elements)
    directory = match_directory(buildings)
    names_have = {f["properties"]["name"].lower() for f in pois["features"]}
    for r in directory:  # every placed directory building gets a label "A1 · Ibn Rushd Building"
        if r["at"] and r["name"].lower() not in names_have:
            pois["features"].append({"type": "Feature", "geometry": {"type": "Point", "coordinates": r["at"]},
                                     "properties": {"id": "dir-" + r["code"], "name": r["code"] + " · " + r["name"], "name_ar": r["name_ar"], "area_m2": 500.0, "kind": "building"}})
    indoor = process_indoor(load_indoor_elements(args), (), clip=not args.indoor_bbox)
    plan_images, problems = [], []
    for src in args.indoor_file:
        try: indoor["features"] += load_geojson_layout(src, args.offline)
        except Exception as e: problems.append("{}: {}".format(src, e))
    for src in args.imdf:
        try: indoor["features"] += load_imdf(src, args.offline)
        except Exception as e: problems.append("{}: {}".format(src, e))
    for item in args.dalil_map:
        src, lv = item, ""
        if "@" in item and len(item.rsplit("@", 1)[1]) <= 12 and "/" not in item.rsplit("@", 1)[1]:
            src, lv = item.rsplit("@", 1)  # FILE@LEVEL
        try: indoor["features"] += load_dalil_map(src, lv or None, args.offline)
        except Exception as e: problems.append("{}: {}".format(src, e))
    for item in args.plan_image:
        try:
            src, lv, pts = item.split("|", 2)
            plan_images.append(load_plan_image(src, lv, pts, offline=args.offline))
            print("  placed {} on level {} (fit error {} m)".format(src, plan_images[-1]["level"], plan_images[-1]["rms_m"]))
        except Exception as e: problems.append("{}: {}".format(item.split("|")[0], e))
    for msg in problems:
        print("  indoor source skipped: " + msg, file=sys.stderr)
    out = Path(args.out).resolve()
    out.write_text(build_page(args.token.strip(), args.gl_version, buildings, pois, source, indoor,
                              google_key=args.google_key.strip(), base=args.base, plan_images=plan_images, directory=directory), encoding="utf-8")
    print("Wrote {}  ({} footprints, {} named places, {} indoor shapes, {} plan pictures, {}/{} directory buildings placed, data: {})".format(
        out, len(buildings["features"]), len(pois["features"]), len(indoor["features"]), len(plan_images),
        sum(1 for r in directory if r["at"]), len(directory), source))
    if not args.token:
        print("No Mapbox token given: the page will ask for your Mapbox public token in the browser.")
    if not args.google_key:
        print("No Google key given: Google base maps will ask for a Map Tiles API key when you pick one.")
    if not args.no_serve:
        serve(out.parent, out.name, args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
