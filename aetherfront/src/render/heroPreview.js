// Helden-Vorschau: eigener kleiner WebGL-Blick für die Heldenauswahl (drehbar, Ruhe-Animation, Fähigkeiten-
// Vorführung) und Porträt-Aufnahmen (Kopf & Schultern) für Spieler- und Zielrahmen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HEROES } from '../sim/heroes.js';
import { buildHeroRig, createAnimator } from './heroRig.js';
import { animTime } from '../hero/anims.js';

const _v = new THREE.Vector3();

export class HeroPreview {
  constructor() {
    this.ok = false;
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'hero-preview-canvas';
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.r.toneMapping = THREE.ACESFilmicToneMapping;
      this.r.toneMappingExposure = 1.05;
      this.r.outputColorSpace = THREE.SRGBColorSpace;
      this.r.shadowMap.enabled = true;
      this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(this.r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(3, 6, 5); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      const rim = new THREE.DirectionalLight(0x7ab8ff, 3.4); rim.position.set(-4, 3, -5);
      const fill = new THREE.DirectionalLight(0xffc89a, 0.9); fill.position.set(-5, 2, 3);
      this.rimLight = rim;
      this.scene.add(key, rim, fill, new THREE.AmbientLight(0x404060, 0.5));
      // Podest: dunkler Stein mit leuchtendem Runenring
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.22, 48), new THREE.MeshStandardMaterial({ color: 0x1a1d28, roughness: 0.6, metalness: 0.3 }));
      ped.position.y = -0.11; ped.receiveShadow = true;
      this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.015, 6, 96), this.ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.005;
      this.scene.add(ped, ring);
      this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      this.holder = new THREE.Group();
      this.scene.add(this.holder);
      this.cache = new Map();
      this.portraitCache = new Map();
      this.ok = true;
    } catch { this.ok = false; }
    this.rot = 0.5; this.rotV = 0; this.drag = null;
    this.running = false;
    this.showT = 0;
    this.demo = null;
    this.size = { w: 0, h: 0 };
  }

  rigFor(heroId) {
    let e = this.cache.get(heroId);
    if (!e) {
      const def = HEROES[heroId];
      const rig = buildHeroRig(def.model, { palette: def.palette, level: 1 });
      rig.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      e = { rig, anim: createAnimator(rig) };
      this.cache.set(heroId, e);
    }
    return e;
  }

  /** Canvas in ein Element einhängen und mit Maus drehbar machen */
  mount(el) {
    if (!this.ok) return;
    el.appendChild(this.canvas);
    this.el = el;
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX }; this.canvas.setPointerCapture?.(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (!this.drag) return; const dx = e.clientX - this.drag.x; this.drag.x = e.clientX; this.rotV = dx * 0.012; this.rot += dx * 0.012; });
    this.canvas.addEventListener('pointerup', () => { this.drag = null; });
  }

  show(heroId) {
    if (!this.ok || !HEROES[heroId]) return;
    if (this.cur === heroId) return;
    this.cur = heroId;
    this.holder.clear();
    const e = this.rigFor(heroId);
    this.holder.add(e.rig.root);
    this.ringMat.color.set(HEROES[heroId].palette.glow).multiplyScalar(2.2);
    this.rimLight.color.set(HEROES[heroId].palette.glow);
    this.showT = 0;
    this.demo = { kind: 'roar', t: 0, dur: animTime('roar').dur * 1.4 };
    this.demoIdx = 0;
  }

  /** Fähigkeits-Animation vorführen (beim Überfahren einer Fähigkeit) */
  play(kind) { if (kind) this.demo = { kind, t: 0, dur: animTime(kind).dur * 1.4 }; }

  start() {
    if (!this.ok || this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  frame(dt) {
    if (!this.cur || !this.el) return;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.r.setSize(w, h, false);
      this.cam.aspect = w / h;
      this.cam.updateProjectionMatrix();
    }
    this.showT += dt;
    const e = this.rigFor(this.cur);
    // Drehung: Schwung abklingen lassen, sonst langsam weiterdrehen
    if (!this.drag) { this.rotV *= Math.exp(-dt * 3); this.rot += this.rotV + dt * 0.22; }
    e.rig.root.rotation.y = this.rot;
    // Vorführung
    let action = null;
    if (this.demo) {
      this.demo.t += dt;
      const t = this.demo.t / this.demo.dur;
      if (t >= 1) this.demo = null; else action = { kind: this.demo.kind, t, slot: 9 };
    } else if (this.showT > 5) {
      this.showT = 0;
      const abs = HEROES[this.cur].abilities;
      this.demoIdx = (this.demoIdx + 1) % abs.length;
      this.play(abs[this.demoIdx].anim);
    }
    e.anim.update(dt, { fwd: 0, strafe: 0, action, castGlow: action ? 0.6 : 0 });
    const H = e.rig.height || 2.4;
    this.cam.position.set(0, H * 0.66, H * 2.75);
    this.cam.lookAt(0, H * 0.6, 0);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
  }

  /** Porträt (Kopf & Schultern) als Bild-URL, zwischengespeichert */
  portrait(heroId, size = 192) {
    if (!this.ok || !HEROES[heroId]) return '';
    const key = `${heroId}|${size}`;
    if (this.portraitCache.has(key)) return this.portraitCache.get(key);
    const prevSize = { ...this.size };
    const prevChildren = [...this.holder.children];
    this.holder.clear();
    const e = this.rigFor(heroId);
    const root = e.rig.root;
    const ry = root.rotation.y;
    this.holder.add(root);
    root.rotation.y = 0.38;
    e.anim.update(0.016, {});
    root.updateMatrixWorld(true);
    const head = e.rig.joints.head || e.rig.joints.neck;
    const p = head ? head.getWorldPosition(_v) : _v.set(0, (e.rig.height || 2.4) * 0.85, 0);
    this.r.setPixelRatio(1);
    this.r.setSize(size, size, false);
    this.cam.aspect = 1; this.cam.updateProjectionMatrix();
    this.cam.position.set(p.x + 0.25, p.y + 0.12, p.z + 1.55);
    this.cam.lookAt(p.x, p.y - 0.12, p.z);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    const url = this.canvas.toDataURL('image/png');
    root.rotation.y = ry;
    this.holder.clear();
    for (const c of prevChildren) this.holder.add(c);
    this.size = { w: 0, h: 0 };
    void prevSize;
    this.portraitCache.set(key, url);
    return url;
  }
}
