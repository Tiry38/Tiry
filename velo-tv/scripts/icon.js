/* Erzeugt das Velo-TV-Symbol aus dem echten Velocenter-Logo (Fahrrad ohne Schriftzug) im Fernseher.
   Ausgabe: src/renderer/assets/symbol.svg, build/icon.png (512), build/icon.ico (16–256), build/tray.png (32).
   Start: node scripts/icon.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const R = path.join(__dirname, '..');
const logo = fs.readFileSync(path.join(R, 'src/renderer/assets/logo.svg'), 'utf8');

// Teilpfade des Logos: Fahrrad = alles oberhalb des Schriftzugs (y < 1144 im Logo-Koordinatensystem)
function teilpfade(cls) {
  const m = new RegExp('<g class="' + cls + '"[^>]*>([\\s\\S]*?)</g>').exec(logo);
  return [...m[1].matchAll(/d="([^"]+)"/g)].map((x) => x[1]).join(' ').replace(/\s+/g, ' ').split(/(?=M)/).map((d) => d.trim()).filter(Boolean);
}
const grau = teilpfade('lg-b').slice(0, 9);  // Räder, Lenker, Sattelstütze
const rot = teilpfade('lg-r').slice(0, 2);   // Sattel, Rahmen

// Fernseher-Maße (512er Raster)
const SCR = { x: 74, y: 156, w: 364, h: 232, r: 44 };
const S = 0.292, BX0 = 753, BY_CUT = 1150;
const ox = SCR.x + SCR.w / 2 - (1426 - BX0) * S; // Rahmenmitte = Bildschirmmitte
const oy = SCR.y + SCR.h;
const rad = (d) => `<path d="${d}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
  <linearGradient id="rahmen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2333D"/><stop offset=".38" stop-color="#D0142A"/><stop offset=".78" stop-color="#8E1420"/><stop offset="1" stop-color="#5A0D18"/></linearGradient>
  <linearGradient id="glanz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="schirm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EFE8E1"/></linearGradient>
  <radialGradient id="licht" cx=".72" cy=".1" r=".9"><stop offset="0" stop-color="#FFE9D6" stop-opacity=".9"/><stop offset="1" stop-color="#FFE9D6" stop-opacity="0"/></radialGradient>
  <clipPath id="clip"><rect x="${SCR.x}" y="${SCR.y}" width="${SCR.w}" height="${SCR.h}" rx="${SCR.r}"/></clipPath>
  <filter id="schatten" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#5A0D18" flood-opacity=".35"/></filter>
</defs>
<g stroke="#868282" stroke-width="16" stroke-linecap="round"><line x1="256" y1="120" x2="176" y2="40"/><line x1="256" y1="120" x2="336" y2="40"/></g>
<circle cx="176" cy="40" r="20" fill="#E2232D"/><circle cx="336" cy="40" r="20" fill="#E2232D"/>
<path d="M226 420h60l10 26h-80z" fill="#868282"/><rect x="176" y="440" width="160" height="30" rx="15" fill="#868282"/>
<rect x="40" y="118" width="432" height="308" rx="78" fill="url(#rahmen)" filter="url(#schatten)"/>
<rect x="40" y="118" width="432" height="308" rx="78" fill="url(#glanz)"/>
<rect x="${SCR.x}" y="${SCR.y}" width="${SCR.w}" height="${SCR.h}" rx="${SCR.r}" fill="url(#schirm)"/>
<rect x="${SCR.x}" y="${SCR.y}" width="${SCR.w}" height="${SCR.h}" rx="${SCR.r}" fill="url(#licht)"/>
<g clip-path="url(#clip)">
  <g transform="translate(${(ox - BX0 * S).toFixed(2)},${(oy - BY_CUT * S).toFixed(2)}) scale(${S})">
    <g transform="translate(0,2288) scale(0.1,-0.1)">
      <g fill="#7E7A7A">${grau.map(rad).join('')}</g>
      <g fill="#E2232D">${rot.map(rad).join('')}</g>
    </g>
  </g>
</g>
<rect x="${SCR.x + 1.5}" y="${SCR.y + 1.5}" width="${SCR.w - 3}" height="${SCR.h - 3}" rx="${SCR.r - 1.5}" fill="none" stroke="#5A0D18" stroke-opacity=".25" stroke-width="3"/>
</svg>`;

// ICO mit PNG-Einträgen (Windows Vista+)
function ico(pngs) {
  const kopf = Buffer.alloc(6); kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(pngs.length, 4);
  let off = 6 + 16 * pngs.length; const eintraege = [];
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(off, 12);
    off += buf.length; eintraege.push(e);
  }
  return Buffer.concat([kopf, ...eintraege, ...pngs.map((p) => p.buf)]);
}

(async () => {
  fs.writeFileSync(path.join(R, 'src/renderer/assets/symbol.svg'), svg);
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const b = await chromium.launch(exe);
  const render = async (size) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    const buf = await p.screenshot({ omitBackground: true });
    await p.close();
    return buf;
  };
  const groessen = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of groessen) pngs.push({ size: s, buf: await render(s) });
  fs.writeFileSync(path.join(R, 'build/icon.ico'), ico(pngs));
  fs.writeFileSync(path.join(R, 'build/icon.png'), await render(512));
  fs.writeFileSync(path.join(R, 'build/tray.png'), pngs.find((p) => p.size === 32).buf);
  await b.close();
  console.log('Symbol erzeugt: symbol.svg, icon.png, icon.ico, tray.png');
})();
