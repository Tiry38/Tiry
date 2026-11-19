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


# ---------- 1.4: moderner Energie-Ring (farbig, im Spiel ohne Einfaerbung) ----------
#   strom_comet   Neon-Komet: heller Kopf, Schweif ueber 300 Grad, Verlauf Weiss -> Tuerkis -> Blau -> Violett
#   strom_comet2  zweiter, duennerer Komet (Gegenstrom)
#   strom_orbit   3 kreisende Funken mit kurzem Schweif
#   strom_wave    duenne Druckwelle mit Kegel-Verlauf (Tuerkis/Blau/Violett rundum)
STOPS = [(0.00, (235, 255, 255)), (0.10, (45, 226, 230)), (0.45, (60, 125, 255)), (1.00, (150, 90, 255))]


def ramp(f, stops=STOPS):
    f = np.clip(f, 0, 1)
    out = np.zeros(f.shape + (3,), np.float32)
    xs = [p for p, _ in stops]
    for c in range(3):
        out[..., c] = np.interp(f, xs, [col[c] for _, col in stops])
    return out


def save_rgba(rgb, a, name):
    a = np.clip(a, 0, 1)
    img = Image.fromarray(np.uint8(np.dstack([np.clip(rgb, 0, 255), a * 255])), "RGBA")
    img.save(os.path.join(OUT, name + ".tga"))


def grid(ss=2):
    M = N * ss
    y, x = np.mgrid[0:M, 0:M].astype(np.float32)
    c = (M - 1) / 2
    r = np.hypot(x - c, y - c) / ss                    # Pixel im N-Raster
    th = np.arctan2(x - c, -(y - c)) % (2 * math.pi)  # 0 = oben, im Uhrzeigersinn
    return M, r, th, ss


def down(rgb, a, ss):
    """Supersampling: Farbe alpha-gewichtet mitteln."""
    M = a.shape[0]
    k = M // N
    aw = a.reshape(N, k, N, k).mean(axis=(1, 3))
    cw = (rgb * a[..., None]).reshape(N, k, N, k, 3).mean(axis=(1, 3)) / np.maximum(aw[..., None], 1e-6)
    return cw, aw


def comet(heads, radius, span, core, halo, head_r, tail_pow=1.7):
    M, r, th, ss = grid(4)
    c = (M - 1) / 2
    px = (np.arange(M, dtype=np.float32) - c) / ss + N / 2
    X, Y = np.meshgrid(px, px)
    acc = np.zeros(r.shape + (3,), np.float32)   # Farbe x Deckkraft (Summe)
    wsum = np.zeros_like(r)
    keep = np.ones_like(r)                         # 1 - Deckkraft (Produkt)
    hot = ramp(np.full(r.shape, 0.04))
    for h in heads:
        d = ((h - th + 0.3) % (2 * math.pi)) - 0.3  # Abstand hinter dem Kopf (Schweif gegen die Drehrichtung)
        f = np.clip(d / span, 0, 1)
        lead = 0.035 * (0.40 * N) / radius          # weiche Vorderkante (~4 px) statt harter Kante
        along = np.where(d < 0, np.exp(-(d / lead) ** 2), np.where(d < span, (1 - f) ** tail_pow, 0))
        w = 1 - 0.65 * f                           # Schweif wird duenner
        dr = r - radius
        at = np.clip(along * (np.exp(-(dr / (core * w)) ** 2) + 0.45 * np.exp(-(dr / (halo * w)) ** 2)), 0, 1)
        hx, hy = N / 2 + radius * math.sin(h), N / 2 - radius * math.cos(h)
        dh = np.hypot(X - hx, Y - hy)
        ah = np.clip(np.exp(-(dh / head_r) ** 2) + 0.40 * np.exp(-(dh / (head_r * 3.0)) ** 2), 0, 1)
        acc += ramp(f) * at[..., None] + hot * ah[..., None]
        wsum += at + ah
        keep *= (1 - at) * (1 - ah)
    rgb = acc / np.maximum(wsum[..., None], 1e-6)
    A = 1 - keep
    rgb, A = down(rgb, A, ss)
    yy, xx = np.mgrid[0:N, 0:N]
    A *= np.clip((N / 2 - 1 - np.hypot(xx - (N - 1) / 2, yy - (N - 1) / 2)) / 6, 0, 1)  # Rand sauber
    return rgb, A


def wave(radius, core, halo):
    M, r, th, ss = grid(4)
    dr = r - radius
    a = np.exp(-(dr / core) ** 2) + 0.5 * np.exp(-(dr / halo) ** 2)
    f = (np.cos(th) * 0.5 + 0.5)                       # Kegel-Verlauf rundum: oben Tuerkis, unten Violett
    rgb = ramp(0.08 + 0.92 * (1 - f))
    return down(rgb, np.clip(a, 0, 1), ss)


def modern():
    save_rgba(*comet([0.0], 0.40 * N, math.radians(300), 0.018 * N, 0.075 * N, 0.030 * N), "strom_comet")
    save_rgba(*comet([math.pi], 0.43 * N, math.radians(170), 0.010 * N, 0.050 * N, 0.020 * N, 2.2), "strom_comet2")
    save_rgba(*comet([0.0, 2 * math.pi / 3, 4 * math.pi / 3], 0.37 * N, math.radians(40),
                     0.012 * N, 0.04 * N, 0.022 * N, 1.4), "strom_orbit")
    save_rgba(*wave(0.40 * N, 0.010 * N, 0.045 * N), "strom_wave")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save(glow(), "strom_glow")
    save(plasma(), "strom_plasma")
    save(arc(0.0, 4, 0.40 * N, 1.15), "strom_arc1")
    save(arc(0.7, 3, 0.43 * N, 1.45), "strom_arc2")
    for i in (1, 2, 3):
        save(bolt(i - 1), "strom_bolt%d" % i)
    modern()
    print("Strom-Grafiken ->", OUT)
