/* Oberflächen-Prüfung mit Playwright – node tests/ui-check.js
 * Lädt Demo-Daten, öffnet jede Ansicht am PC (1440×900) und am Handy (390×844),
 * speichert Screenshots, prüft Konsolenfehler, horizontales Scrollen und Tipp-Flächen. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = process.env.DZ_SHOTS || '/tmp/claude-0/-home-user-Tiry/5e7eda0f-9ff1-5247-87df-ba6b6063faf4/scratchpad/shots';
const URL_ = 'file://' + path.resolve(__dirname, '..', 'index.html');
const VIEWS = ['uebersicht', 'teilnehmer', 'person', 'tage', 'auslosung', 'joker', 'daten', 'einstellungen'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];
  for (const vp of [{ name: 'pc', width: 1440, height: 900 }, { name: 'handy', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') problems.push(vp.name + ' Konsole: ' + m.text()); });
    page.on('pageerror', (e) => problems.push(vp.name + ' Skriptfehler: ' + e.message));
    await page.goto(URL_ + '#uebersicht');
    await page.waitForSelector('#view');
    // leerer Zustand zuerst
    await page.screenshot({ path: path.join(OUT, vp.name + '-00-leer.png'), fullPage: false });
    await page.goto(URL_ + '#daten');
    await page.click('[data-act="demo"]');
    await page.waitForFunction(() => document.querySelector('#toast').classList.contains('show'));
    // Auslosungen ausführen (Hauptpreis + Woche 1), damit Ergebnisse sichtbar sind
    await page.goto(URL_ + '#auslosung');
    await page.click('[data-act="draw"][data-key="MAIN"]');
    await page.click('[data-act="draw"][data-key="W1"]');
    await page.click('[data-act="draw"][data-key="W2"]');
    // erneutes Ziehen braucht Rückfrage
    await page.click('[data-act="draw"][data-key="W1"]');
    await page.waitForSelector('.modal:not([hidden]) .mbox');
    await page.click('[data-m="0"]');
    for (let i = 0; i < VIEWS.length; i++) {
      const v = VIEWS[i];
      if (v === 'person') {
        await page.goto(URL_ + '#teilnehmer');
        await page.click('.prow');
      } else {
        await page.goto(URL_ + '#' + v);
      }
      await page.waitForTimeout(250);
      if (v === 'tage') await page.click('.drow summary');
      const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
      if (sw.sw > sw.w) problems.push(vp.name + ' ' + v + ': horizontales Scrollen (' + sw.sw + ' > ' + sw.w + ')');
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('.btn, .pill, .nav-i, select, input:not([type=file])'))
        .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.height < 44; })
        .map((el) => (el.className || el.tagName) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px'));
      if (small.length) problems.push(vp.name + ' ' + v + ': Tipp-Fläche < 44 px: ' + small.slice(0, 3).join(', '));
      await page.screenshot({ path: path.join(OUT, vp.name + '-' + String(i + 1).padStart(2, '0') + '-' + v + '.png'), fullPage: true });
    }
    // Suche und Filter funktionieren
    await page.goto(URL_ + '#teilnehmer');
    await page.click('[data-act="filter"][data-v="durchzieher"]');
    const allFinisher = await page.$$eval('.prow .chip', (els) => els.filter((e) => /st-/.test(e.className) && !/st-win/.test(e.className)).every((e) => e.textContent === 'Durchzieher'));
    if (!allFinisher) problems.push(vp.name + ': Filter Durchzieher zeigt andere Status');
    await page.fill('#q', 'zzzz-niemand');
    if (!(await page.textContent('#plist')).includes('Keine Treffer')) problems.push(vp.name + ': Suche ohne Treffer-Hinweis');
    await page.click('[data-act="filter"][data-v="alle"]');
    // Joker einlösen über die Oberfläche
    await page.goto(URL_ + '#joker');
    const opt = await page.$eval('#jperson optgroup[label="Joker nötig"] option', (o) => o.value).catch(() => null);
    if (opt) {
      const code = await page.evaluate(() => JSON.parse(localStorage.getItem('dz-state-v1')).jokers.find((j) => !j.used).code);
      await page.fill('#jcode', code);
      await page.selectOption('#jperson', opt);
      await page.click('[data-act="joker-assign"]');
      const ok = await page.evaluate((c) => JSON.parse(localStorage.getItem('dz-state-v1')).jokers.find((j) => j.code === c).used, code);
      if (!ok) problems.push(vp.name + ': Joker-Buchung über die Oberfläche fehlgeschlagen');
    } else problems.push(vp.name + ': keine Person mit „Joker nötig“ in der Auswahl');
    // Export enthält keinen Token
    await page.goto(URL_ + '#einstellungen');
    await page.fill('#token', 'TESTTOKEN-SOLL-NICHT-RAUS');
    await page.click('[data-act="settings-save"]');
    await page.goto(URL_ + '#daten');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    if (text.includes('TESTTOKEN')) problems.push(vp.name + ': Token im Export!');
    // Druckansicht der Joker-Karten
    if (vp.name === 'pc') {
      await page.goto(URL_ + '#joker');
      await page.evaluate(() => { window.print = () => {}; });
      await page.click('[data-act="joker-print"]');
      await page.emulateMedia({ media: 'print' });
      await page.screenshot({ path: path.join(OUT, 'pc-99-joker-druck.png'), fullPage: true });
      await page.emulateMedia({ media: 'screen' });
    }
    await ctx.close();
  }
  await browser.close();
  console.log('Screenshots: ' + OUT);
  if (problems.length) { console.log('PROBLEME:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('Oberfläche ok: keine Konsolenfehler, kein horizontales Scrollen, Tipp-Flächen ≥ 44 px.');
})().catch((e) => { console.error(e); process.exit(1); });
