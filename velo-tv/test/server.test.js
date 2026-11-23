const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('../src/server/server');

const ROOT = path.join(__dirname, '..', 'src');
let srv, base, dir, key;

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velotv-'));
  srv = createServer({ dataDir: dir, playerDir: path.join(ROOT, 'player'), assetDirs: { '/assets/': path.join(ROOT, 'renderer', 'assets'), '/shared/': path.join(ROOT, 'shared') }, version: 'test' });
  const port = await srv.listen(0, '127.0.0.1');
  base = 'http://127.0.0.1:' + port;
});
test.after(async () => { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const call = async (m, p, body, k) => {
  const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Key': k === undefined ? key : k, 'X-PC': encodeURIComponent('Büro 1') }, body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
  return { status: r.status, data: await r.json().catch(() => null), r };
};

test('Player und Assets werden ausgeliefert', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /player\.js/);
  assert.equal((await fetch(base + '/shared/schedule.js')).status, 200);
  assert.equal((await fetch(base + '/assets/logo.png')).status, 200);
  assert.equal((await fetch(base + '/media/../../etc/passwd')).status, 404);
});

test('Schreiben nur gekoppelt; PIN-Kopplung mit Sperre', async () => {
  assert.equal((await call('POST', '/api/items', { kind: 'text', text: { title: 'x' } }, 'falsch')).status, 401);
  assert.equal((await call('POST', '/api/pair', { pin: '0000' === srv.pin ? '1111' : '0000', pc: 'Büro 1' }, '')).status, 403);
  const ok = await call('POST', '/api/pair', { pin: srv.pin, pc: 'Büro 1' }, '');
  assert.equal(ok.status, 200);
  key = ok.data.key;
  assert.ok(key.length > 20);
});

test('Hochladen, Text-Folie, Sortieren, Bearbeiten, Papierkorb', async () => {
  const bild = Buffer.from('ffd8ffe000104a464946', 'hex');
  const up = await call('PUT', '/api/upload?name=Aktion.jpg&kind=image', bild);
  assert.equal(up.status, 200);
  assert.equal(up.data.kind, 'image');
  assert.equal(up.data.addedBy, 'Büro 1');
  const med = await fetch(base + '/media/' + up.data.file, { headers: { Range: 'bytes=0-3' } });
  assert.equal(med.status, 206);
  assert.equal(Buffer.from(await med.arrayBuffer()).length, 4);

  const vid = await call('PUT', '/api/upload?name=Film.mp4&kind=video&duration=12.34', Buffer.alloc(100, 1));
  assert.equal(vid.data.duration, 0);
  assert.equal(vid.data.mediaLength, 12.3);
  assert.equal((await call('PUT', '/api/upload?name=x.exe&kind=video', Buffer.alloc(5))).status, 415);

  const txt = await call('POST', '/api/items', { kind: 'text', text: { title: 'Winter-Check', theme: 'rot', badge: '<b>' }, plan: { days: [1, 9], from: '9:00', to: 'x' } });
  assert.equal(txt.status, 200);
  assert.deepEqual(txt.data.plan.days, [1]);
  assert.equal(txt.data.plan.from, '9:00');
  assert.equal(txt.data.plan.to, '');

  await call('POST', '/api/order', { ids: [txt.data.id, up.data.id] });
  let st = (await call('GET', '/api/state')).data;
  assert.deepEqual(st.items.map((i) => i.id), [txt.data.id, up.data.id, vid.data.id]);

  const p = await call('PATCH', '/api/items/' + up.data.id, { duration: 1, fit: 'cover', enabled: false });
  assert.equal(p.data.duration, 2);
  assert.equal(p.data.fit, 'cover');
  assert.equal(p.data.enabled, false);

  await call('DELETE', '/api/items/' + txt.data.id);
  st = (await call('GET', '/api/state')).data;
  assert.equal(st.items.length, 2);
  assert.equal(st.trash[0].deletedBy, 'Büro 1');
  await call('POST', '/api/trash/' + txt.data.id + '/restore');
  st = (await call('GET', '/api/state')).data;
  assert.equal(st.items[0].id, txt.data.id, 'kommt an alte Stelle zurück');

  await call('DELETE', '/api/items/' + up.data.id);
  await call('DELETE', '/api/trash/' + up.data.id);
  assert.equal((await fetch(base + '/media/' + up.data.file)).status, 404, 'Datei endgültig weg');
  assert.match(st.log.map((l) => l.text).join('|'), /hinzugefügt/);
});

test('Live-Sync: zweiter PC bekommt Änderungen per Server-Sent-Events', async () => {
  const ctrl = new AbortController();
  const r = await fetch(base + '/api/events?kind=pc&pc=Kasse&key=' + key, { signal: ctrl.signal });
  assert.equal(r.status, 200);
  const reader = r.body.getReader();
  let puffer = '';
  const warte = async (muster) => {
    const ende = Date.now() + 3000;
    while (Date.now() < ende) {
      const { value } = await reader.read();
      puffer += Buffer.from(value).toString();
      if (muster.test(puffer)) return true;
    }
    return false;
  };
  assert.ok(await warte(/event: state/));
  puffer = '';
  await call('POST', '/api/items', { kind: 'text', text: { title: 'Live-Test' } });
  assert.ok(await warte(/Live-Test/), 'Änderung kam live an');
  ctrl.abort();
  assert.equal((await fetch(base + '/api/events?kind=pc&key=falsch')).status, 401);
});

test('Herzschlag des Fernsehers', async () => {
  const r = await fetch(base + '/api/tv/heartbeat', { method: 'POST', body: JSON.stringify({ showing: 'abc', showingName: 'Test', screen: '1920×1080' }) });
  assert.equal(r.status, 200);
  const a = srv.anwesenheit();
  assert.equal(a.tv.online, true);
  assert.equal(a.tv.showingName, 'Test');
});

test('Zustand übersteht Neustart', async () => {
  await srv.close();
  srv = createServer({ dataDir: dir, playerDir: path.join(ROOT, 'player'), version: 'test' });
  const port = await srv.listen(0, '127.0.0.1');
  base = 'http://127.0.0.1:' + port;
  const st = (await call('GET', '/api/state')).data;
  assert.ok(st.items.some((i) => i.name === 'Live-Test'));
  assert.equal((await call('POST', '/api/items', { kind: 'text', text: { title: 'nach Neustart' } })).status, 200, 'Kopplung bleibt gültig');
});
