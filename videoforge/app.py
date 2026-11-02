"""VideoForge web UI.  Run:  python app.py   then open http://127.0.0.1:7860"""
from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import gradio as gr

from videoforge.models import UPSCALE_MODELS
from videoforge.pipeline import RESOLUTIONS, Settings, enhance_video, plan, preview_frame
from videoforge.video import ENCODERS, probe

MODEL_CHOICES = [(m.label, m.key) for m in UPSCALE_MODELS.values()] + [("Off (no upscaling)", "none")]
SIZE_CHOICES = ["1x", "2x", "4x", *RESOLUTIONS]
FPS_CHOICES = ["Keep original", "24", "30", "48", "60", "120"]
SLOWMO_CHOICES = ["Off", "2x", "4x", "8x"]
OUT_DIR = Path(tempfile.gettempdir()) / "videoforge-out"


def make_settings(model, size, denoise, pre_denoise, deflicker, stabilize, fps, slowmo,
                  scene, sharpen, grain, codec, crf, start=0.0, duration=None) -> Settings:
    s = Settings(model=None if model == "none" else model, denoise=denoise,
                 pre_denoise=pre_denoise, deflicker=deflicker, stabilize=stabilize,
                 fps=None if fps == "Keep original" else float(fps),
                 slowmo=1.0 if slowmo == "Off" else float(slowmo.rstrip("x")),
                 scene_threshold=scene, sharpen=sharpen, grain=grain, codec=codec,
                 crf=int(crf), start=float(start or 0), duration=duration)
    if size.endswith("x"):
        s.scale, s.height = float(size[:-1]), None
    else:
        s.scale, s.height = None, RESOLUTIONS[size]
    return s


def describe(video, *args):
    if not video:
        return "Upload a video to begin."
    info = probe(video)
    p = plan(info, make_settings(*args))
    steps = []
    if p["upscaling"]:
        steps.append("AI upscale")
    if p["interpolating"]:
        steps.append("frame interpolation")
    return (f"**Source** {p['in_size'][0]}x{p['in_size'][1]} · {p['in_fps']:.2f} fps · "
            f"{info.duration:.1f}s · {p['src_frames']} frames  \n"
            f"**Output** {p['out_size'][0]}x{p['out_size'][1]} · {p['out_fps']:.2f} fps · "
            f"{p['out_frames']} frames  \n"
            f"**Stages** {', '.join(steps) or 'filters only'}")


def do_preview(video, at, *args):
    if not video:
        raise gr.Error("Upload a video first.")
    raw, enhanced = preview_frame(video, float(at), make_settings(*args))
    return (raw, enhanced)


def do_render(video, preview_secs, at, *args, progress=gr.Progress()):
    if not video:
        raise gr.Error("Upload a video first.")
    duration = float(preview_secs) if preview_secs else None
    s = make_settings(*args, start=float(at) if duration else 0.0, duration=duration)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dst = OUT_DIR / f"{Path(video).stem}_enhanced{ENCODERS[s.codec][1]}"
    progress(0, desc="Starting")
    r = enhance_video(video, dst, s, lambda d, t, m: progress((d / t) if t else 0, desc=m))
    msg = (f"Done: {r['frames_written']} frames in {r['seconds']:.0f}s "
           f"({r['frames_written'] / max(r['seconds'], 1e-6):.2f} fps)")
    return str(dst), str(dst), msg


def build() -> gr.Blocks:
    with gr.Blocks(title="VideoForge") as ui:
        gr.Markdown("# VideoForge\nAI upscaling, denoising, stabilisation and frame interpolation "
                    "using open models (Real-ESRGAN, RIFE).")
        with gr.Row():
            with gr.Column(scale=1, min_width=320):
                video = gr.Video(label="Input video", sources=["upload"])
                info = gr.Markdown("Upload a video to begin.")
                with gr.Accordion("Enhance", open=True):
                    model = gr.Dropdown(MODEL_CHOICES, value="general", label="AI model")
                    size = gr.Radio(SIZE_CHOICES, value="2x", label="Output size")
                    denoise = gr.Slider(0, 1, 0.5, step=0.05, label="AI denoise (General model)")
                with gr.Accordion("Clean-up", open=False):
                    pre_denoise = gr.Slider(0, 1, 0, step=0.05, label="Temporal denoise")
                    deflicker = gr.Checkbox(label="Deflicker")
                    stabilize = gr.Checkbox(label="Stabilise (2-pass)")
                with gr.Accordion("Frame interpolation", open=False):
                    fps = gr.Dropdown(FPS_CHOICES, value="Keep original", label="Target frame rate")
                    slowmo = gr.Radio(SLOWMO_CHOICES, value="Off", label="Slow motion")
                    scene = gr.Slider(0, 0.4, 0.12, step=0.01,
                                      label="Scene-cut sensitivity (0 = off)")
                with gr.Accordion("Output", open=False):
                    sharpen = gr.Slider(0, 1.5, 0, step=0.05, label="Sharpen")
                    grain = gr.Slider(0, 20, 0, step=1, label="Film grain")
                    codec = gr.Dropdown(list(ENCODERS), value="h264", label="Codec")
                    crf = gr.Slider(10, 30, 16, step=1, label="Quality (CRF, lower = better)")
            with gr.Column(scale=2):
                compare = gr.ImageSlider(label="Before / after", type="numpy", height=480)
                with gr.Row():
                    at = gr.Number(0, label="Preview at (seconds)", minimum=0)
                    preview_secs = gr.Number(0, label="Render only N seconds (0 = full video)",
                                             minimum=0)
                with gr.Row():
                    preview_btn = gr.Button("Preview frame")
                    render_btn = gr.Button("Render video", variant="primary")
                status = gr.Markdown()
                result = gr.Video(label="Result")
                download = gr.File(label="Download")

        params = [model, size, denoise, pre_denoise, deflicker, stabilize, fps, slowmo,
                  scene, sharpen, grain, codec, crf]
        for c in [video, *params]:
            c.change(describe, [video, *params], info)
        preview_btn.click(do_preview, [video, at, *params], compare)
        render_btn.click(do_render, [video, preview_secs, at, *params], [result, download, status])
    return ui


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=7860)
    ap.add_argument("--share", action="store_true", help="create a public gradio.live link")
    a = ap.parse_args()
    build().queue().launch(server_name=a.host, server_port=a.port, share=a.share)
