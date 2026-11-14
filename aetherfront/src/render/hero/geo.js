// Aetherfront – Geometrie-Werkzeuge für die Heldenmodelle (prozedural, keine externen Assets).
// Alle Teile werden im Ruhe-Modellraum gebaut (Füße auf y = 0, Blick nach +Z, links = +X).
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const v3 = (a) => (a && a.isVector3 ? a.clone() : V(a[0], a[1], a[2]));
export const UP = V(0, 1, 0);

export function C(c) { return c && c.isColor ? c.clone() : new THREE.Color(c); }
export function shade(c, k) { return C(c).multiplyScalar(k); }
export function mix(a, b, t) { return C(a).lerp(C(b), t); }
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function n3(x, y, z, s = 0) {
  return (Math.sin(x * 1.73 + y * 3.11 + s) + Math.sin(y * 2.37 - z * 1.91 + s * 1.7) + Math.sin(z * 2.93 + x * 1.37 - s * 0.6)) / 3;
}

// ---- Grundformen ----------------------------------------------------------------------------
export function sph(r = 1, w = 16, h = 12) { return new THREE.SphereGeometry(r, w, h); }
export function ell(rx, ry, rz, w = 16, h = 12) { return sph(1, w, h).scale(rx, ry, rz); }
export function cyl(rt, rb, h, s = 12, open = false, hs = 1) { return new THREE.CylinderGeometry(rt, rb, h, s, hs, open); }
export function cone(r, h, s = 10) { return new THREE.ConeGeometry(r, h, s); }
export function tor(Rr, r, rs = 8, ts = 24, arc = TAU) { return new THREE.TorusGeometry(Rr, r, rs, ts, arc); }
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

export function R(g, x = 0, y = 0, z = 0, order = 'XYZ') {
  return g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z, order)));
}
export function T(g, p, y, z) { if (typeof p === 'number') return g.translate(p, y, z); const q = v3(p); return g.translate(q.x, q.y, q.z); }
export function S(g, x, y = x, z = x) { return g.scale(x, y, z); }
function qY(dir) { return new THREE.Quaternion().setFromUnitVectors(UP, v3(dir).normalize()); }
// Geometrie (entlang +Y gebaut) an pos in Richtung dir ausrichten
export function aim(g, pos, dir, roll = 0) {
  if (roll) g.rotateY(roll);
  g.applyQuaternion(qY(dir));
  return T(g, pos);
}
export function between(g, a, b, roll = 0) { const A = v3(a), B = v3(b); return aim(g, A, B.clone().sub(A), roll); }

// Drehkörper; Profil [r, y]; Orientierung wird automatisch nach außen gedreht
export function lathe(pts, seg = 16, ps = 0, pl = TAU) {
  let area = 0, span = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
    span = Math.max(span, Math.abs(a[1] - pts[0][1]), Math.abs(a[0] - pts[0][0]));
  }
  const f0 = pts[0], f1 = pts[pts.length - 1];
  const closed = (f0[0] < 1e-4 && f1[0] < 1e-4) || (Math.abs(f0[0] - f1[0]) + Math.abs(f0[1] - f1[1]) < 1e-4) || (pts.length > 4 && Math.abs(area) > 0.05 * span * span);
  const flip = closed ? area < 0 : f0[1] > f1[1];
  const P = flip ? pts.slice().reverse() : pts;
  const g = new THREE.LatheGeometry(P.map((p) => new THREE.Vector2(Math.max(0, p[0]), p[1])), seg, ps, pl);
  g.deleteAttribute('uv');
  return g;
}

/**
 * Röhre/Loft entlang eines Pfades mit winkelabhängigem Radius.
 * path: Punkte; rad(t, a) → Radius (Zahl) oder [rN, rB]; a = 0 zeigt in Richtung `hint` (Standard +Z).
 * Ringe ohne doppelte Naht → glatte Normalen. caps: Endkappen.
 */
export function tube(path, rad, o = {}) {
  const sides = o.sides || 12;
  const pts = path.map(v3);
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const N = o.segs || Math.max(4, pts.length * 4);
  const hint = v3(o.hint || [0, 0, 1]);
  const pos = [], idx = [];
  const P = V(), Tg = V(), Nn = V(), B = V(), prevN = V();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, Tg).normalize();
    let h = hint;
    if (o.hintFn) h = v3(o.hintFn(t));
    Nn.copy(h).addScaledVector(Tg, -h.dot(Tg));
    if (Nn.lengthSq() < 1e-6) Nn.copy(prevN.lengthSq() > 0 ? prevN : V(1, 0, 0));
    Nn.normalize(); prevN.copy(Nn);
    B.crossVectors(Tg, Nn).normalize();
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU;
      let r = rad(t, a);
      let rn, rb;
      if (Array.isArray(r)) { rn = r[0]; rb = r[1]; } else { rn = rb = r; }
      const c = Math.cos(a) * rn, s = Math.sin(a) * rb;
      pos.push(P.x + Nn.x * c + B.x * s, P.y + Nn.y * c + B.y * s, P.z + Nn.z * c + B.z * s);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = (i + 1) * sides + j, d = (i + 1) * sides + ((j + 1) % sides);
    idx.push(a, b, c, b, d, c);
  }
  if (o.caps !== false) {
    const p0 = curve.getPointAt(0), p1 = curve.getPointAt(1);
    const c0 = pos.length / 3; pos.push(p0.x, p0.y, p0.z);
    const c1 = c0 + 1; pos.push(p1.x, p1.y, p1.z);
    for (let j = 0; j < sides; j++) {
      idx.push(c0, (j + 1) % sides, j);
      idx.push(c1, N * sides + j, N * sides + ((j + 1) % sides));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (o.flip) flipFaces(g);
  return g;
}
// Einfache Variante: Radius nur entlang t (Array [r0, r1] oder Funktion t → r)
export function sweep(path, r, sides = 10, segs = 0, o = {}) {
  const rf = typeof r === 'function' ? r : (t) => r[0] + (r[1] - r[0]) * t;
  return tube(path, (t) => rf(t), { sides, segs, ...o });
}
// Gliedmaße zwischen a und b mit rundem Ende
export function limb(a, b, r1, r2 = r1, sides = 12, o = {}) {
  const A = v3(a), Bv = v3(b), L = A.distanceTo(Bv);
  const pts = [];
  const n = o.n || 3;
  for (let i = 0; i <= n; i++) { const t = -PI / 2 + (i / n) * (PI / 2); pts.push([Math.cos(t) * r1, Math.sin(t) * r1]); }
  for (let i = 0; i <= n; i++) { const t = (i / n) * (PI / 2); pts.push([Math.cos(t) * r2, L + Math.sin(t) * r2]); }
  pts[0][0] = 0; pts[pts.length - 1][0] = 0;
  return between(lathe(pts, sides), A, Bv);
}

export function flipFaces(g) {
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  const n = g.attributes.normal;
  if (n) for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

// ---- Flächen / Extrusion --------------------------------------------------------------------
export function shape(pts, smoothPts = false) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  if (smoothPts) {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], 0)), true, 'centripetal');
    const n = pts.length * (typeof smoothPts === 'number' ? smoothPts : 3);
    for (let i = 1; i < n; i++) { const q = c.getPoint(i / n); s.lineTo(q.x, q.y); }
  } else for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
export function ext(shp, depth, bev = 0.01, bs = 1, cs = 5) {
  const g = new THREE.ExtrudeGeometry(shp, {
    depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: bs, curveSegments: cs, steps: 1,
  });
  g.deleteAttribute('uv');
  g.translate(0, 0, -depth / 2);
  return g;
}
// Wölbung einer in XY liegenden Form: z -= kx*x² + ky*y²
export function bend(g, kx, ky = 0) {
  const p = g.attributes.position, n = g.attributes.normal, t = V();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, p.getZ(i) - kx * x * x - ky * y * y);
    t.set(n.getX(i) + 2 * kx * x * n.getZ(i), n.getY(i) + 2 * ky * y * n.getZ(i), n.getZ(i)).normalize();
    n.setXYZ(i, t.x, t.y, t.z);
  }
  return g;
}
export function warp(g, fn, recompute = true) {
  const p = g.attributes.position, t = V();
  for (let i = 0; i < p.count; i++) { t.set(p.getX(i), p.getY(i), p.getZ(i)); fn(t, i); p.setXYZ(i, t.x, t.y, t.z); }
  if (recompute) g.computeVertexNormals();
  return g;
}
// Kugel ohne UV-Naht (für glatte Verformung)
export function smoothSphere(r, w = 20, h = 14) {
  let g = sph(r, w, h);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
}
export function blob(r, seed = 1, amt = 0.15, w = 14, h = 10) {
  const g = smoothSphere(r, w, h);
  return warp(g, (p) => { const k = 1 + amt * n3(p.x * 4 / r, p.y * 4 / r, p.z * 4 / r, seed); p.multiplyScalar(k); });
}
export function crystal(r, h, sides = 6, base = 0.28) {
  const g = lathe([[0, -h * base], [r, 0], [r * 0.8, h * 0.66], [0, h]], sides, 0.3).toNonIndexed();
  g.computeVertexNormals();
  return g;
}
export function rock(r, seed = 1, detail = 1, rough = 0.22) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv');
  warp(g, (p) => { const k = 1 + rough * n3(p.x * 3.1 / r, p.y * 3.1 / r, p.z * 3.1 / r, seed); p.multiplyScalar(k); }, false);
  const n = g.toNonIndexed(); n.computeVertexNormals();
  return n;
}
export function starShape(ro, ri, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU + PI / 2, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return shape(pts);
}
export function leafShape(len, w) {
  return shape([[0, 0], [w * 0.42, len * 0.18], [w * 0.5, len * 0.45], [w * 0.3, len * 0.78], [0, len], [-w * 0.3, len * 0.78], [-w * 0.5, len * 0.45], [-w * 0.42, len * 0.18]], true);
}

/**
 * Stoffbahn als Gitter (für Umhänge, Schals, Wimpel). Liefert indizierte Geometrie (doppelseitig zu rendern).
 * fn(u, v) → Vector3 (u quer 0..1, v längs 0..1)
 */
export function sheetGrid(nu, nv, fn) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p.x, p.y, p.z); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Ring aus kleinen Teilen um einen Mittelpunkt (Runen, Nieten)
export function ringOf(n, fn) { const out = []; for (let i = 0; i < n; i++) out.push(fn(i, (i / n) * TAU)); return out; }

// An der YZ-Ebene spiegeln (Dreiecksreihenfolge korrigiert, indiziert oder nicht)
export function mirrorX(g) {
  g.scale(-1, 1, 1);
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  } else {
    for (const name of Object.keys(g.attributes)) {
      const at = g.attributes[name], is = at.itemSize, arr = at.array;
      for (let t = 0; t < at.count; t += 3) for (let k = 0; k < is; k++) { const i1 = (t + 1) * is + k, i2 = (t + 2) * is + k, x = arr[i1]; arr[i1] = arr[i2]; arr[i2] = x; }
    }
  }
  return g;
}
