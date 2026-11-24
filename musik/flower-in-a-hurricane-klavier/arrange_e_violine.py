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

beat = 0.0
def section(bars, fn):
    global beat
    for b in range(bars): fn(b, beat); beat += 4

# 1) INTRO – Pad, Pluck-Arpeggio, Solo-Violine mit Echo
def intro(b, s):
    c = CHORUS[b]
    pad(c, s, 0, 52+b*3, PAD, m('G#3'), m('E5'))
    note(s, bass(c, 0, 2), 4, 50+b*3, SUB)
    if b >= 2: arp(c, s, 0, 40+b*3, m('C#5'), m('C#6'), .5, ARP)
    if b >= 2: vhook((b-2) % 8, s, 0, 74+b*3)
    if b == 7: riser(s, 4, 10, 100); kick(s+3, 90)
section(8, intro)

# 2) STROPHE – Beat setzt ein, Violine führt, Sub-Bass, E-Piano-Akkorde
def verse(b, s):
    c = CHORUS[b]
    vhook(b, s, 0, 86+b*2)
    note(s, bass(c, 0, 2), 1.8, 100, SUB); note(s+2.5, bass(c, 0, 2), 1.4, 90, SUB)
    for k in (0, 1.5, 3):
        for q in tones(c, 0, m('G#3'), m('G#4'), 3): note(s+k, q, .5, 56, EP)
    pad(c, s, 0, 50, PAD, m('G#3'), m('E5'), maxn=3)
    kick(s, 110); kick(s+2.5, 96); snare(s+1, 96); snare(s+3, 100); hats(s, 60+b*2)
    if b == 0: note(s, 49, 2, 100, DR, False)
section(8, verse)

# 3) AUFBAU – Violinen-Riff in Spiccato, Streicher, Snare-Wirbel, Rauschen steigt
def build(b, s):
    c = CHORUS[b]
    if b < 4: vhook(b, s, 0, 92+b*2, octave=True)
    else: vriff(c, s, 0, 84+(b-4)*8)
    for i in range(16): note(s+i*.25, tones(c, 0, m('C#4'), m('G#5'))[(i*2+b) % 5], .18, 50+b*6, STRF)
    pad(c, s, 0, 56+b*5, VOX, m('G#3'), m('E5'), maxn=3)
    note(s, bass(c, 0, 2), 4, 90+b*3, SUB)
    div = 1 if b < 2 else 2 if b < 4 else 4 if b < 6 else 8
    for i in range(4*div): note(s+i/div, 38, .1, 50+b*8 + i*(1 if div > 2 else 0), DR, False)
    if b < 6: kick(s, 104); kick(s+2, 100)
    if b == 4: riser(s, 16, 10, 127)
    if b == 7: mute_gap(s+3.5, s+4); note(s+3.5, 49, .5, 0, DR, False)
section(8, build)

# 4) DROP 1 – DUBSTEP (Halbzeit): Wobble-Bass, Violine Hook + Riff, Orchester-Hits, Boom
WOBR = [[2, 1], [1, .5], [2/3, 2/3], [.5, .25]]
def drop1(b, s):
    c = CHORUS[b % 8]
    note(s, bass(c, 0, 2), 4, 112, SUB)
    note(s, bass(c, 0, 2), 4, 120, WOB); note(s, bass(c, 0, 2)+12, 4, 96, WOB)
    wobble(s, 4, WOBR[b % 4])
    if b < 8: vhook(b, s, 0, 108, octave=True)
    else:
        if b % 2 == 0: vriff(c, s, 0, 100)
        else: vhook(b, s, 0, 110, octave=True)
    if b % 2 == 0:
        for q in tones(c, 0, m('C#4'), m('C#5'), 3): note(s, q, 1, 118, HIT, hum=False)
        note(s, 36, 2, 120, BOOM, False)
    kick(s, 127); kick(s+.75, 100) if b % 2 else None; snare(s+2, 124); kick(s+3.25, 104) if b % 4 == 3 else None
    hats(s, 72, .5); trap_roll(s, 70) if b % 2 == 1 else None
    pad(c, s, 0, 64, VOX, m('G#3'), m('E5'), maxn=3)
    if b % 4 == 0: note(s, 49, 2, 124, DR, False)
    if b % 8 == 7:
        vrun(s+2, 0, m('C#5'), 8, up=True, vel=110)
        for i, p in enumerate([48,48,45,45,43,43,41,41]): note(s+2+i*.25, p, .2, 100+i*3, DR, False)
section(16, drop1)

# 5) BREAKDOWN – Bridge: Violine singt allein über Pad und E-Piano
def breakdown(b, s):
    c = BRIDGE[b]
    for off, d, n in BRIDGE_MEL[b]: vnote(s+off, m(n), d*.98, 88+b*3, accent=(off == 0))
    pad(c, s, 0, 56+b*2, PAD, m('F#3'), m('D#5'))
    arp(c, s, 0, 46+b, m('B3'), m('B4'), .5, EP)
    note(s, bass(c, 0, 2), 4, 70, SUB)
    if b >= 4: kick(s, 80); hats(s, 44, 1, .5)
    if b == 6: riser(s, 8, 10, 120)
section(8, breakdown)

# 6) AUFBAU 2 – Violinen-Läufe, Wirbel, Rückung über A#7 nach D#-Moll
def build2(b, s):
    if b < 3: c = CHORUS[b]
    else: c = (10, [10, 2, 5, 8])
    vriff(c, s, 0, 96+b*6) if b < 3 else vrun(s, 0, m('A#4'), 14, up=True, vel=104, step=.25)
    for i in range(16): note(s+i*.25, tones(c, 0, m('C#4'), m('F5'))[i % 4], .18, 64+b*10, STRF)
    note(s, bass(c, 0, 2), 4, 100, SUB); pad(c, s, 0, 70+b*12, SBR, m('A#3'), m('F5'), maxn=3)
    div = 4 if b < 2 else 8
    for i in range(4*div): note(s+i/div, 38, .1, 70+b*12 + i//4, DR, False)
    kick4(s, 96+b*8)
    if b == 0: riser(s, 16, 20, 127)
    if b == 3: mute_gap(s+3.5, s+4)
section(4, build2)

# 7) DROP 2 – EDM, vier Viertel: Supersaw-Pumpen, rollender Bass, Violine in Oktaven, Läufe
WET = [SAW, PAD, VOX, STRF]
def drop2(b, s, tr, v):
    c = CHORUS[b % 8]
    vhook(b, s, tr, v, octave=True)
    for k in range(4):
        for q in tones(c, tr, m('G#3')+tr, m('G#4')+tr, 4): note(s+k+.5, q, .4, v-10, SAW)
        note(s+k+.5, bass(c, tr, 2), .4, 112, SUB); note(s+k+.75, bass(c, tr, 2)+12, .2, 90, SUB)
    pad(c, s, tr, 70, VOX, m('G#3')+tr, m('E5')+tr, maxn=3); pad(c, s, tr, 66, PAD, m('C#4')+tr, m('G#5')+tr)
    for i in range(16): note(s+i*.25, tones(c, tr, m('C#5')+tr, m('C#6')+tr)[[0,1,2,1][i % 4]], .18, 66, STRF)
    pump(s, WET)
    kick4(s, 127); snare(s+1, 112); snare(s+3, 116)
    for k in range(4): note(s+k+.5, 46, .2, 84, DR, False)
    hats(s, 60, .25)
    if b % 4 == 0: note(s, 49, 2, 124, DR, False); [note(s, q, 1, 112, HIT, hum=False) for q in tones(c, tr, m('C#4')+tr, m('C#5')+tr, 3)]
    if b % 8 == 3: vrun(s+2.5, tr, m('C#6'), 6, up=False, vel=104)
    if b % 8 == 7:
        vrun(s+2, tr, m('C#5'), 8, up=True, vel=112)
        for i, p in enumerate([48,48,45,45,43,43,41,41]): note(s+2+i*.25, p, .2, 100+i*3, DR, False)
section(8, lambda b, s: drop2(b, s, 2, 110))

# LIFT – 1 Takt B7: Violinen-Lauf, Snare-Wirbel, Pause -> zweite Rückung nach E-Moll
def lift(b, s):
    unpump(s, WET); c = (11, [11, 3, 6, 9])
    vrun(s, 0, m('B4'), 14, up=True, vel=108)
    for i in range(32): note(s+i/8, 38, .08, 80+i, DR, False)
    note(s, bass(c, 0, 2), 3.5, 110, SUB); pad(c, s, 0, 100, SBR, m('B3'), m('A5'))
    riser(s, 4, 60, 127); mute_gap(s+3.5, s+4)
section(1, lift)
section(8, lambda b, s: drop2(b, s, 3, 116))

# 8) OUTRO – E-Moll, Violine allein mit Pad, Ritardando
outro_start = beat
def outro(b, s):
    tr = 3
    if b == 0: unpump(s, WET); note(s, 49, 3, 110, DR, False); note(s, 36, 3, 120, BOOM, False)
    if b < 3:
        c = CHORUS[b]; vhook(b, s, tr, 84-b*8); pad(c, s, tr, 60-b*6, PAD, m('E3'), m('B4')); note(s, bass(c, tr, 2), 4, 70-b*8, SUB)
    else:
        vnote(s, m('E5'), 7, 80); vnote(s, m('B4'), 7, 64, VIO2)
        for n in ['E3','B3','G4','B4','F#5']: note(s, m(n), 8, 56, PAD, hum=False)
        note(s, m('E2'), 8, 70, SUB, hum=False)
section(4, outro)
tempo = [(0, BPM)] + [(int((outro_start+4+i*1.5)*TPB), x) for i, x in enumerate([120,112,100,88,76,66])]

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
