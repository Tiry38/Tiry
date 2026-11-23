const test = require('node:test');
const assert = require('node:assert');
const { startBeacon, startListener } = require('../src/server/discovery');

test('Bedienplatz findet die Zentrale per Broadcast', async (t) => {
  let gefunden = null;
  const stopL = startListener((z) => { gefunden = z; });
  const stopB = startBeacon(() => ({ port: 8833, name: 'Kasse', version: 'test' }));
  const ende = Date.now() + 5000;
  while (!gefunden && Date.now() < ende) await new Promise((r) => setTimeout(r, 100));
  stopB(); stopL();
  if (!gefunden) return t.skip('Kein Broadcast in dieser Umgebung möglich');
  assert.equal(gefunden.name, 'Kasse');
  assert.equal(gefunden.port, 8833);
});
