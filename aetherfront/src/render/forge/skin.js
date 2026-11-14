// Aether-Forge – automatische Skin-Gewichte.
// Jeder Vertex kennt sein Besitzer-Primitiv (aus dem SDF). Dessen Bindung entscheidet:
//   bone: 'weaponR'           → starr an einem Knochen
//   bind: (p) → [[bone,w],..] → eigene Gewichtsfunktion
//   region: ['upperArmL',…]   → Hüllkörper-Bindung: nächstes Knochensegment der Region, an Gelenken weich
//                               überblendet (Ebene durch das Gelenk, senkrecht zum Kind-Knochen)
// Danach Glättung über die Netz-Nachbarschaft (keine harten Knicke an Primitiv-Grenzen).

const REGIONS = {
  torso: ['hips', 'spine', 'chest', 'neck'],
  upper: ['spine', 'chest', 'neck', 'shoulderL', 'shoulderR'],
  pelvis: ['hips', 'spine', 'thighL', 'thighR'],
  skirt: ['hips', 'thighL', 'thighR', 'shinL', 'shinR'],
  head: ['neck', 'head'],
  neck: ['chest', 'neck', 'head'],
  armL: ['shoulderL', 'upperArmL', 'foreArmL', 'handL'],
  armR: ['shoulderR', 'upperArmR', 'foreArmR', 'handR'],
  shoulderL: ['chest', 'shoulderL', 'upperArmL'],
  shoulderR: ['chest', 'shoulderR', 'upperArmR'],
  legL: ['hips', 'thighL', 'shinL', 'footL'],
  legR: ['hips', 'thighR', 'shinR', 'footR'],
  body: ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'foreArmL', 'handL', 'shoulderR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'],
};
export { REGIONS };

// Überblendbreiten an Gelenken (m, bei Maßstab 1) – benannt nach dem Kind-Knochen
const BLEND = {
  spine: 0.07, chest: 0.08, neck: 0.04, head: 0.035, upperArmL: 0.05, upperArmR: 0.05, foreArmL: 0.035, foreArmR: 0.035,
  handL: 0.022, handR: 0.022, thighL: 0.05, thighR: 0.05, shinL: 0.04, shinR: 0.04, footL: 0.03, footR: 0.03,
  shoulderL: 0.05, shoulderR: 0.05,
};

/**
 * skel: { names, parents (Index oder -1), rest: [[x,y,z],...], seg?: {name: [[ax,ay,az],[bx,by,bz]]} }
 */
export function makeSegments(skel, scale = 1) {
  const idx = Object.fromEntries(skel.names.map((n, i) => [n, i]));
  const kids = skel.names.map(() => []);
  skel.parents.forEach((p, i) => { if (p >= 0) kids[p].push(i); });
  const PRIMARY = {
    hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', shoulderL: 'upperArmL', upperArmL: 'foreArmL', foreArmL: 'handL',
    shoulderR: 'upperArmR', upperArmR: 'foreArmR', foreArmR: 'handR', thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR',
  };
  const segs = {};
  for (let i = 0; i < skel.names.length; i++) {
    const n = skel.names[i], a = skel.rest[i];
    let b = null;
    if (skel.seg && skel.seg[n]) { segs[n] = { a: skel.seg[n][0], b: skel.seg[n][1], parent: skel.parents[i] >= 0 ? skel.names[skel.parents[i]] : null }; continue; }
    if (PRIMARY[n] && idx[PRIMARY[n]] !== undefined) b = skel.rest[idx[PRIMARY[n]]];
    else if (/^hand[LR]$/.test(n)) { const p = skel.rest[skel.parents[i]]; const d = [a[0] - p[0], a[1] - p[1], a[2] - p[2]]; const l = Math.hypot(...d) || 1; b = [a[0] + d[0] / l * 0.08 * scale, a[1] + d[1] / l * 0.08 * scale, a[2] + d[2] / l * 0.08 * scale]; }
    else if (/^foot[LR]$/.test(n)) b = [a[0] * 1.05, Math.max(0.02 * scale, a[1] - 0.06 * scale), a[2] + 0.15 * scale];
    else if (n === 'head') b = [a[0], a[1] + 0.2 * scale, a[2] + 0.02 * scale];
    else if (kids[i].length === 1) b = skel.rest[kids[i][0]];
    else b = a;
    segs[n] = { a, b, parent: skel.parents[i] >= 0 ? skel.names[skel.parents[i]] : null };
  }
  // Kinder (primäre Kette)
  for (const [n, s] of Object.entries(segs)) { s.child = PRIMARY[n] || null; if (!s.child) { const ks = kids[idx[n]]; if (ks.length === 1) s.child = skel.names[ks[0]]; } }
  return segs;
}

function segDist(p, s) {
  const ax = s.a[0], ay = s.a[1], az = s.a[2];
  const dx = s.b[0] - ax, dy = s.b[1] - ay, dz = s.b[2] - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 1e-12 ? ((p[0] - ax) * dx + (p[1] - ay) * dy + (p[2] - az) * dz) / l2 : 0;
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * tc - p[0], qy = ay + dy * tc - p[1], qz = az + dz * tc - p[2];
  return { d: Math.sqrt(qx * qx + qy * qy + qz * qz), t, l: Math.sqrt(l2) };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Hüllkörper-Gewichte eines Punktes für eine Knochenmenge */
export function envelope(p, bones, segs, scale = 1) {
  let best = null, bd = Infinity, bt = 0;
  for (const b of bones) {
    const s = segs[b]; if (!s) continue;
    const r = segDist(p, s);
    // leichte Bevorzugung längerer Segmente bei Gleichstand
    const d = r.d - (r.t >= 0 && r.t <= 1 ? 0.002 : 0);
    if (d < bd) { bd = d; best = b; bt = r.t; }
  }
  if (!best) return [[bones[0] || 'hips', 1]];
  const out = new Map([[best, 1]]);
  const s = segs[best];
  // Übergang zum Elternknochen (am Startgelenk) bzw. zum Kind (am Endgelenk)
  const blendAt = (joint, dirFrom, parentBone, childBone) => {
    const dir = [dirFrom.b[0] - dirFrom.a[0], dirFrom.b[1] - dirFrom.a[1], dirFrom.b[2] - dirFrom.a[2]];
    const l = Math.hypot(...dir) || 1;
    const w = (BLEND[childBone] ?? 0.04) * scale;
    const t = ((p[0] - joint[0]) * dir[0] + (p[1] - joint[1]) * dir[1] + (p[2] - joint[2]) * dir[2]) / l;
    const k = smooth(-w, w, t); // 0 = Eltern, 1 = Kind
    return k;
  };
  if (s.parent && bones.includes(s.parent) && segs[s.parent] && bt < 0.5) {
    const k = blendAt(s.a, s, s.parent, best);
    out.set(best, k); out.set(s.parent, (out.get(s.parent) || 0) + 1 - k);
  } else if (s.child && bones.includes(s.child) && segs[s.child] && bt >= 0.5) {
    const c = segs[s.child];
    const k = blendAt(c.a, c, best, s.child);
    out.set(best, 1 - k); out.set(s.child, (out.get(s.child) || 0) + k);
  }
  return [...out.entries()];
}

/**
 * Gewichte für Vertices. owners/owners2/w2: Besitzer-Attribute aus bake. adj: Nachbarlisten (für Glättung).
 * Rückgabe: { index: Uint8Array(4n) (Knochenindex), weight: Float32Array(4n) }
 */
export function skinVertices(verts, owners, owners2, w2s, skel, adj, o = {}) {
  const n = verts.length / 3, scale = o.scale || 1;
  const segs = o.segs || makeSegments(skel, scale);
  const bidx = Object.fromEntries(skel.names.map((nm, i) => [nm, i]));
  const nb = skel.names.length;
  const W = new Float32Array(n * nb);
  const rigid = new Uint8Array(n);
  const p = [0, 0, 0];
  const weightsFor = (a) => {
    if (!a) return envelope(p, REGIONS.body, segs, scale);
    if (a.bone) return [[a.bone, 1]];
    if (typeof a.bind === 'function') return a.bind(p);
    let reg = a.region;
    if (typeof reg === 'string') reg = REGIONS[reg] || [reg];
    return envelope(p, reg || REGIONS.body, segs, scale);
  };
  for (let i = 0; i < n; i++) {
    p[0] = verts[i * 3]; p[1] = verts[i * 3 + 1]; p[2] = verts[i * 3 + 2];
    const a = owners[i], a2 = owners2[i], t = a2 ? Math.min(0.5, w2s[i]) : 0;
    const add = (ws, f) => { for (const [b, w] of ws) { const k = bidx[b]; if (k === undefined) throw new Error('Forge: Knochen fehlt: ' + b); W[i * nb + k] += w * f; } };
    add(weightsFor(a), 1 - t);
    if (t > 0) add(weightsFor(a2), t);
    if (a && a.bone && (!a2 || t < 0.05)) rigid[i] = 1;
  }
  // Glättung über Nachbarn (starre Teile bleiben starr)
  const iters = o.smoothIters ?? 3;
  if (adj && iters) {
    let cur = W, nxt = new Float32Array(W.length);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const row = i * nb;
        if (rigid[i] || !adj[i].length) { for (let k = 0; k < nb; k++) nxt[row + k] = cur[row + k]; continue; }
        for (let k = 0; k < nb; k++) nxt[row + k] = cur[row + k] * 0.5;
        const f = 0.5 / adj[i].length;
        for (const j of adj[i]) { if (rigid[j]) continue; const rj = j * nb; for (let k = 0; k < nb; k++) nxt[row + k] += cur[rj + k] * f; }
        // Nachbarn starr → eigenes Gewicht behalten
        let s = 0; for (let k = 0; k < nb; k++) s += nxt[row + k];
        if (s < 1e-6) for (let k = 0; k < nb; k++) nxt[row + k] = cur[row + k];
        else for (let k = 0; k < nb; k++) nxt[row + k] /= s;
      }
      [cur, nxt] = [nxt, cur];
    }
    W.set(cur);
  }
  // auf 4 Einflüsse reduzieren
  const index = new Uint8Array(n * 4), weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const row = i * nb, top = [];
    for (let k = 0; k < nb; k++) if (W[row + k] > 1e-3) top.push([k, W[row + k]]);
    top.sort((a, b) => b[1] - a[1]);
    let s = 0; for (let k = 0; k < Math.min(4, top.length); k++) s += top[k][1];
    if (!top.length) { index[i * 4] = bidx.hips ?? 0; weight[i * 4] = 1; continue; }
    for (let k = 0; k < Math.min(4, top.length); k++) { index[i * 4 + k] = top[k][0]; weight[i * 4 + k] = top[k][1] / s; }
  }
  return { index, weight };
}

/** Nachbarlisten aus Dreiecksindizes */
export function adjacency(n, indices) {
  const adj = Array.from({ length: n }, () => new Set());
  for (let f = 0; f < indices.length; f += 3) {
    const a = indices[f], b = indices[f + 1], c = indices[f + 2];
    adj[a].add(b); adj[a].add(c); adj[b].add(a); adj[b].add(c); adj[c].add(a); adj[c].add(b);
  }
  return adj.map((s) => [...s]);
}
