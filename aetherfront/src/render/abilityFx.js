// Fähigkeits-Effekte der Helden – die eindrucksvollsten Effekte des Spiels.
// Baut auf render/fx.js auf (Partikel, Schockwellen, Strahlen, Lichtsäulen) und ergänzt:
//   • Siegel: Boden-Decals (Bodenzonen mit drehenden Runen, Aufladekreise für Meteor/Orbitalschlag,
//     Zielkreis beim Platzieren, Heldenring unter dem eigenen Helden)
//   • Himmelsschläge: Meteor (Feuerball mit Schweif) und Orbitalstrahl, die zum Einschlag fallen.
import * as THREE from 'three';
import { HEROES } from '../sim/heroes.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- Siegel (instanzierte Boden-Decals)
export const SIGIL = { zone: 0, charge: 1, reticle: 2, hero: 3, ally: 4 };

function makeSigils(cap) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  geo.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec4 aP; varying vec2 vUv; varying vec3 vCol; varying vec4 vP;
      void main(){ vUv = uv; vCol = instanceColor; vP = aP; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv; varying vec3 vCol; varying vec4 vP;
      // vP.x = Stil, vP.y = Fortschritt 0..1, vP.z = Phase, vP.w = Stärke
      float ring(float r, float c, float w){ return smoothstep(c - w, c, r) * (1.0 - smoothstep(c, c + w, r)); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x); float t = uTime + vP.z; float st = vP.x; float k = 0.0;
        if (st < 0.5) {            // Bodenzone: äußerer Ring, drehende Runenbänder, pulsierende Füllung
          float runes = step(0.5, fract(a * 4.7746 + t * 0.35)) * ring(r, 0.82, 0.05);
          float runes2 = step(0.65, fract(-a * 7.639 + t * 0.6)) * ring(r, 0.62, 0.025);
          float spokes = pow(abs(sin(a * 6.0 + t * 0.8)), 24.0) * smoothstep(0.2, 0.8, r) * (1.0 - smoothstep(0.8, 0.95, r));
          k = ring(r, 0.96, 0.04) * 1.6 + runes * 0.9 + runes2 * 0.8 + spokes * 0.5 + (0.12 + 0.06 * sin(t * 4.0)) * (1.0 - r * 0.6);
        } else if (st < 1.5) {     // Aufladen (verzögerter Einschlag): Füllung wächst, Ring blinkt schneller
          float prog = vP.y;
          float blink = 0.6 + 0.4 * sin(t * (6.0 + prog * 18.0));
          k = ring(r, 0.96, 0.05) * 2.0 * blink + smoothstep(prog + 0.02, prog - 0.02, r) * 0.35 + ring(r, prog, 0.04) * 1.6
            + step(0.5, fract(a * 3.183 - t * 0.9)) * ring(r, 0.75, 0.03) * 0.8;
        } else if (st < 2.5) {     // Zielkreis: gestrichelter Ring + Fadenkreuz
          float dash = step(0.45, fract(a * 9.549 + t * 0.4));
          k = ring(r, 0.95, 0.045) * (0.6 + 0.9 * dash) + 0.10 * (1.0 - r) + ring(r, 0.08, 0.05) * 1.2
            + (1.0 - smoothstep(0.0, 0.03, abs(p.x))) * step(r, 0.35) * step(0.15, r) * 0.6
            + (1.0 - smoothstep(0.0, 0.03, abs(p.y))) * step(r, 0.35) * step(0.15, r) * 0.6;
        } else {                   // Heldenring: Doppelring + weiches Leuchten + kreisende Funken
          float orbit = pow(max(0.0, cos(a - t * 1.6)), 30.0) * ring(r, 0.86, 0.06);
          float orbit2 = pow(max(0.0, cos(a + t * 1.1 + 2.0)), 30.0) * ring(r, 0.7, 0.05);
          k = ring(r, 0.86, 0.035) * 1.1 + ring(r, 0.7, 0.02) * 0.6 + (1.0 - smoothstep(0.0, 0.9, r)) * 0.22 + orbit * 2.2 + orbit2 * 1.6;
          if (st > 3.5) k *= 0.55;
        }
        gl_FragColor = vec4(vCol * k * vP.w, 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.setColorAt(0, _c.set(1, 1, 1));
  mesh.count = 0;
  return mesh;
}

// ---------------------------------------------------------------- Himmelsschläge
function makeOrb() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(core, shell);
  g.userData = { core, shell };
  g.visible = false;
  return g;
}
function makeBeam() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uK; uniform float uTime; varying vec2 vUv;
      void main(){ float edge = pow(abs(sin(vUv.x * 3.14159)), 0.6); float flow = 0.7 + 0.3 * sin(vUv.y * 40.0 - uTime * 30.0); gl_FragColor = vec4(uCol * uK * edge * flow * (0.4 + 0.6 * vUv.y), 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

export class AbilityFx {
  constructor(scene, fx, settings) {
    this.fx = fx;
    this.settings = settings;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.sigils = makeSigils(64);
    this.root.add(this.sigils);
    this.time = 0;
    this.strikes = [];
    this.orbs = [makeOrb(), makeOrb(), makeOrb(), makeOrb()];
    this.beams = [makeBeam(), makeBeam(), makeBeam()];
    for (const o of this.orbs) this.root.add(o);
    for (const b of this.beams) this.root.add(b);
    this.reticle = null;
    this.ns = 0;
    this.shake = null; // fn(amount) – Kamerawackeln
    this.channels = new Map(); // Helden-ID → { t, kind, color }
  }

  // ------------------------------------------------------------ Siegel
  pushSigil(x, z, r, style, color, prog = 0, phase = 0, k = 1) {
    if (this.ns >= 64) return;
    const i = this.ns++;
    _m.compose(_p.set(x, 0.07 + i * 0.0015, z), _q.identity(), _s.set(r * 2, 1, r * 2));
    this.sigils.setMatrixAt(i, _m);
    this.sigils.setColorAt(i, _c.set(color));
    const a = this.sigils.geometry.attributes.aP.array;
    a[i * 4] = style; a[i * 4 + 1] = prog; a[i * 4 + 2] = phase; a[i * 4 + 3] = k;
  }
  setReticle(r) { this.reticle = r; } // { x, z, r, ok }

  // ------------------------------------------------------------ Ereignisse
  colorOf(sim, heroEnt) {
    const h = heroEnt && sim.entities.get(heroEnt);
    const def = h && HEROES[h.heroId];
    return def ? def.palette.glow : '#9fdcff';
  }

  /** e: Sim-Ereignis · sim · posOf(id) → {x,y,z} (Anzeigeposition) · ctx { localPid, rigTop(id) } */
  onEvent(e, sim, posOf) {
    const fx = this.fx;
    switch (e.e) {
      case 'heroAbility': this.ability(e, sim, posOf); break;
      case 'heroCast': {
        const h = sim.entities.get(e.id);
        if (!h) break;
        const col = this.colorOf(sim, e.id);
        this.channels.set(e.id, { t: 0, total: e.total, channel: e.channel, color: col, slot: e.slot });
        const p = posOf(e.id) || h;
        fx.shock(p.x, p.z, { r: 1.6, color: col, life: 0.5, intensity: 2.5 });
        break;
      }
      case 'castCancel': this.channels.delete(e.id); break;
      case 'zoneTick': {
        const col = e.heal ? '#9cff8a' : e.big ? '#ffb05a' : '#ffd9a0';
        if (e.big) {
          // verzögerter Großeinschlag (Meteor / Orbitalschlag)
          fx.shock(e.x, e.z, { r: e.r * 1.2, color: '#ffffff', life: 0.35, intensity: 6 });
          fx.shock(e.x, e.z, { r: e.r, color: '#ff8a3a', life: 0.9, intensity: 5 });
          fx.shock(e.x, e.z, { r: e.r * 0.6, color: '#ffd27a', life: 1.3, intensity: 4 });
          fx.pillar(e.x, e.z, { color: '#ffb36a', r: e.r * 0.5, h: 18, life: 0.8, intensity: 4 });
          fx.emit(e.x, 0.6, e.z, { n: 120, color: '#ffb36a', speed: 16, up: 9, life: 1.3, size: 0.6, intensity: 4.5, grav: -12 });
          fx.emit(e.x, 0.5, e.z, { n: 50, color: '#3a2a2a', speed: 7, up: 4, life: 2.2, size: 1.4, grav: 1, intensity: 0.5, drag: 1.2 });
          fx.emit(e.x, 0.3, e.z, { n: 40, color: '#fff2c8', speed: 22, up: 1, life: 0.5, size: 0.3, intensity: 6, grav: 0, drag: 3 });
          this.shake?.(0.9, e.x, e.z);
        } else {
          fx.shock(e.x, e.z, { r: e.r, color: col, life: 0.55, intensity: 2.4 });
          // fallende Funken / Pfeile im Gebiet
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * e.r;
            const x = e.x + Math.cos(a) * rr, z = e.z + Math.sin(a) * rr;
            if (e.heal) fx.emitVel(x, 0.2, z, 0, 3 + Math.random() * 2, 0, { color: col, life: 0.8, size: 0.32, intensity: 3, drag: 1 });
            else fx.emitVel(x + 0.6, 7 + Math.random() * 3, z - 0.4, -2, -26, 1.4, { color: col, life: 0.3, size: 0.22, intensity: 4 });
          }
          if (!e.heal) fx.emit(e.x, 0.4, e.z, { n: 18, color: col, speed: 5, up: 2, life: 0.5, size: 0.3, intensity: 3 });
        }
        break;
      }
      case 'heroBlink': {
        const col = this.colorOf(sim, e.id);
        this.implode(e.fx, e.fz, col);
        fx.beam([new THREE.Vector3(e.fx, 1.2, e.fz), new THREE.Vector3(e.x, 1.2, e.z)], { color: col, width: 0.7, jag: 0.3, life: 0.35, intensity: 5 });
        fx.shock(e.x, e.z, { r: 2.6, color: col, life: 0.5, intensity: 4 });
        fx.emit(e.x, 1.2, e.z, { n: 50, color: col, speed: 7, up: 2, life: 0.6, size: 0.35, intensity: 4 });
        break;
      }
      case 'heroDash': {
        const col = this.colorOf(sim, e.id);
        fx.shock(e.x, e.z, { r: 3, color: col, life: 0.5, intensity: 4 });
        fx.emit(e.x, 0.5, e.z, { n: 40, color: '#e8dccb', speed: 8, up: 2, life: 0.7, size: 0.6, intensity: 1.2 });
        break;
      }
      case 'shield': {
        fx.shock(e.x, e.z, { r: 1.8, color: '#ffe08a', life: 0.6, intensity: 3.5 });
        for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; fx.emitVel(e.x + Math.cos(a) * 1.1, 0.3 + (i % 4) * 0.5, e.z + Math.sin(a) * 1.1, 0, 1.8, 0, { color: '#ffe8a8', life: 0.9, size: 0.3, intensity: 3.5, drag: 1 }); }
        break;
      }
      case 'revive':
        fx.pillar(e.x, e.z, { color: '#ffe08a', r: 1.1, h: 12, life: 1.2, intensity: 4 });
        fx.emit(e.x, 0.5, e.z, { n: 40, color: '#fff0b0', speed: 3, up: 6, life: 1.2, size: 0.4, intensity: 4, grav: -1 });
        break;
      default: break;
    }
  }

  implode(x, z, col) {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * TAU, r = 2.2 + Math.random() * 1.5, y = 0.3 + Math.random() * 2.2;
      this.fx.emitVel(x + Math.cos(a) * r, y, z + Math.sin(a) * r, -Math.cos(a) * r * 4, (1.2 - y) * 2, -Math.sin(a) * r * 4, { color: col, life: 0.25, size: 0.3, intensity: 4 });
    }
  }

  ability(e, sim, posOf) {
    const fx = this.fx;
    const h = sim.entities.get(e.id);
    const def = h && HEROES[h.heroId];
    const col = def ? def.palette.glow : '#9fdcff';
    const p = posOf(e.id) || { x: e.x, y: 0, z: e.z };
    const tx = e.tx ?? p.x, tz = e.tz ?? p.z;
    const big = e.ult ? 1.5 : 1;
    this.channels.delete(e.id);
    const hand = new THREE.Vector3(p.x, (p.y || 0) + 1.7, p.z);
    switch (e.type) {
      case 'strike': {
        const hits = def?.abilities[e.slot]?.hits || 1;
        fx.shock(tx, tz, { r: 2.2 * big, color: col, life: 0.4, intensity: 4 });
        fx.emit(tx, 1.2, tz, { n: 34 * big, color: col, speed: 9, up: 3, life: 0.5, size: 0.35, intensity: 4.5 });
        fx.emit(tx, 1.2, tz, { n: 12, color: '#ffffff', speed: 13, up: 2, life: 0.22, size: 0.22, intensity: 6, drag: 4 });
        for (let i = 0; i < Math.min(7, hits); i++) {
          const a = Math.random() * Math.PI, l = 1.6;
          fx.beam([new THREE.Vector3(tx - Math.cos(a) * l, 1.2 + Math.sin(a) * 0.9, tz - Math.sin(a) * 0.4), new THREE.Vector3(tx + Math.cos(a) * l, 1.2 - Math.sin(a) * 0.9, tz + Math.sin(a) * 0.4)], { color: i % 2 ? '#ffffff' : col, width: 0.25, jag: 0, life: 0.18 + i * 0.05, intensity: 6 });
        }
        if (def?.abilities[e.slot]?.stun) fx.pillar(tx, tz, { color: '#bfe8ff', r: 0.8, h: 4, life: 0.5, intensity: 3 });
        if (def?.abilities[e.slot]?.splash) fx.shock(tx, tz, { r: 3.2, color: '#ffd27a', life: 0.55, intensity: 3.5 });
        this.shake?.(0.25 * big, tx, tz);
        break;
      }
      case 'bolt': {
        fx.emit(hand.x, hand.y, hand.z, { n: 26, color: col, speed: 6, up: 1, life: 0.35, size: 0.32, intensity: 5 });
        fx.shock(p.x, p.z, { r: 1.4, color: col, life: 0.35, intensity: 3 });
        if (tx != null) fx.beam([hand, new THREE.Vector3(tx, 1.3, tz)], { color: col, width: 0.18, jag: 0.15, life: 0.12, intensity: 4 });
        break;
      }
      case 'cone': {
        const fxd = Math.sin(h ? h.face : 0), fzd = Math.cos(h ? h.face : 0);
        const ab = def?.abilities[e.slot];
        const R = ab?.range || 10, ang = ab?.angle || 0.8;
        for (let i = 0; i < 9; i++) {
          const a = (h ? h.face : 0) + (i / 8 - 0.5) * 2 * ang;
          const ex = p.x + Math.sin(a) * R, ez = p.z + Math.cos(a) * R;
          fx.beam([new THREE.Vector3(p.x + fxd, 1.4, p.z + fzd), new THREE.Vector3(ex, 1.1, ez)], { color: i % 2 ? '#fff1c2' : col, width: 0.16, jag: 0.1, life: 0.28, intensity: 5 });
          fx.emit(ex, 1, ez, { n: 6, color: col, speed: 4, up: 2, life: 0.4, size: 0.28, intensity: 4 });
        }
        for (let i = 0; i < 40; i++) {
          const a = (h ? h.face : 0) + (Math.random() - 0.5) * 2 * ang, sp = 18 + Math.random() * 10;
          fx.emitVel(p.x, 1.3, p.z, Math.sin(a) * sp, Math.random() * 2, Math.cos(a) * sp, { color: col, life: R / sp, size: 0.25, intensity: 4.5 });
        }
        break;
      }
      case 'aoe_self': case 'taunt': {
        const r = (e.radius || 5);
        const tc = e.type === 'taunt' ? '#ff5a4a' : col;
        fx.shock(p.x, p.z, { r: r * 1.05, color: '#ffffff', life: 0.3, intensity: 5 });
        fx.shock(p.x, p.z, { r, color: tc, life: 0.65, intensity: 4.5 });
        fx.shock(p.x, p.z, { r: r * 0.6, color: tc, life: 0.9, intensity: 3 });
        fx.pillar(p.x, p.z, { color: tc, r: 1.4 * big, h: 9 * big, life: 0.7, intensity: 3.5 });
        fx.emit(p.x, 0.4, p.z, { n: 80 * big, color: tc, speed: r * 2.6, up: 3, life: 0.7, size: 0.45, intensity: 4, drag: 2.5, grav: -4 });
        fx.emit(p.x, 0.3, p.z, { n: 30, color: '#b9a890', speed: r * 1.4, up: 2, life: 1.2, size: 1.0, intensity: 0.7, grav: 0.5, drag: 1.5 });
        // Bodenrisse als Strahlen
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + Math.random() * 0.3;
          fx.beam([new THREE.Vector3(p.x, 0.12, p.z), new THREE.Vector3(p.x + Math.cos(a) * r * 0.5, 0.12, p.z + Math.sin(a) * r * 0.5), new THREE.Vector3(p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r)], { color: tc, width: 0.35, jag: 0.5, life: 0.5, intensity: 4 });
        }
        this.shake?.((e.ult ? 1.1 : 0.55), p.x, p.z);
        break;
      }
      case 'aoe_ground': {
        const ab = def?.abilities[e.slot];
        fx.beam([hand, new THREE.Vector3(tx, 0.4, tz)], { color: col, width: 0.25, jag: 0.4, life: 0.25, intensity: 4 });
        fx.shock(tx, tz, { r: e.radius || 6, color: col, life: 0.8, intensity: 3 });
        if (ab?.delay) this.strikes.push({ x: tx, z: tz, t: 0, dur: ab.delay, kind: ab.type === 'aoe_ground' && def.id === 'brann' ? 'beam' : 'meteor', color: col, r: e.radius || 6 });
        break;
      }
      case 'dash': case 'leap': case 'leap_back': {
        const from = new THREE.Vector3(e.x, 0.6, e.z);
        const to = new THREE.Vector3(tx ?? p.x, 0.6, tz ?? p.z);
        if (e.type !== 'leap_back') {
          for (let i = 0; i < 30; i++) { const t = i / 30; fx.emitVel(from.x + (to.x - from.x) * t, 0.5 + Math.sin(t * Math.PI) * (e.type === 'leap' ? 4 : 0.4), from.z + (to.z - from.z) * t, 0, 1, 0, { color: col, life: 0.5 + t * 0.3, size: 0.45, intensity: 3.5, drag: 2 }); }
        }
        fx.emit(e.x, 0.4, e.z, { n: 30, color: '#d8ccb8', speed: 6, up: 2, life: 0.7, size: 0.7, intensity: 1, drag: 2 });
        if (e.type === 'leap') this.shake?.(0.5, tx, tz);
        break;
      }
      case 'blink': this.implode(p.x, p.z, col); break;
      case 'buff_self': {
        fx.pillar(p.x, p.z, { color: col, r: 1.1, h: 6, life: 0.8, intensity: 4 });
        fx.shock(p.x, p.z, { r: 2.4, color: col, life: 0.6, intensity: 4 });
        for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU * 2; fx.emitVel(p.x + Math.cos(a) * 0.9, 0.2 + i * 0.05, p.z + Math.sin(a) * 0.9, -Math.sin(a) * 2, 2.4, Math.cos(a) * 2, { color: col, life: 0.9, size: 0.3, intensity: 4, drag: 0.5 }); }
        break;
      }
      case 'aura_vassals': case 'heal_area': case 'revive': {
        const r = e.radius || 9;
        const c2 = e.type === 'aura_vassals' ? col : '#9cff8a';
        fx.shock(p.x, p.z, { r, color: c2, life: 1.0, intensity: 3.5 });
        fx.shock(p.x, p.z, { r: r * 0.5, color: '#ffffff', life: 0.5, intensity: 3 });
        fx.pillar(p.x, p.z, { color: c2, r: 1.5, h: e.type === 'revive' ? 16 : 8, life: 1, intensity: 3.5 });
        let n = 0;
        for (const f of sim.entities.values()) {
          if ((f.type !== 'f' && f.type !== 'h') || !f.alive || f.team !== (h ? h.team : -1) || f.lane !== (h ? h.lane : -1)) continue;
          if ((f.x - p.x) ** 2 + (f.z - p.z) ** 2 > r * r || n > 14) continue;
          n++;
          const fp = posOf(f.id) || f;
          fx.beam([new THREE.Vector3(p.x, 1.6, p.z), new THREE.Vector3(fp.x, 1.2, fp.z)], { color: c2, width: 0.22, jag: e.type === 'aura_vassals' ? 0.3 : 0, life: 0.5, intensity: 3.5 });
          fx.emit(fp.x, 0.4, fp.z, { n: 12, color: c2, speed: 1.4, up: 3.5, life: 1, size: 0.32, intensity: 3, grav: 1 });
        }
        if (e.ult) this.shake?.(0.5, p.x, p.z);
        break;
      }
      case 'mark': case 'dot': case 'root_target': {
        const c2 = e.type === 'root_target' ? '#9cff6a' : col;
        fx.beam([hand, new THREE.Vector3(tx, 1.2, tz)], { color: c2, width: 0.3, jag: e.type === 'dot' ? 0.6 : 0.2, life: 0.35, intensity: 4.5 });
        fx.shock(tx, tz, { r: 1.6, color: c2, life: 0.6, intensity: 3.5 });
        if (e.type === 'root_target') for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; fx.beam([new THREE.Vector3(tx + Math.cos(a) * 1.4, 0, tz + Math.sin(a) * 1.4), new THREE.Vector3(tx + Math.cos(a) * 0.4, 1.6, tz + Math.sin(a) * 0.4)], { color: '#6fd14a', width: 0.2, jag: 0.25, life: 0.8, intensity: 2.5 }); }
        else fx.emit(tx, 1.4, tz, { n: 24, color: c2, speed: 3, up: 2, life: 0.8, size: 0.35, intensity: 4 });
        break;
      }
      case 'drain': break; // Strahlen kommen im Kanal-Tick (heal-Ereignis)
      case 'shield': fx.beam([hand, new THREE.Vector3(tx, 1.3, tz)], { color: '#ffe08a', width: 0.3, jag: 0, life: 0.35, intensity: 4 }); break;
      case 'summon': case 'turret':
        fx.shock(tx ?? p.x, tz ?? p.z, { r: 3, color: col, life: 0.7, intensity: 3.5 });
        fx.emit(tx ?? p.x, 0.5, tz ?? p.z, { n: 40, color: col, speed: 5, up: 5, life: 0.9, size: 0.4, intensity: 3.5 });
        break;
      case 'pull': {
        const r = e.radius || 8;
        for (let i = 0; i < 90; i++) {
          const a = Math.random() * TAU, rr = r * (0.6 + Math.random() * 0.5), y = 0.3 + Math.random() * 2.5;
          const sp = 2.6;
          fx.emitVel(tx + Math.cos(a) * rr, y, tz + Math.sin(a) * rr, -Math.cos(a) * rr * sp + Math.sin(a) * 6, -y * 0.8, -Math.sin(a) * rr * sp - Math.cos(a) * 6, { color: i % 3 ? col : '#2a0a3a', life: 0.42, size: 0.4, intensity: i % 3 ? 4 : 1 });
        }
        fx.shock(tx, tz, { r, color: col, life: 0.7, intensity: 4 });
        fx.pillar(tx, tz, { color: col, r: 1.2, h: 10, life: 0.9, intensity: 4 });
        this.shake?.(0.6, tx, tz);
        break;
      }
      default:
        fx.emit(p.x, 1.2, p.z, { n: 24, color: col, speed: 5, up: 2, life: 0.5, size: 0.3, intensity: 4 });
        break;
    }
  }

  // ------------------------------------------------------------ Bild
  /** heroes: [{ ent, x, y, z, color, own, ally }] */
  update(dt, sim, heroes) {
    this.time += dt;
    this.ns = 0;
    const fx = this.fx;
    // Heldenringe
    for (const h of heroes) {
      if (!h.ent.alive) continue;
      if (h.own) this.pushSigil(h.x, h.z, 1.45, SIGIL.hero, '#ffd27a', 0, 0, 1.6);
      else this.pushSigil(h.x, h.z, 1.25, SIGIL.ally, h.color, 0, h.ent.id, h.ally ? 1.2 : 0.8);
    }
    // Bodenzonen & Aufladekreise aus dem Sim-Zustand
    for (const h of heroes) {
      for (const z of h.ent.zones || []) {
        if (z.delayed) {
          const ab = HEROES[h.ent.heroId].abilities.find((a) => a.delay);
          const total = ab ? ab.delay : 1.5;
          this.pushSigil(z.x, z.z, z.r, SIGIL.charge, '#ff9a4a', Math.max(0, Math.min(1, 1 - z.next / total)), 0, 1.4);
        } else this.pushSigil(z.x, z.z, z.r, SIGIL.zone, z.heal && !z.dmg ? '#9cff8a' : h.color, 0, z.x, 1.25);
      }
    }
    if (this.reticle) { const r = this.reticle; this.pushSigil(r.x, r.z, r.r, SIGIL.reticle, r.ok ? '#ffe2a0' : '#ff4a5a', 0, 0, 1.5); }
    const sg = this.sigils;
    sg.count = this.ns;
    sg.instanceMatrix.needsUpdate = true;
    if (sg.instanceColor) sg.instanceColor.needsUpdate = true;
    sg.geometry.attributes.aP.needsUpdate = true;
    sg.material.uniforms.uTime.value = this.time % 1000;

    // Kanalisieren/Zaubern: Funken an den Händen, Strahl beim Kanalisieren
    for (const [id, c] of this.channels) {
      c.t += dt;
      const h = sim.entities.get(id);
      const hp = heroes.find((x) => x.ent.id === id);
      if (!h || !h.cast || !hp || c.t > c.total + 0.2) { this.channels.delete(id); continue; }
      if (Math.random() < 0.8) {
        const a = Math.random() * TAU;
        fx.emitVel(hp.x + Math.cos(a) * 0.9, hp.y + 0.6 + Math.random() * 1.4, hp.z + Math.sin(a) * 0.9, -Math.cos(a) * 1.6, 1.2, -Math.sin(a) * 1.6, { color: c.color, life: 0.5, size: 0.26, intensity: 3.5, drag: 1 });
      }
      if (c.channel && h.cast && h.cast.target && h.cast.ab && h.cast.ab.type === 'drain') {
        const t = sim.entities.get(h.cast.target.id);
        if (t && t.alive && Math.random() < 0.5) fx.beam([new THREE.Vector3(t.x, 1.2, t.z), new THREE.Vector3(hp.x, hp.y + 1.5, hp.z)], { color: '#c06bff', width: 0.35, jag: 0.5, life: 0.12, intensity: 4 });
      }
    }

    // Himmelsschläge
    let oi = 0, bi = 0;
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      const a = s.t / s.dur;
      if (a >= 1) { this.strikes.splice(i, 1); continue; }
      if (s.kind === 'meteor' && oi < this.orbs.length) {
        const o = this.orbs[oi++];
        o.visible = true;
        const e = a * a;
        const sx = s.x + 26 * (1 - e), sy = 2 + 46 * (1 - e), sz = s.z - 30 * (1 - e);
        o.position.set(sx, sy, sz);
        o.scale.setScalar(0.9 + 0.6 * a);
        o.userData.core.material.color.set('#fff0c8').multiplyScalar(6);
        o.userData.shell.material.color.set('#ff7a2a').multiplyScalar(3);
        fx.emit(sx, sy, sz, { n: 6, color: '#ff8a3a', speed: 2, up: 1, life: 0.6, size: 1.0, intensity: 4, grav: 0, drag: 1 });
        fx.emit(sx, sy, sz, { n: 2, color: '#2a1a14', speed: 1, up: 0.5, life: 1.2, size: 1.6, intensity: 0.6, grav: 0, drag: 0.5 });
      } else if (s.kind === 'beam' && bi < this.beams.length) {
        const b = this.beams[bi++];
        b.visible = true;
        const thin = a < 0.8 ? 0.08 + a * 0.15 : 0.25 + (a - 0.8) * 8;
        b.position.set(s.x, 0, s.z);
        b.scale.set(thin, 120, thin);
        b.material.uniforms.uCol.value.set(s.color);
        b.material.uniforms.uK.value = a < 0.8 ? 1.2 + Math.sin(this.time * 30) * 0.3 : 6;
        b.material.uniforms.uTime.value = this.time;
      }
    }
    for (; oi < this.orbs.length; oi++) this.orbs[oi].visible = false;
    for (; bi < this.beams.length; bi++) this.beams[bi].visible = false;
  }

  clear() { this.strikes.length = 0; this.channels.clear(); this.reticle = null; }
}
