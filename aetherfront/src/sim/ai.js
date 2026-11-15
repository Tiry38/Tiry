// Bot-KI: läuft innerhalb der Simulation (deterministisch, nutzt sim.rng) und gibt normale Befehle ab.
import { UNITS, SENDS, ECON, KING, kingUpgradeCost, KING_ABILITIES, kingAbilityCost } from './data.js';
import { GRID_COLS, GRID_ROWS } from './layout.js';

const FRONT_ROLES = new Set(['tank', 'melee', 'assassin']);
// Reihenfolge, in der Bots König-Fähigkeiten freischalten/aufrüsten
const KING_PLAN = [['stomp', 1], ['fire', 1], ['shock', 1], ['fire', 2], ['stomp', 2], ['purge', 1], ['shock', 2], ['fire', 3], ['stomp', 3], ['shock', 3], ['purge', 2], ['purge', 3]];
const SKILL = { easy: { spend: 0.6, upg: 0.35, send: 0.25 }, normal: { spend: 0.92, upg: 0.6, send: 0.55 }, hard: { spend: 1, upg: 0.8, send: 0.75 }, extreme: { spend: 1, upg: 0.85, send: 0.85 } };

export function botThink(sim, p) {
  const sk = SKILL[p.difficulty] || SKILL.normal;
  const rng = sim.rng;
  const k = sim.teams[p.team].king;

  // König heilen, wenn er wankt
  if (k.hp < k.maxHp * 0.4 && k.heals > 0 && k.healCd <= 0) sim.applyCommand(p.id, { type: 'heal' });
  // König-Fähigkeiten wirken (gemeinsame Abklingzeit im Team)
  if (sim.phase === 'battle' && !k.citadel && p.difficulty !== 'easy') castKing(sim, p, k);

  // Arbeiter (frühe Investition)
  const targetWorkers = Math.min(sim.maxWorkers, sim.rules.startWorkers + Math.floor((sim.wave - sim.rules.startWave + 1) * (p.difficulty === 'easy' ? 0.3 : 0.5)));
  if (p.workers < targetWorkers && p.gold >= sim.workerCost(p) + 70 && sim.wave >= 2 && rng.next() < 0.5) {
    sim.applyCommand(p.id, { type: 'worker' });
  }

  // Sammeln verbessern (mittel- und hochstufige Bots investieren in Wirtschaft)
  if ((p.difficulty === 'hard' || p.difficulty === 'extreme') && p.workers >= 4 && (p.gatherLvl || 0) < 4 && p.gold >= sim.gatherCost(p) + 150 && rng.next() < 0.25) sim.applyCommand(p.id, { type: 'gather' });

  // Erweiterte Kaserne freischalten, sobald sich die zweite Reihe lohnt
  if (!p.barracks && sim.wave >= 9 && p.aether >= ECON.barracksCost * sim.rules.sendCostMul + 60 && rng.next() < sk.send) sim.applyCommand(p.id, { type: 'barracks' });
  // König-Fähigkeiten freischalten/aufrüsten (Stampfer und Feueraura zuerst)
  // In manchen Wellen spart der Bot Äther dafür (jeder Spieler eines Teams in einer anderen Welle)
  let saving = false;
  if (p.difficulty !== 'easy' && !k.citadel && sim.wave >= 5) {
    const step = KING_PLAN.find(([a, l]) => k.abil[a] < l && (a !== 'purge' || sim.rules.champions));
    if (step) {
      const cost = kingAbilityCost(step[0], k.abil[step[0]]);
      if (p.aether >= cost) { if (rng.next() < 0.5) sim.applyCommand(p.id, { type: 'kingAbility', ab: step[0] }); }
      else saving = (sim.wave + p.slot) % 3 === 0;
    }
  }
  // Söldner senden (Bestand beachten) / König aufwerten
  if (!saving && rng.next() < sk.send) {
    const avail = SENDS.filter((s) => sim.sendAvailable(s, p) && sim.sendCost(s) <= p.aether);
    if (avail.length && !(sim.wave % 10 === 9 && p.difficulty !== 'easy' && rng.next() < 0.5)) {
      const s = avail[avail.length - 1];
      sim.applyCommand(p.id, { type: 'send', send: s.id });
    }
  }
  // König vorausschauend aufrüsten (vor Bosswellen und regelmäßig), nicht erst wenn er wankt
  const bossSoon = sim.wave % 10 >= 8 || sim.wave % 10 === 0;
  if (p.difficulty !== 'easy' && (k.hp < k.maxHp * 0.75 || bossSoon || sim.wave % 4 === 0) && rng.next() < (p.difficulty === 'hard' ? 0.5 : 0.3)) {
    const up = rng.pick(['hp', 'regen', 'dmg']);
    if (p.aether >= kingUpgradeCost(up, k.levels[up])) sim.applyCommand(p.id, { type: 'king', up });
  }

  if (sim.phase !== 'build') return;
  // Bauen & Aufwerten
  const budget = p.gold * sk.spend - (sim.wave >= 3 ? 20 : 0);
  if (budget <= 30) return;
  const mine = sim.fightersOf(p.id);
  const lines = p.lines.map((id) => UNITS[id]);
  const used = mine.length;
  const wantUpgrade = used >= 6 && rng.next() < sk.upg;

  if (wantUpgrade) {
    const cands = mine.filter((f) => UNITS[f.def].upgrades.length).map((f) => { const ups = UNITS[f.def].upgrades; return { f, next: UNITS[ups[(f.id + p.id) % ups.length]] }; })
      .filter((c) => c.next.cost <= budget && c.next.tier <= sim.rules.maxTier)
      .sort((a, b) => a.next.tier - b.next.tier || a.next.cost - b.next.cost || a.f.id - b.f.id);
    if (cands.length) {
      const c = cands[Math.min(cands.length - 1, rng.int(Math.min(3, cands.length)))];
      sim.applyCommand(p.id, { type: 'upgrade', id: c.f.id, to: c.next.id });
      return;
    }
  }
  if (used >= GRID_COLS * sim.rules.gridRows - 2) return;

  // Rollen-Mischung: ca. 50 % vorne, 40 % hinten, Heiler/Unterstützer dazu
  const counts = { front: 0, back: 0, sup: 0 };
  for (const f of mine) {
    const r = UNITS[f.def].role;
    if (FRONT_ROLES.has(r)) counts.front++; else if (r === 'healer' || r === 'support') counts.sup++; else counts.back++;
  }
  let want;
  if (counts.front <= counts.back) want = 'front';
  else if (counts.sup * 6 < used && used >= 4) want = 'sup';
  else want = 'back';
  let options = lines.filter((u) => (want === 'front' ? FRONT_ROLES.has(u.role) : want === 'sup' ? (u.role === 'healer' || u.role === 'support') : !FRONT_ROLES.has(u.role) && u.role !== 'healer' && u.role !== 'support'));
  options = options.filter((u) => u.cost <= budget);
  if (!options.length) options = lines.filter((u) => u.cost <= budget);
  if (!options.length) return;
  const unit = options[rng.int(options.length)];
  const cell = pickCell(sim, p, FRONT_ROLES.has(unit.role));
  if (cell) sim.applyCommand(p.id, { type: 'build', unit: unit.id, col: cell[0], row: cell[1] });
}

/** König-Fähigkeiten im Kampf: Stampfer bei Gedränge am König, Schockwelle in Gruppen, Läuterung auf Champions */
function castKing(sim, p, k) {
  const near = (r) => { let n = 0, boss = false; for (const c of sim.teamThreats(p.team)) if ((c.x - k.x) ** 2 + (c.z - k.z) ** 2 <= r * r) { n++; if (c.def.boss) boss = true; } return { n, boss }; };
  const A = KING_ABILITIES;
  if (k.abil.stomp && k.abilCd.stomp <= 0) {
    const s = near(A.stomp.radius[k.abil.stomp - 1]);
    if (s.n >= 3 || s.boss) { sim.applyCommand(p.id, { type: 'kingCast', ab: 'stomp' }); return; }
  }
  if (k.abil.shock && k.abilCd.shock <= 0) {
    const s = near(A.shock.len[k.abil.shock - 1] * 0.8);
    if (s.n >= 3 || s.boss) { sim.applyCommand(p.id, { type: 'kingCast', ab: 'shock' }); return; }
  }
  if (k.abil.purge && k.abilCd.purge <= 0) {
    for (const c of sim.teamThreats(p.team)) if (c.def.champion && (c.stage === 'king' || c.def.boss)) { sim.applyCommand(p.id, { type: 'kingCast', ab: 'purge', id: c.id }); return; }
  }
}

function pickCell(sim, p, front) {
  const order = [];
  const colOrder = [2, 3, 1, 4, 0, 5];
  const rows = front ? [1, 2, 0, 3, 4, 5, 6, 7] : [3, 4, 2, 5, 6, 1, 7, 0];
  for (const r of rows) for (const c of colOrder) order.push([c, r]);
  for (const [c, r] of order) if (r < sim.rules.gridRows && sim.cellFree(p.id, c, r)) return [c, r];
  return null;
}

export { KING };
