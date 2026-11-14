// Prozedurale Requisiten: Bäume, Felsen, Gras, Blumen, Kristalle und ein Steinbaukasten für Ruinen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm3, noise3, smoothstep, lerp } from './noise.js';

/** Vereinheitlicht Attribute (position, normal, color, emit, metal), nicht-indiziert. */
export function prep(geo, color = [1, 1, 1], { emit = [0, 0, 0], metal = 0, flat = false } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  if (flat || !g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.color) {
    const c = new Float32Array(n * 3);
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const cc = typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i), i) : color;
      c[i * 3] = cc[0]; c[i * 3 + 1] = cc[1]; c[i * 3 + 2] = cc[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const e = new Float32Array(n * 3);
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) { e[i * 3] = emit[0]; e[i * 3 + 1] = emit[1]; e[i * 3 + 2] = emit[2]; m[i] = metal; }
  g.setAttribute('emit', new THREE.BufferAttribute(e, 3));
  g.setAttribute('metal', new THREE.BufferAttribute(m, 1));
  return g;
}

export function merge(list) {
  const g = mergeGeometries(list.filter(Boolean), false);
  return g;
}

function displace(geo, amp, freq, seed) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * freq + seed, v.y * freq, v.z * freq - seed, 3, seed);
    const l = v.length() || 1;
    v.multiplyScalar(1 + (n * amp) / l * l);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

// ---------- Bäume ----------
function canopyColor(y, ny, y0, y1) {
  const t = smoothstep(y0, y1, y);
  const up = ny * 0.5 + 0.5;
  const k = lerp(0.42, 1.0, t) * lerp(0.7, 1.05, up);
  // unten kühl, oben warm (Instanzfarbe gibt den Farbton)
  return [k * lerp(0.80, 1.06, t), k * lerp(0.92, 1.0, t), k * lerp(1.18, 0.78, t)];
}

export function treeTrunkGeometry(kind = 0) {
  const parts = [];
  const h = kind === 0 ? 3.4 : 2.2;
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, h, 7, 5, true);
  trunk.translate(0, h / 2, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 0.9) * 0.18);
    p.setZ(i, p.getZ(i) + Math.cos(y * 0.6) * 0.08);
  }
  parts.push(prep(trunk, (x, y) => [0.26 + y * 0.02, 0.17 + y * 0.012, 0.13 + y * 0.01]));
  // Wurzelansätze
  for (let r = 0; r < 4; r++) {
    const root = new THREE.ConeGeometry(0.22, 1.1, 5);
    root.rotateZ(Math.PI / 2.6);
    root.rotateY((r / 4) * Math.PI * 2 + 0.4);
    root.translate(0, 0.15, 0);
    parts.push(prep(root, [0.24, 0.16, 0.12]));
  }
  if (kind === 0) {
    for (let b = 0; b < 3; b++) {
      const br = new THREE.CylinderGeometry(0.07, 0.14, 1.6, 5);
      br.translate(0, 0.8, 0);
      br.rotateZ(0.9);
      br.rotateY(b * 2.1);
      br.translate(0, 2.3 + b * 0.3, 0);
      parts.push(prep(br, [0.27, 0.18, 0.13]));
    }
  }
  return merge(parts);
}

export function treeCanopyGeometry(kind = 0, seed = 3) {
  const R = rng(seed);
  const parts = [];
  if (kind === 0) {
    // Laubbaum: weiche Blob-Wolke
    const blobs = [
      [0, 4.4, 0, 2.1], [1.3, 3.8, 0.5, 1.5], [-1.2, 3.9, -0.4, 1.55], [0.2, 3.7, -1.3, 1.4],
      [-0.3, 3.8, 1.3, 1.4], [0.4, 5.6, 0.1, 1.45], [-0.9, 5.0, 0.6, 1.1],
    ];
    for (const [x, y, z, r] of blobs) {
      const g = new THREE.IcosahedronGeometry(r, 2);
      displace(g, 0.2, 0.9, R() * 10);
      g.scale(1, 0.86, 1);
      // weiche Kugel-Normalen je Blob
      const p = g.attributes.position;
      const nn = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i) / 0.86, p.getZ(i)).normalize();
        nn[i * 3] = v.x; nn[i * 3 + 1] = v.y; nn[i * 3 + 2] = v.z;
      }
      g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      g.translate(x, y, z);
      parts.push(g);
    }
  } else {
    // Nadelbaum: gestapelte, ausgefranste Kegel
    for (let i = 0; i < 4; i++) {
      const r = 2.0 - i * 0.42, h = 2.4 - i * 0.25;
      const g = new THREE.ConeGeometry(r, h, 11, 2, true);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const a = Math.atan2(z, x);
        const rr = Math.hypot(x, z);
        const j = 1 + 0.16 * Math.sin(a * 5 + i * 1.7) * (rr / r);
        p.setXYZ(k, x * j, y - (rr / r) * 0.35 * (1 + 0.5 * Math.sin(a * 5 + i)), z * j);
      }
      g.translate(0, 2.0 + i * 1.25 + h / 2, 0);
      const ng = g.toNonIndexed();
      const pp = ng.attributes.position;
      const nn = new Float32Array(pp.count * 3);
      for (let k = 0; k < pp.count; k++) {
        const v = new THREE.Vector3(pp.getX(k), Math.hypot(pp.getX(k), pp.getZ(k)) * 0.55 + 0.25, pp.getZ(k)).normalize();
        nn[k * 3] = v.x; nn[k * 3 + 1] = v.y; nn[k * 3 + 2] = v.z;
      }
      ng.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      parts.push(ng);
      const cap = new THREE.CircleGeometry(r * 0.98, 11);
      cap.rotateX(Math.PI / 2);
      cap.translate(0, 2.0 + i * 1.25 - 0.3, 0);
      parts.push(cap);
    }
  }
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    if (!ng.attributes.normal) ng.computeVertexNormals();
    return ng;
  });
  const merged = mergeGeometries(prepared, false);
  // Normale glätten wirkt weicher: Blob-Normalen nach außen (vom Kronenzentrum)
  const p = merged.attributes.position, nrm = merged.attributes.normal;
  const center = new THREE.Vector3(0, kind === 0 ? 4.4 : 3.8, 0);
  const c = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    n.fromBufferAttribute(nrm, i);
    const out = v.clone().sub(center).normalize();
    n.lerp(out, kind === 0 ? 0.3 : 0.15).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
    const cc = canopyColor(v.y, n.y, kind === 0 ? 2.4 : 1.6, kind === 0 ? 6.4 : 7.0);
    const sp = 0.92 + 0.16 * noise3(v.x * 1.7, v.y * 1.7, v.z * 1.7, 4);
    c[i * 3] = cc[0] * sp; c[i * 3 + 1] = cc[1] * sp; c[i * 3 + 2] = cc[2] * sp;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return merged;
}

/**
 * Laubkrone aus Blattkarten (Alpha-getestet, doppelseitig) + dunkle innere Volumen-Kugeln.
 * Attribute: position, normal (kugelförmig vom Kronenzentrum → weiche Beleuchtung), uv (Atlas; innen uv = -1),
 * color (Verdeckung: innen/unten dunkler). kind 0 = Laubbaum, 1 = Nadelbaum.
 */
export function treeFoliageGeometry(kind = 0, seed = 3) {
  const R = rng(seed * 7 + 1);
  const pos = [], nor = [], uv = [], col = [];
  const center = new THREE.Vector3(0, kind === 0 ? 4.5 : 4.6, 0);
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const ao = (p) => {
    const rel = tmp.copy(p).sub(center);
    const out = kind === 0 ? rel.length() / 2.6 : Math.hypot(rel.x, rel.z) / 2.0;
    const up = (p.y - (kind === 0 ? 2.6 : 1.6)) / (kind === 0 ? 4.0 : 6.5);
    return lerp(0.35, 1.08, smoothstep(0.1, 1.0, out * 0.6 + up * 0.55));
  };
  const card = (c, normal, size, roll, u0, u1, stretch = 1, droop = 0) => {
    nrm.copy(normal).normalize();
    t1.set(0, 1, 0);
    if (Math.abs(nrm.y) > 0.95) t1.set(1, 0, 0);
    t2.crossVectors(t1, nrm).normalize();
    t1.crossVectors(nrm, t2).normalize();
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const ax = t2.clone().multiplyScalar(cr).addScaledVector(t1, sr);
    const ay = t1.clone().multiplyScalar(cr).addScaledVector(t2, -sr);
    const hw = size * 0.5 * stretch, hh = size * 0.5;
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, 0, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [a, b, cu, cv] of corners) {
      const p = c.clone().addScaledVector(ax, a * hw).addScaledVector(ay, b * hh);
      if (droop) p.y -= droop * (a * 0.5 + 0.5) * (a * 0.5 + 0.5);
      pos.push(p.x, p.y, p.z);
      const sn = tmp.copy(p).sub(center);
      if (kind === 1) sn.y = sn.y * 0.35 + Math.hypot(sn.x, sn.z) * 0.45 + 0.3;
      sn.normalize().lerp(nrm, 0.25).normalize();
      nor.push(sn.x, sn.y, sn.z);
      uv.push(lerp(u0, u1, cu), cv);
      const k = ao(p);
      col.push(k, k, k);
    }
  };
  const blob = (c, r, sx = 1, sy = 0.85) => {
    const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i) * sx, p.getY(i) * sy, p.getZ(i) * sx).add(c);
      pos.push(v.x, v.y, v.z);
      const sn = tmp.copy(v).sub(center).normalize();
      nor.push(sn.x, sn.y, sn.z);
      uv.push(-1, -1);
      const k = ao(v) * 0.5;
      col.push(k, k, k);
    }
  };
  if (kind === 0) {
    const clusters = [
      [0, 4.5, 0, 2.2], [1.45, 3.9, 0.55, 1.6], [-1.3, 4.0, -0.45, 1.65], [0.25, 3.8, -1.45, 1.5],
      [-0.35, 3.9, 1.4, 1.5], [0.4, 5.8, 0.1, 1.5], [-0.95, 5.2, 0.65, 1.2], [1.0, 5.1, -0.8, 1.15],
    ];
    for (const [x, y, z, r] of clusters) {
      const c = new THREE.Vector3(x, y, z);
      if (y >= 4.4) blob(c, r * 0.3);
      const n = Math.round(r * r * 7.5);
      for (let i = 0; i < n; i++) {
        const dir = new THREE.Vector3(R() * 2 - 1, R() * 1.6 - 0.5, R() * 2 - 1).normalize();
        const cc = c.clone().addScaledVector(dir, r * (0.45 + 0.5 * Math.sqrt(R())));
        const nn = dir.clone().add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(1.4));
        card(cc, nn, 1.05 + R() * 0.6, R() * Math.PI * 2, 0.0, 0.5);
      }
    }
  } else {
    const layers = 8;
    for (let l = 0; l < layers; l++) {
      const t = l / (layers - 1);
      const y = 1.9 + t * 6.6;
      const rad = lerp(2.3, 0.45, Math.pow(t, 0.9));
      blob(new THREE.Vector3(0, y - 0.2, 0), rad * 0.5, 1, 0.55);
      const n = Math.max(4, Math.round(9 - t * 4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + l * 0.7 + R() * 0.4;
        const len = rad * (1.05 + R() * 0.2);
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const c = new THREE.Vector3(Math.cos(a) * len * 0.5, y, Math.sin(a) * len * 0.5);
        // flacher, nach außen hängender Zweig (Karte waagerecht, Länge entlang dir)
        const nn = new THREE.Vector3(0, 1, 0).addScaledVector(dir, 0.35 + R() * 0.2);
        const roll = 0;
        // Karte so ausrichten, dass ihre x-Achse entlang dir zeigt
        nrm.copy(nn).normalize();
        const ax = dir.clone().addScaledVector(nrm, -dir.dot(nrm)).normalize();
        const ay = new THREE.Vector3().crossVectors(nrm, ax).normalize();
        const hw = len * 0.55, hh = len * 0.32;
        const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, 0, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
        for (const [aa, bb, cu, cv] of corners) {
          const p = c.clone().addScaledVector(ax, aa * hw).addScaledVector(ay, bb * hh);
          p.y -= 0.45 * len * Math.pow(aa * 0.5 + 0.5, 2);
          pos.push(p.x, p.y, p.z);
          const sn = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.6, 0)).normalize();
          nor.push(sn.x, sn.y, sn.z);
          uv.push(lerp(0.5, 1.0, cu), cv);
          const k = ao(p);
          col.push(k, k, k);
        }
        // zweite, schräg stehende Karte für Volumen von der Seite
        if (i % 2 === 0) card(c.clone().add(new THREE.Vector3(0, -0.15, 0)), new THREE.Vector3(-dir.z, 0.25, dir.x), len * 0.85, roll, 0.5, 1.0, 1.4, 0.35 * len);
      }
    }
    // Spitze
    card(new THREE.Vector3(0, 8.9, 0), new THREE.Vector3(1, 0.1, 0), 1.6, Math.PI / 2, 0.5, 1.0);
    card(new THREE.Vector3(0, 8.9, 0), new THREE.Vector3(0, 0.1, 1), 1.6, Math.PI / 2, 0.5, 1.0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------- Felsen ----------
export function rockGeometry(seed = 1) {
  // Findling: Rauschen + einige Schnittebenen (gebrochene Facetten), flache Unterseite
  const R = rng(seed * 13 + 5);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const planes = [];
  for (let k = 0; k < 7; k++) {
    const n = new THREE.Vector3(R() * 2 - 1, R() * 1.4 - 0.4, R() * 2 - 1).normalize();
    planes.push({ n, d: 0.72 + R() * 0.2 });
  }
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1 + fbm3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4 - seed, 3, seed) * 0.32 + Math.abs(noise3(v.x * 4, v.y * 4, v.z * 4, seed + 3) - 0.5) * 0.12;
    for (const pl of planes) { const dd = v.dot(pl.n); if (dd > 0.05) r = Math.min(r, pl.d / dd); }
    v.multiplyScalar(r);
    v.y *= 0.72;
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  const pp = ng.attributes.position, nr = ng.attributes.normal;
  const c = new Float32Array(pp.count * 3);
  for (let i = 0; i < pp.count; i += 3) {
    const ny = (nr.getY(i) + nr.getY(i + 1) + nr.getY(i + 2)) / 3;
    const y = (pp.getY(i) + pp.getY(i + 1) + pp.getY(i + 2)) / 3;
    const moss = smoothstep(0.5, 0.85, ny) * smoothstep(-0.1, 0.35, y);
    const band = 0.92 + 0.08 * Math.sin(y * 9 + seed);
    const dark = lerp(0.6, 1.0, smoothstep(-0.3, 0.2, y));
    const stone = [0.42 * band * dark, 0.40 * band * dark, 0.37 * band * dark];
    const mc = [0.07, 0.12, 0.035];
    for (let k = 0; k < 3; k++) {
      c[(i + k) * 3] = lerp(stone[0], mc[0], moss);
      c[(i + k) * 3 + 1] = lerp(stone[1], mc[1], moss);
      c[(i + k) * 3 + 2] = lerp(stone[2], mc[2], moss);
    }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return ng;
}

// ---------- Gras & Blumen ----------
export function grassClumpGeometry(seed = 5, blades = 9) {
  const R = rng(seed);
  const pos = [], col = [], nor = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2;
    const off = Math.sqrt(R()) * 0.45;
    const bx = Math.cos(a) * off, bz = Math.sin(a) * off;
    const h = 0.5 + R() * 0.55;
    const w = 0.07 + R() * 0.05;
    const face = R() * Math.PI;
    const lean = 0.15 + R() * 0.35;
    const la = a + (R() - 0.5);
    const fx = Math.cos(face), fz = Math.sin(face);
    const base = pos.length / 3;
    const levels = 3;
    for (let l = 0; l <= levels; l++) {
      const t = l / levels;
      const y = h * t;
      const bend = lean * t * t;
      const cxp = bx + Math.cos(la) * bend, czp = bz + Math.sin(la) * bend;
      const ww = w * (1 - t * 0.92);
      if (l < levels) {
        pos.push(cxp - fx * ww, y, czp - fz * ww, cxp + fx * ww, y, czp + fz * ww);
        const k = lerp(0.32, 1.0, Math.pow(t, 0.8));
        const warm = lerp(1, 1.12, t);
        col.push(k, k * warm * 0.98, k * 0.9, k, k * warm * 0.98, k * 0.9);
        nor.push(0, 1, 0, 0, 1, 0);
      } else {
        pos.push(cxp, y, czp);
        col.push(1.1, 1.08, 0.85);
        nor.push(0, 1, 0);
      }
    }
    for (let l = 0; l < levels - 1; l++) {
      const i0 = base + l * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
    const lt = base + (levels - 1) * 2;
    idx.push(lt, lt + 1, lt + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function flowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.015, 0.02, 0.6, 3);
  stem.translate(0, 0.3, 0);
  parts.push(prep(stem, [0.18, 0.35, 0.12]));
  const head = new THREE.IcosahedronGeometry(0.11, 0);
  head.scale(1, 0.55, 1);
  head.translate(0, 0.62, 0);
  parts.push(prep(head, [1, 1, 1]));
  const core = new THREE.IcosahedronGeometry(0.045, 0);
  core.translate(0, 0.67, 0);
  parts.push(prep(core, [1.4, 1.1, 0.4]));
  const g = merge(parts);
  g.deleteAttribute('emit'); g.deleteAttribute('metal');
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

// ---------- Kristalle ----------
function crystalPrism(r, h, tip) {
  const body = new THREE.CylinderGeometry(r, r * 0.85, h, 6, 1, true);
  body.translate(0, h / 2, 0);
  const top = new THREE.ConeGeometry(r, tip, 6, 1, true);
  top.translate(0, h + tip / 2, 0);
  const g = mergeGeometries([body.toNonIndexed(), top.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; }));
  // Höhenattribut 0..1
  const p = g.attributes.position;
  const hh = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) hh[i] = p.getY(i) / (h + tip);
  g.setAttribute('hgt', new THREE.BufferAttribute(hh, 1));
  return g;
}

export function crystalClusterGeometry(seed = 9, count = 6) {
  const R = rng(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const main = i === 0;
    const r = main ? 0.42 : 0.16 + R() * 0.22;
    const h = main ? 2.4 : 0.6 + R() * 1.4;
    const g = crystalPrism(r, h, r * 2.2);
    const a = R() * Math.PI * 2;
    const tilt = main ? R() * 0.15 : 0.3 + R() * 0.55;
    g.rotateY(R() * Math.PI);
    g.rotateZ(tilt);
    g.rotateY(a);
    const off = main ? 0 : 0.25 + R() * 0.45;
    g.translate(Math.cos(a) * off, -0.1, Math.sin(a) * off);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

export function crystalShardGeometry() {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(0.45, 1.3, 0.45);
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  const p = ng.attributes.position;
  const hh = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) hh[i] = p.getY(i) / 2.6 + 0.5;
  ng.setAttribute('hgt', new THREE.BufferAttribute(hh, 1));
  ng.computeVertexNormals();
  return ng;
}

// ---------- Steinbaukasten (Ruinen, Brücken, Ringe) ----------
const STONE = [0.42, 0.39, 0.35];
const STONE_DARK = [0.27, 0.25, 0.24];
const GOLD = [1.0, 0.72, 0.36];

export class StoneKit {
  constructor(seed = 1) { this.parts = []; this.R = rng(seed); }
  add(geo, matrix, color = STONE, opts = {}) {
    const g = prep(geo, color, opts);
    if (matrix) g.applyMatrix4(matrix);
    this.parts.push(g);
    return g;
  }
  jitterColor(base, amt = 0.08) {
    const k = 1 + (this.R() - 0.5) * amt * 2;
    return [base[0] * k, base[1] * k, base[2] * k];
  }
  stoneFn(seed = 0, base = STONE) {
    return (x, y, z) => {
      const n = noise3(x * 1.3 + seed, y * 1.3, z * 1.3, 17);
      const k = 0.85 + 0.25 * n;
      const moss = smoothstep(0.62, 0.9, noise3(x * 0.5, y * 0.8 + 3, z * 0.5, 23)) * 0.6;
      return [lerp(base[0] * k, 0.07, moss), lerp(base[1] * k, 0.12, moss), lerp(base[2] * k, 0.035, moss)];
    };
  }
  /** Kannelierte Säule; broken = abgebrochene Oberkante */
  pillar(x, y, z, h = 6, r = 0.7, { broken = false, gold = true, tilt = 0, rotY = 0 } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5)), new THREE.Vector3(1, 1, 1));
    const seed = this.R() * 100;
    const shaft = new THREE.CylinderGeometry(r * 0.9, r, h, 20, Math.max(2, Math.round(h * 1.5)));
    shaft.translate(0, h / 2 + 0.5, 0);
    const p = shaft.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i), py = p.getY(i);
      const a = Math.atan2(pz, px);
      const fl = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 5)), 3);
      p.setX(i, px * fl); p.setZ(i, pz * fl);
      if (broken && py > h * 0.6 + 0.5) {
        const cut = h + 0.5 - (0.6 + 1.4 * (0.5 + 0.5 * Math.sin(a * 3 + seed)) + 0.6 * noise3(px * 3, 0, pz * 3, seed));
        if (py > cut) p.setY(i, cut);
      }
    }
    this.add(shaft, m, this.stoneFn(seed));
    const base = new THREE.CylinderGeometry(r * 1.35, r * 1.5, 0.55, 20);
    base.translate(0, 0.27, 0);
    this.add(base, m, this.stoneFn(seed, STONE_DARK));
    if (gold) {
      const ring = new THREE.TorusGeometry(r * 1.02, 0.07, 6, 24);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, 1.1, 0);
      this.add(ring, m, GOLD, { metal: 1 });
    }
    if (!broken) {
      const cap = new THREE.CylinderGeometry(r * 1.4, r * 1.0, 0.5, 20);
      cap.translate(0, h + 0.75, 0);
      this.add(cap, m, this.stoneFn(seed));
      const slab = new THREE.CylinderGeometry(r * 1.55, r * 1.45, 0.32, 20);
      slab.translate(0, h + 1.15, 0);
      this.add(slab, m, this.stoneFn(seed, STONE_DARK));
      if (gold) {
        const ring2 = new THREE.TorusGeometry(r * 1.25, 0.06, 6, 24);
        ring2.rotateX(Math.PI / 2);
        ring2.translate(0, h + 0.55, 0);
        this.add(ring2, m, GOLD, { metal: 1 });
      }
    }
  }
  /** Bogen aus zwei Säulen und Keilsteinen */
  arch(x, y, z, rotY = 0, span = 6, h = 6, { glow = null } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    const half = span / 2;
    const tmp = new StoneKit(this.R() * 1000);
    tmp.pillar(-half, 0, 0, h, 0.6, { gold: true });
    tmp.pillar(half, 0, 0, h, 0.6, { gold: true });
    const blocks = 11;
    for (let i = 0; i < blocks; i++) {
      const a0 = (i / blocks) * Math.PI, a1 = ((i + 1) / blocks) * Math.PI;
      const am = (a0 + a1) / 2;
      const b = new THREE.BoxGeometry(0.95, (a1 - a0) * (half + 0.4) * 0.96, 1.3);
      b.rotateZ(am);
      b.translate(Math.cos(am) * (half + 0.4), h + 1.4 + Math.sin(am) * (half + 0.4) * 0.8, 0);
      tmp.add(b, null, tmp.stoneFn(i, i === 5 ? [0.7, 0.62, 0.5] : STONE));
    }
    if (glow) {
      const key = new THREE.OctahedronGeometry(0.42, 0);
      key.scale(1, 1.4, 0.5);
      key.translate(0, h + 1.4 + (half + 0.4) * 0.8, 0.7);
      tmp.add(key, null, [0.3, 0.3, 0.4], { emit: glow });
    }
    for (const g of tmp.parts) { g.applyMatrix4(m); this.parts.push(g); }
  }
  /** Obelisk mit leuchtender Rune */
  obelisk(x, y, z, h = 5, rotY = 0, glow = [0.2, 1.4, 1.6]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    const body = new THREE.CylinderGeometry(0.42, 0.7, h, 4, 3);
    body.rotateY(Math.PI / 4);
    body.translate(0, h / 2 + 0.4, 0);
    this.add(body, m, this.stoneFn(x, STONE_DARK), { flat: true });
    const tip = new THREE.ConeGeometry(0.6, 1.0, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(0, h + 0.9, 0);
    this.add(tip, m, GOLD, { metal: 1 });
    const base = new THREE.BoxGeometry(1.8, 0.5, 1.8);
    base.translate(0, 0.25, 0);
    this.add(base, m, this.stoneFn(z, STONE));
    for (let s = 0; s < 4; s++) {
      const rune = new THREE.BoxGeometry(0.12, h * 0.55, 0.05);
      rune.translate(0, h * 0.5 + 0.4, 0.5);
      rune.rotateY((s * Math.PI) / 2);
      this.add(rune, m, [0.2, 0.2, 0.2], { emit: glow });
    }
  }
  /** Mauerfragment aus unregelmäßigen Blöcken */
  wall(x, y, z, rotY = 0, len = 6, h = 2.5) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    const rows = Math.max(1, Math.round(h / 0.8));
    for (let r = 0; r < rows; r++) {
      let cx = -len / 2 + (r % 2) * 0.5;
      const rowLen = len * (1 - (r / rows) * (0.3 + this.R() * 0.6));
      while (cx < -len / 2 + rowLen) {
        const w = 0.9 + this.R() * 0.9;
        const b = new THREE.BoxGeometry(w * 0.96, 0.76, 0.9 + this.R() * 0.15);
        b.translate(cx + w / 2, r * 0.8 + 0.4, (this.R() - 0.5) * 0.08);
        this.add(b, m, this.jitterColor(r === 0 ? STONE_DARK : STONE, 0.1));
        cx += w;
      }
    }
  }
  build() { return this.parts.length ? merge(this.parts) : null; }
}

export const COLORS = { STONE, STONE_DARK, GOLD };
