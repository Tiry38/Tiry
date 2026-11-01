'use strict';
/**
 * Kern-Anschlüsse: Bibliothek, Lernspeicher, KI, Trend-Radar, Generatoren,
 * Forge-Pipeline, Autopilot, Export, Statistik.
 */
const path = require('path');
const fs = require('fs');
const { Library } = require('../core/library');
const { Lessons } = require('../core/lessons');
const { AiClient, MODELS } = require('../core/ai-client');
const { buildTrendReport } = require('../core/trends');
const { Forge } = require('../core/forge');
const { Autopilot } = require('../core/autopilot');
const { exportApp } = require('../core/exporter');
const { readiness } = require('../core/readiness');
const offline = require('../core/offline');

const library = {
  id: 'storage.library',
  name: 'App-Bibliothek',
  kind: 'storage',
  description: 'Speichert alle Apps mit Versionen, Rollback und Metadaten auf der Festplatte.',
  provides: ['library'],
  settings: [{ key: 'keepVersions', label: 'Versionen pro App behalten', type: 'number', default: 20 }],
  start(ctx) {
    const lib = new Library(ctx.paths.apps, { keepVersions: ctx.config.get('keepVersions') });
    ctx.provide('library', lib);
    ctx.action('apps.list', () => lib.list(), { description: 'Alle Apps' });
    ctx.action('apps.get', ({ id }) => lib.readMeta(id), { description: 'Eine App' });
    ctx.action('apps.delete', ({ id }) => {
      lib.remove(id);
      ctx.bus.emit('app.deleted', { id });
      return true;
    }, { description: 'App löschen', expose: false });
    ctx.action('apps.rollback', ({ id, n }) => {
      const meta = lib.rollback(id, n);
      ctx.bus.emit('app.rolledback', { appId: id, version: Number(n) });
      return meta;
    }, { description: 'Auf Version zurückrollen' });
    ctx.action('apps.previewUrl', ({ id, n }) => {
      const meta = lib.readMeta(id);
      return `forge://${id}/v${n || meta.currentVersion}/index.html`;
    }, { description: 'Vorschau-Adresse' });
    ctx.action('apps.readiness', ({ id }) => {
      const meta = lib.readMeta(id);
      const r = readiness(meta, lib.versionDir(id, meta.currentVersion));
      lib.update(id, { readiness: { ready: r.ready, score: r.score, at: r.at } });
      return r;
    }, { description: 'Verkaufsbereitschaft prüfen' });
    ctx.action('apps.html', ({ id }) => lib.readCurrentHtml(id), { description: 'HTML der aktuellen Version' });
  },
  health(ctx) {
    const lib = ctx.get('library');
    return { ok: true, message: `${lib.list().length} Apps gespeichert` };
  }
};

const lessons = {
  id: 'memory.lessons',
  name: 'Lernspeicher',
  kind: 'quality',
  description: 'Destilliert aus jedem behobenen Fehler eine Regel – fließt in alle künftigen Builds ein.',
  provides: ['lessons'],
  start(ctx) {
    const store = new Lessons(path.join(ctx.paths.data, 'lessons.json'));
    ctx.provide('lessons', store);
    ctx.action('lessons.list', () => store.list(), { description: 'Gelernte Regeln' });
    ctx.action('lessons.remove', ({ text }) => store.remove(text), { description: 'Regel entfernen', expose: false });
    ctx.action('lessons.clear', () => store.clear(), { description: 'Lernspeicher leeren', expose: false });
  },
  health(ctx) {
    return { ok: true, message: `${ctx.get('lessons').list().length} Regeln gelernt` };
  }
};

const ai = {
  id: 'ai.anthropic',
  name: 'Claude KI',
  kind: 'ai',
  description: 'Claude (Anthropic) für Konzepte, Code, Design-Review, Fehlerbehebung und Trend-Recherche. Ohne Key läuft alles im Offline-Modus.',
  provides: ['ai'],
  settings: [
    { key: 'apiKey', label: 'Anthropic API-Key', type: 'password', secret: true, default: '', help: 'Erstellen unter console.anthropic.com → API Keys. Wird verschlüsselt gespeichert.' },
    { key: 'model', label: 'Modell', type: 'select', default: 'claude-opus-5-5', options: MODELS }
  ],
  start(ctx) {
    const apiKey = ctx.config.get('apiKey') || process.env.ANTHROPIC_API_KEY || '';
    const client = new AiClient({
      apiKey,
      model: ctx.config.get('model') || 'claude-opus-5-5',
      usageFile: path.join(ctx.paths.data, 'usage.json'),
      limits: () => ctx.settings.get('budget', { dailyUsd: 5, dailyCalls: 60 }),
      emit: (type, payload) => ctx.bus.emit(type, payload)
    });
    ctx.provide('ai', client);
    ctx.action('ai.usage', () => client.usage(), { description: 'KI-Nutzung und Kosten' });
    ctx.action('ai.test', () => client.test(), { description: 'Verbindung testen', expose: false });
  },
  health(ctx) {
    const c = ctx.get('ai');
    return c && c.isAvailable() ? { ok: true, message: `Bereit (${c.model})` } : { ok: false, message: 'Kein API-Key – Offline-Modus' };
  }
};

const trends = {
  id: 'radar.trends',
  name: 'Trend-Radar',
  kind: 'integration',
  description: 'Liest App-Store-Charts und recherchiert per KI-Websuche, was gerade gefragt ist und Geld verdient.',
  provides: ['trends'],
  settings: [
    { key: 'country', label: 'Land (App Store)', type: 'select', default: 'de', options: [{ value: 'de', label: 'Deutschland' }, { value: 'at', label: 'Österreich' }, { value: 'ch', label: 'Schweiz' }, { value: 'us', label: 'USA' }, { value: 'gb', label: 'Großbritannien' }] },
    { key: 'useAi', label: 'KI-Websuche nutzen (kostet API-Guthaben)', type: 'boolean', default: true },
    { key: 'refreshHours', label: 'Automatisch aktualisieren alle (Stunden)', type: 'number', default: 24 },
    { key: 'weight', label: 'Anteil trendgesteuerter Ideen (%)', type: 'number', default: 60 }
  ],
  start(ctx) {
    const file = path.join(ctx.paths.data, 'trends.json');
    let report = null;
    try {
      report = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      report = null;
    }
    const api = {
      get: () => report,
      weight: () => Math.max(0, Math.min(100, Number(ctx.config.get('weight')) || 0)) / 100
    };
    ctx.provide('trends', api);
    const refresh = (source = 'ui') => {
      if (ctx.jobs.hasQueued('trends')) return { jobId: null };
      const job = ctx.jobs.add({
        type: 'trends',
        title: 'Trend-Radar aktualisieren',
        source,
        run: async (j) => {
          j.progress(10, 'Charts & Recherche');
          report = await buildTrendReport({ ai: ctx.get('ai'), country: ctx.config.get('country'), useAi: !!ctx.config.get('useAi'), signal: j.signal, emit: (t, p) => ctx.bus.emit(t, p) });
          fs.writeFileSync(file, JSON.stringify(report, null, 2));
          ctx.bus.emit('trends.updated', { updatedAt: report.updatedAt, live: report.live });
          return { live: report.live };
        }
      });
      return { jobId: job.id };
    };
    ctx.action('trends.get', () => report, { description: 'Aktueller Trend-Bericht' });
    ctx.action('trends.refresh', ({ source } = {}) => refresh(source), { description: 'Trends neu laden' });
    const hours = Math.max(1, Number(ctx.config.get('refreshHours')) || 24);
    const due = () => !report || Date.now() - report.updatedAt > hours * 3600e3;
    const timer = setInterval(() => { if (due()) refresh('timer'); }, 3600e3);
    if (timer.unref) timer.unref();
    ctx.onStop(() => clearInterval(timer));
    if (due() && !ctx.env.cloud) setTimeout(() => refresh('start'), 5000).unref?.();
  },
  health(ctx) {
    const r = ctx.get('trends').get();
    return r ? { ok: true, message: `Stand ${new Date(r.updatedAt).toLocaleString('de-DE')} · ${r.live ? 'live' : 'Basiswissen'}` } : { ok: true, message: 'Noch kein Bericht' };
  }
};

const offlineGen = {
  id: 'generator.offline',
  name: 'Premium-Vorlagen',
  kind: 'generator',
  description: `${offline.TEMPLATES.length} handgefertigte Premium-Apps (organisches Design, Verläufe) – funktionieren ohne KI.`,
  provides: ['generator.offline'],
  start(ctx) {
    ctx.provide('generator.offline', offline);
  }
};

const forge = {
  id: 'forge.pipeline',
  name: 'Forge-Pipeline',
  kind: 'core',
  description: 'Erschafft, testet und verbessert Apps: Idee → Konzept → Bau → Test → Fix → Design-Jury → Version.',
  provides: ['forge'],
  requires: ['library', 'tester', 'lessons'],
  start(ctx) {
    const deps = {
      get ai() { return ctx.get('ai'); },
      get tester() { return ctx.require('tester'); },
      get library() { return ctx.require('library'); },
      get lessons() { return ctx.get('lessons'); },
      get trends() { return ctx.get('trends'); },
      get offline() { return ctx.get('generator.offline') || offline; },
      settings: ctx.settings,
      waterfall: (name, value, c) => ctx.waterfall(name, value, c),
      emit: (type, payload) => ctx.bus.emit(type, payload)
    };
    const engine = new Forge(deps);
    ctx.provide('forge', engine);
    const aiOn = () => !!(ctx.get('ai') && ctx.get('ai').isAvailable());

    const queueCreate = ({ count = 1, type = 'any', source = 'ui' } = {}) => {
      const n = Math.max(1, Math.min(10, Number(count) || 1));
      const jobIds = [];
      for (let i = 0; i < n; i++) {
        const job = ctx.jobs.add({
          type: 'create',
          title: `Neue App erschaffen${n > 1 ? ` (${i + 1}/${n})` : ''}`,
          source,
          run: async (j) => {
            j.progress(5, 'Start');
            const meta = await engine.create({ preferType: type, job: j });
            return { appId: meta.id, name: meta.name };
          }
        });
        jobIds.push(job.id);
      }
      return { jobIds };
    };
    ctx.action('forge.create', queueCreate, { description: 'Neue App(s) erschaffen' });
    ctx.action('forge.evolve', ({ id, source = 'ui' }) => {
      const job = ctx.jobs.add({ type: 'evolve', title: 'App weiterentwickeln', source, meta: { appId: id }, run: (j) => engine.evolve(id, { job: j }) });
      return { jobId: job.id };
    }, { description: 'App verbessern' });
    ctx.action('forge.test', ({ id, source = 'ui' }) => {
      const job = ctx.jobs.add({ type: 'test', title: 'App testen', source, meta: { appId: id }, run: async (j) => { const r = await engine.test(id, { job: j }); return { ok: r.ok, tech: r.tech }; } });
      return { jobId: job.id };
    }, { description: 'App testen' });
    ctx.action('forge.status', () => {
      const c = ctx.get('ai');
      return { aiAvailable: aiOn(), mode: aiOn() ? 'ai' : 'offline', model: c ? c.model : null, busy: ctx.jobs.isBusy() };
    }, { description: 'Modus und Status' });
    // Synchrone Varianten für Cloud-Läufe (warten auf das Ergebnis)
    ctx.action('forge.createNow', async ({ type = 'any' } = {}) => {
      const { jobIds } = queueCreate({ count: 1, type, source: 'cloud' });
      const job = ctx.jobs.jobs.find((j) => j.id === jobIds[0]);
      return job.done;
    }, { description: 'App erschaffen und auf Ergebnis warten', expose: false });
  }
};

const autopilot = {
  id: 'evolution.autopilot',
  name: 'Autopilot',
  kind: 'evolution',
  description: 'Arbeitet dauerhaft: neue Apps, tägliche Gesundheitschecks, Fehlerbehebung und Weiterentwicklung mit Rollback.',
  provides: ['autopilot'],
  requires: ['forge', 'library'],
  start(ctx) {
    const pilot = new Autopilot({
      settings: ctx.settings,
      jobs: ctx.jobs,
      invoke: async (name, args) => {
        const res = await ctx.invoke(name, args);
        const ids = res.jobIds || (res.jobId ? [res.jobId] : []);
        for (const id of ids) {
          const job = ctx.jobs.jobs.find((j) => j.id === id);
          if (job) await job.done;
        }
        return res;
      },
      library: ctx.require('library'),
      emit: (t, p) => ctx.bus.emit(t, p),
      aiAvailable: () => !!(ctx.get('ai') && ctx.get('ai').isAvailable())
    });
    ctx.provide('autopilot', pilot);
    ctx.action('autopilot.status', () => pilot.status(), { description: 'Autopilot-Status' });
    ctx.action('autopilot.set', (patch) => pilot.set(patch), { description: 'Autopilot einstellen' });
    ctx.action('autopilot.runNow', () => {
      pilot.tick();
      return pilot.status();
    }, { description: 'Autopilot sofort ausführen' });
    pilot.start();
    ctx.onStop(() => pilot.stop());
  }
};

const exporter = {
  id: 'export.store',
  name: 'Store-Export',
  kind: 'export',
  description: 'Erstellt Store-Pakete: PWA, Capacitor-Projekt (Android/iOS), Store-Texte, Datenschutz-Vorlage, Anleitung.',
  provides: ['exporter'],
  requires: ['library'],
  start(ctx) {
    ctx.action('export.app', async ({ id }) => {
      const lib = ctx.require('library');
      const meta = lib.readMeta(id);
      const extra = await ctx.waterfall('export.files', {}, { app: meta });
      const out = exportApp({ library: lib, meta, outRoot: ctx.paths.exports, extraFiles: extra });
      ctx.bus.emit('export.done', { appId: id, dir: out.dir });
      return out;
    }, { description: 'Store-Paket exportieren' });
  }
};

const stats = {
  id: 'stats.local',
  name: 'Statistik',
  kind: 'quality',
  description: 'Zählt Erschaffungen, Verbesserungen, Ablehnungen und Scores – Grundlage für Qualitätstrends.',
  provides: ['stats'],
  requires: ['library'],
  start(ctx) {
    const file = path.join(ctx.paths.data, 'stats.json');
    let days = {};
    try {
      days = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      days = {};
    }
    const today = () => new Date().toISOString().slice(0, 10);
    const bump = (k) => {
      const d = (days[today()] = days[today()] || { created: 0, evolved: 0, rejected: 0 });
      d[k] += 1;
      fs.writeFileSync(file, JSON.stringify(days));
    };
    ctx.bus.on('app.created', () => bump('created'));
    ctx.bus.on('app.version.created', () => bump('evolved'));
    ctx.bus.on('app.version.rejected', () => bump('rejected'));
    ctx.action('stats.get', () => {
      const apps = ctx.require('library').list();
      const scored = apps.filter((a) => typeof a.score === 'number');
      const byCat = {};
      for (const a of apps) {
        const c = (byCat[a.category] = byCat[a.category] || { category: a.category, count: 0, sum: 0 });
        c.count++;
        c.sum += a.score || 0;
      }
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        last7.push({ date: d, ...(days[d] || { created: 0, evolved: 0, rejected: 0 }) });
      }
      const sum = (k) => Object.values(days).reduce((s, d) => s + (d[k] || 0), 0);
      return {
        apps: apps.length,
        versions: apps.reduce((s, a) => s + (a.versions || []).length, 0),
        avgScore: scored.length ? Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length) : 0,
        created: sum('created'),
        evolved: sum('evolved'),
        rejected: sum('rejected'),
        byCategory: Object.values(byCat).map((c) => ({ category: c.category, count: c.count, avgScore: Math.round(c.sum / c.count) })),
        last7Days: last7
      };
    }, { description: 'Statistik' });
  }
};

module.exports = [library, lessons, ai, trends, offlineGen, forge, autopilot, exporter, stats];
