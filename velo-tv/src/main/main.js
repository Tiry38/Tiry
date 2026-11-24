'use strict';
/* Velo-TV – Electron-Hauptprozess.
   Modus „Zentrale“ (Kassen-PC): startet den Server, ruft sich im Netz aus, läuft im Hintergrund weiter.
   Modus „Bedienplatz“ (Büro-PCs): findet die Zentrale automatisch und koppelt sich per PIN. */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, powerSaveBlocker, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { createServer, lokaleAdressen } = require('../server/server');
const { startBeacon, startListener } = require('../server/discovery');

const PORT = 8833;
const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const TRAY = path.join(ROOT, '..', 'build', 'tray.png');
const SMOKE = process.argv.includes('--smoke');

app.commandLine.appendSwitch('lang', 'de-DE'); // deutsches Datums-/Zeitformat in Eingabefeldern
if (process.env.VELOTV_DATA_DIR) app.setPath('userData', process.env.VELOTV_DATA_DIR);
if (!SMOKE && !app.requestSingleInstanceLock()) { app.quit(); }

const cfgFile = () => path.join(app.getPath('userData'), 'velotv-config.json');
let cfg = {};
function ladeCfg() { try { cfg = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch (e) { cfg = {}; } }
function speichereCfg() { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); }

let win = null, tray = null, server = null, stopBeacon = null, stopListen = null, psbId = null;
let beendet = false;
const gefunden = new Map();

// ---------- Zentrale ----------
async function starteZentrale() {
  if (server) return;
  server = createServer({
    dataDir: path.join(app.getPath('userData'), 'zentrale'),
    playerDir: path.join(ROOT, 'player'),
    assetDirs: { '/assets/': path.join(ROOT, 'renderer', 'assets'), '/shared/': path.join(ROOT, 'shared') },
    version: app.getVersion()
  });
  try {
    await server.listen(PORT);
  } catch (e) {
    server = null;
    throw new Error(e.code === 'EADDRINUSE'
      ? 'Port ' + PORT + ' ist belegt – läuft Velo-TV schon in einem anderen Fenster?'
      : 'Server konnte nicht starten: ' + e.message);
  }
  stopBeacon = startBeacon(() => ({ port: PORT, name: cfg.pcName || os.hostname(), version: app.getVersion() }));
  psbId = powerSaveBlocker.start('prevent-app-suspension'); // Kassen-PC darf nicht schlafen, sonst steht der TV
}

async function stoppeZentrale() {
  if (stopBeacon) { stopBeacon(); stopBeacon = null; }
  if (psbId !== null) { powerSaveBlocker.stop(psbId); psbId = null; }
  if (server) { await server.close(); server = null; }
}

function starteSuche() {
  if (stopListen) return;
  stopListen = startListener((z) => {
    gefunden.set(z.host + ':' + z.port, z);
    // Zentrale hat eine neue IP bekommen (Router) → Bedienplatz zieht automatisch nach
    if (cfg.mode === 'bedienplatz' && cfg.zentrale && cfg.zentrale.name === z.name && cfg.zentrale.host !== z.host) {
      cfg.zentrale.host = z.host; speichereCfg();
      if (win && !win.isDestroyed()) win.webContents.send('zentrale-umgezogen', verbindungsInfo());
    }
    if (win && !win.isDestroyed()) win.webContents.send('discovery', [...gefunden.values()]);
  });
}

// ---------- Fenster ----------
function erstelleFenster() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 680,
    title: 'Velo-TV', icon: ICON, backgroundColor: '#FAF7F4', show: false,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.on('close', (e) => {
    if (!beendet && cfg.mode === 'zentrale' && !SMOKE) {
      e.preventDefault();
      win.hide();
      if (tray && !cfg.trayHinweis) {
        tray.displayBalloon && tray.displayBalloon({ title: 'Velo-TV läuft weiter', content: 'Der Fernseher wird weiter beliefert. Beenden über das Symbol unten rechts.' });
        cfg.trayHinweis = true; speichereCfg();
      }
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function erstelleTray() {
  if (tray || SMOKE) return;
  try {
    tray = new Tray(nativeImage.createFromPath(TRAY).resize({ width: 16, height: 16, quality: 'best' }));
    tray.setToolTip('Velo-TV');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Velo-TV öffnen', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'Beenden (Fernseher bekommt keine Inhalte mehr)', click: () => { beendet = true; app.quit(); } }
    ]));
    tray.on('click', () => { win.show(); win.focus(); });
  } catch (e) { /* kein Tray verfügbar */ }
}

// ---------- IPC ----------
function verbindungsInfo() {
  if (cfg.mode === 'zentrale' && server) {
    return { mode: 'zentrale', base: 'http://127.0.0.1:' + PORT, key: server.localKey, pin: server.pin, port: PORT, adressen: lokaleAdressen() };
  }
  if (cfg.mode === 'bedienplatz' && cfg.zentrale) {
    return { mode: 'bedienplatz', base: 'http://' + cfg.zentrale.host + ':' + cfg.zentrale.port, key: cfg.key, zentrale: cfg.zentrale, port: cfg.zentrale.port };
  }
  return { mode: null };
}

ipcMain.handle('info', () => Object.assign(verbindungsInfo(), {
  pcName: cfg.pcName || os.hostname(), version: app.getVersion(), autostart: app.getLoginItemSettings().openAtLogin,
  platform: process.platform, gefunden: [...gefunden.values()]
}));

ipcMain.handle('setup', async (_e, opts) => {
  cfg.pcName = String(opts.pcName || os.hostname()).slice(0, 40);
  if (opts.mode === 'zentrale') {
    cfg.mode = 'zentrale'; delete cfg.zentrale; delete cfg.key;
    speichereCfg();
    if (stopListen) { stopListen(); stopListen = null; }
    await starteZentrale();
    if (process.platform === 'win32' && opts.autostart !== false) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    erstelleTray();
  } else if (opts.mode === 'bedienplatz') {
    // Kopplung mit PIN an der Zentrale
    const base = 'http://' + opts.host + ':' + (opts.port || PORT);
    let r;
    try {
      r = await fetch(base + '/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: opts.pin, pc: cfg.pcName }), signal: AbortSignal.timeout(6000) });
    } catch (e) { throw new Error('Zentrale nicht erreichbar unter ' + opts.host + '. Läuft Velo-TV am Kassen-PC?'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Kopplung fehlgeschlagen');
    await stoppeZentrale();
    cfg.mode = 'bedienplatz'; cfg.zentrale = { host: opts.host, port: Number(opts.port || PORT), name: opts.name || opts.host }; cfg.key = d.key;
    speichereCfg();
  } else {
    await stoppeZentrale();
    cfg = { pcName: cfg.pcName }; speichereCfg();
    starteSuche();
  }
  return verbindungsInfo();
});

ipcMain.handle('set-pc-name', (_e, name) => { cfg.pcName = String(name || '').slice(0, 40) || os.hostname(); speichereCfg(); return cfg.pcName; });
ipcMain.handle('set-autostart', (_e, an) => { app.setLoginItemSettings({ openAtLogin: !!an, args: ['--hidden'] }); return app.getLoginItemSettings().openAtLogin; });
ipcMain.handle('neue-pin', () => (server ? server.neuePin() : null));
ipcMain.handle('zentrale-adresse', (_e, host) => { if (cfg.zentrale) { cfg.zentrale.host = String(host); speichereCfg(); } return verbindungsInfo(); });
ipcMain.handle('open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

// Windows-Firewall: eingehende Verbindungen für Port 8833 (TV) und 8834 (Suche) im privaten Netz erlauben
ipcMain.handle('firewall', () => new Promise((resolve) => {
  if (process.platform !== 'win32') return resolve({ ok: false, error: 'Nur unter Windows nötig' });
  const regeln = [
    `netsh advfirewall firewall delete rule name="Velo-TV"`,
    `netsh advfirewall firewall add rule name="Velo-TV" dir=in action=allow protocol=TCP localport=${PORT} profile=private,domain`,
    `netsh advfirewall firewall add rule name="Velo-TV" dir=in action=allow protocol=UDP localport=8834 profile=private,domain`
  ].join(' & ');
  const ps = `Start-Process cmd -ArgumentList '/c ${regeln.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait`;
  execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }, (err) => resolve(err ? { ok: false, error: 'Abgebrochen oder keine Admin-Rechte' } : { ok: true }));
}));

// PowerPoint → PDF (über installiertes PowerPoint, sonst LibreOffice)
ipcMain.handle('pptx-zu-pdf', async (_e, datei) => {
  if (!datei || !fs.existsSync(datei)) throw new Error('Datei nicht gefunden');
  const ziel = path.join(os.tmpdir(), 'velotv-' + Date.now() + '.pdf');
  const versuch = (cmd, args) => new Promise((res) => execFile(cmd, args, { windowsHide: true, timeout: 180000 }, (err) => res(!err && fs.existsSync(ziel))));
  if (process.platform === 'win32') {
    const q = (s) => s.replace(/'/g, "''");
    const ps = `$ErrorActionPreference='Stop'; $pp = New-Object -ComObject PowerPoint.Application; ` +
      `$p = $pp.Presentations.Open('${q(datei)}', $true, $false, $false); $p.SaveAs('${q(ziel)}', 32); $p.Close(); $pp.Quit()`;
    if (await versuch('powershell.exe', ['-NoProfile', '-Command', ps])) return fs.readFileSync(ziel);
  }
  const soffice = process.platform === 'win32'
    ? ['C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'].find((p) => fs.existsSync(p))
    : 'soffice';
  if (soffice && await versuch(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', path.dirname(ziel), datei])) {
    // LibreOffice behält den Dateinamen
    const lo = path.join(path.dirname(ziel), path.basename(datei).replace(/\.[^.]+$/, '') + '.pdf');
    if (fs.existsSync(lo)) return fs.readFileSync(lo);
  }
  const lo2 = path.join(path.dirname(ziel), path.basename(datei).replace(/\.[^.]+$/, '') + '.pdf');
  if (fs.existsSync(lo2)) return fs.readFileSync(lo2);
  throw new Error('PowerPoint ist auf diesem PC nicht installiert. Bitte die Präsentation in PowerPoint über „Exportieren“ als PDF oder Video speichern und das hineinziehen.');
});

// ---------- Auto-Update (eigener Release-Kanal im Repo Tiry) ----------
function autoUpdate() {
  if (!app.isPackaged || SMOKE) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.setFeedURL({ provider: 'generic', url: 'https://github.com/Tiry38/Tiry/releases/download/velo-tv-latest' });
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', () => { if (win) win.webContents.send('update-bereit'); });
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600 * 1000);
  } catch (e) { /* ohne Updater weiter */ }
}
ipcMain.handle('update-installieren', () => { try { beendet = true; require('electron-updater').autoUpdater.quitAndInstall(true, true); } catch (e) { /* egal */ } });

// ---------- Start ----------
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.on('before-quit', () => { beendet = true; });
app.on('window-all-closed', () => { if (cfg.mode !== 'zentrale' || SMOKE) app.quit(); });

app.whenReady().then(async () => {
  ladeCfg();
  Menu.setApplicationMenu(null);
  if (cfg.mode === 'zentrale') {
    try { await starteZentrale(); erstelleTray(); }
    catch (e) { dialog.showErrorBox('Velo-TV', e.message); }
  } else {
    starteSuche();
  }
  erstelleFenster();
  autoUpdate();
  if (SMOKE) require('./smoke').run(win, { ipcMain, app, PORT, getServer: () => server }).catch((e) => { console.error(e); app.exit(1); });
});
