#!/usr/bin/env python3
"""Motion blur: average each frame's subframes (fNNNNN_sKK.png) in linear light into fNNNNN.png, then delete them."""
import glob, os, re, sys
from collections import defaultdict
import numpy as np
from PIL import Image

d = sys.argv[1]
groups = defaultdict(list)
for f in sorted(glob.glob(os.path.join(d, "f*_s*.png"))):
    groups[re.match(r"(f\d+)_s", os.path.basename(f)).group(1)].append(f)
for base, files in groups.items():
    acc = None
    for f in files:
        a = (np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255.0) ** 2.2
        acc = a if acc is None else acc + a
    out = ((acc / len(files)) ** (1 / 2.2) * 255.0 + 0.5).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(d, base + ".png"))
    for f in files: os.remove(f)
print(f"merged {len(groups)} blurred frames")
