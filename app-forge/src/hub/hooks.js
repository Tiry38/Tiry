'use strict';
/**
 * Hooks – Eingriffspunkte in die Pipeline. Anschlüsse können Werte verändern
 * (waterfall) oder Entscheidungen blockieren (veto).
 *
 * Bekannte Hooks:
 *  concept.check   (concept)            -> concept | throw zum Verwerfen
 *  html.post       (html, {appId})      -> html (z. B. Branding, Analytics-frei-Check)
 *  test.extra      (report, {html})     -> report (zusätzliche Prüfungen)
 *  version.accept  (decision, info)     -> {accept, reason}
 *  export.files    (files, {app})       -> files (zusätzliche Export-Dateien)
 */
class Hooks {
  constructor(bus) {
    this.bus = bus;
    this.taps = new Map();
  }

  tap(name, fn, { by = 'core', priority = 0 } = {}) {
    if (!this.taps.has(name)) this.taps.set(name, []);
    const list = this.taps.get(name);
    const entry = { fn, by, priority };
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);
    return () => {
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
    };
  }

  removeBy(by) {
    for (const list of this.taps.values()) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].by === by) list.splice(i, 1);
    }
  }

  async waterfall(name, value, ctx = {}) {
    let v = value;
    for (const t of this.taps.get(name) || []) {
      try {
        const r = await t.fn(v, ctx);
        if (r !== undefined) v = r;
      } catch (err) {
        if (err && err.veto) throw err;
        this.bus.emit('hub.error', { message: String(err.message || err), hook: name, by: t.by }, { source: 'hooks' });
      }
    }
    return v;
  }

  describe() {
    return [...this.taps.entries()].map(([name, list]) => ({ name, taps: list.map((t) => t.by) }));
  }
}

function veto(reason) {
  const e = new Error(reason);
  e.veto = true;
  return e;
}

module.exports = { Hooks, veto };
