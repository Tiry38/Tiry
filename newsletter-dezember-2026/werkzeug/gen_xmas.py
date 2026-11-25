# Dezember-Newsletter "Gabentisch": helle, animierte GIFs (laufen in allen Mailprogrammen)
import math, random, subprocess, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

S = '/tmp/claude-0/nl/src/'; F = '/tmp/claude-0/nl/fonts/'; O = '/home/user/Tiry/newsletter-dezember-2026/'
CREAM = (247, 241, 232); INK = (27, 30, 37); RED = (207, 26, 44); KRAFT = (196, 154, 108); MUT = (96, 92, 86); WHITE = (255, 255, 255)

def font(n, s, w=800):
    f = ImageFont.truetype(F + n + '.ttf', s)
    f.set_variation_by_axes([w]); return f

def save_gif(frames, name, delays, colors=200):
    pick = [frames[0], frames[len(frames) // 2], frames[-1]]
    mont = Image.new('RGB', (pick[0].width, pick[0].height * 3))
    for k, fr in enumerate(pick): mont.paste(fr.convert('RGB'), (0, k * pick[0].height))
    pal = mont.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    tmp = O + name + '.raw.gif'
    q[0].save(tmp, save_all=True, append_images=q[1:], duration=delays, loop=0, disposal=1)
    subprocess.run(['convert', tmp, '-layers', 'OptimizeTransparency', '+map', O + name], check=True); os.remove(tmp)
    print(name, len(frames), 'Frames', os.path.getsize(O + name) // 1024, 'KB')

def wald(W, H, strength=.30, yoff=.0):
    """Herbstwald hell und dezent: weichgezeichnet, entsaettigt, mit Creme ueberblendet"""
    src = Image.open(S + 'herbst-1400.webp').convert('RGB')
    sc = max(W / src.width, H / src.height) * 1.02
    src = src.resize((int(src.width * sc), int(src.height * sc)), Image.LANCZOS)
    x0 = (src.width - W) // 2; y0 = int((src.height - H) * yoff)
    im = src.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.GaussianBlur(3))
    im = ImageEnhance.Color(im).enhance(.85); im = ImageEnhance.Brightness(im).enhance(1.35)
    a = np.asarray(im).astype(float) * strength + np.array(CREAM) * (1 - strength)
    return Image.fromarray(a.astype('uint8')).convert('RGBA')

def snow(W, H, n, N, seed, col=(255, 255, 255), size=(1.2, 3.4)):
    r = random.Random(seed)
    fl = [(r.uniform(0, W), r.uniform(0, H), r.uniform(*size), r.choice([1, 1, 2]), r.uniform(0, 6.3)) for _ in range(n)]
    out = []
    for i in range(N):
        L = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(L)
        for x, y, s, k, ph in fl:
            yy = (y + H * k * i / N) % H; xx = x + 5 * math.sin(ph + 2 * math.pi * i / N)
            d.ellipse((xx - s - .8, yy - s - .8, xx + s + .8, yy + s + .8), fill=(150, 160, 175, 70))
            d.ellipse((xx - s, yy - s, xx + s, yy + s), fill=col + (235,))
        out.append(L)
    return out


def leaves(W, H, n, N, seed):
    """fallende Herbstblaetter (wie auf der Homepage), nahtlose Schleife"""
    r = random.Random(seed); cols = [(214, 120, 42), (190, 84, 34), (226, 160, 60), (160, 70, 40), (205, 140, 70)]
    lf = [(r.uniform(0, W), r.uniform(0, H), r.uniform(10, 20), r.choice([1, 1, 2]), r.uniform(0, 6.3), r.choice(cols), r.choice([-1, 1])) for _ in range(n)]
    out = []
    for i in range(N):
        L = Image.new('RGBA', (W, H))
        for x, y, s, k, ph, c, sp in lf:
            t = i / N; yy = (y + H * k * t) % H - s; xx = x + 18 * math.sin(ph + 2 * math.pi * t)
            leaf = Image.new('RGBA', (int(s * 2.4), int(s * 2.4))); dl = ImageDraw.Draw(leaf); m = s * 1.2
            dl.polygon([(m, m - s), (m + s * .55, m - s * .2), (m + s * .35, m + s * .6), (m, m + s), (m - s * .35, m + s * .6), (m - s * .55, m - s * .2)], fill=c + (225,))
            dl.line([(m, m - s * .8), (m, m + s * .95)], fill=(120, 60, 25, 200), width=1)
            leaf = leaf.rotate(sp * 360 * t * k + ph * 57, resample=Image.BICUBIC, expand=True)
            L.alpha_composite(leaf, (int(xx), int(yy)))
        out.append(L)
    return out

def tag(w, h, fill, lines, ink=WHITE):
    """Geschenkanhaenger, Loch oben mittig bei (w/2, 20)"""
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    c = int(w * .2)
    d.polygon([(c, 0), (w - c, 0), (w, c), (w, h), (0, h), (0, c)], fill=fill)
    d.ellipse((w / 2 - 8, 12, w / 2 + 8, 28), fill=CREAM, outline=(0, 0, 0, 60), width=2)
    y = 44
    for txt, f, col in lines:
        bb = d.textbbox((0, 0), txt, font=f)
        d.text(((w - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), txt, font=f, fill=col or ink)
        y += (bb[3] - bb[1]) + 10
    sh = Image.new('RGBA', (w + 30, h + 30)); sh.paste((0, 0, 0, 70), (15, 18), im.getchannel('A').point(lambda v: v))
    sh = sh.filter(ImageFilter.GaussianBlur(7)); sh.alpha_composite(im, (15, 15))
    return sh, (w / 2 + 15, 20 + 15)

def hang(base, tg, pivot_in, at, angle):
    """Anhaenger um sein Loch drehen und an Punkt 'at' (Nagel/Faden) haengen"""
    t, (px, py) = tg, pivot_in
    D = int(math.hypot(t.width, t.height) * 2) + 4
    c = Image.new('RGBA', (D, D)); c.alpha_composite(t, (int(D / 2 - px), int(D / 2 - py)))
    c = c.rotate(angle, resample=Image.BICUBIC, center=(D / 2, D / 2))
    base.alpha_composite(c, (int(at[0] - D / 2), int(at[1] - D / 2)))

def string(d, a, b, col=(120, 90, 60), w=2): d.line([a, b], fill=col, width=w)

def bike_img(path, w):
    b = Image.open(path).convert('RGBA'); b = b.crop(b.getchannel('A').getbbox())
    return b.resize((w, int(b.height * w / b.width)), Image.LANCZOS)

def floor_shadow(base, x, y, w):
    s = Image.new('RGBA', (w + 60, 50)); ImageDraw.Draw(s).ellipse((30, 12, w + 30, 38), fill=(60, 45, 30, 90))
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(9)), (x - 30, y - 25))

# ============ 1) HERO: heller Wald, Schnee, zwei Anhaenger (-20 EUR / Sattelueberzug) ============
W, H, N = 600, 420, 18
bg = wald(W, H, .36, .2)
d = ImageDraw.Draw(bg)
d.text((28, 34), 'WINTER-INSPEKTION', font=font('sora', 15), fill=RED)
d.text((28, 56), 'bis 28.02.2027', font=font('sora', 15, 600), fill=INK)
d.line([(0, 6), (W, 6)], fill=RED, width=0)
fl = snow(W, H, 28, N, 5)
lv = leaves(W, H, 16, N, 21)
t1, p1 = tag(250, 250, RED, [('−20 €', font('sora', 66), None), ('auf jede', font('sora', 20, 600), None), ('Inspektion', font('sora', 20, 600), None)])
sat = Image.open(S + 'sattel.webp').convert('RGBA'); sat = sat.resize((128, int(sat.height * 128 / sat.width)), Image.LANCZOS)
t2, p2 = tag(170, 230, KRAFT, [('GESCHENKT', font('sora', 17), INK)])
t2.alpha_composite(sat, (int(t2.width / 2 - sat.width / 2), 92))
lab = ImageDraw.Draw(t2); lab.text((t2.width / 2 - 50, 205), 'Sattelüberzug', font=font('outfit', 17, 600), fill=INK)
frames = []
for i in range(N):
    f = bg.copy(); f.alpha_composite(lv[i]); dd = ImageDraw.Draw(f)
    a1 = 7 * math.sin(2 * math.pi * i / N); a2 = 9 * math.sin(2 * math.pi * i / N + 2.1)
    string(dd, (300, 0), (300, 110)); string(dd, (470, 0), (470, 150))
    hang(f, t1, p1, (300, 110), a1); hang(f, t2, p2, (470, 150), a2)
    f.alpha_composite(fl[i]); frames.append(f)
save_gif(frames, 'x-hero.gif', [90] * N)

# ============ 2) SIGNATUR: Geschenkpapier reisst auf -> Antelao, -39 % ============
W, H = 600, 400
bg = wald(W, H, .30, .5)
d = ImageDraw.Draw(bg)
ff = font('sora', 190); bb = d.textbbox((0, 0), '−39%', font=ff)
num = Image.new('RGBA', (W, H)); ImageDraw.Draw(num).text((12 - bb[0], 22 - bb[1]), '−39%', font=ff, fill=RED + (255,))
bike = bike_img(S + 'rest-04.webp', 420); bx, by = 30, H - 36 - bike.height
scene = bg.copy(); scene.alpha_composite(num); floor_shadow(scene, bx + 30, H - 40, 380); scene.alpha_composite(bike, (bx, by))
# Kraftpapier
rnd = np.random.default_rng(4)
noise = rnd.normal(0, 3.5, (H, W, 1)); fib = np.zeros((H, W, 1))
for _ in range(90):
    y = rnd.integers(0, H); x = rnd.integers(0, W); L = rnd.integers(20, 90)
    fib[y:y + 1, x:x + L] = rnd.normal(-14, 6)
paper = np.clip(np.array(KRAFT) + noise + fib, 0, 255).astype('uint8')
paper = Image.fromarray(paper).convert('RGBA')
pd = ImageDraw.Draw(paper)
pd.rectangle((0, 168, W, 204), fill=RED); pd.rectangle((392, 0, 428, H), fill=RED)          # Schleifenband
pd.ellipse((330, 140, 410, 200), outline=RED, width=16); pd.ellipse((410, 140, 490, 200), outline=RED, width=16); pd.rectangle((396, 168, 424, 204), fill=(170, 18, 34))
pd.text((40, 230), 'Für dich ausgepackt:', font=font('sora', 26), fill=INK)
pd.text((40, 266), 'unser größter Preisknaller', font=font('outfit', 22, 600), fill=INK)
# gezackte Risskante (fest), Haelften gehen auseinander
r2 = random.Random(9); cut = 300; edge = []
for y in range(0, H + 12, 12): edge.append((cut + r2.randint(-16, 16), y))
maskL = Image.new('L', (W, H)); ImageDraw.Draw(maskL).polygon([(0, 0)] + edge + [(0, H)], fill=255)
maskR = Image.new('L', (W, H)); ImageDraw.Draw(maskR).polygon([(W, 0)] + edge + [(W, H)], fill=255)
L = paper.copy(); L.putalpha(maskL); R = paper.copy(); R.putalpha(maskR)
def edge_shadow(img, m):
    s = Image.new('RGBA', img.size, (40, 25, 10, 0)); s.putalpha(m.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * .55)))
    out = Image.new('RGBA', img.size); out.alpha_composite(s, (0, 0)); out.alpha_composite(img); return out
L = edge_shadow(L, maskL); R = edge_shadow(R, maskR)
tg, tp = tag(160, 170, RED, [('JETZT', font('sora', 15), None), ('2.499 €', font('sora', 34), None), ('UVP 4.099 €', font('outfit', 15, 600), None)])
frames, delays = [], []
f = scene.copy(); f.alpha_composite(L); f.alpha_composite(R); frames.append(f); delays.append(1100)
for i in range(7):  # aufreissen
    t = ((i + 1) / 7) ** 2; dx = int(330 * t); rot = 10 * t
    f = scene.copy()
    l2 = L.rotate(rot, center=(0, H), resample=Image.BICUBIC); r2_ = R.rotate(-rot, center=(W, H), resample=Image.BICUBIC)
    f.alpha_composite(l2, (-dx, 0)); f.alpha_composite(r2_, (dx, 0)); frames.append(f); delays.append(55)
N2 = 14
for i in range(N2):  # Anhaenger schaukelt
    f = scene.copy(); dd = ImageDraw.Draw(f); string(dd, (525, 0), (525, 160))
    hang(f, tg, tp, (525, 160), 9 * math.sin(2 * math.pi * i / N2) * (1 - i / (N2 * 1.6))); frames.append(f); delays.append(90)
delays[-1] = 2200
k0 = 1 + 7
frames = frames[k0:] + frames[:k0]; delays = delays[k0:] + delays[:k0]
save_gif(frames, 'x-antelao.gif', delays)

# ============ 3) UMBAU: Preisschilder fallen auf "UMBAU" ============
W, H, N = 600, 260, 20
bg = Image.new('RGBA', (W, H), CREAM + (255,)); d = ImageDraw.Draw(bg)
d.text((24, 40), 'UMBAU', font=font('sora', 104), fill=INK)
d.text((28, 182), 'Das Regal muss leer –', font=font('outfit', 20, 600), fill=MUT); d.text((28, 208), 'bis zu 70 % auf Zubehör.', font=font('outfit', 20, 600), fill=MUT)
tags = [('−70 %', 505, 0), ('−60 %', 545, 6), ('−50 %', 500, 12), ('−70 %', 550, 15)]
small = {}
for txt, x, st in tags:
    im = Image.new('RGBA', (110, 46)); ImageDraw.Draw(im).rectangle((0, 0, 109, 45), fill=RED)
    ImageDraw.Draw(im).text((12, 8), txt, font=font('sora', 26), fill=WHITE); small[txt + str(x)] = im
frames = []
for i in range(N):
    f = bg.copy()
    for k, (txt, x, st) in enumerate(tags):
        p = ((i - st) % N) / N
        y = -50 + p * (H + 60); rot = 25 * math.sin(p * 6.3 + k)
        im = small[txt + str(x)].rotate(rot, expand=True, resample=Image.BICUBIC)
        f.alpha_composite(im, (x - im.width // 2, int(y)))
    frames.append(f)
save_gif(frames, 'x-umbau.gif', [80] * N, 64)

# ============ 4) VAN RAAM: Anhaenger "Für Mama & Papa" am Lenker ============
W, H, N = 600, 400, 16
bg = wald(W, H, .30, .2)
vr = bike_img(S + 'a-van-raam-ecbad81d7a.webp', 440); vx, vy = 60, H - 26 - vr.height
floor_shadow(bg, vx + 20, H - 26, 400); bg.alpha_composite(vr, (vx, vy))
# Lenkerende: oberer rechter Bereich der Silhouette suchen
a = np.asarray(vr.getchannel('A')); top = int(vr.height * .12); ys, xs = np.nonzero(a[:top] > 128); k = np.argmax(xs)
hx = vx + int(xs[k]) - 6; hy = vy + int(ys[k]) + 4
tg, tp = tag(118, 124, KRAFT, [('Für', font('sora', 18), INK), ('Mama &', font('sora', 18), INK), ('Papa', font('sora', 18), INK)])
fl = leaves(W, H, 10, N, 33)
frames = []
for i in range(N):
    f = bg.copy(); dd = ImageDraw.Draw(f); string(dd, (hx, hy), (hx, hy + 14), RED, 3)
    hang(f, tg, tp, (hx, hy + 14), 11 * math.sin(2 * math.pi * i / N)); f.alpha_composite(fl[i]); frames.append(f)
save_gif(frames, 'x-vanraam.gif', [90] * N)

# ============ 5) KLINGEL: Ortungswellen + Pin ============
W, H, N = 600, 240, 16
bg = Image.new('RGBA', (W, H), CREAM + (255,))
kl = Image.open(S + 'k-klingel.png').convert('RGBA'); kl = kl.crop(kl.getchannel('A').getbbox()); kl = kl.resize((130, int(kl.height * 130 / kl.width)), Image.LANCZOS)
cx, cy = 120, 120
d = ImageDraw.Draw(bg)
d.text((290, 52), 'Gefunden.', font=font('sora', 40), fill=INK)
d.text((292, 106), 'Klingel mit GPS – AirBell Pro', font=font('outfit', 19, 600), fill=MUT)
d.text((292, 142), '39,95 €', font=font('sora', 46), fill=RED)
d.text((294, 198), 'einmalig · weltweite Ortung · ohne Abo', font=font('outfit', 15, 400), fill=MUT)
frames = []
for i in range(N):
    f = bg.copy(); L = Image.new('RGBA', (W, H)); dl = ImageDraw.Draw(L)
    for k in range(3):
        p = ((i / N) + k / 3) % 1; r = 40 + p * 120
        dl.ellipse((cx - r, cy - r, cx + r, cy + r), outline=RED + (int(220 * (1 - p)),), width=4)
    f.alpha_composite(L); f.alpha_composite(kl, (cx - kl.width // 2, cy - kl.height // 2))
    # Pin huepft
    py = 40 - abs(math.sin(math.pi * i / N)) * 16; pd = ImageDraw.Draw(f)
    pd.ellipse((236, py, 262, py + 26), fill=RED); pd.polygon([(238, py + 18), (260, py + 18), (249, py + 40)], fill=RED); pd.ellipse((244, py + 8, 254, py + 18), fill=WHITE)
    frames.append(f)
save_gif(frames, 'x-klingel.gif', [80] * N, 128)

# ============ 6) WERKSTATT: Softwareupdate laeuft ============
W, H = 600, 280
bm = Image.open(S + 'bosch-motor.webp').convert('RGB'); bm = bm.crop((520, 0, 1920, 450)).resize((W, int(450 * W / 1400)), Image.LANCZOS)
bm = ImageEnhance.Brightness(bm).enhance(1.25)
bg = Image.new('RGBA', (W, H), CREAM + (255,)); bg.alpha_composite(bm.convert('RGBA'), (0, H - bm.height))
d = ImageDraw.Draw(bg); d.rectangle((20, 22, 330, 150), fill=WHITE)
d.text((38, 36), 'BOSCH-WERKSTATT IM HAUS', font=font('sora', 12), fill=RED)
d.text((38, 58), 'Softwareupdate', font=font('sora', 26), fill=INK)
frames, delays = [], []
for i in range(19):
    p = min(1, i / 15); f = bg.copy(); dd = ImageDraw.Draw(f)
    dd.rectangle((38, 102, 312, 116), fill=(228, 222, 214)); dd.rectangle((38, 102, 38 + int(274 * p), 116), fill=RED)
    if p < 1: dd.text((38, 122), f'läuft … {int(p * 100)} %', font=font('outfit', 15, 600), fill=MUT)
    else:
        dd.line([(40, 131), (45, 137), (55, 124)], fill=(20, 140, 70), width=3); dd.text((62, 122), 'fertig – Rad startklar', font=font('outfit', 15, 600), fill=(20, 140, 70))
    frames.append(f); delays.append(120 if p < 1 else 300)
delays[-1] = 2000
frames = frames[-1:] + frames[:-1]; delays = delays[-1:] + delays[:-1]
save_gif(frames, 'x-werkstatt.gif', delays)

# ============ 7) FINANZIERUNG: Zahlen rollen auf 0 ============
W, H = 600, 170
bg = Image.new('RGBA', (W, H), CREAM + (255,)); d = ImageDraw.Draw(bg)
fN = font('sora', 92)
cols = [(24, '%', 'Finanzierung', RED), (300, '€', 'Anzahlung', INK)]
for x, u, lab, c in cols:
    d.text((x + 4, 128), lab, font=font('sora', 18), fill=INK)
frames, delays = [], []
seq = list(range(9, -1, -1))
for i, v in enumerate(seq + [0] * 3):
    f = bg.copy(); dd = ImageDraw.Draw(f)
    for k, (x, u, lab, c) in enumerate(cols):
        val = seq[min(len(seq) - 1, max(0, i - k * 2))]
        dd.text((x, 14), f'{val} {u}', font=fN, fill=c)
    frames.append(f); delays.append(70 + i * 12)
delays[-1] = 2600
frames = frames[-1:] + frames[:-1]; delays = delays[-1:] + delays[:-1]
save_gif(frames, 'x-geld.gif', delays, 64)

# Seitenhintergrund: heller Wald fuer den Rand am Desktop
w = wald(1400, 900, .24, .3).convert('RGB'); w.save(O + 'x-wald.jpg', quality=62, optimize=True, progressive=True)
print('x-wald.jpg', os.path.getsize(O + 'x-wald.jpg') // 1024, 'KB')

# ============ 8) E-Bike unterm Baum ab 2.239 EUR: grosser Anhaenger ============
W, H, N = 600, 300, 16
bg = wald(W, H, .30, .3); d = ImageDraw.Draw(bg)
d.text((28, 70), 'Das E-Bike', font=font('sora', 40), fill=INK)
d.text((28, 118), 'unterm Baum', font=font('sora', 40), fill=INK)
d.text((30, 182), 'Velo de Ville · Bosch · ab Lager', font=font('outfit', 18, 600), fill=MUT)
t, tpv = tag(210, 190, RED, [('AB', font('sora', 18), None), ('2.239 €', font('sora', 44), None), ('statt UVP 3.199 €', font('outfit', 15, 600), None)])
r2_ = Image.new('RGBA', (60, 40)); ImageDraw.Draw(r2_).ellipse((0, 4, 28, 34), outline=RED + (255,), width=6); ImageDraw.Draw(r2_).ellipse((30, 4, 58, 34), outline=RED + (255,), width=6)
lvs = leaves(W, H, 9, N, 44); frames = []
for i in range(N):
    f = bg.copy(); f.alpha_composite(lvs[i]); dd = ImageDraw.Draw(f); string(dd, (450, 0), (450, 52), RED, 4)
    f.alpha_composite(r2_, (420, 30)); hang(f, t, tpv, (450, 56), 8 * math.sin(2 * math.pi * i / N)); frames.append(f)
save_gif(frames, 'x-ebike.gif', [90] * N)
