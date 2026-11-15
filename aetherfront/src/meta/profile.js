// Meta-Fortschritt: Account-Stufe, Völker-Meisterschaft, Erfolge, tägliche/wöchentliche Herausforderungen,
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
  { id: 'master_t3', name: 'Meisterschmied', desc: 'Werte in einer Partie 10 Kämpfer auf Stufe III auf.', test: (g) => (g.tier3 || 0) >= 10 },
  { id: 'all_modes', name: 'Vielseitig', desc: 'Gewinne in allen vier Auswahlmodi (AP, AR, PR, HP).', test: (g, p) => Object.keys(p.modeWins || {}).length >= 4 },
  { id: 'all_races', name: 'Völkerkundler', desc: 'Gewinne mit allen sechs Völkern.', test: (g, p) => Object.keys(p.raceWins || {}).length >= 6 },
  { id: 'online_win', name: 'Waffenbrüder', desc: 'Gewinne ein Online-Spiel.', test: (g) => g.win && g.online },
  { id: 'campaign', name: 'Chronist', desc: 'Schließe die Kampagne ab.', test: (g, p) => !!p.campaignDone },
];

// Kosmetik: Banner je Volk (Freischaltung über Völker-Meisterschaft) und Titel (Account-Stufe)
export const SKINS = {
  orden: [{ lvl: 3, name: 'Morgenrot-Banner' }, { lvl: 6, name: 'Sternenwacht-Banner' }],
  wild: [{ lvl: 3, name: 'Herbstwald-Banner' }, { lvl: 6, name: 'Frosthain-Banner' }],
  schmiede: [{ lvl: 3, name: 'Schwarzstahl-Banner' }, { lvl: 6, name: 'Goldschmied-Banner' }],
  abgrund: [{ lvl: 3, name: 'Schattengift-Banner' }, { lvl: 6, name: 'Blutmond-Banner' }],
  schwarm: [{ lvl: 3, name: 'Bernstein-Banner' }, { lvl: 6, name: 'Smaragdbrut-Banner' }],
  glut: [{ lvl: 3, name: 'Aschenglut-Banner' }, { lvl: 6, name: 'Sonnenkern-Banner' }],
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
  { id: 'upgrades', name: 'Werte 20 Kämpfer auf', goal: 20, stat: 'upgrades', xp: 250 },
  { id: 'income', name: 'Erreiche zusammen 500 Einkommen', goal: 500, stat: 'income', xp: 300 },
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
    this.d = { level: 1, xp: 0, mastery: {}, achievements: {}, counters: {}, modeWins: {}, raceWins: {}, endlessBest: [], daily: null, weekly: null, games: 0, skins: {} };
    try { Object.assign(this.d, JSON.parse(this.storage?.getItem(KEY) || '{}')); } catch { /* frisches Profil */ }
    // Fortschritt aus der Heldenzeit: Helden-Meisterschaften und -Siege entfallen
    delete this.d.heroWins;
    for (const k of Object.keys(this.d.mastery)) if (!SKINS[k]) delete this.d.mastery[k];
    for (const set of [this.d.daily?.list, this.d.weekly?.list]) if (set && set.some((c) => !CHALLENGES.find((x) => x.id === c.id))) { this.d.daily = null; this.d.weekly = null; }
    this.rollChallenges();
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.d)); } catch { /* nicht speicherbar */ } }
  get title() { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (this.d.level >= l) t = n; return t; }
  /** Meisterschaft eines Volks */
  mastery(faction) { return this.d.mastery[faction] || { level: 1, xp: 0 }; }
  unlockedSkins(faction) { const m = this.mastery(faction).level; return (SKINS[faction] || []).filter((s) => m >= s.lvl); }

  rollChallenges(now = new Date()) {
    const dk = dayKey(now), wk = weekKey(now);
    if (!this.d.daily || this.d.daily.key !== dk) this.d.daily = { key: dk, list: pick(`d${dk}`, 3).map((c) => ({ ...c, progress: 0, done: false })) };
    if (!this.d.weekly || this.d.weekly.key !== wk) this.d.weekly = { key: wk, list: pick(`w${wk}`, 3).map((c) => ({ ...c, goal: c.goal * 4, xp: c.xp * 3, progress: 0, done: false })) };
  }

  /**
   * Ergebnis einer Partie einbuchen. g = { win, wave, leaks, sent, income, kills, leaders, quickLeaders, upgrades, tier3,
   * faction, pickMode, mode ('skirmish'|'campaign'|'online'|'endless'), online, cleanWaves, stars }
   * Gibt eine Zusammenfassung zurück (für den Endbildschirm).
   */
  record(g) {
    const d = this.d;
    this.rollChallenges();
    d.games++;
    d.counters.quickLeaders = (d.counters.quickLeaders || 0) + (g.quickLeaders || 0);
    d.modeWins = d.modeWins || {};
    if (g.win && g.pickMode && g.mode !== 'campaign') d.modeWins[g.pickMode] = (d.modeWins[g.pickMode] || 0) + 1;
    if (g.win && g.faction && g.faction !== 'hybrid') d.raceWins[g.faction] = (d.raceWins[g.faction] || 0) + 1;
    if (g.mode === 'endless') { d.endlessBest.push({ wave: g.wave, faction: g.faction, date: dayKey() }); d.endlessBest.sort((a, b) => b.wave - a.wave); d.endlessBest = d.endlessBest.slice(0, 10); }
    // Erfahrung: Grundwert + Wellen + Sieg; Niederlagen geben immer noch Fortschritt
    let xp = 120 + 12 * (g.wave || 0) + (g.win ? 250 : 60) + 6 * (g.leaders || 0) + 40 * (g.stars || 0);
    const done = [];
    const stats = { wins: g.win ? 1 : 0, waves: g.wave || 0, leaders: g.leaders || 0, sent: g.sent || 0, upgrades: g.upgrades || 0, income: g.income || 0, kills: g.kills || 0, cleanWaves: g.cleanWaves || 0 };
    for (const set of [d.daily.list, d.weekly.list]) for (const c of set) {
      if (c.done) continue;
      c.progress = Math.min(c.goal, c.progress + (stats[c.stat] || 0));
      if (c.progress >= c.goal) { c.done = true; xp += c.xp; done.push(c.name); }
    }
    const levelUps = [];
    d.xp += xp;
    while (d.xp >= ACCOUNT_XP(d.level)) { d.xp -= ACCOUNT_XP(d.level); d.level++; levelUps.push(d.level); }
    let masteryUp = null;
    if (g.faction && SKINS[g.faction]) {
      const m = (d.mastery[g.faction] = d.mastery[g.faction] || { level: 1, xp: 0 });
      m.xp += Math.round(xp * 0.8);
      while (m.xp >= MASTERY_XP(m.level)) { m.xp -= MASTERY_XP(m.level); m.level++; masteryUp = m.level; }
    }
    const newAch = [];
    for (const a of ACHIEVEMENTS) if (!d.achievements[a.id] && a.test(g, d)) { d.achievements[a.id] = dayKey(); newAch.push(a.name); }
    this.save();
    return { xp, level: d.level, levelUps, masteryUp, challenges: done, achievements: newAch, title: this.title };
  }
}
