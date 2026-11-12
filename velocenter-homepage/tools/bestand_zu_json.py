#!/usr/bin/env python3
"""Veloport-Fahrzeugbestand (CSV) -> data/bestand.json fuer die Homepage.

Aufruf:  python3 tools/bestand_zu_json.py <Veloport-Export.csv> [data/bestand.json] ["Hinweistext"]

Spaltenerkennung wie in der KI-Zentrale (fzbMap/fzbMapX). Auf die Homepage kommen nur
kundentaugliche Felder. Einkaufspreis, Rahmennummer, Lagerort, Besitzer, Bemerkung,
Akku-/Schluesselnummern werden nie uebernommen. Verkaufte (Verkaufsdatum/Besitzer),
reservierte Raeder und Serviceraeder fallen raus. Nur exakt gleiche Raeder werden zu einem
Eintrag zusammengefasst (KEINE Stueckzahlen); andere Groesse/Rahmenform/Farbe bleibt eigenes Rad.
"""
import os, csv, io, json, re, sys, datetime

def lesen(pfad):
    roh = open(pfad, 'rb').read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            txt = roh.decode(enc); break
        except UnicodeDecodeError:
            continue
    zeilen = [z for z in txt.splitlines() if z.strip()][:6]
    trenner = max([';', ',', '\t'], key=lambda d: (zeilen[0].count(d) > 0, len({z.count(d) for z in zeilen[1:]}) <= 1, zeilen[0].count(d)))
    rows = list(csv.reader(io.StringIO(txt), delimiter=trenner))
    kopf = rows[0]
    while len(kopf) > 1 and not kopf[-1].strip():
        kopf.pop()
    return kopf, [r for r in rows[1:] if any(x.strip() for x in r)]

def spalte(kopf, muster):
    for i, k in enumerate(kopf):
        if re.search(muster, k.strip(), re.I):
            return i
    return -1

def karte(kopf):
    f = lambda m: spalte(kopf, m)
    mo = f(r'^modell(bezeichnung)?$')
    if mo < 0: mo = f(r'modell')
    if mo < 0: mo = f(r'^(bezeichnung|artikel|typ)$')
    vk = f(r'^vk|verkaufspreis|^preis')
    if vk < 0: vk = f(r'^kaufpreis$')
    return dict(
        marke=f(r'hersteller|^marke$|brand'), modell=mo,
        gr=f(r'^(rahmen)?gr(ö|oe)(ß|ss)e|rahmenh(ö|oe)he|^rh$|^gr\.?$'),
        farbe=f(r'farbe'), vk=vk, ap=f(r'angebot'), jahr=f(r'modelljahr|^jahr$'),
        rf=f(r'rahmenform'), dh=f(r'damen|herren|geschlecht'), typ=f(r'^(fahrzeug)?(art|typ|kategorie)$|warengruppe'),
        id=f(r'^(fahrzeug)?-?\s?id$|^lfd|^fz-?nr'), ort=f(r'lagerort|standort|lagerplatz|^platz'),
        ang=f(r'angeliefert'), lt=f(r'liefertermin'), bd=f(r'bestelldatum'),
        res=f(r'^reserviert$'), test=f(r'^testfahrzeug$'), zu=f(r'^name$'),
        vd=f(r'verkaufsdatum'), bes=f(r'besitzer|eigent'), ausg=f(r'ausgeliefert'),
        display=f(r'^display'), reifen=f(r'reifengr'), gewicht=f(r'^gewicht'), zgg=f(r'gesamtgewicht'), km=f(r'km-?\s?stand'),
        aus=f(r'ausstatt'), akku=f(r'akku-?\s?leistung'), motor=f(r'^motor|antrieb'),
        schalt=f(r'schaltung|gangschaltung'),
    )

def wert(r, i):
    return r[i].strip() if 0 <= i < len(r) else ''

ja = lambda v: bool(re.fullmatch(r'(j|ja|1|x|true|y|yes)', v.strip(), re.I))

def preis(v):
    v = v.replace('€', '').replace(' ', '')
    if not v: return None
    if ',' in v: v = v.replace('.', '').replace(',', '.')
    try:
        p = float(v)
        return round(p) if p >= 300 else None
    except ValueError:
        return None

RF_VELOPORT = {'us': 'Tiefeinsteiger', 'us hardtail': 'Tiefeinsteiger', 'kompakt': 'Kompaktrad', 'herren': 'Diamant',
               'trapez': 'Trapez', 'mtb hardtail': 'MTB', 'dreirad': 'Dreirad', 'unisex': 'Unisex'}

def groesse(g):
    g = g.strip().replace("''", '"')
    if re.fullmatch(r'\d{2}', g): return g + ' cm'
    return re.sub(r'(\d)\s?cm', r'\1 cm', g)

def kw(datum):
    """Liefertermin TT.MM.JJ -> 'KW 48' (bzw. 'KW 2/27'); vergangene Termine -> ''."""
    for fmt in ('%d.%m.%y', '%d.%m.%Y'):
        try:
            d = datetime.datetime.strptime(datum.strip(), fmt).date(); break
        except ValueError:
            d = None
    if d is None: return datum.strip() if re.search(r'kw', datum, re.I) else ''
    heute = datetime.date.today()
    if d < heute: return ''
    w, j = d.isocalendar()[1], d.isocalendar()[0]
    return f'KW {w}' if j == heute.year else f'KW {w}/{str(j)[2:]}'

# Nicht auf der Homepage: Flyer (Restposten, wird nicht nachbestellt), Hercules (Leihräder, nicht zu verkaufen)
AUSGESCHLOSSEN = r'^(flyer|hercules)\b'

MARKEN = [(r'^i\s?:?\s?sy$', 'i:SY'), (r'^qio$', 'QiO'), (r'^ktm$', 'KTM'), (r'^velo\s*de\s*ville$', 'Velo de Ville'),
          (r'^van\s*raam$', 'Van Raam'), (r'^gudereit$', 'Gudereit'), (r'^victoria$', 'Victoria'), (r'^stevens$', 'Stevens'),
          (r'^flyer$', 'Flyer'), (r'^hercules$', 'Hercules')]

def marke_norm(v):
    for muster, name in MARKEN:
        if re.match(muster, v.strip(), re.I): return name
    return v.strip()

def motor(v):
    return re.sub(r'\s*(\d+\s?V|\d+\s?W|\d+\s?km/?h)\b', '', v).strip(' ,')

def einheit(v, e):
    v = v.strip().replace('.', ',') if v.strip() else ''
    return f'{v} {e}' if v and re.fullmatch(r'[\d,]+', v) else v

def rahmenform(rf, dh, modell):
    if rf.strip().lower() in RF_VELOPORT: return RF_VELOPORT[rf.strip().lower()]
    t = f'{rf} {dh} {modell}'.lower()
    if re.search(r'wave|tief|damen|easy ?entry|low ?step|\bus\b|unisex', t): return 'Tiefeinsteiger'
    if re.search(r'trapez|mixte|\btz\b', t): return 'Trapez'
    if re.search(r'diamant|herren|\bh\b', t): return 'Diamant'
    return ''

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    ziel = sys.argv[2] if len(sys.argv) > 2 else 'data/bestand.json'
    hinweis = sys.argv[3] if len(sys.argv) > 3 else ''
    kopf, rows = lesen(sys.argv[1])
    m = karte(kopf)
    if m['marke'] < 0 or m['modell'] < 0:
        sys.exit('Spalten Marke/Hersteller und Modell nicht gefunden – ist das der Fahrzeugbestand?')
    raeder, n_service, n_res, n_verk, n_marke = [], 0, 0, 0, 0
    for nr, r in enumerate(rows, 1):
        art = wert(r, m['zu'])
        if re.search(r'service', art, re.I): n_service += 1; continue
        if m['res'] >= 0 and ja(wert(r, m['res'])): n_res += 1; continue
        if wert(r, m['vd']) or wert(r, m['bes']) or wert(r, m['ausg']): n_verk += 1; continue
        marke, modell = marke_norm(wert(r, m['marke'])), wert(r, m['modell'])
        if not marke or not modell: continue
        if re.match(AUSGESCHLOSSEN, marke, re.I): n_marke += 1; continue
        zulauf = m['ang'] >= 0 and not wert(r, m['ang']) and (
            (m['lt'] < 0 and m['bd'] < 0) or bool(wert(r, m['lt'])) or bool(wert(r, m['bd'])))
        vk, ap = preis(wert(r, m['vk'])), preis(wert(r, m['ap']))
        raeder.append({k: v for k, v in dict(
            id=wert(r, m['id']) or str(nr), marke=marke, modell=modell, jahr=wert(r, m['jahr']),
            gr=groesse(wert(r, m['gr'])), farbe=wert(r, m['farbe']), typ=re.sub(r'(?i)bitte w.hlen', '', wert(r, m['typ'])),
            rahmen=rahmenform(wert(r, m['rf']), wert(r, m['dh']), modell),
            preis=vk, angebot=ap if ap and vk and ap < vk else None,
            status='bestellt' if zulauf else 'lager', ab=kw(wert(r, m['lt'])) if zulauf else '',
            gebraucht=bool(re.search(r'gebraucht', art, re.I)), vorfuehr=m['test'] >= 0 and ja(wert(r, m['test'])),
            motor=motor(wert(r, m['motor'])), akku=einheit(wert(r, m['akku']), 'Wh'),
            schaltung=wert(r, m['schalt']) or wert(r, m['aus']).split('|')[0].strip(),
            display=wert(r, m['display']), reifen=wert(r, m['reifen']).replace("''", '"'),
            gewicht=einheit(wert(r, m['gewicht']), 'kg'), zgg=einheit(wert(r, m['zgg']), 'kg'),
            km=(wert(r, m['km']) + ' km') if re.search(r'gebraucht', art, re.I) and wert(r, m['km']) else '',
        ).items() if v not in ('', None, False)})
    eindeutig = gruppieren(raeder)
    bilder_zuordnen(eindeutig, os.path.join(os.path.dirname(os.path.abspath(ziel)), 'bilder.json'))
    daten = dict(stand=datetime.date.today().strftime('%d.%m.%Y'), quelle='Veloport-Export', raeder=eindeutig, **({'hinweis': hinweis} if hinweis else {}))
    json.dump(daten, open(ziel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(raeder)} Räder -> {len(eindeutig)} Karten ({sum(len(k["farben"]) for k in eindeutig)} Farb-Ausführungen) -> {ziel} '
          f'(ausgelassen: {n_verk} verkauft, {n_res} reserviert, {n_service} Servicerad, {n_marke} Flyer/Hercules)')

FELDER = ('marke', 'modell', 'jahr', 'gr', 'farbe', 'rahmen', 'typ', 'motor', 'akku', 'schaltung', 'display', 'reifen', 'gewicht', 'zgg', 'km',
          'status', 'ab', 'preis', 'angebot', 'vorfuehr', 'gebraucht', 'id')

def bild_key(marke, modell, jahr, farbe):
    """Schlüssel für das exakte Herstellerfoto: Marke + Modell + Modelljahr + Farbe."""
    n = lambda t: re.sub(r'[^a-z0-9]+', '', str(t or '').lower())
    return '|'.join((n(marke), n(modell), n(jahr), n(farbe)))


def bilder_zuordnen(karten, pfad):
    """Hängt jedem Farb-Eintrag sein exaktes Foto an (nur bei genauem Treffer aus data/bilder.json)."""
    if not os.path.exists(pfad):
        return
    zu = json.load(open(pfad, encoding='utf-8'))
    for k in karten:
        for v in k['farben']:
            b = zu.get(bild_key(k['marke'], k['modell'], v.get('jahr'), v.get('farbe')))
            if b:
                v['bild'] = b


def gruppieren(raeder):
    """1) EXAKT gleiche Raeder (Marke, Modell, Jahr, Groesse, Rahmenform, Farbe, Zustand) -> ein Eintrag, ohne Stueckzahl.
    2) Gleiches Modell in gleicher Groesse und Rahmenform -> eine Karte mit den Farben als Auswahl.
       Andere Groesse oder Rahmenform = eigene Karte."""
    gleich = {}
    for r in raeder:
        key = tuple(str(r.get(k, '')).strip().lower() for k in ('marke', 'modell', 'jahr', 'gr', 'rahmen', 'farbe')) + (
            bool(r.get('gebraucht')), bool(r.get('vorfuehr')))
        neu = {k: r[k] for k in FELDER if k in r}
        alt = gleich.get(key)
        if alt is None:
            gleich[key] = neu; continue
        if neu['status'] == 'lager' and alt['status'] != 'lager':  # eins da, eins bestellt -> "da"
            alt.update(status='lager', id=neu.get('id', alt.get('id'))); alt.pop('ab', None)
        elif alt['status'] == 'bestellt' and neu.get('ab') and (not alt.get('ab') or neu['ab'] < alt['ab']):
            alt['ab'] = neu['ab']
        if neu.get('angebot') and (not alt.get('angebot') or neu['angebot'] < alt['angebot']): alt['angebot'] = neu['angebot']
        for k in ('motor', 'akku', 'schaltung', 'display', 'reifen', 'gewicht', 'zgg', 'typ'):
            if k in neu and k not in alt: alt[k] = neu[k]
    # Schritt 2: gleiches Modell + gleiche Groesse + gleiche Rahmenform -> EINE Karte, Farben als Auswahl
    karten = {}
    for r in gleich.values():
        key = tuple(str(r.get(k, '')).strip().lower() for k in ('marke', 'modell', 'gr', 'rahmen')) + (
            bool(r.get('gebraucht')), bool(r.get('vorfuehr')))
        k = karten.setdefault(key, {f: r[f] for f in ('marke', 'modell', 'gr', 'rahmen', 'typ', 'gebraucht', 'vorfuehr') if f in r} | {'farben': []})
        k['farben'].append({f: r[f] for f in FELDER if f in r and f not in ('marke', 'modell', 'gr', 'rahmen', 'gebraucht', 'vorfuehr')})
    out = []
    for k in karten.values():
        k['farben'].sort(key=lambda v: (v['status'] != 'lager', -(int(v.get('jahr') or 0)), v.get('farbe', '').lower()))
        out.append(k)
    return sorted(out, key=lambda k: (all(v['status'] != 'lager' for v in k['farben']), k['marke'].lower(), k['modell'].lower(), k.get('gr', '')))

if __name__ == '__main__':
    main()
