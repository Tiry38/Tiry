'use strict';
/* Velo-TV – Fernseher nach Öffnungszeiten ein- und ausschalten (LG webOS über das Netzwerk, Bibliothek lgtv2).
   - Kopplung einmalig: am Fernseher erscheint eine Frage, mit OK „Zulassen“.
   - Einschalten: Wake-on-LAN (Fernseher-Einstellung „Wake on LAN“ / „Über WLAN einschalten“ muss an sein),
     danach öffnet Velo-TV am Fernseher den Browser mit dem Programm.
   - Mittagspause: auf Wunsch nur Bildschirm aus (Fernseher bleibt an → kommt sofort und sicher wieder).
   - Geschaltet wird nur beim Wechsel einer Zeitgrenze – schaltet jemand den Fernseher von Hand, wird nicht dagegen gearbeitet. */
const fs = require('fs');
const path = require('path');

const TAGE = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
// Öffnungszeiten Velocenter Hessert (Standard): Mo, Di, Do, Fr 9–12 & 14:30–18, Sa 9–12, Mi + So zu
const STANDARD = { 1: [['09:00', '12:00'], ['14:30', '18:00']], 2: [['09:00', '12:00'], ['14:30', '18:00']], 3: [], 4: [['09:00', '12:00'], ['14:30', '18:00']], 5: [['09:00', '12:00'], ['14:30', '18:00']], 6: [['09:00', '12:00']], 7: [] };

const min = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const wtag = (d) => (d.getDay() === 0 ? 7 : d.getDay());

function zeitenSauber(z) {
  const out = {};
  for (let t = 1; t <= 7; t++) {
    const l = Array.isArray(z && z[t]) ? z[t] : [];
    out[t] = l.map((r) => [String(r[0] || ''), String(r[1] || '')]).filter(([a, b]) => min(a) !== null && min(b) !== null && min(a) < min(b)).slice(0, 3)
      .sort((x, y) => min(x[0]) - min(y[0]));
  }
  return out;
}

/** Soll der Fernseher zum Zeitpunkt d an sein? */
function sollAn(zeiten, d) {
  const m = d.getHours() * 60 + d.getMinutes();
  return (zeiten[wtag(d)] || []).some(([a, b]) => m >= min(a) && m < min(b));
}

/** Soll an sein – Öffnungszeiten oder „länger an“ bis bisAn (ms) (Tiry 26.11.2026: Kunden nach 12 Uhr) */
function sollJetzt(zeiten, bisAn, d) {
  return sollAn(zeiten, d) || (bisAn > 0 && d.getTime() < bisAn);
}

/** Nächste Schaltzeit ab d: { zeit: Date, an: bool, mittag: bool } (mittag = heute geht es nochmal weiter) */
function naechsteAktion(zeiten, d) {
  for (let k = 0; k < 8; k++) {
    const tag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
    const fenster = zeiten[wtag(tag)] || [];
    for (let i = 0; i < fenster.length; i++) {
      for (const [hhmm, an] of [[fenster[i][0], true], [fenster[i][1], false]]) {
        const z = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), Math.floor(min(hhmm) / 60), min(hhmm) % 60);
        if (z > d) return { zeit: z, an, mittag: !an && i < fenster.length - 1 };
      }
    }
  }
  return null;
}

function beschreibe(n) {
  if (!n) return 'Keine Schaltzeit eingetragen';
  const heute = new Date(), morgen = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 1);
  const tag = n.zeit.toDateString() === heute.toDateString() ? 'heute' : n.zeit.toDateString() === morgen.toDateString() ? 'morgen' : TAGE[wtag(n.zeit)];
  const uhr = String(n.zeit.getHours()).padStart(2, '0') + ':' + String(n.zeit.getMinutes()).padStart(2, '0');
  return tag + ' ' + uhr + ' Uhr ' + (n.an ? 'einschalten' : (n.mittag ? 'Mittagspause' : 'ausschalten'));
}

function createTvSteuerung(opts) {
  const datei = path.join(opts.dataDir, 'tv-steuerung.json');
  let cfg = { an: false, host: '', clientKey: '', mittagBildschirm: true, zeiten: STANDARD, bisAn: 0 };
  try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(datei, 'utf8'))); } catch (e) { /* erster Start */ }
  cfg.zeiten = zeitenSauber(cfg.zeiten);
  const speichern = () => { try { fs.writeFileSync(datei, JSON.stringify(cfg, null, 1)); } catch (e) { /* egal */ } };

  const status = { verbunden: false, gekoppelt: !!cfg.clientKey, frage: false, zustand: '', letzte: '', fehler: '' };
  let tv = null, LGTV = null, bildschirmAus = false, zuletztSoll = null;
  const melden = () => opts.onStatus && opts.onStatus(info());
  const protokoll = (t) => { status.letzte = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' ' + t; melden(); if (opts.log) opts.log(t); };

  async function lib() { if (!LGTV) LGTV = (await import('lgtv2')).default; return LGTV; }

  async function verbinden() {
    if (tv || !cfg.host) return tv;
    const L = await lib();
    tv = new L({
      host: cfg.host, clientKey: cfg.clientKey || undefined, reconnect: 5000, timeout: 15000,
      keyFile: path.join(opts.dataDir, 'tv-key'), macFile: path.join(opts.dataDir, 'tv-mac.json'),
      saveKey: (key, cb) => { cfg.clientKey = key; status.gekoppelt = true; speichern(); melden(); if (cb) cb(); }
    });
    tv.on('prompt', () => { status.frage = true; status.fehler = ''; melden(); });
    tv.on('connect', () => {
      status.verbunden = true; status.frage = false; status.fehler = ''; status.gekoppelt = !!(cfg.clientKey || tv.clientKey);
      if (tv.clientKey && tv.clientKey !== cfg.clientKey) { cfg.clientKey = tv.clientKey; speichern(); }
      tv.request('ssap://com.webos.service.tvpower/power/getPowerState', (err, r) => { if (!err && r) { status.zustand = r.state || ''; bildschirmAus = r.state === 'Screen Off'; melden(); } });
      melden();
    });
    tv.on('close', () => { status.verbunden = false; melden(); });
    tv.on('error', (e) => { if (status.verbunden) return; status.fehler = e && e.code === 'ECONNFAILED' ? '' : (e && e.message) || ''; });
    return tv;
  }

  function anfrage(uri, payload) {
    return new Promise((res, rej) => {
      if (!tv || !status.verbunden) return rej(new Error('Fernseher nicht verbunden'));
      tv.request(uri, payload || {}, (err, r) => (err ? rej(err) : res(r)));
    });
  }
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));

  async function ausschalten(nurBildschirm) {
    await verbinden();
    if (!status.verbunden) throw new Error('Fernseher nicht erreichbar');
    if (nurBildschirm) {
      try { await anfrage('ssap://com.webos.service.tvpower/power/turnOffScreen', { standbyMode: 'active' }); bildschirmAus = true; protokoll('Bildschirm aus (Pause)'); return; }
      catch (e) { /* manche Geräte können das nicht → ganz aus */ }
    }
    await anfrage('ssap://system/turnOff');
    bildschirmAus = false;
    protokoll('Fernseher ausgeschaltet');
  }

  async function einschalten() {
    await verbinden();
    if (status.verbunden && bildschirmAus) {
      try { await anfrage('ssap://com.webos.service.tvpower/power/turnOnScreen', { standbyMode: 'active' }); bildschirmAus = false; protokoll('Bildschirm wieder an'); await programmOeffnen(); return; }
      catch (e) { /* weiter mit Aufwecken */ }
    }
    if (!status.verbunden) {
      // Wake-on-LAN, bis der Fernseher antwortet (max. 2 Minuten)
      for (let k = 0; k < 24 && !status.verbunden; k++) {
        try { await tv.wake(undefined, { count: 3 }); if (opts.broadcast) await tv.wake(undefined, { address: opts.broadcast(), count: 2 }); } catch (e) { throw new Error('Einschalten nicht möglich: ' + e.message); }
        await warte(5000);
      }
      if (!status.verbunden) throw new Error('Fernseher reagiert nicht – ist „Wake on LAN“ am Fernseher eingeschaltet?');
      await warte(6000); // webOS startet noch
    }
    protokoll('Fernseher eingeschaltet');
    await programmOeffnen();
  }

  async function programmOeffnen() {
    const url = opts.url && opts.url();
    if (!url) return;
    try { await anfrage('ssap://system.launcher/open', { target: url }); protokoll('Velo-TV im Browser geöffnet'); }
    catch (e) { status.fehler = 'Browser öffnen fehlgeschlagen: ' + e.message; melden(); }
  }

  async function takt() {
    if (!cfg.an || !cfg.host) { zuletztSoll = null; return; }
    const jetzt = new Date(), soll = sollJetzt(cfg.zeiten, cfg.bisAn, jetzt);
    if (cfg.bisAn && jetzt.getTime() >= cfg.bisAn) { cfg.bisAn = 0; speichern(); melden(); }
    if (zuletztSoll === null) { zuletztSoll = soll; return; } // beim Start nichts umschalten
    if (soll === zuletztSoll) return;
    zuletztSoll = soll;
    try {
      if (soll) await einschalten();
      else {
        const n = naechsteAktion(cfg.zeiten, jetzt);
        const pauseHeute = n && n.an && n.zeit.toDateString() === jetzt.toDateString();
        await ausschalten(cfg.mittagBildschirm && pauseHeute);
      }
    } catch (e) { status.fehler = e.message; protokoll('Fehler: ' + e.message); }
  }
  // Liegt „jetzt“ in einem Öffnungsfenster, zählt die Verlängerung ab dessen Ende (11:50 + 30 Min → 12:30)
  function ende(ms) {
    const d = new Date(ms), m = d.getHours() * 60 + d.getMinutes();
    const f = (cfg.zeiten[wtag(d)] || []).find(([a, b]) => m >= min(a) && m < min(b));
    return f ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min(f[1]) / 60), min(f[1]) % 60).getTime() : 0;
  }
  const timer = setInterval(() => takt().catch(() => {}), 20000);
  if (cfg.host && cfg.clientKey) verbinden().catch(() => {});

  function info() {
    return {
      an: cfg.an, host: cfg.host, mittagBildschirm: cfg.mittagBildschirm, zeiten: cfg.zeiten,
      status: Object.assign({}, status, { mac: tv ? tv.mac || '' : '' }),
      bisAn: cfg.bisAn > Date.now() ? cfg.bisAn : 0,
      naechste: !cfg.an ? 'Automatik aus' : cfg.bisAn > Date.now() && !sollAn(cfg.zeiten, new Date(cfg.bisAn))
        ? 'länger an bis ' + uhr(new Date(cfg.bisAn)) + ' Uhr, dann aus'
        : beschreibe(naechsteAktion(cfg.zeiten, new Date(Math.max(Date.now(), cfg.bisAn || 0))))
    };
  }

  const uhr = (z) => String(z.getHours()).padStart(2, '0') + ':' + String(z.getMinutes()).padStart(2, '0');

  return {
    info,
    /** Länger anlassen: min Minuten ab jetzt (bzw. ab laufender Verlängerung), 0 = Verlängerung beenden */
    async laenger(min) {
      min = Math.max(0, Math.min(600, Number(min) || 0));
      const jetzt = Date.now();
      cfg.bisAn = min ? Math.max(jetzt, cfg.bisAn || 0, ende(jetzt)) + min * 60000 : 0;
      speichern(); melden();
      await takt();
      return info();
    },
    async einstellen(b) {
      if ('an' in b) cfg.an = !!b.an;
      if ('mittagBildschirm' in b) cfg.mittagBildschirm = !!b.mittagBildschirm;
      if ('zeiten' in b) cfg.zeiten = zeitenSauber(b.zeiten);
      if ('host' in b && /^[\d.]{7,15}$/.test(String(b.host || '')) && b.host !== cfg.host) {
        cfg.host = b.host;
        if (tv) { try { await tv.disconnect(); } catch (e) { /* egal */ } tv = null; status.verbunden = false; }
      }
      zuletztSoll = null;
      speichern(); melden();
      return info();
    },
    async koppeln(host) {
      if (host && host !== cfg.host) await this.einstellen({ host });
      if (!cfg.host) throw new Error('Fernseher-Adresse unbekannt – öffnet der Fernseher Velo-TV schon im Browser?');
      await verbinden();
      return info();
    },
    einschalten, ausschalten,
    stop() { clearInterval(timer); if (tv) try { tv.disconnect(); } catch (e) { /* egal */ } }
  };
}

module.exports = { createTvSteuerung, sollAn, sollJetzt, naechsteAktion, zeitenSauber, STANDARD };
