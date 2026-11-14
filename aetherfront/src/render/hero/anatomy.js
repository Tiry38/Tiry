// Aetherfront – gemeinsame Anatomie-Bausteine der Helden (Körper, Glieder, Hände, Stiefel, Kopf, Haar, Umhang, Robe).
// Alles wird für die LINKE Seite (+X) gebaut und bei Bedarf gespiegelt (B.sym).
import * as THREE from 'three';
import {
  V, v3, PI, TAU, C, shade, smooth, clamp, tube, sweep, lathe, ell, sph, cyl, tor, warp, smoothSphere, sheetGrid, T, R, between, aim, ext, shape, bend,
} from './geo.js';
import { M, W } from './rig.js';

const lerp = (a, b, t) => a + (b - a) * t;
// Tabelle [[x, wert], ...] weich interpolieren
export function interp(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 0; i < tab.length - 1; i++) {
    const [a, va] = tab[i], [b, vb] = tab[i + 1];
    if (x <= b) { const t = (x - a) / (b - a); const s = t * t * (3 - 2 * t); return va + (vb - va) * (0.35 * t + 0.65 * s); }
  }
  return tab[tab.length - 1][1];
}

// ---------------------------------------------------------------------------------------------
// Gewichte des Grundkörpers
// ---------------------------------------------------------------------------------------------
export function torsoWeights(B) {
  const J = B.J, hy = J.hips.pos.y, sy = J.spine.pos.y, cy = J.chest.pos.y, ny = J.neck.pos.y;
  const base = W.ramp('y', [[hy - 0.02, 'hips'], [sy + 0.05, 'spine'], [cy + 0.02, 'chest'], [ny + 0.02, 'neck']]);
  const shX = J.upperArmL.pos.x, shY = J.upperArmL.pos.y;
  return (p) => {
    const w = base(p);
    // Schulterbereich → Schlüsselbein/Oberarm
    const ax = Math.abs(p.x), side = p.x >= 0 ? 'L' : 'R';
    const k = smooth(shX * 0.45, shX * 0.95, ax) * smooth(shY - 0.16, shY - 0.04, p.y);
    if (k > 0) {
      const out = w.map(([b, x]) => [b, x * (1 - k)]);
      out.push(['shoulder' + side, k * 0.75], ['upperArm' + side, k * 0.25]);
      return out;
    }
    return w;
  };
}
export function upperArmWeights(B, side = 'L') {
  const J = B.J, sh = J['upperArm' + side].pos, el = J['foreArm' + side].pos;
  const dir = el.clone().sub(sh).normalize();
  const elbow = W.joint('upperArm' + side, 'foreArm' + side, el, dir, 0.035);
  return (p) => {
    const d = p.clone().sub(sh).dot(dir);
    const top = 1 - smooth(-0.02, 0.06, d);
    const w = elbow(p);
    if (top > 0) return w.map(([b, x]) => [b, x * (1 - top)]).concat([['shoulder' + side, top * 0.6], ['chest', top * 0.4]]);
    return w;
  };
}
export function foreArmWeights(B, side = 'L') {
  const J = B.J, el = J['foreArm' + side].pos, ha = J['hand' + side].pos;
  const dir = ha.clone().sub(el).normalize();
  const a = W.joint('upperArm' + side, 'foreArm' + side, el, dir, 0.035), b = W.joint('foreArm' + side, 'hand' + side, ha, dir, 0.02);
  return (p) => {
    const d = p.clone().sub(el).dot(dir);
    return d < (ha.distanceTo(el) * 0.5) ? a(p) : b(p);
  };
}
export function legWeights(B, side = 'L') {
  const J = B.J, th = J['thigh' + side].pos, kn = J['shin' + side].pos, an = J['foot' + side].pos;
  const d1 = kn.clone().sub(th).normalize(), d2 = an.clone().sub(kn).normalize();
  const hip = W.joint('hips', 'thigh' + side, th.clone().add(V(0, -0.02, 0)), d1, 0.05);
  const knee = W.joint('thigh' + side, 'shin' + side, kn, d2, 0.035);
  const ankle = W.joint('shin' + side, 'foot' + side, an, d2, 0.025);
  return (p) => {
    if (p.y > (th.y + kn.y) / 2) return hip(p);
    if (p.y > (kn.y + an.y) / 2) return knee(p);
    return ankle(p);
  };
}
// Rock/Robe: Hüfte → Oberschenkel (seitlich), hinten etwas an skirtB
export function skirtWeights(B, o = {}) {
  const J = B.J, top = o.top ?? J.hips.pos.y + 0.02, hem = o.hem ?? 0.1, legK = o.legK ?? 0.85, back = o.back ?? 0.35;
  const hasB = !!J.skirtB;
  return (p) => {
    const t = clamp((top - p.y) / (top - hem), 0, 1);
    const sideL = smooth(-0.06, 0.06, p.x);
    const legW = Math.pow(t, 1.1) * legK;
    const bw = hasB ? smooth(0.02, -0.12, p.z) * t * back : 0;
    const shinW = o.shin ? smooth(0.5, 1, t) * o.shin : 0;
    const lw = legW * (1 - shinW);
    return [['hips', Math.max(0, 1 - legW - bw)], ['thighL', lw * sideL * (1 - bw)], ['thighR', lw * (1 - sideL) * (1 - bw)],
      ['shinL', legW * shinW * sideL], ['shinR', legW * shinW * (1 - sideL)], ...(hasB ? [['skirtB', bw]] : [])];
  };
}

// ---------------------------------------------------------------------------------------------
// Rumpf
// ---------------------------------------------------------------------------------------------
/**
 * Rumpf als Loft. o: { col, mat, female, bulk, waist, chest, belly, top, bottom, layer, off (Aufmaß für Kleidung/Rüstung), front, back, tier }
 * Tabellen in Einheiten relativ zur Hüfte (u = (y - hipsY) / torsoLen).
 */
export function torsoShape(B, o = {}) {
  const J = B.J, hy = J.hips.pos.y, ny = J.neck.pos.y, L = ny - hy, sw = Math.abs(J.upperArmL.pos.x) / 0.195;
  const hw = Math.abs(J.thighL.pos.x) / 0.095, f = !!o.female, bulk = o.bulk ?? 1;
  const s = B.skel.s;
  const W0 = f
    ? [[-0.24, 0.105], [-0.12, 0.172 * hw], [0.0, 0.168 * hw], [0.16, 0.128], [0.32, 0.148], [0.5, 0.165 * sw], [0.68, 0.168 * sw], [0.84, 0.15 * sw], [0.94, 0.11 * sw], [1.0, 0.058]]
    : [[-0.24, 0.11], [-0.12, 0.165 * hw], [0.0, 0.168 * hw], [0.16, 0.152 * (o.waist ?? 1)], [0.34, 0.168], [0.52, 0.19 * sw * (o.chest ?? 1)], [0.7, 0.196 * sw * (o.chest ?? 1)], [0.85, 0.172 * sw], [0.94, 0.13 * sw], [1.0, 0.062]];
  const DF = f
    ? [[-0.24, 0.07], [-0.12, 0.095], [0.0, 0.1], [0.16, 0.085], [0.32, 0.092], [0.5, 0.11], [0.66, 0.112], [0.82, 0.092], [0.94, 0.072], [1.0, 0.055]]
    : [[-0.24, 0.075], [-0.12, 0.1], [0.0, 0.105], [0.16, 0.1 * (o.belly ?? 1)], [0.34, 0.11 * (o.belly ?? 1)], [0.52, 0.128 * (o.chest ?? 1)], [0.68, 0.13 * (o.chest ?? 1)], [0.84, 0.1], [0.94, 0.075], [1.0, 0.058]];
  const DB = [[-0.24, 0.07], [-0.12, 0.11], [0.0, 0.11], [0.16, 0.098], [0.34, 0.1], [0.52, 0.11], [0.7, 0.112], [0.85, 0.095], [0.94, 0.075], [1.0, 0.058]];
  const ZC = [[-0.24, 0.0], [0.0, -0.012], [0.2, -0.004], [0.5, 0.006], [0.75, -0.01], [1.0, -0.02]];
  const y = (u) => hy + u * L;
  const z = (u) => interp(ZC, u) * s;
  const r = (u, a, off = 0) => {
    const ca = Math.cos(a), k = 0.5 + 0.5 * ca, sa = Math.sin(a);
    let d = lerp(interp(DB, u), interp(DF, u), k) * bulk;
    const w = interp(W0, u) * bulk;
    if (f) d += 0.026 * Math.exp(-Math.pow((Math.abs(sa) - 0.45) / 0.26, 2)) * Math.exp(-Math.pow((u - 0.6) / 0.09, 2)) * Math.max(0, ca);
    else d += 0.012 * Math.exp(-Math.pow((Math.abs(sa) - 0.5) / 0.3, 2)) * Math.exp(-Math.pow((u - 0.66) / 0.1, 2)) * Math.max(0, ca);
    d += 0.008 * Math.exp(-Math.pow((Math.abs(sa) - 0.55) / 0.25, 2)) * Math.exp(-Math.pow((u - 0.72) / 0.1, 2)) * Math.max(0, -ca);
    d -= 0.004 * Math.exp(-Math.pow(sa / 0.12, 2)) * Math.max(0, -ca) * smooth(0.1, 0.4, u);
    return [(d + off) * s, (w + off) * s];
  };
  const pt = (u, a, off = 0) => { const [d, w] = r(u, a, off); return V(Math.sin(a) * w, y(u), z(u) + Math.cos(a) * d); };
  return { y, z, r, pt, L, hy };
}
/**
 * Rumpf als Loft. o: { col, mat, female, bulk, waist, chest, belly, top, bottom, layer, off (Aufmaß für Kleidung/Rüstung), tier, ridge }
 * u = (y - hipsY) / Rumpflänge (Hals = 1).
 */
export function torso(B, o = {}) {
  const S = torsoShape(B, o), off = o.off ?? 0;
  const u0 = o.bottom ?? -0.24, u1 = o.top ?? 1.0;
  const pts = [];
  for (let i = 0; i <= 10; i++) { const u = lerp(u0, u1, i / 10); pts.push(V(0, S.y(u), S.z(u))); }
  const g = tube(pts, (t, a) => {
    const u = lerp(u0, u1, t);
    const rr = S.r(u, a, off + (o.offFn ? o.offFn(u, a) : 0));
    if (o.ridge) { const k = o.ridge * Math.exp(-Math.pow(Math.sin(a) / 0.1, 2)) * Math.max(0, Math.cos(a)); rr[0] += k * B.skel.s; }
    return rr;
  }, { sides: o.sides || 32, segs: o.segs || 26, caps: o.caps ?? true });
  const bind = o.bind || torsoWeights(B);
  if (o.layer === 'cloth') B.cloth(g, o.col, o.mat, bind, { tier: o.tier, grad: o.grad });
  else B.add(g, o.col, o.mat || M.cloth, bind, { tier: o.tier, grad: o.grad });
  return S;
}
/** Zierkante rund um den Rumpf bei Höhe u */
export function torsoRing(B, u, off, r, col, mat, o = {}) {
  const S = torsoShape(B, o);
  const pts = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (o.a0 ?? 0) + (i / n) * (o.arc ?? TAU);
    const p = S.pt(u + (o.du ? o.du(a) : 0), a, off);
    pts.push(p);
  }
  const g = tube(pts, () => r * B.skel.s, { sides: 8, segs: n * 2, caps: (o.arc ?? TAU) < TAU, hint: [0, 1, 0] });
  B.add(g, col, mat || M.gold, o.bind || torsoWeights(B), { tier: o.tier });
  return g;
}

// ---------------------------------------------------------------------------------------------
// Arme
// ---------------------------------------------------------------------------------------------
export function arms(B, o = {}) {
  const J = B.J, s = B.skel.s, bulk = o.bulk ?? 1;
  const sh = J.upperArmL.pos, el = J.foreArmL.pos, ha = J.handL.pos;
  const ua = tube([sh.clone().add(V(-0.01, 0.02, 0)), el], (t, a) => {
    const ca = Math.cos(a);
    const r = interp([[0, 0.058], [0.15, 0.056], [0.45, 0.05], [0.8, 0.043], [1, 0.04]], t);
    return (r + 0.008 * Math.exp(-Math.pow((t - 0.45) / 0.2, 2)) * Math.max(0, ca)) * s * bulk;
  }, { sides: 16, segs: 10 });
  B.sym(ua, o.upperCol || o.col, o.upperMat || o.mat || M.cloth, upperArmWeights(B), { tier: o.tier });
  const fa = tube([el.clone().add(V(0, 0.02, 0)), ha.clone().add(V(0, 0.01, 0))], (t) => interp([[0, 0.043], [0.25, 0.045], [0.7, 0.036], [1, 0.03]], t) * s * bulk, { sides: 16, segs: 10 });
  B.sym(fa, o.foreCol || o.col, o.foreMat || o.mat || M.cloth, foreArmWeights(B), { tier: o.tier });
  if (o.deltoid !== false) {
    const d = smoothSphere(1, 16, 12); d.scale(0.066 * s * bulk, 0.072 * s * bulk, 0.066 * s * bulk); T(d, sh.clone().add(V(0.006, -0.005, 0)));
    B.sym(d, o.upperCol || o.col, o.upperMat || o.mat || M.cloth, upperArmWeights(B), { tier: o.tier });
  }
}

// ---------------------------------------------------------------------------------------------
// Hände
// ---------------------------------------------------------------------------------------------
/** Handrahmen der LINKEN Hand: Ursprung Handgelenk, d = Richtung Finger, f = vorn (Daumen), i = nach innen (Handfläche) */
export function handFrame(B, side = 'L') {
  const J = B.J;
  const el = J['foreArm' + side].pos, ha = J['hand' + side].pos;
  const d = ha.clone().sub(el).normalize();
  const f = V(0, 0, 1).addScaledVector(d, -d.z).normalize();
  let i = new THREE.Vector3().crossVectors(d, f).normalize(); // links: -X (innen)
  if (side === 'R') i.negate();
  const at = (a, b, c) => ha.clone().addScaledVector(d, a * B.skel.s).addScaledVector(f, b * B.skel.s).addScaledVector(i, c * B.skel.s);
  return { o: ha.clone(), d, f, i, at, grip: at(0.098, 0, 0.022) };
}
/**
 * Hand: curl 0 (offen) .. 1 (Faust). glove: Farbe Handschuh (sonst Haut). armored: Platten auf dem Handrücken.
 * side: 'L' | 'R' | 'both'
 */
export function hand(B, o = {}) {
  const sides = o.side === 'both' || !o.side ? ['L', 'R'] : [o.side];
  for (const side of sides) {
    const F = handFrame(B, 'L'); // immer links bauen, rechts spiegeln
    const s = B.skel.s, curl = side === 'R' ? (o.curlR ?? o.curl ?? 1) : (o.curlL ?? o.curl ?? 1);
    const col = o.col, mat = o.mat || M.skin;
    const bind = 'handL';
    const parts = [];
    // Handrücken / Ballen
    const palm = smoothSphere(1, 14, 10);
    warp(palm, (p) => { if (p.y > 0) p.y *= 0.85; }, false);
    const m4 = new THREE.Matrix4().makeBasis(F.i.clone().multiplyScalar(0.026 * s), F.d.clone().multiplyScalar(0.052 * s), F.f.clone().multiplyScalar(0.046 * s));
    palm.applyMatrix4(m4); palm.computeVertexNormals();
    T(palm, F.at(0.055, 0, 0.004));
    parts.push([palm, col, mat]);
    // Finger
    const fo = [0.032, 0.011, -0.011, -0.031], lens = [[0.036, 0.025, 0.02], [0.04, 0.027, 0.021], [0.038, 0.026, 0.02], [0.03, 0.021, 0.017]];
    for (let k = 0; k < 4; k++) {
      const pts = [F.at(0.088, fo[k], 0.0)];
      let dir = F.d.clone(), p = pts[0].clone();
      const ang = curl * (1.45 - k * 0.04) + 0.12;
      for (let j = 0; j < 3; j++) {
        dir = dir.clone().multiplyScalar(Math.cos(ang)).addScaledVector(F.i, Math.sin(ang)).normalize();
        if (j === 0) dir = F.d.clone().multiplyScalar(Math.cos(ang * 0.8)).addScaledVector(F.i, Math.sin(ang * 0.8)).normalize();
        p = p.clone().addScaledVector(dir, lens[k][j] * s);
        pts.push(p);
      }
      const r0 = (k === 3 ? 0.0095 : 0.0115) * s;
      parts.push([tube(pts, (t) => r0 * (1 - 0.25 * t), { sides: 8, segs: 9 }), col, mat]);
    }
    // Daumen
    const thumb = [F.at(0.03, 0.03, 0.012), F.at(0.06, 0.05, 0.022 + 0.012 * curl), F.at(0.085, 0.045 - 0.02 * curl, 0.03 + 0.022 * curl), F.at(0.1, 0.03 - 0.03 * curl, 0.035 + 0.025 * curl)];
    parts.push([tube(thumb, (t) => 0.0125 * s * (1 - 0.25 * t), { sides: 8, segs: 9 }), col, mat]);
    if (o.armored) {
      const plate = ext(shape([[-0.024, 0], [0.024, 0], [0.026, 0.05], [0, 0.058], [-0.026, 0.05]], true), 0.008, 0.004, 1);
      bend(plate, 6);
      const m = new THREE.Matrix4().makeBasis(F.f.clone().negate(), F.d.clone().negate(), F.i.clone().negate());
      plate.applyMatrix4(m.multiply(new THREE.Matrix4().makeScale(s, s, s)));
      T(plate, F.at(0.085, 0, -0.03));
      // Platte zeigt nach außen (Handrücken)
      parts.push([plate, o.armored, M.steel]);
      for (let k = 0; k < 4; k++) {
        const kn = ell(0.011 * s, 0.009 * s, 0.009 * s, 8, 6); T(kn, F.at(0.093, fo[k], -0.012));
        parts.push([kn, o.armored, M.steel]);
      }
    }
    if (o.cuff) {
      const c = cyl(0.04 * s, 0.034 * s, 0.07 * s, 16, true);
      aim(c, F.at(-0.01, 0, 0), F.d.clone().negate());
      parts.push([c, o.cuff, o.cuffMat || M.leather]);
    }
    for (const [g, c, m] of parts) {
      if (side === 'L') B.add(g, c, m, bind, { tier: o.tier }); else B._part(g, c, m, bind, { tier: o.tier }, 'body', true);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Beine + Stiefel
// ---------------------------------------------------------------------------------------------
export function legs(B, o = {}) {
  const J = B.J, s = B.skel.s, bulk = o.bulk ?? 1;
  const th = J.thighL.pos, kn = J.shinL.pos, an = J.footL.pos;
  const thigh = tube([th.clone().add(V(-0.012, 0.06, 0)), kn], (t, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const r = interp([[0, 0.088], [0.2, 0.084], [0.6, 0.068], [1, 0.054]], t);
    return (r + 0.008 * Math.max(0, ca) * Math.exp(-Math.pow((t - 0.55) / 0.25, 2)) + 0.006 * Math.max(0, -sa) * (1 - t)) * s * bulk;
  }, { sides: 18, segs: 12 });
  B.sym(thigh, o.thighCol || o.col, o.thighMat || o.mat || M.cloth, legWeights(B), { tier: o.tier });
  const shin = tube([kn.clone().add(V(0, 0.03, 0)), an.clone().add(V(0, 0.02, 0))], (t, a) => {
    const ca = Math.cos(a);
    const r = interp([[0, 0.052], [0.3, 0.054], [0.7, 0.04], [1, 0.034]], t);
    return (r + 0.016 * Math.max(0, -ca) * Math.exp(-Math.pow((t - 0.3) / 0.18, 2))) * s * bulk;
  }, { sides: 18, segs: 12 });
  B.sym(shin, o.shinCol || o.col, o.shinMat || o.mat || M.cloth, legWeights(B), { tier: o.tier });
  if (o.knee !== false) {
    const k = smoothSphere(1, 12, 10); k.scale(0.05 * s * bulk, 0.055 * s * bulk, 0.048 * s * bulk); T(k, kn.clone().add(V(0, 0.005, 0.012)));
    B.sym(k, o.thighCol || o.col, o.thighMat || o.mat || M.cloth, legWeights(B), { tier: o.tier });
  }
}
/** Stiefel/Schuh am Fußgelenk. o: { col, mat, sole, height (Schaftoberkante), cuff, toe (Spitze) , wrap } */
export function boots(B, o = {}) {
  const J = B.J, s = B.skel.s, an = J.footL.pos, w = o.w ?? 1;
  const shoe = tube([V(an.x, 0.045 * s, an.z - 0.075 * s), V(an.x, 0.05 * s, an.z + 0.03 * s), V(an.x, 0.04 * s, an.z + 0.12 * s), V(an.x, 0.03 * s, an.z + (0.175 + (o.toe || 0)) * s)], (t, a) => {
    const r = interp([[0, 0.045], [0.25, 0.052], [0.6, 0.048], [0.9, 0.034], [1, 0.02]], t) * s;
    return [r * 0.95, r * 1.05 * w];
  }, { sides: 16, segs: 14, hint: [0, 1, 0] });
  warp(shoe, (p) => { if (p.y < 0.012 * s) p.y = 0.012 * s; });
  B.sym(shoe, o.col, o.mat || M.leather, 'footL', { tier: o.tier });
  // Sohle
  const sole = tube([V(an.x, 0.012 * s, an.z - 0.08 * s), V(an.x, 0.012 * s, an.z + 0.06 * s), V(an.x, 0.012 * s, an.z + (0.18 + (o.toe || 0)) * s)], (t) => {
    const r = interp([[0, 0.044], [0.4, 0.052], [0.85, 0.042], [1, 0.02]], t) * s;
    return [0.014 * s, r * 1.08 * w];
  }, { sides: 12, segs: 12, hint: [0, 1, 0] });
  B.sym(sole, o.sole || shade(o.col, 0.45), M.rubber, 'footL', { tier: o.tier });
  // Schaft
  const top = (o.height ?? 0.3) * s;
  if (top > 0.1 * s) {
    const shaft = tube([V(an.x, 0.03 * s, an.z - 0.01 * s), V(an.x, top, J.shinL.pos.z * 0.5)], (t, a) => {
      const r = interp([[0, 0.054], [0.25, 0.048], [0.7, 0.05], [1, 0.058 + (o.flare || 0)]], t) * s;
      return r * (1 + 0.08 * Math.max(0, -Math.cos(a)) * (1 - t));
    }, { sides: 18, segs: 10, caps: false });
    B.sym(shaft, o.col, o.mat || M.leather, legWeights(B), { tier: o.tier });
    if (o.cuff) {
      const c = tor(0.06 * s, 0.012 * s, 8, 20); c.rotateX(PI / 2); c.scale(1 + (o.flare || 0) * 12, 1, 1 + (o.flare || 0) * 12); T(c, V(an.x, top, J.shinL.pos.z * 0.5));
      B.sym(c, o.cuff, o.cuffMat || M.gold, legWeights(B), { tier: o.tier });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Hals + Kopf + Gesicht
// ---------------------------------------------------------------------------------------------
export function neck(B, o = {}) {
  const J = B.J, s = B.skel.s;
  const g = tube([J.neck.pos.clone().add(V(0, -0.05 * s, -0.005)), J.head.pos.clone().add(V(0, 0.045 * s, 0.002))], (t) => (o.r ?? 0.05) * s * (1 - 0.1 * t), { sides: 16, segs: 6 });
  B.add(g, o.col, o.mat || M.skin, W.ramp('y', [[J.neck.pos.y - 0.02, 'chest'], [J.neck.pos.y + 0.02, 'neck'], [J.head.pos.y + 0.01, 'head']]), { tier: o.tier });
}
/** Kopfzentrum + Maße */
export function headInfo(B, o = {}) {
  const s = B.skel.s * (o.scale ?? 1), J = B.J;
  const c = J.head.pos.clone().add(V(0, 0.105 * s, 0.012 * s));
  return { c, s, rx: 0.087 * s, ry: 0.112 * s, rz: 0.1 * s };
}
/**
 * Kopf mit Gesicht. o: { skin, eye (Irisfarbe), eyeGlow (k), brow (Farbe), female, jaw, scale, lips, ears, noFace }
 * Rückgabe: Kopf-Info.
 */
export function head(B, o = {}) {
  const H = headInfo(B, o), s = H.s, c = H.c, f = !!o.female;
  const g = smoothSphere(1, 30, 22);
  const jaw = o.jaw ?? (f ? 0.82 : 1);
  warp(g, (p) => {
    let { x, y, z } = p;
    // Schädel hinten voller, Gesicht vorne flacher
    if (z < 0 && y > -0.2) z *= 1.06;
    if (z > 0.55) z = 0.55 + (z - 0.55) * 0.62;
    // Kiefer schmaler nach unten, Kinn
    if (y < 0) {
      const k = -y;
      x *= 1 - (0.3 + 0.08 * (1 - jaw)) * Math.pow(k, 1.4);
      if (z < 0) z *= 1 - 0.38 * Math.pow(k, 1.2);
      y *= 1 + 0.06 * (z > 0 ? 1 : 0) * jaw;
      if (z > 0.2 && k > 0.55) z += 0.06 * (k - 0.55) * jaw;
    }
    // Wangenknochen
    x *= 1 + 0.07 * Math.exp(-Math.pow((y + 0.05) / 0.2, 2)) * smooth(0.1, 0.6, z);
    // Augenhöhlen
    const ex = Math.abs(x) - 0.36, ey = y - 0.06;
    const e = Math.exp(-(ex * ex + ey * ey) / 0.03) * smooth(0.4, 0.8, z);
    z -= e * 0.07;
    // Brauenwulst
    z += 0.035 * Math.exp(-Math.pow((y - 0.22) / 0.08, 2)) * smooth(0.5, 0.85, z) * (f ? 0.5 : 1);
    p.set(x * H.rx, y * H.ry, z * H.rz);
  });
  T(g, c);
  const skin = o.skin || '#d9a07e';
  const headBind = 'head';
  if (!o.noSkull) B.add(g, skin, M.skin, headBind, { tier: o.tier });
  if (o.noFace) return H;
  const fz = c.z + H.rz * 0.6;
  // Nase
  const nose = tube([V(0, c.y + 0.02 * s, fz + 0.022 * s), V(0, c.y - 0.012 * s, fz + 0.036 * s), V(0, c.y - 0.03 * s, fz + 0.046 * s)], (t) => (0.0085 + 0.007 * t) * s * (f ? 0.85 : 1), { sides: 10, segs: 8 });
  B.add(nose, skin, M.skin, headBind);
  const nos = ell(0.014 * s, 0.009 * s, 0.01 * s, 10, 8); T(nos, V(0, c.y - 0.033 * s, fz + 0.04 * s));
  B.add(nos, skin, M.skin, headBind);
  // Augen: Lid-Mandel, Iris
  const eyeY = c.y + 0.006 * s, eyeX = 0.032 * s, eyeZ = fz + 0.005 * s;
  const white = ell(0.0145 * s, 0.0085 * s, 0.008 * s, 14, 10); T(white, V(eyeX, eyeY, eyeZ));
  B.sym(white, '#e8e2da', M.eye, headBind);
  const iris = ell(0.0068 * s, 0.0068 * s, 0.003 * s, 12, 8); T(iris, V(eyeX, eyeY, eyeZ + 0.0062 * s));
  if (o.eyeGlow) B.glowSym(iris, o.eye || '#6ad0ff', o.eyeGlow, headBind);
  else {
    B.sym(iris, o.eye || '#3b6a8a', M.eye, headBind);
    const pup = ell(0.003 * s, 0.003 * s, 0.002 * s, 8, 6); T(pup, V(eyeX, eyeY, eyeZ + 0.0085 * s)); B.sym(pup, '#0b0b10', M.eye, headBind);
  }
  // Oberlid (dunkle Linie) + Wimpernschwung
  const lid = sweep([V(eyeX - 0.016 * s, eyeY - 0.001 * s, eyeZ + 0.002 * s), V(eyeX, eyeY + 0.0085 * s, eyeZ + 0.007 * s), V(eyeX + 0.017 * s, eyeY + 0.003 * s, eyeZ - 0.001 * s), V(eyeX + 0.022 * s, eyeY + (f ? 0.007 : 0.004) * s, eyeZ - 0.004 * s)], [0.0026 * s, 0.0012 * s], 6, 10);
  B.sym(lid, o.lash || '#1a1214', M.hair, headBind);
  // Brauen
  const by = c.y + 0.03 * s;
  const brow = sweep([V(0.012 * s, by - 0.002 * s, fz + 0.017 * s), V(0.032 * s, by + (f ? 0.006 : 0.004) * s, fz + 0.016 * s), V(0.052 * s, by + 0.002 * s, fz + 0.004 * s)], (t) => (f ? 0.0032 : 0.0048) * s * (1 - 0.5 * t), 6, 10);
  B.sym(brow, o.brow || '#3a2418', M.hair, headBind);
  // Mund
  const my = c.y - 0.058 * s;
  const lip = sweep([V(-0.02 * s, my + 0.002 * s, fz + 0.016 * s), V(0, my, fz + 0.026 * s), V(0.02 * s, my + 0.002 * s, fz + 0.016 * s)], (t) => (0.0045 + 0.003 * Math.sin(t * PI)) * s, 8, 10);
  B.add(lip, o.lips || shade(skin, 0.78).lerp(new THREE.Color('#a04a4a'), f ? 0.35 : 0.1), M.skin, headBind);
  // Ohren
  if (o.ears !== false) {
    const ear = smoothSphere(1, 10, 8); ear.scale(0.012 * s, 0.026 * s, 0.018 * s); R(ear, 0, 0.3, 0); T(ear, V(H.rx * 0.98, c.y - 0.005 * s, c.z - 0.008 * s));
    B.sym(ear, skin, M.skin, headBind);
  }
  return H;
}

/** Haar-Kappe: Kopfform leicht vergrößert, Gesicht nach innen geklappt (Haaransatz). o: { col, vol, front (Haaransatz y), sideburn } */
export function hairCap(B, H, o = {}) {
  const g = smoothSphere(1, 28, 20), vol = o.vol ?? 1.1;
  const hl = o.front ?? 0.38;
  warp(g, (p) => {
    let { x, y, z } = p;
    const face = smooth(-0.1, 0.25, z) * (1 - smooth(hl - 0.05, hl + 0.12, y + 0.25 * Math.abs(x)));
    let k = vol;
    if (face > 0.01) k = lerp(vol, 0.82, face);
    // Nacken: unten hinten mehr Volumen, unten vorne weg
    if (y < -0.25 && z > -0.2) k = Math.min(k, 0.85);
    if (y < -0.55) k = Math.min(k, 0.86);
    k += (o.puff || 0) * Math.max(0, y) * 0.2;
    p.set(x * H.rx * k, y * H.ry * k * (y > 0 ? (o.top ?? 1.02) : 1), z * H.rz * k - (o.back || 0) * Math.max(0, -z) * H.rz);
  });
  T(g, H.c.clone().add(V(0, 0.004, -0.004)));
  B.add(g, o.col, M.hair, 'head', { tier: o.tier });
  return g;
}
/** Haarsträhne als flache Röhre */
export function strand(B, pts, w, th, col, bind = 'head', o = {}) {
  const g = tube(pts, (t, a) => {
    const k = o.taper ? 1 - t * o.taper : 1 - 0.65 * t;
    return [th * k, w * k];
  }, { sides: o.sides || 10, segs: o.segs || 14, hint: o.hint || [0, 0, 1], hintFn: o.hintFn });
  if (o.sym) B.sym(g, col, M.hair, bind, o); else B.add(g, col, M.hair, bind, o);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Umhang mit Knochenkette (cape, cape1, cape2, cape3)
// ---------------------------------------------------------------------------------------------
/**
 * o: { top (y), back (z der Oberkante), w0, w1 (Breite oben/unten), len, col, inCol, folds, fold, tatter, wrap, nu, nv, tier, hem (Saumfarbe), emblem }
 */
export function capeChain(B, o) {
  const J = B.J, s = B.skel.s;
  const top = o.top, len = o.len, back = o.back;
  if (!B.has('cape')) {
    B.joint('cape', 'chest', V(0, top, back));
    B.joint('cape1', 'cape', V(0, top - len * 0.33, back - 0.02 * s));
    B.joint('cape2', 'cape1', V(0, top - len * 0.66, back - 0.03 * s));
    B.joint('cape3', 'cape2', V(0, top - len, back - 0.04 * s));
  }
  const nu = o.nu || 16, nv = o.nv || 18, folds = o.folds ?? 5, fold = o.fold ?? 0.022 * s;
  const g = sheetGrid(nu, nv, (u, v) => {
    const w = lerp(o.w0, o.w1, Math.pow(v, 0.8));
    const x = (u - 0.5) * w;
    const wrapA = (u - 0.5) * (o.wrap ?? 1.4) * (1 - v * 0.6);
    let z = back + (Math.cos(wrapA) - 1) * w * 0.32 * (o.wrapK ?? 1) - v * 0.04 * s;
    let y = top - v * len;
    // Falten (nach unten stärker), Schulterwurf oben
    z += Math.sin(u * PI * folds * 2) * fold * smooth(0.05, 0.9, v);
    if (o.tatter) y += o.tatter * smooth(0.85, 1, v) * (0.5 + 0.5 * Math.sin(u * 37.0)) * (Math.abs(Math.sin(u * 13)) > 0.4 ? 1 : 0.25);
    if (o.shoulder) { const k = (1 - smooth(0, 0.12, v)); z += o.shoulder * k * (Math.abs(u - 0.5) * 2); y -= 0.02 * k * Math.abs(u - 0.5) * 2; }
    return V(x, y, z);
  });
  const bind = W.ramp('y', [[top - 0.02 * s, 'cape'], [top - len * 0.33, 'cape1'], [top - len * 0.66, 'cape2'], [top - len, 'cape3']]);
  const bindTop = (p) => { const w = bind(p); const k = 1 - smooth(top - 0.08 * s, top - 0.01 * s, p.y); return k < 1 ? w.map(([b, x]) => [b, x * k]).concat([['chest', 1 - k]]) : w; };
  B.cloth(g, o.col, o.mat || M.cloth, bindTop, { tier: o.tier, grad: o.inGrad });
  if (o.hem) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20, w = o.w1, x = (u - 0.5) * w, wrapA = (u - 0.5) * (o.wrap ?? 1.4) * 0.4;
      pts.push(V(x, top - len + 0.012 * s + (o.tatter ? 0 : 0), back + (Math.cos(wrapA) - 1) * w * 0.32 * (o.wrapK ?? 1) - 0.04 * s + Math.sin(u * PI * folds * 2) * fold * 0.95 + 0.004));
    }
    if (!o.tatter) B.add(sweep(pts, [0.008 * s, 0.008 * s], 6, 40), o.hem, M.gold, 'cape3', { tier: o.tier });
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Robe / Rock (Loft, doppelseitig) – Gewichte auf Hüfte/Oberschenkel
// ---------------------------------------------------------------------------------------------
/** prof: [[y, rx, rz], ...] von oben nach unten. o: { col, folds, fold, tatter, slit, open (vorn offen: Winkel), hem, tier, zOff } */
export function robe(B, prof, o = {}) {
  const s = B.skel.s;
  if (o.back !== false && !B.has('skirtB')) B.joint('skirtB', 'hips', V(0, B.J.hips.pos.y - 0.05 * s, -0.1 * s));
  const y0 = prof[0][0], y1 = prof[prof.length - 1][0];
  const nv = o.nv || 16, nu = o.nu || 40;
  const openA = o.open || 0; // Öffnung vorn (rad Gesamtbreite)
  const g = sheetGrid(nu, nv, (u, v) => {
    const y = lerp(y0, y1, v);
    // Profil bei y interpolieren
    let rx = prof[0][1], rz = prof[0][2], zo = prof[0][3] || 0;
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); const sm = t * t * (3 - 2 * t); const k = 0.4 * t + 0.6 * sm; rx = lerp(a[1], b[1], k); rz = lerp(a[2], b[2], k); zo = lerp(a[3] || 0, b[3] || 0, k); break; }
    }
    const ang = openA / 2 + u * (TAU - openA); // 0 = vorn
    const fk = 1 + (o.fold ?? 0.05) * Math.sin(ang * (o.folds || 9)) * smooth(0.15, 1, v);
    let x = Math.sin(ang) * rx * fk, z = Math.cos(ang) * rz * fk + zo;
    let yy = y;
    if (o.tatter) { const saw = ((ang * (o.tears || 9) / PI) % 1 + 1) % 1; yy += o.tatter * smooth(0.8, 1, v) * Math.abs(saw - 0.5) * 2; }
    if (o.hemWave) yy += o.hemWave * smooth(0.85, 1, v) * Math.sin(ang * 3 + 1);
    return V(x, yy, z);
  });
  if (openA === 0) {
    // Naht schließen: erster und letzter Spaltenpunkt identisch → Normalen glätten durch Mittelung
    const p = g.attributes.position, n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * (nu + 1), b = a + nu;
      const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
      n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
      p.setXYZ(b, p.getX(a), p.getY(a), p.getZ(a));
    }
  }
  // Normalen nach außen? (Gitterreihenfolge: u läuft gegen den Uhrzeigersinn von oben gesehen)
  const bind = o.bind || skirtWeights(B, { top: y0, hem: y1, legK: o.legK, back: o.backK, shin: o.shin });
  B.cloth(g, o.col, o.mat || M.cloth, bind, { tier: o.tier, grad: o.grad });
  if (o.hem) {
    const pts = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const u = i / n, ang = openA / 2 + u * (TAU - openA), last = prof[prof.length - 1];
      const fk = 1 + (o.fold ?? 0.05) * Math.sin(ang * (o.folds || 9));
      pts.push(V(Math.sin(ang) * last[1] * fk * 1.005, y1 + 0.012 * s + (o.hemWave ? o.hemWave * Math.sin(ang * 3 + 1) : 0), Math.cos(ang) * last[2] * fk * 1.005 + (last[3] || 0)));
    }
    B.add(tube(pts, () => (o.hemR ?? 0.009) * s, { sides: 6, segs: 120, caps: openA > 0 }), o.hem, o.hemMat || M.gold, bind, { tier: o.tier });
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Kapuze
// ---------------------------------------------------------------------------------------------
/** Kapuze über Kopfinfo H. o: { col, inCol, gap (Gesichtsöffnung), tip, drape (Schulterkragen), tier } */
export function hood(B, H, o = {}) {
  const s = H.s;
  const r = Math.max(H.rx, H.rz) * (o.scale ?? 1.32);
  const gap = o.gap ?? 1.55;
  const g = new THREE.SphereGeometry(r, 28, 18, PI / 2 + gap / 2, TAU - gap, 0, PI * (o.theta ?? 0.78));
  g.deleteAttribute('uv');
  const tip = o.tip ?? 0.5;
  warp(g, (p) => {
    // Spitze nach hinten
    if (p.z < 0 && p.y > -r * 0.3) { const k = Math.max(0, -p.z / r) * Math.max(0, p.y / r + 0.3); p.z -= k * r * tip; p.y += k * r * tip * 0.25 - k * k * r * tip * 0.3; }
    // unten aufweiten (Kragen)
    if (p.y < 0) { const k = 1 + (-p.y / r) * (o.flare ?? 0.55); p.x *= k; p.z *= k * 0.95; }
    // vordere Kante leicht nach vorn ziehen (Schirm)
    if (p.z > 0 && p.y > 0) p.z += (o.peak ?? 0.012) * s * (p.y / r);
  });
  g.scale(1, 1.08, 1);
  T(g, H.c.clone().add(V(0, 0.012 * s, -0.012 * s)));
  const bind = W.ramp('y', [[H.c.y - 0.1 * s, 'neck'], [H.c.y - 0.05 * s, 'head']]);
  B.cloth(g, o.col, o.mat || M.cloth, o.bind || bind, { tier: o.tier, grad: o.grad });
  // Saum der Gesichtsöffnung
  if (o.trim) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * PI * (o.theta ?? 0.78);
      const ph = PI / 2 + gap / 2;
      const x = -r * Math.cos(ph) * Math.sin(th), y = r * Math.cos(th), z = r * Math.sin(ph) * Math.sin(th);
      pts.push(V(x, y, z));
    }
    // vereinfachte Kante: Bogen über das Gesicht
    const arc = [];
    for (let i = 0; i <= 20; i++) {
      const a = -PI * 0.5 + (i / 20) * PI;
      arc.push(H.c.clone().add(V(Math.sin(a) * r * 0.66, Math.cos(a) * r * 0.86 + 0.0 * s, r * 0.68 + Math.cos(a) * 0.02 * s)));
    }
    B.add(sweep(arc, [0.006 * s, 0.006 * s], 6, 40), o.trim, M.gold, 'head', { tier: o.tier });
  }
  return g;
}

/** Kragen/Gugel-Überwurf: Kegelstumpf um die Schultern */
export function mantle(B, o) {
  const s = B.skel.s, J = B.J;
  const y0 = o.top ?? J.neck.pos.y + 0.0, y1 = o.bottom ?? J.upperArmL.pos.y - 0.12 * s;
  const g = robe(B, [[y0, o.r0 ?? 0.08 * s, o.r0z ?? 0.075 * s, -0.01 * s], [lerp(y0, y1, 0.45), (o.r1 ?? 0.2) * s, (o.r1z ?? 0.15) * s, -0.01 * s], [y1, (o.r2 ?? 0.27) * s, (o.r2z ?? 0.19) * s, -0.015 * s]],
    { col: o.col, folds: o.folds ?? 7, fold: o.fold ?? 0.04, tatter: o.tatter, tears: o.tears, hem: o.hem, back: false, bind: o.bind || torsoWeights(B), nv: 8, nu: 36, tier: o.tier, hemR: o.hemR });
  return g;
}
