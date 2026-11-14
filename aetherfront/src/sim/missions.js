// Missions-Mechaniken der Kampagne – jede Mission hat eine Mechanik, die es nur dort gibt.
// Deterministisch (sim.rng), angebunden über Hooks der Simulation:
//   init, waveStart, waveEnd, tick, onKill, canTarget(f,c), dmgMul(src,tgt,atk), allow(p,cmd), final(), text()
// Missions-Objekte (Funken, Leuchtfeuer, Käfige, Pfeiler, Kraftknoten) sind Entitäten vom Typ 'o'.
import { UNITS, ATTACK_TYPES } from './data.js';
import { LANE_SPAWN_Z, LANE_END_Z, BUILD_Z0, CELL, GRID_COLS, GRID_ROWS, cellCenter } from './layout.js';

const DT = 1 / 20;

function lanePlayer(sim) { return sim.players[0]; }
function heroOf(sim) { const p = lanePlayer(sim); return p.heroEnt ? sim.entities.get(p.heroEnt) : null; }
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

/** Hilfsfunktion: Held lädt ein Objekt auf, indem er daneben steht */
function chargeByHero(sim, o, r, need) {
  const h = heroOf(sim);
  if (h && h.alive && near(h, o, r)) {
    o.charge += DT;
    if (o.charge >= need) return true;
  } else o.charge = Math.max(0, o.charge - DT * 0.5);
  return false;
}

export const MECHANICS = {
  tutorial: {
    text: (sim) => {
      const p = lanePlayer(sim), w = wavesDone(sim);
      if (sim.phase === 'build' && sim.armyValue(p.id) === 0) return 'Bauphase: Wähle unten einen Vasallen (Q) und setze ihn auf das leuchtende Raster.';
      if (sim.phase === 'build' && w === 0) return 'Setze weitere Vasallen, dann drücke ↵ „Bereit“.';
      if (sim.phase === 'battle' && w === 0) return 'Kampf! Du steuerst deinen Helden: W/S laufen, A/D drehen, Q/E seitwärts, rechte Maustaste lenkt.';
      if (sim.phase === 'battle' && w === 1) return 'Tab wählt den nächsten Gegner, Rechtsklick greift an, 1–5 sind deine Fähigkeiten.';
      if (sim.phase === 'build' && w === 2) return 'Klicke einen Vasallen an und werte ihn auf – jede Stufe hat zwei Pfade.';
      if (sim.phase === 'build' && w >= 3) return 'Funken (B) sammeln Äther. Mit Äther schickst du Söldner (1–7) und erhöhst dein Einkommen.';
      return `Halte die Bahn: noch ${sim.rules.maxWaves - sim.wave + (sim.phase === 'build' ? 1 : 0)} Wellen.`;
    },
  },

  shards: {
    init: (sim, st) => { st.count = 0; },
    waveStart: (sim, st) => {
      const lx = laneX(sim);
      for (let i = 0; i < 3; i++) spawnObj(sim, 'shard', lx + sim.rng.range(-5, 5), sim.rng.range(-26, 4));
    },
    tick: (sim, st) => {
      const h = heroOf(sim);
      for (const o of objs(sim, 'shard')) if (h && h.alive && near(h, o, 1.8)) {
        st.count++; lanePlayer(sim).aether += 15;
        sim.emit({ e: 'objective', text: `Ätherfunke ${st.count}/${st.cfg.need} eingesammelt (+15 Äther)` });
        removeObj(sim, o, 'collected');
      }
    },
    waveEnd: (sim) => { for (const o of objs(sim, 'shard')) removeObj(sim, o, 'faded'); },
    final: (sim, st) => (st.count >= st.cfg.need ? { winner: 0, reason: `Alle Wellen gehalten und ${st.count} Funken gesammelt` } : { winner: 1, reason: `Nur ${st.count} von ${st.cfg.need} Ätherfunken gesammelt` }),
    text: (sim, st) => `Ätherfunken: ${st.count}/${st.cfg.need} · Held läuft über die leuchtenden Splitter`,
  },

  collapse: {
    init: (sim, st) => { st.rows = new Set(); sim.blockedRows = st.rows; },
    waveEnd: (sim, st) => {
      const w = wavesDone(sim) + 1;
      if (!st.cfg.at.includes(w)) return;
      const row = st.rows.size; // vorderste noch intakte Reihe
      st.rows.add(row);
      let refund = 0;
      for (const f of sim.fightersOf(lanePlayer(sim).id)) if (f.row === row) { refund += UNITS[f.def].value; sim.entities.delete(f.id); sim.emit({ e: 'death', id: f.id, x: f.x, z: f.z, type: 'f', model: UNITS[f.def].model }); }
      lanePlayer(sim).gold += refund;
      sim.emit({ e: 'collapse', row, refund });
      sim.emit({ e: 'objective', text: `Die Brücke bröckelt! Reihe ${row + 1} ist abgestürzt${refund ? ` – ${refund} Gold erstattet` : ''}.` });
    },
    text: (sim, st) => `Die Brücke bröckelt: ${st.rows.size} Reihe(n) abgestürzt – baue weiter hinten.`,
  },

  night: {
    waveStart: (sim) => {
      const lx = laneX(sim);
      for (const [dx, z] of [[-4, -22], [4, -12], [-3, -1]]) spawnObj(sim, 'beacon', lx + dx, z, { lit: false });
    },
    tick: (sim) => {
      for (const o of objs(sim, 'beacon')) if (!o.lit && chargeByHero(sim, o, 3, 1.5)) { o.lit = true; sim.emit({ e: 'objLit', id: o.id, x: o.x, z: o.z }); sim.emit({ e: 'objective', text: 'Leuchtfeuer entzündet!' }); }
    },
    waveEnd: (sim) => { for (const o of objs(sim, 'beacon')) removeObj(sim, o, 'night'); },
    canTarget: (sim, st, f, c) => {
      if ((c.x - f.x) ** 2 + (c.z - f.z) ** 2 < 9) return true;
      const h = heroOf(sim);
      if (h && h.alive && near(h, c, 7)) return true;
      for (const o of objs(sim, 'beacon')) if (o.lit && near(o, c, 9)) return true;
      return false;
    },
    text: (sim) => { const lit = objs(sim, 'beacon').filter((o) => o.lit).length; return sim.phase === 'battle' ? `Nacht: Vasallen sehen nur im Licht · Leuchtfeuer ${lit}/3 – Held: daneben stehen` : 'Nacht bricht herein. In der Kampfphase entzündet dein Held die Leuchtfeuer.'; },
  },

  escort: {
    init: (sim, st) => { st.saved = 0; st.lost = 0; },
    waveStart: (sim, st) => {
      if (!st.cfg.waves.includes(wavesDone(sim) + 1)) return;
      const p = lanePlayer(sim), lx = laneX(sim);
      for (let i = 0; i < 2; i++) {
        const f = sim.spawnFighter(p, UNITS.orden_priest_1, -1, -1, lx + (i ? 1.5 : -1.5), LANE_SPAWN_Z + 6 - i * 2);
        f.summon = true; f.npc = true; f.maxHp = f.hp = Math.round(500 * Math.pow(1.13, sim.wave - 1));
        sim.emit({ e: 'objective', text: 'Pilger betreten die Bahn – beschütze sie bis zum König!' });
      }
    },
    tick: (sim, st) => {
      if (sim.phase !== 'battle' || sim.freeze > 0) return;
      for (const f of sim.entities.values()) {
        if (f.type !== 'f' || !f.npc) continue;
        if (!f.alive) { st.lost++; sim.entities.delete(f.id); sim.emit({ e: 'objective', text: 'Ein Pilger ist gefallen!' }); continue; }
        f.z += 1.6 * DT; f.moving = sim.tick; f.face = 0;
        if (f.z >= LANE_END_Z - 1) { st.saved++; sim.entities.delete(f.id); sim.emit({ e: 'objDone', id: f.id, kind: 'pilgrim', reason: 'saved', x: f.x, z: f.z }); sim.emit({ e: 'objective', text: `Pilger in Sicherheit (${st.saved})` }); }
      }
    },
    final: (sim, st) => (st.lost <= st.cfg.maxLost ? { winner: 0, reason: `${st.saved} Pilger gerettet` } : { winner: 1, reason: `${st.lost} Pilger verloren` }),
    text: (sim, st) => `Eskorte: ${st.saved} gerettet · ${st.lost} verloren (höchstens ${st.cfg.maxLost})`,
  },

  boss: {
    text: (sim, st) => (sim.wave >= sim.rules.maxWaves ? `${st.cfg.name}: Stelle dich mit deinem Helden dem Boss – weiche den Bodenwarnungen aus!` : `Halte durch bis ${st.cfg.name} erscheint (Welle ${sim.rules.maxWaves}).`),
  },

  nodes: {
    waveStart: (sim, st) => {
      for (const o of objs(sim, 'node')) removeObj(sim, o, 'moved');
      st.cells = new Set();
      while (st.cells.size < 4) st.cells.add(`${sim.rng.int(GRID_COLS)},${sim.rng.int(GRID_ROWS)}`);
      const p = lanePlayer(sim);
      for (const k of st.cells) { const [c, r] = k.split(',').map(Number); const cc = cellCenter(p.team, p.slot, c, r); spawnObj(sim, 'node', cc.x, cc.z); }
    },
    unitMul: (sim, st, f) => (st.cells && st.cells.has(`${f.col},${f.row}`) ? 1.5 : 1),
    text: () => 'Wurzelnetz: Vasallen auf leuchtenden Kraftknoten kämpfen mit +50 % – die Knoten wandern jede Welle.',
  },

  weather: {
    waveStart: (sim, st) => {
      const W = [
        { name: 'Sporenregen', mod: { arkan: 1.35, klinge: 0.8 } },
        { name: 'Sturmböen', mod: { stich: 0.65, wucht: 1.25 } },
        { name: 'Glutwind', mod: { chaos: 1.3, arkan: 0.8 } },
        { name: 'Klarer Himmel', mod: {} },
      ];
      st.now = W[sim.rng.int(W.length)];
      sim.emit({ e: 'objective', text: `Wetter: ${st.now.name}` });
    },
    dmgMul: (sim, st, src, tgt, atk) => (st.now && st.now.mod[atk]) || 1,
    text: (sim, st) => (st.now ? `Wetter: ${st.now.name} – ${Object.entries(st.now.mod).map(([k, v]) => `${ATTACK_TYPES[k].name} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)} %`).join(', ') || 'keine Wirkung'}` : 'Das Wetter wechselt mit jeder Welle.'),
  },

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
      if (sim.phase !== 'battle' || sim.freeze > 0) return;
      for (const c of sim.entities.values()) {
        if (c.type !== 'c' || !c.corrupter || !c.alive) continue;
        if (c.mcast) {
          if (c.stun > 0) { c.mcast = null; sim.emit({ e: 'leaderInterrupt', id: c.id, ability: 'convert', x: c.x, z: c.z, lane: c.lane }); continue; }
          c.mcast -= DT;
          if (c.mcast <= 0) {
            c.mcast = null;
            let best = null, bd = 144;
            for (const f of sim.entities.values()) if (f.type === 'f' && f.alive && !f.converted && f.owner === 0 && !f.npc) { const d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2; if (d < bd) { bd = d; best = f; } }
            if (best) { best.converted = 8; sim.emit({ e: 'objective', text: `Ein Vasall wurde verderbt und kämpft gegen dich!` }); sim.emit({ e: 'convert', id: best.id, x: best.x, z: best.z }); }
          }
          continue;
        }
        c.convT -= DT;
        if (c.convT <= 0) { c.convT = 11; c.mcast = 2.5; sim.emit({ e: 'leaderCast', id: c.id, ability: 'convert', name: 'Verderben', wind: 2.5, x: c.x, z: c.z, interruptible: true, lane: c.lane }); }
      }
    },
    text: () => 'Verderber-Schamanen übernehmen Vasallen – unterbrich ihr „Verderben“ mit Betäubungen oder töte sie zuerst.',
  },

  rescue: {
    init: (sim, st) => { st.saved = 0; st.lost = 0; },
    waveStart: (sim) => {
      const lx = laneX(sim);
      spawnObj(sim, 'cage', lx - 4, LANE_SPAWN_Z + 2, { timer: 30 });
      spawnObj(sim, 'cage', lx + 4, LANE_SPAWN_Z + 3, { timer: 30 });
    },
    tick: (sim, st) => {
      if (sim.phase !== 'battle' || sim.freeze > 0) return;
      for (const o of objs(sim, 'cage')) {
        o.timer -= DT;
        if (chargeByHero(sim, o, 2.2, 1)) { st.saved++; lanePlayer(sim).gold += 20; sim.emit({ e: 'objective', text: `Gefangene befreit (${st.saved}) +20 Gold` }); removeObj(sim, o, 'freed'); }
        else if (o.timer <= 0) { st.lost++; sim.emit({ e: 'objective', text: 'Zu spät – ein Käfig ist in den Riss gestürzt.' }); removeObj(sim, o, 'lost'); }
      }
    },
    final: (sim, st) => (st.saved >= st.cfg.need ? { winner: 0, reason: `${st.saved} Gefangene befreit` } : { winner: 1, reason: `Nur ${st.saved} von ${st.cfg.need} Gefangenen befreit` }),
    text: (sim, st) => `Rettung: ${st.saved} befreit (Ziel ${st.cfg.need}) · Käfige stürzen nach 30 s ab – Held muss hin!`,
  },

  chase: {
    init: (sim, st) => { st.caught = 0; st.escaped = 0; },
    waveStart: (sim, st) => {
      const w = sim.waveDef();
      const c = sim.spawnCreep(lanePlayer(sim).id, { ...w, key: 'dornenfuerst', model: 'serpent', name: 'Dornenfürst', hp: Math.round(w.hp * w.count * 0.22), bounty: w.bounty * 6, size: 1.5, leader: false, palette: { primary: '#2a4a1a', secondary: '#8aff3a', metal: '#6a5a2a', glow: '#c8ff4a' } }, laneX(sim), BUILD_Z0 - 2, { bounty: w.bounty * 6, wave: true });
      c.fleeing = true;
      sim.emit({ e: 'objective', text: 'Der Dornenfürst flieht zum Portal – stelle ihn!' });
    },
    tick: (sim, st) => {
      if (sim.phase !== 'battle' || sim.freeze > 0) return;
      for (const c of sim.entities.values()) {
        if (c.type !== 'c' || !c.fleeing || !c.alive) continue;
        if (c.stun > 0 || (c.rootT || 0) > 0) continue;
        c.z -= 2.3 * (1 - (c.slowPct || 0)) * DT; c.moving = sim.tick; c.face = Math.PI;
        if (c.z <= LANE_SPAWN_Z - 3) { st.escaped++; c.alive = false; sim.entities.delete(c.id); sim.emit({ e: 'objDone', id: c.id, kind: 'flee', reason: 'escaped', x: c.x, z: c.z }); sim.emit({ e: 'objective', text: 'Der Dornenfürst ist entkommen!' }); }
      }
    },
    onKill: (sim, st, e) => { if (e.fleeing) { st.caught++; sim.emit({ e: 'objective', text: `Dornenfürst gestellt (${st.caught})!` }); } },
    final: (sim, st) => (st.caught >= st.cfg.need ? { winner: 0, reason: `Dornenfürst ${st.caught}× gestellt` } : { winner: 1, reason: `Der Dornenfürst ist ${st.escaped}× entkommen` }),
    text: (sim, st) => `Verfolgung: ${st.caught} gestellt · ${st.escaped} entkommen (Ziel ${st.cfg.need})`,
  },

  sandstorm: {
    dmgMul: (sim, st, src) => (src && src.type === 'f' && UNITS[src.def] && UNITS[src.def].ranged ? 0.6 : 1),
    text: () => 'Sandsturm: Fernkampf-Vasallen treffen 40 % schwächer, Gegner laufen schneller.',
  },

  lava: {
    init: (sim, st) => { st.t = 4; st.pending = []; },
    tick: (sim, st) => {
      if (sim.phase !== 'battle' || sim.freeze > 0) return;
      st.t -= DT;
      if (st.t <= 0) {
        st.t = 5.5;
        const lx = laneX(sim);
        for (let i = 0; i < 2; i++) {
          const v = { x: lx + sim.rng.range(-5, 5), z: sim.rng.range(-20, 8), r: 3, t: 1.8 };
          st.pending.push(v);
          sim.emit({ e: 'telegraph', shape: 'circle', x: v.x, z: v.z, r: v.r, dur: v.t, lane: 0, hazard: true });
          (sim.telegraphs = sim.telegraphs || []).push({ shape: 'circle', x: v.x, z: v.z, r: v.r, until: sim.time + v.t, lane: 0 });
        }
      }
      for (let i = st.pending.length - 1; i >= 0; i--) {
        const v = st.pending[i];
        v.t -= DT;
        if (v.t > 0) continue;
        st.pending.splice(i, 1);
        const dmg = 120 * Math.pow(1.13, sim.wave - 1);
        const src = { type: 'env', alive: false };
        for (const e of [...sim.entities.values()]) if ((e.type === 'f' || e.type === 'h' || e.type === 'c') && e.alive && near(e, v, v.r)) sim.applyHit(src, e, dmg, 'chaos', false);
        sim.emit({ e: 'splash', x: v.x, z: v.z, r: v.r, atk: 'chaos' });
        sim.emit({ e: 'lava', x: v.x, z: v.z, r: v.r });
      }
    },
    text: () => 'Lavaschlote brechen aus: Bodenwarnungen treffen ALLE – auch Vasallen und deinen Helden.',
  },

  betrayal: {
    waveStart: (sim, st) => {
      if (!st.cfg.waves.includes(wavesDone(sim) + 1)) return;
      const own = sim.fightersOf(lanePlayer(sim).id);
      st.defected = [];
      for (let i = 0; i < Math.min(2, own.length); i++) {
        const f = own.splice(sim.rng.int(own.length), 1)[0];
        const d = UNITS[f.def];
        f.alive = false; f.defected = true; st.defected.push(f.id);
        const c = sim.spawnCreep(lanePlayer(sim).id, { key: `def_${d.id}`, id: undefined, n: sim.wave, name: `Überläufer: ${d.name}`, model: d.model, hp: d.hp, dmg: d.dmg, cd: d.cd, range: d.range, speed: d.speed, armor: d.armor, armorType: d.armorType, atk: d.atk, ranged: d.ranged, bounty: Math.round(d.value * 0.3), palette: { primary: '#2a1a1a', secondary: '#ff3a3a', metal: '#5a4a4a', glow: '#ff2a2a' }, size: 1 }, f.x, f.z, { bounty: Math.round(d.value * 0.3), wave: true });
        c.defector = f.id;
      }
      if (st.defected.length) sim.emit({ e: 'objective', text: `Verrat! ${st.defected.length} deiner Vasallen laufen zu Orrik über.` });
    },
    waveEnd: (sim, st) => { for (const id of st.defected || []) { const f = sim.entities.get(id); if (f) { f.defected = false; } } st.defected = []; },
    text: () => 'Verrat am Tor: In manchen Wellen wechseln Vasallen die Seite – plane Reserven ein.',
  },

  pylons: {
    waveStart: (sim) => {
      const lx = laneX(sim);
      for (const [dx, z] of [[-5, -16], [5, -6], [0, 4]]) spawnObj(sim, 'pylon', lx + dx, z, { lit: false });
    },
    tick: (sim) => {
      for (const o of objs(sim, 'pylon')) if (!o.lit && chargeByHero(sim, o, 2.5, 2)) { o.lit = true; sim.emit({ e: 'objLit', id: o.id, x: o.x, z: o.z }); sim.emit({ e: 'objective', text: 'Kristallpfeiler geladen: Vasallen in der Nähe greifen 40 % schneller an!' }); }
      for (const o of objs(sim, 'pylon')) if (o.lit) for (const f of sim.entities.values()) if (f.type === 'f' && f.alive && near(f, o, 8)) { f.hbHaste = Math.max(f.hbHaste || 0, 0.4); f.hbT = Math.max(f.hbT || 0, 0.2); }
    },
    waveEnd: (sim) => { for (const o of objs(sim, 'pylon')) removeObj(sim, o, 'reset'); },
    text: () => 'Kristallpfeiler: Stelle deinen Helden 2 s an einen Pfeiler, um ihn zu laden.',
  },

  shadows: {
    canTarget: (sim, st, f, c) => {
      if ((c.x - f.x) ** 2 + (c.z - f.z) ** 2 < 6.25 || c.cursePct > 0) return true;
      const h = heroOf(sim);
      return !!(h && h.alive && near(h, c, 7));
    },
    text: () => 'Schatten: Gegner sind nur in der Nähe deines Helden sichtbar (oder markiert/verflucht).',
  },

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
      sim.emit({ e: 'objective', text: 'Die Welle spiegelt deine eigenen Vasallen – mit deinen Schwächen.' });
    },
    text: () => 'Spiegelwelt: Gegner kopieren Angriffs- und Rüstungsart deiner Vasallen.',
  },

  timedecay: {
    waveEnd: (sim) => {
      sim.rules.buildTime = Math.max(10, Math.round(sim.rules.buildTime * 0.78));
      const p = lanePlayer(sim); p.gold += p.income;
      sim.emit({ e: 'objective', text: `Die Zeit zerfällt: nur noch ${sim.rules.buildTime} s Bauzeit – doppeltes Einkommen (+${p.income}).` });
    },
    text: (sim) => `Zerfallende Zeit: Bauzeit ${sim.rules.buildTime} s (schrumpft) · Einkommen doppelt`,
  },

  lastbastion: {
    init: (sim) => { const k = sim.teams[0].king; k.heals = 2; k.maxHeals = 2; },
    allow: (sim, st, p, cmd) => (cmd.type === 'king' ? 'In der letzten Bastion gibt es keine Verbesserungen' : true),
    text: () => 'Letzte Bastion: keine König-Verbesserungen, nur 2 Heilungen.',
  },

  duel: { text: (sim) => (sim.wave >= sim.rules.maxWaves ? 'Varo führt die Welle an – bezwinge ihn im Duell!' : 'Varo beobachtet dich …') },
};

export function createMission(cfg) {
  const m = MECHANICS[cfg.mechanic];
  if (!m) return null;
  return { m, st: { cfg } };
}
export function missionHook(sim, name, ...args) {
  const mi = sim.mission;
  if (!mi || !mi.m[name]) return undefined;
  return mi.m[name](sim, mi.st, ...args);
}
