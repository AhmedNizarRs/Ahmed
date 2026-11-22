"""Build the Owns Cafe scene in Blender (bpy), render with Cycles, save .blend and export FBX.

Run with Blender's Python (bpy module):
  python blender_scene.py meshes.json textures_dir out_dir [--render CAM1,CAM2|all] [--samples 128]
                          [--res 1600x900] [--exposure 4.5] [--fbx] [--blend]
"""
import sys, os, json, math, argparse
import numpy as np
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from materials import MATS

ap = argparse.ArgumentParser()
ap.add_argument("meshes"); ap.add_argument("tex"); ap.add_argument("out")
ap.add_argument("--render", default="")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--res", default="1600x900")
ap.add_argument("--exposure", type=float, default=4.5)
ap.add_argument("--fbx", action="store_true")
ap.add_argument("--blend", action="store_true")
ap.add_argument("--emit_scale", type=float, default=1.0)
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)
D = json.load(open(A.meshes))
CM = 0.01
K683 = 683.0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def kelvin_rgb(k):
    t = k / 100
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.1 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.0)
    return tuple(lin(min(max(v, 0), 255)) for v in (r, g, b))


# ------------------------------------------------------------------ materials
IMG = {}


def image(fn):
    if fn not in IMG:
        IMG[fn] = bpy.data.images.load(os.path.join(os.path.abspath(A.tex), fn))
    return IMG[fn]


def make_mat(key):
    m = MATS[key]
    mat = bpy.data.materials.new("OWN_" + key)
    mat.use_nodes = True
    nt = mat.node_tree
    N, Lk = nt.nodes, nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    col = tuple(lin(c) for c in m["rgb"]) + (1.0,)
    if m["kind"] == "emit":
        em = N.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = col
        em.inputs["Strength"].default_value = m["lum"] / K683 * A.emit_scale
        Lk.new(em.outputs[0], out.inputs["Surface"])
        return mat
    bs = N.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Roughness"].default_value = m["rough"]
    bs.inputs["Metallic"].default_value = m["metal"]
    if m["coat"]:
        bs.inputs["Coat Weight"].default_value = m["coat"]
        bs.inputs["Coat Roughness"].default_value = 0.05
    height = None
    if m["tex"]:
        ti = N.new("ShaderNodeTexImage")
        ti.image = image(m["tex"])
        Lk.new(ti.outputs["Color"], bs.inputs["Base Color"])
        height = ti.outputs["Color"]
        if key == "floor":   # subtle roughness variation from the marble
            mr = N.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value = 0.12
            mr.inputs["To Max"].default_value = 0.30
            Lk.new(ti.outputs["Color"], mr.inputs["Value"])
            Lk.new(mr.outputs[0], bs.inputs["Roughness"])
    if m["bumptex"]:
        tb = N.new("ShaderNodeTexImage")
        tb.image = image(m["bumptex"])
        tb.image.colorspace_settings.name = "Non-Color"
        height = tb.outputs["Color"]
    if m["bump"]:
        if height is None:
            nz = N.new("ShaderNodeTexNoise")
            nz.inputs["Scale"].default_value = 180.0
            nz.inputs["Detail"].default_value = 8.0
            tc = N.new("ShaderNodeTexCoord")
            Lk.new(tc.outputs["Object"], nz.inputs["Vector"])
            height = nz.outputs["Fac"]
        bp = N.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = m["bump"] * 0.5
        bp.inputs["Distance"].default_value = 0.002
        Lk.new(height, bp.inputs["Height"])
        Lk.new(bp.outputs["Normal"], bs.inputs["Normal"])
    shader = bs.outputs[0]
    if m["kind"] == "satin":       # satin / back-lit frosted glass
        bs.inputs["Transmission Weight"].default_value = 1.0
        bs.inputs["Roughness"].default_value = m["rough"]
        bs.inputs["Emission Color"].default_value = col
        bs.inputs["Emission Strength"].default_value = m["lum"] / K683
    if m["kind"] == "leaf":        # thin translucent leaves
        trn = N.new("ShaderNodeBsdfTranslucent")
        trn.inputs["Color"].default_value = tuple(min(1, c * 1.3) for c in col[:3]) + (1,)
        mxl = N.new("ShaderNodeMixShader")
        mxl.inputs["Fac"].default_value = 0.3
        Lk.new(bs.outputs[0], mxl.inputs[1])
        Lk.new(trn.outputs[0], mxl.inputs[2])
        shader = mxl.outputs[0]
    if m["kind"] in ("glass", "glass_dark"):
        bs.inputs["Transmission Weight"].default_value = 1.0 if m["kind"] == "glass" else 0.5
        bs.inputs["IOR"].default_value = 1.52
        bs.inputs["Roughness"].default_value = 0.0 if m["kind"] == "glass" else 0.05
        if m["kind"] == "glass":
            bs.inputs["Base Color"].default_value = (0.92, 0.97, 0.96, 1)
        # let light pass through glass for shadow rays (architectural glass)
        lp = N.new("ShaderNodeLightPath")
        tr = N.new("ShaderNodeBsdfTransparent")
        tr.inputs["Color"].default_value = (0.9, 0.95, 0.94, 1)
        mx = N.new("ShaderNodeMixShader")
        Lk.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"])
        Lk.new(bs.outputs[0], mx.inputs[1])
        Lk.new(tr.outputs[0], mx.inputs[2])
        shader = mx.outputs[0]
    Lk.new(shader, out.inputs["Surface"])
    return mat


MAT = {k: make_mat(k) for k in sorted({o["m"] for o in D["objects"]})}

# ------------------------------------------------------------------ meshes
COLL = {}


def coll(name):
    if name not in COLL:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        COLL[name] = c
    return COLL[name]


for o in D["objects"]:
    V = np.array(o["v"], dtype=np.float64).reshape(-1, 3) * CM
    F = np.array(o["f"], dtype=np.int64).reshape(-1, 3)
    me = bpy.data.meshes.new(o["n"])
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(len(F) * 3)
    me.loops.foreach_set("vertex_index", F.astype(np.int32).ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set("loop_start", (np.arange(len(F)) * 3).astype(np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(len(F), dtype=bool))
    # box-projected UVs (cm / tile size), per face corner
    size = MATS[o["m"]]["size"]
    P = V[F] / CM                     # (nf,3,3) cm
    fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    ax = np.argmax(np.abs(fn), axis=1)
    uv = np.zeros((len(F), 3, 2))
    for a, (iu, iv) in enumerate(((1, 2), (0, 2), (0, 1))):
        sel = ax == a
        uv[sel, :, 0] = P[sel][:, :, iu] / size
        uv[sel, :, 1] = P[sel][:, :, iv] / size
    ul = me.uv_layers.new(name="UVMap")
    ul.data.foreach_set("uv", uv.astype(np.float32).ravel())
    me.materials.append(MAT[o["m"]])
    me.validate()
    ob = bpy.data.objects.new(o["n"], me)
    coll(o["l"]).objects.link(ob)

# ------------------------------------------------------------------ lights
lc = coll("13_Lights")
for l in D["lights"]:
    if l.get("maxonly"):
        continue
    cd = l["cd"]
    if l["kind"] == "spot":
        ld = bpy.data.lights.new(l["n"], "SPOT")
        ld.energy = cd * 4 * math.pi / K683
        ld.spot_size = math.radians(l["fall"])
        ld.spot_blend = max(0.05, min(1.0, 1 - l["hot"] / l["fall"]))
        ld.shadow_soft_size = 0.015
    elif l["kind"] == "diffuse":
        ld = bpy.data.lights.new(l["n"], "AREA")
        ld.shape = "DISK"
        ld.size = 0.3
        ld.energy = cd * math.pi / K683
    else:
        ld = bpy.data.lights.new(l["n"], "POINT")
        ld.energy = cd * 4 * math.pi / K683
        ld.shadow_soft_size = 0.03
    try:
        ld.use_temperature = True
        ld.temperature = l["k"]
    except Exception:
        ld.color = kelvin_rgb(l["k"])
    ob = bpy.data.objects.new(l["n"], ld)
    ob.location = Vector(l["p"]) * CM
    if l["aim"] == "up":
        ob.rotation_euler = (math.pi, 0, 0)
    lc.objects.link(ob)

# ------------------------------------------------------------------ cameras (two-point perspective)
cc = coll("14_Cameras")
CAMS = {}
for c in D["cameras"]:
    cd = bpy.data.cameras.new(c["n"])
    cd.lens = c["mm"]
    cd.sensor_width = 36
    cd.sensor_fit = "HORIZONTAL"
    cd.clip_start = 0.05
    cd.clip_end = 300
    ob = bpy.data.objects.new(c["n"], cd)
    p, t = Vector(c["p"]) * CM, Vector(c["t"]) * CM
    d = t - p
    dh = Vector((d.x, d.y, 0))
    ob.location = p
    ob.rotation_euler = dh.to_track_quat("-Z", "Y").to_euler()
    cd.shift_y = (d.z / dh.length) * cd.lens / 36.0     # keep verticals vertical
    cc.objects.link(ob)
    CAMS[c["n"]] = ob

# ------------------------------------------------------------------ world + render settings
world = bpy.data.worlds.new("Night")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
wn, wl = world.node_tree.nodes, world.node_tree.links
tcw = wn.new("ShaderNodeTexCoord")
sep = wn.new("ShaderNodeSeparateXYZ")
ramp = wn.new("ShaderNodeValToRGB")          # night sky: deep navy zenith, softer haze at the horizon
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (0.020, 0.024, 0.040, 1)
ramp.color_ramp.elements[1].position = 0.45
ramp.color_ramp.elements[1].color = (0.0025, 0.004, 0.011, 1)
wl.new(tcw.outputs["Generated"], sep.inputs[0])
wl.new(sep.outputs["Z"], ramp.inputs["Fac"])
wl.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.16

scene.render.engine = "CYCLES"
cy = scene.cycles
cy.device = "CPU"
cy.samples = A.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
try:
    cy.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
cy.max_bounces = 8
cy.diffuse_bounces = 4
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 16
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.sample_clamp_indirect = 8.0
cy.blur_glossy = 1.0
try:
    cy.use_light_tree = True
except Exception:
    pass
W, H = (int(v) for v in A.res.split("x"))
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass
scene.view_settings.exposure = A.exposure
try:   # camera white balance so 3000 K interiors read warm, not orange/pink
    scene.view_settings.use_white_balance = True
    scene.view_settings.white_balance_temperature = 4300
except Exception as ex:
    print("no white balance:", ex)
scene.render.threads_mode = "AUTO"

if A.blend:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(A.out), "Owns_Cafe.blend"), compress=True)
if A.fbx:
    bpy.ops.export_scene.fbx(filepath=os.path.join(os.path.abspath(A.out), "Owns_Cafe.fbx"),
                             use_selection=False, object_types={"MESH", "CAMERA", "LIGHT"},
                             apply_unit_scale=True, global_scale=1.0, axis_forward="-Z", axis_up="Y",
                             mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)

names = list(CAMS) if A.render == "all" else [n for n in A.render.split(",") if n]
for n in names:
    ev = A.exposure
    if ":" in n:
        n, ev = n.split(":")
        ev = float(ev)
    scene.view_settings.exposure = ev
    scene.camera = CAMS[n]
    scene.render.filepath = os.path.join(os.path.abspath(A.out), n + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", n, flush=True)
