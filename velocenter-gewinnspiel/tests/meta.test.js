/* Tests des Facebook-Abrufs mit nachgebauter Graph API – node tests/meta.test.js */
'use strict';
const assert = require('assert');
const E = require('../engine.js');
const M = require('../meta.js');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FEHLER  ' + name + '\n        ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n        ') : e)); }
}
const TOKEN = 'EAAGEHEIM123';
const PAGE = '220020558190688';

function fakeFetch(routes, calls) {
  return async (url) => {
    calls && calls.push(url);
    const u = new URL(url);
    assert.strictEqual(u.searchParams.get('access_token'), TOKEN);
    const path = u.pathname.replace(/^\/v[\d.]+\//, '');
    const key = path + (u.searchParams.get('after') ? '#' + u.searchParams.get('after') : '');
    const body = typeof routes[key] === 'function' ? routes[key](u) : routes[key];
    if (!body) return { ok: false, status: 404, json: async () => ({ error: { code: 100, message: 'Unknown path ' + key } }) };
    return { ok: !body.error, status: body.error ? 400 : 200, json: async () => body };
  };
}
const next = (path, after) => 'https://graph.facebook.com/v23.0/' + path + '?access_token=' + TOKEN + '&after=' + after;

function routes() {
  const t = (day, time) => E.berlinToUtcIso(E.dayDate(E.defaultSettings(), day), time).replace('.000Z', '+0000');
  return {
    [PAGE + '/posts']: { data: [
      { id: 'P1', message: 'Türchen 1/30 – Hör-Rätsel', created_time: t(1, '07:00'), permalink_url: 'https://fb/P1' },
      { id: 'X', message: 'Neue Räder im Laden', created_time: '2026-11-15T09:00:00+0000' },
    ], paging: { next: next(PAGE + '/posts', 'A') } },
    [PAGE + '/posts#A']: { data: [{ id: 'P2', message: 'Türchen 2/30', created_time: t(2, '07:00') }] },
    'P1/comments': { data: [
      { id: 'c1', message: 'Tretlager', created_time: t(1, '09:00'), from: { id: 'u1', name: 'Anna' } },
      { id: 'c2', message: 'Kette', created_time: t(1, '10:00'), from: { id: 'u2', name: 'Ben' } },
    ], paging: { next: next('P1/comments', 'B') } },
    'P1/comments#B': { data: [{ id: 'c3', message: 'spät', created_time: t(2, '00:30'), from: { id: 'u3', name: 'Cleo' } }] },
    'P2/comments': { data: [{ id: 'c4', message: 'x', created_time: t(2, '12:00'), from: { id: 'u1', name: 'Anna' } }] },
    'P1/reactions': { data: [{ id: 'u1', name: 'Anna', type: 'LIKE' }, { id: 'u9', name: 'Zoe', type: 'LOVE' }] },
    'P2/reactions': { data: [] },
  };
}

(async () => {
  console.log('Facebook-Abruf');

  await test('Beiträge, Kommentare, Likes inkl. Paging; fremde Beiträge ignoriert', async () => {
    const calls = [];
    const data = await M.fetchAll({ settings: E.defaultSettings(), engine: E, token: TOKEN, fetch: fakeFetch(routes(), calls) });
    assert.deepStrictEqual(data.posts.map((p) => p.id), ['P1', 'P2']);
    assert.strictEqual(data.comments.length, 4);
    assert.strictEqual(data.reactions.length, 2);
    assert.deepStrictEqual(data.warnings, []);
    const first = new URL(calls[0]);
    assert.strictEqual(first.pathname, '/v23.0/' + PAGE + '/posts');
    assert.ok(first.searchParams.get('since') && first.searchParams.get('until'));
    const cm = new URL(calls.find((c) => c.includes('P1/comments')));
    assert.strictEqual(cm.searchParams.get('filter'), 'toplevel');
    assert.strictEqual(cm.searchParams.get('fields'), 'id,message,created_time,from{id,name}');
    // in die Auswertung übernehmen
    const st = E.emptyState(); st.settings.asOf = '2026-11-24';
    E.mergeMeta(st, data);
    const r = E.compute(st);
    assert.strictEqual(r.byId.get('u1').fulfilled, 2);
    assert.strictEqual(r.byId.get('u1').likes, 1);
    assert.strictEqual(r.byId.get('u3').lateCount, 1);
  });

  await test('Fehlendes from: Hinweis auf fehlende Rechte, Kommentare anonym', async () => {
    const rt = routes();
    rt['P1/comments'] = { data: [{ id: 'c1', message: 'a', created_time: '2026-11-22T08:00:00+0000' }] };
    delete rt['P1/comments#B'];
    rt['P2/comments'] = { data: [{ id: 'c2', message: 'b', created_time: '2026-11-23T08:00:00+0000' }] };
    const data = await M.fetchAll({ settings: E.defaultSettings(), engine: E, token: TOKEN, fetch: fakeFetch(rt) });
    assert.ok(data.warnings[0].includes('pages_read_user_content'));
    assert.strictEqual(data.comments.filter((c) => c.userId === null).length, 2);
    const st = E.emptyState(); E.mergeMeta(st, data);
    assert.strictEqual(E.compute(st).persons.length, 0);
  });

  for (const [code, kind, word] of [[190, 'token', 'abgelaufen'], [10, 'rechte', 'Rechte'], [200, 'rechte', 'Rechte'], [4, 'limit', 'Zu viele']]) {
    await test('Fehler ' + code + ' → verständliche Meldung, Token nicht enthalten', async () => {
      const f = async () => ({ ok: false, status: 400, json: async () => ({ error: { code, message: 'raw ' + TOKEN } }) });
      await assert.rejects(M.fetchAll({ settings: E.defaultSettings(), engine: E, token: TOKEN, fetch: f }), (e) => {
        assert.strictEqual(e.name, 'MetaError');
        assert.strictEqual(e.kind, kind);
        assert.ok(e.message.includes(word), e.message);
        assert.ok(!e.message.includes(TOKEN));
        return true;
      });
    });
  }

  await test('Netzwerkfehler und fehlender Token', async () => {
    const f = async () => { throw new TypeError('Failed to fetch ' + TOKEN); };
    await assert.rejects(M.fetchAll({ settings: E.defaultSettings(), engine: E, token: TOKEN, fetch: f }), (e) => e.kind === 'netz' && !e.message.includes(TOKEN));
    await assert.rejects(M.fetchAll({ settings: E.defaultSettings(), engine: E, token: '', fetch: f }), (e) => e.kind === 'token');
  });

  await test('URLs für Anzeige ohne Token', async () => {
    const c = M.createClient({ fetch: async () => ({}), token: TOKEN, version: 'v23.0' });
    const u = c.url('123/posts', { limit: 1 });
    assert.ok(!u.includes(TOKEN) && u.includes('access_token=***'));
  });

  console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  process.exit(failed ? 1 : 0);
})();
