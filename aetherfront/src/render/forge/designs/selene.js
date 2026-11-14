// Selene Sternweberin – Kristallmagierin: zweilagige fließende Robe (weiß innen, blau außen, offen), hoher
// Kristallkragen, langes Silberhaar, Kristall-Halo (rotiert), schwebende Splitter, Kristallstab mit Sichel.
import {
  joints, torsoShape, neckShape, footShape, handShape, head, belt, skirt, Detail, add, sub, scl, norm, lerp3,
  PI, TAU, clamp, smooth, weaponFrame, bodyBase, chainBind, hairStrands,
} from './lib.js';
import { staff } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot } = Math;

/** Kristall (sechseckiges Prisma mit Spitze) entlang Richtung */
export function crystalPrim(r, h) {
  return {
    f: (x, y, z) => {
      const a = atan2(z, x), sec = PI / 3, aa = ((a % sec) + sec) % sec - sec / 2;
      const rr = hypot(x, z) * cos(aa);
      const top = h * 0.72;
      const side = rr - r * (y > top ? (h - y) / (h - top) : 1);
      return max(max(side, -y - h * 0.12), y - h);
    },
    box: [-r, -h * 0.12, -r, r, h, r],
  };
}

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const info = { radius: 0.42 * s, style: 'mage', cores: [], trails: [] };
  const white = '#ece8f6', blue = 'secondary', silver = 'metal', glowC = P.glow;
  const hips = j('hips'), chest = j('chest'), neck = j('neck');
  S.layer('body');
  bodyBase(S, B, { female: true, bulk: 0.94, armBulk: 0.86, legBulk: 0.9, torso: { mat: 'silk', col: white }, neck: false });
  S.sym(() => footShape(S, B, { w: 0.95, o: { mat: 'leather', col: '#4a4a6a', region: 'legL' } }));
  // Mieder (blau, Silberranken)
  S.shell({ off: 0.006 * s, th: 0.013 * s, mat: 'silk', col: blue, region: 'torso', clip: (x, y, z) => max(hips[1] + 0.04 * s - y, y - chest[1] - 0.13 * s) }, () => torsoShape(S, B, { female: true, bulk: 0.94 }));
  for (const sg of [1, -1]) S.tube([[sg * 0.02 * s, hips[1] + 0.05 * s, 0.125 * s], [sg * 0.05 * s, chest[1] + 0.02 * s, 0.14 * s], [sg * 0.11 * s, chest[1] + 0.14 * s, 0.1 * s]], 0.004 * s, { mat: 'silver', col: silver, region: 'torso', k: 0.003 * s });
  belt(S, B, { dy: 0.055, rx: 0.155, rz: 0.12, h: 0.035, col: silver, mat: 'silver', buckle: silver, buckleMat: 'silver' });
  // innere Robe (weiß) bis zum Boden
  skirt(S, B, { top: hips[1] + 0.06 * s, bottom: 0.03 * s, r0: 0.16, r1: 0.34, col: white, mat: 'silk', folds: 12, fold: 0.013, th: 0.014, hem: silver, hemW: 0.02, grad: { axis: 'y', from: 0.5 * s, to: 0.03 * s, col: '#b8c4f0' } });
  // äußere Robe (blau, vorne offen) mit Sternrunen
  skirt(S, B, { top: hips[1] + 0.07 * s, bottom: 0.06 * s, r0: 0.175, r1: 0.39, col: blue, mat: 'velvet', folds: 9, fold: 0.016, th: 0.014, panels: [[PI, 2.45]], hem: silver, hemW: 0.03, grad: { axis: 'y', from: hips[1], to: 0.1 * s, k: 0.65 } });
  // hoher Kragen (Kristallschuppen) + Schultermantel
  S.shell({ off: 0, th: 0.014 * s, mat: 'velvet', col: blue, region: 'upper', clip: (x, y, z) => max(j('upperArmL')[1] - 0.07 * s - y, y - neck[1] - 0.12 * s + max(0, z - 0.02 * s) * 1.2) }, () => {
    S.lathe([0, 0, -0.015 * s], [[0, neck[1] + 0.2 * s], [0.085 * s, neck[1] + 0.16 * s], [0.1 * s, neck[1] + 0.0 * s], [0.24 * s, neck[1] - 0.15 * s], [0, neck[1] - 0.2 * s]], { disp: Detail.folds({ amp: 0.004 * s, n: 10, top: neck[1], bottom: neck[1] - 0.2 * s }) });
  });
  S.shell({ off: 0.012 * s, th: 0.005 * s, mat: 'silver', col: silver, region: 'upper', clip: (x, y, z) => max(j('upperArmL')[1] - 0.07 * s - y, y - (j('upperArmL')[1] - 0.05 * s)) }, () => {
    S.lathe([0, 0, -0.015 * s], [[0, neck[1] + 0.2 * s], [0.085 * s, neck[1] + 0.16 * s], [0.1 * s, neck[1] + 0.0 * s], [0.24 * s, neck[1] - 0.15 * s], [0, neck[1] - 0.2 * s]], {});
  });
  // Glockenärmel
  S.sym(() => {
    const el = j('foreArmL'), wr = j('handL'), d = norm(sub(wr, el)), L = hypot(...sub(wr, el));
    S.shell({ off: 0, th: 0.013 * s, mat: 'velvet', col: blue, region: 'armL', clip: (x, y, z) => { const t = (x - el[0]) * d[0] + (y - el[1]) * d[1] + (z - el[2]) * d[2]; return max(-t - 0.03 * s, t - L - 0.02 * s); }, disp: Detail.folds({ amp: 0.005 * s, n: 6, top: el[1], bottom: wr[1] }) }, () => S.capsule(el, add(wr, [0.005 * s, -0.03 * s, 0]), 0.05 * s, 0.1 * s, {}));
    S.torus(add(wr, [0.006 * s, -0.012 * s, 0]), 0.1 * s, 0.005 * s, { rot: [0.05, 0, 0.08], mat: 'silver', col: silver, region: 'armL' });
  });
  // Schulterkristalle
  S.layer('glass');
  S.sym(() => S.prim(add(j('upperArmL'), [-0.02 * s, 0.05 * s, 0]), crystalPrim(0.022 * s, 0.1 * s), { rot: [0, 0, -0.5], mat: 'crystal', col: '#9ae8ff', bind: (p) => [['shoulderL', 1]] }));
  S.prim([0, chest[1] + 0.08 * s, 0.14 * s], crystalPrim(0.016 * s, 0.06 * s), { rot: [PI, 0, 0], mat: 'crystal', col: '#9ae8ff', bone: 'chest' });
  S.layer('body');

  // ---- Kopf + Silberhaar (fein) ----
  S.layer('body:fine');
  neckShape(S, B, { r: 0.046, o: { mat: 'skin', col: '#ecc8b4', region: 'neck' } });
  const H = head(S, B, { female: true, skin: '#eec8b2', eye: '#5ad0ff', brow: '#c8ccd8', lips: '#b86a76', jaw: 0.82 });
  const hairC = '#d8dce8';
  S.group({ k: 0 }, () => {
    S.ellipsoid(H.at(0, 0.032, -0.02), [0.091 * s, 0.1 * s, 0.102 * s], { mat: 'hair', col: hairC, region: 'head', disp: Detail.fur({ amp: 0.0025 * s, freq: 70, dir: [0, -1, -0.3] }) });
    S.box(H.at(0, -0.06, 0.035), [0.12 * s, 0.07 * s, 0.09 * s], { op: 'sub', k: 0.02 * s, mat: 'hair', col: hairC });
    S.box(H.at(0, 0.04, 0.105), [0.12 * s, 0.035 * s, 0.05 * s], { op: 'sub', k: 0.02 * s, rot: [0.45, 0, 0], mat: 'hair', col: hairC });
  });
  // Seitensträhnen
  for (const sg of [1, -1]) S.tube([H.at(sg * 0.06, 0.06, 0.05), H.at(sg * 0.09, 0.0, 0.035), H.at(sg * 0.1, -0.1, 0.02), H.at(sg * 0.1, -0.2, 0.0)], (t) => (0.022 - 0.014 * t) * s, { mat: 'hair', col: hairC, bind: (p) => (p[1] > H.c[1] - 0.08 * s ? [['head', 1]] : [['head', 0.5], ['neck', 0.5]]), k: 0.006 * s, disp: Detail.fur({ amp: 0.002 * s, freq: 100, dir: [0, -1, 0] }) });
  // langes Rückenhaar an der Kette
  {
    const hb = chainBind(B, ['hair', 'hair1', 'hair2'], 'head');
    const h0 = P0(B.J.hair.pos);
    for (let k = 0; k < 7; k++) {
      const off = (k - 3) * 0.022 * s;
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(add(h0, [off * (1 + 0.6 * t), 0.02 * s - t * 0.62 * s, 0.01 * s - t * 0.11 * s - sin(t * 2.5) * 0.03 * s])); }
      S.tube(pts, (t) => (0.022 * (1 - 0.7 * t * t) + 0.003) * s, { mat: 'hair', col: hairC, bind: hb, k: 0.008 * s, disp: Detail.fur({ amp: 0.002 * s, freq: 100, dir: [0, -1, 0] }) });
    }
  }
  // Diadem mit Kristall
  S.torus(H.at(0, 0.06, -0.01), 0.096 * s, 0.0035 * s, { rot: [-0.2, 0, 0], arc: 3.6, mat: 'silver', col: silver, region: 'head' });
  S.layer('glass');
  S.prim(H.at(0, 0.07, 0.096), crystalPrim(0.009 * s, 0.04 * s), { rot: [-0.2, 0, 0], mat: 'crystal', col: '#aef0ff', bone: 'head' });
  // Kristall-Halo am Gelenk 'halo' (dreht sich)
  const hc = P0(B.J.halo.pos);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU, r = 0.17 * s, c = add(hc, [cos(a) * r, sin(a) * r, 0]);
    S.prim(c, crystalPrim(0.016 * s, (i % 3 === 0 ? 0.08 : 0.05) * s), { rot: [0, 0, a - PI / 2], mat: 'crystal', col: i % 3 === 0 ? '#d8f8ff' : '#7adcff', bone: 'halo' });
  }
  // schwebende Splitter
  for (let i = 0; i < 3; i++) S.prim(add(P0(B.J['shard' + i].pos), [0, -0.035 * s, 0]), crystalPrim(0.018 * s, 0.075 * s), { mat: 'crystal', col: '#8ae4ff', bone: 'shard' + i, tier: 3 });
  S.layer('glow');
  S.torus(hc, 0.17 * s, 0.0032 * s, { rot: [PI / 2, 0, 0], mat: 'glow', col: glowC, glow: 1.8, bone: 'halo' });
  S.torus(hc, 0.205 * s, 0.0022 * s, { rot: [PI / 2, 0, 0], mat: 'glow', col: glowC, glow: 2.2, bone: 'halo', tier: 9 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; S.sphere(add(hc, [cos(a) * 0.17 * s, sin(a) * 0.17 * s, 0]), 0.007 * s, { mat: 'glow', col: glowC, glow: 2.8, bone: 'halo' }); }
  for (let i = 0; i < 3; i++) S.sphere(P0(B.J['shard' + i].pos), 0.009 * s, { mat: 'glow', col: glowC, glow: 3, bone: 'shard' + i, tier: 3 });
  // Sternrunen am Robensaum
  for (let i = 0; i < 10; i++) { const a = 0.75 + (i / 9) * (TAU - 1.5); S.prim([sin(a) * 0.392 * s, 0.13 * s, cos(a) * 0.392 * s], { f: (x, y, z) => { const r = hypot(x, y), an = atan2(y, x); return max(r - (0.008 + 0.01 * (0.5 + 0.5 * cos(an * 4))) * s, abs(z) - 0.003 * s); }, box: [-0.02 * s, -0.02 * s, -0.004 * s, 0.02 * s, 0.02 * s, 0.004 * s] }, { rot: [0, a, 0], mat: 'glow', col: glowC, glow: 2.2, region: 'skirt', tier: 6 }); }
  S.layer('body:fine');
  S.sym(() => handShape(S, B, { curl: 0.6, bulk: 0.9, o: { mat: 'skin', col: '#ecc8b4', region: ['foreArmL', 'handL'] } }));

  // ---- Kristallstab (schwebt in der rechten Hand) ----
  const fr = weaponFrame(B, 'R', 'weaponR');
  const st = staff(S, fr, { s, len: 1.62, below: 0.62, wood: '#dfe4f2', woodMat: 'lacquer', metal: silver, r: 0.016, bands: [-0.3, 0.1, 0.6] });
  const ty = st.topY;
  // Silbersichel
  { const pts = []; for (let i = 0; i <= 18; i++) { const a = -2.5 + (i / 18) * 5.0; pts.push(fr.at(sin(a) * 0.15 * s, ty + 0.14 * s - cos(a) * 0.15 * s, 0)); } S.tube(pts, (t) => (0.005 + 0.013 * sin(t * PI)) * s, { mat: 'silver', col: silver, bone: 'weaponR' }); }
  S.layer('glass');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    S.prim(fr.at(0, ty + 0.05 * s, 0), crystalPrim(0.032 * s, (i === 0 ? 0.3 : 0.17) * s), { rot: i ? fr.rot(0.5 * cos(a), 0, 0.5 * sin(a)) : fr.basis, mat: 'crystal', col: i ? '#7adcff' : '#d0f6ff', bone: 'weaponR' });
  }
  S.layer('glow');
  S.ellipsoid(fr.at(0, ty + 0.13 * s, 0), [0.03 * s, 0.06 * s, 0.03 * s], { rot: fr.basis, mat: 'glow', col: glowC, glow: 3.6, bone: 'weaponR' });
  S.layer('body');
  info.cores.push({ joint: 'weaponR', p: fr.at(0, ty + 0.11 * s, 0), size: 0.3, k: 2.6 }, { joint: 'halo', p: hc, size: 0.1 });
  info.trails.push({ joint: 'weaponR', a: fr.at(0, ty - 0.2 * s, 0), b: fr.at(0, ty + 0.2 * s, 0) });
  return info;
}
const P0 = (v) => [v.x, v.y, v.z];
void lerp3; void clamp; void smooth; void scl; void hairStrands;
