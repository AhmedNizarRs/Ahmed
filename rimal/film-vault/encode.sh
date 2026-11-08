#!/usr/bin/env bash
# Master the mix (gain to -14 LUFS + peak limiter), then encode 60 fps H.264 + AAC for Reels, plus a <100 MB upload copy.
set -euo pipefail
cd "$(dirname "$0")"
# gain to -14 LUFS first, then a brick-wall limiter at -2.5 dBFS for the hero boom / voice peaks
lufs() { ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -A3 Summary | sed -n 's/.*I: *\(-[0-9.]*\) LUFS/\1/p'; }
G=$(python3 -c "print(-14.0 - ($(lufs mix_raw.wav)))")
for pass in 1 2 3 4; do   # the limiter eats loudness; add the shortfall back until within 0.2 LU
  ffmpeg -y -loglevel error -i mix_raw.wav -af "acompressor=threshold=0.06:ratio=3:attack=6:release=150:knee=4,volume=${G}dB,alimiter=limit=0.75:attack=2:release=80:level=disabled:asc=1" -ar 48000 mix.wav
  D=$(python3 -c "print(-14.0 - ($(lufs mix.wav)))"); echo "master pass $pass: gain $G dB, off by $D LU"
  python3 -c "import sys; sys.exit(0 if abs($D) < 0.2 else 1)" && break
  G=$(python3 -c "print($G + $D)")
done
mkdir -p out
ffmpeg -y -loglevel error -framerate 60 -i frames/f%05d.png -i mix.wav \
  -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -r 60 -g 120 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/rimal-vault-reel.mp4
ffmpeg -y -loglevel error -i frames/f01980.png -q:v 2 out/poster.jpg
ffmpeg -y -loglevel error -i frames/f00000.png -q:v 2 out/cover-frame0.jpg
echo out/rimal-vault-reel.mp4
# Upload copy (<100 MB for GitHub/public hosting; Instagram re-encodes anyway): 2-pass ~11 Mbps
ffmpeg -y -loglevel error -i out/rimal-vault-reel.mp4 -c:v libx264 -preset slow -b:v 11M -g 120 -pass 1 -passlogfile qa/x264 -an -f null /dev/null
ffmpeg -y -loglevel error -i out/rimal-vault-reel.mp4 -c:v libx264 -preset slow -b:v 11M -maxrate 16M -bufsize 22M -pass 2 -passlogfile qa/x264 \
  -profile:v high -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -g 120 \
  -c:a copy -movflags +faststart out/rimal-vault-reel-ig.mp4
echo out/rimal-vault-reel-ig.mp4
