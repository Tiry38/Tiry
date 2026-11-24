"""Orchester-Fassung im Stil von 'Flower In A Hurricane' (Justice) – C#-Moll, 126 BPM.
Klavier führt, Orchester (Streicher, Blech, Hörner, Chor, Kontrabass, Pauken, Drums) treibt.
Harmonie laut Hooktheory. Hook: eigene Melodie, austauschbar (HOOK), sobald die echte transkribiert ist."""
import random, sys, json, os, mido

random.seed(23)
TPB, BPM = 480, 126
NOTE = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def m(n): return 12*(int(n[-1])+1) + NOTE[n[:-1]]

# Kanäle: Programm, Lautstärke, Panorama
PNO, STR, SPC, CB, TIMP, CHOIR, BRASS, HORN, DR = 0, 1, 2, 3, 4, 5, 6, 7, 9
SETUP = {PNO:(0,118,64), STR:(48,92,44), SPC:(48,78,84), CB:(43,100,58), TIMP:(47,104,64),
         CHOIR:(52,74,70), BRASS:(61,96,76), HORN:(60,88,40), DR:(0,108,64)}

ev = []
def note(beat, pitch, dur, vel, ch=PNO, hum=True):
    j = random.randint(-6, 6) if hum and ch == PNO else (random.randint(-3, 3) if hum else 0)
    t = max(0, int(beat*TPB) + j)
    v = max(1, min(127, int(vel + (random.randint(-4, 4) if hum else 0))))
    ev.append((t, 1, ch, pitch, v)); ev.append((t + max(10, int(dur*TPB) - 12), 0, ch, pitch, 0))
def cc(beat, ch, ctl, val): ev.append((max(0, int(beat*TPB)), 2, ch, ctl, int(val)))
def pedal(beat, on): ev.append((max(0, int(beat*TPB) + (0 if on else -2)), 2, PNO, 64, 127 if on else 0))
def pedal_bar(s, halves=True):
    if halves: pedal(s, True); pedal(s+1.95, False); pedal(s+2, True); pedal(s+4, False)
    else: pedal(s, True); pedal(s+4, False)
def mute_gap(s0, s1):
    ev[:] = [e for e in ev if not (int(s0*TPB) <= e[0] < int(s1*TPB) and e[1] == 1)]
def swell(s, ch, a, b, beats=4, steps=8):  # Expression-Crescendo
    for i in range(steps+1): cc(s + beats*i/steps, ch, 11, a + (b-a)*i/steps)

CHORUS = [(1,[1,4,8]), (1,[1,6,8,11,3]), (1,[9,1,4,8]), (1,[1,4,8]),
          (1,[1,6,8,11,3]), (9,[9,1,4]), (11,[11,3,6]), (6,[6,10,1])]
BRIDGE = [(11,[11,3,6]), (11,[11,1,6,9]), (9,[9,1,4,11]), (2,[2,6,9,11]),
          (7,[7,11,2,9]), (0,[0,4,7,10,2]), (11,[11,4,6,9,1]), (11,[11,4,6,9,1])]
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
# Echte Hook aus Transkription übernehmen, falls vorhanden (hook.json: 8 Takte [[off,dur,"Ton"],...])
if os.path.exists('hook.json'):
    HOOK = [[tuple(x) for x in bar] for bar in json.load(open('hook.json'))]
BRIDGE_MEL = [
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D#5')], [(0,2.5,'C#5'),(2.5,.5,'F#5'),(3,1,'A5')],
 [(0,2.5,'B5'),(2.5,.5,'A5'),(3,1,'E5')],   [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D5')],
 [(0,2.5,'B4'),(2.5,.5,'A4'),(3,1,'D5')],   [(0,2.5,'E5'),(2.5,.5,'D5'),(3,1,'A#4')],
 [(0,4,'C#5')], [(0,2,'E5'),(2,2,'F#5')],
]
# Gegenmelodie für Streicher/Hörner (eigene) – lange Bögen, antwortet der Hook
COUNTER = [
 [(0,3,'C#5'),(3,1,'D#5')], [(0,2,'E5'),(2,2,'D#5')], [(0,3,'C#5'),(3,1,'B4')], [(0,4,'C#5')],
 [(0,3,'D#5'),(3,1,'E5')],  [(0,2,'F#5'),(2,2,'E5')], [(0,2,'D#5'),(2,2,'F#5')], [(0,4,'F#5')],
]

def tones(ch, tr, low, high, maxn=99):
    pcs = [(p+tr) % 12 for p in ch[1]]
    return [p for p in range(low, high+1) if p % 12 in pcs][:maxn]
def bass(ch, tr, octave=3):
    p = 12*(octave+1) + (ch[0]+tr) % 12
    return p-12 if p > 12*(octave+1)+7 else p

def hook(b, s, tr, vel, chn=PNO, up=0, octaves=False, block=None, legato=1.0):
    for off, d, n in HOOK[b % 8]:
        p = m(n) + tr + up; acc = 8 if off in (0, 2) else 0
        note(s+off, p, d*legato, vel+acc, chn)
        if octaves: note(s+off, p+12, d*legato, vel+acc-6, chn)
        if block:
            for q in tones(block, tr, p-8, p-1)[-2:]: note(s+off, q, d*legato, vel+acc-22, chn)
def line(mel, b, s, tr, vel, chn, up=0, octaves=False):
    for off, d, n in mel[b % 8]:
        note(s+off, m(n)+tr+up, d, vel, chn)
        if octaves: note(s+off, m(n)+tr+up-12, d, vel-8, chn)
def pad(c, s, tr, vel, chn, low, high, dur=4, maxn=4):
    for p in tones(c, tr, low, high, maxn): note(s, p, dur, vel, chn)
def arp(c, s, tr, vel, low, high, step=.5, chn=PNO):
    t = tones(c, tr, low, high); seq = t + t[-2:0:-1]; k = 0; i = 0
    while k < 4: note(s+k, seq[i % len(seq)], step*.9, vel + (6 if k % 1 == 0 else 0), chn); k += step; i += 1

# Drums (GM): Kick 36, Snare 38, Clap 39, Crash 49/57, Toms 41/45/48, Ride 51
def kick4(s, v):
    for k in range(4): note(s+k, 36, .25, v, DR, hum=False)
def snare_roll(s, v0, v1, beats=4, div=4):
    n = int(beats*div)
    for i in range(n): note(s+i/div, 38, .1, v0+(v1-v0)*i/n, DR, hum=False)
def tom_fill(s):
    for i, p in enumerate([48,48,45,45,43,43,41,41]): note(s+2+i*.25, p, .2, 96+i*3, DR, hum=False)
def crash(s, v=118): note(s, 49, 2, v, DR, hum=False); note(s, 57, 2, v-10, DR, hum=False)
def timp(s, p, v, roll=False, beats=4):
    if roll:
        for i in range(int(beats*8)): note(s+i/8, p, .12, v[0]+(v[1]-v[0])*i/(beats*8), TIMP, hum=False)
    else: note(s, p, 1, v, TIMP)

# ================= ELEKTRO-VIOLINE (Lindsey-Stirling-Stil) =================
import math
# Kanal: (Bank, Programm, Lautstärke, Panorama)
PAD, SAW, SUB, WOB, STRF, HIT, SBR, ARP, DR, VOX, NOISE, BOOM, EP, VIO, VIO2 = 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15
SETUP = {PAD:(0,94,84,64), SAW:(20,81,92,64), SUB:(0,38,110,64), WOB:(0,87,98,64), STRF:(20,48,80,40),
         HIT:(0,55,96,64), SBR:(17,62,88,84), ARP:(0,80,70,92), DR:(0,16,118,64), VOX:(17,54,80,50),
         NOISE:(0,122,80,64), BOOM:(8,116,104,64), EP:(0,4,84,70), VIO:(17,40,127,62), VIO2:(17,40,96,66)}

def pw(beat, ch, val): ev.append((max(0, int(beat*TPB)), 0.6, ch, int(max(-8192, min(8191, val))), 0))
def expr(beat, ch, val):
    ev.append((max(0, int(beat*TPB)-1), 0.6, ch, -99999, int(val)))   # CC11
    ev.append((max(0, int(beat*TPB)-1), 0.6, ch, -99998, int(val)))   # CC2 (Expr.-Sounds)
def vnote(beat, pitch, dur, vel, ch=VIO, accent=False, vib=True):
    beat += random.uniform(-0.008, 0.008)
    scoop = accent or (dur >= .75 and random.random() < .45)
    pw(beat, ch, -2048 if scoop else 0)
    if scoop:
        for i in range(1, 5): pw(beat + i*.03, ch, -2048 + 512*i)
    expr(beat, ch, 92 if dur >= 1 else 120)
    note(beat, pitch, dur, vel, ch, hum=False)
    if dur >= 1:
        for i in range(1, 7):
            v = 92 + 35*math.sin(math.pi*i/7*0.9); cc(beat + dur*i/8, ch, 11, v); cc(beat + dur*i/8, ch, 2, v)
    if vib and dur >= .75:
        rate = 5.6 * 60/126; t = .25
        while t < dur - .05:
            pw(beat+t, ch, min(750, 220 + 900*(t-.25)) * math.sin(2*math.pi*rate*(t-.25))); t += 1/24
        pw(beat+dur-.02, ch, 0)
SCALE = [1,3,4,6,8,9,11]
def vrun(s, tr, start, n, up=True, vel=100, step=.25, ch=VIO):
    p = start + tr; out = []
    while len(out) < n:
        if (p - tr) % 12 in SCALE: out.append(p)
        p += 1 if up else -1
    for i, q in enumerate(out):
        pw(s+i*step, ch, 0); expr(s+i*step, ch, 112 + (i if up else 0))
        note(s+i*step, q, step*.95, vel + i*(2 if up else 0), ch, hum=False)
def vhook(b, s, tr, vel, up=12, octave=False):
    for off, d, n in HOOK[b % 8]:
        p = m(n) + tr + up; acc = off in (0, 2)
        vnote(s+off, p, d*.97, min(127, vel + (10 if acc else 2)), VIO, accent=acc and d >= 1)
        if octave: vnote(s+off, p-12, d*.97, vel-8, VIO2)
RIFF = [0,2,1, 0,2,1, 0,3, 0,2,1, 0,2,1, 3,2]
ACC = {0,3,6,8,11,14}
def vriff(c, s, tr, vel, ch=VIO, low=None):
    t = tones(c, tr, low or m('C#5')+tr, (low or m('C#5')+tr)+14)
    for i, k in enumerate(RIFF):
        p = t[k % len(t)]
        pw(s+i*.25, ch, 0); expr(s+i*.25, ch, 127 if i in ACC else 96)
        note(s+i*.25, p, .2, vel + (14 if i in ACC else 0), ch, hum=False)

def pump(s, chs, depth=40):
    for k in range(4):
        for ch in chs: cc(s+k, ch, 11, depth); cc(s+k+.15, ch, 11, depth+40); cc(s+k+.35, ch, 11, 120); cc(s+k+.5, ch, 11, 127)
def unpump(s, chs):
    for ch in chs: cc(s, ch, 11, 127)
def wobble(s, beats, rates):  # Lautstärke-LFO auf dem Wobble-Bass (Schläge pro Zyklus)
    t = 0.0
    seg = beats/len(rates)
    for r in rates:
        t0 = t
        while t < t0+seg - 1e-6:
            ph = ((t - t0) / r) % 1.0
            cc(s+t, WOB, 11, 18 + 109*(math.sin(math.pi*ph)**2)); t += 1/32
def riser(s, beats, v0=20, v1=127):
    note(s, 72, beats, 100, NOISE, hum=False)
    for i in range(int(beats*8)+1): cc(s+i/8, NOISE, 11, v0 + (v1-v0)*(i/(beats*8))**1.6)
def kick(s, v=124): note(s, 36, .25, v, DR, False)
def snare(s, v=118): note(s, 38, .2, v, DR, False); note(s, 39, .2, v-20, DR, False)
def hats(s, v=70, step=.5, off=.0):
    k = off
    while k < 4: note(s+k, 42, .1, v + (8 if k % 1 == 0.5 else 0), DR, False); k += step
def trap_roll(s, v=80):  # Hi-Hat-Roll am Taktende
    for i in range(8): note(s+3+i/8, 42, .06, v+i*3, DR, False)


# ================= ORIGINALGETREUE FORM (Akkorde/Aufbau laut Ultimate Guitar + Hooktheory) =================
# Akkorde: (Bass-Pitchclass, [Tonvorrat]) – C# = 1
Cm   = (1, [1,4,8]);   Csus = (1, [1,6,8]);  CsusB = (11, [1,6,8,11]); C7s = (1, [1,6,8,11])
A_C  = (1, [9,1,4]);   A_B  = (11, [9,1,4]); Amaj7 = (9, [9,1,4,8]);   Bmaj = (11, [11,3,6])
Fadd9 = (6, [6,10,1,8]); Fs = (6, [6,10,1]); Amaj = (9, [9,1,4])
Cm_B = (11, [1,4,8]);  Cm_A = (9, [1,4,8]);  Cm_F = (6, [1,4,8]);  Bmaj13 = (11, [11,3,6,10,8])
Badd9 = (11, [11,3,6,1]); Badd9_F = (6, [11,3,6,1]); Amaj9 = (9, [9,1,4,8,11]); Aadd9 = (9, [9,1,4,11])
D6 = (2, [2,6,9,11]); Gadd9 = (7, [7,11,2,9]); Cmaj7 = (0, [0,4,7,11])
def C5(top): return (1, [1, 8, top])

# Pro Takt: Liste (Start, Dauer, Akkord)
def bars(*xs): return [x if isinstance(x, list) else [(0, 4, x)] for x in xs]
def two(a, b): return [(0, 2, a), (2, 2, b)]
CHORUS_LINE = bars(two(Cm, Csus), two(CsusB, C7s), two(A_C, A_B), two(Cm, Csus), CsusB, Amaj7, Bmaj, Fadd9)
INTRO = bars(two(C5(1), C5(3)), two(C5(6), C5(8)), two(C5(9), C5(11)), Bmaj13, two(Cm, Cm_B), two(Cm, Cm_B), two(Cm_A, Cm_B), Cm_F)
VERSE = bars(Cm, Cm_B, Cm, Cm_B, Cm, Cm_B, two(Amaj, Bmaj), Fs)
BRIDGE_F = bars(Bmaj, two(Badd9, Badd9_F), Amaj9, Aadd9, D6, Gadd9, Cmaj7, two(A_B, Fs))
FINAL_IN = bars(Cm, Cm, Cm, Cm, Amaj, Amaj, Bmaj, Fs)

# Violinen-Melodie (eigene, folgt der Stimmführung Moll <-> sus4 der echten Akkorde)
MEL = [
 [(0,1,'G#4'),(1,1,'E4'),(2,1.5,'F#4'),(3.5,.5,'E4')],
 [(0,1.5,'F#4'),(1.5,.5,'G#4'),(2,1,'B4'),(3,1,'G#4')],
 [(0,1,'E4'),(1,1,'C#4'),(2,1.5,'E4'),(3.5,.5,'F#4')],
 [(0,1,'G#4'),(1,1,'E4'),(2,1.5,'F#4'),(3.5,.5,'E4')],
 [(0,2,'F#4'),(2,1,'G#4'),(3,1,'F#4')],
 [(0,1.5,'E4'),(1.5,.5,'C#4'),(2,2,'G#4')],
 [(0,1,'F#4'),(1,1,'D#4'),(2,1.5,'F#4'),(3.5,.5,'G#4')],
 [(0,2,'A#4'),(2,1,'G#4'),(3,1,'F#4')],
]
HOOK = MEL
BRIDGE_V = [
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D#5')], [(0,2.5,'C#5'),(2.5,.5,'D#5'),(3,1,'F#5')],
 [(0,2.5,'B5'),(2.5,.5,'A5'),(3,1,'E5')],   [(0,2.5,'C#5'),(2.5,.5,'B4'),(3,1,'E5')],
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D5')],  [(0,2.5,'B4'),(2.5,.5,'A4'),(3,1,'D5')],
 [(0,2.5,'E5'),(2.5,.5,'D5'),(3,1,'B4')],   [(0,2,'E5'),(2,2,'F#5')],
]

def at(bc, k):
    for off, d, c in bc:
        if off <= k < off+d: return c
    return bc[-1][2]
def band_pad(bc, s, vel, ch, lo, hi, maxn=4):
    for off, d, c in bc:
        for p in tones(c, 0, lo, hi)[:maxn]: note(s+off, p, d, vel, ch)
def band_sub(bc, s, vel, style='long'):
    for off, d, c in bc:
        p = bass(c, 0, 2)
        if style == 'long': note(s+off, p, d, vel, SUB)
        elif style == 'roll':
            k = off
            while k < off+d: note(s+k+.5, p, .4, vel, SUB); note(s+k+.75, p+12, .2, vel-22, SUB); k += 1
def band_stabs(bc, s, vel, ch=SAW):
    for k in range(4):
        for q in tones(at(bc, k+.5), 0, m('G#3'), m('G#4'))[:4]: note(s+k+.5, q, .4, vel, ch)
def band_arp(bc, s, vel, ch=ARP, lo=m('C#5'), hi=m('C#6'), step=.5):
    k = 0; i = 0
    while k < 4:
        t = tones(at(bc, k), 0, lo, hi); seq = t + t[-2:0:-1]
        note(s+k, seq[i % len(seq)], step*.9, vel, ch); k += step; i += 1
def band_spicc(bc, s, vel):
    for i in range(16):
        t = tones(at(bc, i*.25), 0, m('C#5'), m('C#6')); note(s+i*.25, t[[0,1,2,1][i % 4] % len(t)], .18, vel, STRF)
def vmel(mel, b, s, vel, up=12, octave=False):
    for off, d, n in mel[b % 8]:
        p = m(n) + up; acc = off in (0, 2)
        vnote(s+off, p, d*.97, min(127, vel + (10 if acc else 2)), VIO, accent=acc and d >= 1)
        if octave: vnote(s+off, p-12, d*.97, vel-8, VIO2)
def vriff_bc(bc, s, vel):
    for i, k in enumerate(RIFF):
        t = tones(at(bc, i*.25), 0, m('C#5'), m('C#5')+14); p = t[k % len(t)]
        pw(s+i*.25, VIO, 0); expr(s+i*.25, VIO, 127 if i in ACC else 96)
        note(s+i*.25, p, .2, vel + (14 if i in ACC else 0), VIO, hum=False)

beat = 0.0
def section(blist, fn):
    global beat
    for b, bc in enumerate(blist): fn(b, bc, beat); beat += 4
WET = [SAW, PAD, VOX, STRF]

# 1) INTRO – Original-Riff: C# liegt, darüber steigen D#-F#-G#-A-H, dann Hmaj13; danach C#m mit fallendem Bass
def intro(b, bc, s):
    if b < 3:
        for off, d, c in bc:
            top = c[1][2]; p = 12*5 + top if top >= 1 else 72
            p = m('C#5') + ((top - 1) % 12)
            vnote(s+off, p, d*.97, 92+b*4, accent=True)
            vnote(s+off, m('C#4'), d*.97, 70, VIO2, vib=False)
        note(s, m('C#2'), 4, 90, SUB); note(s, m('C#3'), 4, 60, PAD); note(s, m('G#3'), 4, 56, PAD)
        band_arp([(0, 4, Cm)], s, 44+b*4)
    elif b == 3:
        vnote(s, m('A#5'), 3.8, 100); band_pad(bc, s, 70, PAD, m('B3'), m('G#5'), 5); note(s, m('B1'), 4, 96, SUB)
        note(s, 49, 2, 90, DR, False)
    else:
        band_pad(bc, s, 56, PAD, m('G#3'), m('E5')); band_sub(bc, s, 92); band_arp(bc, s, 50)
        vmel(MEL, b-4, s, 84+b*2)
        kick(s, 100); kick(s+2, 92); hats(s, 54+b*2, 1, .5)
    if b == 7: riser(s, 4, 10, 100); trap_roll(s, 70)
section(INTRO, intro)

# 2) REFRAIN 1 – echte Refrain-Akkorde, Beat leicht, Violine führt
def chorus1(b, bc, s):
    vmel(MEL, b, s, 96 if b < 8 else 102, octave=b >= 8)
    band_pad(bc, s, 60, PAD, m('G#3'), m('E5')); band_sub(bc, s, 100); band_arp(bc, s, 46)
    for off, d, c in bc:
        for q in tones(c, 0, m('G#3'), m('G#4'))[:3]: note(s+off, q, .5, 60, EP); note(s+off+1.5, q, .5, 52, EP)
    kick(s, 112); kick(s+2, 104); snare(s+1, 100); snare(s+3, 104); hats(s, 60)
    if b == 0: note(s, 49, 2, 110, DR, False)
    if b == 15: vrun(s+2, 0, m('C#5'), 8, up=True, vel=100)
section(CHORUS_LINE*2, chorus1)

# 3) STROPHE – zurückgenommen: Violinen-Spiccato über C#m / C#m/H, Halbzeit-Beat, am Ende Aufbau
def verse(b, bc, s):
    if b < 6: vriff_bc(bc, s, 72+b*4)
    else: vmel(MEL, 6 + (b-6), s, 96)
    band_pad(bc, s, 50, PAD, m('G#3'), m('E5'), 3); band_sub(bc, s, 96)
    kick(s, 104); snare(s+2, 100); hats(s, 50, .5)
    if b >= 6:
        div = 4 if b == 6 else 8
        for i in range(4*div): note(s+i/div, 38, .1, 60+i*2, DR, False)
        band_spicc(bc, s, 60+(b-6)*14)
    if b == 6: riser(s, 8, 10, 127)
    if b == 7: mute_gap(s+3.5, s+4)
section(VERSE, verse)

# 4) REFRAIN 2 = DROP – volle EDM-Wucht, Violine in Oktaven, Supersaw-Pumpen, Läufe
def drop(b, bc, s, v=110):
    vmel(MEL, b, s, v, octave=True)
    band_stabs(bc, s, v-10); band_sub(bc, s, 112, 'roll')
    band_pad(bc, s, 70, VOX, m('G#3'), m('E5'), 3); band_pad(bc, s, 66, PAD, m('C#4'), m('G#5'))
    band_spicc(bc, s, 66); pump(s, WET)
    kick4(s, 127); snare(s+1, 112); snare(s+3, 116)
    for k in range(4): note(s+k+.5, 46, .2, 84, DR, False)
    hats(s, 60, .25)
    if b % 4 == 0:
        note(s, 49, 2, 124, DR, False)
        for q in tones(at(bc, 0), 0, m('C#4'), m('C#5'))[:3]: note(s, q, 1, 112, HIT, hum=False)
    if b % 8 == 3: vrun(s+2.5, 0, m('C#6'), 6, up=False, vel=104)
    if b % 8 == 7:
        vrun(s+2, 0, m('C#5'), 8, up=True, vel=112)
        for i, p in enumerate([48,48,45,45,43,43,41,41]): note(s+2+i*.25, p, .2, 100+i*3, DR, False)
section(CHORUS_LINE*2, drop)

# 5) SOLO (statt Gitarrensolo) – Dubstep-Halbzeit, Wobble-Bass, Violinen-Riffs und Läufe
WOBR = [[2, 1], [1, .5], [2/3, 2/3], [.5, .25]]
def solo(b, bc, s):
    if b == 0: unpump(s, WET)
    for off, d, c in bc:
        p = bass(c, 0, 2); note(s+off, p, d, 112, SUB); note(s+off, p, d, 120, WOB); note(s+off, p+12, d, 96, WOB)
    wobble(s, 4, WOBR[b % 4])
    if b % 2 == 0: vriff_bc(bc, s, 102)
    else:
        vrun(s, 0, m('C#5'), 8, up=True, vel=104); vrun(s+2, 0, m('C#6'), 8, up=False, vel=104)
    if b % 2 == 0:
        for q in tones(at(bc, 0), 0, m('C#4'), m('C#5'))[:3]: note(s, q, 1, 118, HIT, hum=False)
        note(s, 36, 2, 120, BOOM, False)
    kick(s, 127); snare(s+2, 124); hats(s, 70, .5)
    if b % 2: trap_roll(s, 72)
    if b % 4 == 0: note(s, 49, 2, 120, DR, False)
section(CHORUS_LINE, solo)

# 6) BRIDGE – Original-Bridge-Akkorde (H … Cmaj7 … F#), Violine singt, Pad + E-Piano
def bridge(b, bc, s):
    for off, d, n in BRIDGE_V[b]: vnote(s+off, m(n), d*.98, 90+b*3, accent=(off == 0))
    band_pad(bc, s, 58+b*2, PAD, m('F#3'), m('D#5')); band_sub(bc, s, 74)
    band_arp(bc, s, 46+b, EP, m('B3'), m('B4'))
    if b >= 4: kick(s, 80); hats(s, 44, 1, .5)
    if b == 6: riser(s, 8, 10, 127)
    if b >= 6:
        for i in range(16 if b == 6 else 32): note(s+i/(4 if b == 6 else 8), 38, .08, 60+i*2, DR, False)
    if b == 7: mute_gap(s+3.5, s+4)
section(BRIDGE_F, bridge)

# 7) FINALER REFRAIN – wie im Original erst C#m-C#m-C#m-C#m-A-A-H-F#, dann der Refrain mit allem
def final_in(b, bc, s):
    if b == 0: unpump(s, WET); note(s, 49, 3, 124, DR, False); note(s, 36, 3, 124, BOOM, False)
    vmel(MEL, [0, 3, 0, 3, 5, 5, 6, 7][b], s, 104, octave=True)
    band_pad(bc, s, 74, SBR, m('G#3'), m('E5'), 3); band_sub(bc, s, 110)
    band_spicc(bc, s, 70 + b*4)
    kick(s, 124); snare(s+2, 120); hats(s, 64, .5)
    for q in tones(at(bc, 0), 0, m('C#4'), m('C#5'))[:3]: note(s, q, 1, 108, HIT, hum=False)
    if b == 7:
        for i in range(32): note(s+i/8, 38, .08, 80+i, DR, False)
        mute_gap(s+3.5, s+4)
section(FINAL_IN, final_in)
section(CHORUS_LINE*2, lambda b, bc, s: drop(b, bc, s, 116))

# 8) OUTRO – Moll <-> sus4 ausklingen lassen, Ritardando, Schluss auf C#m
outro_start = beat
def outro(b, bc, s):
    if b == 0: unpump(s, WET); note(s, 49, 3, 110, DR, False)
    if b < 3:
        vmel(MEL, [0, 3, 4][b], s, 86-b*8); band_pad(bc, s, 60-b*6, PAD, m('G#3'), m('E5')); band_sub(bc, s, 80-b*10)
    else:
        vnote(s, m('G#5'), 7, 80); vnote(s, m('C#5'), 7, 64, VIO2)
        for n in ['C#3','G#3','E4','G#4','C#5']: note(s, m(n), 8, 56, PAD, hum=False)
        note(s, m('C#2'), 8, 76, SUB, hum=False)
section(bars(two(Cm, Csus), two(Cm, Csus), CsusB, Cm), outro)
tempo = [(0, BPM)] + [(int((outro_start+4+i*1.5)*TPB), x) for i, x in enumerate([120,112,100,88,76,66])]
print('Takte:', int(beat/4), '| Abschnitte: Intro 0, Refrain 8, Strophe 24, Drop 32, Solo 48, Bridge 56, Final 64, Refrain 72, Outro 88')

mid = mido.MidiFile(ticks_per_beat=TPB); trk = mido.MidiTrack(); mid.tracks.append(trk)
allev = [(t, -2, 0, x, 0) for t, x in tempo] + ev
for ch in SETUP: allev.append((0, -1, ch, 0, 0))
allev.sort(key=lambda e: (e[0], -0.5 if e[1] == 0 else e[1]))
now = 0
for t, typ, ch, a, b in allev:
    dt = t-now; now = t
    if typ == -2: trk.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(a), time=dt))
    elif typ == -1:
        bank, prog, vol, pan = SETUP[ch]
        trk.append(mido.Message('control_change', channel=ch, control=0, value=bank, time=dt))
        trk.append(mido.Message('program_change', channel=ch, program=prog, time=0))
        for ctl, val in ((7, vol), (10, pan), (11, 127), (2, 127), (101, 0), (100, 0), (6, 2)):
            trk.append(mido.Message('control_change', channel=ch, control=ctl, value=val, time=0))
    elif typ == 0.6:
        if a == -99999: trk.append(mido.Message('control_change', channel=ch, control=11, value=b, time=dt))
        elif a == -99998: trk.append(mido.Message('control_change', channel=ch, control=2, value=b, time=dt))
        else: trk.append(mido.Message('pitchwheel', channel=ch, pitch=a, time=dt))
    elif typ == 1: trk.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
    elif typ == 0: trk.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
    else: trk.append(mido.Message('control_change', channel=ch, control=a, value=min(127, max(0, b)), time=dt))
mid.save(sys.argv[1]); print('Dauer s:', round(mid.length, 1), 'Noten:', sum(1 for e in ev if e[1] == 1))
