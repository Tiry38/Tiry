'use strict';
/**
 * Lernspeicher – aus jedem gefundenen und behobenen Fehler wird eine allgemeine
 * Regel destilliert. Diese Regeln fließen in alle künftigen Bau-Prompts ein:
 * der Generator verbessert sich dadurch selbst.
 */
const fs = require('fs');

function words(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
}

function similarity(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

class Lessons {
  constructor(file, { max = 40 } = {}) {
    this.file = file;
    this.max = max;
    this.items = this._read();
  }

  _read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  _write() {
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2));
  }

  /** Fügt Regeln hinzu; ähnliche Regeln werden zusammengeführt (Treffer +1). */
  add(rules, { source = 'fix' } = {}) {
    const added = [];
    for (const raw of rules || []) {
      const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 280);
      if (text.length < 12) continue;
      const twin = this.items.find((l) => similarity(l.text, text) >= 0.55);
      if (twin) {
        twin.hits += 1;
        twin.lastSeen = Date.now();
        continue;
      }
      const item = { text, hits: 1, source, createdAt: Date.now(), lastSeen: Date.now() };
      this.items.push(item);
      added.push(item);
    }
    this.items.sort((a, b) => b.hits - a.hits || b.lastSeen - a.lastSeen);
    this.items = this.items.slice(0, this.max);
    this._write();
    return added;
  }

  top(n = 15) {
    return this.items.slice(0, n).map((l) => l.text);
  }

  list() {
    return this.items.slice();
  }

  remove(text) {
    this.items = this.items.filter((l) => l.text !== text);
    this._write();
  }

  clear() {
    this.items = [];
    this._write();
  }
}

module.exports = { Lessons, similarity };
