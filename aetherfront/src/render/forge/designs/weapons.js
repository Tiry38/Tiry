// Aether-Forge – Waffen als SDF (lokaler Waffenrahmen F: Griff im Ursprung, +y Waffenachse, +x Breite, +z Fläche).
import { sdPoly2, smoothPoly } from '../sdf.js';
import { add, scl, norm, lerp3, PI, TAU, clamp, smooth } from './lib.js';

const { abs, max, min, sqrt, sin, cos, atan2, hypot } = Math;

/** Klingen-Primitiv: Länge L ab y=y0, Breite w (Basis), Rautenquerschnitt mit Dicke th, Spitze tip (Anteil) */
export function bladePrim({ y0 = 0, L = 0.9, w = 0.06, th = 0.012, tip = 0.16, taper = 0.18, edge = 0.0016, leaf = 0, curve = 0 }) {
  const hwAt = (y) => {
    const t = clamp((y - y0) / L, 0, 1);
    let hw = (w / 2) * (1 - taper * t) * (1 + leaf * sin(t * PI) * 0.5);
    if (t > 1 - tip) { const u = (t - (1 - tip)) / tip; hw *= sqrt(max(0, 1 - u * u)) * (1 - 0.15 * u); }
    return max(hw, 0.0006);
  };
  const W = w * (1 + leaf * 0.5);
  return {
    f: (x, y, z) => {
      x -= curve * ((y - y0) / L) ** 2 * L;
      const hw = hwAt(y);
      const dOut = max(abs(x) - hw, max(y0 - y, y - (y0 + L)));
      const t2 = th / 2;
      const dDia = (abs(x) * t2 + abs(z) * hw - hw * t2) / sqrt(t2 * t2 + hw * hw) - edge;
      return max(dOut, dDia);
    },
    box: [-W / 2 - abs(curve) * L - 0.002, y0, -th, W / 2 + abs(curve) * L + 0.002, y0 + L, th],
  };
}

/** Langschwert (Kael) */
export function longsword(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponR';
  const L = (o.len ?? 0.86) * s, w = (o.w ?? 0.058) * s;
  const steel = { mat: 'steel', col: o.steel || '#cfd5dd', bone, wear: 1, vary: 0.03 };
  const gold = { mat: 'gold', col: o.gold || 'metal', bone, wear: 1 };
  const leather = { mat: 'leather', col: o.leather || '#2e1d14', bone };
  const y0 = 0.075 * s;
  S.group({ k: 0 }, () => {
    S.prim(F.o, bladePrim({ y0, L, w, th: 0.013 * s, tip: 0.14, taper: 0.22 }), { rot: F.basis, ...steel });
    // Hohlkehle (beidseitig)
    for (const sz of [1, -1]) S.capsule(F.at(0, y0 + 0.05 * s, sz * 0.0085 * s), F.at(0, y0 + L * 0.62, sz * 0.0085 * s), 0.0052 * s, 0.0035 * s, { op: 'sub', k: 0.003 * s, ...steel });
  });
  // Runenlinie in der Kehle (Glühen)
  if (o.glow) {
    S.layer('glow');
    for (const sz of [1, -1]) S.capsule(F.at(0, y0 + 0.07 * s, sz * 0.0042 * s), F.at(0, y0 + L * 0.55, sz * 0.0042 * s), 0.0022 * s, 0.0016 * s, { mat: 'glow', col: o.glow, glow: o.glowK ?? 2.2, bone, tier: o.glowTier ?? 3 });
    S.layer('body:fine');
  }
  // Parierstange: geschwungene Flügel mit Endknäufen
  const gw = (o.guard ?? 0.13) * s;
  const gpts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; gpts.push(F.at(t * gw, 0.045 * s + 0.028 * s * t * t, 0)); }
  S.tube(gpts, (t) => (0.0105 + 0.006 * sin(t * PI)) * s, { ...gold, k: 0.004 * s });
  for (const sx of [1, -1]) S.sphere(F.at(sx * gw * 1.02, 0.075 * s, 0), 0.0135 * s, { ...gold, k: 0.004 * s });
  S.ellipsoid(F.at(0, 0.055 * s, 0), [0.024 * s, 0.022 * s, 0.017 * s], { ...gold, k: 0.006 * s, rot: F.basis });
  // Griff mit Lederwicklung
  S.capsule(F.at(0, 0.035 * s, 0), F.at(0, -0.16 * s, 0), 0.0155 * s, 0.0145 * s, { ...leather, disp: { amp: 0.0012 * s, fn: (lx, ly) => -0.0012 * s * abs(sin(ly * 260 / s)) } });
  // Knauf (Scheibe) + Edelstein
  S.lathe(F.at(0, -0.2 * s, 0), [[0, -0.03 * s], [0.02 * s, -0.026 * s], [0.03 * s, -0.008 * s], [0.026 * s, 0.012 * s], [0.012 * s, 0.03 * s], [0, 0.03 * s]], { rot: F.basis, ...gold, r: 0.002 * s });
  if (o.glow) {
    S.layer('glow');
    for (const sz of [1, -1]) S.sphere(F.at(0, -0.205 * s, sz * 0.021 * s), 0.0085 * s, { mat: 'glow', col: o.glow, glow: 2.8, bone });
    S.sphere(F.at(0, 0.058 * s, 0.0155 * s), 0.0075 * s, { mat: 'glow', col: o.glow, glow: 3, bone });
    S.sphere(F.at(0, 0.058 * s, -0.0155 * s), 0.0075 * s, { mat: 'glow', col: o.glow, glow: 3, bone });
    S.layer('body:fine');
  }
}

/** Gebogene Platte: Umriss (lokal xy) auf Zylinder (Achse y, Radius R) mit Dicke th */
export function curvedPlate(poly, R, th, o = {}) {
  const sd = sdPoly2(o.smooth ? smoothPoly(poly, o.smooth) : poly);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of poly) { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); }
  const inset = o.inset ?? 0, zoff = o.zoff ?? 0, rr = o.r ?? 0;
  return {
    f: (x, y, z) => {
      const d2 = sd(x, y) + inset;
      const dz = abs(hypot(x, z + R - zoff) - R) - th / 2;
      const a = d2 + rr, b = dz + rr;
      return min(max(a, b), 0) + hypot(max(a, 0), max(b, 0)) - rr;
    },
    box: [x0, y0, -th - 0.3, x1, y1, th + zoff + 0.02],
    sd,
  };
}

/** Turmschild (Kael): gewölbt, Rand, Wappen (Sonnenstern), Nieten, Rückseiten-Riemen */
export function towerShield(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponL';
  const w = (o.w ?? 0.25) * s, h0 = (o.h0 ?? -0.5) * s, h1 = (o.h1 ?? 0.36) * s;
  const R = (o.R ?? 0.55) * s, th = (o.th ?? 0.022) * s;
  const face = { mat: o.faceMat || 'enamel', col: o.face || 'secondary', bone, wear: 1 };
  const rim = { mat: 'steel', col: o.rim || 'primary', bone, wear: 1 };
  const gold = { mat: 'gold', col: o.gold || 'metal', bone, wear: 1 };
  const outline = [[-w, h1 * 0.72], [-w * 0.55, h1 * 0.98], [0, h1 * 1.06], [w * 0.55, h1 * 0.98], [w, h1 * 0.72], [w * 1.02, h0 * 0.1], [w * 0.92, h0 * 0.62], [w * 0.55, h0 * 0.9], [0, h0], [-w * 0.55, h0 * 0.9], [-w * 0.92, h0 * 0.62], [-w * 1.02, h0 * 0.1]];
  const zs = (x) => sqrt(max(0, R * R - x * x)) - R; // Oberfläche (vorne)
  // Grundplatte
  const plate = curvedPlate(outline, R, th, { smooth: 3, r: 0.004 * s });
  S.prim(F.o, plate, { rot: F.basis, ...face });
  // Rand (erhaben)
  const sd = plate.sd;
  S.prim(F.o, {
    f: (x, y, z) => { const d2 = abs(sd(x, y) + 0.016 * s) - 0.016 * s; const dz = abs(hypot(x, z + R - 0.006 * s) - R) - th * 0.75; return max(d2, dz) - 0.002 * s; },
    box: [-w * 1.1, h0 * 1.05, -0.4 * s, w * 1.1, h1 * 1.1, 0.05 * s],
  }, { rot: F.basis, ...rim, k: 0.003 * s });
  // Mittelgrat + Sonnenstern-Wappen (gold), Buckel
  S.prim(F.o, {
    f: (x, y, z) => {
      const r = hypot(x, y - 0.0 * s), a = atan2(y, x);
      const star = r - (0.07 + 0.045 * (0.5 + 0.5 * cos(a * 8))) * s;
      const dz = abs(hypot(x, z + R - 0.008 * s) - R) - th * 0.7;
      return max(star, dz);
    },
    box: [-0.13 * s, -0.13 * s, -0.2 * s, 0.13 * s, 0.13 * s, 0.05 * s],
  }, { rot: F.basis, ...gold, k: 0.004 * s });
  S.sphere(F.at(0, 0, zs(0) + th * 0.3), 0.045 * s, { ...rim, k: 0.008 * s, scale: 1 });
  // senkrechter Grat (Kreuz)
  S.capsule(F.at(0, h0 * 0.82, zs(0) + th * 0.5), F.at(0, h1 * 0.88, zs(0) + th * 0.5), 0.008 * s, { ...gold, k: 0.006 * s });
  S.capsule(F.at(-w * 0.82, h1 * 0.38, zs(w * 0.4) + th * 0.5), F.at(w * 0.82, h1 * 0.38, zs(w * 0.4) + th * 0.5), 0.007 * s, { ...gold, k: 0.006 * s });
  // Nieten entlang des Randes
  const ro = smoothPoly(outline, 3);
  const n = ro.length;
  for (let i = 0; i < n; i += 3) {
    const [x, y] = ro[i], c = [x * 0.88, y * 0.9 + (y > 0 ? -0.004 : 0.004) * s];
    S.sphere(F.at(c[0], c[1], zs(c[0]) + th * 0.45), 0.0075 * s, { ...gold, k: 0.002 * s });
  }
  // Rückseite: Armriemen
  S.box(F.at(0, 0.08 * s, zs(0) - th * 0.5 - 0.012 * s), [0.11 * s, 0.018 * s, 0.009 * s], { rot: F.basis, mat: 'leather', col: '#3a2416', bone, r: 0.004 * s });
  S.box(F.at(0, -0.12 * s, zs(0) - th * 0.5 - 0.012 * s), [0.11 * s, 0.018 * s, 0.009 * s], { rot: F.basis, mat: 'leather', col: '#3a2416', bone, r: 0.004 * s });
  if (o.glow) {
    S.layer('glow');
    S.prim(F.o, {
      f: (x, y, z) => { const r = hypot(x, y); return max(abs(r - 0.125 * s) - 0.0035 * s, abs(hypot(x, z + R - 0.01 * s) - R) - th * 0.6); },
      box: [-0.14 * s, -0.14 * s, -0.2 * s, 0.14 * s, 0.14 * s, 0.05 * s],
    }, { rot: F.basis, mat: 'glow', col: o.glow, glow: 2.2, bone, tier: 6 });
    S.sphere(F.at(0, 0, zs(0) + th * 0.3 + 0.03 * s), 0.016 * s, { mat: 'glow', col: o.glow, glow: 3, bone, tier: 3 });
    S.layer(o.layer || 'body');
  }
}

/** Kriegshammer (Brann): Stiel mit Wicklung, achtkantiger Kopf mit Runenrillen, Kupferbänder, Dorn */
export function warhammer(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponR', len = (o.len ?? 1.05) * s, hd = (o.head ?? 0.2) * s;
  const metal = { mat: 'iron', col: o.metal || '#8a929c', bone, wear: 1 };
  const copper = { mat: 'copper', col: o.copper || 'secondary', bone, wear: 1 };
  const wood = { mat: 'wood', col: o.wood || '#4a3020', bone };
  const hy = len - 0.18 * s;
  // Stiel
  S.capsule(F.at(0, -0.33 * s, 0), F.at(0, hy, 0), 0.023 * s, 0.02 * s, { ...wood });
  S.capsule(F.at(0, -0.28 * s, 0), F.at(0, 0.12 * s, 0), 0.026 * s, { mat: 'leather', col: '#2a1a12', bone, disp: { amp: 0.0015 * s, fn: (lx, ly) => -0.0015 * s * abs(sin(ly * 180 / s + lx * 40)) } });
  for (const y of [-0.3, 0.14, len / s - 0.42]) S.cylinder(F.at(0, y * s, 0), 0.03 * s, 0.016 * s, { rot: F.basis, ...copper, r: 0.004 * s });
  S.lathe(F.at(0, -0.37 * s, 0), [[0, -0.05 * s], [0.026 * s, -0.045 * s], [0.038 * s, -0.02 * s], [0.03 * s, 0.01 * s], [0, 0.03 * s]], { rot: F.basis, ...metal, r: 0.003 * s });
  // Kopf: achtkantiges Prisma entlang lokal x (Schlagflächen links/rechts)
  const oct = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8; oct.push([cos(a) * hd * 0.5, sin(a) * hd * 0.5]); }
  const headBasis = F.rot(0, PI / 2, 0); // lokal z (Extrusion) → Rahmen x
  S.group({ k: 0 }, () => {
    S.extrude(F.at(0, hy, 0), oct, hd * 0.85, { rot: { x: headBasis.x, y: headBasis.y, z: headBasis.z }, ...metal, r: 0.008 * s });
    // Schlagflächen etwas breiter
    for (const sx of [1, -1]) S.cylinder(F.at(sx * hd * 0.8, hy, 0), hd * 0.56, hd * 0.11, { rot: F.rot(0, 0, PI / 2), ...metal, r: 0.012 * s, k: 0.01 * s });
    // Runenrillen (umlaufend + Zeichen auf den Flanken)
    for (const sx of [1, -1]) S.torus(F.at(sx * hd * 0.42, hy, 0), hd * 0.53, 0.006 * s, { rot: F.rot(0, 0, PI / 2), op: 'sub', k: 0.002 * s, ...metal });
    for (const sz of [1, -1]) {
      S.capsule(F.at(-hd * 0.25, hy - hd * 0.18, sz * hd * 0.47), F.at(0, hy + hd * 0.2, sz * hd * 0.47), 0.0055 * s, { op: 'sub', k: 0.002 * s, ...metal });
      S.capsule(F.at(0, hy + hd * 0.2, sz * hd * 0.47), F.at(hd * 0.25, hy - hd * 0.18, sz * hd * 0.47), 0.0055 * s, { op: 'sub', k: 0.002 * s, ...metal });
      S.capsule(F.at(-hd * 0.14, hy - hd * 0.02, sz * hd * 0.47), F.at(hd * 0.14, hy - hd * 0.02, sz * hd * 0.47), 0.0055 * s, { op: 'sub', k: 0.002 * s, ...metal });
    }
  });
  // Kupferbänder am Kopf
  for (const sx of [1, -1]) S.cylinder(F.at(sx * hd * 0.6, hy, 0), hd * 0.56, hd * 0.035, { rot: F.rot(0, 0, PI / 2), ...copper, r: 0.003 * s });
  // Dorn oben
  S.capsule(F.at(0, hy + hd * 0.4, 0), F.at(0, hy + hd * 0.85, 0), 0.03 * s, 0.004 * s, { ...metal, k: 0.01 * s });
  if (o.glow) {
    S.layer('glow');
    for (const sz of [1, -1]) {
      const g = { mat: 'glow', col: o.glow, glow: 2.6, bone };
      S.capsule(F.at(-hd * 0.25, hy - hd * 0.18, sz * hd * 0.455), F.at(0, hy + hd * 0.2, sz * hd * 0.455), 0.0035 * s, g);
      S.capsule(F.at(0, hy + hd * 0.2, sz * hd * 0.455), F.at(hd * 0.25, hy - hd * 0.18, sz * hd * 0.455), 0.0035 * s, g);
      S.capsule(F.at(-hd * 0.14, hy - hd * 0.02, sz * hd * 0.455), F.at(hd * 0.14, hy - hd * 0.02, sz * hd * 0.455), 0.0035 * s, g);
    }
    for (const sx of [1, -1]) S.torus(F.at(sx * hd * 0.42, hy, 0), hd * 0.525, 0.0035 * s, { rot: F.rot(0, 0, PI / 2), mat: 'glow', col: o.glow, glow: 2.2, bone, tier: 3 });
    S.layer(o.layer || 'body');
  }
  return { hy };
}

/** Stab (Mira/Selene): gedrechselter Schaft, Bänder, Fuß; Kopf vom Aufrufer */
export function staff(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponR', len = (o.len ?? 1.6) * s, below = (o.below ?? 0.55) * s, r = (o.r ?? 0.018) * s;
  const wood = { mat: o.woodMat || 'wood', col: o.wood || '#6a4a30', bone };
  const metal = { mat: 'gold', col: o.metal || 'metal', bone, wear: 1 };
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(F.at(sin(t * 7 + 1) * 0.006 * s, -below + t * len, cos(t * 5) * 0.006 * s)); }
  S.tube(pts, (t) => r * (1.12 - 0.25 * t), { ...wood, kj: 0.004 * s });
  S.capsule(F.at(0, -below - 0.06 * s, 0), F.at(0, -below + 0.02 * s, 0), 0.004 * s, r * 1.2, { ...metal, k: 0.004 * s });
  for (const y of o.bands || [-0.12, 0.12]) S.torus(F.at(0, y * s, 0), r * 1.15, 0.0055 * s, { rot: F.basis, ...metal, k: 0.003 * s });
  return { top: F.at(0, len - below, 0), topY: len - below };
}

/** Langbogen (Lyra): Wurfarme mit Recurve-Spitzen, Griffwicklung, Beschläge; Sehne als dünne Röhre */
export function longbow(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponL', h = (o.h ?? 0.66) * s;
  const wood = { mat: 'wood', col: o.wood || '#5e3d22', bone };
  const trim = { mat: 'gold', col: o.trim || 'metal', bone, wear: 1 };
  const pts = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 - 1, y = t * h;
    const z = 0.1 * s * (1 - t * t) * 0.9 - 0.05 * s * Math.pow(abs(t), 6) + (abs(t) > 0.85 ? -0.06 * s * (abs(t) - 0.85) / 0.15 : 0) - 0.02 * s;
    pts.push(F.at(0, y, z));
  }
  S.tube(pts, (t) => { const u = abs(t * 2 - 1); return (0.011 + 0.012 * (1 - u)) * s; }, { ...wood, kj: 0.003 * s, k: 0 });
  // Griff
  S.capsule(F.at(0, -0.07 * s, 0.07 * s), F.at(0, 0.07 * s, 0.07 * s), 0.021 * s, { mat: 'leather', col: '#3a2618', bone, k: 0.01 * s, disp: { amp: 0.001 * s, fn: (lx, ly) => -0.001 * s * abs(sin(ly * 300 / s)) } });
  for (const sy of [-1, 1]) {
    S.torus(F.at(0, sy * 0.085 * s, 0.07 * s), 0.021 * s, 0.005 * s, { rot: F.basis, ...trim });
    // Beschlag an den Spitzen
    const tp = pts[sy > 0 ? N - 1 : 1];
    S.sphere(tp, 0.013 * s, { ...trim, k: 0.004 * s });
  }
  const nock = F.at(0, 0, -0.05 * s);
  return { tipTop: pts[N], tipBot: pts[0], nock, pts };
}

/** Krummdolch (Varo) */
export function dagger(S, F, o = {}) {
  const s = o.s ?? 1, bone = o.bone || 'weaponR', L = (o.len ?? 0.46) * s, w = (o.w ?? 0.055) * s;
  const steel = { mat: 'steel', col: o.steel || '#3a3a46', bone, wear: 1 };
  S.prim(F.o, bladePrim({ y0: 0.05 * s, L, w, th: 0.011 * s, tip: 0.3, taper: 0.1, leaf: 0.35, curve: o.curve ?? 0.06 }), { rot: F.basis, ...steel });
  S.tube([F.at(-0.055 * s, 0.03 * s, 0), F.at(0, 0.048 * s, 0), F.at(0.055 * s, 0.03 * s, 0), F.at(0.07 * s, 0.065 * s, 0)], (t) => (0.0095 + 0.004 * sin(t * PI)) * s, { mat: 'metal', col: o.gold || 'metal', bone, wear: 1 });
  S.capsule(F.at(0, -0.09 * s, 0), F.at(0, 0.035 * s, 0), 0.014 * s, 0.013 * s, { mat: 'leather', col: '#2a1a20', bone, disp: { amp: 0.001 * s, fn: (lx, ly) => -0.001 * s * abs(sin(ly * 280 / s)) } });
  S.sphere(F.at(0, -0.1 * s, 0), 0.019 * s, { mat: 'metal', col: o.gold || 'metal', bone, k: 0.004 * s });
  if (o.glow) {
    S.layer('glow');
    // glühende Schneide (dünne Kante entlang der Klinge)
    S.prim(F.o, bladePrim({ y0: 0.08 * s, L: L * 0.92, w: w * 1.08, th: 0.004 * s, tip: 0.3, taper: 0.1, leaf: 0.35, curve: o.curve ?? 0.06, edge: 0.0004 }), {
      rot: F.basis, mat: 'glow', col: o.glow, glow: o.k ?? 3, bone, op: 'add',
    });
    S.layer(o.layer || 'body:fine');
  }
}

export { add, scl, norm, lerp3, smooth };
