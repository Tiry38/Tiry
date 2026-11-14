import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim, DT } from '../src/sim/sim.js';
import { UNITS, WAVES, SENDS, ECON, factionUnits, FACTION_IDS } from '../src/sim/data.js';

const setup = (seed = 5, n = 2) => {
  const players = [{ name: 'Tiry', team: 0, faction: 'orden', bot: false }];
  for (let i = 1; i < n * 2; i++) players.push({ team: i % 2, faction: 'random', bot: true, difficulty: 'normal' });
  return { seed, players };
};
const run = (sim, ticks, cmdsAt = {}) => { for (let i = 0; i < ticks && sim.phase !== 'over'; i++) sim.step(cmdsAt[sim.tick] || []); };

test('Daten: 6 Völker × 8 Linien × 5 Vasallen (2 Pfade), 30 Wellen, Bosse auf 10/20/30', () => {
  assert.equal(Object.keys(UNITS).length, 240);
  assert.equal(FACTION_IDS.length, 6);
  for (const f of FACTION_IDS) assert.equal(factionUnits(f).length, 8);
  for (const u of Object.values(UNITS)) if (u.tier === 1) assert.equal(u.upgrades.length, 2, u.id);
  assert.equal(WAVES.length, 30);
  assert.deepEqual(WAVES.filter((w) => w.boss).map((w) => w.n), [10, 20, 30]);
  for (const u of Object.values(UNITS)) { assert.ok(u.hp > 0 && u.dmg > 0 && u.cost > 0, u.id); }
  for (const w of WAVES) assert.ok(w.hp > 0 && w.dmg > 0 && w.bounty > 0, w.name);
});

test('Bauen, Aufwerten, Verkaufen (voller Erstattungswert in derselben Bauphase)', () => {
  const sim = new Sim(setup());
  const p = sim.players[0];
  const unit = factionUnits('orden')[0];
  assert.ok(sim.applyCommand(0, { type: 'build', unit: unit.id, col: 2, row: 1 }));
  assert.equal(p.gold, ECON.startGold - unit.cost);
  assert.equal(sim.applyCommand(0, { type: 'build', unit: unit.id, col: 2, row: 1 }), false, 'Feld belegt');
  const f = sim.fightersOf(0)[0];
  assert.ok(sim.applyCommand(0, { type: 'upgrade', id: f.id, to: unit.upgrades[1] }));
  assert.equal(f.def, unit.upgrades[1]);
  assert.equal(UNITS[f.def].branch, 'b');
  const before = p.gold;
  assert.ok(sim.applyCommand(0, { type: 'sell', id: f.id }));
  assert.equal(p.gold, before + UNITS[unit.upgrades[1]].value);
  assert.equal(sim.applyCommand(0, { type: 'build', unit: 'wild_wolf_1', col: 0, row: 0 }), false, 'fremde Fraktion');
});

test('Wellenablauf: Bauphase → Kampf → Einkommen → Kämpfer stehen wieder an ihrem Platz', () => {
  const sim = new Sim(setup(9));
  const u = factionUnits('orden')[0];
  for (let c = 0; c < 4; c++) sim.applyCommand(0, { type: 'build', unit: u.id, col: c + 1, row: 1 });
  const f = sim.fightersOf(0)[0];
  const home = [f.hx, f.hz];
  let started = false, ended = false;
  const gold0 = sim.players[0].gold;
  for (let i = 0; i < 20 * 200 && !ended; i++) {
    for (const e of sim.step()) { if (e.e === 'waveStart') started = true; if (e.e === 'waveEnd') ended = true; }
  }
  assert.ok(started && ended);
  assert.equal(sim.wave, 2);
  assert.equal(sim.phase, 'build');
  assert.ok(sim.players[0].gold >= gold0 + ECON.startIncome);
  assert.deepEqual([f.x, f.z], home);
  assert.equal(f.hp, f.maxHp);
});

test('Söldner senden erhöht Einkommen und erscheinen in der Bahn des Gegners', () => {
  const sim = new Sim(setup(3));
  const p = sim.players[0];
  const s = SENDS[0];
  p.aether = 100;
  assert.ok(sim.applyCommand(0, { type: 'send', send: s.id }));
  assert.equal(p.income, ECON.startIncome + s.income);
  const opp = sim.players[p.opponent];
  assert.equal(opp.team, 1);
  assert.equal(opp.sendQueue.length, 1);
  assert.equal(sim.applyCommand(0, { type: 'send', send: SENDS[6].id }), false, 'noch gesperrt');
});

test('Arbeiter erzeugen Äther, König-Verbesserungen & Heilung', () => {
  const sim = new Sim(setup(4));
  const p = sim.players[0];
  const a0 = p.aether;
  run(sim, 20 * 10);
  assert.ok(p.aether > a0 + 4);
  p.aether = 1000;
  const k = sim.teams[0].king;
  assert.ok(sim.applyCommand(0, { type: 'king', up: 'hp' }));
  assert.equal(k.maxHp, 6900);
  k.hp = 1000;
  assert.ok(sim.applyCommand(0, { type: 'heal' }));
  assert.ok(k.hp > 1000);
  assert.equal(sim.applyCommand(0, { type: 'heal' }), false, 'Abklingzeit');
});

test('Determinismus: gleiche Befehle → identische Prüfsumme (Grundlage für Online-Spiel)', () => {
  const cmds = { 5: [{ pid: 0, cmd: { type: 'build', unit: 'orden_squire_1', col: 2, row: 0 } }], 30: [{ pid: 0, cmd: { type: 'worker' } }] };
  const a = new Sim(setup(77, 4)), b = new Sim(setup(77, 4));
  run(a, 20 * 400, cmds); run(b, 20 * 400, cmds);
  assert.equal(a.hash(), b.hash());
  const c = new Sim(setup(78, 4)); run(c, 20 * 400, cmds);
  assert.notEqual(a.hash(), c.hash());
});

test('Komplette 8-Spieler-Partie mit Bots läuft bis zum Ende', () => {
  const players = [];
  for (let i = 0; i < 8; i++) players.push({ team: i % 2, faction: 'random', bot: true, difficulty: i < 4 ? 'hard' : 'easy' });
  const sim = new Sim({ seed: 12, players });
  run(sim, 20 * 60 * 60);
  assert.equal(sim.phase, 'over');
  assert.ok(sim.winner === 0 || sim.winner === 1 || sim.winner === -1);
});
