// Einheiten-Darstellung: alle Kämpfer, Gegner, Könige und Arbeiter als GPU-Instanzen
// (ein Draw-Call je Modelltyp), mit weicher Interpolation, Lauf-/Angriffs-Animation,
// Treffer-Aufblitzen, Teamringen und Lebensbalken.
import * as THREE from 'three';
import { buildModel, createBodyMaterial, createGlowMaterial, setInstanceAnim, createUnitDepthMaterial } from './models.js';
import { UNITS, FACTIONS } from '../sim/data.js';
import { kingPos, laneCenterX, LANE_END_Z } from '../sim/layout.js';

const HOVER = new Set(['griffin', 'imp', 'core', 'shade', 'boss_drake', 'worker']);
export const TEAM_COLORS = ['#3d8bff', '#ff4a5a'];
export const KING_PALETTES = [
  { primary: '#e9eef8', secondary: '#2b62e8', metal: '#d8b45c', glow: '#62c4ff' },
  { primary: '#2b2530', secondary: '#d0283c', metal: '#c99a52', glow: '#ff7a3a' },
];

const NO_ANIM = [0, 0, 0, 0];
let UNIT_DEPTH = null;
const _anim = [0, 0, 0, 0];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

class Pool {
  constructor(root, model, bodyMat, glowMat, cap = 16) {
    this.root = root; this.model = model; this.bodyMat = bodyMat; this.glowMat = glowMat;
    this.n = 0;
    this.alloc(cap);
  }
  alloc(cap) {
    if (this.body) { this.root.remove(this.body); this.body.dispose(); }
    if (this.glow) { this.root.remove(this.glow); this.glow.dispose(); }
    this.cap = cap;
    this.body = new THREE.InstancedMesh(this.model.body, this.bodyMat, cap);
    this.body.castShadow = true; this.body.receiveShadow = true; this.body.frustumCulled = false;
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.setColorAt(0, _c.set(1, 1, 1));
    this.body.customDepthMaterial = UNIT_DEPTH || (UNIT_DEPTH = createUnitDepthMaterial());
    this.root.add(this.body);
    if (this.model.glow) {
      this.glow = new THREE.InstancedMesh(this.model.glow, this.glowMat, cap);
      this.glow.frustumCulled = false;
      this.glow.setColorAt(0, _c.set(1, 1, 1));
      this.root.add(this.glow);
    } else this.glow = null;
  }
  begin() { this.n = 0; }
  /** anim: [Laufphase rad, Laufstärke 0..1, Angriff 0..1 (Treffer ≈0.45), Treffer-Zucken 0..1] (optional) */
  push(m, color, anim) {
    if (this.n >= this.cap) { this.alloc(this.cap * 2); }
    this.body.setMatrixAt(this.n, m);
    this.body.setColorAt(this.n, color);
    const A = anim || NO_ANIM;
    setInstanceAnim(this.body, this.n, A[0], A[1], A[2], A[3]);
    if (this.glow) { this.glow.setMatrixAt(this.n, m); this.glow.setColorAt(this.n, color); setInstanceAnim(this.glow, this.n, A[0], A[1], A[2], A[3]); }
    this.n++;
  }
  end() {
    for (const mesh of [this.body, this.glow]) {
      if (!mesh) continue;
      mesh.count = this.n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
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
  }

  modelFor(key, archetype, palette, tier) {
    let m = this.models.get(key);
    if (!m) {
      m = buildModel(archetype, { ...palette, tier, seed: hashStr(key) });
      this.models.set(key, m);
    }
    return m;
  }
  pool(key, archetype, palette, tier) {
    let p = this.pools.get(key);
    if (!p) {
      const model = this.modelFor(key, archetype, palette, tier);
      p = new Pool(this.root, model, this.bodyMat, this.glowMat, archetype === 'king' ? 2 : 24);
      this.pools.set(key, p);
    }
    return p;
  }
  fighterKey(def) { return { key: `f|${def.id}`, arch: def.model, pal: FACTIONS[def.faction].palette, tier: def.tier }; }
  creepKey(def) {
    const id = def.key || def.id || `w${def.n}`;
    const pal = def.champion ? { ...def.palette, glow: '#ffd23a', metal: '#e8b84a' } : def.palette;
    return { key: `c|${id}`, arch: def.model, pal, tier: def.boss || def.champion ? 3 : def.id ? 2 : 1 + (def.n > 10 ? 1 : 0) + (def.n > 20 ? 1 : 0) };
  }

  /** Vorab erzeugen, damit beim ersten Auftauchen nichts ruckelt */
  warmup(defs) { for (const d of defs) { const k = d.faction ? this.fighterKey(d) : this.creepKey(d); this.pool(k.key, k.arch, k.pal, k.tier); } }

  onEvent(e, sim) {
    if (e.e === 'hit') { const d = this.disp.get(e.id); if (d) d.hitT = this.time; }
    else if (e.e === 'stun') { const d = this.disp.get(e.id); if (d) d.stunT = this.time; }
    else if (e.e === 'death') {
      const d = this.disp.get(e.id);
      if (d && d.key) this.dying.push({ ...d, t: -(e.delay || 0), boss: e.boss }); // delay: Treffer-Moment der Heldenanimation abwarten
      if (e.type === 'c') this.disp.delete(e.id);
    } else if (e.e === 'kingHit') this.kingFx[e.team].hitT = this.time;
    else if (e.e === 'kingAttack') { this.kingFx[e.team].atkT = this.time; this.kingFx[e.team].face = Math.atan2(e.x - kingPos(e.team).x, e.z - kingPos(e.team).z); }
    else if (e.e === 'build' || e.e === 'upgrade') { const d = this.disp.get(e.id); if (d) d.spawnT = this.time; else this.pendingSpawn = { id: e.id, t: this.time }; }
    else if (e.e === 'sell') this.disp.delete(e.id);
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

    for (const e of sim.entities.values()) {
      if (e.type !== 'f' && e.type !== 'c') continue; // Helden, Geschosse, Missions-Objekte zeichnen eigene Module
      if (!e.alive) continue;
      const isF = e.type === 'f';
      const def = isF ? UNITS[e.def] : e.def;
      const kk = isF ? this.fighterKey(def) : this.creepKey(def);
      const pool = this.pool(kk.key, kk.arch, kk.pal, kk.tier);
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
      const scaleBase = (def.size || 1) * (isF ? 1.3 : 1.2);
      let y = HOVER.has(kk.arch) ? 0.55 + Math.sin(t * 2.2 + d.phase) * 0.15 : 0;
      let lean = 0, fwd = 0, sq = 1;
      if (moving) {
        const cyc = t * 9 + d.phase;
        y += Math.abs(Math.sin(cyc)) * 0.12;
        lean = 0.1;
      } else {
        sq = 1 + Math.sin(t * 2 + d.phase) * 0.015;
      }
      // Vertex-Animation: Laufphase, Laufstärke, Angriffs-Fortschritt (Ausholen vor dem nächsten Schlag), Treffer
      d.walkW = (d.walkW || 0) + ((moving ? 1 : 0) - (d.walkW || 0)) * (1 - Math.exp(-dt * 8));
      d.gait = (d.gait || d.phase) + dt * (moving ? 9 : 2.2);
      const atA = sim.time - e.atkT, cdA = def.cd || 1.2;
      let atkP = 0;
      if (atA >= 0 && atA < 0.45) atkP = 0.45 + (atA / 0.45) * 0.55;          // Schlag ist erfolgt → Nachschwung
      else if (atA >= 0 && atA < cdA * 1.6 && cdA - atA < 0.32 && cdA - atA > 0) atkP = 0.45 * (1 - (cdA - atA) / 0.32); // Ausholen vor dem nächsten Schlag
      if (def.ranged) atkP *= 0.7;
      const htA = t - d.hitT;
      _anim[0] = d.gait; _anim[1] = d.walkW; _anim[2] = atkP; _anim[3] = htA >= 0 && htA < 0.3 ? 1 - htA / 0.3 : 0;
      const at = sim.time - e.atkT;
      if (at >= 0 && at < 0.35) {
        const a = Math.sin((at / 0.35) * Math.PI);
        if (def.ranged) { fwd = -0.18 * a; lean -= 0.08 * a; } else { fwd = 0.4 * a; lean += 0.22 * a; sq = 1 - 0.06 * a; }
      }
      const sp = t - d.spawnT;
      let grow = 1;
      if (sp >= 0 && sp < 0.5) grow = 0.3 + 0.7 * easeOutBack(sp / 0.5);
      const fx = Math.sin(d.face), fz = Math.cos(d.face);
      _p.set(d.x + fx * fwd, y, d.z + fz * fwd);
      _e.set(lean, d.face, 0, 'YXZ');
      _q.setFromEuler(_e);
      const s = scaleBase * grow;
      _s.set(s * (2 - sq), s * sq, s * (2 - sq));
      _m.compose(_p, _q, _s);
      // Farbe: Treffer-Blitz, Betäubung, frisch gebaut (Bauphase leicht leuchtend)
      const ht = t - d.hitT;
      _c.setRGB(1, 1, 1);
      if (ht < 0.12) _c.setScalar(1 + 2.2 * (1 - ht / 0.12));
      if (t - d.stunT < 0.8) _c.setRGB(0.7, 0.85, 1.6);
      if (e.slowPct > 0) _c.multiply(new THREE.Color(0.75, 0.9, 1.25));
      if (e.cursePct > 0) _c.multiply(new THREE.Color(1.2, 0.7, 1.3));
      pool.push(_m, _c, _anim);

      // Ring
      const ringCol = isF ? teamCol[e.team] : def.champion ? champRing : e.isSend ? sendRing : creepRing;
      const rr = (pool.model.radius || 0.7) * 2.4 * scaleBase;
      const sel = ctx.selectedId === e.id, hov = ctx.hoverId === e.id;
      _m.compose(_p.set(d.x, 0.06, d.z), _q.identity(), _s.set(rr, 1, rr));
      _c.copy(ringCol).multiplyScalar(sel ? 2.2 : hov ? 1.5 : isF ? 0.8 : 0.55);
      if (nr < 1024) { rings.setMatrixAt(nr, _m); rings.setColorAt(nr, _c); nr++; }

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

    // Sterbende Einheiten versinken
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const dd = this.dying[i];
      dd.t += dt;
      const dur = dd.boss ? 1.6 : 0.55;
      if (dd.t > dur) { this.dying.splice(i, 1); continue; }
      const pool = this.pools.get(dd.key);
      if (!pool) continue;
      const a = Math.max(0, dd.t / dur);
      _e.set(0.6 * a, dd.face, 0.3 * a, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(dd.x, -a * a * (dd.height || 2) * 0.9, dd.z), _q, _s.setScalar(1 - 0.4 * a));
      _anim[0] = dd.gait || 0; _anim[1] = 0; _anim[2] = 0; _anim[3] = dd.t < 0 ? 0 : 0.95 * (1 - a);
      pool.push(_m, dd.t < 0 ? _c.setRGB(1, 1, 1) : _c.setRGB(1 + 1.5 * (1 - a), 0.7, 0.7), _anim);
    }

    // Könige
    for (let team = 0; team < 2; team++) {
      const king = sim.teams[team].king;
      const kp = kingPos(team);
      const citadel = king.citadel;
      const pool = citadel ? this.pool('citadel', 'boss_lord', { primary: '#2a1430', secondary: '#ff2a5a', metal: '#6a5a7a', glow: '#ff3a8a' }, 3) : this.pool(`king|${team}`, 'king', KING_PALETTES[team], 3);
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
      _c.setScalar(ht < 0.15 ? 1 + 1.6 * (1 - ht / 0.15) : 1);
      pool.push(_m, _c);
      if (nb < 1024) {
        _m.compose(_p.set(kp.x, pool.model.height * ks + 1.6, kp.z), _q.identity(), _s.set(5, 1, 1));
        bars.setMatrixAt(nb, _m); bars.setColorAt(nb, _c.set(TEAM_COLORS[team]));
        hpA[nb] = king.hp / king.maxHp; alA[nb] = 1; nb++;
      }
    }

    // Arbeiter: schwebende Funken über dem hinteren Bahnende
    const wp = this.pool('worker', 'worker', { primary: '#ffffff', secondary: '#a0e8ff', metal: '#d0d8ff', glow: '#7ae8ff' }, 1);
    for (const p of sim.players) {
      const lx = laneCenterX(p.team, p.slot);
      const n = Math.min(p.workers, 16);
      for (let i = 0; i < n; i++) {
        const a = t * 0.7 + (i / n) * Math.PI * 2 + p.id;
        _m.compose(_p.set(lx + Math.cos(a) * 3.2, 4.2 + Math.sin(t * 2 + i) * 0.4, LANE_END_Z - 4 + Math.sin(a) * 1.6), _q.identity(), _s.setScalar(0.8));
        wp.push(_m, _c.setScalar(1));
      }
    }

    for (const p of this.pools.values()) p.end();
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

function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
