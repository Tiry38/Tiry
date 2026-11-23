'use strict';
/* Velo-TV Zentrale: kleiner HTTP-Server im Ladennetz.
   - liefert dem Fernseher den Player (/) und die Dateien (/media, mit Range für Videos)
   - hält Programm, Papierkorb, Verlauf und Einstellungen (state.json)
   - schickt jede Änderung live per Server-Sent-Events an alle PCs und den Fernseher
   Nur Node-Bordmittel, damit es überall läuft und testbar ist. */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const MAX_UPLOAD = 4 * 1024 * 1024 * 1024; // 4 GB
const LOG_MAX = 300;
const TRASH_TAGE = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

const BILD_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXT = ['.mp4', '.m4v', '.webm', '.mov', '.mkv'];

function id() { return crypto.randomBytes(6).toString('hex'); }
function jetzt() { return new Date().toISOString(); }

function leererZustand() {
  return {
    rev: 0,
    items: [],
    trash: [],
    log: [],
    settings: { defaultDuration: 10, transition: 'fade', clock: false, showLogo: false }
  };
}

function sauber(text, max) {
  return String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200);
}

function planSauber(p) {
  p = p || {};
  const zeit = (v) => (/^\d{1,2}:\d{2}$/.test(v || '') ? v : '');
  const datum = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const days = Array.isArray(p.days) ? [...new Set(p.days.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : [];
  return { days, from: zeit(p.from), to: zeit(p.to), startDate: datum(p.startDate), endDate: datum(p.endDate) };
}

const TEXT_THEMES = ['herbst', 'rot', 'dunkel', 'hell', 'verlauf'];

function textSauber(t) {
  t = t || {};
  return {
    title: sauber(t.title, 120),
    sub: sauber(t.sub, 240),
    badge: sauber(t.badge, 40),
    theme: TEXT_THEMES.includes(t.theme) ? t.theme : 'herbst'
  };
}

function createServer(opts) {
  const dataDir = opts.dataDir;
  const mediaDir = path.join(dataDir, 'media');
  const stateFile = path.join(dataDir, 'state.json');
  const secretFile = path.join(dataDir, 'zugang.json');
  const playerDir = opts.playerDir;
  const assetDirs = opts.assetDirs || {}; // { '/assets/': dir, '/shared/': dir }
  const version = opts.version || 'dev';

  fs.mkdirSync(mediaDir, { recursive: true });

  let state = leererZustand();
  try {
    const roh = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state = Object.assign(leererZustand(), roh);
    state.settings = Object.assign(leererZustand().settings, roh.settings || {});
  } catch (e) { /* erster Start */ }

  let zugang;
  try { zugang = JSON.parse(fs.readFileSync(secretFile, 'utf8')); } catch (e) { zugang = null; }
  if (!zugang || !zugang.pin) {
    zugang = { pin: String(crypto.randomInt(1000, 10000)), keys: {} };
    fs.writeFileSync(secretFile, JSON.stringify(zugang, null, 2));
  }
  const localKey = crypto.randomBytes(24).toString('hex'); // nur für die Steuerung auf diesem PC

  const clients = new Map(); // res -> { pc, kind, since }
  let tv = null; // letzter Herzschlag des Fernsehers
  const fehlversuche = new Map();

  // ---------- Speichern ----------
  let speichernTimer = null;
  let speichernLaeuft = Promise.resolve();
  function speichern() {
    clearTimeout(speichernTimer);
    speichernTimer = setTimeout(() => {
      const daten = JSON.stringify(state, null, 1);
      speichernLaeuft = speichernLaeuft.then(async () => {
        const tmp = stateFile + '.tmp';
        await fsp.writeFile(tmp, daten);
        await fsp.rename(tmp, stateFile);
      }).catch((e) => console.error('[velo-tv] Speichern fehlgeschlagen:', e.message));
    }, 150);
  }
  async function speichernJetzt() {
    clearTimeout(speichernTimer);
    const tmp = stateFile + '.tmp';
    await speichernLaeuft;
    await fsp.writeFile(tmp, JSON.stringify(state, null, 1));
    await fsp.rename(tmp, stateFile);
  }

  function protokoll(pc, text) {
    state.log.unshift({ at: jetzt(), pc: sauber(pc, 40) || 'Unbekannt', text: sauber(text, 200) });
    if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
  }

  function geaendert(pc, text, extra) {
    state.rev++;
    if (text) protokoll(pc, text);
    speichern();
    senden('state', state);
    if (extra) senden(extra.event, extra.data);
  }

  // ---------- Live-Verbindungen ----------
  function senden(event, data, nur) {
    const zeile = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const [res, info] of clients) {
      if (nur && info.kind !== nur) continue;
      try { res.write(zeile); } catch (e) { /* wird beim close entfernt */ }
    }
  }

  function anwesenheit() {
    const pcs = [];
    for (const info of clients.values()) if (info.kind === 'pc') pcs.push({ pc: info.pc, since: info.since });
    const tvOnline = !!tv && Date.now() - tv.lastSeen < 35000;
    return { pcs, tv: tv ? Object.assign({}, tv, { online: tvOnline }) : null };
  }
  function anwesenheitSenden() { senden('presence', anwesenheit(), 'pc'); }

  const pingTimer = setInterval(() => {
    for (const res of clients.keys()) { try { res.write(': ping\n\n'); } catch (e) { /* egal */ } }
    anwesenheitSenden();
  }, 15000);

  // ---------- Papierkorb aufräumen ----------
  async function papierkorbAufraeumen() {
    const grenze = Date.now() - TRASH_TAGE * 86400000;
    const alt = state.trash.filter((t) => Date.parse(t.deletedAt) < grenze);
    if (!alt.length) return;
    state.trash = state.trash.filter((t) => !alt.includes(t));
    for (const t of alt) await dateienLoeschen(t);
    geaendert('Zentrale', alt.length + ' alte Einträge aus dem Papierkorb endgültig gelöscht');
  }
  const aufraeumTimer = setInterval(() => papierkorbAufraeumen().catch(() => {}), 6 * 3600000);

  async function dateienLoeschen(item) {
    for (const f of [item.file, item.thumb]) {
      if (!f) continue;
      const nochGenutzt = state.items.some((i) => i.file === f || i.thumb === f) || state.trash.some((i) => i !== item && (i.file === f || i.thumb === f));
      if (!nochGenutzt) await fsp.unlink(path.join(mediaDir, f)).catch(() => {});
    }
  }

  // ---------- Hilfen ----------
  function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Key, X-PC');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Velo-TV');
    res.setHeader('X-Velo-TV', version);
  }

  function json(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  function koerper(req, max) {
    return new Promise((resolve, reject) => {
      let n = 0; const teile = [];
      req.on('data', (c) => { n += c.length; if (n > (max || 1e6)) { reject(Object.assign(new Error('zu groß'), { code: 413 })); req.destroy(); } else teile.push(c); });
      req.on('end', () => { try { resolve(teile.length ? JSON.parse(Buffer.concat(teile).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Ungültiges JSON'), { code: 400 })); } });
      req.on('error', reject);
    });
  }

  function berechtigt(req) {
    const k = req.headers['x-key'];
    if (!k) return false;
    if (k === localKey) return true;
    return Object.prototype.hasOwnProperty.call(zugang.keys, k);
  }

  function pcName(req) {
    let n = req.headers['x-pc'];
    try { n = decodeURIComponent(n || ''); } catch (e) { /* roh */ }
    return sauber(n, 40) || 'PC';
  }

  function finde(idx) { return state.items.find((i) => i.id === idx); }

  async function statisch(res, datei, req) {
    try {
      const st = await fsp.stat(datei);
      if (!st.isFile()) throw new Error('kein File');
      const typ = MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream';
      const istMedia = datei.startsWith(mediaDir);
      const kopf = {
        'Content-Type': typ,
        'Accept-Ranges': 'bytes',
        'Cache-Control': istMedia ? 'public, max-age=31536000, immutable' : 'no-cache'
      };
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let ende = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
        if (m && !m[1] && m[2]) { start = Math.max(0, st.size - parseInt(m[2], 10)); ende = st.size - 1; }
        if (start >= st.size || ende < start) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
        ende = Math.min(ende, st.size - 1);
        res.writeHead(206, Object.assign(kopf, { 'Content-Range': `bytes ${start}-${ende}/${st.size}`, 'Content-Length': ende - start + 1 }));
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(datei, { start, end: ende }).pipe(res);
      }
      res.writeHead(200, Object.assign(kopf, { 'Content-Length': st.size }));
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(datei).pipe(res);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden');
    }
  }

  function sicher(basis, rel) {
    const ziel = path.normalize(path.join(basis, rel));
    return ziel.startsWith(path.normalize(basis + path.sep)) ? ziel : null;
  }

  // ---------- Hochladen ----------
  function hochladen(req, ext) {
    return new Promise((resolve, reject) => {
      const laenge = parseInt(req.headers['content-length'] || '0', 10);
      if (laenge > MAX_UPLOAD) return reject(Object.assign(new Error('Datei ist zu groß (max. 4 GB)'), { code: 413 }));
      const name = id() + '-' + Date.now().toString(36) + ext;
      const ziel = path.join(mediaDir, name);
      const tmp = ziel + '.teil';
      const out = fs.createWriteStream(tmp);
      let n = 0, abbruch = false;
      req.on('data', (c) => { n += c.length; if (n > MAX_UPLOAD && !abbruch) { abbruch = true; req.unpipe(out); out.destroy(); fs.unlink(tmp, () => {}); reject(Object.assign(new Error('Datei ist zu groß'), { code: 413 })); } });
      req.pipe(out);
      out.on('finish', () => {
        if (abbruch) return;
        if (n === 0) { fs.unlink(tmp, () => {}); return reject(Object.assign(new Error('Leere Datei'), { code: 400 })); }
        fs.rename(tmp, ziel, (e) => (e ? reject(e) : resolve({ name, size: n })));
      });
      out.on('error', (e) => { fs.unlink(tmp, () => {}); reject(e); });
      req.on('aborted', () => { abbruch = true; out.destroy(); fs.unlink(tmp, () => {}); reject(Object.assign(new Error('Abgebrochen'), { code: 400 })); });
    });
  }

  // ---------- API ----------
  async function api(req, res, url) {
    const p = url.pathname;
    const m = req.method;

    if (p === '/api/info' && m === 'GET') {
      return json(res, 200, { app: 'velo-tv', version, name: os.hostname(), rev: state.rev });
    }

    if (p === '/api/state' && m === 'GET') return json(res, 200, state);

    if (p === '/api/events' && m === 'GET') {
      const kind = url.searchParams.get('kind') === 'tv' ? 'tv' : 'pc';
      if (kind === 'pc' && !berechtigt({ headers: { 'x-key': url.searchParams.get('key') } })) return json(res, 401, { error: 'Nicht gekoppelt' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      let pc = url.searchParams.get('pc') || (kind === 'tv' ? 'Fernseher' : 'PC');
      clients.set(res, { pc: sauber(pc, 40), kind, since: jetzt() });
      res.write('event: state\ndata: ' + JSON.stringify(state) + '\n\n');
      if (kind === 'pc') res.write('event: presence\ndata: ' + JSON.stringify(anwesenheit()) + '\n\n');
      anwesenheitSenden();
      req.on('close', () => { clients.delete(res); anwesenheitSenden(); });
      return;
    }

    if (p === '/api/pair' && m === 'POST') {
      const ip = req.socket.remoteAddress || '';
      const f = fehlversuche.get(ip) || { n: 0, bis: 0 };
      if (f.bis > Date.now()) return json(res, 429, { error: 'Zu viele Versuche – bitte 1 Minute warten.' });
      const b = await koerper(req);
      if (String(b.pin || '') !== zugang.pin) {
        f.n++; if (f.n >= 5) { f.bis = Date.now() + 60000; f.n = 0; }
        fehlversuche.set(ip, f);
        return json(res, 403, { error: 'PIN falsch' });
      }
      fehlversuche.delete(ip);
      const key = crypto.randomBytes(24).toString('hex');
      zugang.keys[key] = { pc: sauber(b.pc, 40) || 'PC', at: jetzt() };
      await fsp.writeFile(secretFile, JSON.stringify(zugang, null, 2));
      protokoll(b.pc, 'als Bedienplatz gekoppelt');
      state.rev++; speichern(); senden('state', state);
      return json(res, 200, { key });
    }

    if (p === '/api/tv/heartbeat' && m === 'POST') {
      const b = await koerper(req, 20000);
      tv = {
        lastSeen: Date.now(),
        showing: sauber(b.showing, 80),
        showingName: sauber(b.showingName, 160),
        screen: sauber(b.screen, 40),
        agent: sauber(b.agent, 200),
        active: Number(b.active) || 0,
        version: sauber(b.version, 20),
        ip: (req.socket.remoteAddress || '').replace('::ffff:', '')
      };
      anwesenheitSenden();
      return json(res, 200, { ok: true, version });
    }

    // ---- ab hier nur gekoppelte PCs ----
    if (!berechtigt(req)) return json(res, 401, { error: 'Dieser PC ist nicht gekoppelt' });
    const pc = pcName(req);

    if (p === '/api/upload' && m === 'PUT') {
      const q = url.searchParams;
      const orig = sauber(q.get('name'), 160) || 'Datei';
      let ext = path.extname(orig).toLowerCase();
      const art = q.get('kind');
      if (art === 'image' && !BILD_EXT.includes(ext)) ext = '.jpg';
      if (art === 'video' && !VIDEO_EXT.includes(ext)) return json(res, 415, { error: 'Videoformat nicht unterstützt' });
      if (!['image', 'video'].includes(art)) return json(res, 400, { error: 'Unbekannte Art' });
      const { name, size } = await hochladen(req, ext);
      const dauer = parseFloat(q.get('duration'));
      const item = {
        id: id(),
        kind: art,
        name: orig.replace(/\.[a-z0-9]{2,5}$/i, ''),
        file: name,
        thumb: null,
        size,
        duration: art === 'video' ? 0 : state.settings.defaultDuration,
        mediaLength: isFinite(dauer) ? Math.round(dauer * 10) / 10 : null,
        fit: 'contain',
        enabled: true,
        plan: planSauber({}),
        group: sauber(q.get('group'), 160) || null,
        addedBy: pc,
        addedAt: jetzt()
      };
      const nach = q.get('after');
      const pos = nach ? state.items.findIndex((i) => i.id === nach) : -1;
      if (pos >= 0) state.items.splice(pos + 1, 0, item); else state.items.push(item);
      geaendert(pc, (art === 'video' ? 'Video' : 'Bild') + ' „' + item.name + '“ hinzugefügt');
      return json(res, 200, item);
    }

    let mm;
    if ((mm = /^\/api\/items\/([a-f0-9]+)\/thumb$/.exec(p)) && m === 'PUT') {
      const item = finde(mm[1]);
      if (!item) return json(res, 404, { error: 'Nicht gefunden' });
      const { name } = await hochladen(req, '.jpg');
      const alt = item.thumb;
      item.thumb = name;
      if (alt) await dateienLoeschen({ thumb: alt });
      geaendert(pc, null);
      return json(res, 200, item);
    }

    if (p === '/api/items' && m === 'POST') {
      const b = await koerper(req);
      if (b.kind !== 'text') return json(res, 400, { error: 'Nur Text-Folien können so angelegt werden' });
      const text = textSauber(b.text);
      if (!text.title) return json(res, 400, { error: 'Überschrift fehlt' });
      const item = {
        id: id(), kind: 'text', name: text.title.replace(/\*/g, ''), file: null, thumb: null, size: 0,
        duration: Math.min(300, Math.max(3, Number(b.duration) || state.settings.defaultDuration)),
        fit: 'contain', enabled: true, plan: planSauber(b.plan), text, group: null, addedBy: pc, addedAt: jetzt()
      };
      state.items.push(item);
      geaendert(pc, 'Text-Folie „' + item.name + '“ erstellt');
      return json(res, 200, item);
    }

    if ((mm = /^\/api\/items\/([a-f0-9]+)$/.exec(p)) && m === 'PATCH') {
      const item = finde(mm[1]);
      if (!item) return json(res, 404, { error: 'Nicht gefunden' });
      const b = await koerper(req);
      const was = [];
      if ('name' in b) { const n = sauber(b.name, 160); if (n && n !== item.name) { was.push('umbenannt'); item.name = n; } }
      if ('duration' in b) { const d = Math.min(3600, Math.max(item.kind === 'video' ? 0 : 2, Number(b.duration) || 0)); if (d !== item.duration) { item.duration = d; was.push('Dauer ' + (d ? d + ' s' : 'ganzes Video')); } }
      if ('fit' in b && ['cover', 'contain'].includes(b.fit) && b.fit !== item.fit) { item.fit = b.fit; was.push(b.fit === 'cover' ? 'Bild füllt' : 'Bild ganz'); }
      if ('enabled' in b && !!b.enabled !== item.enabled) { item.enabled = !!b.enabled; was.push(item.enabled ? 'eingeschaltet' : 'pausiert'); }
      if ('sound' in b && !!b.sound !== !!item.sound) { item.sound = !!b.sound; was.push(item.sound ? 'Ton an' : 'Ton aus'); }
      if ('plan' in b) { item.plan = planSauber(b.plan); was.push('Zeitplan geändert'); }
      if ('text' in b && item.kind === 'text') { item.text = textSauber(b.text); if (item.text.title) item.name = item.text.title.replace(/\*/g, ''); was.push('Text geändert'); }
      if (was.length) geaendert(pc, '„' + item.name + '“: ' + was.join(', '));
      return json(res, 200, item);
    }

    if ((mm = /^\/api\/items\/([a-f0-9]+)$/.exec(p)) && m === 'DELETE') {
      const pos = state.items.findIndex((i) => i.id === mm[1]);
      if (pos < 0) return json(res, 404, { error: 'Nicht gefunden' });
      const [item] = state.items.splice(pos, 1);
      item.deletedAt = jetzt(); item.deletedBy = pc; item.oldIndex = pos;
      state.trash.unshift(item);
      geaendert(pc, '„' + item.name + '“ in den Papierkorb gelegt');
      return json(res, 200, { ok: true });
    }

    if (p === '/api/order' && m === 'POST') {
      const b = await koerper(req);
      const ids = Array.isArray(b.ids) ? b.ids : [];
      const map = new Map(state.items.map((i) => [i.id, i]));
      const neu = [];
      for (const x of ids) if (map.has(x)) { neu.push(map.get(x)); map.delete(x); }
      for (const rest of map.values()) neu.push(rest);
      state.items = neu;
      geaendert(pc, 'Reihenfolge geändert');
      return json(res, 200, { ok: true });
    }

    if ((mm = /^\/api\/trash\/([a-f0-9]+)\/restore$/.exec(p)) && m === 'POST') {
      const pos = state.trash.findIndex((i) => i.id === mm[1]);
      if (pos < 0) return json(res, 404, { error: 'Nicht gefunden' });
      const [item] = state.trash.splice(pos, 1);
      const an = Math.min(item.oldIndex == null ? state.items.length : item.oldIndex, state.items.length);
      delete item.deletedAt; delete item.deletedBy; delete item.oldIndex;
      state.items.splice(an, 0, item);
      geaendert(pc, '„' + item.name + '“ wiederhergestellt');
      return json(res, 200, item);
    }

    if ((mm = /^\/api\/trash\/([a-f0-9]+)$/.exec(p)) && m === 'DELETE') {
      const pos = state.trash.findIndex((i) => i.id === mm[1]);
      if (pos < 0) return json(res, 404, { error: 'Nicht gefunden' });
      const [item] = state.trash.splice(pos, 1);
      await dateienLoeschen(item);
      geaendert(pc, '„' + item.name + '“ endgültig gelöscht');
      return json(res, 200, { ok: true });
    }

    if (p === '/api/trash' && m === 'DELETE') {
      const alle = state.trash; state.trash = [];
      for (const t of alle) await dateienLoeschen(t);
      geaendert(pc, 'Papierkorb geleert (' + alle.length + ')');
      return json(res, 200, { ok: true });
    }

    if (p === '/api/settings' && m === 'PATCH') {
      const b = await koerper(req);
      const s = state.settings;
      if ('defaultDuration' in b) s.defaultDuration = Math.min(300, Math.max(2, Number(b.defaultDuration) || 10));
      if ('transition' in b && ['fade', 'slide', 'zoom', 'none'].includes(b.transition)) s.transition = b.transition;
      if ('clock' in b) s.clock = !!b.clock;
      if ('showLogo' in b) s.showLogo = !!b.showLogo;
      geaendert(pc, 'Fernseher-Einstellungen geändert');
      return json(res, 200, s);
    }

    if (p === '/api/tv/show' && m === 'POST') {
      const b = await koerper(req);
      const item = finde(String(b.id || ''));
      if (!item) return json(res, 404, { error: 'Nicht gefunden' });
      senden('jump', { id: item.id }, 'tv');
      protokoll(pc, '„' + item.name + '“ sofort auf dem Fernseher gezeigt');
      state.rev++; speichern(); senden('state', state);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/tv/reload' && m === 'POST') {
      senden('reload', {}, 'tv');
      return json(res, 200, { ok: true });
    }

    if (p === '/api/pcs' && m === 'GET') {
      return json(res, 200, Object.entries(zugang.keys).map(([k, v]) => ({ id: k.slice(0, 8), pc: v.pc, at: v.at })));
    }

    return json(res, 404, { error: 'Unbekannter Aufruf' });
  }

  // ---------- Router ----------
  const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
    const p = decodeURIComponent(url.pathname);
    try {
      if (p.startsWith('/api/')) return await api(req, res, url);
      if (p.startsWith('/media/')) {
        const ziel = sicher(mediaDir, p.slice(7));
        return statisch(res, ziel || '/nix', req);
      }
      for (const [prefix, dir] of Object.entries(assetDirs)) {
        if (p.startsWith(prefix)) return statisch(res, sicher(dir, p.slice(prefix.length)) || '/nix', req);
      }
      if (p === '/' || p === '/tv' || p === '/index.html') return statisch(res, path.join(playerDir, 'index.html'), req);
      const ziel = sicher(playerDir, p.slice(1));
      return statisch(res, ziel || '/nix', req);
    } catch (e) {
      const code = e.code && Number.isInteger(e.code) ? e.code : 500;
      if (!res.headersSent) json(res, code, { error: e.message || 'Fehler' });
      else res.end();
    }
  });
  server.keepAliveTimeout = 65000;

  return {
    get pin() { return zugang.pin; },
    localKey,
    get state() { return state; },
    anwesenheit,
    listen(port, host) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host || '0.0.0.0', () => { server.off('error', reject); resolve(server.address().port); });
      });
    },
    async close() {
      clearInterval(pingTimer); clearInterval(aufraeumTimer);
      for (const res of clients.keys()) { try { res.end(); } catch (e) { /* egal */ } }
      clients.clear();
      await speichernJetzt().catch(() => {});
      await new Promise((r) => server.close(() => r()));
    },
    neuePin() {
      zugang.pin = String(crypto.randomInt(1000, 10000));
      fs.writeFileSync(secretFile, JSON.stringify(zugang, null, 2));
      return zugang.pin;
    }
  };
}

/** Alle IPv4-Adressen im lokalen Netz (für die Fernseher-Adresse). */
function lokaleAdressen() {
  const liste = [];
  for (const [name, netze] of Object.entries(os.networkInterfaces())) {
    for (const n of netze || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      if (/^169\.254\./.test(n.address)) continue;
      const virtuell = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|vpn|tailscale|zerotier/i.test(name);
      liste.push({ name, address: n.address, virtuell, privat: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address) });
    }
  }
  liste.sort((a, b) => (a.virtuell - b.virtuell) || (b.privat - a.privat) || (a.address.startsWith('192.168.') ? -1 : 1));
  return liste;
}

module.exports = { createServer, lokaleAdressen, planSauber, textSauber };
