// Solo-Kampagne „Chronik des Risses“: 4 Akte, 15 Missionen.
// Spielprinzip solo: Du hältst deine Bahn wie gewohnt (bauen, aufwerten, Wellen abfangen).
// Statt einen Mitspieler zu bedrängen, schicken deine Söldner sich über die Brücke gegen die
// Rissfeste des Rissfürsten – jeder Söldner erhöht dein Einkommen UND beschädigt die Feste.
// Ziele: „Belagerung“ (Feste zerstören, bevor die letzte Welle vorbei ist) oder „Halten“ (alle Wellen überstehen).

export const ACTS = [
  { id: 1, name: 'Akt I – Das Erwachen', short: 'Das Erwachen', grad: ['#ffd27a', '#ff9f5a', '#5a8bff'], unlock: null },
  { id: 2, name: 'Akt II – Der grüne Zorn', short: 'Der grüne Zorn', grad: ['#9cff6a', '#2fd5a0', '#e8c25a'], unlock: 'wild' },
  { id: 3, name: 'Akt III – Eisen und Äther', short: 'Eisen und Äther', grad: ['#40e6ff', '#3a7bff', '#ff8a3a'], unlock: 'schmiede' },
  { id: 4, name: 'Akt IV – Herz des Abgrunds', short: 'Herz des Abgrunds', grad: ['#c06bff', '#ff4fa3', '#4a3bff'], unlock: 'abgrund' },
];

// Erwarteter Armeewert/Einkommen zu Beginn einer Welle (aus Bot-Simulationen gemessen)
function econAt(w) {
  const value = Math.round(250 * Math.pow(1.158, w - 1));
  return {
    startGold: Math.round(value * 1.08),
    startIncome: Math.round(20 + 9.5 * (w - 1)),
    startWorkers: Math.min(12, 1 + Math.floor((w - 1) / 2)),
    startAether: 40 + 8 * (w - 1),
  };
}

const M = (o) => {
  const e = o.startWave > 1 ? econAt(o.startWave) : {};
  return { ...o, rules: { buildTimeFirst: o.startWave > 1 ? 70 : 45, ...e, ...(o.rules || {}), startWave: o.startWave, maxWaves: o.endWave } };
};

export const MISSIONS = [
  // ---------- Akt I ----------
  M({ id: 1, act: 1, title: 'Der erste Riss', goal: 'survive', startWave: 1, endWave: 6, faction: 'orden',
    story: 'Über den Himmelsinseln reißt der Äther auf. Die Bastion hat nur dich: Stelle eine Verteidigung auf und halte die ersten Wellen.',
    tips: ['Setze Nahkämpfer nach vorn (obere Reihen), Fernkämpfer dahinter.', 'Nach jeder Welle stehen alle Kämpfer wieder geheilt auf ihrem Platz.'],
    citadel: { hp: 8000, regen: 0, dmg: 0.8 }, star3: { type: 'leaks', max: 0 } }),
  M({ id: 2, act: 1, title: 'Funken im Wind', goal: 'siege', startWave: 1, endWave: 10, faction: 'orden',
    story: 'Die Rissfeste des Fürsten Vael’Thar schwebt jenseits der Brücke. Wirb Äther-Funken an und schick Söldner hinüber – jeder Angriff stärkt auch deine Kriegskasse.',
    tips: ['Funken (B) sammeln Äther. Söldner (1–7) kosten Äther und erhöhen dein Einkommen.', 'Söldner marschieren mit der nächsten Welle gegen die Rissfeste.'],
    citadel: { hp: 5200, regen: 2, dmg: 0.8 }, star3: { type: 'byWave', wave: 8 } }),
  M({ id: 3, act: 1, title: 'Die Steinerne Wacht', goal: 'survive', startWave: 5, endWave: 10, faction: 'orden',
    story: 'Aus dem Riss steigt ein Titan aus lebendem Fels. Er darf die Bastion nicht erreichen.',
    tips: ['Welle 10 ist ein Boss. Belagerung und Wucht wirken gut gegen schwere Panzerung.'],
    citadel: { hp: 26000, regen: 4, dmg: 1 }, star3: { type: 'leaks', max: 2 } }),
  M({ id: 4, act: 1, title: 'Brücke der Klingen', goal: 'siege', startWave: 6, endWave: 13, faction: 'orden',
    story: 'Vael’Thar schickt seine eigenen Söldner über die Brücke. Halte stand – und schlag zurück.',
    tips: ['Der Rissfürst sendet in Welle 8, 10 und 12 zusätzliche Gegner in deine Bahn.'],
    citadel: { hp: 14500, regen: 5, dmg: 1 },
    enemySends: [{ wave: 8, send: 's_hound', count: 3 }, { wave: 10, send: 's_beetle', count: 2 }, { wave: 12, send: 's_imp', count: 2 }],
    star3: { type: 'kingHp', pct: 0.8 } }),
  // ---------- Akt II ----------
  M({ id: 5, act: 2, title: 'Dornenpfad', goal: 'survive', startWave: 8, endWave: 14, faction: 'wild',
    story: 'Die Wälder von Ysmir erwachen. Doch die Rissbrut trägt jetzt Eisenhaut.',
    mods: ['Eisenhaut: Alle Wellen +2 Rüstung und +10 % Leben'], rules: { waveArmorAdd: 2, waveHpMul: 1.1 },
    citadel: { hp: 32000, regen: 6, dmg: 1 }, star3: { type: 'leaks', max: 3 } }),
  M({ id: 6, act: 2, title: 'Mondjagd', goal: 'siege', startWave: 9, endWave: 16, faction: 'wild',
    story: 'In Vollmondnächten führen Champions die Horden an. Jag sie – und brich die Feste.',
    mods: ['Champions: Jeder vierte Gegner ist ein Champion (3× Leben, 3× Kopfgeld)'], rules: { champions: true },
    citadel: { hp: 20000, regen: 8, dmg: 1.1 }, star3: { type: 'noHeal' } }),
  M({ id: 7, act: 2, title: 'Glutsümpfe', goal: 'survive', startWave: 11, endWave: 17, faction: 'wild',
    story: 'Im Sumpf verbrennt die Beute, bevor du sie einsammeln kannst. Nur dein Einkommen trägt dich.',
    mods: ['Magere Beute: Kopfgeld −40 %', 'Dafür +25 Grundeinkommen'], rules: { bountyMul: 0.6, startIncomeAdd: 25, waveHpMul: 1.1 },
    citadel: { hp: 40000, regen: 8, dmg: 1.1 }, star3: { type: 'kingHp', pct: 0.7 } }),
  M({ id: 8, act: 2, title: 'Der Aschendrache', goal: 'survive', startWave: 15, endWave: 20, faction: 'wild',
    story: 'Ein Drache aus Asche und Glut kreist über dem Riss. Wenn er landet, muss deine Front stehen.',
    mods: ['Champions', 'Bosswelle 20'], rules: { champions: true },
    citadel: { hp: 30000, regen: 10, dmg: 1.2 }, star3: { type: 'leaks', max: 3 } }),
  // ---------- Akt III ----------
  M({ id: 9, act: 3, title: 'Die Schmiede erwacht', goal: 'siege', startWave: 12, endWave: 19, faction: 'schmiede',
    story: 'In der Schlucht von Karrak stehen die alten Äthermaschinen. Platz ist knapp – jeder Kämpfer zählt.',
    mods: ['Enge Schlucht: nur 6 von 8 Baureihen'], rules: { gridRows: 6 },
    citadel: { hp: 21000, regen: 10, dmg: 1.2 }, star3: { type: 'byWave', wave: 18 } }),
  M({ id: 10, act: 3, title: 'Kein Weg zurück', goal: 'survive', startWave: 14, endWave: 21, faction: 'schmiede',
    story: 'Die Meisterschmiede ist zerstört. Ohne sie gibt es keine Aufwertung auf die höchste Stufe.',
    mods: ['Nur Stufe II: keine Aufwertung auf Stufe III'], rules: { maxTier: 2 },
    citadel: { hp: 34000, regen: 12, dmg: 1.2 }, star3: { type: 'leaks', max: 4 } }),
  M({ id: 11, act: 3, title: 'Sturm über Karrak', goal: 'siege', startWave: 16, endWave: 23, faction: 'schmiede',
    story: 'Vael’Thar wirft alles, was er hat, über die Brücke. Überlebe den Sturm und antworte mit Stahl.',
    citadel: { hp: 29000, regen: 14, dmg: 1.3 },
    enemySends: [{ wave: 17, send: 's_ogre', count: 2 }, { wave: 19, send: 's_golem', count: 2 }, { wave: 21, send: 's_knight', count: 1 }, { wave: 22, send: 's_ogre', count: 3 }],
    star3: { type: 'kingHp', pct: 0.6 } }),
  M({ id: 12, act: 3, title: 'Vor den Toren', goal: 'siege', startWave: 18, endWave: 25, faction: 'schmiede',
    story: 'Die Rissfeste liegt in Reichweite. Ihre Mauern heilen sich – du brauchst eine Flut aus Söldnern.',
    mods: ['Söldner −15 % Äther'], rules: { sendCostMul: 0.85 },
    citadel: { hp: 36000, regen: 30, dmg: 1.3 }, star3: { type: 'noHeal' } }),
  // ---------- Akt IV ----------
  M({ id: 13, act: 4, title: 'Schatten im Licht', goal: 'survive', startWave: 20, endWave: 26, faction: 'abgrund',
    story: 'Du nutzt nun die Waffen des Feindes. Doch der Abgrund verlangt Eile.',
    mods: ['Champions', 'Hast: nur 24 Sekunden Bauzeit', 'Wellen +20 % Leben'], rules: { champions: true, buildTime: 24, waveHpMul: 1.2 },
    citadel: { hp: 60000, regen: 20, dmg: 1.4 }, star3: { type: 'leaks', max: 4 } }),
  M({ id: 14, act: 4, title: 'Tanz der Leere', goal: 'siege', startWave: 22, endWave: 28, faction: 'abgrund',
    story: 'Die Leere tanzt um die Feste. Wer jetzt zögert, wird verschlungen.',
    mods: ['Champions', 'Söldner −20 % Äther'], rules: { champions: true, sendCostMul: 0.8 },
    citadel: { hp: 40000, regen: 30, dmg: 1.5 },
    enemySends: [{ wave: 24, send: 's_golem', count: 2 }, { wave: 26, send: 's_knight', count: 1 }],
    star3: { type: 'kingHp', pct: 0.5 } }),
  M({ id: 15, act: 4, title: 'Vael’Thar, der Rissfürst', goal: 'siege', startWave: 24, endWave: 30, faction: 'abgrund',
    story: 'Das Finale. Der Rissfürst selbst stellt sich dir – in Welle 30 tritt er aus dem Riss. Brich seine Feste, bevor der Riss sich für immer schließt.',
    mods: ['Champions', 'Der Rissfürst sendet unaufhörlich'], rules: { champions: true },
    citadel: { hp: 32000, regen: 20, dmg: 1.6 },
    enemySends: [{ wave: 25, send: 's_ogre', count: 2 }, { wave: 27, send: 's_golem', count: 2 }, { wave: 28, send: 's_knight', count: 1 }, { wave: 29, send: 's_knight', count: 2 }],
    star3: { type: 'leaks', max: 6 } }),
];

// Talente: werden mit gesammelten Sternen freigeschaltet und gelten in allen Kampagnen-Missionen
export const TALENTS = [
  { stars: 3, name: 'Kriegskasse', desc: '+30 Startgold', apply: (b) => { b.gold += 30; } },
  { stars: 6, name: 'Funkenmeister', desc: '+1 Äther-Funke zum Start', apply: (b) => { b.workers += 1; } },
  { stars: 10, name: 'Königsblut', desc: 'König +15 % Leben', apply: (b) => { b.king += 0.15; } },
  { stars: 15, name: 'Handelsbund', desc: 'Söldner kosten 10 % weniger Äther', apply: (b) => { b.sendMul *= 0.9; } },
  { stars: 20, name: 'Zweiter Atem', desc: '+1 Königsheilung', apply: (b) => { b.heals += 1; } },
  { stars: 26, name: 'Reiche Ernte', desc: '+8 Einkommen', apply: (b) => { b.income += 8; } },
  { stars: 33, name: 'Legende der Front', desc: '+60 Startgold', apply: (b) => { b.gold += 60; } },
  { stars: 40, name: 'Ewige Wacht', desc: 'König weitere +15 % Leben', apply: (b) => { b.king += 0.15; } },
];

export function talentBonus(totalStars) {
  const b = { gold: 0, workers: 0, king: 0, sendMul: 1, heals: 0, income: 0 };
  for (const t of TALENTS) if (totalStars >= t.stars) t.apply(b);
  return b;
}

/** Fraktionen, die nach dem Fortschritt freigeschaltet sind */
export function unlockedFactions(progress) {
  const f = ['orden'];
  if (progress[4]) f.push('wild');
  if (progress[8]) f.push('schmiede');
  if (progress[12]) f.push('abgrund');
  return f;
}
export function missionUnlocked(id, progress) { return id === 1 || !!progress[id - 1]; }

/** Spiel-Setup für eine Mission */
export const CAMPAIGN_DIFFICULTY = {
  easy: { label: 'Entspannt', wave: 0.82, citadel: 0.75 },
  normal: { label: 'Normal', wave: 1, citadel: 1 },
  hard: { label: 'Heldenhaft', wave: 1.18, citadel: 1.25 },
};

export function missionSetup(m, { name = 'Tiry', faction, seed, totalStars = 0, difficulty = 'normal' } = {}) {
  const b = talentBonus(totalStars);
  const d = CAMPAIGN_DIFFICULTY[difficulty] || CAMPAIGN_DIFFICULTY.normal;
  const rules = { ...m.rules };
  rules.waveHpMul = (rules.waveHpMul || 1) * d.wave;
  const incomeAdd = rules.startIncomeAdd || 0;
  delete rules.startIncomeAdd;
  rules.sendCostMul = (rules.sendCostMul || 1) * b.sendMul;
  rules.campaign = { goal: m.goal, citadelHp: Math.round(m.citadel.hp * d.citadel), citadelRegen: m.citadel.regen, citadelDmg: m.citadel.dmg, siegeMul: 3, enemySends: m.enemySends || [] };
  return {
    seed: seed ?? ((Math.random() * 1e9) | 0),
    rules,
    kingBonus: [b.king, 0],
    extraHeals: [b.heals, 0],
    players: [{ name, team: 0, faction: faction || m.faction, bot: false, bonusGold: b.gold, bonusWorkers: b.workers, bonusIncome: b.income + incomeAdd }],
    mission: m.id,
  };
}

/** Sterne nach Spielende: 1 = gewonnen, 2 = König ≥ 50 %, 3 = Missions-Herausforderung */
export function missionStars(m, sim) {
  if (sim.winner !== 0) return 0;
  const p = sim.players[0];
  const k = sim.teams[0].king;
  let stars = 1;
  if (k.hp / k.maxHp >= 0.5) stars++;
  const c = m.star3;
  let ok = false;
  if (c.type === 'leaks') ok = p.stats.leaks <= c.max;
  else if (c.type === 'byWave') ok = sim.wave <= c.wave;
  else if (c.type === 'kingHp') ok = k.hp / k.maxHp >= c.pct;
  else if (c.type === 'noHeal') ok = k.heals >= k.maxHeals;
  if (ok) stars++;
  return stars;
}
export function star3Text(c) {
  if (c.type === 'leaks') return c.max === 0 ? 'Kein einziger Durchbruch' : `Höchstens ${c.max} Durchbrüche`;
  if (c.type === 'byWave') return `Sieg spätestens in Welle ${c.wave}`;
  if (c.type === 'kingHp') return `König behält mindestens ${Math.round(c.pct * 100)} % Leben`;
  if (c.type === 'noHeal') return 'Keine Königsheilung benutzen';
  return '';
}
export const GOAL_TEXT = {
  siege: 'Belagerung: Zerstöre die Rissfeste, bevor die letzte Welle vorüber ist.',
  survive: 'Halten: Überstehe alle Wellen. (Fällt die Rissfeste früher, gewinnst du sofort.)',
};
