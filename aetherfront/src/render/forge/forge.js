// Aether-Forge – Pipeline (nur Node/Backen): Bildhauen → Vernetzen → LOD-Kette (Quadrik) → Backen → Skin → .afm
import { Sculpt, Group } from './sdf.js';
import { meshSDF } from './mesher.js';
import { decimate } from './decimate.js';
import { makeQuery, bakeVertices, MATS } from './bake.js';
import { skinVertices, adjacency, makeSegments } from './skin.js';
import { encodeAFM } from './format.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * def: {
 *   id, kind: 'hero'|'unit', palette, skeleton: { names, parents, rest, seg? }, scale,
 *   build(S, ctx) → info, cell (m), budgets: [LOD0, LOD1, LOD2] (Dreiecke gesamt), info (zusätzlich)
 * }
 */
export function forgeAsset(def, log = () => {}) {
  const t0 = now();
  const cell0 = def.cell || 0.008;
  const S = new Sculpt({ palette: def.palette, minTh: cell0 * 2.2, minThFine: cell0 * (def.fineK || 0.5) * 2.2 });
  const info = def.build(S, def.ctx || {}) || {};
  const roots = S.finish();
  const keys = Object.keys(roots).filter((k) => roots[k].children.length);
  const tSculpt = now();
  // Verdecker: alle Körper-Stufen
  const occG = new Group({});
  for (const k of keys) if (k.startsWith('body@')) occG.children.push(roots[k]);
  occG.finalize();
  const occ = makeQuery(occG, 0.1 * (def.scale || 1), 0.25 * (def.scale || 1));
  const cell = def.cell || 0.008;
  // 1) Vernetzen
  const hi = {};
  let hiTris = 0;
  for (const k of keys) {
    const full = k.split('@')[0], layer = full.split(':')[0];
    const h = full.endsWith(':fine') ? cell * (def.fineK || 0.5) : layer === 'body' ? cell : cell * (def.glowCellK || 0.42);
    const m = meshSDF(roots[k], h);
    hi[k] = m;
    hiTris += m.indices.length / 3;
    log(`  ${k}: ${m.positions.length / 3} V, ${m.indices.length / 3} Δ (${m.bricks} Ziegel)`);
  }
  const tMesh = now();
  // 2) Materialschlüssel (Grenzen schützen) auf dem hochaufgelösten Netz
  const queries = {};
  for (const k of keys) queries[k] = makeQuery(roots[k], 0.05 * (def.scale || 1), 0.03 * (def.scale || 1));
  const keyIds = new Map();
  const matKey = (a) => {
    if (!a) return 0;
    const ks = `${a.mat}|${typeof a.col === 'string' ? a.col : JSON.stringify(a.col)}|${a.bone || ''}`;
    let id = keyIds.get(ks); if (id === undefined) { id = keyIds.size + 1; keyIds.set(ks, id); } return id;
  };
  const budgets = def.budgets || [36000, 10000, 3000];
  const meshes = [];
  const buffers = {};
  const stats = { id: def.id, hiTris, lods: budgets.map(() => 0), verts: budgets.map(() => 0) };
  let tDec = 0, tBake = 0;
  const skel = def.skeleton;
  const segs = skel ? makeSegments(skel, def.scale || 1) : null;
  const wOf = (k) => (k.includes(':fine') ? (def.fineW ?? 0.45) : 1);
  let hiW = 0; for (const k of keys) hiW += (hi[k].indices.length / 3) * wOf(k);
  for (const k of keys) {
    const [full, tierS] = k.split('@');
    const layer = full.split(':')[0];
    const tier = +tierS;
    const m = hi[k];
    const nv = m.positions.length / 3;
    if (!nv) continue;
    const q = queries[k];
    const mk = new Int32Array(nv);
    for (let i = 0; i < nv; i++) { const r = q.attr(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]); mk[i] = matKey(r.a); }
    const share = ((m.indices.length / 3) * wOf(k)) / hiW;
    let cur = { positions: m.positions, indices: m.indices, mat: mk, src: null };
    const entry = { layer, tier, lods: [] };
    // 1) LOD-Kette (Halbkanten-Kollaps: jede Stufe ist eine Teilmenge der vorigen Vertices)
    const chain = [];
    const td = now();
    for (let li = 0; li < budgets.length; li++) {
      const target = Math.max(layer === 'body' ? 120 : 40, Math.round(budgets[li] * share));
      if (cur.indices.length / 3 > target * 1.02) {
        let d = decimate(cur.positions, cur.indices, target, { mat: cur.mat });
        if (!process.env.FORGE_STRICT && d.indices.length / 3 > target * 1.25) d = decimate(cur.positions, cur.indices, target, { mat: cur.mat, relaxed: true, minQuality: 0.03, minDot: 0.2 });
        if (!process.env.FORGE_STRICT && d.indices.length / 3 > target * 1.25) d = decimate(cur.positions, cur.indices, target, { relaxed: true, minQuality: 0.02, minDot: 0.1 });
        log(`    ${k} LOD${li}: ${cur.indices.length / 3} → ${d.indices.length / 3} (Ziel ${target})`);
        const n2 = d.positions.length / 3, nm = new Int32Array(n2), src = new Int32Array(n2);
        for (let i = 0; i < d.map.length; i++) if (d.map[i] >= 0) { nm[d.map[i]] = cur.mat[i]; src[d.map[i]] = cur.src ? cur.src[i] : i; }
        cur = { positions: d.positions, indices: d.indices, mat: nm, src };
      } else if (li === 0) {
        const n2 = cur.positions.length / 3; cur = { ...cur, src: Int32Array.from({ length: n2 }, (_, i) => i) };
      }
      chain.push(cur);
    }
    tDec += now() - td;
    // 2) LOD0 backen + skinnen, niedrigere Stufen übernehmen (Vertex-Teilmengen)
    const tb = now();
    const L0 = chain[0], n0 = L0.positions.length / 3;
    const bk = bakeVertices(L0.positions, q, occ, def.palette || {}, { scale: def.scale || 1, skipBake: layer === 'glow', eps: cell * 0.35, ground: def.kind !== 'part' });
    const adj0 = adjacency(n0, L0.indices);
    // Rückverweis: Original-Index (hochaufgelöst) → LOD0-Index
    const hiTo0 = new Map(); for (let i = 0; i < n0; i++) hiTo0.set(L0.src[i], i);
    let sk = null;
    if (skel) sk = skinVertices(L0.positions, bk.owners, bk.owners2, bk.w2s, skel, adj0, { scale: def.scale || 1, segs, smoothIters: layer === 'glow' ? 1 : 3 });
    let rig0 = null;
    if (def.unitRig) rig0 = def.unitRig(L0.positions, bk.owners, bk.owners2, bk.w2s, adj0);
    let cmax = 1;
    if (layer === 'glow') {
      for (let i = 0; i < n0; i++) { const a = bk.owners[i]; const kk = a?.k ?? 1; bk.slotK[i] *= kk; for (let c = 0; c < 3; c++) { bk.color[i * 3 + c] *= kk; cmax = Math.max(cmax, bk.color[i * 3 + c]); } }
    }
    for (let li = 0; li < chain.length; li++) {
      const C = chain[li], n = C.positions.length / 3;
      const g = new Int32Array(n);
      for (let i = 0; i < n; i++) g[i] = hiTo0.get(C.src[i]);
      const pre = `${k}#${li}`;
      buffers[pre + ':pos'] = Float32Array.from(C.positions);
      const nrm = new Int16Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) nrm[i * 3 + c] = Math.round(Math.max(-1, Math.min(1, bk.normal[g[i] * 3 + c])) * 32767);
      buffers[pre + ':nrm'] = nrm;
      const col = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        const o = g[i];
        for (let c = 0; c < 3; c++) col[i * 4 + c] = Math.round(Math.max(0, Math.min(1, Math.sqrt(Math.max(0, bk.color[o * 3 + c]) / cmax))) * 255); // Gamma 2 für Präzision
        col[i * 4 + 3] = bk.slot[o] ? Math.round(Math.min(1, bk.slotK[o] / 4) * 255) : 0;
      }
      buffers[pre + ':col'] = col;
      const pbr = new Uint8Array(n * 4); for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) pbr[i * 4 + c] = Math.round(Math.max(0, Math.min(1, bk.pbr[g[i] * 4 + c])) * 255);
      buffers[pre + ':pbr'] = pbr;
      if (layer !== 'glow') { const bb = new Int8Array(n * 4); for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) bb[i * 4 + c] = Math.round(Math.max(-1, Math.min(1, bk.bake[g[i] * 4 + c])) * 127); buffers[pre + ':bake'] = bb; }
      if (def.kind !== 'hero') { const sl = new Uint8Array(n); for (let i = 0; i < n; i++) sl[i] = bk.slot[g[i]]; buffers[pre + ':slot'] = sl; }
      if (sk) {
        const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
        for (let i = 0; i < n; i++) {
          const o = g[i];
          let acc = 0, mx = 0, mi = 0;
          for (let c = 0; c < 4; c++) { si[i * 4 + c] = sk.index[o * 4 + c]; const v = Math.round(sk.weight[o * 4 + c] * 255); sw[i * 4 + c] = v; acc += v; if (v > mx) { mx = v; mi = c; } }
          sw[i * 4 + mi] += 255 - acc;
        }
        buffers[pre + ':si'] = si; buffers[pre + ':sw'] = sw;
      }
      if (rig0) { const r = new Float32Array(n * 4); for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) r[i * 4 + c] = rig0[g[i] * 4 + c]; buffers[pre + ':rig'] = r; }
      buffers[pre + ':idx'] = n < 65536 ? Uint16Array.from(C.indices) : Uint32Array.from(C.indices);
      entry.lods.push({ n, tris: C.indices.length / 3, cmax, key: pre });
      stats.lods[li] += C.indices.length / 3; stats.verts[li] += n;
    }
    tBake += now() - tb;
    meshes.push(entry);
  }
  const header = {
    format: 'aether-forge', version: 1, kind: def.kind, id: def.id, palette: def.palette, scale: def.scale || 1,
    skeleton: skel ? { names: skel.names, parents: skel.parents, rest: skel.rest } : null,
    info: { ...(def.info || {}), ...info }, meshes,
  };
  const bytes = encodeAFM(header, buffers);
  stats.ms = { sculpt: Math.round(tSculpt - t0), mesh: Math.round(tMesh - tSculpt), decimate: Math.round(tDec), bake: Math.round(tBake), total: Math.round(now() - t0) };
  stats.bytes = bytes.length;
  void MATS;
  return { bytes, header, stats };
}
