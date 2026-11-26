// Brücke zwischen Oberfläche und Hauptprozess – nur zwei Kanäle, keine Node-APIs im Fenster.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('aufraeumer', {
  rufe: (name: string, ...args: unknown[]) => ipcRenderer.invoke('rufe', name, ...args),
  auf: (cb: (kanal: string, daten: unknown) => void) => {
    const h = (_e: unknown, kanal: string, daten: unknown) => cb(kanal, daten);
    ipcRenderer.on('ereignis', h);
    return () => ipcRenderer.removeListener('ereignis', h);
  },
});
