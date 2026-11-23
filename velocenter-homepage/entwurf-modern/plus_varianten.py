#!/usr/bin/env python3
"""Kleine WebP-Varianten für die Vorlage „plus“ (Punkt 4 Bilder).
Aufruf: python3 plus_varianten.py <img-ordner> [<img-ordner> ...]
Erzeugt neben jedem Quellbild <name>-<breite>.webp (Alpha bleibt erhalten, Qualität 82).
Überspringt Varianten, die schon existieren und neuer als die Quelle sind. Nie hochskalieren."""
import os, sys, re
from multiprocessing import Pool
from PIL import Image

# Muster (relativ zum img-Ordner) -> Breiten
REGELN = [
    (r'^p-[a-z0-9-]+\.webp$', (600, 900, 1200)),        # freigestellte Räder (Kopf, Showroom)
    (r'^show/[a-z0-9-]+\.webp$', (480, 960)),            # Showroom-/Kopf-Pool
    (r'^bestand/[A-Za-z0-9_-]+\.webp$', (400, 640)),      # Lager-Karten, Schnellzugriff
    (r'^(laden-innen|laden-eingang|isy-ausstellung|treffen-luft)\.webp$', (640, 960)),
    (r'^sattelueberzug\.webp$', (560,)),
    (r'^fassade\.webp$', (640,)),
]
VAR = re.compile(r'-(\d{3,4})\.webp$')

def jobs(root):
    for dp, _, fs in os.walk(root):
        for f in fs:
            rel = os.path.relpath(os.path.join(dp, f), root).replace(os.sep, '/')
            if VAR.search(rel):
                continue
            for pat, ws in REGELN:
                if re.match(pat, rel):
                    for w in ws:
                        yield (os.path.join(root, rel), w)

def mach(job):
    src, w = job
    dst = src[:-5] + '-%d.webp' % w
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return 0
    im = Image.open(src)
    if im.width <= w:
        return 0
    im.load()
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.mode or 'transparency' in im.info else 'RGB')
    h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(dst, 'WEBP', quality=82, method=6, alpha_quality=90)
    return 1

if __name__ == '__main__':
    J = [j for r in sys.argv[1:] for j in jobs(r)]
    with Pool() as p:
        n = sum(p.map(mach, J, chunksize=4))
    print('Varianten neu:', n, 'von', len(J))
