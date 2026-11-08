#!/usr/bin/env bash
# Master the mix to -14 LUFS / -1.5 dBTP (two-pass loudnorm), then encode 60 fps H.264 + AAC for Reels.
set -euo pipefail
cd "$(dirname "$0")"
M=$(ffmpeg -hide_banner -i mix_raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -loglevel error -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -ar 48000 mix.wav
mkdir -p out
ffmpeg -y -loglevel error -framerate 60 -i frames/f%05d.png -i mix.wav \
  -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -r 60 -g 120 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/rimal-vault-reel.mp4
ffmpeg -y -loglevel error -i frames/f01980.png -q:v 2 out/poster.jpg
ffmpeg -y -loglevel error -i frames/f00000.png -q:v 2 out/cover-frame0.jpg
echo out/rimal-vault-reel.mp4
