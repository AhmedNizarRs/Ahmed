#!/usr/bin/env python3
"""Compose the placement pictures: wide scene + true-size close-up insets + caption.
Input: PNGs and px.json rendered by render2.js into IN. Output: ../previews/."""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
IN = sys.argv[1]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "previews")
B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BONE, BLACK, MID, YEL = (242,241,236), (11,12,14), (91,94,99), (255,199,0)
px = json.load(open(os.path.join(IN, "px.json")))
F = lambda p, s: ImageFont.truetype(p, s)

def nearest(rect, pt):
    x0, y0, x1, y1 = rect
    return (min(max(pt[0], x0), x1), min(max(pt[1], y0), y1))

def inset(canvas, tight, rect, mark, label):
    im = Image.open(os.path.join(IN, tight + ".png")).convert("RGB")
    tw, th = rect[2]-rect[0], rect[3]-rect[1]
    sc = max(tw / im.width, th / im.height); im = im.resize((round(im.width*sc), round(im.height*sc)), Image.LANCZOS)
    l, t = (im.width - tw)//2, (im.height - th)//2; im = im.crop((l, t, l+tw, t+th))
    d = ImageDraw.Draw(canvas)
    a = nearest(rect, mark)
    d.line([mark, a], fill=BLACK, width=5); d.line([mark, a], fill=YEL, width=2)
    d.ellipse((mark[0]-30, mark[1]-30, mark[0]+30, mark[1]+30), outline=BLACK, width=7)
    d.ellipse((mark[0]-30, mark[1]-30, mark[0]+30, mark[1]+30), outline=YEL, width=3)
    canvas.paste(im, rect[:2])
    d.rectangle(rect, outline=BLACK, width=6)
    f = F(B, 24); w = d.textlength(label, font=f)
    d.rectangle((rect[0], rect[1]-40, rect[0]+w+24, rect[1]), fill=BLACK); d.text((rect[0]+12, rect[1]-34), label, font=f, fill=BONE)

def caption(canvas, title, lines, band=190):
    W, H = canvas.size; out = Image.new("RGB", (W, H + band), BONE); out.paste(canvas, (0, 0)); d = ImageDraw.Draw(out)
    d.text((48, H + 26), title, font=F(B, 38), fill=BLACK)
    for i, l in enumerate(lines): d.text((48, H + 84 + i * 36), l, font=F(R, 24), fill=MID)
    return out

def scene(wide, key, insets, title, lines, outname):
    c = Image.open(os.path.join(IN, wide + ".png")).convert("RGB")
    for tight, mk, rect, label in insets:
        pt = px[wide][mk] if mk in px[wide] else None
        inset(c, tight, rect, pt, label)
    caption(c, title, lines).save(os.path.join(OUT, outname)); print("wrote", outname)

W1 = (1180, 780, 1780, 1180); W2 = (1200, 60, 1780, 400); BL = (40, 780, 640, 1180); TL = (40, 70, 640, 470)
scene("stairs_wide", "sticker", [("stairs_tight", "sticker", BL, "CLOSE-UP: strip A, 83 mm long")],
      "Stairs: strip A on the level stretch of a Ø40 mm rail",
      ["Placed where ISO 17049 puts handrail braille: at the end of the stair handrail, on the level extension.",
       "The strip is 83 mm long on a flight about 2.5 m long. Demo text; the braille must be checked by a braille reader."], "08_places-stairs.png")
scene("corridor_wide", "sticker", [("corridor_tight", "sticker", W1, "CLOSE-UP: strip C, 119 mm long")],
      "Hospital corridor: a long message on a flat timber rail",
      ["Same system, longer message: 'rooms 201 to 215' is 18 braille cells, 119 mm. A flat strip needs no wrapping on a flat-top rail.",
       "Demo text (uncontracted English braille). Rail size and shape are illustrative, not measured."], "09_places-hospital-corridor.png")
scene("pole_wide", "sticker", [("pole_tight", "sticker", W1, "CLOSE-UP: strip B, 64 mm long")],
      "Bus or metro: strip B along a vertical Ø32 mm pole",
      ["Braille runs along the pole, parallel to the rail as ISO 17049 asks. Where a hand lands on a moving vehicle's pole is untested.",
       "Interior is a stand-in, not a real vehicle. Colours illustrative."], "10_places-bus-metro-pole.png")
scene("door_wide", "plate", [("door_plate", "plate", W2, "CLOSE-UP: wall plate, latch side"), ("door_lever", "lever", W1, "CLOSE-UP: lever strip (illustration)")],
      "Classroom door: a strip on the lever and a plate on the wall",
      ["Wall plate at the latch side, centred 1400 mm up (US ADA: tactile characters 1220–1525 mm). The grey figure is a stand-in for scale.",
       "Lever bar ⌀19 mm is assumed; where a hand lands on a lever is untested. Demo text 'ROOM 15'."], "11_places-classroom-door.png")

# ---- family on a wall, with a ruler ----
c = Image.open(os.path.join(IN, "family_wide.png")).convert("RGB"); d = ImageDraw.Draw(c)
S = 1800 / 480.0
X = lambda x: (x + 240) * S; Y = lambda z: (160 - z) * S
items = [("W3  PRAYER ROOM", "185 × 42 mm · 11 cells", -127.35, 60, 21), ("W1  ROOM 15", "121 × 42 mm · 8 cells", 37.65, 60, 21), ("W2  EXIT", "87 × 42 mm · 4 cells", 153.5, 60, 21),
         ("A  braille + number", "83 × 23 mm", -160, -15, 11.5), ("C  rooms 201 to 215", "119 × 14 mm · 18 cells", -30, -15, 7), ("B  braille only", "64 × 14 mm", 90, -15, 7)]
for n, dim, x, z, hh in items:
    yy = Y(z - hh) + 14
    d.text((X(x) - d.textlength(n, font=F(B, 21)) / 2, yy), n, font=F(B, 21), fill=BLACK)
    d.text((X(x) - d.textlength(dim, font=F(R, 19)) / 2, yy + 27), dim, font=F(R, 19), fill=MID)
# ruler: 0 at x=-230 mm, ticks every 10 mm
y0 = Y(-92); d.rectangle((X(-230), y0, X(230), y0 + 14), fill=BLACK)
for mm in range(0, 461, 10):
    x = X(-230 + mm); L = 30 if mm % 50 == 0 else 18
    d.line([(x, y0), (x, y0 - L)], fill=BLACK, width=2)
    if mm % 50 == 0: d.text((x - d.textlength(str(mm), font=F(R, 20)) / 2, y0 + 20), str(mm), font=F(R, 20), fill=BLACK)
d.text((X(230) - 6, y0 + 44), "mm", font=F(R, 20), fill=MID)
caption(c, "Same system on walls: three plate sizes and three rail strips, one scale",
        ["Size follows the message: about 6.2 mm of length for each braille cell. Plates add raised 16 mm letters, braille below with 9.5 mm clear.",
         "Same dots, edges and 0.5 mm base on rail and wall. All printed flat from the STL files. Demo text: a braille reader must check it."]).save(os.path.join(OUT, "12_wall-plates-and-scale.png"))
print("wrote 12_wall-plates-and-scale.png")
