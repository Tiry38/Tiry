const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { merge, angebote, admKey, createShowroom } = require('../src/server/showroom');
const { createServer } = require('../src/server/server');

const RAD = (o) => Object.assign({ marke: 'QiO', modell: 'EINS P-5', gr: '47 cm', rahmen: 'Kompaktrad', farben: [] }, o);
const BESTAND = { stand: '23.11.2026', raeder: [
  RAD({ farben: [
    { id: '1', farbe: 'soft mint', preis: 3999, angebot: 3499, status: 'lager', bild: 'img/bestand/qio-0.webp' },
    { id: '2', farbe: 'ice blue', preis: 3999, angebot: 3499, status: 'bestellt', bild: 'img/bestand/qio-2.webp' }, // bestellt → nein
    { id: '3', farbe: 'weiß', preis: 3999, status: 'lager', bild: 'img/bestand/qio-1.webp' },                    // kein Angebot → nein
    { id: '4', farbe: 'rot', preis: 3999, angebot: 3499, status: 'lager' }                                       // kein Foto → nein
  ] }),
  RAD({ marke: 'KTM', modell: 'Macina Style', gr: '46 cm', rahmen: 'Trapez', farben: [{ id: '5', farbe: 'grün', preis: 4999, angebot: 3999, status: 'lager', bild: 'img/bestand/ktm-1.webp' }] }),
  RAD({ marke: 'i:SY', modell: 'S8', gr: '47 cm', farben: [{ id: '6', farbe: 'berry red', preis: 3899, angebot: 3199, status: 'lager', bild: 'img/bestand/isy-1.webp' }] })
] };

test('Filter: nur Angebote, auf Lager, mit eigenem Foto', () => {
  const a = angebote(merge(BESTAND, {}));
  assert.deepEqual(a.map((x) => x.id).sort(), ['1', '5', '6']);
  const isy = a.find((x) => x.id === '6');
  assert.equal(isy.markeKey, 'isy');
  assert.equal(isy.logo, '/assets/marken/marke-isy.svg');
});

test('Ausblenden und Preisänderungen aus der Homepage-Verwaltung gelten auch am Fernseher', () => {
  const ktm = BESTAND.raeder[1], isy = BESTAND.raeder[2];
  const rows = {
    ['ov-' + admKey(ktm)]: { hidden: true },
    ['ov-' + admKey(isy)]: { v: { 6: { angebot: 2999 } } }
  };
  const a = angebote(merge(BESTAND, rows));
  assert.ok(!a.some((x) => x.id === '5'), 'ausgeblendetes Rad fehlt');
  assert.equal(a.find((x) => x.id === '6').angebot, 2999);
  const ohne = angebote(merge(BESTAND, { ['ov-' + admKey(isy)]: { v: { 6: { angebot: null } } } }));
  assert.ok(!ohne.some((x) => x.id === '6'), 'Angebot entfernt → nicht mehr im Showroom');
});

function fakeFetch() {
  const fsWert = (v) => (typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(fsWert) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsWert(x)])) } });
  const bild = Buffer.alloc(5000, 7);
  return async (url) => {
    if (url.includes('documents/bestand/aktuell')) return new Response(JSON.stringify({ fields: fsWert(BESTAND).mapValue.fields }), { status: 200 });
    if (url.includes('documents/pub/lager')) return new Response('{}', { status: 404 });
    if (url.includes('/img/bestand/')) return new Response(bild, { status: 200, headers: { 'content-type': 'image/webp' } });
    if (url.includes('showroom-video.json')) return new Response(JSON.stringify({ version: 'abc123', ts: 1, anzahl: 3, dauer: 24, groesse: 4096 }), { status: 200 });
    if (url.includes('showroom.mp4')) return new Response(Buffer.alloc(4096, 3), { status: 200, headers: { 'content-type': 'video/mp4' } });
    return new Response('x', { status: 404 });
  };
}

test('Zentrale lädt Angebote + Fotos und liefert sie dem Fernseher', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velotv-sr-'));
  const ROOT = path.join(__dirname, '..', 'src');
  const srv = createServer({ dataDir: dir, playerDir: path.join(ROOT, 'player'), version: 'test', fetch: fakeFetch(), showroomAutoStart: false, tvSteuerung: false });
  const port = await srv.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + port;
  try {
    let d = await (await fetch(base + '/api/showroom')).json();
    assert.equal(d.items.length, 0);
    const key = srv.localKey;
    const r = await fetch(base + '/api/showroom/refresh', { method: 'POST', headers: { 'X-Key': key } });
    assert.equal((await r.json()).anzahl, 3);
    d = await (await fetch(base + '/api/showroom')).json();
    assert.equal(d.stand, '23.11.2026');
    const img = await fetch(base + d.items[0].img);
    assert.equal(img.status, 200);
    assert.equal(Buffer.from(await img.arrayBuffer()).length, 5000);
    const item = await (await fetch(base + '/api/items', { method: 'POST', headers: { 'X-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'showroom' }) })).json();
    assert.equal(item.kind, 'showroom');
    assert.equal(item.duration, 120);
    assert.equal((await fetch(base + '/api/showroom/refresh', { method: 'POST' })).status, 401, 'Aktualisieren nur gekoppelt');
    // fertiges Video aus der Cloud wurde geholt und wird mit Range ausgeliefert
    d = await (await fetch(base + '/api/showroom')).json();
    assert.equal(d.video.version, 'abc123');
    assert.equal(d.video.anzahl, 3);
    const v = await fetch(base + d.video.url, { headers: { Range: 'bytes=0-99' } });
    assert.equal(v.status, 206);
    assert.equal(Buffer.from(await v.arrayBuffer()).length, 100);
  } finally {
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
