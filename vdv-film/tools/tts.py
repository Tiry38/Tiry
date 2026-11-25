"""Optionale Sprecherfassung (Google Text-to-Speech, Chirp3-HD), nur Hauptfassung.
python3 tools/tts.py build/ev_main.json build/audio_main.wav build/audio_main_voice.wav build/voice_main.srt"""
import json, sys, base64, subprocess, io, wave, urllib.request, numpy as np
ev = json.load(open(sys.argv[1])); base = sys.argv[2]; out = sys.argv[3]; srt = sys.argv[4]
VOICE = 'de-DE-Chirp3-HD-Charon'; SR = 48000
sc = {s['k']: s for s in ev['scenes']}
heads = {h['ti']: h['t'] for h in ev['heads']}
caps = ev['caps']; notes = ev['notes']
L = []
L.append((sc['intro']['t0'] + 1.2, 'Das AEB PRO. Modelljahr 2027.'))
L.append((sc['model']['t0'] + 0.5, 'Wir starten bei Allround, mit dem AEB PRO. Ein Rahmen, vier Motoren.'))
L.append((sc['motor']['t0'] + 0.6, 'Vier Bosch-Motoren stehen zur Wahl: von der leisen Active Line Plus mit 60 Newtonmetern bis zur Performance Line CX mit 120.'))
L.append((sc['motor']['t0'] + 12.2, 'Wir nehmen die stärkste Stufe. Für Berge und Gepäck.'))
HEAD = ['Basis. Hier entscheidest du, wie weit, wie entspannt und wie wartungsarm du fährst.',
        'Style. Achtzehn Farbtöne, glänzend oder matt.',
        'Ausstattungspakete. Ein Paket tauscht mehrere Teile auf einmal. Wir wählen hier jedes Teil einzeln.',
        'Ergonomie. Die richtige Haltung entlastet Hände, Rücken und Gesäß.',
        'Komfort. Federung und Reifen schlucken Kanten, bevor du sie spürst.',
        'Sicherheit. Mehr Bremskraft, mehr Licht, und ein Rad, das sich wiederfinden lässt.',
        'Zubehör. Mehr Platz vorne, und schneller laden.']
for i, h in enumerate(HEAD): L.append((heads[i] + 0.5, h))
CAP = ['Der größte integrierte Akku: 800 Wattstunden.', 'Kiox 500, mit Farbdisplay und Navigation.', 'Enviolo AUTOMATiQ schaltet automatisch und stufenlos.',
       'Dazu der Gates-Riemen. Ganz ohne Öl.', 'Tiefeinstieg, Größe L. Bequem auf- und absteigen.', 'Melon Yellow. Eine Farbe, die man sieht.',
       'Ein Riser-Lenker für die entspannte Haltung.', 'Und der passende Tourensattel.', 'Eine gefederte Parallelogramm-Stütze.', 'Eine Luftfedergabel mit Lockout.',
       'Reifen, die für E-Bikes gemacht sind.', 'Vier Kolben am Vorderrad.', 'Fernlicht mit 450 Lux.', 'Ein Rahmenschloss.', 'Und GPS-Ortung bei Diebstahl.', 'Ein Ladegerät mit doppeltem Ladestrom.']
for c, s in zip(caps, CAP): L.append((c['t'] + 0.15, s))
NOTE = {'OPTIONAL · RANGE EXTENDER': 'Optional gibt es den Range Extender. Zusammen sind bis zu 1.050 Wattstunden möglich.',
        'OPTIONAL · FRONTZUBEHÖR': 'Für Einkauf und Gepäck gibt es vorne Korb oder Träger.'}
for n in notes: L.append((n['t'] + 0.2, NOTE[n['k']]))
L.append((sc['summary']['t0'] + 0.8, 'Dein AEB 990CX PRO. 120 Newtonmeter, 800 Wattstunden, Automatik mit Riemen. 6.677 Euro laut Konfigurator.'))
L.append((sc['outro']['t0'] + 0.6, 'Konfiguriere deins. Und mach die Probefahrt bei deinem Fachhändler.'))
L.sort()

def synth(text):
    body = json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'de-DE', 'name': VOICE},
                       'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': SR, 'speakingRate': 1.0}}).encode()
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', body, {'Content-Type': 'application/json', 'Authorization': 'Bearer dummy'})
    d = json.load(urllib.request.urlopen(req)); raw = base64.b64decode(d['audioContent'])
    w = wave.open(io.BytesIO(raw)); a = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768; return a

w = wave.open(base); mus = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32).reshape(-1, 2) / 32768; w.close()
N = len(mus); vo = np.zeros(N); subs = []; lastEnd = 0
for t, text in L:
    a = synth(text); t = max(t, lastEnd + 0.25); i = int(t * SR); a = a[: N - i]; vo[i:i + len(a)] += a; d = len(a) / SR
    subs.append((t, t + d, text)); lastEnd = t + d
    print(f'{t:7.2f} {d:5.2f}s {text}')
# Musik unter der Stimme absenken
K = int(.25 * SR); c = np.cumsum(np.concatenate([np.zeros(K), np.abs(vo), np.zeros(K)])); envv = (c[2 * K:] - c[:-2 * K])[:N] / (2 * K); duck = 1 - np.clip(envv * 9, 0, .55)
mix = mus * duck[:, None] * .85 + vo[:, None] * 1.0
mix /= np.abs(mix).max() / .89
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
fmt = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(s * 1000 % 1000):03d}'
open(srt, 'w').write('\n'.join(f'{k + 1}\n{fmt(a)} --> {fmt(b)}\n{x}\n' for k, (a, b, x) in enumerate(subs)))
over = [(a, x) for (a, b, x) in subs if b > ev['T']]; print('Überlauf:', over)
