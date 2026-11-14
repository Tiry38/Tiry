// WoW-Steuerung des Helden (Standardbelegung, alles umbelegbar – siehe keybinds.js):
//   W/S vor/zurück (7 bzw. 4,5 m/s) · A/D drehen (180°/s) · Q/E seitwärts · Leertaste springen · Num automatisch laufen
//   Rechte Maustaste gehalten: Held + Kamera folgen der Maus (A/D werden zu Seitschritten)
//   Linke Maustaste gehalten: Kamera frei drehen, Held behält die Blickrichtung
//   Beide Maustasten: vorwärts laufen, mit der Maus lenken · Mausrad: Zoom
//   Tab: nächster Gegner vor dir (wiederholt: durchschalten) · Esc: Ziel aufheben (ohne Ziel: Menü)
//   Linksklick Gegner: anvisieren · Rechtsklick Gegner: anvisieren + automatisch angreifen
//   1–5 Fähigkeiten (Umschalt+1–5: Gegenstände) · Bodenzauber: Zielkreis, Klick setzt, Esc/Rechtsklick bricht ab
// Bewegung wird lokal vorhergesagt (predict.js) und als 'hin'-Befehl an die Simulation geschickt.
import * as THREE from 'three';
import { HEROES, HERO_STATS as HS, abilityAt } from '../sim/heroes.js';
import { HeroPredictor, SIM_DT } from './predict.js';
import { resolveBinds, bindIndex, comboFromEvent } from './keybinds.js';

const GROUND_TYPES = new Set(['aoe_ground', 'leap', 'turret', 'pull']);
const ENEMY_TYPES = new Set(['strike', 'bolt', 'dash', 'mark', 'dot', 'drain', 'root_target']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3(), _v = new THREE.Vector3();

export class HeroControls {
  /**
   * o: { canvas, settings, camera (THREE), hcam (HeroCamera), heroes (HeroesView), view (UnitsView), audio,
   *      getSession: () => session, onError(msg), onMenu(), onFeedback(kind, data) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.enabled = false;
    this.keys = new Set();          // gedrückte Aktionen
    this.codeAct = new Map();       // Tastencode → Aktionen (für keyup)
    this.binds = resolveBinds(this.settings);
    this.index = bindIndex(this.binds);
    this.settings.onChange((k) => { if (k === 'keybinds') { this.binds = resolveBinds(this.settings); this.index = bindIndex(this.binds); } });
    this.lmb = false; this.rmb = false;
    this.drag = null;               // { x, y, moved, button }
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    this.yaw = Math.PI;
    this.autorun = false;
    this.target = 0;
    this.placing = null;            // { slot, ab, x, z, ok }
    this.jumpEdge = false; this.jumpPending = 0;
    this.sent = { f: 0, s: 0, yaw: 0, jump: 0, t: 0 };
    this.input = { f: 0, s: 0, turn: 0 };
    this.pred = new HeroPredictor();
    this.pose = null;
    this.tabList = [];
    this.facingWarnT = 0;
    this.stats = { hin: 0, casts: 0 };
    this.bind();
  }

  get session() { return this.getSession(); }
  get sim() { return this.session && this.session.sim; }
  get hero() { const s = this.session; return s ? s.sim.heroOf(s.localPid) : null; }
  get def() { const h = this.hero; return h ? HEROES[h.heroId] : null; }
  laneX() { const s = this.session; return s.sim.laneX(s.localPid); }

  // ------------------------------------------------------------ Aktivieren
  enable() {
    const h = this.hero;
    if (!h) return;
    this.enabled = true;
    this.yaw = h.face;
    this.pred.reset(h);
    this.keys.clear(); this.codeAct.clear();
    this.autorun = false; this.placing = null; this.target = 0; this.tabList = [];
    this.sent = { f: 0, s: 0, yaw: Math.round(wrap(this.yaw) * 1000), jump: 0, t: 0 };
    this.hcam.reset(this.yaw);
    this.heroes.setReticle(null);
  }
  disable() {
    if (this.enabled) {
      // stehen bleiben
      this.session?.submit({ type: 'hin', f: 0, s: 0, yaw: Math.round(wrap(this.yaw) * 1000), jump: 0 });
    }
    this.enabled = false;
    this.keys.clear(); this.codeAct.clear();
    this.lmb = this.rmb = false; this.drag = null;
    this.placing = null;
    this.heroes.setReticle(null);
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.canvas.style.cursor = '';
  }

  // ------------------------------------------------------------ Eingabe-Ereignisse
  bind() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    c.addEventListener('wheel', (e) => { if (!this.enabled) return; e.preventDefault(); this.hcam.zoom(e.deltaY); }, { passive: false });
    c.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.codeAct.clear(); this.lmb = this.rmb = false; this.drag = null; });
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  /** Von main.js aufgerufen (dort entscheidet der Modus). true = verarbeitet. */
  onKeyDown(e) {
    if (!this.enabled) return false;
    if (e.target && e.target.closest && e.target.closest('input,select,textarea')) return false;
    if (e.code === 'Escape') { e.preventDefault(); this.escape(); return true; }
    const combo = comboFromEvent(e);
    let act = this.index.get(combo);
    // Bewegungstasten funktionieren auch mit gehaltener Umschalttaste
    if (!act && e.shiftKey) { const a2 = this.index.get(e.code); if (a2 && !a2.startsWith('ability')) act = a2; }
    if (!act) return false;
    e.preventDefault();
    let set = this.codeAct.get(e.code);
    if (!set) this.codeAct.set(e.code, (set = new Set()));
    set.add(act);
    if (e.repeat) return true;
    this.keys.add(act);
    this.press(act);
    return true;
  }
  onKeyUp(e) {
    const set = this.codeAct.get(e.code);
    if (!set) return;
    for (const a of set) this.keys.delete(a);
    this.codeAct.delete(e.code);
  }

  press(act) {
    switch (act) {
      case 'moveForward': case 'moveBack': this.autorun = false; break;
      case 'autorun': this.autorun = !this.autorun; break;
      case 'jump': this.jump(); break;
      case 'targetNearest': this.tabTarget(); break;
      case 'kingHeal': this.session.submit({ type: 'heal' }); break;
      default:
        if (act.startsWith('ability')) this.useAbility(+act.slice(7) - 1);
        else if (act.startsWith('item')) this.error('Kein Gegenstand in diesem Platz');
        break;
    }
  }

  escape() {
    if (this.placing) { this.cancelPlacing(); return; }
    if (this.target) { this.setTarget(0); this.audio?.ui('close'); return; }
    this.onMenu?.();
  }

  onMouseDown(e) {
    if (!this.enabled) return;
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (e.button === 0) this.lmb = true; else this.rmb = true;
    if (!this.drag) this.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button, t: performance.now() };
    if (e.button === 2 && !this.placing) {
      // Rechte Maustaste: Held dreht sich sofort in Kamerarichtung
      this.yaw = this.hcam.yaw;
    }
  }
  onMouseMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (!this.enabled || !this.drag) return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved > 4 && !document.pointerLockElement && !this.drag.locked) {
      this.drag.locked = true;
      try { const r = this.canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch { /* nicht verfügbar */ }
      this.canvas.style.cursor = 'none';
    }
    if (this.drag.moved <= 4) return;
    const sens = 0.0042 * (this.settings.get('mouseSens') || 1);
    const inv = this.settings.get('invertY') ? -1 : 1;
    this.hcam.rotate(-dx * sens, dy * sens * inv);
    if (this.rmb && !this.stunned()) this.yaw = this.hcam.yaw;
  }
  onMouseUp(e) {
    if (e.button !== 0 && e.button !== 2) return;
    const wasDrag = this.drag && this.drag.moved > 4;
    const btn = e.button;
    if (btn === 0) this.lmb = false; else this.rmb = false;
    if (!this.lmb && !this.rmb) {
      this.drag = null;
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.canvas.style.cursor = '';
    }
    if (!this.enabled || wasDrag) return;
    // Klick (ohne Ziehen)
    if (this.placing) {
      if (btn === 0) this.confirmPlacing(); else this.cancelPlacing();
      return;
    }
    const id = this.pick(this.mouse.x, this.mouse.y);
    if (btn === 0) { this.setTarget(id); if (id) this.audio?.ui('click'); }
    else if (id) { this.setTarget(id); this.session.submit({ type: 'hauto', id }); this.feedback('auto', id); }
  }

  // ------------------------------------------------------------ Ziele
  stunned() { const h = this.hero; return !!h && h.stun > 0; }
  setTarget(id) {
    if (id === this.target) return;
    this.target = id || 0;
    this.tabList = [];
    this.session.submit({ type: 'htarget', id: this.target });
    this.feedback('target', this.target);
  }
  enemyAlive(id) { const e = id && this.sim.entities.get(id); return !!(e && e.alive && e.type === 'c'); }
  candidates() {
    const sim = this.sim, pid = this.session.localPid, P = this.pose || this.hero;
    const out = [];
    for (const e of sim.entities.values()) {
      if (e.type !== 'c' || !e.alive || e.lane !== pid || e.stage !== 'lane') continue;
      const d = this.view.pos(e.id) || e;
      out.push({ e, x: d.x, z: d.z, dist: Math.hypot(d.x - P.x, d.z - P.z) });
    }
    return out;
  }
  /** Bildschirm-Auswahl: Gegner, dessen Körpermitte dem Mauszeiger am nächsten ist */
  pick(mx, my) {
    let best = 0, bd = Infinity;
    const cam = this.camera;
    for (const c of this.candidates()) {
      const big = c.e.def.boss ? 2 : c.e.def.champion || c.e.def.leader ? 1.4 : 1;
      _v.set(c.x, 1.1 * big, c.z).project(cam);
      if (_v.z > 1) continue;
      const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight;
      const camD = cam.position.distanceTo(_v.set(c.x, 1, c.z));
      const r = Math.max(22, Math.min(110, (900 / Math.max(3, camD)) * big));
      const d = Math.hypot(sx - mx, (sy - my) * 0.8);
      if (d < r && d < bd) { bd = d; best = c.e.id; }
    }
    return best;
  }
  tabTarget() {
    const P = this.pose || this.hero;
    const cy = this.hcam.yaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    let list = this.candidates().filter((c) => c.dist < 42 && ((c.x - P.x) * fx + (c.z - P.z) * fz) / Math.max(0.01, c.dist) > 0.25);
    if (!list.length) list = this.candidates().filter((c) => c.dist < 20);
    list.sort((a, b) => a.dist - b.dist || a.e.id - b.e.id);
    if (!list.length) { this.error('Keine Gegner in Sicht'); return; }
    const ids = list.map((c) => c.e.id);
    // Wiederholtes Tab: in der Reihenfolge der zuletzt gebildeten Liste weiterschalten
    let next;
    if (this.tabList.length && this.target && this.tabList.includes(this.target)) {
      const order = this.tabList.filter((id) => ids.includes(id)).concat(ids.filter((id) => !this.tabList.includes(id)));
      next = order[(order.indexOf(this.target) + 1) % order.length];
    } else next = ids[0] === this.target && ids.length > 1 ? ids[1] : ids[0];
    this.target = 0;
    this.setTarget(next);
    this.tabList = this.tabList.length && this.tabList.includes(next) ? this.tabList : ids;
    this.audio?.ui('hover');
  }
  /** Nächster Gegner vor dem Helden in Reichweite (für Fähigkeiten ohne Ziel) */
  autoTarget(range) {
    const P = this.pose || this.hero;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let best = 0, bd = Infinity;
    for (const c of this.candidates()) {
      if (c.dist > range + 1.2) continue;
      const front = ((c.x - P.x) * fx + (c.z - P.z) * fz) / Math.max(0.01, c.dist);
      const score = c.dist - front * 4;
      if (front > -0.2 && score < bd) { bd = score; best = c.e.id; }
    }
    return best;
  }

  // ------------------------------------------------------------ Fähigkeiten
  abilityInfo(slot) {
    const h = this.hero, def = this.def;
    if (!h || !def || !def.abilities[slot]) return null;
    return abilityAt(def.abilities[slot], h.level, slot);
  }
  moving() { return this.input.f !== 0 || this.input.s !== 0 || (this.pose && !this.pose.grounded); }

  useAbility(slot) {
    const h = this.hero, def = this.def;
    if (!h || !def) return;
    if (!h.alive) { this.error('Dein Held ist gefallen'); return; }
    const ab = this.abilityInfo(slot);
    if (!ab) return;
    if (this.placing && this.placing.slot === slot) { this.confirmPlacing(); return; }
    if (this.placing) this.cancelPlacing();
    const wait = Math.max(h.cast ? h.cast.total - h.cast.t : 0, ab.gcd ? h.gcd : 0, h.cds[slot]);
    if (h.cds[slot] > HS.queueWindow) { this.error('Fähigkeit lädt noch'); return; }
    if (h.res < ab.cost && wait <= 0) { this.error(`Nicht genug ${def.resName}`); return; }
    if (h.stun > 0) { this.error('Du bist betäubt'); return; }
    if (GROUND_TYPES.has(ab.type)) {
      const P = this.pose || h;
      this.placing = { slot, ab, x: P.x + Math.sin(this.yaw) * 6, z: P.z + Math.cos(this.yaw) * 6, ok: true };
      this.feedback('placing', slot);
      return;
    }
    let target = 0;
    const needsEnemy = ENEMY_TYPES.has(ab.type) || (ab.type === 'blink' && ab.behind);
    if (needsEnemy) {
      if (!this.enemyAlive(this.target)) {
        const t = this.autoTarget(ab.range || 4);
        if (!t) { this.error(this.target ? 'Ziel außer Reichweite' : 'Kein Ziel ausgewählt'); return; }
        this.setTarget(t);
      }
      target = this.target;
      const e = this.sim.entities.get(target);
      const P = this.pose || h;
      const d = this.view.pos(target) || e;
      const dist = Math.hypot(d.x - P.x, d.z - P.z);
      if (dist > (ab.range || 0) + 1.2) { this.error('Ziel außer Reichweite'); return; }
      if (ab.minRange && dist < ab.minRange) { this.error('Ziel zu nah'); return; }
    }
    if ((ab.cast > 0 || ab.channel) && this.moving()) { this.error('Das geht nicht in Bewegung'); return; }
    this.cast(slot, ab, target);
  }

  cast(slot, ab, target, x, z) {
    const h = this.hero;
    const ready = h.cds[slot] <= 0 && (!ab.gcd || h.gcd <= 0) && !h.cast && h.res >= ab.cost;
    // Animation sofort (Vorhersage); in der Warteschlange startet sie mit der Bestätigung der Sim
    if (ready) {
      const total = ab.channel ? (ab.ticks || 1) * (ab.tick || 1) : ab.cast;
      this.heroes.localAbility(slot, { cast: ab.cast, channel: !!ab.channel, total });
      this.localGcd = ab.gcd ? performance.now() : this.localGcd;
    }
    const cmd = { type: 'hcast', slot, target };
    if (Number.isFinite(x)) { cmd.x = Math.round(x * 100) / 100; cmd.z = Math.round(z * 100) / 100; }
    this.session.submit(cmd);
    this.stats.casts++;
    if (target && !h.auto) this.session.submit({ type: 'hauto', id: target });
    this.feedback('cast', slot);
  }

  confirmPlacing() {
    const p = this.placing;
    if (!p) return;
    if (p.ab.channel && this.moving()) { this.error('Das geht nicht in Bewegung'); return; }
    this.placing = null;
    this.heroes.setReticle(null);
    this.cast(p.slot, p.ab, 0, p.x, p.z);
  }
  cancelPlacing() { this.placing = null; this.heroes.setReticle(null); this.feedback('placing', -1); }

  jump() {
    const h = this.hero;
    if (!h || !h.alive || h.stun > 0 || h.rootT > 0) return;
    if (this.pose && !this.pose.grounded) return;
    this.jumpEdge = true;
    this.jumpPending = performance.now();
    if (this.heroes.localCast()) this.heroes.localCancel('move');
  }

  error(msg) { this.onError?.(msg); }
  feedback(kind, data) { this.onFeedback?.(kind, data); }

  /** Sim-Ereignisse für den eigenen Helden */
  onEvent(e) {
    const h = this.hero;
    if (!h) return;
    if (e.e === 'heroJump' && e.id === h.id) this.jumpPending = 0;
    if (e.e === 'death' && e.id === this.target) { this.target = 0; this.feedback('target', 0); }
  }

  // ------------------------------------------------------------ Bild
  update(dt) {
    const s = this.session;
    const h = this.hero;
    if (!this.enabled || !h || !s) return null;
    const K = this.keys;
    const both = this.lmb && this.rmb;
    let f = (K.has('moveForward') ? 1 : 0) - (K.has('moveBack') ? 1 : 0);
    if (this.autorun || both) f = 1;
    let st = (K.has('strafeRight') ? 1 : 0) - (K.has('strafeLeft') ? 1 : 0);
    let turn = 0;
    const turnKeys = (K.has('turnLeft') ? 1 : 0) - (K.has('turnRight') ? 1 : 0);
    if (this.rmb) st -= turnKeys; else turn = turnKeys;
    f = Math.max(-1, Math.min(1, f)); st = Math.max(-1, Math.min(1, st));
    const canAct = h.alive && !(h.stun > 0);
    if (!canAct) { turn = 0; }
    // Während der Schwenk-Pause (Sim eingefroren) steht der Held still – Drehen und Kamera gehen schon
    if (s.sim.freeze > 0 || s.sim.phase !== 'battle') { f = 0; st = 0; this.jumpPending = 0; this.jumpEdge = false; }
    this.input = { f, s: st, turn };
    // Drehen (A/D)
    if (turn) { const d = turn * HS.turnSpeed * dt; this.yaw = wrap(this.yaw + d); this.hcam.yaw += d; }
    if (this.rmb && canAct) this.yaw = wrap(this.hcam.yaw);
    // Kamera folgt beim Laufen hinter den Helden (wenn nicht frei gedreht wird)
    if (!this.lmb && !this.rmb && (f || st)) this.hcam.yaw += wrap(this.yaw - this.hcam.yaw) * (1 - Math.exp(-dt * 2.6));
    this.hcam.yaw = this.yaw + wrap(this.hcam.yaw - this.yaw);
    // Bewegung bricht eigene Zauber-Pose sofort ab (die Sim bricht im nächsten Tick ab)
    if ((f || st) && this.heroes.localCast()) this.heroes.localCancel('move');
    // Sprung-Bestätigung abwarten (max. 0,5 s)
    if (this.jumpPending && performance.now() - this.jumpPending > 500) this.jumpPending = 0;
    // Senden: Bewegungswechsel sofort, reine Drehung höchstens 20×/s
    const yawQ = Math.round(wrap(this.yaw) * 1000);
    const jump = this.jumpPending ? 1 : 0;
    const now = performance.now();
    const S = this.sent;
    const moveChanged = S.f !== f || S.s !== st || S.jump !== jump;
    const yawChanged = Math.abs(yawQ - S.yaw) > 2 && Math.abs(Math.abs(yawQ - S.yaw) - 6283) > 2;
    if (moveChanged || (yawChanged && now - S.t >= 50)) {
      s.submit({ type: 'hin', f, s: st, yaw: yawQ, jump });
      this.stats.hin++;
      this.sent = { f, s: st, yaw: yawQ, jump, t: now };
    }
    // Online: Verzögerung messen (Eingabe in der Sim angekommen?)
    const ph = s.sim.players[s.localPid].hin;
    if (s.online && ph && ph.f === this.sent.f && ph.s === this.sent.s && ph.yaw === this.sent.yaw && !this.sent.acked) {
      this.sent.acked = true; this.pred.observeLag(((now - this.sent.t) / 1000) * (s.speed || 1));
    }
    // Vorhersage
    const speed = s.speed || 1;
    const lag = s.online ? this.pred.lag : Math.min(SIM_DT, s.acc || 0);
    const P = this.pred.update(dt * speed, h, { f: canAct ? f : 0, s: canAct ? st : 0, face: this.yaw }, lag, this.laneX(), this.jumpEdge, !!this.jumpPending);
    this.jumpEdge = false;
    // Körpergeschwindigkeit für die Animation
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const prev = this.pose;
    let vf = P.vx * fx + P.vz * fz, vs = P.vx * -fz + P.vz * fx;
    if (!P.grounded) { vf *= 0.6; vs *= 0.6; }
    this.pose = { x: P.x, y: P.y, z: P.z, face: this.yaw, vf, vs, turn: turn * HS.turnSpeed, airborne: !P.grounded, vy: P.vy, grounded: P.grounded };
    // Ziel aufräumen
    if (this.target && !this.enemyAlive(this.target)) { this.target = 0; this.feedback('target', 0); }
    // Zielkreis für Bodenzauber
    if (this.placing) {
      const p = this.placing;
      const g = this.groundAt(this.mouse.x, this.mouse.y);
      if (g) {
        const dx = g.x - P.x, dz = g.z - P.z, d = Math.hypot(dx, dz);
        const max = p.ab.range || 10;
        p.ok = d <= max + 0.5;
        const k = d > max ? max / d : 1;
        p.x = P.x + dx * k; p.z = P.z + dz * k;
        const lx = this.laneX(), hw = 6.4;
        p.x = Math.max(lx - hw, Math.min(lx + hw, p.x));
      }
      this.heroes.setReticle({ x: p.x, z: p.z, r: p.ab.radius || 4, ok: p.ok });
    }
    // WoW-Hinweis: Auto-Angriff, aber Ziel hinter dem Helden
    if (h.auto && this.enemyAlive(h.target)) {
      const t = this.view.pos(h.target) || this.sim.entities.get(h.target);
      const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz);
      const def = this.def;
      if (d <= def.range + 1 && (dx * fx + dz * fz) / (d || 1) <= 0.2) {
        this.facingWarnT += dt;
        if (this.facingWarnT > 0.8) { this.error('Du musst dem Ziel zugewandt sein'); this.facingWarnT = -2.5; }
      } else this.facingWarnT = Math.min(this.facingWarnT, 0);
    }
    void prev;
    return this.pose;
  }

  groundAt(mx, my) {
    _ndc.set((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    return _ray.ray.intersectPlane(_plane, _hit) ? { x: _hit.x, z: _hit.z } : null;
  }

  /** Reichweitenprüfung für die Aktionsleiste: true = Ziel außer Reichweite (Taste rot) */
  outOfRange(slot) {
    const ab = this.abilityInfo(slot);
    if (!ab || !(ENEMY_TYPES.has(ab.type) || (ab.type === 'blink' && ab.behind))) return false;
    if (!this.enemyAlive(this.target)) return false;
    const P = this.pose || this.hero;
    const d = this.view.pos(this.target) || this.sim.entities.get(this.target);
    return Math.hypot(d.x - P.x, d.z - P.z) > (ab.range || 0) + 1.2;
  }
}
