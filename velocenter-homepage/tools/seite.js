#!/usr/bin/env node
/* Browser-Werkzeug für den Bilder-Agenten: lädt eine Seite wie ein echter Browser (JavaScript, Cookie-Banner weg)
   und meldet die großen Bilder (Adresse + Pixelgröße) + Screenshot zum Ansehen.
   node velocenter-homepage/tools/seite.js "<https-URL>"
   node velocenter-homepage/tools/seite.js --velo "<Velo-ID>"   (Velo de Ville: Velo-ID -> konfiguriertes Rad)
   node velocenter-homepage/tools/seite.js "<https-URL>" --klick "<sichtbarer Text>"   (z. B. eine Farbe anklicken) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const A = process.argv.slice(2);
const opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null };
const TMP = path.join(process.env.BILDER_TMP || path.join(process.env.RUNNER_TEMP || '/tmp', 'bilder'), 'seiten');
fs.mkdirSync(TMP, { recursive: true });
const raus = o => { console.log(JSON.stringify(o, null, 1)); process.exit(0) };
(async () => {
  let url = A[0] && !A[0].startsWith('--') ? A[0] : null;
  const velo = opt('--velo');
  if (velo && !/^[A-Za-z0-9-]{4,40}$/.test(velo)) raus({ fehler: 'Velo-ID ungültig' });
  if (!velo && (!url || !/^https:\/\//.test(url))) raus({ fehler: 'Bitte https-URL oder --velo <ID> angeben' });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: velo ? 2 : 1, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' });
  const netz = new Map();
  p.on('response', async r => { const ct = r.headers()['content-type'] || ''; if (!/image\/(jpe?g|png|webp|avif)/.test(ct)) return; let n = 0; try { n = (await r.body()).length } catch (_) {} if (n > 30000) netz.set(r.url(), n) });
  if (velo) {
    // Velo-ID im Browser laden (wie Knopf „Konfiguration laden“) – die Konfiguration hängt an der Sitzung
    await p.goto('https://konfigurator.velo-de-ville.com/de-de/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const d = await p.evaluate(async id => { try { const r = await fetch('/de-de/catalog/index/velo/?id=' + encodeURIComponent(id), { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } }); return JSON.parse(await r.text()) } catch (e) { return {} } }, velo);
    if (!d.product_url) { await b.close(); raus({ fehler: 'Velo-ID nicht gefunden', antwort: String(d.message || '').replace(/<[^>]+>/g, '').slice(0, 200) }) }
    url = d.product_url;
  }
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  for (const t of ['Ablehnen', 'Nur notwendige', 'Alle ablehnen', 'Alle akzeptieren', 'Akzeptieren']) {
    const k = p.locator('button:has-text("' + t + '")').first(); if (await k.isVisible().catch(() => false)) { await k.click().catch(() => {}); break }
  }
  await p.waitForTimeout(2500);
  const klick = opt('--klick');
  if (klick) {
    let ok = false;
    for (const sel of ['[title="' + klick + '" i]', '[aria-label="' + klick + '" i]', '[data-title="' + klick + '" i]', 'text=' + klick]) {
      const l = p.locator(sel).first(); if (await l.count().catch(() => 0)) { await l.click({ timeout: 6000, force: true }).then(() => ok = true).catch(() => {}); if (ok) break }
    }
    if (!ok) for (const s of await p.$$('select')) { const v = await s.evaluate((el, t) => { const o = [...el.options].find(o => (o.label + ' ' + o.text + ' ' + (o.title || '')).toLowerCase().includes(t.toLowerCase())); return o ? o.value : null }, klick); if (v) { await s.selectOption(v).catch(() => {}); ok = true; break } }
    console.error('klick ' + (ok ? 'ok' : 'nicht gefunden') + ': ' + klick); await p.waitForTimeout(5000); await p.waitForLoadState('networkidle').catch(() => {})
  }
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)) } scrollTo(0, 0) });
  await p.waitForTimeout(1500);
  const bilder = await p.evaluate(() => [...document.images].filter(i => i.naturalWidth >= 400).map(i => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: (i.alt || '').slice(0, 80) })));
  let bild_datei = null;
  if (velo) {
    // Das Rad im Konfigurator ist eine Canvas-Grafik (keine <img>): größte Canvas als PNG sichern
    const du = await p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; try { return c ? c.toDataURL('image/png') : null } catch (e) { return null } });
    if (du && du.length > 20000) { bild_datei = path.join(TMP, 'velo-' + velo.replace(/[^A-Za-z0-9-]/g, '') + '.png'); fs.writeFileSync(bild_datei, Buffer.from(du.split(',')[1], 'base64')) }
  }
  const titel = await p.title(), text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 1500);
  const shot = path.join(TMP, 'seite-' + Date.now() + '.png');
  await p.screenshot({ path: shot });
  await b.close();
  raus({ url, titel, screenshot: shot, bild_datei, bilder: bilder.slice(0, 25), netz_bilder: [...netz].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([u, n]) => ({ src: u, bytes: n })), text });
})().catch(e => raus({ fehler: e.message.slice(0, 300) }));
