// Arena, Söldner-Bestand, König-Fähigkeiten, Champion-Bosse, Kopfgeld-Abzug, Funken-Obergrenze, Unentschieden
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.js';
import { UNITS, SENDS, ECON, KING, KING_ABILITIES, factionUnits } from '../src/sim/data.js';
import { ARENA } from '../src/sim/layout.js';
import { MISSIONS, missionSetup } from '../src/sim/campaign.js';

const humans = (n, rules = {}, seed = 5) => ({ seed, rules, players: Array.from({ length: n * 2 }, (_, i) => ({ name: `P${i}`, team: i % 2, faction: 'orden', bot: false })) });
const bots = (n, rules = {}, seed = 5) => ({ seed, rules, players: Array.from({ length: n * 2 }, (_, i) => ({ team: i % 2, faction: 'random', bot: true, difficulty: 'hard' })) });
/** Welle als beendet markieren: Kampfphase ohne Gegner → nächster Schritt beendet die Welle */
const finishWave = (sim, wave) => { sim.wave = wave; sim.phase = 'battle'; for (const [id, e] of sim.entities) if (e.type === 'c' || e.type === 'p') sim.entities.delete(id); return sim.step(); };
const fill = (sim, pid, unitIdx, cells) => { const u = factionUnits('orden')[unitIdx]; for (const [c, r] of cells) assert.ok(sim.applyCommand(pid, { type: 'build', unit: u.id, col: c, row: r })); };

test('Arena nach Welle 10: Kopien kämpfen, Siegerteam +150 Gold, Kämpfer bleiben unverändert', () => {
  const sim = new Sim(humans(1));
  sim.players[0].gold = 5000; sim.players[1].gold = 5000;
  fill(sim, 0, 0, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [2, 1], [3, 1], [4, 1]]);
  fill(sim, 1, 0, [[2, 0]]);
  const homes = sim.fightersOf(0).map((f) => [f.id, f.x, f.z, f.hp]);
  const ev = finishWave(sim, 10);
  assert.equal(sim.phase, 'arena');
  const start = ev.find((e) => e.e === 'arenaStart');
  assert.ok(start);
  assert.deepEqual(start.count, [10, 1]);
  assert.equal(start.reward, ECON.arenaGold[10]);
  // Kopien stehen in der Arena, Originale zählen weiter normal
  const copies = [...sim.entities.values()].filter((e) => e.arena);
  assert.equal(copies.length, 11);
  for (const c of copies) assert.ok(Math.hypot(c.x - ARENA.x, c.z - ARENA.z) < ARENA.r, 'in der Arena');
  assert.equal(sim.fightersOf(0).length, 10);
  const g0 = sim.players[0].gold, g1 = sim.players[1].gold;
  // Countdown: niemand bewegt sich
  for (let i = 0; i < 20 * (ECON.arenaCountdown - 1); i++) sim.step();
  assert.equal(sim.arena.stage, 'countdown');
  const evs = [];
  for (let i = 0; i < 20 * 80 && sim.phase === 'arena'; i++) evs.push(...sim.step());
  const end = evs.find((e) => e.e === 'arenaEnd');
  assert.equal(end.winner, 0);
  assert.equal(end.reward, 150);
  assert.equal(sim.players[0].gold, g0 + 150);
  assert.equal(sim.players[1].gold, g1);
  assert.equal(sim.phase, 'build');
  assert.equal(sim.wave, 11);
  assert.equal([...sim.entities.values()].filter((e) => e.arena).length, 0, 'Kopien aufgeräumt');
  for (const [id, x, z, hp] of homes) { const f = sim.entities.get(id); assert.deepEqual([f.x, f.z, f.hp], [x, z, hp]); }
});

test('Arena nach Welle 20 bringt 300 Gold; ohne Regel bzw. in der Kampagne keine Arena', () => {
  const sim = new Sim(humans(2));
  for (const p of sim.players) p.gold = 3000;
  fill(sim, 1, 3, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  fill(sim, 3, 3, [[0, 0], [1, 0]]);
  finishWave(sim, 20);
  assert.equal(sim.arena.reward, 300);
  const before = sim.players.map((p) => p.gold);
  while (sim.phase === 'arena') sim.step();
  assert.deepEqual(sim.players.map((p, i) => p.gold - before[i]), [0, 300, 0, 300]);
  const off = new Sim(humans(1, { arena: false }));
  finishWave(off, 10);
  assert.equal(off.phase, 'build');
  const camp = new Sim(missionSetup(MISSIONS.find((m) => m.endWave > 10 && m.startWave <= 10), { seed: 2 }));
  assert.equal(camp.isArenaWave(10), false);
});

test('Arena ist deterministisch (Bots, gleiche Prüfsumme)', () => {
  const run = () => { const s = new Sim(bots(2, { startWave: 9 }, 41)); const evs = []; while (s.wave < 11 && s.phase !== 'over') evs.push(...s.step()); return { h: s.hash(), end: evs.find((e) => e.e === 'arenaEnd') }; };
  const a = run(), b = run();
  assert.ok(a.end, 'Arena hat stattgefunden');
  assert.equal(a.h, b.h);
  assert.deepEqual(a.end, b.end);
});

test('Söldner-Bestand, Auffüllen, Ausmusterung und Erweiterte Kaserne', () => {
  assert.equal(SENDS.length, 12);
  assert.equal(SENDS.filter((s) => s.row === 2).length, 6);
  const sim = new Sim(humans(1));
  const p = sim.players[0];
  p.aether = 5000;
  const rat = SENDS[0];
  for (let i = 0; i < rat.stock; i++) assert.ok(sim.applyCommand(0, { type: 'send', send: rat.id }));
  assert.equal(sim.applyCommand(0, { type: 'send', send: rat.id }), false, 'Bestand leer');
  for (let i = 0; i < rat.restock * 20 + 1; i++) sim.step();
  assert.equal(p.stock[rat.id], 1);
  assert.ok(sim.applyCommand(0, { type: 'send', send: rat.id }));
  // Ausmusterung
  sim.wave = rat.retire;
  assert.equal(sim.sendAvailable(rat, p), false);
  p.stock[rat.id] = 3;
  assert.equal(sim.applyCommand(0, { type: 'send', send: rat.id }), false);
  // Zweite Reihe erst mit Erweiterter Kaserne
  const naga = SENDS.find((s) => s.row === 2);
  sim.wave = naga.unlock;
  assert.equal(sim.applyCommand(0, { type: 'send', send: naga.id }), false);
  const a0 = p.aether;
  assert.ok(sim.applyCommand(0, { type: 'barracks' }));
  assert.equal(p.aether, a0 - ECON.barracksCost);
  assert.ok(sim.applyCommand(0, { type: 'send', send: naga.id }));
  assert.equal(sim.applyCommand(0, { type: 'barracks' }), false);
});

test('König-Fähigkeiten: freischalten, Stampfer betäubt, Abklingzeit, Feueraura, Schockwelle', () => {
  const sim = new Sim(humans(1));
  const p = sim.players[0], k = sim.teams[0].king;
  p.aether = 5000;
  assert.equal(sim.applyCommand(0, { type: 'kingCast', ab: 'stomp' }), false, 'gesperrt');
  assert.ok(sim.applyCommand(0, { type: 'kingAbility', ab: 'stomp' }));
  assert.ok(sim.applyCommand(0, { type: 'kingAbility', ab: 'stomp' }));
  assert.equal(k.abil.stomp, 2);
  assert.equal(sim.teams[1].king.abil.stomp, 0);
  sim.phaseTime = 0; sim.step(); // Welle 1 startet
  assert.equal(sim.applyCommand(0, { type: 'kingCast', ab: 'stomp' }), false, 'keine Gegner beim König');
  const w = sim.waveDef();
  const c = sim.spawnCreep(0, w, k.x + 2, k.z - 2, { bounty: 1, wave: true }); c.stage = 'king';
  const hp0 = c.hp;
  assert.ok(sim.applyCommand(0, { type: 'kingCast', ab: 'stomp' }));
  assert.ok(c.stun >= KING_ABILITIES.stomp.stun[1] - 1e-9);
  assert.ok(c.hp < hp0 || !c.alive);
  assert.equal(sim.applyCommand(0, { type: 'kingCast', ab: 'stomp' }), false, 'Abklingzeit');
  // Feueraura brennt dauerhaft
  assert.ok(sim.applyCommand(0, { type: 'kingAbility', ab: 'fire' }));
  const d = sim.spawnCreep(0, { ...w, hp: 1e6 }, k.x - 2, k.z - 1, { bounty: 1, wave: true }); d.stage = 'king'; d.hp = d.maxHp = 1e6;
  d.stun = 99;
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(d.hp < 1e6, 'Feueraura hat getroffen');
  // Schockwelle trifft auf einer Linie
  assert.ok(sim.applyCommand(0, { type: 'kingAbility', ab: 'shock' }));
  const far = sim.spawnCreep(0, { ...w, hp: 1e6 }, k.x, k.z - 12, { bounty: 1, wave: true }); far.hp = far.maxHp = 1e6;
  const off = sim.spawnCreep(0, { ...w, hp: 1e6 }, k.x + 12, k.z - 12, { bounty: 1, wave: true }); off.hp = off.maxHp = 1e6;
  assert.ok(sim.applyCommand(0, { type: 'kingCast', ab: 'shock', x: k.x, z: k.z - 20 }));
  assert.ok(far.hp < 1e6);
  assert.equal(off.hp, 1e6);
});

test('CC: Bosse sind Champions (+25 % Leben/Schaden, +2 Rüstung), Läuterung entfernt die Boni', () => {
  const plain = new Sim(humans(1)), cc = new Sim(humans(1, { champions: true }));
  const a = plain.waveDef(10), b = cc.waveDef(10);
  assert.ok(b.champion && !a.champion);
  assert.ok(Math.abs(b.hp / a.hp - 1.25) < 0.01);
  assert.ok(Math.abs(b.dmg / a.dmg - 1.25) < 1e-9);
  assert.equal(b.armor, a.armor + 2);
  // Läuterung auf einen Champion
  const sim = new Sim(humans(1, { champions: true }));
  sim.players[0].aether = 1000;
  assert.ok(sim.applyCommand(0, { type: 'kingAbility', ab: 'purge' }));
  sim.phaseTime = 0; sim.step();
  const champ = [...sim.entities.values()].find((e) => e.type === 'c' && e.def.champion && e.team === 0);
  assert.ok(champ);
  const r = champ.hp / champ.maxHp;
  assert.ok(sim.applyCommand(0, { type: 'kingCast', ab: 'purge', id: champ.id }));
  assert.equal(champ.def.champion, undefined);
  assert.equal(champ.maxHp, champ.def.hp);
  assert.ok(Math.abs(champ.hp / champ.maxHp - r) < 1e-9);
  assert.ok(champ.slowT > 0);
});

test('Kopfgeld-Abzug bei Durchbrüchen, Durchbrecher-Anteil ohne den Verursacher', () => {
  const sim = new Sim(humans(2));
  sim.phaseTime = 0; sim.step();
  const p = sim.players[0];
  assert.equal(sim.leakBountyMul(p), 1);
  p.stats.leaksThisWave = p.waveCreeps; // alles durchgelassen
  assert.equal(sim.leakBountyMul(p), ECON.leakBountyMin);
  p.stats.leaksThisWave = Math.round(p.waveCreeps / 4);
  assert.ok(sim.leakBountyMul(p) < 1 && sim.leakBountyMul(p) > ECON.leakBountyMin);
  // Durchbrecher von Bahn 0 wird vom König erledigt → nur der Mitspieler bekommt den Anteil
  const c = [...sim.entities.values()].find((e) => e.type === 'c' && e.lane === 0);
  c.stage = 'king';
  const mate = sim.players.find((o) => o.team === 0 && o.id !== 0);
  const g0 = p.gold, gm = mate.gold;
  sim.kill(c, { type: 'k' });
  assert.equal(p.gold, g0);
  assert.ok(mate.gold > gm);
});

test('Funken: höchstens 10 im 1 gegen 1, 16 sonst; Heilungen: Obergrenze, Lang +2, Verlassen −1', () => {
  assert.equal(new Sim(humans(1)).maxWorkers, ECON.maxWorkersDuel);
  assert.equal(new Sim(humans(2)).maxWorkers, ECON.maxWorkers);
  const sim = new Sim(humans(1));
  const p = sim.players[0];
  p.gold = 1e5; p.workers = ECON.maxWorkersDuel;
  assert.equal(sim.applyCommand(0, { type: 'worker' }), false);
  const k = sim.teams[0].king;
  k.maxHp = 20000; k.hp = 1000;
  assert.ok(sim.applyCommand(0, { type: 'heal' }));
  assert.equal(k.hp, 1000 + KING.healCap);
  assert.equal(new Sim(humans(1, { gameMode: 'long' })).teams[0].king.heals, KING.heals + 2);
  const s2 = new Sim(humans(2));
  assert.ok(s2.applyCommand(2, { type: 'leave' }));
  assert.equal(s2.teams[0].king.heals, KING.heals - 1);
  assert.equal(s2.applyCommand(2, { type: 'leave' }), false, 'nur einmal');
});

test('Unentschieden-Abstimmung: alle verbundenen Menschen müssen zustimmen', () => {
  const sim = new Sim(humans(1));
  assert.ok(sim.applyCommand(0, { type: 'drawVote', yes: true }));
  assert.notEqual(sim.phase, 'over');
  assert.ok(sim.applyCommand(1, { type: 'drawVote', yes: true }));
  assert.equal(sim.phase, 'over');
  assert.equal(sim.winner, -1);
});

test('Bots nutzen Bestand, Erweiterte Kaserne und König-Fähigkeiten', () => {
  const sim = new Sim(bots(2, { champions: true }, 17));
  const seen = {};
  while (sim.phase !== 'over' && sim.tick < 20 * 60 * 60) for (const e of sim.step()) seen[e.e] = (seen[e.e] || 0) + 1;
  assert.ok(seen.kingAbility > 0, 'Fähigkeiten freigeschaltet');
  assert.ok(seen.kingCast > 0, 'Fähigkeiten gewirkt');
  assert.ok(seen.barracks > 0, 'Erweiterte Kaserne');
  assert.ok(seen.arenaEnd >= 1, 'Arena');
  for (const p of sim.players) for (const s of SENDS) assert.ok(p.stock[s.id] >= 0 && p.stock[s.id] <= s.stock);
});
