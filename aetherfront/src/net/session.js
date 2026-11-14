// Sitzungen: verbinden Simulation und Befehlsquelle.
// LocalSession  – Einzelspieler/gegen Bots: Befehle werden im nächsten Tick ausgeführt.
// NetSession    – Online (Lockstep): Der Relay-Server stempelt jeden Befehl auf einen Tick und
//                 verteilt "Turns" an alle. Jeder Client rechnet dieselbe Simulation → nur Befehle
//                 wandern übers Netz, nie Spielzustände. Prüfsummen erkennen Abweichungen (Desync).
import { Sim, DT } from '../sim/sim.js';

export const PROTOCOL_VERSION = 2;
export const HASH_EVERY = 20; // Ticks

export class LocalSession {
  constructor(setup, localPid = 0) {
    this.sim = new Sim(setup);
    this.localPid = localPid;
    this.pending = [];
    this.acc = 0;
    this.speed = 1;
    this.paused = false;
    this.online = false;
  }
  submit(cmd) { this.pending.push({ pid: this.localPid, cmd }); }
  /** realDt in Sekunden → führt passende Anzahl Ticks aus. Gibt gesammelte Events zurück. */
  update(realDt) {
    const out = [];
    if (this.paused) return out;
    this.acc += Math.min(realDt, 0.25) * this.speed;
    let n = 0;
    while (this.acc >= DT && n < 12) {
      this.acc -= DT; n++;
      const ev = this.sim.step(this.pending.splice(0));
      for (const e of ev) out.push(e);
    }
    return out;
  }
  /** 0..1 – Anteil bis zum nächsten Tick (für flüssige Interpolation) */
  alpha() { return Math.min(1, this.acc / DT); }
  dispose() {}
}

export class NetSession {
  /** transport: { send(obj), onMessage(fn), close() } ; start = Startnachricht des Servers */
  constructor(transport, start) {
    this.sim = new Sim(start.setup);
    this.localPid = start.you;
    this.transport = transport;
    this.turns = new Map();
    this.speed = 1;
    this.paused = false;
    this.online = true;
    this.acc = 0;
    this.desync = null;
    transport.onMessage((m) => this.receive(m));
    this.token = start.token;
  }
  /** Netzwerk-Nachricht verarbeiten (auch für vorab gepufferte Nachrichten) */
  receive(m) {
    {
      if (m.t === 'turn') this.turns.set(m.tick, m.cmds);
      else if (m.t === 'history') {
        // Wiederverbinden: kompletten Befehlsverlauf übernehmen und schnell nachrechnen
        const map = new Map(m.turns);
        for (let t = this.sim.tick; t < m.upTo; t++) if (!this.turns.has(t)) this.turns.set(t, map.get(t) || []);
      } else if (m.t === 'desync') this.desync = m;
      else if (m.t === 'paused') this.netPaused = m;
      else if (m.t === 'resumed') this.netPaused = null;
      if (this.onNet) this.onNet(m);
    }
  }
  submit(cmd) { this.transport.send({ t: 'cmd', cmd }); }
  update(realDt) {
    const out = [];
    this.acc += Math.min(realDt, 0.5);
    // Aufholen, falls Turns vorliegen; nie über den letzten Turn hinaus
    let n = 0;
    const behind = this.turns.size > 6;
    const far = this.turns.size > 200; // nach Wiederverbinden: im Zeitraffer aufholen
    while ((this.acc >= DT || behind) && n < (far ? 600 : behind ? 30 : 8)) {
      const cmds = this.turns.get(this.sim.tick);
      if (!cmds) break;
      this.turns.delete(this.sim.tick);
      this.acc = Math.max(0, this.acc - DT); n++;
      for (const e of this.sim.step(cmds)) out.push(e);
      if (this.sim.tick % HASH_EVERY === 0) this.transport.send({ t: 'hash', tick: this.sim.tick, h: this.sim.hash() });
    }
    return out;
  }
  alpha() { return Math.min(1, this.acc / DT); }
  dispose() { this.transport.close(); }
}

/** WebSocket-Transport für Browser/Electron */
export function wsTransport(url) {
  const ws = new WebSocket(url);
  const handlers = [];
  const queue = [];
  ws.onopen = () => { for (const m of queue.splice(0)) ws.send(JSON.stringify(m)); };
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); for (const h of handlers) h(m); };
  return {
    ws,
    send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); else queue.push(obj); },
    onMessage(fn) { handlers.push(fn); },
    close() { try { ws.close(); } catch { /* egal */ } },
  };
}
