// Helden in der Welt: ein Rig je Held (auch Bot- und verbündete Helden), Position (eigener Held aus der
// Vorhersage, andere weich interpoliert), Animation aus Sim-Zustand und Ereignissen, synchron zum Tastendruck:
//   • eigener Held: Animation startet lokal beim Drücken (Vorhersage), Sim-Bestätigung startet nicht neu,
//     Fehler/Abbruch bricht die Pose sichtbar ab
//   • Zauber mit Zauberzeit: Zauber-Pose läuft mit der Leiste, endet im Freisetzen
//   • Treffer (Funken, Zahl, Aufblitzen) erscheinen im Einschlag-Moment der Animation (presentDelay)
// Dazu: Lichtring unter dem eigenen Helden, Namensplaketten, Tod/Wiederkehr, Fähigkeits-Effekte (abilityFx).
import * as THREE from 'three';
import { HEROES, HERO_STATS as HS } from '../sim/heroes.js';
import { buildHeroRig, createAnimator } from './heroRig.js';
import { AbilityFx } from './abilityFx.js';
import { TEAM_COLORS } from './units.js';
import { ANIM_TIME, CAST_HOLD, animTime, abilityAnim, autoAnim, impactDelay } from '../hero/anims.js';

const _v = new THREE.Vector3();
const RELEASE = 0.38;   // Sekunden: Freisetzen nach Zauberende
export const HERO_SCALE = 1.25; // Helden überragen ihre Vasallen
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class HeroesView {
  constructor(scene, fx, settings) {
    this.scene = scene;
    this.fx = fx;
    this.settings = settings;
    this.root = new THREE.Group();
    this.root.name = 'heroes';
    scene.add(this.root);
    this.abilityFx = new AbilityFx(scene, fx, settings);
    this.map = new Map();       // Entity-ID → Zustand
    this.time = 0;
    this.layer = document.getElementById('heroplates');
    this.batch = { delay: new Map(), ids: new Map() };
    this.localPid = -1;
    this.localId = 0;
    this.pillar = this.makePillar();
    this.root.add(this.pillar);
  }

  makePillar() {
    // feine Lichtsäule über dem eigenen Helden (nur aus der Ferne sichtbar, blendet nah aus)
    const geo = new THREE.CylinderGeometry(0.55, 0.9, 1, 24, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffd27a') } },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`uniform float uK; uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
        void main(){ float a = pow(1.0 - vUv.y, 2.2) * (0.65 + 0.35 * sin(vUv.x * 50.27 + uTime * 2.0)) * smoothstep(0.0, 0.08, vUv.y); gl_FragColor = vec4(uCol * a * uK, 1.0); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 4;
    m.scale.set(1, 26, 1);
    return m;
  }

  // ------------------------------------------------------------ Verwaltung
  ensure(h) {
    let s = this.map.get(h.id);
    if (s) return s;
    const def = HEROES[h.heroId];
    const rig = buildHeroRig(def ? def.model : 'hero_kael', { palette: def?.palette, level: h.level });
    const anim = createAnimator(rig);
    const holder = new THREE.Group();
    holder.scale.setScalar(HERO_SCALE);
    holder.add(rig.root);
    rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(holder);
    let plate = null;
    if (this.layer) {
      plate = document.createElement('div');
      plate.className = 'hplate';
      plate.innerHTML = '<b class="lv"></b><span class="nm"></span><i class="hb"><i></i></i>';
      this.layer.appendChild(plate);
    }
    s = {
      id: h.id, ent: h, def, rig, anim, plate, level: h.level, holder,
      x: h.x, z: h.z, y: h.y || 0, face: h.face, vf: 0, vs: 0, turn: 0, px: h.x, pz: h.z,
      action: null, hitAt: -9, dead: !h.alive, deadAt: h.alive ? -9 : 0, color: def ? def.palette.glow : '#9fdcff',
      plateKey: '',
    };
    this.map.set(h.id, s);
    return s;
  }
  remove(id) {
    const s = this.map.get(id);
    if (!s) return;
    this.root.remove(s.holder);
    s.rig.dispose?.();
    s.plate?.remove();
    this.map.delete(id);
  }
  clear() {
    for (const id of [...this.map.keys()]) this.remove(id);
    this.abilityFx.clear();
    this.batch.delay.clear(); this.batch.ids.clear();
  }

  posOf(id) { const s = this.map.get(id); return s ? { x: s.x, y: s.y, z: s.z } : null; }

  // ------------------------------------------------------------ Aktionen
  /** Aktion starten. mode: 'once' | 'cast' | 'channel' · start in this.time-Sekunden */
  play(s, kind, { slot = -1, mode = 'once', total = 0, local = false, offset = 0, dur } = {}) {
    const T = animTime(kind);
    s.action = { kind, slot, mode, start: this.time - offset, dur: dur || T.dur, total, local, castKind: kind, released: false, confirmed: !local };
    return s.action;
  }
  abort(s) { if (s.action) { s.action = null; s.abortT = this.time; } }

  /** Eigener Held: Animation sofort beim Tastendruck (Vorhersage). cast > 0 → Zauber-Pose mit Leiste. */
  localAbility(slot, { cast = 0, channel = false, total = 0 } = {}) {
    const s = this.map.get(this.localId);
    if (!s || s.dead) return;
    const kind = abilityAnim(s.ent.heroId, slot);
    if (cast > 0 || channel) this.play(s, channel ? kind : kind, { slot, mode: channel ? 'channel' : 'cast', total: channel ? total : cast, local: true });
    else this.play(s, kind, { slot, local: true });
  }
  localCancel(reason) {
    const s = this.map.get(this.localId);
    if (s && s.action && s.action.local && !s.action.confirmed) this.abort(s);
    else if (s && s.action && (s.action.mode === 'cast' || s.action.mode === 'channel') && reason === 'move') this.abort(s);
  }
  /** Lokale Zaubervorhersage für die Zauberleiste */
  localCast() {
    const s = this.map.get(this.localId);
    const a = s && s.action;
    if (!a || (a.mode !== 'cast' && a.mode !== 'channel') || a.released) return null;
    return { slot: a.slot, t: this.time - a.start, total: a.total, channel: a.mode === 'channel' };
  }

  // ------------------------------------------------------------ Ereignisse
  /** Sofort (nicht verzögert) aufgerufen – Animationen der Ereignisse */
  onEvent(e, sim) {
    switch (e.e) {
      case 'attack': {
        const s = this.map.get(e.id);
        if (!s) break;
        const kind = autoAnim(s.ent.heroId);
        const busy = s.action && s.action.kind !== 'melee' && s.action.kind !== 'shoot' && this.time - s.action.start < s.action.dur;
        if (busy) break;
        // Fernkampf: Pfeil fliegt sofort → Animation kurz vor dem Loslassen einsetzen
        this.play(s, kind, { offset: kind === 'shoot' ? ANIM_TIME.shoot.dur * 0.6 : 0 });
        break;
      }
      case 'heroCast': {
        const s = this.map.get(e.id);
        if (!s) break;
        const kind = abilityAnim(s.ent.heroId, e.slot);
        const a = s.action;
        if (a && a.local && a.slot === e.slot && (a.mode === 'cast' || a.mode === 'channel')) { a.confirmed = true; a.total = e.total; break; }
        this.play(s, kind, { slot: e.slot, mode: e.channel ? 'channel' : 'cast', total: e.total });
        break;
      }
      case 'castCancel': {
        const s = this.map.get(e.id);
        if (s) this.abort(s);
        break;
      }
      case 'heroAbility': {
        const s = this.map.get(e.id);
        if (!s) break;
        const a = s.action;
        const kind = abilityAnim(s.ent.heroId, e.slot);
        if (a && a.slot === e.slot && (a.mode === 'cast' || a.mode === 'channel') && !a.released) {
          // Zauberende → Freisetzen
          a.released = true; a.releaseAt = this.time; a.confirmed = true;
          if (a.mode === 'channel') this.abort(s);
        } else if (a && a.local && a.slot === e.slot && this.time - a.start < 0.9) {
          a.confirmed = true; // lokal schon gestartet → nicht neu beginnen
        } else this.play(s, kind, { slot: e.slot });
        break;
      }
      case 'heroError': {
        if (e.pid === this.localPid) { const s = this.map.get(this.localId); if (s && s.action && s.action.local && !s.action.confirmed) this.abort(s); }
        break;
      }
      case 'hit': {
        if (!e.onHero) break;
        const s = this.map.get(e.id);
        if (s) s.hitAt = this.time;
        break;
      }
      case 'heroDeath': {
        const s = this.map.get(e.id);
        if (s) { s.dead = true; s.deadAt = this.time; s.action = null; }
        this.fx.emit(e.x, 1.2, e.z, { n: 70, color: s?.color || '#9fdcff', speed: 6, up: 4, life: 1.4, size: 0.45, intensity: 3.5, grav: -2 });
        this.fx.emit(e.x, 0.6, e.z, { n: 30, color: '#2a2438', speed: 3, up: 2, life: 1.8, size: 1.1, grav: 1, intensity: 0.5 });
        this.fx.shock(e.x, e.z, { r: 4, color: s?.color || '#9fdcff', life: 1, intensity: 3 });
        this.fx.pillar(e.x, e.z, { color: '#c8d4ff', r: 1, h: 14, life: 1.6, intensity: 2.5 });
        break;
      }
      case 'heroRespawn': {
        const s = this.map.get(e.id);
        if (s) { s.dead = false; s.x = e.x; s.z = e.z; }
        this.respawnFx(e.x, e.z, s?.color);
        break;
      }
      case 'heroLevel': {
        const s = this.map.get(e.id);
        const p = s || e;
        this.fx.pillar(p.x, p.z, { color: '#ffd27a', r: 1.3, h: 16, life: 1.6, intensity: 4 });
        this.fx.shock(p.x, p.z, { r: 4, color: '#ffd27a', life: 1, intensity: 4 });
        this.fx.emit(p.x, 0.5, p.z, { n: 70, color: '#ffe8a8', speed: 3, up: 8, life: 1.6, size: 0.4, grav: -1, intensity: 4 });
        this.fx.text(p.x, 3.4, p.z, e.ult ? `STUFE ${e.level} · ULTIMATE` : `STUFE ${e.level}`, 'lvl');
        break;
      }
      case 'waveStart': case 'waveEnd': {
        for (const s of this.map.values()) { s.action = null; if (e.e === 'waveStart' && s.dead) { s.dead = false; } }
        break;
      }
      default: break;
    }
  }

  respawnFx(x, z, color = '#ffd27a') {
    this.fx.pillar(x, z, { color: '#fff1c8', r: 1.2, h: 22, life: 1.4, intensity: 4 });
    this.fx.shock(x, z, { r: 3.5, color, life: 0.9, intensity: 4 });
    this.fx.emit(x, 0.4, z, { n: 60, color, speed: 4, up: 6, life: 1.2, size: 0.4, intensity: 4, grav: -2 });
  }

  /**
   * Darstellungs-Verzögerung eines Ereignisses (Sekunden) – in Ereignis-Reihenfolge je Tick aufrufen,
   * danach endBatch(). Treffer aus Fähigkeiten/Nahkampf-Angriffen erscheinen im Einschlag-Moment.
   */
  presentDelay(e, sim) {
    const B = this.batch;
    switch (e.e) {
      case 'heroAbility': {
        const s = this.map.get(e.id);
        let d = impactDelay(s?.ent.heroId, e.slot, e.type);
        if (d > 0 && s && s.action && s.action.slot === e.slot) d = Math.max(0, s.action.start + d - this.time);
        B.delay.set(e.pid, d);
        return d;
      }
      case 'attack': {
        const s = this.map.get(e.id);
        if (!s || !e.melee) return 0;
        const T = ANIM_TIME.melee;
        const d = Math.max(0, (s.action ? s.action.start : this.time) + T.dur * T.hit - this.time);
        B.delay.set(s.ent.owner, d);
        return d;
      }
      case 'hit': {
        if (e.hero < 0) return 0;
        const d = B.delay.get(e.hero) || 0;
        if (d > 0) B.ids.set(e.id, Math.max(B.ids.get(e.id) || 0, d));
        return d;
      }
      case 'stun': case 'death': case 'gold': return B.ids.get(e.id) || 0;
      case 'heroDash': case 'heroBlink': return 0;
      case 'splash': { let d = 0; for (const v of B.delay.values()) d = Math.max(d, v); return d; }
      default: return 0;
    }
  }
  endBatch() { this.batch.delay.clear(); this.batch.ids.clear(); }

  // ------------------------------------------------------------ Bild
  /**
   * ctx: { localPid, local: { x, y, z, face, vf, vs, turn, airborne, vy } | null, plates: bool, camera, heroMode }
   */
  update(sim, dt, ctx = {}) {
    this.time += dt;
    this.localPid = ctx.localPid ?? -1;
    const seen = new Set();
    const list = [];
    const k = 1 - Math.exp(-dt * 16);
    const myTeam = ctx.localPid >= 0 && sim.players[ctx.localPid] ? sim.players[ctx.localPid].team : -1;
    for (const h of sim.entities.values()) {
      if (h.type !== 'h') continue;
      seen.add(h.id);
      const s = this.ensure(h);
      s.ent = h;
      const own = h.owner === ctx.localPid;
      if (own) this.localId = h.id;
      if (h.level !== s.level) { s.level = h.level; s.rig.setLevel?.(h.level); }
      if (!h.alive && !s.dead) { s.dead = true; s.deadAt = this.time; }
      if (h.alive && s.dead) { s.dead = false; s.anim = createAnimator(s.rig); }
      const L = own && ctx.local && h.alive ? ctx.local : null;
      const ox = s.x, oz = s.z;
      if (L) {
        s.x = L.x; s.z = L.z; s.y = L.y; s.face = L.face;
        s.vf = L.vf; s.vs = L.vs; s.turn = L.turn;
      } else {
        if ((h.x - s.x) ** 2 + (h.z - s.z) ** 2 > 36) { s.x = h.x; s.z = h.z; }
        s.x += (h.x - s.x) * k; s.z += (h.z - s.z) * k;
        s.y += ((h.y || 0) - s.y) * Math.min(1, dt * 20);
        const df = wrap(h.face - s.face);
        const turn = df * Math.min(1, dt * 12);
        s.face += turn;
        s.turn += ((dt > 0 ? turn / dt : 0) - s.turn) * Math.min(1, dt * 10);
        // Geschwindigkeit im Körperraum (m/s)
        const vx = dt > 0 ? (s.x - ox) / dt : 0, vz = dt > 0 ? (s.z - oz) / dt : 0;
        const fx = Math.sin(s.face), fz = Math.cos(s.face);
        const kv = Math.min(1, dt * 12);
        s.vf += ((vx * fx + vz * fz) - s.vf) * kv;
        s.vs += ((vx * -fz + vz * fx) - s.vs) * kv;
      }
      // Aktion → Animator-Zustand
      let action = null, castGlow = 0;
      const a = s.action;
      if (a && !s.dead) {
        const el = this.time - a.start;
        if (a.mode === 'once') {
          const t = el / a.dur;
          if (t >= 1) s.action = null; else action = { kind: a.kind, t, slot: a.slot };
        } else if (!a.released) {
          // Zauber-/Kanalisierungs-Pose läuft mit der Leiste; Sim-Zustand hält sie am Leben
          const total = Math.max(0.1, a.total || 1);
          const simCasting = h.cast && h.cast.slot === a.slot;
          if (!simCasting && a.confirmed && el > 0.15) { a.released = true; a.releaseAt = this.time; }
          if (!a.confirmed && el > 0.6) { s.action = null; }
          else if (a.mode === 'channel') { action = { kind: a.kind, t: Math.min(1, CAST_HOLD + (el % 1) * 0.0), slot: a.slot }; castGlow = 1; }
          else { action = { kind: a.kind, t: Math.min(1, el / total) * CAST_HOLD, slot: a.slot }; castGlow = Math.min(1, el / total); }
        }
        if (s.action && a.released) {
          const rt = (this.time - a.releaseAt) / RELEASE;
          if (rt >= 1 || a.mode === 'channel') s.action = null;
          else { action = { kind: a.kind, t: CAST_HOLD + (1 - CAST_HOLD) * rt, slot: a.slot }; castGlow = 1 - rt; }
        }
      }
      s.anim.update(dt, {
        fwd: s.vf, strafe: s.vs, turn: s.turn, airborne: (L ? L.airborne : !h.grounded) || s.y > 0.05, vy: L ? L.vy : h.vy || 0,
        action, hitAt: this.time - s.hitAt, dead: s.dead, victory: sim.phase === 'over' && sim.winner === h.team && !s.dead,
        stunned: h.stun > 0 && h.alive, castGlow,
      });
      const R = s.holder;
      R.position.set(s.x, s.y, s.z);
      R.rotation.y = s.face;
      // Gefallen: nach dem Sturz langsam versinken und verblassen
      const dT = s.dead ? this.time - s.deadAt : 0;
      R.visible = !(s.dead && dT > 4.5);
      if (s.dead && dT > 2.2) R.position.y = -Math.min(1.6, (dT - 2.2) * 0.7);
      list.push({ ent: h, x: s.x, y: s.y, z: s.z, color: s.color, own, ally: h.team === myTeam });
      // Lichtsäule über dem eigenen Helden
      if (own) {
        const camD = ctx.camera ? ctx.camera.position.distanceTo(_v.set(s.x, 1, s.z)) : 50;
        this.pillar.position.set(s.x, 0, s.z);
        this.pillar.material.uniforms.uK.value = h.alive ? Math.min(1, Math.max(0, (camD - 14) / 40)) * (ctx.heroMode ? 0.18 : 0.42) : 0;
        this.pillar.material.uniforms.uTime.value = this.time;
      }
      this.updatePlate(s, h, ctx, own, myTeam, sim);
    }
    for (const id of [...this.map.keys()]) if (!seen.has(id)) this.remove(id);
    if (!this.localId || !seen.has(this.localId)) this.pillar.material.uniforms.uK.value = 0;
    this.list = list;
    this.abilityFx.update(dt, sim, list);
  }

  updatePlate(s, h, ctx, own, myTeam, sim) {
    const el = s.plate;
    if (!el) return;
    const show = ctx.plates && h.alive && !(own && ctx.heroMode) && ctx.camera;
    if (!show) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    _v.set(s.x, s.y + (s.rig.height || 2) * HERO_SCALE + 0.55, s.z).project(ctx.camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) { el.style.display = 'none'; return; }
    const dist = ctx.camera.position.distanceTo(_v.set(s.x, s.y + 1, s.z));
    if (dist > 140) { el.style.display = 'none'; return; }
    el.style.display = '';
    _v.set(s.x, s.y + (s.rig.height || 2) * HERO_SCALE + 0.55, s.z).project(ctx.camera);
    const sc = Math.max(0.7, Math.min(1.1, 22 / Math.max(8, dist) + 0.55));
    el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-_v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
    const p = sim.players[h.owner];
    const key = `${p ? p.name : ''}|${h.level}|${h.team === myTeam}|${own}`;
    if (key !== s.plateKey) {
      s.plateKey = key;
      el.className = `hplate ${own ? 'own' : h.team === myTeam ? 'ally' : 'foe'}`;
      el.style.setProperty('--tc', own ? '#ffd27a' : TEAM_COLORS[h.team]);
      el.querySelector('.lv').textContent = h.level;
      el.querySelector('.nm').textContent = `${p ? p.name : ''} · ${s.def ? s.def.name.split(' ')[0] : ''}`;
    }
    el.querySelector('.hb > i').style.width = `${Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100)).toFixed(1)}%`;
  }

  /** Zielkreis beim Platzieren von Bodenzaubern */
  setReticle(r) { this.abilityFx.setReticle(r); }
}
