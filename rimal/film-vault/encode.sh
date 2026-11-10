#!/usr/bin/env bash
# Encode frames + mastered mix into the delivery MP4 (H.264, BT.709, AAC 256k) and cut a poster.
# usage: ./encode.sh <output name without extension> [poster frame]
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p out
NAME="${1:-rimal-architect-vault}"; POSTER="${2:-}"
ffmpeg -y -loglevel error -framerate 30 -i frames/f%05d.png -i out/mix.wav \
  -c:v libx264 -preset slow -crf 16 -tune animation -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -shortest -movflags +faststart "out/$NAME.mp4"
[ -n "$POSTER" ] && ffmpeg -y -loglevel error -i "frames/f$(printf %05d "$POSTER").png" -q:v 2 out/poster.jpg
echo "out/$NAME.mp4"
