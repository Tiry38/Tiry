// Mini-Webserver für das Spiel im Browser (http://localhost:5180). Auch von scripts/smoke.mjs genutzt:
//   import { startServer } from './serve.mjs'; const srv = await startServer(0); … srv.close();
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.hdr': 'application/octet-stream',
  '.md': 'text/markdown; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

/** Startet den Server; port 0 = freier Port. Liefert { port, url, close() }. */
export function startServer(port = +process.env.PORT || 5180) {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.normalize(path.join(root, u === '/' ? 'index.html' : u));
    if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({ port: p, url: `http://localhost:${p}/`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer();
  console.log(`Aetherfront läuft auf ${s.url}`);
}
