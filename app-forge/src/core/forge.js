'use strict';
/**
 * Forge-Pipeline – erschafft, testet und verbessert Apps.
 *
 *  Erschaffen (KI):  Zufalls-Seed → Trend-Bias → Konzept + Sinn-Check → Bau → Test → Fix-Schleife
 *                    → Design-Review per Screenshot → Feinschliff → Design-Gate → Version 1 → Lernspeicher
 *  Erschaffen (offline): Premium-Vorlage → Test → Version 1
 *  Weiterentwickeln: Gesundheitscheck → Plan (1 Verbesserung) → Umsetzung → Test/Fix → Review
 *                    → nur übernehmen, wenn nicht schlechter (sonst verwerfen = automatischer Rollback)
 *
 * Abhängigkeiten werden injiziert: { ai, tester, library, lessons, waterfall, emit, settings, trends, offline }
 */
const fs = require('fs');
const path = require('path');
const { randomSeed, createRng } = require('./ideas');
const { PALETTES, STYLES, paletteFromSuggestion, resolvePalette } = require('./design');
const { buildFiles } = require('./pwa');
const { evaluate, totalScore } = require('./quality');
const { extractHtml } = require('./html');
const P = require('./prompts');
const { biasSeed, trendHint } = require('./trends');

const DESIGN_GATE = 7; // Mindest-Designnote (1–10), sonst wird verworfen
const POLISH_BELOW = 8.5; // Durchschnitt darunter => Feinschliff-Runde

function trendWeight(trends) {
  const w = trends && typeof trends.weight === 'function' ? Number(trends.weight()) : 0.6;
  return Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0.6;
}

/** Neue Version nur übernehmen, wenn sie nicht schlechter ist und das Design-Gate besteht. */
function acceptDecision(score, baseline, review) {
  const designOk = !review || review.design >= DESIGN_GATE;
  if (score >= baseline - 3 && designOk) return { accept: true, reason: `Score ${baseline} → ${score}` };
  return { accept: false, reason: !designOk ? `Design fiel auf ${review.design}/10` : `Score würde sinken (${baseline} → ${score})` };
}

const CONCEPT_REQUIRED = ['name', 'tagline', 'type', 'category', 'target_audience', 'problem_or_fun', 'core_loop', 'monetization', 'store_short_description', 'store_full_description'];

function validateConcept(c) {
  if (!c || typeof c !== 'object') throw new Error('Konzept fehlt.');
  const missing = CONCEPT_REQUIRED.filter((k) => !c[k] || !String(c[k]).trim());
  if (missing.length) throw new Error(`Konzept unvollständig: ${missing.join(', ')}`);
  if (!['game', 'tool'].includes(c.type)) throw new Error('Konzept: type muss "game" oder "tool" sein.');
  if (!Array.isArray(c.features) || c.features.length < 2) throw new Error('Konzept: mindestens 2 features.');
  if (!Array.isArray(c.keywords) || !c.keywords.length) throw new Error('Konzept: keywords fehlen.');
  const s = c.sense_check;
  if (s) {
    const weakest = Math.min(s.usefulness, s.clarity, s.originality, s.feasibility, s.market_fit);
    if (!(weakest >= 7)) throw new Error(`Sinn-Check nicht bestanden (schwächster Wert ${weakest}/10).`);
  }
  return c;
}

function rand32() {
  return (Math.random() * 4294967296) >>> 0;
}

function avgReview(r) {
  return r ? (Number(r.design) + Number(r.ux) + Number(r.sense) + Number(r.polish)) / 4 : 0;
}

function clampReview(r) {
  const c = (v) => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
  return { ...r, design: c(r.design), ux: c(r.ux), sense: c(r.sense), polish: c(r.polish), bugs: (r.bugs || []).slice(0, 8), improvements: (r.improvements || []).slice(0, 8) };
}

class Forge {
  constructor(deps) {
    this.d = deps;
  }

  get lang() {
    return this.d.settings.get('core.language', 'de');
  }

  stage(stage, message, extra = {}) {
    this.d.emit('pipeline.stage', { stage, message, ...extra });
  }

  check(job) {
    if (job && job.checkCancelled) job.checkCancelled();
  }

  /** Schreibt alle Dateien eines Kandidaten in einen Stage-Ordner und testet ihn. */
  async writeAndTest({ appId, dir, html, info, version }) {
    const { library, tester, waterfall } = this.d;
    const files = buildFiles({ appId, version, html, name: info.name, glyph: info.glyph, description: info.tagline, palette: info.palette, lang: this.lang });
    library.writeFiles(dir, files);
    if (tester.rasterize) {
      for (const size of [192, 512]) {
        try {
          const png = await tester.rasterize(files['icon.svg'], size);
          if (png) fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
        } catch {
          /* Icons sind optional */
        }
      }
    }
    const run = await tester.run(dir, { durationMs: 6000, seed: rand32() & 0xffff });
    let report = evaluate(html, run);
    report = await waterfall('test.extra', report, { appId, html, run });
    if (run.screenshot) fs.writeFileSync(path.join(dir, 'screenshot.png'), run.screenshot);
    return { report, screenshot: run.screenshot || null };
  }

  /** Bau-/Fix-Schleife: so lange korrigieren, bis der Test fehlerfrei ist. */
  async buildLoop({ appId, dir, html, info, version, job, system, maxRounds }) {
    const { ai } = this.d;
    const seenErrors = [];
    let current = html;
    let result = null;
    for (let round = 0; round <= maxRounds; round++) {
      this.check(job);
      this.stage('test', round === 0 ? 'Automatischer Test im Handy-Format …' : `Test nach Korrektur ${round} …`, { appId });
      result = await this.writeAndTest({ appId, dir, html: current, info, version });
      this.d.emit('test.finished', { appId, version, ok: result.report.ok, score: result.report.tech, errors: result.report.errors, warnings: result.report.warnings });
      if (result.report.ok) break;
      seenErrors.push(...result.report.errors);
      if (round === maxRounds || !ai || !ai.isAvailable()) break;
      this.stage('fix', `${result.report.errors.length} Fehler gefunden – KI repariert …`, { appId });
      const fixed = extractHtml(await ai.text({ system, prompt: P.fixPrompt({ html: current, errors: result.report.errors, warnings: result.report.warnings }), effort: 'high', purpose: 'fix', signal: job && job.signal }));
      if (fixed) current = fixed;
    }
    return { html: current, ...result, seenErrors };
  }

  async review({ concept, html, report, screenshot, job }) {
    const { ai } = this.d;
    if (!ai || !ai.isAvailable() || !screenshot) return null;
    this.stage('review', 'Design-Jury bewertet Screenshot und Code …');
    const r = await ai.json({ system: P.REVIEW_SYSTEM, prompt: P.reviewPrompt({ concept, html, test: report }), schema: P.REVIEW_SCHEMA, effort: 'medium', purpose: 'review', imagePng: screenshot, signal: job && job.signal });
    return clampReview(r);
  }

  async learn(errors, job) {
    const { ai, lessons, emit } = this.d;
    if (!errors.length || !ai || !ai.isAvailable() || !lessons) return;
    try {
      const out = await ai.json({ system: 'Du destillierst wiederverwendbare Entwicklungsregeln.', prompt: P.lessonPrompt({ errors: [...new Set(errors)].slice(0, 15) }), schema: P.LESSON_SCHEMA, effort: 'low', maxTokens: 4000, purpose: 'lessons', signal: job && job.signal });
      const added = lessons.add(out.lessons, { source: 'fix' });
      if (added.length) emit('lessons.added', { lessons: added.map((l) => l.text) });
    } catch (err) {
      emit('log', { level: 'warn', message: `Lernspeicher: ${err.message}` });
    }
  }

  // ------------------------------------------------------------------ Erschaffen
  async create({ preferType = 'any', job } = {}) {
    const { ai } = this.d;
    return ai && ai.isAvailable() ? this.createWithAi({ preferType, job }) : this.createOffline({ preferType, job });
  }

  async createOffline({ preferType, job }) {
    const { library, offline, trends, emit } = this.d;
    const seed = rand32();
    const report = trends && trends.get();
    const rng = createRng(seed);
    const { opportunity } = biasSeed(randomSeed(seed), report, rng, trendWeight(trends));
    const hint = opportunity ? opportunity.category : undefined;
    this.stage('idea', 'Wähle Premium-Vorlage, Palette und Namen …');
    const draft = offline.buildOfflineApp({ seed, appId: 'draft-app', lang: this.lang, preferType, categoryHint: hint });
    const appId = library.newId(draft.name);
    const built = offline.buildOfflineApp({ seed, appId, lang: this.lang, preferType, categoryHint: hint });
    const info = { name: built.name, glyph: built.glyph, tagline: built.concept.tagline, palette: built.palette };
    const dir = library.stage(appId);
    try {
      const res = await this.buildLoop({ appId, dir, html: built.html, info, version: 1, job, system: '', maxRounds: 0 });
      if (!res.report.ok) throw new Error(`Vorlage fehlerhaft: ${res.report.errors.slice(0, 2).join(' | ')}`);
      const score = totalScore(res.report.tech, null);
      const meta = this.metaFrom({ appId, concept: built.concept, palette: built.palette, style: built.style, glyph: built.glyph, source: 'offline', template: built.template, opportunity });
      meta.lastTest = this.testSummary(res.report);
      const out = library.createApp(meta, dir, { title: 'Erste Version (Premium-Vorlage)', description: built.concept.tagline, score, tech: res.report.tech, review: null, source: 'offline' });
      emit('app.created', { app: out.meta });
      return out.meta;
    } catch (err) {
      library.discard(dir);
      if (!library.exists(appId)) library.remove(appId);
      throw err;
    }
  }

  async createWithAi({ preferType, job }) {
    const { ai, library, lessons, emit, settings, trends } = this.d;
    const lang = this.lang;
    const maxRounds = settings.get('core.maxFixRounds', 3);
    const minScore = settings.get('core.minScore', 65);

    // 1) Idee: Zufall + Trend
    const seedNum = rand32();
    const rng = createRng(seedNum);
    let seed = randomSeed(seedNum);
    if (preferType === 'game' || preferType === 'tool') seed = { ...seed, type: preferType };
    const report = trends && trends.get();
    const biased = preferType === 'any' ? biasSeed(seed, report, rng, trendWeight(trends)) : { seed, opportunity: null };
    seed = biased.seed;
    const existing = library.list().map((a) => a.name);
    this.stage('idea', `Idee: ${seed.type === 'game' ? 'Spiel' : 'App'} · ${seed.category} · für ${seed.audience}${biased.opportunity ? ' · Trend-Chance' : ''}`);

    // 2) Konzept mit Sinn-Check
    let concept = null;
    let feedback = '';
    for (let i = 0; i < 3 && !concept; i++) {
      this.check(job);
      this.stage('concept', i === 0 ? 'KI entwickelt das Konzept + Sinn-Check …' : 'Konzept nachgeschärft …');
      const c = await ai.json({ system: P.CONCEPT_SYSTEM, prompt: P.conceptPrompt({ seed, trendHint: trendHint(report, biased.opportunity), existing, lang, feedback }), schema: P.CONCEPT_SCHEMA, effort: 'medium', purpose: 'concept', signal: job && job.signal });
      const s = c.sense_check || {};
      const weakest = Math.min(s.usefulness, s.clarity, s.originality, s.feasibility, s.market_fit);
      if (weakest >= 7 && !existing.includes(c.name)) concept = c;
      else feedback = existing.includes(c.name) ? 'Name existiert bereits.' : `Schwachstelle im Sinn-Check (${weakest}/10): ${s.verdict}`;
    }
    if (!concept) throw new Error('Kein Konzept hat den Sinn-Check bestanden – nächster Versuch mit neuen Impulsen.');
    concept = await this.d.waterfall('concept.check', concept, { seed });
    const palette = paletteFromSuggestion(concept.design, PALETTES.find((p) => p.id === seed.palette) || PALETTES[0]);
    const style = STYLES.find((s) => s.id === seed.style) || STYLES[0];
    const glyph = (concept.icon_glyph || concept.name || 'A').trim().slice(0, 2);
    const appId = library.newId(concept.name);
    const system = P.builderSystem({ lang, appId, lessons: lessons ? lessons.top(15) : [] });
    const info = { name: concept.name, glyph, tagline: concept.tagline, palette };
    emit('log', { level: 'info', message: `Konzept „${concept.name}“: ${concept.tagline}` });

    const dir = library.stage(appId);
    try {
      // 3) Bau
      this.check(job);
      this.stage('build', `Baue „${concept.name}“ (Design + Code) …`, { appId });
      let html = extractHtml(await ai.text({ system, prompt: P.buildPrompt({ concept, palette, style, lang }), effort: 'high', purpose: 'build', signal: job && job.signal }));
      if (!html) throw new Error('KI hat kein vollständiges HTML geliefert.');
      html = await this.d.waterfall('html.post', html, { appId, concept });

      // 4) Test + Fix
      let res = await this.buildLoop({ appId, dir, html, info, version: 1, job, system, maxRounds });
      if (!res.report.ok) throw new Error(`Qualitätsprüfung nicht bestanden: ${res.report.errors.slice(0, 3).join(' | ')}`);
      const allErrors = [...res.seenErrors];

      // 5) Design-Review + Feinschliff
      let review = await this.review({ concept, html: res.html, report: res.report, screenshot: res.screenshot, job });
      if (review && (avgReview(review) < POLISH_BELOW || review.design < 8) && ai.budgetLeft().calls > 3) {
        this.stage('polish', `Feinschliff (Design ${review.design}/10) …`, { appId });
        const polished = extractHtml(await ai.text({ system, prompt: P.polishPrompt({ html: res.html, review }), effort: 'high', purpose: 'polish', signal: job && job.signal }));
        if (polished) {
          const dir2 = library.stage(appId);
          const res2 = await this.buildLoop({ appId, dir: dir2, html: polished, info, version: 1, job, system, maxRounds: Math.min(2, maxRounds) });
          allErrors.push(...res2.seenErrors);
          const review2 = res2.report.ok ? await this.review({ concept, html: res2.html, report: res2.report, screenshot: res2.screenshot, job }) : null;
          if (res2.report.ok && review2 && totalScore(res2.report.tech, review2) >= totalScore(res.report.tech, review)) {
            library.discard(dir);
            res = res2;
            review = review2;
            res.dir = dir2;
          } else {
            library.discard(dir2);
          }
        }
      }
      const finalDir = res.dir || dir;
      if (review && review.design < DESIGN_GATE) throw new Error(`Design-Gate: nur ${review.design}/10 – nicht gut genug, wird verworfen.`);
      const score = totalScore(res.report.tech, review);
      if (score < minScore) throw new Error(`Gesamtscore ${score} unter Mindestwert ${minScore} – verworfen.`);

      // 6) Übernehmen + lernen
      const meta = this.metaFrom({ appId, concept, palette, style, glyph, source: 'ai', opportunity: biased.opportunity });
      meta.lastTest = this.testSummary(res.report);
      const out = library.createApp(meta, finalDir, { title: 'Erste Version', description: concept.tagline, score, tech: res.report.tech, review, source: 'ai' });
      emit('app.created', { app: out.meta });
      await this.learn(allErrors, job);
      return out.meta;
    } catch (err) {
      for (const d of fs.existsSync(library._dir(appId)) ? fs.readdirSync(library._dir(appId)) : []) {
        if (d.startsWith('_stage-')) library.discard(path.join(library._dir(appId), d));
      }
      if (!library.exists(appId)) library.remove(appId);
      emit('app.version.rejected', { appId, reason: err.message, name: concept && concept.name });
      throw err;
    }
  }

  metaFrom({ appId, concept, palette, style, glyph, source, template, opportunity }) {
    const p = resolvePalette(palette);
    return {
      id: appId,
      name: concept.name,
      tagline: concept.tagline,
      type: concept.type,
      category: concept.category,
      source,
      template: template || null,
      glyph,
      palette: { id: p.id, mode: p.mode, bg: p.bg, accent: p.accent, glow: p.glow, text: p.text, muted: p.muted, onAccent: p.onAccent },
      style: { id: style.id, name: style.name, radius: style.radius, blur: style.blur },
      concept,
      trend: opportunity || null
    };
  }

  testSummary(report) {
    return { ok: report.ok, errors: report.errors, warnings: report.warnings, tech: report.tech, at: Date.now() };
  }

  // ------------------------------------------------------------------ Gratis-Modus (Claude-Abo-Sitzung als KI)
  /** Design/Palette/Stil eines extern gebauten Konzepts auflösen. */
  designFor(concept) {
    const base = PALETTES.find((p) => p.id === concept.palette) || PALETTES[0];
    const palette = paletteFromSuggestion(concept.design, base);
    const style = STYLES.find((s) => s.id === concept.style) || STYLES[0];
    const glyph = String(concept.icon_glyph || concept.name || 'A').trim().slice(0, 2);
    return { palette, style, glyph };
  }

  /** Testet eine HTML-App ohne sie zu übernehmen (für die Fix-Schleife der Abo-Sitzung). */
  async checkHtml({ html, concept, dir }) {
    const doc = extractHtml(html) || String(html || '');
    const { palette, glyph } = this.designFor(concept || { name: 'App' });
    const info = { name: (concept && concept.name) || 'App', glyph, tagline: (concept && concept.tagline) || '', palette };
    fs.mkdirSync(dir, { recursive: true });
    const res = await this.writeAndTest({ appId: 'check', dir, html: doc, info, version: 1 });
    return { report: res.report, screenshot: res.screenshot ? path.join(dir, 'screenshot.png') : null, dir };
  }

  /** Übernimmt eine extern gebaute App (z. B. aus der nächtlichen Claude-Sitzung) – gleiche Gates wie die KI-Pipeline. */
  async importApp({ html, concept, review = null, source = 'abo', job } = {}) {
    const { library, emit, settings } = this.d;
    validateConcept(concept);
    const doc = extractHtml(html) || String(html || '');
    if (library.list().some((a) => a.name === concept.name)) throw new Error(`Name „${concept.name}“ existiert bereits.`);
    const { palette, style, glyph } = this.designFor(concept);
    const appId = library.newId(concept.name);
    const info = { name: concept.name, glyph, tagline: concept.tagline, palette };
    const dir = library.stage(appId);
    try {
      const res = await this.buildLoop({ appId, dir, html: doc, info, version: 1, job, system: '', maxRounds: 0 });
      if (!res.report.ok) {
        const err = new Error(`Test nicht bestanden: ${res.report.errors.slice(0, 3).join(' | ')}`);
        err.report = res.report;
        throw err;
      }
      const rv = review ? clampReview(review) : null;
      if (rv && rv.design < DESIGN_GATE) throw new Error(`Design-Gate: nur ${rv.design}/10 – nicht gut genug.`);
      const score = totalScore(res.report.tech, rv);
      const minScore = settings.get('core.minScore', 65);
      if (score < minScore) throw new Error(`Gesamtscore ${score} unter Mindestwert ${minScore}.`);
      const meta = this.metaFrom({ appId, concept, palette, style, glyph, source });
      meta.lastTest = this.testSummary(res.report);
      const out = library.createApp(meta, dir, { title: 'Erste Version', description: concept.tagline, score, tech: res.report.tech, review: rv, source });
      emit('app.created', { app: out.meta });
      return out.meta;
    } catch (err) {
      library.discard(dir);
      if (!library.exists(appId)) library.remove(appId);
      throw err;
    }
  }

  /** Übernimmt eine extern verbesserte Version nur, wenn sie nicht schlechter ist (sonst verworfen). */
  async importVersion(appId, { html, title, description = '', kind = 'feature', review = null, source = 'abo', job } = {}) {
    const { library, emit } = this.d;
    if (!title) throw new Error('Titel der Verbesserung fehlt.');
    const meta = library.readMeta(appId);
    const current = await this.test(appId, { job });
    const lastV = meta.versions.find((v) => v.n === meta.currentVersion) || {};
    const baseline = current.ok ? totalScore(current.tech, lastV.review) : 0;
    const version = (meta.versions.reduce((m, v) => Math.max(m, v.n), 0) || 0) + 1;
    const dir = library.stage(appId);
    const info = { name: meta.name, glyph: meta.glyph, tagline: meta.tagline, palette: meta.palette };
    try {
      const res = await this.buildLoop({ appId, dir, html: extractHtml(html) || String(html || ''), info, version, job, system: '', maxRounds: 0 });
      const rv = review ? clampReview(review) : null;
      const score = res.report.ok ? totalScore(res.report.tech, rv) : 0;
      const decision = res.report.ok ? acceptDecision(score, baseline, rv) : { accept: false, reason: `Tests nicht bestanden: ${res.report.errors.slice(0, 2).join(' | ')}` };
      if (!decision.accept) {
        library.discard(dir);
        library.reject(appId, { title, reason: decision.reason });
        emit('app.version.rejected', { appId, reason: decision.reason, title });
        return { changed: false, reason: decision.reason, report: res.report };
      }
      const out = library.commit(appId, dir, { kind: kind === 'bugfix' ? 'fix' : 'evolve', title, description, score, tech: res.report.tech, review: rv, source });
      library.update(appId, { lastTest: this.testSummary(res.report) });
      emit('app.version.created', { appId, version: out.version, name: meta.name });
      return { changed: true, version: out.version, reason: decision.reason, report: res.report };
    } catch (err) {
      library.discard(dir);
      throw err;
    }
  }

  // ------------------------------------------------------------------ Testen
  async test(appId, { job } = {}) {
    const { library, tester, emit } = this.d;
    const meta = library.readMeta(appId);
    const dir = library.currentDir(appId);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    this.stage('test', `Gesundheitscheck „${meta.name}“ …`, { appId });
    this.check(job);
    const run = await tester.run(dir, { durationMs: 6000, seed: rand32() & 0xffff });
    const report = await this.d.waterfall('test.extra', evaluate(html, run), { appId, html, run });
    if (run.screenshot) fs.writeFileSync(path.join(dir, 'screenshot.png'), run.screenshot);
    library.update(appId, { lastTest: this.testSummary(report), lastCheckedAt: Date.now() });
    emit('test.finished', { appId, version: meta.currentVersion, ok: report.ok, score: report.tech, errors: report.errors, warnings: report.warnings });
    return report;
  }

  // ------------------------------------------------------------------ Weiterentwickeln
  async evolve(appId, { job } = {}) {
    const { ai, library, emit, settings, lessons } = this.d;
    const meta = library.readMeta(appId);
    const current = await this.test(appId, { job });
    if (!ai || !ai.isAvailable()) {
      emit('log', { level: 'info', message: `„${meta.name}“ geprüft (${current.ok ? 'fehlerfrei' : `${current.errors.length} Fehler`}). Weiterentwicklung braucht einen API-Key.` });
      return { changed: false, report: current };
    }
    const html = library.readCurrentHtml(appId);
    const lastV = meta.versions.find((v) => v.n === meta.currentVersion) || {};
    const baseline = current.ok ? totalScore(current.tech, lastV.review) : 0;
    const history = meta.versions.map((v) => v.title).slice(-12);

    this.stage('plan', `Plane die nächste Verbesserung für „${meta.name}“ …`, { appId });
    const plan = await ai.json({ system: P.CONCEPT_SYSTEM, prompt: P.evolvePlanPrompt({ meta, test: current, history }), schema: P.EVOLVE_SCHEMA, effort: 'medium', purpose: 'plan', signal: job && job.signal });
    emit('log', { level: 'info', message: `Plan für „${meta.name}“: ${plan.title}` });

    const system = P.builderSystem({ lang: this.lang, appId, lessons: lessons ? lessons.top(15) : [] });
    this.stage('build', `Setze um: ${plan.title} …`, { appId });
    const next = extractHtml(await ai.text({ system, prompt: P.evolveBuildPrompt({ html, plan }), effort: 'high', purpose: 'evolve', signal: job && job.signal }));
    if (!next) throw new Error('KI hat kein vollständiges HTML geliefert.');

    const version = (meta.versions.reduce((m, v) => Math.max(m, v.n), 0) || 0) + 1;
    const dir = library.stage(appId);
    const info = { name: meta.name, glyph: meta.glyph, tagline: meta.tagline, palette: meta.palette };
    try {
      const res = await this.buildLoop({ appId, dir, html: await this.d.waterfall('html.post', next, { appId, concept: meta.concept }), info, version, job, system, maxRounds: settings.get('core.maxFixRounds', 3) });
      let decision;
      let review = null;
      let score = 0;
      if (!res.report.ok) {
        decision = { accept: false, reason: `Tests nicht bestanden: ${res.report.errors.slice(0, 2).join(' | ')}` };
      } else {
        review = await this.review({ concept: meta.concept, html: res.html, report: res.report, screenshot: res.screenshot, job });
        score = totalScore(res.report.tech, review);
        decision = acceptDecision(score, baseline, review);
      }
      decision = await this.d.waterfall('version.accept', decision, { appId, plan, score, baseline, report: res.report, review });
      if (!decision.accept) {
        library.discard(dir);
        library.reject(appId, { title: plan.title, reason: decision.reason });
        emit('app.version.rejected', { appId, reason: decision.reason, title: plan.title });
        await this.learn(res.seenErrors, job);
        return { changed: false, reason: decision.reason };
      }
      const out = library.commit(appId, dir, { kind: plan.kind === 'bugfix' ? 'fix' : 'evolve', title: plan.title, description: plan.description, score, tech: res.report.tech, review, source: 'ai' });
      library.update(appId, { lastTest: this.testSummary(res.report) });
      emit('app.version.created', { appId, version: out.version, name: meta.name });
      await this.learn(res.seenErrors, job);
      return { changed: true, version: out.version, reason: decision.reason };
    } catch (err) {
      library.discard(dir);
      throw err;
    }
  }
}

module.exports = { Forge, DESIGN_GATE, validateConcept, acceptDecision };
