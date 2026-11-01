'use strict';
/**
 * Selbsttest: baut jede Offline-Vorlage mit verschiedenen Paletten (hell + dunkel),
 * testet sie in Chromium im Handy-Format (Monkey-Test) und prüft die Qualität.
 *   node scripts/selftest.js            alle Vorlagen, mehrere Paletten
 *   node scripts/selftest.js --quick    je Vorlage eine helle + eine dunkle Palette
 *   node scripts/selftest.js --only habit
 */
const fs = require('fs');
const path = require('path');
const { PALETTES, STYLES, resolvePalette } = require('../src/core/design');
const { buildFiles } = require('../src/core/pwa');
const { evaluate } = require('../src/core/quality');
const { createPlaywrightTester } = require('../src/testers/playwright-tester');

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const OUT = path.join(__dirname, '..', '.selftest');

function loadTemplates() {
  if (only) return [require(`../src/core/offline/templates/${only}`)];
  return require('../src/core/offline/index').TEMPLATES;
}

(async () => {
  const { page } = require('../src/core/offline/base');
  const templates = loadTemplates();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const tester = await createPlaywrightTester();
  const rows = [];
  let failed = 0;
  const dark = PALETTES.filter((p) => p.mode !== 'light');
  const light = PALETTES.filter((p) => p.mode === 'light');
  for (const [ti, tpl] of templates.entries()) {
    const pals = quick ? [dark[ti % dark.length], light[ti % light.length]] : PALETTES.filter((_, i) => (i + ti) % 3 === 0).concat(light[ti % light.length]);
    for (const [pi, p] of [...new Set(pals)].entries()) {
      const palette = resolvePalette(p);
      const style = STYLES[(ti + pi) % STYLES.length];
      const appId = `selftest-${tpl.id}-${p.id}`;
      const name = `Nova ${tpl.word}`;
      const concept = tpl.concept(name);
      const parts = tpl.render({ appId, name, palette, style });
      const html = page({ appId, title: name, description: concept.tagline, palette, style, css: parts.css, body: parts.body, script: parts.script });
      const dir = path.join(OUT, appId);
      fs.mkdirSync(dir, { recursive: true });
      for (const [f, c] of Object.entries(buildFiles({ appId, version: 1, html, name, glyph: 'N', description: concept.tagline, palette, lang: 'de' }))) fs.writeFileSync(path.join(dir, f), c);
      const run = await tester.run(dir, { durationMs: quick ? 3000 : 4500, seed: 7 + pi });
      const rep = evaluate(html, run);
      if (run.screenshot) fs.writeFileSync(path.join(OUT, 'shots', `${tpl.id}-${p.id}.png`), run.screenshot);
      if (!rep.ok) failed++;
      rows.push({ template: tpl.id, palette: p.id, style: style.id, tech: rep.tech, errors: rep.errors.length, warnings: rep.warnings.length, detail: [...rep.errors, ...rep.warnings].slice(0, 4).join(' | ') });
    }
  }
  await tester.close();
  console.table(rows.map(({ detail, ...r }) => r));
  for (const r of rows) if (r.detail) console.log(`- ${r.template}/${r.palette}: ${r.detail}`);
  console.log(`\n${rows.length} Builds, ${failed} mit Fehlern, ${rows.filter((r) => r.warnings).length} mit Warnungen. Screenshots: ${path.join(OUT, 'shots')}`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
