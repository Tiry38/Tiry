#!/usr/bin/env python3
"""Baut die 3 Laufband-Vorschauen (Tiry 22.11.2026: „nur den Durchlaufbanner oben anders designen … 2060 … Rot muss drin sein“).
Aufruf: python3 bauen.py <gebaute-live-index.html> <ziel-ordner>   → <ziel>/vorschau-laufband-1..3/index.html
Grundlage ist die gebaute Live-Startseite (Herbstallee); geändert wird NUR das Laufband oben."""
import os, re, sys
D = os.path.dirname(os.path.abspath(__file__))
src, ziel = sys.argv[1], sys.argv[2]
s0 = open(src, encoding='utf-8').read()
rd = lambda n: open(os.path.join(D, n), encoding='utf-8').read()
NAMEN = {1: 'Glas-Kapsel', 2: 'Mikro-LED-Wand', 3: 'Rot-Metall'}
for n, name in NAMEN.items():
    s = s0
    assert s.count('<meta name="robots" content="index,follow">') == 1
    s = s.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">')
    s = re.sub(r'<link rel="canonical"[^>]*>\n?', '', s)
    i = s.index('<title>'); j = s.index('</title>') + 8
    s = s[:i] + '<title>Vorschau Laufband %d · %s</title>' % (n, name) + s[j:]
    s = re.sub(r'''(["'(])(img/|fonts/|favicon\.png|apple-touch-icon\.png|google\.json)''', r'\1../\2', s)
    k = s.rindex('</html>')
    s = (s[:k] + '<style id="lbCss">\n' + rd('lb%d.css' % n) + '</style>\n<script id="lbJs">\n' + rd('gemeinsam.js') + rd('lb%d.js' % n)
         + '</script>\n' + s[k:])
    os.makedirs(os.path.join(ziel, 'vorschau-laufband-%d' % n), exist_ok=True)
    open(os.path.join(ziel, 'vorschau-laufband-%d' % n, 'index.html'), 'w', encoding='utf-8').write(s)
    print('ok', n, name, len(s.encode()) // 1024, 'KB')
