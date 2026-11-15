// Aether-Forge – Entwicklungsstufen beim Backen: jede Vasallen-/Gegnerform wird als eigene Skulptur gebacken.
// Grundkörper (Archetyp) liefert einen „Bauplan“ (Skelett + Ankerpunkte: Kopf, Rücken, Schulter, Boden) und die
// Form-Schicht setzt darauf – fest verschmolzen, nichts schwebt ungewollt:
//   Stufe I   schlicht (nur Grundkörper, kleiner skaliert zur Laufzeit)
//   Stufe II  A: Schulterplatten + Helmkamm in Metall      B: zwei schwebende Ätherkugeln, Stirnjuwel, Glühlinien
//   Stufe III A: Dornen-Platten, Krone, schwerer Rückenaufbau (Banner/Stacheln/Schlote), Metall-Bodenring
//             B: leuchtende Flügel im Volks-Stil, Halo/Flammenkrone, kreisende Kristallsplitter, Leucht-Glyphe am Boden
// Volks-Stil: Flügel-/Glyphen-/Rückenform je Volk (orden, wild, schmiede, abgrund, schwarm, glut).
import { add, sub, scl, norm, lerp3, PI, TAU, frame } from './lib.js';
import { crystalPrim } from './selene.js';

const { sin, cos, abs, max, min, hypot } = Math;
const V = (x, y, z) => ({ x, y, z });

export const G = (o = {}) => ({ mat: 'glow', col: 'glow', glow: 2.8, ...o });
export function onLayer(S, name, fn) { S.layer(name); try { fn(); } finally { S.layer('body'); } }

/** Formkürzel → { tier, path } */
export function parseForm(form) {
  const f = String(form || '1');
  return { tier: +f[0] || 1, path: f.includes('b') ? 'b' : 'a', form: f };
}

/** Feder-/Blatt-/Flammenflügel einer Seite (+x). root: Ansatz, L: Spannweite, o: { style, region, k } */
export function wing(S, root, L, o = {}) {
  const st = o.style || 'orden';
  const reg = o.region;
  const up = o.up ?? 0.55;                  // Anstellwinkel nach oben (rad)
  const u = norm([cos(up), sin(up), -0.35]);  // Spannrichtung
  const v = norm([0.15, -1, -0.25]);         // Federrichtung (nach unten/hinten)
  const at = (t, d = 0) => add(add(root, scl(u, t * L)), scl(v, d));
  if (st === 'abgrund' || st === 'glut-bat') {
    // Fledermausflügel: Knochenarm + Finger + Flughaut
    const el = at(0.45, -0.05 * L), tip = at(1.0, 0.05 * L);
    S.tube([root, el, tip], [0.05 * L, 0.035 * L, 0.012 * L], { mat: 'bone', col: o.bone || '#3a3034', region: reg });
    const fingers = [at(0.95, 0.45 * L), at(0.75, 0.7 * L), at(0.45, 0.62 * L)];
    for (const f of fingers) S.capsule(el, f, 0.018 * L, 0.006 * L, { mat: 'bone', col: o.bone || '#3a3034', region: reg });
    const pts = [root, el, tip, ...fingers, at(0.12, 0.42 * L)];
    void pts;
    for (const [a, b, c] of [[root, el, fingers[2]], [el, fingers[2], fingers[1]], [el, fingers[1], fingers[0]], [el, fingers[0], tip], [root, fingers[2], at(0.1, 0.45 * L)]]) membrane(S, a, b, c, 0.018 * L, { mat: 'leather', col: o.skin || 'primary*1.5', region: reg });
    if (o.glowEdge) onLayer(S, 'glow', () => { for (const f of fingers) S.capsule(lerp3(el, f, 0.35), f, 0.012 * L, 0.006 * L, G({ region: reg, glow: 2.6 })); S.capsule(el, tip, 0.012 * L, 0.006 * L, G({ region: reg, glow: 2.6 })); });
    return;
  }
  if (st === 'schwarm') {
    // Insektenflügel: zwei lange, glasige Häute mit Adern
    onLayer(S, 'glass', () => {
      for (const [k, ang] of [[1, 0.0], [0.78, -0.35]]) {
        const d = norm([cos(up * 0.5 + ang * 0.3), sin(up * 0.5) * 0.6, -0.55 + ang]);
        const c = add(root, scl(d, 0.55 * L * k));
        const F = frame(c, d, [0, 1, 0]);
        S.ellipsoid(c, [0.2 * L * k, 0.6 * L * k, 0.012 * L], { rot: { x: F.x, y: F.y, z: F.z }, mat: 'crystal', col: o.col || 'glow', region: reg });
      }
    });
    S.capsule(root, add(root, scl(norm([cos(up * 0.5), sin(up * 0.5) * 0.6, -0.55]), 1.05 * L)), 0.018 * L, 0.006 * L, { mat: 'chitin', col: 'secondary', region: reg });
    return;
  }
  if (st === 'schmiede') {
    // Mechanische Klingenflügel: gefächerte Metallplatten + Düse
    S.capsule(root, at(0.35), 0.06 * L, 0.045 * L, { mat: 'brass', col: 'secondary', region: reg });
    for (let i = 0; i < 4; i++) {
      const t = 0.25 + i * 0.22, base = at(t * 0.9, 0);
      const d = norm(add(scl(v, 0.35 + i * 0.12), scl(u, 0.9 - i * 0.1)));
      const tip = add(base, scl(d, (0.55 - i * 0.06) * L));
      const F = frame(lerp3(base, tip, 0.5), sub(tip, base), [0, 1, 0]);
      S.box(F.o, [0.06 * L, hypot(...sub(tip, base)) / 2, 0.012 * L], { rot: { x: F.x, y: F.y, z: F.z }, r: 0.012 * L, mat: 'steel', col: 'metal', region: reg });
      onLayer(S, 'glow', () => S.capsule(add(base, scl(d, 0.08 * L)), add(tip, scl(d, -0.04 * L)), 0.012 * L, 0.006 * L, G({ region: reg, glow: 2.6 })));
    }
    onLayer(S, 'glow', () => S.sphere(at(0.1), 0.05 * L, G({ region: reg, glow: 3.4 })));
    return;
  }
  // Federn (orden), Blätter (wild), Flammen (glut): gefächerte Ellipsoide entlang des Arms
  const flame = st === 'glut';
  const leaf = st === 'wild';
  if (!flame) S.tube([root, at(0.5, -0.04 * L), at(1.0, 0.02 * L)], [0.055 * L, 0.04 * L, 0.014 * L], { mat: leaf ? 'bark' : 'feather', col: leaf ? '#5a3a22' : o.col || 'primary', region: reg });
  else onLayer(S, 'glow', () => S.tube([root, at(0.5, -0.04 * L), at(1.0, 0.02 * L)], [0.05 * L, 0.035 * L, 0.01 * L], G({ region: reg, glow: 2.6 })));
  const n = leaf ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (i / (n - 1)) * 0.86;
    const len = (leaf ? 0.55 : 0.32 + 0.38 * sin(PI * min(1, t * 1.15))) * L;
    const base = at(t, 0.0);
    const d = norm(add(scl(v, 1), scl(u, 0.25 + 0.5 * t)));
    const c = add(base, scl(d, len * 0.5));
    const F = frame(c, d, u);
    const w = (leaf ? 0.17 : 0.07) * L;
    const A = { rot: { x: F.x, y: F.y, z: F.z }, region: reg };
    if (flame) onLayer(S, 'glow', () => S.ellipsoid(c, [w * 0.9, len * 0.5, 0.014 * L], { ...A, ...G({ col: i % 2 ? 'glow' : 'secondary', glow: i % 2 ? 2.2 : 1.9 }) }));
    else {
      S.ellipsoid(c, [w, len * 0.5, 0.014 * L], { ...A, mat: leaf ? 'leaf' : 'feather', col: leaf ? (i % 2 ? 'primary' : 'primary*0.75') : (i % 3 === 2 ? 'secondary' : o.col || 'primary') });
      if (o.glowEdge) onLayer(S, 'glow', () => S.capsule(add(c, scl(d, len * 0.3)), add(c, scl(d, len * 0.48)), 0.014 * L, 0.006 * L, G({ region: reg, glow: 2.6 })));
    }
  }
}
/** dünne Haut zwischen drei Punkten (Dreieck mit Dicke) */
export function membrane(S, a, b, c, th, o) {
  const e1 = sub(b, a), e2 = sub(c, a);
  const n = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
  const ux = norm(e1), uy = norm([n[1] * ux[2] - n[2] * ux[1], n[2] * ux[0] - n[0] * ux[2], n[0] * ux[1] - n[1] * ux[0]]);
  const P2 = (p) => { const d = sub(p, a); return [d[0] * ux[0] + d[1] * ux[1] + d[2] * ux[2], d[0] * uy[0] + d[1] * uy[1] + d[2] * uy[2]]; };
  const A2 = [0, 0], B2 = P2(b), C2 = P2(c);
  const pts = [A2, B2, C2];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const edge = (p, q, x, y) => { const ex = q[0] - p[0], ey = q[1] - p[1], l = hypot(ex, ey) || 1; return ((x - p[0]) * ey - (y - p[1]) * ex) / l; };
  const sgn = Math.sign(edge(A2, B2, C2[0], C2[1])) || 1;
  S.prim(a, {
    f: (x, y, z) => {
      const d2 = max(max(-sgn * edge(A2, B2, x, y), -sgn * edge(B2, C2, x, y)), -sgn * edge(C2, A2, x, y));
      return max(d2, abs(z) - th);
    },
    box: [min(...xs), min(...ys), -th, max(...xs), max(...ys), th],
  }, { ...o, rot: { x: ux, y: uy, z: n } });
}

/** Schwebende Ätherkugel (Glühkern + Glashülle) */
function orb(S, c, r, reg) {
  onLayer(S, 'glow', () => S.sphere(c, r * 0.55, G({ region: reg, glow: 3.6 })));
  onLayer(S, 'glass', () => S.sphere(c, r, { mat: 'crystal', col: 'glow', region: reg }));
}

/** Bodenring (Aura). heavy = Metallring mit Glühnieten, sonst Leucht-Glyphe im Volks-Stil */
export function groundRing(S, R, style, heavy) {
  const reg = ['hips'];
  const y = 0.03;
  if (heavy) {
    S.torus([0, y, 0], R, 0.022, { mat: 'gold', col: 'metal', region: reg, wear: 1 });
    onLayer(S, 'glow', () => { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; S.sphere([sin(a) * R, y + 0.02, cos(a) * R], 0.03, G({ region: reg, glow: 2.6 })); } });
    return;
  }
  onLayer(S, 'glow', () => {
    S.torus([0, y, 0], R, 0.016, G({ region: reg, glow: 2.0 }));
    const n = style === 'schmiede' ? 8 : style === 'schwarm' ? 6 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const p0 = [sin(a) * R * 0.78, y, cos(a) * R * 0.78], p1 = [sin(a) * R * 1.12, y, cos(a) * R * 1.12];
      if (style === 'orden') S.capsule(p0, [sin(a) * R * 1.25, y, cos(a) * R * 1.25], 0.02, 0.006, G({ region: reg, glow: 2.8 }));
      else if (style === 'wild') S.ellipsoid([sin(a) * R * 1.08, y, cos(a) * R * 1.08], [0.05, 0.012, 0.11], { rot: [0, a, 0], ...G({ region: reg }) });
      else if (style === 'schmiede') S.box([sin(a) * R * 1.04, y, cos(a) * R * 1.04], [0.03, 0.012, 0.05], { rot: [0, a, 0], ...G({ region: reg }) });
      else if (style === 'abgrund') S.capsule(p0, p1, 0.016, 0.004, G({ region: reg, glow: 3 }));
      else if (style === 'schwarm') { const b = a + PI / n; S.capsule([sin(a) * R, y, cos(a) * R], [sin(b) * R * 1.15, y, cos(b) * R * 1.15], 0.016, G({ region: reg })); }
      else S.ellipsoid([sin(a) * R * 1.06, y, cos(a) * R * 1.06], [0.035, 0.012, 0.12], { rot: [0, a, 0], ...G({ region: reg, glow: 3.2 }) });
    }
  });
}

/**
 * Form-Schicht (dezent): Die eigentliche Entwicklung (Waffen, Kopf, Extras, Größe) kommt je Linie aus
 * roster.EVOLVE (gear.js). Hier nur noch die Volks-Signatur der Stufe III: ein schmaler Bodenring
 * (A Metall, B Leuchtglyphe) – keine Flügel/Kugeln/Banner mehr für alle.
 */
export function applyForm(S, F, plan, style) {
  if (F.tier < 3 || plan.noForm) return plan;
  groundRing(S, (plan.radius || 0.6) * 1.0, style || 'orden', F.path === 'a');
  return plan;
}

/** Anker eines Humanoiden (Gelenke aus units.humanoid) */
export function humanAnchors(J, s, o = {}) {
  const P = (n) => [J[n].pos.x, J[n].pos.y, J[n].pos.z];
  return {
    head: { p: add(P('head'), [0, (o.headTop ?? 0.21) * s, 0.01 * s]), r: (o.headR ?? 0.1) * s, region: 'head' },
    back: { p: add(P('chest'), [0, 0.08 * s, -(o.backZ ?? 0.17) * s]), w: (o.backW ?? 0.22) * s, region: 'torso', parentJoint: 'chest' },
    shoulder: o.noShoulder ? null : { p: add(P('upperArmL'), [(o.shX ?? 0.02) * s, (o.shY ?? 0.06) * s, 0]), r: (o.shR ?? 0.1) * s, region: 'shoulderL' },
  };
}
