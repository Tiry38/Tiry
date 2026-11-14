// Spielmodi für Gefechte (solo gegen Bots und online). Der Host wählt sie in der Lobby.
// Kürzel wie im Original-Spielprinzip kombinierbar: Auswahlmodus + optional CC, z. B. „PRCC“.
export const PICK_MODES = {
  ap: { code: 'AP', name: 'Alle wählen', desc: 'Jeder wählt seine Fraktion selbst (Zufall gibt Bonusgold).' },
  ar: { code: 'AR', name: 'Alle zufällig', desc: 'Jeder bekommt eine zufällige Fraktion und Bonusgold.' },
  pr: { code: 'PR', name: 'Zufall mit Neu-Würfeln', desc: 'Zufällige Fraktion mit Bonusgold – in der ersten Bauphase darfst du einmal neu würfeln.' },
  hp: { code: 'HP', name: 'Hybrid', desc: 'Jeder bekommt 5 zufällige Kämpferlinien aus allen Fraktionen gemischt (mit Bonusgold).' },
};
export const MODIFIERS = {
  cc: { code: 'CC', name: 'Champions', desc: 'Jeder vierte Gegner einer Welle ist ein Champion (3× Leben, mehr Schaden, 3× Kopfgeld). Bosse +25 % Leben.' },
};
export function modeCode(rules) {
  return `${PICK_MODES[rules.pickMode || 'ap'].code}${rules.champions ? 'CC' : ''}`;
}
/** Kürzel wie „prcc“ oder „HP“ in Regeln umwandeln */
export function parseModeCode(code) {
  const c = String(code || '').toLowerCase().replace(/[^a-z]/g, '');
  const pick = Object.keys(PICK_MODES).find((k) => c.startsWith(k)) || 'ap';
  return { pickMode: pick, champions: c.slice(2).includes('cc') };
}
