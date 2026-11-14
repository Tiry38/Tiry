import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _n2 = new THREE.Vector3();
const _k = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _qr = new THREE.Quaternion();

/**
 * Analytische 2-Knochen-IK (Hüfte A, Knie B, Knöchel C → Ziel T). Kniebeuge-Ebene bleibt erhalten.
 * gA/gB: globale Rotationen von Oberschenkel/Schienbein. Liefert neue globale { g1, g2 } (neue Quaternionen) oder null.
 * poleHint: optionale Knie-Richtung, falls das Bein gestreckt ist.
 */
export function solveTwoBone(A, B, C, T, gA, gB, poleHint, out) {
  const la = _a.copy(B).sub(A).length(), lb = _b.copy(C).sub(B).length();
  if (la < 1e-6 || lb < 1e-6) return null;
  const thOld = _a.normalize(), shOld = _b.normalize();
  // Pol: Knie-Abweichung von der Linie A→C
  _c.copy(C).sub(A); const lc = _c.length() || 1; _c.divideScalar(lc);
  _p.copy(B).sub(A); _p.addScaledVector(_c, -_p.dot(_c));
  if (_p.lengthSq() < 1e-8) { if (poleHint) _p.copy(poleHint); else _p.set(0, 0, 1).applyQuaternion(gA); _p.addScaledVector(_c, -_p.dot(_c)); }
  _p.normalize();
  _n.crossVectors(thOld, shOld);
  if (_n.lengthSq() < 1e-8) _n.crossVectors(thOld, _p);
  _n.normalize();
  // neue Geometrie
  _d.copy(T).sub(A); let d = _d.length();
  d = Math.min(Math.max(d, Math.abs(la - lb) + 1e-4), (la + lb) * 0.99995);
  _d.normalize();
  const cosA = Math.min(1, Math.max(-1, (la * la + d * d - lb * lb) / (2 * la * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _k.copy(_p).addScaledVector(_d, -_p.dot(_d));
  if (_k.lengthSq() < 1e-8) _k.copy(_p); _k.normalize();
  const thNew = _u.copy(_d).multiplyScalar(cosA).addScaledVector(_k, sinA).normalize();
  // Knie-Position und Schienbein-Richtung
  const knee = _w.copy(A).addScaledVector(thNew, la);
  const end = _c.copy(A).addScaledVector(_d, d);
  const shNew = end.sub(knee).normalize();
  _n2.crossVectors(thNew, shNew);
  if (_n2.lengthSq() < 1e-8) _n2.copy(_n); _n2.normalize();
  if (_n2.dot(_n) < 0) _n2.negate();
  // Rotationen alt-Basis → neu-Basis
  const o = out || { g1: new THREE.Quaternion(), g2: new THREE.Quaternion() };
  basisRot(thOld, _n, thNew, _n2, _qr); o.g1.copy(_qr).multiply(gA);
  basisRot(shOld, _n, shNew, _n2, _qr); o.g2.copy(_qr).multiply(gB);
  return o;
}
const _x1 = new THREE.Vector3(), _x2 = new THREE.Vector3(), _y1 = new THREE.Vector3(), _y2 = new THREE.Vector3();
function basisRot(u1, n1, u2, n2, q) {
  _x1.crossVectors(n1, u1).normalize(); _y1.copy(n1).addScaledVector(u1, -n1.dot(u1)).normalize();
  _x2.crossVectors(n2, u2).normalize(); _y2.copy(n2).addScaledVector(u2, -n2.dot(u2)).normalize();
  _m1.makeBasis(u1, _y1, _x1); _m2.makeBasis(u2, _y2, _x2);
  _m2.multiply(_m1.transpose());
  return q.setFromRotationMatrix(_m2);
}

// =============================================================================================
// Aetherfront – Motion-Capture-Laufzeit für die Helden.
// Daten: web/assets/anim/clips.json (scripts/mocap-import.mjs, Quelle: CMU Graphics Lab Motion Capture Database,
// mocap.cs.cmu.edu). Ebenen: Ruhe → Drehen auf der Stelle → Fortbewegungs-Blendraum (Gehen/Laufen vorwärts,
// Rückwärtsgehen/-laufen, Seitwärts über Unterkörper-Gier + Schrittbahn-Drehung, Schrittweiten-Anpassung per Bein-IK,
// damit die Füße bei 7 m/s und 4,5 m/s nicht rutschen) → Sprung (Flug über vy, Landung) → Proportions-IK der Beine
// → Mischung mit den prozeduralen Aktionen (Oberkörper-Maske) aus animator.js.
// =============================================================================================
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function b64ToInt16(b64) {
  let bytes;
  if (typeof atob === 'function') { const s = atob(b64); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }
  else bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
}

/** Dekodierte Clip-Bibliothek */
export class MocapLibrary {
  constructor(json) {
    if (!json || json.format !== 'aetherfront-mocap-1') throw new Error('Mocap: unbekanntes Format');
    this.fps = json.fps; this.joints = json.joints; this.J = json.joints.length;
    this.canon = json.canon;
    this.canonRest = Object.fromEntries(Object.entries(json.canon.rest).map(([k, v]) => [k, new THREE.Vector3(...v)]));
    this.clips = {};
    for (const [name, c] of Object.entries(json.clips)) {
      const qi = b64ToInt16(c.q), hi = b64ToInt16(c.h);
      const q = new Float32Array(qi.length); for (let i = 0; i < qi.length; i++) q[i] = qi[i] / 32767;
      const h = new Float32Array(hi.length); for (let i = 0; i < hi.length; i++) h[i] = hi[i] / 1000;
      this.clips[name] = { name, n: c.n, loop: c.loop, dur: c.loop ? c.n / this.fps : (c.n - 1) / this.fps, speed: c.speed || 0, dir: c.dir || [0, 0], omega: c.omega || 0, markers: c.markers || null, contacts: c.contacts || null, q, h };
    }
  }
  /** Pose zur Zeit t (s) in pose = { q: Quaternion[], h: Vector3 } */
  sample(clip, t, pose) {
    const n = clip.n, J = this.J;
    let f = t * this.fps;
    if (clip.loop) { f %= n; if (f < 0) f += n; } else f = clamp(f, 0, n - 1);
    const i0 = Math.floor(f), i1 = clip.loop ? (i0 + 1) % n : Math.min(n - 1, i0 + 1), u = f - i0;
    const Q = clip.q, H = clip.h;
    for (let j = 0; j < J; j++) {
      const a = (i0 * J + j) * 4, b = (i1 * J + j) * 4;
      let x1 = Q[b], y1 = Q[b + 1], z1 = Q[b + 2], w1 = Q[b + 3];
      if (Q[a] * x1 + Q[a + 1] * y1 + Q[a + 2] * z1 + Q[a + 3] * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
      pose.q[j].set(Q[a] + (x1 - Q[a]) * u, Q[a + 1] + (y1 - Q[a + 1]) * u, Q[a + 2] + (z1 - Q[a + 2]) * u, Q[a + 3] + (w1 - Q[a + 3]) * u).normalize();
    }
    pose.h.set(H[i0 * 3] + (H[i1 * 3] - H[i0 * 3]) * u, H[i0 * 3 + 1] + (H[i1 * 3 + 1] - H[i0 * 3 + 1]) * u, H[i0 * 3 + 2] + (H[i1 * 3 + 2] - H[i0 * 3 + 2]) * u);
    return pose;
  }
}

let LIB = null, LOADING = null;
export function getMocapLibrary() { return LIB; }
export function setMocapLibrary(json) { LIB = json ? (json instanceof MocapLibrary ? json : new MocapLibrary(json)) : null; return LIB; }
/** Lädt die Clips einmalig (Browser/Electron app://). Fehler → prozeduraler Animator bleibt aktiv. */
export function loadMocapLibrary(url = 'assets/anim/clips.json') {
  if (LIB || LOADING) return LOADING || Promise.resolve(LIB);
  if (typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol === 'file:') return Promise.resolve(null);
  LOADING = fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? setMocapLibrary(j) : null)).catch((e) => { console.warn('Mocap-Clips nicht geladen – prozedurale Animation:', e && e.message); return null; });
  return LOADING;
}

const newPose = (J) => ({ q: Array.from({ length: J }, () => new THREE.Quaternion()), h: new THREE.Vector3() });
function copyPose(d, s) { for (let j = 0; j < d.q.length; j++) d.q[j].copy(s.q[j]); d.h.copy(s.h); return d; }
/** d = mix(d, s, w) (normierte Quaternion-Interpolation, kürzester Weg) */
function mixPose(d, s, w) {
  if (w <= 0) return d;
  if (w >= 1) return copyPose(d, s);
  for (let j = 0; j < d.q.length; j++) d.q[j].slerp(s.q[j], w);
  d.h.lerp(s.h, w);
  return d;
}

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _ik = { g1: new THREE.Quaternion(), g2: new THREE.Quaternion() };
const ARM_RE = /^(shoulder|upperArm|foreArm|hand)[LR]$/;
const AXIAL = ['hips', 'spine', 'chest', 'neck'], AXIAL_FRAC = [1, 0.55, 0.18, 0]; // Anteil der Unterkörper-Gier

/**
 * Laufzeit pro Held. update(dt, s, mask) schreibt das Ergebnis in die Gelenke des Rigs und mischt dabei die
 * vorher vom prozeduralen Animator gesetzten Gelenkwerte je nach Maske ein:
 *   mask.upper (0..1) – Arme/Rumpf/Kopf aus dem prozeduralen Animator (Aktionen, Betäubung, Sieg, Treffer)
 *   mask.whole (0..1) – ganzer Körper prozedural (Tod, Wirbel-/Beinaktionen)
 *   mask.arms  (0..1) – Grundanteil der prozeduralen Arm-/Waffenhaltung des Heldenstils
 */
export class MocapRuntime {
  constructor(rig, lib) {
    this.rig = rig; this.lib = lib;
    this.names = lib.joints; this.J = lib.J;
    this.jidx = Object.fromEntries(this.names.map((n, i) => [n, i]));
    this.joints = this.names.map((n) => rig.joints[n]);
    this.axial = AXIAL.map((n) => this.jidx[n]);
    // Maskenklasse je Gelenk: 0 Beine/Hüfte, 1 Arme, 2 Schulter, 3 Brust/Hals/Kopf, 4 Wirbel
    this.cls = this.names.map((n) => (ARM_RE.test(n) ? (n.startsWith('shoulder') ? 2 : 1) : n === 'chest' || n === 'neck' || n === 'head' ? 3 : n === 'spine' ? 4 : 0));
    if (this.joints.some((j) => !j)) throw new Error('Mocap: Rig-Gelenk fehlt');
    const R = rig.rest, C = lib.canonRest;
    this.r = R.hips.y / C.hips.y;          // Proportions-Maßstab
    this.ankleC = lib.canon.ankleY; this.ankleR = R.footL.y;
    this.parent = this.names.map((n) => (lib.canon.parent[n] ? this.jidx[lib.canon.parent[n]] : -1));
    this.offC = this.names.map((n, i) => (this.parent[i] < 0 ? new THREE.Vector3() : C[n].clone().sub(C[this.names[this.parent[i]]])));
    this.offR = this.names.map((n, i) => (this.parent[i] < 0 ? new THREE.Vector3() : R[n].clone().sub(R[this.names[this.parent[i]]])));
    const legLen = (P) => P.thighL.distanceTo(P.shinL) + P.shinL.distanceTo(P.footL);
    this.legR = legLen(R);
    this.vk = legLen(R) / legLen(C);       // Geschwindigkeiten skalieren mit der Beinlänge
    const c = lib.clips;
    this.C = c;
    this.pIdle = newPose(this.J); this.pTurn = newPose(this.J); this.pLoco = newPose(this.J); this.pTmp = newPose(this.J);
    this.pJump = newPose(this.J); this.pOut = newPose(this.J);
    this.G = this.names.map(() => new THREE.Quaternion()); this.Gn = this.names.map(() => new THREE.Quaternion());
    this.P = this.names.map(() => new THREE.Vector3());
    // Zustand
    this.t = Math.random() * 20; this.phase = 0; this.vx = 0; this.vz = 0; this.dirX = 0; this.dirZ = 1;
    this.moveW = 0; this.back = false; this.backW = 0; this.legYaw = 0; this.turnW = 0; this.turnT = 0; this.turnSign = 1;
    this.airW = 0; this.wasAir = false; this.v0 = 7; this.jt = 0; this.landT = 9; this.drop = 0; this.k = 1; this.speed = 0;
    this.footT = [new THREE.Vector3(), new THREE.Vector3()];
    this.enabled = true;
  }

  /** Weltmaßstab des Helden (Halter skaliert z.B. 1,25×) – Geschwindigkeiten kommen in Weltmetern */
  _worldScale() {
    const p = this.rig.root.parent;
    if (!p) return 1;
    p.getWorldScale(_v1);
    return _v1.y > 1e-3 ? _v1.y : 1;
  }

  update(dt, s = {}, mask = {}) {
    dt = clamp(dt || 0, 0, 0.1);
    this.t += dt;
    const lib = this.lib, C = this.C, vk = this.vk;
    const ws = this._worldScale();
    const air = !!s.airborne, vy = s.vy || 0, dead = !!s.dead;
    // ---------- Geschwindigkeit im Modellraum (Halter-lokal) ----------
    const tx = -(s.strafe || 0) / ws, tz = (s.fwd || 0) / ws;
    this.vx += (tx - this.vx) * damp(12, dt); this.vz += (tz - this.vz) * damp(12, dt);
    const v = Math.hypot(this.vx, this.vz); this.speed = v;
    if (v > 0.05) {
      const nx = this.vx / v, nz = this.vz / v;
      if (nx * this.dirX + nz * this.dirZ < -0.2) { this.dirX = nx; this.dirZ = nz; } // Umkehr: sofort (sonst Nulldurchgang)
      this.dirX += (nx - this.dirX) * damp(14, dt); this.dirZ += (nz - this.dirZ) * damp(14, dt);
      const l = Math.hypot(this.dirX, this.dirZ) || 1; this.dirX /= l; this.dirZ /= l;
    }
    this.moveW += (smooth(0.08, 0.7 * vk, v) * (dead ? 0 : 1) - this.moveW) * damp(air ? 4 : 10, dt);
    const mw = this.moveW;
    if (this.back) { if (this.dirZ > -0.05) this.back = false; } else if (this.dirZ < -0.3) this.back = true;
    this.backW += ((this.back ? 1 : 0) - this.backW) * damp(9, dt);
    // Unterkörper-Gier (Seitwärts/Diagonal) + Rest als Schrittbahn-Drehung
    const phi = this.back ? Math.atan2(-this.dirX, -this.dirZ) : Math.atan2(this.dirX, this.dirZ);
    const yawT = clamp(phi * 0.78, -1.15, 1.15) * smooth(0.02, 0.4, mw);
    this.legYaw += (yawT - this.legYaw) * damp(8, dt);
    const psi = clamp(phi - this.legYaw, -0.6, 0.6) * mw;

    // ---------- Fortbewegung: Phase + Schrittweite ----------
    const set = [
      [C.walk, (1 - this.backW) * (1 - smooth(C.walk.speed * vk * 1.25, C.jog.speed * vk * 0.85, v))],
      [C.jog, (1 - this.backW) * smooth(C.walk.speed * vk * 1.25, C.jog.speed * vk * 0.85, v)],
      [C.backWalk, this.backW * (1 - smooth(C.backWalk.speed * vk * 1.3, C.backRun.speed * vk * 0.8, v))],
      [C.backRun, this.backW * smooth(C.backWalk.speed * vk * 1.3, C.backRun.speed * vk * 0.8, v)],
    ];
    let omega = 0, wsum = 0;
    for (const [c, w] of set) { if (w <= 0) continue; const vc = c.speed * vk; const rate = clamp(Math.sqrt(Math.max(v, 0.05) / vc), 0.72, 1.32); omega += w * rate / c.dur; wsum += w; }
    omega /= wsum || 1;
    if (!air && mw > 0.001) this.phase = (this.phase + omega * dt) % 1;
    // Schrittweite: Weg pro Zyklus der Clips vs. benötigter Weg
    let kk = 0;
    for (const [c, w] of set) if (w > 0) kk += w * (v / Math.max(1e-3, omega * c.speed * vk * c.dur));
    kk /= wsum || 1;
    this.k += (clamp(kk, 0.35, 1.9) - this.k) * damp(10, dt);
    const loco = this.pLoco;
    let acc = 0;
    for (const [c, w] of set) {
      if (w <= 1e-3) continue;
      lib.sample(c, this.phase * c.dur, this.pTmp);
      acc += w; mixPose(loco, this.pTmp, w / acc);
    }

    // ---------- Ruhe + Drehen auf der Stelle ----------
    lib.sample(C.idle, this.t, this.pIdle);
    const turn = s.turn || 0;
    const turning = Math.abs(turn) > 0.5 && v < 0.6 * vk && !air && !dead;
    this.turnW += ((turning ? 1 : 0) - this.turnW) * damp(turning ? 8 : 5, dt);
    if (turning) this.turnSign = turn > 0 ? 1 : -1;
    const base = this.pOut;
    copyPose(base, this.pIdle);
    if (this.turnW > 0.002) {
      const tc = this.turnSign > 0 ? C.turnL : C.turnR;
      this.turnT += dt * clamp(Math.abs(turn) / Math.abs(tc.omega || 1), 0.6, 2.0) * smooth(0, 0.3, this.turnW);
      lib.sample(tc, this.turnT, this.pTurn);
      mixPose(base, this.pTurn, this.turnW * (1 - mw));
    }
    mixPose(base, loco, mw);
    // Schrittweite nur für den Fortbewegungsanteil
    const kEff = 1 + (this.k - 1) * mw;

    // ---------- Sprung ----------
    if (air && !this.wasAir) { this.v0 = Math.max(2, vy); this.jt = 0; }
    if (!air && this.wasAir) this.landT = 0;
    this.wasAir = air;
    this.landT += dt;
    this.airW += ((air && !dead ? 1 : 0) - this.airW) * damp(air ? 18 : 14, dt);
    const J = C.jump, mk = J.markers || { liftoff: 0.43, land: 1.0 };
    let jumpW = 0, jt = 0;
    if (this.airW > 0.002) {
      this.jt += dt;
      const apex = (mk.liftoff + mk.land) / 2;
      const up = vy > 0 ? 1 - clamp(vy / this.v0, 0, 1) : 1 + clamp(-vy / this.v0, 0, 1);
      jt = up <= 1 ? mk.liftoff + up * (apex - mk.liftoff) : apex + (up - 1) * (mk.land - 0.04 - apex);
      jt = Math.max(jt, mk.liftoff - 0.12 + Math.min(this.jt, 0.12)); // kurzer Abdruck
      jumpW = this.airW;
    }
    const landDur = 0.55;
    if (!air && this.landT < landDur) {
      const lw = (1 - smooth(0.12, landDur, this.landT)) * (1 - 0.7 * mw);
      if (lw > jumpW) { jumpW = lw; jt = mk.land + this.landT * 0.9; }
    }
    if (jumpW > 0.002) { lib.sample(J, jt, this.pJump); mixPose(base, this.pJump, jumpW); }
    const stride = 1 + (kEff - 1) * (1 - jumpW);
    const psiE = psi * (1 - jumpW);

    // ---------- Unterkörper-Gier + Rumpf-Gegendrehung ----------
    const yaw = this.legYaw * (1 - jumpW * 0.5);
    this._fk(base, this.offC); // Gc (alt), P (kanonisch)
    const G = this.G, Gn = this.Gn, P = this.P, I = this.jidx;
    // Fußziele (kanonisch, Clip-Raum)
    const hx = base.h.x, hz = base.h.z;
    for (let si = 0; si < 2; si++) {
      const f = P[si ? I.footR : I.footL], T = this.footT[si];
      let ox = f.x - hx, oz = (f.z - hz) * stride;
      const c = Math.cos(psiE), sn = Math.sin(psiE);
      const rx = ox * c + oz * sn, rz = -ox * sn + oz * c;
      T.set(hx + rx, f.y, hz + rz);
      T.applyAxisAngle(Y_AXIS, yaw);
    }
    _qy.setFromAxisAngle(Y_AXIS, yaw);
    base.h.applyQuaternion(_qy);
    // neue globale Zielrotationen: Hüfte 100 %, Wirbel 55 %, Brust 18 %, Hals 0 %
    for (let a = 0; a < 4; a++) {
      const j = this.axial[a], fk = AXIAL_FRAC[a];
      _q1.setFromAxisAngle(Y_AXIS, yaw * fk).multiply(G[j]); // gewünschte globale Rotation
      const p = this.parent[j];
      if (p < 0) base.q[j].copy(_q1); else base.q[j].copy(_q2.copy(Gn[p]).invert().multiply(_q1));
      Gn[j].copy(_q1);
    }
    // Hüfte senken, wenn die Schrittweite die Beine überstreckt
    const r = this.r;
    let need = 0;
    {
      // Hüft-Gelenkpositionen (Rig-Maßstab) mit neuer Hüftrotation
      for (let si = 0; si < 2; si++) {
        const th = I[si ? 'thighR' : 'thighL'];
        _v1.copy(this.offR[th]).applyQuaternion(Gn[I.hips]).addScaledVector(base.h, r);
        const T = _v2.copy(this.footT[si]).multiplyScalar(r); T.y = this.ankleR + (this.footT[si].y - this.ankleC) * r;
        const d = _v3.copy(T).sub(_v1); const hor = Math.hypot(d.x, d.z); const reach = this.legR * 0.985;
        if (hor < reach) { const yNeed = T.y + Math.sqrt(reach * reach - hor * hor); need = Math.max(need, _v1.y - yNeed); }
        else need = Math.max(need, _v1.y - T.y);
      }
    }
    const dropT = clamp(need, 0, 0.25 * r) * (air ? 0 : 1);
    this.drop += (dropT - this.drop) * damp(dropT > this.drop ? 30 : 8, dt);

    // ---------- In Rig-Gelenke schreiben (mit prozeduraler Maske) ----------
    const up = clamp(mask.upper || 0, 0, 1), whole = clamp(mask.whole || 0, 0, 1);
    // Waffenhaltung der Heldenstile (Schild, Hammer auf der Schulter …) bleibt: Arme anteilig prozedural, im Sprung mehr
    const armsW = clamp(Math.max(mask.arms ?? 0, 0.85 * jumpW * (mask.arms ? 1 : 0)), 0, 1);
    const out = this.joints;
    // Mocap-Ergebnis berechnen (lokal), Beine per IK auf Ziele im Rig-Maßstab
    const hipsPos = _v4.copy(base.h).multiplyScalar(r); hipsPos.y -= this.drop;
    // Rig-FK der Beine mit Mocap-Rotationen
    for (let si = 0; si < 2; si++) {
      const th = I[si ? 'thighR' : 'thighL'], sh = I[si ? 'shinR' : 'shinL'], ft = I[si ? 'footR' : 'footL'];
      const gH = Gn[I.hips];
      const gT = _q1.copy(gH).multiply(base.q[th]), gS = _q2.copy(gT).multiply(base.q[sh]);
      const gF = _q3.copy(gS).multiply(base.q[ft]);
      const A = _v1.copy(this.offR[th]).applyQuaternion(gH).add(hipsPos);
      const B = _v2.copy(this.offR[sh]).applyQuaternion(gT).add(A);
      const Cc = _v3.copy(this.offR[ft]).applyQuaternion(gS).add(B);
      const T = _v5.copy(this.footT[si]).multiplyScalar(r); T.y = this.ankleR + (this.footT[si].y - this.ankleC) * r;
      if (!air) T.y = Math.max(T.y, this.ankleR * 0.9);
      const res = solveTwoBone(A, B, Cc, T, gT, gS, null, _ik);
      if (res) {
        base.q[th].copy(gH).invert().multiply(res.g1);
        base.q[sh].copy(res.g1).invert().multiply(res.g2);
        base.q[ft].copy(res.g2).invert().multiply(gF);
      }
    }
    for (let j = 0; j < this.J; j++) {
      const cl = this.cls[j], jn = out[j];
      let w = whole;
      if (cl === 1) w = Math.max(w, up, armsW);
      else if (cl === 2) w = Math.max(w, up, armsW * 0.6);
      else if (cl === 3) w = Math.max(w, up * 0.8);
      else if (cl === 4) w = Math.max(w, up * 0.6);
      if (w >= 0.999) continue;
      if (w <= 0.001) jn.quaternion.copy(base.q[j]);
      else { _q1.copy(jn.quaternion); jn.quaternion.copy(base.q[j]).slerp(_q1, w); }
    }
    const hj = out[I.hips];
    if (whole <= 0.001) hj.position.copy(hipsPos); else hj.position.lerp(hipsPos, 1 - whole);
    this.jumpW = jumpW;
  }

  /** FK des kanonischen Skeletts für pose → this.G (global), this.P (Positionen) */
  _fk(pose, off) {
    const G = this.G, P = this.P;
    for (let j = 0; j < this.J; j++) {
      const p = this.parent[j];
      if (p < 0) { G[j].copy(pose.q[j]); P[j].copy(pose.h); continue; }
      G[j].copy(G[p]).multiply(pose.q[j]);
      P[j].copy(off[j]).applyQuaternion(G[p]).add(P[p]);
    }
  }
}
