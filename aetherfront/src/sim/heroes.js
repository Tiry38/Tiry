// Helden: 6 Klassen (Tank, Heilerin, Jägerin, Magierin, Krieger, Schurke) mit je 5 Fähigkeiten (Tasten 1–5).
// Alle Nicht-Heiler haben eine leichte Selbstheilung (heal_self) – schwächer als die Heilerin. Reine Daten – die Logik steckt in sim/hero.js.
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
    id: 'kael', name: 'Kael Sturmbrecher', title: 'Schild der Bastion', role: 'tank', roleLabel: 'Tank', cls: 'Wächter', difficulty: 1,
    synergy: ['orden', 'schwarm'], model: 'hero_kael', resource: 'wut', resName: 'Wut', resMax: 100, resRegen: 6,
    palette: { primary: '#d8dbe4', secondary: '#2a5fd0', metal: '#c9a24a', glow: '#7cc8ff' },
    hp: 1500, armor: 7, armorType: 'schwer', dmg: 32, atk: 'klinge', range: 2.2, cd: 1.5,
    lore: 'Letzter Hauptmann der Himmelsbastion. Er steht vorn, damit hinter ihm niemand fallen muss.',
    abilities: [
      A({ id: 'k1', name: 'Schildschlag', type: 'strike', range: 3, cd: 6, cost: 15, dmg: 70, stun: 1.2, icon: 'shield', anim: 'bash', desc: 'Rammt den Schild ins Ziel: {dmg} Schaden und Betäubung (unterbricht Zauber).' }),
      A({ id: 'k2', name: 'Herausforderung', type: 'taunt', radius: 10, cd: 12, cost: 10, armorBuff: 6, dur: 6, icon: 'roar', anim: 'roar', desc: 'Zwingt alle Gegner im Umkreis, dich anzugreifen, statt deine Vasallen. +{armorBuff} Rüstung.' }),
      A({ id: 'k3', name: 'Ansturm', type: 'dash', range: 16, minRange: 3, cd: 12, cost: 0, dmg: 40, stun: 0.8, gcd: false, icon: 'charge', anim: 'charge', desc: 'Stürmt zum Ziel und betäubt es. Erzeugt 20 Wut.', gain: 20 }),
      A({ id: 'k4', name: 'Schildwall', type: 'heal_self', cd: 30, cost: 20, gcd: false, healPct: 0.22, armorBuff: 8, dur: 6, icon: 'wall', anim: 'guard', desc: 'Heilt dich um {healPct}% deines Lebens und gibt {dur}s lang +{armorBuff} Rüstung.' }),
      A({ id: 'k5', name: 'Erdenbrecher', type: 'aoe_self', radius: 6, cd: 30, cost: 40, dmg: 140, stun: 1.6, icon: 'quake', anim: 'slam', desc: 'Schmettert den Boden: {dmg} Schaden und Betäubung im Umkreis.', ult: { radius: 9, dmg: 320, stun: 2.5 } }),
    ],
  },
  mira: {
    id: 'mira', name: 'Mira Lichtquell', title: 'Hüterin der Flamme', role: 'healer', roleLabel: 'Heilerin', cls: 'Priesterin', difficulty: 2,
    synergy: ['orden', 'wild', 'glut'], model: 'hero_mira', resource: 'mana', resName: 'Mana', resMax: 240, resRegen: 13,
    palette: { primary: '#f4eedc', secondary: '#d0a33a', metal: '#e0c070', glow: '#ffe08a' },
    hp: 900, armor: 2, armorType: 'mittel', dmg: 22, atk: 'arkan', range: 14, cd: 1.6,
    lore: 'Priesterin des letzten Leuchtturms. Wo sie geht, schließen sich Wunden – und Risse.',
    abilities: [
      A({ id: 'm1', name: 'Lichtstoß', type: 'bolt', range: 18, cd: 0, cost: 15, cast: 1.2, dmg: 80, icon: 'light', anim: 'cast', desc: 'Heiliges Geschoss mit {dmg} Schaden (Zauberzeit).' }),
      A({ id: 'm2', name: 'Heilwelle', type: 'heal_area', radius: 10, cd: 5, cost: 35, heal: 170, cast: 1.0, icon: 'heal', anim: 'heal', desc: 'Heilt dich und alle Vasallen im Umkreis um {heal} (kurze Zauberzeit).' }),
      A({ id: 'm3', name: 'Schutzsiegel', type: 'shield', range: 20, cd: 10, cost: 30, absorb: 280, dur: 8, icon: 'ward', anim: 'cast', desc: 'Schild auf dich oder den Vasallen im Ziel – absorbiert {absorb} Schaden.' }),
      A({ id: 'm4', name: 'Weihe', type: 'aoe_ground', range: 18, radius: 6, cd: 14, cost: 45, dmg: 25, heal: 40, ticks: 8, tick: 1, icon: 'consecrate', anim: 'cast', desc: 'Geweihter Boden: schadet Gegnern und heilt Verbündete 8 Sekunden lang.' }),
      A({ id: 'm5', name: 'Wiedergeburt', type: 'revive', radius: 12, cd: 45, cost: 100, heal: 420, icon: 'rebirth', anim: 'heal', desc: 'Erweckt gefallene Vasallen im Umkreis und heilt alle um {heal}.', ult: { radius: 18, heal: 900 } }),
    ],
  },
  lyra: {
    id: 'lyra', name: 'Lyra Morgenfeder', title: 'Jägerin der Wipfel', role: 'ranged', roleLabel: 'Fernkampf', cls: 'Jägerin', difficulty: 2,
    synergy: ['wild', 'schwarm'], model: 'hero_lyra', resource: 'fokus', resName: 'Fokus', resMax: 100, resRegen: 10,
    palette: { primary: '#5d7f3a', secondary: '#8a5a32', metal: '#c0a060', glow: '#b6ff7a' },
    hp: 960, armor: 2, armorType: 'mittel', dmg: 36, atk: 'stich', range: 16, cd: 1.5,
    lore: 'Sie wuchs in den Kronen der Himmelswälder auf. Ihr Pfeil trifft, was das Auge kaum sieht.',
    abilities: [
      A({ id: 'l1', name: 'Zielschuss', type: 'bolt', range: 20, cd: 0, cost: 25, cast: 1.4, dmg: 120, mark: 0.15, icon: 'aim', anim: 'draw', desc: 'Konzentrierter Schuss mit {dmg} Schaden – das Ziel erleidet danach mehr Schaden von deinen Vasallen.' }),
      A({ id: 'l2', name: 'Fächersalve', type: 'cone', range: 12, angle: 0.9, cd: 8, cost: 30, dmg: 80, icon: 'fan', anim: 'volley', desc: 'Pfeilfächer nach vorn: {dmg} Schaden an allen getroffenen Gegnern.' }),
      A({ id: 'l3', name: 'Rückwärtssalto', type: 'leap_back', range: 10, cd: 14, cost: 10, gcd: false, slow: 0.5, icon: 'leap', anim: 'flip', desc: 'Springt zurück und verlangsamt Gegner in der Nähe.' }),
      A({ id: 'l4', name: 'Kräuterverband', type: 'heal_self', cd: 35, cost: 20, healPct: 0.25, hot: 6, icon: 'herb', anim: 'bandage', desc: 'Heilt dich über 6 Sekunden um {healPct}% deines Lebens.' }),
      A({ id: 'l5', name: 'Pfeilregen', type: 'aoe_ground', range: 24, radius: 6, cd: 28, cost: 50, dmg: 45, ticks: 6, tick: 0.5, channel: true, icon: 'rain', anim: 'skyshot', desc: 'Kanalisiert einen Pfeilregen: {ticks}× {dmg} Schaden im Zielgebiet.', ult: { radius: 8, dmg: 90, ticks: 8 } }),
    ],
  },
  selene: {
    id: 'selene', name: 'Selene Äthersang', title: 'Stimme des Kristalls', role: 'caster', roleLabel: 'Fernkampf', cls: 'Magierin', difficulty: 2,
    synergy: ['schmiede', 'glut'], model: 'hero_selene', resource: 'mana', resName: 'Mana', resMax: 200, resRegen: 9,
    palette: { primary: '#e8e4f6', secondary: '#3a46b8', metal: '#b7c3d6', glow: '#5ae2ff' },
    hp: 880, armor: 1, armorType: 'leicht', dmg: 32, atk: 'arkan', range: 15, cd: 1.6,
    lore: 'Die Ätherschmiede formten ihr Herz aus Kristall. Sie hört den Riss singen – und singt zurück.',
    abilities: [
      A({ id: 's1', name: 'Ätherlanze', type: 'bolt', range: 22, cd: 0, cost: 30, cast: 1.8, dmg: 140, icon: 'lance', anim: 'cast', desc: 'Schleudert eine Lanze aus Äther: {dmg} Schaden (Zauberzeit).' }),
      A({ id: 's2', name: 'Frostnova', type: 'aoe_self', radius: 6, cd: 14, cost: 40, dmg: 40, root: 3, icon: 'nova', anim: 'nova', desc: 'Friert Gegner im Umkreis {root}s fest und verursacht {dmg} Schaden.' }),
      A({ id: 's3', name: 'Blinzeln', type: 'blink', range: 12, cd: 12, cost: 20, gcd: false, forward: true, icon: 'blink', anim: 'blink', desc: 'Teleportiert dich 12 Meter nach vorn.' }),
      A({ id: 's4', name: 'Kristallhülle', type: 'heal_self', cd: 40, cost: 40, healPct: 0.18, absorbPct: 0.2, dur: 8, icon: 'crystal', anim: 'guard', desc: 'Kristall umhüllt dich: heilt {healPct}% und absorbiert Schaden in Höhe von {absorbPct}% deines Lebens.' }),
      A({ id: 's5', name: 'Meteor', type: 'aoe_ground', range: 26, radius: 6, cd: 30, cost: 80, dmg: 260, delay: 1.5, stun: 1, icon: 'meteor', anim: 'skycast', desc: 'Ruft nach 1,5s einen Meteor: {dmg} Schaden und Betäubung im Zielgebiet.', ult: { radius: 8, dmg: 520 } }),
    ],
  },
  brann: {
    id: 'brann', name: 'Brann Eisenfaust', title: 'Hammer der Schmiede', role: 'melee', roleLabel: 'Nahkampf', cls: 'Krieger', difficulty: 1,
    synergy: ['schmiede', 'abgrund'], model: 'hero_brann', resource: 'wut', resName: 'Wut', resMax: 100, resRegen: 7,
    palette: { primary: '#5a6472', secondary: '#c2763a', metal: '#b9c3cf', glow: '#40e6ff' },
    hp: 1150, armor: 5, armorType: 'schwer', dmg: 42, atk: 'wucht', range: 2.4, cd: 1.5,
    lore: 'Er baute die ersten Äthermaschinen – und den Hammer, der sie notfalls zerschlägt.',
    abilities: [
      A({ id: 'b1', name: 'Donnerhammer', type: 'strike', range: 3, cd: 5, cost: 20, dmg: 95, splash: 3, icon: 'hammer', anim: 'overhead', desc: 'Wuchtiger Hammerschlag mit {dmg} Schaden, Splitter treffen Gegner daneben.' }),
      A({ id: 'b2', name: 'Wirbelwind', type: 'aoe_self', radius: 5, cd: 8, cost: 30, dmg: 85, icon: 'spin', anim: 'spin', desc: 'Wirbelt den Hammer um sich: {dmg} Schaden an allen Gegnern im Umkreis.' }),
      A({ id: 'b3', name: 'Heldensprung', type: 'leap', range: 16, cd: 14, cost: 15, gcd: false, dmg: 60, radius: 4, stun: 0.6, icon: 'rocket', anim: 'leap', desc: 'Springt zum Zielort und verursacht dort {dmg} Flächenschaden.' }),
      A({ id: 'b4', name: 'Siegesrausch', type: 'heal_self', cd: 25, cost: 0, gcd: false, healPct: 0.2, needKill: false, icon: 'victory', anim: 'roar', desc: 'Neue Kraft aus dem Kampf: heilt dich sofort um {healPct}% deines Lebens.' }),
      A({ id: 'b5', name: 'Himmelsschmiede', type: 'aoe_ground', range: 28, radius: 7, cd: 32, cost: 60, dmg: 300, delay: 2, icon: 'orbital', anim: 'skycast', desc: 'Markiert ein Ziel – nach 2s schlägt ein Ätherstrahl mit {dmg} Schaden ein.', ult: { radius: 9, dmg: 600 } }),
    ],
  },
  varo: {
    id: 'varo', name: 'Varo Glutklinge', title: 'Tänzer im Zwielicht', role: 'assassin', roleLabel: 'Nahkampf', cls: 'Schurke', difficulty: 3,
    synergy: ['abgrund', 'wild'], model: 'hero_varo', resource: 'energie', resName: 'Energie', resMax: 100, resRegen: 14,
    palette: { primary: '#2c2440', secondary: '#a8243c', metal: '#9a9fb0', glow: '#ff5a3a' },
    hp: 960, armor: 3, armorType: 'mittel', dmg: 44, atk: 'klinge', range: 2.4, cd: 1.1,
    lore: 'Einst Klinge des Rissfürsten. Er wandte sich ab, als er sah, was hinter dem Riss wartet.',
    abilities: [
      A({ id: 'v1', name: 'Finsterstich', type: 'strike', range: 3, cd: 0, cost: 35, dmg: 85, icon: 'cuts', anim: 'stab', desc: 'Schneller Stich mit beiden Klingen: {dmg} Schaden.' }),
      A({ id: 'v2', name: 'Schattenschritt', type: 'blink', range: 18, cd: 10, cost: 20, gcd: false, behind: true, icon: 'shadow', anim: 'blink', desc: 'Teleportiert hinter das Ziel. Der nächste Angriff trifft kritisch.' }),
      A({ id: 'v3', name: 'Ausweiden', type: 'dot', range: 3, cd: 8, cost: 25, dmg: 30, ticks: 6, tick: 1, icon: 'bleed', anim: 'slash', desc: 'Blutung: {ticks}× {dmg} Schaden über Zeit.' }),
      A({ id: 'v4', name: 'Erholung', type: 'heal_self', cd: 30, cost: 25, healPct: 0.24, hot: 8, icon: 'recover', anim: 'breath', desc: 'Atemtechnik: heilt dich über 8 Sekunden um {healPct}% deines Lebens.' }),
      A({ id: 'v5', name: 'Tausend Schnitte', type: 'strike', range: 3, cd: 26, cost: 50, dmg: 60, hits: 5, icon: 'spin', anim: 'flurry', desc: 'Fünf blitzschnelle Hiebe mit je {dmg} Schaden.', ult: { dmg: 120, hits: 7 } }),
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
    if (k === 'pct' || k === 'healPct' || k === 'absorbPct') return Math.round(v * 100);
    return typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v)) : v;
  });
}
