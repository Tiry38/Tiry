"""Klavier-Arrangement im Stil von 'United We Dance' (C dorisch, 126 BPM, i-III-VII-IV).
Ruhiger Start -> Aufbau -> Drop -> Breakdown -> Rückung nach D -> großes Finale."""
import random, mido

random.seed(7)
TPB = 480
BPM = 126
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
def m(n):  # "G4" -> 67
    return 12*(int(n[-1])+1) + NOTE[n[:-1]]

ev = []  # (tick, type, a, b)
def note(beat, pitch, dur, vel, hum=True):
    t = int(beat*TPB) + (random.randint(-6, 6) if hum else 0)
    v = max(1, min(127, int(vel + (random.randint(-5, 5) if hum else 0))))
    t = max(0, t)
    ev.append((t, 1, pitch, v))
    ev.append((t + max(10, int(dur*TPB) - 12), 0, pitch, 0))
def pedal(beat, on):
    ev.append((max(0, int(beat*TPB) + (0 if on else -2)), 2, 64, 127 if on else 0))
tempo_changes = []

# Harmonie (C dorisch): je ein Akkord pro Takt
CHORDS = [('C', [0,3,7]), ('Eb', [0,4,7]), ('Bb', [0,4,7]), ('F', [0,4,7])]
# Eigene Hook im Stil des Originals: Rhythmus 3+3+2 (punktierte Achtel), Tonumfang C4-Bb4
HOOK = [
    ['G4','G4','F4','Eb4','Eb4','C4'],
    ['Eb4','Eb4','F4','G4','G4','Bb4'],
    ['Bb4','Bb4','G4','F4','F4','D4'],
    ['F4','F4','G4','A4','A4','F4'],
    ['G4','G4','F4','Eb4','Eb4','C4'],
    ['Eb4','Eb4','F4','G4','G4','Bb4'],
    ['Bb4','Bb4','A4','G4','G4','F4'],
    ['F4','G4','A4','G4','F4','Eb4'],
]
RHY = [(0,0.75),(0.75,0.75),(1.5,0.5),(2,0.75),(2.75,0.75),(3.5,0.5)]

def chord_tones(bar, tr=0):
    root, ivs = CHORDS[bar % 4]
    r = NOTE[root] + tr
    return [(r + i) % 12 for i in ivs], r % 12

def bass_root(bar, tr, octave=2):
    _, r = chord_tones(bar, tr)
    p = 12*(octave+1) + r
    if p > 12*(octave+1) + 7: p -= 12   # tiefe Lage halten
    return p

def voicing(bar, tr, low, high):
    pcs, _ = chord_tones(bar, tr)
    return [p for p in range(low, high+1) if p % 12 in pcs]

def melody(bar, start, tr, vel, octaves=False, block=False, up=0):
    for (off, d), n in zip(RHY, HOOK[bar % 8]):
        p = m(n) + tr + up
        accent = 8 if off in (0, 2) else 0
        note(start+off, p, d, vel+accent)
        if octaves:
            note(start+off, p+12, d, vel+accent-6)
        if block:  # Akkordtöne unter der Melodie (max. Quinte darunter)
            pcs, _ = chord_tones(bar, tr)
            under = [q for q in range(p-8, p) if q % 12 in pcs][-2:]
            for q in under:
                note(start+off, q, d, vel+accent-22)

beat = 0.0
def section(bars, fn):
    global beat
    for b in range(bars):
        fn(b, beat)
        beat += 4

# 1) INTRO – ruhig, weit, Pedal
def intro(b, s):
    pedal(s, True); pedal(s+4, False)
    br = bass_root(b, 0, 2)
    note(s, br, 4, 48); note(s, br+12, 4, 40)
    for i, p in enumerate(voicing(b, 0, m('G3'), m('G4'))):
        note(s+0.5+i*0.12, p, 3.5, 34)
    if b >= 4:  # Hook-Fragment, hoch und zart
        for (off, d), n in list(zip(RHY, HOOK[b]))[:3]:
            note(s+off, m(n)+12, d*1.6, 46)
section(8, intro)

# 2) STROPHE – Melodie kommt, gebrochene Achtel links, Crescendo
def verse(b, s):
    pedal(s, True); pedal(s+2, False); pedal(s+2, True); pedal(s+4, False)
    br = bass_root(b, 0, 3)
    pcs, r = chord_tones(b, 0)
    third = br + (3 if b % 4 == 0 else 4)
    pat = [br-12, br-5, br, third, br+7, third, br, br-5]
    for i, p in enumerate(pat):
        note(s+i*0.5, p, 0.5, 52+b*2)
    melody(b, s, 0, 62+b*2)
section(8, verse)

# 3) AUFBAU – Oktaven treiben, Akkord-Repetitionen verdichten sich
def build(b, s):
    br = bass_root(b, 0, 3)
    step = 1 if b < 2 else 0.5 if b < 5 else 0.25
    vel = 60 + b*6
    k = 0
    while k < 4:
        note(s+k, br-12, step, vel); note(s+k, br, step, vel-4)
        k += step
    if b < 6:
        melody(b, s, 0, vel+4, octaves=True)
    else:  # letzte zwei Takte: Akkord-Sechzehntel steigend
        vs = voicing(b, 0, m('C4'), m('C6'))
        for i in range(16):
            top = vs[min(len(vs)-1, 2+i//2)]
            for q in [x for x in vs if top-8 <= x <= top]:
                note(s+i*0.25, q, 0.22, 70+i*3)
    if b == 7:  # Atempause vor dem Drop
        ev[:] = [e for e in ev if not (int((s+3.5)*TPB) <= e[0] < int((s+4)*TPB) and e[1] == 1)]
section(8, build)

# 4) DROP – House-Piano: Bass auf der Eins, Akkorde auf dem Offbeat, Hook in Oktaven + Block
def drop(tr, bars, base_vel):
    def f(b, s):
        pedal(s, True); pedal(s+1.95, False); pedal(s+2, True); pedal(s+4, False)
        br = bass_root(b, tr, 3)
        vs = voicing(b, tr, m('Bb3')+tr, m('Bb4')+tr)[:3]
        for k in range(4):
            note(s+k, br-12, 0.45, base_vel); note(s+k, br, 0.45, base_vel-6)
            for q in vs:
                note(s+k+0.5, q, 0.4, base_vel-14)
        melody(b, s, tr, base_vel+4, octaves=True, block=True, up=12)
        if b % 8 == 7:  # Fill: Sechzehntel-Abgang
            pcs, r = chord_tones(b, tr)
            run = [p for p in range(m('F5')+tr, m('F4')+tr, -1) if p % 12 in pcs or p % 12 in [(r+2) % 12]][:8]
            for i, p in enumerate(run):
                note(s+2+i*0.25, p, 0.24, base_vel)
    return f
section(16, drop(0, 16, 92))

# 5) BREAKDOWN – zurück zur Ruhe, Hook eine Oktave höher, sehr leise
def breakdown(b, s):
    pedal(s, True); pedal(s+4, False)
    br = bass_root(b, 0, 2)
    note(s, br, 4, 40)
    for i, p in enumerate(voicing(b, 0, m('C4'), m('Bb4'))):
        note(s+i*0.33, p, 3.5, 30)
    melody(b, s, 0, 44 + b*2, up=12)
section(8, breakdown)

# 6) AUFBAU 2 – mit Rückung: letzter Takt auf A-Dur (Dominante von D)
def build2(b, s):
    vel = 66 + b*12
    if b < 3:
        br = bass_root(b, 0, 3); vs = voicing(b, 0, m('C4'), m('C5'))
    else:
        br = m('A3'); vs = [p for p in range(m('C4'), m('E5')+1) if p % 12 in (9, 1, 4)]
    step = 0.5 if b < 2 else 0.25
    k = 0
    while k < 4:
        note(s+k, br-12, step, vel); note(s+k, br, step, vel)
        for q in vs[-3:]:
            note(s+k, q, step*0.9, vel-10+int(k*4))
        k += step
    if b == 3:
        ev[:] = [e for e in ev if not (int((s+3.5)*TPB) <= e[0] < int((s+4)*TPB) and e[1] == 1)]
section(4, build2)

# 7) FINALE – alles einen Ganzton höher (D dorisch), lauter, Bass-Oktaven in Achteln
def finale(b, s):
    pedal(s, True); pedal(s+1.95, False); pedal(s+2, True); pedal(s+4, False)
    tr = 2
    br = bass_root(b, tr, 3)
    vs = voicing(b, tr, m('C4'), m('C5')+tr)[:3]
    for k in range(8):
        note(s+k*0.5, br-12, 0.45, 100 if k % 2 == 0 else 86)
        note(s+k*0.5, br, 0.45, 92 if k % 2 == 0 else 80)
    for k in range(4):
        for q in vs:
            note(s+k+0.5, q, 0.4, 84)
    melody(b, s, tr, 104, octaves=True, block=True, up=12)
    if b in (7, 15):
        pcs, r = chord_tones(b, tr)
        run = [p for p in range(m('G5')+tr, m('G4')+tr, -1) if p % 12 in pcs][:6]
        for i, p in enumerate(run):
            note(s+2.5+i*0.25, p, 0.24, 100)
section(16, finale)

# 8) OUTRO – ausklingen auf Dm(add9), Ritardando
outro_start = beat
def outro(b, s):
    pedal(s, True); pedal(s+4, False)
    tr = 2
    if b < 3:
        br = bass_root(b, tr, 2)
        note(s, br, 4, 50-b*4); note(s, br+12, 4, 44-b*4)
        melody(b, s, tr, 52-b*5, up=12)
    else:
        for i, n in enumerate(['D2','A2','D3','E3','F3','A3','D4','E4','A4','D5']):
            note(s+i*0.22, m(n), 8, 42-i, hum=False)
section(4, outro)
pedal(beat+4, False)
for i, bpm in enumerate([120, 112, 100, 88, 76, 66]):
    tempo_changes.append((int((outro_start + 4 + i*1.5)*TPB), bpm))

# --- MIDI schreiben
mid = mido.MidiFile(ticks_per_beat=TPB)
tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage('track_name', name='Klavier', time=0))
allev = [(0, -2, BPM, 0)] + [(t, -2, b, 0) for t, b in tempo_changes] + ev
allev.append((0, -1, 0, 0))
allev.sort(key=lambda e: (e[0], e[1] if e[1] != 0 else -0.5))
now = 0
for t, typ, a, bb in allev:
    dt = t - now; now = t
    if typ == -2: tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a), time=dt))
    elif typ == -1: tr.append(mido.Message('program_change', program=0, time=dt))
    elif typ == 1: tr.append(mido.Message('note_on', note=a, velocity=bb, time=dt))
    elif typ == 0: tr.append(mido.Message('note_off', note=a, velocity=0, time=dt))
    else: tr.append(mido.Message('control_change', control=a, value=bb, time=dt))
import sys
mid.save(sys.argv[1])
print('Takte:', int(beat/4) + 1, 'Dauer ca. s:', round(mid.length, 1))
