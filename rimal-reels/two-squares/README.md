# Rimal reel: "Every star is just two squares"

A 32.5 s, 1080x1920, 60 fps Instagram Reel made entirely in code, in the style of the viral explainer reels
(dark stage, one big idea, word-pill captions, step labels, a sourced footnote, a free-tool CTA).

- `timeline.py`: the single source of truth (beats on a 96 BPM grid, captions EN/AR, labels). Run `python3 timeline.py en|ar`.
- `film.js` + `index.html`: every frame is `seek(t)`, drawn on a canvas. Geometry is Hankin's method, the same as the site's Pattern Lab.
- `make_audio.py`: synthesized score (D Hijaz plucks, drone, one hit on the sunlight at 22.5 s).
- `render.js`: `node render.js film en out/video_en60.mp4 4 60`, then mux with `score_master.wav` (see below).

Master audio: `ffmpeg -i score_raw.wav -af "volume=12.5dB,alimiter=limit=0.70:attack=3:release=80:level=false" score_master.wav` (−13.8 LUFS, −1.2 dBTP).
Mux: `ffmpeg -i out/video_en60.mp4 -i score_master.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/rimal-two-squares-en.mp4`.

Finals: `out/rimal-two-squares-en.mp4`, `out/rimal-two-squares-ar.mp4` (Arabic: needs a native-speaker check), covers `out/cover-*.jpg`.
