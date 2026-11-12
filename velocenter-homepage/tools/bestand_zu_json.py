#!/usr/bin/env python3
"""Veloport-Fahrzeugbestand (CSV) -> data/bestand.json fuer die Homepage.

Aufruf:  python3 tools/bestand_zu_json.py <Veloport-Export.csv> [data/bestand.json]

Spaltenerkennung wie in der KI-Zentrale (fzbMap/fzbMapX). Auf die Homepage kommen nur
kundentaugliche Felder. Einkaufspreis, Rahmennummer, Lagerort, Besitzer, Bemerkung,
Akku-/Schluesselnummern werden nie uebernommen. Verkaufte (Verkaufsdatum/Besitzer),
reservierte Raeder und Serviceraeder fallen raus. Nur exakt gleiche Raeder werden zu einem
Eintrag zusammengefasst (KEINE Stueckzahlen); andere Groesse/Rahmenform/Farbe bleibt eigenes Rad.
"""
import csv, io, json, re, sys, datetime

def lesen(pfad):
    roh = open(pfad, 'rb').read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            txt = roh.decode(enc); break
        except UnicodeDecodeError:
            continue
    zeilen = [z for z in txt.splitlines() if z.strip()][:6]
    trenner = max([';', ',', '\t'], key=lambda d: (len({z.count(d) for z in zeilen}) == 1, zeilen[0].count(d)))
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
        vd=f(r'verkaufsdatum'), bes=f(r'besitzer|eigent'),
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

def rahmenform(rf, dh, modell):
    t = f'{rf} {dh} {modell}'.lower()
    if re.search(r'wave|tief|damen|easy ?entry|low ?step|\bus\b|unisex', t): return 'Tiefeinsteiger'
    if re.search(r'trapez|mixte|\btz\b', t): return 'Trapez'
    if re.search(r'diamant|herren|\bh\b', t): return 'Diamant'
    return ''

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    ziel = sys.argv[2] if len(sys.argv) > 2 else 'data/bestand.json'
    kopf, rows = lesen(sys.argv[1])
    m = karte(kopf)
    if m['marke'] < 0 or m['modell'] < 0:
        sys.exit('Spalten Marke/Hersteller und Modell nicht gefunden – ist das der Fahrzeugbestand?')
    raeder, n_service, n_res, n_verk = [], 0, 0, 0
    for nr, r in enumerate(rows, 1):
        art = wert(r, m['zu'])
        if re.search(r'service', art, re.I): n_service += 1; continue
        if m['res'] >= 0 and ja(wert(r, m['res'])): n_res += 1; continue
        if wert(r, m['vd']) or wert(r, m['bes']): n_verk += 1; continue
        marke, modell = wert(r, m['marke']), wert(r, m['modell'])
        if not marke or not modell: continue
        zulauf = m['ang'] >= 0 and not wert(r, m['ang']) and (
            (m['lt'] < 0 and m['bd'] < 0) or bool(wert(r, m['lt'])) or bool(wert(r, m['bd'])))
        vk, ap = preis(wert(r, m['vk'])), preis(wert(r, m['ap']))
        raeder.append({k: v for k, v in dict(
            id=wert(r, m['id']) or str(nr), marke=marke, modell=modell, jahr=wert(r, m['jahr']),
            gr=wert(r, m['gr']), farbe=wert(r, m['farbe']),
            rahmen=rahmenform(wert(r, m['rf']), wert(r, m['dh']), modell),
            preis=vk, angebot=ap if ap and vk and ap < vk else None,
            status='bestellt' if zulauf else 'lager', ab=wert(r, m['lt']) if zulauf else '',
            gebraucht=bool(re.search(r'gebraucht', art, re.I)), vorfuehr=m['test'] >= 0 and ja(wert(r, m['test'])),
            motor=wert(r, m['motor']), akku=wert(r, m['akku']), schaltung=wert(r, m['schalt']),
        ).items() if v not in ('', None, False)})
    eindeutig = gruppieren(raeder)
    daten = dict(stand=datetime.date.today().strftime('%d.%m.%Y'), quelle='Veloport-Export', raeder=eindeutig)
    json.dump(daten, open(ziel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(raeder)} Räder -> {len(eindeutig)} verschiedene Räder -> {ziel} '
          f'(ausgelassen: {n_verk} verkauft, {n_res} reserviert, {n_service} Servicerad)')

FELDER = ('marke', 'modell', 'jahr', 'gr', 'farbe', 'rahmen', 'motor', 'akku', 'schaltung',
          'status', 'ab', 'preis', 'angebot', 'vorfuehr', 'gebraucht', 'id')

def gruppieren(raeder):
    """Nur EXAKT gleiche Raeder (Marke, Modell, Jahr, Groesse, Rahmenform, Farbe, Zustand) werden
    zu einem Eintrag – ohne Stueckzahl. Andere Groesse/Rahmenform/Farbe = eigenes Rad."""
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
        for k in ('motor', 'akku', 'schaltung'):
            if k in neu and k not in alt: alt[k] = neu[k]
    return sorted(gleich.values(), key=lambda r: (r['status'] != 'lager', r['marke'].lower(), r['modell'].lower(), r.get('gr', '')))

if __name__ == '__main__':
    main()
