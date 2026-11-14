// Aether-Forge – Helden-Effekte: Bodenaura in Klassenfarbe, Glühpunkte an Waffen-Kernen (Bloom) und
// Leuchtschweif bei schnellen Waffenschwüngen. Alles hängt am Rig (rig.postAnimate wird vom Animator gerufen).
import * as THREE from 'three';

const AURA_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const AURA_FS = /* glsl */`
  uniform vec3 uCol; uniform float uTime; uniform float uK;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv * 2.0 - 1.0; float r = length(p);
    float ring = exp(-pow((r - 0.78) / 0.07, 2.0)) * (0.7 + 0.3 * sin(atan(p.y, p.x) * 6.0 + uTime * 1.6));
    float inner = smoothstep(1.0, 0.0, r) * 0.22;
    float runes = step(0.5, fract(atan(p.y, p.x) * 3.8197 + uTime * 0.08)) * exp(-pow((r - 0.9) / 0.025, 2.0)) * 0.6;
    float a = (ring + inner + runes) * uK * smoothstep(1.0, 0.94, r);
    gl_FragColor = vec4(uCol * a, a);
  }`;

let glowTex = null;
function radialTexture() {
  if (glowTex) return glowTex;
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, r = Math.hypot(dx, dy);
    const v = Math.max(0, 1 - r); const a = Math.pow(v, 2.2);
    const i = (y * n + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
  }
  glowTex = new THREE.DataTexture(d, n, n); glowTex.needsUpdate = true;
  return glowTex;
}

/**
 * info: { glow (Farbe), cores: [{ joint, p: [x,y,z] (Ruhe-Modellraum), size }], trails: [{ joint, a, b }] }
 */
export function attachHeroFx(rig, info, rest) {
  const col = new THREE.Color(info.glow || '#7fd8ff');
  const fx = { t: 0, objs: [] };
  // Bodenaura
  const auraMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col.clone().multiplyScalar(1.6) }, uTime: { value: 0 }, uK: { value: 0.55 } },
    vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), auraMat);
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.025; aura.renderOrder = 1; aura.name = 'heroAura';
  rig.root.add(aura); fx.objs.push(aura);
  // Glühpunkte (Sprites) an Waffenkernen
  const sprites = [];
  for (const c of info.cores || []) {
    const j = rig.joints[c.joint]; if (!j) continue;
    const m = new THREE.SpriteMaterial({ map: radialTexture(), color: col.clone().multiplyScalar(c.k ?? 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const sp = new THREE.Sprite(m);
    const r = rest[c.joint];
    sp.position.set(c.p[0] - r.x, c.p[1] - r.y, c.p[2] - r.z);
    sp.scale.setScalar(c.size ?? 0.16);
    sp.userData.base = c.size ?? 0.16;
    j.add(sp); sprites.push(sp); fx.objs.push(sp);
  }
  // Waffenschweif: Band aus den letzten N Stellungen (Basis/Spitze) im Rig-Raum
  const N = 14;
  const trails = [];
  for (const tr of info.trails || []) {
    const j = rig.joints[tr.joint]; if (!j) continue;
    const r = rest[tr.joint];
    const la = new THREE.Vector3(tr.a[0] - r.x, tr.a[1] - r.y, tr.a[2] - r.z), lb = new THREE.Vector3(tr.b[0] - r.x, tr.b[1] - r.y, tr.b[2] - r.z);
    const pos = new Float32Array(N * 2 * 3), alpha = new Float32Array(N * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: col.clone().multiplyScalar(2.4) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.name = 'weaponTrail';
    rig.root.add(mesh); fx.objs.push(mesh);
    trails.push({ j, la, lb, mesh, pos, alpha, hist: [], energy: 0, last: null });
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _inv = new THREE.Matrix4();
  rig.postAnimate = (dt, gk = 1) => {
    fx.t += dt;
    auraMat.uniforms.uTime.value = fx.t;
    auraMat.uniforms.uK.value = 0.4 + 0.25 * Math.min(2, gk - 1 + 0.5);
    for (const sp of sprites) sp.scale.setScalar(sp.userData.base * (0.85 + 0.15 * Math.sin(fx.t * 3.1)) * Math.min(2.2, gk));
    if (!trails.length) return;
    _inv.copy(rig.root.matrixWorld).invert();
    for (const T of trails) {
      _a.copy(T.la).applyMatrix4(T.j.matrixWorld).applyMatrix4(_inv);
      _b.copy(T.lb).applyMatrix4(T.j.matrixWorld).applyMatrix4(_inv);
      const sp = T.last ? _b.distanceTo(T.last) / Math.max(dt, 1e-3) : 0;
      T.last = (T.last || new THREE.Vector3()).copy(_b);
      T.energy += ((sp > 3.2 ? 1 : 0) - T.energy) * (1 - Math.exp(-(sp > 3.2 ? 18 : 5) * dt));
      T.hist.unshift([_a.x, _a.y, _a.z, _b.x, _b.y, _b.z]);
      if (T.hist.length > N) T.hist.length = N;
      for (let i = 0; i < N; i++) {
        const h = T.hist[Math.min(i, T.hist.length - 1)];
        T.pos.set(h, i * 6);
        const f = (1 - i / (N - 1)) * T.energy;
        T.alpha[i * 2] = f * 0.15; T.alpha[i * 2 + 1] = f * 0.75;
      }
      T.mesh.geometry.attributes.position.needsUpdate = true;
      T.mesh.geometry.attributes.alpha.needsUpdate = true;
      T.mesh.visible = T.energy > 0.01;
    }
  };
  rig.fx = fx;
  return fx;
}
