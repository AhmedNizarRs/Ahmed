"""Prepare the Nissan Patrol 2021 model for the scene (run with Blender's Python / bpy).

Source: "Nissan Patrol 2021" by Nieve5677, https://sketchfab.com/3d-models/nissan-patrol-2021-9a2cda9f9a11474aa069e1895ff93443
License: CC-BY-4.0 (credit the author).

Assigns real materials (pearl-white paint, chrome, tinted glass, rubber, lit head/tail lamps), scales the car to
5.17 m long with its origin at the centre of its footprint on the ground, front pointing -Y, decimates heavy parts,
and writes car/Nissan_Patrol_2021.glb (for rendering) and car/Nissan_Patrol_2021.fbx (for 3ds Max).

  python prepare_car.py <scene.gltf> <out_dir> [--ratio 0.3]
"""
import sys, os, argparse, math
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--ratio", type=float, default=0.3)
ap.add_argument("--length", type=float, default=5.17)
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(A.src))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def principled(name):
    m = bpy.data.materials.get(name)
    if m is None:
        return None, None
    m.use_nodes = True
    bs = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bs is None:
        bs = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        out = next(n for n in m.node_tree.nodes if n.type == "OUTPUT_MATERIAL")
        m.node_tree.links.new(bs.outputs[0], out.inputs["Surface"])
    for l in list(m.node_tree.links):          # drop any texture links from the import
        if l.to_node == bs and l.to_socket.name in ("Base Color", "Metallic", "Roughness"):
            m.node_tree.links.remove(l)
    return m, bs


def setm(name, col, rough, metal=0.0, coat=0.0, trans=0.0, emit=None, estr=0.0, ior=1.5):
    m, bs = principled(name)
    if bs is None:
        return
    bs.inputs["Base Color"].default_value = (*col, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    bs.inputs["Coat Weight"].default_value = coat
    bs.inputs["Coat Roughness"].default_value = 0.03
    bs.inputs["Transmission Weight"].default_value = trans
    bs.inputs["IOR"].default_value = ior
    if emit:
        bs.inputs["Emission Color"].default_value = (*emit, 1)
        bs.inputs["Emission Strength"].default_value = estr


setm("body", (0.82, 0.82, 0.80), 0.28, 0.0, coat=1.0)                    # pearl white
setm("black", (0.015, 0.015, 0.015), 0.45)
setm("black_matt", (0.02, 0.02, 0.02), 0.8)
setm("black_shiny", (0.01, 0.01, 0.01), 0.12, coat=0.6)
setm("chrome", (0.92, 0.92, 0.92), 0.04, 1.0)
setm("silver", (0.70, 0.71, 0.72), 0.25, 1.0)
setm("rims", (0.62, 0.63, 0.64), 0.22, 1.0)
setm("brakes1", (0.25, 0.25, 0.25), 0.4, 0.8)
setm("tire_mat1", (0.025, 0.025, 0.025), 0.85)
setm("interior", (0.10, 0.085, 0.07), 0.6)
setm("material", (0.05, 0.05, 0.05), 0.6)
setm("plate", (0.85, 0.85, 0.82), 0.4)
setm("glass_stripe", (0.01, 0.01, 0.01), 0.3)
setm("glass", (0.30, 0.33, 0.34), 0.0, trans=1.0)
setm("d_glass", (0.10, 0.11, 0.12), 0.0, trans=1.0)
setm("vd_glass", (0.05, 0.05, 0.06), 0.0, trans=1.0)
setm("o_glass", (0.95, 0.45, 0.05), 0.0, trans=1.0)
setm("orange", (0.9, 0.35, 0.02), 0.2)
setm("r_glass", (0.75, 0.03, 0.02), 0.0, trans=1.0, emit=(1.0, 0.04, 0.02), estr=0.6)
setm("d_red", (0.35, 0.01, 0.01), 0.15, emit=(1.0, 0.03, 0.01), estr=0.4)
setm("r_lights", (0.5, 0.02, 0.02), 0.2, emit=(1.0, 0.05, 0.02), estr=3.0)      # tail lamps on
setm("lights", (0.85, 0.85, 0.85), 0.1, 0.6, emit=(1.0, 0.96, 0.9), estr=6.0)    # head lamps / DRL on

# decimate heavy parts (then delete any stray vertex the collapse pushed outside the part's original bounds)
import bmesh
tot0 = tot1 = 0
for o in meshes:
    n = len(o.data.polygons)
    tot0 += n
    bb0 = [Vector(c) for c in o.bound_box]
    lo = Vector(map(min, *bb0)); hi = Vector(map(max, *bb0))
    pad = (hi - lo) * 0.01 + Vector((1e-4,) * 3)
    lo -= pad; hi += pad
    if n > 4000:
        md = o.modifiers.new("dec", "DECIMATE")
        md.ratio = A.ratio
        md.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        with bpy.context.temp_override(object=o):
            bpy.ops.object.modifier_apply(modifier=md.name)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bad = [v for v in bm.verts if not all(lo[i] <= v.co[i] <= hi[i] for i in range(3))]
        if bad:
            bmesh.ops.delete(bm, geom=bad, context="VERTS")
            bm.to_mesh(o.data)
        bm.free()
    tot1 += len(o.data.polygons)
print(f"faces {tot0} -> {tot1}")

# normalize: bake all transforms, scale to length, origin at footprint centre on the ground
for o in bpy.context.scene.objects:
    o.select_set(o.type == "MESH")
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)
mn = Vector((1e9,) * 3); mx = -mn
for o in meshes:
    for v in o.data.vertices:
        mn = Vector(map(min, mn, v.co)); mx = Vector(map(max, mx, v.co))
k = A.length / (mx.y - mn.y)
off = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
for o in meshes:
    me = o.data
    for v in me.vertices:
        v.co = (v.co - off) * k
    me.update()
bpy.ops.object.join() if len(meshes) > 1 else None
car = bpy.context.view_layer.objects.active
car.name = "Car_Nissan_Patrol_2021"
dims = car.dimensions
print("car size m:", tuple(round(d, 3) for d in dims))

glb = os.path.join(os.path.abspath(A.out), "Nissan_Patrol_2021.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False)
bpy.ops.export_scene.fbx(filepath=os.path.join(os.path.abspath(A.out), "Nissan_Patrol_2021.fbx"),
                         use_selection=False, object_types={"MESH"}, apply_unit_scale=True,
                         axis_forward="-Z", axis_up="Y", mesh_smooth_type="FACE")
with open(os.path.join(os.path.abspath(A.out), "CREDIT.txt"), "w") as f:
    f.write('This work is based on "Nissan Patrol 2021" (https://sketchfab.com/3d-models/nissan-patrol-2021-'
            '9a2cda9f9a11474aa069e1895ff93443) by Nieve5677 (https://sketchfab.com/niev) licensed under CC-BY-4.0 '
            '(http://creativecommons.org/licenses/by/4.0/). Modified: materials assigned, scaled to 5.17 m, decimated.\n')
print("wrote", glb)
