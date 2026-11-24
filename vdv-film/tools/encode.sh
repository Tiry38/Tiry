#!/usr/bin/env bash
# Kodiert gerenderte Bilder + Ton. Aufruf: tools/encode.sh <framesdir> <audio.wav> <out.mp4> <fps> <dauer_s> [prores.mov]
set -euo pipefail
F=$1; A=$2; O=$3; FPS=$4; DUR=$5; PR=${6:-}
ffmpeg -hide_banner -loglevel error -y -framerate "$FPS" -i "$F/f%06d.jpg" -i "$A" \
  -t "$DUR" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false,afade=t=out:st=$(echo "$DUR - 0.25" | bc):d=0.25" -c:a aac -b:a 256k -ar 48000 "$O"
if [ -n "$PR" ]; then
  ffmpeg -hide_banner -loglevel error -y -framerate "$FPS" -i "$F/f%06d.jpg" -i "$A" -t "$DUR" \
    -c:v prores_ks -profile:v 1 -pix_fmt yuv422p10le -af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false,afade=t=out:st=$(echo "$DUR - 0.25" | bc):d=0.25" -c:a pcm_s16le "$PR"
fi
echo "ok $O"
