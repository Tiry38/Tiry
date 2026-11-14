// Aetherfront – prozeduraler Helden-Animator (bildratenunabhängig, weich überblendet).
// Ebenen: Grundhaltung (Ruhe/Lauf) → Fortbewegung (IK-Füße, Gangphase, Rumpf-Gegendrehung, Armschwung)
//         → Sprung/Landung → Aktion (Keyframes, absolut, Gewicht) → Betäubung → Treffer → Sieg → Tod
//         → Sekundärbewegung (Federketten: Umhang, Busch, Haar, Rock) → Schwebeobjekte / Glühen.
import * as THREE from 'three';
import { STYLES } from './styles.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
// weiches Werterauschen (für Idle-Variationen)
const vnoise = (t, s = 0) => Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.13 + s * 2.9) * 0.2;

const ARM_ORDER = 'XZY';
const AXIAL_ORDER = 'YXZ';
const SCALARS = ['hipsX', 'hipsY', 'hipsZ', 'crouch', 'yaw', 'legFK', 'draw', 'arrow', 'glowL', 'glowR', 'pitch', 'roll', 'lift'];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------
// Keyframe-Kompilierung: keys = [[t, {joint:[x,y,z], scalar: v}], ...] → Kanäle
// ---------------------------------------------------------------------------------------------
function compileClip(clip) {
  if (!clip || clip._c) return clip;
  const keys = clip.keys;
  const times = keys.map((k) => k[0]);
  const joints = new Set(), scalars = new Set();
  for (const [, p] of keys) for (const k of Object.keys(p)) (SCALARS.includes(k) ? scalars : joints).add(k);
  clip._c = { times, joints: [...joints], scalars: [...scalars] };
  return clip;
}
// Catmull-Rom über Keys; fehlende Werte = Basiswert (fn)
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
function sampleClip(clip, t, getBase, out, scal) {
  const c = clip._c, keys = clip.keys, n = keys.length;
  t = clamp(t, keys[0][0], keys[n - 1][0]);
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const t0 = keys[i][0], t1 = keys[i + 1][0], u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const ease = clip.linear ? u : u;
  const idx = [Math.max(0, i - 1), i, i + 1, Math.min(n - 1, i + 2)];
  for (const j of c.joints) {
    const o = out[j] || (out[j] = [0, 0, 0]);
    const b = getBase(j);
    for (let k = 0; k < 3; k++) {
      const v = idx.map((ii) => { const p = keys[ii][1][j]; return p ? p[k] : b[k]; });
      o[k] = cr(v[0], v[1], v[2], v[3], ease);
    }
  }
  for (const sname of c.scalars) {
    const v = idx.map((ii) => keys[ii][1][sname] ?? 0);
    scal[sname] = cr(v[0], v[1], v[2], v[3], ease);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
export class HeroAnimator {
  constructor(rig) {
    this.rig = rig;
    this.j = rig.joints;
    this.st = STYLES[rig.style] || STYLES.knight;
    for (const k of Object.keys(this.st)) { const c = this.st[k]; if (c && c.keys) compileClip(c); if (Array.isArray(c)) c.forEach((x) => x && x.keys && compileClip(x)); }
    this.rest = rig.rest;
    this.s = rig.scale || 1;
    this.names = Object.keys(this.j);
    this.E = {}; this.base = {};
    for (const n of this.names) { this.E[n] = [0, 0, 0]; this.base[n] = [0, 0, 0]; }
    for (const n of this.names) {
      const jn = this.j[n];
      jn.rotation.order = /arm|hand|shoulder|weapon/i.test(n) ? ARM_ORDER : AXIAL_ORDER;
    }
    // Beine
    this.legs = {};
    for (const side of ['L', 'R']) {
      const th = this.rest['thigh' + side], kn = this.rest['shin' + side], an = this.rest['foot' + side];
      const r1 = kn.clone().sub(th).normalize(), r2 = an.clone().sub(kn).normalize();
      const n1 = new THREE.Vector3().crossVectors(r1, Z).normalize(), f1 = new THREE.Vector3().crossVectors(n1, r1);
      const n2 = new THREE.Vector3().crossVectors(r2, Z).normalize(), f2 = new THREE.Vector3().crossVectors(n2, r2);
      this.legs[side] = {
        th, kn, an, L1: th.distanceTo(kn), L2: kn.distanceTo(an),
        rest1: new THREE.Matrix4().makeBasis(n1, r1, f1).transpose(), rest2: new THREE.Matrix4().makeBasis(n2, r2, f2).transpose(),
        qT: new THREE.Quaternion(), qS: new THREE.Quaternion(), qF: new THREE.Quaternion(),
        target: new THREE.Vector3(), yaw: 0, pitch: 0, off: 0,
        fk: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      };
    }
    this.ankleY = this.rest.footL.y;
    this.hipsY = this.rest.hips.y;
    // Zustand
    this.time = Math.random() * 10;
    this.phase = 0; this.vf = 0; this.vs = 0; this.turn = 0; this.speed = 0; this.moveW = 0; this.runF = 0;
    this.dirX = 0; this.dirZ = 1; this.legYaw = 0; this.back = false; this.backW = 0;
    this.airW = 0; this.airT = 0; this.wasAir = false; this.lastVy = 0; this.landT = 9; this.landAmp = 0;
    this.act = null; this.actW = 0; this.actT = 0; this.actClip = null; this.actKey = ''; this.actCount = {}; this.lastT = 0;
    this.stunW = 0; this.deathT = -1; this.deathW = 0; this.vicW = 0; this.vicT = 0; this.shuffle = 0; this.shuffleW = 0;
    this.glow = 0; this.castGlow = 0; this.hitImp = 0;
    this.armSm = { L: 0, R: 0 };
    this.pose = {}; this.scal = {};
    this.springs = (rig.chains || []).map((c) => ({ ...c, a: c.bones.map(() => [0, 0]), v: c.bones.map(() => [0, 0]) }));
    this.floaters = rig.floaters || [];
    this.level = rig.level || 1;
  }

  _baseGet = (j) => this.E[j] || [0, 0, 0];

  update(dt, s = {}) {
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    const t = this.time, st = this.st, E = this.E, sc = this.s;
    const fwd = s.fwd || 0, strafe = s.strafe || 0, air = !!s.airborne, vy = s.vy || 0;
    const dead = !!s.dead;
    // ---------- Eingänge glätten ----------
    this.vf += (fwd - this.vf) * damp(11, dt);
    this.vs += (strafe - this.vs) * damp(11, dt);
    this.turn += ((s.turn || 0) - this.turn) * damp(8, dt);
    const speed = Math.hypot(this.vf, this.vs);
    this.speed = speed;
    this.moveW += (smooth(0.15, 1.3, speed) * (air ? 0.4 : 1) - this.moveW) * damp(9, dt);
    const mw = this.moveW;
    this.runF += (smooth(2.2, 5.8, speed) - this.runF) * damp(6, dt);
    const runF = this.runF;
    if (speed > 0.05) {
      const dx = -this.vs / speed, dz = this.vf / speed;
      this.dirX += (dx - this.dirX) * damp(14, dt); this.dirZ += (dz - this.dirZ) * damp(14, dt);
      const l = Math.hypot(this.dirX, this.dirZ) || 1; this.dirX /= l; this.dirZ /= l;
    }
    if (this.back) { if (this.dirZ > -0.05) this.back = false; } else if (this.dirZ < -0.3) this.back = true;
    this.backW += ((this.back ? 1 : 0) - this.backW) * damp(8, dt);
    const yawT = this.back ? clamp(Math.atan2(-this.dirX, -this.dirZ) * 0.55, -0.9, 0.9) : clamp(Math.atan2(this.dirX, this.dirZ) * 0.62, -1.0, 1.0);
    this.legYaw += (yawT * mw - this.legYaw) * damp(7, dt);

    // ---------- Grundhaltung ----------
    for (const n of this.names) { const e = E[n]; e[0] = 0; e[1] = 0; e[2] = 0; }
    const P = this.pose; for (const k in P) delete P[k];
    const scal = this.scal; for (const k in scal) delete scal[k];
    this._blendInto(st.idle, 1);
    this._blendInto(st.run, mw * (1 - this.backW * 0.5));
    if (st.back) this._blendInto(st.back, mw * this.backW);

    // ---------- Gang ----------
    const cycle = (1.05 + 0.27 * speed) * (st.stride || 1) * sc;
    if (!air) this.phase = (this.phase + dt * speed / cycle) % 1;
    const duty = lerp(0.6, 0.36, runF);
    const S = Math.min(1.25 * sc, duty * cycle * smooth(0.0, 0.6, speed));
    const lift = lerp(0.09, 0.3, runF) * (this.back ? 0.55 : 1) * (st.liftK || 1) * sc;
    const dX = this.dirX, dZ = this.dirZ;
    const cy = Math.cos(this.legYaw), sy = Math.sin(this.legYaw);
    // Drehen auf der Stelle: Tippelschritte
    const turning = Math.abs(this.turn) > 0.45 && mw < 0.3 && !air;
    this.shuffleW += ((turning ? 1 : 0) - this.shuffleW) * damp(8, dt);
    if (this.shuffleW > 0.01) this.shuffle += dt * (1.6 + Math.abs(this.turn) * 0.5);
    let minFootZ = 0;
    for (const side of ['L', 'R']) {
      const L = this.legs[side], sg = side === 'L' ? 1 : -1;
      const p = (this.phase + (side === 'L' ? 0 : 0.5)) % 1;
      let off, h = 0, pitch = 0;
      if (p < duty) {
        const u = p / duty; off = (0.5 - u) * S;
        pitch = 0.55 * smooth(0.65, 1, u) * runF - 0.12 * (1 - smooth(0, 0.18, u)) * (1 - runF);
      } else {
        const u = (p - duty) / (1 - duty); const e = u * u * (3 - 2 * u);
        off = (-0.5 + e) * S;
        h = lift * Math.pow(Math.sin(PI_(Math.pow(u, 0.8))), 0.9);
        pitch = lerp(0.7 * runF + 0.2, -0.25, smooth(0.0, 0.85, u));
      }
      L.off = off;
      // Gang-Fuß (Wurzelraum)
      const bx = sg * 0.105 * sc, cross = 0.05 * sc * Math.abs(dX) * (h > 0 ? 1 : 0.4);
      let gx = bx * cy + dX * off - sg * cross, gz = -bx * sy + dZ * off;
      // Ruhe-Fuß
      const fi = st.feet[side];
      let ix = fi[0] * sc, iz = fi[1] * sc, iyaw = fi[2];
      let ih = 0;
      if (this.shuffleW > 0.01) {
        const ph = (this.shuffle + (side === 'L' ? 0 : 0.5)) % 1;
        ih = 0.045 * sc * Math.max(0, Math.sin(ph * TAU)) * this.shuffleW;
        iyaw += -this.turn * 0.08 * Math.sin(ph * TAU) * this.shuffleW;
      }
      L.target.set(lerp(ix, gx, mw), this.ankleY + lerp(ih, h, mw), lerp(iz, gz, mw));
      L.yaw = lerp(iyaw, this.legYaw + sg * 0.05 + (this.back ? 0 : 0), mw);
      L.pitch = pitch * mw;
      minFootZ = Math.min(minFootZ, L.target.z);
    }
    const offLn = S > 0.01 ? this.legs.L.off / (S * 0.5) : 0, offRn = S > 0.01 ? this.legs.R.off / (S * 0.5) : 0;

    // Hüfte
    const hp = (this.phase - duty / 2 + 1) % 1;
    const bounce = -Math.cos(hp * 2 * TAU) * lerp(0.012, 0.03, runF) * mw * (st.bounce || 1) * sc;
    const twist = (offLn - offRn) * 0.5; // >0: linker Fuß vorn
    let hipsX = Math.sin(t * 0.55) * 0.012 * sc * (1 - mw), hipsY = bounce, hipsZ = 0;
    let crouch = (st.crouch ?? 0.025) * sc * (1 - mw) + 0.035 * sc * runF * mw;
    let yawH = this.legYaw - twist * 0.16 * mw * (st.twist || 1) - this.turn * 0.07 * (1 - mw);
    let pitchH = 0.06 * runF * mw * (this.back ? -0.6 : 1), rollH = Math.sin(this.phase * TAU) * 0.035 * mw + Math.sin(t * 0.55 + 0.6) * 0.02 * (1 - mw);
    // Rumpf
    const lean = (0.07 + 0.14 * runF) * mw * (this.back ? -0.35 : 1) * (st.leanK || 1) * Math.max(0.3, Math.abs(dZ));
    E.spine[0] += lean * 0.45; E.chest[0] += lean * 0.4;
    E.spine[1] += -this.legYaw * 0.5 + twist * 0.08 * mw;
    E.chest[1] += -this.legYaw * 0.42 + twist * 0.14 * mw * (st.twist || 1);
    E.chest[2] += -rollH * 0.4;
    E.head[0] += -lean * 0.65 - pitchH * 0.5; E.head[1] += -this.legYaw * 0.06 + this.turn * 0.12;
    // Atmen + Blick
    const br = Math.sin(t * TAU / 3.8);
    E.chest[0] += br * 0.018 * (1 - mw * 0.7); E.spine[0] -= br * 0.006;
    E.shoulderL[2] += br * 0.015; E.shoulderR[2] -= br * 0.015;
    E.head[1] += vnoise(t * 0.22, 1.3) * 0.28 * (1 - mw); E.head[0] += vnoise(t * 0.17, 4.1) * 0.06 * (1 - mw);
    // Armschwung (Gegenschwung zu den Beinen) – geglättet
    const ksm = damp(16, dt);
    this.armSm.L += (-offRn - this.armSm.L) * ksm; this.armSm.R += (-offLn - this.armSm.R) * ksm;
    const swA = lerp(0.35, 0.75, runF) * mw * (this.back ? 0.5 : 1);
    E.upperArmL[0] -= this.armSm.L * swA * st.swing.L; E.upperArmR[0] -= this.armSm.R * swA * st.swing.R;
    E.foreArmL[0] -= Math.max(0, this.armSm.L) * 0.25 * swA * st.swing.L; E.foreArmR[0] -= Math.max(0, this.armSm.R) * 0.25 * swA * st.swing.R;
    // Waffen-Pendeln im Stand
    if (this.j.weaponR) { E.weaponR[0] += vnoise(t * 0.5, 2) * 0.03; E.weaponR[2] += vnoise(t * 0.4, 5) * 0.02; }

    // ---------- Sprung / Landung ----------
    if (air) { this.airT += dt; this.lastVy = vy; } else this.airT = 0;
    this.airW += ((air ? 1 : 0) - this.airW) * damp(air ? 16 : 12, dt);
    if (this.wasAir && !air) { this.landT = 0; this.landAmp = clamp(-this.lastVy / 9, 0.25, 1.1); }
    this.wasAir = air;
    this.landT += dt;
    const legFK = { w: 0, L: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], R: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
    if (this.airW > 0.001) {
      const aw = this.airW, tuck = smooth(0.0, 0.22, this.airT), fall = smooth(1.5, -4, vy);
      const lead = st.jumpLead === 'R' ? 'R' : 'L', trail = lead === 'L' ? 'R' : 'L';
      legFK.w = aw;
      legFK[lead][0][0] = lerp(-1.05 * tuck, -0.55, fall); legFK[lead][1][0] = lerp(1.45 * tuck, 0.55, fall); legFK[lead][2][0] = lerp(0.3, -0.1, fall);
      legFK[trail][0][0] = lerp(-0.15 * tuck + 0.15, -0.25, fall); legFK[trail][1][0] = lerp(0.9 * tuck + 0.3, 0.45, fall); legFK[trail][2][0] = lerp(0.6, 0.0, fall);
      legFK.L[0][2] = 0.06; legFK.R[0][2] = -0.06;
      E.spine[0] += (0.12 * (1 - fall) - 0.06 * fall) * aw;
      E.upperArmL[0] += (-0.55 * (1 - fall) - 0.3 * fall) * aw * st.swing.L; E.upperArmL[2] += 0.35 * fall * aw * st.swing.L;
      E.upperArmR[0] += (-0.25 * (1 - fall) - 0.3 * fall) * aw * st.swing.R; E.upperArmR[2] -= 0.35 * fall * aw * st.swing.R;
      E.head[0] += 0.12 * fall * aw;
      hipsY += 0.04 * tuck * aw * sc;
    }
    if (this.landT < 0.7) {
      const lt = this.landT, env = lt < 0.05 ? lt / 0.05 : Math.exp(-(lt - 0.05) * 6.5);
      const sq = env * this.landAmp;
      crouch += 0.15 * sq * sc;
      E.spine[0] += 0.22 * sq; E.chest[0] += 0.12 * sq; E.head[0] -= 0.15 * sq;
      E.upperArmL[2] += 0.25 * sq; E.upperArmR[2] -= 0.25 * sq; E.upperArmL[0] -= 0.2 * sq; E.upperArmR[0] -= 0.2 * sq;
    }

    // ---------- Aktion ----------
    const a = s.action;
    if (a && a.kind && !dead) {
      const key = a.kind + '|' + (a.slot ?? '');
      const tt = clamp(a.t ?? 0, 0, 1);
      if (key !== this.actKey || tt + 0.05 < this.lastT || !this.act) {
        const list = st[a.kind] || st.cast;
        const arr = Array.isArray(list) ? list : [list];
        const c = (this.actCount[a.kind] = (this.actCount[a.kind] ?? -1) + 1);
        this.actClip = arr[c % arr.length];
        this.actKey = key;
      }
      this.act = a.kind; this.lastT = tt; this.actT = tt;
      this.actW += (1 - this.actW) * damp(22, dt);
    } else {
      this.act = null; this.actKey = '';
      if (this.actClip) this.actT = Math.min(1, this.actT + dt * 1.5);
      this.actW += (0 - this.actW) * damp(7, dt);
      if (this.actW < 0.002) this.actClip = null;
      this.lastT = 0;
    }
    let yawAct = 0, drawAmt = 0, arrowVis = 0, glowHands = [0, 0];
    if (this.actClip && this.actW > 0.001) {
      const clip = this.actClip;
      let tt = this.actT;
      if (clip.loop) tt = (t * (clip.rate || 1)) % 1;
      sampleClip(clip, tt, this._baseGet, P, scal);
      if (clip.pulse) for (const j of Object.keys(clip.pulse)) { const pv = clip.pulse[j], ph = Math.sin(t * (clip.pulseRate || 7)); const o = P[j]; if (o) { o[0] += pv[0] * ph; o[1] += pv[1] * ph; o[2] += pv[2] * ph; } }
      const w = this.actW * (clip.upperOnly && mw > 0.5 ? 1 : 1);
      for (const j of Object.keys(P)) { const e = E[j]; if (!e) continue; const o = P[j]; e[0] += (o[0] - e[0]) * w; e[1] += (o[1] - e[1]) * w; e[2] += (o[2] - e[2]) * w; }
      crouch += (scal.crouch || 0) * sc * w; hipsY += (scal.hipsY || 0) * sc * w; hipsZ += (scal.hipsZ || 0) * sc * w; hipsX += (scal.hipsX || 0) * sc * w;
      pitchH += (scal.pitch || 0) * w; rollH += (scal.roll || 0) * w;
      yawAct = wrapPi(scal.yaw || 0) * w;
      drawAmt = clamp(scal.draw || 0, 0, 1) * w; arrowVis = clamp(scal.arrow || 0, 0, 1) * w;
      glowHands = [clamp(scal.glowL || 0, 0, 1.5) * w, clamp(scal.glowR || 0, 0, 1.5) * w];
      if (scal.legFK) {
        const fw = clamp(scal.legFK, 0, 1) * w;
        for (const side of ['L', 'R']) {
          const names = ['thigh' + side, 'shin' + side, 'foot' + side];
          for (let k = 0; k < 3; k++) { const pv = P[names[k]]; if (pv) legFK[side][k] = legFK.w > 0 ? legFK[side][k].map((x, i) => lerp(x, pv[i], fw)) : pv.slice(); }
        }
        legFK.w = Math.max(legFK.w, fw);
      }
      if (scal.lift) for (const side of ['L', 'R']) this.legs[side].target.y += scal.lift * sc * w * (side === 'L' ? 1 : 0.4);
    }
    // ---------- Betäubung ----------
    this.stunW += ((s.stunned && !dead ? 1 : 0) - this.stunW) * damp(6, dt);
    if (this.stunW > 0.001) {
      const w = this.stunW;
      E.head[0] += (0.3 + Math.cos(t * 2.4) * 0.12) * w; E.head[2] += Math.sin(t * 2.4) * 0.22 * w; E.head[1] += Math.cos(t * 1.9) * 0.15 * w;
      E.spine[0] += 0.18 * w; E.chest[0] += (0.1 + Math.sin(t * 2.4) * 0.05) * w; E.chest[2] += Math.sin(t * 1.2) * 0.08 * w;
      for (const side of ['L', 'R']) {
        const sg = side === 'L' ? 1 : -1, ua = E['upperArm' + side], fa = E['foreArm' + side];
        ua[0] += (0.1 - ua[0]) * w * 0.7; ua[2] += (sg * 0.15 - ua[2]) * w * 0.6; fa[0] += (-0.35 - fa[0]) * w * 0.6;
      }
      hipsX += Math.sin(t * 1.2) * 0.03 * sc * w; crouch += 0.06 * sc * w; rollH += Math.sin(t * 1.2) * 0.05 * w;
    }
    // ---------- Treffer ----------
    const ha = s.hitAt ?? Infinity;
    const hit = ha < 0.5 ? (ha < 0.05 ? ha / 0.05 : Math.exp(-(ha - 0.05) * 8)) : 0;
    if (hit > 0 && !dead) {
      E.chest[0] -= 0.24 * hit; E.spine[0] -= 0.1 * hit; E.head[0] -= 0.3 * hit; E.head[2] += 0.12 * hit;
      E.upperArmL[2] += 0.2 * hit; E.upperArmR[2] -= 0.2 * hit; hipsZ -= 0.03 * sc * hit; crouch += 0.03 * sc * hit;
    }
    // ---------- Sieg ----------
    this.vicW += ((s.victory && !dead ? 1 : 0) - this.vicW) * damp(5, dt);
    if (this.vicW > 0.001 && st.victory) {
      this.vicT += dt;
      const clip = st.victory;
      const tt = clip.loop ? (this.vicT * (clip.rate || 0.5)) % 1 : Math.min(1, this.vicT * (clip.rate || 0.6));
      const VP = {}, vs2 = {};
      sampleClip(clip, tt, this._baseGet, VP, vs2);
      const w = this.vicW;
      for (const j of Object.keys(VP)) { const e = E[j]; if (!e) continue; const o = VP[j]; e[0] += (o[0] - e[0]) * w; e[1] += (o[1] - e[1]) * w; e[2] += (o[2] - e[2]) * w; }
      hipsY += (vs2.hipsY || 0) * sc * w; crouch += (vs2.crouch || 0) * sc * w;
      if (vs2.glowR) glowHands[1] = Math.max(glowHands[1], vs2.glowR * w);
      if (vs2.glowL) glowHands[0] = Math.max(glowHands[0], vs2.glowL * w);
    } else this.vicT = 0;
    // ---------- Tod ----------
    if (dead) { if (this.deathT < 0) this.deathT = 0; this.deathT += dt; } else this.deathT = -1;
    this.deathW += ((dead ? 1 : 0) - this.deathW) * damp(dead ? 30 : 4, dt);
    if (this.deathW > 0.001) {
      const clip = st.death;
      const DP = {}, ds = {};
      sampleClip(clip, Math.max(0, this.deathT < 0 ? 2 : this.deathT), this._baseGet, DP, ds);
      const w = this.deathW;
      for (const j of Object.keys(DP)) { const e = E[j]; if (!e) continue; const o = DP[j]; e[0] += (o[0] - e[0]) * w; e[1] += (o[1] - e[1]) * w; e[2] += (o[2] - e[2]) * w; }
      crouch = lerp(crouch, (ds.crouch || 0) * sc, w); hipsY = lerp(hipsY, (ds.hipsY || 0) * sc, w); hipsZ = lerp(hipsZ, (ds.hipsZ || 0) * sc, w); hipsX = lerp(hipsX, 0, w);
      pitchH = lerp(pitchH, ds.pitch || 0, w); rollH = lerp(rollH, ds.roll || 0, w); yawH = lerp(yawH, ds.yaw || 0, w); yawAct *= 1 - w;
      const fw = clamp(ds.legFK || 0, 0, 1) * w;
      if (fw > 0) {
        for (const side of ['L', 'R']) { const names = ['thigh' + side, 'shin' + side, 'foot' + side]; for (let k = 0; k < 3; k++) { const pv = DP[names[k]] || [0, 0, 0]; legFK[side][k] = legFK[side][k].map((x, i) => lerp(x, pv[i], fw)); } }
        legFK.w = lerp(legFK.w, 1, fw);
      }
    }

    // ---------- Hüfte anwenden ----------
    const hips = this.j.hips;
    // Höhe begrenzen, damit Füße erreichbar bleiben
    let maxY = Infinity;
    for (const side of ['L', 'R']) {
      const L = this.legs[side];
      const dh = Math.hypot(L.target.x - L.th.x, L.target.z - L.th.z);
      const reach = (L.L1 + L.L2) * 0.992;
      const y = L.target.y + Math.sqrt(Math.max(0.01, reach * reach - dh * dh)) + (this.hipsY - L.th.y);
      maxY = Math.min(maxY, y);
    }
    let hy = Math.min(this.hipsY - crouch, maxY + 0.004) + hipsY;
    if (this.deathW > 0.001) hy = lerp(hy, this.hipsY + hipsY, this.deathW);
    hips.position.set(hipsX, hy, hipsZ);
    const yawTot = yawH + yawAct;
    _e.set(pitchH + E.hips[0], yawTot + E.hips[1], rollH + E.hips[2], AXIAL_ORDER);
    hips.quaternion.setFromEuler(_e);
    const hipsQ = hips.quaternion;

    // ---------- Oberkörper/Arme/Kopf anwenden ----------
    for (const n of this.names) {
      if (n === 'hips' || /^(thigh|shin|foot)[LR]$/.test(n)) continue;
      if (this.springs.some((sp) => sp.bones.includes(n))) continue;
      if (this.floaters.some((f) => f.joint === n)) continue;
      const e = E[n], jn = this.j[n];
      _e.set(e[0], e[1], e[2], jn.rotation.order);
      jn.quaternion.setFromEuler(_e);
    }

    // ---------- Beine (IK + FK-Mischung) ----------
    const cyA = Math.cos(yawAct), syA = Math.sin(yawAct);
    for (const side of ['L', 'R']) {
      const L = this.legs[side];
      // Aktions-Drehung (Wirbel) dreht die Fußziele mit
      const tx = L.target.x * cyA + L.target.z * syA, tz = -L.target.x * syA + L.target.z * cyA;
      _v.set(tx, L.target.y, tz);
      this._solveLeg(L, hips.position, hipsQ, _v, L.yaw + yawAct, L.pitch);
      const thJ = this.j['thigh' + side], shJ = this.j['shin' + side], ftJ = this.j['foot' + side];
      // lokal: thigh = hips^-1 * qT ; shin = qT^-1 * qS ; foot = qS^-1 * qF
      _q.copy(hipsQ).invert().multiply(L.qT);
      _q2.copy(L.qT).invert().multiply(L.qS);
      _q3.copy(L.qS).invert().multiply(L.qF);
      if (legFK.w > 0.001) {
        const fk = legFK[side];
        _e.set(fk[0][0], fk[0][1], fk[0][2], 'XYZ'); thJ.quaternion.setFromEuler(_e); _q.slerp(thJ.quaternion, legFK.w);
        _e.set(fk[1][0], fk[1][1], fk[1][2], 'XYZ'); shJ.quaternion.setFromEuler(_e); _q2.slerp(shJ.quaternion, legFK.w);
        _e.set(fk[2][0], fk[2][1], fk[2][2], 'XYZ'); ftJ.quaternion.setFromEuler(_e); _q3.slerp(ftJ.quaternion, legFK.w);
      }
      thJ.quaternion.copy(_q); shJ.quaternion.copy(_q2); ftJ.quaternion.copy(_q3);
    }

    // ---------- Sekundärbewegung ----------
    this._springs(dt, t, minFootZ, pitchH + E.spine[0] + E.chest[0] + (this.deathW > 0.5 ? 0 : 0));
    this._floaters(dt, t, s);

    // ---------- Bogen / Pfeil / Handglühen / Material ----------
    this.rig.root.updateMatrixWorld(true);
    if (this.j.bowString) {
      const bs = this.j.bowString, rest = this.rig.bowRest;
      if (drawAmt > 0.001 && this.j.handR) {
        this.j.handR.getWorldPosition(_v);
        if (this.rig.bowNock) _v.copy(this.rig.bowNock).applyMatrix4(this.j.handR.matrixWorld);
        bs.parent.worldToLocal(_v);
        bs.position.copy(rest).lerp(_v, drawAmt);
      } else bs.position.copy(rest);
      bs.updateMatrixWorld(true);
    }
    if (this.j.arrow) { const k = arrowVis > 0.05 ? arrowVis : 0.0001; this.j.arrow.scale.setScalar(k); this.j.arrow.updateMatrixWorld(true); }
    this.castGlow += (clamp(s.castGlow || 0, 0, 1) - this.castGlow) * damp(10, dt);
    for (const side of ['L', 'R']) {
      const g = this.j['glowHand' + side];
      if (!g) continue;
      const k = clamp(Math.max(this.castGlow * (st.castHands || 1), side === 'L' ? glowHands[0] : glowHands[1]), 0, 1.5);
      const pul = 1 + 0.12 * Math.sin(t * 9 + (side === 'L' ? 0 : 1.7));
      g.scale.setScalar(k > 0.02 ? k * pul : 0.0001);
      g.rotation.y = t * 2.5;
      g.updateMatrixWorld(true);
    }
    const lv = this.rig.level || 1;
    const chanPulse = this.act === 'channel' ? 0.25 * Math.sin(t * 8) : 0;
    const gk = (1 + 0.05 * (lv - 1)) * (1 + 1.4 * this.castGlow + chanPulse) * (1 - 0.7 * smooth(0.6, 2.5, this.deathT < 0 ? 0 : this.deathT));
    for (const m of this.rig.glowMaterials) m.color.setScalar(gk * (m.userData.pulse ?? 1) * (m.userData.base ?? 1));
    for (const m of this.rig.bodyMaterials) if (m.userData.uniforms) m.userData.uniforms.uFlash.value = ha < 0.18 ? (1 - ha / 0.18) * 0.9 : 0;
  }

  _blendInto(pose, w) {
    if (!pose || w <= 0) return;
    const E = this.E;
    for (const j of Object.keys(pose)) { const e = E[j]; if (!e) continue; const v = pose[j]; e[0] += (v[0] - e[0]) * w; e[1] += (v[1] - e[1]) * w; e[2] += (v[2] - e[2]) * w; }
  }

  _solveLeg(L, hipsPos, hipsQ, target, yaw, pitch) {
    const restHips = this.rest.hips;
    const thP = _v2.copy(L.th).sub(restHips).applyQuaternion(hipsQ).add(hipsPos);
    const d = _v3.copy(target).sub(thP);
    let dist = d.length();
    const Lmax = (L.L1 + L.L2) * 0.9995, Lmin = Math.abs(L.L1 - L.L2) + 0.02;
    dist = clamp(dist, Lmin, Lmax);
    d.normalize();
    const cosA = clamp((L.L1 * L.L1 + dist * dist - L.L2 * L.L2) / (2 * L.L1 * dist), -1, 1);
    const A = Math.acos(cosA);
    // Knie-Richtung: Mischung aus Hüft-Vorn und Fuß-Gier
    const kh = _v4.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.6).add(_v.set(0, 0, 1).applyQuaternion(hipsQ).multiplyScalar(0.4));
    kh.addScaledVector(d, -kh.dot(d));
    if (kh.lengthSq() < 1e-6) kh.set(0, 0, 1).applyQuaternion(hipsQ);
    kh.normalize();
    const thighDir = new THREE.Vector3().copy(d).multiplyScalar(Math.cos(A)).addScaledVector(kh, Math.sin(A));
    const knee = new THREE.Vector3().copy(thP).addScaledVector(thighDir, L.L1);
    const end = new THREE.Vector3().copy(thP).addScaledVector(d, dist);
    const shinDir = end.sub(knee).normalize();
    const n = new THREE.Vector3().crossVectors(d, kh).normalize();
    const f1 = new THREE.Vector3().crossVectors(n, thighDir), f2 = new THREE.Vector3().crossVectors(n, shinDir);
    _m.makeBasis(n, thighDir, f1).multiply(L.rest1); L.qT.setFromRotationMatrix(_m);
    _m.makeBasis(n, shinDir, f2).multiply(L.rest2); L.qS.setFromRotationMatrix(_m);
    _e.set(pitch, yaw, 0, 'YXZ'); L.qF.setFromEuler(_e);
  }

  _springs(dt, t, minFootZ, bodyPitch) {
    if (!this.springs.length) return;
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / sub;
    const vf = this.vf, vs = this.vs, air = this.airW, dead = this.deathW;
    for (const sp of this.springs) {
      const n = sp.bones.length;
      const gain = sp.gain ?? 1;
      // Ziel: Fahrtwind hebt nach hinten, Strafe seitlich, Fall hebt, Beine schieben, leichte Brise
      let tx = (Math.max(0, vf) * 0.075 + Math.abs(vs) * 0.035 + Math.max(0, -vf) * -0.02) * gain;
      tx += clamp(-this.lastVy * air * 0.06, -0.2, 0.6) * gain;
      tx += clamp(-minFootZ / (0.5 * this.s), 0, 1) * (sp.legPush ?? 0.25);
      tx -= bodyPitch * (sp.gravity ?? 1);
      let tz = (vs * 0.05 - this.turn * 0.12) * gain;
      for (let i = 0; i < n; i++) {
        const k = i / Math.max(1, n - 1);
        const breeze = (Math.sin(t * 1.7 - i * 0.9) * 0.03 + Math.sin(t * 3.9 - i * 1.4) * 0.012) * (sp.breeze ?? 1);
        const flap = Math.sin(t * 9 - i * 1.3) * 0.05 * smooth(2, 7, Math.max(0, vf)) * (sp.flutter ?? 1);
        const share = i === 0 ? 0.55 : 0.45 / Math.max(1, n - 1) * 1.6;
        let gx = tx * share + breeze + flap;
        let gz = tz * share + Math.sin(t * 1.3 - i) * 0.015 * (sp.breeze ?? 1);
        if (dead > 0.5) { gx = (sp.deadX ?? -0.3) * (i === 0 ? 1 : 0.3); gz = 0; }
        if (sp.min !== undefined && i === 0) gx = Math.max(gx, sp.min);
        const w = (sp.omega ?? 11) - i * 1.4, z = sp.zeta ?? 0.42;
        const A = sp.a[i], Vv = sp.v[i];
        for (let s2 = 0; s2 < sub; s2++) {
          for (let c = 0; c < 2; c++) {
            const g = c === 0 ? gx : gz;
            const acc = w * w * (g - A[c]) - 2 * z * w * Vv[c];
            Vv[c] += acc * h; A[c] += Vv[c] * h;
          }
        }
        const jn = this.j[sp.bones[i]];
        _e.set(clamp(A[0], -1.2, 1.6) * (sp.sx ?? 1), 0, clamp(A[1], -0.8, 0.8) * (sp.sz ?? 1), 'XYZ');
        jn.quaternion.setFromEuler(_e);
      }
    }
  }

  _floaters(dt, t, s) {
    for (const f of this.floaters) {
      const jn = this.j[f.joint];
      if (!jn) continue;
      const base = f.base || (f.base = jn.position.clone());
      const cg = this.castGlow;
      if (f.type === 'orbit') {
        const sp = (f.speed ?? 1.2) * (1 + cg * 1.5), ang = t * sp + (f.phase || 0);
        const r = (f.r ?? 0.35) * (1 - 0.25 * cg) * this.s;
        jn.position.set(base.x + Math.cos(ang) * r, base.y + Math.sin(t * 1.7 + (f.phase || 0)) * 0.06 * this.s + cg * 0.1 * this.s, base.z + Math.sin(ang) * r);
        jn.rotation.set(t * 0.7, t * 1.1 + (f.phase || 0), 0);
      } else if (f.type === 'bob') {
        jn.position.set(base.x, base.y + Math.sin(t * (f.rate ?? 1.6) + (f.phase || 0)) * (f.amp ?? 0.025) * this.s, base.z);
        if (f.spin) jn.rotation.set(0, t * f.spin, 0);
      } else if (f.type === 'spin') {
        jn.rotation.set(f.tilt || 0, t * (f.rate ?? 0.6) * (1 + cg * 2), 0);
      } else if (f.type === 'staff') {
        // schwebender Stab nahe der Hand: leichtes Pendeln
        jn.position.set(base.x + Math.sin(t * 1.3) * 0.012 * this.s, base.y + Math.sin(t * 1.9) * 0.02 * this.s, base.z);
        const e = this.E[f.joint] || [0, 0, 0];
        _e.set(e[0] + Math.sin(t * 1.1) * 0.05, e[1] + t * (f.spin ?? 0), e[2] + Math.cos(t * 1.4) * 0.04, ARM_ORDER);
        jn.quaternion.setFromEuler(_e);
      }
    }
  }
}

function PI_(x) { return Math.PI * x; }
