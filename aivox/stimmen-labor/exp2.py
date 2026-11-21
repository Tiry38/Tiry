"""Versuch 2: Welche Referenz macht die Stimme lebendiger? Misst Verständlichkeit, Natürlichkeit (DNSMOS), Lebendigkeit (Tonhöhen-Schwankung)."""
import json, re, difflib, numpy as np, torch, librosa, soundfile as sf
from faster_whisper import WhisperModel
from speechmos import dnsmos
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
torch.set_num_threads(4)
tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu'); wm = WhisperModel('small', device='cpu', compute_type='int8')
NUM = {'sechzehn': '16', 'neunundachtzig': '89', 'achtzehn': '18', 'neun': '9'}
def norm(s):
    s = s.lower().replace('ei-wox', 'eiwox').replace('iwox', 'eiwox').replace('es-em-es', 'sms')
    for k, v in NUM.items(): s = re.sub(r'\b' + k + r'\b', v, s)
    return re.sub(r'[^a-zäöüß0-9 ]', ' ', s).split()
def live(y16):
    f0, vflag, _ = librosa.pyin(y16, fmin=60, fmax=300, sr=16000, frame_length=1024)
    f0 = f0[~np.isnan(f0)]
    if len(f0) < 10: return 0.0
    st = 12 * np.log2(f0 / np.median(f0))
    return float(np.std(st))
def measure(y, sr, text):
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    heard = ''.join(s.text for s in wm.transcribe(y16, language='de')[0])
    acc = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
    m = dnsmos.run(y16, sr=16000); nat = (float(m['ovrl_mos']) + float(m['p808_mos'])) / 2
    return round(acc, 3), round(nat, 2), round(live(y16), 2), heard
LINES = {'g-tag': 'Guten Tag – und willkommen bei Ei-Wox. Ich bin die künstliche Intelligenz, die für deine Werkstatt ans Telefon geht. Tag und Nacht.',
         's1-3': 'Klar, einen Moment, ich schau kurz in den Kalender. Am Donnerstag um halb elf wäre noch was frei. Passt Ihnen das?',
         's1-7': 'Danke, Frau Becker. Ich schicke Ihnen die Bestätigung per Es-Em-Es an die Nummer, mit der Sie gerade anrufen. Ist das in Ordnung?'}
for lid, text in LINES.items():
    y, sr = librosa.load(f'a3/{lid}.mp3', sr=24000)
    print('ALT', lid, measure(y, sr, text)[:3], flush=True)
    for ref in ['ki-real20', 'ki-amused', 'ki-mix']:
        for ex in [0.5, 0.7]:
            w = tts.generate(text, language_id='de', audio_prompt_path=f'ref/{ref}.wav', exaggeration=ex, cfg_weight=0.4).squeeze(0).numpy()
            sf.write(f'exp2_{lid}_{ref}_{ex}.wav', w, tts.sr)
            print('NEU', lid, ref, ex, measure(w, tts.sr, text), flush=True)
