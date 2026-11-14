// Aether-Forge – Laufzeit-Lader: holt die vorgebackenen Figuren (web/assets/models/*.afm) beim Start im Hintergrund
// und baut daraus sofort fertige Helden-Rigs (SkinnedMesh + Skelett) bzw. Einheiten-Geometrien (Instanzen +
// Vertex-Animation). Fehlt eine Datei (oder läuft das Spiel unter file://), greifen die alten Modelle.
import * as THREE from 'three';
import { decodeAFM } from './format.js';
import { createForgeMaterial, createForgeGlowMaterial, createForgeGlassMaterial } from './materials.js';
import { attachHeroFx } from './fx.js';

const BASE = 'assets/models/';
const cache = new Map();      // id → { header, arrays }
let lodBias = 0;              // 0 = höchste Stufe (Kino/Ultra), 1 = mittel, 2 = niedrig
let ready = null;

export function setForgeLod(q) {
  lodBias = q === 'low' ? 1 : 0;
}
export function forgeLodBias() { return lodBias; }

function supported() {
  return typeof fetch === 'function' && typeof location !== 'undefined' && location.protocol !== 'file:';
}

/** Startet das Laden (einmalig). Liefert ein Promise, das nie fehlschlägt. */
export function preloadForge() {
  if (ready) return ready;
  if (!supported()) { ready = Promise.resolve(false); return ready; }
  ready = (async () => {
    try {
      const r = await fetch(BASE + 'index.json', { cache: 'no-cache' });
      if (!r.ok) return false;
      const idx = await r.json();
      const ids = [...(idx.heroes || []), ...(idx.units || [])];
      await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(BASE + id + '.afm');
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          cache.set(id, decodeAFM(buf));
        } catch (e) { console.warn('[Forge] Modell nicht geladen:', id, e); }
      }));
      return true;
    } catch { return false; }
  })();
  return ready;
}
export function forgeReady() { return preloadForge(); }
export function hasForge(id) { return cache.has(id); }
/** Für Tests/Werkzeuge: Datei direkt einspeisen */
export function registerForge(id, buffer) { cache.set(id, decodeAFM(buffer)); }

// ---------------------------------------------------------------------------------------------
// Geometrie aus den Puffern
// ---------------------------------------------------------------------------------------------
function lodGeometry(arrays, lod, o = {}) {
  const k = lod.key, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arrays[k + ':pos'], 3));
  g.setAttribute('normal', new THREE.BufferAttribute(arrays[k + ':nrm'], 3, true));
  // Farbe: Gamma-2-kodiert → linear (Float)
  const c8 = arrays[k + ':col'], n = lod.n, col = new Float32Array(n * 3);
  const pal = o.palette;
  const slot = arrays[k + ':slot'];
  for (let i = 0; i < n; i++) {
    const s = slot ? slot[i] : 0;
    if (s && pal && pal[s]) {
      const kk = (c8[i * 4 + 3] / 255) * 2;
      col[i * 3] = pal[s][0] * kk; col[i * 3 + 1] = pal[s][1] * kk; col[i * 3 + 2] = pal[s][2] * kk;
    } else {
      for (let c = 0; c < 3; c++) { const v = c8[i * 4 + c] / 255; col[i * 3 + c] = v * v * lod.cmax; }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (arrays[k + ':pbr']) g.setAttribute('pbr', new THREE.BufferAttribute(arrays[k + ':pbr'], 4, true));
  if (arrays[k + ':bake']) g.setAttribute('bake', new THREE.BufferAttribute(arrays[k + ':bake'], 4, true));
  if (arrays[k + ':si']) g.setAttribute('skinIndex', new THREE.BufferAttribute(arrays[k + ':si'], 4));
  if (arrays[k + ':sw']) g.setAttribute('skinWeight', new THREE.BufferAttribute(arrays[k + ':sw'], 4, true));
  g.setIndex(new THREE.BufferAttribute(arrays[k + ':idx'], 1));
  return g;
}
function mergeGeos(list) {
  if (list.length === 1) return list[0];
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(list[0].attributes)) {
    const a0 = list[0].attributes[name];
    const arr = new a0.array.constructor(nv * a0.itemSize);
    let o = 0;
    for (const g of list) { const a = g.attributes[name]; arr.set(a.array, o); o += a.array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
  }
  const idx = nv < 65536 ? new Uint16Array(ni) : new Uint32Array(ni);
  let o = 0, base = 0;
  for (const g of list) { const s = g.index.array; for (let i = 0; i < s.length; i++) idx[o + i] = s[i] + base; o += s.length; base += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Helden
// ---------------------------------------------------------------------------------------------
const tierOf = (lv) => (lv >= 9 ? 9 : lv >= 6 ? 6 : lv >= 3 ? 3 : 0);
const V3 = (a) => (a ? new THREE.Vector3(a[0], a[1], a[2]) : null);

/** Fertiges Helden-Rig (gleiche Schnittstelle wie heroModels.buildHero) oder null */
export function buildForgedHero(modelId, { level = 1, lod } = {}) {
  const asset = cache.get(modelId);
  if (!asset) return null;
  const { header, arrays } = asset;
  const sk = header.skeleton, info = header.info || {};
  const root = new THREE.Group(); root.name = 'heroRoot';
  const joints = {}, rest = {};
  sk.names.forEach((name, i) => {
    const g = new THREE.Group(); g.name = name;
    const p = sk.parents[i], r = sk.rest[i];
    rest[name] = V3(r);
    if (p >= 0) { const pr = sk.rest[p]; g.position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]); joints[sk.names[p]].add(g); } else { g.position.set(r[0], r[1], r[2]); root.add(g); }
    joints[name] = g;
  });
  root.updateMatrixWorld(true);
  const bones = sk.names.map((n) => joints[n]);
  const skeleton = new THREE.Skeleton(bones);
  const L = Math.min(header.meshes[0].lods.length - 1, lod ?? lodBias);
  const body = createForgeMaterial({ physical: true, rim: 0.34 });
  if (header.palette && header.palette.glow) body.userData.uniforms.uRimCol.value.set(header.palette.glow);
  const glow = createForgeGlowMaterial(1);
  const glass = createForgeGlassMaterial();
  const mats = { body, glow, glass };
  const meshes = {};
  const ident = new THREE.Matrix4();
  const rig = {
    root, joints, rest, scale: header.scale || 1, style: info.style, level: Math.max(1, level | 0),
    glowMaterials: [glow], bodyMaterials: [body], chains: [], floaters: (info.floaters || []).map((f) => ({ ...f })),
    bowRest: V3(info.bowRest), bowNock: V3(info.bowNock), height: 1.8, radius: info.radius || 0.5, tier: -1, meshes, modelId, forged: true, lod: L,
  };
  const has = (n) => !!joints[n];
  if (has('cape')) rig.chains.push({ bones: ['cape', 'cape1', 'cape2', 'cape3'].filter(has), gain: 1, legPush: 0.3, omega: 10, zeta: 0.4, min: info.capeMin ?? 0.05 });
  if (has('plume')) rig.chains.push({ bones: ['plume', 'plume1', 'plume2'].filter(has), gain: 0.4, legPush: 0, gravity: 0.3, omega: 13, zeta: 0.3, breeze: 0.6, flutter: 0.6, deadX: 0 });
  if (has('skirtB')) rig.chains.push({ bones: ['skirtB'], gain: 0.7, legPush: 0.35, gravity: 0.3, omega: 9, zeta: 0.5, breeze: 0.5, flutter: 0.4, deadX: 0 });
  for (const extra of ['hair', 'scarf', 'scarfB', 'tail', 'sash']) if (has(extra)) {
    const bs = [extra]; let k = 1; while (has(extra + k)) bs.push(extra + k++);
    rig.chains.push({ bones: bs, gain: 0.8, legPush: 0, gravity: 0.6, omega: 11, zeta: 0.35, breeze: 0.8, flutter: 1 });
  }
  rig.lights = [];
  if (info.light && joints[info.light.joint]) {
    const Lt = new THREE.PointLight(info.light.color, info.light.intensity, info.light.distance, 2);
    Lt.userData.base = info.light.intensity; Lt.castShadow = false;
    joints[info.light.joint].add(Lt); rig.lights.push(Lt);
  }
  // Geometrien je Ebene/Stufe vorbereiten (einmal), bei Stufenwechsel zusammensetzen
  const parts = header.meshes.map((m) => ({ layer: m.layer, tier: m.tier, geo: lodGeometry(arrays, m.lods[Math.min(L, m.lods.length - 1)]), cmax: m.lods[Math.min(L, m.lods.length - 1)].cmax }));
  rig.setLevel = (lv) => {
    rig.level = Math.max(1, lv | 0);
    const t = tierOf(rig.level);
    if (t === rig.tier) return;
    rig.tier = t;
    for (const layer of ['body', 'glow', 'glass']) {
      const list = parts.filter((p) => p.layer === layer && p.tier <= t);
      let m = meshes[layer];
      if (!list.length) { if (m) m.visible = false; continue; }
      const g = mergeGeos(list.map((p) => p.geo));
      g.computeBoundingBox(); g.computeBoundingSphere(); g.boundingSphere.radius += 0.6;
      if (layer === 'glow') {
        // gemeinsame HDR-Skalierung
        const cm = Math.max(...list.map((p) => p.cmax));
        mats.glow.userData.base = 1;
        void cm;
      }
      if (!m) {
        m = new THREE.SkinnedMesh(g, mats[layer]);
        m.name = 'hero_' + layer;
        m.frustumCulled = false;
        m.castShadow = layer === 'body';
        m.receiveShadow = layer === 'body';
        if (layer === 'glass') m.renderOrder = 2;
        root.add(m);
        m.bind(skeleton, ident);
        meshes[layer] = m;
      } else {
        const old = m.geometry; m.geometry = g; if (list.length > 1 || old !== list[0].geo) old.dispose(); m.visible = true;
      }
    }
    const bb = new THREE.Box3();
    for (const m of Object.values(meshes)) if (m.visible) bb.union(m.geometry.boundingBox);
    rig.height = +bb.max.y.toFixed(3);
    let tris = 0; for (const m of Object.values(meshes)) if (m.visible) tris += m.geometry.index.count / 3;
    rig.triangles = tris;
  };
  rig.setLevel(rig.level);
  try { attachHeroFx(rig, { glow: header.palette && header.palette.glow, cores: info.cores, trails: info.trails }, rest); } catch (e) { console.warn('[Forge] Effekte:', e); }
  rig.dispose = () => {
    if (rig.fx) for (const o of rig.fx.objs) { o.removeFromParent(); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }
    for (const m of Object.values(meshes)) { m.geometry.dispose(); m.removeFromParent(); }
    for (const p of parts) p.geo.dispose();
    for (const m of Object.values(mats)) m.dispose();
    for (const Lt of rig.lights) { Lt.removeFromParent(); Lt.dispose && Lt.dispose(); }
    skeleton.dispose();
  };
  return rig;
}

// ---------------------------------------------------------------------------------------------
// Einheiten (instanziert, Vertex-Animation über aRig)
// ---------------------------------------------------------------------------------------------
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function hexLin(hex) {
  const c = new THREE.Color(hex); // ColorManagement: Hex (sRGB) → linear
  return [c.r, c.g, c.b];
}
void srgbToLin;

/**
 * Geschmiedete Einheit oder null. opts: { primary, secondary, metal, glow, tier }
 * Rückgabe wie models.buildModel: { body, glow, height, radius }
 */
export function buildForgedUnit(arch, opts = {}, defaults = {}) {
  const asset = cache.get('unit_' + arch);
  if (!asset) return null;
  const { header, arrays } = asset;
  const info = header.info || {};
  const pal = {
    1: hexLin(opts.primary || defaults.primary || header.palette.primary),
    2: hexLin(opts.secondary || defaults.secondary || header.palette.secondary),
    3: hexLin(opts.metal || defaults.metal || header.palette.metal),
    4: hexLin(opts.glow || defaults.glow || header.palette.glow),
  };
  const tier = Math.max(1, Math.min(3, opts.tier | 0 || 1));
  const scale = [1, 1.12, 1.25][tier - 1];
  const L = Math.min(header.meshes[0].lods.length - 1, lodBias);
  const out = {};
  for (const layer of ['body', 'glow']) {
    const list = header.meshes.filter((m) => (m.layer === layer || (layer === 'body' && m.layer === 'glass')) && m.tier <= (tier - 1) * 3);
    if (!list.length) { out[layer] = null; continue; }
    const geos = list.map((m) => {
      const lod = m.lods[Math.min(L, m.lods.length - 1)];
      const g = lodGeometry(arrays, lod, { palette: pal });
      const rig = arrays[lod.key + ':rig'];
      if (rig) {
        // Drehpunkte mitskalieren (Klassen-abhängig, siehe unitRig.js)
        const r = new Float32Array(rig.length);
        for (let i = 0; i < rig.length; i += 4) {
          const cls = Math.floor(rig[i] + 1e-4);
          r[i] = rig[i];
          if (cls === 5) { r[i + 1] = rig[i + 1]; r[i + 2] = rig[i + 2] * scale; r[i + 3] = rig[i + 3] / scale; }
          else if (cls === 1 || cls === 9) { r[i + 1] = rig[i + 1]; r[i + 2] = rig[i + 2] * scale; r[i + 3] = rig[i + 3] * scale; }
          else if (cls === 4) { r[i + 1] = rig[i + 1] * scale; r[i + 2] = rig[i + 2] * scale; r[i + 3] = rig[i + 3]; }
          else { r[i + 1] = rig[i + 1]; r[i + 2] = rig[i + 2] * scale; r[i + 3] = rig[i + 3] * scale; }
        }
        g.setAttribute('aRig', new THREE.BufferAttribute(r, 4));
      }
      if (layer === 'glow') { g.deleteAttribute('pbr'); g.deleteAttribute('bake'); }
      return g;
    });
    const g = mergeGeos(geos);
    g.scale(scale, scale, scale);
    g.computeBoundingBox(); g.computeBoundingSphere();
    out[layer] = g;
  }
  let top = out.body.boundingBox.max.y;
  if (out.glow) top = Math.max(top, out.glow.boundingBox.max.y);
  return { body: out.body, glow: out.glow, height: +top.toFixed(3), radius: +((info.radius || 0.6) * scale).toFixed(3), forged: true };
}

export { createForgeMaterial, createForgeGlowMaterial, createForgeGlassMaterial };
