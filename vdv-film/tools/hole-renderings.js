// Holt die freigestellten Konfigurator-Renderings neu (Produktbilder gehören VELO DE VILLE, daher nicht im Repo).
// node tools/hole-renderings.js  -> assets/bike/bNN.webp (Schritte wie in data.js), danach python3 tools/konturen.py
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const pre = ['Poppy Red glanz'];
const steps = ['Bosch PowerTube 800 Wh', 'Bosch Kiox 500', 'Enviolo TR AUTOMATiQ', 'Gates CDX Riemenantrieb', 'Low · L (53 cm) · (1,70-1,85 m)', 'Melon Yellow glanz', 'Ergotec Riser (660 mm)', 'Selle Royal Explora Moderate', 'by.Schulz G.2 ST Parallelogramm', 'SR Suntour NRX32 Air, 75mm, Lockout, QR', 'Schwalbe Marathon E Plus 50-622 (28', 'Shimano MT420, 4-Kolben / 2-Kolben', 'Supernova M99 Pro 2 (130/450 Lux Fernlicht)', 'ABUS 4750 XL, Schlüssel abziehbar (gleichschließend)', 'VELOMATE (1 Jahr)', 'Bosch 4A'];
const out = path.resolve(__dirname, '../assets/bike'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('https://konfigurator.velo-de-ville.com/de/e-Bikes?bike=2027-aeb-pro', { waitUntil: 'networkidle' });
  await p.getByText('Ablehnen', { exact: true }).click(); // nur technisch notwendige Cookies
  await p.getByText('AEB 990CX PRO').first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
  const base = p.url();
  const setOpt = async o => { const url = await p.evaluate(o => { const el = [...document.querySelectorAll('.answer-card-outer')].find(e => (e.getAttribute('title') || '') === o || (e.getAttribute('title') || '').startsWith(o)); return el && el.getAttribute('data-url'); }, o); if (!url) { console.log('FEHLT', o); return; } await p.evaluate(u => fetch(u, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }), url); await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); };
  for (const o of pre) await setOpt(o);
  const shot = async i => { const d = await p.evaluate(() => Konva.stages[0].toDataURL({ pixelRatio: 4 })); fs.writeFileSync(`${out}/b${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); };
  await shot(0);
  for (let i = 0; i < steps.length; i++) {
    await setOpt(steps[i]); await shot(i + 1);
    console.log(i + 1, steps[i], await p.evaluate(() => document.querySelector('.text-price').innerText));
  }
  console.log('Preis:', await p.evaluate(() => document.querySelector('.text-price').innerText)); await b.close();
})();
