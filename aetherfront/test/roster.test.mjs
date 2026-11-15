// Besetzungsliste der Grafik: jede Linie eines Volks hat einen eigenen Archetyp, alle 240 Vasallenformen und
// alle 30 Wellen sind einer gebackenen Figur zugeordnet, Wellen haben verschiedene Silhouetten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, FACTIONS, WAVES } from '../src/sim/data.js';
import { LINE_ARCH, fighterArch, formOf, creepModel, bakeList, FORMS, ARCH_FIT } from '../src/render/forge/roster.js';
import { ALL_DESIGNS } from '../src/render/forge/designs/units.js';

test('jede Linie eines Volks hat einen eigenen Archetyp', () => {
  for (const fid of Object.keys(FACTIONS)) {
    const archs = Object.values(LINE_ARCH[fid]);
    assert.equal(archs.length, 8, fid);
    assert.equal(new Set(archs).size, 8, `${fid}: doppelte Archetypen`);
  }
});

test('alle 240 Vasallenformen sind abgedeckt und backbar', () => {
  const designs = ALL_DESIGNS();
  const baked = new Set(bakeList().map(([a, f]) => `${a}_${f}`));
  let n = 0;
  for (const u of Object.values(UNITS)) {
    const a = fighterArch(u), f = formOf(u);
    assert.ok(designs[a], `kein Entwurf für ${a} (${u.id})`);
    assert.ok(FORMS.includes(f), u.id);
    assert.ok(baked.has(`${a}_${f}`), `nicht gebacken: ${a}_${f}`);
    assert.ok(ARCH_FIT[a], `keine Passform für ${a}`);
    n++;
  }
  assert.equal(n, 240);
});

test('jede Welle hat eine eigene Silhouette (Archetyp + Form)', () => {
  const seen = new Set();
  for (const w of WAVES) {
    const m = creepModel({ ...w, key: `w${w.n}` });
    const id = `${m.arch}_${m.form}`;
    assert.ok(!seen.has(id), `Welle ${w.n} doppelt: ${id}`);
    seen.add(id);
    if (w.boss) assert.match(m.arch, /^boss_/);
  }
  assert.equal(seen.size, 30);
});
