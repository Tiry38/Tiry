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

// Regeln einer Partie (Standard = Versus wie im Original; Kampagne/Modi überschreiben einzelne Werte)
export const DEFAULT_RULES = {
  pickMode: 'ap',          // ap = Alle wählen, ar = Alle zufällig, pr = Zufall mit einmal Neu-Würfeln, hp = Hybrid
  champions: false,        // CC: Champions in jeder Welle
  startWave: 1, maxWaves: ECON.maxWaves,
  startGold: ECON.startGold, startAether: ECON.startAether, startIncome: ECON.startIncome, startWorkers: ECON.startWorkers,
  buildTimeFirst: ECON.buildTimeFirst, buildTime: ECON.buildTime,
  waveHpMul: 1, waveDmgMul: 1, waveArmorAdd: 0, bountyMul: 1, sendCostMul: 1,
  gridRows: 8, maxTier: 3, kingHpMul: 1,
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
    this.rng = new Rng(setup.seed || 1);
    this.tick = 0;
    this.time = 0;
    this.phase = 'build';
    this.wave = R.startWave;
    this.phaseTime = R.buildTimeFirst;
    this.campaign = R.campaign;
    this.siegeQueue = [];
    // Wellen mit Modifikatoren & Champions vorbereiten
    this.waves = WAVES.map((w) => {
      const d = { ...w, key: `w${w.n}`, hp: Math.round(w.hp * R.waveHpMul * (w.boss && R.champions ? 1.25 : 1)), dmg: w.dmg * R.waveDmgMul, armor: w.armor + R.waveArmorAdd, bounty: Math.max(1, Math.round(w.bounty * R.bountyMul)) };
      d.champ = w.boss ? null : { ...d, key: `w${w.n}c`, champion: true, name: `Champion: ${w.name}`, hp: d.hp * 3, dmg: d.dmg * 1.6, armor: d.armor + 2, bounty: d.bounty * 3, size: 1.3 };
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
        gold: R.startGold + bonus + (ps.bonusGold || 0), aether: R.startAether, income: R.startIncome + (ps.bonusIncome || 0), workers: R.startWorkers + (ps.bonusWorkers || 0),
        ready: false, sendQueue: [], botTimer: 0.6 + id * 0.17,
        stats: { leaks: 0, kills: 0, sent: 0, sentValue: 0, leaked: 0 },
        connected: true,
      };
    });
    for (const p of this.players) {
      const others = this.players.filter((o) => o.team !== p.team);
      p.opponent = (others.find((o) => o.slot === p.slot) || others[0] || p).id;
    }
    this.teams = [0, 1].map((t) => {
      const k = kingPos(t);
      const camp = this.campaign && t === 1;
      const hp = camp ? this.campaign.citadelHp : Math.round(KING.hp * R.kingHpMul * (1 + (setup.kingBonus?.[t] || 0)));
      return {
        id: t,
        king: {
          x: k.x, z: k.z, hp, maxHp: hp, regen: camp ? (this.campaign.citadelRegen || 0) : KING.regen, dmgMul: camp ? (this.campaign.citadelDmg || 1) : 1, armor: KING.armor,
          levels: { hp: 0, dmg: 0, regen: 0 }, heals: camp ? 0 : KING.heals + (setup.extraHeals?.[t] || 0), maxHeals: camp ? 0 : KING.heals + (setup.extraHeals?.[t] || 0), healCd: 0, atkCd: 0, alive: true, citadel: camp,
        },
      };
    });
  }

  /** Hybrid-Baumeister: 5 zufällige Kämpferlinien aus allen Fraktionen, mind. 2 Frontkämpfer */
  rollHybrid() {
    const all = FACTION_IDS.flatMap((f) => FACTION_LINES[f]);
    const front = all.filter((id) => ['tank', 'melee', 'assassin'].includes(UNITS[id].role));
    const pick = [];
    while (pick.length < 2) { const u = front[this.rng.int(front.length)]; if (!pick.includes(u)) pick.push(u); }
    while (pick.length < 5) { const u = all[this.rng.int(all.length)]; if (!pick.includes(u)) pick.push(u); }
    return pick;
  }
  waveDef(n = this.wave) { return this.waves[Math.min(this.waves.length, Math.max(1, n)) - 1]; }
  sendCost(s) { return Math.round(s.cost * this.rules.sendCostMul); }

  // ---------- Hilfen ----------
  emit(e) { this.events.push(e); }
  player(id) { return this.players[id]; }
  laneX(pid) { const p = this.players[pid]; return laneCenterX(p.team, p.slot); }
  fightersOf(pid) {
    const out = [];
    for (const e of this.entities.values()) if (e.type === 'f' && e.owner === pid) out.push(e);
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
    switch (cmd.type) {
      case 'build': return this.cmdBuild(p, cmd);
      case 'upgrade': return this.cmdUpgrade(p, cmd);
      case 'sell': return this.cmdSell(p, cmd);
      case 'send': return this.cmdSend(p, cmd);
      case 'worker': return this.cmdWorker(p);
      case 'king': return this.cmdKing(p, cmd);
      case 'heal': return this.cmdHeal(p);
      case 'ready': p.ready = true; this.checkReady(); return true;
      case 'reroll': return this.cmdReroll(p);
      case 'leave': p.connected = false; p.bot = true; return true; // Bot übernimmt (Online)
      default: return false;
    }
  }
  fail(p, reason) { this.emit({ e: 'error', pid: p.id, reason }); return false; }

  cmdBuild(p, { unit, col, row }) {
    const def = UNITS[unit];
    if (this.phase !== 'build') return this.fail(p, 'Bauen nur in der Bauphase');
    if (!def || !p.lines.includes(def.id)) return this.fail(p, 'Unbekannte Einheit');
    if (row >= this.rules.gridRows) return this.fail(p, 'Dieses Feld ist gesperrt');
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
  cmdUpgrade(p, { id }) {
    const f = this.entities.get(id);
    if (this.phase !== 'build') return this.fail(p, 'Aufwerten nur in der Bauphase');
    if (!f || f.type !== 'f' || f.owner !== p.id) return this.fail(p, 'Keine eigene Einheit');
    const cur = UNITS[f.def];
    const next = cur.upgradeTo && UNITS[cur.upgradeTo];
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
    if (!f || f.type !== 'f' || f.owner !== p.id) return this.fail(p, 'Keine eigene Einheit');
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

    // Äther der Arbeiter
    for (const p of this.players) p.aether += p.workers * ECON.workerRate * DT;

    if (this.phase === 'build') {
      this.phaseTime -= DT;
      if (this.phaseTime <= 0) this.startWave();
    } else if (this.phase === 'battle') {
      this.battleTime += DT;
      if (!this.rage && this.battleTime >= ECON.battleRageTime) {
        this.rage = true;
        this.emit({ e: 'rage' });
      }
      this.updateBattle();
    }
    this.updateKings();
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
      if (e.type === 'p' || e.type === 'c') this.entities.delete(id);
      else if (e.type === 'f') {
        const d = UNITS[e.def];
        Object.assign(e, {
          x: e.hx, z: e.hz, hp: d.hp, maxHp: d.hp, alive: true, cd: 0, healCd: 0, target: 0, stun: 0,
          slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, face: Math.PI, atkT: -9,
        });
      }
    }
    for (const p of this.players) {
      p.gold += p.income;
      this.emit({ e: 'income', pid: p.id, amount: p.income });
    }
    this.emit({ e: 'waveEnd', wave: this.wave, leaks });
    if (this.wave >= this.rules.maxWaves) {
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
    this.phaseTime = this.rules.buildTime;
  }

  finish(winner, reason) {
    this.phase = 'over';
    this.winner = winner;
    this.emit({ e: 'gameOver', winner, reason });
  }

  // ---------- Kampf ----------
  updateBattle() {
    const lanesF = new Map(), lanesC = new Map();
    const kingCreeps = [[], []];
    const projectiles = [];
    for (const p of this.players) { lanesF.set(p.id, []); lanesC.set(p.id, []); }
    for (const e of this.entities.values()) {
      if (e.type === 'p') { projectiles.push(e); continue; }
      if (!e.alive) continue;
      if (e.type === 'f') lanesF.get(e.lane).push(e);
      else if (e.stage === 'lane') lanesC.get(e.lane).push(e);
      else kingCreeps[e.team].push(e);
    }

    for (const p of this.players) {
      const fs = lanesF.get(p.id), cs = lanesC.get(p.id);
      this.computeAuras(fs);
      for (const f of fs) this.updateFighter(f, fs, cs);
      for (const c of cs) this.updateCreep(c, fs);
      this.separate(fs.concat(cs.filter((c) => c.alive)), this.laneX(p.id));
    }
    for (let t = 0; t < 2; t++) for (const c of kingCreeps[t]) this.updateKingCreep(c);
    for (const pr of projectiles) this.updateProjectile(pr);

    // Rundenende?
    let any = false;
    for (const e of this.entities.values()) if (e.type === 'c' && e.alive) { any = true; break; }
    if (!any && this.phase === 'battle') this.endWave();
  }

  computeAuras(fs) {
    for (const f of fs) { f.auraArmor = 0; f.auraSpeed = 0; }
    for (const a of fs) {
      const ab = UNITS[a.def].abil;
      if (!ab.aura_armor && !ab.aura_speed) continue;
      for (const f of fs) {
        const d2 = (f.x - a.x) ** 2 + (f.z - a.z) ** 2;
        if (ab.aura_armor && d2 <= ab.aura_armor.radius ** 2) f.auraArmor = Math.max(f.auraArmor, ab.aura_armor.armor);
        if (ab.aura_speed && d2 <= ab.aura_speed.radius ** 2) f.auraSpeed = Math.max(f.auraSpeed, ab.aura_speed.pct);
      }
    }
  }

  tickStatus(e) {
    if (e.slowT > 0) { e.slowT -= DT; if (e.slowT <= 0) e.slowPct = 0; }
    if (e.curseT > 0) { e.curseT -= DT; if (e.curseT <= 0) e.cursePct = 0; }
    if (e.cd > 0) e.cd -= DT;
    if (e.stun > 0) { e.stun -= DT; return false; }
    return true;
  }

  updateFighter(f, fs, cs) {
    const def = UNITS[f.def];
    const ab = def.abil;
    if (ab.regen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + ab.regen * DT);
    if (!this.tickStatus(f)) return;
    if (f.healCd > 0) f.healCd -= DT;

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

    // Ziel wählen
    let tgt = f.target && this.entities.get(f.target);
    if (!tgt || !tgt.alive || tgt.stage !== 'lane') {
      tgt = null; let bd = Infinity;
      for (const c of cs) {
        if (!c.alive) continue;
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
      this.moveToward(f, tgt.x, tgt.z, def.speed * (1 - f.slowPct));
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
        for (const t of targets) this.fireProjectile(f, t, def);
      } else {
        this.emit({ e: 'attack', id: f.id, tgt: tgt.id, melee: true, atk: def.atk });
        this.damage(f, tgt, def.dmg, def.atk, ab, cs, true);
      }
    }
  }

  radiusOf(e) {
    if (e.type === 'c') return e.def.boss ? 1.8 : 0.6;
    return 0.6 * (UNITS[e.def].size || 1);
  }

  fireProjectile(src, tgt, def) {
    const pr = {
      id: this.nextId++, type: 'p', src: src.id, tgt: tgt.id, x: src.x, z: src.z, y: 1.4,
      dmg: def.dmg, atk: def.atk, abil: def.abil, side: src.type, speed: def.atk === 'wucht' ? 14 : 22,
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
    if (!this.tickStatus(c)) return;
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

    let tgt = c.target && this.entities.get(c.target);
    if (!tgt || !tgt.alive || Math.hypot(tgt.x - c.x, tgt.z - c.z) > AGGRO + 2) {
      tgt = null; let bd = AGGRO * AGGRO, taunt = false;
      for (const f of fs) {
        if (!f.alive) continue;
        const d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2;
        const isT = !!UNITS[f.def].abil.taunt;
        if (d <= AGGRO * AGGRO && ((isT && !taunt) || (isT === taunt && d < bd))) { bd = d; tgt = f; taunt = isT; }
      }
      c.target = tgt ? tgt.id : 0;
    }
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
      c.cd = def.cd;
      c.atkT = this.time;
      if (def.ranged) this.fireProjectile(c, tgt, def);
      else {
        this.emit({ e: 'attack', id: c.id, tgt: tgt.id, melee: true, atk: def.atk });
        this.damage(c, tgt, def.dmg, def.atk, {}, fs, true);
      }
    }
  }

  updateKingCreep(c) {
    if (!this.tickStatus(c)) return;
    const k = this.teams[c.team].king;
    const dist = Math.hypot(k.x - c.x, k.z - c.z);
    const reach = c.def.range + KING_RADIUS + 0.4;
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
      const mult = DAMAGE_TABLE[c.def.atk].festung;
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
      this.finish(1 - team, k.citadel ? 'Die Rissfeste ist gefallen' : 'Der gegnerische König ist gefallen');
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
      this.damage(kingSrc, tgt, KING.dmg * k.dmgMul, KING.atk, { splash: KING.splash }, near, true);
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
    const armorType = tgt.type === 'f' ? UNITS[tgt.def].armorType : tgt.def.armorType;
    const armor = (tgt.type === 'f' ? UNITS[tgt.def].armor + tgt.auraArmor : tgt.def.armor) || 0;
    const mult = DAMAGE_TABLE[atk][armorType] ?? 1;
    const final = Math.max(1, dmg * mult * (1 - armorReduction(armor)) * (1 + tgt.cursePct));
    tgt.hp -= final;
    if (!secondary || crit) this.emit({ e: 'hit', id: tgt.id, x: tgt.x, z: tgt.z, dmg: Math.round(final), crit, atk, eff: mult });
    if (tgt.hp <= 0) this.kill(tgt, src);
    return final;
  }

  kill(e, src) {
    e.alive = false; e.hp = 0;
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
      }
      this.emit({ e: 'death', id: e.id, x: e.x, z: e.z, type: 'c', model: e.def.model, boss: !!e.def.boss, champion: !!e.def.champion });
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
