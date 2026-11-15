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
// Pro Instanz zusätzlich aFx (vec4): x Auflösen 0..1 (Tod), y Treffer-Blitz 0..1 (weiß → rot),
// z Wirk-Pose 0..1 (>0 = Zauberer: beide Arme heben, Glühen), w Modellhöhe in m (Maß für Wippen/Gelenke).
// Bewegungen: Laufen (Wippen, Hüftdrehung, Bein-Pendel mit Knie, Fuß heben in der Schwungphase, Arm-Pendel mit
// Ellbogen), Leerlauf (Atmen, Gewicht verlagern, Umschauen, gelegentlich Waffe schwingen – zeitversetzt über die
// Phase), Nahkampf (Ausholen über Kopf mit Ellbogen → Schlag-Bogen → Durchschwung), Fernkampf (Spannen),
// Zaubern (Arme nach vorn/oben, Stoß beim Auslösen), Treffer (Zurückzucken), Flügel/Schwanz/Insektenbeine.
// ---------------------------------------------------------------------------------------------
const GLSL = /* glsl */`
attribute vec4 aRig;
attribute vec4 aAnim;
attribute vec4 aFx;
varying vec4 vAfFx;
varying vec3 vAfP;
vec3 afRotX(vec3 p, vec2 piv, float a) { float c = cos(a), s = sin(a); vec2 q = p.yz - piv; return vec3(p.x, piv.x + q.x * c - q.y * s, piv.y + q.x * s + q.y * c); }
vec3 afRotY(vec3 p, float pz, float a) { float c = cos(a), s = sin(a); vec2 q = vec2(p.x, p.z - pz); return vec3(q.x * c + q.y * s, p.y, pz - q.x * s + q.y * c); }
vec3 afRotZ(vec3 p, vec2 piv, float a) { float c = cos(a), s = sin(a); vec2 q = p.xy - piv; return vec3(piv.x + q.x * c - q.y * s, piv.y + q.x * s + q.y * c, p.z); }
void afAnim(inout vec3 p, inout vec3 n) {
  vAfFx = aFx; vAfP = p;
  float cls = floor(aRig.x + 1e-4);
  if (cls < 0.5) return;
  float Hm = max(aFx.w, 0.4);
  float w = clamp(fract(aRig.x + 1e-4) / 0.9, 0.0, 1.0);
  float ph = aAnim.x, walk = clamp(aAnim.y, 0.0, 1.0), atk = clamp(abs(aAnim.z), 0.0, 1.0);
  float caster = step(0.0005, aFx.z);
  float ranged = aAnim.z < 0.0 ? 1.0 - caster : 0.0;   // negativ = Fernkampf (Spannen/Werfen statt Hieb)
  float melee = (1.0 - ranged) * (1.0 - caster);
  float hit = aAnim.w < 0.999 ? aAnim.w : 0.0;
  // Hüllkurven: Ausholen bis 0.42, Schlag-Moment 0.45 (= Schaden in der Simulation), Durchschwung danach
  float wind = smoothstep(0.02, 0.4, atk) * (1.0 - smoothstep(0.41, 0.47, atk));
  float strike = smoothstep(0.4, 0.46, atk) * (1.0 - smoothstep(0.52, 0.8, atk));
  float follow = smoothstep(0.46, 0.6, atk) * (1.0 - smoothstep(0.65, 1.0, atk));
  float raise = caster * clamp(aFx.z, 0.0, 1.0);
  float push = caster * strike;
  float act = max(max(wind, strike), max(hit, raise));
  float idle = (1.0 - walk) * (1.0 - act);
  float breath = sin(ph * 1.1);
  float fidget = pow(max(0.0, sin(ph * 0.19 + 1.3)), 12.0);   // gelegentlich (≈ alle 15 s, je Einheit versetzt)
  float look = sin(ph * 0.33) * smoothstep(0.2, 0.9, sin(ph * 0.11 + 0.7));
  vec3 q = p, m = n;
  float hipY = aRig.z;
  if (cls < 1.5) {                       // Bein: Knie (Unterschenkel) + Hüfte (ganzes Bein), Fuß heben in der Schwungphase
    float lp = ph + aRig.y;
    float swing = max(0.0, cos(lp)) * walk;
    float kneeY = hipY * 0.5;
    float kw = smoothstep(kneeY + 0.05 * Hm, kneeY - 0.06 * Hm, q.y) * w;
    float kb = (0.95 * swing + 0.12 * walk + idle * 0.16 * (0.5 + 0.5 * sin(ph * 0.45 + aRig.y)) + 0.25 * hit) * kw;
    q = afRotX(q, vec2(kneeY, aRig.w), kb); m = afRotX(m, vec2(0.0), kb);
    float a = (walk * 0.58 * sin(lp) + melee * 0.18 * strike * cos(aRig.y)) * w;
    q = afRotX(q, vec2(hipY, aRig.w), -a); m = afRotX(m, vec2(0.0), -a);
    q.y += swing * 0.05 * Hm * w * clamp((hipY - p.y) / max(0.05, hipY), 0.0, 1.0);
  } else if (cls < 2.5 || (cls > 7.5 && cls < 8.5)) { // Arme (8 = Waffenarm)
    float wpn = step(7.5, cls);
    vec2 sp = vec2(aRig.z, aRig.w);
    vec2 d = q.yz - sp; float r = length(d);
    float el = smoothstep(0.1 * Hm, 0.17 * Hm, r);
    vec2 ep = sp + d / max(r, 1e-4) * min(r, 0.14 * Hm);
    float sa = -walk * 0.55 * sin(ph + aRig.y);
    float ea = -walk * (0.2 + 0.25 * max(0.0, sin(ph + aRig.y)));
    sa += idle * (0.05 * breath - wpn * 0.55 * fidget) + 0.35 * hit;
    ea += idle * (-0.12 - wpn * 0.9 * fidget) - 0.3 * hit;
    if (caster > 0.5) {                  // Wirken: Arme nach vorn/oben, beim Auslösen nach vorn stoßen
      sa += -1.55 * raise + 0.45 * push * (1.0 - raise) - 0.6 * push;
      ea += -0.55 * raise + 0.45 * push;
    } else if (ranged > 0.5) {           // Bogen/Wurf: Spannen (beide Arme hoch), Lösen
      float draw = smoothstep(0.02, 0.4, atk) * (1.0 - smoothstep(0.45, 0.75, atk));
      sa += (wpn > 0.5 ? -1.25 : -1.45) * draw;
      ea += (wpn > 0.5 ? -0.9 : 0.0) * draw + 0.3 * strike;
    } else if (wpn > 0.5) {              // Hieb: Ausholen über den Kopf, Waffe hinter dem Kopf → Schlag-Bogen → Durchschwung
      sa += -2.5 * wind - 0.3 * strike + 0.35 * follow;
      ea += -1.25 * wind + 0.2 * strike + 0.1 * follow;
    } else {                             // Schildarm: vorhalten
      sa += -0.7 * wind - 0.45 * strike - 0.2 * follow;
      ea += -0.5 * wind - 0.3 * strike;
    }
    q = afRotX(q, ep, ea * el * w); m = afRotX(m, vec2(0.0), ea * el * w);
    q = afRotX(q, sp, sa * w); m = afRotX(m, vec2(0.0), sa * w);
  } else if (cls < 3.5) {               // Kopf: Wippen, Umschauen, Zucken
    float a = (0.07 * walk * sin(ph * 2.0) - 0.35 * hit + 0.15 * strike * melee - 0.18 * raise + 0.04 * idle * breath) * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), a); m = afRotX(m, vec2(0.0), a);
    float y = (0.45 * idle * look) * w;
    q = afRotY(q, aRig.w, y); m = afRotY(m, 0.0, y);
  } else if (cls < 4.5) {               // Flügel: Schlagen um die Körperlängsachse, Abschlag beim Angriff
    float sd = sign(aRig.y);
    float a = sd * ((0.42 + 0.2 * walk) * sin(ph * 1.7) + 0.55 * strike - 0.4 * wind - 0.3 * hit) * w;
    q = afRotZ(q, vec2(aRig.y, aRig.z), a); m = afRotZ(m, vec2(0.0), a);
  } else if (cls < 5.5) {               // Welle / Schwanz
    float k = aRig.w, amp = aRig.z;
    float o = sin(ph * 0.8 + q.z * k * 6.2832) * amp * (0.45 + 0.75 * walk) * w + 0.7 * amp * (strike - 0.5 * wind) * w;
    q.x += o;
  } else if (cls < 6.5) {               // Oberkörper (Biped) / Rumpf
    float a = (0.24 * strike * melee - 0.16 * wind * melee - 0.3 * hit - 0.1 * raise + 0.14 * push + 0.08 * walk + 0.03 * walk * sin(ph * 2.0)) * w;
    float tw = ((-0.42 * wind + 0.38 * strike) * melee + 0.09 * walk * sin(ph)) * w;
    q = afRotY(q, aRig.w, tw); m = afRotY(m, 0.0, tw);
    q = afRotX(q, vec2(hipY, aRig.w), a); m = afRotX(m, vec2(0.0), a);
  } else if (cls < 7.5) {               // Vorderleib/Kopf (Biss) bzw. Geschützrohr
    float a = (0.65 * strike - 0.4 * wind - 0.32 * hit + 0.06 * walk * sin(ph * 2.0) + 0.06 * idle * sin(ph * 0.8)) * w;
    q = afRotX(q, vec2(aRig.z, aRig.w), a); m = afRotX(m, vec2(0.0), a);
    float y = 0.3 * idle * look * w;
    q = afRotY(q, aRig.w, y); m = afRotY(m, 0.0, y);
  } else {                              // Spinnen-/Käferbein: Fegen um die Hochachse an der Beinwurzel + Heben
    float a = walk * 0.6 * sin(ph + aRig.y) * w * sign(aRig.z);
    float c = cos(a), sn = sin(a);
    vec2 r = vec2(q.x - aRig.z, q.z - aRig.w);
    q.x = aRig.z + r.x * c + r.y * sn; q.z = aRig.w - r.x * sn + r.y * c;
    m = vec3(m.x * c + m.z * sn, m.y, -m.x * sn + m.z * c);
    q.y += max(0.0, cos(ph + aRig.y)) * walk * 0.28 * w * abs(r.x);
    float b = (0.3 * strike - 0.2 * wind - 0.2 * hit + 0.05 * idle * sin(ph * 0.9 + aRig.y)) * w;
    q.y += b * abs(r.x) * 0.3;
  }
  // Arme und Kopf folgen dem Oberkörper (Biped)
  if ((cls > 1.5 && cls < 3.5) || (cls > 7.5 && cls < 8.5)) {
    float a = (0.24 * strike - 0.16 * wind) * melee - 0.3 * hit - 0.1 * raise + 0.14 * push + 0.08 * walk;
    float tw = (-0.42 * wind + 0.38 * strike) * melee + 0.09 * walk * sin(ph);
    q = afRotY(q, 0.0, tw); m = afRotY(m, 0.0, tw);
    q = afRotX(q, vec2(aRig.z * 0.6, 0.0), a); m = afRotX(m, vec2(0.0), a);
  }
  // Ganzer Körper: Wippen beim Laufen (Füße bleiben am Boden), Atmen (Brustkorb weitet sich, Schultern heben)
  float up = clamp(p.y / (0.45 * Hm), 0.0, 1.0);
  q.y += walk * 0.04 * Hm * (0.5 + 0.5 * cos(2.0 * ph)) * up;
  float chest = smoothstep(0.45 * Hm, 0.7 * Hm, p.y) * (1.0 - smoothstep(0.82 * Hm, 0.95 * Hm, p.y));
  float br = breath * (0.35 + 0.65 * idle);
  q.xz *= 1.0 + 0.022 * br * chest * step(cls, 6.5) * step(5.5, cls);
  q.y += 0.012 * Hm * br * smoothstep(0.55 * Hm, 0.8 * Hm, p.y);
  p = q; n = m;
}
`;
// Fragment: Auflösen (Rauschen von oben nach unten, glühende Kante), Treffer-Blitz (weiß → rot), Wirk-Glühen
const FRAG_HEAD = /* glsl */`
varying vec4 vAfFx;
varying vec3 vAfP;
float afdHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float afdNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(afdHash(i), afdHash(i + vec3(1,0,0)), u.x), mix(afdHash(i + vec3(0,1,0)), afdHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(afdHash(i + vec3(0,0,1)), afdHash(i + vec3(1,0,1)), u.x), mix(afdHash(i + vec3(0,1,1)), afdHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float afDissolveN() {
  float H = max(vAfFx.w, 0.4);
  float n = afdNoise(vAfP * (5.5 / H) + 3.1) * 0.65 + afdNoise(vAfP * (14.0 / H)) * 0.35;
  return n * 0.72 + 0.28 * (1.0 - clamp(vAfP.y / H, 0.0, 1.0));
}
`;
const FRAG_DISCARD = /* glsl */`
	if ( vAfFx.x > 0.001 && afDissolveN() < vAfFx.x * 1.12 - 0.04 ) discard;`;
const FRAG_COLOR = (glow) => /* glsl */`
	{
		float afF = clamp( vAfFx.y, 0.0, 1.0 );
		vec3 afFlash = mix( vec3( 1.0, 0.18, 0.1 ), vec3( 1.2 ), smoothstep( 0.55, 0.9, afF ) );
		outgoingLight = mix( outgoingLight, afFlash * ${glow ? '3.0' : '1.4'}, afF * ${glow ? '0.45' : '0.6'} );
		if ( vAfFx.x > 0.001 ) {
			float afE = 1.0 - smoothstep( 0.0, 0.07, afDissolveN() - ( vAfFx.x * 1.12 - 0.04 ) );
			outgoingLight = mix( outgoingLight * ( 1.0 - 0.6 * vAfFx.x ), vec3( 2.6, 0.75, 0.16 ) * ${glow ? '2.0' : '1.0'}, afE );
		}
${glow ? '\t\toutgoingLight *= 1.0 + 3.0 * clamp( vAfFx.z, 0.0, 1.0 );\n' : ''}	}`;
function inject(sh, glow, depth) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL);
  // Normale (falls vorhanden) und Position getrennt verformen – robust auch in #ifdef-Blöcken
  sh.vertexShader = sh.vertexShader
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\t{ vec3 afP0 = position; afAnim(afP0, objectNormal); }')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\t{ vec3 afN0 = vec3(0.0, 1.0, 0.0); afAnim(transformed, afN0); vAfP = position; }');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_DISCARD);
  if (!depth) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', FRAG_COLOR(glow) + '\n#include <opaque_fragment>');
}
/** In onBeforeCompile eines Materials einhängen (Körper) */
export function injectUnitAnim(sh) { inject(sh, false, false); }
/** … für die Glüh-Ebene (Wirk-Glühen verstärkt) */
export function injectUnitAnimGlow(sh) { inject(sh, true, false); }
/** Tiefenmaterial für Schatten, das dieselbe Verformung (und das Auflösen) anwendet */
export function createUnitDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => inject(sh, false, true);
  m.customProgramCacheKey = () => 'af-unit-depth-v2';
  return m;
}

function instAttr(mesh, name) {
  const g = mesh.geometry;
  let a = g.attributes[name];
  const cap = mesh.instanceMatrix.count;
  if (!a || a.count < cap) {
    const arr = new Float32Array(cap * 4);
    if (a) arr.set(a.array.subarray(0, Math.min(a.array.length, arr.length)));
    a = new THREE.InstancedBufferAttribute(arr, 4);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, a);
  }
  a.needsUpdate = true;
  return a.array;
}
/**
 * Animationszustand einer Instanz setzen. mesh: InstancedMesh (Geometrie mit aRig).
 * phase: Lauf-/Leerlaufphase in rad (läuft immer weiter, je Einheit versetzt), walk 0..1, attack 0..1 (Schlag-Moment
 * ≈0.45; negativ −0..−1 = Fernkampf: Bogen spannen/werfen statt Hieb), hit 0..1.
 * fx (optional): [Auflösen 0..1, Treffer-Blitz 0..1, Wirk-Pose 0..1 (>0 = Zauberer), Modellhöhe m]
 */
export function setInstanceAnim(mesh, index, phase, walk, attack, hit, fx) {
  const a = instAttr(mesh, 'aAnim'), o = index * 4;
  a[o] = phase % 6283.185; a[o + 1] = walk; a[o + 2] = attack; a[o + 3] = Math.min(0.95, Math.max(0, hit));
  const f = instAttr(mesh, 'aFx');
  if (fx) { f[o] = fx[0]; f[o + 1] = fx[1]; f[o + 2] = fx[2]; f[o + 3] = fx[3]; } else { f[o] = 0; f[o + 1] = 0; f[o + 2] = 0; f[o + 3] = 2; }
}
