// Aetherfront – 3D-Welt: Schwebeinseln über einem sonnenbeschienenen Wolkenmeer.
// Echte CC0-Assets (PBR-Texturen + HDRI, siehe asset-catalog.js) mit prozeduralem Rückfall. API:
//   createEnvironment({ scene, renderer, quality, assets, look, settings })
//     -> { update(dt, t), sun, setQuality(q), setBiome(id), biome, dispose() }
//   loadEnvironmentAssets(renderer) (re-exportiert) lädt die Assets vorab (async).
// Biome (Art Bible, docs/ART-BIBLE.md): 'sky' (Akt 1 Himmelsinseln), 'wild' (Akt 2 Wildwald),
//   'forge' (Akt 3 Eisen-/Wüstenschmiede), 'abyss' (Akt 4 Abgrund/Schattenwelt).
// Hinweis: Kamera-far sollte ≥ 2000 sein (Hintergrund-Inseln/Wolkenmeer werden sonst an der far-Ebene geklemmt).
import * as THREE from 'three';
import { createSharedUniforms } from './env/shaders.js';
import { createSky, createSkyUniforms } from './env/sky.js';
import { createCloudSea } from './env/clouds.js';
import { createCloudNoise } from './env/textures.js';
import { buildWorld } from './env/world.js';
import { loadEnvironmentAssets, disposeAssets } from './assets.js';

export { loadEnvironmentAssets };

const QUALITY = {
  low: { shadow: 1024, grass: 0.3, flowers: 0.3, particles: 0.25, cloudSteps: 10, grassFar: 85 },
  medium: { shadow: 2048, grass: 0.5, flowers: 0.6, particles: 0.5, cloudSteps: 16, grassFar: 120 },
  high: { shadow: 2048, grass: 0.7, flowers: 0.8, particles: 0.8, cloudSteps: 20, grassFar: 150 },
  ultra: { shadow: 4096, grass: 1.0, flowers: 1.0, particles: 1.0, cloudSteps: 30, grassFar: 260 },
};

// ---------- Biome (Licht, Himmel, Nebel, Grading, Vegetations-Tönung) ----------
// Farben linear. look-Werte gehen 1:1 in engine.look (Grading-Pass).
export const BIOMES = {
  sky: {
    name: 'Himmelsinseln', act: 1, hdri: 'sky_day', azimuth: [0.72, -0.69], sunElev: 10, lightElev: 40,
    sunColor: [1.0, 0.87, 0.70], sunIntensity: 3.5, skyTarget: 0.46, hdriTint: [1.0, 1.0, 1.02], hdriSat: 1.05, warmHorizon: 1.0,
    fog: 0.00125, heightFog: 1.0, haze: [1.0, 1.0, 1.0],
    cloudLit: [1.12, 1.10, 1.08], cloudShade: [0.16, 0.24, 0.40],
    foliage: [1.0, 1.0, 1.0], ground: [1.0, 1.0, 1.0], rock: [1.0, 1.0, 1.0],
    hemiSky: [0.50, 0.66, 1.0], hemiGround: [0.30, 0.25, 0.17], hemi: 0.26, rim: 0.26, envIntensity: 0.6,
    proc: { zen: [0.030, 0.095, 0.34], mid: [0.070, 0.200, 0.56], horA: [0.30, 0.46, 0.74], horS: [0.95, 0.72, 0.50], glow: [1.0, 0.72, 0.42] },
    look: { exposure: 1.0, temperature: 0.1, tint: 0.0, saturation: 1.1, contrast: 1.1, bloom: 0.3, bloomThreshold: 2.4, rays: 0.5,
      shadowTint: [-0.012, 0.0, 0.02], highTint: [0.018, 0.006, -0.016], vignette: 0.2 },
  },
  wild: {
    name: 'Wildwald', act: 2, hdri: 'sky_golden', azimuth: [0.62, -0.78], sunElev: 6, lightElev: 30,
    sunColor: [1.0, 0.72, 0.46], sunIntensity: 3.3, skyTarget: 0.42, hdriTint: [1.02, 0.98, 0.94], hdriSat: 1.1, warmHorizon: 1.15,
    fog: 0.0016, heightFog: 1.25, haze: [0.92, 1.0, 0.95],
    cloudLit: [1.2, 1.0, 0.82], cloudShade: [0.14, 0.2, 0.26],
    foliage: [0.82, 1.08, 0.86], ground: [0.85, 1.02, 0.85], rock: [0.92, 0.98, 0.92],
    hemiSky: [0.46, 0.62, 0.78], hemiGround: [0.22, 0.26, 0.14], hemi: 0.3, rim: 0.3, envIntensity: 0.55,
    proc: { zen: [0.03, 0.08, 0.26], mid: [0.08, 0.18, 0.42], horA: [0.32, 0.42, 0.56], horS: [1.1, 0.7, 0.4], glow: [1.0, 0.62, 0.32] },
    look: { exposure: 0.98, temperature: 0.22, tint: -0.05, saturation: 1.16, contrast: 1.12, bloom: 0.34, bloomThreshold: 2.2, rays: 0.65,
      shadowTint: [-0.02, 0.004, 0.012], highTint: [0.022, 0.01, -0.02], vignette: 0.24 },
  },
  forge: {
    name: 'Eisen- & Wüstenschmiede', act: 3, hdri: 'sky_haze', azimuth: [0.8, -0.6], sunElev: 14, lightElev: 34,
    sunColor: [1.0, 0.66, 0.40], sunIntensity: 3.8, skyTarget: 0.5, hdriTint: [1.18, 0.86, 0.6], hdriSat: 0.9, warmHorizon: 1.35,
    fog: 0.0019, heightFog: 1.1, haze: [1.12, 0.92, 0.74],
    cloudLit: [1.3, 0.98, 0.72], cloudShade: [0.26, 0.17, 0.14],
    foliage: [1.25, 0.92, 0.55], ground: [1.25, 0.98, 0.7], rock: [1.12, 0.9, 0.76],
    hemiSky: [0.8, 0.6, 0.45], hemiGround: [0.35, 0.22, 0.12], hemi: 0.3, rim: 0.22, envIntensity: 0.55,
    proc: { zen: [0.06, 0.07, 0.16], mid: [0.18, 0.16, 0.22], horA: [0.62, 0.46, 0.34], horS: [1.25, 0.72, 0.36], glow: [1.0, 0.55, 0.25] },
    look: { exposure: 1.02, temperature: 0.42, tint: 0.04, saturation: 0.98, contrast: 1.16, bloom: 0.38, bloomThreshold: 2.0, rays: 0.7,
      shadowTint: [-0.006, -0.004, 0.02], highTint: [0.03, 0.01, -0.03], vignette: 0.26 },
  },
  abyss: {
    name: 'Abgrund / Schattenwelt', act: 4, hdri: 'sky_haze', azimuth: [-0.3, -0.95], sunElev: 8, lightElev: 32,
    sunColor: [0.72, 0.62, 1.0], sunIntensity: 2.6, skyTarget: 0.22, hdriTint: [0.62, 0.42, 1.0], hdriSat: 0.55, warmHorizon: 0.6,
    fog: 0.0021, heightFog: 1.5, haze: [0.7, 0.55, 1.05],
    cloudLit: [0.6, 0.48, 0.85], cloudShade: [0.06, 0.04, 0.12],
    foliage: [0.62, 0.66, 0.95], ground: [0.66, 0.62, 0.85], rock: [0.78, 0.72, 0.95],
    hemiSky: [0.45, 0.36, 0.85], hemiGround: [0.12, 0.08, 0.16], hemi: 0.34, rim: 0.4, envIntensity: 0.5,
    proc: { zen: [0.01, 0.008, 0.04], mid: [0.04, 0.025, 0.1], horA: [0.18, 0.12, 0.32], horS: [0.42, 0.24, 0.55], glow: [0.7, 0.4, 1.0] },
    look: { exposure: 0.95, temperature: -0.3, tint: 0.28, saturation: 0.92, contrast: 1.2, bloom: 0.48, bloomThreshold: 1.8, rays: 0.55,
      shadowTint: [0.0, -0.01, 0.03], highTint: [0.012, -0.004, 0.02], vignette: 0.3 },
  },
};

// Spielfläche, die der Sonnenschatten abdecken muss (inkl. Höhe der Requisiten)
const SHADOW_BOX = new THREE.Box3(new THREE.Vector3(-135, -8, -50), new THREE.Vector3(135, 42, 74));

export function createEnvironment({ scene, renderer, quality = 'high', assets = null, look = null, settings = null } = {}) {
  const U = createSharedUniforms();
  const S = createSkyUniforms();
  const disposables = [];
  const prev = { background: scene.background, fog: scene.fog, environment: scene.environment, envInt: scene.environmentIntensity };

  // ---------- Himmel, Nebel ----------
  scene.background = new THREE.Color(0x3a5a8c);
  scene.fog = new THREE.FogExp2(0x7d95b8, U.uFogDensity.value);
  const sky = createSky(U, S);
  scene.add(sky);
  scene.userData.aethSunDir = U.uSunDir.value;

  // ---------- Licht ----------
  const sun = new THREE.DirectionalLight(U.uSunColor.value.clone(), 3.6);
  sun.name = 'aeth-sun';
  const target = new THREE.Vector3(0, 0, 12);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.48, 0.64, 1.0), new THREE.Color(0.30, 0.25, 0.17), 0.3);
  hemi.name = 'aeth-hemi';
  scene.add(hemi);
  const rim = new THREE.DirectionalLight(new THREE.Color(0.50, 0.62, 1.0), 0.28);
  rim.name = 'aeth-rim';
  scene.add(rim);

  // Schattenkamera pro Bild an den sichtbaren Ausschnitt anpassen (scharfe Schatten in der Nähe)
  let shadowSize = 2048;
  let fitter = null;
  scene.userData.aethPreRender = (camera) => fitter && fitter(camera, shadowSize);

  // ---------- Wolkenmeer ----------
  const cloudNoise = createCloudNoise(256);
  disposables.push(cloudNoise);
  const clouds = createCloudSea(U, cloudNoise, QUALITY[quality]?.cloudSteps ?? 20);
  scene.add(clouds);

  // ---------- Welt ----------
  const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 8;
  const world = buildWorld(U, { anisotropy: Math.min(8, maxAniso), assets });
  scene.add(world.root);

  // ---------- Umgebungslicht (PMREM aus dem Himmel inkl. HDRI) ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = createSky(U, S, { forEnv: true });
  envScene.add(envSky);
  let envRT = null;
  const captureEnv = () => {
    const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = envRT.texture;
  };

  // ---------- Biom ----------
  let biome = null;
  const tmpC = new THREE.Color();
  function setBiome(id) {
    const B = BIOMES[id] || BIOMES.sky;
    biome = BIOMES[id] ? id : 'sky';
    const H = assets?.hdri?.[B.hdri] || assets?.hdri?.sky_day || null;
    const az = new THREE.Vector2(B.azimuth[0], B.azimuth[1]).normalize();
    const sunElev = THREE.MathUtils.degToRad(H ? Math.max(3, THREE.MathUtils.radToDeg(Math.asin(H.sunDir.y))) : B.sunElev);
    const lightElev = THREE.MathUtils.degToRad(B.lightElev);
    U.uSunDir.value.set(az.x * Math.cos(sunElev), Math.sin(sunElev), az.y * Math.cos(sunElev)).normalize();
    U.uLightDir.value.set(az.x * Math.cos(lightElev), Math.sin(lightElev), az.y * Math.cos(lightElev)).normalize();
    U.uSunColor.value.setRGB(...B.sunColor);
    U.uFogDensity.value = B.fog;
    U.uHeightFog.value = B.heightFog;
    U.uHazeTint.value.setRGB(...B.haze);
    U.uCloudLit.value.setRGB(...B.cloudLit);
    U.uCloudShade.value.setRGB(...B.cloudShade);
    U.uFoliageTint.value.setRGB(...B.foliage);
    U.uGroundTint.value.setRGB(...B.ground);
    U.uRockTint.value.setRGB(...B.rock);
    U.uSunGlow.value.setRGB(...B.proc.glow);
    if (H) {
      // Himmelsfarben aus dem HDRI messen und auf die Biom-Helligkeit normieren
      const st = H.stats;
      const lum = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
      const scale = B.skyTarget / Math.max(1e-3, lum(st.horizonAway));
      const tint = new THREE.Color(...B.hdriTint);
      const grade = (src, dst, extra = 1) => {
        tmpC.copy(src).multiplyScalar(scale * extra).multiply(tint);
        const l = lum(tmpC);
        dst.setRGB(l + (tmpC.r - l) * B.hdriSat, l + (tmpC.g - l) * B.hdriSat, l + (tmpC.b - l) * B.hdriSat);
      };
      grade(st.zenith, U.uSkyZen.value);
      grade(st.mid, U.uSkyMid.value);
      grade(st.horizonAway, U.uSkyHorA.value);
      grade(st.horizonSun, U.uSkyHorS.value, B.warmHorizon);
      S.uHdri.value = H.texture;
      S.uHasHdri.value = 1;
      S.uHdriScale.value = scale;
      S.uHdriTint.value.copy(tint);
      S.uHdriSat.value = B.hdriSat;
      S.uHdriRot.value = H.sunAz - Math.atan2(U.uSunDir.value.z, U.uSunDir.value.x);
      S.uSunDisc.value = 1;
    } else {
      U.uSkyZen.value.setRGB(...B.proc.zen);
      U.uSkyMid.value.setRGB(...B.proc.mid);
      U.uSkyHorA.value.setRGB(...B.proc.horA);
      U.uSkyHorS.value.setRGB(...B.proc.horS);
      S.uHdri.value = null;
      S.uHasHdri.value = 0;
    }
    // Lichter
    sun.color.copy(U.uSunColor.value);
    sun.intensity = B.sunIntensity;
    sun.position.copy(target).addScaledVector(U.uLightDir.value, 260);
    sun.updateMatrixWorld();
    fitShadowCamera(sun, SHADOW_BOX);
    fitter = createShadowFitter(sun, SHADOW_BOX);
    hemi.color.setRGB(...B.hemiSky);
    hemi.groundColor.setRGB(...B.hemiGround);
    hemi.intensity = B.hemi;
    rim.intensity = B.rim;
    rim.color.copy(U.uSkyHorA.value).multiplyScalar(1 / Math.max(0.05, Math.max(U.uSkyHorA.value.r, U.uSkyHorA.value.g, U.uSkyHorA.value.b)));
    rim.position.set(-az.x * 100, 70, -az.y * 100);
    scene.fog.color.copy(U.uSkyHorA.value).multiply(U.uHazeTint.value).multiplyScalar(0.8);
    scene.fog.density = B.fog;
    scene.background.copy(U.uSkyHorA.value);
    if ('environmentIntensity' in scene) scene.environmentIntensity = B.envIntensity;
    captureEnv();
    if (look) {
      for (const [k, v] of Object.entries(B.look)) look[k] = Array.isArray(v) ? v.slice() : v;
    }
    return biome;
  }

  let current = null;
  function setQuality(q) {
    const Q = QUALITY[q] || QUALITY.high;
    current = q in QUALITY ? q : 'high';
    shadowSize = Q.shadow;
    if (sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    world.grass.setFraction(Q.grass);
    world.flowers.setFraction(Q.flowers);
    world.particles.setFraction(Q.particles);
    U.uGrassFar.value = Q.grassFar;
    if (clouds.material.defines.STEPS !== Q.cloudSteps) {
      clouds.material.defines.STEPS = Q.cloudSteps;
      clouds.material.needsUpdate = true;
    }
  }
  setBiome('sky');
  setQuality(quality);
  renderer.shadowMap.enabled = true;
  const onSetting = (k, v) => { if (k === 'quality') setQuality(v); };
  if (settings && settings.onChange) settings.onChange(onSetting);

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
    disposeAssets(assets);
    scene.remove(sun, sun.target, hemi, rim);
    sun.shadow.map?.dispose();
    sun.dispose?.(); hemi.dispose?.(); rim.dispose?.();
    envSky.geometry.dispose(); envSky.material.dispose();
    pmrem.dispose();
    if (envRT) { if (scene.environment === envRT.texture) scene.environment = prev.environment ?? null; envRT.dispose(); }
    if (scene.userData.aethPreRender) delete scene.userData.aethPreRender;
    delete scene.userData.aethSunDir;
    scene.background = prev.background ?? null;
    scene.fog = prev.fog ?? null;
    if ('environmentIntensity' in scene) scene.environmentIntensity = prev.envInt ?? 1;
  }

  return {
    update, sun, setQuality, setBiome, dispose, uniforms: U,
    get quality() { return current; }, get biome() { return biome; }, get usesAssets() { return !!(assets && assets.count); },
  };
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
  let last = '';
  return (camera, mapSize) => {
    camera.updateMatrixWorld();
    o.copy(camera.position);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const reach = 260;
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
    const key = `${cx}|${cy}|${w}|${h}|${mapSize}`;
    if (key === last) return;
    last = key;
    cam.left = cx - w / 2; cam.right = cx + w / 2; cam.bottom = cy - h / 2; cam.top = cy + h / 2;
    cam.near = Math.max(1, -full.max.z - 20); cam.far = -full.min.z + 20;
    cam.updateProjectionMatrix();
    // Halbschatten etwa 6 cm in Welteinheiten, unabhängig von der Ausschnittgröße
    light.shadow.radius = THREE.MathUtils.clamp(0.06 / Math.max(tx, ty), 1.0, 3.0);
  };
}
