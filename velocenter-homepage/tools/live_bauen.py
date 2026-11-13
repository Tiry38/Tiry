#!/usr/bin/env python3
"""Baut aus dem Prototyp (index.html) die fertige Live-Fassung für www.velo-center.de.

Aufruf (im Ordner velocenter-homepage):  python3 tools/live_bauen.py [Zielordner]
Standard-Ziel: ../velocenter-homepage-live  (wird komplett neu geschrieben)

Der Prototyp bleibt unverändert. Die Live-Fassung:
- hat vollständigen HTML-Kopf (doctype, Sprache, Zeichensatz, viewport, Favicon, Vorschaubild),
- wird von Google gefunden (kein noindex mehr),
- hat keinen Prototyp-Knopf, keine Seite „Prototyp-Infos“ und keinen Admin-Zugang (#admin braucht claude.ai),
- enthält nur die Bilder, die die Seite wirklich benutzt,
- bringt CNAME, robots.txt, sitemap.xml, 404.html und Weiterleitungen der alten Coco-Adressen mit.
"""
import json, os, re, shutil, sys, datetime

QUELLE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(os.path.dirname(QUELLE), 'velocenter-homepage-live')
DOMAIN = 'www.velo-center.de'
BASIS = 'https://' + DOMAIN + '/'

# alte Adressen der Coco-Seite -> neue Bereiche
ALT = {
    'service': 'service', 'hersteller': 'marken', 'isy-experte': 'isy', 'isy-treffen': 'treffen',
    'e-dreiraeder': 'dreirad', 'kontakt': 'kontakt', 'impressum': 'impressum', 'datenschutz': 'datenschutz',
    'velocenter': 'start', 'blog': 'start', 'legal/imprint': 'impressum', 'legal/privacy': 'datenschutz',
    'legal/accessibility': 'impressum',
}


def ersetze(s, alt, neu, anzahl=1):
    n = s.count(alt)
    if n != anzahl:
        sys.exit(f'Stelle nicht eindeutig ({n}x statt {anzahl}x): {alt[:80]}')
    return s.replace(alt, neu)


def block_raus(s, start, ende):
    """Entfernt von start (inkl.) bis zum ersten ende danach (inkl.)."""
    i = s.find(start)
    if i < 0:
        sys.exit('Nicht gefunden: ' + start[:80])
    j = s.find(ende, i)
    if j < 0:
        sys.exit('Ende nicht gefunden: ' + ende[:80])
    return s[:i] + s[j + len(ende):]


def section_raus(s, kopf):
    """Entfernt eine <section …> samt verschachtelter <section>-Blöcke."""
    i = s.find(kopf)
    if i < 0:
        sys.exit('Bereich nicht gefunden: ' + kopf)
    tiefe, k = 0, i
    for m in re.finditer(r'<section\b|</section>', s[i:]):
        tiefe += 1 if m.group(0) == '<section' else -1
        if tiefe == 0:
            k = i + m.end()
            break
    while k < len(s) and s[k] == '\n':
        k += 1
    return s[:i] + s[k:]


def firebase_config():
    """Öffentliche Web-Konfiguration aus der Firebase-Konsole (kein Geheimnis). Ohne Datei: kein Admin-Bereich."""
    q = os.path.join(QUELLE, 'live', 'firebase.json')
    if not os.path.isfile(q):
        return None
    d = json.load(open(q, encoding='utf-8'))
    if not d.get('projectId') or not d.get('apiKey'):
        return None
    return {k: d[k] for k in ('apiKey', 'authDomain', 'projectId', 'appId') if d.get(k)}


def html_bauen():
    s = open(os.path.join(QUELLE, 'index.html'), encoding='utf-8').read()
    # Prototyp-Kopf
    s = ersetze(s, '<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    s = ersetze(s, '<!-- Prototyp: noindex vor dem Livegang entfernen -->\n<meta name="robots" content="noindex">\n',
                '<meta name="robots" content="index,follow">\n')
    s = ersetze(s, '<title>', '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
                '<meta name="theme-color" content="#C8102E">\n'
                '<link rel="icon" href="favicon.png" type="image/png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
                f'<meta property="og:image" content="{BASIS}og-bild.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
                f'<meta property="og:url" content="{BASIS}"><meta name="twitter:card" content="summary_large_image">\n<title>')
    # Prototyp-Knopf, Footer-Link, Seite „Prototyp-Infos“
    s = block_raus(s, '<a class="proto" href="#warum">', '</a>\n')
    s = ersetze(s, '<a href="#warum">Prototyp-Infos</a>', '')
    s = section_raus(s, '<section class="view" data-v="warum"')
    s = ersetze(s, ",'datenschutz','warum'];", ",'datenschutz'];")
    # Admin: kein versteckter 5-Klick; Zugang nur über /admin mit Firebase-Anmeldung
    s = ersetze(s, "if(n>=5){n=0;admOpen()}", "if(n>=5){n=0}")
    fb = firebase_config()
    if fb:
        s = ersetze(s, 'const FBC=null;/*FBCFG*/', 'const FBC=' + json.dumps(fb, separators=(',', ':')) + ';')
    else:
        print('Hinweis: live/firebase.json fehlt – Live-Seite ohne Admin-Bereich.')
        s = ersetze(s, "function admHash(){if(location.hash==='#admin')admOpen()}", 'function admHash(){}')
    # Datenschutz: Entwurfs-Hinweis raus, Hosting eintragen
    s = re.sub(r'<p[^>]*>\s*Entwurf für den Prototyp\.[^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*</p>\s*', '', s, count=1)
    m = re.search(r'\[Wird beim Livegang ergänzt:[^\]]*\]', s)
    if not m:
        sys.exit('Hosting-Platzhalter in der Datenschutzerklärung nicht gefunden')
    s = s[:m.start()] + (
        'Diese Seite liegt bei GitHub Pages, einem Dienst der GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. '
        'Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Seite und Angaben zum Browser, '
        'um die Seite auszuliefern und vor Angriffen zu schützen. Eine Übermittlung in die USA ist möglich; GitHub ist nach dem EU-US Data Privacy Framework zertifiziert. '
        'Wir selbst bekommen diese Protokolle nicht und werten nichts aus.'
        + (' Unsere aktuellen Angebote und Bewertungen lädt die Seite aus Google Firebase (Cloud Firestore), einem Dienst der Google Ireland Limited, '
           'Gordon House, Barrow Street, Dublin 4, Irland. Dabei wird deine IP-Adresse an Google übermittelt; eine Übermittlung in die USA ist möglich, '
           'Google ist nach dem EU-US Data Privacy Framework zertifiziert. Es werden dabei keine Cookies gesetzt und keine Nutzerprofile gebildet.' if firebase_config() else '')
        ) + s[m.end():]
    s = s.replace('Stand: Entwurf, November 2026.', 'Stand: ' + datetime.date.today().strftime('%m/%Y').replace('/', '.') + '.')
    if 'Entwurf' in s[s.find('data-v="datenschutz"'):s.find('data-v="datenschutz"') + 20000]:
        print('Hinweis: im Datenschutz steht noch „Entwurf“.')
    for rest in ('Prototyp', 'noindex', 'claude:'):
        for m in re.finditer(rest, s):
            print('Hinweis: noch „%s“ bei …%s…' % (rest, s[max(0, m.start() - 60):m.start() + 40].replace('\n', ' ')))
    return s + '\n</html>\n'


def bilder(s):
    """Alle Dateien, die die Seite benutzt (fest im Text, aus dem Bestand und aus den Bild-Listen im Skript)."""
    n = set(re.findall(r'(?:img|fonts)/[A-Za-z0-9_./-]+\.(?:webp|svg|png|jpe?g|woff2)', s))
    m = re.search(r'const SHOWOK=new Set\((\[[^\]]*\])\)', s)
    n |= {'img/show/' + f for f in json.loads(m.group(1))}
    m = re.search(r'<script type="application/json" id="bestandData">(.*?)</script>', s, re.S)
    d = json.loads(m.group(1).replace('<\\/', '</'))
    for r in d['raeder']:
        for v in r.get('farben', []):
            if v.get('bild'):
                n.add(v['bild'])
    for id_ in re.findall(r"\['[^']*','([A-Za-z0-9_-]{11})'", s):
        n.add('img/treffen/yt-' + id_ + '.webp')
    for f in re.findall(r"\['[^']+','([a-z.]+\.(?:svg|webp))'\]", s):
        n.add('img/zub-' + f)
    # ganze Ordner, deren Namen das Skript zusammensetzt
    for ordner in ('img/treffen', 'img/dreirad'):
        for f in os.listdir(os.path.join(QUELLE, ordner)):
            n.add(ordner + '/' + f)
    return sorted(x for x in n if os.path.isfile(os.path.join(QUELLE, x)))


def weiterleitung(ziel_hash, tiefe=1):
    url = BASIS + ('#' + ziel_hash if ziel_hash != 'start' else '')
    rel = '../' * tiefe + ('#' + ziel_hash if ziel_hash != 'start' else '')
    return ('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Velocenter Hessert</title>'
            f'<link rel="canonical" href="{url}"><meta name="robots" content="noindex">'
            f'<meta http-equiv="refresh" content="0;url={rel}"></head>'
            f'<body><a href="{rel}">Weiter zu Velocenter Hessert</a></body></html>\n')


def main():
    s = html_bauen()
    if os.path.isdir(ZIEL):
        shutil.rmtree(ZIEL)
    os.makedirs(ZIEL)
    open(os.path.join(ZIEL, 'index.html'), 'w', encoding='utf-8').write(s)
    dateien = bilder(s)
    for f in dateien:
        os.makedirs(os.path.dirname(os.path.join(ZIEL, f)), exist_ok=True)
        shutil.copy2(os.path.join(QUELLE, f), os.path.join(ZIEL, f))
    for f in ('favicon.png', 'apple-touch-icon.png', 'og-bild.jpg'):
        q = os.path.join(QUELLE, 'live', f)
        if os.path.isfile(q):
            shutil.copy2(q, os.path.join(ZIEL, f))
        else:
            print('Hinweis: live/' + f + ' fehlt')
    open(os.path.join(ZIEL, 'CNAME'), 'w').write(DOMAIN + '\n')
    open(os.path.join(ZIEL, '.nojekyll'), 'w').write('')
    open(os.path.join(ZIEL, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {BASIS}sitemap.xml\n')
    heute = datetime.date.today().isoformat()
    open(os.path.join(ZIEL, 'sitemap.xml'), 'w').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'<url><loc>{BASIS}</loc><lastmod>{heute}</lastmod></url>\n</urlset>\n')
    for alt, neu in ALT.items():
        os.makedirs(os.path.join(ZIEL, alt), exist_ok=True)
        open(os.path.join(ZIEL, alt, 'index.html'), 'w', encoding='utf-8').write(weiterleitung(neu, alt.count('/') + 1))
    if firebase_config():
        os.makedirs(os.path.join(ZIEL, 'admin'), exist_ok=True)
        open(os.path.join(ZIEL, 'admin', 'index.html'), 'w', encoding='utf-8').write(weiterleitung('admin'))
    open(os.path.join(ZIEL, '404.html'), 'w', encoding='utf-8').write(
        '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Velocenter Hessert</title><meta name="robots" content="noindex">'
        f'<meta http-equiv="refresh" content="0;url={BASIS}"></head><body><a href="{BASIS}">Weiter zu Velocenter Hessert</a></body></html>\n')
    groesse = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(ZIEL) for f in fs)
    print(f'Live-Fassung: {ZIEL}  ·  {len(dateien)} Bilder/Schriften  ·  {groesse / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
