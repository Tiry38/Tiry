'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PALETTES, contrast, resolvePalette, paletteFromSuggestion, cssTokens, STYLES } = require('../src/core/design');
const { TEMPLATES, buildOfflineApp } = require('../src/core/offline');
const { staticChecks, evaluate, totalScore } = require('../src/core/quality');
const { Library, slugify } = require('../src/core/library');
const { Lessons } = require('../src/core/lessons');
const { encode, decode, encodeFields, decodeFields } = require('../src/core/firestore');
const { parseFeed, aggregate, biasSeed, BASELINE } = require('../src/core/trends');
const { createRng } = require('../src/core/ideas');
const { buildFiles } = require('../src/core/pwa');
const { extractHtml } = require('../src/core/html');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'forge-core-'));

test('Design: alle Paletten haben lesbaren Text und Button-Kontrast', () => {
  for (const p of PALETTES) {
    const r = resolvePalette(p);
    for (const bg of r.bg) assert.ok(contrast(bg, r.text) >= 7, `${p.id}: Text auf ${bg}`);
    for (const ac of r.accent) assert.ok(contrast(ac, r.onAccent) >= 3, `${p.id}: Button-Text auf ${ac}`);
  }
});

test('Design: KI-Farbvorschlag mit schlechtem Kontrast wird abgelehnt', () => {
  const bad = paletteFromSuggestion({ mode: 'dark', background: ['#777777', '#787878', '#797979'], accent: ['#7a7a7a', '#7b7b7b'] }, PALETTES[0]);
  assert.equal(bad.id, PALETTES[0].id);
  const tokens = cssTokens(PALETTES[0], STYLES[0]);
  assert.match(tokens, /--grad-flow/);
});

test('Offline-Vorlagen: jede Vorlage besteht die statische Prüfung ohne Fehler und Warnungen', () => {
  for (const t of TEMPLATES) {
    for (const seed of [1, 777, 4242]) {
      const app = buildOfflineApp({ seed, appId: 'test-app', templateId: t.id });
      const r = staticChecks(app.html);
      assert.deepEqual(r.errors, [], `${t.id}/${seed}: ${r.errors.join(' | ')}`);
      assert.deepEqual(r.warnings, [], `${t.id}/${seed}: ${r.warnings.join(' | ')}`);
      assert.match(app.html, /gradient\(/);
      assert.ok(app.concept.store_short_description && app.concept.store_full_description, `${t.id}: Store-Texte`);
    }
  }
});

test('Qualität: Laufzeitfehler blockieren, Score kombiniert Technik und Jury', () => {
  const html = buildOfflineApp({ seed: 5, appId: 'q-app' }).html;
  const monkey = { caught: [], interactive: 8, canvas: 0, textLength: 300, usesGradient: true, fontSizeMin: 12, tinyTapTargets: 0, offscreenInteractive: 0 };
  assert.equal(evaluate(html, { monkey }).ok, true);
  const broken = evaluate(html, { monkey, pageErrors: ['TypeError: x is null'] });
  assert.equal(broken.ok, false);
  assert.ok(broken.tech < 100);
  assert.equal(totalScore(100, null), 100);
  assert.equal(totalScore(100, { design: 9, ux: 9, sense: 9, polish: 9 }), 94);
});

test('Bibliothek: Versionen, Verwerfen und Rollback', () => {
  const lib = new Library(tmp());
  const id = lib.newId('Mein Test');
  assert.match(id, /^mein-test/);
  const s1 = lib.stage(id);
  lib.writeFiles(s1, { 'index.html': '<!DOCTYPE html>v1' });
  lib.createApp({ id, name: 'Mein Test' }, s1, { score: 80 });
  const s2 = lib.stage(id);
  lib.writeFiles(s2, { 'index.html': '<!DOCTYPE html>v2' });
  lib.commit(id, s2, { kind: 'evolve', title: 'Besser', score: 88 });
  assert.equal(lib.readMeta(id).currentVersion, 2);
  assert.equal(lib.readCurrentHtml(id), '<!DOCTYPE html>v2');
  lib.reject(id, { title: 'Schlechter Versuch', reason: 'Score würde sinken' });
  assert.equal(lib.readMeta(id).rejected.length, 1);
  lib.rollback(id, 1);
  assert.equal(lib.readCurrentHtml(id), '<!DOCTYPE html>v1');
  assert.equal(lib.readMeta(id).score, 80);
  assert.equal(lib.list().length, 1);
  assert.equal(slugify('Äpfel & Öl!'), 'aepfel-oel');
});

test('Lernspeicher: ähnliche Regeln werden zusammengeführt', () => {
  const l = new Lessons(path.join(tmp(), 'lessons.json'));
  l.add(['Vor classList-Zugriffen immer prüfen, ob das Element existiert.']);
  l.add(['Vor classList-Zugriffen immer prüfen, ob das Element noch existiert.']);
  l.add(['Canvas bei visibilitychange pausieren.']);
  assert.equal(l.list().length, 2);
  assert.equal(l.top(1).length, 1);
});

test('Firestore: Werte überleben Kodieren und Dekodieren', () => {
  const v = { name: 'Nova', score: 94, ratio: 0.5, ok: true, tags: ['a', 'b'], nested: { x: null } };
  assert.deepEqual(decodeFields(encodeFields(v)), v);
  assert.equal(decode(encode('x')), 'x');
});

test('Trends: Feeds parsen, Kategorien gewichten, Ideen gezielt lenken', () => {
  const legacy = { feed: { entry: [{ 'im:name': { label: 'A' }, category: { attributes: { label: 'Health & Fitness' } } }, { 'im:name': { label: 'B' }, category: { attributes: { label: 'Games' } } }] } };
  const list = parseFeed('legacy', legacy);
  assert.deepEqual(list.map((e) => e.name), ['A', 'B']);
  const agg = aggregate(list.map((e, i) => ({ ...e, chart: 'grossing', rank: i + 1 })));
  assert.ok(agg.length >= 1);
  assert.ok(Math.abs(agg.reduce((s, x) => s + x.share, 0) - 100) < 1);
  const seed = { type: 'game', category: 'X' };
  assert.equal(biasSeed(seed, BASELINE, createRng(1), 0).opportunity, null);
  const forced = biasSeed(seed, BASELINE, createRng(1), 1);
  assert.ok(forced.opportunity);
  assert.equal(forced.seed.category, forced.opportunity.category);
});

test('PWA: Paket enthält Manifest, Service-Worker und Icon', () => {
  const html = buildOfflineApp({ seed: 9, appId: 'pwa-app' }).html;
  const files = buildFiles({ appId: 'pwa-app', version: 3, html, name: 'PWA', glyph: 'P', description: 'Test', palette: PALETTES[0], lang: 'de' });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg']) assert.ok(files[f], f);
  assert.equal(JSON.parse(files['manifest.webmanifest']).name, 'PWA');
  assert.match(files['sw.js'], /pwa-app/);
});

test('HTML-Extraktion: holt das Dokument aus KI-Antworten mit Code-Block', () => {
  const doc = '<!DOCTYPE html><html><body>x</body></html>';
  assert.equal(extractHtml('Hier ist die App:\n```html\n' + doc + '\n```'), doc);
  assert.equal(extractHtml('kein html'), null);
});
