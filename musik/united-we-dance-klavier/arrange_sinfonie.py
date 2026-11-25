"""Sinfonieorchester HINTER der ersten Klavierfassung von 'United We Dance' (Klavier unverändert).
Steigerung: Intro beginnt NUR mit Klavier, dann kommen Gruppe für Gruppe Instrumente dazu, Finale = ganzer Saal.
Kanäle 0-15 -> Datei A, 16-31 -> Datei B (keine Drums in B). Sitzordnung über Panorama."""
import random, sys, mido
random.seed(9)
TPB, BPM = 480, 126
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'Eb':3,'D#':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'G#':8,'A':9,'Bb':10,'A#':10,'B':11}
def m(n): return 12*(int(n[-1])+1) + NOTE[n[:-1]]

# Kanal: (Bank, Programm, Lautstärke, Panorama = Sitzplatz)
V1, V1F, V2, VLA, CEL, CB, FLT, OBO, CLA, DR, HRN, TPT, TBN, TUB, TIMP, HARP = range(16)
GLK, CHO, BSN, PIC, PIZ = 16, 17, 18, 19, 20
SETUP = {V1:(20,49,100,28), V1F:(20,48,92,30), V2:(25,48,84,44), VLA:(0,41,88,76), CEL:(0,42,100,92), CB:(0,43,100,104),
         FLT:(0,73,84,58), OBO:(0,68,86,70), CLA:(0,71,84,54), DR:(0,48,96,64), HRN:(0,60,94,40), TPT:(0,56,86,84),
         TBN:(0,57,90,96), TUB:(0,58,92,100), TIMP:(0,47,104,64), HARP:(0,46,86,18),
         GLK:(0,9,70,80), CHO:(0,52,84,64), BSN:(0,70,84,74), PIC:(0,72,70,60), PIZ:(25,45,84,40)}
ev = []
def note(beat, p, dur, vel, ch, hum=True):
    t = max(0, int(beat*TPB) + (random.randint(-4, 4) if hum else 0))
    v = max(1, min(127, int(vel + (random.randint(-4, 4) if hum else 0))))
    ev.append((t, 1, ch, p, v)); ev.append((t + max(10, int(dur*TPB) - 10), 0, ch, p, 0))
def cc(beat, ch, ctl, val): ev.append((max(0, int(beat*TPB)), 2, ch, ctl, int(max(0, min(127, val)))))
def swell(s, ch, a, b, beats=4, steps=8):
    for i in range(steps+1): cc(s + beats*i/steps, ch, 11, a + (b-a)*i/steps)

CHORDS = [(0, [0,3,7]), (3, [3,7,10]), (10, [10,2,5]), (5, [5,9,0])]   # Cm Eb Bb F (C dorisch)
SCALE = [0,2,3,5,7,9,10]
RHY = [(0,.75),(.75,.75),(1.5,.5),(2,.75),(2.75,.75),(3.5,.5)]
HOOK = [['G4','G4','F4','Eb4','Eb4','C4'], ['Eb4','Eb4','F4','G4','G4','Bb4'], ['Bb4','Bb4','G4','F4','F4','D4'],
        ['F4','F4','G4','A4','A4','F4'], ['G4','G4','F4','Eb4','Eb4','C4'], ['Eb4','Eb4','F4','G4','G4','Bb4'],
        ['Bb4','Bb4','A4','G4','G4','F4'], ['F4','G4','A4','G4','F4','Eb4']]
COUNTER = [[(0,2,'Eb4'),(2,2,'D4')], [(0,3,'Bb3'),(3,1,'C4')], [(0,2,'D4'),(2,2,'F4')], [(0,3,'A3'),(3,1,'C4')],
           [(0,2,'G4'),(2,1,'F4'),(3,1,'Eb4')], [(0,2,'G4'),(2,2,'Bb4')], [(0,2,'F4'),(2,1,'D4'),(3,1,'F4')], [(0,2,'A4'),(2,2,'C5')]]
DESC = [[(0,4,'C6')], [(0,2,'Bb5'),(2,2,'G5')], [(0,4,'D6')], [(0,2,'C6'),(2,2,'A5')],
        [(0,2,'Eb6'),(2,2,'D6')], [(0,4,'G6')], [(0,2,'F6'),(2,2,'D6')], [(0,2,'C6'),(2,2,'Eb6')]]

def tones(bar, tr, lo, hi):
    r, ivs = CHORDS[bar % 4]; pcs = [(r+i+tr) % 12 for i in ivs]
    return [p for p in range(lo, hi+1) if p % 12 in pcs]
def root(bar, tr, octave):
    p = 12*(octave+1) + (CHORDS[bar % 4][0]+tr) % 12
    return p-12 if p > 12*(octave+1)+7 else p
def line(mel, b, s, tr, vel, ch, shift=0, legato=.97):
    for off, d, n in mel[b % 8]: note(s+off, m(n)+tr+shift, d*legato, vel, ch)
def hook(b, s, tr, vel, ch, shift=0):
    for (off, d), n in zip(RHY, HOOK[b % 8]): note(s+off, m(n)+tr+shift, d*.95, vel + (8 if off in (0, 2) else 0), ch)
def pad(b, s, tr, vel, ch, lo, hi, n=4, dur=4):
    for p in tones(b, tr, lo+tr, hi+tr)[:n]: note(s, p, dur, vel, ch)
def arp16(b, s, tr, vel, ch, lo, hi, beats=4, start=0):
    t = tones(b, tr, lo+tr, hi+tr); seq = t + t[-2:0:-1]
    for i in range(int(beats*4)): note(s+start+i*.25, seq[i % len(seq)], .22, vel + (8 if i % 4 == 0 else 0), ch)
def ostinato(b, s, tr, vel, ch, lo, hi, step=.25):
    t = tones(b, tr, lo+tr, hi+tr); pat = [0, 2, 1, 2]; k = 0; i = 0
    while k < 4: note(s+k, t[pat[i % 4] % len(t)], step*.85, vel + (8 if i % 4 == 0 else 0), ch); k += step; i += 1
def run(s, tr, start, n, up=True, vel=90, ch=V1F, step=.125):
    p = start+tr; out = []
    while len(out) < n:
        if (p-tr) % 12 in SCALE: out.append(p)
        p += 1 if up else -1
    for i, q in enumerate(out): note(s+i*step, q, step*.95, vel + i*(1 if up else 0), ch, hum=False)
def gliss(s, tr, lo, hi, vel=70, beats=1):
    ps = [p for p in range(lo+tr, hi+tr) if (p-tr) % 12 in SCALE]
    for i, p in enumerate(ps): note(s + beats*i/len(ps), p, 1.5, vel, HARP, hum=False)
def trill(s, a, b, beats, vel, ch):
    for i in range(int(beats*8)): note(s+i/8, a if i % 2 == 0 else b, .11, vel, ch, hum=False)
def timp_roll(s, p, v0, v1, beats=4):
    for i in range(int(beats*8)): note(s+i/8, p, .12, v0+(v1-v0)*i/(beats*8), TIMP, hum=False)
def tp(b, tr):
    p = root(b, tr, 2)
    while p < m('F2'): p += 12
    while p > m('E3'): p -= 12
    return p
def crash(s, v=110): note(s, 49, 3, v, DR, False)
def sus_cym(s, beats, v0, v1):
    for i in range(int(beats*8)): note(s+i/8, 51, .12, v0+(v1-v0)*i/(beats*8), DR, False)

beat = 0.0
def section(n, fn):
    global beat
    for b in range(n): fn(b, beat); beat += 4

# 1) INTRO – Takt 1-4 NUR KLAVIER; 5-6 tiefe Streicher ganz leise; 7-8 Harfe + Flöte
def intro(b, s):
    if b < 4: return
    note(s, root(b, 0, 2), 4, 36+b*3, CB); pad(b, s, 0, 30+b*3, CEL, m('C3'), m('G3'), 2)
    swell(s, CEL, 60, 100)
    if b >= 5: pad(b, s, 0, 30+b*2, VLA, m('G3'), m('Eb4'), 2)
    if b >= 6:
        arp16(b, s, 0, 34+b*2, HARP, m('C5'), m('C6'), 2, 0)
        line(COUNTER, b, s, 0, 40+b*3, FLT, 12)
    if b == 7: gliss(s+3, 0, m('C4'), m('C6'), 60); timp_roll(s+2, m('C3'), 20, 60, 2)
section(8, intro)

# 2) STROPHE – Celli + Klarinette singen die Gegenmelodie, Pizzicato ab Takt 3, Hörner ab Takt 5, Fagott ab 7
def verse(b, s):
    line(COUNTER, b, s, 0, 60+b*3, CEL, -12)
    line(COUNTER, b, s, 0, 48+b*3, CLA)
    pad(b, s, 0, 36+b*2, VLA, m('G3'), m('Eb4'), 2); note(s, root(b, 0, 2), 4, 52+b*2, CB)
    if b >= 2:
        for k in range(4):
            for q in tones(b, 0, m('G4'), m('Eb5'))[:2]: note(s+k+.5, q, .3, 48+b*3, PIZ)
    if b >= 4: line(COUNTER, b, s, 0, 42+b*3, HRN, -12)
    if b >= 6: line(COUNTER, b, s, 0, 46+b*2, BSN, -24)
    if b == 7: gliss(s+3, 0, m('G3'), m('G5'), 64)
section(8, verse)

# 3) AUFBAU – 2. Violinen/Bratschen treiben (Achtel -> Sechzehntel), Oboe kommt, Blech schwillt, Pauken, Wirbel
def build(b, s):
    step = .5 if b < 4 else .25
    ostinato(b, s, 0, 52+b*6, V2, m('C4'), m('C5'), step); ostinato(b, s, 0, 46+b*6, VLA, m('G3'), m('G4'), .5)
    line(COUNTER, b, s, 0, 60+b*4, CEL, -12); line(COUNTER, b, s, 0, 54+b*4, OBO); line(COUNTER, b, s, 0, 50+b*4, CLA)
    line(COUNTER, b, s, 0, 52+b*5, HRN, -12)
    note(s, root(b, 0, 2), 4, 64+b*4, CB); note(s, tp(b, 0), 1, 60+b*5, TIMP)
    if b >= 4: pad(b, s, 0, 40+b*6, TBN, m('C3'), m('C4'), 3); swell(s, TBN, 60, 110)
    if b >= 6:
        trill(s, m('G5'), m('Ab5'), 4, 50+(b-6)*20, FLT); trill(s, m('Eb5'), m('F5'), 4, 46+(b-6)*20, OBO)
        for i in range(32): note(s+i/8, 38, .08, 40+i*2+(b-6)*18, DR, False)
    if b == 7:
        run(s+2, 0, m('C4'), 16, True, 80, V1F); timp_roll(s, m('C3'), 60, 120, 3.5); sus_cym(s, 3.5, 30, 100)
section(8, build)

# 4) DROP – 1. Hälfte: Streicher, Holz, Hörner, Pauken | 2. Hälfte: + Trompeten, Posaunen, Violinen-Oberstimme, Flötenfunkeln
def drop_bar(b, s, tr, v, full=False):
    second = b >= 8 or full
    ostinato(b, s, tr, v-30, V2, m('C4'), m('C5')); ostinato(b, s, tr, v-34, VLA, m('G3'), m('G4'), .5)
    line(COUNTER, b, s, tr, v-14, CEL, -12); line(COUNTER, b, s, tr, v-16, HRN, -12)
    line(COUNTER, b, s, tr, v-22, OBO); line(COUNTER, b, s, tr, v-24, CLA); line(COUNTER, b, s, tr, v-26, BSN, -24)
    note(s, root(b, tr, 2), 4, v-8, CB)
    note(s, tp(b, tr), .8, v-4, TIMP); note(s+2.5, tp(b, tr), .4, v-20, TIMP); note(s+3, tp(b, tr), .8, v-12, TIMP)
    note(s, 35, .5, v-16, DR, False); note(s+2, 35, .5, v-26, DR, False)
    if b % 4 == 0: crash(s, v-6)
    if b % 4 == 0 and b > 0: gliss(s-1, tr, m('C4'), m('C6'), 70)
    if second:
        line(DESC, b, s, tr, v-10, V1, 0 if full else -12)
        arp16(b, s, tr, v-40, FLT, m('C6'), m('C7'))
        for off in (1.5, 3.5):
            for q in tones(b, tr, m('C3')+tr, m('C4')+tr)[:3]: note(s+off, q, .4, v-14, TBN)
        note(s, root(b, tr, 1)+12, 2, v-14, TUB)
        for (off, d), n in zip(RHY, HOOK[b % 8]):
            if off in (0, 2): note(s+off, m(n)+tr, d*.9, v-20, TPT)
    else:
        pad(b, s, tr, v-36, V1, m('G4'), m('Eb5'), 3)
    if b % 8 == 7:
        run(s+2, tr, m('C5'), 16, True, v-10, V1F)
        for i, p in enumerate([48,48,45,45,43,43,41,41]): note(s+2+i*.25, p, .2, v-20+i*3, DR, False)
    if full:
        line(DESC, b, s, tr, v-14, TPT)
        hook(b, s, tr, v-34, GLK, 24)
        pad(b, s, tr, v-30, CHO, m('G3'), m('C5'), 3)
        arp16(b, s, tr, v-44, PIC, m('C6'), m('C7'))
        hook(b, s, tr, v-22, HRN, -12)
        if b % 4 == 3: run(s+2, tr, m('C6'), 16, False, v-14, V1F)
section(16, lambda b, s: drop_bar(b, s, 0, 100))

# 5) BREAKDOWN – wieder dünn: Oboen-Solo singt die Gegenmelodie über leisen Streichern; Harfe
def breakdown(b, s):
    pad(b, s, 0, 30+b*2, V1, m('G3'), m('G4'), 3); pad(b, s, 0, 28+b*2, VLA, m('C3'), m('G3'), 2)
    note(s, root(b, 0, 2), 4, 40, CB)
    line(COUNTER, b, s, 0, 64+b*2, OBO)
    if b % 2 == 1: arp16(b, s, 0, 36, HARP, m('C5'), m('C6'), 2, 2)
    if b >= 4: line(COUNTER, b, s, 0, 40+b*3, CEL, -12)
    if b >= 6: timp_roll(s, m('C3'), 20, 70); pad(b, s, 0, 40+b*5, CHO, m('G3'), m('C5'), 3); swell(s, CHO, 50, 120)
section(8, breakdown)

# 6) AUFBAU 2 – alle Streicher Tremolo-Ostinato, Holz-Triller, Blech-Crescendo, Trompeten-Fanfare auf A-Dur
def build2(b, s):
    if b < 3:
        ostinato(b, s, 0, 70+b*10, V2, m('C4'), m('C5')); ostinato(b, s, 0, 64+b*10, V1F, m('C5'), m('C6'))
        pad(b, s, 0, 56+b*14, TBN, m('C3'), m('C4'), 3); pad(b, s, 0, 56+b*14, HRN, m('G3'), m('Eb4'), 3)
        note(s, root(b, 0, 2), 4, 84+b*8, CB); timp_roll(s, tp(b, 0), 50+b*12, 80+b*12)
        trill(s, m('G5'), m('A5'), 4, 60+b*12, FLT)
    else:
        for n in ['A3','C#4','E4','A4']: note(s, m(n), 3.4, 104, V1); note(s, m(n)-12, 3.4, 100, VLA)
        for n in ['A2','E3','C#4']: note(s, m(n), 3.4, 106, TBN)
        note(s, m('A1'), 3.4, 110, CB); note(s, m('A1'), 3.4, 104, TUB)
        for i, n in enumerate(['E5','E5','A5','C#6']): note(s+i*.5, m(n), .45 if i < 3 else 2, 104+i*4, TPT)
        timp_roll(s, m('A2'), 80, 124, 3.4); sus_cym(s, 3.4, 40, 120); run(s+2, 0, m('A4'), 12, True, 100, V1F)
    for i in range(32): note(s+i/8, 38, .08, 50+b*14+i, DR, False)
    if b == 3: crash(s, 100)
section(4, build2)

# 7) FINALE – D-dorisch, DER GANZE SAAL
section(16, lambda b, s: drop_bar(b, s, 2, 110, full=True))

# 8) OUTRO – Instrumente verabschieden sich, Schlussakkord D-Moll mit Chor, Harfe, Pauke
outro_start = beat
def outro(b, s):
    tr = 2
    if b == 0: crash(s, 100); note(s, tp(0, tr), 2, 100, TIMP)
    if b < 3:
        pad(b, s, tr, 50-b*6, V1, m('G3'), m('Eb5')); pad(b, s, tr, 46-b*6, CHO, m('G3'), m('C5'), 3)
        line(COUNTER, b, s, tr, 58-b*6, CEL, -12); line(COUNTER, b, s, tr, 52-b*8, OBO)
        note(s, root(b, tr, 2), 4, 56-b*6, CB)
    else:
        for n in ['D3','A3','D4','F4','A4','D5']: note(s, m(n), 8, 48, V1, False)
        for n in ['D4','F4','A4']: note(s, m(n), 8, 42, CHO, False)
        for n in ['D3','A3','F4']: note(s, m(n), 8, 40, HRN, False)
        note(s, m('D2'), 8, 56, CB, False); timp_roll(s, m('D3'), 20, 60, 3)
        gliss(s, 2, m('C4'), m('C6'), 50, 1.5)
section(4, outro)
tempo = [(0, BPM)] + [(int((outro_start+4+i*1.5)*TPB), x) for i, x in enumerate([120,112,100,88,76,66])]

def write(path, chans):
    mid = mido.MidiFile(ticks_per_beat=TPB); trk = mido.MidiTrack(); mid.tracks.append(trk)
    sel = [e for e in ev if e[2] in chans]
    allev = [(t, -2, 0, x, 0) for t, x in tempo] + [(0, -1, ch, 0, 0) for ch in chans] + sel
    allev.sort(key=lambda e: (e[0], -0.5 if e[1] == 0 else e[1]))
    now = 0
    for t, typ, ch, a, b in allev:
        dt = t-now; now = t; c = ch % 16
        if typ == -2: trk.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a), time=dt))
        elif typ == -1:
            bank, prog, vol, pan = SETUP[ch]
            trk.append(mido.Message('control_change', channel=c, control=0, value=bank, time=dt))
            trk.append(mido.Message('program_change', channel=c, program=prog, time=0))
            for ctl, val in ((7, vol), (10, pan), (11, 127)): trk.append(mido.Message('control_change', channel=c, control=ctl, value=val, time=0))
        elif typ == 1: trk.append(mido.Message('note_on', channel=c, note=a, velocity=b, time=dt))
        elif typ == 0: trk.append(mido.Message('note_off', channel=c, note=a, velocity=0, time=dt))
        else: trk.append(mido.Message('control_change', channel=c, control=a, value=b, time=dt))
    mid.save(path)
write(sys.argv[1], [c for c in SETUP if c < 16]); write(sys.argv[2], [c for c in SETUP if c >= 16])
print('Sinfonie: Noten', sum(1 for e in ev if e[1] == 1), '| Instrumente', len(SETUP))
