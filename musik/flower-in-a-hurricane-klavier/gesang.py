"""Synth-Sängerin für 'Flower In A Hurricane' (E-Violinen-Fassung).
Google-TTS-Frauenstimme -> stabile Vokal-Stellen -> granular auf Melodie gestimmt (Auto-Tune-Prinzip).
Wortloser Gesang (ooh/aah) + Vocal-Chops (hey/ah). Ausgabe: vocals.wav, synchron zu e-violine-edm.mid."""
import os, sys, json, base64, subprocess, math, random
import numpy as np, librosa, soundfile as sf

random.seed(5); np.random.seed(5)
SR = 44100
D = os.path.dirname(os.path.abspath(__file__)) + '/vox'
os.makedirs(D, exist_ok=True)

def tts(text, pitch, name, rate='x-slow'):
    path = f'{D}/{name}.wav'
    if os.path.exists(path): return path
    body = {"input": {"ssml": f'<speak><prosody rate="{rate}" pitch="{pitch:+d}st">{text}</prosody></speak>'},
            "voice": {"languageCode": "en-US", "name": "en-US-Neural2-F"},
            "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SR}}
    r = subprocess.run(['curl', '-s', '-X', 'POST', 'https://texttospeech.googleapis.com/v1/text:synthesize',
                        '-H', 'Content-Type: application/json', '-d', json.dumps(body)], capture_output=True, text=True)
    open(path, 'wb').write(base64.b64decode(json.loads(r.stdout)['audioContent']))
    return path

def stable_region(y, min_len=0.12):
    f0, vf, _ = librosa.pyin(y, fmin=120, fmax=900, sr=SR, frame_length=2048, hop_length=256)
    best = (0, 0, 0)
    i = 0
    while i < len(f0):
        if not vf[i]: i += 1; continue
        j = i; ref = f0[i]
        while j < len(f0) and vf[j] and abs(1200*np.log2(f0[j]/ref)) < 45: j += 1
        if j - i > best[1] - best[0]: best = (i, j, float(np.median(f0[i:j])))
        i = max(j, i+1)
    a, b, hz = best
    seg = y[a*256:b*256]
    if len(seg) < min_len*SR: return None
    return seg, hz

# --- Material holen: Vokale in drei Lagen, Chops in zwei Lagen
BANK = {'ooh': [], 'aah': []}
for vow, txt in (('ooh', 'Ooooooooh'), ('aah', 'Aaaaaaaah')):
    for p in (-4, 2, 8):
        y, _ = librosa.load(tts(txt, p, f'{vow}{p}'), sr=SR)
        r = stable_region(y)
        if r: BANK[vow].append(r)
CHOPS = {}
for name, txt in (('hey', 'Hey!'), ('ah', 'Ah!')):
    CHOPS[name] = []
    for p in (2, 8):
        y, _ = librosa.load(tts(txt, p, f'{name}{p}', rate='medium'), sr=SR)
        y, _ = librosa.effects.trim(y, top_db=30)
        f0, vf, _ = librosa.pyin(y, fmin=120, fmax=900, sr=SR)
        hz = float(np.nanmedian(f0[vf])) if vf.any() else 300.0
        CHOPS[name].append((y, hz))
print('Material:', {k: [round(h) for _, h in v] for k, v in BANK.items()}, {k: [round(h) for _, h in v] for k, v in CHOPS.items()})

def midi_hz(n): return 440.0 * 2**((n-69)/12)

def sing(out, t0, dur, midi, vowel='ooh', vel=100, vib=True):
    """Gehaltener, gestimmter Vokal per Granularsynthese."""
    target = midi_hz(midi)
    seg, hz = min(BANK[vowel], key=lambda r: abs(math.log(target/r[1])))
    n_out = int(dur*SR); gl = int(0.08*SR); hop = gl//2
    buf = np.zeros(n_out + gl)
    win = np.hanning(gl)
    k = 0
    while k < n_out:
        t = k/SR
        cents = 0.0
        if vib and t > 0.28: cents = min(35, 60*(t-0.28)) * math.sin(2*math.pi*5.4*t)
        ratio = target * 2**(cents/1200) / hz
        need = int(gl*ratio) + 2
        if need >= len(seg): need = len(seg)-1
        st = random.randint(0, max(0, len(seg)-need-1))
        g = seg[st:st+need]
        g = np.interp(np.linspace(0, len(g)-1, gl), np.arange(len(g)), g) * win
        buf[k:k+gl] += g
        k += hop
    buf = buf[:n_out]
    env = np.ones(n_out); a = min(int(0.05*SR), n_out//3); r = min(int(0.09*SR), n_out//3)
    env[:a] = np.linspace(0, 1, a); env[-r:] = np.linspace(1, 0, r)
    buf *= env * (vel/127) * 0.5
    i0 = int(t0*SR)
    if i0 + n_out > len(out): out.resize(i0 + n_out + SR, refcheck=False)
    out[i0:i0+n_out] += buf

def chop(out, t0, dur, midi, name='hey', vel=100):
    target = midi_hz(midi)
    y, hz = min(CHOPS[name], key=lambda r: abs(math.log(target/r[1])))
    ratio = target/hz
    y2 = np.interp(np.arange(0, len(y)-1, ratio), np.arange(len(y)), y)
    n = min(len(y2), int(dur*SR)); y2 = y2[:n].copy()
    f = min(int(0.02*SR), n//2); y2[-f:] *= np.linspace(1, 0, f)
    i0 = int(t0*SR); out[i0:i0+n] += y2 * (vel/127) * 0.55

# --- Song-Daten wie in arrange_e_violine.py
NOTE = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def m(n): return 12*(int(n[-1])+1) + NOTE[n[:-1]]
CHORUS = [(1,[1,4,8]), (1,[1,6,8,11,3]), (1,[9,1,4,8]), (1,[1,4,8]), (1,[1,6,8,11,3]), (9,[9,1,4]), (11,[11,3,6]), (6,[6,10,1])]
BRIDGE = [(11,[11,3,6]), (11,[11,1,6,9]), (9,[9,1,4,11]), (2,[2,6,9,11]), (7,[7,11,2,9]), (0,[0,4,7,10,2]), (11,[11,4,6,9,1]), (11,[11,4,6,9,1])]
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
BRIDGE_MEL = [
 [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D#5')], [(0,2.5,'C#5'),(2.5,.5,'F#5'),(3,1,'A5')],
 [(0,2.5,'B5'),(2.5,.5,'A5'),(3,1,'E5')],   [(0,2.5,'F#5'),(2.5,.5,'E5'),(3,1,'D5')],
 [(0,2.5,'B4'),(2.5,.5,'A4'),(3,1,'D5')],   [(0,2.5,'E5'),(2.5,.5,'D5'),(3,1,'A#4')],
 [(0,4,'C#5')], [(0,2,'E5'),(2,2,'F#5')],
]
COUNTER = [[(0,3,'C#5'),(3,1,'D#5')], [(0,2,'E5'),(2,2,'D#5')], [(0,3,'C#5'),(3,1,'B4')], [(0,4,'C#5')],
           [(0,3,'D#5'),(3,1,'E5')], [(0,2,'F#5'),(2,2,'E5')], [(0,2,'D#5'),(2,2,'F#5')], [(0,4,'F#5')]]
def tones(c, tr, lo, hi): return [p for p in range(lo, hi+1) if p % 12 in [(x+tr) % 12 for x in c[1]]]

# Zeitachse inkl. Ritardando im Outro (wie im MIDI)
OUTRO = 69*4
TEMPI = [(0, 126)] + [(OUTRO+4+i*1.5, b) for i, b in enumerate([120,112,100,88,76,66])]
def sec(beat):
    t = 0.0; prev_b, bpm = 0.0, 126
    for b, x in TEMPI[1:]:
        if beat <= b: break
        t += (b-prev_b)*60/bpm; prev_b, bpm = b, x
    return t + (beat-prev_b)*60/bpm
def S(bar, off=0.0): return sec(bar*4 + off)

out = np.zeros(int(170*SR))
def hook_line(bar, b, tr, vel, vowel='ooh', up=0):
    for off, d, n in HOOK[b % 8]:
        sing(out, S(bar, off), sec(bar*4+off+d*.95)-S(bar, off), m(n)+tr+up, vowel, vel)

# Intro Takt 5-8: gehaltene Ooh-Töne
for b in range(4, 8):
    p = tones(CHORUS[b], 0, m('G#3'), m('E4'))[-1]; sing(out, S(b), 4*60/126, p, 'ooh', 30+b*4)
# Strophe Takt 5-8: singt die Hook mit (Unisono unter der Violine)
for b in range(4, 8): hook_line(8+b, b, 0, 82+b*2)
# Aufbau: lange Aah-Bögen, dann Chops in Achteln steigend
for b in range(0, 4):
    for off, d, n in COUNTER[b]: sing(out, S(16+b, off), d*60/126*.97, m(n)-12, 'aah', 84+b*4)
for b in range(4, 8):
    ts = tones(CHORUS[b], 0, m('C#4'), m('C#5'))
    for i in range(8): chop(out, S(16+b, i*.5), .22, ts[(i+b) % len(ts)], 'ah', 70+(b-4)*12)
# Drop 1 (Dubstep): Vocal-Chops
PAT_FULL = [(0,'hey'),(.75,'ah'),(1.5,'ah'),(2.5,'hey'),(3,'ah'),(3.5,'ah')]
PAT_SPARSE = [(2.5,'hey'),(3.5,'ah')]
for b in range(16):
    c = CHORUS[b % 8]; ts = tones(c, 0, m('C#4'), m('C#5'))
    riff_bar = b >= 8 and b % 2 == 0
    for i, (off, nm) in enumerate(PAT_FULL if riff_bar else PAT_SPARSE):
        chop(out, S(24+b, off), .3, ts[(i*2) % len(ts)] + (12 if nm == 'hey' and riff_bar else 0), nm, 108)
# Breakdown: Die Sängerin singt die Bridge-Melodie (Highlight)
for b in range(8):
    for off, d, n in BRIDGE_MEL[b]: sing(out, S(40+b, off), d*60/126*.97, m(n)-12, 'aah', 108+b*2)
# Aufbau 2: steigende Aah-Töne
for b, n in enumerate(['C#4', 'E4', 'G#4', 'A#4']): sing(out, S(48+b), 4*60/126*.97, m(n), 'aah', 96+b*8)
# Drop 2 (D#m) + Finale (Em): singt die Hook, Chops auf "4 und"
for start, tr in ((52, 2), (61, 3)):
    for b in range(8):
        hook_line(start+b, b, tr, 112)
        ts = tones(CHORUS[b], tr, m('C#5')+tr, m('C#6')+tr)
        chop(out, S(start+b, 3.75), .2, ts[0], 'hey', 96)
# Lift: langer Aah-Schrei auf B
sing(out, S(60), 3.4*60/126, m('B4'), 'aah', 120)
# Outro (E-Moll): leise Hook, Schlusston
for b in range(3): hook_line(69+b, b, 3, 84-b*10)
sing(out, S(72), sec(72*4+7)-S(72), m('E4'), 'ooh', 80)

out = out[:int(sec(73*4+4)*SR)]
peak = np.max(np.abs(out)); out = out/peak*0.89
sf.write(sys.argv[1] if len(sys.argv) > 1 else 'vocals.wav', out.astype(np.float32), SR)
print('vocals ok, Länge', round(len(out)/SR, 1), 's')
