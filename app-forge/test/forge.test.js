'use strict';
/**
 * Pipeline-Tests mit simulierter KI und simuliertem Test-Labor:
 * Fix-Schleife, Lernspeicher, Design-Gate und automatisches Verwerfen schlechterer Versionen.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Forge } = require('../src/core/forge');
const { Library } = require('../src/core/library');
const { Lessons } = require('../src/core/lessons');
const { buildOfflineApp } = require('../src/core/offline');
const offline = require('../src/core/offline');

const GOOD_HTML = buildOfflineApp({ seed: 11, appId: 'mock', templateId: 'habit' }).html;
const BUGGY_HTML = GOOD_HTML.replace('</body>', '<!-- BUG_MARKER --></body>');

function mockTester() {
  return {
    runs: 0,
    async run(dir) {
      this.runs++;
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const monkey = { caught: [], interactive: 9, canvas: 0, textLength: 400, usesGradient: true, fontSizeMin: 12, tinyTapTargets: 0, offscreenInteractive: 0 };
      return { monkey, consoleErrors: [], pageErrors: html.includes('BUG_MARKER') ? ['TypeError: Cannot read properties of null'] : [], screenshot: Buffer.from('png'), durationMs: 5 };
    }
  };
}

function mockAi({ review = { design: 9, ux: 9, sense: 9, polish: 9 }, evolveReview } = {}) {
  const calls = [];
  return {
    calls,
    isAvailable: () => true,
    budgetLeft: () => ({ calls: 50, usd: 5 }),
    async json({ purpose }) {
      calls.push(purpose);
      if (purpose === 'concept') {
        return {
          name: 'Fokus Fluss', tagline: 'Tiefe Arbeit in ruhigen Wellen.', type: 'tool', category: 'Produktivität & Fokus', icon_glyph: 'F',
          target_audience: 'Studierende', problem_or_fun: 'Ablenkung', core_loop: 'Starten → fokussieren → belohnen', retention_hook: 'Serien', monetization: 'Pro-Abo',
          features: ['Timer', 'Serien'], store_short_description: 'Fokus ohne Stress.', store_full_description: 'Lange Beschreibung.', keywords: ['fokus'],
          design: { mode: 'dark', background: ['#0b1020', '#121a33', '#1a2347'], accent: ['#8b5cf6', '#ec4899'] },
          sense_check: { usefulness: 9, clarity: 9, originality: 8, feasibility: 9, market_fit: 8, verdict: 'stark' }
        };
      }
      if (purpose === 'review') return { ...(calls.filter((c) => c === 'plan').length && evolveReview ? evolveReview : review), summary: 'ok', bugs: [], improvements: [] };
      if (purpose === 'lessons') return { lessons: ['Vor DOM-Zugriffen prüfen, ob das Element existiert.'] };
      if (purpose === 'plan') return { title: 'Wochenrückblick', description: 'Neue Statistik', kind: 'feature', acceptance: ['Rückblick zeigt 7 Tage'] };
      throw new Error('unerwartet: ' + purpose);
    },
    async text({ purpose }) {
      calls.push(purpose);
      if (purpose === 'build') return '```html\n' + BUGGY_HTML + '\n```';
      if (purpose === 'fix' || purpose === 'polish' || purpose === 'evolve') return GOOD_HTML;
      throw new Error('unerwartet: ' + purpose);
    }
  };
}

function setup(aiOpts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-pipe-'));
  const events = [];
  const library = new Library(path.join(root, 'apps'));
  const lessons = new Lessons(path.join(root, 'lessons.json'));
  const ai = mockAi(aiOpts);
  const tester = mockTester();
  const forge = new Forge({
    ai, tester, library, lessons, offline,
    waterfall: async (_n, v) => v,
    emit: (type, payload) => events.push({ type, payload }),
    settings: { get: (_k, d) => d },
    trends: { get: () => null, weight: () => 0 }
  });
  return { forge, ai, tester, library, lessons, events };
}

test('KI-Pipeline: Fehler wird gefunden, repariert, gelernt – App landet als v1', async () => {
  const { forge, ai, library, lessons, events } = setup();
  const meta = await forge.create({ preferType: 'tool' });
  assert.equal(meta.name, 'Fokus Fluss');
  assert.equal(meta.source, 'ai');
  assert.deepEqual(ai.calls.slice(0, 3), ['concept', 'build', 'fix']);
  assert.ok(ai.calls.includes('review'));
  assert.ok(!ai.calls.includes('polish'), 'Review 9/10 braucht keinen Feinschliff');
  const stored = library.readMeta(meta.id);
  assert.equal(stored.currentVersion, 1);
  assert.equal(stored.score, 94);
  assert.doesNotMatch(library.readCurrentHtml(meta.id), /BUG_MARKER/);
  assert.equal(lessons.list().length, 1, 'Reparierter Fehler wird als Regel gelernt');
  assert.ok(events.some((e) => e.type === 'app.created'));
  assert.ok(events.some((e) => e.type === 'test.finished' && e.payload.ok === false));
});

test('KI-Pipeline: Design unter 7/10 wird verworfen – keine App bleibt zurück', async () => {
  const { forge, library, events } = setup({ review: { design: 5, ux: 6, sense: 6, polish: 5 } });
  await assert.rejects(forge.create({ preferType: 'tool' }), /Design-Gate/);
  assert.equal(library.list().length, 0);
  assert.ok(events.some((e) => e.type === 'app.version.rejected'));
});

test('Weiterentwicklung: schlechtere Version wird automatisch verworfen', async () => {
  const { forge, library, events } = setup({ evolveReview: { design: 6, ux: 6, sense: 6, polish: 6 } });
  const meta = await forge.create({ preferType: 'tool' });
  const r = await forge.evolve(meta.id);
  assert.equal(r.changed, false);
  const stored = library.readMeta(meta.id);
  assert.equal(stored.currentVersion, 1);
  assert.equal(stored.rejected.length, 1);
  assert.ok(events.some((e) => e.type === 'app.version.rejected' && e.payload.title === 'Wochenrückblick'));
});

test('Weiterentwicklung: gleich gute oder bessere Version wird übernommen (v2)', async () => {
  const { forge, library } = setup();
  const meta = await forge.create({ preferType: 'tool' });
  const r = await forge.evolve(meta.id);
  assert.equal(r.changed, true);
  const stored = library.readMeta(meta.id);
  assert.equal(stored.currentVersion, 2);
  assert.equal(stored.versions[1].title, 'Wochenrückblick');
  assert.equal(stored.evolveCount, 1);
});

test('Offline-Modus: ohne KI entsteht eine fehlerfreie Premium-Vorlage', async () => {
  const { forge, library } = setup();
  forge.d.ai = null;
  const meta = await forge.create({});
  assert.equal(meta.source, 'offline');
  assert.equal(library.readMeta(meta.id).lastTest.ok, true);
});
