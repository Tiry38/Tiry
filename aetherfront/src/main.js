// Aetherfront – Einstieg: verbindet Simulation, Grafik, Audio und Oberfläche.
import { Engine } from './render/engine.js';
import { RtsCamera } from './render/camera.js';
import { createEnvironment, loadEnvironmentAssets } from './render/environment.js';
import { UnitsView } from './render/units.js';
import { Fx } from './render/fx.js';
import { Overlay } from './render/overlay.js';
import { Portraits } from './render/portraits.js';
import { AudioEngine } from './audio/audio.js';
import { Settings } from './ui/settings.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { LocalSession, NetSession } from './net/session.js';
import { UNITS, SENDS, WAVES, FACTIONS, factionUnits } from './sim/data.js';
import { laneCenterX, kingPos } from './sim/layout.js';
import { MISSIONS, missionSetup, missionStars } from './sim/campaign.js';
import { modeCode } from './sim/modes.js';
import { Progress } from './ui/progress.js';
import * as THREE from 'three';
import { HeroesView } from './render/heroesView.js';
import { HeroPreview } from './render/heroPreview.js';
import { HeroCamera, HERO_FOV } from './hero/camera.js';
import { HeroControls } from './hero/controls.js';
import { Swoop, rtsPose, SWOOP_DUR } from './hero/transition.js';
import { CombatHud } from './hero/combatHud.js';

const $ = (id) => document.getElementById(id);
const BOT_NAMES = ['Aldric', 'Mira', 'Thorne', 'Kaela', 'Vex', 'Sorin', 'Lyra', 'Doran', 'Isolde', 'Ravik', 'Selka', 'Bram', 'Nyx', 'Corvin'];
const VERSION = '0.1.0';
const _sv = new THREE.Vector3();
const HERO_SFX = { strike: 'sword', aoe_self: 'explosion', taunt: 'boss', cone: 'arrow', bolt: 'magic', heal_area: 'heal', revive: 'upgrade', heal_self: 'heal', dash: 'blunt', leap: 'explosion', leap_back: 'jump', blink: 'magic', mark: 'magic', dot: 'sword', root_target: 'magic', shield: 'heal', aoe_ground: 'magic', pull: 'lightning', summon: 'build', turret: 'build', buff_self: 'upgrade', aura_vassals: 'upgrade', drain: 'magic' };

class App {
  constructor() {
    this.settings = new Settings();
    this.canvas = $('scene');
    this.engine = new Engine(this.canvas, this.settings);
    this.cam = new RtsCamera(this.engine.camera, this.canvas, this.settings);
    this.audio = new AudioEngine();
    this.audio.applySettings = () => this.applyAudio();
    this.applyAudio();
    this.portraits = new Portraits(160);
    this.heroPreview = new HeroPreview();
    this.vmode = 'rts';          // rts | swoopIn | hero | swoopOut – Kamera-/Steuerungsmodus
    this.deferred = [];          // Ereignisse, deren Darstellung auf den Treffer-Moment wartet
    this.rtsFov = this.engine.camera.fov;
    this.progress = new Progress();
    this.mode = 'boot';
    this.session = null;
    this.time = 0;
    this.mouse = { x: 0, y: 0, ground: null };
    this.placing = null;
    this.selected = null;
    this.hover = null;
    this.lastCountdown = -1;
    $('version').textContent = `v${VERSION}`;
    // Oberfläche passt sich der Fenstergröße an (Referenz 1760×990)
    const uiScale = () => {
      const z = Math.max(0.6, Math.min(1.3, Math.min(window.innerWidth / 1760, window.innerHeight / 990)));
      window.__uiZoom = z;
      $('ui').style.zoom = z;
    };
    uiScale();
    window.addEventListener('resize', uiScale);
  }

  async init() {
    $('loading').classList.add('show');
    await frame();
    // M1 Grafik: echte CC0-Assets (PBR/HDRI) vorab laden; fehlen sie, nutzt die Welt prozedurale Texturen
    const envAssets = await loadEnvironmentAssets(this.engine.renderer);
    this.env = createEnvironment({
      scene: this.engine.scene, renderer: this.engine.renderer, quality: this.settings.get('quality'),
      assets: envAssets, look: this.engine.look, settings: this.settings,
    });
    this.view = new UnitsView(this.engine.scene);
    this.fx = new Fx(this.engine.scene, this.engine.camera, this.settings);
    this.overlay = new Overlay(this.engine.scene, this.engine.camera);
    this.heroes = new HeroesView(this.engine.scene, this.fx, this.settings);
    this.hcam = new HeroCamera(this.engine.camera, this.settings);
    this.swoop = new Swoop({ camera: this.engine.camera, scene: this.engine.scene, engine: this.engine, audio: this.audio });
    this.heroes.abilityFx.shake = (a, x, z) => {
      const c = this.engine.camera.position;
      const k = Math.max(0, 1 - Math.hypot(x - c.x, z - c.z) / 60);
      if (this.vmode === 'hero') this.hcam.addShake(a * k); else if (!this.attract) this.cam.addShake(a * 0.5 * k);
    };
    // Alle Modelle vorab erzeugen (kein Ruckeln beim ersten Auftauchen)
    this.view.warmup([...Object.values(UNITS), ...WAVES, ...SENDS]);
    this.engine.applySettings();
    try { this.engine.renderer.compile(this.engine.scene, this.engine.camera); } catch { /* optional */ }

    this.hud = new Hud({
      portraits: this.portraits, audio: this.audio, settings: this.settings,
      submit: (cmd) => this.session && this.session.submit(cmd),
      onPlace: (u) => this.startPlacing(u),
      onSelect: (e) => { this.selected = e; },
      onFocusLane: (pid) => this.focusLane(pid),
      onFocusKing: (t) => { const k = kingPos(t); this.cam.focus(k.x, k.z - 6, 55); },
      onPause: () => this.pause(),
    });
    this.combat = new CombatHud({
      settings: this.settings, audio: this.audio, portraits: this.portraits, heroPreview: this.heroPreview,
      getSession: () => this.session, heroes: this.heroes, view: this.view,
    });
    this.controls = new HeroControls({
      canvas: this.canvas, settings: this.settings, camera: this.engine.camera, hcam: this.hcam, heroes: this.heroes, view: this.view, audio: this.audio,
      getSession: () => this.session,
      onError: (m) => this.combat.error(m),
      onMenu: () => this.pause(),
      onFeedback: (k, d) => this.combat.feedback(k, d),
    });
    this.combat.controls = this.controls;
    this.settings.onChange((k) => { if (k === 'keybinds') this.combat.refreshKeys(); });
    this.menus = new Menus({
      settings: this.settings, audio: this.audio, portraits: this.portraits, progress: this.progress, heroPreview: this.heroPreview,
      onStart: (cfg) => this.startGame(cfg),
      onStartMission: (m, opts) => this.startMission(m, opts),
      onResume: () => this.resume(),
      onSurrender: () => this.toMenu(),
      onRematch: () => (this.mission ? this.startMission(this.mission, this.missionOpts) : this.startGame(this.lastConfig)),
      onToMenu: () => this.toMenu(),
      onQuit: () => window.aetherfront && window.aetherfront.quit(),
      onApplyGraphics: () => { this.engine.applySettings(); this.env.setQuality && this.env.setQuality(this.settings.get('quality')); },
      onMultiplayerStart: (mp, start) => this.startOnline(mp, start),
    });
    this.settings.onChange((k) => { if (k === 'quality') this.audio.setQuality(this.settings.get('quality') === 'low' ? 'low' : 'high'); });
    this.bindInput();
    this.startAttract();
    $('loading').classList.remove('show');
    this.mode = 'splash';
    const go = async () => {
      window.removeEventListener('keydown', go); this.canvas.removeEventListener('pointerdown', go); $('screen-splash').removeEventListener('pointerdown', go);
      await this.audio.unlock();
      this.audio.playMusic('menu');
      this.audio.ui('confirm');
      this.mode = 'menu';
      this.menus.go('menu');
    };
    window.addEventListener('keydown', go);
    $('screen-splash').addEventListener('pointerdown', go);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    if (window.aetherfront && this.settings.get('fullscreen')) window.aetherfront.setFullscreen(true);
  }

  applyAudio() {
    const S = this.settings;
    this.audio.setMuted(!!S.get('muted'));
    this.audio.setVolume('master', S.get('volMaster'));
    this.audio.setVolume('music', S.get('volMusic'));
    this.audio.setVolume('sfx', S.get('volSfx'));
    this.audio.setVolume('ui', S.get('volUi'));
  }

  // ---------- Sitzungen ----------
  startAttract() {
    const players = [];
    for (let i = 0; i < 8; i++) players.push({ name: BOT_NAMES[i], team: i % 2, faction: 'random', bot: true, difficulty: 'hard' });
    this.setSession(new LocalSession({ seed: (Math.random() * 1e9) | 0, players }, -1));
    this.session.speed = 1.6;
    this.attract = true;
    this.cam.enabled = false;
    this.cam.cinematic = (t) => {
      const shot = Math.floor(t / 16) % 4;
      const u = (t % 16) / 16;
      if (shot === 0) return { x: -40 + u * 80, z: 10, dist: 150, yaw: 0.25 - u * 0.5, pitch: 0.55 };
      if (shot === 1) return { x: laneCenterX(0, 1), z: -6 + u * 10, dist: 48, yaw: -0.7 + u * 0.4, pitch: 0.5 };
      if (shot === 2) return { x: 70, z: 40, dist: 60, yaw: 2.6 + u * 0.6, pitch: 0.42 };
      return { x: laneCenterX(1, 2), z: -10, dist: 55, yaw: 0.6 - u * 0.5, pitch: 0.62 };
    };
  }

  setSession(s) {
    if (this.session) this.session.dispose();
    this.session = s;
    this.view.clear();
    this.fx.clear();
    this.heroes.clear();
    this.combat.clear();
    this.exitHeroMode(true);
    this.deferred.length = 0;
    this.selected = null; this.placing = null; this.hover = null;
    this.gameOverAt = null;
  }

  buildSetup(cfg) {
    const n = cfg.teamSize;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const players = [{ name: cfg.name, team: 0, faction: cfg.faction, bot: false, hero: cfg.hero || this.settings.get('hero') }];
    for (let i = 1; i < n * 2; i++) players.push({ name: names[i % names.length], team: i % 2, faction: 'random', bot: true, difficulty: i % 2 === 0 ? (cfg.allyDifficulty || 'normal') : cfg.difficulty });
    return { seed: (Math.random() * 1e9) | 0, players, rules: cfg.rules || {} };
  }

  startMission(m, opts) {
    this.mission = m;
    this.missionOpts = opts;
    const setup = missionSetup(m, { name: this.settings.get('playerName') || 'Tiry', faction: opts.faction, difficulty: opts.difficulty, totalStars: this.progress.total });
    setup.players[0].hero = this.settings.get('hero');
    const s = new LocalSession(setup, 0);
    s.speed = this.settings.get('gameSpeed') || 1;
    this.enterGame(s);
  }

  startGame(cfg) {
    this.mission = null;
    this.lastConfig = cfg;
    const s = new LocalSession(this.buildSetup(cfg), 0);
    s.speed = this.settings.get('gameSpeed') || 1;
    this.enterGame(s);
  }

  startOnline(mp, start) {
    const transport = {
      send: (o) => { if (mp.ws.readyState === 1) mp.ws.send(JSON.stringify(o)); },
      onMessage: (fn) => mp.handlers.push(fn),
      close: () => { try { mp.ws.close(); } catch { /* egal */ } },
    };
    if (start.you < 0) { this.hud.toast('Zuschauer-Modus wird noch nicht unterstützt'); return; }
    this.mission = null;
    this.enterGame(new NetSession(transport, start));
  }

  enterGame(session) {
    this.attract = false;
    this.setSession(session);
    const sim = session.sim;
    const me = sim.players[session.localPid];
    this.me = me;
    this.overlay.setLane(me.team, me.slot);
    if (sim.rules.champions) this.view.warmup(sim.waves.map((w) => w.champ).filter(Boolean));
    this.hud.build(session);
    this.combat.build(session);
    this.menus.inGame = true;
    this.mode = 'game';
    this.menus.go('hud');
    this.cam.cinematic = null;
    this.cam.enabled = true;
    // Kamerafahrt: vom Überblick zur eigenen Bahn
    const lx = laneCenterX(me.team, me.slot);
    this.cam.focus(0, 10, 190, { instant: true, yaw: 0, pitch: 0.9 });
    setTimeout(() => this.cam.focus(lx, 4, 58, { yaw: 0, pitch: 0.98 }), 250);
    this.audio.playMusic('build');
    const facName = me.faction === 'hybrid' ? 'Hybrid' : FACTIONS[me.faction].name;
    if (this.mission) {
      this.hud.banner(this.mission.title.toUpperCase(), `Mission ${this.mission.id} · ${this.mission.goal === 'siege' ? 'Belagerung' : 'Halten'}`);
      this.hud.feed(this.mission.goal === 'siege' ? 'Schicke Söldner (1–7) gegen die Rissfeste – und halte deine Bahn!' : 'Halte deine Bahn bis zur letzten Welle!', 'good');
      if (this.mission.tips) this.hud.feed(this.mission.tips[0], '');
    } else {
      this.hud.banner(`AETHERFRONT · ${modeCode(sim.rules)}`, `${facName} · Bahn ${me.slot + 1} · Team ${me.team === 0 ? 'West' : 'Ost'}`);
      this.hud.feed('Setze Kämpfer mit Q W E R T auf dein leuchtendes Bauraster.', 'good');
    }
  }

  focusLane(pid) {
    const p = this.session.sim.players[pid];
    this.cam.focus(laneCenterX(p.team, p.slot), 2, 58);
  }

  pause() {
    if (this.mode !== 'game' || this.gameOverAt) return;
    if (!this.session.online) this.session.paused = true;
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.menus.go('pause');
    this.audio.ui('open');
  }
  resume() {
    this.session.paused = false;
    this.menus.go('hud');
  }
  toMenu() {
    const back = this.mission ? 'campaign' : 'menu';
    this.mission = null;
    this.menus.inGame = false;
    this.startAttract();
    this.mode = 'menu';
    this.menus.go('menu');
    if (back === 'campaign') this.menus.go('campaign', true);
    this.audio.playMusic('menu');
    this.hud.toggleKingPanel(false);
    this.hud.showScoreboard(false);
  }

  // ---------- Eingabe ----------
  startPlacing(u) {
    if (this.session.sim.phase !== 'build') { this.hud.toast('Bauen nur in der Bauphase'); this.audio.ui('error'); return; }
    this.placing = u;
    this.hud.setPlacing(u);
  }
  stopPlacing() { this.placing = null; this.hud.setPlacing(null); }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.mode !== 'game' || this.vmode !== 'rts') return; if (this.placing) this.stopPlacing(); else this.select(null); });
    c.addEventListener('mousedown', (e) => {
      if (this.mode !== 'game' || e.button !== 0 || this.vmode !== 'rts') return;
      const sim = this.session.sim;
      if (this.placing) {
        const cell = this.overlay.cellAt(this.mouse.ground);
        if (cell) {
          this.session.submit({ type: 'build', unit: this.placing.id, col: cell.col, row: cell.row });
          if (!e.shiftKey) this.stopPlacing();
        }
        return;
      }
      this.select(this.hover ? sim.entities.get(this.hover) : null);
      if (this.hover) this.audio.ui('click');
    });
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'game') return;
      if (e.target.closest && e.target.closest('input')) return;
      // Heldenblick: WoW-Steuerung hat Vorrang (Esc ohne Ziel öffnet das Menü)
      if (this.vmode === 'hero' && this.menus.current === 'hud' && this.controls.onKeyDown(e)) return;
      if (this.vmode !== 'rts' && this.menus.current === 'hud' && e.key !== 'Escape') { if (['Tab', ' '].includes(e.key)) e.preventDefault(); return; }
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const sim = this.session.sim;
      const me = this.me;
      if (k === 'Escape') {
        if (this.menus.current === 'pause') { this.resume(); return; }
        if (this.menus.current === 'end') return;
        if (this.menus.current !== 'hud') { this.menus.back(); return; }
        if (this.placing) this.stopPlacing(); else if (this.selected) this.select(null); else this.pause();
        return;
      }
      if (this.menus.current !== 'hud') return;
      if (k === 'Tab') { e.preventDefault(); this.hud.showScoreboard(true); return; }
      const li = ['Q', 'W', 'E', 'R', 'T'].indexOf(k);
      if (li >= 0 && me.lines[li]) { this.startPlacing(UNITS[me.lines[li]]); return; }
      const s = SENDS.find((x) => x.hotkey === k);
      if (s) { this.session.submit({ type: 'send', send: s.id }); return; }
      if (k === 'U' && this.selected && this.selected.type === 'f') this.session.submit({ type: 'upgrade', id: this.selected.id });
      else if ((k === 'X' || k === 'Delete') && this.selected && this.selected.type === 'f') this.session.submit({ type: 'sell', id: this.selected.id });
      else if (k === 'B') this.session.submit({ type: 'worker' });
      else if (k === 'H') this.session.submit({ type: 'heal' });
      else if (k === 'K') this.hud.toggleKingPanel();
      else if (k === 'Enter') { if (sim.phase === 'build') { this.session.submit({ type: 'ready' }); this.audio.ui('confirm'); } }
      else if (k === ' ') { e.preventDefault(); this.focusLane(me.id); }
      else if (k === 'Home') { const kp = kingPos(me.team); this.cam.focus(kp.x, kp.z - 6, 55); }
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Tab') { e.preventDefault(); if (this.vmode === 'rts') this.hud.showScoreboard(false); } });
  }

  select(ent) {
    this.selected = ent || null;
    this.hud.setSelected(this.selected);
  }

  pickHover() {
    const g = (this.mouse.ground = this.overlay.screenToGround(this.mouse.x, this.mouse.y));
    this.hover = null;
    if (!g || this.placing) return;
    let best = 1.6 * 1.6;
    for (const e of this.session.sim.entities.values()) {
      if (e.type === 'p' || !e.alive) continue;
      const d = this.view.pos(e.id);
      if (!d) continue;
      const dd = (d.x - g.x) ** 2 + (d.z - g.z) ** 2;
      if (dd < best) { best = dd; this.hover = e.id; }
    }
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  }

  // ---------- Ereignisse → Ton ----------
  sfxAt(name, x, z, vol = 1, pitch) {
    // Hörer = Kamera (RTS: Blickpunkt am Boden, Heldenblick: Held), Panorama aus dem Kameraraum
    let lx, lz, range;
    if (this.vmode === 'rts') { const c = this.cam.cur; lx = c.x; lz = c.z; range = 30 + c.dist * 0.9; } else { const p = this.hcam.pose.look; lx = p.x; lz = p.z; range = 46; }
    const d = Math.hypot(x - lx, z - lz);
    if (d > range) return;
    const v = vol * (1 - d / range) * (this.attract ? 0.35 : 1);
    if (v < 0.03) return;
    _sv.set(x, 1, z).applyMatrix4(this.engine.camera.matrixWorldInverse);
    this.audio.sfx(name, { volume: v, pan: Math.max(-1, Math.min(1, _sv.x / 22)), pitch });
  }
  entPos(id) { return this.view.pos(id) || this.heroes.posOf(id); }

  handleEvents(events) {
    const sim = this.session.sim;
    for (const e of events) {
      // Animationen sofort (Ausholen beginnt), Treffer-Darstellung ggf. im Einschlag-Moment
      this.heroes.onEvent(e, sim);
      this.controls.onEvent(e);
      const d = this.heroes.presentDelay(e, sim);
      if (d > 0.01) {
        if (e.e === 'death') this.view.onEvent({ ...e, delay: d }, sim);
        this.deferred.push({ t: d, e, skipView: e.e === 'death' });
      } else this.present(e);
      this.onSimEvent(e);
    }
    this.heroes.endBatch();
  }

  /** Verzögerte Ereignisse fällig? */
  flushDeferred(dt) {
    for (let i = this.deferred.length - 1; i >= 0; i--) {
      const it = this.deferred[i];
      it.t -= dt;
      if (it.t <= 0) { this.deferred.splice(i, 1); this.present(it.e, it.skipView); }
    }
  }

  /** Steuerungs-relevante Ereignisse (sofort): Modus-Wechsel Held ↔ Vogelperspektive */
  onSimEvent(e) {
    if (this.mode !== 'game') return;
    const local = this.session.localPid;
    switch (e.e) {
      case 'waveStart': this.startSwoopIn(); break;
      case 'waveEnd': if (this.vmode !== 'rts') this.startSwoopOut(); break;
      case 'heroDeath': if (e.pid === local) this.onLocalHeroDeath(e); break;
      case 'heroError': if (e.pid === local && this.vmode === 'hero') this.combat.error(e.reason); break;
      case 'heroJump': { const h = this.session.sim.entities.get(e.id); if (h && h.owner === local) this.audio.sfx('jump', { volume: 0.5 }); break; }
      default: break;
    }
  }

  present(e, skipView = false) {
    const sim = this.session.sim;
    const local = this.session.localPid;
    const inGame = this.mode === 'game';
    {
      if (!skipView) this.view.onEvent(e, sim);
      this.fx.onEvent(e, sim, this.view, local);
      this.heroes.abilityFx.onEvent(e, sim, (id) => this.entPos(id));
      if (inGame) { this.hud.onEvent(e); this.combat.onEvent(e); }
      switch (e.e) {
        case 'heroAbility': {
          const p = this.entPos(e.id) || e;
          const name = HERO_SFX[e.type] || 'magic';
          this.sfxAt(name, e.tx ?? p.x, e.tz ?? p.z, e.pid === local ? 1 : 0.6, e.ult ? 0.8 : 1);
          if (['strike', 'aoe_self', 'leap', 'dash'].includes(e.type)) this.sfxAt('swing', p.x, p.z, 0.6);
          break;
        }
        case 'attack': {
          const ent = sim.entities.get(e.id);
          const d = ent && this.entPos(e.id);
          if (!d) break;
          if (ent.type === 'h' && e.melee) this.sfxAt('swing', d.x, d.z, 0.5);
          if (e.melee) this.sfxAt(e.atk === 'wucht' ? 'blunt' : 'sword', d.x, d.z, 0.55, 0.9 + Math.random() * 0.2);
          else this.sfxAt(e.kind === 'arrow' ? 'arrow' : e.kind === 'shell' || e.kind === 'bone' ? 'fire' : 'magic', d.x, d.z, 0.45, 0.9 + Math.random() * 0.2);
          break;
        }
        case 'chain': this.sfxAt('lightning', e.path[0][0], e.path[0][1], 0.6); break;
        case 'splash': this.sfxAt('explosion', e.x, e.z, 0.45); break;
        case 'heal': this.sfxAt('heal', e.x, e.z, 0.4); break;
        case 'death':
          this.sfxAt(e.type === 'c' ? 'death_creep' : 'death_unit', e.x, e.z, e.boss ? 1 : 0.5);
          if (e.boss) { this.cam.addShake(1); this.engine.hitFlash(0.25, 0xffc070); }
          break;
        case 'build': if (e.pid === local) this.audio.sfx('build'); break;
        case 'upgrade': if (e.pid === local) this.audio.sfx('upgrade'); break;
        case 'sell': if (e.pid === local) this.audio.sfx('sell'); break;
        case 'gold': if (e.pid === local) this.audio.sfx('gold', { volume: 0.35 }); break;
        case 'send': if (e.pid === local || e.to === local) this.audio.sfx('send', { volume: e.pid === local ? 0.8 : 0.5 }); break;
        case 'worker': if (e.pid === local) this.audio.sfx('worker'); break;
        case 'income': if (e.pid === local) this.audio.sfx('income'); break;
        case 'king': if (sim.players[e.pid].team === this.me?.team && inGame) this.audio.sfx('upgrade', { volume: 0.6, pitch: 0.8 }); break;
        case 'kingHeal': if (inGame && e.team === this.me.team) this.audio.sfx('heal'); break;
        case 'leak': if (inGame && e.pid === local) this.audio.sfx('leak', { volume: 0.7 }); break;
        case 'kingHit':
          if (inGame && e.team === this.me.team) { this.engine.hitFlash(0.18); this.audio.sfx('king_hit', { volume: 0.6 }); }
          break;
        case 'waveStart':
          if (inGame) {
            this.audio.sfx(e.boss ? 'boss' : 'wave_start');
            this.audio.playMusic(e.boss ? 'boss' : 'battle');
            if (this.vmode === 'rts') this.cam.addShake(0.4);
          }
          break;
        case 'waveEnd': if (inGame) { this.audio.sfx('wave_clear'); this.audio.playMusic('build'); } break;
        case 'gameOver': if (inGame) this.onGameOver(e); else this.restartAttractSoon = true; break;
        default: break;
      }
    }
  }

  onGameOver(e) {
    const me = this.me;
    if (this.vmode !== 'rts') this.exitHeroMode(false, true);
    const win = e.winner === me.team, draw = e.winner === -1;
    this.gameOverAt = performance.now();
    this.audio.playMusic(win ? 'victory' : 'defeat');
    this.audio.sfx(win ? 'victory' : 'defeat');
    const loser = draw ? me.team : 1 - (e.winner);
    const kp = kingPos(loser);
    this.cam.focus(kp.x, kp.z - 4, 45);
    const m = this.mission;
    let stars = 0;
    if (m) { stars = missionStars(m, this.session.sim); if (stars) this.progress.record(m.id, stars); }
    setTimeout(() => {
      const sim = this.session.sim;
      $('end-title').textContent = m ? (win ? 'MISSION ERFÜLLT' : 'MISSION GESCHEITERT') : draw ? 'UNENTSCHIEDEN' : win ? 'SIEG' : 'NIEDERLAGE';
      $('end-title').className = `end-title${win ? '' : ' lose'}`;
      $('end-sub').innerHTML = `${e.reason} · Welle ${sim.wave}${m && win ? `<div class="end-stars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></div>` : ''}`;
      const st = [[sim.wave, 'Welle'], [sim.armyValue(me.id).toLocaleString('de-DE'), 'Armeewert'], [me.stats.kills, 'Besiegt'], [me.stats.leaks, 'Durchbrüche'], [me.stats.sent, 'Söldner'], [me.income, 'Einkommen']];
      $('end-stats').innerHTML = st.map(([v, l]) => `<div class="st"><b>${v}</b><small>${l}</small></div>`).join('');
      $('btn-rematch').textContent = m ? 'Erneut versuchen' : 'Revanche';
      const next = m && win && MISSIONS.find((x) => x.id === m.id + 1);
      let nb = $('btn-next');
      if (!nb) { nb = document.createElement('button'); nb.id = 'btn-next'; nb.className = 'btn big primary'; $('btn-rematch').before(nb); nb.addEventListener('click', () => { this.audio.ui('confirm'); const n = MISSIONS.find((x) => x.id === this.mission.id + 1); this.settings.set('campMission', n.id); this.startMission(n, this.missionOpts); }); }
      nb.style.display = next ? '' : 'none';
      if (next) nb.textContent = `Weiter: ${next.title}`;
      $('btn-rematch').className = next ? 'btn big' : 'btn big primary';
      $('btn-tomenu').textContent = m ? 'Zur Kampagne' : 'Hauptmenü';
      this.menus.go('end');
    }, 2800);
  }

  // ---------- Heldenblick ↔ Vogelperspektive ----------
  swoopMode() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = this.settings.get('swoop') || 'normal';
    return reduce ? 'off' : SWOOP_DUR[m] != null ? m : 'normal';
  }
  /** Überblenden statt Kamerafahrt: Bild abdunkeln, schneiden, aufhellen */
  crossfade(cut, done) {
    const x = $('xfade');
    x.classList.add('on');
    setTimeout(() => { cut(); requestAnimationFrame(() => { x.classList.remove('on'); done && done(); }); }, 300);
  }
  startSwoopIn() {
    const s = this.session, sim = s.sim;
    const h = sim.heroOf(s.localPid);
    if (!h || !h.alive || !sim.rules.heroes || this.vmode === 'hero' || this.vmode === 'swoopIn') return;
    this.stopPlacing(); this.select(null); this.hud.showScoreboard(false); this.hud.toggleKingPanel(false);
    this.swoop.cancel();
    this.vmode = 'swoopIn';
    this.cam.enabled = false;
    this.hcam.reset(h.face);
    this.hcam.stopSpectate();
    this.combat.build(s);
    document.body.classList.add('hero-view');
    const lx = sim.laneX(s.localPid);
    const cam = this.engine.camera;
    const to = () => { const p = this.hcam.targetPose(h.x, h.y || 0, h.z, lx, h.face); return { pos: p.pos, look: p.look, fov: HERO_FOV }; };
    const finish = () => { this.vmode = 'hero'; this.controls.enable(); this.combat.show(true); this.hcam.fov = HERO_FOV; };
    const mode = this.swoopMode();
    if (mode === 'off') {
      this.crossfade(() => { const e = to(); cam.position.copy(e.pos); cam.lookAt(e.look); cam.fov = HERO_FOV; cam.updateProjectionMatrix(); finish(); });
      return;
    }
    const dur = Math.min(SWOOP_DUR[mode], Math.max(0.6, sim.freeze / (s.speed || 1)));
    const look = new THREE.Vector3(this.cam.cur.x, 0, this.cam.cur.z - 2);
    this.swoop.start({ kind: 'in', from: { pos: cam.position.clone(), look, fov: cam.fov }, to, dur,
      onProgress: (x) => { if (x > 0.55 && !this.combat.visible) this.combat.show(true); },
      onDone: finish });
  }
  /** Zurück in die Vogelperspektive (Wellenende oder Heldentod) */
  startSwoopOut() {
    const s = this.session, me = this.me;
    if (!s || this.vmode === 'rts' || this.vmode === 'swoopOut') return;
    this.controls.disable();
    this.combat.show(false);
    this.hcam.stopSpectate();
    this.swoop.cancel();
    this.vmode = 'swoopOut';
    const lx = laneCenterX(me.team, me.slot);
    this.cam.focus(lx, 4, 58, { instant: true, yaw: 0, pitch: 0.98 });
    const end = rtsPose(this.cam.cur);
    const cam = this.engine.camera;
    const finish = () => { this.vmode = 'rts'; this.cam.enabled = true; document.body.classList.remove('hero-view'); cam.fov = this.rtsFov; cam.updateProjectionMatrix(); };
    const mode = this.swoopMode();
    if (mode === 'off') { this.crossfade(finish); return; }
    const look = this.hcam.pose.look.clone();
    this.swoop.start({ kind: 'out', from: { pos: cam.position.clone(), look, fov: cam.fov }, to: () => ({ pos: end.pos, look: end.look, fov: this.rtsFov }), dur: SWOOP_DUR[mode] * (mode === 'normal' ? 0.9 : 1),
      onProgress: (x) => { if (x > 0.45) document.body.classList.remove('hero-view'); },
      onDone: finish });
  }
  /** Eigener Held gefallen: kurzer Zuschauerblick, dann Schwenk in die Vogelperspektive (Vasallen kämpfen weiter) */
  onLocalHeroDeath(e) {
    if (this.vmode !== 'hero') return;
    this.controls.disable();
    this.combat.show(false);
    this.vmode = 'dead';
    this.hcam.startSpectate(e.x, e.z);
    this.audio.sfx('defeat', { volume: 0.35 });
    this.hud.banner('DEIN HELD IST GEFALLEN', 'Deine Vasallen kämpfen allein weiter', true);
    this.hud.feed('Dein Held ist gefallen – deine Vasallen kämpfen allein weiter. Er kehrt zur nächsten Bauphase zurück.', 'bad');
    clearTimeout(this.deathT);
    this.deathT = setTimeout(() => { if (this.vmode === 'dead') this.startSwoopOut(); }, 1700);
  }
  /** Heldenmodus sofort beenden (Sitzungswechsel / Spielende) */
  exitHeroMode(instant, fade = false) {
    clearTimeout(this.deathT);
    this.swoop?.cancel();
    this.controls?.disable();
    this.combat?.show(false);
    this.hcam?.stopSpectate();
    document.body.classList.remove('hero-view');
    const was = this.vmode;
    this.vmode = 'rts';
    if (this.cam) this.cam.enabled = !this.attract;
    const cam = this.engine.camera;
    if (cam.fov !== this.rtsFov) { cam.fov = this.rtsFov; cam.updateProjectionMatrix(); }
    cam.up.set(0, 1, 0);
    if (fade && was !== 'rts' && !instant) this.crossfade(() => {});
  }

  // ---------- Hauptschleife ----------
  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const s = this.session;
    if (s) {
      if (this.mode === 'game' && !s.online) s.speed = this.settings.get('gameSpeed') || 1;
      const events = s.update(dt);
      this.handleEvents(events);
      this.flushDeferred(dt);
      const sim = s.sim;
      let pose = null;
      if (this.mode === 'game' && this.vmode !== 'rts') {
        if (this.vmode === 'hero') pose = this.controls.update(dt);
        this.overlay.update(dt, { showGrid: false });
        if (this.placing) this.stopPlacing();
        if (sim.phase === 'battle') {
          let n = 0; for (const e of sim.entities.values()) if (e.type === 'c' && (e.lane === this.me.id || e.stage === 'king')) n++;
          const k = sim.teams[this.me.team].king;
          this.audio.setIntensity(Math.min(1, n / 14 + (1 - k.hp / k.maxHp) * 0.6));
        }
        this.hud.update(dt);
      } else if (this.mode === 'game') {
        this.pickHover();
        if (this.placing && sim.phase !== 'build') this.stopPlacing();
        const occupied = new Set();
        for (const f of sim.fightersOf(this.me.id)) occupied.add(`${f.col},${f.row}`);
        const sel = this.selected && sim.entities.get(this.selected.id);
        const selDef = sel && (sel.type === 'f' ? UNITS[sel.def] : sel.def);
        const selPos = sel && this.view.pos(sel.id);
        this.overlay.update(dt, {
          showGrid: sim.phase === 'build' || !!this.placing,
          occupied,
          hoverCell: this.overlay.cellAt(this.mouse.ground),
          placing: this.placing,
          canAfford: this.placing ? this.me.gold >= this.placing.cost : true,
          selected: selPos && selDef ? { x: selPos.x, z: selPos.z, range: selDef.range } : null,
        });
        // Countdown-Ticks in den letzten Sekunden
        if (sim.phase === 'build') {
          const t = Math.ceil(sim.phaseTime);
          if (t <= 5 && t !== this.lastCountdown && t > 0) { this.lastCountdown = t; this.audio.sfx('countdown', { volume: 0.5 }); }
        }
        // Musikintensität: Gegner in der eigenen Bahn + Druck auf den König
        if (sim.phase === 'battle') {
          let n = 0; for (const e of sim.entities.values()) if (e.type === 'c' && (e.lane === this.me.id || e.stage === 'king')) n++;
          const k = sim.teams[this.me.team].king;
          this.audio.setIntensity(Math.min(1, n / 14 + (1 - k.hp / k.maxHp) * 0.6));
        }
        this.hud.update(dt);
      } else {
        this.overlay.update(dt, { showGrid: false });
        if (sim.phase === 'over' && !this.restartTimer) {
          this.restartTimer = setTimeout(() => { this.restartTimer = null; if (this.attract) this.startAttract(); }, 6000);
        }
      }
      this.view.update(sim, dt, { selectedId: this.selected?.id, hoverId: this.hover, localPid: s.localPid, hideCreepBars: this.vmode === 'hero' });
      // Kamera: Vogelperspektive, Windzug-Schwenk oder Heldenblick
      if (this.swoop.running) this.swoop.update(dt);
      else if (this.vmode === 'hero' || this.vmode === 'dead') {
        const h = sim.heroOf(s.localPid);
        const P = pose || (h ? { x: h.x, y: h.y || 0, z: h.z } : null);
        if (P) this.hcam.update(dt, P.x, P.y, P.z, sim.laneX(s.localPid), this.time);
      } else this.cam.update(dt, this.time);
      this.heroes.update(sim, dt, { localPid: this.attract ? -1 : s.localPid, local: pose, plates: this.mode === 'game', camera: this.engine.camera, heroMode: this.vmode === 'hero' || this.vmode === 'swoopIn' });
      if (this.mode === 'game') this.combat.update(dt, { camera: this.engine.camera, camYaw: this.vmode === 'hero' ? this.hcam.yaw : null });
      this.fx.update(sim, dt);
    } else this.cam.update(dt, this.time);
    this.env.update(dt, this.time);
    this.engine.render(dt);
    this.fpsCount(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  fpsCount(dt) {
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc >= 0.5) {
      const el = $('fps');
      if (el) el.textContent = this.settings.get('showFps') ? `${Math.round(this.fpsN / this.fpsAcc)} FPS · ${this.engine.renderer.info.render.calls} Draw-Calls` : '';
      this.fpsAcc = 0; this.fpsN = 0;
    }
  }
}

function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }

const app = new App();
window.__app = app;
app.init().catch((err) => {
  console.error(err);
  const l = $('loading');
  l.classList.add('show');
  l.innerHTML = `<div style="max-width:640px;text-align:center;line-height:1.6">Fehler beim Start:<br><code>${String(err && err.message || err)}</code></div>`;
});
