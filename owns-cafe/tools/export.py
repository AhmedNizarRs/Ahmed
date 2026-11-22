"""Export scene.json to
  Owns_Cafe_build.ms  - MAXScript that builds the model natively in 3ds Max (2017+) and saves Owns_Cafe.max
  Owns_Cafe.obj/.mtl  - fallback mesh (Y-up, cm) for any 3D app
Run: python3 export.py scene.json <out_dir>
"""
import sys, json, math, os
import numpy as np

SCENE, OUT = sys.argv[1], sys.argv[2]
S = json.load(open(SCENE))

# name: (rgb 0-255, roughness, metalness, texture, map size cm, kind)
MATS = {
    "stone":         ((214, 200, 180), .60, 0, "travertine.jpg", 200, ""),
    "floor":         ((236, 231, 222), .25, 0, "floor_tile.jpg", 120, ""),
    "oak":           ((196, 160, 118), .55, 0, "oak.jpg", 100, ""),
    "brass":         ((205, 165, 95), .30, 1, "brass.jpg", 50, ""),
    "plaster_white": ((239, 236, 230), .90, 0, None, 100, ""),
    "plaster_sand":  ((217, 199, 173), .90, 0, None, 100, ""),
    "plaster_ext":   ((205, 191, 174), .95, 0, None, 100, ""),
    "ceiling":       ((242, 240, 234), .95, 0, None, 100, ""),
    "lacquer_white": ((241, 239, 234), .35, 0, None, 100, ""),
    "door_white":    ((235, 231, 223), .45, 0, None, 100, ""),
    "quartz":        ((244, 241, 236), .20, 0, None, 100, ""),
    "metal_black":   ((22, 22, 22), .45, .6, None, 100, ""),
    "steel":         ((200, 200, 200), .30, 1, None, 100, ""),
    "glass":         ((230, 240, 240), .00, 0, None, 100, "glass"),
    "glass_dark":    ((40, 50, 56), .05, 0, None, 100, "glass_dark"),
    "mirror":        ((235, 235, 235), .02, 1, None, 100, ""),
    "ceramic":       ((246, 246, 244), .15, 0, None, 100, ""),
    "paver":         ((156, 148, 136), .90, 0, None, 100, ""),
    "curb":          ((176, 170, 160), .90, 0, None, 100, ""),
    "asphalt":       ((42, 42, 44), .95, 0, None, 100, ""),
    "paint_yellow":  ((201, 162, 39), .80, 0, None, 100, ""),
    "planter":       ((228, 221, 210), .80, 0, None, 100, ""),
    "soil":          ((58, 43, 31), 1.0, 0, None, 100, ""),
    "bark":          ((90, 70, 50), .90, 0, None, 100, ""),
    "leaves":        ((85, 103, 62), .80, 0, None, 100, ""),
    "sign_glow":     ((255, 217, 160), .50, 0, None, 100, "emit:2500"),
    "led_warm":      ((255, 194, 122), .50, 0, None, 100, "emit:4000"),
    "led_cool":      ((243, 246, 255), .50, 0, None, 100, "emit:1500"),
    "bulb":          ((255, 210, 154), .50, 0, None, 100, "emit:6000"),
}
used = sorted({e["m"] for e in S["elements"]})
missing = [m for m in used if m not in MATS]
assert not missing, missing


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def p3(v):
    return "[" + ",".join(f(x) for x in v) + "]"


def p3r(v):  # rotation rows: keep precision so the matrix stays orthonormal
    return "[" + ",".join(f"{x:.6f}".rstrip("0").rstrip(".").replace("-0", "-0") if abs(x) > 1e-9 else "0" for x in v) + "]"


# ------------------------------------------------------------------ MAXScript
L = []
w = L.append
w("-- Owns Cafe | Coffee & More  -  3ds Max build script")
w("-- Generated from the CAD plan Owns_Cafe.dxf (units: cm) by tools/build_scene.py + tools/export.py")
w("-- How to use: keep this file next to the 'textures' folder, then in 3ds Max: Scripting > Run Script... > pick this file.")
w("-- It resets the scene (asks to save first), builds walls, shopfront, partition, furniture, lights and cameras,")
w("-- and saves Owns_Cafe.max in this folder.")
w("(")
w("local scriptDir = getFilenamePath (getSourceFileName())")
w("local texDir = scriptDir + \"textures\\\\\"")
w("local matNames = #(), mats = #(), mapSizes = #()")
w("local nObj = 0, nFail = 0")
w("""
fn sp obj prop val = (try (setProperty obj prop val) catch ())
fn getLayer nm = (
	local l = LayerManager.getLayerFromName nm
	if l == undefined do l = LayerManager.newLayerFromName nm
	l
)
fn newMat nm = (
	local m = undefined
	try (m = PhysicalMaterial name:nm) catch ()
	if m == undefined do try (m = Physical_Material name:nm) catch ()
	if m == undefined do m = StandardMaterial name:nm
	m
)
fn defMat key rgb rough metal texFile mapSize kind = (
	local m = newMat ("OWN_" + key)
	sp m #base_color rgb
	sp m #diffuse rgb
	sp m #roughness rough
	sp m #metalness metal
	if texFile != undefined do (
		local b = Bitmaptexture filename:(texDir + texFile) name:(key + "_map")
		sp m #base_color_map b
		sp m #diffuseMap b
	)
	if kind == "glass" or kind == "glass_dark" do (
		sp m #transparency (if kind == "glass" then 1.0 else 0.6)
		sp m #trans_color rgb
		sp m #trans_ior 1.52
		sp m #thin_walled true
		sp m #opacity (if kind == "glass" then 12 else 60)
	)
	if (findString kind "emit:") == 1 do (
		local lum = (substring kind 6 -1) as float
		sp m #emission 1.0
		sp m #emit_color rgb
		sp m #emit_luminance lum
		sp m #base_color (color 0 0 0)
		sp m #selfIllumAmount 100
	)
	append matNames key; append mats m; append mapSizes mapSize
	m
)
fn finish obj lay mk = (
	local i = findItem matNames mk
	local ms = if i > 0 then mapSizes[i] else 100.0
	addModifier obj (Uvwmap maptype:4 length:ms width:ms height:ms)
	if i > 0 do obj.material = mats[i]
	convertToPoly obj
	(getLayer lay).addNode obj
	nObj += 1
	obj
)
fn mkPrism nm lay mk rings h tm = (
	try (
		local ss = SplineShape name:nm
		for r in rings do (
			local si = addNewSpline ss
			for p in r do addKnot ss si #corner #line [p.x, p.y, 0]
			close ss si
		)
		updateShape ss
		addModifier ss (Extrude amount:h capStart:true capEnd:true)
		ss.transform = tm
		finish ss lay mk
	) catch (nFail += 1; format "Owns: could not build % (%)\\n" nm (getCurrentException()))
)
fn mkCyl nm lay mk p r h sides = (
	try (finish (Cylinder name:nm radius:r height:h sides:sides heightsegs:1 pos:p) lay mk)
	catch (nFail += 1)
)
fn mkSph nm lay mk p r = (
	try (finish (Sphere name:nm radius:r segs:24 pos:p) lay mk)
	catch (nFail += 1)
)
fn mkLight nm kind p cd k aim hot fall = (
	local l = undefined
	try (l = Free_Light name:nm pos:p) catch (l = Omnilight name:nm pos:p)
	sp l #useKelvin true
	sp l #kelvin k
	sp l #intensityType 1
	sp l #intensity cd
	case kind of (
		"spot": (sp l #distribution 1; sp l #hotSpot hot; sp l #falloff fall)
		"diffuse": (sp l #distribution 2)
		default: (sp l #distribution 0)
	)
	sp l #castShadows true
	if aim == "up" do rotate l (angleaxis 180 [1,0,0])
	(getLayer "13_Lights").addNode l
	l
)
fn mkCam nm p t mm ev = (
	local tg = Targetobject name:(nm + "_Target") pos:t
	local c = undefined
	try (c = Physical_Camera name:nm pos:p target:tg) catch (c = Targetcamera name:nm pos:p target:tg)
	sp c #focal_length_mm mm
	sp c #auto_vertical_tilt_correction true
	sp c #exposure_gain_type 1
	sp c #exposure_value ev
	if classOf c == Targetcamera do c.fov = 2.0 * atan (18.0 / mm)
	(getLayer "14_Cameras").addNode c
	(getLayer "14_Cameras").addNode tg
	c
)
""")
w("fn buildAll = (")
w("\tlocal t0 = timeStamp()")
w("\tunits.SystemType = #Centimeters")
w("\tunits.DisplayType = #Metric")
w("\tunits.MetricType = #Centimeters")
w("\tdisableSceneRedraw()")
w("\t-- materials")
for k in used:
    rgb, ro, me, tx, ms, kind = MATS[k]
    w(f"\tdefMat \"{k}\" (color {rgb[0]} {rgb[1]} {rgb[2]}) {f(ro)} {f(me)} {('\"' + tx + '\"') if tx else 'undefined'} {f(ms)} \"{kind}\"")
w("\t-- geometry")
for e in S["elements"]:
    if e["t"] == "prism":
        rings = "#(" + ",".join("#(" + ",".join(f"[{f(x)},{f(y)}]" for x, y in r) + ")" for r in e["rings"]) + ")"
        M = e["M"]
        tm = f"(matrix3 {p3r(M[0:3])} {p3r(M[3:6])} {p3r(M[6:9])} {p3(M[9:12])})"
        w(f"\tmkPrism \"{e['n']}\" \"{e['l']}\" \"{e['m']}\" {rings} {f(e['h'])} {tm}")
    elif e["t"] == "cyl":
        w(f"\tmkCyl \"{e['n']}\" \"{e['l']}\" \"{e['m']}\" {p3(e['p'])} {f(e['r'])} {f(e['h'])} {e['s']}")
    else:
        w(f"\tmkSph \"{e['n']}\" \"{e['l']}\" \"{e['m']}\" {p3(e['p'])} {f(e['r'])}")
w("\t-- lights (photometric, candela, Kelvin)")
for l in S["lights"]:
    w(f"\tmkLight \"{l['n']}\" \"{l['kind']}\" {p3(l['p'])} {f(l['cd'])} {f(l['k'])} \"{l['aim']}\" {f(l['hot'])} {f(l['fall'])}")
w("\t-- cameras (physical, exposure value: exterior night ~4, interior ~5.5)")
w("\tlocal cams = #()")
for c in S["cameras"]:
    ev = 4.0 if "Exterior" in c["n"] else 5.5
    w(f"\tappend cams (mkCam \"{c['n']}\" {p3(c['p'])} {p3(c['t'])} {f(c['mm'])} {f(ev)})")
w("""\t-- environment and render setup
	backgroundColor = color 10 14 30
	ambientColor = color 0 0 0
	try (
		SceneExposureControl.exposureControl = Physical_Camera_Exposure_Control()
		sp SceneExposureControl.exposureControl #use_physical_camera_controls true
		sp SceneExposureControl.exposureControl #global_ev 4.5
	) catch ()
	renderWidth = 1920
	renderHeight = 1080
	enableSceneRedraw()
	try (viewport.setCamera cams[1]) catch ()
	try (displaySafeFrames = true) catch ()
	redrawViews()
	local outFile = scriptDir + "Owns_Cafe.max"
	saveMaxFile outFile quiet:true
	local secs = (timeStamp() - t0) / 1000.0
	format "Owns Cafe: % objects built, % failed, saved to % in % s\\n" nObj nFail outFile secs
	messageBox ("Owns Cafe model built.\\n\\n" + (nObj as string) + " objects, " + (nFail as string) + " failed.\\nSaved: " + outFile + "\\n\\nCameras are on layer 14_Cameras.") title:"Owns Cafe"
)
if queryBox "Build the Owns Cafe 3D model?\\n\\nThis starts a new scene (you'll be asked to save the current one first)." title:"Owns Cafe" do (
	if checkForSave() do (
		resetMaxFile #noPrompt
		buildAll()
	)
)
)""")
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "Owns_Cafe_build.ms"), "w", newline="\r\n").write("\n".join(L) + "\n")

# ------------------------------------------------------------------ OBJ fallback
import mapbox_earcut as earcut

V, VT, out_f = [], [], []
mtl_used = set()


def add_v(p):          # Z-up cm -> Y-up cm
    V.append((p[0], p[2], -p[1]))
    return len(V)


def add_vt(u, v):
    VT.append((u, v))
    return len(VT)


def face(idx, uvs):
    out_f.append("f " + " ".join(f"{i}/{t}" for i, t in zip(idx, uvs)))


def xf(M, a, b, z):
    X, Y, Zv, O = M[0:3], M[3:6], M[6:9], M[9:12]
    return [O[i] + X[i] * a + Y[i] * b + Zv[i] * z for i in range(3)]


for e in S["elements"]:
    ms = MATS[e["m"]][4]
    out_f.append(f"o {e['n']}")
    out_f.append(f"usemtl OWN_{e['m']}")
    mtl_used.add(e["m"])
    if e["t"] == "prism":
        M, h = e["M"], e["h"]
        rings = [np.array(r, dtype=float) for r in e["rings"]]
        flat = np.vstack(rings)
        ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
        tri = earcut.triangulate_float64(flat, ends).reshape(-1, 3)
        # orientation: make outer ring CCW for consistent caps
        area = 0.5 * np.sum(rings[0][:, 0] * np.roll(rings[0][:, 1], -1) - np.roll(rings[0][:, 0], -1) * rings[0][:, 1])
        for z, flip in ((0, True), (h, False)):
            ids = [add_v(xf(M, a, b, z)) for a, b in flat]
            uv = [add_vt(a / ms, b / ms) for a, b in flat]
            for t in tri:
                t = list(t)
                ccw = (area > 0)
                if flip == ccw:
                    t = t[::-1]
                face([ids[i] for i in t], [uv[i] for i in t])
        for r in rings:
            n = len(r)
            perim = 0.0
            for i in range(n):
                a0, b0 = r[i]; a1, b1 = r[(i + 1) % n]
                seg = math.hypot(a1 - a0, b1 - b0)
                q = [add_v(xf(M, a0, b0, 0)), add_v(xf(M, a1, b1, 0)), add_v(xf(M, a1, b1, h)), add_v(xf(M, a0, b0, h))]
                t = [add_vt(perim / ms, 0), add_vt((perim + seg) / ms, 0), add_vt((perim + seg) / ms, h / ms), add_vt(perim / ms, h / ms)]
                face(q, t)   # rings are oriented: outer CCW, holes CW -> normals face away from the solid
                perim += seg
    elif e["t"] == "cyl":
        x, y, z0 = e["p"]; r, h, s = e["r"], e["h"], e["s"]
        ring_b = [add_v((x + r * math.cos(2 * math.pi * i / s), y + r * math.sin(2 * math.pi * i / s), z0)) for i in range(s)]
        ring_t = [add_v((x + r * math.cos(2 * math.pi * i / s), y + r * math.sin(2 * math.pi * i / s), z0 + h)) for i in range(s)]
        t0 = add_vt(0, 0)
        for i in range(s):
            j = (i + 1) % s
            face([ring_b[i], ring_b[j], ring_t[j], ring_t[i]], [t0] * 4)
        face(ring_t, [t0] * s)
        face(ring_b[::-1], [t0] * s)
    else:
        x, y, z = e["p"]; r = e["r"]; nu, nv = 16, 10
        grid = [[add_v((x + r * math.sin(math.pi * j / nv) * math.cos(2 * math.pi * i / nu),
                        y + r * math.sin(math.pi * j / nv) * math.sin(2 * math.pi * i / nu),
                        z + r * math.cos(math.pi * j / nv))) for i in range(nu)] for j in range(nv + 1)]
        t0 = add_vt(0, 0)
        for j in range(nv):
            for i in range(nu):
                k = (i + 1) % nu
                face([grid[j][i], grid[j + 1][i], grid[j + 1][k], grid[j][k]], [t0] * 4)

with open(os.path.join(OUT, "Owns_Cafe.obj"), "w") as fo:
    fo.write("# Owns Cafe - Y-up, units cm\nmtllib Owns_Cafe.mtl\n")
    fo.write("\n".join(f"v {a:.2f} {b:.2f} {c:.2f}" for a, b, c in V) + "\n")
    fo.write("\n".join(f"vt {a:.4f} {b:.4f}" for a, b in VT) + "\n")
    fo.write("\n".join(out_f) + "\n")
with open(os.path.join(OUT, "Owns_Cafe.mtl"), "w") as fm:
    for k in sorted(mtl_used):
        rgb, ro, me, tx, ms, kind = MATS[k]
        fm.write(f"newmtl OWN_{k}\nKd {rgb[0]/255:.3f} {rgb[1]/255:.3f} {rgb[2]/255:.3f}\nNs {int((1-ro)*200)}\n")
        if kind == "glass":
            fm.write("d 0.15\n")
        if kind.startswith("emit"):
            fm.write(f"Ke {rgb[0]/255:.3f} {rgb[1]/255:.3f} {rgb[2]/255:.3f}\n")
        if tx:
            fm.write(f"map_Kd textures/{tx}\n")
        fm.write("\n")
print("wrote", OUT, f"{len(V)} verts")
