// Aether-Forge: backt alle Figuren (Helden + Einheiten) aus SDF-Skulpturen in fertige Netze (web/assets/models/*.afm).
//   node scripts/forge-models.mjs                 alles
//   node scripts/forge-models.mjs kael lyra       nur diese (Helden-Kurzname oder Einheiten-Archetyp)
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
import { UNIT_DESIGNS, unitDef } from '../src/render/forge/designs/units.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'web/assets/models');
fs.mkdirSync(outDir, { recursive: true });

const OLD = { kael: oldKael, mira: oldMira, lyra: oldLyra, selene: oldSelene, brann: oldBrann, varo: oldVaro };
const STYLE = { kael: 'knight', mira: 'priest', lyra: 'ranger', selene: 'mage', brann: 'hammer', varo: 'dual' };
const FALLBACK_PAL = { primary: '#aab3bf', secondary: '#3a6ee8', metal: '#c9a24a', glow: '#7fd8ff' };
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const want = (id) => !args.length || args.includes(id);
const cell = +(process.env.FORGE_CELL || 0.007);

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

const index = { heroes: [], units: [], built: new Date().toISOString() };
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
for (const arch of Object.keys(UNIT_DESIGNS)) {
  const fileId = 'unit_' + arch;
  if (!want(arch)) { if (prev?.units?.includes(fileId) && fs.existsSync(path.join(outDir, fileId + '.afm'))) index.units.push(fileId); continue; }
  console.log(`⚒  ${fileId} …`);
  const def = unitDef(arch, cell);
  const { bytes, stats } = forgeAsset(def, (m) => console.log(m));
  fs.writeFileSync(path.join(outDir, fileId + '.afm'), bytes);
  index.units.push(fileId);
  report.push(stats);
  console.log(`   LOD Δ ${stats.lods.join(' / ')} · hoch ${stats.hiTris} · ${(stats.bytes / 1024).toFixed(0)} KB · ${JSON.stringify(stats.ms)}`);
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));
let total = 0; for (const f of fs.readdirSync(outDir)) total += fs.statSync(path.join(outDir, f)).size;
fs.writeFileSync(path.join(outDir, 'forge-report.json'), JSON.stringify({ cell, report, totalBytes: total }, null, 1));
console.log(`✔ ${index.heroes.length} Helden, ${index.units.length} Einheiten · gesamt ${(total / 1048576).toFixed(1)} MB`);
