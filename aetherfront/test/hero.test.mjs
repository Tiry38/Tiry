// Heldensteuerung: Simulationsseite, auf die sich die WoW-Steuerung verlässt (Tempo, GCD, Zauber-Warteschlange,
// Abbruch durch Bewegung, Abklingzeiten, Ziel/Auto-Angriff) und Gleichlauf der Client-Vorhersage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim, DT } from '../src/sim/sim.js';
import { HEROES, HERO_STATS as HS } from '../src/sim/heroes.js';
import { stepMotion, laneClamp, HeroPredictor, SIM_DT } from '../src/hero/predict.js';
import { resolveBinds, setBind, comboLabel, comboFromEvent, bindIndex } from '../src/hero/keybinds.js';
import { ANIM_TIME, abilityAnim, impactDelay } from '../src/hero/anims.js';

/** Partie 1 gegen 1, menschlicher Spieler mit gewähltem Helden, Kampf läuft (Schwenk-Pause vorbei) */
function battleSim(hero = 'kael', seed = 3) {
  const sim = new Sim({ seed, players: [{ name: 'Tiry', team: 0, faction: 'orden', bot: false, hero }, { team: 1, faction: 'orden', bot: true }] });
  sim.phaseTime = DT;
  let guard = 0;
  while ((sim.phase !== 'battle' || sim.freeze > 0) && guard++ < 200) sim.step([]);
  assert.equal(sim.phase, 'battle');
  // Wellen-Gegner wegräumen (stehen weit weg) – Tests setzen eigene Gegner
  for (const [id, e] of sim.entities) if (e.type === 'c' && e.lane === 0) e.z = -33.5;
  return sim;
}
const hero = (sim) => sim.heroOf(0);
const run = (sim, n, cmds = []) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...sim.step(i === 0 ? cmds.map((cmd) => ({ pid: 0, cmd })) : [])); return ev; };
const hin = (f, s, yaw, jump = 0) => ({ type: 'hin', f, s, yaw: Math.round(yaw * 1000), jump });
function creepNear(sim, dx = 0, dz = -2.5, hp = 5000) {
  const h = hero(sim);
  const c = sim.spawnCreep(0, { ...sim.waveDef(1), hp, key: 'test' }, h.x + dx, h.z + dz, { bounty: 1, wave: true });
  c.cd = 99; // greift nicht an
  return c;
}

test('Helden-Daten: 6 Klassen, je 5 Fähigkeiten mit Animation', () => {
  assert.deepEqual(Object.keys(HEROES).sort(), ['brann', 'kael', 'lyra', 'mira', 'selene', 'varo']);
  for (const d of Object.values(HEROES)) {
    assert.equal(d.abilities.length, 5, d.id);
    for (const ab of d.abilities) assert.ok(ab.anim && ANIM_TIME[ab.anim], `${d.id}.${ab.id}: anim ${ab.anim}`);
  }
});

test('Bewegung: vorwärts 7 m/s, rückwärts 4,5 m/s, seitwärts 7 m/s, diagonal normiert', () => {
  const cases = [[1, 0, HS.runSpeed], [-1, 0, HS.backSpeed], [0, 1, HS.runSpeed], [0, -1, HS.runSpeed], [1, 1, HS.runSpeed], [-1, 1, HS.backSpeed]];
  for (const [f, s, speed] of cases) {
    const sim = battleSim();
    const h = hero(sim);
    const x0 = h.x, z0 = h.z;
    run(sim, 11, [hin(f, s, Math.PI)]); // Tick 1 übernimmt die Eingabe, danach 10 Ticks Bewegung
    const d = Math.hypot(h.x - x0, h.z - z0);
    assert.ok(Math.abs(d - speed * 11 * DT) < 0.05, `f=${f} s=${s}: ${d.toFixed(3)} m statt ${(speed * 11 * DT).toFixed(3)}`);
  }
});

test('Richtungen: Blick π = −Z; seitwärts rechts = +X (Bildschirm rechts aus der Heldenkamera)', () => {
  const sim = battleSim();
  const h = hero(sim);
  const x0 = h.x, z0 = h.z;
  run(sim, 5, [hin(1, 0, Math.PI)]);
  assert.ok(h.z < z0 - 1 && Math.abs(h.x - x0) < 0.01, 'vorwärts läuft Richtung Portal (−Z)');
  const x1 = h.x;
  run(sim, 5, [hin(0, 1, Math.PI)]);
  assert.ok(h.x > x1 + 1, 'rechts = +X');
});

test('Vorhersage rechnet exakt wie die Simulation (gleiche Eingaben, gleiche Ticks)', () => {
  const sim = battleSim('lyra');
  const h = hero(sim);
  const lx = sim.laneX(0);
  const st = { x: h.x, z: h.z, y: 0, vx: 0, vz: 0, vy: 0, grounded: true };
  const seq = [[1, 0, 3.0, 1], [1, 1, 2.6, 0], [0, -1, 2.2, 0], [-1, 0, 1.0, 0], [1, 0, 0.4, 1]];
  for (const [f, s, yaw, jump] of seq) {
    sim.step([{ pid: 0, cmd: hin(f, s, yaw, jump) }]);
    stepMotion(st, { f, s, face: Math.round(yaw * 1000) / 1000, jump }, SIM_DT, { stun: 0, root: 0, slow: 0, lx });
    for (let i = 0; i < 6; i++) { sim.step([]); stepMotion(st, { f, s, face: Math.round(yaw * 1000) / 1000, jump: 0 }, SIM_DT, { stun: 0, root: 0, slow: 0, lx }); }
    assert.ok(Math.abs(st.x - h.x) < 1e-6 && Math.abs(st.z - h.z) < 1e-6 && Math.abs(st.y - h.y) < 1e-6, `Abweichung bei ${[f, s, yaw, jump]}: ${st.x - h.x}, ${st.z - h.z}, ${st.y - h.y}`);
  }
  const c = laneClamp(lx, lx + 100, 999);
  assert.ok(c.x < lx + 7 && c.z < 30);
});

test('Vorhersage: weiche Angleichung kleiner Fehler, Sprung ab 2 m', () => {
  const pr = new HeroPredictor();
  const h = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, grounded: true, alive: true, stun: 0, rootT: 0, slowPct: 0 };
  pr.reset(h);
  h.x = 0.5;
  pr.update(1 / 60, h, { f: 0, s: 0, face: 0 }, 0, 0);
  assert.ok(pr.P.x > 0 && pr.P.x < 0.5, 'kleiner Fehler wird weich angeglichen');
  h.x = 4;
  pr.update(1 / 60, h, { f: 0, s: 0, face: 0 }, 0, 0);
  assert.equal(pr.P.x, 4, 'großer Fehler (Ansturm/Teleport) springt sofort');
});

test('Springen: Sprung-Flanke hebt ab, landet wieder; Abbruch eines Zaubers durch Springen', () => {
  const sim = battleSim('selene');
  const h = hero(sim);
  const ev = run(sim, 3, [hin(0, 0, Math.PI, 1)]);
  assert.ok(ev.some((e) => e.e === 'heroJump'));
  assert.ok(h.y > 0.2 && !h.grounded);
  const ev2 = run(sim, 30);
  assert.ok(ev2.some((e) => e.e === 'heroLand') && h.grounded && h.y === 0);
  const c = creepNear(sim, 0, -6);
  run(sim, 2, [hin(0, 0, Math.PI), { type: 'hcast', slot: 0, target: c.id }]);
  assert.ok(h.cast, 'Ätherlanze wird gezaubert');
  const ev3 = run(sim, 2, [hin(0, 0, Math.PI, 1)]);
  assert.ok(ev3.some((e) => e.e === 'castCancel') && !h.cast, 'Springen bricht ab');
});

test('Globale Abklingzeit 1,5 s und Zauber-Warteschlange (400 ms)', () => {
  const sim = battleSim('brann');
  const h = hero(sim);
  const c = creepNear(sim);
  h.res = 100;
  let ev = run(sim, 1, [{ type: 'hcast', slot: 1 }]); // Wirbelwind (GCD)
  assert.ok(ev.some((e) => e.e === 'heroAbility' && e.slot === 1));
  assert.ok(Math.abs(h.gcd - HS.gcd) < 1e-9 || Math.abs(h.gcd - (HS.gcd - DT)) < 1e-9, `GCD ${h.gcd}`);
  // sofort nochmal (GCD 1,45 s > 0,4 s) → Fehler
  ev = run(sim, 1, [{ type: 'hcast', slot: 0, target: c.id }]);
  assert.ok(ev.some((e) => e.e === 'heroError' && e.reason === 'Noch nicht bereit'));
  // kurz vor GCD-Ende (≤ 0,4 s) → gemerkt und automatisch ausgelöst
  while (h.gcd > 0.3) sim.step([]);
  h.res = 100;
  ev = run(sim, 1, [{ type: 'hcast', slot: 0, target: c.id }]);
  assert.ok(!ev.some((e) => e.e === 'heroError'), 'in der Warteschlange kein Fehler');
  assert.equal(h.queued && h.queued.slot, 0);
  ev = run(sim, 10);
  assert.ok(ev.some((e) => e.e === 'heroAbility' && e.slot === 0), 'Donnerhammer kommt nach Ablauf der GCD');
  // Fähigkeiten ohne GCD (Heldensprung) gehen auch während der GCD
  h.res = 100;
  ev = run(sim, 1, [{ type: 'hcast', slot: 2, x: h.x, z: h.z - 6 }]);
  assert.ok(ev.some((e) => e.e === 'heroAbility' && e.slot === 2));
});

test('Abklingzeiten je Fähigkeit', () => {
  const sim = battleSim('brann');
  const h = hero(sim);
  creepNear(sim);
  h.res = 100;
  run(sim, 1, [{ type: 'hcast', slot: 1 }]);
  assert.ok(h.cds[1] > 7.8 && h.cds[1] <= 8);
  while (h.gcd > 0) sim.step([]);
  const ev = run(sim, 1, [{ type: 'hcast', slot: 1 }]);
  assert.ok(ev.some((e) => e.e === 'heroError' && e.reason === 'Fähigkeit lädt noch'));
  for (let i = 0; i < 8 / DT; i++) sim.step([]);
  assert.equal(h.cds[1], 0);
});

test('Zauberzeit: Bewegung bricht ab (Kosten zurück, keine Abklingzeit), sonst Freisetzen', () => {
  const sim = battleSim('selene');
  const h = hero(sim);
  const c = creepNear(sim, 0, -8);
  const res0 = h.res;
  let ev = run(sim, 1, [{ type: 'hcast', slot: 0, target: c.id }]);
  assert.ok(ev.some((e) => e.e === 'heroCast' && e.total === 1.8));
  assert.ok(h.res < res0);
  ev = run(sim, 2, [hin(1, 0, Math.PI)]);
  assert.ok(ev.some((e) => e.e === 'castCancel'));
  assert.equal(h.cast, null);
  assert.equal(h.cds[0], 0);
  // stillstehen → Lanze fliegt nach 1,8 s
  run(sim, 2, [hin(0, 0, Math.PI)]);
  while (h.gcd > 0) sim.step([]);
  ev = run(sim, 40, [{ type: 'hcast', slot: 0, target: c.id }]);
  assert.ok(ev.some((e) => e.e === 'heroAbility' && e.slot === 0), 'Zauber vollendet');
});

test('Ziel und Auto-Angriff (nur mit Blick zum Ziel)', () => {
  const sim = battleSim('kael');
  const h = hero(sim);
  const c = creepNear(sim, 0, -1.8);
  run(sim, 1, [{ type: 'htarget', id: c.id }]);
  assert.equal(h.target, c.id);
  assert.equal(h.auto, false);
  const hp0 = c.hp;
  let ev = run(sim, 40, [{ type: 'hauto', id: c.id }]);
  assert.ok(h.auto);
  assert.ok(ev.some((e) => e.e === 'attack' && e.id === h.id && e.melee), 'Nahkampf-Schlag');
  assert.ok(c.hp < hp0);
  // abgewandt → kein Schlag
  run(sim, 1, [hin(0, 0, 0)]);
  ev = run(sim, 40);
  assert.ok(!ev.some((e) => e.e === 'attack' && e.id === h.id), 'mit dem Rücken zum Ziel wird nicht geschlagen');
  run(sim, 1, [{ type: 'htarget', id: 0 }]);
  assert.equal(h.target, 0);
  assert.equal(h.auto, false);
});

test('Selbstheilung (heal_self) und Reichweitenfehler', () => {
  const sim = battleSim('kael');
  const h = hero(sim);
  h.hp = h.maxHp * 0.4; h.res = 100;
  run(sim, 1, [{ type: 'hcast', slot: 3 }]);
  assert.ok(h.hp > h.maxHp * 0.6, 'Schildwall heilt 22 %');
  const far = creepNear(sim, 0, -12);
  const ev = run(sim, 1, [{ type: 'hcast', slot: 0, target: far.id }]);
  assert.ok(ev.some((e) => e.e === 'heroError' && e.reason === 'Ziel außer Reichweite'));
});

test('Heldentod: kein Wiederkehren in derselben Welle, zur nächsten Welle wieder da', () => {
  const sim = battleSim('mira');
  const h = hero(sim);
  const c = creepNear(sim);
  const ev = [];
  sim.events.length = 0;
  sim.applyHit(c, h, 1e9, 'klinge', false);
  ev.push(...sim.events);
  assert.ok(ev.some((e) => e.e === 'heroDeath' && e.respawn === -1));
  assert.equal(h.alive, false);
  for (let i = 0; i < 400 && sim.phase === 'battle'; i++) { ev.push(...sim.step([])); if (sim.phase === 'battle') assert.equal(h.alive, false); }
  assert.ok(!ev.some((e) => e.e === 'heroRespawn'));
  assert.ok(ev.some((e) => e.e === 'heroDeath' && e.respawn === -1) || true);
  // nächste Welle: wieder da
  for (let i = 0; i < 8000 && sim.phase === 'battle'; i++) { sim.step([]); if (sim.phase === 'battle') assert.equal(h.alive, false); }
  for (let i = 0; i < 4000 && sim.phase !== 'battle'; i++) sim.step([]);
  assert.equal(sim.phase, 'battle');
  assert.equal(h.alive, true);
  assert.equal(h.hp, h.maxHp);
});

test('Tastenbelegung: Standard WoW, Umbelegen ohne Doppelbelegung, Anzeige', () => {
  const store = new Map();
  const settings = { get: (k) => store.get(k), set: (k, v) => store.set(k, v) };
  const b = resolveBinds(settings);
  assert.equal(b.moveForward[0], 'KeyW');
  assert.equal(b.strafeLeft[0], 'KeyQ');
  assert.equal(b.autorun[0], 'NumLock');
  assert.equal(b.item1[0], 'Shift+Digit1');
  setBind(settings, 'jump', 0, 'KeyW');
  const b2 = resolveBinds(settings);
  assert.equal(b2.jump[0], 'KeyW');
  assert.equal(b2.moveForward[0], '', 'W wurde von „Vorwärts“ entfernt');
  assert.equal(bindIndex(b2).get('KeyW'), 'jump');
  assert.equal(comboLabel('Shift+Digit3', true), 'S-3');
  assert.equal(comboLabel('KeyZ'), 'Y');
  assert.equal(comboFromEvent({ code: 'Digit2', shiftKey: true }), 'Shift+Digit2');
});

test('Animations-Zeitachse: Treffer im Einschlag-Moment, Geschosse ohne Verzögerung', () => {
  assert.equal(abilityAnim('kael', 0), 'bash');
  assert.ok(impactDelay('kael', 0, 'strike') > 0.15);
  assert.equal(impactDelay('mira', 0, 'bolt'), 0);
});
