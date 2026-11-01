'use strict';
/**
 * Cloud-Lauf – derselbe Hub wie in der Windows-App, nur ohne Fenster.
 * Läuft in GitHub Actions (PC kann aus sein) oder lokal mit Node.
 *
 * Umgebungsvariablen:
 *   FORGE_MODE              autopilot | create | evolve | trends | commands | publish   (Standard: autopilot)
 *                           publish = nur Fernbefehle, Galerie bauen und synchronisieren (Gratis-Modus)
 *   FORGE_COUNT             Anzahl Schritte/Apps (Standard: 2)
 *   FORGE_DATA_DIR          Datenordner (Standard: ./forge-data)
 *   FORGE_SITE_DIR          Ausgabe der Galerie-Website für Firebase Hosting (optional)
 *   ANTHROPIC_API_KEY       Claude-Key (ohne Key: Offline-Vorlagen)
 *   FORGE_MODEL             Modell (Standard: claude-opus-5-5)
 *   FORGE_DAILY_USD         Tagesbudget in US-$ (Standard: 5)
 *   FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID, FIREBASE_WEB_CONFIG   (optional)
 */
const fs = require('fs');
const path = require('path');
const { createHub } = require('../src/hub');
const { registerAll } = require('../src/connectors');
const { buildSite } = require('./build-site');

const MODE = process.env.FORGE_MODE || 'autopilot';
const COUNT = Math.max(1, Math.min(10, Number(process.env.FORGE_COUNT) || 2));
const DATA = path.resolve(process.env.FORGE_DATA_DIR || 'forge-data');

function log(...a) {
  console.log(`[forge ${new Date().toISOString().slice(11, 19)}]`, ...a);
}

async function waitJobs(hub, res) {
  const ids = (res && (res.jobIds || (res.jobId ? [res.jobId] : []))) || [];
  const out = [];
  for (const id of ids) {
    const job = hub.jobs.jobs.find((j) => j.id === id);
    if (job) out.push(await job.done);
  }
  return out;
}

(async () => {
  const hub = createHub({ dataDir: DATA, env: { cloud: true } });
  // Cloud-Einstellungen
  hub.settings.set('budget.dailyUsd', Number(process.env.FORGE_DAILY_USD) || hub.settings.get('budget.dailyUsd', 5));
  if (process.env.FORGE_MODEL) hub.settings.set('plugins.ai.anthropic.config.model', process.env.FORGE_MODEL);
  // API-Modus nur, wenn ein Key als Secret hinterlegt ist – sonst Gratis-Modus (keine Kosten).
  hub.settings.set('plugins.ai.anthropic.config.mode', process.env.ANTHROPIC_API_KEY ? 'api' : 'free');
  hub.settings.set('plugins.publish.lan.enabled', false);
  hub.settings.set('plugins.api.local.enabled', false);
  hub.settings.set('plugins.radar.trends.config.refreshHours', 24 * 7);
  hub.settings.set('autopilot.enabled', false); // Cloud steuert die Schritte selbst
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    hub.settings.set('plugins.cloud.firebase.enabled', true);
    hub.settings.set('plugins.cloud.firebase.config.target', 'cloud');
    if (process.env.FIREBASE_PROJECT_ID) hub.settings.set('plugins.cloud.firebase.config.projectId', process.env.FIREBASE_PROJECT_ID);
  }
  registerAll(hub);

  const summary = [];
  hub.bus.on('pipeline.stage', (e) => log('·', e.payload.message));
  hub.bus.on('log', (e) => log(e.payload.level, e.payload.message));
  hub.bus.on('app.created', (e) => { log('✓ Neue App:', e.payload.app.name); summary.push(`✨ Neue App **${e.payload.app.name}** – ${e.payload.app.tagline || ''} (Score ${e.payload.app.score ?? '–'})`); });
  hub.bus.on('app.version.created', (e) => { log('✓ Verbessert:', e.payload.name, e.payload.version.title); summary.push(`🚀 **${e.payload.name}** v${e.payload.version.n}: ${e.payload.version.title} (Score ${e.payload.version.score})`); });
  hub.bus.on('app.version.rejected', (e) => { log('✗ Verworfen:', e.payload.reason); summary.push(`↩️ Verworfen${e.payload.title ? ` „${e.payload.title}“` : ''}: ${e.payload.reason}`); });
  hub.bus.on('job.failed', (e) => { log('✗ Job fehlgeschlagen:', e.payload.error); summary.push(`⚠️ ${e.payload.title}: ${e.payload.error}`); });
  hub.bus.on('hub.error', (e) => log('hub.error', e.payload.message));

  await hub.plugins.startAll();
  const failedPlugins = hub.plugins.list().filter((p) => p.status === 'error');
  for (const p of failedPlugins) log(`Anschluss ${p.id}: ${p.error}`);
  const status = await hub.actions.invoke('forge.status');
  log(`Modus: ${status.mode}${status.model ? ` (${status.model})` : ''} · Aufgabe: ${MODE} × ${COUNT}`);

  // 1) Befehle aus der Fernsteuerung (Firebase) abarbeiten
  const cloud = hub.registry.get('cloud');
  if (cloud) {
    try {
      await cloud.processCommands();
      await waitAll(hub);
    } catch (err) {
      log('Firebase-Befehle:', err.message);
    }
  }

  // 2) Eigentliche Aufgabe
  const pilot = hub.registry.get('autopilot');
  if (MODE === 'trends') {
    await waitJobs(hub, await hub.actions.invoke('trends.refresh', { source: 'cloud' }));
  } else if (MODE === 'create') {
    await waitJobs(hub, await hub.actions.invoke('forge.create', { count: COUNT, source: 'cloud' }));
  } else if (MODE === 'evolve') {
    const apps = hub.registry.get('library').list().sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, COUNT);
    for (const a of apps) await waitJobs(hub, await hub.actions.invoke('forge.evolve', { id: a.id, source: 'cloud' }));
  } else if (MODE === 'autopilot') {
    const report = hub.registry.get('trends').get();
    if (!report || Date.now() - report.updatedAt > 7 * 864e5) await waitJobs(hub, await hub.actions.invoke('trends.refresh', { source: 'cloud' }));
    hub.settings.set('autopilot.autoCreate', true);
    for (let i = 0; i < COUNT; i++) {
      const decision = await pilot.tick();
      log('Autopilot-Entscheidung:', JSON.stringify(decision));
      if (!decision || decision.action === 'idle') break;
    }
  }
  await waitAll(hub);

  // 3) Galerie + Fernsteuerung für Firebase Hosting bauen
  if (process.env.FORGE_SITE_DIR) {
    const out = buildSite({ library: hub.registry.get('library'), outDir: path.resolve(process.env.FORGE_SITE_DIR), webConfig: process.env.FIREBASE_WEB_CONFIG || '' });
    log(`Website gebaut: ${out.apps} Apps → ${out.dir}`);
  }
  if (cloud) await cloud.syncAll().catch((err) => log('Sync:', err.message));

  const usage = hub.registry.get('ai') ? hub.registry.get('ai').usage() : null;
  const apps = hub.registry.get('library').list();
  const md = [`## 🤖 Tiry App Forge – Cloud-Lauf (${MODE})`, '', ...summary.map((s) => `- ${s}`), '', `**Apps gesamt:** ${apps.length} · **Ø Score:** ${apps.length ? Math.round(apps.reduce((s, a) => s + (a.score || 0), 0) / apps.length) : 0}`, usage ? `**KI-Kosten heute:** ${usage.today.costUsd} $ (${usage.today.calls} Aufrufe)` : ''].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(`\n${md}\n`);
  await hub.plugins.stopAll();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function waitAll(hub) {
  for (;;) {
    const open = hub.jobs.jobs.filter((j) => j.status === 'queued' || j.status === 'running');
    if (!open.length) return;
    await Promise.all(open.map((j) => j.done));
  }
}
