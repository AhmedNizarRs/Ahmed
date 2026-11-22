"""D5 Render-friendly FBX: clear material names, textures embedded, car included, no helper lights.
Run with Blender's Python:  python export_d5.py <Owns_Cafe.blend> <out.fbx>"""
import sys, bpy
src, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.open_mainfile(filepath=src)
NAMES = {
    "glass": "Glass_Clear", "glass_dark": "Glass_Tinted", "glass_satin": "Glass_Frosted",
    "sign_glow": "Emissive_Logo_White", "sign_glow_dt": "Emissive_Logo_White_DriveThru", "logo_white": "Emissive_Logo_White_Interior",
    "led_warm": "Emissive_LED_Strip_Warm", "led_hidden": "Emissive_LED_Strip_Hidden", "led_halo": "Emissive_Halo",
    "led_halo_soft": "Emissive_Halo_Soft", "led_cool": "Emissive_LED_Cool", "bulb": "Emissive_Bulb",
    "shop_glow": "Emissive_Neighbour_Shop", "screen": "Emissive_Screen_Cashier",
    "screen_ad": "Emissive_Screen_Ad (screen_ad.png)", "screen_owns": "Emissive_Screen_SideSign (screen_owns.png)",
    "stone": "Stone_Travertine", "marble_white": "Marble_White_Desk", "floor": "Floor_Microcement",
    "moss": "Moss_Wall", "plaster_white": "Plaster_Walls", "ceiling": "Plaster_Ceiling", "plaster_ext": "Plaster_Neighbours",
    "champagne": "Metal_Champagne", "metal_black": "Metal_Black", "steel": "Metal_Steel", "brass": "Metal_Brass",
    "boucle": "Fabric_Boucle", "hessian": "Fabric_Jute", "leaves": "Plant_Leaves", "leaves_b": "Plant_Leaves_Light",
    "leaves_green": "Plant_Leaves_Indoor", "asphalt": "Road_Asphalt", "paver": "Paving", "curb": "Curb_Concrete",
}
for m in bpy.data.materials:
    k = m.name[4:] if m.name.startswith("OWN_") else None
    if k:
        m.name = NAMES.get(k, k.replace("_", " ").title().replace(" ", "_"))
for o in list(bpy.data.objects):          # D5 lights its own way: drop helper lights, keep cameras
    if o.type == "LIGHT":
        bpy.data.objects.remove(o)
bpy.ops.file.unpack_all(method="WRITE_LOCAL") if False else None
bpy.ops.export_scene.fbx(filepath=out, use_selection=False, object_types={"MESH", "CAMERA"},
                         apply_unit_scale=True, axis_forward="-Z", axis_up="Y", mesh_smooth_type="FACE",
                         path_mode="COPY", embed_textures=True)
print("wrote", out)
