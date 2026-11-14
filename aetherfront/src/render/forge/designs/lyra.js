// Lyra Windläuferin – Jägerin: grüner Kapuzenumhang, geschnürtes Lederkorsett, Lederschienen, Köcher,
// Elfenohren + Pferdeschwanz, Blattklingen-Langbogen mit glühenden Runen.
import {
  joints, frame, handFrame, headInfo, torsoShape, neckShape, footShape, handShape, head, belt, skirt, cape, Detail, add, sub, scl, norm, lerp3, madd,
  PI, TAU, clamp, smooth, weaponFrame, runeLine, bodyBase, boot, bracer, chainBind, pauldron,
} from './lib.js';
import { longbow } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot } = Math;

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const info = { radius: 0.45 * s, style: 'ranger', cores: [], trails: [] };
  const green = 'primary', dgreen = '#2a3a1c', leather = '#6a4426', dleather = '#3a2414', gold = 'metal', glowC = P.glow;
  const hips = j('hips'), chest = j('chest'), neck = j('neck');
  S.layer('body');
  bodyBase(S, B, { female: true, bulk: 0.96, armBulk: 0.9, legBulk: 0.95, torso: { mat: 'cloth', col: '#4a6a30' }, legs: { mat: 'leather', col: '#2c3420' }, neck: false });
  S.sym(() => boot(S, B, { h: 0.34, col: dleather, cuff: leather, w: 1.0 }));
  // Korsett (Leder, geschnürt) + Schnürung
  S.shell({ off: 0.006 * s, th: 0.013 * s, mat: 'leather', col: leather, region: 'torso', clip: (x, y, z) => max(hips[1] - 0.02 * s - y, y - chest[1] - 0.09 * s - 0.04 * s * smooth(0.0, 0.1 * s, abs(x))) }, () => torsoShape(S, B, { female: true, bulk: 0.96 }));
  for (let i = 0; i < 6; i++) { const y = hips[1] + 0.01 * s + i * 0.035 * s; S.capsule([-0.022 * s, y, 0.13 * s - i * 0.003 * s], [0.022 * s, y + 0.017 * s, 0.13 * s - i * 0.003 * s], 0.0035 * s, { mat: 'cloth', col: '#d8c8a0', region: 'torso', k: 0.002 * s }); }
  belt(S, B, { dy: -0.02, rx: 0.16, rz: 0.12, h: 0.04, col: dleather, buckle: gold });
  // Gürteltaschen
  S.sym(() => { S.box([0.13 * s, hips[1] - 0.04 * s, 0.07 * s], [0.035 * s, 0.04 * s, 0.022 * s], { mat: 'leather', col: leather, region: 'pelvis', r: 0.01 * s, rot: [0, 0.9, 0] }); });
  // kurzer Lederrock aus Streifen
  skirt(S, B, { top: hips[1] - 0.01 * s, bottom: j('thighL')[1] - 0.2 * s, r0: 0.165, r1: 0.22, col: green, mat: 'leather', folds: 8, fold: 0.006, th: 0.013,
    slits: [0.5, -0.5, 2.0, -2.0, PI], hem: gold, hemW: 0.012 });
  // Armschienen + linke Schulterplatte (Leder)
  S.sym(() => bracer(S, add(j('foreArmL'), [0, -0.04 * s, 0]), add(j('handL'), [0, 0.015 * s, 0]), 0.046 * s, 0.038 * s, { s, mat: 'leather', col: leather, region: 'armL', rimMat: 'gold', rimCol: gold, ridge: true }));
  pauldron(S, B, { r: 0.1, layers: 2, col: leather, mat: 'leather', trim: gold, tilt: 0.5, th: 0.013 });
  // Kapuzenumhang: Kapuze zurückgeschlagen (Wulst im Nacken) + langer Umhang an der Kette
  const capeBind = cape(S, B, { top: neck[1] - 0.01 * s, bottom: 0.42 * s, r0: 0.16, r1: 0.34, arc: 1.1, col: green, mat: 'cloth', folds: 8, fold: 0.016, th: 0.014,
    hem: '#c9a85a', grad: { axis: 'y', from: neck[1], to: 0.4 * s, k: 0.62 }, hemWave: 0.035, back: 0.03 }).bind;
  S.shell({ off: 0, th: 0.014 * s, mat: 'cloth', col: green, bind: (p) => [['chest', 0.5], ['neck', 0.2], ['cape', 0.3]], clip: (x, y, z) => z - neck[2] + 0.03 * s }, () => {
    S.ellipsoid(add(neck, [0, 0.02 * s, -0.09 * s]), [0.12 * s, 0.09 * s, 0.07 * s], { disp: Detail.folds({ amp: 0.008 * s, n: 6, top: neck[1] + 0.1 * s, bottom: neck[1] - 0.05 * s }) });
  });
  // Köcher auf dem Rücken (schräg) mit Pfeilen
  const q0 = [0.1 * s, chest[1] - 0.06 * s, -0.17 * s], q1 = [-0.06 * s, chest[1] + 0.32 * s, -0.19 * s];
  const qb = (p) => [['chest', 0.85], ['spine', 0.15]];
  S.capsule(q0, q1, 0.045 * s, 0.05 * s, { mat: 'leather', col: dleather, bind: qb });
  for (const t of [0.15, 0.85]) S.torus(lerp3(q0, q1, t), 0.052 * s, 0.005 * s, { rot: frameRot(q0, q1), mat: 'gold', col: gold, bind: qb });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, off = [cos(a) * 0.022 * s, 0, sin(a) * 0.02 * s];
    const d = norm(sub(q1, q0)), p0 = add(add(q1, off), scl(d, -0.04 * s)), p1 = add(p0, scl(d, 0.15 * s));
    S.capsule(p0, p1, 0.0045 * s, { mat: 'wood', col: '#d9c49a', bind: qb });
    S.ellipsoid(add(p0, scl(d, 0.1 * s)), [0.012 * s, 0.035 * s, 0.003 * s], { rot: frameRot(q0, q1, a), mat: 'feather', col: i % 2 ? '#e8e2d2' : '#7a9a4a', bind: qb });
  }
  // Riemen über die Brust
  S.tube([[0.15 * s, chest[1] + 0.16 * s, 0.07 * s], [0.02 * s, chest[1] + 0.06 * s, 0.135 * s], [-0.13 * s, hips[1] + 0.06 * s, 0.1 * s]], 0.011 * s, { mat: 'leather', col: dleather, region: 'torso', k: 0.004 * s });

  // ---- Kopf (fein) ----
  S.layer('body:fine');
  neckShape(S, B, { r: 0.046, o: { mat: 'skin', col: '#e2b08e', region: 'neck' } });
  const H = head(S, B, { female: true, elf: true, skin: '#e4b292', eye: '#4a9a50', brow: '#7a3a1a', lips: '#b65a4e', jaw: 0.84 });
  const hairC = '#8a3a18';
  const hairBind = chainBind(B, ['hair', 'hair1', 'hair2'], 'head');
  S.with({ region: 'head' }, () => S.group({ k: 0 }, () => {
    S.ellipsoid(H.at(0, 0.03, -0.02), [0.09 * s, 0.098 * s, 0.1 * s], { mat: 'hair', col: hairC, disp: Detail.fur({ amp: 0.0025 * s, freq: 70, dir: [0, -0.3, -1] }) });
    S.box(H.at(0, -0.055, 0.03), [0.12 * s, 0.07 * s, 0.09 * s], { op: 'sub', k: 0.02 * s, mat: 'hair', col: hairC });
    S.box(H.at(0, 0.045, 0.105), [0.12 * s, 0.035 * s, 0.05 * s], { op: 'sub', k: 0.02 * s, rot: [0.5, 0, 0], mat: 'hair', col: hairC });
    // Stirnsträhnen
    for (const sx of [1, -1]) S.tube([H.at(sx * 0.02, 0.085, 0.07), H.at(sx * 0.06, 0.04, 0.085), H.at(sx * 0.075, -0.03, 0.07), H.at(sx * 0.07, -0.08, 0.05)], (t) => (0.012 - 0.008 * t) * s, { mat: 'hair', col: hairC, k: 0.006 * s });
  }));
  // Pferdeschwanz an der Haarkette
  {
    const h0 = [B.J.hair.pos.x, B.J.hair.pos.y, B.J.hair.pos.z];
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(add(h0, [0, -t * 0.34 * s, -0.03 * s - sin(t * 2.4) * 0.05 * s])); }
    for (let k = 0; k < 4; k++) S.tube(pts.map((p, i) => add(p, [0.01 * s * sin(i * 1.3 + k * 1.57), 0, 0.008 * s * cos(i * 1.3 + k * 1.57)])), (t) => (0.016 * (1 - 0.8 * t * t) + 0.002) * s, { mat: 'hair', col: hairC, bind: hairBind, k: 0.006 * s, disp: Detail.fur({ amp: 0.002 * s, freq: 110, dir: [0, -1, 0] }) });
    S.torus(add(h0, [0, -0.02 * s, -0.03 * s]), 0.02 * s, 0.006 * s, { mat: 'gold', col: gold, region: 'head' });
  }
  S.sym(() => handShape(S, B, { curl: 0.9, bulk: 0.92, o: { mat: 'leather', col: dleather, region: ['foreArmL', 'handL'] } }));

  // ---- Langbogen (linke Hand) ----
  const fr = weaponFrame(B, 'L', 'weaponL');
  const bow = longbow(S, fr, { s, bone: 'weaponL', wood: '#5a3a20', trim: gold, h: 0.7 });
  // Blattklingen an den Enden
  for (const sy of [1, -1]) {
    const tp = bow.pts[sy > 0 ? bow.pts.length - 1 : 0];
    S.ellipsoid(add(tp, fr.dir(0, sy * 0.03 * s, 0.015 * s)), [0.004 * s, 0.055 * s, 0.02 * s], { rot: fr.rot(sy * 0.5, 0, 0), mat: 'steel', col: '#c8d0c0', bone: 'weaponL', k: 0.003 * s });
  }
  // Sehne (zwischen weaponL und bowString überblendet)
  const nock = [B.J.bowString.pos.x, B.J.bowString.pos.y, B.J.bowString.pos.z];
  const tipT = bow.tipTop, tipB = bow.tipBot, yl = hypot(...sub(tipT, nock));
  const sw = (p) => { const d = min(hypot(...sub(p, tipT)), hypot(...sub(p, tipB))); const t = smooth(0, 1, d / yl); return [['weaponL', 1 - t], ['bowString', t]]; };
  S.layer('body:fine');
  S.capsule(tipT, nock, 0.0024 * s, { mat: 'silk', col: '#e8e0c8', bind: sw });
  S.capsule(nock, tipB, 0.0024 * s, { mat: 'silk', col: '#e8e0c8', bind: sw });
  // Pfeil (am Gelenk 'arrow', sichtbar beim Spannen)
  {
    const fo = P0(B.J.weaponL.pos), dir = norm(sub(fo, nock));
    const tip = add(nock, scl(dir, 0.72 * s));
    S.capsule(nock, tip, 0.0042 * s, { mat: 'wood', col: '#d9c49a', bone: 'arrow' });
    S.capsule(tip, add(tip, scl(dir, 0.045 * s)), 0.009 * s, 0.001 * s, { mat: 'steel', col: '#c0c8d0', bone: 'arrow' });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; const side = norm([cos(a), sin(a), 0]); S.ellipsoid(add(add(nock, scl(dir, 0.05 * s)), scl(side, 0.008 * s)), [0.003 * s, 0.006 * s, 0.03 * s], { rot: { x: norm([-side[1], side[0], 0]), y: side, z: dir }, mat: 'feather', col: '#e8e2d2', bone: 'arrow' }); }
  }
  // Glühende Runen auf den Wurfarmen + Kern am Griff
  S.layer('glow');
  for (const sy of [1, -1]) {
    const pts = []; for (let i = 3; i <= 7; i++) pts.push(add(bow.pts[sy > 0 ? 9 + i : 9 - i], fr.dir(0, 0, 0.016 * s)));
    S.tube(pts, 0.0028 * s, { mat: 'glow', col: glowC, glow: 2.6, bone: 'weaponL' });
  }
  S.sphere(fr.at(0, 0, 0.1 * s), 0.011 * s, { mat: 'glow', col: glowC, glow: 3.2, bone: 'weaponL' });
  S.layer('glass');
  S.prim(fr.at(0, 0, 0.096 * s), { f: (x, y, z) => { const ay = abs(y); return max(hypot(x, z) + ay * 0.45 - 0.014 * s, ay - 0.03 * s); }, box: [-0.02 * s, -0.035 * s, -0.02 * s, 0.02 * s, 0.035 * s, 0.02 * s] }, { rot: fr.basis, mat: 'crystal', col: '#c8ffb0', bone: 'weaponL' });
  S.layer('body');
  info.cores.push({ joint: 'weaponL', p: fr.at(0, 0, 0.1 * s), size: 0.14 });
  info.trails.push({ joint: 'weaponL', a: fr.at(0, -0.4 * s, 0.05 * s), b: fr.at(0, 0.6 * s, 0.05 * s) });
  return info;
}
const P0 = (v) => [v.x, v.y, v.z];
function frameRot(a, b, roll = 0) {
  const y = norm(sub(b, a));
  let x = norm([cos(roll), 0, sin(roll)]); x = norm(sub(x, scl(y, x[0] * y[0] + x[1] * y[1] + x[2] * y[2])));
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return { x, y, z };
}
void madd; void lerp3; void frame; void handFrame; void headInfo; void footShape; void runeLine; void Detail; void PI; void clamp;
