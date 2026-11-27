#!/usr/bin/env python3
"""Standbilder für den Seitenaufruf neu rechnen (Tiry 27.11.2026: „vom ersten Bild an die komplette Seite mit fertigem Hintergrund“).

Aufruf:  python3 standbild.py           (dauert ~10 Min., braucht Playwright/Chromium)
Nötig, wenn sich hg12.js (Shader/Szene/Kamera) oder die Herbstallee-Bilder ändern – live_hg12.py bricht sonst ab.
Ablauf: Homepage ohne Standbilder bauen → je Seite und Format das erste Shader-Bild auslesen → WebP (Qualität 90) nach img/p/."""
import os, sys, subprocess, tempfile, glob, shutil
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from live_hg12 import fingerabdruck
HP = os.path.abspath(os.path.join(D, '..', '..'))
with tempfile.TemporaryDirectory() as t:
    bau, roh = os.path.join(t, 'bau'), os.path.join(t, 'roh')
    subprocess.run([sys.executable, os.path.join(HP, 'tools', 'live_bauen.py'), bau], check=True, env=dict(os.environ, HG12_OHNE_STANDBILD='1'))
    subprocess.run(['node', os.path.join(D, 'standbild.js'), bau, roh], check=True)
    zi = os.path.join(D, 'img', 'p')
    shutil.rmtree(zi, ignore_errors=True); os.makedirs(zi)
    for f in sorted(glob.glob(os.path.join(roh, '*.rgba'))):
        n, wh = os.path.basename(f)[:-5].rsplit('_', 1); w, h = map(int, wh.split('x'))
        a = np.frombuffer(open(f, 'rb').read(), np.uint8).reshape(h, w, 4)[::-1, :, :3]
        Image.fromarray(a.copy()).save(os.path.join(zi, n + '.webp'), 'WEBP', quality=90, method=6)
    open(os.path.join(zi, 'stand.txt'), 'w').write(fingerabdruck() + '\n')
    print('Standbilder:', len(glob.glob(os.path.join(zi, '*.webp'))))
