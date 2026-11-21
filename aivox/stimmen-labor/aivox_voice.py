"""AIVOX Voice Engine – macht synthetische Stimmen menschlicher.

Stufen:
 1. Satzweise erzeugen (Chatterbox Multilingual, mehrere Varianten je Satz)
 2. Beste Variante je Satz: Verständlichkeit (Whisper) + Natürlichkeit (DNSMOS)
 3. Optional Stimmumwandlung (Chatterbox VC) auf echte Referenzstimme
 4. Natürliche Pausen + optionaler echter Atemzug, Sätze zusammensetzen
 5. Studio-Feinschliff (EQ, De-Esser, Kompressor, kleiner Raum) bzw. Telefonklang

Aufruf: python aivox_voice.py <jobs.json> <ausgabeordner> [--vc] [--n 3] [--only id1,id2]
"""
import sys, os, json, re, random, difflib, subprocess
import numpy as np, torch, torchaudio as ta, librosa, soundfile as sf
from faster_whisper import WhisperModel
from speechmos import dnsmos

torch.set_num_threads(4)
args = sys.argv[1:]
JOBS, OUT = args[0], args[1]
USE_VC = '--vc' in args
N = int(args[args.index('--n') + 1]) if '--n' in args else 3
ONLY = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
os.makedirs(OUT, exist_ok=True)
SR = 24000
random.seed(7)

from chatterbox.mtl_tts import ChatterboxMultilingualTTS
tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
vc = None
if USE_VC:
    from chatterbox.vc import ChatterboxVC
    vc = ChatterboxVC.from_pretrained(device='cpu')
wm = WhisperModel('small', device='cpu', compute_type='int8')

NUM = {'sechzehn': '16', 'neunundachtzig': '89', 'achtzehn': '18', 'neun': '9', 'zehn': '10'}
FILL = {'ähm', 'äh', 'ah', 'oh'}

def norm(s):
    s = s.lower()
    for a in ('ei-wox', 'iwox', 'i-wox', 'aivox', 'eiwox'):
        s = s.replace(a, 'eiwox')
    for k, v in NUM.items():
        s = re.sub(r'\b' + k + r'\b', v, s)
    return [w for w in re.sub(r'[^a-zäöüß0-9 ]', ' ', s).split() if w not in FILL]

def score(wav, text):
    y16 = librosa.resample(wav, orig_sr=SR, target_sr=16000)
    heard = ''.join(s.text for s in wm.transcribe(y16, language='de')[0])
    acc = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
    m = dnsmos.run(y16, sr=16000)
    nat = (float(m['ovrl_mos']) + float(m['p808_mos'])) / 2
    return acc, nat, heard

def sentences(text):
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p]

def trim(w):
    yt, _ = librosa.effects.trim(w, top_db=38, frame_length=1024, hop_length=256)
    return yt

# Echte Atemzüge aus den Referenzaufnahmen (Vorlauf vor dem ersten Wort)
def breaths():
    out = []
    for f in sorted(os.listdir('tvref')):
        if not f.endswith('.wav'): continue
        y, _ = librosa.load('tvref/' + f, sr=SR)
        iv = librosa.effects.split(y, top_db=40)
        if len(iv) == 0: continue
        s0 = iv[0][0]
        seg = y[max(0, s0 - int(0.55 * SR)): max(0, s0 - int(0.04 * SR))]
        if len(seg) < int(0.2 * SR): continue
        floor = np.sqrt(np.mean(y[-int(0.15 * SR):] ** 2)) + 1e-6
        if np.sqrt(np.mean(seg ** 2)) > floor * 2.5:
            fade = np.linspace(0, 1, len(seg)) ** 1.5 * np.linspace(1, 0, len(seg)) ** .5
            out.append(seg * fade * 0.7)
    return out
BREATHS = breaths()
print('Atemzüge gefunden:', len(BREATHS), flush=True)

def room(y):
    # kleiner, weicher Raum: abklingendes Rauschen als Impulsantwort, sehr leise beigemischt
    from scipy.signal import fftconvolve, butter, lfilter
    t = np.arange(int(0.28 * SR)) / SR
    rng = np.random.default_rng(3)
    ir = rng.standard_normal(len(t)) * np.exp(-t / 0.055)
    b, a = butter(2, 5000 / (SR / 2)); ir = lfilter(b, a, ir); ir[:int(0.004 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(y, ir)[:len(y)]
    return (y + wet * 0.09).astype(np.float32)

def gen_sentence(sent, ref, ex):
    w = tts.generate(sent, language_id='de', audio_prompt_path=ref, exaggeration=ex, cfg_weight=0.35 if ex < 0.55 else 0.45)
    w = w.squeeze(0).numpy()
    if vc is not None:
        tmp = '/tmp/_vc_in.wav'; sf.write(tmp, w, SR)
        w = vc.generate(tmp, target_voice_path=ref).squeeze(0).numpy()
    return trim(w)

report = {}
for job in json.load(open(JOBS)):
    jid, ref, text = job['id'], job['ref'], job['text']
    if ONLY and jid not in ONLY: continue
    caller = ref.endswith('an-real.wav')
    pieces = []
    for si, sent in enumerate(sentences(text)):
        best = None
        for v in range(N):
            ex = [0.45, 0.6, 0.52, 0.7][v % 4]
            w = gen_sentence(sent, ref, ex)
            acc, nat, heard = score(w, sent)
            val = nat if acc >= 0.85 else nat - 5 + acc
            print(f'{jid} s{si} v{v} acc={acc:.2f} nat={nat:.2f} | {heard}', flush=True)
            if best is None or val > best[0]: best = (val, w, acc, nat)
        pieces.append(best)
    # Zusammensetzen mit menschlichen Pausen und Atem
    out = [np.zeros(int(0.12 * SR))]
    for i, (_, w, _, _) in enumerate(pieces):
        long_next = len(w) > 2.2 * SR
        if (i > 0 or long_next) and BREATHS and not caller and random.random() < (0.55 if long_next else 0.25):
            out.append(random.choice(BREATHS)); out.append(np.zeros(int(0.06 * SR)))
        out.append(w)
        if i < len(pieces) - 1:
            out.append(np.zeros(int(random.uniform(0.32, 0.52) * SR)))
    out.append(np.zeros(int(0.15 * SR)))
    y = np.concatenate(out).astype(np.float32)
    if not caller: y = room(y)
    raw = f'{OUT}/{jid}_raw.wav'; sf.write(raw, y, SR)
    acc, nat, heard = score(y, text)
    report[jid] = {'acc': round(acc, 3), 'nat': round(nat, 2), 'heard': heard}
    print('FERTIG', jid, report[jid], flush=True)
json.dump(report, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=1)
