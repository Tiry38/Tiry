'use strict';
/**
 * EventBus – das Nervensystem. Jeder Anschluss (Connector) sendet und empfängt
 * hierüber Ereignisse. Muster: 'app.created' (exakt), 'app.*' (Präfix), '*' (alles).
 */
class EventBus {
  constructor({ historySize = 600 } = {}) {
    this.handlers = new Set();
    this.history = [];
    this.historySize = historySize;
    this.seq = 0;
  }

  static matches(pattern, type) {
    if (pattern === '*' || pattern === type) return true;
    if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
    return false;
  }

  on(pattern, fn, { by = 'anon' } = {}) {
    const h = { pattern, fn, by };
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  once(pattern, fn, opts) {
    const off = this.on(pattern, (e) => {
      off();
      fn(e);
    }, opts);
    return off;
  }

  /** Wartet auf ein Ereignis (optional mit Filter und Timeout). */
  waitFor(pattern, { filter = () => true, timeoutMs = 0 } = {}) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const off = this.on(pattern, (e) => {
        if (!filter(e)) return;
        off();
        if (timer) clearTimeout(timer);
        resolve(e);
      });
      if (timeoutMs > 0) timer = setTimeout(() => { off(); reject(new Error(`Timeout: ${pattern}`)); }, timeoutMs);
    });
  }

  emit(type, payload = {}, { source = 'core' } = {}) {
    const event = { id: ++this.seq, type, ts: Date.now(), source, payload };
    this.history.push(event);
    if (this.history.length > this.historySize) this.history.splice(0, this.history.length - this.historySize);
    for (const h of [...this.handlers]) {
      if (!EventBus.matches(h.pattern, type)) continue;
      try {
        const r = h.fn(event);
        if (r && typeof r.catch === 'function') r.catch((err) => this._handlerError(h, event, err));
      } catch (err) {
        this._handlerError(h, event, err);
      }
    }
    return event;
  }

  _handlerError(h, event, err) {
    if (event.type === 'hub.error') return; // keine Endlosschleife
    this.emit('hub.error', { message: String(err && err.message ? err.message : err), handler: h.by, event: event.type }, { source: 'bus' });
  }

  recent(n = 100, filter) {
    const list = filter ? this.history.filter(filter) : this.history;
    return list.slice(-n);
  }
}

module.exports = { EventBus };
