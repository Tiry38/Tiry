// Client-seitige Vorhersage der Heldenbewegung.
// Die Simulation (sim/hero.js) bewegt den Helden erst im nächsten Tick (und online erst nach der Netz-Laufzeit).
// Damit sich die Steuerung trotzdem verzögerungsfrei anfühlt, rechnen wir dieselben Bewegungsregeln lokal
// jedes Bild mit und gleichen weich mit dem Stand der Simulation ab:
//   R = Sim-Zustand + Nachrechnen der noch nicht bestätigten Zeit (Verzögerung) mit der aktuellen Eingabe
//   P = lokal integrierte Position (sofortige Reaktion)
//   P folgt R: kleine Abweichungen werden weich angeglichen, ab 2 m wird gesprungen.
import { HERO_STATS as HS } from '../sim/heroes.js';
import { LANE_WIDTH, LANE_SPAWN_Z, LANE_END_Z } from '../sim/layout.js';

export const SIM_DT = 1 / 20;
export const SNAP_DIST = 2;

/** Bewegungsgrenzen der Bahn – identisch zu clampLane() in sim/hero.js */
export function laneClamp(lx, x, z) {
  const hw = LANE_WIDTH / 2 - 0.6;
  return { x: Math.max(lx - hw, Math.min(lx + hw, x)), z: Math.max(LANE_SPAWN_Z - 4, Math.min(LANE_END_Z + 1.5, z)) };
}

/** Wunsch-Geschwindigkeit aus Eingabe (f vor/zurück, s seitwärts rechts) und Blickrichtung – wie in der Sim */
export function wishVelocity(face, f, s, slowPct = 0) {
  if (!f && !s) return [0, 0];
  const fx = Math.sin(face), fz = Math.cos(face);
  const rx = -fz, rz = fx;
  const mx = fx * f + rx * s, mz = fz * f + rz * s;
  const len = Math.hypot(mx, mz) || 1;
  const speed = (f < 0 ? HS.backSpeed : HS.runSpeed) * (1 - slowPct);
  return [(mx / len) * speed, (mz / len) * speed];
}

/**
 * Ein Bewegungsschritt nach exakt den Regeln von updateHero() (variabler Zeitschritt).
 * st: { x, z, y, vx, vz, vy, grounded }  ·  inp: { f, s, face, jump }  ·  mods: { stun, root, slow, lx }
 * Rückgabe: true, wenn in diesem Schritt abgesprungen wurde.
 */
export function stepMotion(st, inp, dt, mods) {
  const canMove = !(mods.stun > 0) && !(mods.root > 0);
  let jumped = false;
  const [wx, wz] = canMove ? wishVelocity(inp.face, inp.f, inp.s, mods.slow || 0) : [0, 0];
  if (st.grounded) {
    st.vx = wx; st.vz = wz;
    if (inp.jump && canMove) { st.vy = HS.jumpV; st.grounded = false; jumped = true; }
  } else {
    // in der Luft kaum Richtungsänderung (Sim: 4 % pro 50-ms-Tick)
    const k = 1 - Math.pow(1 - 0.04, dt / SIM_DT);
    st.vx += (wx - st.vx) * k; st.vz += (wz - st.vz) * k;
  }
  if (Math.abs(st.vx) + Math.abs(st.vz) > 0.01 || !st.grounded) {
    st.x += st.vx * dt; st.z += st.vz * dt;
    const c = laneClamp(mods.lx, st.x, st.z); st.x = c.x; st.z = c.z;
  }
  if (!st.grounded) {
    st.vy -= HS.gravity * dt; st.y += st.vy * dt;
    if (st.y <= 0) { st.y = 0; st.vy = 0; st.grounded = true; }
  }
  return jumped;
}

/** Zeitspanne in festen Unterschritten nachrechnen */
export function replay(st, inp, time, mods) {
  let left = Math.max(0, Math.min(1, time));
  let jumpUsed = false;
  while (left > 1e-5) {
    const dt = Math.min(SIM_DT, left);
    if (stepMotion(st, { ...inp, jump: inp.jump && !jumpUsed }, dt, mods)) jumpUsed = true;
    left -= dt;
  }
  return st;
}

export class HeroPredictor {
  constructor() {
    this.P = null;          // lokal integrierter Zustand
    this.R = null;          // Rekonstruktion aus der Sim
    this.lag = 0.03;        // geschätzte Verzögerung bis die Sim eine Eingabe übernimmt (Sim-Sekunden)
    this.err = 0;           // aktuelle Abweichung (Diagnose)
    this.snaps = 0;
  }
  reset(h) {
    const s = { x: h.x, z: h.z, y: h.y || 0, vx: 0, vz: 0, vy: h.vy || 0, grounded: h.grounded !== false };
    this.P = { ...s }; this.R = { ...s };
    this.err = 0;
  }
  /** Gemessene Verzögerung einspeisen (z. B. Zeit zwischen Senden einer Eingabe und deren Ankunft in der Sim) */
  observeLag(sec) { this.lag += (Math.max(0, Math.min(0.6, sec)) - this.lag) * 0.2; }

  /**
   * dt: Bildzeit in Sim-Sekunden · h: Sim-Held · inp: { f, s, face } · lag: Sim-Zeit seit dem letzten Tick
   * bzw. Netzverzögerung · lx: Bahnmitte · jumpEdge: in diesem Bild gedrückt · jumpPending: gesendet, Sim noch nicht gesprungen
   */
  update(dt, h, inp, lag, lx, jumpEdge = false, jumpPending = false) {
    if (!this.P || !h.alive) { this.reset(h); return this.P; }
    const mods = { stun: h.stun, root: h.rootT, slow: h.slowPct, lx };
    // R: Sim-Stand + Nachrechnen der unbestätigten Zeit
    const R = { x: h.x, z: h.z, y: h.y || 0, vx: h.vx || 0, vz: h.vz || 0, vy: h.vy || 0, grounded: h.grounded !== false };
    replay(R, { ...inp, jump: jumpPending }, lag, mods);
    this.R = R;
    // P: lokal mit derselben Regel weiterrechnen
    stepMotion(this.P, { ...inp, jump: jumpEdge }, Math.min(dt, 0.1), mods);
    const ex = R.x - this.P.x, ez = R.z - this.P.z, ey = R.y - this.P.y;
    const d = Math.hypot(ex, ez);
    this.err = d;
    if (d > SNAP_DIST || mods.stun > 0 || mods.root > 0 && d > 0.6) {
      // große Abweichung (Teleport, Ansturm, Rückstoß, Betäubung) → übernehmen
      if (d > SNAP_DIST) this.snaps++;
      Object.assign(this.P, R);
    } else {
      const k = 1 - Math.exp(-dt * 7);
      this.P.x += ex * k; this.P.z += ez * k;
      // Höhe: lokal gerechnet (Sprung ohne Verzögerung). Nur wenn die Sim den Helden selbst in die Luft
      // bringt (Rückwärtssalto, Raketensprung) oder stark abweicht, übernehmen wir ihren Zustand.
      if (Math.abs(ey) > 1.2 || (this.P.grounded && !R.grounded && R.y > 0.5 && !jumpPending)) { this.P.y = R.y; this.P.vy = R.vy; this.P.grounded = R.grounded; }
    }
    return this.P;
  }
}
