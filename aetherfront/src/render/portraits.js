// Porträts: rendert jede Einheit einmal in ein kleines Bild (Bau-Leiste, Söldner, Auswahlkarte, Sammlung).
// Nutzt dieselbe Besetzung wie das Spielfeld (roster.js): Vasallen in ihrer Form (I, II-A/B, III-A/B),
// Gegner als Wellen-Kreatur. Leicht erhöhter Blick (wie die Spielkamera), Bildausschnitt aus der Hüllkugel.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildModel, createBodyMaterial, createGlowMaterial } from './models.js';
import { UNITS } from '../sim/data.js';
import { fighterArch, formOf, creepModel } from './forge/roster.js';
import { forgeReady } from './forge/loader.js';

/** Schlüssel (f|<unitId> bzw. c|<key>) → { arch, form } nach der Besetzungsliste */
export function portraitModel(key, archetype, tier = 1) {
  const [kind, id] = String(key).split('|');
  if (kind === 'f' && UNITS[id]) { const d = UNITS[id]; return { arch: fighterArch(d), form: formOf(d) }; }
  if (kind === 'c' && id) {
    const m = /^w(\d+)([cL]?)$/.exec(id);
    const cm = creepModel(m ? { n: +m[1], model: archetype, key: id, champion: m[2] === 'c', leader: m[2] === 'L' } : { key: id, model: archetype });
    return { arch: cm.arch, form: cm.form };
  }
  return { arch: archetype, form: tier >= 3 ? '3a' : tier === 2 ? '2a' : '1' };
}

export class Portraits {
  constructor(size = 160) {
    this.size = size;
    this.cache = new Map();
    this.ready = false;
    forgeReady().then(() => { this.ready = true; });
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = size;
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.r.toneMapping = THREE.ACESFilmicToneMapping;
      this.r.outputColorSpace = THREE.SRGBColorSpace;
      this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(this.r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(3, 6, 4);
      const rim = new THREE.DirectionalLight(0x7ab8ff, 3.0); rim.position.set(-4, 3, -5);
      this.scene.add(key, rim, new THREE.AmbientLight(0x404060, 0.7));
      this.cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
      this.bodyMat = createBodyMaterial();
      this.glowMat = createGlowMaterial();
    } catch { this.r = null; }
  }
  get(key, archetype, palette, tier = 1) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.r) return '';
    const pm = portraitModel(key, archetype, tier);
    const m = buildModel(pm.arch, { ...palette, tier: +pm.form[0] || tier, form: pm.form, seed: 3, lod: 0 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, this.bodyMat));
    if (m.glow) g.add(new THREE.Mesh(m.glow, this.glowMat));
    g.rotation.y = 0.55;
    this.scene.add(g);
    // Bildausschnitt aus der Hülle (Flügel/Waffen bleiben im Bild)
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const R = Math.max(sz.y * 0.55, Math.hypot(sz.x, sz.z) * 0.42, 0.6);
    const d = R / Math.tan((this.cam.fov * Math.PI) / 360) * 1.02;
    const pitch = 0.42;
    this.cam.position.set(c.x, c.y + Math.sin(pitch) * d, c.z + Math.cos(pitch) * d);
    this.cam.lookAt(c.x, c.y - sz.y * 0.02, c.z);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(g);
    m.body.dispose(); if (m.glow) m.glow.dispose();
    // Erst nach dem Laden der Forge-Modelle dauerhaft merken (vorher wäre es das Ersatzmodell)
    if (m.forged || this.ready) this.cache.set(key, url);
    return url;
  }
}
