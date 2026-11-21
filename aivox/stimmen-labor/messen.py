"""Misst Audiodateien: Verständlichkeit (Whisper), Natürlichkeit (DNSMOS), Lebendigkeit (Tonhöhen-Streuung).
Aufruf: python messen.py <ordner> "<soll-text>"  -> Tabelle, sortiert nach Natürlichkeit"""
import sys, glob, re, difflib, json, numpy as np, librosa
from faster_whisper import WhisperModel
from speechmos import dnsmos

FEMALE = {'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina', 'Erinome', 'Gacrux', 'Kore', 'Laomedeia', 'Leda',
          'Pulcherrima', 'Sulafat', 'Vindemiatrix', 'Zephyr'}
wm = WhisperModel('small', device='cpu', compute_type='int8')

def norm(s):
    s = s.lower().replace('ei-wox', 'eiwox').replace('es-em-es', 'sms')
    return re.sub(r'[^a-zäöüß0-9 ]', ' ', s).split()

def live(y):
    f0, _, _ = librosa.pyin(y, fmin=60, fmax=350, sr=16000, frame_length=1024)
    f0 = f0[~np.isnan(f0)]
    return float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) > 10 else 0.0

folder, text = sys.argv[1], sys.argv[2]
rows = []
for f in sorted(glob.glob(folder + '/*.mp3')):
    y, _ = librosa.load(f, sr=16000)
    y = np.clip(y, -0.999, 0.999)
    heard = ''.join(s.text for s in wm.transcribe(y, language='de')[0])
    acc = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
    m = dnsmos.run(y, sr=16000)
    nat = (float(m['ovrl_mos']) + float(m['p808_mos'])) / 2
    name = f.split('/')[-1].replace('.mp3', '').split('-')[-1]
    rows.append({'stimme': name, 'geschlecht': 'w' if name in FEMALE else 'm', 'verst': round(acc, 3), 'natur': round(nat, 2), 'lebendig': round(live(y), 2)})
    print(rows[-1], flush=True)
rows.sort(key=lambda r: (-r['natur']))
json.dump(rows, open(folder + '/messung.json', 'w'), ensure_ascii=False, indent=1)
print('\nRANGLISTE')
for r in rows: print(f"{r['stimme']:<14} {r['geschlecht']}  verst {r['verst']:.2f}  natur {r['natur']:.2f}  lebendig {r['lebendig']:.2f}")
