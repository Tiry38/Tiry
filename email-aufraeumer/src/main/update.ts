// Selbst-Update wie bei Velo-TV: holt neue Versionen still aus dem GitHub-Release
// „tirys-mails-latest“, lädt sie im Hintergrund und installiert beim nächsten Neustart –
// oder sofort per Knopf. Läuft das Programm nur im Tray und der PC ist eine Weile unbenutzt,
// wird automatisch neu gestartet, damit das Update nicht wochenlang liegen bleibt.
import { app, powerMonitor } from 'electron';

export const UPDATE_URL = 'https://github.com/Tiry38/Tiry/releases/download/tirys-mails-latest';

export type UpdateStand =
  | { stand: 'aus' | 'aktuell' | 'sucht'; version: string }
  | { stand: 'laedt'; version: string; neu: string; prozent: number }
  | { stand: 'bereit'; version: string; neu: string }
  | { stand: 'fehler'; version: string; grund: string };

export function starteUpdater(opt: { melde: (s: UpdateStand) => void; log: (t: string) => void; fensterSichtbar: () => boolean; vorBeenden: (still: boolean) => void }) {
  const version = app.getVersion();
  let aktuell: UpdateStand = { stand: 'aus', version };
  const setze = (s: UpdateStand) => { aktuell = s; opt.melde(s); };
  if (!app.isPackaged || process.platform !== 'win32') return { stand: () => aktuell, jetzt: (_still?: boolean) => {}, suchen: async () => {} };

  // erst hier laden: im Entwicklungsmodus/Linux nie gebraucht
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater');
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_URL });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: (t: unknown) => opt.log(`Update: ${t}`), warn: (t: unknown) => opt.log(`Update: ${t}`), error: (t: unknown) => opt.log(`Update-Fehler: ${t}`), debug: () => {} } as any;

  let neu = '';
  autoUpdater.on('checking-for-update', () => { if (aktuell.stand !== 'bereit' && aktuell.stand !== 'laedt') setze({ stand: 'sucht', version }); });
  autoUpdater.on('update-not-available', () => setze({ stand: 'aktuell', version }));
  autoUpdater.on('update-available', (i) => { neu = i.version; setze({ stand: 'laedt', version, neu, prozent: 0 }); });
  autoUpdater.on('download-progress', (p) => setze({ stand: 'laedt', version, neu, prozent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => { neu = i.version; setze({ stand: 'bereit', version, neu }); });
  autoUpdater.on('error', (e) => { if (aktuell.stand !== 'bereit') setze({ stand: 'fehler', version, grund: String(e?.message ?? e).slice(0, 200) }); });

  const suchen = async () => { try { await autoUpdater.checkForUpdates(); } catch { /* Fehler-Ereignis meldet */ } };
  const jetzt = (still = false) => { opt.vorBeenden(still); setImmediate(() => autoUpdater.quitAndInstall(true, true)); };

  setTimeout(suchen, 8000);
  setInterval(suchen, 30 * 60 * 1000).unref();
  // Unbemerkt einspielen: Update bereit, Fenster zu, PC seit 10 Minuten unbenutzt → still neu starten
  setInterval(() => {
    if (aktuell.stand === 'bereit' && !opt.fensterSichtbar() && powerMonitor.getSystemIdleTime() > 600) { opt.log(`Update auf ${neu} wird still eingespielt`); jetzt(true); }
  }, 60 * 1000).unref();

  return { stand: () => aktuell, jetzt, suchen };
}
