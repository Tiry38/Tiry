// Arena (nach Welle 10 und 20): schwebende Kampfinsel zwischen den Teams, nördlich der Mittelinsel.
// Prozedural: Felssockel, Steinboden, leuchtende Ringe mit sanft wanderndem Farbverlauf, Säulenkreis mit Kristallen,
// Lichtvorhang, solange die Arena läuft. API: createArena(scene) -> { update(dt, t), setActive(on), dispose() }
import * as THREE from 'three';
import { ARENA } from '../sim/layout.js';

const R = ARENA.r + 1.5;

function rand(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createArena(scene) {
  const root = new THREE.Group();
  root.name = 'aeth-arena';
  root.position.set(ARENA.x, 0, ARENA.z);
  scene.add(root);
  const rnd = rand(1717);
  const U = { uTime: { value: 0 }, uActive: { value: 0 } };

  // ---------- Felssockel (zum Wolkenmeer hin spitz zulaufend) ----------
  const prof = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = R * (1 - Math.pow(t, 0.75)) + 0.6 * (1 - t);
    prof.push(new THREE.Vector2(Math.max(0.3, r), -0.6 - t * 26));
  }
  const rock = new THREE.LatheGeometry(prof, 48);
  {
    const p = rock.attributes.position, col = [];
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = Math.sin(a * 7 + y * 0.4) * 0.6 + Math.sin(a * 13 - y * 0.9) * 0.35;
      const k = 1 + (n * 0.06) * Math.min(1, -y / 4);
      p.setX(i, x * k); p.setZ(i, z * k);
      const v = Math.min(1, -y / 26);
      c.setRGB(0.36 - v * 0.14, 0.33 - v * 0.13, 0.36 - v * 0.08);
      col.push(c.r, c.g, c.b);
    }
    rock.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    rock.computeVertexNormals();
  }
  const rockMesh = new THREE.Mesh(rock, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  rockMesh.receiveShadow = true;
  root.add(rockMesh);

  // ---------- Steinboden mit Kante ----------
  const floor = new THREE.CylinderGeometry(R, R, 0.7, 72, 1);
  floor.translate(0, -0.4, 0);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3d4150, roughness: 0.85, metalness: 0.08 });
  const floorMesh = new THREE.Mesh(floor, floorMat);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // ---------- Leuchtendes Bodenmuster (Ringe, Teamhälften, Farbverlauf) ----------
  const decoMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uR: { value: R } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime, uActive, uR; varying vec2 vP;
      vec3 grad(float t){ t = fract(t); vec3 a = vec3(0.48,0.36,1.0), b = vec3(1.0,0.31,0.64), c = vec3(0.44,0.89,1.0);
        return t < 0.333 ? mix(a,b,t*3.0) : t < 0.666 ? mix(b,c,(t-0.333)*3.0) : mix(c,a,(t-0.666)*3.0); }
      void main(){
        float r = length(vP) / uR; float ang = atan(vP.y, vP.x);
        float rings = 0.0;
        rings += smoothstep(0.012, 0.0, abs(r - 0.96)) * 1.2;
        rings += smoothstep(0.008, 0.0, abs(r - 0.70)) * 0.7;
        rings += smoothstep(0.006, 0.0, abs(r - 0.34)) * 0.8;
        rings += smoothstep(0.05, 0.0, r) * 0.9;
        float spokes = smoothstep(0.02, 0.0, abs(sin(ang * 6.0)) * r) * step(0.34, r) * step(r, 0.96) * 0.35;
        float mid = smoothstep(0.012, 0.0, abs(vP.x) / uR) * step(r, 0.96) * 0.6;
        vec3 col = grad(ang / 6.2832 + uTime * 0.04 + r * 0.25);
        vec3 side = vP.x < 0.0 ? vec3(0.35,0.64,1.0) : vec3(1.0,0.36,0.44);
        float halfGlow = smoothstep(0.96, 0.4, r) * 0.05 * (0.4 + uActive);
        float a = (rings + spokes + mid) * (0.45 + 0.75 * uActive) * step(r, 1.0);
        gl_FragColor = vec4(col * a + side * halfGlow, 1.0);
      }`,
  });
  const deco = new THREE.Mesh(new THREE.CircleGeometry(R, 96), decoMat);
  deco.rotation.x = -Math.PI / 2;
  deco.position.y = 0.0;
  deco.renderOrder = 2;
  root.add(deco);

  // ---------- Randring mit wanderndem Verlauf ----------
  const rimMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime, uActive; varying vec2 vUv;
      void main(){ float t = fract(vUv.x * 2.0 + uTime * 0.05);
        vec3 a = vec3(0.48,0.36,1.0), b = vec3(1.0,0.31,0.64), c = vec3(0.44,0.89,1.0);
        vec3 col = t < 0.333 ? mix(a,b,t*3.0) : t < 0.666 ? mix(b,c,(t-0.333)*3.0) : mix(c,a,(t-0.666)*3.0);
        gl_FragColor = vec4(col * (1.4 + 1.8 * uActive), 1.0); }`,
  });
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.28, 8, 128), rimMat);
  rimRing.rotation.x = -Math.PI / 2;
  rimRing.position.y = 0.02;
  root.add(rimRing);

  // ---------- Säulenkreis mit schwebenden Kristallen ----------
  const pillarGeo = new THREE.CylinderGeometry(0.55, 0.75, 5.2, 10);
  pillarGeo.translate(0, 2.2, 0);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a8678, roughness: 0.8 });
  const crystalGeo = new THREE.OctahedronGeometry(0.75, 0);
  crystalGeo.scale(1, 1.7, 1);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x241a40, emissive: new THREE.Color(0xc86aff), emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.1 });
  const N = 12;
  const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, N);
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, N);
  pillars.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  const spots = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.PI / N;
    if (Math.abs(Math.cos(a)) > 0.97) continue; // Lücke Richtung der Teams
    const x = Math.cos(a) * (R + 0.8), z = Math.sin(a) * (R + 0.8);
    const hgt = 0.75 + rnd() * 0.45;
    e.set((rnd() - 0.5) * 0.06, rnd() * 6, (rnd() - 0.5) * 0.06);
    m.compose(v.set(x, -0.4, z), q.setFromEuler(e), s.set(1, hgt, 1));
    pillars.setMatrixAt(spots.length, m);
    spots.push({ x, z, y: -0.4 + 5.2 * hgt + 1.2, ph: rnd() * 6.28 });
  }
  pillars.count = spots.length;
  crystals.count = spots.length;
  root.add(pillars, crystals);

  // ---------- Lichtvorhang (nur während der Arena) ----------
  const curtainMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime, uActive; varying vec2 vUv;
      void main(){ float t = fract(vUv.x * 3.0 - uTime * 0.06);
        vec3 a = vec3(0.48,0.36,1.0), b = vec3(1.0,0.31,0.64), c = vec3(0.44,0.89,1.0);
        vec3 col = t < 0.333 ? mix(a,b,t*3.0) : t < 0.666 ? mix(b,c,(t-0.333)*3.0) : mix(c,a,(t-0.666)*3.0);
        float f = pow(1.0 - vUv.y, 2.2) * (0.55 + 0.45 * sin(vUv.x * 62.83 + uTime * 1.5));
        gl_FragColor = vec4(col * f * 0.55 * uActive, 1.0); }`,
  });
  const curtain = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 7, 96, 1, true), curtainMat);
  curtain.position.y = 3.5;
  curtain.visible = false;
  root.add(curtain);

  let target = 0;
  function setActive(on) { target = on ? 1 : 0; }
  function update(dt, t) {
    U.uTime.value = t;
    const a = U.uActive.value + (target - U.uActive.value) * (1 - Math.exp(-dt * 3));
    U.uActive.value = a;
    curtain.visible = a > 0.02;
    crystalMat.emissiveIntensity = 1.4 + a * 2.2;
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      e.set(0, t * 0.6 + p.ph, 0);
      m.compose(v.set(p.x, p.y + Math.sin(t * 1.2 + p.ph) * 0.25, p.z), q.setFromEuler(e), s.setScalar(1));
      crystals.setMatrixAt(i, m);
    }
    crystals.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);

  function dispose() {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    root.removeFromParent();
  }
  return { root, update, setActive, dispose };
}
