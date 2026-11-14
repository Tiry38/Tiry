// Aetherfront – 3D-Welt: Schwebeinseln am späten Nachmittag über einem sonnenbeschienenen Wolkenmeer.
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
  high: { shadow: 4096, grass: 0.85, flowers: 1.0, particles: 0.8, cloudSteps: 22 },
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
  const sunElev = THREE.MathUtils.degToRad(10);
  const lightElev = THREE.MathUtils.degToRad(37);
  U.uSunDir.value.set(az.x * Math.cos(sunElev), Math.sin(sunElev), az.y * Math.cos(sunElev)).normalize();
  U.uLightDir.value.set(az.x * Math.cos(lightElev), Math.sin(lightElev), az.y * Math.cos(lightElev)).normalize();

  // ---------- Himmel, Nebel, Umgebungslicht ----------
  scene.background = new THREE.Color(0x3a5a8c);
  scene.fog = new THREE.FogExp2(0x7d95b8, U.uFogDensity.value);
  const sky = createSky(U);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = createSky(U, { forEnv: true });
  envScene.add(envSky);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = envRT.texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.62;
  envSky.geometry.dispose(); envSky.material.dispose();
  pmrem.dispose();
  scene.userData.aethSunDir = U.uSunDir.value;

  // ---------- Licht ----------
  // Warmes Schlüssellicht (späte Nachmittagssonne), kühles Himmelslicht als Füllung.
  const sun = new THREE.DirectionalLight(U.uSunColor.value.clone(), 3.4);
  sun.name = 'aeth-sun';
  const target = new THREE.Vector3(0, 0, 12);
  sun.position.copy(target).addScaledVector(U.uLightDir.value, 260);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;
  fitShadowCamera(sun, SHADOW_BOX);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(new THREE.Color(0.52, 0.66, 1.0), new THREE.Color(0.30, 0.25, 0.17), 0.55);
  hemi.name = 'aeth-hemi';
  scene.add(hemi);
  // kühles Gegenlicht (Himmel gegenüber der Sonne) für die Schattenseiten
  const rim = new THREE.DirectionalLight(new THREE.Color(0.50, 0.62, 1.0), 0.35);
  rim.position.set(-az.x * 100, 70, -az.y * 100);
  rim.name = 'aeth-rim';
  scene.add(rim);

  // Schattenkamera pro Bild an den sichtbaren Ausschnitt anpassen (scharfe Schatten in der Nähe)
  let shadowSize = 4096;
  const fitter = createShadowFitter(sun, SHADOW_BOX);
  scene.userData.aethPreRender = (camera) => fitter(camera, shadowSize);

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
    shadowSize = Q.shadow;
    if (sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
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
    if (scene.userData.aethPreRender) delete scene.userData.aethPreRender;
    delete scene.userData.aethSunDir;
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

/**
 * Passt das orthografische Schattenvolumen an den Bodenausschnitt der Kamera an (mit Rand),
 * begrenzt auf die Spielfläche; Ausdehnung/Position auf Texel gerastert (kein Flimmern).
 */
function createShadowFitter(light, box) {
  const cam = light.shadow.camera;
  const view = new THREE.Matrix4().lookAt(light.position, light.target.position, new THREE.Vector3(0, 1, 0));
  const inv = view.clone().invert();
  // Tiefenbereich immer über die ganze Spielfläche (Schattenwerfer außerhalb des Bildes bleiben erhalten)
  const full = new THREE.Box3();
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    full.expandByPoint(p.sub(light.position).applyMatrix4(inv));
  }
  const ndc = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];
  const o = new THREE.Vector3(), dir = new THREE.Vector3(), p = new THREE.Vector3(), lp = new THREE.Vector3();
  const pts = [];
  let last = '';
  return (camera, mapSize) => {
    camera.updateMatrixWorld();
    o.copy(camera.position);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const reach = 260;
    pts.length = 0;
    for (const [x, y] of ndc) {
      dir.set(x, y, 0.5).unproject(camera).sub(o).normalize();
      let t = dir.y < -1e-3 ? (0 - o.y) / dir.y : reach;
      t = Math.min(t, reach);
      p.copy(o).addScaledVector(dir, t);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const m = 8;
    minX = Math.max(box.min.x, minX - m); maxX = Math.min(box.max.x, maxX + m);
    minZ = Math.max(box.min.z, minZ - m); maxZ = Math.min(box.max.z, maxZ + m);
    if (minX >= maxX || minZ >= maxZ) { minX = box.min.x; maxX = box.max.x; minZ = box.min.z; maxZ = box.max.z; }
    const lb = new THREE.Box3();
    for (let i = 0; i < 8; i++) {
      lp.set(i & 1 ? maxX : minX, i & 2 ? 16 : -4, i & 4 ? maxZ : minZ).sub(light.position).applyMatrix4(inv);
      lb.expandByPoint(lp);
    }
    // Rastern: Größe in 4er-Schritten, Ursprung auf Texel
    let w = Math.max(30, lb.max.x - lb.min.x), h = Math.max(30, lb.max.y - lb.min.y);
    w = Math.ceil(w / 4) * 4; h = Math.ceil(h / 4) * 4;
    const tx = w / mapSize, ty = h / mapSize;
    const cx = Math.round((lb.min.x + lb.max.x) / 2 / tx) * tx, cy = Math.round((lb.min.y + lb.max.y) / 2 / ty) * ty;
    const key = `${cx}|${cy}|${w}|${h}`;
    if (key === last) return;
    last = key;
    cam.left = cx - w / 2; cam.right = cx + w / 2; cam.bottom = cy - h / 2; cam.top = cy + h / 2;
    cam.near = Math.max(1, -full.max.z - 20); cam.far = -full.min.z + 20;
    cam.updateProjectionMatrix();
    // Halbschatten etwa 6 cm in Welteinheiten, unabhängig von der Ausschnittgröße
    light.shadow.radius = THREE.MathUtils.clamp(0.06 / Math.max(tx, ty), 1.0, 3.0);
  };
}
