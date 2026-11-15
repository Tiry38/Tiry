// RTS-Kamera wie im Genre üblich (Draufsicht bleibt stabil):
//   Pfeiltasten + Bildschirmrand (10 px) verschieben · mittlere ODER rechte Maustaste ziehen = Karte greifen ·
//   Mausrad zoomt zum Mauszeiger · Alt + mittlere Maustaste (oder Bild↑/Bild↓) dreht · Leertaste/Pos1 springen (main.js).
// Weich gedämpft. Dazu Kamerafahrten für Menü & Intro.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Draufsicht wie im Genre-Vorbild: leichtes Tele (wenig Verzerrung, Figuren wirken größer und „plastischer“),
// Neigung ~56°. Die Standardansicht der eigenen Bahn (Abstand 58 aus dem Spiel) rückt näher heran, sodass das
// Bauraster gut die Hälfte der Bildhöhe füllt; Übersichten (≥ 150) behalten ihren bisherigen Bildausschnitt.
export const RTS_FOV = 30;
const FOV_K = Math.tan((42 * Math.PI) / 360) / Math.tan((RTS_FOV * Math.PI) / 360);
/** Eingestellter Abstand → tatsächlicher Kameraabstand (monoton) */
export function effectiveDist(d) { return d * (0.76 + (FOV_K - 0.76) * smooth(55, 150, d)); }

export const EDGE_PX = 10;          // Randscroll-Zone in Bildschirm-Pixeln
export const ZOOM_MIN = 24, ZOOM_MAX = 200;
const DRAG_PX = 5;                  // ab dieser Mausbewegung ist ein Rechtsklick ein Ziehen (kein Abbrechen)

/** Randscrollen: Richtung (-1/0/1) je Achse aus der Mausposition (px) und der Fenstergröße */
export function edgeDir(mx, my, w, h, edge = EDGE_PX) {
  return { x: mx <= edge ? -1 : mx >= w - 1 - edge ? 1 : 0, z: my <= edge ? -1 : my >= h - 1 - edge ? 1 : 0 };
}

/** Zoom zum Mauszeiger: neuer Blickpunkt, sodass der Bodenpunkt P unter dem Zeiger bleibt (k = neuer/alter Abstand) */
export function zoomToward(gx, gz, px, pz, k) { return { x: px + (gx - px) * k, z: pz + (gz - pz) * k }; }

const isTextField = (el) => !!(el && el.closest && el.closest('textarea, select, input:not([type=range]):not([type=checkbox]):not([type=button])'));

export class RtsCamera {
  constructor(camera, dom, settings) {
    this.camera = camera;
    this.camera.fov = RTS_FOV; this.camera.updateProjectionMatrix();
    this.dom = dom;
    this.settings = settings;
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = { x: 0, z: 0, dist: 70, yaw: 0, pitch: 0.95 };
    this.cur = { x: 0, z: 0, dist: 70, yaw: 0, pitch: 0.95 };
    this.keys = new Set();
    this.mouse = { x: -1, y: -1, inside: false };
    this.drag = null;
    this.enabled = true;
    this.canScroll = () => true;      // main.js: nur im Spiel ohne offenes Menü
    this.onRightClick = null;         // Rechtsklick ohne Ziehen (Abbrechen/Abwählen)
    this.cinematic = null; // fn(t) -> {x,z,dist,yaw,pitch}
    this.shake = 0;
    this.bounds = { x0: -125, x1: 125, z0: -60, z1: 62 };
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    // Tasten: über e.code (unabhängig von Umschalt/Tastaturbelegung); nur Textfelder (Chat) sperren die Kamera
    window.addEventListener('keydown', (e) => {
      if (isTextField(e.target)) return;
      if (e.code.startsWith('Arrow') || e.code === 'PageUp' || e.code === 'PageDown') {
        this.keys.add(e.code);
        if (this.enabled && this.canScroll()) e.preventDefault(); // kein Fokuswechsel/Scrollen in der Oberfläche
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.inside = false; this.drag = null; });
    // Maus fensterweit verfolgen: die Oberfläche liegt an den Rändern über der Szene – Randscrollen muss trotzdem greifen
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) this.dragMove(e);
    });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.mouse.inside = false; });
    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.cinematic) return;
      if (e.button === 1 || e.button === 2) {
        if (e.button === 1) e.preventDefault(); // kein Autoscroll
        const rotate = e.button === 1 && e.altKey;
        this.drag = { button: e.button, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, mode: rotate ? 'rotate' : 'pan', grab: rotate ? null : this.groundAt(e.clientX, e.clientY) };
      }
    });
    window.addEventListener('mouseup', (e) => {
      const d = this.drag;
      if (!d || e.button !== d.button) return;
      this.drag = null;
      if (d.button === 2 && !d.moved && this.onRightClick) this.onRightClick(e);
    });
    dom.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled || this.cinematic) return;
      e.preventDefault();
      const d0 = this.goal.dist;
      const step = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const d1 = clamp(d0 * Math.pow(1.0015, clamp(step, -400, 400)), ZOOM_MIN, ZOOM_MAX);
      if (d1 === d0) return;
      const p = this.groundAt(e.clientX, e.clientY);
      if (p) {
        // Blickpunkt am Boden ist (x, z − 2) – ihn um P skalieren, so bleibt P unter dem Zeiger
        const k = effectiveDist(d1) / effectiveDist(d0);
        const n = zoomToward(this.goal.x, this.goal.z - 2, p.x, p.z, k);
        this.goal.x = n.x; this.goal.z = n.z + 2;
      }
      this.goal.dist = d1;
      this.clampGoal();
    }, { passive: false });
  }

  /** Bodenpunkt (y = 0) unter einer Bildschirmposition mit der aktuellen Kamera */
  groundAt(px, py) {
    const r = this.dom.getBoundingClientRect();
    const w = r.width || window.innerWidth, h = r.height || window.innerHeight;
    this._ndc.set(((px - r.left) / w) * 2 - 1, -((py - r.top) / h) * 2 + 1);
    this.camera.updateMatrixWorld();
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.ray.intersectPlane(this._plane, this._hit);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  /** Sichtfeld am Boden: die vier Bildecken (für die Minimap); null, wenn eine Ecke über dem Horizont liegt */
  viewQuad() {
    const r = this.dom.getBoundingClientRect();
    const w = r.width || window.innerWidth, h = r.height || window.innerHeight;
    const out = [];
    for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
      const p = this.groundAt(r.left + x, r.top + y);
      if (!p) return null;
      out.push(p);
    }
    return out;
  }

  dragMove(e) {
    const d = this.drag;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_PX) d.moved = true;
    if (!d.moved) return;
    if (d.mode === 'rotate') {
      this.goal.yaw -= dx * 0.005;
      this.goal.pitch = clamp(this.goal.pitch + dy * 0.004, 0.55, 1.35);
      return;
    }
    // Greifen: der beim Drücken gefasste Bodenpunkt bleibt unter dem Mauszeiger
    const now = d.grab && this.groundAt(e.clientX, e.clientY);
    if (now) {
      this.goal.x += d.grab.x - now.x; this.goal.z += d.grab.z - now.z;
    } else {
      const s = effectiveDist(this.goal.dist) * 0.0016;
      this.panLocal(-dx * s, -dy * s);
    }
    this.clampGoal();
    // sofort folgen (keine Dämpfung beim Greifen, sonst „schwimmt“ der Boden unter dem Zeiger)
    this.cur.x = this.goal.x; this.cur.z = this.goal.z;
    this.apply(0);
  }

  panLocal(dx, dz) {
    const y = this.cur.yaw;
    this.goal.x += Math.cos(y) * dx + Math.sin(y) * dz;
    this.goal.z += -Math.sin(y) * dx + Math.cos(y) * dz;
  }

  /** Bewegungsraum des Blickpunkts (Welteinheiten), z. B. aus mapLayout().camBounds */
  setBounds(b) { if (b) this.bounds = { ...b }; this.clampGoal(); }
  clampGoal() {
    if (this.cinematic) return;
    const b = this.bounds;
    this.goal.x = clamp(this.goal.x, b.x0, b.x1);
    this.goal.z = clamp(this.goal.z, b.z0, b.z1);
  }

  focus(x, z, dist, { instant = false, yaw, pitch } = {}) {
    this.goal.x = x; this.goal.z = z;
    if (dist != null) this.goal.dist = dist;
    if (yaw != null) this.goal.yaw = yaw;
    if (pitch != null) this.goal.pitch = pitch;
    this.clampGoal();
    if (instant) Object.assign(this.cur, this.goal);
  }

  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  update(dt, time) {
    if (this.cinematic) {
      const g = this.cinematic(time);
      Object.assign(this.goal, g);
    } else if (this.enabled && this.canScroll()) {
      // Tempo: ~1,5 Bildbreiten pro Sekunde, unabhängig vom Zoom; nach 0,4 s gedrückt halten etwas schneller
      const k = this.keys;
      let dx = 0, dz = 0;
      if (k.has('ArrowLeft')) dx -= 1;
      if (k.has('ArrowRight')) dx += 1;
      if (k.has('ArrowUp')) dz -= 1;
      if (k.has('ArrowDown')) dz += 1;
      if (this.settings.get('edgeScroll') !== false && this.mouse.inside && !this.drag && document.hasFocus()) {
        const e = edgeDir(this.mouse.x, this.mouse.y, window.innerWidth, window.innerHeight);
        dx = dx || e.x; dz = dz || e.z;
      }
      this.held = dx || dz ? (this.held || 0) + dt : 0;
      if (dx || dz) {
        const n = Math.hypot(dx, dz);
        const sp = effectiveDist(this.goal.dist) * 1.4 * (this.settings.get('camSpeed') || 1) * (1 + 0.6 * smooth(0.4, 1.4, this.held)) * dt;
        this.panLocal((dx / n) * sp, (dz / n) * sp);
      }
      if (k.has('PageUp')) this.goal.yaw += dt * 1.2;
      if (k.has('PageDown')) this.goal.yaw -= dt * 1.2;
    } else this.held = 0;
    this.clampGoal();
    this.apply(dt);
  }

  apply(dt) {
    if (dt > 0) {
      const f = 1 - Math.exp(-dt * (this.cinematic ? 1.6 : 10));
      for (const key of ['x', 'z', 'dist', 'yaw', 'pitch']) this.cur[key] += (this.goal[key] - this.cur[key]) * f;
    }
    const c = this.cur;
    const dist = effectiveDist(c.dist);
    const horiz = Math.cos(c.pitch) * dist;
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.camera.position.set(c.x + Math.sin(c.yaw) * horiz + sx, Math.sin(c.pitch) * dist + sy, c.z + Math.cos(c.yaw) * horiz);
    this.target.set(c.x, 0, c.z - 2);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
