#!/usr/bin/env bash
# Encode the rendered frames + mastered score into the delivery MP4 (H.264, BT.709, AAC 256k).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
ffmpeg -y -loglevel error -framerate 30 -i frames/f%05d.png -i score.wav \
  -c:v libx264 -preset slow -crf 16 -tune film -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/dalil-door-clip.mp4
ffmpeg -y -loglevel error -i frames/f00630.png -vf scale=1080:1920 -q:v 3 out/poster.jpg
echo "out/dalil-door-clip.mp4"
