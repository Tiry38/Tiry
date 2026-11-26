// Electron-Hauptprozess: Fenster, Tray, Autostart, IPC, Hintergrunddienst.
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, powerMonitor } from 'electron';
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

const DEMO = process.argv.includes('--demo');
const VERSTECKT = process.argv.includes('--hidden');
const LESETEST = process.argv.includes('--lesetest');
const SMOKE = process.env.AUFRAEUMER_SMOKE === '1';

if (process.env.AUFRAEUMER_DATA) app.setPath('userData', process.env.AUFRAEUMER_DATA);
const ORDNER = DEMO ? path.join(app.getPath('temp'), `email-aufraeumer-demo-${process.pid}`) : app.getPath('userData');

if (!SMOKE && !app.requestSingleInstanceLock()) app.quit();

let fenster: BrowserWindow | null = null;
let tray: Tray | null = null;
let beenden = false;
let dienst: Aufraeumer | null = null;
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
  for (const k of ['aktion', 'status', 'altbestand', 'frage']) dienst.on(k, (d) => { sende(k, d); if (k === 'status') aktualisiereTray(); });
  dienst.on('log', log);
  await dienst.starten();
}

function aktualisiereTray() {
  if (!tray) return;
  const s = dienst?.statusInfo();
  const text = !s ? 'Nicht angemeldet' : s.status === 'fehler' ? `Fehler: ${s.fehler}` : s.trockenlauf ? 'Trockenlauf' : 'Läuft';
  tray.setToolTip(`Email-Aufräumer – ${text}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Email-Aufräumer – ${text}`, enabled: false },
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
    title: 'Email-Aufräumer', icon: icon('icon.png'), autoHideMenuBar: true,
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
  fenster.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); // keine Links aus Inhalten öffnen
  fenster.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ---------------- IPC ----------------
type Fn = (...a: any[]) => unknown;
const API: Record<string, Fn> = {
  async zustand() {
    return {
      demo: DEMO, credentials: DEMO || anmeldung.hatCredentials(), angemeldet: DEMO || anmeldung.istAngemeldet(),
      status: dienst?.statusInfo() ?? null, statistik: db.statistik(), einstellungen: db.einstellungen(),
      altbestand: dienst?.altbestand ?? null, kontakte: db.anzahlKontakte(),
      ki: { schluessel: !!process.env.ANTHROPIC_API_KEY, ausgegebenEuro: kiBudget(() => db.get('kiVerbrauch', { ausgegebenUsd: 0, monat: '' }), () => {}, () => 0, () => db.einstellungen().kiUsdProEuro).ausgegebenEuro() },
      autostart: app.getLoginItemSettings().openAtLogin, kategorien: KATEGORIE_NAME,
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

  if (DEMO) {
    const demo = erzeugeDemo();
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
