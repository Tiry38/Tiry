// Schwebeinseln: organische Oberseite (Gras/Erde) + hängender Felskörper mit Gesteinsschichten.
import * as THREE from 'three';
import { rng, fbm2, fbm3, noise2, noise3, smoothstep, lerp, clamp } from './noise.js';

// Gesteinsschichten (linear, warm → violett)
const STRATA = [
  [0.30, 0.24, 0.18], [0.40, 0.32, 0.23], [0.21, 0.18, 0.16], [0.34, 0.28, 0.22],
  [0.19, 0.17, 0.16], [0.44, 0.36, 0.26], [0.26, 0.22, 0.19], [0.17, 0.15, 0.14],
];

export function strataColor(y, x, z, seed = 0) {
  const n = fbm3(x * 0.03, y * 0.05, z * 0.03, 3, seed) * 2.2;
  const b = (y + n) / 2.6;
  const i = Math.floor(b), f = b - i;
  const c0 = STRATA[((i % 8) + 8) % 8], c1 = STRATA[(((i + 1) % 8) + 8) % 8];
  const t = smoothstep(0.75, 1.0, f);
  const dark = 0.82 + 0.18 * noise2(x * 0.2 + y * 0.4, z * 0.2, seed + 5);
  return [lerp(c0[0], c1[0], t) * dark, lerp(c0[1], c1[1], t) * dark, lerp(c0[2], c1[2], t) * dark];
}

export function superellipse(a, b, n = 4) {
  return (th) => {
    const c = Math.abs(Math.cos(th)) / a, s = Math.abs(Math.sin(th)) / b;
    return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
  };
}

/**
 * opts: cx, cz, topY, radius(θ) Funktion, depth, seed, segs, rings, sideRings,
 * height(x,z,t) (Zusatzhöhe Oberseite), grass(x,z,t) -> [r,g,b] oder null, rimDrop, edgeNoise
 */
export function buildIsland(opts) {
  const {
    cx = 0, cz = 0, topY = 0, radius, depth = 30, seed = 1, segs = 128, rings = 18, sideRings = 30,
    height = null, grass = null, rimDrop = 1.6, edgeNoise = 0.07, taper = 0.62, lobes = 0.35, rough = 1,
  } = opts;
  const R = rng(seed);
  const pos = [], col = [];
  const S = segs;
  const ang = (i) => (i / S) * Math.PI * 2;
  const edgeR = [];
  const lobe = [];
  for (let i = 0; i < S; i++) {
    const th = ang(i);
    const ca = Math.cos(th), sa = Math.sin(th);
    const n = fbm2(ca * 1.6 + seed * 3.1, sa * 1.6 + seed * 1.7, 4, seed);
    edgeR.push(radius(th) * (1 + edgeNoise * n));
    lobe.push(fbm2(ca * 1.1 + 40 + seed, sa * 1.1 - seed, 3, seed + 3));
  }
  const defGrass = (x, z) => {
    const n = fbm2(x * 0.05, z * 0.05, 3, seed + 9) * 0.5 + 0.5;
    const n2 = noise2(x * 0.3, z * 0.3, seed + 4);
    return [lerp(0.10, 0.24, n) * (0.9 + 0.2 * n2), lerp(0.26, 0.42, n) * (0.9 + 0.2 * n2), lerp(0.10, 0.09, n)];
  };
  const grassFn = grass || defGrass;
  // Mittelpunkt
  const h0 = height ? height(cx, cz, 0) : 0;
  pos.push(cx, topY + h0, cz);
  col.push(...grassFn(cx, cz, 0));
  // Oberseite (Ringe)
  for (let j = 1; j <= rings; j++) {
    const t = Math.pow(j / rings, 0.85);
    for (let i = 0; i < S; i++) {
      const th = ang(i);
      const r = edgeR[i] * t;
      const x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
      let y = topY + (height ? height(x, z, t) : 0);
      const rim = smoothstep(0.86, 1.0, t);
      y -= rim * rim * rimDrop * 0.6;
      pos.push(x, y, z);
      const g = grassFn(x, z, t);
      // Erdkante
      const soil = smoothstep(0.93, 1.0, t);
      const sc = [0.16, 0.11, 0.075];
      col.push(lerp(g[0], sc[0], soil), lerp(g[1], sc[1], soil), lerp(g[2], sc[2], soil));
    }
  }
  // Seiten + Unterseite
  let minY = Infinity;
  for (let k = 1; k <= sideRings; k++) {
    const s = k / sideRings;
    for (let i = 0; i < S; i++) {
      const th = ang(i);
      const ca = Math.cos(th), sa = Math.sin(th);
      const lb = lobe[i];
      const ex = taper * (1 + lb * lobes);
      let f = Math.pow(Math.max(0, 1 - s), ex);
      if (s < 0.06) f *= 1 + 0.035 * Math.sin((s / 0.06) * Math.PI); // Überhang-Lippe
      const y = topY - rimDrop - s * depth * (1 + lb * 0.35);
      // Grate & Schichtstufen
      const ridge = fbm2(ca * 6 + seed, sa * 6 + y * 0.05, 3, seed + 11);
      const band = (y + fbm2(ca * 2, sa * 2, 2, seed) * 2) / 2.6;
      const step = smoothstep(0.6, 0.95, band - Math.floor(band));
      f *= 1 + 0.13 * ridge * smoothstep(0.0, 0.15, s) - 0.035 * step * (1 - s);
      let r = edgeR[i] * f;
      // gemeißelte Felsstruktur (3D-Rauschen, Kanten & Rinnen)
      const px0 = cx + ca * r, pz0 = cz + sa * r;
      const chisel = fbm3(px0 * 0.11 / rough, y * 0.09 / rough, pz0 * 0.11 / rough, 3, seed + 21);
      const crack = Math.abs(noise3(px0 * 0.05 / rough, y * 0.02 / rough, pz0 * 0.05 / rough, seed + 33) * 2 - 1);
      r += (chisel * 2.2 - smoothstep(0.0, 0.12, 0.12 - crack) * 1.2) * smoothstep(0.03, 0.2, s) * Math.min(1, edgeR[i] / 25) * rough;
      const x = cx + ca * r, z = cz + sa * r;
      pos.push(x, y, z);
      minY = Math.min(minY, y);
      let c = strataColor(y, x, z, seed);
      // oben noch Erde/Wurzeln, ganz oben Grasüberhang
      const soil = 1 - smoothstep(0.0, 0.1, s);
      c = [lerp(c[0], 0.17, soil * 0.7), lerp(c[1], 0.12, soil * 0.7), lerp(c[2], 0.08, soil * 0.7)];
      // Unterseite dunkler (Umgebungsverdeckung)
      const ao = lerp(1.0, 0.55, smoothstep(0.1, 0.9, s));
      col.push(c[0] * ao, c[1] * ao, c[2] * ao);
    }
  }
  // Spitze
  const tipIndex = pos.length / 3;
  pos.push(cx + (R() - 0.5) * 4, minY - depth * 0.08, cz + (R() - 0.5) * 4);
  col.push(0.14, 0.10, 0.14);

  const idx = [];
  for (let i = 0; i < S; i++) idx.push(0, 1 + ((i + 1) % S), 1 + i);
  const totalRings = rings + sideRings;
  for (let j = 1; j < totalRings; j++) {
    const a0 = 1 + (j - 1) * S, a1 = 1 + j * S;
    for (let i = 0; i < S; i++) {
      const i1 = (i + 1) % S;
      idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i);
    }
  }
  const last = 1 + (totalRings - 1) * S;
  for (let i = 0; i < S; i++) idx.push(last + i, last + ((i + 1) % S), tipIndex);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, edgeR, segs: S, edgeAt: (th) => {
    const i = Math.round(((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * S) % S;
    return edgeR[i];
  } };
}

/** Hängender Felszapfen (für Unterseiten). */
export function buildStalactite({ x, y, z, r = 4, len = 14, seed = 1, segs = 14 }) {
  return buildIsland({
    cx: x, cz: z, topY: y, radius: () => r, depth: len, seed, segs, rings: 2, sideRings: 12,
    rimDrop: 0.2, taper: 0.9, lobes: 0.6, edgeNoise: 0.25,
    grass: () => [0.25, 0.18, 0.14],
  }).geometry;
}

/** Kleiner schwebender Felsbrocken mit Grashaube (Deko). */
export function buildFloatingRock(seed, r = 3) {
  return buildIsland({
    cx: 0, cz: 0, topY: 0, radius: () => r, depth: r * 2.4, seed, segs: 18, rings: 3, sideRings: 9,
    rimDrop: r * 0.25, taper: 0.7, lobes: 0.6, edgeNoise: 0.22,
    height: (x, z, t) => (1 - t * t) * r * 0.15,
  }).geometry;
}
