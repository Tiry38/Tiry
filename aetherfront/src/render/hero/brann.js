// Brann Eisenfaust – Krieger: riesiger Runenhammer, Kupfer/Stahl-Platten, Pelzkragen, geflochtener Bart.
import * as THREE from 'three';
import { V, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, blob, T, R, ext, shape, bend, starShape } from './geo.js';
import { M, W } from './rig.js';
import { torso, torsoRing, arms, legs, boots, hand, neck, head, hairCap, strand, mantle, robe, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { pauldron, shellTube, rimRing, belt, plate, hammerParts, weaponJoint, emit } from './parts.js';

export const proportions = { scale: 1.04, shoulders: 1.2, hipsW: 1.1, torso: 1.0, leg: 0.96, arm: 1.04, neck: 0.85 };

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const steelD = C(P.primary), copper = C(P.secondary), steel = C(P.metal), glow = C(P.glow);
  const skin = '#c98d6a', beard = '#8a3a1a', leather = '#4a3020', fur = '#5a4636';

  legs(B, { col: '#3a3430', mat: M.leather, bulk: 1.12 });
  torso(B, { col: skin, mat: M.skin, bulk: 1.08, chest: 1.08, belly: 1.05 });
  arms(B, { col: skin, mat: M.skin, bulk: 1.2 });
  neck(B, { col: skin, r: 0.062 });
  hand(B, { col: leather, mat: M.leather, curl: 1, armored: copper });
  boots(B, { col: leather, mat: M.leather, height: 0.32, w: 1.1, cuff: copper, toe: 0.02 });
  // Beinschienen + Kniekacheln
  const kn = J.shinL.pos, an = J.footL.pos;
  B.sym(shellTube(kn.clone().add(V(0, -0.03 * s, 0.01 * s)), an.clone().add(V(0, 0.2 * s, 0)), 0.068 * s, 0.06 * s, { arc: PI * 1.1, sides: 12, segs: 3, th: 0.008 * s, ridge: 0.008 * s }), steelD, M.dmetal, legWeights(B));
  { const g = smoothSphere(1, 12, 10); warp(g, (p) => { if (p.z < 0) p.z *= 0.4; }); g.scale(0.065 * s, 0.07 * s, 0.055 * s); T(g, kn.clone().add(V(0, 0.01 * s, 0.035 * s))); B.sym(g, copper, M.copper, W.joint('thighL', 'shinL', kn, V(0, -1, 0), 0.03)); }

  // Brustpanzer (dunkler Stahl) mit Kupferkanten und Rune
  const S = torso(B, { col: steelD, mat: M.dmetal, bulk: 1.08, chest: 1.08, belly: 1.05, off: 0.022, bottom: 0.0, top: 0.86, caps: false, ridge: 0.01, sides: 22, segs: 12 });
  torsoRing(B, 0.86, 0.024, 0.009, copper, M.copper, { bulk: 1.08, chest: 1.08, belly: 1.05 });
  torsoRing(B, 0.0, 0.025, 0.01, copper, M.copper, { bulk: 1.08, chest: 1.08, belly: 1.05 });
  for (const u of [0.3, 0.55]) torsoRing(B, u, 0.024, 0.005, shade(steelD, 0.7), M.dmetal, { bulk: 1.08, chest: 1.08, belly: 1.05, a0: -1.2, arc: 2.4 });
  { const c = S.pt(0.62, 0, 0.034); const g = ext(shape([[0, 0.06], [0.04, 0.0], [0, -0.06], [-0.04, 0]].map(([x, y]) => [x * s, y * s])), 0.012 * s, 0.004 * s); T(g, c); B.add(g, copper, M.copper, 'chest'); const r = ext(shape([[0, 0.035], [0.022, 0.0], [0, -0.035], [-0.022, 0]].map(([x, y]) => [x * s, y * s])), 0.01 * s, 0); T(r, c.clone().add(V(0, 0, 0.006 * s))); B.glow(r, glow, 3, 'chest'); }
  // Kettengeflecht-Schurz + Plattenrock
  const hy = J.hips.pos.y;
  robe(B, [[hy + 0.03 * s, 0.205 * s, 0.155 * s], [hy - 0.1 * s, 0.24 * s, 0.19 * s], [kn.y + 0.12 * s, 0.25 * s, 0.21 * s]], { col: leather, mat: M.leather, folds: 8, fold: 0.04, legK: 0.95, nu: 32, nv: 6, backK: 0.4 });
  const tas = (ang, w) => {
    for (let k = 0; k < 3; k++) {
      const p = plate([[-w, 0], [w, 0], [w * 1.08, -0.085], [0, -0.1], [-w * 1.08, -0.085]], 0.01, 5);
      R(p, -0.1, ang, 0); T(p, V(Math.sin(ang) * 0.235 * s, hy - (0.0 + k * 0.075) * s, Math.cos(ang) * 0.185 * s + k * 0.006 * s));
      B.sym(p, k === 2 ? copper : steelD, k === 2 ? M.copper : M.dmetal, () => [['hips', 0.4], ['thighL', 0.6]]);
    }
  };
  tas(0.45, 0.075); tas(1.25, 0.075);
  belt(B, { y: hy + 0.04 * s, rx: 0.235, rz: 0.18, h: 0.07, col: leather, buckle: copper, gem: glow });
  { const g = lathe([[0, 0], [0.045, 0.002], [0.05, 0.012], [0.04, 0.02], [0, 0.022]].map(([r, y]) => [r * s, y * s]), 18); R(g, PI / 2, 0, 0); T(g, V(0, hy + 0.04 * s, 0.185 * s)); B.add(g, copper, M.copper, 'hips'); }

  // Schultern: rechts großer Kupfer-Pauldron mit Rune, links Stahl; Pelzkragen
  {
    const c = J.upperArmL.pos.clone().add(V(0.02 * s, 0.05 * s, 0));
    pauldron(B, { r: 0.12, layers: 2, col: steelD, col2: shade(steelD, 0.85), trim: copper, mat: M.dmetal, tilt: 0.55 });
  }
  {
    // Rechts: übergroß, Kupfer, Stacheln
    const c = J.upperArmR.pos.clone().add(V(-0.03 * s, 0.07 * s, 0));
    for (let i = 0; i < 3; i++) {
      const rr = 0.155 * s * (1 - i * 0.12), h = rr * (0.85 - i * 0.12);
      const g = lathe([[0, h], [rr * 0.45, h * 0.94], [rr * 0.8, h * 0.66], [rr * 0.98, h * 0.25], [rr * 1.06, 0.0], [rr * 1.02, -rr * 0.06], [rr * 0.9, -rr * 0.02], [rr * 0.6, h * 0.3], [0, h * 0.4]], 22);
      g.scale(1, 1, 0.92); R(g, 0, 0, 0.5 + i * 0.32); T(g, c.clone().add(V(-i * 0.03 * s, -i * 0.07 * s, 0)));
      B.add(g, i === 0 ? copper : shade(copper, 0.8), M.copper, () => [['shoulderR', 0.55], ['upperArmR', 0.45]]);
      const t = tor(rr * 1.05, rr * 0.05, 5, 22); t.rotateX(PI / 2); t.scale(1, 1, 0.92); R(t, 0, 0, 0.5 + i * 0.32); T(t, c.clone().add(V(-i * 0.03 * s, -i * 0.07 * s, 0)));
      B.add(t, steel, M.steel, () => [['shoulderR', 0.55], ['upperArmR', 0.45]]);
    }
    for (let k = 0; k < 3; k++) { const sp = cone(0.022 * s, (0.11 - Math.abs(k - 1) * 0.03) * s, 8); sp.translate(0, 0.05 * s, 0); R(sp, (k - 1) * 0.45, 0, 0.45); T(sp, c.clone().add(V(-0.03 * s, 0.1 * s, (k - 1) * 0.05 * s))); B.add(sp, steel, M.steel, () => [['shoulderR', 0.55], ['upperArmR', 0.45]], { tier: 6 }); }
    const rn = ext(starShape(0.035 * s, 0.014 * s, 4), 0.006 * s, 0); R(rn, 0, -PI / 2 + 0.5, 0); R(rn, 0, 0, 0.5); T(rn, c.clone().add(V(-0.11 * s, 0.04 * s, 0))); B.glow(rn, glow, 3, () => [['shoulderR', 0.55], ['upperArmR', 0.45]], { tier: 3 });
  }
  {
    // Pelzkragen: klumpiger Ring
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU; if (Math.cos(a) > 0.75) continue;
      const g = blob(0.075 * s, i * 1.7, 0.25, 10, 8); g.scale(1, 0.8, 1);
      T(g, V(Math.sin(a) * 0.17 * s, J.neck.pos.y - 0.05 * s + Math.cos(a) * -0.01 * s, Math.cos(a) * 0.12 * s - 0.03 * s));
      B.add(g, i % 2 ? fur : shade(fur, 0.82), M.fur, torsoWeights(B));
    }
  }
  // Armschienen (Kupfer/Stahl) + Oberarm-Riemen
  const el = J.foreArmL.pos, wr = J.handL.pos;
  B.sym(shellTube(el.clone().lerp(wr, 0.12), wr.clone().add(V(0, 0.02 * s, 0)), 0.062 * s, 0.054 * s, { sides: 14, segs: 3, flare: 0.012 * s, ridge: 0.007 * s, ridgeA: PI / 2 }), steelD, M.dmetal, foreArmWeights(B));
  B.sym(rimRing(wr.clone().add(V(0, 0.02 * s, 0)), wr.clone().sub(el), 0.068 * s, 0.068 * s, 0.007 * s, 18), copper, M.copper, foreArmWeights(B));
  B.sym(rimRing(el.clone().lerp(wr, 0.14), wr.clone().sub(el), 0.064 * s, 0.064 * s, 0.006 * s, 18), copper, M.copper, foreArmWeights(B));
  { const ua = J.upperArmL.pos.clone().lerp(el, 0.55); B.sym(rimRing(ua, el.clone().sub(J.upperArmL.pos), 0.066 * s, 0.066 * s, 0.009 * s, 18), leather, M.leather, upperArmWeights(B)); }
  for (let i = 0; i < 3; i++) { const p = el.clone().lerp(wr, 0.35 + i * 0.2).add(V(0.064 * s, 0, 0)); const g = ext(shape([[0, -0.013], [0.007, 0], [0, 0.013], [-0.007, 0]].map(([x, y]) => [x * s, y * s])), 0.006 * s, 0); R(g, 0, PI / 2, 0); T(g, p); B.glowSym(g, glow, 2.6, foreArmWeights(B), { tier: 3 }); }

  // Kopf: kantiges Gesicht, Bart mit Zöpfen, Seiten rasiert + Haarkamm
  const H = head(B, { skin, jaw: 1.25, eye: '#3a6a8a', brow: beard, scale: 1.04 });
  hairCap(B, H, { col: shade(beard, 0.7), vol: 1.015, front: 0.45 });
  { const pts = []; for (let i = 0; i <= 8; i++) { const a = -1.7 + (i / 8) * 2.25; pts.push(H.c.clone().add(V(0, Math.cos(a) * H.ry * 1.03, Math.sin(a) * H.rz * 1.05))); } B.add(tube(pts, (t) => [0.03 * s * (1 - 0.3 * Math.abs(t - 0.3)), 0.024 * s], { sides: 10, segs: 20, hint: [0, 1, 0] }), beard, M.hair, 'head'); }
  // Zopf am Hinterkopf (Kette)
  const z0 = H.c.clone().add(V(0, 0.0, -0.11 * s));
  B.joint('hair', 'head', z0); B.joint('hair1', 'hair', z0.clone().add(V(0, -0.12 * s, -0.03 * s)));
  for (let k = 0; k < 6; k++) { const g = ell(0.022 * s, 0.026 * s, 0.02 * s, 8, 6); R(g, 0, 0, (k % 2 ? 0.3 : -0.3)); T(g, z0.clone().add(V((k % 2 ? 0.006 : -0.006) * s, -k * 0.035 * s, -k * 0.008 * s))); B.add(g, k % 2 ? beard : shade(beard, 0.85), M.hair, W.ramp('y', [[z0.y - 0.12 * s, 'hair1'], [z0.y, 'hair']])); }
  // Vollbart
  {
    const bc = H.c.clone().add(V(0, -0.075 * s, 0.045 * s));
    const g = blob(0.075 * s, 3, 0.12, 16, 12);
    warp(g, (p) => { const y = p.y / (0.075 * s); p.x *= 1.15 - 0.35 * Math.max(0, -y); p.z *= 0.75; if (p.z < -0.02 * s) p.z = -0.02 * s + (p.z + 0.02 * s) * 0.3; p.y *= 1.25; });
    T(g, bc); B.add(g, beard, M.hair, (p) => [['head', 0.85], ['neck', 0.15]]);
    const mu = tube([H.c.clone().add(V(-0.045 * s, -0.068 * s, H.rz * 0.9)), H.c.clone().add(V(0, -0.05 * s, H.rz * 1.0)), H.c.clone().add(V(0.045 * s, -0.068 * s, H.rz * 0.9))], (t) => 0.012 * s * (0.5 + Math.sin(t * PI)), { sides: 8, segs: 12 });
    B.add(mu, shade(beard, 1.1), M.hair, 'head');
    for (const sg of [1, -1]) {
      const p0 = H.c.clone().add(V(sg * 0.03 * s, -0.15 * s, 0.06 * s));
      for (let k = 0; k < 4; k++) { const g2 = ell(0.012 * s, 0.016 * s, 0.012 * s, 8, 6); T(g2, p0.clone().add(V(0, -k * 0.022 * s, -k * 0.004 * s))); B.add(g2, k % 2 ? beard : shade(beard, 0.85), M.hair, (p) => [['head', 0.6], ['neck', 0.4]]); }
      const ring = tor(0.012 * s, 0.004 * s, 5, 12); ring.rotateX(PI / 2); T(ring, p0.clone().add(V(0, -0.095 * s, -0.016 * s))); B.add(ring, copper, M.copper, (p) => [['head', 0.6], ['neck', 0.4]]);
    }
  }
  // Kriegsbemalung + Stirnreif (Stufe 9 glühend)
  { const pts = []; for (let i = 0; i <= 16; i++) { const a = -1.3 + (i / 16) * 2.6; pts.push(V(Math.sin(a) * H.rx * 1.06, H.c.y + 0.05 * s, H.c.z + Math.cos(a) * H.rz * 1.03)); } B.add(sweep(pts, [0.006 * s, 0.006 * s], 5, 32), copper, M.copper, 'head', { tier: 6 }); B.glow(sweep(pts.slice(6, 11).map((p) => p.clone().add(V(0, 0, 0.006 * s))), [0.002 * s, 0.002 * s], 4, 8), glow, 3, 'head', { tier: 9 }); }

  // Runenhammer (rechte Hand)
  const fr = weaponJoint(B, 'weaponR', 'R');
  emit(B, hammerParts({ len: 1.1 * s, head: 0.21 * s, metal: shade(steel, 0.9), copper, glow, wood: '#4a3020' }), { origin: fr.origin, y: fr.y, x: fr.x }, 'weaponR');
  return { radius: 0.55 * s };
}
