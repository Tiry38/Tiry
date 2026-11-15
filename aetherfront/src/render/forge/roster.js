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
  knight: 1.5, archer: 1.45, priest: 1.42, paladin_heavy: 1.25, griffin: 1.3, lancer: 1.4, monk: 1.5, ballista: 1.2,
  treant: 1.2, wolf: 1.5, druid: 1.4, mushroom: 1.35, bear: 1.35, owl: 1.35, stag: 1.3, dryad: 1.4,
  automaton: 1.45, walker: 1.3, mortar: 1.3, core: 1.35, spider: 1.35, drone: 1.3, tank: 1.25, tesla: 1.25,
  shade: 1.45, bonethrower: 1.25, voidmage: 1.35, cryptgolem: 1.2, witch: 1.35, ghoul: 1.5, banshee: 1.35, gargoyle: 1.45,
  crawler: 1.45, beetle: 1.45, carapace: 1.25, raptor: 1.4, queen: 1.25, locust: 1.5, mantis: 1.3, brute: 1.25,
  elemental: 1.35, pyromancer: 1.38, salamander: 1.35, imp: 1.6, hound: 1.45, golem: 1.3, priest_glut: 1.35, phoenix: 1.3,
  knightfallen: 1.3, serpent: 1.15, king: 1.0, worker: 1.0,
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

// ---------------------------------------------------------------------------------------------
// Entwicklungs-Storys je Linie: jede Form eine eigene Einheit (Waffen R/L, Kopf H, Extras X, Größe fit).
// Formen: 1 = Grundform · 2a/3a = Pfad A (schwer, Metall) · 2b/3b = Pfad B (magisch/elementar, leuchtend).
// Waffen: sword greatsword mace hammer axe spear lance halberd scythe staff staffOrb staffSun bo bow crossbow
//   tome banner claws fist torch flail · Schilde: buckler kite tower mirror · Suffix XL = groß, Glow = leuchtend.
// Köpfe: cap great tower winged horned plume crown hood mitre halo sunhalo skull flame antler mask bald topknot crystal
// Extras: pauldron pauldronXL cape quiver pavise backBanner bladesOrbit mirrorOrbit floatTome bracers barding
//   helmHorn horns spines crystals mane crownS plates cannon coil veins eyesGlow
// ---------------------------------------------------------------------------------------------
const E = (a, b2, c2, a3, b3) => ({ '1': a, '2a': b2, '2b': c2, '3a': a3, '3b': b3 });
export const EVOLVE = {
  // Sonnenorden
  knight: E('R:sword L:buckler H:cap fit:0.86', 'R:mace L:tower H:great X:pauldron fit:1.04', 'R:sword L:sword H:plume fit:0.98', 'R:hammer L:towerXL H:tower X:pauldronXL fit:1.2', 'R:greatswordGlow L:swordGlow H:winged X:bladesOrbit fit:1.12'),
  archer: E('L:bow X:quiver fit:0.86', 'L:crossbow H:cap X:quiver,pauldron fit:1', 'L:bowGlow H:hood X:quiver fit:1', 'L:crossbowXL H:great X:pavise,pauldron fit:1.14', 'L:bowGlow H:flame X:quiver,cape fit:1.12'),
  priest: E('R:staff fit:0.86', 'R:mace L:tome H:mitre fit:1', 'R:staffOrb H:halo fit:1', 'R:hammer L:buckler H:mitre X:pauldron fit:1.14', 'R:staffSun H:sunhalo X:floatTome fit:1.12'),
  paladin_heavy: E('fit:0.86', 'R:spear L:tower H:great fit:1', 'R:sword L:mirror H:mask fit:1', 'R:hammerXL L:towerXL H:tower X:pauldronXL fit:1.16', 'R:swordGlow L:mirrorXL H:crown X:mirrorOrbit fit:1.12'),
  griffin: E('fit:0.82', 'X:barding fit:1', 'X:crownS,eyesGlow fit:0.98', 'X:barding,helmHorn fit:1.15', 'X:mane,crownS fit:1.12'),
  lancer: E('R:spear H:cap fit:0.86', 'R:lance L:kite H:great fit:1', 'R:banner H:plume X:cape fit:1', 'R:lanceXL L:kite H:winged X:pauldronXL fit:1.15', 'R:bannerXL L:kite H:crown X:cape fit:1.12'),
  monk: E('H:bald fit:0.86', 'R:fist L:fist X:bracers fit:1', 'R:bo H:topknot fit:1', 'R:fistXL L:fistXL H:topknot X:bracers,pauldron fit:1.16', 'R:fistGlow L:fistGlow H:sunhalo fit:1.12'),
  ballista: E('fit:0.86', 'X:plates fit:1', 'X:crystals fit:1', 'X:plates,cannon fit:1.15', 'X:crystals,crownS fit:1.12'),
  // Wildherz
  treant: E('fit:0.86', 'X:spines fit:1.02', 'X:crystals,eyesGlow fit:1', 'H:antler X:spines fit:1.2', 'H:crystal X:crystals fit:1.14'),
  wolf: E('fit:0.82', 'X:barding fit:1', 'X:eyesGlow,mane fit:1', 'X:barding,helmHorn,spines fit:1.18', 'X:mane,crystals,eyesGlow fit:1.14'),
  druid: E('fit:0.86', 'R:scythe fit:1', 'R:staffGlow L:tome fit:1', 'R:staffOrb X:crystals fit:1.14', 'R:staffSun H:halo X:floatTome fit:1.12'),
  mushroom: E('fit:0.82', 'X:spines fit:1', 'X:eyesGlow fit:1', 'X:spines,crownS fit:1.16', 'X:crystals fit:1.14'),
  bear: E('fit:0.82', 'fit:1', 'fit:1', 'X:helmHorn fit:1.18', 'X:mane fit:1.14'),
  owl: E('fit:0.82', 'X:crownS fit:1', 'X:eyesGlow fit:1', 'X:helmHorn,barding fit:1.15', 'X:crystals,crownS fit:1.12'),
  stag: E('fit:0.84', 'X:barding fit:1', 'fit:1', 'X:barding,crownS fit:1.16', 'X:crystals,mane fit:1.14'),
  dryad: E('fit:0.86', 'R:claws L:claws fit:1', 'R:staffGlow fit:1', 'R:clawsXL L:clawsXL H:antler X:spines fit:1.15', 'R:staffSun H:crystal fit:1.12'),
  // Ätherschmiede
  automaton: E('fit:0.86', 'R:axe L:buckler X:plates fit:1', 'R:mace L:tower H:great fit:1', 'R:greatsword L:sword X:pauldronXL,coil fit:1.18', 'R:hammerXL L:towerXL H:tower X:plates fit:1.2'),
  walker: E('fit:0.86', 'X:plates fit:1', 'X:coil fit:1', 'X:plates,cannon fit:1.15', 'X:coil,crystals fit:1.12'),
  mortar: E('fit:0.86', 'X:plates fit:1', 'X:coil fit:1', 'X:plates fit:1.15', 'X:coil,crystals fit:1.12'),
  core: E('fit:0.86', 'fit:1', 'X:crystals fit:1', 'X:cannon fit:1.15', 'X:crystals fit:1.14'),
  spider: E('fit:0.86', 'X:plates fit:1', 'X:crystals fit:1', 'X:plates,cannon fit:1.15', 'X:crystals,crownS fit:1.12'),
  drone: E('fit:0.86', 'X:cannon fit:1', 'X:coil fit:1', 'X:cannon,plates fit:1.15', 'X:coil,crystals fit:1.12'),
  tank: E('fit:0.86', 'X:plates fit:1', 'X:coil fit:1', 'X:plates,cannon fit:1.15', 'X:coil fit:1.12'),
  tesla: E('fit:0.86', 'X:plates fit:1', 'X:crystals fit:1', 'X:plates,cannon fit:1.15', 'X:crystals fit:1.12'),
  // Abgrund
  shade: E('R:claws fit:0.86', 'R:sword L:sword H:hood fit:1', 'R:scytheGlow H:hood fit:1', 'R:scytheXL H:skull X:cape fit:1.16', 'R:scytheGlow L:claws H:skull X:veins fit:1.12'),
  bonethrower: E('fit:0.86', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,plates fit:1.15', 'X:crystals,spines fit:1.12'),
  voidmage: E('fit:0.86', 'R:staffOrb H:skull fit:1', 'R:staffOrb L:tome fit:1', 'R:scythe H:crown X:cape,veins fit:1.15', 'R:staffOrb L:tomeGlow H:skull X:floatTome,veins fit:1.12'),
  cryptgolem: E('fit:0.86', 'R:flail X:spines fit:1', 'L:tower X:spines fit:1', 'R:axeXL L:flail H:skull X:pauldronXL fit:1.15', 'L:towerXL H:skull X:spines,veins fit:1.15'),
  witch: E('fit:0.86', 'L:tome fit:1', 'L:torch fit:1', 'L:tomeGlow X:cape fit:1.14', 'L:torch R:scytheGlow X:veins fit:1.12'),
  ghoul: E('fit:0.86', 'X:spines fit:1', 'X:veins fit:1', 'R:clawsXL L:clawsXL H:horned X:spines fit:1.16', 'H:skull X:veins,spines fit:1.12'),
  banshee: E('fit:0.86', 'H:crown fit:1', 'X:veins fit:1', 'R:scythe H:crown fit:1.14', 'H:sunhalo X:veins fit:1.12'),
  gargoyle: E('fit:0.86', 'X:helmHorn fit:1', 'X:crystals,eyesGlow fit:1', 'R:axe L:buckler X:helmHorn,spines fit:1.15', 'X:crystals,crownS,eyesGlow fit:1.12'),
  // Schwarmbrut
  crawler: E('fit:0.84', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,helmHorn fit:1.16', 'X:crystals,mane fit:1.14'),
  beetle: E('fit:0.84', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,helmHorn fit:1.16', 'X:crystals,crownS fit:1.14'),
  carapace: E('fit:0.84', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,helmHorn fit:1.16', 'X:crystals,mane fit:1.14'),
  raptor: E('fit:0.84', 'X:spines fit:1', 'X:eyesGlow,crystals fit:1', 'X:spines,helmHorn fit:1.16', 'X:crystals,mane fit:1.14'),
  queen: E('fit:0.86', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,crownS fit:1.15', 'X:crystals,crownS fit:1.12'),
  locust: E('fit:0.84', 'X:spines fit:1', 'X:eyesGlow fit:1', 'X:spines,helmHorn fit:1.15', 'X:crystals fit:1.12'),
  mantis: E('fit:0.86', 'X:spines fit:1', 'X:eyesGlow fit:1', 'X:spines,crownS fit:1.15', 'X:crystals,crownS fit:1.12'),
  brute: E('fit:0.86', 'R:axe X:spines fit:1', 'R:hammer X:crystals fit:1', 'R:axeXL L:flail H:horned X:pauldronXL fit:1.15', 'R:hammerXL H:crystal X:crystals fit:1.15'),
  // Glutgeborene
  elemental: E('fit:0.86', 'R:axe X:spines fit:1', 'L:tower H:flame fit:1', 'R:greatsword H:horned X:spines fit:1.16', 'L:towerXL H:flame X:spines fit:1.18'),
  pyromancer: E('fit:0.86', 'R:staffGlow fit:1', 'L:tomeGlow H:mask fit:1', 'R:staffSun H:crown X:veins fit:1.14', 'R:torch L:tomeGlow H:flame X:floatTome fit:1.12'),
  salamander: E('fit:0.84', 'X:spines fit:1', 'X:mane fit:1', 'X:spines,helmHorn fit:1.16', 'X:mane,crystals fit:1.14'),
  imp: E('fit:0.86', 'R:spear H:horned fit:1', 'R:torch fit:1', 'R:halberd H:horned X:pauldron fit:1.15', 'R:torch L:torch H:flame fit:1.12'),
  hound: E('fit:0.84', 'X:barding fit:1', 'X:mane fit:1', 'X:barding,horns,spines fit:1.16', 'X:mane,horns fit:1.14'),
  golem: E('fit:0.86', 'X:spines fit:1', 'X:crystals fit:1', 'X:spines,horns fit:1.16', 'X:crystals,mane fit:1.14'),
  priest_glut: E('fit:0.86', 'R:mace L:tome fit:1', 'R:staffGlow fit:1', 'R:hammer L:buckler X:pauldron fit:1.14', 'R:staffSun H:flame fit:1.12'),
  phoenix: E('fit:0.84', 'X:crownS fit:1', 'X:mane fit:1', 'X:crownS,barding fit:1.15', 'X:mane,crystals fit:1.12'),
  // nur Wellen
  knightfallen: E('fit:0.9', 'X:pauldron fit:1', 'R:scytheGlow fit:1', 'R:greatsword L:tower H:horned X:pauldronXL fit:1.15', 'R:scytheGlow H:skull X:veins fit:1.12'),
  serpent: E('fit:0.9', 'L:buckler fit:1', 'X:veins fit:1', 'L:tower H:crown fit:1.12', 'H:crystal X:veins fit:1.12'),
};
/** Ausrüstungs-Spec einer Form (String) */
export function gearSpec(arch, form) { return (EVOLVE[arch] && EVOLVE[arch][form]) || ''; }
/** Größenfaktor einer Form (Entwicklungs-Story), sonst Stufenmaßstab */
export function formFit(arch, form) {
  const m = /fit:([\d.]+)/.exec(gearSpec(arch, form));
  return m ? +m[1] : TIER_SCALE[+String(form || '1')[0]] || 1;
}
/** Dunkle Volksfarben für die Draufsicht anheben (Abgrund, Glut) – Kontrast/Randlicht */
export const PALETTE_LIFT = { '#2c2440': '#4a3d70', '#6a1f52': '#9a2f78', '#3a2422': '#5e3a32', '#8a5a3a': '#b07a4a' };
