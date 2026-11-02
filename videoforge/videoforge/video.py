"""ffmpeg-backed video decode/encode via raw RGB pipes."""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Iterator

import numpy as np


def require_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"{tool} not found on PATH - install ffmpeg first")


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: Fraction
    frames: int
    duration: float
    has_audio: bool


def probe(path: str | Path) -> VideoInfo:
    require_ffmpeg()
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    vs = next(s for s in data["streams"] if s["codec_type"] == "video")
    fps = Fraction(vs.get("avg_frame_rate") or vs["r_frame_rate"])
    if fps <= 0:
        fps = Fraction(vs["r_frame_rate"])
    duration = float(vs.get("duration") or data["format"].get("duration") or 0)
    frames = int(vs.get("nb_frames") or 0) or int(round(duration * fps))
    w, h = int(vs["width"]), int(vs["height"])
    rot = 0
    for sd in vs.get("side_data_list", []):
        rot = int(sd.get("rotation", rot))
    if abs(rot) in (90, 270):
        w, h = h, w
    return VideoInfo(w, h, fps, frames, duration,
                     any(s["codec_type"] == "audio" for s in data["streams"]))


def filter_path(p: str | Path) -> str:
    """Quote a file path for use inside an ffmpeg filter argument.

    Windows paths ("C:\\x\\y") break filter syntax: backslashes are escapes and
    the drive colon separates options. Use forward slashes and escape colons.
    """
    s = str(Path(p).resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    return f"'{s}'"


def stabilize_transforms(path: str | Path, trf: Path, shakiness: int = 5) -> None:
    """First vid.stab pass: analyse camera motion into a .trf file."""
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(path),
         "-vf", f"vidstabdetect=shakiness={shakiness}:accuracy=15:result={filter_path(trf)}",
         "-f", "null", "-"], check=True)


def read_frames(path: str | Path, size: tuple[int, int], vf: list[str] | None = None,
                start: float = 0.0, duration: float | None = None) -> Iterator[np.ndarray]:
    """Yield HxWx3 uint8 RGB frames. `size` is (width, height) after filters."""
    width, height = size
    cmd = ["ffmpeg", "-v", "error"]
    if start:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", str(path)]
    if duration:
        cmd += ["-t", f"{duration:.3f}"]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    cmd += ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    nbytes = width * height * 3
    try:
        while True:
            buf = proc.stdout.read(nbytes)
            if len(buf) < nbytes:
                break
            yield np.frombuffer(bytearray(buf), np.uint8).reshape(height, width, 3)
    finally:
        proc.stdout.close()
        proc.wait()


ENCODERS = {
    # name: (ffmpeg args, container hint)
    "h264": (["-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p"], ".mp4"),
    "h265": (["-c:v", "libx265", "-preset", "medium", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"], ".mp4"),
    "prores": (["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"], ".mov"),
}


class VideoWriter:
    def __init__(self, path: str | Path, width: int, height: int, fps: Fraction,
                 codec: str = "h264", crf: int = 16, audio_from: str | Path | None = None,
                 audio_start: float = 0.0, audio_duration: float | None = None,
                 vf: list[str] | None = None):
        args, _ = ENCODERS[codec]
        cmd = ["ffmpeg", "-v", "error", "-y",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}",
               "-r", f"{fps.numerator}/{fps.denominator}", "-i", "-"]
        if audio_from:
            if audio_start:
                cmd += ["-ss", f"{audio_start:.3f}"]
            if audio_duration:
                cmd += ["-t", f"{audio_duration:.3f}"]
            cmd += ["-i", str(audio_from), "-map", "0:v", "-map", "1:a?", "-c:a", "aac",
                    "-b:a", "192k", "-shortest"]
        if vf:
            cmd += ["-vf", ",".join(vf)]
        cmd += args
        if codec in ("h264", "h265"):
            cmd += ["-crf", str(crf)]
        cmd += ["-movflags", "+faststart", str(path)]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        self.count = 0

    def write(self, frame: np.ndarray) -> None:
        self.proc.stdin.write(np.ascontiguousarray(frame).tobytes())
        self.count += 1

    def close(self) -> None:
        self.proc.stdin.close()
        if self.proc.wait() != 0:
            raise RuntimeError("ffmpeg encoder failed")
