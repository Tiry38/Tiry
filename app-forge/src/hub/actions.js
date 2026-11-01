'use strict';
/**
 * Actions – die Befehls-Schicht. Oberfläche, lokale REST-API und Autopilot rufen
 * alle dieselben Befehle auf. Anschlüsse können eigene Befehle registrieren.
 */
class Actions {
  constructor(bus) {
    this.bus = bus;
    this.map = new Map();
  }

  register(name, fn, { by = 'core', description = '', expose = true } = {}) {
    this.map.set(name, { fn, by, description, expose });
    return () => this.map.delete(name);
  }

  removeBy(by) {
    for (const [k, v] of this.map) if (v.by === by) this.map.delete(k);
  }

  async invoke(name, args = {}, { caller = 'ui' } = {}) {
    const a = this.map.get(name);
    if (!a) throw new Error(`Unbekannter Befehl: ${name}`);
    if (caller === 'api' && !a.expose) throw new Error(`Befehl ${name} ist für die API gesperrt.`);
    return a.fn(args || {}, { caller });
  }

  list() {
    return [...this.map.entries()].map(([name, a]) => ({ name, by: a.by, description: a.description, expose: a.expose }));
  }
}

module.exports = { Actions };
