// Brann Eisenfaust – Krieger: wuchtiger Kupfer-/Stahl-Plattenpanzer, Pelzkragen, Dornen-Schulterkuppeln,
// nackte muskulöse Oberarme mit Runen-Tattoo, mächtiger geflochtener Bart + Haarknoten, Runenhammer.
import {
  joints, torsoShape, neckShape, footShape, handShape, head, belt, skirt, pauldron, bracer, boot, Detail, add, sub, scl, norm, lerp3,
  PI, TAU, clamp, smooth, weaponFrame, bodyBase, chainBind, thighShape,
} from './lib.js';
import { warhammer } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot } = Math;

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const info = { radius: 0.55 * s, style: 'hammer', cores: [], trails: [] };
  const steel = 'primary', copper = 'secondary', glowC = P.glow, skin = '#b47a5a', fur = '#5a4232', leather = '#3a2618';
  const hips = j('hips'), chest = j('chest'), neck = j('neck');
  S.layer('body');
  bodyBase(S, B, { bulk: 1.1, armBulk: 1.25, legBulk: 1.12, chest: 1.08, torso: { mat: 'leather', col: '#4a3020' }, arms: { mat: 'skin', col: skin, disp: Detail.muscle({ amp: 0.003 * s, freq: 30 }) },
    fore: { mat: 'skin', col: skin }, legs: { mat: 'cloth', col: '#3a3028' }, neck: false });
  S.sym(() => boot(S, B, { h: 0.3, col: '#3a2a1e', cuff: fur, cuffMat: 'fur', w: 1.15 }));
  // Brustpanzer (Kupfer mit Stahlplatte), kräftiger Grat, Nieten
  const yBot = hips[1] + 0.06 * s, yTop = neck[1] - 0.02 * s, ua = j('upperArmL');
  const clip = (x, y, z) => { let c = max(yBot - y, y - yTop); c = max(c, -(hypot(abs(x) - ua[0] + 0.005 * s, (y - ua[1] + 0.03 * s) * 0.85) - 0.09 * s)); return c; };
  const ref = () => torsoShape(S, B, { bulk: 1.1, chest: 1.08, k: 0.07 });
  S.shell({ off: 0.016 * s, th: 0.015 * s, mat: 'copper', col: copper, region: 'torso', clip }, ref);
  S.shell({ off: 0.028 * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'torso', clip: (x, y, z) => max(clip(x, y, z), max(abs(x) - 0.13 * s + (y - chest[1]) * 0.25, -z)) }, ref);
  for (let i = 0; i < 7; i++) { const y = yBot + 0.04 * s + i * 0.05 * s; for (const sx of [1, -1]) S.sphere([sx * (0.12 * s - (y - chest[1]) * 0.25), y, 0.165 * s + (y < chest[1] ? 0 : 0.0)], 0.007 * s, { mat: 'copper', col: '#e0a060', region: 'torso', k: 0.002 * s }); }
  // Bauchschutz-Lamellen + breiter Gürtel mit Rundschnalle
  for (let i = 0; i < 2; i++) { const y1 = yBot + 0.005 * s - i * 0.045 * s; S.shell({ off: (0.022 + 0.005 * i) * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'pelvis', clip: (x, y, z) => max(y1 - 0.05 * s - y, y - y1) }, () => torsoShape(S, B, { bulk: 1.1 })); }
  belt(S, B, { dy: -0.04, rx: 0.205, rz: 0.16, h: 0.06, col: leather, buckle: copper, buckleMat: 'copper' });
  S.torus([0, hips[1] - 0.04 * s, 0.185 * s], 0.035 * s, 0.009 * s, { rot: [PI / 2, 0, 0], mat: 'copper', col: copper, region: 'pelvis' });
  // Lederriemen-Rock
  skirt(S, B, { top: hips[1] - 0.04 * s, bottom: j('shinL')[1] + 0.05 * s, r0: 0.2, r1: 0.26, col: leather, mat: 'leather', folds: 7, fold: 0.006, th: 0.014,
    slits: [0, 0.6, -0.6, 1.3, -1.3, 2.1, -2.1, PI], slitFrom: 0.1, hem: copper, hemW: 0.015, hemMat: 'copper' });
  // Pelzkragen
  S.shell({ off: 0, th: 0.04 * s, mat: 'fur', col: fur, region: 'upper', clip: (x, y, z) => max(ua[1] - 0.02 * s - y, y - neck[1] - 0.05 * s), disp: Detail.fur({ amp: 0.012 * s, freq: 26, dir: [0, -1, -0.2] }) }, () => {
    S.lathe([0, 0, -0.02 * s], [[0, neck[1] + 0.12 * s], [0.08 * s, neck[1] + 0.06 * s], [0.13 * s, neck[1] - 0.04 * s], [0.25 * s, neck[1] - 0.12 * s], [0, neck[1] - 0.2 * s]], {});
  });
  // Schulterkuppeln mit Dornen + Kupferrand
  S.sym(() => {
    const pd = pauldron(S, B, { r: 0.17, layers: 2, col: steel, col2: copper, trim: copper, trimMat: 'copper', tilt: 0.55, th: 0.015, dx: 0.035, dy: 0.05 });
    for (let k = 0; k < 3; k++) {
      const a = -0.4 + k * 0.4, d = norm([0.55 + 0.1 * k, 0.8, sin(a)]);
      const b0 = add(pd.c, scl(d, 0.16 * s));
      S.capsule(b0, add(b0, scl(d, (0.09 - 0.02 * abs(k - 1)) * s)), 0.022 * s, 0.002 * s, { mat: 'steel', col: '#c8ccd0', bind: pd.bind, k: 0.01 * s });
    }
    // Unterarmschienen (Kupfer) + Handschuhe
    bracer(S, add(j('foreArmL'), [0, -0.03 * s, 0]), add(j('handL'), [0, 0.014 * s, 0]), 0.056 * s, 0.047 * s, { s, mat: 'copper', col: copper, region: 'armL', rimMat: 'steel', rimCol: steel, ridge: true });
    // Oberschenkel-Platten
    S.shell({ off: 0.014 * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'legL', clip: (x, y, z) => max(max(j('shinL')[1] + 0.07 * s - y, y - j('thighL')[1] + 0.08 * s), -z) }, () => thighShape(S, B, { bulk: 1.12, muscle: false }));
    S.ellipsoid(add(j('shinL'), [0, 0.01 * s, 0.035 * s]), [0.064 * s, 0.07 * s, 0.05 * s], { mat: 'copper', col: copper, bind: (p) => [['thighL', 0.5], ['shinL', 0.5]], k: 0.01 * s });
  });
  // Runen-Tattoos auf den Oberarmen (Glühen)
  S.layer('glow');
  S.sym(() => { const a = j('upperArmL'), e = j('foreArmL'); for (let k = 0; k < 3; k++) { const p = lerp3(a, e, 0.35 + k * 0.17); S.torus(add(p, [0.004 * s, 0, 0]), 0.0555 * s * (1.1 - k * 0.07), 0.0022 * s, { rot: [0, 0, 0.1], arc: 2.2, mat: 'glow', col: glowC, glow: 2.2, region: 'armL', tier: k ? 3 : 0 }); } });
  S.layer('body');

  // ---- Kopf: Glatze mit Haarknoten, großer geflochtener Bart (fein) ----
  S.layer('body:fine');
  neckShape(S, B, { r: 0.068, o: { mat: 'skin', col: skin, region: 'neck' } });
  const H = head(S, B, { skin: '#c08868', eye: '#6a4a2a', brow: '#8a3a1a', lips: '#9a5a48', jaw: 1.12 });
  const hairC = '#9a4418';
  S.group({ k: 0.006 * s }, () => {
    // Bart: Masse unter Kinn/Wangen + Zöpfe
    S.ellipsoid(H.at(0, -0.085, 0.05), [0.07 * s, 0.06 * s, 0.06 * s], { mat: 'hair', col: hairC, region: 'head', disp: Detail.fur({ amp: 0.004 * s, freq: 60, dir: [0, -1, 0.2] }) });
    for (const sx of [1, -1]) S.ellipsoid(H.at(sx * 0.055, -0.04, 0.035), [0.03 * s, 0.05 * s, 0.045 * s], { mat: 'hair', col: hairC, region: 'head', k: 0.02 * s, disp: Detail.fur({ amp: 0.003 * s, freq: 70, dir: [0, -1, 0] }) });
    S.capsule(H.at(-0.035, -0.052, 0.098), H.at(0.035, -0.052, 0.098), 0.009 * s, { mat: 'hair', col: hairC, region: 'head', k: 0.01 * s }); // Schnurrbart
  });
  S.capsule(H.at(-0.02, -0.068, 0.1), H.at(0.02, -0.068, 0.1), 0.0045 * s, { op: 'sub', k: 0.002 * s, mat: 'lips', col: '#5a2a20', paint: true });
  // Bartzöpfe mit Kupferringen
  for (const sx of [1, -1]) {
    const pts = [H.at(sx * 0.025, -0.11, 0.075), H.at(sx * 0.03, -0.17, 0.08), H.at(sx * 0.028, -0.24, 0.07)];
    const bb = (p) => { const t = smooth(H.c[1] - 0.12 * s, H.c[1] - 0.25 * s, p[1]); return [['head', 1 - t * 0.6], ['neck', t * 0.6]]; };
    S.tube(pts, (t) => (0.018 - 0.008 * t) * s, { mat: 'hair', col: hairC, bind: bb, k: 0.008 * s, disp: Detail.bunch({ amp: 0.002 * s, freq: 260 }) });
    S.torus(lerp3(pts[1], pts[2], 0.5), 0.016 * s, 0.004 * s, { mat: 'copper', col: copper, bind: bb });
  }
  // Haarknoten an der Haarkette
  {
    const hb = chainBind(B, ['hair', 'hair1'], 'head');
    const h0 = P0(B.J.hair.pos), h1 = P0(B.J.hair1.pos);
    S.ellipsoid(H.at(0, 0.035, -0.04), [0.07 * s, 0.075 * s, 0.075 * s], { mat: 'hair', col: hairC, region: 'head', disp: Detail.fur({ amp: 0.002 * s, freq: 90, dir: [0, 0, -1] }) });
    S.tube([add(h0, [0, 0.02 * s, 0.02 * s]), lerp3(h0, h1, 0.5), add(h1, [0, -0.05 * s, -0.02 * s])], (t) => (0.028 - 0.016 * t) * s, { mat: 'hair', col: hairC, bind: hb, k: 0.01 * s, disp: Detail.bunch({ amp: 0.002 * s, freq: 200 }) });
    S.torus(add(h0, [0, 0.0, 0.0]), 0.03 * s, 0.006 * s, { rot: [0.6, 0, 0], mat: 'copper', col: copper, region: 'head' });
  }
  // Stirnreif
  S.torus(H.at(0, 0.04, -0.01), 0.091 * s, 0.005 * s, { rot: [-0.15, 0, 0], arc: 4.0, mat: 'copper', col: copper, region: 'head' });
  S.sym(() => handShape(S, B, { curl: 1, bulk: 1.25, o: { mat: 'leather', col: '#3a2418', region: ['foreArmL', 'handL'] } }));
  S.layer('glow');
  S.sphere(H.at(0, 0.05, 0.088), 0.006 * s, { mat: 'glow', col: glowC, glow: 3, region: 'head' });
  S.layer('body');

  // ---- Runenhammer ----
  const fr = weaponFrame(B, 'R', 'weaponR');
  S.layer('body:fine');
  const hm = warhammer(S, fr, { s, len: 1.12, head: 0.24, glow: glowC, copper: 'secondary', metal: '#7e8892', layer: 'body:fine' });
  S.layer('glow');
  S.sphere(fr.at(0, hm.hy, 0), 0.03 * s, { mat: 'glow', col: glowC, glow: 3.2, bone: 'weaponR' });
  S.layer('glass');
  for (const sz of [1, -1]) S.ellipsoid(fr.at(0, hm.hy, sz * 0.11 * s), [0.028 * s, 0.028 * s, 0.014 * s], { rot: fr.basis, mat: 'gem', col: '#80f0ff', bone: 'weaponR' });
  S.layer('body');
  info.cores.push({ joint: 'weaponR', p: fr.at(0, hm.hy, 0.12 * s), size: 0.2 }, { joint: 'weaponR', p: fr.at(0, hm.hy, -0.12 * s), size: 0.2 });
  info.trails.push({ joint: 'weaponR', a: fr.at(0, hm.hy - 0.12 * s, 0), b: fr.at(0, hm.hy + 0.12 * s, 0) });
  return info;
}
const P0 = (v) => [v.x, v.y, v.z];
void footShape; void sub; void clamp; void TAU; void min; void atan2; void cos;
