// Aether-Forge – Besetzungsliste: welche gebackene Figur stellt welche Einheit dar (nur Grafik, Simulation bleibt
// unberührt). Jede Linie eines Volks hat einen eigenen Archetyp; jede der fünf Formen (I, II-A, II-B, III-A, III-B)
// ist eine eigene Skulptur (Datei unit_<archetyp>_<form>.afm). Jede Welle hat ihre eigene Kreatur-Silhouette.

export const FORMS = ['1', '2a', '2b', '3a', '3b'];

/** Volk → Linie → Archetyp (alle 8 Linien eines Volks verschieden) */
export const LINE_ARCH = {
  orden: { squire: 'knight', archer: 'archer', priest: 'priest', guard: 'paladin_heavy', griffin: 'griffin', lancer: 'lancer', monk: 'monk', ballista: 'ballista' },
  wild: { treant: 'treant', wolf: 'wolf', druid: 'druid', shroom: 'mushroom', bear: 'bear', owl: 'owl', stag: 'stag', ent: 'dryad' },
  schmiede: { auto: 'automaton', walker: 'walker', mortar: 'mortar', core: 'core', spider: 'spider', drone: 'drone', tank: 'tank', arc: 'tesla' },
  abgrund: { shade: 'shade', bone: 'bonethrower', void: 'voidmage', golem: 'cryptgolem', witch: 'witch', ghoul: 'ghoul', banshee: 'banshee', gargoyle: 'gargoyle' },
  schwarm: { crawler: 'crawler', spitter: 'beetle', carapace: 'carapace', hunter: 'raptor', queen: 'queen', locust: 'locust', mantis: 'mantis', colossus: 'brute' },
  glut: { ember: 'elemental', pyromancer: 'pyromancer', salamander: 'salamander', imp: 'imp', hound: 'hound', golem: 'golem', priestess: 'priest_glut', phoenix: 'phoenix' },
};

/** Volks-Stil je Archetyp (Formsprache der Stufen-Anbauten) */
export const ARCH_STYLE = {};
for (const [fid, lines] of Object.entries(LINE_ARCH)) for (const a of Object.values(lines)) ARCH_STYLE[a] = ARCH_STYLE[a] || fid;
Object.assign(ARCH_STYLE, { knightfallen: 'abgrund', serpent: 'schwarm' });

/** Schwebende Archetypen (Auf-und-ab-Wippen) */
export const HOVER_ARCH = new Set(['core', 'drone', 'banshee', 'imp', 'locust', 'shade', 'worker', 'boss_drake', 'dryad']);
/** Laufzeit-Grundmaßstab je Archetyp (Zellen-Ausfüllung: Stufe II ≈ 2-m-Zelle) */
export const ARCH_FIT = {
  knight: 1.18, archer: 1.12, priest: 1.12, paladin_heavy: 1.0, griffin: 1.15, lancer: 1.12, monk: 1.2, ballista: 1.15,
  treant: 1.0, wolf: 1.3, druid: 1.12, mushroom: 1.2, bear: 1.2, owl: 1.2, stag: 1.1, dryad: 1.15,
  automaton: 1.18, walker: 1.12, mortar: 1.2, core: 1.25, spider: 1.25, drone: 1.15, tank: 1.15, tesla: 1.12,
  shade: 1.2, bonethrower: 1.15, voidmage: 1.1, cryptgolem: 1.0, witch: 1.1, ghoul: 1.3, banshee: 1.15, gargoyle: 1.25,
  crawler: 1.3, beetle: 1.3, carapace: 1.15, raptor: 1.2, queen: 1.1, locust: 1.35, mantis: 1.1, brute: 1.05,
  elemental: 1.15, pyromancer: 1.12, salamander: 1.25, imp: 1.45, hound: 1.3, golem: 1.15, priest_glut: 1.1, phoenix: 1.15,
  knightfallen: 1.1, serpent: 1.0,
};
/** Formfaktor: Stufe I klein/schlicht → II spürbar größer → III Verwandlung */
export const TIER_SCALE = { 1: 0.86, 2: 1.0, 3: 1.14 };

/** Formkürzel einer Kämpfer-Definition (sim UNITS) */
export function formOf(def) {
  if (!def) return '1';
  const t = Math.max(1, Math.min(3, def.tier | 0 || 1));
  return t === 1 ? '1' : `${t}${def.branch === 'b' ? 'b' : 'a'}`;
}
export function fighterArch(def) {
  return (LINE_ARCH[def.faction] && LINE_ARCH[def.faction][def.line]) || def.model;
}

/** Wellen 1..30: [Archetyp, Form] – jede Welle eine eigene Silhouette */
export const WAVE_ARCH = [
  ['crawler', '1'], ['hound', '1'], ['carapace', '1'], ['imp', '1'], ['brute', '1'],
  ['raptor', '1'], ['elemental', '2a'], ['serpent', '1'], ['golem', '2b'], ['boss_titan', '1'],
  ['knightfallen', '1'], ['salamander', '2b'], ['spider', '2a'], ['imp', '2b'], ['carapace', '3a'],
  ['raptor', '2a'], ['brute', '2a'], ['serpent', '2a'], ['elemental', '3b'], ['boss_drake', '1'],
  ['mantis', '2b'], ['golem', '3a'], ['knightfallen', '3a'], ['imp', '3b'], ['brute', '3a'],
  ['raptor', '3a'], ['banshee', '3b'], ['serpent', '3b'], ['carapace', '3b'], ['boss_lord', '1'],
];
/** Söldner (Senden) */
export const SEND_ARCH = { s_rat: ['crawler', '2b'], s_hound: ['hound', '2a'], s_beetle: ['beetle', '2a'], s_imp: ['imp', '2a'], s_ogre: ['brute', '2b'], s_golem: ['golem', '2a'], s_knight: ['knightfallen', '2b'] };
/** Gegner-Maßstab je Archetyp (Wellen) */
export const CREEP_FIT = { boss_titan: 1.25, boss_drake: 1.2, boss_lord: 1.2 };

/** Gegner-Definition → { arch, form, lead } */
export function creepModel(def) {
  if (!def) return { arch: 'crawler', form: '1', lead: false };
  const lead = !!(def.champion || def.leader);
  const key = String(def.key || def.id || '');
  if (SEND_ARCH[key]) return { arch: SEND_ARCH[key][0], form: SEND_ARCH[key][1], lead };
  const w = def.n && WAVE_ARCH[def.n - 1];
  if (w && sameFamily(w[0], def.model)) return { arch: w[0], form: w[1], lead };
  // Kampagnen-/Sonder-Gegner: Archetyp aus dem Modellnamen, Form nach Wellennummer
  const n = def.n || 1;
  const form = def.boss ? '1' : n > 20 ? '3a' : n > 10 ? '2a' : '1';
  return { arch: def.model || 'crawler', form, lead };
}
// Welle n darf nur dann umbesetzt werden, wenn das Sim-Modell zur Wellen-Familie passt (Kampagnen ändern Modelle)
const FAMILY = { carapace: 'beetle', spider: 'crawler', salamander: 'hound', mantis: 'crawler', banshee: 'elemental' };
function sameFamily(arch, model) { return arch === model || FAMILY[arch] === model; }

/** Alle zu backenden (Archetyp, Form)-Paare */
export function bakeList() {
  const set = new Map();
  const add = (a, f) => set.set(`${a}_${f}`, [a, f]);
  for (const lines of Object.values(LINE_ARCH)) for (const a of Object.values(lines)) for (const f of FORMS) add(a, f);
  for (const [a, f] of WAVE_ARCH) add(a, f);
  for (const [a, f] of Object.values(SEND_ARCH)) add(a, f);
  for (const a of ['king', 'worker', 'boss_titan', 'boss_drake', 'boss_lord']) add(a, '1');
  for (const a of ['knightfallen', 'serpent']) for (const f of FORMS) add(a, f);
  return [...set.values()];
}
