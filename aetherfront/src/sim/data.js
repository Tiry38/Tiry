// Spieldaten: Fraktionen, Kämpfer (mit Aufwertungsketten), Wellen, Söldner, König, Wirtschaft.
// Reine Daten + deterministische Ableitungen – keine Abhängigkeit zu Grafik oder Zufall.

export const ECON = {
  startGold: 260,
  startAether: 40,
  startIncome: 20,
  startWorkers: 1,
  workerCost: 60,
  workerCostStep: 5,          // jeder weitere Arbeiter kostet etwas mehr
  workerRate: 0.45,           // Äther pro Sekunde je Arbeiter
  maxWorkers: 16,
  randomBonusGold: 40,        // Bonus für Zufallsfraktion
  buildTimeFirst: 45,
  buildTime: 32,
  battleRageTime: 70,         // danach ignorieren Gegner die Kämpfer und stürmen zum König
  sellRefund: 0.5,            // Verkaufswert nach einer Welle
  kingShare: 0.5,             // Kopfgeldanteil, wenn der König einen Durchbrecher tötet
  maxWaves: 30,
};

// Angriffs- und Rüstungsarten (Multiplikatoren)
export const ATTACK_TYPES = {
  klinge: { name: 'Klinge', color: '#ffd27a' },
  stich: { name: 'Durchbohren', color: '#9be15d' },
  arkan: { name: 'Arkan', color: '#7ad7ff' },
  wucht: { name: 'Belagerung', color: '#ff9a5a' },
  chaos: { name: 'Chaos', color: '#e07bff' },
};
export const ARMOR_TYPES = {
  leicht: { name: 'Leicht' },
  mittel: { name: 'Mittel' },
  schwer: { name: 'Schwer' },
  festung: { name: 'Festung' },
  boss: { name: 'Titan' },
};
export const DAMAGE_TABLE = {
  klinge: { leicht: 1.0, mittel: 1.5, schwer: 1.0, festung: 0.7, boss: 1.0 },
  stich: { leicht: 2.0, mittel: 0.75, schwer: 1.0, festung: 0.35, boss: 0.6 },
  arkan: { leicht: 1.25, mittel: 0.75, schwer: 2.0, festung: 0.35, boss: 1.0 },
  wucht: { leicht: 1.0, mittel: 0.5, schwer: 1.0, festung: 1.5, boss: 1.0 },
  chaos: { leicht: 1.0, mittel: 1.0, schwer: 1.0, festung: 1.0, boss: 1.1 },
};
// Rüstungswert → Schadensreduktion (wie klassische RTS-Formel)
export function armorReduction(a) {
  return a >= 0 ? (0.06 * a) / (1 + 0.06 * a) : -(1 - Math.pow(0.94, -a));
}

export const FACTIONS = {
  orden: {
    id: 'orden', name: 'Sonnenorden', motto: 'Licht, Stahl und Disziplin.',
    desc: 'Robuste Ritter, Heilerinnen und präzise Schützinnen. Stark in der Defensive.',
    palette: { primary: '#ece4cf', secondary: '#2f5fb3', metal: '#d9b25a', glow: '#ffd27a' },
    grad: ['#ffd27a', '#ff9f5a', '#5a8bff'],
  },
  wild: {
    id: 'wild', name: 'Wildherz', motto: 'Der Wald erinnert sich.',
    desc: 'Wölfe, Baumriesen und Druidinnen. Hohe Lebenskraft, Ketten-Magie und Heilung.',
    palette: { primary: '#5f8a3c', secondary: '#7a4f2c', metal: '#b08d57', glow: '#9cff6a' },
    grad: ['#9cff6a', '#2fd5a0', '#e8c25a'],
  },
  schmiede: {
    id: 'schmiede', name: 'Ätherschmiede', motto: 'Präzision ist Macht.',
    desc: 'Mechanische Krieger, Mörser und Tesla-Technik. Brutaler Flächenschaden.',
    palette: { primary: '#5a6472', secondary: '#c2763a', metal: '#b9c3cf', glow: '#40e6ff' },
    grad: ['#40e6ff', '#3a7bff', '#ff8a3a'],
  },
  abgrund: {
    id: 'abgrund', name: 'Abgrund', motto: 'Alles endet im Schatten.',
    desc: 'Schemen, Knochenkolosse und Leerenmagie. Kritische Treffer, Lebensraub und Flüche.',
    palette: { primary: '#2c2440', secondary: '#6a1f52', metal: '#80869a', glow: '#c06bff' },
    grad: ['#c06bff', '#ff4fa3', '#4a3bff'],
  },
};
export const FACTION_IDS = Object.keys(FACTIONS);

// Rollen-Vorlagen: Werte je eingesetztem Gold (Wert der Einheit)
const ROLES = {
  tank:   { hp: 9.2, dps: 0.20, range: 1.4, cd: 1.3, speed: 3.0, label: 'Verteidiger' },
  melee:  { hp: 5.6, dps: 0.36, range: 1.4, cd: 1.0, speed: 3.4, label: 'Nahkampf' },
  assassin: { hp: 4.8, dps: 0.46, range: 1.3, cd: 0.8, speed: 4.0, label: 'Klingentänzer' },
  ranged: { hp: 3.4, dps: 0.42, range: 6.5, cd: 1.1, speed: 3.2, label: 'Fernkampf' },
  caster: { hp: 3.2, dps: 0.40, range: 6.0, cd: 1.4, speed: 3.0, label: 'Magier' },
  siege:  { hp: 3.4, dps: 0.27, range: 7.5, cd: 2.0, speed: 2.8, label: 'Belagerung' },
  healer: { hp: 3.8, dps: 0.14, range: 5.5, cd: 1.5, speed: 3.0, label: 'Heiler' },
  support: { hp: 4.6, dps: 0.22, range: 5.5, cd: 1.3, speed: 3.0, label: 'Unterstützer' },
};

// Linien: je 3 Stufen. cost = [Kaufpreis T1, Aufwertung T2, Aufwertung T3]
const LINES = {
  orden: [
    { key: 'squire', names: ['Knappe', 'Ritter', 'Lichtpaladin'], models: ['knight', 'knight', 'paladin_heavy'], role: 'melee', atk: 'klinge', armorType: 'schwer', armor: [2, 3, 4], cost: [45, 75, 160],
      abil: [{}, {}, { aura_armor: { armor: 3, radius: 5 } }] },
    { key: 'archer', names: ['Bogenschützin', 'Falkenauge', 'Sonnenschützin'], models: ['archer', 'archer', 'archer'], role: 'ranged', atk: 'stich', armorType: 'mittel', armor: [0, 1, 1], cost: [55, 90, 190],
      abil: [{}, { crit: { chance: 0.2, mult: 2 } }, { crit: { chance: 0.25, mult: 2.2 }, multishot: { targets: 3 } }] },
    { key: 'priest', names: ['Novizin', 'Priesterin', 'Hohepriesterin'], models: ['priest', 'priest', 'priest'], role: 'healer', atk: 'arkan', armorType: 'leicht', armor: [0, 0, 1], cost: [70, 100, 210],
      abil: [{ heal: { amount: 26, cd: 2.2 } }, { heal: { amount: 60, cd: 2.0 } }, { heal: { amount: 150, cd: 1.8 }, aura_armor: { armor: 2, radius: 5 } }] },
    { key: 'guard', names: ['Schildwache', 'Bollwerk', 'Bastion des Lichts'], models: ['paladin_heavy', 'paladin_heavy', 'paladin_heavy'], role: 'tank', atk: 'klinge', armorType: 'festung', armor: [3, 5, 7], cost: [80, 120, 240],
      abil: [{}, { taunt: true }, { taunt: true, aura_armor: { armor: 2, radius: 6 } }] },
    { key: 'griffin', names: ['Junggreif', 'Sturmgreif', 'Himmelsgreif'], models: ['griffin', 'griffin', 'griffin'], role: 'melee', atk: 'klinge', armorType: 'mittel', armor: [1, 2, 3], cost: [95, 140, 280],
      abil: [{ stun: { chance: 0.12, dur: 0.8 } }, { stun: { chance: 0.18, dur: 1.0 } }, { stun: { chance: 0.22, dur: 1.2 }, splash: { radius: 2.2, pct: 0.4 } }], atkT3: 'chaos' },
  ],
  wild: [
    { key: 'treant', names: ['Dornling', 'Eichenwächter', 'Urwaldhüter'], models: ['treant', 'treant', 'treant'], role: 'tank', atk: 'wucht', armorType: 'schwer', armor: [3, 4, 5], cost: [50, 85, 180],
      abil: [{ regen: 4 }, { regen: 10, taunt: true }, { regen: 26, taunt: true, thorns: 0.25 }] },
    { key: 'wolf', names: ['Wolf', 'Rudelwolf', 'Mondalpha'], models: ['wolf', 'wolf', 'wolf'], role: 'assassin', atk: 'klinge', armorType: 'mittel', armor: [0, 1, 2], cost: [40, 70, 150],
      abil: [{}, { lifesteal: 0.15 }, { lifesteal: 0.2, aura_speed: { pct: 0.15, radius: 5 } }] },
    { key: 'druid', names: ['Druidin', 'Sturmdruidin', 'Himmelsdruidin'], models: ['druid', 'druid', 'druid'], role: 'caster', atk: 'arkan', armorType: 'leicht', armor: [0, 0, 1], cost: [65, 105, 220],
      abil: [{}, { chain: { jumps: 2, falloff: 0.75 } }, { chain: { jumps: 4, falloff: 0.8 } }] },
    { key: 'shroom', names: ['Sporling', 'Pilzschamane', 'Sporenkönig'], models: ['mushroom', 'mushroom', 'mushroom'], role: 'healer', atk: 'arkan', armorType: 'leicht', armor: [0, 1, 1], cost: [60, 95, 200],
      abil: [{ heal: { amount: 22, cd: 2.2 } }, { heal: { amount: 55, cd: 2.0 }, slow: { pct: 0.25, dur: 1.5 } }, { heal: { amount: 130, cd: 1.8 }, slow: { pct: 0.35, dur: 2 }, splash: { radius: 2.5, pct: 0.5 } }] },
    { key: 'bear', names: ['Bärenjunges', 'Kriegsbär', 'Urbär'], models: ['bear', 'bear', 'bear'], role: 'tank', atk: 'wucht', armorType: 'schwer', armor: [2, 4, 5], cost: [90, 140, 270],
      abil: [{}, { splash: { radius: 2, pct: 0.35 } }, { splash: { radius: 2.6, pct: 0.5 }, stun: { chance: 0.1, dur: 1 } }] },
  ],
  schmiede: [
    { key: 'auto', names: ['Schrotter', 'Kriegsautomat', 'Titanautomat'], models: ['automaton', 'automaton', 'automaton'], role: 'melee', atk: 'klinge', armorType: 'schwer', armor: [2, 3, 4], cost: [50, 85, 175],
      abil: [{}, { crit: { chance: 0.15, mult: 2 } }, { crit: { chance: 0.22, mult: 2.5 }, thorns: 0.15 }] },
    { key: 'walker', names: ['Bolzenläufer', 'Repetierläufer', 'Ballistenläufer'], models: ['walker', 'walker', 'walker'], role: 'ranged', atk: 'stich', armorType: 'mittel', armor: [1, 1, 2], cost: [60, 95, 200],
      abil: [{}, { multishot: { targets: 2 } }, { multishot: { targets: 3 }, crit: { chance: 0.15, mult: 2 } }] },
    { key: 'mortar', names: ['Mörserkarren', 'Mörserkoloss', 'Donnermörser'], models: ['mortar', 'mortar', 'mortar'], role: 'siege', atk: 'wucht', armorType: 'mittel', armor: [1, 2, 2], cost: [75, 115, 240],
      abil: [{ splash: { radius: 2.2, pct: 0.6 } }, { splash: { radius: 2.8, pct: 0.7 } }, { splash: { radius: 3.4, pct: 0.8 }, stun: { chance: 0.15, dur: 0.7 } }] },
    { key: 'core', names: ['Ätherkern', 'Prismakern', 'Sonnenkern'], models: ['core', 'core', 'core'], role: 'support', atk: 'arkan', armorType: 'festung', armor: [2, 3, 4], cost: [85, 125, 250],
      abil: [{ aura_speed: { pct: 0.12, radius: 5 } }, { aura_speed: { pct: 0.2, radius: 6 } }, { aura_speed: { pct: 0.3, radius: 7 }, chain: { jumps: 2, falloff: 0.7 } }] },
    { key: 'spider', names: ['Teslaspinne', 'Sturmspinne', 'Blitzmatriarchin'], models: ['spider', 'spider', 'spider'], role: 'caster', atk: 'arkan', armorType: 'mittel', armor: [1, 1, 2], cost: [70, 110, 230],
      abil: [{ chain: { jumps: 1, falloff: 0.7 } }, { chain: { jumps: 3, falloff: 0.75 } }, { chain: { jumps: 5, falloff: 0.8 }, stun: { chance: 0.1, dur: 0.6 } }] },
  ],
  abgrund: [
    { key: 'shade', names: ['Schemen', 'Nachtklinge', 'Seelenschnitter'], models: ['shade', 'shade', 'shade'], role: 'assassin', atk: 'klinge', armorType: 'mittel', armor: [1, 2, 3], cost: [45, 80, 170],
      abil: [{ crit: { chance: 0.15, mult: 2 } }, { crit: { chance: 0.22, mult: 2.4 } }, { crit: { chance: 0.3, mult: 3 }, lifesteal: 0.15 }], atkT3: 'chaos' },
    { key: 'bone', names: ['Knochenwerfer', 'Gruftschleuder', 'Totenballiste'], models: ['bonethrower', 'bonethrower', 'bonethrower'], role: 'siege', atk: 'wucht', armorType: 'mittel', armor: [1, 1, 2], cost: [60, 100, 210],
      abil: [{ splash: { radius: 2, pct: 0.5 } }, { splash: { radius: 2.6, pct: 0.6 } }, { splash: { radius: 3.2, pct: 0.75 }, curse: { pct: 0.15, dur: 3 } }] },
    { key: 'void', names: ['Leerenadept', 'Leerenmagier', 'Leerenfürst'], models: ['voidmage', 'voidmage', 'voidmage'], role: 'caster', atk: 'arkan', armorType: 'leicht', armor: [0, 0, 1], cost: [65, 105, 225],
      abil: [{}, { splash: { radius: 1.8, pct: 0.4 } }, { splash: { radius: 2.4, pct: 0.6 }, curse: { pct: 0.2, dur: 3 } }], atkT3: 'chaos' },
    { key: 'golem', names: ['Gruftkoloss', 'Knochenkoloss', 'Seelenfresser'], models: ['cryptgolem', 'cryptgolem', 'cryptgolem'], role: 'tank', atk: 'klinge', armorType: 'schwer', armor: [3, 4, 5], cost: [75, 120, 240],
      abil: [{ lifesteal: 0.1 }, { lifesteal: 0.2, taunt: true }, { lifesteal: 0.3, taunt: true, splash: { radius: 2, pct: 0.35 } }] },
    { key: 'witch', names: ['Bannhexe', 'Fluchhexe', 'Totenbraut'], models: ['witch', 'witch', 'witch'], role: 'support', atk: 'arkan', armorType: 'mittel', armor: [0, 1, 1], cost: [55, 90, 190],
      abil: [{ slow: { pct: 0.25, dur: 2 } }, { slow: { pct: 0.3, dur: 2.5 }, curse: { pct: 0.15, dur: 3 } }, { slow: { pct: 0.4, dur: 3 }, curse: { pct: 0.25, dur: 3.5 }, multishot: { targets: 2 } }] },
  ],
};

const HOTKEYS = ['Q', 'W', 'E', 'R', 'T'];

function buildUnits() {
  const units = {};
  for (const [fid, lines] of Object.entries(LINES)) {
    lines.forEach((line, li) => {
      let value = 0;
      for (let t = 0; t < 3; t++) {
        const r = ROLES[line.role];
        value += line.cost[t];
        const eff = 1 + 0.12 * t; // Aufwertungen sind effizienter (Platz ist begrenzt)
        const cd = r.cd;
        const id = `${fid}_${line.key}_${t + 1}`;
        units[id] = {
          id, faction: fid, line: line.key, lineIndex: li, hotkey: HOTKEYS[li],
          name: line.names[t], model: line.models[t], tier: t + 1, role: line.role, roleLabel: r.label,
          cost: line.cost[t], value,
          hp: Math.round(r.hp * value * eff),
          dmg: Math.round(r.dps * value * eff * cd * 10) / 10,
          cd, range: r.range, speed: r.speed,
          atk: t === 2 && line.atkT3 ? line.atkT3 : line.atk,
          armorType: line.armorType, armor: line.armor[t],
          abil: line.abil[t] || {},
          ranged: r.range > 2.5,
          upgradeTo: t < 2 ? `${fid}_${line.key}_${t + 2}` : null,
          size: line.role === 'tank' ? 1.15 : 1,
        };
      }
    });
  }
  return units;
}
export const UNITS = buildUnits();
export function factionUnits(fid) {
  return Object.values(UNITS).filter((u) => u.faction === fid && u.tier === 1).sort((a, b) => a.lineIndex - b.lineIndex);
}

// ---------- Wellen ----------
const WAVE_DEFS = [
  ['Krabbler', 'crawler', 8, 'leicht', 'klinge', false],
  ['Glutwelpen', 'hound', 8, 'mittel', 'klinge', false],
  ['Panzerkäfer', 'beetle', 6, 'schwer', 'wucht', false],
  ['Irrlichtimps', 'imp', 8, 'leicht', 'arkan', true],
  ['Felsbrecher', 'brute', 5, 'mittel', 'wucht', false],
  ['Sumpfraptoren', 'raptor', 10, 'leicht', 'stich', false],
  ['Steingeister', 'elemental', 6, 'festung', 'wucht', false],
  ['Schlangenkrieger', 'serpent', 8, 'mittel', 'stich', false],
  ['Kristallgolems', 'golem', 6, 'schwer', 'arkan', false],
  ['Der Steintitan', 'boss_titan', 1, 'boss', 'wucht', false],
  ['Gefallene Ritter', 'knightfallen', 7, 'schwer', 'klinge', false],
  ['Lavahunde', 'hound', 10, 'mittel', 'chaos', false],
  ['Brutkrabbler', 'crawler', 14, 'leicht', 'stich', false],
  ['Sturmimps', 'imp', 9, 'leicht', 'arkan', true],
  ['Obsidiankäfer', 'beetle', 7, 'festung', 'wucht', false],
  ['Blutraptoren', 'raptor', 11, 'mittel', 'klinge', false],
  ['Ogerhorde', 'brute', 6, 'schwer', 'wucht', false],
  ['Nagawächter', 'serpent', 9, 'schwer', 'stich', true],
  ['Magmageister', 'elemental', 7, 'mittel', 'chaos', false],
  ['Der Aschendrache', 'boss_drake', 1, 'boss', 'chaos', true],
  ['Leerenkrabbler', 'crawler', 16, 'mittel', 'chaos', false],
  ['Runengolems', 'golem', 7, 'festung', 'arkan', false],
  ['Todesritter', 'knightfallen', 8, 'schwer', 'chaos', false],
  ['Höllenimps', 'imp', 10, 'leicht', 'chaos', true],
  ['Kolossoger', 'brute', 7, 'festung', 'wucht', false],
  ['Urzeitraptoren', 'raptor', 12, 'schwer', 'stich', false],
  ['Sternengeister', 'elemental', 8, 'mittel', 'arkan', false],
  ['Leerennaga', 'serpent', 10, 'mittel', 'arkan', true],
  ['Titanenkäfer', 'beetle', 8, 'schwer', 'chaos', false],
  ['Der Leerenfürst', 'boss_lord', 1, 'boss', 'chaos', false],
];
const WAVE_PALETTES = [
  { primary: '#6b4a3a', secondary: '#c9a46a', metal: '#7a6a5a', glow: '#ff7a3a' },
  { primary: '#3a2a2a', secondary: '#ff6a2a', metal: '#5a4a44', glow: '#ff9a2a' },
  { primary: '#24394a', secondary: '#4ab0c8', metal: '#8ab0c0', glow: '#5af0ff' },
  { primary: '#3c1f4a', secondary: '#c04aff', metal: '#6a5a7a', glow: '#ff5af0' },
  { primary: '#4a5a2a', secondary: '#a07a3a', metal: '#6a6a5a', glow: '#c8ff5a' },
];

export const WAVE_VALUE_BASE = 200;
export const WAVE_GROWTH = 1.16;
export const WAVE_HP_PER_VALUE = 5.5;
export const WAVE_DPS_PER_VALUE = 0.3;

export const WAVES = WAVE_DEFS.map(([name, model, count, armorType, atk, ranged], i) => {
  const n = i + 1;
  const boss = model.startsWith('boss_');
  // Erwarteter Armeewert einer soliden Bahn zu dieser Welle → Wellenstärke (knapp haltbar)
  const early = n <= 5 ? 0.75 + 0.05 * (n - 1) : 1; // sanfter Einstieg
  const v = WAVE_VALUE_BASE * Math.pow(WAVE_GROWTH, n - 1) * early;
  const totalHp = WAVE_HP_PER_VALUE * v * (boss ? 1.15 : 1) * (armorType === 'festung' ? 0.72 : 1);
  const totalDps = WAVE_DPS_PER_VALUE * v * (boss ? 0.75 : 1);
  const cd = ranged ? 1.4 : boss ? 1.6 : 1.1;
  const speedBase = model === 'raptor' || model === 'hound' ? 4.0 : model === 'beetle' || model === 'golem' ? 2.6 : 3.1;
  return {
    n, name, model, count, armorType, atk, ranged, boss,
    hp: Math.round(totalHp / count),
    dmg: Math.round((totalDps / count) * cd * 10) / 10,
    cd, range: ranged ? 5.5 : boss ? 2.6 : 1.3,
    speed: boss ? 2.2 : speedBase,
    armor: Math.floor(n / 4) + (armorType === 'schwer' || armorType === 'festung' ? 2 : 0),
    bounty: Math.max(1, Math.round((28 + 7 * n) / count)),
    palette: WAVE_PALETTES[i % WAVE_PALETTES.length],
    size: boss ? 1 : 1,
  };
});

// ---------- Söldner (Senden) ----------
export const SENDS = [
  { id: 's_rat', name: 'Schattenkrabbler', model: 'crawler', cost: 20, income: 2, hp: 300, dmg: 10, cd: 1.0, range: 1.3, speed: 3.6, armorType: 'leicht', atk: 'klinge', armor: 0, unlock: 1, hotkey: '1' },
  { id: 's_hound', name: 'Grollhund', model: 'hound', cost: 40, income: 4, hp: 560, dmg: 18, cd: 1.0, range: 1.3, speed: 4.0, armorType: 'mittel', atk: 'klinge', armor: 1, unlock: 2, hotkey: '2' },
  { id: 's_beetle', name: 'Felspanzer', model: 'beetle', cost: 70, income: 7, hp: 1250, dmg: 22, cd: 1.2, range: 1.3, speed: 2.6, armorType: 'festung', atk: 'wucht', armor: 4, unlock: 4, hotkey: '3' },
  { id: 's_imp', name: 'Feuerimp', model: 'imp', cost: 110, income: 11, hp: 1000, dmg: 46, cd: 1.3, range: 5.5, speed: 3.2, armorType: 'leicht', atk: 'arkan', armor: 1, unlock: 6, hotkey: '4' },
  { id: 's_ogre', name: 'Kriegsoger', model: 'brute', cost: 170, income: 16, hp: 2700, dmg: 70, cd: 1.3, range: 1.4, speed: 3.0, armorType: 'schwer', atk: 'wucht', armor: 4, unlock: 9, hotkey: '5' },
  { id: 's_golem', name: 'Kristallkoloss', model: 'golem', cost: 260, income: 24, hp: 4400, dmg: 100, cd: 1.4, range: 1.5, speed: 2.6, armorType: 'festung', atk: 'arkan', armor: 6, unlock: 12, hotkey: '6' },
  { id: 's_knight', name: 'Höllenritter', model: 'knightfallen', cost: 400, income: 36, hp: 6800, dmg: 170, cd: 1.2, range: 1.5, speed: 3.2, armorType: 'schwer', atk: 'chaos', armor: 6, unlock: 16, hotkey: '7' },
].map((s) => ({ ...s, bounty: Math.round(s.cost * 0.4), palette: { primary: '#1e1a2a', secondary: '#ff3a5a', metal: '#4a4a5a', glow: '#ff3a6a' } }));

// ---------- König ----------
export const KING = {
  hp: 6000, dmg: 160, cd: 1.0, range: 7.5, splash: { radius: 3, pct: 0.6 }, regen: 6, armor: 3, atk: 'chaos', armorType: 'festung',
  heals: 3, healPct: 0.3, healCd: 30,
  upgrades: {
    hp: { name: 'Lebenskraft', desc: '+900 maximales Leben', base: 60, step: 35, max: 15 },
    dmg: { name: 'Königsmacht', desc: '+20 % Angriffsschaden', base: 70, step: 40, max: 15 },
    regen: { name: 'Erneuerung', desc: '+4 Leben pro Sekunde', base: 50, step: 30, max: 10 },
  },
};
export function kingUpgradeCost(kind, level) {
  const u = KING.upgrades[kind];
  return u.base + u.step * level;
}
