'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// Alte Spielstände (file://-Zeit) übernehmen, bevor das Spiel startet – nur fehlende Schlüssel
try {
  const legacy = ipcRenderer.sendSync('legacy-storage') || {};
  for (const [k, v] of Object.entries(legacy)) if (window.localStorage.getItem(k) == null) window.localStorage.setItem(k, v);
} catch { /* ohne Übernahme weiter */ }
contextBridge.exposeInMainWorld('aetherfront', {
  quit: () => ipcRenderer.send('quit'),
  setFullscreen: (on) => ipcRenderer.send('fullscreen', !!on),
  // „Spiel hosten“: Relay-Server im Hauptprozess starten/stoppen → { ok, port, addresses } | { ok: false, error }
  hostServer: (port) => ipcRenderer.invoke('host-server', port | 0 || 7710),
  stopServer: () => ipcRenderer.invoke('stop-server'),
});
