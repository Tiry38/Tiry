// Aetherfront Relay-Server (Lockstep). Start: `npm run server` (Port 7710, änderbar mit PORT=...).
// Kann auch direkt im Spiel gestartet werden („Spiel hosten“) – dann ist der Host-PC der Server.
// Der Server rechnet KEIN Spiel – er sammelt Befehle, stempelt sie auf Ticks und verteilt sie (betrugssicher:
// jeder Client rechnet dieselbe deterministische Simulation, Abweichungen werden per Prüfsumme erkannt).
// Funktionen: Räume mit Code/Link, öffentliche Liste, Schnellsuche, Plätze (Mensch/Bot/geschlossen),
// Host-Einstellungen, Wiederverbinden mit Verlauf, Bot-Übernahme, Pause-Abstimmung, Chat, Karten-Markierungen.
'use strict';
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const TICK_MS = 50;          // 20 Ticks/s wie die Simulation
const INPUT_DELAY = 3;       // Befehle wirken 3 Ticks (150 ms) später → alle haben sie rechtzeitig
const PROTOCOL_VERSION = 2;
const RECONNECT_GRACE_MS = 45000;
const PAUSE_MAX_MS = 90000;

const DEFAULT_CONFIG = () => ({ pickMode: 'ap', champions: false, waves: 30, gameMode: 'normal', bots: true, botDifficulty: 'normal', autobalance: true, heroes: true });

function createRelayServer({ port = 7710, log = console.log, server } = {}) {
  const wss = server ? new WebSocketServer({ server }) : new WebSocketServer({ port });
  const rooms = new Map();
  let nextClient = 1;

  const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const broadcast = (room, m, filter) => { for (const c of room.clients) if (!filter || filter(c)) send(c.ws, m); };
  const code = () => { let s; do { s = crypto.randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5); } while (s.length < 5 || rooms.has(s)); return s; };
  const emptySlots = (n) => [0, 1].map(() => Array.from({ length: 4 }, (_, i) => ({ kind: i < n ? 'open' : 'closed', difficulty: 'normal' })));

  function lobbyState(room) {
    return {
      t: 'lobby', room: room.code, name: room.name, public: room.public, host: room.host, mode: room.mode, started: room.started, config: room.config,
      slots: room.slots,
      players: room.clients.map((c) => ({ id: c.id, name: c.name, team: c.team, faction: c.faction, hero: c.hero, ready: !!c.ready, connected: c.ws?.readyState === 1 })),
    };
  }
  const pushLobby = (room) => { if (!room.started) broadcast(room, lobbyState(room)); };

  function createRoom(client, m) {
    const mode = Math.min(4, Math.max(1, m.mode | 0 || 2));
    const r = { code: code(), name: String(m.name || `${client.name}s Spiel`).slice(0, 40), public: !!m.public, host: client.id, clients: [client], mode, started: false, config: DEFAULT_CONFIG(), slots: emptySlots(mode), paused: null, history: new Map() };
    rooms.set(r.code, r);
    client.room = r; client.team = 0;
    send(client.ws, lobbyState(r));
    return r;
  }

  function seatsFree(room, team) {
    const humans = room.clients.filter((c) => c.team === team).length;
    const usable = room.slots[team].slice(0, room.mode).filter((s) => s.kind === 'open').length;
    return usable - humans;
  }

  function joinRoom(client, r) {
    if (!r || r.started) return send(client.ws, { t: 'error', reason: 'Raum nicht verfügbar' });
    const team = seatsFree(r, 0) >= seatsFree(r, 1) ? 0 : 1;
    if (seatsFree(r, team) <= 0) return send(client.ws, { t: 'error', reason: 'Raum ist voll' });
    client.room = r; client.team = team;
    r.clients.push(client);
    pushLobby(r);
  }

  function startRoom(room) {
    const players = [];
    const teamSize = [0, 0];
    for (let i = 0; i < room.mode; i++) {
      for (const t of [0, 1]) {
        const slot = room.slots[t][i];
        const human = room.clients.filter((c) => c.team === t)[i];
        if (human) { human.pid = players.length; players.push({ name: human.name, team: t, faction: human.faction, hero: human.hero, bot: false }); teamSize[t]++; }
        else if (slot.kind === 'bot' || (slot.kind === 'open' && room.config.bots)) {
          players.push({ name: `Bot ${players.length + 1}`, team: t, faction: 'random', bot: true, difficulty: slot.kind === 'bot' ? slot.difficulty : room.config.botDifficulty });
          teamSize[t]++;
        }
      }
    }
    // Automatischer Ausgleich bei ungleichen Teams: das kleinere Team bekommt Start- und Einkommensbonus
    if (room.config.autobalance && teamSize[0] && teamSize[1] && teamSize[0] !== teamSize[1]) {
      const small = teamSize[0] < teamSize[1] ? 0 : 1;
      const ratio = teamSize[1 - small] / teamSize[small];
      for (const p of players) if (p.team === small) { p.bonusGold = Math.round(260 * (ratio - 1)); p.bonusIncome = Math.round(20 * (ratio - 1)); }
    }
    room.started = true;
    room.tick = 0;
    room.pending = new Map();
    room.hashes = new Map();
    const c = room.config;
    const rules = { pickMode: c.pickMode || 'ap', champions: !!c.champions, maxWaves: c.waves || 30, gameMode: c.gameMode || 'normal', heroes: c.heroes !== false };
    if (c.pickMode === 'mirror') { rules.pickMode = 'ar'; rules.mirror = true; }
    room.setup = { seed: (crypto.randomBytes(4).readUInt32BE(0) >>> 1), players, rules };
    for (const cl of room.clients) send(cl.ws, { t: 'start', setup: room.setup, you: cl.pid ?? -1, token: cl.token, version: PROTOCOL_VERSION });
    room.timer = setInterval(() => tickRoom(room), TICK_MS);
    log(`[relay] Raum ${room.code} gestartet (${room.clients.length} Menschen, ${players.length - room.clients.length} Bots)`);
  }

  function tickRoom(room) {
    if (room.paused) {
      if (Date.now() - room.paused.since > PAUSE_MAX_MS) { room.paused = null; broadcast(room, { t: 'resumed', reason: 'Pausenzeit abgelaufen' }); }
      else return;
    }
    const cmds = room.pending.get(room.tick) || [];
    room.pending.delete(room.tick);
    if (cmds.length) room.history.set(room.tick, cmds);
    broadcast(room, { t: 'turn', tick: room.tick, cmds }, (c) => !c.catchingUp);
    room.tick++;
  }

  function queueCmd(room, pid, cmd) {
    const t = room.tick + INPUT_DELAY;
    if (!room.pending.has(t)) room.pending.set(t, []);
    room.pending.get(t).push({ pid, cmd });
  }

  function dropClient(client) {
    const room = client.room;
    if (!room) return;
    if (room.started && client.pid != null) {
      // Kurz warten: Wiederverbinden möglich. Danach übernimmt ein Bot den Platz.
      client.dropTimer = setTimeout(() => {
        if (client.ws && client.ws.readyState === 1) return;
        queueCmd(room, client.pid, { type: 'leave' });
        broadcast(room, { t: 'chat', from: 'System', text: `${client.name} hat das Spiel verlassen – ein Bot übernimmt.` });
        room.clients = room.clients.filter((c) => c !== client);
        if (!room.clients.some((c) => c.ws?.readyState === 1)) { clearInterval(room.timer); rooms.delete(room.code); }
      }, RECONNECT_GRACE_MS);
      broadcast(room, { t: 'chat', from: 'System', text: `${client.name} hat die Verbindung verloren …` });
      return;
    }
    room.clients = room.clients.filter((c) => c !== client);
    if (!room.clients.length) { clearInterval(room.timer); rooms.delete(room.code); return; }
    if (room.host === client.id) room.host = room.clients[0].id;
    pushLobby(room);
  }

  function rejoin(client, m) {
    const room = rooms.get(String(m.room || '').toUpperCase());
    if (!room || !room.started) return send(client.ws, { t: 'error', reason: 'Spiel nicht mehr vorhanden' });
    const old = room.clients.find((c) => c.token === m.token);
    if (!old) return send(client.ws, { t: 'error', reason: 'Unbekannter Platz' });
    clearTimeout(old.dropTimer);
    old.ws = client.ws;
    client.replaced = old;
    old.catchingUp = true;
    // kompletter Verlauf aller Befehle → der Client rechnet bis zum aktuellen Stand nach
    const turns = [...room.history.entries()];
    send(old.ws, { t: 'start', setup: room.setup, you: old.pid, token: old.token, version: PROTOCOL_VERSION, rejoin: true });
    send(old.ws, { t: 'history', upTo: room.tick, turns });
    old.catchingUp = false;
    broadcast(room, { t: 'chat', from: 'System', text: `${old.name} ist wieder da.` });
    return old;
  }

  wss.on('connection', (ws) => {
    let client = { id: nextClient++, ws, name: 'Spieler', team: 0, faction: 'random', hero: null, room: null, pid: null, token: crypto.randomBytes(12).toString('hex') };
    send(ws, { t: 'welcome', id: client.id, token: client.token, version: PROTOCOL_VERSION });
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const room = client.room;
      const isHost = room && room.host === client.id;
      switch (m.t) {
        case 'hello': client.name = String(m.name || 'Spieler').slice(0, 20); break;
        case 'list': {
          const list = [...rooms.values()].filter((r) => r.public && !r.started).map((r) => ({ room: r.code, name: r.name, mode: r.mode, players: r.clients.length, free: seatsFree(r, 0) + seatsFree(r, 1), config: r.config }));
          send(ws, { t: 'rooms', rooms: list });
          break;
        }
        case 'create': createRoom(client, m); break;
        case 'join': joinRoom(client, rooms.get(String(m.room || '').toUpperCase())); break;
        case 'quick': {
          const mode = Math.min(4, Math.max(1, m.mode | 0 || 2));
          const r = [...rooms.values()].find((x) => x.public && !x.started && x.mode === mode && seatsFree(x, 0) + seatsFree(x, 1) > 0);
          if (r) joinRoom(client, r); else createRoom(client, { mode, public: true, name: `Schnellsuche ${mode}v${mode}` });
          break;
        }
        case 'rejoin': { const old = rejoin(client, m); if (old) client = old; break; }
        case 'slot': if (room && !room.started) {
          if (m.team === 0 || m.team === 1) { const want = m.team; if (want !== client.team && seatsFree(room, want) > 0) client.team = want; }
          if (m.faction) client.faction = String(m.faction);
          if (m.hero) client.hero = String(m.hero);
          if (typeof m.ready === 'boolean') client.ready = m.ready;
          pushLobby(room);
        } break;
        case 'slotKind': if (room && !room.started && isHost) {
          const s = room.slots[m.team === 1 ? 1 : 0]?.[m.index | 0];
          if (s && ['open', 'bot', 'closed'].includes(m.kind)) { s.kind = m.kind; if (['easy', 'normal', 'hard', 'extreme'].includes(m.difficulty)) s.difficulty = m.difficulty; }
          pushLobby(room);
        } break;
        case 'config': {
          if (!room || room.started || !isHost) break;
          const c = m.config || {};
          if (['ap', 'ar', 'pr', 'hp', 'mirror'].includes(c.pickMode)) room.config.pickMode = c.pickMode;
          if (typeof c.champions === 'boolean') room.config.champions = c.champions;
          if ([10, 20, 30].includes(c.waves)) room.config.waves = c.waves;
          if (['normal', 'fast', 'long', 'hard'].includes(c.gameMode)) room.config.gameMode = c.gameMode;
          if (typeof c.bots === 'boolean') room.config.bots = c.bots;
          if (typeof c.autobalance === 'boolean') room.config.autobalance = c.autobalance;
          if (typeof c.public === 'boolean') room.public = c.public;
          if (['easy', 'normal', 'hard', 'extreme'].includes(c.botDifficulty)) room.config.botDifficulty = c.botDifficulty;
          if (c.mode >= 1 && c.mode <= 4) {
            const per = [0, 1].map((t) => room.clients.filter((x) => x.team === t).length);
            if (per[0] <= c.mode && per[1] <= c.mode) {
              room.mode = c.mode;
              for (const t of [0, 1]) room.slots[t].forEach((s, i) => { if (i >= c.mode) s.kind = 'closed'; else if (s.kind === 'closed') s.kind = 'open'; });
            }
          }
          pushLobby(room);
          break;
        }
        case 'start': {
          if (!room || room.started || !isHost) break;
          const teams = [0, 1].map((t) => room.clients.filter((c) => c.team === t).length + room.slots[t].slice(0, room.mode).filter((s, i) => s.kind === 'bot' || (s.kind === 'open' && room.config.bots && i >= room.clients.filter((c) => c.team === t).length)).length);
          if (!teams[0] || !teams[1]) { send(ws, { t: 'error', reason: 'Jedes Team braucht mindestens einen Spieler oder Bot' }); break; }
          if ([0, 1].some((t) => room.clients.filter((c) => c.team === t).length > room.mode)) { send(ws, { t: 'error', reason: 'Ein Team hat zu viele Spieler' }); break; }
          startRoom(room);
          break;
        }
        case 'cmd': {
          if (!room || !room.started || client.pid == null || !m.cmd || typeof m.cmd.type !== 'string') break;
          if (JSON.stringify(m.cmd).length > 400) break; // Schutz vor übergroßen Befehlen
          queueCmd(room, client.pid, m.cmd);
          break;
        }
        case 'hash': {
          if (!room || !room.started) break;
          const prev = room.hashes.get(m.tick);
          if (prev === undefined) room.hashes.set(m.tick, m.h);
          else if (prev !== m.h) broadcast(room, { t: 'desync', tick: m.tick });
          if (room.hashes.size > 400) room.hashes.delete(room.hashes.keys().next().value);
          break;
        }
        case 'pause': {
          if (!room || !room.started || room.paused) break;
          room.vote = room.vote || { yes: new Set(), since: Date.now() };
          room.vote.yes.add(client.id);
          const humans = room.clients.filter((c) => c.ws?.readyState === 1).length;
          if (room.vote.yes.size * 2 > humans || humans === 1) { room.paused = { since: Date.now(), by: client.name }; room.vote = null; broadcast(room, { t: 'paused', by: client.name, max: PAUSE_MAX_MS / 1000 }); }
          else broadcast(room, { t: 'pauseVote', by: client.name, yes: room.vote.yes.size, need: Math.floor(humans / 2) + 1 });
          break;
        }
        case 'resume': if (room && room.paused) { room.paused = null; broadcast(room, { t: 'resumed', by: client.name }); } break;
        case 'chat': if (room) {
          const text = String(m.text || '').slice(0, 200);
          if (!text.trim()) break;
          broadcast(room, { t: 'chat', from: client.name, text, team: !!m.team }, m.team ? (c) => c.team === client.team : null);
        } break;
        case 'mark': if (room && room.started) {
          const kind = ['help', 'attack', 'leak', 'here'].includes(m.kind) ? m.kind : 'here';
          broadcast(room, { t: 'mark', from: client.name, pid: client.pid, x: +m.x || 0, z: +m.z || 0, kind }, (c) => c.team === client.team);
        } break;
        default: break;
      }
    });
    ws.on('close', () => { if (client.ws === ws) dropClient(client); });
  });
  log(`[relay] Aetherfront-Server läuft auf Port ${port}`);
  return { wss, rooms, close: () => { for (const r of rooms.values()) clearInterval(r.timer); wss.close(); } };
}

module.exports = { createRelayServer, TICK_MS, INPUT_DELAY, PROTOCOL_VERSION };
if (require.main === module) createRelayServer({ port: +process.env.PORT || 7710 });
