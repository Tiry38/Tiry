"""AIVOX mit Google Chirp 3 HD (gleiches Modell wie Luna).

Der API-Schlüssel wird NICHT im Code gespeichert: Die Cloud-Umgebung setzt den Header
x-goog-api-key automatisch für texttospeech.googleapis.com (Network secret).

  python chirp_gen.py voices                 -> deutsche Chirp-3-HD-Stimmen auflisten
  python chirp_gen.py probe <out>            -> Probesatz mit allen Stimmen erzeugen
  python chirp_gen.py lines <jobs.json> <voice> <out>  -> alle AIVOX-Zeilen erzeugen
"""
import base64, json, os, sys, urllib.request

API = 'https://texttospeech.googleapis.com/v1'

def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'}, method='POST' if body else 'GET')
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def voices():
    v = call('/voices?languageCode=de-DE')['voices']
    return sorted(x['name'] for x in v if 'Chirp3-HD' in x['name'])

def synth(text, voice, out, rate=1.0):
    body = {'input': {'markup': text}, 'voice': {'languageCode': 'de-DE', 'name': voice},
            'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': rate, 'sampleRateHertz': 24000}}
    try:
        res = call('/text:synthesize', body)
    except urllib.error.HTTPError as e:
        if e.code != 400: raise
        body['input'] = {'text': text}
        res = call('/text:synthesize', body)
    open(out, 'wb').write(base64.b64decode(res['audioContent']))

PROBE = ('Fahrrad-Werkstatt am Markt, guten Tag! Sie sprechen mit der digitalen Assistenz – ich bin eine künstliche '
         'Intelligenz. Klar, einen Moment … ich schau kurz in den Kalender. Am Donnerstag um halb elf wäre noch was frei.')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'voices':
        print('\n'.join(voices()))
    elif cmd == 'probe':
        out = sys.argv[2]; os.makedirs(out, exist_ok=True)
        for v in voices():
            synth(PROBE, v, f'{out}/{v}.mp3'); print('ok', v, flush=True)
    elif cmd == 'lines':
        jobs, voice, out = json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4]
        os.makedirs(out, exist_ok=True)
        for j in jobs:
            synth(j['text'], voice if not j.get('caller') else j['caller'], f"{out}/{j['id']}.mp3"); print('ok', j['id'], flush=True)
