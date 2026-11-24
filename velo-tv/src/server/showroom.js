'use strict';
/* Live-Showroom: holt den Live-Bestand der Homepage (öffentliche Firestore-Daten, wie jeder Besucher),
   filtert die Angebotsräder (auf Lager, mit Foto), lädt die Fotos auf die Zentrale und liefert sie dem Fernseher.
   Logik entspricht der Homepage: admMerge (ausgeblendete Räder, Varianten-Änderungen), admKey. */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const FB = { projectId: 'velo-center-web', apiKey: 'AIzaSyCgQIqsjjeNxyOcZhNdNlkmKxAZEAWQa7U' }; // öffentlicher Web-Schlüssel der Homepage
const BILD_BASEN = ['https://tiry38.github.io/velo-center-web/'];

// Marken wie auf der Homepage (BR/BRK): Schlüssel, Name, Logo, Deckkraft des Wasserzeichens, Akzentfarbe
const MARKEN = [
  [/i:?\s?sy/i, 'isy', 'i:SY', 0.5, '#FF7A1A'], [/ktm/i, 'ktm', 'KTM', 0.23, '#FF6A00'], [/qio/i, 'qio', 'QiO', 0.22, '#38BDF8'],
  [/velo\s*de\s*ville|vdv/i, 'vdv', 'Velo de Ville', 0.29, '#F97316'], [/van\s*raam/i, 'vanraam', 'Van Raam', 0.47, '#A855F7'],
  [/gudereit/i, 'gudereit', 'Gudereit', 0.4, '#E2232D'], [/victoria/i, 'victoria', 'Victoria', 0.43, '#22D3EE'], [/stevens/i, 'stevens', 'Stevens', 0.3, '#8C9097']
];

function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return fsObj(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  return null;
}
function fsObj(f) { const o = {}; for (const k in f || {}) o[k] = fsVal(f[k]); return o; }

async function fsGet(p, fetchImpl) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents/' + p + '?key=' + FB.apiKey;
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Bestand nicht erreichbar (' + r.status + ')');
  return fsObj((await r.json()).fields);
}

const admSlug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'x';
const admKey = (r) => admSlug([r.marke, r.modell, r.gr, r.rahmen, r.gebraucht ? 'g' : '', r.vorfuehr ? 'v' : ''].join(' '));

/** Wie admMerge der Homepage: ausgeblendete Räder raus, Varianten-Änderungen anwenden, eigene Räder dazu */
function merge(bestand, rows) {
  rows = rows || {};
  const R = [];
  (bestand && bestand.raeder || []).forEach((r) => {
    const o = rows['ov-' + admKey(r)];
    if (o && o.hidden) return;
    const farben = (r.farben || []).map((f) => {
      const x = o && o.v && o.v[f.id];
      if (!x) return f;
      if (x.hidden) return null;
      const y = Object.assign({}, f);
      ['preis', 'angebot', 'status', 'ab', 'bild', 'res'].forEach((n) => {
        if (x[n] !== undefined) { if (x[n] === null || x[n] === '' || x[n] === false) delete y[n]; else y[n] = x[n]; }
      });
      return y;
    }).filter(Boolean);
    if (farben.length) R.push(Object.assign({}, r, { farben }));
  });
  Object.keys(rows).filter((i) => i.startsWith('neu-')).sort().forEach((i) => {
    const n = rows[i];
    if (n && n.rad && !n.hidden && (n.rad.farben || []).length) R.push(Object.assign({}, n.rad, { eigen: true }));
  });
  return R;
}

function marke(name) {
  const m = MARKEN.find(([re]) => re.test(name || ''));
  return m ? { k: m[1], n: m[2], o: m[3], c: m[4], logo: '/assets/marken/marke-' + m[1] + '.svg' } : null;
}

/** Angebotsräder: Angebotspreis < Preis, auf Lager, eigenes Foto (nie Katalog-/Fremdbild), je Foto+Preis nur einmal */
function angebote(raeder) {
  const out = [], gesehen = new Set();
  for (const r of raeder) {
    const mk = marke(r.marke + ' ' + r.modell);
    for (const v of r.farben || []) {
      if (!v.angebot || !v.preis || !(v.angebot < v.preis)) continue;
      if (v.status === 'bestellt' || v.res) continue;
      if (typeof v.bild !== 'string' || !/^img\/bestand\//.test(v.bild)) continue;
      const sig = v.bild + '|' + v.angebot + '|' + r.modell;
      if (gesehen.has(sig)) continue;
      gesehen.add(sig);
      out.push({
        id: String(v.id || sig), marke: mk ? mk.n : r.marke, markeKey: mk ? mk.k : '', logo: mk ? mk.logo : '', wz: mk ? mk.o : 0.3, akzent: mk ? mk.c : '#8C9097',
        modell: r.modell, gr: r.gr || '', rahmen: r.rahmen || '', farbe: v.farbe || '', jahr: v.jahr || '',
        motor: v.motor || '', akku: v.akku || '', preis: v.preis, angebot: v.angebot, quelle: v.bild
      });
    }
  }
  return out;
}

function createShowroom(opts) {
  const dir = path.join(opts.dataDir, 'showroom');
  const bildDir = path.join(dir, 'bilder');
  const datei = path.join(dir, 'showroom.json');
  const fetchImpl = opts.fetch || fetch;
  fs.mkdirSync(bildDir, { recursive: true });
  let daten = { items: [], stand: '', ts: 0, fehler: null };
  try { daten = Object.assign(daten, JSON.parse(fs.readFileSync(datei, 'utf8'))); } catch (e) { /* erster Start */ }
  let laeuft = null;

  async function bildLaden(quelle) {
    const name = crypto.createHash('sha1').update(quelle).digest('hex').slice(0, 16) + path.extname(quelle).toLowerCase();
    const ziel = path.join(bildDir, name);
    if (fs.existsSync(ziel)) return name;
    for (const basis of BILD_BASEN) {
      try {
        const r = await fetchImpl(basis + quelle, { signal: AbortSignal.timeout(30000) });
        const typ = r.headers.get('content-type') || '';
        if (!r.ok || !/image/.test(typ)) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 1000) continue;
        await fsp.writeFile(ziel + '.teil', buf);
        await fsp.rename(ziel + '.teil', ziel);
        return name;
      } catch (e) { /* nächste Adresse */ }
    }
    return null;
  }

  async function aktualisieren() {
    if (laeuft) return laeuft;
    laeuft = (async () => {
      try {
        const [bestand, pub] = await Promise.all([fsGet('bestand/aktuell', fetchImpl), fsGet('pub/lager', fetchImpl).catch(() => null)]);
        if (!bestand || !Array.isArray(bestand.raeder)) throw new Error('Kein Bestand gefunden');
        const liste = angebote(merge(bestand, pub && pub.rows));
        const items = [];
        for (const a of liste) {
          const name = await bildLaden(a.quelle);
          if (name) items.push(Object.assign({}, a, { img: '/showroom/' + name }));
        }
        // alte Fotos aufräumen
        const behalten = new Set(items.map((i) => i.img.slice(10)));
        for (const f of await fsp.readdir(bildDir)) if (!behalten.has(f)) await fsp.unlink(path.join(bildDir, f)).catch(() => {});
        daten = { items, stand: bestand.stand || '', ts: Date.now(), fehler: null };
      } catch (e) {
        daten = Object.assign({}, daten, { fehler: e.message || 'Fehler', fehlerTs: Date.now() });
      }
      await fsp.writeFile(datei, JSON.stringify(daten, null, 1)).catch(() => {});
      laeuft = null;
      if (opts.onChange) opts.onChange(daten);
      return daten;
    })();
    return laeuft;
  }

  const timer = setInterval(() => aktualisieren(), 30 * 60 * 1000);
  if (opts.autoStart !== false) setTimeout(() => aktualisieren(), 1500);

  return {
    get daten() { return daten; },
    bildDir,
    aktualisieren,
    stop() { clearInterval(timer); }
  };
}

module.exports = { createShowroom, merge, angebote, admKey, marke, fsObj };
