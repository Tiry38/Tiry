// Prozedural erzeugte Texturen (DataTexture, keine externen Dateien).
import * as THREE from 'three';
import { rng, noise2, fbm2, worley2, smoothstep, clamp } from './noise.js';

function dataTex(data, size, { srgb = false, repeat = true } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Steinplatten-Boden (kachelbar): Albedo + Normalmap. Eine Kachel = 8 Welteinheiten.
 * Reihen versetzter Platten mit gefasten Kanten, Fugen, Patina.
 */
export function createFlagstoneTextures(size = 512) {
  const R = rng(7);
  const rowH = [];
  let accH = 0;
  while (accH < 0.999) { const h = Math.min(1 - accH, [0.125, 0.1875, 0.25][Math.floor(R() * 3)]); rowH.push([accH, h]); accH += h; }
  const rows = rowH.length;
  const rowStones = [];
  for (let r = 0; r < rows; r++) {
    // Plattenbreiten in [0,1] je Reihe, kachelbar
    const widths = [];
    let acc = 0;
    while (acc < 1) { const w = rowH[r][1] * (0.9 + R() * 1.4); widths.push(w); acc += w; }
    const scale = 1 / acc;
    let x = R();
    const stones = widths.map((w) => {
      const s = { x0: x, w: w * scale, tone: R(), hue: R(), id: R() };
      x += w * scale;
      return s;
    });
    rowStones.push(stones);
  }
  const height = new Float32Array(size * size);
  const albedo = new Uint8Array(size * size * 4);
  const bevel = 0.018;
  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    let r = 0;
    while (r < rows - 1 && v >= rowH[r + 1][0]) r++;
    const fy = (v - rowH[r][0]) / rowH[r][1]; // 0..1 innerhalb der Reihe
    const rhgt = rowH[r][1];
    const stones = rowStones[r];
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      // finde Platte (mit Umlauf)
      let st = stones[0], lu = 0;
      for (const s of stones) {
        let d = u - s.x0; d -= Math.floor(d);
        if (d < s.w) { st = s; lu = d / s.w; break; }
      }
      const ex = Math.min(lu, 1 - lu) * st.w; // Abstand zur Kante in Kachel-Einheiten
      const ey = Math.min(fy, 1 - fy) * rhgt;
      // abgerundete Ecken
      const cx = Math.max(0, bevel - ex), cy = Math.max(0, bevel - ey);
      const corner = bevel - Math.sqrt(cx * cx + cy * cy);
      const edge = Math.min(ex, ey, corner + Math.min(ex, ey) * 0);
      const dEdge = Math.min(edge, corner);
      const n1 = fbm2(u * 16, v * 16, 4, 3, 16);
      const n2 = fbm2(u * 48, v * 48, 3, 9, 48);
      let h = smoothstep(0.002, bevel, dEdge + n1 * 0.004);
      h = h * (0.85 + 0.1 * n1 + 0.05 * n2) + 0.12 * (n2 * 0.5);
      const grout = 1 - smoothstep(0.0015, 0.005, dEdge + n2 * 0.002);
      height[py * size + px] = h;
      // Farbe: warmer Sandstein mit leichter Varianz, Fugen dunkel-violett
      const t = st.tone, hu = st.hue;
      let cr = 0.80 + 0.12 * t - 0.06 * hu, cg = 0.71 + 0.09 * t - 0.03 * hu, cb = 0.58 + 0.05 * t + 0.07 * hu;
      const patina = 0.88 + 0.16 * n1 + 0.06 * n2;
      cr *= patina; cg *= patina; cb *= patina;
      // dunklere Ränder (Abnutzung)
      const wear = smoothstep(0.0, bevel * 1.8, dEdge);
      const k = 0.82 + 0.18 * wear;
      cr *= k; cg *= k; cb *= k * 1.02;
      cr = cr * (1 - grout) + 0.17 * grout; cg = cg * (1 - grout) + 0.14 * grout; cb = cb * (1 - grout) + 0.16 * grout;
      const i = (py * size + px) * 4;
      albedo[i] = clamp(cr, 0, 1) * 255; albedo[i + 1] = clamp(cg, 0, 1) * 255; albedo[i + 2] = clamp(cb, 0, 1) * 255; albedo[i + 3] = 255;
    }
  }
  const normal = new Uint8Array(size * size * 4);
  const strength = 6.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hx0 = height[y * size + ((x - 1 + size) % size)], hx1 = height[y * size + ((x + 1) % size)];
      const hy0 = height[((y - 1 + size) % size) * size + x], hy1 = height[((y + 1) % size) * size + x];
      let nx = (hx0 - hx1) * strength, ny = (hy0 - hy1) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      normal[i] = (nx * 0.5 + 0.5) * 255; normal[i + 1] = (ny * 0.5 + 0.5) * 255; normal[i + 2] = (nz * 0.5 + 0.5) * 255; normal[i + 3] = 255;
    }
  }
  return { map: dataTex(albedo, size, { srgb: true }), normalMap: dataTex(normal, size) };
}

/** Kachelbares Wolkenrauschen: R = fbm, G = invertiertes Zellrauschen grob, B = fein, A = Detail-fbm. */
export function createCloudNoise(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const a = fbm2(u * 4, v * 4, 5, 11, 4) * 0.5 + 0.5;
      // Kuppeln (Cumulus-Bällchen) aus Zellrauschen
      const dome = (d, r) => Math.sqrt(Math.max(0, 1 - (d / r) * (d / r)));
      const wu = u + fbm2(u * 3, v * 3, 3, 5, 3) * 0.03, wv = v + fbm2(u * 3 + 7, v * 3, 3, 6, 3) * 0.03;
      const w1 = dome(worley2(wu * 6, wv * 6, 6, 21), 0.95);
      const w2 = dome(worley2(wu * 13, wv * 13, 13, 37), 0.9);
      const w3 = dome(worley2(wu * 27, wv * 27, 27, 51), 0.9);
      const b = w2 * 0.65 + w3 * 0.35;
      const d = fbm2(u * 16, v * 16, 4, 61, 16) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      data[i] = clamp(a, 0, 1) * 255;
      data[i + 1] = clamp(w1, 0, 1) * 255;
      data[i + 2] = clamp(b, 0, 1) * 255;
      data[i + 3] = clamp(d, 0, 1) * 255;
    }
  }
  return dataTex(data, size);
}

/** Runenband: Glyphen in einer Zeile (u läuft entlang des Bandes). */
export function createRuneStrip(w = 1024, h = 64) {
  const data = new Uint8Array(w * h * 4);
  const R = rng(42);
  const field = new Float32Array(w * h);
  const stamp = (x, y, r, val) => {
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1));
    const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(h - 1, Math.ceil(y + r + 1));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      const a = clamp(r + 0.5 - d, 0, 1) * val;
      const k = yy * w + xx;
      if (a > field[k]) field[k] = a;
    }
  };
  const line = (x0, y0, x1, y1, r = 1.6) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) stamp(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, 1);
  };
  const glyphs = 16;
  const gw = w / glyphs;
  for (let g = 0; g < glyphs; g++) {
    const cx = g * gw + gw / 2, cy = h / 2;
    const s = h * 0.28;
    // senkrechter Hauptstrich + 2-3 Äste/Bögen
    line(cx, cy - s, cx, cy + s);
    const n = 2 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const yA = cy + (R() * 2 - 1) * s, dir = R() < 0.5 ? -1 : 1;
      const len = s * (0.5 + R() * 0.6);
      const typ = R();
      if (typ < 0.45) line(cx, yA, cx + dir * len, yA + (R() * 2 - 1) * len * 0.8);
      else if (typ < 0.75) {
        for (let a = 0; a < Math.PI; a += 0.15) stamp(cx + dir * Math.sin(a) * len * 0.6, yA + Math.cos(a) * len * 0.5, 1.5, 1);
      } else stamp(cx + dir * len * 0.7, yA, 2.6, 1);
    }
    // Trennpunkte
    stamp(g * gw, cy, 1.8, 0.7);
  }
  // durchgehende Begleitlinien oben/unten
  for (let x = 0; x < w; x++) { stamp(x, 5, 1.0, 0.75); stamp(x, h - 6, 1.0, 0.75); }
  // weicher Schein (Box-Blur) + scharfe Linie
  const blur = new Float32Array(w * h);
  const rad = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -rad; dy <= rad; dy += 2) for (let dx = -rad; dx <= rad; dx += 2) {
      const yy = y + dy; if (yy < 0 || yy >= h) continue;
      s += field[yy * w + ((x + dx + w) % w)]; c++;
    }
    blur[y * w + x] = s / c;
  }
  for (let i = 0; i < w * h; i++) {
    const v = clamp(field[i] + blur[i] * 0.8, 0, 1);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v * 255; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Runensiegel (Kreis) für das Königsplateau und Portalböden. */
export function createSealTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  const R = rng(5);
  const ticks = [];
  for (let i = 0; i < 48; i++) ticks.push(R());
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    const ring = (rr, wdt) => Math.max(0, 1 - Math.abs(r - rr) / wdt);
    let val = ring(0.96, 0.012) + ring(0.90, 0.008) * 0.8 + ring(0.62, 0.01) + ring(0.56, 0.006) * 0.7 + ring(0.22, 0.01) * 0.8;
    // Runenband zwischen 0.90 und 0.96
    const seg = (a / (Math.PI * 2) + 0.5) * 48;
    const si = Math.floor(seg), sf = seg - si;
    if (r > 0.905 && r < 0.955) {
      const t = ticks[si % 48];
      const m = t < 0.33 ? (Math.abs(sf - 0.5) < 0.08 ? 1 : 0) : t < 0.66 ? (Math.abs(sf - 0.3) < 0.06 || Math.abs(sf - 0.7) < 0.06 ? 1 : 0) : (Math.abs((r - 0.93) * 40 - (sf - 0.5) * 2) < 0.25 ? 1 : 0);
      val += m * 0.9;
    }
    // Strahlen & Sternpolygon
    const spokes = Math.pow(Math.max(0, Math.cos(a * 8)), 60) * (r > 0.22 && r < 0.56 ? 0.8 : 0);
    val += spokes;
    for (let k = 0; k < 2; k++) {
      // zwei verschränkte Quadrate
      const rot = k * Math.PI / 4;
      const ca = Math.cos(a - rot), sa = Math.sin(a - rot);
      const d = Math.max(Math.abs(r * ca), Math.abs(r * sa));
      val += Math.max(0, 1 - Math.abs(d - 0.42) / 0.008) * 0.85;
    }
    val += Math.max(0, 1 - r / 0.08) * 0.6;
    const glow = Math.exp(-Math.pow((r - 0.6) / 0.35, 2)) * 0.12;
    const out = clamp(val + glow, 0, 1) * smoothstep(1.0, 0.97, r);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = out * 255; data[i + 3] = 255;
  }
  return dataTex(data, size, { repeat: false });
}

/** Weicher, verrauschter Nebelfleck (für Schwaden/Gischt). */
export function createWispTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u * 0.9, v * 1.25);
    const n = fbm2(x / size * 5, y / size * 5, 5, 3) * 0.5 + 0.5;
    const n2 = noise2(x / size * 14, y / size * 14, 8);
    const edge = 1 - smoothstep(0.7, 0.98, Math.max(Math.abs(u), Math.abs(v)));
    const a = clamp((1 - smoothstep(0.2, 0.95, r + (n - 0.5) * 0.6)) * (0.55 + 0.6 * n) * (0.85 + 0.15 * n2) * edge, 0, 1);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = a * 255;
  }
  return dataTex(data, size, { repeat: false });
}
