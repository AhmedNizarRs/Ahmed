#!/usr/bin/env python3
"""Tile stills into one review sheet. usage: sheet.py out.jpg cols width file..."""
import sys
from PIL import Image
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in files]
h = round(w * ims[0].height / ims[0].width); rows = -(-len(ims) // cols)
sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (60, 60, 60))
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h), Image.LANCZOS), (6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 6)))
sheet.save(out, quality=88)
