// Effekte: GPU-Partikel (additiv = Funken/Glut/Magie, deckend = Rauch/Staub/Asche), echte Geschosse (Pfeile mit
// Leuchtspur, brennende Felsbrocken mit Rauchfahne, Knochen, Magiekugeln in Volksfarbe), Einschläge (Blitz, Feuerball,
// Staubwolke, Trümmer mit Physik, Bodenrisse), Nahkampf-Funken mit Schlagspur, Asche beim Auflösen sterbender
// Einheiten, Anführer-Fähigkeiten, Schockwellen, Blitzketten, Lichtsäulen, schwebende Zahlen (Gold/Krit).
// Alles instanziert (je System ein Draw-Call) mit festen Obergrenzen.
import * as THREE from 'three';
import { ATTACK_TYPES, UNITS, FACTIONS } from '../sim/data.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _side = new THREE.Vector3(), _n = new THREE.Vector3(), _toCam = new THREE.Vector3();
const C_FIRE = new THREE.Color('#ff7a22'), C_FIRE2 = new THREE.Color('#ff4a12'), C_SMOKE1 = new THREE.Color('#2e2a28'), C_SMOKE2 = new THREE.Color('#4a4440');
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

// Geschoss-Arten: Startbogen (Anteil der Flugweite), Start-/Zielhöhe
const PROJ = {
  arrow: { arc: 0.12, y0: 1.6, y1: 1.1, color: '#fff1c2', trail: '#ffe6a8' },
  bolt: { arc: 0.08, y0: 1.5, y1: 1.1, color: '#bfe8ff', trail: '#9fdcff' },
  magic: { arc: 0.05, y0: 1.8, y1: 1.2, color: '#7ad7ff', trail: '#5ab8ff' },
  void: { arc: 0.05, y0: 1.8, y1: 1.2, color: '#d07bff', trail: '#b04aff' },
  shell: { arc: 0.42, y0: 2.0, y1: 0.35, color: '#ffb36a', trail: '#ff7a2a' },
  bone: { arc: 0.42, y0: 2.0, y1: 0.4, color: '#efe6d0', trail: '#a6ff7a' },
};

// ---------------------------------------------------------------------------------------------
// Partikel (Punkte): additiv (Glut/Funken) oder deckend (Rauch/Staub/Asche)
// ---------------------------------------------------------------------------------------------
class Particles {
  constructor(root, cap, smoke) {
    this.cap = cap; this.n = 0; this.smoke = smoke;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.alpha = new Float32Array(cap); this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.base = new Float32Array(cap * 3);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.drag = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.size0 = new Float32Array(cap); this.grow = new Float32Array(cap); this.a0 = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: !!smoke, vertexColors: true,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */`
        attribute float size; attribute float alpha; varying vec3 vCol; varying float vA; varying float vSeed; uniform float uScale;
        void main(){ vCol = color; vA = alpha; vSeed = fract(position.x * 3.17 + position.z * 1.93); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(512.0, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: smoke ? /* glsl */`
        varying vec3 vCol; varying float vA; varying float vSeed;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
          float nn = n2(gl_PointCoord * 4.0 + vSeed * 17.0) * 0.6 + n2(gl_PointCoord * 9.0 - vSeed * 9.0) * 0.4;
          float a = smoothstep(1.0, 0.25, r + (nn - 0.5) * 0.55) * vA;
          if (a < 0.01) discard;
          vec3 c = vCol * (0.78 + 0.4 * (0.5 - d.y) + 0.12 * nn);
          gl_FragColor = vec4(c, a);
        }` : /* glsl */`
        varying vec3 vCol; varying float vA; varying float vSeed;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 1.8) * vA; gl_FragColor = vec4(vCol * a, a); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = smoke ? 8 : 10;
    root.add(this.points);
  }
  add(x, y, z, vx, vy, vz, color, intensity, life, size, grav, drag, grow = 0, alpha = 1) {
    if (this.n >= this.cap) return;
    const j = this.n++, j3 = j * 3;
    this.pos[j3] = x; this.pos[j3 + 1] = y; this.pos[j3 + 2] = z;
    this.vel[j3] = vx; this.vel[j3 + 1] = vy; this.vel[j3 + 2] = vz;
    this.base[j3] = color.r * intensity; this.base[j3 + 1] = color.g * intensity; this.base[j3 + 2] = color.b * intensity;
    this.max[j] = this.life[j] = life; this.size0[j] = size; this.grav[j] = grav; this.drag[j] = drag; this.grow[j] = grow; this.a0[j] = alpha;
  }
  update(dt, scale) {
    let n = this.n;
    const smoke = this.smoke;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { n--; this.copy(n, i); i--; continue; }
      const dr = Math.exp(-this.drag[i] * dt), i3 = i * 3;
      this.vel[i3] *= dr; this.vel[i3 + 2] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr + this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] = Math.max(0.05, this.pos[i3 + 1] + this.vel[i3 + 1] * dt);
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const a = this.life[i] / this.max[i], age = 1 - a;
      if (smoke) {
        const fa = Math.min(1, age * 7) * (a < 0.6 ? a / 0.6 : 1);
        this.alpha[i] = this.a0[i] * fa;
        this.col[i3] = this.base[i3]; this.col[i3 + 1] = this.base[i3 + 1]; this.col[i3 + 2] = this.base[i3 + 2];
        this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - (1 - age) * (1 - age)));
      } else {
        const f = a < 0.7 ? a / 0.7 : 1;
        this.alpha[i] = 1;
        this.col[i3] = this.base[i3] * f; this.col[i3 + 1] = this.base[i3 + 1] * f; this.col[i3 + 2] = this.base[i3 + 2] * f;
        this.size[i] = this.size0[i] * (0.4 + 0.6 * a) * (1 + this.grow[i] * age);
      }
    }
    this.n = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) g.attributes[k].needsUpdate = true;
    this.points.material.uniforms.uScale.value = scale;
  }
  copy(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.base[to * 3 + k] = this.base[from * 3 + k]; this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    for (const a of [this.life, this.max, this.size0, this.grav, this.drag, this.size, this.grow, this.a0, this.alpha]) a[to] = a[from];
  }
}

// ---------------------------------------------------------------------------------------------
// Leucht-Sprites (Billboards, additiv): 0 weiches Glühen, 1 Flamme, 2 Schlagspur (Sichel), 3 Blitzstern
// ---------------------------------------------------------------------------------------------
function makeSprites(cap) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const sp = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aSp', sp);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`
      attribute vec4 aSp; varying vec2 vUv; varying vec3 vCol; varying vec4 vSp;
      void main(){
        vUv = uv; vCol = instanceColor; vSp = aSp;
        float s = length(instanceMatrix[0].xyz);
        float c = cos(aSp.y), sn = sin(aSp.y);
        vec2 q = vec2(position.x * c - position.y * sn, position.x * sn + position.y * c);
        if (aSp.x > 0.5 && aSp.x < 1.5) q.y *= 1.5;
        vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        mv.xy += q * s;
        mv.z += s * 0.25;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vCol; varying vec4 vSp;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = 0.0;
        if (vSp.x < 0.5) a = exp(-r * r * 5.0) + 0.9 * exp(-r * r * 30.0);
        else if (vSp.x < 1.5) {
          float n = n2(vec2(p.x * 3.0, p.y * 2.0 - vSp.z * 9.0) + vSp.w * 7.0);
          float d = length(vec2(p.x * (1.5 + 0.7 * (p.y + 1.0)), (p.y + 0.3) * 1.05));
          float shape = 1.0 - smoothstep(0.15, 0.8, d + (n - 0.5) * 0.4);
          a = shape * (0.55 + 0.6 * n) * (1.0 - smoothstep(0.7, 1.0, max(abs(p.x), abs(p.y))));
        } else if (vSp.x < 2.5) {
          float ang = atan(p.y, p.x);
          float band = 1.0 - smoothstep(0.0, 0.12, abs(r - 0.78));
          float arc = smoothstep(-1.4, 0.9, ang) * (1.0 - smoothstep(0.9, 1.9, ang));
          a = band * arc * (0.5 + 0.5 * smoothstep(-1.4, 1.6, ang)) * 1.6 + 0.25 * exp(-r * r * 8.0);
        } else {
          float rays = pow(max(0.0, 1.0 - abs(p.x * p.y) * 18.0), 3.0) * (1.0 - r);
          a = rays * 1.4 + exp(-r * r * 9.0);
        }
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol * a, a);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.renderOrder = 11;
  mesh.setColorAt(0, _c.set(1, 1, 1));
  return mesh;
}

// Leuchtspuren (kamerazugewandte Bänder zwischen zwei Punkten), aSt = [Alpha Start, Alpha Ende]
function makeStreaks(cap) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  geo.setAttribute('aSt', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`attribute vec2 aSt; varying vec2 vUv; varying vec3 vCol; varying vec2 vSt; void main(){ vUv = uv; vCol = instanceColor; vSt = aSt; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; varying vec2 vSt; void main(){ float d = abs(vUv.x - 0.5) * 2.0; float a = pow(1.0 - d, 2.2) * mix(vSt.x, vSt.y, vUv.y); gl_FragColor = vec4(vCol * a, a); }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.renderOrder = 11;
  mesh.setColorAt(0, _c.set(1, 1, 1));
  return mesh;
}

// Bodenrisse / Brandflecken (flach, deckend, Risse glühen nach). aDc = [Zufall, Alter 0..1, Glut, Rissstärke]
function makeDecals(cap) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  geo.setAttribute('aDc', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */`attribute vec4 aDc; varying vec2 vUv; varying vec4 vDc; varying vec3 vCol; void main(){ vUv = uv; vDc = aDc; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec4 vDc; varying vec3 vCol;
      float h(float x){ return fract(sin(x * 91.17) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0) discard;
        float seed = vDc.x * 100.0, age = vDc.y;
        float ang = atan(p.y, p.x) / 6.2832 + 0.5;
        float K = 9.0;
        float a = ang * K + seed;
        float cell = floor(a);
        float wob = (n2(vec2(r * 6.0, cell * 3.1 + seed)) - 0.5) * 0.5;
        float f = abs(fract(a) - 0.5 - (h(cell + seed) - 0.5) * 0.5 + wob * (0.6 + r));
        float len = 0.45 + 0.55 * h(cell * 1.7 + seed);
        float crack = (1.0 - smoothstep(0.02, 0.06 + 0.05 * (1.0 - r), f * (1.0 + r * 2.0))) * (1.0 - smoothstep(len - 0.15, len, r)) * smoothstep(0.05, 0.18, r) * vDc.w;
        float ring = (1.0 - smoothstep(0.0, 0.05, abs(r - 0.34 - 0.06 * n2(p * 5.0 + seed)))) * 0.6 * vDc.w;
        crack = max(crack, ring * step(0.5, h(floor(ang * 5.0) + seed)));
        float scorch = pow(1.0 - smoothstep(0.0, 1.0, r), 1.4) * (0.55 + 0.45 * n2(p * 4.0 + seed));
        float fade = 1.0 - smoothstep(0.65, 1.0, age);
        float al = clamp(max(scorch * 0.75, crack), 0.0, 1.0) * fade;
        if (al < 0.01) discard;
        float glow = vDc.z * (1.0 - smoothstep(0.0, 0.45, age)) * crack;
        vec3 c = mix(vCol * (0.5 + 0.5 * scorch), vec3(0.02, 0.015, 0.012), crack) + vec3(3.2, 1.0, 0.25) * glow;
        gl_FragColor = vec4(c, al);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.setColorAt(0, _c.set(1, 1, 1));
  return mesh;
}

// Pfeil: Schaft, Spitze, drei Federn (Vertexfarben) – Blickrichtung +Z, Länge 1
function arrowGeometry() {
  const parts = [];
  const col = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  parts.push(col(new THREE.CylinderGeometry(0.032, 0.032, 0.86, 6).rotateX(Math.PI / 2).translate(0, 0, -0.05), '#8a5a32'));
  parts.push(col(new THREE.ConeGeometry(0.075, 0.2, 6).rotateX(Math.PI / 2).translate(0, 0, 0.46), '#d8dde6'));
  for (let i = 0; i < 3; i++) parts.push(col(new THREE.BoxGeometry(0.012, 0.11, 0.22).translate(0, 0.07, -0.4).rotateZ((i * Math.PI * 2) / 3), i ? '#f2efe6' : '#d23a2a'));
  return mergeSimple(parts);
}
function mergeSimple(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(n * 3); let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
// Felsbrocken: verbeultes Ikosaeder, Attribut hot (glühende Risse)
function rockGeometry(seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position, n = p.count, hot = new Float32Array(n);
  const key = (x, y, z) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = key(x, y, z);
    let v = cache.get(k);
    if (!v) { const r = Math.sin(x * 12.9 * seed + y * 78.2 + z * 37.7) * 43758.5; const f = r - Math.floor(r); v = [0.78 + 0.38 * f, f]; cache.set(k, v); }
    p.setXYZ(i, x * v[0], y * v[0] * 0.92, z * v[0]); hot[i] = v[1];
  }
  g.setAttribute('hot', new THREE.BufferAttribute(hot, 1));
  g.computeVertexNormals();
  return g;
}

export class Fx {
  constructor(scene, camera, settings) {
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.time = 0;
    this.glowP = new Particles(this.root, 9000, false);
    this.smokeP = new Particles(this.root, 3500, true);
    this.points = this.glowP.points; // (Kompatibilität)
    this.sprites = makeSprites(1400); this.root.add(this.sprites); this.spr = []; this.sprNow = [];
    this.streaks = makeStreaks(2400); this.root.add(this.streaks); this.strNow = [];
    this.decals = makeDecals(64); this.root.add(this.decals); this.dec = [];
    this.initProjectiles();
    this.initDebris(360);
    this.waves = [];
    this.initWaves(64);
    this.beams = [];
    this.initBeams(48);
    this.pillars = [];
    this.initPillars(16);
    this.texts = [];
    this.textLayer = document.getElementById('floaters');
    this.projState = new Map();
    this.timed = [];
    this.sim = null;
  }

  get density() { return this.settings.get('particles') ?? 1; }

  // ---------- Partikel ----------
  emit(x, y, z, { n = 10, color = '#ffffff', speed = 4, up = 2, life = 0.7, size = 0.35, grav = -6, drag = 2, spread = 0.2, intensity = 2.5, jitter = 0.4 } = {}) {
    n = Math.max(1, Math.round(n * this.density));
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, el = Math.random(), sp = speed * (0.3 + Math.random() * 0.7);
      const k = intensity * (1 - jitter / 2 + Math.random() * jitter);
      this.glowP.add(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread,
        Math.cos(a) * sp * (1 - el * 0.5), up * (0.4 + Math.random()) + el * sp * 0.5, Math.sin(a) * sp * (1 - el * 0.5),
        _c, k, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), grav, drag);
    }
  }
  /** Einzelnes Partikel mit vorgegebener Geschwindigkeit (für gerichtete/sogartige Effekte der Helden) */
  emitVel(x, y, z, vx, vy, vz, { color = '#ffffff', life = 0.6, size = 0.35, grav = 0, drag = 0, intensity = 2.5 } = {}) {
    this.glowP.add(x, y, z, vx, vy, vz, _c.set(color), intensity, life, size, grav, drag);
  }
  /** Rauch/Staub/Asche (deckend). grow: Größenzuwachs bis Lebensende (×), rise: Auftrieb */
  smoke(x, y, z, { n = 6, color = '#6a625a', speed = 1.5, up = 0.6, life = 1.6, size = 1.2, grow = 1.5, rise = 0.6, drag = 2.2, spread = 0.4, alpha = 0.7 } = {}) {
    n = Math.max(1, Math.round(n * Math.min(1, 0.4 + 0.6 * this.density)));
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      const k = 0.85 + Math.random() * 0.3;
      this.smokeP.add(x + (Math.random() - 0.5) * spread, y + Math.random() * spread * 0.5, z + (Math.random() - 0.5) * spread,
        Math.cos(a) * sp, up * (0.3 + Math.random()), Math.sin(a) * sp, _c, k, life * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), rise, drag, grow, alpha * (0.7 + Math.random() * 0.3));
    }
  }

  // ---------- Sprites / Spuren / Decals ----------
  /** Kurzlebiges Leucht-Sprite. shape: 0 Glühen, 1 Flamme, 2 Schlagspur, 3 Blitzstern */
  flash(x, y, z, { size = 1, size1 = null, color = '#ffffff', intensity = 3, life = 0.2, shape = 0, rot = 0, vy = 0 } = {}) {
    if (this.spr.length < 600) this.spr.push({ x, y, z, size, size1: size1 ?? size, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0, shape, rot, vy, seed: Math.random() });
  }
  spriteNow(x, y, z, size, color, shape = 0, rot = 0, k = 1) { if (this.sprNow.length < 700) this.sprNow.push(x, y, z, size, color.r * k, color.g * k, color.b * k, shape, rot); }
  streakNow(ax, ay, az, bx, by, bz, width, color, a0, a1) { if (this.strNow.length < 2400 * 12) this.strNow.push(ax, ay, az, bx, by, bz, width, color.r, color.g, color.b, a0, a1); }
  decal(x, z, { r = 2, life = 5, glow = 1, crack = 1, color = '#2a2420' } = {}) {
    if (this.dec.length >= 64) this.dec.shift();
    this.dec.push({ x, z, r, life, t: 0, glow, crack, seed: Math.random(), rot: Math.random() * 6.28, color: new THREE.Color(color) });
  }
  updateSprites(dt) {
    const mesh = this.sprites, sp = mesh.geometry.attributes.aSp.array;
    let n = 0;
    for (let i = this.spr.length - 1; i >= 0; i--) {
      const s = this.spr[i];
      s.t += dt;
      if (s.t >= s.life) { this.spr.splice(i, 1); continue; }
      const a = s.t / s.life;
      s.y += s.vy * dt;
      const size = s.size + (s.size1 - s.size) * (1 - (1 - a) * (1 - a));
      _m.compose(_p.set(s.x, s.y, s.z), _q.identity(), _s.setScalar(size));
      mesh.setMatrixAt(n, _m);
      const f = s.shape === 2 ? (a < 0.3 ? 1 : 1 - (a - 0.3) / 0.7) : 1 - a;
      mesh.setColorAt(n, _c.copy(s.color).multiplyScalar(f));
      sp[n * 4] = s.shape; sp[n * 4 + 1] = s.rot; sp[n * 4 + 2] = this.time; sp[n * 4 + 3] = s.seed;
      n++;
    }
    const B = this.sprNow;
    for (let i = 0; i < B.length && n < 1400; i += 9) {
      _m.compose(_p.set(B[i], B[i + 1], B[i + 2]), _q.identity(), _s.setScalar(B[i + 3]));
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, _c.setRGB(B[i + 4], B[i + 5], B[i + 6]));
      sp[n * 4] = B[i + 7]; sp[n * 4 + 1] = B[i + 8]; sp[n * 4 + 2] = this.time; sp[n * 4 + 3] = (i * 0.137) % 1;
      n++;
    }
    B.length = 0;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aSp.needsUpdate = true;
  }
  updateStreaks() {
    const mesh = this.streaks, st = mesh.geometry.attributes.aSt.array, B = this.strNow, cam = this.camera.position;
    let n = 0;
    for (let i = 0; i < B.length && n < 2400; i += 12) {
      _a.set(B[i], B[i + 1], B[i + 2]); _b.set(B[i + 3], B[i + 4], B[i + 5]);
      const dir = _v.subVectors(_b, _a); const len = dir.length(); if (len < 1e-4) continue;
      dir.multiplyScalar(1 / len);
      _toCam.subVectors(cam, _a).normalize();
      _side.crossVectors(dir, _toCam).normalize().multiplyScalar(B[i + 6]);
      _n.crossVectors(_side, dir).normalize();
      _m.makeBasis(_side, dir.multiplyScalar(len), _n); _m.setPosition(_a);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, _c.setRGB(B[i + 7], B[i + 8], B[i + 9]));
      st[n * 2] = B[i + 10]; st[n * 2 + 1] = B[i + 11];
      n++;
    }
    B.length = 0;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aSt.needsUpdate = true;
  }
  updateDecals(dt) {
    const mesh = this.decals, dc = mesh.geometry.attributes.aDc.array;
    let n = 0;
    for (let i = this.dec.length - 1; i >= 0; i--) {
      const d = this.dec[i];
      d.t += dt;
      if (d.t >= d.life) { this.dec.splice(i, 1); continue; }
      const grow = Math.min(1, d.t / 0.12);
      _m.compose(_p.set(d.x, 0.04, d.z), _q.setFromAxisAngle(UP, d.rot), _s.set(d.r * 2 * (0.6 + 0.4 * grow), 1, d.r * 2 * (0.6 + 0.4 * grow)));
      mesh.setMatrixAt(n, _m); mesh.setColorAt(n, d.color);
      dc[n * 4] = d.seed; dc[n * 4 + 1] = d.t / d.life; dc[n * 4 + 2] = d.glow; dc[n * 4 + 3] = d.crack;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aDc.needsUpdate = true;
  }

  // ---------- Trümmer (instanzierte Brocken mit Schwerkraft und Abprallen) ----------
  initDebris(cap) {
    const geo = rockGeometry(2.3);
    geo.deleteAttribute('hot');
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05, flatShading: true });
    this.debMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.debMesh.frustumCulled = false; this.debMesh.castShadow = true;
    this.debMesh.setColorAt(0, _c.set(1, 1, 1));
    this.debCap = cap; this.deb = [];
    this.root.add(this.debMesh);
  }
  debris(x, y, z, { n = 10, speed = 6, up = 6, size = 0.2, color = '#6a5a4a', life = 2.2 } = {}) {
    n = Math.max(1, Math.round(n * Math.min(1, 0.5 + 0.5 * this.density)));
    const base = new THREE.Color(color);
    for (let i = 0; i < n && this.deb.length < this.debCap; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.65);
      const ax = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
      this.deb.push({ x: x + rnd(-0.3, 0.3), y: y + rnd(0, 0.3), z: z + rnd(-0.3, 0.3), vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random() * 0.7), vz: Math.sin(a) * sp,
        s: size * (0.5 + Math.random()), ax, ang: Math.random() * 6, spin: rnd(4, 14), t: 0, life: life * (0.7 + Math.random() * 0.5), col: base.clone().multiplyScalar(0.7 + Math.random() * 0.5) });
    }
  }
  updateDebris(dt) {
    let n = 0;
    for (let i = this.deb.length - 1; i >= 0; i--) {
      const d = this.deb[i];
      d.t += dt;
      if (d.t >= d.life) { this.deb.splice(i, 1); continue; }
      d.vy -= 22 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < d.s * 0.6) { d.y = d.s * 0.6; if (d.vy < 0) { d.vy = -d.vy * 0.3; d.vx *= 0.55; d.vz *= 0.55; d.spin *= 0.5; } }
      d.ang += d.spin * dt;
      const sh = d.t > d.life - 0.4 ? (d.life - d.t) / 0.4 : 1;
      _m.compose(_p.set(d.x, d.y - (1 - sh) * d.s, d.z), _q.setFromAxisAngle(d.ax, d.ang), _s.setScalar(d.s * sh));
      this.debMesh.setMatrixAt(n, _m); this.debMesh.setColorAt(n, d.col);
      n++;
    }
    this.debMesh.count = n;
    this.debMesh.instanceMatrix.needsUpdate = true;
    if (this.debMesh.instanceColor) this.debMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Geschosse ----------
  initProjectiles() {
    // Pfeile / Bolzen
    const am = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
    this.arrows = new THREE.InstancedMesh(arrowGeometry(), am, 512);
    // Felsbrocken (brennend: glühende Risse) und Knochen
    const rock = rockGeometry(1);
    const rm = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true });
    rm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float hot; varying float vHot;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHot = hot;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHot;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(5.0, 1.5, 0.3) * smoothstep(0.62, 0.95, vHot) * (0.7 + 0.3 * vColor.r);');
    };
    rm.customProgramCacheKey = () => 'af-fx-rock-hot';
    this.rocks = new THREE.InstancedMesh(rock, rm, 128);
    this.bones = new THREE.InstancedMesh(rockGeometry(3.7), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, flatShading: true }), 128);
    for (const m of [this.arrows, this.rocks, this.bones]) { m.frustumCulled = false; m.castShadow = true; m.setColorAt(0, _c.set(1, 1, 1)); this.root.add(m); }
  }
  /** Quelle eines Geschosses: Größe, Volksfarbe */
  projInfo(e, sim) {
    const src = sim && sim.entities.get(e.src);
    const def = src ? (src.type === 'f' ? UNITS[src.def] : src.def) : null;
    let glow = null;
    if (def) glow = def.faction ? FACTIONS[def.faction] && FACTIONS[def.faction].palette.glow : def.palette && def.palette.glow;
    const model = def && def.model, tier = (def && def.tier) || 1;
    let big = 1;
    if (e.kind === 'shell' || e.kind === 'bone') big = model === 'mortar' ? [1.05, 1.2, 1.4][tier - 1] : def && def.boss ? 1.6 : 0.8;
    else if (e.kind === 'arrow') big = model === 'walker' || model === 'ballista' || model === 'mortar' ? 1.55 : model === 'archer' ? 1 + 0.08 * (tier - 1) : 0.85;
    else big = 0.85 + 0.15 * tier + (def && def.boss ? 0.6 : 0);
    return { big, glow, tier, model, boss: !!(def && def.boss) };
  }
  updateProjectiles(sim, dt) {
    let na = 0, nr = 0, nb = 0;
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (const e of sim.entities.values()) {
      if (e.type !== 'p') continue;
      const st = PROJ[e.kind] || PROJ.magic;
      let s = this.projState.get(e.id);
      if (!s) {
        const info = this.projInfo(e, sim);
        const col = new THREE.Color(info.glow && (e.kind === 'magic' || e.kind === 'void') ? info.glow : st.color);
        s = { x: e.x, z: e.z, y: st.y0, px: e.x, py: st.y0, pz: e.z, total: Math.max(1, Math.hypot(e.tx - e.ox, e.tz - e.oz)), ...info, col, trail: [], acc: 0, ax: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), ang: Math.random() * 6, dir: new THREE.Vector3(0, 0, 1) };
        this.projState.set(e.id, s);
        if (e.kind === 'magic' || e.kind === 'void') this.flash(e.x, st.y0, e.z, { size: 1.4 * s.big, size1: 0.4, color: col, intensity: 4, life: 0.22 });
        if (e.kind === 'shell' && s.model === 'mortar') {
          this.flash(e.x, 2.2, e.z, { size: 2.2 * s.big, size1: 0.6, color: '#ffb35a', intensity: 4, life: 0.18, shape: 3, rot: Math.random() });
          this.smoke(e.x, 1.8, e.z, { n: 8, color: '#7a726a', speed: 2, up: 1.6, life: 1.4, size: 1.0 * s.big, grow: 1.6, rise: 0.8, alpha: 0.6 });
          this.emit(e.x, 2, e.z, { n: 10, color: '#ffb35a', speed: 5, up: 4, life: 0.5, size: 0.3, intensity: 4 });
        }
      }
      seen.add(e.id);
      s.px = s.x; s.py = s.y; s.pz = s.z;
      s.x += (e.x - s.x) * Math.min(1, dt * 25); s.z += (e.z - s.z) * Math.min(1, dt * 25);
      const remain = Math.hypot(e.tx - s.x, e.tz - s.z);
      const prog = 1 - Math.min(1, remain / s.total);
      s.y = st.y0 + (st.y1 - st.y0) * prog + Math.sin(prog * Math.PI) * st.arc * Math.min(s.total, 34);
      _v.set(s.x - s.px, s.y - s.py, s.z - s.pz);
      if (_v.lengthSq() > 1e-6) s.dir.copy(_v).normalize();
      // Spur-Stützpunkte
      s.trail.unshift(s.x, s.y, s.z); if (s.trail.length > 24) s.trail.length = 24;
      const tr = s.trail;
      if (e.kind === 'arrow') {
        if (na < 512) {
          _q.setFromUnitVectors(FWD, s.dir);
          const L = 1.3 * s.big;
          _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(L * 1.15, L * 1.15, L));
          this.arrows.setMatrixAt(na, _m); this.arrows.setColorAt(na, s.big > 1.3 ? _c.setRGB(0.8, 0.85, 0.95) : _c.setRGB(1, 1, 1)); na++;
        }
        for (let i = 0; i + 5 < tr.length && i < 15; i += 3) { const k = i / 15; this.streakNow(tr[i], tr[i + 1], tr[i + 2], tr[i + 3], tr[i + 4], tr[i + 5], 0.13 * s.big * (1 - k * 0.6), _c.set(st.trail), 1.6 * (1 - k), 1.6 * (1 - k - 0.2)); }
      } else if (e.kind === 'shell' || e.kind === 'bone') {
        s.ang += dt * 7;
        const R = 0.42 * s.big;
        _m.compose(_p.set(s.x, s.y, s.z), _q.setFromAxisAngle(s.ax, s.ang), _s.setScalar(R));
        if (e.kind === 'shell') {
          if (nr < 128) { this.rocks.setMatrixAt(nr, _m); this.rocks.setColorAt(nr, _c.setRGB(0.2, 0.17, 0.15)); nr++; }
          // brennend: flackernde Flamme hinter dem Brocken (Flugrichtung), Glut, dicke Rauchfahne
          const fl = 0.85 + Math.random() * 0.3;
          this.spriteNow(s.x - s.dir.x * R * 1.3, s.y - s.dir.y * R * 1.3 + R * 0.3, s.z - s.dir.z * R * 1.3, R * 2.6 * fl, C_FIRE, 1, rnd(-0.25, 0.25), 1.25);
          this.spriteNow(s.x - s.dir.x * R * 2.4, s.y - s.dir.y * R * 2.4, s.z - s.dir.z * R * 2.4, R * 2.0 * fl, C_FIRE2, 0, 0, 0.8);
          s.acc += dt * 40 * Math.min(1, 0.4 + 0.6 * this.density);
          while (s.acc >= 1) {
            s.acc -= 1;
            this.smokeP.add(s.x - s.dir.x * R * 1.5 + rnd(-0.3, 0.3) * R, s.y - s.dir.y * R * 1.5 + rnd(-0.3, 0.3) * R, s.z - s.dir.z * R * 1.5 + rnd(-0.3, 0.3) * R, rnd(-0.3, 0.3), rnd(0.2, 0.7), rnd(-0.3, 0.3), Math.random() < 0.5 ? C_SMOKE1 : C_SMOKE2, 1, rnd(1.2, 2.0), R * 2.6, 0.5, 1.2, 2.4, 0.75);
            if (Math.random() < 0.5) this.glowP.add(s.x, s.y, s.z, rnd(-1, 1), rnd(0, 1.5), rnd(-1, 1), _c.set('#ff8a2a'), 3, rnd(0.25, 0.5), 0.22 * s.big, -3, 1.5);
          }
        } else {
          if (nb < 128) { this.bones.setMatrixAt(nb, _m); this.bones.setColorAt(nb, _c.set('#e8dfc8')); nb++; }
          this.spriteNow(s.x, s.y, s.z, R * 2.6, _c.set(st.trail), 0, 0, 1.4);
          for (let i = 0; i + 5 < tr.length && i < 15; i += 3) { const k = i / 15; this.streakNow(tr[i], tr[i + 1], tr[i + 2], tr[i + 3], tr[i + 4], tr[i + 5], 0.5 * s.big * (1 - k * 0.7), _c.set(st.trail), 1.2 * (1 - k), 1.2 * (1 - k - 0.2)); }
          s.acc += dt * 16;
          while (s.acc >= 1) { s.acc -= 1; this.glowP.add(s.x, s.y, s.z, rnd(-0.5, 0.5), rnd(0, 1), rnd(-0.5, 0.5), _c.set(st.trail), 2.4, 0.6, 0.35, 0.8, 1.5); }
        }
      } else {
        // Magie: leuchtende Kugel in Volksfarbe, heller Kern, Wirbel-Funken, Leuchtspur
        const R = 0.5 * s.big, pulse = 1 + 0.12 * Math.sin(this.time * 30 + e.id);
        this.spriteNow(s.x, s.y, s.z, R * 2.6 * pulse, s.col, 0, 0, 2.6);
        this.spriteNow(s.x, s.y, s.z, R * 0.9, _c.setRGB(1, 1, 1), 0, 0, 3.5);
        for (let i = 0; i + 5 < tr.length && i < 18; i += 3) { const k = i / 18; this.streakNow(tr[i], tr[i + 1], tr[i + 2], tr[i + 3], tr[i + 4], tr[i + 5], R * 0.9 * (1 - k * 0.8), s.col, 2.4 * (1 - k), 2.4 * (1 - k - 0.17)); }
        s.acc += dt * 30;
        while (s.acc >= 1) {
          s.acc -= 1;
          const a = this.time * 14 + Math.random() * 6.28;
          this.glowP.add(s.x + Math.cos(a) * R * 0.7, s.y + Math.sin(a) * R * 0.7, s.z, Math.cos(a) * 0.8, Math.sin(a) * 0.8 + 0.3, rnd(-0.5, 0.5), s.col, 3, rnd(0.25, 0.45), 0.26 * s.big, 0, 2);
        }
      }
    }
    for (const id of this.projState.keys()) if (!seen.has(id)) this.projState.delete(id);
    for (const [m, n] of [[this.arrows, na], [this.rocks, nr], [this.bones, nb]]) {
      m.count = n; m.visible = n > 0;
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // ---------- Einschläge ----------
  impact(e) {
    const s = this.projState.get(e.id) || { big: 1, col: new THREE.Color(PROJ[e.kind]?.color || '#ffffff'), y: 1 };
    const x = e.x, z = e.z, big = s.big || 1;
    if (e.kind === 'shell') {
      const k = big;
      this.flash(x, 0.8, z, { size: 3.2 * k, size1: 1.2, color: '#ffd090', intensity: 5, life: 0.16, shape: 3, rot: Math.random() });
      this.flash(x, 0.9, z, { size: 1.5 * k, size1: 3.4 * k, color: '#ff7a22', intensity: 3.2, life: 0.38, shape: 1, vy: 1.5 });
      this.flash(x, 0.6, z, { size: 2.4 * k, size1: 2.8 * k, color: '#ff5a1a', intensity: 1.6, life: 0.55, shape: 0 });
      this.smoke(x, 0.3, z, { n: Math.round(16 * k), color: '#8a7a66', speed: 4.5 * k, up: 1.2, life: 2.0, size: 1.3 * k, grow: 2.2, rise: 0.35, drag: 3.2, spread: 0.8, alpha: 0.75 });
      this.smoke(x, 0.6, z, { n: Math.round(6 * k), color: '#4e4640', speed: 1.2, up: 2.6, life: 2.4, size: 1.0 * k, grow: 2.6, rise: 0.9, drag: 1.5, spread: 0.6, alpha: 0.7 });
      this.debris(x, 0.3, z, { n: Math.round(12 * k), speed: 6 * k, up: 7 * k, size: 0.16 * k, color: '#6a5a4a' });
      this.emit(x, 0.6, z, { n: Math.round(26 * k), color: '#ffb35a', speed: 9, up: 6, life: 0.8, size: 0.3, grav: -14, drag: 1, intensity: 4 });
      this.shock(x, z, { r: 2.4 * k, color: '#ffb36a', life: 0.45, intensity: 2.5 });
      this.decal(x, z, { r: 1.6 * k, life: 5, glow: 1, crack: 1 });
      if (big >= 1.35) this.shake(0.22);
    } else if (e.kind === 'bone') {
      this.flash(x, 0.7, z, { size: 2.2 * big, size1: 0.8, color: '#c8ff9a', intensity: 3.5, life: 0.18, shape: 3, rot: Math.random() });
      this.smoke(x, 0.3, z, { n: 9, color: '#8a8270', speed: 3.5, up: 1, life: 1.6, size: 1.1 * big, grow: 1.8, rise: 0.3, drag: 3, spread: 0.6, alpha: 0.65 });
      this.debris(x, 0.3, z, { n: 9, speed: 5, up: 6, size: 0.12, color: '#e0d6bc', life: 1.8 });
      this.emit(x, 0.6, z, { n: 18, color: '#a6ff7a', speed: 5, up: 3, life: 0.8, size: 0.4, grav: 1, intensity: 3 });
      this.shock(x, z, { r: 2 * big, color: '#a6ff7a', life: 0.4, intensity: 2 });
      this.decal(x, z, { r: 1.2 * big, life: 4, glow: 0, crack: 0.8 });
    } else if (e.kind === 'magic' || e.kind === 'void') {
      const c = s.col;
      this.flash(x, 1.2, z, { size: 0.6, size1: 2.6 * big, color: c, intensity: 4, life: 0.28 });
      this.flash(x, 1.2, z, { size: 1.8 * big, size1: 0.5, color: '#ffffff', intensity: 3, life: 0.12, shape: 3, rot: Math.random() });
      this.emit(x, 1.2, z, { n: 18, color: '#' + c.getHexString(), speed: 6, up: 2, life: 0.55, size: 0.32, grav: -2, intensity: 3.5 });
      this.shock(x, z, { r: 1.4 * big, color: '#' + c.getHexString(), life: 0.35, intensity: 2.5, y: 0.2 });
      this.decal(x, z, { r: 0.8 * big, life: 2.5, glow: 0, crack: 0, color: '#1a1830' });
    } else if (e.kind === 'arrow') {
      this.emit(x, 1.0, z, { n: 6, color: '#fff0c0', speed: 4, up: 2, life: 0.3, size: 0.2, grav: -10, intensity: 3 });
      this.smoke(x, 0.4, z, { n: 2, color: '#8a7a66', speed: 1, up: 0.5, life: 0.8, size: 0.5, grow: 1.2, rise: 0.2, alpha: 0.45 });
    }
  }
  /** Großer Bodenschlag (Anführer/Boss) */
  slam(x, z, r, color = '#ff9a5a') {
    this.flash(x, 0.8, z, { size: r * 1.6, size1: r * 0.6, color: '#fff0d0', intensity: 5, life: 0.18, shape: 3, rot: Math.random() });
    this.flash(x, 0.5, z, { size: r * 0.8, size1: r * 2.2, color, intensity: 2.2, life: 0.5 });
    this.smoke(x, 0.3, z, { n: 34, color: '#8a7a66', speed: r * 2.2, up: 1.4, life: 2.4, size: 1.8, grow: 2.4, rise: 0.3, drag: 3, spread: r * 0.5, alpha: 0.75 });
    this.debris(x, 0.3, z, { n: 26, speed: r * 2.5, up: 9, size: 0.26, color: '#6a5a4a', life: 2.6 });
    this.emit(x, 0.5, z, { n: 40, color, speed: r * 3, up: 4, life: 0.8, size: 0.4, grav: -10, intensity: 4 });
    this.shock(x, z, { r, color, life: 0.6, intensity: 4 });
    this.shock(x, z, { r: r * 1.4, color: '#ffffff', life: 0.35, intensity: 2 });
    this.decal(x, z, { r: r * 0.9, life: 7, glow: 1, crack: 1 });
    this.shake(0.55);
  }
  shake(a) { try { const app = typeof window !== 'undefined' && window.__app; if (app && app.cam && app.cam.addShake && app.mode === 'game') app.cam.addShake(a); } catch {} }

  // ---------- Zeitgesteuerte Emitter (Asche beim Auflösen, Anführer-Wirken) ----------
  updateTimed(dt) {
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const T = this.timed[i];
      T.t += dt;
      if (T.t >= T.dur) { this.timed.splice(i, 1); continue; }
      if (T.t < 0) continue;
      const a = T.t / T.dur;
      T.acc = (T.acc || 0) + dt * T.rate * Math.min(1, 0.4 + 0.6 * this.density);
      while (T.acc >= 1) {
        T.acc -= 1;
        if (T.kind === 'ash') {
          const x = T.x + rnd(-1, 1) * T.r, z = T.z + rnd(-1, 1) * T.r, y = rnd(0.15, T.h);
          if (Math.random() < 0.55) this.glowP.add(x, y, z, rnd(-0.4, 0.4), rnd(1, 2.6), rnd(-0.4, 0.4), _c.set(T.color), 3.6, rnd(0.6, 1.1), rnd(0.18, 0.34), 0.6, 1.2);
          else this.smokeP.add(x, y, z, rnd(-0.3, 0.3), rnd(0.6, 1.4), rnd(-0.3, 0.3), _c.set(Math.random() < 0.5 ? '#3a3632' : '#5a5450'), 1, rnd(1, 1.8), rnd(0.35, 0.7) * T.k, 0.5, 1.2, 1.6, 0.6 * (1 - a * 0.5));
        } else if (T.kind === 'gather') {
          // Energie strömt zum Anführer (Wirken)
          const ang = Math.random() * 6.28, rr = T.r * rnd(0.8, 1.3);
          const x = T.x + Math.cos(ang) * rr, z = T.z + Math.sin(ang) * rr, y = rnd(0.3, 2.5);
          this.glowP.add(x, y, z, (T.x - x) * 1.6, (T.h - y) * 1.2, (T.z - z) * 1.6, _c.set(T.color), 3.5, 0.55, 0.38, 0, 0);
        }
      }
      if (T.kind === 'gather') this.spriteNow(T.x, T.h, T.z, T.r * (0.4 + 0.9 * a) * (1 + 0.1 * Math.sin(this.time * 30)), _c.set(T.color), 0, 0, 1.2 + 2 * a);
    }
  }

  // ---------- Schockwellen ----------
  initWaves(cap) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float r = length(vUv-0.5)*2.0; float ring = smoothstep(0.55,0.92,r) * (1.0 - smoothstep(0.92,1.0,r)); gl_FragColor = vec4(vCol*ring, 1.0); }`,
    });
    this.waveMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.waveMesh.frustumCulled = false;
    this.waveMesh.renderOrder = 9;
    this.waveMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.waveMesh);
  }
  shock(x, z, { r = 3, color = '#ffd27a', life = 0.5, intensity = 2.5, y = 0.15 } = {}) {
    if (this.waves.length < 64) this.waves.push({ x, z, y, r, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0 });
  }
  updateWaves(dt) {
    let n = 0;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      if (w.t >= w.life) { this.waves.splice(i, 1); continue; }
      const a = w.t / w.life;
      const rr = w.r * 2 * (0.25 + 0.75 * (1 - Math.pow(1 - a, 3)));
      _m.compose(_p.set(w.x, w.y, w.z), _q.identity(), _s.set(rr, 1, rr));
      _c.copy(w.color).multiplyScalar(1 - a);
      this.waveMesh.setMatrixAt(n, _m); this.waveMesh.setColorAt(n, _c); n++;
    }
    this.waveMesh.count = n;
    this.waveMesh.instanceMatrix.needsUpdate = true;
    if (this.waveMesh.instanceColor) this.waveMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Blitzketten / Heilstrahlen ----------
  initBeams(cap) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float d = abs(vUv.x-0.5)*2.0; float a = pow(1.0-d, 3.0); gl_FragColor = vec4(vCol*a, a); }`,
    });
    this.beamMesh = new THREE.InstancedMesh(geo, mat, cap * 6);
    this.beamMesh.frustumCulled = false;
    this.beamMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.beamMesh);
  }
  beam(points, { color = '#9fdcff', life = 0.22, width = 0.35, jag = 0.6, intensity = 4 } = {}) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const steps = jag > 0 ? 3 : 1;
      let prev = a;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const p = new THREE.Vector3(
          a.x + (b.x - a.x) * t + (s < steps ? (Math.random() - 0.5) * jag : 0),
          a.y + (b.y - a.y) * t + (s < steps ? (Math.random() - 0.5) * jag : 0),
          a.z + (b.z - a.z) * t + (s < steps ? (Math.random() - 0.5) * jag : 0));
        segs.push([prev.clone(), p]);
        prev = p;
      }
    }
    if (this.beams.length < 48) this.beams.push({ segs, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0, width });
  }
  updateBeams(dt) {
    let n = 0;
    const camPos = this.camera.position;
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t >= b.life) { this.beams.splice(i, 1); continue; }
      const f = 1 - b.t / b.life;
      for (const [a, c] of b.segs) {
        if (n >= 288) break;
        const dir = _v.subVectors(c, a);
        const len = dir.length();
        dir.normalize();
        _toCam.subVectors(camPos, a).normalize();
        _side.crossVectors(dir, _toCam).normalize();
        _n.crossVectors(_side, dir);
        _m.makeBasis(_side.multiplyScalar(b.width * (0.6 + 0.4 * f)), dir.multiplyScalar(len), _n);
        _m.setPosition(a);
        this.beamMesh.setMatrixAt(n, _m);
        this.beamMesh.setColorAt(n, _c.copy(b.color).multiplyScalar(f));
        n++;
      }
    }
    this.beamMesh.count = n;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Lichtsäulen ----------
  initPillars(cap) {
    const geo = new THREE.CylinderGeometry(1, 1.4, 1, 24, 1, true);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float a = pow(1.0 - vUv.y, 2.0) * (0.6 + 0.4*sin(vUv.x*62.83)); gl_FragColor = vec4(vCol*a, a); }`,
    });
    this.pillarMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.pillarMesh.frustumCulled = false;
    this.pillarMesh.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.pillarMesh);
  }
  pillar(x, z, { color = '#ffd27a', r = 0.9, h = 7, life = 0.9, intensity = 2.5 } = {}) {
    if (this.pillars.length < 16) this.pillars.push({ x, z, r, h, color: new THREE.Color(color).multiplyScalar(intensity), life, t: 0 });
  }
  updatePillars(dt) {
    let n = 0;
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.t += dt;
      if (p.t >= p.life) { this.pillars.splice(i, 1); continue; }
      const a = p.t / p.life;
      const grow = Math.min(1, a * 5);
      _m.compose(_p.set(p.x, 0, p.z), _q.setFromAxisAngle(UP, a * 2), _s.set(p.r * (1 - a * 0.5), p.h * grow, p.r * (1 - a * 0.5)));
      this.pillarMesh.setMatrixAt(n, _m);
      this.pillarMesh.setColorAt(n, _c.copy(p.color).multiplyScalar(1 - a));
      n++;
    }
    this.pillarMesh.count = n;
    this.pillarMesh.instanceMatrix.needsUpdate = true;
    if (this.pillarMesh.instanceColor) this.pillarMesh.instanceColor.needsUpdate = true;
  }

  // ---------- Schwebende Zahlen (DOM) ----------
  text(x, y, z, str, cls = '') {
    if (!this.textLayer || this.texts.length > 60) return;
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = str;
    this.textLayer.appendChild(el);
    this.texts.push({ el, x, y, z, t: 0, life: 1.1 });
  }
  updateTexts(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.t += dt;
      if (tx.t >= tx.life) { tx.el.remove(); this.texts.splice(i, 1); continue; }
      _v.set(tx.x, tx.y + tx.t * 1.6, tx.z).project(this.camera);
      if (_v.z > 1) { tx.el.style.opacity = 0; continue; }
      const a = tx.t / tx.life;
      tx.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${a < 0.15 ? 0.6 + a * 3 : 1})`;
      tx.el.style.opacity = a > 0.7 ? (1 - a) / 0.3 : 1;
    }
  }
  clearTexts() { for (const t of this.texts) t.el.remove(); this.texts.length = 0; }

  /** Volksfarbe (Glühen) einer Einheit */
  glowOf(id, sim) {
    const e = sim && sim.entities.get(id);
    if (!e) return null;
    const def = e.type === 'f' ? UNITS[e.def] : e.def;
    if (!def) return null;
    return def.faction ? FACTIONS[def.faction] && FACTIONS[def.faction].palette.glow : def.palette && def.palette.glow;
  }

  // ---------- Ereignisse aus der Simulation ----------
  onEvent(e, sim, view, localPid) {
    const showNums = this.settings.get('damageNumbers');
    switch (e.e) {
      case 'hit': {
        const col = ATTACK_TYPES[e.atk]?.color || '#ffffff';
        this.emit(e.x, 1.1, e.z, { n: e.crit ? 14 : 4, color: col, speed: e.crit ? 6 : 4, up: 1.5, life: 0.4, size: 0.26, intensity: e.crit ? 4 : 2.4 });
        if (e.crit) { this.text(e.x, 2.2, e.z, `${e.dmg}!`, 'crit'); this.flash(e.x, 1.3, e.z, { size: 2.2, size1: 0.6, color: col, intensity: 3, life: 0.15, shape: 3, rot: Math.random() }); }
        else if (showNums) this.text(e.x, 2, e.z, `${e.dmg}`, e.eff > 1.2 ? 'eff' : e.eff < 0.8 ? 'weak' : '');
        break;
      }
      case 'attack': {
        if (e.melee) {
          // Nahkampf: Funken + Schlagspur am Ziel (Schlag-Moment = Schaden)
          const src = view && view.pos(e.id), tgt = (view && view.pos(e.tgt)) || (sim && sim.entities.get(e.tgt));
          if (!tgt) break;
          const dx = src ? src.x - tgt.x : 0, dz = src ? src.z - tgt.z : 1, l = Math.hypot(dx, dz) || 1;
          const x = tgt.x + (dx / l) * 0.45, z = tgt.z + (dz / l) * 0.45;
          const col = ATTACK_TYPES[e.atk]?.color || '#ffd27a';
          const sz = src && src.height ? Math.min(3, 0.6 + src.height * 0.55) : 1.6;
          this.flash(x, 1.2, z, { size: sz * 1.25, size1: sz * 1.5, color: col, intensity: 2.6, life: 0.2, shape: 2, rot: (e.id % 2 ? 0.6 : 2.4) + rnd(-0.4, 0.4) });
          this.flash(x, 1.2, z, { size: 1.0, size1: 0.3, color: '#ffffff', intensity: 3, life: 0.1, shape: 3, rot: Math.random() });
          const n = 7;
          for (let i = 0; i < n; i++) { const a = Math.atan2(dz, dx) + Math.PI + rnd(-1.2, 1.2), sp = rnd(3, 7); this.glowP.add(x, 1.2, z, Math.cos(a) * sp, rnd(1, 4), Math.sin(a) * sp, _c.set(i % 2 ? '#fff2c0' : col), 3.5, rnd(0.2, 0.4), 0.16, -14, 1); }
          if (e.atk === 'wucht') { this.smoke(tgt.x, 0.3, tgt.z, { n: 3, color: '#8a7a66', speed: 1.5, up: 0.5, life: 1, size: 0.8, grow: 1.4, alpha: 0.5 }); }
        } else if (e.kind === 'magic' || e.kind === 'void') {
          const src = view && view.pos(e.id);
          const g = this.glowOf(e.id, sim) || PROJ[e.kind].color;
          if (src) {
            this.flash(src.x, (src.height || 2) * 0.75, src.z, { size: 0.5, size1: 1.8, color: g, intensity: 3, life: 0.3 });
            this.emit(src.x, (src.height || 2) * 0.7, src.z, { n: 8, color: g, speed: 2.5, up: 2, life: 0.5, size: 0.3, grav: 1, intensity: 3 });
          }
        }
        break;
      }
      case 'death': {
        const big = e.boss;
        const col = e.type === 'c' ? '#ff8a4a' : '#9fdcff';
        this.emit(e.x, 1, e.z, { n: big ? 90 : 12, color: col, speed: big ? 10 : 4, up: 3, life: big ? 1.4 : 0.7, size: big ? 0.6 : 0.35, intensity: 3 });
        this.smoke(e.x, 0.3, e.z, { n: big ? 20 : 4, color: '#7a6e62', speed: big ? 4 : 1.6, up: 0.6, life: 1.6, size: big ? 2 : 0.9, grow: 1.6, rise: 0.3, alpha: 0.55 });
        this.shock(e.x, e.z, { r: big ? 8 : 1.4, color: col, life: big ? 1 : 0.4, intensity: big ? 4 : 1.5 });
        // Asche/Glut, solange die Leiche sich auflöst (Takt wie units.js: Umkippen ≈0.5 s, Auflösen bis ≈1.7 s)
        const g = e.type === 'c' ? '#ff9a3a' : (this.glowOf(e.id, sim) || '#9fdcff');
        const delay = e.delay || 0;
        this.timed.push({ kind: 'ash', x: e.x, z: e.z, r: big ? 2.5 : 0.7, h: big ? 3.5 : 1.2, k: big ? 2 : 1, color: g, t: -(0.35 + delay) * (big ? 2 : 1), dur: big ? 2.4 : 1.25, rate: big ? 140 : 48 });
        if (big) this.decal(e.x, e.z, { r: 4, life: 8, glow: 1, crack: 1 });
        break;
      }
      case 'gold':
        if (e.pid === localPid) this.text(e.x, 2.6, e.z, `+${e.amount}`, 'gold');
        break;
      case 'splash':
        this.shock(e.x, e.z, { r: e.r, color: ATTACK_TYPES[e.atk]?.color || '#ff9a5a', life: 0.4, intensity: 3 });
        this.emit(e.x, 0.6, e.z, { n: 16, color: '#ffb36a', speed: 6, up: 3, life: 0.6, size: 0.45, intensity: 3 });
        this.smoke(e.x, 0.3, e.z, { n: Math.min(14, 4 + Math.round(e.r * 2)), color: '#8a7a66', speed: e.r * 1.4, up: 0.8, life: 1.5, size: 1, grow: 1.8, rise: 0.3, alpha: 0.6 });
        break;
      case 'chain': {
        const pts = e.path.map(([x, z]) => new THREE.Vector3(x, 1.3, z));
        this.beam(pts, { color: '#8fd8ff', width: 0.45, jag: 0.7, intensity: 5 });
        for (const p of pts) this.emit(p.x, p.y, p.z, { n: 6, color: '#bfe8ff', speed: 5, up: 1, life: 0.3, size: 0.3, intensity: 4 });
        break;
      }
      case 'heal': {
        const src = view.pos(e.src), tgt = view.pos(e.tgt);
        if (src && tgt) this.beam([new THREE.Vector3(src.x, 1.6, src.z), new THREE.Vector3(tgt.x, 1.2, tgt.z)], { color: '#9cff8a', width: 0.3, jag: 0, life: 0.35, intensity: 3 });
        this.emit(e.x, 0.6, e.z, { n: 10, color: '#9cff8a', speed: 1.2, up: 3, life: 0.9, size: 0.35, grav: 1.5, intensity: 2.5 });
        break;
      }
      case 'build':
        this.pillar(e.x, e.z, { color: '#7ad7ff', r: 1, h: 6, life: 0.8 });
        this.shock(e.x, e.z, { r: 2.2, color: '#7ad7ff', life: 0.6, intensity: 3 });
        this.emit(e.x, 0.3, e.z, { n: 30, color: '#9fe8ff', speed: 4, up: 4, life: 0.9, size: 0.35, intensity: 3 });
        break;
      case 'upgrade':
        this.pillar(e.x, e.z, { color: '#ffd27a', r: 1.2, h: 10, life: 1.2, intensity: 3 });
        this.shock(e.x, e.z, { r: 3, color: '#ffd27a', life: 0.8, intensity: 3.5 });
        this.emit(e.x, 0.5, e.z, { n: 50, color: '#ffe0a0', speed: 5, up: 7, life: 1.2, size: 0.4, grav: -2, intensity: 3.5 });
        break;
      case 'sell':
        this.emit(e.x, 1, e.z, { n: 24, color: '#ffd27a', speed: 3, up: 3, life: 0.8, size: 0.3, intensity: 3 });
        break;
      case 'spawn':
        this.emit(e.x, 1, e.z, { n: e.send ? 18 : 8, color: e.send ? '#ff3a8a' : '#a06bff', speed: 3, up: 2, life: 0.6, size: 0.45, intensity: 3 });
        break;
      case 'leak':
        this.shock(e.x, e.z, { r: 3, color: '#ff2a2a', life: 0.7, intensity: 4 });
        break;
      case 'kingAttack':
        this.shock(e.x, e.z, { r: 3, color: '#ffe08a', life: 0.45, intensity: 4 });
        this.emit(e.x, 1, e.z, { n: 20, color: '#ffe08a', speed: 7, up: 3, life: 0.5, size: 0.4, intensity: 4 });
        this.flash(e.x, 1.2, e.z, { size: 2.6, size1: 3.2, color: '#ffe08a', intensity: 2.6, life: 0.22, shape: 2, rot: Math.random() * 3 });
        break;
      case 'impact':
        this.impact(e);
        break;
      case 'leaderCast': {
        if (!(e.wind > 0)) { this.pillar(e.fx ?? e.x, e.fz ?? e.z, { color: '#ff4a3a', r: 1.6, h: 9, life: 0.9, intensity: 3 }); break; }
        const g = this.glowOf(e.id, sim) || '#ff7a3a';
        const ent = sim && sim.entities.get(e.id);
        const bx = ent ? ent.x : e.fx ?? e.x, bz = ent ? ent.z : e.fz ?? e.z;
        this.timed.push({ kind: 'gather', x: bx, z: bz, r: 3.5, h: 3.2, color: g, t: 0, dur: e.wind, rate: 70 });
        this.shock(bx, bz, { r: 3, color: g, life: Math.min(1, e.wind), intensity: 2.5 });
        break;
      }
      case 'leaderImpact':
        if (e.ability === 'slam') this.slam(e.x, e.z, e.r || 4, this.glowOf(e.id, sim) || '#ff9a5a');
        else if (e.ability === 'charge') { this.smoke(e.x, 0.3, e.z, { n: 18, color: '#8a7a66', speed: 4, up: 1, life: 1.8, size: 1.4, grow: 2, rise: 0.3, alpha: 0.7 }); this.debris(e.x, 0.3, e.z, { n: 12, speed: 5, up: 6, size: 0.2 }); this.shock(e.x, e.z, { r: 3.5, color: '#ffb36a', life: 0.5, intensity: 3 }); this.shake(0.3); }
        break;
      default: break;
    }
  }

  update(sim, dt) {
    this.time += dt;
    this.sim = sim;
    const scale = window.innerHeight * 0.9;
    this.updateProjectiles(sim, dt);
    this.updateTimed(dt);
    this.glowP.update(dt, scale);
    this.smokeP.update(dt, scale);
    this.updateDebris(dt);
    this.updateSprites(dt);
    this.updateStreaks();
    this.updateDecals(dt);
    this.updateWaves(dt);
    this.updateBeams(dt);
    this.updatePillars(dt);
    this.updateTexts(dt);
  }

  clear() {
    this.glowP.n = 0; this.smokeP.n = 0; this.waves.length = 0; this.beams.length = 0; this.pillars.length = 0; this.clearTexts(); this.projState.clear();
    this.spr.length = 0; this.sprNow.length = 0; this.strNow.length = 0; this.dec.length = 0; this.deb.length = 0; this.timed.length = 0;
  }
}
