// Aetherfront – Rüstungs- und Waffenteile für Helden (Platten mit Fasen, Zierkanten, Runen-Glühen).
import * as THREE from 'three';
import {
  V, v3, PI, TAU, C, shade, smooth, clamp, tube, sweep, lathe, ell, sph, cyl, tor, cone, warp, smoothSphere, T, R, between, aim, ext, shape, bend, starShape, crystal,
} from './geo.js';
import { M, W } from './rig.js';
import { torso, handFrame, legWeights, upperArmWeights, foreArmWeights, interp } from './anatomy.js';

const lerp = (a, b, t) => a + (b - a) * t;

/** Geometrie aus lokalem Waffenraum (Griff im Ursprung, Achse +Y) in einen Handrahmen setzen. xAxis: Breitenrichtung */
export function place(g, origin, yAxis, xAxis) {
  const y = v3(yAxis).normalize();
  const x = v3(xAxis).addScaledVector(y, -v3(xAxis).dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z));
  return T(g, origin);
}
/** Lokale Teile-Liste [geo, col, mat, layer?, k?] in Waffengelenk einsetzen */
export function emit(B, list, frame, bone, o = {}) {
  for (const it of list) {
    const [g, col, mat, layer, k] = it;
    place(g, frame.origin, frame.y, frame.x);
    if (layer === 'glow') B.glow(g, col, k ?? 3, bone, { tier: it.tier ?? o.tier ?? 0, maxTier: it.maxTier });
    else if (layer === 'glass') B.glass(g, col, bone, { tier: it.tier ?? o.tier ?? 0 });
    else if (layer === 'cloth') B.cloth(g, col, mat, bone, { tier: it.tier ?? o.tier ?? 0 });
    else B.add(g, col, mat, bone, { tier: it.tier ?? o.tier ?? 0, maxTier: it.maxTier });
  }
}

/** Waffengelenk am Griffpunkt der Hand anlegen. Rückgabe: Rahmen {origin, y (Waffenachse), x (Klingenbreite)} */
export function weaponJoint(B, name, side, o = {}) {
  const F = handFrame(B, side);
  const origin = o.origin || F.grip.clone();
  if (!B.has(name)) B.joint(name, 'hand' + side, origin);
  return { origin, y: o.y || F.f.clone(), x: o.x || F.d.clone().negate(), F };
}

// ---------------------------------------------------------------------------------------------
// Platten
// ---------------------------------------------------------------------------------------------
/** Teil-Röhre um einen Knochenabschnitt (Armschiene, Beinschiene). arc: abgedeckter Winkel (vorn zentriert) */
export function shellTube(a, b, r0, r1, o = {}) {
  const arc = o.arc ?? TAU;
  const n = o.sides || 18;
  const pts = [v3(a), v3(b)];
  if (arc >= TAU - 1e-3) {
    return tube(pts, (t, an) => {
      let r = lerp(r0, r1, t);
      if (o.flare) r += o.flare * Math.pow(Math.max(0, (t - 0.75) / 0.25), 2) + o.flare * 0.6 * Math.pow(Math.max(0, (0.15 - t) / 0.15), 2);
      if (o.ridge) r += o.ridge * Math.exp(-Math.pow(Math.atan2(Math.sin(an - (o.ridgeA || 0)), Math.cos(an - (o.ridgeA || 0))) / 0.18, 2));
      return r;
    }, { sides: n, segs: o.segs || 6, hint: o.hint || [0, 0, 1], caps: o.caps ?? false });
  }
  // offene Schale: Gitter mit Dicke
  const A = v3(a), Bv = v3(b), dir = Bv.clone().sub(A).normalize();
  const hint = v3(o.hint || [0, 0, 1]);
  const N = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize(), Bn = new THREE.Vector3().crossVectors(dir, N);
  const pos = [], idx = [], nu = n, nv = o.segs || 6, th = o.th ?? 0.008;
  const ring = (layer) => {
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const t = j / nv, an = -arc / 2 + (i / nu) * arc;
      let r = lerp(r0, r1, t) - layer * th;
      if (o.flare) r += o.flare * Math.pow(Math.max(0, (t - 0.75) / 0.25), 2);
      if (o.ridge) r += o.ridge * Math.exp(-Math.pow(an / 0.18, 2));
      const p = A.clone().lerp(Bv, t).addScaledVector(N, Math.cos(an) * r).addScaledVector(Bn, Math.sin(an) * r);
      pos.push(p.x, p.y, p.z);
    }
  };
  ring(0); ring(1);
  const off = (nu + 1) * (nv + 1);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a0 = j * (nu + 1) + i, b0 = a0 + 1, c0 = a0 + nu + 1, d0 = c0 + 1;
    idx.push(a0, b0, c0, b0, d0, c0);
    idx.push(off + a0, off + c0, off + b0, off + b0, off + c0, off + d0);
  }
  // Ränder schließen
  const edge = (i0, i1) => { idx.push(i0, i1, off + i0, i1, off + i1, off + i0); };
  for (let j = 0; j < nv; j++) { edge((j + 1) * (nu + 1), j * (nu + 1)); edge(j * (nu + 1) + nu, (j + 1) * (nu + 1) + nu); }
  for (let i = 0; i < nu; i++) { edge(i, i + 1); edge(nv * (nu + 1) + i + 1, nv * (nu + 1) + i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  return ng;
}

/** Ziernaht (Torus-Kante) als Ring um eine Achse */
export function rimRing(center, axis, rx, rz, r, seg = 32, arc = TAU, a0 = 0) {
  const pts = [];
  const ax = v3(axis).normalize();
  const n = Math.abs(ax.y) < 0.9 ? V(0, 1, 0) : V(0, 0, 1);
  const u = new THREE.Vector3().crossVectors(n, ax).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (i / seg) * arc;
    pts.push(v3(center).addScaledVector(w, Math.cos(a) * rz).addScaledVector(u, Math.sin(a) * rx));
  }
  return tube(pts, () => r, { sides: 6, segs: seg * 2, caps: arc < TAU - 1e-3, hint: ax });
}

/** Schulterplatte: mehrere gestaffelte Kuppeln. Baut links; B.sym spiegelt. */
export function pauldron(B, o) {
  const s = B.skel.s, J = B.J;
  const c = o.at || J.upperArmL.pos.clone().add(V(0.02 * s, 0.045 * s, 0));
  const r = (o.r ?? 0.11) * s, layers = o.layers ?? 3;
  const bind = o.bind || ((p) => [['shoulderL', 0.55], ['upperArmL', 0.45]]);
  for (let i = 0; i < layers; i++) {
    const rr = r * (1 - i * 0.1);
    const h = rr * (0.85 - i * 0.12);
    const g = lathe([[0, h], [rr * 0.45, h * 0.94], [rr * 0.8, h * 0.66], [rr * 0.98, h * 0.25], [rr * 1.06, 0.0], [rr * 1.02, -rr * 0.06], [rr * 0.9, -rr * 0.02], [rr * 0.6, h * 0.3], [0, h * 0.4]], 28);
    g.scale(1, 1, o.zs ?? 0.92);
    R(g, 0, 0, -(o.tilt ?? 0.62) - i * 0.3);
    T(g, c.clone().add(V(i * r * 0.2, -i * r * 0.5, 0)));
    B.sym(g, i === 0 ? o.col : (o.col2 || o.col), o.mat || M.steel, bind, { tier: o.tier });
    if (o.trim) {
      const t = tor(rr * 1.05, rr * 0.055, 8, 36);
      t.rotateX(PI / 2); t.scale(1, 1, o.zs ?? 0.92); t.translate(0, 0.002, 0);
      R(t, 0, 0, -(o.tilt ?? 0.62) - i * 0.3);
      T(t, c.clone().add(V(i * r * 0.2, -i * r * 0.5, 0)));
      B.sym(t, o.trim, M.gold, bind, { tier: o.tier });
    }
  }
  return c;
}

/** Gürtel mit Schnalle */
export function belt(B, o) {
  const s = B.skel.s, y = o.y, rx = o.rx * s, rz = o.rz * s;
  const g = tube(Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * TAU; return V(Math.sin(a) * rx, y, Math.cos(a) * rz + (o.z || 0)); }), () => [o.h * 0.5 * s, 0.008 * s], { sides: 8, segs: 64, hint: [0, 1, 0], caps: false });
  // Rechteckiger Querschnitt: rn = Höhe (entlang hint=y), rb = Dicke
  B.add(g, o.col, o.mat || M.leather, o.bind || 'hips', { tier: o.tier });
  if (o.buckle) {
    const b = ext(shape([[-0.03, -0.025], [0.03, -0.025], [0.034, 0], [0.03, 0.025], [-0.03, 0.025], [-0.034, 0]]), 0.01, 0.004, 2);
    b.scale(s, s, s); T(b, V(0, y, rz + (o.z || 0) + 0.008 * s));
    B.add(b, o.buckle, M.gold, o.bind || 'hips', { tier: o.tier });
    if (o.gem) { const gm = ell(0.011 * s, 0.011 * s, 0.006 * s, 12, 8); T(gm, V(0, y, rz + (o.z || 0) + 0.016 * s)); B.glow(gm, o.gem, 3, o.bind || 'hips', { tier: o.tier }); }
  }
}

/** Gebogene Plattenform (Tasset, Brustplatte): Shape-Punkte, Dicke, Krümmung, Ausrichtung */
export function plate(pts, th, curv = 4, smoothPts = true, bev = 0.004) {
  const g = ext(shape(pts, smoothPts), th, bev, 2, 12);
  return bend(g, curv, 0);
}

// ---------------------------------------------------------------------------------------------
// Waffen (lokal: Griff im Ursprung, Achse +Y, Klingenbreite X, Dicke Z)
// ---------------------------------------------------------------------------------------------
export function bladeShape(len, w, tip = 0.2, base = 0.85, curve = 0) {
  const pts = [[-w / 2 * base, 0], [-w / 2, len * 0.1], [-w / 2 * 0.95, len * (1 - tip)], [curve * w, len], [w / 2 * 0.95, len * (1 - tip)], [w / 2, len * 0.1], [w / 2 * base, 0]];
  return shape(pts);
}
/** Klinge mit Hohlkehle: Rückgabe Liste */
export function swordParts(o = {}) {
  const len = o.len ?? 0.95, w = o.w ?? 0.07, steel = o.steel || '#c8cdd6', gold = o.gold || '#d9a540', glow = o.glow || '#7cc8ff';
  const L = [];
  // Klinge: Kern + Facette (Schneide als dünnere, hellere Form)
  const core = ext(bladeShape(len, w * 0.62, 0.16, 0.9), 0.016, 0.004, 2); core.translate(0, 0.08, 0);
  L.push([core, shade(steel, 0.92), M.steel]);
  const edge = ext(bladeShape(len, w, 0.2, 0.9), 0.004, 0.002, 1); edge.translate(0, 0.08, 0);
  L.push([edge, shade(steel, 1.12), M.steel]);
  // Rune in der Hohlkehle
  if (o.rune !== false) {
    const r1 = ext(bladeShape(len * 0.62, w * 0.16, 0.1, 1), 0.019, 0.002, 1); r1.translate(0, 0.14, 0);
    L.push([r1, glow, null, 'glow', o.runeK ?? 2.6]);
  }
  // Parierstange mit Flügeln
  const guard = tube([V(-(o.guard ?? 0.15), 0.035, 0), V(-0.05, 0.06, 0), V(0, 0.055, 0), V(0.05, 0.06, 0), V(o.guard ?? 0.15, 0.035, 0)], (t) => 0.014 + 0.012 * Math.sin(t * PI), { sides: 10, segs: 24 });
  L.push([guard, gold, M.gold]);
  const gem = ell(0.018, 0.018, 0.012, 12, 8); gem.translate(0, 0.062, 0.016); L.push([gem, glow, null, 'glow', 3.2]);
  const gemB = gem.clone(); gemB.translate(0, 0, -0.032); L.push([gemB, glow, null, 'glow', 3.2]);
  // Griff mit Wicklung
  const grip = tube([V(0, -0.11, 0), V(0, 0.04, 0)], (t, a) => 0.017 + 0.0025 * Math.max(0, Math.sin(t * 34)), { sides: 10, segs: 40, hint: [1, 0, 0] });
  L.push([grip, '#3a2618', M.leather]);
  const pom = lathe([[0, -0.16], [0.02, -0.155], [0.028, -0.135], [0.02, -0.115], [0, -0.11]], 14);
  L.push([pom, gold, M.gold]);
  return L;
}

export function hammerParts(o = {}) {
  const L = [];
  const len = o.len ?? 1.05, head = o.head ?? 0.2;
  const metal = o.metal || '#9aa5b2', copper = o.copper || '#c2763a', glow = o.glow || '#40e6ff', wood = o.wood || '#5a3a24';
  // Stiel
  L.push([tube([V(0, -0.32, 0), V(0, len - 0.25, 0)], (t) => 0.024 - 0.004 * t, { sides: 12, segs: 6 }), wood, M.wood]);
  for (const y of [-0.24, -0.02, 0.2, len - 0.4]) { const b = cyl(0.03, 0.03, 0.035, 14); b.translate(0, y, 0); L.push([b, copper, M.copper]); }
  const pom = lathe([[0, -0.4], [0.03, -0.39], [0.04, -0.36], [0.03, -0.33], [0, -0.32]], 14); L.push([pom, metal, M.steel]);
  // Kopf: achteckiger Block mit Fasen, Kupferbänder, Runenkern
  const hy = len - 0.18;
  const hb = cyl(head * 0.5, head * 0.5, head * 1.6, 8, false, 1); hb.rotateZ(PI / 2); hb.rotateX(PI / 8); hb.translate(0, hy, 0);
  L.push([hb, metal, M.steel]);
  for (const sx of [-1, 1]) {
    const face = cyl(head * 0.56, head * 0.5, head * 0.18, 8); face.rotateZ(PI / 2); face.rotateX(PI / 8); face.translate(sx * head * 0.86, hy, 0);
    L.push([face, shade(metal, 0.8), M.dmetal]);
    const band = cyl(head * 0.53, head * 0.53, head * 0.1, 8); band.rotateZ(PI / 2); band.rotateX(PI / 8); band.translate(sx * head * 0.45, hy, 0);
    L.push([band, copper, M.copper]);
    const rune = cyl(head * 0.2, head * 0.2, head * 0.2, 16); rune.rotateZ(PI / 2); rune.translate(sx * head * 0.92, hy, 0);
    L.push([rune, glow, null, 'glow', 3.5]);
  }
  // Rune-Kern oben
  const core = ell(head * 0.16, head * 0.16, head * 0.16, 12, 8); core.translate(0, hy + head * 0.5, 0); L.push([core, glow, null, 'glow', 3]);
  const spike = cone(head * 0.18, head * 0.45, 8); spike.translate(0, hy + head * 0.72, 0); L.push([spike, metal, M.steel]);
  return L;
}

/** Bogen (lokal: Griff im Ursprung, Wurfarme entlang ±Y, Sehne auf -Z Seite). Rückgabe { list, tipTop, tipBot } */
export function bowParts(o = {}) {
  const L = [];
  const h = o.h ?? 0.68, wood = o.wood || '#6a4a2a', trim = o.trim || '#c0a060', glow = o.glow || '#b6ff7a';
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16 * 2 - 1; // -1..1
    const y = t * h;
    const z = 0.1 * (1 - t * t) * 0.9 + 0.05 * Math.pow(Math.abs(t), 6) * -1 + (Math.abs(t) > 0.85 ? -0.06 * (Math.abs(t) - 0.85) / 0.15 : 0);
    pts.push(V(0, y, z - 0.02));
  }
  L.push([tube(pts, (t) => { const u = Math.abs(t * 2 - 1); return [0.012 + 0.014 * (1 - u), 0.018 + 0.012 * (1 - u)]; }, { sides: 10, segs: 48, hint: [0, 0, 1] }), wood, M.wood]);
  // Griffwicklung
  L.push([tube([V(0, -0.07, 0.07), V(0, 0.07, 0.07)], () => 0.024, { sides: 10, segs: 4 }), '#3a2618', M.leather]);
  // Zierbeschläge + Blattklingen an den Enden
  for (const sy of [-1, 1]) {
    const leaf = ext(shape([[0, 0], [0.03, 0.06], [0.012, 0.16], [0, 0.2], [-0.015, 0.1]], true), 0.006, 0.002, 1);
    leaf.rotateY(PI / 2); if (sy < 0) leaf.rotateX(PI); leaf.translate(0, sy * h * 0.82, 0.02);
    L.push([leaf, trim, M.gold]);
    const vein = sweep([V(0, sy * h * 0.15, 0.104), V(0, sy * h * 0.45, 0.075), V(0, sy * h * 0.7, 0.03)], [0.004, 0.002], 6, 16);
    L.push([vein, glow, null, 'glow', 2.4]);
  }
  const tipTop = V(0, h * 0.98, -0.05), tipBot = V(0, -h * 0.98, -0.05);
  return { list: L, tipTop, tipBot };
}

export function daggerParts(o = {}) {
  const L = [];
  const len = o.len ?? 0.48, w = o.w ?? 0.06, steel = o.steel || '#3a3a46', glow = o.glow || '#ff5a3a', gold = o.gold || '#9a9fb0';
  const sh = new THREE.Shape();
  sh.moveTo(-w * 0.45, 0); sh.quadraticCurveTo(-w * 0.62, len * 0.45, -w * 0.1, len * 0.85); sh.quadraticCurveTo(w * 0.05, len * 0.97, w * 0.12, len);
  sh.quadraticCurveTo(w * 0.35, len * 0.6, w * 0.45, len * 0.25); sh.lineTo(w * 0.42, 0); sh.closePath();
  const b = ext(sh, 0.012, 0.004, 2, 16); b.translate(0, 0.05, 0); L.push([b, steel, M.dmetal]);
  // glühende Schneide
  const eg = new THREE.Shape();
  eg.moveTo(-w * 0.5, len * 0.08); eg.quadraticCurveTo(-w * 0.66, len * 0.45, -w * 0.12, len * 0.86); eg.quadraticCurveTo(w * 0.04, len * 0.97, w * 0.12, len);
  eg.quadraticCurveTo(-w * 0.2, len * 0.8, -w * 0.38, len * 0.45); eg.quadraticCurveTo(-w * 0.42, len * 0.25, -w * 0.32, len * 0.08); eg.closePath();
  const e = ext(eg, 0.008, 0.002, 1, 16); e.translate(0, 0.052, 0); L.push([e, glow, null, 'glow', o.k ?? 3.2]);
  const guard = tube([V(-0.055, 0.03, 0), V(0, 0.05, 0), V(0.055, 0.03, 0), V(0.07, 0.06, 0)], (t) => 0.011 + 0.004 * Math.sin(t * PI), { sides: 8, segs: 16 });
  L.push([guard, gold, M.metal]);
  L.push([tube([V(0, -0.09, 0), V(0, 0.035, 0)], (t) => 0.015 + 0.002 * Math.max(0, Math.sin(t * 30)), { sides: 10, segs: 30, hint: [1, 0, 0] }), '#2a1a20', M.leather]);
  const pom = ell(0.02, 0.026, 0.02, 12, 8); pom.translate(0, -0.105, 0); L.push([pom, gold, M.metal]);
  const pg = ell(0.008, 0.008, 0.008, 8, 6); pg.translate(0, -0.105, 0.018); L.push([pg, glow, null, 'glow', 3]);
  return L;
}

export function staffParts(o = {}) {
  const L = [];
  const len = o.len ?? 1.6, below = o.below ?? 0.55, wood = o.wood || '#6a4a30', metal = o.metal || '#c9a24a';
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; const y = -below + t * len; pts.push(V(Math.sin(t * 7 + 1) * (o.wobble ?? 0.008), y, Math.cos(t * 5) * (o.wobble ?? 0.008))); }
  L.push([tube(pts, (t) => (o.r ?? 0.02) * (1.1 - 0.25 * t), { sides: 10, segs: 30 }), wood, o.woodMat || M.wood]);
  const foot = cone(0.022, 0.07, 10); foot.rotateX(PI); foot.translate(0, -below - 0.02, 0); L.push([foot, metal, M.gold]);
  for (const y of o.bands || [-0.1, 0.12]) { const b = tor(0.022, 0.006, 6, 16); b.rotateX(PI / 2); b.translate(0, y, 0); L.push([b, metal, M.gold]); }
  return { list: L, top: V(0, len - below, 0) };
}
