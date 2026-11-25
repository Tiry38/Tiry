"""Orchester HINTER der ersten Klavierfassung von 'United We Dance' (Klavier bleibt unverändert).
Gleiche Form/Tempo-Karte wie arrange.py: Intro 8 | Strophe 8 | Aufbau 8 | Drop 16 | Breakdown 8 | Aufbau2 4 | Finale 16 (D) | Outro 4.
Mehr Melodie: Gegenmelodie (Celli/Hörner), Violinen-Oberstimme, Hörner/Blech verdoppeln die Hook im Finale eine Oktave tiefer."""
import random, sys, mido
random.seed(3)
TPB, BPM = 480, 126
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'Eb':3,'D#':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'G#':8,'A':9,'Bb':10,'A#':10,'B':11}
def m(n): return 12*(int(n[-1])+1) + NOTE[n[:-1]]

# Kanal: (Bank, Programm, Lautstärke, Panorama)
STR, VLN, CEL, CB, HRN, BRS, CHO, TIMP, SPC, DR, HARP = 1, 2, 3, 4, 5, 6, 7, 8, 10, 9, 11
SETUP = {STR:(20,49,96,50), VLN:(20,48,92,36), CEL:(0,42,96,80), CB:(0,43,100,70), HRN:(0,60,90,92),
         BRS:(0,61,86,74), CHO:(0,52,80,58), TIMP:(0,47,100,64), SPC:(20,48,70,30), DR:(0,48,96,64), HARP:(0,46,80,100)}
ev = []
def note(beat, p, dur, vel, ch, hum=True):
    t = max(0, int(beat*TPB) + (random.randint(-4, 4) if hum else 0))
    v = max(1, min(127, int(vel + (random.randint(-4, 4) if hum else 0))))
    ev.append((t, 1, ch, p, v)); ev.append((t + max(10, int(dur*TPB) - 10), 0, ch, p, 0))
def cc(beat, ch, ctl, val): ev.append((max(0, int(beat*TPB)), 2, ch, ctl, int(max(0, min(127, val)))))
def swell(s, ch, a, b, beats=4, steps=8):
    for i in range(steps+1): cc(s + beats*i/steps, ch, 11, a + (b-a)*i/steps)

CHORDS = [(0, [0,3,7]), (3, [3,7,10]), (10, [10,2,5]), (5, [5,9,0])]   # Cm Eb Bb F
RHY = [(0,.75),(.75,.75),(1.5,.5),(2,.75),(2.75,.75),(3.5,.5)]
HOOK = [['G4','G4','F4','Eb4','Eb4','C4'], ['Eb4','Eb4','F4','G4','G4','Bb4'], ['Bb4','Bb4','G4','F4','F4','D4'],
        ['F4','F4','G4','A4','A4','F4'], ['G4','G4','F4','Eb4','Eb4','C4'], ['Eb4','Eb4','F4','G4','G4','Bb4'],
        ['Bb4','Bb4','A4','G4','G4','F4'], ['F4','G4','A4','G4','F4','Eb4']]
# Gegenmelodie (eigene) – lange Bögen im Tenor, antwortet in den Lücken der Hook
COUNTER = [[(0,2,'Eb4'),(2,2,'D4')], [(0,3,'Bb3'),(3,1,'C4')], [(0,2,'D4'),(2,2,'F4')], [(0,3,'A3'),(3,1,'C4')],
           [(0,2,'G4'),(2,1,'F4'),(3,1,'Eb4')], [(0,2,'G4'),(2,2,'Bb4')], [(0,2,'F4'),(2,1,'D4'),(3,1,'F4')], [(0,2,'A4'),(2,2,'C5')]]
# Violinen-Oberstimme (eigene) – hohe, singende Haltetöne für Drop & Finale
DESC = [[(0,4,'C6')], [(0,2,'Bb5'),(2,2,'G5')], [(0,4,'D6')], [(0,2,'C6'),(2,2,'A5')],
        [(0,2,'Eb6'),(2,2,'D6')], [(0,4,'G6')], [(0,2,'F6'),(2,2,'D6')], [(0,2,'C6'),(2,2,'Eb6')]]

def tones(bar, tr, lo, hi):
    r, ivs = CHORDS[bar % 4]; pcs = [(r+i+tr) % 12 for i in ivs]
    return [p for p in range(lo, hi+1) if p % 12 in pcs]
def root(bar, tr, octave):
    p = 12*(octave+1) + (CHORDS[bar % 4][0]+tr) % 12
    return p-12 if p > 12*(octave+1)+7 else p
def line(mel, b, s, tr, vel, ch, shift=0):
    for off, d, n in mel[b % 8]: note(s+off, m(n)+tr+shift, d*.97, vel, ch)
def hook(b, s, tr, vel, ch, shift=0):
    for (off, d), n in zip(RHY, HOOK[b % 8]): note(s+off, m(n)+tr+shift, d*.95, vel + (8 if off in (0, 2) else 0), ch)
def pad(b, s, tr, vel, ch, lo, hi, n=4, dur=4):
    for p in tones(b, tr, lo+tr, hi+tr)[:n]: note(s, p, dur, vel, ch)
def timp_roll(s, p, v0, v1, beats=4):
    for i in range(int(beats*8)): note(s+i/8, p, .12, v0+(v1-v0)*i/(beats*8), TIMP, hum=False)
def tp(b, tr):  # Paukenton (F2..E3)
    p = root(b, tr, 2)
    while p < m('F2'): p += 12
    while p > m('E3'): p -= 12
    return p

beat = 0.0
def section(n, fn):
    global beat
    for b in range(n): fn(b, beat); beat += 4

# 1) INTRO – zarter Streicherteppich, ab Takt 5 Chor + Harfe, am Ende Paukenwirbel
def intro(b, s):
    pad(b, s, 0, 40+b*3, STR, m('G3'), m('Eb5')); swell(s, STR, 70, 100)
    note(s, root(b, 0, 2), 4, 44+b*2, CB)
    if b >= 4: pad(b, s, 0, 34+b*3, CHO, m('G3'), m('C5'), 3)
    if b >= 4:
        for i, p in enumerate(tones(b, 0, m('C5'), m('C6'))[:4]): note(s+2+i*.25, p, 1.5, 40, HARP)
    if b == 7: timp_roll(s, m('C3'), 25, 80)
section(8, intro)

# 2) STROPHE – Celli singen die Gegenmelodie, Streicher halten, Pizzicato-Puls leise
def verse(b, s):
    line(COUNTER, b, s, 0, 62+b*3, CEL, -12)
    pad(b, s, 0, 40+b*2, STR, m('G3'), m('G4'), 3)
    note(s, root(b, 0, 2), 4, 56, CB)
    if b >= 4: line(COUNTER, b, s, 0, 44+b*3, HRN, -12)
section(8, verse)

# 3) AUFBAU – Hörner nehmen die Hook (eine Oktave tiefer), Streicher-Ostinato verdichtet sich
def build(b, s):
    step = .5 if b < 4 else .25
    ts = tones(b, 0, m('C4'), m('C5')); k = 0; i = 0
    while k < 4: note(s+k, ts[i % len(ts)], step*.9, 50+b*6, SPC); k += step; i += 1
    if b < 6: hook(b, s, 0, 54+b*6, HRN, -12)
    pad(b, s, 0, 50+b*6, STR, m('G3'), m('Eb5')); swell(s, STR, 80, 115)
    pad(b, s, 0, 40+b*6, CHO, m('G3'), m('C5'), 3)
    note(s, root(b, 0, 2), 4, 64+b*4, CB)
    if b >= 6:
        for i in range(32): note(s+i/8, 38, .08, 40+i*2+(b-6)*20, DR, False)
    if b == 7: timp_roll(s, m('C3'), 60, 118, 3.5); note(s, 52, 3.5, 70, DR, False)
section(8, build)

# 4) DROP – volles Orchester hinter dem Klavier: Violinen-Oberstimme, Hörner-Gegenmelodie,
#    Chor, Pauken, große Trommel + Becken; zweite Hälfte: Blech verdoppelt die Hook tief
def drop_bar(b, s, tr, v, big=False):
    line(DESC, b, s, tr, v-24, VLN, -12 if not big else 0)
    line(COUNTER, b, s, tr, v-20, HRN, -12)
    line(COUNTER, b, s, tr, v-26, CEL, -24)
    pad(b, s, tr, v-36, STR, m('G3'), m('Eb5'))
    pad(b, s, tr, v-34, CHO, m('G3'), m('C5'), 3)
    note(s, root(b, tr, 2), 4, v-10, CB); note(s, root(b, tr, 2)-12, 4, v-24, CB)
    if b >= 8 or big: hook(b, s, tr, v-24, BRS, -12)
    note(s, tp(b, tr), 1, v-6, TIMP); note(s+2, tp(b, tr), 1, v-16, TIMP)
    note(s, 35, .5, v-14, DR, False); note(s+2, 35, .5, v-24, DR, False)
    if b % 4 == 0: note(s, 49, 3, v-10, DR, False)
    if b % 8 == 7: timp_roll(s+2, tp(b, tr), 50, v-4, 2)
    if big:
        k = 0; ts = tones(b, tr, m('C5')+tr, m('C6')+tr)
        while k < 4: note(s+k, ts[int(k*2) % len(ts)], .2, v-40, SPC); k += .5
section(16, lambda b, s: drop_bar(b, s, 0, 100))

# 5) BREAKDOWN – Chor + Solo-Cello, ganz zart
def breakdown(b, s):
    pad(b, s, 0, 36+b*2, CHO, m('G3'), m('C5'), 3); pad(b, s, 0, 30+b*2, STR, m('C3'), m('G4'), 3)
    line(COUNTER, b, s, 0, 54+b*3, CEL, -12)
    note(s, root(b, 0, 2), 4, 44, CB)
    if b >= 6: timp_roll(s, m('C3'), 20, 70); swell(s, STR, 60, 127)
section(8, breakdown)

# 6) AUFBAU 2 – Tremolo-Crescendo, Blech schwillt an, letzter Takt A-Dur (Dominante von D)
def build2(b, s):
    if b < 3: pad(b, s, 0, 60+b*14, STR, m('G3'), m('Eb5')); pad(b, s, 0, 50+b*14, BRS, m('C3'), m('C4'), 3); rp = root(b, 0, 2)
    else:
        for n in ['A3','C#4','E4','A4','C#5']: note(s, m(n), 3.5, 104, STR)
        for n in ['A2','E3','C#4']: note(s, m(n), 3.5, 100, BRS)
        rp = m('A2')
    swell(s, STR, 70, 127); swell(s, BRS, 60, 127)
    note(s, rp, 4, 80+b*10, CB)
    timp_roll(s, m('A2') if b == 3 else tp(b, 0), 50+b*12, 80+b*12, 3.5 if b == 3 else 4)
    for i in range(32): note(s+i/8, 38, .08, 50+b*14+i, DR, False)
section(4, build2)

# 7) FINALE – D-dorisch, alles: Violinen hoch, Blech + Hörner tragen die Hook mit, Chor, Pauken
section(16, lambda b, s: drop_bar(b, s, 2, 108, big=True))

# 8) OUTRO – Streicher und Chor klingen aus
outro_start = beat
def outro(b, s):
    tr = 2
    if b == 0: note(s, 49, 4, 90, DR, False); note(s, tp(0, tr), 2, 96, TIMP)
    if b < 3: pad(b, s, tr, 52-b*6, STR, m('G3'), m('Eb5')); pad(b, s, tr, 44-b*6, CHO, m('G3'), m('C5'), 3); note(s, root(b, tr, 2), 4, 56-b*6, CB)
    else:
        for n in ['D3','A3','D4','F4','A4','D5']: note(s, m(n), 8, 48, STR, False)
        for n in ['D4','F4','A4']: note(s, m(n), 8, 40, CHO, False)
        note(s, m('D2'), 8, 56, CB, False); timp_roll(s, m('D3'), 20, 60, 3)
section(4, outro)
tempo = [(0, BPM)] + [(int((outro_start+4+i*1.5)*TPB), x) for i, x in enumerate([120,112,100,88,76,66])]

mid = mido.MidiFile(ticks_per_beat=TPB); trk = mido.MidiTrack(); mid.tracks.append(trk)
allev = [(t, -2, 0, x, 0) for t, x in tempo] + [(0, -1, ch, 0, 0) for ch in SETUP] + ev
allev.sort(key=lambda e: (e[0], -0.5 if e[1] == 0 else e[1]))
now = 0
for t, typ, ch, a, b in allev:
    dt = t-now; now = t
    if typ == -2: trk.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a), time=dt))
    elif typ == -1:
        bank, prog, vol, pan = SETUP[ch]
        trk.append(mido.Message('control_change', channel=ch, control=0, value=bank if ch != DR else 0, time=dt))
        trk.append(mido.Message('program_change', channel=ch, program=prog, time=0))
        for ctl, val in ((7, vol), (10, pan), (11, 127)): trk.append(mido.Message('control_change', channel=ch, control=ctl, value=val, time=0))
    elif typ == 1: trk.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
    elif typ == 0: trk.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
    else: trk.append(mido.Message('control_change', channel=ch, control=a, value=b, time=dt))
mid.save(sys.argv[1]); print('Orchester: Dauer', round(mid.length, 1), 's, Noten', sum(1 for e in ev if e[1] == 1))
