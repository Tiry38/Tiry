// Third-Person-Kamera im WoW-Stil: hinter und über dem Helden, weicher Zoom (2–28 m), Neigungsgrenzen,
// weiche Kollision mit dem Boden (y ≥ 0,4) und mit der Bahnbegrenzung (außerhalb der 14 m breiten Bahn
// stehen Bäume, Felsen und Böschungen → die Kamera steigt dort an, statt hindurchzuschneiden).
// Konvention: yaw = Blickrichtung der Kamera wie die Heldenblickrichtung (0 = +Z), pitch > 0 = von oben.
import * as THREE from 'three';
import { LANE_WIDTH } from '../sim/layout.js';

export const HERO_FOV = 56;
export const ZOOM_MIN = 2, ZOOM_MAX = 28;
export const PITCH_MIN = -0.55, PITCH_MAX = 1.42;
const HEAD = 2.05;            // Blickpunkt über dem Boden (knapp über Kopfhöhe des Helden, 1,25 × Modell)
const LANE_Z0 = -38.5, LANE_Z1 = 28.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3();

/** Mindesthöhe der Kamera an (x, z): Boden 0,4 m, außerhalb der Bahn ansteigend */
export function minCamHeight(x, z, lx) {
  let h = 0.4;
  const outX = Math.abs(x - lx) - (LANE_WIDTH / 2 + 0.4);
  if (outX > 0) h = Math.max(h, 0.9 + Math.min(8, outX * 1.15));
  const outZ = z > LANE_Z1 ? z - LANE_Z1 : z < LANE_Z0 ? LANE_Z0 - z : 0;
  if (outZ > 0) h = Math.max(h, 0.9 + Math.min(7, outZ * 0.9));
  return h;
}

/**
 * Reine Posenberechnung (auch für den Windzug-Schwenk): Blickpunkt am Helden, Kamera auf einer Kugel dahinter.
 * Liefert { pos, look } (THREE.Vector3).
 */
export function heroCamPose(hx, hy, hz, yaw, pitch, dist, lx, out = { pos: new THREE.Vector3(), look: new THREE.Vector3() }) {
  const look = out.look.set(hx, hy + HEAD, hz);
  const horiz = Math.cos(pitch) * dist;
  const pos = out.pos.set(hx - Math.sin(yaw) * horiz, look.y + Math.sin(pitch) * dist, hz - Math.cos(yaw) * horiz);
  const minH = minCamHeight(pos.x, pos.z, lx);
  if (pos.y < minH) pos.y = minH;
  return out;
}

export class HeroCamera {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.yaw = Math.PI;          // absolute Kamerablickrichtung
    this.pitch = 0.32;
    this.dist = settings.get('heroCamDist') || 9;
    this.distGoal = this.dist;
    this.lift = 0;               // weiches Anheben bei Hindernissen
    this.pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.shake = 0;
    this.fov = HERO_FOV;
    this.spectate = null;        // { x, z, t } – Zuschauerblick beim Heldentod
  }

  reset(yaw) {
    this.yaw = yaw;
    this.pitch = 0.32;
    this.distGoal = this.dist = clamp(this.settings.get('heroCamDist') || 9, ZOOM_MIN, ZOOM_MAX);
    this.lift = 0;
    this.spectate = null;
  }

  zoom(deltaY) {
    // Mausrad: multiplikativ, damit sich nah und fern gleich anfühlt
    const step = clamp(deltaY / 100, -3, 3);
    this.distGoal = clamp(this.distGoal * Math.pow(1.16, step), ZOOM_MIN, ZOOM_MAX);
  }

  rotate(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  /** Zielpose für (Held, aktuelle Kamerawerte) – ohne Glättung (für Übergänge) */
  targetPose(hx, hy, hz, lx, yaw = this.yaw, dist = this.distGoal) {
    return heroCamPose(hx, hy, hz, yaw, this.pitch, dist, lx, { pos: new THREE.Vector3(), look: new THREE.Vector3() });
  }

  update(dt, hx, hy, hz, lx, time = 0) {
    this.dist += (this.distGoal - this.dist) * (1 - Math.exp(-dt * 9));
    const P = this.pose;
    if (this.spectate) {
      // Zuschauerblick: langsam kreisend hoch über der Bahn
      const s = this.spectate;
      s.t += dt;
      const a = s.yaw + s.t * 0.12;
      const k = 1 - Math.exp(-dt * 1.6);
      s.cx += (s.x - s.cx) * k; s.cz += (s.z - s.cz) * k;
      _v.set(s.cx - Math.sin(a) * 26, 22, s.cz - Math.cos(a) * 26);
      P.pos.lerp(_v, 1 - Math.exp(-dt * 1.4));
      P.look.lerp(_v.set(s.cx, 0.5, s.cz), 1 - Math.exp(-dt * 2.2));
    } else {
      heroCamPose(hx, hy, hz, this.yaw, this.pitch, this.dist, lx, P);
      // Hindernis-Anheben weich (kein Springen der Kamera an der Bahnkante)
      const raw = P.pos.y;
      const free = P.look.y + Math.sin(this.pitch) * this.dist;
      const want = Math.max(0, raw - free);
      this.lift += (want - this.lift) * (1 - Math.exp(-dt * (want > this.lift ? 10 : 4)));
      P.pos.y = Math.max(free + this.lift, 0.4);
    }
    const c = this.camera;
    c.position.copy(P.pos);
    if (this.shake > 0) {
      const s = this.shake * 0.18;
      c.position.x += (Math.random() - 0.5) * s; c.position.y += (Math.random() - 0.5) * s; c.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.6);
    }
    c.up.set(0, 1, 0);
    c.lookAt(P.look);
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov += (this.fov - c.fov) * (1 - Math.exp(-dt * 6)); c.updateProjectionMatrix(); }
    return P;
  }

  startSpectate(x, z) {
    this.spectate = { x, z, cx: x, cz: z, t: 0, yaw: this.yaw };
  }
  stopSpectate() { this.spectate = null; }
}
