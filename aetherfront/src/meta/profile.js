// Meta-Fortschritt: Account-Stufe, Helden-Meisterschaft, Erfolge, tägliche/wöchentliche Herausforderungen,
// Wochen-Modifikator, Endlos-Bestenliste, freischaltbare Kosmetik. Zählt in Kampagne UND Gefecht/Online.
// Fair: kein Pay-to-Win, keine Wartezeiten – jede Partie gibt Fortschritt, auch eine Niederlage.

const KEY = 'aetherfront.profile.v1';

export const ACCOUNT_XP = (lvl) => 400 + 150 * lvl; // XP bis zur nächsten Stufe
export const MASTERY_XP = (lvl) => 300 + 120 * lvl;

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Erster Sieg', desc: 'Gewinne eine Partie.', test: (g) => g.win },
  { id: 'no_leak', name: 'Undurchdringlich', desc: 'Gewinne ohne einen einzigen Durchbruch.', test: (g) => g.win && g.leaks === 0 },
  { id: 'wave30', name: 'Bis zum Ende', desc: 'Erreiche Welle 30.', test: (g) => g.wave >= 30 },
  { id: 'endless40', name: 'Endlos', desc: 'Erreiche im Endlos-Modus Welle 40.', test: (g) => g.mode === 'endless' && g.wave >= 40 },
  { id: 'leader10', name: 'Anführer-Jäger', desc: 'Besiege 10 Wellen-Anführer schnell (in 20 s).', test: (g, p) => (p.counters.quickLeaders || 0) >= 10 },
  { id: 'sender', name: 'Kriegskasse', desc: 'Schicke 25 Söldner in einer Partie.', test: (g) => g.sent >= 25 },
  { id: 'income300', name: 'Reiche Ernte', desc: 'Erreiche 300 Einkommen.', test: (g) => g.income >= 300 },
  { id: 'hero_lv10', name: 'Legende', desc: 'Bringe einen Helden in einer Partie auf Stufe 10.', test: (g) => g.heroLevel >= 10 },
  { id: 'all_heroes', name: 'Vielseitig', desc: 'Gewinne mit allen sechs Helden.', test: (g, p) => Object.keys(p.heroWins || {}).length >= 6 },
  { id: 'all_races', name: 'Völkerkundler', desc: 'Gewinne mit allen sechs Völkern.', test: (g, p) => Object.keys(p.raceWins || {}).length >= 6 },
  { id: 'online_win', name: 'Waffenbrüder', desc: 'Gewinne ein Online-Spiel.', test: (g) => g.win && g.online },
  { id: 'campaign', name: 'Chronist', desc: 'Schließe die Kampagne ab.', test: (g, p) => !!p.campaignDone },
];

// Kosmetik: Farbvarianten für Helden (Freischaltung über Meisterschaft) und Banner-Titel (Account-Stufe)
export const SKINS = {
  kael: [{ lvl: 3, name: 'Morgenrot', palette: { secondary: '#c0392b', glow: '#ffb35a' } }, { lvl: 6, name: 'Sternenwacht', palette: { primary: '#2a2f4a', secondary: '#c9a24a', glow: '#9ad0ff' } }],
  mira: [{ lvl: 3, name: 'Mondlicht', palette: { secondary: '#8aa8ff', glow: '#cfe0ff' } }, { lvl: 6, name: 'Sonnenfeuer', palette: { secondary: '#ff7a2a', glow: '#ffd23a' } }],
  lyra: [{ lvl: 3, name: 'Herbstwald', palette: { primary: '#8a5a2a', glow: '#ffb84a' } }, { lvl: 6, name: 'Frostjägerin', palette: { primary: '#e8f0ff', secondary: '#5a8aff', glow: '#9ae8ff' } }],
  selene: [{ lvl: 3, name: 'Amethyst', palette: { secondary: '#7a3ab8', glow: '#d07aff' } }, { lvl: 6, name: 'Rubinherz', palette: { secondary: '#b8243a', glow: '#ff6a7a' } }],
  brann: [{ lvl: 3, name: 'Schwarzstahl', palette: { primary: '#2a2a30', glow: '#ff8a3a' } }, { lvl: 6, name: 'Goldschmied', palette: { metal: '#e0b850', glow: '#ffe08a' } }],
  varo: [{ lvl: 3, name: 'Schattengift', palette: { secondary: '#3ab86a', glow: '#8aff6a' } }, { lvl: 6, name: 'Blutmond', palette: { primary: '#3a0a12', glow: '#ff2a3a' } }],
};
export const TITLES = [[1, 'Rekrut'], [5, 'Wächter'], [10, 'Hauptmann'], [20, 'Kommandant'], [35, 'Feldherr'], [50, 'Legende der Front']];

// Rotierende Wochen-Modifikatoren (für den Wochen-Modus im Gefecht)
export const WEEKLY_MODS = [
  { id: 'golden', name: 'Goldrausch', desc: 'Kopfgeld +50 %, Wellen +15 % Leben.', rules: { bountyMul: 1.5, waveHpMul: 1.15 } },
  { id: 'champions', name: 'Champion-Woche', desc: 'Champions in jeder Welle, mehr Beute.', rules: { champions: true, bountyMul: 1.2 } },
  { id: 'swift', name: 'Schnelle Klingen', desc: 'Kurze Bauphasen, schnellere Gegner.', rules: { buildTime: 22, creepSpeedMul: 1.15 } },
  { id: 'hybrid', name: 'Chaos-Arsenal', desc: 'Alle spielen Hybrid-Baumeister.', rules: { pickMode: 'hp' } },
  { id: 'iron', name: 'Eiserne Wellen', desc: 'Gegner +3 Rüstung, dafür +40 Startgold.', rules: { waveArmorAdd: 3, startGold: 300 } },
];

// Herausforderungen (täglich 3, wöchentlich 3) – aus dem Datum deterministisch gewählt
const CHALLENGES = [
  { id: 'win_any', name: 'Siege eine Partie', goal: 1, stat: 'wins', xp: 300 },
  { id: 'waves', name: 'Halte 25 Wellen', goal: 25, stat: 'waves', xp: 250 },
  { id: 'leaders', name: 'Besiege 8 Anführer', goal: 8, stat: 'leaders', xp: 250 },
  { id: 'sends', name: 'Schicke 30 Söldner', goal: 30, stat: 'sent', xp: 250 },
  { id: 'heal', name: 'Heile 20.000 Leben mit deinem Helden', goal: 20000, stat: 'heroHeal', xp: 300 },
  { id: 'dmg', name: 'Verursache 200.000 Heldenschaden', goal: 200000, stat: 'heroDmg', xp: 300 },
  { id: 'kills', name: 'Besiege 400 Gegner', goal: 400, stat: 'kills', xp: 250 },
  { id: 'clean', name: 'Halte 10 Wellen ohne Durchbruch', goal: 10, stat: 'cleanWaves', xp: 300 },
];

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
export function weekKey(d = new Date()) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${Math.ceil(((t - y) / 864e5 + 1) / 7)}`; }
function pick(key, n) { const out = []; let h = hashStr(key); const pool = CHALLENGES.slice(); while (out.length < n && pool.length) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); } return out; }
export function weeklyModifier(d = new Date()) { return WEEKLY_MODS[hashStr(weekKey(d)) % WEEKLY_MODS.length]; }

export class Profile {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.d = { level: 1, xp: 0, mastery: {}, achievements: {}, counters: {}, heroWins: {}, raceWins: {}, endlessBest: [], daily: null, weekly: null, games: 0, skins: {} };
    try { Object.assign(this.d, JSON.parse(this.storage?.getItem(KEY) || '{}')); } catch { /* frisches Profil */ }
    this.rollChallenges();
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.d)); } catch { /* nicht speicherbar */ } }
  get title() { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (this.d.level >= l) t = n; return t; }
  mastery(hero) { return this.d.mastery[hero] || { level: 1, xp: 0 }; }
  unlockedSkins(hero) { const m = this.mastery(hero).level; return (SKINS[hero] || []).filter((s) => m >= s.lvl); }

  rollChallenges(now = new Date()) {
    const dk = dayKey(now), wk = weekKey(now);
    if (!this.d.daily || this.d.daily.key !== dk) this.d.daily = { key: dk, list: pick(`d${dk}`, 3).map((c) => ({ ...c, progress: 0, done: false })) };
    if (!this.d.weekly || this.d.weekly.key !== wk) this.d.weekly = { key: wk, list: pick(`w${wk}`, 3).map((c) => ({ ...c, goal: c.goal * 4, xp: c.xp * 3, progress: 0, done: false })) };
  }

  /**
   * Ergebnis einer Partie einbuchen. g = { win, wave, leaks, sent, income, kills, leaders, quickLeaders, heroId, heroLevel,
   * heroDmg, heroHeal, faction, mode ('skirmish'|'campaign'|'online'|'endless'), online, cleanWaves, stars }
   * Gibt eine Zusammenfassung zurück (für den Endbildschirm).
   */
  record(g) {
    const d = this.d;
    this.rollChallenges();
    d.games++;
    d.counters.quickLeaders = (d.counters.quickLeaders || 0) + (g.quickLeaders || 0);
    if (g.win && g.heroId) d.heroWins[g.heroId] = (d.heroWins[g.heroId] || 0) + 1;
    if (g.win && g.faction && g.faction !== 'hybrid') d.raceWins[g.faction] = (d.raceWins[g.faction] || 0) + 1;
    if (g.mode === 'endless') { d.endlessBest.push({ wave: g.wave, hero: g.heroId, faction: g.faction, date: dayKey() }); d.endlessBest.sort((a, b) => b.wave - a.wave); d.endlessBest = d.endlessBest.slice(0, 10); }
    // Erfahrung: Grundwert + Wellen + Sieg; Niederlagen geben immer noch Fortschritt
    let xp = 120 + 12 * (g.wave || 0) + (g.win ? 250 : 60) + 6 * (g.leaders || 0) + 40 * (g.stars || 0);
    const done = [];
    const stats = { wins: g.win ? 1 : 0, waves: g.wave || 0, leaders: g.leaders || 0, sent: g.sent || 0, heroHeal: g.heroHeal || 0, heroDmg: g.heroDmg || 0, kills: g.kills || 0, cleanWaves: g.cleanWaves || 0 };
    for (const set of [d.daily.list, d.weekly.list]) for (const c of set) {
      if (c.done) continue;
      c.progress = Math.min(c.goal, c.progress + (stats[c.stat] || 0));
      if (c.progress >= c.goal) { c.done = true; xp += c.xp; done.push(c.name); }
    }
    const levelUps = [];
    d.xp += xp;
    while (d.xp >= ACCOUNT_XP(d.level)) { d.xp -= ACCOUNT_XP(d.level); d.level++; levelUps.push(d.level); }
    let masteryUp = null;
    if (g.heroId) {
      const m = (d.mastery[g.heroId] = d.mastery[g.heroId] || { level: 1, xp: 0 });
      m.xp += Math.round(xp * 0.8);
      while (m.xp >= MASTERY_XP(m.level)) { m.xp -= MASTERY_XP(m.level); m.level++; masteryUp = m.level; }
    }
    const newAch = [];
    for (const a of ACHIEVEMENTS) if (!d.achievements[a.id] && a.test(g, d)) { d.achievements[a.id] = dayKey(); newAch.push(a.name); }
    this.save();
    return { xp, level: d.level, levelUps, masteryUp, challenges: done, achievements: newAch, title: this.title };
  }
}
