# Schlaghagel 1.2 - Hagelsturm-Grafiken (eigene Zeichnung, weiss -> im Spiel eingefaerbt). Keine Kreise/Ringe:
#   hagel_cut    gerader Klingen-Schnitt (waagerecht, wird per SetRotation zum X gedreht)
#   hagel_spark  Treffer-Funke (Strahlenstern)
#   hagel_fall1/2 Hagelkoerner mit Fallspur (fallen schraeg nach unten, zwei Lagen)
#   hagel_speed  Tempo-Striche (zeigen nach rechts, links neben dem Symbol; rechts gespiegelt)
#   Leuchten: strom_glow (aus strom_media.py) wird mitbenutzt.
# Aufruf: python3 -I tools/hagel_media.py   (aus wow-addons/)
import math, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strom_media as S  # noqa: E402  (Helfer: save, to_alpha, OUT)

N, SS = S.N, S.SS
rng = np.random.default_rng(16257)   # eigener Zufall -> Strom-Grafiken bleiben unveraendert


def canvas():
    S2 = N * SS
    core, halo = Image.new("L", (S2, S2), 0), Image.new("L", (S2, S2), 0)
    return core, halo, ImageDraw.Draw(core), ImageDraw.Draw(halo)


def finish(core, halo, blur, k=0.85):
    halo = halo.filter(ImageFilter.GaussianBlur(blur * SS))
    return np.maximum(S.to_alpha(core), S.to_alpha(halo) * k)


def blade(dc, dh, x0, x1, y, th, peak=0.6, halo_k=1.0, val=255):
    """Spitz zulaufende Klinge von x0 nach x1 (Pixel), dickste Stelle bei peak."""
    top, bot = [], []
    for j in range(81):
        t = j / 80
        w = (t / peak) ** 0.7 if t < peak else ((1 - t) / (1 - peak)) ** 0.9
        x = x0 + (x1 - x0) * t
        top.append((x * SS, (y - th * w) * SS))
        bot.append((x * SS, (y + th * w * 0.55) * SS))
    poly = top + bot[::-1]
    dh.polygon(poly, fill=int(190 * halo_k))
    dc.polygon(poly, fill=val)


def cut():
    core, halo, dc, dh = canvas()
    y = N / 2
    blade(dc, dh, 0.06 * N, 0.94 * N, y, 0.030 * N, peak=0.62)
    blade(dc, dh, 0.22 * N, 0.80 * N, y + 0.045 * N, 0.008 * N, peak=0.55, halo_k=0.5, val=150)  # zweite Kante
    return finish(core, halo, 4.5)


def spark():
    core, halo, dc, dh = canvas()
    c = N / 2
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.12, 0.12)
        L = (0.40 if i % 2 == 0 else 0.22) * N * rng.uniform(0.8, 1.1)
        w = 0.022 * N if i % 2 == 0 else 0.014 * N
        tip = (c + math.cos(a) * L, c + math.sin(a) * L)
        l = (c + math.cos(a + math.pi / 2) * w, c + math.sin(a + math.pi / 2) * w)
        r = (c + math.cos(a - math.pi / 2) * w, c + math.sin(a - math.pi / 2) * w)
        poly = [(x * SS, y * SS) for x, y in (tip, l, r)]
        dh.polygon(poly, fill=200)
        dc.polygon(poly, fill=255)
    return finish(core, halo, 3.0)


def fall(seed_shift):
    core, halo, dc, dh = canvas()
    ang = math.radians(12)                 # Fallrichtung: nach unten, leicht nach rechts
    dx, dy = math.sin(ang), math.cos(ang)
    pts = []
    tries = 0
    while len(pts) < 22 and tries < 2000:  # gleichmaessig verteilt, nicht zu dicht
        tries += 1
        x, y = rng.uniform(0.06, 0.94) * N, rng.uniform(0.10, 0.94) * N
        if all((x - a) ** 2 + (y - b) ** 2 > (0.12 * N) ** 2 for a, b in pts):
            pts.append((x, y))
    for x, y in pts:
        size = rng.uniform(0.010, 0.020) * N
        L = rng.uniform(0.07, 0.14) * N
        tail = (x - dx * L, y - dy * L)
        for j in range(12):                # Fallspur: blass -> hell
            t0, t1 = j / 12, (j + 1) / 12
            p = (tail[0] + (x - tail[0]) * t0, tail[1] + (y - tail[1]) * t0)
            q = (tail[0] + (x - tail[0]) * t1, tail[1] + (y - tail[1]) * t1)
            k = t1 ** 1.5
            dc.line([(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)], fill=int(170 * k), width=max(1, int(size * 0.7 * SS)))
            dh.line([(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)], fill=int(110 * k), width=int(size * 2.2 * SS))
        # Hagelkorn: kleiner, kantiger Eiskristall (Raute)
        poly = [(x, y - size), (x + size * 0.8, y), (x, y + size * 1.1), (x - size * 0.8, y)]
        dh.polygon([(a * SS, b * SS) for a, b in poly], fill=220)
        dc.polygon([(a * SS, b * SS) for a, b in poly], fill=255)
    return finish(core, halo, 2.4)


def speed():
    core, halo, dc, dh = canvas()
    for y, x0, k in ((0.30, 0.30, 0.7), (0.39, 0.12, 1.0), (0.47, 0.40, 0.6), (0.55, 0.06, 1.0),
                     (0.63, 0.34, 0.7), (0.71, 0.18, 0.85)):
        blade(dc, dh, x0 * N, 0.94 * N, y * N, 0.010 * N, peak=0.85, halo_k=k * 0.7, val=int(255 * k))
    return finish(core, halo, 2.8)


if __name__ == "__main__":
    os.makedirs(S.OUT, exist_ok=True)
    S.save(cut(), "hagel_cut")
    S.save(spark(), "hagel_spark")
    S.save(fall(0), "hagel_fall1")
    S.save(fall(1), "hagel_fall2")
    S.save(speed(), "hagel_speed")
    print("Hagel-Grafiken ->", S.OUT)
