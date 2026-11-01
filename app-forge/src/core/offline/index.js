'use strict';
/**
 * Offline-Generator: baut aus handgefertigten Premium-Vorlagen vollständige Apps –
 * funktioniert ohne KI/Internet. Zufall bestimmt Vorlage, Name, Farbpalette und Stil.
 */
const { PALETTES, STYLES, resolvePalette } = require('../design');
const { createRng, generateName } = require('../ideas');
const { page } = require('./base');

const TEMPLATES = ['habit', 'focus', 'budget', 'water', 'pulse', 'memory'].map((id) => require(`./templates/${id}`));

function pickTemplate(rng, { preferType = 'any', categoryHint } = {}) {
  let pool = TEMPLATES.filter((t) => preferType === 'any' || !preferType || t.type === preferType);
  if (!pool.length) pool = TEMPLATES;
  if (categoryHint) {
    const hint = String(categoryHint).toLowerCase();
    const hit = pool.filter((t) => t.category.toLowerCase() === hint || t.keywords.some((k) => hint.includes(k)));
    if (hit.length) pool = hit;
  }
  return rng.pick(pool);
}

function buildOfflineApp({ seed, appId, lang = 'de', preferType = 'any', categoryHint, paletteId, styleId, templateId } = {}) {
  const rng = createRng(seed);
  const tpl = templateId ? TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0] : pickTemplate(rng, { preferType, categoryHint });
  const palette = resolvePalette(PALETTES.find((p) => p.id === paletteId) || rng.pick(PALETTES));
  const style = STYLES.find((s) => s.id === styleId) || rng.pick(STYLES);
  const name = generateName(rng, tpl.word);
  const concept = tpl.concept(name);
  const parts = tpl.render({ appId, name, palette, style, rng });
  const html = page({ appId, lang, title: name, description: concept.tagline, palette, style, css: parts.css, body: parts.body, script: parts.script });
  return { template: tpl.id, name, glyph: name.charAt(0).toUpperCase(), type: tpl.type, category: tpl.category, palette, style, html, concept };
}

module.exports = { TEMPLATES, buildOfflineApp, pickTemplate };
