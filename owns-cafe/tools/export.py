"""Export meshes.json to
  Owns_Cafe_build.ms  - MAXScript: builds the finished meshes (rounded edges), Physical Materials,
                        photometric lights and physical cameras in 3ds Max 2017+, saves Owns_Cafe.max
  Owns_Cafe.obj/.mtl  - fallback mesh with normals (Y-up, cm)
Run: python3 export.py meshes.json <out_dir>
"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from materials import MATS

SRC, OUT = sys.argv[1], sys.argv[2]
D = json.load(open(SRC))
objs, lights, cams = D["objects"], D["lights"], D["cameras"]
used = sorted({o["m"] for o in objs})
assert all(m in MATS for m in used), [m for m in used if m not in MATS]


def f(v, nd=2):
    s = f"{v:.{nd}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "", "-") else s


def p3(v):
    return "[" + ",".join(f(x) for x in v) + "]"


L = []
w = L.append
w("-- Owns Cafe | Coffee & More  -  3ds Max build script")
w("-- Generated from Owns_Cafe.dxf (cm) by tools/build_scene.py -> mesher.py -> export.py")
w("-- Use: keep next to the 'textures' folder. 3ds Max: Scripting > Run Script... > this file.")
w("-- Builds every object as a finished mesh with rounded edges, Physical Materials, photometric lights")
w("-- and physical cameras, then saves Owns_Cafe.max next to this script.")
w("(")
w("local scriptDir = getFilenamePath (getSourceFileName())")
w("local texDir = scriptDir + \"textures\\\\\"")
w("local matNames = #(), mats = #(), mapSizes = #()")
w("local nObj = 0, nFail = 0")
w(r"""
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
fn defMat key rgb rough metal texFile mapSize kind lum coat bump = (
	local m = newMat ("OWN_" + key)
	sp m #base_color rgb
	sp m #diffuse rgb
	sp m #roughness rough
	sp m #metalness metal
	if coat > 0 do (sp m #coating coat; sp m #coat_roughness 0.05)
	if texFile != undefined do (
		local b = Bitmaptexture filename:(texDir + texFile) name:(key + "_map")
		sp m #base_color_map b
		sp m #diffuseMap b
		if bump > 0 do (
			local bb = Bitmaptexture filename:(texDir + texFile) name:(key + "_bump")
			sp m #bump_map bb
			sp m #bump_map_amt (bump * 0.3)
		)
	)
	if kind == "glass" or kind == "glass_dark" do (
		sp m #transparency (if kind == "glass" then 1.0 else 0.6)
		sp m #trans_color rgb
		sp m #trans_ior 1.52
		sp m #thin_walled false
		sp m #opacity (if kind == "glass" then 12 else 60)
	)
	if kind == "emit" do (
		sp m #emission 1.0
		sp m #emit_color rgb
		sp m #emit_luminance lum
		sp m #base_color (color 0 0 0)
		sp m #selfIllumAmount 100
	)
	append matNames key; append mats m; append mapSizes mapSize
	m
)
fn mkMesh nm lay mk vs fs = (
	try (
		local m = mesh vertices:vs faces:fs
		m.name = nm
		meshop.autoSmooth m #{1..m.numfaces} 179.0
		update m
		m.pivot = m.center
		local i = findItem matNames mk
		local ms = if i > 0 then mapSizes[i] else 100.0
		addModifier m (Uvwmap maptype:4 length:ms width:ms height:ms)
		if i > 0 do m.material = mats[i]
		(getLayer lay).addNode m
		nObj += 1
		m
	) catch (nFail += 1; format "Owns: could not build % (%)\n" nm (getCurrentException()))
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
    m = MATS[k]
    r, g, b = m["rgb"]
    tx = f'"{m["tex"]}"' if m["tex"] else "undefined"
    w(f'\tdefMat "{k}" (color {r} {g} {b}) {f(m["rough"])} {f(m["metal"])} {tx} {f(m["size"])} "{m["kind"]}" {f(m["lum"])} {f(m["coat"])} {f(m["bump"])}')
w("\t-- meshes")
for o in objs:
    V = o["v"]
    vs = "#(" + ",".join(f"[{f(V[i])},{f(V[i + 1])},{f(V[i + 2])}]" for i in range(0, len(V), 3)) + ")"
    F = o["f"]
    fs = "#(" + ",".join(f"[{F[i] + 1},{F[i + 1] + 1},{F[i + 2] + 1}]" for i in range(0, len(F), 3)) + ")"
    w(f'\tmkMesh "{o["n"]}" "{o["l"]}" "{o["m"]}" {vs} {fs}')
w("\t-- lights (photometric, candela, Kelvin)")
for l in lights:
    w(f'\tmkLight "{l["n"]}" "{l["kind"]}" {p3(l["p"])} {f(l["cd"])} {f(l["k"])} "{l["aim"]}" {f(l["hot"])} {f(l["fall"])}')
w("\t-- cameras (physical; exposure value: exterior night ~4, interior ~5.5)")
w("\tlocal cams = #()")
for c in cams:
    ev = 4.0 if "Exterior" in c["n"] else 5.5
    w(f'\tappend cams (mkCam "{c["n"]}" {p3(c["p"])} {p3(c["t"])} {f(c["mm"])} {f(ev)})')
w(r"""	backgroundColor = color 10 14 30
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
	format "Owns Cafe: % objects built, % failed, saved to % in % s\n" nObj nFail outFile secs
	messageBox ("Owns Cafe model built.\n\n" + (nObj as string) + " objects, " + (nFail as string) + " failed.\nSaved: " + outFile + "\n\nCameras are on layer 14_Cameras.") title:"Owns Cafe"
)
if queryBox "Build the Owns Cafe 3D model?\n\nThis starts a new scene (you'll be asked to save the current one first)." title:"Owns Cafe" do (
	if checkForSave() do (
		resetMaxFile #noPrompt
		buildAll()
	)
)
)""")
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "Owns_Cafe_build.ms"), "w", newline="\r\n").write("\n".join(L) + "\n")

# ------------------------------------------------------------------ OBJ (Y-up, cm) with normals
vo = 1
with open(os.path.join(OUT, "Owns_Cafe.obj"), "w") as fo:
    fo.write("# Owns Cafe - Y-up, units cm\nmtllib Owns_Cafe.mtl\n")
    for o in objs:
        V = np.array(o["v"]).reshape(-1, 3)
        F = np.array(o["f"]).reshape(-1, 3)
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        N = np.zeros_like(V)
        for k in range(3):
            np.add.at(N, F[:, k], fn)
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
        fo.write(f"o {o['n']}\nusemtl OWN_{o['m']}\n")
        fo.write("".join(f"v {x:.2f} {z:.2f} {-y:.2f}\n" for x, y, z in V))
        fo.write("".join(f"vn {x:.3f} {z:.3f} {-y:.3f}\n" for x, y, z in N))
        fo.write("".join(f"f {a + vo}//{a + vo} {b + vo}//{b + vo} {c + vo}//{c + vo}\n" for a, b, c in F))
        vo += len(V)
with open(os.path.join(OUT, "Owns_Cafe.mtl"), "w") as fm:
    for k in used:
        m = MATS[k]
        r, g, b = (c / 255 for c in m["rgb"])
        fm.write(f"newmtl OWN_{k}\nKd {r:.3f} {g:.3f} {b:.3f}\nNs {int((1 - m['rough']) * 200)}\n")
        if m["kind"] == "glass":
            fm.write("d 0.15\n")
        if m["kind"] == "emit":
            fm.write(f"Ke {r:.3f} {g:.3f} {b:.3f}\n")
        if m["tex"]:
            fm.write(f"map_Kd textures/{m['tex']}\n")
        fm.write("\n")
print("wrote", OUT, "| ms", os.path.getsize(os.path.join(OUT, "Owns_Cafe_build.ms")) // 1024, "KB")
