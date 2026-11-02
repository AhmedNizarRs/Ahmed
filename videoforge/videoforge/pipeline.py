"""End-to-end video enhancement: decode -> clean up -> interpolate -> upscale -> encode."""
from __future__ import annotations

import math
import tempfile
import time
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Callable

import numpy as np

from .enhance import Interpolator, Upscaler
from .video import VideoInfo, VideoWriter, probe, read_frames, stabilize_transforms

Progress = Callable[[int, int, str], None]

RESOLUTIONS = {"720p": 720, "1080p": 1080, "1440p": 1440, "4k": 2160, "8k": 4320}


@dataclass
class Settings:
    # Upscaling
    model: str | None = "general"       # general | anime | quality | None
    scale: float | None = 2.0           # multiply source size...
    height: int | None = None           # ...or target height (keeps aspect)
    denoise: float = 0.5                # model denoise strength (general model)
    # Clean-up before the AI stages
    pre_denoise: float = 0.0            # 0-1, temporal hqdn3d
    deflicker: bool = False
    stabilize: bool = False
    # Frame interpolation
    fps: float | None = None            # target frame rate
    slowmo: float = 1.0                 # 2 = half speed, 4 = quarter speed ...
    scene_threshold: float = 0.12       # 0 disables scene-cut detection
    # Finishing
    sharpen: float = 0.0                # 0-1.5 unsharp amount
    grain: float = 0.0                  # 0-20 film grain strength
    codec: str = "h264"
    crf: int = 16
    # Range / runtime
    start: float = 0.0
    duration: float | None = None
    device: str = "auto"
    tile: int = 384
    extra: dict = field(default_factory=dict)


def _even(x: float) -> int:
    return max(2, int(round(x / 2)) * 2)


def output_size(info: VideoInfo, s: Settings) -> tuple[int, int]:
    if s.height:
        h = s.height
        return _even(info.width * h / info.height), _even(h)
    k = s.scale or 1.0
    return _even(info.width * k), _even(info.height * k)


def output_fps(info: VideoInfo, s: Settings) -> Fraction:
    return Fraction(s.fps).limit_denominator(1001) if s.fps else info.fps


def plan(info: VideoInfo, s: Settings) -> dict:
    """Summarise what a run will do (used by the CLI/UI before starting)."""
    out_w, out_h = output_size(info, s)
    fps = output_fps(info, s)
    src_secs = s.duration if s.duration else max(0.0, info.duration - s.start)
    n_src = max(1, min(info.frames, int(round(src_secs * float(info.fps)))))
    step = info.fps / (fps * Fraction(s.slowmo).limit_denominator(1000))
    n_out = int(math.floor((n_src - 1) / step)) + 1
    return dict(in_size=(info.width, info.height), out_size=(out_w, out_h),
                in_fps=float(info.fps), out_fps=float(fps), src_frames=n_src,
                out_frames=n_out, step=step,
                interpolating=step != 1,
                upscaling=bool(s.model) and (out_w, out_h) != (info.width, info.height))


def enhance_video(src: str | Path, dst: str | Path, s: Settings,
                  progress: Progress | None = None) -> dict:
    progress = progress or (lambda *_: None)
    info = probe(src)
    p = plan(info, s)
    out_w, out_h = p["out_size"]
    step: Fraction = p["step"]

    # ---- decode-side filters (cheap, classical) ------------------------
    vf: list[str] = []
    tmpdir = tempfile.TemporaryDirectory()
    if s.stabilize:
        progress(0, p["out_frames"], "Analysing camera shake")
        trf = Path(tmpdir.name) / "motion.trf"
        stabilize_transforms(src, trf)
        vf.append(f"vidstabtransform=input={trf}:smoothing=20:zoom=0:optzoom=1")
    if s.deflicker:
        vf.append("deflicker=size=5:mode=am")
    if s.pre_denoise > 0:
        a = 6.0 * s.pre_denoise
        vf.append(f"hqdn3d={a / 1.5:.2f}:{a / 2:.2f}:{a:.2f}:{a:.2f}")
    vf.append(f"fps={info.fps.numerator}/{info.fps.denominator}")  # force constant frame rate

    work_size = (info.width, info.height)
    if not p["upscaling"] and (out_w, out_h) != work_size:
        vf.append(f"scale={out_w}:{out_h}:flags=lanczos")
        work_size = (out_w, out_h)

    # ---- models ---------------------------------------------------------
    progress(0, p["out_frames"], "Loading models")
    upscaler = Upscaler(s.model, s.denoise, s.device, tile=s.tile) if p["upscaling"] else None
    interp = Interpolator(s.device, scene_threshold=s.scene_threshold) if p["interpolating"] else None

    # ---- encode-side filters ------------------------------------------
    post: list[str] = []
    if s.sharpen > 0:
        post.append(f"unsharp=5:5:{s.sharpen:.2f}:5:5:0")
    if s.grain > 0:
        post.append(f"noise=alls={s.grain:.0f}:allf=t")

    keep_audio = info.has_audio and s.slowmo == 1
    writer = VideoWriter(dst, out_w, out_h, output_fps(info, s),
                         codec=s.codec, crf=s.crf, audio_from=src if keep_audio else None,
                         audio_start=s.start, audio_duration=s.duration, vf=post)

    frames = read_frames(src, work_size, vf, s.start, s.duration)
    total = p["out_frames"]
    t0 = time.time()
    try:
        prev = next(frames, None)
        if prev is None:
            raise RuntimeError("no frames decoded from input")
        nxt = next(frames, None)
        idx, j = 0, 0
        while True:
            pos = j * step
            i = math.floor(pos)
            frac = pos - i
            while idx < i and nxt is not None:
                prev, nxt = nxt, next(frames, None)
                idx += 1
            if idx < i:
                break                       # ran out of source frames
            if frac == 0:
                frame = prev
            elif nxt is None:
                break
            else:
                frame = interp(prev, nxt, float(frac))
            if upscaler is not None:
                frame = upscaler(frame, (out_w, out_h))
            writer.write(frame)
            j += 1
            if j % 2 == 0 or j == total:
                el = time.time() - t0
                eta = el / j * max(0, total - j)
                progress(j, total, f"Frame {j}/{total} - {j / el:.2f} fps - ETA {eta:.0f}s")
    finally:
        frames.close()
        writer.close()
        tmpdir.cleanup()
    p["frames_written"] = j
    p["seconds"] = time.time() - t0
    p["audio"] = keep_audio
    return p


def preview_frame(src: str | Path, at: float, s: Settings) -> tuple[np.ndarray, np.ndarray]:
    """Return (original resized to output, enhanced) for a single frame."""
    info = probe(src)
    out_w, out_h = output_size(info, s)
    vf = []
    if s.pre_denoise > 0:
        a = 6.0 * s.pre_denoise
        vf.append(f"hqdn3d={a / 1.5:.2f}:{a / 2:.2f}:{a:.2f}:{a:.2f}")
    frame = next(read_frames(src, (info.width, info.height), vf, max(0.0, at), 0.5), None)
    raw = next(read_frames(src, (out_w, out_h), [f"scale={out_w}:{out_h}:flags=neighbor"],
                           max(0.0, at), 0.5), None)
    if frame is None or raw is None:
        raise RuntimeError("could not decode a frame at that timestamp")
    if s.model:
        enhanced = Upscaler(s.model, s.denoise, s.device, tile=s.tile)(frame, (out_w, out_h))
    else:
        enhanced = next(read_frames(src, (out_w, out_h), vf + [f"scale={out_w}:{out_h}:flags=lanczos"],
                                    max(0.0, at), 0.5))
    return raw, enhanced
