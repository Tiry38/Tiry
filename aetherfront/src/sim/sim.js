// Aetherfront – deterministische Spielsimulation (feste 20 Ticks/s).
// Alle Spieleraktionen kommen als Befehle herein (applyCommand) – identisch für Einzelspieler,
// Bots und später Online-Lockstep. Kein Math.random, keine Zeitabhängigkeit vom Rendering.

import { Rng } from './rng.js';
import {
  ECON, UNITS, WAVES, SENDS, KING, FACTIONS, FACTION_IDS, DAMAGE_TABLE, armorReduction, kingUpgradeCost,
  KING_ABILITIES, KING_ABILITY_IDS, kingAbilityCost,
} from './data.js';
import {
  GRID_COLS, GRID_ROWS, LANE_WIDTH, LANE_SPAWN_Z, LANE_END_Z, laneCenterX, kingPos, cellCenter, slotsForTeamSize,
  ARENA, arenaSpot,
} from './layout.js';
import { botThink } from './ai.js';
import { FACTION_LINES } from './data.js';
import { leaderDef, bossKit, updateLeader, leaderAura } from './leader.js';
import { createMission, missionHook } from './missions.js';

// Regeln einer Partie (Standard = Versus wie im Original; Kampagne/Modi überschreiben einzelne Werte)
export const DEFAULT_RULES = {
  pickMode: 'ap',          // ap = Alle wählen, ar = Alle zufällig, pr = Zufall mit einmal Neu-Würfeln, hp = Hybrid
  champions: false,        // CC: Champions in jeder Welle
  startWave: 1, maxWaves: ECON.maxWaves,
  startGold: ECON.startGold, startAether: ECON.startAether, startIncome: ECON.startIncome, startWorkers: ECON.startWorkers,
  buildTimeFirst: ECON.buildTimeFirst, buildTime: ECON.buildTime,
  waveHpMul: 1, waveDmgMul: 1, waveArmorAdd: 0, bountyMul: 1, sendCostMul: 1,
  gridRows: 8, maxTier: 3, kingHpMul: 1,
  arena: true,             // Arena nach den Wellen in arenaWaves (Team gegen Team, Gold für die Sieger)
  arenaWaves: [10, 20],
  sendStock: true,         // Söldner-Bestand (füllt sich mit der Zeit auf)
  sendRetire: true,        // frühe Söldner werden ab bestimmten Wellen ausgemustert
  barracksOpen: false,     // Erweiterte Kaserne von Beginn an offen (Kampagne)
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
    if (R.campaign) { R.endless = false; R.arena = false; R.sendStock = false; R.sendRetire = false; R.barracksOpen = true; }
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
      const d = { ...w, key: `w${w.n}`, hp: Math.round(w.hp * R.waveHpMul), dmg: w.dmg * R.waveDmgMul, speed: w.speed * (R.creepSpeedMul || 1), armor: w.armor + R.waveArmorAdd, bounty: Math.max(1, Math.round(w.bounty * R.bountyMul)) };
      d.champ = w.boss ? null : { ...d, key: `w${w.n}c`, champion: true, name: `Champion: ${w.name}`, hp: d.hp * 3, dmg: d.dmg * 1.6, armor: d.armor + 2, bounty: d.bounty * 3, size: 1.3, base: d };
      d.hunter = ['raptor', 'hound', 'imp'].includes(w.model);
      if (w.boss) {
        // CC: Bosse werden Champions (+25 % Leben, +25 % Schaden, +2 Rüstung) – die Läuterung nimmt das wieder weg.
        // Kampagne: nur +25 % Leben (die Missionen sind darauf abgestimmt).
        const kit = (x) => (R.leaders ? bossKit(x) : x);
        const plain = kit(d);
        if (!R.champions) return plain;
        const ch = this.campaign ? { ...d, hp: Math.round(d.hp * 1.25) } : { ...d, hp: Math.round(d.hp * 1.25), dmg: d.dmg * 1.25, armor: d.armor + 2, champion: true, name: `Champion: ${d.name}` };
        const out = kit(ch);
        if (out.champion) out.base = plain;
        return out;
      }
      if (R.leaders) {
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
      // Extrem-Bots: schneller und mit kleinem Wirtschaftsvorsprung
      const ext = ps.bot && ps.difficulty === 'extreme';
      return {
        id, name: ps.name || `Spieler ${id + 1}`, team: ps.team, slot: slots[slotIdx[ps.team]++],
        faction, lines, bot: !!ps.bot, difficulty: ps.difficulty || 'normal', randomed: bonus > 0,
        rerolls: R.pickMode === 'pr' ? 1 : 0,
        gold: R.startGold + bonus + (ps.bonusGold || 0) + (ext ? 60 : 0), aether: R.startAether, income: R.startIncome + (ps.bonusIncome || 0) + (ext ? 6 : 0), workers: R.startWorkers + (ps.bonusWorkers || 0),
        ready: false, sendQueue: [], botTimer: 0.6 + id * 0.17,
        stats: { leaks: 0, kills: 0, sent: 0, sentValue: 0, leaked: 0, spent: { units: 0, upgrades: 0, workers: 0, sends: 0, king: 0 }, earned: { bounty: 0, income: 0, arena: 0 } },
        connected: true,
        stock: Object.fromEntries(SENDS.map((s) => [s.id, s.stock])), stockT: Object.fromEntries(SENDS.map((s) => [s.id, 0])),
        barracks: !!R.barracksOpen, drawVote: false, waveCreeps: 0,
      };
    });
    if (R.mirror) {
      // Gespiegelte Auswahl: Spieler auf gleicher Position im Gegnerteam bekommen dieselben Würfe
      for (const p of this.players) {
        if (p.team !== 1) continue;
        const twin = this.players.find((o) => o.team === 0 && o.slot === p.slot);
        if (twin) { p.faction = twin.faction; p.lines = twin.lines.slice(); p.randomed = twin.randomed; }
      }
    }
    // Funken-Obergrenze: 10 im 1 gegen 1, sonst 16
    this.maxWorkers = !this.campaign && teamCounts[0] === 1 && teamCounts[1] === 1 ? ECON.maxWorkersDuel : ECON.maxWorkers;
    this.arena = null;
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
          levels: { hp: 0, dmg: 0, regen: 0 }, abil: { stomp: 0, fire: 0, shock: 0, purge: 0 }, abilCd: { stomp: 0, shock: 0, purge: 0 }, fireT: 0, heals: camp ? 0 : KING.heals + longHeals + (setup.extraHeals?.[t] || 0), maxHeals: camp ? 0 : KING.heals + longHeals + (setup.extraHeals?.[t] || 0), healCd: 0, atkCd: 0, alive: true, citadel: camp,
        },
      };
    });
    this.mission = R.mission ? createMission(R.mission) : null;
    missionHook(this, 'init');
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
    for (const e of this.entities.values()) if (e.type === 'f' && e.owner === pid && !e.summon && !e.arena) out.push(e);
    return out;
  }
  cellFree(pid, col, row) {
    for (const e of this.entities.values()) if (e.type === 'f' && e.owner === pid && e.col === col && e.row === row) return false;
    return true;
  }
  workerCost(p) { return ECON.workerCost + ECON.workerCostStep * Math.max(0, p.workers - this.rules.startWorkers); }
  /** Söldner grundsätzlich verfügbar (Welle, Ausmusterung)? Mit p zusätzlich: Kaserne offen und Bestand vorhanden */
  sendAvailable(s, p) {
    if (this.wave < s.unlock) return false;
    if (this.sendRetired(s)) return false;
    if (p && s.row === 2 && !p.barracks) return false;
    if (p && this.rules.sendStock && p.stock[s.id] <= 0) return false;
    return true;
  }
  sendRetired(s) { return !!(this.rules.sendRetire && s.retire && this.wave >= s.retire); }
  /** Kopfgeld-Faktor einer Bahn: sinkt mit dem Anteil der in dieser Welle durchgelassenen Gegner */
  leakBountyMul(p) {
    const leaks = p.stats.leaksThisWave || 0;
    if (!leaks || this.campaign) return 1;
    return Math.max(ECON.leakBountyMin, 1 - (ECON.leakBountyCut * leaks) / Math.max(1, p.waveCreeps || 1));
  }
  /** Äther-Ertrag pro Sekunde */
  aetherRate(p) { return p.workers * ECON.workerRate * (1 + ECON.gatherBonus * (p.gatherLvl || 0)); }
  isArenaWave(n = this.wave) {
    if (!this.rules.arena || this.campaign) return false;
    if (!this.players.some((p) => p.team === 0) || !this.players.some((p) => p.team === 1)) return false;
    return (this.rules.arenaWaves || []).includes(n);
  }
  kingGrowth(k) { return k.citadel ? 1 : Math.pow(1.1, Math.max(0, this.wave - 1)); }
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
      case 'leave': return this.cmdLeave(p);
      case 'barracks': return this.cmdBarracks(p);
      case 'kingAbility': return this.cmdKingAbility(p, cmd);
      case 'kingCast': return this.cmdKingCast(p, cmd);
      case 'drawVote': return this.cmdDrawVote(p, cmd);
      case 'mission': {
        // Missions-Aktion (Klick auf Missionsobjekt, Pakt, Leuchtkugel …) – nur in Kampagnen-Missionen
        const r = missionHook(this, 'command', p, cmd);
        if (typeof r === 'string') return this.fail(p, r);
        return r === true;
      }
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
    p.gold -= def.cost; p.stats.spent.units += def.cost;
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
    p.gold -= next.cost; p.stats.spent.upgrades += next.cost;
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
    if (f.fresh) p.stats.spent.units = Math.max(0, p.stats.spent.units - refund); // Rückgabe in derselben Bauphase
    this.entities.delete(f.id);
    this.emit({ e: 'sell', pid: p.id, id: f.id, x: f.x, z: f.z, amount: refund });
    return true;
  }
  cmdSend(p, { send }) {
    const s = SEND_BY_ID[send];
    if (!s) return this.fail(p, 'Unbekannter Söldner');
    if (this.wave < s.unlock) return this.fail(p, `Ab Welle ${s.unlock}`);
    if (this.sendRetired(s)) return this.fail(p, `Ausgemustert seit Welle ${s.retire}`);
    if (s.row === 2 && !p.barracks) return this.fail(p, 'Erst die Erweiterte Kaserne freischalten');
    if (this.rules.sendStock && p.stock[s.id] <= 0) return this.fail(p, `${s.name}: Bestand leer – nächster in ${Math.max(1, Math.ceil(s.restock - p.stockT[s.id]))} s`);
    const cost = this.sendCost(s);
    if (p.aether < cost) return this.fail(p, 'Nicht genug Äther');
    p.aether -= cost; p.stats.spent.sends += cost;
    if (this.rules.sendStock) p.stock[s.id]--;
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
    if (p.workers >= this.maxWorkers) return this.fail(p, `Höchstens ${this.maxWorkers} Funken`);
    if (p.gold < cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= cost; p.workers++; p.stats.spent.workers += cost;
    this.emit({ e: 'worker', pid: p.id, workers: p.workers });
    return true;
  }
  gatherCost(p) { return 150 + 120 * (p.gatherLvl || 0); }
  cmdGather(p) {
    const lvl = p.gatherLvl || 0;
    if (lvl >= ECON.maxGather) return this.fail(p, 'Sammeln ist voll ausgebaut');
    const cost = this.gatherCost(p);
    if (p.gold < cost) return this.fail(p, 'Nicht genug Gold');
    p.gold -= cost; p.gatherLvl = lvl + 1; p.stats.spent.workers += cost;
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
    p.aether -= cost; p.stats.spent.king += cost;
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
    const amt = Math.min(KING.healCap, Math.round(k.maxHp * KING.healPct));
    k.hp = Math.min(k.maxHp, k.hp + amt);
    this.emit({ e: 'kingHeal', team: p.team, pid: p.id, amount: amt });
    return true;
  }
  cmdLeave(p) {
    if (!p.connected) return false;
    p.connected = false; p.bot = true; p.drawVote = false; // Bot übernimmt (Online)
    // Wer die Partie verlässt, kostet sein Team eine Königsheilung
    const k = this.teams[p.team].king;
    if (k.heals > 0) { k.heals--; this.emit({ e: 'healLost', team: p.team, pid: p.id, heals: k.heals }); }
    this.checkDrawVote();
    return true;
  }
  cmdBarracks(p) {
    if (p.barracks) return this.fail(p, 'Die Erweiterte Kaserne ist schon offen');
    const cost = Math.round(ECON.barracksCost * this.rules.sendCostMul);
    if (p.aether < cost) return this.fail(p, 'Nicht genug Äther');
    p.aether -= cost; p.stats.spent.sends += cost;
    p.barracks = true;
    this.emit({ e: 'barracks', pid: p.id });
    return true;
  }
  /** König-Fähigkeit freischalten (Stufe 1) oder aufrüsten (bis 3) – mit Äther, gilt fürs ganze Team */
  cmdKingAbility(p, { ab }) {
    const d = KING_ABILITIES[ab];
    const k = this.teams[p.team].king;
    if (!d || k.citadel) return this.fail(p, 'Unbekannte Fähigkeit');
    const lv = k.abil[ab];
    if (lv >= 3) return this.fail(p, 'Höchste Stufe erreicht');
    const cost = kingAbilityCost(ab, lv);
    if (p.aether < cost) return this.fail(p, 'Nicht genug Äther');
    p.aether -= cost; p.stats.spent.king += cost;
    k.abil[ab] = lv + 1;
    this.emit({ e: 'kingAbility', pid: p.id, team: p.team, ab, level: lv + 1 });
    return true;
  }
  /** Gegner, die gerade das Team angreifen (Bahnen des Teams und Durchbrecher) */
  teamThreats(team) {
    const out = [];
    for (const e of this.entities.values()) if (e.type === 'c' && e.alive && e.team === team && !e.siege) out.push(e);
    return out;
  }
  cmdKingCast(p, { ab, x, z, id }) {
    const d = KING_ABILITIES[ab];
    const k = this.teams[p.team].king;
    if (!d || d.passive) return this.fail(p, 'Keine aktive Fähigkeit');
    const lv = k.abil[ab];
    if (!lv) return this.fail(p, `${d.name} ist noch nicht freigeschaltet (Königshalle)`);
    if (this.phase !== 'battle') return this.fail(p, 'Nur während einer Welle');
    if (k.abilCd[ab] > 0) return this.fail(p, `${d.name} lädt noch (${Math.ceil(k.abilCd[ab])} s)`);
    const L = lv - 1;
    const g = this.kingGrowth(k);
    const src = { type: 'k', team: p.team, x: k.x, z: k.z, alive: true, hp: 1, maxHp: 1 };
    if (ab === 'stomp') {
      const r2 = d.radius[L] ** 2;
      const hit = this.teamThreats(p.team).filter((c) => (c.x - k.x) ** 2 + (c.z - k.z) ** 2 <= r2);
      if (!hit.length) return this.fail(p, 'Keine Gegner beim König');
      this.emit({ e: 'kingCast', team: p.team, pid: p.id, ab, x: k.x, z: k.z, r: d.radius[L], n: hit.length });
      for (const c of hit) {
        c.stun = Math.max(c.stun, d.stun[L] * (c.def.boss ? 0.5 : 1));
        if (c.lcast) c.lcast = null; // unterbricht Anführer-Zauber
        this.emit({ e: 'stun', id: c.id });
        this.applyHit(src, c, d.dmg[L] * g, 'wucht', false, true);
      }
    } else if (ab === 'shock') {
      // Richtung: Zielpunkt oder nächster Gegner beim König
      let tx = x, tz = z;
      if (!(Number.isFinite(tx) && Number.isFinite(tz))) {
        let best = null, bd = Infinity;
        for (const c of this.teamThreats(p.team)) { const dd = (c.x - k.x) ** 2 + (c.z - k.z) ** 2; if (dd < bd || (dd === bd && c.id < best.id)) { bd = dd; best = c; } }
        if (!best || bd > (d.len[L] + 2) ** 2) return this.fail(p, 'Kein Gegner in Reichweite der Schockwelle');
        tx = best.x; tz = best.z;
      }
      let dx = tx - k.x, dz = tz - k.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const len = d.len[L], hw = d.width;
      this.emit({ e: 'kingCast', team: p.team, pid: p.id, ab, x: k.x, z: k.z, tx: k.x + dx * len, tz: k.z + dz * len, w: hw });
      for (const c of this.teamThreats(p.team)) {
        const rx = c.x - k.x, rz = c.z - k.z;
        const along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
        if (along < 0 || along > len || side > hw + this.radiusOf(c)) continue;
        this.applyHit(src, c, d.dmg[L] * g, 'arkan', false, true);
      }
    } else if (ab === 'purge') {
      let t = id != null ? this.entities.get(id) : null;
      if (t && (t.type !== 'c' || !t.alive || t.team !== p.team)) return this.fail(p, 'Ungültiges Ziel');
      if (!t) {
        // automatisch: zuerst Champions/Bosse (beim König vor denen in den Bahnen), sonst der stärkste Gegner
        const score = (c) => (c.def.champion ? 1e7 : 0) + (c.def.boss ? 5e6 : 0) + (c.stage === 'king' ? 1e6 : 0) + c.hp;
        for (const c of this.teamThreats(p.team)) if (!t || score(c) > score(t) || (score(c) === score(t) && c.id < t.id)) t = c;
      }
      if (!t) return this.fail(p, 'Kein Ziel für die Läuterung');
      const was = this.purge(t);
      t.slowPct = Math.max(t.slowPct, d.slow[L]); t.slowT = d.dur;
      this.emit({ e: 'kingCast', team: p.team, pid: p.id, ab, x: t.x, z: t.z, id: t.id, champion: was });
    }
    k.abilCd[ab] = d.cd[L];
    return true;
  }
  /** Champion-Boni entfernen (Leben anteilig, Schaden, Rüstung, Größe) */
  purge(c) {
    if (!c.def.champion || !c.def.base) return false;
    const base = c.def.base, r = c.hp / c.maxHp;
    c.def = base; c.defId = base.key || base.id;
    c.maxHp = base.hp; c.hp = Math.max(1, base.hp * r);
    return true;
  }
  /** Online: Unentschieden – alle verbundenen Menschen müssen zustimmen */
  cmdDrawVote(p, { yes = true }) {
    if (p.bot || !p.connected) return false;
    p.drawVote = !!yes;
    const humans = this.players.filter((o) => !o.bot && o.connected);
    this.emit({ e: 'drawVote', pid: p.id, yes: p.drawVote, votes: humans.filter((o) => o.drawVote).length, need: humans.length });
    this.checkDrawVote();
    return true;
  }
  checkDrawVote() {
    if (this.phase === 'over') return;
    const humans = this.players.filter((o) => !o.bot && o.connected);
    if (humans.length >= 2 && humans.every((o) => o.drawVote)) this.finish(-1, 'Unentschieden vereinbart');
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
        p.botTimer = p.difficulty === 'easy' ? 1.6 : p.difficulty === 'hard' ? 0.5 : p.difficulty === 'extreme' ? 0.35 : 0.9;
        botThink(this, p);
        // Bots bedienen auch Missions-Mechaniken (Klick-Objekte, Pakte …)
        if (this.mission && this.phase !== 'over') { const mc = missionHook(this, 'bot', p); if (mc) this.applyCommand(p.id, mc); }
      }
    }

    // Äther der Arbeiter
    for (const p of this.players) p.aether += this.aetherRate(p) * DT;
    // Söldner-Bestand füllt sich auf
    if (this.rules.sendStock) {
      for (const p of this.players) for (const s of SENDS) {
        if (p.stock[s.id] >= s.stock) { p.stockT[s.id] = 0; continue; }
        p.stockT[s.id] += DT;
        if (p.stockT[s.id] >= s.restock - 1e-9) { p.stockT[s.id] = 0; p.stock[s.id]++; }
      }
    }

    if (this.phase === 'build') {
      this.phaseTime -= DT;
      if (this.phaseTime <= 0) this.startWave();
    } else if (this.phase === 'arena') {
      this.updateArena();
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
    for (const p of this.players) {
      const lx = this.laneX(p.id);
      p.waveCreeps = w.count + (w.leaderDef ? 1 : 0) + p.sendQueue.length;
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
      else if (e.type === 'f') {
        const d = UNITS[e.def];
        Object.assign(e, {
          x: e.hx, z: e.hz, hp: d.hp, maxHp: d.hp, alive: true, cd: 0, healCd: 0, target: 0, stun: 0,
          slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, face: Math.PI, atkT: -9, hbT: 0, shield: 0, shieldT: 0, dots: null,
        });
      }
    }
    for (const p of this.players) {
      p.gold += p.income; p.stats.earned.income += p.income;
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
    if (this.isArenaWave()) { this.startArena(); return; }
    this.nextBuild();
  }
  nextBuild() {
    this.wave++;
    this.phase = 'build';
    this.phaseTime = this.rules.buildTime;
  }

  // ---------- Arena (nach Welle 10 und 20) ----------
  startArena() {
    this.phase = 'arena';
    const reward = ECON.arenaGold[this.wave] ?? 150 * (1 + (this.rules.arenaWaves || []).indexOf(this.wave));
    this.arena = { wave: this.wave, stage: 'countdown', t: ECON.arenaCountdown, time: 0, reward, winner: -2, count: [0, 0], value: [0, 0] };
    // Kopien aller gebauten Kämpfer – die Originale bleiben unberührt auf ihren Plätzen
    for (const t of [0, 1]) {
      const ps = this.players.filter((p) => p.team === t).sort((a, b) => a.slot - b.slot);
      ps.forEach((p, idx) => {
        for (const f of this.fightersOf(p.id)) {
          const def = UNITS[f.def];
          const at = arenaSpot(t, idx, ps.length, f.col, f.row);
          const c = this.spawnFighter(p, def, -1, -1, at.x, at.z);
          c.arena = true; c.src = f.id; c.face = t === 0 ? Math.PI / 2 : -Math.PI / 2;
          this.arena.count[t]++; this.arena.value[t] += def.value;
        }
      });
    }
    this.emit({ e: 'arenaStart', wave: this.wave, reward, countdown: ECON.arenaCountdown, count: this.arena.count.slice(), value: this.arena.value.slice(), x: ARENA.x, z: ARENA.z });
  }
  arenaFighters() {
    const out = [[], []];
    for (const e of this.entities.values()) if (e.type === 'f' && e.arena && e.alive) out[e.team].push(e);
    return out;
  }
  updateArena() {
    const A = this.arena;
    if (!A) { this.nextBuild(); return; }
    if (A.stage === 'countdown') {
      A.t -= DT;
      if (A.t <= 1e-9) { A.stage = 'fight'; A.t = 0; this.emit({ e: 'arenaFight', wave: A.wave }); }
      return;
    }
    if (A.stage === 'fight') {
      A.time += DT;
      const sides = this.arenaFighters();
      const projectiles = [];
      for (const e of this.entities.values()) if (e.type === 'p' && e.arena) projectiles.push(e);
      for (const t of [0, 1]) this.computeAuras(sides[t]);
      for (const t of [0, 1]) for (const f of sides[t]) if (f.alive) this.updateArenaFighter(f, sides[t], sides[1 - t]);
      this.separateArena(sides[0].concat(sides[1]).filter((f) => f.alive));
      for (const pr of projectiles) this.updateProjectile(pr);
      const left = this.arenaFighters();
      const n0 = left[0].length, n1 = left[1].length;
      if (!n0 || !n1 || A.time >= ECON.arenaMaxTime) {
        let winner;
        if (!n0 && !n1) winner = -1;
        else if (!n0) winner = 1;
        else if (!n1) winner = 0;
        else {
          // Zeit abgelaufen: verbliebener Armeewert (anteilig nach Leben) entscheidet
          const v = left.map((s) => s.reduce((a, f) => a + UNITS[f.def].value * (f.hp / f.maxHp), 0));
          winner = Math.abs(v[0] - v[1]) < 1e-6 ? -1 : v[0] > v[1] ? 0 : 1;
        }
        A.winner = winner; A.stage = 'result'; A.t = ECON.arenaResultTime;
        if (winner >= 0) for (const p of this.players) if (p.team === winner) { p.gold += A.reward; p.stats.earned.arena += A.reward; this.emit({ e: 'gold', pid: p.id, amount: A.reward, x: ARENA.x, z: ARENA.z }); }
        for (const [id, e] of this.entities) if (e.type === 'p' && e.arena) this.entities.delete(id);
        this.emit({ e: 'arenaEnd', wave: A.wave, winner, reward: winner >= 0 ? A.reward : 0, left: [n0, n1], time: Math.round(A.time) });
      }
      return;
    }
    // Ergebnis-Anzeige, dann aufräumen → Bauphase (die Originale standen die ganze Zeit unverändert auf ihren Plätzen)
    A.t -= DT;
    if (A.t <= 1e-9) {
      for (const [id, e] of this.entities) if ((e.type === 'f' || e.type === 'p') && e.arena) this.entities.delete(id);
      this.arena = null;
      this.emit({ e: 'arenaDone', wave: A.wave });
      this.nextBuild();
    }
  }
  updateArenaFighter(f, allies, foes) {
    const def = UNITS[f.def];
    const ab = def.abil;
    if (ab.regen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + ab.regen * DT);
    if (!this.tickStatus(f)) return;
    if (f.healCd > 0) f.healCd -= DT;
    if (ab.heal && f.healCd <= 0) {
      let best = null, bestR = 0.92;
      for (const o of allies) {
        if (!o.alive) continue;
        const r = o.hp / o.maxHp;
        if (r < bestR && (o.x - f.x) ** 2 + (o.z - f.z) ** 2 <= (def.range + 1) ** 2) { best = o; bestR = r; }
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + ab.heal.amount);
        f.healCd = ab.heal.cd;
        this.emit({ e: 'heal', src: f.id, tgt: best.id, x: best.x, z: best.z, amount: ab.heal.amount });
      }
    }
    let tgt = f.target && this.entities.get(f.target);
    if (!tgt || !tgt.alive || !tgt.arena) {
      tgt = null; let bd = Infinity, taunt = false;
      for (const o of foes) {
        if (!o.alive) continue;
        const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
        const isT = !!UNITS[o.def].abil.taunt && d < 36;
        if ((isT && !taunt) || (isT === taunt && d < bd)) { bd = d; tgt = o; taunt = isT; }
      }
      f.target = tgt ? tgt.id : 0;
    }
    if (!tgt) return;
    const dist = Math.hypot(tgt.x - f.x, tgt.z - f.z);
    const reach = def.range + this.radiusOf(tgt) + 0.3;
    f.face = Math.atan2(tgt.x - f.x, tgt.z - f.z);
    if (dist > reach) { this.moveToward(f, tgt.x, tgt.z, def.speed * (1 - f.slowPct)); return; }
    if (f.cd > 0) return;
    f.cd = def.cd / (1 + f.auraSpeed);
    f.atkT = this.time;
    const mul = f.swarmMul || 1;
    if (def.ranged) {
      const targets = [tgt];
      if (ab.multishot) {
        const extra = foes.filter((c) => c.alive && c !== tgt && Math.hypot(c.x - f.x, c.z - f.z) <= reach + 1)
          .sort((a, b) => ((a.x - f.x) ** 2 + (a.z - f.z) ** 2) - ((b.x - f.x) ** 2 + (b.z - f.z) ** 2) || a.id - b.id);
        targets.push(...extra.slice(0, ab.multishot.targets - 1));
      }
      for (const t of targets) this.fireProjectile(f, t, def, mul).arena = true;
    } else {
      this.emit({ e: 'attack', id: f.id, tgt: tgt.id, melee: true, atk: def.atk });
      this.damage(f, tgt, def.dmg * mul, def.atk, ab, foes, true);
    }
  }
  separateArena(list) {
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
    const lim = ARENA.r - 1;
    for (const e of list) {
      const dx = e.x - ARENA.x, dz = e.z - ARENA.z, d = Math.hypot(dx, dz);
      if (d > lim) { e.x = ARENA.x + (dx / d) * lim; e.z = ARENA.z + (dz / d) * lim; }
    }
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
      if (e.type === 'o') continue; // Missions-Objekte
      if (!e.alive) continue;
      if (e.type === 'f') lanesF.get(e.lane).push(e);
      else if (e.stage === 'lane') lanesC.get(e.lane).push(e);
      else kingCreeps[e.team].push(e);
    }

    for (const p of this.players) {
      const fs = lanesF.get(p.id), cs = lanesC.get(p.id);
      this.computeAuras(fs);
      for (const f of fs) this.updateFighter(f, fs, cs);
      if (this.rules.leaders) leaderAura(this, cs);
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
      // Missions-Buffs (z. B. Kristallpfeiler) zählen wie Auren
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
          const src = this.entities.get(d.src) || { type: 'env', alive: false };
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
    return pr;
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
        if (pr.arena) {
          pool = [];
          for (const e of this.entities.values()) if (e.type === 'f' && e.arena && e.alive && e.team !== pr.team) pool.push(e);
        } else if (pr.side === 'f') {
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

    let tgt = c.target && this.entities.get(c.target);
    const forced = c.forcedT > 0 && tgt && tgt.alive;
    if (!forced && (!tgt || !tgt.alive || Math.hypot(tgt.x - c.x, tgt.z - c.z) > AGGRO + 2)) {
      tgt = null; let bd = AGGRO * AGGRO, taunt = false;
      for (const f of fs) {
        if (!f.alive || f.converted > 0) continue;
        const d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2;
        const isT = !!UNITS[f.def].abil.taunt;
        if (d <= AGGRO * AGGRO && ((isT && !taunt) || (isT === taunt && d < bd))) { bd = d; tgt = f; taunt = isT; }
      }
      c.target = tgt ? tgt.id : 0;
    }
    if ((c.rootT || 0) > 0 && tgt && Math.hypot(tgt.x - c.x, tgt.z - c.z) > def.range + this.radiusOf(tgt) + 0.3) return;
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
      for (const a in k.abilCd) if (k.abilCd[a] > 0) k.abilCd[a] -= DT;
      // Feueraura: alle 0,5 s Schaden an Gegnern um den König
      if (k.abil.fire && this.phase === 'battle') {
        k.fireT -= DT;
        if (k.fireT <= 1e-9) {
          k.fireT = 0.5;
          const F = KING_ABILITIES.fire, L = k.abil.fire - 1, r2 = F.radius[L] ** 2;
          const src = { type: 'k', team: t.id, x: k.x, z: k.z, alive: true, hp: 1, maxHp: 1 };
          for (const c of this.teamThreats(t.id)) if ((c.x - k.x) ** 2 + (c.z - k.z) ** 2 <= r2) this.applyHit(src, c, F.dps[L] * 0.5 * this.kingGrowth(k), 'chaos', false, true);
        }
      }
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
      const growth = this.kingGrowth(k);
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
    else { armorType = tgt.def.armorType; armor = tgt.def.armor + (tgt.moraleArmor || 0); }
    const mult = DAMAGE_TABLE[atk][armorType] ?? 1;
    let final = Math.max(1, dmg * mult * (1 - armorReduction(armor || 0)) * (1 + (tgt.cursePct || 0)));
    if (this.mission && this.mission.m.dmgMul) final *= missionHook(this, 'dmgMul', src, tgt, atk) || 1;
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, final); tgt.shield -= a; final -= a; }
    tgt.hp -= final;
    if (!secondary || crit) this.emit({ e: 'hit', id: tgt.id, x: tgt.x, z: tgt.z, dmg: Math.round(final), crit, atk, eff: mult });
    if (tgt.hp <= 0) this.kill(tgt, src);
    return final;
  }

  kill(e, src) {
    e.alive = false; e.hp = 0;
    if (this.mission) missionHook(this, 'onKill', e, src);
    if (e.type === 'c') {
      this.entities.delete(e.id);
      if (e.siege) { /* von der Rissfeste vernichtet – kein Gold */ }
      else if (e.stage === 'king' || (src && src.type === 'k')) {
        // Durchbrecher, die der König erledigt: Kopfgeldanteil fürs Team – ohne den Spieler, der ihn durchgelassen hat
        let team = this.players.filter((p) => p.team === e.team);
        if (team.length > 1 && !this.campaign) team = team.filter((p) => p.id !== e.lane);
        const share = Math.max(1, Math.floor((e.bounty * ECON.kingShare) / Math.max(1, team.length)));
        for (const p of team) { p.gold += share; p.stats.earned.bounty += share; this.emit({ e: 'gold', pid: p.id, amount: share, x: e.x, z: e.z }); }
      } else {
        // Kopfgeld-Abzug: wer in dieser Welle viel durchgelassen hat, bekommt weniger
        const p = this.players[e.lane];
        const amt = Math.max(1, Math.round(e.bounty * this.leakBountyMul(p)));
        p.gold += amt; p.stats.kills++; p.stats.earned.bounty += amt;
        this.emit({ e: 'gold', pid: p.id, amount: amt, x: e.x, z: e.z, cut: amt < e.bounty });
      }
      if (e.def.leader && e.stage === 'lane') {
        const quick = this.battleTime - (e.spawnT || 0) <= 20;
        const w = this.waveDef();
        const bonus = quick ? Math.round(w.bounty * w.count * 0.4) : 0;
        const p = this.players[e.lane];
        if (bonus) { p.gold += bonus; this.emit({ e: 'gold', pid: p.id, amount: bonus, x: e.x, z: e.z }); }
        this.emit({ e: 'leaderDown', id: e.id, lane: e.lane, quick, bonus, x: e.x, z: e.z });
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
    if (!e.arena && (e.stage === 'lane' || e.type === 'f')) {
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
    for (const p of this.players) { mix(Math.round(p.gold)); mix(Math.round(p.aether * 10)); mix(p.income); mix(p.workers); for (const s of SENDS) mix(p.stock[s.id]); mix(p.barracks ? 1 : 0); }
    for (const t of this.teams) { mix(Math.round(t.king.hp * 10)); for (const a of KING_ABILITY_IDS) mix(t.king.abil[a]); }
    mix(this.phase === 'arena' ? 7 : this.phase === 'battle' ? 3 : this.phase === 'over' ? 9 : 1);
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
