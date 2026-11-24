#!/bin/bash
# render3.sh <in.mid> <out.mp3> <lead_gain_dB> – Lead (Kanal 14/15) und Orchester getrennt rendern, dann mischen + mastern
set -e
SF=/usr/share/sounds/sf3/MuseScore_General_Full.sf3
python3 - "$1" <<'P'
import sys, mido
src = mido.MidiFile(sys.argv[1])
def stem(name, keep):
    out = mido.MidiFile(ticks_per_beat=src.ticks_per_beat); t = mido.MidiTrack(); out.tracks.append(t); carry = 0
    for msg in src.tracks[0]:
        if msg.type in ('note_on','note_off') and msg.channel not in keep: carry += msg.time; continue
        t.append(msg.copy(time=msg.time+carry)); carry = 0
    out.save(name)
stem('x_lead.mid', {14, 15}); stem('x_band.mid', set(range(16)) - {14, 15})
P
for s in x_lead x_band; do
  fluidsynth -ni -q -g 0.5 -r 44100 -o synth.polyphony=512 -o synth.reverb.active=1 -o synth.reverb.room-size=0.8 -o synth.reverb.width=1.0 -o synth.reverb.level=0.5 -o synth.chorus.active=0 -F $s.wav $SF $s.mid
done
ffmpeg -y -loglevel error -i x_lead.wav -i x_band.wav -filter_complex "[0]volume='${3}':eval=frame,equalizer=f=2500:t=q:w=1:g=2,highpass=f=180[l];[1]equalizer=f=2500:t=q:w=1.2:g=-2.5[b];[l][b]amix=inputs=2:normalize=0" p_raw.wav
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 p_raw.wav)
ffmpeg -y -loglevel error -i p_raw.wav -af "highpass=f=28,equalizer=f=65:t=q:w=1:g=3.5,equalizer=f=300:t=q:w=1.2:g=-2,highshelf=f=9000:g=2.5,acompressor=threshold=-22dB:ratio=2.5:attack=20:release=180:makeup=1,extrastereo=m=1.2" p_pre.wav
MX=$(ffmpeg -i p_pre.wav -af volumedetect -f null - 2>&1 | grep -oE "max_volume: [-0-9.]+" | awk '{print $2}')
G=$(python3 -c "print(-1.0-($MX)+4.0)")
ffmpeg -y -loglevel error -i p_pre.wav -af "volume=${G}dB,alimiter=limit=0.9:attack=3:release=60:level=disabled,afade=t=out:st=$(python3 -c "print($D-3)"):d=3" -b:a 320k "$2"
for t in 12 25 50 82 100 120; do echo "$t s: Geige $(ffmpeg -ss $t -t 4 -i x_lead.wav -af "volume='${3}':eval=frame,volumedetect" -f null - 2>&1 | grep -oE 'mean_volume: [-0-9.]+'|cut -d' ' -f2) | Orchester $(ffmpeg -ss $t -t 4 -i x_band.wav -af volumedetect -f null - 2>&1 | grep -oE 'mean_volume: [-0-9.]+'|cut -d' ' -f2) | Master $(ffmpeg -ss $t -t 3 -i "$2" -af volumedetect -f null - 2>&1 | grep -oE 'mean_volume: [-0-9.]+'|cut -d' ' -f2)"; done
