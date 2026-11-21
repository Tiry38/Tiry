#!/bin/bash
# Stufe 5: Studio-Feinschliff (KI) bzw. HD-Telefonklang (Anrufer). Aufruf: aivox_master.sh <ordner> <jobs.json>
cd "$(dirname "$0")"
D="$1"; J="$2"
# kleiner Raum: kurze, dichte Reflexionen, sehr leise beigemischt
ROOM="aecho=0.85:0.25:11|17|23|31:0.22|0.16|0.11|0.07"
for f in "$D"/*_raw.wav; do
  n=$(basename "$f" _raw.wav)
  if python3 -c "import json,sys; j={x['id']:x for x in json.load(open('$J'))}; sys.exit(0 if j['$n']['ref'].endswith('an-real.wav') else 1)"; then
    # HD-Telefonat: 100–7000 Hz, leichte Kompression, Opus-Codec simuliert
    ffmpeg -loglevel error -y -i "$f" -af "highpass=f=110,lowpass=f=7000,equalizer=f=1800:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=3:attack=5:release=90,loudnorm=I=-18:TP=-2" -ar 16000 -c:a libopus -b:a 20k "$D/$n.tel.ogg"
    ffmpeg -loglevel error -y -i "$D/$n.tel.ogg" -ar 24000 -af "volume=1" -c:a libmp3lame -b:a 96k "$D/$n.mp3"
    rm -f "$D/$n.tel.ogg"
  else
    ffmpeg -loglevel error -y -i "$f" -af "highpass=f=70,equalizer=f=220:t=q:w=1:g=1.8,equalizer=f=500:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1:g=2.2,equalizer=f=10000:t=h:w=0.7:g=2,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.4:attack=10:release=140,loudnorm=I=-16:TP=-1.5" -c:a libmp3lame -b:a 160k "$D/$n.mp3"
  fi
done
echo gemastert
