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


# ======================= POWER-FASSUNG =======================
TPT, TBN, GLK, TREM, VLN = 8, 10, 11, 12, 13
SETUP.update({TPT:(56,92,90), TBN:(57,98,52), GLK:(9,70,96), TREM:(44,72,30), VLN:(48,90,98)})
SETUP[STR] = (48, 94, 40); SETUP[PNO] = (0, 127, 64); SETUP[SPC] = (48, 68, 84); SETUP[CHOIR] = (52, 92, 70); SETUP[BRASS] = (61, 110, 72); SETUP[HORN] = (60, 96, 36)

# Trompeten-Diskant (eigene Linie) fürs Finale
DESCANT = [
 [(0,1,'G#5'),(1,.5,'A5'),(1.5,.5,'G#5'),(2,2,'E5')], [(0,1,'F#5'),(1,1,'G#5'),(2,2,'D#5')],
 [(0,1,'E5'),(1,.5,'F#5'),(1.5,.5,'E5'),(2,2,'C#5')], [(0,2,'E5'),(2,1,'F#5'),(3,1,'G#5')],
 [(0,1,'B5'),(1,.5,'A5'),(1.5,.5,'G#5'),(2,2,'F#5')], [(0,1,'E5'),(1,1,'F#5'),(2,2,'G#5')],
 [(0,1,'F#5'),(1,1,'B5'),(2,2,'A#5')], [(0,2,'C#6'),(2,2,'A#5')],
]

def pump(s, chs, depth=45):  # Sidechain-Pumpen wie im Dance-Hit
    for k in range(4):
        for ch in chs:
            cc(s+k, ch, 11, depth); cc(s+k+.12, ch, 11, depth+35); cc(s+k+.3, ch, 11, 118); cc(s+k+.5, ch, 11, 127)
def unpump(s, chs):
    for ch in chs: cc(s, ch, 11, 127)
def spicc16(c, s, tr, vel, ch=SPC, low=None, high=None):
    t = tones(c, tr, low or m('C#4')+tr, high or m('C#5')+tr)
    pat = [0, 2, 1, 2, 0, 2, 1, 3]
    for i in range(16): note(s+i*.25, t[pat[i % 8] % len(t)], .18, vel + (10 if i % 4 == 0 else 0), ch)
def epic_toms(s, v):
    for off, p in [(0,41),(.75,41),(1.5,43),(2,41),(2.75,41),(3.25,45),(3.5,43)]: note(s+off, p, .2, v, DR, False)
def tbn_stabs(c, s, tr, v):
    vs = tones(c, tr, m('F2')+tr, m('D3')+tr, 3)
    note(s, bass(c, tr, 2), .9, v, TBN)
    for off in (1.5, 3.5):
        for q in vs: note(s+off, q, .4, v-4, TBN)

beat = 0.0
def section(bars, fn):
    global beat
    for b in range(bars): fn(b, beat); beat += 4

# 1) INTRO – Klavier & Streicher, ab Takt 5 stellen die Hörner die Hook vor (zum Wiedererkennen)
def intro(b, s):
    c = CHORUS[b]; pedal_bar(s, False)
    br = bass(c, 0, 2); note(s, br, 4, 46); note(s, br+12, 4, 38)
    for i, p in enumerate(tones(c, 0, m('G#3'), m('G#4'), 4)): note(s+.5+i*.12, p, 3.5, 34)
    if b >= 2: arp(c, s, 0, 28+b*2, m('C#5'), m('C#6'))
    pad(c, s, 0, 42+b*3, STR, m('C#3'), m('G#4')); note(s, br, 4, 52, CB)
    if b >= 4:
        hook(b-4, s, 0, 58+b*3, HORN, up=0)
        pad(c, s, 0, 40+b*3, CHOIR, m('G#3'), m('E5'), maxn=3)
        if b % 2 == 0: note(s, m('G#6'), 2, 40, GLK)
    if b == 7: timp(s, m('C#2'), (30, 96), roll=True); swell(s, TREM, 20, 120); pad(c, s, 0, 70, TREM, m('C#4'), m('C#5'))
section(8, intro)

# 2) STROPHE – Klavier-Hook + Violinen-Echo, Hörner-Gegenmelodie, Spiccato-Puls, leichter Beat
def verse(b, s):
    c = CHORUS[b]; pedal_bar(s); br = bass(c, 0, 3)
    for i, p in enumerate([br-12, br-5, br, br-5]*2): note(s+i*.5, p, .5, 54+b*2)
    hook(b, s, 0, 70+b*2, up=12)
    if b >= 4: hook(b, s, 0, 44+b*3, VLN, up=24, legato=.95)
    line(COUNTER, b, s, 0, 56+b*3, HORN, up=-12)
    note(s, bass(c, 0, 2), 4, 68, CB)
    for k in range(4):
        for q in tones(c, 0, m('E4'), m('C#5'), 3): note(s+k+.5, q, .2, 50+b*2, SPC)
    pad(c, s, 0, 42+b*2, STR, m('C#4'), m('G#4'), maxn=3)
    note(s, 36, .25, 70, DR, False); note(s+2.5, 36, .25, 60, DR, False)
    for k in range(4): note(s+k+.5, 42, .1, 50+b*3, DR, False)
    if b == 0: crash(s, 84)
section(8, verse)

# 3) AUFBAU – Tremolo-Streicher, Spiccato-Sechzehntel, Snare/Pauke, Blech + Trompeten steigen
def build(b, s):
    c = CHORUS[b]; br = bass(c, 0, 3)
    step = 1 if b < 2 else .5 if b < 5 else .25; vel = 62 + b*6
    k = 0
    while k < 4: note(s+k, br-12, step, vel); note(s+k, br, step, vel-4); k += step
    if b < 6:
        hook(b, s, 0, vel+4, up=12, octaves=True)
        hook(b, s, 0, 54+b*6, BRASS)
        if b >= 3: hook(b, s, 0, 50+b*6, TPT, up=12)
    else:
        vs = tones(c, 0, m('C#4'), m('C#6'))
        for i in range(16):
            top = vs[min(len(vs)-1, 2+i//2)]
            for q in [x for x in vs if top-8 <= x <= top]: note(s+i*.25, q, .22, 72+i*3)
            note(s+i*.25, top+12, .22, 60+i*3, TPT)
    spicc16(c, s, 0, 56+b*6, low=m('C#4'), high=m('G#5'))
    pad(c, s, 0, 54+b*6, TREM, m('G#3'), m('E5')); swell(s, TREM, 60+b*6, 80+b*6)
    pad(c, s, 0, 46+b*6, CHOIR, m('G#3'), m('E5'), maxn=3)
    note(s, bass(c, 0, 2), 4, 74+b*4, CB); tbn_stabs(c, s, 0, 56+b*6) if b >= 2 else None
    if b >= 4: snare_roll(s, 34+(b-4)*20, 54+(b-4)*20, 4, 4 if b < 6 else 8)
    if b >= 2: kick4(s, 64+b*5)
    if b == 7: timp(s, m('C#2'), (60, 124), roll=True); mute_gap(s+3.5, s+4)
section(8, build)

# 4) DROP – Tutti mit Pumpen: Klavier+Blech+Trompeten Hook, Streicher/Hörner Gegenmelodie,
#    Posaunen-Stabs, Spiccato-16tel, Chor, Pauken, Epic-Toms, House-Beat
WET = [STR, CHOIR, HORN, TREM]
def drop_bar(b, s, tr, v, big=False, top=False):
    c = CHORUS[b % 8]; pedal_bar(s); br = bass(c, tr, 3)
    if big:
        for k in range(8):
            note(s+k*.5, br-12, .45, 104 if k % 2 == 0 else 88); note(s+k*.5, br, .45, 96 if k % 2 == 0 else 82)
            note(s+k*.5, bass(c, tr, 2), .45, 96 if k % 2 == 0 else 84, CB)
    else:
        for k in range(4): note(s+k, br-12, .45, v); note(s+k, br, .45, v-6)
        note(s, bass(c, tr, 2), 4, v-6, CB)
    for k in range(4):
        for q in tones(c, tr, m('A3')+tr, m('A4')+tr, 3): note(s+k+.5, q, .4, v-16)
    hook(b, s, tr, v+6, up=12, octaves=True, block=c)              # Klavier
    hook(b, s, tr, v, BRASS, up=0, octaves=True, legato=.9)        # Blechsatz
    if b % 8 >= 4 or big: hook(b, s, tr, v-2, TPT, up=12, legato=.9)   # Trompeten
    if big or b >= 8: hook(b, s, tr, v-10, VLN, up=24, legato=.95)    # hohe Violinen
    line(COUNTER, b, s, tr, v-6, STR, up=12, octaves=True)
    line(COUNTER, b, s, tr, v-14, HORN)
    if big:
        hook(b, s, tr, v-8, CHOIR, up=12)                            # Chor singt die Hook
        line(DESCANT, b, s, tr, v-4, TPT, up=0)
        hook(b, s, tr, v-30, GLK, up=24)
    else:
        pad(c, s, tr, v-24, CHOIR, m('G#3')+tr, m('E5')+tr, maxn=4)
    pad(c, s, tr, v-30, TREM, m('C#4')+tr, m('G#4')+tr, maxn=3)
    pump(s, WET)
    spicc16(c, s, tr, v-30, low=m('C#5')+tr, high=m('C#6')+tr)
    tbn_stabs(c, s, tr, v-6)
    kick4(s, 118); note(s+1, 39, .2, 96, DR, False); note(s+3, 39, .2, 100, DR, False)
    note(s+1, 38, .2, 92, DR, False); note(s+3, 38, .2, 96, DR, False)
    for k in range(4): note(s+k+.5, 46, .2, 72, DR, False)
    epic_toms(s, 84 if big else 70)
    tp = bass(c, tr, 1); tp = tp + 12 if tp < m('F2') else tp
    if big:
        for k in range(8): note(s+k*.5, tp, .4, 104 if k % 2 == 0 else 80, TIMP)
    else:
        timp(s, tp, 104); timp(s+2, tp, 92)
    if b % 4 == 0: crash(s, 124)
    if b % 8 == 7:
        tom_fill(s)
        run = tones(c, tr, m('E5')+tr, m('G#6')+tr)[::-1][:8]
        for i, p in enumerate(run):
            note(s+2+i*.25, p, .24, v); note(s+2+i*.25, p-12, .24, v-14, SPC); note(s+2+i*.25, p, .24, v-12, VLN)
    if big and b >= 4: arp(c, s, tr, 56, m('C#6')+tr, m('C#7')+tr, .25)
section(16, lambda b, s: drop_bar(b, s, 0, 96))

# 5) BREAKDOWN – Bridge: Violinen-Melodie, Chor, Klavier, Glockenspiel; Pumpen aus
def breakdown(b, s):
    if b == 0: unpump(s, WET)
    c = BRIDGE[b]; pedal_bar(s, False)
    note(s, bass(c, 0, 2), 4, 40); note(s, bass(c, 0, 2), 4, 56, CB)
    arp(c, s, 0, 36+b, m('B3'), m('B4'))
    line(BRIDGE_MEL, b, s, 0, 62+b*3, STR, octaves=True)
    line(BRIDGE_MEL, b, s, 0, 40+b*3, VLN, up=12)
    for off, d, n in BRIDGE_MEL[b]: note(s+off, m(n)+12, d, 42+b*2)
    pad(c, s, 0, 40+b*3, CHOIR, m('F#3'), m('D#4'), maxn=3)
    if b % 2 == 1: note(s, m(BRIDGE_MEL[b][0][2])+12, 2, 50, GLK)
    if b >= 4: line(COUNTER, b, s, 0, 40+b*3, HORN, up=-12)
    if b >= 6: timp(s, m('B1'), (25, 80), roll=True); pad(c, s, 0, 50+b*6, TREM, m('F#3'), m('D#5')); swell(s, TREM, 40, 127)
section(8, breakdown)

# 6) AUFBAU 2 – alles wirbelt, Rückung über A#7 nach D#-Moll
def build2(b, s):
    vel = 70 + b*12
    if b < 3: c = CHORUS[b]; br = bass(c, 0, 3); vs = tones(c, 0, m('C#4'), m('C#5'))
    else: c = (10, [10, 2, 5, 8]); br = m('A#2'); vs = tones(c, 0, m('C#4'), m('F5'))
    step = .5 if b < 2 else .25; k = 0
    while k < 4:
        note(s+k, br-12, step, vel); note(s+k, br, step, vel)
        for q in vs[-3:]: note(s+k, q, step*.9, vel-10+int(k*4))
        k += step
    pad(c, s, 0, 64+b*14, TREM, m('A#3'), m('F5')); pad(c, s, 0, 60+b*14, BRASS, m('F3'), m('D5'), maxn=3)
    pad(c, s, 0, 56+b*14, CHOIR, m('A#3'), m('F5'), maxn=3); pad(c, s, 0, 56+b*14, TBN, m('F2'), m('D3'), maxn=3)
    spicc16(c, s, 0, 60+b*12, low=m('C#4'), high=m('F5'))
    for i in range(8): note(s+i*.5, vs[-1]+12 + (i % 2)*0, .45, 56+b*12+i*2, TPT)
    snare_roll(s, 54+b*15, 70+b*15, 4, 4 if b < 2 else 8); kick4(s, 84+b*8)
    timp(s, m('A#1'), (64+b*10, 84+b*12), roll=True)
    if b == 3: mute_gap(s+3.5, s+4)
section(4, build2)

# 7) FINALE A – D#-Moll, volles Orchester, Chor singt die Hook, Trompeten-Diskant
section(8, lambda b, s: drop_bar(b, s, 2, 102, big=True))

# 7b) LIFT – 1 Takt B7 (Dominante von E-Moll): Tom-Wirbel, Blech-Fanfare, Pause -> zweite Rückung
def lift(b, s):
    unpump(s, WET)
    c = (11, [11, 3, 6, 9])
    for k in range(8):
        for q in tones(c, 0, m('B3'), m('B4'), 4): note(s+k*.5, q, .4, 84+k*4)
        note(s+k*.5, m('B1'), .4, 96, CB); note(s+k*.5, m('B2'), .4, 100)
    for i, p in enumerate([41,41,43,43,45,45,48,48,41,43,45,48,48,48,48,48]): note(s+i*.25, p, .2, 90+i*2, DR, False)
    for i, n in enumerate(['B4','D#5','F#5','A5','B5','D#6']): note(s+i*.5, m(n), .45, 96+i*3, TPT); note(s+i*.5, m(n)-12, .45, 92, BRASS)
    pad(c, s, 0, 110, TBN, m('F#2'), m('D#3'), maxn=3); pad(c, s, 0, 100, TREM, m('B3'), m('A5'))
    timp(s, m('B1'), (80, 127), roll=True); crash(s, 120)
    mute_gap(s+3.5, s+4)
section(1, lift)

# 7c) FINALE B – E-Moll (+3), maximal: alles nochmal einen Halbton höher
section(8, lambda b, s: drop_bar(b, s, 3, 106, big=True))

# 8) OUTRO – E-Moll, Ritardando, großer Schlussakkord
outro_start = beat
def outro(b, s):
    tr = 3; pedal_bar(s, False)
    if b == 0: unpump(s, WET)
    if b < 3:
        c = CHORUS[b]; br = bass(c, tr, 2)
        note(s, br, 4, 56-b*5); note(s, br+12, 4, 48-b*5)
        hook(b, s, tr, 60-b*6, up=12); hook(b, s, tr, 50-b*6, HORN)
        pad(c, s, tr, 52-b*5, STR, m('E3'), m('B4')); note(s, br, 4, 56-b*5, CB)
        if b == 0: crash(s, 110); timp(s, m('E2'), 110)
    else:
        for i, n in enumerate(['E2','B2','E3','F#3','G3','B3','E4','F#4','B4','E5']):
            note(s+i*.22, m(n), 8, 46-i, hum=False)
        for n in ['E3','B3','G4','B4','F#5']: note(s, m(n), 8, 52, STR, hum=False); note(s, m(n), 8, 40, CHOIR, hum=False)
        for n in ['E2','B2','G3']: note(s, m(n), 6, 60, TBN, hum=False)
        note(s, m('E2'), 8, 60, CB, hum=False); timp(s, m('E2'), (40, 90), roll=True, beats=3); crash(s+3, 90)
section(4, outro)
pedal(beat+4, False)
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
        prog, vol, pan = SETUP[ch]
        if ch != DR: trk.append(mido.Message('program_change', channel=ch, program=prog, time=dt)); dt = 0
        trk.append(mido.Message('control_change', channel=ch, control=7, value=vol, time=dt))
        trk.append(mido.Message('control_change', channel=ch, control=10, value=pan, time=0))
        trk.append(mido.Message('control_change', channel=ch, control=11, value=127, time=0))
    elif typ == 1: trk.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
    elif typ == 0: trk.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
    else: trk.append(mido.Message('control_change', channel=ch, control=a, value=b, time=dt))
mid.save(sys.argv[1]); print('Dauer s:', round(mid.length, 1), 'Noten:', sum(1 for e in ev if e[1] == 1))
