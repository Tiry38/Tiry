// Symbole der Handy-App: fünf Sortenbalken auf warmem Graphit (wie das Logo im Programm).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const FARBEN = ['#5fd38a', '#4fc3b8', '#f6c945', '#f59a3c', '#ec5a3f'];
const HOEHE = [30, 20, 26, 14, 22];
const svg = (s, rand) => {
  const innen = s * (1 - rand * 2), b = innen / 9.2, g = b * 0.55, x0 = (s - (5 * b + 4 * g)) / 2, boden = s * 0.5 + innen * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="#1b1815"/>${FARBEN.map((f, i) => {
    const hh = HOEHE[i] / 30 * innen * 0.6; return `<rect x="${x0 + i * (b + g)}" y="${boden - hh}" width="${b}" height="${hh}" rx="${b * 0.42}" fill="${f}"/>`; }).join('')}</svg>`;
};
const browser = await chromium.launch(); const page = await browser.newPage();
const png = async (s, rand) => { await page.setViewportSize({ width: s, height: s }); await page.setContent(`<body style="margin:0">${svg(s, rand)}</body>`); return page.screenshot({ clip: { x: 0, y: 0, width: s, height: s } }); };
writeFileSync('web/public/icon-192.png', await png(192, 0.16));
writeFileSync('web/public/icon-512.png', await png(512, 0.16));
writeFileSync('web/public/icon-maskable-512.png', await png(512, 0.26));
writeFileSync('web/public/apple-touch-icon.png', await png(180, 0.14));
await browser.close();
console.log('Symbole erzeugt');
