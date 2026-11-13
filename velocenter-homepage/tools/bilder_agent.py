#!/usr/bin/env python3
"""Bilder-Agent für „Auf Lager“ – Werkzeug für den GitHub-Lauf .github/workflows/homepage-bilder.yml.

Die Foto-Zuordnung steht in index.html (#bilderData: "marke|modell|jahr|farbe" -> "img/bestand/…webp", "" = bewusst ohne Bild).
Der Bericht für den Admin steht in index.html (#bilderBericht). Der Merkzettel des Agenten in data/bilder_status.json.

Befehle (alle aus dem Ordner velocenter-homepage/):
  liste [neu=20] [pruef=8]          Arbeitsliste für Claude -> $RUNNER_TEMP/bilder/auftrag.json (+ Text für den Prompt)
  holen <key> <url>                 Bild laden, prüfen, freistellen, schärfen -> Kandidat + Vorschau (für Claude zum Ansehen)
  anwenden <entscheid.json> [lauf]  Claudes Entscheidungen übernehmen (neu / ersetzen / entfernen / unsicher / nicht_gefunden / ok)
  ablehnen <key>                    Admin-Knopf „✕ Falsch“: Foto raus, Quelle gesperrt, neu suchen (uebernehmen nur für alte Vorschläge)
  aufraeumen                        nicht mehr benutzte Bilder löschen, lange ausverkaufte Zuordnungen entfernen
Admin-Fotos (Firebase, „fs:…“) und Farben, bei denen ein Admin das Foto selbst gesetzt/entfernt hat, fasst der Agent nie an.
"""
import hashlib, io, json, os, re, sys, time, datetime, urllib.request, urllib.error, glob, shutil

HIER = os.path.dirname(os.path.abspath(__file__))
BASIS = os.path.dirname(HIER)
HTML = os.path.join(BASIS, 'index.html')
STATUS = os.path.join(BASIS, 'data', 'bilder_status.json')
TMP = os.environ.get('BILDER_TMP') or os.path.join(os.environ.get('RUNNER_TEMP') or '/tmp', 'bilder')
KAND = os.path.join(TMP, 'kand')
HEUTE = datetime.date.today().isoformat()
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

n = lambda t: re.sub(r'[^a-z0-9]+', '', str('' if t is None else t).lower())
def bkey(m, mo, j, f): return '|'.join((n(m), n(mo), n(j), n(f)))

# ---------- index.html lesen/schreiben ----------
def html_lesen(): return open(HTML, encoding='utf-8').read()
def block(s, bid):
    m = re.search(r'(<script type="application/json" id="%s">)(.*?)(</script>)' % bid, s, re.S)
    if not m: raise SystemExit('Block #%s fehlt in index.html' % bid)
    return m
def json_aus(s, bid): return json.loads(block(s, bid).group(2) or '{}')
def json_setzen(s, bid, obj, sort=False):
    m = block(s, bid)
    txt = json.dumps(obj, ensure_ascii=False, separators=(',', ':'), sort_keys=sort).replace('</', '<\\/')
    return s[:m.start(2)] + txt + s[m.end(2):]
def status_lesen():
    try: return json.load(open(STATUS, encoding='utf-8'))
    except Exception: return {}
def status_schreiben(st):
    os.makedirs(os.path.dirname(STATUS), exist_ok=True)
    json.dump(st, open(STATUS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)

# ---------- Firebase (nur öffentlich lesbare Dokumente) ----------
def fs_dec(v):
    if not isinstance(v, dict): return None
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'nullValue' in v: return None
    if 'arrayValue' in v: return [fs_dec(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v: return {k: fs_dec(x) for k, x in v['mapValue'].get('fields', {}).items()}
    return None
def fs_get(pfad):
    try:
        cfg = json.load(open(os.path.join(BASIS, 'live', 'firebase.json'), encoding='utf-8'))
        url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/%s' % (cfg['projectId'], pfad)
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=20) as r:
            d = json.load(r)
        return {k: fs_dec(x) for k, x in d.get('fields', {}).items()}
    except Exception:
        return None

def slug(t): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', str(t).lower())).strip('-')
def adm_key(r):  # wie admKey() in index.html
    return slug(' '.join([r.get('marke', ''), r.get('modell', ''), r.get('gr', ''), r.get('rahmen', ''),
                          'g' if r.get('gebraucht') else '', 'v' if r.get('vorfuehr') else '']))

def bestand_alle(s):
    """Alle Räder, die gerade auf der Seite stehen können: Datei-Bestand + Firebase-Import (falls aktiv)."""
    datei = json_aus(s, 'bestandData')
    fb = fs_get('bestand/aktuell')
    aktiv = fb if fb and isinstance(fb.get('raeder'), list) and fb['raeder'] else datei
    return aktiv, datei, fb, (fs_get('pub/lager') or {}).get('rows') or {}

def varianten(aktiv, rows):
    """Eindeutige Farb-Ausführungen (Schlüssel) mit Angaben für die Suche. Admin-Fotos/-Entscheidungen -> 'admin'."""
    out = {}
    for r in aktiv.get('raeder', []):
        row = rows.get('ov-' + adm_key(r)) or {}
        if row.get('hidden'): continue
        for f in r.get('farben', []):
            o = (row.get('v') or {}).get(str(f.get('id'))) or {}
            if o.get('hidden'): continue
            k = bkey(r.get('marke'), r.get('modell'), f.get('jahr'), f.get('farbe'))
            e = out.setdefault(k, dict(key=k, marke=r.get('marke'), modell=r.get('modell'), jahr=f.get('jahr') or '',
                                       farbe=f.get('farbe') or '', typ=f.get('typ') or r.get('typ') or '',
                                       rahmen=set(), groessen=set(), motor=f.get('motor') or '', akku=f.get('akku') or '',
                                       schaltung=f.get('schaltung') or '', veloids=set(), admin=False))
            if r.get('rahmen'): e['rahmen'].add(r['rahmen'])
            if r.get('gr'): e['groessen'].add(r['gr'])
            if f.get('veloid'): e['veloids'].add(str(f['veloid']))
            if 'bild' in o: e['admin'] = True  # Admin hat Foto selbst gesetzt oder entfernt
    for e in out.values():
        e['rahmen'] = sorted(e['rahmen']); e['groessen'] = sorted(e['groessen']); e['veloids'] = sorted(e['veloids'])[:3]
    return out

def tage_seit(d):
    try: return (datetime.date.today() - datetime.date.fromisoformat(d)).days
    except Exception: return 9999

# ---------- Prüfbögen (Qualität: Schärfe, Klarheit, Freistellung) ----------
def boegen_bauen(eintraege):
    """Legt je 6 Fotos auf Kontrast-Hintergrund (Grün + Dunkel geteilt), nummeriert -> $TMP/boegen/bogen-NN.png.
    Helle/dunkle Säume, Hintergrundreste, gezackte Kanten und Unschärfe fallen so sofort auf."""
    from PIL import Image, ImageDraw, ImageFont
    d = os.path.join(TMP, 'boegen'); shutil.rmtree(d, ignore_errors=True); os.makedirs(d, exist_ok=True)
    try: fnt = ImageFont.truetype('DejaVuSans-Bold.ttf', 34)
    except Exception: fnt = ImageFont.load_default()
    TW, TH = 760, 520; pfade = []
    for b in range(0, len(eintraege), 6):
        bogen = Image.new('RGB', (TW * 2, TH * 3), (255, 255, 255))
        for i, e in enumerate(eintraege[b:b + 6]):
            x0, y0 = (i % 2) * TW, (i // 2) * TH
            kachel = Image.new('RGBA', (TW, TH), (46, 160, 90, 255))
            ImageDraw.Draw(kachel).rectangle((0, TH // 2, TW, TH), fill=(32, 30, 48, 255))
            try:
                im = Image.open(os.path.join(BASIS, e['bild_jetzt'])).convert('RGBA')
                im.thumbnail((TW - 30, TH - 60), Image.LANCZOS)
                kachel.alpha_composite(im, ((TW - im.width) // 2, 50 + (TH - 60 - im.height) // 2))
            except Exception: pass
            dr = ImageDraw.Draw(kachel); dr.rectangle((0, 0, TW, 44), fill=(255, 255, 255, 235))
            dr.text((12, 4), '%d  %s' % (e['nr'], e['label'])[:44], fill=(20, 20, 30), font=fnt)
            bogen.paste(kachel.convert('RGB'), (x0, y0))
        f = os.path.join(d, 'bogen-%02d.png' % (b // 6 + 1)); bogen.save(f); pfade.append(f)
    return pfade

# ---------- liste ----------
def cmd_liste(args):
    opt = dict(a.split('=', 1) for a in args if '=' in a)
    n_neu, n_pruef, n_qual = int(opt.get('neu', 20)), int(opt.get('pruef', 8)), int(opt.get('qual', 0))
    s = html_lesen(); bm = json_aus(s, 'bilderData'); st = status_lesen()
    aktiv, _, _, rows = bestand_alle(s)
    V = varianten(aktiv, rows)
    for k in V: st.setdefault(k, {})['zuletzt'] = HEUTE
    status_schreiben(st)
    fehlt, pruef = [], []
    for k, e in V.items():
        if e['admin']: continue
        x = st.get(k, {})
        if bm.get(k):
            if x.get('pinned'): continue
            pruef.append((x.get('geprueft') or '0000', k))
        elif k in bm and bm[k] == '' and tage_seit(x.get('geprueft')) < 30:
            continue  # bewusst ohne Bild (falsches Bild entfernt) – erst nach 30 Tagen neu suchen
        else:
            versuche = x.get('versuche', 0)
            warte = 0 if not versuche else min(3 * versuche, 21)  # nicht gefunden -> später erneut (3, 6, … max. 21 Tage)
            if tage_seit(x.get('gesucht')) >= warte: fehlt.append((versuche, x.get('gesucht') or '', k))
    fehlt.sort(); pruef.sort()
    bericht = json_aus(s, 'bilderBericht')
    offen_unsicher = {u['key'] for u in bericht.get('unsicher', [])}
    sel_neu = [k for _, _, k in fehlt if k not in offen_unsicher][:n_neu]
    sel_pruef = [k for _, k in pruef][:n_pruef]
    # Qualitäts-Runde: alle Fotos reihum (am längsten nicht angesehen zuerst), auch vom Admin bestätigte
    qual = sorted((st.get(k, {}).get('qcheck') or '0000', k) for k, e in V.items() if bm.get(k) and not e['admin'] and k not in sel_pruef)
    sel_qual = [k for _, k in qual][:n_qual]
    def info(k, art):
        e = dict(V[k]); e.pop('admin', None); x = st.get(k, {})
        e.update(art=art, bild_jetzt=bm.get(k) or '', quelle_jetzt=x.get('quelle', ''),
                 abgelehnt=x.get('abgelehnt', [])[-15:], notiz=x.get('notiz', ''),
                 geschwister=sorted({vk.split('|')[3] + ' -> ' + (bm.get(vk) or '–') for vk in V if vk.rsplit('|', 2)[0] == k.rsplit('|', 2)[0] and vk != k})[:20])
        return e
    auftrag = dict(datum=HEUTE, suchen=[info(k, 'suchen') for k in sel_neu], pruefen=[info(k, 'pruefen') for k in sel_pruef],
                   qualitaet=[dict(info(k, 'qualitaet'), nr=i + 1, label=label(V[k]), bestaetigt=bool(st.get(k, {}).get('pinned'))) for i, k in enumerate(sel_qual)],
                   gesamt=dict(varianten=len(V), mit_bild=sum(1 for k in V if bm.get(k) or V[k]['admin']),
                               ohne_bild=sum(1 for k in V if not bm.get(k) and not V[k]['admin'])))
    os.makedirs(KAND, exist_ok=True)
    auftrag['boegen'] = boegen_bauen(auftrag['qualitaet']) if sel_qual else []
    for k in sel_qual: st.setdefault(k, {})['qcheck'] = HEUTE
    status_schreiben(st)
    json.dump(auftrag, open(os.path.join(TMP, 'auftrag.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('suchen=%d pruefen=%d qualitaet=%d (%d Bögen) ohne_bild=%d' % (len(sel_neu), len(sel_pruef), len(sel_qual), len(auftrag['boegen']), auftrag['gesamt']['ohne_bild']))

# ---------- holen ----------
_SESS = None
def freistellen(im):
    """Produktfoto -> transparenter Hintergrund (wie die bisherigen Bestandsbilder), beschnitten, geschärft, max. 1200 px."""
    global _SESS
    import numpy as np
    from PIL import Image, ImageFilter
    if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
        rgba = im.convert('RGBA'); a = np.asarray(rgba.split()[3])
        if (a < 20).mean() > 0.15:  # hat schon echten transparenten Hintergrund
            out = rgba
        else:
            im = Image.alpha_composite(Image.new('RGBA', rgba.size, (255, 255, 255, 255)), rgba).convert('RGB'); out = None
    else:
        im = im.convert('RGB'); out = None
    if out is None:
        from rembg import remove, new_session
        if _SESS is None: _SESS = new_session('isnet-general-use')
        m = remove(im, session=_SESS, only_mask=True, post_process_mask=True)
        A = np.asarray(m, dtype=np.float32) / 255; I = np.asarray(im, dtype=np.float32)
        mn = I.min(axis=2)
        c2a = np.clip((236 - mn) / 196, 0, 1); c2a = np.clip((c2a - 0.12) / 0.88, 0, 1) ** 0.9
        near = np.asarray(m.filter(ImageFilter.MaxFilter(41)), dtype=np.float32) / 255 > 0.2
        core = np.asarray(m.filter(ImageFilter.MinFilter(9)), dtype=np.float32) / 255
        rand = np.concatenate([I[:6].reshape(-1, 3), I[-6:].reshape(-1, 3), I[:, :6].reshape(-1, 3), I[:, -6:].reshape(-1, 3)])
        weiss = float((rand.min(axis=1) > 225).mean())
        a = np.maximum(c2a * near, core) if weiss > 0.6 else A  # Farbe-zu-Alpha nur bei weißem Studiohintergrund
        a = np.clip(a, 0, 1); safe = np.maximum(a, 1e-3)[..., None]
        C = np.clip((I - (1 - a[..., None]) * 255) / safe, 0, 255) if weiss > 0.6 else I
        C = np.where(core[..., None] > 0.5, I, C)
        out = Image.fromarray(np.dstack([C, a * 255]).astype(np.uint8), 'RGBA')
    bb = out.split()[3].point(lambda v: 255 if v > 10 else 0).getbbox()
    if bb: out = out.crop(bb)
    r, g, b, al = out.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    out = Image.merge('RGBA', (*rgb.split(), al))
    if out.width > 1200: out = out.resize((1200, round(out.height * 1200 / out.width)), Image.LANCZOS)
    return out

def dhash(im, g=12):
    from PIL import Image
    x = im.convert('RGBA'); bg = Image.new('RGBA', x.size, (255, 255, 255, 255))
    x = Image.alpha_composite(bg, x).convert('L').resize((g + 1, g))
    p = list(x.tobytes()); return ''.join('1' if p[r * (g + 1) + c] > p[r * (g + 1) + c + 1] else '0' for r in range(g) for c in range(g))
def hd(a, b): return sum(x != y for x, y in zip(a, b))

def cmd_holen(args):
    from PIL import Image
    if len(args) < 2: raise SystemExit('Aufruf: holen <key> <url>')
    key, url = args[0], args[1]
    auftrag = json.load(open(os.path.join(TMP, 'auftrag.json'), encoding='utf-8'))
    keys = {e['key'] for e in auftrag['suchen'] + auftrag['pruefen']}
    if key not in keys: raise SystemExit('FEHLER: Schlüssel steht nicht in der Arbeitsliste.')
    if not re.match(r'^https://[^\s/]+\.[a-z]{2,}/', url, re.I): raise SystemExit('FEHLER: nur https-Adressen.')
    nr = len(glob.glob(os.path.join(KAND, '*.webp'))) + 1
    if nr > 400: raise SystemExit('FEHLER: zu viele Kandidaten in diesem Lauf.')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8'})
        with urllib.request.urlopen(req, timeout=40) as r:
            roh = r.read(30 * 1024 * 1024 + 1)
    except urllib.error.HTTPError as e:
        raise SystemExit('FEHLER: Download %s (HTTP %s)' % (url, e.code))
    except Exception as e:
        raise SystemExit('FEHLER: Download fehlgeschlagen: %s' % e)
    if len(roh) > 30 * 1024 * 1024: raise SystemExit('FEHLER: Datei zu groß.')
    try:
        im = Image.open(io.BytesIO(roh)); im.load()
    except Exception:
        raise SystemExit('FEHLER: keine Bilddatei (evtl. HTML-Seite statt Bild-Adresse).')
    if im.width < 700 and im.height < 500:
        raise SystemExit('FEHLER: Bild zu klein (%dx%d) – größere Fassung suchen.' % (im.width, im.height))
    os.makedirs(KAND, exist_ok=True)
    base = os.path.join(KAND, 'k%03d' % nr)
    orig = im.convert('RGB'); orig.thumbnail((1000, 1000)); orig.save(base + '-original.jpg', quality=88)
    out = freistellen(im)
    out.save(base + '.webp', 'WEBP', quality=88, method=6)
    from PIL import Image as I2
    pv = I2.new('RGBA', out.size, (226, 223, 232, 255)); pv.alpha_composite(out); pv = pv.convert('RGB'); pv.thumbnail((1000, 1000))
    pv.save(base + '-vorschau.jpg', quality=88)
    import numpy as np
    a = np.asarray(out.split()[3]); deck = float((a > 128).mean())
    h = dhash(out)
    # Vergleich mit vorhandenen Bildern desselben Modells (gleiches Bild für andere Farbe = Warnung)
    bm = json_aus(html_lesen(), 'bilderData'); mod = key.rsplit('|', 2)[0]; aehnlich = []
    for k, p in bm.items():
        if not p or k.rsplit('|', 2)[0] != mod: continue
        f = os.path.join(BASIS, p)
        if os.path.exists(f):
            d = hd(h, dhash(I2.open(f)))
            if d <= 18: aehnlich.append('%s (Abstand %d)' % (k.split('|')[3], d))
    meta = dict(key=key, url=url, kandidat=base + '.webp', original=base + '-original.jpg', vorschau=base + '-vorschau.jpg',
                groesse_original='%dx%d' % (im.width, im.height), groesse_fertig='%dx%d' % out.size,
                deckung=round(deck, 2), dhash=h, sehr_aehnlich_wie=aehnlich)
    json.dump(meta, open(base + '.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    hin = []
    if deck < 0.12: hin.append('WARNUNG: kaum Motiv nach dem Freistellen – evtl. Szene/Detailbild statt Produktfoto.')
    if out.width < out.height: hin.append('WARNUNG: Hochformat – meist kein Seitenansicht-Produktfoto.')
    if aehnlich: hin.append('WARNUNG: fast gleiches Bild wie bei anderer Farbe desselben Modells: ' + ', '.join(aehnlich))
    print('\n'.join(hin) or 'OK – jetzt Original UND Vorschau mit Read ansehen und Farbe/Modell genau prüfen.')

# ---------- anwenden ----------
def label(e): return ' '.join(x for x in [e.get('marke'), e.get('modell'), e.get('jahr')] if x) + ' · ' + (e.get('farbe') or '–')
def bestand_patchen(s, key, bild):
    d = json_aus(s, 'bestandData')
    for r in d.get('raeder', []):
        for f in r.get('farben', []):
            if bkey(r.get('marke'), r.get('modell'), f.get('jahr'), f.get('farbe')) != key: continue
            if f.get('bild') and not str(f['bild']).startswith('img/bestand/'): continue
            if bild: f['bild'] = bild
            else: f.pop('bild', None)
    return json_setzen(s, 'bestandData', d)
def datei_ziel(marke, quelle):
    with open(quelle, 'rb') as fh: h = hashlib.sha1(fh.read()).hexdigest()[:10]
    return 'img/bestand/a-%s-%s.webp' % (slug(marke) or 'rad', h)

def cmd_anwenden(args):
    pfad = args[0]; lauf = args[1] if len(args) > 1 else ''
    auftrag = json.load(open(os.path.join(TMP, 'auftrag.json'), encoding='utf-8'))
    A = {e['key']: e for e in auftrag['suchen'] + auftrag['pruefen'] + auftrag.get('qualitaet', [])}
    try: E = json.load(open(pfad, encoding='utf-8'))
    except Exception as e: raise SystemExit('Entscheidungen nicht lesbar: %s' % e)
    if isinstance(E, dict): E = E.get('entscheidungen', [])
    s = html_lesen(); bm = json_aus(s, 'bilderData'); st = status_lesen(); ber = json_aus(s, 'bilderBericht')
    unsicher = [u for u in ber.get('unsicher', [])]
    z = dict(neu=[], ersetzt=[], entfernt=[], unsicher=[], ok=0, nicht=0)
    for e in E[:120]:
        k = e.get('key'); akt = e.get('aktion'); info = A.get(k)
        if not info: print('übersprungen (nicht in Arbeitsliste):', k); continue
        x = st.setdefault(k, {}); grund = str(e.get('grund', ''))[:300]; quelle = str(e.get('quelle', ''))[:500]
        seite = str(e.get('seite', ''))[:500]
        if e.get('notiz'): x['notiz'] = str(e['notiz'])[:300]
        if akt in ('neu', 'ersetzen', 'unsicher'):
            kp = os.path.realpath(str(e.get('kandidat', '')))
            if not kp.startswith(os.path.realpath(KAND) + os.sep) or not kp.endswith('.webp') or not os.path.exists(kp):
                print('übersprungen (Kandidat fehlt):', k); continue
            meta = {}
            try: meta = json.load(open(kp[:-5] + '.json', encoding='utf-8'))
            except Exception: pass
            if meta.get('key') != k: print('übersprungen (Kandidat gehört zu anderem Rad):', k); continue
            quelle = quelle or meta.get('url', '')
            ub = akt == 'unsicher'  # Tiry 13.11.2026: auch unsichere Funde sofort übernehmen, nur markieren
            ziel = datei_ziel(info.get('marke'), kp)
            shutil.copyfile(kp, os.path.join(BASIS, ziel))
            war = bm.get(k) or ''
            bm[k] = ziel; s = bestand_patchen(s, k, ziel)
            x.update(quelle=quelle, seite=seite, geprueft=HEUTE, gesucht=HEUTE, versuche=0, grund=grund)
            (z['ersetzt'] if war else z['neu']).append(dict(key=k, label=label(info), bild=ziel, quelle=quelle, seite=seite, grund=grund, ub=ub))
            if ub: z['unsicher'].append(k)
            unsicher = [u for u in unsicher if u['key'] != k]
        elif akt == 'entfernen':
            if not bm.get(k): continue
            bm[k] = ''; s = bestand_patchen(s, k, '')
            x.update(geprueft=HEUTE, grund=grund, entfernt=HEUTE)
            z['entfernt'].append(dict(key=k, label=label(info), grund=grund))
        elif akt == 'ok':
            x.update(geprueft=HEUTE); z['ok'] += 1
            if e.get('quelle') and not x.get('quelle'): x['quelle'] = quelle
        elif akt == 'nicht_gefunden':
            x.update(gesucht=HEUTE, versuche=x.get('versuche', 0) + 1, grund=grund); z['nicht'] += 1
    # Rest der Arbeitsliste, zu dem Claude nichts gesagt hat: als „gesucht“ vermerken (sonst ewig vorne in der Liste)
    gesagt = {e.get('key') for e in E}
    for k, info in A.items():
        if k in gesagt: continue
        x = st.setdefault(k, {})
        if info['art'] == 'suchen': x.update(gesucht=HEUTE, versuche=x.get('versuche', 0) + 1)
    s = json_setzen(s, 'bilderData', bm, sort=True)
    verlauf = ber.get('verlauf', [])[-11:]
    verlauf.append(dict(ts=int(time.time() * 1000), neu=len(z['neu']), ersetzt=len(z['ersetzt']), entfernt=len(z['entfernt']),
                        unsicher=len(z['unsicher']), ok=z['ok'], nicht=z['nicht'], lauf=lauf))
    ber = dict(ts=int(time.time() * 1000), lauf=lauf, neu=z['neu'], ersetzt=z['ersetzt'], entfernt=z['entfernt'],
               unsicher=[], gesamt=auftrag.get('gesamt', {}), verlauf=verlauf,
               gesucht=len(auftrag['suchen']), geprueft=len(auftrag['pruefen']))
    neu_ohne = auftrag['gesamt'].get('ohne_bild', 0) - len(z['neu']) + len([1 for e in z['entfernt']])
    ber['gesamt'] = dict(auftrag['gesamt'], ohne_bild=max(0, neu_ohne))
    s = json_setzen(s, 'bilderBericht', ber)
    open(HTML, 'w', encoding='utf-8').write(s); status_schreiben(st)
    print('neu=%d ersetzt=%d entfernt=%d unsicher=%d ok=%d nicht_gefunden=%d' % (
        len(z['neu']), len(z['ersetzt']), len(z['entfernt']), len(z['unsicher']), z['ok'], z['nicht']))
    zus = os.path.join(TMP, 'zusammenfassung.txt')
    open(zus, 'w', encoding='utf-8').write('Bilder-Agent: %d neu, %d ersetzt, %d entfernt' % (
        len(z['neu']), len(z['ersetzt']), len(z['entfernt'])))

# ---------- Admin-Knöpfe ----------
def cmd_entscheid(args, ja):
    k = args[0] if args else ''
    s = html_lesen(); ber = json_aus(s, 'bilderBericht'); bm = json_aus(s, 'bilderData'); st = status_lesen()
    u = next((u for u in ber.get('unsicher', []) if u['key'] == k), None)
    if not u and not ja:  # Admin: „✕ Falsch“ an einem übernommenen Foto -> raus, Quelle sperren, beim nächsten Lauf neu suchen
        x = st.setdefault(k, {}); alt = next((v for v in ber.get('neu', []) + ber.get('ersetzt', []) if v['key'] == k), {})
        if not bm.get(k): raise SystemExit('Kein Foto vom Agenten zu ' + k)
        q = alt.get('quelle') or x.get('quelle', '')
        ab = x.setdefault('abgelehnt', [])
        if q and q not in ab: ab.append(q)
        bm[k] = ''; s = bestand_patchen(s, k, '')
        x.update(versuche=0, grund='vom Admin als falsch markiert'); x.pop('geprueft', None); x.pop('gesucht', None); x.pop('quelle', None)
        for f in ('neu', 'ersetzt'): ber[f] = [v for v in ber.get(f, []) if v['key'] != k]
        lab = alt.get('label') or k
        ber.setdefault('entfernt', []).append(dict(key=k, label=lab, grund='vom Admin als falsch markiert'))
        s = json_setzen(s, 'bilderData', bm, sort=True); s = json_setzen(s, 'bilderBericht', ber)
        open(HTML, 'w', encoding='utf-8').write(s); status_schreiben(st)
        os.makedirs(TMP, exist_ok=True)
        open(os.path.join(TMP, 'zusammenfassung.txt'), 'w', encoding='utf-8').write('Bilder-Agent: Foto als falsch markiert – ' + lab)
        print('ok entfernt', lab); return
    if not u: raise SystemExit('Vorschlag nicht (mehr) vorhanden: ' + k)
    src = os.path.join(BASIS, u['bild']); x = st.setdefault(k, {})
    if ja:
        if not os.path.exists(src): raise SystemExit('Vorschau-Bild fehlt.')
        ziel = datei_ziel(k.split('|')[0], src); shutil.copyfile(src, os.path.join(BASIS, ziel))
        bm[k] = ziel; s = bestand_patchen(s, k, ziel)
        x.update(quelle=u.get('quelle', ''), seite=u.get('seite', ''), geprueft=HEUTE, versuche=0, grund='vom Admin freigegeben')
        ber.setdefault('neu', []).append(dict(key=k, label=u['label'], bild=ziel, quelle=u.get('quelle', ''), seite=u.get('seite', ''), grund=u.get('grund', ''), ub=True))
    else:
        ab = x.setdefault('abgelehnt', [])
        if u.get('quelle') and u['quelle'] not in ab: ab.append(u['quelle'])
        x.update(gesucht=HEUTE)
    ber['unsicher'] = [v for v in ber['unsicher'] if v['key'] != k]
    if os.path.exists(src): os.remove(src)
    s = json_setzen(s, 'bilderData', bm, sort=True); s = json_setzen(s, 'bilderBericht', ber)
    open(HTML, 'w', encoding='utf-8').write(s); status_schreiben(st)
    os.makedirs(TMP, exist_ok=True)
    open(os.path.join(TMP, 'zusammenfassung.txt'), 'w', encoding='utf-8').write(
        'Bilder-Agent: Vorschlag %s – %s' % ('übernommen' if ja else 'abgelehnt', u['label']))
    print('ok', 'übernommen' if ja else 'abgelehnt', u['label'])

def cmd_richtig(args):
    """Admin: „✓ Richtig“ – Foto bleibt, verschwindet aus „Zuletzt neu“, wird nie mehr vom Agenten ersetzt."""
    k = args[0] if args else ''
    s = html_lesen(); ber = json_aus(s, 'bilderBericht'); bm = json_aus(s, 'bilderData'); st = status_lesen()
    if not bm.get(k): raise SystemExit('Kein Foto zu ' + k)
    alt = next((v for v in ber.get('neu', []) + ber.get('ersetzt', []) if v['key'] == k), {})
    st.setdefault(k, {}).update(pinned=True, bestaetigt=HEUTE, geprueft=HEUTE)
    for f in ('neu', 'ersetzt'): ber[f] = [v for v in ber.get(f, []) if v['key'] != k]
    s = json_setzen(s, 'bilderBericht', ber)
    open(HTML, 'w', encoding='utf-8').write(s); status_schreiben(st)
    os.makedirs(TMP, exist_ok=True)
    open(os.path.join(TMP, 'zusammenfassung.txt'), 'w', encoding='utf-8').write('Bilder-Agent: Foto bestätigt – ' + (alt.get('label') or k))
    print('ok bestätigt', k)

# ---------- aufräumen ----------
def cmd_aufraeumen(args):
    s = html_lesen(); bm = json_aus(s, 'bilderData'); st = status_lesen(); ber = json_aus(s, 'bilderBericht')
    aktiv, datei, fb, rows = bestand_alle(s)
    da = set(varianten(aktiv, rows)) | set(varianten(datei, {}))
    weg = 0
    for k in list(bm):  # Zuordnungen für Räder, die seit über 120 Tagen nicht mehr im Bestand sind
        if k not in da and tage_seit(st.get(k, {}).get('zuletzt')) > 120:
            del bm[k]; st.pop(k, None); weg += 1
    s = json_setzen(s, 'bilderData', bm, sort=True)
    benutzt = set(re.findall(r'img/(?:bestand|kandidat)/[A-Za-z0-9._-]+\.webp', s))
    benutzt |= set(re.findall(r'img/bestand/[A-Za-z0-9._-]+\.webp', json.dumps([fb, rows])))
    geloescht = []
    for f in glob.glob(os.path.join(BASIS, 'img', 'bestand', '*.webp')) + glob.glob(os.path.join(BASIS, 'img', 'kandidat', '*.webp')):
        rel = os.path.relpath(f, BASIS).replace(os.sep, '/')
        if rel not in benutzt: os.remove(f); geloescht.append(rel)
    open(HTML, 'w', encoding='utf-8').write(s); status_schreiben(st)
    print('Zuordnungen entfernt: %d, Dateien gelöscht: %d' % (weg, len(geloescht)))
    for g in geloescht: print('  -', g)

if __name__ == '__main__':
    c, a = (sys.argv[1] if len(sys.argv) > 1 else ''), sys.argv[2:]
    {'liste': cmd_liste, 'holen': cmd_holen, 'anwenden': cmd_anwenden, 'aufraeumen': cmd_aufraeumen,
     'uebernehmen': lambda x: cmd_entscheid(x, True), 'ablehnen': lambda x: cmd_entscheid(x, False), 'richtig': cmd_richtig}.get(
        c, lambda x: print(__doc__))(a)
