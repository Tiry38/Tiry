// Standbilder zu bestimmten Zeiten: node tools/snap.js <cut> <w> <h> <t1,t2,...> <outprefix> [dpr]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const [cut, w, h, times, out, dpr = '1'] = process.argv.slice(2);
const root = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.webp') ? 'image/webp' : 'font/woff2' }); r.end(d); }); }).listen(0, async () => {
  const port = srv.address().port; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1) });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(`http://127.0.0.1:${port}/index.html?w=${w}&h=${h}&cut=${cut}&dpr=${process.env.DPR || 1}&ip=${process.env.IP || ""}`); await p.evaluate(() => window.__film.ready);
  const info = await p.evaluate(() => ({ T: window.__film.TOTAL, sc: window.__film.scenes.map(s => [s.kind, s.ti, +s.t0.toFixed(2), +s.dur.toFixed(2)]) }));
  console.log(JSON.stringify(info));
  for (const t of times.split(',').filter(Boolean)) { await p.evaluate(t => window.__film.seek(t), +t); await p.screenshot({ path: `${out}_${t}.png` }); }
  await b.close(); srv.close();
});
