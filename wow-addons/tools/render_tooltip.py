"""Zeichnet die exportierten Tooltip-Zeilen im WoW-Tooltip-Look (Annäherung: Schrift im Spiel = Friz Quadrata)."""
import re, sys, os
from PIL import Image, ImageDraw, ImageFont

rows_file, media, out = sys.argv[1], sys.argv[2], sys.argv[3]
S = 2  # Skalierung
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12 * S)
FONTB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14 * S)
TOK = re.compile(r"\|c[0-9a-fA-F]{8}|\|r|\|T[^|]+\|t|\|A:[^|]+\|a|[^|]+|\|")
COIN = {"coin-gold": (255, 210, 74), "coin-silver": (200, 205, 215), "coin-copper": (232, 160, 102)}
_img = {}

def media_img(path):
    name = path.split("\\")[-1]
    if name not in _img:
        p = os.path.join(media, name + ".tga")
        _img[name] = Image.open(p).convert("RGBA") if os.path.exists(p) else None
    return _img[name]

def pieces(text, base):
    col, out = base, []
    for t in TOK.findall(text):
        if t.startswith("|c"):
            col = tuple(int(t[4 + i:6 + i], 16) for i in (0, 2, 4))
        elif t == "|r":
            col = base
        elif t.startswith("|T"):
            parts = t[2:-2].split(":")
            h, w = int(parts[1]), int(parts[2])
            rgb = tuple(int(x) for x in parts[11:14]) if len(parts) >= 14 else (255, 255, 255)
            out.append(("tex", parts[0], w, h, rgb))
        elif t.startswith("|A:"):
            parts = t[3:-2].split(":")
            out.append(("coin", parts[0], int(parts[2]), int(parts[1])))
        else:
            out.append(("text", t, col))
    return out

def width(ps, font=FONT):
    w = 0
    for p in ps:
        if p[0] == "text":
            w += font.getlength(p[1])
        else:
            w += (p[2] + (1 if p[0] == "coin" else 0)) * S
    return w

def draw(img, d, x, cy, ps, font=FONT):
    for p in ps:
        if p[0] == "text":
            d.text((x, cy), p[1], font=font, fill=p[2], anchor="lm")
            x += font.getlength(p[1])
        elif p[0] == "coin":
            r = p[2] * S // 2 - 2
            cx = x + p[2] * S // 2 + 1 * S
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=COIN[p[1]], outline=tuple(int(c * 0.6) for c in COIN[p[1]]), width=2)
            x += (p[2] + 1) * S
        else:
            _, path, w, h, rgb = p
            W_, H_ = w * S, h * S
            if path.endswith("WHITE8X8"):
                d.rectangle((x, cy - H_ // 2, x + W_ - 1, cy - H_ // 2 + H_ - 1), fill=rgb)
            else:
                src = media_img(path)
                if src is not None:
                    im = src.resize((W_, H_), Image.LANCZOS)
                    if rgb != (255, 255, 255):
                        r_, g_, b_, a_ = im.split()
                        im = Image.merge("RGBA", (r_.point(lambda v: v * rgb[0] // 255), g_.point(lambda v: v * rgb[1] // 255),
                                                  b_.point(lambda v: v * rgb[2] // 255), a_))
                    img.alpha_composite(im, (int(x), int(cy - H_ / 2)))
            x += W_
    return x

# Blizzard-/Auctionator-Teil oben (wie in Tirys Screenshot) + echte Zentrale-Zeilen
lines = [("L", "Makelloses Leder", None, (30, 255, 0), FONTB), ("L", "Rar", None, (0, 112, 221), FONT),
         ("L", "Handwerksmaterial", None, (102, 187, 255), FONT),
         ("L", "Verkaufspreis: |cffd5d9e61|r|A:coin-silver:11:11:1:0|a |cffe8a06625|r|A:coin-copper:11:11:1:0|a", None, (255, 255, 255), FONT),
         ("D", "Händler", "|cffd5d9e61|r|A:coin-silver:11:11:1:0|a |cffe8a06625|r|A:coin-copper:11:11:1:0|a", (255, 210, 0), FONT),
         ("D", "Auktion", "|cffd5d9e63|r|A:coin-silver:11:11:1:0|a |cffe8a06660|r|A:coin-copper:11:11:1:0|a", (255, 210, 0), FONT)]
LABEL, VALUE = (168, 194, 184), (255, 255, 255)
for raw in open(rows_file, encoding="utf-8").read().splitlines():
    f = raw.split("\t")
    if f[0] == "D":
        lc = (57, 255, 107) if "Tiry's Zentrale" in f[1] else LABEL
        lines.append(("D", f[1], f[2], lc, FONT))
    elif f[0] == "L":
        lines.append(("L", f[1], None, (158, 178, 171), FONT))

LH, PAD, GAP = 16 * S, 10 * S, 24 * S
prepared = []
for kind, a, b, col, font in lines:
    pa = pieces(a, col)
    pb = pieces(b, VALUE) if b is not None else None
    prepared.append((kind, pa, pb, font))
W = max(width(pa, f) + (GAP + width(pb) if pb else 0) for _, pa, pb, f in prepared) + 2 * PAD
H = len(prepared) * LH + 2 * PAD
img = Image.new("RGBA", (int(W) + 40 * S, int(H) + 40 * S), (32, 36, 42, 255))
d = ImageDraw.Draw(img)
ox, oy = 20 * S, 20 * S
d.rounded_rectangle((ox, oy, ox + W, oy + H), radius=6 * S, fill=(8, 10, 14, 245), outline=(110, 120, 130), width=2 * S)
y = oy + PAD + LH // 2
for kind, pa, pb, font in prepared:
    draw(img, d, ox + PAD, y, pa, font)
    if pb:
        draw(img, d, ox + W - PAD - width(pb), y, pb)
    y += LH
img.convert("RGB").save(out)
print(img.size)
