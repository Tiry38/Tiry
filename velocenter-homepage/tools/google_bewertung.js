// Google-Bewertung (Sterne + Anzahl) über die Places API (New) holen und in google.json schreiben.
// Läuft im GitHub-Lauf „Google-Bewertung“ (alle 3 Tage). Key nur aus dem Secret GOOGLE_PLACES_KEY.
// Fehler ändern nie etwas: google.json bleibt dann wie sie ist, die Homepage zeigt die letzten Werte.
'use strict';
const fs = require('fs');
const DATEI = process.argv[2] || 'google.json';
const KEY = process.env.GOOGLE_PLACES_KEY || '';
const SUCHE = 'Velocenter Hessert, Hartmannstraße 25, 76744 Wörth am Rhein';

async function api(url, opt, maske) {
  const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': maske, 'Content-Type': 'application/json' }, (opt && opt.headers) || {}) }));
  const t = await r.text();
  if (!r.ok) throw new Error('Google antwortet ' + r.status + ': ' + t.slice(0, 300));
  return JSON.parse(t);
}

async function main() {
  if (!KEY) { console.log('Kein Secret GOOGLE_PLACES_KEY – Abruf übersprungen, Werte bleiben.'); return; }
  let alt = {};
  try { alt = JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch (_) {}
  let id = process.env.GOOGLE_PLACE_ID || alt.id || '', p;
  if (!id) {
    const s = await api('https://places.googleapis.com/v1/places:searchText', { method: 'POST', body: JSON.stringify({ textQuery: SUCHE, languageCode: 'de' }) },
      'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount');
    p = (s.places || []).find(x => /Hartmannstr/i.test(x.formattedAddress || '') && /76744/.test(x.formattedAddress || ''));
    if (!p) throw new Error('Eintrag Hartmannstraße 25, 76744 Wörth nicht gefunden. Treffer: ' + (s.places || []).map(x => x.formattedAddress).join(' | '));
    id = p.id;
    console.log('Gefunden: ' + ((p.displayName || {}).text || '') + ' · ' + p.formattedAddress);
  } else {
    p = await api('https://places.googleapis.com/v1/places/' + encodeURIComponent(id), {}, 'id,rating,userRatingCount');
  }
  const rating = Number(p.rating), count = Number(p.userRatingCount);
  if (!(rating >= 1 && rating <= 5) || !(Number.isInteger(count) && count >= 1)) throw new Error('Unplausible Werte: ' + JSON.stringify({ rating: p.rating, count: p.userRatingCount }));
  const neu = { rating: Math.round(rating * 10) / 10, count, id, geprueft: new Date().toISOString(), quelle: 'Google Places API' };
  neu.geaendert = (alt.rating === neu.rating && alt.count === neu.count && alt.geaendert) ? alt.geaendert : neu.geprueft;
  fs.writeFileSync(DATEI, JSON.stringify(neu, null, 1) + '\n');
  console.log('Google: ' + String(neu.rating).replace('.', ',') + ' Sterne · ' + count + ' Rezensionen' + (alt.count && alt.count !== count ? ' (vorher ' + alt.count + ')' : ''));
}
main().catch(e => { console.error('Abruf fehlgeschlagen: ' + e.message); process.exit(1); });
