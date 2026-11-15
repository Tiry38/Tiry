// Aether-Forge – Laufzeit-Varianten. Die Entwicklungsstufen der Vasallen (I, II-A/B, III-A/B) sind fertig gebackene
// Skulpturen (designs/form.js + roster.js); zur Laufzeit kommen nur noch Anführer-Abzeichen dazu: Krone am exakt
// gebackenen Kopfpunkt und ein Aura-Ring am Boden, dazu stärkeres Leuchten.
const cache = new Map();

/** Vasallen: keine Laufzeit-Teile mehr (Formen sind gebacken) */
export function unitVariant(def) { void def; return null; }

/** Gegner: Anführer/Champion bekommen Krone + Aura, Bosse nur mehr Leuchten */
export function creepVariant(def) {
  if (!def) return null;
  const lead = !!(def.champion || def.leader);
  const key = 'c' + (def.key || def.id || def.n) + (lead ? 'L' : '');
  let v = cache.get(key);
  if (v) return v;
  v = lead ? { parts: ['crown', 'aura'], glow: 1.6 } : def.boss ? { parts: [], glow: 1.4 } : null;
  cache.set(key, v);
  return v;
}
