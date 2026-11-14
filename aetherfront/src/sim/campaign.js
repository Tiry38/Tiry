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

// goal: 'survive' (alle Wellen halten) · 'siege' (Rissfeste zerstören) · Missions-Mechanik kann eigene Ziele setzen.
// biome: Lichtstimmung des Akts (environment.setBiome). hero: Held der Geschichte (frei wählbar, empfohlen).
const K = (o) => M({ citadel: { hp: 999999, regen: 0, dmg: 0.6 }, ...o });

export const MISSIONS = [
  // ---------- Akt I – Das Erwachen (Himmelsinseln) ----------
  K({ id: 1, act: 1, biome: 'sky', title: 'Der erste Riss', goal: 'survive', startWave: 1, endWave: 5, faction: 'orden', hero: 'kael', mechanic: 'tutorial',
    rules: { waveHpMul: 0.7, buildTimeFirst: 60 },
    story: 'Über den Himmelsinseln reißt der Äther auf. Hauptmann Kael ist allein auf der Bastion – bis die ersten Vasallen seinem Ruf folgen.',
    tips: ['Die Mission erklärt dir Schritt für Schritt Bauen, Wellen und die Heldensteuerung.'], star3: { type: 'leaks', max: 0 } }),
  K({ id: 2, act: 1, biome: 'sky', title: 'Funken im Wind', goal: 'survive', startWave: 2, endWave: 8, faction: 'orden', hero: 'mira', mechanic: 'shards', mechanicCfg: { need: 8 },
    story: 'Der Riss verstreut Splitter des Ätherkristalls. Mira spürt sie – wer sie sammelt, stärkt die Bastion.',
    tips: ['In jeder Kampfphase liegen leuchtende Funken auf der Bahn. Lauf mit dem Helden darüber.'], star3: { type: 'kingHp', pct: 0.9 } }),
  K({ id: 3, act: 1, biome: 'sky', title: 'Die bröckelnde Brücke', goal: 'survive', startWave: 4, endWave: 11, faction: 'orden', hero: 'kael', mechanic: 'collapse', mechanicCfg: { at: [2, 4, 6] },
    rules: { waveHpMul: 1.1 },
    story: 'Die Sturmbrücke hält dem Riss nicht stand. Reihe um Reihe stürzt in die Wolken.',
    tips: ['Nach den Wellen 2, 4 und 6 bricht die vorderste Baureihe weg – Vasallen dort werden voll erstattet.'], star3: { type: 'leaks', max: 2 } }),
  K({ id: 4, act: 1, biome: 'dusk', title: 'Leuchtfeuer', goal: 'survive', startWave: 6, endWave: 13, faction: 'orden', hero: 'mira', mechanic: 'night',
    rules: { waveHpMul: 1.1 },
    story: 'Die Nacht kommt, und mit ihr die Rissbrut. Nur Licht hält sie fern.',
    tips: ['Vasallen sehen Gegner nur in der Nähe von Leuchtfeuern oder deines Helden.', 'Stell dich 1,5 s neben ein Leuchtfeuer, um es zu entzünden.'], star3: { type: 'leaks', max: 3 } }),
  K({ id: 5, act: 1, biome: 'sky', title: 'Die Pilgerkarawane', goal: 'survive', startWave: 7, endWave: 13, faction: 'orden', hero: 'kael', mechanic: 'escort', mechanicCfg: { waves: [2, 3, 4, 5, 6], maxLost: 2 },
    rules: { waveHpMul: 1.05 },
    story: 'Pilger fliehen von den äußeren Inseln zur Bastion – mitten durch deine Bahn.',
    tips: ['Pilger laufen die Bahn hinunter. Gegner greifen sie an – schütze sie mit Held und Vasallen.'], star3: { type: 'leaks', max: 3 } }),
  K({ id: 6, act: 1, biome: 'sky', title: 'Der Steintitan', goal: 'survive', startWave: 4, endWave: 10, faction: 'orden', hero: 'kael', mechanic: 'boss', mechanicCfg: { name: 'Der Steintitan' },
    story: 'Ein Wächter des Kristalls, verdorben vom Riss. Er steigt aus der Tiefe – und er erkennt Kael.',
    tips: ['Welle 10 ist der Titan. Weiche seinen Bodenwarnungen aus und unterbrich ihn mit Betäubungen.'], star3: { type: 'kingHp', pct: 0.75 } }),
  // ---------- Akt II – Der grüne Zorn (Wildwald) ----------
  K({ id: 7, act: 2, biome: 'forest', title: 'Wurzelnetz', goal: 'survive', startWave: 9, endWave: 16, faction: 'wild', hero: 'lyra', mechanic: 'nodes',
    story: 'Der Himmelswald brennt. Doch unter der Asche pulsiert noch das Wurzelnetz.',
    tips: ['Leuchtende Kraftknoten geben Vasallen +50 % Schaden – sie wechseln jede Welle die Position.'], star3: { type: 'leaks', max: 3 } }),
  K({ id: 8, act: 2, biome: 'forest', title: 'Sporenregen', goal: 'survive', startWave: 10, endWave: 17, faction: 'wild', hero: 'lyra', mechanic: 'weather',
    story: 'Der verderbte Wald atmet. Jede Welle bringt anderes Wetter.',
    tips: ['Sporenregen stärkt Arkan, Sturmböen schwächen Durchbohren, Glutwind stärkt Chaos.'], star3: { type: 'kingHp', pct: 0.7 } }),
  K({ id: 9, act: 2, biome: 'forest', title: 'Verderbte Wächter', goal: 'survive', startWave: 11, endWave: 18, faction: 'wild', hero: 'lyra', mechanic: 'corrupt',
    rules: { waveHpMul: 0.9 },
    story: 'Schamanen des Risses flüstern deinen Vasallen zu – und manche hören hin.',
    tips: ['Verderber wirken „Verderben“ (2,5 s). Unterbrich mit einer Betäubung oder töte sie zuerst.'], star3: { type: 'leaks', max: 3 } }),
  K({ id: 10, act: 2, biome: 'forest', title: 'Die Gefangenen', goal: 'survive', startWave: 12, endWave: 18, faction: 'wild', hero: 'lyra', mechanic: 'rescue', mechanicCfg: { need: 8 },
    story: 'Lyras Sippe hängt in Käfigen über dem Riss. Wenn die Ketten reißen, stürzen sie in die Tiefe.',
    tips: ['Pro Welle erscheinen 2 Käfige an der Bahnspitze. Der Held muss sie innerhalb von 30 s erreichen.'], star3: { type: 'noHeal' } }),
  K({ id: 11, act: 2, biome: 'forest', title: 'Jagd auf den Dornenfürsten', goal: 'survive', startWave: 13, endWave: 19, faction: 'wild', hero: 'lyra', mechanic: 'chase', mechanicCfg: { need: 4 },
    rules: { waveHpMul: 0.9 },
    story: 'Der Dornenfürst hat den Wald verraten. Er flieht – jedes Mal, wenn er dich sieht.',
    tips: ['Der Dornenfürst erscheint mitten in deiner Bahn und rennt zum Portal. Stelle ihn mit Held, Wurzeln und Verlangsamung.'], star3: { type: 'leaks', max: 4 } }),
  K({ id: 12, act: 2, biome: 'ember', title: 'Die Aschendrachin', goal: 'survive', startWave: 14, endWave: 20, faction: 'wild', hero: 'lyra', mechanic: 'boss', mechanicCfg: { name: 'Die Aschendrachin' },
    story: 'Über dem brennenden Hain kreist sie. In ihrem Hort liegen Pläne – und ein Name aus der Ätherschmiede.',
    rules: { waveHpMul: 0.88, champions: true }, mods: ['Champions'], tips: ['Welle 20: die Aschendrachin. Ihre Diener-Champions halten deine Vasallen beschäftigt.'], star3: { type: 'kingHp', pct: 0.6 } }),
  // ---------- Akt III – Eisen und Äther (Wüstenschmiede) ----------
  K({ id: 13, act: 3, biome: 'desert', title: 'Sandsturm', goal: 'survive', startWave: 15, endWave: 22, faction: 'schmiede', hero: 'brann', mechanic: 'sandstorm', rules: { creepSpeedMul: 1.2 },
    story: 'Der Weg nach Karrak führt durch den Glasstaub-Sturm. Pfeile verwehen, Klingen nicht.',
    tips: ['Fernkämpfer treffen 40 % schwächer – setze auf Nahkampf, Belagerung und deinen Helden.'], star3: { type: 'leaks', max: 4 } }),
  K({ id: 14, act: 3, biome: 'ember', title: 'Die Schmiede brennt', goal: 'survive', startWave: 16, endWave: 23, faction: 'schmiede', hero: 'brann', mechanic: 'lava',
    story: 'Jemand hat die Lavaschächte geöffnet. Die große Schmiede von Karrak brennt.',
    tips: ['Lavaschlote brechen nach einer Bodenwarnung aus und treffen ALLE im Kreis – auch deine Vasallen.'], star3: { type: 'kingHp', pct: 0.6 } }),
  K({ id: 15, act: 3, biome: 'desert', title: 'Verrat am Tor', goal: 'survive', startWave: 17, endWave: 24, faction: 'schmiede', hero: 'brann', mechanic: 'betrayal', mechanicCfg: { waves: [2, 4, 6, 8] },
    story: 'Meister Orrik öffnet dem Feind die Tore. Und er nimmt Branns Vasallen mit.',
    tips: ['In den Wellen 2, 4, 6 und 8 laufen zwei deiner Vasallen über. Nach der Welle kehren sie zurück.'], star3: { type: 'leaks', max: 4 } }),
  K({ id: 16, act: 3, biome: 'desert', title: 'Kristallpfeiler', goal: 'survive', startWave: 18, endWave: 25, faction: 'schmiede', hero: 'selene', mechanic: 'pylons',
    story: 'Selene erweckt die alten Kristallpfeiler der Schmiede – doch nur ihre Nähe lädt sie.',
    tips: ['Stelle deinen Helden 2 s an einen Pfeiler. Geladene Pfeiler beschleunigen Vasallen in der Nähe um 40 %.'], star3: { type: 'noHeal' } }),
  M({ id: 17, act: 3, biome: 'desert', title: 'Belagerung von Karrak', goal: 'siege', startWave: 18, endWave: 25, faction: 'schmiede', hero: 'brann',
    story: 'Orrik hat sich in der Feste verschanzt. Es gibt nur einen Weg hinein: durch die Mauer.',
    mods: ['Söldner −15 % Äther'], rules: { waveHpMul: 0.92, sendCostMul: 0.85 }, tips: ['Jeder Söldner (1–7) rammt die Feste und erhöht dein Einkommen.'],
    citadel: { hp: 36000, regen: 30, dmg: 1.3 }, star3: { type: 'byWave', wave: 24 } }),
  K({ id: 18, act: 3, biome: 'ember', title: 'Orrik, der Verräter', goal: 'survive', startWave: 14, endWave: 20, faction: 'schmiede', hero: 'brann', mechanic: 'boss', mechanicCfg: { name: 'Orrik in seinem Kolosspanzer' },
    story: 'Brann stellt seinen Lehrer. Orrik hat sich in den größten Koloss der Schmiede gesetzt.',
    rules: { champions: true }, mods: ['Champions'], tips: ['Welle 20: Orriks Koloss. Er ruft Diener und rammt dich.'], star3: { type: 'kingHp', pct: 0.6 } }),
  // ---------- Akt IV – Herz des Abgrunds (Schattenwelt) ----------
  K({ id: 19, act: 4, biome: 'void', title: 'Schatten im Licht', goal: 'survive', startWave: 20, endWave: 26, faction: 'abgrund', hero: 'selene', mechanic: 'shadows',
    story: 'Jenseits des Risses gibt es kein Licht – nur das, das Selenes Herz verströmt.',
    tips: ['Gegner sind nur nahe deinem Helden sichtbar. Markierte oder verfluchte Gegner bleiben sichtbar.'], star3: { type: 'leaks', max: 4 } }),
  K({ id: 20, act: 4, biome: 'void', title: 'Spiegelwelt', goal: 'survive', startWave: 21, endWave: 27, faction: 'abgrund', hero: 'mira', mechanic: 'mirror',
    rules: { waveHpMul: 0.9 },
    story: 'Der Abgrund zeigt dir dein eigenes Heer – mit deinen Schwächen.',
    tips: ['Die Gegner übernehmen Angriffs- und Rüstungsart deiner Vasallen. Mische deine Armee!'], star3: { type: 'kingHp', pct: 0.6 } }),
  K({ id: 21, act: 4, biome: 'void', title: 'Zerfallende Zeit', goal: 'survive', startWave: 22, endWave: 28, faction: 'abgrund', hero: 'selene', mechanic: 'timedecay',
    rules: { waveHpMul: 0.92 },
    story: 'Hier zerfällt die Zeit. Jeder Atemzug ist kürzer als der letzte.',
    tips: ['Die Bauzeit schrumpft jede Welle, dafür bekommst du doppeltes Einkommen.'], star3: { type: 'leaks', max: 4 } }),
  K({ id: 22, act: 4, biome: 'void', title: 'Letzte Bastion', goal: 'survive', startWave: 23, endWave: 29, faction: 'abgrund', hero: 'kael', mechanic: 'lastbastion',
    rules: { waveHpMul: 0.86 },
    story: 'Die Helden sind abgeschnitten. Kein Nachschub, keine Verstärkung. Nur die Mauer.',
    tips: ['Keine König-Verbesserungen und nur 2 Heilungen – jeder Durchbruch zählt.'], star3: { type: 'noHeal' } }),
  K({ id: 23, act: 4, biome: 'void', title: 'Varos Wahl', goal: 'survive', startWave: 24, endWave: 30, faction: 'abgrund', hero: 'varo', mechanic: 'duel',
    story: 'Varo stellt sich ihnen in den Weg. Im Duell fällt die Maske – er ist Vael’Thars Sohn.',
    rules: { waveHpMul: 0.72, champions: true }, mods: ['Champions'], tips: ['Welle 30: Varo führt die Welle als Anführer mit Heldenfähigkeiten.'], star3: { type: 'kingHp', pct: 0.5 } }),
  K({ id: 24, act: 4, biome: 'void', title: 'Vael’Thar', goal: 'survive', startWave: 25, endWave: 30, faction: 'abgrund', hero: 'selene', mechanic: 'boss', mechanicCfg: { name: 'Vael’Thar, der Rissfürst' },
    story: 'Das Herz des Abgrunds. Vael’Thar wartet am erlöschenden Kristall. Selene muss einen Teil ihres Herzens geben.',
    rules: { waveHpMul: 0.72, champions: true }, mods: ['Champions', 'Lavaschlote im Finale'], tips: ['Vael’Thar hat vier Phasen. Bleib in Bewegung, unterbrich, heile.'], star3: { type: 'leaks', max: 6 } }),
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
  const f = ['orden', 'schwarm'];
  if (progress[6]) f.push('wild', 'glut');
  if (progress[12]) f.push('schmiede');
  if (progress[18]) f.push('abgrund');
  return f;
}
export function missionUnlocked(id, progress) { return id === 1 || !!progress[id - 1]; }

/** Spiel-Setup für eine Mission */
export const CAMPAIGN_DIFFICULTY = {
  easy: { label: 'Entspannt', wave: 0.82, citadel: 0.75 },
  normal: { label: 'Normal', wave: 1, citadel: 1 },
  hard: { label: 'Heldenhaft', wave: 1.18, citadel: 1.25 },
};

export function missionSetup(m, { name = 'Tiry', faction, hero, seed, totalStars = 0, difficulty = 'normal' } = {}) {
  const b = talentBonus(totalStars);
  const d = CAMPAIGN_DIFFICULTY[difficulty] || CAMPAIGN_DIFFICULTY.normal;
  const rules = { ...m.rules };
  rules.waveHpMul = (rules.waveHpMul || 1) * d.wave;
  const incomeAdd = rules.startIncomeAdd || 0;
  delete rules.startIncomeAdd;
  rules.sendCostMul = (rules.sendCostMul || 1) * b.sendMul;
  if (m.mechanic) rules.mission = { mechanic: m.mechanic, ...(m.mechanicCfg || {}) };
  // Solo-König: In späten Missionen fehlt die Aufbauzeit der früheren Wellen → der König startet entsprechend stärker
  rules.kingHpMul = (rules.kingHpMul || 1) * (1 + 0.16 * Math.max(0, m.startWave - 1));
  rules.campaign = { goal: m.goal, citadelHp: Math.round(m.citadel.hp * d.citadel), citadelRegen: m.citadel.regen, citadelDmg: m.citadel.dmg, siegeMul: 3, enemySends: m.enemySends || [] };
  return {
    seed: seed ?? ((Math.random() * 1e9) | 0),
    rules,
    kingBonus: [b.king, 0],
    extraHeals: [b.heals, 0],
    players: [{ name, team: 0, faction: faction || m.faction, hero: hero || m.hero, bot: false, bonusGold: b.gold, bonusWorkers: b.workers, bonusIncome: b.income + incomeAdd }],
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
  survive: 'Halten: Überstehe alle Wellen – und erfülle das Missionsziel.',
};
