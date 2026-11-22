#!/usr/bin/env python3
"""Hintergrund „Herbstallee“ live (Tiry 22.11.2026: „so ist es nice … setze das alles genauso live auf die Homepage“).

Aufruf:  python3 live_hg12.py <live-ordner>      (von tools/live_bauen.py nach plus_design() aufgerufen)
Legt auf alle gebauten Seiten genau den Stand von Vorschau „Landschaften 3“:
  - hg12-Hintergrund NUR Herbstallee (HG12_FEST, kein Umschalter, Tiry 22.11.2026: „nur diese eine Vorlage“), nasse Straße beim Scrollen,
    Laub folgt dem Scrollen, kein Klick-Ring, kein Scan
  - Showroom-Verwandlung mit Blättern (vmorph-laub.js ersetzt den vMorphJs-Block)
  - Handy-Kopf: Öffnungsstatus, A+, roter Burger; Laufband auf dem Handy sichtbar (hgmob.css)
Bilder: img/hg12/ (Unsplash-Lizenz, siehe QUELLEN.md). Unterseiten haben <base href="../">, deshalb gilt img/hg12/ überall.
Bricht laut ab, wenn sich die Quelle geändert hat (dann geht nichts live)."""
import os, sys, shutil, hashlib

D = os.path.dirname(os.path.abspath(__file__))
ZIEL = sys.argv[1]
SEITEN = ['index.html'] + [d + '/index.html' for d in ('service', 'hersteller', 'lager', 'isy-experte', 'isy-treffen',
                                                       'e-dreiraeder', 'kontakt', 'impressum', 'datenschutz')]
# Hash des vMorphJs-Blocks, auf dem vmorph-laub.js aufbaut. Ändert sich der Block im Prototyp,
# muss vmorph-laub.js nachgezogen werden (sonst würde die Änderung still überschrieben).
MORPH_BASIS = '955d9b7f6c01b62a'

rd = lambda n: open(os.path.join(D, n), encoding='utf-8').read()
CSS, JS, MORPH, MOB = rd('hg12.css'), rd('hg12.js'), rd('vmorph-laub.js'), rd('hgmob.css')

for sp in SEITEN:
    p = os.path.join(ZIEL, sp)
    s = open(p, encoding='utf-8').read()
    assert 'id="vHg"' not in s, sp + ': schon eingebaut'
    o = '<script id="vMorphJs">'
    a = s.index(o) + len(o)
    b = s.index('</script>', a)
    h = hashlib.sha256(s[a:b].encode()).hexdigest()[:16]
    assert h == MORPH_BASIS, (sp, 'vMorphJs im Prototyp geändert – vmorph-laub.js nachziehen', h)
    s = s[:a] + MORPH + s[b:]
    i = s.index('</style>') + len('</style>')
    s = s[:i] + '\n<style id="vHg">\n' + CSS + '</style>\n<script>document.documentElement.classList.add("hg3")</script>' + s[i:]
    k = s.rindex('</html>')
    s = (s[:k] + '<script id="vHg11Js">window.HG12_FEST=\'herbst\';\n' + JS + '</script>\n'
         + '<style id="hgMobKopf">' + MOB + '</style>\n' + s[k:])
    open(p, 'w', encoding='utf-8').write(s)
    print('hg12:', sp, len(s.encode()) // 1024, 'KB')

zi = os.path.join(ZIEL, 'img', 'hg12')
os.makedirs(zi, exist_ok=True)
for f in sorted(os.listdir(os.path.join(D, 'img'))):
    if not f.startswith('herbst'):
        continue  # nur die Herbstallee ist live
    shutil.copy2(os.path.join(D, 'img', f), os.path.join(zi, f))
print('hg12: Bilder', len(os.listdir(zi)))
