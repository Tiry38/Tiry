"""KI-Hochskalierung der Konfigurator-Renderings (Real-ESRGAN x4, CPU) für scharfe Nah-Zooms.
Aufruf (venv mit torch + spandrel): python tools/hochskalieren.py <eingang_px_breite> <ziel_suffix>
Liest assets/bike/bNN.png (Konva-Export 3312 px), skaliert auf Eingangsbreite herunter (nahe der Original-Auflösung
der Konfigurator-Ebenen) und rechnet x4 hoch. Transparenz: Farbe an den Kanten auslaufen lassen, Alpha separat hochrechnen."""
import sys, os, glob, hashlib, time, numpy as np, torch, spandrel
from PIL import Image, ImageFilter
D = os.path.join(os.path.dirname(__file__), '../assets/bike/')
W_IN = int(sys.argv[1]); SUF = sys.argv[2]
torch.set_num_threads(os.cpu_count())
m = spandrel.ModelLoader().load_from_file('/tmp/claude-0/esrw/RealESRGAN_x4plus.pth').model.eval()

def run(rgb):  # HxWx3 float 0..1, in Kacheln
    H, W, _ = rgb.shape; T = 256; P = 12; out = np.zeros((H * 4, W * 4, 3), np.float32)
    x = torch.from_numpy(rgb).permute(2, 0, 1)[None]
    for y0 in range(0, H, T):
        for x0 in range(0, W, T):
            ya, xa = max(0, y0 - P), max(0, x0 - P); yb, xb = min(H, y0 + T + P), min(W, x0 + T + P)
            with torch.no_grad(): o = m(x[:, :, ya:yb, xa:xb]).clamp(0, 1)[0].permute(1, 2, 0).numpy()
            oy, ox = (y0 - ya) * 4, (x0 - xa) * 4; h, w = min(T, H - y0) * 4, min(T, W - x0) * 4
            out[y0 * 4:y0 * 4 + h, x0 * 4:x0 * 4 + w] = o[oy:oy + h, ox:ox + w]
    return out

seen = {}
for f in sorted(glob.glob(D + 'b[0-9][0-9].png')):
    t0 = time.time(); im = Image.open(f).convert('RGBA'); key = hashlib.md5(im.tobytes()).hexdigest()
    name = os.path.basename(f)[:-4]; outp = D + name + SUF + '.webp'
    if key in seen: Image.open(seen[key]).save(outp, quality=93, method=4); print(name, 'gleich wie', seen[key]); continue
    h_in = round(im.height * W_IN / im.width); sm = im.resize((W_IN, h_in), Image.LANCZOS)
    a = np.array(sm).astype(np.float32) / 255; al = a[..., 3:4]
    # Farbe in transparente Bereiche ausdehnen (keine dunklen Säume)
    rgb = a[..., :3] * al; wsum = al.copy()
    for r in (2, 4, 8, 16):
        bl = np.array(Image.fromarray((rgb * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
        bw = np.array(Image.fromarray((wsum[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)[..., None] / 255
        fill = np.where(bw > 1e-3, bl / np.maximum(bw, 1e-3), 0); rgb = np.where(wsum > .02, rgb, fill * np.maximum(bw, 0)); wsum = np.maximum(wsum, bw)
    base = np.where(al > .02, a[..., :3], np.clip(rgb / np.maximum(wsum, 1e-3), 0, 1))
    up = run(np.ascontiguousarray(base.astype(np.float32)))
    ua = np.array(Image.fromarray((al[..., 0] * 255).astype(np.uint8)).resize((up.shape[1], up.shape[0]), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    o = np.concatenate([up, ua], axis=2); Image.fromarray((o * 255 + .5).clip(0, 255).astype(np.uint8), 'RGBA').save(outp, quality=93, method=4)
    seen[key] = outp; print(name, o.shape[1], 'px', round(time.time() - t0), 's', flush=True)
