// „Spiel hosten“: startet den Relay-Server direkt im Spiel (Host-PC = Server) und nennt die Adressen für Freunde.
'use strict';
const os = require('os');
const path = require('path');
let server = null;
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
function hostServer(port = 7710) {
  try {
    if (!server) {
      const { createRelayServer } = require(path.join(__dirname, '..', 'server', 'relay-server.js'));
      server = createRelayServer({ port, log: () => {} });
    }
    return { ok: true, port, addresses: lanAddresses() };
  } catch (e) {
    return { ok: false, error: e.code === 'EADDRINUSE' ? `Port ${port} ist belegt – läuft schon ein Server?` : String(e.message || e) };
  }
}
function stopServer() { if (server) { server.close(); server = null; } }
module.exports = { hostServer, stopServer, lanAddresses };
