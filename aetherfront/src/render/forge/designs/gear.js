// Aether-Forge – Ausrüstung je Entwicklungsform (datengetrieben aus roster.EVOLVE). Jede Form einer Linie bekommt
// eigene Waffe(n), Kopfform und Extras – so wird jede Aufwertung eine eigene Einheit statt „Grundkörper + Anbausatz“.
// Gear-Spec: { R: Waffe rechts, L: Waffe/Schild links, H: Kopf, X: [Extras] }.
// Waffen hängen am Knochen weaponR/weaponL (bzw. handR/handL), Köpfe an 'head', Extras an den Bauplan-Ankern.
import { add, sub, scl, norm, lerp3, PI, TAU, frame } from './lib.js';
import { bladePrim, longbow } from './weapons.js';
import { crystalPrim } from './selene.js';
import { G, onLayer } from './form.js';

const { sin, cos, abs, max, min, hypot } = Math;
const P = (J, n) => (J[n] ? [J[n].pos.x, J[n].pos.y, J[n].pos.z] : null);
const glow = (S, fn) => onLayer(S, 'glow', fn);
const glass = (S, fn) => onLayer(S, 'glass', fn);
const steel = (bone, col = 'metal') => ({ mat: 'steel', col, bone, wear: 1 });

/** Spec-String → Objekt. Beispiel: 'R:greatsword L:tower H:great X:pauldronXL,cape fit:1.2' */
export function parseGear(str) {
  const g = { X: [] };
  for (const tok of String(str || '').split(/\s+/).filter(Boolean)) {
    const [k, v] = tok.split(':');
    if (k === 'X') g.X = v.split(',').filter(Boolean);
    else if (k === 'fit') g.fit = +v;
    else g[k] = v;
  }
  return g;
}

/** Hand-Rahmen: Ursprung an der Hand, y = Waffenachse */
function handF(J, side, up) {
  const wj = J['weapon' + side] && J['weapon' + side].parent === 'hand' + side ? 'weapon' + side : 'hand' + side;
  const o = P(J, wj) || P(J, 'hand' + side);
  const k = side === 'L' ? 1 : -1;
  return { F: frame(o, up || [0.06 * k, 1, 0.32], [1, 0, 0]), bone: J['weapon' + side] ? 'weapon' + side : 'hand' + side, k };
}

// ---------------------------------------------------------------------------------------------
// Waffen
// ---------------------------------------------------------------------------------------------
const WEAPONS = {
  sword(S, F, b, s, o) { blade(S, F, b, s * 0.85, 0.07, o); },
  greatsword(S, F, b, s, o) { blade(S, F, b, s * 1.35, 0.11, o); S.capsule(F.at(-0.2 * s, 0.05), F.at(0.2 * s, 0.05), 0.03 * s, { ...steel(b, 'secondary') }); },
  mace(S, F, b, s) { haft(S, F, b, -0.15, 0.7 * s); S.sphere(F.at(0, 0.75 * s), 0.11 * s, steel(b)); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.capsule(F.at(0, 0.75 * s), F.at(cos(a) * 0.17 * s, 0.75 * s, sin(a) * 0.17 * s), 0.035 * s, 0.006, steel(b)); } },
  hammer(S, F, b, s) { haft(S, F, b, -0.3, 0.95 * s); S.box(F.at(0, 0.98 * s), [0.24 * s, 0.13 * s, 0.13 * s], { rot: F.basis, ...steel(b), r: 0.03 * s }); S.box(F.at(0, 0.98 * s), [0.26 * s, 0.03 * s, 0.14 * s], { rot: F.basis, mat: 'gold', col: 'secondary', bone: b, r: 0.01 }); },
  axe(S, F, b, s) { haft(S, F, b, -0.2, 0.95 * s); S.prim(F.at(0.12 * s, 0.82 * s), { f: (x, y, z) => max(max(hypot(x - 0.02, y) - 0.2 * s, -x), abs(z) - 0.018), box: [-0.02, -0.21 * s, -0.02, 0.23 * s, 0.21 * s, 0.02] }, { rot: F.basis, ...steel(b) }); },
  spear(S, F, b, s, o) { haft(S, F, b, -0.5, 1.35 * s, 0.026); S.prim(F.at(0, 1.33 * s), bladePrim({ y0: 0, L: 0.36 * s, w: 0.06, th: 0.02, leaf: 0.35 }), { rot: F.basis, ...steel(b, '#d8dee6') }); if (o.glow) glow(S, () => S.capsule(F.at(0, 1.37 * s), F.at(0, 1.7 * s), 0.03, 0.006, G({ bone: b, glow: 3 }))); },
  lance(S, F, b, s) { haft(S, F, b, -0.4, 1.9 * s, 0.034, '#e8dcc0'); S.capsule(F.at(0, 0.0), F.at(0, 0.3 * s), 0.1 * s, 0.035 * s, steel(b)); S.capsule(F.at(0, 1.9 * s), F.at(0, 2.2 * s), 0.04 * s, 0.006, steel(b, '#d8dee6')); S.box(F.at(0, 1.72 * s, -0.17 * s), [0.012, 0.15 * s, 0.15 * s], { rot: F.basis, mat: 'cloth', col: 'secondary', bone: b }); },
  halberd(S, F, b, s) { haft(S, F, b, -0.4, 1.55 * s, 0.028); S.prim(F.at(0.1 * s, 1.35 * s), { f: (x, y, z) => max(max(hypot(x, y) - 0.18 * s, -x - 0.02), abs(z) - 0.016), box: [-0.03, -0.19 * s, -0.02, 0.19 * s, 0.19 * s, 0.02] }, { rot: F.basis, ...steel(b) }); S.capsule(F.at(0, 1.55 * s), F.at(0, 1.8 * s), 0.03, 0.005, steel(b)); },
  scythe(S, F, b, s, o) { haft(S, F, b, -0.4, 1.4 * s, 0.026, '#2a2020'); S.tube([F.at(0, 1.37 * s), F.at(0.22 * s, 1.47 * s), F.at(0.45 * s, 1.37 * s), F.at(0.6 * s, 1.15 * s)], [0.05, 0.04, 0.025, 0.005], { mat: 'iron', col: 'metal', bone: b }); if (o.glow) glow(S, () => S.tube([F.at(0.05, 1.33 * s), F.at(0.25 * s, 1.41 * s), F.at(0.5 * s, 1.3 * s)], [0.014, 0.012, 0.004], G({ bone: b, glow: 3 }))); },
  staff(S, F, b, s, o) { haft(S, F, b, -0.6, 1.65 * s, 0.024, '#6a4a30'); S.sphere(F.at(0, 1.68 * s), 0.06 * s, { mat: 'gold', col: 'metal', bone: b }); if (o.glow !== false) glow(S, () => S.sphere(F.at(0, 1.8 * s), 0.07 * s, G({ bone: b, glow: 3.2 }))); },
  staffOrb(S, F, b, s) { haft(S, F, b, -0.6, 1.7 * s, 0.026, '#3a2a40'); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; S.capsule(F.at(0, 1.66 * s), F.at(cos(a) * 0.14 * s, 1.88 * s, sin(a) * 0.14 * s), 0.018, 0.004, { mat: 'gold', col: 'metal', bone: b }); } glow(S, () => S.sphere(F.at(0, 1.9 * s), 0.13 * s, G({ bone: b, glow: 3.4 }))); },
  staffSun(S, F, b, s) { haft(S, F, b, -0.6, 1.75 * s, 0.026, '#e8dcc0'); S.torus(F.at(0, 1.95 * s), 0.2 * s, 0.025 * s, { rot: F.rot(PI / 2, 0, 0), mat: 'gold', col: 'metal', bone: b }); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; S.capsule(F.at(cos(a) * 0.2 * s, 1.95 * s + sin(a) * 0.2 * s), F.at(cos(a) * 0.32 * s, 1.95 * s + sin(a) * 0.32 * s), 0.02, 0.004, { mat: 'gold', col: 'metal', bone: b }); } glow(S, () => S.sphere(F.at(0, 1.95 * s), 0.1 * s, G({ bone: b, glow: 3.4 }))); },
  bo(S, F, b, s) { S.capsule(F.at(0, -0.9 * s), F.at(0, 0.9 * s), 0.028 * s, { mat: 'wood', col: '#8a5a30', bone: b }); for (const y of [-0.85, 0.85]) S.torus(F.at(0, y * s), 0.032 * s, 0.012, { rot: F.rot(PI / 2, 0, 0), mat: 'gold', col: 'metal', bone: b }); },
  bow(S, F, b, s, o) { longbow(S, F, { s: s * 1.1, bone: b, wood: o.glow ? 'metal' : '#5a3a20', trim: 'metal', h: 0.62 }); if (o.glow) glow(S, () => S.sphere(F.at(0, 0, 0.05), 0.07, G({ bone: b, glow: 3.2 }))); },
  crossbow(S, F, b, s) { const fr = frame(F.o, [0, 0.1, 1], [1, 0, 0]); S.box(fr.at(0, 0.25 * s), [0.05 * s, 0.32 * s, 0.05 * s], { rot: fr.basis, mat: 'wood', col: '#6a4428', bone: b, r: 0.015 }); S.tube([fr.at(-0.42 * s, 0.4 * s), fr.at(0, 0.5 * s), fr.at(0.42 * s, 0.4 * s)], [0.025, 0.035, 0.025], { mat: 'steel', col: 'metal', bone: b }); S.capsule(fr.at(0, 0.5 * s), fr.at(0, 0.72 * s), 0.02, 0.004, steel(b)); },
  tome(S, F, b, s, o) { const c = F.at(0, 0.05, 0.08); S.box(c, [0.14 * s, 0.18 * s, 0.05 * s], { rot: F.basis, mat: 'leather', col: 'secondary', bone: b, r: 0.015 }); S.box(add(c, [0, 0, 0.005]), [0.12 * s, 0.16 * s, 0.055 * s], { rot: F.basis, mat: 'linen', col: '#efe6d4', bone: b, r: 0.01 }); if (o.glow) glow(S, () => S.sphere(add(c, [0, 0.25 * s, 0]), 0.07 * s, G({ bone: b, glow: 3.2 }))); },
  banner(S, F, b, s) { haft(S, F, b, -0.4, 1.6 * s, 0.026, '#e8dcc0'); S.sphere(F.at(0, 1.62 * s), 0.07, { mat: 'gold', col: 'metal', bone: b }); S.box(F.at(-0.2 * s, 1.3 * s, -0.02), [0.2 * s, 0.26 * s, 0.014], { rot: F.basis, mat: 'cloth', col: 'secondary', bone: b, r: 0.01 }); S.box(F.at(-0.2 * s, 1.3 * s, 0.0), [0.1 * s, 0.1 * s, 0.018], { rot: F.basis, mat: 'gold', col: 'metal', bone: b, r: 0.01 }); },
  claws(S, F, b, s) { for (let k = 0; k < 3; k++) S.capsule(F.at((k - 1) * 0.05, 0.02), F.at((k - 1) * 0.08 * s, 0.32 * s, 0.1), 0.025 * s, 0.004, { mat: 'horn', col: '#2a2020', bone: b }); },
  fist(S, F, b, s, o) { S.ellipsoid(F.at(0, 0.02), [0.1 * s, 0.11 * s, 0.1 * s], { rot: F.basis, mat: o.glow ? 'gold' : 'steel', col: 'metal', bone: b }); for (let k = 0; k < 4; k++) S.sphere(F.at((k - 1.5) * 0.045 * s, 0.1 * s, 0.07 * s), 0.03 * s, { mat: 'gold', col: 'secondary', bone: b }); if (o.glow) glow(S, () => S.sphere(F.at(0, 0.05, 0.05), 0.12 * s, G({ bone: b, glow: 2.6 }))); },
  torch(S, F, b, s) { haft(S, F, b, -0.15, 0.5 * s, 0.03, '#4a3020'); glow(S, () => S.capsule(F.at(0, 0.55 * s), F.at(0, 0.85 * s), 0.08 * s, 0.01, G({ col: 'secondary', bone: b, glow: 2.4 }))); },
  flail(S, F, b, s) { haft(S, F, b, -0.15, 0.5 * s); S.tube([F.at(0, 0.5 * s), F.at(0.12 * s, 0.62 * s), F.at(0.25 * s, 0.55 * s)], 0.012, { mat: 'iron', col: '#3a3a40', bone: b }); S.sphere(F.at(0.3 * s, 0.5 * s), 0.1 * s, { mat: 'iron', col: '#3a3a40', bone: b }); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.capsule(F.at(0.3 * s, 0.5 * s), F.at(0.3 * s + cos(a) * 0.15 * s, 0.5 * s + sin(a) * 0.15 * s), 0.03, 0.005, steel(b)); } },
  // Schilde (links)
  buckler(S, F, b, s) { shieldRound(S, F, b, 0.22 * s, false); },
  mirror(S, F, b, s) { shieldRound(S, F, b, 0.32 * s, true); },
  kite(S, F, b, s) { const sf = frame(F.o, [0, 1, 0.1], [1, 0, -0.35]); const sc = s; S.prim(sf.o, { f: (x, y, z) => { const w = 0.26 * sc * max(0, 1 - max(0, -y) / (0.55 * sc)) ** 0.7; return max(max(abs(x) - max(0.01, w), y - 0.26 * sc), max(-0.55 * sc - y, abs(z) - 0.022)); }, box: [-0.27 * sc, -0.56 * sc, -0.03, 0.27 * sc, 0.27 * sc, 0.03] }, { rot: sf.basis, mat: 'paint', col: 'secondary', bone: b }); S.capsule(sf.at(0, -0.45 * sc, 0.025), sf.at(0, 0.22 * sc, 0.025), 0.025, { mat: 'gold', col: 'metal', bone: b }); S.capsule(sf.at(-0.2 * sc, 0.1 * sc, 0.025), sf.at(0.2 * sc, 0.1 * sc, 0.025), 0.022, { mat: 'gold', col: 'metal', bone: b }); },
  tower(S, F, b, s) { const sf = frame(add(F.o, [0.04, -0.05, 0.06]), [0, 1, 0.08], [1, 0, -0.3]); const w = 0.3 * s, h0 = -0.62 * s, h1 = 0.42 * s; S.box(sf.at(0, (h0 + h1) / 2), [w, (h1 - h0) / 2, 0.03], { rot: sf.basis, mat: 'paint', col: 'secondary', bone: b, r: 0.03 }); S.box(sf.at(0, (h0 + h1) / 2, 0.02), [w * 1.04, (h1 - h0) / 2 * 1.02, 0.022], { rot: sf.basis, op: 'add', mat: 'steel', col: 'metal', bone: b, r: 0.05 }); S.box(sf.at(0, (h0 + h1) / 2, 0.035), [w * 0.86, (h1 - h0) / 2 * 0.9, 0.02], { rot: sf.basis, mat: 'paint', col: 'secondary', bone: b, r: 0.03 }); S.capsule(sf.at(0, h0 * 0.8, 0.06), sf.at(0, h1 * 0.85, 0.06), 0.03 * s, { mat: 'gold', col: 'metal', bone: b }); S.capsule(sf.at(-w * 0.75, h1 * 0.25, 0.06), sf.at(w * 0.75, h1 * 0.25, 0.06), 0.03 * s, { mat: 'gold', col: 'metal', bone: b }); S.sphere(sf.at(0, h1 * 0.25, 0.08), 0.07 * s, { mat: 'gold', col: 'metal', bone: b }); },
};
function blade(S, F, b, L, w, o = {}) {
  S.prim(F.o, bladePrim({ y0: 0.08, L, w, th: 0.024 }), { rot: F.basis, mat: o.dark ? 'iron' : 'steel', col: o.dark ? '#3a3440' : '#c8d0d8', bone: b });
  S.capsule(F.at(-0.13 - w, 0.06), F.at(0.13 + w, 0.06), 0.022, { mat: 'gold', col: 'secondary', bone: b });
  S.capsule(F.at(0, 0.05), F.at(0, -0.17), 0.022, { mat: 'leather', col: '#2a1a12', bone: b });
  if (o.glow) glow(S, () => S.capsule(F.at(0, 0.2, 0.014), F.at(0, L - 0.04, 0.014), 0.016, 0.006, G({ bone: b, glow: 3 })));
}
function haft(S, F, b, y0, y1, r = 0.03, col = '#5a3a22') { S.capsule(F.at(0, y0), F.at(0, y1), r, r * 0.9, { mat: 'wood', col, bone: b }); }
function shieldRound(S, F, b, R, shiny) {
  const sf = frame(add(F.o, [0.05, 0, 0.06]), [0, 1, 0], [1, 0, -0.35]);
  S.cylinder(sf.o, R, 0.022, { rot: sf.rot(PI / 2, 0, 0), mat: shiny ? 'silver' : 'paint', col: shiny ? 'metal' : 'secondary', bone: b, r: 0.01 });
  S.torus(sf.o, R, 0.028, { rot: sf.rot(PI / 2, 0, 0), ...steel(b) });
  S.sphere(sf.at(0, 0, 0.03), R * 0.25, { mat: 'gold', col: 'metal', bone: b });
  if (shiny) glow(S, () => S.torus(sf.at(0, 0, 0.03), R * 0.6, 0.014, { rot: sf.rot(PI / 2, 0, 0), ...G({ bone: b, glow: 2.8 }) }));
}

// ---------------------------------------------------------------------------------------------
// Köpfe (sitzen auf dem Kopfgelenk; ersetzen Helm/Kapuze des Grundkörpers)
// ---------------------------------------------------------------------------------------------
const HEADS = {
  cap(S, c, r, o) { dome(S, c, r, 'metal'); S.capsule(add(c, [0, -0.02 * r, 1.0 * r]), add(c, [0, -0.6 * r, 1.0 * r]), 0.12 * r, { mat: 'steel', col: 'metal', region: 'head' }); },
  great(S, c, r) { S.capsule(add(c, [0, -0.7 * r, 0]), add(c, [0, 0.35 * r, 0]), 1.08 * r, 1.0 * r, { mat: 'steel', col: 'metal', region: 'head' }); S.box(add(c, [0, -0.05 * r, 1.0 * r]), [0.75 * r, 0.07 * r, 0.12 * r], { op: 'sub', mat: 'iron', col: '#101014', region: 'head' }); S.capsule(add(c, [0, 0.8 * r, 0.7 * r]), add(c, [0, 0.9 * r, -0.8 * r]), 0.14 * r, { mat: 'gold', col: 'secondary', region: 'head' }); },
  tower(S, c, r) { S.capsule(add(c, [0, -0.7 * r, 0]), add(c, [0, 0.9 * r, 0]), 1.08 * r, 0.95 * r, { mat: 'steel', col: 'metal', region: 'head' }); S.box(add(c, [0, -0.05 * r, 1.0 * r]), [0.7 * r, 0.06 * r, 0.12 * r], { op: 'sub', mat: 'iron', col: '#101014', region: 'head' }); S.prim(add(c, [0, 1.6 * r, -0.1 * r]), { f: (x, y, z) => max(max(abs(x) - 0.08 * r, abs(z) - (0.9 * r - abs(y) * 0.6)), abs(y) - 0.75 * r), box: [-0.1 * r, -0.8 * r, -r, 0.1 * r, 0.8 * r, r] }, { mat: 'gold', col: 'secondary', region: 'head' }); },
  winged(S, c, r) { dome(S, c, r * 1.05, 'metal'); S.sym(() => { for (let i = 0; i < 4; i++) S.ellipsoid(add(c, [1.0 * r + i * 0.18 * r, 0.3 * r + i * 0.32 * r, -0.2 * r - i * 0.15 * r]), [0.12 * r, 0.55 * r, 0.06 * r], { rot: [0.3, 0, -0.5 - i * 0.12], mat: 'gold', col: 'metal', region: 'head' }); }); },
  horned(S, c, r) { dome(S, c, r * 1.05, 'metal'); S.sym(() => S.tube([add(c, [0.8 * r, 0.2 * r, 0]), add(c, [1.6 * r, 0.6 * r, -0.2 * r]), add(c, [1.9 * r, 1.4 * r, -0.4 * r])], [0.28 * r, 0.18 * r, 0.03 * r], { mat: 'horn', col: '#2a2420', region: 'head' })); },
  plume(S, c, r) { dome(S, c, r, 'metal'); S.tube([add(c, [0, 0.9 * r, 0.3 * r]), add(c, [0, 1.6 * r, -0.4 * r]), add(c, [0, 1.3 * r, -1.6 * r]), add(c, [0, 0.4 * r, -2.4 * r])], [0.32 * r, 0.42 * r, 0.32 * r, 0.06 * r], { mat: 'feather', col: 'secondary', region: 'head' }); },
  crown(S, c, r) { S.torus(add(c, [0, 0.55 * r, 0]), 0.95 * r, 0.16 * r, { mat: 'gold', col: 'metal', region: 'head' }); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; S.capsule(add(c, [sin(a) * 0.95 * r, 0.6 * r, cos(a) * 0.95 * r]), add(c, [sin(a) * 1.05 * r, 1.35 * r, cos(a) * 1.05 * r]), 0.15 * r, 0.03 * r, { mat: 'gold', col: 'metal', region: 'head' }); } glow(S, () => S.sphere(add(c, [0, 0.6 * r, 0.98 * r]), 0.16 * r, G({ region: 'head', glow: 3 }))); },
  hood(S, c, r) { S.ellipsoid(add(c, [0, 0.05 * r, -0.1 * r]), [1.15 * r, 1.2 * r, 1.2 * r], { mat: 'cloth', col: 'secondary', region: 'head' }); S.ellipsoid(add(c, [0, -0.15 * r, 0.5 * r]), [0.75 * r, 0.8 * r, 0.7 * r], { op: 'sub', mat: 'cloth', col: '#0a080c', region: 'head' }); S.capsule(add(c, [0, 0.6 * r, -0.6 * r]), add(c, [0, 0.2 * r, -1.9 * r]), 0.4 * r, 0.06 * r, { mat: 'cloth', col: 'secondary', region: 'head' }); },
  mitre(S, c, r) { S.prim(add(c, [0, 0.4 * r, 0]), { f: (x, y, z) => max(max(abs(x) - 0.85 * r * (1 - y / (2.6 * r)), abs(z) - 0.5 * r * (1 - y / (2.6 * r))), max(-y, y - 2.4 * r)), box: [-r, 0, -0.6 * r, r, 2.5 * r, 0.6 * r] }, { mat: 'cloth', col: 'primary', region: 'head' }); S.capsule(add(c, [0, 0.45 * r, 0.52 * r]), add(c, [0, 2.0 * r, 0.25 * r]), 0.1 * r, { mat: 'gold', col: 'metal', region: 'head' }); S.torus(add(c, [0, 0.45 * r, 0]), 0.9 * r, 0.12 * r, { mat: 'gold', col: 'metal', region: 'head' }); },
  halo(S, c, r) { glow(S, () => S.torus(add(c, [0, 1.3 * r, -0.4 * r]), 1.2 * r, 0.1 * r, { rot: [-0.35, 0, 0], ...G({ region: 'head', glow: 3 }) })); },
  sunhalo(S, c, r) { HEADS.halo(S, c, r); glow(S, () => { for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; S.capsule(add(c, [cos(a) * 1.3 * r, 1.3 * r + sin(a) * 1.3 * r * 0.34, -0.4 * r - sin(a) * 1.25 * r]), add(c, [cos(a) * 1.75 * r, 1.3 * r + sin(a) * 1.75 * r * 0.34, -0.4 * r - sin(a) * 1.7 * r]), 0.08 * r, 0.02 * r, G({ region: 'head', glow: 2.6 })); } }); },
  skull(S, c, r) { S.ellipsoid(add(c, [0, 0.05 * r, 0]), [1.05 * r, 1.1 * r, 1.15 * r], { mat: 'bone', col: '#e0d4b8', region: 'head' }); for (const sx of [1, -1]) S.sphere(add(c, [sx * 0.42 * r, 0.05 * r, 1.0 * r]), 0.28 * r, { op: 'sub', mat: 'void', col: '#05040a', region: 'head' }); glow(S, () => { for (const sx of [1, -1]) S.sphere(add(c, [sx * 0.42 * r, 0.05 * r, 0.85 * r]), 0.14 * r, G({ region: 'head', glow: 3.6 })); }); S.sym(() => S.tube([add(c, [0.8 * r, 0.5 * r, -0.2 * r]), add(c, [1.3 * r, 1.2 * r, -0.6 * r]), add(c, [1.2 * r, 1.9 * r, -1.1 * r])], [0.22 * r, 0.14 * r, 0.02 * r], { mat: 'horn', col: '#2a2024', region: 'head' })); },
  flame(S, c, r) { glow(S, () => { for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; S.capsule(add(c, [sin(a) * 0.8 * r, 0.3 * r, cos(a) * 0.4 * r - 0.3 * r]), add(c, [sin(a) * 1.0 * r, (1.4 + 0.6 * (i % 2)) * r, -0.9 * r]), 0.38 * r, 0.05 * r, G({ col: i % 2 ? 'glow' : 'secondary', region: 'head', glow: 2.4 })); } }); },
  antler(S, c, r) { S.sym(() => { const w = { mat: 'wood', col: '#e0d0b0', region: 'head' }; S.tube([add(c, [0.5 * r, 0.6 * r, -0.1 * r]), add(c, [1.3 * r, 1.4 * r, -0.3 * r]), add(c, [2.0 * r, 2.6 * r, -0.4 * r])], [0.16 * r, 0.12 * r, 0.04 * r], w); S.capsule(add(c, [1.3 * r, 1.4 * r, -0.3 * r]), add(c, [1.8 * r, 1.8 * r, 0.5 * r]), 0.1 * r, 0.03 * r, w); S.capsule(add(c, [1.7 * r, 2.1 * r, -0.36 * r]), add(c, [2.5 * r, 2.2 * r, -0.1 * r]), 0.08 * r, 0.03 * r, w); }); },
  mask(S, c, r) { S.ellipsoid(add(c, [0, 0, 0.75 * r]), [0.85 * r, 1.0 * r, 0.35 * r], { mat: 'gold', col: 'metal', region: 'head' }); glow(S, () => { for (const sx of [1, -1]) S.ellipsoid(add(c, [sx * 0.32 * r, 0.1 * r, 1.05 * r]), [0.18 * r, 0.07 * r, 0.04 * r], G({ region: 'head', glow: 3.4 })); }); },
  bald() {},
  topknot(S, c, r) { S.ellipsoid(add(c, [0, 1.05 * r, -0.35 * r]), [0.3 * r, 0.3 * r, 0.3 * r], { mat: 'hair', col: '#1a1410', region: 'head' }); S.torus(add(c, [0, 0.85 * r, -0.3 * r]), 0.22 * r, 0.06 * r, { mat: 'gold', col: 'metal', region: 'head' }); },
  crystal(S, c, r) { glass(S, () => { for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; S.prim(add(c, [sin(a) * 0.7 * r, 0.6 * r, -0.2 * r]), crystalPrim(0.2 * r, (1.2 + 0.6 * (i === 2)) * r), { rot: [-0.3, 0, -a * 0.6], mat: 'crystal', col: 'glow', region: 'head' }); } }); },
};
function dome(S, c, r, col) {
  S.ellipsoid(add(c, [0, 0.05 * r, 0]), [1.08 * r, 1.05 * r, 1.12 * r], { mat: 'steel', col, region: 'head', wear: 1 });
  S.torus(add(c, [0, -0.25 * r, 0]), 1.08 * r, 0.12 * r, { mat: 'gold', col: 'secondary', region: 'head' });
}

// ---------------------------------------------------------------------------------------------
// Extras (Anker des Bauplans)
// ---------------------------------------------------------------------------------------------
const EXTRAS = {
  pauldron(S, A, u) { if (!A.shoulder) return; const sh = A.shoulder, r = sh.r ?? 0.1 * u; S.sym(() => { S.ellipsoid(sh.p, [r * 1.3, r * 0.8, r * 1.25], { mat: 'steel', col: 'metal', region: sh.region, wear: 1 }); S.torus(add(sh.p, [0, -r * 0.2, 0]), r * 1.22, r * 0.16, { rot: [0, 0, -0.25], mat: 'gold', col: 'secondary', region: sh.region }); }); },
  pauldronXL(S, A, u) { if (!A.shoulder) return; const sh = A.shoulder, r = (sh.r ?? 0.1 * u) * 1.4; S.sym(() => { S.ellipsoid(add(sh.p, [r * 0.2, r * 0.1, 0]), [r * 1.35, r * 0.85, r * 1.3], { mat: 'steel', col: 'metal', region: sh.region, wear: 1 }); S.torus(add(sh.p, [r * 0.2, -r * 0.15, 0]), r * 1.28, r * 0.16, { rot: [0, 0, -0.25], mat: 'gold', col: 'secondary', region: sh.region }); for (let k = 0; k < 3; k++) S.capsule(add(sh.p, [r * 0.4, r * 0.5, (k - 1) * r * 0.6]), add(sh.p, [r * 0.9, r * 1.6, (k - 1) * r * 0.85]), r * 0.2, r * 0.03, { mat: 'iron', col: '#2e2a30', region: sh.region }); }); },
  cape(S, A, u) { if (!A.back) return; const p = A.back.p, w = A.back.w ?? 0.2 * u; S.prim(add(p, [0, -0.55 * u, -0.06 * u]), { f: (x, y, z) => { const ww = w * (1 + 0.5 * max(0, -y) / (0.6 * u)); return max(max(abs(x) - ww, abs(y) - 0.6 * u), abs(z - 0.08 * u * (y / (0.6 * u))) - 0.02 * u); }, box: [-w * 1.6, -0.62 * u, -0.15 * u, w * 1.6, 0.62 * u, 0.15 * u] }, { mat: 'cloth', col: 'secondary', region: A.back.region }); },
  quiver(S, A, u) { if (!A.back) return; const q0 = add(A.back.p, [0.08 * u, -0.35 * u, -0.04 * u]), q1 = add(A.back.p, [-0.06 * u, 0.15 * u, -0.08 * u]); S.capsule(q0, q1, 0.08 * u, { mat: 'leather', col: '#5a3a20', region: A.back.region }); for (let i = 0; i < 5; i++) S.capsule(add(q1, [(i - 2) * 0.03 * u, 0, 0]), add(q1, [(i - 2) * 0.03 * u - 0.04 * u, 0.2 * u, -0.03 * u]), 0.014 * u, { mat: 'feather', col: i % 2 ? 'secondary' : '#e8dcc0', region: A.back.region }); },
  pavise(S, A, u) { if (!A.back) return; S.box(add(A.back.p, [0, -0.2 * u, -0.08 * u]), [0.28 * u, 0.42 * u, 0.03 * u], { mat: 'paint', col: 'secondary', region: A.back.region, r: 0.03 * u }); S.box(add(A.back.p, [0, -0.2 * u, -0.1 * u]), [0.3 * u, 0.44 * u, 0.02 * u], { mat: 'steel', col: 'metal', region: A.back.region, r: 0.04 * u }); },
  backBanner(S, A, u) { if (!A.back) return; const p = A.back.p, top = add(p, [0, 1.0 * u, -0.08 * u]); S.capsule(add(p, [0, -0.2 * u, 0]), top, 0.028 * u, { mat: 'gold', col: 'metal', region: A.back.region }); S.box(add(top, [0, -0.32 * u, -0.05 * u]), [0.2 * u, 0.26 * u, 0.012 * u], { mat: 'cloth', col: 'secondary', region: A.back.region, r: 0.01 * u }); },
  bladesOrbit(S, A, u, H, R) { for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5, c = [sin(a) * R * 0.95, H * 0.55, cos(a) * R * 0.95]; const F = frame(c, [cos(a) * 0.3, 1, -sin(a) * 0.3], [cos(a), 0, -sin(a)]); S.prim(F.o, bladePrim({ y0: -0.25 * u, L: 0.5 * u, w: 0.05 * u, th: 0.018 }), { rot: F.basis, mat: 'steel', col: '#c8d0d8', region: ['hips'] }); glow(S, () => S.capsule(F.at(0, -0.15 * u, 0.01), F.at(0, 0.2 * u, 0.01), 0.012, 0.004, G({ region: ['hips'], glow: 3 }))); } },
  mirrorOrbit(S, A, u, H, R) { for (let i = 0; i < 2; i++) { const a = i * PI + 0.8, c = [sin(a) * R, H * 0.5, cos(a) * R]; S.cylinder(c, 0.16 * u, 0.012, { rot: [PI / 2, a, 0], mat: 'silver', col: 'metal', region: ['hips'] }); glow(S, () => S.torus(c, 0.12 * u, 0.012, { rot: [PI / 2, a, 0], ...G({ region: ['hips'], glow: 2.8 }) })); } },
  floatTome(S, A, u, H) { const c = [0.45 * u, H * 0.7, 0.1 * u]; S.box(c, [0.14 * u, 0.04 * u, 0.18 * u], { rot: [0.3, 0.4, 0], mat: 'leather', col: 'secondary', region: ['hips'], r: 0.015 }); glow(S, () => S.sphere(add(c, [0, 0.12 * u, 0]), 0.06 * u, G({ region: ['hips'], glow: 3 }))); },
  bracers(S, A, u, H, R, J) { for (const sd of ['L', 'R']) { const e = P(J, 'foreArm' + sd), h = P(J, 'hand' + sd); if (!e || !h) continue; S.capsule(lerp3(e, h, 0.2), lerp3(e, h, 0.85), 0.065 * u, 0.06 * u, { mat: 'gold', col: 'metal', region: 'arm' + sd }); } },
  barding(S, A, u) { if (!A.back) return; S.ellipsoid(add(A.back.p, [0, -0.08 * u, 0]), [(A.back.w ?? 0.2 * u) * 1.35, 0.12 * u, 0.42 * u], { mat: 'steel', col: 'metal', region: A.back.region, wear: 1 }); S.capsule(add(A.back.p, [0, 0.0, 0.35 * u]), add(A.back.p, [0, 0.0, -0.35 * u]), 0.04 * u, { mat: 'gold', col: 'secondary', region: A.back.region }); },
  helmHorn(S, A, u) { if (!A.head) return; const c = A.head.p, r = A.head.r ?? 0.1 * u; S.ellipsoid(add(c, [0, -0.2 * r, 0.2 * r]), [r * 1.1, r * 0.55, r * 1.2], { mat: 'steel', col: 'metal', region: A.head.region }); S.sym(() => S.tube([add(c, [0.6 * r, 0, -0.2 * r]), add(c, [1.3 * r, 0.8 * r, -0.6 * r]), add(c, [1.4 * r, 1.7 * r, -0.9 * r])], [0.25 * r, 0.16 * r, 0.03 * r], { mat: 'horn', col: '#2a2420', region: A.head.region })); },
  horns(S, A, u) { if (!A.head) return; const c = A.head.p, r = A.head.r ?? 0.1 * u; S.sym(() => S.tube([add(c, [0.45 * r, -0.3 * r, -0.1 * r]), add(c, [1.2 * r, 0.4 * r, -0.5 * r]), add(c, [1.1 * r, 1.4 * r, -1.0 * r])], [0.3 * r, 0.2 * r, 0.03 * r], { mat: 'horn', col: '#2a2024', region: A.head.region })); },
  spines(S, A, u, H, R, J, st) { if (!A.back) return; const m = st === 'wild' ? { mat: 'wood', col: '#6a4a2a' } : st === 'schwarm' ? { mat: 'chitin', col: 'secondary' } : st === 'glut' ? { mat: 'stone', col: '#2a1e1c' } : { mat: 'bone', col: '#d8ccb4' }; for (let i = 0; i < 4; i++) { const b = add(A.back.p, [0, -i * 0.05 * u, 0.2 * u - i * 0.15 * u]); const tip = add(b, [0, 0.38 * u - i * 0.04 * u, -0.18 * u]); S.capsule(b, tip, 0.07 * u, 0.012 * u, { ...m, region: A.back.region }); if (st === 'glut' || st === 'abgrund') glow(S, () => S.sphere(tip, 0.03 * u, G({ region: A.back.region, glow: 3 }))); } },
  crystals(S, A, u) { if (!A.back) return; for (let i = 0; i < 5; i++) glass(S, () => S.prim(add(A.back.p, [(i - 2) * 0.1 * u, -abs(i - 2) * 0.05 * u, 0.1 * u - abs(i - 2) * 0.04 * u]), crystalPrim(0.06 * u, (0.3 + 0.1 * (i % 2)) * u), { rot: [-0.3, 0, -(i - 2) * 0.3], mat: 'crystal', col: 'glow', region: A.back.region })); },
  mane(S, A, u) { if (!A.head) return; const c = add(A.head.p, [0, -0.15 * u, -0.15 * u]); glow(S, () => { for (let i = 0; i < 6; i++) { const a = -1 + i * 0.4; S.capsule(add(c, [sin(a) * 0.12 * u, 0, cos(a) * 0.05 * u]), add(c, [sin(a) * 0.2 * u, 0.3 * u, -0.25 * u]), 0.06 * u, 0.01 * u, G({ col: i % 2 ? 'glow' : 'secondary', region: A.head.region, glow: 2.4 })); } }); },
  crownS(S, A, u) { if (!A.head) return; const c = A.head.p, r = (A.head.r ?? 0.1 * u) * 0.9; S.torus(c, r, r * 0.15, { mat: 'gold', col: 'metal', region: A.head.region }); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; S.capsule(add(c, [sin(a) * r, 0, cos(a) * r]), add(c, [sin(a) * r * 1.1, r * 0.8, cos(a) * r * 1.1]), r * 0.15, r * 0.03, { mat: 'gold', col: 'metal', region: A.head.region }); } },
  plates(S, A, u) { if (!A.shoulder) return; const sh = A.shoulder, r = sh.r ?? 0.12 * u; S.sym(() => S.box(add(sh.p, [r * 0.3, 0, 0]), [r * 0.25, r * 1.1, r * 2.2], { rot: [0, 0, -0.3], mat: 'steel', col: 'metal', region: sh.region, r: r * 0.15 })); },
  cannon(S, A, u) { if (!A.head && !A.back) return; const p = A.head ? A.head.p : add(A.back.p, [0, 0.2 * u, 0.3 * u]); S.sphere(p, 0.13 * u, { mat: 'brass', col: 'secondary', region: (A.head || A.back).region }); S.capsule(p, add(p, [0, 0.06 * u, 0.55 * u]), 0.07 * u, 0.06 * u, { mat: 'steel', col: 'metal', region: (A.head || A.back).region }); glow(S, () => S.sphere(add(p, [0, 0.06 * u, 0.6 * u]), 0.045 * u, G({ region: (A.head || A.back).region, glow: 3 }))); },
  coil(S, A, u) { if (!A.back) return; const p = A.back.p; S.capsule(p, add(p, [0, 0.45 * u, 0]), 0.06 * u, 0.045 * u, { mat: 'copper', col: 'secondary', region: A.back.region }); for (let i = 0; i < 3; i++) S.torus(add(p, [0, 0.1 * u + i * 0.13 * u, 0]), 0.1 * u - i * 0.012 * u, 0.02 * u, { rot: [PI / 2, 0, 0], mat: 'copper', col: 'secondary', region: A.back.region }); glow(S, () => S.sphere(add(p, [0, 0.5 * u, 0]), 0.08 * u, G({ region: A.back.region, glow: 3.4 }))); },
  veins(S, A, u, H, R, J) { const a = P(J, 'hips') || [0, H * 0.45, 0], b = P(J, 'neck') || P(J, 'chest') || [0, H * 0.8, 0]; glow(S, () => { for (const sx of [1, -1]) { S.capsule(add(a, [sx * 0.08 * u, 0.05 * u, -0.12 * u]), add(lerp3(a, b, 0.55), [sx * 0.14 * u, 0, -0.16 * u]), 0.016 * u, 0.012 * u, G({ col: 'secondary', region: 'torso', glow: 2.2 })); S.capsule(add(lerp3(a, b, 0.55), [sx * 0.14 * u, 0, -0.16 * u]), add(b, [sx * 0.06 * u, -0.05 * u, -0.1 * u]), 0.012 * u, 0.008 * u, G({ col: 'secondary', region: 'torso', glow: 2.2 })); S.capsule(add(a, [sx * 0.1 * u, 0.05 * u, 0.12 * u]), add(lerp3(a, b, 0.6), [sx * 0.1 * u, 0, 0.15 * u]), 0.014 * u, 0.008 * u, G({ col: 'secondary', region: 'torso', glow: 2.2 })); } }); },
  eyesGlow(S, A, u) { if (!A.head) return; const c = add(A.head.p, [0, -0.6 * (A.head.r ?? 0.1), (A.head.r ?? 0.1) * 0.9]); glow(S, () => { for (const sx of [1, -1]) S.sphere(add(c, [sx * 0.4 * (A.head.r ?? 0.1), 0, 0]), 0.03 * u, G({ region: A.head.region, glow: 3.6 })); }); },
};

/**
 * Ausrüstung anwenden. Vor dem Grundkörper: setGearSuppress(S, gear) (Standardwaffen/Helme weglassen).
 * Danach: applyGear(S, gear, plan, style).
 */
export function setGearSuppress(S, g) {
  S.suppress = new Set();
  if (g.R) S.suppress.add('weaponR');
  if (g.L) S.suppress.add('weaponL');
  S.noHelm = !!(g.H && g.H !== 'halo' && g.H !== 'sunhalo');
}
export function applyGear(S, g, plan, style) {
  S.suppress = null; S.noHelm = false;
  const J = plan.J, A = plan.anchors || {}, u = (plan.H || 2) / 2, H = plan.H || 2, R = (plan.radius || 0.6) * 1.1;
  const gl = (k) => ({ glow: /Glow$/.test(k) || /\+$/.test(k) });
  for (const side of ['R', 'L']) {
    const w = g[side]; if (!w || w === '-') continue;
    const name = w.replace(/Glow$|\+$/, '').replace(/XL$/, '');
    const fn = WEAPONS[name]; if (!fn) { console.warn('Gear: unbekannte Waffe', w); continue; }
    if (!J['hand' + side]) continue;
    const big = /XL/.test(w) ? 1.2 : 1;
    const { F, bone } = handF(J, side, name === 'bow' || name === 'crossbow' ? [0, 1, 0] : name === 'lance' ? [side === 'L' ? 0.1 : -0.1, 1, 0.45] : undefined);
    const s0 = ((J.hips ? J.hips.pos.y / 0.985 : 1) || 1) * big;
    fn(S, F, bone, s0, { ...gl(w), dark: style === 'abgrund' });
  }
  if (g.H && A.head) {
    const hn = g.H.replace(/\+$/, '');
    const hum = J.head && J.upperArmL;
    const sH = hum ? (J.hips.pos.y / 0.985) || 1 : 1;
    const r = hum ? 0.115 * sH : (A.head.r ?? 0.1);
    const c = hum ? add(P(J, 'head'), [0, 0.105 * sH, 0.012 * sH]) : sub(A.head.p, [0, r * 0.8, 0]);
    if (HEADS[hn]) HEADS[hn](S, c, r, {}); else console.warn('Gear: unbekannter Kopf', g.H);
  }
  for (const x of g.X || []) { const fn = EXTRAS[x]; if (fn) fn(S, A, u, H, R, J, style); else console.warn('Gear: unbekanntes Extra', x); }
}
