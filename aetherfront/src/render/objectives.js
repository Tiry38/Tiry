// Missions-Objekte und Bodenwarnungen (Telegraphs) in der 3D-Welt.
// - Bodenwarnungen: rote, sich füllende Kreise/Schneisen – Zeitpunkt des Einschlags ist am Rand ablesbar.
// - Objekte: Ätherfunken (schwebende Kristalle), Leuchtfeuer (Feuerschale), Käfige (mit Ablauf-Ring),
//   Kristallpfeiler (Obelisk, lädt sich auf), Kraftknoten (leuchtende Bodenfelder).
import * as THREE from 'three';

const TELE_CAP = 48;

function teleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aProg; attribute float aShape; attribute vec2 aSize;
      varying vec2 vUv; varying float vProg; varying float vShape; varying vec2 vSize;
      void main(){ vUv = uv; vProg = aProg; vShape = aShape; vSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying float vProg; varying float vShape; varying vec2 vSize; uniform float uTime;
      void main(){
        vec3 red = vec3(2.2, 0.25, 0.12);
        float a;
        if (vShape < 0.5) {
          float r = length(vUv - 0.5) * 2.0;
          if (r > 1.0) discard;
          float edge = smoothstep(0.9, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
          float fill = step(r, vProg) * 0.35;
          float front = smoothstep(vProg - 0.06, vProg, r) * (1.0 - step(vProg, r)) * 0.9;
          float hatch = 0.08 * step(0.5, fract((vUv.x + vUv.y) * 14.0 - uTime * 1.5));
          a = edge + fill + front + hatch;
        } else {
          vec2 p = abs(vUv - 0.5) * 2.0;
          float edge = max(smoothstep(0.9, 1.0, p.x), smoothstep(0.96, 1.0, p.y));
          float fill = step(vUv.y, vProg) * 0.35;
          float arrows = 0.18 * step(0.6, fract(vUv.y * vSize.y * 0.5 - uTime * 2.0)) * (1.0 - p.x);
          a = edge + fill + arrows;
        }
        gl_FragColor = vec4(red * a, a);
      }`,
  });
}

export class ObjectivesView {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.time = 0;
    // Bodenwarnungen
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    g.setAttribute('aProg', new THREE.InstancedBufferAttribute(new Float32Array(TELE_CAP), 1));
    g.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(TELE_CAP), 1));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(TELE_CAP * 2), 2));
    this.teleMat = teleMaterial();
    this.tele = new THREE.InstancedMesh(g, this.teleMat, TELE_CAP);
    this.tele.frustumCulled = false; this.tele.renderOrder = 6; this.tele.count = 0;
    this.root.add(this.tele);
    this.teles = [];
    // Objekte
    this.objs = new Map();
    this.mats = {
      crystal: new THREE.MeshStandardMaterial({ color: 0x6fe8ff, emissive: 0x2ab8ff, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.85, metalness: 0.05 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.4, metalness: 0.9 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.4, 0.3), toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 3), toneMapped: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      node: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 0.8), toneMapped: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }

  /** Ereignisse aus der Simulation */
  onEvent(e, sim) {
    if (e.e === 'telegraph') this.teles.push({ ...e, t: 0 });
    else if (e.e === 'objLit') { const o = this.objs.get(e.id); if (o) o.lit = true; }
  }

  makeObj(e) {
    const g = new THREE.Group();
    const k = e.kind;
    if (k === 'shard') {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), this.mats.crystal); c.scale.set(0.8, 1.6, 0.8); c.position.y = 1.4; g.add(c);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40).rotateX(-Math.PI / 2), this.mats.ring); ring.position.y = 0.06; g.add(ring);
      g.userData.spin = c;
    } else if (k === 'beacon') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.1, 10), this.mats.stone); base.position.y = 0.55; base.castShadow = true; g.add(base);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 0.35, 14, 1, true), this.mats.metal); bowl.position.y = 1.25; g.add(bowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 10), this.mats.flame); flame.position.y = 1.9; flame.visible = false; g.add(flame);
      const light = new THREE.PointLight(0xffa04a, 0, 18, 1.6); light.position.y = 2.2; g.add(light);
      g.userData.flame = flame; g.userData.light = light;
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 48).rotateX(-Math.PI / 2), this.mats.ring.clone()); ring.position.y = 0.06; g.add(ring); g.userData.ring = ring;
    } else if (k === 'cage') {
      const bars = new THREE.Group();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), this.mats.metal); b.position.set(Math.cos(a) * 0.8, 1.1, Math.sin(a) * 0.8); bars.add(b); }
      const top = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 24).rotateX(Math.PI / 2), this.mats.metal); top.position.y = 2.2; bars.add(top);
      const prisoner = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 0.8 })); prisoner.position.y = 0.75; bars.add(prisoner);
      g.add(bars);
      const timer = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.45, 48, 1, 0, Math.PI * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.6, 0.3), toneMapped: false, transparent: true, depthWrite: false })); timer.position.y = 0.07; g.add(timer);
      g.userData.timer = timer;
    } else if (k === 'pylon') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.4, 8), this.mats.stone); base.position.y = 0.2; g.add(base);
      const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 3, 6), this.mats.crystal.clone()); ob.position.y = 1.9; ob.material.emissiveIntensity = 0.4; g.add(ob);
      g.userData.ob = ob;
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 48).rotateX(-Math.PI / 2), this.mats.ring.clone()); ring.position.y = 0.06; g.add(ring); g.userData.ring = ring;
    } else if (k === 'node') {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32).rotateX(-Math.PI / 2), this.mats.node); d.position.y = 0.08; g.add(d);
      g.userData.pulse = d;
    }
    g.position.set(e.x, 0, e.z);
    this.root.add(g);
    return { g, kind: k, lit: !!e.lit };
  }

  update(sim, dt) {
    this.time += dt;
    this.teleMat.uniforms.uTime.value = this.time;
    // Objekte mit der Simulation abgleichen
    const seen = new Set();
    for (const e of sim.entities.values()) {
      if (e.type !== 'o') continue;
      seen.add(e.id);
      let o = this.objs.get(e.id);
      if (!o) { o = this.makeObj(e); this.objs.set(e.id, o); }
      const u = o.g.userData;
      if (u.spin) { u.spin.rotation.y += dt * 1.6; u.spin.position.y = 1.4 + Math.sin(this.time * 2.4 + e.id) * 0.18; }
      if (o.kind === 'beacon') {
        const lit = e.lit || o.lit;
        u.flame.visible = lit; u.light.intensity = lit ? 60 : 0;
        if (lit) u.flame.scale.set(1 + Math.sin(this.time * 13) * 0.08, 1 + Math.sin(this.time * 9) * 0.15, 1);
        u.ring.material.opacity = lit ? 0 : 0.35 + 0.5 * Math.min(1, e.charge / 1.5);
      }
      if (o.kind === 'pylon') {
        const lit = e.lit || o.lit;
        u.ob.material.emissiveIntensity = lit ? 3 + Math.sin(this.time * 4) * 0.6 : 0.4 + 2 * Math.min(1, e.charge / 2);
        u.ring.material.opacity = lit ? 0.15 : 0.5;
      }
      if (o.kind === 'cage' && u.timer) {
        const f = Math.max(0, Math.min(1, (e.timer ?? 30) / 30));
        u.timer.geometry.dispose();
        u.timer.geometry = new THREE.RingGeometry(1.2, 1.45, 48, 1, 0, Math.PI * 2 * f).rotateX(-Math.PI / 2);
        u.timer.material.color.setRGB(2.5, 0.6 + 1.2 * f, 0.3 * f);
      }
      if (u.pulse) u.pulse.material.opacity = 0.35 + Math.sin(this.time * 3) * 0.15;
    }
    for (const [id, o] of this.objs) if (!seen.has(id)) { this.root.remove(o.g); o.g.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); this.objs.delete(id); }

    // Bodenwarnungen
    let n = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const prog = this.tele.geometry.attributes.aProg.array, shape = this.tele.geometry.attributes.aShape.array, size = this.tele.geometry.attributes.aSize.array;
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i];
      t.t += dt;
      if (t.t > t.dur + 0.15 || n >= TELE_CAP) { this.teles.splice(i, 1); continue; }
      const pr = Math.min(1, t.t / t.dur);
      if (t.shape === 'circle') {
        m.compose(p.set(t.x, 0.09, t.z), q.identity(), s.set(t.r * 2, 1, t.r * 2));
        shape[n] = 0; size[n * 2] = t.r; size[n * 2 + 1] = t.r;
      } else {
        const dx = t.x2 - t.x, dz = t.z2 - t.z, len = Math.hypot(dx, dz) || 1;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz));
        m.compose(p.set((t.x + t.x2) / 2, 0.09, (t.z + t.z2) / 2), q, s.set(t.w || 2, 1, len));
        shape[n] = 1; size[n * 2] = t.w || 2; size[n * 2 + 1] = len;
      }
      prog[n] = pr;
      this.tele.setMatrixAt(n, m);
      n++;
    }
    this.tele.count = n;
    this.tele.instanceMatrix.needsUpdate = true;
    for (const k of ['aProg', 'aShape', 'aSize']) this.tele.geometry.attributes[k].needsUpdate = true;
  }

  clear() {
    this.teles.length = 0;
    for (const o of this.objs.values()) this.root.remove(o.g);
    this.objs.clear();
  }
}
