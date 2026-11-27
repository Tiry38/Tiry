// Electron-Hauptprozess: Fenster, Tray, Autostart, IPC, Hintergrunddienst.
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, powerMonitor, protocol, shell, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { Speicher } from '../core/db';
import { Aufraeumer } from '../core/service';
import { erzeugeGoogleGmail, type GmailPort } from '../core/gmail';
import { erzeugeClaudeKi, kiBudget } from '../core/ai';
import { ordneEin } from '../core/pipeline';
import { KATEGORIE_NAME } from '../core/types';
import { Anmeldung } from './auth';
import { erzeugeDemo } from './demo';
import { Postfach } from '../core/postfach';
import { textZuHtml } from '../core/mime';
import { grosseDateiHochladen, DRIVE_SCOPE } from './drive';
import { vorlageHtml } from '../core/vorlage';
import { starteUpdater } from './update';
/** Live-Vorschau der gestalteten Mail beim Schreiben. */
let vorschauHtml = '';

/** Bis zu dieser Summe gehen Dateien als normaler Anhang mit (Gmail-Grenze 25 MB, Base64 macht ~33 % größer). */
const ANHANG_GRENZE = 18 * 1024 * 1024;
/** Nur Dateien, die Tiry selbst im Datei-Dialog gewählt hat, dürfen verschickt werden. */
const erlaubtePfade = new Set<string>();

const NAME = "Tiry's Mails";
// Eigenes Protokoll für die abgeschottete Anzeige von Mail-Inhalten (eigene CSP je Antwort)
protocol.registerSchemesAsPrivileged([{ scheme: 'tmail', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const DEMO = process.argv.includes('--demo');
// Nach einem stillen Update (PC war unbenutzt) wieder unsichtbar im Tray starten
const STILL_MARKE = path.join(app.getPath('appData'), 'Email-Aufräumer', 'nach-update-still');
const VERSTECKT = process.argv.includes('--hidden') || (() => { try { fs.unlinkSync(STILL_MARKE); return true; } catch { return false; } })();
const LESETEST = process.argv.includes('--lesetest');
const SMOKE = process.env.AUFRAEUMER_SMOKE === '1';

// Daten bleiben im bisherigen Ordner (Anmeldung, Verlauf, Regeln) – auch nach der Umbenennung in „Tiry's Mails“
if (process.env.AUFRAEUMER_DATA) app.setPath('userData', process.env.AUFRAEUMER_DATA);
else app.setPath('userData', path.join(app.getPath('appData'), 'Email-Aufräumer'));
const ORDNER = DEMO ? path.join(app.getPath('temp'), `email-aufraeumer-demo-${process.pid}`) : app.getPath('userData');

if (!SMOKE && !app.requestSingleInstanceLock()) app.quit();

let fenster: BrowserWindow | null = null;
let tray: Tray | null = null;
let beenden = false;
let dienst: Aufraeumer | null = null;
let updater: ReturnType<typeof starteUpdater> | null = null;
let postfach: Postfach | null = null;
/** Zuletzt geöffnete Mails für die Anzeige über tmail:// (id → HTML + Anhänge). */
const anzeige = new Map<string, { html: string; cids: Record<string, string> }>();
let db: Speicher;
const anmeldung = new Anmeldung(ORDNER);
const logZeilen: string[] = [];

function sende(kanal: string, daten: unknown) {
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('ereignis', kanal, daten);
}

function log(s: string) {
  logZeilen.push(s); if (logZeilen.length > 500) logZeilen.shift();
  try { fs.appendFileSync(path.join(ORDNER, 'aufraeumer.log'), s + '\n'); } catch { /* egal */ }
  sende('log', s);
}

function icon(name: string) {
  const p = path.join(__dirname, '..', '..', 'assets', name);
  return fs.existsSync(p) ? nativeImage.createFromPath(p) : nativeImage.createEmpty();
}

function gmailErzeugen(): GmailPort | null {
  if (DEMO) return null;
  if (!anmeldung.istAngemeldet()) return null;
  return erzeugeGoogleGmail(anmeldung.client_(), (m, e) => db.quoteZaehlen(m, e), log);
}

async function dienstStarten(gmail: GmailPort) {
  dienst?.stoppen();
  dienst = new Aufraeumer({ gmail, db, ki: erzeugeClaudeKi() });
  const d = dienst;
  postfach = new Postfach(gmail, (id) => (db.db.prepare('SELECT kategorie FROM protokoll WHERE mail_id = ? ORDER BY id DESC LIMIT 1').get(id) as any)?.kategorie ?? null, () => d.email || 'ich');
  for (const k of ['aktion', 'status', 'altbestand', 'frage', 'postfach', 'entruempeln']) dienst.on(k, (d) => { sende(k, d); if (k === 'status') aktualisiereTray(); });
  dienst.on('log', log);
  await dienst.starten();
}

function aktualisiereTray() {
  if (!tray) return;
  const s = dienst?.statusInfo();
  const text = !s ? 'Nicht angemeldet' : s.status === 'fehler' ? `Fehler: ${s.fehler}` : s.trockenlauf ? 'Trockenlauf' : 'Läuft';
  tray.setToolTip(`${NAME} – ${text}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `${NAME} – ${text}`, enabled: false },
    { type: 'separator' },
    { label: 'Öffnen', click: zeigeFenster },
    { label: 'Jetzt prüfen', enabled: !!dienst, click: () => void dienst?.tick() },
    { type: 'separator' },
    { label: 'Beenden', click: () => { beenden = true; app.quit(); } },
  ]));
}

function zeigeFenster() {
  if (!fenster) erzeugeFenster();
  fenster!.show(); fenster!.focus();
}

function erzeugeFenster() {
  fenster = new BrowserWindow({
    width: 1440, height: 920, minWidth: 380, minHeight: 600, show: false, backgroundColor: '#14161a',
    title: NAME, icon: icon('icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: true },
  });
  fenster.setMenu(null);
  fenster.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  fenster.once('ready-to-show', () => { if (!VERSTECKT) fenster!.show(); });
  // Schließen = in den Tray, Programm arbeitet weiter
  fenster.on('close', (e) => { if (!beenden && !SMOKE) { e.preventDefault(); fenster!.hide(); } });
  for (const ev of ['minimize', 'hide', 'restore', 'show'] as const) {
    fenster.on(ev as any, () => sende('sichtbar', !(fenster!.isMinimized() || !fenster!.isVisible())));
  }
  // Links aus Mails: nie im Programm öffnen. http(s) → normaler Browser, mailto → eigenes Schreibfenster.
  fenster.webContents.setWindowOpenHandler(({ url }) => { linkOeffnen(url); return { action: 'deny' }; });
  fenster.webContents.on('will-navigate', (e) => e.preventDefault());
  fenster.webContents.on('will-frame-navigate', (e: any) => {
    if (e.isMainFrame) return;
    if (String(e.url).startsWith('tmail:')) return;
    e.preventDefault(); linkOeffnen(e.url);
  });
}

// ---------------- IPC ----------------
type Fn = (...a: any[]) => unknown;
function linkOeffnen(url: string) {
  if (/^mailto:/i.test(url)) { sende('mailto', url); return; }
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

/** Baut das sichere Anzeige-Dokument einer Mail. */
function mailDokument(id: string, bilder: boolean, sperre: boolean): string {
  const a = anzeige.get(id);
  let html = a?.html ?? '<p>Mail nicht geladen.</p>';
  // eingebettete Bilder (cid:) aus den Anhängen
  html = html.replace(/(["'(])cid:([^"')\s>]+)/gi, (m, q, cid) => (a?.cids[cid] ? `${q}${a.cids[cid]}` : m));
  if (sperre) html = html.replace(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' data-gesperrt="1"');
  const csp = `default-src 'none'; style-src 'unsafe-inline' data:; font-src data:; img-src data: tmail:${bilder ? ' https: http:' : ''}; media-src 'none'; frame-src 'none'; form-action 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
<style>html{background:#fff;color:#16181c}body{margin:22px 26px;font:15px/1.55 system-ui,'Segoe UI',sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#0b57d0}[data-gesperrt]{color:#888;text-decoration:line-through;pointer-events:none}</style></head><body>${html}</body></html>`;
}

const API: Record<string, Fn> = {
  updateStand: () => updater?.stand() ?? { stand: 'aus', version: app.getVersion() },
  updateJetzt: () => updater?.jetzt(),
  updateSuchen: () => updater?.suchen(),
  async zustand() {
    return {
      demo: DEMO, credentials: DEMO || anmeldung.hatCredentials(), angemeldet: DEMO || anmeldung.istAngemeldet(),
      status: dienst?.statusInfo() ?? null, statistik: db.statistik(), einstellungen: db.einstellungen(),
      altbestand: dienst?.altbestand ?? null, entruempeln: dienst?.entruempeln ?? null, entruempelnRueck: !!db.get('entruempelnLetzter', null), autoFilter: dienst?.autoFilterAnzahl() ?? 0, kontakte: db.anzahlKontakte(),
      ki: { schluessel: !!process.env.ANTHROPIC_API_KEY, ausgegebenEuro: kiBudget(() => db.get('kiVerbrauch', { ausgegebenUsd: 0, monat: '' }), () => {}, () => 0, () => db.einstellungen().kiUsdProEuro).ausgegebenEuro() },
      autostart: app.getLoginItemSettings().openAtLogin, kategorien: KATEGORIE_NAME, drive: DEMO || anmeldung.hatScope(DRIVE_SCOPE),
    };
  },
  protokoll: (f) => db.protokoll(f ?? {}),
  zuPruefen: () => db.zuPruefen(),
  entscheide: (id, wahl) => dienst!.entscheide(id, wahl),
  absender: () => db.topAbsender(60),
  absenderAktion: (a, akt) => dienst!.absenderAktion(a, akt),
  regeln: () => ({ regeln: db.regeln(), kandidaten: dienst?.filterKandidaten().map((r) => r.id) ?? [] }),
  regelSchalten: (id, an) => dienst!.regelSchalten(id, an),
  regelLoeschen: (id) => dienst!.regelLoeschen(id),
  regelAnlegen: async (art, feld, wert, kat) => { db.regelMerken(art, feld, wert, kat ?? null); await dienst?.filterExport(); },
  speichereEinstellungen: (teil) => {
    const neu = db.speichereEinstellungen(teil);
    if ('autostart' in teil && !DEMO && app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!teil.autostart, args: ['--hidden'] });
    if ('intervallSek' in teil) dienst?.neuPlanen();
    return neu;
  },
  scharfSchalten: () => dienst!.scharfSchalten(),
  trockenlaufWieder: () => dienst!.trockenlaufWieder(),
  entruempelnVorschau: () => dienst!.entruempelnVorschau(),
  entruempelnStarten: () => dienst!.entruempelnStarten(),
  entruempelnRueckgaengig: () => dienst!.entruempelnRueckgaengig(),
  autoFilterAus: async () => dienst?.autoFilterEntfernen() ?? 0,
  filterFreigeben: async () => { db.speichereEinstellungen({ filterExportFreigegeben: true }); return dienst!.filterExport(); },
  rueckgaengig: (id) => dienst!.rueckgaengig(id),
  durchlaufRueckgaengig: (lauf) => dienst!.durchlaufRueckgaengig(lauf),
  altbestandVorschau: () => dienst!.altbestandVorschau(),
  altbestandStarten: () => dienst!.altbestandStarten(),
  jetztPruefen: () => dienst!.tick(),
  log: () => logZeilen.slice(-200),
  async credentialsWaehlen() {
    const r = await dialog.showOpenDialog(fenster!, { title: 'credentials.json auswählen', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return false;
    anmeldung.credentialsUebernehmen(r.filePaths[0]);
    return true;
  },
  // ---------------- Tiry's Mails: Postfach ----------------
  pfOrdner: () => postfach!.ordner(),
  pfListe: (ordner, suche, token) => postfach!.liste(ordner, suche ?? '', token ?? undefined),
  async pfLesen(id) {
    const m = await postfach!.lesen(id);
    const cids: Record<string, string> = {};
    for (const an of m.anhaenge) if (an.cid && an.anhangId) cids[an.cid] = `tmail://anhang/${encodeURIComponent(id)}/${encodeURIComponent(an.anhangId)}?mime=${encodeURIComponent(an.mime)}`;
    anzeige.set(id, { html: m.html ?? textZuHtml(m.text ?? ''), cids });
    if (anzeige.size > 30) anzeige.delete(anzeige.keys().next().value!);
    const fern = /<img[^>]+src\s*=\s*["']?https?:/i.test(m.html ?? '') || /url\(\s*["']?https?:/i.test(m.html ?? '');
    return { ...m, html: undefined, text: undefined, fernBilder: fern, bilderAuto: db.einstellungen().bilderAuto !== false, anzeigeUrl: `tmail://mail/${encodeURIComponent(id)}` };
  },
  pfVorlage: (id, art) => postfach!.vorlage(id, art),
  async pfSenden(e) {
    const dateien: Array<{ name: string; mime: string; groesse: number; pfad: string }> = (e.anhaenge ?? []).filter((a: any) => erlaubtePfade.has(a.pfad));
    // kleinste zuerst als Anhang, bis die Grenze erreicht ist; der Rest über Google Drive
    const sortiert = [...dateien].sort((a, b) => a.groesse - b.groesse);
    const anhang: typeof dateien = [], gross: typeof dateien = [];
    let summe = 0;
    for (const d of sortiert) { if (summe + d.groesse <= ANHANG_GRENZE) { anhang.push(d); summe += d.groesse; } else gross.push(d); }
    const links: Array<{ name: string; groesse: number; link: string }> = [];
    if (gross.length) {
      if (DEMO) gross.forEach((d) => links.push({ name: d.name, groesse: d.groesse, link: `https://drive.google.com/file/d/demo-${encodeURIComponent(d.name)}/view` }));
      else {
        if (!anmeldung.hatScope(DRIVE_SCOPE)) throw new Error('Große Dateien gehen über Google Drive. Dafür einmal neu anmelden: Einstellungen → Konto → „Neu anmelden“ (und in Google Cloud die Drive-API einschalten, siehe Anleitung).');
        for (const d of gross) {
          const r = await grosseDateiHochladen(anmeldung.client_(), d, (p) => sende('senden', `„${d.name}“ wird hochgeladen … ${p} %`));
          links.push({ name: d.name, groesse: d.groesse, link: r.link });
        }
      }
    }
    const mb = (n: number) => `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB`;
    const text = links.length ? `${e.text}\n\n— Große Dateien zum Herunterladen —\n${links.map((l) => `${l.name} (${mb(l.groesse)}): ${l.link}`).join('\n')}` : e.text;
    sende('senden', 'Wird gesendet …');
    await postfach!.senden({ ...e, text, links, anhaenge: anhang.map((d) => ({ name: d.name, mime: d.mime, daten: new Uint8Array(fs.readFileSync(d.pfad)) })) });
    for (const d of dateien) erlaubtePfade.delete(d.pfad);
    return { anhaenge: anhang.length, links: links.length };
  },
  pfAktion: (ids, a) => postfach!.aktion(ids, a),
  pfRueckgaengig: () => postfach!.rueckgaengig(),
  pfOrdnerAnlegen: (name) => postfach!.ordnerAnlegen(name),
  async pfAnhangSpeichern(mailId, anhang) {
    const r = await dialog.showSaveDialog(fenster!, { defaultPath: path.join(app.getPath('downloads'), anhang.name) });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, await postfach!.anhang(mailId, anhang));
    shell.showItemInFolder(r.filePath);
    return true;
  },
  async pfAnhangWaehlen() {
    const r = await dialog.showOpenDialog(fenster!, { title: 'Anhänge auswählen', properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    return r.filePaths.map((p) => {
      erlaubtePfade.add(p);
      return { name: path.basename(p), mime: mimeVon(p), groesse: fs.statSync(p).size, pfad: p };
    });
  },
  ordnerListe: () => dienst?.ordnerListe() ?? [],
  ordnerSchalten: (basis, an) => dienst?.ordnerSchalten(basis, an),
  driveBereit: () => DEMO || anmeldung.hatScope(DRIVE_SCOPE),
  /** Live-Prüfung für den Drive-Assistenten: Berechtigung da? Drive-API im Google-Projekt an? */
  async driveTest() {
    if (DEMO) return { ok: true };
    if (!anmeldung.hatScope(DRIVE_SCOPE)) return { ok: false, schritt: 2, grund: 'Die Anmeldung hat noch keine Drive-Berechtigung.' };
    try {
      const { google } = require('googleapis') as typeof import('googleapis');
      await google.drive({ version: 'v3', auth: anmeldung.client_() }).files.list({ pageSize: 1, fields: 'files(id)' });
      return { ok: true };
    } catch (e: any) {
      const t = String(e?.message ?? e);
      if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(t)) return { ok: false, schritt: 1, grund: 'Die Drive-API ist im Google-Projekt noch nicht eingeschaltet.' };
      return { ok: false, schritt: 0, grund: t };
    }
  },
  pfVorschau(e) {
    vorschauHtml = vorlageHtml({ betreff: e.betreff ?? '', text: e.text ?? '', vonName: e.vonName ?? 'Tiry',
      anhaenge: (e.anhaenge ?? []).map((a: any) => ({ name: a.name, groesse: a.groesse })),
      links: (e.anhaenge ?? []).filter((a: any) => a.gross).map((a: any) => ({ name: a.name, groesse: a.groesse, link: '#' })) });
    return `tmail://vorschau/${Date.now()}`;
  },
  async anmelden() {
    await anmeldung.anmelden();
    const g = gmailErzeugen();
    if (g) await dienstStarten(g);
    return true;
  },
};

ipcMain.handle('rufe', async (_e, name: string, ...args: unknown[]) => {
  const f = API[name];
  if (!f) throw new Error(`Unbekannter Aufruf ${name}`);
  return f(...args);
});

/** Phase 1: die letzten 50 Mails nur lesen und einordnen – nichts wird verändert. */
async function lesetest(gmail: GmailPort) {
  const { ids } = await gmail.liste('in:inbox', undefined, 50);
  const mails = await gmail.holeMetadaten(ids);
  const e = db.einstellungen();
  console.log(`\nLesetest – ${mails.length} Mails (nur lesen):`);
  for (const m of mails) {
    const r = await ordneEin(m, { einstellungen: { ...e, kiAn: false }, regeln: db.regeln(), istKontakt: (a) => db.istKontakt(a), historie: () => null });
    console.log(`${KATEGORIE_NAME[r.entscheidung.kategorie].padEnd(16)} ${String(r.entscheidung.sicherheit).padStart(3)} %  ${r.signale.absender.padEnd(40)} ${r.signale.betreff.slice(0, 60)}`);
  }
  console.log(`Quote: ${JSON.stringify(db.quoteHeute())}`);
}

app.whenReady().then(async () => {
  // Rechtschreibprüfung auf Deutsch
  try { session.defaultSession.setSpellCheckerLanguages(['de-DE']); } catch { /* Linux ohne Wörterbuch */ }
  fs.mkdirSync(ORDNER, { recursive: true });
  db = new Speicher(path.join(ORDNER, 'aufraeumer.db'));
  if (process.platform === 'win32') app.setAppUserModelId('de.tiry.email-aufraeumer');

  // Autostart beim ersten Start einschalten (Einstellung kann es abschalten)
  if (!DEMO && app.isPackaged && db.einstellungen().autostart && !app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  }

  if (LESETEST) {
    const g = gmailErzeugen();
    if (!g) { console.error('Nicht angemeldet. Erst das Programm normal starten und anmelden.'); app.exit(1); return; }
    try { await lesetest(g); app.exit(0); } catch (err) { console.error(err); app.exit(1); }
    return;
  }

  tray = new Tray(icon('tray.png'));
  tray.on('click', zeigeFenster);
  aktualisiereTray();
  erzeugeFenster();
  if (!DEMO && !SMOKE) updater = starteUpdater({
    melde: (s) => sende('update', s), log,
    fensterSichtbar: () => !!fenster && !fenster.isDestroyed() && fenster.isVisible(),
    // nie still neu starten, während das alte Postfach aufgeräumt wird
    beschaeftigt: () => ['vorschau', 'laeuft'].includes(dienst?.altbestand?.phase ?? ''),
    vorBeenden: (still) => { beenden = true; dienst?.stoppen(); if (still) try { fs.writeFileSync(STILL_MARKE, '1'); } catch { /* egal */ } },
  });

  if (DEMO) {
    const demo = erzeugeDemo();
    demoInhalte(demo.gmail);
    db.regelMerken('schwarz', 'adresse', 'win@bitprofit.top', 'spam');
    db.regelMerken('weiss', 'domain', 'veloport.de', null);
    db.regelMerken('gelernt', 'adresse', 'werbung@weko.de', 'werbung'); db.regelMerken('gelernt', 'adresse', 'werbung@weko.de', 'werbung');
    await dienstStarten(demo.gmail);
    for (let i = 0; i < 24; i++) demo.tropfen();
    await dienst!.tick();
    // Weitere Mails tröpfeln alle paar Sekunden herein, der Dienst holt sie wie im echten Betrieb ab
    setInterval(() => { demo.tropfen(); void dienst!.tick(); }, SMOKE ? 1500 : 6000).unref();
  } else {
    const g = gmailErzeugen();
    if (g) void dienstStarten(g);
  }

  // Nach Standby sofort nachholen
  powerMonitor.on('resume', () => void dienst?.tick());
});

app.on('window-all-closed', () => { /* im Tray weiterlaufen */ });
app.on('second-instance', zeigeFenster);
app.on('before-quit', () => { beenden = true; dienst?.stoppen(); });

function mimeVon(p: string): string {
  const e = path.extname(p).toLowerCase();
  return ({ '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.txt': 'text/plain',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip', '.mp4': 'video/mp4' } as Record<string, string>)[e] ?? 'application/octet-stream';
}

/** Demo: ein paar Mails mit echtem Inhalt, damit die Leseansicht etwas zeigt. */
function demoInhalte(g: any) {
  for (const [id, m] of g.mails as Map<string, any>) {
    const betreff = m.headers.subject ?? '';
    if (/Bestellung|Paket|Rechnung|Black Week|Sonntag/i.test(betreff)) {
      g.inhalte.set(id, { html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f3efe6;padding:24px"><h1 style="font:700 24px system-ui;margin:0 0 8px">${betreff}</h1>
        <p>Hallo Tiry,</p><p>${m.snippet || 'hier ist deine Nachricht.'}</p><p><a href="https://example.com">Mehr erfahren</a></p>
        <img src="https://example.com/tracker.png" width="1" height="1"></td></tr></table>` });
    }
  }
}

app.whenReady().then(() => {
  protocol.handle('tmail', async (req) => {
    const u = new URL(req.url);
    const sicher = { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' data:; font-src data:; img-src data: tmail: https: http:", 'X-Content-Type-Options': 'nosniff' };
    if (u.host === 'mail') {
      const id = decodeURIComponent(u.pathname.slice(1));
      return new Response(mailDokument(id, u.searchParams.get('bilder') === '1', u.searchParams.get('sperre') === '1'), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...sicher } });
    }
    if (u.host === 'vorschau') {
      return new Response(vorschauHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:" } });
    }
    if (u.host === 'anhang' && postfach) {
      const [, mailId, anhangId] = u.pathname.split('/').map(decodeURIComponent);
      const mime = u.searchParams.get('mime') ?? 'application/octet-stream';
      if (!/^image\//.test(mime)) return new Response('', { status: 403 });
      return new Response(Buffer.from(await postfach.anhang(mailId, { anhangId })), { headers: { 'Content-Type': mime, ...sicher } });
    }
    return new Response('', { status: 404 });
  });
});
