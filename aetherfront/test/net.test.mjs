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
  assert.deepEqual(sa.setup.rules, { pickMode: 'pr', champions: true, maxWaves: 20, gameMode: 'normal', heroes: true });
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


test('Online: Plätze (Bot/geschlossen), Liste, Schnellsuche, Wiederverbinden mit Verlauf, Pause-Abstimmung', async (t) => {
  const port = 7890 + Math.floor(Math.random() * 100);
  const srv = createRelayServer({ port, log: () => {} });
  const socks = [];
  t.after(() => { for (const c of socks) try { c.close(); } catch { /* egal */ } srv.close(); });
  const url = `ws://127.0.0.1:${port}`;
  const a = client(url), b = client(url);
  socks.push(a, b);
  await Promise.all([a.ready, b.ready]);
  a.send({ t: 'hello', name: 'Host' }); b.send({ t: 'hello', name: 'Gast' });
  // Schnellsuche erstellt einen öffentlichen Raum, der in der Liste auftaucht
  a.send({ t: 'quick', mode: 2 });
  const lobby = await a.wait((m) => m.t === 'lobby');
  assert.equal(lobby.public, true);
  b.send({ t: 'list' });
  const list = await b.wait((m) => m.t === 'rooms');
  assert.ok(list.rooms.some((r) => r.room === lobby.room));
  b.send({ t: 'quick', mode: 2 });
  await a.wait((m) => m.t === 'lobby' && m.players.length === 2);
  // Host: Team West Platz 2 = schwerer Bot, Team Ost Platz 2 geschlossen
  a.send({ t: 'config', config: { bots: false } });
  a.send({ t: 'slotKind', team: 0, index: 1, kind: 'bot', difficulty: 'hard' });
  a.send({ t: 'slotKind', team: 1, index: 1, kind: 'closed' });
  await a.wait((m) => m.t === 'lobby' && m.slots[1][1].kind === 'closed' && m.slots[0][1].kind === 'bot');
  a.send({ t: 'start' });
  const [sa, sb] = await Promise.all([a.wait((m) => m.t === 'start'), b.wait((m) => m.t === 'start')]);
  assert.equal(sa.setup.players.length, 3, '2 Menschen + 1 Bot');
  assert.ok(sa.setup.players.some((p) => p.bot && p.difficulty === 'hard'));
  assert.ok(sa.setup.players.filter((p) => p.team === 1).every((p) => p.bonusGold > 0), 'Ausgleich für das kleinere Team');
  const na = new NetSession(a, sa);
  na.submit({ type: 'build', unit: na.sim.players[sa.you].lines[0], col: 1, row: 1 });
  for (let i = 0; i < 30; i++) { na.update(0.05); await new Promise((r) => setTimeout(r, 25)); }
  // Gast verliert die Verbindung und kommt mit seinem Token zurück
  b.close();
  await new Promise((r) => setTimeout(r, 300));
  const b2 = client(url); socks.push(b2); await b2.ready;
  b2.send({ t: 'rejoin', room: lobby.room, token: sb.token });
  const sb2 = await b2.wait((m) => m.t === 'start' && m.rejoin);
  await b2.wait((m) => m.t === 'history');
  const nb = new NetSession(b2, sb2);
  for (const m of b2.inbox) if (m.t === 'history' || m.t === 'turn') nb.receive(m);
  for (let i = 0; i < 60 && nb.sim.tick < na.sim.tick; i++) { nb.update(0.05); na.update(0.05); await new Promise((r) => setTimeout(r, 20)); }
  const ahead = na.sim.tick > nb.sim.tick ? nb : na;
  for (let i = 0; i < 60 && na.sim.tick !== nb.sim.tick; i++) { ahead.update(0.05); await new Promise((r) => setTimeout(r, 25)); }
  assert.equal(na.sim.tick, nb.sim.tick);
  assert.equal(na.sim.hash(), nb.sim.hash(), 'nach Wiederverbinden synchron');
  // Pause-Abstimmung: 1 von 2 reicht nicht, 2 von 2 pausiert
  a.send({ t: 'pause' });
  await b2.wait((m) => m.t === 'pauseVote');
  b2.send({ t: 'pause' });
  await a.wait((m) => m.t === 'paused');
  a.send({ t: 'resume' });
  await b2.wait((m) => m.t === 'resumed');
  // Markierung geht ans eigene Team
  a.send({ t: 'mark', x: 1, z: 2, kind: 'leak' });
  const mk = await a.wait((m) => m.t === 'mark');
  assert.equal(mk.kind, 'leak');
  a.close(); b2.close(); srv.close();
});
