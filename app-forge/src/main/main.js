'use strict';
/**
 * Tiry App Forge – Electron-Hauptprozess (Windows-Programm).
 * Startet den Hub mit allen Anschlüssen, das Fenster, das Tray-Symbol und das forge://-Protokoll.
 */
const { app, BrowserWindow, ipcMain, protocol, net, shell, Tray, Menu, nativeImage, Notification, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { createHub } = require('../hub');
const { registerAll } = require('../connectors');

protocol.registerSchemesAsPrivileged([{ scheme: 'forge', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

const SMOKE = process.argv.includes('--smoke');
const START_HIDDEN = process.argv.includes('--hidden');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

let win = null;
let tray = null;
let hub = null;
let quitting = false;
let trayHintShown = false;

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}
app.setAppUserModelId('de.tiry.appforge');

function encryptor() {
  return {
    available: () => {
      try {
        return safeStorage.isEncryptionAvailable();
      } catch {
        return false;
      }
    },
    encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (b) => safeStorage.decryptString(Buffer.from(b, 'base64'))
  };
}

function forgeHandler(appsRoot) {
  return (req) => {
    try {
      const u = new URL(req.url);
      const id = u.hostname;
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      const base = path.join(appsRoot, id);
      const file = path.normalize(path.join(base, rel));
      if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(id) || !file.startsWith(base + path.sep) || /meta\.json$/.test(file)) return new Response('Verboten', { status: 403 });
      if (!fs.existsSync(file)) return new Response('Nicht gefunden', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response('Fehler', { status: 500 });
    }
  };
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#07070d',
    title: 'Tiry App Forge',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? { color: '#0b0b16', symbolColor: '#e2e8f0', height: 44 } : false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: !SMOKE }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (!START_HIDDEN && !SMOKE) win.show();
  });
  win.on('close', (e) => {
    if (quitting || SMOKE) return;
    if (hub && hub.settings.get('app.minimizeToTray', true)) {
      e.preventDefault();
      win.hide();
      if (!trayHintShown && Notification.isSupported()) {
        trayHintShown = true;
        new Notification({ title: 'Tiry App Forge läuft weiter', body: 'Der Autopilot arbeitet im Hintergrund. Rechtsklick auf das Tray-Symbol zum Beenden.' }).show();
      }
    } else {
      quitting = true;
    }
  });
  win.on('closed', () => { win = null; });
  return win;
}

function createTray() {
  if (!fs.existsSync(ICON)) return;
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Tiry App Forge');
  const build = () => {
    const pilot = hub.registry.get('autopilot');
    const on = pilot ? pilot.status().enabled : false;
    return Menu.buildFromTemplate([
      { label: 'Tiry App Forge öffnen', click: showWindow },
      { label: 'Neue App erschaffen', click: () => hub.actions.invoke('forge.create', { count: 1 }).catch(() => {}) },
      { label: 'Autopilot', type: 'checkbox', checked: on, click: (item) => hub.actions.invoke('autopilot.set', { enabled: item.checked }).catch(() => {}) },
      { type: 'separator' },
      { label: 'Beenden', click: () => { quitting = true; app.quit(); } }
    ]);
  };
  tray.setContextMenu(build());
  hub.bus.on('autopilot.state', () => tray && tray.setContextMenu(build()));
  tray.on('click', showWindow);
}

async function boot() {
  const dataDir = process.env.FORGE_DATA_DIR || path.join(app.getPath('userData'), 'forge');
  hub = createHub({ dataDir, encryptor: encryptor(), env: { electron: { app, shell, Notification, BrowserWindow, session } } });
  const handler = forgeHandler(hub.paths.apps);
  protocol.handle('forge', handler);
  session.fromPartition('forge-test').protocol.handle('forge', handler);
  registerAll(hub);

  ipcMain.handle('forge:invoke', (e, action, args) => {
    if (!win || e.sender !== win.webContents) throw new Error('Nicht erlaubt');
    return hub.actions.invoke(String(action), args || {}, { caller: 'ui' });
  });
  hub.bus.on('*', (e) => {
    if (win && !win.isDestroyed()) win.webContents.send('forge:event', e);
  });

  createWindow();
  await hub.plugins.startAll();
  if (!SMOKE) createTray();
  if (SMOKE) await smoke();
}

/** End-to-End-Selbsttest der echten App (CI/Entwicklung): erschafft, testet, exportiert. */
async function smoke() {
  const out = process.env.FORGE_SMOKE_OUT || path.join(hub.paths.data, 'smoke');
  fs.mkdirSync(out, { recursive: true });
  const result = { plugins: hub.plugins.list().map((p) => `${p.id}:${p.status}`), steps: [] };
  try {
    const { jobIds } = await hub.actions.invoke('forge.create', { count: 1 });
    const created = await hub.jobs.jobs.find((j) => j.id === jobIds[0]).done;
    result.steps.push({ create: created.status, error: created.error, app: created.result });
    const id = created.result && created.result.appId;
    if (id) {
      const t = await hub.actions.invoke('forge.test', { id });
      const tested = await hub.jobs.jobs.find((j) => j.id === t.jobId).done;
      result.steps.push({ test: tested.status, result: tested.result });
      result.steps.push({ readiness: (await hub.actions.invoke('apps.readiness', { id })).score });
      result.steps.push({ export: (await hub.actions.invoke('export.app', { id })).dir });
      const meta = await hub.actions.invoke('apps.get', { id });
      result.files = fs.readdirSync(hub.registry.get('library').currentDir(id));
      result.score = meta.score;
    }
    await uiTour(out, id, result);
    result.ok = result.steps.every((s) => !Object.values(s).includes('failed')) && result.rendererErrors.length === 0;
  } catch (err) {
    result.ok = false;
    result.error = String(err.stack || err);
  }
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  quitting = true;
  await hub.plugins.stopAll();
  app.exit(result.ok ? 0 : 1);
}

/** Klickt sich durch alle Ansichten und Detail-Reiter und speichert Screenshots (Design-Abnahme). */
async function uiTour(out, appId, result) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG());
  result.rendererErrors = [];
  win.webContents.on('console-message', (...args) => {
    const e = args[0] && typeof args[0] === 'object' && 'message' in args[0] ? args[0] : { level: args[1], message: args[2] };
    if (e.level === 'error' || e.level === 3) result.rendererErrors.push(String(e.message));
  });
  win.webContents.on('render-process-gone', (_e, d) => result.rendererErrors.push('renderer gone: ' + d.reason));
  win.showInactive(); // sichtbares Fenster, sonst drosselt Chromium das Zeichnen und Screenshots veralten
  await js('location.reload()');
  await wait(2500);
  for (const [w, h] of [[1440, 900], [1100, 720]]) {
    win.setContentSize(w, h);
    await wait(700);
    for (const view of ['studio', 'autopilot', 'trends', 'network', 'cloud', 'lessons', 'settings']) {
      await js(`document.querySelector('.nav-item[data-view="${view}"]').click()`);
      await wait(view === 'network' ? 1800 : 1300);
      await shot(`ui-${w}-${view}`);
      if (view === 'settings' && w === 1440) {
        await js(`document.querySelector('[data-aimode="api"]').click()`);
        await wait(900);
        await shot('ui-1440-settings-api');
        await js(`document.querySelector('[data-aimode="free"]').click()`);
        await wait(900);
      }
    }
    if (appId) {
      await js(`document.querySelector('.nav-item[data-view="studio"]').click()`);
      await wait(900);
      await js(`(document.querySelector('.app-card[data-id="${appId}"]') || document.querySelector('.app-card')).click()`);
      await wait(1800);
      for (const tab of ['overview', 'quality', 'versions', 'sale', 'actions']) {
        await js(`document.querySelector('#detail [data-tab="${tab}"]').click()`);
        await wait(1000);
        await shot(`ui-${w}-detail-${tab}`);
      }
      await js(`document.querySelector('#close-detail').click()`);
      await wait(600);
    }
  }
  result.overflow = await js(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`);
}

app.whenReady().then(boot).catch((err) => {
  console.error(err);
  app.exit(1);
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && quitting) app.quit();
});
app.on('will-quit', () => {
  if (hub) hub.plugins.stopAll().catch(() => {});
});
