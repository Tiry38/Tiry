#!/usr/bin/env python3
"""Laufband-Vorschau mit Umschalter 1·2·3 (Tiry 22.11.2026: „mit 1, 2, 3 durchklicken links … komplett von Rand zu Rand“).
Aufruf: python3 bauen.py <gebaute-live-index.html> <ziel-ordner>  → <ziel>/vorschau-baender/index.html
Grundlage: gebaute Live-Startseite (Herbstallee). Geändert wird NUR das Laufband oben. Auswahl per ?lb=1..3 oder Umschalter."""
import os, re, sys
D = os.path.dirname(os.path.abspath(__file__))
src, ziel = sys.argv[1], sys.argv[2]
rd = lambda n: open(os.path.join(D, n), encoding='utf-8').read()
TEILE = ['v1-seide', 'v2-licht', 'v3-magnet']
s = open(src, encoding='utf-8').read()
assert s.count('<meta name="robots" content="index,follow">') == 1
s = s.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">')
s = re.sub(r'<link rel="canonical"[^>]*>\n?', '', s)
i = s.index('<title>'); j = s.index('</title>') + 8
s = s[:i] + '<title>Vorschau Laufbänder 1–3</title>' + s[j:]
s = re.sub(r'''(["'(])(img/|fonts/|favicon\.png|apple-touch-icon\.png|google\.json)''', r'\1../\2', s)
k = s.rindex('</html>')
s = (s[:k] + '<style id="lbCss">\n' + ''.join(rd(t + '.css') for t in TEILE) + '</style>\n<script id="lbJs">\n' + rd('kern.js')
     + ''.join(rd(t + '.js') for t in TEILE) + 'LBV_START();\n</script>\n' + s[k:])
os.makedirs(os.path.join(ziel, 'vorschau-baender'), exist_ok=True)
open(os.path.join(ziel, 'vorschau-baender', 'index.html'), 'w', encoding='utf-8').write(s)
print('ok vorschau-baender', len(s.encode()) // 1024, 'KB')
