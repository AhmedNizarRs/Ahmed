"""Turn scene.json primitives into final triangle meshes with rounded (chamfered) edges.

Every prism is rebuilt as a mesh:
  * corners of the outline are filleted (rounded vertical edges),
  * top and (optionally) bottom edges get a rounded chamfer profile with `seg` segments,
  * vertices are split between flat caps / bevels and at sharp corners, so a renderer that
    smooths by shared vertices shows crisp flat faces with soft rounded edges (no shading smear).
Cylinders get rounded rims; spheres/ellipsoids are smooth UV spheres.

Output meshes.json: objects (name, layer, material, group, verts [x,y,z...] in cm Z-up, tris [i,j,k...]).
Elements sharing a group `g` and a material are merged into one object.

Run: python3 mesher.py scene.json meshes.json
"""
import sys, json, math
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
from shapely.geometry.polygon import orient
import mapbox_earcut as earcut

# default edge radius per material (cm). 0 = keep sharp.
CR = {
    "stone": 0.8, "plaster_white": 0.5, "plaster_sand": 0.5, "plaster_ext": 1.0, "ceiling": 0.0, "floor": 0.0,
    "oak": 0.5, "quartz": 0.7, "lacquer_white": 0.6, "door_white": 0.5, "metal_black": 0.3, "steel": 0.3,
    "brass": 0.3, "glass": 0.0, "glass_dark": 0.0, "mirror": 0.2, "ceramic": 1.5, "paver": 0.6, "curb": 1.2,
    "asphalt": 0.0, "paint_yellow": 0.0, "paint_white": 0.0, "planter": 2.0, "soil": 0.0, "bark": 0.4, "sign_glow": 0.25,
    "led_warm": 0.0, "shop_glow": 0.0, "led_hidden": 0.0, "led_cool": 0.0, "led_halo": 0.0, "bulb": 0.0, "pastry": 1.2, "pastry_dark": 1.0,
    "paper": 0.3, "screen": 0.0, "leaves": 0.0, "leaves_b": 0.0, "glass_satin": 0.0,
}
SEG = 3
SHARP_DEG = 35.0


def fillet(poly, r):
    """Round convex and concave corners with radius r; returns list of oriented polygons."""
    poly = poly.buffer(0)
    if r > 0:
        for rr in (r, r / 2, r / 4):
            g = poly.buffer(-rr, join_style=1, quad_segs=3).buffer(rr, join_style=1, quad_segs=3)
            g = g.buffer(rr, join_style=1, quad_segs=3).buffer(-rr, join_style=1, quad_segs=3)
            if not g.is_empty and abs(g.area - poly.area) < 0.03 * poly.area + 0.5 * rr * rr:
                poly = g
                break
    poly = poly.simplify(0.004, preserve_topology=True)
    parts = poly.geoms if isinstance(poly, MultiPolygon) else [poly]
    return [orient(p, 1.0) for p in parts if not p.is_empty and p.area > 0.01]


def offset_ring(P, d):
    """Move every vertex of ring P (N,2) by distance d to the left of travel (into the solid)."""
    if d == 0:
        return P.copy()
    prv, nxt = np.roll(P, 1, 0), np.roll(P, -1, 0)
    e1 = P - prv
    e2 = nxt - P
    e1 /= np.maximum(np.linalg.norm(e1, axis=1, keepdims=True), 1e-12)
    e2 /= np.maximum(np.linalg.norm(e2, axis=1, keepdims=True), 1e-12)
    n1 = np.stack([-e1[:, 1], e1[:, 0]], 1)
    n2 = np.stack([-e2[:, 1], e2[:, 0]], 1)
    denom = 1.0 + np.sum(n1 * n2, 1, keepdims=True)
    v = (n1 + n2) / np.maximum(denom, 0.15)
    ln = np.linalg.norm(v, axis=1, keepdims=True)
    v = np.where(ln > 3.0, v / ln * 3.0, v)
    return P + v * d


def sharp_mask(P):
    prv, nxt = np.roll(P, 1, 0), np.roll(P, -1, 0)
    e1 = P - prv
    e2 = nxt - P
    e1 /= np.maximum(np.linalg.norm(e1, axis=1, keepdims=True), 1e-12)
    e2 /= np.maximum(np.linalg.norm(e2, axis=1, keepdims=True), 1e-12)
    c = np.clip(np.sum(e1 * e2, 1), -1, 1)
    return np.degrees(np.arccos(c)) > SHARP_DEG


class Buf:
    def __init__(self):
        self.v, self.t = [], []

    def add(self, pts):
        i0 = len(self.v)
        self.v.extend(map(tuple, pts))
        return i0

    def tri(self, a, b, c):
        self.t.append((a, b, c))


def tri_area2(V, a, b, c):
    p, q, r = np.array(V[a]), np.array(V[b]), np.array(V[c])
    return np.linalg.norm(np.cross(q - p, r - p))


def prism_mesh(buf, rings, h, M, cr, bot, seg, do_fillet=True):
    X, Y, Z, O = (np.array(M[i:i + 3], float) for i in (0, 3, 6, 9))
    poly = Polygon(rings[0], rings[1:]) if len(rings) > 1 else Polygon(rings[0])
    r0 = max(0.0, min(cr, h / 2.5))
    # corner fillet radius > edge radius, so insetting by r never collapses a rounded corner
    parts = fillet(poly, 1.6 * r0) if do_fillet else [orient(poly.buffer(0), 1.0)]
    for p in parts:
        rs = [np.array(p.exterior.coords[:-1], float)] + [np.array(i.coords[:-1], float) for i in p.interiors]
        rs = [R for R in rs if len(R) >= 3]
        if not rs:
            continue
        r = r0
        while r >= 0.05:      # shrink the rounding if the inset outline would self-intersect
            ok = True
            for R in rs:
                Q = Polygon(offset_ring(R, r))
                if not Q.is_valid or Q.area < 1e-6:
                    ok = False
                    break
            if ok:
                break
            r /= 2
        if r < 0.05:
            r = 0.0
        _part_mesh(buf, rs, h, r, bot, seg, X, Y, Z, O)


def _part_mesh(buf, rs, h, r, bot, seg, X, Y, Z, O):
    # profile levels top -> bottom: (inset, z)
    lv = []
    if r > 0:
        for k in range(seg + 1):
            th = k / seg * math.pi / 2
            lv.append((r * (1 - math.sin(th)), h - r * (1 - math.cos(th))))
    else:
        lv.append((0.0, h))
    if r > 0 and bot:
        for k in range(seg, -1, -1):
            th = k / seg * math.pi / 2
            lv.append((r * (1 - math.sin(th)), r * (1 - math.cos(th))))
    else:
        lv.append((0.0, 0.0))
    lv2 = [lv[0]]
    for L in lv[1:]:
        if abs(L[0] - lv2[-1][0]) > 1e-6 or abs(L[1] - lv2[-1][1]) > 1e-6:
            lv2.append(L)
    lv = lv2

    def W(P2, z):
        return O + np.outer(P2[:, 0], X) + np.outer(P2[:, 1], Y) + z * Z

    if True:
        cap_top, cap_bot = [], []
        for R in rs:
            N = len(R)
            sharp = sharp_mask(R)
            cols_in, cols_out = [], []
            for k, (ins, z) in enumerate(lv):
                Pk = offset_ring(R, ins)
                wk = W(Pk, z)
                i_in = buf.add(wk)
                ns = int(sharp.sum())
                if ns:
                    i_dup = buf.add(wk[sharp])
                    dup_idx = np.full(N, -1)
                    dup_idx[sharp] = np.arange(ns) + i_dup
                    out_idx = np.where(sharp, dup_idx, np.arange(N) + i_in)
                else:
                    out_idx = np.arange(N) + i_in
                cols_in.append(np.arange(N) + i_in)
                cols_out.append(out_idx)
                if k == 0:
                    cap_top = cap_top + [(Pk, wk)]
                if k == len(lv) - 1:
                    cap_bot = cap_bot + [(Pk, wk)]
            for k in range(len(lv) - 1):
                for i in range(N):
                    j = (i + 1) % N
                    a, b = cols_out[k][i], cols_in[k][j]
                    c, d = cols_in[k + 1][j], cols_out[k + 1][i]
                    for t in ((a, c, b), (a, d, c)):
                        if tri_area2(buf.v, *t) > 1e-8:
                            buf.tri(*t)
        # caps (own vertices -> hard edge to the bevel)
        for caps, up in ((cap_top, True), (cap_bot, False)):
            flat2 = np.vstack([c[0] for c in caps])
            flatw = np.vstack([c[1] for c in caps])
            ends = np.cumsum([len(c[0]) for c in caps]).astype(np.uint32)
            try:
                T = earcut.triangulate_float64(flat2, ends).reshape(-1, 3)
            except Exception:
                continue
            i0 = buf.add(flatw)
            for t in T:
                a, b, c = flat2[t[0]], flat2[t[1]], flat2[t[2]]
                s = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
                if abs(s) < 1e-9:
                    continue
                tt = list(t) if (s > 0) == up else [t[0], t[2], t[1]]
                buf.tri(i0 + tt[0], i0 + tt[1], i0 + tt[2])


def ellipsoid_mesh(buf, c, rad, rz, nu=24, nv=14):
    cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    pts = [(c[0], c[1], c[2] + rad[2])]
    for j in range(1, nv):
        ph = math.pi * j / nv
        for i in range(nu):
            th = 2 * math.pi * i / nu
            x, y, z = rad[0] * math.sin(ph) * math.cos(th), rad[1] * math.sin(ph) * math.sin(th), rad[2] * math.cos(ph)
            pts.append((c[0] + x * cz - y * sz, c[1] + x * sz + y * cz, c[2] + z))
    pts.append((c[0], c[1], c[2] - rad[2]))
    i0 = buf.add(np.array(pts))
    top, botm = i0, i0 + len(pts) - 1
    ring = lambda j, i: i0 + 1 + (j - 1) * nu + (i % nu)
    for i in range(nu):
        buf.tri(top, ring(1, i), ring(1, i + 1))
        buf.tri(botm, ring(nv - 1, i + 1), ring(nv - 1, i))
    for j in range(1, nv - 1):
        for i in range(nu):
            a, b, c2, d = ring(j, i), ring(j, i + 1), ring(j + 1, i + 1), ring(j + 1, i)
            buf.tri(a, d, c2)
            buf.tri(a, c2, b)


def build(scene):
    objs = {}
    order = []
    for e in scene["elements"]:
        key = (e.get("g") or e["n"], e["m"])
        if key not in objs:
            nm = e.get("g") or e["n"]
            if e.get("g") and any(k[0] == nm and k != key for k in objs):
                nm = f"{nm}_{e['m']}"
            objs[key] = dict(n=nm, l=e["l"], m=e["m"], g=e.get("g"), buf=Buf())
            order.append(key)
        buf = objs[key]["buf"]
        cr = e.get("cr", CR.get(e["m"], 0.0))
        if e["t"] == "prism":
            prism_mesh(buf, e["rings"], e["h"], e["M"], cr, e.get("bot", False), e.get("seg", SEG))
        elif e["t"] == "cyl":
            s, r = e["s"], e["r"]
            ringp = [[r * math.cos(2 * math.pi * i / s), r * math.sin(2 * math.pi * i / s)] for i in range(s)]
            M = [1, 0, 0, 0, 1, 0, 0, 0, 1] + list(e["p"])
            prism_mesh(buf, [ringp], e["h"], M, min(cr, r / 2.5), e.get("bot", False), SEG, do_fillet=False)
        elif e["t"] == "sph":
            ellipsoid_mesh(buf, e["p"], (e["r"],) * 3, 0)
        elif e["t"] == "ell":
            nu, nv = e.get("res", (24, 14))
            ellipsoid_mesh(buf, e["p"], e["rad"], e.get("rz", 0), nu, nv)
    # fix duplicate names
    seen = {}
    out = []
    for key in order:
        o = objs[key]
        nm = o["n"]
        if nm in seen:
            seen[nm] += 1
            nm = f"{nm}_{seen[nm]}"
        else:
            seen[nm] = 0
        b = o["buf"]
        if not b.t:
            continue
        out.append(dict(n=nm, l=o["l"], m=o["m"], g=o["g"],
                        v=[round(float(c), 3) for p in b.v for c in p], f=[int(i) for t in b.t for i in t]))
    return out


if __name__ == "__main__":
    scene = json.load(open(sys.argv[1]))
    objs = build(scene)
    json.dump(dict(objects=objs, lights=scene["lights"], cameras=scene["cameras"], props=scene.get("props", [])), open(sys.argv[2], "w"))
    nv = sum(len(o["v"]) // 3 for o in objs)
    nf = sum(len(o["f"]) // 3 for o in objs)
    print(f"{len(objs)} mesh objects, {nv} verts, {nf} tris")
