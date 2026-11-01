'use strict';
/** Sichere Brücke zwischen Oberfläche und Hub (nur invoke + Ereignisse). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('forge', {
  invoke: (action, args) =>
    ipcRenderer.invoke('forge:invoke', action, args).catch((err) => {
      throw new Error(String((err && err.message) || err).replace(/^Error invoking remote method 'forge:invoke': (Error: )?/, ''));
    }),
  on: (cb) => {
    const handler = (_e, ev) => cb(ev);
    ipcRenderer.on('forge:event', handler);
    return () => ipcRenderer.removeListener('forge:event', handler);
  },
  platform: process.platform
});
