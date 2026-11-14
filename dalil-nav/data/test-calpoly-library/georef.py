"""Place the Kennedy Library maps on the globe (writes `geo` into both map files).

Level 1: the CAD file is drawn in California State Plane zone 5 (EPSG:2229, US survey feet) in inches,
so its real position is exact. The Mapper moved and straightened it (see `off`, `rot` below, read from
the Mapper project); undoing that and projecting gives longitude/latitude.
Level 2: drawn in local coordinates. It is placed by matching its lifts and stairs (same `link` codes)
to Level 1 with a best-fit rotation + shift.

Check: compares the result with the building footprint from Overture Maps (ODbL) if
`overture_kennedy.json` is given (see README).

Run from dalil-nav/:   pip install pyproj && python data/test-calpoly-library/georef.py
"""
import json, math, pathlib, sys
from pyproj import Transformer

D = pathlib.Path(__file__).parent
L1 = D / 'dalil-map_kennedy-library-cal-poly-test_level-1.json'
L2 = D / 'dalil-map_kennedy-library-cal-poly-test_level-2.json'
# From the Level 1 Mapper project (S.f, S.off, S.rot after opening it):
F, OFF, ROT = 0.0254, (1757706.735752293, 703038.9306285152), -11.3

def m_per_deg(lat):
    return 111412.84 * math.cos(math.radians(lat)), 111132.92 - 559.82 * math.cos(2 * math.radians(lat))

def cad_to_lnglat():
    T = Transformer.from_crs('EPSG:2229', 'EPSG:4326', always_xy=True)
    c, s = math.cos(math.radians(-ROT)), math.sin(math.radians(-ROT))
    def f(x, y):
        u, v = c * x - s * y, s * x + c * y
        return T.transform((u + OFF[0]) / F / 12, (v + OFF[1]) / F / 12)
    return f

def geo_from(fn, src):
    """origin = plan (0,0); bearing = direction of plan +y, degrees clockwise from true north."""
    o, n, e = fn(0, 0), fn(0, 100), fn(100, 0)
    mlng, mlat = m_per_deg(o[1])
    dx, dy = (n[0] - o[0]) * mlng, (n[1] - o[1]) * mlat
    return {'origin': [round(o[0], 8), round(o[1], 8)], 'bearing': round(math.degrees(math.atan2(dx, dy)), 4),
            'scale': round(math.hypot(dx, dy) / 100, 6), 'source': src}

def to_lnglat(geo):
    (lng0, lat0), b, k = geo['origin'], math.radians(geo['bearing']), geo.get('scale', 1)
    mlng, mlat = m_per_deg(lat0)
    def f(x, y):
        e = k * (x * math.cos(b) + y * math.sin(b)); n = k * (-x * math.sin(b) + y * math.cos(b))
        return lng0 + e / mlng, lat0 + n / mlat
    return f

def fit(pairs):  # similarity (no scale) A -> B, least squares
    n = len(pairs); ca = [sum(p[0][i] for p in pairs) / n for i in (0, 1)]; cb = [sum(p[1][i] for p in pairs) / n for i in (0, 1)]
    sxx = sxy = 0
    for (ax, ay), (bx, by) in pairs:
        ax, ay, bx, by = ax - ca[0], ay - ca[1], bx - cb[0], by - cb[1]; sxx += ax * bx + ay * by; sxy += ax * by - ay * bx
    th = math.atan2(sxy, sxx); c, s = math.cos(th), math.sin(th)
    f = lambda x, y: (cb[0] + c * (x - ca[0]) - s * (y - ca[1]), cb[1] + s * (x - ca[0]) + c * (y - ca[1]))
    res = [math.hypot(*(a - b for a, b in zip(f(*p[0]), p[1]))) for p in pairs]
    return f, math.degrees(th), res

m1, m2 = json.loads(L1.read_text()), json.loads(L2.read_text())
cad = cad_to_lnglat()
m1['geo'] = geo_from(cad, 'CAD in California State Plane zone 5 (EPSG:2229)')
links1 = {p['link']: (p['x'], p['y']) for p in m1['points'] if p.get('link')}
pairs = [((p['x'], p['y']), links1[p['link']]) for p in m2['points'] if p.get('link') in links1]
f21, rot, res = fit(pairs)
to1 = to_lnglat(m1['geo'])
m2['geo'] = geo_from(lambda x, y: to1(*f21(x, y)), f'Fitted to Level 1 on {len(pairs)} lifts/stairs (median error {sorted(res)[len(res)//2]:.1f} m)')
for path, m in ((L1, m1), (L2, m2)):
    path.write_text(json.dumps(m, separators=(',', ':')))
    print(path.name, m['geo'])
entr = next(p for p in m1['points'] if p['category'] == 'entrance')
print('Main entrance at', to1(entr['x'], entr['y']))

if len(sys.argv) > 1:   # optional footprint check
    from shapely import wkb
    from shapely.geometry import MultiPoint, Point
    rows = json.loads(pathlib.Path(sys.argv[1]).read_text())
    k = next(r for r in rows if 'Kennedy' in str(r.get('names')))
    poly = wkb.loads(bytes.fromhex(k['geometry']))
    lng0, lat0 = m1['geo']['origin']; mlng, mlat = m_per_deg(lat0)
    M = lambda lng, lat: ((lng - lng0) * mlng, (lat - lat0) * mlat)
    from shapely.geometry import Polygon
    pm = Polygon([M(*c[:2]) for c in poly.exterior.coords])
    hull = MultiPoint([M(*to1(x, y)) for w in m1['plan']['walls'] for x, y in w]).convex_hull
    d = sorted(hull.exterior.distance(Point(c)) for c in pm.exterior.coords)
    print(f'Overture footprint corners vs our outline: median {d[len(d)//2]:.1f} m, max {d[-1]:.1f} m')
    # Keep the real building outline with the maps, for the street-map view (attribution in the app).
    ctx = {'footprint': [[round(c[0], 7), round(c[1], 7)] for c in poly.exterior.coords], 'height_m': round(k['height'] or 0, 1),
           'floors': k.get('num_floors'), 'source': 'Overture Maps Foundation, release 2026-10-21 (ODbL; OpenStreetMap, Microsoft ML Buildings)'}
    for path, m in ((L1, m1), (L2, m2)):
        m['building_context'] = ctx; path.write_text(json.dumps(m, separators=(',', ':')))
    print('Added Overture footprint to both maps')
