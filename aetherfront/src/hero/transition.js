// „Windzug-Schwenk“ – die Signatur-Kamerafahrt zwischen Vogelperspektive (Bauen) und Heldenblick (Kampf).
// Hinein: aus der RTS-Höhe stürzt die Kamera auf einer geschwungenen Catmull-Rom-Bahn durch die Luft, taucht
// hinter dem Helden tief ab und gleitet in die Schulterposition. Hinaus: die Kamera wird nach oben weggerissen
// und schwingt in einem weiten Bogen zurück in den Überblick.
// Während des Flugs: vorbeirauschende Windschlieren, FOV weitet sich und zieht sich zusammen, Geschwindigkeits-
// effekt (engine.setSpeedFx, falls vorhanden), Windrauschen, leichte Querneigung in den Kurven.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export const SWOOP_DUR = { normal: 2.0, short: 0.8, off: 0 };

const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
// Hinein: zögerlicher Start, kräftiger Sturz, sanftes Einrasten
const easeDive = (x) => smoother(x) * 0.75 + (1 - Math.pow(1 - x, 3.2)) * 0.25;
// Hinaus: sofortiges Wegreißen, weiches Ausgleiten
const easeRip = (x) => 1 - Math.pow(1 - x, 2.4);

/** RTS-Kamerapose zu einem RtsCamera-Zustand (gleiche Mathematik wie RtsCamera.update) */
export function rtsPose(c) {
  const horiz = Math.cos(c.pitch) * c.dist;
  return {
    pos: new THREE.Vector3(c.x + Math.sin(c.yaw) * horiz, Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * horiz),
    look: new THREE.Vector3(c.x, 0, c.z - 2),
  };
}

/** Windschlieren: Liniensegmente im Kameraraum, die am Betrachter vorbeirauschen (additiv, HDR → Bloom) */
class WindStreaks {
  constructor(scene, n = 220) {
    this.n = n;
    this.local = new Float32Array(n * 3);
    this.len = new Float32Array(n);
    this.tint = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6);
    this.col = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.lines = new THREE.LineSegments(g, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 30;
    this.lines.visible = false;
    scene.add(this.lines);
    for (let i = 0; i < n; i++) this.respawn(i, -Math.random() * 70);
  }
  respawn(i, z) {
    // Ring um die Blickachse: Mitte frei, damit das Ziel sichtbar bleibt
    const a = Math.random() * Math.PI * 2, r = 2.2 + Math.pow(Math.random(), 0.7) * 11;
    this.local[i * 3] = Math.cos(a) * r * 1.5;
    this.local[i * 3 + 1] = Math.sin(a) * r;
    this.local[i * 3 + 2] = z;
    this.len[i] = 0.6 + Math.random() * 1.4;
    this.tint[i] = Math.random();
  }
  update(dt, camera, intensity, speed) {
    const vis = intensity > 0.01;
    this.lines.visible = vis;
    if (!vis) return;
    camera.updateMatrixWorld();
    const M = camera.matrixWorld;
    const rel = 25 + speed * 1.8;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      this.local[i3 + 2] += rel * dt * (0.7 + this.len[i] * 0.3);
      if (this.local[i3 + 2] > 0.5) this.respawn(i, -50 - Math.random() * 25);
      const L = Math.min(9, this.len[i] * (0.4 + rel * 0.045));
      _a.set(this.local[i3], this.local[i3 + 1], this.local[i3 + 2]).applyMatrix4(M);
      _b.set(this.local[i3], this.local[i3 + 1], this.local[i3 + 2] - L).applyMatrix4(M);
      const o = i * 6;
      this.pos[o] = _a.x; this.pos[o + 1] = _a.y; this.pos[o + 2] = _a.z;
      this.pos[o + 3] = _b.x; this.pos[o + 4] = _b.y; this.pos[o + 5] = _b.z;
      // Nähe zur Kamera und Lebensphase → Helligkeit (vorn ausblenden, damit nichts „aufploppt“)
      const zf = Math.min(1, (-this.local[i3 + 2]) / 8) * Math.min(1, (this.local[i3 + 2] + 75) / 20);
      const k = intensity * zf * 1.6;
      const t = this.tint[i];
      // kühles Weiß → Äther-Türkis → zartes Gold
      const r = t < 0.6 ? 0.85 : 1.0, gC = t < 0.6 ? 0.95 : 0.86, bC = t < 0.6 ? 1.0 : 0.62;
      this.col[o] = r * k; this.col[o + 1] = gC * k; this.col[o + 2] = bC * k;
      this.col[o + 3] = 0; this.col[o + 4] = 0; this.col[o + 5] = 0;
    }
    const g = this.lines.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
  dispose() { this.lines.parent?.remove(this.lines); this.lines.geometry.dispose(); this.lines.material.dispose(); }
}

export class Swoop {
  constructor({ camera, scene, engine, audio }) {
    this.camera = camera;
    this.engine = engine;
    this.audio = audio;
    this.streaks = new WindStreaks(scene);
    this.active = null;
    this.lastPos = new THREE.Vector3();
    this.speed = 0;
    this.roll = 0;
  }

  /**
   * kind: 'in' (Sturzflug zum Helden) | 'out' (Wegreißen in den Überblick)
   * from: { pos, look, fov } · to: () => { pos, look, fov } (darf sich bewegen) · dur: Sekunden
   */
  start({ kind, from, to, dur, onDone, onProgress }) {
    const end = to();
    const P0 = from.pos.clone(), P3 = end.pos.clone();
    const dir = _a.subVectors(P3, P0); dir.y = 0;
    const flat = dir.length() || 1;
    dir.divideScalar(flat);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    // Schwungrichtung: zur Seite, auf der das Ziel liegt (natürlicher Bogen), deterministisch abwechselnd
    this.flip = this.flip ? -this.flip : 1;
    const sgn = this.flip;
    const pts = [P0];
    if (kind === 'in') {
      // 1) abheben/ausholen, 2) seitlicher Sturz, 3) tief hinter dem Helden, 4) Einrasten
      const lookDir = _b.subVectors(end.look, end.pos).setY(0).normalize();
      pts.push(P0.clone().lerp(P3, 0.22).addScaledVector(side, sgn * flat * 0.32).setY(P0.y * 0.92 + 4));
      pts.push(P0.clone().lerp(P3, 0.6).addScaledVector(side, -sgn * flat * 0.12).setY(Math.max(P3.y + 6, P0.y * 0.35)));
      pts.push(P3.clone().addScaledVector(lookDir, -7).addScaledVector(side, sgn * 3.5).setY(Math.max(1.2, P3.y - 0.9)));
    } else {
      const fwd = _b.subVectors(from.look, from.pos).setY(0).normalize();
      pts.push(P0.clone().addScaledVector(fwd, -6).addScaledVector(side, sgn * 3).setY(P0.y + 7));
      pts.push(P0.clone().lerp(P3, 0.42).addScaledVector(side, sgn * flat * 0.3).setY(P0.y + (P3.y - P0.y) * 0.75 + 10));
      pts.push(P0.clone().lerp(P3, 0.8).addScaledVector(side, -sgn * flat * 0.08).setY(P3.y + 6));
    }
    pts.push(P3);
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.active = { kind, from: { pos: P0, look: from.look.clone(), fov: from.fov }, to, t: 0, dur: Math.max(0.05, dur), onDone, onProgress, endAt: P3.clone() };
    this.lastPos.copy(P0);
    this.speed = 0;
    this.roll = 0;
    // Windrauschen + Musikübergabe übernimmt der Aufrufer zeitgleich
    if (this.audio && this.audio.wind) this.audio.wind(this.active.dur, { volume: kind === 'in' ? 0.9 : 0.75, up: kind === 'out' });
  }

  get running() { return !!this.active; }

  cancel() {
    if (!this.active) return;
    this.active = null;
    this.finishFx();
  }
  finishFx() {
    this.streaks.update(0, this.camera, 0, 0);
    this.engine.setSpeedFx?.(0);
  }

  update(dt) {
    const A = this.active;
    if (!A) return false;
    A.t += dt;
    const x = Math.min(1, A.t / A.dur);
    const u = A.kind === 'in' ? easeDive(x) : easeRip(x);
    const end = A.to();
    // Bahnpunkt; am Ende sanft in die lebende Zielpose (der Held kann sich bewegen)
    const p = this.curve.getPoint(Math.min(1, Math.max(0, u)), _a);
    p.add(_d.subVectors(end.pos, A.endAt).multiplyScalar(smoother(Math.min(1, x * 1.2))));
    // Blickpunkt: vom Start- zum Zielblick; zur Flugmitte hin teils entlang der Flugbahn schauen
    const lu = A.kind === 'in' ? smoother(Math.min(1, x * 1.15)) : smoother(Math.min(1, x * 1.35));
    const look = _b.lerpVectors(A.from.look, end.look, lu);
    const ahead = this.curve.getPoint(Math.min(1, u + 0.12), _c);
    const w = Math.pow(Math.sin(Math.PI * x), 2) * (A.kind === 'in' ? 0.32 : 0.22);
    if (u < 0.999) {
      const toAhead = ahead.sub(p).normalize().multiplyScalar(30).add(p);
      look.lerp(toAhead, w);
    }
    // Geschwindigkeit (für Schlieren/FOV/Speed-FX)
    const v = dt > 0 ? this.lastPos.distanceTo(p) / dt : 0;
    this.lastPos.copy(p);
    this.speed += (v - this.speed) * (1 - Math.exp(-dt * 10));
    const peak = Math.sin(Math.PI * x);
    // Querneigung aus der Kurvenkrümmung
    const t0 = this.curve.getTangent(Math.max(0, u - 0.03), _c);
    const t1 = this.curve.getTangent(Math.min(1, u + 0.03), _d);
    const turn = t0.x * t1.z - t0.z * t1.x;
    const rollGoal = Math.max(-0.32, Math.min(0.32, turn * 2.4)) * peak;
    this.roll += (rollGoal - this.roll) * (1 - Math.exp(-dt * 5));
    const cam = this.camera;
    cam.position.copy(p);
    cam.up.copy(UP);
    cam.lookAt(look);
    if (Math.abs(this.roll) > 1e-4) cam.quaternion.multiply(_q.setFromAxisAngle(_a.set(0, 0, 1), -this.roll));
    // FOV: weitet sich im Flug, zieht sich beim Einrasten zusammen
    const fov = A.from.fov + (end.fov - A.from.fov) * smoother(x) + 20 * Math.pow(peak, 1.4);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const intensity = Math.min(1, this.speed / 45) * Math.pow(peak, 0.6);
    this.streaks.update(dt, cam, intensity, this.speed);
    this.engine.setSpeedFx?.(intensity);
    A.onProgress?.(x);
    if (x >= 1) {
      this.active = null;
      this.finishFx();
      cam.fov = end.fov; cam.updateProjectionMatrix();
      A.onDone?.();
    }
    return true;
  }
}
