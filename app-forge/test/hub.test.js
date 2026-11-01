'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventBus } = require('../src/hub/bus');
const { Hooks, veto } = require('../src/hub/hooks');
const { JobQueue } = require('../src/hub/jobs');
const { Registry } = require('../src/hub/registry');
const { createHub } = require('../src/hub');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'forge-hub-'));

test('EventBus: Muster x.y, x.* und * treffen korrekt', () => {
  const bus = new EventBus();
  const seen = { exact: 0, wild: 0, all: 0 };
  bus.on('app.created', () => seen.exact++);
  bus.on('app.*', () => seen.wild++);
  bus.on('*', () => seen.all++);
  bus.emit('app.created', {});
  bus.emit('app.version.created', {});
  bus.emit('job.done', {});
  assert.equal(seen.exact, 1);
  assert.equal(seen.wild, 2);
  assert.equal(seen.all, 3);
  assert.equal(bus.recent(10).length, 3);
});

test('EventBus: Fehler im Handler legt den Bus nicht lahm', () => {
  const bus = new EventBus();
  const errors = [];
  bus.on('hub.error', (e) => errors.push(e));
  bus.on('x.y', () => { throw new Error('kaputt'); });
  let ok = false;
  bus.on('x.y', () => { ok = true; });
  bus.emit('x.y', {});
  assert.equal(ok, true);
  assert.equal(errors.length, 1);
});

test('Hooks: Wasserfall verändert Werte, veto() bricht ab', async () => {
  const hooks = new Hooks(new EventBus());
  hooks.tap('html.post', (v) => v + '<!-- a -->', { by: 'a' });
  hooks.tap('html.post', (v) => v + '<!-- b -->', { by: 'b', priority: 10 });
  const out = await hooks.waterfall('html.post', 'X');
  assert.match(out, /X/);
  assert.match(out, /a -->/);
  assert.match(out, /b -->/);
  hooks.tap('concept.check', () => { throw veto('Marke geschützt'); }, { by: 'legal' });
  await assert.rejects(hooks.waterfall('concept.check', {}), /Marke geschützt/);
});

test('Registry: höchste Priorität gewinnt, removeBy entfernt Anbieter', () => {
  const reg = new Registry();
  reg.provide('tester', { name: 'cloud' }, { by: 'p1', priority: 1 });
  reg.provide('tester', { name: 'desktop' }, { by: 'p2', priority: 10 });
  assert.equal(reg.get('tester').name, 'desktop');
  reg.removeBy('p2');
  assert.equal(reg.get('tester').name, 'cloud');
  assert.throws(() => reg.require('gibtsnicht'));
});

test('JobQueue: der Reihe nach, Fortschritt, Abbruch', async () => {
  const bus = new EventBus();
  const q = new JobQueue(bus, { concurrency: 1 });
  const order = [];
  const progress = [];
  bus.on('job.progress', (e) => progress.push(e.payload.progress));
  const a = q.add({ type: 't', title: 'A', run: async (job) => { job.progress(50, 'halb'); order.push('A'); return 1; } });
  const b = q.add({ type: 't', title: 'B', run: async (job) => { await new Promise((r) => setTimeout(r, 200)); job.checkCancelled(); order.push('B'); return 2; } });
  const ra = await a.done;
  assert.equal(ra.status, 'done');
  assert.ok(progress.includes(50));
  q.cancel(b.id);
  const rb = await b.done;
  assert.equal(rb.status, 'cancelled');
  assert.deepEqual(order, ['A']);
});

test('Hub: Plugins starten nach Abhängigkeiten, env/available steuern Verfügbarkeit', async () => {
  const hub = createHub({ dataDir: tmp(), env: { cloud: true } });
  const started = [];
  hub.plugins.register({ id: 'b.consumer', name: 'B', kind: 'core', requires: ['thing'], start: (ctx) => { started.push('b'); assert.equal(ctx.require('thing').v, 42); } });
  hub.plugins.register({ id: 'a.provider', name: 'A', kind: 'core', provides: ['thing'], start: (ctx) => { started.push('a'); ctx.provide('thing', { v: 42 }); ctx.action('demo.ping', () => 'pong', { expose: false }); } });
  hub.plugins.register({ id: 'c.desktop', name: 'C', kind: 'system', env: 'electron', start: () => started.push('c') });
  hub.plugins.register({ id: 'd.unsupported', name: 'D', kind: 'system', available: () => false, start: () => started.push('d') });
  hub.plugins.register({ id: 'e.broken', name: 'E', kind: 'system', start: () => { throw new Error('kaputt'); } });
  await hub.plugins.startAll();
  assert.deepEqual(started, ['a', 'b']);
  const st = Object.fromEntries(hub.plugins.list().map((p) => [p.id, p.status]));
  assert.equal(st['c.desktop'], 'unavailable');
  assert.equal(st['d.unsupported'], 'unavailable');
  assert.equal(st['e.broken'], 'error');
  assert.equal(await hub.actions.invoke('demo.ping', {}, { caller: 'ui' }), 'pong');
  await assert.rejects(hub.actions.invoke('demo.ping', {}, { caller: 'api' }));
  await hub.plugins.setEnabled('a.provider', false);
  await assert.rejects(hub.actions.invoke('demo.ping', {}, { caller: 'ui' }));
  await hub.plugins.stopAll();
});

test('Settings: Geheimnisse landen nie im Klartext in der öffentlichen Ansicht', () => {
  const hub = createHub({ dataDir: tmp() });
  hub.settings.setSecret('plugins.ai.apiKey', 'sk-ant-geheim');
  assert.equal(hub.settings.getSecret('plugins.ai.apiKey'), 'sk-ant-geheim');
  assert.doesNotMatch(JSON.stringify(hub.settings.publicView()), /sk-ant-geheim/);
});
