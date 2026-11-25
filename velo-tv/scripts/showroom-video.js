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
const FPS = Number(arg('fps', 60));
const SEK = Number(arg('sek', 8));          // Sekunden je Rad (wie im Live-Showroom)
const MAX = Number(arg('max-slots', 0));     // nur zum Testen
const WORKERS = Number(arg('workers', Math.max(1, Math.min(4, os.cpus().length))));
const FORCE = !!arg('force', false);
const ALT = arg('alt', '');
const CHECK = !!arg('check', false);
// Verteilter Bau (GitHub-Matrix): --teil k --teile N rendert nur ein Stück; --zusammen <ordner> fügt alle Stücke zusammen.
const TEIL = arg('teil', ''), TEILE = Number(arg('teile', 0)), ZUSAMMEN = arg('zusammen', '');
const VERSION_SOLL = arg('version-soll', '');           // alle Stücke müssen denselben Bestand zeigen
const MAX_TEILE = 20;                                    // GitHub erlaubt 20 gleichzeitige Rechner (kostenlos)
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

const UHR_START = 60000; // virtuelle Uhr wird bei 60 s angehalten (Laden passiert davor in Echtzeit)

function ffmpeg(datei) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(FPS), datei], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fertig = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  return { schreib: (buf) => new Promise((res) => (p.stdin.write(buf) ? res() : p.stdin.once('drain', res))), ende: () => { p.stdin.end(); return fertig; } };
}

/* opts.bgAnzahl: Anzahl der vorberechneten Hintergrundbilder (/bgframes/00001.jpg …), sonst live WebGL */
async function segment(browser, base, daten, von, bis, datei, nr, opts) {
  opts = opts || {};
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript(rafShim(FPS));
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  const offset = von * SEK * 1000;
  await page.addInitScript(({ o, T }) => {
    window.HG_RENDER = 1; window.HG_T0 = -o; window.__vmSW = 1;
    // Nahtlose Endlosschleife: Dauer-Animationen (Laufband, Halo, Verlauf, Ring …) laufen minimal schneller/langsamer,
    // so dass genau eine ganze Zahl Durchläufe in die Videolänge T passt → letztes Bild geht exakt ins erste über.
    var takt = function (a) {
      try {
        var tm = a.effect.getTiming(), D = Number(tm.duration);
        if (tm.iterations !== Infinity || !(D > 0) || !(T > 0)) return 1;
        var P = D * (/alternate/.test(tm.direction) ? 2 : 1);
        return P * Math.max(1, Math.round(T / P)) / T;
      } catch (e) { return 1; }
    };
    if (window.__bgAnzahl) window.HG_AUS = 1;
    // CSS-Animationen an die virtuelle Uhr koppeln: Dauer-Animationen absolut (lückenlos über Segmente), neue ab ihrem Start
    window.__vtTick = function (t) {
      document.getAnimations().forEach(function (a) {
        if (a.__vt == null) {
          // CSS-Endlos-Animationen werden vom Browser manchmal neu erzeugt – Startzeit je Element+Name merken, sonst springt sie auf Anfang
          var el = a.effect && a.effect.target, nm = a.animationName;
          var m = el && nm ? (el.__vtStart || (el.__vtStart = {})) : null;
          if (m && m[nm] != null) a.__vt = m[nm];
          else { a.__vt = window.__vtLaeuft ? t : -o; if (m) m[nm] = a.__vt; }
          try { a.pause(); } catch (e) { /* egal */ }
        }
        if (a.__vf == null) a.__vf = a.__vt === -o ? takt(a) : 1;   // nur durchgehende Animationen (nicht die je Rad)
        try { a.currentTime = Math.max(0, t - a.__vt) * a.__vf; } catch (e) { /* egal */ }
      });
    };
  }, { o: offset, T: opts.gesamt || 0 });
  if (opts.bgAnzahl) await page.addInitScript((n) => { window.__bgAnzahl = n; }, opts.bgAnzahl);
  await page.clock.install({ time: 0 });
  await page.goto(base + '/?render=1', { waitUntil: 'load' });
  if (opts.bgAnzahl) {
    // Hintergrund = fertige Bilder der Schleife; WebGL-Hintergrund aus (spart 95 % Rechenzeit)
    await page.addStyleTag({ content: '#hg{display:none!important} html.hg-an #stage,#stage{background:transparent!important} #bgf{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;object-fit:cover}' });
    await page.addStyleTag({ content: '#bgf2{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;object-fit:cover;opacity:0}' });
    await page.evaluate(() => {
      window.HG_PAUSE = true;
      const i = document.createElement('img'); i.id = 'bgf'; const j = document.createElement('img'); j.id = 'bgf2';
      document.body.insertBefore(j, document.body.firstChild); document.body.insertBefore(i, document.body.firstChild);
    });
  }
  // Bilder vorladen + dekodieren, Hintergrund-Texturen laden lassen
  await page.evaluate(async (d) => {
    const urls = [...new Set(d.items.flatMap((x) => [x.img, x.logo]).filter(Boolean))];
    await Promise.all(urls.map((u) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = () => (im.decode ? im.decode().catch(() => {}).then(r) : r()); im.src = u; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }, daten);
  // Uhr anhalten: ab jetzt läuft die Zeit nur noch über runFor (exakt 1/30 s je Videobild)
  await page.clock.pauseAt(UHR_START);
  for (let k = 0; k < 40; k++) { await page.clock.runFor(16); await page.waitForTimeout(50); }
  await page.evaluate(({ d, s }) => { window.__srEl = window.VeloRender(d, s); }, { d: daten, s: von });
  for (let k = 0; k < 20; k++) { await page.clock.runFor(0); await page.waitForTimeout(30); }
  // Startzustand einmal wirklich zeichnen lassen, sonst springt der erste Übergang (Text verschwindet ohne Animation)
  await page.evaluate(() => { document.querySelectorAll('.sr .deal > *, .sr .sp-b').forEach((e) => getComputedStyle(e).transform); return document.body.offsetWidth; });
  await page.screenshot({ type: 'jpeg', quality: 10, timeout: 0 });
  // bereits laufende Dauer-Animationen auf die absolute Zeit des Segments setzen (lückenlos über Segmentgrenzen)
  await page.evaluate(() => { window.__vtTick(0); window.__vtLaeuft = true; });

  const enc = ffmpeg(datei);
  const proSlot = SEK * FPS, frames = (bis - von) * proSlot, dt = 1000 / FPS;
  let t = 0;
  for (let f = 0; f < frames; f++) {
    if (f % proSlot === 0) {
      // Wechsel zum nächsten Rad; Vorbereitung der Verwandlung abwarten (echte Zeit, virtuelle Uhr steht)
      // Wechsel auslösen und neue Übergänge sofort an die virtuelle Uhr binden (sonst laufen sie während der Vorbereitung in Echtzeit ab)
      await page.evaluate((tt) => { window.__srEl._wechsel(); document.body.offsetWidth; window.__vtTick(tt); }, t);
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
      const n = opts.bgAnzahl, gf = (opts.gesamt / 1000) * FPS;                 // Hintergrundbilder / Videobilder gesamt
      const fak = gf > 0 ? n * Math.max(1, Math.round(gf / n)) / gf : 1;       // ganze Zahl Schleifen in der Videolänge
      const pos = ((offset + t) / 1000 * FPS * fak) % n, a = Math.floor(pos), mix = Math.round((pos - a) * 100) / 100;
      const src = (k) => '/bgframes/' + String((k % n) + 1).padStart(5, '0') + '.jpg';
      await page.evaluate(async ({ tt, s1, s2, mix }) => {
        window.__vtTick(tt);
        const i = document.getElementById('bgf'), j = document.getElementById('bgf2');
        i.src = s1; j.src = s2; j.style.opacity = String(mix);
        await Promise.all([i, j].map((x) => (x.decode ? x.decode().catch(() => {}) : null)));
        window.HG_PAUSE = true;
      }, { tt: t, s1: src(a), s2: src(a + 1), mix });
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

/* Bildwiederholung (requestAnimationFrame) fest an die virtuelle Uhr koppeln: genau 1 Bild je Videobild */
function rafShim(fps) {
  return `(function(){var ms=1000/${fps};window.requestAnimationFrame=function(cb){return setTimeout(function(){cb(performance.now())},ms)};window.cancelAnimationFrame=function(id){clearTimeout(id)}})();`;
}

async function hgSegment(browser, base, von, bis, datei, nr) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript(rafShim(FPS));
  await page.addInitScript((o) => { window.HG_RENDER = 1; window.HG_RENDER_DPR = 0.8; window.HG_T0 = -o; }, von * 1000);
  await page.clock.install({ time: 0 });
  await page.goto(base + '/?render=1', { waitUntil: 'load' });
  await page.evaluate(() => { document.documentElement.classList.add('hg-an'); window.HG_PAUSE = false; });
  await page.clock.pauseAt(UHR_START);
  for (let k = 0; k < 40; k++) { await page.clock.runFor(34); await page.waitForTimeout(80); }   // Texturen laden
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
    dataDir: dir, playerDir: path.join(R, 'src/player'), version: 'render', showroomAutoStart: false, tvSteuerung: false,
    assetDirs: { '/assets/': path.join(R, 'src/renderer/assets'), '/shared/': path.join(R, 'src/shared') }
  });
  const port = await srv.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + port;
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const starte = () => chromium.launch(Object.assign({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] }, exe));
  try {
    if (HG_MODUS) {
      // Hintergrund-Schleife: L+B Sekunden rendern, Ende weich in den Anfang überblenden → nahtlos
      const gesamt = HG_LAENGE + HG_BLENDE, w = 1,  // ein Durchgang: keine Naht zwischen Rechensträngen
        browser = await starte(), t0 = Date.now();
      const teile = [...Array(w)].map((_, k) => [k * gesamt / w, (k + 1) * gesamt / w]);
      const dateien = teile.map((_, k) => path.join(dir, 'hg' + k + '.mp4'));
      await Promise.all(teile.map(([a, b], k) => hgSegment(browser, base, a, b, dateien[k], k)));
      await browser.close();
      const roh = path.join(dir, 'hg-roh.mp4');
      await concat(dateien, roh);
      const B = HG_BLENDE, L = HG_LAENGE;
      await ff(['-i', roh, '-filter_complex',
        `[0:v]split=3[a][b][c];[a]trim=0:${B},setpts=PTS-STARTPTS[p1];[b]trim=${B}:${L},setpts=PTS-STARTPTS[p2];[c]trim=${L}:${L + B},setpts=PTS-STARTPTS[p3];` +
        `[p3][p1]blend=all_expr='A*(1-N/${B * FPS - 1})+B*(N/${B * FPS - 1})'[x];[p2][x]concat=n=2:v=1:a=0,format=yuv420p[v]`,
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
      const N = Math.min(MAX_TEILE, items.length);
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
        'changed=true\nversion=' + version + '\nteile=' + N + '\nmatrix=' + JSON.stringify([...Array(N).keys()]) + '\n');
      return;
    }
    if (VERSION_SOLL && VERSION_SOLL !== true && VERSION_SOLL !== version)
      throw new Error('Bestand hat sich während des Baus geändert (' + version + ' statt ' + VERSION_SOLL + ') – der nächste stündliche Lauf baut neu.');
    const metaSchreiben = (ziel, morph) => {
      const meta = {
        version, ts: Date.now(), stand: d.stand || '', anzahl: items.length, dauer: items.length * SEK, fps: FPS, sekProRad: SEK, naht: 'takt',
        groesse: fs.statSync(ziel).size, morph,
        items: items.map((x) => ({ marke: x.marke, modell: x.modell, farbe: x.farbe, angebot: x.angebot }))
      };
      fs.writeFileSync(path.join(OUT, 'showroom-video.json'), JSON.stringify(meta, null, 1));
      log('Fertig: ' + ziel + ' (' + Math.round(meta.groesse / 1e6) + ' MB, ' + meta.dauer + ' s)');
    };
    if (ZUSAMMEN) {
      const quelle = path.resolve(ZUSAMMEN);
      const stuecke = fs.readdirSync(quelle).filter((f) => /^teil-\d+\.mp4$/.test(f)).sort();
      const infos = stuecke.map((f) => JSON.parse(fs.readFileSync(path.join(quelle, f.replace('.mp4', '.json')), 'utf8')));
      if (!stuecke.length || infos.some((i) => i.version !== version) || infos[0].teile !== stuecke.length)
        throw new Error('Stücke unvollständig oder aus anderem Bestand: ' + stuecke.length + ' Stücke');
      const ziel = path.join(OUT, 'showroom.mp4');
      await concat(stuecke.map((f) => path.join(quelle, f)), ziel, ['-movflags', '+faststart']);
      metaSchreiben(ziel, infos.every((i) => i.morph));
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
    const n = items.length;
    // Bereich dieses Rechners: alles oder nur ein Stück (verteilter Bau)
    let A = 0, Bis = n;
    if (TEIL !== '' && TEILE > 0) { const k = Number(TEIL); A = Math.floor(k * n / TEILE); Bis = Math.floor((k + 1) * n / TEILE); }
    const w = Math.max(1, Math.min(WORKERS, Bis - A)), teile = [];
    for (let k = 0; k < w; k++) teile.push([A + Math.floor(k * (Bis - A) / w), A + Math.floor((k + 1) * (Bis - A) / w)]);
    const t0 = Date.now();
    const dateien = teile.map((_, k) => path.join(dir, 'seg' + k + '.mp4'));
    const infos = await Promise.all(teile.map(([a, b], k) => segment(browser, base, daten, a, b, dateien[k], k, { bgAnzahl, gesamt: n * SEK * 1000 })));
    await browser.close();
    log('Segmente fertig in ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(infos));

    if (TEIL !== '' && TEILE > 0) {
      const name = 'teil-' + String(TEIL).padStart(2, '0');
      await concat(dateien, path.join(OUT, name + '.mp4'));
      fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ version, teil: Number(TEIL), teile: TEILE, von: A, bis: Bis, morph: infos.every((i) => i.vm) }));
      log('Stück ' + TEIL + '/' + TEILE + ' fertig (Räder ' + A + '–' + (Bis - 1) + ')');
      return;
    }
    const ziel = path.join(OUT, 'showroom.mp4');
    await concat(dateien, ziel, ['-movflags', '+faststart']);
    metaSchreiben(ziel, infos.every((i) => i.vm));
  } finally {
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
