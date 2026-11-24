"""Klavier-Arrangement im Stil von 'Flower In A Hurricane' (Justice) – C#-Moll, 126 BPM.
Harmonie laut Hooktheory: Refrain i | i9sus4 | VI65 | i | i9sus4 | VI | VII | IV, Bridge chromatisch.
Melodie: eigene Hook im Tonumfang des Originals (G#3-B4). Extra: Gegenstimmen im Hintergrund."""
import random, sys, mido

random.seed(11)
TPB, BPM = 480, 126
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'Bb':10,'B':11}
def m(n): return 12*(int(n[-1])+1) + NOTE[n[:-1]]

ev = []
def note(beat, pitch, dur, vel, hum=True):
    t = max(0, int(beat*TPB) + (random.randint(-6, 6) if hum else 0))
    v = max(1, min(127, int(vel + (random.randint(-5, 5) if hum else 0))))
    ev.append((t, 1, pitch, v)); ev.append((t + max(10, int(dur*TPB) - 12), 0, pitch, 0))
def pedal(beat, on): ev.append((max(0, int(beat*TPB) + (0 if on else -2)), 2, 64, 127 if on else 0))
def pedal_bar(s, halves=True):
    if halves: pedal(s, True); pedal(s+1.95, False); pedal(s+2, True); pedal(s+4, False)
    else: pedal(s, True); pedal(s+4, False)
def mute_gap(s0, s1):  # Atempause vor einem Drop
    ev[:] = [e for e in ev if not (int(s0*TPB) <= e[0] < int(s1*TPB) and e[1] == 1)]

# (Bassgrundton, Tonvorrat) – Pitch-Classes
CHORUS = [(1,[1,4,8]), (1,[1,6,8,11,3]), (1,[9,1,4,8]), (1,[1,4,8]),
          (1,[1,6,8,11,3]), (9,[9,1,4]), (11,[11,3,6]), (6,[6,10,1])]
BRIDGE = [(11,[11,3,6]), (11,[11,1,6,9]), (9,[9,1,4,11]), (2,[2,6,9,11]),
          (7,[7,11,2,9]), (0,[0,4,7,10,2]), (11,[11,4,6,9,1]), (11,[11,4,6,9,1])]

# Eigene Hook (Offset, Dauer, Ton) pro Refrain-Takt – synkopiert, Disco-Funk
HOOK = [
 [(0,.5,'G#4'),(.5,.5,'G#4'),(1,1,'E4'),(2,.5,'C#4'),(2.5,1,'E4'),(3.5,.5,'F#4')],
 [(0,1,'G#4'),(1,.5,'F#4'),(1.5,1,'D#4'),(2.5,.5,'B3'),(3,1,'C#4')],
 [(0,.5,'E4'),(.5,.5,'E4'),(1,1,'G#4'),(2,.5,'A4'),(2.5,.5,'G#4'),(3,1,'E4')],
 [(0,1.5,'C#4'),(2,.5,'E4'),(2.5,1.5,'G#4')],
 [(0,.5,'B4'),(.5,.5,'B4'),(1,1,'G#4'),(2,.5,'F#4'),(2.5,1,'D#4'),(3.5,.5,'F#4')],
 [(0,1,'E4'),(1,.5,'C#4'),(1.5,1,'E4'),(2.5,.5,'A4'),(3,1,'G#4')],
 [(0,.5,'F#4'),(.5,.5,'F#4'),(1,1,'D#4'),(2,.5,'F#4'),(2.5,1.5,'B4')],
 [(0,1,'A#4'),(1,.5,'G#4'),(1.5,1,'F#4'),(2.5,1.5,'C#4')],
]

# Breakdown-Melodie (eigene) über die Bridge-Akkorde – fallende Linie mit chromatischer Farbe
BRIDGE_MEL = [
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D#5')],
 [(0,2.5,'C#5'),(2.5,.5,'F#5'),(3,1,'A5')],
 [(0,2.5,'B5'),(2.5,.5,'A5'),(3,1,'E5')],
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D5')],
 [(0,2.5,'B4'),(2.5,.5,'A4'),(3,1,'D5')],
 [(0,2.5,'E5'),(2.5,.5,'D5'),(3,1,'A#4')],
 [(0,4,'C#5')],
 [(0,2,'E5'),(2,2,'F#5')],
]

def tones(ch, tr, low, high, maxn=99):
    pcs = [(p+tr) % 12 for p in ch[1]]
    return [p for p in range(low, high+1) if p % 12 in pcs][:maxn]
def bass(ch, tr, octave=3):
    p = 12*(octave+1) + (ch[0]+tr) % 12
    return p-12 if p > 12*(octave+1)+7 else p

def melody(b, s, tr, vel, octaves=False, block=False, up=0, ch=None):
    for off, d, n in HOOK[b % 8]:
        p = m(n) + tr + up
        acc = 8 if off in (0, 2) else 0
        note(s+off, p, d, vel+acc)
        if octaves: note(s+off, p+12, d, vel+acc-6)
        if block and ch:
            for q in [x for x in tones(ch, tr, p-8, p-1)][-2:]:
                note(s+off, q, d, vel+acc-22)

# Gegenstimme: Leitton-Linie (Terzen/Septimen) mit Stimmführung, hält Halbe + Viertel-Schritte
cline = {'last': m('G#3')}
def counter(ch, s, tr, vel, low, high, rhythm=((0,2),(2,1),(3,1))):
    cand = tones(ch, tr, low, high)
    root = (ch[0]+tr) % 12
    cand = [c for c in cand if c % 12 != root] or cand
    for off, d in rhythm:
        last = cline['last']
        opts = sorted(cand, key=lambda c: (abs(c-last) == 0, abs(c-last)))
        nxt = opts[0] if off else min(cand, key=lambda c: abs(c-last))
        note(s+off, nxt, d, vel); cline['last'] = nxt

# Hintergrund-Arpeggio (Achtel, Justice-Synth-Gefühl), leise
def arp(ch, s, tr, vel, low, high, step=0.5):
    t = tones(ch, tr, low, high)
    seq = t + t[-2:0:-1]
    k = 0; i = 0
    while k < 4:
        note(s+k, seq[i % len(seq)], step*0.9, vel + (6 if k % 1 == 0 else 0)); k += step; i += 1

beat = 0.0
def section(bars, fn):
    global beat
    for b in range(bars): fn(b, beat); beat += 4

# 1) INTRO – weite Akkorde, Arpeggio hoch und leise
def intro(b, s):
    ch = CHORUS[b]; pedal_bar(s, False)
    br = bass(ch, 0, 2); note(s, br, 4, 46); note(s, br+12, 4, 38)
    for i, p in enumerate(tones(ch, 0, m('G#3'), m('G#4'), 4)): note(s+.5+i*.12, p, 3.5, 32)
    if b >= 2: arp(ch, s, 0, 26 + b*2, m('C#5'), m('C#6'), 0.5)
section(8, intro)

# 2) STROPHE – Hook, gebrochene Achtel links + Tenor-Gegenstimme
def verse(b, s):
    ch = CHORUS[b]; pedal_bar(s)
    br = bass(ch, 0, 3)
    for i, p in enumerate([br-12, br-5, br, br-5]*2): note(s+i*.5, p, .5, 50+b*2)
    counter(ch, s, 0, 42+b*2, m('E3'), m('C#4'))
    melody(b, s, 0, 64+b*2, up=12)
section(8, verse)

# 3) AUFBAU – Oktavbass verdichtet sich, Hook in Oktaven, Arp kommt dazu
def build(b, s):
    ch = CHORUS[b]; br = bass(ch, 0, 3)
    step = 1 if b < 2 else .5 if b < 5 else .25; vel = 60 + b*6
    k = 0
    while k < 4: note(s+k, br-12, step, vel); note(s+k, br, step, vel-4); k += step
    if b < 6:
        melody(b, s, 0, vel+4, octaves=True, up=12)
        arp(ch, s, 0, 34+b*4, m('C#4'), m('G#4'), .5)
    else:
        vs = tones(ch, 0, m('C#4'), m('C#6'))
        for i in range(16):
            top = vs[min(len(vs)-1, 2+i//2)]
            for q in [x for x in vs if top-8 <= x <= top]: note(s+i*.25, q, .22, 70+i*3)
    if b == 7: mute_gap(s+3.5, s+4)
section(8, build)

# 4) DROP – House-Piano + Hook in Oktaven + Gegenstimme im Tenor + Antwort-Fills
def drop_bar(b, s, tr, v):
    ch = CHORUS[b % 8]; pedal_bar(s)
    br = bass(ch, tr, 3)
    vs = tones(ch, tr, m('A3')+tr, m('A4')+tr, 3)
    for k in range(4):
        note(s+k, br-12, .45, v); note(s+k, br, .45, v-6)
        for q in vs: note(s+k+.5, q, .4, v-16)
    counter(ch, s, tr, v-30, m('E4')+tr, m('C#5')+tr, ((0,1.5),(1.5,1),(2.5,1.5)))
    melody(b, s, tr, v+4, octaves=True, block=True, up=12, ch=ch)
    if b % 2 == 1:  # Antwort im Diskant, wenn die Hook Luft lässt
        hi = tones(ch, tr, m('C#6')+tr, m('C#7')+tr)
        for i, p in enumerate(hi[:3]): note(s+3+i*.33, p, .3, v-20)
    if b % 8 == 7:
        run = tones(ch, tr, m('E5')+tr, m('G#6')+tr)[::-1][:8]
        for i, p in enumerate(run): note(s+2+i*.25, p, .24, v)
section(16, lambda b, s: drop_bar(b, s, 0, 92))

# 5) BREAKDOWN – Bridge-Harmonien (chromatisch, verträumt), Melodie aus den Spitzentönen
def breakdown(b, s):
    ch = BRIDGE[b]; pedal_bar(s, False)
    note(s, bass(ch, 0, 2), 4, 40)
    arp(ch, s, 0, 30+b, m('B3'), m('B4'), .5)
    for off, d, n in BRIDGE_MEL[b]:
        note(s+off, m(n), d, 54 + b*2 + (6 if off == 0 else 0))
        note(s+off, m(n)-12, d, 36 + b*2)   # leise Unteroktave für Wärme
section(8, breakdown)

# 6) AUFBAU 2 – letzter Takt auf A#7 (Dominante von D#-Moll) -> Rückung
def build2(b, s):
    vel = 66 + b*12
    if b < 3:
        ch = CHORUS[b]; br = bass(ch, 0, 3); vs = tones(ch, 0, m('C#4'), m('C#5'))
    else:
        br = m('A#2'); vs = [p for p in range(m('C#4'), m('F5')+1) if p % 12 in (10, 2, 5, 8)]
    step = .5 if b < 2 else .25; k = 0
    while k < 4:
        note(s+k, br-12, step, vel); note(s+k, br, step, vel)
        for q in vs[-3:]: note(s+k, q, step*.9, vel-10+int(k*4))
        k += step
    if b == 3: mute_gap(s+3.5, s+4)
section(4, build2)

# 7) FINALE – D#-Moll, Bass in Achtel-Oktaven, Hook + Gegenstimme + Diskant-Arp
def finale(b, s):
    tr = 2; ch = CHORUS[b % 8]; pedal_bar(s)
    br = bass(ch, tr, 3)
    for k in range(8):
        note(s+k*.5, br-12, .45, 100 if k % 2 == 0 else 86); note(s+k*.5, br, .45, 92 if k % 2 == 0 else 80)
    for k in range(4):
        for q in tones(ch, tr, m('C4'), m('C5')+tr, 3): note(s+k+.5, q, .4, 82)
    counter(ch, s, tr, 66, m('E4')+tr, m('C#5')+tr, ((0,1.5),(1.5,1),(2.5,1.5)))
    melody(b, s, tr, 104, octaves=True, block=True, up=12, ch=ch)
    if b >= 8: arp(ch, s, tr, 50, m('C#6')+tr, m('C#7')+tr, .25)
    if b in (7, 15):
        run = tones(ch, tr, m('E5')+tr, m('A#6')+tr)[::-1][:6]
        for i, p in enumerate(run): note(s+2.5+i*.25, p, .24, 100)
section(16, finale)

# 8) OUTRO – Ritardando, Schluss auf D#m(add9)
outro_start = beat
def outro(b, s):
    tr = 2; pedal_bar(s, False)
    if b < 3:
        ch = CHORUS[b]; br = bass(ch, tr, 2)
        note(s, br, 4, 50-b*4); note(s, br+12, 4, 44-b*4)
        melody(b, s, tr, 52-b*5, up=12)
    else:
        for i, n in enumerate(['D#2','A#2','D#3','F3','F#3','A#3','D#4','F4','A#4','D#5']):
            note(s+i*.22, m(n), 8, 42-i, hum=False)
section(4, outro)
pedal(beat+4, False)
tempo = [(0, BPM)] + [(int((outro_start+4+i*1.5)*TPB), b) for i, b in enumerate([120,112,100,88,76,66])]

mid = mido.MidiFile(ticks_per_beat=TPB); trk = mido.MidiTrack(); mid.tracks.append(trk)
allev = [(t, -2, b, 0) for t, b in tempo] + [(0, -1, 0, 0)] + ev
allev.sort(key=lambda e: (e[0], -0.5 if e[1] == 0 else e[1]))
now = 0
for t, typ, a, b in allev:
    dt = t-now; now = t
    if typ == -2: trk.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a), time=dt))
    elif typ == -1: trk.append(mido.Message('program_change', program=0, time=dt))
    elif typ == 1: trk.append(mido.Message('note_on', note=a, velocity=b, time=dt))
    elif typ == 0: trk.append(mido.Message('note_off', note=a, velocity=0, time=dt))
    else: trk.append(mido.Message('control_change', control=a, value=b, time=dt))
mid.save(sys.argv[1]); print('Dauer s:', round(mid.length, 1))
