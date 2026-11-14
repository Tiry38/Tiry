// Aether-Forge – Einheiten (Gegner/Vasallen) als SDF-Skulpturen. Bewusst eine Stufe schlichter als die Helden
// (matter, weniger Glühen, Standardwaffen), aber mit echter Anatomie, Faltenwurf und gebackener Verdeckung.
// Jede Einheit hat ein kleines (gestelltes) Skelett; die Skin-Gewichte werden auf die Vertex-Animation der
// Instanzen abgebildet (Attribut aRig, siehe hero/unitRig.js): Bein/Arm/Kopf/Rumpf/Schwanz/Flügel/Spinnenbein.
import { DEFAULTS } from '../../models.js';
import { skinVertices, makeSegments } from '../skin.js';
import {
  torsoShape, neckShape, deltoidShape, upperArmShape, foreArmShape, thighShape, shinShape, footShape, handShape, head, headInfo, pauldron, bracer, belt,
  skirt, cape, Detail, add, sub, scl, norm, lerp3, PI, TAU, clamp, smooth, frame, handFrame,
} from './lib.js';
import { longsword, towerShield, bladePrim, staff, longbow } from './weapons.js';
import { crystalPrim } from './selene.js';

const { abs, max, min, sin, cos, atan2, hypot, sqrt } = Math;
const V = (x, y, z) => ({ x, y, z });

// ---------------------------------------------------------------------------------------------
// Gestelltes Humanoid-Skelett (Maßstab s ≈ Höhe/1.9). pose: { armR: [ellbogen, hand], armL, stance }
// ---------------------------------------------------------------------------------------------
function humanoid(s, pose = {}) {
  const J = {};
  const set = (n, p, parent) => { J[n] = { pos: V(p[0], p[1], p[2]), parent }; };
  const hipsY = 0.985 * s;
  set('hips', [0, hipsY, 0], null);
  set('spine', [0, hipsY + 0.1 * s, -0.005 * s], 'hips');
  set('chest', [0, hipsY + 0.29 * s, -0.012 * s], 'spine');
  set('neck', [0, hipsY + 0.52 * s, -0.02 * s], 'chest');
  set('head', [0, hipsY + 0.605 * s, -0.004 * s], 'neck');
  const shY = hipsY + 0.455 * s, sw = pose.sw ?? 1;
  for (const [side, k] of [['L', 1], ['R', -1]]) {
    const arm = pose['arm' + side] || [[0.235, shY / s - 0.29, 0.02], [0.26, shY / s - 0.53, 0.05]];
    set('shoulder' + side, [k * 0.05 * s * sw, shY + 0.01 * s, -0.02 * s], 'chest');
    set('upperArm' + side, [k * 0.195 * s * sw, shY, -0.03 * s], 'shoulder' + side);
    set('foreArm' + side, [k * arm[0][0] * s * sw, arm[0][1] * s, arm[0][2] * s], 'upperArm' + side);
    set('hand' + side, [k * arm[1][0] * s * sw, arm[1][1] * s, arm[1][2] * s], 'foreArm' + side);
    const st = (pose.stance ?? 0.03) * (side === 'L' ? 1 : -1);
    set('thigh' + side, [k * 0.095 * s, 0.935 * s, 0], 'hips');
    set('shin' + side, [k * 0.103 * s, 0.51 * s, (0.01 + st) * s], 'thigh' + side);
    set('foot' + side, [k * 0.108 * s, 0.085 * s, (-0.02 + st * 1.6) * s], 'shin' + side);
  }
  return J;
}
/** Fake-Builder für die Helden-Bibliothek; mirrorR: rechte Gelenke gespiegelt in die L-Plätze */
function fakeB(J, s, mirrorR = false) {
  const out = {};
  for (const [n, j] of Object.entries(J)) out[n] = { pos: { ...j.pos }, parent: j.parent };
  if (mirrorR) for (const n of Object.keys(J)) if (/R\d*$/.test(n)) { const l = n.replace(/R(\d*)$/, 'L$1'); const p = J[n].pos; out[l] = { pos: V(-p.x, p.y, p.z), parent: J[n].parent }; }
  return { J: out, skel: { s } };
}
function skeletonOf(J) {
  const names = Object.keys(J);
  return { names, parents: names.map((n) => (J[n].parent ? names.indexOf(J[n].parent) : -1)), rest: names.map((n) => [J[n].pos.x, J[n].pos.y, J[n].pos.z]) };
}
const jp = (J, n) => [J[n].pos.x, J[n].pos.y, J[n].pos.z];

/** Körper eines Humanoiden (beide Seiten gestellt) */
function humanBody(S, J, s, o = {}) {
  const BL = fakeB(J, s), BR = fakeB(J, s, true);
  const A = (part) => ({ ...(o.base || {}), ...(o[part] || {}) });
  S.group({ k: 0 }, () => {
    torsoShape(S, BL, { bulk: o.bulk ?? 1, female: o.female, o: { region: 'torso', ...A('torso') } });
    for (const [B0, mir] of [[BL, false], [BR, true]]) {
      const f = () => {
        deltoidShape(S, B0, { bulk: o.armBulk ?? 1, o: { region: 'shoulderL', ...A('arms') } });
        upperArmShape(S, B0, { bulk: o.armBulk ?? 1, o: { region: 'armL', ...A('arms') } });
        foreArmShape(S, B0, { bulk: o.armBulk ?? 1, o: { region: 'armL', ...A('arms') } });
        if (o.legs !== false) {
          thighShape(S, B0, { bulk: o.legBulk ?? 1, o: { region: 'legL', ...A('legs') } });
          shinShape(S, B0, { bulk: o.legBulk ?? 1, o: { region: 'legL', ...A('legs') } });
        }
      };
      if (mir) S.mirrored(f); else f();
    }
    if (o.neck !== false) neckShape(S, BL, { r: 0.06, o: { region: 'neck', ...A('torso') } });
  });
  return { BL, BR };
}
function bothSides(S, BL, BR, fn) { fn(BL, false); S.mirrored(() => fn(BR, true)); }

// ---------------------------------------------------------------------------------------------
// Vertex-Animation: Knochen → aRig-Klasse
// ---------------------------------------------------------------------------------------------
function makeUnitRig(def) {
  const skel = def.skeleton, segs = makeSegments(skel, 1);
  const J = Object.fromEntries(skel.names.map((n, i) => [n, skel.rest[i]]));
  const H = def.H, hipY = def.hipY ?? (J.hips ? J.hips[1] : 0.46 * H), shY = J.upperArmL ? J.upperArmL[1] : 0.76 * H, neckY = J.neck ? J.neck[1] : 0.84 * H;
  const cls = (n) => {
    if (def.cls && def.cls[n]) return def.cls[n];
    if (/^(thigh|shin|foot)L/.test(n)) return [1, 0, hipY, J.thighL ? J.thighL[2] : 0];
    if (/^(thigh|shin|foot)R/.test(n)) return [1, PI, hipY, J.thighR ? J.thighR[2] : 0];
    if (/^(shoulder|upperArm|foreArm|hand|weapon)L/.test(n)) return [2, PI, shY, 0];
    if (/^(shoulder|upperArm|foreArm|hand|weapon)R/.test(n)) return [8, 0, shY, 0];
    if (n === 'neck' || n === 'head') return [3, 0, neckY, 0];
    return [6, 0, hipY, 0];
  };
  const C = skel.names.map(cls);
  return (pos, owners, owners2, w2s, adj) => {
    const sk = skinVertices(pos, owners, owners2, w2s, skel, adj, { segs, smoothIters: 4 });
    const n = pos.length / 3, out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // Gewicht je Klasse sammeln (Rumpf getrennt)
      const acc = new Map();
      for (let c = 0; c < 4; c++) {
        const w = sk.weight[i * 4 + c]; if (w <= 0) continue;
        const cc = C[sk.index[i * 4 + c]];
        const key = cc.join(',');
        const e = acc.get(key) || { cc, w: 0 }; e.w += w; acc.set(key, e);
      }
      let best = null;
      for (const e of acc.values()) if (e.cc[0] !== 6 && (!best || e.w > best.w)) best = e;
      const y = pos[i * 3 + 1];
      let r;
      if (best && best.w > 0.12) r = [best.cc[0], Math.min(1, best.w * (def.limbGain ?? 1.15)), best.cc[1], best.cc[2], best.cc[3]];
      else r = [6, smooth(hipY, hipY + 0.12 * H, y) * (def.torsoW ?? 1), 0, hipY, 0];
      if (r[0] === 5) r[1] = Math.min(1, r[1]);
      out[i * 4] = r[0] + 0.9 * Math.max(0, Math.min(1, r[1]));
      out[i * 4 + 1] = r[2]; out[i * 4 + 2] = r[3]; out[i * 4 + 3] = r[4];
    }
    return out;
  };
}

// ---------------------------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------------------------
const steelA = (col = 'metal') => ({ mat: 'steel', col, wear: 0.7 });
function plateTorso(S, BL, o = {}) {
  const j = (n) => [BL.J[n].pos.x, BL.J[n].pos.y, BL.J[n].pos.z], s = BL.skel.s;
  const hips = j('hips'), neck = j('neck'), ua = j('upperArmL');
  const clip = (x, y, z) => max(max(hips[1] + 0.05 * s - y, y - neck[1] + 0.01 * s), -(hypot(abs(x) - ua[0], (y - ua[1] + 0.03 * s) * 0.85) - 0.08 * s));
  S.shell({ off: 0.015 * s, th: 0.016 * s, mat: o.mat || 'steel', col: o.col || 'metal', region: 'torso', clip, wear: 0.7 }, () => torsoShape(S, BL, { bulk: o.bulk ?? 1.02 }));
  if (o.trim) S.shell({ off: 0.026 * s, th: 0.007 * s, mat: 'gold', col: o.trim, region: 'torso', clip: (x, y, z) => max(clip(x, y, z), y - hips[1] - 0.08 * s) }, () => torsoShape(S, BL, { bulk: o.bulk ?? 1.02 }));
}
function helmet(S, BL, o = {}) {
  const H = headInfo(BL), s = H.s;
  S.group({ k: 0 }, () => {
    S.ellipsoid(H.at(0, 0.015, 0), [0.108 * s, 0.125 * s, 0.118 * s], { ...steelA(o.col), region: 'head' });
    S.capsule(H.at(0, -0.04, 0.0), H.at(0, -0.1, 0.0), 0.1 * s, 0.09 * s, { ...steelA(o.col), region: 'head', k: 0.03 * s });
    if (o.visor !== false) S.box(H.at(0, 0.0, 0.11), [0.075 * s, 0.009 * s, 0.03 * s], { op: 'sub', k: 0.003 * s, mat: 'iron', col: '#101014', paint: true, rot: [0, 0, 0] });
    if (o.crest) S.torus(H.at(0, 0, -0.005), 0.122 * s, 0.012 * s, { rot: { x: [0, 0, 1], y: [1, 0, 0], z: [0, 1, 0] }, arc: 2.4, mat: 'cloth', col: o.crest, region: 'head' });
  });
}
function simpleHand(S, B0, col = '#3a2a20', mat = 'leather') {
  const F = handFrame(B0, 'L'), s = B0.skel.s;
  S.ellipsoid(F.at(0.06, 0, 0.01), [0.05 * s, 0.065 * s, 0.045 * s], { mat, col, region: ['foreArmL', 'handL'], rot: { x: F.f, y: F.d, z: F.i }, k: 0.01 * s });
}
function simpleBoot(S, B0, col = '#2a1c14') { footShape(S, B0, { w: 1.12, o: { mat: 'leather', col, region: 'legL' } }); }

// ---------------------------------------------------------------------------------------------
// Archetypen
// ---------------------------------------------------------------------------------------------
const U = {};

U.knight = { H: 2.07, budgets: [5200, 1600], build(S, P) {
  const s = 1.06;
  const J = humanoid(s, { armR: [[0.3, 1.18, 0.12], [0.33, 1.06, 0.3]], armL: [[0.31, 1.2, 0.1], [0.33, 1.12, 0.28]] });
  J.weaponR = { pos: V(-0.33 * s, 1.06 * s, 0.32 * s), parent: 'handR' };
  J.weaponL = { pos: V(0.4 * s, 1.12 * s, 0.32 * s), parent: 'foreArmL' };
  const { BL, BR } = humanBody(S, J, s, { base: { mat: 'mail', col: '#5a606a' }, torso: { mat: 'cloth', col: 'primary*0.6' } });
  plateTorso(S, BL, { col: 'metal', trim: 'secondary' });
  bothSides(S, BL, BR, (B0) => {
    pauldron(S, B0, { r: 0.12, layers: 2, col: 'metal', trim: 'secondary', tilt: 0.5, th: 0.016 });
    simpleBoot(S, B0, '#4a4e58'); simpleHand(S, B0, '#6a707a', 'steel');
    bracer(S, add(jp(B0.J, 'foreArmL'), [0, -0.03, 0]), add(jp(B0.J, 'handL'), [0, 0.02, 0]), 0.05, 0.044, { s, col: 'metal', region: 'armL', th: 0.016, rim: false });
  });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.56 * s, r0: 0.19, r1: 0.24, col: 'primary', mat: 'cloth', folds: 8, fold: 0.008, th: 0.016, panels: [[0, 0.6], [PI, 0.6]] });
  belt(S, BL, { dy: 0.04, col: '#3b2618' });
  helmet(S, BL, { col: 'metal', crest: 'primary' });
  cape(S, BL, { top: 1.5 * s, bottom: 0.45 * s, r0: 0.18, r1: 0.36, arc: 1.0, col: 'primary', folds: 6, fold: 0.014, th: 0.016, chain: ['chest', 'spine', 'hips', 'hips'] });
  // Schwert + Rundschild
  const fr = frame(jp(J, 'weaponR'), [0.1, 0.25, 0.96], [0, 1, -0.2]);
  S.prim(fr.o, bladePrim({ y0: 0.06, L: 0.82, w: 0.07, th: 0.018 }), { rot: fr.basis, mat: 'steel', col: '#b8c0c8', bone: 'weaponR' });
  S.capsule(fr.at(-0.1, 0.04), fr.at(0.1, 0.04), 0.014, { mat: 'steel', col: 'secondary', bone: 'weaponR' });
  S.capsule(fr.at(0, 0.03), fr.at(0, -0.15), 0.017, { mat: 'leather', col: '#2a1a12', bone: 'weaponR' });
  const sf = frame(jp(J, 'weaponL'), [0, 1, 0], [1, 0, -0.35]);
  S.cylinder(sf.o, 0.27, 0.014, { rot: sf.rot(PI / 2, 0, 0), mat: 'paint', col: 'primary', bone: 'weaponL', r: 0.008 });
  S.torus(sf.o, 0.27, 0.018, { rot: sf.rot(PI / 2, 0, 0), ...steelA('metal'), bone: 'weaponL' });
  S.sphere(sf.at(0, 0, 0.02), 0.06, { ...steelA('secondary'), bone: 'weaponL', k: 0.01 });
  return { skeleton: skeletonOf(J), radius: 0.6 };
} };

U.paladin_heavy = { H: 2.93, budgets: [6500, 2000], build(S, P) {
  const s = 1.45;
  const J = humanoid(s, { sw: 1.15, armR: [[0.3, 0.83, 0.05], [0.31, 0.78, 0.18]], armL: [[0.3, 0.84, 0.08], [0.31, 0.76, 0.24]] });
  J.weaponR = { pos: V(-0.31 * s, 0.78 * s, 0.2 * s), parent: 'handR' };
  J.weaponL = { pos: V(0.42 * s, 0.78 * s, 0.26 * s), parent: 'foreArmL' };
  const { BL, BR } = humanBody(S, J, s, { bulk: 1.15, armBulk: 1.2, legBulk: 1.15, base: { mat: 'mail', col: '#5a606a' }, torso: { mat: 'cloth', col: 'secondary' } });
  plateTorso(S, BL, { col: 'primary', trim: 'metal', bulk: 1.15 });
  bothSides(S, BL, BR, (B0) => {
    pauldron(S, B0, { r: 0.15, layers: 3, col: 'primary', trim: 'metal', tilt: 0.5, th: 0.018 });
    simpleBoot(S, B0, '#c8c0b0'); simpleHand(S, B0, '#b0a898', 'steel');
    bracer(S, add(jp(B0.J, 'foreArmL'), [0, -0.03 * s, 0]), add(jp(B0.J, 'handL'), [0, 0.02 * s, 0]), 0.06 * s, 0.05 * s, { s, col: 'primary', region: 'armL', th: 0.016, rim: false });
  });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.5 * s, r0: 0.21, r1: 0.27, col: 'secondary', mat: 'cloth', folds: 8, fold: 0.01, th: 0.018 });
  helmet(S, BL, { col: 'primary' });
  cape(S, BL, { top: 1.5 * s, bottom: 0.35 * s, r0: 0.2, r1: 0.42, arc: 1.2, col: 'secondary', folds: 7, fold: 0.016, th: 0.02, hem: 'metal', chain: ['chest', 'spine', 'hips', 'hips'] });
  // Turmschild + Hammer (schlicht)
  towerShield(S, frame(jp(J, 'weaponL'), [0, 1, 0.1], [1, 0, -0.3]), { s: 1.2, bone: 'weaponL', face: 'primary', rim: 'metal', gold: 'metal', faceMat: 'paint' });
  const hf = frame(jp(J, 'weaponR'), [-0.15, 1, -0.5], [1, 0, 0]);
  S.capsule(hf.at(0, -0.2), hf.at(0, 0.95), 0.035, { mat: 'leather', col: '#3a2418', bone: 'weaponR' });
  S.box(hf.at(0, 1.0), [0.2, 0.11, 0.11], { rot: hf.basis, ...steelA('metal'), bone: 'weaponR', r: 0.03 });
  return { skeleton: skeletonOf(J), radius: 0.8 };
} };

U.archer = { H: 2.19, budgets: [5000, 1500], build(S, P) {
  const s = 1.04;
  const J = humanoid(s, { armL: [[0.3, 1.38, 0.24], [0.22, 1.38, 0.48]], armR: [[0.36, 1.4, -0.12], [0.06, 1.46, 0.06]] });
  J.weaponL = { pos: V(0.22 * s, 1.38 * s, 0.5 * s), parent: 'handL' };
  const { BL, BR } = humanBody(S, J, s, { base: { mat: 'cloth', col: 'secondary*0.5' }, torso: { mat: 'leather', col: '#6a4a2c' } });
  bothSides(S, BL, BR, (B0) => { simpleBoot(S, B0); simpleHand(S, B0, '#3a2818'); bracer(S, add(jp(B0.J, 'foreArmL'), [0, 0, 0]), jp(B0.J, 'handL'), 0.046, 0.04, { s, mat: 'leather', col: '#4a3020', region: 'armL', th: 0.015, rim: false }); });
  skirt(S, BL, { top: 1.05 * s, bottom: 0.7 * s, r0: 0.18, r1: 0.23, col: 'primary', folds: 6, fold: 0.008, th: 0.016, slits: [0, PI] });
  belt(S, BL, { dy: 0.03, col: '#3b2618' });
  cape(S, BL, { top: 1.52 * s, bottom: 0.55 * s, r0: 0.18, r1: 0.34, arc: 1.3, col: 'primary', folds: 6, fold: 0.014, th: 0.016, chain: ['chest', 'spine', 'hips', 'hips'] });
  // Kapuze (geschlossen, Gesicht im Schatten)
  const H = headInfo(BL);
  S.shell({ off: 0.012, th: 0.016, mat: 'cloth', col: 'primary', region: 'head', clip: (x, y, z) => -max(max(abs(x) - 0.06, y - H.c[1] - 0.05), -(z - H.c[2] - 0.04)) }, () => {
    S.ellipsoid(H.at(0, 0.02, -0.02), [0.1, 0.12, 0.11], {});
    S.capsule(H.at(0, 0.08, -0.05), H.at(0, 0.0, -0.17), 0.05, 0.01, { k: 0.05 });
  });
  S.ellipsoid(H.at(0, -0.02, 0.0), [0.085, 0.1, 0.09], { mat: 'cloth', col: '#0c0a08', region: 'head' });
  S.sphere(add(jp(J, 'chest'), [0.0, 0.08, -0.18]), 0.06, { mat: 'leather', col: '#4a3020', bone: 'chest' });
  const fr = frame(jp(J, 'weaponL'), [0, 1, 0], [1, 0, 0]);
  longbow(S, fr, { s: 1.0, bone: 'weaponL', wood: '#5a3a20', trim: 'metal', h: 0.62 });
  return { skeleton: skeletonOf(J), radius: 0.55 };
} };

U.priest = { H: 2.27, budgets: [4800, 1500], build(S, P) {
  const s = 1.05;
  const J = humanoid(s, { armR: [[0.3, 1.22, 0.1], [0.3, 1.12, 0.26]], armL: [[0.3, 1.2, 0.12], [0.18, 1.18, 0.3]] });
  J.weaponR = { pos: V(-0.3 * s, 1.12 * s, 0.28 * s), parent: 'handR' };
  const { BL, BR } = humanBody(S, J, s, { female: true, base: { mat: 'cloth', col: 'primary' } });
  bothSides(S, BL, BR, (B0) => { simpleHand(S, B0, '#e0b090', 'skin'); });
  skirt(S, BL, { top: 1.1 * s, bottom: 0.02, r0: 0.17, r1: 0.36, col: 'primary', mat: 'cloth', folds: 11, fold: 0.016, th: 0.016, hem: 'metal', hemW: 0.03 });
  skirt(S, BL, { top: 1.1 * s, bottom: 0.12, r0: 0.18, r1: 0.37, col: 'secondary', mat: 'cloth', folds: 4, fold: 0.006, th: 0.016, panels: [[0, 0.3]] });
  belt(S, BL, { dy: 0.1, col: 'metal', mat: 'gold' });
  const H = headInfo(BL);
  S.shell({ off: 0.012, th: 0.016, mat: 'cloth', col: 'primary', region: 'head', clip: (x, y, z) => -max(max(abs(x) - 0.065, y - H.c[1] - 0.06), -(z - H.c[2] - 0.03)) }, () => {
    S.ellipsoid(H.at(0, 0.02, -0.02), [0.1, 0.12, 0.11], {});
    S.ellipsoid([0, jp(J, 'neck')[1] - 0.04, -0.01], [0.24, 0.12, 0.19], { k: 0.06 });
  });
  head(S, BL, { female: true, skin: '#e0b090', brow: false, eye: '#4a6a8a' });
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0], [1, 0, 0]);
  const st = staff(S, fr, { s: 1.0, len: 1.55, below: 0.62, wood: '#8a6440', metal: 'metal', r: 0.02, bone: 'weaponR' });
  S.torus(fr.at(0, st.topY + 0.07), 0.07, 0.01, { rot: fr.rot(PI / 2, 0, 0), mat: 'gold', col: 'metal', bone: 'weaponR' });
  S.layer('glow'); S.sphere(fr.at(0, st.topY + 0.07), 0.035, { mat: 'glow', col: 'glow', glow: 2.4, bone: 'weaponR' }); S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.55 };
} };

U.knightfallen = { H: 2.38, budgets: [5600, 1700], build(S, P) {
  const s = 1.2;
  const J = humanoid(s, { sw: 1.08, armR: [[0.3, 1.18, 0.14], [0.32, 1.06, 0.32]], armL: [[0.32, 1.18, 0.0], [0.34, 0.98, 0.06]] });
  J.weaponR = { pos: V(-0.32 * s, 1.06 * s, 0.34 * s), parent: 'handR' };
  const { BL, BR } = humanBody(S, J, s, { bulk: 1.05, base: { mat: 'iron', col: '#2a2a30' }, torso: { mat: 'cloth', col: 'primary*0.5' } });
  plateTorso(S, BL, { col: 'metal', mat: 'iron', bulk: 1.05 });
  bothSides(S, BL, BR, (B0) => {
    const pd = pauldron(S, B0, { r: 0.13, layers: 2, col: 'metal', mat: 'iron', tilt: 0.5, th: 0.018 });
    for (let k = 0; k < 2; k++) { const b0 = add(pd.c, [0.06 + 0.04 * k, 0.11, -0.03 + 0.05 * k]); S.capsule(b0, add(b0, [0.04, 0.1, 0]), 0.022, 0.002, { mat: 'iron', col: '#3a3a40', bind: pd.bind, k: 0.01 }); }
    simpleBoot(S, B0, '#1a1a1e'); simpleHand(S, B0, '#2a2a30', 'iron');
  });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.5 * s, r0: 0.19, r1: 0.26, col: 'primary', folds: 9, fold: 0.012, th: 0.016, slits: [0.4, -0.4, 1.6, -1.6, PI], slitFrom: 0.2 });
  helmet(S, BL, { col: 'metal' });
  const H = headInfo(BL);
  for (const sx of [1, -1]) S.capsule(H.at(sx * 0.08, 0.06, 0), H.at(sx * 0.2, 0.2, -0.05), 0.025, 0.004, { mat: 'horn', col: '#2a2420', region: 'head', k: 0.01 });
  S.layer('glow'); S.box(H.at(0, 0.0, 0.108), [0.065, 0.006, 0.01], { mat: 'glow', col: 'glow', glow: 3, region: 'head' }); S.layer('body');
  cape(S, BL, { top: 1.5 * s, bottom: 0.38 * s, r0: 0.19, r1: 0.4, arc: 1.2, col: 'primary', folds: 8, fold: 0.02, th: 0.016, hemWave: 0.06, chain: ['chest', 'spine', 'hips', 'hips'] });
  const fr = frame(jp(J, 'weaponR'), [0.1, 0.3, 0.95], [0, 1, -0.3]);
  S.prim(fr.o, bladePrim({ y0: 0.07, L: 1.05, w: 0.1, th: 0.022, leaf: 0.2 }), { rot: fr.basis, mat: 'iron', col: '#3a3a44', bone: 'weaponR' });
  S.capsule(fr.at(-0.13, 0.05), fr.at(0.13, 0.05), 0.018, { mat: 'iron', col: '#2a2a30', bone: 'weaponR' });
  S.layer('glow'); S.capsule(fr.at(0, 0.15, 0.011), fr.at(0, 0.9, 0.011), 0.005, { mat: 'glow', col: 'glow', glow: 2.6, bone: 'weaponR' }); S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.67 };
} };

U.automaton = { H: 2.15, budgets: [5000, 1500], build(S, P) {
  const s = 1.08;
  const J = humanoid(s, { sw: 1.1, armR: [[0.32, 1.12, 0.1], [0.34, 0.95, 0.3]], armL: [[0.32, 1.12, 0.08], [0.34, 0.95, 0.26]], stance: 0.05 });
  const A = { mat: 'paint', col: 'primary', wear: 1 }, M = { mat: 'brass', col: 'secondary', wear: 1 };
  S.with({}, () => {
    // kantiger Rumpf mit Kessel
    S.box(add(jp(J, 'chest'), [0, 0.05, 0]), [0.24, 0.22, 0.17], { ...A, region: 'torso', r: 0.05 });
    S.cylinder(add(jp(J, 'chest'), [0, 0.05, 0.15]), 0.11, 0.04, { rot: [PI / 2, 0, 0], ...M, region: 'torso', r: 0.01, k: 0.01 });
    S.box(jp(J, 'hips'), [0.17, 0.09, 0.12], { ...A, region: 'torso', r: 0.03 });
    S.capsule(jp(J, 'hips'), jp(J, 'chest'), 0.07, { mat: 'iron', col: '#3a3a3e', region: 'torso' });
    S.box(add(jp(J, 'head'), [0, 0.1, 0.01]), [0.09, 0.085, 0.095], { ...A, region: 'head', r: 0.03 });
    S.box(add(jp(J, 'head'), [0, 0.11, 0.1]), [0.07, 0.012, 0.02], { op: 'sub', mat: 'iron', col: '#101010', paint: true });
    for (const side of ['L', 'R']) {
      const sh = jp(J, 'upperArm' + side), el = jp(J, 'foreArm' + side), ha = jp(J, 'hand' + side), sg = side === 'L' ? 1 : -1;
      const reg = 'arm' + side;
      S.sphere(sh, 0.09, { ...M, region: 'shoulder' + side });
      S.capsule(sh, el, 0.045, { mat: 'iron', col: '#4a4a50', region: reg });
      S.sphere(el, 0.055, { ...M, region: reg });
      S.box(lerp3(el, ha, 0.5), [0.06, hypot(...sub(ha, el)) / 2, 0.06], { rot: rotTo(sub(ha, el)), ...A, region: reg, r: 0.02 });
      S.box(add(ha, scl(norm(sub(ha, el)), 0.06)), [0.05, 0.06, 0.04], { rot: rotTo(sub(ha, el)), mat: 'iron', col: '#3a3a40', region: reg, r: 0.015 });
      const th = jp(J, 'thigh' + side), kn = jp(J, 'shin' + side), an = jp(J, 'foot' + side);
      S.capsule(th, kn, 0.05, { mat: 'iron', col: '#4a4a50', region: 'leg' + side });
      S.sphere(kn, 0.06, { ...M, region: 'leg' + side });
      S.box(lerp3(kn, an, 0.5), [0.07, hypot(...sub(an, kn)) / 2, 0.07], { rot: rotTo(sub(an, kn)), ...A, region: 'leg' + side, r: 0.02 });
      S.box([an[0], 0.04, an[2] + 0.05], [0.07, 0.04, 0.12], { ...A, region: 'leg' + side, r: 0.02 });
      void sg;
    }
    // Rohre / Kamine
    for (const sx of [1, -1]) S.capsule(add(jp(J, 'chest'), [sx * 0.12, 0.15, -0.15]), add(jp(J, 'chest'), [sx * 0.12, 0.45, -0.2]), 0.035, { ...M, region: 'torso' });
  });
  S.layer('glow');
  S.cylinder(add(jp(J, 'chest'), [0, 0.05, 0.19]), 0.07, 0.006, { rot: [PI / 2, 0, 0], mat: 'glow', col: 'glow', glow: 2.6, region: 'torso' });
  S.box(add(jp(J, 'head'), [0, 0.11, 0.098]), [0.06, 0.007, 0.006], { mat: 'glow', col: 'glow', glow: 3, region: 'head' });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.62 };
} };

function rotTo(d) { const y = norm(d); let x = norm(sub([1, 0, 0], scl(y, y[0]))); if (!isFinite(x[0])) x = [0, 0, 1]; const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]; return { x, y, z }; }

U.brute = { H: 2.43, budgets: [5200, 1600], build(S, P) {
  const s = 1.2;
  const J = humanoid(s, { sw: 1.3, armR: [[0.36, 1.05, 0.12], [0.38, 0.8, 0.28]], armL: [[0.38, 1.05, 0.06], [0.4, 0.82, 0.16]], stance: 0.06 });
  J.weaponR = { pos: V(-0.38 * s, 0.8 * s, 0.3 * s), parent: 'handR' };
  // gebückt: Kopf nach vorn
  J.head.pos.z += 0.08 * s; J.neck.pos.z += 0.05 * s;
  const skin = { mat: 'skin', col: 'primary', disp: Detail.muscle({ amp: 0.004, freq: 22 }) };
  const { BL, BR } = humanBody(S, J, s, { bulk: 1.65, armBulk: 2.0, legBulk: 1.6, base: skin, legs: { mat: 'leather', col: '#4a3a28' } });
  bothSides(S, BL, BR, (B0) => { simpleBoot(S, B0, '#3a2a1e'); simpleHand(S, B0, 'primary*0.9', 'skin'); bracer(S, add(jp(B0.J, 'foreArmL'), [0, -0.03, 0]), jp(B0.J, 'handL'), 0.07, 0.06, { s, mat: 'leather', col: '#3a2a1a', region: 'armL', th: 0.016, rim: false }); });
  skirt(S, BL, { top: 1.0 * s, bottom: 0.62 * s, r0: 0.22, r1: 0.28, col: 'secondary', mat: 'leather', folds: 6, fold: 0.01, th: 0.018, slits: [0, 1.4, -1.4, PI] });
  belt(S, BL, { dy: 0.02, rx: 0.23, rz: 0.17, col: '#2a1a12', buckle: 'metal', buckleMat: 'iron' });
  S.ellipsoid(add(jp(J, 'spine'), [0, 0.05, 0.12]), [0.3, 0.26, 0.24], { ...skin, region: 'torso', k: 0.08 });
  const H = head(S, BL, { skin: P.primary, eye: '#e0a020', brow: '#2a2a1a', lips: '#5a4a3a', jaw: 1.3 });
  for (const sx of [1, -1]) S.capsule(H.at(sx * 0.03, -0.07, 0.09), H.at(sx * 0.045, -0.02, 0.12), 0.012, 0.003, { mat: 'bone', col: '#e8dcc0', region: 'head' }); // Hauer
  // Keule
  const fr = frame(jp(J, 'weaponR'), [-0.1, -0.2, 1], [0, 1, 0]);
  S.capsule(fr.at(0, -0.1), fr.at(0, 0.6), 0.035, 0.08, { mat: 'wood', col: '#5a4028', bone: 'weaponR', disp: Detail.noise({ amp: 0.008, freq: 14 }) });
  for (let i = 0; i < 5; i++) { const a = i * 1.3; S.capsule(fr.at(cos(a) * 0.07, 0.45 + i * 0.03, sin(a) * 0.07), fr.at(cos(a) * 0.13, 0.47 + i * 0.03, sin(a) * 0.13), 0.014, 0.002, { mat: 'iron', col: '#5a5a60', bone: 'weaponR' }); }
  return { skeleton: skeletonOf(J), radius: 0.92 };
} };

U.golem = { H: 2.19, budgets: [4200, 1400], build(S, P) {
  const s = 1.05;
  const J = humanoid(s, { sw: 1.4, armR: [[0.42, 1.0, 0.06], [0.44, 0.7, 0.12]], armL: [[0.42, 1.0, 0.06], [0.44, 0.7, 0.12]], stance: 0.08 });
  const stone = { mat: 'stone', col: 'primary', disp: Detail.noise({ amp: 0.012, freq: 9, ridged: true }) };
  S.group({ k: 0.02 }, () => {
    S.ellipsoid(add(jp(J, 'chest'), [0, 0.05, 0]), [0.42, 0.34, 0.3], { ...stone, region: 'torso' });
    S.ellipsoid(jp(J, 'hips'), [0.22, 0.14, 0.16], { ...stone, region: 'torso' });
    S.ellipsoid(add(jp(J, 'head'), [0, 0.06, 0.06]), [0.12, 0.1, 0.12], { ...stone, region: 'head' });
    for (const side of ['L', 'R']) {
      const sh = jp(J, 'upperArm' + side), el = jp(J, 'foreArm' + side), ha = jp(J, 'hand' + side);
      S.ellipsoid(add(sh, [side === 'L' ? 0.08 : -0.08, 0.08, 0]), [0.22, 0.19, 0.2], { ...stone, region: 'shoulder' + side });
      S.capsule(sh, el, 0.1, 0.09, { ...stone, region: 'arm' + side });
      S.capsule(el, ha, 0.11, 0.14, { ...stone, region: 'arm' + side });
      S.capsule(jp(J, 'thigh' + side), jp(J, 'shin' + side), 0.12, 0.1, { ...stone, region: 'leg' + side });
      S.capsule(jp(J, 'shin' + side), add(jp(J, 'foot' + side), [0, -0.02, 0.04]), 0.1, 0.12, { ...stone, region: 'leg' + side });
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  S.layer('glass');
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI - PI / 2; S.prim(add(jp(J, 'chest'), [sin(a) * 0.3, 0.28 + 0.05 * cos(a * 3), -0.18]), crystalPrim(0.05, 0.22 + 0.08 * (i % 2)), { rot: [-0.5, 0, -a * 0.8], mat: 'crystal', col: 'secondary', region: 'torso' }); }
  S.layer('glow');
  S.capsule(add(jp(J, 'chest'), [-0.12, 0.15, 0.22]), add(jp(J, 'chest'), [0.05, -0.05, 0.24]), 0.012, { mat: 'glow', col: 'glow', glow: 2.6, region: 'torso' });
  S.capsule(add(jp(J, 'chest'), [0.05, -0.05, 0.24]), add(jp(J, 'chest'), [0.14, 0.1, 0.22]), 0.012, { mat: 'glow', col: 'glow', glow: 2.6, region: 'torso' });
  for (const sx of [1, -1]) S.sphere(add(jp(J, 'head'), [sx * 0.045, 0.08, 0.165]), 0.018, { mat: 'glow', col: 'glow', glow: 3.2, region: 'head' });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.75 };
} };

U.shade = { H: 1.87, budgets: [4200, 1300], torsoW: 0.6, build(S, P) {
  const s = 1.0;
  const J = humanoid(s, { armR: [[0.36, 1.2, 0.2], [0.42, 1.12, 0.34]], armL: [[0.36, 1.2, 0.2], [0.42, 1.12, 0.34]] });
  const BL = fakeB(J, s), BR = fakeB(J, s, true);
  // schwebende, zerfetzte Robe
  skirt(S, BL, { top: 1.55, bottom: 0.2, r0: 0.2, r1: 0.36, col: 'primary', mat: 'cloth', folds: 9, fold: 0.03, th: 0.018, hemWave: 0.09,
    bind: (p) => [['hips', 0.5], ['spine', 0.5]] });
  torsoShape(S, BL, { bulk: 0.95, o: { mat: 'cloth', col: 'primary*0.8', region: 'torso' } });
  bothSides(S, BL, BR, (B0) => {
    upperArmShape(S, B0, { bulk: 1.3, o: { mat: 'cloth', col: 'primary', region: 'armL' } });
    foreArmShape(S, B0, { bulk: 1.5, o: { mat: 'cloth', col: 'primary', region: 'armL' } });
    const F = handFrame(B0, 'L');
    for (let i = 0; i < 3; i++) S.tube([F.at(0.05, (i - 1) * 0.025, 0), F.at(0.12, (i - 1) * 0.04, 0.03), F.at(0.25, (i - 1) * 0.05, 0.08)], [0.012, 0.009, 0.002], { mat: 'bone', col: '#c8c0b0', region: ['handL', 'foreArmL'] });
  });
  const H = headInfo(BL);
  S.shell({ off: 0.0, th: 0.02, mat: 'cloth', col: 'primary', region: 'head', clip: (x, y, z) => -max(max(abs(x) - 0.07, y - H.c[1] - 0.06), -(z - H.c[2] - 0.0)) }, () => {
    S.ellipsoid(H.at(0, 0.02, -0.01), [0.12, 0.14, 0.13], {});
    S.capsule(H.at(0, 0.1, -0.05), H.at(0, 0.2, -0.16), 0.06, 0.005, { k: 0.06 });
    S.ellipsoid([0, jp(J, 'neck')[1] - 0.05, -0.01], [0.28, 0.12, 0.2], { k: 0.08 });
  });
  S.ellipsoid(H.at(0, -0.01, 0.0), [0.095, 0.11, 0.1], { mat: 'void', col: '#05040a', region: 'head' });
  S.layer('glow');
  for (const sx of [1, -1]) S.sphere(H.at(sx * 0.035, 0.0, 0.09), 0.014, { mat: 'glow', col: 'glow', glow: 4, region: 'head' });
  S.sphere([0, 1.25, 0.2], 0.05, { mat: 'glow', col: 'glow', glow: 2.4, region: 'torso' });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.6 };
} };

U.treant = { H: 2.79, budgets: [5600, 1700], build(S, P) {
  const s = 1.3;
  const J = humanoid(s, { sw: 1.3, armR: [[0.42, 1.0, 0.1], [0.48, 0.72, 0.18]], armL: [[0.42, 1.0, 0.08], [0.48, 0.72, 0.16]], stance: 0.08 });
  const bark = { mat: 'bark', col: 'secondary', disp: Detail.bark({ amp: 0.014, n: 16, freq: 8 }) };
  S.group({ k: 0.04 }, () => {
    S.capsule(jp(J, 'hips'), add(jp(J, 'neck'), [0, 0.05, 0]), 0.3, 0.34, { ...bark, region: 'torso' });
    S.ellipsoid(add(jp(J, 'head'), [0, 0.1, 0.05]), [0.15, 0.17, 0.14], { ...bark, region: 'head' });
    for (const side of ['L', 'R']) {
      const sh = jp(J, 'upperArm' + side), el = jp(J, 'foreArm' + side), ha = jp(J, 'hand' + side);
      S.capsule(add(sh, [0, 0.04, 0]), el, 0.14, 0.1, { ...bark, region: 'arm' + side });
      S.capsule(el, ha, 0.1, 0.08, { ...bark, region: 'arm' + side });
      const d = norm(sub(ha, el));
      for (let k = 0; k < 4; k++) { const a = k * 1.6; S.tube([ha, add(ha, add(scl(d, 0.12), [cos(a) * 0.06, 0, sin(a) * 0.06])), add(ha, add(scl(d, 0.25), [cos(a) * 0.1, -0.02, sin(a) * 0.1]))], [0.035, 0.02, 0.004], { ...bark, region: 'arm' + side }); }
      S.capsule(jp(J, 'thigh' + side), jp(J, 'shin' + side), 0.13, 0.1, { ...bark, region: 'leg' + side });
      S.capsule(jp(J, 'shin' + side), add(jp(J, 'foot' + side), [0, -0.05, 0]), 0.1, 0.13, { ...bark, region: 'leg' + side });
      for (let k = 0; k < 3; k++) { const a = -0.8 + k * 0.8 + (side === 'L' ? 0 : PI); const f = jp(J, 'foot' + side); S.capsule(add(f, [0, -0.04, 0]), [f[0] + sin(a) * 0.22, 0.02, f[2] + cos(a) * 0.22], 0.05, 0.015, { ...bark, region: 'leg' + side }); }
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  // Laubkrone + Moos
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; S.ellipsoid(add(jp(J, 'head'), [cos(a) * 0.32, 0.42 + 0.1 * sin(a * 3), sin(a) * 0.28 - 0.05]), [0.26, 0.2, 0.25], { mat: 'leaf', col: 'primary', region: 'head', k: 0.06, disp: Detail.noise({ amp: 0.025, freq: 14 }) }); }
  for (const sx of [1, -1]) S.ellipsoid(add(jp(J, 'upperArm' + (sx > 0 ? 'L' : 'R')), [sx * 0.02, 0.1, 0]), [0.14, 0.08, 0.13], { mat: 'moss', col: 'primary*0.8', region: 'shoulder' + (sx > 0 ? 'L' : 'R'), k: 0.03, disp: Detail.noise({ amp: 0.015, freq: 18 }) });
  S.layer('glow');
  for (const sx of [1, -1]) S.sphere(add(jp(J, 'head'), [sx * 0.05, 0.12, 0.17]), 0.018, { mat: 'glow', col: 'glow', glow: 3, region: 'head' });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.86 };
} };

// ---- Vierbeiner ----
function quadSkeleton(o) {
  const J = {};
  const set = (n, p, parent) => { J[n] = { pos: V(...p), parent }; };
  const { y = 0.74, zf = 0.28, zb = -0.46, w = 0.15, headP = [0, 1.05, 0.66] } = o;
  set('hips', [0, y, zb], null);
  set('spine', [0, y + 0.02, (zb + zf) / 2], 'hips');
  set('chest', [0, y + 0.04, zf], 'spine');
  set('neck', [0, y + 0.12, zf + 0.15], 'chest');
  set('head', headP, 'neck');
  for (const [side, k] of [['L', 1], ['R', -1]]) {
    set('fleg' + side, [k * w, y - 0.04, zf], 'chest');
    set('fknee' + side, [k * w * 1.1, y * 0.5, zf + 0.04], 'fleg' + side);
    set('fpaw' + side, [k * w, 0.06, zf + 0.06], 'fknee' + side);
    set('bleg' + side, [k * w * 1.1, y - 0.02, zb], 'hips');
    set('bknee' + side, [k * w * 1.1, y * 0.4, zb - 0.12], 'bleg' + side);
    set('bpaw' + side, [k * w, 0.06, zb - 0.04], 'bknee' + side);
  }
  set('tail', [0, y + 0.06, zb - 0.16], 'hips');
  set('tail1', [0, y + 0.1, zb - 0.4], 'tail');
  set('tail2', [0, y - 0.05, zb - 0.62], 'tail1');
  return J;
}
function quadCls(J, H, legY) {
  const c = {};
  for (const side of ['L', 'R']) {
    const ph = side === 'L' ? 0 : PI;
    for (const n of ['fleg', 'fknee', 'fpaw']) c[n + side] = [1, ph, legY, J['fleg' + side].pos.z];
    for (const n of ['bleg', 'bknee', 'bpaw']) c[n + side] = [1, ph + PI, legY, J['bleg' + side].pos.z];
  }
  c.neck = [7, 0, J.neck.pos.y, J.chest.pos.z]; c.head = [7, 0, J.neck.pos.y, J.chest.pos.z];
  const L = J.head.pos.z - J.tail2.pos.z;
  for (const n of ['tail', 'tail1', 'tail2']) c[n] = [5, 0, 0.08 * L, 6 / L];
  return c;
}
function canine(S, J, o = {}) {
  const fur = { mat: 'fur', col: o.col, disp: Detail.fur({ amp: o.furAmp ?? 0.012, freq: 18, dir: [0, -0.3, -1] }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.06 }, () => {
    S.ellipsoid(add(p('chest'), [0, 0.0, 0.0]), [0.25, 0.28, 0.3], { ...fur, region: ['chest', 'spine'] });
    S.ellipsoid(p('spine'), [0.21, 0.22, 0.3], { ...fur, region: ['chest', 'spine', 'hips'] });
    S.ellipsoid(p('hips'), [0.2, 0.22, 0.22], { ...fur, region: ['spine', 'hips'] });
    S.capsule(p('chest'), p('neck'), 0.2, 0.16, { ...fur, region: ['chest', 'neck'] });
    // Kopf: Schädel + Schnauze + Ohren
    const h = p('head');
    S.ellipsoid(h, [0.13, 0.12, 0.14], { ...fur, region: ['neck', 'head'] });
    S.capsule(add(h, [0, -0.02, 0.06]), add(h, [0, -0.05, 0.26]), 0.075, 0.045, { ...fur, region: ['head'], k: 0.05 });
    for (const sx of [1, -1]) S.capsule(add(h, [sx * 0.07, 0.08, -0.02]), add(h, [sx * 0.1, 0.2, -0.05]), 0.04, 0.008, { ...fur, region: ['head'], k: 0.03 });
    for (const side of ['L', 'R']) {
      S.capsule(p('fleg' + side), p('fknee' + side), 0.085, 0.055, { ...fur, region: ['chest', 'fleg' + side, 'fknee' + side] });
      S.capsule(p('fknee' + side), p('fpaw' + side), 0.05, 0.045, { ...fur, region: ['fknee' + side, 'fpaw' + side] });
      S.ellipsoid(add(p('fpaw' + side), [0, -0.02, 0.04]), [0.055, 0.04, 0.07], { ...fur, region: ['fpaw' + side] });
      S.capsule(p('bleg' + side), p('bknee' + side), 0.12, 0.06, { ...fur, region: ['hips', 'bleg' + side, 'bknee' + side] });
      S.capsule(p('bknee' + side), p('bpaw' + side), 0.055, 0.045, { ...fur, region: ['bknee' + side, 'bpaw' + side] });
      S.ellipsoid(add(p('bpaw' + side), [0, -0.02, 0.04]), [0.055, 0.04, 0.07], { ...fur, region: ['bpaw' + side] });
    }
    S.tube([p('tail'), p('tail1'), p('tail2')], [0.07, 0.09, 0.03], { ...fur, region: ['hips', 'tail', 'tail1', 'tail2'], kj: 0.03 });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  const h = p('head');
  S.ellipsoid(add(h, [0, -0.04, 0.295]), [0.025, 0.02, 0.018], { mat: 'leather', col: '#101010', region: ['head'] });
  for (const sx of [1, -1]) S.sphere(add(h, [sx * 0.055, 0.03, 0.11]), 0.017, { mat: 'eye', col: '#d8a020', region: ['head'] });
  for (const sx of [1, -1]) S.capsule(add(h, [sx * 0.03, -0.075, 0.2]), add(h, [sx * 0.03, -0.1, 0.21]), 0.008, 0.002, { mat: 'bone', col: '#e8e0c8', region: ['head'] });
}

U.wolf = { H: 1.42, budgets: [4200, 1300], build(S, P) {
  const J = quadSkeleton({});
  canine(S, J, { col: '#5d646e' });
  // Schulterplatte (schlicht) + Halsband
  S.shell({ off: 0.02, th: 0.018, ...steelA('metal'), region: ['chest', 'spine'], clip: (x, y, z) => 0.86 - y }, () => S.ellipsoid(jp(J, 'chest'), [0.25, 0.28, 0.3], {}));
  S.torus(add(jp(J, 'neck'), [0, -0.02, -0.02]), 0.17, 0.022, { rot: [PI / 2 - 0.7, 0, 0], mat: 'leather', col: '#3a2418', region: ['chest', 'neck'] });
  return { skeleton: skeletonOf(J), radius: 0.78, cls: quadCls(J, 1.42, 0.42 * 1.42) };
} };
U.hound = { H: 1.5, budgets: [4200, 1300], build(S, P) {
  const J = quadSkeleton({ y: 0.78, headP: [0, 1.1, 0.68] });
  canine(S, J, { col: '#3a302c', furAmp: 0.006 });
  // Knochenplatten + Glutrisse
  for (let i = 0; i < 5; i++) S.ellipsoid([0, 0.98 - i * 0.015, 0.3 - i * 0.17], [0.1, 0.05, 0.09], { mat: 'bone', col: '#c8b8a0', region: ['chest', 'spine', 'hips'], k: 0.02 });
  S.layer('glow');
  for (const sx of [1, -1]) S.sphere(add(jp(J, 'head'), [sx * 0.055, 0.03, 0.12]), 0.016, { mat: 'glow', col: 'glow', glow: 3.4, region: ['head'] });
  S.capsule([0.18, 0.8, 0.2], [0.2, 0.7, -0.2], 0.008, { mat: 'glow', col: 'glow', glow: 2.4, region: ['chest', 'spine'] });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.77, cls: quadCls(J, 1.5, 0.42 * 1.5) };
} };

U.raptor = { H: 1.73, budgets: [4200, 1300], build(S, P) {
  const J = {};
  const set = (n, p, parent) => { J[n] = { pos: V(...p), parent }; };
  set('hips', [0, 0.95, -0.15], null); set('chest', [0, 1.05, 0.25], 'hips'); set('neck', [0, 1.25, 0.5], 'chest'); set('head', [0, 1.45, 0.7], 'neck');
  for (const [sd, k] of [['L', 1], ['R', -1]]) { set('thigh' + sd, [k * 0.14, 0.92, -0.12], 'hips'); set('shin' + sd, [k * 0.16, 0.5, 0.0], 'thigh' + sd); set('foot' + sd, [k * 0.15, 0.12, -0.12], 'shin' + sd); set('arm' + sd, [k * 0.12, 1.0, 0.42], 'chest'); }
  set('tail', [0, 0.98, -0.4], 'hips'); set('tail1', [0, 1.0, -0.8], 'tail'); set('tail2', [0, 0.95, -1.4], 'tail1');
  const sk = { mat: 'scale', col: 'primary', disp: Detail.noise({ amp: 0.004, freq: 40 }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.05 }, () => {
    S.ellipsoid(lerp3(p('hips'), p('chest'), 0.5), [0.2, 0.22, 0.42], { ...sk, region: ['hips', 'chest'] });
    S.capsule(p('chest'), p('neck'), 0.15, 0.09, { ...sk, region: ['chest', 'neck'] });
    S.ellipsoid(p('head'), [0.09, 0.1, 0.13], { ...sk, region: ['neck', 'head'] });
    S.capsule(add(p('head'), [0, -0.02, 0.05]), add(p('head'), [0, -0.04, 0.24]), 0.075, 0.04, { ...sk, region: ['head'], k: 0.04 });
    for (const sd of ['L', 'R']) {
      S.capsule(p('thigh' + sd), p('shin' + sd), 0.13, 0.07, { ...sk, region: ['hips', 'thigh' + sd, 'shin' + sd] });
      S.capsule(p('shin' + sd), p('foot' + sd), 0.055, 0.04, { ...sk, region: ['shin' + sd, 'foot' + sd] });
      S.capsule(p('foot' + sd), add(p('foot' + sd), [0, -0.08, 0.2]), 0.04, 0.025, { ...sk, region: ['foot' + sd] });
      S.capsule(p('arm' + sd), add(p('arm' + sd), [0, -0.15, 0.1]), 0.035, 0.02, { ...sk, region: ['chest', 'arm' + sd] });
    }
    S.tube([p('hips'), p('tail'), p('tail1'), p('tail2')], [0.16, 0.12, 0.07, 0.015], { ...sk, region: ['hips', 'tail', 'tail1', 'tail2'], kj: 0.04 });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  for (let i = 0; i < 7; i++) S.capsule([0, 1.2 - i * 0.02, 0.35 - i * 0.18], [0, 1.3 - i * 0.03, 0.3 - i * 0.18], 0.025, 0.004, { mat: 'horn', col: 'secondary', region: ['chest', 'hips', 'tail'] });
  for (const sx of [1, -1]) S.sphere(add(p('head'), [sx * 0.065, 0.04, 0.06]), 0.016, { mat: 'eye', col: '#e0b020', region: ['head'] });
  const c = { neck: [7, 0, 1.15, 0.3], head: [7, 0, 1.15, 0.3], armL: [7, 0, 1.15, 0.3], armR: [7, 0, 1.15, 0.3] };
  for (const sd of ['L', 'R']) for (const n of ['thigh', 'shin', 'foot']) c[n + sd] = [1, sd === 'L' ? 0 : PI, 0.92, -0.12];
  for (const n of ['tail', 'tail1', 'tail2']) c[n] = [5, 0, 0.08 * 2.1, 6 / 2.1];
  return { skeleton: skeletonOf(J), radius: 0.68, cls: c };
} };

U.crawler = { H: 1.32, budgets: [4200, 1300], build(S, P) {
  const J = {};
  const set = (n, p, parent) => { J[n] = { pos: V(...p), parent }; };
  set('hips', [0, 0.55, -0.4], null); set('chest', [0, 0.6, 0.15], 'hips'); set('head', [0, 0.62, 0.55], 'chest');
  const chit = { mat: 'chitin', col: 'primary', wear: 1 };
  S.group({ k: 0.04 }, () => {
    S.ellipsoid(jp(J, 'hips'), [0.38, 0.32, 0.5], { ...chit, region: ['hips'] });
    S.ellipsoid(jp(J, 'chest'), [0.3, 0.22, 0.3], { ...chit, region: ['chest'] });
    S.ellipsoid(jp(J, 'head'), [0.2, 0.16, 0.18], { ...chit, region: ['head'] });
  });
  for (let i = 0; i < 4; i++) S.torus([0, 0.62 - i * 0.02, -0.25 - i * 0.12], 0.33 - i * 0.04, 0.012, { rot: [PI / 2, 0, 0], mat: 'chitin', col: 'secondary', region: ['hips'] });
  for (const sx of [1, -1]) S.capsule(add(jp(J, 'head'), [sx * 0.08, -0.05, 0.12]), add(jp(J, 'head'), [sx * 0.03, -0.12, 0.32]), 0.03, 0.005, { mat: 'horn', col: 'secondary', region: ['head'] });
  const cls = { head: [7, 0, 0.6, 0.3], chest: [6, 0, 0.3, 0], hips: [6, 0, 0.3, 0] };
  for (let i = 0; i < 3; i++) for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const n = `mleg${i}${sd}`, z = 0.25 - i * 0.28;
    const root = [k * 0.22, 0.55, z], knee = [k * 0.6, 0.85, z + 0.08], foot = [k * 0.78, 0.0, z + 0.12];
    J[n] = { pos: V(...root), parent: 'chest' };
    S.tube([root, knee, foot], [0.05, 0.035, 0.008], { ...chit, region: [n] });
    cls[n] = [9, (k > 0 ? 0 : PI) + i * PI, k * 0.22, z];
  }
  S.layer('glow');
  for (const sx of [1, -1]) for (const dz of [0, 0.04]) S.sphere(add(jp(J, 'head'), [sx * 0.07, 0.07, 0.13 + dz]), 0.014, { mat: 'glow', col: 'glow', glow: 3, region: ['head'] });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 0.75, cls };
} };

U.serpent = { H: 2.71, budgets: [5000, 1500], build(S, P) {
  const s = 1.15;
  const J = humanoid(s, { armR: [[0.32, 1.25, 0.12], [0.34, 1.18, 0.32]], armL: [[0.32, 1.25, 0.12], [0.3, 1.25, 0.32]] });
  for (const k of Object.keys(J)) J[k].pos.y += 0.25;
  J.weaponR = { pos: V(-0.34 * s, 1.43, 0.34 * s), parent: 'handR' };
  const BL = fakeB(J, s), BR = fakeB(J, s, true);
  const scale = { mat: 'scale', col: 'primary', disp: Detail.noise({ amp: 0.003, freq: 45 }) };
  torsoShape(S, BL, { female: true, o: { ...scale, region: 'torso' } });
  bothSides(S, BL, BR, (B0) => { upperArmShape(S, B0, { o: { ...scale, region: 'armL' } }); foreArmShape(S, B0, { o: { ...scale, region: 'armL' } }); simpleHand(S, B0, 'primary', 'scale'); bracer(S, jp(B0.J, 'foreArmL'), jp(B0.J, 'handL'), 0.05, 0.042, { s, mat: 'gold', col: 'metal', region: 'armL', th: 0.016, rim: false }); });
  neckShape(S, BL, { r: 0.06, o: { ...scale, region: 'neck' } });
  const H = head(S, BL, { female: true, skin: P.primary, eye: '#e0d040', brow: false, lips: '#2a4a40' });
  S.shell({ off: 0.005, th: 0.02, mat: 'scale', col: 'secondary', region: 'head', clip: (x, y, z) => z - H.c[2] - 0.0 }, () => S.ellipsoid(H.at(0, 0.03, -0.05), [0.2, 0.2, 0.14], {}));
  // Schlangenleib
  const pts = [], rr = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([sin(t * 5) * 0.25 * t, 1.2 - t * 1.05 - (t > 0.5 ? 0 : 0), -t * 0.9 + 0.05]); rr.push((0.17 - 0.12 * t) * 1.1); }
  for (let i = 0; i <= 14; i++) if (pts[i][1] < 0.14) pts[i][1] = 0.12 + (pts[i][1] - 0.12) * 0.1;
  S.tube(pts, rr, { ...scale, region: ['hips', 'tail', 'tail1', 'tail2'], kj: 0.04, k: 0.05 });
  J.tail = { pos: V(...pts[4]), parent: 'hips' }; J.tail1 = { pos: V(...pts[8]), parent: 'tail' }; J.tail2 = { pos: V(...pts[13]), parent: 'tail1' };
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.1], [1, 0, 0]);
  S.capsule(fr.at(0, -0.6), fr.at(0, 1.0), 0.02, { mat: 'gold', col: 'metal', bone: 'weaponR' });
  for (const a of [-0.4, 0, 0.4]) S.capsule(fr.at(0, 1.0), fr.at(sin(a) * 0.12, 1.25, 0), 0.02, 0.003, { mat: 'steel', col: '#c0c8c8', bone: 'weaponR' });
  const c = {}; for (const n of ['tail', 'tail1', 'tail2']) c[n] = [5, 0, 0.07 * 2.7, 3 / 2.7];
  return { skeleton: skeletonOf(J), radius: 0.66, cls: c, hipY: 1.24 };
} };

// ---- Bosse ----
function bossHumanoid(S, s, o) {
  const J = humanoid(s, { sw: o.sw ?? 1.25, armR: o.armR, armL: o.armL, stance: 0.07 });
  if (o.weapon) J.weaponR = { pos: V(-(o.armR[1][0] + 0.01) * s, o.armR[1][1] * s, (o.armR[1][2] + 0.03) * s), parent: 'handR' };
  const { BL, BR } = humanBody(S, J, s, { bulk: o.bulk ?? 1.2, armBulk: o.armBulk ?? 1.3, legBulk: o.legBulk ?? 1.2, base: o.base, torso: o.torso, legs: o.legs });
  return { J, BL, BR };
}
U.boss_titan = { H: 6.1, budgets: [9000, 2800], build(S, P) {
  const s = 3.1;
  const stone = { mat: 'stone', col: 'primary', disp: Detail.noise({ amp: 0.03, freq: 3.5, ridged: true }) };
  const { J, BL, BR } = bossHumanoid(S, s, { sw: 1.35, bulk: 1.35, armBulk: 1.7, legBulk: 1.4, base: stone, armR: [[0.4, 1.0, 0.08], [0.42, 0.72, 0.16]], armL: [[0.4, 1.0, 0.08], [0.42, 0.72, 0.16]] });
  bothSides(S, BL, BR, (B0) => { S.ellipsoid(add(jp(B0.J, 'upperArmL'), [0.1, 0.25, 0]), [0.45, 0.35, 0.42], { ...stone, region: 'shoulderL', k: 0.1 }); simpleBoot(S, B0, 'primary'); simpleHand(S, B0, 'primary', 'stone'); });
  S.ellipsoid(add(jp(J, 'head'), [0, 0.25, 0.1]), [0.3, 0.28, 0.3], { ...stone, region: 'head' });
  S.layer('glow');
  S.capsule(add(jp(J, 'chest'), [-0.3, 0.4, 0.5]), add(jp(J, 'chest'), [0.1, -0.2, 0.55]), 0.03, { mat: 'glow', col: 'glow', glow: 2.6, region: 'torso' });
  S.capsule(add(jp(J, 'chest'), [0.1, -0.2, 0.55]), add(jp(J, 'chest'), [0.35, 0.3, 0.5]), 0.03, { mat: 'glow', col: 'glow', glow: 2.6, region: 'torso' });
  for (const sx of [1, -1]) S.sphere(add(jp(J, 'head'), [sx * 0.1, 0.28, 0.38]), 0.045, { mat: 'glow', col: 'glow', glow: 3.5, region: 'head' });
  S.layer('body');
  return { skeleton: skeletonOf(J), radius: 2.16 };
} };
U.boss_lord = { H: 6.65, budgets: [9000, 2800], build(S, P) {
  const s = 3.2;
  const { J, BL, BR } = bossHumanoid(S, s, { weapon: true, base: { mat: 'iron', col: 'metal' }, torso: { mat: 'cloth', col: 'primary' }, armR: [[0.33, 1.15, 0.12], [0.35, 1.0, 0.32]], armL: [[0.34, 1.15, 0.08], [0.36, 1.0, 0.2]] });
  plateTorso(S, BL, { col: 'metal', mat: 'iron', trim: 'secondary', bulk: 1.2 });
  bothSides(S, BL, BR, (B0) => {
    const pd = pauldron(S, B0, { r: 0.17, layers: 3, col: 'metal', mat: 'iron', trim: 'secondary', tilt: 0.5, th: 0.02 });
    for (let k = 0; k < 3; k++) { const b0 = add(pd.c, [0.04 + 0.04 * k, 0.15, -0.06 + 0.06 * k].map((v) => v * 1.0 * s / 1.0 * 0.3)); S.capsule(b0, add(b0, [0.1, 0.35, 0]), 0.06, 0.005, { mat: 'iron', col: '#2a2228', bind: pd.bind, k: 0.02 }); }
    simpleBoot(S, B0, '#1a1418'); simpleHand(S, B0, '#2a2228', 'iron');
  });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.45 * s, r0: 0.21, r1: 0.3, col: 'primary', folds: 9, fold: 0.014, th: 0.02, slits: [0, 1.5, -1.5] });
  cape(S, BL, { top: 1.5 * s, bottom: 0.25 * s, r0: 0.2, r1: 0.48, arc: 1.3, col: 'primary', folds: 9, fold: 0.02, th: 0.025, hem: 'secondary', hemWave: 0.05, chain: ['chest', 'spine', 'hips', 'hips'] });
  helmet(S, BL, { col: 'metal' });
  const H = headInfo(BL);
  for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; S.capsule(H.at(sin(a) * 0.09, 0.1, cos(a) * 0.05), H.at(sin(a) * 0.14, 0.26 - abs(a) * 0.05, cos(a) * 0.06), 0.014, 0.003, { mat: 'gold', col: 'secondary', region: 'head' }); }
  S.layer('glow'); S.box(H.at(0, 0, 0.11), [0.065, 0.006, 0.01], { mat: 'glow', col: 'glow', glow: 3.4, region: 'head' }); S.layer('body');
  const fr = frame(jp(J, 'weaponR'), [0.05, 0.4, 0.92], [0, 1, -0.4]);
  S.prim(fr.o, bladePrim({ y0: 0.25, L: 3.4, w: 0.36, th: 0.07, leaf: 0.15 }), { rot: fr.basis, mat: 'iron', col: '#3a3038', bone: 'weaponR' });
  S.capsule(fr.at(-0.45, 0.2), fr.at(0.45, 0.2), 0.06, { mat: 'gold', col: 'secondary', bone: 'weaponR' });
  S.capsule(fr.at(0, 0.18), fr.at(0, -0.55), 0.05, { mat: 'leather', col: '#2a1a18', bone: 'weaponR' });
  S.layer('glow'); S.capsule(fr.at(0, 0.5, 0.036), fr.at(0, 3.0, 0.036), 0.015, { mat: 'glow', col: 'glow', glow: 2.6, bone: 'weaponR' }); S.layer('body');
  return { skeleton: skeletonOf(J), radius: 2.08 };
} };
U.king = { H: 6.43, budgets: [9000, 2800], build(S, P) {
  const s = 3.25;
  const { J, BL, BR } = bossHumanoid(S, s, { sw: 1.15, bulk: 1.1, armBulk: 1.15, legBulk: 1.1, weapon: true, base: { mat: 'mail', col: '#6a707a' }, torso: { mat: 'velvet', col: 'primary' }, armR: [[0.3, 1.2, 0.1], [0.32, 1.1, 0.28]], armL: [[0.3, 1.2, 0.1], [0.3, 1.14, 0.28]] });
  plateTorso(S, BL, { col: 'metal', trim: 'secondary', bulk: 1.1 });
  bothSides(S, BL, BR, (B0) => { pauldron(S, B0, { r: 0.14, layers: 2, col: 'metal', trim: 'secondary', tilt: 0.5, th: 0.018 }); simpleBoot(S, B0, '#3a2a1a'); simpleHand(S, B0, '#d8dce4', 'steel'); });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.05 * s, r0: 0.2, r1: 0.4, col: 'primary', mat: 'velvet', folds: 11, fold: 0.012, th: 0.02, hem: 'secondary', hemW: 0.03 });
  cape(S, BL, { top: 1.5 * s, bottom: 0.03 * s, r0: 0.2, r1: 0.55, arc: 1.5, col: 'primary', mat: 'velvet', folds: 9, fold: 0.02, th: 0.025, hem: '#f0eadc', hemMat: 'fur', chain: ['chest', 'spine', 'hips', 'hips'] });
  S.shell({ off: 0, th: 0.05, mat: 'fur', col: '#f0eadc', region: 'upper', clip: (x, y, z) => jp(J, 'upperArmL')[1] - 0.04 * s - y, disp: Detail.fur({ amp: 0.012, freq: 10 }) }, () => S.ellipsoid(add(jp(J, 'neck'), [0, -0.03 * s, -0.02 * s]), [0.27 * s, 0.12 * s, 0.2 * s], {}));
  const H = head(S, BL, { skin: '#d8a888', eye: '#4a6a9a', brow: '#d8d8d8', lips: '#a06a5a', jaw: 1.1 });
  S.group({ k: 0.004 * s }, () => { S.ellipsoid(H.at(0, -0.09, 0.05), [0.07 * s, 0.06 * s, 0.06 * s], { mat: 'hair', col: '#e0e0e0', region: 'head', disp: Detail.fur({ amp: 0.005, freq: 30, dir: [0, -1, 0] }) }); });
  // Krone
  S.torus(H.at(0, 0.07, -0.01), 0.095 * s, 0.012 * s, { mat: 'gold', col: 'secondary', region: 'head' });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; S.capsule(H.at(sin(a) * 0.095, 0.07, -0.01 + cos(a) * 0.095), H.at(sin(a) * 0.1, 0.12, -0.01 + cos(a) * 0.1), 0.012 * s, 0.003 * s, { mat: 'gold', col: 'secondary', region: 'head' }); }
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.05], [1, 0, 0]);
  S.capsule(fr.at(0, -1.3), fr.at(0, 1.6), 0.04, { mat: 'gold', col: 'secondary', bone: 'weaponR' });
  S.sphere(fr.at(0, 1.7), 0.14, { mat: 'gold', col: 'secondary', bone: 'weaponR' });
  S.layer('glow'); S.sphere(fr.at(0, 1.72, 0.1), 0.06, { mat: 'glow', col: 'glow', glow: 3, bone: 'weaponR' }); S.layer('body');
  return { skeleton: skeletonOf(J), radius: 2.25 };
} };
U.boss_drake = { H: 6.06, budgets: [9000, 2800], build(S, P) {
  const J = quadSkeleton({ y: 2.3, zf: 1.2, zb: -1.2, w: 0.55, headP: [0, 4.0, 2.9] });
  J.neck.pos.y = 3.1; J.neck.pos.z = 2.0;
  J.tail.pos = V(0, 2.4, -1.8); J.tail1.pos = V(0, 2.1, -3.2); J.tail2.pos = V(0, 1.2, -4.8);
  const sc = { mat: 'scale', col: 'primary', disp: Detail.noise({ amp: 0.02, freq: 6 }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.25 }, () => {
    S.ellipsoid(p('spine'), [0.9, 0.95, 1.6], { ...sc, region: ['chest', 'spine', 'hips'] });
    S.capsule(p('chest'), p('neck'), 0.7, 0.4, { ...sc, region: ['chest', 'neck'] });
    S.capsule(p('neck'), p('head'), 0.4, 0.35, { ...sc, region: ['neck', 'head'] });
    S.capsule(p('head'), add(p('head'), [0, -0.2, 0.9]), 0.38, 0.2, { ...sc, region: ['head'] });
    for (const side of ['L', 'R']) {
      S.capsule(p('fleg' + side), p('fknee' + side), 0.35, 0.22, { ...sc, region: ['chest', 'fleg' + side, 'fknee' + side] });
      S.capsule(p('fknee' + side), p('fpaw' + side), 0.22, 0.2, { ...sc, region: ['fknee' + side, 'fpaw' + side] });
      S.capsule(p('bleg' + side), p('bknee' + side), 0.45, 0.25, { ...sc, region: ['hips', 'bleg' + side, 'bknee' + side] });
      S.capsule(p('bknee' + side), p('bpaw' + side), 0.22, 0.2, { ...sc, region: ['bknee' + side, 'bpaw' + side] });
    }
    S.tube([p('hips'), p('tail'), p('tail1'), p('tail2')], [0.7, 0.5, 0.3, 0.05], { ...sc, region: ['hips', 'tail', 'tail1', 'tail2'], kj: 0.2 });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  for (const sx of [1, -1]) S.capsule(add(p('head'), [sx * 0.25, 0.25, -0.1]), add(p('head'), [sx * 0.45, 0.6, -0.8]), 0.1, 0.01, { mat: 'horn', col: 'secondary', region: ['head'] });
  for (let i = 0; i < 9; i++) S.capsule([0, 3.1 - i * 0.12, 1.2 - i * 0.5], [0, 3.5 - i * 0.14, 1.0 - i * 0.5], 0.09, 0.01, { mat: 'horn', col: 'secondary', region: ['chest', 'spine', 'hips', 'tail'] });
  // Flügel
  const c = quadCls(J, 6.06, 0.35 * 6.06);
  for (const [sd, k] of [['L', 1], ['R', -1]]) {
    J['wing' + sd] = { pos: V(k * 0.7, 3.1, 0.6), parent: 'chest' };
    const r0 = [k * 0.7, 3.1, 0.6], el = [k * 2.6, 4.4, 0.2], tip = [k * 5.2, 3.6, -0.6];
    S.tube([r0, el, tip], [0.16, 0.1, 0.03], { ...sc, region: ['wing' + sd] });
    S.prim([0, 0, 0], { f: (x, y, z) => { if (k * x < 0.5) return 1e3; const t = clamp((k * x - 0.7) / 4.5, 0, 1); const top = 4.4 - 0.9 * t - 1.6 * (t - 0.4) ** 2 * 0, bot = 3.4 - 1.8 * t * (1 - t) - 0.6 * t + 0.3 * abs(sin(t * 12)); return max(max(y - top + (t > 0.45 ? (t - 0.45) * 2 : 0), bot - y), abs(z - 0.4 + t * 0.8) - 0.03); }, box: [k > 0 ? 0.5 : -5.4, 1.4, -0.7, k > 0 ? 5.4 : -0.5, 4.6, 0.7] }, { mat: 'leather', col: 'primary*0.6', region: ['wing' + sd] });
    c['wing' + sd] = [4, k * 0.7, 3.1, 0];
  }
  S.layer('glow'); for (const sx of [1, -1]) S.sphere(add(p('head'), [sx * 0.24, 0.12, 0.4]), 0.07, { mat: 'glow', col: 'glow', glow: 3.4, region: ['head'] }); S.layer('body');
  return { skeleton: skeletonOf(J), radius: 2.09, cls: c };
} };

export const UNIT_DESIGNS = U;

/** Forge-Definition einer Einheit */
export function unitDef(arch, cell = 0.007) {
  const D = U[arch];
  const palette = { ...(DEFAULTS[arch] || {}) };
  let res = null;
  const def = {
    id: 'unit_' + arch, kind: 'unit', palette, scale: 1, cell: cell * (D.H > 4 ? 2.6 : 1.25), budgets: D.budgets, H: D.H,
    build: (S) => { res = D.build(S, palette); def.skeleton = res.skeleton; def.cls = res.cls; if (res.hipY) def.hipY = res.hipY; def.torsoW = D.torsoW; return { radius: res.radius }; },
    unitRig: null,
  };
  def.unitRig = (...a) => makeUnitRig(def)(...a);
  return def;
}
