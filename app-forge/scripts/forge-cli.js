#!/usr/bin/env node
'use strict';
/**
 * Forge-CLI – Werkzeug für den GRATIS-MODUS.
 * Eine Claude-Code-Sitzung (über dein Claude-Abo) übernimmt die Rolle des kostenpflichtigen API-Keys:
 * Sie holt sich hier einen Auftrag, baut die App selbst, testet sie mit dem Test-Labor der Forge
 * und übergibt sie – mit denselben Qualitäts-Gates wie die API-Pipeline.
 *
 *   node scripts/forge-cli.js brief [--type game|tool]        Zufalls-Auftrag inkl. Trend, Palette, Regeln
 *   node scripts/forge-cli.js check  <app.html> [--concept c.json]       Test im Handy-Format + Screenshot
 *   node scripts/forge-cli.js import <app.html> --concept c.json [--review r.json]
 *   node scripts/forge-cli.js evolve <appId> <app.html> --title "…" [--description "…"] [--kind feature|bugfix|design|ux] [--review r.json]
 *   node scripts/forge-cli.js list                             Apps mit Score, Version, letztem Test
 *   node scripts/forge-cli.js html <appId> [--out datei.html]  aktuellen Code einer App holen
 *   node scripts/forge-cli.js test-all                         Gesundheitscheck aller Apps
 *   node scripts/forge-cli.js lesson "Regel"                   Regel in den Lernspeicher
 *   node scripts/forge-cli.js review-guide                     Bewertungsmaßstab der Design-Jury
 *
 * Datenordner: --data <dir> | FORGE_DATA_DIR | <repo>/forge-data
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Forge } = require('../src/core/forge');
const { Library } = require('../src/core/library');
const { Lessons } = require('../src/core/lessons');
const offline = require('../src/core/offline');
const { randomSeed, createRng } = require('../src/core/ideas');
const { PALETTES, STYLES, resolvePalette } = require('../src/core/design');
const { biasSeed, trendHint, BASELINE } = require('../src/core/trends');
const P = require('../src/core/prompts');

const argv = process.argv.slice(2);
const cmd = argv[0];
const pos = [];
const opt = {};
for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    opt[k] = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
  } else pos.push(argv[i]);
}

const DATA = path.resolve(opt.data || process.env.FORGE_DATA_DIR || path.join(__dirname, '..', '..', 'forge-data'));
const APPS = path.join(DATA, 'apps');
fs.mkdirSync(APPS, { recursive: true });

const readJson = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
const out = (o) => console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2));
function die(msg, extra) {
  console.error(`✗ ${msg}`);
  if (extra) console.error(JSON.stringify(extra, null, 2));
  process.exit(1);
}

function trendsReport() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, 'trends.json'), 'utf8'));
  } catch {
    return BASELINE;
  }
}

function settingsStub() {
  let s = {};
  try {
    s = JSON.parse(fs.readFileSync(path.join(DATA, 'settings.json'), 'utf8'));
  } catch {
    s = {};
  }
  return { get: (k, d) => k.split('.').reduce((o, x) => (o && o[x] !== undefined ? o[x] : undefined), s) ?? d };
}

let tester = null;
async function makeForge({ needTester = true } = {}) {
  if (needTester && !tester) {
    const { createPlaywrightTester } = require('../src/testers/playwright-tester');
    tester = await createPlaywrightTester();
  }
  const events = [];
  const forge = new Forge({
    ai: null,
    tester,
    library: new Library(APPS),
    lessons: new Lessons(path.join(DATA, 'lessons.json')),
    offline,
    waterfall: async (_n, v) => v,
    emit: (type, payload) => events.push({ type, payload }),
    settings: settingsStub(),
    trends: { get: trendsReport, weight: () => 0.6 }
  });
  return { forge, events };
}

function summary(report) {
  return { ok: report.ok, tech: report.tech, errors: report.errors, warnings: report.warnings, metrics: report.metrics };
}

async function main() {
  switch (cmd) {
    case 'brief': {
      const lib = new Library(APPS);
      const lessons = new Lessons(path.join(DATA, 'lessons.json'));
      const seedNum = (Math.random() * 4294967296) >>> 0;
      const rng = createRng(seedNum);
      let seed = randomSeed(seedNum);
      if (opt.type === 'game' || opt.type === 'tool') seed = { ...seed, type: opt.type };
      const report = trendsReport();
      const biased = opt.type ? { seed, opportunity: null } : biasSeed(seed, report, rng, 0.6);
      seed = biased.seed;
      const palette = resolvePalette(PALETTES.find((p) => p.id === seed.palette) || rng.pick(PALETTES));
      const style = STYLES.find((s) => s.id === seed.style) || rng.pick(STYLES);
      const existing = lib.list().map((a) => a.name);
      const prefix = `forge-${seedNum.toString(16)}`;
      out(`# Auftrag: neue App (Gratis-Modus)

## 1. Konzept entwickeln
${P.CONCEPT_SYSTEM}

${P.conceptPrompt({ seed, trendHint: trendHint(report, biased.opportunity), existing, lang: 'de', feedback: '' })}

Pflichtfelder (concept.json): ${P.CONCEPT_SCHEMA.required.join(', ')}.
Zusätzlich: "palette": "${palette.id}", "style": "${style.id}" (oder eigenes design mit gut lesbaren Farben).
sense_check: usefulness, clarity, originality, feasibility, market_fit (je 1–10, ehrlich!), verdict. Alle Werte ≥ 7, sonst neues Konzept.

## 2. App bauen (eine einzige HTML-Datei)
${P.builderSystem({ lang: 'de', appId: prefix, lessons: lessons.top(15) })}

Farbpalette „${palette.name}“ (${palette.mode}): Hintergrund ${palette.bg.join(' → ')}, Akzent ${palette.accent.join(' → ')}, Glow ${palette.glow}, Text ${palette.text}, gedämpft ${palette.muted}, Text auf Akzent ${palette.onAccent}.
Stil „${style.name}“: Radius ~${style.radius}px, Blur ~${style.blur}px.

## 3. Prüfen, bewerten, übergeben
node scripts/forge-cli.js check app.html --concept concept.json   → bis 0 Fehler, Screenshot ansehen
node scripts/forge-cli.js review-guide                             → streng bewerten, review.json schreiben
node scripts/forge-cli.js import app.html --concept concept.json --review review.json
`);
      break;
    }
    case 'review-guide': {
      out(`${P.REVIEW_SYSTEM}\n\nreview.json: { "design": 1-10, "ux": 1-10, "sense": 1-10, "polish": 1-10, "summary": "…", "bugs": [], "improvements": [] }\nDesign unter 8 → erst nachbessern. Unter 7 wird die App verworfen.`);
      break;
    }
    case 'check': {
      if (!pos[0]) die('Pfad zur HTML-Datei fehlt.');
      const { forge } = await makeForge();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-check-'));
      const r = await forge.checkHtml({ html: fs.readFileSync(pos[0], 'utf8'), concept: opt.concept ? readJson(opt.concept) : null, dir });
      out({ ...summary(r.report), screenshot: r.screenshot });
      process.exitCode = r.report.ok ? 0 : 2;
      break;
    }
    case 'import': {
      if (!pos[0] || !opt.concept) die('Aufruf: import <app.html> --concept concept.json [--review review.json]');
      const { forge } = await makeForge();
      try {
        const meta = await forge.importApp({ html: fs.readFileSync(pos[0], 'utf8'), concept: readJson(opt.concept), review: opt.review ? readJson(opt.review) : null, source: 'abo' });
        out({ ok: true, id: meta.id, name: meta.name, score: meta.score, version: meta.currentVersion });
      } catch (err) {
        die(err.message, err.report ? summary(err.report) : undefined);
      }
      break;
    }
    case 'evolve': {
      const [id, file] = pos;
      if (!id || !file || !opt.title) die('Aufruf: evolve <appId> <app.html> --title "…" [--description "…"] [--kind …] [--review review.json]');
      const { forge } = await makeForge();
      const r = await forge.importVersion(id, { html: fs.readFileSync(file, 'utf8'), title: String(opt.title), description: opt.description ? String(opt.description) : '', kind: opt.kind ? String(opt.kind) : 'feature', review: opt.review ? readJson(opt.review) : null, source: 'abo' });
      out({ changed: r.changed, reason: r.reason, version: r.version ? r.version.n : undefined, test: summary(r.report) });
      process.exitCode = r.changed ? 0 : 3;
      break;
    }
    case 'list': {
      const lib = new Library(APPS);
      out(lib.list().map((a) => ({ id: a.id, name: a.name, type: a.type, category: a.category, source: a.source, version: a.currentVersion, score: a.score, testOk: a.lastTest ? a.lastTest.ok : null, lastEvolvedAt: a.lastEvolvedAt ? new Date(a.lastEvolvedAt).toISOString() : null, rejected: (a.rejected || []).length })));
      break;
    }
    case 'html': {
      if (!pos[0]) die('App-ID fehlt.');
      const html = new Library(APPS).readCurrentHtml(pos[0]);
      if (opt.out) {
        fs.writeFileSync(String(opt.out), html);
        out(`✓ gespeichert: ${opt.out}`);
      } else process.stdout.write(html);
      break;
    }
    case 'test-all': {
      const { forge } = await makeForge();
      const res = [];
      for (const a of new Library(APPS).list()) {
        const r = await forge.test(a.id);
        res.push({ id: a.id, name: a.name, ok: r.ok, tech: r.tech, errors: r.errors });
      }
      out(res);
      break;
    }
    case 'lesson': {
      if (!pos[0]) die('Regeltext fehlt.');
      const added = new Lessons(path.join(DATA, 'lessons.json')).add([pos.join(' ')], { source: 'abo' });
      out(added.length ? `✓ gelernt: ${added[0].text}` : '• ähnliche Regel existiert bereits (verstärkt)');
      break;
    }
    default:
      out(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 19).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
  }
}

main()
  .catch((err) => die(err.stack || err.message))
  .finally(async () => {
    if (tester) await tester.close().catch(() => {});
  });
