// Aether-Forge – Baukasten für Figuren: Anatomie (Rumpf, Glieder, Hände, Kopf mit Gesicht), Rüstungsschalen,
// Stoff (Umhang, Rock, Robe), Haar und Waffen. Alles als SDF-Primitive auf dem Helden-Skelett (Ruhepose).
import { Detail, P, add, sub, scl, norm, cross, dot, len, lerp3, madd, basisY, rotBasis, eulerBasis, smoothPoly } from '../sdf.js';

export { Detail, P, add, sub, scl, norm, cross, dot, len, lerp3, madd, basisY, rotBasis, eulerBasis, smoothPoly };
export const PI = Math.PI, TAU = Math.PI * 2;
const { sin, cos, abs, max, min, sqrt, atan2, hypot } = Math;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Gelenk-Zugriff: j('handL') → [x,y,z] */
export function joints(B) { return (n) => P(B.J[n].pos); }

/** Rahmen: Ursprung + Achsen (y = Hauptachse, x = Breite), lokal → Welt */
export function frame(origin, yAxis, xAxis) {
  const y = norm(P(yAxis));
  let x = P(xAxis); x = norm(sub(x, scl(y, dot(x, y))));
  const z = cross(x, y);
  const o = P(origin);
  return {
    o, x, y, z, basis: { x, y, z },
    at: (lx, ly, lz = 0) => [o[0] + x[0] * lx + y[0] * ly + z[0] * lz, o[1] + x[1] * lx + y[1] * ly + z[1] * lz, o[2] + x[2] * lx + y[2] * ly + z[2] * lz],
    dir: (lx, ly, lz = 0) => [x[0] * lx + y[0] * ly + z[0] * lz, x[1] * lx + y[1] * ly + z[1] * lz, x[2] * lx + y[2] * ly + z[2] * lz],
    rot: (rx = 0, ry = 0, rz = 0) => rotBasis({ x, y, z }, rx, ry, rz),
  };
}
/** Handrahmen wie im alten Rig (anatomy.handFrame): d = Unterarm-Richtung, f = vorn, i = innen */
export function handFrame(B, side = 'L') {
  const j = joints(B), s = B.skel.s;
  const el = j('foreArm' + side), ha = j('hand' + side);
  const d = norm(sub(ha, el));
  const f = norm(sub([0, 0, 1], scl(d, d[2])));
  let i = norm(cross(d, f)); if (side === 'R') i = scl(i, -1);
  const at = (a, b, c) => add(add(add(ha, scl(d, a * s)), scl(f, b * s)), scl(i, c * s));
  return { o: ha, d, f, i, at, grip: at(0.098, 0, 0.022), s };
}

// ---------------------------------------------------------------------------------------------
// Anatomie
// ---------------------------------------------------------------------------------------------
/**
 * Rumpf-Form (Becken, Bauch, Brustkorb, Brust, Rücken, Gesäß). Wird auch als Referenzform für Schalen benutzt.
 * o: { s, female, bulk, chest, waist, o (Zusatzattribute) }
 */
export function torsoShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, f = !!o.female, bulk = o.bulk ?? 1, A = o.o || {};
  const hips = j('hips'), spine = j('spine'), chest = j('chest'), neck = j('neck');
  const sw = (j('upperArmL')[0] / (0.195 * s)), hw = j('thighL')[0] / (0.095 * s);
  const k = (o.k ?? 0.05) * s;
  const W = (v) => v * s * bulk;
  S.group({ k: 0 }, () => {
    // Becken
    S.ellipsoid(add(hips, [0, -0.02 * s, -0.005 * s]), [W(0.158 * hw * (f ? 1.07 : 1)), W(0.115), W(0.112)], { ...A, k });
    // Bauch / Taille
    S.ellipsoid(add(spine, [0, 0.05 * s, 0.004 * s]), [W((f ? 0.128 : 0.142) * (o.waist ?? 1)), W(0.12), W(0.1 * (o.belly ?? 1))], { ...A, k });
    // Brustkorb
    S.ellipsoid(add(chest, [0, 0.075 * s, -0.004 * s]), [W((f ? 0.148 : 0.172) * sw * (o.chest ?? 1)), W(0.175), W((f ? 0.112 : 0.122) * (o.chest ?? 1))], { ...A, k });
    // oberer Rücken / Trapez
    S.ellipsoid(add(neck, [0, -0.045 * s, -0.035 * s]), [W((f ? 0.11 : 0.135) * sw), W(0.06), W(0.075)], { ...A, k });
    if (!f) {
      for (const sx of [1, -1]) S.ellipsoid(add(chest, [sx * 0.07 * s * sw, 0.11 * s, 0.07 * s]), [W(0.085), W(0.062), W(0.05)], { ...A, k: k * 0.8, rot: [0.25, sx * 0.25, 0] });
      for (const sx of [1, -1]) S.ellipsoid(add(chest, [sx * 0.105 * s * sw, 0.03 * s, -0.035 * s]), [W(0.07), W(0.13), W(0.075)], { ...A, k });
    } else {
      for (const sx of [1, -1]) S.ellipsoid(add(chest, [sx * 0.062 * s, 0.085 * s, 0.072 * s]), [W(0.058), W(0.056), W(0.05)], { ...A, k: k * 0.7, rot: [0.15, sx * 0.3, 0] });
    }
    // Gesäß
    for (const sx of [1, -1]) S.ellipsoid(add(hips, [sx * 0.066 * s * hw, -0.065 * s, -0.06 * s]), [W(0.08), W(0.088), W(0.072)], { ...A, k });
  });
}
/** Hals (Kapsel) */
export function neckShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s;
  S.capsule(add(j('neck'), [0, -0.04 * s, -0.012 * s]), add(j('head'), [0, 0.035 * s, 0.002 * s]), (o.r ?? 0.056) * s, (o.r2 ?? 0.05) * s, { ...(o.o || {}), k: (o.k ?? 0.03) * s });
}
/** Schultermuskel (links; in sym() verwenden) */
export function deltoidShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, bulk = o.bulk ?? 1;
  S.ellipsoid(add(j('upperArmL'), [0.012 * s, -0.012 * s, 0]), [0.064 * s * bulk, 0.08 * s * bulk, 0.07 * s * bulk], { ...(o.o || {}), k: (o.k ?? 0.04) * s, rot: [0, 0, 0.35] });
}
/** Oberarm (links) */
export function upperArmShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, b = o.bulk ?? 1, A = o.o || {}, k = (o.k ?? 0.03) * s;
  const a = j('upperArmL'), e = j('foreArmL');
  S.capsule(add(a, [0, -0.02 * s, 0]), e, 0.05 * s * b, 0.04 * s * b, { ...A, k });
  if (o.muscle !== false) {
    S.ellipsoid(add(lerp3(a, e, 0.45), [0, 0, 0.018 * s]), [0.042 * s * b, 0.072 * s * b, 0.043 * s * b], { ...A, k, rot: [0, 0, 0.12] });
    S.ellipsoid(add(lerp3(a, e, 0.35), [0.004 * s, 0, -0.02 * s]), [0.043 * s * b, 0.08 * s * b, 0.042 * s * b], { ...A, k, rot: [0, 0, 0.12] });
  }
}
/** Unterarm (links) */
export function foreArmShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, b = o.bulk ?? 1, A = o.o || {}, k = (o.k ?? 0.025) * s;
  const e = j('foreArmL'), h = j('handL');
  S.sphere(e, 0.041 * s * b, { ...A, k });
  S.capsule(e, add(h, [0, 0.01 * s, 0]), 0.043 * s * b, 0.028 * s * b, { ...A, k });
  if (o.muscle !== false) S.ellipsoid(add(lerp3(e, h, 0.28), [0.006 * s, 0, 0.004 * s]), [0.044 * s * b, 0.075 * s * b, 0.04 * s * b], { ...A, k, rot: [0, 0, 0.08] });
}
/** Oberschenkel (links) */
export function thighShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, b = o.bulk ?? 1, A = o.o || {}, k = (o.k ?? 0.04) * s;
  const t = j('thighL'), kn = j('shinL');
  S.capsule(add(t, [0, 0.02 * s, 0]), kn, 0.085 * s * b, 0.056 * s * b, { ...A, k });
  if (o.muscle !== false) {
    S.ellipsoid(add(lerp3(t, kn, 0.42), [0.006 * s, 0, 0.026 * s]), [0.062 * s * b, 0.14 * s * b, 0.058 * s * b], { ...A, k, rot: [0.04, 0, -0.06] });
    S.ellipsoid(add(lerp3(t, kn, 0.4), [-0.004 * s, 0, -0.03 * s]), [0.06 * s * b, 0.13 * s * b, 0.055 * s * b], { ...A, k });
  }
  S.ellipsoid(add(kn, [0, 0.01 * s, 0.018 * s]), [0.05 * s * b, 0.05 * s * b, 0.045 * s * b], { ...A, k: k * 0.6 });
}
/** Unterschenkel (links) */
export function shinShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, b = o.bulk ?? 1, A = o.o || {}, k = (o.k ?? 0.03) * s;
  const kn = j('shinL'), an = j('footL');
  S.capsule(kn, add(an, [0, 0.01 * s, 0]), 0.05 * s * b, 0.033 * s * b, { ...A, k });
  if (o.muscle !== false) S.ellipsoid(add(lerp3(kn, an, 0.3), [0.004 * s, 0, -0.028 * s]), [0.048 * s * b, 0.105 * s * b, 0.046 * s * b], { ...A, k });
}
/** Fuß / Stiefelform (links): Knöchel → Zehen, flache Sohle */
export function footShape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, w = o.w ?? 1, A = o.o || {}, k = (o.k ?? 0.03) * s;
  const an = j('footL');
  S.group({ k: o.gk ?? 0 }, () => {
    S.capsule(add(an, [0, 0.01 * s, -0.02 * s]), [an[0] + 0.006 * s, 0.035 * s, an[2] + 0.125 * s * (o.len ?? 1)], 0.045 * s * w, 0.034 * s * w, { ...A, k });
    S.ellipsoid([an[0], 0.04 * s, an[2] - 0.025 * s], [0.04 * s * w, 0.04 * s, 0.045 * s], { ...A, k });
    S.capsule(an, add(an, [0, 0.08 * s, 0]), 0.042 * s * w, 0.045 * s * w, { ...A, k });
    S.plane([0, 0.0, 0], [0, -1, 0], { op: 'int' });
  });
}

/**
 * Hand (links; in sym() für beide). curl 0..1 (Faust). o.o: Attribute (Haut oder Handschuh).
 */
export function handShape(S, B, o = {}) {
  const F = handFrame(B, 'L'), s = B.skel.s, A = o.o || {}, curl = o.curl ?? 1, b = o.bulk ?? 1;
  const k = 0.008 * s;
  // Handfläche: Box entlang d (Länge), f (Breite), i (Dicke)
  const pb = { x: F.f, y: F.d, z: F.i };
  S.box(F.at(0.05, 0, 0.004), [0.042 * s * b, 0.048 * s, 0.017 * s * b], { ...A, r: 0.014 * s, rot: pb, k });
  S.ellipsoid(F.at(0.035, 0.028, 0.012), [0.018 * s, 0.03 * s, 0.016 * s], { ...A, k, rot: pb }); // Daumenballen
  const fo = [0.03, 0.01, -0.01, -0.029], lens = [[0.036, 0.024, 0.02], [0.04, 0.026, 0.021], [0.038, 0.025, 0.02], [0.03, 0.02, 0.017]];
  for (let q = 0; q < 4; q++) {
    let p = F.at(0.088, fo[q], 0.0);
    const pts = [p], ang = curl * (1.45 - q * 0.04) + 0.12;
    for (let seg = 0; seg < 3; seg++) {
      const a = seg === 0 ? ang * 0.8 : ang * (seg + 0.8) * 0.75;
      const dir = norm(add(scl(F.d, cos(a)), scl(F.i, sin(a))));
      p = add(p, scl(dir, lens[q][seg] * s));
      pts.push(p);
    }
    const r0 = (q === 3 ? 0.0085 : 0.0098) * s * b;
    S.tube(pts, [r0, r0 * 0.94, r0 * 0.86, r0 * 0.78], { ...A, k, kj: 0.003 * s });
  }
  // Daumen
  const t0 = F.at(0.04, 0.03, 0.016), t1 = add(t0, scl(norm(add(add(scl(F.d, 0.7), scl(F.f, 0.45)), scl(F.i, 0.55 * curl))), 0.035 * s));
  const t2 = add(t1, scl(norm(add(add(scl(F.d, 0.5), scl(F.f, 0.2)), scl(F.i, 0.9 * curl))), 0.028 * s));
  S.tube([t0, t1, t2], [0.012 * s * b, 0.0105 * s * b, 0.009 * s * b], { ...A, k, kj: 0.003 * s });
}

/** Kopf-Maße wie im alten Rig */
export function headInfo(B, scale = 1) {
  const j = joints(B), s = B.skel.s * scale;
  const c = add(j('head'), [0, 0.105 * s, 0.012 * s]);
  return { c, s, at: (x, y, z) => [c[0] + x * s, c[1] + y * s, c[2] + z * s] };
}
/** Schädelform (für Helme, Kapuzen) */
export function craniumShape(S, B, o = {}) {
  const H = headInfo(B, o.scale), s = H.s, A = o.o || {};
  S.ellipsoid(H.at(0, 0.012, -0.008), [0.085 * s, 0.1 * s, 0.1 * s], { ...A });
}
/**
 * Kopf mit Gesicht (feine Ebene!). o: { female, skin, eye, brow, lips, hair, jaw, age, ears }
 */
export function head(S, B, o = {}) {
  const H = headInfo(B, o.scale), s = H.s, f = !!o.female, at = H.at;
  const skin = { mat: 'skin', col: o.skin || '#c99a7c', region: 'head', vary: 0.05 };
  const jaw = o.jaw ?? (f ? 0.86 : 1);
  S.group({ k: 0 }, () => {
    const k = 0.022 * s;
    // Schädel + Gesichtsmasse
    S.ellipsoid(at(0, 0.012, -0.012), [0.083 * s, 0.098 * s, 0.098 * s], { ...skin });
    S.ellipsoid(at(0, -0.02, 0.028), [0.07 * s, 0.083 * s, 0.075 * s], { ...skin, k });
    // Stirn
    S.ellipsoid(at(0, 0.045, 0.04), [0.07 * s, 0.05 * s, 0.05 * s], { ...skin, k });
    // Kiefer + Kinn
    S.ellipsoid(at(0, -0.068, 0.03), [0.058 * s * jaw, 0.04 * s, 0.062 * s], { ...skin, k });
    for (const sx of [1, -1]) S.ellipsoid(at(sx * 0.044 * jaw, -0.062, 0.0), [0.022 * s, 0.035 * s, 0.035 * s], { ...skin, k, rot: [0, 0, sx * 0.3] });
    S.ellipsoid(at(0, -0.1, 0.07), [0.022 * s * jaw, 0.018 * s, 0.02 * s], { ...skin, k: k * 0.8 });
    // Wangenknochen
    for (const sx of [1, -1]) S.ellipsoid(at(sx * 0.047, -0.012, 0.058), [0.022 * s, 0.014 * s, 0.022 * s], { ...skin, k: k * 0.7, rot: [0, sx * 0.4, sx * -0.3] });
    // Brauenbogen
    S.capsule(at(-0.044, 0.026, 0.078), at(0.044, 0.026, 0.078), (f ? 0.009 : 0.012) * s, { ...skin, k: k * 0.7 });
    S.ellipsoid(at(0, 0.02, 0.089), [0.016 * s, 0.012 * s, 0.01 * s], { ...skin, k: k * 0.5 });
    // Augenhöhlen
    for (const sx of [1, -1]) S.ellipsoid(at(sx * 0.031, 0.006, 0.095), [0.02 * s, 0.0135 * s, 0.016 * s], { ...skin, op: 'sub', k: 0.012 * s });
    // Nase
    S.capsule(at(0, 0.008, 0.093), at(0, -0.032, 0.109), 0.0085 * s, 0.0115 * s, { ...skin, k: 0.008 * s });
    S.ellipsoid(at(0, -0.038, 0.106), [0.0135 * s, 0.011 * s, 0.012 * s], { ...skin, k: 0.006 * s });
    for (const sx of [1, -1]) S.ellipsoid(at(sx * 0.0125, -0.042, 0.097), [0.0095 * s, 0.0075 * s, 0.009 * s], { ...skin, k: 0.005 * s });
    for (const sx of [1, -1]) S.ellipsoid(at(sx * 0.0075, -0.0465, 0.1015), [0.0042 * s, 0.0026 * s, 0.005 * s], { ...skin, op: 'sub', k: 0.002 * s });
    // Philtrum / Mund
    const lips = { mat: 'lips', col: o.lips || '#b0645a', region: 'head', vary: 0.03 };
    S.ellipsoid(at(0, -0.0635, 0.0925), [0.021 * s, 0.0052 * s, 0.0075 * s], { ...lips, k: 0.006 * s });
    S.ellipsoid(at(0, -0.0735, 0.0905), [0.019 * s, 0.006 * s, 0.0078 * s], { ...lips, k: 0.006 * s });
    S.capsule(at(-0.019, -0.0685, 0.098), at(0.019, -0.0685, 0.098), 0.0014 * s, { ...skin, op: 'sub', k: 0.003 * s, paint: true, col: '#5a2a26', mat: 'lips' });
    // Ohren
    if (o.ears !== false) for (const sx of [1, -1]) {
      const ear = { ...skin, rot: [0, sx * 0.35, sx * 0.12] };
      S.ellipsoid(at(sx * 0.083, -0.008, -0.006), [0.011 * s, (o.elf ? 0.04 : 0.03) * s, 0.02 * s], { ...ear, k: 0.008 * s });
      if (o.elf) S.capsule(at(sx * 0.084, 0.015, -0.014), at(sx * 0.098, 0.05, -0.03), 0.009 * s, 0.002 * s, { ...ear, k: 0.008 * s });
      S.ellipsoid(at(sx * 0.093, -0.006, -0.002), [0.006 * s, 0.018 * s, 0.011 * s], { ...ear, op: 'sub', k: 0.004 * s });
    }
  });
  // Augen (eigene Primitive: Augapfel, Iris, Pupille) + Lider
  for (const sx of [1, -1]) {
    const ec = at(sx * 0.031, 0.005, 0.083);
    S.sphere(ec, 0.0122 * s, { mat: 'eye', col: '#d8d2c8', region: 'head', vary: 0 });
    S.sphere(add(ec, [sx * 0.0005 * s, 0, 0.0085 * s]), 0.0062 * s, { mat: 'eye', col: o.eye || '#3a6a8a', region: 'head', vary: 0.02, k: 0.001 * s });
    S.sphere(add(ec, [sx * 0.0005 * s, 0, 0.0112 * s]), 0.0027 * s, { mat: 'eye', col: '#08090b', region: 'head', vary: 0 });
    // Oberlid (umschließt das Auge oben)
    S.ellipsoid(add(ec, [0, 0.0098 * s, 0.0015 * s]), [0.0148 * s, 0.0062 * s, 0.0128 * s], { ...skin, k: 0.002 * s, rot: [0.25, 0, 0] });
    S.ellipsoid(add(ec, [0, -0.0112 * s, 0.0005 * s]), [0.0138 * s, 0.0042 * s, 0.0118 * s], { ...skin, k: 0.002 * s });
  }
  // Augenbrauen (Haar)
  if (o.brow !== false) for (const sx of [1, -1]) {
    S.tube([at(sx * 0.012, 0.024, 0.098), at(sx * 0.03, 0.029, 0.097), at(sx * 0.048, 0.025, 0.088)], [0.0042 * s, 0.0038 * s, 0.002 * s], { mat: 'hair', col: o.brow || '#3a2a20', region: 'head', k: 0.002 * s, vary: 0.02 });
  }
  return H;
}

// ---------------------------------------------------------------------------------------------
// Rüstung / Schalen
// ---------------------------------------------------------------------------------------------
/** Kuppel-Schulterplatte (links): mehrere Lamellen, Rollrand, optionaler Grat */
export function pauldron(S, B, o = {}) {
  const j = joints(B), s = B.skel.s;
  const c = add(j('upperArmL'), [(o.dx ?? 0.025) * s, (o.dy ?? 0.035) * s, (o.dz ?? 0) * s]);
  const r = (o.r ?? 0.12) * s, layers = o.layers ?? 3, th = (o.th ?? 0.013) * s;
  const bind = (p) => { const t = smooth(c[1] - 0.06 * s, c[1] + 0.04 * s, p[1]); return [['shoulderL', 0.25 + 0.4 * t], ['upperArmL', 0.75 - 0.4 * t]]; };
  const A = { mat: o.mat || 'steel', col: o.col || 'primary', bind, wear: 1 };
  const tilt = o.tilt ?? 0.5;
  const rot = [0, 0, -tilt];
  const B0 = eulerBasis(...rot);
  for (let L = 0; L < layers; L++) {
    const yCut = (0.1 - L * 0.17) * r / s;
    const rr = r * (1 + L * 0.06);
    S.shell({ off: 0, th, ...A, col: L % 2 && o.col2 ? o.col2 : A.col, clip: (x, y, z) => {
      const p = [x - c[0], y - c[1], z - c[2]];
      const ly = p[0] * B0.y[0] + p[1] * B0.y[1] + p[2] * B0.y[2];
      return max(yCut * s - ly - 0.0 * s, ly - (yCut + 0.26 * r / s) * s);
    }, ck: th * 0.8 }, () => {
      S.ellipsoid(add(c, [L * 0.008 * s, -L * 0.022 * s, 0]), [rr, rr * 0.92, rr * 1.02], { rot });
    });
  }
  // oberste Kuppel (geschlossen)
  S.shell({ off: 0, th: th * 1.1, ...A, clip: (x, y, z) => { const p = [x - c[0], y - c[1], z - c[2]]; const ly = p[0] * B0.y[0] + p[1] * B0.y[1] + p[2] * B0.y[2]; return 0.12 * r - ly; } }, () => {
    S.ellipsoid(c, [r * 1.02, r * 0.94, r * 1.04], { rot });
  });
  if (o.trim) {
    // Zierkante: Torus am unteren Rand der obersten Kuppel
    const cy = 0.12 * r;
    const R = r * 1.02 * sqrt(max(0.05, 1 - (cy / (r * 0.94)) ** 2)) + th * 0.5;
    S.torus(add(c, [B0.y[0] * cy, B0.y[1] * cy, B0.y[2] * cy]), R, 0.0075 * s, { rot: B0, mat: o.trimMat || 'gold', col: o.trim, bind, k: 0.002 * s });
  }
  if (o.ridge) S.torus(add(c, [0, 0, 0]), r * 1.0, th * 0.8, { rot: rotBasis(B0, 0, 0, PI / 2), arc: 2.0, mat: o.trimMat || 'gold', col: o.trim || A.col, bind, k: 0.004 * s });
  return { c, r, bind };
}

/** Röhrenschale um einen Knochenabschnitt (Armschiene/Beinschiene) – Kegel a→b mit Rand-Wülsten */
export function bracer(S, a, b, r0, r1, o = {}) {
  a = P(a); b = P(b);
  const s = o.s ?? 1, th = (o.th ?? 0.013) * s;
  const A = { mat: o.mat || 'steel', col: o.col || 'primary', region: o.region, bind: o.bind, bone: o.bone, wear: 1 };
  const d = norm(sub(b, a)), L = len(sub(b, a));
  S.group({ k: 0 }, () => {
    S.shell({ off: 0, th, ...A, clip: (x, y, z) => { const t = dot([x - a[0], y - a[1], z - a[2]], d); return max(-t, t - L); }, ck: th * 0.7 }, () => {
      S.capsule(a, b, r0, r1, {});
    });
    if (o.rim !== false) {
      const B0 = basisY(d);
      S.torus(a, r0 + th * 0.6, 0.0055 * s, { rot: B0, ...A, mat: o.rimMat || A.mat, col: o.rimCol || A.col });
      S.torus(b, r1 + th * 0.6, 0.0055 * s, { rot: B0, ...A, mat: o.rimMat || A.mat, col: o.rimCol || A.col });
    }
    if (o.ridge) S.capsule(madd(madd(a, d, 0.01 * s), [0, 0, 1], r0 + th * 0.6), madd(madd(b, d, -0.01 * s), [0, 0, 1], r1 + th * 0.6), th * 0.7, { ...A, k: 0.006 * s });
  });
}

/** Gürtel um die Taille (elliptischer Torus-Ring) mit Schnalle */
export function belt(S, B, o = {}) {
  const j = joints(B), s = B.skel.s;
  const y = j('hips')[1] + (o.dy ?? 0.04) * s;
  const A = { mat: o.mat || 'leather', col: o.col || '#3b2618', region: 'pelvis', vary: 0.08 };
  const rx = (o.rx ?? 0.172) * s, rz = (o.rz ?? 0.128) * s, h = (o.h ?? 0.045) * s;
  // Ring als Schale eines elliptischen Zylinders
  S.shell({ off: 0, th: (o.th ?? 0.015) * s, ...A, clip: (x, yy, z) => abs(yy - y) - h / 2, ck: 0.004 * s }, () => {
    S.ellipsoid([0, y, -0.005 * s], [rx, h * 3, rz], {});
  });
  if (o.buckle) {
    S.box([0, y, rz + 0.012 * s], [0.032 * s, h * 0.62, 0.007 * s], { mat: o.buckleMat || 'gold', col: o.buckle, region: 'pelvis', r: 0.004 * s });
    S.box([0, y, rz + 0.016 * s], [0.02 * s, h * 0.38, 0.008 * s], { op: 'sub', k: 0.002 * s, mat: o.buckleMat || 'gold', col: o.buckle });
  }
  return { y, rx, rz, h };
}

// ---------------------------------------------------------------------------------------------
// Stoff
// ---------------------------------------------------------------------------------------------
/**
 * Umhang: gekrümmte Stoffbahn hinter dem Rücken (Schale eines Kegels), Faltenwurf, Saum.
 * o: { top, bottom, back, r0, r1, arc (Halbwinkel), col, inner, folds, hem, chain: [Knochen] }
 */
export function cape(S, B, o = {}) {
  const j = joints(B), s = B.skel.s;
  const top = o.top ?? j('neck')[1] - 0.02 * s, bot = o.bottom ?? 0.35 * s;
  const cz = (o.cz ?? 0.0) * s;
  const r0 = (o.r0 ?? 0.17) * s, r1 = (o.r1 ?? 0.36) * s;
  const half = o.arc ?? 1.05;
  const H = top - bot;
  const chain = o.chain || ['cape', 'cape1', 'cape2', 'cape3'];
  const bind = (p) => {
    // entlang der Höhe auf die Kette verteilen (oben Brust)
    const t = clamp((top - p[1]) / H, 0, 1) * (chain.length - 1);
    const i = Math.floor(t), f = t - i;
    const out = [];
    const top0 = smooth(0.06, 0, (top - p[1]) / H); // ganz oben: Brust
    if (top0 > 0) out.push(['chest', top0]);
    out.push([chain[min(i, chain.length - 1)], (1 - f) * (1 - top0)]);
    if (i + 1 < chain.length) out.push([chain[i + 1], f * (1 - top0)]);
    return out;
  };
  const A = { mat: o.mat || 'cloth', col: o.col, bind, vary: 0.1, grad: o.grad };
  const folds = Detail.folds({ amp: (o.fold ?? 0.012) * s, n: o.folds ?? 7, top, bottom: bot, seed: o.seed ?? 1.3, wobble: 0.8 });
  S.group({ k: 0 }, () => {
    S.shell({ off: 0, th: (o.th ?? 0.011) * s, ...A, clip: (x, y, z) => {
      const a = atan2(x, -(z - cz));                 // 0 = hinten
      const v = clamp((top - y) / H, 0, 1);
      const lim = half * (0.55 + 0.45 * v) + (o.wrap ?? 0) * (1 - v) * 0.4;
      const hemY = bot + (o.hemWave ?? 0.02) * s * sin(a * 9 + 1.3) + (o.hemCurve ?? 0.06) * s * (a * a);
      return max(max(abs(a) * r0 - lim * r0, hemY - y), y - top - 0.02 * s);
    }, ck: 0.006 * s }, () => {
      // Kegel um die Körperachse (oben eng, unten weit), leicht nach hinten versetzt
      const prof = [[0, top + 0.05 * s], [r0, top + 0.05 * s], [r0 * 1.02, top - 0.08 * s], [r1, bot - 0.05 * s], [0, bot - 0.05 * s]];
      S.lathe([0, 0, cz - (o.back ?? 0.03) * s], prof, { disp: folds });
    });
    if (o.hem) {
      S.shell({ off: (o.th ?? 0.011) * s * 0.3, th: (o.th ?? 0.011) * s * 0.9, mat: o.hemMat || 'gold', col: o.hem, bind, clip: (x, y, z) => {
        const a = atan2(x, -(z - cz));
        const v = clamp((top - y) / H, 0, 1);
        const lim = half * (0.55 + 0.45 * v) + (o.wrap ?? 0) * (1 - v) * 0.4;
        const hemY = bot + (o.hemWave ?? 0.02) * s * sin(a * 9 + 1.3) + (o.hemCurve ?? 0.06) * s * (a * a);
        const bw = 0.022 * s;
        return max(max(abs(a) * r0 - lim * r0, hemY - y), y - (hemY + bw));
      } }, () => {
        const prof = [[0, top + 0.05 * s], [r0, top + 0.05 * s], [r0 * 1.02, top - 0.08 * s], [r1, bot - 0.05 * s], [0, bot - 0.05 * s]];
        S.lathe([0, 0, cz - (o.back ?? 0.03) * s], prof, { disp: folds });
      });
    }
  });
  return { bind, top, bot };
}

/**
 * Rock / Robe / Wappenrock-Bahnen: Kegelschale um die Beine mit Falten. Gewichte: Hüfte → Oberschenkel.
 * o: { top, bottom, r0, r1, col, front/back panels (Winkelbereiche), slits }
 */
export function skirt(S, B, o = {}) {
  const j = joints(B), s = B.skel.s;
  const top = o.top ?? j('hips')[1] + 0.02 * s, bot = o.bottom ?? j('shinL')[1];
  const r0 = (o.r0 ?? 0.17) * s, r1 = (o.r1 ?? 0.26) * s, H = top - bot;
  const zc = (o.zc ?? 0) * s;
  const bind = o.bind || ((p) => {
    const t = smooth(top - 0.05 * s, bot, p[1]);
    const side = p[0] >= 0 ? 'L' : 'R';
    const back = p[2] < -0.04 * s;
    const out = [['hips', 1 - t * 0.85]];
    const ws = smooth(-0.06 * s, 0.06 * s, p[0]);
    out.push(['thighL', t * 0.85 * ws * (back && B.J.skirtB ? 0.5 : 1)], ['thighR', t * 0.85 * (1 - ws) * (back && B.J.skirtB ? 0.5 : 1)]);
    if (back && B.J.skirtB) out.push(['skirtB', t * 0.85 * 0.5]);
    void side;
    return out;
  });
  const A = { mat: o.mat || 'cloth', col: o.col, bind, vary: 0.1, grad: o.grad };
  const folds = Detail.folds({ amp: (o.fold ?? 0.01) * s, n: o.folds ?? 11, top, bottom: bot, seed: o.seed ?? 0.7 });
  const clip = (x, y, z) => {
    let c = max(bot + (o.hemWave ?? 0.008) * s * sin(atan2(x, z) * 7) - y, y - top);
    if (o.panels) {
      // nur Winkelbereiche behalten: [[mitte, halbe Breite (Bogenmaß)], ...]
      const a = atan2(x, z - zc);
      let best = 1e9;
      for (const [m0, w] of o.panels) { let da = abs(a - m0); if (da > PI) da = TAU - da; best = min(best, (da - w * (1 - 0.25 * clamp((top - y) / H, 0, 1))) * r0); }
      c = max(c, best);
    }
    if (o.slits) { const a = atan2(x, z - zc); for (const sa of o.slits) { let da = abs(a - sa); if (da > PI) da = TAU - da; const v = clamp((top - y) / H, 0, 1); c = max(c, -(da * r0 - 0.008 * s - 0.03 * s * smooth(o.slitFrom ?? 0.4, 1, v)) + 0); } }
    return c;
  };
  S.shell({ off: 0, th: (o.th ?? 0.01) * s, ...A, clip, ck: 0.005 * s }, () => {
    const prof = [[0, top + 0.06 * s], [r0, top + 0.06 * s], [r0 * 1.01, top - 0.04 * s], [r1, bot - 0.06 * s], [0, bot - 0.06 * s]];
    S.lathe([0, 0, zc], prof, { disp: folds, rot: o.rot });
  });
  if (o.hem) {
    S.shell({ off: (o.th ?? 0.01) * s * 0.4, th: (o.th ?? 0.01) * s * 0.8, mat: o.hemMat || 'gold', col: o.hem, bind, clip: (x, y, z) => max(clip(x, y, z), y - (bot + (o.hemWave ?? 0.008) * s * sin(atan2(x, z) * 7) + (o.hemW ?? 0.02) * s)) }, () => {
      const prof = [[0, top + 0.06 * s], [r0, top + 0.06 * s], [r0 * 1.01, top - 0.04 * s], [r1, bot - 0.06 * s], [0, bot - 0.06 * s]];
      S.lathe([0, 0, zc], prof, { disp: folds, rot: o.rot });
    });
  }
  return { bind, top, bot, clip };
}

/** Haarsträhnen als Röhren (Kopfhaut → Spitzen). o: { count, len, col, region|bind, part, seed } */
export function hairStrands(S, H, o = {}) {
  const s = H.s, n = o.count ?? 70, A = { mat: 'hair', col: o.col || '#3a2618', vary: 0.12, ...(o.o || {}) };
  let seed = o.seed ?? 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) {
    // Wurzel auf der Kopfhaut (obere/hintere Hälfte)
    const u = rnd(), v = rnd();
    const az = (o.az0 ?? -PI * 0.95) + u * ((o.az1 ?? PI * 0.95) - (o.az0 ?? -PI * 0.95)); // 0 = hinten
    const el = (o.el0 ?? 0.15) + v * ((o.el1 ?? 1.25) - (o.el0 ?? 0.15));
    const dirR = [sin(az) * cos(el), sin(el), -cos(az) * cos(el)];
    const root = H.at(dirR[0] * 0.086, 0.012 + dirR[1] * 0.098, -0.012 + dirR[2] * 0.1);
    const L = (o.len ?? 0.25) * s * (0.75 + 0.5 * rnd());
    const pts = [root];
    let p = root, d = norm(add(dirR, [0, 0.2, 0]));
    const segs = o.segs ?? 7;
    for (let k = 1; k <= segs; k++) {
      // erst der Kopfform folgen, dann fallen
      const t = k / segs;
      const grav = [0, -1, 0];
      d = norm(add(scl(d, 1 - 0.35 * (o.fall ?? 1)), scl(grav, 0.35 * (o.fall ?? 1) + t * 0.1)));
      d = norm(add(d, [o.sweepX ?? 0, 0, (o.sweepZ ?? -0.25) * t]));
      p = add(p, scl(d, L / segs));
      // nicht in den Kopf eindringen
      const rel = sub(p, H.c), rl = len(rel);
      const minR = 0.105 * s;
      if (rl < minR) p = add(H.c, scl(rel, minR / rl));
      pts.push(p);
    }
    const r0 = (o.r ?? 0.011) * s * (0.8 + 0.4 * rnd());
    S.tube(pts, (t) => r0 * (1 - 0.75 * t * t) + 0.0015 * s, { ...A, k: (o.k ?? 0.006) * s, kj: 0.002 * s });
  }
}

export { cos, sin, abs, max, min, sqrt, atan2, hypot };

/** Waffenrahmen wie weaponJoint im alten Rig: Ursprung = Waffengelenk, y = Hand vorn, x = −Unterarmrichtung */
export function weaponFrame(B, side, jointName) {
  const F = handFrame(B, side);
  const o = B.J[jointName] ? P(B.J[jointName].pos) : F.grip;
  return frame(o, F.f, scl(F.d, -1));
}
/** Glühende Runenlinie (Glüh-Ebene) entlang Punkten; kehrt zur vorherigen Ebene zurück */
export function runeLine(S, pts, r, col, o = {}) {
  const prev = S.layerName;
  S.layer('glow');
  S.tube(pts, r, { mat: 'glow', col, glow: o.k ?? 2.4, ...o });
  S.layer(prev);
}
/** Ganzer Körper (Unterkleidung) mit Materialien je Bereich */
export function bodyBase(S, B, o = {}) {
  const t = o.torso || {}, a = o.arms || t, l = o.legs || t;
  S.group({ k: 0 }, () => {
    torsoShape(S, B, { female: o.female, bulk: o.bulk ?? 1, chest: o.chest, waist: o.waist, o: { region: 'torso', ...t } });
    S.sym(() => deltoidShape(S, B, { bulk: o.armBulk ?? 1, o: { region: 'shoulderL', ...a } }));
    S.sym(() => upperArmShape(S, B, { bulk: o.armBulk ?? 1, o: { region: 'armL', ...a } }));
    S.sym(() => foreArmShape(S, B, { bulk: o.armBulk ?? 1, o: { region: 'armL', ...(o.fore || a) } }));
    S.sym(() => thighShape(S, B, { bulk: o.legBulk ?? 1, o: { region: 'legL', ...l } }));
    S.sym(() => shinShape(S, B, { bulk: o.legBulk ?? 1, o: { region: 'legL', ...(o.shin || l) } }));
    if (o.neck !== false) neckShape(S, B, { r: o.neckR ?? 0.056, o: { region: 'neck', ...(o.neckO || t) } });
  });
}
/** Stiefel (links, in sym) mit Schaft, Sohle, Umschlag */
export function boot(S, B, o = {}) {
  const j = joints(B), s = B.skel.s, an = j('footL'), kn = j('shinL');
  const A = { mat: o.mat || 'leather', col: o.col || '#3a2618', region: 'legL' };
  footShape(S, B, { w: o.w ?? 1.08, o: A });
  const top = an[1] + (o.h ?? 0.26) * s;
  S.shell({ off: 0.004 * s, th: 0.013 * s, ...A, clip: (x, y, z) => max(y - top, -y + 0.01 * s) }, () => shinShape(S, B, { bulk: 1.0, muscle: false }));
  if (o.cuff) S.torus([an[0], top - 0.005 * s, an[2] - 0.004 * s], 0.058 * s, 0.009 * s, { mat: o.cuffMat || A.mat, col: o.cuff, region: 'legL', k: 0.004 * s });
  S.box([an[0], 0.012 * s, an[2] + 0.04 * s], [0.045 * s, 0.012 * s, 0.11 * s], { mat: 'leather', col: '#1e140e', region: 'legL', r: 0.008 * s, k: 0.004 * s });
  void kn;
}
/** Gewichte entlang einer Knochenkette (Haar, Schal, Schärpe): Projektion auf den Gelenkpfad */
export function chainBind(B, bones, root = null, rootLen = 0.05) {
  const pts = bones.filter((n) => B.J[n]).map((n) => P(B.J[n].pos));
  const names = bones.filter((n) => B.J[n]);
  const s = B.skel.s;
  return (p) => {
    let best = Infinity, bi = 0, bt = 0;
    const segs = Math.max(1, pts.length - 1);
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
      const d = sub(b, a), l2 = dot(d, d) || 1e-9;
      let t = dot(sub(p, a), d) / l2; const tc = clamp(t, 0, 1);
      const q = add(a, scl(d, tc)); const dd = len(sub(p, q));
      if (dd < best) { best = dd; bi = i; bt = i === segs - 1 ? clamp(t, 0, 1) : tc; if (i === 0 && t < 0) bt = t; }
    }
    if (pts.length === 1) return root ? [[names[0], 1]] : [[names[0], 1]];
    const out = [];
    if (bt < 0 && root) { const k = clamp(-bt * len(sub(pts[1], pts[0])) / (rootLen * s), 0, 1); out.push([root, k], [names[0], 1 - k]); return out; }
    bt = clamp(bt, 0, 1);
    out.push([names[bi], 1 - bt], [names[bi + 1] || names[bi], bt]);
    return out;
  };
}
