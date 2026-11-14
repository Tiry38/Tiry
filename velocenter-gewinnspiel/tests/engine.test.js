/* Tests der Auswertungslogik – node tests/engine.test.js */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const E = require('../engine.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FEHLER  ' + name + '\n        ' + (e && e.message)); }
}

const PAGE = '220020558190688';
function base(asOf) {
  const st = E.emptyState();
  st.settings.asOf = asOf || '2026-12-22';
  for (let d = 1; d <= 30; d++) {
    st.posts.push({ id: 'p' + d, message: 'Türchen ' + d + '/30 – Rätsel', created_time: E.berlinToUtcIso(E.dayDate(st.settings, d), '07:00').replace('.000Z', '+0000'), source: 'meta', dayOverride: null });
  }
  return st;
}
function comment(st, user, name, day, time, dateOffset) {
  const date = E.addDays(E.dayDate(st.settings, day), dateOffset || 0);
  st.comments.push({ id: 'c' + st.comments.length, postId: 'p' + day, userId: user, name, message: 'Antwort ' + day, created_time: E.berlinToUtcIso(date, time || '18:00') });
}
function allDays(st, user, name, skip) {
  for (let d = 1; d <= 30; d++) if (!(skip || []).includes(d)) comment(st, user, name, d);
}
function seq(vals) { let i = 0; return () => vals[i++ % vals.length]; }

console.log('Engine');

test('Zeitzone: 23:59 Berlin ist 22:59 UTC (Winterzeit)', () => {
  assert.strictEqual(E.berlinToUtcIso('2026-11-22', '23:59'), '2026-11-22T22:59:00.000Z');
  assert.deepStrictEqual(E.berlinParts('2026-11-22T22:59:00+0000'), { date: '2026-11-22', time: '23:59' });
  assert.deepStrictEqual(E.berlinParts('2026-11-22T23:01:00+0000'), { date: '2026-11-23', time: '00:01' });
});

test('Zeitraum: Tag 1 = 22.11., Tag 30 = 21.12.', () => {
  const s = E.defaultSettings();
  assert.strictEqual(E.dayDate(s, 1), '2026-11-22');
  assert.strictEqual(E.dayDate(s, 30), '2026-12-21');
});

test('Beitrag-Zuordnung: Türchen-Text, Datum, manuelle Überschreibung', () => {
  const s = E.defaultSettings();
  assert.strictEqual(E.postDay(s, { message: 'Türchen 7/30 – Hör-Rätsel', created_time: '2026-11-22T06:00:00+0000' }), 7);
  assert.strictEqual(E.postDay(s, { message: 'TUERCHEN 12 / 30', created_time: '2026-11-22T06:00:00+0000' }), 12);
  assert.strictEqual(E.postDay(s, { message: 'ohne Nummer', created_time: '2026-11-24T06:00:00+0000' }), 3);
  assert.strictEqual(E.postDay(s, { message: 'Türchen 7/30', created_time: '2026-11-22T06:00:00+0000', dayOverride: 9 }), 9);
  assert.strictEqual(E.postDay(s, { message: 'Türchen 7/30', created_time: '2026-11-22T06:00:00+0000', dayOverride: 0 }), null);
  assert.strictEqual(E.postDay(s, { message: 'Werbung', created_time: '2026-11-10T06:00:00+0000' }), null);
});

test('Frist: Kommentar 23:59 zählt, 00:01 am Folgetag ist zu spät', () => {
  const st = base('2026-11-25');
  comment(st, 'u1', 'Anna', 1, '23:59');
  comment(st, 'u2', 'Ben', 1, '00:01', 1);
  const r = E.compute(st);
  const a = r.byId.get('u1'), b = r.byId.get('u2');
  assert.strictEqual(a.done[1], true);
  assert.strictEqual(b.done[1], false);
  assert.strictEqual(b.lateCount, 1);
  assert.strictEqual(r.days[0].onTime, 1);
  assert.strictEqual(r.days[0].late, 1);
});

test('Status: Durchzieher, Joker nötig, Raus, Im Rennen', () => {
  const st = base('2026-12-22');
  allDays(st, 'a', 'Alle Tage');
  allDays(st, 'b', 'Eine Lücke', [10]);
  allDays(st, 'c', 'Zwei Lücken', [3, 20]);
  const r = E.compute(st);
  assert.strictEqual(r.byId.get('a').status, 'durchzieher');
  assert.strictEqual(r.byId.get('b').status, 'joker');
  assert.strictEqual(r.byId.get('c').status, 'raus');
  const st2 = base('2026-11-25'); // Tag 4 läuft, Tage 1–3 vorbei
  comment(st2, 'd', 'Dabei', 1); comment(st2, 'd', 'Dabei', 2); comment(st2, 'd', 'Dabei', 3);
  const r2 = E.compute(st2);
  assert.strictEqual(r2.today.current, 4);
  assert.strictEqual(r2.byId.get('d').status, 'rennen');
  assert.strictEqual(r2.byId.get('d').streak, 3);
});

test('Joker deckt genau einen verpassten Tag', () => {
  const st = base('2026-12-22');
  allDays(st, 'b', 'Berta', [10]);
  allDays(st, 'c', 'Carl', [3, 20]);
  st.jokers = E.generateJokerCodes(3, seq([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), []);
  let r = E.compute(st);
  assert.ok(E.assignJoker(st, r, st.jokers[0].code, 'b', 10).ok);
  r = E.compute(st);
  assert.strictEqual(r.byId.get('b').status, 'durchzieher');
  assert.strictEqual(r.byId.get('b').fulfilled, 30);
  assert.ok(E.assignJoker(st, r, st.jokers[1].code, 'c', 3).ok);
  r = E.compute(st);
  assert.strictEqual(r.byId.get('c').status, 'raus');
  // zweiter Joker für dieselbe Person verboten
  const again = E.assignJoker(st, r, st.jokers[2].code, 'c', 20);
  assert.strictEqual(again.ok, false);
  // benutzter Code verboten, erfüllter Tag verboten
  assert.strictEqual(E.assignJoker(st, r, st.jokers[0].code, 'c', 20).ok, false);
});

test('Joker: erfüllter Tag und laufender Tag werden abgelehnt', () => {
  const st = base('2026-11-25');
  comment(st, 'x', 'Xaver', 1); comment(st, 'x', 'Xaver', 3);
  st.jokers = E.generateJokerCodes(2, seq([5, 9, 13, 17, 21, 25, 29, 33]), []);
  const r = E.compute(st);
  assert.strictEqual(E.assignJoker(st, r, st.jokers[0].code, 'x', 1).ok, false);
  assert.strictEqual(E.assignJoker(st, r, st.jokers[0].code, 'x', 4).ok, false);
  assert.strictEqual(E.assignJoker(st, r, st.jokers[0].code.slice(3).toLowerCase(), 'x', 2).ok, true);
});

test('Serien: aktuelle und längste Serie', () => {
  const st = base('2026-11-30'); // Tag 9 läuft
  for (const d of [1, 2, 3, 5, 6, 7, 8]) comment(st, 's', 'Serie', d);
  const p = E.compute(st).byId.get('s');
  assert.strictEqual(p.streak, 4);
  assert.strictEqual(p.longest, 4);
  comment(st, 's', 'Serie', 9);
  const p2 = E.compute(st).byId.get('s');
  assert.strictEqual(p2.streak, 5);
  assert.strictEqual(p2.activeToday, true);
});

test('Wochenstatus und Wochen-Lostopf (max. 1 Wochengewinn pro Person)', () => {
  const st = base('2026-12-22');
  allDays(st, 'a', 'Anna');
  allDays(st, 'b', 'Ben', [9]);
  allDays(st, 'c', 'Cleo');
  let r = E.compute(st);
  assert.strictEqual(r.byId.get('b').weeks.W1, 'voll');
  assert.strictEqual(r.byId.get('b').weeks.W2, 'verpasst');
  assert.strictEqual(E.weekPool(r, st, 'W1').length, 3);
  st.draws.W1 = E.draw(E.weekPool(r, st, 'W1'), 2, 0, seq([0, 0, 0]), { key: 'W1' });
  r = E.compute(st);
  const pool2 = E.weekPool(r, st, 'W2').map((p) => p.id);
  for (const w of st.draws.W1.winners) assert.ok(!pool2.includes(w.id), 'Wochensieger darf nicht erneut im Topf sein');
  assert.ok(!pool2.includes('b'));
});

test('Woche läuft: Status „läuft“, Auslosung erst nach Wochenende', () => {
  const st = base('2026-11-25');
  comment(st, 'a', 'Anna', 1); comment(st, 'a', 'Anna', 2); comment(st, 'a', 'Anna', 3);
  const r = E.compute(st);
  assert.strictEqual(r.byId.get('a').weeks.W1, 'läuft');
  assert.strictEqual(E.weekClosed(r, 'W1'), false);
  const st2 = base('2026-11-29');
  assert.strictEqual(E.weekClosed(E.compute(st2), 'W1'), true);
});

test('Hauptpreis: nur Durchzieher, 1 Gewinner + 2 Nachrücker, Protokoll mit SHA-256', () => {
  const st = base('2026-12-22');
  for (let i = 0; i < 6; i++) allDays(st, 'u' + i, 'Person ' + i);
  allDays(st, 'raus', 'Raus', [1, 2]);
  const r = E.compute(st);
  const pool = E.mainPool(r);
  assert.strictEqual(pool.length, 6);
  const d = E.draw(pool, 1, 2, seq([123456789, 987654321, 55555]), { key: 'MAIN', label: 'Hauptpreis' });
  assert.strictEqual(d.winners.length, 1);
  assert.strictEqual(d.backups.length, 2);
  const ids = new Set(d.winners.concat(d.backups).map((x) => x.id));
  assert.strictEqual(ids.size, 3);
  assert.ok(!ids.has('raus'));
  const expect = crypto.createHash('sha256').update(pool.map((p) => p.id).sort().join('\n')).digest('hex');
  assert.strictEqual(d.poolHash, expect);
  st.draws.MAIN = d;
  const txt = E.protocolText(st);
  assert.ok(txt.includes(expect));
  assert.ok(txt.includes('Nachrücker 2'));
});

test('Zufall: keine Verzerrung durch Modulo (Verwerfung)', () => {
  // 2^32 ist nicht durch 3 teilbar – oberster Bereich muss verworfen werden
  const lim = Math.floor(0x100000000 / 3) * 3;
  const r = seq([0xFFFFFFFF, lim, 5]);
  assert.strictEqual(E.randomIndex(3, r), 5 % 3);
});

test('SHA-256 stimmt mit Node-crypto überein (auch Umlaute, lange Texte)', () => {
  for (const s of ['', 'abc', 'Jürgen Müller ✓', 'x'.repeat(1000), 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)]) {
    assert.strictEqual(E.sha256(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex'));
  }
});

test('Joker-Codes: Format DZ-XXXX, eindeutig, ohne verwechselbare Zeichen', () => {
  const r = () => crypto.randomBytes(4).readUInt32BE(0);
  const codes = E.generateJokerCodes(100, r, []);
  assert.strictEqual(codes.length, 100);
  assert.strictEqual(new Set(codes.map((c) => c.code)).size, 100);
  for (const c of codes) assert.ok(/^DZ-[A-HJ-NP-Z2-9]{4}$/.test(c.code), c.code);
  const more = E.generateJokerCodes(100, r, codes);
  assert.strictEqual(new Set(codes.concat(more).map((c) => c.code)).size, 200);
});

test('Ausschluss: eigene Seite, Mitarbeiter, Sperrliste; anonyme Kommentare zählen nicht', () => {
  const st = base('2026-11-25');
  comment(st, PAGE, 'Velocenter Hessert', 1);
  comment(st, 'm1', 'René Mitarbeiter', 1);
  comment(st, 'f1', 'Fake Account', 1);
  comment(st, 'ok', 'Echte Person', 1);
  st.comments.push({ id: 'anon', postId: 'p1', userId: null, name: null, message: 'x', created_time: E.berlinToUtcIso('2026-11-22', '10:00') });
  st.settings.staff = ['rené mitarbeiter'];
  st.settings.blocked = ['f1'];
  const r = E.compute(st);
  assert.deepStrictEqual(r.persons.map((p) => p.id), ['ok']);
  assert.strictEqual(r.counts.excluded, 3);
  assert.strictEqual(r.counts.anon, 1);
  // nur anonyme Kommentare -> Rechte-Hinweis
  const st2 = base('2026-11-25');
  st2.comments.push({ id: 'a1', postId: 'p1', userId: null, message: 'x', created_time: E.berlinToUtcIso('2026-11-22', '10:00') });
  const w = E.compute(st2).warnings;
  assert.ok(w.some((x) => x.text.includes('pages_read_user_content')));
});

test('Likes werden Personen und Tagen zugeordnet; nur Liker sind keine Teilnehmer', () => {
  const st = base('2026-11-25');
  comment(st, 'a', 'Anna', 1);
  st.reactions.push({ postId: 'p1', userId: 'a', name: 'Anna', type: 'LIKE' });
  st.reactions.push({ postId: 'p2', userId: 'a', name: 'Anna', type: 'LOVE' });
  st.reactions.push({ postId: 'p1', userId: 'z', name: 'Nur Liker', type: 'LIKE' });
  const r = E.compute(st);
  assert.strictEqual(r.byId.get('a').likes, 2);
  assert.strictEqual(r.byId.get('a').likesByDay[2], 1);
  assert.strictEqual(r.byId.has('z'), false);
  assert.strictEqual(r.days[0].likes, 2);
  assert.strictEqual(r.counts.likes, 3);
});

test('Manueller Modus: Zeilen lesen, Fehler melden, Namen wiedererkennen', () => {
  const p = E.parseManualLines('Laura M. | Das Tretlager! | 18:42\nBen | Kette | 9.05\n | ohne Name | 10:00\nCleo | x | 25 Uhr\nDora');
  assert.strictEqual(p.rows.length, 3);
  assert.strictEqual(p.rows[1].time, '09:05');
  assert.strictEqual(p.rows[2].name, 'Dora');
  assert.strictEqual(p.errors.length, 2);
  const st = base('2026-11-25');
  comment(st, 'fb1', 'Laura M.', 1);
  const res = E.addManual(st, 2, 'laura m. | Antwort | 20:00\nNeu Person | hallo', 'Laura M.');
  assert.strictEqual(res.added, 2);
  assert.strictEqual(res.likes, 1);
  const r = E.compute(st);
  assert.strictEqual(r.byId.get('fb1').fulfilled, 2, 'manueller Eintrag gehört zur Facebook-Person');
  assert.ok(r.byId.get('m:neu person').done[2]);
});

test('Meta-Daten übernehmen: manuelle Einträge und Zuordnungen bleiben', () => {
  const st = base('2026-11-25');
  st.posts[0].dayOverride = 5;
  E.addManual(st, 3, 'Hand | x | 10:00', '');
  E.mergeMeta(st, { posts: [{ id: 'p1', message: 'Türchen 1/30', created_time: '2026-11-22T06:00:00+0000' }], comments: [{ id: 'n1', postId: 'p1', userId: 'u', name: 'U', message: 'm', created_time: '2026-11-22T08:00:00+0000' }], reactions: [] });
  assert.strictEqual(st.posts.find((p) => p.id === 'p1').dayOverride, 5);
  assert.strictEqual(st.comments.filter((c) => c.source === 'manuell').length, 1);
  assert.strictEqual(st.comments.filter((c) => c.source === 'meta').length, 1);
});

test('Export/Import: ohne Token, vollständig wiederherstellbar; CSV mit Kopfzeile', () => {
  const st = E.demoState();
  st.token = 'GEHEIM'; st.settings.token = 'GEHEIM';
  const j = E.exportJson(st);
  assert.ok(!j.includes('GEHEIM'));
  const back = E.importJson(j);
  assert.strictEqual(back.comments.length, st.comments.length);
  assert.strictEqual(E.compute(back).counts.finishers, E.compute(st).counts.finishers);
  assert.throws(() => E.importJson('{"x":1}'));
  const csv = E.participantsCsv(E.compute(st));
  assert.ok(csv.startsWith('﻿Name;Facebook-ID;Status'));
});

test('Demo-Daten: alle Status vorhanden, Tage vollständig', () => {
  const st = E.demoState();
  assert.strictEqual(new Set(st.jokers.map((j) => j.code)).size, 100);
  const r = E.compute(st);
  const stats = new Set(r.persons.map((p) => p.status));
  for (const k of ['durchzieher', 'joker', 'raus']) assert.ok(stats.has(k), k);
  assert.strictEqual(r.days.filter((d) => d.posts.length === 1).length, 30);
  assert.ok(r.counts.participants > 50);
});

console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
process.exit(failed ? 1 : 0);
