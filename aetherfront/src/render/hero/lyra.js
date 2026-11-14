// Lyra Morgenfeder – flinke Jägerin: Langbogen, blattgrüner Kapuzenumhang, Köcher, Leder.
import * as THREE from 'three';
import { V, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, T, R, ext, shape, bend, leafShape, mirrorX } from './geo.js';
import { M, W } from './rig.js';
import { handFrame, torso, torsoRing, arms, legs, boots, hand, neck, head, headInfo, hairCap, strand, capeChain, robe, hood, mantle, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { shellTube, rimRing, belt, plate, bowParts, weaponJoint, emit, place } from './parts.js';

export const proportions = { scale: 0.99, shoulders: 0.92, hipsW: 1.0, torso: 0.98, leg: 1.04, arm: 1.0 };

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const green = C(P.primary), brown = C(P.secondary), gold = C(P.metal), glow = C(P.glow);
  const leaf = shade(mix(green, '#3f7a2a', 0.35), 0.85), dgreen = shade(green, 0.55), leather = mix(brown, '#5a3a22', 0.4), dleather = shade(leather, 0.55);
  const skin = '#e0ae8c', hair = '#b8642c';

  legs(B, { col: shade('#3c3a30', 1), mat: M.leather, bulk: 0.92 });
  torso(B, { col: shade(green, 0.75), mat: M.cloth, female: true, bulk: 0.96 });
  arms(B, { col: shade(green, 0.75), mat: M.cloth, bulk: 0.86, foreCol: skin, foreMat: M.skin });
  neck(B, { col: skin, r: 0.043 });
  hand(B, { col: skin, mat: M.skin, curlL: 1, curlR: 0.55, cuff: dleather });
  boots(B, { col: leather, mat: M.leather, height: 0.4, cuff: gold, flare: 0.012, w: 0.92 });
  // Kniebänder + Schienbeinplatte
  B.sym(shellTube(J.shinL.pos.clone().add(V(0, -0.05 * s, 0.01 * s)), J.footL.pos.clone().add(V(0, 0.24 * s, 0)), 0.062 * s, 0.056 * s, { arc: PI * 0.9, sides: 10, segs: 3, th: 0.006 * s }), dleather, M.leather, legWeights(B));

  // Lederkorsett mit Schnürung
  const S = torso(B, { col: leather, mat: M.leather, female: true, bulk: 0.96, off: 0.012, bottom: -0.06, top: 0.62, caps: false, sides: 22, segs: 10 });
  torsoRing(B, 0.62, 0.014, 0.006, gold, M.gold, { female: true, bulk: 0.96 });
  torsoRing(B, -0.06, 0.014, 0.006, gold, M.gold, { female: true, bulk: 0.96 });
  for (let i = 0; i < 5; i++) {
    const u = 0.04 + i * 0.11;
    const a = S.pt(u, 0.16, 0.016), b = S.pt(u + 0.09, -0.16, 0.016), c = S.pt(u, -0.16, 0.016), d = S.pt(u + 0.09, 0.16, 0.016);
    B.add(sweep([a, a.clone().lerp(b, 0.5).add(V(0, 0, 0.004 * s)), b], [0.0035 * s, 0.0035 * s], 5, 6), gold, M.gold, torsoWeights(B));
    B.add(sweep([c, c.clone().lerp(d, 0.5).add(V(0, 0, 0.004 * s)), d], [0.0035 * s, 0.0035 * s], 5, 6), gold, M.gold, torsoWeights(B));
  }
  // Schulterriemen des Köchers (diagonal)
  {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const a = -PI * 0.75 + t * PI * 2.0; const u = 0.86 - 0.62 * Math.abs(Math.sin(a * 0.5 + 0.4)); pts.push(S.pt(Math.max(0.2, u), a, 0.024)); }
    B.add(tube(pts, () => [0.012 * s, 0.004 * s], { sides: 6, segs: 40, hintFn: () => [0, 1, 0] }), dleather, M.leather, torsoWeights(B));
  }
  belt(B, { y: J.hips.pos.y + 0.0, rx: 0.19, rz: 0.13, h: 0.04, col: dleather, buckle: gold });
  // Gürteltaschen
  for (const [x, z] of [[0.15, 0.08], [-0.17, 0.02]]) {
    const pch = tube([V(x * s, J.hips.pos.y - 0.03 * s, z * s), V(x * s, J.hips.pos.y - 0.11 * s, z * s + 0.01 * s)], (t) => [0.03 * s, 0.045 * s * (1 - 0.15 * t)], { sides: 10, segs: 3 });
    B.add(pch, leather, M.leather, x > 0 ? () => [['hips', 0.7], ['thighL', 0.3]] : () => [['hips', 0.7], ['thighR', 0.3]]);
  }
  // kurzer Waffenrock (geteilt)
  robe(B, [[J.hips.pos.y + 0.03 * s, 0.185 * s, 0.135 * s], [J.hips.pos.y - 0.1 * s, 0.215 * s, 0.17 * s], [J.shinL.pos.y + 0.2 * s, 0.24 * s, 0.2 * s]], { col: shade(green, 0.9), folds: 7, fold: 0.06, tatter: 0.06 * s, tears: 6, hem: gold, legK: 0.9, nu: 32, nv: 7, backK: 0.4 });

  // Armschutz links (Bogenarm), Armband rechts
  const el = J.foreArmL.pos, wr = J.handL.pos;
  B.add(shellTube(el.clone().lerp(wr, 0.18), wr.clone().add(V(0, 0.02 * s, 0)), 0.047 * s, 0.041 * s, { sides: 12, segs: 3, flare: 0.01 * s }), leather, M.leather, foreArmWeights(B, 'L'));
  B.add(rimRing(wr.clone().add(V(0, 0.02 * s, 0)), wr.clone().sub(el), 0.052 * s, 0.052 * s, 0.004 * s), gold, M.gold, foreArmWeights(B, 'L'));
  { const g = shellTube(el.clone().lerp(wr, 0.5), wr.clone().add(V(0, 0.02 * s, 0)), 0.043 * s, 0.039 * s, { sides: 12, segs: 2 }); B._part(g, dleather, M.leather, foreArmWeights(B, 'L'), {}, 'body', true); }
  // Blatt-Schulterstück links
  for (let i = 0; i < 4; i++) {
    const lf = ext(leafShape(0.1 * s, 0.06 * s), 0.006 * s, 0.002 * s, 1, 3); bend(lf, 8, 0);
    R(lf, -PI / 2 + 0.3, 0, 0); R(lf, 0, 0, -0.9 - i * 0.18); R(lf, 0, -0.5 + i * 0.35, 0);
    T(lf, J.upperArmL.pos.clone().add(V(0.035 * s, 0.05 * s - i * 0.012 * s, (-0.04 + i * 0.03) * s)));
    B.add(lf, i % 2 ? shade(leaf, 0.8) : shade(leaf, 0.65), M.leaf, (p) => [['shoulderL', 0.5], ['upperArmL', 0.5]]);
  }
  { const g = tube([J.upperArmL.pos.clone().add(V(0.05 * s, 0.03 * s, -0.05 * s)), J.upperArmL.pos.clone().add(V(0.07 * s, 0.0, 0.0)), J.upperArmL.pos.clone().add(V(0.05 * s, 0.03 * s, 0.05 * s))], () => 0.003 * s, { sides: 5, segs: 10 }); B.glow(g, glow, 2.2, (p) => [['shoulderL', 0.5], ['upperArmL', 0.5]], { tier: 6 }); }

  // Kopf, Gesicht, Haar
  const H = head(B, { skin, female: true, eye: '#3f7a3a', brow: '#7a3a1a', lash: '#2a1410' });
  hairCap(B, H, { col: hair, vol: 1.06, front: 0.42 });
  // Stirnsträhnen (seitlich gescheitelt, an die Stirn geschmiegt)
  for (const [x0, x1, w] of [[0.0, 0.05, 0.026], [-0.015, -0.055, 0.02], [0.03, 0.07, 0.016]]) {
    const pts = [];
    for (let i = 0; i <= 4; i++) { const t = i / 4; const x = (x0 + (x1 - x0) * t) * s, y = H.c.y + (0.1 - 0.075 * t) * s; pts.push(V(x, y, Math.max(H.surf(x, y), H.c.z + 0.05 * s) + (0.006 + 0.004 * Math.sin(t * PI)) * s)); }
    strand(B, pts, w * s, 0.0045 * s, hair, 'head', { segs: 10, sides: 8, taper: 0.7 });
  }
  // Zopf an Knochenkette (schwingt)
  const z0 = H.c.clone().add(V(0, -0.02 * s, -0.1 * s));
  B.joint('hair', 'head', z0);
  B.joint('hair1', 'hair', z0.clone().add(V(0, -0.14 * s, -0.035 * s)));
  B.joint('hair2', 'hair1', z0.clone().add(V(0, -0.3 * s, -0.04 * s)));
  const bw = W.ramp('y', [[z0.y - 0.3 * s, 'hair2'], [z0.y - 0.14 * s, 'hair1'], [z0.y - 0.02 * s, 'hair']]);
  for (let k = 0; k < 9; k++) {
    const y0 = z0.y - k * 0.04 * s, sx = (k % 2 ? 1 : -1) * 0.012 * s;
    const g = ell(0.026 * s * (1 - k * 0.06), 0.03 * s, 0.024 * s * (1 - k * 0.06), 10, 8); R(g, 0, 0, sx * 20); T(g, V(sx, y0, z0.z - 0.004 * s * k));
    B.add(g, k % 2 ? hair : shade(hair, 0.85), M.hair, bw);
  }
  { const tie = tor(0.022 * s, 0.006 * s, 6, 14); tie.rotateX(PI / 2); T(tie, V(0, z0.y - 0.3 * s, z0.z - 0.035 * s)); B.add(tie, gold, M.gold, 'hair2'); }
  // Kapuze + Kragen-Umhang
  hood(B, H, { col: leaf, inCol: dgreen, gap: 1.75, tip: 0.45, scale: 1.4, theta: 0.74, flare: 0.65, grad: { axis: 'y', from: H.c.y + 0.15 * s, to: H.c.y - 0.15 * s, col: shade(leaf, 0.8) } });
  mantle(B, { col: shade(leaf, 0.9), r0: 0.07, r1: 0.17, r2: 0.24, r1z: 0.13, r2z: 0.17, bottom: J.upperArmL.pos.y - 0.07 * s, folds: 6, tatter: 0.04 * s, tears: 7, top: J.neck.pos.y + 0.03 * s });
  capeChain(B, { top: J.neck.pos.y - 0.02 * s, back: -0.11 * s, w0: 0.4 * s, w1: 0.72 * s, len: 1.0 * s, col: leaf, mat: M.cloth, folds: 5, fold: 0.03 * s, wrap: 1.5, wrapK: 0.7, shoulder: 0.12 * s, tatter: 0.07 * s, inGrad: { axis: 'y', from: 1.45 * s, to: 0.5 * s, col: shade(leaf, 0.6) } });
  // Umhangspange (Blatt)
  { const lf = ext(leafShape(0.05 * s, 0.035 * s), 0.008 * s, 0.003 * s, 1, 3); R(lf, 0, 0, 0.5); T(lf, V(0.0, J.neck.pos.y - 0.06 * s, 0.11 * s)); B.add(lf, gold, M.gold, 'chest'); const gm = ell(0.008 * s, 0.008 * s, 0.005 * s, 8, 6); T(gm, V(-0.01 * s, J.neck.pos.y - 0.04 * s, 0.12 * s)); B.glow(gm, glow, 3, 'chest'); }

  // Köcher auf dem Rücken (diagonal) mit Pfeilen
  {
    const a = V(0.1 * s, J.hips.pos.y + 0.12 * s, -0.17 * s), b = V(-0.08 * s, J.neck.pos.y - 0.02 * s, -0.2 * s);
    const qb = (p) => [['chest', 0.8], ['spine', 0.2]];
    B.add(tube([a, b], (t) => 0.045 * s * (1 + 0.15 * t), { sides: 12, segs: 3 }), leather, M.leather, qb);
    B.add(rimRing(b, b.clone().sub(a), 0.053 * s, 0.053 * s, 0.006 * s, 18), gold, M.gold, qb);
    B.add(rimRing(a.clone().lerp(b, 0.15), b.clone().sub(a), 0.048 * s, 0.048 * s, 0.005 * s, 18), gold, M.gold, qb);
    const dir = b.clone().sub(a).normalize();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU, off = V(Math.cos(ang) * 0.022 * s, Math.sin(ang) * 0.02 * s, 0);
      const p0 = b.clone().add(off).addScaledVector(dir, -0.05 * s), p1 = p0.clone().addScaledVector(dir, 0.16 * s);
      B.add(tube([p0, p1], () => 0.004 * s, { sides: 5, segs: 1 }), '#d9c49a', M.wood, qb);
      for (let f = 0; f < 3; f++) {
        const fl = ext(shape([[0, 0], [0.012, 0.02], [0.01, 0.07], [0, 0.08]].map(([x, y]) => [x * s, y * s])), 0.002 * s, 0, 1, 2);
        place(fl, p0.clone().addScaledVector(dir, 0.07 * s), dir, V(Math.cos(ang + f * 2.1), Math.sin(ang + f * 2.1), 0));
        B.add(fl, f === 0 ? '#e8e2d2' : shade(green, 1.1), M.feather, qb);
      }
    }
  }

  // Langbogen (linke Hand) + Sehne + Pfeil
  const fr = weaponJoint(B, 'weaponL', 'L');
  const bow = bowParts({ h: 0.66 * s, wood: '#5e3d22', trim: gold, glow });
  // Bogen: Wurfarme entlang der Griffachse (Hand vorn = f), Sehne zur Körperseite (−i ... hier −X lokal → innen)
  const bx = fr.F.i.clone(); // Bogen-Bauch zeigt nach außen, Sehne nach innen
  const frame = { origin: fr.origin, y: fr.F.f.clone(), x: fr.F.d.clone().negate() };
  // lokale Z-Achse des Bogens (Bauchrichtung) = x × y; wir wollen Sehne Richtung Körpermitte
  emit(B, bow.list, frame, 'weaponL');
  const toW = (p) => { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([p.x, p.y, p.z], 3)); place(g, frame.origin, frame.y, frame.x); const a = g.attributes.position; return V(a.getX(0), a.getY(0), a.getZ(0)); };
  const tipT = toW(bow.tipTop), tipB = toW(bow.tipBot), nock = toW(V(0, 0, -0.05 * s));
  B.joint('bowString', 'weaponL', nock);
  const ylen = tipT.distanceTo(nock);
  const sw = (p) => { const d = Math.min(p.distanceTo(tipT), p.distanceTo(tipB)); const t = smooth(0, 1, d / ylen); return [['weaponL', 1 - t], ['bowString', t]]; };
  B.add(tube([tipT, nock], () => 0.0022 * s, { sides: 4, segs: 6 }), '#e8e0c8', M.silk, sw);
  B.add(tube([nock, tipB], () => 0.0022 * s, { sides: 4, segs: 6 }), '#e8e0c8', M.silk, sw);
  // Pfeil (sichtbar beim Spannen): Schaft vom Nockpunkt durch den Griff nach vorn
  B.joint('arrow', 'weaponL', nock);
  {
    const dir = fr.origin.clone().sub(nock).normalize();
    const tail = nock.clone(), tip = nock.clone().addScaledVector(dir, 0.78 * s);
    B.add(tube([tail, tip], () => 0.0045 * s, { sides: 6, segs: 1 }), '#d9c49a', M.wood, 'arrow');
    const head = cone(0.012 * s, 0.05 * s, 8); head.translate(0, 0.025 * s, 0); place(head, tip, dir, V(0, 1, 0)); B.add(head, '#c8cdd6', M.steel, 'arrow');
    const hg = cone(0.006 * s, 0.035 * s, 6); hg.translate(0, 0.02 * s, 0); place(hg, tip, dir, V(0, 1, 0)); B.glow(hg, glow, 2.5, 'arrow');
    for (let f = 0; f < 3; f++) {
      const fl = ext(shape([[0, 0], [0.014, 0.02], [0.012, 0.08], [0, 0.09]].map(([x, y]) => [x * s, y * s])), 0.002 * s, 0, 1, 2);
      const side = V(0, 1, 0).applyAxisAngle(dir, f * TAU / 3);
      place(fl, tail.clone().addScaledVector(dir, 0.01 * s), dir, side);
      B.add(fl, f === 0 ? '#e8e2d2' : shade(green, 1.1), M.feather, 'arrow');
    }
  }
  const restLocal = nock.clone().sub(fr.origin);
  return {
    radius: 0.45 * s,
    bowRest: restLocal, bowNock: handFrame(B, 'R').grip.sub(J.handR.pos),
    capeMin: 0.05,
  };
}
