#!/usr/bin/env node
/* Velo-TV – Showroom-Video rendern (läuft stündlich in GitHub Actions, Workflow velo-tv-showroom.yml).
   Holt die Angebotsräder (gleiche Logik wie die Zentrale), prüft ob sich etwas geändert hat, und berechnet
   den Showroom Bild für Bild mit virtueller Uhr – exakt wie im Browser, aber ohne Ruckeln, weil jedes Bild
   in Ruhe gerechnet wird. Ergebnis: showroom.mp4 (1920×1080, 30 Bilder/s, H.264) + showroom-video.json.

   node scripts/showroom-video.js --out <ordner> [--alt <url der alten json>] [--force] [--max-slots N] [--workers N]
   Benötigt: ffmpeg im PATH, Playwright-Chromium. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { createServer } = require('../src/server/server');

const R = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = path.resolve(arg('out', path.join(R, 'video-out')));
const FPS = Number(arg('fps', 30));
const SEK = Number(arg('sek', 8));          // Sekunden je Rad (wie im Live-Showroom)
const MAX = Number(arg('max-slots', 0));     // nur zum Testen
const WORKERS = Number(arg('workers', Math.max(1, Math.min(4, os.cpus().length))));
const FORCE = !!arg('force', false);
const ALT = arg('alt', '');
const CHECK = !!arg('check', false);
const HG_MODUS = !!arg('hintergrund', false);           // nur die Hintergrund-Schleife rendern
const HG_DATEI = arg('hintergrund-datei', '');           // fertige Hintergrund-Schleife für das Showroom-Video
const HG_LAENGE = 24, HG_BLENDE = 3;                     // Schleife 24 s, nahtlos überblendet   // nur prüfen, ob sich etwas geändert hat (Ausgabe changed=true/false)
const log = (...a) => console.log('[showroom-video]', ...a);

// Design-Fingerabdruck: ändert sich der Showroom-Code, wird neu gerendert
const DESIGN_DATEIEN = ['src/player/showroom.js', 'src/player/showroom.css', 'src/player/player.css', 'src/player/vendor/hg12.js', 'src/player/vendor/morph.js', 'scripts/showroom-video.js'];

/** feste Reihenfolge: Marken im Wechsel (reihum), innerhalb der Marke nach Modell */
function reihenfolge(items) {
  const g = new Map();
  for (const x of items) { const k = x.markeKey || x.marke; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  const keys = [...g.keys()].sort();
  keys.forEach((k) => g.get(k).sort((a, b) => (a.modell + a.farbe + a.gr).localeCompare(b.modell + b.farbe + b.gr)));
  const out = [];
  for (let weiter = true; weiter;) { weiter = false; for (const k of keys) { const l = g.get(k); if (l.length) { out.push(l.shift()); weiter = true; } } }
  return out;
}

function ffmpeg(datei) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), datei], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fertig = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  return { schreib: (buf) => new Promise((res) => (p.stdin.write(buf) ? res() : p.stdin.once('drain', res))), ende: () => { p.stdin.end(); return fertig; } };
}

/* opts.bgAnzahl: Anzahl der vorberechneten Hintergrundbilder (/bgframes/00001.jpg …), sonst live WebGL */
async function segment(browser, base, daten, von, bis, datei, nr, opts) {
  opts = opts || {};
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  const offset = von * SEK * 1000;
  await page.addInitScript((o) => {
    window.HG_RENDER = 1; window.HG_T0 = -o; window.__vmSW = 1;
    if (window.__bgAnzahl) window.HG_AUS = 1;
    // CSS-Animationen an die virtuelle Uhr koppeln: Dauer-Animationen absolut (lückenlos über Segmente), neue ab ihrem Start
    window.__vtTick = function (t) {
      document.getAnimations().forEach(function (a) {
        if (a.__vt == null) { a.__vt = window.__vtLaeuft ? t : -o; try { a.pause(); } catch (e) { /* egal */ } }
        try { a.currentTime = Math.max(0, t - a.__vt); } catch (e) { /* egal */ }
      });
    };
  }, offset);
  if (opts.bgAnzahl) await page.addInitScript((n) => { window.__bgAnzahl = n; }, opts.bgAnzahl);
  await page.clock.install({ time: 0 });
  await page.goto(base + '/?render=1', { waitUntil: 'load' });
  if (opts.bgAnzahl) {
    // Hintergrund = fertige Bilder der Schleife; WebGL-Hintergrund aus (spart 95 % Rechenzeit)
    await page.addStyleTag({ content: '#hg{display:none!important} html.hg-an #stage,#stage{background:transparent!important} #bgf{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;object-fit:cover}' });
    await page.evaluate(() => { window.HG_PAUSE = true; const i = document.createElement('img'); i.id = 'bgf'; document.body.insertBefore(i, document.body.firstChild); });
  }
  // Bilder vorladen + dekodieren, Hintergrund-Texturen laden lassen
  await page.evaluate(async (d) => {
    const urls = [...new Set(d.items.flatMap((x) => [x.img, x.logo]).filter(Boolean))];
    await Promise.all(urls.map((u) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = () => (im.decode ? im.decode().catch(() => {}).then(r) : r()); im.src = u; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }, daten);
  for (let k = 0; k < 40; k++) { await page.clock.runFor(16); await page.waitForTimeout(50); }
  await page.evaluate(({ d, s }) => { window.__srEl = window.VeloRender(d, s); }, { d: daten, s: von });
  for (let k = 0; k < 20; k++) { await page.clock.runFor(0); await page.waitForTimeout(30); }
  await page.evaluate(() => { window.__vtLaeuft = true; });

  const enc = ffmpeg(datei);
  const proSlot = SEK * FPS, frames = (bis - von) * proSlot, dt = 1000 / FPS;
  let t = 0;
  for (let f = 0; f < frames; f++) {
    if (f % proSlot === 0) {
      // Wechsel zum nächsten Rad; Vorbereitung der Verwandlung abwarten (echte Zeit, virtuelle Uhr steht)
      await page.evaluate(() => window.__srEl._wechsel());
      for (let k = 0; k < 200; k++) {
        await page.clock.runFor(0);
        const bereit = await page.evaluate(() => { const h = document.querySelector('.sr .hvis'); return !window.VM || !VM.on || !VM.ok || (h && h.classList.contains('vmrun')); });
        if (bereit) break;
        await page.waitForTimeout(25);
      }
    }
    await page.clock.runFor(dt);
    t += dt;
    if (opts.bgAnzahl) {
      const k = (Math.round((offset + t) / 1000 * FPS) % opts.bgAnzahl) + 1;
      await page.evaluate(async ({ tt, src }) => { window.__vtTick(tt); const i = document.getElementById('bgf'); i.src = src; if (i.decode) await i.decode().catch(() => {}); window.HG_PAUSE = true; },
        { tt: t, src: '/bgframes/' + String(k).padStart(5, '0') + '.jpg' });
    } else await page.evaluate((tt) => window.__vtTick(tt), t);
    await enc.schreib(await page.screenshot({ type: 'jpeg', quality: 92, timeout: 0 }));
    if (f % (FPS * 10) === 0) log(`Segment ${nr}: ${Math.round(f / frames * 100)} %`);
  }
  await enc.ende();
  const info = await page.evaluate(() => ({ vm: !!(window.VM && VM.ok && VM.on), hg: window.HG12_STAT ? HG12_STAT() : null }));
  await page.close();
  if (fehler.length) log('Seitenfehler Segment ' + nr + ':', fehler.slice(0, 3));
  return info;
}

/** Hintergrund-Schleife (nur WebGL-Herbstallee) für Zeitraum [von, bis) Sekunden */
async function hgSegment(browser, base, von, bis, datei, nr) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript((o) => { window.HG_RENDER = 1; window.HG_RENDER_DPR = 0.8; window.HG_T0 = -o; }, von * 1000);
  await page.clock.install({ time: 0 });
  await page.goto(base + '/?render=1', { waitUntil: 'load' });
  await page.evaluate(() => { document.documentElement.classList.add('hg-an'); window.HG_PAUSE = false; });
  for (let k = 0; k < 40; k++) { await page.clock.runFor(16); await page.waitForTimeout(80); }   // Texturen laden
  const enc = ffmpeg(datei), frames = Math.round((bis - von) * FPS);
  // Zeit zurück auf den Segment-Anfang: Kamera-Glättung ist eingeschwungen, Szene-Zeit = von + t
  await page.evaluate((o) => { window.HG_T0 = -o + performance.now(); }, von * 1000);
  for (let f = 0; f < frames; f++) {
    await page.clock.runFor(1000 / FPS);
    await enc.schreib(await page.screenshot({ type: 'jpeg', quality: 95, timeout: 0 }));
    if (f % (FPS * 5) === 0) log(`Hintergrund ${nr}: ${Math.round(f / frames * 100)} %`);
  }
  await enc.ende();
  await page.close();
}

function ff(args) { return new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))))); }

async function concat(dateien, ziel, extra) {
  const liste = ziel + '.txt';
  fs.writeFileSync(liste, dateien.map((f) => "file '" + f.replace(/'/g, "'\\''") + "'").join('\n'));
  await ff(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', ...(extra || []), ziel]);
  fs.unlinkSync(liste);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velotv-render-'));
  const srv = createServer({
    dataDir: dir, playerDir: path.join(R, 'src/player'), version: 'render', showroomAutoStart: false,
    assetDirs: { '/assets/': path.join(R, 'src/renderer/assets'), '/shared/': path.join(R, 'src/shared') }
  });
  const port = await srv.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + port;
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const starte = () => chromium.launch(Object.assign({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] }, exe));
  try {
    if (HG_MODUS) {
      // Hintergrund-Schleife: L+B Sekunden rendern, Ende weich in den Anfang überblenden → nahtlos
      const gesamt = HG_LAENGE + HG_BLENDE, w = Math.min(2, WORKERS), browser = await starte(), t0 = Date.now();
      const teile = [...Array(w)].map((_, k) => [k * gesamt / w, (k + 1) * gesamt / w]);
      const dateien = teile.map((_, k) => path.join(dir, 'hg' + k + '.mp4'));
      await Promise.all(teile.map(([a, b], k) => hgSegment(browser, base, a, b, dateien[k], k)));
      await browser.close();
      const roh = path.join(dir, 'hg-roh.mp4');
      await concat(dateien, roh);
      const B = HG_BLENDE, L = HG_LAENGE;
      await ff(['-i', roh, '-filter_complex',
        `[0:v]split=3[a][b][c];[a]trim=0:${B},setpts=PTS-STARTPTS[p1];[b]trim=${B}:${L},setpts=PTS-STARTPTS[p2];[c]trim=${L}:${L + B},setpts=PTS-STARTPTS[p3];` +
        `[p3][p1]blend=all_expr='A*(1-T/${B})+B*(T/${B})'[x];[p2][x]concat=n=2:v=1:a=0,format=yuv420p[v]`,
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-r', String(FPS), '-movflags', '+faststart', path.join(OUT, 'hintergrund.mp4')]);
      log('Hintergrund-Schleife fertig in ' + Math.round((Date.now() - t0) / 1000) + ' s');
      return;
    }
    const r = await fetch(base + '/api/showroom/refresh', { method: 'POST', headers: { 'X-Key': srv.localKey } });
    const stat = await r.json();
    if (stat.fehler) throw new Error('Bestand: ' + stat.fehler);
    const d = await (await fetch(base + '/api/showroom')).json();
    let items = reihenfolge(d.items);
    if (MAX) items = items.slice(0, MAX);
    if (!items.length) throw new Error('Keine Angebotsräder mit Foto gefunden');

    const design = crypto.createHash('sha1');
    for (const f of DESIGN_DATEIEN) design.update(fs.readFileSync(path.join(R, f)));
    const inhalt = items.map((x) => [x.quelle, x.marke, x.modell, x.farbe, x.gr, x.jahr, x.preis, x.angebot]);
    const version = crypto.createHash('sha1').update(JSON.stringify({ inhalt, design: design.digest('hex'), FPS, SEK })).digest('hex').slice(0, 16);
    log(items.length + ' Angebote, Version ' + version);

    if (ALT && !FORCE) {
      try {
        const alt = await (await fetch(ALT + '?v=' + Date.now(), { redirect: 'follow' })).json();
        if (alt && alt.version === version) {
          log('Unverändert – kein neues Video nötig.');
          if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n');
          return;
        }
      } catch (e) { log('Alte Version nicht lesbar – rendere neu.'); }
    }

    if (CHECK) {
      log('Geändert (oder erzwungen) – neues Video wird gebaut.');
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
      return;
    }
    const daten = { items };
    // fertige Hintergrund-Schleife in Einzelbilder zerlegen und unter /bgframes/ bereitstellen
    let bgAnzahl = 0;
    if (HG_DATEI) {
      const bgDir = path.join(dir, 'bg');
      fs.mkdirSync(bgDir);
      await ff(['-i', path.resolve(HG_DATEI), '-q:v', '2', path.join(bgDir, '%05d.jpg')]);
      bgAnzahl = fs.readdirSync(bgDir).filter((f) => f.endsWith('.jpg')).length;
      srv.assetDirs['/bgframes/'] = bgDir;
      log('Hintergrund: ' + bgAnzahl + ' Bilder');
    }
    const browser = await starte();
    const n = items.length, w = Math.min(WORKERS, n), teile = [];
    for (let k = 0; k < w; k++) teile.push([Math.floor(k * n / w), Math.floor((k + 1) * n / w)]);
    const t0 = Date.now();
    const dateien = teile.map((_, k) => path.join(dir, 'seg' + k + '.mp4'));
    const infos = await Promise.all(teile.map(([a, b], k) => segment(browser, base, daten, a, b, dateien[k], k, { bgAnzahl })));
    await browser.close();
    log('Segmente fertig in ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(infos));

    const ziel = path.join(OUT, 'showroom.mp4');
    await concat(dateien, ziel, ['-movflags', '+faststart']);
    const meta = {
      version, ts: Date.now(), stand: d.stand || '', anzahl: items.length, dauer: items.length * SEK, fps: FPS, sekProRad: SEK,
      groesse: fs.statSync(ziel).size, morph: infos.every((i) => i.vm),
      items: items.map((x) => ({ marke: x.marke, modell: x.modell, farbe: x.farbe, angebot: x.angebot }))
    };
    fs.writeFileSync(path.join(OUT, 'showroom-video.json'), JSON.stringify(meta, null, 1));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
    log('Fertig: ' + ziel + ' (' + Math.round(meta.groesse / 1e6) + ' MB, ' + meta.dauer + ' s)');
  } finally {
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
