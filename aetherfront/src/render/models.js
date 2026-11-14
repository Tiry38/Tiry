// Aetherfront – prozedurale 3D-Figuren (keine externen Assets).
// Jede Figur = EINE zusammengefügte BufferGeometry (Körper) + optional EINE Glow-Geometrie (HDR-Farben für Bloom).
// Attribute Körper: position, normal, color (linear), pbr (roughness, metalness). Glow: position, normal, color.
// Figuren stehen auf y = 0, schauen nach +Z, zentriert auf x/z = 0.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const PI = Math.PI;

// ---------------------------------------------------------------------------------------------
// Materialien (roughness, metalness)
// ---------------------------------------------------------------------------------------------
const MAT = {
  cloth: [0.85, 0], leather: [0.7, 0], skin: [0.6, 0], bark: [0.9, 0], wood: [0.75, 0],
  metal: [0.4, 0.9], dmetal: [0.48, 0.85], gold: [0.34, 1], bone: [0.6, 0], crystal: [0.15, 0.1],
  fur: [0.92, 0], rock: [0.88, 0], chitin: [0.38, 0.2], gem: [0.12, 0.25], scale: [0.5, 0.15],
  paint: [0.5, 0.35], leaf: [0.7, 0], rubber: [0.8, 0],
};

const FIX = {
  gold: '#e3a93c', leather: '#6a4329', dleather: '#3e2618', wood: '#7a5032', bark: '#4f3626',
  bone: '#cbbd9a', skin: '#e3a985', dark: '#1c1a22', steel: '#a9b3bf', iron: '#4a4e57',
  leaf: '#4f9a3a', moss: '#6fae3f', void: '#0d0814', white: '#e2ddd2', ember: '#ff6a1a',
};

// ---------------------------------------------------------------------------------------------
// Hilfen: Vektoren, Farben, Zufall, Rauschen
// ---------------------------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const v3 = (a) => (a && a.isVector3 ? a.clone() : V(a[0], a[1], a[2]));
const UP = V(0, 1, 0);

function C(c) { return c && c.isColor ? c.clone() : new THREE.Color(c); }
function shade(c, k) { return C(c).multiplyScalar(k); }
function mix(a, b, t) { return C(a).lerp(C(b), t); }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function n3(x, y, z, s = 0) {
  return (Math.sin(x * 1.73 + y * 3.11 + s) + Math.sin(y * 2.37 - z * 1.91 + s * 1.7) + Math.sin(z * 2.93 + x * 1.37 - s * 0.6)) / 3;
}
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ---------------------------------------------------------------------------------------------
// Geometrie-Grundformen
// ---------------------------------------------------------------------------------------------
function sph(r = 1, w = 10, h = 7) { return new THREE.SphereGeometry(r, w, h); }
function ell(rx, ry, rz, w = 10, h = 7) { return sph(1, w, h).scale(rx, ry, rz); }
function cyl(rt, rb, h, s = 10, open = false) { return new THREE.CylinderGeometry(rt, rb, h, s, 1, open); }
function cone(r, h, s = 8) { return new THREE.ConeGeometry(r, h, s); }
function tor(R, r, rs = 6, ts = 18, arc = TAU) { return new THREE.TorusGeometry(R, r, rs, ts, arc); }
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function rbox(w, h, d, r = 0.03, s = 1) {
  return new RoundedBoxGeometry(w, h, d, s, Math.max(1e-3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
}
// Drehkörper. Die Profil-Richtung wird automatisch so gedreht, dass die Flächen nach außen zeigen
// (gegen den Uhrzeigersinn in der (r,y)-Ebene; offene Profile: von unten nach oben).
function lathe(pts, seg = 12, ps = 0, pl = TAU) {
  let area = 0, span = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
    span = Math.max(span, Math.abs(a[1] - pts[0][1]), Math.abs(a[0] - pts[0][0]));
  }
  const f0 = pts[0], f1 = pts[pts.length - 1];
  const closed = (f0[0] < 1e-4 && f1[0] < 1e-4) || (Math.abs(f0[0] - f1[0]) + Math.abs(f0[1] - f1[1]) < 1e-4) || pts.length > 4 && Math.abs(area) > 0.05 * span * span;
  const flip = closed ? area < 0 : f0[1] > f1[1];
  const P = flip ? pts.slice().reverse() : pts;
  return new THREE.LatheGeometry(P.map((p) => new THREE.Vector2(Math.max(0, p[0]), p[1])), seg, ps, pl);
}
function R(g, x = 0, y = 0, z = 0, order = 'XYZ') {
  return g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z, order)));
}
// Drehung um einen Drehpunkt
function Rp(g, pv, x = 0, y = 0, z = 0) { const q = v3(pv); g.translate(-q.x, -q.y, -q.z); R(g, x, y, z); return g.translate(q.x, q.y, q.z); }
function T(g, p) { const q = v3(p); return g.translate(q.x, q.y, q.z); }
function qY(dir) { return new THREE.Quaternion().setFromUnitVectors(UP, v3(dir).normalize()); }
// Geometrie (entlang +Y aufgebaut) an Position pos in Richtung dir ausrichten, roll = Drehung um eigene Achse
function aim(g, pos, dir, roll = 0) {
  if (roll) g.rotateY(roll);
  g.applyQuaternion(qY(dir));
  return T(g, pos);
}
function between(g, a, b, roll = 0) { const A = v3(a), B = v3(b); return aim(g, A, B.clone().sub(A), roll); }

// Verjüngte Kapsel von a nach b (Gliedmaßen)
function seg(a, b, r1, r2 = r1, sides = 6, n = 2) {
  const A = v3(a), B = v3(b), L = A.distanceTo(B);
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = -PI / 2 + (i / n) * (PI / 2); pts.push([Math.cos(t) * r1, Math.sin(t) * r1]); }
  for (let i = 0; i <= n; i++) { const t = (i / n) * (PI / 2); pts.push([Math.cos(t) * r2, L + Math.sin(t) * r2]); }
  pts[0][0] = 0; pts[pts.length - 1][0] = 0;
  return between(lathe(pts, sides), A, B);
}

// Drehprofil zwischen a und b; Profil-y ist relativ (0..1)
function shaft(a, b, prof, sides = 8) {
  const L = v3(a).distanceTo(v3(b));
  return between(lathe(prof.map((p) => [p[0], p[1] * L]), sides), a, b);
}

// Röhre entlang einer Kurve mit variablem Radius (Schwänze, Hörner, Wurzeln, Ranken)
function sweep(points, rad, sides = 8, segs = 0, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal');
  const N = segs || Math.max(6, points.length * 4);
  const fr = curve.computeFrenetFrames(N, false);
  const fx = o.fx || 1, fy = o.fy || 1;
  const pos = [], idx = [];
  const rf = typeof rad === 'function' ? rad : (t) => rad[0] + (rad[1] - rad[0]) * t;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), r = rf(t), Nn = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU, c = Math.cos(a) * r * fx, s = Math.sin(a) * r * fy;
      pos.push(p.x + Nn.x * c + B.x * s, p.y + Nn.y * c + B.y * s, p.z + Nn.z * c + B.z * s);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = (i + 1) * sides + j, d = (i + 1) * sides + ((j + 1) % sides);
    idx.push(a, b, c, b, d, c);
  }
  const p0 = curve.getPointAt(0), p1 = curve.getPointAt(1);
  const c0 = pos.length / 3; pos.push(p0.x, p0.y, p0.z);
  const c1 = c0 + 1; pos.push(p1.x, p1.y, p1.z);
  for (let j = 0; j < sides; j++) {
    idx.push(c0, (j + 1) % sides, j);
    idx.push(c1, N * sides + j, N * sides + ((j + 1) % sides));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 2D-Form → extrudiert mit Fase (Klingen, Schilde, Flügel, Embleme). Zentriert in z.
function shape(pts, smoothPts = false) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  if (smoothPts) s.splineThru(pts.slice(1).concat([pts[0]]).map((p) => new THREE.Vector2(p[0], p[1])));
  else for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
function ext(shp, depth, bev = 0.02, bs = 2, cs = 6, crease = 0) {
  const g = new THREE.ExtrudeGeometry(shp, {
    depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: bs, curveSegments: cs, steps: 1,
  });
  g.deleteAttribute('uv');
  g.translate(0, 0, -depth / 2);
  return crease ? toCreasedNormals(g, crease) : g;
}
// Wölbung einer (in XY liegenden) Form: z -= kx*x² + ky*y²  (Normalen korrekt mitgedreht)
function bend(g, kx, ky = 0) {
  const p = g.attributes.position, n = g.attributes.normal, t = V();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, p.getZ(i) - kx * x * x - ky * y * y);
    t.set(n.getX(i) + 2 * kx * x * n.getZ(i), n.getY(i) + 2 * ky * y * n.getZ(i), n.getZ(i)).normalize();
    n.setXYZ(i, t.x, t.y, t.z);
  }
  return g;
}
// Positionen verformen (danach Normalen neu)
function warp(g, fn, recompute = true) {
  const p = g.attributes.position, t = V();
  for (let i = 0; i < p.count; i++) { t.set(p.getX(i), p.getY(i), p.getZ(i)); fn(t); p.setXYZ(i, t.x, t.y, t.z); }
  if (recompute) g.computeVertexNormals();
  return g;
}
// Facettierter Fels/Kristall-Brocken
function rock(r, seed = 1, detail = 1, rough = 0.22) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv');
  warp(g, (p) => { const k = 1 + rough * n3(p.x * 3.1 / r, p.y * 3.1 / r, p.z * 3.1 / r, seed); p.multiplyScalar(k); }, false);
  g.computeVertexNormals();
  return g;
}
// Weicher, organischer Klumpen (Laub, Muskeln, Fell)
function blob(r, seed = 1, amt = 0.15, w = 11, h = 8) {
  let g = sph(r, w, h);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  return warp(g, (p) => { const k = 1 + amt * n3(p.x * 4 / r, p.y * 4 / r, p.z * 4 / r, seed); p.multiplyScalar(k); });
}
// Kristall (Doppelpyramide, facettiert)
function crystal(r, h, sides = 6) {
  const g = lathe([[0, -h * 0.28], [r, 0], [r * 0.82, h * 0.62], [0, h]], sides, 0.3).toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function flat(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }

// Teil vorbereiten: nicht-indiziert, nur position + normal
function prep(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}
// An der YZ-Ebene spiegeln (mit korrekter Dreiecks-Orientierung)
function mirrorX(src) {
  const g = src.clone();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], is = a.itemSize, arr = a.array;
    if (name === 'position' || name === 'normal') for (let i = 0; i < a.count; i++) arr[i * is] = -arr[i * is];
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < is; k++) {
      const i1 = (t + 1) * is + k, i2 = (t + 2) * is + k, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
    a.needsUpdate = true;
  }
  return g;
}
// Innenseite für dünne Flächen (Umhänge, Flügelhäute)
function backface(src, off = 0.006) {
  const g = src.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) - n.getX(i) * off, p.getY(i) - n.getY(i) * off, p.getZ(i) - n.getZ(i) * off);
    n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], is = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < is; k++) {
      const i1 = (t + 1) * is + k, i2 = (t + 2) * is + k, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Baukasten: sammelt Teile, färbt, fügt zusammen
// ---------------------------------------------------------------------------------------------
class Kit {
  constructor(o) {
    this.o = o;
    this.tier = o.tier;
    this.rng = mulberry32((o.seed | 0) * 7919 + 13);
    this.body = [];
    this.glows = [];
    this.P = {
      pri: C(o.primary), sec: C(o.secondary), met: C(o.metal), glw: C(o.glow),
      gold: C(FIX.gold), leather: C(FIX.leather), dleather: C(FIX.dleather), wood: C(FIX.wood), bark: C(FIX.bark),
      bone: C(FIX.bone), skin: C(FIX.skin), dark: C(FIX.dark), steel: C(FIX.steel), iron: C(FIX.iron),
      leaf: C(FIX.leaf), moss: C(FIX.moss), void: C(FIX.void), white: C(FIX.white), ember: C(FIX.ember),
    };
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  _paint(g, col, mat) {
    g = prep(g);
    const n = g.attributes.position.count, c = C(col);
    const ca = new Float32Array(n * 3), pa = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; pa[i * 2] = mat[0]; pa[i * 2 + 1] = mat[1]; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    g.setAttribute('pbr', new THREE.BufferAttribute(pa, 2));
    return g;
  }
  add(g, col, mat = MAT.cloth) { g = this._paint(g, col, mat); this.body.push(g); return g; }

  // rechts + gespiegelt links
  sym(g, col, mat = MAT.cloth) { g = this.add(g, col, mat); this.body.push(mirrorX(g)); return g; }
  // dünne Fläche mit Innenseite (inCol)
  sheet(g, col, inCol, mat = MAT.cloth, mirror = false) {
    g = this.add(g, col, mat);
    const b = this._paint(backface(g), inCol || col, mat);
    this.body.push(b);
    if (mirror) { this.body.push(mirrorX(g)); this.body.push(mirrorX(b)); }
    return g;
  }
  glow(g, col, k = 3) {
    g = prep(g);
    const n = g.attributes.position.count, c = C(col).multiplyScalar(k), ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    this.glows.push(g);
    return g;
  }
  symGlow(g, col, k = 3) { g = this.glow(g, col, k); this.glows.push(mirrorX(g)); return g; }

  finish(scale, radius, aoAmt = 1) {
    const body = mergeGeometries(this.body, false);
    body.computeBoundingBox();
    const bb = body.boundingBox, H = Math.max(0.2, bb.max.y - bb.min.y), y0 = bb.min.y;
    const p = body.attributes.position, nrm = body.attributes.normal, col = body.attributes.color;
    const seed = (this.o.seed | 0) * 0.37 + 1.3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nv = 1 + 0.07 * n3(x * 7, y * 7, z * 7, seed) + 0.03 * n3(x * 23, y * 23, z * 23, seed * 2.1);
      const h = (y - y0) / H;
      const ao = 1 - aoAmt * (0.42 * (1 - smooth(0, 0.42, h)) + 0.14 * Math.max(0, -nrm.getY(i)));
      let r = col.getX(i) * nv * ao, g = col.getY(i) * nv * ao, b = col.getZ(i) * nv * ao;
      // weiches Begrenzen sehr heller Albedo (verhindert Ausbrennen/Bloom auf weißen Flächen)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0.42) { const f = (0.42 + (lum - 0.42) * 0.4) / lum; r *= f; g *= f; b *= f; }
      col.setXYZ(i, r, g, b);
    }
    body.scale(scale, scale, scale);
    let glow = null;
    if (this.glows.length) { glow = mergeGeometries(this.glows, false); glow.scale(scale, scale, scale); glow.computeBoundingBox(); }
    body.computeBoundingBox(); body.computeBoundingSphere();
    if (glow) glow.computeBoundingSphere();
    let top = body.boundingBox.max.y;
    if (glow) top = Math.max(top, glow.boundingBox.max.y);
    return { body, glow, height: +top.toFixed(3), radius: +(radius * scale).toFixed(3) };
  }
}

// ---------------------------------------------------------------------------------------------
// Teile-Bibliothek
// ---------------------------------------------------------------------------------------------

// Kuppel mit Randwulst (Schulterplatten, Helmteile, Panzerplatten)
function dome(r, h = r * 0.8, seg = 12, lip = 0.1) {
  return lathe([
    [0, h], [r * 0.5, h * 0.9], [r * 0.85, h * 0.6], [r, h * 0.12],
    [r * (1 + lip), 0], [r * 0.9, -r * 0.08], [0, -r * 0.05],
  ], seg);
}

// Schulterplatte: mehrere Lagen, Goldrand, optional Stacheln. side: +1 = links (x>0)
function pauldron(K, pos, r, col, trim, o = {}) {
  const layers = o.layers || 2, tilt = o.tilt ?? 0.75, mat = o.mat || MAT.metal;
  for (let i = 0; i < layers; i++) {
    const rr = r * (1 - i * 0.16);
    const g = dome(rr, rr * (0.75 - i * 0.1), 8, 0.12);
    g.scale(1, 1, o.zs || 0.95);
    R(g, 0, 0, -tilt - i * 0.28);
    T(g, [pos[0] + i * r * 0.18, pos[1] - i * r * 0.42, pos[2]]);
    K.sym(g, col, mat);
    if (trim && i === 0) {
      const t = tor(rr * 1.1, rr * 0.07, 3, 12);
      t.rotateX(PI / 2); t.scale(1, 1, o.zs || 0.95);
      R(t, 0, 0, -tilt - i * 0.28);
      T(t, [pos[0] + i * r * 0.18, pos[1] - i * r * 0.42, pos[2]]);
      K.sym(t, trim, MAT.gold);
    }
  }
  if (o.spikes) {
    for (let s = 0; s < o.spikes; s++) {
      const a = (s - (o.spikes - 1) / 2) * 0.55;
      const sp = cone(r * 0.16, r * (0.9 - Math.abs(a) * 0.4), 6);
      sp.translate(0, r * 0.5, 0);
      R(sp, a, 0, -0.35);
      T(sp, [pos[0] + r * 0.15, pos[1] + r * 0.45, pos[2]]);
      K.sym(sp, o.spikeCol || col, o.spikeMat || mat);
    }
  }
  if (o.gem) {
    const gm = sph(r * 0.14, 8, 6);
    T(gm, [pos[0] + r * 0.62, pos[1] + r * 0.32, pos[2] + 0.0]);
    K.symGlow(gm, o.gem, 3);
  }
}

// Gerade Klinge (entlang +Y). Rückgabe: Liste {g, part}
function bladeShape(len, w, tip = 0.18, base = 0.5) {
  return shape([[-w / 2 * base, 0], [-w / 2, len * 0.08], [-w / 2 * 0.92, len * (1 - tip)], [0, len], [w / 2 * 0.92, len * (1 - tip)], [w / 2, len * 0.08], [w / 2 * base, 0]]);
}
// Schwert: origin = Griffmitte, entlang +Y
function sword(K, pos, dir, o = {}) {
  const len = o.len || 0.85, w = o.w || 0.09, roll = o.roll || 0, P = K.P;
  const parts = [];
  const blade = ext(bladeShape(len, w, o.tip || 0.16), o.th || 0.018, 0.012, 1);
  blade.translate(0, 0.06, 0);
  parts.push([blade, o.bladeCol || P.steel, MAT.metal]);
  const guard = o.guard ?? 0.26;
  const g1 = cyl(0.03, 0.03, guard, 6); g1.rotateZ(PI / 2); g1.scale(1, 0.8, 1); g1.translate(0, 0.04, 0);
  parts.push([g1, o.guardCol || P.gold, MAT.gold]);
  if (o.wings) {
    for (const s of [-1, 1]) { const wg = sweep([[s * guard * 0.45, 0.04, 0], [s * guard * 0.62, 0.1, 0], [s * guard * 0.6, 0.18, 0]], [0.025, 0.006], 6, 8); parts.push([wg, P.gold, MAT.gold]); }
  }
  const grip = cyl(0.026, 0.028, 0.18, 8); grip.translate(0, -0.07, 0);
  parts.push([grip, P.dleather, MAT.leather]);
  const pom = sph(0.042, 7, 5); pom.translate(0, -0.18, 0);
  parts.push([pom, o.guardCol || P.gold, MAT.gold]);
  for (const [g, c, m] of parts) K.add(aim(g, pos, dir, roll), c, m);
  if (o.glow !== false) {
    const f = rbox(w * 0.22, len * 0.72, o.th ? o.th + 0.03 : 0.045, 0.006, 1);
    f.translate(0, 0.08 + len * 0.38, 0);
    K.glow(aim(f, pos, dir, roll), o.glowCol || P.glw, o.glowK || 2.2);
    const gem = sph(0.024, 8, 6); gem.translate(0, 0.04, 0.032);
    K.glow(aim(gem, pos, dir, roll), o.glowCol || P.glw, 3);
  }
}

// Wappenschild (Heater). Vorderseite zeigt +Z. scale s
function heaterShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.24 * s, 0.24 * s);
  sh.quadraticCurveTo(0, 0.29 * s, 0.24 * s, 0.24 * s);
  sh.lineTo(0.235 * s, 0.02 * s);
  sh.quadraticCurveTo(0.2 * s, -0.24 * s, 0, -0.36 * s);
  sh.quadraticCurveTo(-0.2 * s, -0.24 * s, -0.235 * s, 0.02 * s);
  sh.closePath();
  return sh;
}
function ringShape(outerFn, k = 0.84) {
  const o = outerFn(1);
  const inner = outerFn(k);
  const hole = new THREE.Path(inner.getPoints(4).reverse());
  o.holes.push(hole);
  return o;
}
function shield(K, pos, rotY, o = {}) {
  const s = o.s || 1, P = K.P, sfn = o.shapeFn || heaterShape, curv = o.curv ?? 0.9;
  const parts = [];
  const face = ext(sfn(s), 0.035 * s, 0.014 * s, 1, 4); bend(face, curv / s, (o.curvY || 0.15) / s);
  parts.push([face, o.face || P.pri, MAT.paint, 'b']);
  const rim = ext(ringShape((k) => sfn(s * k), 0.88), 0.07 * s, 0, 1, 4); bend(rim, curv / s, (o.curvY || 0.15) / s);
  rim.translate(0, 0, 0.012 * s);
  parts.push([rim, o.rim || P.gold, MAT.gold, 'b']);
  if (o.emblem !== false) {
    const em = ext(o.emblemShape ? o.emblemShape(s) : starShape(0.12 * s, 0.05 * s, 4), 0.02 * s, 0.008 * s, 1);
    em.translate(0, 0.03 * s, 0.035 * s);
    parts.push([em, o.emblemCol || P.sec, MAT.gold, 'b']);
  }
  if (o.boss) { const b = sph(0.05 * s, 10, 6); b.scale(1, 1, 0.6); b.translate(0, 0.03 * s, 0.04 * s); parts.push([b, P.gold, MAT.gold, 'b']); }
  const handle = cyl(0.03 * s, 0.03 * s, 0.22 * s, 5); handle.translate(0, 0, -0.05 * s);
  parts.push([handle, P.dleather, MAT.leather, 'b']);
  for (const [g, c, m] of parts) {
    R(g, o.tiltX || 0, rotY, o.tiltZ || 0);
    K.add(T(g, pos), c, m);
  }
  if (o.glowEmblem) {
    const em = ext(starShape(0.06 * s, 0.025 * s, 4), 0.02 * s, 0.004 * s, 1);
    em.translate(0, 0.03 * s, 0.055 * s);
    R(em, o.tiltX || 0, rotY, o.tiltZ || 0);
    K.glow(T(em, pos), P.glw, 3);
  }
}
function starShape(ro, ri, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU + PI / 2, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return shape(pts);
}

// Umhang: Zylinder-Teilschale hinter dem Körper, mit Faltenwurf
function cape(K, o) {
  const { top, bot, rTop, rBot, arc = 2.4, col, inCol, z = 0, folds = 7, fold = 0.07, tatter = 0, flare = 0 } = o;
  const h = top - bot;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 12, o.hseg || 5, true, PI - arc / 2, arc);
  g.deleteAttribute('uv');
  warp(g, (p) => {
    const t = (top - (p.y + h / 2 + bot)) / h; // 0 oben .. 1 unten
    const a = Math.atan2(p.x, p.z);
    const k = 1 + fold * t * Math.sin(a * folds) + flare * t * t;
    p.x *= k; p.z *= k;
    if (tatter) p.y += tatter * t * t * (0.5 + 0.5 * Math.sin(a * 23)) * (Math.abs(Math.sin(a * 9)) > 0.5 ? 1 : 0.3);
  });
  g.translate(0, bot + h / 2, z);
  if (o.lean) { R(g, -o.lean, 0, 0); }
  K.sheet(g, col, inCol || shade(col, 0.55), MAT.cloth);
}

// Gesichts-Augen (Glow), symmetrisch
function eyes(K, pos, dx, r, col, k = 3.2, sq = 0.6) {
  const g = sph(r, 8, 6); g.scale(1.25, sq, 0.8); T(g, [dx, pos[1], pos[2]]);
  K.symGlow(g, col, k);
}

// Stiefel (asymmetrisch platzierbar)
function boot(K, ankle, col, mat, s = 1, o = {}) {
  const a = v3(ankle);
  const g = lathe([[0, 0], [0.085, 0.01], [0.08, 0.1], [0.065, 0.16], [0, 0.17]], 7);
  g.scale(s, s, s * 1.0);
  T(g, [a.x, 0, a.z - 0.02 * s]);
  K.add(g, col, mat);
  const toe = ell(0.07 * s, 0.055 * s, 0.11 * s, 7, 4); T(toe, [a.x, 0.045 * s, a.z + 0.07 * s]);
  K.add(toe, col, mat);
  if (o.cuff) { const c = tor(0.074 * s, 0.018 * s, 4, 10); c.rotateX(PI / 2); T(c, [a.x, 0.15 * s, a.z - 0.02 * s]); K.add(c, o.cuff, MAT.gold); }
}

// Standard-Bein: Hüfte → Knie → Knöchel
function legPair(K, o) {
  const { hipX = 0.12, hipY = 0.95, kneeY = 0.53, stance = [0.1, -0.07], spread = 0.04, thigh = [0.1, 0.08], shin = [0.075, 0.06] } = o;
  const res = [];
  [1, -1].forEach((s, i) => {
    const z = stance[i];
    const hip = V(hipX * s, hipY, 0), ankle = V((hipX + spread) * s, 0.13, z), knee = V((hipX + spread * 0.7) * s, kneeY, z * 0.5 + 0.05);
    K.add(seg(hip, knee, thigh[0], thigh[1], 6, 1), o.thighCol, o.thighMat || MAT.cloth);
    K.add(seg(knee, ankle, shin[0], shin[1], 6, 1), o.shinCol, o.shinMat || MAT.metal);
    if (o.kneeCol) {
      const kp = ell(0.075, 0.07, 0.05, 6, 4); kp.translate(knee.x, knee.y, knee.z + 0.04);
      K.add(kp, o.kneeCol, MAT.metal);
      if (o.kneeSpike) { const sp = cone(0.025, 0.09, 6); sp.rotateX(PI / 2); sp.translate(knee.x, knee.y, knee.z + 0.13); K.add(sp, o.kneeCol, MAT.metal); }
    }
    if (o.bootCol) boot(K, ankle, o.bootCol, o.bootMat || MAT.metal, o.bootS || 1, { cuff: o.cuff });
    res.push({ hip, knee, ankle });
  });
  return res;
}

// Arm: Schulter → Ellbogen → Hand
function arm(K, sh, el, ha, o) {
  K.add(seg(sh, el, o.r1 || 0.075, o.r2 || 0.065, 6, 1), o.upperCol, o.upperMat || MAT.cloth);
  K.add(seg(el, ha, o.r3 || 0.07, o.r4 || 0.058, 6, 1), o.foreCol, o.foreMat || MAT.metal);
  if (o.cuff) {
    const d = v3(ha).sub(v3(el)).normalize();
    const c = cyl(0.085, 0.07, 0.1, 8, true); aim(c, v3(el).lerp(v3(ha), 0.62), d);
    K.add(c, o.cuff, o.cuffMat || MAT.metal);
  }
  if (o.handCol) { const h = ell(0.07, 0.065, 0.075, 7, 5); T(h, ha); K.add(h, o.handCol, o.handMat || MAT.metal); }
}

// Torso aus Drehprofil, in z gestaucht
function torso(K, prof, col, mat, zs = 0.72, seg = 12, o = {}) {
  const g = lathe(prof, seg);
  g.scale(o.xs || 1, 1, zs);
  if (o.lean) R(g, o.lean, 0, 0);
  if (o.at) T(g, o.at);
  return K.add(g, col, mat);
}

// Gürtel
function belt(K, y, rx, rz, col, buckle) {
  const g = tor(1, 0.12, 4, 12); g.rotateX(PI / 2); g.scale(rx, 0.32, rz); g.translate(0, y, 0);
  K.add(g, col, MAT.leather);
  if (buckle) { const b = box(0.09, 0.07, 0.03); b.translate(0, y, rz * 1.06); K.add(b, buckle, MAT.gold); }
}

// Stab (Holz, leicht gewunden)
function staff(K, a, b, col, r = 0.03, o = {}) {
  const A = v3(a), B = v3(b), pts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5, p = A.clone().lerp(B, t);
    if (o.wobble !== 0) { p.x += Math.sin(t * 9 + 1) * (o.wobble || 0.012); p.z += Math.cos(t * 7) * (o.wobble || 0.012); }
    pts.push(p);
  }
  K.add(sweep(pts, [r * 1.05, r * 0.85], 7, 14), col, o.mat || MAT.wood);
}

// Hörner/Geweih als gebogene Spitze
function horn(K, base, pts, r, col, mat = MAT.bone, mirror = true) {
  const g = sweep([base, ...pts], (t) => r * (1 - t * 0.92), 7, 12);
  return mirror ? K.sym(g, col, mat) : K.add(g, col, mat);
}

// Fledermaus-/Drachenflügel (rechts = x>0 Seite; mirror erzeugt beide)
function batWing(K, root, span, o) {
  const P = K.P, col = o.col, mem = o.mem || col;
  const up = o.up ?? 0.5, back = o.back ?? -0.25;
  // Fingerknochen
  const shoulder = v3(root);
  const elbow = shoulder.clone().add(V(span * 0.38, span * up * 0.55, back * 0.4));
  const wrist = shoulder.clone().add(V(span * 0.62, span * up * 0.85, back * 0.7));
  const tips = [
    wrist.clone().add(V(span * 0.42, span * 0.12 * up, back * 0.6)),
    wrist.clone().add(V(span * 0.36, -span * 0.25, back * 0.9)),
    wrist.clone().add(V(span * 0.16, -span * 0.52, back * 1.0)),
  ];
  const bone = o.boneCol || shade(col, 0.8);
  K.sym(seg(shoulder, elbow, span * 0.05, span * 0.04, 7, 2), bone, o.mat || MAT.skin);
  K.sym(seg(elbow, wrist, span * 0.04, span * 0.03, 7, 2), bone, o.mat || MAT.skin);
  for (const t of tips) K.sym(sweep([wrist, wrist.clone().lerp(t, 0.5).add(V(0, span * 0.03, 0)), t], (u) => span * 0.025 * (1 - u * 0.8), 5, 8), bone, o.mat || MAT.skin);
  const claw = cone(span * 0.025, span * 0.09, 5); aim(claw, wrist, V(0.2, 1, 0.3)); K.sym(claw, P.bone, MAT.bone);
  // Membran: Fächer aus Dreiecken zwischen Schulter, Knochen und Spitzen, mit Bogen-Einbuchtungen
  const ring = [shoulder.clone().add(V(0, -span * 0.05, 0)), elbow, wrist, tips[0]];
  const edgePts = [tips[0], tips[1], tips[2], shoulder.clone().add(V(span * 0.08, -span * 0.3, back * 0.5))];
  const pos = [];
  const sag = (a, b, k) => { const m = a.clone().lerp(b, 0.5); const c = m.clone().lerp(wrist, k); return c; };
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // Hauptflächen pro Finger-Segment, mit Zwischenpunkten für Einbuchtung
  for (let i = 0; i < edgePts.length - 1; i++) {
    const a = edgePts[i], b = edgePts[i + 1], m = sag(a, b, 0.28);
    tri(wrist, a, m); tri(wrist, m, b);
  }
  tri(wrist, edgePts[3], elbow); tri(elbow, edgePts[3], shoulder);
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.computeVertexNormals();
  // Normalen sollen nach oben/außen zeigen: prüfen und ggf. umdrehen
  const n = mg.attributes.normal; let sum = 0; for (let i = 0; i < n.count; i++) sum += n.getY(i) + n.getZ(i) * 0.3;
  let g = mg; if (sum < 0) g = backface(prep(mg), 0);
  K.sheet(g, mem, shade(mem, 0.75), o.memMat || MAT.skin, true);
  return { shoulder, elbow, wrist, tips };
}

// Feder (extrudiert, für Greif / Engel)
function featherShape(len, w) {
  return shape([[0, 0], [w * 0.45, len * 0.2], [w * 0.5, len * 0.62], [w * 0.15, len], [-w * 0.3, len * 0.78], [-w * 0.42, len * 0.3]]);
}
function featherWing(K, root, o) {
  const { span = 1.2, col, tip, up = 1, n = 10 } = o;
  const sh = v3(root);
  const el = sh.clone().add(V(span * 0.34, span * 0.3 * up, -span * 0.06));
  const wr = sh.clone().add(V(span * 0.68, span * 0.5 * up, -span * 0.12));
  const tp = sh.clone().add(V(span * 0.98, span * 0.56 * up, -span * 0.22));
  K.sym(sweep([sh, el, wr, tp], (u) => span * 0.055 * (1 - u * 0.7), 6, 10), col, MAT.cloth);
  const crv = new THREE.CatmullRomCurve3([sh, el, wr, tp]);
  for (let i = 0; i < n; i++) {
    const t = 0.06 + 0.94 * (i / (n - 1));
    const p = crv.getPointAt(t);
    const len = span * (0.36 + 0.38 * t), w = span * (0.17 - 0.04 * t);
    const d = V(0.12 + 1.0 * t * t, -1 + 0.75 * t, -0.18 - 0.1 * t).normalize();
    const f = ext(featherShape(len, w), 0.02, 0);
    aim(f, p.clone().add(V(0, 0, -0.01 * i)), d, 0.15);
    K.sym(f, mix(col, tip, Math.min(1, t * 1.3)), MAT.cloth);
    if (i % 2 === 0) {
      const c2 = ext(featherShape(len * 0.48, w * 0.95), 0.018, 0);
      aim(c2, p.clone().add(V(0, 0.01, 0.025)), d, 0.15);
      K.sym(c2, shade(col, 1.08), MAT.cloth);
    }
  }
}

// Blatt
function leafShape(len, w) { return shape([[0, 0], [w * 0.42, len * 0.18], [w * 0.5, len * 0.45], [w * 0.3, len * 0.78], [0, len], [-w * 0.3, len * 0.78], [-w * 0.5, len * 0.45], [-w * 0.42, len * 0.18]]); }

// Gliederbein: 4 Punkte (Hüfte, Knie hoch, Gelenk, Spitze), verdickte Segmente
function bugLeg(K, pts, r, col, mat, jointCol, tipCol) {
  const [a, b, c, d] = pts.map(v3);
  K.add(shaft(a, b, [[0, 0], [r * 0.8, 0.06], [r, 0.4], [r * 0.75, 0.94], [0, 1]], 5), col, mat);
  K.add(shaft(b, c, [[0, 0], [r * 0.7, 0.06], [r * 0.85, 0.3], [r * 0.55, 0.94], [0, 1]], 5), col, mat);
  K.add(shaft(c, d, [[0, 0], [r * 0.5, 0.08], [r * 0.4, 0.35], [r * 0.08, 1]], 5), tipCol || col, mat);
  if (jointCol) for (const j of [b, c]) { const g = sph(r * 0.72, 5, 4); T(g, j); K.add(g, jointCol, MAT.gold); }
}

// Vierbeiner-Bein (digitigrad): Schulter, Ellbogen, Fußgelenk, Pfote
function beastLeg(K, top, mid, low, paw, r, col, mat, o = {}) {
  K.add(seg(top, mid, r, r * 0.75, 7, 2), col, mat);
  K.add(seg(mid, low, r * 0.7, r * 0.55, 6, 2), col, mat);
  K.add(seg(low, paw, r * 0.55, r * 0.5, 6, 1), col, mat);
  const p = ell(r * 0.85, r * 0.5, r * 1.1, 8, 5); T(p, [v3(paw).x, r * 0.45, v3(paw).z + r * 0.3]); K.add(p, o.pawCol || col, mat);
  if (o.claws) for (let i = -1; i <= 1; i++) {
    const c = cone(r * 0.16, r * 0.5, 5); c.rotateX(PI / 2 + 0.4); T(c, [v3(paw).x + i * r * 0.4, r * 0.25, v3(paw).z + r * 1.2]);
    K.add(c, o.clawCol || K.P.bone, MAT.bone);
  }
}

// Runen-Ring (Glow-Segmente auf einem Kreis)
function runeRing(K, center, R0, n, col, k = 3, tilt = [PI / 2, 0, 0], size = 0.04) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const g = box(size * (i % 3 === 0 ? 1.8 : 1), size * 0.5, size * 0.5);
    g.rotateZ(a + PI / 2); g.translate(Math.cos(a) * R0, Math.sin(a) * R0, 0);
    R(g, tilt[0], tilt[1], tilt[2]);
    K.glow(T(g, center), col, k);
  }
}

// @@PARTS_END

// ---------------------------------------------------------------------------------------------
// Archetypen
// ---------------------------------------------------------------------------------------------

// ---- Gemeinsame Humanoid-Bausteine ----------------------------------------------------------------

// Kapuze: Kugelschale mit Öffnung vorne, Zipfel hinten, dunkles Gesicht innen
function hood(K, c, r, col, o = {}) {
  const P = K.P, gap = o.gap ?? 1.7;
  const g = new THREE.SphereGeometry(r, o.seg || 12, 8, PI / 2 + gap / 2, TAU - gap, 0, PI * (o.theta || 0.8));
  g.deleteAttribute('uv');
  const tip = o.tip ?? 0.6;
  warp(g, (p) => {
    if (p.z < 0 && p.y > -r * 0.3) { const k = Math.max(0, -p.z / r) * Math.max(0, p.y / r + 0.3); p.z -= k * r * tip; p.y += k * r * tip * 0.35; }
    if (p.y < 0) { const k = 1 + (-p.y / r) * (o.flare ?? 0.45); p.x *= k; p.z *= k; }
  });
  T(g, c);
  K.sheet(g, col, o.inCol || shade(col, 0.35), MAT.cloth);
  const face = ell(r * 0.82, r * 0.86, r * 0.7, 10, 7); T(face, [c[0], c[1] - r * 0.05, c[2] - r * 0.05]);
  K.add(face, o.faceCol || P.void, MAT.cloth);
  if (o.eyes !== false) eyes(K, [0, c[1] - r * 0.08, c[2] + r * 0.62], r * 0.3, r * 0.11, o.eyeCol || P.glw, o.eyeK || 3.4, 0.55);
}

// Robe/Rock: Drehprofil [r,y] von oben nach unten, mit Falten und optional zerrissenem Saum
function robe(K, prof, col, o = {}) {
  const g = lathe(prof, o.seg || 14);
  const yTop = prof[0][1], yBot = prof[prof.length - 1][1];
  const yHem = Math.min(...prof.map((p) => p[1]));
  warp(g, (p) => {
    const a = Math.atan2(p.x, p.z), t = Math.min(1, Math.max(0, (yTop - p.y) / (yTop - yHem)));
    const k = 1 + (o.fold ?? 0.06) * t * Math.sin(a * (o.folds || 9));
    p.x *= k * (o.xs || 1); p.z *= k * (o.zs || 0.85);
    if (o.tatter && p.y < yHem + 0.02 && Math.hypot(p.x, p.z) > 0.05) {
      const saw = ((a * (o.tears || 7) / PI) % 1 + 1) % 1;
      p.y += o.tatter * (o.down ? -1 : 1) * Math.abs(saw - 0.5) * 2;
    }
  });
  if (o.lean) R(g, o.lean, 0, 0);
  if (o.at) T(g, o.at);
  K.add(g, col, o.mat || MAT.cloth);
  if (o.hem) {
    const h = tor(1, 0.03, 4, 18); h.rotateX(PI / 2); h.scale(prof[prof.length - 2][0] * (o.xs || 1), 1, prof[prof.length - 2][0] * (o.zs || 0.85));
    h.translate(0, prof[prof.length - 2][1] + 0.03, 0);
    if (o.lean) R(h, o.lean, 0, 0);
    if (o.at) T(h, o.at);
    K.add(h, o.hem, MAT.gold);
  }
  return g;
}

// Weiter Ärmel (offener Trichter) von Schulter zu Handgelenk
function sleeve(K, sh, wr, r1, r2, col, inCol) {
  const L = v3(sh).distanceTo(v3(wr));
  const g = lathe([[r1 * 0.8, 0], [r1, L * 0.3], [r2 * 0.9, L * 0.85], [r2, L]], 8);
  between(g, sh, wr);
  K.sheet(g, col, inCol || shade(col, 0.4), MAT.cloth);
  const cap = sph(r1 * 0.95, 8, 6); T(cap, sh); K.add(cap, col, MAT.cloth);
}
function handS(K, p, col, s = 1) { const h = ell(0.055 * s, 0.06 * s, 0.06 * s, 7, 5); T(h, p); K.add(h, col, MAT.skin); }

// ---- Plattenrüstungs-Körper (Ritter, Paladin, Gefallener, König) ------------------------------------
function plateBody(K, o) {
  const P = K.P, t = K.tier, w = o.w || 1;
  const met = o.met || P.met, trim = o.trim || P.gold, cloth = o.cloth || P.pri, mail = o.mail || shade(met, 0.5);
  const mm = o.metMat || MAT.metal;
  legPair(K, {
    hipX: 0.12 * w, thighCol: mail, thighMat: MAT.dmetal, shinCol: met, shinMat: mm, kneeCol: met, kneeSpike: o.spiky,
    bootCol: met, bootMat: mm, cuff: t >= 2 ? trim : null, thigh: [0.1 * w, 0.085 * w], shin: [0.08 * w, 0.065 * w], bootS: w, stance: o.stance,
  });
  // Beinschurz
  K.add(lathe([[0.2, 1.05], [0.25, 0.95], [0.31, 0.74], [0.28, 0.72], [0.2, 0.9]], 12).scale(w, 1, 0.82 * w), met, mm);
  K.add(tor(0.3, 0.018, 4, 14).rotateX(PI / 2).scale(w, 1, 0.82 * w).translate(0, 0.73, 0), trim, MAT.gold);
  if (o.tabard !== false) {
    const tab = ext(shape([[-0.13, 0], [0.13, 0], [0.12, -0.38], [0, -0.48], [-0.12, -0.38]]), 0.02, 0.008, 1);
    bend(tab, 0.6); R(tab, -0.12, 0, 0); tab.scale(w, 1, 1); tab.translate(0, 1.0, 0.245 * w);
    K.add(tab, cloth, MAT.cloth);
    if (o.tabardBack) { const tb = tab.clone(); tb.rotateY(PI); K.add(tb, cloth, MAT.cloth); }
    const em = ext(starShape(0.06, 0.025, 4), 0.012, 0.005, 1); em.translate(0, 0.82, 0.275 * w); K.add(em, trim, MAT.gold);
  }
  // Brustpanzer
  torso(K, [[0, 0.95], [0.2, 0.97], [0.23, 1.05], [0.215, 1.14], [0.25, 1.25], [0.31, 1.38], [0.32, 1.47], [0.26, 1.54], [0.12, 1.58], [0, 1.6]], met, mm, 0.74 * w, 10, { xs: w });
  const ridge = tor(0.27, 0.018, 3, 8, PI * 0.5); ridge.rotateZ(PI * 0.25); ridge.rotateY(PI / 2); ridge.scale(1, 1.1, w); ridge.translate(0, 1.15, -0.02);
  K.add(ridge, trim, MAT.gold);
  const plate = ext(shape([[-0.17, 0.0], [0.17, 0.0], [0.2, 0.16], [0, 0.21], [-0.2, 0.16]]), 0.02, 0.01, 1); bend(plate, 2.2 / w);
  R(plate, -0.15, 0, 0); plate.scale(w, 1, 1); plate.translate(0, 1.3, 0.215 * w); K.add(plate, shade(met, 1.1), mm);
  belt(K, 1.02, 0.235 * w, 0.19 * w, P.dleather, trim);
  const ce = ext(o.chestShape || starShape(0.055, 0.022, 4), 0.014, 0.006, 1); ce.translate(0, 1.37, 0.25 * w); K.add(ce, trim, MAT.gold);
  if (t >= 2 || o.chestGem) { const gm = sph(0.028, 8, 6); gm.translate(0, 1.37, 0.275 * w); K.glow(gm, P.glw, 3); }
  if (o.cape) cape(K, Object.assign({ top: 1.55, bot: 0.3, rTop: 0.24 * w, rBot: 0.5 * w, arc: 2.5, col: cloth, inCol: shade(cloth, 0.45), z: -0.04, lean: -0.08, seg: 10, hseg: 4 }, o.cape));
  pauldron(K, [0.33 * w, 1.5, 0], o.pr || 0.17 * w, met, trim, { layers: o.layers || (t >= 2 ? 3 : 2), spikes: o.spikes || 0, gem: t >= 3 ? P.glw : null, spikeCol: o.spikeCol, mat: mm });
  for (const [sh, el, ha] of o.arms) arm(K, sh, el, ha, { upperCol: mail, upperMat: MAT.dmetal, foreCol: met, foreMat: mm, handCol: met, handMat: mm, cuff: met, cuffMat: mm, r1: 0.078 * w, r2: 0.068 * w, r3: 0.072 * w, r4: 0.06 * w });
  // Hals + Helm
  K.add(seg([0, 1.55, 0], [0, 1.66, 0.01], 0.07, 0.07), mail, MAT.dmetal);
  helm(K, o.helm || 'great', o);
}

function helm(K, type, o) {
  const P = K.P, t = K.tier, met = o.met || P.met, trim = o.trim || P.gold, mm = o.metMat || MAT.metal;
  if (type === 'great' || type === 'bucket' || type === 'royal') {
    const prof = type === 'bucket'
      ? [[0, 1.59], [0.13, 1.59], [0.16, 1.63], [0.165, 1.78], [0.15, 1.87], [0.08, 1.9], [0, 1.9]]
      : [[0, 1.6], [0.12, 1.6], [0.15, 1.64], [0.155, 1.74], [0.145, 1.82], [0.11, 1.88], [0.05, 1.91], [0, 1.915]];
    const hm = lathe(prof, 10); hm.scale(1, 1, 1.08); K.add(hm, met, mm);
    if (type === 'bucket') {
      K.add(box(0.24, 0.03, 0.05).translate(0, 1.75, 0.155), P.dark, MAT.dmetal);
      K.add(box(0.035, 0.12, 0.05).translate(0, 1.69, 0.165), P.dark, MAT.dmetal);
      K.glow(box(0.2, 0.012, 0.02).translate(0, 1.75, 0.18), P.glw, 3.2);
      K.glow(box(0.012, 0.09, 0.02).translate(0, 1.7, 0.19), P.glw, 2.6);
      const band = lathe([[0.165, 1.62], [0.172, 1.62], [0.172, 1.66], [0.165, 1.66]], 12); band.scale(1, 1, 1.08); K.add(band, trim, MAT.gold);
      const cross = ext(shape([[-0.012, 0], [0.012, 0], [0.012, 0.1], [-0.012, 0.1]]), 0.01, 0.004, 1); cross.translate(0, 1.79, 0.17); K.add(cross, trim, MAT.gold);
    } else {
      K.add(box(0.22, 0.03, 0.05).translate(0, 1.74, 0.15), P.dark, MAT.dmetal);
      eyes(K, [0, 1.74, 0.17], 0.045, 0.018, P.glw, 3.5, 0.45);
      const crest = tor(0.155, 0.016, 3, 10, PI); crest.rotateY(PI / 2); crest.scale(1, 0.95, 1.08); crest.translate(0, 1.76, 0);
      K.add(crest, trim, MAT.gold);
    }
    if (t >= 2 && type !== 'royal') { const cr = lathe([[0.155, 1.8], [0.168, 1.8], [0.172, 1.86], [0.158, 1.86]], 12); cr.scale(1, 1, 1.08); K.add(cr, trim, MAT.gold); }
    if (t >= 3 && type !== 'royal') {
      const wing = ext(shape([[0, 0], [0.05, 0.12], [0.03, 0.27], [-0.03, 0.18], [-0.02, 0.08]], true), 0.012, 0.006, 1, 3);
      R(wing, 0, PI / 2, 0); wing.rotateZ(-0.5); wing.translate(0.15, 1.78, -0.02); K.sym(wing, trim, MAT.gold);
    }
  } else if (type === 'horned') {
    const hm = lathe([[0, 1.59], [0.13, 1.59], [0.16, 1.66], [0.158, 1.76], [0.13, 1.86], [0.06, 1.95], [0, 2.0]], 10); hm.scale(1, 1, 1.12);
    K.add(hm, met, mm);
    // Visier-Kinnschutz, spitz nach vorne
    const jaw = cone(0.09, 0.16, 6); jaw.rotateX(PI / 2 + 0.6); jaw.scale(1.3, 1, 0.8); jaw.translate(0, 1.66, 0.13); K.add(jaw, met, mm);
    K.add(box(0.21, 0.025, 0.05).translate(0, 1.75, 0.16), P.dark, MAT.dmetal);
    eyes(K, [0, 1.75, 0.18], 0.05, 0.02, P.glw, 4, 0.4);
    K.sym(sweep([[0.13, 1.82, 0], [0.24, 1.9, 0.03], [0.3, 2.05, 0.08], [0.27, 2.2, 0.16]], (u) => 0.045 * (1 - u * 0.92), 5, 8), o.hornCol || P.bone, MAT.bone);
    for (let i = 0; i < 3; i++) { const sp = cone(0.025, 0.12 - i * 0.02, 5); sp.rotateX(-0.5 - i * 0.35); sp.translate(0, 1.95 - i * 0.07, -0.05 - i * 0.07); K.add(sp, met, mm); }
  }
}

// Turmschild (hoch, oben gerundet, unten spitz)
function towerShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.27 * s, 0.4 * s);
  sh.quadraticCurveTo(0, 0.52 * s, 0.27 * s, 0.4 * s);
  sh.lineTo(0.27 * s, -0.3 * s);
  sh.quadraticCurveTo(0.2 * s, -0.48 * s, 0, -0.56 * s);
  sh.quadraticCurveTo(-0.2 * s, -0.48 * s, -0.27 * s, -0.3 * s);
  sh.closePath();
  return sh;
}
function crossShape(s = 1) { return shape([[-0.025, -0.16], [0.025, -0.16], [0.025, 0.06], [0.1, 0.06], [0.1, 0.11], [0.025, 0.11], [0.025, 0.18], [-0.025, 0.18], [-0.025, 0.11], [-0.1, 0.11], [-0.1, 0.06], [-0.025, 0.06]].map((p) => [p[0] * s, p[1] * s])); }

// ---- Ritter -------------------------------------------------------------------------------------
function knight(K) {
  const P = K.P, t = K.tier;
  const haR = V(-0.36, 1.08, 0.32), haL = V(0.36, 1.14, 0.28);
  plateBody(K, {
    cape: {}, arms: [[V(-0.33, 1.44, 0), V(-0.44, 1.18, 0.1), haR], [V(0.33, 1.44, 0), V(0.45, 1.2, 0.08), haL]],
  });
  sword(K, haR, V(-0.3, 0.85, 0.42), { len: 0.9 + (t - 1) * 0.06, w: 0.095, roll: 0.3, wings: t >= 3, glowK: 1.4 + t * 0.6 });
  shield(K, [0.38, 1.12, 0.4], 0.35, { s: 1.0 + (t - 1) * 0.08, boss: t >= 2, glowEmblem: t >= 3 });
  K.add(sweep([[0, 1.9, 0.02], [0, 2.0, -0.06], [0, 1.97, -0.22], [0, 1.82, -0.34]], (u) => 0.055 * Math.sin(PI * (0.15 + 0.85 * u)) + 0.01, 5, 8, { fx: 0.6 }), P.pri, MAT.cloth);
  if (t >= 3) { const halo = tor(0.2, 0.012, 4, 28); halo.rotateX(PI / 2 - 0.3); halo.translate(0, 2.04, -0.1); K.glow(halo, P.glw, 2.6); }
  return [1, 0.6];
}

// ---- Schwerer Paladin ---------------------------------------------------------------------------
function paladin_heavy(K) {
  const P = K.P, t = K.tier, w = 1.22;
  const haR = V(-0.44, 1.2, 0.22), haL = V(0.42, 1.08, 0.3);
  plateBody(K, {
    w, helm: 'bucket', pr: 0.24, layers: t >= 2 ? 3 : 2, cape: { col: P.sec, inCol: shade(P.pri, 0.5), rBot: 0.62, arc: 2.7 }, cloth: P.pri,
    chestShape: crossShape(0.55), stance: [0.12, -0.1],
    arms: [[V(-0.4, 1.44, 0), V(-0.55, 1.2, -0.02), haR], [V(0.4, 1.44, 0), V(0.52, 1.18, 0.08), haL]],
  });
  // Turmschild
  shield(K, [0.44, 1.0, 0.44], 0.25, { s: 1.15 + (t - 1) * 0.06, shapeFn: towerShape, curv: 0.6, curvY: 0.05, emblemShape: (s) => crossShape(s * 1.4), emblemCol: P.gold, boss: false, glowEmblem: t >= 2 });
  // Kriegshammer über der Schulter
  const top = V(-0.5, 2.0, -0.32), d = top.clone().sub(haR);
  const sh = cyl(0.03, 0.034, d.length() + 0.25, 7); sh.translate(0, d.length() / 2 - 0.08, 0); aim(sh, haR, d); K.add(sh, P.dleather, MAT.leather);
  for (const k of [0.2, 0.55]) { const b = cyl(0.04, 0.04, 0.05, 7); b.translate(0, d.length() * k, 0); aim(b, haR, d); K.add(b, P.gold, MAT.gold); }
  const head = rbox(0.34, 0.2, 0.2, 0.05, 1); head.rotateZ(PI / 2); head.rotateY(0.3); head.translate(0, d.length() + 0.05, 0); aim(head, haR, d); K.add(head, P.met, MAT.metal);
  const band = cyl(0.115, 0.115, 0.06, 8); band.rotateZ(PI / 2); band.rotateY(0.3); band.translate(0, d.length() + 0.05, 0); aim(band, haR, d); K.add(band, P.gold, MAT.gold);
  const spike = cone(0.06, 0.18, 6); spike.translate(0, d.length() + 0.22, 0); aim(spike, haR, d); K.add(spike, P.met, MAT.metal);
  const rn = sph(0.05, 8, 6); rn.scale(1, 1, 0.4); rn.rotateY(0.3); rn.translate(0, d.length() + 0.05, 0); aim(rn, haR, d);
  const rn2 = rn.clone(); K.glow(rn.translate(0.0, 0, 0), P.glw, 2.5 + t * 0.4);
  if (t >= 3) {
    for (const s of [1]) { const wing = ext(shape([[0, 0], [0.08, 0.16], [0.05, 0.36], [-0.03, 0.26], [-0.03, 0.1]], true), 0.014, 0.006, 1, 3); R(wing, 0, PI / 2, 0); wing.rotateZ(-0.45); wing.translate(0.17 * s, 1.78, -0.02); K.sym(wing, P.gold, MAT.gold); }
    const halo = tor(0.24, 0.014, 4, 28); halo.rotateX(PI / 2 - 0.25); halo.translate(0, 2.06, -0.12); K.glow(halo, P.glw, 2.6);
  }
  return [1.3, 0.8];
}

// ---- Bogenschütze ---------------------------------------------------------------------------------
function archer(K) {
  const P = K.P, t = K.tier, lea = P.leather;
  const legCol = shade(P.sec, 0.45);
  legPair(K, { hipX: 0.11, thighCol: legCol, shinCol: legCol, shinMat: MAT.cloth, bootCol: P.dleather, bootMat: MAT.leather, thigh: [0.085, 0.07], shin: [0.068, 0.055], stance: [0.14, -0.1], cuff: t >= 2 ? P.gold : null });
  for (const s of [1, -1]) { const c = cyl(0.08, 0.07, 0.2, 8, true); c.translate(0.15 * s, 0.33, s > 0 ? 0.07 : -0.04); K.add(c, P.dleather, MAT.leather); }
  // Wams + Rockschöße
  robe(K, [[0, 1.05], [0.2, 1.04], [0.24, 0.9], [0.27, 0.72], [0, 0.71]], P.pri, { fold: 0.1, folds: 6, tatter: 0.08, tears: 4, seg: 12 });
  torso(K, [[0, 0.98], [0.19, 1.0], [0.21, 1.12], [0.25, 1.3], [0.27, 1.42], [0.22, 1.52], [0.1, 1.57], [0, 1.58]], lea, MAT.leather, 0.72);
  // Brustriemen + Gürtel
  const strap = tor(0.28, 0.02, 3, 16); strap.scale(0.85, 1.25, 0.72); strap.rotateZ(0.7); strap.translate(0, 1.28, 0); K.add(strap, P.dleather, MAT.leather);
  belt(K, 1.03, 0.22, 0.17, P.dleather, P.gold);
  // Umhang (Mantel) + Kapuze
  cape(K, { top: 1.56, bot: 0.55, rTop: 0.26, rBot: 0.42, arc: 3.0, col: P.pri, inCol: shade(P.pri, 0.4), z: -0.02, tatter: 0.1, lean: -0.05 });
  const mantle = lathe([[0.1, 1.62], [0.24, 1.56], [0.33, 1.42], [0.3, 1.4], [0.2, 1.5], [0.08, 1.56]], 12); mantle.scale(1, 1, 0.85); K.add(mantle, P.pri, MAT.cloth);
  K.add(seg([0, 1.55, 0], [0, 1.64, 0.01], 0.06, 0.06), P.skin, MAT.skin);
  hood(K, [0, 1.74, 0.0], 0.16, P.pri, { tip: 0.9, eyeCol: P.glw });
  // Arme: links Bogen vorne, rechts zieht die Sehne
  const shL = V(0.27, 1.45, 0), elL = V(0.3, 1.42, 0.24), haL = V(0.22, 1.4, 0.48);
  const shR = V(-0.27, 1.45, 0), elR = V(-0.36, 1.42, -0.12), haR = V(0.04, 1.48, 0.06);
  arm(K, shL, elL, haL, { upperCol: lea, upperMat: MAT.leather, foreCol: P.dleather, foreMat: MAT.leather, cuff: P.dleather, cuffMat: MAT.leather, r1: 0.065, r2: 0.055, r3: 0.06, r4: 0.05 });
  arm(K, shR, elR, haR, { upperCol: lea, upperMat: MAT.leather, foreCol: P.dleather, foreMat: MAT.leather, cuff: P.dleather, cuffMat: MAT.leather, r1: 0.065, r2: 0.055, r3: 0.06, r4: 0.05 });
  handS(K, haL, P.dleather); handS(K, haR, P.dleather);
  const pad = dome(0.11, 0.08, 8, 0.1); R(pad, 0, 0, -0.8); pad.translate(0.29, 1.5, 0); K.sym(pad, P.dleather, MAT.leather);
  // Langbogen (in der Ebene x = haL.x)
  const bx = haL.x, bz = haL.z;
  const bowPts = [[bx, 0.62, bz - 0.2], [bx, 0.9, bz - 0.02], [bx, 1.15, bz + 0.03], [bx, 1.4, bz + 0.04], [bx, 1.65, bz + 0.03], [bx, 1.9, bz - 0.02], [bx, 2.16, bz - 0.2]];
  K.add(sweep(bowPts, (u) => 0.022 + 0.014 * Math.sin(u * PI), 5, 16, { fx: 0.8 }), t >= 2 ? P.gold : P.wood, t >= 2 ? MAT.gold : MAT.wood);
  for (const e of [0, 1]) { const tip = sph(0.03, 6, 5); T(tip, bowPts[e ? 6 : 0]); K.add(tip, P.gold, MAT.gold); }
  const grip = cyl(0.032, 0.032, 0.14, 6); grip.translate(bx, 1.4, bz + 0.04); K.add(grip, P.dleather, MAT.leather);
  // Sehne zur Zughand
  K.add(seg(bowPts[0], haR, 0.006, 0.006, 4, 1), P.white, MAT.cloth);
  K.add(seg(haR, bowPts[6], 0.006, 0.006, 4, 1), P.white, MAT.cloth);
  // Pfeil
  const ad = V(bx, 1.42, bz + 0.3).sub(haR);
  const shaft = cyl(0.009, 0.009, ad.length(), 5); shaft.translate(0, ad.length() / 2, 0); aim(shaft, haR, ad); K.add(shaft, P.wood, MAT.wood);
  const ah = cone(0.028, 0.1, 6); ah.translate(0, ad.length() + 0.04, 0); aim(ah, haR, ad); K.glow(ah, P.glw, 3 + t * 0.4);
  // Köcher auf dem Rücken
  const qa = V(0.12, 1.0, -0.2), qb = V(-0.16, 1.62, -0.24);
  K.add(seg(qa, qb, 0.075, 0.085, 8, 1), P.dleather, MAT.leather);
  const qr = tor(0.085, 0.015, 4, 10); qr.rotateX(PI / 2); aim(qr, qb.clone().lerp(qa, 0.1), qb.clone().sub(qa)); K.add(qr, P.gold, MAT.gold);
  for (let i = 0; i < 3; i++) {
    const base = qb.clone().add(V((i - 1) * 0.035, 0.02, (i % 2) * 0.03));
    const tipP = base.clone().add(qb.clone().sub(qa).normalize().multiplyScalar(0.2));
    K.add(seg(base, tipP, 0.008, 0.008, 4, 1), P.wood, MAT.wood);
    const f = ext(shape([[0, 0], [0.03, 0.03], [0.03, 0.11], [0, 0.08]]), 0.004, 0.003, 1); R(f, 0, i * 0.8, 0);
    aim(f, base.clone().lerp(tipP, 0.4), tipP.clone().sub(base)); K.add(f, i % 2 ? P.white : P.sec, MAT.cloth);
  }
  if (t >= 3) { const h = tor(0.14, 0.01, 4, 24); h.rotateX(PI / 2 - 0.4); h.translate(0, 2.0, -0.12); K.glow(h, P.glw, 2.4); runeRing(K, [bx, 1.4, bz + 0.04], 0.07, 6, P.glw, 2.5, [0, PI / 2, 0], 0.02); }
  return [1, 0.55];
}

// ---- Priester -------------------------------------------------------------------------------------
function priest(K) {
  const P = K.P, t = K.tier;
  robe(K, [[0, 1.52], [0.15, 1.5], [0.24, 1.42], [0.22, 1.2], [0.25, 0.9], [0.34, 0.45], [0.42, 0.05], [0.4, 0.0], [0, 0.0]], P.pri, { hem: P.gold, seg: 16, fold: 0.08 });
  // Überwurf (Skapulier) vorne + hinten
  for (const s of [1, -1]) {
    const st = ext(shape([[-0.11, 0], [0.11, 0], [0.09, -1.0], [0, -1.1], [-0.09, -1.0]]), 0.015, 0.006, 1);
    bend(st, 0.8); R(st, -0.08 * s, s < 0 ? PI : 0, 0); st.translate(0, 1.42, 0.2 * s);
    K.add(st, P.sec, MAT.cloth);
  }
  const sym = ext(crossShape(0.55), 0.014, 0.006, 1); sym.translate(0, 1.18, 0.245); R(sym, -0.08, 0, 0); K.add(sym, P.gold, MAT.gold);
  belt(K, 1.08, 0.24, 0.2, P.gold, null);
  // Kragen
  const col = lathe([[0.12, 1.58], [0.26, 1.5], [0.32, 1.38], [0.27, 1.37], [0.2, 1.47], [0.1, 1.54]], 14); col.scale(1, 1, 0.9); K.add(col, P.sec, MAT.cloth);
  K.add(tor(0.3, 0.015, 4, 16).rotateX(PI / 2).scale(1, 1, 0.9).translate(0, 1.385, 0), P.gold, MAT.gold);
  // Kopf mit Kapuze
  K.add(seg([0, 1.52, 0], [0, 1.62, 0.01], 0.06, 0.06), P.skin, MAT.skin);
  hood(K, [0, 1.72, 0], 0.155, P.white, { tip: 0.2, inCol: shade(P.pri, 0.3), eyeCol: P.glw, faceCol: shade(P.skin, 0.35) });
  const circ = tor(0.135, 0.014, 4, 16); circ.rotateX(PI / 2 + 0.25); circ.translate(0, 1.82, 0.02); K.add(circ, P.gold, MAT.gold);
  // Heiligenschein
  const halo = tor(0.25, 0.018, 4, 30); halo.translate(0, 1.82, -0.2); K.glow(halo, P.glw, 2.8);
  for (let i = 0; i < 8 + (t - 1) * 4; i++) { const a = (i / (8 + (t - 1) * 4)) * TAU; const r = box(0.012, 0.08, 0.01); r.translate(0, 0.32, 0); r.rotateZ(a); r.translate(0, 1.82, -0.21); K.glow(r, P.glw, 2.2); }
  // Ärmel + Hände
  const shR = V(-0.26, 1.42, 0), haR = V(-0.38, 1.12, 0.22), shL = V(0.26, 1.42, 0), haL = V(0.4, 1.3, 0.24);
  sleeve(K, shR, haR, 0.08, 0.14, P.pri, P.sec); sleeve(K, shL, haL, 0.08, 0.14, P.pri, P.sec);
  handS(K, haR, P.skin); handS(K, haL, P.skin);
  const heal = sph(0.07, 10, 8); heal.translate(haL.x + 0.02, haL.y + 0.1, haL.z + 0.04); K.glow(heal, P.glw, 2.6);
  // Stab
  const sb = V(-0.4, 0.02, 0.28), stp = V(-0.37, 2.0, 0.18);
  staff(K, sb, stp, P.gold, 0.026, { mat: MAT.gold, wobble: 0 });
  for (const k of [0.45, 0.62]) { const r = tor(0.035, 0.012, 4, 10); r.rotateX(PI / 2); T(r, sb.clone().lerp(stp, k)); K.add(r, P.white, MAT.cloth); }
  const cr = tor(0.13, 0.022, 5, 16, PI * 1.5); cr.rotateZ(-PI * 0.25); cr.rotateY(PI / 2 - 0.3); cr.translate(stp.x, stp.y + 0.12, stp.z); K.add(cr, P.gold, MAT.gold);
  const orb = sph(0.09 + t * 0.012, 12, 10); orb.translate(stp.x, stp.y + 0.12, stp.z); K.glow(orb, P.glw, 3.2);
  for (const s of [1, -1]) { const wg = ext(shape([[0, 0], [0.12, 0.05], [0.18, 0.14], [0.08, 0.11], [0.02, 0.06]]), 0.01, 0.005, 1); if (s < 0) R(wg, 0, PI, 0); wg.rotateY(PI / 2 - 0.3); wg.translate(stp.x, stp.y - 0.04, stp.z); K.add(wg, P.gold, MAT.gold); }
  if (t >= 3) runeRing(K, [0, 0.35, 0], 0.55, 14, P.glw, 2.6);
  return [1, 0.55];
}

// ---- Druide ---------------------------------------------------------------------------------------
function druid(K) {
  const P = K.P, t = K.tier;
  robe(K, [[0, 1.5], [0.16, 1.48], [0.24, 1.38], [0.22, 1.15], [0.27, 0.8], [0.36, 0.3], [0.4, 0.06], [0, 0.04]], P.pri, { seg: 14, fold: 0.1, folds: 7, tatter: 0.1, tears: 6 });
  // Gürtel mit Ranken
  const vine = tor(0.24, 0.025, 4, 16); vine.rotateX(PI / 2); vine.scale(1, 1, 0.85); vine.translate(0, 1.05, 0); K.add(vine, P.wood, MAT.wood);
  // Blätter-Mantel um die Schultern
  const ln = 14 + (t - 1) * 4;
  for (let i = 0; i < ln; i++) {
    const a = (i / ln) * TAU, ring = i % 2;
    const lf = ext(leafShape(0.3 - ring * 0.05, 0.16), 0.014, 0);
    bend(lf, -2.5);
    R(lf, PI - 0.75 - ring * 0.25, 0, 0);
    lf.translate(0, 0.0, 0.17 + ring * 0.03);
    lf.rotateY(a + ring * 0.2);
    lf.scale(1.15, 1, 0.9);
    lf.translate(0, 1.58 - ring * 0.08, 0);
    K.add(lf, i % 3 === 0 ? mix(P.leaf, P.sec, 0.5) : (ring ? P.moss : P.leaf), MAT.leaf);
  }
  // Kopf: Kapuze + Knochenmaske + Geweih
  K.add(seg([0, 1.5, 0], [0, 1.6, 0.01], 0.06, 0.06), P.skin, MAT.skin);
  hood(K, [0, 1.7, -0.01], 0.16, shade(P.pri, 0.85), { tip: 0.3, eyes: false });
  const mask = ext(shape([[0, 0.12], [0.08, 0.09], [0.1, 0.0], [0.05, -0.1], [0, -0.14], [-0.05, -0.1], [-0.1, 0.0], [-0.08, 0.09]]), 0.02, 0.01, 1);
  bend(mask, 4); mask.translate(0, 1.69, 0.12); K.add(mask, P.bone, MAT.bone);
  eyes(K, [0, 1.71, 0.15], 0.042, 0.018, P.glw, 3.6, 0.55);
  for (const s of [1]) {
    const b0 = V(0.08 * s, 1.83, -0.02);
    const main = [b0, V(0.16 * s, 1.95, -0.02), V(0.2 * s, 2.12, -0.05), V(0.18 * s, 2.3, -0.02)];
    K.sym(sweep(main, (u) => 0.03 * (1 - u * 0.8), 6, 10), P.bone, MAT.bone);
    K.sym(sweep([V(0.165 * s, 1.97, -0.02), V(0.26 * s, 2.03, 0.02), V(0.32 * s, 2.12, 0.02)], (u) => 0.02 * (1 - u * 0.8), 5, 6), P.bone, MAT.bone);
    K.sym(sweep([V(0.2 * s, 2.13, -0.05), V(0.29 * s, 2.2, -0.08), V(0.32 * s, 2.3, -0.06)], (u) => 0.017 * (1 - u * 0.8), 5, 6), P.bone, MAT.bone);
    K.sym(sweep([V(0.19 * s, 2.06, -0.04), V(0.12 * s, 2.16, -0.1), V(0.1 * s, 2.24, -0.14)], (u) => 0.016 * (1 - u * 0.8), 5, 6), P.bone, MAT.bone);
    if (t >= 2) { const fl = sph(0.03, 6, 5); fl.translate(0.32 * s, 2.13, 0.02); K.symGlow(fl, P.glw, 2.6); }
  }
  // Ärmel
  const shR = V(-0.25, 1.4, 0), haR = V(-0.36, 1.15, 0.24), shL = V(0.25, 1.4, 0), haL = V(0.36, 1.2, 0.2);
  sleeve(K, shR, haR, 0.075, 0.13, P.pri, shade(P.pri, 0.4)); sleeve(K, shL, haL, 0.075, 0.13, P.pri, shade(P.pri, 0.4));
  handS(K, haR, P.skin); handS(K, haL, P.skin);
  // Knorriger Stab mit Krallenkopf
  const sb = V(-0.42, 0.02, 0.3), stp = V(-0.38, 1.85, 0.24);
  staff(K, sb, stp, P.wood, 0.034, { wobble: 0.03 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const p0 = stp.clone(), p1 = stp.clone().add(V(Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1)), p2 = stp.clone().add(V(Math.cos(a) * 0.04, 0.3, Math.sin(a) * 0.04));
    K.add(sweep([p0, p1, p2], (u) => 0.024 * (1 - u * 0.85), 4, 6), P.wood, MAT.wood);
  }
  const gem = crystal(0.06, 0.2, 6); gem.translate(stp.x, stp.y + 0.1, stp.z); K.glow(gem, P.glw, 3 + t * 0.3);
  for (let i = 0; i < 3; i++) { const lf = ext(leafShape(0.12, 0.07), 0.01, 0); R(lf, 0.4, i * 2.1, 0.6); lf.translate(stp.x, stp.y - 0.08 - i * 0.04, stp.z); K.add(lf, P.leaf, MAT.leaf); }
  if (t >= 3) runeRing(K, [0, 0.2, 0], 0.55, 12, P.glw, 2.6);
  return [1, 0.58];
}

// ---- Hexe -----------------------------------------------------------------------------------------
function witch(K) {
  const P = K.P, t = K.tier, lean = 0.28;
  robe(K, [[0, 1.3], [0.17, 1.28], [0.23, 1.15], [0.24, 0.85], [0.33, 0.35], [0.38, 0.06], [0, 0.04]], P.pri, { seg: 14, fold: 0.12, folds: 7, tatter: 0.14, tears: 7, lean: lean * 0.4 });
  // Gebeugter Oberkörper (Buckel)
  const hump = ell(0.24, 0.24, 0.22, 12, 8); hump.translate(0, 1.3, -0.04); Rp(hump, [0, 0.95, 0], lean, 0, 0); K.add(hump, P.pri, MAT.cloth);
  const shawl = lathe([[0.1, 1.5], [0.24, 1.42], [0.3, 1.26], [0.27, 1.24], [0.2, 1.36], [0.08, 1.44]], 12); shawl.scale(1, 1, 0.9); shawl.translate(0, 0.02, 0); Rp(shawl, [0, 0.95, 0], lean, 0, 0); K.add(shawl, P.sec, MAT.cloth);
  belt(K, 0.98, 0.25, 0.21, P.dleather, P.gold);
  // Kopf
  const hc = V(0, 1.53, 0.26);
  const head = ell(0.12, 0.13, 0.12, 10, 8); T(head, hc); K.add(head, P.skin, MAT.skin);
  const nose = sweep([hc.clone().add(V(0, 0.0, 0.1)), hc.clone().add(V(0, -0.02, 0.18)), hc.clone().add(V(0, -0.07, 0.24))], (u) => 0.035 * (1 - u * 0.85), 5, 6); K.add(nose, P.skin, MAT.skin);
  eyes(K, [0, hc.y + 0.03, hc.z + 0.1], 0.05, 0.018, P.glw, 3.6, 0.6);
  // Haare
  for (let i = 0; i < 7; i++) { const a = PI * 0.25 + (i / 6) * PI * 1.5; const s0 = hc.clone().add(V(Math.sin(a) * 0.12, 0.05, Math.cos(a) * -0.1 - 0.02)); K.add(sweep([s0, s0.clone().add(V(Math.sin(a) * 0.06, -0.18, -0.06)), s0.clone().add(V(Math.sin(a) * 0.1, -0.36, -0.04))], (u) => 0.028 * (1 - u * 0.7), 5, 6), P.white, MAT.cloth); }
  // Spitzhut
  const brim = lathe([[0, 0], [0.3, -0.01], [0.32, 0.0], [0.3, 0.015], [0.12, 0.03], [0, 0.03]], 16); brim.translate(hc.x, hc.y + 0.08, hc.z - 0.02); R(brim, 0.0, 0, 0); K.add(brim, P.sec, MAT.cloth);
  const hatPts = [hc.clone().add(V(0, 0.08, -0.02)), hc.clone().add(V(0, 0.3, -0.05)), hc.clone().add(V(0, 0.48, -0.12)), hc.clone().add(V(0.02, 0.58, -0.3))];
  K.add(sweep(hatPts, (u) => 0.13 * Math.pow(1 - u, 1.2) + 0.008, 10, 14), P.sec, MAT.cloth);
  const band = tor(0.125, 0.02, 4, 14); band.rotateX(PI / 2); T(band, hc.clone().add(V(0, 0.11, -0.02))); K.add(band, P.pri, MAT.cloth);
  const buck = box(0.06, 0.05, 0.02); T(buck, hc.clone().add(V(0, 0.11, 0.105))); K.add(buck, P.gold, MAT.gold);
  // Arme
  const shR = V(-0.25, 1.35, 0.1), haR = V(-0.36, 1.12, 0.36), shL = V(0.25, 1.35, 0.1), haL = V(0.3, 1.05, 0.32);
  sleeve(K, shR, haR, 0.07, 0.12, P.pri, shade(P.pri, 0.4)); sleeve(K, shL, haL, 0.07, 0.12, P.pri, shade(P.pri, 0.4));
  handS(K, haR, P.skin); handS(K, haL, P.skin);
  // Laternenstab (krumm)
  const sb = V(-0.4, 0.02, 0.38), smid = V(-0.36, 1.2, 0.38), stop = V(-0.34, 1.82, 0.36), hook = V(-0.2, 1.98, 0.42), hook2 = V(-0.08, 1.86, 0.46);
  K.add(sweep([sb, smid, stop, hook, hook2], (u) => 0.032 * (1 - u * 0.4), 6, 22), P.wood, MAT.wood);
  // Laterne
  const lp = V(-0.08, 1.62, 0.46);
  K.add(seg(hook2, lp.clone().add(V(0, 0.14, 0)), 0.006, 0.006, 4, 1), P.iron, MAT.dmetal);
  const cap = lathe([[0, 0.14], [0.04, 0.12], [0.085, 0.07], [0.08, 0.06], [0, 0.07]], 8); T(cap, lp); K.add(cap, P.iron, MAT.dmetal);
  const base = lathe([[0, -0.1], [0.07, -0.1], [0.08, -0.07], [0, -0.06]], 8); T(base, lp); K.add(base, P.iron, MAT.dmetal);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(seg(lp.clone().add(V(Math.cos(a) * 0.065, -0.07, Math.sin(a) * 0.065)), lp.clone().add(V(Math.cos(a) * 0.065, 0.07, Math.sin(a) * 0.065)), 0.008, 0.008, 4, 1), P.iron, MAT.dmetal); }
  const flame = ell(0.05, 0.075, 0.05, 10, 8); T(flame, lp); K.glow(flame, P.glw, 3.6);
  if (t >= 2) { for (let i = 0; i < 3 + t; i++) { const a = i * 2.3; const w = sph(0.025, 6, 5); w.translate(Math.cos(a) * 0.5, 0.6 + i * 0.25, Math.sin(a) * 0.4); K.glow(w, P.glw, 2.6); } }
  if (t >= 3) { const cauld = lathe([[0, 0.0], [0.12, 0.02], [0.16, 0.12], [0.14, 0.22], [0.12, 0.22], [0.13, 0.12], [0, 0.04]], 10); cauld.translate(0.38, 0, 0.22); K.add(cauld, P.iron, MAT.dmetal); const brew = cyl(0.12, 0.12, 0.02, 10); brew.translate(0.38, 0.2, 0.22); K.glow(brew, P.glw, 2.8); }
  return [1, 0.58];
}

// ---- Leermagier -----------------------------------------------------------------------------------
function voidmage(K) {
  const P = K.P, t = K.tier;
  robe(K, [[0, 1.62], [0.16, 1.6], [0.23, 1.5], [0.2, 1.25], [0.21, 1.0], [0.3, 0.45], [0.36, 0.05], [0, 0.03]], P.pri, { seg: 14, fold: 0.07, folds: 8, tatter: 0.1, tears: 5, hem: P.gold });
  // Vorderbahn
  const panel = ext(shape([[-0.09, 0], [0.09, 0], [0.12, -0.9], [0, -1.0], [-0.12, -0.9]]), 0.014, 0.006, 1); bend(panel, 1.2); R(panel, -0.12, 0, 0); panel.translate(0, 1.1, 0.2); K.add(panel, P.sec, MAT.cloth);
  const rn = ext(starShape(0.05, 0.015, 4, PI / 4), 0.01, 0.004, 1); rn.translate(0, 0.65, 0.27); K.glow(rn, P.glw, 3);
  belt(K, 1.08, 0.22, 0.18, P.dark, P.gold);
  // Schultern mit Stacheln + Stachelkragen
  pauldron(K, [0.28, 1.56, 0], 0.13, P.dark, P.gold, { layers: 2, spikes: 2, spikeCol: P.met, mat: MAT.dmetal });
  const nc = 9 + (t - 1) * 2;
  for (let i = 0; i < nc; i++) {
    const a = PI * 0.15 + (i / (nc - 1)) * PI * 1.7, h = 0.22 + 0.16 * Math.pow(Math.abs(Math.cos(a / 2)), 0.5);
    const sp = cone(0.035, h, 5); sp.translate(0, h / 2, 0); R(sp, -0.35, 0, 0); sp.rotateY(a + PI); sp.translate(Math.sin(a) * -0.15, 1.6, Math.cos(a) * -0.13);
    K.add(sp, P.met, MAT.dmetal);
  }
  const collar = tor(0.15, 0.03, 4, 16); collar.rotateX(PI / 2); collar.translate(0, 1.61, 0); K.add(collar, P.gold, MAT.gold);
  // Kopf
  K.add(seg([0, 1.6, 0], [0, 1.68, 0.01], 0.055, 0.055), P.dark, MAT.cloth);
  hood(K, [0, 1.78, 0.0], 0.15, P.pri, { tip: 1.1, inCol: P.void, eyeCol: P.glw, eyeK: 4 });
  // Arme: rechts erhoben mit Leere-Kugel, links zur Seite
  const shR = V(-0.26, 1.5, 0), haR = V(-0.4, 1.86, 0.18), shL = V(0.26, 1.5, 0), haL = V(0.44, 1.12, 0.16);
  sleeve(K, shR, haR, 0.07, 0.12, P.pri, P.void); sleeve(K, shL, haL, 0.07, 0.12, P.pri, P.void);
  handS(K, haR, shade(P.skin, 0.6)); handS(K, haL, shade(P.skin, 0.6));
  for (let i = 0; i < 3; i++) { const c = cone(0.012, 0.09, 4); c.rotateX(PI / 2 + 0.6); c.translate(haL.x + (i - 1) * 0.025, haL.y - 0.06, haL.z + 0.04); K.add(c, P.dark, MAT.dmetal); }
  const oc = V(-0.42, 2.18, 0.2), orr = 0.13 + t * 0.015;
  const orb = sph(orr, 14, 10); T(orb, oc); K.add(orb, P.void, [0.12, 0.6]);
  const ring = tor(orr * 1.55, 0.016, 4, 28); ring.rotateX(PI / 2 - 0.4); ring.rotateZ(0.3); T(ring, oc); K.glow(ring, P.glw, 3.6);
  const ring2 = tor(orr * 1.2, 0.01, 4, 24); ring2.rotateY(0.8); T(ring2, oc); K.glow(ring2, P.glw, 2.6);
  const halo = sph(orr * 1.08, 14, 10); T(halo, oc); halo.scale(1, 1, 1); // Glimmer-Hülle als dünnes Rand-Leuchten
  for (let i = 0; i < 5; i++) { const s = sph(0.02, 6, 4); const a = i * 1.26; s.translate(oc.x + Math.cos(a) * orr * 1.9, oc.y + Math.sin(a * 2) * 0.08, oc.z + Math.sin(a) * orr * 1.9); K.glow(s, P.glw, 3); }
  runeRing(K, [0, 0.9, 0], 0.48, 10 + t * 2, P.glw, 2.4, [PI / 2 + 0.15, 0, 0]);
  return [1, 0.58];
}

// ---- Schatten (schwebender Geist) ----------------------------------------------------------------
function shade_(K) {
  const P = K.P, t = K.tier, lift = 0.35;
  robe(K, [[0, 1.55], [0.16, 1.52], [0.25, 1.4], [0.24, 1.1], [0.3, 0.7], [0.36, 0.3], [0.33, 0.25], [0, 0.4]].map((p) => [p[0], p[1] + lift - 0.25]), P.pri,
    { seg: 16, fold: 0.16, folds: 7, tatter: 0.32, tears: 9, down: true });
  // Innerer Schleier
  robe(K, [[0, 1.0], [0.2, 0.95], [0.24, 0.6], [0.26, 0.28], [0, 0.35]].map((p) => [p[0], p[1] + lift - 0.25]), shade(P.pri, 0.5), { seg: 12, fold: 0.2, folds: 5, tatter: 0.25, tears: 6, down: true });
  // Kapuze
  hood(K, [0, 1.66, 0.04], 0.19, P.pri, { tip: 1.0, inCol: P.void, eyeCol: P.glw, eyeK: 4.2, flare: 0.8, gap: 1.9 });
  const mantle = lathe([[0.1, 1.6], [0.28, 1.5], [0.36, 1.32], [0.33, 1.3], [0.22, 1.44], [0.08, 1.52]], 12); mantle.scale(1, 1, 0.85);
  warp(mantle, (p) => { const a = Math.atan2(p.x, p.z); if (p.y < 1.35) p.y -= 0.06 * Math.abs(Math.sin(a * 5)); });
  K.add(mantle, shade(P.pri, 0.8), MAT.cloth);
  // Arme mit langen Krallen, nach vorne greifend
  for (const s of [1, -1]) {
    const sh = V(0.27 * s, 1.42, 0.02), wr = V(0.42 * s, 1.12, 0.34);
    sleeve(K, sh, wr, 0.07, 0.13, P.pri, P.void);
    const hand = ell(0.05, 0.05, 0.06, 7, 5); T(hand, wr.clone().add(V(0, 0, 0.04))); K.add(hand, P.dark, MAT.skin);
    for (let i = 0; i < 3; i++) {
      const b = wr.clone().add(V((i - 1) * 0.035 * s, -0.01, 0.07));
      const pts = [b, b.clone().add(V((i - 1) * 0.04 * s, -0.08, 0.14)), b.clone().add(V((i - 1) * 0.06 * s, -0.25, 0.24)), b.clone().add(V((i - 1) * 0.05 * s, -0.42, 0.22))];
      K.add(sweep(pts, (u) => 0.02 * (1 - u * 0.9), 5, 10), P.bone, MAT.bone);
    }
    const wglow = sph(0.04, 6, 5); T(wglow, wr.clone().add(V(0, 0, 0.05))); K.glow(wglow, P.glw, 2.2);
  }
  // Seelen-Fetzen unten (Glow-Ranken)
  for (let i = 0; i < 5 + t; i++) {
    const a = (i / (5 + t)) * TAU + 0.3, r0 = 0.22;
    const p0 = V(Math.sin(a) * r0, 0.45, Math.cos(a) * r0 * 0.8);
    K.glow(sweep([p0, p0.clone().add(V(Math.sin(a) * 0.08, -0.12, Math.cos(a) * 0.06)), p0.clone().add(V(Math.sin(a + 0.6) * 0.14, -0.3, Math.cos(a + 0.6) * 0.1))], (u) => 0.025 * (1 - u), 4, 6), P.glw, 2.2);
  }
  const core = sph(0.06, 8, 6); core.translate(0, 1.25, 0.24); K.glow(core, P.glw, 2.4);
  if (t >= 2) runeRing(K, [0, 1.25, 0], 0.4, 8 + t * 2, P.glw, 2.6, [PI / 2 - 0.2, 0, 0]);
  if (t >= 3) { const crown = tor(0.14, 0.01, 3, 20); crown.rotateX(PI / 2 + 0.2); crown.translate(0, 1.92, 0.0); K.glow(crown, P.glw, 3); for (let i = 0; i < 7; i++) { const sp = cone(0.018, 0.12, 4); sp.translate(0, 0.06, 0); sp.rotateZ((i - 3) * 0.2); sp.translate(Math.sin((i - 3) * 0.4) * 0.14, 1.94, -Math.cos((i - 3) * 0.4) * 0.05); K.glow(sp, P.glw, 2.6); } }
  return [1, 0.6, 0.6];
}

// ---- Gefallener Ritter ----------------------------------------------------------------------------
function knightfallen(K) {
  const P = K.P, t = K.tier;
  const haR = V(-0.2, 1.2, 0.36), haL = V(0.14, 1.12, 0.38);
  plateBody(K, {
    helm: 'horned', spiky: true, spikes: 3, pr: 0.19, met: P.met, metMat: MAT.dmetal, trim: P.sec, cloth: P.pri, layers: 2, tabardBack: false,
    cape: { tatter: -0.22, col: P.pri, inCol: shade(P.pri, 0.3), rBot: 0.55, fold: 0.12 }, stance: [0.14, -0.1],
    arms: [[V(-0.33, 1.44, 0), V(-0.38, 1.16, 0.15), haR], [V(0.33, 1.44, 0), V(0.32, 1.12, 0.2), haL]], chestShape: starShape(0.07, 0.02, 3, PI),
  });
  // Zweihänder, schräg vor dem Körper (beide Hände am Griff), gezackte Klinge
  const gp = haR.clone().lerp(haL, 0.5), dir = V(-0.55, 0.75, 0.38);
  const len = 1.15 + (t - 1) * 0.08;
  const jag = shape([[-0.035, 0], [-0.07, 0.1], [-0.06, 0.35], [-0.09, 0.42], [-0.06, 0.5], [-0.06, 0.75], [-0.09, 0.82], [-0.05, 0.9], [0, len], [0.05, 0.88], [0.065, 0.6], [0.09, 0.55], [0.065, 0.48], [0.07, 0.1], [0.035, 0]]);
  const bl = ext(jag, 0.02, 0.012, 1); bl.translate(0, 0.08, 0); K.add(aim(bl, gp, dir, 0.2), shade(P.met, 0.8), MAT.dmetal);
  const gd = rbox(0.34, 0.05, 0.07, 0.02, 1); gd.translate(0, 0.06, 0); K.add(aim(gd, gp, dir, 0.2), P.met, MAT.dmetal);
  for (const s of [1, -1]) { const sp = cone(0.025, 0.12, 5); sp.rotateZ(-s * 1.2); sp.translate(s * 0.2, 0.1, 0); K.add(aim(sp, gp, dir, 0.2), P.met, MAT.dmetal); }
  const gr = cyl(0.028, 0.03, 0.28, 7); gr.translate(0, -0.1, 0); K.add(aim(gr, gp, dir, 0.2), P.dleather, MAT.leather);
  const pm = ell(0.045, 0.06, 0.045, 7, 5); pm.translate(0, -0.26, 0); K.add(aim(pm, gp, dir, 0.2), P.sec, MAT.gold);
  const rl = rbox(0.022, len * 0.65, 0.04, 0.006, 1); rl.translate(0, 0.15 + len * 0.33, 0); K.glow(aim(rl, gp, dir, 0.2), P.glw, 2 + t * 0.6);
  // Glühende Risse in der Brust
  K.glow(box(0.015, 0.16, 0.02).rotateZ(0.4).translate(-0.06, 1.24, 0.235), P.glw, 2.6);
  K.glow(box(0.015, 0.12, 0.02).rotateZ(-0.6).translate(0.07, 1.18, 0.23), P.glw, 2.6);
  if (t >= 2) { for (let i = 0; i < 3; i++) { const sp = cone(0.03, 0.22 - i * 0.04, 5); sp.rotateX(-0.6); sp.translate((i - 1) * 0.1, 1.45, -0.24); K.add(sp, P.met, MAT.dmetal); } }
  if (t >= 3) { const c = tor(0.2, 0.012, 3, 16); c.rotateX(PI / 2 + 0.2); c.translate(0, 2.08, 0.02); K.glow(c, P.glw, 3); }
  return [1.08, 0.62];
}

// ---- König (kolossaler Wächter) -----------------------------------------------------------------
function king(K) {
  const P = K.P, t = K.tier, w = 1.2;
  const haR = V(-0.12, 1.22, 0.36), haL = V(0.12, 1.22, 0.36);
  plateBody(K, {
    w, helm: 'royal', pr: 0.25, layers: 3, spikes: 0, trim: P.gold, met: P.met, cloth: P.pri, tabardBack: true, chestGem: true,
    cape: { col: P.pri, inCol: shade(P.sec, 0.5), rTop: 0.3, rBot: 0.8, bot: 0.04, arc: 2.9, fold: 0.1, folds: 9, seg: 20, hseg: 8 }, stance: [0.06, -0.04],
    arms: [[V(-0.4, 1.44, 0), V(-0.42, 1.2, 0.2), haR], [V(0.4, 1.44, 0), V(0.42, 1.2, 0.2), haL]], chestShape: starShape(0.08, 0.03, 8),
  });
  // Pelzkragen
  const fur = lathe([[0.14, 1.64], [0.3, 1.6], [0.44, 1.5], [0.42, 1.44], [0.3, 1.5], [0.12, 1.56]], 18); fur.scale(1, 1, 0.82);
  warp(fur, (p) => { const k = 1 + 0.06 * Math.sin(Math.atan2(p.x, p.z) * 14); p.x *= k; p.z *= k; });
  K.add(fur, P.white, MAT.fur);
  // Schulter-Löwenköpfe (Medaillons) + Edelsteine
  for (const s of [1]) {
    const m = ext(starShape(0.08, 0.05, 8), 0.02, 0.01, 1); m.rotateY(PI / 2); m.rotateZ(-0.5); m.translate(0.62 * s, 1.56, 0); K.sym(m, P.gold, MAT.gold);
    const gm = sph(0.035, 8, 6); gm.translate(0.64, 1.55, 0); K.symGlow(gm, P.glw, 3.2);
  }
  // Krone über dem Helm
  const cb = lathe([[0.15, 1.86], [0.175, 1.86], [0.18, 1.94], [0.16, 1.94]], 18); cb.scale(1, 1, 1.08); K.add(cb, P.gold, MAT.gold);
  const np = 8;
  for (let i = 0; i < np; i++) {
    const a = (i / np) * TAU, big = i % 2 === 0;
    const pt = ext(shape([[-0.04, 0], [0.04, 0], [0.012, big ? 0.17 : 0.1], [0, big ? 0.2 : 0.12], [-0.012, big ? 0.17 : 0.1]]), 0.015, 0.006, 1);
    pt.translate(0, 0, 0.17); pt.rotateY(a); pt.scale(1, 1, 1.08); pt.translate(0, 1.92, 0); K.add(pt, P.gold, MAT.gold);
    const gem = sph(big ? 0.022 : 0.016, 6, 5); gem.translate(0, big ? 0.2 : 0.12, 0.17); gem.rotateY(a); gem.scale(1, 1, 1.08); gem.translate(0, 1.92, 0); K.glow(gem, P.glw, 3.6);
    if (big) { const fg = sph(0.024, 6, 5); fg.scale(1, 1, 0.6); fg.translate(0, 0.04, 0.185); fg.rotateY(a); fg.scale(1, 1, 1.08); fg.translate(0, 1.88, 0); K.glow(fg, i === 0 ? P.glw : P.sec, 2.8); }
  }
  // Großschwert vor sich in den Boden gerammt
  const gp = V(0, 1.18, 0.4), dir = V(0, -1, 0.04);
  const blade = ext(bladeShape(1.12, 0.17, 0.12, 0.6), 0.04, 0.02, 2); blade.translate(0, 0.1, 0); K.add(aim(blade, gp, dir, 0), P.steel, MAT.metal);
  const fuller = rbox(0.035, 0.85, 0.06, 0.01, 1); fuller.translate(0, 0.55, 0); K.glow(aim(fuller, gp, dir, 0), P.glw, 2.4 + t * 0.4);
  const guard = ext(shape([[-0.32, 0.0], [-0.26, 0.05], [-0.1, 0.06], [0, 0.1], [0.1, 0.06], [0.26, 0.05], [0.32, 0.0], [0.26, -0.03], [0, -0.04], [-0.26, -0.03]], true), 0.06, 0.02, 2, 4);
  guard.rotateX(PI); guard.translate(0, 0.1, 0); K.add(aim(guard, gp, dir, 0), P.gold, MAT.gold);
  const gg = sph(0.04, 8, 6); gg.translate(0, 0.06, 0.04); K.glow(aim(gg, gp, dir, 0), P.glw, 3.4);
  const grip = cyl(0.035, 0.035, 0.3, 8); grip.translate(0, -0.08, 0); K.add(aim(grip, gp, dir, 0), P.dleather, MAT.leather);
  const pom = sph(0.06, 10, 8); pom.translate(0, -0.25, 0); K.add(aim(pom, gp, dir, 0), P.gold, MAT.gold);
  // Sockel-Risse am Boden (Schwertspitze)
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; const cr = box(0.02, 0.01, 0.18 + (i % 2) * 0.1); cr.translate(0, 0, 0.12); cr.rotateY(a); cr.translate(0, 0.005, 0.45); K.glow(cr, P.glw, 2.2); }
  if (t >= 2) runeRing(K, [0, 0.03, 0], 0.75, 16, P.glw, 2.4);
  if (t >= 3) { const halo = tor(0.32, 0.016, 4, 36); halo.rotateX(PI / 2 - 0.25); halo.translate(0, 2.2, -0.12); K.glow(halo, P.glw, 2.8); }
  return [3.0, 0.75];
}

// ---- Tier-Bausteine ------------------------------------------------------------------------------

// Punkte gleichmäßig auf einer Kugel (Fibonacci)
function fib(n, i) {
  const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return V(Math.cos(a) * r, y, Math.sin(a) * r);
}
// Felsplatten über einem Ellipsoid (mit Fugen, durch die der Glow-Kern scheint)
function rockShell(K, c, rx, ry, rz, n, col, o = {}) {
  const C0 = v3(c);
  for (let i = 0; i < n; i++) {
    const d = fib(n, i);
    if (o.skipBelow !== undefined && d.y < o.skipBelow) continue;
    const p = V(d.x * rx, d.y * ry, d.z * rz);
    const nrm = V(d.x / rx, d.y / ry, d.z / rz).normalize();
    const size = (o.size || 0.55) * Math.cbrt(rx * ry * rz) * Math.sqrt(4 / n) * 1.7 * (0.85 + 0.3 * K.rng());
    const g = rock(size, i * 3.7 + (o.seed || 0), 0, 0.25);
    g.scale(1, 0.55, 1);
    g.applyQuaternion(qY(nrm));
    g.translate(C0.x + p.x * 0.96, C0.y + p.y * 0.96, C0.z + p.z * 0.96);
    K.add(g, shade(col, 0.82 + 0.3 * K.rng()), o.mat || MAT.rock);
  }
}

// Kopf eines Raubtiers (Wolf/Hund): Schädel, Schnauze, Kiefer, Ohren
function canineHead(K, c, s, col, o = {}) {
  const P = K.P, C0 = v3(c);
  const sk = blob(0.14 * s, 3, 0.06, 10, 8); sk.scale(1, 0.92, 1.1); T(sk, C0); K.add(sk, col, o.mat || MAT.fur);
  K.add(seg(C0.clone().add(V(0, -0.02 * s, 0.06 * s)), C0.clone().add(V(0, -0.05 * s, 0.27 * s)), 0.09 * s, 0.055 * s, 8, 2), col, o.mat || MAT.fur);
  const nose = ell(0.035 * s, 0.03 * s, 0.03 * s, 7, 5); T(nose, C0.clone().add(V(0, -0.025 * s, 0.33 * s))); K.add(nose, P.dark, MAT.leather);
  K.add(seg(C0.clone().add(V(0, -0.08 * s, 0.04 * s)), C0.clone().add(V(0, -0.15 * s, 0.24 * s)), 0.06 * s, 0.035 * s, 7, 2), shade(col, 0.8), o.mat || MAT.fur);
  for (const s2 of [1, -1]) for (let i = 0; i < 2; i++) {
    const f = cone(0.012 * s, 0.05 * s, 4); f.rotateX(PI); f.translate(s2 * 0.035 * s, -0.08 * s, (0.22 - i * 0.06) * s); T(f, C0); K.add(f, P.bone, MAT.bone);
  }
  const ear = cone(0.05 * s, 0.14 * s, 4); ear.scale(1, 1, 0.5); R(ear, -0.35, 0, -0.35); ear.translate(0.075 * s, 0.13 * s, -0.04 * s); T(ear, C0); K.sym(ear, o.earCol || col, o.mat || MAT.fur);
  eyes(K, [0, C0.y + 0.03 * s, C0.z + 0.11 * s], 0.065 * s, 0.018 * s, o.eye || P.glw, 3.4, 0.5);
  if (o.mouthGlow) { const mg = box(0.06 * s, 0.03 * s, 0.16 * s); mg.translate(0, -0.06 * s, 0.17 * s); T(mg, C0); K.glow(mg, o.mouthGlow, 2.6); }
}

// Fell-Büschel (Kegel), die nach hinten zeigen
function tufts(K, pts, col, len = 0.18, r = 0.06, dir = V(0, 0.4, -1)) {
  for (const p of pts) {
    const g = cone(r, len, 5); g.translate(0, len / 2, 0); aim(g, p, dir.clone().add(V((K.rng() - 0.5) * 0.4, (K.rng() - 0.5) * 0.3, 0)));
    K.add(g, shade(col, 0.9 + K.rng() * 0.2), MAT.fur);
  }
}

// ---- Wolf -----------------------------------------------------------------------------------------
function wolf(K) {
  const P = K.P, t = K.tier, fur = mix('#5d646e', P.sec, 0.15), belly = mix(fur, P.white, 0.45);
  const ch = blob(0.3, 1, 0.07); ch.scale(0.85, 1, 1.1); ch.translate(0, 0.76, 0.22); K.add(ch, fur, MAT.fur);
  const bl = blob(0.24, 2, 0.06); bl.scale(0.9, 0.95, 1.4); bl.translate(0, 0.72, -0.14); K.add(bl, fur, MAT.fur);
  const hp = blob(0.23, 3, 0.07); hp.scale(0.95, 1, 1.05); hp.translate(0, 0.74, -0.46); K.add(hp, fur, MAT.fur);
  const bel = ell(0.18, 0.12, 0.38, 10, 6); bel.translate(0, 0.58, 0.02); K.add(bel, belly, MAT.fur);
  // Hals + Kopf
  K.add(seg([0, 0.82, 0.36], [0, 1.0, 0.6], 0.2, 0.14, 8, 2), fur, MAT.fur);
  canineHead(K, [0, 1.05, 0.66], 1.15, fur, { earCol: shade(fur, 0.8) });
  // Mähne
  const mane = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; mane.push(V(Math.cos(a) * 0.2, 0.92 + Math.sin(a) * 0.18, 0.45 - Math.abs(Math.sin(a)) * 0.05)); }
  tufts(K, mane, shade(fur, 1.1), 0.24, 0.07, V(0, 0.2, -1));
  const back = []; for (let i = 0; i < 6; i++) back.push(V(0, 1.0 - i * 0.03, 0.24 - i * 0.15));
  tufts(K, back, shade(fur, 0.75), 0.2, 0.06, V(0, 0.6, -1));
  // Beine (vorne / hinten), leichter Schritt
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.08 : -0.04;
    beastLeg(K, [0.15 * s, 0.72, 0.28], [0.17 * s, 0.42, 0.34 + f], [0.15 * s, 0.2, 0.3 + f], [0.15 * s, 0.05, 0.36 + f], 0.085, fur, MAT.fur, { claws: true, pawCol: shade(fur, 0.7) });
    const h = s > 0 ? -0.05 : 0.04;
    K.add(seg([0.15 * s, 0.76, -0.46], [0.18 * s, 0.48, -0.32 + h], 0.13, 0.09, 8, 2), fur, MAT.fur);
    beastLeg(K, [0.18 * s, 0.48, -0.32 + h], [0.17 * s, 0.26, -0.58 + h], [0.16 * s, 0.12, -0.54 + h], [0.16 * s, 0.05, -0.5 + h], 0.075, fur, MAT.fur, { claws: true, pawCol: shade(fur, 0.7) });
  }
  // Schwanz
  K.add(sweep([[0, 0.82, -0.62], [0, 0.9, -0.8], [0, 0.82, -1.0], [0, 0.66, -1.12]], (u) => 0.06 + 0.07 * Math.sin(u * PI * 0.9), 7, 12), shade(fur, 0.9), MAT.fur);
  // Rüstung: Schulterplatte + Stachel-Halsband + Satteldecke
  const sp = dome(0.24, 0.12, 10, 0.08); sp.scale(1.15, 1, 1.1); R(sp, 0.2, 0, 0); sp.translate(0, 0.98, 0.2); K.add(sp, P.met, MAT.metal);
  const trim = tor(0.27, 0.015, 3, 14); trim.rotateX(PI / 2); trim.scale(1.15, 1, 1.1); R(trim, 0.2, 0, 0); trim.translate(0, 0.985, 0.2); K.add(trim, P.gold, MAT.gold);
  const col = tor(0.17, 0.03, 4, 14); col.rotateX(PI / 2 - 0.7); col.translate(0, 0.94, 0.48); K.add(col, P.dleather, MAT.leather);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const c = cone(0.02, 0.08, 4); c.translate(0, 0.19, 0); c.rotateZ(a); c.rotateX(PI / 2 - 0.7); c.translate(0, 0.94, 0.48); K.add(c, P.met, MAT.metal); }
  const cloth = ext(shape([[-0.26, 0.2], [0.26, 0.2], [0.24, -0.2], [0, -0.26], [-0.24, -0.2]]), 0.014, 0.006, 1);
  cloth.rotateX(-PI / 2); bend(cloth, 0); warp(cloth, (p) => { p.y -= 1.6 * p.x * p.x; }); cloth.translate(0, 1.0, -0.2); K.add(cloth, P.pri, MAT.cloth);
  if (t >= 2) {
    const rn = ext(starShape(0.05, 0.02, 4), 0.01, 0.004, 1); rn.rotateX(-PI / 2); rn.translate(0, 1.02, -0.2); K.glow(rn, P.glw, 3);
    const hm = dome(0.12, 0.06, 8, 0.1); hm.scale(1, 1, 1.6); R(hm, 0.25, 0, 0); hm.translate(0, 1.17, 0.74); K.add(hm, P.met, MAT.metal);
    const hs = cone(0.025, 0.12, 5); R(hs, -0.5, 0, 0); hs.translate(0, 1.24, 0.68); K.add(hs, P.gold, MAT.gold);
  }
  if (t >= 3) { for (const s of [1, -1]) { const b = cone(0.03, 0.18, 5); R(b, -0.6, 0, -s * 0.4); b.translate(0.12 * s, 1.08, 0.12); K.add(b, P.met, MAT.metal); } runeRing(K, [0, 0.05, -0.1], 0.6, 12, P.glw, 2.4); }
  return [1.12, 0.7];
}

// ---- Bär ------------------------------------------------------------------------------------------
function bear(K) {
  const P = K.P, t = K.tier, fur = mix('#6b4a32', P.sec, 0.2);
  const ch = blob(0.46, 4, 0.06); ch.scale(1, 0.95, 1); ch.translate(0, 1.05, 0.2); K.add(ch, fur, MAT.fur);
  const hump = blob(0.36, 5, 0.08); hump.translate(0, 1.28, 0.02); K.add(hump, fur, MAT.fur);
  const hp = blob(0.4, 6, 0.06); hp.scale(1, 0.95, 1.05); hp.translate(0, 0.98, -0.42); K.add(hp, fur, MAT.fur);
  // Kopf
  const hc = V(0, 1.18, 0.72);
  const hd = blob(0.24, 7, 0.05); hd.scale(1, 0.9, 1); T(hd, hc); K.add(hd, fur, MAT.fur);
  K.add(seg(hc.clone().add(V(0, -0.05, 0.1)), hc.clone().add(V(0, -0.08, 0.3)), 0.13, 0.1, 8, 2), mix(fur, P.leather, 0.4), MAT.fur);
  const nose = ell(0.06, 0.045, 0.04, 7, 5); T(nose, hc.clone().add(V(0, -0.06, 0.4))); K.add(nose, P.dark, MAT.leather);
  for (const s of [1]) { const e = sph(0.07, 8, 6); e.scale(1, 1, 0.6); e.translate(0.15 * s, 0.2, -0.04); T(e, hc); K.sym(e, shade(fur, 0.8), MAT.fur); }
  eyes(K, [0, hc.y + 0.05, hc.z + 0.2], 0.09, 0.02, P.glw, 3.4, 0.5);
  for (const s of [1, -1]) { const f = cone(0.018, 0.07, 4); f.rotateX(PI); f.translate(0.05 * s, hc.y - 0.15, hc.z + 0.33); K.add(f, P.bone, MAT.bone); }
  // Kopfpanzer
  const hm = dome(0.2, 0.1, 10, 0.08); hm.scale(1, 1, 1.3); R(hm, 0.35, 0, 0); hm.translate(hc.x, hc.y + 0.12, hc.z + 0.02); K.add(hm, P.met, MAT.metal);
  const hsp = cone(0.04, 0.16, 5); R(hsp, -0.4, 0, 0); hsp.translate(hc.x, hc.y + 0.28, hc.z - 0.02); K.add(hsp, P.gold, MAT.gold);
  // Beine (massig)
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.1 : -0.02;
    K.add(seg([0.3 * s, 1.05, 0.32], [0.32 * s, 0.55, 0.38 + f], 0.2, 0.15, 8, 2), fur, MAT.fur);
    K.add(seg([0.32 * s, 0.55, 0.38 + f], [0.31 * s, 0.12, 0.4 + f], 0.15, 0.13, 8, 2), fur, MAT.fur);
    const paw = ell(0.16, 0.1, 0.2, 10, 6); paw.translate(0.31 * s, 0.08, 0.46 + f); K.add(paw, shade(fur, 0.8), MAT.fur);
    for (let i = -1; i <= 1; i++) { const c = cone(0.025, 0.1, 5); c.rotateX(PI / 2 + 0.5); c.translate(0.31 * s + i * 0.06, 0.05, 0.64 + f); K.add(c, P.bone, MAT.bone); }
    const h = s > 0 ? -0.06 : 0.04;
    K.add(seg([0.3 * s, 1.0, -0.5], [0.33 * s, 0.6, -0.42 + h], 0.24, 0.16, 8, 2), fur, MAT.fur);
    K.add(seg([0.33 * s, 0.6, -0.42 + h], [0.32 * s, 0.12, -0.5 + h], 0.15, 0.13, 8, 2), fur, MAT.fur);
    const pw = ell(0.15, 0.1, 0.2, 10, 6); pw.translate(0.32 * s, 0.08, -0.42 + h); K.add(pw, shade(fur, 0.8), MAT.fur);
  }
  // Rücken-Panzerplatten (gestaffelt) + Schulterpanzer mit Stacheln
  for (let i = 0; i < 4; i++) {
    const pl = dome(0.36 - i * 0.02, 0.12, 10, 0.06); pl.scale(1.15, 1, 0.65); R(pl, 0.15 - i * 0.2, 0, 0);
    pl.translate(0, 1.5 - i * 0.1 - (i === 3 ? 0.05 : 0), 0.08 - i * 0.24); K.add(pl, i % 2 ? shade(P.met, 0.85) : P.met, MAT.metal);
    const tr = tor((0.36 - i * 0.02) * 1.06, 0.014, 3, 14); tr.rotateX(PI / 2); tr.scale(1.15, 1, 0.65); R(tr, 0.15 - i * 0.2, 0, 0); tr.translate(0, 1.5 - i * 0.1 - (i === 3 ? 0.05 : 0), 0.08 - i * 0.24); K.add(tr, P.gold, MAT.gold);
  }
  pauldron(K, [0.36, 1.3, 0.3], 0.2, P.met, P.gold, { layers: 2, tilt: 1.0, spikes: t >= 2 ? 3 : 2 });
  const sad = ext(shape([[-0.3, 0.3], [0.3, 0.3], [0.32, -0.3], [-0.32, -0.3]]), 0.02, 0.008, 1);
  sad.rotateX(-PI / 2); warp(sad, (p) => { p.y -= 1.4 * p.x * p.x; }); sad.translate(0, 1.36, -0.26); K.add(sad, P.pri, MAT.cloth);
  const em = ext(starShape(0.08, 0.03, 4), 0.01, 0.004, 1); em.rotateY(PI / 2); em.translate(0.42, 1.1, -0.26); K.sym(em, P.gold, MAT.gold);
  if (t >= 2) { const rn = sph(0.04, 8, 6); rn.translate(hc.x, hc.y + 0.17, hc.z + 0.18); K.glow(rn, P.glw, 3.2); }
  if (t >= 3) { for (let i = 0; i < 3; i++) { const sp = cone(0.05, 0.28, 5); R(sp, -0.5, 0, 0); sp.translate(0, 1.6 - i * 0.12, -0.06 - i * 0.22); K.add(sp, P.met, MAT.metal); } runeRing(K, [0, 0.04, -0.05], 0.85, 14, P.glw, 2.4); }
  return [1.32, 0.95];
}

// ---- Greif ----------------------------------------------------------------------------------------
function griffin(K) {
  const P = K.P, t = K.tier, fur = mix('#a8702e', P.pri, 0.2), fea = mix('#e2d6bc', P.pri, 0.3), lift = 0.4;
  const y0 = 0.62 + lift;
  // Löwenkörper hinten, Adlerbrust vorne
  const hp = blob(0.26, 8, 0.06); hp.scale(0.95, 0.95, 1.15); hp.translate(0, y0, -0.4); K.add(hp, fur, MAT.fur);
  const bl = ell(0.24, 0.24, 0.34, 10, 6); bl.translate(0, y0 + 0.04, -0.08); K.add(bl, fur, MAT.fur);
  const ch = blob(0.28, 9, 0.05); ch.scale(0.92, 1.05, 1); ch.translate(0, y0 + 0.12, 0.22); K.add(ch, fea, MAT.cloth);
  // Brustfedern (Schuppenreihen)
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - r; i++) {
    const f = ext(featherShape(0.16, 0.08), 0.014, 0); R(f, PI + 0.3, 0, 0);
    f.translate((i - (4 - r) / 2) * 0.09, y0 + 0.32 - r * 0.1, 0.44 - r * 0.02); K.add(f, shade(fea, 1.05 - r * 0.08), MAT.cloth);
  }
  // Hals + Adlerkopf
  K.add(seg([0, y0 + 0.2, 0.3], [0, y0 + 0.5, 0.48], 0.17, 0.13, 8, 2), fea, MAT.cloth);
  const hc = V(0, y0 + 0.6, 0.52);
  const hd = ell(0.14, 0.14, 0.17, 9, 6); T(hd, hc); K.add(hd, fea, MAT.cloth);
  K.add(sweep([hc.clone().add(V(0, 0.0, 0.1)), hc.clone().add(V(0, 0.0, 0.22)), hc.clone().add(V(0, -0.06, 0.3)), hc.clone().add(V(0, -0.14, 0.31))], (u) => 0.065 * (1 - u * 0.85), 7, 10, { fx: 1.0, fy: 0.8 }), P.gold, MAT.gold);
  eyes(K, [0, hc.y + 0.04, hc.z + 0.11], 0.075, 0.02, P.glw, 3.6, 0.45);
  for (let i = 0; i < 4; i++) { const c = ext(featherShape(0.2 - i * 0.02, 0.06), 0.014, 0); R(c, -1.2 - i * 0.15, 0, 0); c.translate(0, hc.y + 0.08 - i * 0.02, hc.z - 0.08 - i * 0.03); c.rotateY((i - 1.5) * 0); K.add(c, i % 2 ? fur : P.pri, MAT.cloth); }
  // Kopfpanzer
  const hm = dome(0.13, 0.07, 8, 0.1); hm.scale(1, 1, 1.4); R(hm, 0.3, 0, 0); hm.translate(hc.x, hc.y + 0.08, hc.z + 0.02); K.add(hm, P.met, MAT.metal);
  // Vorderbeine (Adler-Krallen), angezogen
  for (const s of [1, -1]) {
    const a = V(0.15 * s, y0 + 0.02, 0.28), b = V(0.17 * s, y0 - 0.2, 0.42), c = V(0.15 * s, y0 - 0.38, 0.36);
    K.add(seg(a, b, 0.08, 0.06, 7, 2), fea, MAT.cloth); K.add(seg(b, c, 0.045, 0.04, 6, 2), P.gold, MAT.scale);
    for (let i = -1; i <= 1; i++) { const cl = cone(0.02, 0.1, 4); aim(cl, c.clone().add(V(i * 0.035, -0.02, 0.04)), V(i * 0.4, -0.7, 0.6)); K.add(cl, P.dark, MAT.bone); }
  }
  // Hinterbeine (Löwe), nach hinten hängend
  for (const s of [1, -1]) {
    K.add(seg([0.16 * s, y0, -0.45], [0.18 * s, y0 - 0.22, -0.32], 0.12, 0.08, 6, 2), fur, MAT.fur);
    K.add(seg([0.18 * s, y0 - 0.22, -0.32], [0.17 * s, y0 - 0.38, -0.56], 0.07, 0.055, 6, 2), fur, MAT.fur);
    const pw = ell(0.07, 0.05, 0.09, 8, 5); pw.translate(0.17 * s, y0 - 0.42, -0.6); K.add(pw, shade(fur, 0.8), MAT.fur);
  }
  // Schwanz mit Quaste
  K.add(sweep([[0, y0 + 0.05, -0.62], [0, y0 + 0.0, -0.85], [0, y0 + 0.15, -1.05], [0, y0 + 0.3, -1.1]], (u) => 0.04 * (1 - u * 0.4), 5, 9), fur, MAT.fur);
  const tuft = cone(0.08, 0.22, 6); R(tuft, -0.3, 0, 0); tuft.translate(0, y0 + 0.36, -1.12); K.add(tuft, shade(fur, 0.6), MAT.fur);
  // Flügel
  featherWing(K, [0.16, y0 + 0.28, 0.08], { span: 0.98 + (t - 1) * 0.06, col: fea, tip: P.sec, up: 1.2, n: 12 });
  // Sattel/Rüstung
  const sad = ext(shape([[-0.22, 0.18], [0.22, 0.18], [0.24, -0.18], [0, -0.24], [-0.24, -0.18]]), 0.015, 0.006, 1); sad.rotateX(-PI / 2); warp(sad, (p) => { p.y -= 2.2 * p.x * p.x; }); sad.translate(0, y0 + 0.27, -0.12); K.add(sad, P.met, MAT.metal);
  const st = tor(0.24, 0.012, 3, 14); st.rotateX(PI / 2); st.scale(1, 1, 0.85); st.translate(0, y0 + 0.24, -0.12); K.add(st, P.gold, MAT.gold);
  if (t >= 2) { const g = sph(0.035, 8, 6); g.translate(hc.x, hc.y + 0.15, hc.z + 0.1); K.glow(g, P.glw, 3); }
  if (t >= 3) { const h = tor(0.18, 0.012, 4, 24); h.rotateX(PI / 2 - 0.3); h.translate(hc.x, hc.y + 0.32, hc.z - 0.05); K.glow(h, P.glw, 2.6); }
  return [1.3, 0.8];
}

// ---- Baumhirte (Treant) --------------------------------------------------------------------------
function treant(K) {
  const P = K.P, t = K.tier, bark = mix(FIX.bark, P.sec, 0.35), leaf = mix(FIX.leaf, P.pri, 0.55), dbark = shade(bark, 0.62);
  // Stamm: breite Schultern, tiefe gedrehte Rindenrillen
  const trunk = lathe([[0, 0.82], [0.32, 0.84], [0.36, 1.0], [0.32, 1.25], [0.38, 1.55], [0.5, 1.85], [0.52, 2.02], [0.36, 2.16], [0.16, 2.24], [0, 2.26]], 16);
  warp(trunk, (p) => { const a = Math.atan2(p.x, p.z), k = 1 + 0.1 * Math.sin(a * 8 + p.y * 3.2) + 0.035 * Math.sin(a * 21 - p.y * 5); p.x *= k; p.z *= k * 0.8; });
  Rp(trunk, [0, 0.9, 0], 0.14, 0, 0);
  K.add(trunk, bark, MAT.bark);
  // dunkle Rindenstreifen
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + i * 0.4, pts = [];
    for (let k = 0; k <= 3; k++) { const y = 0.9 + k * 0.38, r = [0.36, 0.33, 0.4, 0.5][k] * 0.98; const aa = a + k * 0.25; pts.push(V(Math.sin(aa) * r, y, Math.cos(aa) * r * 0.8)); }
    const g = sweep(pts, (u) => 0.03 * Math.sin(PI * (0.1 + 0.8 * u)), 3, 6); Rp(g, [0, 0.9, 0], 0.14, 0, 0); K.add(g, dbark, MAT.bark);
  }
  // Gesicht
  const fz = 0.52;
  const brow = sweep([[-0.26, 1.9, fz - 0.1], [0, 1.82, fz], [0.26, 1.9, fz - 0.1]], (u) => 0.05 + 0.03 * Math.sin(u * PI), 6, 10); K.add(brow, shade(bark, 0.85), MAT.bark);
  for (const s of [1, -1]) { const e = sph(0.07, 8, 6); e.scale(1.3, 0.75, 0.5); e.translate(0.12 * s, 1.74, fz - 0.03); K.add(e, P.dark, MAT.bark); }
  eyes(K, [0, 1.74, fz], 0.12, 0.038, P.glw, 3.6, 0.6);
  const nose = sweep([[0, 1.78, fz - 0.02], [0, 1.68, fz + 0.06], [0, 1.6, fz + 0.04]], (u) => 0.05 * (1 - u * 0.5), 5, 6); K.add(nose, bark, MAT.bark);
  const mouth = ext(shape([[-0.14, 0], [-0.05, -0.035], [0, 0.0], [0.06, -0.045], [0.14, 0.0], [0.05, -0.08], [-0.06, -0.07]]), 0.03, 0); mouth.translate(0, 1.52, fz - 0.03); K.glow(mouth, P.glw, 1.8);
  const beard = [[-0.12, 1.47], [0, 1.44], [0.12, 1.47]];
  for (const [x, y] of beard) { const m = sweep([V(x, y, fz - 0.06), V(x * 1.2, y - 0.15, fz), V(x * 1.1, y - 0.32, fz - 0.04)], (u) => 0.04 * (1 - u * 0.7), 4, 5); K.add(m, P.moss, MAT.leaf); }
  const heart = crystal(0.07, 0.2, 6); heart.translate(0.16, 1.22, 0.42); K.glow(heart, P.glw, 2.6);
  // Wurzelbeine (kräftig)
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.12 : -0.08;
    const hip = V(0.22 * s, 1.0, 0), knee = V(0.36 * s, 0.56, 0.1 + f), foot = V(0.38 * s, 0.12, f);
    K.add(sweep([hip, knee, foot], (u) => 0.2 - u * 0.05, 8, 8), bark, MAT.bark);
    const kn = blob(0.14, 3 + s, 0.25, 7, 5); T(kn, knee.clone().add(V(0, 0, 0.05))); K.add(kn, shade(bark, 0.9), MAT.bark);
    for (let i = -1; i <= 1; i++) {
      const a = i * 0.75 + (s > 0 ? 0.25 : -0.25);
      K.add(sweep([foot, foot.clone().add(V(Math.sin(a) * 0.16, -0.08, Math.cos(a) * 0.16)), foot.clone().add(V(Math.sin(a) * 0.34, -0.12, Math.cos(a) * 0.32))], (u) => 0.09 * (1 - u * 0.85), 5, 4), bark, MAT.bark);
    }
  }
  // Ast-Arme: dick, knorrig, mit Krallenzweigen
  for (const s of [1, -1]) {
    const sh = V(0.5 * s, 1.98, 0.12), el = V(0.78 * s, 1.62, 0.22), ha = V(0.72 * s, 1.18, 0.42);
    K.add(sweep([sh, el, ha], (u) => 0.19 - u * 0.08, 7, 9), bark, MAT.bark);
    const sb = blob(0.22, 5 + s, 0.2, 9, 7); sb.scale(1.1, 0.8, 1); T(sb, sh.clone().add(V(0.02 * s, 0.04, 0))); K.add(sb, shade(bark, 1.05), MAT.bark);
    const kn = blob(0.15, 7 + s, 0.25, 8, 6); T(kn, ha); K.add(kn, shade(bark, 0.95), MAT.bark);
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.45;
      K.add(sweep([ha, ha.clone().add(V(Math.sin(a) * 0.1 * s, -0.12, 0.08 + Math.cos(a) * 0.04)), ha.clone().add(V(Math.sin(a) * 0.15 * s, -0.32, 0.16))], (u) => 0.055 * (1 - u * 0.85), 4, 4), bark, MAT.bark);
    }
    const tw = el.clone().add(V(0.02 * s, 0.08, -0.02));
    K.add(sweep([tw, tw.clone().add(V(0.12 * s, 0.22, -0.04)), tw.clone().add(V(0.16 * s, 0.4, 0.0))], (u) => 0.055 * (1 - u * 0.8), 5, 6), bark, MAT.bark);
    const lb = blob(0.17, 11 + s, 0.25, 9, 7); lb.translate(tw.x + 0.17 * s, tw.y + 0.44, tw.z); K.add(lb, shade(leaf, 0.9), MAT.leaf);
    const m = blob(0.14, 5 + s, 0.3, 8, 6); m.scale(1.4, 0.45, 1.1); m.translate(0.46 * s, 2.12, 0.1); K.add(m, P.moss, MAT.leaf);
  }
  // Abgebrochene Äste (Hörner) unter der Krone
  for (const s of [1, -1]) K.add(sweep([V(0.22 * s, 2.12, 0.0), V(0.4 * s, 2.32, -0.02), V(0.48 * s, 2.5, 0.05)], (u) => 0.06 * (1 - u * 0.8), 5, 6), bark, MAT.bark);
  // Laubkrone
  const crown = [[0, 2.5, -0.1, 0.44], [0.38, 2.38, -0.05, 0.32], [-0.38, 2.4, -0.1, 0.33], [0.18, 2.42, 0.25, 0.26], [-0.2, 2.36, 0.24, 0.24], [0.0, 2.32, -0.42, 0.32], [0.34, 2.22, -0.3, 0.24], [-0.34, 2.2, -0.32, 0.24]];
  crown.forEach(([x, y, z, r], i) => { const b = blob(r, i * 2 + 1, 0.22, 8, 6); b.translate(x, y, z); K.add(b, i % 3 === 0 ? shade(leaf, 1.15) : (i % 3 === 1 ? leaf : shade(leaf, 0.8)), MAT.leaf); });
  // Hängende Ranken
  for (let i = 0; i < 4; i++) { const a = -1.2 + i * 0.8, x = Math.sin(a) * 0.5, z = Math.cos(a) * 0.3; K.add(sweep([V(x, 2.25, z), V(x * 1.05, 2.0, z + 0.05), V(x * 1.1, 1.75, z)], (u) => 0.025 * (1 - u * 0.6), 3, 5), shade(P.moss, 0.85), MAT.leaf); }
  for (let i = 0; i < 3; i++) { const cap = dome(0.06 - i * 0.012, 0.045, 6, 0.05); cap.translate(-0.36, 1.4 - i * 0.12, 0.26 + i * 0.02); K.add(cap, mix(P.ember, P.white, 0.3), MAT.cloth); }
  if (t >= 2) { for (let i = 0; i < 5 + t * 2; i++) { const a = i * 2.1; const f = sph(0.028, 6, 4); f.translate(Math.cos(a) * 0.6, 2.0 + Math.sin(i * 1.3) * 0.35, Math.sin(a) * 0.5); K.glow(f, P.glw, 3); } }
  if (t >= 3) { const bl = [[0.2, 2.72, 0.15], [-0.25, 2.66, 0.1], [0.1, 2.74, -0.25], [0.46, 2.5, 0.08], [-0.46, 2.5, -0.05]]; for (const p of bl) { const f = ext(starShape(0.06, 0.025, 5), 0.01, 0); f.rotateX(-PI / 2 + 0.3); T(f, p); K.glow(f, P.white, 2.2); } }
  return [0.95, 0.9];
}

// ---- Pilz-Schamane --------------------------------------------------------------------------------
function mushroom(K) {
  const P = K.P, t = K.tier, cap = mix('#b8402e', P.sec, 0.2), stem = mix('#d9c9a8', P.pri, 0.1);
  // Körper (Stiel)
  const body = lathe([[0, 0.18], [0.2, 0.2], [0.27, 0.42], [0.25, 0.7], [0.19, 0.95], [0.15, 1.1], [0, 1.12]], 14); K.add(body, stem, MAT.skin);
  // Ring (Manschette) mit Fransen
  const ring = lathe([[0.16, 1.0], [0.3, 0.9], [0.32, 0.86], [0.28, 0.87], [0.17, 0.95]], 14);
  warp(ring, (p) => { const a = Math.atan2(p.x, p.z); if (p.y < 0.9) p.y -= 0.03 * Math.abs(Math.sin(a * 6)); });
  K.add(ring, mix(stem, cap, 0.25), MAT.cloth);
  // Hut
  const capG = lathe([[0, 1.62], [0.22, 1.6], [0.42, 1.5], [0.56, 1.32], [0.6, 1.2], [0.56, 1.14], [0.45, 1.15], [0.2, 1.12], [0, 1.12]], 18);
  warp(capG, (p) => { const a = Math.atan2(p.x, p.z); const k = 1 + 0.035 * Math.sin(a * 7); p.x *= k; p.z *= k; });
  K.add(capG, cap, MAT.skin);
  const gills = lathe([[0.55, 1.15], [0.3, 1.11], [0.12, 1.08], [0, 1.08]], 18);
  K.add(gills, mix(cap, P.white, 0.6), MAT.cloth);
  // Punkte auf dem Hut
  const spots = 9 + (t - 1) * 3;
  for (let i = 0; i < spots; i++) {
    const a = i * 2.39996 + 0.5, el = 0.25 + 0.55 * ((i * 0.618) % 1);
    const r = 0.58 * Math.cos(el * 1.2) * 0.95, y = 1.15 + 0.47 * Math.sin(el * 1.4);
    const sp = sph(0.055 + (i % 3) * 0.015, 8, 5); sp.scale(1, 0.35, 1);
    const n = V(Math.sin(a) * Math.cos(el * 1.3), Math.sin(el * 1.3) + 0.35, Math.cos(a) * Math.cos(el * 1.3)).normalize();
    sp.applyQuaternion(qY(n)); sp.translate(Math.sin(a) * r, y, Math.cos(a) * r);
    K.add(sp, P.white, MAT.skin);
  }
  // Gesicht
  eyes(K, [0, 0.86, 0.23], 0.08, 0.035, P.glw, 3.4, 0.9);
  const cheek = sph(0.04, 6, 5); cheek.scale(1, 0.6, 0.5); cheek.translate(0.13, 0.78, 0.22); K.sym(cheek, mix(cap, stem, 0.5), MAT.skin);
  // Beinchen + Ärmchen
  for (const s of [1, -1]) {
    const f = ell(0.1, 0.08, 0.13, 8, 6); f.translate(0.13 * s, 0.07, s > 0 ? 0.06 : -0.02); K.add(f, shade(stem, 0.8), MAT.skin);
    K.add(seg([0.13 * s, 0.25, 0.02], [0.13 * s, 0.1, s > 0 ? 0.06 : -0.02], 0.07, 0.06, 7, 2), shade(stem, 0.9), MAT.skin);
  }
  K.add(seg([0.24, 0.7, 0.02], [0.38, 0.52, 0.18], 0.055, 0.045, 6, 2), stem, MAT.skin);
  K.add(seg([-0.24, 0.7, 0.02], [-0.38, 0.6, 0.2], 0.055, 0.045, 6, 2), stem, MAT.skin);
  handS(K, [0.38, 0.5, 0.2], stem, 0.9); handS(K, [-0.38, 0.6, 0.22], stem, 0.9);
  // Stab mit Sporen-Kolben
  staff(K, [-0.4, 0.02, 0.24], [-0.38, 1.25, 0.2], P.wood, 0.025, { wobble: 0.015 });
  const bulb = lathe([[0, -0.02], [0.07, 0.03], [0.09, 0.12], [0.05, 0.2], [0, 0.22]], 10); bulb.translate(-0.38, 1.25, 0.2); K.glow(bulb, P.glw, 2.8);
  const bc = dome(0.11, 0.06, 10, 0.1); bc.translate(-0.38, 1.46, 0.2); K.add(bc, cap, MAT.skin);
  // Moos-Gürtel / Blätter
  for (let i = 0; i < 6; i++) { const lf = ext(leafShape(0.14, 0.08), 0.008, 0.004, 1, 2); R(lf, PI - 0.3, 0, 0); lf.translate(0, 0, 0.25); lf.rotateY((i / 6) * TAU); lf.translate(0, 0.62, 0); K.add(lf, mix(P.leaf, P.pri, 0.6), MAT.leaf); }
  // schwebende Sporen
  const sn = 6 + t * 3;
  for (let i = 0; i < sn; i++) { const a = i * 2.39996, r = 0.5 + 0.25 * ((i * 0.37) % 1); const s = sph(0.022 + (i % 3) * 0.008, 6, 4); s.translate(Math.cos(a) * r, 0.6 + ((i * 0.618) % 1) * 1.1, Math.sin(a) * r); K.glow(s, P.glw, 2.8); }
  if (t >= 3) { const h = tor(0.4, 0.012, 4, 30); h.rotateX(PI / 2); h.translate(0, 1.7, 0); K.glow(h, P.glw, 2.4); }
  return [1.0, 0.6];
}

// ---- Krabbler (Insekt) ----------------------------------------------------------------------------
function crawler(K) {
  const P = K.P, t = K.tier, shell = P.pri;
  // Hinterleib (segmentiert)
  for (let i = 0; i < 4; i++) {
    const r = 0.3 - i * 0.05;
    const g = ell(r * 1.05, r * 0.75, r * 0.7, 12, 8); g.translate(0, 0.52 + i * 0.03, -0.32 - i * 0.2); K.add(g, i % 2 ? shade(shell, 0.75) : shell, MAT.chitin);
  }
  const tail = ell(0.12, 0.08, 0.1, 8, 6); tail.translate(0, 0.6, -1.02); K.glow(tail, P.glw, 2.6);
  for (let i = 0; i < 3; i++) { const st = box(0.3 - i * 0.06, 0.02, 0.04); st.translate(0, 0.42 + i * 0.03, -0.32 - i * 0.2 + 0.05); K.glow(st, P.glw, 1.8); }
  // Brust mit Panzer
  const th = ell(0.22, 0.2, 0.26, 12, 8); th.translate(0, 0.62, 0.05); K.add(th, shade(shell, 0.85), MAT.chitin);
  const pl = dome(0.24, 0.14, 12, 0.1); pl.scale(1.05, 1, 1.25); R(pl, -0.25, 0, 0); pl.translate(0, 0.7, 0.02); K.add(pl, shell, MAT.chitin);
  const pl2 = dome(0.3, 0.16, 12, 0.1); pl2.scale(1.0, 1, 1.4); R(pl2, 0.15, 0, 0); pl2.translate(0, 0.7, -0.45); K.add(pl2, shell, MAT.chitin);
  K.add(box(0.012, 0.03, 0.7).translate(0, 0.86, -0.45), P.dark, MAT.chitin);
  // Kopf
  const hc = V(0, 0.72, 0.36);
  const hd = ell(0.17, 0.14, 0.16, 10, 8); T(hd, hc); K.add(hd, shell, MAT.chitin);
  for (const s of [1]) {
    const e = sph(0.06, 8, 6); e.translate(0.11 * s, 0.05, 0.08); T(e, hc); K.symGlow(e, P.glw, 3.4);
    K.sym(sweep([hc.clone().add(V(0.08, -0.06, 0.12)), hc.clone().add(V(0.16, -0.08, 0.26)), hc.clone().add(V(0.06, -0.1, 0.4))], (u) => 0.035 * (1 - u * 0.8), 6, 8), P.bone, MAT.bone);
    K.sym(sweep([hc.clone().add(V(0.06, 0.1, 0.06)), hc.clone().add(V(0.14, 0.3, 0.12)), hc.clone().add(V(0.26, 0.42, 0.0))], (u) => 0.012 * (1 - u * 0.6), 4, 8), shade(shell, 0.6), MAT.chitin);
  }
  // 6 Beine
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const z = 0.18 - i * 0.2;
    const a = V(0.16 * s, 0.56, z), b = V(0.4 * s, 0.74, z + (1 - i) * 0.1), c = V(0.56 * s, 0.32, z + (1 - i) * 0.22), d = V(0.62 * s, 0.0, z + (1 - i) * 0.3);
    bugLeg(K, [a, b, c, d], 0.055, shade(shell, 0.7), MAT.chitin, null, shade(shell, 0.45));
    const sp = cone(0.02, 0.09, 4); sp.translate(0, 0.045, 0); aim(sp, b, V(s * 0.3, 1, 0)); K.add(sp, shade(shell, 0.5), MAT.chitin);
  }
  if (t >= 2) { for (let i = 0; i < 4; i++) { const sp = cone(0.03, 0.14, 5); R(sp, -0.4, 0, 0); sp.translate(0, 0.86 - i * 0.02, -0.25 - i * 0.18); K.add(sp, shade(shell, 0.6), MAT.chitin); } }
  if (t >= 3) { const g = crystal(0.05, 0.2, 5); g.translate(0, 0.9, 0.05); K.glow(g, P.glw, 3); }
  return [1.15, 0.65];
}

// ---- Lava-Hund ------------------------------------------------------------------------------------
function hound(K) {
  const P = K.P, t = K.tier, rockC = P.pri, lava = P.glw;
  // Glühender Kern
  const core = [[0, 0.74, 0.22, 0.27, 0.3, 0.32], [0, 0.72, -0.2, 0.23, 0.25, 0.32], [0, 0.72, -0.48, 0.22, 0.24, 0.22]];
  for (const [x, y, z, a, b, c] of core) { const g = ell(a, b, c, 10, 8); g.translate(x, y, z); K.glow(g, lava, 2.2); }
  rockShell(K, [0, 0.74, 0.22], 0.29, 0.32, 0.34, 18, rockC, { size: 0.5, seed: 1 });
  rockShell(K, [0, 0.72, -0.2], 0.25, 0.27, 0.34, 14, rockC, { size: 0.5, seed: 2 });
  rockShell(K, [0, 0.72, -0.48], 0.24, 0.26, 0.24, 12, rockC, { size: 0.5, seed: 3 });
  // Hals + Kopf
  const nk = ell(0.13, 0.13, 0.18, 8, 6); R(nk, -0.7, 0, 0); nk.translate(0, 0.92, 0.48); K.glow(nk, lava, 2.2);
  rockShell(K, [0, 0.93, 0.48], 0.15, 0.15, 0.17, 8, rockC, { size: 0.55, seed: 4 });
  const hc = V(0, 1.02, 0.68);
  const sk = rock(0.16, 5, 1, 0.12); sk.scale(1, 0.85, 1.2); T(sk, hc); K.add(sk, shade(rockC, 0.9), MAT.rock);
  const snout = rock(0.1, 6, 1, 0.12); snout.scale(0.9, 0.7, 1.4); snout.translate(hc.x, hc.y - 0.02, hc.z + 0.18); K.add(snout, rockC, MAT.rock);
  const jaw = rock(0.08, 7, 1, 0.12); jaw.scale(1, 0.6, 1.6); jaw.translate(hc.x, hc.y - 0.13, hc.z + 0.14); K.add(jaw, shade(rockC, 0.8), MAT.rock);
  const mouth = box(0.1, 0.035, 0.24); mouth.translate(hc.x, hc.y - 0.08, hc.z + 0.16); K.glow(mouth, lava, 3.4);
  eyes(K, [0, hc.y + 0.05, hc.z + 0.13], 0.075, 0.025, lava, 4, 0.5);
  horn(K, hc.clone().add(V(0.09, 0.08, -0.04)), [hc.clone().add(V(0.16, 0.16, -0.14)), hc.clone().add(V(0.2, 0.18, -0.3))], 0.04, P.dark, MAT.rock);
  // Beine
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.08 : -0.04, h = s > 0 ? -0.05 : 0.04;
    const legs = [[[0.17 * s, 0.68, 0.26], [0.19 * s, 0.4, 0.34 + f], [0.17 * s, 0.06, 0.36 + f]], [[0.17 * s, 0.7, -0.5], [0.2 * s, 0.42, -0.36 + h], [0.18 * s, 0.06, -0.54 + h]]];
    for (const [a, b, c] of legs) {
      K.add(seg(a, b, 0.1, 0.08, 7, 2), shade(rockC, 0.85), MAT.rock);
      K.add(seg(b, c, 0.075, 0.065, 7, 2), shade(rockC, 0.85), MAT.rock);
      const j = sph(0.07, 7, 5); T(j, b); K.glow(j, lava, 2.6);
      const pw = rock(0.1, a[2] * 10 + s, 0, 0.15); pw.scale(1, 0.55, 1.2); pw.translate(c[0], 0.05, c[2] + 0.04); K.add(pw, shade(rockC, 0.7), MAT.rock);
    }
  }
  // Rücken-Stacheln aus Obsidian + Flammenschweif
  const ns = 4 + t;
  for (let i = 0; i < ns; i++) { const sp = cone(0.05, 0.22 + 0.08 * Math.sin((i / ns) * PI), 5); R(sp, -0.5, 0, 0); sp.translate(0, 1.0 - i * 0.02, 0.3 - i * (0.85 / ns)); K.add(sp, P.dark, [0.25, 0.3]); }
  K.add(sweep([[0, 0.8, -0.68], [0, 0.85, -0.85], [0, 0.95, -1.0]], (u) => 0.06 * (1 - u * 0.5), 6, 8), rockC, MAT.rock);
  K.glow(sweep([[0, 0.95, -1.0], [0, 1.08, -1.12], [0, 1.25, -1.1], [0, 1.36, -1.2]], (u) => 0.07 * (1 - u), 6, 8), lava, 3.4);
  if (t >= 3) { const c = crystal(0.05, 0.2, 5); c.translate(0, 1.22, 0.62); K.glow(c, lava, 3.4); }
  return [1.1, 0.7, 0.8];
}

// ---- Nashornkäfer ---------------------------------------------------------------------------------
function beetle(K) {
  const P = K.P, t = K.tier, shell = P.pri;
  const body = ell(0.4, 0.26, 0.58, 12, 8); body.translate(0, 0.45, -0.1); K.add(body, shade(shell, 0.4), MAT.chitin);
  // Deckflügel (zwei Hälften)
  for (const s of [1]) {
    const el = lathe([[0, 0.34], [0.2, 0.32], [0.36, 0.24], [0.44, 0.1], [0.46, 0.0], [0.42, -0.05], [0, -0.05]], 8, 0, PI);
    el.scale(1, 1, 1); R(el, 0, 0, 0); el.scale(0.9, 1, 1.45); el.translate(0.012, 0.52, -0.22);
    K.sym(el, shell, MAT.chitin);
    const tr = tor(0.44, 0.016, 3, 12, PI); tr.rotateX(PI / 2); tr.rotateZ(PI / 2); tr.scale(0.9, 1, 1.45); tr.translate(0.03, 0.52, -0.22); K.sym(tr, P.gold, MAT.gold);
  }
  K.glow(box(0.02, 0.025, 1.0).translate(0, 0.86, -0.25), P.glw, 2.2);
  // Halsschild
  const pr = dome(0.34, 0.24, 12, 0.08); pr.scale(1, 1, 0.85); R(pr, 0.3, 0, 0); pr.translate(0, 0.55, 0.38); K.add(pr, shade(shell, 1.1), MAT.chitin);
  // Kopf + großes Horn
  const hc = V(0, 0.45, 0.66);
  const hd = ell(0.17, 0.13, 0.15, 10, 7); T(hd, hc); K.add(hd, shade(shell, 0.8), MAT.chitin);
  const hornL = 0.55 + (t - 1) * 0.1;
  K.add(sweep([hc.clone().add(V(0, 0.02, 0.06)), hc.clone().add(V(0, 0.12, 0.3)), hc.clone().add(V(0, 0.35, 0.42)), hc.clone().add(V(0, hornL, 0.36))], (u) => 0.08 * (1 - u * 0.88), 7, 14), P.met, MAT.metal);
  const ph = cone(0.06, 0.26, 6); R(ph, 0.6, 0, 0); ph.translate(0, 0.86, 0.42); K.add(ph, P.met, MAT.metal);
  for (const s of [1]) { const e = sph(0.035, 6, 5); e.translate(0.12 * s, hc.y + 0.04, hc.z + 0.08); K.symGlow(e, P.glw, 3.4); }
  for (const s of [1]) K.sym(sweep([hc.clone().add(V(0.08, -0.06, 0.1)), hc.clone().add(V(0.14, -0.1, 0.2)), hc.clone().add(V(0.06, -0.12, 0.28))], (u) => 0.025 * (1 - u * 0.8), 5, 6), P.dark, MAT.chitin);
  // Beine
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const z = 0.3 - i * 0.32;
    const a = V(0.28 * s, 0.36, z), b = V(0.52 * s, 0.5, z + (1 - i) * 0.1), c = V(0.68 * s, 0.22, z + (1 - i) * 0.2), d = V(0.74 * s, 0.0, z + (1 - i) * 0.26);
    bugLeg(K, [a, b, c, d], 0.075, shade(shell, 0.5), MAT.chitin, t >= 2 ? P.gold : null, P.dark);
    for (let k = 0; k < 2; k++) { const sp = cone(0.018, 0.07, 4); sp.translate(0, 0.035, 0); aim(sp, v3(c).lerp(v3(d), 0.2 + k * 0.35), V(s * 0.6, 0.3, 0.4)); K.add(sp, P.dark, MAT.chitin); }
  }
  if (t >= 3) { for (const s of [1]) { const sp = cone(0.05, 0.22, 5); R(sp, 0.2, 0, -0.9); sp.translate(0.34, 0.75, 0.38); K.sym(sp, P.met, MAT.metal); } }
  return [1.25, 0.85];
}

// ---- Imp (kleiner Flügel-Teufel) ------------------------------------------------------------------
function imp(K) {
  const P = K.P, t = K.tier, skin = P.pri, lift = 0.45;
  const y = (v) => v + lift;
  const belly = blob(0.2, 3, 0.04); belly.scale(1, 1.1, 0.95); belly.translate(0, y(0.45), 0.02); K.add(belly, skin, MAT.skin);
  const chest = ell(0.19, 0.15, 0.15, 10, 7); chest.translate(0, y(0.66), 0.0); K.add(chest, skin, MAT.skin);
  const bl = ell(0.13, 0.12, 0.08, 8, 6); bl.translate(0, y(0.45), 0.16); K.add(bl, mix(skin, P.sec, 0.5), MAT.skin);
  // Kopf
  const hc = V(0, y(0.9), 0.06);
  const hd = blob(0.17, 4, 0.04, 10, 8); hd.scale(1.05, 0.95, 1); T(hd, hc); K.add(hd, skin, MAT.skin);
  eyes(K, [0, hc.y + 0.03, hc.z + 0.14], 0.07, 0.03, P.glw, 3.6, 0.6);
  const grin = tor(0.08, 0.015, 3, 10, PI); grin.rotateZ(PI); grin.translate(0, hc.y - 0.06, hc.z + 0.15); K.glow(grin, P.glw, 2.4);
  const nose = cone(0.025, 0.08, 5); nose.rotateX(PI / 2 + 0.3); nose.translate(0, hc.y, hc.z + 0.18); K.add(nose, skin, MAT.skin);
  horn(K, hc.clone().add(V(0.08, 0.1, 0.0)), [hc.clone().add(V(0.15, 0.2, -0.03)), hc.clone().add(V(0.14, 0.32, -0.12))], 0.04, P.dark, MAT.bone);
  const ear = cone(0.04, 0.16, 4); ear.scale(1, 1, 0.4); R(ear, 0, 0, -1.3); ear.translate(0.2, hc.y, hc.z - 0.02); K.sym(ear, skin, MAT.skin);
  // Arme mit Krallen
  for (const s of [1, -1]) {
    const sh = V(0.17 * s, y(0.7), 0), el = V(0.28 * s, y(0.52), 0.1), ha = V(0.24 * s, y(0.4), 0.24);
    K.add(seg(sh, el, 0.05, 0.04, 6, 2), skin, MAT.skin); K.add(seg(el, ha, 0.04, 0.035, 6, 2), skin, MAT.skin);
    for (let i = -1; i <= 1; i++) { const c = cone(0.012, 0.07, 4); aim(c, ha.clone().add(V(i * 0.02, 0, 0.02)), V(i * 0.3, -0.5, 1)); K.add(c, P.dark, MAT.bone); }
    // Beine angezogen
    const hp = V(0.1 * s, y(0.32), 0), kn = V(0.14 * s, y(0.2), 0.14), ft = V(0.12 * s, y(0.02), 0.04);
    K.add(seg(hp, kn, 0.07, 0.05, 6, 2), skin, MAT.skin); K.add(seg(kn, ft, 0.045, 0.035, 6, 2), skin, MAT.skin);
    const hoof = ell(0.045, 0.035, 0.06, 6, 5); T(hoof, ft.clone().add(V(0, -0.02, 0.02))); K.add(hoof, P.dark, MAT.bone);
  }
  // Flügel
  batWing(K, [0.1, y(0.72), -0.1], 0.8 + (t - 1) * 0.08, { col: shade(skin, 0.75), mem: P.sec, up: 0.55, back: -0.35 });
  // Schwanz mit Pfeilspitze
  const tp = [V(0, y(0.38), -0.14), V(0, y(0.2), -0.35), V(0, y(0.3), -0.58), V(0, y(0.55), -0.66)];
  K.add(sweep(tp, (u) => 0.035 * (1 - u * 0.6), 5, 12), skin, MAT.skin);
  const spade = ext(shape([[0, 0.12], [0.07, -0.02], [0, 0.02], [-0.07, -0.02]]), 0.015, 0.006, 1); spade.rotateY(PI / 2); spade.translate(0, y(0.6), -0.67); K.add(spade, P.dark, MAT.bone);
  // Feuerball in der Hand
  const fb = sph(0.06 + t * 0.012, 8, 6); fb.translate(-0.24, y(0.48), 0.32); K.glow(fb, P.glw, 3.4);
  if (t >= 3) { const c = tor(0.12, 0.01, 3, 16); c.rotateX(PI / 2); c.translate(0, hc.y + 0.24, hc.z - 0.04); K.glow(c, P.glw, 3); }
  return [1.15, 0.55];
}

// ---- Oger-Schläger --------------------------------------------------------------------------------
function brute(K) {
  const P = K.P, t = K.tier, skin = P.pri;
  // Beine kurz und dick
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.1 : -0.06;
    K.add(seg([0.2 * s, 0.85, 0], [0.24 * s, 0.45, 0.05 + f * 0.5], 0.16, 0.13, 8, 2), skin, MAT.skin);
    K.add(seg([0.24 * s, 0.45, 0.05 + f * 0.5], [0.25 * s, 0.12, f], 0.13, 0.11, 8, 2), skin, MAT.skin);
    const ft = ell(0.13, 0.08, 0.18, 8, 6); ft.translate(0.25 * s, 0.07, f + 0.06); K.add(ft, shade(skin, 0.8), MAT.skin);
    const wr = cyl(0.13, 0.12, 0.12, 8, true); wr.translate(0.25 * s, 0.24, f); K.add(wr, P.leather, MAT.leather);
  }
  // Lendenschurz
  const loin = robe(K, [[0, 1.0], [0.34, 0.98], [0.38, 0.8], [0.36, 0.62], [0, 0.6]], P.leather, { seg: 12, fold: 0.12, folds: 5, tatter: 0.1, tears: 4, mat: MAT.leather });
  const flap = ext(shape([[-0.12, 0], [0.12, 0], [0.14, -0.38], [-0.14, -0.38]]), 0.02, 0.006, 1); flap.translate(0, 0.9, 0.34); K.add(flap, P.sec, MAT.cloth);
  // Rumpf mit Bauch
  const belly = blob(0.44, 5, 0.04); belly.scale(1, 0.95, 0.9); belly.translate(0, 1.15, 0.1); K.add(belly, skin, MAT.skin);
  const chest = blob(0.42, 6, 0.05); chest.scale(1.15, 0.8, 0.85); chest.translate(0, 1.5, -0.02); K.add(chest, skin, MAT.skin);
  belt(K, 0.98, 0.38, 0.36, P.dleather, P.gold);
  // Schultern / Nacken (Buckel)
  const tr = blob(0.28, 7, 0.06); tr.scale(1.3, 0.7, 1); tr.translate(0, 1.78, -0.1); K.add(tr, skin, MAT.skin);
  // Kopf klein, vorgeschoben
  const hc = V(0, 1.82, 0.28);
  const hd = blob(0.15, 8, 0.05); hd.scale(1.05, 0.95, 1); T(hd, hc); K.add(hd, skin, MAT.skin);
  const jaw = ell(0.15, 0.08, 0.12, 8, 6); jaw.translate(hc.x, hc.y - 0.1, hc.z + 0.05); K.add(jaw, skin, MAT.skin);
  for (const s of [1]) { const tk = cone(0.025, 0.11, 5); R(tk, 0.2, 0, -0.25); tk.translate(0.07, hc.y - 0.02, hc.z + 0.13); K.sym(tk, P.bone, MAT.bone); }
  const brow = ell(0.14, 0.035, 0.05, 8, 4); brow.translate(hc.x, hc.y + 0.06, hc.z + 0.12); K.add(brow, shade(skin, 0.8), MAT.skin);
  eyes(K, [0, hc.y + 0.02, hc.z + 0.13], 0.055, 0.018, P.glw, 3.4, 0.6);
  const ear = cone(0.04, 0.1, 4); ear.scale(1, 1, 0.4); R(ear, 0, 0, -1.2); ear.translate(0.16, hc.y + 0.02, hc.z - 0.04); K.sym(ear, skin, MAT.skin);
  // Arme (riesig)
  const shR = V(-0.5, 1.68, 0), elR = V(-0.68, 1.25, 0.12), haR = V(-0.62, 0.9, 0.38);
  const shL = V(0.5, 1.68, 0), elL = V(0.66, 1.22, 0.05), haL = V(0.66, 0.82, 0.18);
  for (const [sh, el, ha] of [[shR, elR, haR], [shL, elL, haL]]) {
    K.add(seg(sh, el, 0.17, 0.14, 8, 2), skin, MAT.skin); K.add(seg(el, ha, 0.15, 0.12, 8, 2), skin, MAT.skin);
    const fist = blob(0.13, 9, 0.05, 8, 6); T(fist, ha); K.add(fist, shade(skin, 0.9), MAT.skin);
    const br = cyl(0.16, 0.14, 0.18, 8, true); aim(br, v3(el).lerp(v3(ha), 0.55), v3(ha).sub(v3(el))); K.add(br, P.leather, MAT.leather);
  }
  // Schulterpanzer links + Riemen
  pauldron(K, [0.56, 1.9, -0.02], 0.25, P.met, P.gold, { layers: 2, tilt: 0.55, spikes: t >= 2 ? 3 : 0 });
  const strap = tor(0.45, 0.03, 3, 18); strap.scale(0.85, 1.1, 0.75); strap.rotateZ(-0.6); strap.translate(0, 1.45, 0.02); K.add(strap, P.dleather, MAT.leather);
  // Keule
  const cb = haR.clone(), cd = V(-0.25, 0.9, 0.5).normalize();
  const club = sweep([cb.clone().add(cd.clone().multiplyScalar(-0.15)), cb.clone().add(cd.clone().multiplyScalar(0.4)), cb.clone().add(cd.clone().multiplyScalar(0.95))], (u) => 0.05 + u * u * 0.13, 8, 12);
  K.add(club, P.wood, MAT.wood);
  const tipC = cb.clone().add(cd.clone().multiplyScalar(0.8));
  for (let i = 0; i < 7; i++) { const d = fib(7, i); const sp = cone(0.025, 0.1, 4); sp.translate(0, 0.05, 0); aim(sp, tipC.clone().add(d.clone().multiplyScalar(0.15)), d); K.add(sp, P.met, MAT.metal); }
  const band = cyl(0.12, 0.12, 0.05, 8); aim(band, cb.clone().add(cd.clone().multiplyScalar(0.55)), cd); K.add(band, P.met, MAT.metal);
  if (t >= 3) { const rn = sph(0.05, 8, 6); rn.translate(0, 1.5, 0.36); K.glow(rn, P.glw, 3); }
  return [1.15, 0.8];
}

// ---- Raptor ---------------------------------------------------------------------------------------
function raptor(K) {
  const P = K.P, t = K.tier, skin = P.pri, belly = mix(P.sec, '#d8c8a0', 0.6), stripe = shade(P.pri, 0.55);
  // Rumpf (waagerecht)
  const bd = blob(0.27, 3, 0.04); bd.scale(0.88, 0.95, 1.45); R(bd, -0.12, 0, 0); bd.translate(0, 1.0, -0.02); K.add(bd, skin, MAT.scale);
  const bb = ell(0.19, 0.14, 0.32, 10, 6); R(bb, -0.15, 0, 0); bb.translate(0, 0.87, 0.04); K.add(bb, belly, MAT.skin);
  // Streifen über den Rücken
  for (let i = 0; i < 5; i++) { const st = tor(0.24 - Math.abs(i - 1) * 0.02, 0.025, 3, 10, PI * 0.9); st.rotateY(PI / 2); st.rotateZ(PI * 0.05); st.scale(0.92, 1, 1); st.translate(0, 0.98 - i * 0.01, 0.2 - i * 0.14); K.add(st, stripe, MAT.scale); }
  // Hals + Kopf
  K.add(sweep([[0, 1.1, 0.28], [0, 1.28, 0.42], [0, 1.38, 0.52]], (u) => 0.14 - u * 0.04, 8, 8), skin, MAT.scale);
  const hc = V(0, 1.44, 0.6);
  const sk = ell(0.13, 0.12, 0.17, 10, 7); T(sk, hc); K.add(sk, skin, MAT.scale);
  K.add(seg(hc.clone().add(V(0, 0.0, 0.08)), hc.clone().add(V(0, -0.03, 0.34)), 0.095, 0.055, 7, 2), skin, MAT.scale);
  K.add(seg(hc.clone().add(V(0, -0.08, 0.05)), hc.clone().add(V(0, -0.17, 0.3)), 0.07, 0.04, 7, 2), shade(belly, 0.85), MAT.skin);
  const mouth = box(0.07, 0.04, 0.2); mouth.rotateX(-0.2); mouth.translate(hc.x, hc.y - 0.08, hc.z + 0.2); K.add(mouth, P.dark, MAT.skin);
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) { const f = cone(0.012, 0.045, 4); f.rotateX(PI); f.translate(s * 0.05, hc.y - 0.05 - i * 0.008, hc.z + 0.12 + i * 0.055); K.add(f, P.white, MAT.bone); }
  const brow = ell(0.05, 0.025, 0.08, 6, 4); brow.translate(0.08, hc.y + 0.06, hc.z + 0.08); K.sym(brow, stripe, MAT.scale);
  eyes(K, [0, hc.y + 0.04, hc.z + 0.1], 0.09, 0.022, P.glw, 3.6, 0.5);
  // Federkamm über Kopf und Hals
  for (let i = 0; i < 6; i++) { const f = ext(featherShape(0.24 - i * 0.025, 0.07), 0.012, 0); R(f, -1.15 - i * 0.1, 0, 0); f.translate(0, hc.y + 0.1 - i * 0.04, hc.z - 0.04 - i * 0.07); K.add(f, i % 2 ? mix(P.glw, P.sec, 0.5) : P.sec, MAT.cloth); }
  // Beine
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.12 : -0.1;
    const hip = V(0.16 * s, 0.98, -0.08), kn = V(0.21 * s, 0.64, 0.14 + f * 0.3), an = V(0.19 * s, 0.28, -0.1 + f), ft = V(0.19 * s, 0.05, 0.02 + f);
    const th = blob(0.16, 4 + s, 0.04, 9, 7); th.scale(0.8, 1.2, 1); T(th, hip.clone().lerp(kn, 0.4)); K.add(th, skin, MAT.scale);
    K.add(seg(kn, an, 0.075, 0.05, 6, 2), skin, MAT.scale); K.add(seg(an, ft, 0.05, 0.04, 6, 2), stripe, MAT.scale);
    for (let i = -1; i <= 1; i++) K.add(sweep([ft, ft.clone().add(V(i * 0.05, -0.02, 0.1)), ft.clone().add(V(i * 0.07, -0.04, 0.16))], (u) => 0.025 * (1 - u * 0.7), 4, 4), stripe, MAT.scale);
    K.add(sweep([ft.clone().add(V(0.02 * s, 0.02, 0.02)), ft.clone().add(V(0.03 * s, 0.12, 0.08)), ft.clone().add(V(0.03 * s, 0.07, 0.17))], (u) => 0.022 * (1 - u * 0.85), 5, 6), P.bone, MAT.bone);
    const sh = V(0.13 * s, 1.0, 0.32), el = V(0.17 * s, 0.86, 0.38), ha = V(0.13 * s, 0.84, 0.48);
    K.add(seg(sh, el, 0.045, 0.035, 6, 2), skin, MAT.scale); K.add(seg(el, ha, 0.035, 0.028, 6, 2), skin, MAT.scale);
    for (let i = 0; i < 2; i++) { const c = cone(0.012, 0.06, 4); aim(c, ha, V(i * 0.3 - 0.15, -0.6, 1)); K.add(c, P.bone, MAT.bone); }
  }
  // Schwanz (dick an der Wurzel, waagerecht)
  K.add(sweep([[0, 1.02, -0.32], [0, 1.08, -0.68], [0, 1.02, -1.05], [0, 0.92, -1.4]], (u) => 0.17 * (1 - u * 0.92), 8, 14), skin, MAT.scale);
  for (let i = 0; i < 4; i++) { const st = ell(0.1 - i * 0.02, 0.04, 0.05, 6, 4); st.translate(0, 1.13 - i * 0.03, -0.55 - i * 0.22); K.add(st, stripe, MAT.scale); }
  // Rüstung: Kopfplatte + Sattelgurt
  const hm = dome(0.1, 0.05, 8, 0.1); hm.scale(1, 1, 1.5); hm.translate(hc.x, hc.y + 0.08, hc.z + 0.02); K.add(hm, P.met, MAT.metal);
  if (t >= 2) { const c = tor(0.15, 0.025, 4, 12); R(c, PI / 2 - 0.9, 0, 0); c.translate(0, 1.26, 0.42); K.add(c, P.met, MAT.metal); }
  if (t >= 3) { for (let i = 0; i < 4; i++) { const sp = cone(0.03, 0.14, 5); R(sp, -0.5, 0, 0); sp.translate(0, 1.24 - i * 0.03, 0.08 - i * 0.2); K.add(sp, P.met, MAT.metal); } }
  return [1.05, 0.65];
}

// ---- Naga / Schlangenkrieger ----------------------------------------------------------------------
function serpent(K) {
  const P = K.P, t = K.tier, scale = P.pri, belly = mix(P.sec, '#d8c8a0', 0.5);
  // Schlangenschwanz: Spirale am Boden, dann aufrecht
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = -0.6 + i * 0.6, r = 0.18 + i * 0.035; pts.push(V(Math.sin(a) * r, 0.1 + Math.max(0, 7 - i) * 0.008, -Math.cos(a) * r * 0.9 - 0.05)); }
  pts.reverse();
  pts.push(V(0, 0.32, 0.06), V(0, 0.65, 0.02), V(0, 0.95, -0.02));
  const tail = sweep(pts, (u) => 0.025 + 0.16 * Math.pow(u, 0.6), 7, 30);
  K.add(tail, scale, MAT.scale);
  // Bauchschuppen vorne am aufrechten Teil
  for (let i = 0; i < 6; i++) { const b = ell(0.11, 0.035, 0.05, 6, 3); b.translate(0, 0.35 + i * 0.1, 0.17 - i * 0.01); K.add(b, belly, MAT.scale); }
  // Oberkörper
  torso(K, [[0, 0.9], [0.17, 0.92], [0.2, 1.05], [0.25, 1.25], [0.29, 1.38], [0.24, 1.47], [0.1, 1.52], [0, 1.53]], scale, MAT.scale, 0.75);
  const cuir = lathe([[0.2, 1.1], [0.255, 1.26], [0.3, 1.39], [0.22, 1.47], [0.21, 1.45], [0.27, 1.37], [0.23, 1.25], [0.18, 1.1]], 12, -PI * 0.55, PI * 1.1); cuir.scale(1, 1, 0.8); K.add(cuir, P.met, MAT.metal);
  belt(K, 0.98, 0.2, 0.17, P.gold, P.glw);
  // Kopf mit Kobra-Schild
  K.add(seg([0, 1.48, 0], [0, 1.6, 0.04], 0.07, 0.065), scale, MAT.scale);
  const hc = V(0, 1.7, 0.06);
  const hd = ell(0.11, 0.1, 0.14, 10, 7); T(hd, hc); K.add(hd, scale, MAT.scale);
  K.add(seg(hc.clone().add(V(0, -0.02, 0.06)), hc.clone().add(V(0, -0.04, 0.2)), 0.075, 0.05, 7, 2), scale, MAT.scale);
  eyes(K, [0, hc.y + 0.02, hc.z + 0.1], 0.06, 0.02, P.glw, 3.8, 0.45);
  const hood = ext(shape([[0, 0.34], [0.2, 0.2], [0.24, 0.0], [0.14, -0.22], [0, -0.26], [-0.14, -0.22], [-0.24, 0.0], [-0.2, 0.2]], true), 0.025, 0.012, 1, 3);
  bend(hood, -1.6); hood.translate(0, 1.66, -0.08); K.add(hood, scale, MAT.scale);
  const hoodIn = ext(shape([[0, 0.26], [0.14, 0.14], [0.17, -0.02], [0, -0.18], [-0.17, -0.02], [-0.14, 0.14]], true), 0.01, 0.006, 1, 3);
  bend(hoodIn, -1.6); hoodIn.translate(0, 1.66, -0.06); K.add(hoodIn, belly, MAT.scale);
  for (const s of [1]) { const sp = sph(0.03, 6, 5); sp.translate(0.12, 1.75, -0.04); K.symGlow(sp, P.glw, 2.6); }
  const crown = cone(0.04, 0.15, 5); R(crown, -0.3, 0, 0); crown.translate(0, 1.85, 0.02); K.add(crown, P.gold, MAT.gold);
  // Arme
  const shR = V(-0.28, 1.4, 0), elR = V(-0.4, 1.18, 0.08), haR = V(-0.34, 1.12, 0.3);
  const shL = V(0.28, 1.4, 0), elL = V(0.4, 1.15, 0.1), haL = V(0.3, 1.0, 0.26);
  for (const [sh, el, ha] of [[shR, elR, haR], [shL, elL, haL]]) {
    K.add(seg(sh, el, 0.065, 0.055), scale, MAT.scale); K.add(seg(el, ha, 0.055, 0.045), scale, MAT.scale);
    const br = cyl(0.065, 0.055, 0.12, 8, true); aim(br, v3(el).lerp(v3(ha), 0.55), v3(ha).sub(v3(el))); K.add(br, P.gold, MAT.gold);
    handS(K, ha, scale);
  }
  pauldron(K, [0.3, 1.46, 0], 0.12, P.met, P.gold, { layers: 2, tilt: 0.7 });
  // Speer (Dreizack-artig)
  const sb = V(-0.36, 0.1, 0.2), stp = V(-0.32, 2.15, 0.4);
  K.add(seg(sb, stp, 0.022, 0.022, 6, 1), P.wood, MAT.wood);
  const d = stp.clone().sub(sb).normalize();
  const tip = ext(bladeShape(0.3, 0.1, 0.4, 0.7), 0.02, 0.01, 1); aim(tip, stp, d); K.add(tip, P.met, MAT.metal);
  const tg = rbox(0.025, 0.2, 0.035, 0.008); tg.translate(0, 0.12, 0); aim(tg, stp, d); K.glow(tg, P.glw, 3 + t * 0.3);
  for (const s of [1, -1]) { const pr = sweep([V(0, 0, 0), V(s * 0.08, 0.05, 0), V(s * 0.1, 0.18, 0)], (u) => 0.016 * (1 - u * 0.8), 5, 6); aim(pr, stp, d); K.add(pr, P.met, MAT.metal); }
  const rg = tor(0.035, 0.012, 4, 10); rg.rotateX(PI / 2); aim(rg, stp, d); K.add(rg, P.gold, MAT.gold);
  if (t >= 2) { for (let i = 0; i < 5; i++) { const sp = cone(0.03, 0.12, 4); sp.rotateX(-0.6); sp.translate(0, 0.32 + i * 0.13, -0.12); K.add(sp, P.gold, MAT.gold); } }
  if (t >= 3) runeRing(K, [0, 0.05, 0], 0.55, 12, P.glw, 2.4);
  return [1.1, 0.6];
}

// ---- Mech-Bausteine -------------------------------------------------------------------------------
function joint(K, p, r, col) { const j = sph(r, 6, 5); T(j, p); K.add(j, col || K.P.gold, MAT.gold); }
function piston(K, a, b, r, col) {
  const A = v3(a), B = v3(b), m = A.clone().lerp(B, 0.55);
  K.add(seg(A, m, r, r, 6, 1), col || K.P.steel, MAT.metal);
  K.add(seg(m.clone().lerp(A, 0.2), B, r * 0.6, r * 0.6, 6, 1), K.P.gold, MAT.gold);
}
function vent(K, p, dir, r, col, k = 3) {
  const g = cyl(r, r, 0.02, 8); aim(g, p, dir); K.glow(g, col, k);
  const rim = tor(r * 1.05, r * 0.2, 4, 10); rim.rotateX(PI / 2); aim(rim, p, dir); K.add(rim, K.P.iron, MAT.dmetal);
}

// ---- Automaton ------------------------------------------------------------------------------------
function automaton(K) {
  const P = K.P, t = K.tier, paint = mix(P.sec, P.pri, 0.25), panel = P.pri, steel = P.met;
  // Beine
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.1 : -0.06;
    const hip = V(0.15 * s, 0.92, 0), knee = V(0.19 * s, 0.52, 0.08 + f * 0.5), ank = V(0.2 * s, 0.14, f);
    K.add(seg(hip, knee, 0.09, 0.075, 8, 2), shade(steel, 0.6), MAT.dmetal);
    piston(K, hip.clone().add(V(0.07 * s, 0, 0.05)), knee.clone().add(V(0.06 * s, 0, 0.06)), 0.025);
    const shin = lathe([[0, 0], [0.09, 0.0], [0.11, 0.12], [0.1, 0.32], [0.075, 0.4], [0, 0.4]], 8); between(shin, ank, knee); K.add(shin, paint, MAT.paint);
    joint(K, knee, 0.08); joint(K, hip, 0.08, steel);
    const ft = rbox(0.17, 0.09, 0.3, 0.03, 1); ft.translate(ank.x, 0.05, ank.z + 0.06); K.add(ft, steel, MAT.metal);
    const toe = box(0.15, 0.06, 0.08); toe.rotateX(0.3); toe.translate(ank.x, 0.07, ank.z + 0.2); K.add(toe, paint, MAT.paint);
  }
  // Becken + Taille
  K.add(rbox(0.38, 0.17, 0.26, 0.05, 1).translate(0, 0.95, 0), steel, MAT.metal);
  K.add(cyl(0.12, 0.14, 0.24, 10).translate(0, 1.12, 0), shade(steel, 0.55), MAT.dmetal);
  for (let i = 0; i < 2; i++) K.add(tor(0.14, 0.022, 4, 12).rotateX(PI / 2).translate(0, 1.06 + i * 0.1, 0), P.gold, MAT.gold);
  // Brustpanzer
  const ch = lathe([[0, 1.18], [0.22, 1.2], [0.3, 1.32], [0.36, 1.48], [0.34, 1.62], [0.22, 1.7], [0, 1.72]], 12); ch.scale(1, 1, 0.78); K.add(ch, paint, MAT.paint);
  const plate = ext(shape([[-0.24, -0.16], [0.24, -0.16], [0.28, 0.08], [0.16, 0.2], [-0.16, 0.2], [-0.28, 0.08]]), 0.03, 0.012, 1); bend(plate, 1.6);
  plate.translate(0, 1.45, 0.24); K.add(plate, panel, MAT.paint);
  // Kern
  const cr = tor(0.09, 0.025, 6, 16); cr.translate(0, 1.46, 0.29); K.add(cr, P.gold, MAT.gold);
  const core = sph(0.075, 12, 8); core.translate(0, 1.46, 0.28); K.glow(core, P.glw, 3.6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const b = box(0.02, 0.05, 0.02); b.translate(0, 0.13, 0); b.rotateZ(a); b.translate(0, 1.46, 0.29); K.add(b, P.gold, MAT.gold); }
  // Kopf
  K.add(cyl(0.06, 0.07, 0.1, 8).translate(0, 1.74, 0), shade(steel, 0.5), MAT.dmetal);
  const hd = lathe([[0, 1.76], [0.12, 1.77], [0.14, 1.84], [0.13, 1.92], [0.08, 1.97], [0, 1.98]], 10); hd.scale(1, 1, 1.1); K.add(hd, paint, MAT.paint);
  const visor = tor(0.135, 0.022, 4, 12, PI * 0.7); visor.rotateX(PI / 2); visor.rotateY(-PI * 0.15); visor.scale(1, 1, 1.12); visor.translate(0, 1.86, 0); K.glow(visor, P.glw, 3.4);
  const ant = cyl(0.008, 0.008, 0.18, 4); ant.translate(0.08, 2.04, -0.04); K.add(ant, steel, MAT.metal); const at = sph(0.02, 6, 4); at.translate(0.08, 2.13, -0.04); K.glow(at, P.glw, 3);
  // Schultern
  for (const s of [1]) {
    const sp = dome(0.17, 0.14, 10, 0.08); R(sp, 0, 0, -0.5); sp.translate(0.38, 1.62, 0); K.sym(sp, paint, MAT.paint);
    const stp = tor(0.15, 0.02, 3, 12, PI); stp.rotateY(PI / 2); R(stp, 0, 0, -0.5); stp.translate(0.4, 1.64, 0); K.sym(stp, P.gold, MAT.gold);
    joint(K, [0.36, 1.56, 0], 0.09, steel); K.body.push(mirrorX(K.body[K.body.length - 1]));
  }
  // Rechter Arm: schwere Faust
  const shR = V(-0.4, 1.52, 0), elR = V(-0.48, 1.2, 0.08), haR = V(-0.44, 0.98, 0.26);
  K.add(seg(shR, elR, 0.07, 0.06, 7, 2), shade(steel, 0.6), MAT.dmetal); joint(K, elR, 0.075);
  const fa = lathe([[0, 0], [0.08, 0.02], [0.11, 0.16], [0.1, 0.26], [0, 0.27]], 8); between(fa, elR, haR); K.add(fa, paint, MAT.paint);
  const fist = rbox(0.16, 0.15, 0.17, 0.04, 1); fist.rotateX(0.5); T(fist, haR.clone().add(V(0, -0.04, 0.05))); K.add(fist, steel, MAT.metal);
  // Linker Arm: Klingenarm
  const shL = V(0.4, 1.52, 0), elL = V(0.5, 1.22, 0.12), haL = V(0.46, 1.1, 0.36);
  K.add(seg(shL, elL, 0.07, 0.06, 7, 2), shade(steel, 0.6), MAT.dmetal); joint(K, elL, 0.075);
  const fl = lathe([[0, 0], [0.08, 0.02], [0.11, 0.16], [0.1, 0.26], [0, 0.27]], 8); between(fl, elL, haL); K.add(fl, paint, MAT.paint);
  const bd = V(0.08, 0.35, 1).normalize(), bl = 0.75 + (t - 1) * 0.08;
  const blade = ext(shape([[-0.05, 0], [0.06, 0], [0.07, bl * 0.7], [0.0, bl], [-0.04, bl * 0.75]]), 0.022, 0.012, 1); aim(blade, haL, bd, PI / 2); K.add(blade, P.steel, MAT.metal);
  const edge = ext(shape([[0.055, 0.04], [0.075, 0.04], [0.085, bl * 0.7], [0.005, bl * 1.02], [0.06, bl * 0.68]]), 0.012, 0, 1); aim(edge, haL, bd, PI / 2); K.glow(edge, P.glw, 2.6 + t * 0.3);
  const hilt = rbox(0.12, 0.08, 0.14, 0.03, 1); T(hilt, haL); K.add(hilt, P.gold, MAT.gold);
  // Rücken: Schornsteine
  for (const s of [1, -1]) { const st = cyl(0.045, 0.055, 0.34, 8); st.rotateX(-0.25); st.translate(0.12 * s, 1.72, -0.24); K.add(st, shade(steel, 0.6), MAT.dmetal); const gl = cyl(0.035, 0.035, 0.02, 8); gl.rotateX(-0.25); gl.translate(0.12 * s, 1.89, -0.28); K.glow(gl, P.glw, 3); }
  if (t >= 2) { for (const s of [1, -1]) { const v = rbox(0.06, 0.12, 0.02, 0.01); v.translate(0.17 * s, 1.3, 0.25); K.glow(v, P.glw, 2.4); } }
  if (t >= 3) { const h = tor(0.22, 0.014, 4, 24); h.rotateX(PI / 2 - 0.25); h.translate(0, 2.12, -0.12); K.glow(h, P.glw, 2.6); }
  return [1.0, 0.62];
}

// ---- Läufer (Vierbein-Mech mit Balliste) ----------------------------------------------------------
function walker(K) {
  const P = K.P, t = K.tier, paint = mix(P.sec, P.pri, 0.25), panel = P.pri, steel = P.met;
  const hy = 1.0;
  // Rumpf
  const hull = lathe([[0, hy - 0.22], [0.3, hy - 0.2], [0.44, hy - 0.08], [0.46, hy + 0.04], [0.38, hy + 0.14], [0, hy + 0.16]], 10); hull.scale(1, 1, 1.15); K.add(hull, paint, MAT.paint);
  const skirt = tor(0.45, 0.03, 4, 16); skirt.rotateX(PI / 2); skirt.scale(1, 1, 1.15); skirt.translate(0, hy - 0.02, 0); K.add(skirt, P.gold, MAT.gold);
  const belly = ell(0.3, 0.12, 0.34, 10, 6); belly.translate(0, hy - 0.2, 0); K.add(belly, shade(steel, 0.55), MAT.dmetal);
  // Sensorkopf vorne
  const head = rbox(0.24, 0.14, 0.18, 0.05, 1); head.translate(0, hy, 0.5); K.add(head, panel, MAT.paint);
  const eye = cyl(0.045, 0.045, 0.03, 10); eye.rotateX(PI / 2); eye.translate(0, hy + 0.01, 0.6); K.glow(eye, P.glw, 3.6);
  for (const s of [1, -1]) { const e = cyl(0.022, 0.022, 0.03, 8); e.rotateX(PI / 2); e.translate(0.08 * s, hy - 0.02, 0.595); K.glow(e, P.glw, 2.6); }
  // Beine (4, insektenartig)
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const hip = V(0.34 * sx, hy - 0.04, 0.3 * sz), kn = V(0.6 * sx, hy + 0.22, 0.5 * sz), ft = V(0.7 * sx, 0.0, 0.62 * sz);
    joint(K, hip, 0.11, steel);
    K.add(shaft(hip, kn, [[0, 0], [0.09, 0.05], [0.12, 0.4], [0.08, 0.95], [0, 1]], 7), paint, MAT.paint);
    const kp = dome(0.1, 0.08, 8, 0.1); aim(kp, kn, kn.clone().sub(hip).normalize().add(V(0, 0.6, 0))); K.add(kp, steel, MAT.metal);
    joint(K, kn, 0.085);
    K.add(shaft(kn, ft.clone().add(V(0, 0.14, 0)), [[0, 0], [0.08, 0.06], [0.09, 0.3], [0.055, 1]], 8), shade(steel, 0.7), MAT.dmetal);
    piston(K, hip.clone().add(V(0, -0.08, 0)), kn.clone().lerp(ft, 0.4), 0.026);
    const foot = lathe([[0, 0], [0.07, 0.02], [0.1, 0.08], [0.06, 0.16], [0, 0.17]], 8); foot.translate(ft.x, 0, ft.z); K.add(foot, steel, MAT.metal);
    const toe = cone(0.03, 0.1, 5); toe.rotateX(PI / 2 + 0.4); toe.translate(ft.x, 0.04, ft.z + 0.09 * sz); K.add(toe, P.gold, MAT.gold);
  }
  // Drehturm + Balliste
  const ty = hy + 0.16;
  K.add(cyl(0.22, 0.26, 0.1, 12).translate(0, ty + 0.05, -0.02), shade(steel, 0.6), MAT.dmetal);
  K.add(tor(0.24, 0.02, 4, 16).rotateX(PI / 2).translate(0, ty + 0.1, -0.02), P.gold, MAT.gold);
  const body = rbox(0.16, 0.12, 0.8, 0.04, 1); body.rotateX(-0.12); body.translate(0, ty + 0.22, 0.05); K.add(body, P.wood, MAT.wood);
  const bz = 0.38;
  for (const s of [1, -1]) {
    const limb = sweep([[0.06 * s, ty + 0.28, bz], [0.32 * s, ty + 0.3, bz - 0.06], [0.52 * s, ty + 0.28, bz - 0.24]], (u) => 0.04 * (1 - u * 0.5), 6, 10, { fx: 0.6 });
    K.add(limb, steel, MAT.metal);
    const tip = sph(0.03, 6, 5); tip.translate(0.52 * s, ty + 0.28, bz - 0.24); K.add(tip, P.gold, MAT.gold);
    K.add(seg([0.52 * s, ty + 0.28, bz - 0.24], [0, ty + 0.3, -0.18], 0.006, 0.006, 4, 1), P.white, MAT.cloth);
  }
  const bolt = cyl(0.018, 0.018, 0.85, 5); bolt.rotateX(PI / 2 - 0.12); bolt.translate(0, ty + 0.31, 0.12); K.add(bolt, P.wood, MAT.wood);
  const bh = cone(0.04, 0.14, 6); bh.rotateX(PI / 2 - 0.12); bh.translate(0, ty + 0.36, 0.6); K.glow(bh, P.glw, 3.2);
  // Munitionsköcher
  for (const s of [1, -1]) { const q = cyl(0.07, 0.07, 0.3, 8); q.rotateX(PI / 2); q.translate(0.3 * s, hy + 0.12, -0.32); K.add(q, P.leather, MAT.leather); for (let i = 0; i < 3; i++) { const b = cone(0.02, 0.08, 4); b.rotateX(-PI / 2); b.translate(0.3 * s + (i - 1) * 0.03, hy + 0.12, -0.5); K.glow(b, P.glw, 2.2); } }
  if (t >= 2) for (const s of [1, -1]) { const pl = dome(0.14, 0.06, 8, 0.1); R(pl, 0, 0, -s * 1.2); pl.translate(0.45 * s, hy + 0.02, 0); K.add(pl, steel, MAT.metal); }
  if (t >= 3) runeRing(K, [0, hy + 0.06, 0], 0.5, 14, P.glw, 2.4, [PI / 2, 0, 0]);
  return [1.15, 0.85];
}

// ---- Mörser-Mech ----------------------------------------------------------------------------------
function mortar(K) {
  const P = K.P, t = K.tier, paint = mix(P.sec, P.pri, 0.25), panel = P.pri, steel = P.met;
  // Stummelbeine
  for (const s of [1, -1]) {
    const hip = V(0.3 * s, 0.6, 0), kn = V(0.4 * s, 0.38, 0.12), ft = V(0.38 * s, 0.08, 0.04);
    joint(K, hip, 0.12, steel);
    K.add(seg(hip, kn, 0.13, 0.1, 8, 2), paint, MAT.paint); joint(K, kn, 0.1);
    K.add(seg(kn, ft, 0.1, 0.09, 8, 2), shade(steel, 0.6), MAT.dmetal);
    const foot = rbox(0.26, 0.12, 0.38, 0.05, 1); foot.translate(ft.x, 0.06, ft.z + 0.04); K.add(foot, steel, MAT.metal);
    const toe = rbox(0.22, 0.07, 0.1, 0.03, 1); toe.translate(ft.x, 0.06, ft.z + 0.26); K.add(toe, paint, MAT.paint);
  }
  // Rumpf (breit, gedrungen)
  const hull = rbox(0.78, 0.5, 0.62, 0.16, 2); hull.translate(0, 0.85, 0); K.add(hull, paint, MAT.paint);
  const fr = ext(shape([[-0.3, -0.18], [0.3, -0.18], [0.34, 0.1], [0.22, 0.2], [-0.22, 0.2], [-0.34, 0.1]]), 0.04, 0.015, 1); bend(fr, 0.8); fr.translate(0, 0.86, 0.32); K.add(fr, panel, MAT.paint);
  const bar = tor(0.4, 0.03, 4, 16); bar.rotateX(PI / 2); bar.scale(1.05, 1, 0.85); bar.translate(0, 0.62, 0); K.add(bar, P.gold, MAT.gold);
  // Kanzel/Auge
  const eyeH = dome(0.14, 0.1, 10, 0.1); eyeH.rotateX(PI / 2); eyeH.translate(0, 0.95, 0.36); K.add(eyeH, steel, MAT.metal);
  const eye = sph(0.07, 10, 8); eye.scale(1, 0.55, 1); eye.translate(0, 0.96, 0.44); K.glow(eye, P.glw, 3.6);
  for (const s of [1, -1]) { const lp = cyl(0.03, 0.03, 0.02, 8); lp.rotateX(PI / 2); lp.translate(0.22 * s, 0.82, 0.355); K.glow(lp, P.glw, 2.4); }
  // Großes Rohr auf dem Rücken
  const bb = V(0, 1.05, -0.12), bdir = V(0, 0.75, 0.55).normalize(), L = 1.0 + (t - 1) * 0.08;
  const mount = cyl(0.2, 0.2, 0.5, 10); mount.rotateZ(PI / 2); mount.translate(0, 1.12, -0.1); K.add(mount, shade(steel, 0.6), MAT.dmetal);
  for (const s of [1, -1]) { const c = cyl(0.21, 0.21, 0.04, 12); c.rotateZ(PI / 2); c.translate(0.23 * s, 1.12, -0.1); K.add(c, P.gold, MAT.gold); }
  const barrel = lathe([[0, -0.2], [0.17, -0.2], [0.19, 0.0], [0.16, 0.3], [0.14, L * 0.8], [0.17, L * 0.86], [0.21, L], [0.14, L + 0.02], [0.12, L - 0.1]], 14);
  aim(barrel, bb, bdir); K.add(barrel, steel, MAT.metal);
  for (const k of [0.05, 0.42]) { const r = tor(0.18, 0.035, 4, 14); r.rotateX(PI / 2); r.translate(0, k * L + 0.05, 0); aim(r, bb, bdir); K.add(r, k > 0.3 ? P.gold : paint, k > 0.3 ? MAT.gold : MAT.paint); }
  const muz = cyl(0.12, 0.12, 0.02, 12); muz.translate(0, L - 0.08, 0); aim(muz, bb, bdir); K.glow(muz, P.glw, 3.4);
  // Munitions-Granaten an der Seite
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const sh = lathe([[0, 0], [0.05, 0], [0.05, 0.12], [0.03, 0.18], [0, 0.2]], 8); sh.translate(0.42 * s, 0.68, -0.18 + i * 0.12); K.add(sh, i === 1 ? P.gold : shade(steel, 0.7), MAT.metal);
    const gl = tor(0.05, 0.008, 3, 8); gl.rotateX(PI / 2); gl.translate(0.42 * s, 0.76, -0.18 + i * 0.12); K.glow(gl, P.glw, 2.2);
  }
  // Abgasrohre
  for (const s of [1, -1]) { const p = cyl(0.04, 0.05, 0.25, 8); p.translate(0.26 * s, 1.16, -0.3); K.add(p, shade(steel, 0.5), MAT.dmetal); vent(K, V(0.26 * s, 1.29, -0.3), V(0, 1, 0), 0.035, P.glw, 2.6); }
  if (t >= 2) { const sh = ext(shape([[-0.26, 0], [0.26, 0], [0.2, 0.22], [-0.2, 0.22]]), 0.03, 0.012, 1); R(sh, -0.3, 0, 0); sh.translate(0, 1.1, 0.3); K.add(sh, steel, MAT.metal); }
  if (t >= 3) runeRing(K, [0, 0.03, 0], 0.62, 14, P.glw, 2.4);
  return [1.05, 0.72];
}

// ---- Kristallkern (schwebend) ---------------------------------------------------------------------
function core(K) {
  const P = K.P, t = K.tier, lift = 0.45;
  const c = V(0, 0.85 + lift, 0);
  // Hauptkristall: Hülle (Körper) + leuchtender Kern
  const cc = shade(mix(P.glw, P.sec, 0.3), 0.75);
  const shell = crystal(0.24, 0.85, 6); shell.translate(c.x, c.y - 0.3, c.z); K.add(shell, cc, MAT.crystal);
  const inner = crystal(0.15, 0.6, 6); inner.translate(c.x, c.y - 0.2, c.z); K.glow(inner, P.glw, 2.6);
  const lower = crystal(0.18, 0.4, 6); lower.rotateX(PI); lower.translate(c.x, c.y - 0.34, c.z); K.add(lower, shade(cc, 0.8), MAT.crystal);
  // Goldene Klammern
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const cl = sweep([V(Math.cos(a) * 0.12, c.y - 0.55, Math.sin(a) * 0.12), V(Math.cos(a) * 0.3, c.y - 0.35, Math.sin(a) * 0.3), V(Math.cos(a) * 0.3, c.y, Math.sin(a) * 0.3), V(Math.cos(a) * 0.22, c.y + 0.18, Math.sin(a) * 0.22)], (u) => 0.035 * (1 - u * 0.6), 6, 10);
    K.add(cl, P.gold, MAT.gold);
    const g = sph(0.035, 6, 5); g.translate(Math.cos(a) * 0.31, c.y - 0.18, Math.sin(a) * 0.31); K.glow(g, P.glw, 3.2);
  }
  // Orbit-Ringe
  const rings = [[0.55, 0.035, 0.5, 0.2], [0.68, 0.025, -0.4, 0.9]];
  if (t >= 2) rings.push([0.8, 0.02, 1.1, -0.5]);
  rings.forEach(([rr, th, rx, rz], i) => {
    const ring = tor(rr, th, 4, 36); ring.rotateX(PI / 2 + rx); ring.rotateZ(rz); T(ring, c); K.add(ring, i === 0 ? P.gold : P.met, MAT.gold);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + i; const r = box(0.05, 0.035, 0.035); r.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr); r.rotateX(rx); r.rotateZ(rz); T(r, c); K.glow(r, P.glw, 3); }
  });
  // Schwebende Splitter
  const ns = 5 + t * 2;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * TAU + 0.3, r = 0.42 + (i % 2) * 0.12;
    const s = crystal(0.045, 0.16 + (i % 3) * 0.04, 5); R(s, (i % 2) * 0.4, a, 0.3); s.translate(Math.cos(a) * r, c.y - 0.15 + Math.sin(i * 2.1) * 0.25, Math.sin(a) * r);
    K.add(s, cc, MAT.crystal);
  }
  // Boden-Glyphe
  runeRing(K, [0, 0.05, 0], 0.4, 10, P.glw, 2.2);
  const halo = tor(0.3, 0.015, 4, 28); halo.rotateX(PI / 2); halo.translate(0, 0.05, 0); K.glow(halo, P.glw, 2.4);
  if (t >= 3) { const cr = crystal(0.08, 0.3, 6); cr.translate(c.x, c.y + 0.55, c.z); K.glow(cr, P.glw, 3); }
  return [1.0, 0.6, 0.4];
}

// ---- Tesla-Spinne ---------------------------------------------------------------------------------
function spider(K) {
  const P = K.P, t = K.tier, paint = mix(P.sec, P.pri, 0.25), panel = P.pri, steel = P.met, by = 0.6;
  // Hinterleib + Kopfbrust
  const ab = lathe([[0, -0.3], [0.22, -0.26], [0.34, -0.08], [0.36, 0.08], [0.28, 0.24], [0, 0.3]], 11); ab.rotateX(PI / 2 + 0.25); ab.scale(1, 0.8, 1.1); ab.translate(0, by + 0.12, -0.38); K.add(ab, paint, MAT.paint);
  for (let i = 0; i < 3; i++) { const b = tor(0.3 - Math.abs(i - 1) * 0.06, 0.02, 3, 10); b.scale(1, 0.8, 1); R(b, 0.25, 0, 0); b.translate(0, by + 0.12 + i * 0.0, -0.38 - (i - 1) * 0.18); K.add(b, P.gold, MAT.gold); }
  const th = ell(0.24, 0.16, 0.26, 12, 8); th.translate(0, by, 0.12); K.add(th, panel, MAT.paint);
  const tp = dome(0.2, 0.08, 10, 0.08); tp.scale(1.1, 1, 1.3); tp.translate(0, by + 0.1, 0.12); K.add(tp, paint, MAT.paint);
  // Kopf mit Augen-Cluster + Beißzangen
  const hc = V(0, by + 0.02, 0.4);
  const hd = rbox(0.24, 0.16, 0.16, 0.06, 1); T(hd, hc); K.add(hd, steel, MAT.metal);
  const eyesP = [[0.05, 0.04, 0.08, 0.03], [-0.05, 0.04, 0.08, 0.03], [0.1, 0.0, 0.07, 0.02], [-0.1, 0.0, 0.07, 0.02], [0.03, -0.03, 0.085, 0.018], [-0.03, -0.03, 0.085, 0.018]];
  for (const [x, y, z, r] of eyesP) { const e = sph(r, 6, 5); e.translate(hc.x + x, hc.y + y, hc.z + z); K.glow(e, P.glw, 3.6); }
  for (const s of [1]) K.sym(sweep([hc.clone().add(V(0.06, -0.06, 0.06)), hc.clone().add(V(0.1, -0.14, 0.14)), hc.clone().add(V(0.04, -0.2, 0.2))], (u) => 0.025 * (1 - u * 0.8), 5, 6), P.gold, MAT.gold);
  // 8 Beine
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const z = 0.28 - i * 0.16, spread = (1.5 - i) * 0.35;
    const a = V(0.18 * s, by, z), b = V(0.46 * s, by + 0.3, z + spread * 0.4), c = V(0.7 * s, by - 0.12, z + spread * 0.8), d = V(0.76 * s, 0.0, z + spread * 0.92);
    joint(K, a, 0.06, steel);
    bugLeg(K, [a, b, c, d], 0.065, paint, MAT.paint, P.gold, shade(steel, 0.75));
  }
  // Teslaspule auf dem Rücken
  const tb = V(0, by + 0.38, -0.4);
  K.add(cyl(0.12, 0.16, 0.1, 10).translate(tb.x, tb.y, tb.z), shade(steel, 0.6), MAT.dmetal);
  K.add(cyl(0.035, 0.05, 0.5, 8).translate(tb.x, tb.y + 0.28, tb.z), steel, MAT.metal);
  const coils = 4 + (t - 1);
  for (let i = 0; i < coils; i++) { const r = tor(0.1 - i * 0.012, 0.025, 3, 10); r.rotateX(PI / 2); r.translate(tb.x, tb.y + 0.1 + i * 0.09, tb.z); K.add(r, i % 2 ? P.gold : shade(P.gold, 0.7), MAT.gold); }
  const top = tor(0.13, 0.04, 4, 12); top.rotateX(PI / 2); top.translate(tb.x, tb.y + 0.58, tb.z); K.add(top, steel, MAT.metal);
  const orb = sph(0.09 + t * 0.012, 10, 8); orb.translate(tb.x, tb.y + 0.62, tb.z); K.glow(orb, P.glw, 3.6);
  // Blitzbögen
  for (let i = 0; i < 3 + t; i++) {
    const a = (i / (3 + t)) * TAU, pts = [V(tb.x, tb.y + 0.62, tb.z)];
    for (let k = 1; k <= 4; k++) pts.push(V(tb.x + Math.cos(a) * k * 0.06 + Math.sin(k * 3 + i) * 0.03, tb.y + 0.62 - k * 0.05 + Math.cos(k * 5 + i) * 0.03, tb.z + Math.sin(a) * k * 0.06));
    K.glow(sweep(pts, (u) => 0.01 * (1 - u * 0.7), 4, 8), P.glw, 3);
  }
  return [1.05, 0.8];
}

// ---- Knochenwerfer --------------------------------------------------------------------------------
function bonethrower(K) {
  const P = K.P, t = K.tier, bone = P.bone, lean = 0.45;
  // Beine (Knochen)
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.14 : -0.08;
    const hip = V(0.16 * s, 0.82, -0.05), kn = V(0.22 * s, 0.46, 0.12 + f * 0.4), an = V(0.22 * s, 0.1, f);
    K.add(seg(hip, kn, 0.06, 0.05, 6, 1), bone, MAT.bone); K.add(seg(kn, an, 0.05, 0.045, 6, 1), bone, MAT.bone);
    joint(K, kn, 0.07, shade(bone, 0.9));
    const ft = ell(0.08, 0.05, 0.15, 7, 5); ft.translate(an.x, 0.05, an.z + 0.06); K.add(ft, bone, MAT.bone);
  }
  // Becken
  const pel = ell(0.2, 0.1, 0.13, 10, 6); pel.translate(0, 0.86, -0.04); K.add(pel, bone, MAT.bone);
  // Wirbelsäule (gekrümmt nach vorne)
  const spine = [V(0, 0.88, -0.08), V(0, 1.15, -0.12), V(0, 1.38, 0.0), V(0, 1.52, 0.2)];
  K.add(sweep(spine, [0.045, 0.04], 5, 9), bone, MAT.bone);
  for (let i = 0; i < 4; i++) { const p = new THREE.CatmullRomCurve3(spine).getPointAt(0.15 + i * 0.2); const v = sph(0.055, 6, 3); v.scale(1, 0.6, 1); T(v, p); K.add(v, shade(bone, 0.85), MAT.bone); }
  // Brustkorb
  const rc = V(0, 1.28, 0.06);
  for (let i = 0; i < 4; i++) {
    const r = tor(0.24 - Math.abs(i - 1.2) * 0.03, 0.028, 3, 6, PI * 0.8);
    r.rotateX(PI / 2); r.rotateY(PI / 2 + PI * 0.1); r.scale(1, 1, 0.85);
    Rp(r, [0, 0, 0], lean * 0.6, 0, 0);
    r.translate(rc.x, rc.y + 0.12 - i * 0.09, rc.z - 0.04 + i * 0.03); K.sym(r, bone, MAT.bone);
  }
  const ster = box(0.05, 0.3, 0.04); R(ster, lean * 0.6, 0, 0); ster.translate(0, 1.22, 0.27); K.add(ster, shade(bone, 0.9), MAT.bone);
  const soul = sph(0.09, 8, 6); soul.translate(0, 1.22, 0.08); K.glow(soul, P.glw, 2.6);
  // Rostiger Schulterpanzer + Lumpen
  pauldron(K, [0.3, 1.52, 0.12], 0.15, P.met, null, { layers: 2, tilt: 0.7, spikes: t >= 2 ? 2 : 0, mat: MAT.dmetal, spikeCol: P.bone, spikeMat: MAT.bone });
  const rag = robe(K, [[0, 0.98], [0.22, 0.96], [0.26, 0.8], [0.3, 0.55], [0, 0.56]], P.pri, { seg: 10, fold: 0.18, folds: 5, tatter: 0.14, tears: 5 });
  // Schädel
  const hc = V(0, 1.55, 0.36);
  const sk = blob(0.13, 4, 0.04, 10, 7); sk.scale(1, 0.95, 1.1); T(sk, hc); K.add(sk, bone, MAT.bone);
  const jaw = ell(0.1, 0.05, 0.09, 8, 5); jaw.translate(hc.x, hc.y - 0.11, hc.z + 0.05); K.add(jaw, shade(bone, 0.9), MAT.bone);
  for (const s of [1, -1]) { const so = sph(0.04, 6, 5); so.scale(1, 0.8, 0.5); so.translate(0.05 * s, hc.y + 0.01, hc.z + 0.11); K.add(so, P.dark, MAT.bone); }
  eyes(K, [0, hc.y + 0.01, hc.z + 0.13], 0.05, 0.02, P.glw, 4, 0.8);
  for (let i = 0; i < 4; i++) { const tth = box(0.018, 0.03, 0.02); tth.translate(hc.x + (i - 1.5) * 0.025, hc.y - 0.07, hc.z + 0.12); K.add(tth, P.white, MAT.bone); }
  horn(K, hc.clone().add(V(0.08, 0.08, -0.04)), [hc.clone().add(V(0.16, 0.14, -0.12)), hc.clone().add(V(0.2, 0.26, -0.16))], 0.03, shade(bone, 0.7), MAT.bone);
  // Linker Arm: lang, stützt sich auf
  const shL = V(0.28, 1.45, 0.18), elL = V(0.42, 1.05, 0.25), haL = V(0.42, 0.62, 0.4);
  K.add(seg(shL, elL, 0.05, 0.04, 6, 2), bone, MAT.bone); K.add(seg(elL, haL, 0.04, 0.035, 6, 2), bone, MAT.bone); joint(K, elL, 0.055, shade(bone, 0.9));
  for (let i = 0; i < 3; i++) K.add(sweep([haL, haL.clone().add(V((i - 1) * 0.04, -0.08, 0.04)), haL.clone().add(V((i - 1) * 0.05, -0.16, 0.1))], (u) => 0.018 * (1 - u * 0.7), 4, 3), bone, MAT.bone);
  // Rechter Arm: Katapult-Arm über die Schulter
  const shR = V(-0.28, 1.45, 0.18), elR = V(-0.42, 1.65, -0.05);
  K.add(seg(shR, elR, 0.06, 0.05, 6, 2), bone, MAT.bone); joint(K, elR, 0.06, shade(bone, 0.9));
  const beamEnd = V(-0.36, 2.05, -0.5);
  K.add(sweep([elR, elR.clone().lerp(beamEnd, 0.5).add(V(0, 0.05, 0)), beamEnd], [0.06, 0.05], 7, 8), P.wood, MAT.wood);
  for (const k of [0.25, 0.6]) { const b = tor(0.065, 0.016, 3, 8); b.rotateX(PI / 2); aim(b, elR.clone().lerp(beamEnd, k), beamEnd.clone().sub(elR)); K.add(b, P.met, MAT.dmetal); }
  const cup = lathe([[0, -0.02], [0.14, 0.0], [0.17, 0.08], [0.15, 0.09], [0.12, 0.03], [0, 0.03]], 10); R(cup, -0.6, 0, 0); T(cup, beamEnd); K.add(cup, P.wood, MAT.wood);
  // Geladener Knochenhaufen + Schädel
  const ammo = sph(0.08, 8, 6); ammo.scale(1, 0.9, 1.05); T(ammo, beamEnd.clone().add(V(0, 0.08, 0.04))); K.add(ammo, bone, MAT.bone);
  const ag = sph(0.04, 6, 4); T(ag, beamEnd.clone().add(V(0, 0.09, 0.11))); K.glow(ag, P.glw, 3);
  // Knochenhaufen am Boden (Korb)
  const pile = V(0.38, 0, -0.32);
  const basket = lathe([[0, 0.0], [0.2, 0.0], [0.24, 0.18], [0.22, 0.2], [0.18, 0.04], [0, 0.04]], 10); T(basket, pile); K.add(basket, P.wood, MAT.wood);
  for (let i = 0; i < 4; i++) { const a = i * 1.7; const b = seg([pile.x + Math.cos(a) * 0.12, 0.2 + (i % 2) * 0.05, pile.z + Math.sin(a) * 0.1], [pile.x - Math.cos(a) * 0.1, 0.24, pile.z - Math.sin(a) * 0.12 + 0.04], 0.024, 0.024, 4, 1); K.add(b, bone, MAT.bone); }
  const s2 = sph(0.07, 7, 5); s2.translate(pile.x, 0.3, pile.z); K.add(s2, bone, MAT.bone);
  if (t >= 3) { const c = tor(0.16, 0.012, 3, 18); c.rotateX(PI / 2); c.translate(hc.x, hc.y + 0.24, hc.z - 0.04); K.glow(c, P.glw, 3); }
  return [1.1, 0.62];
}

// ---- Gruft-Golem (genähter Knochen-Koloss) --------------------------------------------------------
function cryptgolem(K) {
  const P = K.P, t = K.tier, flesh = mix('#76806a', P.pri, 0.3), bone = P.bone;
  // Beine
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.12 : -0.06;
    K.add(seg([0.24 * s, 0.85, 0], [0.3 * s, 0.45, 0.06 + f * 0.5], 0.18, 0.15, 8, 2), flesh, MAT.skin);
    K.add(seg([0.3 * s, 0.45, 0.06 + f * 0.5], [0.3 * s, 0.12, f], 0.15, 0.13, 8, 2), shade(flesh, 0.9), MAT.skin);
    const ft = blob(0.15, 3 + s, 0.08, 8, 6); ft.scale(1, 0.55, 1.3); ft.translate(0.3 * s, 0.07, f + 0.06); K.add(ft, shade(flesh, 0.8), MAT.skin);
    const shin = ext(shape([[-0.1, 0], [0.1, 0], [0.08, 0.28], [-0.08, 0.28]]), 0.03, 0.012, 1); bend(shin, 3); shin.translate(0.3 * s, 0.18, f + 0.12); K.add(shin, P.met, MAT.dmetal);
  }
  // Massiger, buckliger Rumpf
  const belly = blob(0.42, 2, 0.08); belly.scale(1.05, 0.9, 0.9); belly.translate(0, 1.05, 0.05); K.add(belly, flesh, MAT.skin);
  const ch = blob(0.5, 3, 0.07); ch.scale(1.15, 0.85, 0.9); ch.translate(0, 1.45, 0.0); K.add(ch, mix(flesh, P.sec, 0.25), MAT.skin);
  const hump = blob(0.36, 4, 0.1); hump.translate(0.05, 1.78, -0.18); K.add(hump, flesh, MAT.skin);
  // Nähte (dunkle Stiche)
  const seams = [[[-0.3, 1.5, 0.36], [0.1, 1.2, 0.42], [0.35, 1.0, 0.34]], [[-0.1, 1.85, 0.2], [-0.2, 1.6, 0.4]]];
  for (const sm of seams) {
    const crv = new THREE.CatmullRomCurve3(sm.map(v3));
    K.add(sweep(sm, [0.012, 0.012], 4, 10), P.dark, MAT.leather);
    for (let i = 0; i <= 6; i++) { const p = crv.getPointAt(i / 6), tg = crv.getTangentAt(i / 6); const st = box(0.014, 0.1, 0.014); aim(st, p.clone().sub(tg.clone().cross(V(0, 0, 1)).normalize().multiplyScalar(0.05)), tg.clone().cross(V(0, 0, 1))); K.add(st, P.dark, MAT.leather); }
  }
  // Genagelte Platten + Ketten
  const pl = rbox(0.3, 0.26, 0.05, 0.02, 1); pl.rotateZ(0.2); pl.rotateX(-0.25); pl.translate(0.22, 1.55, 0.4); K.add(pl, P.met, MAT.dmetal);
  for (const [x, y] of [[0.1, 1.64], [0.33, 1.68], [0.12, 1.43], [0.34, 1.47]]) { const n = sph(0.022, 5, 4); n.translate(x, y, 0.43); K.add(n, P.gold, MAT.gold); }
  // Knochen-Stacheln aus dem Rücken
  const nsp = 5 + (t - 1) * 2;
  for (let i = 0; i < nsp; i++) { const a = (i / nsp) * PI - PI / 2; K.add(sweep([V(Math.sin(a) * 0.3, 1.8 + Math.cos(a) * 0.12, -0.28), V(Math.sin(a) * 0.42, 2.05 + Math.cos(a) * 0.14, -0.42), V(Math.sin(a) * 0.48, 2.22 + Math.cos(a) * 0.1, -0.6)], (u) => 0.05 * (1 - u * 0.9), 5, 6), bone, MAT.bone); }
  // Kopf (klein, eingesunken)
  const hc = V(0, 1.82, 0.34);
  const hd = blob(0.15, 6, 0.08, 9, 7); T(hd, hc); K.add(hd, shade(flesh, 0.95), MAT.skin);
  const jaw = ell(0.13, 0.06, 0.1, 8, 5); jaw.translate(hc.x, hc.y - 0.11, hc.z + 0.04); K.add(jaw, bone, MAT.bone);
  for (let i = 0; i < 4; i++) { const tt = cone(0.012, 0.05, 4); tt.translate(hc.x + (i - 1.5) * 0.03, hc.y - 0.06, hc.z + 0.12); K.add(tt, P.white, MAT.bone); }
  eyes(K, [0, hc.y + 0.03, hc.z + 0.13], 0.055, 0.025, P.glw, 4, 0.7);
  // Arme: links riesige Knochenkeule-Faust, rechts Haken/Hackbeil
  const shL = V(0.6, 1.62, 0), elL = V(0.78, 1.15, 0.12), haL = V(0.72, 0.62, 0.3);
  K.add(seg(shL, elL, 0.2, 0.17, 8, 2), flesh, MAT.skin); K.add(seg(elL, haL, 0.19, 0.16, 8, 2), mix(flesh, P.sec, 0.3), MAT.skin);
  const fist = blob(0.21, 8, 0.1, 9, 7); T(fist, haL); K.add(fist, shade(flesh, 0.9), MAT.skin);
  for (let i = 0; i < 3; i++) { const sp = cone(0.04, 0.16, 5); aim(sp, haL.clone().add(V((i - 1) * 0.1, 0.05, 0.16)), V((i - 1) * 0.3, 0.2, 1)); K.add(sp, bone, MAT.bone); }
  const shR = V(-0.6, 1.62, 0), elR = V(-0.76, 1.2, 0.1), haR = V(-0.66, 0.85, 0.32);
  K.add(seg(shR, elR, 0.17, 0.15, 8, 2), flesh, MAT.skin); K.add(seg(elR, haR, 0.15, 0.13, 8, 2), flesh, MAT.skin);
  const hand = blob(0.14, 9, 0.06, 8, 6); T(hand, haR); K.add(hand, shade(flesh, 0.9), MAT.skin);
  const cd = V(0, 0.2, 1).normalize();
  const cleaver = ext(shape([[-0.04, 0], [0.04, 0], [0.05, 0.25], [0.24, 0.3], [0.26, 0.72], [-0.02, 0.78], [-0.05, 0.25]]), 0.03, 0.012, 1);
  aim(cleaver, haR, V(-0.05, 0.3, 1).normalize(), -PI / 2); K.add(cleaver, P.met, MAT.dmetal);
  const ce = box(0.02, 0.4, 0.04); ce.translate(0.255, 0.5, 0); aim(ce, haR, V(-0.05, 0.3, 1).normalize(), -PI / 2); K.glow(ce, P.glw, 2.2 + t * 0.3);
  // Schulterknochen + Glow-Phiole auf dem Rücken
  pauldron(K, [0.58, 1.78, 0], 0.22, P.bone, null, { layers: 1, tilt: 0.6, spikes: 2, mat: MAT.bone });
  const vial = lathe([[0, 0], [0.09, 0.02], [0.1, 0.18], [0.04, 0.24], [0.04, 0.3], [0, 0.31]], 8); vial.rotateX(-0.3); vial.translate(-0.2, 1.7, -0.42); K.glow(vial, P.glw, 2.8);
  const vr = tor(0.1, 0.02, 4, 10); vr.rotateX(PI / 2 - 0.3); vr.translate(-0.2, 1.75, -0.44); K.add(vr, P.iron, MAT.dmetal);
  // Glühende Brustrune
  K.glow(ext(starShape(0.08, 0.03, 5), 0.01, 0.004, 1).rotateX(-0.2).translate(-0.18, 1.48, 0.45), P.glw, 2.6);
  if (t >= 3) runeRing(K, [0, 0.05, 0], 0.85, 14, P.glw, 2.4);
  return [1.18, 0.88];
}

// ---- Fels-Elementar -------------------------------------------------------------------------------
function elemental(K) {
  const P = K.P, t = K.tier, rc = P.pri, lava = P.glw;
  // Kern + Brustfelsen
  const ch = ell(0.36, 0.34, 0.3, 12, 8); ch.translate(0, 1.45, 0); K.glow(ch, lava, 2.2);
  rockShell(K, [0, 1.45, 0], 0.42, 0.4, 0.34, 16, rc, { size: 0.6, seed: 11 });
  const sh = rock(0.3, 2, 1, 0.2); sh.scale(1.6, 0.8, 1); sh.translate(0, 1.82, -0.05); K.add(sh, shade(rc, 0.9), MAT.rock);
  // Kopf in den Schultern
  const hc = V(0, 1.92, 0.2);
  const hd = rock(0.16, 4, 1, 0.15); hd.scale(1.1, 0.9, 1); T(hd, hc); K.add(hd, shade(rc, 1.1), MAT.rock);
  const brow = rock(0.1, 5, 0, 0.1); brow.scale(2.2, 0.5, 0.8); brow.translate(hc.x, hc.y + 0.06, hc.z + 0.1); K.add(brow, shade(rc, 0.8), MAT.rock);
  eyes(K, [0, hc.y, hc.z + 0.14], 0.07, 0.03, lava, 4, 0.5);
  // Schwebender Unterkörper (kleiner werdende Steine)
  const low = [[0, 1.05, 0, 0.28], [0.05, 0.75, 0.02, 0.2], [-0.04, 0.5, 0, 0.14], [0.02, 0.3, 0.02, 0.09]];
  low.forEach(([x, y, z, r], i) => { const g = rock(r, 20 + i, 1, 0.22); g.translate(x, y, z); K.add(g, shade(rc, 0.9 - i * 0.05), MAT.rock); const gl = sph(r * 0.45, 6, 4); gl.translate(x, y + r * 0.9, z); K.glow(gl, lava, 2.6); });
  K.glow(sweep([V(0, 0.95, 0), V(0.05, 0.6, 0.02), V(-0.02, 0.3, 0), V(0, 0.12, 0)], (u) => 0.08 * (1 - u * 0.8), 6, 10), lava, 2.4);
  // Arme aus schwebenden Felsen
  for (const s of [1, -1]) {
    const pts = [V(0.55 * s, 1.68, 0), V(0.72 * s, 1.36, 0.08), V(0.78 * s, 1.0, 0.2)];
    pts.forEach((p, i) => { const g = rock(0.17 - i * 0.02, 30 + i + s, 1, 0.2); g.scale(1, 1.2, 1); T(g, p); K.add(g, shade(rc, 0.95), MAT.rock); });
    const fist = rock(0.25, 40 + s, 1, 0.22); fist.translate(0.8 * s, 0.68, 0.3); K.add(fist, shade(rc, 1.05), MAT.rock);
    for (let i = 0; i < 3; i++) { const j = sph(0.05, 6, 4); T(j, pts[i].clone().lerp(i < 2 ? pts[i + 1] : V(0.8 * s, 0.68, 0.3), 0.5)); K.glow(j, lava, 3); }
    const sp = crystal(0.06, 0.25, 5); R(sp, 0, 0, -s * 0.5); sp.translate(0.5 * s, 1.95, -0.05); K.add(sp, P.sec, MAT.crystal);
  }
  // Umkreisende Steine
  const ns = 4 + t * 2;
  for (let i = 0; i < ns; i++) { const a = (i / ns) * TAU, r = 0.75; const g = rock(0.07 + (i % 3) * 0.02, 50 + i, 0, 0.25); g.translate(Math.cos(a) * r, 0.6 + Math.sin(a * 2) * 0.25 + (i % 2) * 0.4, Math.sin(a) * r); K.add(g, rc, MAT.rock); }
  if (t >= 2) { for (let i = 0; i < 3; i++) { const c = crystal(0.07, 0.3 - i * 0.05, 5); R(c, -0.5, (i - 1) * 0.6, 0); c.translate((i - 1) * 0.18, 1.98, -0.25); K.glow(c, lava, 2.6); } }
  return [1.0, 0.75, 0.7];
}

// ---- Kristall-Golem -------------------------------------------------------------------------------
function golem(K) {
  const P = K.P, t = K.tier, stone = mix(P.pri, '#5f6472', 0.55), cry = shade(mix(P.glw, P.sec, 0.4), 0.8);
  const cluster = (p, n, s, dir) => {
    for (let i = 0; i < n; i++) {
      const c = crystal(0.07 * s * (1 - i * 0.12), 0.38 * s * (1 - i * 0.15), 6);
      const d = v3(dir).normalize().add(V(Math.sin(i * 2.3) * 0.5, 0, Math.cos(i * 2.3) * 0.5)).normalize();
      c.applyQuaternion(qY(d)); T(c, v3(p).add(V(Math.sin(i * 2.3) * 0.06 * s, 0, Math.cos(i * 2.3) * 0.06 * s)));
      K.add(c, i % 2 ? shade(cry, 1.2) : cry, MAT.crystal);
      if (i === 0) { const g = crystal(0.035 * s, 0.25 * s, 6); g.applyQuaternion(qY(d)); T(g, v3(p)); K.glow(g, P.glw, 2.4); }
    }
  };
  // Beine
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.1 : -0.05;
    const th = rock(0.2, 1 + s, 1, 0.15); th.scale(1, 1.3, 1); th.translate(0.25 * s, 0.7, f * 0.5); K.add(th, stone, MAT.rock);
    const sh = rock(0.17, 3 + s, 1, 0.15); sh.scale(1, 1.25, 1); sh.translate(0.27 * s, 0.32, f); K.add(sh, shade(stone, 0.9), MAT.rock);
    const ft = rock(0.17, 5 + s, 1, 0.12); ft.scale(1.1, 0.5, 1.3); ft.translate(0.27 * s, 0.08, f + 0.05); K.add(ft, shade(stone, 0.8), MAT.rock);
    const kn = crystal(0.05, 0.18, 5); R(kn, 1.2, 0, 0); kn.translate(0.27 * s, 0.52, f + 0.12); K.add(kn, cry, MAT.crystal);
  }
  // Rumpf
  const pel = rock(0.26, 7, 1, 0.12); pel.scale(1.2, 0.7, 0.9); pel.translate(0, 0.95, 0); K.add(pel, shade(stone, 0.9), MAT.rock);
  const ch = rock(0.45, 8, 1, 0.14); ch.scale(1.15, 0.85, 0.85); ch.translate(0, 1.45, 0); K.add(ch, stone, MAT.rock);
  const coreG = crystal(0.12, 0.3, 6); coreG.translate(0, 1.38, 0.33); K.glow(coreG, P.glw, 3);
  const coreR = tor(0.14, 0.03, 4, 6); coreR.translate(0, 1.45, 0.34); K.add(coreR, shade(stone, 0.7), MAT.rock);
  // Kopf
  const hc = V(0, 1.86, 0.18);
  const hd = rock(0.16, 9, 1, 0.1); hd.scale(1.1, 0.85, 1); T(hd, hc); K.add(hd, shade(stone, 1.05), MAT.rock);
  eyes(K, [0, hc.y, hc.z + 0.13], 0.065, 0.028, P.glw, 4, 0.5);
  // Kristall-Cluster
  cluster([0.32, 1.78, -0.1], 4, 1.2, V(0.5, 1, -0.3));
  cluster([-0.3, 1.8, -0.12], 3, 1.0, V(-0.5, 1, -0.4));
  cluster([0.0, 1.7, -0.3], 4, 1.3 + (t - 1) * 0.15, V(0, 1, -0.6));
  if (t >= 2) cluster([0.15, 1.2, -0.32], 3, 0.8, V(0.3, 0.3, -1));
  // Arme
  for (const s of [1, -1]) {
    const sh = V(0.55 * s, 1.6, 0), el = V(0.7 * s, 1.2, 0.1), ha = V(0.68 * s, 0.82, 0.25);
    const ua = rock(0.2, 10 + s, 1, 0.14); ua.scale(1, 1.3, 1); T(ua, sh.clone().lerp(el, 0.5)); K.add(ua, stone, MAT.rock);
    const fa = rock(0.18, 12 + s, 1, 0.14); fa.scale(1, 1.3, 1); T(fa, el.clone().lerp(ha, 0.5)); K.add(fa, shade(stone, 0.95), MAT.rock);
    const pa = rock(0.24, 14 + s, 1, 0.14); pa.scale(1.2, 0.9, 1); T(pa, sh); K.add(pa, shade(stone, 1.1), MAT.rock);
    const fist = crystal(0.16, 0.36, 6); fist.rotateX(PI); fist.scale(1.2, 1, 1.2); T(fist, ha.clone().add(V(0, 0.05, 0))); K.add(fist, cry, MAT.crystal);
    const fg = crystal(0.08, 0.24, 6); fg.rotateX(PI); T(fg, ha.clone().add(V(0, 0.02, 0))); K.glow(fg, P.glw, 2.4);
  }
  if (t >= 3) runeRing(K, [0, 0.05, 0], 0.7, 14, P.glw, 2.4);
  return [1.0, 0.75];
}

// ---- Arbeiter-Irrlicht ----------------------------------------------------------------------------
function worker(K) {
  const P = K.P, t = K.tier, c = V(0, 0.48, 0);
  const core = sph(0.1, 12, 10); T(core, c); K.glow(core, P.glw, 2.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const cr = crystal(0.05, 0.2, 5); R(cr, 0.9, 0, 0); cr.rotateY(a); T(cr, c.clone().add(V(Math.sin(a) * 0.1, -0.02, Math.cos(a) * 0.1)));
    K.add(cr, shade(mix(P.glw, P.pri, 0.5), i % 2 ? 0.8 : 0.6), MAT.crystal);
  }
  const ring = tor(0.17, 0.014, 4, 20); ring.rotateX(PI / 2 + 0.35); T(ring, c); K.add(ring, P.gold, MAT.gold);
  const cap = crystal(0.05, 0.16, 5); T(cap, c.clone().add(V(0, 0.1, 0))); K.add(cap, shade(mix(P.glw, P.pri, 0.5), 0.7), MAT.crystal);
  K.glow(sweep([c.clone().add(V(0, -0.08, -0.05)), c.clone().add(V(0.02, -0.2, -0.16)), c.clone().add(V(-0.02, -0.3, -0.3))], (u) => 0.05 * (1 - u), 6, 8), P.glw, 1.8);
  for (let i = 0; i < 3 + t; i++) { const a = i * 2.2; const s = sph(0.018, 5, 4); s.translate(Math.cos(a) * 0.24, 0.4 + (i % 3) * 0.12, Math.sin(a) * 0.24); K.glow(s, P.glw, 3); }
  // kleine Spitzhacke (Werkzeug)
  const ha = c.clone().add(V(0.16, -0.1, 0.06));
  K.add(seg(ha, ha.clone().add(V(0.06, 0.22, 0.02)), 0.012, 0.012, 5, 1), P.wood, MAT.wood);
  const pk = sweep([ha.clone().add(V(-0.04, 0.2, 0.0)), ha.clone().add(V(0.06, 0.24, 0.02)), ha.clone().add(V(0.16, 0.18, 0.03))], (u) => 0.02 * (1 - Math.abs(u - 0.5)), 5, 8);
  K.add(pk, P.met, MAT.metal);
  return [1.0, 0.3, 0.3];
}

// ---- Boss: Stein-Titan ----------------------------------------------------------------------------
function boss_titan(K) {
  const P = K.P, t = K.tier, st = mix('#6f6a64', P.pri, 0.3), lava = P.glw;
  // Beine (Säulen)
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.1 : -0.06;
    const hip = V(0.3 * s, 0.95, 0), kn = V(0.38 * s, 0.52, 0.06 + f), ft = V(0.38 * s, 0.12, f);
    const core = seg(hip, ft, 0.12, 0.12, 6, 1); K.glow(core, lava, 2.2);
    for (const [p, r] of [[hip.clone().lerp(kn, 0.5), 0.23], [kn, 0.17], [kn.clone().lerp(ft, 0.55), 0.2]]) { const g = rock(r, p.y * 10 + s, 1, 0.16); g.scale(1, 1.2, 1); T(g, p); K.add(g, shade(st, 0.9 + K.rng() * 0.2), MAT.rock); }
    const foot = rock(0.24, 3 + s, 1, 0.12); foot.scale(1.1, 0.5, 1.35); foot.translate(ft.x, 0.1, ft.z + 0.08); K.add(foot, shade(st, 0.8), MAT.rock);
    const band = tor(0.18, 0.035, 4, 12); band.rotateX(PI / 2); T(band, kn.clone().add(V(0, 0.12, 0))); K.add(band, P.met, MAT.dmetal);
  }
  // Becken + Rumpf mit glühendem Kern
  const pel = rock(0.36, 5, 1, 0.12); pel.scale(1.25, 0.6, 0.9); pel.translate(0, 1.02, 0); K.add(pel, shade(st, 0.85), MAT.rock);
  const tc = ell(0.48, 0.45, 0.36, 14, 10); tc.translate(0, 1.55, 0); K.glow(tc, lava, 2.0);
  rockShell(K, [0, 1.55, 0], 0.56, 0.52, 0.42, 26, st, { size: 0.6, seed: 13 });
  // Massiver Schulter-Block
  const yoke = rock(0.42, 6, 1, 0.14); yoke.scale(1.9, 0.62, 1.0); yoke.translate(0, 2.02, -0.04); K.add(yoke, st, MAT.rock);
  // Brust-Kern
  const cr = tor(0.17, 0.05, 6, 16); cr.translate(0, 1.6, 0.47); K.add(cr, P.met, MAT.dmetal);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const sp = cone(0.03, 0.09, 4); sp.translate(0, 0.24, 0); sp.rotateZ(a); sp.translate(0, 1.6, 0.48); K.add(sp, P.met, MAT.dmetal); }
  const core = sph(0.14, 14, 10); core.translate(0, 1.6, 0.46); K.glow(core, lava, 4);
  // Kopf: klein, mit Steinkrone
  const hc = V(0, 2.2, 0.26);
  const hd = rock(0.2, 7, 1, 0.1); hd.scale(1.05, 0.9, 1); T(hd, hc); K.add(hd, shade(st, 1.08), MAT.rock);
  const brow = rock(0.12, 8, 0, 0.1); brow.scale(2.0, 0.5, 0.9); brow.translate(hc.x, hc.y + 0.07, hc.z + 0.12); K.add(brow, shade(st, 0.8), MAT.rock);
  eyes(K, [0, hc.y + 0.0, hc.z + 0.17], 0.08, 0.035, lava, 4.2, 0.45);
  const mouth = box(0.14, 0.02, 0.03); mouth.translate(hc.x, hc.y - 0.1, hc.z + 0.18); K.glow(mouth, lava, 3);
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45; const sp = rock(0.07, 60 + i, 0, 0.2); sp.scale(0.7, 2.2 - Math.abs(i - 2) * 0.4, 0.7); sp.translate(Math.sin(a) * 0.17, hc.y + 0.22 - Math.abs(i - 2) * 0.03, hc.z - 0.04 - Math.cos(a) * 0.05); K.add(sp, shade(st, 0.75), MAT.rock); }
  // Arme (riesig, hängend)
  for (const s of [1, -1]) {
    const sh = V(0.82 * s, 1.95, 0), el = V(1.0 * s, 1.35, 0.15), ha = V(0.95 * s, 0.75, 0.38);
    K.glow(seg(sh, ha, 0.1, 0.1, 6, 1), lava, 2.2);
    const pa = rock(0.36, 20 + s, 1, 0.14); pa.scale(1.15, 0.85, 1.05); T(pa, sh.clone().add(V(0.02 * s, 0.08, 0))); K.add(pa, shade(st, 1.05), MAT.rock);
    for (let i = 0; i < 3; i++) { const sp = rock(0.07, 70 + i + s, 0, 0.2); sp.scale(0.8, 2.4, 0.8); R(sp, 0, 0, -s * 0.5); sp.translate(sh.x + s * 0.12, sh.y + 0.32, sh.z - 0.15 + i * 0.15); K.add(sp, shade(st, 0.7), MAT.rock); }
    const ua = rock(0.25, 22 + s, 1, 0.14); ua.scale(1, 1.4, 1); T(ua, sh.clone().lerp(el, 0.55)); K.add(ua, st, MAT.rock);
    const fa = rock(0.24, 24 + s, 1, 0.14); fa.scale(1, 1.35, 1); T(fa, el.clone().lerp(ha, 0.45)); K.add(fa, shade(st, 0.95), MAT.rock);
    const fist = rock(0.32, 26 + s, 1, 0.16); T(fist, ha); K.add(fist, shade(st, 1.1), MAT.rock);
    const br = tor(0.24, 0.045, 4, 12); br.rotateX(PI / 2); aim(br, el.clone().lerp(ha, 0.3), ha.clone().sub(el)); K.add(br, P.met, MAT.dmetal);
    for (let i = 0; i < 4; i++) { const rn = box(0.05, 0.03, 0.02); rn.translate(0, 0, 0.245); rn.rotateY((i / 4) * TAU); aim(rn, el.clone().lerp(ha, 0.3), ha.clone().sub(el)); K.glow(rn, lava, 3); }
  }
  // Moos auf den Schultern
  for (const s of [1, -1]) { const m = blob(0.18, 9 + s, 0.3, 9, 6); m.scale(1.4, 0.4, 1.2); m.translate(0.75 * s, 2.25, -0.02); K.add(m, P.moss, MAT.leaf); }
  // Schwebende Runensteine
  const nr = 3 + t;
  for (let i = 0; i < nr; i++) { const a = (i / nr) * TAU + 0.5; const g = rock(0.1, 80 + i, 0, 0.15); g.scale(0.7, 1.3, 0.5); g.translate(Math.cos(a) * 1.35, 1.6 + Math.sin(i * 1.7) * 0.4, Math.sin(a) * 1.0); K.add(g, st, MAT.rock); const gr = box(0.04, 0.12, 0.02); gr.translate(Math.cos(a) * 1.35 + Math.cos(a) * 0.06, 1.6 + Math.sin(i * 1.7) * 0.4, Math.sin(a) * 1.0 + Math.sin(a) * 0.06); K.glow(gr, lava, 3); }
  runeRing(K, [0, 0.04, 0], 1.0, 18, lava, 2.4);
  return [2.4, 0.9, 0.8];
}

// ---- Boss: Drache ---------------------------------------------------------------------------------
function boss_drake(K) {
  const P = K.P, t = K.tier, sc = P.pri, bel = P.sec, fire = P.glw, lift = 0.55;
  const y = (v) => v + lift;
  // Rumpf
  const body = sweep([V(0, y(0.95), 0.45), V(0, y(1.0), 0.1), V(0, y(0.95), -0.3), V(0, y(0.85), -0.6)], (u) => 0.32 - 0.12 * u + 0.05 * Math.sin(u * PI), 12, 16, { fx: 1.0, fy: 0.9 });
  K.add(body, sc, MAT.scale);
  // Bauchplatten
  for (let i = 0; i < 7; i++) { const p = ell(0.2 - i * 0.012, 0.05, 0.1, 8, 4); R(p, 0.15, 0, 0); p.translate(0, y(0.66 + i * 0.01), 0.42 - i * 0.13); K.add(p, bel, MAT.scale); const g = box(0.24 - i * 0.015, 0.012, 0.02); g.translate(0, y(0.66 + i * 0.01) - 0.01, 0.42 - i * 0.13 - 0.07); K.glow(g, fire, 2.4); }
  // Hals + Kopf
  const neck = [V(0, y(1.05), 0.45), V(0, y(1.35), 0.7), V(0, y(1.7), 0.8), V(0, y(1.88), 0.98)];
  K.add(sweep(neck, (u) => 0.2 - u * 0.08, 10, 14), sc, MAT.scale);
  for (let i = 0; i < 5; i++) { const p = new THREE.CatmullRomCurve3(neck).getPointAt(0.1 + i * 0.18); const b = ell(0.11, 0.04, 0.08, 8, 4); R(b, -0.6, 0, 0); T(b, p.clone().add(V(0, -0.06, 0.12))); K.add(b, bel, MAT.scale); }
  const hc = V(0, y(1.96), 1.1);
  const skull = ell(0.17, 0.15, 0.22, 12, 8); T(skull, hc); K.add(skull, sc, MAT.scale);
  const snout = seg(hc.clone().add(V(0, 0.0, 0.1)), hc.clone().add(V(0, -0.04, 0.42)), 0.12, 0.08, 9, 2); K.add(snout, sc, MAT.scale);
  const jaw = seg(hc.clone().add(V(0, -0.1, 0.05)), hc.clone().add(V(0, -0.2, 0.38)), 0.09, 0.06, 8, 2); K.add(jaw, shade(bel, 0.85), MAT.scale);
  const mouth = box(0.12, 0.05, 0.3); mouth.rotateX(0.2); mouth.translate(hc.x, hc.y - 0.1, hc.z + 0.26); K.glow(mouth, fire, 3.6);
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) { const f = cone(0.018, 0.07, 4); f.rotateX(PI); f.translate(s * 0.07, hc.y - 0.07, hc.z + 0.2 + i * 0.06); K.add(f, P.white, MAT.bone); }
  eyes(K, [0, hc.y + 0.06, hc.z + 0.14], 0.12, 0.03, fire, 4, 0.45);
  for (const s of [1]) {
    horn(K, hc.clone().add(V(0.1, 0.1, -0.08)), [hc.clone().add(V(0.18, 0.2, -0.3)), hc.clone().add(V(0.22, 0.24, -0.55))], 0.06, P.bone, MAT.bone);
    horn(K, hc.clone().add(V(0.14, 0.0, -0.1)), [hc.clone().add(V(0.26, 0.0, -0.25)), hc.clone().add(V(0.32, 0.06, -0.38))], 0.04, P.bone, MAT.bone);
    const fr = ext(shape([[0, 0], [0.18, 0.06], [0.3, -0.02], [0.2, -0.08], [0.24, -0.16], [0.08, -0.1]], true), 0.012, 0.006, 1, 3); fr.rotateY(PI / 2 - 0.3); fr.translate(hc.x + 0.15, hc.y - 0.06, hc.z - 0.08); K.sym(fr, P.sec, MAT.skin);
  }
  // Rückenstacheln
  const spine = new THREE.CatmullRomCurve3([...neck].reverse().concat([V(0, y(1.2), 0.1), V(0, y(1.12), -0.3), V(0, y(1.0), -0.65)]).map((p) => p.clone()));
  for (let i = 1; i < 16; i++) { const p = spine.getPointAt(i / 16); const sp = cone(0.05, 0.18 - Math.abs(i - 8) * 0.008, 5); R(sp, -0.6, 0, 0); sp.translate(p.x, p.y + 0.12, p.z - 0.04); K.add(sp, P.bone, MAT.bone); if (t >= 2 && i % 3 === 0) { const g = cone(0.02, 0.08, 4); R(g, -0.6, 0, 0); g.translate(p.x, p.y + 0.24, p.z - 0.1); K.glow(g, fire, 3); } }
  // Schwanz
  const tail = [V(0, y(0.85), -0.6), V(0, y(0.7), -1.1), V(0.15, y(0.55), -1.6), V(0.45, y(0.45), -1.95), V(0.75, y(0.5), -2.1)];
  K.add(sweep(tail, (u) => 0.2 * (1 - u * 0.9), 9, 22), sc, MAT.scale);
  const spade = ext(shape([[0, 0.3], [0.16, 0.0], [0.04, 0.05], [0, -0.06], [-0.04, 0.05], [-0.16, 0.0]]), 0.03, 0.015, 1); spade.rotateX(-PI / 2); spade.rotateY(-1.1); spade.translate(0.8, y(0.5), -2.12); K.add(spade, P.bone, MAT.bone);
  // Hinterbeine (angezogen) + Vorderklauen
  for (const s of [1, -1]) {
    const hip = V(0.24 * s, y(0.85), -0.4), kn = V(0.34 * s, y(0.55), -0.15), an = V(0.3 * s, y(0.3), -0.45), ft = V(0.3 * s, y(0.15), -0.3);
    K.add(seg(hip, kn, 0.17, 0.12, 9, 2), sc, MAT.scale); K.add(seg(kn, an, 0.1, 0.07, 8, 2), sc, MAT.scale); K.add(seg(an, ft, 0.07, 0.06, 7, 2), sc, MAT.scale);
    for (let i = -1; i <= 1; i++) K.add(sweep([ft, ft.clone().add(V(i * 0.06, -0.04, 0.1)), ft.clone().add(V(i * 0.08, -0.12, 0.14))], (u) => 0.03 * (1 - u * 0.8), 5, 5), P.bone, MAT.bone);
    const fsh = V(0.2 * s, y(0.85), 0.35), fel = V(0.3 * s, y(0.6), 0.5), fha = V(0.24 * s, y(0.45), 0.62);
    K.add(seg(fsh, fel, 0.09, 0.07, 8, 2), sc, MAT.scale); K.add(seg(fel, fha, 0.06, 0.05, 7, 2), sc, MAT.scale);
    for (let i = -1; i <= 1; i++) K.add(sweep([fha, fha.clone().add(V(i * 0.04, -0.06, 0.06)), fha.clone().add(V(i * 0.05, -0.14, 0.08))], (u) => 0.02 * (1 - u * 0.8), 5, 5), P.bone, MAT.bone);
  }
  // Flügel
  batWing(K, [0.24, y(1.12), 0.1], 2.1 + (t - 1) * 0.15, { col: shade(sc, 0.9), mem: mix(sc, P.sec, 0.35), up: 0.42, back: -0.5, mat: MAT.scale, memMat: MAT.skin });
  if (t >= 3) { const c = tor(0.2, 0.02, 4, 20); c.rotateX(PI / 2 + 0.3); c.translate(hc.x, hc.y + 0.32, hc.z - 0.2); K.glow(c, fire, 3); }
  return [2.2, 0.95];
}

// ---- Boss: Dämonenfürst ---------------------------------------------------------------------------
function boss_lord(K) {
  const P = K.P, t = K.tier, skin = mix('#a8242a', P.pri, 0.25), arm = mix('#2e2b33', P.met, 0.4), fire = mix(P.glw, '#ff5a1a', 0.45);
  // Ziegenbeine mit Hufen
  for (const s of [1, -1]) {
    const f = s > 0 ? 0.12 : -0.08;
    const hip = V(0.16 * s, 0.98, 0), kn = V(0.22 * s, 0.68, 0.16 + f * 0.4), an = V(0.22 * s, 0.35, -0.08 + f), ft = V(0.22 * s, 0.08, 0.0 + f);
    K.add(seg(hip, kn, 0.13, 0.1, 8, 2), skin, MAT.skin); K.add(seg(kn, an, 0.08, 0.06, 7, 2), skin, MAT.skin); K.add(seg(an, ft, 0.06, 0.055, 7, 2), shade(skin, 0.6), MAT.skin);
    const hoof = lathe([[0, 0], [0.08, 0], [0.07, 0.08], [0, 0.09]], 8); hoof.scale(1, 1, 1.2); hoof.translate(ft.x, 0, ft.z + 0.02); K.add(hoof, P.dark, MAT.bone);
    const fur = blob(0.11, 3 + s, 0.25, 8, 6); fur.scale(1, 0.6, 1); T(fur, an.clone().add(V(0, 0.03, 0))); K.add(fur, P.dark, MAT.fur);
    const kp = cone(0.04, 0.14, 5); kp.rotateX(PI / 2); T(kp, kn.clone().add(V(0, 0, 0.1))); K.add(kp, arm, MAT.dmetal);
  }
  // Lendenschurz-Platten
  const sk = robe(K, [[0, 1.08], [0.26, 1.06], [0.3, 0.9], [0.34, 0.68], [0, 0.66]], arm, { seg: 10, fold: 0.15, folds: 5, tatter: 0.14, tears: 5, mat: MAT.dmetal });
  const loin = ext(shape([[-0.12, 0], [0.12, 0], [0.1, -0.5], [0, -0.58], [-0.1, -0.5]]), 0.02, 0.008, 1); loin.translate(0, 1.0, 0.3); K.add(loin, P.sec, MAT.cloth);
  // Muskulöser Oberkörper
  const tor_ = lathe([[0, 1.0], [0.22, 1.02], [0.24, 1.15], [0.3, 1.35], [0.38, 1.55], [0.36, 1.66], [0.2, 1.74], [0, 1.76]], 12); tor_.scale(1, 1, 0.72); K.add(tor_, skin, MAT.skin);
  for (const s of [1]) { const pec = ell(0.15, 0.1, 0.07, 8, 6); pec.translate(0.13, 1.5, 0.23); K.sym(pec, shade(skin, 1.05), MAT.skin); }
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) { const ab = ell(0.06, 0.045, 0.04, 6, 4); ab.translate(0.06 * s, 1.32 - i * 0.09, 0.19); K.add(ab, shade(skin, 1.02), MAT.skin); }
  K.glow(ext(starShape(0.07, 0.025, 5, PI), 0.01, 0.004, 1).translate(0, 1.42, 0.27), fire, 3);
  belt(K, 1.06, 0.26, 0.2, P.dleather, null);
  const skull = sph(0.07, 8, 6); skull.scale(1, 0.9, 0.8); skull.translate(0, 1.06, 0.22); K.add(skull, P.bone, MAT.bone);
  eyes(K, [0, 1.07, 0.27], 0.025, 0.01, fire, 3, 0.8);
  // Schulterpanzer mit Stacheln
  pauldron(K, [0.42, 1.7, 0], 0.22, arm, P.sec, { layers: 2, spikes: 3, mat: MAT.dmetal, tilt: 0.8 });
  // Kopf + riesige Hörner
  K.add(seg([0, 1.7, 0], [0, 1.82, 0.04], 0.1, 0.09), skin, MAT.skin);
  const hc = V(0, 1.95, 0.08);
  const hd = ell(0.14, 0.15, 0.14, 10, 8); T(hd, hc); K.add(hd, skin, MAT.skin);
  const jaw = ell(0.11, 0.06, 0.1, 8, 5); jaw.translate(hc.x, hc.y - 0.1, hc.z + 0.04); K.add(jaw, shade(skin, 0.9), MAT.skin);
  const brow = ell(0.14, 0.03, 0.05, 8, 4); brow.rotateX(0.3); brow.translate(hc.x, hc.y + 0.05, hc.z + 0.11); K.add(brow, shade(skin, 0.7), MAT.skin);
  eyes(K, [0, hc.y + 0.02, hc.z + 0.13], 0.055, 0.022, fire, 4.2, 0.45);
  const mouth = box(0.08, 0.015, 0.02); mouth.translate(hc.x, hc.y - 0.08, hc.z + 0.14); K.glow(mouth, fire, 3);
  for (const s of [1, -1]) { const tk = cone(0.015, 0.06, 4); tk.translate(0.04 * s, hc.y - 0.06, hc.z + 0.13); K.add(tk, P.white, MAT.bone); }
  horn(K, hc.clone().add(V(0.1, 0.1, -0.02)), [hc.clone().add(V(0.28, 0.2, -0.02)), hc.clone().add(V(0.42, 0.42, -0.08)), hc.clone().add(V(0.38, 0.66, 0.06)), hc.clone().add(V(0.28, 0.76, 0.16))], 0.07, P.dark, [0.4, 0.1]);
  const crownR = tor(0.13, 0.015, 3, 14); crownR.rotateX(PI / 2 + 0.2); crownR.translate(hc.x, hc.y + 0.12, hc.z - 0.01); K.add(crownR, P.sec, MAT.gold);
  // Arme
  const shR = V(-0.44, 1.62, 0), elR = V(-0.6, 1.3, 0.12), haR = V(-0.5, 1.12, 0.38);
  const shL = V(0.44, 1.62, 0), elL = V(0.62, 1.32, 0.1), haL = V(0.6, 1.3, 0.38);
  for (const [sh, el, ha] of [[shR, elR, haR], [shL, elL, haL]]) {
    K.add(seg(sh, el, 0.12, 0.1, 8, 2), skin, MAT.skin); K.add(seg(el, ha, 0.1, 0.08, 8, 2), skin, MAT.skin);
    const g = cyl(0.11, 0.09, 0.16, 8, true); aim(g, el.clone().lerp(ha, 0.6), ha.clone().sub(el)); K.add(g, arm, MAT.dmetal);
    for (let i = 0; i < 2; i++) { const sp = cone(0.025, 0.1, 4); sp.translate(0, 0.11, 0); sp.rotateZ(i * PI - PI / 2); aim(sp, el.clone().lerp(ha, 0.6), ha.clone().sub(el)); K.add(sp, arm, MAT.dmetal); }
    const hand = blob(0.08, 4, 0.05, 8, 6); T(hand, ha); K.add(hand, shade(skin, 0.9), MAT.skin);
  }
  const fb = sph(0.1 + t * 0.015, 10, 8); fb.translate(haL.x, haL.y + 0.14, haL.z + 0.04); K.glow(fb, fire, 3.6);
  // Flammenschwert
  const sd = V(-0.25, 0.92, 0.3).normalize(), bl = 1.25 + (t - 1) * 0.1;
  const blade = ext(shape([[-0.05, 0], [0.05, 0], [0.08, bl * 0.3], [0.06, bl * 0.75], [0, bl], [-0.07, bl * 0.7], [-0.06, bl * 0.3]]), 0.03, 0.015, 1);
  blade.translate(0, 0.1, 0); K.add(aim(blade, haR, sd, 0.4), P.dark, MAT.dmetal);
  const flames = shape([[-0.06, 0.05], [-0.13, 0.25], [-0.09, 0.3], [-0.16, 0.55], [-0.1, 0.6], [-0.15, 0.85], [-0.06, 0.95], [0, bl + 0.14], [0.06, 0.92], [0.15, 0.8], [0.1, 0.72], [0.17, 0.45], [0.11, 0.4], [0.14, 0.18], [0.06, 0.05]]);
  const fl = ext(flames, 0.012, 0, 1); fl.translate(0, 0.1, 0); K.glow(aim(fl, haR, sd, 0.4), fire, 2.8);
  const core = ext(shape([[-0.025, 0.05], [0.025, 0.05], [0.02, bl * 0.8], [0, bl * 0.95], [-0.02, bl * 0.8]]), 0.05, 0, 1); core.translate(0, 0.1, 0); K.glow(aim(core, haR, sd, 0.4), mix(fire, P.white, 0.5), 3.6);
  const gd = ext(shape([[-0.24, 0], [-0.1, 0.03], [0, 0.08], [0.1, 0.03], [0.24, 0], [0.28, 0.08], [0.1, -0.04], [-0.1, -0.04], [-0.28, 0.08]]), 0.05, 0.015, 1); gd.translate(0, 0.08, 0); K.add(aim(gd, haR, sd, 0.4), P.sec, MAT.gold);
  const gr = cyl(0.03, 0.032, 0.24, 7); gr.translate(0, -0.06, 0); K.add(aim(gr, haR, sd, 0.4), P.dleather, MAT.leather);
  // Flügel + Schwanz
  batWing(K, [0.18, 1.62, -0.2], 1.4 + (t - 1) * 0.12, { col: shade(skin, 0.55), mem: mix(skin, P.dark, 0.55), up: 0.65, back: -0.45 });
  K.add(sweep([V(0, 1.0, -0.22), V(0.1, 0.55, -0.55), V(0.3, 0.25, -0.75), V(0.55, 0.15, -0.7)], (u) => 0.07 * (1 - u * 0.8), 7, 14), skin, MAT.skin);
  const tsp = ext(shape([[0, 0.16], [0.07, 0.0], [0, 0.03], [-0.07, 0.0]]), 0.015, 0.006, 1); tsp.rotateZ(-PI / 2 - 0.3); tsp.rotateY(0.3); tsp.translate(0.6, 0.16, -0.68); K.add(tsp, P.dark, MAT.bone);
  if (t >= 2) runeRing(K, [0, 0.04, 0], 0.85, 16, fire, 2.6);
  if (t >= 3) { const h = tor(0.3, 0.02, 4, 28); h.rotateX(PI / 2 - 0.3); h.translate(0, 2.55, -0.15); K.glow(h, fire, 3); }
  return [2.45, 0.85];
}

// @@ARCHETYPES_END

// ---------------------------------------------------------------------------------------------
// Register + Paletten
// ---------------------------------------------------------------------------------------------
const BUILDERS = {
  knight, paladin_heavy, archer, priest, druid, witch, voidmage, shade: shade_, knightfallen, king,
  wolf, bear, griffin, treant, mushroom, crawler, hound, beetle, imp, brute, raptor, serpent,
  automaton, walker, mortar, core, spider, bonethrower, cryptgolem,
  elemental, golem, worker, boss_titan, boss_drake, boss_lord,
};

// Standardfarben je Archetyp (opts überschreiben)
const DEFAULTS = {
  knight: { primary: '#2f63d8', secondary: '#e8c766', metal: '#9ea8b6', glow: '#6fd3ff' },
  paladin_heavy: { primary: '#f2efe6', secondary: '#2a56c6', metal: '#c9b48a', glow: '#ffd36b' },
  archer: { primary: '#2f7a46', secondary: '#c9a25e', metal: '#8f98a3', glow: '#9dff8a' },
  priest: { primary: '#f1ece0', secondary: '#3d6fd9', metal: '#d6b56a', glow: '#ffe28a' },
  druid: { primary: '#5b4a2e', secondary: '#c98a3a', metal: '#7d8a6a', glow: '#7dff9a' },
  witch: { primary: '#3b2850', secondary: '#1f1a2a', metal: '#6a6f78', glow: '#9cff5a' },
  voidmage: { primary: '#2c1745', secondary: '#7c3dd6', metal: '#3a3346', glow: '#c06bff' },
  shade: { primary: '#1d1b2e', secondary: '#3b3566', metal: '#555', glow: '#5ef2ff' },
  knightfallen: { primary: '#5a1020', secondary: '#9a2a2a', metal: '#3d3f48', glow: '#ff3b2f' },
  king: { primary: '#2f63d8', secondary: '#e8c766', metal: '#b3bbc7', glow: '#7fe0ff' },
  wolf: { primary: '#5d646e', secondary: '#9b2f2f', metal: '#a2abb8', glow: '#7fe8ff' },
  bear: { primary: '#2f63d8', secondary: '#6b4a32', metal: '#a9b2bd', glow: '#ffcf5a' },
  griffin: { primary: '#ece4cf', secondary: '#2f5fb3', metal: '#c9b07a', glow: '#8fe3ff' },
  treant: { primary: '#5f8a3c', secondary: '#7a4f2c', metal: '#777', glow: '#b6ff6a' },
  mushroom: { primary: '#c8342f', secondary: '#d9c9a8', metal: '#888', glow: '#7dffd8' },
  crawler: { primary: '#4a7a3a', secondary: '#c9d35a', metal: '#555', glow: '#c8ff3a' },
  hound: { primary: '#3a302c', secondary: '#1b1717', metal: '#444', glow: '#ff6a1a' },
  beetle: { primary: '#2d4f7a', secondary: '#163055', metal: '#8d97a6', glow: '#62e8ff' },
  imp: { primary: '#c7322b', secondary: '#4a1d2a', metal: '#555', glow: '#ffb02e' },
  brute: { primary: '#7a8b5a', secondary: '#7a2e24', metal: '#8a8f98', glow: '#ff5a3a' },
  raptor: { primary: '#5d7d3c', secondary: '#d9c58a', metal: '#8f98a3', glow: '#ffd23a' },
  serpent: { primary: '#2e7a6a', secondary: '#d9c88a', metal: '#b9a46a', glow: '#5affd0' },
  automaton: { primary: '#4a5361', secondary: '#c2562a', metal: '#9aa3ae', glow: '#5ad8ff' },
  walker: { primary: '#4a5361', secondary: '#3f6fb5', metal: '#9aa3ae', glow: '#ffb84a' },
  mortar: { primary: '#4a5361', secondary: '#6f8a3a', metal: '#8f98a3', glow: '#ff7a2a' },
  core: { primary: '#5a7dff', secondary: '#c9b2ff', metal: '#b6bfd0', glow: '#7ff0ff' },
  spider: { primary: '#4a5361', secondary: '#8a4fc0', metal: '#9aa3ae', glow: '#8ad8ff' },
  bonethrower: { primary: '#4a3b30', secondary: '#2d3a2a', metal: '#6f6458', glow: '#7dff6a' },
  cryptgolem: { primary: '#6a7656', secondary: '#7a4a5e', metal: '#5f646c', glow: '#8aff5a' },
  elemental: { primary: '#6a5a4c', secondary: '#c98a3a', metal: '#555', glow: '#ff8a2a' },
  golem: { primary: '#4a5262', secondary: '#5ac8ff', metal: '#777', glow: '#9af4ff' },
  worker: { primary: '#5a9fe0', secondary: '#ffffff', metal: '#c9b07a', glow: '#ffe28a' },
  boss_titan: { primary: '#6f6a64', secondary: '#4a4744', metal: '#5a4a3a', glow: '#ff7a1a' },
  boss_drake: { primary: '#4a1f5e', secondary: '#c0782a', metal: '#555', glow: '#ff6a2a' },
  boss_lord: { primary: '#a8242a', secondary: '#d4a23a', metal: '#2e2b33', glow: '#ff5a1a' },
};
const BASE_DEFAULT = { primary: '#3a6ee8', secondary: '#e3c35a', metal: '#aab3bf', glow: '#7fd8ff' };

export const ARCHETYPES = Object.keys(BUILDERS);

export function buildModel(archetype, opts = {}) {
  const fn = BUILDERS[archetype] || BUILDERS.knight;
  const def = DEFAULTS[archetype] || BASE_DEFAULT;
  const o = {
    primary: opts.primary || def.primary, secondary: opts.secondary || def.secondary,
    metal: opts.metal || def.metal, glow: opts.glow || def.glow,
    tier: Math.max(1, Math.min(3, opts.tier | 0 || 1)), seed: opts.seed | 0,
  };
  const K = new Kit(o);
  const [baseScale, radius, ao] = fn(K);
  const scale = baseScale * [1, 1.12, 1.25][o.tier - 1];
  return K.finish(scale, radius, ao ?? 1);
}

// ---------------------------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------------------------
export function createBodyMaterial() {
  // PBR je Vertex (Attribut 'pbr' = Rauheit/Metall-Faktor), prozedurales Mikro-Relief (Objektraum, mit Abstand
  // ausgeblendet), Fresnel-Kantenlicht (kühler Himmel + warmer Sonnensaum) und leichte Selbstabschattung in Kuhlen.
  // Instanzfarbe multipliziert wie gehabt (Werte > 1 = weißes Treffer-Aufblitzen).
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 pbr;\nvarying vec2 vPbr;\nvarying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPbr = pbr;\n\tvObjP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vPbr;
varying vec3 vObjP;
float bHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float bNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bHash(i), bHash(i + vec3(1,0,0)), u.x), mix(bHash(i + vec3(0,1,0)), bHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(bHash(i + vec3(0,0,1)), bHash(i + vec3(1,0,1)), u.x), mix(bHash(i + vec3(0,1,1)), bHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}`)
      .replace('#include <roughnessmap_fragment>', `float microN = bNoise(vObjP * 22.0) * 0.6 + bNoise(vObjP * 61.0) * 0.4;
float roughnessFactor = clamp(roughness * vPbr.x * (0.88 + 0.24 * microN), 0.06, 1.0);`)
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(metalness * vPbr.y, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	{
		// Mikro-Relief (Gussstruktur, Stoff, Leder) über Ableitungen – nur aus der Nähe
		float h = microN;
		vec3 dpdx = dFdx( - vViewPosition ), dpdy = dFdy( - vViewPosition );
		float dhx = dFdx( h ), dhy = dFdy( h );
		vec3 r1 = cross( dpdy, normal ), r2 = cross( normal, dpdx );
		float det = dot( dpdx, r1 );
		vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
		float fade = 1.0 - smoothstep( 25.0, 70.0, length( vViewPosition ) );
		normal = normalize( abs( det ) * normal - grad * 0.012 * fade );
	}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 rimV = normalize( vViewPosition );
		float ndv = clamp( dot( normal, -rimV ), 0.0, 1.0 );
		float rimF = pow( 1.0 - ndv, 3.0 );
		// kühler Himmelssaum + Farbsaum aus der Albedo (Einheiten lösen sich vom Boden)
		totalEmissiveRadiance += rimF * ( diffuseColor.rgb * 0.38 + vec3( 0.05, 0.075, 0.13 ) ) * ( 1.0 - 0.5 * metalnessFactor );
		// leichte Grundaufhellung, damit Einheiten im Schatten lesbar bleiben
		totalEmissiveRadiance += diffuseColor.rgb * 0.035;
	}`);
  };
  m.customProgramCacheKey = () => 'aetherfront-body-pbr-v2';
  return m;
}

export function createGlowMaterial() {
  return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
}
