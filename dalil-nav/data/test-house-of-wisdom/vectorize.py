"""Floor-plan picture -> wall segments (pixels). Bold walls (3+ px) at any length, medium lines (2 px) only when long and straight."""
import sys, json
import numpy as np
from PIL import Image, ImageFilter

def runs_1d(row, minlen):
    out = []; x = 0; n = len(row)
    d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
    starts = np.where(d == 1)[0]; ends = np.where(d == -1)[0]
    return [(s, e - 1) for s, e in zip(starts, ends) if e - s >= minlen]

def rects(mask, minlen, maxthick):
    """Horizontal runs merged across consecutive rows into rectangles -> [(x0, x1, y0, y1)]."""
    open_, done = [], []
    for y in range(mask.shape[0]):
        rs = runs_1d(mask[y], minlen); nxt = []
        for (x0, x1) in rs:
            hit = None
            for r in open_:
                ov = min(x1, r[1]) - max(x0, r[0])
                if ov > 0.7 * min(x1 - x0, r[1] - r[0]): hit = r; break
            if hit: open_.remove(hit); nxt.append([min(x0, hit[0]), max(x1, hit[1]), hit[2], y])
            else: nxt.append([x0, x1, y, y])
        done += [r for r in open_]; open_ = nxt
    done += open_
    return [tuple(r) for r in done if (r[3] - r[2] + 1) <= maxthick]

def walls(path, bold_min=8, med_min=36):
    g = np.array(Image.open(path).convert('L'))
    dark = g < 120
    bold = np.array(Image.fromarray((dark * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0
    med = (g < 150)
    medh = med & np.roll(med, 1, axis=0)   # 2 px thick vertically -> a horizontal line of weight 2+
    medv = med & np.roll(med, 1, axis=1)
    segs = []
    for m, minlen, kind in ((bold, bold_min, 'bold'), (medh, med_min, 'med')):
        for x0, x1, y0, y1 in rects(m, minlen, 12):
            segs.append(((x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2), kind))
    for m, minlen, kind in ((bold, bold_min, 'bold'), (medv, med_min, 'med')):
        for y0, y1, x0, x1 in rects(m.T, minlen, 12):
            segs.append((((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1), kind))
    return segs

if __name__ == '__main__':
    segs = walls(sys.argv[1])
    print(len(segs), 'segments', sum(1 for s in segs if s[2] == 'bold'), 'bold')
    json.dump([[[float(a[0]), float(a[1])], [float(b[0]), float(b[1])], k] for a, b, k in segs], open(sys.argv[2], 'w'))
