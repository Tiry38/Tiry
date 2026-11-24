#!/bin/bash
# render2.sh <in.mid> <out.mp3> – HQ-Soundfont + Power-Mastering (Dynamik bleibt: Intro leise, Drops laut)
set -e
SF=/usr/share/sounds/sf3/MuseScore_General_Full.sf3
fluidsynth -ni -q -g 0.5 -r 44100 -o synth.polyphony=512 -o synth.reverb.active=1 -o synth.reverb.room-size=0.8 -o synth.reverb.width=1.0 -o synth.reverb.level=0.5 -o synth.chorus.active=0 -F p_raw.wav $SF "$1"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 p_raw.wav)
ffmpeg -y -loglevel error -i p_raw.wav -af "highpass=f=28,equalizer=f=65:t=q:w=1:g=3.5,equalizer=f=300:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1:g=2,highshelf=f=9000:g=2.5,acompressor=threshold=-22dB:ratio=2.5:attack=20:release=180:makeup=1,extrastereo=m=1.25" p_pre.wav
MX=$(ffmpeg -i p_pre.wav -af volumedetect -f null - 2>&1 | grep -oE "max_volume: [-0-9.]+" | awk '{print $2}')
G=$(python3 -c "print(-1.0-($MX)+4.0)")
ffmpeg -y -loglevel error -i p_pre.wav -af "volume=${G}dB,alimiter=limit=0.9:attack=3:release=60:level=disabled,afade=t=out:st=$(python3 -c "print($D-3)"):d=3" -b:a 320k "$2"
for t in 5 20 35 50 65 80 95 105 120 135; do printf "%s s: " $t; ffmpeg -ss $t -t 3 -i "$2" -af volumedetect -f null - 2>&1 | grep -oE "(mean|max)_volume: [-0-9.]+" | tr '\n' ' '; echo; done
