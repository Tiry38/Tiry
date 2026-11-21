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


def main():
    print("Erzeuge ChatWerk-Grafiken in", mm.MEDIA)
    save(logo(256), "logo")
    save(grip(64), "grip")
    for name, fn in {"chat": icon_chat, "lock": icon_lock, "unlock": icon_unlock, "copy": icon_copy,
                     "down": icon_down, "trash": icon_trash}.items():
        save(fn(), "i_" + name)


if __name__ == "__main__":
    main()
