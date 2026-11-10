#!/usr/bin/env bash
# Cuts the source clips (Drive folder "For editing") into retimed, cropped JPEG sequences the page seeks through.
# usage: ./extract_footage.sh <dir with source mp4s>
set -euo pipefail
SRC="$1"; cd "$(dirname "$0")"; OUT=footage; mkdir -p "$OUT"
ex() { # name file ss to speed vf
  mkdir -p "$OUT/$1"; rm -f "$OUT/$1"/*.jpg
  ffmpeg -v error -y -ss "$3" -to "$4" -i "$SRC/$2" -an -vf "setpts=PTS/$5,fps=30,$6" -q:v 3 "$OUT/$1/%04d.jpg"
  echo "$1 $(ls "$OUT/$1" | wc -l)"
}
ex revit   revit.mp4      0    15.9 1.0  "crop=720:660:0:300,scale=960:880:flags=lanczos" &
ex autocad autocad.mp4    12.5 24.4 1.25 "crop=576:520:0:168,scale=864:780:flags=lanczos" &
ex plgn    plgn.mp4       3.0  21.0 2.0  "crop=1000:690:230:300,scale=960:662:flags=lanczos" &
wait
ex ktchn   ktchn.mp4      0    32.0 2.0  "crop=1190:812:200:112,scale=960:656:flags=lanczos" &
ex wind    wind.mp4       0    15.5 1.6  "crop=1150:956:386:30,scale=960:798:flags=lanczos" &
# block library: drop the baked-in red caption (top 250 px) and the command line, pan a window across the sheet
ex blocks  clip_1785.mp4  0    45.0 2.0  "crop=900:760:'200+(iw-900-460)*min(1,n/1350)':250,scale=960:810:flags=lanczos" &
wait
du -sh "$OUT"
python3 deflash.py footage/*
