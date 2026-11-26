#!/usr/bin/env bash
# Full build: frames -> grain envelope -> score -> loudness master -> MP4 (+ no-music) -> poster.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
[ "${SKIP_FRAMES:-0}" = 1 ] || { rm -rf out/frames; node render.js frames out/frames 4; }
node render.js env out/env.json
python3 score.py timeline.json out/env.json out/score.wav
python3 score.py timeline.json out/env.json out/score_nomusic.wav --no-music

master() { # two-pass loudnorm to -14 LUFS, TP -1.5 dBTP (encoding raises peaks)
  local in=$1 out=$2
  local js; js=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  local ii tp lra th off
  ii=$(echo "$js" | python3 -c 'import json,sys;print(json.load(sys.stdin)["input_i"])')
  tp=$(echo "$js" | python3 -c 'import json,sys;print(json.load(sys.stdin)["input_tp"])')
  lra=$(echo "$js" | python3 -c 'import json,sys;print(json.load(sys.stdin)["input_lra"])')
  th=$(echo "$js" | python3 -c 'import json,sys;print(json.load(sys.stdin)["input_thresh"])')
  off=$(echo "$js" | python3 -c 'import json,sys;print(json.load(sys.stdin)["target_offset"])')
  ffmpeg -hide_banner -y -loglevel error -i "$in" -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$ii:measured_TP=$tp:measured_LRA=$lra:measured_thresh=$th:offset=$off:linear=true" -ar 48000 "$out"
}
master out/score.wav out/score_master.wav
master out/score_nomusic.wav out/score_nomusic_master.wav

enc() { # $1 audio, $2 output
  ffmpeg -hide_banner -y -loglevel error -framerate 30 -i out/frames/f%04d.png -i "$1" \
    -c:v libx264 -preset slow -crf 17 -tune animation -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
    -c:a aac -b:a 256k -shortest -movflags +faststart "$2"
}
enc out/score_master.wav rimal-day01-why-rimal.mp4
enc out/score_nomusic_master.wav rimal-day01-why-rimal-nomusic.mp4
cp out/frames/f0000.png poster.png
echo done
