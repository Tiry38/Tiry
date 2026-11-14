// Electron-Hauptprozess: startet Aetherfront als Windows-Programm.
'use strict';
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

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
  win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
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
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
