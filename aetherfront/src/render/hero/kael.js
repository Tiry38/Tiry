// Kael Sturmbrecher – gepanzerter Schildritter: Turmschild + Langschwert, Blau/Silber/Gold, Federbusch-Helm.
import * as THREE from 'three';
import { V, v3, PI, TAU, C, shade, mix, smooth, tube, sweep, lathe, ell, cyl, tor, cone, warp, smoothSphere, T, R, ext, shape, bend, starShape, mirrorX } from './geo.js';
import { M, W } from './rig.js';
import { torso, torsoRing, arms, legs, boots, hand, neck, headInfo, capeChain, legWeights, upperArmWeights, foreArmWeights, torsoWeights } from './anatomy.js';
import { pauldron, shellTube, rimRing, belt, plate, swordParts, weaponJoint, emit, place } from './parts.js';

export const proportions = { scale: 1.06, shoulders: 1.1, hipsW: 1.05, torso: 1.0, leg: 1.0, arm: 1.0 };

export function build(B, P) {
  const s = B.skel.s, J = B.J;
  const silver = C(P.primary), blue = C(P.secondary), gold = C(P.metal), glow = C(P.glow);
  const steel = mix(silver, '#9aa4b4', 0.25), dsteel = shade(steel, 0.55), mail = '#4d535e', cloth = shade(blue, 0.5), leather = '#3b2618';

  // ---- Unterkleidung ----
  legs(B, { col: mail, mat: M.dmetal, bulk: 1.06 });
  torso(B, { col: shade(blue, 0.35), mat: M.cloth, bulk: 1.0 });
  arms(B, { col: mail, mat: M.dmetal, bulk: 1.08 });
  neck(B, { col: mail, mat: M.dmetal, r: 0.055 });
  hand(B, { col: dsteel, mat: M.dmetal, curl: 1, armored: steel });

  // ---- Brustpanzer (Kürass) mit Mittelgrat, Zierkanten ----
  torso(B, { col: steel, mat: M.steel, off: 0.028, bottom: 0.02, top: 0.9, caps: false, ridge: 0.012, chest: 1.04 });
  torsoRing(B, 0.9, 0.03, 0.009, gold, M.gold);
  torsoRing(B, 0.03, 0.031, 0.009, gold, M.gold);
  // Brustplatte (aufgesetzt) + Emblem
  const S = { u: 0.62 };
  const bp = plate([[-0.13, -0.09], [0.13, -0.09], [0.15, 0.04], [0.09, 0.11], [0, 0.13], [-0.09, 0.11], [-0.15, 0.04]], 0.012, 4.5);
  T(bp, V(0, J.chest.pos.y + 0.09 * s, 0.155 * s)); bp.scale(1, 1, 1);
  B.add(bp, shade(steel, 1.08), M.steel, 'chest');
  const bpRim = plate([[-0.137, -0.097], [0.137, -0.097], [0.158, 0.042], [0.095, 0.118], [0, 0.14], [-0.095, 0.118], [-0.158, 0.042]], 0.008, 4.5);
  T(bpRim, V(0, J.chest.pos.y + 0.09 * s, 0.149 * s)); B.add(bpRim, gold, M.gold, 'chest');
  const em = ext(starShape(0.05, 0.018, 4), 0.01, 0.004, 2); T(em, V(0, J.chest.pos.y + 0.1 * s, 0.17 * s)); B.add(em, gold, M.gold, 'chest');
  const emg = ell(0.014, 0.014, 0.008, 12, 8); T(emg, V(0, J.chest.pos.y + 0.1 * s, 0.18 * s)); B.glow(emg, glow, 3.2, 'chest', { tier: 3 });
  // Bauchreifen (Lamellen)
  for (let i = 0; i < 3; i++) {
    const u0 = -0.02 - i * 0.065;
    torso(B, { col: i % 2 ? shade(steel, 0.9) : steel, mat: M.steel, off: 0.036 + i * 0.006, bottom: u0 - 0.07, top: u0, caps: false, sides: 28, segs: 4 });
    torsoRing(B, u0 - 0.07, 0.037 + i * 0.006, 0.006, gold, M.gold);
  }
  belt(B, { y: J.hips.pos.y + 0.035 * s, rx: 0.205, rz: 0.15, h: 0.045, col: leather, buckle: gold, gem: glow });

  // ---- Wappenrock (vorn + hinten) ----
  const tabard = (sideZ) => {
    const top = J.hips.pos.y + 0.02 * s, bot = J.shinL.pos.y + 0.1 * s;
    const g = new THREE.BufferGeometry();
    const nu = 8, nv = 12, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu - 0.5, v = j / nv;
      const w = (0.15 - 0.02 * v) * s;
      const y = top - v * (top - bot) - (Math.abs(u) < 0.2 ? 0.03 * s * smooth(0.8, 1, v) * (1 - Math.abs(u) / 0.2) : 0);
      const z = sideZ * (0.19 * s + v * 0.05 * s - u * u * 0.12 * s);
      pos.push(u * 2 * w, y, z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (sideZ > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const bind = (p) => { const t = smooth(top, bot, p.y); return [['hips', 1 - t * 0.9], ['thighL', t * 0.45], ['thighR', t * 0.45]]; };
    B.cloth(g, blue, M.silk, bind);
    // Goldsaum + Stern
    const hem = sweep([V(-0.13 * s, bot + 0.012 * s, sideZ * (0.24 * s - 0.0075 * s)), V(0, bot - 0.018 * s, sideZ * 0.245 * s), V(0.13 * s, bot + 0.012 * s, sideZ * (0.24 * s - 0.0075 * s))], [0.007 * s, 0.007 * s], 6, 20);
    B.add(hem, gold, M.gold, bind);
    const st = ext(starShape(0.055, 0.02, 4), 0.006, 0.003, 1); if (sideZ < 0) st.rotateY(PI);
    T(st, V(0, J.hips.pos.y - 0.17 * s, sideZ * 0.217 * s)); B.add(st, gold, M.gold, bind, { tier: 0 });
    return bind;
  };
  tabard(1); tabard(-1);

  // ---- Beintaschen (Tassets) ----
  const tas = (ox, oy, ang) => {
    for (let k = 0; k < 2; k++) {
      const p = plate([[-0.075, 0], [0.075, 0], [0.085, -0.11], [0, -0.125], [-0.085, -0.11]], 0.01, 6);
      const r = plate([[-0.08, 0.004], [0.08, 0.004], [0.091, -0.116], [0, -0.133], [-0.091, -0.116]], 0.006, 6);
      for (const [g, c, m, dz] of [[p, k ? shade(steel, 0.94) : steel, M.steel, 0], [r, gold, M.gold, -0.006]]) {
        R(g, -0.12, ang, 0); T(g, V(ox * s, J.hips.pos.y + (oy - k * 0.085) * s, 0.0));
        const n = V(Math.sin(ang), 0, Math.cos(ang));
        g.translate(n.x * (0.19 + dz + k * 0.012) * s, 0, n.z * (0.19 + dz + k * 0.012) * s);
        B.sym(g, c, m, (q) => [['hips', 0.45], ['thighL', 0.55]]);
      }
    }
  };
  tas(0.06, -0.03, 0.75);
  tas(0.03, -0.03, 1.35);

  // ---- Arme: Schulterplatten, Armröhren, Ellbogenkacheln ----
  pauldron(B, { r: 0.13, layers: 3, col: steel, col2: shade(steel, 0.92), trim: gold, tilt: 0.55 });
  pauldron(B, { r: 0.155, layers: 1, col: steel, trim: gold, tilt: 0.45, tier: 6, at: J.upperArmL.pos.clone().add(V(0.03 * s, 0.07 * s, 0)) });
  // Tier 3: Filigran-Glühlinie auf Schultern
  {
    const c = J.upperArmL.pos.clone().add(V(0.02 * s, 0.045 * s, 0));
    const g = tor(0.1 * s, 0.004 * s, 6, 40, PI * 1.2); g.rotateX(PI / 2); g.rotateY(-PI * 0.1); R(g, 0, 0, -0.55); T(g, c.clone().add(V(0.012 * s, 0.035 * s, 0)));
    B.glowSym(g, glow, 2.6, (q) => [['shoulderL', 0.55], ['upperArmL', 0.45]], { tier: 3 });
  }
  const ua0 = J.upperArmL.pos.clone().add(V(0.012 * s, -0.06 * s, 0)), el = J.foreArmL.pos.clone(), wr = J.handL.pos.clone();
  B.sym(shellTube(ua0, el.clone().add(V(0, 0.03 * s, 0)), 0.062 * s, 0.054 * s, { sides: 20, segs: 4 }), steel, M.steel, upperArmWeights(B));
  B.sym(rimRing(el.clone().add(V(0, 0.03 * s, 0)), el.clone().sub(ua0), 0.056 * s, 0.056 * s, 0.005 * s), gold, M.gold, upperArmWeights(B));
  const couter = smoothSphere(1, 16, 12); couter.scale(0.05 * s, 0.05 * s, 0.045 * s); T(couter, el.clone().add(V(0.012 * s, 0, -0.02 * s)));
  B.sym(couter, steel, M.steel, 'foreArmL');
  const fan = plate([[0, 0], [0.05, 0.02], [0.06, 0.07], [0.0, 0.08], [-0.03, 0.04]], 0.006, 8); R(fan, 0, PI / 2, -0.2); T(fan, el.clone().add(V(0.05 * s, -0.035 * s, -0.01 * s)));
  B.sym(fan, gold, M.gold, 'foreArmL');
  const fa0 = el.clone().lerp(wr, 0.12), fa1 = wr.clone().add(V(0, 0.015 * s, 0));
  B.sym(shellTube(fa0, fa1, 0.05 * s, 0.045 * s, { sides: 20, segs: 6, flare: 0.012 * s, ridge: 0.006 * s, ridgeA: PI / 2 }), steel, M.steel, foreArmWeights(B));
  B.sym(rimRing(fa1, fa1.clone().sub(fa0), 0.058 * s, 0.058 * s, 0.005 * s), gold, M.gold, foreArmWeights(B));
  // Halsberge
  const gor = lathe([[0.07, 0], [0.105, -0.01], [0.15, -0.045], [0.165, -0.06], [0.16, -0.07], [0.12, -0.05], [0.075, -0.02], [0.065, 0.04], [0.075, 0.045]].map(([r, y]) => [r * s, y * s]), 28);
  gor.scale(1, 1, 0.85); T(gor, V(0, J.neck.pos.y + 0.03 * s, -0.012 * s));
  B.add(gor, steel, M.steel, W.ramp('y', [[J.neck.pos.y - 0.02 * s, 'chest'], [J.neck.pos.y + 0.06 * s, 'neck']]));
  const gr = tor(0.068 * s, 0.006 * s, 6, 28); gr.rotateX(PI / 2); gr.scale(1, 1, 0.85); T(gr, V(0, J.neck.pos.y + 0.075 * s, -0.012 * s)); B.add(gr, gold, M.gold, 'neck');

  // ---- Beine: Beinröhren, Kniekacheln, Schenkelplatten ----
  const th = J.thighL.pos, kn = J.shinL.pos, an = J.footL.pos;
  B.sym(shellTube(th.clone().add(V(0.005 * s, -0.04 * s, 0.01 * s)), kn.clone().add(V(0, 0.06 * s, 0.005 * s)), 0.092 * s, 0.07 * s, { arc: PI * 1.1, sides: 16, segs: 6, th: 0.008 * s }), steel, M.steel, legWeights(B));
  const poleyn = smoothSphere(1, 16, 12); warp(poleyn, (p) => { if (p.z < 0) p.z *= 0.4; }, true); poleyn.scale(0.06 * s, 0.065 * s, 0.05 * s); T(poleyn, kn.clone().add(V(0, 0.01 * s, 0.035 * s)));
  B.sym(poleyn, steel, M.steel, W.joint('thighL', 'shinL', kn, V(0, -1, 0), 0.03));
  const pfan = plate([[0, 0], [0.05, 0.03], [0.06, 0.08], [0.01, 0.09], [-0.02, 0.05]], 0.006, 8); R(pfan, 0, PI / 2, PI * 0.9); T(pfan, kn.clone().add(V(0.065 * s, 0.02 * s, 0.01 * s)));
  B.sym(pfan, gold, M.gold, 'shinL');
  const kg = smoothSphere(1, 10, 8); kg.scale(0.016 * s, 0.016 * s, 0.01 * s); T(kg, kn.clone().add(V(0, 0.012 * s, 0.087 * s))); B.glowSym(kg, glow, 3, 'shinL', { tier: 6 });
  B.sym(shellTube(kn.clone().add(V(0, -0.04 * s, 0.008 * s)), an.clone().add(V(0, 0.14 * s, 0)), 0.062 * s, 0.052 * s, { sides: 20, segs: 6, ridge: 0.008 * s }), steel, M.steel, legWeights(B));
  B.sym(rimRing(kn.clone().add(V(0, -0.04 * s, 0.008 * s)), V(0, -1, 0), 0.064 * s, 0.064 * s, 0.005 * s), gold, M.gold, legWeights(B));
  boots(B, { col: steel, mat: M.steel, sole: dsteel, height: 0.2, cuff: gold, toe: 0.015, w: 1.08 });
  // Zehenkappen-Lamellen
  for (let k = 0; k < 2; k++) {
    const g = tor(0.052 * s, 0.006 * s, 6, 20, PI); g.rotateZ(0); g.scale(1, 0.9, 1);
    g.rotateX(-0.25); T(g, V(an.x, 0.045 * s, an.z + (0.06 + k * 0.045) * s));
    B.sym(g, gold, M.gold, 'footL');
  }

  // ---- Helm mit Visier und Federbusch ----
  const H = headInfo(B, { scale: 1.0 });
  const hc = H.c.clone().add(V(0, 0.005 * s, -0.004 * s));
  const helm = smoothSphere(1, 34, 26);
  warp(helm, (p) => {
    let { x, y, z } = p;
    // Gesichtsgrat
    if (z > 0) z += 0.16 * Math.exp(-Math.pow(x / 0.32, 2)) * z * smooth(-0.8, 0.2, y);
    // Wangenschutz nach unten verlängert, unten leicht ausgestellt
    if (y < -0.3) { const k = (-y - 0.3); y -= k * 0.35; x *= 1 + k * 0.25; z *= 1 + k * 0.2; }
    // Oberseite flacher, Hinterkopf voller
    if (y > 0.5) y = 0.5 + (y - 0.5) * 0.8;
    p.set(x * 0.122 * s, y * 0.142 * s, z * 0.13 * s);
  });
  T(helm, hc);
  B.add(helm, steel, M.steel, 'head');
  // Visierschlitz (dunkel) + Glühen
  const visor = (dy, w, k) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = -0.95 + (i / 16) * 1.9; pts.push(V(Math.sin(a) * 0.118 * s, hc.y + dy * s + Math.cos(a * 1.2) * 0.004 * s, hc.z + Math.cos(a) * 0.128 * s * (1 + 0.16 * Math.exp(-Math.pow(Math.sin(a) / 0.32, 2))) + 0.002 * s)); }
    return sweep(pts, [w * s, w * s], 8, 40);
  };
  B.add(visor(0.004, 0.011, 1), '#0a0c12', M.dmetal, 'head');
  B.glow(visor(0.004, 0.0045, 1).translate(0, 0, 0.004 * s), glow, 3.4, 'head');
  // Atemschlitze
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const g = ell(0.0035 * s, 0.014 * s, 0.006 * s, 6, 4); T(g, V(i * 0.022 * s, hc.y - 0.06 * s, hc.z + 0.135 * s - Math.abs(i) * 0.012 * s)); R(g, 0, i * 0.1, 0);
    B.add(g, '#0a0c12', M.dmetal, 'head');
  }
  // Goldkamm von vorn nach hinten + Stirnband
  const crest = []; for (let i = 0; i <= 20; i++) { const a = -1.15 + (i / 20) * 2.8; crest.push(V(0, hc.y + Math.cos(a) * 0.142 * s * 0.95 + 0.012 * s, hc.z + Math.sin(a) * 0.132 * s * 1.05)); }
  B.add(sweep(crest, (t) => (0.012 - 0.004 * Math.abs(t - 0.4)) * s, 8, 40), gold, M.gold, 'head');
  const band = []; for (let i = 0; i <= 30; i++) { const a = -PI * 0.62 + (i / 30) * PI * 1.24; band.push(V(Math.sin(a) * 0.126 * s, hc.y + 0.045 * s, hc.z + Math.cos(a) * 0.136 * s * (1 + 0.1 * Math.exp(-Math.pow(Math.sin(a) / 0.32, 2))))); }
  B.add(sweep(band, [0.007 * s, 0.007 * s], 6, 50), gold, M.gold, 'head');
  // Flügel-Zier (Stufe 6)
  {
    const wing = ext(shape([[0, 0], [0.04, 0.05], [0.09, 0.14], [0.06, 0.13], [0.07, 0.19], [0.03, 0.14], [0.02, 0.17], [-0.01, 0.08]], true), 0.008, 0.003, 2);
    wing.scale(s, s, s); R(wing, 0, PI / 2, 0); R(wing, 0, 0, -0.35); T(wing, V(0.115 * s, hc.y + 0.02 * s, hc.z - 0.02 * s));
    B.sym(wing, gold, M.gold, 'head', { tier: 6 });
  }
  // Federbusch an Knochenkette
  const ptop = V(0, hc.y + 0.15 * s, hc.z - 0.02 * s);
  B.joint('plume', 'head', ptop);
  B.joint('plume1', 'plume', ptop.clone().add(V(0, 0.02 * s, -0.16 * s)));
  B.joint('plume2', 'plume1', ptop.clone().add(V(0, -0.08 * s, -0.3 * s)));
  const plumeBind = W.ramp((p) => -p.z + hc.z, [[0.0, 'plume'], [0.16 * s, 'plume1'], [0.32 * s, 'plume2']]);
  const holder = cyl(0.016 * s, 0.022 * s, 0.04 * s, 12); T(holder, ptop.clone().add(V(0, -0.012 * s, 0))); B.add(holder, gold, M.gold, 'head');
  for (let k = 0; k < 9; k++) {
    const a = (k - 4) * 0.09, len = 1 - Math.abs(k - 4) * 0.06;
    const pts = [ptop.clone().add(V(a * 0.08 * s, 0, 0.01 * s)), ptop.clone().add(V(a * 0.25 * s, 0.07 * s * len, -0.08 * s)), ptop.clone().add(V(a * 0.4 * s, 0.04 * s * len, -0.22 * s * len)), ptop.clone().add(V(a * 0.5 * s, -0.08 * s * len, -0.34 * s * len)), ptop.clone().add(V(a * 0.55 * s, -0.2 * s * len, -0.38 * s * len))];
    const g = tube(pts, (t, an) => { const w = (0.024 * Math.sin(Math.min(1, t * 1.3) * PI * 0.9 + 0.25)) * s; return [w * 0.35, w]; }, { sides: 8, segs: 20, hint: [1, 0, 0] });
    B.add(g, k % 3 === 1 ? shade('#e9edf5', 0.95) : blue, M.feather, plumeBind, { grad: { axis: 'y', from: ptop.y + 0.0, to: ptop.y - 0.2 * s, col: k % 3 === 1 ? '#c8d2e6' : shade(blue, 0.5) } });
  }
  // Glühende Federspitzen (Stufe 9)
  { const g = sweep([ptop.clone().add(V(0, 0.07 * s, -0.08 * s)), ptop.clone().add(V(0, 0.045 * s, -0.22 * s)), ptop.clone().add(V(0, -0.07 * s, -0.33 * s))], [0.006 * s, 0.002 * s], 6, 20); B.glow(g, glow, 3, plumeBind, { tier: 9 }); }

  // ---- Umhang ----
  capeChain(B, { top: J.neck.pos.y - 0.02 * s, back: -0.14 * s, w0: 0.36 * s, w1: 0.62 * s, len: 1.12 * s, col: blue, mat: M.silk, folds: 5, fold: 0.018 * s, wrap: 1.3, hem: gold, shoulder: 0.05 * s, inGrad: { axis: 'y', from: 1.4 * s, to: 0.5 * s, col: shade(blue, 0.7) } });
  // Umhangspangen
  for (const sx of [1, -1]) { const c = lathe([[0, 0], [0.028, 0.002], [0.032, 0.01], [0.02, 0.018], [0, 0.02]].map(([r, y]) => [r * s, y * s]), 16); R(c, PI / 2, 0, 0); T(c, V(sx * 0.15 * s, J.neck.pos.y - 0.04 * s, 0.1 * s)); B.add(c, gold, M.gold, 'chest'); const gm = ell(0.011 * s, 0.011 * s, 0.006 * s, 10, 8); T(gm, V(sx * 0.15 * s, J.neck.pos.y - 0.04 * s, 0.124 * s)); B.glow(gm, glow, 3, 'chest', { tier: 3 }); }

  // ---- Schwert (rechte Hand) ----
  const fr = weaponJoint(B, 'weaponR', 'R');
  emit(B, swordParts({ len: 0.92 * s, w: 0.078 * s, steel: '#d6dbe4', gold, glow, guard: 0.14 * s }).map((it) => { it[0].scale(1, 1, 1); return it; }), { origin: fr.origin, y: fr.y, x: fr.x }, 'weaponR');

  // ---- Turmschild (linker Unterarm) ----
  B.joint('weaponL', 'foreArmL', J.foreArmL.pos.clone().lerp(J.handL.pos, 0.5));
  const faDir = J.handL.pos.clone().sub(J.foreArmL.pos).normalize();
  const sc = J.foreArmL.pos.clone().lerp(J.handL.pos, 0.5).add(V(0.085 * s, 0, 0));
  const sFrame = { origin: sc, y: V(0, 0, 1), x: faDir.clone().negate() };
  const tower = (k) => {
    const sh = new THREE.Shape(), w = 0.3 * k * s, h0 = -0.6 * k * s, h1 = 0.42 * k * s;
    sh.moveTo(-w, h1 * 0.78); sh.quadraticCurveTo(-w * 0.6, h1 * 1.02, 0, h1 * 1.08); sh.quadraticCurveTo(w * 0.6, h1 * 1.02, w, h1 * 0.78);
    sh.lineTo(w * 0.96, h0 * 0.45); sh.quadraticCurveTo(w * 0.8, h0 * 0.9, 0, h0); sh.quadraticCurveTo(-w * 0.8, h0 * 0.9, -w * 0.96, h0 * 0.45); sh.closePath();
    return sh;
  };
  const shieldList = [];
  const face = bend(ext(tower(1), 0.03 * s, 0.01 * s, 2, 16), 1.6 / s, 0.15 / s); shieldList.push([face, blue, M.paint]);
  const rimS = tower(1.06); rimS.holes.push(new THREE.Path(tower(0.93).getPoints(24).reverse()));
  const rim = bend(ext(rimS, 0.05 * s, 0.008 * s, 2, 16), 1.6 / s, 0.15 / s); rim.translate(0, 0, 0.004 * s); shieldList.push([rim, silver, M.steel]);
  const back = bend(ext(tower(1.04), 0.012 * s, 0.004 * s, 1, 16), 1.6 / s, 0.15 / s); back.translate(0, 0, -0.024 * s); shieldList.push([back, shade(steel, 0.7), M.dmetal]);
  // Goldene Innenkante + Sonnenrad-Emblem
  const inner = tower(0.86); inner.holes.push(new THREE.Path(tower(0.82).getPoints(24).reverse()));
  const ig = bend(ext(inner, 0.04 * s, 0.004 * s, 1, 16), 1.6 / s, 0.15 / s); ig.translate(0, 0, 0.008 * s); shieldList.push([ig, gold, M.gold]);
  const boss = lathe([[0, 0.035], [0.03, 0.033], [0.055, 0.02], [0.07, 0.0], [0, 0]].map(([r, y]) => [r * s, y * s]), 24); boss.rotateX(PI / 2); boss.translate(0, 0.05 * s, 0.02 * s); shieldList.push([boss, gold, M.gold]);
  const sun = ext(starShape(0.15 * s, 0.06 * s, 8, PI / 8), 0.012 * s, 0.004 * s, 2); bend(sun, 1.6 / s, 0); sun.translate(0, 0.05 * s, 0.03 * s); shieldList.push([sun, shade(gold, 0.85), M.gold]);
  const wingL = ext(shape([[0, 0], [0.07, 0.04], [0.16, 0.09], [0.13, 0.03], [0.17, 0.0], [0.11, -0.03], [0.13, -0.07], [0.05, -0.04]].map(([x, y]) => [x * s, y * s]), true), 0.01 * s, 0.003 * s, 2);
  bend(wingL, 1.6 / s, 0); wingL.translate(0.06 * s, -0.14 * s, 0.03 * s); shieldList.push([wingL, silver, M.steel]);
  const wingR = mirrorX(wingL.clone()); shieldList.push([wingR, silver, M.steel]);
  const gemS = ell(0.03 * s, 0.03 * s, 0.016 * s, 16, 12); gemS.translate(0, 0.05 * s, 0.055 * s); shieldList.push([gemS, glow, null, 'glow', 3]);
  const runeRing = tor(0.11 * s, 0.004 * s, 6, 48); runeRing.translate(0, 0.05 * s, 0.035 * s); const rr = [runeRing, glow, null, 'glow', 2.4]; rr.tier = 6; shieldList.push(rr);
  const edgeGlow = tower(1.075); edgeGlow.holes.push(new THREE.Path(tower(1.055).getPoints(24).reverse()));
  const eg = bend(ext(edgeGlow, 0.02 * s, 0, 1, 16), 1.6 / s, 0.15 / s); eg.translate(0, 0, 0.004 * s); const egi = [eg, glow, null, 'glow', 2.2]; egi.tier = 9; shieldList.push(egi);
  // Griff/Riemen (Innenseite)
  const strap = cyl(0.012 * s, 0.012 * s, 0.14 * s, 8); strap.rotateZ(PI / 2); strap.translate(0, 0, -0.06 * s); shieldList.push([strap, leather, M.leather]);
  emit(B, shieldList, sFrame, 'weaponL');

  return {
    radius: 0.55 * s,
    style: 'knight',
  };
}

