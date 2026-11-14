// Zeitachsen der Heldenaktionen: Dauer jeder Animation und der Moment, in dem der Treffer sichtbar wird.
// Die Simulation rechnet den Treffer sofort; die Darstellung (Funken, Zahl, Aufblitzen, Klang) wird auf
// den Treffer-Moment der Animation gelegt – wie in WoW: Taste → Ausholen → Einschlag.
import { HEROES } from '../sim/heroes.js';

// dur: Sekunden · hit: Anteil 0..1 der Dauer bis zum Einschlag · hits: mehrere Einschläge (Anteile)
export const ANIM_TIME = {
  melee: { dur: 0.62, hit: 0.45 },
  shoot: { dur: 0.75, hit: 0.45 },
  bash: { dur: 0.55, hit: 0.45 },
  roar: { dur: 0.95, hit: 0.45 },
  charge: { dur: 0.6, hit: 0.45 },
  guard: { dur: 0.85, hit: 0.45 },
  slam: { dur: 0.95, hit: 0.45 },
  cast: { dur: 0.55, hit: 0.45 },
  heal: { dur: 0.8, hit: 0.45 },
  draw: { dur: 0.55, hit: 0.45 },
  volley: { dur: 0.7, hit: 0.45 },
  flip: { dur: 0.75, hit: 0.45 },
  bandage: { dur: 1.0, hit: 0.45 },
  skyshot: { dur: 0.8, hit: 0.45 },
  nova: { dur: 0.65, hit: 0.45 },
  blink: { dur: 0.45, hit: 0.45 },
  skycast: { dur: 0.85, hit: 0.45 },
  overhead: { dur: 0.75, hit: 0.45 },
  spin: { dur: 0.75, hit: 0.45 },
  leap: { dur: 0.85, hit: 0.45 },
  stab: { dur: 0.45, hit: 0.45 },
  slash: { dur: 0.5, hit: 0.45 },
  breath: { dur: 0.95, hit: 0.45 },
  flurry: { dur: 1.25, hit: 0.2, hits: [0.18, 0.32, 0.46, 0.6, 0.72, 0.82, 0.9] },
};
// Anteil der Zauber-Pose, der während der Zauberzeit erreicht wird (der Rest = Freisetzen)
export const CAST_HOLD = 0.45; // Freisetzung (Treffer-Moment der Clips, t≈0,45) fällt genau auf das Zauberende

export function animTime(kind) { return ANIM_TIME[kind] || ANIM_TIME.cast; }

/** Animationsname einer Fähigkeit (Datenfeld anim; Ersatz nach Typ) */
export function abilityAnim(heroId, slot) {
  const ab = HEROES[heroId]?.abilities[slot];
  if (!ab) return 'cast';
  if (ab.anim) return ab.anim;
  return { strike: 'bash', aoe_self: 'slam', taunt: 'roar', cone: 'volley', dash: 'charge', leap: 'leap', blink: 'blink', heal_area: 'heal', heal_self: 'guard', aoe_ground: 'skycast' }[ab.type] || 'cast';
}

/** Auto-Angriff: Fernkämpfer schießen/werfen, Nahkämpfer schlagen */
export function autoAnim(heroId) {
  const d = HEROES[heroId];
  if (!d) return 'melee';
  return d.range > 4 ? 'shoot' : 'melee';
}

/** Treffer erscheinen erst im Einschlag-Moment – nur für Fähigkeiten ohne eigenes Geschoss */
export function impactDelay(heroId, slot, type) {
  if (['bolt', 'aoe_ground', 'drain', 'summon', 'turret', 'shield'].includes(type)) return 0;
  const T = animTime(abilityAnim(heroId, slot));
  return T.dur * T.hit;
}
