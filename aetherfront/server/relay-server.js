// Aetherfront Relay-Server (Lockstep). Start: `npm run server` (Port 7710, änderbar mit PORT=...).
// Der Server rechnet KEIN Spiel – er sammelt Befehle, stempelt sie auf Ticks und verteilt sie.
// Lobby: Räume mit Code, Host startet. Fehlende Plätze füllen Bots (laufen deterministisch in jeder Simulation).
'use strict';
const { WebSocketServer } = require('ws');

const TICK_MS = 50;          // 20 Ticks/s wie die Simulation
const INPUT_DELAY = 3;       // Befehle wirken 3 Ticks (150 ms) später → alle haben sie rechtzeitig
const PROTOCOL_VERSION = 1;

function createRelayServer({ port = 7710, log = console.log } = {}) {
  const wss = new WebSocketServer({ port });
  const rooms = new Map();
  let nextClient = 1;

  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const broadcast = (room, m) => { for (const c of room.clients) send(c.ws, m); };
  const code = () => { let s; do { s = Math.random().toString(36).slice(2, 7).toUpperCase(); } while (rooms.has(s)); return s; };

  function lobbyState(room) {
    return { t: 'lobby', room: room.code, host: room.host, mode: room.mode, started: room.started,
      players: room.clients.map((c) => ({ id: c.id, name: c.name, team: c.team, faction: c.faction })) };
  }

  function startRoom(room) {
    const size = room.mode; // Spieler pro Team
    const humans = room.clients.slice(0, size * 2);
    const players = [];
    const byTeam = [humans.filter((c) => c.team === 0), humans.filter((c) => c.team === 1)];
    for (let i = 0; i < size; i++) {
      for (const t of [0, 1]) {
        const c = byTeam[t][i];
        if (c) { c.pid = players.length; players.push({ name: c.name, team: t, faction: c.faction, bot: false }); }
        else players.push({ name: `Bot ${players.length + 1}`, team: t, faction: 'random', bot: true, difficulty: 'normal' });
      }
    }
    room.started = true;
    room.tick = 0;
    room.pending = new Map();
    room.hashes = new Map();
    const setup = { seed: (Math.random() * 2 ** 31) | 0, players };
    for (const c of room.clients) send(c.ws, { t: 'start', setup, you: c.pid ?? -1, version: PROTOCOL_VERSION });
    room.timer = setInterval(() => {
      const cmds = room.pending.get(room.tick) || [];
      room.pending.delete(room.tick);
      broadcast(room, { t: 'turn', tick: room.tick, cmds });
      room.tick++;
    }, TICK_MS);
    log(`[relay] Raum ${room.code} gestartet (${humans.length} Menschen, ${players.length - humans.length} Bots)`);
  }

  function leave(client) {
    const room = client.room;
    if (!room) return;
    room.clients = room.clients.filter((c) => c !== client);
    if (room.started && client.pid != null) {
      const t = room.tick + INPUT_DELAY;
      if (!room.pending.has(t)) room.pending.set(t, []);
      room.pending.get(t).push({ pid: client.pid, cmd: { type: 'leave' } });
    }
    if (!room.clients.length) { clearInterval(room.timer); rooms.delete(room.code); return; }
    if (room.host === client.id) room.host = room.clients[0].id;
    if (!room.started) broadcast(room, lobbyState(room));
  }

  wss.on('connection', (ws) => {
    const client = { id: nextClient++, ws, name: 'Spieler', team: 0, faction: 'random', room: null, pid: null };
    send(ws, { t: 'welcome', id: client.id, version: PROTOCOL_VERSION });
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const room = client.room;
      switch (m.t) {
        case 'hello': client.name = String(m.name || 'Spieler').slice(0, 20); break;
        case 'create': {
          const r = { code: code(), host: client.id, clients: [client], mode: Math.min(4, Math.max(1, m.mode | 0 || 2)), started: false };
          rooms.set(r.code, r); client.room = r; send(ws, lobbyState(r)); break;
        }
        case 'join': {
          const r = rooms.get(String(m.room || '').toUpperCase());
          if (!r || r.started || r.clients.length >= r.mode * 2) { send(ws, { t: 'error', reason: 'Raum nicht verfügbar' }); break; }
          client.room = r; client.team = r.clients.filter((c) => c.team === 0).length > r.clients.filter((c) => c.team === 1).length ? 1 : 0;
          r.clients.push(client); broadcast(r, lobbyState(r)); break;
        }
        case 'slot': if (room && !room.started) { client.team = m.team === 1 ? 1 : 0; client.faction = String(m.faction || 'random'); broadcast(room, lobbyState(room)); } break;
        case 'start': if (room && !room.started && room.host === client.id) startRoom(room); break;
        case 'cmd': {
          if (!room || !room.started || client.pid == null || !m.cmd || typeof m.cmd.type !== 'string') break;
          const t = room.tick + INPUT_DELAY;
          if (!room.pending.has(t)) room.pending.set(t, []);
          room.pending.get(t).push({ pid: client.pid, cmd: m.cmd });
          break;
        }
        case 'hash': {
          if (!room || !room.started) break;
          const k = m.tick;
          const prev = room.hashes.get(k);
          if (prev === undefined) room.hashes.set(k, m.h);
          else if (prev !== m.h) broadcast(room, { t: 'desync', tick: k });
          if (room.hashes.size > 200) room.hashes.delete(room.hashes.keys().next().value);
          break;
        }
        case 'chat': if (room) broadcast(room, { t: 'chat', from: client.name, text: String(m.text || '').slice(0, 200) }); break;
        default: break;
      }
    });
    ws.on('close', () => leave(client));
  });
  log(`[relay] Aetherfront-Server läuft auf Port ${port}`);
  return { wss, rooms, close: () => { for (const r of rooms.values()) clearInterval(r.timer); wss.close(); } };
}

module.exports = { createRelayServer, TICK_MS, INPUT_DELAY };
if (require.main === module) createRelayServer({ port: +process.env.PORT || 7710 });
