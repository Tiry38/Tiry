// Selene Äthersang – Kristallmagierin: fließende weiß-blaue Roben, schwebender Kristallstab, Kristall-Halo.
import * as THREE from 'three';
import { V, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, T, R, ext, shape, bend, crystal, starShape } from './geo.js';
import { M, W } from './rig.js';
import { torso, torsoRing, arms, legs, boots, hand, neck, head, hairCap, strand, mantle, robe, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { shellTube, rimRing, belt, staffParts, weaponJoint, emit, place } from './parts.js';

export const proportions = { scale: 0.97, shoulders: 0.9, hipsW: 1.0, torso: 1.0, leg: 1.04, arm: 1.0, neck: 1.05 };

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const white = C(P.primary), blue = C(P.secondary), silver = C(P.metal), glow = C(P.glow);
  const robeW = mix(white, '#cfd6ee', 0.25), deep = shade(blue, 0.7), skin = '#f0c4a8', hair = '#e4e8f4';

  legs(B, { col: deep, mat: M.cloth, bulk: 0.88 });
  boots(B, { col: silver, mat: M.metal, height: 0.2, w: 0.86, toe: 0.03 });
  torso(B, { col: robeW, mat: M.silk, female: true, bulk: 0.94 });
  arms(B, { col: robeW, mat: M.silk, bulk: 0.84 });
  neck(B, { col: skin, r: 0.042 });
  hand(B, { col: skin, mat: M.skin, curlL: 0.35, curlR: 0.8 });
  // Mieder (blau) mit Silberkanten + Kristall
  const S = torso(B, { col: blue, mat: M.silk, female: true, bulk: 0.94, off: 0.01, bottom: -0.02, top: 0.58, caps: false, sides: 22, segs: 10 });
  torsoRing(B, 0.58, 0.012, 0.005, silver, M.metal, { female: true, bulk: 0.94 });
  torsoRing(B, -0.02, 0.012, 0.006, silver, M.metal, { female: true, bulk: 0.94 });
  for (const sg of [1, -1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(S.pt(0.02 + t * 0.52, sg * (0.15 + 0.5 * t * t), 0.014)); }
    B.add(tube(pts, () => 0.004 * s, { sides: 5, segs: 20 }), silver, M.metal, torsoWeights(B));
  }
  { const g = crystal(0.016 * s, 0.05 * s, 6); R(g, PI, 0, 0); T(g, S.pt(0.42, 0, 0.03).add(V(0, 0.02 * s, 0))); B.glass(g, glow, 'chest'); const c = ell(0.008 * s, 0.014 * s, 0.006 * s, 8, 6); T(c, S.pt(0.42, 0, 0.03)); B.glow(c, glow, 3, 'chest'); }
  // Lange Robe in zwei Lagen (innen weiß, außen blau offen)
  const hy = J.hips.pos.y;
  robe(B, [[hy + 0.05 * s, 0.17 * s, 0.13 * s], [hy - 0.12 * s, 0.215 * s, 0.17 * s], [0.5 * s, 0.27 * s, 0.23 * s], [0.03 * s, 0.34 * s, 0.3 * s]], { col: robeW, mat: M.silk, folds: 11, fold: 0.05, hem: silver, legK: 0.85, shin: 0.4, nu: 44, nv: 16, backK: 0.4, grad: { axis: 'y', from: 0.8 * s, to: 0.05 * s, col: mix(robeW, blue, 0.45) } });
  robe(B, [[hy + 0.06 * s, 0.18 * s, 0.14 * s], [hy - 0.1 * s, 0.23 * s, 0.185 * s], [0.5 * s, 0.29 * s, 0.25 * s], [0.06 * s, 0.37 * s, 0.33 * s, -0.01 * s]], { col: blue, mat: M.silk, open: 1.1, folds: 9, fold: 0.05, hem: silver, legK: 0.85, shin: 0.4, nu: 36, nv: 14, backK: 0.6, hemWave: 0.03 * s, grad: { axis: 'y', from: 1.0 * s, to: 0.1 * s, col: shade(blue, 0.55) } });
  belt(B, { y: hy + 0.055 * s, rx: 0.18, rz: 0.135, h: 0.035, col: silver, mat: M.metal, buckle: silver, gem: glow });
  // Glühende Runen am Saum (Stufe 6)
  for (let i = 0; i < 10; i++) { const a = 0.55 + (i / 9) * (TAU - 1.1); const g = ext(starShape(0.018 * s, 0.007 * s, 4), 0.004 * s, 0); R(g, 0, a, 0); T(g, V(Math.sin(a) * 0.372 * s, 0.14 * s, Math.cos(a) * 0.335 * s - 0.01 * s)); B.glow(g, glow, 2.4, (p) => [['hips', 0.2], [p.x > 0 ? 'thighL' : 'thighR', 0.55], [p.x > 0 ? 'shinL' : 'shinR', 0.25]], { tier: 6 }); }

  // Glockenärmel ab dem Ellbogen
  const el = J.foreArmL.pos, wr = J.handL.pos;
  { const g = shellTube(el.clone().add(V(0, 0.03 * s, 0)), wr.clone().add(V(0.005 * s, -0.03 * s, 0)), 0.05 * s, 0.075 * s, { sides: 16, segs: 6, flare: 0.04 * s, caps: false }); B.clothSym(g, blue, M.silk, foreArmWeights(B), { grad: { axis: 'y', from: el.y, to: wr.y, col: shade(blue, 0.6) } }); }
  B.sym(rimRing(wr.clone().add(V(0.005 * s, -0.03 * s, 0)), wr.clone().sub(el), 0.112 * s, 0.112 * s, 0.004 * s, 22), silver, M.metal, foreArmWeights(B));
  // Schulterkragen hoch + Kristallspangen
  mantle(B, { col: blue, r0: 0.075, r0z: 0.07, r1: 0.16, r2: 0.22, r1z: 0.12, r2z: 0.16, bottom: J.upperArmL.pos.y - 0.04 * s, top: J.neck.pos.y + 0.08 * s, folds: 6, fold: 0.03, hem: silver });
  for (const sg of [1, -1]) { const g = crystal(0.02 * s, 0.07 * s, 5); R(g, 0, 0, -sg * 0.5); T(g, V(sg * 0.17 * s, J.upperArmL.pos.y + 0.03 * s, 0)); B.glass(g, glow, (p) => [['shoulder' + (sg > 0 ? 'L' : 'R'), 1]]); }

  // Kopf, langes Silberhaar, Diadem
  const H = head(B, { skin, female: true, eye: '#5ad0ff', eyeGlow: 1.3, brow: '#b8bccc', lash: '#2a2a3a' });
  hairCap(B, H, { col: hair, vol: 1.08, front: 0.44, puff: 0.1 });
  for (const sg of [1, -1]) {
    const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(H.c.clone().add(V(sg * (0.07 + 0.025 * t) * s, (0.02 - 0.2 * t) * s, (0.04 - 0.03 * t) * s))); }
    strand(B, pts, 0.026 * s, 0.009 * s, hair, (p) => (p.y > H.c.y - 0.08 * s ? [['head', 1]] : [['head', 0.5], ['neck', 0.5]]), { segs: 12, sides: 8, taper: 0.5, hint: [sg, 0, 0] });
  }
  // langes Rückenhaar an Kette
  const h0 = H.c.clone().add(V(0, 0.02 * s, -0.07 * s));
  B.joint('hair', 'head', h0); B.joint('hair1', 'hair', h0.clone().add(V(0, -0.2 * s, -0.06 * s))); B.joint('hair2', 'hair1', h0.clone().add(V(0, -0.45 * s, -0.08 * s)));
  const hb = W.ramp('y', [[h0.y - 0.45 * s, 'hair2'], [h0.y - 0.2 * s, 'hair1'], [h0.y - 0.04 * s, 'hair']]);
  {
    const pts = [h0.clone().add(V(0, 0.03 * s, 0.03 * s)), h0.clone().add(V(0, -0.1 * s, -0.035 * s)), h0.clone().add(V(0, -0.25 * s, -0.08 * s)), h0.clone().add(V(0, -0.42 * s, -0.1 * s)), h0.clone().add(V(0, -0.56 * s, -0.11 * s))];
    B.add(tube(pts, (t, a) => [0.035 * s * (1 - 0.4 * t), 0.085 * s * (1 - 0.35 * t * t)], { sides: 14, segs: 18, hint: [0, 0, 1] }), hair, M.hair, hb, { grad: { axis: 'y', from: h0.y, to: h0.y - 0.55 * s, col: mix(hair, '#a8c4ff', 0.45) } });
  }
  // Diadem mit Kristall
  { const pts = []; for (let i = 0; i <= 20; i++) { const a = -1.1 + (i / 20) * 2.2; const x = Math.sin(a) * H.rx * 1.1, y = H.c.y + 0.07 * s - (1 - Math.cos(a)) * 0.02 * s; pts.push(V(x, y, Math.max(H.c.z + Math.cos(a) * H.rz * 1.06, H.c.z))); } B.add(sweep(pts, [0.004 * s, 0.004 * s], 5, 40), silver, M.metal, 'head'); const g = crystal(0.012 * s, 0.045 * s, 5); T(g, V(0, H.c.y + 0.065 * s, H.c.z + H.rz * 1.06)); B.glass(g, glow, 'head'); const c = ell(0.006 * s, 0.012 * s, 0.006 * s, 8, 6); T(c, V(0, H.c.y + 0.075 * s, H.c.z + H.rz * 1.06)); B.glow(c, glow, 3.2, 'head'); }
  // Kristall-Halo hinter dem Kopf (dreht sich)
  const hc = H.c.clone().add(V(0, 0.03 * s, -0.16 * s));
  B.joint('halo', 'head', hc);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU, r = 0.17 * s;
    const g = crystal(0.016 * s, (i % 3 === 0 ? 0.07 : 0.045) * s, 5); g.rotateZ(-a + PI / 2 - PI / 2); T(g, V(Math.cos(a) * r, Math.sin(a) * r, 0)); T(g, hc);
    B.glass(g, i % 3 === 0 ? mix(glow, white, 0.3) : glow, 'halo');
    const c = ell(0.005 * s, 0.012 * s, 0.005 * s, 6, 4); c.rotateZ(-a); T(c, V(Math.cos(a) * r, Math.sin(a) * r, 0)); T(c, hc); B.glow(c, glow, 2.6, 'halo');
  }
  { const g = tor(0.17 * s, 0.003 * s, 5, 48); T(g, hc); B.glow(g, glow, 1.8, 'halo'); const g2 = tor(0.205 * s, 0.002 * s, 4, 48); T(g2, hc); B.glow(g2, glow, 2.2, 'halo', { tier: 9 }); }
  // Schwebende Splitter um die Schultern (Stufe 3)
  const floaters = [{ joint: 'halo', type: 'spinZ', rate: 0.45 }, { joint: 'weaponR', type: 'staff' }];
  for (let i = 0; i < 3; i++) {
    const p = V((i - 1) * 0.12 * s, J.chest.pos.y + 0.3 * s, -0.2 * s);
    B.joint('shard' + i, 'chest', p);
    const g = crystal(0.018 * s, 0.07 * s, 5); g.translate(0, -0.02 * s, 0); T(g, p); B.glass(g, glow, 'shard' + i, { tier: 3 });
    const c = ell(0.007 * s, 0.018 * s, 0.007 * s, 6, 4); T(c, p); B.glow(c, glow, 3, 'shard' + i, { tier: 3 });
    floaters.push({ joint: 'shard' + i, type: 'orbit', r: 0.32, speed: 0.9, phase: (i / 3) * TAU });
  }

  // Kristallstab (schwebt in der rechten Hand)
  const fr = weaponJoint(B, 'weaponR', 'R');
  fr.origin.add(fr.F.i.clone().multiplyScalar(-0.035 * s));
  B.J.weaponR.pos.copy(fr.origin);
  const st = staffParts({ len: 1.62 * s, below: 0.62 * s, wood: '#dfe4f2', metal: silver, r: 0.016 * s, woodMat: M.lacquer, bands: [-0.3 * s, 0.1 * s, 0.6 * s] });
  const list = st.list;
  const top = st.top.clone();
  // Silber-Sichel + Kristallbündel
  { const pts = []; for (let i = 0; i <= 16; i++) { const a = -2.4 + (i / 16) * 4.8; pts.push(V(Math.sin(a) * 0.09 * s, top.y + 0.1 * s - Math.cos(a) * 0.09 * s, 0)); } list.push([tube(pts, (t) => 0.008 * s * (0.4 + Math.sin(t * PI)), { sides: 6, segs: 32 }), silver, M.metal]); }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU, g = crystal(0.02 * s, (i === 0 ? 0.16 : 0.09) * s, 6);
    if (i) { g.rotateZ(0.5); g.rotateY(a); }
    g.translate(0, top.y + 0.06 * s, 0);
    const it = [g, mix(glow, white, 0.2), null, 'glass']; list.push(it);
  }
  list.push([ell(0.03 * s, 0.05 * s, 0.03 * s, 12, 8).translate(0, top.y + 0.1 * s, 0), glow, null, 'glow', 3.4]);
  emit(B, list, { origin: fr.origin, y: fr.y, x: fr.x }, 'weaponR');
  return { radius: 0.42 * s, floaters };
}
