// Lädt die echten CC0-Assets aus web/assets/ (siehe asset-catalog.js) als three.js-Texturen.
// Robust: Jede Datei darf fehlen oder scheitern – dann bleibt der Eintrag null und die Welt nutzt die
// prozeduralen Texturen. Unter file:// wird gar nicht erst geladen (Chromium blockiert dort WebGL-Uploads).
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { TEXTURE_SETS, HDRIS, texturePath, hdriPath } from './asset-catalog.js';

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), ms))]);

export function assetsSupported() {
  return typeof location !== 'undefined' && location.protocol !== 'file:';
}

/**
 * Liefert { textures: { slot: { albedo, normal, arm, opacity, meters } | null }, hdri: { slot: info | null }, count, failed }.
 * hdri-Info: { texture (HalfFloat, equirektangular), sunDir (Vector3, Bildkoordinaten), stats: {zenith, mid, horizonSun, horizonAway} }
 */
export async function loadEnvironmentAssets(renderer, { timeoutMs = 90000 } = {}) {
  const out = { textures: {}, hdri: {}, count: 0, failed: 0 };
  for (const s of TEXTURE_SETS) out.textures[s.slot] = null;
  for (const h of HDRIS) out.hdri[h.slot] = null;
  if (!assetsSupported()) return out;
  const maxAniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const texLoader = new THREE.TextureLoader();
  const jobs = [];
  for (const set of TEXTURE_SETS) {
    const maps = {};
    for (const map of Object.keys(set.maps)) {
      jobs.push(withTimeout(texLoader.loadAsync(texturePath(set.slot, map)), timeoutMs).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = maxAniso;
        t.colorSpace = map === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        maps[map] = t;
        out.count++;
      }, () => { out.failed++; }));
    }
    set._maps = maps;
  }
  const hdrLoader = new HDRLoader().setDataType(THREE.HalfFloatType);
  for (const h of HDRIS) {
    jobs.push(withTimeout(hdrLoader.loadAsync(hdriPath(h.slot)), timeoutMs).then((t) => {
      out.hdri[h.slot] = analyzeHdri(t);
      out.count++;
    }, () => { out.failed++; }));
  }
  await Promise.all(jobs);
  for (const set of TEXTURE_SETS) {
    const m = set._maps;
    delete set._maps;
    if (!m.albedo) { Object.values(m).forEach((t) => t.dispose()); continue; }
    out.textures[set.slot] = { ...m, meters: set.meters || 2 };
  }
  // Fotoblätter → Laubbüschel-Bild (Farbe + Deckkraft kombiniert)
  const lv = out.textures.leaves;
  if (lv && lv.albedo && lv.opacity) {
    try { lv.sprites = leafSprites(lv.albedo.image, lv.opacity.image); } catch { lv.sprites = null; }
  }
  return out;
}

/** Halbfloat-HDRI auswerten: Sonnenrichtung (hellster Punkt) und mittlere Himmelsfarben für den Dunst. */
function analyzeHdri(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = THREE.DataUtils.fromHalfFloat;
  // Sonnenpixel überschreiten den Halbfloat-Bereich (> 65504 → ∞). ∞ ergibt beim Filtern NaN, das über
  // PMREM und Bloom ganze Bildbereiche zerstört → auf einen endlichen Wert begrenzen.
  if (data instanceof Uint16Array) {
    const cap = THREE.DataUtils.toHalfFloat(4000);
    for (let i = 0; i < data.length; i++) if ((data[i] & 0x7c00) === 0x7c00 || (data[i] < 0x8000 && data[i] > cap)) data[i] = cap;
  }
  const stride = data.length / (W * H); // 4 (RGBA)
  const px = (x, y) => {
    const i = (y * W + x) * stride;
    return [half(data[i]), half(data[i + 1]), half(data[i + 2])];
  };
  // Zeile 0 = Zenit (flipY = true lädt die erste Zeile nach v = 1 → Richtung y = +1)
  const dirOf = (x, y) => {
    const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
    const phi = (u - 0.5) * Math.PI * 2, th = (v - 0.5) * Math.PI;
    return new THREE.Vector3(Math.cos(phi) * Math.cos(th), Math.sin(th), Math.sin(phi) * Math.cos(th));
  };
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) {
    const c = px(x, y);
    const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    if (l > best) { best = l; bx = x; by = y; }
  }
  const sunDir = dirOf(bx, by);
  const sunAz = Math.atan2(sunDir.z, sunDir.x);
  const band = (e0, e1, pred) => {
    const acc = [0, 0, 0]; let n = 0;
    const y0 = Math.floor((0.5 - e1 / 180) * H), y1 = Math.ceil((0.5 - e0 / 180) * H);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = 0; x < W; x += 2) {
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      let da = Math.abs(az - sunAz); if (da > Math.PI) da = Math.PI * 2 - da;
      if (!pred(da)) continue;
      const c = px(x, y);
      const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      if (l > best * 0.02 && l > 50) continue; // Sonnenscheibe nicht mitteln
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; n++;
    }
    return new THREE.Color(acc[0] / Math.max(1, n), acc[1] / Math.max(1, n), acc[2] / Math.max(1, n));
  };
  const stats = {
    zenith: band(70, 90, () => true),
    mid: band(18, 32, (da) => da > 1.4),
    horizonAway: band(0.5, 4, (da) => da > 1.9),
    horizonSun: band(0.5, 4, (da) => da < 0.35),
  };
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { texture: tex, sunDir, sunAz, stats };
}

/** Schneidet die 3×3 Blätter des Atlas aus und kombiniert Farbe + Deckkraft zu RGBA-Leinwänden. */
function leafSprites(colorImg, opacityImg) {
  const W = colorImg.width, H = colorImg.height;
  const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const c1 = mk(W, H), c2 = mk(W, H);
  const g1 = c1.getContext('2d', { willReadFrequently: true }), g2 = c2.getContext('2d', { willReadFrequently: true });
  g1.drawImage(colorImg, 0, 0); g2.drawImage(opacityImg, 0, 0, W, H);
  const col = g1.getImageData(0, 0, W, H), op = g2.getImageData(0, 0, W, H);
  // Farbe teilweise entsättigen: Grundton kommt aus der Instanzfarbe (Biom/Baumart), Blattadern bleiben erhalten.
  for (let i = 0; i < col.data.length; i += 4) {
    const r = col.data[i], g = col.data[i + 1], b = col.data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = 0.35;
    col.data[i] = Math.min(255, (l + (r - l) * k) * 1.25);
    col.data[i + 1] = Math.min(255, (l + (g - l) * k) * 1.25);
    col.data[i + 2] = Math.min(255, (l + (b - l) * k) * 1.25);
    col.data[i + 3] = op.data[i];
  }
  g1.putImageData(col, 0, 0);
  const sprites = [];
  const cw = W / 3, ch = H / 3;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const s = mk(Math.round(cw), Math.round(ch));
    s.getContext('2d').drawImage(c1, x * cw, y * ch, cw, ch, 0, 0, s.width, s.height);
    sprites.push(s);
  }
  return sprites;
}

export function disposeAssets(a) {
  if (!a) return;
  for (const s of Object.values(a.textures)) if (s) for (const v of Object.values(s)) if (v && v.isTexture) v.dispose();
  for (const h of Object.values(a.hdri)) if (h) h.texture.dispose();
}
