"""Owns Cafe - scene builder.

Reads the CAD plan (Owns_Cafe.dxf, units = cm) and writes scene.json: every object as a
prism (2D outline with holes, extruded along its local Z), cylinder or sphere, plus lights
and cameras. make_maxscript.py turns scene.json into a 3ds Max build script; the preview
viewer reads the same file.

World axes = CAD plan axes: X to the right, Y toward the back of the shop, Z up, cm.
The CAD drawing is shifted by (-2844, -962) so the shop sits near the origin.

Run: python3 build_scene.py Owns_Cafe.dxf scene.json
"""
import sys, json, math, os
import numpy as np
import ezdxf
from shapely.geometry import Polygon, MultiPolygon, box as sbox, LineString
from shapely.ops import unary_union
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties

DXF, OUT = sys.argv[1], sys.argv[2]
OX, OY = 2844.0, 962.0

H_TOP = 580.0      # parapet / top of stone cladding (from photos)
H_CEIL = 370.0     # false ceiling (partition elevation height)
H_ROOF0 = 555.0

E = []            # elements
LIGHTS = []
CAMS = []
NOTES = []


# ------------------------------------------------------------------ helpers
def rings_of(poly):
    from shapely.geometry.polygon import orient
    poly = poly.buffer(0)
    out = []
    for p in (poly.geoms if isinstance(poly, MultiPolygon) else [poly]):
        if p.is_empty or p.area < 0.01:
            continue
        p = orient(p, 1.0)   # outer CCW, holes CW
        rs = [[[round(x, 2), round(y, 2)] for x, y in list(p.exterior.coords)[:-1]]]
        for h in p.interiors:
            rs.append([[round(x, 2), round(y, 2)] for x, y in list(h.coords)[:-1]])
        out.append(rs)
    return out


def _emit(name, layer, mat, geom, h, M, kw):
    """kw: r = edge radius (cm, rounded chamfer; default per material), bot = round the d0/z0 face too,
    seg = segments of the rounding."""
    parts = rings_of(geom)
    for i, rs in enumerate(parts):
        nm = name if len(parts) == 1 else f"{name}_{i + 1:02d}"
        el = dict(t="prism", n=nm, l=layer, m=mat, rings=rs, h=round(h, 2), M=[round(v, 7) for v in M])
        el.update({("cr" if k == "r" else k): v for k, v in kw.items() if v is not None})
        E.append(el)


def prism(name, layer, mat, geom, z0, z1, **kw):
    """Plan outline extruded from z0 to z1."""
    if not hasattr(geom, "geom_type"):
        geom = Polygon(geom)
    kw.setdefault("bot", z0 > 0.5)          # objects standing on the floor: no rounding underneath
    _emit(name, layer, mat, geom, z1 - z0, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, z0], kw)


def fprism(name, layer, mat, geom, origin, X, Y, d0, d1, **kw):
    """Outline in an arbitrary plane (orthonormal X, Y), extruded along Z = X x Y from d0 to d1."""
    if not hasattr(geom, "geom_type"):
        geom = Polygon(geom)
    Z = (X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0])
    P = [origin[i] + Z[i] * d0 for i in range(3)]
    kw.setdefault("bot", True)
    _emit(name, layer, mat, geom, d1 - d0, list(X) + list(Y) + list(Z) + P, kw)


def ell(name, layer, mat, c, radii, rotz=0.0, res=None, g=None):
    """Ellipsoid (pastries, leaf clusters): centre c, radii (rx, ry, rz), rotated rotz degrees about Z."""
    el = dict(t="ell", n=name, l=layer, m=mat, p=[round(float(v), 2) for v in c], rad=[round(float(v), 2) for v in radii], rz=round(float(rotz), 2))
    if res:
        el["res"] = list(res)
    if g:
        el["g"] = g
    E.append(el)


def tube(name, layer, mat, p0, p1, r, sides=12, **kw):
    """Round bar from p0 to p1 (any direction): trunks, branches."""
    import numpy as _np
    a = _np.subtract(p1, p0).astype(float)
    Ln = float(_np.linalg.norm(a))
    z = a / Ln
    ref = (0, 0, 1) if abs(z[2]) < 0.9 else (1, 0, 0)
    X = _np.cross(z, ref); X /= _np.linalg.norm(X)
    Y = _np.cross(z, X)
    circ = Polygon([(r * math.cos(2 * math.pi * i / sides), r * math.sin(2 * math.pi * i / sides)) for i in range(sides)])
    kw.setdefault("r", min(0.4, r / 3))
    fprism(name, layer, mat, circ, tuple(p0), tuple(X), tuple(Y), 0, Ln, **kw)


def vprism(name, layer, mat, geom, origin, u, d0, d1, **kw):
    """Outline drawn in a vertical plane: a = distance along u (plan direction), b = height.
    Local Z = u x up, i.e. the outward side when u runs left-to-right for a viewer facing the wall.
    Extruded from d0 to d1 along local Z."""
    if not hasattr(geom, "geom_type"):
        geom = Polygon(geom)
    ux, uy = u
    zx, zy = uy, -ux
    px, py, pz = origin[0] + zx * d0, origin[1] + zy * d0, origin[2]
    kw.setdefault("bot", False)             # the d0 face usually sits against a wall
    _emit(name, layer, mat, geom, d1 - d0, [ux, uy, 0, 0, 0, 1, zx, zy, 0, px, py, pz], kw)


def rect(a0, b0, a1, b1):
    return sbox(min(a0, a1), min(b0, b1), max(a0, a1), max(b0, b1))


def ring(a0, b0, a1, b1, w, bottom=True):
    outer = rect(a0, b0, a1, b1)
    inner = rect(a0 + w, b0 + (w if bottom else -1), a1 - w, b1 - w)
    return outer.difference(inner)


def cyl(name, layer, mat, x, y, z0, r, h, sides=24, **kw):
    sides = max(sides, 40 if r > 10 else 28)
    el = dict(t="cyl", n=name, l=layer, m=mat, p=[round(x, 2), round(y, 2), round(z0, 2)], r=r, h=h, s=sides, bot=z0 > 0.5)
    el.update({k: v for k, v in kw.items() if v is not None})
    E.append(el)


def sph(name, layer, mat, x, y, z, r):
    E.append(dict(t="sph", n=name, l=layer, m=mat, p=[round(x, 2), round(y, 2), round(z, 2)], r=r))


def light(name, kind, x, y, z, cd, kelvin, aim="down", hot=40, fall=80, maxonly=False, aimv=None):
    """maxonly: helper light for 3ds Max where an emissive strip already lights the scene in Cycles.
    aimv: explicit aim direction (x, y, z) for spots, overrides aim."""
    d = dict(n=name, kind=kind, p=[round(x, 1), round(y, 1), round(z, 1)], cd=cd, k=kelvin, aim=aim, hot=hot, fall=fall, maxonly=maxonly)
    if aimv:
        d["aimv"] = [round(v, 4) for v in aimv]
    LIGHTS.append(d)


def linear(name, p0, p1, z, toward, cd_per_m, kelvin, tilt=12, width=4):
    """Linear LED grazer from p0 to p1 (plan points) at height z, aimed up and tilted `tilt` degrees
    toward the wall (`toward` = plan unit vector pointing at the wall). Smooth wash, no scallops."""
    ux, uy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(ux, uy)
    t = math.radians(tilt)
    emit = (toward[0] * math.sin(t), toward[1] * math.sin(t), math.cos(t))
    LIGHTS.append(dict(n=name, kind="linear", p=[round((p0[0] + p1[0]) / 2, 1), round((p0[1] + p1[1]) / 2, 1), z],
                       u=[ux / ln, uy / ln, 0], len=round(ln, 1), wid=width, emit=[round(v, 4) for v in emit],
                       cd=round(cd_per_m * ln / 100, 1), k=kelvin, aim="up", hot=0, fall=0, maxonly=False))


def text_geom(s, height, bold=True, family="DejaVu Sans"):
    """Text outline (a, b) with baseline at b=0, left at a=0, cap height ~ height."""
    fp = FontProperties(family=family, weight="bold" if bold else "normal")
    tp = TextPath((0, 0), s, size=100, prop=fp)
    g = Polygon()
    for poly in tp.to_polygons():
        if len(poly) >= 3:
            g = g.symmetric_difference(Polygon(poly).buffer(0))
    cap = TextPath((0, 0), "H", size=100, prop=fp).get_extents().height
    k = height / cap
    from shapely import affinity
    g = affinity.scale(g, k, k, origin=(0, 0))
    return g


def place(g, a_center=None, a_left=None, b_base=0.0):
    from shapely import affinity
    x0, y0, x1, y1 = g.bounds
    if a_center is not None:
        dx = a_center - (x0 + x1) / 2
    else:
        dx = a_left - x0
    return affinity.translate(g, dx, b_base)


# ------------------------------------------------------------------ read CAD
doc = ezdxf.readfile(DXF)
msp = doc.modelspace()
lettering = Polygon()
arcs = []
for e in msp:
    if e.dxf.layer == "LETTERING" and e.dxftype() == "LWPOLYLINE":
        pts = [(x - OX, y - OY) for x, y in e.get_points("xy")]
        lettering = lettering.symmetric_difference(Polygon(pts).buffer(0))
    if e.dxftype() == "ARC" and e.dxf.layer == "0" and e.dxf.center[0] - OX > 700:
        arcs.append([(p[0] - OX, p[1] - OY) for p in e.flattening(0.5)])
assert not lettering.is_empty and len(arcs) == 4

# Partition elevation frame in the DXF: left edge x=788, floor y=588.1 (relative coords)
EL_X0, EL_Y0 = 788.0, 588.1


def chain(arcs):
    """Join the 4 wave arcs into 2 polylines (upper / lower), sorted left->right."""
    segs = [list(a) for a in arcs]
    chains = []
    while segs:
        c = segs.pop(0)
        grown = True
        while grown:
            grown = False
            for s in segs:
                for cand, rev_c, rev_s in ((s, False, False), (s[::-1], False, True)):
                    if math.dist(c[-1], cand[0]) < 2:
                        c = c + cand[1:]; segs.remove(s); grown = True; break
                    if math.dist(c[0], cand[-1]) < 2:
                        c = cand + c[1:]; segs.remove(s); grown = True; break
                if grown:
                    break
        if c[0][0] > c[-1][0]:
            c = c[::-1]
        chains.append(c)
    chains.sort(key=lambda c: -sum(p[1] for p in c) / len(c))
    return chains


waves = chain(arcs)
assert len(waves) == 2, f"expected 2 wave curves, got {len(waves)}"
wave_up = [(x - EL_X0, y - EL_Y0) for x, y in waves[0]]
wave_lo = [(x - EL_X0, y - EL_Y0) for x, y in waves[1]]
NOTES.append(f"wave upper {wave_up[0]} -> {wave_up[-1]}, lower {wave_lo[0]} -> {wave_lo[-1]}")

# ------------------------------------------------------------------ key plan geometry (cm)
# Exterior walls are 20 cm. Inside: x 142.7 .. 511.7, back wall inner face y 974.5.
XL0, XL1 = 122.7, 142.7       # left (long street) wall
XR0, XR1 = 511.7, 531.7       # right wall (shared with neighbour)
YB0, YB1 = 974.5, 994.5       # back wall
# Angled shop front: exterior line from (122.7,278.7) to (383.2,91.5), 20 cm deep.
O = (122.7, 278.7)
_dx, _dy = 383.2 - O[0], 91.5 - O[1]
_L = math.hypot(_dx, _dy)
U = (_dx / _L, _dy / _L)            # along the front, left -> right seen from the street
N_IN = (-U[1], U[0])                # inward normal
if N_IN[1] < 0:
    N_IN = (U[1], -U[0])


def D(s, t):
    """Point on the angled front: s along it, t inward from the exterior face."""
    return (O[0] + U[0] * s + N_IN[0] * t, O[1] + U[1] * s + N_IN[1] * t)


def s_of(p):
    return (p[0] - O[0]) * U[0] + (p[1] - O[1]) * U[1]


S0 = s_of((142.7, 289.0))           # interior start of glazing (~10 cm)
S1 = s_of((357.2, 134.8))           # interior end at corner pier (~274 cm)
NOTES.append(f"front length ext {_L:.1f}, glazing s {S0:.1f}..{S1:.1f}")

# ------------------------------------------------------------------ SHELL
L = "01_Shell"
prism("Wall_Left_A", L, "stone", [O, D(S0, 0), (142.7, 289.0), (122.7, 289.0)], 0, H_TOP, r=0)   # small corner wedge only
vprism("Wall_Left_Main", L, "stone",                      # one continuous slab: corner to back, window cut out
       rect(0, 0, YB1 - 289.0, H_TOP).difference(rect(YB1 - 631.2, 95, YB1 - 549.5, 205)),
       (XL0, YB1, 0), (0, -1), -20, 0, r=0.4)
prism("Wall_Back_A", L, "stone", rect(XL1, YB0, 361.7, YB1), 0, H_TOP)
prism("Wall_Back_OverWCDoor", L, "stone", rect(361.7, YB0, 436.7, YB1), 210, H_TOP)
prism("Wall_Back_B", L, "stone", rect(436.7, YB0, XR1, YB1), 0, H_TOP)
prism("Wall_Right", L, "stone", rect(XR0, 126.5, XR1, YB0), 0, H_TOP)
prism("Pier_Right", L, "stone", [(499.7, 91.5), (531.7, 91.5), (531.7, 126.5), (511.7, 126.5), (511.7, 111.5), (499.7, 111.5)], 0, H_TOP)
prism("Pier_Corner", L, "stone", [D(S1, 0), (383.2, 91.5), (389.7, 91.5), (389.7, 111.5), (399.0, 124.5), (366.5, 147.8), (357.2, 134.8)], 0, H_TOP)
prism("Column_Counter", L, "plaster_white", rect(142.7, 481.0, 181.7, 504.5), 0, H_CEIL)
# toilet annex behind the back wall (200 x 100 inside)
prism("Wall_WC", L, "stone", [(291.7, 994.5), (311.7, 994.5), (311.7, 1094.5), (511.7, 1094.5), (511.7, 994.5), (531.7, 994.5), (531.7, 1114.5), (291.7, 1114.5)], 0, 300)
prism("Roof_WC", L, "plaster_ext", rect(291.7, 994.5, 531.7, 1114.5), 300, 315)
foot = Polygon([O, (383.2, 91.5), (531.7, 91.5), (531.7, 994.5), (122.7, 994.5)])
prism("Roof", L, "plaster_ext", foot.buffer(-10, join_style=2), H_ROOF0, H_ROOF0 + 15)

# floors / ceilings
L = "02_Floors_Ceilings"
prism("Floor_Tiles", L, "floor", unary_union([foot, rect(291.7, 994.5, 531.7, 1114.5)]), -5, 0)
inner = Polygon([(142.7, 289.0), (357.2, 134.8), (389.7, 111.5), (511.7, 111.5), (511.7, 974.5), (142.7, 974.5)])
ceil_holes = []
DL = [(230, 330), (330, 255), (455, 175), (455, 320), (200, 585), (320, 585), (465, 470), (465, 610), (280, 400)]
for (x, y) in DL:
    ceil_holes.append(Polygon([(x + 6 * math.cos(a), y + 6 * math.sin(a)) for a in [i * math.pi / 8 for i in range(16)]]))
SLOT = rect(XL1, 652, XR0, 666.2)        # hidden LED wall-washer slot along the partition
prism("Ceiling_Cafe_Kitchen", L, "ceiling", inner.difference(unary_union(ceil_holes)).difference(SLOT), H_CEIL, H_CEIL + 8, r=0)
prism("Ceiling_Slot_Top", L, "ceiling", rect(XL1, 645, XR0, 666.2), H_CEIL + 18, H_CEIL + 22, r=0)
prism("Ceiling_Slot_Side", L, "ceiling", rect(XL1, 650, XR0, 652), H_CEIL + 8, H_CEIL + 18, r=0)
prism("Ceiling_Slot_LED", L, "led_warm", rect(XL1 + 2, 652.5, XR0 - 2, 655), H_CEIL + 17, H_CEIL + 18, r=0)
for i, x in enumerate((190, 280, 370, 460)):
    light(f"Light_Partition_Wash_{i + 1}", "spot", x, 659, H_CEIL + 16, 350, 3000, "down", 20, 70, maxonly=True)
prism("Ceiling_WC", L, "ceiling", rect(311.7, 994.5, 511.7, 1094.5), 260, 268)

# interior wall linings (white, 1 cm)
L = "03_Interior_Walls"
vprism("Lining_Left", L, "plaster_white",
       rect(994.5 - YB0, 0, 994.5 - 289.0, H_CEIL).difference(rect(994.5 - 631.2, 95, 994.5 - 549.5, 205)),
       (XL1, 994.5, 0), (0, -1), -1, 0)
prism("Lining_Right", L, "plaster_white", rect(XR0 - 1, 111.5, XR0, YB0), 0, H_CEIL)
prism("Lining_Back_A", L, "plaster_white", rect(XL1, YB0 - 1, 361.7, YB0), 0, H_CEIL)
prism("Lining_Back_B", L, "plaster_white", rect(436.7, YB0 - 1, XR0, YB0), 0, H_CEIL)
prism("Lining_Back_OverDoor", L, "plaster_white", rect(361.7, YB0 - 1, 436.7, YB0), 210, H_CEIL)

# ------------------------------------------------------------------ PARTITION (12 cm, y 666.2..678.2)
L = "04_Partition"
PY0, PY1 = 666.2, 678.2
prism("Partition_A", L, "plaster_white", rect(XL1, PY0, 247.2, PY1), 0, H_CEIL)
prism("Partition_UnderHatch", L, "plaster_white", rect(247.2, PY0, 307.2, PY1), 0, 80)
prism("Partition_OverHatch", L, "plaster_white", rect(247.2, PY0, 307.2, PY1), 120, H_CEIL)
prism("Partition_B", L, "plaster_white", rect(307.2, PY0, 351.7, PY1), 0, H_CEIL)
prism("Partition_OverDoor", L, "plaster_white", rect(351.7, PY0, 441.7, PY1), 210, H_CEIL)
prism("Partition_C", L, "plaster_white", rect(441.7, PY0, XR0, PY1), 0, H_CEIL)
# cafe-side finish split by the two wave curves (elevation coords: a = x - 142.7, b = height)
PW = XR0 - XL1   # 369
P_ORIG, P_U = (XL1, PY0, 0), (1, 0)
hatch_a0, hatch_a1 = 247.2 - XL1, 307.2 - XL1
door_a0, door_a1 = 351.7 - XL1, 441.7 - XL1
openings = unary_union([rect(hatch_a0 - 5, 75, hatch_a1 + 5, 125), rect(door_a0 - 4, -1, door_a1 + 4, 214)])
panel = rect(0, 0, PW, H_CEIL)
top_poly = Polygon(wave_up + [(PW, H_CEIL + 50), (0, H_CEIL + 50)]).intersection(panel)
lower_poly = Polygon(wave_lo + [(PW, -50), (0, -50)]).intersection(panel)
band_poly = panel.difference(top_poly).difference(lower_poly)
prism("Partition_Slot_Extension", L, "plaster_white", rect(XL1, PY0, XR0, PY1), H_CEIL, H_CEIL + 18, r=0)
vprism("Partition_Moss_Wall", L, "moss", top_poly.difference(openings), P_ORIG, P_U, 0, 3.0, r=0.8)   # preserved moss panel
vprism("Partition_Finish_Bottom", L, "plaster_white", lower_poly.difference(openings), P_ORIG, P_U, 0, 1.5)
vprism("Partition_Wave_Backing", L, "plaster_taupe", band_poly.difference(openings), P_ORIG, P_U, 0, 0.5, r=0)
# oak wave band floats 3 cm off the wall; LED strips hidden in the gap wash the wall above and below it
band = band_poly.difference(openings.buffer(1))
vprism("Partition_Wave_Band", L, "champagne", band, P_ORIG, P_U, 3.0, 6.0, r=0.8, bot=True)
from shapely import affinity
inner_band = band.buffer(-1.8)
for nm, curve, dy in (("Lower", wave_lo, 2.6), ("Upper", wave_up, -2.6)):
    # thin LED fin standing in the gap: its faces point along the wall (down / up), so the light
    # escapes from under the floating band and grazes the plaster
    strip = LineString([(x, y + dy) for x, y in curve]).buffer(0.15, cap_style=2).intersection(inner_band)
    vprism(f"Partition_Wave_LED_{nm}", L, "led_hidden", strip, P_ORIG, P_U, 0.6, 2.9, r=0)
    for i, a in enumerate((60, 150, 240, 330)):
        b = float(LineString(curve).interpolate(a / PW, normalized=True).y)
        if not openings.buffer(5).contains(Polygon([(a - 1, b - 1), (a + 1, b - 1), (a + 1, b + 1), (a - 1, b + 1)])):
            light(f"Light_Wave_{nm}_{i + 1}", "spot", XL1 + a, PY0 - 2.5, b, 60, 2800,
                  "down" if nm == "Lower" else "up", 60, 150, maxonly=True)
# halo-lit logo: brass letters stand 2.5 cm off the wall, an LED layer behind them glows onto the wall
logo_el = affinity.translate(lettering, -EL_X0, -EL_Y0)
vprism("Partition_Logo_Owns", L, "logo_white", logo_el, P_ORIG, P_U, 5.0, 7.5, r=0.35, bot=True)   # opal letters off the moss   # opal letters, face-lit + halo
vprism("Partition_Logo_Halo_LED", L, "led_halo", logo_el.buffer(-0.6), P_ORIG, P_U, 3.4, 3.8, r=0)
lx0, ly0, lx1, ly1 = logo_el.bounds
for i, a in enumerate((lx0 + 30, (lx0 + lx1) / 2, lx1 - 30)):
    light(f"Light_Logo_Halo_{i + 1}", "point", XL1 + a, PY0 - 3, (ly0 + ly1) / 2, 40, 2800, maxonly=True)
vprism("Partition_Door_Frame", L, "champagne", ring(door_a0 - 4, 0, door_a1 + 4, 214, 4, bottom=False), P_ORIG, P_U, -1, 3)
prism("Partition_Door_Leaf", L, "door_white", rect(353.7, 670.2, 439.7, 674.2), 0, 209)
vprism("Partition_Door_Handle", L, "champagne", rect(221.5, 92, 238.2, 95.2), P_ORIG, P_U, 0, 6)
vprism("Partition_Hatch_Frame", L, "metal_black", ring(hatch_a0 - 5, 75, hatch_a1 + 5, 125, 5), P_ORIG, P_U, -12, 3.5)
vprism("Partition_Hatch_Mullion", L, "metal_black", rect((hatch_a0 + hatch_a1) / 2 - 1.5, 80, (hatch_a0 + hatch_a1) / 2 + 1.5, 120), P_ORIG, P_U, -7, -3)
vprism("Partition_Hatch_Glass", L, "glass", rect(hatch_a0, 80, hatch_a1, 120), P_ORIG, P_U, -6.5, -5.5)

# ------------------------------------------------------------------ SHOP FRONT
L = "05_Shopfront"
FO = (O[0], O[1], 0)
# narrow glass bay | stone pier | tall black box (glass below, stone sign panel above)
A_N0, A_N1 = S0, S0 + 62
A_P1 = A_N1 + 40
A_B0, A_B1 = A_P1, S1
vprism("Front_Pier_Mid", L, "stone", rect(A_N1, 0, A_P1, H_TOP), FO, U, -20, 0)
vprism("Front_Lintel_Narrow", L, "stone", rect(A_N0, 545, A_N1, H_TOP), FO, U, -20, 0)
vprism("Front_Lintel_Box", L, "stone", rect(A_B0, 545, A_B1, H_TOP), FO, U, -20, 0)
# narrow bay
vprism("Front_Narrow_Frame", L, "metal_black", ring(A_N0, 0, A_N1, 545, 5), FO, U, -14, -6)
for i, bz in enumerate((230, 320)):
    vprism(f"Front_Narrow_Transom_{i + 1}", L, "metal_black", rect(A_N0, bz - 2.5, A_N1, bz + 2.5), FO, U, -14, -6)
vprism("Front_Narrow_Glass", L, "glass", rect(A_N0 + 5, 5, A_N1 - 5, 318), FO, U, -10.6, -9.4)
vprism("Front_Narrow_Glass_Satin", L, "glass_satin", rect(A_N0 + 5, 322, A_N1 - 5, 540), FO, U, -10.6, -9.4)  # hides the ceiling void
# box bay
BW = 12
vprism("Front_Box_Portal", L, "metal_black", ring(A_B0, 0, A_B1, 545, BW, bottom=False), FO, U, -20, 4)
bx0, bx1 = A_B0 + BW, A_B1 - BW
vprism("Front_Box_Glass", L, "glass", rect(bx0, 0, bx1, 320), FO, U, -10.6, -9.4)
vprism("Front_Box_Mullion", L, "metal_black", rect((bx0 + bx1) / 2 - 3, 0, (bx0 + bx1) / 2 + 3, 320), FO, U, -14, -6)
vprism("Front_Box_Transom", L, "metal_black", rect(bx0, 242, bx1, 248), FO, U, -14, -6)
vprism("Front_Box_HeadBar", L, "metal_black", rect(bx0, 320, bx1, 330), FO, U, -16, -4)
# middle of the portal: a digital ad screen (image textures/screen_ad.png) in a black surround
vprism("Front_Box_SignPanel", L, "metal_black", rect(bx0, 330, bx1, 545 - BW), FO, U, -16, -2)
AD_A0, AD_A1, AD_B0, AD_B1 = bx0 + 4, bx1 - 4, 334, 545 - BW - 4
_Z = (U[1], -U[0])                                            # outward normal of the angled front
_o = D(AD_A0, -1.7)
prism("Front_Ad_Screen", L, "screen_ad", Polygon([D(AD_A0, -1.7), D(AD_A1, -1.7), D(AD_A1, -2.0), D(AD_A0, -2.0)]), AD_B0, AD_B1, r=0)
E[-1]["uv"] = dict(o=[_o[0], _o[1], AD_B0], u=[U[0], U[1], 0], v=[0, 0, 1], n=[_Z[0], _Z[1], 0], w=AD_A1 - AD_A0, h=AD_B1 - AD_B0)
# projecting blade sign on the right pier: double-sided light lightbox, dark logo (reference style)
BX0, BX1, BY0 = 508.7, 522.7, 91.5          # 14 cm deep, projecting ~1.9 m from the pier
BL0, BL1, BZ0, BZ1 = BY0 - 196, BY0 - 16, 425, 500
prism("Blade_Sign_Wall_Plate", L, "metal_black", rect(506.7, 89.5, 524.7, 91.5), 410, 515, r=0.4)
prism("Blade_Sign_Arm_Top", L, "metal_black", rect(513.7, BL0 + 10, 517.7, BY0), 503, 507, r=0.4)
prism("Blade_Sign_Arm_Bottom", L, "metal_black", rect(513.7, BL1 - 6, 517.7, BY0), 418, 422, r=0.4)
blade_box = Polygon([(0, 0), (BL1 - BL0, 0), (BL1 - BL0, BZ1 - BZ0), (0, BZ1 - BZ0)])
vprism("Blade_Sign_Box", L, "metal_black", affinity.translate(blade_box.buffer(-4, join_style=2).buffer(4), 0, BZ0),
       (BX0, BL0, 0), (0, 1), 0, BX1 - BX0, r=1.0, bot=True)
SY0, SY1, SZ0, SZ1 = BL0 + 3.5, BL1 - 3.5, BZ0 + 3.5, BZ1 - 3.5
SW_, SH_ = SY1 - SY0, SZ1 - SZ0


def _draw(d, geom, box, fill, bg):
    x0, y0, x1, y1 = geom.bounds
    k = min((box[2] - box[0]) / (x1 - x0), (box[3] - box[1]) / (y1 - y0))
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    tf = lambda pts: [(cx + (x - (x0 + x1) / 2) * k, cy - (y - (y0 + y1) / 2) * k) for x, y in pts]
    for g in (geom.geoms if hasattr(geom, "geoms") else [geom]):
        d.polygon(tf(g.exterior.coords), fill=fill)
        for h in g.interiors:
            d.polygon(tf(h.coords), fill=bg)


def _cream(W, H):
    from PIL import Image
    img = Image.new("RGB", (W, H))
    top, bot = np.array([247, 243, 236]), np.array([236, 229, 218])
    for yy in range(H):
        img.paste(tuple(int(c) for c in top + (bot - top) * yy / H), (0, yy, W, yy + 1))
    return img


def make_blade_image(path, px=1600):
    from PIL import ImageDraw
    W, H = px, int(px * SH_ / SW_)
    img = _cream(W, H)
    d = ImageDraw.Draw(img)
    ink = (43, 36, 32)
    _draw(d, lettering, (W * 0.25, H * 0.14, W * 0.75, H * 0.64), ink, (243, 238, 230))
    _draw(d, text_geom("COFFEE & MORE", 10, bold=False), (W * 0.37, H * 0.72, W * 0.63, H * 0.83), (92, 80, 70), (238, 232, 222))
    img.save(path)


def make_ad_image(path, px=1100):
    """Ad: COFFEE / iced coffee cup / 15 AED on cream."""
    from PIL import ImageDraw
    W, H = px, int(px * (AD_B1 - AD_B0) / (AD_A1 - AD_A0))
    img = _cream(W, H)
    d = ImageDraw.Draw(img)
    ink = (43, 36, 32)
    _draw(d, text_geom("COFFEE", 10, bold=False), (W * 0.2, H * 0.08, W * 0.8, H * 0.16), ink, (246, 242, 234))
    cx, top, bot = W / 2, H * 0.30, H * 0.70                   # clear cup with iced latte
    tw, bw = W * 0.30, W * 0.22
    lid = H * 0.035
    d.rounded_rectangle([cx - tw / 2 - 10, top - lid - 6, cx + tw / 2 + 10, top + 4], radius=12, fill=(232, 228, 222), outline=(150, 140, 130), width=3)
    d.rectangle([cx - 10, top - lid - 60, cx + 10, top - lid - 4], fill=(70, 60, 52))           # straw
    cup = [(cx - tw / 2, top + 4), (cx + tw / 2, top + 4), (cx + bw / 2, bot), (cx - bw / 2, bot)]
    d.polygon(cup, fill=(238, 236, 232), outline=(150, 140, 130))
    for i in range(60):                                         # coffee: dark bottom to milky top
        f0, f1 = 0.22 + i / 60 * 0.78, 0.22 + (i + 1) / 60 * 0.78
        y0, y1 = top + 4 + (bot - top - 4) * f0, top + 4 + (bot - top - 4) * f1
        w0 = tw + (bw - tw) * f0
        w1 = tw + (bw - tw) * f1
        t = i / 60
        c = tuple(int(a + (b - a) * t) for a, b in zip((214, 178, 136), (96, 58, 32)))
        d.polygon([(cx - w0 / 2 + 6, y0), (cx + w0 / 2 - 6, y0), (cx + w1 / 2 - 6, y1), (cx - w1 / 2 + 6, y1)], fill=c)
    for k in range(4):                                          # ice cubes
        x = cx - tw * 0.28 + k * tw * 0.17
        y = top + (bot - top) * (0.32 + 0.06 * (k % 2))
        d.rounded_rectangle([x, y, x + tw * 0.13, y + tw * 0.13], radius=6, fill=(236, 226, 210), outline=(200, 186, 166))
    _draw(d, text_geom("15 AED", 10, bold=False), (W * 0.28, H * 0.80, W * 0.72, H * 0.88), ink, (240, 234, 224))
    img.save(path)


_tex = os.path.join(os.path.dirname(os.path.abspath(OUT)), "textures")
make_blade_image(os.path.join(_tex, "screen_owns.png"))
make_ad_image(os.path.join(_tex, "screen_ad.png"))
prism("Blade_Sign_Screen_West", L, "screen_owns", rect(BX0 - 0.3, SY0, BX0, SY1), SZ0, SZ1, r=0)
E[-1]["uv"] = dict(o=[BX0 - 0.3, SY1, SZ0], u=[0, -1, 0], v=[0, 0, 1], n=[-1, 0, 0], w=SW_, h=SH_)
prism("Blade_Sign_Screen_East", L, "screen_owns", rect(BX1, SY0, BX1 + 0.3, SY1), SZ0, SZ1, r=0)
E[-1]["uv"] = dict(o=[BX1 + 0.3, SY0, SZ0], u=[0, 1, 0], v=[0, 0, 1], n=[1, 0, 0], w=SW_, h=SH_)
light("Light_Blade_Sign", "point", 515.7, BY0 - 106, 462, 30, 4000, maxonly=True)

# entrance door on the short front (x 389.7 .. 499.7)
DO, DU = (389.7, 111.5, 0), (1, 0)   # local Z = (0,-1): d = 0 at inner face, 20 at street face
vprism("Door_Frame_Jambs", L, "metal_black", unary_union([rect(0, 0, 6, 545), rect(104, 0, 110, 545), rect(0, 539, 110, 545),
                                                          rect(6, 230, 104, 236), rect(6, 330, 104, 336)]), DO, DU, 6, 14)
vprism("Door_Leaf_Frame", L, "metal_black", ring(7, 1, 103, 229, 6), DO, DU, 8, 12)
vprism("Door_Leaf_Glass", L, "glass", rect(13, 7, 97, 223), DO, DU, 9.4, 10.6)
vprism("Door_Handle_Out", L, "brass", rect(86, 80, 89, 180), DO, DU, 12, 17)
vprism("Door_Handle_In", L, "brass", rect(86, 80, 89, 180), DO, DU, 3, 8)
vprism("Door_Transom_Glass", L, "glass", rect(6, 236, 104, 330), DO, DU, 9.4, 10.6)
vprism("Door_Upper_Glass", L, "glass_satin", rect(6, 336, 104, 539), DO, DU, 9.4, 10.6)
vprism("Door_Lintel", L, "stone", rect(0, 545, 110, H_TOP), DO, DU, 0, 20)

# ------------------------------------------------------------------ DRIVE-THRU (left wall)
L = "06_DriveThru"
WO, WU = (XL0, 994.5, 0), (0, -1)    # a = 994.5 - y ; local Z = -x (street side)
wa0, wa1 = 994.5 - 631.2, 994.5 - 549.5
vprism("DT_Window_Frame", L, "metal_black", ring(wa0, 95, wa1, 205, 5), WO, WU, -14, -6)
mid = (wa0 + wa1) / 2
vprism("DT_Window_Glass_A", L, "glass", rect(wa0 + 5, 100, mid + 1, 200), WO, WU, -12, -11)
vprism("DT_Window_Glass_B", L, "glass", rect(mid - 1, 100, wa1 - 5, 200), WO, WU, -9, -8)
vprism("DT_Window_Stile", L, "metal_black", rect(mid - 2, 100, mid + 2, 200), WO, WU, -13, -7)
vprism("DT_Sill_Shelf", L, "steel", rect(wa0 - 4, 91, wa1 + 4, 95), WO, WU, -20, 25)
vprism("DT_Canopy", L, "metal_black", rect(wa0 - 15, 215, wa1 + 15, 227), WO, WU, 0, 45)
vprism("DT_Canopy_LED", L, "led_warm", rect(wa0 - 10, 214.4, wa1 + 10, 215), WO, WU, 36, 40)
dt = text_geom("DRIVE THRU →", 17)
dt = place(dt, a_center=mid + 10, b_base=242)
vprism("DT_Sign", L, "metal_black", dt, WO, WU, 1.2, 3.0, r=0.25, bot=True)       # dark letters, short stand-off
vprism("DT_Sign_Halo", L, "led_halo", dt.buffer(-0.35), WO, WU, 0.3, 0.6, r=0)      # halo glow behind them
# big "Owns" logo above the drive-thru window (same glowing letters + halo as the front sign)
dtl = affinity.scale(lettering, 1.95, 1.95, origin=(0, 0))       # ~4.5 m wide, ~1.4 m tall
LOGO_A = (YB1 - 289.0) / 2                                         # centred on the wall
dtl = place(dtl, a_center=LOGO_A, b_base=0)
dtl = affinity.translate(dtl, 0, 385 - dtl.bounds[1])
# same style as the DRIVE THRU sign: black letters with a bright white halo behind them
vprism("DT_Logo_Owns", L, "metal_black", dtl, WO, WU, 1.2, 3.6, r=0.4, bot=True)
vprism("DT_Logo_Owns_Halo", L, "led_halo", dtl.buffer(-0.8), WO, WU, 0.3, 0.7, r=0)
dsub = place(text_geom("COFFEE & MORE", 17, bold=False), a_center=LOGO_A, b_base=345)
vprism("DT_Logo_Coffee_More", L, "metal_black", dsub, WO, WU, 1.0, 3.0, r=0.2, bot=True)
vprism("DT_Logo_Coffee_More_Halo", L, "led_halo", dsub.buffer(-0.3), WO, WU, 0.3, 0.6, r=0)
for i, da in enumerate((-60, 0, 60)):
    light(f"Light_DT_Logo_Halo_{i + 1}", "point", XL0 - 2, YB1 - (LOGO_A + da), 440, 30, 3000, maxonly=True)
for i, da in enumerate((-35, 0, 35)):
    light(f"Light_DT_Halo_{i + 1}", "point", XL0 - 1.5, 994.5 - (mid + 10 + da), 250, 20, 3000, maxonly=True)

# ------------------------------------------------------------------ CAFE FURNITURE
L = "07_Counter"
C = Polygon([(142.7, 434.5), (396.7, 434.5), (421.7, 459.5), (421.7, 504.5), (142.7, 504.5)])
wall_clip = rect(143.0, 300, 600, 600)
prism("Counter_Plinth", L, "metal_black", C.buffer(-6, join_style=2).intersection(wall_clip), 0, 10)
prism("Counter_Body", L, "marble_white", C, 10, 100, r=3.0)
prism("Counter_Top", L, "marble_white", C.buffer(3, join_style=2).intersection(wall_clip), 100, 104, r=1.5, bot=True)
prism("Counter_LED", L, "led_warm", C.buffer(3.2, join_style=2).difference(C.buffer(1, join_style=2)).intersection(rect(143.0, 300, 600, 470)), 97.5, 99.5)
# --- bakery display case (glass, brass corner posts, LED-lit shelves) -------------------
G = "Bakery_Case"
# glass case follows the desk: same angled corner, inset 4 cm from the top edge, rounded glass edges
CASE = C.buffer(3, join_style=2).intersection(rect(290, 400, 460, 520)).buffer(-4, join_style=2)
prism("Bakery_Case_Base", L, "metal_black", CASE, 104, 107, r=0.6, g=G)
prism("Bakery_Case_Glass_Walls", L, "glass", CASE.difference(CASE.buffer(-1.0, join_style=2)), 107, 151, r=0.3)
prism("Bakery_Case_Glass_Top", L, "glass", CASE, 151, 152, r=0.45, bot=True)
SHELF = CASE.buffer(-2.5, join_style=2)
prism("Bakery_Case_Shelf", L, "glass", SHELF, 128, 128.8, r=0.3, bot=True)
front = rect(280, 400, 470, 446)
prism("Bakery_Case_LED_Top", L, "led_warm", CASE.buffer(-1.2, join_style=2).difference(CASE.buffer(-2.6, join_style=2)).intersection(front), 150.2, 150.7, r=0)
prism("Bakery_Case_LED_Shelf", L, "led_warm", SHELF.difference(SHELF.buffer(-1.4, join_style=2)).intersection(front), 127.4, 128, r=0)
light("Light_Bakery_Case", "point", 355, 470, 148, 25, 3000, maxonly=True)
prism("Bakery_Tray_Lower", L, "champagne", CASE.buffer(-7, join_style=2), 107, 107.6, r=0.25, bot=True)
prism("Bakery_Tray_Upper", L, "champagne", SHELF.buffer(-5, join_style=2), 128.8, 129.3, r=0.25, bot=True)


def croissant(name, cx, cy, z0, rot, k=1.0):
    """Crescent of overlapping ellipsoids."""
    sizes = [(1.9, 1.4, 1.2), (2.9, 2.1, 1.8), (3.5, 2.7, 2.3), (2.9, 2.1, 1.8), (1.9, 1.4, 1.2)]
    for j, a in enumerate((-78, -40, 0, 40, 78)):
        ar = math.radians(a + rot)
        R = 4.3 * k
        x = cx + R * math.sin(ar)
        y = cy - R * math.cos(ar) + 2.2 * k * math.cos(math.radians(rot))
        rx, ry, rz = (v * k for v in sizes[j])
        ell(f"{name}_part{j + 1}", L, "pastry", (x, y, z0 + rz * 0.85), (rx, ry, rz), a + rot)
        E[-1]["g"] = name


for i, x in enumerate((309, 336, 363, 390)):
    croissant(f"Croissant_{i + 1}", x, 474 + (3 if i % 2 else -3), 107.8, 180 if i % 2 else 0, k=1.2)
for i, x in enumerate((303, 318, 333)):
    for j, y in enumerate((466, 481)):
        prism(f"PainChocolat_{i + 1}_{j + 1}", L, "pastry", rect(x - 6, y - 3.5, x + 6, y + 3.5), 129.4, 133.4, r=1.6, bot=True)
for i, x in enumerate((354, 369, 384, 399 - 1)):
    if i == 3:
        for j in range(3):
            cyl(f"Cookie_{j + 1}", L, "pastry", 396, 466 + j * 0.6, 129.4 + j * 1.0, 3.3, 0.9, 24, cr=0.35, g="Cookies")
        continue
    cyl(f"Muffin_{i + 1}_Cup", L, "paper", x, 478, 129.4, 3.1, 3.4, 24, cr=0.3, g=f"Muffin_{i + 1}")
    ell(f"Muffin_{i + 1}_Top", L, "pastry_dark", (x, 478, 133.4), (3.7, 3.7, 2.3))
    E[-1]["g"] = f"Muffin_{i + 1}"
# --- cashier: slim tablet on a stand + card reader ---------------------------------------
G = "Cashier_Tablet"
cyl("Cashier_Base", L, "lacquer_white", 212, 478, 104, 5.5, 0.9, 40, cr=0.4, g=G)
cyl("Cashier_Stem", L, "steel", 212, 477, 104.9, 1.0, 11.5, 20, cr=0.2, g=G)
tilt = math.radians(22)
TY = (0, -math.sin(tilt), math.cos(tilt))
fprism("Cashier_Body", L, "metal_black", rect(-12.5, -8.5, 12.5, 8.5), (212, 476.6, 123.5), (1, 0, 0), TY, 0, 1.0, r=0.45, g=G)
fprism("Cashier_Screen", L, "screen", rect(-11.6, -7.6, 11.6, 7.6), (212, 476.6, 123.5), (1, 0, 0), TY, -0.06, 0, r=0)
prism("Card_Reader", L, "metal_black", rect(229, 452, 236.5, 464), 104, 105.8, r=0.6, bot=False)
prism("Card_Reader_Screen", L, "screen", rect(230, 457.5, 235.5, 463), 105.8, 105.85, r=0)
prism("Back_Counter_Body", L, "lacquer_white", rect(143.7, 515, 203.7, 660), 0, 90)
prism("Back_Counter_Top", L, "marble_white", rect(143.7, 513, 205.7, 662), 90, 94)
for i, (x, y) in enumerate([(200, 469.5), (270, 469.5), (340, 469.5)]):
    cyl(f"Pendant_Cord_{i + 1}", L, "metal_black", x, y, 222, 0.4, H_CEIL - 222, 8)
    cyl(f"Pendant_Shade_{i + 1}", L, "hessian", x, y, 198, 17, 26, 40, cr=0.6)
    sph(f"Pendant_Bulb_{i + 1}", L, "bulb", x, y, 203, 5)
    light(f"Light_Pendant_{i + 1}", "point", x, y, 199, 120, 2700)

L = "08_Seating"
B = Polygon([(142.7, 289.0), (357.2, 134.8), (380.6, 167.3), (158.7, 329.0), (142.7, 329.0)])
prism("WindowBar_Top", L, "marble_white", B, 100, 105, r=1.5, bot=True)
for i, s in enumerate((60, 235)):
    x, y = D(s, 52)
    cyl(f"WindowBar_Leg_{i + 1}", L, "metal_black", x, y, 0, 2.5, 100, 12)
for i, s in enumerate((70, 140, 210)):
    x, y = D(s, 88)
    cyl(f"Stool_{i + 1}_Base", L, "metal_black", x, y, 0, 20, 2, 32)
    cyl(f"Stool_{i + 1}_Post", L, "metal_black", x, y, 2, 2.5, 70, 12)
    cyl(f"Stool_{i + 1}_Seat", L, "boucle", x, y, 72, 18, 7, 40, cr=2.8)
# display shelves on the right wall (customer side)
for i, z in enumerate((150, 185, 220)):
    prism(f"Shelf_{i + 1}", L, "champagne", rect(486.7, 340, 510.7, 520), z, z + 2, r=0.5, bot=True)
    prism(f"Shelf_{i + 1}_LED", L, "led_warm", rect(488.5, 342, 490, 518), z - 0.3, z, r=0)
    for j, y in enumerate((355, 385, 415, 445, 475, 505)):
        if (i + j) % 3 == 1:
            continue
        if (i + j) % 3 == 0:      # small potted plants among the ceramics
            cyl(f"Shelf_{i + 1}_Pot_{j + 1}", L, "ceramic_matte", 498.7, y, z + 2, 5, 9, 28, cr=0.8)
            pr = np.random.default_rng(300 + i * 10 + j)
            for q in range(34):    # small flat leaves fanning out of the pot
                a = pr.uniform(0, 2 * math.pi); rr_ = pr.uniform(1, 9) ** 0.9
                ell(f"Shelf_{i + 1}_Plant_{j + 1}_{q}", L, "leaves_green", (498.7 + rr_ * math.cos(a) * 0.55, y + rr_ * math.sin(a), z + 11 + pr.uniform(0, 10) - rr_ * 0.4),
                    (pr.uniform(1.8, 2.8), pr.uniform(0.9, 1.4), 0.35), math.degrees(a) + pr.uniform(-25, 25), res=(10, 4), g=f"Shelf_Plants_{i + 1}")
            continue
        cyl(f"Shelf_{i + 1}_Jar_{j + 1}", L, ["ceramic_sand", "ceramic_matte", "ceramic_terra"][(i + j) % 3], 498.7, y, z + 2, 5.5 - (j % 2), 16 - 5 * ((i + j) % 2), 28)

# ------------------------------------------------------------------ KITCHEN + WC
L = "09_Kitchen_WC"
prism("Kitchen_Counter_L_Body", L, "steel", rect(143.7, 690, 202.7, YB0 - 1), 0, 86)
prism("Kitchen_Counter_L_Top", L, "steel", rect(143.7, 688, 204.7, YB0 - 1), 86, 90)
prism("Cooktop", L, "metal_black", rect(150.2, 869.4, 193.9, 956.0), 90, 91)
cyl("Burner_1", L, "steel", 172.5, 893.1, 91, 13.6, 1, 16)
cyl("Burner_2", L, "steel", 172.5, 930.3, 91, 13.6, 1, 16)
prism("Kitchen_Counter_R_Body", L, "steel", rect(451.7, 690, XR0 - 1, YB0 - 1), 0, 86)
prism("Kitchen_Counter_R_Top", L, "steel", rect(449.7, 688, XR0 - 1, YB0 - 1), 86, 90)
prism("Kitchen_Sink_Basin", L, "metal_black", rect(456.4, 911.6, 494.6, 961.8), 90, 90.4)
cyl("Kitchen_Faucet", L, "steel", 501.0, 936.4, 90, 1.5, 32, 12)
prism("Kitchen_Faucet_Spout", L, "steel", rect(482, 935, 501, 938), 119, 122)
prism("Kitchen_Shelf_L", L, "steel", rect(143.7, 760, 178.7, 960), 150, 152)
prism("Kitchen_Light_Panel", L, "led_cool", rect(290, 760, 350, 900), H_CEIL - 1, H_CEIL)
prism("WC_Door_Leaf", L, "door_white", rect(363.7, 982.5, 434.7, 986.5), 0, 209)
prism("WC_Tank", L, "ceramic", rect(491.7, 1026.5, 511.7, 1062.5), 40, 80)
cyl("WC_Bowl", L, "ceramic", 471, 1044.5, 0, 18, 40, 24)
prism("WC_Basin", L, "ceramic", rect(337, 1056, 387, 1094.5), 78, 86)
cyl("WC_Basin_Pedestal", L, "ceramic", 362, 1080, 0, 8, 78, 16)
prism("WC_Mirror", L, "mirror", rect(340, 1093.5, 384, 1094.5), 110, 170)

# ------------------------------------------------------------------ SITE CONTEXT
L = "10_Site"
# drive-thru lane along the long wall: asphalt lane (3.9 m), raised curb strip at the wall (grazers sit in it),
# a median curb separating it from the side street, painted arrows and DRIVE THRU lettering
LANE_X0, LANE_X1 = -330.0, 62.7
WALL_CURB = rect(LANE_X1, 285, XL0, 1000)
prism("DriveThru_Lane", L, "asphalt", rect(LANE_X0, -150, LANE_X1, 2600), -16, -2, r=0)
prism("DriveThru_Wall_Curb", L, "curb", WALL_CURB, -16, 12, r=1.5)
prism("DriveThru_Lane_Curb_Front", L, "curb", rect(LANE_X1 - 10, -150, LANE_X1, 285), -16, 10, r=1.5)
prism("DriveThru_Median", L, "curb", rect(LANE_X0 - 40, -40, LANE_X0, 2600), -18, 10, r=1.5)
prism("DriveThru_Line_Edge", L, "paint_white", rect(LANE_X0 + 8, -40, LANE_X0 + 18, 2600), -2, -1.6, r=0)
arrow = Polygon([(0, 0), (34, 75), (8, 75), (8, 230), (-8, 230), (-8, 75), (-34, 75)])   # tip at y=0, pointing -y
from shapely import affinity as _aff
for i, y0 in enumerate((40, 1150)):
    prism(f"DriveThru_Arrow_{i + 1}", L, "paint_white", _aff.translate(arrow, (LANE_X0 + LANE_X1) / 2 - 20, y0), -2, -1.6, r=0)
txt = _aff.scale(text_geom("DRIVE THRU", 34), 1.0, 2.6, origin=(0, 0))
txt = place(txt, a_center=0, b_base=0)
fprism("DriveThru_Road_Text", L, "paint_white", txt, ((LANE_X0 + LANE_X1) / 2 - 20, 1035, -2), (-1, 0, 0), (0, -1, 0), 0, 0.4, r=0)
site = unary_union([rect(LANE_X1, -150, 1100, 1140), rect(LANE_X1, 1140, 140, 2600)]).difference(
    unary_union([foot, rect(291.7, 994.5, 531.7, 1114.5), rect(531.7, 91.5, 1100, 1140), WALL_CURB]))
prism("Sidewalk", L, "paver", site, -16, -2)
prism("Curb_Front", L, "curb", rect(LANE_X1, -150, 1100, -135), -18, -1)
prism("Road", L, "asphalt", rect(-6000, -6000, 6000, 6000).difference(rect(LANE_X0 - 40, -150, 6000, 6000)), -30, -18, r=0)
prism("Road_Line_Side", L, "paint_yellow", rect(LANE_X0 - 60, -150, LANE_X0 - 54, 6000), -18, -17.6, r=0)
prism("Road_Line_Front", L, "paint_yellow", rect(-6000, -165, 6000, -159), -18, -17.6, r=0)
prism("Neighbour_Unit", L, "stone", rect(531.7, 111.5, 1100, 1140), 0, H_TOP)
prism("Neighbour_Front_Stone_A", L, "stone", rect(531.7, 91.5, 620, 111.5), 0, H_TOP)
prism("Neighbour_Front_Stone_B", L, "stone", rect(1000, 91.5, 1100, 111.5), 0, H_TOP)
prism("Neighbour_Front_Stone_C", L, "stone", rect(620, 91.5, 1000, 111.5), 330, H_TOP)
prism("Neighbour_Front_Glass", L, "glass", rect(620, 95, 1000, 99), 0, 330)
prism("Neighbour_Shop_Glow", L, "shop_glow", rect(625, 110.5, 995, 111.5), 0, 325)   # softly lit shop behind the glass
prism("Neighbour_Front_Frame", L, "metal_black", rect(620, 91.5, 1000, 95), 322, 330)
prism("Back_Building", L, "plaster_ext", rect(140, 1160, 1500, 2200), 0, 1250)
prism("Back_Building_Low", L, "plaster_ext", rect(140, 1140, 1100, 1160), 0, 640)
# street lamp
cyl("StreetLamp_Pole", L, "metal_black", -395, 1500, -18, 7, 900, 16)
prism("StreetLamp_Arm", L, "metal_black", rect(-520, 1497, -395, 1503), 880, 886)
prism("StreetLamp_Head", L, "metal_black", rect(-525, 1490, -475, 1510), 872, 880)
prism("StreetLamp_Lens", L, "led_cool", rect(-522, 1492, -478, 1508), 871, 872)
light("Light_StreetLamp", "spot", -500, 1500, 868, 1800, 4000, "down", 40, 85)

# planters with olive trees either side of the front
L = "11_Planters"


def olive(i, x, y, z0):
    """Olive tree: gnarled trunk, branches, ~320 silvery leaf clusters."""
    rr = np.random.default_rng(50 + i)
    wood = f"Olive_{i}_Wood"
    pts = [(x, y, z0 - 5), (x + 3, y + 1, z0 + 35), (x - 2, y + 4, z0 + 70), (x + 1, y + 2, z0 + 98)]
    rad = [4.4, 3.8, 3.2]
    for k in range(3):
        tube(f"{wood}_{k}", L, "bark", pts[k], pts[k + 1], rad[k], 12, g=wood)
    top = np.array(pts[-1], float)
    tips = []
    for k in range(6):
        a = math.radians(k * 60 + rr.uniform(-15, 15))
        R = rr.uniform(16, 26)
        e1 = top + np.array([math.cos(a) * R, math.sin(a) * R, rr.uniform(22, 40)])
        e2 = e1 + np.array([math.cos(a) * rr.uniform(8, 14), math.sin(a) * rr.uniform(8, 14), rr.uniform(10, 20)])
        tube(f"{wood}_b{k}a", L, "bark", top, e1, 1.8, 8, g=wood)
        tube(f"{wood}_b{k}b", L, "bark", e1, e2, 1.1, 8, g=wood)
        tips.append(e2)
    c = top + np.array([0, 0, 52])
    R = np.array([47, 47, 37])
    n = 0
    while n < 320:
        d = rr.normal(size=3)
        d /= np.linalg.norm(d)
        if d[2] < -0.75:
            continue
        p = c + d * R * (0.55 + 0.45 * rr.random() ** 0.5)
        mat = "leaves_b" if rr.random() < 0.35 else "leaves"
        ell(f"Olive_{i}_Leaf_{n}", L, mat, p, (rr.uniform(5, 9), rr.uniform(3.5, 6), rr.uniform(2.4, 4)),
            rr.uniform(0, 360), res=(8, 5), g=f"Olive_{i}_Leaves")
        n += 1


import numpy as np
for i, (x, y) in enumerate([D((A_N1 + A_P1) / 2, -55), (515.7, 50)]):
    cyl(f"Planter_{i + 1}", L, "planter", x, y, -2, 30, 78, 32)
    cyl(f"Planter_{i + 1}_Soil", L, "soil", x, y, 70, 27, 5, 24)
    olive(i + 1, x, y, 75)

# ------------------------------------------------------------------ BIOPHILIC: indoor tree + hanging plants
L = "16_Plants"
cyl("Indoor_Planter", L, "planter_clay", 178, 388, 0, 26, 58, 40, cr=3)    # corner between the window bar and the desk
cyl("Indoor_Planter_Soil", L, "soil", 178, 388, 52, 23.5, 4, 32)
olive(9, 178, 388, 56)
for i, s_ in enumerate((65, 140, 215)):
    hx, hy = D(s_, 48)
    rr = np.random.default_rng(700 + i)
    cyl(f"Hanging_Cord_{i + 1}", L, "metal_black", hx, hy, 262, 0.3, H_CEIL - 262, 8)
    cyl(f"Hanging_Pot_{i + 1}", L, "ceramic_matte", hx, hy, 248, 10, 14, 32, cr=1.2)
    for q in range(110):                                    # trailing foliage spilling over the pot
        a = rr.uniform(0, 2 * math.pi)
        rad = rr.uniform(4, 13) + (0 if q < 25 else rr.uniform(0, 8))
        zz = 262 - (0 if q < 25 else rr.uniform(0, 70) ** 1.0)
        ell(f"Hanging_Leaf_{i + 1}_{q}", L, "leaves_green", (hx + rad * math.cos(a), hy + rad * math.sin(a), zz),
            (rr.uniform(2.2, 3.4), rr.uniform(1.4, 2.0), 0.4), rr.uniform(0, 360), res=(10, 4), g=f"Hanging_Plant_{i + 1}")

# ------------------------------------------------------------------ LIGHTS
for i, (x, y) in enumerate(DL):
    light(f"Light_Downlight_{i + 1:02d}", "spot", x, y, H_CEIL - 1, 700, 3000, "down", 45, 90)
light("Light_Kitchen_1", "diffuse", 320, 790, H_CEIL - 2, 450, 4000)
light("Light_Kitchen_2", "diffuse", 320, 880, H_CEIL - 2, 450, 4000)
light("Light_WC", "diffuse", 411, 1044, 258, 200, 3500)
light("Light_Shelves_Wash", "spot", 470, 430, H_CEIL - 1, 500, 3000, "down", 30, 70)
light("Light_Canopy", "spot", XL0 - 35, (549.5 + 631.2) / 2, 212, 400, 3000, "down", 60, 110)
# exterior: continuous linear grazers at the foot of every stone face (smooth wash up to the parapet)
GZ = 18   # cm off the wall
# 50 cm off the wall so the drive-thru canopy (45 cm deep) never blocks the wash above it
linear("Light_Grazer_LeftWall_A", (XL0 - 50, 292), (XL0 - 50, 640), 14, (1, 0), 1250, 2900, tilt=16)
linear("Light_Grazer_LeftWall_B", (XL0 - 50, 640), (XL0 - 50, 990), 14, (1, 0), 1250, 2900, tilt=16)
linear("Light_Grazer_Front", D(S0, -GZ), D(S1 + 30, -GZ), 3, N_IN, 1100, 2900)
linear("Light_Grazer_Door_Pier", (389.7, 91.5 - GZ), (531.7, 91.5 - GZ), 3, (0, 1), 1100, 2900)
linear("Light_Grazer_Neighbour", (540, 91.5 - GZ), (1095, 91.5 - GZ), 3, (0, 1), 700, 3000)
# glowing base strips
L = "12_Exterior_Lighting"
prism("LED_Strip_LeftWall", L, "led_warm", rect(XL0 - 8, 290, XL0 - 5, 985), 12, 13)
strip = LineString([D(S0, -8), D(S1, -8)]).buffer(1.5, cap_style=2)
prism("LED_Strip_Front", L, "led_warm", strip, -2, -1)

# ------------------------------------------------------------------ CAR at the drive-thru window
# Nissan Patrol 2021 by Nieve5677 (Sketchfab, CC-BY-4.0). Faces -y (toward the front street), driver's
# window lined up with the service window; mirror ~10 cm off the curb strip.
CAR = dict(n="Car_Nissan_Patrol_2021", file="car/Nissan_Patrol_2021.glb", length_cm=517, pos=[-54.5, 612, -2])
car_front = CAR["pos"][1] - CAR["length_cm"] / 2
for i, dx in enumerate((-72, 72)):
    light(f"Light_Car_Headlight_{i + 1}", "spot", CAR["pos"][0] + dx, car_front + 6, 88, 2200, 5600,
          hot=22, fall=55, aimv=(0, -math.cos(math.radians(5)), -math.sin(math.radians(5))))

# ------------------------------------------------------------------ CAMERAS
CAMS += [
    dict(n="CAM_Exterior_Corner", p=[-470, -440, 165], t=[190, 360, 245], mm=24),
    dict(n="CAM_Exterior_DriveThru", p=[-560, 130, 165], t=[122, 640, 270], mm=24),
    dict(n="CAM_Interior_ToPartition", p=[440, 175, 150], t=[290, 666, 175], mm=18),
    dict(n="CAM_Interior_ToFront", p=[478, 655, 160], t=[225, 215, 140], mm=18),
    dict(n="CAM_Counter_Bakery", p=[378, 368, 132], t=[318, 482, 120], mm=30),
]

json.dump(dict(units="cm", elements=E, lights=LIGHTS, cameras=CAMS, props=[CAR], notes=NOTES), open(OUT, "w"))
print(f"{len(E)} objects, {len(LIGHTS)} lights, {len(CAMS)} cameras")
for n in NOTES:
    print(" -", n)
