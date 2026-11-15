// Missions-Objekte und Bodenwarnungen (Telegraphs) in der 3D-Welt.
// - Bodenwarnungen: rote, sich füllende Kreise/Schneisen – Zeitpunkt des Einschlags ist am Rand ablesbar.
// - Objekte: Ätherfunken (schwebende Kristalle), Leuchtfeuer (Feuerschale), Käfige (mit Ablauf-Ring),
//   Kristallpfeiler (Obelisk, lädt sich auf), Kraftknoten (leuchtende Bodenfelder), Runensteine, Dampfventile,
//   Risskerne, Leuchtkugeln. Anklickbare Objekte bekommen einen pulsierenden Hinweisring (Hover hebt ihn hervor).
// - Markierungen (Pings) der Mitspieler: aufsteigende Ringe mit Lichtsäule.
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
      rune: new THREE.MeshStandardMaterial({ color: 0x5a5560, roughness: 0.7, metalness: 0.1, emissive: 0xffb84a, emissiveIntensity: 0.35 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 0.95 }),
      steam: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 2.0), toneMapped: false, transparent: true, opacity: 0.35, depthWrite: false }),
      rift: new THREE.MeshStandardMaterial({ color: 0x2a0a3a, emissive: 0xb04aff, emissiveIntensity: 2.4, roughness: 0.2, metalness: 0.3 }),
      flare: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.2), toneMapped: false }),
      hint: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.78, 0.12), toneMapped: false, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    this.hintGeo = new THREE.RingGeometry(1.35, 1.55, 48).rotateX(-Math.PI / 2);
    this.pings = [];
    this.hoverId = null;
  }

  /** Markierung (Ping) an einer Stelle der Welt – color: CSS-Farbe */
  ping(x, z, color = '#ffd27a') {
    const g = new THREE.Group();
    const c = new THREE.Color(color).multiplyScalar(2.6);
    const mat = new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 48).rotateX(-Math.PI / 2), mat); r.position.y = 0.1 + i * 0.02; g.add(r); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 9, 10, 1, true), mat); beam.position.y = 4.5; g.add(beam);
    g.position.set(x, 0, z);
    this.root.add(g);
    this.pings.push({ g, mat, t: 0 });
  }

  /** Ereignisse aus der Simulation */
  onEvent(e, sim) {
    if (e.e === 'telegraph') this.teles.push({ ...e, t: 0 });
  }
  setHover(id) { this.hoverId = id; }

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
    } else if (k === 'rune') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 2.4, 6), this.mats.rune); st.position.y = 1.2; st.castShadow = true; g.add(st);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.mats.crystal); gem.position.y = 2.8; g.add(gem); g.userData.spin = gem; g.userData.spinY = 2.8;
    } else if (k === 'valve') {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.6, 12), this.mats.brass); pipe.position.y = 0.8; pipe.castShadow = true; g.add(pipe);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 20).rotateX(Math.PI / 2), this.mats.metal); wheel.position.y = 1.7; g.add(wheel); g.userData.wheel = wheel;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), this.mats.steam); puff.position.y = 2.2; g.add(puff); g.userData.puff = puff;
    } else if (k === 'riftcore') {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), this.mats.rift); c.position.y = 1.6; g.add(c); g.userData.spin = c; g.userData.spinY = 1.6;
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.7, 5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.4, 2.6), toneMapped: false, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); ring.position.y = 0.07; g.add(ring);
      const light = new THREE.PointLight(0xb04aff, 25, 10, 1.8); light.position.y = 1.6; g.add(light);
    } else if (k === 'flare') {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), this.mats.flare); f.position.y = 5; g.add(f); g.userData.flare = f;
      const light = new THREE.PointLight(0xfff0c0, 120, 18, 1.4); light.position.y = 5; g.add(light); g.userData.light = light;
      const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8, 64).rotateX(-Math.PI / 2), this.mats.ring.clone()); ring.position.y = 0.06; g.add(ring);
    } else {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), this.mats.crystal); c.position.y = 1.4; g.add(c); g.userData.spin = c;
    }
    // Hinweisring für anklickbare Objekte
    const hint = new THREE.Mesh(this.hintGeo, this.mats.hint.clone()); hint.position.y = 0.05; hint.visible = false; g.add(hint);
    g.userData.hint = hint;
    g.position.set(e.x, 0, e.z);
    this.root.add(g);
    return { g, kind: k };
  }

  /** clickable(e) → bool: Hinweisring für anklickbare Objekte */
  update(sim, dt, clickable) {
    this.time += dt;
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      p.t += dt;
      const k = p.t / 2.4;
      if (k >= 1) { this.root.remove(p.g); p.g.traverse((c) => c.geometry && c.geometry.dispose()); p.mat.dispose(); this.pings.splice(i, 1); continue; }
      p.g.children[0].scale.setScalar(1 + k * 3);
      p.g.children[1].scale.setScalar(1 + ((k * 3) % 1) * 2);
      p.mat.opacity = 1 - k;
    }
    this.teleMat.uniforms.uTime.value = this.time;
    // Objekte mit der Simulation abgleichen
    const seen = new Set();
    for (const e of sim.entities.values()) {
      if (e.type !== 'o') continue;
      seen.add(e.id);
      let o = this.objs.get(e.id);
      if (!o) { o = this.makeObj(e); this.objs.set(e.id, o); }
      const u = o.g.userData;
      if (u.spin) { u.spin.rotation.y += dt * 1.6; u.spin.position.y = (u.spinY || 1.4) + Math.sin(this.time * 2.4 + e.id) * 0.18; }
      if (u.hint) {
        const can = clickable ? !!clickable(e) : false;
        u.hint.visible = can;
        if (can) { const hov = this.hoverId === e.id; u.hint.material.opacity = hov ? 1 : 0.35 + 0.3 * Math.sin(this.time * 5); u.hint.scale.setScalar(hov ? 1.15 : 1); }
      }
      if (u.wheel) u.wheel.rotation.y += dt * 2;
      if (u.puff) { const f = 1 - Math.max(0, Math.min(1, (e.timer ?? 7) / (e.maxTimer || 7))); u.puff.scale.setScalar(0.6 + f * 1.6 + Math.sin(this.time * 18) * 0.08 * f); u.puff.material.opacity = 0.2 + f * 0.5; }
      if (u.flare) { const f = Math.max(0, (e.timer ?? 6) / (e.maxTimer || 6)); u.light.intensity = 120 * Math.min(1, f * 3); u.flare.position.y = 3 + f * 2; }
      if (o.kind === 'beacon') {
        const lit = !!e.lit;
        u.flame.visible = lit; u.light.intensity = lit ? 60 : 0;
        if (lit) u.flame.scale.set(1 + Math.sin(this.time * 13) * 0.08, 1 + Math.sin(this.time * 9) * 0.15, 1);
        u.ring.material.opacity = lit ? 0.15 * Math.min(1, (e.burn || 0) / 4) : 0.55;
      }
      if (o.kind === 'pylon') {
        const lit = !!e.lit;
        u.ob.material.emissiveIntensity = lit ? 3 + Math.sin(this.time * 4) * 0.6 : 0.4;
        u.ring.material.opacity = lit ? 0.15 : 0.5;
      }
      if (o.kind === 'cage' && u.timer) {
        const f = Math.max(0, Math.min(1, (e.timer ?? 30) / (e.maxTimer || 30)));
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
    for (const p of this.pings) this.root.remove(p.g);
    this.pings.length = 0;
    for (const o of this.objs.values()) this.root.remove(o.g);
    this.objs.clear();
  }
}
