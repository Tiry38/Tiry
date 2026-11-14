// Rauchtest: startet das Spiel in Chromium (Software-WebGL), klickt sich durch und speichert Screenshots.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import path from 'node:path';
import fs from 'node:fs';
import { startServer } from './serve.mjs';
const out = process.env.SMOKE_OUT || path.resolve('smoke-out');
fs.mkdirSync(out, { recursive: true });
const W = +process.env.W || 1600, H = +process.env.H || 900;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(180000);
const Q = process.env.QUALITY || 'low';
await page.addInitScript((q) => { try { const k = 'aetherfront.settings.v1'; const v = JSON.parse(localStorage.getItem(k) || '{}'); v.quality = q; v.qualityAuto = false; v.showFps = true; localStorage.setItem(k, JSON.stringify(v)); } catch {} }, Q);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
// Wartet, bis alle endlichen CSS-Animationen (Einblenden von Bildschirmen/Panels) fertig sind –
// Software-WebGL liefert nur wenige Bilder pro Sekunde, sonst landen halb eingeblendete Panels im Bild.
const settle = () => page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSAnimation) || a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity || a.animationName === 'banner'), null, { timeout: 30000, polling: 200 }).catch(() => {});
const shot = async (n) => { await settle(); await page.screenshot({ path: path.join(out, `${n}.png`) }); console.log('📸', n); };
const wait = (ms) => page.waitForTimeout(ms);
// Über den lokalen Webserver laden (unter file:// blockiert Chromium Texturen/HDRIs aus web/assets/)
const server = await startServer(0);
await page.goto(server.url + 'index.html');
await page.waitForFunction(() => window.__app && window.__app.mode === 'splash', null, { timeout: 120000 });
await wait(1500); await shot('01-splash');
await page.keyboard.press('Space');
await wait(4000); await shot('02-menu');
await page.click('[data-go="campaign"]'); await wait(1500); await shot('03a-campaign');
await page.click('#screen-campaign [data-go="menu"]'); await wait(300);
await page.click('[data-go="multi"]'); await wait(1500); await shot('03b-multi');
await page.click('#screen-multi [data-go="menu"]'); await wait(300);
await page.click('#screen-menu [data-go="codex"]'); await wait(1500); await shot('03c-codex');
await page.click('#screen-codex [data-back]'); await wait(300);
await page.click('[data-go="setup"]'); await wait(1500);
await page.click('#seg-pick button:nth-child(3)'); await page.click('#seg-cc button:nth-child(2)'); await wait(300);
await shot('03-setup');
await page.click('#btn-start'); await wait(3500); await shot('04-game-start');
// Ein paar Einheiten bauen
await page.evaluate(() => {
  const a = window.__app, s = a.session, me = a.me;
  const units = window.__app.hud.buildCards.map((c) => c.u);
  let i = 0;
  for (const [c, r] of [[1, 1], [2, 1], [3, 1], [4, 1], [2, 3], [3, 3]]) s.submit({ type: 'build', unit: units[i++ % units.length].id, col: c, row: r });
});
await wait(1200);
await page.keyboard.press('Q');
await page.mouse.move(W / 2, H / 2 + 40);
await wait(800); await shot('05-placing');
await page.hover('#build-dock .slot:nth-child(2)'); await wait(500); await shot('05b-tooltip');
await page.mouse.move(W / 2, H / 2);
await page.keyboard.press('Escape');
await page.evaluate(() => { const a = window.__app; const f = a.session.sim.fightersOf(a.me.id)[0]; a.select(f); });
await wait(600); await shot('06-selected');
await page.evaluate(() => window.__app.session.submit({ type: 'ready' }));
await wait(7000); await shot('07-battle');
await page.keyboard.press('K'); await wait(1000); await shot('07b-kinghall'); await page.keyboard.press('K'); await wait(300);
await page.evaluate(() => { const a = window.__app; a.cam.focus(a.me && -70, 30, 120, { pitch: 0.75 }); });
await wait(3000); await shot('08-overview');
await page.keyboard.down('Tab'); await wait(400); await shot('09-scoreboard'); await page.keyboard.up('Tab');
await page.evaluate(() => window.__app.select(null)); await page.keyboard.press('Escape'); await wait(1200); await shot('10-pause');
await page.click('#screen-pause [data-go="settings"]'); await wait(1200); await shot('11-settings');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(300);
await page.evaluate(() => window.__app.onGameOver({ winner: window.__app.me.team, reason: 'Der feindliche König ist gefallen' }));
await wait(3800); await shot('12-end');
const info = await page.evaluate(() => ({ calls: window.__app.engine.renderer.info.render.calls, tris: window.__app.engine.renderer.info.render.triangles, wave: window.__app.session.sim.wave, phase: window.__app.session.sim.phase }));
console.log('info', JSON.stringify(info));
console.log('Fehler/Warnungen:', errors.length ? '\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'keine');
await browser.close();
await server.close();

