import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.js';
import { UNITS } from '../src/sim/data.js';
import { parseModeCode, modeCode } from '../src/sim/modes.js';
import { MISSIONS, missionSetup, missionStars, talentBonus } from '../src/sim/campaign.js';

const players = (n) => Array.from({ length: n * 2 }, (_, i) => ({ name: `P${i}`, team: i % 2, faction: 'orden', bot: i > 0, difficulty: 'normal' }));

test('Moduskürzel: PRCC, HP, AP', () => {
  assert.deepEqual(parseModeCode('PRCC'), { pickMode: 'pr', champions: true });
  assert.deepEqual(parseModeCode('-hp'), { pickMode: 'hp', champions: false });
  assert.equal(modeCode({ pickMode: 'ar', champions: true }), 'ARCC');
});

test('PR: zufällige Fraktion mit Bonusgold, einmal neu würfeln', () => {
  const sim = new Sim({ seed: 4, players: players(2), rules: parseModeCode('PRCC') });
  const p = sim.players[0];
  assert.ok(p.randomed);
  const before = p.faction;
  assert.ok(sim.applyCommand(0, { type: 'reroll' }));
  assert.notEqual(p.faction, before);
  assert.equal(sim.applyCommand(0, { type: 'reroll' }), false);
  assert.ok(sim.applyCommand(0, { type: 'build', unit: p.lines[0], col: 0, row: 0 }));
});

test('CC: Champions erscheinen in der Welle', () => {
  const sim = new Sim({ seed: 2, players: players(1), rules: parseModeCode('APCC') });
  sim.phaseTime = 0;
  let champs = 0;
  sim.step();
  for (const e of sim.entities.values()) if (e.type === 'c' && e.def.champion) champs++;
  assert.equal(champs, 2 * 2); // 8 Krabbler je Bahn → 2 Champions, 2 Bahnen
});

test('HP: Hybrid-Baumeister hat 5 Linien aus verschiedenen Fraktionen und kann sie bauen', () => {
  const sim = new Sim({ seed: 9, players: players(4), rules: parseModeCode('HP') });
  for (const p of sim.players) {
    assert.equal(p.lines.length, 5);
    assert.equal(new Set(p.lines).size, 5);
    assert.ok(p.lines.filter((id) => ['tank', 'melee', 'assassin'].includes(UNITS[id].role)).length >= 2);
  }
  const p = sim.players[0];
  assert.ok(sim.applyCommand(0, { type: 'build', unit: p.lines[4], col: 1, row: 1 }));
  while (sim.phase !== 'over' && sim.tick < 20 * 60 * 8) sim.step();
  assert.ok(sim.wave > 3);
});

test('Kampagne: 24 Missionen mit eigener Mechanik starten und laufen; Söldner belagern die Rissfeste', () => {
  assert.equal(MISSIONS.length, 24);
  assert.equal(new Set(MISSIONS.filter((x) => x.mechanic && x.mechanic !== 'boss').map((x) => x.mechanic)).size, 19);
  for (const m of MISSIONS) {
    const s = missionSetup(m, { seed: 1, totalStars: 45 });
    s.players[0].bot = true; s.players[0].difficulty = 'hard';
    const sim = new Sim(s);
    assert.equal(sim.wave, m.startWave);
    assert.ok(sim.teams[1].king.citadel);
    for (let i = 0; i < 20 * 120 && sim.phase !== 'over'; i++) sim.step();
  }
  const m = MISSIONS.find((x) => x.goal === 'siege');
  const sim = new Sim(missionSetup(m, { seed: 3 }));
  sim.players[0].aether = 500;
  const hp0 = sim.teams[1].king.hp;
  assert.ok(sim.applyCommand(0, { type: 'send', send: 's_rat' }));
  const w0 = sim.wave;
  let minHp = hp0;
  for (let i = 0; i < 20 * 150 && sim.wave === w0; i++) { sim.step(); minHp = Math.min(minHp, sim.teams[1].king.hp); }
  assert.ok(minHp < hp0, 'Rissfeste hat Schaden genommen');
});

test('Kampagne: Sterne und Talente', () => {
  const m = MISSIONS[0];
  const s = missionSetup(m, { seed: 5 });
  s.players[0].bot = true;
  const sim = new Sim(s);
  while (sim.phase !== 'over') sim.step();
  assert.equal(sim.winner, 0);
  assert.ok(missionStars(m, sim) >= 2);
  assert.equal(talentBonus(0).gold, 0);
  assert.equal(talentBonus(45).gold, 90);
});

test('Spielmodi: Schnell (20 Wellen), Lang (+2 Heilungen), Hart (stärkere Wellen), Endwellen', async () => {
  const fast = new Sim({ seed: 1, players: players(1), rules: { gameMode: 'fast' } });
  assert.equal(fast.rules.maxWaves, 20);
  const long = new Sim({ seed: 1, players: players(1), rules: { gameMode: 'long' } });
  assert.equal(long.teams[0].king.heals, 5);
  const normal = new Sim({ seed: 1, players: players(1) });
  const hard = new Sim({ seed: 1, players: players(1), rules: { gameMode: 'hard' } });
  assert.ok(hard.waveDef(5).hp > normal.waveDef(5).hp);
  const end = normal.waveDef(31);
  assert.ok(end.endwave && end.hp > normal.waveDef(21).hp);
  assert.ok(normal.waveDef(41).hp > end.hp);
});

test('Sammeln verbessern erhöht den Äther-Ertrag', () => {
  const sim = new Sim({ seed: 2, players: players(1) });
  const p = sim.players[0];
  p.gold = 1000;
  assert.ok(sim.applyCommand(0, { type: 'gather' }));
  assert.equal(p.gatherLvl, 1);
  const a0 = p.aether;
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(Math.abs((p.aether - a0) - p.workers * 0.45 * 1.25) < 0.05);
});

test('Anführer: erscheint je Bahn, wirkt Fähigkeiten mit Bodenwarnung', () => {
  const sim = new Sim({ seed: 3, players: players(1), rules: { startWave: 12 } });
  sim.phaseTime = 0;
  const ev = [];
  for (let i = 0; i < 20 * 60 && sim.phase === 'build' || (sim.phase === 'battle' && i < 20 * 90); i++) for (const e of sim.step()) ev.push(e);
  assert.equal(ev.filter((e) => e.e === 'leaderSpawn').length, 2);
  assert.ok(ev.some((e) => e.e === 'leaderCast'));
});
