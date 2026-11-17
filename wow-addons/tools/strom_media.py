# Schlaghagel 1.1 - Strom-Grafiken fuer die Mahlstrom-Anzeige (eigene Zeichnung, weiss -> im Spiel eingefaerbt).
#   strom_glow   weiches rundes Leuchten
#   strom_plasma Energie-Ring mit Turbulenz (dreht langsam)
#   strom_arc1/2 zackige Blitzboegen rund um das Symbol (drehen gegenlaeufig, flackern)
#   strom_bolt1-3 Blitz mit Gabelung, zeigt von der Mitte nach oben (wird per SetRotation verteilt)
# Aufruf: python3 -I tools/strom_media.py   (aus wow-addons/)
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "addons", "Schlaghagel", "Media")
N = 256          # Zielgroesse
SS = 4           # Supersampling
rng = np.random.default_rng(408505)


def save(arr, name):
    """arr = Alpha 0..1 (weiss). TGA mit RGB weiss, Alpha = Form."""
    a = np.clip(arr, 0, 1)
    img = Image.fromarray(np.uint8(np.dstack([np.full_like(a, 255)] * 3 + [a * 255])), "RGBA")
    img.save(os.path.join(OUT, name + ".tga"))


def to_alpha(big):
    return np.asarray(big.resize((N, N), Image.LANCZOS), dtype=np.float32) / 255.0


def jag(p0, p1, depth, rough):
    """Mittelpunkt-Verschiebung: zackige Linie von p0 nach p1."""
    pts = [np.array(p0, float), np.array(p1, float)]
    for d in range(depth):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            m = (a + b) / 2
            v = b - a
            nrm = np.array([-v[1], v[0]]) / (np.linalg.norm(v) + 1e-9)
            m = m + nrm * rng.normal(0, rough * np.linalg.norm(v))
            new += [m, b]
        pts = new
    return pts


def draw_lines(lines, core_w, halo_w, halo_blur):
    """lines = [(punkte, staerke)] -> Alpha mit hellem Kern + weichem Halo."""
    S = N * SS
    core = Image.new("L", (S, S), 0)
    halo = Image.new("L", (S, S), 0)
    dc, dh = ImageDraw.Draw(core), ImageDraw.Draw(halo)
    for pts, k in lines:
        xy = [tuple(p * SS) for p in pts]
        dh.line(xy, fill=int(150 * k), width=max(1, int(halo_w * SS * k)), joint="curve")
        dc.line(xy, fill=int(255 * k), width=max(1, int(core_w * SS * max(0.5, k))), joint="curve")
    halo = halo.filter(ImageFilter.GaussianBlur(halo_blur * SS))
    a = np.maximum(to_alpha(core), to_alpha(halo) * 0.85)
    return a


def polar(r, ang):  # ang 0 = oben, im Uhrzeigersinn; r in Pixeln (N-Raster)
    return (N / 2 + r * math.sin(ang), N / 2 - r * math.cos(ang))


def arc(seed_off, n_seg, r, span):
    lines = []
    for i in range(n_seg):
        a0 = i * 2 * math.pi / n_seg + rng.uniform(-0.25, 0.25) + seed_off
        a1 = a0 + span * rng.uniform(0.75, 1.15)
        # Bogen als Polylinie, dann zackig
        k = 7
        base = [polar(r + rng.normal(0, 2.5), a0 + (a1 - a0) * j / k) for j in range(k + 1)]
        pts = []
        for p, q in zip(base[:-1], base[1:]):
            seg = jag(p, q, 3, 0.22)
            pts += seg[:-1]
        pts.append(np.array(base[-1]))
        lines.append((pts, 1.0))
        # kleine Ausreisser nach aussen/innen
        for _ in range(2):
            t = rng.uniform(0.2, 0.8)
            am = a0 + (a1 - a0) * t
            p = polar(r, am)
            q = polar(r + rng.choice([-1, 1]) * rng.uniform(10, 22), am + rng.uniform(-0.15, 0.15))
            lines.append((jag(p, q, 3, 0.3), 0.6))
    return draw_lines(lines, 2.2, 9, 3.0)


def bolt(seed_extra):
    r0, r1 = 0.20 * N, 0.48 * N          # Textur = 2,6 x Symbol: Blitz startet am Symbolrand
    p0, p1 = polar(r0, rng.uniform(-0.05, 0.05)), polar(r1, rng.uniform(-0.18, 0.18))
    main = jag(p0, p1, 6, 0.13)
    lines = [(main, 1.0)]
    for _ in range(2 + seed_extra):
        i = int(rng.uniform(0.25, 0.7) * len(main))
        a = main[i]
        ang = rng.choice([-1, 1]) * rng.uniform(0.35, 0.8)
        L = rng.uniform(18, 34)
        v = main[min(i + 3, len(main) - 1)] - a
        v = v / (np.linalg.norm(v) + 1e-9)
        c, s = math.cos(ang), math.sin(ang)
        d = np.array([v[0] * c - v[1] * s, v[0] * s + v[1] * c])
        lines.append((jag(a, a + d * L, 3, 0.25), 0.65))
    return draw_lines(lines, 2.6, 11, 3.5)


def glow():
    y, x = np.mgrid[0:N, 0:N]
    r = np.hypot(x - (N - 1) / 2, y - (N - 1) / 2) / (N / 2)
    return np.clip(1 - r, 0, 1) ** 2.2


def plasma():
    y, x = np.mgrid[0:N, 0:N]
    cx = (N - 1) / 2
    r = np.hypot(x - cx, y - cx) / (N / 2)
    th = np.arctan2(y - cx, x - cx)
    noise = np.zeros((N, N))
    for k, amp in ((5, 0.5), (11, 0.3), (23, 0.2)):
        ph = rng.uniform(0, 2 * math.pi, 3)
        noise += amp * (np.sin(k * th + ph[0] + 6 * r) * 0.5 + 0.5)
    band = np.exp(-((r - 0.72) / (0.10 + 0.06 * noise)) ** 2)
    filaments = np.clip(np.sin(9 * th + 14 * r + 3 * noise) * 0.5 + 0.5, 0, 1) ** 3
    a = band * (0.45 + 0.55 * filaments) * (0.6 + 0.4 * noise)
    a *= np.clip((1 - r) * 6, 0, 1)
    return np.clip(a, 0, 1)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save(glow(), "strom_glow")
    save(plasma(), "strom_plasma")
    save(arc(0.0, 4, 0.40 * N, 1.15), "strom_arc1")
    save(arc(0.7, 3, 0.43 * N, 1.45), "strom_arc2")
    for i in (1, 2, 3):
        save(bolt(i - 1), "strom_bolt%d" % i)
    print("Strom-Grafiken ->", OUT)
