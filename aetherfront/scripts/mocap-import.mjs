// Aetherfront – Motion-Capture-Import (CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu).
// Lädt ausgewählte BVH-Dateien (BVH-Fassung von Bruce Hahne/cgspeed über github.com/una-dinosauria/cmu-mocap)
// in einen Zwischenspeicher (node_modules/.cache/cmu-bvh, nicht eingecheckt), überträgt sie auf das Helden-Skelett
// (src/render/hero/rig.js), räumt auf (Wurzelbewegung → In-Place-Schleifen mit Schrittgeschwindigkeit, Schleifen-
// Überblendung, Fußfixierung, 30 fps, Quaternionen) und schreibt komprimiert web/assets/anim/clips.json.
//   node scripts/mocap-import.mjs            (MOCAP_CACHE=… für einen anderen Zwischenspeicher)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import * as L from './mocap-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.MOCAP_CACHE || path.join(ROOT, 'node_modules/.cache/cmu-bvh');
const OUT = path.join(ROOT, 'web/assets/anim/clips.json');
const BASE = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/';
const FPS = 30;

// Auswahl. fps: tatsächliche Aufnahmerate (einige Subjekte sind 60 fps, obwohl die BVH 120 angibt).
// type: loop (Fortbewegung/Ruhe), turn (Drehen auf der Stelle), jump (Absprung/Flug/Landung), once (Einzelaktion)
export const CLIPS = [
  { name: 'idle', file: '77_02', from: 0.6, to: 7.6, type: 'loop', period: [3.4, 6.0], win: [0.1, 1.2], travel: null, desc: 'standing' },
  { name: 'walk', file: '16_15', from: 0.4, to: 3.8, type: 'loop', period: [0.9, 1.4], travel: 'fwd', desc: 'walk' },
  { name: 'jog', file: '09_01', from: 0.05, to: 1.2, type: 'loop', period: [0.5, 0.95], win: [0.05, 0.3], travel: 'fwd', desc: 'run' },
  { name: 'backWalk', file: '76_11', from: 0.9, to: 3.0, type: 'loop', period: [0.8, 1.4], win: [0.0, 0.7], travel: 'back', desc: 'quick large steps backwards' },
  { name: 'backRun', from: 'jog', reverse: true, travel: 'back', desc: 'run (zeitlich umgekehrt → Rückwärtslauf)' },
  { name: 'turnL', file: '69_16', from: 0.3, to: 3.0, type: 'turn', period: [0.8, 1.8], win: [0.0, 0.9], desc: 'turn in place' },
  { name: 'turnR', from: 'turnL', mirror: true, desc: 'turn in place (gespiegelt)' },
  { name: 'jump', file: '13_39', from: 0.9, to: 2.9, type: 'jump', desc: 'jump' },
];
export const SOURCES = [...new Set(CLIPS.filter((c) => c.file).map((c) => c.file))];

async function fetchBVH(id) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, id + '.bvh');
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return fs.readFileSync(f, 'utf8');
  const sub = String(+id.split('_')[0]).padStart(3, '0');
  const url = BASE + sub + '/' + id + '.bvh';
  process.stdout.write('↓ ' + url + '\n');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download fehlgeschlagen: ' + url + ' ' + res.status);
  const txt = await res.text();
  fs.writeFileSync(f, txt);
  return txt;
}

const cloneFr = (f) => ({ hips: f.hips.clone(), q: Object.fromEntries(Object.entries(f.q).map(([k, v]) => [k, v.clone()])) });

function mirrorFrames(frames) {
  return frames.map((f) => {
    const q = {};
    for (const [k, v] of Object.entries(f.q)) {
      const m = k.replace(/(L|R)$/, (x) => (x === 'L' ? 'R' : 'L'));
      q[m] = new THREE.Quaternion(v.x, -v.y, -v.z, v.w);
    }
    return { hips: new THREE.Vector3(-f.hips.x, f.hips.y, f.hips.z), q };
  });
}

/** Schleife so drehen, dass Bild 0 = Beginn des linken Bodenkontakts */
function alignPhase(tgt, frames, vel) {
  const c = L.footContacts(tgt, frames, FPS, vel, true);
  const n = frames.length;
  let best = 0, bestScore = -1;
  for (let i = 0; i < n; i++) {
    const rise = c.L[i] - c.L[(i - 1 + n) % n];
    if (rise > bestScore) { bestScore = rise; best = i; }
  }
  return frames.slice(best).concat(frames.slice(0, best));
}

function contactsCompact(tgt, frames, vel) {
  const c = L.footContacts(tgt, frames, FPS, vel, true);
  return { L: c.L.map((x) => +x.toFixed(2)), R: c.R.map((x) => +x.toFixed(2)) };
}

const yawOfQ = (q) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };

export async function buildClips({ log = console.log } = {}) {
  const tgt = L.targetSkeleton();
  const built = {};
  const meta = {};
  for (const spec of CLIPS) {
    let frames, info = { loop: false };
    if (spec.from && typeof spec.from === 'string' && built[spec.from]) {
      const src = built[spec.from];
      frames = src.frames.map(cloneFr);
      info = { ...src.info };
      if (spec.reverse) {
        frames.reverse();
        // Rückwärts: Bewegung läuft nach −Z
        info.vel = new THREE.Vector3(-info.vel.x, 0, -info.vel.z);
        frames = alignPhase(tgt, frames, info.vel);
      }
      if (spec.mirror) {
        frames = mirrorFrames(frames);
        if (info.vel) info.vel = new THREE.Vector3(-info.vel.x, 0, info.vel.z);
        if (info.omega) info.omega = -info.omega;
      }
    } else {
      const txt = await fetchBVH(spec.file);
      const bvh = L.parseBVH(txt);
      if (spec.fps) bvh.frameTime = 1 / spec.fps;
      const from = Math.max(spec.from ?? 0, bvh.frameTime); // Bild 0 ist die T-Pose
      const r = L.retarget(bvh, tgt, { fps: FPS, from, to: spec.to });
      frames = r.frames;
      L.fixSigns(frames);
      L.groundFrames(tgt, frames, spec.type === 'jump' ? 0.3 : 0.05);
      if (spec.type === 'loop' || spec.type === 'turn') {
        if (spec.type === 'turn') {
          // Drehtrend entfernen (lineare Gier-Steigung) → Tritt-Schleife auf der Stelle
          let prev = 0, acc = 0; const ys = frames.map((f, i) => { const y = yawOfQ(f.q.hips); if (i) { let d = y - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; acc += d; } prev = y; return acc; });
          const n = ys.length, mt = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
          let num = 0, den = 0; ys.forEach((y, i) => { num += (i - mt) * (y - my); den += (i - mt) ** 2; });
          const slope = num / den; // rad/Bild
          const pivot = frames.reduce((a, f) => a.add(f.hips), new THREE.Vector3()).divideScalar(n); pivot.y = 0;
          frames.forEach((f, i) => L.rotateFrames([f], -(slope * i + ys[0]), pivot));
          info.omega = slope * FPS;
        }
        const lp = L.findLoop(tgt, frames, FPS, spec.period, spec.win);
        // Laufrichtung normieren (Wurzelbewegung des Ausschnitts → +Z / −Z)
        if (spec.travel) {
          const a = frames[lp.s].hips, b = frames[lp.s + lp.T].hips;
          const ang = Math.atan2(b.x - a.x, b.z - a.z);
          const want = spec.travel === 'back' ? Math.PI : 0;
          L.rotateFrames(frames, want - ang, new THREE.Vector3(a.x, 0, a.z));
        } else if (spec.type !== 'turn') {
          // Ruhe: mittlere Blickrichtung nach +Z
          let sx = 0, sz = 0; for (let i = lp.s; i < lp.s + lp.T; i++) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(frames[i].q.hips); sx += f.x; sz += f.z; }
          L.rotateFrames(frames, -Math.atan2(sx, sz), frames[lp.s].hips.clone().setY(0));
        } else {
          let sx = 0, sz = 0; for (let i = lp.s; i < lp.s + lp.T; i++) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(frames[i].q.hips); sx += f.x; sz += f.z; }
          L.rotateFrames(frames, -Math.atan2(sx, sz), frames[lp.s].hips.clone().setY(0));
        }
        const res = L.makeLoop(frames, lp.s, lp.T);
        frames = res.frames;
        const vel = spec.travel ? res.disp.clone().multiplyScalar(FPS / lp.T) : new THREE.Vector3();
        L.fixSigns(frames);
        L.smoothFrames(frames, true, 1);
        // Fußfixierung: Standbein läuft exakt mit −vel
        const con = L.footContacts(tgt, frames, FPS, vel, true);
        L.footLock(tgt, frames, FPS, con, vel, true);
        if (spec.travel) frames = alignPhase(tgt, frames, vel);
        L.centerFrames(tgt, frames);
        info = { loop: true, vel, loopErr: lp.d, period: lp.T / FPS, omega: info.omega };
        log(`  ${spec.name}: Schleife ${lp.T} Bilder (${(lp.T / FPS).toFixed(2)} s) ab ${(lp.s / FPS).toFixed(2)} s, Fehler ${lp.d.toFixed(3)}, v=${vel.length().toFixed(2)} m/s${info.omega ? `, ω=${(info.omega * 57.3).toFixed(0)}°/s` : ''}`);
      } else if (spec.type === 'jump') {
        // Kontakte im Rohraum (mit Wurzelbewegung)
        const con = L.footContacts(tgt, frames, FPS, new THREE.Vector3(), false);
        const air = frames.map((_, i) => Math.min(con.Lpos[i].y - con.Lfloor, con.Rpos[i].y - con.Rfloor) > 0.05);
        let lo = air.findIndex((x, i) => x && air[i + 1] && air[i + 2]);
        let ld = lo; while (ld < frames.length && air[ld]) ld++;
        // Flugbahn der Hüfte entfernen (Höhe macht die Simulation) und horizontale Drift entfernen
        const y0 = frames[lo - 1].hips.y, y1 = frames[ld].hips.y;
        for (let i = lo; i < ld; i++) { const u = (i - lo + 1) / (ld - lo + 1); frames[i].hips.y = y0 + (y1 - y0) * u; }
        const x0 = frames[0].hips.x, z0 = frames[0].hips.z, xe = frames[frames.length - 1].hips.x, ze = frames[frames.length - 1].hips.z;
        frames.forEach((f, i) => { const u = i / (frames.length - 1); f.hips.x -= x0 + (xe - x0) * u; f.hips.z -= z0 + (ze - z0) * u; });
        // Blickrichtung +Z
        let sx = 0, sz = 0; for (const f of frames) { const v = new THREE.Vector3(0, 0, 1).applyQuaternion(f.q.hips); sx += v.x; sz += v.z; }
        L.rotateFrames(frames, -Math.atan2(sx, sz));
        L.smoothFrames(frames, false, 1);
        // Standphasen fixieren
        const con2 = L.footContacts(tgt, frames, FPS, new THREE.Vector3(), false);
        for (const s of ['L', 'R']) for (let i = 0; i < frames.length; i++) if (i < lo - 1 || i > ld + 1) con2[s][i] = Math.max(con2[s][i], 1); else con2[s][i] = 0;
        L.footLock(tgt, frames, FPS, con2, new THREE.Vector3(), false);
        L.centerFrames(tgt, frames.slice(0, Math.max(2, lo - 1)).length ? frames : frames);
        info = { loop: false, markers: { liftoff: lo / FPS, land: ld / FPS } };
        log(`  ${spec.name}: Absprung ${(lo / FPS).toFixed(2)} s, Landung ${(ld / FPS).toFixed(2)} s`);
      } else {
        info = { loop: false };
      }
    }
    built[spec.name] = { frames, info };
  }
  // Kodieren
  const out = {
    format: 'aetherfront-mocap-1', fps: FPS, joints: tgt.order,
    source: 'CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu (BVH: cgspeed / una-dinosauria/cmu-mocap)',
    canon: { hipsY: +tgt.rest.hips.y.toFixed(4), ankleY: +tgt.rest.footL.y.toFixed(4), rest: Object.fromEntries(tgt.order.map((n) => [n, tgt.rest[n].toArray().map((x) => +x.toFixed(4))])), parent: tgt.parent },
    clips: {},
  };
  for (const spec of CLIPS) {
    const { frames, info } = built[spec.name];
    const enc = L.encodeClip(tgt, frames);
    const c = {
      n: frames.length, loop: !!info.loop, src: spec.file || built[spec.from] && (CLIPS.find((x) => x.name === spec.from).file), desc: spec.desc,
      q: Buffer.from(enc.q.buffer).toString('base64'), h: Buffer.from(enc.h.buffer).toString('base64'),
    };
    if (info.vel) { c.speed = +info.vel.length().toFixed(4); c.dir = [+(info.vel.x / (c.speed || 1)).toFixed(3), +(info.vel.z / (c.speed || 1)).toFixed(3)]; }
    if (info.omega) c.omega = +info.omega.toFixed(4);
    if (info.markers) c.markers = Object.fromEntries(Object.entries(info.markers).map(([k, v]) => [k, +v.toFixed(4)]));
    if (info.loop && info.vel && info.vel.length() > 0.05) c.contacts = contactsCompact(tgt, frames, info.vel);
    out.clips[spec.name] = c;
  }
  return { out, built, tgt };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('Mocap-Import (CMU) → ' + path.relative(ROOT, OUT));
  const { out } = await buildClips();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const txt = JSON.stringify(out);
  fs.writeFileSync(OUT, txt);
  console.log(`✔ ${Object.keys(out.clips).length} Clips, ${(txt.length / 1024).toFixed(1)} KB`);
}
