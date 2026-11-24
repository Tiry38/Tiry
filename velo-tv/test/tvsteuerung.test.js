const test = require('node:test');
const assert = require('node:assert');
const { sollAn, naechsteAktion, zeitenSauber, STANDARD } = require('../src/server/tvsteuerung');

const Z = zeitenSauber(STANDARD);
const d = (s) => new Date(s);

test('Öffnungszeiten Velocenter: an/aus', () => {
  assert.equal(sollAn(Z, d('2026-11-23T08:59')), false); // Montag vor 9
  assert.equal(sollAn(Z, d('2026-11-23T09:00')), true);
  assert.equal(sollAn(Z, d('2026-11-23T12:00')), false); // Mittagspause
  assert.equal(sollAn(Z, d('2026-11-23T14:30')), true);
  assert.equal(sollAn(Z, d('2026-11-23T18:00')), false);
  assert.equal(sollAn(Z, d('2026-11-25T10:00')), false); // Mittwoch zu
  assert.equal(sollAn(Z, d('2026-11-28T11:59')), true);  // Samstag
  assert.equal(sollAn(Z, d('2026-11-28T14:30')), false); // Samstag nachmittags zu
  assert.equal(sollAn(Z, d('2026-11-29T10:00')), false); // Sonntag
});

test('Nächste Aktion: Mittagspause, Abend, über Mittwoch hinweg', () => {
  let n = naechsteAktion(Z, d('2026-11-23T10:00'));
  assert.equal(n.an, false); assert.equal(n.mittag, true); assert.equal(n.zeit.getHours(), 12);
  n = naechsteAktion(Z, d('2026-11-23T13:00'));
  assert.equal(n.an, true); assert.equal(n.zeit.getHours(), 14); assert.equal(n.zeit.getMinutes(), 30);
  n = naechsteAktion(Z, d('2026-11-23T16:00'));
  assert.equal(n.an, false); assert.equal(n.mittag, false);
  n = naechsteAktion(Z, d('2026-11-24T19:00')); // Dienstagabend → Donnerstag 9:00 (Mittwoch zu)
  assert.equal(n.an, true); assert.equal(n.zeit.getDay(), 4); assert.equal(n.zeit.getHours(), 9);
});

test('Ungültige Zeiten werden verworfen', () => {
  const z = zeitenSauber({ 1: [['10:00', '09:00'], ['x', '12:00'], ['08:00', '09:30']] });
  assert.deepEqual(z[1], [['08:00', '09:30']]);
  assert.deepEqual(z[3], []);
});
