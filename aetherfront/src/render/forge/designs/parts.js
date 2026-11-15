// Aether-Forge – Anbauteile für die Einheiten-Bau-Grammatik (Stufen, Pfade, Volks-Stil, Anführer).
// Maße für eine Referenzfigur von 2 m; der Lader skaliert und setzt sie an Ankerpunkte des Grundmodells:
//   head (Scheitel), shoulder (linke Schulter; rechts gespiegelt), back (oberer Rücken), base (Boden).
import { Detail, add, sub, scl, norm, PI, TAU } from './lib.js';
import { crystalPrim } from './selene.js';

const { sin, cos, abs, max, hypot } = Math;

export const PARTS = {
  crown: { anchor: 'head', build(S) {
    S.torus([0, -0.06, 0], 0.11, 0.016, { mat: 'gold', col: 'metal' });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; S.capsule([sin(a) * 0.11, -0.06, cos(a) * 0.11], [sin(a) * 0.12, 0.05 + 0.03 * (i % 2), cos(a) * 0.12], 0.018, 0.004, { mat: 'gold', col: 'metal' }); }
    S.layer('glow'); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; S.sphere([sin(a) * 0.125, -0.06, cos(a) * 0.125], 0.012, { mat: 'glow', col: 'glow', glow: 3 }); } S.layer('body');
  } },
  horns: { anchor: 'head', build(S) {
    S.sym(() => S.tube([[0.07, -0.08, 0.02], [0.17, -0.02, -0.02], [0.22, 0.1, -0.08], [0.19, 0.22, -0.16]], [0.035, 0.026, 0.016, 0.003], { mat: 'horn', col: '#2a2420', disp: Detail.bunch({ amp: 0.003, freq: 90 }) }));
  } },
  crest: { anchor: 'head', build(S) {
    for (let i = 0; i < 9; i++) { const t = i / 8; S.capsule([0, -0.02, 0.08 - t * 0.2], [0, 0.12 - 0.06 * t * t, 0.05 - t * 0.32], 0.02, 0.006, { mat: 'feather', col: 'primary', disp: Detail.fur({ amp: 0.004, freq: 60 }) }); }
  } },
  halo: { anchor: 'head', build(S) {
    S.layer('glow'); S.torus([0, 0.12, -0.04], 0.16, 0.008, { rot: [-0.25, 0, 0], mat: 'glow', col: 'glow', glow: 2.8 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; S.capsule([cos(a) * 0.19, 0.12 + sin(a) * 0.19 * 0.24, -0.04 + sin(a) * 0.19 * 0.97], [cos(a) * 0.22, 0.12 + sin(a) * 0.22 * 0.24, -0.04 + sin(a) * 0.22 * 0.97], 0.006, 0.002, { mat: 'glow', col: 'glow', glow: 2.4 }); }
    S.layer('body');
  } },
  antlers: { anchor: 'head', build(S) {
    S.sym(() => {
      const w = { mat: 'wood', col: '#c8b48a' };
      S.tube([[0.06, -0.06, 0], [0.14, 0.06, -0.02], [0.22, 0.2, -0.05], [0.26, 0.34, -0.06]], [0.022, 0.018, 0.012, 0.005], w);
      S.tube([[0.14, 0.06, -0.02], [0.2, 0.1, 0.08], [0.24, 0.16, 0.12]], [0.014, 0.01, 0.004], w);
      S.tube([[0.22, 0.2, -0.05], [0.32, 0.24, -0.02], [0.38, 0.3, 0.0]], [0.012, 0.008, 0.003], w);
      for (let i = 0; i < 3; i++) S.ellipsoid([0.2 + i * 0.05, 0.12 + i * 0.08, -0.08], [0.03, 0.012, 0.05], { rot: [0.5, i, 0.3], mat: 'leaf', col: 'primary' });
    });
  } },
  pauldron: { anchor: 'shoulder', build(S) {
    S.group({ k: 0 }, () => {
      S.shell({ off: 0, th: 0.03, mat: 'steel', col: 'metal', clip: (x, y, z) => -0.02 - y }, () => S.ellipsoid([0.02, 0, 0], [0.17, 0.14, 0.17], {}));
      S.torus([0.02, -0.02, 0], 0.168, 0.016, { mat: 'gold', col: 'secondary' });
      for (let k = 0; k < 3; k++) S.shell({ off: 0, th: 0.026, mat: 'steel', col: k % 2 ? 'metal' : 'primary', clip: (x, y, z) => max(-0.1 - k * 0.07 - y, y + 0.03 + k * 0.07) }, () => S.ellipsoid([0.04 + k * 0.012, -0.03 - k * 0.04, 0], [0.18 + k * 0.01, 0.16, 0.18], {}));
    });
  } },
  spikes: { anchor: 'shoulder', build(S) {
    for (let k = 0; k < 3; k++) { const a = -0.5 + k * 0.5; S.capsule([0.04, 0.06, sin(a) * 0.09], [0.12 + 0.03 * (k === 1), 0.24 + 0.05 * (k === 1), sin(a) * 0.14], 0.03, 0.003, { mat: 'iron', col: '#3a3a40' }); }
  } },
  crystals: { anchor: 'back', build(S) {
    S.layer('glass');
    for (let i = 0; i < 7; i++) { const a = (i / 6) * PI - PI / 2; S.prim([sin(a) * 0.18, 0.02 + 0.04 * cos(a * 2), -0.02], crystalPrim(0.035 + 0.01 * (i % 2), 0.2 + 0.12 * (i % 3 === 0)), { rot: [-0.6, 0, -a * 0.9], mat: 'crystal', col: 'glow' }); }
    S.layer('glow'); S.sphere([0, 0.05, -0.02], 0.04, { mat: 'glow', col: 'glow', glow: 2.6 }); S.layer('body');
  } },
  wings_feather: { anchor: 'back', build(S) {
    S.sym(() => {
      S.tube([[0.05, 0, -0.05], [0.35, 0.25, -0.12], [0.75, 0.45, -0.2], [1.05, 0.3, -0.25]], [0.04, 0.035, 0.025, 0.01], { mat: 'feather', col: 'primary' });
      for (let i = 0; i < 9; i++) {
        const t = 0.15 + i * 0.1, root = [0.05 + t * 1.0, 0.2 + 0.25 * sin(t * PI) - 0.02, -0.12 - t * 0.12];
        const L = 0.35 + 0.25 * sin(t * PI);
        S.ellipsoid(add(root, [0.04 * t, -L * 0.5, 0.0]), [0.05, L * 0.55, 0.012], { rot: [0, 0.2, -0.35 + t * 0.6], mat: 'feather', col: i % 3 ? 'primary' : 'secondary', disp: Detail.fur({ amp: 0.004, freq: 40 }) });
      }
    });
  } },
  wings_bat: { anchor: 'back', build(S) {
    S.sym(() => {
      const arm = [[0.05, 0, -0.05], [0.4, 0.3, -0.12], [0.85, 0.5, -0.2]];
      S.tube(arm, [0.035, 0.028, 0.012], { mat: 'bone', col: '#3a3030' });
      const tips = [[1.1, 0.1, -0.24], [0.95, -0.25, -0.22], [0.65, -0.4, -0.18]];
      for (const t of tips) S.capsule(arm[2], t, 0.014, 0.004, { mat: 'bone', col: '#3a3030' });
      // Flughaut: flache Ellipsoide zwischen Arm und Fingern
      for (const [c, r, rz] of [[[0.45, 0.12, -0.13], [0.36, 0.26, 0.012], 0.25], [[0.82, 0.12, -0.2], [0.26, 0.3, 0.012], 0.05], [[0.7, -0.1, -0.18], [0.2, 0.26, 0.012], -0.4]]) S.ellipsoid(c, r, { rot: [0, 0.15, rz], mat: 'leather', col: 'secondary' });
    });
  } },
  gears: { anchor: 'back', build(S) {
    S.prim([0, 0.02, -0.06], { f: (x, y, z) => { const r = hypot(x, y), a = Math.atan2(y, x); const teeth = 0.012 * (cos(a * 12) > 0 ? 1 : 0); return max(max(r - 0.15 - teeth, 0.06 - r), abs(z) - 0.02); }, box: [-0.17, -0.17, -0.03, 0.17, 0.17, 0.03] }, { mat: 'brass', col: 'secondary' });
    S.sym(() => S.capsule([0.12, -0.05, -0.04], [0.16, 0.35, -0.1], 0.035, 0.03, { mat: 'iron', col: 'metal' }));
    S.layer('glow'); S.cylinder([0, 0.02, -0.07], 0.05, 0.02, { rot: [PI / 2, 0, 0], mat: 'glow', col: 'glow', glow: 2.8 }); S.layer('body');
  } },
  backspikes: { anchor: 'back', build(S) {
    for (let i = 0; i < 6; i++) S.capsule([0, 0.1 - i * 0.12, -0.02], [0, 0.22 - i * 0.12, -0.16], 0.04, 0.004, { mat: 'chitin', col: 'secondary' });
    S.sym(() => { for (let i = 0; i < 3; i++) S.capsule([0.08, -0.05 - i * 0.12, -0.02], [0.18, 0.05 - i * 0.12, -0.12], 0.03, 0.003, { mat: 'chitin', col: 'secondary' }); });
  } },
  flames: { anchor: 'shoulder', build(S) {
    S.layer('glow');
    for (let k = 0; k < 4; k++) { const a = k * 1.7; S.tube([[0.02 + 0.03 * cos(a), 0.0, 0.03 * sin(a)], [0.05 + 0.04 * cos(a), 0.12, 0.04 * sin(a)], [0.02 * cos(a * 2), 0.26 + 0.04 * k % 2, 0.02]], [0.045, 0.03, 0.004], { mat: 'glow', col: 'glow', glow: 2.6 }); }
    S.layer('body');
  } },
  aura: { anchor: 'base', build(S) {
    S.layer('glow');
    S.torus([0, 0.02, 0], 0.62, 0.012, { mat: 'glow', col: 'glow', glow: 2.2 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; S.capsule([sin(a) * 0.68, 0.02, cos(a) * 0.68], [sin(a + 0.25) * 0.68, 0.02, cos(a + 0.25) * 0.68], 0.01, { mat: 'glow', col: 'glow', glow: 2.6 }); }
    S.layer('body');
  } },
};

export function partDef(name, cell) {
  const P = PARTS[name];
  return {
    id: 'part_' + name, kind: 'part', palette: { primary: '#888888', secondary: '#666666', metal: '#aaaaaa', glow: '#ffffff' }, scale: 1,
    cell: cell * 0.9, budgets: [900, 400],
    build: (S) => { P.build(S); return { anchor: P.anchor }; },
    unitRig: null,
  };
}
