'use strict';
/**
 * Settings – zentrale Konfiguration (JSON-Datei). Geheimnisse (API-Keys, Tokens)
 * werden über einen Encryptor verschlüsselt gespeichert (unter Windows: DPAPI via
 * Electron safeStorage).
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  core: { language: 'de', maxFixRounds: 3, minScore: 65 },
  autopilot: { enabled: false, intervalMin: 20, autoCreate: true, maxApps: 40, createEvery: 3, healthCheck: true },
  budget: { dailyUsd: 5, dailyCalls: 60 },
  app: { autostart: false, minimizeToTray: true },
  plugins: {}
};

function deepMerge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] !== null ? deepMerge(base[k], v) : v;
  }
  return out;
}

class Settings {
  constructor(file, { encryptor = null } = {}) {
    this.file = file;
    this.encryptor = encryptor;
    this.data = deepMerge(DEFAULTS, this._read());
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  _write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(keyPath, fallback) {
    const parts = keyPath.split('.');
    let cur = this.data;
    for (const p of parts) {
      if (cur === null || typeof cur !== 'object' || !(p in cur)) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  }

  set(keyPath, value) {
    const parts = keyPath.split('.');
    let cur = this.data;
    for (const p of parts.slice(0, -1)) {
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
    this._write();
    return value;
  }

  /** Öffentliche Sicht ohne Plugin-Geheimnisse. */
  publicView() {
    const { plugins, ...rest } = this.data;
    return JSON.parse(JSON.stringify(rest));
  }

  setSecret(keyPath, plain) {
    if (!plain) return this.set(keyPath, '');
    if (this.encryptor && this.encryptor.available()) return this.set(keyPath, `enc:${this.encryptor.encrypt(plain)}`);
    return this.set(keyPath, `plain:${Buffer.from(plain, 'utf8').toString('base64')}`);
  }

  getSecret(keyPath) {
    const v = this.get(keyPath, '');
    if (!v) return '';
    try {
      if (v.startsWith('enc:')) return this.encryptor ? this.encryptor.decrypt(v.slice(4)) : '';
      if (v.startsWith('plain:')) return Buffer.from(v.slice(6), 'base64').toString('utf8');
    } catch {
      return '';
    }
    return v;
  }
}

module.exports = { Settings, DEFAULTS, deepMerge };
