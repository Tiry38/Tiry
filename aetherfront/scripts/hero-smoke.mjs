// Helden-Rauchtest (Playwright, Software-WebGL): Heldenauswahl → Gefecht → Windzug-Schwenk (mehrere Momente) →
// WoW-Steuerung Schritt für Schritt (jede Taste/Maustaste wird im Spielzustand geprüft) → Fähigkeiten →
// Heldentod → Schwenk zurück. Speichert Screenshots + Prüfbericht (controls.json).
//   node scripts/build.mjs && node scripts/hero-smoke.mjs      (Ausgabe: HERO_SMOKE_OUT oder ./smoke-out/hero)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const out = process.env.HERO_SMOKE_OUT || path.resolve('smoke-out/hero');
fs.mkdirSync(out, { recursive: true });
const W = +process.env.W || 1600, H = +process.env.H || 900;
const HERO = process.env.HERO || 'lyra';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(240000);
await page.addInitScript(({ hero }) => { try { const k = 'aetherfront.settings.v1'; const v = JSON.parse(localStorage.getItem(k) || '{}'); Object.assign(v, { quality: 'low', qualityAuto: false, showFps: true, hero, teamSize: 1, swoop: 'normal', damageNumbers: false }); localStorage.setItem(k, JSON.stringify(v)); } catch {} }, { hero: HERO });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const wait = (ms) => page.waitForTimeout(ms);
let n = 0;
const shot = async (name) => { await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); console.log('📸', name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (control, ok, detail = '') => { results.push({ control, ok: !!ok, detail }); console.log(`${ok ? '✔' : '✘'} ${control}${detail ? ` – ${detail}` : ''}`); };
const state = () => ev(() => {
  const a = window.__app, s = a.session, h = s.sim.heroOf(s.localPid), c = a.controls;
  return { vmode: a.vmode, x: h.x, z: h.z, y: h.y, face: h.face, alive: h.alive, yaw: c.yaw, camYaw: a.hcam.yaw, pitch: a.hcam.pitch, dist: a.hcam.distGoal,
    target: c.target, simTarget: h.target, auto: h.auto, autorun: c.autorun, cast: h.cast && { slot: h.cast.slot, t: h.cast.t }, cds: h.cds, gcd: h.gcd, res: h.res,
    placing: !!c.placing, menu: a.menus.current, tick: s.sim.tick, phase: s.sim.phase, freeze: s.sim.freeze, hin: c.stats.hin, casts: c.stats.casts };
});
/** Spielzeit (Sim-Ticks) abwarten – unabhängig von der Bildrate */
const ticks = async (k) => { const t0 = (await state()).tick; await page.waitForFunction(([t]) => window.__app.session.sim.tick >= t, [t0 + k], { polling: 50 }); };
const hold = async (key, simTicks) => { await page.keyboard.down(key); await ticks(simTicks); await page.keyboard.up(key); };
// Ereignis-Mitschnitt der Simulation
await page.addInitScript(() => { window.__ev = []; });

const server = await startServer(0);
await page.goto(server.url + 'index.html');
await page.waitForFunction(() => window.__app && window.__app.mode === 'splash', null, { timeout: 180000 });
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__app.mode === 'menu');
await wait(1500);
// ---------- Heldenauswahl ----------
await page.click('[data-go="setup"]');
await wait(2500);
await shot('heldenauswahl');
await page.hover('#hp-info .hp-ab:nth-child(2)');
await wait(1500);
await shot('heldenauswahl-faehigkeit');
await page.click('.hp-card[data-hero="kael"]');
await wait(1500);
await shot('heldenauswahl-tank');
await page.click(`.hp-card[data-hero="${HERO}"]`);
await wait(500);
check('Heldenauswahl speichert Wahl', (await ev(() => window.__app.settings.get('hero'))) === HERO);
await page.click('#setup-tabs button[data-tab="game"]');
await wait(800);
await shot('gefecht-einrichten');
await page.click('#btn-start');
await page.waitForFunction(() => window.__app.mode === 'game');
await wait(2500);
check('Gewählter Held im Spiel', (await ev(() => window.__app.session.sim.heroOf(0).heroId)) === HERO);
// Ereignisse mitschneiden
await ev(() => { const a = window.__app; const orig = a.handleEvents.bind(a); a.handleEvents = (es) => { for (const e of es) window.__ev.push(e); return orig(es); }; });
await shot('bauphase-rts');
// ---------- Windzug-Schwenk ----------
await ev(() => { window.__app.session.sim.phaseTime = 0.3; });
await page.waitForFunction(() => window.__app.vmode === 'swoopIn', null, { polling: 30 });
// Fahrt an festen Punkten anhalten (Software-WebGL ist zu langsam für Echtzeit-Aufnahmen)
for (const p of [0.2, 0.45, 0.7, 0.9]) {
  await ev((q) => { window.__app.swoop.hold = q; }, p);
  await page.waitForFunction((q) => { const s = window.__app.swoop.active; return !s || s.t / s.dur >= q - 1e-6; }, p, { polling: 20 });
  await wait(400);
  await shot(`schwenk-hinein-${Math.round(p * 100)}`);
}
await ev(() => { window.__app.swoop.hold = null; });
await page.waitForFunction(() => window.__app.vmode === 'hero');
check('Schwenk endet im Heldenblick, Steuerung aktiv', (await ev(() => window.__app.controls.enabled)));
await page.waitForFunction(() => window.__app.session.sim.freeze <= 0);
await wait(600);
await shot('heldenblick');
// Gegner aus der Bahn holen, damit Ziele erreichbar sind (Testhilfe: nur Positionen)
await ev(() => { const s = window.__app.session, h = s.sim.heroOf(0); let i = 0; for (const e of s.sim.entities.values()) if (e.type === 'c' && e.lane === 0) { e.x = h.x + ((i % 4) - 1.5) * 2.4; e.z = h.z - 9 - Math.floor(i / 4) * 2; i++; } });

// ---------- Bewegung ----------
let a = await state();
await hold('KeyW', 12);
let b = await state();
const fwd = Math.hypot(b.x - a.x, b.z - a.z) / ((b.tick - a.tick) / 20);
check('W vorwärts (7 m/s)', b.z < a.z - 1 && fwd > 5.5 && fwd < 7.6, `${fwd.toFixed(2)} m/s`);
await shot('laufen-vorwaerts');
a = await state();
await hold('KeyS', 12);
b = await state();
const back = Math.hypot(b.x - a.x, b.z - a.z) / ((b.tick - a.tick) / 20);
check('S rückwärts (4,5 m/s)', b.z > a.z + 0.5 && back > 3.2 && back < 4.9, `${back.toFixed(2)} m/s`);
a = await state();
await page.keyboard.down('KeyE'); await ticks(8); await shot('seitwaerts'); await page.keyboard.up('KeyE');
b = await state();
check('E seitwärts rechts', b.x > a.x + 0.8 && Math.abs(b.yaw - a.yaw) < 1e-6, `Δx ${(b.x - a.x).toFixed(2)}`);
a = await state();
await hold('KeyQ', 8);
b = await state();
check('Q seitwärts links', b.x < a.x - 0.8);
a = await state();
await hold('KeyA', 10);
b = await state();
const turnRate = (b.yaw - a.yaw);
check('A dreht nach links (Blick + Kamera)', turnRate > 0.2 && Math.abs(b.camYaw - b.yaw) < 0.05, `Δ ${turnRate.toFixed(2)} rad`);
a = await state();
await hold('KeyD', 10);
b = await state();
check('D dreht nach rechts', b.yaw < a.yaw - 0.2);
// Sprung
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__app.session.sim.heroOf(0).y > 0.4, null, { polling: 20 });
await shot('sprung');
check('Leertaste springt', (await state()).y > 0.4);
await page.waitForFunction(() => window.__app.session.sim.heroOf(0).grounded);
// Automatisch laufen
await page.keyboard.press('NumLock');
a = await state();
await ticks(10);
b = await state();
check('Num: automatisch laufen', b.autorun && Math.hypot(b.x - a.x, b.z - a.z) > 1);
await page.keyboard.press('KeyW');
await ticks(4);
check('W beendet Autolauf', !(await state()).autorun);
await page.keyboard.press('NumLock'); await ticks(2); await page.keyboard.press('KeyS');
check('S beendet Autolauf', !(await state()).autorun);
// ---------- Maus ----------
const cx = W / 2, cy = H / 2;
a = await state();
await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 25, cy + i * 4);
await page.mouse.up({ button: 'left' });
b = await state();
check('Linke Maustaste ziehen: Kamera dreht frei, Held behält Blick', Math.abs(b.camYaw - a.camYaw) > 0.3 && Math.abs(b.yaw - a.yaw) < 0.02, `Kamera Δ ${(b.camYaw - a.camYaw).toFixed(2)}, Held Δ ${(b.yaw - a.yaw).toFixed(3)}`);
await shot('kamera-frei');
a = await state();
await page.mouse.move(cx, cy); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 8; i++) await page.mouse.move(cx - i * 25, cy - i * 3);
b = await state();
check('Rechte Maustaste ziehen: Held + Kamera folgen der Maus', Math.abs(b.yaw - b.camYaw) < 0.02 && Math.abs(b.yaw - a.yaw) > 0.3, `Held Δ ${(b.yaw - a.yaw).toFixed(2)}`);
// A/D werden mit gehaltener rechter Maustaste zu Seitschritten
a = await state();
await hold('KeyD', 8);
b = await state();
check('Rechte Maustaste + D = seitwärts statt drehen', Math.abs(b.yaw - a.yaw) < 0.02 && Math.hypot(b.x - a.x, b.z - a.z) > 0.8);
// beide Tasten → vorwärts
a = await state();
await page.mouse.down({ button: 'left' });
await ticks(10);
b = await state();
await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
check('Beide Maustasten: vorwärts laufen', Math.hypot(b.x - a.x, b.z - a.z) > 1.5);
// Zoom
a = await state();
await page.mouse.move(cx, cy);
await page.mouse.wheel(0, 400); await wait(300);
b = await state();
check('Mausrad zoomt heraus', b.dist > a.dist + 1, `${a.dist.toFixed(1)} → ${b.dist.toFixed(1)} m`);
await page.mouse.wheel(0, -900); await wait(300);
check('Mausrad zoomt hinein (min. 2 m)', (await state()).dist < b.dist && (await state()).dist >= 2);
await page.mouse.wheel(0, 300); await wait(400);
// ---------- Ziele ----------
// zum Gegner drehen
await ev(() => { const a = window.__app, s = a.session, h = s.sim.heroOf(0); let best = null, bd = 1e9; for (const e of s.sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === 0) { const d = Math.hypot(e.x - h.x, e.z - h.z); if (d < bd) { bd = d; best = e; } } if (best) { a.controls.yaw = Math.atan2(best.x - h.x, best.z - h.z); a.hcam.yaw = a.controls.yaw; } });
await ticks(4);
await page.keyboard.press('Tab');
await ticks(3);
a = await state();
check('Tab: nächster Gegner vor dir', a.target > 0 && a.simTarget === a.target);
await page.keyboard.press('Tab');
await ticks(3);
b = await state();
check('Tab erneut: schaltet durch', b.target > 0 && b.target !== a.target);
await shot('ziel-namensplaketten');
await page.keyboard.press('Escape');
await ticks(3);
check('Esc hebt Ziel auf', (await state()).target === 0 && (await state()).menu === 'hud');
await page.keyboard.press('Escape');
await wait(600);
check('Esc ohne Ziel öffnet Menü', (await state()).menu === 'pause');
await shot('menue-im-kampf');
await page.keyboard.press('Escape');
await wait(600);
// Linksklick / Rechtsklick auf Gegner (Bildschirmposition berechnen)
const tgtScreen = () => ev(() => {
  const a = window.__app, s = a.session, h = s.sim.heroOf(0), cam = a.engine.camera;
  let best = null, bd = 1e9;
  for (const e of s.sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === 0) { const d = Math.hypot(e.x - h.x, e.z - h.z); if (d < bd) { bd = d; best = e; } }
  if (!best) return null;
  const p = a.view.pos(best.id); const v = { x: p.x, y: 1.1, z: p.z };
  const V = new cam.position.constructor(v.x, v.y, v.z).project(cam);
  return { id: best.id, x: (V.x * 0.5 + 0.5) * innerWidth, y: (-V.y * 0.5 + 0.5) * innerHeight };
});
let t = await tgtScreen();
if (t) {
  await page.mouse.click(t.x, t.y, { button: 'left' });
  await ticks(3);
  a = await state();
  check('Linksklick auf Gegner: anvisieren', a.target === t.id && !a.auto, `id ${t.id}`);
  t = await tgtScreen();
  await page.mouse.click(t.x, t.y, { button: 'right' });
  await ticks(3);
  a = await state();
  check('Rechtsklick auf Gegner: anvisieren + Auto-Angriff', a.target === t.id && a.auto);
} else check('Linksklick/Rechtsklick auf Gegner', false, 'kein Gegner sichtbar');
// ---------- Fähigkeiten ----------
await page.keyboard.down('Shift'); await page.keyboard.press('Digit1'); await page.keyboard.up('Shift');
await wait(300);
check('Umschalt+1 ist für Gegenstände reserviert', (await ev(() => document.getElementById('herr').textContent)).includes('Gegenstand'));
await shot('fehlertext');
// Gegner in Reichweite holen
await ev(() => { const s = window.__app.session, h = s.sim.heroOf(0); let i = 0; for (const e of s.sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === 0) { e.x = h.x + Math.sin(h.face) * (7 + (i % 3)) + ((i % 4) - 1.5) * 1.6; e.z = h.z + Math.cos(h.face) * (7 + (i % 3)); e.cd = 3; i++; } });
await ticks(3);
for (let slot = 0; slot < 5; slot++) {
  const before = await ev(() => window.__ev.length);
  await ev(() => { const h = window.__app.session.sim.heroOf(0); h.res = h.resMax; h.gcd = 0; });
  await page.keyboard.press(`Digit${slot + 1}`);
  await wait(150);
  if ((await state()).placing) {
    await shot(`zielkreis-${slot + 1}`);
    const tp = await tgtScreen();
    await page.mouse.click(tp ? tp.x : cx, tp ? tp.y + 30 : cy + 120, { button: 'left' });
  }
  await page.waitForFunction(([k, s]) => window.__ev.slice(k).some((e) => (e.e === 'heroAbility' || e.e === 'heroCast' || e.e === 'heroError') && (e.slot === s || e.e === 'heroError')), [before, slot], { polling: 30, timeout: 60000 }).catch(() => {});
  const got = await ev(([k]) => window.__ev.slice(k).filter((e) => ['heroAbility', 'heroCast', 'heroError', 'castCancel'].includes(e.e)).map((e) => `${e.e}${e.slot != null ? `#${e.slot}` : ''}${e.reason ? `:${e.reason}` : ''}`), [before]);
  const st2 = await state();
  if (st2.cast) { await page.waitForFunction(() => { const h = window.__app.session.sim.heroOf(0); return h.cast && h.cast.t / h.cast.total > 0.45; }, null, { polling: 30 }).catch(() => {}); await shot(`zauberleiste-${slot + 1}`); }
  await ticks(10);
  await shot(`faehigkeit-${slot + 1}`);
  const ok = got.some((x) => x.startsWith('heroAbility') || x.startsWith('heroCast'));
  check(`Taste ${slot + 1}: Fähigkeit ausgelöst`, ok, got.join(', '));
  await ev(() => { const h = window.__app.session.sim.heroOf(0); h.cds = h.cds.map(() => 0); });
  await page.waitForFunction(() => !window.__app.session.sim.heroOf(0).cast, null, { polling: 50, timeout: 60000 }).catch(() => {});
}
// Animation startet beim Tastendruck (lokal), bevor die Sim bestätigt
await ev(() => { const h = window.__app.session.sim.heroOf(0); h.res = h.resMax; h.gcd = 0; h.cds = h.cds.map(() => 0); });
const anim = await ev(() => new Promise((res) => {
  const a = window.__app; const tick = a.session.sim.tick;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true }));
  const s = a.heroes.map.get(a.heroes.localId);
  res({ started: !!(s && s.action), kind: s && s.action && s.action.kind, sameTick: a.session.sim.tick === tick });
}));
await page.keyboard.up('Digit2');
check('Animation startet sofort beim Tastendruck (vor der Sim-Bestätigung)', anim.started && anim.sameTick, `${anim.kind}`);
// Zauber mit Zauberzeit + Bewegung = Abbruch
await ev(() => { const h = window.__app.session.sim.heroOf(0); h.res = h.resMax; h.gcd = 0; h.cds = h.cds.map(() => 0); });
await ticks(2);
const k0 = await ev(() => window.__ev.length);
const castAb = await ev(() => { const a = window.__app, h = a.session.sim.heroOf(0); return a.controls.def.abilities.findIndex((x) => x.cast > 0); });
if (castAb >= 0) {
  await page.keyboard.press(`Digit${castAb + 1}`);
  await page.waitForFunction(() => !!window.__app.session.sim.heroOf(0).cast, null, { polling: 20, timeout: 30000 }).catch(() => {});
  await hold('KeyW', 3);
  await ticks(3);
  const cc = await ev(([k]) => window.__ev.slice(k).some((e) => e.e === 'castCancel'), [k0]);
  check('Bewegung bricht Zauber ab (Zauberleiste „Unterbrochen“)', cc);
  await shot('zauber-abgebrochen');
}
// ---------- Heldentod → zurück in die Vogelperspektive ----------
await ev(() => { const s = window.__app.session, h = s.sim.heroOf(0); s.sim.applyHit({ type: 'c', alive: true, x: h.x, z: h.z, hp: 1, maxHp: 1 }, h, 1e7, 'klinge', false); });
await page.waitForFunction(() => window.__app.vmode === 'dead' || window.__app.vmode === 'swoopOut', null, { polling: 30 });
await wait(800);
await shot('held-gefallen');
await ev(() => { window.__app.swoop.hold = 0.5; });
await page.waitForFunction(() => window.__app.vmode === 'swoopOut', null, { polling: 30 });
await page.waitForFunction(() => { const s = window.__app.swoop.active; return !s || s.t / s.dur >= 0.5 - 1e-6; }, null, { polling: 20 });
await wait(400);
await shot('schwenk-hinaus-50');
await ev(() => { window.__app.swoop.hold = null; });
await page.waitForFunction(() => window.__app.vmode === 'rts');
await wait(800);
await shot('vogelperspektive-nach-tod');
check('Heldentod: Schwenk zurück in die Vogelperspektive, Held bleibt tot', (await state()).vmode === 'rts' && !(await state()).alive);
// Wellenende → nächste Welle: wieder Held
await ev(() => { const s = window.__app.session; for (const e of s.sim.entities.values()) if (e.type === 'c') { e.hp = 0; e.alive = false; } for (const [id, e] of s.sim.entities) if (e.type === 'c') s.sim.entities.delete(id); });
await page.waitForFunction(() => window.__app.session.sim.phase === 'build', null, { polling: 50 });
await ev(() => { window.__app.session.sim.phaseTime = 0.3; });
await page.waitForFunction(() => window.__app.vmode === 'hero', null, { polling: 50 });
check('Nächste Welle: Held lebt, wieder Heldenblick', (await state()).alive);
await page.waitForFunction(() => window.__app.session.sim.freeze <= 0);
await wait(1000);
await shot('naechste-welle-held');
// Einstellungen: Steuerung
await page.keyboard.press('Escape');
await wait(500);
if ((await state()).menu !== 'pause') { await page.keyboard.press('Escape'); await wait(500); }
await page.click('#screen-pause [data-go="settings"]'); await wait(800);
await page.click('#settings-tabs button:nth-child(3)'); await wait(800);
await shot('einstellungen-steuerung');
await page.evaluate(() => { const el = document.querySelector('.binds'); el && el.scrollIntoView(); });
await wait(300);
await shot('einstellungen-tastenbelegung');

const pred = await ev(() => ({ err: window.__app.controls.pred.err, snaps: window.__app.controls.pred.snaps, hin: window.__app.controls.stats.hin, casts: window.__app.controls.stats.casts, fps: document.getElementById('fps').textContent }));
console.log('Vorhersage/Netz:', JSON.stringify(pred));
fs.writeFileSync(path.join(out, 'controls.json'), JSON.stringify({ results, pred, errors: [...new Set(errors)] }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Steuerungsprüfungen bestanden`);
console.log('Fehler/Warnungen:', errors.length ? '\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'keine');
await browser.close();
await server.close();
process.exitCode = failed.length ? 1 : 0;
