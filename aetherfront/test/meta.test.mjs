import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile, weeklyModifier, ACHIEVEMENTS, SKINS } from '../src/meta/profile.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('Meta: jede Partie gibt Erfahrung (auch Niederlagen), Stufen, Meisterschaft, Erfolge, Herausforderungen', () => {
  const st = mem();
  const p = new Profile(st);
  const lose = p.record({ win: false, wave: 8, faction: 'orden', pickMode: 'ap', mode: 'skirmish' });
  assert.ok(lose.xp > 0, 'Niederlage gibt Fortschritt');
  let r;
  for (let i = 0; i < 6; i++) r = p.record({ win: true, wave: 30, leaks: 0, sent: 30, income: 320, faction: 'orden', pickMode: ['ap', 'ar', 'pr', 'hp'][i % 4], mode: 'skirmish', leaders: 10, quickLeaders: 3, kills: 500, upgrades: 25, tier3: 10, cleanWaves: 12 });
  assert.ok(p.d.level > 1);
  assert.ok(p.mastery('orden').level >= 3, 'Völker-Meisterschaft');
  assert.ok(p.unlockedSkins('orden').length >= 1);
  for (const id of ['first_win', 'no_leak', 'wave30', 'sender', 'income300', 'master_t3', 'all_modes', 'leader10']) assert.ok(p.d.achievements[id], id);
  assert.ok(!JSON.stringify(p.d).includes('hero'), 'keine Helden-Daten im Profil');
  assert.ok(p.d.daily.list.every((c) => c.done));
  // gespeichert und wieder geladen
  const p2 = new Profile(st);
  assert.equal(p2.d.level, p.d.level);
  assert.equal(Object.keys(SKINS).length, 6);
  assert.ok(ACHIEVEMENTS.length >= 10);
  assert.ok(weeklyModifier(new Date('2026-11-14')).rules);
});
