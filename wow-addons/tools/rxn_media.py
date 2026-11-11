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
import numpy as np  # noqa: E402

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


def poly_mask(size, pts, ss=4):
    m = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(m).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return m


def nav_arrow(size=128):
    """Navigations-Pfeil wie bei Karten-Apps: zwei Facetten (hell/dunkel) = 3D, Neon-Verlauf, dunkle Kontur."""
    ss = 4
    S = size * ss
    k = size / 128.0
    tip, lw, notch, rw = (64 * k, 10 * k), (22 * k, 112 * k), (64 * k, 88 * k), (106 * k, 112 * k)
    # Kontur (etwas groesser) fuer Lesbarkeit auf hellem Boden
    def grow(pts, d):
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        out = []
        for x, y in pts:
            vx, vy = x - cx, y - cy; l = (vx * vx + vy * vy) ** 0.5 or 1
            out.append((x + vx / l * d, y + vy / l * d))
        return out
    full = [tip, rw, notch, lw]
    outline = poly_mask(size, grow(full, 3.2 * k), ss)
    left = poly_mask(size, [tip, notch, lw], ss)
    right = poly_mask(size, [tip, rw, notch], ss)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dark = Image.new("RGBA", (S, S), (4, 14, 10, 235)); img.paste(dark, (0, 0), outline)
    # Facetten: links hell (Licht von links), rechts tiefer – beide mit Verlauf Spitze -> Fluegel
    lg = Image.new("RGBA", (S, S)); rg = Image.new("RGBA", (S, S))
    lp, rp = lg.load(), rg.load()
    for y in range(S):
        t = y / (S - 1)
        c1 = tuple(int(a + (b - a) * t) for a, b in zip((190, 255, 210), (57, 255, 107)))
        c2 = tuple(int(a + (b - a) * t) for a, b in zip((45, 226, 230), (18, 140, 150)))
        for x in range(S):
            lp[x, y] = c1 + (255,); rp[x, y] = c2 + (255,)
    img.paste(lg, (0, 0), left); img.paste(rg, (0, 0), right)
    # feine Lichtkante an der linken Aussenkante
    hl = Image.new("L", (S, S), 0)
    ImageDraw.Draw(hl).line([(tip[0] * ss, tip[1] * ss + 6), (lw[0] * ss + 8, lw[1] * ss - 6)], fill=170, width=int(3 * ss * k))
    img.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0), Image.fromarray(
        (np.minimum(np.array(hl), np.array(left)) * 1.0).astype("uint8")))
    img = img.resize((size, size), Image.LANCZOS)
    # Schein: weichgezeichnete Silhouette
    from PIL import ImageFilter
    g = outline.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(7 * k))
    glow = Image.new("RGBA", (size, size), (255, 255, 255, 0)); glow.putalpha(g)
    return img, glow


def dial(size=256):
    """Kompass-Scheibe: dunkles Glas, Verlaufsring gruen->tuerkis, feine Skala (nicht drehend)."""
    ss = 2
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = S / 2
    r_out = S * 0.47
    d.ellipse((c - r_out, c - r_out, c + r_out, c + r_out), fill=(8, 12, 14, 225))
    # Ring mit Verlauf
    ring_m = Image.new("L", (S, S), 0); rd = ImageDraw.Draw(ring_m)
    rd.ellipse((c - r_out, c - r_out, c + r_out, c + r_out), fill=255)
    ri = r_out - S * 0.022
    rd.ellipse((c - ri, c - ri, c + ri, c + ri), fill=0)
    ring = grad(Image.merge("RGBA", (ring_m, ring_m, ring_m, ring_m)), GREEN, TEAL)
    img.alpha_composite(ring)
    # Skala: 36 feine Striche, 4 laengere
    import math
    for i in range(36):
        a = i * math.pi * 2 / 36
        long_ = i % 9 == 0
        r1, r2 = r_out - S * (0.075 if long_ else 0.045), r_out - S * 0.03
        x1, y1 = c + math.sin(a) * r1, c - math.cos(a) * r1
        x2, y2 = c + math.sin(a) * r2, c - math.cos(a) * r2
        d.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 120 if long_ else 55), width=int(ss * (2 if long_ else 1)))
    # innerer Glanz oben
    gl = Image.new("L", (S, S), 0); gd = ImageDraw.Draw(gl)
    gd.ellipse((c - r_out * 0.86, c - r_out * 0.92, c + r_out * 0.86, c + r_out * 0.2), fill=26)
    img.alpha_composite(Image.merge("RGBA", (Image.new("L", (S, S), 255),) * 3 + (gl,)))
    return img.resize((size, size), Image.LANCZOS)


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

    # Pfeil: facettierter Neon-Pfeil (zeigt nach oben, dreht sich um die Bildmitte) + weicher Schein + Kompass-Scheibe
    arrow, aglow = nav_arrow(128)
    mm.save(arrow, "rxp_navigation_arrow-1")
    mm.save(aglow, "arrow_glow")
    mm.save(dial(256), "dial")
    mm.save(mm.circle(64), "white_circle")
    mm.save(grad(mm.ring(64, 0.16), GREEN, TEAL), "map_active_step_target_icon")

    # Skin-Flaechen + Bauteile aus LevelPilot (eigene Werke): Karte, Glow, Kugel-Teile, Symbole
    for n in ("card", "card_s", "glow", "dot", "ctx_disc", "ctx_ring", "ctx_gloss",
              "i_accept", "i_turnin", "i_complete", "i_fly", "i_hearth", "i_go", "i_train", "i_grind", "i_note",
              "i_flag", "i_arrow", "i_xph", "i_route", "i_time"):
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
