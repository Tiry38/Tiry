// Missions-Mechaniken der Kampagne – jede der 24 Missionen hat eine Mechanik, die es nur dort gibt.
// Ohne Helden: Der Spieler wirkt über Bau-Entscheidungen, Söldner, Äther/Gold und Klicks auf Missionsobjekte.
// Jede Spieler-Aktion ist ein Befehl { type: 'mission', id?, action?, x?, z? } über sim.applyCommand (Lockstep-fest).
// Deterministisch (sim.rng), angebunden über Hooks der Simulation:
//   init, waveStart, waveEnd, tick, onKill, canTarget(f,c), dmgMul(src,tgt,atk), unitMul(f), allow(p,cmd), final(), text(),
//   command(p,cmd) → true | Fehlertext, clickable(entity) → bool, actions(ctx) → Schaltflächen im HUD, bot(p) → Befehl.
// Missions-Objekte (Funken, Leuchtfeuer, Käfige, Pfeiler, Kraftknoten, Runen, Ventile, Risskerne) sind Entitäten vom Typ 'o'.
import { UNITS, ATTACK_TYPES } from './data.js';
import { LANE_SPAWN_Z, LANE_END_Z, BUILD_Z0, CELL, GRID_COLS, GRID_ROWS, cellCenter } from './layout.js';

const DT = 1 / 20;

function lanePlayer(sim) { return sim.players[0]; }
function spawnObj(sim, kind, x, z, extra = {}) {
  const o = { id: sim.nextId++, type: 'o', kind, x, z, hp: 0, alive: true, lane: 0, charge: 0, ...extra };
  sim.entities.set(o.id, o);
  sim.emit({ e: 'objSpawn', id: o.id, kind, x, z });
  return o;
}
function objs(sim, kind) { const out = []; for (const e of sim.entities.values()) if (e.type === 'o' && e.kind === kind && e.alive) out.push(e); return out; }
function removeObj(sim, o, reason) { o.alive = false; sim.entities.delete(o.id); sim.emit({ e: 'objDone', id: o.id, kind: o.kind, reason, x: o.x, z: o.z }); }
function near(a, b, r) { return a && b && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r; }
function laneX(sim) { return sim.laneX(lanePlayer(sim).id); }
function wavesDone(sim) { return sim.wave - sim.rules.startWave; }
function battle(sim) { return sim.phase === 'battle'; }
function say(sim, text) { sim.emit({ e: 'objective', text }); }
/** Befehl zielt auf ein Missionsobjekt dieser Art? */
function objFor(sim, cmd, kind) { const o = cmd.id != null && sim.entities.get(cmd.id); return o && o.type === 'o' && o.kind === kind && o.alive ? o : null; }
function pay(p, res, amount, what) {
  if (p[res] < amount) return `Nicht genug ${res === 'gold' ? 'Gold' : 'Äther'} (${amount} für ${what})`;
  p[res] -= amount;
  return true;
}
/** Bodenwarnung + verzögerter Einschlag (Lava, Drachenatem). v = { shape, x, z, r | x2,z2,w, t, dmg, own } */
function telegraph(sim, st, v) {
  (st.pending = st.pending || []).push(v);
  sim.emit({ e: 'telegraph', shape: v.shape || 'circle', x: v.x, z: v.z, r: v.r, x2: v.x2, z2: v.z2, w: v.w, dur: v.t, lane: 0, hazard: true });
}
function resolveTelegraphs(sim, st) {
  const list = st.pending || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i];
    v.t -= DT;
    if (v.t > 0) continue;
    list.splice(i, 1);
    const src = { type: 'env', alive: false };
    const hit = (e) => (v.shape === 'line' ? Math.abs(e.x - v.x) <= v.w / 2 && e.z >= Math.min(v.z, v.z2) && e.z <= Math.max(v.z, v.z2) : near(e, v, v.r));
    for (const e of [...sim.entities.values()]) {
      if (!e.alive || (e.type !== 'f' && e.type !== 'c') || e.npc) continue;
      if (v.own && e.type !== 'f') continue; // Drachenatem trifft nur Vasallen
      if (hit(e)) sim.applyHit(src, e, v.dmg, 'chaos', false);
    }
    if (v.shape === 'line') { for (let z = Math.min(v.z, v.z2); z <= Math.max(v.z, v.z2); z += 4) sim.emit({ e: 'splash', x: v.x, z, r: v.w / 2, atk: 'chaos' }); }
    else { sim.emit({ e: 'splash', x: v.x, z: v.z, r: v.r, atk: 'chaos' }); sim.emit({ e: 'lava', x: v.x, z: v.z, r: v.r }); }
  }
}
function lavaTick(sim, st, every = 5.5) {
  st.lavaT = (st.lavaT ?? 4) - DT;
  if (st.lavaT <= 0) {
    st.lavaT = every;
    const lx = laneX(sim);
    for (let i = 0; i < 2; i++) telegraph(sim, st, { x: lx + sim.rng.range(-5, 5), z: sim.rng.range(-20, 8), r: 3, t: 1.8, dmg: 120 * Math.pow(1.13, sim.wave - 1) });
  }
}
/** Bosswelle: alle Boss-Gegner dieser Bahn */
function bosses(sim) { const out = []; for (const c of sim.entities.values()) if (c.type === 'c' && c.alive && c.def.boss) out.push(c); return out; }
function isBossWave(sim) { return sim.wave >= sim.rules.maxWaves; }
const bossLine = (st, sim) => (isBossWave(sim) ? `${st.cfg.name} ist da!` : `${st.cfg.name} erscheint in Welle ${sim.rules.maxWaves}`);

export const MECHANICS = {
  // 1 – Schritt-für-Schritt-Einführung
  tutorial: {
    text: (sim) => {
      const p = lanePlayer(sim), w = wavesDone(sim);
      if (sim.phase === 'build' && sim.armyValue(p.id) === 0) return 'Bauphase: Wähle unten einen Vasallen (Q) und setze ihn auf das leuchtende Raster.';
      if (sim.phase === 'build' && w === 0) return 'Setze weitere Vasallen (Q W E R A S D F), dann drücke ↵ „Bereit“.';
      if (sim.phase === 'battle' && w === 0) return 'Kampf! Deine Vasallen kämpfen von selbst. Fallen sie, stehen sie nach der Welle wieder auf.';
      if (sim.phase === 'battle' && w === 1) return 'Gegner, die durchbrechen, greifen deinen König an. Klicke Gegner an, um ihre Werte zu sehen.';
      if (sim.phase === 'build' && w === 2) return 'Klicke einen Vasallen an und werte ihn auf – jede Stufe hat zwei Pfade (C / V).';
      if (sim.phase === 'build' && w >= 3) return 'Funken (B) sammeln Äther. Mit Äther schickst du Söldner (1–7) und erhöhst dein Einkommen.';
      return `Halte die Bahn: noch ${sim.rules.maxWaves - sim.wave + (sim.phase === 'build' ? 1 : 0)} Wellen.`;
    },
  },

  // 2 – Ätherfunken per Klick einsammeln, bevor sie verglühen
  shards: {
    init: (sim, st) => { st.count = 0; },
    waveStart: (sim) => {
      const lx = laneX(sim);
      for (let i = 0; i < 3; i++) spawnObj(sim, 'shard', lx + sim.rng.range(-5, 5), sim.rng.range(-26, 4), { timer: 14 + i * 4, maxTimer: 14 + i * 4 });
    },
    tick: (sim) => {
      if (!battle(sim)) return;
      for (const o of objs(sim, 'shard')) { o.timer -= DT; if (o.timer <= 0) removeObj(sim, o, 'faded'); }
    },
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'shard',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'shard');
      if (!o) return 'Kein Ätherfunke';
      st.count++; p.aether += 15;
      say(sim, `Ätherfunke ${st.count}/${st.cfg.need} eingesammelt (+15 Äther)`);
      removeObj(sim, o, 'collected');
      return true;
    },
    bot: (sim, st) => { const o = objs(sim, 'shard')[0]; return o && sim.rng.next() < 0.6 ? { type: 'mission', id: o.id } : null; },
    waveEnd: (sim) => { for (const o of objs(sim, 'shard')) removeObj(sim, o, 'faded'); },
    final: (sim, st) => (st.count >= st.cfg.need ? { winner: 0, reason: `Alle Wellen gehalten und ${st.count} Funken gesammelt` } : { winner: 1, reason: `Nur ${st.count} von ${st.cfg.need} Ätherfunken gesammelt` }),
    text: (sim, st) => `Ätherfunken: ${st.count}/${st.cfg.need} · Klicke die leuchtenden Splitter auf der Bahn an, bevor sie verglühen`,
  },

  // 3 – Die vorderste Baureihe stürzt ab
  collapse: {
    init: (sim, st) => { st.rows = new Set(); sim.blockedRows = st.rows; },
    waveEnd: (sim, st) => {
      const w = wavesDone(sim) + 1;
      if (!st.cfg.at.includes(w)) return;
      const row = st.rows.size;
      st.rows.add(row);
      let refund = 0;
      for (const f of sim.fightersOf(lanePlayer(sim).id)) if (f.row === row) { refund += UNITS[f.def].value; sim.entities.delete(f.id); sim.emit({ e: 'death', id: f.id, x: f.x, z: f.z, type: 'f', model: UNITS[f.def].model }); }
      lanePlayer(sim).gold += refund;
      sim.emit({ e: 'collapse', row, refund });
      say(sim, `Die Brücke bröckelt! Reihe ${row + 1} ist abgestürzt${refund ? ` – ${refund} Gold erstattet` : ''}.`);
    },
    text: (sim, st) => { const next = st.cfg.at.find((w) => w > wavesDone(sim)); return `Die Brücke bröckelt: ${st.rows.size} Reihe(n) abgestürzt${next ? ` · nächste nach Welle ${sim.rules.startWave + next - 1}` : ''} – baue weiter hinten.`; },
  },

  // 4 – Nacht: Leuchtfeuer brennen nur kurz und müssen immer wieder per Klick entzündet werden
  night: {
    init: (sim, st) => {
      const lx = laneX(sim);
      for (const [dx, z] of [[-4, -22], [4, -12], [-3, -1]]) spawnObj(sim, 'beacon', lx + dx, z, { lit: false, burn: 0, maxBurn: 12 });
    },
    tick: (sim) => {
      if (!battle(sim)) return;
      for (const o of objs(sim, 'beacon')) if (o.lit) { o.burn -= DT; if (o.burn <= 0) { o.lit = false; o.burn = 0; sim.emit({ e: 'objOut', id: o.id }); } }
    },
    waveEnd: (sim) => { for (const o of objs(sim, 'beacon')) { o.lit = false; o.burn = 0; } },
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'beacon',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'beacon');
      if (!o) return 'Kein Leuchtfeuer';
      if (sim.phase !== 'battle') return 'Leuchtfeuer brennen nur in der Nacht (Kampfphase)';
      if (o.lit && o.burn > 4) return 'Das Leuchtfeuer brennt noch';
      o.lit = true; o.burn = o.maxBurn;
      sim.emit({ e: 'objLit', id: o.id, x: o.x, z: o.z });
      return true;
    },
    bot: (sim) => { if (sim.phase !== 'battle') return null; const o = objs(sim, 'beacon').find((b) => !b.lit); return o && sim.rng.next() < 0.5 ? { type: 'mission', id: o.id } : null; },
    canTarget: (sim, st, f, c) => {
      if ((c.x - f.x) ** 2 + (c.z - f.z) ** 2 < 9) return true;
      for (const o of objs(sim, 'beacon')) if (o.lit && near(o, c, 9)) return true;
      return false;
    },
    text: (sim) => { const lit = objs(sim, 'beacon').filter((o) => o.lit).length; return sim.phase === 'battle' ? `Nacht: Vasallen sehen nur im Licht · Leuchtfeuer ${lit}/3 – anklicken (brennen 12 s)` : 'Nacht: In der Kampfphase entzündest du die Leuchtfeuer per Klick – sie brennen nur 12 s.'; },
  },

  // 5 – Pilger laufen durch die Bahn und müssen den König erreichen
  escort: {
    init: (sim, st) => { st.saved = 0; st.lost = 0; },
    waveStart: (sim, st) => {
      if (!st.cfg.waves.includes(wavesDone(sim) + 1)) return;
      const p = lanePlayer(sim), lx = laneX(sim);
      for (let i = 0; i < 2; i++) {
        const f = sim.spawnFighter(p, UNITS.orden_priest_1, -1, -1, lx + (i ? 1.5 : -1.5), LANE_SPAWN_Z + 6 - i * 2);
        f.summon = true; f.npc = true; f.maxHp = f.hp = Math.round(500 * Math.pow(1.13, sim.wave - 1));
      }
      say(sim, 'Pilger betreten die Bahn – beschütze sie bis zum König!');
    },
    tick: (sim, st) => {
      if (!battle(sim)) return;
      for (const f of sim.entities.values()) {
        if (f.type !== 'f' || !f.npc) continue;
        if (!f.alive) { st.lost++; sim.entities.delete(f.id); say(sim, 'Ein Pilger ist gefallen!'); continue; }
        f.z += 1.6 * DT; f.moving = sim.tick; f.face = 0;
        if (f.z >= LANE_END_Z - 1) { st.saved++; sim.entities.delete(f.id); sim.emit({ e: 'objDone', id: f.id, kind: 'pilgrim', reason: 'saved', x: f.x, z: f.z }); say(sim, `Pilger in Sicherheit (${st.saved})`); }
      }
    },
    final: (sim, st) => (st.lost <= st.cfg.maxLost ? { winner: 0, reason: `${st.saved} Pilger gerettet` } : { winner: 1, reason: `${st.lost} Pilger verloren` }),
    text: (sim, st) => `Eskorte: ${st.saved} gerettet · ${st.lost} verloren (höchstens ${st.cfg.maxLost}) – Spott-Vasallen und Heiler schützen die Pilger`,
  },

  // 6 – Steintitan: Runensteine mit Äther aufladen schwächt den Titan dauerhaft
  titan: {
    init: (sim, st) => { st.runes = 0; MECHANICS.titan.place(sim); },
    place: (sim) => {
      for (const o of objs(sim, 'rune')) removeObj(sim, o, 'reset');
      const lx = laneX(sim);
      spawnObj(sim, 'rune', lx - 6, BUILD_Z0 - 4);
      spawnObj(sim, 'rune', lx + 6, BUILD_Z0 - 4);
    },
    waveEnd: (sim) => MECHANICS.titan.place(sim),
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'rune',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'rune');
      if (!o) return 'Kein Runenstein';
      if (st.runes >= 6) return 'Der Titan ist bereits maximal geschwächt';
      const cost = 20 + 6 * st.runes;
      const r = pay(p, 'aether', cost, 'die Rune');
      if (r !== true) return r;
      st.runes++;
      sim.emit({ e: 'objLit', id: o.id, x: o.x, z: o.z });
      say(sim, `Rune geweiht: Der Titan ist um ${st.runes * 7} % geschwächt.`);
      removeObj(sim, o, 'used');
      return true;
    },
    bot: (sim, st, p) => { const o = objs(sim, 'rune')[0]; return o && p.aether > 60 + 6 * st.runes ? { type: 'mission', id: o.id } : null; },
    waveStart: (sim, st) => {
      for (const o of objs(sim, 'rune')) removeObj(sim, o, 'reset');
      if (!isBossWave(sim) || !st.runes) return;
      for (const c of bosses(sim)) { c.maxHp = c.hp = Math.round(c.hp * (1 - 0.07 * st.runes)); }
      say(sim, `Die Runen binden den Titan: −${st.runes * 7} % Leben!`);
    },
    text: (sim, st) => `${bossLine(st, sim)} · Runensteine (Bauphase, Äther) schwächen ihn: −${st.runes * 7} %`,
  },

  // 7 – Kraftknoten: Vasallen auf leuchtenden Feldern +50 % – sie wandern, sichtbar in der Bauphase
  nodes: {
    init: (sim, st) => MECHANICS.nodes.roll(sim, st),
    roll: (sim, st) => {
      for (const o of objs(sim, 'node')) removeObj(sim, o, 'moved');
      st.cells = new Set();
      const rows = sim.rules.gridRows || GRID_ROWS;
      while (st.cells.size < 4) st.cells.add(`${sim.rng.int(GRID_COLS)},${sim.rng.int(rows)}`);
      const p = lanePlayer(sim);
      for (const k of st.cells) { const [c, r] = k.split(',').map(Number); const cc = cellCenter(p.team, p.slot, c, r); spawnObj(sim, 'node', cc.x, cc.z); }
    },
    waveEnd: (sim, st) => { MECHANICS.nodes.roll(sim, st); say(sim, 'Das Wurzelnetz pulsiert neu – die Kraftknoten sind gewandert.'); },
    unitMul: (sim, st, f) => (st.cells && st.cells.has(`${f.col},${f.row}`) ? 1.5 : 1),
    text: (sim, st) => { let n = 0; for (const f of sim.fightersOf(lanePlayer(sim).id)) if (st.cells && st.cells.has(`${f.col},${f.row}`)) n++; return `Wurzelnetz: Vasallen auf Kraftknoten kämpfen mit +50 % · besetzt ${n}/4 – verkaufe und baue um!`; },
  },

  // 8 – Wetter: Vorhersage in der Bauphase, wirkt auf Angriffsarten
  weather: {
    W: [
      { name: 'Sporenregen', mod: { arkan: 1.35, klinge: 0.8 } },
      { name: 'Sturmböen', mod: { stich: 0.65, wucht: 1.25 } },
      { name: 'Glutwind', mod: { chaos: 1.3, arkan: 0.8 } },
      { name: 'Klarer Himmel', mod: {} },
    ],
    init: (sim, st) => { st.now = MECHANICS.weather.W[sim.rng.int(4)]; },
    waveEnd: (sim, st) => { st.now = MECHANICS.weather.W[sim.rng.int(4)]; say(sim, `Wettervorhersage für die nächste Welle: ${st.now.name}`); },
    dmgMul: (sim, st, src, tgt, atk) => (st.now && st.now.mod[atk]) || 1,
    text: (sim, st) => `${sim.phase === 'build' ? 'Vorhersage' : 'Wetter'}: ${st.now.name} – ${Object.entries(st.now.mod).map(([k, v]) => `${ATTACK_TYPES[k].name} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)} %`).join(', ') || 'keine Wirkung'}`,
  },

  // 9 – Verderber übernehmen Vasallen, wenn sie nicht betäubt werden
  corrupt: {
    waveStart: (sim) => {
      const p = lanePlayer(sim), w = sim.waveDef();
      const n = 1 + (wavesDone(sim) >= 4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const c = sim.spawnCreep(p.id, { ...w, key: 'verderber', model: 'witch', name: 'Verderber', hp: Math.round(w.hp * 2), bounty: w.bounty * 3, ranged: true, range: 6, palette: { primary: '#2a3a1a', secondary: '#6a2a8a', metal: '#5a5a3a', glow: '#b4ff3a' } }, laneX(sim) + (i ? 3 : -3), LANE_SPAWN_Z - 2, { bounty: w.bounty * 3, wave: true });
        c.corrupter = true; c.convT = 6;
      }
    },
    tick: (sim) => {
      if (!battle(sim)) return;
      for (const c of sim.entities.values()) {
        if (c.type !== 'c' || !c.corrupter || !c.alive) continue;
        if (c.mcast) {
          if (c.stun > 0) { c.mcast = null; sim.emit({ e: 'leaderInterrupt', id: c.id, ability: 'convert', x: c.x, z: c.z, lane: c.lane }); continue; }
          c.mcast -= DT;
          if (c.mcast <= 0) {
            c.mcast = null;
            let best = null, bd = 144;
            for (const f of sim.entities.values()) if (f.type === 'f' && f.alive && !f.converted && f.owner === 0 && !f.npc) { const d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2; if (d < bd) { bd = d; best = f; } }
            if (best) { best.converted = 8; say(sim, 'Ein Vasall wurde verderbt und kämpft gegen dich!'); sim.emit({ e: 'convert', id: best.id, x: best.x, z: best.z }); }
          }
          continue;
        }
        c.convT -= DT;
        if (c.convT <= 0) { c.convT = 11; c.mcast = 2.5; sim.emit({ e: 'leaderCast', id: c.id, ability: 'convert', name: 'Verderben', wind: 2.5, x: c.x, z: c.z, interruptible: true, lane: c.lane }); }
      }
    },
    text: () => 'Verderber-Schamanen übernehmen Vasallen – Betäubungen unterbrechen ihr „Verderben“, Fernkämpfer erreichen sie zuerst.',
  },

  // 10 – Käfige stürzen nach wenigen Sekunden ab: schnell anklicken
  rescue: {
    init: (sim, st) => { st.saved = 0; st.lost = 0; },
    waveStart: (sim, st) => { st.spawnAt = [3, 13]; },
    tick: (sim, st) => {
      if (!battle(sim)) return;
      if (st.spawnAt && st.spawnAt.length && sim.battleTime >= st.spawnAt[0]) {
        st.spawnAt.shift();
        spawnObj(sim, 'cage', laneX(sim) + sim.rng.range(-5, 5), sim.rng.range(-24, 6), { timer: 9, maxTimer: 9 });
        say(sim, 'Ein Käfig hängt über dem Riss – schnell anklicken!');
      }
      for (const o of objs(sim, 'cage')) {
        o.timer -= DT;
        if (o.timer <= 0) { st.lost++; say(sim, 'Zu spät – ein Käfig ist in den Riss gestürzt.'); removeObj(sim, o, 'lost'); }
      }
    },
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'cage',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'cage');
      if (!o) return 'Kein Käfig';
      st.saved++; p.gold += 20;
      say(sim, `Gefangene befreit (${st.saved}) +20 Gold`);
      removeObj(sim, o, 'freed');
      return true;
    },
    bot: (sim) => { const o = objs(sim, 'cage')[0]; return o && sim.rng.next() < 0.5 ? { type: 'mission', id: o.id } : null; },
    waveEnd: (sim) => { for (const o of objs(sim, 'cage')) removeObj(sim, o, 'lost'); },
    final: (sim, st) => (st.saved >= st.cfg.need ? { winner: 0, reason: `${st.saved} Gefangene befreit` } : { winner: 1, reason: `Nur ${st.saved} von ${st.cfg.need} Gefangenen befreit` }),
    text: (sim, st) => `Rettung: ${st.saved} befreit (Ziel ${st.cfg.need}) · ${st.lost} verloren · Käfige stürzen nach 9 s ab – anklicken!`,
  },

  // 11 – Dornenfürst flieht: Klick legt eine Wurzelfalle (Abklingzeit)
  chase: {
    init: (sim, st) => { st.caught = 0; st.escaped = 0; st.rootReady = 0; },
    waveStart: (sim) => {
      const w = sim.waveDef();
      const c = sim.spawnCreep(lanePlayer(sim).id, { ...w, key: 'dornenfuerst', model: 'serpent', name: 'Dornenfürst', hp: Math.round(w.hp * w.count * 0.22), bounty: w.bounty * 6, size: 1.5, leader: false, palette: { primary: '#2a4a1a', secondary: '#8aff3a', metal: '#6a5a2a', glow: '#c8ff4a' } }, laneX(sim), BUILD_Z0 - 2, { bounty: w.bounty * 6, wave: true });
      c.fleeing = true;
      say(sim, 'Der Dornenfürst flieht zum Portal – klicke ihn an, um ihn mit Wurzeln festzuhalten!');
    },
    tick: (sim, st) => {
      if (!battle(sim)) return;
      for (const c of sim.entities.values()) {
        if (c.type !== 'c' || !c.fleeing || !c.alive) continue;
        if (c.stun > 0 || (c.rootT || 0) > 0) continue;
        c.z -= 2.3 * (1 - (c.slowPct || 0)) * DT; c.moving = sim.tick; c.face = Math.PI;
        if (c.z <= LANE_SPAWN_Z - 3) { st.escaped++; c.alive = false; sim.entities.delete(c.id); sim.emit({ e: 'objDone', id: c.id, kind: 'flee', reason: 'escaped', x: c.x, z: c.z }); say(sim, 'Der Dornenfürst ist entkommen!'); }
      }
    },
    clickable: (sim, st, e) => e.type === 'c' && !!e.fleeing,
    command: (sim, st, p, cmd) => {
      const c = cmd.id != null && sim.entities.get(cmd.id);
      if (!c || !c.fleeing || !c.alive) return 'Kein Ziel';
      if (sim.time < st.rootReady) return `Wurzelfalle lädt noch (${Math.ceil(st.rootReady - sim.time)} s)`;
      st.rootReady = sim.time + 10;
      c.rootT = 2.5;
      sim.emit({ e: 'root', id: c.id, x: c.x, z: c.z });
      sim.emit({ e: 'stun', id: c.id });
      return true;
    },
    bot: (sim, st) => { if (sim.time < st.rootReady) return null; for (const c of sim.entities.values()) if (c.type === 'c' && c.fleeing && c.alive && c.z < BUILD_Z0 - 6) return { type: 'mission', id: c.id }; return null; },
    onKill: (sim, st, e) => { if (e.fleeing) { st.caught++; say(sim, `Dornenfürst gestellt (${st.caught})!`); } },
    final: (sim, st) => (st.caught >= st.cfg.need ? { winner: 0, reason: `Dornenfürst ${st.caught}× gestellt` } : { winner: 1, reason: `Der Dornenfürst ist ${st.escaped}× entkommen` }),
    text: (sim, st) => `Verfolgung: ${st.caught} gestellt · ${st.escaped} entkommen (Ziel ${st.cfg.need}) · Wurzelfalle ${sim.time < st.rootReady ? `in ${Math.ceil(st.rootReady - sim.time)} s` : 'bereit – Dornenfürst anklicken'}`,
  },

  // 12 – Aschendrachin: Feueratem trifft die am dichtesten besetzte Spalte deines Rasters
  drake: {
    tick: (sim, st) => {
      resolveTelegraphs(sim, st);
      if (!battle(sim)) return;
      st.breathT = (st.breathT ?? 6) - DT;
      if (st.breathT > 0) return;
      st.breathT = isBossWave(sim) ? 6 : 10;
      const p = lanePlayer(sim);
      const cnt = new Array(GRID_COLS).fill(0);
      for (const f of sim.fightersOf(p.id)) if (f.col >= 0) cnt[f.col]++;
      let col = 0; for (let c = 1; c < GRID_COLS; c++) if (cnt[c] > cnt[col]) col = c;
      const x = cellCenter(p.team, p.slot, col, 0).x;
      telegraph(sim, st, { shape: 'line', x, z: LANE_SPAWN_Z + 2, x2: x, z2: LANE_END_Z - 2, w: CELL * 1.2, t: 2.2, dmg: 90 * Math.pow(1.13, sim.wave - 1), own: true });
      say(sim, `Die Drachin holt Luft – Feuerschneise über Spalte ${col + 1}!`);
    },
    text: (sim, st) => `${bossLine(st, sim)} · Ihr Feueratem trifft die dichteste Spalte deines Rasters – baue breit gestreut.`,
  },

  // 13 – Sandsturm
  sandstorm: {
    dmgMul: (sim, st, src) => (src && src.type === 'f' && UNITS[src.def] && UNITS[src.def].ranged ? 0.6 : 1),
    text: () => 'Sandsturm: Fernkampf-Vasallen treffen 40 % schwächer, Gegner laufen schneller – setze auf Nahkampf.',
  },

  // 14 – Lavaschlote treffen alle
  lava: {
    tick: (sim, st) => { resolveTelegraphs(sim, st); if (battle(sim)) lavaTick(sim, st); },
    text: () => 'Lavaschlote brechen aus: Bodenwarnungen treffen ALLE im Kreis – auch deine Vasallen.',
  },

  // 15 – Verrat: Vasallen laufen über – ein Treueschwur (Gold) schützt ausgewählte
  betrayal: {
    init: (sim, st) => { st.oaths = 0; },
    waveStart: (sim, st) => {
      if (!st.cfg.waves.includes(wavesDone(sim) + 1)) return;
      const own = sim.fightersOf(lanePlayer(sim).id).filter((f) => !f.loyal);
      st.defected = [];
      for (let i = 0; i < Math.min(2, own.length); i++) {
        const f = own.splice(sim.rng.int(own.length), 1)[0];
        const d = UNITS[f.def];
        f.alive = false; f.defected = true; st.defected.push(f.id);
        const c = sim.spawnCreep(lanePlayer(sim).id, { key: `def_${d.id}`, id: undefined, n: sim.wave, name: `Überläufer: ${d.name}`, model: d.model, hp: d.hp, dmg: d.dmg, cd: d.cd, range: d.range, speed: d.speed, armor: d.armor, armorType: d.armorType, atk: d.atk, ranged: d.ranged, bounty: Math.round(d.value * 0.3), palette: { primary: '#2a1a1a', secondary: '#ff3a3a', metal: '#5a4a4a', glow: '#ff2a2a' }, size: 1 }, f.x, f.z, { bounty: Math.round(d.value * 0.3), wave: true });
        c.defector = f.id;
      }
      if (st.defected.length) say(sim, `Verrat! ${st.defected.length} deiner Vasallen laufen zu Orrik über.`);
    },
    waveEnd: (sim, st) => { for (const id of st.defected || []) { const f = sim.entities.get(id); if (f) f.defected = false; } st.defected = []; },
    actions: (sim, st, ctx) => {
      const f = ctx && ctx.selectedId != null && sim.entities.get(ctx.selectedId);
      if (!f || f.type !== 'f' || f.owner !== 0 || f.summon) return [];
      return [{ id: 'oath', label: f.loyal ? 'Treue geschworen ✓' : 'Treueschwur', cost: '40 Gold', disabled: f.loyal || sim.phase !== 'build' || st.oaths >= 4, cmd: { type: 'mission', action: 'oath', id: f.id } }];
    },
    command: (sim, st, p, cmd) => {
      if (cmd.action !== 'oath') return 'Unbekannte Aktion';
      const f = sim.entities.get(cmd.id);
      if (!f || f.type !== 'f' || f.owner !== p.id || f.summon) return 'Keine eigene Einheit';
      if (sim.phase !== 'build') return 'Treueschwur nur in der Bauphase';
      if (f.loyal) return 'Dieser Vasall ist bereits treu';
      if (st.oaths >= 4) return 'Höchstens 4 Treueschwüre';
      const r = pay(p, 'gold', 40, 'den Treueschwur');
      if (r !== true) return r;
      f.loyal = true; st.oaths++;
      sim.emit({ e: 'objLit', id: f.id, x: f.x, z: f.z });
      return true;
    },
    bot: (sim, st, p) => { if (sim.phase !== 'build' || st.oaths >= 4 || p.gold < 200) return null; const f = sim.fightersOf(p.id).filter((x) => !x.loyal).sort((a, b) => UNITS[b.def].value - UNITS[a.def].value || a.id - b.id)[0]; return f ? { type: 'mission', action: 'oath', id: f.id } : null; },
    text: (sim, st) => { const next = st.cfg.waves.find((w) => w > wavesDone(sim) + (sim.phase === 'battle' ? 1 : 0)); return `Verrat am Tor: ${next ? `In Welle ${sim.rules.startWave + next - 1} laufen 2 Vasallen über` : 'Keine Überläufer mehr'} · Treueschwüre ${st.oaths}/4 (Vasall anklicken)`; },
  },

  // 16 – Kristallpfeiler mit Äther laden: Vasallen in der Nähe +40 % Angriffstempo
  pylons: {
    init: (sim, st) => MECHANICS.pylons.place(sim),
    place: (sim) => {
      for (const o of objs(sim, 'pylon')) removeObj(sim, o, 'reset');
      const lx = laneX(sim);
      for (const [dx, z] of [[-5, -16], [5, -6], [0, 4]]) spawnObj(sim, 'pylon', lx + dx, z, { lit: false });
    },
    tick: (sim) => {
      for (const o of objs(sim, 'pylon')) if (o.lit) for (const f of sim.entities.values()) if (f.type === 'f' && f.alive && near(f, o, 8)) { f.hbHaste = Math.max(f.hbHaste || 0, 0.4); f.hbT = Math.max(f.hbT || 0, 0.2); }
    },
    waveEnd: (sim) => MECHANICS.pylons.place(sim),
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'pylon' && !e.lit,
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'pylon');
      if (!o) return 'Kein Kristallpfeiler';
      if (o.lit) return 'Der Pfeiler ist schon geladen';
      const r = pay(p, 'aether', 25, 'den Pfeiler');
      if (r !== true) return r;
      o.lit = true;
      sim.emit({ e: 'objLit', id: o.id, x: o.x, z: o.z });
      say(sim, 'Kristallpfeiler geladen: Vasallen in der Nähe greifen 40 % schneller an!');
      return true;
    },
    bot: (sim, st, p) => { const o = objs(sim, 'pylon').find((x) => !x.lit); return o && p.aether >= 60 ? { type: 'mission', id: o.id } : null; },
    text: (sim) => `Kristallpfeiler: ${objs(sim, 'pylon').filter((o) => o.lit).length}/3 geladen · Klick lädt einen Pfeiler (25 Äther, bis Wellenende)`,
  },

  // 17 – Belagerung: Rammböcke bauen, die mit der Welle gegen die Feste rollen
  ram: {
    init: (sim, st) => { st.queued = 0; st.built = 0; },
    actions: (sim, st) => [{ id: 'ram', label: st.queued ? 'Rammbock bereit ✓' : 'Rammbock bauen', cost: `${MECHANICS.ram.cost(sim)} Gold`, disabled: sim.phase !== 'build' || st.queued > 0, cmd: { type: 'mission', action: 'ram' } }],
    cost: (sim) => 120 + 15 * wavesDone(sim),
    command: (sim, st, p, cmd) => {
      if (cmd.action !== 'ram') return 'Unbekannte Aktion';
      if (sim.phase !== 'build') return 'Rammböcke nur in der Bauphase';
      if (st.queued) return 'Ein Rammbock pro Welle';
      const r = pay(p, 'gold', MECHANICS.ram.cost(sim), 'den Rammbock');
      if (r !== true) return r;
      st.queued = 1;
      say(sim, 'Ein Rammbock rollt mit der nächsten Welle gegen die Feste.');
      return true;
    },
    bot: (sim, st, p) => (sim.phase === 'build' && !st.queued && p.gold > 400 ? { type: 'mission', action: 'ram' } : null),
    waveStart: (sim, st) => {
      if (!st.queued) return;
      st.queued = 0; st.built++;
      const k = sim.teams[1].king;
      const def = { key: 'ram', id: 'ram', name: 'Rammbock', model: 'beetle', hp: 2500 + 260 * wavesDone(sim), dmg: 60, cd: 1.6, range: 1.6, speed: 2.4, armor: 5, armorType: 'festung', atk: 'wucht', cost: 260, size: 1.6, palette: { primary: '#4a3a2a', secondary: '#c08a3a', metal: '#8a7a6a', glow: '#ffb84a' } };
      const c = sim.spawnCreep(sim.players[0].id, def, k.x, k.z - 34, { bounty: 0, wave: false });
      c.team = 1; c.stage = 'king'; c.siege = true;
    },
    text: (sim, st) => `Belagerung: ${st.built} Rammböcke ausgerückt · Rammbock (Bauphase) trifft die Feste mit ${260 * (sim.campaign?.impactMul || 14)} Wucht`,
  },

  // 18 – Orriks Koloss: Dampfventile rechtzeitig ablassen senkt seine Panzerung
  colossus: {
    init: (sim, st) => { st.vented = 0; st.burst = 0; },
    waveStart: (sim, st) => {
      st.spawnAt = isBossWave(sim) ? [] : [4, 14];
      if (isBossWave(sim)) {
        const add = Math.max(0, 8 - st.vented);
        for (const c of bosses(sim)) c.def = { ...c.def, armor: c.def.armor + add };
        say(sim, add ? `Orriks Panzer: +${add} Rüstung (${st.vented} Ventile abgelassen)` : 'Alle Ventile offen – der Koloss ist ungeschützt!');
      }
    },
    tick: (sim, st) => {
      resolveTelegraphs(sim, st);
      if (!battle(sim)) return;
      if (st.spawnAt && st.spawnAt.length && sim.battleTime >= st.spawnAt[0]) {
        st.spawnAt.shift();
        const o = spawnObj(sim, 'valve', laneX(sim) + sim.rng.range(-5, 5), sim.rng.range(-14, 6), { timer: 7, maxTimer: 7 });
        sim.emit({ e: 'telegraph', shape: 'circle', x: o.x, z: o.z, r: 3.5, dur: 7, lane: 0, hazard: true });
      }
      for (const o of objs(sim, 'valve')) {
        o.timer -= DT;
        if (o.timer > 0) continue;
        st.burst++;
        for (const f of [...sim.entities.values()]) if (f.type === 'f' && f.alive && !f.npc && near(f, o, 3.5)) sim.applyHit({ type: 'env', alive: false }, f, 110 * Math.pow(1.13, sim.wave - 1), 'chaos', false);
        sim.emit({ e: 'splash', x: o.x, z: o.z, r: 3.5, atk: 'chaos' });
        say(sim, 'Ein Dampfventil ist geplatzt!');
        removeObj(sim, o, 'burst');
      }
    },
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'valve',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'valve');
      if (!o) return 'Kein Ventil';
      st.vented++;
      say(sim, `Ventil abgelassen (${st.vented}) – Orriks Koloss verliert Panzerung.`);
      removeObj(sim, o, 'vented');
      return true;
    },
    bot: (sim) => { const o = objs(sim, 'valve')[0]; return o && sim.rng.next() < 0.4 ? { type: 'mission', id: o.id } : null; },
    waveEnd: (sim) => { for (const o of objs(sim, 'valve')) removeObj(sim, o, 'reset'); },
    text: (sim, st) => `${bossLine(st, sim)} · Ventile abgelassen: ${st.vented} (je −1 Rüstung, max. 8) – Ventile anklicken, bevor sie platzen`,
  },

  // 19 – Schatten: nur Lichtträger (Heiler/Unterstützer) und Leuchtkugeln machen Gegner sichtbar
  shadows: {
    init: (sim, st) => { st.flareReady = 0; },
    tick: (sim) => { for (const o of objs(sim, 'flare')) { o.timer -= DT; if (o.timer <= 0) removeObj(sim, o, 'faded'); } },
    canTarget: (sim, st, f, c) => {
      if ((c.x - f.x) ** 2 + (c.z - f.z) ** 2 < 6.25 || c.cursePct > 0) return true;
      for (const o of objs(sim, 'flare')) if (near(o, c, 8)) return true;
      for (const l of sim.fightersOf(0)) { const r = UNITS[l.def].role; if ((r === 'healer' || r === 'support') && l.alive && near(l, c, 7)) return true; }
      return false;
    },
    actions: (sim, st) => [{ id: 'flare', label: 'Leuchtkugel', cost: sim.time < st.flareReady ? `${Math.ceil(st.flareReady - sim.time)} s` : 'bereit', disabled: sim.phase !== 'battle' || sim.time < st.flareReady, target: 'ground', cmd: { type: 'mission', action: 'flare' } }],
    command: (sim, st, p, cmd) => {
      if (cmd.action !== 'flare') return 'Unbekannte Aktion';
      if (sim.phase !== 'battle') return 'Leuchtkugeln nur im Kampf';
      if (sim.time < st.flareReady) return 'Leuchtkugel lädt noch';
      const x = +cmd.x, z = +cmd.z;
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x - laneX(sim)) > 12 || z < LANE_SPAWN_Z - 6 || z > LANE_END_Z + 2) return 'Leuchtkugel nur über deiner Bahn';
      st.flareReady = sim.time + 9;
      spawnObj(sim, 'flare', x, z, { timer: 6, maxTimer: 6 });
      return true;
    },
    bot: (sim, st) => {
      if (sim.phase !== 'battle' || sim.time < st.flareReady) return null;
      let best = null; for (const c of sim.entities.values()) if (c.type === 'c' && c.alive && c.stage === 'lane' && (!best || c.z > best.z)) best = c;
      return best ? { type: 'mission', action: 'flare', x: Math.round(best.x * 10) / 10, z: Math.round(best.z * 10) / 10 } : null;
    },
    text: (sim, st) => `Schatten: Gegner nur sichtbar nahe Heilern/Unterstützern (7 m), verflucht oder im Leuchtkugel-Licht · Leuchtkugel ${sim.time < st.flareReady ? `in ${Math.ceil(st.flareReady - sim.time)} s` : 'bereit'}`,
  },

  // 20 – Spiegelwelt
  mirror: {
    waveStart: (sim) => {
      const own = sim.fightersOf(lanePlayer(sim).id).map((f) => UNITS[f.def]);
      if (!own.length) return;
      let i = 0;
      for (const c of sim.entities.values()) {
        if (c.type !== 'c' || c.isSend || c.def.leader || c.def.boss) continue;
        const u = own[(i++) % own.length];
        c.def = { ...c.def, key: `mir_${u.id}`, model: u.model, atk: u.atk, armorType: u.armorType, ranged: u.ranged, range: u.ranged ? Math.min(6, u.range) : c.def.range, name: `Spiegelbild: ${u.name}`, palette: { primary: '#1a1a2a', secondary: '#9a9aff', metal: '#6a6a8a', glow: '#b0b0ff' } };
      }
      say(sim, 'Die Welle spiegelt deine eigenen Vasallen – mit deinen Schwächen.');
    },
    text: () => 'Spiegelwelt: Gegner kopieren Angriffs- und Rüstungsart deiner Vasallen – mische deine Armee.',
  },

  // 21 – Zerfallende Zeit
  timedecay: {
    waveEnd: (sim) => {
      sim.rules.buildTime = Math.max(10, Math.round(sim.rules.buildTime * 0.78));
      const p = lanePlayer(sim); p.gold += p.income;
      say(sim, `Die Zeit zerfällt: nur noch ${sim.rules.buildTime} s Bauzeit – doppeltes Einkommen (+${p.income}).`);
    },
    text: (sim) => `Zerfallende Zeit: Bauzeit ${sim.rules.buildTime} s (schrumpft) · Einkommen doppelt`,
  },

  // 22 – Letzte Bastion
  lastbastion: {
    init: (sim) => { const k = sim.teams[0].king; k.heals = 2; k.maxHeals = 2; },
    allow: (sim, st, p, cmd) => (cmd.type === 'king' ? 'In der letzten Bastion gibt es keine Verbesserungen' : true),
    text: () => 'Letzte Bastion: keine König-Verbesserungen, nur 2 Heilungen.',
  },

  // 23 – Varos Wahl: Pakte (Gold gegen stärkere Wellen) und Varo als Anführer der letzten Welle
  duel: {
    init: (sim, st) => { st.pacts = 0; st.pactNext = false; st.varoDown = false; st.varoSpawned = false; },
    pactGold: (sim) => 60 + 12 * wavesDone(sim),
    actions: (sim, st) => (isBossWave(sim) ? [] : [{ id: 'pact', label: st.pactNext ? 'Pakt geschlossen ✓' : 'Varos Pakt annehmen', cost: `+${MECHANICS.duel.pactGold(sim)} Gold · Welle +20 %`, disabled: sim.phase !== 'build' || st.pactNext, cmd: { type: 'mission', action: 'pact' } }]),
    command: (sim, st, p, cmd) => {
      if (cmd.action !== 'pact') return 'Unbekannte Aktion';
      if (sim.phase !== 'build') return 'Pakte nur in der Bauphase';
      if (st.pactNext) return 'Ein Pakt pro Welle';
      if (isBossWave(sim)) return 'Varo bietet keinen Pakt mehr an';
      st.pactNext = true; st.pacts++;
      p.gold += MECHANICS.duel.pactGold(sim);
      say(sim, 'Pakt geschlossen: Gold für dich – die nächste Welle wird stärker.');
      return true;
    },
    bot: (sim, st, p) => (sim.phase === 'build' && !st.pactNext && !isBossWave(sim) && p.gold < 150 && sim.teams[0].king.hp > sim.teams[0].king.maxHp * 0.8 ? { type: 'mission', action: 'pact' } : null),
    waveStart: (sim, st) => {
      if (st.pactNext) {
        for (const c of sim.entities.values()) if (c.type === 'c' && !c.isSend && c.lane === 0) { c.maxHp = c.hp = Math.round(c.hp * 1.2); }
        st.pactNext = false;
      }
      if (isBossWave(sim) && !st.varoSpawned) {
        st.varoSpawned = true;
        const w = sim.waveDef();
        const c = sim.spawnCreep(lanePlayer(sim).id, { ...w, boss: false, key: 'varo', model: 'knightfallen', name: 'Varo Glutklinge', hp: Math.round(w.hp * 0.5), dmg: w.dmg * 0.8, armor: w.armor + 2, speed: w.speed * 0.9, size: 1.35, leader: false, palette: { primary: '#3a0a12', secondary: '#ff4a2a', metal: '#6a5a5a', glow: '#ff7a3a' } }, laneX(sim), LANE_SPAWN_Z - 6, { bounty: w.bounty * 4, wave: true });
        c.varo = true;
        say(sim, 'Varo stellt sich dir in den Weg – bezwinge ihn!');
      }
    },
    onKill: (sim, st, e) => { if (e.varo) { st.varoDown = true; say(sim, 'Varo ist bezwungen. Er legt die Klinge nieder – und wählt Aethra.'); } },
    final: (sim, st) => (st.varoDown ? { winner: 0, reason: `Varo bezwungen (${st.pacts} Pakte geschlossen)` } : { winner: 1, reason: 'Varo ist entkommen' }),
    text: (sim, st) => (isBossWave(sim) ? `Duell: Varo führt die letzte Welle – ${st.varoDown ? 'bezwungen ✓' : 'bezwinge ihn!'}` : `Varos Wahl: Pakte ${st.pacts} · Jeder Pakt bringt Gold, macht aber die nächste Welle 20 % stärker`),
  },

  // 24 – Vael’Thar: Risskerne schirmen Gegner ab und müssen mit Äther zerschlagen werden; Lava im Finale
  riftlord: {
    init: (sim, st) => { st.shattered = 0; },
    waveStart: (sim, st) => {
      const lx = laneX(sim);
      const n = isBossWave(sim) ? 3 : 2;
      for (let i = 0; i < n; i++) spawnObj(sim, 'riftcore', lx + sim.rng.range(-5, 5), sim.rng.range(-24, -4));
    },
    tick: (sim, st) => { resolveTelegraphs(sim, st); if (battle(sim) && isBossWave(sim)) lavaTick(sim, st, 7); },
    dmgMul: (sim, st, src, tgt) => { if (tgt.type !== 'c') return 1; for (const o of objs(sim, 'riftcore')) if (near(o, tgt, 5)) return 0.6; return 1; },
    clickable: (sim, st, e) => e.type === 'o' && e.kind === 'riftcore',
    command: (sim, st, p, cmd) => {
      const o = objFor(sim, cmd, 'riftcore');
      if (!o) return 'Kein Risskern';
      const r = pay(p, 'aether', 30, 'den Risskern');
      if (r !== true) return r;
      st.shattered++;
      say(sim, 'Risskern zerschlagen!');
      removeObj(sim, o, 'shattered');
      return true;
    },
    bot: (sim, st, p) => { const o = objs(sim, 'riftcore')[0]; return o && p.aether >= 50 ? { type: 'mission', id: o.id } : null; },
    waveEnd: (sim) => { for (const o of objs(sim, 'riftcore')) removeObj(sim, o, 'reset'); },
    text: (sim, st) => `${bossLine(st, sim)} · Risskerne schirmen Gegner in 5 m ab (−40 % Schaden) – anklicken (30 Äther) · zerschlagen: ${st.shattered}${isBossWave(sim) ? ' · Lavaschlote!' : ''}`,
  },
};
// Hilfsfunktionen stehen in MECHANICS (roll/place/cost/W/pactGold) – keine Hooks.
const HOOKS = new Set(['init', 'waveStart', 'waveEnd', 'tick', 'onKill', 'canTarget', 'dmgMul', 'unitMul', 'allow', 'final', 'text', 'command', 'clickable', 'actions', 'bot']);

export function createMission(cfg) {
  const m = MECHANICS[cfg.mechanic];
  if (!m) return null;
  return { m, st: { cfg } };
}
export function missionHook(sim, name, ...args) {
  const mi = sim.mission;
  if (!mi || !HOOKS.has(name) || !mi.m[name]) return undefined;
  return mi.m[name](sim, mi.st, ...args);
}
