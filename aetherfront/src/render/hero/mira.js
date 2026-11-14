// Mira Lichtquell – Priesterin/Heilerin: weiß-goldene Roben, Laternenstab mit warmem Licht, Flügel-Motiv.
import * as THREE from 'three';
import { V, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, T, R, ext, shape, bend, starShape } from './geo.js';
import { M, W } from './rig.js';
import { torso, torsoRing, arms, legs, boots, hand, neck, head, hairCap, strand, mantle, robe, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { shellTube, rimRing, belt, plate, staffParts, weaponJoint, emit, place } from './parts.js';

export const proportions = { scale: 0.97, shoulders: 0.92, hipsW: 1.02, torso: 1.0, leg: 1.02, arm: 1.0 };

/** Feder-Flügelchen aus Goldplatten (links gebaut). root, Ausrichtung, Größe */
function wingFan(B, root, size, col, bind, o = {}) {
  const s = B.skel.s;
  for (let i = 0; i < (o.n || 6); i++) {
    const len = size * (1 - i * 0.11), w = size * 0.26;
    const f = ext(shape([[0, 0], [w * 0.5, len * 0.25], [w * 0.45, len * 0.75], [0.0, len], [-w * 0.35, len * 0.6], [-w * 0.4, len * 0.2]], 2), 0.006 * s, 0.002 * s, 1, 3);
    bend(f, 4, 0);
    R(f, 0, o.yaw ?? PI / 2, 0);
    R(f, 0, 0, -(o.a0 ?? 0.2) - i * (o.da ?? 0.24));
    T(f, root.clone().add(V(0, -i * 0.004 * s, -i * 0.006 * s)));
    B.add(f, i % 2 ? col : shade(col, 0.88), M.gold, bind, o);
    if (o.glowEdge) { const e = sweep([V(0, len * 0.3, 0), V(0, len * 0.97, 0)], [0.002 * s, 0.001 * s], 4, 4); R(e, 0, o.yaw ?? PI / 2, 0); R(e, 0, 0, -(o.a0 ?? 0.2) - i * (o.da ?? 0.24)); T(e, root.clone().add(V(0.004 * s, -i * 0.004 * s, -i * 0.006 * s))); B.glow(e, o.glowEdge, 2.4, bind, { tier: o.glowTier ?? 6 }); }
  }
}

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const cream = C(P.primary), gold = C(P.secondary), metal = C(P.metal), glow = C(P.glow);
  const robeC = mix(cream, '#d8c49a', 0.45), skin = '#e8b896', hair = '#e0b45a';

  legs(B, { col: shade(robeC, 0.8), mat: M.cloth, bulk: 0.88 });
  boots(B, { col: shade(gold, 0.7), mat: M.leather, height: 0.22, w: 0.86, cuff: metal });
  torso(B, { col: robeC, mat: M.silk, female: true, bulk: 0.95 });
  arms(B, { col: robeC, mat: M.silk, bulk: 0.86 });
  neck(B, { col: skin, r: 0.042 });
  hand(B, { col: skin, mat: M.skin, curlL: 0.3, curlR: 1 });
  // Mieder gold gerippt
  const S = torso(B, { col: shade(gold, 0.9), mat: M.gold, female: true, bulk: 0.95, off: 0.01, bottom: -0.03, top: 0.36, caps: false, sides: 22, segs: 6 });
  for (const u of [-0.03, 0.12, 0.24, 0.36]) torsoRing(B, u, 0.013, 0.005, metal, M.gold, { female: true, bulk: 0.95 });
  // Lange Robe + goldener Vorderlatz
  const hy = J.hips.pos.y;
  robe(B, [[hy + 0.04 * s, 0.17 * s, 0.13 * s], [hy - 0.12 * s, 0.22 * s, 0.17 * s], [0.45 * s, 0.27 * s, 0.22 * s], [0.04 * s, 0.32 * s, 0.27 * s]], { col: robeC, mat: M.silk, folds: 12, fold: 0.045, hem: metal, hemR: 0.012, legK: 0.85, shin: 0.4, nu: 44, nv: 16, backK: 0.45, grad: { axis: 'y', from: 0.7 * s, to: 0.05 * s, col: mix(robeC, gold, 0.55) } });
  // goldene Längsborten der Robe
  for (const a of [0.42, -0.42, 2.4, -2.4]) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, y = hy + 0.02 * s - t * (hy - 0.06 * s); const r = 0.17 + (0.32 - 0.17) * t, rz = 0.13 + (0.27 - 0.13) * t; pts.push(V(Math.sin(a) * r * s * 1.02, y, Math.cos(a) * rz * s * 1.02)); } B.add(tube(pts, () => [0.004 * s, 0.009 * s], { sides: 6, segs: 16 }), metal, M.gold, (p) => [['hips', 0.5], [a > 0 ? 'thighL' : 'thighR', 0.5]]); }
  {
    const top = hy + 0.03 * s, bot = 0.12 * s, nu = 6, nv = 14, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu - 0.5, v = j / nv, y = top - v * (top - bot);
      const w = (0.09 + 0.05 * v) * s, r = 0.18 + 0.12 * v;
      pos.push(u * 2 * w, y - (Math.abs(u) < 0.3 ? 0.03 * s * smooth(0.85, 1, v) * (1 - Math.abs(u) / 0.3) : 0), (r * s * 0.86) + 0.012 * s - u * u * 0.08 * s);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const bind = (p) => { const t = smooth(top, bot, p.y); return [['hips', 1 - t * 0.85], ['thighL', t * 0.425], ['thighR', t * 0.425]]; };
    B.cloth(g, gold, M.silk, bind);
    const sun = ext(starShape(0.06 * s, 0.025 * s, 8), 0.006 * s, 0.002 * s); T(sun, V(0, hy - 0.2 * s, 0.2 * s)); B.add(sun, metal, M.gold, bind);
    const sg = ell(0.014 * s, 0.014 * s, 0.006 * s, 10, 8); T(sg, V(0, hy - 0.2 * s, 0.207 * s)); B.glow(sg, glow, 3, bind, { tier: 3 });
  }
  belt(B, { y: hy + 0.03 * s, rx: 0.18, rz: 0.135, h: 0.035, col: metal, mat: M.gold, buckle: metal, gem: glow });
  // Weite Ärmel
  const el = J.foreArmL.pos, wr = J.handL.pos;
  { const g = shellTube(el.clone().add(V(0, 0.04 * s, 0)), wr.clone().add(V(0.005 * s, -0.02 * s, 0)), 0.052 * s, 0.07 * s, { sides: 16, segs: 5, flare: 0.03 * s, caps: false }); B.clothSym(g, robeC, M.silk, foreArmWeights(B)); }
  B.sym(rimRing(wr.clone().add(V(0.005 * s, -0.02 * s, 0)), wr.clone().sub(el), 0.1 * s, 0.1 * s, 0.006 * s, 22), metal, M.gold, foreArmWeights(B));
  // Kragen-Kapuze (zurückgeschlagen) + Flügel-Schulterstücke
  mantle(B, { col: robeC, r0: 0.08, r1: 0.18, r2: 0.25, r1z: 0.14, r2z: 0.18, bottom: J.upperArmL.pos.y - 0.06 * s, top: J.neck.pos.y + 0.03 * s, folds: 7, fold: 0.04, hem: metal });
  { const g = tor(0.1 * s, 0.035 * s, 10, 24); g.rotateX(PI / 2 - 0.3); g.scale(1, 1, 0.8); T(g, V(0, J.neck.pos.y + 0.0 * s, -0.08 * s)); B.cloth(g, shade(robeC, 0.92), M.silk, (p) => [['chest', 0.7], ['neck', 0.3]]); }
  wingFan(B, J.upperArmL.pos.clone().add(V(0.03 * s, 0.06 * s, -0.02 * s)), 0.15 * s, metal, (p) => [['shoulderL', 0.6], ['upperArmL', 0.4]], { n: 5, yaw: PI / 2 + 0.25, a0: 0.4, da: 0.3, glowEdge: glow, glowTier: 6 });
  wingFan(B, mirrorV(J.upperArmL.pos.clone().add(V(0.03 * s, 0.06 * s, -0.02 * s))), 0.15 * s, metal, (p) => [['shoulderR', 0.6], ['upperArmR', 0.4]], { n: 5, yaw: -PI / 2 - 0.25, a0: -0.4, da: -0.3, glowEdge: glow, glowTier: 6 });
  // Rückenflügel (Ornament, Stufe 3; ab 9 größer & leuchtend)
  for (const sg of [1, -1]) {
    const root = V(sg * 0.07 * s, J.chest.pos.y + 0.14 * s, -0.15 * s);
    wingFan(B, root, 0.28 * s, metal, (p) => [['chest', 1]], { n: 6, yaw: sg > 0 ? PI / 2 - 0.5 : -PI / 2 + 0.5, a0: sg * 0.5, da: sg * 0.2, tier: 3, glowEdge: glow, glowTier: 9 });
  }

  // Kopf: Gesicht, goldenes Haar mit Knoten, Reif
  const H = head(B, { skin, female: true, eye: '#a8742a', brow: '#a0702a', lash: '#3a2410' });
  hairCap(B, H, { col: hair, vol: 1.07, front: 0.4, puff: 0.08 });
  { const g = smoothSphere(1, 14, 10); g.scale(0.055 * s, 0.05 * s, 0.05 * s); T(g, H.c.clone().add(V(0, 0.05 * s, -0.1 * s))); B.add(g, hair, M.hair, 'head'); const r = tor(0.04 * s, 0.006 * s, 6, 18); R(r, 0.6, 0, 0); T(r, H.c.clone().add(V(0, 0.045 * s, -0.085 * s))); B.add(r, metal, M.gold, 'head'); }
  for (const sg of [1, -1]) {
    const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(H.c.clone().add(V(sg * (0.07 + 0.02 * t) * s, (0.03 - 0.17 * t) * s, (0.045 - 0.02 * t) * s))); }
    strand(B, pts, 0.02 * s, 0.008 * s, hair, (p) => (p.y > H.c.y - 0.08 * s ? [['head', 1]] : [['head', 0.5], ['neck', 0.5]]), { segs: 10, sides: 8, taper: 0.5, hint: [sg, 0, 0] });
  }
  { const pts = []; for (let i = 0; i <= 20; i++) { const a = -1.15 + (i / 20) * 2.3; pts.push(V(Math.sin(a) * H.rx * 1.08, H.c.y + 0.055 * s, H.c.z + Math.cos(a) * H.rz * 1.06)); } B.add(sweep(pts, [0.0045 * s, 0.0045 * s], 5, 40), metal, M.gold, 'head'); const st = ext(starShape(0.016 * s, 0.006 * s, 4), 0.004 * s, 0.001 * s); T(st, V(0, H.c.y + 0.065 * s, H.c.z + H.rz * 1.08)); B.add(st, metal, M.gold, 'head'); const g = ell(0.006 * s, 0.006 * s, 0.004 * s, 8, 6); T(g, V(0, H.c.y + 0.065 * s, H.c.z + H.rz * 1.1)); B.glow(g, glow, 3.2, 'head'); }
  // Heiligenschein (Stufe 9)
  { const g = tor(0.13 * s, 0.004 * s, 5, 48); T(g, H.c.clone().add(V(0, 0.06 * s, -0.12 * s))); B.glow(g, glow, 2.6, 'head', { tier: 9 }); }

  // Laternenstab (rechte Hand)
  const fr = weaponJoint(B, 'weaponR', 'R');
  const st = staffParts({ len: 1.55 * s, below: 0.6 * s, wood: '#8a6440', metal, r: 0.018 * s, bands: [-0.25 * s, 0.12 * s, 0.6 * s] });
  const list = st.list, top = st.top.clone();
  // Krummstab-Bogen
  const hook = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * PI * 1.15; hook.push(V(0.11 * s - Math.cos(a) * 0.11 * s, top.y + Math.sin(a) * 0.13 * s, 0)); }
  list.push([tube(hook, (t) => 0.013 * s * (1 - 0.35 * t), { sides: 8, segs: 28 }), metal, M.gold]);
  const hookEnd = hook[hook.length - 1];
  // Laterne hängt am Bogenende
  const lc = V(hookEnd.x, hookEnd.y - 0.12 * s, 0);
  list.push([tube([hookEnd, lc.clone().add(V(0, 0.07 * s, 0))], () => 0.0025 * s, { sides: 4, segs: 2 }), metal, M.gold]);
  list.push([lathe([[0, 0.075], [0.03, 0.07], [0.045, 0.055], [0.04, 0.045], [0, 0.045]].map(([r, y]) => [r * s, y * s]), 12).translate(lc.x, lc.y, 0), metal, M.gold]);
  list.push([lathe([[0, -0.06], [0.04, -0.055], [0.045, -0.045], [0.03, -0.04], [0, -0.04]].map(([r, y]) => [r * s, y * s]), 12).translate(lc.x, lc.y, 0), metal, M.gold]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; list.push([tube([V(lc.x + Math.cos(a) * 0.04 * s, lc.y - 0.045 * s, Math.sin(a) * 0.04 * s), V(lc.x + Math.cos(a) * 0.046 * s, lc.y, Math.sin(a) * 0.046 * s), V(lc.x + Math.cos(a) * 0.04 * s, lc.y + 0.05 * s, Math.sin(a) * 0.04 * s)], () => 0.0035 * s, { sides: 4, segs: 6 }), metal, M.gold]); }
  list.push([ell(0.036 * s, 0.045 * s, 0.036 * s, 12, 10).translate(lc.x, lc.y, 0), mix(glow, '#fff2c8', 0.3), null, 'glass']);
  list.push([ell(0.02 * s, 0.03 * s, 0.02 * s, 10, 8).translate(lc.x, lc.y, 0), glow, null, 'glow', 4]);
  emit(B, list, { origin: fr.origin, y: fr.y, x: fr.x }, 'weaponR');
  // Laternen-Licht-Position (für ein optionales PointLight im Spiel)
  const g0 = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([lc.x, lc.y, lc.z], 3));
  place(g0, fr.origin, fr.y, fr.x);
  const lp = V(g0.attributes.position.getX(0), g0.attributes.position.getY(0), g0.attributes.position.getZ(0));
  B.joint('lantern', 'weaponR', lp);
  return { radius: 0.42 * s, light: { joint: 'lantern', color: glow, intensity: 0.9, distance: 4 } };
}
function mirrorV(v) { return V(-v.x, v.y, v.z); }
