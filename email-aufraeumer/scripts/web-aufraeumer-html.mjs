// Baut web/aufraeumer.html aus der PC-Oberfläche (src/renderer/index.html) – gleiche Seite, gleiche Funktionen,
// nur mit Handy-Kern statt Electron. Läuft vor jedem „npm run web“, damit beides nie auseinanderläuft.
import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('src/renderer/index.html', 'utf8');
html = html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://gmail.googleapis.com; frame-src 'none'; object-src 'none'; base-uri 'self'">`)
  .replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#1b1815">\n<link rel="manifest" href="manifest.webmanifest">')
  .replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="../src/renderer/style.css">')
  .replace('<body data-ansicht="cockpit">', '<body data-ansicht="cockpit" class="handy">')
  .replace('<script type="module" src="app.js"></script>', '<script type="module" src="./aufraeumer.ts"></script>');
writeFileSync('web/aufraeumer.html', `<!-- automatisch erzeugt aus src/renderer/index.html (scripts/web-aufraeumer-html.mjs) – nicht von Hand ändern -->\n${html}`);
console.log('web/aufraeumer.html erzeugt');
