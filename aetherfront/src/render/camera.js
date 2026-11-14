// RTS-Kamera: Pfeiltasten/Randscrollen verschieben, Mausrad zoomt, mittlere Maustaste dreht,
// Leertaste springt zur eigenen Bahn. Weich gedämpft. Dazu Kamerafahrten für Menü & Intro.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RtsCamera {
  constructor(camera, dom, settings) {
    this.camera = camera;
    this.dom = dom;
    this.settings = settings;
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = { x: 0, z: 0, dist: 70, yaw: 0, pitch: 0.95 };
    this.cur = { x: 0, z: 0, dist: 70, yaw: 0, pitch: 0.95 };
    this.keys = new Set();
    this.mouse = { x: 0.5, y: 0.5, inside: false };
    this.drag = null;
    this.enabled = true;
    this.cinematic = null; // fn(t) -> {x,z,dist,yaw,pitch}
    this.shake = 0;
    this.bounds = { x0: -125, x1: 125, z0: -45, z1: 62 };

    window.addEventListener('keydown', (e) => { if (!e.target.closest || !e.target.closest('input,select,textarea')) this.keys.add(e.key); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX / window.innerWidth; this.mouse.y = e.clientY / window.innerHeight; this.mouse.inside = true;
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        if (this.drag.mode === 'rotate') {
          this.goal.yaw -= dx * 0.005;
          this.goal.pitch = clamp(this.goal.pitch + dy * 0.004, 0.45, 1.35);
        } else {
          const s = this.goal.dist * 0.0022;
          this.panLocal(-dx * s, -dy * s);
        }
      }
    });
    dom.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); this.drag = { x: e.clientX, y: e.clientY, mode: e.shiftKey ? 'pan' : 'rotate' }; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 1) this.drag = null; });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.goal.dist = clamp(this.goal.dist * Math.pow(1.0015, e.deltaY), 18, 200);
    }, { passive: false });
  }

  panLocal(dx, dz) {
    const y = this.cur.yaw;
    this.goal.x += Math.cos(y) * dx + Math.sin(y) * dz;
    this.goal.z += -Math.sin(y) * dx + Math.cos(y) * dz;
  }

  focus(x, z, dist, { instant = false, yaw, pitch } = {}) {
    this.goal.x = x; this.goal.z = z;
    if (dist != null) this.goal.dist = dist;
    if (yaw != null) this.goal.yaw = yaw;
    if (pitch != null) this.goal.pitch = pitch;
    if (instant) Object.assign(this.cur, this.goal);
  }

  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  update(dt, time) {
    if (this.cinematic) {
      const g = this.cinematic(time);
      Object.assign(this.goal, g);
    } else if (this.enabled) {
      const sp = this.goal.dist * 1.1 * (this.settings.get('camSpeed') || 1) * dt;
      let dx = 0, dz = 0;
      const k = this.keys;
      if (k.has('ArrowLeft')) dx -= 1;
      if (k.has('ArrowRight')) dx += 1;
      if (k.has('ArrowUp')) dz -= 1;
      if (k.has('ArrowDown')) dz += 1;
      if (this.settings.get('edgeScroll') && this.mouse.inside && document.hasFocus()) {
        const m = 0.012;
        if (this.mouse.x < m) dx -= 1; else if (this.mouse.x > 1 - m) dx += 1;
        if (this.mouse.y < m) dz -= 1; else if (this.mouse.y > 1 - m) dz += 1;
      }
      if (dx || dz) this.panLocal(dx * sp, dz * sp);
      if (k.has('PageUp')) this.goal.yaw += dt * 1.2;
      if (k.has('PageDown')) this.goal.yaw -= dt * 1.2;
    }
    const b = this.bounds;
    this.goal.x = clamp(this.goal.x, b.x0, b.x1);
    this.goal.z = clamp(this.goal.z, b.z0, b.z1);
    const f = 1 - Math.exp(-dt * (this.cinematic ? 1.6 : 9));
    for (const key of ['x', 'z', 'dist', 'yaw', 'pitch']) this.cur[key] += (this.goal[key] - this.cur[key]) * f;

    const c = this.cur;
    const horiz = Math.cos(c.pitch) * c.dist;
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.camera.position.set(c.x + Math.sin(c.yaw) * horiz + sx, Math.sin(c.pitch) * c.dist + sy, c.z + Math.cos(c.yaw) * horiz);
    this.target.set(c.x, 0, c.z - 2);
    this.camera.lookAt(this.target);
  }
}
