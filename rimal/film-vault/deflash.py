#!/usr/bin/env python3
"""Screen recordings sometimes redraw with one blank frame. Replace any single frame whose brightness jumps away
from both neighbours (while the neighbours agree) with the frame before it. usage: deflash.py footage/<clip> ..."""
import glob, shutil, sys
from PIL import Image, ImageStat
for d in sys.argv[1:]:
    fs = sorted(glob.glob(d + "/*.jpg")); m = [ImageStat.Stat(Image.open(f).convert("L").resize((96, 80))).mean[0] for f in fs]; n = 0
    for i in range(1, len(fs) - 1):
        if abs(m[i] - m[i - 1]) > 3.5 and abs(m[i] - m[i + 1]) > 3.5 and abs(m[i + 1] - m[i - 1]) < 2.0:
            shutil.copyfile(fs[i - 1], fs[i]); m[i] = m[i - 1]; n += 1
    print(d, "fixed", n)
