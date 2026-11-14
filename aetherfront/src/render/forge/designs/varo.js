// Varo Schattenklinge – Schurke: dunkles Leder mit roten Akzenten, Kapuze + Gesichtsmaske, Schal und Schärpe
// (Sekundärbewegung), Riemen mit Wurfmessern/Taschen, zwei gekrümmte Glutklingen.
import {
  joints, torsoShape, neckShape, footShape, handShape, head, belt, skirt, pauldron, bracer, boot, Detail, add, sub, scl, norm, lerp3,
  PI, TAU, clamp, smooth, weaponFrame, bodyBase, chainBind, craniumShape, headInfo,
} from './lib.js';
import { dagger } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot } = Math;

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const info = { radius: 0.45 * s, style: 'dual', cores: [], trails: [] };
  const dark = 'primary', red = 'secondary', metal = 'metal', glowC = P.glow, leather = '#2a2030', bl = '#1a1620';
  const hips = j('hips'), chest = j('chest'), neck = j('neck');
  S.layer('body');
  bodyBase(S, B, { bulk: 1.0, armBulk: 1.02, legBulk: 1.0, torso: { mat: 'cloth', col: '#2a2236' }, legs: { mat: 'leather', col: '#221c2a' }, neck: false });
  S.sym(() => boot(S, B, { h: 0.36, col: bl, cuff: red, cuffMat: 'leather', w: 1.0 }));
  // Lederwams mit überlappenden Platten (gesteppt) + roter Saum
  S.shell({ off: 0.007 * s, th: 0.013 * s, mat: 'dleather', col: leather, region: 'torso', clip: (x, y, z) => max(hips[1] - 0.06 * s - y, y - neck[1] + 0.02 * s), disp: Detail.quilt({ amp: 0.0022 * s, cell: 0.04 * s }) }, () => torsoShape(S, B, {}));
  S.shell({ off: 0.016 * s, th: 0.005 * s, mat: 'leather', col: red, region: 'torso', clip: (x, y, z) => max(abs(x + (y - chest[1]) * 0.35 - 0.02 * s) - 0.012 * s, max(hips[1] - 0.06 * s - y, y - neck[1])) }, () => torsoShape(S, B, {}));
  // Kreuzgurte mit Wurfmessern
  for (const sx of [1, -1]) S.tube([[sx * 0.15 * s, chest[1] + 0.17 * s, 0.06 * s], [sx * 0.02 * s, chest[1] + 0.05 * s, 0.14 * s], [-sx * 0.14 * s, hips[1] + 0.06 * s, 0.11 * s]], 0.01 * s, { mat: 'leather', col: '#1a1218', region: 'torso', k: 0.004 * s });
  for (let i = 0; i < 4; i++) { const p = [0.09 * s - i * 0.03 * s, chest[1] + 0.12 * s - i * 0.035 * s, 0.13 * s]; S.capsule(p, add(p, [0.012 * s, 0.05 * s, 0.006 * s]), 0.006 * s, 0.001 * s, { mat: 'steel', col: '#b8bcc8', region: 'torso', k: 0.002 * s }); }
  belt(S, B, { dy: -0.03, rx: 0.165, rz: 0.125, h: 0.04, col: '#1a1218', buckle: metal, buckleMat: 'steel' });
  S.sym(() => S.box([0.14 * s, hips[1] - 0.05 * s, 0.05 * s], [0.03 * s, 0.035 * s, 0.02 * s], { mat: 'leather', col: '#3a2a30', region: 'pelvis', r: 0.009 * s, rot: [0, 1.0, 0] }));
  // geschlitzter Mantelschoß
  skirt(S, B, { top: hips[1] - 0.03 * s, bottom: j('shinL')[1] + 0.12 * s, r0: 0.17, r1: 0.25, col: dark, mat: 'leather', folds: 7, fold: 0.008, th: 0.014, slits: [0, 1.2, -1.2], slitFrom: 0.05, hem: red, hemW: 0.014, hemMat: 'leather' });
  // Schärpe (Kette sash) – rot, hängt an der linken Hüfte
  {
    const sb = chainBind(B, ['sash', 'sash1', 'sash2'], 'hips');
    const p0 = P0(B.J.sash.pos), p1 = P0(B.J.sash1.pos), p2 = P0(B.J.sash2.pos);
    S.tube([add(p0, [0, 0.02 * s, 0.01 * s]), p1, add(p2, [0, -0.06 * s, 0])], [0.03 * s, 0.026 * s, 0.022 * s], { mat: 'silk', col: red, bind: sb, k: 0.01 * s, disp: Detail.bunch({ amp: 0.003 * s, freq: 60 }) });
  }
  // Schulter: einzelne Lederplatte links, Armschienen beidseitig
  pauldron(S, B, { r: 0.11, layers: 3, col: leather, col2: '#3a2a3a', mat: 'dleather', trim: red, trimMat: 'leather', tilt: 0.55, th: 0.013 });
  S.sym(() => bracer(S, add(j('foreArmL'), [0, -0.035 * s, 0]), add(j('handL'), [0, 0.014 * s, 0]), 0.047 * s, 0.039 * s, { s, mat: 'dleather', col: leather, region: 'armL', rimMat: 'steel', rimCol: metal, ridge: true }));
  // Kapuze (über dem Kopf) + Schal an der Kette
  const H0 = headInfo(B);
  S.shell({ off: 0.014 * s, th: 0.014 * s, mat: 'cloth', col: dark, bind: (p) => (p[1] > H0.c[1] - 0.06 * s ? [['head', 1]] : [['head', 0.4], ['neck', 0.3], ['chest', 0.3]]), clip: (x, y, z) => {
    const lx = x - H0.c[0], ly = y - H0.c[1], lz = z - H0.c[2];
    const face = max(max(abs(lx) - 0.065 * s, ly - 0.06 * s), -lz + 0.03 * s);
    return max(-face, -(ly + 0.2 * s));
  }, disp: Detail.folds({ amp: 0.004 * s, n: 6, top: H0.c[1] + 0.1 * s, bottom: H0.c[1] - 0.2 * s }) }, () => {
    S.ellipsoid(H0.at(0, 0.02, -0.02), [0.1 * s, 0.112 * s, 0.11 * s], {});
    S.capsule(H0.at(0, 0.06, -0.04), H0.at(0, 0.0, -0.12), 0.06 * s, 0.03 * s, { k: 0.05 * s });
    S.ellipsoid([0, neck[1] - 0.01 * s, -0.015 * s], [0.13 * s, 0.08 * s, 0.11 * s], { k: 0.05 * s });
  });
  {
    const sc = chainBind(B, ['scarf', 'scarf1', 'scarf2'], 'chest');
    const p0 = P0(B.J.scarf.pos), p1 = P0(B.J.scarf1.pos), p2 = P0(B.J.scarf2.pos);
    S.tube([add(p0, [0, 0.03 * s, 0.03 * s]), p1, add(p2, [0, -0.08 * s, -0.02 * s])], [0.045 * s, 0.04 * s, 0.032 * s], { mat: 'cloth', col: red, bind: sc, k: 0.01 * s, disp: Detail.bunch({ amp: 0.004 * s, freq: 45 }) });
  }

  // ---- Kopf mit Gesichtsmaske (fein) ----
  S.layer('body:fine');
  neckShape(S, B, { r: 0.054, o: { mat: 'skin', col: '#c8a088', region: 'neck' } });
  const H = head(S, B, { skin: '#cfa28a', eye: '#d04030', brow: '#1a1418', lips: '#8a5048', jaw: 1.02 });
  // Maske über Nase/Mund
  S.shell({ off: 0.004 * s, th: 0.008 * s, mat: 'cloth', col: '#18141e', region: 'head', clip: (x, y, z) => { const ly = y - H.c[1]; return max(ly + 0.005 * s - 0.0 * s, -(ly + 0.13 * s)); }, disp: Detail.folds({ amp: 0.0015 * s, n: 9, top: H.c[1], bottom: H.c[1] - 0.12 * s }) }, () => {
    S.ellipsoid(H.at(0, -0.035, 0.02), [0.084 * s, 0.09 * s, 0.09 * s], {});
    S.ellipsoid(H.at(0, -0.035, 0.085), [0.03 * s, 0.03 * s, 0.03 * s], { k: 0.03 * s });
  });
  S.sym(() => handShape(S, B, { curl: 1, bulk: 1.0, o: { mat: 'dleather', col: '#1a1418', region: ['foreArmL', 'handL'] } }));
  S.layer('glow');
  for (const sx of [1, -1]) S.sphere(H.at(sx * 0.031, 0.005, 0.0945), 0.0028 * s, { mat: 'glow', col: glowC, glow: 1.6, region: 'head', tier: 6 });
  S.layer('body:fine');

  // ---- Zwei Glutklingen ----
  for (const side of ['R', 'L']) {
    const fr = weaponFrame(B, side, 'weapon' + side);
    dagger(S, fr, { s, len: 0.64, w: 0.09, bone: 'weapon' + side, steel: '#34303e', gold: metal, glow: glowC, k: 3.2, curve: 0.08, layer: 'body:fine' });
    // Ätherkern im Griff
    S.layer('glow');
    S.sphere(fr.at(0, -0.1 * s, 0.0), 0.012 * s, { mat: 'glow', col: glowC, glow: 3.4, bone: 'weapon' + side });
    S.layer('body:fine');
    info.cores.push({ joint: 'weapon' + side, p: fr.at(0, 0.05 * s, 0), size: 0.1 });
    info.trails.push({ joint: 'weapon' + side, a: fr.at(0.02 * s, 0.12 * s, 0), b: fr.at(0.04 * s, 0.55 * s, 0) });
  }
  S.layer('body');
  return info;
}
const P0 = (v) => [v.x, v.y, v.z];
void footShape; void sub; void clamp; void TAU; void min; void atan2; void cos; void sin; void norm; void scl; void lerp3; void smooth; void craniumShape; void PI;
