"""Command-line interface:  python -m videoforge INPUT [OUTPUT] [options]"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .models import UPSCALE_MODELS
from .pipeline import RESOLUTIONS, Settings, enhance_video, plan
from .video import ENCODERS, probe


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="videoforge",
        description="AI video enhancement: upscale, denoise, stabilise, interpolate.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python -m videoforge clip.mp4 --scale 2
  python -m videoforge clip.mp4 --res 4k --model quality --sharpen 0.4
  python -m videoforge clip.mp4 --model none --fps 60          # interpolation only
  python -m videoforge clip.mp4 --slowmo 4 --model none        # 4x slow motion
  python -m videoforge old.mp4 --res 1080p --pre-denoise 0.6 --stabilize
  python -m videoforge clip.mp4 --scale 2 --start 10 --duration 3   # quick preview""")
    ap.add_argument("input")
    ap.add_argument("output", nargs="?", help="default: <input>_enhanced.<ext>")
    g = ap.add_argument_group("upscaling")
    g.add_argument("--model", default="general", choices=[*UPSCALE_MODELS, "none"])
    size = g.add_mutually_exclusive_group()
    size.add_argument("--scale", type=float, help="output size multiplier (default 2)")
    size.add_argument("--res", choices=list(RESOLUTIONS), help="target resolution (keeps aspect)")
    g.add_argument("--denoise", type=float, default=0.5,
                   help="AI denoise strength 0-1 (general model only, default 0.5)")
    g = ap.add_argument_group("clean-up")
    g.add_argument("--pre-denoise", type=float, default=0.0, help="temporal denoise 0-1")
    g.add_argument("--deflicker", action="store_true")
    g.add_argument("--stabilize", action="store_true")
    g = ap.add_argument_group("frame interpolation")
    g.add_argument("--fps", type=float, help="target frame rate, e.g. 60")
    g.add_argument("--slowmo", type=float, default=1.0, help="slow-motion factor, e.g. 2, 4, 8")
    g.add_argument("--scene-threshold", type=float, default=0.12,
                   help="scene-cut sensitivity; 0 disables (default 0.12)")
    g = ap.add_argument_group("output")
    g.add_argument("--sharpen", type=float, default=0.0, help="0-1.5")
    g.add_argument("--grain", type=float, default=0.0, help="0-20")
    g.add_argument("--codec", default="h264", choices=list(ENCODERS))
    g.add_argument("--crf", type=int, default=16, help="quality for h264/h265 (lower = better)")
    g = ap.add_argument_group("runtime")
    g.add_argument("--start", type=float, default=0.0, help="start time in seconds")
    g.add_argument("--duration", type=float, help="only process this many seconds")
    g.add_argument("--device", default="auto", help="auto | cpu | cuda | cuda:1 | mps")
    g.add_argument("--tile", type=int, default=384, help="tile size for upscaling (0 = off)")
    g.add_argument("--dry-run", action="store_true", help="print the plan and exit")
    return ap


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    src = Path(a.input)
    model = None if a.model == "none" else a.model
    s = Settings(model=model, scale=a.scale if a.scale else (None if a.res else 2.0),
                 height=RESOLUTIONS.get(a.res) if a.res else None, denoise=a.denoise,
                 pre_denoise=a.pre_denoise, deflicker=a.deflicker, stabilize=a.stabilize,
                 fps=a.fps, slowmo=a.slowmo, scene_threshold=a.scene_threshold,
                 sharpen=a.sharpen, grain=a.grain, codec=a.codec, crf=a.crf,
                 start=a.start, duration=a.duration, device=a.device, tile=a.tile)
    if model is None and a.scale is None and a.res is None:
        s.scale = 1.0
    ext = ENCODERS[a.codec][1]
    dst = Path(a.output) if a.output else src.with_name(f"{src.stem}_enhanced{ext}")

    info = probe(src)
    p = plan(info, s)
    print(f"{src.name}: {p['in_size'][0]}x{p['in_size'][1]} @ {p['in_fps']:.3f} fps "
          f"-> {p['out_size'][0]}x{p['out_size'][1]} @ {p['out_fps']:.3f} fps, "
          f"{p['src_frames']} -> {p['out_frames']} frames"
          f"{'  [upscale:' + model + ']' if p['upscaling'] else ''}"
          f"{'  [interpolate]' if p['interpolating'] else ''}")
    if a.dry_run:
        return 0

    def bar(done: int, total: int, msg: str) -> None:
        width = 30
        fill = int(width * done / total) if total else 0
        sys.stderr.write(f"\r[{'#' * fill}{'.' * (width - fill)}] {msg:<60}")
        sys.stderr.flush()

    result = enhance_video(src, dst, s, bar)
    sys.stderr.write("\n")
    print(f"wrote {dst}  ({result['frames_written']} frames in {result['seconds']:.1f}s"
          f"{', audio kept' if result['audio'] else ''})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
