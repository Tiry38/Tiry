// Aetherfront – Mocap-Werkzeuge (Node): BVH lesen, Vorwärtskinematik, Retargeting auf das Helden-Skelett
// (src/render/hero/rig.js), Aufräumen (Wurzelbewegung, Schleifen, Fußkontakte) und Kompression.
// Wird von scripts/mocap-import.mjs und test/mocap.test.mjs benutzt.
import * as THREE from 'three';
import { makeSkeleton, CORE_JOINTS } from '../src/render/hero/rig.js';
import { solveTwoBone } from '../src/render/hero/mocap.js';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
// BVH
// ---------------------------------------------------------------------------------------------
export function parseBVH(text) {
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = [];
  const byName = {};
  const readJoint = (parent) => {
    const kind = tok[i++]; // ROOT/JOINT/End
    let name;
    if (kind === 'End') { i++; name = (parent ? parent.name : 'root') + '_end'; } else name = tok[i++];
    if (tok[i++] !== '{') throw new Error('BVH: { erwartet bei ' + name);
    const j = { name, parent: parent ? parent.index : -1, offset: [0, 0, 0], channels: [], children: [], end: kind === 'End', index: joints.length };
    joints.push(j); byName[name] = j;
    if (parent) parent.children.push(j.index);
    while (tok[i] !== '}') {
      const t = tok[i++];
      if (t === 'OFFSET') { j.offset = [+tok[i++], +tok[i++], +tok[i++]]; }
      else if (t === 'CHANNELS') { const n = +tok[i++]; for (let k = 0; k < n; k++) j.channels.push(tok[i++]); }
      else if (t === 'JOINT' || t === 'End') { i--; readJoint(j); }
      else throw new Error('BVH: unerwartet ' + t);
    }
    i++;
  };
  if (tok[i++] !== 'HIERARCHY') throw new Error('BVH: HIERARCHY fehlt');
  readJoint(null);
  if (tok[i++] !== 'MOTION') throw new Error('BVH: MOTION fehlt');
  i++; const nFrames = +tok[i++];
  i += 2; const frameTime = +tok[i++];
  let nCh = 0; for (const j of joints) { j.chOff = nCh; nCh += j.channels.length; }
  const data = new Float32Array(nFrames * nCh);
  for (let f = 0; f < nFrames * nCh; f++) data[f] = +tok[i++];
  return { joints, byName, nFrames, frameTime, nCh, data };
}

/** Globale Positionen/Rotationen aller Gelenke für Bild f (Einheiten der Datei, Y oben) */
export function fkFrame(bvh, f, out) {
  const { joints, nCh, data } = bvh;
  const base = f * nCh;
  out = out || { pos: joints.map(() => new THREE.Vector3()), rot: joints.map(() => new THREE.Quaternion()) };
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), ax = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
  const v = new THREE.Vector3();
  for (const j of joints) {
    const lp = v.set(j.offset[0], j.offset[1], j.offset[2]);
    q.identity();
    for (let c = 0; c < j.channels.length; c++) {
      const ch = j.channels[c], val = data[base + j.chOff + c];
      if (ch.endsWith('position')) lp.setComponent('XYZ'.indexOf(ch[0]), val + j.offset['XYZ'.indexOf(ch[0])]);
      else q.multiply(qa.setFromAxisAngle(ax[ch[0]], val * D2R));
    }
    if (j.parent < 0) { out.pos[j.index].copy(lp); out.rot[j.index].copy(q); }
    else {
      const pr = out.rot[j.parent];
      out.pos[j.index].copy(lp).applyQuaternion(pr).add(out.pos[j.parent]);
      out.rot[j.index].copy(pr).multiply(q);
    }
  }
  return out;
}

/** Ruhe-Positionen (alle Rotationen 0) */
export function restPositions(bvh) {
  const P = [];
  for (const j of bvh.joints) {
    const o = new THREE.Vector3(...j.offset);
    P.push(j.parent < 0 ? o : o.add(P[j.parent]));
  }
  return P;
}

// ---------------------------------------------------------------------------------------------
// Retargeting
// ---------------------------------------------------------------------------------------------
// Ziel-Gelenk ← [Quell-Gelenk, Quell-Spitze (für Knochenrichtung) | null = keine Ausrichtung]
export const CMU_MAP = {
  hips: ['Hips', null], spine: ['Spine', 'Spine1'], chest: ['Spine1', 'Neck1'], neck: ['Neck1', 'Head'], head: ['Head', null],
  shoulderL: ['LeftShoulder', 'LeftArm'], upperArmL: ['LeftArm', 'LeftForeArm'], foreArmL: ['LeftForeArm', 'LeftHand'], handL: ['LeftHand', 'LeftHandIndex1'],
  shoulderR: ['RightShoulder', 'RightArm'], upperArmR: ['RightArm', 'RightForeArm'], foreArmR: ['RightForeArm', 'RightHand'], handR: ['RightHand', 'RightHandIndex1'],
  thighL: ['LeftUpLeg', 'LeftLeg'], shinL: ['LeftLeg', 'LeftFoot'], footL: ['LeftFoot', null],
  thighR: ['RightUpLeg', 'RightLeg'], shinR: ['RightLeg', 'RightFoot'], footR: ['RightFoot', null],
};
const TIP = { spine: 'chest', chest: 'neck', neck: 'head', shoulderL: 'upperArmL', upperArmL: 'foreArmL', foreArmL: 'handL', shoulderR: 'upperArmR', upperArmR: 'foreArmR', foreArmR: 'handR', thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR' };

/** Kanonisches Ziel-Skelett (1,85 m Standardheld) */
export function targetSkeleton() {
  const sk = makeSkeleton({});
  const rest = {}; for (const n of CORE_JOINTS) rest[n] = sk.J[n].pos.clone();
  const parent = {}; for (const n of CORE_JOINTS) parent[n] = sk.J[n].parent;
  return { rest, parent, order: CORE_JOINTS.slice() };
}

/**
 * Retarget: liefert pro Bild { hips: Vector3 (Modellraum, m), q: {joint: lokale Quaternion} } bei Ziel-fps.
 * opt: { from, to (Sekunden), fps }
 */
export function retarget(bvh, tgt, opt = {}) {
  const srcRest = restPositions(bvh);
  const idx = (n) => { const j = bvh.byName[n]; if (!j) throw new Error('BVH-Gelenk fehlt: ' + n); return j.index; };
  // Ausrichtungen A_j: G_tgt = G_src * A_j ; A_j * d_t = d_s
  const A = {};
  const handTip = (side) => tgt.rest['hand' + side].clone().sub(tgt.rest['foreArm' + side]);
  for (const n of tgt.order) {
    const [s, tip] = CMU_MAP[n];
    if (!tip) { A[n] = new THREE.Quaternion(); continue; }
    const ds = srcRest[idx(tip)].clone().sub(srcRest[idx(s)]).normalize();
    const dt = (n.startsWith('hand') ? handTip(n.slice(-1)) : tgt.rest[TIP[n]].clone().sub(tgt.rest[n])).normalize();
    A[n] = new THREE.Quaternion().setFromUnitVectors(dt, ds);
  }
  // Maßstab: Beinlänge (Hüfte→Knöchel in Ruhe)
  const srcLeg = srcRest[idx('LeftUpLeg')].distanceTo(srcRest[idx('LeftLeg')]) + srcRest[idx('LeftLeg')].distanceTo(srcRest[idx('LeftFoot')]);
  const tgtLeg = tgt.rest.thighL.distanceTo(tgt.rest.shinL) + tgt.rest.shinL.distanceTo(tgt.rest.footL);
  const scale = tgtLeg / srcLeg;
  // Bodenhöhe der Quelle: Ruhe-Knöchelhöhe ↔ Ziel-Knöchelhöhe
  const fk0 = fkFrame(bvh, 0), ankles = [];
  for (let f = 1; f < bvh.nFrames; f += 2) { fkFrame(bvh, f, fk0); ankles.push(fk0.pos[idx('LeftFoot')].y, fk0.pos[idx('RightFoot')].y); }
  ankles.sort((a, b) => a - b);
  const srcFloor = opt.srcFloor ?? ankles[Math.floor(ankles.length * 0.05)];
  const fps = opt.fps || 30;
  const t0 = opt.from ?? 0, t1 = Math.min(opt.to ?? Infinity, (bvh.nFrames - 1) * bvh.frameTime);
  const n = Math.max(2, Math.floor((t1 - t0) * fps) + 1);
  const fkA = fkFrame(bvh, 0), fkB = fkFrame(bvh, 0);
  const G = {};
  const frames = [];
  const qs = new THREE.Quaternion();
  for (let k = 0; k < n; k++) {
    const tf = (t0 + k / fps) / bvh.frameTime;
    const f0 = Math.min(bvh.nFrames - 1, Math.floor(tf)), f1 = Math.min(bvh.nFrames - 1, f0 + 1), u = tf - f0;
    fkFrame(bvh, f0, fkA); fkFrame(bvh, f1, fkB);
    const q = {};
    for (const nme of tgt.order) {
      const si = idx(CMU_MAP[nme][0]);
      qs.copy(fkA.rot[si]).slerp(fkB.rot[si], u);
      G[nme] = qs.clone().multiply(A[nme]);
    }
    for (const nme of tgt.order) {
      const p = tgt.parent[nme];
      q[nme] = p ? G[p].clone().invert().multiply(G[nme]) : G[nme].clone();
    }
    const hi = idx('Hips');
    const hp = fkA.pos[hi].clone().lerp(fkB.pos[hi], u);
    // Hüfte in Ziel-Einheiten; Höhe so, dass Ruhe-Knöchel auf Ziel-Knöchelhöhe liegt
    const hips = new THREE.Vector3(hp.x * scale, (hp.y - srcFloor) * scale + tgt.rest.footL.y, hp.z * scale);
    frames.push({ hips, q });
  }
  return { frames, fps, scale };
}

// ---------------------------------------------------------------------------------------------
// FK auf dem Ziel-Skelett
// ---------------------------------------------------------------------------------------------
export function targetFK(tgt, fr) {
  const P = {}, G = {};
  for (const n of tgt.order) {
    const p = tgt.parent[n];
    if (!p) { G[n] = fr.q[n].clone(); P[n] = fr.hips.clone(); continue; }
    G[n] = G[p].clone().multiply(fr.q[n]);
    P[n] = tgt.rest[n].clone().sub(tgt.rest[p]).applyQuaternion(G[p]).add(P[p]);
  }
  return { P, G };
}

// ---------------------------------------------------------------------------------------------
// Aufräumen
// ---------------------------------------------------------------------------------------------
const yawOf = (q) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };

/** dreht alle Bilder um die Y-Achse (Hüfte + Wurzelrotation) */
export function rotateFrames(frames, yaw, pivot = new THREE.Vector3()) {
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  for (const fr of frames) {
    fr.hips.sub(pivot).applyQuaternion(qy).add(pivot);
    fr.q.hips.premultiply(qy);
  }
}

/** Fußkontakte (0..1) aus Höhe + Bodengeschwindigkeit der Knöchel. vel: Wurzelgeschwindigkeit (In-Place-Schleifen) */
export function footContacts(tgt, frames, fps, vel = new THREE.Vector3(), loop = false) {
  const pos = { L: [], R: [] };
  for (const fr of frames) { const { P } = targetFK(tgt, fr); pos.L.push(P.footL.clone()); pos.R.push(P.footR.clone()); }
  const n = frames.length;
  const out = {};
  for (const s of ['L', 'R']) {
    const ys = pos[s].map((p) => p.y);
    const floor = [...ys].sort((a, b) => a - b)[Math.floor(ys.length * 0.05)];
    out[s] = pos[s].map((p, i) => {
      const ia = loop ? (i - 1 + n) % n : Math.max(0, i - 1), ib = loop ? (i + 1) % n : Math.min(n - 1, i + 1);
      const a = pos[s][ia], b = pos[s][ib], dtt = (loop ? 2 : ib - ia) / fps || 1;
      const sp = Math.hypot(b.x - a.x + vel.x * dtt, b.z - a.z + vel.z * dtt) / dtt;
      const h = p.y - floor;
      return (h < 0.04 ? 1 : h < 0.08 ? 1 - (h - 0.04) / 0.04 : 0) * (sp < 0.45 ? 1 : sp < 1.0 ? 1 - (sp - 0.45) / 0.55 : 0);
    });
    out[s + 'pos'] = pos[s];
    out[s + 'floor'] = floor;
  }
  return out;
}

/**
 * Schleife suchen: Periode T (Bilder) und Start s, sodass Pose(s) ≈ Pose(s+T) und Geschwindigkeiten passen.
 * range: [minSec, maxSec]
 */
export function findLoop(tgt, frames, fps, range, win = null) {
  const n = frames.length;
  const feat = frames.map((fr, i) => {
    const v = [];
    for (const nm of tgt.order) { if (nm === 'hips') continue; const q = fr.q[nm]; v.push(q.x, q.y, q.z, q.w); }
    const qh = fr.q.hips; const up = new THREE.Vector3(0, 1, 0).applyQuaternion(qh); v.push(up.x * 2, up.z * 2);
    v.push(fr.hips.y * 4);
    const nx = frames[Math.min(n - 1, i + 1)], pv = frames[Math.max(0, i - 1)];
    v.push((nx.hips.y - pv.hips.y) * fps * 0.3);
    return v;
  });
  const dist = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2; return d; };
  let best = { d: Infinity };
  const minT = Math.round(range[0] * fps), maxT = Math.round(range[1] * fps);
  const s0 = win ? Math.round(win[0] * fps) : Math.round(n * 0.1), s1 = win ? Math.round(win[1] * fps) : Math.round(n * 0.6);
  for (let s = s0; s <= s1; s++) for (let T = minT; T <= maxT && s + T + 1 < n; T++) {
    let d = dist(feat[s], feat[s + T]) + 0.5 * dist(feat[s + 1], feat[s + T + 1]);
    d += 0.002 * Math.abs(s - (s0 + s1) / 2) / fps; // Mitte bevorzugen
    if (d < best.d) best = { d, s, T };
  }
  return best;
}

/** Ausschnitt [s, s+T] → nahtlose Schleife (Rest-Differenz linear auf alle Bilder verteilt), T Bilder */
export function makeLoop(frames, s, T, { rootVel = true } = {}) {
  const seg = frames.slice(s, s + T + 1).map((f) => ({ hips: f.hips.clone(), q: Object.fromEntries(Object.entries(f.q).map(([k, v]) => [k, v.clone()])) }));
  const a = seg[0], b = seg[T], a0 = a.hips.clone();
  // Wurzelbewegung: horizontale Durchschnittsgeschwindigkeit herausrechnen
  const disp = new THREE.Vector3(b.hips.x - a0.x, 0, b.hips.z - a0.z);
  for (let i = 0; i <= T; i++) { const k = i / T; seg[i].hips.x -= a0.x + disp.x * k; seg[i].hips.z -= a0.z + disp.z * k; }
  // Höhen-/Rotationsdrift verteilen
  const dy = seg[T].hips.y - seg[0].hips.y;
  const dq = {};
  for (const k of Object.keys(a.q)) dq[k] = seg[0].q[k].clone().multiply(seg[T].q[k].clone().invert()); // so dass dq*q_T = q_0
  const I = new THREE.Quaternion();
  for (let i = 0; i <= T; i++) {
    const k = i / T;
    seg[i].hips.y -= dy * k;
    seg[i].hips.x -= (seg[T].hips.x - seg[0].hips.x) * k;
    seg[i].hips.z -= (seg[T].hips.z - seg[0].hips.z) * k;
    for (const key of Object.keys(dq)) {
      const corr = I.clone().slerp(dq[key], k);
      seg[i].q[key].premultiply(corr);
    }
  }
  seg.pop(); // letztes Bild = erstes
  return { frames: seg, disp: rootVel ? disp : null };
}

/** Boden: 5-%-Perzentil der tieferen Knöchelhöhe je Bild → Ziel-Knöchelhöhe (Hüfte entsprechend verschieben) */
export function groundFrames(tgt, frames, pct = 0.05) {
  const lows = frames.map((fr) => { const { P } = targetFK(tgt, fr); return Math.min(P.footL.y, P.footR.y); }).sort((a, b) => a - b);
  const d = lows[Math.floor(lows.length * pct)] - tgt.rest.footL.y;
  for (const fr of frames) fr.hips.y -= d;
  return d;
}

/** Stand zentrieren: mittlere Fußmitte (xz) auf den Ursprung */
export function centerFrames(tgt, frames) {
  const m = new THREE.Vector3();
  for (const fr of frames) { const { P } = targetFK(tgt, fr); m.add(P.footL).add(P.footR); }
  m.divideScalar(frames.length * 2);
  for (const fr of frames) { fr.hips.x -= m.x; fr.hips.z -= m.z; }
}

/** Quaternionen kontinuierlich machen (Vorzeichen) */
export function fixSigns(frames) {
  for (let i = 1; i < frames.length; i++) for (const k of Object.keys(frames[i].q)) if (frames[i].q[k].dot(frames[i - 1].q[k]) < 0) { const q = frames[i].q[k]; q.set(-q.x, -q.y, -q.z, -q.w); }
}

/** leichte Glättung (zeitlich, Fenster 3) gegen Mocap-Zittern */
export function smoothFrames(frames, loop, passes = 1) {
  for (let p = 0; p < passes; p++) {
    const n = frames.length;
    const src = frames.map((f) => ({ hips: f.hips.clone(), q: Object.fromEntries(Object.entries(f.q).map(([k, v]) => [k, v.clone()])) }));
    for (let i = 0; i < n; i++) {
      const a = loop ? src[(i - 1 + n) % n] : src[Math.max(0, i - 1)], b = loop ? src[(i + 1) % n] : src[Math.min(n - 1, i + 1)];
      frames[i].hips.copy(src[i].hips).multiplyScalar(0.5).addScaledVector(a.hips, 0.25).addScaledVector(b.hips, 0.25);
      for (const k of Object.keys(frames[i].q)) {
        const qa = a.q[k].clone(), qb = b.q[k].clone(), qc = src[i].q[k];
        if (qa.dot(qc) < 0) qa.set(-qa.x, -qa.y, -qa.z, -qa.w);
        if (qb.dot(qc) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
        frames[i].q[k].set(qc.x * 0.5 + qa.x * 0.25 + qb.x * 0.25, qc.y * 0.5 + qa.y * 0.25 + qb.y * 0.25, qc.z * 0.5 + qa.z * 0.25 + qb.z * 0.25, qc.w * 0.5 + qa.w * 0.25 + qb.w * 0.25).normalize();
      }
    }
  }
}

/**
 * Fußfixierung (Foot-Lock) in einer In-Place-Schleife mit Geschwindigkeit vel (m/s, Modellraum):
 * Während Kontakt bewegt sich der Fuß exakt mit −vel (Boden läuft unter dem Helden durch) und steht auf dem Boden.
 * Korrektur per 2-Knochen-IK, an Kontakträndern weich ein-/ausgeblendet. Für Nicht-Schleifen vel = 0.
 */
export function footLock(tgt, frames, fps, contacts, vel, loop) {
  const n = frames.length;
  for (const s of ['L', 'R']) {
    const c = contacts[s];
    // Kontaktabschnitte finden (zyklisch bei Schleifen)
    const on = c.map((x) => x > 0.5);
    const segs = [];
    let start = -1;
    const N = loop ? n * 2 : n;
    for (let i = 0; i < N; i++) {
      const v = on[i % n];
      if (v && start < 0) start = i;
      if ((!v || i === N - 1) && start >= 0) { const end = v ? i : i - 1; if (end - start >= 1) segs.push([start, end]); start = -1; }
    }
    const done = new Set();
    for (const [a, b] of segs) {
      if (loop && a >= n) continue;
      if (b - a + 1 >= n) continue;
      // Anker: Mitte des Kontakts
      const m = Math.round((a + b) / 2);
      const pm = contacts[s + 'pos'][m % n].clone();
      for (let i = a - 3; i <= b + 3; i++) {
        if (!loop && (i < 0 || i >= n)) continue;
        const fi = ((i % n) + n) % n;
        if (done.has(fi + ':' + a)) continue;
        // Blend-Gewicht an den Rändern
        const w = i < a ? 1 - (a - i) / 4 : i > b ? 1 - (i - b) / 4 : 1;
        if (w <= 0) continue;
        const target = pm.clone();
        target.x -= vel.x * (i - m) / fps; target.z -= vel.z * (i - m) / fps;
        const cur = contacts[s + 'pos'][fi];
        target.y = Math.max(cur.y, tgt.rest.footL.y);
        target.lerp(cur, 1 - w * c[fi] ** 0.5 * (i < a || i > b ? 0.6 : 1));
        applyLegIK(tgt, frames[fi], s, target);
      }
    }
  }
}

/** Bein-IK auf ein Bild anwenden (Knöchel auf target, Fußorientierung global erhalten) */
export function applyLegIK(tgt, fr, s, target) {
  const { P, G } = targetFK(tgt, fr);
  const th = 'thigh' + s, sh = 'shin' + s, ft = 'foot' + s;
  const footG = G[ft].clone();
  const res = solveTwoBone(P[th], P[sh], P[ft], target, G[th], G[sh]);
  if (!res) return;
  // neue globale Rotationen → lokale
  const hipsG = G.hips;
  fr.q[th] = hipsG.clone().invert().multiply(res.g1);
  fr.q[sh] = res.g1.clone().invert().multiply(res.g2);
  fr.q[ft] = res.g2.clone().invert().multiply(footG);
}

// ---------------------------------------------------------------------------------------------
// Kompression: Quaternionen auf int16 (x,y,z,w ×32767), Hüfte int16 in mm
// ---------------------------------------------------------------------------------------------
export function encodeClip(tgt, frames) {
  const J = tgt.order;
  const q = new Int16Array(frames.length * J.length * 4);
  const h = new Int16Array(frames.length * 3);
  frames.forEach((fr, i) => {
    J.forEach((n, k) => { const o = (i * J.length + k) * 4, qq = fr.q[n]; const sgn = qq.w < 0 ? -1 : 1; q[o] = Math.round(qq.x * sgn * 32767); q[o + 1] = Math.round(qq.y * sgn * 32767); q[o + 2] = Math.round(qq.z * sgn * 32767); q[o + 3] = Math.round(qq.w * sgn * 32767); });
    h[i * 3] = Math.round(fr.hips.x * 1000); h[i * 3 + 1] = Math.round(fr.hips.y * 1000); h[i * 3 + 2] = Math.round(fr.hips.z * 1000);
  });
  return { q, h };
}
