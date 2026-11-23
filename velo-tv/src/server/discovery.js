'use strict';
/* Automatisches Finden der Zentrale im Ladennetz per UDP-Broadcast.
   Die Zentrale ruft alle 2 s „hier bin ich“, Bedienplätze hören zu. */
const dgram = require('dgram');
const os = require('os');

const PORT = 8834;
const KENNUNG = 'velo-tv/1';

function broadcastAdressen() {
  const ziele = new Set(['255.255.255.255']);
  for (const netze of Object.values(os.networkInterfaces())) {
    for (const n of netze || []) {
      if (n.family !== 'IPv4' || n.internal || !n.netmask) continue;
      const ip = n.address.split('.').map(Number);
      const mask = n.netmask.split('.').map(Number);
      ziele.add(ip.map((b, i) => (b | (~mask[i] & 255))).join('.'));
    }
  }
  return [...ziele];
}

function startBeacon(info) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  let timer;
  sock.on('error', (e) => console.warn('[velo-tv] Beacon:', e.message));
  sock.bind(() => {
    try { sock.setBroadcast(true); } catch (e) { /* egal */ }
    const rufen = () => {
      const msg = Buffer.from(JSON.stringify(Object.assign({ k: KENNUNG }, info())));
      for (const ziel of broadcastAdressen()) sock.send(msg, PORT, ziel, () => {});
    };
    rufen();
    timer = setInterval(rufen, 2000);
  });
  return () => { clearInterval(timer); try { sock.close(); } catch (e) { /* egal */ } };
}

function startListener(onFound) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('error', (e) => console.warn('[velo-tv] Suche:', e.message));
  sock.on('message', (buf, rinfo) => {
    try {
      const d = JSON.parse(buf.toString('utf8'));
      if (d.k !== KENNUNG) return;
      onFound({ host: rinfo.address, port: d.port, name: d.name, version: d.version, seen: Date.now() });
    } catch (e) { /* fremdes Paket */ }
  });
  sock.bind(PORT);
  return () => { try { sock.close(); } catch (e) { /* egal */ } };
}

module.exports = { startBeacon, startListener, PORT };
