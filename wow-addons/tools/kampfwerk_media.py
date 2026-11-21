#!/usr/bin/env python3
"""Grafiken fuer KampfWerk (Logo, Balken, Hintergruende im WoW-Stil). Basis-Texturen stammen aus ChatWerk.

Alle Hintergruende sind hier prozedural erzeugt (Rauschen, Verlaeufe) - keine fremden Bilder.
Aufruf:  python3 -I wow-addons/tools/kampfwerk_media.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_media as mm  # noqa: E402

mm.ADDON = os.path.normpath(os.path.join(HERE, "..", "addons", "KampfWerk"))
mm.MEDIA = os.path.join(mm.ADDON, "Media")
Pen, save, down = mm.Pen, mm.save, mm.down
W, H = 256, 128


def fbm(w, h, seed, octaves=5, base=4, aspect=1.0):
    """Kachelbares Wert-Rauschen 0..1 (Summe mehrerer Frequenzen)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gx, gy = int(base * aspect * 2 ** o), int(base * 2 ** o)
        grid = rng.random((gy, gx)).astype(np.float32)
        ys = np.linspace(0, gy, h, endpoint=False)
        xs = np.linspace(0, gx, w, endpoint=False)
        y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
        fy, fx = ys - y0, xs - x0
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        y1, x1 = (y0 + 1) % gy, (x0 + 1) % gx
        a = grid[np.ix_(y0 % gy, x0 % gx)]
        b = grid[np.ix_(y0 % gy, x1)]
        c = grid[np.ix_(y1, x0 % gx)]
        d = grid[np.ix_(y1, x1)]
        top = a + (b - a) * fx[None, :]
        bot = c + (d - c) * fx[None, :]
        out += amp * (top + (bot - top) * fy[:, None])
        tot += amp
        amp *= 0.5
    return out / tot


def ramp(v, stops):
    """v (0..1) -> Farbe aus Stuetzstellen [(pos, (r,g,b)), ...]."""
    pos = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    out = np.zeros(v.shape + (3,), np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(v, pos, cols[:, ch])
    return out


def vignette(w, h, strength=0.55):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (xs / (w - 1) - 0.5) * 2, (ys / (h - 1) - 0.5) * 2
    d = np.sqrt(nx * nx * 0.7 + ny * ny)
    return np.clip(1 - strength * np.clip(d - 0.35, 0, None), 0, 1)


def to_img(rgb):
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), "RGB").convert("RGBA")


def stars(img, seed, n, col=(255, 255, 255), maxa=200):
    rng = np.random.default_rng(seed)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(n):
        x, y = rng.random() * W, rng.random() * H
        r = rng.choice([0.5, 0.7, 1.0, 1.4], p=[0.5, 0.3, 0.15, 0.05])
        a = int(maxa * (0.35 + 0.65 * rng.random()))
        d.ellipse((x - r, y - r, x + r, y + r), fill=col + (a,))
    return img


def bg_arkan():
    n = fbm(W, H, 11, aspect=2)
    m = fbm(W, H, 12, base=2, aspect=2)
    v = np.clip(n * 0.75 + m * 0.5 - 0.15, 0, 1)
    rgb = ramp(v, [(0, (8, 6, 22)), (0.45, (38, 18, 86)), (0.7, (96, 40, 170)), (0.88, (60, 140, 255)), (1, (210, 160, 255))])
    rgb *= vignette(W, H)[..., None]
    return stars(to_img(rgb), 13, 70, (230, 210, 255))


def bg_teufel():
    n = fbm(W, H, 21, aspect=2)
    v = np.clip((n - 0.3) * 1.9, 0, 1) ** 1.5
    rgb = ramp(v, [(0, (4, 10, 6)), (0.4, (10, 46, 16)), (0.75, (60, 170, 30)), (1, (190, 255, 90))])
    rgb *= vignette(W, H, 0.7)[..., None]
    return to_img(rgb)


def bg_frost():
    n = fbm(W, H, 31, aspect=2, base=3)
    rgb = ramp(n, [(0, (6, 14, 30)), (0.5, (20, 54, 96)), (0.8, (70, 150, 210)), (1, (200, 240, 255))])
    img = to_img(rgb * vignette(W, H)[..., None])
    # Eiskristall-Kanten: feine helle Linien
    rng = np.random.default_rng(32)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(26):
        x, y = rng.random() * W, rng.random() * H
        ang, ln = rng.random() * math.pi, 10 + rng.random() * 34
        d.line((x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln), fill=(190, 235, 255, 70), width=1)
    return stars(img, 33, 30, (220, 245, 255), 150)


def bg_glut():
    n = fbm(W, H, 41, aspect=2)
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    v = np.clip(n * 0.9 + ys * 0.45 - 0.25, 0, 1)
    rgb = ramp(v, [(0, (10, 4, 2)), (0.45, (70, 16, 6)), (0.75, (200, 70, 12)), (1, (255, 200, 80))])
    img = to_img(rgb * vignette(W, H)[..., None])
    return stars(img, 42, 45, (255, 190, 90), 220)


def bg_horde():
    n = fbm(W, H, 51, aspect=2, base=8)
    grain = fbm(W, H, 52, octaves=2, base=64, aspect=2)
    v = np.clip(n * 0.7 + grain * 0.3, 0, 1)
    rgb = ramp(v, [(0, (14, 4, 4)), (0.5, (64, 10, 12)), (0.85, (130, 22, 20)), (1, (190, 60, 40))])
    img = to_img(rgb * vignette(W, H, 0.75)[..., None])
    # Kratzspuren
    rng = np.random.default_rng(53)
    d = ImageDraw.Draw(img, "RGBA")
    for k in range(3):
        x = 150 + k * 14 + rng.random() * 4
        d.line((x, 18, x - 40, 110), fill=(0, 0, 0, 90), width=4)
        d.line((x + 2, 18, x - 38, 110), fill=(220, 90, 70, 40), width=1)
    return img


def bg_allianz():
    n = fbm(W, H, 61, aspect=2, base=3)
    rgb = ramp(n, [(0, (4, 10, 30)), (0.55, (14, 34, 86)), (0.85, (32, 70, 150)), (1, (90, 130, 210))])
    img = to_img(rgb * vignette(W, H, 0.6)[..., None])
    # goldener Lichtsaum oben
    ys = np.linspace(0, 1, H, dtype=np.float32)
    glow = np.clip(1 - ys / 0.35, 0, 1) ** 2
    arr = np.array(img).astype(np.float32)
    arr[..., 0] += glow[:, None] * 90
    arr[..., 1] += glow[:, None] * 70
    arr[..., 2] += glow[:, None] * 20
    return Image.fromarray(np.uint8(np.clip(arr, 0, 255)), "RGBA")


def bg_nacht():
    n = fbm(W, H, 71, aspect=2)
    xs = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    band = np.exp(-((ys - 0.45 - 0.18 * np.sin(xs * 6.28 * 1.0 + n * 2)) ** 2) / 0.02)
    base = ramp(n * 0.5, [(0, (4, 6, 20)), (0.5, (14, 12, 42))])
    aur = ramp(np.clip(xs + n * 0.3, 0, 1), [(0, (40, 255, 170)), (0.5, (40, 200, 255)), (1, (180, 80, 255))])
    rgb = base + aur * band[..., None] * 0.65
    return stars(to_img(rgb * vignette(W, H, 0.45)[..., None]), 72, 90)


def bg_leder():
    n = fbm(W, H, 81, aspect=2, base=10, octaves=4)
    big = fbm(W, H, 82, aspect=2, base=2, octaves=2)
    v = np.clip(n * 0.55 + big * 0.45, 0, 1)
    rgb = ramp(v, [(0, (18, 10, 6)), (0.5, (52, 30, 16)), (0.85, (86, 54, 30)), (1, (120, 80, 46))])
    img = to_img(rgb * vignette(W, H, 0.7)[..., None])
    d = ImageDraw.Draw(img, "RGBA")
    # Ziernaht rundum
    for x in range(10, W - 10, 8):
        d.line((x, 7, x + 4, 7), fill=(170, 130, 80, 110), width=1)
        d.line((x, H - 8, x + 4, H - 8), fill=(170, 130, 80, 110), width=1)
    return img


def bg_stein():
    n = fbm(W, H, 91, aspect=2, base=6)
    cr = fbm(W, H, 92, aspect=2, base=16, octaves=3)
    v = np.clip(n * 0.7 + cr * 0.3, 0, 1)
    rgb = ramp(v, [(0, (10, 11, 12)), (0.5, (34, 36, 38)), (0.8, (62, 64, 66)), (1, (96, 98, 100))])
    rgb *= (0.85 + 0.15 * (np.abs(cr - 0.5) > 0.03))[..., None]
    return to_img(rgb * vignette(W, H, 0.7)[..., None])


def bg_karbon():
    ys, xs = np.mgrid[0:H, 0:W]
    cell = 8
    cx, cy = (xs // cell) % 2, (ys // cell) % 2
    fx, fy = (xs % cell) / cell, (ys % cell) / cell
    a = np.where(cx == cy, np.sin(fx * math.pi), np.sin(fy * math.pi))
    v = 0.25 + 0.5 * a
    rgb = ramp(v.astype(np.float32), [(0, (8, 9, 10)), (0.5, (22, 24, 26)), (1, (44, 48, 50))])
    return to_img(rgb * vignette(W, H, 0.5)[..., None])


def bar(w=256, h=32):
    """Balken-Fuellung: oben Glanzkante, Koerper weiss (wird per Farbe eingefaerbt), unten dunkler."""
    ys = np.linspace(0, 1, h, dtype=np.float32)
    v = 0.78 + 0.22 * (1 - ys)
    v[:2] = 1.0
    v[-2:] *= 0.7
    gloss = np.clip(1 - ys / 0.45, 0, 1) ** 2 * 0.18
    col = np.clip(v + gloss, 0, 1)
    rgb = np.repeat(np.repeat(col[:, None, None], w, 1), 3, 2) * 255
    a = np.full((h, w, 1), 255, np.float32)
    return Image.fromarray(np.uint8(np.concatenate([rgb, a], 2)), "RGBA")


def logo(size=256):
    """Drei steigende Neon-Balken in einem Ring."""
    big = size * mm.SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((big * 0.06, big * 0.06, big * 0.94, big * 0.94), outline=255, width=int(big * 0.06))
    for i, hgt in enumerate((0.26, 0.40, 0.54)):
        x0 = big * (0.28 + i * 0.16)
        d.rounded_rectangle((x0, big * (0.72 - hgt), x0 + big * 0.12, big * 0.72), radius=big * 0.05, fill=255)
    grad = mm.gradient_rgb(big, big, [(200, 255, 150), (57, 255, 107), (38, 242, 217), (40, 170, 255)], angle_deg=40)
    col = Image.fromarray(np.uint8(grad), "RGB").convert("RGBA")
    col.putalpha(mask)
    halo = mask.filter(ImageFilter.GaussianBlur(big * 0.04))
    glow = Image.new("RGBA", (big, big), (57, 255, 140, 0))
    glow.putalpha(Image.fromarray(np.uint8(np.array(halo) * 0.55), "L"))
    out = Image.alpha_composite(img, glow)
    out = Image.alpha_composite(out, col)
    return down(out, (size, size))


def icon_detach():
    p = Pen()
    p.rrect(0.12, 0.34, 0.62, 0.86, 0.1)
    p.line([(0.48, 0.14), (0.86, 0.14), (0.86, 0.52)])
    p.line([(0.86, 0.14), (0.5, 0.5)])
    return p.image()


def icon_text():
    p = Pen()
    p.line([(0.2, 0.22), (0.8, 0.22)])
    p.line([(0.5, 0.22), (0.5, 0.82)])
    p.line([(0.36, 0.82), (0.64, 0.82)])
    return p.image()


def icon_palette():
    p = Pen()
    p.circle(0.5, 0.5, 0.36)
    for x, y in ((0.36, 0.38), (0.56, 0.32), (0.68, 0.5), (0.4, 0.6)):
        p.circle(x, y, 0.05, fill=True)
    return p.image()


def icon_layers():
    p = Pen()
    p.poly([(0.5, 0.18), (0.86, 0.38), (0.5, 0.58), (0.14, 0.38)], fill=False)
    p.line([(0.14, 0.56), (0.5, 0.76), (0.86, 0.56)])
    return p.image()


def mask_round(size=64, r=16):
    """Maske fuer Hintergruende: weisses abgerundetes Rechteck (9-teilig gestreckt, Ecken bleiben rund)."""
    big = size * mm.SS
    m = Image.new("L", (big, big), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, big - 1, big - 1), radius=r * mm.SS, fill=255)
    img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    img.putalpha(m)
    return down(img, (size, size))


def bg_psi(w=512, h=256, cx=0.5, cy=0.42):
    """Psi-Sturm: dunkles Violett, Energie-Ausbruch mit feinen Strahlen in der Mitte (Motiv zentral).
    Auch Platzhalter fuer 'Eigenes Bild' (Media/eigenes_bild.tga - Tiry kann die Datei durch ein eigenes Bild ersetzen)."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = (xs - cx * w) / h, (ys - cy * h) / h
    r = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)
    rng = np.random.default_rng(77)
    rays = np.zeros_like(r)
    for _ in range(140):
        a0 = rng.random() * 2 * math.pi
        width = 0.004 + rng.random() * 0.018
        strength = 0.25 + rng.random() * 0.75
        da = np.angle(np.exp(1j * (ang - a0)))
        rays += strength * np.exp(-(da / width) ** 2)
    rays = np.clip(rays, 0, 1.6) * np.exp(-r * 1.6)
    glow = np.exp(-(r / 0.28) ** 2) * 0.9 + np.exp(-(r / 0.75) ** 2) * 0.45
    n = fbm(w, h, 91, octaves=4, base=3, aspect=w / h)
    v = np.clip(glow * 0.75 + rays * 0.55 + (n - 0.5) * 0.12, 0, 1)
    rgb = ramp(v, [(0.0, (8, 5, 14)), (0.25, (38, 14, 58)), (0.5, (110, 40, 150)), (0.75, (200, 110, 230)),
                   (1.0, (255, 225, 255))])
    rgb *= vignette(w, h, 0.45)[..., None]
    return to_img(rgb)


def main():
    print("Erzeuge KampfWerk-Grafiken in", mm.MEDIA)
    save(logo(256), "logo")
    save(bar(), "bar")
    save(mask_round(), "mask_round")
    save(mask_round(32, 8), "mask_round8")
    for name, fn in {"arkan": bg_arkan, "teufel": bg_teufel, "frost": bg_frost, "glut": bg_glut, "horde": bg_horde,
                     "allianz": bg_allianz, "nacht": bg_nacht, "leder": bg_leder, "stein": bg_stein,
                     "karbon": bg_karbon, "psi": bg_psi}.items():
        save(fn(), "bg_" + name)
    save(bg_psi(), "eigenes_bild")
    for name, fn in {"detach": icon_detach, "text": icon_text, "palette": icon_palette, "layers": icon_layers}.items():
        save(fn(), "i_" + name)


if __name__ == "__main__":
    main()
