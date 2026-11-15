// Kartenbild (belegte Bahnen), Kamera-Steuerung (Rand, Zoom zum Zeiger), Minimap-Abbildung und Welt nur mit belegten Bahnen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mapLayout, laneCenterX, kingPos, ARENA, LANE_SPAWN_Z } from '../src/sim/layout.js';
import { Sim } from '../src/sim/sim.js';
import { MISSIONS, missionSetup } from '../src/sim/campaign.js';
import { edgeDir, zoomToward, EDGE_PX } from '../src/render/camera.js';
import { fitMap } from '../src/ui/minimap.js';

const ctx = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w | 0) * Math.max(1, h | 0) * 4) })
    : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
      : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) };

const skirmish = (n) => {
  const players = [];
  for (let i = 0; i < n * 2; i++) players.push({ name: `P${i}`, team: i % 2, faction: 'random', bot: i > 0 });
  return new Sim({ seed: 3, players });
};
const layoutOf = (sim) => mapLayout(sim.players, { campaign: !!sim.campaign, arena: !!(sim.rules.arena && !sim.campaign) });

test('Kartenbild: Kampagne zeigt nur die eigene Bahn + Marschweg zur Rissfeste', () => {
  const sim = new Sim(missionSetup(MISSIONS[0], { seed: 1 }));
  const L = layoutOf(sim);
  assert.deepEqual(L.lanes, [[sim.players[0].slot], []]);
  assert.deepEqual(L.march, [false, true]);
  assert.equal(L.full, false);
  assert.equal(L.arena, false);
  // Kamera erreicht Portal, eigenen König und die Rissfeste, aber keine leeren Nachbarbahnen weit draußen
  const lx = laneCenterX(0, sim.players[0].slot);
  const b = L.camBounds;
  assert.ok(b.x0 <= lx && b.x1 >= kingPos(1).x, 'Bahn und Rissfeste im Bewegungsraum');
  assert.ok(b.x0 > laneCenterX(0, 0) - 1, 'ganz linke (leere) Bahn liegt außerhalb');
  assert.ok(b.z0 <= LANE_SPAWN_Z - 5 && b.z1 >= kingPos(0).z, 'Portal bis König');
});

test('Kartenbild: Gefechte belegen mittig zentrierte Bahnen, 4 gegen 4 ist die volle Welt', () => {
  const k1 = layoutOf(skirmish(1)), k2 = layoutOf(skirmish(2)), k4 = layoutOf(skirmish(4));
  assert.deepEqual(k1.lanes, [[1], [1]]);
  assert.deepEqual(k2.lanes, [[1, 2], [1, 2]]);
  assert.equal(k4.full, true);
  assert.equal(k4.key, '0123|0123|');
  assert.notEqual(k1.key, k2.key);
  // Arena im Bewegungsraum, wenn sie aktiv ist
  const s = skirmish(2);
  const La = mapLayout(s.players, { arena: true });
  assert.ok(La.camBounds.z0 <= ARENA.z && La.mapRect.z0 <= ARENA.z - ARENA.r, 'Arena erreichbar und auf der Minimap');
  // reine Funktion: Simulation unverändert, gleiche Eingabe → gleiches Ergebnis
  assert.deepEqual(mapLayout(s.players, { arena: true }), La);
});

test('Kamera: Randscrollen in einer 10-px-Zone, Zoom hält den Bodenpunkt unter dem Zeiger', () => {
  assert.deepEqual(edgeDir(0, 450, 1600, 900), { x: -1, z: 0 });
  assert.deepEqual(edgeDir(EDGE_PX, 3, 1600, 900), { x: -1, z: -1 });
  assert.deepEqual(edgeDir(800, 450, 1600, 900), { x: 0, z: 0 });
  assert.deepEqual(edgeDir(1599, 899, 1600, 900), { x: 1, z: 1 });
  assert.deepEqual(edgeDir(EDGE_PX + 2, 900 - EDGE_PX - 3, 1600, 900), { x: 0, z: 0 });
  // Perspektivkamera: Blickpunkt und Kamera um P skaliert → P bleibt an derselben Bildschirmstelle
  const cam = (tx, tz, d) => { const c = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 2000); c.position.set(tx, Math.sin(1) * d, tz + Math.cos(1) * d); c.lookAt(tx, 0, tz); c.updateMatrixWorld(); return c; };
  const P = new THREE.Vector3(-90, 0, -12);
  const a = P.clone().project(cam(-100, 0, 60));
  const n = zoomToward(-100, 0, P.x, P.z, 0.5);
  const b = P.clone().project(cam(n.x, n.z, 30));
  assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6, 'Punkt unter dem Zeiger bleibt stehen');
});

test('Minimap: Welt ↔ Karte hin und zurück, Kartenausschnitt passt hinein', () => {
  const L = layoutOf(new Sim(missionSetup(MISSIONS[0], { seed: 1 })));
  const F = fitMap(L.mapRect, 504, 300, 20);
  const [mx, my] = F.toMap(kingPos(1).x, kingPos(1).z);
  assert.ok(mx >= 20 && mx <= 484 && my >= 20 && my <= 280);
  const w = F.toWorld(mx, my);
  assert.ok(Math.abs(w.x - kingPos(1).x) < 1e-9 && Math.abs(w.z - kingPos(1).z) < 1e-9);
});

test('Welt: nur belegte Bahnen werden gebaut (Kampagne), volle Welt unverändert', async () => {
  const { buildWorld } = await import('../src/render/env/world.js');
  const { createSharedUniforms } = await import('../src/render/env/shaders.js');
  const portals = (w) => { const m = w.root.getObjectByName('aeth-portals'); m.geometry.computeBoundingBox(); return m.geometry; };
  const full = buildWorld(createSharedUniforms(), {});
  const camp = buildWorld(createSharedUniforms(), { lanes: [[1], []], march: [false, true] });
  const pf = portals(full), pc = portals(camp);
  assert.equal(pc.attributes.position.count * 8, pf.attributes.position.count, 'ein Portal statt acht');
  const lx = laneCenterX(0, 1);
  assert.ok(pc.boundingBox.min.x > lx - 6 && pc.boundingBox.max.x < lx + 6, 'Portal nur auf der eigenen Bahn');
  // Marschweg der Kampagne: Brücke zur Rissfeste; Rest der Insel ist Landschaft (mehr Bäume als in der vollen Welt)
  assert.equal(camp.teams[1].bridges.length, 1);
  const trees = (w) => { let n = 0; w.root.traverse((o) => { if (o.isInstancedMesh && /canop/.test(o.name)) n += o.instanceMatrix.count; }); return n; };
  assert.ok(trees(camp) > trees(full), `Landschaft statt leerer Bahnen (${trees(camp)} > ${trees(full)} Bäume)`);
});
