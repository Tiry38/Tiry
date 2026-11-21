#!/usr/bin/env python3
"""Zusatz-Grafiken fuer ChatWerk (Logo + Linien-Icons). Basis-Texturen stammen aus make_media.py.

Aufruf:  python3 -I wow-addons/tools/chatwerk_media.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_media as mm  # noqa: E402

mm.ADDON = os.path.normpath(os.path.join(HERE, "..", "addons", "ChatWerk"))
mm.MEDIA = os.path.join(mm.ADDON, "Media")
Pen, save, down = mm.Pen, mm.save, mm.down


def icon_chat():
    p = Pen()
    p.rrect(0.14, 0.2, 0.86, 0.68, 0.16)
    p.line([(0.32, 0.68), (0.26, 0.86), (0.48, 0.68)])
    for x in (0.34, 0.5, 0.66):
        p.circle(x, 0.44, 0.045, fill=True)
    return p.image()


def icon_lock():
    p = Pen()
    p.rrect(0.22, 0.46, 0.78, 0.86, 0.1)
    p.arc(0.5, 0.44, 0.17, 180, 360)
    p.line([(0.33, 0.44), (0.33, 0.47)])
    p.line([(0.67, 0.44), (0.67, 0.47)])
    p.circle(0.5, 0.64, 0.05, fill=True)
    return p.image()


def icon_unlock():
    p = Pen()
    p.rrect(0.22, 0.46, 0.78, 0.86, 0.1)
    p.arc(0.5, 0.36, 0.17, 180, 330)
    p.line([(0.33, 0.36), (0.33, 0.47)])
    p.circle(0.5, 0.64, 0.05, fill=True)
    return p.image()


def icon_copy():
    p = Pen()
    p.rrect(0.32, 0.3, 0.82, 0.86, 0.1)
    p.line([(0.2, 0.68), (0.2, 0.2), (0.62, 0.2)])
    return p.image()


def icon_down():
    p = Pen()
    p.line([(0.5, 0.16), (0.5, 0.74)])
    p.line([(0.26, 0.52), (0.5, 0.76), (0.74, 0.52)])
    p.line([(0.24, 0.88), (0.76, 0.88)])
    return p.image()


def icon_trash():
    p = Pen()
    p.line([(0.18, 0.28), (0.82, 0.28)])
    p.line([(0.4, 0.28), (0.42, 0.16), (0.58, 0.16), (0.6, 0.28)])
    p.line([(0.27, 0.34), (0.32, 0.86), (0.68, 0.86), (0.73, 0.34)])
    p.line([(0.44, 0.44), (0.45, 0.74)])
    p.line([(0.56, 0.44), (0.55, 0.74)])
    return p.image()


def grip(size=64):
    """Groessen-Griff: drei Punkte im Dreieck unten rechts."""
    big = size * mm.SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    r = big * 0.075
    for gx, gy in ((0.78, 0.38), (0.58, 0.58), (0.78, 0.58), (0.38, 0.78), (0.58, 0.78), (0.78, 0.78)):
        x, y = gx * big, gy * big
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return mm.white_from_mask(down(m, (size, size)))


def logo(size=256):
    """Sprechblase mit 3-Farben-Neonverlauf, Glas-Glanz und drei Punkten."""
    big = size * mm.SS
    body = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(body)
    pad = big * 0.08
    d.rounded_rectangle((pad, pad + big * 0.04, big - pad, big * 0.74), radius=big * 0.26, fill=255)
    d.polygon([(big * 0.26, big * 0.66), (big * 0.18, big * 0.93), (big * 0.48, big * 0.72)], fill=255)
    body = body.filter(ImageFilter.GaussianBlur(big * 0.004))
    grad = mm.gradient_rgb(big, big, [(200, 255, 150), (57, 255, 107), (38, 242, 217), (40, 170, 255)], angle_deg=40)
    img = Image.fromarray(np.uint8(grad), "RGB").convert("RGBA")
    img.putalpha(body)
    halo = body.filter(ImageFilter.GaussianBlur(big * 0.05))
    glow = Image.new("RGBA", (big, big), (57, 255, 140, 0))
    glow.putalpha(Image.fromarray(np.uint8(np.array(halo) * 0.5), "L"))
    out = Image.alpha_composite(glow, img)
    dd = ImageDraw.Draw(out)
    cy = big * 0.42
    for k in (0.34, 0.5, 0.66):
        r = big * 0.055
        dd.ellipse((big * k - r, cy - r, big * k + r, cy + r), fill=(12, 22, 24, 255))
    hl = Image.new("L", (big, big), 0)
    ImageDraw.Draw(hl).ellipse((big * 0.16, big * 0.1, big * 0.62, big * 0.36), fill=110)
    hl = hl.filter(ImageFilter.GaussianBlur(big * 0.04))
    hl_img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    hl_img.putalpha(Image.fromarray(np.minimum(np.array(hl), np.array(body)).astype(np.uint8), "L"))
    out = Image.alpha_composite(out, hl_img)
    return down(out, (size, size))


# ---------------------------------------------------------------- 2045-HUD (1.2)
def hud_corner(size=128, view=40.0):
    """Neon-Eckklammer oben links: Bogen um die runde Fensterecke + auslaufende Schenkel, weicher Glow.
    Im Spiel 40 px gross, 6 px ueber die Fensterkante hinaus (Fensterradius 16 -> Klammer-Radius 20)."""
    k = size * mm.SS / view          # Textur-Pixel je Bildschirm-Pixel (hochaufgeloest)
    big = size * mm.SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    c, r, lw = 22 * k, 20 * k, 1.6 * k
    ro = r + lw / 2                  # PIL zeichnet die Bogenbreite nach innen -> aussen um lw/2 erweitern
    d.arc((c - ro, c - ro, c + ro, c + ro), 180, 270, fill=255, width=int(round(lw)))
    # Schenkel mit Auslauf
    for i in range(int(c), int(big)):
        t = (i - c) / (big - c)
        a = int(255 * max(0.0, 1 - t) ** 1.6)
        d.line([(2 * k - lw / 2, i), (2 * k + lw / 2, i)], fill=a)
        d.line([(i, 2 * k - lw / 2), (i, 2 * k + lw / 2)], fill=a)
    # kleiner Datenpunkt am Bogen
    pr = 1.6 * k
    px = c - r * math.cos(math.radians(45))
    d.ellipse((px - pr, px - pr, px + pr, px + pr), fill=255)
    glow = m.filter(ImageFilter.GaussianBlur(2.2 * k))
    arr = np.maximum(np.array(m, np.float32), np.array(glow, np.float32) * 1.6)
    return mm.white_from_mask(down(Image.fromarray(np.uint8(np.clip(arr, 0, 255)), "L"), (size, size)))


def hex_tile(size=128):
    """Kachelbares Hex-Raster (flache Waben). Kachel = 3 s x sqrt(3) s, im Spiel ueber TexCoord entzerrt."""
    S = 4 * size
    s = S / 3.0
    h = math.sqrt(3) * s
    m = Image.new("L", (S, int(round(h))), 0)
    d = ImageDraw.Draw(m)
    lw = max(2, int(S / 120))

    def hexagon(cx, cy):
        pts = [(cx + s * math.cos(math.radians(a)), cy + s * math.sin(math.radians(a))) for a in range(0, 360, 60)]
        d.line(pts + [pts[0]], fill=255, width=lw, joint="curve")
    for cx, cy in ((0, 0), (3 * s, 0), (0, h), (3 * s, h), (1.5 * s, h / 2), (1.5 * s, -h / 2), (1.5 * s, 1.5 * h),
                   (-1.5 * s, h / 2), (4.5 * s, h / 2)):
        hexagon(cx, cy)
    # Knotenpunkte leuchten etwas staerker
    m = m.resize((size, size), Image.LANCZOS)
    return mm.white_from_mask(m)


def streak(w=256, h=32):
    """Lauflicht: heller Kern, zu beiden Enden und nach oben/unten weich auslaufend."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    fx = np.exp(-((x / (w - 1) - 0.5) ** 2) / (2 * 0.16 ** 2))
    core = np.exp(-((y / (h - 1) - 0.5) ** 2) / (2 * 0.05 ** 2))
    halo = np.exp(-((y / (h - 1) - 0.5) ** 2) / (2 * 0.22 ** 2)) * 0.45
    a = np.clip(fx * (core + halo), 0, 1) * 255
    return mm.white_from_mask(Image.fromarray(np.uint8(a), "L"))


def main():
    print("Erzeuge ChatWerk-Grafiken in", mm.MEDIA)
    save(logo(256), "logo")
    save(grip(64), "grip")
    save(hud_corner(128), "hud_corner")
    save(hex_tile(128), "hex")
    save(streak(256, 32), "streak")
    for name, fn in {"chat": icon_chat, "lock": icon_lock, "unlock": icon_unlock, "copy": icon_copy,
                     "down": icon_down, "trash": icon_trash}.items():
        save(fn(), "i_" + name)


if __name__ == "__main__":
    main()
