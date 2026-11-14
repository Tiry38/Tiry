// Lädt die kuratierten CC0-Assets (Poly Haven + ambientCG) nach web/assets/ und schreibt web/assets/LICENSES.md.
//   node scripts/fetch-assets.mjs            fehlende Dateien laden (vorhandene mit passender Größe bleiben)
//   node scripts/fetch-assets.mjs --force    alles neu laden
// Quelle der Auswahl: src/render/asset-catalog.js. Alle Dateien sind CC0 (gemeinfrei), keine Namensnennung nötig –
// wir nennen Autoren trotzdem. Hinter einem Firmen-Proxy (HTTPS_PROXY) startet sich das Skript mit Proxy-Unterstützung neu.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(r.status ?? 1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const { TEXTURE_SETS, HDRIS, texturePath, hdriPath } = await import(pathToFileURL(path.join(ROOT, 'src/render/asset-catalog.js')).href);
const force = process.argv.includes('--force');
const UA = { 'User-Agent': 'aetherfront-asset-fetch/1.0' };

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 2) throw new Error(`${url}: ${e.message}`); await new Promise((res) => setTimeout(res, 1500)); }
  }
}
async function getBuffer(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === 2) throw new Error(`${url}: ${e.message}`); await new Promise((res) => setTimeout(res, 1500)); }
  }
}
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

function writeFile(rel, buf) {
  const f = path.join(WEB, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
}
const existsWithSize = (rel, size) => {
  const f = path.join(WEB, rel);
  return !force && fs.existsSync(f) && (size == null || fs.statSync(f).size === size);
};

/** Minimaler ZIP-Leser (zentrales Verzeichnis, Methoden 0/8) – reicht für ambientCG-Pakete. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP: Verzeichnisende nicht gefunden');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP: Verzeichniseintrag defekt');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnl = buf.readUInt16LE(local + 26), lel = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lnl + lel, local + 30 + lnl + lel + csize);
    out.set(name, () => (method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data)));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const licenses = [];
let total = 0;

for (const set of TEXTURE_SETS) {
  if (set.source === 'polyhaven') {
    const [files, info] = await Promise.all([getJson(`https://api.polyhaven.com/files/${set.id}`), getJson(`https://api.polyhaven.com/info/${set.id}`)]);
    const authors = Object.keys(info.authors || {}).join(', ') || 'Poly Haven';
    for (const [map, [phMap, res]] of Object.entries(set.maps)) {
      const entry = files[phMap]?.[res]?.jpg;
      if (!entry) throw new Error(`${set.id}: Map ${phMap} ${res} nicht verfügbar`);
      const rel = texturePath(set.slot, map);
      if (!existsWithSize(rel, entry.size)) {
        const buf = await getBuffer(entry.url);
        if (entry.md5 && md5(buf) !== entry.md5) throw new Error(`${set.id}: Prüfsumme falsch (${phMap})`);
        writeFile(rel, buf);
        console.log('↓', rel, mb(buf.length));
      } else console.log('✓', rel);
      total += entry.size;
      licenses.push({ file: rel, name: `${info.name} – ${map} (${res})`, url: `https://polyhaven.com/a/${set.id}`, dl: entry.url, author: authors, use: set.use });
    }
  } else if (set.source === 'ambientcg') {
    const j = await getJson(`https://ambientcg.com/api/v2/full_json?id=${set.id}&include=downloadData`);
    const a = j.foundAssets?.[0];
    const dl = a?.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads?.find((d) => d.attribute === set.variant);
    if (!dl) throw new Error(`${set.id}: Download ${set.variant} nicht gefunden`);
    const rels = Object.keys(set.maps).map((m) => texturePath(set.slot, m));
    if (rels.some((r) => !existsWithSize(r))) {
      const zip = unzip(await getBuffer(dl.downloadLink));
      for (const [map, [acgMap]] of Object.entries(set.maps)) {
        const name = [...zip.keys()].find((k) => k.endsWith(`_${acgMap}.jpg`));
        if (!name) throw new Error(`${set.id}: ${acgMap} fehlt im Paket`);
        const buf = zip.get(name)();
        writeFile(texturePath(set.slot, map), buf);
        console.log('↓', texturePath(set.slot, map), mb(buf.length));
      }
    } else rels.forEach((r) => console.log('✓', r));
    for (const [map] of Object.entries(set.maps)) {
      const rel = texturePath(set.slot, map);
      total += fs.statSync(path.join(WEB, rel)).size;
      licenses.push({ file: rel, name: `${a.displayName} – ${map} (${set.variant})`, url: `https://ambientcg.com/view?id=${set.id}`, dl: dl.downloadLink, author: 'ambientCG (Lennart Demes)', use: set.use });
    }
  }
}

for (const h of HDRIS) {
  const [files, info] = await Promise.all([getJson(`https://api.polyhaven.com/files/${h.id}`), getJson(`https://api.polyhaven.com/info/${h.id}`)]);
  const entry = files.hdri?.[h.res]?.hdr;
  if (!entry) throw new Error(`${h.id}: HDR ${h.res} nicht verfügbar`);
  const rel = hdriPath(h.slot);
  if (!existsWithSize(rel, entry.size)) {
    const buf = await getBuffer(entry.url);
    if (entry.md5 && md5(buf) !== entry.md5) throw new Error(`${h.id}: Prüfsumme falsch`);
    writeFile(rel, buf);
    console.log('↓', rel, mb(buf.length));
  } else console.log('✓', rel);
  total += entry.size;
  licenses.push({ file: rel, name: `${info.name} (HDRI ${h.res})`, url: `https://polyhaven.com/a/${h.id}`, dl: entry.url, author: Object.keys(info.authors || {}).join(', ') || 'Poly Haven', use: h.use });
}

const md = [
  '# Lizenzen der Assets in `web/assets/`',
  '',
  'Alle Dateien stehen unter **CC0 1.0 Universal** (gemeinfrei, https://creativecommons.org/publicdomain/zero/1.0/).',
  'Sie dürfen ohne Namensnennung kommerziell genutzt, verändert und weitergegeben werden. Wir nennen die Urheber trotzdem.',
  '',
  '- Poly Haven – Lizenz: https://polyhaven.com/license',
  '- ambientCG – Lizenz: https://docs.ambientcg.com/license/',
  '',
  'Neu laden: `node scripts/fetch-assets.mjs` (Auswahl in `src/render/asset-catalog.js`).',
  '',
  '| Datei | Asset | Urheber | Quelle | Download | Verwendung | Lizenz |',
  '|---|---|---|---|---|---|---|',
  ...licenses.map((l) => `| \`${l.file}\` | ${l.name} | ${l.author} | ${l.url} | ${l.dl} | ${l.use} | CC0 1.0 |`),
  '',
  `Gesamtgröße: ${mb(total)}`,
  '',
].join('\n');
writeFile('assets/LICENSES.md', md);
console.log(`Fertig: ${licenses.length} Dateien, ${mb(total)} → web/assets/`);
