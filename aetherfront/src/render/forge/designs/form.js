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
    for (const [a, b, c] of [[root, el, fingers[2]], [el, fingers[2], fingers[1]], [el, fingers[1], fingers[0]], [el, fingers[0], tip], [root, fingers[2], at(0.1, 0.45 * L)]]) membrane(S, a, b, c, 0.012 * L, { mat: 'leather', col: o.skin || 'secondary', region: reg });
    if (o.glowEdge) onLayer(S, 'glow', () => { for (const f of fingers) S.sphere(f, 0.025 * L, G({ region: reg, glow: 3 })); });
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
  else onLayer(S, 'glow', () => S.tube([root, at(0.5, -0.04 * L), at(1.0, 0.02 * L)], [0.05 * L, 0.035 * L, 0.01 * L], G({ region: reg, glow: 3.2 })));
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
    if (flame) onLayer(S, 'glow', () => S.ellipsoid(c, [w * 0.9, len * 0.5, 0.012 * L], { ...A, ...G({ glow: 2.6 + 0.8 * (i % 2) }) }));
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
    S.torus([0, y, 0], R, 0.035, { mat: 'gold', col: 'metal', region: reg, wear: 1 });
    S.torus([0, y, 0], R * 0.86, 0.018, { mat: 'steel', col: 'metal', region: reg });
    onLayer(S, 'glow', () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; S.sphere([sin(a) * R, y + 0.03, cos(a) * R], 0.038, G({ region: reg, glow: 3.4 })); } });
    return;
  }
  onLayer(S, 'glow', () => {
    S.torus([0, y, 0], R, 0.022, G({ region: reg, glow: 2.6 }));
    S.torus([0, y, 0], R * 0.78, 0.014, G({ region: reg, glow: 2.2 }));
    const n = style === 'schmiede' ? 16 : style === 'schwarm' ? 6 : 8;
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
 * Form-Schicht. plan: { J (Skelett, wird ergänzt), cls, radius, H, anchors: { head:{p,r,region}, back:{p,w,region},
 * shoulder:{p,r,region} | null, quad?: bool } }
 */
export function applyForm(S, F, plan, style) {
  const { tier, path } = F;
  if (tier < 2 || plan.noForm) return plan;
  const A = plan.anchors || {};
  const u = (plan.H || 2) / 2;
  const heavy = path === 'a';
  const st = style || 'orden';
  const mat = st === 'schwarm' ? 'chitin' : st === 'wild' ? 'bark' : st === 'abgrund' ? 'iron' : 'steel';
  const col = st === 'wild' ? 'secondary' : 'metal';
  // --- Schultern ---
  if (A.shoulder) {
    const sh = A.shoulder, r = sh.r ?? 0.12 * u;
    if (heavy) {
      S.sym(() => {
        S.group({ k: 0.01 * u }, () => {
          S.ellipsoid(sh.p, [r * 1.25, r * 0.8, r * 1.2], { mat, col, region: sh.region, wear: 1 });
          S.torus(add(sh.p, [0, -r * 0.2, 0]), r * 1.18, r * 0.16, { rot: [0, 0, -0.25], mat: 'gold', col: st === 'wild' ? 'metal' : 'secondary', region: sh.region });
        });
        if (tier >= 3) for (let k = 0; k < 2; k++) S.capsule(add(sh.p, [r * 0.3, r * 0.5, (k - 0.5) * r * 0.9]), add(sh.p, [r * 1.0, r * 1.9 - k * 0.3 * r, (k - 0.5) * r * 1.3]), r * 0.24, r * 0.03, { mat: st === 'wild' ? 'wood' : st === 'schwarm' ? 'chitin' : 'iron', col: st === 'orden' ? 'metal' : '#2e2a30', region: sh.region });
      });
    } else {
      // zwei schwebende Kugeln über den Schultern
      S.sym(() => orb(S, add(sh.p, [r * 1.9, r * 2.4 + 0.1 * u, -r * 0.6]), (tier >= 3 ? 0.11 : 0.085) * u, sh.region));
    }
  }
  // --- Kopf ---
  if (A.head) {
    const hd = A.head, r = hd.r ?? 0.1 * u, p = hd.p;
    if (heavy) {
      // Helmkamm (II) bzw. Krone (III)
      if (tier === 2) S.capsule(add(p, [0, -r * 0.2, r * 0.5]), add(p, [0, r * 0.5, -r * 0.6]), r * 0.22, r * 0.12, { mat, col, region: hd.region });
      else {
        S.torus(add(p, [0, -r * 0.15, 0]), r * 0.95, r * 0.18, { mat: 'gold', col: 'metal', region: hd.region });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.capsule(add(p, [sin(a) * r * 0.95, -r * 0.1, cos(a) * r * 0.95]), add(p, [sin(a) * r * 1.15, r * (0.75 + 0.35 * (i % 2)), cos(a) * r * 1.15]), r * 0.2, r * 0.04, { mat: 'gold', col: 'metal', region: hd.region }); }
      }
    } else {
      onLayer(S, 'glow', () => {
        if (tier === 2) S.sphere(add(p, [0, -r * 0.2, r * 0.85]), r * 0.22, G({ region: hd.region, glow: 3.6 }));
        else if (st === 'glut') { for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; S.capsule(add(p, [sin(a) * r * 0.7, -r * 0.1, cos(a) * r * 0.3 - r * 0.2]), add(p, [sin(a) * r * 1.0, r * (1.1 + 0.5 * (i === 2)), -r * 0.4]), r * 0.26, r * 0.04, G({ region: hd.region, glow: 3.2 })); } }
        else {
          S.torus(add(p, [0, r * 0.75, -r * 0.35]), r * 1.25, r * 0.12, { rot: [-0.35, 0, 0], ...G({ region: hd.region, glow: 3.2 }) });
          if (st === 'abgrund' || st === 'schwarm') for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; S.capsule(add(p, [sin(a) * r * 1.25, r * 0.75, -r * 0.35 + cos(a) * r * 0.2]), add(p, [sin(a) * r * 1.35, r * 1.5, -r * 0.5]), r * 0.1, r * 0.02, G({ region: hd.region })); }
        }
      });
    }
  }
  if (tier < 3) return plan;
  // --- Rücken (III) ---
  const R = (plan.radius || 0.6) * 1.18;
  if (A.back) {
    const bk = A.back, w = bk.w ?? 0.2 * u, p = bk.p;
    if (heavy) {
      if (st === 'orden') {
        // Banner an Stange
        const top = add(p, [0, 1.1 * u, -0.08 * u]);
        S.capsule(add(p, [0, -0.2 * u, 0]), top, 0.03 * u, 0.025 * u, { mat: 'gold', col: 'metal', region: bk.region });
        S.sphere(top, 0.07 * u, { mat: 'gold', col: 'metal', region: bk.region });
        S.box(add(top, [0, -0.38 * u, -0.06 * u]), [0.22 * u, 0.3 * u, 0.012 * u], { mat: 'cloth', col: 'secondary', region: bk.region, r: 0.01 * u });
        S.box(add(top, [0, -0.12 * u, -0.05 * u]), [0.25 * u, 0.025 * u, 0.02 * u], { mat: 'gold', col: 'metal', region: bk.region, r: 0.01 * u });
        onLayer(S, 'glow', () => S.sphere(add(top, [0, -0.38 * u, -0.08 * u]), 0.07 * u, G({ region: bk.region, glow: 3 })));
      } else if (st === 'schmiede') {
        // Schlote mit Glut
        S.sym(() => { const b = add(p, [w * 0.55, 0, 0]); S.capsule(b, add(b, [0.08 * u, 0.75 * u, -0.12 * u]), 0.08 * u, 0.065 * u, { mat: 'brass', col: 'secondary', region: bk.region }); onLayer(S, 'glow', () => S.sphere(add(b, [0.08 * u, 0.78 * u, -0.12 * u]), 0.06 * u, G({ region: bk.region, glow: 3.4 }))); });
        S.cylinder(add(p, [0, 0.12 * u, -0.06 * u]), 0.2 * u, 0.04 * u, { rot: [PI / 2, 0, 0], mat: 'steel', col: 'metal', region: bk.region, r: 0.015 * u });
      } else {
        // Stachelkamm
        const m2 = st === 'wild' ? { mat: 'wood', col: '#6a4a2a' } : st === 'schwarm' ? { mat: 'chitin', col: 'secondary' } : st === 'glut' ? { mat: 'stone', col: '#241c1c' } : { mat: 'bone', col: '#d8ccb4' };
        for (let i = 0; i < 5; i++) {
          const t = (i - 2) / 2, b = add(p, [t * w * 0.9, -abs(t) * 0.12 * u, 0]);
          const tip = add(b, [t * 0.3 * u, (0.55 - 0.18 * abs(t)) * u, -0.3 * u]);
          S.capsule(b, tip, 0.07 * u, 0.012 * u, { ...m2, region: bk.region });
          if (st === 'glut' || st === 'abgrund') onLayer(S, 'glow', () => S.sphere(tip, 0.035 * u, G({ region: bk.region, glow: 3.2 })));
        }
      }
    } else {
      // leuchtende Flügel
      const L = (plan.wingL || 1.25) * u;
      const wsty = st === 'glut' ? 'glut' : st;
      for (const [sd, k] of [['L', 1], ['R', -1]]) {
        const root = [k * w * 0.5 + p[0], p[1], p[2]];
        plan.J['wing' + sd] = { pos: V(root[0], root[1], root[2]), parent: bk.parentJoint || 'chest' };
        plan.cls = plan.cls || {};
        plan.cls['wing' + sd] = [4, root[0], root[1], 0];
      }
      S.sym(() => wing(S, [w * 0.5 + p[0], p[1], p[2]], L, { style: wsty, region: ['wingL'], glowEdge: true, col: st === 'orden' ? 'primary' : undefined }));
    }
  }
  // --- kreisende Splitter (III-B) ---
  if (!heavy) {
    const y = (plan.H || 2) * 0.62;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI / 4, c = [sin(a) * R * 0.95, y + 0.12 * u * (i % 2), cos(a) * R * 0.95];
      onLayer(S, 'glass', () => S.prim(c, crystalPrim(0.06 * u, 0.3 * u), { rot: [0.3 * cos(a), a, 0.3 * sin(a)], mat: 'crystal', col: 'glow', region: ['hips'] }));
      onLayer(S, 'glow', () => S.sphere(add(c, [0, 0.12 * u, 0]), 0.03 * u, G({ region: ['hips'], glow: 3.4 })));
    }
  }
  groundRing(S, R, st, heavy);
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
