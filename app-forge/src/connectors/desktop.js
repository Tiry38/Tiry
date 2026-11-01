'use strict';
/**
 * Desktop-Anschlüsse (nur in der Windows-App): Tester im eingebauten Chromium,
 * Windows-Benachrichtigungen, automatische Programm-Updates, Systemfunktionen.
 */
const path = require('path');
const { createElectronTester } = require('../testers/electron-tester');

const tester = {
  id: 'tester.electron',
  name: 'Test-Labor (Chromium)',
  kind: 'quality',
  env: 'electron',
  description: 'Testet jede App unsichtbar im Handy-Format: Fehler, Monkey-Test (zufälliges Tippen), Layout, Screenshot.',
  provides: ['tester'],
  start(ctx) {
    const { BrowserWindow, session } = ctx.env.electron;
    ctx.provide('tester', createElectronTester({ BrowserWindow, session, appsRoot: ctx.paths.apps }), { priority: 10 });
  }
};

const notify = {
  id: 'system.notify',
  name: 'Windows-Benachrichtigungen',
  kind: 'system',
  env: 'electron',
  description: 'Meldet neue Apps, Verbesserungen, Exporte und Fehler als Windows-Benachrichtigung.',
  settings: [{ key: 'rejected', label: 'Auch verworfene Versuche melden', type: 'boolean', default: false }],
  available: (env) => env.electron.Notification.isSupported(),
  start(ctx) {
    const { Notification } = ctx.env.electron;
    const show = (title, body) => new Notification({ title, body, silent: false }).show();
    ctx.bus.on('app.created', (e) => show('Neue App erschaffen ✨', `${e.payload.app.name} – ${e.payload.app.tagline || ''}`));
    ctx.bus.on('app.version.created', (e) => show('App verbessert 🚀', `${e.payload.name || e.payload.appId}: ${e.payload.version.title}`));
    ctx.bus.on('export.done', () => show('Store-Paket fertig 📦', 'Der Export liegt im Export-Ordner.'));
    ctx.bus.on('job.failed', (e) => { if (e.payload.source !== 'autopilot') show('Auftrag fehlgeschlagen', e.payload.error || e.payload.title); });
    if (ctx.config.get('rejected')) ctx.bus.on('app.version.rejected', (e) => show('Versuch verworfen', e.payload.reason || ''));
  }
};

const updater = {
  id: 'system.updater',
  name: 'Programm-Updates',
  kind: 'system',
  env: 'electron',
  description: 'Aktualisiert Tiry App Forge automatisch, sobald eine neue Version gebaut wurde (GitHub Releases oder eigener Server).',
  settings: [
    { key: 'autoCheck', label: 'Automatisch prüfen', type: 'boolean', default: true },
    { key: 'provider', label: 'Quelle', type: 'select', default: 'github', options: [{ value: 'github', label: 'GitHub Releases' }, { value: 'generic', label: 'Eigener Server / Firebase Hosting' }] },
    { key: 'url', label: 'Update-URL (nur eigener Server)', type: 'text', default: '' }
  ],
  start(ctx) {
    const { app } = ctx.env.electron;
    const state = { enabled: app.isPackaged, state: app.isPackaged ? 'idle' : 'disabled', version: app.getVersion(), newVersion: null, error: app.isPackaged ? null : 'Nur in der installierten Version aktiv' };
    let autoUpdater = null;
    if (app.isPackaged) {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      if (ctx.config.get('provider') === 'generic' && ctx.config.get('url')) autoUpdater.setFeedURL({ provider: 'generic', url: ctx.config.get('url') });
      const set = (s, extra = {}) => { Object.assign(state, { state: s }, extra); ctx.bus.emit('updater.state', { ...state }); };
      autoUpdater.on('checking-for-update', () => set('checking'));
      autoUpdater.on('update-available', (i) => set('downloading', { newVersion: i.version }));
      autoUpdater.on('update-not-available', () => set('idle'));
      autoUpdater.on('download-progress', (p) => set('downloading', { progress: Math.round(p.percent) }));
      autoUpdater.on('update-downloaded', (i) => { set('ready', { newVersion: i.version }); ctx.bus.emit('log', { level: 'success', message: `Update ${i.version} bereit – wird beim Beenden installiert.` }); });
      autoUpdater.on('error', (err) => set('error', { error: String(err && err.message ? err.message : err).slice(0, 200) }));
      if (ctx.config.get('autoCheck')) {
        const check = () => autoUpdater.checkForUpdates().catch(() => {});
        setTimeout(check, 15000);
        const timer = setInterval(check, 6 * 3600e3);
        ctx.onStop(() => clearInterval(timer));
      }
    }
    ctx.action('updater.status', () => ({ ...state }), { description: 'Update-Status' });
    ctx.action('updater.check', async () => { if (autoUpdater) await autoUpdater.checkForUpdates().catch((e) => { state.error = e.message; }); return { ...state }; }, { description: 'Nach Updates suchen', expose: false });
    ctx.action('updater.install', () => { if (autoUpdater && state.state === 'ready') autoUpdater.quitAndInstall(); return { ...state }; }, { description: 'Update installieren', expose: false });
  }
};

const system = {
  id: 'system.desktop',
  name: 'Windows-System',
  kind: 'system',
  env: 'electron',
  description: 'Autostart mit Windows, Ordner öffnen, Programm-Infos.',
  start(ctx) {
    const { app, shell } = ctx.env.electron;
    const inData = (p) => path.resolve(p).startsWith(path.resolve(ctx.paths.data));
    ctx.action('system.info', () => ({ version: app.getVersion(), platform: process.platform, dataDir: ctx.paths.data, electron: process.versions.electron, autostart: app.getLoginItemSettings().openAtLogin }), { description: 'Programm-Infos' });
    ctx.action('system.openDataDir', () => shell.openPath(ctx.paths.data), { description: 'Datenordner öffnen', expose: false });
    ctx.action('system.openPath', ({ path: p }) => { if (!inData(p)) throw new Error('Pfad außerhalb des Datenordners'); return shell.openPath(p); }, { description: 'Ordner öffnen', expose: false });
    ctx.action('apps.openFolder', ({ id }) => shell.openPath(ctx.require('library').currentDir(id)), { description: 'App-Ordner öffnen', expose: false });
    ctx.action('system.setAutostart', ({ enabled }) => {
      app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--hidden'] });
      ctx.settings.set('app.autostart', !!enabled);
      return { autostart: !!enabled };
    }, { description: 'Autostart', expose: false });
  }
};

module.exports = [tester, notify, updater, system];
