// Porträts: rendert jedes 3D-Modell einmal in ein kleines Bild (für Bau-Leiste, Söldner, Auswahl).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildModel, createBodyMaterial, createGlowMaterial } from './models.js';

export class Portraits {
  constructor(size = 160) {
    this.size = size;
    this.cache = new Map();
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = size;
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.r.toneMapping = THREE.ACESFilmicToneMapping;
      this.r.outputColorSpace = THREE.SRGBColorSpace;
      this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(this.r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(3, 5, 4);
      const rim = new THREE.DirectionalLight(0x7ab8ff, 3.2); rim.position.set(-4, 3, -5);
      this.scene.add(key, rim, new THREE.AmbientLight(0x404060, 0.6));
      this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      this.bodyMat = createBodyMaterial();
      this.glowMat = createGlowMaterial();
    } catch { this.r = null; }
  }
  get(key, archetype, palette, tier = 1) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.r) return '';
    const m = buildModel(archetype, { ...palette, tier, seed: 3 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(m.body, this.bodyMat);
    g.add(body);
    if (m.glow) g.add(new THREE.Mesh(m.glow, this.glowMat));
    g.rotation.y = 0.55;
    this.scene.add(g);
    const h = m.height || 2;
    this.cam.position.set(0, h * 0.62, h * 2.15 + (m.radius || 0.6) * 1.2);
    this.cam.lookAt(0, h * 0.5, 0);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(g);
    this.cache.set(key, url);
    return url;
  }
}
