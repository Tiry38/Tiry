// Helden-Logik (deterministisch, Teil der Simulation).
// Steuerung kommt als Befehle:  hin {f,s,yaw,jump}  ·  hcast {slot,target,x,z}  ·  htarget {id}  ·  hauto {id}
// f/s ∈ {-1,0,1} (vor/zurück, seitwärts rechts/links), yaw in Milliradiant (absolute Blickrichtung), jump = Sprung-Flanke.
import { HEROES, HERO_STATS as HS, abilityAt } from './heroes.js';
import { UNITS, DAMAGE_TABLE, armorReduction } from './data.js';
import { LANE_WIDTH, LANE_SPAWN_Z, LANE_END_Z, BUILD_Z0, BUILD_Z1 } from './layout.js';
import { inTelegraph } from './leader.js';

const DT = 1 / 20;
export const HERO_RADIUS = 0.7;

// Held ≈ 20–30 % der Kampfkraft einer Bahn: Schaden wächst wie die Wellen, Leben etwas langsamer.
export const HERO_DMG_SCALE = 0.2;
export function heroPower(wave, level) {
  return HERO_DMG_SCALE * Math.pow(1.15, Math.max(0, wave - 1)) * (1 + 0.04 * (level - 1));
}
export function heroHpMul(wave, level) {
  return 0.65 * Math.pow(1.12, Math.max(0, wave - 1)) * (1 + 0.05 * (level - 1));
}

export function createHero(sim, p) {
  const def = HEROES[p.heroId] || HEROES.kael;
  const lx = sim.laneX(p.id);
  const h = {
    id: sim.nextId++, type: 'h', owner: p.id, team: p.team, lane: p.id, heroId: def.id,
    x: lx, z: BUILD_Z1 + 3, y: 0, vy: 0, vx: 0, vz: 0, grounded: true, face: Math.PI, yawIn: Math.PI,
    hp: def.hp, maxHp: def.hp, res: def.resMax, resMax: def.resMax, alive: true, respawn: 0,
    level: 1, xp: 0, power: 1, cds: [0, 0, 0, 0, 0], gcd: 0, cast: null, queued: null,
    target: 0, auto: false, atkCd: 0, atkT: -9, actT: -9, actKind: null, actSlot: -1,
    stun: 0, slowPct: 0, slowT: 0, cursePct: 0, curseT: 0, rootT: 0, fearT: 0, shield: 0, shieldT: 0,
    buffs: [], zones: [], tauntT: 0, critNext: false, moving: -99,
    auraArmor: 0, auraSpeed: 0, stats: { dmg: 0, heal: 0, kills: 0 },
  };
  sim.entities.set(h.id, h);
  p.heroEnt = h.id;
  p.hin = { f: 0, s: 0, yaw: Math.round(Math.PI * 1000), jump: 0 };
  return h;
}

export function heroDef(h) { return HEROES[h.heroId]; }

export function heroArmorType(h) { return HEROES[h.heroId].armorType; }

function buffVal(h, key) { let v = 0; for (const b of h.buffs) if (b[key]) v += b[key]; return v; }

export function heroArmor(h) { return HEROES[h.heroId].armor + buffVal(h, 'armor'); }

/** Am Rundenbeginn: Held an den Start setzen, Stärke an die Welle anpassen */
export function heroWaveStart(sim, h) {
  const def = heroDef(h);
  h.power = heroPower(sim.wave, h.level);
  const maxHp = Math.round(def.hp * heroHpMul(sim.wave, h.level));
  h.maxHp = maxHp;
  h.hp = maxHp;
  h.alive = true; h.respawn = 0;
  h.x = sim.laneX(h.lane); h.z = BUILD_Z1 + 3; h.y = 0; h.vy = 0; h.grounded = true;
  h.face = Math.PI; h.cast = null; h.queued = null; h.target = 0; h.auto = false;
  h.buffs = []; h.zones = []; h.stun = 0; h.rootT = 0; h.fearT = 0; h.shield = 0;
  h.res = h.resMax;
  const p = sim.players[h.owner];
  p.hin = { f: 0, s: 0, yaw: Math.round(Math.PI * 1000), jump: 0 };
}

export function heroWaveEnd(sim, h) {
  h.cast = null; h.queued = null; h.zones = []; h.buffs = []; h.auto = false; h.target = 0;
  h.cds = h.cds.map(() => 0); h.gcd = 0;
  if (!h.alive) { h.alive = true; h.hp = h.maxHp; }
  h.x = sim.laneX(h.lane); h.z = LANE_END_Z - 5; h.y = 0; h.face = Math.PI;
}

// ---------------------------------------------------------------- Befehle
export function heroCommand(sim, p, cmd) {
  const h = p.heroEnt && sim.entities.get(p.heroEnt);
  if (!h) return false;
  switch (cmd.type) {
    case 'hin': {
      const f = Math.max(-1, Math.min(1, cmd.f | 0)), s = Math.max(-1, Math.min(1, cmd.s | 0));
      p.hin = { f, s, yaw: (cmd.yaw | 0), jump: cmd.jump ? 1 : 0 };
      return true;
    }
    case 'htarget': {
      const t = sim.entities.get(cmd.id);
      h.target = t && t.alive && t.type === 'c' ? t.id : 0;
      if (!h.target) h.auto = false;
      return true;
    }
    case 'hauto': {
      const t = sim.entities.get(cmd.id);
      if (!t || !t.alive || t.type !== 'c') { h.auto = false; return false; }
      h.target = t.id; h.auto = true;
      return true;
    }
    case 'hstop': h.auto = false; return true;
    case 'hcast': return tryCast(sim, h, cmd.slot | 0, cmd, true);
    default: return false;
  }
}

function fail(sim, h, reason) { sim.emit({ e: 'heroError', pid: h.owner, reason }); return false; }

function tryCast(sim, h, slot, req, fromInput) {
  if (sim.phase !== 'battle' || sim.freeze > 0) return fail(sim, h, 'Nur im Kampf');
  if (!h.alive) return fail(sim, h, 'Dein Held ist gefallen');
  const def = heroDef(h);
  const raw = def.abilities[slot];
  if (!raw) return false;
  const ab = abilityAt(raw, h.level, slot);
  const busy = h.cast ? (h.cast.total - h.cast.t) : 0;
  const gcdLeft = ab.gcd ? h.gcd : 0;
  const cdLeft = h.cds[slot];
  const wait = Math.max(busy, gcdLeft, cdLeft);
  if (wait > 0) {
    // Zauber-Warteschlange (400 ms): nur die zuletzt gedrückte Fähigkeit wird gemerkt
    if (fromInput && wait <= HS.queueWindow && !(h.cast && h.cast.channel)) { h.queued = { slot, target: req.target | 0, x: req.x, z: req.z }; return true; }
    return fail(sim, h, cdLeft > 0 ? 'Fähigkeit lädt noch' : 'Noch nicht bereit');
  }
  if (h.stun > 0) return fail(sim, h, 'Du bist betäubt');
  if (h.res < ab.cost) return fail(sim, h, `Nicht genug ${def.resName}`);
  // Ziel bestimmen
  let tgt = null, tx = req.x, tz = req.z;
  const needsEnemy = ['strike', 'bolt', 'dash', 'mark', 'dot', 'drain', 'root_target'].includes(ab.type) || (ab.type === 'blink' && ab.behind);
  if (needsEnemy) {
    tgt = sim.entities.get(req.target || h.target);
    if (!tgt || !tgt.alive || tgt.type !== 'c') return fail(sim, h, 'Kein gültiges Ziel');
    const d = Math.hypot(tgt.x - h.x, tgt.z - h.z);
    if (d > ab.range + 1.2) return fail(sim, h, 'Ziel außer Reichweite');
    if (ab.minRange && d < ab.minRange) return fail(sim, h, 'Ziel zu nah');
    h.target = tgt.id;
  }
  if (ab.type === 'shield') {
    tgt = sim.entities.get(req.target) || h;
    if (!tgt.alive || (tgt.type !== 'h' && tgt.type !== 'f') || tgt.team !== h.team) tgt = h;
  }
  if (['aoe_ground', 'leap', 'turret', 'pull'].includes(ab.type)) {
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) { tx = h.x + Math.sin(h.face) * Math.min(8, ab.range); tz = h.z + Math.cos(h.face) * Math.min(8, ab.range); }
    const d = Math.hypot(tx - h.x, tz - h.z);
    if (d > ab.range + 0.5) { tx = h.x + ((tx - h.x) / d) * ab.range; tz = h.z + ((tz - h.z) / d) * ab.range; }
    const c = clampLane(sim, h, tx, tz); tx = c.x; tz = c.z;
  }
  h.queued = null;
  h.res -= ab.cost;
  if (ab.gcd) h.gcd = gcdFor(h);
  const target = { id: tgt ? tgt.id : 0, x: tx, z: tz };
  if (ab.cast > 0 || ab.channel) {
    const total = ab.channel ? (ab.ticks || 1) * (ab.tick || 1) : ab.cast;
    h.cast = { slot, t: 0, total, channel: !!ab.channel, target, ab, nextTick: ab.channel ? (ab.tick || 1) : 0, ticksDone: 0 };
    if (ab.channel && ab.type === 'aoe_ground') h.zones.push(zone(h, ab, tx, tz, true));
    sim.emit({ e: 'heroCast', id: h.id, pid: h.owner, slot, total, channel: !!ab.channel, ability: raw.id });
    h.cds[slot] = ab.cd;
  } else {
    h.cds[slot] = ab.cd;
    execute(sim, h, slot, ab, target);
  }
  return true;
}

function gcdFor(h) { return Math.max(HS.gcdMin, HS.gcd / (1 + buffVal(h, 'haste'))); }

function clampLane(sim, h, x, z) {
  const lx = sim.laneX(h.lane), hw = LANE_WIDTH / 2 - 0.6;
  return { x: Math.max(lx - hw, Math.min(lx + hw, x)), z: Math.max(LANE_SPAWN_Z - 4, Math.min(LANE_END_Z + 1.5, z)) };
}

function zone(h, ab, x, z, bound) {
  return { x, z, r: ab.radius, dmg: ab.dmg || 0, heal: ab.heal || 0, ticks: ab.ticks || 1, tick: ab.tick || 0, next: ab.delay || (ab.channel ? (ab.tick || 1) : 0), stun: ab.stun || 0, bound, slot: -1, done: 0, delayed: !!ab.delay };
}

// ---------------------------------------------------------------- Wirkung
function enemiesNear(sim, h, x, z, r) {
  const out = [];
  for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === h.lane && e.stage === 'lane' && (e.x - x) ** 2 + (e.z - z) ** 2 <= r * r) out.push(e);
  return out;
}
function alliesNear(sim, h, x, z, r) {
  const out = [];
  for (const e of sim.entities.values()) if ((e.type === 'f' || e.type === 'h') && e.team === h.team && e.lane === h.lane && (e.x - x) ** 2 + (e.z - z) ** 2 <= r * r) out.push(e);
  return out;
}

function hit(sim, h, tgt, dmg, extra = {}) {
  if (!tgt || !tgt.alive) return 0;
  let d = dmg * h.power * (1 + buffVal(h, 'dmg'));
  if (h.critNext && !extra.noCrit) { d *= 2; h.critNext = false; extra.crit = true; }
  const dealt = sim.applyHit(h, tgt, d, extra.atk || heroDef(h).atk, !!extra.crit);
  h.stats.dmg += dealt;
  const ls = buffVal(h, 'lifesteal');
  if (ls > 0 && h.alive) h.hp = Math.min(h.maxHp, h.hp + dealt * ls);
  if (extra.stun && tgt.alive && !(tgt.def && tgt.def.boss)) { tgt.stun = Math.max(tgt.stun, extra.stun); sim.emit({ e: 'stun', id: tgt.id }); }
  if (extra.root && tgt.alive) tgt.rootT = Math.max(tgt.rootT || 0, extra.root);
  if (extra.slow && tgt.alive) { tgt.slowPct = Math.max(tgt.slowPct, extra.slow); tgt.slowT = 3; }
  return dealt;
}

function healEnt(sim, h, e, amount) {
  if (!e.alive) return;
  const a = amount * h.power;
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + a);
  h.stats.heal += e.hp - before;
  sim.emit({ e: 'heal', src: h.id, tgt: e.id, x: e.x, z: e.z, amount: Math.round(e.hp - before) });
}

function execute(sim, h, slot, ab, target) {
  const def = heroDef(h);
  const tgt = target.id ? sim.entities.get(target.id) : null;
  h.actT = sim.time; h.actSlot = slot; h.actKind = ab.type;
  sim.emit({ e: 'heroAbility', id: h.id, pid: h.owner, slot, ability: def.abilities[slot].id, type: ab.type, x: h.x, z: h.z, tx: target.x ?? (tgt && tgt.x), tz: target.z ?? (tgt && tgt.z), tgt: target.id, radius: ab.radius, ult: !!ab.isUlt });
  switch (ab.type) {
    case 'strike': {
      if (!tgt || !tgt.alive) break;
      const n = ab.hits || 1;
      for (let i = 0; i < n && tgt.alive; i++) hit(sim, h, tgt, ab.dmg, { stun: ab.stun });
      if (ab.splash) for (const e of enemiesNear(sim, h, tgt.x, tgt.z, ab.splash)) if (e !== tgt) hit(sim, h, e, ab.dmg * 0.5);
      break;
    }
    case 'bolt': {
      if (!tgt || !tgt.alive) break;
      const pr = { id: sim.nextId++, type: 'p', src: h.id, tgt: tgt.id, x: h.x, z: h.z, y: 1.6, dmg: ab.dmg * h.power, atk: def.atk, abil: {}, side: 'f', speed: 26, kind: def.atk === 'stich' ? 'arrow' : def.atk === 'chaos' ? 'void' : 'magic', lane: h.lane, team: h.team, ox: h.x, oz: h.z, tx: tgt.x, tz: tgt.z, hero: true };
      sim.entities.set(pr.id, pr);
      break;
    }
    case 'cone': {
      const fx = Math.sin(h.face), fz = Math.cos(h.face);
      for (const e of enemiesNear(sim, h, h.x, h.z, ab.range)) {
        const dx = e.x - h.x, dz = e.z - h.z, d = Math.hypot(dx, dz) || 1;
        if ((dx * fx + dz * fz) / d >= Math.cos(ab.angle || 0.8)) hit(sim, h, e, ab.dmg);
      }
      break;
    }
    case 'aoe_self': {
      for (const e of enemiesNear(sim, h, h.x, h.z, ab.radius)) {
        hit(sim, h, e, ab.dmg || 0, { stun: ab.stun, root: ab.root });
        if (ab.fear && e.alive && !(e.def && e.def.boss)) e.fearT = ab.fear;
      }
      break;
    }
    case 'aoe_ground': h.zones.push(zone(h, ab, target.x, target.z, false)); break;
    case 'dash': {
      if (!tgt) break;
      const dx = tgt.x - h.x, dz = tgt.z - h.z, d = Math.hypot(dx, dz) || 1;
      h.x = tgt.x - (dx / d) * 1.6; h.z = tgt.z - (dz / d) * 1.6; h.face = Math.atan2(dx, dz);
      hit(sim, h, tgt, ab.dmg, { stun: ab.stun });
      if (ab.gain) h.res = Math.min(h.resMax, h.res + ab.gain);
      sim.emit({ e: 'heroDash', id: h.id, x: h.x, z: h.z });
      break;
    }
    case 'blink': {
      let nx, nz;
      if (ab.behind && tgt) { const dx = tgt.x - h.x, dz = tgt.z - h.z, d = Math.hypot(dx, dz) || 1; nx = tgt.x + (dx / d) * 1.5; nz = tgt.z + (dz / d) * 1.5; h.face = Math.atan2(-dx, -dz); h.critNext = true; }
      else { nx = h.x + Math.sin(h.face) * ab.range; nz = h.z + Math.cos(h.face) * ab.range; }
      const c = clampLane(sim, h, nx, nz);
      sim.emit({ e: 'heroBlink', id: h.id, fx: h.x, fz: h.z, x: c.x, z: c.z });
      h.x = c.x; h.z = c.z;
      break;
    }
    case 'leap_back': {
      const c = clampLane(sim, h, h.x - Math.sin(h.face) * ab.range, h.z - Math.cos(h.face) * ab.range);
      for (const e of enemiesNear(sim, h, h.x, h.z, 5)) { e.slowPct = Math.max(e.slowPct, ab.slow || 0.5); e.slowT = 3; }
      h.x = c.x; h.z = c.z; h.vy = 5; h.grounded = false;
      sim.emit({ e: 'heroDash', id: h.id, x: h.x, z: h.z });
      break;
    }
    case 'leap': {
      h.x = target.x; h.z = target.z; h.vy = 4; h.grounded = false;
      for (const e of enemiesNear(sim, h, h.x, h.z, ab.radius || 4)) hit(sim, h, e, ab.dmg || 0);
      sim.emit({ e: 'splash', x: h.x, z: h.z, r: ab.radius || 4, atk: 'wucht' });
      break;
    }
    case 'buff_self': h.buffs.push({ t: ab.dur, haste: ab.haste || 0, lifesteal: ab.lifesteal || 0, armor: ab.armor || 0, dmg: ab.dmgBuff || 0, kind: 'self' }); break;
    case 'aura_vassals': {
      for (const e of alliesNear(sim, h, h.x, h.z, ab.radius)) {
        if (e.type !== 'f') continue;
        e.hbArmor = ab.armor || 0; e.hbHaste = ab.haste || 0; e.hbRegen = ab.regen || 0; e.hbT = ab.dur;
      }
      break;
    }
    case 'heal_area': for (const e of alliesNear(sim, h, h.x, h.z, ab.radius)) healEnt(sim, h, e, ab.heal); break;
    case 'shield': {
      const t = (target.id && sim.entities.get(target.id)) || h;
      t.shield = (t.shield || 0) + ab.absorb * h.power; t.shieldT = ab.dur;
      sim.emit({ e: 'shield', id: t.id, x: t.x, z: t.z });
      break;
    }
    case 'mark': if (tgt) { tgt.cursePct = Math.max(tgt.cursePct, ab.pct); tgt.curseT = ab.dur; tgt.marked = h.owner; } break;
    case 'dot': if (tgt) { tgt.dots = tgt.dots || []; tgt.dots.push({ dmg: ab.dmg * h.power, left: ab.ticks, every: ab.tick || 1, next: ab.tick || 1, src: h.id }); hit(sim, h, tgt, 0.001, { noCrit: true }); } break;
    case 'root_target': if (tgt) hit(sim, h, tgt, ab.dmg || 0, { root: ab.root }); break;
    case 'taunt': {
      h.tauntT = ab.dur || 5;
      h.buffs.push({ t: ab.dur || 5, armor: ab.armorBuff || 0, kind: 'taunt' });
      for (const e of enemiesNear(sim, h, h.x, h.z, ab.radius)) { e.target = h.id; e.forcedT = ab.dur || 5; }
      break;
    }
    case 'summon':
    case 'turret': {
      const n = ab.count || 1;
      const ud = UNITS[ab.unit];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = ab.type === 'turret' ? target.x : h.x + Math.sin(a) * 2, pz = ab.type === 'turret' ? target.z : h.z + Math.cos(a) * 2;
        const c = clampLane(sim, h, px, pz);
        const f = sim.spawnFighter(sim.players[h.owner], ud, -1, -1, c.x, c.z);
        f.temp = ab.dur; f.summon = true;
        const pw = h.power / Math.max(1, Math.pow(1.11, 0));
        f.maxHp = f.hp = Math.round(ud.hp * pw * 0.8);
        f.powerMul = pw * 0.7;
        if (ab.type === 'turret') f.fixed = true;
        sim.emit({ e: 'build', pid: h.owner, id: f.id, x: c.x, z: c.z, unit: ud.id, summon: true });
      }
      break;
    }
    case 'revive': {
      for (const e of sim.entities.values()) {
        if (e.type !== 'f' || e.owner !== h.owner || (e.x - h.x) ** 2 + (e.z - h.z) ** 2 > ab.radius ** 2) continue;
        if (!e.alive) { e.alive = true; e.hp = e.maxHp * 0.5; sim.emit({ e: 'revive', id: e.id, x: e.x, z: e.z }); }
        else healEnt(sim, h, e, ab.heal);
      }
      healEnt(sim, h, h, ab.heal);
      break;
    }
    case 'pull': {
      for (const e of enemiesNear(sim, h, target.x, target.z, ab.radius)) {
        e.x += (target.x - e.x) * 0.75; e.z += (target.z - e.z) * 0.75;
        hit(sim, h, e, ab.dmg || 0);
      }
      sim.emit({ e: 'splash', x: target.x, z: target.z, r: ab.radius, atk: 'chaos' });
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- Tick
export function updateHero(sim, h, creeps) {
  const def = heroDef(h);
  const p = sim.players[h.owner];
  for (let i = 0; i < 5; i++) if (h.cds[i] > 0) h.cds[i] = Math.max(0, h.cds[i] - DT);
  if (h.gcd > 0) h.gcd = Math.max(0, h.gcd - DT);
  if (h.atkCd > 0) h.atkCd -= DT;
  if (h.tauntT > 0) h.tauntT -= DT;
  if (h.shieldT > 0) { h.shieldT -= DT; if (h.shieldT <= 0) h.shield = 0; }
  for (let i = h.buffs.length - 1; i >= 0; i--) { h.buffs[i].t -= DT; if (h.buffs[i].t <= 0) h.buffs.splice(i, 1); }

  if (!h.alive) {
    h.respawn -= DT;
    if (h.respawn <= 0) {
      h.alive = true; h.hp = h.maxHp * 0.6; h.x = sim.laneX(h.lane); h.z = LANE_END_Z - 4; h.y = 0;
      sim.emit({ e: 'heroRespawn', id: h.id, pid: h.owner, x: h.x, z: h.z });
    }
    return;
  }
  h.res = Math.min(h.resMax, h.res + def.resRegen * DT);
  if (h.slowT > 0) { h.slowT -= DT; if (h.slowT <= 0) h.slowPct = 0; }
  if (h.stun > 0) h.stun -= DT;
  if (h.rootT > 0) h.rootT -= DT;

  // Bewegung (WoW-Prinzip): Blickrichtung kommt absolut vom Client, Bewegung relativ dazu
  const inp = p.hin || { f: 0, s: 0, yaw: 0, jump: 0 };
  if (h.stun <= 0) h.face = inp.yaw / 1000;
  const fx = Math.sin(h.face), fz = Math.cos(h.face);
  let wantX = 0, wantZ = 0;
  if (h.stun <= 0 && h.rootT <= 0 && (inp.f || inp.s)) {
    // rechts = (−cos, sin) bei Blick (sin, cos) und Y nach oben (Rechtshand, Blick +Z → rechts −X)
    const rx = -fz, rz = fx;
    let mx = fx * inp.f + rx * inp.s, mz = fz * inp.f + rz * inp.s;
    const len = Math.hypot(mx, mz) || 1;
    const speed = (inp.f < 0 ? HS.backSpeed : HS.runSpeed) * (1 - h.slowPct);
    wantX = (mx / len) * speed; wantZ = (mz / len) * speed;
  }
  if (h.grounded) {
    h.vx = wantX; h.vz = wantZ;
    if (inp.jump && h.stun <= 0 && h.rootT <= 0) { h.vy = HS.jumpV; h.grounded = false; inp.jump = 0; sim.emit({ e: 'heroJump', id: h.id }); }
  } else {
    // in der Luft nur minimale Richtungsänderung
    h.vx += (wantX - h.vx) * 0.04; h.vz += (wantZ - h.vz) * 0.04;
  }
  const moved = Math.abs(h.vx) + Math.abs(h.vz) > 0.01 || !h.grounded;
  if (moved) {
    h.x += h.vx * DT; h.z += h.vz * DT; h.moving = sim.tick;
    const c = clampLane(sim, h, h.x, h.z); h.x = c.x; h.z = c.z;
  }
  if (!h.grounded) {
    h.vy -= HS.gravity * DT; h.y += h.vy * DT;
    if (h.y <= 0) { h.y = 0; h.vy = 0; h.grounded = true; sim.emit({ e: 'heroLand', id: h.id }); }
  }
  // Bewegung bricht Zauber ab (auch Kanalisieren)
  if (h.cast && (moved && (inp.f || inp.s || !h.grounded))) {
    sim.emit({ e: 'castCancel', id: h.id, pid: h.owner, slot: h.cast.slot });
    h.zones = h.zones.filter((z) => !z.bound);
    if (!h.cast.channel) { h.res = Math.min(h.resMax, h.res + h.cast.ab.cost); h.cds[h.cast.slot] = 0; }
    h.cast = null;
  }
  if (h.stun > 0 && h.cast) { h.cast = null; h.zones = h.zones.filter((z) => !z.bound); }

  // Zauber / Kanalisieren
  if (h.cast) {
    const c = h.cast;
    c.t += DT;
    if (c.channel) {
      c.nextTick -= DT;
      if (c.nextTick <= 0 && c.ticksDone < (c.ab.ticks || 1)) {
        c.nextTick += c.ab.tick || 1; c.ticksDone++;
        if (c.ab.type === 'drain') {
          const t = sim.entities.get(c.target.id);
          if (t && t.alive) { const d = hit(sim, h, t, c.ab.dmg); h.hp = Math.min(h.maxHp, h.hp + d); sim.emit({ e: 'heal', src: t.id, tgt: h.id, x: h.x, z: h.z, amount: Math.round(d) }); }
        }
      }
      if (c.t >= c.total) { h.cast = null; h.zones = h.zones.filter((z) => !z.bound); }
    } else if (c.t >= c.total) {
      h.cast = null;
      const t = c.target.id ? sim.entities.get(c.target.id) : null;
      if (c.target.id && (!t || !t.alive)) sim.emit({ e: 'heroError', pid: h.owner, reason: 'Ziel verloren' });
      else execute(sim, h, c.slot, c.ab, c.target);
    }
  }
  // Warteschlange
  if (h.queued && !h.cast) {
    const q = h.queued;
    const ab = def.abilities[q.slot];
    if (h.cds[q.slot] <= 0 && (!ab.gcd || h.gcd <= 0)) { h.queued = null; tryCast(sim, h, q.slot, q, false); }
  }

  // Bodeneffekte
  for (let i = h.zones.length - 1; i >= 0; i--) {
    const z = h.zones[i];
    z.next -= DT;
    if (z.next > 0) continue;
    for (const e of enemiesNear(sim, h, z.x, z.z, z.r)) hit(sim, h, e, z.dmg, { stun: z.stun, noCrit: true });
    if (z.heal) for (const a of alliesNear(sim, h, z.x, z.z, z.r)) healEnt(sim, h, a, z.heal);
    sim.emit({ e: 'zoneTick', x: z.x, z: z.z, r: z.r, heal: !!z.heal && !z.dmg, big: z.delayed });
    z.done++;
    if (z.done >= z.ticks) h.zones.splice(i, 1); else z.next = z.tick || 1;
  }

  // Automatischer Angriff
  if (h.auto && !h.cast && h.stun <= 0) {
    const t = sim.entities.get(h.target);
    if (!t || !t.alive) { h.auto = false; }
    else {
      const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1) > 0.2;
      if (d <= def.range + 1 && facing && h.atkCd <= 0) {
        h.atkCd = def.cd / (1 + buffVal(h, 'haste'));
        h.atkT = sim.time;
        if (def.range > 4) {
          const pr = { id: sim.nextId++, type: 'p', src: h.id, tgt: t.id, x: h.x, z: h.z, y: 1.6, dmg: def.dmg * h.power, atk: def.atk, abil: {}, side: 'f', speed: 26, kind: def.atk === 'stich' ? 'arrow' : def.atk === 'chaos' ? 'void' : 'magic', lane: h.lane, team: h.team, ox: h.x, oz: h.z, tx: t.x, tz: t.z, hero: true };
          sim.entities.set(pr.id, pr);
          sim.emit({ e: 'attack', id: h.id, tgt: t.id, melee: false, atk: def.atk, proj: pr.id, kind: pr.kind });
        } else {
          sim.emit({ e: 'attack', id: h.id, tgt: t.id, melee: true, atk: def.atk });
          hit(sim, h, t, def.dmg);
        }
      }
    }
  }
}

/** Held wird getroffen (Schild zuerst) – gibt tatsächlichen Schaden zurück */
export function heroTakeDamage(sim, h, amount) {
  if (h.shield > 0) {
    const a = Math.min(h.shield, amount);
    h.shield -= a; amount -= a;
  }
  h.hp -= amount;
  return amount;
}

export function heroDied(sim, h) {
  h.alive = false;
  h.hp = 0;
  h.cast = null; h.zones = []; h.auto = false;
  h.respawn = Math.min(20, 6 + sim.wave * 0.5);
  sim.emit({ e: 'heroDeath', id: h.id, pid: h.owner, x: h.x, z: h.z, respawn: h.respawn });
}

export function heroGainXp(sim, h, xp) {
  if (h.level >= HS.maxLevel) return;
  h.xp += xp;
  while (h.level < HS.maxLevel && h.xp >= HS.xpForLevel[h.level]) {
    h.level++;
    const def = heroDef(h);
    h.power = heroPower(sim.wave, h.level);
    const ratio = h.hp / h.maxHp;
    h.maxHp = Math.round(def.hp * heroHpMul(sim.wave, h.level));
    h.hp = h.maxHp * Math.max(ratio, 0.5);
    sim.emit({ e: 'heroLevel', id: h.id, pid: h.owner, level: h.level, ult: h.level === HS.ultLevel, x: h.x, z: h.z });
  }
}

// ---------------------------------------------------------------- Bot-Held
/** Einfache, faire Bot-Steuerung: Ziel suchen, hinlaufen, Fähigkeiten nutzen. */
export function heroBotThink(sim, h) {
  const p = sim.players[h.owner];
  if (!h.alive || sim.phase !== 'battle' || sim.freeze > 0) { p.hin = { f: 0, s: 0, yaw: Math.round(h.face * 1000), jump: 0 }; return; }
  const def = heroDef(h);
  // Bot-Helden kämpfen bei ihren Vasallen (vor dem Bauraster), statt allein zum Portal zu laufen
  const lx0 = sim.laneX(h.lane);
  let best = null, bd = Infinity;
  for (const e of sim.entities.values()) {
    if (e.type !== 'c' || !e.alive || e.lane !== h.lane || e.stage !== 'lane') continue;
    if (e.z < BUILD_Z0 - 9) continue;
    const d = (e.x - h.x) ** 2 + (e.z - h.z) ** 2 - (e.def.leader ? 60 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) {
    const lx = lx0, hz = BUILD_Z0 - 1;
    const dx = lx - h.x, dz = hz - h.z;
    if (Math.hypot(dx, dz) > 1.5) p.hin = { f: 1, s: 0, yaw: Math.round(Math.atan2(dx, dz) * 1000), jump: 0 };
    else p.hin = { f: 0, s: 0, yaw: Math.round(Math.PI * 1000), jump: 0 };
    return;
  }
  const dx = best.x - h.x, dz = best.z - h.z, d = Math.hypot(dx, dz);
  const yaw = Math.round(Math.atan2(dx, dz) * 1000);
  const skilled = p.difficulty === 'hard' || p.difficulty === 'extreme';
  // Ausweichen: aus angekündigten Bodenwarnungen herauslaufen (schwere/extreme Bots)
  if (skilled && sim.telegraphs) {
    sim.telegraphs = sim.telegraphs.filter((t) => t.until > sim.time);
    const danger = sim.telegraphs.find((t) => t.lane === h.lane && inTelegraph(t, h.x, h.z));
    if (danger) {
      const ax = h.x - (danger.shape === 'circle' ? danger.x : (danger.x + danger.x2) / 2), az = h.z - (danger.shape === 'circle' ? danger.z : (danger.z + danger.z2) / 2);
      const side = danger.shape === 'line' ? Math.atan2(-(danger.z2 - danger.z), danger.x2 - danger.x) : Math.atan2(ax || 0.1, az);
      p.hin = { f: 1, s: 0, yaw: Math.round(side * 1000), jump: 0 };
      return;
    }
  }
  // Unterbrechen: wirkt ein Anführer einen unterbrechbaren Zauber, mit einer Betäubung kontern
  if (skilled) {
    for (const e of sim.entities.values()) {
      if (e.type !== 'c' || !e.alive || e.lane !== h.lane || !e.lcast || !LEADER_INTERRUPT.has(e.lcast.k)) continue;
      for (let slot = 0; slot < 5; slot++) {
        const ab = abilityAt(def.abilities[slot], h.level, slot);
        if (!(ab.stun || ab.root) || h.cds[slot] > 0 || h.res < ab.cost || (ab.gcd && h.gcd > 0) || h.cast) continue;
        const dd = Math.hypot(e.x - h.x, e.z - h.z);
        if (ab.type === 'aoe_self' ? dd > ab.radius : dd > (ab.range || 3) + 1) continue;
        p.hin = { f: 0, s: 0, yaw: Math.round(Math.atan2(e.x - h.x, e.z - h.z) * 1000), jump: 0 };
        if (tryCast(sim, h, slot, { target: e.id, x: e.x, z: e.z }, false)) return;
      }
    }
  }
  const want = def.range > 4 ? def.range - 2 : 1.8;
  p.hin = { f: h.cast ? 0 : d > want ? 1 : 0, s: 0, yaw, jump: 0 };
  if (h.target !== best.id || !h.auto) { h.target = best.id; h.auto = true; }
  if (h.cast || h.gcd > 0) return;
  // Fähigkeit wählen: Heilung bei Bedarf, sonst die stärkste verfügbare
  const order = [4, 3, 1, 2, 0];
  for (const slot of order) {
    const ab = abilityAt(def.abilities[slot], h.level, slot);
    if (h.cds[slot] > 0 || h.res < ab.cost) continue;
    if (['heal_area', 'revive'].includes(ab.type)) {
      let hurt = 0; for (const a of alliesNear(sim, h, h.x, h.z, ab.radius)) if (a.alive && a.hp < a.maxHp * 0.6) hurt++;
      if (hurt < 2) continue;
    }
    if (['aoe_self', 'taunt'].includes(ab.type) && enemiesNear(sim, h, h.x, h.z, ab.radius).length < 2) continue;
    if (['aura_vassals'].includes(ab.type) && enemiesNear(sim, h, h.x, h.z, 12).length < 3) continue;
    if (ab.type === 'leap_back' || (ab.type === 'blink' && !ab.behind)) continue;
    if (ab.range && d > ab.range && !['aoe_self', 'heal_area', 'aura_vassals', 'buff_self', 'taunt', 'revive', 'summon'].includes(ab.type)) continue;
    if (ab.cast > 0 && sim.rng.next() < 0.3) continue;
    if (tryCast(sim, h, slot, { target: best.id, x: best.x, z: best.z }, false)) { p.hin.f = 0; return; }
  }
}

const LEADER_INTERRUPT = new Set(['heal', 'shield', 'summon']);

export function isHeroEnt(e) { return e && e.type === 'h'; }
export { DAMAGE_TABLE, armorReduction };
