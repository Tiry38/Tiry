// Aetherfront – prozedurale Vertex-Animation für instanzierte Einheiten (Gegner/Vasallen).
// Jeder Modell-Vertex erhält beim Bau ein Attribut aRig (vec4):
//   x = Klasse + 0.9·Gewicht  (0 keine Verformung, 1 Bein, 2 Arm, 3 Kopf, 4 Flügel, 5 Welle/Schwanz, 6 Oberkörper,
//                              7 Vorderleib/Biss (Vierbeiner), 8 Waffenarm, 9 Spinnen-/Käferbein)
//   y = Phasenversatz (rad)   bzw. bei Flügeln: Drehpunkt x
//   z = Drehpunkt y           bzw. bei Wellen: Amplitude
//   w = Drehpunkt z           bzw. bei Wellen: Wellenzahl
// Pro Instanz: aAnim (vec4) = Laufphase (rad), Laufstärke 0..1, Angriffs-Fortschritt 0..1 (Treffer bei ≈0.45), Treffer-Zucken 0..0.95.
// Ohne aRig (Standardwert 0) bzw. ohne aAnim (Laufstärke/Angriff 0) bleibt das Modell unverformt.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Körperbau je Archetyp
const TYPES = {
  biped: ['knight', 'paladin_heavy', 'archer', 'priest', 'druid', 'witch', 'voidmage', 'knightfallen', 'king', 'brute', 'bonethrower', 'cryptgolem', 'automaton', 'golem', 'elemental', 'boss_titan', 'boss_lord', 'treant', 'mushroom', 'shade', 'imp'],
  quad: ['wolf', 'bear', 'hound', 'griffin', 'raptor'],
  multi: ['beetle', 'crawler', 'spider', 'walker'],
  serpent: ['serpent'], // Naga: Oberkörper wie Biped, Schwanz als Welle
  drake: ['boss_drake'],
};
const ROBED = new Set(['priest', 'druid', 'witch', 'voidmage', 'shade']);
const WINGED = new Set(['griffin', 'imp', 'boss_drake']);
const NOLEGS = new Set(['shade']);
export function rigType(arch) {
  for (const [k, list] of Object.entries(TYPES)) if (list.includes(arch)) return k;
  return 'none';
}

/**
 * aRig-Attribut für eine Modell-Geometrie (Modellraum: Füße y=0, Blick +Z) berechnen.
 * ref: Körpergeometrie für Maße; counts: Vertexanzahl je Bauteil (in Zusammenfüge-Reihenfolge) → starre Teile
 * (Waffe, Unterarm, Bein, Flügel) bewegen sich als Ganzes, große mittige Teile (Rumpf, Robe) werden je Vertex gewichtet.
 */
export function addUnitRig(arch, geo, ref = geo, counts = null) {
  const type = rigType(arch);
  const pos = geo.attributes.position, n = pos.count;
  const rig = new Float32Array(n * 4);
  geo.setAttribute('aRig', new THREE.BufferAttribute(rig, 4));
  if (type === 'none') return geo;
  ref.computeBoundingBox();
  const bb = ref.boundingBox, H = Math.max(0.1, bb.max.y - Math.max(0, bb.min.y)), zmin = bb.min.z, zmax = bb.max.z, zc = (zmin + zmax) / 2, L = Math.max(0.1, zmax - zmin);
  const rp = ref.attributes.position, xs = [];
  for (let i = 0; i < rp.count; i += 3) { const y = rp.getY(i); if (y > 0.55 * H && y < 0.75 * H) xs.push(Math.abs(rp.getX(i))); }
  xs.sort((a, b) => a - b);
  const torsoX = xs.length ? xs[Math.floor(xs.length * 0.55)] : 0.2 * H;
  const maxX = xs.length ? xs[xs.length - 1] : 0.3 * H;
  const winged = WINGED.has(arch), wingX = torsoX * 1.25;
  const hipY = (type === 'serpent' ? 0.42 : 0.46) * H, shY = 0.76 * H, neckY = 0.84 * H, armX = Math.max(torsoX * 1.05, 0.62 * maxX);
  const bipedLike = type === 'biped' || type === 'serpent';
  // Klassifizierung eines Punktes → [Klasse, Gewicht, a, b, c]; rigid: Teil wird als Ganzes bewegt
  const classify = (x, y, z, rigid, crosses) => {
    const ax = Math.abs(x), side = x >= 0 ? 1 : -1;
    if (winged && !crosses && ax > wingX && y > 0.4 * H) return [4, rigid ? 1 : smooth(wingX, wingX + 0.12 * H, ax), side * wingX, type === 'drake' ? 0.55 * H : 0.62 * H, 0];
    if (bipedLike) {
      if (type === 'serpent' && y < hipY) return [5, smooth(hipY, hipY - 0.15 * H, y), 0, 0.07 * H, 3 / H];
      if (!NOLEGS.has(arch) && y < hipY + 0.03 * H && (ax > 0.02 * H || crosses)) {
        const robe = ROBED.has(arch) || crosses;
        return [1, (rigid ? 1 : smooth(hipY + 0.03 * H, hipY - 0.12 * H, y)) * (robe ? 0.4 : 1), side > 0 ? 0 : Math.PI, hipY, z];
      }
      if (!crosses && ax > armX && y > 0.25 * H) return [side < 0 ? 8 : 2, rigid ? 1 : smooth(armX, armX + 0.05 * H, ax), side > 0 ? Math.PI : 0, shY, 0];
      if (y > neckY) return [3, rigid ? 1 : smooth(neckY, neckY + 0.05 * H, y), 0, neckY, 0];
      return [6, smooth(hipY, hipY + 0.12 * H, y), 0, hipY, 0];
    }
    if (type === 'quad' || type === 'drake') {
      const legY = (arch === 'raptor' ? 0.52 : type === 'drake' ? 0.35 : 0.42) * H;
      const front = z > zc;
      const off = (side > 0 ? 0 : Math.PI) + (arch === 'raptor' ? 0 : front ? 0 : Math.PI);
      if (y < legY && ax > 0.02 * H && !crosses) return [1, rigid ? 1 : smooth(legY, legY - 0.12 * H, y), off, legY, z];
      if (z > zc + 0.28 * L && y > 0.3 * H) return [7, rigid ? 1 : smooth(zc + 0.28 * L, zc + 0.42 * L, z), 0, 0.6 * H, zc + 0.22 * L];
      if (z < zmin + 0.3 * L) return [5, smooth(zmin + 0.3 * L, zmin + 0.05 * L, z), 0, 0.08 * L, 6 / L];
      return [6, 0.4, 0, legY, zc];
    }
    if (type === 'multi') {
      const legX = torsoX * 0.9;
      if (!crosses && ax > legX && y < 0.6 * H) { const idx = z > zc + 0.15 * L ? 0 : z < zc - 0.15 * L ? 2 : 1; return [9, 1, (side > 0 ? 0 : Math.PI) + idx * Math.PI, side * legX, z]; }
      if (z > zc + 0.3 * L && y > 0.2 * H) return [7, rigid ? 1 : smooth(zc + 0.3 * L, zc + 0.45 * L, z), 0, 0.5 * H, zc + 0.2 * L];
      return [6, 0.3, 0, 0.3 * H, zc];
    }
    return [0, 0, 0, 0, 0];
  };
  // Glüh-Geometrie: Rig vom nächstgelegenen Körper-Vertex übernehmen (Glühteile hängen immer an einem Körperteil)
  if (ref !== geo && ref.attributes.aRig) {
    const RR = ref.attributes.aRig.array, rpos = ref.attributes.position;
    const ranges0 = counts && counts.reduce((a, c) => a + c, 0) === n ? counts : [n];
    let o0 = 0;
    for (const cnt of ranges0) {
      let cx = 0, cy = 0, cz = 0;
      for (let i = o0; i < o0 + cnt; i++) { cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
      cx /= cnt; cy /= cnt; cz /= cnt;
      let best = Infinity, bi = 0;
      for (let j = 0; j < rpos.count; j += 2) { const dx = rpos.getX(j) - cx, dy = rpos.getY(j) - cy, dz = rpos.getZ(j) - cz, d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bi = j; } }
      for (let i = o0; i < o0 + cnt; i++) for (let k = 0; k < 4; k++) rig[i * 4 + k] = RR[bi * 4 + k];
      o0 += cnt;
    }
    return geo;
  }
  const set = (i, r) => { rig[i * 4] = r[0] + 0.9 * Math.min(1, Math.max(0, r[1])); rig[i * 4 + 1] = r[2]; rig[i * 4 + 2] = r[3]; rig[i * 4 + 3] = r[4]; };
  const ranges = counts && counts.reduce((a, c) => a + c, 0) === n ? counts : [n];
  let o = 0;
  for (const cnt of ranges) {
    let cx = 0, cy = 0, cz = 0, minx = Infinity, maxx = -Infinity, miny = Infinity;
    for (let i = o; i < o + cnt; i++) { const x = pos.getX(i); cx += x; cy += pos.getY(i); cz += pos.getZ(i); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, pos.getY(i)); }
    cx /= cnt; cy /= cnt; cz /= cnt;
    const crosses = minx < -0.04 * H && maxx > 0.04 * H;
    const big = counts && ranges.length > 1 ? false : true;
    let rc = classify(cx, cy, cz, true, crosses);
    if (bipedLike && !crosses && Math.abs(cx) > torsoX * 0.75 && rc[0] !== 2 && rc[0] !== 8) {
      let miny2 = Infinity, maxy2 = -Infinity; for (let i = o; i < o + cnt; i += 3) { const y = pos.getY(i); miny2 = Math.min(miny2, y); maxy2 = Math.max(maxy2, y); }
      if (maxy2 - miny2 > 0.4 * H) rc = [cx < 0 ? 8 : 2, 1, cx > 0 ? Math.PI : 0, shY, 0];
    }
    const rigidCls = !big && !crosses && [1, 2, 3, 4, 7, 8, 9].includes(rc[0]);
    if (rigidCls) {
      if (rc[0] === 9) {
        // Spinnen-/Käferbein: Drehpunkt = Wurzel (Vertex mit kleinstem |x|)
        let best = Infinity, bx = 0, bz = 0;
        for (let i = o; i < o + cnt; i++) { const ax = Math.abs(pos.getX(i)); if (ax < best) { best = ax; bx = pos.getX(i); bz = pos.getZ(i); } }
        rc[3] = bx; rc[4] = bz;
      }
      if (rc[0] === 1) rc[4] = cz;
      for (let i = o; i < o + cnt; i++) set(i, rc);
    } else {
      for (let i = o; i < o + cnt; i++) set(i, classify(pos.getX(i), pos.getY(i), pos.getZ(i), false, crosses || big));
    }
    o += cnt;
  }
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Shader-Einbindung (für MeshStandardMaterial / MeshBasicMaterial / MeshDepthMaterial)
// ---------------------------------------------------------------------------------------------
const GLSL = /* glsl */`
attribute vec4 aRig;
attribute vec4 aAnim;
vec3 afRotX(vec3 p, vec2 piv, float a) { float c = cos(a), s = sin(a); vec2 q = p.yz - piv; return vec3(p.x, piv.x + q.x * c - q.y * s, piv.y + q.x * s + q.y * c); }
vec3 afRotY(vec3 p, float pz, float a) { float c = cos(a), s = sin(a); vec2 q = vec2(p.x, p.z - pz); return vec3(q.x * c + q.y * s, p.y, pz - q.x * s + q.y * c); }
vec3 afRotZ(vec3 p, vec2 piv, float a) { float c = cos(a), s = sin(a); vec2 q = p.xy - piv; return vec3(piv.x + q.x * c - q.y * s, piv.y + q.x * s + q.y * c, p.z); }
void afAnim(inout vec3 p, inout vec3 n) {
  float cls = floor(aRig.x + 1e-4);
  if (cls < 0.5 || abs(aAnim.x) + aAnim.y + aAnim.z < 1e-5) return;
  float w = clamp(fract(aRig.x + 1e-4) / 0.9, 0.0, 1.0);
  float ph = aAnim.x, walk = clamp(aAnim.y, 0.0, 1.0), atk = clamp(abs(aAnim.z), 0.0, 1.0);
  float ranged = aAnim.z < 0.0 ? 1.0 : 0.0;   // negativ = Fernkampf (Spannen/Werfen statt Hieb)
  float hit = aAnim.w < 0.999 ? aAnim.w : 0.0;
  float wind = smoothstep(0.02, 0.36, atk) * (1.0 - smoothstep(0.36, 0.5, atk));
  float strike = smoothstep(0.34, 0.47, atk) * (1.0 - smoothstep(0.6, 1.0, atk));
  vec3 q = p, m = n;
  float hipY = aRig.z;
  if (cls < 1.5) {                       // Bein: Pendeln (Scherung um Hüfthöhe), beim Aufsetzen leicht angehoben
    float a = walk * 0.62 * sin(ph + aRig.y) * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), -a); m = afRotX(m, vec2(0.0), -a);
    q.y += max(0.0, -cos(ph + aRig.y)) * walk * 0.05 * w * max(0.0, aRig.z - q.y) / max(0.05, aRig.z);
  } else if (cls < 2.5 || (cls > 7.5 && cls < 8.5)) { // Arme
    float a = -walk * 0.5 * sin(ph + aRig.y) * w;
    float draw = smoothstep(0.02, 0.4, atk) * (1.0 - smoothstep(0.45, 0.8, atk));
    if (ranged > 0.5) a += (cls > 7.5 ? -1.25 : -1.45) * draw * w;
    else if (cls > 7.5) a += (-2.3 * wind - 0.75 * strike) * w;
    else a += -0.5 * wind * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), a); m = afRotX(m, vec2(0.0), a);
  } else if (cls < 3.5) {               // Kopf: Wippen + Zucken
    float a = (0.07 * walk * sin(ph * 2.0) - 0.3 * hit + 0.12 * strike) * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), a); m = afRotX(m, vec2(0.0), a);
  } else if (cls < 4.5) {               // Flügel: Schlagen um die Körperlängsachse
    float sd = sign(aRig.y);
    float a = sd * (0.32 + 0.22 * walk) * sin(ph * 1.6) * w - sd * 0.2 * hit;
    q = afRotZ(q, vec2(aRig.y, aRig.z), a); m = afRotZ(m, vec2(0.0), a);
  } else if (cls < 5.5) {               // Welle / Schwanz
    float k = aRig.w, amp = aRig.z;
    float o = sin(ph * 0.7 + q.z * k * 6.2832) * amp * (0.35 + 0.65 * walk) * w + 0.6 * amp * strike * w;
    q.x += o;
  } else if (cls < 6.5) {               // Oberkörper (Biped) / Rumpf
    float rk = 1.0 - 0.8 * ranged;
    float a = (0.2 * strike * rk - 0.12 * wind * rk - 0.25 * hit) * w;
    float tw = (-0.38 * wind + 0.32 * strike) * rk * w;
    q = afRotY(q, 0.0, tw); m = afRotY(m, 0.0, tw);
    q = afRotX(q, vec2(hipY, 0.0), a); m = afRotX(m, vec2(0.0), a);
  } else if (cls < 7.5) {               // Vorderleib/Kopf (Biss)
    float a = (0.6 * strike - 0.35 * wind - 0.3 * hit + 0.06 * walk * sin(ph * 2.0)) * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), a); m = afRotX(m, vec2(0.0), a);
  } else {                              // Spinnen-/Käferbein: Fegen um die Hochachse an der Beinwurzel + Heben
    float a = walk * 0.6 * sin(ph + aRig.y) * w * sign(aRig.z);
    float c = cos(a), sn = sin(a);
    vec2 r = vec2(q.x - aRig.z, q.z - aRig.w);
    q.x = aRig.z + r.x * c + r.y * sn; q.z = aRig.w - r.x * sn + r.y * c;
    m = vec3(m.x * c + m.z * sn, m.y, -m.x * sn + m.z * c);
    q.y += max(0.0, cos(ph + aRig.y)) * walk * 0.25 * w * abs(r.x);
    float b = (0.25 * strike - 0.15 * wind - 0.15 * hit) * w;
    q.y += b * abs(r.x) * 0.3;
  }
  // Arme und Kopf folgen dem Oberkörper (Biped)
  if ((cls > 1.5 && cls < 3.5) || (cls > 7.5 && cls < 8.5)) {
    float rk = 1.0 - 0.8 * ranged;
    float a = (0.2 * strike - 0.12 * wind) * rk - 0.25 * hit;
    float tw = (-0.38 * wind + 0.32 * strike) * rk;
    q = afRotY(q, 0.0, tw); m = afRotY(m, 0.0, tw);
    q = afRotX(q, vec2(aRig.z * 0.6, 0.0), a); m = afRotX(m, vec2(0.0), a);
  }
  p = q; n = m;
}
`;
/** In onBeforeCompile eines Materials einhängen */
export function injectUnitAnim(sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL);
  // Normale (falls vorhanden) und Position getrennt verformen – robust auch in #ifdef-Blöcken
  sh.vertexShader = sh.vertexShader
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\t{ vec3 afP0 = position; afAnim(afP0, objectNormal); }')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\t{ vec3 afN0 = vec3(0.0, 1.0, 0.0); afAnim(transformed, afN0); }');
}
/** Tiefenmaterial für Schatten, das dieselbe Verformung anwendet */
export function createUnitDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => injectUnitAnim(sh);
  m.customProgramCacheKey = () => 'af-unit-depth-v1';
  return m;
}

/**
 * Animationszustand einer Instanz setzen. mesh: InstancedMesh (Geometrie mit aRig).
 * phase: Laufphase in rad (läuft beim Gehen weiter), walk 0..1, attack 0..1 (Treffer ≈0.45; negativ −0..−1 = Fernkampf:
 * Bogen spannen/werfen statt Hieb), hit 0..1.
 */
export function setInstanceAnim(mesh, index, phase, walk, attack, hit) {
  const g = mesh.geometry;
  let a = g.attributes.aAnim;
  const cap = mesh.instanceMatrix.count;
  if (!a || a.count < cap) {
    const arr = new Float32Array(cap * 4);
    if (a) arr.set(a.array.subarray(0, Math.min(a.array.length, arr.length)));
    a = new THREE.InstancedBufferAttribute(arr, 4);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAnim', a);
  }
  const o = index * 4;
  a.array[o] = phase % 6283.185; a.array[o + 1] = walk; a.array[o + 2] = attack; a.array[o + 3] = Math.min(0.95, Math.max(0, hit));
  a.needsUpdate = true;
}
