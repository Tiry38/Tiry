#!/usr/bin/env python3
"""Erzeugt die Grafiken fuer RXPNeon (Neon-Glas-Skin fuer RestedXP Guides).

Aufruf:  python3 -I wow-addons/tools/rxn_media.py
Nutzt die Grundformen aus make_media.py und die eigenen LevelPilot-Grafiken (Karte, Pfeil, Glow).
RXP fragt seine Texturen ueber den Theme-Pfad an (texturePath .. Name) – deshalb heissen einige Dateien wie bei RXP.
"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_media as mm  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

ADDON = os.path.normpath(os.path.join(HERE, "..", "addons", "RXPNeon"))
MEDIA = os.path.join(ADDON, "Media")
LP = os.path.normpath(os.path.join(HERE, "..", "addons", "LevelPilot", "Media"))
mm.ADDON, mm.MEDIA = ADDON, MEDIA
os.makedirs(os.path.join(MEDIA, "Scrollbar"), exist_ok=True)

GREEN = (57, 255, 107)
TEAL = (45, 226, 230)


def tint(img, rgb):
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    out = Image.new("RGBA", img.size, rgb + (255,))
    out.putalpha(a)
    return out


def grad(img, c1, c2, vertical=True):
    """Alpha von img, Farbe als Verlauf c1 -> c2 (oben->unten bzw. links->rechts)."""
    img = img.convert("RGBA")
    w, h = img.size
    g = Image.new("RGBA", (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (y / max(1, h - 1)) if vertical else (x / max(1, w - 1))
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    g.putalpha(img.split()[3])
    return g


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def over(*layers):
    base = layers[0].convert("RGBA").copy()
    for l in layers[1:]:
        base.alpha_composite(l.convert("RGBA"))
    return base


def main():
    # unsichtbar: RXPs eckige Rahmen und Banner abschalten (der Skin zeichnet selbst)
    mm.save(blank(128, 16), "rxp-borders")
    mm.save(blank(16, 16), "rxp-banner")
    mm.save(blank(16, 16), "none")

    # Checkboxen: Neon-Ring leer / gefuellt mit Haken
    ring = grad(mm.ring(32, 0.13), GREEN, TEAL)
    mm.save(ring, "rxp-btn-blank-32")
    disc = grad(mm.circle(32), GREEN, TEAL)
    chk = tint(mm.down(mm.icon_check(), (32, 32)), (8, 24, 16))
    mm.save(over(disc, chk), "rxp-checked-32")

    # Logo: Neon-Kugel mit Routen-Symbol, Zahnrad
    orb = Image.open(os.path.join(LP, "orb.tga")).convert("RGBA").resize((64, 64), Image.LANCZOS)
    orb = grad(orb, GREEN, TEAL)
    route = Image.open(os.path.join(LP, "i_route.tga")).convert("RGBA").resize((34, 34), Image.LANCZOS)
    route = tint(route, (6, 20, 14))
    logo = orb.copy()
    logo.alpha_composite(route, (15, 15))
    mm.save(logo, "rxp_logo-64")
    mm.save(grad(mm.down(mm.icon_gear(), (32, 32)), GREEN, TEAL), "rxp_cog-32")

    # Pfeil (eigener LevelPilot-Pfeil, zeigt nach oben) + Kartenpunkte
    shutil.copy(os.path.join(LP, "arrow.tga"), os.path.join(MEDIA, "rxp_navigation_arrow-1.tga"))
    mm.save(mm.circle(64), "white_circle")
    mm.save(grad(mm.ring(64, 0.16), GREEN, TEAL), "map_active_step_target_icon")

    # Skin-Flaechen (wie LevelPilot): runde Karte, kleine Karte, weicher Glow
    for n in ("card", "card_s", "glow", "dot"):
        shutil.copy(os.path.join(LP, n + ".tga"), os.path.join(MEDIA, n + ".tga"))

    # Scrollbalken: schmale Neon-Pille als Knopf, Pfeil-Knoepfe als Chevrons
    knob = blank(16, 32)
    d = ImageDraw.Draw(knob)
    d.rounded_rectangle((5, 2, 10, 29), radius=3, fill=(255, 255, 255, 255))
    mm.save(grad(knob, GREEN, TEAL), "Scrollbar/Knob")
    chev = mm.down(mm.icon_chevron(), (32, 32))
    up = chev.rotate(90, expand=False)
    dn = chev.rotate(-90, expand=False)
    for name, img in (("Up", up), ("Down", dn)):
        mm.save(tint(img, GREEN), f"Scrollbar/{name}-Normal")
        mm.save(tint(img, (255, 255, 255)), f"Scrollbar/{name}-Highlight")
        mm.save(tint(img, TEAL), f"Scrollbar/{name}-Pushed")
        mm.save(tint(img, (70, 76, 84)), f"Scrollbar/{name}-Disabled")


if __name__ == "__main__":
    main()
