// Aether-Forge – Vasallen- und Gegner-Archetypen für die Draufsicht. Jede Linie eines Volks hat einen eigenen
// Grundkörper mit klarer Silhouette (große Waffen, Hüte, Schilde, Flügel, Panzer), kräftigen Farbflächen über die
// Palettenplätze (primary/secondary/metal/glow) und wenigen, starken Glühpunkten. Die Entwicklungsstufen setzt
// form.js darauf. Jede Funktion: build(S, P, F) → Bauplan { J, cls, radius, H, anchors }.
import { add, sub, scl, norm, lerp3, PI, TAU, frame, Detail, skirt, belt, cape, head, headInfo, pauldron, bracer, torsoShape } from './lib.js';
import { humanoid, fakeB, humanBody, bothSides, jp, plateTorso, helmet, simpleHand, simpleBoot, rotTo, quadSkeleton, quadCls, canine, steelA, V } from './units.js';
import { bladePrim, towerShield, staff, longbow } from './weapons.js';
import { crystalPrim } from './selene.js';
import { G, onLayer, humanAnchors, wing } from './form.js';

const { sin, cos, abs, max, min, hypot } = Math;
const A = {};
const glow = (S, fn) => onLayer(S, 'glow', fn);
const glass = (S, fn) => onLayer(S, 'glass', fn);
const T = (F) => F.tier;           // 1..3
const isB = (F) => F.path === 'b' && F.tier > 1;

// ---------------------------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------------------------
/** Humanoid mit kräftigen Proportionen; liefert { J, BL, BR, s } */
function hum(S, s, pose, o) {
  const J = humanoid(s, pose);
  const { BL, BR } = humanBody(S, J, s, o);
  return { J, BL, BR, s };
}
/** Robe (lang, gefaltet) */
function robe(S, BL, s, col, o = {}) {
  skirt(S, BL, { top: (o.top ?? 1.08) * s, bottom: o.bottom ?? 0.03, r0: o.r0 ?? 0.18, r1: o.r1 ?? 0.36, col, mat: o.mat || 'cloth', folds: o.folds ?? 10, fold: o.fold ?? 0.014, th: 0.02, hem: o.hem, hemW: 0.03, hemWave: o.hemWave });
}
/** Kapuze / Haube über dem Kopf */
function hood(S, BL, col, o = {}) {
  const H = headInfo(BL), s = H.s;
  S.shell({ off: 0.012 * s, th: 0.02 * s, mat: 'cloth', col, region: 'head', clip: (x, y, z) => -max(max(abs(x) - 0.07 * s, y - H.c[1] - 0.05 * s), -(z - H.c[2] - 0.035 * s)) }, () => {
    S.ellipsoid(H.at(0, 0.02, -0.02), [0.105, 0.125, 0.115], {});
    S.capsule(H.at(0, 0.08, -0.05), H.at(0, (o.tipY ?? 0.02), (o.tipZ ?? -0.2)), 0.055 * s, 0.01 * s, { k: 0.05 * s });
    S.ellipsoid([0, H.c[1] - 0.17 * s, H.c[2] - 0.02 * s], [0.25 * s, 0.11 * s, 0.2 * s], { k: 0.06 * s });
  });
  S.ellipsoid(H.at(0, -0.02, 0.0), [0.086, 0.1, 0.09], { mat: o.faceMat || 'cloth', col: o.face || '#0a080c', region: 'head' });
}
/** Augenpaar im Glühlayer */
function eyes(S, c, dx, r, reg, k = 3.6) { glow(S, () => { for (const sx of [1, -1]) S.sphere([c[0] + sx * dx, c[1], c[2]], r, G({ region: reg, glow: k })); }); }
/** Rad (Achse x) */
function wheel(S, c, R, w, o = {}) {
  S.cylinder(c, R, w, { rot: [0, 0, PI / 2], mat: o.mat || 'wood', col: o.col || '#5a3a20', region: o.region, r: 0.015 });
  S.torus(c, R, 0.035, { rot: [0, 0, PI / 2], mat: 'iron', col: o.rim || 'metal', region: o.region });
  S.cylinder(c, R * 0.25, w * 1.3, { rot: [0, 0, PI / 2], mat: 'brass', col: 'secondary', region: o.region, r: 0.01 });
}
/** Schwanz-/Wellenklassen */
function tailCls(c, names, L, amp = 0.08) { for (const n of names) c[n] = [5, 0, amp * L, 6 / L]; }
/** Vierbeiner-Anker */
export function quadAnchors(J, o = {}) {
  const P = (n) => [J[n].pos.x, J[n].pos.y, J[n].pos.z];
  return {
    head: { p: add(P('head'), [0, o.headUp ?? 0.14, o.headZ ?? 0.02]), r: o.headR ?? 0.1, region: ['head'] },
    back: { p: add(P('spine'), [0, o.backUp ?? 0.22, o.backZ ?? 0.15]), w: o.backW ?? 0.22, region: ['chest', 'spine'], parentJoint: 'chest' },
    shoulder: { p: add(P('flegL'), [o.shX ?? 0.06, o.shY ?? 0.2, 0.02]), r: o.shR ?? 0.12, region: ['chest', 'flegL'] },
  };
}
const plan = (J, o) => ({ J, ...o });

// =============================================================================================
// SONNENORDEN
// =============================================================================================
A.griffin = { H: 2.2, style: 'orden', build(S, P, F) {
  const J = quadSkeleton({ y: 0.82, zf: 0.3, zb: -0.45, w: 0.17, headP: [0, 1.5, 0.62] });
  J.neck.pos.y = 1.18; J.neck.pos.z = 0.5;
  const fur = { mat: 'fur', col: 'secondary*0.35', disp: Detail.fur({ amp: 0.01, freq: 16 }) };
  const fea = { mat: 'feather', col: 'primary', disp: Detail.fur({ amp: 0.006, freq: 30, dir: [0, -0.5, -1] }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.07 }, () => {
    S.ellipsoid(p('hips'), [0.24, 0.25, 0.27], { ...fur, col: '#b8925a', region: ['spine', 'hips'] });
    S.ellipsoid(p('spine'), [0.24, 0.26, 0.3], { ...fea, region: ['chest', 'spine'] });
    S.ellipsoid(add(p('chest'), [0, 0.08, 0.02]), [0.27, 0.32, 0.27], { ...fea, region: ['chest'] });
    S.capsule(p('chest'), p('neck'), 0.22, 0.15, { ...fea, region: ['chest', 'neck'] });
    S.ellipsoid(p('head'), [0.14, 0.15, 0.16], { ...fea, region: ['neck', 'head'] });
    for (const sd of ['L', 'R']) {
      S.capsule(p('fleg' + sd), p('fknee' + sd), 0.09, 0.05, { ...fea, region: ['chest', 'fleg' + sd, 'fknee' + sd] });
      S.capsule(p('fknee' + sd), p('fpaw' + sd), 0.045, 0.035, { mat: 'scale', col: 'metal', region: ['fknee' + sd, 'fpaw' + sd] });
      S.capsule(p('bleg' + sd), p('bknee' + sd), 0.13, 0.07, { ...fur, col: '#b8925a', region: ['hips', 'bleg' + sd, 'bknee' + sd] });
      S.capsule(p('bknee' + sd), p('bpaw' + sd), 0.06, 0.05, { ...fur, col: '#b8925a', region: ['bknee' + sd, 'bpaw' + sd] });
    }
    S.tube([p('tail'), p('tail1'), p('tail2')], [0.06, 0.04, 0.02], { ...fur, col: '#b8925a', region: ['hips', 'tail', 'tail1', 'tail2'] });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  for (const sd of ['L', 'R']) for (const n of ['fpaw', 'bpaw']) for (let k = 0; k < 3; k++) { const q = p(n + sd); S.capsule(add(q, [0, 0.02, 0.02]), add(q, [(k - 1) * 0.05, 0.0, 0.12]), 0.022, 0.006, { mat: 'horn', col: 'metal', region: [n + sd] }); }
  const h = p('head');
  S.capsule(add(h, [0, 0.0, 0.1]), add(h, [0, -0.1, 0.32]), 0.07, 0.012, { mat: 'horn', col: 'metal', region: ['head'], k: 0.02 });
  S.tube([add(h, [0, 0.05, -0.08]), add(h, [0, 0.14, -0.22]), add(h, [0, 0.12, -0.36])], [0.05, 0.03, 0.006], { ...fea, col: 'secondary', region: ['head'] });
  for (const sx of [1, -1]) S.sphere(add(h, [sx * 0.085, 0.04, 0.09]), 0.025, { mat: 'eye', col: '#f0c040', region: ['head'] });
  // Flügel: Stufe I angelegt, ab II halb, III-B übernimmt die Form-Schicht
  const spread = F.tier === 1 ? 0.15 : 0.45;
  const c = quadCls(J, 2.2, 0.36 * 2.2);
  if (!(F.tier >= 3 && F.path === 'b')) {
    for (const [sd, k] of [['L', 1], ['R', -1]]) {
      const root = [k * 0.18, 1.12, 0.12];
      J['wing' + sd] = { pos: V(...root), parent: 'chest' }; c['wing' + sd] = [4, root[0], root[1], 0];
    }
    S.sym(() => wing(S, [0.18, 1.12, 0.12], F.tier === 1 ? 0.8 : 1.05, { style: 'orden', region: ['wingL'], up: spread, col: 'primary' }));
  }
  if (isB(F)) glow(S, () => { S.capsule(add(h, [0, 0.12, -0.05]), add(h, [0, 0.28, -0.3]), 0.025, 0.006, G({ region: ['head'], glow: 3.2 })); });
  return plan(J, { cls: c, radius: 0.75, H: 2.0, anchors: { ...quadAnchors(J, { headUp: 0.16, backUp: 0.28, backZ: 0.2 }), shoulder: { p: [0.2, 1.08, 0.33], r: 0.13, region: ['chest', 'flegL'] } }, wingL: 1.3 });
} };

A.lancer = { H: 2.25, style: 'orden', build(S, P, F) {
  const s = 1.1;
  const { J, BL, BR } = hum(S, s, { sw: 1.08, armR: [[0.3, 1.12, 0.12], [0.3, 1.0, 0.3]], armL: [[0.31, 1.15, 0.1], [0.33, 1.08, 0.3]] }, { bulk: 1.1, armBulk: 1.15, legBulk: 1.1, base: { mat: 'mail', col: '#5c626c' }, torso: { mat: 'cloth', col: 'primary' } });
  J.weaponR = { pos: V(-0.3 * s, 1.0 * s, 0.32 * s), parent: 'handR' };
  J.weaponL = { pos: V(0.38 * s, 1.08 * s, 0.32 * s), parent: 'foreArmL' };
  plateTorso(S, BL, { col: 'metal', trim: 'secondary', bulk: 1.1 });
  bothSides(S, BL, BR, (B0) => { simpleBoot(S, B0, '#4a4e58'); simpleHand(S, B0, '#6a707a', 'steel'); });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.52 * s, r0: 0.2, r1: 0.27, col: 'secondary', folds: 8, fold: 0.01, th: 0.018, panels: [[0, 0.5], [PI, 0.5]] });
  helmet(S, BL, { col: 'metal' });
  const H = headInfo(BL);
  // Helmbusch (Feder) – lange Silhouette nach hinten
  S.tube([H.at(0, 0.12, 0.02), H.at(0, 0.24, -0.1), H.at(0, 0.2, -0.3), H.at(0, 0.06, -0.42)], [0.04 * s, 0.05 * s, 0.04 * s, 0.01 * s], { mat: 'feather', col: 'secondary', region: 'head', disp: Detail.fur({ amp: 0.006, freq: 30 }) });
  // Lanze: lang, schräg nach vorn; Wimpel
  const fr = frame(jp(J, 'weaponR'), [-0.12, 1, 0.45], [1, 0, 0]);
  const L = [2.0, 2.4, 2.7][T(F) - 1];
  S.capsule(fr.at(0, -0.5), fr.at(0, L), 0.03, 0.022, { mat: 'wood', col: '#e8dcc0', bone: 'weaponR' });
  S.capsule(fr.at(0, -0.05), fr.at(0, 0.25), 0.075, 0.035, { mat: 'steel', col: 'metal', bone: 'weaponR' });
  S.prim(fr.at(0, L - 0.05), bladePrim({ y0: 0, L: 0.42 + 0.1 * T(F), w: 0.07, th: 0.02, leaf: 0.3 }), { rot: fr.basis, mat: 'steel', col: '#d8dee6', bone: 'weaponR' });
  S.box(fr.at(0.0, L - 0.32, -0.16), [0.012, 0.16, 0.15], { rot: fr.basis, mat: 'cloth', col: 'secondary', bone: 'weaponR' });
  if (isB(F)) glow(S, () => S.capsule(fr.at(0, L), fr.at(0, L + 0.4 + 0.1 * T(F), 0.005), 0.02, 0.005, G({ bone: 'weaponR', glow: 3.4 })));
  // Drachenschild
  const sf = frame(jp(J, 'weaponL'), [0, 1, 0.1], [1, 0, -0.35]);
  const sc = 0.95 + 0.12 * T(F);
  S.prim(sf.o, { f: (x, y, z) => { const w = 0.24 * sc * max(0, 1 - max(0, -y) / (0.5 * sc)) ** 0.7; const top = 0.24 * sc; return max(max(abs(x) - max(0.01, w), y - top), max(-0.5 * sc - y, abs(z) - 0.02)); }, box: [-0.25 * sc, -0.5 * sc, -0.03, 0.25 * sc, 0.25 * sc, 0.03] }, { rot: sf.basis, mat: 'paint', col: 'primary', bone: 'weaponL' });
  S.capsule(sf.at(0, -0.4 * sc, 0.025), sf.at(0, 0.2 * sc, 0.025), 0.022, { mat: 'gold', col: 'metal', bone: 'weaponL' });
  S.capsule(sf.at(-0.18 * sc, 0.1 * sc, 0.025), sf.at(0.18 * sc, 0.1 * sc, 0.025), 0.02, { mat: 'gold', col: 'metal', bone: 'weaponL' });
  return plan(J, { radius: 0.62, H: 2.25, anchors: humanAnchors(J, s, { headTop: 0.24 }) });
} };

A.monk = { H: 2.0, style: 'orden', build(S, P, F) {
  const s = 1.02;
  const { J, BL, BR } = hum(S, s, { sw: 1.15, stance: 0.12, armR: [[0.28, 1.2, 0.22], [0.2, 1.38, 0.42]], armL: [[0.36, 1.12, 0.06], [0.28, 1.25, 0.24]] }, { bulk: 1.12, armBulk: 1.35, legBulk: 1.2, base: { mat: 'skin', col: '#c8906a' }, legs: { mat: 'cloth', col: 'primary' } });
  // weite Hose + Schärpe
  bothSides(S, BL, BR, (B0) => {
    S.capsule(jp(B0.J, 'thighL'), jp(B0.J, 'shinL'), 0.12 * s, 0.1 * s, { mat: 'cloth', col: 'primary', region: 'legL', k: 0.02 });
    S.capsule(jp(B0.J, 'shinL'), add(jp(B0.J, 'footL'), [0, 0.06, 0]), 0.1 * s, 0.06 * s, { mat: 'cloth', col: 'primary', region: 'legL', k: 0.02 });
    simpleBoot(S, B0, '#3a2a1e');
    // Faustwicklung
    S.capsule(jp(B0.J, 'foreArmL'), jp(B0.J, 'handL'), 0.055 * s, 0.05 * s, { mat: 'linen', col: '#e8dcc4', region: 'armL', k: 0.01 });
    S.sphere(add(jp(B0.J, 'handL'), [0, 0, 0.04]), 0.075 * s * (1 + 0.15 * (T(F) - 1)), { mat: 'linen', col: '#e8dcc4', region: 'armL' });
  });
  belt(S, BL, { dy: 0.05, rx: 0.2, rz: 0.15, col: 'secondary', mat: 'cloth', h: 0.09 });
  for (let i = 0; i < 2; i++) S.box(add(jp(J, 'hips'), [0.08 - i * 0.05, -0.15 - i * 0.05, 0.16]), [0.05, 0.16, 0.012], { rot: [0.1, 0, 0.1 - i * 0.2], mat: 'cloth', col: 'secondary', region: 'pelvis' });
  // Schärpe über die Brust
  S.capsule(add(jp(J, 'chest'), [0.16, 0.2, 0.1]), add(jp(J, 'hips'), [-0.16, 0.1, 0.13]), 0.04, { mat: 'cloth', col: 'secondary', region: 'torso' });
  head(S, BL, { skin: '#c8906a', eye: '#3a2a1a', brow: '#2a1a10', jaw: 1.05 });
  // Gebetsperlen
  for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; S.sphere(add(jp(J, 'neck'), [sin(a) * 0.13, -0.08 - cos(a) * 0.05, cos(a) * 0.1]), 0.028, { mat: 'wood', col: '#7a4a24', region: 'torso' }); }
  if (isB(F)) glow(S, () => { for (const sd of ['L', 'R']) S.sphere(add(jp(J, 'hand' + sd), [0, 0, 0.05]), 0.11 * s, G({ region: 'arm' + sd, glow: 2.8 })); });
  else if (T(F) >= 2) bothSides(S, BL, BR, (B0) => bracer(S, jp(B0.J, 'foreArmL'), jp(B0.J, 'handL'), 0.07, 0.065, { s, mat: 'gold', col: 'metal', region: 'armL', th: 0.02, rim: false }));
  return plan(J, { radius: 0.6, H: 2.0, anchors: humanAnchors(J, s, { headTop: 0.2 }) });
} };

A.ballista = { H: 1.7, style: 'orden', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.6, 0), parent: null }, chest: { pos: V(0, 0.9, 0.2), parent: 'hips' } };
  const sc = 1;
  const W = { mat: 'wood', col: '#8a5a32', region: ['hips'] };
  S.group({ k: 0.02 }, () => {
    S.box([0, 0.45, -0.1], [0.42, 0.1, 0.75], { ...W, r: 0.04 });
    S.box([0, 0.62, 0.1], [0.12, 0.14, 0.6], { ...W, r: 0.03 });
  });
  for (const sx of [1, -1]) for (const z of [0.4, -0.55]) wheel(S, [sx * 0.5, 0.32, z], 0.32, 0.06, { region: ['hips'] });
  // Bogenarme
  const L = [0.85, 1.05, 1.2][T(F) - 1];
  S.sym(() => S.tube([[0.08, 0.85, 0.55], [L * 0.6, 0.92, 0.42], [L, 0.95, 0.2]], [0.06, 0.05, 0.03], { mat: 'wood', col: '#e8dcc0', region: ['chest'] }));
  S.sym(() => S.capsule([L, 0.95, 0.2], [0.05, 0.92, -0.25], 0.012, { mat: 'leather', col: '#2a1a12', region: ['chest'] }));
  S.box([0, 0.86, 0.55], [0.14, 0.12, 0.08], { mat: 'steel', col: 'metal', region: ['chest'], r: 0.02 });
  // Bolzen
  S.capsule([0, 0.92, -0.3], [0, 0.92, 0.95], 0.03, { mat: 'wood', col: '#5a3a20', region: ['chest'] });
  S.capsule([0, 0.92, 0.95], [0, 0.92, 1.25], 0.07, 0.008, { mat: 'steel', col: 'metal', region: ['chest'] });
  // Sonnenscheibe als Schutzschild vorn
  S.cylinder([0, 0.9, 0.7], 0.32 + 0.06 * T(F), 0.025, { rot: [PI / 2, 0, 0], mat: 'gold', col: 'metal', region: ['chest'], r: 0.01 });
  S.cylinder([0, 0.9, 0.73], 0.16, 0.02, { rot: [PI / 2, 0, 0], mat: 'paint', col: 'secondary', region: ['chest'], r: 0.01 });
  if (isB(F)) glow(S, () => { S.capsule([0, 0.92, 0.95], [0, 0.92, 1.3], 0.05, 0.01, G({ region: ['chest'], glow: 3.4 })); S.sphere([0, 0.9, 0.76], 0.08, G({ region: ['chest'] })); });
  const cls = { hips: [0, 0, 0, 0], chest: [7, 0, 0.9, 0.0] };
  return plan(J, { cls, machine: true, radius: 0.8, H: 1.7, torsoW: 0, anchors: { head: { p: [0, 1.15, 0.3], r: 0.14, region: ['chest'] }, back: { p: [0, 0.75, -0.6], w: 0.35, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.42, 0.62, 0.0], r: 0.13, region: ['hips'] } } });
} };

// =============================================================================================
// WILDHERZ
// =============================================================================================
A.druid = { H: 2.25, style: 'wild', build(S, P, F) {
  const s = 1.05;
  const { J, BL, BR } = hum(S, s, { armR: [[0.3, 1.2, 0.12], [0.31, 1.1, 0.3]], armL: [[0.32, 1.16, 0.12], [0.26, 1.2, 0.32]] }, { female: true, base: { mat: 'leather', col: '#6a4a2c' }, torso: { mat: 'cloth', col: 'primary' } });
  J.weaponR = { pos: V(-0.31 * s, 1.1 * s, 0.32 * s), parent: 'handR' };
  bothSides(S, BL, BR, (B0) => simpleHand(S, B0, '#c8a080', 'skin'));
  robe(S, BL, s, 'primary', { r1: 0.34, hemWave: 0.03 });
  skirt(S, BL, { top: 1.12 * s, bottom: 0.45 * s, r0: 0.19, r1: 0.3, col: 'secondary', mat: 'leather', folds: 6, fold: 0.01, th: 0.018, slits: [0, 1.2, -1.2, PI] });
  // Blätter-Mantel um die Schultern
  for (let i = 0; i < 9; i++) { const a = -2.2 + i * 0.55; S.ellipsoid(add(jp(J, 'neck'), [sin(a) * 0.2, -0.08, cos(a) * 0.16]), [0.08, 0.025, 0.12], { rot: [0.5, a, 0], mat: 'leaf', col: i % 2 ? 'primary' : 'primary*0.7', region: 'upper' }); }
  const H = head(S, BL, { female: true, skin: '#c8a080', eye: '#3a6a2a', brow: false });
  hood(S, BL, 'primary*0.8', { face: '#c8a080', faceMat: 'skin' });
  // Geweih
  const sz = [0.8, 1, 1.2][T(F) - 1];
  S.sym(() => {
    const w = { mat: 'wood', col: '#d8c49a', region: 'head' };
    S.tube([H.at(0.06, 0.12, -0.02), H.at(0.16, 0.24 * sz, -0.04), H.at(0.26 * sz, 0.4 * sz, -0.08), H.at(0.3 * sz, 0.56 * sz, -0.1)], [0.02, 0.018, 0.012, 0.004], w);
    S.tube([H.at(0.16, 0.24 * sz, -0.04), H.at(0.26, 0.3 * sz, 0.06), H.at(0.3, 0.36 * sz, 0.1)], [0.014, 0.01, 0.004], w);
    S.tube([H.at(0.26 * sz, 0.4 * sz, -0.08), H.at(0.38 * sz, 0.44 * sz, -0.04)], [0.012, 0.004], w);
  });
  // Stab mit Blattkrone
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.05], [1, 0, 0]);
  const st = staff(S, fr, { len: 1.7, below: 0.62, wood: '#6a4a28', metal: 'metal', r: 0.024 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.capsule(fr.at(0, st.topY - 0.05), fr.at(cos(a) * 0.1, st.topY + 0.12, sin(a) * 0.1), 0.014, 0.005, { mat: 'wood', col: '#6a4a28', bone: 'weaponR' }); }
  glow(S, () => S.sphere(fr.at(0, st.topY + 0.08), 0.06 + 0.02 * T(F), G({ bone: 'weaponR', glow: 3.2 })));
  return plan(J, { radius: 0.58, H: 2.25, anchors: humanAnchors(J, s, { headTop: 0.24 }) });
} };

A.mushroom = { H: 1.9, style: 'wild', build(S, P, F) {
  const J = humanoid(0.75, { sw: 1.3, armR: [[0.32, 1.0, 0.12], [0.36, 0.8, 0.22]], armL: [[0.32, 1.0, 0.12], [0.36, 0.8, 0.22]] });
  const p = (n) => jp(J, n);
  const stem = { mat: 'skin', col: '#e8dcc0' };
  S.group({ k: 0.06 }, () => {
    S.capsule([0, 0.1, 0], [0, 1.2, 0], 0.3, 0.22, { ...stem, region: 'torso' });
    S.ellipsoid([0, 0.22, 0], [0.38, 0.22, 0.36], { ...stem, region: 'torso' });
    for (const sd of ['L', 'R']) S.capsule(p('upperArm' + sd), p('hand' + sd), 0.07, 0.05, { ...stem, region: 'arm' + sd });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  for (const sd of ['L', 'R']) S.sphere(p('hand' + sd), 0.08, { ...stem, region: 'arm' + sd });
  // Gesicht
  for (const sx of [1, -1]) S.sphere([sx * 0.1, 0.95, 0.24], 0.045, { mat: 'eye', col: '#1a1410', region: 'torso' });
  S.ellipsoid([0, 0.84, 0.25], [0.06, 0.02, 0.02], { mat: 'cloth', col: '#3a2a20', region: 'torso' });
  // Hut: großer runder Schirm mit Tupfen
  const R = [0.62, 0.74, 0.86][T(F) - 1];
  const capY = 1.32;
  S.group({ k: 0.04 }, () => {
    S.ellipsoid([0, capY, 0], [R, 0.36 + 0.04 * T(F), R], { mat: 'lacquer', col: F.path === 'b' && T(F) > 1 ? '#7a3ac8' : '#c8342f', region: 'head' });
    S.ellipsoid([0, capY - 0.16, 0], [R * 0.92, 0.12, R * 0.92], { op: 'sub', mat: 'skin', col: '#d8c8a8', region: 'head' });
  });
  S.ellipsoid([0, capY - 0.13, 0], [R * 0.8, 0.06, R * 0.8], { mat: 'skin', col: '#c8b898', region: 'head' });
  for (let i = 0; i < 9; i++) { const a = i * 2.39996, rr = R * (0.25 + 0.6 * ((i * 0.37) % 1)); const y = capY + 0.34 * (1 - (rr / R) ** 2) ** 0.5; S.ellipsoid([sin(a) * rr, y, cos(a) * rr], [0.08, 0.04, 0.08], { mat: 'cloth', col: '#f0e8d8', region: 'head' }); }
  if (isB(F)) glow(S, () => { for (let i = 0; i < 6; i++) { const a = i * 1.05; S.sphere([sin(a) * R * 0.75, capY - 0.12, cos(a) * R * 0.75], 0.05, G({ region: 'head', glow: 3 })); } });
  // kleine Begleitpilze am Fuß
  for (const [x, z, r] of [[0.35, 0.25, 0.12], [-0.4, -0.1, 0.1]]) { S.capsule([x, 0, z], [x, r * 1.6, z], r * 0.4, { ...stem, region: 'torso' }); S.ellipsoid([x, r * 1.7, z], [r, r * 0.6, r], { mat: 'lacquer', col: '#c8342f', region: 'torso' }); }
  const cls = { head: [3, 0, 1.1, 0] };
  return plan(J, { cls, radius: 0.62, H: 1.9, torsoW: 0.5, anchors: { head: { p: [0, capY + 0.36, 0], r: 0.16, region: 'head' }, back: { p: [0, 0.95, -0.25], w: 0.25, region: 'torso', parentJoint: 'chest' }, shoulder: { p: [0.26, 1.02, 0], r: 0.09, region: 'shoulderL' } } });
} };

A.bear = { H: 1.8, style: 'wild', build(S, P, F) {
  const J = quadSkeleton({ y: 0.82, zf: 0.35, zb: -0.4, w: 0.26, headP: [0, 1.05, 0.88] });
  J.neck.pos.y = 1.05; J.neck.pos.z = 0.62;
  const fur = { mat: 'fur', col: 'secondary', disp: Detail.fur({ amp: 0.018, freq: 14 }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.1 }, () => {
    S.ellipsoid(add(p('chest'), [0, 0.12, 0]), [0.42, 0.42, 0.42], { ...fur, region: ['chest', 'spine'] });
    S.ellipsoid(p('spine'), [0.4, 0.36, 0.44], { ...fur, region: ['chest', 'spine', 'hips'] });
    S.ellipsoid(p('hips'), [0.36, 0.34, 0.32], { ...fur, region: ['spine', 'hips'] });
    S.capsule(p('chest'), p('head'), 0.26, 0.2, { ...fur, region: ['chest', 'neck', 'head'] });
    S.ellipsoid(p('head'), [0.2, 0.18, 0.2], { ...fur, region: ['head'] });
    S.capsule(add(p('head'), [0, -0.04, 0.1]), add(p('head'), [0, -0.07, 0.28]), 0.1, 0.07, { ...fur, col: 'secondary*1.3', region: ['head'] });
    for (const sx of [1, -1]) S.sphere(add(p('head'), [sx * 0.13, 0.15, -0.03]), 0.065, { ...fur, region: ['head'] });
    for (const sd of ['L', 'R']) {
      S.capsule(p('fleg' + sd), p('fknee' + sd), 0.16, 0.12, { ...fur, region: ['chest', 'fleg' + sd, 'fknee' + sd] });
      S.capsule(p('fknee' + sd), add(p('fpaw' + sd), [0, 0.02, 0.04]), 0.12, 0.11, { ...fur, region: ['fknee' + sd, 'fpaw' + sd] });
      S.capsule(p('bleg' + sd), p('bknee' + sd), 0.19, 0.12, { ...fur, region: ['hips', 'bleg' + sd, 'bknee' + sd] });
      S.capsule(p('bknee' + sd), add(p('bpaw' + sd), [0, 0.02, 0.04]), 0.12, 0.11, { ...fur, region: ['bknee' + sd, 'bpaw' + sd] });
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  S.ellipsoid(add(p('head'), [0, -0.04, 0.35]), [0.045, 0.035, 0.03], { mat: 'leather', col: '#101010', region: ['head'] });
  for (const sx of [1, -1]) S.sphere(add(p('head'), [sx * 0.09, 0.06, 0.16]), 0.025, { mat: 'eye', col: '#1a1008', region: ['head'] });
  for (const sd of ['L', 'R']) for (const n of ['fpaw', 'bpaw']) for (let k = 0; k < 3; k++) S.capsule(add(p(n + sd), [(k - 1) * 0.06, 0.04, 0.12]), add(p(n + sd), [(k - 1) * 0.07, 0.0, 0.2]), 0.02, 0.006, { mat: 'horn', col: '#e8dcc0', region: [n + sd] });
  // Stufe: Moos/Rindenpanzer auf dem Rücken ab II
  if (T(F) >= 2 && F.path === 'a') S.shell({ off: 0.03, th: 0.04, mat: 'bark', col: '#5a3a22', region: ['chest', 'spine'], clip: (x, y, z) => 1.05 - y, disp: Detail.bark({ amp: 0.01, n: 12, freq: 8 }) }, () => S.ellipsoid(p('spine'), [0.42, 0.4, 0.5], {}));
  if (T(F) >= 2 && F.path === 'b') { for (let i = 0; i < 5; i++) glass(S, () => S.prim([(i - 2) * 0.12, 1.12 - abs(i - 2) * 0.05, -0.1 + abs(i - 2) * 0.05], crystalPrim(0.05, 0.25 + 0.05 * (i % 2)), { rot: [-0.3, 0, -(i - 2) * 0.3], mat: 'crystal', col: 'glow', region: ['chest', 'spine'] })); }
  return plan(J, { cls: quadCls(J, 1.8, 0.42 * 1.8), radius: 0.85, H: 1.8, anchors: quadAnchors(J, { headUp: 0.2, backUp: 0.38, backZ: 0.25, backW: 0.36, shY: 0.3, shR: 0.16 }) });
} };

A.owl = { H: 2.0, style: 'wild', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.55, 0), parent: null }, spine: { pos: V(0, 0.8, 0), parent: 'hips' }, chest: { pos: V(0, 1.05, 0.02), parent: 'spine' }, neck: { pos: V(0, 1.3, 0.04), parent: 'chest' }, head: { pos: V(0, 1.45, 0.05), parent: 'neck' },
    thighL: { pos: V(0.14, 0.45, 0.05), parent: 'hips' }, shinL: { pos: V(0.15, 0.2, 0.08), parent: 'thighL' }, footL: { pos: V(0.15, 0.04, 0.12), parent: 'shinL' },
    thighR: { pos: V(-0.14, 0.45, 0.05), parent: 'hips' }, shinR: { pos: V(-0.15, 0.2, 0.08), parent: 'thighR' }, footR: { pos: V(-0.15, 0.04, 0.12), parent: 'shinR' } };
  const fea = { mat: 'feather', col: 'secondary', disp: Detail.fur({ amp: 0.008, freq: 26, dir: [0, -1, 0.2] }) };
  S.group({ k: 0.12 }, () => {
    S.ellipsoid([0, 0.85, 0], [0.4, 0.5, 0.36], { ...fea, region: ['hips', 'spine', 'chest'] });
    S.ellipsoid([0, 1.42, 0.04], [0.34, 0.3, 0.3], { ...fea, region: ['neck', 'head'] });
  });
  S.ellipsoid([0, 0.88, 0.18], [0.28, 0.38, 0.2], { mat: 'feather', col: '#e8dcc0', region: ['spine', 'chest'], disp: Detail.fur({ amp: 0.006, freq: 30 }) });
  // Gesichtsscheibe + große Augen
  for (const sx of [1, -1]) {
    S.ellipsoid([sx * 0.12, 1.43, 0.24], [0.13, 0.13, 0.06], { mat: 'feather', col: '#e8dcc0', region: ['head'] });
    S.sphere([sx * 0.12, 1.44, 0.29], 0.065, { mat: 'eye', col: '#f0b020', region: ['head'] });
    S.sphere([sx * 0.12, 1.44, 0.34], 0.03, { mat: 'eye', col: '#0a0806', region: ['head'] });
    S.tube([[sx * 0.2, 1.62, 0.05], [sx * 0.27, 1.8, 0.0], [sx * 0.3, 1.95, -0.05]], [0.06, 0.04, 0.008], { ...fea, region: ['head'] });
  }
  S.capsule([0, 1.4, 0.3], [0, 1.32, 0.36], 0.035, 0.008, { mat: 'horn', col: 'metal', region: ['head'] });
  for (const sd of ['L', 'R']) { const f = jp(J, 'foot' + sd); S.capsule(jp(J, 'thigh' + sd), f, 0.05, 0.035, { mat: 'scale', col: 'metal', region: ['thigh' + sd, 'foot' + sd] }); for (let k = 0; k < 3; k++) S.capsule(f, add(f, [(k - 1) * 0.06, -0.02, 0.12]), 0.02, 0.006, { mat: 'horn', col: '#2a2420', region: ['foot' + sd] }); }
  // angelegte Flügel (Seiten) bzw. ausgebreitet ab II
  const c = {};
  if (!(F.tier >= 3 && F.path === 'b')) for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const root = [k * 0.32, 1.15, -0.05];
    J['wing' + sd] = { pos: V(...root), parent: 'chest' }; c['wing' + sd] = [4, root[0], root[1], 0];
  }
  if (F.tier === 1) S.sym(() => S.ellipsoid([0.34, 0.85, -0.05], [0.12, 0.42, 0.26], { rot: [0.15, 0, 0.12], ...fea, col: 'secondary*0.8', region: ['wingL'] }));
  else if (!(F.tier >= 3 && F.path === 'b')) S.sym(() => wing(S, [0.32, 1.15, -0.05], 1.1, { style: 'orden', region: ['wingL'], up: 0.35, col: 'secondary' }));
  // Stab-Feder (Seherin): Glühmuster
  if (isB(F)) glow(S, () => { S.torus([0, 1.44, 0.22], 0.28, 0.012, { rot: [PI / 2, 0, 0], ...G({ region: ['head'], glow: 2.6 }) }); });
  return plan(J, { cls: c, radius: 0.6, H: 2.0, hipY: 0.55, anchors: { head: { p: [0, 1.72, 0.04], r: 0.14, region: ['head'] }, back: { p: [0, 1.15, -0.32], w: 0.3, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.3, 1.18, 0.0], r: 0.12, region: ['chest'] } }, wingL: 1.3 });
} };

A.stag = { H: 2.3, style: 'wild', build(S, P, F) {
  const J = quadSkeleton({ y: 0.95, zf: 0.32, zb: -0.42, w: 0.13, headP: [0, 1.58, 0.72] });
  J.neck.pos.y = 1.25; J.neck.pos.z = 0.55;
  J.tail.pos = V(0, 1.02, -0.6); J.tail1.pos = V(0, 0.95, -0.68); J.tail2.pos = V(0, 0.85, -0.7);
  const fur = { mat: 'fur', col: 'secondary*1.4', disp: Detail.fur({ amp: 0.006, freq: 24 }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.07 }, () => {
    S.ellipsoid(p('chest'), [0.2, 0.25, 0.26], { ...fur, region: ['chest', 'spine'] });
    S.ellipsoid(p('spine'), [0.18, 0.22, 0.32], { ...fur, region: ['chest', 'spine', 'hips'] });
    S.ellipsoid(p('hips'), [0.19, 0.22, 0.22], { ...fur, region: ['spine', 'hips'] });
    S.capsule(p('chest'), p('neck'), 0.15, 0.1, { ...fur, region: ['chest', 'neck'] });
    S.capsule(p('neck'), p('head'), 0.1, 0.09, { ...fur, region: ['neck', 'head'] });
    S.capsule(p('head'), add(p('head'), [0, -0.1, 0.24]), 0.09, 0.05, { ...fur, region: ['head'] });
    for (const sd of ['L', 'R']) {
      S.capsule(p('fleg' + sd), p('fknee' + sd), 0.07, 0.035, { ...fur, region: ['chest', 'fleg' + sd, 'fknee' + sd] });
      S.capsule(p('fknee' + sd), p('fpaw' + sd), 0.032, 0.025, { ...fur, region: ['fknee' + sd, 'fpaw' + sd] });
      S.capsule(p('bleg' + sd), p('bknee' + sd), 0.1, 0.04, { ...fur, region: ['hips', 'bleg' + sd, 'bknee' + sd] });
      S.capsule(p('bknee' + sd), p('bpaw' + sd), 0.032, 0.025, { ...fur, region: ['bknee' + sd, 'bpaw' + sd] });
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  S.ellipsoid(add(p('chest'), [0, -0.02, 0.18]), [0.14, 0.2, 0.1], { mat: 'fur', col: '#efe6d4', region: ['chest'], disp: Detail.fur({ amp: 0.01, freq: 20, dir: [0, -1, 0] }) });
  S.ellipsoid(add(p('hips'), [0, 0.0, -0.18]), [0.1, 0.1, 0.06], { mat: 'fur', col: '#efe6d4', region: ['hips'] });
  for (const sd of ['L', 'R']) for (const n of ['fpaw', 'bpaw']) S.ellipsoid(add(p(n + sd), [0, -0.02, 0.02]), [0.035, 0.035, 0.045], { mat: 'horn', col: '#201810', region: [n + sd] });
  for (const sx of [1, -1]) { S.sphere(add(p('head'), [sx * 0.07, 0.03, 0.08]), 0.02, { mat: 'eye', col: '#1a1008', region: ['head'] }); S.ellipsoid(add(p('head'), [sx * 0.11, 0.08, -0.04]), [0.04, 0.025, 0.07], { rot: [0, sx * 0.6, sx * 0.5], ...fur, region: ['head'] }); }
  // Geweih: die Silhouette (wächst mit der Stufe)
  const g = [0.75, 1.0, 1.3][T(F) - 1];
  const h = add(p('head'), [0, 0.08, -0.02]);
  S.sym(() => {
    const w = { mat: 'wood', col: isB(F) ? 'metal' : '#e0d0b0', region: ['head'] };
    const a0 = add(h, [0.05, 0, 0]), a1 = add(h, [0.2 * g, 0.22 * g, -0.08 * g]), a2 = add(h, [0.32 * g, 0.48 * g, -0.12 * g]), a3 = add(h, [0.42 * g, 0.7 * g, -0.08 * g]);
    S.tube([a0, a1, a2, a3], [0.028, 0.024, 0.016, 0.006], w);
    for (const [b, d] of [[a1, [0.06, 0.2, 0.14]], [a2, [0.0, 0.22, 0.12]], [a2, [0.2, 0.12, -0.04]], [lerp3(a2, a3, 0.5), [0.14, 0.16, 0.06]]]) S.capsule(b, add(b, scl(d, g)), 0.014, 0.004, w);
  });
  if (isB(F)) glow(S, () => { S.sym(() => S.sphere(add(h, [0.42 * g, 0.72 * g, -0.08 * g]), 0.035, G({ region: ['head'], glow: 3.4 }))); S.sphere(add(p('head'), [0, 0.1, 0.12]), 0.035, G({ region: ['head'] })); });
  return plan(J, { cls: quadCls(J, 2.3, 0.42 * 2.3), radius: 0.7, H: 2.3, anchors: { ...quadAnchors(J, { headUp: 0.16, backUp: 0.22, backZ: 0.12, backW: 0.2 }), head: { p: add(p('neck'), [0, 0.18, -0.04]), r: 0.09, region: ['neck'] } } });
} };

A.dryad = { H: 2.2, style: 'wild', build(S, P, F) {
  // Rankenseele: schwebender Oberkörper, Unterleib als gedrehte Wurzelranken, Blätterhaar, Leuchtkern
  const s = 1.0;
  const J = humanoid(s, { armR: [[0.34, 1.32, 0.12], [0.44, 1.42, 0.28]], armL: [[0.34, 1.32, 0.12], [0.44, 1.42, 0.28]] });
  for (const k of Object.keys(J)) J[k].pos.y += 0.15;
  const BL = fakeB(J, s), BR = fakeB(J, s, true);
  const bark = { mat: 'bark', col: 'secondary', disp: Detail.bark({ amp: 0.008, n: 10, freq: 14 }) };
  torsoShape(S, BL, { female: true, bulk: 0.95, o: { ...bark, col: 'primary*0.7', region: 'torso' } });
  bothSides(S, BL, BR, (B0) => {
    S.capsule(jp(B0.J, 'upperArmL'), jp(B0.J, 'foreArmL'), 0.045, 0.035, { ...bark, region: 'armL' });
    S.capsule(jp(B0.J, 'foreArmL'), jp(B0.J, 'handL'), 0.035, 0.025, { ...bark, region: 'armL' });
    for (let k = 0; k < 3; k++) S.capsule(jp(B0.J, 'handL'), add(jp(B0.J, 'handL'), [0.05 + k * 0.03, 0.08, 0.06 - k * 0.04]), 0.014, 0.004, { ...bark, region: 'armL' });
  });
  const H = head(S, BL, { female: true, skin: '#7a9a5a', eye: '#d0ff8a', brow: false, lips: '#4a6a3a' });
  // Wurzel-Unterleib: drei gedrehte Ranken bis zum Boden
  const top = jp(J, 'hips');
  for (let r = 0; r < 3; r++) {
    const pts = [], rr = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, a = r * 2.1 + t * 3.2; pts.push([sin(a) * (0.08 + 0.32 * t), top[1] - t * (top[1] - 0.04), cos(a) * (0.08 + 0.32 * t) - 0.05]); rr.push(0.1 - 0.075 * t); }
    S.tube(pts, rr, { ...bark, region: ['hips'], kj: 0.03 });
  }
  // Blätterhaar
  for (let i = 0; i < 11; i++) { const a = -2.4 + i * 0.48; S.ellipsoid(H.at(sin(a) * 0.12, 0.08 - 0.08 * abs(a) / 2.4, -0.03 + cos(a) * 0.1 - 0.06), [0.05, 0.12, 0.022], { rot: [0.9, a, 0], mat: 'leaf', col: i % 2 ? 'primary' : 'primary*1.3', region: 'head' }); }
  glow(S, () => { S.sphere(add(jp(J, 'chest'), [0, 0.05, 0.13]), 0.06 + 0.02 * T(F), G({ region: 'torso', glow: 3.4 })); for (const sd of ['L', 'R']) S.sphere(add(jp(J, 'hand' + sd), [0, 0.04, 0.03]), 0.05, G({ region: 'arm' + sd, glow: 3 })); });
  const cls = { hips: [5, 0, 0.12, 1.5] };
  return plan(J, { cls, radius: 0.55, H: 2.2, anchors: humanAnchors(J, s, { headTop: 0.22 }) });
} };

// =============================================================================================
// ÄTHERSCHMIEDE
// =============================================================================================
function mechLeg(S, hip, knee, foot, r, reg) {
  S.capsule(hip, knee, r, r * 0.8, { mat: 'steel', col: 'metal', region: reg });
  S.sphere(knee, r * 1.15, { mat: 'brass', col: 'secondary', region: reg });
  S.capsule(knee, foot, r * 0.8, r * 0.6, { mat: 'iron', col: '#3a3e46', region: reg });
  S.box([foot[0], 0.04, foot[2] + 0.04], [r * 1.4, 0.04, r * 2.2], { mat: 'steel', col: 'metal', region: reg, r: 0.02 });
}
A.walker = { H: 2.1, style: 'schmiede', build(S, P, F) {
  const J = { hips: { pos: V(0, 1.15, 0), parent: null }, chest: { pos: V(0, 1.45, 0.05), parent: 'hips' } };
  const c = { chest: [7, 0, 1.3, 0] };
  for (const [sd, k] of [['L', 1], ['R', -1]]) {
    J['thigh' + sd] = { pos: V(k * 0.28, 1.1, 0), parent: 'hips' }; J['shin' + sd] = { pos: V(k * 0.36, 0.62, 0.3), parent: 'thigh' + sd }; J['foot' + sd] = { pos: V(k * 0.32, 0.08, -0.05), parent: 'shin' + sd };
    mechLeg(S, jp(J, 'thigh' + sd), jp(J, 'shin' + sd), jp(J, 'foot' + sd), 0.08, ['thigh' + sd, 'shin' + sd, 'foot' + sd]);
  }
  // Kabine
  S.group({ k: 0.03 }, () => {
    S.box([0, 1.32, 0], [0.36, 0.22, 0.34], { mat: 'paint', col: 'primary', region: ['hips'], r: 0.08 });
    S.box([0, 1.55, 0.05], [0.28, 0.12, 0.26], { mat: 'paint', col: 'primary', region: ['chest'], r: 0.06 });
  });
  S.box([0, 1.4, 0.34], [0.2, 0.06, 0.02], { mat: 'iron', col: '#101014', region: ['chest'], r: 0.01 });
  for (const sx of [1, -1]) S.cylinder([sx * 0.38, 1.25, 0], 0.11, 0.05, { rot: [0, 0, PI / 2], mat: 'brass', col: 'secondary', region: ['hips'], r: 0.01 });
  // Repetierarmbrust oben
  const L = [0.55, 0.75, 0.9][T(F) - 1];
  S.box([0, 1.72, 0.25], [0.08, 0.06, 0.4], { mat: 'steel', col: 'metal', region: ['chest'], r: 0.02 });
  S.sym(() => S.tube([[0.05, 1.72, 0.55], [L * 0.6, 1.75, 0.45], [L, 1.78, 0.25]], [0.04, 0.035, 0.02], { mat: 'steel', col: 'metal', region: ['chest'] }));
  if (T(F) >= 2) S.box([0, 1.85, 0.05], [0.1, 0.08, 0.16], { mat: 'brass', col: 'secondary', region: ['chest'], r: 0.02 });
  glow(S, () => { S.box([0, 1.4, 0.36], [0.16, 0.03, 0.01], G({ region: ['chest'], glow: 3.4 })); if (isB(F)) S.capsule([0, 1.72, 0.6], [0, 1.72, 0.95], 0.03, 0.006, G({ region: ['chest'], glow: 3.4 })); });
  return plan(J, { cls: c, radius: 0.62, H: 2.1, hipY: 1.1, anchors: { head: { p: [0, 1.95, 0.0], r: 0.12, region: ['chest'] }, back: { p: [0, 1.45, -0.32], w: 0.3, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.34, 1.5, 0.0], r: 0.11, region: ['hips'] } } });
} };

A.mortar = { H: 1.6, style: 'schmiede', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.6, 0), parent: null }, chest: { pos: V(0, 0.9, 0.1), parent: 'hips' } };
  S.group({ k: 0.03 }, () => {
    S.box([0, 0.48, 0], [0.45, 0.14, 0.62], { mat: 'paint', col: 'primary', region: ['hips'], r: 0.06 });
    S.box([0, 0.66, -0.35], [0.3, 0.12, 0.18], { mat: 'iron', col: '#3a3e46', region: ['hips'], r: 0.04 });
  });
  for (const sx of [1, -1]) for (const z of [0.38, -0.38]) wheel(S, [sx * 0.52, 0.3, z], 0.3, 0.07, { mat: 'iron', col: '#3a3e46', region: ['hips'] });
  // Mörserrohr (dick, steil)
  const R = [0.2, 0.25, 0.3][T(F) - 1];
  const base = [0, 0.75, 0.1], tip = [0, 1.25 + 0.15 * T(F), 0.5];
  S.sphere(base, R * 1.4, { mat: 'brass', col: 'secondary', region: ['chest'] });
  S.capsule(base, tip, R * 1.1, R, { mat: 'steel', col: 'metal', region: ['chest'] });
  S.torus(tip, R * 1.05, 0.04, { rot: rotTo(sub(tip, base)), mat: 'brass', col: 'secondary', region: ['chest'] });
  S.capsule(add(tip, [0, 0.02, 0.01]), add(tip, [0, 0.4, 0.3]), R * 0.82, { op: 'sub', mat: 'iron', col: '#101010', region: ['chest'] });
  for (let i = 0; i < 3; i++) S.torus(lerp3(base, tip, 0.25 + i * 0.22), R * 1.12, 0.025, { rot: rotTo(sub(tip, base)), mat: 'iron', col: '#2a2a30', region: ['chest'] });
  // Kessel + Schornstein
  S.cylinder([0, 0.82, -0.4], 0.18, 0.18, { mat: 'brass', col: 'secondary', region: ['hips'], r: 0.04 });
  S.capsule([0.18, 0.85, -0.45], [0.2, 1.3, -0.5], 0.05, { mat: 'iron', col: '#2a2a30', region: ['hips'] });
  glow(S, () => { S.sphere([0.2, 1.33, -0.5], 0.06, G({ region: ['hips'], glow: 3.2 })); S.sphere(tip, R * 0.7, G({ region: ['chest'], glow: isB(F) ? 3.6 : 2.4 })); S.box([0, 0.82, -0.2], [0.1, 0.04, 0.02], G({ region: ['hips'] })); });
  const cls = { hips: [0, 0, 0, 0], chest: [7, 0, 0.75, 0.1] };
  return plan(J, { cls, machine: true, radius: 0.72, H: 1.6, torsoW: 0, anchors: { head: null, back: { p: [0, 0.7, -0.6], w: 0.35, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.42, 0.62, 0.15], r: 0.12, region: ['hips'] } } });
} };

A.core = { H: 2.0, style: 'schmiede', hover: true, build(S, P, F) {
  const J = { hips: { pos: V(0, 1.0, 0), parent: null }, chest: { pos: V(0, 1.2, 0), parent: 'hips' } };
  const r = [0.26, 0.32, 0.38][T(F) - 1];
  glass(S, () => S.prim([0, 1.0 - r * 1.2, 0], crystalPrim(r, r * 3.2), { mat: 'crystal', col: 'glow', region: ['hips'] }));
  glow(S, () => S.sphere([0, 1.1, 0], r * 0.55, G({ region: ['hips'], glow: 4 })));
  // Messing-Ringe (gekippt) + Klammern
  S.torus([0, 1.1, 0], r * 1.9, 0.04, { rot: [0.5, 0, 0.25], mat: 'brass', col: 'secondary', region: ['chest'] });
  S.torus([0, 1.1, 0], r * 1.6, 0.035, { rot: [-0.3, 0, -0.6], mat: 'steel', col: 'metal', region: ['chest'] });
  if (T(F) >= 2) S.torus([0, 1.1, 0], r * 2.2, 0.03, { rot: [PI / 2, 0, 0], mat: 'brass', col: 'secondary', region: ['chest'] });
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; S.capsule([sin(a) * r * 0.5, 1.1 - r * 1.5, cos(a) * r * 0.5], [sin(a) * r * 1.2, 0.35, cos(a) * r * 1.2], 0.03, 0.02, { mat: 'steel', col: 'metal', region: ['hips'] }); S.sphere([sin(a) * r * 1.2, 0.33, cos(a) * r * 1.2], 0.05, { mat: 'brass', col: 'secondary', region: ['hips'] }); }
  const cls = { hips: [0, 0, 0, 0], chest: [0, 0, 0, 0] };
  return plan(J, { cls, machine: true, radius: 0.55, H: 2.0, torsoW: 0, anchors: { head: { p: [0, 1.1 + r * 2.2, 0], r: 0.1, region: ['hips'] }, back: { p: [0, 1.15, -r * 1.2], w: 0.2, region: ['hips'], parentJoint: 'hips' }, shoulder: null } });
} };

A.spider = { H: 1.4, style: 'schmiede', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.7, -0.25), parent: null }, chest: { pos: V(0, 0.75, 0.2), parent: 'hips' }, head: { pos: V(0, 0.75, 0.5), parent: 'chest' } };
  S.group({ k: 0.04 }, () => {
    S.ellipsoid([0, 0.75, -0.3], [0.38, 0.28, 0.42], { mat: 'paint', col: 'primary', region: ['hips'] });
    S.ellipsoid([0, 0.72, 0.22], [0.26, 0.2, 0.26], { mat: 'steel', col: 'metal', region: ['chest'] });
    S.ellipsoid([0, 0.7, 0.5], [0.16, 0.13, 0.14], { mat: 'paint', col: 'primary', region: ['head'] });
  });
  for (const sx of [1, -1]) S.capsule([sx * 0.06, 0.64, 0.6], [sx * 0.1, 0.5, 0.72], 0.03, 0.01, { mat: 'steel', col: 'metal', region: ['head'] });
  const cls = { head: [7, 0, 0.72, 0.3], hips: [6, 0, 0.3, 0], chest: [6, 0, 0.3, 0] };
  for (let i = 0; i < 4; i++) for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const n = `mleg${i}${sd}`, z = 0.35 - i * 0.24;
    const root = [k * 0.22, 0.72, z], knee = [k * 0.62, 1.0, z + (i - 1.5) * 0.12], foot = [k * 0.92, 0.0, z + (i - 1.5) * 0.3];
    J[n] = { pos: V(...root), parent: 'chest' };
    S.capsule(root, knee, 0.05, 0.04, { mat: 'steel', col: 'metal', region: [n] });
    S.sphere(knee, 0.055, { mat: 'brass', col: 'secondary', region: [n] });
    S.capsule(knee, foot, 0.04, 0.012, { mat: 'iron', col: '#3a3e46', region: [n] });
    cls[n] = [9, (k > 0 ? 0 : PI) + i * PI, k * 0.22, z];
  }
  // Teslaspule auf dem Rücken
  const hh = [0.3, 0.42, 0.55][T(F) - 1];
  S.capsule([0, 0.95, -0.3], [0, 0.95 + hh, -0.3], 0.07, 0.05, { mat: 'copper', col: 'secondary', region: ['hips'] });
  for (let i = 0; i < 3; i++) S.torus([0, 1.0 + i * hh * 0.33, -0.3], 0.12 - i * 0.015, 0.025, { rot: [PI / 2, 0, 0], mat: 'copper', col: 'secondary', region: ['hips'] });
  glow(S, () => { S.sphere([0, 1.02 + hh, -0.3], 0.1 + (isB(F) ? 0.04 : 0), G({ region: ['hips'], glow: 3.6 })); for (const sx of [1, -1]) for (const dz of [0, 0.06]) S.sphere([sx * 0.07, 0.76, 0.6 + dz], 0.025, G({ region: ['head'], glow: 3.4 })); });
  return plan(J, { cls, radius: 0.85, H: 1.4, anchors: { head: { p: [0, 0.86, 0.5], r: 0.1, region: ['head'] }, back: { p: [0, 1.0, -0.15], w: 0.3, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.26, 0.86, 0.22], r: 0.1, region: ['chest'] } } });
} };

A.drone = { H: 2.0, style: 'schmiede', hover: true, build(S, P, F) {
  const J = { hips: { pos: V(0, 1.1, 0), parent: null }, chest: { pos: V(0, 1.2, 0.1), parent: 'hips' } };
  S.group({ k: 0.04 }, () => {
    S.ellipsoid([0, 1.15, 0], [0.3, 0.22, 0.36], { mat: 'paint', col: 'primary', region: ['hips'] });
    S.ellipsoid([0, 1.3, -0.05], [0.2, 0.12, 0.22], { mat: 'brass', col: 'secondary', region: ['hips'] });
  });
  const n = T(F) >= 2 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + PI / n, end = [sin(a) * 0.62, 1.22, cos(a) * 0.62];
    S.capsule([0, 1.18, 0], end, 0.04, 0.035, { mat: 'steel', col: 'metal', region: ['hips'] });
    S.cylinder(end, 0.07, 0.06, { mat: 'iron', col: '#3a3e46', region: ['hips'], r: 0.01 });
    S.torus(add(end, [0, 0.06, 0]), 0.3, 0.02, { mat: 'steel', col: 'metal', region: ['hips'] });
    for (let k = 0; k < 2; k++) S.box(add(end, [0, 0.07, 0]), [0.28, 0.008, 0.035], { rot: [0, a + k * PI / 2, 0], mat: 'steel', col: '#c8d0d8', region: ['hips'], r: 0.005 });
  }
  // Geschütz unten
  S.capsule([0, 0.95, 0.15], [0, 0.88, 0.55 + 0.1 * T(F)], 0.05, 0.035, { mat: 'steel', col: 'metal', region: ['chest'] });
  S.sphere([0, 0.95, 0.12], 0.1, { mat: 'brass', col: 'secondary', region: ['chest'] });
  glow(S, () => { S.sphere([0, 1.15, 0.34], 0.07, G({ region: ['hips'], glow: 3.8 })); S.sphere([0, 0.88, 0.6 + 0.1 * T(F)], 0.04, G({ region: ['chest'] })); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + PI / n; S.sphere([sin(a) * 0.62, 1.12, cos(a) * 0.62], 0.04, G({ region: ['hips'] })); } });
  const cls = { hips: [0, 0, 0, 0], chest: [7, 0, 0.95, 0.1] };
  return plan(J, { cls, machine: true, radius: 0.7, H: 1.7, torsoW: 0, anchors: { head: { p: [0, 1.42, 0], r: 0.12, region: ['hips'] }, back: { p: [0, 1.25, -0.3], w: 0.25, region: ['hips'], parentJoint: 'hips' }, shoulder: null } });
} };

A.tank = { H: 1.5, style: 'schmiede', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.5, 0), parent: null }, chest: { pos: V(0, 0.9, 0.05), parent: 'hips' } };
  const sc = [0.9, 1.0, 1.1][T(F) - 1];
  // Ketten
  for (const sx of [1, -1]) {
    S.capsule([sx * 0.5 * sc, 0.2, -0.6 * sc], [sx * 0.5 * sc, 0.2, 0.6 * sc], 0.2, { mat: 'iron', col: '#2a2a30', region: ['hips'], disp: Detail.noise({ amp: 0.008, freq: 30 }) });
    for (let i = 0; i < 4; i++) S.cylinder([sx * 0.5 * sc, 0.2, (-0.45 + i * 0.3) * sc], 0.13, 0.12, { rot: [0, 0, PI / 2], mat: 'brass', col: 'secondary', region: ['hips'], r: 0.01 });
  }
  S.group({ k: 0.04 }, () => {
    S.box([0, 0.5, 0], [0.48 * sc, 0.18, 0.66 * sc], { mat: 'paint', col: 'primary', region: ['hips'], r: 0.08 });
    S.box([0, 0.66, 0.6 * sc], [0.36 * sc, 0.1, 0.12], { rot: [0.6, 0, 0], mat: 'steel', col: 'metal', region: ['hips'], r: 0.04 });
  });
  // Turm + Rohr
  S.cylinder([0, 0.82, -0.05], 0.32 * sc, 0.13, { mat: 'paint', col: 'primary', region: ['chest'], r: 0.06 });
  S.cylinder([0, 0.97, -0.05], 0.18 * sc, 0.06, { mat: 'brass', col: 'secondary', region: ['chest'], r: 0.03 });
  const bl = [0.7, 0.95, 1.15][T(F) - 1];
  S.capsule([0, 0.85, 0.2], [0, 0.9, 0.2 + bl], 0.07, 0.06, { mat: 'steel', col: 'metal', region: ['chest'] });
  S.torus([0, 0.9, 0.2 + bl], 0.07, 0.025, { rot: [PI / 2, 0, 0], mat: 'brass', col: 'secondary', region: ['chest'] });
  // Schlot
  S.capsule([0.25, 0.7, -0.55 * sc], [0.28, 1.2, -0.6 * sc], 0.07, 0.06, { mat: 'iron', col: '#2a2a30', region: ['hips'] });
  glow(S, () => { S.sphere([0.28, 1.24, -0.6 * sc], 0.07, G({ region: ['hips'], glow: 3.2 })); S.box([0, 0.6, 0.66 * sc], [0.2, 0.03, 0.01], G({ region: ['hips'] })); if (isB(F)) S.sphere([0, 0.9, 0.24 + bl], 0.09, G({ region: ['chest'], glow: 3.8 })); });
  const cls = { hips: [0, 0, 0, 0], chest: [7, 0, 0.8, -0.05] };
  return plan(J, { cls, machine: true, radius: 0.85, H: 1.4, torsoW: 0, anchors: { head: { p: [0, 1.05, -0.05], r: 0.14, region: ['chest'] }, back: { p: [0, 0.75, -0.6], w: 0.4, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.5, 0.45, 0.25], r: 0.14, region: ['hips'] } } });
} };

A.tesla = { H: 2.4, style: 'schmiede', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.8, 0), parent: null }, chest: { pos: V(0, 1.4, 0), parent: 'hips' } };
  const c = { hips: [6, 0, 0.3, 0], chest: [6, 0, 0.3, 0] };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU, sd = i === 0 ? 'L' : i === 1 ? 'R' : 'B';
    const n = 'tleg' + i, hip = [sin(a) * 0.15, 0.8, cos(a) * 0.15], knee = [sin(a) * 0.5, 0.75, cos(a) * 0.5], foot = [sin(a) * 0.62, 0.0, cos(a) * 0.62];
    J[n] = { pos: V(...hip), parent: 'hips' }; c[n] = [9, i * 2.1, sin(a) * 0.15, cos(a) * 0.15];
    S.capsule(hip, knee, 0.06, { mat: 'steel', col: 'metal', region: [n] }); S.sphere(knee, 0.075, { mat: 'brass', col: 'secondary', region: [n] }); S.capsule(knee, foot, 0.05, 0.03, { mat: 'iron', col: '#3a3e46', region: [n] });
    void sd;
  }
  S.cylinder([0, 0.85, 0], 0.24, 0.12, { mat: 'paint', col: 'primary', region: ['hips'], r: 0.05 });
  const hh = [0.9, 1.1, 1.3][T(F) - 1];
  S.capsule([0, 0.9, 0], [0, 0.9 + hh, 0], 0.11, 0.08, { mat: 'copper', col: 'secondary', region: ['chest'] });
  for (let i = 0; i < 5; i++) S.torus([0, 1.0 + i * hh * 0.18, 0], 0.18 - i * 0.015, 0.03, { rot: [PI / 2, 0, 0], mat: 'copper', col: 'secondary', region: ['chest'] });
  S.torus([0, 0.95 + hh, 0], 0.22, 0.05, { rot: [PI / 2, 0, 0], mat: 'steel', col: 'metal', region: ['chest'] });
  glow(S, () => { S.sphere([0, 1.05 + hh, 0], 0.15 + (isB(F) ? 0.05 : 0), G({ region: ['chest'], glow: 3.8 })); for (let i = 0; i < 4; i++) { const a = i * PI / 2; S.capsule([0, 1.05 + hh, 0], [sin(a) * 0.32, 0.9 + hh + 0.1 * (i % 2), cos(a) * 0.32], 0.018, 0.005, G({ region: ['chest'], glow: 3 })); } });
  return plan(J, { cls: c, machine: true, radius: 0.65, H: 0.95 + hh + 0.2, torsoW: 0.4, anchors: { head: null, back: { p: [0, 1.3, -0.12], w: 0.2, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.22, 0.95, 0], r: 0.1, region: ['hips'] } } });
} };

// =============================================================================================
// ABGRUND
// =============================================================================================
A.bonethrower = { H: 1.7, style: 'abgrund', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.5, 0), parent: null }, chest: { pos: V(0, 0.8, -0.1), parent: 'hips' } };
  const B = { mat: 'bone', col: '#d8ccb0', region: ['hips'] };
  // Gestell aus Knochen auf Rippen-Rädern
  for (const sx of [1, -1]) { S.capsule([sx * 0.38, 0.42, -0.6], [sx * 0.38, 0.42, 0.55], 0.06, B); S.capsule([sx * 0.38, 0.42, 0.3], [sx * 0.2, 1.0, -0.05], 0.05, B); }
  for (const z of [-0.45, 0.4]) S.capsule([-0.4, 0.42, z], [0.4, 0.42, z], 0.05, B);
  for (const sx of [1, -1]) for (const z of [0.42, -0.48]) { S.torus([sx * 0.48, 0.3, z], 0.26, 0.04, { rot: [0, 0, PI / 2], ...B }); for (let k = 0; k < 4; k++) { const a = k * PI / 4; S.capsule([sx * 0.48, 0.3 + sin(a) * 0.25, z + cos(a) * 0.25], [sx * 0.48, 0.3 - sin(a) * 0.25, z - cos(a) * 0.25], 0.02, B); } }
  S.ellipsoid([0, 0.5, -0.05], [0.3, 0.1, 0.5], { mat: 'iron', col: 'metal', region: ['hips'] });
  // Wurfarm mit Schädelkorb
  const L = [0.95, 1.15, 1.3][T(F) - 1];
  const piv = [0, 0.95, -0.05], tip = [0, 0.95 + L * 0.75, -0.05 - L * 0.65];
  S.capsule(piv, tip, 0.06, 0.04, { mat: 'bone', col: '#c8bca0', region: ['chest'] });
  S.ellipsoid(tip, [0.2, 0.12, 0.2], { mat: 'bone', col: '#e0d4b8', region: ['chest'] });
  for (const sx of [1, -1]) S.sphere(add(tip, [sx * 0.07, 0.04, 0.16]), 0.04, { mat: 'void', col: '#05040a', region: ['chest'] });
  S.cylinder(piv, 0.09, 0.42, { rot: [0, 0, PI / 2], mat: 'iron', col: 'metal', region: ['hips'], r: 0.02 });
  // Schädelstapel vorn
  for (const [x, y, z] of [[0, 0.62, 0.45], [0.15, 0.58, 0.4], [-0.15, 0.58, 0.4], [0, 0.78, 0.4]]) S.sphere([x, y, z], 0.1, { mat: 'bone', col: '#e0d4b8', region: ['hips'] });
  glow(S, () => { for (const sx of [1, -1]) S.sphere(add(tip, [sx * 0.07, 0.04, 0.19]), 0.025, G({ region: ['chest'], glow: 3.4 })); if (isB(F)) S.sphere(add(tip, [0, 0.18, 0]), 0.14, G({ region: ['chest'], glow: 3 })); });
  const cls = { hips: [0, 0, 0, 0], chest: [7, 0, 0.95, -0.05] };
  return plan(J, { cls, machine: true, radius: 0.75, H: 1.7, torsoW: 0, anchors: { head: null, back: { p: [0, 0.6, -0.6], w: 0.35, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [0.4, 0.5, 0.2], r: 0.1, region: ['hips'] } } });
} };

/** Magier-Grundkörper (Leerenmagier, Pyromantin) */
function mageBody(S, F, o) {
  const s = o.s ?? 1.06;
  const { J, BL, BR } = hum(S, s, { armR: [[0.3, 1.22, 0.14], [0.3, 1.16, 0.34]], armL: [[0.32, 1.25, 0.14], [0.3, 1.38, 0.32]] }, { female: o.female, base: { mat: 'cloth', col: o.robe } });
  J.weaponR = { pos: V(-0.3 * s, 1.16 * s, 0.36 * s), parent: 'handR' };
  bothSides(S, BL, BR, (B0) => simpleHand(S, B0, o.skin || '#8a7aa0', 'skin'));
  robe(S, BL, s, o.robe, { r1: 0.38, hem: 'secondary', hemWave: o.wave ?? 0.05, fold: 0.018 });
  return { J, BL, BR, s };
}
A.voidmage = { H: 2.4, style: 'abgrund', build(S, P, F) {
  const { J, BL, BR, s } = mageBody(S, F, { robe: 'primary', skin: '#6a5a80', wave: 0.08 });
  // Hoher Kragen + Schultermantel
  S.shell({ off: 0.0, th: 0.025, mat: 'cloth', col: 'secondary', region: 'upper', clip: (x, y, z) => max(jp(J, 'upperArmL')[1] - 0.05 - y, z - 0.12) }, () => S.ellipsoid(add(jp(J, 'neck'), [0, 0.0, -0.03]), [0.3, 0.26, 0.22], {}));
  hood(S, BL, 'primary', { tipY: 0.18, tipZ: -0.28 });
  eyes(S, headInfo(BL).at(0, -0.01, 0.09), 0.035, 0.018, 'head', 4);
  // Stab mit schwebender Leerenkugel
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.08], [1, 0, 0]);
  const st = staff(S, fr, { len: 1.7, below: 0.6, wood: '#2a2030', metal: 'metal', r: 0.022 });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; S.capsule(fr.at(0, st.topY - 0.02), fr.at(cos(a) * 0.12, st.topY + 0.16, sin(a) * 0.12), 0.016, 0.004, { mat: 'iron', col: 'metal', bone: 'weaponR' }); }
  const orbR = [0.08, 0.1, 0.13][T(F) - 1];
  glow(S, () => S.sphere(fr.at(0, st.topY + 0.2), orbR, G({ bone: 'weaponR', glow: 3.8 })));
  // linke Hand: schwebende Leerenflamme
  glow(S, () => S.capsule(add(jp(J, 'handL'), [0, 0.06, 0.04]), add(jp(J, 'handL'), [0, 0.22 + 0.04 * T(F), 0.06]), 0.05, 0.01, G({ region: 'armL', glow: 3.2 })));
  return plan(J, { radius: 0.62, H: 2.4, anchors: humanAnchors(J, s, { headTop: 0.24 }) });
} };

A.cryptgolem = { H: 2.6, style: 'abgrund', build(S, P, F) {
  const s = 1.2;
  const J = humanoid(s, { sw: 1.45, armR: [[0.44, 1.0, 0.1], [0.48, 0.66, 0.16]], armL: [[0.44, 1.0, 0.1], [0.48, 0.66, 0.16]], stance: 0.08 });
  J.head.pos.z += 0.12; J.neck.pos.z += 0.08; J.head.pos.y -= 0.08;
  const flesh = { mat: 'skin', col: '#7a8a70', disp: Detail.muscle({ amp: 0.006, freq: 14 }) };
  S.group({ k: 0.06 }, () => {
    S.ellipsoid(add(jp(J, 'chest'), [0, 0.08, 0]), [0.48, 0.38, 0.36], { ...flesh, region: 'torso' });
    S.ellipsoid(jp(J, 'hips'), [0.3, 0.2, 0.24], { ...flesh, region: 'torso' });
    S.ellipsoid(jp(J, 'head'), [0.14, 0.13, 0.14], { ...flesh, region: 'head' });
    for (const sd of ['L', 'R']) {
      const sh = jp(J, 'upperArm' + sd), el = jp(J, 'foreArm' + sd), ha = jp(J, 'hand' + sd);
      S.ellipsoid(add(sh, [sd === 'L' ? 0.06 : -0.06, 0.08, 0]), [0.22, 0.2, 0.22], { ...flesh, region: 'shoulder' + sd });
      S.capsule(sh, el, 0.13, 0.11, { ...flesh, region: 'arm' + sd });
      S.capsule(el, ha, 0.13, 0.16, { ...flesh, region: 'arm' + sd });
      S.capsule(jp(J, 'thigh' + sd), jp(J, 'shin' + sd), 0.14, 0.11, { ...flesh, region: 'leg' + sd });
      S.capsule(jp(J, 'shin' + sd), add(jp(J, 'foot' + sd), [0, -0.02, 0.05]), 0.11, 0.13, { ...flesh, region: 'leg' + sd });
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  // Rippenkäfig vorn (offen), Nähte, Knochenplatten
  const ch = jp(J, 'chest');
  for (let i = 0; i < 4; i++) S.torus(add(ch, [0, 0.18 - i * 0.1, 0.1]), 0.32 - i * 0.03, 0.03, { rot: [PI / 2, 0, 0], arc: 2.0, mat: 'bone', col: '#e0d4b8', region: 'torso' });
  S.capsule(add(ch, [0, 0.25, 0.32]), add(ch, [0, -0.15, 0.3]), 0.035, { mat: 'bone', col: '#e0d4b8', region: 'torso' });
  for (let i = 0; i < 4; i++) S.capsule(add(ch, [-0.3 + i * 0.2, 0.3, 0.2]), add(ch, [-0.25 + i * 0.2, -0.05, 0.28]), 0.012, { mat: 'leather', col: '#1a1010', region: 'torso' });
  for (let i = 0; i < 5; i++) S.capsule(add(ch, [0, 0.3 - i * 0.12, -0.32]), add(ch, [0, 0.42 - i * 0.12, -0.48]), 0.05, 0.008, { mat: 'bone', col: '#d8ccb0', region: 'torso' });
  // Hände: Klauen (Stufe größer)
  for (const sd of ['L', 'R']) { const ha = jp(J, 'hand' + sd); for (let k = 0; k < 3; k++) S.capsule(add(ha, [0, -0.08, 0.08]), add(ha, [(k - 1) * 0.08, -0.22 - 0.04 * T(F), 0.18]), 0.03, 0.006, { mat: 'bone', col: '#c8bca0', region: 'arm' + sd }); }
  eyes(S, add(jp(J, 'head'), [0, 0.03, 0.13]), 0.05, 0.022, 'head', 3.6);
  glow(S, () => S.sphere(add(ch, [0, 0.05, 0.12]), 0.09 + 0.02 * T(F), G({ region: 'torso', glow: 3.2 })));
  return plan(J, { radius: 0.85, H: 2.5, anchors: humanAnchors(J, s, { headTop: 0.14, headR: 0.12, backZ: 0.34, backW: 0.36, shX: 0.08, shY: 0.2, shR: 0.16 }) });
} };

A.witch = { H: 2.5, style: 'abgrund', build(S, P, F) {
  const s = 1.0;
  const { J, BL, BR } = hum(S, s, { armR: [[0.3, 1.18, 0.16], [0.3, 1.08, 0.36]], armL: [[0.32, 1.15, 0.16], [0.24, 1.2, 0.36]] }, { female: true, base: { mat: 'cloth', col: 'primary' } });
  J.head.pos.z += 0.06; J.neck.pos.z += 0.04;
  J.weaponR = { pos: V(-0.3 * s, 1.08 * s, 0.38 * s), parent: 'handR' };
  bothSides(S, BL, BR, (B0) => simpleHand(S, B0, '#8aa070', 'skin'));
  robe(S, BL, s, 'primary', { r1: 0.36, hemWave: 0.08, fold: 0.02 });
  cape(S, BL, { top: 1.48 * s, bottom: 0.2, r0: 0.17, r1: 0.38, arc: 1.3, col: 'secondary', folds: 7, fold: 0.018, th: 0.016, hemWave: 0.08, chain: ['chest', 'spine', 'hips', 'hips'] });
  const H = head(S, BL, { female: true, skin: '#8aa070', eye: '#c0ff60', brow: false, lips: '#3a2a3a' });
  // Hexenhut: breite Krempe + geknickte Spitze (starke Draufsicht-Silhouette)
  const brim = [0.34, 0.4, 0.46][T(F) - 1];
  S.cylinder(H.at(0, 0.09, -0.01), brim, 0.016, { mat: 'cloth', col: 'secondary', region: 'head', r: 0.012 });
  S.tube([H.at(0, 0.09, -0.01), H.at(0, 0.3, -0.04), H.at(0, 0.48, -0.12), H.at(0.0, 0.58, -0.28)], [0.13, 0.09, 0.05, 0.01], { mat: 'cloth', col: 'secondary', region: 'head', kj: 0.03 });
  S.torus(H.at(0, 0.12, -0.02), 0.125, 0.016, { mat: 'gold', col: 'metal', region: 'head' });
  // Laternenstab
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.12], [1, 0, 0]);
  const st = staff(S, fr, { len: 1.6, below: 0.5, wood: '#2a2018', metal: 'metal', r: 0.02 });
  S.tube([fr.at(0, st.topY), fr.at(0.12, st.topY + 0.1), fr.at(0.2, st.topY + 0.02)], 0.016, { mat: 'wood', col: '#2a2018', bone: 'weaponR' });
  S.capsule(fr.at(0.2, st.topY - 0.18), fr.at(0.2, st.topY - 0.02), 0.06, { mat: 'iron', col: 'metal', bone: 'weaponR' });
  glow(S, () => { S.sphere(fr.at(0.2, st.topY - 0.1), 0.06 + 0.015 * T(F), G({ bone: 'weaponR', glow: 3.6 })); S.sphere(add(jp(J, 'handL'), [0, 0.08, 0.04]), 0.06, G({ region: 'armL', glow: 3 })); });
  return plan(J, { radius: 0.6, H: 2.5, anchors: { ...humanAnchors(J, s, { headTop: 0.48, headR: 0.1 }), head: { p: H.at(0, 0.32, -0.06), r: 0.12 * s, region: 'head' } } });
} };

A.ghoul = { H: 1.7, style: 'abgrund', build(S, P, F) {
  const s = 0.95;
  const J = humanoid(s, { sw: 1.15, armR: [[0.3, 0.85, 0.3], [0.28, 0.42, 0.5]], armL: [[0.3, 0.85, 0.3], [0.28, 0.42, 0.5]], stance: 0.1 });
  // stark gebückt: Oberkörper nach vorn
  for (const n of ['chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR']) { const pp = J[n].pos; const dy = pp.y - J.hips.pos.y; pp.z += dy * 0.9; pp.y = J.hips.pos.y + dy * 0.6; }
  J.head.pos.z += 0.06;
  const flesh = { mat: 'skin', col: '#8a9a80', disp: Detail.muscle({ amp: 0.005, freq: 20 }) };
  const { BL, BR } = humanBody(S, J, s, { bulk: 1.05, armBulk: 1.1, legBulk: 1.05, base: flesh, legs: { mat: 'cloth', col: 'secondary' } });
  head(S, BL, { skin: '#8a9a7a', eye: '#e0ff60', brow: false, lips: '#2a1a1a', jaw: 1.25 });
  // Wirbelkamm + Lumpen
  for (let i = 0; i < 6; i++) { const q = lerp3(jp(J, 'hips'), jp(J, 'neck'), i / 5); S.capsule(add(q, [0, 0.06, -0.08]), add(q, [0, 0.16, -0.14]), 0.035, 0.006, { mat: 'bone', col: '#d8ccb0', region: 'torso' }); }
  skirt(S, BL, { top: 1.0 * s, bottom: 0.55 * s, r0: 0.18, r1: 0.26, col: 'secondary', folds: 7, fold: 0.014, th: 0.016, slits: [0.5, -0.5, 1.8, -1.8, PI], slitFrom: 0.1, hemWave: 0.05 });
  // lange Klauen
  const cl = [0.18, 0.24, 0.3][T(F) - 1];
  bothSides(S, BL, BR, (B0) => { const ha = jp(B0.J, 'handL'); S.sphere(ha, 0.06, { ...flesh, region: 'armL' }); for (let k = 0; k < 3; k++) S.capsule(add(ha, [0, -0.02, 0.03]), add(ha, [(k - 1) * 0.06, -0.05, cl]), 0.02, 0.004, { mat: 'horn', col: '#2a2020', region: ['handL', 'foreArmL'] }); simpleBoot(S, B0, '#2a2420'); });
  eyes(S, add(headInfo(BL).c, [0, 0.0, 0.1 * s]), 0.035, 0.018, 'head', 3.6);
  return plan(J, { radius: 0.62, H: 1.6, anchors: humanAnchors(J, s, { headTop: 0.2, backZ: 0.2 }) });
} };

A.banshee = { H: 2.3, style: 'abgrund', hover: true, build(S, P, F) {
  const s = 1.0;
  const J = humanoid(s, { armR: [[0.38, 1.45, 0.08], [0.55, 1.62, 0.12]], armL: [[0.38, 1.45, 0.08], [0.55, 1.62, 0.12]] });
  for (const k of Object.keys(J)) J[k].pos.y += 0.1;
  const BL = fakeB(J, s), BR = fakeB(J, s, true);
  const cl = { mat: 'silk', col: 'primary*1.3' };
  torsoShape(S, BL, { female: true, bulk: 0.9, o: { ...cl, region: 'torso' } });
  bothSides(S, BL, BR, (B0) => {
    S.capsule(jp(B0.J, 'upperArmL'), jp(B0.J, 'foreArmL'), 0.04, 0.032, { mat: 'skin', col: '#c8c8d8', region: 'armL' });
    S.capsule(jp(B0.J, 'foreArmL'), jp(B0.J, 'handL'), 0.032, 0.022, { mat: 'skin', col: '#c8c8d8', region: 'armL' });
    // Ärmelfetzen
    S.ellipsoid(add(lerp3(jp(B0.J, 'upperArmL'), jp(B0.J, 'handL'), 0.6), [0, -0.12, -0.02]), [0.06, 0.16, 0.012], { rot: [0, 0, 0.6], ...cl, region: 'armL' });
  });
  // Zerfetzter Rock, der sich auflöst (endet über dem Boden)
  skirt(S, BL, { top: 1.12, bottom: 0.25, r0: 0.17, r1: 0.4, col: 'primary', mat: 'silk', folds: 12, fold: 0.03, th: 0.016, hemWave: 0.14, bind: () => [['hips', 1]] });
  const H = head(S, BL, { female: true, skin: '#d8d8e8', eye: '#ffffff', brow: false, lips: '#2a2a3a' });
  // langes, nach hinten wehendes Haar
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.045; S.tube([H.at(x, 0.12, -0.02), H.at(x * 1.4, 0.05, -0.2), H.at(x * 1.8, -0.1, -0.42), H.at(x * 2.0, -0.25 - 0.05 * (i % 2), -0.66)], [0.035, 0.03, 0.02, 0.006], { mat: 'hair', col: 'secondary*2', region: 'head' }); }
  glow(S, () => { for (const sx of [1, -1]) S.sphere(H.at(sx * 0.035, 0.0, 0.09), 0.018, G({ region: 'head', glow: 4 })); S.ellipsoid(H.at(0, -0.06, 0.09), [0.025, 0.035, 0.01], G({ region: 'head', glow: 3.4 })); if (T(F) >= 2) S.torus([0, 0.3, 0], 0.32, 0.015, { rot: [PI / 2, 0, 0], ...G({ region: ['hips'], glow: 2.6 }) }); });
  const cls = { hips: [6, 0, 0.6, 0] };
  return plan(J, { cls, radius: 0.55, H: 2.2, torsoW: 0.5, anchors: humanAnchors(J, s, { headTop: 0.22 }) });
} };

A.gargoyle = { H: 2.1, style: 'abgrund', build(S, P, F) {
  const s = 1.0;
  const J = humanoid(s, { sw: 1.2, armR: [[0.3, 0.95, 0.2], [0.3, 0.55, 0.36]], armL: [[0.3, 0.95, 0.2], [0.3, 0.55, 0.36]], stance: 0.12 });
  // hockend: Hüfte tiefer, Knie vorn
  J.hips.pos.y = 0.7; J.spine.pos.y = 0.82; J.chest.pos.y = 1.0; J.chest.pos.z = 0.1; J.neck.pos.y = 1.18; J.neck.pos.z = 0.2; J.head.pos.y = 1.26; J.head.pos.z = 0.26;
  for (const sd of ['L', 'R']) { const k = sd === 'L' ? 1 : -1; J['shoulder' + sd].pos.y = 1.1; J['upperArm' + sd].pos.set ? 0 : 0; J['upperArm' + sd].pos = V(k * 0.24, 1.1, 0.1); J['thigh' + sd].pos = V(k * 0.12, 0.66, 0); J['shin' + sd].pos = V(k * 0.18, 0.55, 0.32); J['foot' + sd].pos = V(k * 0.16, 0.08, 0.12); }
  const stone = { mat: 'stone', col: '#6e6a74', disp: Detail.noise({ amp: 0.01, freq: 10, ridged: true }) };
  S.group({ k: 0.06 }, () => {
    S.ellipsoid(add(jp(J, 'chest'), [0, 0.0, 0]), [0.3, 0.26, 0.24], { ...stone, region: 'torso' });
    S.ellipsoid(jp(J, 'hips'), [0.22, 0.16, 0.2], { ...stone, region: 'torso' });
    S.ellipsoid(jp(J, 'head'), [0.12, 0.12, 0.14], { ...stone, region: 'head' });
    S.capsule(jp(J, 'head'), add(jp(J, 'head'), [0, -0.05, 0.14]), 0.08, 0.06, { ...stone, region: 'head' });
    for (const sd of ['L', 'R']) {
      S.capsule(jp(J, 'upperArm' + sd), jp(J, 'foreArm' + sd), 0.08, 0.07, { ...stone, region: 'arm' + sd });
      S.capsule(jp(J, 'foreArm' + sd), jp(J, 'hand' + sd), 0.07, 0.08, { ...stone, region: 'arm' + sd });
      S.capsule(jp(J, 'thigh' + sd), jp(J, 'shin' + sd), 0.11, 0.08, { ...stone, region: 'leg' + sd });
      S.capsule(jp(J, 'shin' + sd), jp(J, 'foot' + sd), 0.08, 0.07, { ...stone, region: 'leg' + sd });
      S.ellipsoid(add(jp(J, 'foot' + sd), [0, -0.02, 0.06]), [0.08, 0.05, 0.12], { ...stone, region: 'leg' + sd });
    }
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  for (const sx of [1, -1]) S.tube([add(jp(J, 'head'), [sx * 0.08, 0.08, -0.02]), add(jp(J, 'head'), [sx * 0.16, 0.2, -0.1]), add(jp(J, 'head'), [sx * 0.14, 0.3, -0.24])], [0.035, 0.022, 0.004], { mat: 'horn', col: '#1a1820', region: 'head' });
  S.tube([add(jp(J, 'hips'), [0, 0, -0.15]), [0, 0.3, -0.5], [0.15, 0.05, -0.75], [0.3, 0.04, -0.85]], [0.06, 0.045, 0.03, 0.008], { ...stone, region: 'torso' });
  // Flügel (Stein-Fledermaus): angelegt bei I/II
  const c = {};
  if (!(F.tier >= 3 && F.path === 'b')) {
    for (const [sd, k] of [['L', 1], ['R', -1]]) { const root = [k * 0.2, 1.08, -0.12]; J['wing' + sd] = { pos: V(...root), parent: 'chest' }; c['wing' + sd] = [4, root[0], root[1], 0]; }
    S.sym(() => wing(S, [0.2, 1.08, -0.12], [0.75, 0.95, 1.1][T(F) - 1], { style: 'abgrund', region: ['wingL'], up: 0.95, bone: '#4a4650', skin: '#5a5660' }));
  }
  eyes(S, add(jp(J, 'head'), [0, 0.03, 0.13]), 0.05, 0.02, 'head', 3.6);
  return plan(J, { cls: c, radius: 0.7, H: 1.6, anchors: humanAnchors(J, s, { headTop: 0.12, backZ: 0.22, backW: 0.25 }), wingL: 1.2 });
} };

// =============================================================================================
// SCHWARMBRUT
// =============================================================================================
function bugBody(S, segs, mat) { S.group({ k: 0.05 }, () => { for (const [c, r, reg] of segs) S.ellipsoid(c, r, { ...mat, region: reg }); }); }
function bugLegs(S, J, cls, n, o) {
  for (let i = 0; i < n; i++) for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const nm = `mleg${i}${sd}`, z = o.z0 - i * o.dz;
    const root = [k * o.rx, o.y, z], knee = [k * o.kx, o.ky, z + (i - (n - 1) / 2) * 0.08], foot = [k * o.fx, 0.0, z + (i - (n - 1) / 2) * 0.22];
    J[nm] = { pos: V(...root), parent: o.parent || 'chest' };
    S.capsule(root, knee, o.r, o.r * 0.8, { ...o.mat, region: [nm] });
    S.capsule(knee, foot, o.r * 0.8, o.r * 0.3, { ...o.mat, region: [nm] });
    cls[nm] = [9, (k > 0 ? 0 : PI) + i * PI, k * o.rx, z];
  }
}
A.beetle = { H: 1.4, style: 'schwarm', build(S, P, F) {
  // Spucker: aufgerichteter Vorderleib mit Speirohr, großer Giftsack hinten
  const J = { hips: { pos: V(0, 0.55, -0.4), parent: null }, chest: { pos: V(0, 0.65, 0.15), parent: 'hips' }, head: { pos: V(0, 0.9, 0.45), parent: 'chest' } };
  const ch = { mat: 'chitin', col: 'primary', wear: 1 };
  const sac = [0.42, 0.5, 0.58][T(F) - 1];
  bugBody(S, [[[0, 0.62, 0.12], [0.3, 0.24, 0.3], ['chest']], [[0, 0.88, 0.42], [0.18, 0.18, 0.2], ['head']]], ch);
  glass(S, () => S.ellipsoid([0, 0.65, -0.45], [sac * 0.85, sac * 0.75, sac], { mat: 'crystal', col: 'glow', region: ['hips'] }));
  glow(S, () => S.ellipsoid([0, 0.65, -0.45], [sac * 0.55, sac * 0.48, sac * 0.65], G({ region: ['hips'], glow: 1.8 })));
  for (let i = 0; i < 4; i++) S.torus([0, 0.65, -0.2 - i * 0.18], sac * (0.82 - i * 0.08), 0.03, { rot: [PI / 2, 0, 0], mat: 'chitin', col: 'primary', region: ['hips'] });
  S.capsule([0, 0.95, 0.55], [0, 1.08, 0.82], 0.07, 0.05, { ...ch, region: ['head'] });
  for (const sx of [1, -1]) S.capsule([sx * 0.1, 1.0, 0.5], [sx * 0.2, 1.25, 0.6], 0.02, 0.005, { mat: 'horn', col: 'secondary', region: ['head'] });
  const cls = { head: [7, 0, 0.75, 0.15], hips: [6, 0, 0.3, 0], chest: [6, 0, 0.3, 0] };
  bugLegs(S, J, cls, 3, { rx: 0.2, y: 0.55, kx: 0.5, ky: 0.7, fx: 0.62, z0: 0.3, dz: 0.22, r: 0.045, mat: ch });
  glow(S, () => { S.sphere([0, 1.1, 0.85], 0.05, G({ region: ['head'], glow: 3.6 })); for (let i = 0; i < 5; i++) { const a = i * 1.26; S.sphere([sin(a) * sac * 0.7, 0.65 + cos(a) * sac * 0.55, -0.45 - sac * 0.4], 0.045 + (isB(F) ? 0.02 : 0), G({ region: ['hips'], glow: 3 })); } for (const sx of [1, -1]) S.sphere([sx * 0.09, 0.95, 0.58], 0.025, G({ region: ['head'] })); });
  return plan(J, { cls, radius: 0.7, H: 1.3, anchors: { head: { p: [0, 1.06, 0.42], r: 0.1, region: ['head'] }, back: { p: [0, 0.85, 0.05], w: 0.22, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.22, 0.78, 0.2], r: 0.1, region: ['chest'] } } });
} };

A.carapace = { H: 1.5, style: 'schwarm', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.55, -0.2), parent: null }, chest: { pos: V(0, 0.55, 0.3), parent: 'hips' }, head: { pos: V(0, 0.45, 0.75), parent: 'chest' } };
  const R = [0.62, 0.72, 0.82][T(F) - 1];
  // Kuppelpanzer mit Wülsten
  S.group({ k: 0.03 }, () => {
    S.ellipsoid([0, 0.5, -0.05], [R, R * 0.78, R * 1.15], { mat: 'chitin', col: 'primary', region: ['hips'] });
    S.plane([0, 0.18, 0], [0, -1, 0], { op: 'int' });
  });
  for (let i = 0; i < 3; i++) S.torus([0, 0.5, -0.05], R * (0.98 - i * 0.04), 0.035, { rot: [PI / 2 - 0.2 * (i - 1), 0, 0], arc: PI, mat: 'chitin', col: 'secondary', region: ['hips'] });
  S.ellipsoid([0, 0.45, 0.7], [0.28, 0.2, 0.22], { mat: 'chitin', col: 'secondary', region: ['head'] });
  // Rammhorn
  S.tube([[0, 0.52, 0.85], [0, 0.72, 1.05], [0, 1.0, 1.1]], [0.09, 0.06, 0.012], { mat: 'horn', col: 'metal', region: ['head'] });
  for (const sx of [1, -1]) S.capsule([sx * 0.18, 0.45, 0.85], [sx * 0.28, 0.35, 1.05], 0.045, 0.008, { mat: 'horn', col: 'metal', region: ['head'] });
  const cls = { head: [7, 0, 0.5, 0.3], hips: [6, 0, 0.3, 0], chest: [6, 0, 0.3, 0] };
  bugLegs(S, J, cls, 3, { rx: R * 0.5, y: 0.3, kx: R * 1.05, ky: 0.42, fx: R * 1.2, z0: 0.4, dz: 0.38, r: 0.06, mat: { mat: 'chitin', col: 'secondary' } });
  glow(S, () => { for (const sx of [1, -1]) S.sphere([sx * 0.13, 0.52, 0.88], 0.03, G({ region: ['head'], glow: 3.4 })); if (isB(F)) for (let i = 0; i < 6; i++) { const a = i * 1.05; S.sphere([sin(a) * R * 0.6, 0.5 + R * 0.6, cos(a) * R * 0.75 - 0.05], 0.05, G({ region: ['hips'] })); } });
  return plan(J, { cls, radius: R * 1.15, H: 0.5 + R * 0.8, anchors: { head: { p: [0, 0.68, 0.7], r: 0.1, region: ['head'] }, back: { p: [0, 0.5 + R * 0.72, -0.1], w: R * 0.6, region: ['hips'], parentJoint: 'hips' }, shoulder: { p: [R * 0.6, 0.5 + R * 0.45, 0.25], r: 0.13, region: ['hips'] } } });
} };

A.queen = { H: 2.3, style: 'schwarm', build(S, P, F) {
  // Brutmutter: aufrechter Insekten-Oberkörper mit vier Armen auf großem Eiersack
  const J = { hips: { pos: V(0, 0.55, -0.3), parent: null }, spine: { pos: V(0, 0.95, 0.15), parent: 'hips' }, chest: { pos: V(0, 1.35, 0.25), parent: 'spine' }, neck: { pos: V(0, 1.65, 0.28), parent: 'chest' }, head: { pos: V(0, 1.78, 0.32), parent: 'neck' } };
  const ch = { mat: 'chitin', col: 'primary', wear: 1 };
  const sac = [0.48, 0.58, 0.68][T(F) - 1];
  S.ellipsoid([0, 0.55, -0.55], [sac * 0.85, sac * 0.7, sac * 1.15], { mat: 'skin', col: 'secondary', region: ['hips'] });
  for (let i = 0; i < 4; i++) S.torus([0, 0.55, -0.25 - i * 0.22], sac * (0.82 - i * 0.07), 0.035, { rot: [PI / 2, 0, 0], mat: 'chitin', col: 'primary', region: ['hips'] });
  S.group({ k: 0.06 }, () => {
    S.ellipsoid([0, 0.75, 0.12], [0.26, 0.22, 0.26], { ...ch, region: ['spine'] });
    S.capsule([0, 0.85, 0.15], [0, 1.45, 0.25], 0.16, 0.2, { ...ch, region: ['spine', 'chest'] });
    S.ellipsoid([0, 1.8, 0.33], [0.13, 0.15, 0.14], { ...ch, region: ['head'] });
  });
  // Kronenkamm
  for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; S.capsule([sin(a) * 0.1, 1.88, 0.3 - cos(a) * 0.02], [sin(a) * 0.22, 2.05 + 0.08 * (i === 2), 0.22], 0.03, 0.005, { mat: 'horn', col: 'secondary', region: ['head'] }); }
  const cls = { hips: [6, 0, 0.3, 0] };
  // vier Arme (Sichelklauen)
  for (const [sd, k] of [['L', 1], ['R', -1]]) for (let i = 0; i < 2; i++) {
    const n = (i ? 'upperArm' : 'foreArm') + sd + (i ? '' : '');
    const nm = i === 0 ? 'upperArm' + sd : 'arm2' + sd;
    void n;
    const root = [k * 0.18, 1.45 - i * 0.25, 0.28], el = [k * 0.42, 1.35 - i * 0.3, 0.42], tip = [k * 0.38, 1.0 - i * 0.25, 0.68];
    J[nm] = { pos: V(...root), parent: 'chest' };
    S.capsule(root, el, 0.05, 0.04, { ...ch, region: [nm] }); S.capsule(el, tip, 0.04, 0.008, { mat: 'horn', col: 'secondary', region: [nm] });
    cls[nm] = [k > 0 ? 2 : 8, k > 0 ? PI : 0, 1.45, 0.28];
  }
  bugLegs(S, J, cls, 2, { rx: 0.2, y: 0.6, kx: 0.5, ky: 0.7, fx: 0.62, z0: 0.25, dz: 0.3, r: 0.045, mat: ch, parent: 'spine' });
  glow(S, () => { for (const sx of [1, -1]) S.sphere([sx * 0.07, 1.82, 0.45], 0.03, G({ region: ['head'], glow: 3.6 })); for (let i = 0; i < 7; i++) { const a = i * 0.9; S.sphere([sin(a) * sac * 0.75, 0.55 + cos(a) * sac * 0.5, -0.55 - sac * 0.6 + (i % 3) * 0.2], 0.05, G({ region: ['hips'], glow: 3 })); } });
  return plan(J, { cls, radius: 0.75, H: 2.1, hipY: 0.9, anchors: { head: { p: [0, 1.98, 0.3], r: 0.12, region: ['head'] }, back: { p: [0, 1.4, 0.05], w: 0.2, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.2, 1.5, 0.25], r: 0.1, region: ['chest'] } } });
} };

A.locust = { H: 1.6, style: 'schwarm', hover: true, build(S, P, F) {
  const J = { hips: { pos: V(0, 0.7, -0.35), parent: null }, chest: { pos: V(0, 0.8, 0.15), parent: 'hips' }, head: { pos: V(0, 0.95, 0.5), parent: 'chest' } };
  const ch = { mat: 'chitin', col: 'primary', wear: 1 };
  bugBody(S, [[[0, 0.8, 0.15], [0.2, 0.2, 0.26], ['chest']], [[0, 0.72, -0.45], [0.16, 0.16, 0.48], ['hips']], [[0, 0.95, 0.48], [0.15, 0.17, 0.16], ['head']]], ch);
  for (let i = 0; i < 4; i++) S.torus([0, 0.72, -0.25 - i * 0.16], 0.15 - i * 0.015, 0.02, { rot: [PI / 2, 0, 0], mat: 'chitin', col: 'secondary', region: ['hips'] });
  for (const sx of [1, -1]) { S.sphere([sx * 0.12, 1.0, 0.55], 0.065, { mat: 'eye', col: '#3a1a0a', region: ['head'] }); S.tube([[sx * 0.05, 1.08, 0.58], [sx * 0.15, 1.35, 0.7], [sx * 0.25, 1.5, 0.6]], [0.012, 0.008, 0.004], { ...ch, region: ['head'] }); }
  const cls = { head: [7, 0, 0.85, 0.2], hips: [5, 0, 0.06, 2] };
  // Sprungbeine (groß, Silhouette)
  for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const nm = 'jleg' + sd, root = [k * 0.15, 0.75, -0.05], knee = [k * 0.32, 1.15, -0.45], foot = [k * 0.36, 0.02, -0.55];
    J[nm] = { pos: V(...root), parent: 'chest' };
    S.capsule(root, knee, 0.08, 0.05, { ...ch, region: [nm] }); S.capsule(knee, foot, 0.04, 0.02, { mat: 'chitin', col: 'secondary', region: [nm] });
    cls[nm] = [1, k > 0 ? 0 : PI, 0.75, -0.05];
  }
  bugLegs(S, J, cls, 2, { rx: 0.14, y: 0.7, kx: 0.38, ky: 0.62, fx: 0.46, z0: 0.3, dz: 0.2, r: 0.03, mat: ch });
  // Flügel immer (Heuschrecke); III-B ersetzt sie durch die Form-Schicht
  if (!(F.tier >= 3 && F.path === 'b')) {
    for (const [sd, k] of [['L', 1], ['R', -1]]) { const root = [k * 0.12, 0.95, 0.05]; J['wing' + sd] = { pos: V(...root), parent: 'chest' }; cls['wing' + sd] = [4, root[0], root[1], 0]; }
    S.sym(() => wing(S, [0.12, 0.95, 0.05], [0.75, 0.9, 1.0][T(F) - 1], { style: 'schwarm', region: ['wingL'], up: 0.25 }));
  }
  glow(S, () => { for (const sx of [1, -1]) S.sphere([sx * 0.12, 1.03, 0.6], 0.025, G({ region: ['head'], glow: 3.6 })); });
  return plan(J, { cls, radius: 0.65, H: 1.4, anchors: { head: { p: [0, 1.12, 0.45], r: 0.1, region: ['head'] }, back: { p: [0, 1.0, 0.05], w: 0.18, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.18, 0.9, 0.18], r: 0.09, region: ['chest'] } } });
} };

A.mantis = { H: 2.3, style: 'schwarm', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.8, -0.3), parent: null }, spine: { pos: V(0, 1.0, 0.0), parent: 'hips' }, chest: { pos: V(0, 1.45, 0.15), parent: 'spine' }, neck: { pos: V(0, 1.8, 0.22), parent: 'chest' }, head: { pos: V(0, 1.92, 0.28), parent: 'neck' } };
  const ch = { mat: 'chitin', col: 'primary', wear: 1 };
  bugBody(S, [[[0, 0.75, -0.55], [0.17, 0.17, 0.5], ['hips']]], ch);
  S.group({ k: 0.04 }, () => { S.capsule([0, 0.9, -0.1], [0, 1.8, 0.22], 0.12, 0.08, { ...ch, region: ['spine', 'chest'] }); });
  // dreieckiger Kopf
  S.prim([0, 1.95, 0.3], { f: (x, y, z) => { const w = 0.16 * (1 - max(0, -y) / 0.18); return max(max(abs(x) - max(0.02, w), y - 0.06), max(-0.18 - y, abs(z) - 0.07)); }, box: [-0.17, -0.19, -0.08, 0.17, 0.07, 0.08] }, { ...ch, region: ['head'], rot: [0.3, 0, 0] });
  for (const sx of [1, -1]) { S.sphere([sx * 0.14, 1.98, 0.32], 0.05, { mat: 'eye', col: '#2a3a0a', region: ['head'] }); S.tube([[sx * 0.04, 2.0, 0.34], [sx * 0.12, 2.3, 0.4], [sx * 0.2, 2.42, 0.3]], [0.01, 0.006, 0.003], { ...ch, region: ['head'] }); }
  // Fangarme: erhobene Sicheln (Silhouette), Stufe → länger
  const cls = { hips: [5, 0, 0.06, 2] };
  const L = [0.55, 0.7, 0.85][T(F) - 1];
  for (const [sd, k] of [['L', 1], ['R', -1]]) {
    const nm = 'upperArm' + sd, root = [k * 0.1, 1.6, 0.22], el = [k * 0.22, 1.55, 0.6], tip = add(el, [k * 0.06, L * 0.9, -L * 0.25]);
    J[nm] = { pos: V(...root), parent: 'chest' };
    S.capsule(root, el, 0.05, 0.045, { ...ch, region: [nm] });
    S.prim(el, bladePrim({ y0: 0, L: L, w: 0.07, th: 0.02, curve: 0.25, leaf: 0.1 }), { rot: frame(el, sub(tip, el), [1, 0, 0]).basis, mat: 'horn', col: 'secondary', region: [nm] });
    cls[nm] = [k > 0 ? 2 : 8, k > 0 ? PI : 0, 1.6, 0.22];
  }
  bugLegs(S, J, cls, 2, { rx: 0.08, y: 0.95, kx: 0.42, ky: 1.1, fx: 0.55, z0: 0.0, dz: 0.4, r: 0.03, mat: ch, parent: 'spine' });
  // Flügeldecken (gefaltet, auf dem Hinterleib)
  S.sym(() => S.ellipsoid([0.08, 0.92, -0.5], [0.1, 0.03, 0.45], { rot: [0.1, 0.1, 0.2], mat: 'chitin', col: 'primary*1.4', region: ['hips'] }));
  glow(S, () => { for (const sx of [1, -1]) S.sphere([sx * 0.14, 2.0, 0.36], 0.022, G({ region: ['head'], glow: 3.6 })); if (isB(F)) for (const sd of [1, -1]) S.capsule([sd * 0.24, 1.6, 0.62], add([sd * 0.24, 1.6, 0.62], [sd * 0.05, L * 0.8, -L * 0.2]), 0.018, 0.004, G({ region: [sd > 0 ? 'upperArmL' : 'upperArmR'], glow: 3.2 })); });
  return plan(J, { cls, radius: 0.6, H: 2.3, hipY: 0.9, anchors: { head: { p: [0, 2.06, 0.26], r: 0.1, region: ['head'] }, back: { p: [0, 1.4, 0.02], w: 0.16, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.12, 1.65, 0.18], r: 0.08, region: ['chest'] } } });
} };

// =============================================================================================
// GLUTGEBORENE
// =============================================================================================
A.elemental = { H: 2.2, style: 'glut', build(S, P, F) {
  const s = 1.05;
  const J = humanoid(s, { sw: 1.3, armR: [[0.4, 1.05, 0.12], [0.44, 0.78, 0.22]], armL: [[0.4, 1.05, 0.12], [0.44, 0.78, 0.22]], stance: 0.08 });
  const rock = { mat: 'stone', col: 'primary', disp: Detail.noise({ amp: 0.016, freq: 8, ridged: true }) };
  // Brocken um einen glühenden Kern (getrennte Felsstücke = Silhouette)
  const ch = jp(J, 'chest');
  glow(S, () => { S.ellipsoid(add(ch, [0, 0.02, 0]), [0.27, 0.32, 0.24], G({ col: 'secondary', region: 'torso', glow: 2.2 })); S.capsule(jp(J, 'hips'), ch, 0.16, G({ col: 'secondary', region: 'torso', glow: 2 })); for (const sd of ['L', 'R']) S.capsule(jp(J, 'upperArm' + sd), jp(J, 'hand' + sd), 0.06, 0.07, G({ col: 'secondary', region: 'arm' + sd, glow: 2 })); });
  for (const [o, r] of [[[0.2, 0.17, 0.12], [0.16, 0.14, 0.12]], [[-0.2, 0.14, 0.1], [0.15, 0.16, 0.12]], [[0, -0.16, 0.16], [0.18, 0.1, 0.1]], [[0.12, 0.12, -0.2], [0.14, 0.16, 0.1]], [[-0.12, -0.02, -0.2], [0.13, 0.14, 0.1]]]) S.ellipsoid(add(ch, o), r, { ...rock, region: 'torso' });
  S.ellipsoid(jp(J, 'hips'), [0.22, 0.13, 0.17], { ...rock, region: 'torso' });
  for (const sd of ['L', 'R']) {
    const sh = jp(J, 'upperArm' + sd), el = jp(J, 'foreArm' + sd), ha = jp(J, 'hand' + sd);
    S.ellipsoid(add(sh, [sd === 'L' ? 0.06 : -0.06, 0.06, 0]), [0.18, 0.16, 0.17], { ...rock, region: 'shoulder' + sd });
    S.ellipsoid(lerp3(sh, el, 0.5), [0.1, 0.13, 0.1], { ...rock, region: 'arm' + sd });
    S.ellipsoid(ha, [0.13, 0.15, 0.13], { ...rock, region: 'arm' + sd });
    S.capsule(jp(J, 'thigh' + sd), jp(J, 'shin' + sd), 0.1, 0.09, { ...rock, region: 'leg' + sd });
    S.capsule(jp(J, 'shin' + sd), add(jp(J, 'foot' + sd), [0, -0.03, 0.05]), 0.09, 0.11, { ...rock, region: 'leg' + sd });
    glow(S, () => { S.sphere(el, 0.07, G({ region: 'arm' + sd, glow: 3 })); S.sphere(jp(J, 'shin' + sd), 0.07, G({ region: 'leg' + sd, glow: 2.8 })); });
  }
  // Flammenkopf
  const hd = add(jp(J, 'head'), [0, 0.1, 0.02]);
  S.ellipsoid(add(hd, [0, -0.04, 0.02]), [0.1, 0.08, 0.1], { ...rock, region: 'head' });
  const fl = [0.32, 0.42, 0.55][T(F) - 1];
  glow(S, () => { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; S.capsule(add(hd, [sin(a) * 0.06, 0.02, cos(a) * 0.06]), add(hd, [sin(a) * 0.04, fl * (0.7 + 0.3 * (i % 2)), cos(a) * 0.04 - 0.08]), 0.07, 0.01, G({ region: 'head', glow: 3.4 })); } for (const sx of [1, -1]) S.sphere(add(hd, [sx * 0.045, -0.02, 0.1]), 0.022, G({ region: 'head', glow: 4 })); });
  return plan(J, { radius: 0.72, H: 2.2, anchors: humanAnchors(J, s, { headTop: 0.32, shX: 0.06, shY: 0.14, shR: 0.13 }) });
} };

A.pyromancer = { H: 2.25, style: 'glut', build(S, P, F) {
  const { J, BL, BR, s } = mageBody(S, F, { robe: 'secondary*0.5', skin: '#b87050', female: true, wave: 0.04 });
  const H = head(S, BL, { female: true, skin: '#b87050', eye: '#ffd040', brow: false, lips: '#4a1a1a' });
  // Hörner-Diadem + Flammenhaar
  for (const sx of [1, -1]) S.tube([H.at(sx * 0.07, 0.07, 0.03), H.at(sx * 0.14, 0.16, -0.04), H.at(sx * 0.16, 0.28, -0.14)], [0.022, 0.015, 0.004], { mat: 'horn', col: '#1a1010', region: 'head' });
  S.torus(H.at(0, 0.05, 0.0), 0.1, 0.012, { rot: [0.2, 0, 0], mat: 'gold', col: 'metal', region: 'head' });
  const fl = [0.3, 0.4, 0.5][T(F) - 1];
  glow(S, () => { for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; S.capsule(H.at(sin(a) * 0.08, 0.08, -0.04 + cos(a) * 0.04), H.at(sin(a) * 0.1, 0.1 + fl * (0.6 + 0.4 * (i % 2)), -0.2 - fl * 0.4), 0.05, 0.008, G({ region: 'head', glow: 3.2 })); } });
  // Feuer in beiden Händen
  glow(S, () => { for (const sd of ['L', 'R']) { const ha = jp(J, 'hand' + sd); S.capsule(add(ha, [0, 0.05, 0.04]), add(ha, [0, 0.2 + 0.05 * T(F), 0.08]), 0.07, 0.01, G({ region: 'arm' + sd, glow: 3.4 })); } });
  // Gürtel mit Glutsteinen
  belt(S, BL, { dy: 0.08, col: 'metal', mat: 'gold' });
  glow(S, () => { for (let i = 0; i < 3; i++) S.sphere(add(jp(J, 'hips'), [(i - 1) * 0.1, 0.1, 0.17]), 0.025, G({ region: 'pelvis' })); });
  return plan(J, { radius: 0.6, H: 2.25, anchors: humanAnchors(J, s, { headTop: 0.26 }) });
} };

A.salamander = { H: 1.2, style: 'glut', build(S, P, F) {
  const J = quadSkeleton({ y: 0.42, zf: 0.35, zb: -0.35, w: 0.24, headP: [0, 0.48, 0.85] });
  J.neck.pos.y = 0.45; J.neck.pos.z = 0.6;
  J.tail.pos = V(0, 0.38, -0.6); J.tail1.pos = V(0.15, 0.3, -1.0); J.tail2.pos = V(0.05, 0.2, -1.45);
  for (const sd of ['L', 'R']) { const k = sd === 'L' ? 1 : -1; J['fknee' + sd].pos = V(k * 0.42, 0.32, 0.4); J['fpaw' + sd].pos = V(k * 0.5, 0.05, 0.48); J['bknee' + sd].pos = V(k * 0.44, 0.3, -0.38); J['bpaw' + sd].pos = V(k * 0.52, 0.05, -0.46); }
  const sc = { mat: 'scale', col: 'primary*1.5', disp: Detail.noise({ amp: 0.005, freq: 30 }) };
  const p = (n) => jp(J, n);
  S.group({ k: 0.08 }, () => {
    S.ellipsoid(p('spine'), [0.3, 0.2, 0.55], { ...sc, region: ['chest', 'spine', 'hips'] });
    S.capsule(p('chest'), p('head'), 0.2, 0.14, { ...sc, region: ['chest', 'neck', 'head'] });
    S.ellipsoid(add(p('head'), [0, -0.02, 0.1]), [0.17, 0.1, 0.2], { ...sc, region: ['head'] });
    for (const sd of ['L', 'R']) {
      S.capsule(p('fleg' + sd), p('fknee' + sd), 0.08, 0.06, { ...sc, region: ['chest', 'fleg' + sd, 'fknee' + sd] }); S.capsule(p('fknee' + sd), p('fpaw' + sd), 0.06, 0.05, { ...sc, region: ['fknee' + sd, 'fpaw' + sd] });
      S.capsule(p('bleg' + sd), p('bknee' + sd), 0.09, 0.06, { ...sc, region: ['hips', 'bleg' + sd, 'bknee' + sd] }); S.capsule(p('bknee' + sd), p('bpaw' + sd), 0.06, 0.05, { ...sc, region: ['bknee' + sd, 'bpaw' + sd] });
    }
    S.tube([p('hips'), p('tail'), p('tail1'), p('tail2')], [0.2, 0.15, 0.08, 0.02], { ...sc, region: ['hips', 'tail', 'tail1', 'tail2'], kj: 0.05 });
    S.plane([0, 0, 0], [0, -1, 0], { op: 'int' });
  });
  S.ellipsoid(add(p('spine'), [0, -0.08, 0.05]), [0.24, 0.1, 0.45], { mat: 'scale', col: 'secondary', region: ['spine'] });
  for (const sx of [1, -1]) S.sphere(add(p('head'), [sx * 0.11, 0.06, 0.14]), 0.03, { mat: 'eye', col: '#ffd040', region: ['head'] });
  // Flammenkamm (Rückenflosse) – wächst
  const fh = [0.22, 0.32, 0.42][T(F) - 1];
  for (let i = 0; i < 9; i++) { const t = i / 8, z = 0.55 - t * 1.6, y = 0.6 - t * 0.3; S.capsule([0, y - 0.06, z], [0, y + fh * sin(PI * (0.15 + 0.85 * t)) * (1 - 0.5 * t), z - 0.1], 0.05, 0.01, { mat: 'horn', col: '#2a1a14', region: ['spine', 'hips', 'tail'] }); }
  glow(S, () => { for (let i = 0; i < 9; i++) { const t = i / 8, z = 0.55 - t * 1.6, y = 0.6 - t * 0.3; S.sphere([0, y + fh * sin(PI * (0.15 + 0.85 * t)) * (1 - 0.5 * t), z - 0.1], 0.035, G({ region: ['spine', 'hips', 'tail'], glow: 3.4 })); } if (isB(F)) S.capsule(add(p('head'), [0, -0.03, 0.3]), add(p('head'), [0, -0.05, 0.6]), 0.07, 0.015, G({ region: ['head'], glow: 3.6 })); });
  const c = quadCls(J, 1.2, 0.42); tailCls(c, ['tail', 'tail1', 'tail2'], 2.3, 0.07);
  return plan(J, { cls: c, radius: 0.75, H: 0.9, anchors: { head: { p: add(p('head'), [0, 0.1, -0.04]), r: 0.1, region: ['head'] }, back: { p: [0, 0.62, 0.15], w: 0.25, region: ['chest', 'spine'], parentJoint: 'chest' }, shoulder: { p: [0.28, 0.56, 0.35], r: 0.1, region: ['chest', 'flegL'] } } });
} };

A.imp = { H: 1.4, style: 'glut', hover: true, build(S, P, F) {
  const s = 0.68;
  const J = humanoid(s, { sw: 1.2, armR: [[0.3, 1.22, 0.16], [0.3, 1.12, 0.36]], armL: [[0.3, 1.2, 0.16], [0.26, 1.32, 0.32]] });
  J.weaponR = { pos: V(-0.3 * s, 1.12 * s, 0.38 * s), parent: 'handR' };
  const skin = { mat: 'skin', col: 'secondary*0.8' };
  const { BL, BR } = humanBody(S, J, s, { bulk: 1.3, armBulk: 1.2, legBulk: 1.1, base: skin });
  S.ellipsoid(add(jp(J, 'spine'), [0, 0.0, 0.05]), [0.16, 0.15, 0.14], { ...skin, region: 'torso' });
  // großer Kopf mit Hörnern
  const hc = add(jp(J, 'head'), [0, 0.1, 0.03]);
  S.ellipsoid(hc, [0.13, 0.12, 0.12], { ...skin, region: 'head' });
  S.capsule(add(hc, [0, -0.05, 0.08]), add(hc, [0, -0.08, 0.14]), 0.05, 0.03, { ...skin, region: 'head' });
  for (const sx of [1, -1]) { S.tube([add(hc, [sx * 0.08, 0.07, 0.0]), add(hc, [sx * 0.16, 0.16, -0.06]), add(hc, [sx * 0.15, 0.28, -0.14])], [0.035, 0.022, 0.004], { mat: 'horn', col: '#1a1010', region: 'head' }); S.capsule(add(hc, [sx * 0.11, 0.0, -0.02]), add(hc, [sx * 0.22, 0.05, -0.08]), 0.03, 0.006, { ...skin, region: 'head' }); }
  bothSides(S, BL, BR, (B0) => { simpleHand(S, B0, 'secondary*0.8', 'skin'); simpleBoot(S, B0, '#1a1010'); });
  skirt(S, BL, { top: 1.02 * s, bottom: 0.72 * s, r0: 0.17, r1: 0.22, col: 'primary', mat: 'leather', folds: 5, fold: 0.01, th: 0.018, slits: [0, PI] });
  S.tube([add(jp(J, 'hips'), [0, -0.05, -0.12]), [0, 0.3, -0.4], [0.15, 0.2, -0.65], [0.1, 0.35, -0.8]], [0.035, 0.025, 0.015, 0.004], { ...skin, region: 'torso' });
  // Dreizack (keine Marke – einfacher Spieß)
  const fr = frame(jp(J, 'weaponR'), [0, 1, 0.15], [1, 0, 0]);
  S.capsule(fr.at(0, -0.4), fr.at(0, 0.85), 0.02, { mat: 'iron', col: 'metal', bone: 'weaponR' });
  for (const a of [-1, 0, 1]) S.capsule(fr.at(a * 0.07, 0.85), fr.at(a * 0.08, 1.05 + (a ? 0 : 0.05)), 0.016, 0.003, { mat: 'iron', col: 'metal', bone: 'weaponR' });
  // Flügel (klein, Fledermaus)
  const c = {};
  if (!(F.tier >= 3 && F.path === 'b')) {
    for (const [sd, k] of [['L', 1], ['R', -1]]) { const root = [k * 0.1, 1.15 * s + 0.15, -0.1]; J['wing' + sd] = { pos: V(...root), parent: 'chest' }; c['wing' + sd] = [4, root[0], root[1], 0]; }
    S.sym(() => wing(S, [0.1, 1.15 * s + 0.15, -0.1], [0.55, 0.7, 0.8][T(F) - 1], { style: 'abgrund', region: ['wingL'], up: 0.8, bone: '#2a1a1a', skin: 'primary*1.5' }));
  }
  glow(S, () => { for (const sx of [1, -1]) S.sphere(add(hc, [sx * 0.05, 0.02, 0.11]), 0.022, G({ region: 'head', glow: 4 })); S.sphere(add(jp(J, 'handL'), [0, 0.07, 0.03]), 0.06 + 0.015 * T(F), G({ region: 'armL', glow: 3.4 })); });
  return plan(J, { cls: c, radius: 0.5, H: 1.3, anchors: humanAnchors(J, s, { headTop: 0.36, headR: 0.13 }), wingL: 1.2 });
} };

A.priest_glut = { H: 2.4, style: 'glut', build(S, P, F) {
  const s = 1.05;
  const { J, BL, BR } = hum(S, s, { armR: [[0.3, 1.2, 0.12], [0.3, 1.1, 0.3]], armL: [[0.3, 1.2, 0.12], [0.2, 1.22, 0.32]] }, { female: true, base: { mat: 'cloth', col: '#5a1a16' } });
  J.weaponR = { pos: V(-0.3 * s, 1.1 * s, 0.32 * s), parent: 'handR' };
  bothSides(S, BL, BR, (B0) => simpleHand(S, B0, '#b87050', 'skin'));
  robe(S, BL, s, '#5a1a16', { r1: 0.4, hem: 'metal', fold: 0.016 });
  skirt(S, BL, { top: 1.1 * s, bottom: 0.15, r0: 0.18, r1: 0.4, col: 'secondary', mat: 'silk', folds: 4, fold: 0.006, th: 0.016, panels: [[0, 0.35]] });
  // Schulterkragen aus Goldplatten
  for (let i = 0; i < 7; i++) { const a = -1.5 + i * 0.5; S.ellipsoid(add(jp(J, 'neck'), [sin(a) * 0.2, -0.07, cos(a) * 0.14]), [0.08, 0.02, 0.1], { rot: [0.4, a, 0], mat: 'gold', col: 'metal', region: 'upper' }); }
  const H = head(S, BL, { female: true, skin: '#b87050', eye: '#ffd040', brow: false });
  // hoher Flammen-Kopfschmuck (Fächer)
  const fh = [0.35, 0.45, 0.55][T(F) - 1];
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; S.capsule(H.at(sin(a) * 0.08, 0.08, -0.03), H.at(sin(a) * 0.22, 0.1 + fh * cos(a), -0.08), 0.02, 0.008, { mat: 'gold', col: 'metal', region: 'head' }); }
  glow(S, () => { for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; S.sphere(H.at(sin(a) * 0.22, 0.1 + fh * cos(a), -0.08), 0.03, G({ region: 'head', glow: 3.4 })); } });
  // Weihrauchfass an Kette
  const fr = frame(jp(J, 'weaponR'), [0, -1, 0.1], [1, 0, 0]);
  S.capsule(fr.at(0, 0), fr.at(0, 0.35), 0.01, { mat: 'gold', col: 'metal', bone: 'weaponR' });
  S.sphere(fr.at(0, 0.45), 0.09, { mat: 'gold', col: 'metal', bone: 'weaponR' });
  glow(S, () => { S.sphere(fr.at(0, 0.45, 0.05), 0.06, G({ bone: 'weaponR', glow: 3.6 })); S.sphere(add(jp(J, 'handL'), [0, 0.06, 0.04]), 0.05, G({ region: 'armL', glow: 3 })); });
  return plan(J, { radius: 0.62, H: 2.4, anchors: humanAnchors(J, s, { headTop: 0.24 }) });
} };

A.phoenix = { H: 2.2, style: 'glut', build(S, P, F) {
  const J = { hips: { pos: V(0, 0.75, -0.1), parent: null }, spine: { pos: V(0, 0.95, 0.0), parent: 'hips' }, chest: { pos: V(0, 1.15, 0.12), parent: 'spine' }, neck: { pos: V(0, 1.45, 0.25), parent: 'chest' }, head: { pos: V(0, 1.7, 0.3), parent: 'neck' },
    thighL: { pos: V(0.12, 0.7, 0), parent: 'hips' }, shinL: { pos: V(0.14, 0.38, 0.06), parent: 'thighL' }, footL: { pos: V(0.14, 0.04, 0.1), parent: 'shinL' },
    thighR: { pos: V(-0.12, 0.7, 0), parent: 'hips' }, shinR: { pos: V(-0.14, 0.38, 0.06), parent: 'thighR' }, footR: { pos: V(-0.14, 0.04, 0.1), parent: 'shinR' },
    tail: { pos: V(0, 0.75, -0.4), parent: 'hips' }, tail1: { pos: V(0, 0.5, -0.9), parent: 'tail' }, tail2: { pos: V(0, 0.2, -1.3), parent: 'tail1' } };
  const fea = { mat: 'feather', col: 'primary*2.4', disp: Detail.fur({ amp: 0.006, freq: 28, dir: [0, -0.4, -1] }) };
  S.group({ k: 0.1 }, () => {
    S.ellipsoid([0, 1.0, 0.0], [0.26, 0.36, 0.3], { ...fea, region: ['hips', 'spine', 'chest'] });
    S.capsule([0, 1.15, 0.12], [0, 1.6, 0.28], 0.15, 0.1, { ...fea, region: ['chest', 'neck'] });
    S.ellipsoid([0, 1.72, 0.3], [0.12, 0.12, 0.14], { ...fea, region: ['head'] });
  });
  S.capsule([0, 1.7, 0.4], [0, 1.6, 0.58], 0.05, 0.01, { mat: 'horn', col: 'metal', region: ['head'] });
  for (const sd of ['L', 'R']) { const f = jp(J, 'foot' + sd); S.capsule(jp(J, 'thigh' + sd), jp(J, 'shin' + sd), 0.07, 0.04, { ...fea, region: ['thigh' + sd, 'shin' + sd] }); S.capsule(jp(J, 'shin' + sd), f, 0.03, 0.025, { mat: 'scale', col: 'metal', region: ['shin' + sd, 'foot' + sd] }); for (let k = 0; k < 3; k++) S.capsule(f, add(f, [(k - 1) * 0.06, -0.02, 0.12]), 0.02, 0.006, { mat: 'horn', col: '#2a1a14', region: ['foot' + sd] }); }
  // Flammenschweif (lang) + Kamm
  const tl = [0.9, 1.15, 1.4][T(F) - 1];
  glow(S, () => {
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.22; S.tube([[0, 0.8, -0.35], [sin(a) * 0.25, 0.55, -0.35 - tl * 0.55], [sin(a) * 0.5, 0.25 + 0.1 * (i % 2), -0.35 - tl]], [0.07, 0.05, 0.01], G({ region: ['tail', 'tail1', 'tail2'], glow: 3 + 0.4 * (i % 2) })); }
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; S.capsule([0, 1.8, 0.28], [sin(a) * 0.12, 2.0 + 0.1 * cos(a * 2), 0.1], 0.03, 0.006, G({ region: ['head'], glow: 3.4 })); }
    for (const sx of [1, -1]) S.sphere([sx * 0.07, 1.74, 0.4], 0.022, G({ region: ['head'], glow: 4 }));
  });
  const c = {}; tailCls(c, ['tail', 'tail1', 'tail2'], 2.0, 0.05);
  if (!(F.tier >= 3 && F.path === 'b')) {
    for (const [sd, k] of [['L', 1], ['R', -1]]) { const root = [k * 0.22, 1.2, -0.02]; J['wing' + sd] = { pos: V(...root), parent: 'chest' }; c['wing' + sd] = [4, root[0], root[1], 0]; }
    S.sym(() => wing(S, [0.22, 1.2, -0.02], [0.9, 1.15, 1.35][T(F) - 1], { style: 'glut', region: ['wingL'], up: 0.6 }));
  }
  return plan(J, { cls: c, radius: 0.65, H: 2.0, hipY: 0.75, anchors: { head: { p: [0, 1.86, 0.28], r: 0.1, region: ['head'] }, back: { p: [0, 1.2, -0.2], w: 0.24, region: ['chest'], parentJoint: 'chest' }, shoulder: { p: [0.22, 1.25, 0.1], r: 0.1, region: ['chest'] } }, wingL: 1.35 });
} };

// Arbeiter: schwebender Funke (Bergbau-Drohnchen)
A.worker = { H: 0.9, style: 'orden', hover: true, noForm: true, build(S, P, F) {
  const J = { hips: { pos: V(0, 0.45, 0), parent: null } };
  glass(S, () => S.prim([0, 0.12, 0], crystalPrim(0.16, 0.65), { mat: 'crystal', col: 'secondary', region: ['hips'] }));
  glow(S, () => S.sphere([0, 0.4, 0], 0.12, G({ region: ['hips'], glow: 4 })));
  S.torus([0, 0.4, 0], 0.3, 0.025, { rot: [0.4, 0, 0.2], mat: 'gold', col: 'metal', region: ['hips'] });
  return plan(J, { cls: { hips: [0, 0, 0, 0] }, radius: 0.3, H: 0.8, torsoW: 0, anchors: {} });
} };

export const ARMY = A;
