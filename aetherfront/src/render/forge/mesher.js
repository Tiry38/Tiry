// Aether-Forge – Vernetzung: dünnbesetzte (Ziegel-)Surface-Nets im schmalen Band um die Nullfläche.
// Ziegel à 8³ Zellen werden nur ausgewertet, wo die Fläche liegen kann (Lipschitz-Test am Ziegelmittelpunkt);
// pro Ziegel wird der Distanzbaum auf die überlappenden Primitive beschnitten. Vertices werden auf die echte
// Nullfläche projiziert (Newton-Schritte entlang des Gradienten) → scharfe, genaue Kanten trotz Gitter.
import { gradient } from './sdf.js';

const BR = 8; // Zellen pro Ziegelkante

/**
 * root: Group (finalisiert). h: Zellgröße (m). Rückgabe: { positions: Float64Array, indices: Uint32Array }
 */
export function meshSDF(root, h, o = {}) {
  const bb = root.box;
  if (!(bb[3] > bb[0])) return { positions: new Float64Array(0), indices: new Uint32Array(0) };
  const pad = 2 * h;
  const x0 = bb[0] - pad, y0 = bb[1] - pad, z0 = bb[2] - pad;
  const nx = Math.ceil((bb[3] - bb[0] + 2 * pad) / h), ny = Math.ceil((bb[4] - bb[1] + 2 * pad) / h), nz = Math.ceil((bb[5] - bb[2] + 2 * pad) / h);
  const bx = Math.ceil(nx / BR), by = Math.ceil(ny / BR), bz = Math.ceil(nz / BR);
  const S = BR + 1;
  const bricks = new Map();     // Ziegelindex → { f: Float32Array(S³), ev }
  const half = (BR * h) / 2, diag = half * Math.sqrt(3);
  const slack = o.slack ?? 1.15;
  let evals = 0;
  // Grob-Durchlauf: aktive Ziegel
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    const cx = x0 + (i * BR + BR / 2) * h, cy = y0 + (j * BR + BR / 2) * h, cz = z0 + (k * BR + BR / 2) * h;
    const m = h * 2;
    const box = [cx - half - m, cy - half - m, cz - half - m, cx + half + m, cy + half + m, cz + half + m];
    const pr = root.prune(box);
    if (!pr) continue;
    const ev = pr.ev;
    const dc = ev(cx, cy, cz); evals++;
    if (Math.abs(dc) > diag * slack + h) continue;
    const f = new Float32Array(S * S * S);
    let pos = 0, neg = 0;
    for (let c = 0; c < S; c++) for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
      const v = ev(x0 + (i * BR + a) * h, y0 + (j * BR + b) * h, z0 + (k * BR + c) * h);
      f[a + S * (b + S * c)] = v;
      if (v > 0) pos++; else neg++;
    }
    evals += S * S * S;
    if (!pos || !neg) continue;
    bricks.set(i + bx * (j + by * k), { f, ev, i, j, k });
  }
  // Eckwert an globalem Gitterpunkt
  const corner = (gi, gj, gk) => {
    let i = Math.floor(gi / BR), j = Math.floor(gj / BR), k = Math.floor(gk / BR);
    let a = gi - i * BR, b = gj - j * BR, c = gk - k * BR;
    let br = bricks.get(i + bx * (j + by * k));
    if (br) return br.f[a + S * (b + S * c)];
    // auf Ziegelgrenze: Nachbar-Ziegel (a==0 → vorheriger Ziegel mit a==BR)
    for (const [di, dj, dk] of [[a === 0 ? -1 : 0, 0, 0], [0, b === 0 ? -1 : 0, 0], [0, 0, c === 0 ? -1 : 0], [a === 0 ? -1 : 0, b === 0 ? -1 : 0, 0], [a === 0 ? -1 : 0, 0, c === 0 ? -1 : 0], [0, b === 0 ? -1 : 0, c === 0 ? -1 : 0], [a === 0 ? -1 : 0, b === 0 ? -1 : 0, c === 0 ? -1 : 0]]) {
      if (!di && !dj && !dk) continue;
      br = bricks.get(i + di + bx * (j + dj + by * (k + dk)));
      if (br) return br.f[(a - di * BR) + S * ((b - dj * BR) + S * (c - dk * BR))];
    }
    return NaN;
  };
  // Zellen mit Vorzeichenwechsel → Vertex
  const cellVert = new Map();
  const P = [];
  const evOf = [];
  const cellKey = (i, j, k) => i + nx * (j + ny * k);
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (const br of bricks.values()) {
    const f = br.f;
    for (let c = 0; c < BR; c++) for (let b = 0; b < BR; b++) for (let a = 0; a < BR; a++) {
      let mask = 0;
      for (let q = 0; q < 8; q++) { const v = f[(a + (q & 1)) + S * ((b + ((q >> 1) & 1)) + S * (c + ((q >> 2) & 1)))]; cv[q] = v; if (v > 0) mask |= 1 << q; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (const [p, q] of EDGES) {
        const va = cv[p], vb = cv[q];
        if ((va > 0) === (vb > 0)) continue;
        const t = va / (va - vb);
        sx += (p & 1) + ((q & 1) - (p & 1)) * t; sy += ((p >> 1) & 1) + (((q >> 1) & 1) - ((p >> 1) & 1)) * t; sz += ((p >> 2) & 1) + (((q >> 2) & 1) - ((p >> 2) & 1)) * t;
        cnt++;
      }
      const gi = br.i * BR + a, gj = br.j * BR + b, gk = br.k * BR + c;
      let px = x0 + (gi + sx / cnt) * h, py = y0 + (gj + sy / cnt) * h, pz = z0 + (gk + sz / cnt) * h;
      // auf die Nullfläche projizieren (innerhalb der Zelle ± halbe Zelle halten)
      const ev = br.ev;
      for (let it = 0; it < 3; it++) {
        const d = ev(px, py, pz);
        if (Math.abs(d) < h * 0.002) break;
        const g = gradient(ev, px, py, pz, h * 0.2);
        px -= g[0] * d; py -= g[1] * d; pz -= g[2] * d;
      }
      const lo = (v, g0) => Math.min(Math.max(v, g0 - 0.5 * h), g0 + 1.5 * h);
      px = lo(px, x0 + gi * h); py = lo(py, y0 + gj * h); pz = lo(pz, z0 + gk * h);
      cellVert.set(cellKey(gi, gj, gk), P.length / 3);
      P.push(px, py, pz);
      evOf.push(br);
    }
  }
  // Kanten mit Vorzeichenwechsel → Viereck aus den 4 angrenzenden Zellen
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a === undefined || b === undefined || c === undefined || d === undefined) return;
    // kürzere Diagonale teilen
    const dac = dist2(P, a, c), dbd = dist2(P, b, d);
    let t;
    if (dac <= dbd) t = [a, b, c, a, c, d]; else t = [a, b, d, b, c, d];
    if (flip) { [t[1], t[2]] = [t[2], t[1]]; [t[4], t[5]] = [t[5], t[4]]; }
    idx.push(...t);
  };
  for (const br of bricks.values()) {
    const f = br.f;
    for (let c = 0; c < BR; c++) for (let b = 0; b < BR; b++) for (let a = 0; a < BR; a++) {
      const gi = br.i * BR + a, gj = br.j * BR + b, gk = br.k * BR + c;
      const v0 = f[a + S * (b + S * c)];
      if (!cellVert.has(cellKey(gi, gj, gk))) continue;
      // Kante +X ab Eckpunkt (a,b,c): Zellen (gi, gj-1..gj, gk-1..gk)
      const vx = f[(a + 1) + S * (b + S * c)], vy = f[a + S * ((b + 1) + S * c)], vz = f[a + S * (b + S * (c + 1))];
      // nur Kanten, deren Startpunkt in diesem Ziegel liegt; Nachbarzellen über globale Schlüssel
      if (gj > 0 && gk > 0 && (v0 > 0) !== (vx > 0)) {
        quad(cellVert.get(cellKey(gi, gj - 1, gk - 1)), cellVert.get(cellKey(gi, gj, gk - 1)), cellVert.get(cellKey(gi, gj, gk)), cellVert.get(cellKey(gi, gj - 1, gk)), v0 > 0);
      }
      if (gi > 0 && gk > 0 && (v0 > 0) !== (vy > 0)) {
        quad(cellVert.get(cellKey(gi - 1, gj, gk - 1)), cellVert.get(cellKey(gi - 1, gj, gk)), cellVert.get(cellKey(gi, gj, gk)), cellVert.get(cellKey(gi, gj, gk - 1)), v0 > 0);
      }
      if (gi > 0 && gj > 0 && (v0 > 0) !== (vz > 0)) {
        quad(cellVert.get(cellKey(gi - 1, gj - 1, gk)), cellVert.get(cellKey(gi, gj - 1, gk)), cellVert.get(cellKey(gi, gj, gk)), cellVert.get(cellKey(gi - 1, gj, gk)), v0 > 0);
      }
    }
  }
  void corner;
  return { positions: Float64Array.from(P), indices: Uint32Array.from(idx), evals, bricks: bricks.size };
}

function dist2(P, a, b) { const dx = P[a * 3] - P[b * 3], dy = P[a * 3 + 1] - P[b * 3 + 1], dz = P[a * 3 + 2] - P[b * 3 + 2]; return dx * dx + dy * dy + dz * dz; }
