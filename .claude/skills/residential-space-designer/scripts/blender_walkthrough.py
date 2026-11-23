"""Render a room model from layout_to_gltf.py as a still or a walkthrough video, in Blender.

Run with Blender (no window):
  blender -b -P blender_walkthrough.py -- room.glb out.mp4 [options]
or with the bpy Python module (pip install bpy, Python 3.11):
  python blender_walkthrough.py -- room.glb out.mp4 [options]

Options:
  --mode orbit     camera circles the room from above, looking in (default)
  --mode walk      camera stands at eye height just inside the door and looks around
  --still          render one frame to a PNG instead of a video (out.png)
  --frames N       video length in frames at 24 fps (default 120)
  --size WxH       resolution (default 1280x720)
  --engine E       workbench (fast, default), eevee, or cycles (slow, realistic)

Make the model first:  python3 layout_to_gltf.py layout.json room.glb
Tested with Blender 5.0 (bpy 5.0.1).
"""
import math
import sys

import bpy
from mathutils import Vector


def parse(argv):
    args = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    opts = {"mode": "orbit", "still": False, "frames": 120, "size": (1280, 720), "engine": "workbench"}
    files = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--still":
            opts["still"] = True
        elif a in ("--mode", "--frames", "--size", "--engine") and i + 1 < len(args):
            v = args[i + 1]
            i += 1
            if a == "--frames":
                opts["frames"] = max(2, int(v))
            elif a == "--size":
                w, h = v.lower().split("x")
                opts["size"] = (int(w), int(h))
            else:
                opts[a[2:]] = v
        else:
            files.append(a)
        i += 1
    if len(files) != 2 or opts["mode"] not in ("orbit", "walk") or opts["engine"] not in ("workbench", "eevee", "cycles"):
        sys.exit(__doc__)
    return files[0], files[1], opts


def room_bounds():
    """Bounding box of the imported floor (falls back to every mesh)."""
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    floor = [o for o in objs if o.name.startswith("floor")] or objs
    pts = [o.matrix_world @ Vector(c) for o in floor for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    tops = [(o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box]
    return lo, hi, max(tops) if tops else 2.7


def setup_engine(scene, engine):
    if engine == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
    elif engine == "eevee":
        names = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in names else "BLENDER_EEVEE"
    else:
        scene.render.engine = "BLENDER_WORKBENCH"
        shading = scene.display.shading
        shading.light = "STUDIO"
        shading.color_type = "MATERIAL"
        shading.show_shadows = False
        shading.show_cavity = True
        shading.cavity_type = "WORLD"
        shading.show_object_outline = True
    scene.view_settings.view_transform = "Standard"


def add_lights(centre, top):
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("sun", sun)
    sun_obj.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.context.scene.collection.objects.link(sun_obj)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 400
    fill.size = 4
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.location = (centre.x, centre.y, top + 2.5)
    bpy.context.scene.collection.objects.link(fill_obj)
    world = bpy.data.worlds.new("world")
    world.color = (0.9, 0.9, 0.88)
    bpy.context.scene.world = world


def add_camera(scene, mode, lo, hi, top, frames, still):
    centre = (lo + hi) / 2
    span = max(hi.x - lo.x, hi.y - lo.y)
    cam_data = bpy.data.cameras.new("camera")
    cam = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = bpy.data.objects.new("target", None)
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    entry = None
    e = bpy.context.scene.objects.get("entry")
    if e is not None:
        facing = e.get("facing")
        if facing is not None:
            entry = (e.matrix_world.translation.copy(), (float(facing[0]), float(facing[1])))
    n = 1 if still else frames
    scene.frame_start, scene.frame_end = 1, n
    for f in range(1, n + 1):
        turn = 2 * math.pi * (f - 1) / (n if not still else 1)
        if mode == "orbit":
            cam_data.lens = 30
            r = span * 0.95
            start = math.radians(-135)  # from the south-west corner, so W is on the left as in the plans
            cam.location = (centre.x + r * math.cos(start + turn), centre.y + r * math.sin(start + turn), top + span * 1.45)
            target.location = (centre.x, centre.y, 0.3)
        else:
            # stand just inside the door (the exporter's "entry" node) and look around the room:
            # sweep 70° each way from straight in and back; without a door, turn 360° at the centre
            cam_data.lens = 18
            if entry:
                pos, (fx, fy) = entry
                base = math.atan2(fy, fx)
                yaw = base + math.radians(70) * math.sin(turn) if not still else base
                cam.location = pos
            else:
                yaw = turn
                cam.location = (centre.x, centre.y, 1.6)
            target.location = (cam.location.x + math.cos(yaw), cam.location.y + math.sin(yaw), 1.35)
        cam.keyframe_insert("location", frame=f)
        target.keyframe_insert("location", frame=f)
    return centre


def set_output(scene, out, still, size):
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.fps = 24
    settings = scene.render.image_settings
    if still:
        if hasattr(settings, "media_type"):
            settings.media_type = "IMAGE"
        settings.file_format = "PNG"
    else:
        if hasattr(settings, "media_type"):  # Blender 5.0+
            settings.media_type = "VIDEO"
        settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.filepath = out


def main():
    src, out, opts = parse(sys.argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    scene = bpy.context.scene
    lo, hi, top = room_bounds()
    setup_engine(scene, opts["engine"])
    centre = add_camera(scene, opts["mode"], lo, hi, top, opts["frames"], opts["still"])
    add_lights(centre, top)
    set_output(scene, out, opts["still"], opts["size"])
    if opts["still"]:
        bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(animation=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
