// Aether-Forge – Quadrik-Vereinfachung (Garland-Heckbert) mit Halbkanten-Kollaps:
// Vertices bleiben exakt auf der (projizierten) SDF-Fläche, Materialgrenzen werden geschützt,
// Dreiecks-Umklappen und Nadeln werden verhindert.

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0], lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.k.length; }
  topKey() { return this.k[0]; }
}

/**
 * positions: Float64Array (n*3), indices: Uint32Array, target: Ziel-Dreiecke.
 * o.mat: Int32Array (n) Materialschlüssel je Vertex (Grenzen bleiben erhalten), o.maxError
 * Rückgabe: { positions, indices, map } (map: alter → neuer Vertex, -1 = entfernt)
 */
export function decimate(positions, indices, target, o = {}) {
  const nv = positions.length / 3, nf = indices.length / 3;
  const P = positions;
  const F = new Int32Array(indices);
  const alive = new Uint8Array(nf).fill(1);
  let faces = nf;
  const mat = o.mat || null;
  // Vertex → Flächen
  const vf = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf; f++) for (let c = 0; c < 3; c++) vf[F[f * 3 + c]].push(f);
  // Quadriken (10 Werte je Vertex)
  const Q = new Float64Array(nv * 10);
  const fn = new Float64Array(nf * 3);
  const addPlane = (q, a, b, c, d, w) => {
    Q[q] += w * a * a; Q[q + 1] += w * a * b; Q[q + 2] += w * a * c; Q[q + 3] += w * a * d;
    Q[q + 4] += w * b * b; Q[q + 5] += w * b * c; Q[q + 6] += w * b * d;
    Q[q + 7] += w * c * c; Q[q + 8] += w * c * d; Q[q + 9] += w * d * d;
  };
  const faceNormal = (f, out, o3) => {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out[o3] = nx; out[o3 + 1] = ny; out[o3 + 2] = nz;
  };
  const tmp = new Float64Array(3);
  for (let f = 0; f < nf; f++) {
    faceNormal(f, tmp, 0);
    const l = Math.hypot(tmp[0], tmp[1], tmp[2]);
    if (l < 1e-14) continue;
    const a = tmp[0] / l, b = tmp[1] / l, c = tmp[2] / l, v0 = F[f * 3];
    const d = -(a * P[v0 * 3] + b * P[v0 * 3 + 1] + c * P[v0 * 3 + 2]);
    const w = l * 0.5;
    for (let k = 0; k < 3; k++) addPlane(F[f * 3 + k] * 10, a, b, c, d, w);
  }
  // Rand- und Materialgrenzen: Zusatzebenen senkrecht zur Fläche entlang der Grenzkanten
  const edgeCount = new Map();
  const ekey = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { const a = F[f * 3 + k], b = F[f * 3 + (k + 1) % 3]; const e = ekey(a, b); edgeCount.set(e, (edgeCount.get(e) || 0) + 1); }
  const border = new Uint8Array(nv);
  const BW = o.borderWeight ?? 8;
  for (let f = 0; f < nf; f++) {
    for (let k = 0; k < 3; k++) {
      const a = F[f * 3 + k], b = F[f * 3 + (k + 1) % 3];
      const isOpen = edgeCount.get(ekey(a, b)) === 1;
      const isMat = mat && mat[a] !== mat[b];
      if (!isOpen && !isMat) continue;
      if (isOpen) { border[a] = 2; border[b] = 2; }
      if (isMat) { border[a] = border[a] || 1; border[b] = border[b] || 1; }
      faceNormal(f, tmp, 0);
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
      let px = ey * tmp[2] - ez * tmp[1], py = ez * tmp[0] - ex * tmp[2], pz = ex * tmp[1] - ey * tmp[0];
      const l = Math.hypot(px, py, pz); if (l < 1e-14) continue;
      px /= l; py /= l; pz /= l;
      const d = -(px * P[a * 3] + py * P[a * 3 + 1] + pz * P[a * 3 + 2]);
      const w = BW * (ex * ex + ey * ey + ez * ez);
      addPlane(a * 10, px, py, pz, d, w); addPlane(b * 10, px, py, pz, d, w);
    }
  }
  const qerr = (q1, q2, x, y, z) => {
    const a = Q[q1] + Q[q2], b = Q[q1 + 1] + Q[q2 + 1], c = Q[q1 + 2] + Q[q2 + 2], d = Q[q1 + 3] + Q[q2 + 3];
    const e = Q[q1 + 4] + Q[q2 + 4], f = Q[q1 + 5] + Q[q2 + 5], g = Q[q1 + 6] + Q[q2 + 6];
    const hh = Q[q1 + 7] + Q[q2 + 7], i = Q[q1 + 8] + Q[q2 + 8], j = Q[q1 + 9] + Q[q2 + 9];
    return a * x * x + 2 * b * x * y + 2 * c * x * z + 2 * d * x + e * y * y + 2 * f * y * z + 2 * g * y + hh * z * z + 2 * i * z + j;
  };
  const removed = new Uint8Array(nv);
  const best = new Int32Array(nv).fill(-1);
  const heap = new Heap();
  const neighbors = (u) => {
    const s = new Set();
    for (const f of vf[u]) if (alive[f]) for (let k = 0; k < 3; k++) { const w = F[f * 3 + k]; if (w !== u) s.add(w); }
    return s;
  };
  const n0 = new Float64Array(3), n1 = new Float64Array(3);
  // Prüfen, ob Kollaps u→v Flächen umklappt / Nadeln erzeugt
  const valid = (u, v) => {
    if (mat && mat[u] !== mat[v]) return false;
    if (border[u] === 2 && border[v] !== 2) return false;
    if (border[u] === 1 && !border[v]) return false;
    const vx = P[v * 3], vy = P[v * 3 + 1], vz = P[v * 3 + 2];
    for (const f of vf[u]) {
      if (!alive[f]) continue;
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      if (a === v || b === v || c === v) continue;
      faceNormal(f, n0, 0);
      // neue Normale
      const pa = a === u ? v : a, pb = b === u ? v : b, pc = c === u ? v : c;
      const ax = pa === v ? vx : P[pa * 3], ay = pa === v ? vy : P[pa * 3 + 1], az = pa === v ? vz : P[pa * 3 + 2];
      const ux = (pb === v ? vx : P[pb * 3]) - ax, uy = (pb === v ? vy : P[pb * 3 + 1]) - ay, uz = (pb === v ? vz : P[pb * 3 + 2]) - az;
      const wx = (pc === v ? vx : P[pc * 3]) - ax, wy = (pc === v ? vy : P[pc * 3 + 1]) - ay, wz = (pc === v ? vz : P[pc * 3 + 2]) - az;
      n1[0] = uy * wz - uz * wy; n1[1] = uz * wx - ux * wz; n1[2] = ux * wy - uy * wx;
      const l0 = Math.hypot(n0[0], n0[1], n0[2]), l1 = Math.hypot(n1[0], n1[1], n1[2]);
      if (l1 < 1e-14) return false;
      if ((n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1 + 1e-30) < (o.minDot ?? 0.35)) return false;
      // Nadeln: Fläche / längste Kante²
      const e1 = ux * ux + uy * uy + uz * uz, e2 = wx * wx + wy * wy + wz * wz, e3 = (wx - ux) ** 2 + (wy - uy) ** 2 + (wz - uz) ** 2;
      const q = l1 / Math.max(e1, e2, e3);
      if (q < (o.minQuality ?? 0.08)) return false;
    }
    // Verbindungsbedingung (Link): gemeinsame Nachbarn von u und v müssen genau die 2 Gegenecken sein
    const nu = neighbors(u), nvv = neighbors(v);
    let common = 0; for (const w of nu) if (nvv.has(w)) common++;
    if (common > 2 && !o.relaxed) return false;
    return true;
  };
  const evaluate = (u) => {
    if (removed[u]) return;
    let bestC = Infinity, bestV = -1;
    for (const v of neighbors(u)) {
      const c = qerr(u * 10, v * 10, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      if (c < bestC && valid(u, v)) { bestC = c; bestV = v; }
    }
    best[u] = bestV;
    if (bestV >= 0) { curKey[u] = Math.max(0, bestC); heap.push(curKey[u], u); } else curKey[u] = -1;
  };
  const curKey = new Float64Array(nv);
  for (let u = 0; u < nv; u++) evaluate(u);
  const maxErr = o.maxError ?? Infinity;
  let guard = 0;
  while (faces > target && heap.size && guard++ < nv * 400) {
    const key = heap.topKey();
    const u = heap.pop();
    if (removed[u] || best[u] < 0 || key !== curKey[u]) continue; // veralteter Eintrag
    const v = best[u];
    if (removed[v]) { evaluate(u); continue; }
    const c = qerr(u * 10, v * 10, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    if (c > maxErr) break;
    if (!valid(u, v)) { evaluate(u); continue; }
    // Kollaps u → v
    const touched = neighbors(u);
    for (const f of vf[u]) {
      if (!alive[f]) continue;
      const a = F[f * 3], b = F[f * 3 + 1], cc = F[f * 3 + 2];
      if (a === v || b === v || cc === v) { alive[f] = 0; faces--; continue; }
      for (let k = 0; k < 3; k++) if (F[f * 3 + k] === u) F[f * 3 + k] = v;
      vf[v].push(f);
    }
    vf[u] = [];
    removed[u] = 1;
    for (let q = 0; q < 10; q++) Q[v * 10 + q] += Q[u * 10 + q];
    if (border[u] && !border[v]) border[v] = border[u];
    // Liste von v aufräumen
    vf[v] = vf[v].filter((f) => alive[f]);
    evaluate(v);
    for (const w of touched) if (w !== v) evaluate(w);
    for (const w of neighbors(v)) evaluate(w);
  }
  // Kompaktieren
  const map = new Int32Array(nv).fill(-1);
  let n = 0;
  const outIdx = [];
  for (let f = 0; f < nf; f++) {
    if (!alive[f]) continue;
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    if (a === b || b === c || a === c) continue;
    for (const w of [a, b, c]) { if (map[w] < 0) map[w] = n++; outIdx.push(map[w]); }
  }
  const outP = new Float64Array(n * 3);
  for (let i = 0; i < nv; i++) if (map[i] >= 0) { outP[map[i] * 3] = P[i * 3]; outP[map[i] * 3 + 1] = P[i * 3 + 1]; outP[map[i] * 3 + 2] = P[i * 3 + 2]; }
  return { positions: outP, indices: Uint32Array.from(outIdx), map };
}

/** Doppelte Positionen verschmelzen + entartete Dreiecke entfernen */
export function weld(positions, indices, eps = 1e-7) {
  const n = positions.length / 3, map = new Int32Array(n), keyMap = new Map();
  const inv = 1 / eps;
  let m = 0; const out = [];
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(positions[i * 3] * inv)},${Math.round(positions[i * 3 + 1] * inv)},${Math.round(positions[i * 3 + 2] * inv)}`;
    let j = keyMap.get(k);
    if (j === undefined) { j = m++; keyMap.set(k, j); out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); }
    map[i] = j;
  }
  const idx = [];
  for (let f = 0; f < indices.length; f += 3) {
    const a = map[indices[f]], b = map[indices[f + 1]], c = map[indices[f + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: Float64Array.from(out), indices: Uint32Array.from(idx) };
}
