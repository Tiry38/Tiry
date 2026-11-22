#!/usr/bin/env python3
"""Laufband „Klarlack & Tiefe“ live (Tiry 22.11.2026: „setze Nummer 2 um in live“).
Aufruf: python3 live_band.py <live-ordner>   (von tools/live_bauen.py nach live_hg12.py aufgerufen)
Hängt z2.css an jede gebaute Seite mit Laufband an (Selektor html.lbv2 → html:root, gleiche Spezifität, kein Umschalter)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
ZIEL = sys.argv[1]
CSS = open(os.path.join(D, 'z2.css'), encoding='utf-8').read().replace('html.lbv2', 'html:root')
assert 'lbv' not in CSS
n = 0
for root, _, files in os.walk(ZIEL):
    if '.git' in root or 'vorschau' in root:
        continue
    for f in files:
        if f != 'index.html':
            continue
        p = os.path.join(root, f)
        s = open(p, encoding='utf-8').read()
        if 'class="bands top"' not in s:
            continue
        assert 'id="bandKlarlack"' not in s, p + ': schon eingebaut'
        k = s.rindex('</html>')
        s = s[:k] + '<style id="bandKlarlack">\n' + CSS + '</style>\n' + s[k:]
        open(p, 'w', encoding='utf-8').write(s)
        n += 1
        print('band:', os.path.relpath(p, ZIEL))
assert n >= 1, 'keine Seite mit Laufband gefunden'
