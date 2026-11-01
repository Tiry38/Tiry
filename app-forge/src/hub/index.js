'use strict';
/**
 * createHub – baut das komplette Nervensystem zusammen:
 *   bus (Ereignisse) · registry (Fähigkeiten) · actions (Befehle) · hooks (Eingriffe)
 *   jobs (Arbeitswarteschlange) · settings (Konfiguration) · plugins (Anschlüsse)
 */
const path = require('path');
const fs = require('fs');
const { EventBus } = require('./bus');
const { Registry } = require('./registry');
const { Actions } = require('./actions');
const { Hooks } = require('./hooks');
const { JobQueue } = require('./jobs');
const { Settings } = require('./settings');
const { PluginManager } = require('./plugins');

function createHub({ dataDir, env = {}, encryptor = null } = {}) {
  if (!dataDir) throw new Error('dataDir fehlt');
  const paths = {
    data: dataDir,
    apps: path.join(dataDir, 'apps'),
    exports: path.join(dataDir, 'exports'),
    backups: path.join(dataDir, 'backups'),
    logs: path.join(dataDir, 'logs')
  };
  for (const p of Object.values(paths)) fs.mkdirSync(p, { recursive: true });

  const bus = new EventBus();
  const hub = {
    bus,
    registry: new Registry(),
    actions: new Actions(bus),
    hooks: new Hooks(bus),
    jobs: new JobQueue(bus),
    settings: new Settings(path.join(dataDir, 'settings.json'), { encryptor }),
    paths,
    env,
    plugins: null
  };
  hub.plugins = new PluginManager(hub);
  registerCoreActions(hub);
  return hub;
}

function registerCoreActions(hub) {
  const { actions } = hub;
  const opt = (description, extra = {}) => ({ by: 'core', description, ...extra });
  actions.register('hub.describe', () => ({
    plugins: hub.plugins.list(),
    capabilities: hub.registry.describe(),
    actions: hub.actions.list(),
    hooks: hub.hooks.describe()
  }), opt('Komplette Übersicht aller Anschlüsse, Fähigkeiten, Befehle und Hooks'));
  actions.register('settings.get', () => hub.settings.publicView(), opt('Einstellungen lesen'));
  actions.register('settings.set', ({ key, value }) => {
    if (!key || key.startsWith('plugins.')) throw new Error('Ungültiger Schlüssel');
    hub.settings.set(key, value);
    hub.bus.emit('settings.changed', { key, value }, { source: 'core' });
    return hub.settings.publicView();
  }, opt('Einstellung setzen', { expose: false }));
  actions.register('events.recent', ({ n = 200 } = {}) => hub.bus.recent(n), opt('Letzte Ereignisse'));
  actions.register('jobs.list', () => hub.jobs.list(), opt('Arbeitswarteschlange'));
  actions.register('jobs.cancel', ({ id }) => hub.jobs.cancel(id), opt('Job abbrechen'));
  actions.register('plugins.list', () => hub.plugins.list(), opt('Alle Anschlüsse'));
  actions.register('plugins.toggle', ({ id, enabled }) => hub.plugins.setEnabled(id, enabled), opt('Anschluss an/aus', { expose: false }));
  actions.register('plugins.configure', ({ id, values }) => hub.plugins.configure(id, values || {}), opt('Anschluss konfigurieren', { expose: false }));
  actions.register('plugins.health', ({ id }) => hub.plugins.health(id), opt('Zustand eines Anschlusses'));
}

module.exports = { createHub };
