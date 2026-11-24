'use strict';
/* Smoke-Test: echtes Programm, Rolle Zentrale, Beispielinhalte, simulierter Fernseher, Screenshots aller Ansichten.
   Start: VELOTV_DATA_DIR=<tmp> VELOTV_SMOKE_OUT=<tmp> electron . --smoke */
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimales PDF mit 2 Seiten zum Testen des PDF-Imports
function testPdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    null,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const stream = (t) => { const s = `BT /F1 64 Tf 80 260 Td (${t}) Tj ET`; return `<< /Length ${s.length} >>\nstream\n${s}\nendstream`; };
  objs[3] = stream('Seite 1 - Test');
  objs[5] = stream('Seite 2 - Test');
  let pdf = '%PDF-1.4\n';
  const off = [];
  objs.forEach((o, i) => { off.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function run(win, { PORT, getServer }) {
  const out = process.env.VELOTV_SMOKE_OUT || path.join(process.cwd(), 'smoke-out');
  fs.mkdirSync(out, { recursive: true });
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => { await warte(900); const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); console.log('[smoke] ' + name); };
  const fehler = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) fehler.push(msg); });

  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()));
  win.setSize(1440, 900);
  await warte(800);
  await shot('01-einrichtung');

  // Rolle Zentrale wählen
  await js(`document.querySelector('#setupName').value='Kasse'; document.querySelector('.role[data-role=zentrale]').click();`);
  await warte(1500);
  const srv = getServer();
  if (!srv) throw new Error('Server läuft nicht');
  const base = 'http://127.0.0.1:' + PORT;
  const kopf = { 'X-Key': srv.localKey, 'X-PC': 'Kasse' };
  await shot('02-fernseher-einrichten');

  // Beispielinhalte
  const assets = path.join(__dirname, '..', 'renderer', 'assets');
  const up = async (datei, name) => (await fetch(base + '/api/upload?kind=image&name=' + encodeURIComponent(name), { method: 'PUT', headers: kopf, body: fs.readFileSync(datei) })).json();
  const a = await up(path.join(assets, 'hg-herbst-gross.webp'), 'Herbst im Laden.webp');
  const post = (p, b, m) => fetch(base + p, { method: m || 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, kopf), body: JSON.stringify(b) }).then((r) => r.json());
  const t1 = await post('/api/items', { kind: 'text', text: { badge: 'Winter-Inspektion 2026/27', title: '-20 € auf jede *Inspektion.*', sub: 'Gültig bis 28.02.2027 für Marken-Räder mit Bosch-Antrieb. Termin direkt hier an der Kasse.', theme: 'herbst' }, duration: 12 });
  await post('/api/items', { kind: 'text', text: { badge: 'Geschenk-Idee', title: 'Gutscheine vom *Velocenter.*', sub: 'Für alle, die gern Rad fahren. Bei uns im Laden erhältlich.', theme: 'rot' }, plan: { days: [1, 2, 3, 4, 5, 6], startDate: '2026-11-23', endDate: '2026-12-24' } });
  await post('/api/items', { kind: 'text', text: { badge: 'Unser Versprechen', title: 'Hier schraubt *der Chef* noch selbst.', theme: 'dunkel' }, plan: { from: '09:00', to: '13:00' } });
  await post('/api/items/' + a.id, { fit: 'cover', duration: 8 }, 'PATCH');
  const sr = await post('/api/items', { kind: 'showroom' });
  const srr = await post('/api/showroom/refresh', {});
  console.log('[smoke] Showroom: ' + srr.anzahl + ' Angebote' + (srr.fehler ? ' Fehler ' + srr.fehler : ''));

  // PDF-Import über die echte Renderer-Pipeline
  const pdfB64 = testPdf().toString('base64');
  const seiten = await js(`import('./import.js').then(async (m) => { const b = Uint8Array.from(atob('${pdfB64}'), c => c.charCodeAt(0)); const s = await m.pdfSeiten(b.buffer); return s.map(x => x.size); })`);
  if (!Array.isArray(seiten) || seiten.length !== 2 || seiten.some((x) => x < 2000)) throw new Error('PDF-Import fehlgeschlagen: ' + JSON.stringify(seiten));
  console.log('[smoke] PDF-Import ok: ' + seiten.length + ' Seiten');

  // Simulierter Fernseher (öffnet die Adresse wie der LG-Browser)
  const tv = new BrowserWindow({ width: 1920, height: 1080, show: false, webPreferences: { offscreen: true } });
  await tv.loadURL(base + '/');
  await warte(3500);
  fs.writeFileSync(path.join(out, '10-tv-folie1.png'), (await tv.webContents.capturePage()).toPNG());
  await post('/api/tv/show', { id: t1.id });
  await warte(2500);
  fs.writeFileSync(path.join(out, '11-tv-textfolie.png'), (await tv.webContents.capturePage()).toPNG());
  await post('/api/tv/show', { id: sr.id });
  await warte(6000);
  fs.writeFileSync(path.join(out, '13-tv-showroom.png'), (await tv.webContents.capturePage()).toPNG());
  console.log('[smoke] Fernseher-Bilder');

  await js(`document.querySelector('[data-view=programm]').click()`);
  await warte(1500);
  await shot('03-programm');
  await js(`document.querySelector('#srNow').click()`);
  await warte(3000);
  if (srv.anwesenheit().tv.showing !== sr.id) throw new Error('Showroom-Knopf: Fernseher zeigt nicht den Showroom');
  console.log('[smoke] Showroom-Knopf ok');
  await js(`document.querySelectorAll('#list .item')[1].click()`);
  await warte(1800);
  await shot('04-text-bearbeiten');
  await js(`document.querySelector('#sheetClose').click(); document.querySelectorAll('#list .item')[0].click()`);
  await warte(1200);
  await shot('05-bild-bearbeiten');
  await js(`document.querySelector('#edDelete').click()`);
  await warte(800);
  await js(`document.querySelector('[data-view=fernseher]').click()`);
  await shot('06-fernseher');
  await js(`document.querySelector('[data-view=verlauf]').click()`);
  await shot('07-verlauf');
  await js(`document.querySelector('[data-view=papierkorb]').click()`);
  await shot('08-papierkorb');
  await js(`document.querySelector('[data-view=einstellungen]').click()`);
  await shot('09-einstellungen');

  // Leerer Fernseher (Startbild)
  const st = srv.state;
  for (const i of [...st.items]) await fetch(base + '/api/items/' + i.id, { method: 'DELETE', headers: kopf });
  await warte(2500);
  fs.writeFileSync(path.join(out, '12-tv-startbild.png'), (await tv.webContents.capturePage()).toPNG());

  const tvInfo = srv.anwesenheit().tv;
  if (!tvInfo || !tvInfo.online) throw new Error('Fernseher-Herzschlag fehlt');
  const echte = fehler.filter((f) => !/favicon|ERR_ABORTED|Autofill/i.test(f));
  if (echte.length) { console.error('[smoke] Konsolenfehler:\n' + echte.join('\n')); }
  tv.destroy();
  console.log('[smoke] FERTIG ' + (echte.length ? 'mit Konsolenfehlern' : 'ohne Fehler'));
  require('electron').app.exit(echte.length ? 1 : 0);
}

module.exports = { run };
