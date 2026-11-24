# PNG -> WebP + Kontur-Bilder (Lichtlinien) für den Aufbau. python3 tools/konturen.py
from PIL import Image, ImageFilter; import numpy as np, glob, os
D = os.path.join(os.path.dirname(__file__), '../assets/bike/')
for f in sorted(glob.glob(D + 'b*.png')): Image.open(f).save(f[:-4] + '.webp', quality=92, method=5)
for name, src in (('line0', 'b00'), ('line1', 'b16')):
    a = np.array(Image.open(D + src + '.png').convert('RGBA')).astype(np.float32); al = a[..., 3] / 255
    L = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]) / 255 * al
    e1 = np.array(Image.fromarray((L * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    e2 = np.array(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)).filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    o = np.zeros(a.shape, np.uint8); o[..., :3] = 255; o[..., 3] = np.clip(e1 * 3 + e2 * 2, 0, 255).astype(np.uint8)
    Image.fromarray(o).save(D + name + '.webp', quality=90)
