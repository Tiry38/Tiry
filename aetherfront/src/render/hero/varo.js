// Varo Glutklinge – Schurke/Schattentänzer: zwei rot glühende Klingen, dunkles Leder, Kapuze, Maske, wehender Schal.
import * as THREE from 'three';
import { V, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, T, R, ext, shape, bend } from './geo.js';
import { M, W } from './rig.js';
import { torso, torsoRing, arms, legs, boots, hand, neck, head, hairCap, hood, mantle, robe, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { pauldron, shellTube, rimRing, belt, plate, daggerParts, weaponJoint, emit } from './parts.js';

export const proportions = { scale: 1.0, shoulders: 1.0, hipsW: 0.98, torso: 1.0, leg: 1.03, arm: 1.02 };

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const dark = C(P.primary), red = C(P.secondary), metal = C(P.metal), glow = C(P.glow);
  const leather = mix(dark, '#3a2a30', 0.35), dleather = shade(dark, 0.6), cloth = shade(dark, 0.8), skin = '#c99070';

  legs(B, { col: cloth, mat: M.cloth, bulk: 0.95 });
  torso(B, { col: cloth, mat: M.cloth, bulk: 0.97 });
  arms(B, { col: cloth, mat: M.cloth, bulk: 0.95 });
  neck(B, { col: cloth, mat: M.cloth, r: 0.05 });
  hand(B, { col: dleather, mat: M.leather, curl: 1, cuff: leather });
  boots(B, { col: leather, mat: M.leather, height: 0.36, w: 0.95, toe: 0.02 });
  // Beinwicklungen
  for (const side of [1]) for (let i = 0; i < 6; i++) {
    const y = J.shinL.pos.y - 0.08 * s - i * 0.035 * s;
    const g = tor(0.053 * s, 0.006 * s, 5, 16); g.rotateX(PI / 2 + (i % 2 ? 0.25 : -0.25)); T(g, V(J.shinL.pos.x, y, 0.005 * s));
    B.sym(g, shade(red, 0.55), M.cloth, legWeights(B));
  }
  for (let i = 0; i < 3; i++) { const g = tor(0.083 * s, 0.006 * s, 5, 18); g.rotateX(PI / 2 + (i % 2 ? 0.2 : -0.2)); T(g, V(J.thighL.pos.x, J.thighL.pos.y - 0.18 * s - i * 0.05 * s, 0.0)); B.sym(g, dleather, M.leather, legWeights(B)); }

  // Lederwams + Kreuzriemen
  const S = torso(B, { col: leather, mat: M.leather, bulk: 0.97, off: 0.014, bottom: -0.04, top: 0.86, caps: false, sides: 22, segs: 12, ridge: 0.004 });
  torsoRing(B, -0.04, 0.016, 0.005, metal, M.metal, { bulk: 0.97 });
  for (const sg of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, a = sg * (-0.7 + t * 1.4) + (t > 0.5 ? 0 : 0); const u = 0.82 - t * 0.7; pts.push(S.pt(u, sg * 0.55 - sg * t * 1.1, 0.024)); }
    B.add(tube(pts, () => [0.016 * s, 0.004 * s], { sides: 6, segs: 24, hintFn: () => [0, 1, 0] }), dleather, M.leather, torsoWeights(B));
  }
  // Brustschnalle
  { const g = ext(shape([[-0.025, -0.02], [0.025, -0.02], [0.03, 0], [0.025, 0.02], [-0.025, 0.02], [-0.03, 0]].map(([x, y]) => [x * s, y * s])), 0.008 * s, 0.003 * s); T(g, S.pt(0.47, 0, 0.03)); B.add(g, metal, M.metal, 'chest'); const gm = ell(0.008 * s, 0.008 * s, 0.005 * s, 8, 6); T(gm, S.pt(0.47, 0, 0.038)); B.glow(gm, glow, 3, 'chest', { tier: 3 }); }
  // Schärpe + Gürtel
  belt(B, { y: J.hips.pos.y + 0.04 * s, rx: 0.19, rz: 0.135, h: 0.07, col: red, mat: M.silk });
  belt(B, { y: J.hips.pos.y - 0.005 * s, rx: 0.195, rz: 0.14, h: 0.03, col: dleather, buckle: metal });
  // Lendentuch vorn/hinten (rot, ausgefranst)
  robe(B, [[J.hips.pos.y + 0.01 * s, 0.19 * s, 0.14 * s], [J.hips.pos.y - 0.15 * s, 0.215 * s, 0.17 * s], [J.shinL.pos.y + 0.08 * s, 0.235 * s, 0.2 * s]], { col: shade(red, 0.8), open: 2.2, folds: 5, fold: 0.05, tatter: 0.06 * s, tears: 5, legK: 0.95, nu: 18, nv: 7, backK: 0.4, grad: { axis: 'y', from: J.hips.pos.y, to: J.shinL.pos.y, col: shade(red, 0.45) } });
  // Schärpenenden links (Kette)
  const sh0 = V(0.15 * s, J.hips.pos.y + 0.03 * s, 0.07 * s);
  B.joint('sash', 'hips', sh0); B.joint('sash1', 'sash', sh0.clone().add(V(0.01 * s, -0.17 * s, 0))); B.joint('sash2', 'sash1', sh0.clone().add(V(0.02 * s, -0.34 * s, -0.01 * s)));
  const swb = W.ramp('y', [[sh0.y - 0.34 * s, 'sash2'], [sh0.y - 0.17 * s, 'sash1'], [sh0.y - 0.01 * s, 'sash']]);
  for (const dz of [0, -0.035]) B.cloth(tube([sh0.clone().add(V(0, 0, dz * s)), sh0.clone().add(V(0.012 * s, -0.2 * s, (dz - 0.01) * s)), sh0.clone().add(V(0.02 * s, -0.4 * s, (dz - 0.02) * s))], (t) => [0.004 * s, 0.03 * s * (1 - 0.3 * t)], { sides: 6, segs: 10, hint: [1, 0, 0] }), shade(red, 0.9), M.silk, swb);

  // Schulterschutz links (Leder + Metallrand), rechts Riemenpolster
  pauldron(B, { r: 0.095, layers: 2, col: dleather, col2: leather, trim: metal, mat: M.leather, tilt: 0.7 });
  { const g = smoothSphere(1, 10, 8); g.scale(0.022 * s, 0.05 * s, 0.022 * s); R(g, 0, 0, -0.5); T(g, J.upperArmL.pos.clone().add(V(0.08 * s, 0.075 * s, 0))); B.sym(g, metal, M.metal, (p) => [['shoulderL', 0.55], ['upperArmL', 0.45]], { tier: 6 }); }
  // Unterarmschienen mit Runen
  const el = J.foreArmL.pos, wr = J.handL.pos;
  B.sym(shellTube(el.clone().lerp(wr, 0.15), wr.clone().add(V(0, 0.02 * s, 0)), 0.048 * s, 0.042 * s, { sides: 12, segs: 3, flare: 0.008 * s, ridge: 0.006 * s, ridgeA: PI / 2 }), shade(metal, 0.5), M.dmetal, foreArmWeights(B));
  B.sym(rimRing(wr.clone().add(V(0, 0.02 * s, 0)), wr.clone().sub(el), 0.052 * s, 0.052 * s, 0.004 * s, 18), red, M.leather, foreArmWeights(B));
  for (let i = 0; i < 3; i++) { const p = el.clone().lerp(wr, 0.35 + i * 0.18).add(V(0.046 * s, 0, 0)); const g = ext(shape([[0, -0.012], [0.006, 0], [0, 0.012], [-0.006, 0]].map(([x, y]) => [x * s, y * s])), 0.006 * s, 0); R(g, 0, PI / 2, 0); T(g, p); B.glowSym(g, glow, 2.6, foreArmWeights(B), { tier: 3 }); }

  // Kopf: Gesicht, glühende Augen, Maske, Kapuze, Schal
  const H = head(B, { skin, eye: '#ff6a3a', eyeGlow: 2.2, brow: '#1a1014' });
  hairCap(B, H, { col: '#1d1418', vol: 1.05, front: 0.42 });
  {
    // Maske: unterer Gesichtsbogen
    const g = new THREE.SphereGeometry(1, 24, 10, PI / 2 - 1.75, 3.5, PI * 0.5, PI * 0.36);
    g.deleteAttribute('uv');
    warp(g, (p) => { p.set(p.x * H.rx * 1.12, p.y * H.ry * 1.06, p.z * H.rz * 1.18 + Math.max(0, p.z) * 0.012 * s * Math.exp(-p.x * p.x * 8)); });
    T(g, H.c.clone().add(V(0, -0.004 * s, 0.002 * s)));
    B.cloth(g, shade(dark, 0.9), M.cloth, 'head');
    const band = tor(H.rx * 1.12, 0.004 * s, 5, 30, PI * 1.1); band.rotateX(PI / 2); band.rotateY(-PI * 0.05 + PI); band.scale(1, 1, H.rz / H.rx * 1.18);
    T(band, H.c.clone().add(V(0, -0.012 * s, 0)));
    B.add(band, red, M.silk, 'head');
  }
  hood(B, H, { col: shade(dark, 1.1), inCol: shade(dark, 0.5), gap: 1.6, tip: 0.6, scale: 1.36, theta: 0.8, flare: 0.6 });
  mantle(B, { col: shade(dark, 1.05), r0: 0.07, r1: 0.17, r2: 0.24, r1z: 0.14, r2z: 0.18, bottom: J.upperArmL.pos.y - 0.04 * s, folds: 5, tatter: 0.05 * s, tears: 6, top: J.neck.pos.y + 0.04 * s });
  // Schal-Enden hinten (Kette)
  const sc0 = V(0.03 * s, J.neck.pos.y + 0.0 * s, -0.12 * s);
  B.joint('scarf', 'chest', sc0); B.joint('scarf1', 'scarf', sc0.clone().add(V(0, -0.2 * s, -0.06 * s))); B.joint('scarf2', 'scarf1', sc0.clone().add(V(0, -0.42 * s, -0.1 * s)));
  const scb = (p) => { const t = smooth(sc0.y, sc0.y - 0.45 * s, p.y); const w = W.ramp('y', [[sc0.y - 0.42 * s, 'scarf2'], [sc0.y - 0.2 * s, 'scarf1'], [sc0.y - 0.02 * s, 'scarf']])(p); const k = 1 - smooth(sc0.y - 0.06 * s, sc0.y, p.y); return w.map(([b, x]) => [b, x * k]).concat([['chest', 1 - k]]); };
  for (const [dx, len] of [[0.03, 1], [-0.03, 0.82]]) {
    const pts = [sc0.clone().add(V(dx * s, 0.02 * s, 0.03 * s)), sc0.clone().add(V(dx * 1.3 * s, -0.1 * s, -0.04 * s)), sc0.clone().add(V(dx * 1.6 * s, -0.25 * s * len, -0.08 * s)), sc0.clone().add(V(dx * 1.8 * s, -0.45 * s * len, -0.11 * s))];
    B.cloth(tube(pts, (t) => [0.005 * s, 0.045 * s * (1 - 0.25 * t)], { sides: 6, segs: 16, hint: [0, 0, 1], hintFn: () => [0, 0.2, -1] }), red, M.silk, scb, { grad: { axis: 'y', from: sc0.y, to: sc0.y - 0.45 * s, col: shade(red, 0.6) } });
    const fr = tube(pts.slice(2).map((p) => p.clone().add(V(0, -0.005 * s, 0))), (t) => [0.006 * s, 0.047 * s * (1 - 0.25 * t)], { sides: 6, segs: 6, hint: [0, 0, 1], hintFn: () => [0, 0.2, -1] });
    B.glow(fr, glow, 1.6, scb, { tier: 9 });
  }

  // Zwei Klingen
  for (const side of ['R', 'L']) {
    const fr = weaponJoint(B, 'weapon' + side, side);
    emit(B, daggerParts({ len: 0.5 * s, w: 0.07 * s, steel: '#2e2a36', glow, gold: metal, k: 3.2 }), { origin: fr.origin, y: fr.y, x: fr.x }, 'weapon' + side);
  }
  return { radius: 0.45 * s };
}
