// Helden: 8 spielbare Figuren mit je 5 Fähigkeiten (Tasten 1–5). Reine Daten – die Logik steckt in sim/hero.js.
// Fähigkeits-Typen: strike, bolt, cone, aoe_self, aoe_ground, dash, blink, leap_back, buff_self, aura_vassals,
// heal_area, shield, mark, dot, drain, summon, turret, taunt, revive, pull, root_target.
// Werte skalieren mit Heldenstufe: dmg * (1 + 0.12*(lvl-1)), heal ebenso. Fähigkeit 5 wird ab Stufe 6 zur Ultimate (ult-Werte).

export const HERO_STATS = {
  runSpeed: 7, backSpeed: 4.5, turnSpeed: Math.PI, jumpV: 7.2, gravity: 22, gcd: 1.5, gcdMin: 0.75, queueWindow: 0.4,
  maxLevel: 10, ultLevel: 6,
  xpForLevel: [0, 60, 150, 280, 450, 680, 960, 1300, 1700, 2200],
};

const A = (o) => ({ gcd: true, cost: 0, cast: 0, range: 0, radius: 0, ...o });

export const HEROES = {
  kael: {
    id: 'kael', name: 'Kael Sturmbrecher', title: 'Schild der Bastion', role: 'tank', roleLabel: 'Verteidiger', difficulty: 1,
    synergy: ['orden'], model: 'hero_kael', resource: 'wut', resName: 'Wut', resMax: 100, resRegen: 6,
    palette: { primary: '#d8dbe4', secondary: '#2a5fd0', metal: '#c9a24a', glow: '#7cc8ff' },
    hp: 1300, armor: 6, armorType: 'schwer', dmg: 34, atk: 'klinge', range: 2.2, cd: 1.5,
    lore: 'Letzter Hauptmann der Himmelsbastion. Er schwor, dass kein Riss je wieder eine Mauer überwindet, solange er steht.',
    abilities: [
      A({ id: 'k1', name: 'Schildschlag', type: 'strike', range: 3, cd: 6, cost: 15, dmg: 70, stun: 1.2, icon: 'shield', desc: 'Rammt den Schild ins Ziel: {dmg} Schaden und Betäubung.' }),
      A({ id: 'k2', name: 'Herausforderung', type: 'taunt', radius: 9, cd: 14, cost: 10, armorBuff: 6, dur: 5, icon: 'roar', desc: 'Zwingt alle Gegner im Umkreis, dich anzugreifen. +{armorBuff} Rüstung.' }),
      A({ id: 'k3', name: 'Ansturm', type: 'dash', range: 16, minRange: 3, cd: 12, cost: 0, dmg: 40, stun: 0.8, gcd: false, icon: 'charge', desc: 'Stürmt zum Ziel und betäubt es. Erzeugt 20 Wut.', gain: 20 }),
      A({ id: 'k4', name: 'Bollwerk-Banner', type: 'aura_vassals', radius: 10, cd: 25, cost: 30, armor: 5, dur: 8, icon: 'banner', desc: 'Vasallen im Umkreis erhalten {dur}s lang +{armor} Rüstung.' }),
      A({ id: 'k5', name: 'Erdenbrecher', type: 'aoe_self', radius: 6, cd: 30, cost: 40, dmg: 140, stun: 1.6, icon: 'quake', desc: 'Schmettert den Boden: {dmg} Schaden und Betäubung im Umkreis.', ult: { radius: 9, dmg: 320, stun: 2.5 } }),
    ],
  },
  lyra: {
    id: 'lyra', name: 'Lyra Morgenfeder', title: 'Jägerin der Wipfel', role: 'ranged', roleLabel: 'Fernkampf', difficulty: 2,
    synergy: ['wild'], model: 'hero_lyra', resource: 'fokus', resName: 'Fokus', resMax: 100, resRegen: 10,
    palette: { primary: '#5d7f3a', secondary: '#8a5a32', metal: '#c0a060', glow: '#b6ff7a' },
    hp: 820, armor: 2, armorType: 'mittel', dmg: 30, atk: 'stich', range: 16, cd: 1.6,
    lore: 'Sie wuchs in den Kronen der Himmelswälder auf. Ihr Pfeil trifft, was das Auge kaum sieht.',
    abilities: [
      A({ id: 'l1', name: 'Zielschuss', type: 'bolt', range: 20, cd: 0, cost: 25, cast: 1.4, dmg: 120, icon: 'aim', desc: 'Konzentrierter Schuss mit {dmg} Schaden (Zauberzeit).' }),
      A({ id: 'l2', name: 'Fächersalve', type: 'cone', range: 12, angle: 0.9, cd: 8, cost: 30, dmg: 80, icon: 'fan', desc: 'Pfeilfächer nach vorn: {dmg} Schaden an allen getroffenen Gegnern.' }),
      A({ id: 'l3', name: 'Rückwärtssalto', type: 'leap_back', range: 10, cd: 14, cost: 10, gcd: false, slow: 0.5, icon: 'leap', desc: 'Springt zurück und verlangsamt Gegner in der Nähe.' }),
      A({ id: 'l4', name: 'Jägermal', type: 'mark', range: 24, cd: 15, cost: 20, pct: 0.3, dur: 10, icon: 'mark', desc: 'Markiert das Ziel: Es erleidet {pct}% mehr Schaden – auch von deinen Vasallen.' }),
      A({ id: 'l5', name: 'Pfeilregen', type: 'aoe_ground', range: 24, radius: 6, cd: 28, cost: 50, dmg: 45, ticks: 6, tick: 0.5, channel: true, icon: 'rain', desc: 'Kanalisiert einen Pfeilregen: {ticks}× {dmg} Schaden im Zielgebiet.', ult: { radius: 8, dmg: 90, ticks: 8 } }),
    ],
  },
  varo: {
    id: 'varo', name: 'Varo Glutklinge', title: 'Tänzer im Zwielicht', role: 'melee', roleLabel: 'Nahkampf', difficulty: 3,
    synergy: ['abgrund'], model: 'hero_varo', resource: 'energie', resName: 'Energie', resMax: 100, resRegen: 14,
    palette: { primary: '#2c2440', secondary: '#a8243c', metal: '#9a9fb0', glow: '#ff5a3a' },
    hp: 960, armor: 3, armorType: 'mittel', dmg: 44, atk: 'klinge', range: 2.4, cd: 1.1,
    lore: 'Einst Klinge des Rissfürsten. Er wandte sich ab, als er sah, was hinter dem Riss wartet.',
    abilities: [
      A({ id: 'v1', name: 'Klingenwirbel', type: 'aoe_self', radius: 4.5, cd: 5, cost: 30, dmg: 75, icon: 'spin', desc: 'Wirbelt mit beiden Klingen: {dmg} Schaden an allen Gegnern im Umkreis.' }),
      A({ id: 'v2', name: 'Schattenschritt', type: 'blink', range: 18, cd: 10, cost: 20, gcd: false, behind: true, icon: 'shadow', desc: 'Teleportiert hinter das Ziel. Der nächste Angriff trifft kritisch.' }),
      A({ id: 'v3', name: 'Ausweiden', type: 'dot', range: 3, cd: 8, cost: 25, dmg: 30, ticks: 6, tick: 1, icon: 'bleed', desc: 'Blutung: {ticks}× {dmg} Schaden über Zeit.' }),
      A({ id: 'v4', name: 'Blutrausch', type: 'buff_self', cd: 30, cost: 0, gcd: false, haste: 0.5, lifesteal: 0.25, dur: 10, icon: 'rage', desc: '{dur}s: +50 % Angriffstempo und 25 % Lebensraub.' }),
      A({ id: 'v5', name: 'Tausend Schnitte', type: 'strike', range: 3, cd: 26, cost: 50, dmg: 60, hits: 5, icon: 'cuts', desc: 'Fünf blitzschnelle Hiebe mit je {dmg} Schaden.', ult: { dmg: 120, hits: 7 } }),
    ],
  },
  selene: {
    id: 'selene', name: 'Selene Äthersang', title: 'Stimme des Kristalls', role: 'caster', roleLabel: 'Magierin', difficulty: 2,
    synergy: ['schmiede'], model: 'hero_selene', resource: 'mana', resName: 'Mana', resMax: 200, resRegen: 9,
    palette: { primary: '#e8e4f6', secondary: '#3a46b8', metal: '#b7c3d6', glow: '#5ae2ff' },
    hp: 760, armor: 1, armorType: 'leicht', dmg: 28, atk: 'arkan', range: 15, cd: 1.7,
    lore: 'Die Ätherschmiede formten ihr Herz aus Kristall. Sie hört den Riss singen – und singt zurück.',
    abilities: [
      A({ id: 's1', name: 'Ätherlanze', type: 'bolt', range: 22, cd: 0, cost: 30, cast: 1.8, dmg: 140, icon: 'lance', desc: 'Schleudert eine Lanze aus Äther: {dmg} Schaden (Zauberzeit).' }),
      A({ id: 's2', name: 'Frostnova', type: 'aoe_self', radius: 6, cd: 14, cost: 40, dmg: 40, root: 3, icon: 'nova', desc: 'Friert Gegner im Umkreis {root}s fest und verursacht {dmg} Schaden.' }),
      A({ id: 's3', name: 'Blinzeln', type: 'blink', range: 12, cd: 12, cost: 20, gcd: false, forward: true, icon: 'blink', desc: 'Teleportiert dich 12 Meter nach vorn.' }),
      A({ id: 's4', name: 'Arkane Überladung', type: 'aura_vassals', radius: 10, cd: 25, cost: 50, haste: 0.35, dur: 8, icon: 'overload', desc: 'Vasallen im Umkreis greifen {dur}s lang 35 % schneller an.' }),
      A({ id: 's5', name: 'Meteor', type: 'aoe_ground', range: 26, radius: 6, cd: 30, cost: 80, dmg: 260, delay: 1.5, stun: 1, icon: 'meteor', desc: 'Ruft nach 1,5s einen Meteor: {dmg} Schaden und Betäubung im Zielgebiet.', ult: { radius: 8, dmg: 520 } }),
    ],
  },
  mira: {
    id: 'mira', name: 'Mira Lichtquell', title: 'Hüterin der Flamme', role: 'healer', roleLabel: 'Heilerin', difficulty: 2,
    synergy: ['orden', 'wild'], model: 'hero_mira', resource: 'mana', resName: 'Mana', resMax: 220, resRegen: 11,
    palette: { primary: '#f4eedc', secondary: '#d0a33a', metal: '#e0c070', glow: '#ffe08a' },
    hp: 840, armor: 2, armorType: 'mittel', dmg: 24, atk: 'arkan', range: 14, cd: 1.6,
    lore: 'Priesterin des letzten Leuchtturms. Wo sie geht, schließen sich Wunden – und Risse.',
    abilities: [
      A({ id: 'm1', name: 'Lichtstoß', type: 'bolt', range: 18, cd: 0, cost: 15, cast: 1.2, dmg: 80, icon: 'light', desc: 'Heiliges Geschoss mit {dmg} Schaden (Zauberzeit).' }),
      A({ id: 'm2', name: 'Heilwelle', type: 'heal_area', radius: 9, cd: 6, cost: 40, heal: 160, icon: 'heal', desc: 'Heilt dich und alle Vasallen im Umkreis um {heal}.' }),
      A({ id: 'm3', name: 'Schutzsiegel', type: 'shield', range: 20, cd: 12, cost: 30, absorb: 260, dur: 8, gcd: true, icon: 'ward', desc: 'Schild auf dich oder einen Vasallen, absorbiert {absorb} Schaden.' }),
      A({ id: 'm4', name: 'Weihe', type: 'aoe_ground', range: 18, radius: 6, cd: 16, cost: 50, dmg: 25, heal: 30, ticks: 8, tick: 1, icon: 'consecrate', desc: 'Geweihter Boden: schadet Gegnern und heilt Verbündete 8 Sekunden lang.' }),
      A({ id: 'm5', name: 'Wiedergeburt', type: 'revive', radius: 12, cd: 45, cost: 100, heal: 400, icon: 'rebirth', desc: 'Erweckt gefallene Vasallen im Umkreis und heilt alle um {heal}.', ult: { radius: 18, heal: 900 } }),
    ],
  },
  brann: {
    id: 'brann', name: 'Brann Eisenfaust', title: 'Meister der Ätherschmiede', role: 'tank', roleLabel: 'Verteidiger', difficulty: 2,
    synergy: ['schmiede'], model: 'hero_brann', resource: 'dampf', resName: 'Dampf', resMax: 100, resRegen: 8,
    palette: { primary: '#5a6472', secondary: '#c2763a', metal: '#b9c3cf', glow: '#40e6ff' },
    hp: 1200, armor: 5, armorType: 'schwer', dmg: 38, atk: 'wucht', range: 2.4, cd: 1.6,
    lore: 'Er baute die ersten Äthermaschinen – und den Hammer, der sie notfalls zerschlägt.',
    abilities: [
      A({ id: 'b1', name: 'Donnerhammer', type: 'strike', range: 3, cd: 5, cost: 20, dmg: 85, splash: 3, icon: 'hammer', desc: 'Hammerschlag mit {dmg} Schaden, Splitter treffen Gegner daneben.' }),
      A({ id: 'b2', name: 'Bolzengeschütz', type: 'turret', range: 8, cd: 22, cost: 40, dur: 15, unit: 'schmiede_walker_2', icon: 'turret', desc: 'Stellt für {dur}s ein Geschütz auf, das Gegner beschießt.' }),
      A({ id: 'b3', name: 'Raketensprung', type: 'leap', range: 16, cd: 14, cost: 15, gcd: false, dmg: 50, radius: 4, icon: 'rocket', desc: 'Springt zum Zielort und verursacht dort {dmg} Flächenschaden.' }),
      A({ id: 'b4', name: 'Reparaturfeld', type: 'heal_area', radius: 10, cd: 18, cost: 40, heal: 220, icon: 'repair', desc: 'Repariert Vasallen und dich im Umkreis um {heal}.' }),
      A({ id: 'b5', name: 'Orbitalschlag', type: 'aoe_ground', range: 28, radius: 7, cd: 32, cost: 70, dmg: 300, delay: 2, icon: 'orbital', desc: 'Markiert ein Ziel – nach 2s schlägt ein Ätherstrahl mit {dmg} Schaden ein.', ult: { radius: 9, dmg: 600 } }),
    ],
  },
  thessa: {
    id: 'thessa', name: 'Thessa Dornenruf', title: 'Stimme des Hains', role: 'caster', roleLabel: 'Beschwörerin', difficulty: 3,
    synergy: ['wild'], model: 'hero_thessa', resource: 'mana', resName: 'Mana', resMax: 200, resRegen: 10,
    palette: { primary: '#3f6a2e', secondary: '#6b3f8a', metal: '#a08060', glow: '#9cff6a' },
    hp: 880, armor: 2, armorType: 'mittel', dmg: 26, atk: 'arkan', range: 14, cd: 1.6,
    lore: 'Die Bäume flüsterten ihr den Namen des Rissfürsten zu, lange bevor er kam.',
    abilities: [
      A({ id: 't1', name: 'Dornenpeitsche', type: 'bolt', range: 18, cd: 0, cost: 20, cast: 1.0, dmg: 75, icon: 'thorn', desc: 'Dornenranke mit {dmg} Schaden (kurze Zauberzeit).' }),
      A({ id: 't2', name: 'Wurzelgriff', type: 'root_target', range: 20, cd: 10, cost: 25, root: 3, dmg: 40, icon: 'roots', desc: 'Wurzeln halten das Ziel {root}s fest.' }),
      A({ id: 't3', name: 'Wolfsgeister', type: 'summon', range: 6, cd: 24, cost: 50, unit: 'wild_wolf_2', count: 2, dur: 18, icon: 'wolves', desc: 'Ruft 2 Wolfsgeister für {dur}s an deine Seite.' }),
      A({ id: 't4', name: 'Hain der Ruhe', type: 'aura_vassals', radius: 10, cd: 22, cost: 40, regen: 25, dur: 10, icon: 'grove', desc: 'Vasallen im Umkreis regenerieren {dur}s lang 25 Leben pro Sekunde.' }),
      A({ id: 't5', name: 'Zorn des Waldes', type: 'aoe_self', radius: 8, cd: 30, cost: 70, dmg: 160, root: 1.5, icon: 'wrath', desc: 'Dornensturm um dich: {dmg} Schaden und Festhalten.', ult: { radius: 11, dmg: 340, root: 2.5 } }),
    ],
  },
  morvain: {
    id: 'morvain', name: 'Morvain der Bleiche', title: 'Händler der Schatten', role: 'caster', roleLabel: 'Hexenmeister', difficulty: 3,
    synergy: ['abgrund'], model: 'hero_morvain', resource: 'seelen', resName: 'Seelenkraft', resMax: 180, resRegen: 8,
    palette: { primary: '#1e1a2a', secondary: '#5d1f4a', metal: '#7b7f8c', glow: '#c06bff' },
    hp: 860, armor: 2, armorType: 'leicht', dmg: 26, atk: 'chaos', range: 15, cd: 1.7,
    lore: 'Er hat mit dem Abgrund verhandelt und gewonnen. Seitdem schläft er nicht mehr.',
    abilities: [
      A({ id: 'o1', name: 'Seelenbrand', type: 'dot', range: 22, cd: 0, cost: 20, dmg: 22, ticks: 8, tick: 1, icon: 'soulfire', desc: 'Verbrennt die Seele des Ziels: {ticks}× {dmg} Schaden.' }),
      A({ id: 'o2', name: 'Grauen', type: 'aoe_self', radius: 7, cd: 18, cost: 35, fear: 2.5, icon: 'fear', desc: 'Gegner im Umkreis fliehen {fear}s lang in Panik.' }),
      A({ id: 'o3', name: 'Lebensentzug', type: 'drain', range: 18, cd: 10, cost: 30, dmg: 35, ticks: 5, tick: 0.6, channel: true, icon: 'drain', desc: 'Kanalisiert: entzieht {ticks}× {dmg} Leben und heilt dich.' }),
      A({ id: 'o4', name: 'Fluchmal', type: 'mark', range: 22, cd: 12, cost: 25, pct: 0.3, dur: 10, icon: 'curse', desc: 'Verflucht das Ziel: +{pct}% erlittener Schaden.' }),
      A({ id: 'o5', name: 'Leerenriss', type: 'pull', range: 24, radius: 8, cd: 32, cost: 80, dmg: 180, icon: 'void', desc: 'Öffnet einen Riss, der Gegner zusammenzieht: {dmg} Schaden.', ult: { radius: 11, dmg: 380 } }),
    ],
  },
};
export const HERO_IDS = Object.keys(HEROES);

/** Fähigkeitswerte nach Heldenstufe (Ultimate ab ultLevel) */
export function abilityAt(ab, level, slot) {
  const base = slot === 4 && level >= HERO_STATS.ultLevel && ab.ult ? { ...ab, ...ab.ult, isUlt: true } : ab;
  const m = 1 + 0.12 * (level - 1);
  return { ...base, dmg: base.dmg ? base.dmg * m : 0, heal: base.heal ? base.heal * m : 0, absorb: base.absorb ? base.absorb * m : 0 };
}
export function abilityText(ab, level = 1, slot = 0) {
  const a = abilityAt(ab, level, slot);
  return a.desc.replace(/\{(\w+)\}/g, (_, k) => {
    const v = a[k];
    if (k === 'pct') return Math.round(v * 100);
    return typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v)) : v;
  });
}
