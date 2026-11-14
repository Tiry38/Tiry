// Bot-KI: läuft innerhalb der Simulation (deterministisch, nutzt sim.rng) und gibt normale Befehle ab.
import { UNITS, SENDS, ECON, KING, kingUpgradeCost, factionUnits } from './data.js';
import { GRID_COLS, GRID_ROWS } from './layout.js';

const FRONT_ROLES = new Set(['tank', 'melee', 'assassin']);
const SKILL = { easy: { spend: 0.6, upg: 0.35, send: 0.25 }, normal: { spend: 0.92, upg: 0.6, send: 0.55 }, hard: { spend: 1, upg: 0.8, send: 0.75 } };

export function botThink(sim, p) {
  const sk = SKILL[p.difficulty] || SKILL.normal;
  const rng = sim.rng;
  const k = sim.teams[p.team].king;

  // König heilen, wenn er wankt
  if (k.hp < k.maxHp * 0.4 && k.heals > 0 && k.healCd <= 0) sim.applyCommand(p.id, { type: 'heal' });

  // Arbeiter (frühe Investition)
  const targetWorkers = Math.min(ECON.maxWorkers, 1 + Math.floor(sim.wave * (p.difficulty === 'easy' ? 0.3 : 0.5)));
  if (p.workers < targetWorkers && p.gold >= sim.workerCost(p) + 70 && sim.wave >= 2 && rng.next() < 0.5) {
    sim.applyCommand(p.id, { type: 'worker' });
  }

  // Söldner senden / König aufwerten
  if (rng.next() < sk.send) {
    const avail = SENDS.filter((s) => sim.sendAvailable(s) && s.cost <= p.aether);
    if (avail.length && !(sim.wave % 10 === 9 && p.difficulty !== 'easy' && rng.next() < 0.5)) {
      const s = avail[avail.length - 1];
      sim.applyCommand(p.id, { type: 'send', send: s.id });
    }
  }
  if (p.difficulty !== 'easy' && k.hp < k.maxHp * 0.75 && rng.next() < 0.3) {
    const up = rng.pick(['hp', 'regen', 'dmg']);
    if (p.aether >= kingUpgradeCost(up, k.levels[up])) sim.applyCommand(p.id, { type: 'king', up });
  }

  if (sim.phase !== 'build') return;
  // Bauen & Aufwerten
  const budget = p.gold * sk.spend - (sim.wave >= 3 ? 20 : 0);
  if (budget <= 30) return;
  const mine = sim.fightersOf(p.id);
  const lines = factionUnits(p.faction);
  const used = mine.length;
  const wantUpgrade = used >= 6 && rng.next() < sk.upg;

  if (wantUpgrade) {
    const cands = mine.filter((f) => UNITS[f.def].upgradeTo).map((f) => ({ f, next: UNITS[UNITS[f.def].upgradeTo] }))
      .filter((c) => c.next.cost <= budget)
      .sort((a, b) => a.next.tier - b.next.tier || a.next.cost - b.next.cost || a.f.id - b.f.id);
    if (cands.length) {
      const c = cands[Math.min(cands.length - 1, rng.int(Math.min(3, cands.length)))];
      sim.applyCommand(p.id, { type: 'upgrade', id: c.f.id });
      return;
    }
  }
  if (used >= GRID_COLS * GRID_ROWS - 2) return;

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

function pickCell(sim, p, front) {
  const order = [];
  const colOrder = [2, 3, 1, 4, 0, 5];
  const rows = front ? [1, 2, 0, 3, 4, 5, 6, 7] : [3, 4, 2, 5, 6, 1, 7, 0];
  for (const r of rows) for (const c of colOrder) order.push([c, r]);
  for (const [c, r] of order) if (sim.cellFree(p.id, c, r)) return [c, r];
  return null;
}

export { KING };
