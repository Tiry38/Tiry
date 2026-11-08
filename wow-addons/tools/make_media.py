#!/usr/bin/env python3
"""Erzeugt alle Grafiken (TGA, 32 Bit mit Alpha) für das WoW-Addon Tiry's Zentrale.

Aufruf:  python3 wow-addons/tools/make_media.py
Benötigt: Pillow, numpy. Schrift: Poppins (liegt im Addon unter Media/Fonts).
Alle Texturen haben Zweierpotenz-Maße und werden unkomprimiert gespeichert,
damit der WoW-Client sie sicher lädt.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.normpath(os.path.join(HERE, "..", "TirysZentrale"))
MEDIA = os.path.join(ADDON, "Media")
FONTS = os.path.join(MEDIA, "Fonts")
SS = 4  # Supersampling-Faktor für glatte Kanten

GOLD = (255, 214, 74)
AMBER = (255, 138, 0)
ROSE = (255, 61, 129)


def save(img, name):
    """Speichert als TGA: Ursprung unten links, RLE aus, RGB unter transparenten Pixeln aufgefüllt."""
    img = img.convert("RGBA")
    arr = np.array(img).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    # Farbe unter (fast) transparenten Pixeln aus dem Umfeld auffüllen -> keine dunklen Säume beim Filtern
    if (alpha < 1).any():
        rgb = arr[..., :3]
        weight = alpha[..., 0]
        blurred_rgb = np.array(Image.fromarray(np.uint8(np.clip(rgb * alpha, 0, 255))).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
        blurred_w = np.array(Image.fromarray(np.uint8(np.clip(weight * 255, 0, 255))).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255.0
        fill = blurred_rgb / np.maximum(blurred_w[..., None], 1e-3)
        fill = np.clip(fill, 0, 255)
        mix = np.clip(weight[..., None] * 4.0, 0, 1)
        arr[..., :3] = rgb * mix + fill * (1 - mix)
    out = Image.fromarray(np.uint8(np.clip(arr, 0, 255)), "RGBA")
    path = os.path.join(MEDIA, name + ".tga")
    out.save(path, format="TGA", compression=None)
    w, h = out.size
    assert w & (w - 1) == 0 and h & (h - 1) == 0, name + " muss Zweierpotenz-Maße haben"
    print("  ", os.path.relpath(path, ADDON), out.size)


def white_from_mask(mask):
    """Weißes Bild, dessen Alpha die Maske ist (zum Einfärben per SetVertexColor)."""
    img = Image.new("RGBA", mask.size, (255, 255, 255, 0))
    img.putalpha(mask)
    return img


def down(img, size):
    return img.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------- Grundformen
def circle(size=128):
    big = size * SS
    m = Image.new("L", (big, big), 0)
    ImageDraw.Draw(m).ellipse((0, 0, big - 1, big - 1), fill=255)
    return white_from_mask(down(m, (size, size)))


def ring(size=128, thickness=0.11):
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((0, 0, big - 1, big - 1), fill=255)
    t = int(big * thickness)
    d.ellipse((t, t, big - 1 - t, big - 1 - t), fill=0)
    return white_from_mask(down(m, (size, size)))


def glow(size=256):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    r = np.sqrt((x - c) ** 2 + (y - c) ** 2) / c
    a = np.clip(1.0 - r, 0, 1)
    a = a * a * (3 - 2 * a)  # smoothstep
    a = a ** 1.6
    return white_from_mask(Image.fromarray(np.uint8(a * 255), "L"))


def blob(size=256, seed=1):
    rng = np.random.default_rng(seed)
    big = size * 2
    y, x = np.mgrid[0:big, 0:big].astype(np.float32)
    c = (big - 1) / 2.0
    ang = np.arctan2(y - c, x - c)
    dist = np.sqrt((x - c) ** 2 + (y - c) ** 2) / c
    radius = 0.62
    for k, amp in ((2, 0.07), (3, 0.06), (5, 0.035), (7, 0.02)):
        radius = radius + amp * np.sin(k * ang + rng.uniform(0, 2 * math.pi))
    edge = np.clip((radius - dist) / 0.22, 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    m = Image.fromarray(np.uint8(edge * 255), "L").filter(ImageFilter.GaussianBlur(6))
    return white_from_mask(down(m, (size, size)))


def wave(w=512, h=64):
    big_w, big_h = w * SS, h * SS
    m = Image.new("L", (big_w, big_h), 0)
    pts = []
    for i in range(0, big_w + 1, 4):
        t = i / big_w
        yy = big_h * (0.42 + 0.16 * math.sin(t * math.pi * 2 * 1.5 + 0.6) + 0.07 * math.sin(t * math.pi * 2 * 3.2 + 1.9))
        pts.append((i, yy))
    poly = pts + [(big_w, big_h), (0, big_h)]
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return white_from_mask(down(m, (w, h)))


def sparkle(size=64):
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    c = big / 2
    r_out, r_in = big * 0.48, big * 0.09
    pts = []
    for i in range(8):
        ang = -math.pi / 2 + i * math.pi / 4
        r = r_out if i % 2 == 0 else r_in
        pts.append((c + r * math.cos(ang), c + r * math.sin(ang)))
    d.polygon(pts, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(SS * 0.6))
    return white_from_mask(down(m, (size, size)))


# ---------------------------------------------------------------- Farbgrafiken
def gradient_rgb(w, h, stops, angle_deg=0):
    """Mehrfarbiger linearer Verlauf als numpy-Array (h, w, 3)."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle_deg)
    t = (x / max(w - 1, 1)) * math.cos(a) + (y / max(h - 1, 1)) * math.sin(a)
    t = (t - t.min()) / max(t.max() - t.min(), 1e-6)
    out = np.zeros((h, w, 3), np.float32)
    n = len(stops) - 1
    for i in range(n):
        lo, hi = i / n, (i + 1) / n
        sel = (t >= lo) & (t <= hi)
        f = ((t - lo) / (hi - lo))[sel][:, None]
        c0 = np.array(stops[i], np.float32)
        c1 = np.array(stops[i + 1], np.float32)
        out[sel] = c0 * (1 - f) + c1 * f
    return out


def logo(size=256):
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    pad = int(big * 0.04)
    # Münzkörper mit diagonalem 3-Farben-Verlauf
    body_mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(body_mask).ellipse((pad, pad, big - pad, big - pad), fill=255)
    grad = gradient_rgb(big, big, [(255, 236, 140), GOLD, AMBER, (240, 90, 40)], angle_deg=55)
    body = Image.fromarray(np.uint8(grad), "RGB").convert("RGBA")
    body.putalpha(body_mask)
    img = Image.alpha_composite(img, body)
    d = ImageDraw.Draw(img)
    # Innenring
    inset = int(big * 0.13)
    d.ellipse((inset, inset, big - inset, big - inset), outline=(255, 245, 205, 235), width=int(big * 0.018))
    # Großes G
    font = ImageFont.truetype(os.path.join(FONTS, "Poppins-ExtraBold.ttf"), int(big * 0.56))
    text = "T"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (big - tw) / 2 - bbox[0]
    ty = (big - th) / 2 - bbox[1] + big * 0.005
    shadow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((tx + big * 0.012, ty + big * 0.02), text, font=font, fill=(120, 40, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(big * 0.012))
    img = Image.alpha_composite(img, shadow)
    tmask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(tmask).text((tx, ty), text, font=font, fill=255)
    tgrad = gradient_rgb(big, big, [(255, 252, 235), (255, 226, 150), (255, 190, 90)], angle_deg=90)
    tl = Image.fromarray(np.uint8(tgrad), "RGB").convert("RGBA")
    tl.putalpha(tmask)
    img = Image.alpha_composite(img, tl)
    # Glanzlicht oben links
    hl = Image.new("L", (big, big), 0)
    ImageDraw.Draw(hl).ellipse((int(big * 0.16), int(big * 0.1), int(big * 0.56), int(big * 0.42)), fill=90)
    hl = hl.filter(ImageFilter.GaussianBlur(big * 0.05))
    hl_img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    hl_img.putalpha(Image.fromarray(np.minimum(np.array(hl), np.array(body_mask)).astype(np.uint8), "L"))
    img = Image.alpha_composite(img, hl_img)
    # Funkeln
    sp = sparkle(int(big * 0.34)).resize((int(big * 0.34), int(big * 0.34)), Image.LANCZOS)
    img.alpha_composite(sp, (int(big * 0.64), int(big * 0.02)))
    return down(img, (size, size))


def wordmark(w=512, h=128):
    big_w, big_h = w * SS, h * SS
    font = ImageFont.truetype(os.path.join(FONTS, "Poppins-ExtraBold.ttf"), int(big_h * 0.62))
    text = "Tiry's Zentrale"
    tmp = ImageDraw.Draw(Image.new("L", (10, 10)))
    bbox = tmp.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    scale = min(1.0, (big_w * 0.96) / tw)
    if scale < 1.0:
        font = ImageFont.truetype(os.path.join(FONTS, "Poppins-ExtraBold.ttf"), int(big_h * 0.62 * scale))
        bbox = tmp.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (big_w - tw) / 2 - bbox[0]
    ty = (big_h - th) / 2 - bbox[1]
    mask = Image.new("L", (big_w, big_h), 0)
    ImageDraw.Draw(mask).text((tx, ty), text, font=font, fill=255)
    grad = gradient_rgb(big_w, big_h, [(255, 236, 140), GOLD, AMBER, ROSE], angle_deg=8)
    txt = Image.fromarray(np.uint8(grad), "RGB").convert("RGBA")
    txt.putalpha(mask)
    glow_mask = mask.filter(ImageFilter.GaussianBlur(big_h * 0.06))
    glow_img = Image.new("RGBA", (big_w, big_h), (255, 150, 40, 0))
    glow_img.putalpha(Image.fromarray(np.uint8(np.array(glow_mask) * 0.55), "L"))
    out = Image.alpha_composite(glow_img, txt)
    return down(out, (w, h))


# ---------------------------------------------------------------- Linien-Icons (weiß)
class Pen:
    def __init__(self, size=256, width=0.085):
        self.size = size
        self.m = Image.new("L", (size, size), 0)
        self.d = ImageDraw.Draw(self.m)
        self.w = max(2, int(size * width))

    def p(self, x, y):
        return (x * self.size, y * self.size)

    def line(self, pts, width=None):
        w = width or self.w
        P = [self.p(*q) for q in pts]
        self.d.line(P, fill=255, width=w, joint="curve")
        r = w / 2
        for (x, y) in (P[0], P[-1]):
            self.d.ellipse((x - r, y - r, x + r, y + r), fill=255)

    def circle(self, cx, cy, r, fill=False, width=None):
        w = width or self.w
        x0, y0 = self.p(cx - r, cy - r)
        x1, y1 = self.p(cx + r, cy + r)
        if fill:
            self.d.ellipse((x0, y0, x1, y1), fill=255)
        else:
            self.d.ellipse((x0, y0, x1, y1), outline=255, width=w)

    def arc(self, cx, cy, r, a0, a1, width=None):
        w = width or self.w
        x0, y0 = self.p(cx - r, cy - r)
        x1, y1 = self.p(cx + r, cy + r)
        self.d.arc((x0, y0, x1, y1), a0, a1, fill=255, width=w)

    def poly(self, pts, fill=True):
        P = [self.p(*q) for q in pts]
        if fill:
            self.d.polygon(P, fill=255)
        else:
            self.line(pts + [pts[0]])

    def rrect(self, x0, y0, x1, y1, r, fill=False, width=None):
        w = width or self.w
        a, b = self.p(x0, y0), self.p(x1, y1)
        if fill:
            self.d.rounded_rectangle((a[0], a[1], b[0], b[1]), radius=r * self.size, fill=255)
        else:
            self.d.rounded_rectangle((a[0], a[1], b[0], b[1]), radius=r * self.size, outline=255, width=w)

    def erase_circle(self, cx, cy, r):
        x0, y0 = self.p(cx - r, cy - r)
        x1, y1 = self.p(cx + r, cy + r)
        self.d.ellipse((x0, y0, x1, y1), fill=0)

    def image(self, out=64):
        return white_from_mask(down(self.m, (out, out)))


def icon_home():
    p = Pen()
    p.line([(0.16, 0.5), (0.5, 0.18), (0.84, 0.5)])
    p.line([(0.26, 0.42), (0.26, 0.82), (0.74, 0.82), (0.74, 0.42)])
    p.line([(0.43, 0.82), (0.43, 0.6), (0.57, 0.6), (0.57, 0.82)])
    return p.image()


def icon_compass():
    p = Pen()
    p.circle(0.5, 0.5, 0.36)
    p.poly([(0.5, 0.24), (0.585, 0.5), (0.5, 0.76), (0.415, 0.5)], fill=True)
    p.erase_circle(0.5, 0.5, 0.045)
    return p.image()


def icon_coins():
    p = Pen(width=0.075)
    for i, y in enumerate((0.7, 0.55, 0.4)):
        p.d.ellipse((*p.p(0.2, y - 0.09), *p.p(0.8, y + 0.09)), outline=255, width=p.w)
    p.d.ellipse((*p.p(0.2, 0.17), *p.p(0.8, 0.35)), outline=255, width=p.w)
    return p.image()


def icon_scan():
    p = Pen()
    p.circle(0.43, 0.43, 0.24)
    p.line([(0.61, 0.61), (0.82, 0.82)], width=int(256 * 0.11))
    return p.image()


def icon_flask():
    p = Pen()
    p.line([(0.4, 0.16), (0.6, 0.16)])
    p.line([(0.43, 0.17), (0.43, 0.4), (0.2, 0.78), (0.24, 0.84), (0.76, 0.84), (0.8, 0.78), (0.57, 0.4), (0.57, 0.17)])
    p.poly([(0.33, 0.62), (0.67, 0.62), (0.75, 0.78), (0.25, 0.78)], fill=True)
    return p.image()


def icon_chart():
    p = Pen(width=0.1)
    p.line([(0.24, 0.8), (0.24, 0.56)])
    p.line([(0.42, 0.8), (0.42, 0.38)])
    p.line([(0.6, 0.8), (0.6, 0.48)])
    p.line([(0.78, 0.8), (0.78, 0.22)])
    return p.image()


def icon_book():
    p = Pen(width=0.075)
    p.line([(0.5, 0.28), (0.5, 0.8)])
    p.line([(0.5, 0.28), (0.36, 0.22), (0.14, 0.24), (0.14, 0.76), (0.36, 0.74), (0.5, 0.8)])
    p.line([(0.5, 0.28), (0.64, 0.22), (0.86, 0.24), (0.86, 0.76), (0.64, 0.74), (0.5, 0.8)])
    return p.image()


def icon_gear():
    p = Pen()
    cx = cy = 0.5
    teeth = 8
    pts = []
    for i in range(teeth * 2):
        ang = i * math.pi / teeth
        r = 0.38 if i % 2 == 0 else 0.29
        for da in (-0.17, 0.17):
            pts.append((cx + r * math.cos(ang + da), cy + r * math.sin(ang + da)))
    p.poly(pts, fill=True)
    p.erase_circle(cx, cy, 0.13)
    return p.image()


def icon_close():
    p = Pen(width=0.1)
    p.line([(0.27, 0.27), (0.73, 0.73)])
    p.line([(0.73, 0.27), (0.27, 0.73)])
    return p.image()


def icon_chevron():
    p = Pen(width=0.1)
    p.line([(0.38, 0.22), (0.66, 0.5), (0.38, 0.78)])
    return p.image()


def icon_check():
    p = Pen(width=0.11)
    p.line([(0.2, 0.52), (0.42, 0.74), (0.82, 0.28)])
    return p.image()


def icon_star():
    p = Pen()
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = 0.4 if i % 2 == 0 else 0.17
        pts.append((0.5 + r * math.cos(ang), 0.53 + r * math.sin(ang)))
    p.poly(pts, fill=True)
    return p.image()


def icon_cart():
    p = Pen(width=0.075)
    p.line([(0.1, 0.2), (0.22, 0.2), (0.32, 0.64), (0.78, 0.64), (0.88, 0.32), (0.26, 0.32)])
    p.circle(0.38, 0.8, 0.065, fill=True)
    p.circle(0.72, 0.8, 0.065, fill=True)
    return p.image()


def icon_refresh():
    p = Pen()
    p.arc(0.5, 0.5, 0.31, 200, 520 - 40)
    p.poly([(0.73, 0.12), (0.86, 0.36), (0.6, 0.38)], fill=True)
    return p.image()


def icon_info():
    p = Pen()
    p.circle(0.5, 0.5, 0.38)
    p.line([(0.5, 0.46), (0.5, 0.7)])
    p.circle(0.5, 0.32, 0.055, fill=True)
    return p.image()


def icon_bag():
    p = Pen()
    p.rrect(0.2, 0.36, 0.8, 0.84, 0.12)
    p.arc(0.5, 0.36, 0.15, 180, 360)
    return p.image()


def icon_pin():
    p = Pen()
    p.arc(0.5, 0.4, 0.24, 140, 400)
    p.line([(0.32, 0.56), (0.5, 0.84), (0.68, 0.56)])
    p.circle(0.5, 0.4, 0.08, fill=True)
    return p.image()


def icon_bolt():
    p = Pen()
    p.poly([(0.56, 0.1), (0.24, 0.56), (0.47, 0.56), (0.42, 0.9), (0.76, 0.42), (0.53, 0.42)], fill=True)
    return p.image()


def icon_warn():
    p = Pen()
    p.line([(0.5, 0.15), (0.87, 0.82), (0.13, 0.82), (0.5, 0.15)])
    p.line([(0.5, 0.4), (0.5, 0.6)])
    p.circle(0.5, 0.71, 0.05, fill=True)
    return p.image()


def icon_plus():
    p = Pen(width=0.1)
    p.line([(0.28, 0.5), (0.72, 0.5)])
    p.line([(0.5, 0.28), (0.5, 0.72)])
    return p.image()


def icon_db():
    p = Pen(width=0.075)
    for y in (0.24, 0.5, 0.76):
        p.d.ellipse((*p.p(0.2, y - 0.1), *p.p(0.8, y + 0.1)), outline=255, width=p.w)
    p.line([(0.2, 0.24), (0.2, 0.76)])
    p.line([(0.8, 0.24), (0.8, 0.76)])
    return p.image()


def icon_paw():
    p = Pen()
    p.circle(0.5, 0.64, 0.17, fill=True)
    p.circle(0.27, 0.42, 0.08, fill=True)
    p.circle(0.41, 0.28, 0.085, fill=True)
    p.circle(0.59, 0.28, 0.085, fill=True)
    p.circle(0.73, 0.42, 0.08, fill=True)
    return p.image()


def icon_minus():
    p = Pen(width=0.1)
    p.line([(0.28, 0.5), (0.72, 0.5)])
    return p.image()


def main():
    os.makedirs(MEDIA, exist_ok=True)
    print("Erzeuge Grafiken in", MEDIA)
    save(circle(128), "circle")
    save(ring(128), "ring")
    save(glow(256), "glow")
    save(blob(256, seed=7), "blob1")
    save(blob(256, seed=21), "blob2")
    save(wave(512, 64), "wave")
    save(sparkle(64), "sparkle")
    save(logo(256), "logo")
    save(wordmark(512, 128), "wordmark")
    icons = {
        "home": icon_home, "compass": icon_compass, "coins": icon_coins, "scan": icon_scan,
        "flask": icon_flask, "chart": icon_chart, "book": icon_book, "gear": icon_gear,
        "close": icon_close, "chevron": icon_chevron, "check": icon_check, "star": icon_star,
        "cart": icon_cart, "refresh": icon_refresh, "info": icon_info, "bag": icon_bag,
        "pin": icon_pin, "bolt": icon_bolt, "warn": icon_warn, "minus": icon_minus, "plus": icon_plus, "db": icon_db, "paw": icon_paw,
    }
    for name, fn in icons.items():
        save(fn(), "i_" + name)


if __name__ == "__main__":
    main()
