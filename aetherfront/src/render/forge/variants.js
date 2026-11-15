// Aether-Forge – Bau-Grammatik für Einheiten: Grundkörper (Archetyp der Linie) + Stufen-Modifikator (I schlicht,
// II größer/mehr Rüstung, III verwandelt: Flügel/Aura/Leuchten) + Pfad-Modifikator (A = schwere Panzerung,
// B = magisch/elementar) + Volks-Stil (Formsprache je Volk) + Wellen-/Anführer-Modifikatoren für Gegner.
// Ergebnis: { parts: [Anbauteile], widen, glow } – der Lader setzt die vorgebackenen Teile an Ankerpunkte.

const STYLE = {
  //            Pfad A Stufe II / III                      Pfad B Stufe II / III
  orden:    { a2: ['pauldron'], a3: ['pauldron', 'crest', 'halo'], b2: ['halo'], b3: ['halo', 'wings_feather', 'aura'] },
  wild:     { a2: ['antlers'], a3: ['antlers', 'spikes'], b2: ['crystals'], b3: ['antlers', 'crystals', 'aura'] },
  schmiede: { a2: ['pauldron'], a3: ['pauldron', 'gears', 'crest'], b2: ['gears'], b3: ['gears', 'crystals', 'aura'] },
  abgrund:  { a2: ['spikes'], a3: ['spikes', 'horns', 'pauldron'], b2: ['crystals'], b3: ['horns', 'wings_bat', 'aura'] },
  schwarm:  { a2: ['backspikes'], a3: ['backspikes', 'spikes', 'horns'], b2: ['crystals'], b3: ['backspikes', 'wings_bat', 'aura'] },
  glut:     { a2: ['spikes'], a3: ['spikes', 'horns', 'pauldron'], b2: ['flames'], b3: ['flames', 'wings_bat', 'aura'] },
};
// Linien-Akzent (Index 0..7) – macht gleiche Archetypen verschiedener Linien unterscheidbar
const LINE_ACCENT = [null, 'crest', null, 'crystals', 'spikes', null, 'halo', 'gears'];
const cache = new Map();

export function unitVariant(def) {
  if (!def) return null;
  let v = cache.get(def.id);
  if (v) return v;
  const st = STYLE[def.faction] || STYLE.orden;
  const b = def.branch === 'b' ? 'b' : 'a';
  let parts = [];
  if (def.tier === 2) parts = [...st[b + '2']];
  else if (def.tier >= 3) parts = [...st[b + '3']];
  const acc = LINE_ACCENT[def.lineIndex | 0];
  if (acc && def.tier >= 2 && !parts.includes(acc) && !(acc === 'halo' && def.faction !== 'orden')) parts.push(acc);
  v = { parts: [...new Set(parts)], widen: b === 'a' ? 1 + 0.05 * (def.tier - 1) : 1, glow: b === 'b' ? 1 + 0.5 * (def.tier - 1) : 1 };
  cache.set(def.id, v);
  return v;
}

export function creepVariant(def) {
  if (!def) return null;
  const key = 'c' + (def.key || def.id || def.n) + (def.champion ? 'C' : '');
  let v = cache.get(key);
  if (v) return v;
  const occ = def.n ? Math.floor((def.n - 1) / 10) : 1; // 1.–3. Auftreten derselben Art
  const parts = occ === 1 ? ['spikes'] : occ >= 2 ? ['horns', 'crystals'] : [];
  if (def.champion) parts.push('crown', 'aura');
  if (def.boss) parts.push('aura');
  v = { parts: [...new Set(parts)], widen: def.champion ? 1.1 : 1, glow: def.champion || def.boss ? 1.8 : 1 + 0.3 * occ, scale: def.champion ? 1.12 : 1 };
  cache.set(key, v);
  return v;
}
