// Aetherfront – Helden-Rig: Skelett aus THREE.Group-Gelenken, Teile-Sammler mit Skin-Gewichten,
// Zusammenfügen zu SkinnedMeshes (Körper, Stoff doppelseitig, Glühen HDR, Kristallglas) und Stufen-Details.
import * as THREE from 'three';
import { V, v3, C, smooth, clamp } from './geo.js';

// Materialklassen: [Rauheit, Metall]
export const M = {
  cloth: [0.86, 0], silk: [0.55, 0], leather: [0.62, 0], dleather: [0.7, 0], skin: [0.5, 0], hair: [0.45, 0],
  metal: [0.38, 1], steel: [0.34, 1], dmetal: [0.5, 0.9], gold: [0.32, 1], copper: [0.38, 1], bronze: [0.42, 1],
  wood: [0.72, 0], bark: [0.9, 0], leaf: [0.6, 0], bone: [0.55, 0], gem: [0.08, 0.2], crystal: [0.05, 0.1],
  fur: [0.95, 0], feather: [0.7, 0], rubber: [0.8, 0], paint: [0.42, 0.3], eye: [0.12, 0], lacquer: [0.3, 0.2],
};

// ---------------------------------------------------------------------------------------------
// Skelett
// ---------------------------------------------------------------------------------------------
export const CORE_JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'foreArmL', 'handL', 'shoulderR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

/** Proportionen → Ruhe-Gelenkpositionen (Modellraum). p: scale, leg, torso, shoulders, hipsW, arm, head, neck */
export function makeSkeleton(p = {}) {
  const s = p.scale ?? 1, leg = p.leg ?? 1, tor = p.torso ?? 1, sw = p.shoulders ?? 1, hw = p.hipsW ?? 1, arm = p.arm ?? 1;
  const ankleY = 0.085 * (p.foot ?? 1);
  const kneeY = ankleY + 0.425 * leg, thighY = kneeY + 0.425 * leg;
  const hipsY = thighY + 0.05 * tor;
  const J = {};
  const add = (name, parent, x, y, z) => { J[name] = { parent, pos: V(x * s, y * s, z * s) }; };
  add('hips', null, 0, hipsY, 0);
  add('spine', 'hips', 0, hipsY + 0.1 * tor, -0.005);
  add('chest', 'spine', 0, hipsY + 0.29 * tor, -0.012);
  add('neck', 'chest', 0, hipsY + 0.52 * tor, -0.02);
  add('head', 'neck', 0, hipsY + 0.52 * tor + 0.085 * (p.neck ?? 1), -0.004);
  const shY = hipsY + 0.455 * tor, ua = 0.29 * arm, fa = 0.25 * arm;
  for (const [side, k] of [['L', 1], ['R', -1]]) {
    add('shoulder' + side, 'chest', k * 0.05 * sw, shY + 0.01, -0.02);
    add('upperArm' + side, 'shoulder' + side, k * 0.195 * sw, shY, -0.03);
    add('foreArm' + side, 'upperArm' + side, k * (0.195 * sw + 0.04), shY - ua, -0.045);
    add('hand' + side, 'foreArm' + side, k * (0.195 * sw + 0.063), shY - ua - fa, -0.03);
    add('thigh' + side, 'hips', k * 0.095 * hw, thighY, 0);
    add('shin' + side, 'thigh' + side, k * 0.103 * hw, kneeY, 0.01);
    add('foot' + side, 'shin' + side, k * 0.108 * hw, ankleY, -0.02);
  }
  return { J, s, dims: { ankleY: ankleY * s, kneeY: kneeY * s, thighY: thighY * s, hipsY: hipsY * s, shY: shY * s } };
}

export function mirrorName(n) {
  return n.replace(/(L|R)(\d*)$/, (m, a, d) => (a === 'L' ? 'R' : 'L') + d);
}

// ---------------------------------------------------------------------------------------------
// Gewichts-Hilfen: liefern fn(p: Vector3) → [[bone, w], ...]
// ---------------------------------------------------------------------------------------------
export const W = {
  /** stückweise Überblendung entlang einer Achse: stops = [[wert, bone], ...] (aufsteigend) */
  ramp(axis, stops, soft = 1) {
    const f = typeof axis === 'function' ? axis : (p) => p[axis];
    return (p) => {
      const x = f(p);
      if (x <= stops[0][0]) return [[stops[0][1], 1]];
      for (let i = 0; i < stops.length - 1; i++) {
        const [a, ba] = stops[i], [b, bb] = stops[i + 1];
        if (x <= b) {
          const m = (a + b) / 2, h = ((b - a) / 2) * soft;
          const t = smooth(m - h, m + h, x);
          return [[ba, 1 - t], [bb, t]];
        }
      }
      return [[stops[stops.length - 1][1], 1]];
    };
  },
  /** Überblendung zweier Knochen über einem Gelenkpunkt entlang einer Richtung */
  joint(b0, b1, at, dir, blend = 0.05) {
    const A = v3(at), D = v3(dir).normalize(), t = V();
    return (p) => { const d = t.copy(p).sub(A).dot(D); const w = smooth(-blend, blend, d); return [[b0, 1 - w], [b1, w]]; };
  },
  /** Kette: Gewichte nach Wert entlang einer Achse auf eine Knochenkette */
  chain(axis, vals, bones) { return W.ramp(axis, vals.map((v, i) => [v, bones[i]])); },
  mixFn(fa, fb, wfn) {
    return (p) => {
      const t = clamp(wfn(p), 0, 1), out = [];
      if (t < 1) for (const [b, w] of fa(p)) out.push([b, w * (1 - t)]);
      if (t > 0) for (const [b, w] of fb(p)) out.push([b, w * t]);
      return out;
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------------------------
export function createHeroMaterial(o = {}) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: o.env ?? 1.15, side: o.side ?? THREE.FrontSide,
  });
  const uniforms = { uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.35, 0.25) }, uHeight: { value: o.height || 1.8 } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 pbr;\nvarying vec2 vPbr;\nvarying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPbr = pbr;\n\tvObjP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vPbr;
varying vec3 vObjP;
uniform float uFlash; uniform vec3 uFlashCol; uniform float uHeight;
float hHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hHash(i), hHash(i + vec3(1,0,0)), u.x), mix(hHash(i + vec3(0,1,0)), hHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hHash(i + vec3(0,0,1)), hHash(i + vec3(1,0,1)), u.x), mix(hHash(i + vec3(0,1,1)), hHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
	float hY = vObjP.y / uHeight;
	diffuseColor.rgb *= mix( 0.78, 1.0, smoothstep( -0.02, 0.32, hY ) );
	float clothN = hNoise(vObjP * 140.0);
	diffuseColor.rgb *= 1.0 - 0.07 * (1.0 - vPbr.y) * smoothstep(0.55, 0.95, vPbr.x) * clothN;
	#ifdef DOUBLE_SIDED
		if ( !gl_FrontFacing ) diffuseColor.rgb *= 0.55;
	#endif`)
      .replace('#include <roughnessmap_fragment>', `float microN = hNoise(vObjP * 26.0) * 0.65 + hNoise(vObjP * 71.0) * 0.35;
float roughnessFactor = clamp(roughness * vPbr.x * (0.9 + 0.2 * microN) + 0.06 * vPbr.y * microN, 0.08, 1.0);`)
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(metalness * vPbr.y, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	{
		float h = microN * (0.25 + 0.75 * (1.0 - vPbr.y));
		vec3 dpdx = dFdx( - vViewPosition ), dpdy = dFdy( - vViewPosition );
		float dhx = dFdx( h ), dhy = dFdy( h );
		vec3 r1 = cross( dpdy, normal ), r2 = cross( normal, dpdx );
		float det = dot( dpdx, r1 );
		vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
		float fade = 1.0 - smoothstep( 12.0, 50.0, length( vViewPosition ) );
		normal = normalize( abs( det ) * normal - grad * 0.0035 * fade );
	}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 rimV = normalize( vViewPosition );
		float ndv = clamp( dot( normal, -rimV ), 0.0, 1.0 );
		float rimF = pow( 1.0 - ndv, 3.0 );
		totalEmissiveRadiance += rimF * ( diffuseColor.rgb * 0.32 + vec3( 0.045, 0.065, 0.11 ) ) * ( 1.0 - 0.55 * metalnessFactor );
		totalEmissiveRadiance += diffuseColor.rgb * 0.03;
		totalEmissiveRadiance += uFlashCol * uFlash * (0.35 + 0.65 * rimF);
	}`);
  };
  m.customProgramCacheKey = () => 'aetherfront-hero-v1-' + (o.side ?? 0);
  return m;
}
export function createHeroGlowMaterial() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.userData.base = 1;
  return m;
}
export function createHeroGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------
const LAYERS = ['body', 'cloth', 'glow', 'glass'];

export class HeroBuilder {
  constructor(skel) {
    this.skel = skel;
    this.J = {};               // name → { parent, pos }
    for (const [n, j] of Object.entries(skel.J)) this.J[n] = { parent: j.parent, pos: j.pos.clone() };
    this.parts = [];
    this.meta = {};
  }
  P(name) { return this.J[name].pos.clone(); }
  joint(name, parent, pos) { this.J[name] = { parent, pos: v3(pos) }; return this; }
  has(name) { return !!this.J[name]; }

  _part(g, col, mat, bind, o, layer, mirror) {
    let geo = g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const pos = geo.attributes.position.array, nrm = geo.attributes.normal.array, n = pos.length / 3;
    const c = C(col).multiplyScalar(o.k ?? 1);
    const part = {
      layer, tier: o.tier || 0, maxTier: o.maxTier ?? 99, n,
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      col: new Float32Array(n * 3), pbr: new Float32Array(n * 2), si: new Uint16Array(n * 4), sw: new Float32Array(n * 4), bones: [],
    };
    for (let i = 0; i < n; i++) {
      part.col[i * 3] = c.r; part.col[i * 3 + 1] = c.g; part.col[i * 3 + 2] = c.b;
      part.pbr[i * 2] = mat[0]; part.pbr[i * 2 + 1] = mat[1];
    }
    // Farbverlauf (z.B. Saum dunkler): o.grad = { axis:'y', from, to, k }
    if (o.grad) {
      const { axis = 'y', from, to, col: c2 } = o.grad, ax = { x: 0, y: 1, z: 2 }[axis], cc = C(c2);
      for (let i = 0; i < n; i++) {
        const t = smooth(from, to, pos[i * 3 + ax]);
        part.col[i * 3] += (cc.r - c.r) * t; part.col[i * 3 + 1] += (cc.g - c.g) * t; part.col[i * 3 + 2] += (cc.b - c.b) * t;
      }
    }
    // Skin-Gewichte
    const tmp = V();
    const names = [];
    const idxOf = (b) => { const nm = mirror ? mirrorName(b) : b; let k = names.indexOf(nm); if (k < 0) { names.push(nm); k = names.length - 1; } return k; };
    for (let i = 0; i < n; i++) {
      let ws;
      if (typeof bind === 'string') ws = [[bind, 1]];
      else { tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); ws = bind(tmp); }
      ws = ws.filter((w) => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      let sum = 0; for (const w of ws) sum += w[1];
      if (!ws.length) { ws = [['hips', 1]]; sum = 1; }
      for (let k = 0; k < 4; k++) {
        if (k < ws.length) { part.si[i * 4 + k] = idxOf(ws[k][0]); part.sw[i * 4 + k] = ws[k][1] / sum; }
      }
    }
    // sehr helle Albedo weich begrenzen (verhindert Ausbrennen/Bloom auf weißen Stoffen)
    if (layer !== 'glow') for (let i = 0; i < n; i++) {
      const r = part.col[i * 3], g = part.col[i * 3 + 1], b = part.col[i * 3 + 2], lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0.36) { const f = (0.36 + (lum - 0.36) * 0.35) / lum; part.col[i * 3] *= f; part.col[i * 3 + 1] *= f; part.col[i * 3 + 2] *= f; }
    }
    part.boneNames = names;
    if (mirror) {
      for (let i = 0; i < n; i++) { part.pos[i * 3] *= -1; part.nrm[i * 3] *= -1; }
      // Dreiecksreihenfolge umkehren
      const sw3 = (arr, is) => { for (let t = 0; t < n; t += 3) for (let k = 0; k < is; k++) { const a = (t + 1) * is + k, b = (t + 2) * is + k, x = arr[a]; arr[a] = arr[b]; arr[b] = x; } };
      sw3(part.pos, 3); sw3(part.nrm, 3); sw3(part.col, 3); sw3(part.pbr, 2); sw3(part.si, 4); sw3(part.sw, 4);
    }
    this.parts.push(part);
    return part;
  }
  /** Körperteil. bind: Knochenname oder Gewichtsfunktion. o: { tier, k, grad } */
  add(g, col, mat, bind = 'hips', o = {}) { this._part(g, col, mat, bind, o, o.layer || 'body', false); return g; }
  /** links (+X) gebaut, rechts gespiegelt (Knochen L↔R) */
  sym(g, col, mat, bind = 'hips', o = {}) { this._part(g, col, mat, bind, o, o.layer || 'body', false); this._part(g, col, mat, bind, o, o.layer || 'body', true); return g; }
  cloth(g, col, mat, bind, o = {}) { return this.add(g, col, mat || M.cloth, bind, { ...o, layer: 'cloth' }); }
  clothSym(g, col, mat, bind, o = {}) { return this.sym(g, col, mat || M.cloth, bind, { ...o, layer: 'cloth' }); }
  glow(g, col, k = 3, bind = 'hips', o = {}) { return this.add(g, col, [1, 0], bind, { ...o, k, layer: 'glow' }); }
  glowSym(g, col, k = 3, bind = 'hips', o = {}) { return this.sym(g, col, [1, 0], bind, { ...o, k, layer: 'glow' }); }
  glass(g, col, bind = 'hips', o = {}) { return this.add(g, col, [0.05, 0], bind, { ...o, layer: 'glass' }); }

  /** Gelenk-Hierarchie + SkinnedMeshes erzeugen */
  build() {
    const root = new THREE.Group();
    root.name = 'heroRoot';
    const joints = {}, order = [];
    const visit = (name) => {
      if (joints[name]) return;
      const j = this.J[name];
      if (j.parent) visit(j.parent);
      const g = new THREE.Group();
      g.name = name;
      const pp = j.parent ? this.J[j.parent].pos : V();
      g.position.copy(j.pos).sub(pp);
      (j.parent ? joints[j.parent] : root).add(g);
      joints[name] = g;
      order.push(name);
    };
    for (const n of Object.keys(this.J)) visit(n);
    root.updateMatrixWorld(true);
    const bones = order.map((n) => joints[n]);
    const skeleton = new THREE.Skeleton(bones);
    const boneIndex = Object.fromEntries(order.map((n, i) => [n, i]));
    const rest = Object.fromEntries(order.map((n) => [n, this.J[n].pos.clone()]));
    return { root, joints, skeleton, boneIndex, order, rest };
  }

  /** Geometrie je Ebene für eine Stufe zusammenfügen */
  geometryFor(layer, tier, boneIndex) {
    const parts = this.parts.filter((p) => p.layer === layer && p.tier <= tier && p.maxTier >= tier);
    if (!parts.length) return null;
    let n = 0; for (const p of parts) n += p.n;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), pbr = new Float32Array(n * 2);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let o = 0;
    for (const p of parts) {
      pos.set(p.pos, o * 3); nrm.set(p.nrm, o * 3); col.set(p.col, o * 3); pbr.set(p.pbr, o * 2); sw.set(p.sw, o * 4);
      const map = p.boneNames.map((b) => { const k = boneIndex[b]; if (k === undefined) throw new Error('Hero-Knochen fehlt: ' + b); return k; });
      for (let i = 0; i < p.n * 4; i++) si[o * 4 + i] = p.sw[i] > 0 ? map[p.si[i]] : 0;
      o += p.n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (layer !== 'glow') g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    g.boundingSphere.radius += 0.6;
    return g;
  }
}

export { LAYERS };
