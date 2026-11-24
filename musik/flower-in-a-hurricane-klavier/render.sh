#!/bin/bash
# render.sh <in.mid> <out.mp3>
set -e
fluidsynth -ni -q -g 0.6 -r 44100 -o synth.reverb.active=1 -o synth.reverb.room-size=0.75 -o synth.reverb.width=0.9 -o synth.reverb.level=0.55 -F r_raw.wav /usr/share/sounds/sf2/FluidR3_GM.sf2 "$1"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 r_raw.wav)
ffmpeg -y -loglevel error -i r_raw.wav -af "highpass=f=30,acompressor=threshold=-24dB:ratio=1.8:attack=25:release=300:makeup=1" r_pre.wav
MX=$(ffmpeg -i r_pre.wav -af volumedetect -f null - 2>&1 | grep -oE "max_volume: [-0-9.]+" | awk '{print $2}')
G=$(python3 -c "print(-1.0-($MX))")
ffmpeg -y -loglevel error -i r_pre.wav -af "volume=${G}dB,alimiter=limit=0.89,afade=t=out:st=$(python3 -c "print($D-3)"):d=3" -b:a 256k "$2"
for t in 5 20 35 50 65 80 95 110 125; do printf "%s s: " $t; ffmpeg -ss $t -t 3 -i "$2" -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+"; done
