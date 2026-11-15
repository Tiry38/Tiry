// Einheiten-Darstellung: alle Kämpfer, Gegner, Könige und Arbeiter als GPU-Instanzen
// (ein Draw-Call je Modelltyp und Detailstufe), mit weicher Interpolation, Lauf-/Angriffs-Animation,
// Treffer-Aufblitzen, Teamringen und Lebensbalken.
// Draufsicht-Leistung: je Instanz Sichtbarkeitstest (Kamera-Pyramide) und Detailstufe nach Bildschirmgröße
// (LOD0 ≈ 2,6 k, LOD1 ≈ 1 k, LOD2 ≈ 0,4 k Dreiecke) – 8 Bahnen × 30 Einheiten bleiben weit unter dem Budget.
import * as THREE from 'three';
import { unitVariant, creepVariant } from './forge/variants.js';
import { fighterArch, formOf, creepModel, HOVER_ARCH, CREEP_FIT, linePalette } from './forge/roster.js';
import { forgeReady } from './forge/loader.js';
import { buildModel, DEFAULTS, createBodyMaterial, createGlowMaterial, setInstanceAnim, createUnitDepthMaterial } from './models.js';
import { UNITS, FACTIONS } from '../sim/data.js';
import { kingPos, laneCenterX, LANE_END_Z } from '../sim/layout.js';

const HOVER = HOVER_ARCH;
export const TEAM_COLORS = ['#3d8bff', '#ff4a5a'];
export const KING_PALETTES = [
  { primary: '#e9eef8', secondary: '#2b62e8', metal: '#d8b45c', glow: '#62c4ff' },
  { primary: '#2b2530', secondary: '#d0283c', metal: '#c99a52', glow: '#ff7a3a' },
];

const NO_ANIM = [0, 0, 0, 0];
let UNIT_DEPTH = null;
const _anim = [0, 0, 0, 0], _fx = [0, 0, 0, 2];
const _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

// LOD-Schwellen: projizierte Figurenhöhe in Bildpunkten
const LOD_PX = [95, 42];
const _sph = new THREE.Sphere(), _frus = new THREE.Frustum(), _pm = new THREE.Matrix4(), _cp = new THREE.Vector3();

class Pool {
  /** models: [LOD0, LOD1, LOD2] (je { body, glow, height, radius }) */
  constructor(root, models, bodyMat, glowMat, cap = 16) {
    this.root = root; this.models = models; this.model = models[0]; this.bodyMat = bodyMat; this.glowMat = glowMat;
    this.levels = models.map(() => ({ n: 0, cap: 0, body: null, glow: null }));
    this.models.forEach((m, i) => this.alloc(i, cap));
  }
  alloc(i, cap) {
    const L = this.levels[i], model = this.models[i];
    if (L.body) { this.root.remove(L.body); L.body.dispose(); }
    if (L.glow) { this.root.remove(L.glow); L.glow.dispose(); }
    L.cap = cap;
    L.body = new THREE.InstancedMesh(model.body, this.bodyMat, cap);
    L.body.castShadow = true; L.body.receiveShadow = true; L.body.frustumCulled = false;
    L.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    L.body.setColorAt(0, _c.set(1, 1, 1));
    L.body.customDepthMaterial = UNIT_DEPTH || (UNIT_DEPTH = createUnitDepthMaterial());
    L.body.count = 0; L.body.visible = false;
    this.root.add(L.body);
    if (model.glow) {
      L.glow = new THREE.InstancedMesh(model.glow, this.glowMat, cap);
      L.glow.frustumCulled = false;
      L.glow.setColorAt(0, _c.set(1, 1, 1));
      L.glow.count = 0; L.glow.visible = false;
      this.root.add(L.glow);
    } else L.glow = null;
  }
  begin() { for (const L of this.levels) L.n = 0; }
  /** anim: [Laufphase rad, Laufstärke 0..1, Angriff 0..1 (Treffer ≈0.45), Treffer-Zucken 0..1] (optional); lod: Detailstufe;
   *  fx: [Auflösen 0..1, Treffer-Blitz 0..1, Wirk-Pose 0..1, Modellhöhe] (optional) */
  push(m, color, anim, lod = 0, fx = null) {
    const i = Math.min(lod, this.levels.length - 1), L = this.levels[i];
    if (L.n >= L.cap) this.alloc(i, L.cap * 2);
    L.body.setMatrixAt(L.n, m);
    L.body.setColorAt(L.n, color);
    const A = anim || NO_ANIM;
    const F = fx || (this._fx || (this._fx = [0, 0, 0, this.model.height || 2]));
    setInstanceAnim(L.body, L.n, A[0], A[1], A[2], A[3], F);
    if (L.glow) { L.glow.setMatrixAt(L.n, m); L.glow.setColorAt(L.n, color); setInstanceAnim(L.glow, L.n, A[0], A[1], A[2], A[3], F); }
    L.n++;
  }
  end() {
    for (const L of this.levels) for (const mesh of [L.body, L.glow]) {
      if (!mesh) continue;
      mesh.count = L.n;
      mesh.visible = L.n > 0;
      if (!L.n) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  /** Dreiecke dieser Runde (für Statistik) */
  tris() { let t = 0; this.levels.forEach((L, i) => { if (!L.n) return; const m = this.models[i]; t += L.n * ((m.body.index ? m.body.index.count : m.body.attributes.position.count) + (m.glow ? (m.glow.index ? m.glow.index.count : m.glow.attributes.position.count) : 0)) / 3; }); return t; }
}

// Lebensbalken (Billboard-Pillen) als eine Instanz-Gruppe
function makeBars(cap) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: {},
    vertexShader: /* glsl */`
      attribute float aHp; attribute float aAlpha;
      varying vec2 vUv; varying float vHp; varying vec3 vCol; varying float vAlpha; varying float vW;
      void main(){
        vUv = uv; vHp = aHp; vCol = instanceColor; vAlpha = aAlpha;
        float w = length(instanceMatrix[0].xyz); vW = w;
        vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        float s = clamp(-mv.z * 0.012, 0.35, 1.4);
        mv.xy += position.xy * vec2(w, 0.2) * s;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying float vHp; varying vec3 vCol; varying float vAlpha; varying float vW;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; p.x *= vW / 0.2;
        float r = 1.0; float ex = vW / 0.2 - r;
        vec2 q = vec2(max(abs(p.x) - ex, 0.0), p.y);
        float d = length(q) - r;
        if (d > 0.0) discard;
        float edge = smoothstep(-0.35, 0.0, d);
        vec3 bg = vec3(0.02, 0.025, 0.05);
        float fill = step(vUv.x, vHp);
        vec3 c = mix(bg, vCol * (1.05 + 0.35 * (1.0 - vUv.y)), fill * (1.0 - smoothstep(-0.45, -0.1, d) * 0.0));
        c = mix(c, vec3(0.0), edge * 0.85);
        gl_FragColor = vec4(c, vAlpha * (0.92 - edge * 0.2));
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.geometry.setAttribute('aHp', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  mesh.geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  mesh.setColorAt(0, _c.set(1, 1, 1));
  return mesh;
}

// Teamringe unter den Einheiten
function makeRings(cap) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ float r = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.86, 1.0, r)); float inner = (1.0 - smoothstep(0.0, 0.9, r)) * 0.12; gl_FragColor = vec4(vCol * (ring + inner), 1.0); }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.setColorAt(0, _c.set(1, 1, 1));
  return mesh;
}

export class UnitsView {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.bodyMat = createBodyMaterial();
    this.glowMat = createGlowMaterial();
    this.models = new Map();
    this.pools = new Map();
    this.disp = new Map();
    this.dying = [];
    this.bars = makeBars(1024);
    this.rings = makeRings(1024);
    this.root.add(this.bars, this.rings);
    this.kingFx = [{ hitT: -9, atkT: -9 }, { hitT: -9, atkT: -9 }];
    this.time = 0;
    this.stats = { tris: 0, drawn: 0, culled: 0 };
    // Kamera der Hauptszene abgreifen (für Sichtbarkeitstest und Detailstufen) – unsichtbarer Späher
    this.cam = null;
    const spy = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    spy.frustumCulled = false; spy.renderOrder = -100;
    spy.onBeforeRender = (r, sc, cam) => { if (cam && cam.isPerspectiveCamera) this.cam = cam; };
    this.root.add(spy);
    // Sobald die gebackenen Figuren geladen sind: vorher entstandene Ersatzmodelle verwerfen und neu aufbauen
    forgeReady().then(() => this.rebuildFallbacks());
  }
  rebuildFallbacks() {
    for (const [key, p] of [...this.pools]) {
      if (p.model.forged) continue;
      for (const L of p.levels) for (const m of [L.body, L.glow]) if (m) { this.root.remove(m); m.dispose(); }
      this.pools.delete(key);
      for (const k of [...this.models.keys()]) if (k.startsWith(key + '#')) { const m = this.models.get(k); m.body.dispose(); if (m.glow) m.glow.dispose(); this.models.delete(k); }
    }
  }

  modelFor(key, archetype, palette, tier, variant, form, lod = 0, fit) {
    const k = key + '#' + lod;
    let m = this.models.get(k);
    if (!m) {
      m = buildModel(archetype, { ...palette, tier, seed: hashStr(key), variant, form, lod, fit });
      this.models.set(k, m);
    }
    return m;
  }
  pool(key, archetype, palette, tier, variant, form, fit) {
    let p = this.pools.get(key);
    if (!p) {
      const m0 = this.modelFor(key, archetype, palette, tier, variant, form, 0, fit);
      const models = [m0];
      if (m0.forged && m0.lods > 1) for (let l = 1; l < m0.lods; l++) models.push(this.modelFor(key, archetype, palette, tier, variant, form, l, fit));
      p = new Pool(this.root, models, this.bodyMat, this.glowMat, archetype === 'king' ? 2 : 24);
      p.hover = HOVER.has(archetype) || !!m0.hover;
      // Körperbau für Ganzkörper-Animation/Tod: Maschine (kaum Gelenke), Vierbeiner (länger als hoch)
      const rig = m0.body.attributes.aRig, bb = (m0.body.boundingBox || (m0.body.computeBoundingBox(), m0.body.boundingBox));
      let n0 = 0, nn = 0;
      if (rig) for (let i = 0; i < rig.count; i += 3) { nn++; if (Math.floor(rig.array[i * 4] + 1e-4) === 0) n0++; }
      p.machine = !rig || nn === 0 || n0 / nn > 0.3;
      p.quad = !p.machine && (bb.max.z - bb.min.z) > 0.85 * bb.max.y;
      this.pools.set(key, p);
    }
    return p;
  }
  fighterKey(def) { return { key: `f|${def.id}`, arch: fighterArch(def), form: formOf(def), pal: linePalette(def, FACTIONS[def.faction].palette), tier: def.tier, variant: unitVariant(def) }; }
  creepKey(def) {
    const id = def.key || def.id || `w${def.n}`;
    const cm = creepModel(def);
    // Bosse in ihren eigenen Farben (Wellenpaletten wiederholen sich alle 5 Wellen)
    const pal = def.boss && DEFAULTS[cm.arch] ? DEFAULTS[cm.arch] : cm.lead ? { ...def.palette, glow: '#ffd23a', metal: '#e8b84a' } : def.palette;
    return { key: `c|${id}`, arch: cm.arch, form: cm.form, pal, tier: +cm.form[0] || 1, variant: creepVariant(def), fit: CREEP_FIT[cm.arch] };
  }

  /** Vorab erzeugen, damit beim ersten Auftauchen nichts ruckelt */
  warmup(defs) { for (const d of defs) { const k = d.faction ? this.fighterKey(d) : this.creepKey(d); this.pool(k.key, k.arch, k.pal, k.tier, k.variant, k.form, k.fit); } }

  onEvent(e, sim) {
    if (e.e === 'hit') { const d = this.disp.get(e.id); if (d) d.hitT = this.time; }
    else if (e.e === 'stun') { const d = this.disp.get(e.id); if (d) d.stunT = this.time; }
    else if (e.e === 'death') {
      const d = this.disp.get(e.id);
      if (d && d.key) this.dying.push({ ...d, id: e.id, t: -(e.delay || 0), boss: e.boss, hoverY: d.hover ? 0.5 : 0 }); // delay: Treffer-Moment der Heldenanimation abwarten
      if (e.type === 'c') this.disp.delete(e.id);
    } else if (e.e === 'kingHit') this.kingFx[e.team].hitT = this.time;
    else if (e.e === 'kingAttack') { this.kingFx[e.team].atkT = this.time; this.kingFx[e.team].face = Math.atan2(e.x - kingPos(e.team).x, e.z - kingPos(e.team).z); }
    else if (e.e === 'build' || e.e === 'upgrade') { const d = this.disp.get(e.id); if (d) d.spawnT = this.time; else this.pendingSpawn = { id: e.id, t: this.time }; }
    else if (e.e === 'sell') this.disp.delete(e.id);
    else if (e.e === 'leaderCast' && e.wind > 0) { const d = this.disp.get(e.id); if (d) { d.castT = this.time; d.castDur = e.wind; d.slamT = null; } }
    else if (e.e === 'leaderImpact' || e.e === 'leaderInterrupt') { const d = this.disp.get(e.id); if (d) { d.castT = null; if (e.e === 'leaderImpact') d.slamT = this.time; } }
  }

  update(sim, dt, ctx = {}) {
    this.time += dt;
    const t = this.time;
    for (const p of this.pools.values()) p.begin();
    let nb = 0, nr = 0;
    const bars = this.bars, rings = this.rings;
    const hpA = bars.geometry.attributes.aHp.array, alA = bars.geometry.attributes.aAlpha.array;
    const k = 1 - Math.exp(-dt * 16);
    const teamCol = TEAM_COLORS.map((c) => new THREE.Color(c));
    const creepRing = new THREE.Color('#ff3a2a').multiplyScalar(0.6);
    const sendRing = new THREE.Color('#ff2a8a');
    const champRing = new THREE.Color('#ffc83a').multiplyScalar(1.6);
    const battle = sim.phase === 'battle';
    const seen = new Set();
    // Kamera: Sichtbarkeit + Detailstufe je Instanz
    // Hauptkamera bevorzugen (andere Durchgänge wie Minikarte/Arena rendern dieselbe Szene mit eigener Kamera)
    const mainCam = typeof window !== 'undefined' && window.__app && window.__app.engine && window.__app.engine.camera;
    const cam = mainCam && mainCam.isPerspectiveCamera ? mainCam : this.cam;
    let pxK = 0;
    if (cam) {
      cam.updateMatrixWorld(); _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
      _cp.setFromMatrixPosition(cam.matrixWorld);
      pxK = (typeof window !== 'undefined' ? window.innerHeight : 900) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    }
    const lodOf = (x, y, z, h) => {
      if (!cam) return 0;
      _sph.center.set(x, y + h * 0.5, z); _sph.radius = h * 0.9 + 0.8;
      if (!_frus.intersectsSphere(_sph)) return -1;
      const px = (h * pxK) / Math.max(1, _cp.distanceTo(_sph.center));
      return px > LOD_PX[0] ? 0 : px > LOD_PX[1] ? 1 : 2;
    };
    let drawn = 0, culled = 0;

    for (const e of sim.entities.values()) {
      if (e.type !== 'f' && e.type !== 'c') continue; // Helden, Geschosse, Missions-Objekte zeichnen eigene Module
      if (!e.alive) continue;
      const isF = e.type === 'f';
      const def = isF ? UNITS[e.def] : e.def;
      const kk = isF ? this.fighterKey(def) : this.creepKey(def);
      const pool = this.pool(kk.key, kk.arch, kk.pal, kk.tier, kk.variant, kk.form, kk.fit);
      seen.add(e.id);
      let d = this.disp.get(e.id);
      if (!d) {
        d = { x: e.x, z: e.z, face: e.face, hitT: -9, stunT: -9, spawnT: this.pendingSpawn && this.pendingSpawn.id === e.id ? this.pendingSpawn.t : (isF ? -9 : t), phase: (e.id * 0.37) % 6.28 };
        this.disp.set(e.id, d);
      }
      // Teleport (Rundenreset) → direkt springen
      if ((e.x - d.x) ** 2 + (e.z - d.z) ** 2 > 36) { d.x = e.x; d.z = e.z; }
      const vx = e.x - d.x, vz = e.z - d.z;
      d.x += vx * k; d.z += vz * k;
      let df = e.face - d.face; df = Math.atan2(Math.sin(df), Math.cos(df));
      d.face += df * (1 - Math.exp(-dt * 10));
      d.key = kk.key; d.arch = kk.arch; d.height = pool.model.height;

      const moving = e.moving != null && sim.tick - e.moving < 3;
      // Maßstab steckt in der Geometrie (Archetyp-Passform × Stufe); hier nur Rolle/Champion/alte Modelle
      const scaleBase = (def.size || 1) * (pool.model.forged ? 1 : isF ? 1.3 : 1.2);
      const boss = !isF && def.boss;
      const H = pool.model.height, mach = pool.machine;
      d.mach = mach; d.quad = pool.quad; d.hover = pool.hover; d.s = scaleBase; d.boss = boss;
      // Schrittfrequenz aus der tatsächlichen (angezeigten) Geschwindigkeit → keine rutschenden Füße
      const mv = Math.hypot(vx * k, vz * k) / Math.max(dt, 1e-3);
      d.spd = (d.spd || 0) + (mv - (d.spd || 0)) * (1 - Math.exp(-dt * 6));
      d.walkW = (d.walkW || 0) + ((moving ? 1 : 0) - (d.walkW || 0)) * (1 - Math.exp(-dt * 8));
      const idleRate = pool.hover ? 6.5 : boss ? 1.5 : 2.2;
      const walkRate = Math.min(13, Math.max(4, (5.4 * Math.max(d.spd, 1.2)) / Math.max(0.6, H * scaleBase)));
      d.gait = (d.gait == null ? d.phase * 7 : d.gait) + dt * (idleRate + (walkRate - idleRate) * d.walkW);
      const wW = d.walkW, g = d.gait;
      // Angriff: Ausholen vor dem nächsten Schlag (nur wenn das Ziel in Reichweite ist), Schlag-Moment = Schaden der Simulation
      const atA = sim.time - e.atkT;
      let atkP = 0;
      if (atA >= 0 && atA < 0.5) atkP = 0.45 + (atA / 0.5) * 0.55;
      else if (e.cd > 0 && e.cd < 0.4 && !(e.stun > 0) && e.target) {
        const tg = sim.entities.get(e.target);
        if (tg && tg.alive && Math.hypot(tg.x - e.x, tg.z - e.z) <= (def.range || 1) + (tg.type === 'c' && tg.def.boss ? 1.8 : 0.6) + 0.5) atkP = 0.45 * (1 - e.cd / 0.4);
      }
      // Anführer-Fähigkeit: langes Ausholen während des Wirkens, Schlag beim Einschlag
      let lead = 0;
      if (d.castT != null) {
        const ct = t - d.castT;
        if (ct < d.castDur) { lead = ct / d.castDur; atkP = 0.42 * Math.min(1, lead * 1.4); } else if (d.slamT == null || t - d.slamT > 0.6) d.castT = null;
      }
      if (d.slamT != null && t - d.slamT < 0.55) atkP = 0.45 + ((t - d.slamT) / 0.55) * 0.55;
      const caster = def.ranged && !mach && (def.atk === 'arkan' || def.atk === 'chaos');
      const raise = smooth01(0.02, 0.42, atkP) * (1 - smooth01(0.5, 0.85, atkP));
      if (def.ranged && !lead) atkP = -atkP; // Fernkampf: Spannen/Werfen statt Hieb
      const htA = t - d.hitT;
      const hitE = htA >= 0 && htA < 0.3 ? 1 - htA / 0.3 : 0;
      _anim[0] = g; _anim[1] = wW; _anim[2] = atkP; _anim[3] = hitE;
      _fx[0] = 0; _fx[1] = htA >= 0 && htA < 0.2 ? 1 - htA / 0.2 : 0; _fx[2] = caster ? Math.max(0.001, raise) : lead ? lead : 0; _fx[3] = H;
      // Ganzkörper (Matrix): Lauf-Neigung, Schwebe-Pendeln, Maschinen-Schaukeln/Rückstoß, Ausfallschritt, Zurückzucken
      let y = pool.hover ? 0.45 + Math.sin(t * 2.2 + d.phase) * 0.15 : 0;
      let lean = 0.05 * wW, roll = 0, fwd = 0, sq = 1;
      const a = Math.abs(atkP);
      const strikeE = smooth01(0.38, 0.46, a) * (1 - smooth01(0.55, 0.9, a));
      const recoil = a > 0.45 ? Math.pow(1 - (a - 0.45) / 0.55, 2) : 0;
      if (pool.hover) {
        roll = 0.07 * Math.sin(t * 1.6 + d.phase); lean += 0.16 * wW + 0.05 * Math.sin(t * 2.2 + d.phase + 1);
      } else if (mach) {
        y += Math.abs(Math.sin(g)) * 0.04 * wW + 0.006 * Math.sin(t * 38 + d.phase) * (1 - wW);
        lean += 0.035 * Math.sin(g * 2) * wW; roll = 0.025 * Math.sin(g) * wW;
      } else {
        roll = 0.022 * Math.sin(g * 0.45) * (1 - wW);
      }
      if (def.ranged) {
        const k2 = mach ? 1 : 0.4;
        fwd -= 0.32 * recoil * k2; lean -= (mach ? 0.14 : 0.05) * recoil; sq = 1 - (mach ? 0.07 : 0.02) * recoil;
        if (mach && a < 0.45) { lean += 0.05 * smooth01(0.1, 0.42, a); }
      } else {
        fwd += 0.42 * strikeE; lean += 0.12 * strikeE - 0.05 * smooth01(0.05, 0.4, a) * (1 - strikeE); sq = 1 - 0.05 * strikeE;
      }
      if (!boss) { fwd -= 0.16 * hitE * hitE; lean -= 0.08 * hitE; }
      if (boss) { sq *= 1 + Math.sin(t * 1.3 + d.phase) * 0.03; if (pool.hover) y = 0.8 + Math.sin(t * 1.1) * 0.35; }
      if (lead) { sq *= 1 + 0.06 * lead; y += Math.sin(t * 40) * 0.02 * lead; }
      const sp = t - d.spawnT;
      let grow = 1;
      if (sp >= 0 && sp < 0.5) grow = 0.3 + 0.7 * easeOutBack(sp / 0.5);
      const fx = Math.sin(d.face), fz = Math.cos(d.face);
      _p.set(d.x + fx * fwd, y, d.z + fz * fwd);
      _e.set(lean, d.face, roll, 'YXZ');
      _q.setFromEuler(_e);
      const s = scaleBase * grow;
      _s.set(s * (2 - sq), s * sq, s * (2 - sq));
      _m.compose(_p, _q, _s);
      // Farbe: Betäubung, Verlangsamung, Fluch (Treffer-Blitz macht der Shader)
      _c.setRGB(1, 1, 1);
      if (t - d.stunT < 0.8) _c.setRGB(0.7, 0.85, 1.6);
      if (e.slowPct > 0) _c.multiply(new THREE.Color(0.75, 0.9, 1.25));
      if (e.cursePct > 0) _c.multiply(new THREE.Color(1.2, 0.7, 1.3));
      const lod = lodOf(d.x, y, d.z, pool.model.height * s);
      if (lod >= 0) { pool.push(_m, _c, _anim, lod, _fx); drawn++; } else culled++;

      // Ring
      const ringCol = isF ? teamCol[e.team] : def.champion ? champRing : e.isSend ? sendRing : creepRing;
      const rr = (pool.model.radius || 0.7) * (pool.model.forged ? 2.1 : 2.4) * scaleBase;
      const sel = ctx.selectedId === e.id, hov = ctx.hoverId === e.id;
      _m.compose(_p.set(d.x, 0.06, d.z), _q.identity(), _s.set(rr, 1, rr));
      _c.copy(ringCol).multiplyScalar(sel ? 2.2 : hov ? 1.5 : isF ? 0.8 : 0.55);
      if (nr < 1024) { rings.setMatrixAt(nr, _m); rings.setColorAt(nr, _c); nr++; }
      // Boss-Aura: zweiter, pulsierender Ring
      if (boss && nr < 1024) {
        const pu = 0.5 + 0.5 * Math.sin(t * 2.2);
        _m.compose(_p.set(d.x, 0.07, d.z), _q.identity(), _s.set(rr * (1.5 + 0.25 * pu), 1, rr * (1.5 + 0.25 * pu)));
        _c.set(def.palette && def.palette.glow || '#ff6a2a').multiplyScalar(0.9 + 0.8 * pu);
        rings.setMatrixAt(nr, _m); rings.setColorAt(nr, _c); nr++;
      }

      // Lebensbalken
      const ratio = e.hp / e.maxHp;
      if (((battle && (ratio < 0.999 || sel)) || sel || hov) && !(ctx.hideCreepBars && !isF)) {
        if (nb < 1024) {
          const w = (def.boss ? 3.2 : 1.1) * Math.min(1.6, scaleBase);
          _m.compose(_p.set(d.x, y + pool.model.height * s + 0.55, d.z), _q.identity(), _s.set(w, 1, 1));
          bars.setMatrixAt(nb, _m);
          _c.copy(isF ? (e.owner === ctx.localPid ? new THREE.Color('#5dff8a') : teamCol[e.team]) : new THREE.Color('#ff4a3a'));
          bars.setColorAt(nb, _c);
          hpA[nb] = ratio; alA[nb] = 1;
          nb++;
        }
      }
    }

    // Sterbende Einheiten: Umkippen (Zweibeiner nach hinten, Vierbeiner auf die Seite, Flieger stürzen, Maschinen
    // sacken vornüber), danach Auflösen mit glühender Kante (Asche-Partikel kommen aus fx.js)
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const dd = this.dying[i];
      dd.t += dt;
      const fallT = dd.boss ? 1.1 : 0.5, dur = dd.boss ? 3.2 : 1.75;
      if (dd.t > dur) { this.dying.splice(i, 1); continue; }
      const pool = this.pools.get(dd.key);
      if (!pool) continue;
      const tt = Math.max(0, dd.t);
      const f = Math.min(1, tt / fallT);
      const bounce = f >= 1 ? Math.exp(-(tt - fallT) * 9) * Math.sin((tt - fallT) * 22) * 0.06 : 0;
      const fall = f * f + bounce;
      const H = dd.height || 2, s = dd.s || 1, r = H * 0.22;
      const dis = smooth01(fallT * 0.75, dur - 0.1, tt);
      let y = 0, pitch = 0, rollA = 0, pz = 0, px = 0;
      if (dd.hover) { y = Math.max(0, (dd.hoverY ?? 0.5) * (1 - f * f)); pitch = 0.5 * f; rollA = 0.9 * fall * (dd.id % 2 ? 1 : -1); px = 0; }
      else if (dd.mach) { pitch = 0.22 * fall; rollA = 0.12 * fall; pz = r; y = -0.08 * H * dis; }
      else if (dd.quad) { rollA = 1.35 * fall * (dd.id % 2 ? 1 : -1); px = (dd.id % 2 ? -1 : 1) * r * 1.2; }
      else { pitch = -1.42 * fall; pz = -r * 0.9; }
      y -= dis * dis * 0.25 * H;
      _e.set(0, dd.face, 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(dd.x, y, dd.z), _q, _s.setScalar(s));
      _m2.makeTranslation(px, 0, pz);
      _m3.makeRotationFromEuler(_e.set(pitch, 0, rollA, 'XYZ')); _m2.multiply(_m3);
      _m3.makeTranslation(-px, 0, -pz); _m2.multiply(_m3);
      _m.multiply(_m2);
      const ht = tt / 0.3;
      _anim[0] = dd.gait || 0; _anim[1] = 0; _anim[2] = 0; _anim[3] = dd.t < 0 ? 0 : Math.max(0, 0.95 * (1 - ht));
      _fx[0] = dd.t < 0 ? 0 : dis; _fx[1] = dd.t < 0 ? 0 : Math.max(0, 1 - tt / 0.25) * 0.8; _fx[2] = 0; _fx[3] = H;
      const dl = lodOf(dd.x, 0, dd.z, H * s);
      if (dl >= 0) pool.push(_m, _c.setRGB(1, 1, 1), _anim, dl, _fx);
    }

    // Könige
    for (let team = 0; team < 2; team++) {
      const king = sim.teams[team].king;
      const kp = kingPos(team);
      const citadel = king.citadel;
      const pool = citadel ? this.pool('citadel', 'boss_lord', { primary: '#2a1430', secondary: '#ff2a5a', metal: '#6a5a7a', glow: '#ff3a8a' }, 3, null, '1') : this.pool(`king|${team}`, 'king', KING_PALETTES[team], 3, null, '1');
      const fx = this.kingFx[team];
      const at = t - fx.atkT;
      let lean = 0;
      if (at < 0.4) lean = Math.sin((at / 0.4) * Math.PI) * 0.12;
      const face = fx.face != null && at < 3 ? fx.face : team === 0 ? 0.5 : -0.5;
      fx.cf = fx.cf == null ? face : fx.cf + (Math.atan2(Math.sin(face - fx.cf), Math.cos(face - fx.cf))) * (1 - Math.exp(-dt * 4));
      _e.set(lean, fx.cf + Math.PI, 0, 'YXZ');
      _q.setFromEuler(_e);
      const br = 1 + Math.sin(t * 1.4 + team) * 0.01;
      const ks = citadel ? 1.6 : 1;
      _m.compose(_p.set(kp.x, king.alive ? 0 : -3, kp.z), _q, _s.set(ks, br * ks, ks));
      const ht = t - fx.hitT;
      _c.setScalar(1);
      _anim[0] = t * 2 + team * 2.7; _anim[1] = 0; _anim[2] = at >= 0 && at < 0.5 ? 0.45 + (at / 0.5) * 0.55 : 0; _anim[3] = ht < 0.3 ? 0.6 * (1 - ht / 0.3) : 0;
      _fx[0] = 0; _fx[1] = ht < 0.18 ? 0.8 * (1 - ht / 0.18) : 0; _fx[2] = 0; _fx[3] = pool.model.height;
      const kl = lodOf(kp.x, 0, kp.z, pool.model.height * ks);
      if (kl >= 0) pool.push(_m, _c, _anim, kl, _fx);
      if (nb < 1024) {
        _m.compose(_p.set(kp.x, pool.model.height * ks + 1.6, kp.z), _q.identity(), _s.set(5, 1, 1));
        bars.setMatrixAt(nb, _m); bars.setColorAt(nb, _c.set(TEAM_COLORS[team]));
        hpA[nb] = king.hp / king.maxHp; alA[nb] = 1; nb++;
      }
    }

    // Arbeiter: schwebende Funken über dem hinteren Bahnende
    const wp = this.pool('worker', 'worker', { primary: '#ffffff', secondary: '#a0e8ff', metal: '#d0d8ff', glow: '#7ae8ff' }, 1, null, '1');
    for (const p of sim.players) {
      const lx = laneCenterX(p.team, p.slot);
      const n = Math.min(p.workers, 16);
      for (let i = 0; i < n; i++) {
        const a = t * 0.7 + (i / n) * Math.PI * 2 + p.id;
        _m.compose(_p.set(lx + Math.cos(a) * 3.2, 4.2 + Math.sin(t * 2 + i) * 0.4, LANE_END_Z - 4 + Math.sin(a) * 1.6), _q.identity(), _s.setScalar(0.8));
        const wl = lodOf(_p.x, _p.y - 0.5, _p.z, 1);
        if (wl >= 0) wp.push(_m, _c.setScalar(1), null, Math.max(1, wl));
      }
    }

    for (const p of this.pools.values()) p.end();
    this.stats.drawn = drawn; this.stats.culled = culled;
    if (sim.tick % 30 === 0) { let tr = 0; for (const p of this.pools.values()) tr += p.tris(); this.stats.tris = Math.round(tr); }
    rings.count = nr; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    bars.count = nb; bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    bars.geometry.attributes.aHp.needsUpdate = true; bars.geometry.attributes.aAlpha.needsUpdate = true;

    if (sim.tick % 40 === 0) for (const id of this.disp.keys()) if (!seen.has(id)) this.disp.delete(id);
  }

  /** Anzeigeposition einer Einheit (für Effekte) */
  pos(id) { return this.disp.get(id); }

  clear() {
    this.disp.clear(); this.dying.length = 0;
  }
}

function smooth01(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
