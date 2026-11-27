// Erzeugt das Programm-Symbol: fünf farbige Sortenbalken (wie die Handy-App).
// Ausgabe: assets/icon.png (256), assets/tray.png (32), assets/icon.ico (16–256, PNG-gepackt).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

// Fünf Sortenbalken auf warmem Graphit – dasselbe Zeichen wie in der Handy-App und im Programm
const FARBEN = ['#5fd38a', '#4fc3b8', '#f6c945', '#f59a3c', '#ec5a3f'];
const HOEHE = [30, 20, 26, 14, 22];
const svg = (s) => {
  const klein = s <= 32;
  const innen = s * (klein ? 0.86 : 0.7), b = innen / (klein ? 7.6 : 9.2), g = b * (klein ? 0.4 : 0.55), x0 = (s - (5 * b + 4 * g)) / 2, boden = s * 0.5 + innen * 0.36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#1b1815"/>${FARBEN.map((f, i) => {
    const hh = HOEHE[i] / 30 * innen * 0.72; return `<rect x="${(x0 + i * (b + g)).toFixed(2)}" y="${(boden - hh).toFixed(2)}" width="${b.toFixed(2)}" height="${hh.toFixed(2)}" rx="${(b * 0.4).toFixed(2)}" fill="${f}"/>`; }).join('')}</svg>`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const png = async (s) => {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0">${svg(s)}</body></html>`);
  return page.screenshot({ clip: { x: 0, y: 0, width: s, height: s }, omitBackground: true });
};
mkdirSync('assets', { recursive: true });
const groessen = [16, 24, 32, 48, 64, 128, 256];
const bilder = {};
for (const s of groessen) bilder[s] = await png(s);
await browser.close();
writeFileSync('assets/icon.png', bilder[256]);
writeFileSync('assets/tray.png', bilder[32]);
// ICO mit eingebetteten PNGs
const kopf = Buffer.alloc(6); kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(groessen.length, 4);
let versatz = 6 + 16 * groessen.length;
const eintraege = [], daten = [];
for (const s of groessen) {
  const b = bilder[s]; const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0); e.writeUInt8(s >= 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(b.length, 8); e.writeUInt32LE(versatz, 12);
  versatz += b.length; eintraege.push(e); daten.push(b);
}
writeFileSync('assets/icon.ico', Buffer.concat([kopf, ...eintraege, ...daten]));
console.log('Symbole geschrieben.');
