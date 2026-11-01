'use strict';
/**
 * PluginManager – verwaltet alle Anschlüsse ("Kabel") am Hub.
 *
 * Ein Anschluss ist ein Objekt:
 * {
 *   id: 'ai.anthropic', name, kind, description, version,
 *   status: 'stable' | 'beta' | 'planned',
 *   provides: ['ai'], requires: ['library'], env: 'electron' (optional),
 *   defaultEnabled: true,
 *   settings: [{ key, label, type: 'text'|'password'|'number'|'boolean'|'select', default, options, secret, help }],
 *   start(ctx), stop(ctx), health(ctx) -> { ok, message }
 * }
 * Alles, was ein Anschluss über ctx registriert (Events, Fähigkeiten, Befehle,
 * Hooks), wird beim Stoppen automatisch wieder abgeklemmt.
 */
const KINDS = ['core', 'ai', 'generator', 'quality', 'evolution', 'storage', 'export', 'publish', 'integration', 'api', 'system', 'store'];

class PluginManager {
  constructor(hub) {
    this.hub = hub;
    this.plugins = new Map();
  }

  register(plugin) {
    if (!plugin || !plugin.id || !plugin.name) throw new Error('Anschluss braucht id und name');
    if (this.plugins.has(plugin.id)) throw new Error(`Anschluss doppelt: ${plugin.id}`);
    const entry = { plugin, status: plugin.status === 'planned' ? 'planned' : 'stopped', error: null, ctx: null, offs: [], startedAt: null };
    this.plugins.set(plugin.id, entry);
    return entry;
  }

  isEnabled(id) {
    const entry = this.plugins.get(id);
    if (!entry || entry.plugin.status === 'planned') return false;
    const v = this.hub.settings.get(`plugins.${id}.enabled`);
    return v === undefined ? entry.plugin.defaultEnabled !== false : !!v;
  }

  _envOk(plugin) {
    if (plugin.env && !this.hub.env[plugin.env]) return false;
    if (typeof plugin.available === 'function') {
      try {
        return !!plugin.available(this.hub.env);
      } catch {
        return false;
      }
    }
    return true;
  }

  _makeCtx(entry) {
    const { hub } = this;
    const id = entry.plugin.id;
    const track = (off) => {
      entry.offs.push(off);
      return off;
    };
    const schema = entry.plugin.settings || [];
    const config = {
      get: (key) => {
        const def = schema.find((s) => s.key === key);
        if (def && def.secret) return hub.settings.getSecret(`plugins.${id}.config.${key}`);
        const v = hub.settings.get(`plugins.${id}.config.${key}`);
        return v === undefined ? (def ? def.default : undefined) : v;
      },
      set: (key, value) => {
        const def = schema.find((s) => s.key === key);
        if (def && def.secret) return hub.settings.setSecret(`plugins.${id}.config.${key}`, value);
        return hub.settings.set(`plugins.${id}.config.${key}`, value);
      },
      all: () => Object.fromEntries(schema.map((s) => [s.key, config.get(s.key)]))
    };
    return {
      id,
      hub,
      env: hub.env,
      paths: hub.paths,
      settings: hub.settings,
      jobs: hub.jobs,
      config,
      bus: {
        emit: (type, payload) => hub.bus.emit(type, payload, { source: id }),
        on: (pattern, fn) => track(hub.bus.on(pattern, fn, { by: id })),
        waitFor: (pattern, opts) => hub.bus.waitFor(pattern, opts)
      },
      provide: (cap, impl, opts = {}) => track(hub.registry.provide(cap, impl, { ...opts, by: id })),
      get: (cap) => hub.registry.get(cap),
      require: (cap) => hub.registry.require(cap),
      all: (cap) => hub.registry.all(cap),
      action: (name, fn, opts = {}) => track(hub.actions.register(name, fn, { ...opts, by: id })),
      invoke: (name, args) => hub.actions.invoke(name, args, { caller: id }),
      hook: (name, fn, opts = {}) => track(hub.hooks.tap(name, fn, { ...opts, by: id })),
      waterfall: (name, value, c) => hub.hooks.waterfall(name, value, c),
      onStop: (fn) => track(fn),
      log: (level, message, data) => hub.bus.emit('log', { level, message, data }, { source: id })
    };
  }

  async start(id) {
    const entry = this.plugins.get(id);
    if (!entry) throw new Error(`Unbekannter Anschluss: ${id}`);
    if (entry.status === 'running' || entry.status === 'planned') return entry.status;
    if (!this._envOk(entry.plugin)) {
      entry.status = 'unavailable';
      return entry.status;
    }
    entry.ctx = this._makeCtx(entry);
    try {
      if (typeof entry.plugin.start === 'function') await entry.plugin.start(entry.ctx);
      entry.status = 'running';
      entry.error = null;
      entry.startedAt = Date.now();
    } catch (err) {
      this._cleanup(entry);
      entry.status = 'error';
      entry.error = String(err && err.message ? err.message : err);
    }
    this.hub.bus.emit('plugin.state', this.view(entry), { source: 'plugins' });
    return entry.status;
  }

  _cleanup(entry) {
    for (const off of entry.offs.splice(0).reverse()) {
      try {
        off();
      } catch {
        /* ignorieren */
      }
    }
    const id = entry.plugin.id;
    this.hub.registry.removeBy(id);
    this.hub.actions.removeBy(id);
    this.hub.hooks.removeBy(id);
  }

  async stop(id) {
    const entry = this.plugins.get(id);
    if (!entry || entry.status !== 'running') return;
    try {
      if (typeof entry.plugin.stop === 'function') await entry.plugin.stop(entry.ctx);
    } catch (err) {
      entry.error = String(err.message || err);
    }
    this._cleanup(entry);
    entry.status = 'stopped';
    this.hub.bus.emit('plugin.state', this.view(entry), { source: 'plugins' });
  }

  async startAll() {
    for (const entry of this._ordered()) if (this.isEnabled(entry.plugin.id)) await this.start(entry.plugin.id);
  }

  async stopAll() {
    for (const entry of this._ordered().reverse()) await this.stop(entry.plugin.id);
  }

  /** Reihenfolge: Anschlüsse, die etwas anbieten, starten vor denen, die es brauchen. */
  _ordered() {
    const entries = [...this.plugins.values()];
    const providers = new Map();
    for (const e of entries) for (const cap of e.plugin.provides || []) providers.set(cap, [...(providers.get(cap) || []), e]);
    const out = [];
    const seen = new Set();
    const visit = (e, stack = new Set()) => {
      if (seen.has(e) || stack.has(e)) return;
      stack.add(e);
      for (const cap of e.plugin.requires || []) for (const p of providers.get(cap) || []) visit(p, stack);
      seen.add(e);
      out.push(e);
    };
    entries.forEach((e) => visit(e));
    return out;
  }

  async setEnabled(id, enabled) {
    const entry = this.plugins.get(id);
    if (!entry) throw new Error(`Unbekannter Anschluss: ${id}`);
    if (entry.plugin.status === 'planned') throw new Error('Dieser Anschluss ist geplant und noch nicht gebaut.');
    this.hub.settings.set(`plugins.${id}.enabled`, !!enabled);
    if (enabled) await this.start(id);
    else await this.stop(id);
    return this.view(entry);
  }

  async configure(id, values) {
    const entry = this.plugins.get(id);
    if (!entry) throw new Error(`Unbekannter Anschluss: ${id}`);
    const ctx = entry.ctx || this._makeCtx(entry);
    for (const s of entry.plugin.settings || []) {
      if (!(s.key in values)) continue;
      let v = values[s.key];
      if (s.secret && (v === '••••••' || v === undefined)) continue; // unverändert
      if (s.type === 'number') v = Number(v);
      if (s.type === 'boolean') v = !!v;
      ctx.config.set(s.key, v);
    }
    if (entry.status === 'running') {
      await this.stop(id);
      await this.start(id);
    }
    return this.view(entry);
  }

  async health(id) {
    const entry = this.plugins.get(id);
    if (!entry) throw new Error(`Unbekannter Anschluss: ${id}`);
    if (entry.status !== 'running') return { ok: false, message: entry.status === 'planned' ? 'Geplant' : `Status: ${entry.status}` };
    if (typeof entry.plugin.health !== 'function') return { ok: true, message: 'Läuft' };
    try {
      return await entry.plugin.health(entry.ctx);
    } catch (err) {
      return { ok: false, message: String(err.message || err) };
    }
  }

  view(entry) {
    const p = entry.plugin;
    const ctx = entry.ctx || this._makeCtx(entry);
    return {
      id: p.id,
      name: p.name,
      kind: KINDS.includes(p.kind) ? p.kind : 'integration',
      description: p.description || '',
      version: p.version || '1.0.0',
      maturity: p.status || 'stable',
      status: entry.status,
      enabled: this.isEnabled(p.id),
      error: entry.error,
      provides: p.provides || [],
      requires: p.requires || [],
      env: p.env || null,
      settings: (p.settings || []).map((s) => ({ ...s, value: s.secret ? (ctx.config.get(s.key) ? '••••••' : '') : ctx.config.get(s.key) }))
    };
  }

  list() {
    return [...this.plugins.values()].map((e) => this.view(e));
  }
}

module.exports = { PluginManager, KINDS };
