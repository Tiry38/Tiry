'use strict';
/**
 * Registry – Fähigkeiten-Verzeichnis. Mehrere Anschlüsse können dieselbe Fähigkeit
 * anbieten (z. B. 'generator' von KI und Offline-Vorlagen). get() liefert den besten
 * verfügbaren Anbieter (höchste Priorität, isAvailable() === true).
 */
class Registry {
  constructor() {
    this.providers = new Map();
  }

  provide(capability, impl, { by = 'core', priority = 0 } = {}) {
    if (!this.providers.has(capability)) this.providers.set(capability, []);
    const list = this.providers.get(capability);
    const entry = { impl, by, priority };
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);
    return () => {
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
    };
  }

  static available(entry) {
    try {
      return typeof entry.impl.isAvailable === 'function' ? !!entry.impl.isAvailable() : true;
    } catch {
      return false;
    }
  }

  get(capability) {
    const list = this.providers.get(capability) || [];
    const hit = list.find((e) => Registry.available(e));
    return hit ? hit.impl : null;
  }

  require(capability) {
    const impl = this.get(capability);
    if (!impl) throw new Error(`Kein Anschluss für Fähigkeit "${capability}" aktiv.`);
    return impl;
  }

  all(capability) {
    return (this.providers.get(capability) || []).filter((e) => Registry.available(e)).map((e) => e.impl);
  }

  has(capability) {
    return !!this.get(capability);
  }

  removeBy(by) {
    for (const list of this.providers.values()) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].by === by) list.splice(i, 1);
    }
  }

  describe() {
    return [...this.providers.entries()].map(([capability, list]) => ({
      capability,
      providers: list.map((e) => ({ by: e.by, priority: e.priority, available: Registry.available(e) }))
    }));
  }
}

module.exports = { Registry };
