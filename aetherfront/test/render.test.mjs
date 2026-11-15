// Render-Budget der Umgebung (ohne Browser: Geometrie zählen) und Sichtbereichs-Ausdünnung der Deko.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Minimaler Canvas-Ersatz für die prozeduralen Texturen (Inhalt egal, nur die Geometrie wird gezählt)
const ctx = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w | 0) * Math.max(1, h | 0) * 4) })
    : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
      : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) };

const { buildWorld } = await import('../src/render/env/world.js');
const { createSharedUniforms } = await import('../src/render/env/shaders.js');
const { createInstanceCuller } = await import('../src/render/env/culling.js');

const tris = (root) => {
  let n = 0;
  root.traverseVisible((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return n;
};

test('Umgebung: Dreiecks-Budget (Stufe „Hoch“) und Sichtbereichs-Culling', () => {
  const U = createSharedUniforms();
  const w = buildWorld(U, {});
  w.grass.setFraction(0.6); w.flowers.setFraction(0.7); // wie QUALITY.high
  const total = tris(w.root);
  assert.ok(total < 720000, `Umgebung hat ${Math.round(total)} Dreiecke (vorher 1,5 Mio., Budget 720k Geometrie gesamt)`);
  // Draufsicht auf die eigene Bahn (wie im Spiel): gezeichnet wird deutlich weniger
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 2500);
  cam.position.set(-103, 36, 28); cam.lookAt(-103, 0, 0); cam.updateMatrixWorld();
  U.uGrassFar.value = 150;
  w.cull(cam);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  let drawn = 0;
  w.root.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (o.frustumCulled) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (!frustum.intersectsObject(o)) return; }
    const g = o.geometry;
    drawn += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  assert.ok(drawn < 400000, `Bahnansicht zeichnet ${Math.round(drawn)} Umgebungs-Dreiecke (Ziel ≤ 400k)`);
});

test('Instanz-Culling: nur Instanzen im Bild, Reihenfolge und Farben bleiben erhalten', () => {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
  const xs = [-200, -2, 0, 2, 200];
  xs.forEach((x, i) => { im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)); im.setColorAt(i, new THREE.Color(i / 10, 0, 0)); });
  const c = createInstanceCuller();
  c.add(im, 1);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 1000);
  cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0);
  c.update(cam);
  assert.equal(im.count, 3);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), col = new THREE.Color();
  const got = [0, 1, 2].map((i) => { im.getMatrixAt(i, m); im.getColorAt(i, col); return [p.setFromMatrixPosition(m).x, Math.round(col.r * 10)]; });
  assert.deepEqual(got, [[-2, 1], [0, 2], [2, 3]]);
  cam.position.set(200, 0, 20); cam.lookAt(200, 0, 0);
  c.update(cam);
  assert.equal(im.count, 1);
  im.getMatrixAt(0, m);
  assert.equal(p.setFromMatrixPosition(m).x, 200);
  cam.position.set(0, 5000, 0); cam.lookAt(0, 6000, 0);
  c.update(cam);
  assert.equal(im.visible, false, 'nichts im Bild → kein Draw-Call');
});
