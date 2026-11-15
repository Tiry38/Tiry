// Mira Sonnenkind – Heilerin/Priesterin: weiß-goldene Roben mit Faltenwurf, Schulterkragen mit Sonnenstrahlen,
// Glockenärmel, geflochtenes Goldhaar mit Diadem, Laternenstab (schwebender Lichtkristall im Goldkäfig).
import {
  joints, frame, handFrame, headInfo, torsoShape, neckShape, footShape, handShape, head, belt, skirt, Detail, add, sub, scl, norm, lerp3,
  PI, TAU, clamp, smooth, weaponFrame, runeLine, bodyBase, hairStrands, bracer,
} from './lib.js';
import { staff } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot } = Math;

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const info = { radius: 0.42 * s, style: 'priest', cores: [], trails: [] };
  const robe = '#efe6d2', gold = 'metal', glowC = P.glow, deep = '#c99a3c';
  const hips = j('hips'), chest = j('chest'), neck = j('neck');
  S.layer('body');
  bodyBase(S, B, { female: true, bulk: 0.95, armBulk: 0.86, legBulk: 0.88, torso: { mat: 'silk', col: robe, vary: 0.05 }, neck: false });
  S.sym(() => footShape(S, B, { w: 0.95, o: { mat: 'leather', col: '#8a6a44', region: 'legL' } }));
  // Mieder (gold bestickt) über dem Oberkörper
  S.shell({ off: 0.006 * s, th: 0.013 * s, mat: 'silk', col: 'secondary*0.8', region: 'torso', clip: (x, y, z) => max(hips[1] + 0.02 * s - y, y - chest[1] - 0.14 * s), disp: Detail.quilt({ amp: 0.0018 * s, cell: 0.035 * s }) }, () => torsoShape(S, B, { female: true, bulk: 0.95 }));
  belt(S, B, { dy: 0.06, rx: 0.15, rz: 0.115, h: 0.05, col: 'secondary', mat: 'gold', buckle: '#fff4cc', buckleMat: 'gold' });
  // lange Robe bis zum Boden + Goldsaum + Verlauf
  skirt(S, B, { top: hips[1] + 0.09 * s, bottom: 0.03 * s, r0: 0.16, r1: 0.36, col: robe, mat: 'silk', folds: 13, fold: 0.014, th: 0.015, hem: gold, hemW: 0.035,
    grad: { axis: 'y', from: 0.6 * s, to: 0.05 * s, col: '#e4c27a' }, hemWave: 0.012 });
  // Vorderbahn (Stola) mit Sonnensymbol
  skirt(S, B, { top: hips[1] + 0.09 * s, bottom: 0.1 * s, r0: 0.175, r1: 0.38, col: 'secondary', mat: 'silk', folds: 5, fold: 0.006, th: 0.014, panels: [[0, 0.32]], hem: '#fff2c4', hemW: 0.02 });
  // Schulterkragen (Strahlen-Mantel)
  S.shell({ off: 0.0, th: 0.014 * s, mat: 'silk', col: robe, region: 'upper', clip: (x, y, z) => {
    const a = atan2(x, z); const ray = 0.02 * s * abs(sin(a * 6));
    return max(j('upperArmL')[1] - 0.08 * s - ray - y, y - neck[1] - 0.04 * s);
  }, disp: Detail.folds({ amp: 0.006 * s, n: 12, top: neck[1], bottom: neck[1] - 0.3 * s }) }, () => {
    S.lathe([0, 0, -0.01 * s], [[0, neck[1] + 0.1 * s], [0.07 * s, neck[1] + 0.06 * s], [0.12 * s, neck[1] - 0.02 * s], [0.25 * s, neck[1] - 0.16 * s], [0, neck[1] - 0.2 * s]], { scale: 1 });
  });
  S.shell({ off: 0.01 * s, th: 0.006 * s, mat: 'gold', col: gold, region: 'upper', clip: (x, y, z) => {
    const a = atan2(x, z); const ray = 0.02 * s * abs(sin(a * 6));
    return max(j('upperArmL')[1] - 0.08 * s - ray - y, y - (j('upperArmL')[1] - 0.06 * s - ray));
  } }, () => {
    S.lathe([0, 0, -0.01 * s], [[0, neck[1] + 0.1 * s], [0.07 * s, neck[1] + 0.06 * s], [0.12 * s, neck[1] - 0.02 * s], [0.25 * s, neck[1] - 0.16 * s], [0, neck[1] - 0.2 * s]], {});
  });
  // hoher Kragen + Brosche
  S.lathe(add(neck, [0, 0.02 * s, -0.01 * s]), [[0.06 * s, 0.07 * s], [0.075 * s, 0.065 * s], [0.085 * s, -0.04 * s], [0.06 * s, -0.04 * s]], { mat: 'gold', col: gold, region: 'neck', r: 0.003 * s });
  S.sphere([0, chest[1] + 0.13 * s, 0.135 * s], 0.022 * s, { mat: 'gold', col: gold, region: 'torso', k: 0.004 * s });
  // Glockenärmel
  S.sym(() => {
    const el = j('foreArmL'), wr = j('handL');
    S.shell({ off: 0.0, th: 0.013 * s, mat: 'silk', col: robe, region: 'armL', clip: (x, y, z) => { const d = norm(sub(wr, el)); const t = (x - el[0]) * d[0] + (y - el[1]) * d[1] + (z - el[2]) * d[2]; return max(-t - 0.04 * s, t - len3(sub(wr, el)) + 0.005 * s); }, disp: Detail.folds({ amp: 0.005 * s, n: 7, top: el[1], bottom: wr[1] }) }, () => {
      S.capsule(el, add(wr, [0.005 * s, -0.01 * s, 0]), 0.055 * s, 0.085 * s, {});
    });
    S.torus(add(wr, [0.005 * s, -0.005 * s, 0]), 0.086 * s, 0.005 * s, { rot: [0.1, 0, 0.05], mat: 'gold', col: gold, region: 'armL' });
  });

  // ---- Kopf (fein) ----
  S.layer('body:fine');
  neckShape(S, B, { r: 0.047, o: { mat: 'skin', col: '#e8b896', region: 'neck' } });
  const H = head(S, B, { female: true, skin: '#eab99a', eye: '#3a7a5a', brow: '#b08a40', lips: '#c0685e', jaw: 0.84 });
  S.with({ region: 'head' }, () => S.group({ k: 0 }, () => {
    // Haarkappe + Hochsteckfrisur + Zopf
    S.ellipsoid(H.at(0, 0.034, -0.024), [0.097 * s, 0.106 * s, 0.107 * s], { mat: 'hair', col: '#d9aa52', disp: Detail.fur({ amp: 0.003 * s, freq: 70, dir: [0, -1, -0.4] }) });
    S.box(H.at(0, -0.055, 0.03), [0.12 * s, 0.07 * s, 0.09 * s], { op: 'sub', k: 0.02 * s, mat: 'hair', col: '#d9aa52' });
    S.box(H.at(0, 0.045, 0.1), [0.12 * s, 0.035 * s, 0.05 * s], { op: 'sub', k: 0.02 * s, rot: [0.5, 0, 0], mat: 'hair', col: '#d9aa52' });
    S.ellipsoid(H.at(0, 0.06, -0.1), [0.05 * s, 0.045 * s, 0.045 * s], { mat: 'hair', col: '#d9aa52', k: 0.02 * s, disp: Detail.fur({ amp: 0.003 * s, freq: 80 }) });
    // Diadem mit Sonnenstein
    S.torus(H.at(0, 0.052, -0.012), 0.094 * s, 0.0038 * s, { rot: [-0.25, 0, 0], arc: 3.6, mat: 'gold', col: gold });
    S.prim(H.at(0, 0.075, 0.09), { f: (x, y, z) => { const r = hypot(x, y), a = atan2(y, x); return max(r - (0.012 + 0.008 * (0.5 + 0.5 * cos(a * 8))) * s, abs(z) - 0.003 * s); }, box: [-0.03 * s, -0.03 * s, -0.004 * s, 0.03 * s, 0.03 * s, 0.004 * s] }, { mat: 'gold', col: gold, rot: [-0.3, 0, 0] });
  }));
  // Zopf über die Schulter (Haar-Kette fehlt im Skelett → Kopf/Hals/Brust)
  {
    const pts = [];
    for (let i = 0; i <= 9; i++) { const t = i / 9; pts.push(add(H.at(0.04 + 0.05 * t, -0.04 - 0.2 * t, -0.06 + 0.09 * t), [0, -t * t * 0.08 * s, 0])); }
    const bind = (p) => { const t = smooth(H.c[1] - 0.05 * s, H.c[1] - 0.25 * s, p[1]); return [['head', 1 - t], ['chest', t]]; };
    for (let k = 0; k < 3; k++) S.tube(pts.map((p, i) => add(p, [0.008 * s * sin(i * 2.1 + k * 2.09), 0, 0.008 * s * cos(i * 2.1 + k * 2.09)])), (t) => (0.012 - 0.006 * t) * s, { mat: 'hair', col: '#d9aa52', bind, k: 0.004 * s, disp: Detail.fur({ amp: 0.0015 * s, freq: 120, dir: [0, -1, 0] }) });
  }
  S.layer('glow');
  S.sphere(H.at(0, 0.075, 0.095), 0.006 * s, { mat: 'glow', col: glowC, glow: 3.4, region: 'head' });
  S.torus(H.at(0, 0.07, -0.14), 0.13 * s, 0.004 * s, { rot: [PI / 2, 0, 0], mat: 'glow', col: glowC, glow: 2.6, bone: 'head', tier: 9 });
  S.sphere([0, chest[1] + 0.13 * s, 0.155 * s], 0.009 * s, { mat: 'glow', col: glowC, glow: 3, region: 'torso' });
  // Sonnenrunen auf der Stola
  for (let i = 0; i < 3; i++) S.torus([0, hips[1] - (0.12 + i * 0.16) * s, 0.205 * s + i * 0.02 * s], (0.03 - i * 0.004) * s, 0.003 * s, { rot: [PI / 2 - 0.12, 0, 0], mat: 'glow', col: glowC, glow: 2.2, region: 'skirt', tier: i ? 3 : 0 });

  // ---- Hände (fein) ----
  S.layer('body:fine');
  S.sym(() => handShape(S, B, { curl: 0.85, bulk: 0.9, o: { mat: 'skin', col: '#e8b896', region: ['foreArmL', 'handL'] } }));

  // ---- Laternenstab ----
  const fr = weaponFrame(B, 'R', 'weaponR');
  const st = staff(S, fr, { s, len: 1.6, below: 0.6, wood: '#f2ead8', woodMat: 'lacquer', metal: gold, r: 0.017, bands: [-0.25, 0.12, 0.62] });
  const ty = st.topY;
  // Sonnenbogen (Krummstab) mit Strahlen
  const hook = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * PI * 1.2; hook.push(fr.at(0.15 * s - cos(a) * 0.15 * s, ty + sin(a) * 0.19 * s, 0)); }
  S.tube(hook, (t) => (0.019 - 0.007 * t) * s, { mat: 'gold', col: gold, bone: 'weaponR', k: 0.004 * s });
  for (let i = 1; i < 8; i++) { const a = (i / 8) * PI; const c = fr.at(0.0, ty + 0.0 * s, 0); const d = fr.dir(-cos(a), sin(a), 0); S.capsule(add(c, scl(d, 0.05 * s)), add(c, scl(d, (i % 2 ? 0.15 : 0.11) * s)), 0.007 * s, 0.0015 * s, { mat: 'gold', col: gold, bone: 'weaponR' }); }
  S.sphere(fr.at(0, ty, 0), 0.036 * s, { mat: 'gold', col: gold, bone: 'weaponR', k: 0.006 * s });
  // Laterne am Bogenende (Käfig)
  const lc = B.J.lantern ? [B.J.lantern.pos.x, B.J.lantern.pos.y, B.J.lantern.pos.z] : fr.at(0.25 * s, ty - 0.02 * s, 0);
  S.with({ bone: 'weaponR' }, () => {
    S.capsule(hook[hook.length - 1], add(lc, [0, 0.075 * s, 0]), 0.0028 * s, { mat: 'gold', col: gold });
    S.lathe(lc, [[0, 0.08 * s], [0.03 * s, 0.078 * s], [0.05 * s, 0.058 * s], [0.045 * s, 0.048 * s], [0, 0.05 * s]], { mat: 'gold', col: gold, r: 0.002 * s });
    S.lathe(lc, [[0, -0.07 * s], [0.045 * s, -0.062 * s], [0.05 * s, -0.05 * s], [0.03 * s, -0.045 * s], [0, -0.045 * s]], { mat: 'gold', col: gold, r: 0.002 * s });
    S.capsule(add(lc, [0, -0.07 * s, 0]), add(lc, [0, -0.12 * s, 0]), 0.008 * s, 0.002 * s, { mat: 'gold', col: gold });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.tube([add(lc, [cos(a) * 0.044 * s, -0.048 * s, sin(a) * 0.044 * s]), add(lc, [cos(a) * 0.052 * s, 0, sin(a) * 0.052 * s]), add(lc, [cos(a) * 0.044 * s, 0.052 * s, sin(a) * 0.044 * s])], 0.0034 * s, { mat: 'gold', col: gold }); }
  });
  S.layer('glass');
  S.ellipsoid(lc, [0.034 * s, 0.044 * s, 0.034 * s], { mat: 'crystal', col: '#fff0c0', bone: 'weaponR' });
  S.layer('glow');
  S.prim(lc, { f: (x, y, z) => { const ay = abs(y), r = hypot(x, z); return max(r + ay * 0.5 - 0.022 * s, ay - 0.04 * s); }, box: [-0.03 * s, -0.045 * s, -0.03 * s, 0.03 * s, 0.045 * s, 0.03 * s] }, { mat: 'glow', col: glowC, glow: 4, bone: 'weaponR' });
  S.sphere(fr.at(0, ty, 0.02 * s), 0.009 * s, { mat: 'glow', col: glowC, glow: 3.4, bone: 'weaponR' });
  S.layer('body');
  info.cores.push({ joint: 'weaponR', p: lc, size: 0.18, k: 1.6 }, { joint: 'weaponR', p: fr.at(0, ty, 0), size: 0.12 });
  info.trails.push({ joint: 'weaponR', a: fr.at(0, ty - 0.3 * s, 0), b: fr.at(0, ty + 0.1 * s, 0) });
  info.light = { joint: 'lantern', color: glowC, intensity: 0.9, distance: 4 };
  return info;
}
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
