'use strict';
/**
 * Trend-Radar – findet heraus, welche App-Arten gerade gefragt sind und Geld verdienen.
 * Quellen ("Kabel"):
 *  1. Apple App Store Charts (öffentliche RSS-Feeds, kostenlos, ohne Key):
 *     Top-Umsatz (grossing), Top-Bezahlt, Top-Gratis für ein Land.
 *  2. KI-Websuche (Claude web_search): aktuelle Markt- und Monetarisierungstrends.
 *  3. Basiswissen (Fallback, klar als "nicht live" markiert).
 * Ergebnis steuert die Ideen-Engine: ein Teil der neuen Apps zielt auf gefragte Nischen –
 * als eigene, originelle Konzepte, nie als Kopie.
 */
const { TOOL_CATEGORIES, GAME_GENRES } = require('./ideas');

const GENRE_MAP = [
  [/game|spiel/i, 'game'],
  [/health|fitness|gesundheit/i, 'Gesundheit & Fitness'],
  [/productiv|produktiv|business/i, 'Produktivität & Fokus'],
  [/financ|finanz/i, 'Finanzen & Sparen'],
  [/educat|bildung|reference|nachschlag|book|bücher/i, 'Lernen & Wissen'],
  [/lifestyle/i, 'Gewohnheiten & Ziele'],
  [/food|essen/i, 'Kochen & Ernährung'],
  [/travel|reise/i, 'Reisen & Ausflüge'],
  [/music|musik/i, 'Musik & Üben'],
  [/sport/i, 'Sport & Training'],
  [/utilit|dienstprogramm|tool/i, 'Haushalt & Organisation'],
  [/photo|foto|graphic|grafik|design/i, 'Kreativität & Hobby'],
  [/navigation|auto|mobil/i, 'Fahrrad & Mobilität'],
  [/social|sozial/i, 'Planung mit Freunden'],
  [/weather|wetter/i, 'Angeln & Outdoor']
];

function mapGenre(label) {
  for (const [re, cat] of GENRE_MAP) if (re.test(label || '')) return cat;
  return null;
}

const FEEDS = (country, limit) => [
  { chart: 'grossing', url: `https://itunes.apple.com/${country}/rss/topgrossingapplications/limit=${limit}/json`, kind: 'legacy' },
  { chart: 'paid', url: `https://itunes.apple.com/${country}/rss/toppaidapplications/limit=${limit}/json`, kind: 'legacy' },
  { chart: 'free', url: `https://itunes.apple.com/${country}/rss/topfreeapplications/limit=${limit}/json`, kind: 'legacy' },
  { chart: 'paid', url: `https://rss.marketingtools.apple.com/api/v2/${country}/apps/top-paid/${limit}/apps.json`, kind: 'v2' },
  { chart: 'free', url: `https://rss.marketingtools.apple.com/api/v2/${country}/apps/top-free/${limit}/apps.json`, kind: 'v2' }
];

function parseFeed(kind, json) {
  if (kind === 'legacy') {
    const entries = (json && json.feed && json.feed.entry) || [];
    return entries.map((e) => ({
      name: e['im:name'] && e['im:name'].label,
      genre: e.category && e.category.attributes && e.category.attributes.label
    }));
  }
  const results = (json && json.feed && json.feed.results) || [];
  return results.map((r) => ({ name: r.name, genre: Array.isArray(r.genres) && r.genres[0] ? r.genres[0].name || r.genres[0] : r.kind }));
}

async function fetchAppleCharts({ country = 'de', limit = 50, fetchImpl = globalThis.fetch, signal } = {}) {
  const entries = [];
  const notes = [];
  const seenCharts = new Set();
  for (const feed of FEEDS(country, limit)) {
    if (seenCharts.has(feed.chart)) continue;
    try {
      const res = await fetchImpl(feed.url, { signal, headers: { 'user-agent': 'TiryAppForge/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = parseFeed(feed.kind, await res.json()).filter((e) => e.name);
      if (!list.length) throw new Error('leer');
      list.forEach((e, i) => entries.push({ ...e, chart: feed.chart, rank: i + 1 }));
      seenCharts.add(feed.chart);
    } catch (err) {
      notes.push(`${feed.chart} (${feed.kind}): ${String(err.message || err)}`);
    }
  }
  return { ok: entries.length > 0, entries, note: entries.length ? `${entries.length} Chart-Einträge (${[...seenCharts].join(', ')})` : `Nicht erreichbar: ${notes.join('; ')}` };
}

function aggregate(entries) {
  const weights = { grossing: 3, paid: 2, free: 1 };
  const score = new Map();
  const count = new Map();
  for (const e of entries) {
    const cat = mapGenre(e.genre) || 'Sonstiges';
    const w = (weights[e.chart] || 1) * (1 + (50 - Math.min(50, e.rank || 50)) / 50);
    score.set(cat, (score.get(cat) || 0) + w);
    count.set(cat, (count.get(cat) || 0) + 1);
  }
  const total = [...score.values()].reduce((a, b) => a + b, 0) || 1;
  return [...score.entries()]
    .map(([genre, s]) => ({ genre, count: count.get(genre), share: Math.round((s / total) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 10);
}

/** Fallback-Wissen (nicht live) – solide, langfristig stabile Marktmuster. */
const BASELINE = {
  summary: 'Basiswissen (nicht live): Abo-Modelle in Gesundheit, Fitness, Produktivität und Finanzen dominieren den Umsatz außerhalb von Spielen. Bei Spielen verdienen Casual- und Puzzle-Spiele mit Werbung + optionalem Werbefrei-Kauf am zuverlässigsten.',
  hotTopics: ['Gewohnheiten & Streaks', 'Fokus & Deep Work', 'Budget & Sparziele', 'Hydration & Wohlbefinden', 'Kurze Puzzle-Sessions', 'Achtsamkeit & Schlaf'],
  monetization: ['Freemium mit Pro-Abo (Statistiken, Themes, Export)', 'Einmalkauf "Pro" für Werkzeug-Apps', 'Spiele: Rewarded Ads + Werbefrei-Kauf', 'Saisonale Themes als In-App-Kauf'],
  opportunities: [
    { type: 'tool', category: 'Gewohnheiten & Ziele', direction: 'Gewohnheiten mit spielerischem Fortschritt und Wochenrückblick', why: 'Dauerhaft starke Nachfrage, hohe Abo-Bereitschaft' },
    { type: 'tool', category: 'Finanzen & Sparen', direction: 'Ultraschneller Ausgaben-Check ohne Bankanbindung', why: 'Datenschutz-bewusste Nutzer, wenig Konkurrenz offline' },
    { type: 'tool', category: 'Produktivität & Fokus', direction: 'Fokus-Sessions mit Belohnungssystem', why: 'Wachsende Deep-Work-Nische' },
    { type: 'game', category: 'Logik-Puzzle', direction: 'Tägliches Puzzle mit Serien-Bonus', why: 'Daily-Puzzle-Formate binden stark' },
    { type: 'game', category: 'Reaktion & Timing', direction: 'Einhand-Timing-Spiel für 60-Sekunden-Runden', why: 'Hybrid-Casual wächst, kurze Sessions' },
    { type: 'tool', category: 'Achtsamkeit & Schlaf', direction: 'Abendroutine mit Atem- und Reflexionsmodus', why: 'Schlaf/Achtsamkeit hat hohe Zahlungsbereitschaft' }
  ]
};

const ALL_CATEGORIES = [...TOOL_CATEGORIES, ...GAME_GENRES];

const TREND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'hotTopics', 'monetization', 'opportunities'],
  properties: {
    summary: { type: 'string' },
    hotTopics: { type: 'array', items: { type: 'string' } },
    monetization: { type: 'array', items: { type: 'string' } },
    opportunities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'category', 'direction', 'why'],
        properties: {
          type: { type: 'string', enum: ['game', 'tool'] },
          category: { type: 'string', enum: ALL_CATEGORIES },
          direction: { type: 'string' },
          why: { type: 'string' }
        }
      }
    }
  }
};

const RESEARCH_SYSTEM = 'Du bist Marktanalyst für Mobile Apps (App Store & Google Play). Du recherchierst gründlich mit der Websuche, nennst nur belegbare Trends und markierst Unsicherheit. Antworte auf Deutsch.';

async function buildTrendReport({ ai, country = 'de', useAi = true, fetchImpl, signal, emit = () => {} } = {}) {
  const sources = [];
  emit('pipeline.stage', { stage: 'trends', message: 'Lese App-Store-Charts …' });
  const charts = await fetchAppleCharts({ country, fetchImpl, signal });
  sources.push({ id: 'apple-charts', name: `Apple App Store Charts (${country.toUpperCase()})`, ok: charts.ok, note: charts.note });
  const topGenres = charts.ok ? aggregate(charts.entries) : [];
  const chartNames = charts.entries.slice(0, 60).map((e) => e.name);

  let analysis = null;
  if (useAi && ai && ai.isAvailable()) {
    try {
      emit('pipeline.stage', { stage: 'trends', message: 'KI recherchiert aktuelle Markttrends im Web …' });
      const research = await ai.research({
        system: RESEARCH_SYSTEM,
        signal,
        prompt: `Recherchiere die aktuellen Mobile-App-Trends (letzte 3 Monate) mit Fokus Deutschland/EU:
1. Welche App-Kategorien und App-Arten erzielen gerade den meisten Umsatz (Abos, In-App-Käufe)?
2. Welche neuen Apps/Spiele wachsen gerade stark oder gehen viral – und WARUM (welches Bedürfnis)?
3. Welche Bedürfnisse sind unterversorgt (Lücken für kleine, offline-fähige Apps ohne Server)?
4. Welche Monetarisierung funktioniert für kleine Entwickler?
${topGenres.length ? `\nApp-Store-Charts heute (Kategorie-Anteile): ${topGenres.map((g) => `${g.genre} ${g.share}%`).join(', ')}` : ''}
Fasse die Ergebnisse mit Quellen kompakt zusammen.`
      });
      emit('pipeline.stage', { stage: 'trends', message: 'Leite Chancen für neue Apps ab …' });
      analysis = await ai.json({
        system: RESEARCH_SYSTEM,
        purpose: 'trends',
        signal,
        schema: TREND_SCHEMA,
        prompt: `Leite aus dieser Recherche konkrete Chancen für NEUE, ORIGINELLE Apps ab, die als einzelne Offline-Web-App umsetzbar sind (keine Server, keine Accounts). 5–8 Chancen, gemischt Spiele und Tools. Keine Kopien bestehender Apps.

Recherche:
${research}`
      });
      sources.push({ id: 'ai-web', name: 'KI-Websuche (Claude)', ok: true, note: 'Aktuelle Recherche' });
    } catch (err) {
      sources.push({ id: 'ai-web', name: 'KI-Websuche (Claude)', ok: false, note: String(err.message || err) });
    }
  } else {
    sources.push({ id: 'ai-web', name: 'KI-Websuche (Claude)', ok: false, note: 'Kein API-Key – nur Charts/Basiswissen' });
  }

  const base = analysis || BASELINE;
  const live = !!analysis || charts.ok;
  if (!analysis) sources.push({ id: 'baseline', name: 'Basiswissen (nicht live)', ok: true, note: 'Fallback' });

  // Chart-Kategorien zusätzlich als Chancen einspeisen, falls die KI nicht lief.
  let opportunities = base.opportunities.slice(0, 8);
  if (!analysis && topGenres.length) {
    const fromCharts = topGenres
      .filter((g) => g.genre !== 'Sonstiges')
      .slice(0, 3)
      .map((g) => ({
        type: g.genre === 'game' ? 'game' : 'tool',
        category: g.genre === 'game' ? 'Logik-Puzzle' : g.genre,
        direction: g.genre === 'game' ? 'Casual-Spiel mit kurzen Runden' : `Schlanke, offline-fähige ${g.genre}-App`,
        why: `Stark in den aktuellen Charts (${g.share}%)`
      }));
    opportunities = [...fromCharts, ...opportunities].slice(0, 8);
  }

  return {
    updatedAt: Date.now(),
    country,
    live,
    summary: base.summary,
    sources,
    topGenres,
    hotTopics: base.hotTopics.slice(0, 10),
    monetization: base.monetization.slice(0, 6),
    opportunities,
    avoidNames: chartNames
  };
}

/** Lenkt einen Zufalls-Seed mit Wahrscheinlichkeit `weight` auf eine Trend-Chance. */
function biasSeed(seed, report, rng, weight = 0.6) {
  if (!report || !report.opportunities || !report.opportunities.length || !rng.chance(weight)) return { seed, opportunity: null };
  const opp = rng.pick(report.opportunities);
  return { seed: { ...seed, type: opp.type, category: opp.category }, opportunity: opp };
}

function trendHint(report, opportunity) {
  if (!report) return '';
  const lines = [];
  if (opportunity) lines.push(`Gefragte Chance: ${opportunity.direction} (${opportunity.why})`);
  if (report.hotTopics && report.hotTopics.length) lines.push(`Heiße Themen: ${report.hotTopics.slice(0, 6).join(', ')}`);
  if (report.monetization && report.monetization.length) lines.push(`Funktionierende Monetarisierung: ${report.monetization.slice(0, 3).join('; ')}`);
  if (report.avoidNames && report.avoidNames.length) lines.push(`Diese Namen existieren bereits (nicht verwenden, nicht kopieren): ${report.avoidNames.slice(0, 25).join(', ')}`);
  return lines.join('\n');
}

module.exports = { fetchAppleCharts, aggregate, buildTrendReport, biasSeed, trendHint, mapGenre, BASELINE, TREND_SCHEMA, parseFeed };
