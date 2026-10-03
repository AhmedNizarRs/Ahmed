/**
 * Build-time generator for a topographic "site plan" of a dune field.
 * A height field of sinuous transverse dunes (gentle windward slope, steep slip face)
 * is traced with marching squares, the segments are stitched into polylines and
 * smoothed into SVG paths. Deterministic: same seed → same drawing.
 */

export interface TopoOptions {
  width: number;
  height: number;
  cell?: number;
  levels?: number;
  seed?: number;
}

export interface Contour {
  d: string;
  level: number;
  /** Rough length, used to stagger the draw-in animation. */
  len: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function topo({ width, height, cell = 6, levels = 11, seed = 7 }: TopoOptions): { lines: Contour[]; peaks: { x: number; y: number; h: number }[] } {
  const r = rng(seed);
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;

  // Dune crests: sinuous lines running across the plan, wind blowing "down" the sheet.
  const crests = Array.from({ length: 4 }, (_, k) => ({
    y0: height * (0.16 + k * 0.25) + (r() - 0.5) * 18,
    amp: 16 + r() * 22,
    freq: (Math.PI * 2) / (width * (0.55 + r() * 0.5)),
    phase: r() * Math.PI * 2,
    // along-crest height modulation → crests break into crescent (barchan) segments
    mFreq: (Math.PI * 2) / (width * (0.32 + r() * 0.3)),
    mPhase: r() * Math.PI * 2,
    h: 0.85 + r() * 0.3,
  }));

  const field = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = j * cell;
    for (let i = 0; i < cols; i++) {
      const x = i * cell;
      let v = 0;
      for (const c of crests) {
        const cy = c.y0 + c.amp * Math.sin(x * c.freq + c.phase);
        const d = y - cy;
        // windward (above the crest) is long and gentle; slip face (below) is short and steep
        const w = d < 0 ? 46 : 13;
        const along = 0.55 + 0.45 * Math.sin(x * c.mFreq + c.mPhase);
        v = Math.max(v, c.h * along * Math.exp(-((d / w) ** 2)));
      }
      field[j * cols + i] = v;
    }
  }

  // Spot heights: local maxima, spaced apart, highest first.
  const peaks: { x: number; y: number; h: number }[] = [];
  const cand: { x: number; y: number; h: number }[] = [];
  for (let j = 2; j < rows - 2; j++)
    for (let i = 2; i < cols - 2; i++) {
      const v = field[j * cols + i];
      if (v < 0.6) continue;
      let max = true;
      for (let dj = -2; dj <= 2 && max; dj++)
        for (let di = -2; di <= 2; di++) if (field[(j + dj) * cols + i + di] > v) { max = false; break; }
      if (max) cand.push({ x: i * cell, y: j * cell, h: v });
    }
  cand.sort((a, b) => b.h - a.h);
  for (const c of cand) if (peaks.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > width * 0.17)) peaks.push(c);

  const out: Contour[] = [];
  for (let l = 1; l <= levels; l++) {
    const iso = l / (levels + 1);
    const segs: [number, number, number, number][] = [];
    const lerp = (a: number, b: number) => (iso - a) / (b - a);
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i];
        const b = field[j * cols + i + 1];
        const c = field[(j + 1) * cols + i + 1];
        const d = field[(j + 1) * cols + i];
        const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell;
        const y = j * cell;
        const top: [number, number] = [x + lerp(a, b) * cell, y];
        const right: [number, number] = [x + cell, y + lerp(b, c) * cell];
        const bottom: [number, number] = [x + lerp(d, c) * cell, y + cell];
        const left: [number, number] = [x, y + lerp(a, d) * cell];
        const add = (p: [number, number], q: [number, number]) => segs.push([p[0], p[1], q[0], q[1]]);
        switch (idx) {
          case 1: case 14: add(left, bottom); break;
          case 2: case 13: add(bottom, right); break;
          case 3: case 12: add(left, right); break;
          case 4: case 11: add(top, right); break;
          case 6: case 9: add(top, bottom); break;
          case 7: case 8: add(left, top); break;
          case 5: add(left, top); add(bottom, right); break;
          case 10: add(top, right); add(left, bottom); break;
        }
      }
    }

    // Stitch segments into polylines by shared endpoints.
    const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
    const ends = new Map<string, number[]>();
    segs.forEach((s, n) => {
      for (const k of [key(s[0], s[1]), key(s[2], s[3])]) {
        const list = ends.get(k);
        if (list) list.push(n);
        else ends.set(k, [n]);
      }
    });
    const used = new Uint8Array(segs.length);
    for (let n = 0; n < segs.length; n++) {
      if (used[n]) continue;
      used[n] = 1;
      const line: [number, number][] = [
        [segs[n][0], segs[n][1]],
        [segs[n][2], segs[n][3]],
      ];
      for (const dir of [1, -1]) {
        for (;;) {
          const tip = dir === 1 ? line[line.length - 1] : line[0];
          const next = (ends.get(key(tip[0], tip[1])) ?? []).find((m) => !used[m]);
          if (next === undefined) break;
          used[next] = 1;
          const s = segs[next];
          const p: [number, number] = key(s[0], s[1]) === key(tip[0], tip[1]) ? [s[2], s[3]] : [s[0], s[1]];
          if (dir === 1) line.push(p);
          else line.unshift(p);
        }
      }
      if (line.length < 6) continue;
      // Thin the points, then smooth.
      const pts = line.filter((_, i) => i % 3 === 0 || i === line.length - 1);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len < 24) continue;
      out.push({ d: smooth(pts), level: l, len });
    }
  }
  return { lines: out, peaks };
}

function smooth(pts: [number, number][]) {
  const f = (n: number) => String(Math.round(n));
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
