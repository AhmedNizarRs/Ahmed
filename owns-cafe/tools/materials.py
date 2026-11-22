"""Shared material library (3ds Max Physical Material, Blender Principled BSDF, OBJ).

key: dict(rgb 0-255, rough, metal, tex (file in textures/), size (cm per texture tile),
          kind: '' | 'glass' | 'glass_dark' | 'satin' | 'leaf' | 'emit', lum (cd/m2 for emitters / satin glow),
          bump (0-1), bumptex (height map file), coat)
"""
MATS = {
    "stone":         dict(rgb=(222, 210, 190), rough=.55, metal=0, tex="travertine.jpg", size=360, bump=.5, bumptex="travertine_bump.jpg"),
    "floor":         dict(rgb=(236, 231, 222), rough=.18, metal=0, tex="floor_tile.jpg", size=120, coat=.3),
    "oak":           dict(rgb=(196, 160, 118), rough=.45, metal=0, tex="oak.jpg", size=100, bump=.15),
    "brass":         dict(rgb=(214, 172, 100), rough=.28, metal=1, tex="brass.jpg", size=50),
    "plaster_white": dict(rgb=(239, 236, 230), rough=.85, metal=0),
    "plaster_sand":  dict(rgb=(214, 194, 166), rough=.85, metal=0),
    "plaster_ext":   dict(rgb=(186, 174, 158), rough=.9, metal=0, tex="plaster.jpg", size=600),
    "ceiling":       dict(rgb=(242, 240, 234), rough=.9, metal=0),
    "lacquer_white": dict(rgb=(241, 239, 234), rough=.3, metal=0),
    "door_white":    dict(rgb=(235, 231, 223), rough=.4, metal=0),
    "quartz":        dict(rgb=(244, 241, 236), rough=.12, metal=0, coat=.4),
    "metal_black":   dict(rgb=(20, 20, 20), rough=.38, metal=.7),
    "steel":         dict(rgb=(205, 205, 205), rough=.25, metal=1),
    "glass":         dict(rgb=(235, 245, 243), rough=0, metal=0, kind="glass"),
    "glass_dark":    dict(rgb=(40, 50, 56), rough=.05, metal=0, kind="glass_dark"),
    "glass_satin":   dict(rgb=(236, 232, 224), rough=.35, metal=0, kind="satin", lum=7),
    "mirror":        dict(rgb=(240, 240, 240), rough=.02, metal=1),
    "ceramic":       dict(rgb=(246, 246, 244), rough=.1, metal=0, coat=.5),
    "paver":         dict(rgb=(176, 169, 157), rough=.5, metal=0, tex="paver.jpg", size=120, bump=.3),
    "curb":          dict(rgb=(190, 184, 174), rough=.7, metal=0),
    "asphalt":       dict(rgb=(44, 44, 46), rough=.55, metal=0, tex="asphalt.jpg", size=200, bump=.3),
    "paint_yellow":  dict(rgb=(201, 162, 39), rough=.7, metal=0),
    "planter":       dict(rgb=(226, 219, 207), rough=.75, metal=0),
    "soil":          dict(rgb=(58, 43, 31), rough=1, metal=0),
    "bark":          dict(rgb=(90, 70, 50), rough=.9, metal=0),
    "leaves":        dict(rgb=(96, 110, 74), rough=.5, metal=0, kind="leaf"),
    "leaves_b":      dict(rgb=(128, 136, 104), rough=.5, metal=0, kind="leaf"),
    "pastry":        dict(rgb=(176, 116, 58), rough=.45, metal=0, bump=.6),
    "pastry_dark":   dict(rgb=(92, 56, 32), rough=.55, metal=0, bump=.6),
    "paper":         dict(rgb=(232, 224, 210), rough=.8, metal=0),
    "screen":        dict(rgb=(60, 80, 105), rough=.05, metal=0, kind="emit", lum=60),
    "sign_glow":     dict(rgb=(255, 232, 196), rough=.5, metal=0, kind="emit", lum=500),
    "led_warm":      dict(rgb=(255, 196, 128), rough=.5, metal=0, kind="emit", lum=6000),
    "led_hidden":    dict(rgb=(255, 196, 128), rough=.5, metal=0, kind="emit", lum=12000),
    "led_halo":      dict(rgb=(255, 200, 135), rough=.5, metal=0, kind="emit", lum=9000),
    "led_cool":      dict(rgb=(243, 246, 255), rough=.5, metal=0, kind="emit", lum=1500),
    "bulb":          dict(rgb=(255, 210, 154), rough=.5, metal=0, kind="emit", lum=8000),
}
for _k, _m in MATS.items():
    _m.setdefault("tex", None)
    _m.setdefault("size", 100)
    _m.setdefault("kind", "")
    _m.setdefault("lum", 0)
    _m.setdefault("bump", 0)
    _m.setdefault("coat", 0)
    _m.setdefault("bumptex", None)
