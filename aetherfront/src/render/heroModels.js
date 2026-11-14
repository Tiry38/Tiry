// Aetherfront – Heldenmodelle (prozedural, AAA-Nahansicht für die Third-Person-Heldensteuerung).
// Jeder Held = ein Gelenk-Skelett aus THREE.Group (Füße auf y = 0, Blick nach +Z) + wenige SkinnedMeshes
// (Körper, doppelseitiger Stoff, HDR-Glühen für Bloom, Kristallglas). Gewichte weich über Gelenke → keine Nahtlücken.
//
//   buildHero(modelId, { palette, level }) → HeroRig
//   new HeroAnimator(rig).update(dt, state)
//
// HeroRig: { root, joints, height, radius, glowMaterials, bodyMaterials, setLevel(level), dispose(), style, rest }
// Glühen pulsieren: material.userData.pulse (Standard 1) setzen – der Animator multipliziert es ein.
import * as THREE from 'three';
import { HEROES } from '../sim/heroes.js';
import { makeSkeleton, HeroBuilder, createHeroMaterial, createHeroGlowMaterial, createHeroGlassMaterial } from './hero/rig.js';
import { HeroAnimator } from './hero/animator.js';
import * as kael from './hero/kael.js';
import * as lyra from './hero/lyra.js';
import * as varo from './hero/varo.js';
import * as selene from './hero/selene.js';
import * as mira from './hero/mira.js';
import * as brann from './hero/brann.js';

export { HeroAnimator };

const DESIGNS = {
  hero_kael: { mod: kael, style: 'knight' },
  hero_mira: { mod: mira, style: 'priest' },
  hero_lyra: { mod: lyra, style: 'ranger' },
  hero_selene: { mod: selene, style: 'mage' },
  hero_brann: { mod: brann, style: 'hammer' },
  hero_varo: { mod: varo, style: 'dual' },
};
export const HERO_MODEL_IDS = Object.keys(DESIGNS);

const tierOf = (lv) => (lv >= 9 ? 9 : lv >= 6 ? 6 : lv >= 3 ? 3 : 0);
const FALLBACK_PAL = { primary: '#aab3bf', secondary: '#3a6ee8', metal: '#c9a24a', glow: '#7fd8ff' };

export function buildHero(modelId, { palette, level = 1 } = {}) {
  const D = DESIGNS[modelId] || DESIGNS.hero_kael;
  const id = (DESIGNS[modelId] ? modelId : 'hero_kael').replace('hero_', '');
  const pal = { ...FALLBACK_PAL, ...(HEROES[id] && HEROES[id].palette), ...(palette || {}) };
  const skel = makeSkeleton(D.mod.proportions);
  const B = new HeroBuilder(skel);
  const info = D.mod.build(B, pal) || {};
  const { root, joints, skeleton, boneIndex, rest } = B.build();

  // Materialien (je Held eigene Instanzen → Treffer-Blitz/Glühen getrennt; Shader-Programm geteilt)
  const height0 = Math.max(1.2, skel.J.head.pos.y + 0.25 * skel.s);
  const body = createHeroMaterial({ height: height0 });
  const cloth = createHeroMaterial({ height: height0, side: THREE.DoubleSide });
  const glow = createHeroGlowMaterial();
  const glass = createHeroGlassMaterial();
  const mats = { body, cloth, glow, glass };
  const meshes = {};
  const ident = new THREE.Matrix4();

  const rig = {
    root, joints, rest, scale: skel.s, style: D.style, level: Math.max(1, level | 0),
    glowMaterials: [glow], bodyMaterials: [body, cloth], chains: info.chains || [], floaters: info.floaters || [],
    bowRest: info.bowRest || null, bowNock: info.bowNock || null, height: 1.8, radius: info.radius || 0.5 * skel.s, tier: -1,
    meshes, modelId,
  };
  // Stoff-/Federketten automatisch erkennen
  const has = (n) => !!joints[n];
  if (has('cape') && !rig.chains.some((c) => c.bones.includes('cape'))) rig.chains.push({ bones: ['cape', 'cape1', 'cape2', 'cape3'], gain: 1, legPush: 0.3, omega: 10, zeta: 0.4, min: info.capeMin ?? 0.05 });
  if (has('plume')) rig.chains.push({ bones: ['plume', 'plume1', 'plume2'], gain: 0.4, legPush: 0, gravity: 0.3, omega: 13, zeta: 0.3, breeze: 0.6, flutter: 0.6, deadX: 0 });
  if (has('skirtB')) rig.chains.push({ bones: ['skirtB'], gain: 0.7, legPush: 0.35, gravity: 0.3, omega: 9, zeta: 0.5, breeze: 0.5, flutter: 0.4, deadX: 0 });
  for (const extra of ['hair', 'scarf', 'scarfB', 'tail', 'sash']) if (has(extra)) {
    const bones = [extra]; let k = 1; while (has(extra + k)) bones.push(extra + k++);
    rig.chains.push({ bones, gain: 0.8, legPush: 0, gravity: 0.6, omega: 11, zeta: 0.35, breeze: 0.8, flutter: 1 });
  }

  // optionales warmes Licht (z.B. Laterne)
  rig.lights = [];
  if (info.light && joints[info.light.joint]) {
    const L = new THREE.PointLight(info.light.color, info.light.intensity, info.light.distance, 2);
    L.userData.base = info.light.intensity; L.castShadow = false;
    joints[info.light.joint].add(L); rig.lights.push(L);
  }
  rig.setLevel = (lv) => {
    rig.level = Math.max(1, lv | 0);
    const t = tierOf(rig.level);
    if (t === rig.tier) return;
    rig.tier = t;
    for (const layer of ['body', 'cloth', 'glow', 'glass']) {
      const g = B.geometryFor(layer, t, boneIndex);
      let m = meshes[layer];
      if (!g) { if (m) { m.visible = false; } continue; }
      if (!m) {
        m = new THREE.SkinnedMesh(g, mats[layer]);
        m.name = 'hero_' + layer;
        m.frustumCulled = false;
        m.castShadow = layer === 'body' || layer === 'cloth';
        m.receiveShadow = layer !== 'glow';
        if (layer === 'glass') m.renderOrder = 2;
        root.add(m);
        m.bind(skeleton, ident);
        meshes[layer] = m;
      } else {
        const old = m.geometry; m.geometry = g; old.dispose(); m.visible = true;
      }
    }
    const bb = new THREE.Box3();
    for (const m of Object.values(meshes)) if (m.visible) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); }
    rig.height = +bb.max.y.toFixed(3);
    let tris = 0; for (const m of Object.values(meshes)) if (m.visible) tris += m.geometry.attributes.position.count / 3;
    rig.triangles = tris;
  };
  rig.setLevel(rig.level);
  rig.dispose = () => {
    for (const m of Object.values(meshes)) { m.geometry.dispose(); m.removeFromParent(); }
    for (const m of Object.values(mats)) m.dispose();
    for (const L of rig.lights) { L.removeFromParent(); L.dispose && L.dispose(); }
    skeleton.dispose();
  };
  return rig;
}
