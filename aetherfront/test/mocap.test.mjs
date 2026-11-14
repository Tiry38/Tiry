// Motion-Capture: Clip-Daten (web/assets/anim/clips.json), Import-Kette (BVH → Retarget → Aufräumen, nur mit
// Zwischenspeicher node_modules/.cache/cmu-bvh) und Laufzeit (Blendraum, Bein-IK, Maske) auf den echten Heldenmodellen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { MocapLibrary, MocapRuntime, setMocapLibrary, solveTwoBone } from '../src/render/hero/mocap.js';
import { buildHero, HeroAnimator, HERO_MODEL_IDS } from '../src/render/heroModels.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JSON_PATH = path.join(ROOT, 'web/assets/anim/clips.json');
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const lib = new MocapLibrary(data);
const pose = () => ({ q: Array.from({ length: lib.J }, () => new THREE.Quaternion()), h: new THREE.Vector3() });
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test('Clip-Datei: Format, Größe, Pflicht-Clips', () => {
  assert.equal(data.format, 'aetherfront-mocap-1');
  assert.ok(fs.statSync(JSON_PATH).size < 3 * 1024 * 1024, 'Clips < 3 MB');
  for (const n of ['idle', 'walk', 'jog', 'backWalk', 'backRun', 'turnL', 'turnR', 'jump']) assert.ok(lib.clips[n], 'Clip fehlt: ' + n);
  assert.ok(lib.clips.jog.speed > 2.5 && lib.clips.walk.speed > 0.6 && lib.clips.walk.speed < 2);
  assert.ok(lib.clips.jump.markers.land > lib.clips.jump.markers.liftoff);
  assert.match(data.source, /CMU Graphics Lab Motion Capture Database/);
});

test('alle Clips: keine NaN, normierte Quaternionen, Hüfthöhe plausibel', () => {
  const p = pose();
  for (const c of Object.values(lib.clips)) {
    for (let i = 0; i < c.n * 2; i++) {
      lib.sample(c, i / (2 * lib.fps), p);
      for (const q of p.q) { assert.ok(Number.isFinite(q.x + q.y + q.z + q.w), c.name); assert.ok(Math.abs(q.length() - 1) < 1e-3); }
      assert.ok(p.h.y > 0.6 && p.h.y < 1.15, `${c.name}: Hüfte ${p.h.y}`);
    }
  }
});

test('Schleifen nahtlos: Sprung letztes→erstes Bild nicht größer als normale Bildschritte', () => {
  const a = pose(), b = pose();
  for (const c of Object.values(lib.clips)) {
    if (!c.loop) continue;
    const steps = [];
    for (let i = 0; i < c.n; i++) {
      lib.sample(c, i / lib.fps, a); lib.sample(c, ((i + 1) % c.n) / lib.fps, b);
      let m = 0; for (let j = 0; j < lib.J; j++) m = Math.max(m, angle(a.q[j], b.q[j]));
      steps.push([m, a.h.distanceTo(b.h)]);
    }
    const seam = steps[c.n - 1];
    const sorted = steps.map((s) => s[0]).sort((x, y) => x - y), med = sorted[sorted.length >> 1], max = sorted[sorted.length - 1];
    assert.ok(seam[0] <= Math.max(med * 2.5, max * 0.9, 0.05), `${c.name}: Naht ${(seam[0] * 57.3).toFixed(1)}° (Median ${(med * 57.3).toFixed(1)}°)`);
    assert.ok(seam[1] < 0.05, `${c.name}: Hüftsprung ${seam[1].toFixed(3)} m`);
  }
});

test('2-Knochen-IK erreicht erreichbare Ziele', () => {
  const A = new THREE.Vector3(0, 1, 0), B = new THREE.Vector3(0, 0.55, 0.02), C = new THREE.Vector3(0, 0.1, 0);
  const T = new THREE.Vector3(0.1, 0.2, 0.3);
  const r = solveTwoBone(A, B, C, T, new THREE.Quaternion(), new THREE.Quaternion());
  const knee = B.clone().sub(A).applyQuaternion(r.g1.clone()).add(A); // g1 dreht globale Knochenrichtung
  const end = C.clone().sub(B).applyQuaternion(r.g2).add(knee);
  assert.ok(end.distanceTo(T) < 1e-3, 'Knöchel trifft Ziel: ' + end.distanceTo(T));
});

/** Held simulieren; liefert Fußpositionen im Weltraum (Boden mitbewegt) */
function simulate(model, st, secs = 3, useMocap = true) {
  const rig = buildHero(model, {}); const holder = new THREE.Group(); holder.scale.setScalar(1.25); holder.add(rig.root);
  const anim = new HeroAnimator(rig);
  if (!useMocap) anim.useMocap = false;
  const dt = 1 / 60; let gx = 0, gz = 0, y = 0, vy = 0, air = false;
  const feet = { L: [], R: [] };
  for (let i = 0; i < secs * 60; i++) {
    const t = i * dt;
    if (st.jumpAt !== undefined && !air && Math.abs(t - st.jumpAt) < dt / 2) { air = true; vy = 7.2; }
    if (air) { vy -= 22 * dt; y += vy * dt; if (y <= 0) { y = 0; air = false; } }
    gx += -(st.strafe || 0) * dt; gz += (st.fwd || 0) * dt;
    anim.update(dt, { fwd: st.fwd || 0, strafe: st.strafe || 0, turn: st.turn || 0, airborne: air, vy, action: st.action ? st.action(t) : null, dead: st.dead && t > 1 });
    holder.updateMatrixWorld(true);
    for (const n of Object.keys(rig.joints)) { const j = rig.joints[n]; assert.ok(Number.isFinite(j.quaternion.x + j.quaternion.w + j.position.x + j.position.y), `${model}: NaN in ${n}`); }
    if (i > 60) for (const s of ['L', 'R']) { const p = rig.joints['foot' + s].getWorldPosition(new THREE.Vector3()); p.x += gx; p.z += gz; feet[s].push(p); }
  }
  return { rig, anim, feet };
}
function plantedSlide(feet) {
  const all = [...feet.L, ...feet.R].map((p) => p.y), minY = Math.min(...all), sp = [];
  for (const s of ['L', 'R']) for (let i = 1; i < feet[s].length; i++) { const a = feet[s][i - 1], b = feet[s][i]; if (a.y < minY + 0.02 && b.y < minY + 0.02) sp.push(Math.hypot(b.x - a.x, b.z - a.z) * 60); }
  sp.sort((a, b) => a - b);
  return { median: sp[sp.length >> 1] ?? 0, minY };
}

test('Laufzeit: alle Helden, alle Bewegungsarten ohne NaN; Füße bleiben am Boden und rutschen kaum', () => {
  setMocapLibrary(lib);
  const cases = { lauf: { fwd: 7 }, rueck: { fwd: -4.5 }, links: { strafe: -7 }, rechts: { strafe: 7 }, diag: { fwd: 4.95, strafe: 4.95 }, gehen: { fwd: 1.5 } };
  for (const model of HERO_MODEL_IDS) {
    for (const [name, st] of Object.entries(cases)) {
      const { anim, feet, rig } = simulate(model, st, 2.5);
      assert.ok(anim.mocap, 'Mocap aktiv');
      const { median, minY } = plantedSlide(feet);
      const ankle = rig.rest.footL.y * 1.25;
      assert.ok(minY > ankle - 0.04 && minY < ankle + 0.05, `${model}/${name}: Knöchel-Minimum ${minY.toFixed(3)} (Ruhe ${ankle.toFixed(3)})`);
      const v = Math.hypot(st.fwd || 0, st.strafe || 0);
      assert.ok(median < 0.15 * v, `${model}/${name}: Standfuß gleitet ${median.toFixed(2)} m/s`);
    }
  }
});

test('Laufzeit: Sprung, Drehen, Aktion über Lauf, Tod – stabil; Fallback ohne Clips', () => {
  setMocapLibrary(lib);
  simulate('hero_kael', { jumpAt: 0.5 }, 2);
  simulate('hero_lyra', { fwd: 7, jumpAt: 1.0 }, 2.5);
  simulate('hero_mira', { turn: 3 }, 2);
  simulate('hero_brann', { fwd: 7, action: (t) => (t > 1 && t < 1.6 ? { kind: 'attack', t: (t - 1) / 0.6, slot: 0 } : null) }, 2);
  simulate('hero_selene', { dead: true }, 3);
  setMocapLibrary(null);
  const r = simulate('hero_varo', { fwd: 7 }, 1);
  assert.equal(r.anim.mocap, undefined, 'ohne Clips rein prozedural');
  setMocapLibrary(lib);
});

test('Import-Kette (BVH → Retarget → Schleifen) – nur mit BVH-Zwischenspeicher', async (t) => {
  const imp = await import('../scripts/mocap-import.mjs');
  const cache = process.env.MOCAP_CACHE || path.join(ROOT, 'node_modules/.cache/cmu-bvh');
  if (!imp.SOURCES.every((id) => fs.existsSync(path.join(cache, id + '.bvh')))) { t.skip('BVH-Zwischenspeicher fehlt (node scripts/mocap-import.mjs lädt ihn)'); return; }
  const { out } = await imp.buildClips({ log: () => {} });
  const lib2 = new MocapLibrary(JSON.parse(JSON.stringify(out)));
  const p = pose();
  for (const c of Object.values(lib2.clips)) for (let i = 0; i < c.n; i++) { lib2.sample(c, i / lib2.fps, p); for (const q of p.q) assert.ok(Number.isFinite(q.x + q.w)); }
  assert.deepEqual(Object.keys(out.clips), Object.keys(data.clips));
});
