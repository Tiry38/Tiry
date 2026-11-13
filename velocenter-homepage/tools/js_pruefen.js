#!/usr/bin/env node
/* Prüft eine gebaute Seite: jedes eingebettete Skript muss sich fehlerfrei übersetzen lassen (wird NICHT ausgeführt),
   JSON-LD muss gültiges JSON sein, <title> genau einmal. Aufruf: node js_pruefen.js <index.html> */
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
let fehler = 0, n = 0;
for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  const attr = m[1] || '', code = m[2];
  if (/\ssrc=/i.test(attr) || !code.trim()) continue;
  n++;
  try {
    if (/application\/(ld\+)?json/i.test(attr)) JSON.parse(code);
    else if (/type=["']?module/i.test(attr)) continue;
    else new vm.Script(code);
  } catch (e) { fehler++; console.error('Skript ' + n + ': ' + e.message); }
}
const titel = (html.match(/<title>/gi) || []).length;
if (titel !== 1) { fehler++; console.error('<title> kommt ' + titel + '× vor (muss genau 1× sein).'); }
console.log(n + ' Skripte geprüft, ' + fehler + ' Fehler.');
process.exit(fehler ? 1 : 0);
