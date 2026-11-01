'use strict';
/**
 * Alle Anschlüsse ("Kabel") am Hub. Neue Anschlüsse: Datei anlegen, hier eintragen –
 * fertig. Die Netzwerk-Ansicht zeigt sie automatisch an.
 */
const core = require('./core');
const network = require('./network');
const desktop = require('./desktop');
const cloudTester = require('./cloud-tester');

function allConnectors() {
  return [...core, ...desktop, cloudTester, ...network];
}

function registerAll(hub, list = allConnectors()) {
  for (const c of list) hub.plugins.register(c);
  return hub;
}

module.exports = { allConnectors, registerAll };
