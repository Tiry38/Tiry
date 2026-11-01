'use strict';
/**
 * Library – App-Bibliothek auf der Festplatte, mit Versionen und Rollback.
 *
 * apps/<appId>/meta.json
 * apps/<appId>/v<n>/        (index.html, manifest.webmanifest, sw.js, icon.svg, icon-*.png, screenshot.png)
 * apps/<appId>/_stage-<id>/ (Kandidat, wird erst nach bestandenem Test zur Version)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ID_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;

function slugify(s) {
  return String(s || 'app')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'app';
}

class Library {
  constructor(root, { keepVersions = 20 } = {}) {
    this.root = root;
    this.keepVersions = keepVersions;
    fs.mkdirSync(root, { recursive: true });
  }

  _dir(id) {
    if (!ID_RE.test(id)) throw new Error(`Ungültige App-ID: ${id}`);
    return path.join(this.root, id);
  }

  _metaFile(id) {
    return path.join(this._dir(id), 'meta.json');
  }

  newId(name) {
    const rand = crypto.randomBytes(3).toString('hex');
    return `${slugify(name)}-${rand}`;
  }

  exists(id) {
    try {
      return fs.existsSync(this._metaFile(id));
    } catch {
      return false;
    }
  }

  readMeta(id) {
    return JSON.parse(fs.readFileSync(this._metaFile(id), 'utf8'));
  }

  writeMeta(meta) {
    meta.updatedAt = Date.now();
    const file = this._metaFile(meta.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(meta, null, 2));
    fs.renameSync(`${file}.tmp`, file);
    return meta;
  }

  list() {
    const out = [];
    for (const id of fs.readdirSync(this.root)) {
      if (!ID_RE.test(id)) continue;
      try {
        out.push(this.readMeta(id));
      } catch {
        /* defekte Einträge überspringen */
      }
    }
    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  versionDir(id, n) {
    return path.join(this._dir(id), `v${n}`);
  }

  currentDir(id) {
    const meta = this.readMeta(id);
    return this.versionDir(id, meta.currentVersion);
  }

  readCurrentHtml(id) {
    return fs.readFileSync(path.join(this.currentDir(id), 'index.html'), 'utf8');
  }

  /** Legt einen Arbeitsordner für einen Kandidaten an. */
  stage(id) {
    const dir = path.join(this._dir(id), `_stage-${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  writeFiles(dir, files) {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      if (name.includes('..') || path.isAbsolute(name)) throw new Error(`Unsicherer Dateiname: ${name}`);
      fs.writeFileSync(path.join(dir, name), content);
    }
  }

  discard(dir) {
    if (dir && path.basename(dir).startsWith('_stage-')) fs.rmSync(dir, { recursive: true, force: true });
  }

  /** Erstellt eine neue App mit ihrer ersten Version aus einem Stage-Ordner. */
  createApp(meta, stageDir, versionInfo) {
    const now = Date.now();
    const full = {
      ...meta,
      createdAt: now,
      updatedAt: now,
      currentVersion: 0,
      versions: [],
      rejected: [],
      evolveCount: 0,
      lastEvolvedAt: null,
      lastCheckedAt: null
    };
    fs.mkdirSync(this._dir(full.id), { recursive: true });
    this.writeMeta(full);
    return this.commit(full.id, stageDir, { kind: 'create', title: 'Erste Version', ...versionInfo });
  }

  /** Übernimmt einen getesteten Kandidaten als neue Version. */
  commit(id, stageDir, info) {
    const meta = this.readMeta(id);
    const n = (meta.versions.reduce((m, v) => Math.max(m, v.n), 0) || 0) + 1;
    const dest = this.versionDir(id, n);
    fs.renameSync(stageDir, dest);
    const entry = {
      n,
      createdAt: Date.now(),
      kind: info.kind || 'update',
      title: info.title || `Version ${n}`,
      description: info.description || '',
      score: info.score ?? null,
      tech: info.tech ?? null,
      review: info.review ?? null,
      source: info.source || meta.source || 'unknown'
    };
    meta.versions.push(entry);
    meta.currentVersion = n;
    if (info.kind === 'evolve' || info.kind === 'fix') {
      meta.evolveCount = (meta.evolveCount || 0) + 1;
      meta.lastEvolvedAt = Date.now();
    }
    meta.score = entry.score;
    this.writeMeta(meta);
    this._prune(meta);
    return { meta: this.readMeta(id), version: entry, dir: dest };
  }

  reject(id, info) {
    const meta = this.readMeta(id);
    meta.rejected = [{ at: Date.now(), ...info }, ...(meta.rejected || [])].slice(0, 25);
    meta.lastEvolvedAt = Date.now();
    this.writeMeta(meta);
    return meta;
  }

  rollback(id, n) {
    const meta = this.readMeta(id);
    const v = meta.versions.find((x) => x.n === Number(n));
    if (!v || !fs.existsSync(this.versionDir(id, v.n))) throw new Error(`Version ${n} nicht vorhanden`);
    meta.currentVersion = v.n;
    meta.score = v.score;
    this.writeMeta(meta);
    return meta;
  }

  update(id, patch) {
    const meta = this.readMeta(id);
    return this.writeMeta({ ...meta, ...patch, id: meta.id });
  }

  remove(id) {
    fs.rmSync(this._dir(id), { recursive: true, force: true });
  }

  _prune(meta) {
    const keep = this.keepVersions;
    const old = meta.versions.filter((v) => v.n !== meta.currentVersion).sort((a, b) => b.n - a.n).slice(keep - 1);
    for (const v of old) fs.rmSync(this.versionDir(meta.id, v.n), { recursive: true, force: true });
    if (old.length) {
      const drop = new Set(old.map((v) => v.n));
      meta.versions = meta.versions.filter((v) => !drop.has(v.n));
      this.writeMeta(meta);
    }
    // verwaiste Stage-Ordner (z. B. nach Absturz) aufräumen
    for (const d of fs.readdirSync(this._dir(meta.id))) {
      if (!d.startsWith('_stage-')) continue;
      const full = path.join(this._dir(meta.id), d);
      try {
        if (Date.now() - fs.statSync(full).mtimeMs > 6 * 3600 * 1000) fs.rmSync(full, { recursive: true, force: true });
      } catch {
        /* egal */
      }
    }
  }
}

module.exports = { Library, slugify };
