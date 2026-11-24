#!/usr/bin/env python3
"""Showroom-Verwandlung: Partikel vorrechnen (Tiry 24.11.2026: „beides ja“ – Leistung sparen, gleiche Optik).

Aufruf:  python3 partikel.py <live-ordner>      (von tools/live_bauen.py nach live_hg12.py)
Bisher zerlegte jedes Gerät bei JEDEM Radwechsel Rad + Logo per getImageData in Partikel (gemessen 150 ms am PC, ~400 ms
bei 4-fach gebremster CPU = Ruckler am Anfang der Verwandlung). Jetzt: je Bild einmal beim Bauen eine kleine Datei
img/pt/<ordner>~<name>.bin = gemischte Punkte (gleiche Regel wie points() in vmorph-laub.js: deckende Zellen, Alpha > 140,
Zufallsversatz in der Zelle), je Punkt u16 x, u16 y (0..65535 im Bildrechteck) + RGB. Das Gerät liest nur noch N Punkte.
Räder (img/show, img/bestand/a-*) rechnet dieser Bau jedes Mal neu (feste Zufallszahl je Datei = gleiche Dateien, kein Git-Rauschen).
Markenlogos (SVG) liegen fertig in pt/ (erzeugt mit pt_logos.js im Browser); passt die SVG nicht mehr zur Prüfsumme,
wird das Logo ausgelassen – dann rechnet das Gerät wie früher selbst (nichts geht kaputt)."""
import os, sys, json, random, struct, hashlib, shutil
from PIL import Image

ZIEL = sys.argv[1]
D = os.path.dirname(os.path.abspath(__file__))
NMAX, GRID = 1800, 400
VAR = {'400', '480', '640', '960', '600', '900', '1200'}


def punkte(pfad, nmax=NMAX, grid=GRID, seed=''):
    im = Image.open(pfad).convert('RGBA')
    k = grid / max(im.size)
    cw, ch = max(2, round(im.width * k)), max(2, round(im.height * k))
    px = im.resize((cw, ch), Image.BOX).load()
    rnd = random.Random(seed or os.path.basename(pfad))
    P = []
    for j in range(ch):
        for i in range(cw):
            r, g, b, a = px[i, j]
            if a > 140:
                P.append(((i + .2 + rnd.random() * .6) / cw, (j + .2 + rnd.random() * .6) / ch, r, g, b))
    if not P:
        P = [(.5, .5, 128, 128, 128)]
    rnd.shuffle(P)
    out = P[:nmax] if len(P) >= nmax else [P[rnd.randrange(len(P))] for _ in range(nmax)]
    return b''.join(struct.pack('<HHBBB', min(65535, int(u * 65535)), min(65535, int(v * 65535)), r, g, b) for u, v, r, g, b in out)


def main():
    pt = os.path.join(ZIEL, 'img', 'pt')
    os.makedirs(pt, exist_ok=True)
    n = 0
    for ordner, nur in (('show', ''), ('bestand', 'a-')):
        q = os.path.join(ZIEL, 'img', ordner)
        if not os.path.isdir(q):
            continue
        for f in sorted(os.listdir(q)):
            stem, ext = os.path.splitext(f)
            if ext != '.webp' or not f.startswith(nur):
                continue
            a, _, b = stem.rpartition('-')
            if b in VAR and os.path.exists(os.path.join(q, a + '.webp')):
                continue  # kleinere Variante desselben Bildes
            open(os.path.join(pt, ordner + '~' + stem + '.bin'), 'wb').write(punkte(os.path.join(q, f)))
            n += 1
    # Markenlogos: nur wenn die SVG noch dieselbe ist
    L = json.load(open(os.path.join(D, 'pt', 'logos.json'), encoding='utf-8'))
    m = 0
    for svg, h in L.items():
        s = os.path.join(ZIEL, 'img', svg)
        if os.path.exists(s) and hashlib.sha256(open(s, 'rb').read()).hexdigest()[:16] == h:
            shutil.copy2(os.path.join(D, 'pt', os.path.splitext(svg)[0] + '.bin'), os.path.join(pt, os.path.splitext(svg)[0] + '.bin'))
            m += 1
        else:
            print('partikel: Logo geändert, rechnet am Gerät:', svg)
    print('partikel:', n, 'Räder,', m, 'Logos,', sum(os.path.getsize(os.path.join(pt, x)) for x in os.listdir(pt)) // 1024, 'KB')


if __name__ == '__main__':
    main()
