// Aetherfront – Einstieg: verbindet Simulation, Grafik, Audio und Oberfläche.
import { Engine } from './render/engine.js';
import { RtsCamera } from './render/camera.js';
import { createEnvironment } from './render/environment.js';
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

const $ = (id) => document.getElementById(id);
const BOT_NAMES = ['Aldric', 'Mira', 'Thorne', 'Kaela', 'Vex', 'Sorin', 'Lyra', 'Doran', 'Isolde', 'Ravik', 'Selka', 'Bram', 'Nyx', 'Corvin'];
const VERSION = '0.1.0';

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
    this.env = createEnvironment({ scene: this.engine.scene, renderer: this.engine.renderer, quality: this.settings.get('quality') });
    this.view = new UnitsView(this.engine.scene);
    this.fx = new Fx(this.engine.scene, this.engine.camera, this.settings);
    this.overlay = new Overlay(this.engine.scene, this.engine.camera);
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
    this.menus = new Menus({
      settings: this.settings, audio: this.audio, portraits: this.portraits, progress: this.progress,
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
    this.selected = null; this.placing = null; this.hover = null;
    this.gameOverAt = null;
  }

  buildSetup(cfg) {
    const n = cfg.teamSize;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const players = [{ name: cfg.name, team: 0, faction: cfg.faction, bot: false }];
    for (let i = 1; i < n * 2; i++) players.push({ name: names[i % names.length], team: i % 2, faction: 'random', bot: true, difficulty: i % 2 === 0 ? (cfg.allyDifficulty || 'normal') : cfg.difficulty });
    return { seed: (Math.random() * 1e9) | 0, players, rules: cfg.rules || {} };
  }

  startMission(m, opts) {
    this.mission = m;
    this.missionOpts = opts;
    const setup = missionSetup(m, { name: this.settings.get('playerName') || 'Tiry', faction: opts.faction, difficulty: opts.difficulty, totalStars: this.progress.total });
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
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.mode !== 'game') return; if (this.placing) this.stopPlacing(); else this.select(null); });
    c.addEventListener('mousedown', (e) => {
      if (this.mode !== 'game' || e.button !== 0) return;
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
    window.addEventListener('keyup', (e) => { if (e.key === 'Tab') { e.preventDefault(); this.hud.showScoreboard(false); } });
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
    const c = this.cam.cur;
    const d = Math.hypot(x - c.x, z - c.z);
    const range = 30 + c.dist * 0.9;
    if (d > range) return;
    const v = vol * (1 - d / range) * (this.attract ? 0.35 : 1);
    if (v < 0.03) return;
    this.audio.sfx(name, { volume: v, pan: Math.max(-1, Math.min(1, (x - c.x) / 45)), pitch });
  }

  handleEvents(events) {
    const sim = this.session.sim;
    const local = this.session.localPid;
    const inGame = this.mode === 'game';
    for (const e of events) {
      this.view.onEvent(e, sim);
      this.fx.onEvent(e, sim, this.view, local);
      if (inGame) this.hud.onEvent(e);
      switch (e.e) {
        case 'attack': {
          const ent = sim.entities.get(e.id);
          const d = ent && this.view.pos(e.id);
          if (!d) break;
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
            this.cam.addShake(0.4);
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
      const sim = s.sim;
      if (this.mode === 'game') {
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
      this.view.update(sim, dt, { selectedId: this.selected?.id, hoverId: this.hover, localPid: s.localPid });
      this.fx.update(sim, dt);
    }
    this.env.update(dt, this.time);
    this.cam.update(dt, this.time);
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
