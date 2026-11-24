#!/bin/bash
# render5.sh <in.mid> <out.mp3> <lead_gain_expr> <vocals.wav> <vocal_gain_dB> – E-Violine (Kanal 14/15) mit FX + Elektro-Band, Master
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
fluidsynth -ni -q -g 0.5 -r 44100 -o synth.polyphony=512 -o synth.reverb.active=0 -o synth.chorus.active=0 -F x_lead.wav $SF x_lead.mid
fluidsynth -ni -q -g 0.5 -r 44100 -o synth.polyphony=512 -o synth.reverb.active=1 -o synth.reverb.room-size=0.6 -o synth.reverb.level=0.35 -o synth.chorus.active=0 -F x_band.wav $SF x_band.mid
# E-Violine: Präsenz, leichte Sättigung, Chorus, Dotted-8th-Delay (357 ms @126 BPM), Hall
ffmpeg -y -loglevel error -i x_lead.wav -af "volume='${3}':eval=frame,highpass=f=190,equalizer=f=800:t=q:w=1:g=-3,equalizer=f=3500:t=q:w=1:g=4,highshelf=f=8000:g=2,volume=6dB,asoftclip=type=tanh,volume=-6dB,chorus=0.7:0.9:45|60:0.25|0.2:0.35|0.45:1.8|1.3,aecho=0.85:0.7:357|714:0.28|0.16,aecho=0.8:0.6:60|85|113:0.2|0.15|0.1" x_lead_fx.wav
ffmpeg -y -loglevel error -i "$4" -af "highpass=f=160,equalizer=f=2800:t=q:w=1:g=3,highshelf=f=9000:g=3,acompressor=threshold=-24dB:ratio=3:attack=8:release=120:makeup=2,volume=${5}dB,aecho=0.8:0.7:357:0.22,aecho=0.8:0.75:47|71|103|149:0.3|0.25|0.2|0.15" x_vox_fx.wav
ffmpeg -y -loglevel error -i x_lead_fx.wav -i x_band.wav -i x_vox_fx.wav -filter_complex "[1]equalizer=f=3000:t=q:w=1.2:g=-3.5[b];[0][b][2]amix=inputs=3:normalize=0" p_raw.wav
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 p_raw.wav)
ffmpeg -y -loglevel error -i p_raw.wav -af "highpass=f=25,equalizer=f=55:t=q:w=1:g=4,equalizer=f=320:t=q:w=1.2:g=-2.5,highshelf=f=10000:g=2,acompressor=threshold=-20dB:ratio=3:attack=15:release=150:makeup=1,extrastereo=m=1.3" p_pre.wav
MX=$(ffmpeg -i p_pre.wav -af volumedetect -f null - 2>&1 | grep -oE "max_volume: [-0-9.]+" | awk '{print $2}')
G=$(python3 -c "print(-1.0-($MX)+5.0)")
ffmpeg -y -loglevel error -i p_pre.wav -af "volume=${G}dB,alimiter=limit=0.9:attack=2:release=50:level=disabled,afade=t=out:st=$(python3 -c "print($D-3)"):d=3" -b:a 320k "$2"
