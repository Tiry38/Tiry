// Electron-Hauptprozess: startet Aetherfront als Windows-Programm.
'use strict';
const { app, BrowserWindow, ipcMain, Menu, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

// Eigenes Protokoll app://aetherfront/ liefert den Ordner web/ aus. Grund: Unter file:// blockiert Chromium
// fetch/XHR und das Hochladen von Bildern als WebGL-Textur (fremder Ursprung). app:// ist ein „sicherer“
// Standard-Ursprung mit Fetch-Unterstützung, die CSP 'self' gilt dafür unverändert.
const WEB_ROOT = path.join(__dirname, '..', 'web');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);
function serveWeb() {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
    const file = path.normalize(path.join(WEB_ROOT, rel));
    if (u.host !== 'aetherfront' || !file.startsWith(WEB_ROOT + path.sep) || !fs.existsSync(file)) return new Response('Nicht gefunden', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // Notlösung für PCs ohne Grafiktreiber

let win;
function create() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 650, backgroundColor: '#07061a', show: false,
    title: 'Aetherfront', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.loadURL('app://aetherfront/index.html');
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // Rauchtest: `electron . --smoke` speichert nach dem Start einen Screenshot und beendet sich
  if (process.argv.includes('--smoke')) {
    const out = process.env.AETHER_SMOKE_OUT || require('os').tmpdir();
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(require('path').join(out, 'electron-smoke.png'), img.toPNG());
        console.log('[smoke] Screenshot gespeichert:', out);
      } catch (e) { console.error('[smoke] Fehler', e); }
      app.quit();
    }, +(process.env.AETHER_SMOKE_DELAY || 15000));
  }
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}
ipcMain.on('quit', () => app.quit());
ipcMain.on('fullscreen', (_e, on) => { if (win) win.setFullScreen(!!on); });
// Einmalige Übernahme alter Spielstände: Bis v0.1 lief das Spiel unter file://, dessen localStorage
// (Einstellungen, Kampagnen-Fortschritt) unter app:// nicht sichtbar ist. Ein unsichtbares Fenster liest die
// alten Werte, der Preload-Skript schreibt fehlende Schlüssel vor dem Spielstart in den neuen Speicher.
let migrated = {};
async function readLegacyStorage() {
  const marker = path.join(app.getPath('userData'), 'storage-migrated-v1');
  if (fs.existsSync(marker)) return;
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await w.loadFile(path.join(__dirname, 'storage-bridge.html'));
    const json = await w.webContents.executeJavaScript('JSON.stringify(Object.assign({}, window.localStorage))');
    const data = JSON.parse(json || '{}');
    for (const [k, v] of Object.entries(data)) if (k.startsWith('aetherfront')) migrated[k] = v;
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());
  } catch (e) { console.warn('[speicher] Übernahme übersprungen:', e.message); } finally { w.destroy(); }
}
ipcMain.on('legacy-storage', (e) => { e.returnValue = migrated; migrated = {}; });
app.whenReady().then(async () => { serveWeb(); await readLegacyStorage(); create(); });
app.on('window-all-closed', () => app.quit());
