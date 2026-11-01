'use strict';
/**
 * Electron-Tester – testet Apps unsichtbar im eingebauten Chromium (offscreen),
 * sammelt Konsolen-/Laufzeitfehler, macht Screenshot und Monkey-Test.
 */
const path = require('path');
const { monkeyScript } = require('../core/monkey');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function createElectronTester({ BrowserWindow, session, appsRoot, partition = 'forge-test' }) {
  function makeWindow(width, height) {
    const win = new BrowserWindow({
      show: false,
      width,
      height,
      useContentSize: true,
      webPreferences: { partition, offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    return win;
  }

  async function run(dir, { durationMs = 6000, seed = 1, screenshot = true } = {}) {
    const rel = path.relative(appsRoot, dir).split(path.sep);
    const url = `forge://${rel[0]}/${rel.slice(1).join('/')}/index.html`;
    try {
      await session.fromPartition(partition).clearStorageData();
    } catch {
      /* egal */
    }
    const win = makeWindow(390, 844);
    const consoleErrors = [];
    const pageErrors = [];
    let crashed = false;
    let loadFailed = null;
    win.webContents.on('console-message', (e, level, message) => {
      const lvl = e && e.level !== undefined ? e.level : level;
      const msg = e && e.message !== undefined ? e.message : message;
      if (lvl === 'error' || lvl === 3) consoleErrors.push(String(msg).slice(0, 500));
    });
    win.webContents.on('render-process-gone', () => { crashed = true; });
    win.webContents.on('did-fail-load', (e, code, desc) => { if (code !== -3) loadFailed = desc || `Fehler ${code}`; });
    const t0 = Date.now();
    try {
      await win.loadURL(url);
    } catch (e) {
      loadFailed = loadFailed || String(e.message || e);
    }
    await wait(900);
    let shot = null;
    if (screenshot && !loadFailed && !crashed) {
      try {
        const img = await win.webContents.capturePage();
        shot = img.isEmpty() ? null : img.toPNG();
      } catch {
        shot = null;
      }
    }
    let monkey = null;
    if (!loadFailed && !crashed) {
      try {
        monkey = await Promise.race([
          win.webContents.executeJavaScript(monkeyScript({ durationMs, seed }), true),
          wait(durationMs + 10000).then(() => { throw new Error('Zeitüberschreitung – App reagiert nicht'); })
        ]);
      } catch (e) {
        pageErrors.push(`Interaktionstest abgebrochen: ${String(e.message || e).split('\n')[0]}`);
      }
    }
    if (!win.isDestroyed()) win.destroy();
    return { consoleErrors, pageErrors, crashed, loadFailed, monkey, screenshot: shot, durationMs: Date.now() - t0 };
  }

  async function rasterize(svg, size) {
    const win = makeWindow(size, size);
    const sized = svg.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${sized}</body></html>`)}`);
    await wait(250);
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    if (!win.isDestroyed()) win.destroy();
    return img.isEmpty() ? null : img.resize({ width: size, height: size }).toPNG();
  }

  return { name: 'electron', isAvailable: () => true, run, rasterize };
}

module.exports = { createElectronTester };
