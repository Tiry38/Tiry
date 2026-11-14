// Wellen-Anführer: in jeder Welle eine Elite-Einheit je Bahn – das direkte Duell-Ziel für den Helden.
// Fähigkeiten mit Vorwarnung (Telegraph-Ereignis für Boden-Warnungen), unterbrechbar durch Betäubung.
// Moral-Aura: Solange der Anführer lebt, verursachen Gegner in seiner Nähe mehr Schaden und haben mehr Rüstung.
// Schnell besiegt (in den ersten 20 s) → Bonus-Gold und die Welle wird „gebrochen“.

const DT = 1 / 20;

export const LEADER_ABILITIES = {
  charge: { name: 'Sturmangriff', cd: 9, wind: 0.9, range: 16, minRange: 4, dmg: 2.2, stun: 1.0 },
  slam: { name: 'Erdspalter', cd: 11, wind: 1.6, radius: 4.5, dmg: 3.0, stun: 0.6 },
  heal: { name: 'Blutopfer', cd: 14, wind: 2.2, radius: 10, pct: 0.25, interruptible: true },
  shield: { name: 'Bannschild', cd: 16, wind: 1.6, radius: 9, pct: 0.3, interruptible: true },
  enrage: { name: 'Raserei', cd: 0, hpBelow: 0.35, haste: 0.6 },
  summon: { name: 'Ruf der Brut', cd: 18, wind: 1.8, count: 2, maxCasts: 2, interruptible: true },
};

const NAMES = ['Grubenvogt', 'Glutzahn', 'Panzerhüter', 'Irrlichtbeschwörer', 'Felsherr', 'Rudelführer', 'Steinrufer', 'Schlangenpriester', 'Kristallwächter', '',
  'Schwarzritter Vorn', 'Lavaalpha', 'Brutmutter', 'Sturmrufer', 'Obsidianvogt', 'Blutjäger', 'Ogerhäuptling', 'Nagatyrann', 'Magmafürst', '',
  'Leerenkönigin', 'Runenkoloss', 'Todesmarschall', 'Höllenbeschwörer', 'Kolosshäuptling', 'Urzeitjäger', 'Sternenrufer', 'Leerennaga-Hexe', 'Titanenkäfer-Prime', ''];

/** Fähigkeiten-Satz je Welle: wächst mit der Welle (1 → 4 Fähigkeiten) */
function kitFor(n, boss) {
  const pool = ['charge', 'slam', 'heal', 'shield', 'summon'];
  const k = boss ? 4 : n <= 4 ? 1 : n <= 9 ? 2 : n <= 19 ? 3 : 4;
  const start = (n * 2) % pool.length;
  const kit = [];
  for (let i = 0; i < k; i++) kit.push(pool[(start + i) % pool.length]);
  if (n >= 12 || boss) kit.push('enrage');
  return kit;
}

/** Erzeugt die Anführer-Definition zu einer Wellen-Definition */
export function leaderDef(w) {
  if (w.boss) return null; // Bosse sind selbst Anführer (siehe bossKit)
  return {
    ...w, key: `w${w.n}L`, leader: true, champion: false, hunter: true,
    name: NAMES[w.n - 1] || `Anführer der ${w.name}`,
    hp: Math.round(Math.max(w.hp * 2.2, w.hp * w.count * 0.25)), dmg: w.dmg * 2.0, armor: w.armor + 3, bounty: w.bounty * 6, size: 1.55,
    range: w.ranged ? w.range : 1.6, speed: w.speed * 0.95, cd: w.cd * 1.1,
    kit: kitFor(w.n, false), auraR: 9, auraDmg: 0.1, auraArmor: 1,
  };
}
export function bossKit(w) {
  // Champion-Bosse: mit jeder Bosswelle eine Mechanik mehr (Welle 10: 2, Welle 20: 3, Welle 30: 4) + Raserei
  const kit = ['slam', 'charge', 'summon', 'shield'].slice(0, w.n <= 10 ? 2 : w.n <= 20 ? 3 : 4).concat(['enrage']);
  return { ...w, hp: Math.round(w.hp * 0.5), dmg: w.dmg * 0.75, leader: true, hunter: true, kit, auraR: 12, auraDmg: 0.2, auraArmor: 3, phases: true };
}

/** pro Tick für jeden lebenden Anführer (Spur-Phase) */
export function updateLeader(sim, c, defenders) {
  const d = c.def;
  c.lcd = c.lcd || {};
  for (const k of d.kit) if (c.lcd[k] > 0) c.lcd[k] -= DT;
  // Phasen für Bosse
  if (d.phases) {
    const r = c.hp / c.maxHp;
    const ph = r < 0.33 ? 3 : r < 0.66 ? 2 : 1;
    if (ph !== (c.phase || 1)) {
      c.phase = ph;
      sim.emit({ e: 'leaderPhase', id: c.id, phase: ph, x: c.x, z: c.z, lane: c.lane });
      if (ph >= 2) for (const k of d.kit) c.lcd[k] = Math.min(c.lcd[k] || 0, 1.5);
    }
  }
  // Raserei
  if (d.kit.includes('enrage') && !c.enraged && c.hp / c.maxHp < LEADER_ABILITIES.enrage.hpBelow) {
    c.enraged = true;
    sim.emit({ e: 'leaderCast', id: c.id, ability: 'enrage', name: LEADER_ABILITIES.enrage.name, wind: 0, x: c.x, z: c.z, lane: c.lane });
  }
  // laufender Zauber
  if (c.lcast) {
    if (c.stun > 0) {
      sim.emit({ e: 'leaderInterrupt', id: c.id, ability: c.lcast.k, x: c.x, z: c.z, lane: c.lane });
      c.lcast = null;
      return true;
    }
    c.lcast.t -= DT;
    if (c.lcast.t <= 0) { const lc = c.lcast; c.lcast = null; resolve(sim, c, lc, defenders); }
    return true; // während des Wirkens keine normale Aktion
  }
  if (c.stun > 0 || c.fearT > 0) return false;
  // neue Fähigkeit wählen
  const hero = defenders.find((x) => x.type === 'h' && x.alive);
  for (const k of d.kit) {
    if (k === 'enrage' || (c.lcd[k] || 0) > 0) continue;
    const a = LEADER_ABILITIES[k];
    let ok = false, lc = { k, t: a.wind / (d.phases && c.phase === 3 ? 1.3 : 1) };
    if (k === 'charge') {
      const t = hero || nearest(defenders, c);
      if (t) { const dist = Math.hypot(t.x - c.x, t.z - c.z); if (dist >= a.minRange && dist <= a.range) { ok = true; lc.tgt = t.id; lc.x = t.x; lc.z = t.z; } }
    } else if (k === 'slam') {
      const t = nearest(defenders, c);
      if (t && Math.hypot(t.x - c.x, t.z - c.z) < 5) { ok = true; lc.x = c.x; lc.z = c.z; }
    } else if (k === 'heal') {
      let hurt = 0; for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === c.lane && e.hp < e.maxHp * 0.7) hurt++;
      ok = hurt >= 2;
    } else if (k === 'shield') {
      let allies = 0; for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e !== c && e.lane === c.lane && (e.x - c.x) ** 2 + (e.z - c.z) ** 2 < 81) allies++;
      ok = allies >= 2 && defenders.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < 10);
    } else if (k === 'summon') ok = (c.summons || 0) < a.maxCasts;
    if (ok && k === 'summon') c.summons = (c.summons || 0) + 1;
    if (!ok) continue;
    c.lcd[k] = a.cd;
    c.lcast = lc;
    sim.emit({ e: 'leaderCast', id: c.id, ability: k, name: a.name, wind: lc.t, x: lc.x ?? c.x, z: lc.z ?? c.z, fx: c.x, fz: c.z, r: a.radius || 0, interruptible: !!a.interruptible, lane: c.lane });
    if (k === 'slam') sim.emit({ e: 'telegraph', shape: 'circle', x: c.x, z: c.z, r: a.radius, dur: lc.t, lane: c.lane });
    if (k === 'charge') sim.emit({ e: 'telegraph', shape: 'line', x: c.x, z: c.z, x2: lc.x, z2: lc.z, w: 2.2, dur: lc.t, lane: c.lane });
    return true;
  }
  return false;
}

function nearest(list, c) {
  let best = null, bd = Infinity;
  for (const t of list) { if (!t.alive) continue; const d = (t.x - c.x) ** 2 + (t.z - c.z) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}

function resolve(sim, c, lc, defenders) {
  const a = LEADER_ABILITIES[lc.k];
  const d = c.def;
  if (lc.k === 'charge') {
    // stürmt zur angekündigten Position – wer ausgewichen ist, wird nicht getroffen
    const dx = lc.x - c.x, dz = lc.z - c.z, len = Math.hypot(dx, dz) || 1;
    const ex = lc.x - (dx / len) * 1.2, ez = lc.z - (dz / len) * 1.2;
    for (const t of defenders) {
      if (!t.alive) continue;
      if (distToSeg(t.x, t.z, c.x, c.z, ex, ez) < 1.6) {
        sim.applyHit(c, t, d.dmg * a.dmg, d.atk, false);
        if (t.alive) t.stun = Math.max(t.stun || 0, a.stun);
      }
    }
    c.x = ex; c.z = ez;
    sim.emit({ e: 'leaderImpact', id: c.id, ability: 'charge', x: c.x, z: c.z, lane: c.lane });
  } else if (lc.k === 'slam') {
    for (const t of defenders) if (t.alive && (t.x - lc.x) ** 2 + (t.z - lc.z) ** 2 <= a.radius ** 2) { sim.applyHit(c, t, d.dmg * a.dmg, 'wucht', false); if (t.alive) t.stun = Math.max(t.stun || 0, a.stun); }
    sim.emit({ e: 'leaderImpact', id: c.id, ability: 'slam', x: lc.x, z: lc.z, r: a.radius, lane: c.lane });
    sim.emit({ e: 'splash', x: lc.x, z: lc.z, r: a.radius, atk: 'wucht' });
  } else if (lc.k === 'heal') {
    for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e !== c && e.lane === c.lane && (e.x - c.x) ** 2 + (e.z - c.z) ** 2 <= a.radius ** 2) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * a.pct);
      sim.emit({ e: 'heal', src: c.id, tgt: e.id, x: e.x, z: e.z, amount: Math.round(e.maxHp * a.pct), enemy: true });
    }
  } else if (lc.k === 'shield') {
    for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e !== c && e.lane === c.lane && (e.x - c.x) ** 2 + (e.z - c.z) ** 2 <= a.radius ** 2) {
      e.shield = (e.shield || 0) + e.maxHp * a.pct;
      sim.emit({ e: 'shield', id: e.id, x: e.x, z: e.z, enemy: true });
    }
  } else if (lc.k === 'summon') {
    let w = sim.waveDef(Math.max(1, sim.wave));
    if (w.boss) w = sim.waveDef(Math.max(1, sim.wave - 1)); // Bosse rufen Diener der Vorwelle, keine Boss-Kopien
    for (let i = 0; i < a.count; i++) {
      const ang = (i / a.count) * Math.PI * 2;
      const add = sim.spawnCreep(c.lane, { ...w, key: w.key, hp: Math.round(w.hp * 0.35), dmg: w.dmg * 0.5, bounty: 1 }, c.x + Math.sin(ang) * 2, c.z + Math.cos(ang) * 2, { bounty: 1, wave: true });
      add.summoned = true;
    }
  }
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** Moral-Aura: Schadens-/Rüstungsbonus der Welle in der Nähe eines lebenden Anführers */
export function leaderAura(sim, laneCreeps) {
  const leaders = laneCreeps.filter((c) => c.alive && c.def.leader);
  for (const c of laneCreeps) { c.moraleDmg = 0; c.moraleArmor = 0; }
  for (const L of leaders) {
    const r2 = L.def.auraR ** 2;
    for (const c of laneCreeps) {
      if (c === L) continue;
      if ((c.x - L.x) ** 2 + (c.z - L.z) ** 2 <= r2) { c.moraleDmg = Math.max(c.moraleDmg, L.def.auraDmg); c.moraleArmor = Math.max(c.moraleArmor, L.def.auraArmor); }
    }
    if (L.enraged) L.moraleDmg = 0.5;
  }
}
