# Schlaghagel 1.4 - Blitzsturm-Grafiken fuer Waffe des Mahlstroms, im Stil des Hagelsturms (keine Kreise/Ringe).
#   blitz_slash   zackiger Blitz-Schnitt (waagerecht, spitz zulaufend, kleine Gabelungen; per SetRotation gedreht)
#   blitz_rise1/2 elektrische Funken mit Spur, steigen nach oben (zwei Lagen)
#   Mitbenutzt: hagel_spark (Treffer-Funke/Explosion), hagel_speed (Tempo-Striche), strom_glow (Leuchten).
# Aufruf: python3 -I tools/blitz_media.py   (aus wow-addons/)
import math, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strom_media as S  # noqa: E402

N, SS = S.N, S.SS
rng = np.random.default_rng(408505 + 14)
S.rng = rng                          # jag() nutzt den Zufall aus strom_media


def canvas():
    S2 = N * SS
    core, halo = Image.new("L", (S2, S2), 0), Image.new("L", (S2, S2), 0)
    return core, halo, ImageDraw.Draw(core), ImageDraw.Draw(halo)


def finish(core, halo, blur, k=0.85):
    halo = halo.filter(ImageFilter.GaussianBlur(blur * SS))
    return np.maximum(S.to_alpha(core), S.to_alpha(halo) * k)


def stroke(dc, dh, pts, th, peak, val=255, halo_k=1.0):
    """Zackige Linie mit spitz zulaufender Dicke (wie die Klinge im Hagelsturm)."""
    n = len(pts) - 1
    for i in range(n):
        t = (i + 0.5) / n
        w = (t / peak) ** 0.6 if t < peak else ((1 - t) / (1 - peak)) ** 0.8
        p, q = pts[i], pts[i + 1]
        seg = [(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)]
        dh.line(seg, fill=int(200 * halo_k), width=max(1, int(th * 3.2 * w * SS)), joint="curve")
        dc.line(seg, fill=val, width=max(1, int(th * w * SS)), joint="curve")


def slash():
    core, halo, dc, dh = canvas()
    y = N / 2
    main = S.jag((0.05 * N, y), (0.95 * N, y + rng.uniform(-3, 3)), 6, 0.075)
    stroke(dc, dh, main, 0.034 * N, 0.60)
    for _ in range(4):                                  # kurze Gabelungen
        i = int(rng.uniform(0.25, 0.80) * len(main))
        a = main[i]
        side = rng.choice([-1, 1])
        L = rng.uniform(0.07, 0.13) * N
        b = a + np.array([rng.uniform(0.4, 0.9) * L, side * L])
        stroke(dc, dh, S.jag(a, b, 3, 0.20), 0.012 * N, 0.25, val=200, halo_k=0.6)
    return finish(core, halo, 4.0)


def rise():
    """Funken steigen nach oben: heller Kern oben, Spur nach unten, leicht zackig."""
    core, halo, dc, dh = canvas()
    pts, tries = [], 0
    while len(pts) < 20 and tries < 2000:
        tries += 1
        x, y = rng.uniform(0.06, 0.94) * N, rng.uniform(0.06, 0.88) * N
        if all((x - a) ** 2 + (y - b) ** 2 > (0.12 * N) ** 2 for a, b in pts):
            pts.append((x, y))
    for x, y in pts:
        size = rng.uniform(0.010, 0.018) * N
        L = rng.uniform(0.07, 0.13) * N
        trail = S.jag((x, y + L), (x + rng.uniform(-4, 4), y), 3, 0.18)
        k = len(trail) - 1
        for j in range(k):                               # Spur: blass unten -> hell oben
            t = (j + 1) / k
            p, q = trail[j], trail[j + 1]
            seg = [(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)]
            dc.line(seg, fill=int(180 * t ** 1.4), width=max(1, int(size * 0.6 * SS)))
            dh.line(seg, fill=int(110 * t ** 1.4), width=int(size * 2.2 * SS))
        # Funke: kleiner Vierstrahl-Stern
        for ang in (0, math.pi / 2):
            for sgn in (1, -1):
                tip = (x + math.cos(ang) * size * 1.8 * sgn, y + math.sin(ang) * size * 1.8 * sgn)
                l = (x + math.cos(ang + math.pi / 2) * size * 0.35, y + math.sin(ang + math.pi / 2) * size * 0.35)
                r = (x - math.cos(ang + math.pi / 2) * size * 0.35, y - math.sin(ang + math.pi / 2) * size * 0.35)
                poly = [(a * SS, b * SS) for a, b in (tip, l, r)]
                dh.polygon(poly, fill=220)
                dc.polygon(poly, fill=255)
    return finish(core, halo, 2.4)


if __name__ == "__main__":
    os.makedirs(S.OUT, exist_ok=True)
    S.save(slash(), "blitz_slash")
    S.save(rise(), "blitz_rise1")
    S.save(rise(), "blitz_rise2")
    print("Blitzsturm-Grafiken ->", S.OUT)
