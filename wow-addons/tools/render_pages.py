#!/usr/bin/env python3
"""Zeichnet die von tests/check_layout.lua exportierten Seiten als PNG (Vorschau ohne Spiel).
Aufruf: python3 tools/render_pages.py <ordner mit *.tsv>"""
import glob, math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.join(HERE, "..", "TirysZentrale")
FONTS = {"regular": "Poppins-Regular.ttf", "semibold": "Poppins-SemiBold.ttf", "bold": "Poppins-ExtraBold.ttf"}
SCALE = 1.5
_tex, _font = {}, {}


def font(weight, size):
    key = (weight, size)
    if key not in _font:
        _font[key] = ImageFont.truetype(os.path.join(ADDON, "Media", "Fonts", FONTS.get(weight, FONTS["regular"])), max(6, int(round(size * SCALE))))
    return _font[key]


def texture(name):
    if name in _tex:
        return _tex[name]
    img = None
    if "TirysZentrale\\Media\\" in name:
        fn = name.split("Media\\")[-1] + ".tga"
        p = os.path.join(ADDON, "Media", fn)
        if os.path.exists(p):
            img = Image.open(p).convert("RGBA")
    _tex[name] = img
    return img


def tint(img, rgba):
    r, g, b, a = rgba
    px = img.copy()
    rr, gg, bb, aa = px.split()
    rr = rr.point(lambda v: int(v * r))
    gg = gg.point(lambda v: int(v * g))
    bb = bb.point(lambda v: int(v * b))
    aa = aa.point(lambda v: int(v * a))
    return Image.merge("RGBA", (rr, gg, bb, aa))


def gradient(w, h, orient, c1, c2):
    img = Image.new("RGBA", (w, h))
    px = img.load()
    for i in range(w if orient == "HORIZONTAL" else h):
        t = i / max((w if orient == "HORIZONTAL" else h) - 1, 1)
        c = tuple(int(255 * (c1[k] * (1 - t) + c2[k] * t)) for k in range(4))
        if orient == "HORIZONTAL":
            for y in range(h):
                px[i, y] = c
        else:
            for x in range(w):
                px[x, h - 1 - i] = c
    return img


def render(path):
    rows = [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8") if l.strip()]
    if not rows:
        return None
    xs = [float(r[1]) for r in rows] + [float(r[3]) for r in rows]
    ys = [float(r[2]) for r in rows] + [float(r[4]) for r in rows]
    minx, maxx, miny, maxy = min(xs) - 10, max(xs) + 10, min(ys) - 10, max(ys) + 10
    W, H = int((maxx - minx) * SCALE), int((maxy - miny) * SCALE)
    canvas = Image.new("RGBA", (W, H), (32, 30, 38, 255))

    def box(l, b, r, t):
        return int((l - minx) * SCALE), int((maxy - t) * SCALE), int((r - minx) * SCALE), int((maxy - b) * SCALE)

    for r in rows:
        x0, y0, x1, y1 = box(float(r[1]), float(r[2]), float(r[3]), float(r[4]))
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0:
            continue
        if r[0] == "T":
            name = r[5]
            col = [float(v) for v in r[6:10]]
            orient = r[10]
            coord = [float(v) for v in r[13].split(",")] if r[13] else None
            if orient:
                c1 = [float(v) for v in r[11].split(",")]
                c2 = [float(v) for v in r[12].split(",")]
                piece = gradient(w, h, orient, c1, c2)
            else:
                piece = None
            if name.startswith("ATLAS:"):  # Spiel-Atlas gibt es offline nicht -> weglassen
                continue
            src = texture(name)
            if src is not None:
                if coord and len(coord) == 4:
                    u0, u1, v0, v1 = coord
                    flip_x, flip_y = u0 > u1, v0 > v1
                    u0, u1 = min(u0, u1), max(u0, u1)
                    v0, v1 = min(v0, v1), max(v0, v1)
                    sw, sh = src.size
                    if u1 > 1 or v1 > 1:  # REPEAT-Kachelung
                        nx, ny = max(1, math.ceil(u1)), max(1, math.ceil(v1))
                        tiled = Image.new("RGBA", (sw * nx, sh * ny))
                        for ix in range(nx):
                            for iy in range(ny):
                                tiled.paste(src, (ix * sw, iy * sh))
                        src = tiled
                    src = src.crop((int(u0 * sw), int(v0 * sh), max(int(u1 * sw), int(u0 * sw) + 1), max(int(v1 * sh), int(v0 * sh) + 1)))
                    if flip_x:
                        src = src.transpose(Image.FLIP_LEFT_RIGHT)
                    if flip_y:
                        src = src.transpose(Image.FLIP_TOP_BOTTOM)
                src = src.resize((w, h), Image.LANCZOS)
                if piece is not None:
                    alpha = src.split()[3]
                    piece.putalpha(ImageChops.multiply(alpha, piece.split()[3]))
                else:
                    piece = tint(src, col)
            elif piece is None:
                if name.replace(".", "").isdigit():  # Item-Symbol (Datei-ID) -> Platzhalter
                    piece = Image.new("RGBA", (w, h), (120, 110, 90, 255))
                else:
                    piece = Image.new("RGBA", (w, h), tuple(int(255 * v) for v in col))
            if r[14] == "ADD":
                faded = piece.copy()
                faded.putalpha(faded.split()[3].point(lambda v: int(v * 0.6)))
                piece = faded
            canvas.alpha_composite(piece, (x0, y0))
        else:
            weight, size = r[5], float(r[6])
            col = tuple(int(255 * float(v)) for v in r[7:11])
            justH, justV, spacing = r[11], r[12], float(r[13])
            lines = r[14].split("\x1f")
            f = font(weight, size)
            lh = (size * 1.2 + spacing) * SCALE
            total = lh * len(lines)
            ty = y0 if justV == "TOP" else y0 + (h - total) / 2 if justV == "MIDDLE" else y1 - total
            d = ImageDraw.Draw(canvas)
            for i, line in enumerate(lines):
                line = line.replace("\x01", "◆")
                lw = d.textlength(line, font=f)
                tx = x0 if justH == "LEFT" else (x1 - lw if justH == "RIGHT" else x0 + (w - lw) / 2)
                d.text((tx, ty + i * lh), line, font=f, fill=col)
    out = path[:-4] + ".png"
    canvas.convert("RGB").save(out)
    return out


if __name__ == "__main__":
    for p in sorted(glob.glob(os.path.join(sys.argv[1], "*.tsv"))):
        print(render(p))
