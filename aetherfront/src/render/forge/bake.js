// Aether-Forge – Backen je Vertex aus dem SDF: glatte Normalen (Gradient), Material/Farbe des Besitzer-Primitivs
// (weich gemischt an Übergängen), Umgebungsverdeckung (Kegel-Abtastung im Distanzfeld), Krümmung (Kantenabnutzung),
// Hohlräume (Schmutz), Dicke (für unechte Unterflächenstreuung).
import { gradient, fbm, BIG } from './sdf.js';

// Materialklassen: [Rauheit, Metall, Shader-ID]
// Shader-IDs: 0 allgemein, 1 Stahl/Eisen, 2 Edelmetall (Gold/Kupfer/Bronze), 3 Leder, 4 Stoff, 5 Haut, 6 Haar/Fell,
//             7 Holz/Rinde, 8 Stein/Knochen, 9 Kristall, 10 Blatt, 11 Auge, 12 Lack/Emaille
export const MATS = {
  steel: [0.3, 1, 1], metal: [0.34, 1, 1], silver: [0.24, 1, 1], iron: [0.5, 0.95, 1], dmetal: [0.46, 0.92, 1], mail: [0.42, 1, 1],
  gold: [0.26, 1, 2], copper: [0.33, 1, 2], bronze: [0.38, 1, 2], brass: [0.3, 1, 2],
  leather: [0.58, 0, 3], dleather: [0.66, 0, 3],
  cloth: [0.86, 0, 4], silk: [0.48, 0, 4], velvet: [0.92, 0, 4], linen: [0.8, 0, 4],
  skin: [0.5, 0, 5], lips: [0.38, 0, 5],
  hair: [0.4, 0, 6], fur: [0.88, 0, 6], feather: [0.66, 0, 6],
  wood: [0.68, 0, 7], bark: [0.94, 0, 7],
  stone: [0.86, 0, 8], bone: [0.56, 0, 8], horn: [0.42, 0, 8], lava: [0.9, 0, 8],
  crystal: [0.06, 0.1, 9], gem: [0.06, 0.2, 9],
  leaf: [0.62, 0, 10], moss: [0.95, 0, 10],
  eye: [0.08, 0, 11],
  lacquer: [0.28, 0.15, 12], enamel: [0.22, 0.1, 12], chitin: [0.3, 0.15, 12], scale: [0.42, 0.1, 12], paint: [0.4, 0.3, 12],
  glow: [1, 0, 0], void: [0.5, 0, 0],
};

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export function hexLin(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [srgbToLin(((v >> 16) & 255) / 255), srgbToLin(((v >> 8) & 255) / 255), srgbToLin((v & 255) / 255)];
}
const SLOTS = { primary: 1, secondary: 2, metal: 3, glow: 4 };
/** Farbangabe → { rgb (linear), slot, k } */
export function resolveColor(col, palette) {
  if (Array.isArray(col)) return { rgb: col.slice(0, 3), slot: 0, k: 1 };
  if (col && typeof col === 'object' && col.isColor) return { rgb: [col.r, col.g, col.b], slot: 0, k: 1 };
  if (typeof col === 'string') {
    const m = col.match(/^(\w+)(?:\*([\d.]+))?$/);
    if (m && SLOTS[m[1]]) {
      const k = m[2] ? +m[2] : 1;
      const base = palette[m[1]] ? hexLin(palette[m[1]]) : [0.5, 0.5, 0.5];
      return { rgb: base.map((v) => v * k), slot: SLOTS[m[1]], k };
    }
    if (col[0] === '#') return { rgb: hexLin(col), slot: 0, k: 1 };
    const mm = col.match(/^(#[0-9a-fA-F]{3,6})\*([\d.]+)$/);
    if (mm) return { rgb: hexLin(mm[1]).map((v) => v * +mm[2]), slot: 0, k: 1 };
  }
  return { rgb: [0.5, 0.5, 0.5], slot: 0, k: 1 };
}

/** Beschnittene Abfrage-Bäume nach Raumzellen zwischenspeichern */
export function makeQuery(root, cell = 0.05, margin = 0.02) {
  const cache = new Map();
  const get = (x, y, z) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell), k = Math.floor(z / cell);
    const key = `${i},${j},${k}`;
    let t = cache.get(key);
    if (t === undefined) {
      const box = [i * cell - margin, j * cell - margin, k * cell - margin, (i + 1) * cell + margin, (j + 1) * cell + margin, (k + 1) * cell + margin];
      t = root.prune(box) || null;
      cache.set(key, t);
    }
    return t;
  };
  const out = { a: null, a2: null, w2: 0 };
  return {
    d(x, y, z) { const t = get(x, y, z); return t ? t.ev(x, y, z) : BIG; },
    ev(x, y, z) { const t = get(x, y, z); return t ? t.ev(x, y, z) : BIG; },
    attr(x, y, z) { const t = get(x, y, z); if (!t) return { d: BIG, a: null, a2: null, w2: 0 }; const d = t.ea(x, y, z, out); return { d, a: out.a, a2: out.a2, w2: out.w2 }; },
  };
}

/** Halbkugel-Richtungen (Fibonacci) */
function hemiDirs(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = 1 - (i + 0.5) / n * 0.92, r = Math.sqrt(1 - z * z), a = i * 2.39996323;
    out.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  return out;
}
const DIRS = hemiDirs(10);

/**
 * Attribute für Vertices backen.
 * verts: Float64Array (n*3). self: Abfrage der eigenen Ebene. occ: Abfrage der Verdecker (Körper aller Stufen).
 * Rückgabe: { normal: Float32Array, color: Float32Array, pbr: Float32Array(4n), bake: Float32Array(4n), slot, owner }
 */
export function bakeVertices(verts, self, occ, palette, o = {}) {
  const n = verts.length / 3;
  const normal = new Float32Array(n * 3), color = new Float32Array(n * 3), pbr = new Float32Array(n * 4), bake = new Float32Array(n * 4);
  const slot = new Uint8Array(n), slotK = new Float32Array(n);
  const owners = new Array(n), owners2 = new Array(n), w2s = new Float32Array(n);
  const s = o.scale || 1;
  const aoSteps = o.aoSteps || [0.012, 0.03, 0.06, 0.11, 0.18].map((v) => v * s);
  const colCache = new Map();
  const colOf = (a) => { let c = colCache.get(a); if (!c) { c = resolveColor(a.col, palette); colCache.set(a, c); } return c; };
  for (let i = 0; i < n; i++) {
    let x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
    const g = gradient(self.d, x, y, z, o.eps || 0.0012);
    normal[i * 3] = g[0]; normal[i * 3 + 1] = g[1]; normal[i * 3 + 2] = g[2];
    // Besitzer leicht innerhalb abfragen (stabil an Übergängen)
    const q = self.attr(x - g[0] * 0.0004, y - g[1] * 0.0004, z - g[2] * 0.0004);
    const A = q.a || { mat: 'cloth', col: '#808080', vary: 0 };
    owners[i] = A; owners2[i] = q.a2; w2s[i] = q.w2;
    const ca = colOf(A);
    let r = ca.rgb[0], gg = ca.rgb[1], b = ca.rgb[2];
    if (q.a2 && q.w2 > 0.02) {
      const cb = colOf(q.a2), t = Math.min(0.5, q.w2);
      r += (cb.rgb[0] - r) * t; gg += (cb.rgb[1] - gg) * t; b += (cb.rgb[2] - b) * t;
    }
    // Farbverlauf
    let lum = 1;
    if (A.grad) {
      const gr = A.grad, ax = { x: 0, y: 1, z: 2 }[gr.axis || 'y'];
      const v = [x, y, z][ax];
      let t = Math.min(1, Math.max(0, (v - gr.from) / (gr.to - gr.from)));
      t = t * t * (3 - 2 * t);
      if (gr.col) { const cg = resolveColor(gr.col, palette).rgb; r += (cg[0] - r) * t; gg += (cg[1] - gg) * t; b += (cg[2] - b) * t; }
      if (gr.k !== undefined) lum *= 1 + (gr.k - 1) * t;
    }
    if (typeof A.col === 'function') { const c = A.col(x, y, z); r = c[0]; gg = c[1]; b = c[2]; }
    // Farbvariation (niedrige Frequenz) – lebendige Oberflächen
    const vary = A.vary ?? 0.06;
    if (vary) {
      const nv = fbm(x * 9 + 3.1, y * 9, z * 9, 2) * 0.7 + fbm(x * 31, y * 31 + 7, z * 31, 2) * 0.3;
      lum *= 1 + vary * 1.6 * nv;
    }
    color[i * 3] = r * lum; color[i * 3 + 1] = gg * lum; color[i * 3 + 2] = b * lum;
    slot[i] = ca.slot; slotK[i] = ca.slot ? ca.k * lum : 0;
    const M = MATS[A.mat] || MATS.cloth;
    pbr[i * 4] = M[0]; pbr[i * 4 + 1] = M[1]; pbr[i * 4 + 2] = M[2] / 15; pbr[i * 4 + 3] = Math.min(1, Math.max(0, A.wear ?? 1));
    if (q.a2 && q.w2 > 0.25) {
      const M2 = MATS[q.a2.mat] || MATS.cloth;
      const t = (q.w2 - 0.25) * 0.8;
      pbr[i * 4] += (M2[0] - M[0]) * t; pbr[i * 4 + 1] += (M2[1] - M[1]) * t;
    }
    if (o.skipBake) { bake[i * 4 + 3] = 1; continue; }
    // ---- Umgebungsverdeckung: entlang der Normale + Halbkugel-Kegel ----
    const nx = g[0], ny = g[1], nz = g[2];
    let occN = 0, wsum = 0;
    for (let k = 0; k < aoSteps.length; k++) {
      const hh = aoSteps[k];
      const d = occ.d(x + nx * hh, y + ny * hh, z + nz * hh);
      const w = 1 / (1 + k * 0.6);
      occN += w * Math.max(0, (hh - Math.max(-hh, Math.min(hh, d))) / hh);
      wsum += w;
    }
    occN /= wsum;
    // Tangentenbasis
    const tx = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = ny * tx[2] - nz * tx[1], uy = nz * tx[0] - nx * tx[2], uz = nx * tx[1] - ny * tx[0];
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    let vis = 0;
    for (const [a, bb, c] of DIRS) {
      const dx = ux * a + vx * bb + nx * c, dy = uy * a + vy * bb + ny * c, dz = uz * a + vz * bb + nz * c;
      let v = 1, t = 0.008 * s;
      for (let st = 0; st < 5; st++) {
        const d = occ.d(x + dx * t, y + dy * t, z + dz * t);
        v = Math.min(v, Math.max(0, d) / (t * 0.55));
        if (v <= 0) break;
        t *= 2.05;
      }
      vis += Math.min(1, v) * c;
    }
    let wn = 0; for (const d of DIRS) wn += d[2];
    vis /= wn;
    let occl = Math.min(1, 0.45 * occN + 0.75 * (1 - vis));
    // Bodennähe (Füße stehen im Gras/Staub)
    if (o.ground !== false) occl = Math.max(occl, 0.35 * (1 - Math.min(1, y / (0.12 * s))));
    // ---- Krümmung (Laplace) klein + groß ----
    const lap = (e, f) => (f(x + e, y, z) + f(x - e, y, z) + f(x, y + e, z) + f(x, y - e, z) + f(x, y, z + e) + f(x, y, z - e) - 6 * f(x, y, z)) / (e * e);
    const curv = lap(0.003 * s, self.d) * 0.003 * s;     // ≈ e·2H
    const cav = lap(0.014 * s, occ.d) * 0.014 * s;
    // ---- Dicke (für Durchscheinen) ----
    let th = 1;
    for (const hh of [0.006, 0.014, 0.03]) {
      const d = self.d(x - nx * hh * s, y - ny * hh * s, z - nz * hh * s);
      th = Math.min(th, Math.max(0, -d) / (hh * s * 0.5));
    }
    bake[i * 4] = occl;
    bake[i * 4 + 1] = Math.max(-1, Math.min(1, curv * 3.5));
    bake[i * 4 + 2] = Math.max(-1, Math.min(1, cav * 2.0));
    bake[i * 4 + 3] = Math.max(0, Math.min(1, th));
  }
  return { normal, color, pbr, bake, slot, slotK, owners, owners2, w2s };
}
