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
// Fertig gerendertes Showroom-Video (GitHub Actions, Workflow velo-tv-showroom.yml)
const VIDEO_BASIS = 'https://github.com/Tiry38/Tiry/releases/download/velo-tv-showroom/';

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

/** Bild-Zuordnung der Homepage (Block bilderData der Live-Seite, wie bmKey/bmApply in index.html).
    Tiry 27.11.2026: Lager-Bilder stehen dort, nicht in Firestore bestand/aktuell. */
function bmKey(m, mo, j, f) {
  const n = (t) => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, '');
  return [m, mo, j, f].map(n).join('|');
}
function bmApply(d, bmap) {
  if (!bmap) return d;
  ((d && d.raeder) || []).forEach((r) => (r.farben || []).forEach((v) => {
    const k = bmKey(r.marke, r.modell, v.jahr, v.farbe);
    if (!(k in bmap)) return;
    if (v.bild && !/^img\/bestand\//.test(v.bild)) return;
    if (bmap[k]) v.bild = bmap[k]; else delete v.bild;
  }));
  return d;
}
function bilderDataAus(html) {
  const m = /<script type="application\/json" id="bilderData">([\s\S]*?)<\/script>/.exec(html || '');
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
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
  const videoDir = path.join(dir, 'video');
  const videoMetaDatei = path.join(videoDir, 'video.json');
  fs.mkdirSync(videoDir, { recursive: true });
  let video = null;
  try { video = JSON.parse(fs.readFileSync(videoMetaDatei, 'utf8')); if (!fs.existsSync(path.join(videoDir, video.datei))) video = null; } catch (e) { video = null; }
  let videoLaeuft = null, videoFehler = null;
  const fetchImpl = opts.fetch || fetch;
  fs.mkdirSync(bildDir, { recursive: true });
  let daten = { items: [], stand: '', ts: 0, fehler: null };
  try { daten = Object.assign(daten, JSON.parse(fs.readFileSync(datei, 'utf8'))); } catch (e) { /* erster Start */ }
  let laeuft = null;

  async function bildLaden(quelle) {
    const name = crypto.createHash('sha1').update(quelle).digest('hex').slice(0, 16) + path.extname(quelle).toLowerCase();
    const ziel = path.join(bildDir, name);
    if (fs.existsSync(ziel)) return name;
    for (const basis of [].concat(BILD_BASEN, BILD_BASEN, BILD_BASEN)) { // bis zu 3 Versuche je Bild
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

  // Bild-Zuordnung von der Live-Seite; ohne Antwort die zuletzt bekannte (nie Bilder verlieren, nur weil die Seite hängt)
  let bmapAlt = null;
  async function bilderLaden() {
    for (const basis of BILD_BASEN) {
      try {
        const r = await fetchImpl(basis + 'lager/?v=' + Date.now(), { signal: AbortSignal.timeout(30000) });
        if (!r.ok) continue;
        const b = bilderDataAus(await r.text());
        if (b) { bmapAlt = b; return b; }
      } catch (e) { /* nächste Adresse */ }
    }
    return bmapAlt;
  }

  async function aktualisieren() {
    if (laeuft) return laeuft;
    laeuft = (async () => {
      try {
        const [bestand, pub, bmap] = await Promise.all([fsGet('bestand/aktuell', fetchImpl), fsGet('pub/lager', fetchImpl).catch(() => null), bilderLaden()]);
        if (!bestand || !Array.isArray(bestand.raeder)) throw new Error('Kein Bestand gefunden');
        const liste = angebote(merge(bmApply(bestand, bmap), pub && pub.rows));
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

  /** Neues Showroom-Video aus der Cloud holen, wenn es eins gibt (alle 15 min) */
  async function videoHolen() {
    if (videoLaeuft) return videoLaeuft;
    videoLaeuft = (async () => {
      try {
        const r = await fetchImpl(VIDEO_BASIS + 'showroom-video.json?v=' + Date.now(), { signal: AbortSignal.timeout(30000), redirect: 'follow' });
        if (r.status === 404) { videoFehler = null; return; } // noch kein Video gebaut
        if (!r.ok) throw new Error('Video-Info nicht erreichbar (' + r.status + ')');
        const meta = await r.json();
        if (!meta || !meta.version) throw new Error('Video-Info ungültig');
        if (video && video.version === meta.version) { videoFehler = null; return; }
        const name = 'showroom-' + String(meta.version).replace(/[^a-z0-9]/gi, '') + '.mp4';
        const ziel = path.join(videoDir, name);
        const v = await fetchImpl(VIDEO_BASIS + 'showroom.mp4?v=' + meta.version, { signal: AbortSignal.timeout(30 * 60 * 1000), redirect: 'follow' });
        if (!v.ok || !v.body) throw new Error('Video-Download fehlgeschlagen (' + v.status + ')');
        const { Readable } = require('stream');
        const { pipeline } = require('stream/promises');
        await pipeline(Readable.fromWeb(v.body), fs.createWriteStream(ziel + '.teil'));
        const groesse = fs.statSync(ziel + '.teil').size;
        if (meta.groesse && Math.abs(groesse - meta.groesse) > 1024) throw new Error('Video unvollständig');
        await fsp.rename(ziel + '.teil', ziel);
        const alt = video;
        video = Object.assign({}, meta, { datei: name, url: '/showroom-video/' + name, geholt: Date.now() });
        delete video.items;
        await fsp.writeFile(videoMetaDatei, JSON.stringify(video, null, 1));
        if (alt && alt.datei !== name) await fsp.unlink(path.join(videoDir, alt.datei)).catch(() => {});
        videoFehler = null;
        if (opts.onChange) opts.onChange(daten);
      } catch (e) {
        videoFehler = e.message || 'Fehler';
        for (const f of await fsp.readdir(videoDir).catch(() => [])) if (f.endsWith('.teil')) await fsp.unlink(path.join(videoDir, f)).catch(() => {});
      } finally { videoLaeuft = null; }
    })();
    return videoLaeuft;
  }

  const timer = setInterval(() => aktualisieren(), 30 * 60 * 1000);
  const videoTimer = setInterval(() => videoHolen(), 15 * 60 * 1000);
  if (opts.autoStart !== false) { setTimeout(() => aktualisieren(), 1500); setTimeout(() => videoHolen(), 5000); }

  return {
    get daten() { return Object.assign({}, daten, { video: video ? Object.assign({}, video, { fehler: videoFehler }) : (videoFehler ? { fehler: videoFehler } : null) }); },
    bildDir,
    videoDir,
    aktualisieren,
    videoHolen,
    stop() { clearInterval(timer); clearInterval(videoTimer); }
  };
}

module.exports = { createShowroom, merge, angebote, admKey, marke, fsObj, bmKey, bmApply, bilderDataAus };
