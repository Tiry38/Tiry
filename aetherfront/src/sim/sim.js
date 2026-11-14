// Aetherfront – deterministische Spielsimulation (feste 20 Ticks/s).
// Alle Spieleraktionen kommen als Befehle herein (applyCommand) – identisch für Einzelspieler,
// Bots und später Online-Lockstep. Kein Math.random, keine Zeitabhängigkeit vom Rendering.

import { Rng } from './rng.js';
import {
  ECON, UNITS, WAVES, SENDS, KING, FACTIONS, FACTION_IDS, DAMAGE_TABLE, armorReduction, kingUpgradeCost,
} from './data.js';
import {
  GRID_COLS, GRID_ROWS, LANE_WIDTH, LANE_SPAWN_Z, LANE_END_Z, laneCenterX, kingPos, cellCenter, slotsForTeamSize,
} from './layout.js';
import { botThink } from './ai.js';
import { FACTION_LINES } from './data.js';
import { HEROES, HERO_IDS } from './heroes.js';
import { leaderDef, bossKit, updateLeader, leaderAura } from './leader.js';
import { createMission, missionHook } from './missions.js';
import { createHero, heroCommand, updateHero, heroWaveStart, heroWaveEnd, heroTakeDamage, heroDied, heroGainXp, heroBotThink, heroArmor, heroArmorType, HERO_RADIUS } from './hero.js';

// Regeln einer Partie (Standard = Versus wie im Original; Kampagne/Modi überschreiben einzelne Werte)
export const HERO_WAVE_HP = 1.4;
export const HERO_WAVE_DMG = 1.15;

export const DEFAULT_RULES = {
  pickMode: 'ap',          // ap = Alle wählen, ar = Alle zufällig, pr = Zufall mit einmal Neu-Würfeln, hp = Hybrid
  champions: false,        // CC: Champions in jeder Welle
  startWave: 1, maxWaves: ECON.maxWaves,
  startGold: ECON.startGold, startAether: ECON.startAether, startIncome: ECON.startIncome, startWorkers: ECON.startWorkers,
  buildTimeFirst: ECON.buildTimeFirst, buildTime: ECON.buildTime,
  waveHpMul: 1, waveDmgMul: 1, waveArmorAdd: 0, bountyMul: 1, sendCostMul: 1,
  gridRows: 8, maxTier: 3, kingHpMul: 1,
  transition: 2.0,         // Kameraschwenk: so lange ruht das Spiel zu Wellenbeginn/-ende (alle synchron)
  heroes: true,            // Helden-System an
  leaders: true,           // Wellen-Anführer
  gameMode: 'normal',      // normal | fast (Endwellen ab 20) | long (+2 Königsheilungen) | hard (Wellen +25 %)
  endless: true,           // Endwellen nach der letzten regulären Welle, bis ein König fällt (Versus)
  mirror: false,           // Gespiegelte Auswahl: Gegner-Paare bekommen dieselben Würfe
  campaign: null,          // { goal: 'siege'|'survive', citadelHp, citadelRegen, citadelDmg, siegeMul, enemySends: [{wave, send, count}] }
};

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
const AGGRO = 5.5;
const KING_RADIUS = 2.2;

export const SEND_BY_ID = Object.fromEntries(SENDS.map((s) => [s.id, s]));

export class Sim {
  /**
   * setup = { seed, players: [{ name, team, faction ('random' erlaubt), bot, difficulty }] }
   */
  constructor(setup) {
    this.setup = JSON.parse(JSON.stringify(setup));
    const R = (this.rules = { ...DEFAULT_RULES, ...(setup.rules || {}) });
    if (R.gameMode === 'fast') R.maxWaves = Math.min(R.maxWaves, 20);
    if (R.gameMode === 'hard') { R.waveHpMul *= 1.25; R.waveDmgMul *= 1.15; }
    if (R.campaign) R.endless = false;
    this.rng = new Rng(setup.seed || 1);
    this.tick = 0;
    this.time = 0;
    this.phase = 'build';
    this.wave = R.startWave;
    this.phaseTime = R.buildTimeFirst;
    this.campaign = R.campaign;
    this.siegeQueue = [];
    this.freeze = 0;
    // Wellen mit Modifikatoren & Champions vorbereiten
    // Mit Helden sind die Bahnen stärker → Wellen entsprechend kräftiger (gemessen per Bot-Simulation)
    const heroHp = R.heroes ? HERO_WAVE_HP : 1, heroDmg = R.heroes ? HERO_WAVE_DMG : 1;
    this.waves = WAVES.map((w) => {
      const d = { ...w, key: `w${w.n}`, hp: Math.round(w.hp * R.waveHpMul * heroHp * (w.boss && R.champions ? 1.25 : 1)), dmg: w.dmg * R.waveDmgMul * heroDmg, speed: w.speed * (R.creepSpeedMul || 1), armor: w.armor + R.waveArmorAdd, bounty: Math.max(1, Math.round(w.bounty * R.bountyMul)) };
      d.champ = w.boss ? null : { ...d, key: `w${w.n}c`, champion: true, name: `Champion: ${w.name}`, hp: d.hp * 3, dmg: d.dmg * 1.6, armor: d.armor + 2, bounty: d.bounty * 3, size: 1.3 };
      d.hunter = ['raptor', 'hound', 'imp'].includes(w.model);
      if (R.leaders) {
        if (w.boss) return bossKit(d);
        d.leaderDef = leaderDef(d);
        d.hp = Math.round(d.hp * 0.85); // ein Teil der Wellenstärke steckt im Anführer
        if (d.champ) d.champ.hp = Math.round(d.champ.hp * 0.85);
      }
      return d;
    });
    this.battleTime = 0;
    this.rage = false;
    this.winner = -1;
    this.nextId = 1;
    this.entities = new Map();
    this.events = [];
    this.stats = { leaksByWave: [] };

    // Spieler & Bahnen
    const teamCounts = [0, 0];
    for (const p of setup.players) teamCounts[p.team]++;
    const slotIdx = [0, 0];
    this.players = setup.players.map((ps, id) => {
      const slots = slotsForTeamSize(teamCounts[ps.team]);
      let faction = ps.faction;
      if (R.pickMode === 'ar' || R.pickMode === 'pr') faction = 'random';
      if (R.pickMode === 'hp') faction = 'hybrid';
      let bonus = 0;
      let lines;
      if (faction === 'hybrid') {
        lines = this.rollHybrid();
        bonus = ECON.randomBonusGold;
      } else {
        if (!faction || faction === 'random' || !FACTIONS[faction]) {
          faction = FACTION_IDS[this.rng.int(FACTION_IDS.length)];
          bonus = ECON.randomBonusGold;
        }
        lines = FACTION_LINES[faction].slice();
      }
      return {
        id, name: ps.name || `Spieler ${id + 1}`, team: ps.team, slot: slots[slotIdx[ps.team]++],
        faction, lines, bot: !!ps.bot, difficulty: ps.difficulty || 'normal', randomed: bonus > 0,
        rerolls: R.pickMode === 'pr' ? 1 : 0,
        heroId: HEROES[ps.hero] ? ps.hero : null,
        gold: R.startGold + bonus + (ps.bonusGold || 0), aether: R.startAether, income: R.startIncome + (ps.bonusIncome || 0), workers: R.startWorkers + (ps.bonusWorkers || 0),
        ready: false, sendQueue: [], botTimer: 0.6 + id * 0.17,
        stats: { leaks: 0, kills: 0, sent: 0, sentValue: 0, leaked: 0 },
        connected: true,
      };
    });
    if (R.mirror) {
      // Gespiegelte Auswahl: Spieler auf gleicher Position im Gegnerteam bekommen dieselben Würfe
      for (const p of this.players) {
        if (p.team !== 1) continue;
        const twin = this.players.find((o) => o.team === 0 && o.slot === p.slot);
        if (twin && (twin.randomed || R.pickMode !== 'ap')) { p.faction = twin.faction; p.lines = twin.lines.slice(); p.randomed = twin.randomed; }
      }
    }
    for (const p of this.players) {
      const others = this.players.filter((o) => o.team !== p.team);
      p.opponent = (others.find((o) => o.slot === p.slot) || others[0] || p).id;
    }
    this.teams = [0, 1].map((t) => {
      const k = kingPos(t);
      const camp = this.campaign && t === 1;
      const hp = camp ? this.campaign.citadelHp : Math.round(KING.hp * R.kingHpMul * (1 + (setup.kingBonus?.[t] || 0)));
      const longHeals = R.gameMode === 'long' ? 2 : 0;
      return {
        id: t,
        king: {
          x: k.x, z: k.z, hp, maxHp: hp, regen: camp ? (this.campaign.citadelRegen || 0) : KING.regen, dmgMul: camp ? (this.campaign.citadelDmg || 1) : 1, armor: KING.armor,
          levels: { hp: 0, dmg: 0, regen: 0 }, heals: camp ? 0 : KING.heals + longHeals + (setup.extraHeals?.[t] || 0), maxHeals: camp ? 0 : KING.heals + longHeals + (setup.extraHeals?.[t] || 0), healCd: 0, atkCd: 0, alive: true, citadel: camp,
        },
      };
    });
    this.initHeroes();
    this.mission = R.mission ? createMission(R.mission) : null;
    missionHook(this, 'init');
  }

  initHeroes() {
    if (!this.rules.heroes) return;
    for (const p of this.players) {
      if (!p.heroId) {
        // Bots und Spieler ohne Wahl: Held passend zum Volk (deterministisch)
        const fits = HERO_IDS.filter((id) => HEROES[id].synergy.includes(p.faction));
        const pool = fits.length ? fits : HERO_IDS;
        p.heroId = pool[this.rng.int(pool.length)];
      }
      createHero(this, p);
    }
  }
  heroOf(pid) { const p = this.players[pid]; return p && p.heroEnt ? this.entities.get(p.heroEnt) : null; }

  /** Hybrid-Baumeister: 5 zufällige Kämpferlinien aus allen Fraktionen, mind. 2 Frontkämpfer */
  rollHybrid() {
    const all = FACTION_IDS.flatMap((f) => FACTION_LINES[f]);
    const front = all.filter((id) => ['tank', 'melee', 'assassin'].includes(UNITS[id].role));
    const pick = [];
    while (pick.length < 2) { const u = front[this.rng.int(front.length)]; if (!pick.includes(u)) pick.push(u); }
    while (pick.length < 5) { const u = all[this.rng.int(all.length)]; if (!pick.includes(u)) pick.push(u); }
    return pick;
  }
  waveDef(n = this.wave) {
    if (n <= this.waves.length) return this.waves[Math.max(1, n) - 1];
    // Endwellen: die letzten 10 Wellen kehren verstärkt zurück (+35 % je Durchgang und Welle)
    this.endWaves = this.endWaves || new Map();
    if (!this.endWaves.has(n)) {
      const k = n - this.waves.length;
      const base = this.waves[this.waves.length - 10 + ((k - 1) % 10)];
      const m = Math.pow(1.35, k);
      const d = { ...base, n, key: base.key, name: `Endwelle ${k}: ${base.name}`, hp: Math.round(base.hp * m), dmg: base.dmg * Math.sqrt(m), bounty: base.bounty * 2, endwave: true };
      if (base.leaderDef) d.leaderDef = { ...base.leaderDef, hp: Math.round(base.leaderDef.hp * m), dmg: base.leaderDef.dmg * Math.sqrt(m) };
      this.endWaves.set(n, d);
    }
    return this.endWaves.get(n);
  }
  sendCost(s) { return Math.round(s.cost * this.rules.sendCostMul); }

  // ---------- Hilfen ----------
  emit(e) { this.events.push(e); }
  player(id) { return this.players[id]; }
  laneX(pid) { const p = this.players[pid]; return laneCenterX(p.team, p.slot); }
  fightersOf(pid) {
    const out = [];
    for (const e of this.entities.values()) if (e.type === 'f' && e.owner === pid && !e.summon) out.push(e);
    return out;
  }
  cellFree(pid, col, row) {
    for (const e of this.entities.values()) if (e.type === 'f' && e.owner === pid && e.col === col && e.row === row) return false;
    return true;
  }
  workerCost(p) { return ECON.workerCost + ECON.workerCostStep * Math.max(0, p.workers - this.rules.startWorkers); }
  sendAvailable(s) { return this.wave >= s.unlock; }
  armyValue(pid) { let v = 0; for (const f of this.fightersOf(pid)) v += UNITS[f.def].value; return v; }

  // ---------- Befehle ----------
  applyCommand(pid, cmd) {
    const p = this.players[pid];
    if (!p || this.phase === 'over' || !cmd) return false;
    const allowed = missionHook(this, 'allow', p, cmd);
    if (typeof allowed === 'string') return this.fail(p, allowed);
    switch (cmd.type) {
      case 'build': return this.cmdBuild(p, cmd);
      case 'upgrade': return this.cmdUpgrade(p, cmd);
      case 'sell': return this.cmdSell(p, cmd);
      case 'send': return this.cmdSend(p, cmd);
      case 'worker': return this.cmdWorker(p);
      case 'gather': return this.cmdGather(p);
      case 'king': return this.cmdKing(p, cmd);
      case 'heal': return this.cmdHeal(p);
      case 'ready': p.ready = true; this.checkReady(); return true;
      case 'reroll': return this.cmdReroll(p);
      case 'leave': p.connected = false; p.bot = true; return true; // Bot übernimmt (Online)
      case 'hin': case 'hcast': case 'htarget': case 'hauto': case 'hstop': return heroCommand(this, p, cmd);
      default: return false;
    }
  }
  fail(p, reason) { this.emit({ e: 'error', pid: p.id, reason }); return false; }

  cmdBuild(p, { unit, col, row }) {
    const def = UNITS[unit];
    if (this.phase !== 'build') return this.fail(p, 'Bauen nur in der Bauphase');
    if (!def || !p.lines.includes(def.id)) return this.fail(p, 'Unbekannte Einheit');
    if (row >= this.rules.gridRows || (this.blockedRows && this.blockedRows.has(row))) return this.fail(p, 'Dieses Feld ist gesperrt');
    if (!(col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) || (col | 0) !== col || (row | 0) !== row) return this.fail(p, 'Ungültiges Feld');
    if (!this.cellFree(p.id, col, row)) return this.fail(p, 'Feld belegt');
    if (p.gold < def.cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= def.cost;
    const c = cellCenter(p.team, p.slot, col, row);
    const f = this.spawnFighter(p, def, col, row, c.x, c.z);
    f.fresh = true;
    this.emit({ e: 'build', pid: p.id, id: f.id, x: c.x, z: c.z, unit });
    return true;
  }
  spawnFighter(p, def, col, row, x, z) {
    const f = {
      id: this.nextId++, type: 'f', owner: p.id, team: p.team, lane: p.id, def: def.id, col, row,
      x, z, hx: x, hz: z, hp: def.hp, maxHp: def.hp, alive: true, cd: 0, healCd: 0, target: 0,
      stun: 0, slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, auraArmor: 0, auraSpeed: 0, face: Math.PI, atkT: -9, fresh: false,
    };
    this.entities.set(f.id, f);
    return f;
  }
  cmdUpgrade(p, { id, to }) {
    const f = this.entities.get(id);
    if (this.phase !== 'build') return this.fail(p, 'Aufwerten nur in der Bauphase');
    if (!f || f.type !== 'f' || f.owner !== p.id || f.summon) return this.fail(p, 'Keine eigene Einheit');
    const cur = UNITS[f.def];
    const pick = to && cur.upgrades.includes(to) ? to : cur.upgrades[0];
    const next = pick && UNITS[pick];
    if (!next || next.tier > this.rules.maxTier) return this.fail(p, 'Höchste Stufe erreicht');
    if (p.gold < next.cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= next.cost;
    f.def = next.id; f.hp = next.hp; f.maxHp = next.hp;
    this.emit({ e: 'upgrade', pid: p.id, id: f.id, x: f.x, z: f.z, unit: next.id });
    return true;
  }
  cmdSell(p, { id }) {
    const f = this.entities.get(id);
    if (this.phase !== 'build') return this.fail(p, 'Verkaufen nur in der Bauphase');
    if (!f || f.type !== 'f' || f.owner !== p.id || f.summon) return this.fail(p, 'Keine eigene Einheit');
    const def = UNITS[f.def];
    const refund = f.fresh ? def.value : Math.floor(def.value * ECON.sellRefund);
    p.gold += refund;
    this.entities.delete(f.id);
    this.emit({ e: 'sell', pid: p.id, id: f.id, x: f.x, z: f.z, amount: refund });
    return true;
  }
  cmdSend(p, { send }) {
    const s = SEND_BY_ID[send];
    if (!s) return this.fail(p, 'Unbekannter Söldner');
    if (!this.sendAvailable(s)) return this.fail(p, `Ab Welle ${s.unlock}`);
    const cost = this.sendCost(s);
    if (p.aether < cost) return this.fail(p, 'Nicht genug Äther');
    p.aether -= cost;
    p.income += s.income;
    p.stats.sent++; p.stats.sentValue += cost;
    if (this.campaign) {
      // Solo: Söldner stürmen die Rissfeste des Gegners
      this.siegeQueue.push({ send: s.id, from: p.id });
      this.emit({ e: 'send', pid: p.id, to: -1, send: s.id, income: s.income });
      return true;
    }
    const target = this.players[p.opponent];
    target.sendQueue.push({ send: s.id, from: p.id });
    this.emit({ e: 'send', pid: p.id, to: target.id, send: s.id, income: s.income });
    return true;
  }
  cmdWorker(p) {
    const cost = this.workerCost(p);
    if (p.workers >= ECON.maxWorkers) return this.fail(p, 'Maximale Arbeiter erreicht');
    if (p.gold < cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= cost; p.workers++;
    this.emit({ e: 'worker', pid: p.id, workers: p.workers });
    return true;
  }
  gatherCost(p) { return 150 + 120 * (p.gatherLvl || 0); }
  cmdGather(p) {
    const lvl = p.gatherLvl || 0;
    if (lvl >= ECON.maxGather) return this.fail(p, 'Sammeln ist voll ausgebaut');
    const cost = this.gatherCost(p);
    if (p.gold < cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= cost; p.gatherLvl = lvl + 1;
    this.emit({ e: 'gather', pid: p.id, level: p.gatherLvl });
    return true;
  }
  cmdKing(p, { up }) {
    const k = this.teams[p.team].king;
    const u = KING.upgrades[up];
    if (!u) return this.fail(p, 'Unbekannte Verbesserung');
    if (k.levels[up] >= u.max) return this.fail(p, 'Maximum erreicht');
    const cost = kingUpgradeCost(up, k.levels[up]);
    if (p.aether < cost) return this.fail(p, 'Nicht genug Äther');
    p.aether -= cost;
    k.levels[up]++;
    if (up === 'hp') { k.maxHp += 900; k.hp += 900; }
    if (up === 'dmg') k.dmgMul = 1 + 0.2 * k.levels.dmg;
    if (up === 'regen') k.regen = KING.regen + 4 * k.levels.regen;
    this.emit({ e: 'king', pid: p.id, team: p.team, up, level: k.levels[up] });
    return true;
  }
  cmdHeal(p) {
    const k = this.teams[p.team].king;
    if (k.heals <= 0) return this.fail(p, 'Keine Heilungen mehr');
    if (k.healCd > 0) return this.fail(p, 'Heilung lädt noch');
    if (k.hp >= k.maxHp) return this.fail(p, 'König ist unverletzt');
    k.heals--; k.healCd = KING.healCd;
    const amt = Math.round(k.maxHp * KING.healPct);
    k.hp = Math.min(k.maxHp, k.hp + amt);
    this.emit({ e: 'kingHeal', team: p.team, pid: p.id, amount: amt });
    return true;
  }
  cmdReroll(p) {
    if (p.rerolls <= 0) return this.fail(p, 'Kein Neu-Würfeln verfügbar');
    if (this.wave !== this.rules.startWave || this.phase !== 'build') return this.fail(p, 'Nur in der ersten Bauphase');
    if (this.fightersOf(p.id).length) return this.fail(p, 'Erst alle Kämpfer verkaufen');
    p.rerolls--;
    const others = FACTION_IDS.filter((f) => f !== p.faction);
    p.faction = others[this.rng.int(others.length)];
    p.lines = FACTION_LINES[p.faction].slice();
    this.emit({ e: 'reroll', pid: p.id, faction: p.faction });
    return true;
  }
  checkReady() {
    if (this.phase !== 'build') return;
    const humans = this.players.filter((p) => !p.bot);
    if (humans.length && humans.every((p) => p.ready) && this.phaseTime > 3) this.phaseTime = 3;
  }

  // ---------- Hauptschritt ----------
  /** cmds: Array von { pid, cmd } für diesen Tick */
  step(cmds = []) {
    this.events.length = 0;
    if (this.phase === 'over') { this.tick++; return this.events; }
    for (const c of cmds) this.applyCommand(c.pid, c.cmd);

    // Bots denken (deterministisch, Teil der Simulation)
    for (const p of this.players) {
      if (!p.bot) continue;
      p.botTimer -= DT;
      if (p.botTimer <= 0) {
        p.botTimer = p.difficulty === 'easy' ? 1.6 : p.difficulty === 'hard' ? 0.5 : 0.9;
        botThink(this, p);
      }
    }

    // Bot-Helden (alle 0,25 s)
    if (this.tick % 5 === 0) for (const p of this.players) if (p.bot && p.heroEnt) heroBotThink(this, this.entities.get(p.heroEnt));

    // Äther der Arbeiter
    for (const p of this.players) p.aether += p.workers * ECON.workerRate * (1 + ECON.gatherBonus * (p.gatherLvl || 0)) * DT;

    if (this.phase === 'build') {
      this.phaseTime -= DT;
      if (this.phaseTime <= 0) this.startWave();
    } else if (this.phase === 'battle' && this.freeze > 0) {
      this.freeze -= DT; // Kameraschwenk: Gegner warten
    } else if (this.phase === 'battle') {
      this.battleTime += DT;
      if (!this.rage && this.battleTime >= ECON.battleRageTime) {
        this.rage = true;
        this.emit({ e: 'rage' });
      }
      this.updateBattle();
    }
    this.updateKings();
    if (this.mission && this.phase !== 'over') missionHook(this, 'tick');
    this.time += DT;
    this.tick++;
    return this.events;
  }

  startWave() {
    const w = this.waveDef();
    this.phase = 'battle';
    // Kampagne: der Rissfürst schickt eigene Söldner
    if (this.campaign) {
      for (const es of this.campaign.enemySends || []) {
        if (es.wave !== this.wave) continue;
        for (const p of this.players) for (let i = 0; i < (es.count || 1); i++) p.sendQueue.push({ send: es.send, from: -1 });
        this.emit({ e: 'enemySend', wave: this.wave, send: es.send, count: es.count || 1 });
      }
    }
    this.battleTime = 0;
    this.rage = false;
    for (const p of this.players) p.ready = false;
    for (const e of this.entities.values()) if (e.type === 'f') e.fresh = false;
    for (const e of this.entities.values()) if (e.type === 'h') heroWaveStart(this, e);
    this.freeze = this.rules.transition;
    for (const p of this.players) {
      const lx = this.laneX(p.id);
      // Formation an der Bahn-Spitze
      const perRow = w.boss ? 1 : 4;
      for (let i = 0; i < w.count; i++) {
        const r = Math.floor(i / perRow), c = i % perRow;
        const n = Math.min(perRow, w.count - r * perRow);
        const x = lx + (c - (n - 1) / 2) * 2.2 + this.rng.range(-0.3, 0.3);
        const z = LANE_SPAWN_Z + 1 - r * 1.8;
        const def = this.rules.champions && w.champ && i % 4 === 3 ? w.champ : w;
        this.spawnCreep(p.id, def, x, z, { bounty: def.bounty, wave: true });
      }
      // Anführer der Welle (hinter der Formation)
      if (w.leaderDef) {
        const rows = Math.ceil(w.count / perRow);
        const L = this.spawnCreep(p.id, w.leaderDef, lx, LANE_SPAWN_Z + 1 - rows * 1.8 - 1.5, { bounty: w.leaderDef.bounty, wave: true });
        L.spawnT = 0;
        this.emit({ e: 'leaderSpawn', id: L.id, lane: p.id, name: w.leaderDef.name, kit: w.leaderDef.kit });
      } else if (w.boss && w.leader) {
        for (const e of this.entities.values()) if (e.type === 'c' && e.lane === p.id && e.def === w) { e.spawnT = 0; this.emit({ e: 'leaderSpawn', id: e.id, lane: p.id, name: w.name, kit: w.kit, boss: true }); }
      }
      // Söldner der Gegner
      p.sendQueue.forEach((q, i) => {
        const s = SEND_BY_ID[q.send];
        const x = lx + ((i % 5) - 2) * 2.0;
        const z = LANE_SPAWN_Z - 4 - Math.floor(i / 5) * 2;
        this.spawnCreep(p.id, s, x, z, { bounty: s.bounty, from: q.from, wave: false });
      });
      p.sendQueue = [];
    }
    // Kampagne: eigene Söldner marschieren vom Brückenkopf zur Rissfeste
    if (this.campaign && this.siegeQueue.length) {
      const k = this.teams[1].king;
      const siegeMul = this.campaign.siegeMul || 3;
      this.siegeQueue.forEach((q, i) => {
        const s = SEND_BY_ID[q.send];
        const def = { ...s, key: s.id, dmg: s.dmg * siegeMul };
        const x = k.x + ((i % 6) - 2.5) * 2.2, z = k.z - 30 - Math.floor(i / 6) * 2.2;
        const c = this.spawnCreep(this.players[0].id, def, x, z, { bounty: 0, from: q.from, wave: false });
        c.team = 1; c.stage = 'king'; c.siege = true;
      });
      this.emit({ e: 'siege', count: this.siegeQueue.length });
      this.siegeQueue = [];
    }
    missionHook(this, 'waveStart');
    this.emit({ e: 'waveStart', wave: this.wave, name: w.name, boss: w.boss });
  }

  spawnCreep(lanePid, def, x, z, { bounty, from = -1, wave }) {
    const lp = this.players[lanePid];
    const c = {
      id: this.nextId++, type: 'c', lane: lanePid, team: lp.team, def, defId: def.key || def.id, isSend: !wave, from,
      x, z, hp: def.hp, maxHp: def.hp, alive: true, cd: this.rng.range(0, 0.4), target: 0, stage: 'lane', bounty,
      stun: 0, slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, face: 0, atkT: -9,
    };
    this.entities.set(c.id, c);
    this.emit({ e: 'spawn', id: c.id, x, z, lane: lanePid, send: !wave });
    return c;
  }

  endWave() {
    const leaks = this.players.map((p) => p.stats.leaksThisWave || 0);
    this.stats.leaksByWave.push(leaks);
    for (const p of this.players) p.stats.leaksThisWave = 0;
    // Projektile entfernen, Kämpfer zurücksetzen
    for (const [id, e] of this.entities) {
      if (e.type === 'p' || e.type === 'c' || (e.type === 'f' && e.summon)) this.entities.delete(id);
      else if (e.type === 'h') {
        heroWaveEnd(this, e);
        if (!leaks[e.owner]) heroGainXp(this, e, 25 + 3 * this.wave);
      }
      else if (e.type === 'f') {
        const d = UNITS[e.def];
        Object.assign(e, {
          x: e.hx, z: e.hz, hp: d.hp, maxHp: d.hp, alive: true, cd: 0, healCd: 0, target: 0, stun: 0,
          slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, face: Math.PI, atkT: -9, hbT: 0, shield: 0, shieldT: 0, dots: null,
        });
      }
    }
    for (const p of this.players) {
      p.gold += p.income;
      this.emit({ e: 'income', pid: p.id, amount: p.income });
    }
    this.emit({ e: 'waveEnd', wave: this.wave, leaks });
    missionHook(this, 'waveEnd');
    if (this.phase === 'over') return;
    if (this.wave === this.rules.maxWaves && this.rules.endless && !this.campaign) {
      this.emit({ e: 'endwaves', wave: this.wave + 1 });
    }
    if (this.wave >= this.rules.maxWaves && !(this.rules.endless && !this.campaign)) {
      const mf = missionHook(this, 'final');
      if (mf) { this.finish(mf.winner, mf.reason); return; }
      if (this.campaign) {
        if (this.campaign.goal === 'siege') this.finish(1, 'Die Rissfeste steht noch – der Riss hat sich geschlossen');
        else this.finish(0, 'Alle Wellen überstanden');
        return;
      }
      const r = this.teams.map((t) => t.king.hp / t.king.maxHp);
      this.finish(r[0] === r[1] ? -1 : r[0] > r[1] ? 0 : 1, 'Entscheidung nach der letzten Welle');
      return;
    }
    this.wave++;
    this.phase = 'build';
    this.phaseTime = this.rules.buildTime + this.rules.transition;
  }

  finish(winner, reason) {
    this.phase = 'over';
    this.winner = winner;
    this.emit({ e: 'gameOver', winner, reason });
  }

  // ---------- Kampf ----------
  updateBattle() {
    const lanesF = new Map(), lanesC = new Map(), lanesH = new Map();
    const kingCreeps = [[], []];
    const projectiles = [];
    for (const p of this.players) { lanesF.set(p.id, []); lanesC.set(p.id, []); lanesH.set(p.id, []); }
    for (const e of this.entities.values()) {
      if (e.type === 'p') { projectiles.push(e); continue; }
      if (e.type === 'o') continue; // Missions-Objekte
      if (e.type === 'h') { lanesH.get(e.lane).push(e); continue; }
      if (!e.alive) continue;
      if (e.type === 'f') lanesF.get(e.lane).push(e);
      else if (e.stage === 'lane') lanesC.get(e.lane).push(e);
      else kingCreeps[e.team].push(e);
    }

    for (const p of this.players) {
      const fs = lanesF.get(p.id), cs = lanesC.get(p.id), hs = lanesH.get(p.id);
      this.computeAuras(fs);
      for (const f of fs) this.updateFighter(f, fs, cs);
      for (const h of hs) updateHero(this, h, cs);
      const defenders = hs.length ? fs.concat(hs.filter((h) => h.alive)) : fs;
      if (this.rules.leaders) leaderAura(this, cs);
      for (const c of cs) this.updateCreep(c, defenders);
      this.separate(defenders.concat(cs.filter((c) => c.alive)), this.laneX(p.id));
    }
    for (let t = 0; t < 2; t++) for (const c of kingCreeps[t]) this.updateKingCreep(c);
    for (const pr of projectiles) this.updateProjectile(pr);

    // Rundenende?
    let any = false;
    for (const e of this.entities.values()) if (e.type === 'c' && e.alive) { any = true; break; }
    if (!any && this.phase === 'battle') this.endWave();
  }

  computeAuras(fs) {
    // Schwarm: jede nahe Schwarm-Einheit stärkt die anderen (max. +50 %)
    for (const f of fs) {
      const sw = UNITS[f.def].abil.swarm;
      f.swarmMul = 1;
      if (!sw) continue;
      let n = 0;
      for (const o of fs) if (o !== f && UNITS[o.def].abil.swarm && (o.x - f.x) ** 2 + (o.z - f.z) ** 2 < 16) n++;
      f.swarmMul = 1 + Math.min(0.5, n * sw);
    }
    for (const f of fs) {
      // Helden-Buffs (Banner, Überladung, Hain) zählen wie Auren
      if (f.hbT > 0) { f.hbT -= DT; f.auraArmor = f.hbArmor || 0; f.auraSpeed = f.hbHaste || 0; if (f.hbRegen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.hbRegen * DT); }
      else { f.auraArmor = 0; f.auraSpeed = 0; }
      if (f.shieldT > 0) { f.shieldT -= DT; if (f.shieldT <= 0) f.shield = 0; }
    }
    for (const a of fs) {
      const ab = UNITS[a.def].abil;
      if (!ab.aura_armor && !ab.aura_speed) continue;
      for (const f of fs) {
        const d2 = (f.x - a.x) ** 2 + (f.z - a.z) ** 2;
        if (ab.aura_armor && d2 <= ab.aura_armor.radius ** 2) f.auraArmor = Math.max(f.auraArmor, ab.aura_armor.armor + (f.hbT > 0 ? f.hbArmor || 0 : 0));
        if (ab.aura_speed && d2 <= ab.aura_speed.radius ** 2) f.auraSpeed = Math.max(f.auraSpeed, ab.aura_speed.pct + (f.hbT > 0 ? f.hbHaste || 0 : 0));
      }
    }
  }

  tickStatus(e) {
    if (e.dots && e.dots.length) {
      for (let i = e.dots.length - 1; i >= 0; i--) {
        const d = e.dots[i];
        d.next -= DT;
        if (d.next <= 0) {
          d.next += d.every; d.left--;
          const src = this.entities.get(d.src) || { type: 'h', alive: false };
          this.applyHit(src, e, d.dmg, 'chaos', false);
          if (!e.alive) return false;
          if (d.left <= 0) e.dots.splice(i, 1);
        }
      }
    }
    if (e.rootT > 0) e.rootT -= DT;
    if (e.forcedT > 0) e.forcedT -= DT;
    if (e.slowT > 0) { e.slowT -= DT; if (e.slowT <= 0) e.slowPct = 0; }
    if (e.curseT > 0) { e.curseT -= DT; if (e.curseT <= 0) e.cursePct = 0; }
    if (e.cd > 0) e.cd -= DT;
    if (e.stun > 0) { e.stun -= DT; return false; }
    return true;
  }

  updateFighter(f, fs, cs) {
    const def = UNITS[f.def];
    const ab = def.abil;
    if (f.temp != null) {
      f.temp -= DT;
      if (f.temp <= 0) { f.alive = false; this.entities.delete(f.id); this.emit({ e: 'death', id: f.id, x: f.x, z: f.z, type: 'f', model: def.model, summon: true }); return; }
    }
    if (ab.regen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + ab.regen * DT);
    if (!this.tickStatus(f)) return;
    if (f.healCd > 0) f.healCd -= DT;
    // Beschwörung: ruft regelmäßig Diener (bis Wellenende)
    if (ab.summon && !f.summon) {
      f.sumT = (f.sumT || 0) + DT;
      if (f.sumT >= ab.summon.every) {
        f.sumT = 0;
        let n = 0; for (const e of this.entities.values()) if (e.type === 'f' && e.summonOf === f.id && e.alive) n++;
        if (n < ab.summon.max && UNITS[ab.summon.unit]) {
          const ang = (this.tick * 0.7 + f.id) % 6.28;
          const m = this.spawnFighter(this.players[f.owner], UNITS[ab.summon.unit], -1, -1, f.x + Math.sin(ang) * 1.4, f.z - Math.abs(Math.cos(ang)) * 1.4);
          m.summon = true; m.summonOf = f.id; m.powerMul = 0.8;
          this.emit({ e: 'build', pid: f.owner, id: m.id, x: m.x, z: m.z, unit: m.def, summon: true });
        }
      }
    }

    // Heilen
    if (ab.heal && f.healCd <= 0) {
      let best = null, bestR = 0.92;
      for (const o of fs) {
        const r = o.hp / o.maxHp;
        if (r < bestR && (o.x - f.x) ** 2 + (o.z - f.z) ** 2 <= (def.range + 1) ** 2) { best = o; bestR = r; }
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + ab.heal.amount);
        f.healCd = ab.heal.cd;
        this.emit({ e: 'heal', src: f.id, tgt: best.id, x: best.x, z: best.z, amount: ab.heal.amount });
      }
    }

    if (f.npc) return; // Pilger kämpfen nicht
    if (f.converted > 0) {
      // Verderbt: greift für kurze Zeit die eigenen Vasallen an
      f.converted -= DT;
      let foe = null, fd = Infinity;
      for (const o of fs) { if (o === f || !o.alive || o.converted > 0 || o.npc) continue; const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2; if (d < fd) { fd = d; foe = o; } }
      if (foe) {
        if (Math.sqrt(fd) > def.range + 1) this.moveToward(f, foe.x, foe.z, def.speed);
        else if (f.cd <= 0) { f.cd = def.cd; f.atkT = this.time; this.emit({ e: 'attack', id: f.id, tgt: foe.id, melee: !def.ranged, atk: def.atk }); this.applyHit(f, foe, def.dmg * 0.6, def.atk, false); }
      }
      return;
    }
    // Ziel wählen
    let tgt = f.target && this.entities.get(f.target);
    const visible = this.mission && this.mission.m.canTarget;
    if (tgt && visible && !missionHook(this, 'canTarget', f, tgt)) tgt = null;
    if (!tgt || !tgt.alive || tgt.stage !== 'lane') {
      tgt = null; let bd = Infinity;
      for (const c of cs) {
        if (!c.alive) continue;
        if (visible && !missionHook(this, 'canTarget', f, c)) continue;
        const d = (c.x - f.x) ** 2 + (c.z - f.z) ** 2;
        if (d < bd) { bd = d; tgt = c; }
      }
      f.target = tgt ? tgt.id : 0;
    }
    if (!tgt) {
      // zurück zur Position
      const dx = f.hx - f.x, dz = f.hz - f.z, d = Math.hypot(dx, dz);
      if (d > 0.3) this.moveToward(f, f.hx, f.hz, def.speed * 0.8);
      return;
    }
    const dist = Math.hypot(tgt.x - f.x, tgt.z - f.z);
    const reach = def.range + this.radiusOf(tgt) + 0.3;
    f.face = Math.atan2(tgt.x - f.x, tgt.z - f.z);
    if (dist > reach) {
      if (!f.fixed) this.moveToward(f, tgt.x, tgt.z, def.speed * (1 - f.slowPct));
      return;
    }
    if (f.cd <= 0) {
      f.cd = def.cd / (1 + f.auraSpeed);
      f.atkT = this.time;
      if (def.ranged) {
        const targets = [tgt];
        if (ab.multishot) {
          const extra = cs.filter((c) => c.alive && c !== tgt && Math.hypot(c.x - f.x, c.z - f.z) <= reach + 1)
            .sort((a, b) => ((a.x - f.x) ** 2 + (a.z - f.z) ** 2) - ((b.x - f.x) ** 2 + (b.z - f.z) ** 2) || a.id - b.id);
          targets.push(...extra.slice(0, ab.multishot.targets - 1));
        }
        const um = this.mission ? (missionHook(this, 'unitMul', f) || 1) : 1;
        for (const t of targets) this.fireProjectile(f, t, def, (f.powerMul || 1) * (f.swarmMul || 1) * um);
      } else {
        this.emit({ e: 'attack', id: f.id, tgt: tgt.id, melee: true, atk: def.atk });
        const um = this.mission ? (missionHook(this, 'unitMul', f) || 1) : 1;
        this.damage(f, tgt, def.dmg * (f.powerMul || 1) * (f.swarmMul || 1) * um, def.atk, ab, cs, true);
      }
    }
  }

  radiusOf(e) {
    if (e.type === 'c') return e.def.boss ? 1.8 : 0.6;
    if (e.type === 'h') return HERO_RADIUS;
    return 0.6 * (UNITS[e.def].size || 1);
  }

  fireProjectile(src, tgt, def, mul = 1) {
    const pr = {
      id: this.nextId++, type: 'p', src: src.id, tgt: tgt.id, x: src.x, z: src.z, y: 1.4,
      dmg: def.dmg * (mul || 1), atk: def.atk, abil: def.abil, side: src.type, speed: def.atk === 'wucht' ? 14 : 22,
      kind: projKind(def), lane: src.lane, team: src.team, ox: src.x, oz: src.z, tx: tgt.x, tz: tgt.z,
    };
    this.entities.set(pr.id, pr);
    this.emit({ e: 'attack', id: src.id, tgt: tgt.id, melee: false, atk: def.atk, proj: pr.id, kind: pr.kind });
  }

  updateProjectile(pr) {
    const tgt = this.entities.get(pr.tgt);
    if (tgt && tgt.alive) { pr.tx = tgt.x; pr.tz = tgt.z; }
    const dx = pr.tx - pr.x, dz = pr.tz - pr.z, d = Math.hypot(dx, dz);
    const stepLen = pr.speed * DT;
    if (d <= stepLen + 0.2) {
      this.entities.delete(pr.id);
      const src = this.entities.get(pr.src);
      if (tgt && tgt.alive) {
        let pool;
        if (pr.side === 'f') {
          pool = [];
          for (const e of this.entities.values()) if (e.type === 'c' && e.alive && e.lane === pr.lane && e.stage === 'lane') pool.push(e);
        } else {
          pool = [];
          for (const e of this.entities.values()) if (e.type === 'f' && e.alive && e.lane === pr.lane) pool.push(e);
        }
        this.damage(src || { type: pr.side, x: pr.x, z: pr.z, alive: false, hp: 0, maxHp: 1 }, tgt, pr.dmg, pr.atk, pr.abil || {}, pool, false);
      }
      this.emit({ e: 'impact', id: pr.id, x: pr.tx, z: pr.tz, kind: pr.kind });
      return;
    }
    pr.x += (dx / d) * stepLen;
    pr.z += (dz / d) * stepLen;
  }

  updateCreep(c, fs) {
    const def = c.def;
    const free = this.tickStatus(c);
    if (def.leader && c.stage === 'lane' && !this.rage && c.z < LANE_END_Z) {
      if (updateLeader(this, c, fs)) return;
    }
    if (!free) return;
    const lx = this.laneX(c.lane);
    const sp = def.speed * (1 - c.slowPct);
    if (c.z >= LANE_END_Z) {
      c.stage = 'king';
      c.target = 0;
      const p = this.players[c.lane];
      p.stats.leaks++; p.stats.leaksThisWave = (p.stats.leaksThisWave || 0) + 1;
      this.emit({ e: 'leak', id: c.id, pid: c.lane, x: c.x, z: c.z, team: c.team });
      return;
    }
    if (this.rage) { this.moveToward(c, lx, LANE_END_Z + 1, sp * 1.5); return; }
    if (c.fearT > 0) {
      // Grauen: weg vom nächsten Helden fliehen
      c.fearT -= DT;
      let hx = c.x, hz = c.z - 1;
      for (const f of fs) if (f.type === 'h') { hx = f.x; hz = f.z; }
      const dx = c.x - hx, dz = c.z - hz, d = Math.hypot(dx, dz) || 1;
      if (c.rootT <= 0) this.moveToward(c, c.x + (dx / d) * 3, c.z + (dz / d) * 3, sp * 0.8);
      return;
    }

    let tgt = c.target && this.entities.get(c.target);
    const forced = c.forcedT > 0 && tgt && tgt.alive;
    if (!forced && (!tgt || !tgt.alive || Math.hypot(tgt.x - c.x, tgt.z - c.z) > AGGRO + 2)) {
      tgt = null; let bd = AGGRO * AGGRO, taunt = false;
      const huntR = (def.hunter || def.leader ? 11 : AGGRO) ** 2;
      for (const f of fs) {
        if (!f.alive || f.converted > 0) continue;
        const d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2;
        if (f.type === 'h' && (def.hunter || def.leader) && d <= huntR) { tgt = f; taunt = true; bd = -1; break; }
        const isT = f.type === 'h' ? f.tauntT > 0 : !!UNITS[f.def].abil.taunt;
        if (d <= AGGRO * AGGRO && ((isT && !taunt) || (isT === taunt && d < bd))) { bd = d; tgt = f; taunt = isT; }
      }
      c.target = tgt ? tgt.id : 0;
    }
    if (c.rootT > 0 && tgt && Math.hypot(tgt.x - c.x, tgt.z - c.z) > def.range + this.radiusOf(tgt) + 0.3) return;
    if (!tgt) {
      // die Bahn hinab, leicht zur Mitte ziehen
      const tx = c.x + (lx - c.x) * 0.15;
      this.moveToward(c, tx, c.z + 4, sp);
      return;
    }
    const dist = Math.hypot(tgt.x - c.x, tgt.z - c.z);
    const reach = def.range + this.radiusOf(tgt) + 0.3;
    c.face = Math.atan2(tgt.x - c.x, tgt.z - c.z);
    if (dist > reach) { this.moveToward(c, tgt.x, tgt.z, sp); return; }
    if (c.cd <= 0) {
      c.cd = def.cd / (c.enraged ? 1.6 : 1);
      c.atkT = this.time;
      if (def.ranged) this.fireProjectile(c, tgt, def, 1 + (c.moraleDmg || 0));
      else {
        this.emit({ e: 'attack', id: c.id, tgt: tgt.id, melee: true, atk: def.atk });
        this.damage(c, tgt, def.dmg * (1 + (c.moraleDmg || 0)), def.atk, {}, fs, true);
      }
    }
  }

  updateKingCreep(c) {
    if (!this.tickStatus(c)) return;
    const k = this.teams[c.team].king;
    const dist = Math.hypot(k.x - c.x, k.z - c.z);
    const reach = Math.min(c.def.range, 4) + KING_RADIUS + 0.4; // auch Fernkämpfer rücken in Reichweite des Königs
    c.face = Math.atan2(k.x - c.x, k.z - c.z);
    if (dist > reach) { this.moveToward(c, k.x, k.z, c.def.speed * 1.6 * (1 - c.slowPct)); return; }
    // Kampagne: Söldner rammen die Rissfeste beim Eintreffen (Wucht abhängig vom Söldnerwert)
    if (c.siege && !c.impacted) {
      c.impacted = true;
      const imp = c.def.cost * (this.campaign.impactMul || 14);
      this.emit({ e: 'siegeImpact', x: c.x, z: c.z, dmg: Math.round(imp) });
      this.hurtKing(c.team, imp, c.id);
    }
    if (c.cd <= 0 && k.alive) {
      c.cd = c.def.cd; c.atkT = this.time;
      const mult = DAMAGE_TABLE[c.def.atk].festung * (c.def.boss ? 0.3 : 1); // Boss-Durchbruch tut weh, beendet aber nicht sofort die Partie
      this.hurtKing(c.team, c.def.dmg * mult * (1 - armorReduction(k.armor)), c.id);
    }
  }

  hurtKing(team, dmg, srcId) {
    const k = this.teams[team].king;
    if (!k.alive || this.phase === 'over') return;
    k.hp -= dmg;
    this.emit({ e: 'kingHit', team, dmg, id: srcId });
    if (k.hp <= 0) {
      k.hp = 0; k.alive = false;
      this.emit({ e: 'kingDeath', team });
      this.finish(1 - team, k.citadel ? 'Die Rissfeste ist gefallen' : this.campaign ? 'Dein König ist gefallen' : `Der König von Team ${team === 0 ? 'West' : 'Ost'} ist gefallen`);
    }
  }

  updateKings() {
    for (const t of this.teams) {
      const k = t.king;
      if (!k.alive) continue;
      if (k.healCd > 0) k.healCd -= DT;
      if (k.hp < k.maxHp) k.hp = Math.min(k.maxHp, k.hp + k.regen * DT);
      if (k.atkCd > 0) k.atkCd -= DT;
      if (this.phase !== 'battle' || k.atkCd > 0) continue;
      let tgt = null, bd = (KING.range + 1) ** 2;
      const near = [];
      for (const e of this.entities.values()) {
        if (e.type !== 'c' || !e.alive || e.stage !== 'king' || e.team !== t.id) continue;
        near.push(e);
        const d = (e.x - k.x) ** 2 + (e.z - k.z) ** 2;
        if (d < bd) { bd = d; tgt = e; }
      }
      if (!tgt) continue;
      k.atkCd = KING.cd;
      this.emit({ e: 'kingAttack', team: t.id, tgt: tgt.id, x: tgt.x, z: tgt.z });
      const kingSrc = { type: 'k', team: t.id, x: k.x, z: k.z, alive: true, hp: 1, maxHp: 1 };
      // Der König wächst mit dem Krieg (wie die Wellen) – Verbesserungen kommen obendrauf
      const growth = k.citadel ? 1 : Math.pow(1.1, Math.max(0, this.wave - 1));
      this.damage(kingSrc, tgt, KING.dmg * k.dmgMul * growth, KING.atk, { splash: KING.splash }, near, true);
    }
  }

  // ---------- Schaden ----------
  damage(src, tgt, base, atk, ab, pool, melee) {
    if (!tgt.alive) return;
    let dmg = base;
    let crit = false;
    if (ab.crit && this.rng.next() < ab.crit.chance) { dmg *= ab.crit.mult; crit = true; }
    const dealt = this.applyHit(src, tgt, dmg, atk, crit);
    if (ab.lifesteal && src.alive && src.type === 'f') src.hp = Math.min(src.maxHp, src.hp + dealt * ab.lifesteal);
    if (ab.slow && tgt.alive) { tgt.slowPct = Math.max(tgt.slowPct, ab.slow.pct); tgt.slowT = ab.slow.dur; }
    if (ab.curse && tgt.alive) { tgt.cursePct = Math.max(tgt.cursePct, ab.curse.pct); tgt.curseT = ab.curse.dur; }
    if (ab.poison && tgt.alive && tgt.type === 'c') {
      // Gift/Brand: Schaden über Zeit, je Quelle nur eine Ladung (wird erneuert)
      tgt.dots = tgt.dots || [];
      const per = base * ab.poison.dps;
      const ex = tgt.dots.find((d) => d.src === src.id && d.poison);
      if (ex) { ex.left = ab.poison.dur; ex.dmg = Math.max(ex.dmg, per); }
      else if (tgt.dots.length < 6) tgt.dots.push({ dmg: per, left: ab.poison.dur, every: 1, next: 1, src: src.id, poison: true });
    }
    if (ab.stun && tgt.alive && !(tgt.def && tgt.def.boss) && this.rng.next() < ab.stun.chance) {
      tgt.stun = ab.stun.dur;
      this.emit({ e: 'stun', id: tgt.id });
    }
    // Dornen
    if (melee && tgt.type === 'f' && UNITS[tgt.def].abil.thorns && src.alive && src.type === 'c') {
      this.applyHit(tgt, src, dealt * UNITS[tgt.def].abil.thorns, 'chaos', false);
    }
    if (ab.splash) {
      const r2 = ab.splash.radius ** 2;
      for (const o of pool) {
        if (o === tgt || !o.alive) continue;
        if ((o.x - tgt.x) ** 2 + (o.z - tgt.z) ** 2 <= r2) this.applyHit(src, o, dmg * ab.splash.pct, atk, false, true);
      }
      this.emit({ e: 'splash', x: tgt.x, z: tgt.z, r: ab.splash.radius, atk });
    }
    if (ab.chain) {
      let cur = tgt, amount = dmg;
      const hit = new Set([tgt.id]);
      const path = [[tgt.x, tgt.z]];
      for (let j = 0; j < ab.chain.jumps; j++) {
        let next = null, bd = 16;
        for (const o of pool) {
          if (!o.alive || hit.has(o.id)) continue;
          const d = (o.x - cur.x) ** 2 + (o.z - cur.z) ** 2;
          if (d < bd) { bd = d; next = o; }
        }
        if (!next) break;
        amount *= ab.chain.falloff;
        hit.add(next.id);
        path.push([next.x, next.z]);
        this.applyHit(src, next, amount, atk, false, true);
        cur = next;
      }
      if (path.length > 1) this.emit({ e: 'chain', path });
    }
  }

  applyHit(src, tgt, dmg, atk, crit, secondary = false) {
    if (!tgt.alive) return 0;
    let armorType, armor;
    if (tgt.type === 'f') { armorType = UNITS[tgt.def].armorType; armor = UNITS[tgt.def].armor + tgt.auraArmor; }
    else if (tgt.type === 'h') { armorType = heroArmorType(tgt); armor = heroArmor(tgt); }
    else { armorType = tgt.def.armorType; armor = tgt.def.armor + (tgt.moraleArmor || 0); }
    const mult = DAMAGE_TABLE[atk][armorType] ?? 1;
    let final = Math.max(1, dmg * mult * (1 - armorReduction(armor || 0)) * (1 + (tgt.cursePct || 0)));
    if (this.mission && this.mission.m.dmgMul) final *= missionHook(this, 'dmgMul', src, tgt, atk) || 1;
    if (tgt.type === 'h') final = heroTakeDamage(this, tgt, final);
    else {
      if (tgt.shield > 0) { const a = Math.min(tgt.shield, final); tgt.shield -= a; final -= a; }
      tgt.hp -= final;
    }
    if (!secondary || crit) this.emit({ e: 'hit', id: tgt.id, x: tgt.x, z: tgt.z, dmg: Math.round(final), crit, atk, eff: mult, hero: src && src.type === 'h' ? src.owner : -1, onHero: tgt.type === 'h' });
    if (tgt.hp <= 0) {
      if (tgt.type === 'h') heroDied(this, tgt);
      else this.kill(tgt, src);
    }
    return final;
  }

  kill(e, src) {
    e.alive = false; e.hp = 0;
    if (this.mission) missionHook(this, 'onKill', e, src);
    if (e.type === 'c') {
      this.entities.delete(e.id);
      if (e.siege) { /* von der Rissfeste vernichtet – kein Gold */ }
      else if (e.stage === 'king' || (src && src.type === 'k')) {
        const team = this.players.filter((p) => p.team === e.team);
        const share = Math.max(1, Math.floor((e.bounty * ECON.kingShare) / Math.max(1, team.length)));
        for (const p of team) { p.gold += share; this.emit({ e: 'gold', pid: p.id, amount: share, x: e.x, z: e.z }); }
      } else {
        const p = this.players[e.lane];
        p.gold += e.bounty; p.stats.kills++;
        this.emit({ e: 'gold', pid: p.id, amount: e.bounty, x: e.x, z: e.z });
        const h = p.heroEnt && this.entities.get(p.heroEnt);
        if (h) {
          const byHero = src && src.type === 'h';
          heroGainXp(this, h, byHero ? 6 + e.bounty : 2 + Math.floor(e.bounty / 3));
          if (byHero) h.stats.kills++;
        }
      }
      if (e.def.leader && e.stage === 'lane') {
        const quick = this.battleTime - (e.spawnT || 0) <= 20;
        const w = this.waveDef();
        const bonus = quick ? Math.round(w.bounty * w.count * 0.4) : 0;
        const p = this.players[e.lane];
        if (bonus) { p.gold += bonus; this.emit({ e: 'gold', pid: p.id, amount: bonus, x: e.x, z: e.z }); }
        const h = p.heroEnt && this.entities.get(p.heroEnt);
        if (h) heroGainXp(this, h, quick ? 60 : 30);
        this.emit({ e: 'leaderDown', id: e.id, lane: e.lane, quick, bonus, x: e.x, z: e.z, byHero: !!(src && src.type === 'h') });
      }
      this.emit({ e: 'death', id: e.id, x: e.x, z: e.z, type: 'c', model: e.def.model, boss: !!e.def.boss, champion: !!e.def.champion, leader: !!e.def.leader });
    } else {
      this.emit({ e: 'death', id: e.id, x: e.x, z: e.z, type: 'f', model: UNITS[e.def].model });
    }
  }

  // ---------- Bewegung ----------
  moveToward(e, tx, tz, speed) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const s = Math.min(d, speed * DT);
    e.x += (dx / d) * s; e.z += (dz / d) * s;
    e.face = Math.atan2(dx, dz);
    e.moving = this.tick;
    if (e.stage === 'lane' || e.type === 'f') {
      const lx = this.laneX(e.lane), hw = LANE_WIDTH / 2 - 0.7;
      if (e.x < lx - hw) e.x = lx - hw; else if (e.x > lx + hw) e.x = lx + hw;
      if (e.type === 'f') { if (e.z > LANE_END_Z - 0.5) e.z = LANE_END_Z - 0.5; if (e.z < LANE_SPAWN_Z - 6) e.z = LANE_SPAWN_Z - 6; }
    }
  }

  separate(list, lx) {
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      const ra = this.radiusOf(a);
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const min = ra + this.radiusOf(b);
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) * 0.5;
        const nx = d2 > 0 ? dx / d : ((a.id + b.id) % 2 ? 1 : -1), nz = d2 > 0 ? dz / d : 0;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
    const hw = LANE_WIDTH / 2 - 0.7;
    for (const e of list) { if (e.x < lx - hw) e.x = lx - hw; else if (e.x > lx + hw) e.x = lx + hw; }
  }

  // ---------- Prüfsumme für Online-Synchronität ----------
  hash() {
    let h = 2166136261 >>> 0;
    const mix = (v) => { h ^= v | 0; h = Math.imul(h, 16777619) >>> 0; };
    mix(this.tick); mix(this.wave); mix(Math.round(this.phaseTime * 100));
    for (const p of this.players) { mix(Math.round(p.gold)); mix(Math.round(p.aether * 10)); mix(p.income); mix(p.workers); }
    for (const t of this.teams) mix(Math.round(t.king.hp * 10));
    for (const e of this.entities.values()) { mix(e.id); mix(Math.round(e.x * 100)); mix(Math.round(e.z * 100)); mix(Math.round((e.hp || 0) * 10)); }
    return h >>> 0;
  }
}

function projKind(def) {
  if (def.model === 'archer' || def.model === 'walker') return 'arrow';
  if (def.atk === 'wucht') return def.model === 'bonethrower' ? 'bone' : 'shell';
  if (def.atk === 'arkan') return 'magic';
  if (def.atk === 'chaos') return 'void';
  if (def.atk === 'stich') return 'arrow';
  return 'magic';
}
