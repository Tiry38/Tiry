#!/bin/bash
# Kodiert die gewählten Zeilen: KI klar und präsent, Anrufer mit leichtem Telefonklang.
cd "$(dirname "$0")"
for f in a3/*.wav; do
  n=$(basename "$f" .wav)
  case "$n" in *__v*|test) continue ;; esac
  if python3 -c "import json,sys; j={x['id']:x for x in json.load(open('jobs.json'))}; sys.exit(0 if j['$n']['ref'].endswith('an-real.wav') else 1)"; then
    ffmpeg -loglevel error -y -i "$f" -af "adelay=180,highpass=f=160,lowpass=f=6500,equalizer=f=2500:t=q:w=1:g=2,acompressor=threshold=-20dB:ratio=3,loudnorm=I=-17:TP=-1.5" -c:a libmp3lame -b:a 96k "a3/$n.mp3"
  else
    ffmpeg -loglevel error -y -i "$f" -af "adelay=80,highpass=f=60,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3500:t=q:w=1.2:g=2,deesser,acompressor=threshold=-21dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5" -c:a libmp3lame -b:a 128k "a3/$n.mp3"
  fi
done
echo kodiert
