// Kampagne ohne Helden: Missions-Aktionen laufen als Befehle über applyCommand (Lockstep-fest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.js';
import { MISSIONS, missionSetup } from '../src/sim/campaign.js';
import { missionHook } from '../src/sim/missions.js';

const byMech = (k) => MISSIONS.find((m) => m.mechanic === k);
const sim = (k, seed = 7) => new Sim(missionSetup(byMech(k), { seed }));
const toBattle = (s) => { s.phaseTime = 0; while (s.phase !== 'battle' || s.freeze > 0) s.step(); };
const objs = (s, kind) => [...s.entities.values()].filter((e) => e.type === 'o' && e.kind === kind);

test('Kampagne: kein Held, keine Helden-Befehle, jede Mission hat einen Zieltext', () => {
  for (const m of MISSIONS) {
    const s = new Sim(missionSetup(m, { seed: 2 }));
    assert.ok(![...s.entities.values()].some((e) => e.type === 'h'), `${m.id}: kein Held`);
    assert.equal(s.applyCommand(0, { type: 'hin', f: 1 }), false);
    const t = missionHook(s, 'text');
    assert.ok(typeof t === 'string' && t.length > 10, `${m.id}: Zieltext`);
    assert.ok(!/Held/.test(t), `${m.id}: Zieltext ohne Held – ${t}`);
    assert.ok(!(m.tips || []).some((x) => /Held/.test(x)), `${m.id}: Tipps ohne Held`);
  }
});

test('Funken: Klick-Befehl sammelt, falsches Ziel wird abgelehnt', () => {
  const s = sim('shards');
  toBattle(s);
  const [o] = objs(s, 'shard');
  assert.ok(o);
  assert.ok(missionHook(s, 'clickable', o));
  const a0 = s.players[0].aether;
  assert.ok(s.applyCommand(0, { type: 'mission', id: o.id }));
  assert.equal(s.players[0].aether, a0 + 15);
  assert.equal(s.applyCommand(0, { type: 'mission', id: o.id }), false, 'schon eingesammelt');
  assert.equal(s.mission.st.count, 1);
});

test('Leuchtfeuer: nur in der Kampfphase, brennen ab', () => {
  const s = sim('night');
  const [b] = objs(s, 'beacon');
  assert.equal(s.applyCommand(0, { type: 'mission', id: b.id }), false);
  toBattle(s);
  assert.ok(s.applyCommand(0, { type: 'mission', id: b.id }));
  assert.ok(b.lit);
  for (let i = 0; i < 20 * 13 && s.phase === 'battle'; i++) s.step();
  if (s.phase === 'battle') assert.equal(b.lit, false, 'nach 12 s erloschen');
});

test('Dornenfürst: Wurzelfalle per Klick mit Abklingzeit', () => {
  const s = sim('chase');
  toBattle(s);
  const c = [...s.entities.values()].find((e) => e.fleeing);
  assert.ok(missionHook(s, 'clickable', c));
  assert.ok(s.applyCommand(0, { type: 'mission', id: c.id }));
  assert.ok(c.rootT > 0);
  assert.equal(s.applyCommand(0, { type: 'mission', id: c.id }), false, 'Abklingzeit');
});

test('Verrat: Treueschwur schützt vor Überlaufen', () => {
  const s = sim('betrayal');
  const p = s.players[0];
  p.gold = 5000;
  const ids = [];
  for (let c = 0; c < 3; c++) { s.applyCommand(0, { type: 'build', unit: p.lines[0], col: c, row: 1 }); }
  for (const f of s.fightersOf(0)) ids.push(f.id);
  assert.ok(s.applyCommand(0, { type: 'mission', action: 'oath', id: ids[0] }));
  assert.ok(s.applyCommand(0, { type: 'mission', action: 'oath', id: ids[1] }));
  assert.equal(s.applyCommand(0, { type: 'mission', action: 'oath', id: ids[1] }), false);
  // zweite Missions-Welle hat Verrat
  for (let i = 0; i < 20 * 400 && s.wave < s.rules.startWave + 1; i++) s.step();
  toBattle(s);
  const loyal = ids.slice(0, 2).map((id) => s.entities.get(id));
  assert.ok(loyal.every((f) => f && !f.defected), 'Treue Vasallen bleiben');
});

test('Belagerung: Rammbock kostet Gold und trifft die Feste', () => {
  const s = sim('ram', 3);
  s.players[0].gold = 1000;
  assert.ok(s.applyCommand(0, { type: 'mission', action: 'ram' }));
  assert.equal(s.applyCommand(0, { type: 'mission', action: 'ram' }), false, 'einer pro Welle');
  const hp0 = s.teams[1].king.hp;
  const w = s.wave;
  let min = hp0;
  s.phaseTime = 0;
  for (let i = 0; i < 20 * 150 && s.wave === w; i++) { s.step(); min = Math.min(min, s.teams[1].king.hp); }
  assert.ok(min < hp0 - 2000, 'Rammbock hat die Feste getroffen');
});

test('Schatten: Leuchtkugel nur im Kampf und über der eigenen Bahn', () => {
  const s = sim('shadows');
  const x = s.laneX(0);
  assert.equal(s.applyCommand(0, { type: 'mission', action: 'flare', x, z: 0 }), false);
  toBattle(s);
  assert.equal(s.applyCommand(0, { type: 'mission', action: 'flare', x: x + 60, z: 0 }), false);
  assert.ok(s.applyCommand(0, { type: 'mission', action: 'flare', x, z: -10 }));
  assert.equal(objs(s, 'flare').length, 1);
  assert.equal(s.applyCommand(0, { type: 'mission', action: 'flare', x, z: -10 }), false, 'Abklingzeit');
});

test('Pakt, Runen, Ventile, Risskerne, Pfeiler: Aktionen wirken', () => {
  let s = sim('duel');
  const g = s.players[0].gold;
  assert.ok(s.applyCommand(0, { type: 'mission', action: 'pact' }));
  assert.ok(s.players[0].gold > g);
  assert.ok(missionHook(s, 'actions', {}).length === 1);
  s = sim('titan'); s.players[0].aether = 500;
  const [r] = objs(s, 'rune');
  assert.ok(s.applyCommand(0, { type: 'mission', id: r.id }));
  assert.equal(s.mission.st.runes, 1);
  s = sim('colossus'); toBattle(s);
  for (let i = 0; i < 20 * 5; i++) s.step();
  const [v] = objs(s, 'valve');
  assert.ok(v && s.applyCommand(0, { type: 'mission', id: v.id }));
  assert.equal(s.mission.st.vented, 1);
  s = sim('riftlord'); s.players[0].aether = 100; toBattle(s);
  const [c] = objs(s, 'riftcore');
  assert.ok(s.applyCommand(0, { type: 'mission', id: c.id }));
  s = sim('pylons'); s.players[0].aether = 100;
  const [py] = objs(s, 'pylon');
  assert.ok(s.applyCommand(0, { type: 'mission', id: py.id }));
  assert.ok(py.lit);
});

test('Determinismus mit Missions-Befehlen', () => {
  const play = () => {
    const s = new Sim(missionSetup(byMech('shards'), { seed: 11 }));
    s.players[0].bot = true; s.players[0].difficulty = 'hard';
    for (let i = 0; i < 20 * 200; i++) s.step();
    return s.hash();
  };
  assert.equal(play(), play());
});
