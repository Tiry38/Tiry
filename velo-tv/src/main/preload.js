'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('velo', {
  info: () => ipcRenderer.invoke('info'),
  setup: (opts) => ipcRenderer.invoke('setup', opts),
  setPcName: (n) => ipcRenderer.invoke('set-pc-name', n),
  setAutostart: (an) => ipcRenderer.invoke('set-autostart', an),
  neuePin: () => ipcRenderer.invoke('neue-pin'),
  firewall: () => ipcRenderer.invoke('firewall'),
  pptxZuPdf: (pfad) => ipcRenderer.invoke('pptx-zu-pdf', pfad),
  pfad: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
  oeffnen: (url) => ipcRenderer.invoke('open-external', url),
  updateInstallieren: () => ipcRenderer.invoke('update-installieren'),
  on: (kanal, fn) => {
    if (!['discovery', 'update-bereit', 'zentrale-umgezogen'].includes(kanal)) return;
    ipcRenderer.on(kanal, (_e, d) => fn(d));
  }
});
