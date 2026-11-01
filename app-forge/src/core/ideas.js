'use strict';
/**
 * Idea engine: produces random but coherent seeds for new apps.
 * The randomness lives in the *combination* of seeds; the AI (or an offline
 * template) turns a seed into a concept that must pass a sense check.
 */
const { PALETTES, STYLES } = require('./design');

function createRng(seed) {
  let a = (seed >>> 0) || (Date.now() >>> 0);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  };
}

const TOOL_CATEGORIES = [
  'Produktivität & Fokus', 'Gesundheit & Fitness', 'Finanzen & Sparen', 'Lernen & Wissen', 'Haushalt & Organisation',
  'Kochen & Ernährung', 'Achtsamkeit & Schlaf', 'Reisen & Ausflüge', 'Haustiere', 'Kreativität & Hobby',
  'Sport & Training', 'Garten & Pflanzen', 'Fahrrad & Mobilität', 'Musik & Üben', 'Angeln & Outdoor',
  'Gewohnheiten & Ziele', 'Planung mit Freunden', 'Wohnung & Umzug'
];

const GAME_GENRES = [
  'Reaktion & Timing', 'Logik-Puzzle', 'Arcade-Ausweichen', 'Gedächtnis', 'Wort & Buchstaben', 'Physik & Balance',
  'Rhythmus & Tippen', 'Idle & Aufbau', 'Mini-Strategie', 'Zahlen & Kopfrechnen', 'Farben & Muster', 'Einhand-Endlos-Spiel'
];

const AUDIENCES = [
  'Berufstätige mit wenig Zeit', 'Studierende', 'Schichtarbeiter', 'Eltern im Alltagsstress', 'Pendler in Bus und Bahn',
  'Hobby-Sportler', 'Handwerker & Werkstatt-Profis', 'Haustierbesitzer', 'Senioren, die es einfach mögen', 'Gelegenheits-Gamer in Pausen',
  'Menschen, die mehr Ruhe suchen', 'Sparfüchse', 'Outdoor-Fans', 'Kreative Köpfe', 'Fahrradfahrer'
];

const TWISTS = [
  'funktioniert komplett offline', 'in unter 30 Sekunden pro Tag nutzbar', 'mit motivierendem Streak-System', 'mit Wochenrückblick und Diagramm',
  'perfekt mit einer Hand bedienbar', 'mit täglicher Zufalls-Challenge', 'mit Level- und Erfahrungssystem', 'mit Ergebnis-Teilen per Text-Kopie',
  'mit cleveren Vorlagen für den Schnellstart', 'mit sanftem Erinnerungs-Konzept ohne Push', 'mit Erfolgen/Abzeichen', 'mit Fortschrittsring auf dem Startscreen'
];

const MOODS = ['verspielt', 'ruhig', 'energetisch', 'edel', 'futuristisch', 'natürlich', 'minimalistisch', 'warm', 'sportlich'];

const NAME_PREFIX = ['Nova', 'Lumi', 'Aura', 'Flux', 'Vivo', 'Orbi', 'Mira', 'Zeno', 'Sola', 'Kiro', 'Pixa', 'Yuna', 'Ondo', 'Tavi', 'Rilo', 'Vela', 'Neko', 'Brio', 'Calo', 'Fino'];
const NAME_SUFFIX = ['', ' Go', ' Flow', ' Pro', ' Mate', ' Pocket', ' Pulse', ' Daily', ' Now', ' Lab'];

function generateName(rng, word) {
  const prefix = rng.pick(NAME_PREFIX);
  if (word) return `${prefix} ${word}`;
  return `${prefix}${rng.pick(NAME_SUFFIX)}`.trim();
}

/** A random but structured seed for the concept step. */
function randomSeed(seed) {
  const rng = createRng(seed);
  const isGame = rng.chance(0.45);
  return {
    seed: seed >>> 0,
    type: isGame ? 'game' : 'tool',
    category: isGame ? rng.pick(GAME_GENRES) : rng.pick(TOOL_CATEGORIES),
    audience: rng.pick(AUDIENCES),
    twist: rng.pick(TWISTS),
    mood: rng.pick(MOODS),
    palette: rng.pick(PALETTES).id,
    style: rng.pick(STYLES).id
  };
}

module.exports = { createRng, randomSeed, generateName, TOOL_CATEGORIES, GAME_GENRES, AUDIENCES, TWISTS, MOODS };
