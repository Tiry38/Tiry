// Startet das echte Programm im Demo-Modus (Postfach im Arbeitsspeicher) und fotografiert alle 6 Bereiche
// bei 1440 px und 390 px Breite. Aufruf: xvfb-run -a npm run screens
import { createRequire } from 'node:module';
const { _electron: electron } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const AUS = process.env.SCREENS_OUT ?? 'screens';
mkdirSync(AUS, { recursive: true });
const BEREICHE = ['postfach', 'cockpit', 'pruefen', 'absender', 'regeln', 'protokoll', 'einstellungen'];
const GROESSEN = [{ name: 'desktop', w: 1440, h: 900 }, { name: 'handy', w: 390, h: 844 }];

const app = await electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--demo', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, AUFRAEUMER_SMOKE: '1' },
});
const fenster = await app.firstWindow();
const fehler = [];
fenster.on('pageerror', (e) => fehler.push(String(e)));
fenster.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
await fenster.waitForFunction(() => window.__bereit === true, null, { timeout: 30000 });
await fenster.waitForTimeout(6000); // Demo-Mails tröpfeln, Strom füllt sich

for (const g of GROESSEN) {
  await app.evaluate(({ BrowserWindow }, g) => { const w = BrowserWindow.getAllWindows()[0]; w.setMinimumSize(300, 400); w.setContentSize(g.w, g.h); }, g);
  await fenster.waitForTimeout(700);
  for (const b of BEREICHE) {
    await fenster.click(`#nav button[data-ziel="${b}"]`);
    await fenster.waitForTimeout(b === 'cockpit' ? 2500 : 900);
    if (b === 'postfach') { await fenster.waitForSelector('.pf-zeile', { timeout: 8000 }).catch(() => {}); if (g.name === 'desktop') { await fenster.click('.pf-zeile >> nth=1').catch(() => {}); await fenster.waitForTimeout(1500); } }
    if (b === 'einstellungen' && g.name === 'desktop') {
      await fenster.click('[data-ab="vorschau"]').catch(() => {});
      await fenster.waitForTimeout(1500);
    }
    await fenster.screenshot({ path: `${AUS}/${g.name}-${BEREICHE.indexOf(b) + 1}-${b}.png`, fullPage: false });
    if (g.name === 'handy') {
      // ganze Seite auf dem Handy (scrollt im Fenster)
      const hoehe = await fenster.evaluate(() => document.documentElement.scrollHeight);
      await app.evaluate(({ BrowserWindow }, hh) => BrowserWindow.getAllWindows()[0].setContentSize(390, Math.min(hh, 6000)), hoehe);
      await fenster.waitForTimeout(500);
      await fenster.screenshot({ path: `${AUS}/${g.name}-${BEREICHE.indexOf(b) + 1}-${b}-ganz.png` });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(390, 844));
      await fenster.waitForTimeout(300);
    }
  }
}
const technik = await fenster.evaluate(() => document.querySelector('#maschine').getContext ? 'ok' : 'kein canvas');
const breite = await fenster.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log(JSON.stringify({ fehler, technik, breite }, null, 1));
await app.close();
