// Effekte: GPU-Partikel (additiv, HDR → Bloom), Geschosse mit Leuchtspur, Schockwellen,
// Blitzketten, Lichtsäulen beim Aufwerten, schwebende Zahlen (Gold/Krit).
import * as THREE from 'three';
import { ATTACK_TYPES } from '../sim/data.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const PROJ = {
  arrow: { color: '#fff1c2', glow: 2.2, size: 0.12, len: 0.9, trail: '#ffd890', arc: 0.12 },
  bolt: { color: '#bfe8ff', glow: 2.5, size: 0.12, len: 0.8, trail: '#9fdcff', arc: 0.08 },
  magic: { color: '#7ad7ff', glow: 4, size: 0.3, len: 0.3, trail: '#5ab8ff', arc: 0.05 },
  void: { color: '#d07bff', glow: 4, size: 0.32, len: 0.3, trail: '#b04aff', arc: 0.05 },
  shell: { color: '#ffb36a', glow: 3.5, size: 0.34, len: 0.34, trail: '#ff7a2a', arc: 0.45 },
  bone: { color: '#efe6d0', glow: 1.6, size: 0.3, len: 0.36, trail: '#a6ff7a', arc: 0.45 },
};

export class Fx {
  constructor(scene, camera, settings) {
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.time = 0;
    this.initParticles(9000);
    this.initProjectiles(512);
    this.waves = [];
    this.initWaves(64);
    this.beams = [];
    this.initBeams(48);
    this.pillars = [];
    this.initPillars(16);
    this.texts = [];
    this.textLayer = document.getElementById('floaters');
    this.projState = new Map();
  }

  get density() { return this.settings.get('particles') ?? 1; }

  // ---------- Partikel ----------
  initParticles(cap) {
    this.pCap = cap;
    this.pN = 0;
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(cap * 3);
    this.pCol = new Float32Array(cap * 3);
    this.pSize = new Float32Array(cap);
    this.pVel = new Float32Array(cap * 3);
    this.pLife = new Float32Array(cap);
    this.pMax = new Float32Array(cap);
    this.pDrag = new Float32Array(cap);
    this.pGrav = new Float32Array(cap);
    this.pSize0 = new Float32Array(cap);
    this.pBase = new Float32Array(cap * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, vertexColors: true,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */`
        attribute float size; varying vec3 vCol; uniform float uScale;
        void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 1.8); gl_FragColor = vec4(vCol * a, a); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.root.add(this.points);
  }

  emit(x, y, z, { n = 10, color = '#ffffff', speed = 4, up = 2, life = 0.7, size = 0.35, grav = -6, drag = 2, spread = 0.2, intensity = 2.5, jitter = 0.4 } = {}) {
    n = Math.max(1, Math.round(n * this.density));
    _c.set(color);
    for (let i = 0; i < n; i++) {
      if (this.pN >= this.pCap) return;
      const j = this.pN++;
      const a = Math.random() * Math.PI * 2;
      const el = Math.random();
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.pPos[j * 3] = x + (Math.random() - 0.5) * spread;
      this.pPos[j * 3 + 1] = y + (Math.random() - 0.5) * spread;
      this.pPos[j * 3 + 2] = z + (Math.random() - 0.5) * spread;
      this.pVel[j * 3] = Math.cos(a) * sp * (1 - el * 0.5);
      this.pVel[j * 3 + 1] = up * (0.4 + Math.random()) + el * sp * 0.5;
      this.pVel[j * 3 + 2] = Math.sin(a) * sp * (1 - el * 0.5);
      const k = intensity * (1 - jitter / 2 + Math.random() * jitter);
      this.pBase[j * 3] = _c.r * k; this.pBase[j * 3 + 1] = _c.g * k; this.pBase[j * 3 + 2] = _c.b * k;
      this.pMax[j] = this.pLife[j] = life * (0.6 + Math.random() * 0.6);
      this.pSize0[j] = size * (0.6 + Math.random() * 0.8);
      this.pGrav[j] = grav; this.pDrag[j] = drag;
    }
  }

  /** Einzelnes Partikel mit vorgegebener Geschwindigkeit (für gerichtete/sogartige Effekte der Helden) */
  emitVel(x, y, z, vx, vy, vz, { color = '#ffffff', life = 0.6, size = 0.35, grav = 0, drag = 0, intensity = 2.5 } = {}) {
    if (this.pN >= this.pCap) return;
    const j = this.pN++;
    _c.set(color);
    this.pPos[j * 3] = x; this.pPos[j * 3 + 1] = y; this.pPos[j * 3 + 2] = z;
    this.pVel[j * 3] = vx; this.pVel[j * 3 + 1] = vy; this.pVel[j * 3 + 2] = vz;
    this.pBase[j * 3] = _c.r * intensity; this.pBase[j * 3 + 1] = _c.g * intensity; this.pBase[j * 3 + 2] = _c.b * intensity;
    this.pMax[j] = this.pLife[j] = life;
    this.pSize0[j] = size;
    this.pGrav[j] = grav; this.pDrag[j] = drag;
  }

  updateParticles(dt) {
    let n = this.pN;
    for (let i = 0; i < n; i++) {
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        // mit letztem tauschen
        n--;
        this.copyParticle(n, i);
        i--;
        continue;
      }
      const dr = Math.exp(-this.pDrag[i] * dt);
      const i3 = i * 3;
      this.pVel[i3] *= dr; this.pVel[i3 + 2] *= dr;
      this.pVel[i3 + 1] = this.pVel[i3 + 1] * dr + this.pGrav[i] * dt;
      this.pPos[i3] += this.pVel[i3] * dt;
      this.pPos[i3 + 1] = Math.max(0.05, this.pPos[i3 + 1] + this.pVel[i3 + 1] * dt);
      this.pPos[i3 + 2] += this.pVel[i3 + 2] * dt;
      const a = this.pLife[i] / this.pMax[i];
      const f = a < 0.7 ? a / 0.7 : 1;
      this.pCol[i3] = this.pBase[i3] * f; this.pCol[i3 + 1] = this.pBase[i3 + 1] * f; this.pCol[i3 + 2] = this.pBase[i3 + 2] * f;
      this.pSize[i] = this.pSize0[i] * (0.4 + 0.6 * a);
    }
    this.pN = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
  copyParticle(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pPos[to * 3 + k] = this.pPos[from * 3 + k];
      this.pVel[to * 3 + k] = this.pVel[from * 3 + k];
      this.pBase[to * 3 + k] = this.pBase[from * 3 + k];
      this.pCol[to * 3 + k] = this.pCol[from * 3 + k];
    }
    this.pLife[to] = this.pLife[from]; this.pMax[to] = this.pMax[from]; this.pSize0[to] = this.pSize0[from];
    this.pGrav[to] = this.pGrav[from]; this.pDrag[to] = this.pDrag[from]; this.pSize[to] = this.pSize[from];
  }

  // ---------- Geschosse ----------
  initProjectiles(cap) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.proj = new THREE.InstancedMesh(geo, mat, cap);
    this.proj.frustumCulled = false;
    this.proj.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.proj);
  }
  updateProjectiles(sim, dt) {
    let n = 0;
    const seen = new Set();
    for (const e of sim.entities.values()) {
      if (e.type !== 'p') continue;
      const st = PROJ[e.kind] || PROJ.magic;
      let s = this.projState.get(e.id);
      if (!s) { s = { x: e.x, z: e.z, total: Math.max(1, Math.hypot(e.tx - e.ox, e.tz - e.oz)) }; this.projState.set(e.id, s); }
      seen.add(e.id);
      const px = s.x, pz = s.z;
      s.x += (e.x - s.x) * Math.min(1, dt * 25); s.z += (e.z - s.z) * Math.min(1, dt * 25);
      const remain = Math.hypot(e.tx - s.x, e.tz - s.z);
      const prog = 1 - Math.min(1, remain / s.total);
      const y = 1.3 + Math.sin(prog * Math.PI) * st.arc * s.total;
      _v.set(s.x - px, 0, s.z - pz);
      const len = _v.length();
      if (len > 1e-4) { _v.normalize(); _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v); } else _q.identity();
      _m.compose(_p.set(s.x, y, s.z), _q, _s.set(st.size, st.size, Math.max(st.size, st.len)));
      _c.set(st.color).multiplyScalar(st.glow);
      if (n < 512) { this.proj.setMatrixAt(n, _m); this.proj.setColorAt(n, _c); n++; }
      if (Math.random() < 0.85) this.emit(s.x, y, s.z, { n: 1, color: st.trail, speed: 0.2, up: 0.1, life: 0.32, size: st.size * 2.4, grav: 0, drag: 4, spread: 0.05, intensity: 2.2 });
    }
    for (const id of this.projState.keys()) if (!seen.has(id)) this.projState.delete(id);
    this.proj.count = n;
    this.proj.instanceMatrix.needsUpdate = true;
    if (this.proj.instanceColor) this.proj.instanceColor.needsUpdate = true;
  }

  // ---------- Schockwellen ----------
  initWaves(cap) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float r = length(vUv-0.5)*2.0; float ring = smoothstep(0.55,0.92,r) * (1.0 - smoothstep(0.92,1.0,r)); gl_FragColor = vec4(vCol*ring, 1.0); }`,
    });
    this.waveMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.waveMesh.frustumCulled = false;
    this.waveMesh.renderOrder = 9;
    this.waveMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.waveMesh);
  }
  shock(x, z, { r = 3, color = '#ffd27a', life = 0.5, intensity = 2.5, y = 0.15 } = {}) {
    if (this.waves.length < 64) this.waves.push({ x, z, y, r, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0 });
  }
  updateWaves(dt) {
    let n = 0;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      if (w.t >= w.life) { this.waves.splice(i, 1); continue; }
      const a = w.t / w.life;
      const rr = w.r * 2 * (0.25 + 0.75 * (1 - Math.pow(1 - a, 3)));
      _m.compose(_p.set(w.x, w.y, w.z), _q.identity(), _s.set(rr, 1, rr));
      _c.copy(w.color).multiplyScalar(1 - a);
      this.waveMesh.setMatrixAt(n, _m); this.waveMesh.setColorAt(n, _c); n++;
    }
    this.waveMesh.count = n;
    this.waveMesh.instanceMatrix.needsUpdate = true;
    if (this.waveMesh.instanceColor) this.waveMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Blitzketten / Heilstrahlen ----------
  initBeams(cap) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float d = abs(vUv.x-0.5)*2.0; float a = pow(1.0-d, 3.0); gl_FragColor = vec4(vCol*a, a); }`,
    });
    this.beamMesh = new THREE.InstancedMesh(geo, mat, cap * 6);
    this.beamMesh.frustumCulled = false;
    this.beamMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.beamMesh);
  }
  beam(points, { color = '#9fdcff', life = 0.22, width = 0.35, jag = 0.6, intensity = 4 } = {}) {
    // zackige Segmente
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const steps = jag > 0 ? 3 : 1;
      let prev = a;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const p = new THREE.Vector3(
          a.x + (b.x - a.x) * t + (s < steps ? (Math.random() - 0.5) * jag : 0),
          a.y + (b.y - a.y) * t + (s < steps ? (Math.random() - 0.5) * jag : 0),
          a.z + (b.z - a.z) * t + (s < steps ? (Math.random() - 0.5) * jag : 0));
        segs.push([prev.clone(), p]);
        prev = p;
      }
    }
    if (this.beams.length < 48) this.beams.push({ segs, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0, width });
  }
  updateBeams(dt) {
    let n = 0;
    const camPos = this.camera.position;
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t >= b.life) { this.beams.splice(i, 1); continue; }
      const f = 1 - b.t / b.life;
      for (const [a, c] of b.segs) {
        if (n >= 288) break;
        const dir = _v.subVectors(c, a);
        const len = dir.length();
        dir.normalize();
        // Plane entlang dir ausrichten, Breite zur Kamera
        const toCam = new THREE.Vector3().subVectors(camPos, a).normalize();
        const side = new THREE.Vector3().crossVectors(dir, toCam).normalize();
        const normal = new THREE.Vector3().crossVectors(side, dir);
        const basis = new THREE.Matrix4().makeBasis(side.multiplyScalar(b.width * (0.6 + 0.4 * f)), dir.clone().multiplyScalar(len), normal);
        basis.setPosition(a);
        this.beamMesh.setMatrixAt(n, basis);
        this.beamMesh.setColorAt(n, _c.copy(b.color).multiplyScalar(f));
        n++;
      }
    }
    this.beamMesh.count = n;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Lichtsäulen ----------
  initPillars(cap) {
    const geo = new THREE.CylinderGeometry(1, 1.4, 1, 24, 1, true);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float a = pow(1.0 - vUv.y, 2.0) * (0.6 + 0.4*sin(vUv.x*62.83)); gl_FragColor = vec4(vCol*a, a); }`,
    });
    this.pillarMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.pillarMesh.frustumCulled = false;
    this.pillarMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.pillarMesh);
  }
  pillar(x, z, { color = '#ffd27a', r = 0.9, h = 7, life = 0.9, intensity = 2.5 } = {}) {
    if (this.pillars.length < 16) this.pillars.push({ x, z, r, h, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0 });
  }
  updatePillars(dt) {
    let n = 0;
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.t += dt;
      if (p.t >= p.life) { this.pillars.splice(i, 1); continue; }
      const a = p.t / p.life;
      const grow = Math.min(1, a * 5);
      _m.compose(_p.set(p.x, 0, p.z), _q.setFromAxisAngle(UP, a * 2), _s.set(p.r * (1 - a * 0.5), p.h * grow, p.r * (1 - a * 0.5)));
      this.pillarMesh.setMatrixAt(n, _m);
      this.pillarMesh.setColorAt(n, _c.copy(p.color).multiplyScalar(1 - a));
      n++;
    }
    this.pillarMesh.count = n;
    this.pillarMesh.instanceMatrix.needsUpdate = true;
    if (this.pillarMesh.instanceColor) this.pillarMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Schwebende Zahlen (DOM) ----------
  text(x, y, z, str, cls = '') {
    if (!this.textLayer || this.texts.length > 60) return;
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = str;
    this.textLayer.appendChild(el);
    this.texts.push({ el, x, y, z, t: 0, life: 1.1 });
  }
  updateTexts(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.t += dt;
      if (tx.t >= tx.life) { tx.el.remove(); this.texts.splice(i, 1); continue; }
      _v.set(tx.x, tx.y + tx.t * 1.6, tx.z).project(this.camera);
      if (_v.z > 1) { tx.el.style.opacity = 0; continue; }
      const a = tx.t / tx.life;
      tx.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${a < 0.15 ? 0.6 + a * 3 : 1})`;
      tx.el.style.opacity = a > 0.7 ? (1 - a) / 0.3 : 1;
    }
  }
  clearTexts() { for (const t of this.texts) t.el.remove(); this.texts.length = 0; }

  // ---------- Ereignisse aus der Simulation ----------
  onEvent(e, sim, view, localPid) {
    const showNums = this.settings.get('damageNumbers');
    switch (e.e) {
      case 'hit': {
        const col = ATTACK_TYPES[e.atk]?.color || '#ffffff';
        this.emit(e.x, 1.1, e.z, { n: e.crit ? 14 : 5, color: col, speed: e.crit ? 6 : 4, up: 1.5, life: 0.45, size: 0.28, intensity: e.crit ? 4 : 2.6 });
        if (e.crit) { this.text(e.x, 2.2, e.z, `${e.dmg}!`, 'crit'); }
        else if (showNums) this.text(e.x, 2, e.z, `${e.dmg}`, e.eff > 1.2 ? 'eff' : e.eff < 0.8 ? 'weak' : '');
        break;
      }
      case 'death': {
        const big = e.boss;
        const col = e.type === 'c' ? '#ff8a4a' : '#9fdcff';
        this.emit(e.x, 1, e.z, { n: big ? 140 : 22, color: col, speed: big ? 12 : 6, up: 4, life: big ? 1.6 : 0.9, size: big ? 0.7 : 0.4, intensity: 3 });
        this.emit(e.x, 0.6, e.z, { n: big ? 60 : 10, color: '#3a2a4a', speed: 3, up: 2, life: 1.2, size: 0.9, grav: 1, intensity: 0.5 });
        this.shock(e.x, e.z, { r: big ? 8 : 1.8, color: col, life: big ? 1 : 0.45, intensity: big ? 4 : 2 });
        break;
      }
      case 'gold':
        if (e.pid === localPid) this.text(e.x, 2.6, e.z, `+${e.amount}`, 'gold');
        break;
      case 'splash':
        this.shock(e.x, e.z, { r: e.r, color: ATTACK_TYPES[e.atk]?.color || '#ff9a5a', life: 0.4, intensity: 3 });
        this.emit(e.x, 0.6, e.z, { n: 16, color: '#ffb36a', speed: 6, up: 3, life: 0.6, size: 0.45, intensity: 3 });
        break;
      case 'chain': {
        const pts = e.path.map(([x, z]) => new THREE.Vector3(x, 1.3, z));
        this.beam(pts, { color: '#8fd8ff', width: 0.45, jag: 0.7, intensity: 5 });
        for (const p of pts) this.emit(p.x, p.y, p.z, { n: 6, color: '#bfe8ff', speed: 5, up: 1, life: 0.3, size: 0.3, intensity: 4 });
        break;
      }
      case 'heal': {
        const src = view.pos(e.src), tgt = view.pos(e.tgt);
        if (src && tgt) this.beam([new THREE.Vector3(src.x, 1.6, src.z), new THREE.Vector3(tgt.x, 1.2, tgt.z)], { color: '#9cff8a', width: 0.3, jag: 0, life: 0.35, intensity: 3 });
        this.emit(e.x, 0.6, e.z, { n: 10, color: '#9cff8a', speed: 1.2, up: 3, life: 0.9, size: 0.35, grav: 1.5, intensity: 2.5 });
        break;
      }
      case 'build':
        this.pillar(e.x, e.z, { color: '#7ad7ff', r: 1, h: 6, life: 0.8 });
        this.shock(e.x, e.z, { r: 2.2, color: '#7ad7ff', life: 0.6, intensity: 3 });
        this.emit(e.x, 0.3, e.z, { n: 30, color: '#9fe8ff', speed: 4, up: 4, life: 0.9, size: 0.35, intensity: 3 });
        break;
      case 'upgrade':
        this.pillar(e.x, e.z, { color: '#ffd27a', r: 1.2, h: 10, life: 1.2, intensity: 3 });
        this.shock(e.x, e.z, { r: 3, color: '#ffd27a', life: 0.8, intensity: 3.5 });
        this.emit(e.x, 0.5, e.z, { n: 50, color: '#ffe0a0', speed: 5, up: 7, life: 1.2, size: 0.4, grav: -2, intensity: 3.5 });
        break;
      case 'sell':
        this.emit(e.x, 1, e.z, { n: 24, color: '#ffd27a', speed: 3, up: 3, life: 0.8, size: 0.3, intensity: 3 });
        break;
      case 'spawn':
        this.emit(e.x, 1, e.z, { n: e.send ? 18 : 8, color: e.send ? '#ff3a8a' : '#a06bff', speed: 3, up: 2, life: 0.6, size: 0.45, intensity: 3 });
        break;
      case 'leak':
        this.shock(e.x, e.z, { r: 3, color: '#ff2a2a', life: 0.7, intensity: 4 });
        break;
      case 'kingAttack':
        this.shock(e.x, e.z, { r: 3, color: '#ffe08a', life: 0.45, intensity: 4 });
        this.emit(e.x, 1, e.z, { n: 20, color: '#ffe08a', speed: 7, up: 3, life: 0.5, size: 0.4, intensity: 4 });
        break;
      case 'impact':
        if (e.kind === 'shell' || e.kind === 'bone') this.emit(e.x, 0.4, e.z, { n: 8, color: '#5a4a3a', speed: 3, up: 3, life: 0.8, size: 0.6, intensity: 0.6, grav: -4 });
        break;
      default: break;
    }
  }

  update(sim, dt) {
    this.time += dt;
    this.updateProjectiles(sim, dt);
    this.updateParticles(dt);
    this.updateWaves(dt);
    this.updateBeams(dt);
    this.updatePillars(dt);
    this.updateTexts(dt);
    this.points.material.uniforms.uScale.value = window.innerHeight * 0.9;
  }

  clear() {
    this.pN = 0; this.waves.length = 0; this.beams.length = 0; this.pillars.length = 0; this.clearTexts(); this.projState.clear();
  }
}
