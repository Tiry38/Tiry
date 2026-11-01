'use strict';
/**
 * Autopilot – arbeitet dauerhaft: erschafft neue Apps, prüft bestehende (Fehler finden)
 * und entwickelt sie weiter. Läuft im Desktop (solange das Programm offen ist,
 * auch minimiert im Tray) und im Cloud-Modus über GitHub Actions (PC kann aus sein).
 */
class Autopilot {
  constructor({ settings, jobs, invoke, library, emit, aiAvailable }) {
    Object.assign(this, { settings, jobs, invoke, library, emit, aiAvailable });
    this.timer = null;
    this.cycle = 0;
    this.nextRunAt = null;
    this.lastRunAt = null;
    this.lastAction = null;
    this.running = false;
  }

  cfg() {
    return this.settings.get('autopilot', {});
  }

  status() {
    const c = this.cfg();
    return { enabled: !!c.enabled, intervalMin: c.intervalMin, autoCreate: c.autoCreate, maxApps: c.maxApps, createEvery: c.createEvery, healthCheck: c.healthCheck, nextRunAt: this.nextRunAt, lastRunAt: this.lastRunAt, lastAction: this.lastAction, running: this.running };
  }

  set(patch = {}) {
    const allowed = ['enabled', 'intervalMin', 'autoCreate', 'maxApps', 'createEvery', 'healthCheck'];
    for (const k of allowed) {
      if (!(k in patch)) continue;
      let v = patch[k];
      if (k === 'intervalMin') v = Math.max(5, Math.min(24 * 60, Number(v) || 20));
      if (k === 'maxApps') v = Math.max(1, Math.min(500, Number(v) || 40));
      if (k === 'createEvery') v = Math.max(1, Math.min(20, Number(v) || 3));
      this.settings.set(`autopilot.${k}`, typeof v === 'string' && (v === 'true' || v === 'false') ? v === 'true' : v);
    }
    this.reschedule();
    this.emit('autopilot.state', this.status());
    return this.status();
  }

  start() {
    this.reschedule();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextRunAt = null;
  }

  reschedule(delayMs) {
    this.stop();
    const c = this.cfg();
    if (!c.enabled) return;
    const ms = delayMs !== undefined ? delayMs : Math.max(5, c.intervalMin || 20) * 60000;
    this.nextRunAt = Date.now() + ms;
    this.timer = setTimeout(() => this.tick().catch(() => {}), ms);
    if (this.timer.unref) this.timer.unref();
  }

  /** Entscheidet, was als Nächstes am meisten bringt. */
  decide() {
    const c = this.cfg();
    const apps = this.library.list();
    const ai = this.aiAvailable();
    if (c.autoCreate && apps.length < Math.min(3, c.maxApps)) return { action: 'create' };
    const broken = apps.filter((a) => a.lastTest && !a.lastTest.ok);
    if (broken.length) return { action: ai ? 'evolve' : 'test', id: broken[0].id, why: 'Fehler gefunden' };
    if (c.autoCreate && apps.length < c.maxApps && this.cycle % Math.max(1, c.createEvery) === 0) return { action: 'create' };
    if (!apps.length) return { action: 'idle' };
    const stale = c.healthCheck ? apps.filter((a) => !a.lastCheckedAt || Date.now() - a.lastCheckedAt > 24 * 3600e3) : [];
    if (!ai) return stale.length ? { action: 'test', id: stale[0].id, why: 'Täglicher Gesundheitscheck' } : (c.autoCreate && apps.length < c.maxApps ? { action: 'create' } : { action: 'idle' });
    const ranked = apps.slice().sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || (a.lastEvolvedAt || 0) - (b.lastEvolvedAt || 0));
    return { action: 'evolve', id: ranked[0].id, why: 'Niedrigster Score zuerst' };
  }

  async tick() {
    if (this.running) return null;
    if (this.jobs.isBusy()) {
      this.reschedule(60000);
      return null;
    }
    this.running = true;
    this.cycle += 1;
    this.lastRunAt = Date.now();
    let decision = { action: 'idle' };
    try {
      decision = this.decide();
      this.lastAction = decision;
      this.emit('autopilot.tick', { cycle: this.cycle, ...decision });
      if (decision.action === 'create') await this.invoke('forge.create', { count: 1, source: 'autopilot' });
      else if (decision.action === 'evolve') await this.invoke('forge.evolve', { id: decision.id, source: 'autopilot' });
      else if (decision.action === 'test') await this.invoke('forge.test', { id: decision.id, source: 'autopilot' });
    } catch (err) {
      this.emit('log', { level: 'warn', message: `Autopilot: ${err.message}` });
    } finally {
      this.running = false;
      this.reschedule();
      this.emit('autopilot.state', this.status());
    }
    return decision;
  }
}

module.exports = { Autopilot };
