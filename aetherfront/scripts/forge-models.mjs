// Aether-Forge: backt alle Figuren (Helden + Einheiten) aus SDF-Skulpturen in fertige Netze (web/assets/models/*.afm).
//   node scripts/forge-models.mjs                 alles
//   node scripts/forge-models.mjs kael lyra       nur diese (Helden-Kurzname oder Einheiten-Archetyp)
//   node scripts/forge-models.mjs units           alle Einheiten-Formen (parallel auf allen Kernen)
//   node scripts/forge-models.mjs knight griffin  nur diese Archetypen (alle Formen)
//   FORGE_CELL=0.008 node scripts/forge-models.mjs  gröbere Zellen (schneller, für Tests)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forgeAsset } from '../src/render/forge/forge.js';
import { HEROES } from '../src/sim/heroes.js';
import { makeSkeleton, HeroBuilder } from '../src/render/hero/rig.js';
import * as oldKael from '../src/render/hero/kael.js';
import * as oldLyra from '../src/render/hero/lyra.js';
import * as oldVaro from '../src/render/hero/varo.js';
import * as oldSelene from '../src/render/hero/selene.js';
import * as oldMira from '../src/render/hero/mira.js';
import * as oldBrann from '../src/render/hero/brann.js';
import { HERO_DESIGNS } from '../src/render/forge/designs/heroes.js';
import { unitDef } from '../src/render/forge/designs/units.js';
import { bakeList } from '../src/render/forge/roster.js';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { PARTS, partDef } from '../src/render/forge/designs/parts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'web/assets/models');
fs.mkdirSync(outDir, { recursive: true });

const OLD = { kael: oldKael, mira: oldMira, lyra: oldLyra, selene: oldSelene, brann: oldBrann, varo: oldVaro };
const STYLE = { kael: 'knight', mira: 'priest', lyra: 'ranger', selene: 'mage', brann: 'hammer', varo: 'dual' };
const FALLBACK_PAL = { primary: '#aab3bf', secondary: '#3a6ee8', metal: '#c9a24a', glow: '#7fd8ff' };
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const want = (id) => !args.length || args.includes(id);
const cell = +(process.env.FORGE_CELL || 0.007);
// Einheiten: Zellgröße für die Draufsicht (gröber als Helden, reicht für ~100 px hohe Figuren)
const unitCell = +(process.env.FORGE_UNIT_CELL || 0.0115);

// --- Arbeiter-Modus: backt eine Liste von Einheiten-Formen und meldet Statistiken als JSON-Zeilen ---
if (process.env.FORGE_WORKER) {
  const outDirW = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'web/assets/models');
  for (const key of JSON.parse(process.env.FORGE_WORKER)) {
    const [arch, form] = key.split('|');
    try {
      const def = unitDef(arch, unitCell, form);
      const { bytes, stats } = forgeAsset(def);
      fs.writeFileSync(path.join(outDirW, def.id + '.afm'), bytes);
      process.stdout.write(JSON.stringify({ ok: def.id, stats }) + '\n');
    } catch (e) { process.stdout.write(JSON.stringify({ fail: key, err: String(e && e.stack || e) }) + '\n'); }
  }
  process.exit(0);
}

const ser = (v) => (v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isColor ? '#' + v.getHexString() : v);
function serialize(o) {
  if (Array.isArray(o)) return o.map(serialize);
  if (o && typeof o === 'object' && !o.isVector3 && !o.isColor) { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = serialize(v); return r; }
  return ser(o);
}

/** Skelett + Zusatzinfos aus dem alten Rig übernehmen (Animator-kompatibel: gleiche Gelenke/Waffenrahmen) */
function captureRig(id, pal) {
  const mod = OLD[id];
  const skel = makeSkeleton(mod.proportions);
  const B = new HeroBuilder(skel);
  const info = mod.build(B, pal) || {};
  const { order } = B.build();
  const names = order;
  const parents = names.map((n) => (B.J[n].parent ? names.indexOf(B.J[n].parent) : -1));
  const rest = names.map((n) => [B.J[n].pos.x, B.J[n].pos.y, B.J[n].pos.z]);
  B.parts = []; // alte Geometrie verwerfen
  return { B, skeleton: { names, parents, rest }, info };
}

const index = { heroes: [], units: [], parts: [], built: new Date().toISOString() };
const prev = fs.existsSync(path.join(outDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'index.json'), 'utf8')) : null;
const report = [];
for (const id of Object.keys(HERO_DESIGNS)) {
  const fileId = 'hero_' + id;
  if (!want(id)) { if (prev?.heroes?.includes(fileId) && fs.existsSync(path.join(outDir, fileId + '.afm'))) index.heroes.push(fileId); continue; }
  const pal = { ...FALLBACK_PAL, ...(HEROES[id] && HEROES[id].palette) };
  const cap = captureRig(id, pal);
  console.log(`⚒  ${fileId} …`);
  const { bytes, stats } = forgeAsset({
    id: fileId, kind: 'hero', palette: pal, skeleton: cap.skeleton, scale: cap.B.skel.s, cell,
    budgets: HERO_DESIGNS[id].budgets || [38000, 12000, 4000],
    build: (S) => HERO_DESIGNS[id].build(S, cap.B, pal),
    info: { ...serialize(cap.info), style: STYLE[id] },
  }, (m) => console.log(m));
  fs.writeFileSync(path.join(outDir, fileId + '.afm'), bytes);
  index.heroes.push(fileId);
  report.push(stats);
  console.log(`   LOD Δ ${stats.lods.join(' / ')} · hoch ${stats.hiTris} · ${(stats.bytes / 1024).toFixed(0)} KB · ${JSON.stringify(stats.ms)}`);
}
// Einheiten: alle (Archetyp, Form)-Paare der Besetzungsliste, parallel gebacken
{
  const all = bakeList();
  const wantU = ([a]) => !args.length || args.includes(a) || args.includes('units');
  const todo = all.filter(wantU).map(([a, f]) => `${a}|${f}`);
  for (const [a, f] of all) { const id = `unit_${a}_${f}`; if (!todo.includes(`${a}|${f}`) && prev?.units?.includes(id) && fs.existsSync(path.join(outDir, id + '.afm'))) index.units.push(id); }
  if (todo.length) {
    const N = Math.max(1, Math.min(+(process.env.FORGE_JOBS || os.cpus().length), todo.length));
    // grob nach Aufwand verteilen (Bosse zuerst)
    todo.sort((x, y) => (/boss|king/.test(y) ? 1 : 0) - (/boss|king/.test(x) ? 1 : 0));
    const chunks = Array.from({ length: N }, () => []);
    todo.forEach((k, i) => chunks[i % N].push(k));
    const t0 = Date.now();
    let done = 0;
    await Promise.all(chunks.map((list) => new Promise((resolve) => {
      const ch = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, FORGE_WORKER: JSON.stringify(list) }, stdio: ['ignore', 'pipe', 'inherit'] });
      let buf = '';
      ch.stdout.on('data', (d) => {
        buf += d; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try {
            const m = JSON.parse(line);
            if (m.ok) { index.units.push(m.ok); report.push(m.stats); done++; console.log(`⚒  ${m.ok} (${done}/${todo.length}) Δ ${m.stats.lods.join(' / ')} · ${(m.stats.bytes / 1024).toFixed(0)} KB · ${m.stats.ms.total} ms`); }
            else if (m.fail) console.error(`✖ ${m.fail}: ${m.err}`);
          } catch { console.log(line); }
        }
      });
      ch.on('exit', resolve);
    })));
    console.log(`   Einheiten: ${done}/${todo.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
for (const name of Object.keys(PARTS)) {
  const fileId = 'part_' + name;
  if (!want(fileId) && !args.includes('parts')) { if (prev?.parts?.includes(fileId) && fs.existsSync(path.join(outDir, fileId + '.afm'))) index.parts.push(fileId); continue; }
  const { bytes, stats } = forgeAsset(partDef(name, cell));
  fs.writeFileSync(path.join(outDir, fileId + '.afm'), bytes);
  index.parts.push(fileId); report.push(stats);
  console.log(`⚒  ${fileId}: Δ ${stats.lods.join(' / ')} · ${(stats.bytes / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));
let total = 0; for (const f of fs.readdirSync(outDir)) total += fs.statSync(path.join(outDir, f)).size;
fs.writeFileSync(path.join(outDir, 'forge-report.json'), JSON.stringify({ cell, report, totalBytes: total }, null, 1));
console.log(`✔ ${index.heroes.length} Helden, ${index.units.length} Einheiten · gesamt ${(total / 1048576).toFixed(1)} MB`);
