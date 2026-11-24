// Ereignisse + Szenen eines Schnitts als JSON: node tools/dump.js <cut> <w> <h> > out.json
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const [cut, w, h] = process.argv.slice(2); const root = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?w=${w}&h=${h}&cut=${cut}`); await p.evaluate(() => window.__film.ready);
  const d = await p.evaluate(() => { const f = window.__film; return { T: f.TOTAL, scenes: f.scenes.map(s => ({ k: s.kind, ti: s.ti, t0: s.t0, dur: s.dur, pace: s.pace })), sfx: f.ev.sfx, caps: f.ev.caps, notes: f.ev.notes, heads: f.ev.heads, color: f.ev.color, beam: f.ev.beam }; });
  process.stdout.write(JSON.stringify(d)); await b.close(); srv.close();
});
