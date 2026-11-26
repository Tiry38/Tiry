// Startsymbole der Android-App aus demselben Motiv wie die Handy-App (fünf Sortenbalken auf Graphit).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const FARBEN = ['#5fd38a', '#4fc3b8', '#f6c945', '#f59a3c', '#ec5a3f'];
const HOEHE = [30, 20, 26, 14, 22];
const svg = (s) => {
  const innen = s * 0.68, b = innen / 9.2, g = b * 0.55, x0 = (s - (5 * b + 4 * g)) / 2, boden = s * 0.5 + innen * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#1b1815"/>${FARBEN.map((f, i) => {
    const hh = HOEHE[i] / 30 * innen * 0.6; return `<rect x="${x0 + i * (b + g)}" y="${boden - hh}" width="${b}" height="${hh}" rx="${b * 0.42}" fill="${f}"/>`; }).join('')}</svg>`;
};
const b = await chromium.launch(); const p = await b.newPage();
for (const [ordner, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<body style="margin:0;background:transparent">${svg(s)}</body>`);
  const d = `android/app/src/main/res/mipmap-${ordner}`; mkdirSync(d, { recursive: true });
  writeFileSync(`${d}/ic_launcher.png`, await p.screenshot({ clip: { x: 0, y: 0, width: s, height: s }, omitBackground: true }));
}
await b.close(); console.log('Android-Symbole erzeugt');
