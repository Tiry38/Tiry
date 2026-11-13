#!/usr/bin/env python3
"""Zeichnet die von tests/check_layout.lua exportierten Seiten als PNG (Vorschau ohne Spiel).
Aufruf: python3 tools/render_pages.py <ordner mit *.tsv>
Optional: TZ_ICON_DIR=<ordner> mit Spielsymbolen als <name>.jpg/.png (klein geschrieben, z. B. inv_misc_coin_02.jpg)
-> Interface\\Icons\\... wird dann echt gezeichnet, sonst als neutraler Platzhalter.
ADD-Texturen werden wie im Spiel additiv gemischt."""
import glob, math, os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops

TOKEN = re.compile(r"\|c[0-9a-fA-F]{8}|\|r|\x01|[^|\x01]+|\|")

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.join(HERE, "..", "TirysZentrale")
FONTS = {"regular": "Poppins-Regular.ttf", "semibold": "Poppins-SemiBold.ttf", "bold": "Poppins-ExtraBold.ttf"}
SCALE = 1.5
_tex, _font = {}, {}


NARROW = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"  # Arial-maßgleich; x 0,82 = Arial Narrow (WoW ARIALN.TTF)
SQUEEZE = {"narrow": 0.82}


def font(weight, size):
    key = (weight, size)
    if key not in _font and weight == "narrow":
        _font[key] = ImageFont.truetype(NARROW, max(6, int(round(size * SCALE))))
    if key not in _font:
        _font[key] = ImageFont.truetype(os.path.join(ADDON, "Media", "Fonts", FONTS.get(weight, FONTS["regular"])), max(6, int(round(size * SCALE))))
    return _font[key]


ICON_DIR = os.environ.get("TZ_ICON_DIR")


def placeholder(size=64):
    """Neutraler Platzhalter für Spielsymbole (Item-/Blizzard-Icons gibt es offline nicht)."""
    y, x = [v.astype("float32") / (size - 1) for v in __import__("numpy").mgrid[0:size, 0:size]]
    import numpy as np
    t = np.clip(0.55 * x + 0.45 * y, 0, 1)[..., None]
    top, bot = np.array([78, 92, 96], "float32"), np.array([34, 40, 46], "float32")
    rgb = top * (1 - t) + bot * t
    hl = np.clip(1 - np.hypot(x - 0.32, y - 0.28) / 0.42, 0, 1)[..., None] ** 2 * 40
    rgb = np.clip(rgb + hl, 0, 255)
    a = np.full((size, size, 1), 255, "float32")
    return Image.fromarray(np.uint8(np.concatenate([rgb, a], axis=2)), "RGBA")


def texture(name):
    if name in _tex:
        return _tex[name]
    img = None
    m = re.match(r"(?i)^Interface\\AddOns\\([^\\]+)\\Media\\", name)
    if m:  # Media eines eigenen Add-ons (Zentrale liegt eigen, alle anderen unter addons/<Name>/)
        fn = name.split("Media\\")[-1]
        fn = fn if fn.lower().endswith((".tga", ".blp")) else fn + ".tga"
        base = ADDON if m.group(1) == "TirysZentrale" else os.path.join(HERE, "..", "addons", m.group(1))
        p = os.path.join(base, "Media", fn.replace("\\", os.sep))
        if os.path.exists(p):
            img = Image.open(p).convert("RGBA")
    elif name.lower().startswith("interface\\icons\\"):
        base = name.split("\\")[-1].lower()
        for ext in (".jpg", ".png"):
            p = os.path.join(ICON_DIR, base + ext) if ICON_DIR else None
            if p and os.path.exists(p):
                img = Image.open(p).convert("RGBA")
                break
        if img is None:
            img = placeholder()
    elif name.lower() == "interface\\characterframe\\tempportraitalphamask":
        img = circle()
    elif name.replace(".", "").isdigit():
        img = placeholder()
    _tex[name] = img
    return img


def circle(size=256):
    """Blizzards runde Alpha-Maske (TempPortraitAlphaMask): weißer Kreis, weiche Kante."""
    big = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(big).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    a = big.resize((size, size), Image.LANCZOS)
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    img.putalpha(a)
    return img


def nine_slice(src, w, h, m):
    """9-Slice wie SetTextureSliceMargins (Modus 0 = Mitte/Kanten gestreckt); Ränder in Texturpixeln -> UI-Pixel x SCALE."""
    sw, sh = src.size
    l, t, r, b = [int(v) for v in m]
    L, T, R, B = [max(1, int(round(v * SCALE))) for v in (l, t, r, b)]
    if L + R > w:
        L = R = max(1, w // 2)
    if T + B > h:
        T = B = max(1, h // 2)
    out = Image.new("RGBA", (w, h))
    xs = [(0, l, 0, L), (l, sw - r, L, w - R), (sw - r, sw, w - R, w)]
    ys = [(0, t, 0, T), (t, sh - b, T, h - B), (sh - b, sh, h - B, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if dx1 > dx0 and dy1 > dy0 and sx1 > sx0 and sy1 > sy0:
                out.paste(src.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.LANCZOS), (dx0, dy0))
    return out


def add_onto(canvas, piece, pos):
    """Additive Mischung wie SetBlendMode("ADD"): Ziel += Farbe * Alpha."""
    import numpy as np
    x0, y0 = pos
    W, H = canvas.size
    w, h = piece.size
    cx0, cy0, cx1, cy1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    src = np.asarray(piece.crop((cx0 - x0, cy0 - y0, cx1 - x0, cy1 - y0)), dtype=np.float32)
    region = canvas.crop((cx0, cy0, cx1, cy1))
    dst = np.asarray(region, dtype=np.float32).copy()
    dst[..., :3] = np.clip(dst[..., :3] + src[..., :3] * (src[..., 3:4] / 255.0), 0, 255)
    canvas.paste(Image.fromarray(np.uint8(dst), "RGBA"), (cx0, cy0))


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


def draw_seg(canvas, d, x, y, s, f, fill, squeeze, outline):
    """Ein Textstück zeichnen; schmale Schrift horizontal gestaucht, OUTLINE = schwarze Kontur wie im Spiel."""
    w = d.textlength(s, font=f)
    if squeeze == 1 and not outline:
        d.text((x, y), s, font=f, fill=fill)
        return w
    asc, desc = f.getmetrics()
    pad = 3
    tmp = Image.new("RGBA", (int(w) + 2 * pad + 2, asc + desc + 2 * pad))
    kw = {"stroke_width": max(1, int(round(SCALE * 0.8))), "stroke_fill": (0, 0, 0, int(fill[3] * 0.85))} if outline else {}
    ImageDraw.Draw(tmp).text((pad, pad), s, font=f, fill=fill, **kw)
    if squeeze != 1:
        tmp = tmp.resize((max(1, int(tmp.width * squeeze)), tmp.height), Image.LANCZOS)
    ox, oy = int(round(x - pad * squeeze)), int(round(y - pad))
    W, H = canvas.size
    cx0, cy0 = max(0, -ox), max(0, -oy)
    cx1, cy1 = min(tmp.width, W - ox), min(tmp.height, H - oy)
    if cx1 > cx0 and cy1 > cy0:
        canvas.alpha_composite(tmp.crop((cx0, cy0, cx1, cy1)), (ox + cx0, oy + cy0))
    return w * squeeze


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
                if col[3] < 1:  # Region-/Frame-Transparenz wirkt auch auf Verlaeufe
                    piece.putalpha(piece.split()[3].point(lambda v: int(v * max(0.0, col[3]))))
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
                if len(r) > 16 and r[16]:
                    src = nine_slice(src, w, h, r[16].split(","))
                else:
                    src = src.resize((w, h), Image.LANCZOS)
                if piece is not None:
                    alpha = src.split()[3]
                    piece.putalpha(ImageChops.multiply(alpha, piece.split()[3]))
                else:
                    piece = tint(src, col)
            elif piece is None:
                piece = Image.new("RGBA", (w, h), tuple(int(255 * v) for v in col))
            if len(r) > 15 and r[15]:  # Maske (rund) anwenden
                m = texture(r[15])
                if m is not None:
                    ma = m.split()[3].resize(piece.size, Image.LANCZOS)
                    piece = piece.copy()
                    piece.putalpha(ImageChops.multiply(piece.split()[3], ma))
            if len(r) > 17 and r[17] and float(r[17]) != 0:  # SetRotation: um die Mitte drehen (Bogenmaß)
                cx, cy = x0 + w / 2, y0 + h / 2
                piece = piece.rotate(math.degrees(float(r[17])), expand=True, resample=Image.BICUBIC)
                x0, y0 = int(round(cx - piece.width / 2)), int(round(cy - piece.height / 2))
            if r[14] == "ADD":
                add_onto(canvas, piece, (x0, y0))
            else:
                W_, H_ = canvas.size
                cx0, cy0 = max(0, -x0), max(0, -y0)
                cx1, cy1 = min(piece.width, W_ - x0), min(piece.height, H_ - y0)
                if cx1 > cx0 and cy1 > cy0:
                    canvas.alpha_composite(piece.crop((cx0, cy0, cx1, cy1)), (x0 + cx0, y0 + cy0))
        else:
            weight, size = r[5], float(r[6])
            col = tuple(int(255 * float(v)) for v in r[7:11])
            justH, justV, spacing = r[11], r[12], float(r[13])
            lines = r[14].split("\x1f")
            outline = len(r) > 15 and r[15] == "OUTLINE"
            sq = SQUEEZE.get(weight, 1)
            f = font(weight, size)
            lh = (size * 1.2 + spacing) * SCALE
            total = lh * len(lines)
            ty = y0 if justV == "TOP" else y0 + (h - total) / 2 if justV == "MIDDLE" else y1 - total
            d = ImageDraw.Draw(canvas)
            coin = size * SCALE * 0.78
            state = None  # aktuelle |c-Farbe (gilt über Zeilenumbrüche hinweg)
            for i, line in enumerate(lines):
                # Farbcodes |cAARRGGBB ... |r und Symbole (\x01 = |T...|t, z. B. Münzen)
                segs = []
                for tok in TOKEN.findall(line):
                    if tok.startswith("|c") and len(tok) == 10:
                        state = tuple(int(tok[k:k + 2], 16) for k in (4, 6, 8)) + (col[3],)
                    elif tok == "|r":
                        state = None
                    else:
                        segs.append((tok, state or col))
                lw = sum((coin + 2) if s == "\x01" else d.textlength(s, font=f) * sq for s, _ in segs)
                tx = x0 if justH == "LEFT" else (x1 - lw if justH == "RIGHT" else x0 + (w - lw) / 2)
                cy = ty + i * lh + size * SCALE * 0.62
                for s, c in segs:
                    if s == "\x01":
                        d.ellipse((tx + 1, cy - coin / 2, tx + 1 + coin, cy + coin / 2), fill=(232, 190, 72, 255), outline=(150, 110, 30, 255))
                        tx += coin + 2
                    else:
                        tx += draw_seg(canvas, d, tx, ty + i * lh, s, f, c, sq, outline)
    out = path[:-4] + ".png"
    canvas.convert("RGB").save(out)
    return out


if __name__ == "__main__":
    for p in sorted(glob.glob(os.path.join(sys.argv[1], "*.tsv"))):
        print(render(p))
