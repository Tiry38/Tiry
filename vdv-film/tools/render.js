// Frame-Renderer: node tools/render.js <cut> <w> <h> <dpr> <fps> <outdir> <workers> [maxSeconds]
// Jedes Bild ist eine reine Funktion der Zeit (seek), daher parallel renderbar.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const [cut, w, h, dpr, fps, outdir, workers = '3', maxS] = process.argv.slice(2);
const root = path.resolve(__dirname, '..'); fs.mkdirSync(outdir, { recursive: true });
const types = { html: 'text/html', js: 'text/javascript', webp: 'image/webp', woff2: 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[f.split('.').pop()] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const url = `http://127.0.0.1:${srv.address().port}/index.html?w=${w}&h=${h}&cut=${cut}&dpr=${dpr}`;
  const b = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const probe = await b.newPage({ viewport: { width: +w, height: +h } }); await probe.goto(url); await probe.evaluate(() => window.__film.ready);
  let T = await probe.evaluate(() => window.__film.TOTAL); await probe.close(); if (maxS) T = Math.min(T, +maxS);
  const N = Math.round(T * +fps); const K = +workers; let done = 0; const t0 = Date.now();
  await Promise.all([...Array(K)].map(async (_, k) => {
    const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(url); await p.evaluate(() => window.__film.ready);
    for (let i = k; i < N; i += K) {
      const f = path.join(outdir, `f${String(i).padStart(6, '0')}.jpg`);
      if (fs.existsSync(f)) { done++; continue; }
      await p.evaluate(t => window.__film.seek(t), i / +fps);
      await p.screenshot({ path: f, type: 'jpeg', quality: 93 });
      if (++done % 300 === 0) console.log(`${done}/${N} ${((Date.now() - t0) / done).toFixed(0)} ms/Bild`);
    }
  }));
  console.log('fertig', N, 'Bilder', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await b.close(); srv.close();
});
