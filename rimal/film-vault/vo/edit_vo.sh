#!/usr/bin/env bash
# Edit the ElevenLabs take: 0.4 s lead-in, +0.9 s silence before the hero, cut «لا البحث», tail to 34.5 s.
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -i vo.wav -filter_complex "\
aevalsrc=0:d=0.4:s=48000[s0];\
[0:a]atrim=0:24.62,asetpts=PTS-STARTPTS[a];\
aevalsrc=0:d=0.9:s=48000[s1];\
[0:a]atrim=24.62:26.06,asetpts=PTS-STARTPTS,afade=t=out:st=1.38:d=0.06[b];\
aevalsrc=0:d=0.30:s=48000[s2];\
[0:a]atrim=27.24,asetpts=PTS-STARTPTS,afade=t=in:d=0.03[c];\
[s0][a][s1][b][s2][c]concat=n=6:v=0:a=1,apad=whole_dur=34.5[o]" -map "[o]" -ac 1 -ar 48000 vo_edit.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 vo_edit.wav
