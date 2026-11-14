// Aetherfront – 3D-Welt: Schwebeinseln zur goldenen Stunde über einem leuchtenden Wolkenmeer.
// Alles prozedural (keine externen Dateien). API:
//   createEnvironment({ scene, renderer, quality }) -> { update(dt, t), sun, setQuality(q), dispose() }
// Hinweis: Kamera-far sollte ≥ 2000 sein (Hintergrund-Inseln/Wolkenmeer werden sonst an der far-Ebene geklemmt).
import * as THREE from 'three';
import { createSharedUniforms } from './env/shaders.js';
import { createSky } from './env/sky.js';
import { createCloudSea } from './env/clouds.js';
import { createCloudNoise } from './env/textures.js';
import { buildWorld, MAX_GRASS, MAX_FLOWERS } from './env/world.js';

const QUALITY = {
  low: { shadow: 1024, grass: 0.22, flowers: 0.3, particles: 0.25, cloudSteps: 10 },
  medium: { shadow: 2048, grass: 0.5, flowers: 0.6, particles: 0.5, cloudSteps: 16 },
  high: { shadow: 4096, grass: 0.8, flowers: 1.0, particles: 0.8, cloudSteps: 22 },
  ultra: { shadow: 4096, grass: 1.0, flowers: 1.0, particles: 1.0, cloudSteps: 30 },
};

// Spielfläche, die der Sonnenschatten abdecken muss (inkl. Höhe der Requisiten)
const SHADOW_BOX = new THREE.Box3(new THREE.Vector3(-135, -8, -50), new THREE.Vector3(135, 42, 74));

export function createEnvironment({ scene, renderer, quality = 'high' } = {}) {
  const U = createSharedUniforms();
  const disposables = [];
  const prev = { background: scene.background, fog: scene.fog, environment: scene.environment, envInt: scene.environmentIntensity };

  // Richtung: sichtbare Sonne tief im Nordosten, Licht etwas steiler (lesbare Schatten auf den Bahnen)
  const az = new THREE.Vector2(0.72, -0.69).normalize();
  const sunElev = THREE.MathUtils.degToRad(9);
  const lightElev = THREE.MathUtils.degToRad(40);
  U.uSunDir.value.set(az.x * Math.cos(sunElev), Math.sin(sunElev), az.y * Math.cos(sunElev)).normalize();
  U.uLightDir.value.set(az.x * Math.cos(lightElev), Math.sin(lightElev), az.y * Math.cos(lightElev)).normalize();

  // ---------- Himmel, Nebel, Umgebungslicht ----------
  scene.background = new THREE.Color(0x2a1d3d);
  scene.fog = new THREE.FogExp2(0x9a6a86, U.uFogDensity.value);
  const sky = createSky(U);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = createSky(U, { forEnv: true });
  envScene.add(envSky);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = envRT.texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.38;
  envSky.geometry.dispose(); envSky.material.dispose();
  pmrem.dispose();

  // ---------- Licht ----------
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.74, 0.48), 4.3);
  sun.name = 'aeth-sun';
  const target = new THREE.Vector3(0, 0, 12);
  sun.position.copy(target).addScaledVector(U.uLightDir.value, 260);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 2.5;
  fitShadowCamera(sun, SHADOW_BOX);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(new THREE.Color(0.50, 0.50, 0.95), new THREE.Color(0.40, 0.24, 0.24), 0.42);
  hemi.name = 'aeth-hemi';
  scene.add(hemi);
  // kühles Gegenlicht für die Schattenseiten
  const rim = new THREE.DirectionalLight(new THREE.Color(0.45, 0.5, 1.0), 0.55);
  rim.position.set(-az.x * 100, 60, -az.y * 100);
  rim.name = 'aeth-rim';
  scene.add(rim);

  // ---------- Wolkenmeer ----------
  const cloudNoise = createCloudNoise(256);
  disposables.push(cloudNoise);
  const clouds = createCloudSea(U, cloudNoise, QUALITY[quality]?.cloudSteps ?? 22);
  scene.add(clouds);

  // ---------- Welt ----------
  const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 8;
  const world = buildWorld(U, { anisotropy: Math.min(8, maxAniso) });
  scene.add(world.root);

  let current = null;
  function setQuality(q) {
    const Q = QUALITY[q] || QUALITY.high;
    current = q in QUALITY ? q : 'high';
    if (sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    sun.shadow.radius = Q.shadow >= 4096 ? 3 : 2;
    world.grass.count = Math.floor(Math.min(world.grass.instanceMatrix.count, MAX_GRASS) * Q.grass);
    world.flowers.count = Math.floor(Math.min(world.flowers.instanceMatrix.count, MAX_FLOWERS) * Q.flowers);
    world.particles.setFraction(Q.particles);
    if (clouds.material.defines.STEPS !== Q.cloudSteps) {
      clouds.material.defines.STEPS = Q.cloudSteps;
      clouds.material.needsUpdate = true;
    }
  }
  setQuality(quality);
  renderer.shadowMap.enabled = true;

  // ---------- Animation ----------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  function update(dt, t) {
    U.uTime.value = t;
    const A = world.animated;
    if (A.spire) {
      A.spire.position.y = 21 + Math.sin(t * 0.5) * 0.8;
      A.spire.rotation.y = t * 0.12;
    }
    for (const r of A.rings) r.mesh.rotation.y = t * r.speed;
    if (A.floatRocks) {
      const { mesh, list } = A.floatRocks;
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        e.set(Math.sin(t * 0.2 + r.ph) * 0.06, r.rot + t * 0.03 * (i % 2 ? 1 : -1), Math.cos(t * 0.17 + r.ph) * 0.06);
        q.setFromEuler(e);
        v.set(r.x, r.y + Math.sin(t * r.sp + r.ph) * 0.9, r.z);
        s.setScalar(r.s);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, 0);

  function dispose() {
    const textures = new Set(disposables);
    const collect = (mat) => {
      for (const k of Object.keys(mat)) { const val = mat[k]; if (val && val.isTexture) textures.add(val); }
      if (mat.uniforms) for (const u of Object.values(mat.uniforms)) if (u && u.value && u.value.isTexture) textures.add(u.value);
      mat.dispose();
    };
    for (const obj of [world.root, sky, clouds]) {
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(collect);
        if (o.isInstancedMesh) o.dispose();
      });
      obj.removeFromParent();
    }
    for (const tx of textures) tx.dispose();
    scene.remove(sun, sun.target, hemi, rim);
    sun.shadow.map?.dispose();
    sun.dispose?.(); hemi.dispose?.(); rim.dispose?.();
    envRT.dispose();
    if (scene.environment === envRT.texture) scene.environment = prev.environment ?? null;
    scene.background = prev.background ?? null;
    scene.fog = prev.fog ?? null;
    if ('environmentIntensity' in scene) scene.environmentIntensity = prev.envInt ?? 1;
  }

  return { update, sun, setQuality, dispose, get quality() { return current; } };
}

function fitShadowCamera(light, box) {
  const cam = light.shadow.camera;
  const view = new THREE.Matrix4().lookAt(light.position, light.target.position, new THREE.Vector3(0, 1, 0));
  const inv = view.clone().invert();
  const pts = [];
  for (let i = 0; i < 8; i++) {
    pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  }
  const lb = new THREE.Box3();
  for (const p of pts) lb.expandByPoint(p.clone().sub(light.position).applyMatrix4(inv));
  cam.left = lb.min.x - 2; cam.right = lb.max.x + 2;
  cam.bottom = lb.min.y - 2; cam.top = lb.max.y + 2;
  cam.near = Math.max(1, -lb.max.z - 20); cam.far = -lb.min.z + 20;
  cam.updateProjectionMatrix();
}
