'use strict';
/** Gratis-Modus: Import extern gebauter Apps, KI-Modus-Schalter, Cloud-Apps holen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Forge, validateConcept } = require('../src/core/forge');
const { Library } = require('../src/core/library');
const { buildOfflineApp } = require('../src/core/offline');
const offline = require('../src/core/offline');
const { createHub } = require('../src/hub');
const { registerAll } = require('../src/connectors');
const { pullLibrary } = require('../src/connectors/network');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'forge-gratis-'));
const tpl = buildOfflineApp({ seed: 21, appId: 'x', templateId: 'water' });
const CONCEPT = { ...tpl.concept, name: 'Quellklar', palette: 'aurora', sense_check: { usefulness: 8, clarity: 9, originality: 7, feasibility: 9, market_fit: 8, verdict: 'gut' } };

function forgeWith(lib, { failing = false } = {}) {
  const tester = {
    async run(dir) {
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const monkey = { caught: [], interactive: 8, canvas: 0, textLength: 300, usesGradient: true, fontSizeMin: 12, tinyTapTargets: 0, offscreenInteractive: 0 };
      return { monkey, pageErrors: failing || html.includes('BUG') ? ['TypeError: kaputt'] : [], consoleErrors: [], screenshot: Buffer.from('png') };
    }
  };
  return new Forge({ ai: null, tester, library: lib, lessons: null, offline, waterfall: async (_n, v) => v, emit: () => {}, settings: { get: (_k, d) => d }, trends: null });
}

test('Gratis-Import: fehlerfreie App mit Jury-Bewertung wird v1', async () => {
  const lib = new Library(tmp());
  const meta = await forgeWith(lib).importApp({ html: tpl.html, concept: CONCEPT, review: { design: 9, ux: 9, sense: 9, polish: 9 } });
  assert.equal(meta.source, 'abo');
  assert.equal(meta.score, 94);
  assert.equal(lib.list().length, 1);
});

test('Gratis-Import: kaputte App, schwaches Design oder schwacher Sinn-Check werden abgelehnt', async () => {
  const lib = new Library(tmp());
  await assert.rejects(forgeWith(lib).importApp({ html: tpl.html.replace('</body>', '<!--BUG--></body>'), concept: CONCEPT }), /Test nicht bestanden/);
  await assert.rejects(forgeWith(lib).importApp({ html: tpl.html, concept: CONCEPT, review: { design: 6, ux: 9, sense: 9, polish: 9 } }), /Design-Gate/);
  assert.throws(() => validateConcept({ ...CONCEPT, sense_check: { ...CONCEPT.sense_check, originality: 5 } }), /Sinn-Check/);
  assert.throws(() => validateConcept({ ...CONCEPT, store_full_description: '' }), /unvollständig/);
  assert.equal(lib.list().length, 0, 'nichts Halbfertiges bleibt liegen');
});

test('Gratis-Weiterentwicklung: schlechter → verworfen, gleich gut → v2', async () => {
  const lib = new Library(tmp());
  const forge = forgeWith(lib);
  const meta = await forge.importApp({ html: tpl.html, concept: CONCEPT, review: { design: 9, ux: 9, sense: 9, polish: 9 } });
  const bad = await forge.importVersion(meta.id, { html: tpl.html, title: 'Schlechter', review: { design: 5, ux: 6, sense: 6, polish: 5 } });
  assert.equal(bad.changed, false);
  const good = await forge.importVersion(meta.id, { html: tpl.html, title: 'Wochenziel', review: { design: 9, ux: 9, sense: 9, polish: 9 } });
  assert.equal(good.changed, true);
  assert.equal(lib.readMeta(meta.id).currentVersion, 2);
  assert.equal(lib.readMeta(meta.id).rejected.length, 1);
});

test('KI-Modus: Standard ist gratis – gespeicherter Key bleibt unbenutzt bis zur Umstellung', async () => {
  const hub = createHub({ dataDir: tmp(), env: { cloud: true } });
  registerAll(hub);
  await hub.plugins.startAll();
  await hub.plugins.configure('ai.anthropic', { apiKey: 'sk-ant-test-key' });
  let st = await hub.actions.invoke('forge.status');
  assert.equal(st.aiMode, 'free');
  assert.equal(st.aiAvailable, false);
  await hub.plugins.configure('ai.anthropic', { mode: 'api' });
  st = await hub.actions.invoke('forge.status');
  assert.equal(st.aiMode, 'api');
  assert.equal(st.aiAvailable, true);
  await hub.plugins.configure('ai.anthropic', { mode: 'free' });
  assert.equal((await hub.actions.invoke('forge.status')).aiAvailable, false);
  await hub.plugins.stopAll();
});

test('Cloud-Apps holen: neue Apps landen lokal, aktuelle werden übersprungen', async () => {
  const remoteRoot = tmp();
  const remote = new Library(remoteRoot);
  const id = remote.newId('Wolke');
  const st = remote.stage(id);
  remote.writeFiles(st, { 'index.html': '<!DOCTYPE html>wolke', 'icon.svg': '<svg/>' });
  remote.createApp({ id, name: 'Wolke' }, st, { score: 90 });
  const files = [];
  (function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p, rel + f + '/');
      else files.push(rel + f);
    }
  })(remoteRoot, 'apps/');
  const fetchImpl = async (url) => {
    if (url.includes('/git/trees/')) return new Response(JSON.stringify({ tree: files.map((p) => ({ path: p, type: 'blob' })) }), { status: 200 });
    const rel = decodeURIComponent(url.split('/forge-library/')[1]).replace(/^apps\//, '');
    const f = path.join(remoteRoot, rel);
    return fs.existsSync(f) ? new Response(fs.readFileSync(f), { status: 200 }) : new Response('nope', { status: 404 });
  };
  const local = new Library(tmp());
  const r1 = await pullLibrary({ repo: 'a/b', lib: local, fetchImpl });
  assert.equal(r1.imported, 1);
  assert.equal(local.readCurrentHtml(id), '<!DOCTYPE html>wolke');
  const r2 = await pullLibrary({ repo: 'a/b', lib: local, fetchImpl });
  assert.equal(r2.imported, 0);
  assert.equal(r2.skipped, 1);
  const empty = await pullLibrary({ repo: 'a/b', lib: local, fetchImpl: async () => new Response('', { status: 404 }) });
  assert.match(empty.message, /leer|nicht gefunden/);
});
