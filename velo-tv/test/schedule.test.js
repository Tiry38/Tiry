const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/shared/schedule');

const d = (s) => new Date(s); // lokale Zeit
test('ohne Plan immer aktiv, pausiert nie', () => {
  assert.equal(S.isActive({ enabled: true }, d('2026-11-23T10:00')), true);
  assert.equal(S.isActive({ enabled: false }, d('2026-11-23T10:00')), false);
});
test('Wochentage (Mo=1 … So=7)', () => {
  const it = { plan: { days: [6, 7] } };
  assert.equal(S.isActive(it, d('2026-11-28T10:00')), true);  // Samstag
  assert.equal(S.isActive(it, d('2026-11-23T10:00')), false); // Montag
});
test('Uhrzeit, auch über Mitternacht', () => {
  const tag = { plan: { from: '09:00', to: '13:00' } };
  assert.equal(S.isActive(tag, d('2026-11-23T08:59')), false);
  assert.equal(S.isActive(tag, d('2026-11-23T09:00')), true);
  assert.equal(S.isActive(tag, d('2026-11-23T13:00')), false);
  const nacht = { plan: { from: '22:00', to: '02:00' } };
  assert.equal(S.isActive(nacht, d('2026-11-23T23:30')), true);
  assert.equal(S.isActive(nacht, d('2026-11-23T01:00')), true);
  assert.equal(S.isActive(nacht, d('2026-11-23T12:00')), false);
});
test('Datumsbereich inklusive Grenzen', () => {
  const it = { plan: { startDate: '2026-12-01', endDate: '2026-12-24' } };
  assert.equal(S.isActive(it, d('2026-11-30T12:00')), false);
  assert.equal(S.isActive(it, d('2026-12-01T00:01')), true);
  assert.equal(S.isActive(it, d('2026-12-24T23:59')), true);
  assert.equal(S.isActive(it, d('2026-12-25T00:00')), false);
  assert.equal(S.abgelaufen(it, d('2026-12-25T00:00')), true);
});
test('Beschreibung lesbar', () => {
  assert.equal(S.beschreibe({}), 'Immer');
  assert.equal(S.beschreibe({ plan: { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' } }), 'Mo–Fr · 09:00–18:00 Uhr');
  assert.equal(S.beschreibe({ plan: { days: [6, 7], endDate: '2027-02-28' } }), 'Sa, So · bis 28.02.');
});
