import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import WebSocket from 'ws';
import { NetSession } from '../src/net/session.js';

const require = createRequire(import.meta.url);
const { createRelayServer } = require('../server/relay-server.js');

function client(url) {
  const ws = new WebSocket(url);
  const handlers = [];
  const inbox = [];
  ws.on('message', (d) => { const m = JSON.parse(d); inbox.push(m); for (const h of handlers) h(m); });
  return {
    ws, inbox,
    ready: new Promise((r) => ws.on('open', r)),
    send(o) { ws.send(JSON.stringify(o)); },
    onMessage(fn) { handlers.push(fn); },
    close() { ws.close(); },
    wait(pred, ms = 4000) {
      return new Promise((res, rej) => {
        const f = inbox.find(pred); if (f) return res(f);
        const to = setTimeout(() => rej(new Error('timeout')), ms);
        handlers.push((m) => { if (pred(m)) { clearTimeout(to); res(m); } });
      });
    },
  };
}

test('Online-Lockstep: zwei Clients über den Relay-Server bleiben synchron', async () => {
  const port = 7790 + Math.floor(Math.random() * 100);
  const srv = createRelayServer({ port, log: () => {} });
  const url = `ws://127.0.0.1:${port}`;
  const a = client(url), b = client(url);
  await Promise.all([a.ready, b.ready]);
  a.send({ t: 'hello', name: 'Tiry' }); b.send({ t: 'hello', name: 'Freund' });
  a.send({ t: 'create', mode: 1 });
  const lobby = await a.wait((m) => m.t === 'lobby');
  b.send({ t: 'join', room: lobby.room });
  await a.wait((m) => m.t === 'lobby' && m.players.length === 2);
  a.send({ t: 'slot', team: 0, faction: 'orden' });
  b.send({ t: 'slot', team: 1, faction: 'abgrund' });
  await new Promise((r) => setTimeout(r, 100));
  a.send({ t: 'config', config: { pickMode: 'pr', champions: true, waves: 20, bots: true, botDifficulty: 'hard' } });
  b.send({ t: 'config', config: { pickMode: 'ar' } }); // kein Host → ignoriert
  await a.wait((m) => m.t === 'lobby' && m.config.pickMode === 'pr');
  a.send({ t: 'start' });
  const [sa, sb] = await Promise.all([a.wait((m) => m.t === 'start'), b.wait((m) => m.t === 'start')]);
  assert.equal(sa.setup.seed, sb.setup.seed);
  assert.notEqual(sa.you, sb.you);
  assert.deepEqual(sa.setup.rules, { pickMode: 'pr', champions: true, maxWaves: 20 });
  const na = new NetSession(a, sa), nb = new NetSession(b, sb);
  na.submit({ type: 'build', unit: na.sim.players[sa.you].lines[0], col: 2, row: 1 });
  nb.submit({ type: 'build', unit: nb.sim.players[sb.you].lines[1], col: 3, row: 1 });
  const t0 = Date.now();
  while (Date.now() - t0 < 1500) {
    na.update(0.05); nb.update(0.05);
    await new Promise((r) => setTimeout(r, 25));
  }
  const tick = Math.min(na.sim.tick, nb.sim.tick);
  assert.ok(tick > 10, 'Simulation läuft');
  // Auf gleichen Tick bringen und vergleichen
  const ahead = na.sim.tick > nb.sim.tick ? nb : na;
  for (let i = 0; i < 40 && na.sim.tick !== nb.sim.tick; i++) { ahead.update(0.05); await new Promise((r) => setTimeout(r, 30)); }
  assert.equal(na.sim.tick, nb.sim.tick);
  assert.equal(na.sim.hash(), nb.sim.hash());
  assert.equal(na.sim.fightersOf(sa.you).length, 1);
  assert.equal(nb.sim.fightersOf(sb.you).length, 1);
  assert.equal(na.desync, null);
  a.close(); b.close(); srv.close();
});
