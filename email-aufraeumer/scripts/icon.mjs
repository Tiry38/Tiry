// Erzeugt das Programm-Symbol: drei Sieb-Linien, ein Tintentropfen fällt durch, ein roter wird ausgesiebt.
// Ausgabe: assets/icon.png (256), assets/tray.png (32), assets/icon.ico (16–256, PNG-gepackt).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#f4f0e7"/>
  <rect x="1.5" y="1.5" width="61" height="61" fill="none" stroke="#12161d" stroke-width="3"/>
  <g stroke="#12161d" stroke-width="${s <= 32 ? 4 : 3}" stroke-linecap="square">
    <line x1="10" y1="22" x2="40" y2="22"/><line x1="10" y1="34" x2="40" y2="34"/><line x1="10" y1="46" x2="40" y2="46"/>
  </g>
  <path d="M42 18 L52 24 L52 56" fill="none" stroke="#12161d" stroke-width="${s <= 32 ? 3 : 2}"/>
  <circle cx="25" cy="54" r="5" fill="#12161d"/>
  <circle cx="47" cy="${s <= 32 ? 34 : 33}" r="6" fill="#eb2100"/>
</svg>`;

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
