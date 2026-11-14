// Gemeinsame Shader-Bausteine: Himmelsfarbe (biom-/HDRI-gesteuert), Luftperspektive, Rauschen, Material-Patches
// (PBR-Triplanar-Gelände mit Höhenmischung, behauener Stein, Rinde, Laub, Gras mit Distanz-Ausblendung).
import * as THREE from 'three';

// Von allen Umgebungs-Shadern geteilte Uniform-Objekte (eine Aktualisierung wirkt überall, z. B. setBiome).
export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.6, 0.18, -0.78).normalize() }, // sichtbare Sonne
    uLightDir: { value: new THREE.Vector3(0.5, 0.6, -0.6).normalize() }, // Lichtrichtung (Schatten)
    uSunColor: { value: new THREE.Color(1.0, 0.82, 0.60) },
    uFogDensity: { value: 0.0013 },
    uHeightFog: { value: 1.0 },
    // Himmel/Dunst (linear, HDR) – aus dem HDRI gemessen oder Biom-Vorgabe
    uSkyZen: { value: new THREE.Color(0.030, 0.095, 0.34) },
    uSkyMid: { value: new THREE.Color(0.070, 0.200, 0.56) },
    uSkyHorA: { value: new THREE.Color(0.30, 0.46, 0.74) },
    uSkyHorS: { value: new THREE.Color(0.95, 0.72, 0.50) },
    uSunGlow: { value: new THREE.Color(1.0, 0.72, 0.42) },
    uHazeTint: { value: new THREE.Color(1, 1, 1) },
    uCloudLit: { value: new THREE.Color(1.15, 1.12, 1.08) },
    uCloudShade: { value: new THREE.Color(0.12, 0.20, 0.36) },
    // Material-Tönung je Biom
    uFoliageTint: { value: new THREE.Color(1, 1, 1) },
    uGroundTint: { value: new THREE.Color(1, 1, 1) },
    uRockTint: { value: new THREE.Color(1, 1, 1) },
    uGrassFar: { value: 160 },
  };
}

/** Uniforms, die jeder Shader mit GLSL_SKY/GLSL_FOG braucht. */
export const skyU = (U) => ({
  uSunDir: U.uSunDir, uSkyZen: U.uSkyZen, uSkyMid: U.uSkyMid, uSkyHorA: U.uSkyHorA, uSkyHorS: U.uSkyHorS,
  uSunGlow: U.uSunGlow, uHazeTint: U.uHazeTint, uCloudLit: U.uCloudLit, uCloudShade: U.uCloudShade,
});

// Himmelsverlauf: Zenit → Mitte → Horizont (zur Sonne warm, gegenüber kühl), Mie-Schein um die Sonne.
// Die Farben kommen aus dem HDRI (gemessen) bzw. der Biom-Vorgabe, damit Dunst und Himmel zusammenpassen.
export const GLSL_SKY = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSkyZen, uSkyMid, uSkyHorA, uSkyHorS, uSunGlow, uHazeTint, uCloudLit, uCloudShade;
vec3 skyColor(vec3 d) {
  vec3 s = uSunDir;
  float y = d.y;
  float sd = dot(d, s);
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(s.xz + vec2(1e-5))) * 0.5 + 0.5;
  float warm = az * az * az;
  float yy = max(y, 0.0);
  vec3 hor = mix(uSkyHorA, uSkyHorS, warm);
  vec3 c = mix(hor, uSkyMid, pow(smoothstep(0.0, 0.42, yy), 0.75));
  c = mix(c, uSkyZen, smoothstep(0.35, 1.0, yy));
  c += hor * 0.22 * exp(-abs(y) * 24.0) * (0.35 + 0.65 * warm);
  vec3 below = hor * vec3(0.92, 0.94, 0.96);
  c = mix(c, below, smoothstep(0.0, -0.08, y));
  float g = max(sd, 0.0);
  c += uSunGlow * (pow(g, 8.0) * 0.22 + pow(g, 90.0) * 0.8);
  return c;
}
// Dunstfarbe für Luftperspektive: Horizontfarbe, zur Sonne hin wärmer
vec3 hazeColor(vec3 d) {
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(uSunDir.xz + vec2(1e-5))) * 0.5 + 0.5;
  float warm = az * az * az;
  vec3 c = mix(uSkyHorA, uSkyHorS, warm);
  float g = max(dot(normalize(vec3(d.x, max(d.y, 0.0) * 0.5, d.z)), uSunDir), 0.0);
  c += uSunGlow * pow(g, 10.0) * 0.2;
  return c * 0.8 * uHazeTint;
}
`;

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
`;

// Nebel: exponentiell (Luftperspektive) + Höhennebel unter den Inseln, Farbe richtungsabhängig.
export const GLSL_FOG = /* glsl */ `
uniform float uFogDensity;
uniform float uHeightFog;
vec3 applyHaze(vec3 col, vec3 worldPos) {
  vec3 v = worldPos - cameraPosition;
  float dist = length(v);
  vec3 d = v / max(dist, 1e-4);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  float hf = smoothstep(-22.0, -88.0, worldPos.y) * uHeightFog;
  f = clamp(max(f, hf * 0.55), 0.0, 1.0);
  vec3 hc = hazeColor(d);
  vec3 low = mix(hc, uSkyHorA * 0.62 * uHazeTint, 0.5);
  return mix(col, mix(hc, low, hf), f);
}
`;

// Ableitungsbasiertes Relief (wie three.js perturbNormalArb) für prozedurale Höhen ohne Tangenten.
const GLSL_BUMP = /* glsl */ `
vec3 aethBump(vec3 n, float h, float k) {
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad * k);
}
`;

// Triplanare Projektion (Whiteout-Normalenmischung nach Ben Golus), Weltkoordinaten.
const GLSL_TRI = /* glsl */ `
vec3 triW(vec3 n) { vec3 b = pow(abs(n), vec3(4.0)); return b / dot(b, vec3(1.0)); }
vec3 triTex(sampler2D t, vec3 p, vec3 bw, float s) {
  vec3 c = vec3(0.0);
  if (bw.x > 0.01) c += texture2D(t, p.zy * s).rgb * bw.x;
  if (bw.y > 0.01) c += texture2D(t, p.xz * s).rgb * bw.y;
  if (bw.z > 0.01) c += texture2D(t, p.xy * s).rgb * bw.z;
  return c;
}
vec3 triNrm(sampler2D t, vec3 p, vec3 wn, vec3 bw, float s, float k) {
  vec3 tx = vec3(0.0, 0.0, 1.0), ty = tx, tz = tx;
  if (bw.x > 0.01) tx = texture2D(t, p.zy * s).xyz * 2.0 - 1.0;
  if (bw.y > 0.01) ty = texture2D(t, p.xz * s).xyz * 2.0 - 1.0;
  if (bw.z > 0.01) tz = texture2D(t, p.xy * s).xyz * 2.0 - 1.0;
  tx.xy *= k; ty.xy *= k; tz.xy *= k;
  vec3 sg = sign(wn + 1e-5);
  tx.z *= sg.x; ty.z *= sg.y; tz.z *= sg.z;
  tx = vec3(tx.xy + wn.zy, abs(tx.z) * wn.x);
  ty = vec3(ty.xy + wn.xz, abs(ty.z) * wn.y);
  tz = vec3(tz.xy + wn.xy, abs(tz.z) * wn.z);
  return normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
}
// Aufsicht-Normale (nur xz-Projektion) im Weltraum
vec3 topNrm(sampler2D t, vec2 uv, vec3 wn, float k) {
  vec3 ty = texture2D(t, uv).xyz * 2.0 - 1.0;
  ty.xy *= k;
  ty = vec3(ty.xy + wn.xz, abs(ty.z) * wn.y);
  return normalize(ty.xzy);
}
float lum3(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Höhenbasierte Mischung zweier Schichten (h = Albedo-Helligkeit als Höhen-Ersatz)
float hblend(float mask, float hA, float hB, float sharp) { return clamp((mask - 0.5) * sharp + (hB - hA) * 1.6 + 0.5, 0.0, 1.0); }
`;

const NORMAL_BEGIN_NOFLIP = THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '');
const f2 = (v) => Number(v).toFixed(4);

/**
 * Patcht ein Standard-Material: eigener Richtungs-Dunst (statt scene.fog-Farbe), optional Wind (Gras/Bäume),
 * Vertex-Emission/Metall, prozedurales Detail, Gelände (PBR-Triplanar oder prozedural), behauener Stein, Laub, Rinde.
 *
 * terrain: { pbr: true, ground, soil, cliff, moss } (Asset-Sätze) oder prozedural { ground, groundN, rock, rockN, scale }
 * stone:   { set, moss, meters, mossAmount } – triplanarer PBR-Stein (Ruinen, Bordsteine, Felsen)
 * bark:    true (prozedural) oder { albedo, normal, meters }
 */
export function patchMaterial(material, U, opts = {}) {
  const {
    wind = 0, emissiveAttr = false, metalAttr = false, clampFar = false, extraFragment = '', detail = 0, bump = 0,
    terrain = null, stone = null, foliage = false, bark = false, grass = false, floor = false, far = false,
  } = opts;
  const pbrT = !!(terrain && terrain.pbr);
  const legacyStone = terrain && !terrain.pbr && !terrain.ground;
  const rs = (terrain && terrain.scale) || 14;
  const barkTex = bark && typeof bark === 'object' && bark.albedo ? bark : null;
  const key = [wind, emissiveAttr, metalAttr, clampFar, extraFragment.length, detail, bump, !!terrain, pbrT, legacyStone, rs,
    !!stone, stone?.moss ? 1 : 0, stone?.meters, foliage, !!bark, !!barkTex, grass, floor, far].join('-');
  material.customProgramCacheKey = () => `aeth3-${key}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: U.uTime, uLightDir: U.uLightDir, uSunColor: U.uSunColor, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog,
      uFoliageTint: U.uFoliageTint, uGroundTint: U.uGroundTint, uRockTint: U.uRockTint, uGrassFar: U.uGrassFar, ...skyU(U),
    });
    if (terrain && !pbrT) {
      Object.assign(shader.uniforms, {
        uGround: { value: terrain.ground || terrain.rock }, uGroundN: { value: terrain.groundN || terrain.rockN }, uRock: { value: terrain.rock }, uRockN: { value: terrain.rockN },
      });
    }
    if (pbrT) {
      Object.assign(shader.uniforms, {
        uGA: { value: terrain.ground.albedo }, uGN: { value: terrain.ground.normal },
        uSA: { value: (terrain.soil || terrain.ground).albedo }, uSN: { value: (terrain.soil || terrain.ground).normal },
        uCA: { value: terrain.cliff.albedo }, uCN: { value: terrain.cliff.normal },
        uMA: { value: (terrain.moss || terrain.cliff).albedo }, uMN: { value: (terrain.moss || terrain.cliff).normal },
        uGS: { value: 1 / terrain.ground.meters }, uSS: { value: 1 / (terrain.soil || terrain.ground).meters },
        uCS: { value: 1 / (terrain.cliff.meters * (far ? 2.6 : 1)) }, uMS: { value: 1 / (terrain.moss || terrain.cliff).meters },
      });
    }
    if (stone) {
      Object.assign(shader.uniforms, {
        uStA: { value: stone.set.albedo }, uStN: { value: stone.set.normal }, uStS: { value: 1 / (stone.meters || stone.set.meters) },
        uMA: { value: (stone.moss || stone.set).albedo }, uMS: { value: 1 / ((stone.moss || stone.set).meters) },
        uMossAmt: { value: stone.mossAmount ?? 0.5 },
      });
    }
    if (barkTex) {
      Object.assign(shader.uniforms, { uBA: { value: barkTex.albedo }, uBN: { value: barkTex.normal }, uBS: { value: 1 / barkTex.meters } });
    }
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    const worldN = !!terrain || !!stone;
    vs = vs.replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uGrassFar;
varying vec3 vHazeWorld;
${worldN ? 'varying vec3 vTerrN;' : ''}
${bark ? 'varying vec3 vBarkP; varying vec3 vBarkN;' : ''}
${grass ? 'varying float vBladeH;' : ''}
${emissiveAttr ? 'attribute vec3 emit; varying vec3 vEmit;' : ''}
${metalAttr ? 'attribute float metal; varying float vMetal;' : ''}
`);
    let windCode = '';
    if (wind === 1) {
      // Gras: Spitzen schwingen, Phase aus Instanzposition, Böen wandern übers Feld; in der Ferne flach ausblenden
      windCode = `
  #ifdef USE_INSTANCING
  vec3 ip = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  #else
  vec3 ip = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float hh = max(position.y, 0.0);
  float gust = 0.6 + 0.5 * sin(uTime * 0.6 + ip.x * 0.05 - ip.z * 0.04);
  float w = (sin(uTime * 1.7 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uTime * 2.9 + ip.x * 0.5 - ip.z * 0.4) * 0.25) * gust;
  transformed.x += w * 0.16 * hh * hh;
  transformed.z += w * 0.09 * hh * hh;
  float gfade = 1.0 - smoothstep(uGrassFar * 0.65, uGrassFar, distance(ip, cameraPosition));
  transformed.y *= gfade;
  transformed.xz *= mix(0.6, 1.0, gfade);`;
    } else if (wind === 2) {
      // Bäume: Krone wiegt leicht, Blätter flattern
      windCode = `
  #ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  #else
  vec3 ip = vec3(0.0);
  #endif
  float hh = max(position.y - 1.2, 0.0);
  float w = sin(uTime * 0.9 + ip.x * 0.13 + ip.z * 0.11) + 0.4 * sin(uTime * 2.1 + ip.z * 0.3);
  transformed.x += w * 0.03 * hh;
  transformed.z += w * 0.018 * hh;
  ${foliage ? 'transformed += normal * sin(uTime * 4.5 + dot(position, vec3(3.1, 2.3, 2.7)) + ip.x) * 0.035 * hh / (1.0 + hh * 0.2);' : ''}`;
    }
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
${windCode}
${emissiveAttr ? 'vEmit = emit;' : ''}
${metalAttr ? 'vMetal = metal;' : ''}
${bark ? 'vBarkP = position; vBarkN = normal;' : ''}
${grass ? 'vBladeH = position.y;' : ''}
`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 hw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    hw = instanceMatrix * hw;
    #endif
    vHazeWorld = (modelMatrix * hw).xyz;
    ${worldN ? `{
      vec3 on = objectNormal;
      #ifdef USE_INSTANCING
      on = mat3(instanceMatrix) * on;
      #endif
      vTerrN = normalize(mat3(modelMatrix) * on);
    }` : ''}
  }
  ${clampFar ? 'gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);' : ''}
`);
    fs = fs.replace('#include <common>', `#include <common>
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform vec3 uFoliageTint, uGroundTint, uRockTint;
varying vec3 vHazeWorld;
${worldN ? 'varying vec3 vTerrN;' : ''}
${terrain && !pbrT ? 'uniform sampler2D uGround, uGroundN, uRock, uRockN;' : ''}
${pbrT ? 'uniform sampler2D uGA, uGN, uSA, uSN, uCA, uCN, uMA, uMN; uniform float uGS, uSS, uCS, uMS;' : ''}
${stone ? 'uniform sampler2D uStA, uStN, uMA; uniform float uStS, uMS, uMossAmt;' : ''}
${barkTex ? 'uniform sampler2D uBA, uBN; uniform float uBS;' : ''}
${bark ? 'varying vec3 vBarkP; varying vec3 vBarkN;' : ''}
${grass ? 'varying float vBladeH;' : ''}
${emissiveAttr ? 'varying vec3 vEmit;' : ''}
${metalAttr ? 'varying float vMetal;' : ''}
${GLSL_SKY}
${GLSL_FOG}
${GLSL_NOISE}
${GLSL_BUMP}
${GLSL_TRI}
`);
    // ---- Albedo
    let colorAdd = '';
    if (detail) {
      colorAdd += `
  float aethH = 0.0;
  {
    vec3 dp = vHazeWorld * ${(0.35 * detail).toFixed(3)};
    float dn = fbm3(dp) * 0.65 + vnoise3(dp * 4.0) * 0.35;
    float fine = vnoise3(dp * 13.0);
    diffuseColor.rgb *= 0.78 + 0.36 * dn + 0.1 * (fine - 0.5);
    aethH = dn * 0.7 + fine * 0.3;
  }`;
    }
    if (floor) {
      colorAdd += `
  {
    // Makro-Variation gegen sichtbare Kachelung + Moos in den Fugen (Höhe aus der AO-Map)
    float m = fbm(vHazeWorld.xz * 0.045);
    float m2 = vnoise(vHazeWorld.xz * 0.21);
    diffuseColor.rgb *= 0.84 + 0.26 * m + 0.06 * m2;
    #ifdef USE_AOMAP
    float joint = 1.0 - texture2D(aoMap, vAoMapUv).r;
    float mossN = fbm(vHazeWorld.xz * 0.11 + 3.7);
    float moss = smoothstep(0.18, 0.5, joint) * smoothstep(0.35, 0.75, mossN + 0.15 * (1.0 - vColor.r));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.075, 0.025) * uFoliageTint * (0.8 + 0.5 * m2), moss * 0.85);
    #endif
    // Lesbarkeit: Bodenkontrast leicht zurücknehmen (Einheiten heben sich ab)
    diffuseColor.rgb = mix(vec3(0.27, 0.25, 0.22) * vColor.rgb, diffuseColor.rgb, 0.82);
  }`;
    }
    if (bark && !barkTex) {
      colorAdd += `
  float aethH = 0.0;
  {
    float ang = atan(vBarkP.z, vBarkP.x);
    float wv = vnoise(vec2(ang * 2.0, vBarkP.y * 0.8)) * 0.8;
    float rid = abs(fract(ang * 1.7 + wv) - 0.5) * 2.0;
    float plates = vnoise(vec2(ang * 9.0, vBarkP.y * 3.5));
    aethH = smoothstep(0.1, 0.8, rid) * 0.7 + plates * 0.3;
    diffuseColor.rgb *= 0.45 + 0.75 * aethH;
    float moss = smoothstep(0.55, 0.8, vnoise(vec2(ang * 1.3, vBarkP.y * 0.9) + 4.0)) * smoothstep(1.6, 0.2, vBarkP.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.09, 0.02), moss * 0.7);
  }`;
    }
    if (barkTex) {
      // Rinde: objekt-triplanar (nur seitliche Projektionen → Längsmaserung), Moos am Stammfuß
      colorAdd += `
  vec3 aethBarkW;
  {
    vec3 on = normalize(vBarkN);
    vec2 b = pow(abs(on.xz), vec2(3.0)); b /= (b.x + b.y + 1e-4);
    aethBarkW = vec3(b.x, 0.0, b.y);
    vec3 p = vBarkP * vec3(1.0, 0.55, 1.0);
    vec3 ba = texture2D(uBA, p.zy * uBS).rgb * b.x + texture2D(uBA, p.xy * uBS).rgb * b.y;
    diffuseColor.rgb = ba * vColor.rgb * 3.4;
    float ang = atan(vBarkP.z, vBarkP.x);
    float moss = smoothstep(0.5, 0.78, vnoise(vec2(ang * 1.3, vBarkP.y * 0.9) + 4.0) + on.y * 0.2) * smoothstep(1.8, 0.2, vBarkP.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.085, 0.02) * uFoliageTint * (0.6 + lum3(ba) * 1.4), moss * 0.75);
  }`;
    }
    if (terrain && !pbrT) {
      colorAdd += `
  float aethUp, aethCover; vec4 aethRk;
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    aethUp = smoothstep(0.5, 0.82, wn.y);
    ${legacyStone ? 'aethUp = 0.0; aethCover = 0.0; vec3 top = vec3(0.0);' : `vec4 g = texture2D(uGround, wp.xz / 7.0);
    vec4 gm = texture2D(uGround, wp.xz / 29.0 + 0.37);
    vec4 gn = texture2D(uGroundN, wp.xz / 7.0);
    aethCover = clamp(g.a * 0.75 + gm.a * 0.55 - 0.18, 0.0, 1.0);
    vec3 grassCol = diffuseColor.rgb * (0.55 + 0.75 * gn.a) * uGroundTint;
    vec3 top = mix(g.rgb * mix(vec3(1.0), diffuseColor.rgb * 3.5, 0.25), grassCol, aethCover);`}
    vec3 bw = triW(wn);
    vec4 rx = texture2D(uRock, wp.zy / ${rs.toFixed(2)}), ry = texture2D(uRock, wp.xz / ${rs.toFixed(2)}), rz = texture2D(uRock, wp.xy / ${rs.toFixed(2)});
    aethRk = rx * bw.x + ry * bw.y + rz * bw.z;
    vec3 rockCol = diffuseColor.rgb * aethRk.rgb * ${legacyStone ? '1.9' : '1.5'} * (1.0 - aethRk.a * ${legacyStone ? '0.35' : '0.5'}) * uRockTint;
    vec3 aethBase = diffuseColor.rgb;
    diffuseColor.rgb = mix(rockCol, top, aethUp);
    ${metalAttr ? 'diffuseColor.rgb = mix(diffuseColor.rgb, aethBase, vMetal);' : ''}
  }`;
    }
    if (pbrT) {
      // Gelände: Oberseite = Waldboden/Erde (Höhenmischung), Seiten = Felswand triplanar, Moos in Mulden & auf Absätzen.
      colorAdd += `
  float aethUp, aethRough; vec3 aethW;
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    vec3 vc = vColor.rgb;
    aethW = triW(wn);
    // --- Felswand (triplanar) mit Gesteinsbändern aus den Vertexfarben
    vec3 cliff = triTex(uCA, wp, aethW, uCS);
    float hC = lum3(cliff);
    vec3 strata = clamp(vc / vec3(0.30, 0.25, 0.19), vec3(0.35), vec3(1.5));
    vec3 rockCol = cliff * mix(vec3(1.0), strata, 0.55) * uRockTint;
    // Moos auf Absätzen und in dunklen Spalten der Felswand
    float mossMask = smoothstep(0.15, 0.7, wn.y) * 0.8 + (0.3 - hC) * 1.2 + (fbm(wp.xz * 0.05 + wp.y * 0.03) - 0.5) * 0.8;
    ${far ? 'vec3 mossA = vec3(0.3, 0.42, 0.16);' : 'vec3 mossA = texture2D(uMA, wp.xz * uMS + wp.y * 0.07).rgb;'}
    float mB = hblend(clamp(mossMask, 0.0, 1.0), hC, lum3(mossA), 3.0) * smoothstep(-60.0, -6.0, wp.y);
    rockCol = mix(rockCol, mossA * vec3(0.55, 0.75, 0.5) * uFoliageTint * min(1.0, vc.g * 4.5 + 0.35), mB * 0.85);
    // --- Oberseite: Waldboden + Erde (Erde an Kanten/Rändern, aus Vertexfarbe + Rauschen)
    vec2 tuv = wp.xz;
    vec3 g = texture2D(uGA, tuv * uGS).rgb;
    vec3 gm = texture2D(uGA, tuv * uGS * 0.21 + 0.37).rgb;
    g *= 0.75 + 0.5 * lum3(gm) / max(lum3(g) + 0.05, 0.1) * 0.5;
    vec3 sl = texture2D(uSA, tuv * uSS).rgb;
    float soilV = smoothstep(0.75, 1.25, vc.r / max(vc.g, 1e-3));
    float soilN = smoothstep(0.7, 0.86, fbm(tuv * 0.07 + 11.0));
    float soilM = hblend(clamp(max(soilV, soilN * 0.8), 0.0, 1.0), lum3(g), lum3(sl), 3.5);
    vec3 grassVar = clamp(vc / vec3(0.062, 0.118, 0.025), vec3(0.65), vec3(1.45));
    // Waldboden zur Grasfarbe ziehen (Halme + Boden verschmelzen, auch wo das Gras ausgeblendet ist)
    vec3 gg = mix(g, vec3(lum3(g)) * vec3(0.62, 1.0, 0.36) * 1.15, 0.55);
    vec3 top = mix(gg * grassVar * uGroundTint, sl * vec3(0.95, 0.9, 0.85), soilM);
    // --- Übergang Oberseite/Wand mit Höhenmischung
    aethUp = clamp((wn.y - 0.62) * 5.0 + (lum3(top) - hC) * 1.2, 0.0, 1.0);
    diffuseColor.rgb = mix(rockCol, top, aethUp);
    aethRough = mix(0.86 + 0.1 * (1.0 - hC), mix(0.96, 0.9, soilM), aethUp);
  }`;
    }
    if (stone) {
      colorAdd += `
  vec3 aethW;
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    aethW = triW(wn);
    vec3 st = triTex(uStA, wp, aethW, uStS);
    vec3 aethBase = diffuseColor.rgb;
    float hS = lum3(st);
    vec3 sc = st * diffuseColor.rgb * 2.3 * uRockTint;
    ${stone.moss ? `
    float mm = smoothstep(0.35, 0.9, wn.y) * 0.75 + (fbm(wp.xz * 0.35 + wp.y * 0.2) - 0.5) * 0.9 + (0.32 - hS) * 1.4;
    vec3 ma = texture2D(uMA, wp.xz * uMS).rgb;
    float mb = hblend(clamp(mm, 0.0, 1.0), hS, lum3(ma), 3.0) * uMossAmt;
    sc = mix(sc, ma * vec3(0.5, 0.72, 0.42) * uFoliageTint, mb);` : ''}
    diffuseColor.rgb = sc;
    ${metalAttr ? 'diffuseColor.rgb = mix(diffuseColor.rgb, aethBase, vMetal);' : ''}
  }`;
    }
    if (grass) colorAdd += '\n  diffuseColor.rgb *= uFoliageTint;';
    if (colorAdd) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>${colorAdd}`);
    // ---- Laub: Alpha mit Mip-Stufe verstärken (kein Ausdünnen in der Ferne), innere Volumen-Kugeln
    if (foliage) {
      fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
  #ifdef USE_MAP
  {
    vec2 dxy = vec2(length(dFdx(vMapUv)), length(dFdy(vMapUv))) * 1024.0;
    float lod = max(0.0, log2(max(max(dxy.x, dxy.y), 1e-4)));
    diffuseColor.a = clamp(diffuseColor.a * (1.0 + lod * 0.3), 0.0, 1.0);
    if (vMapUv.x < -0.5) diffuseColor = vec4(diffuse * vec3(0.22, 0.26, 0.16), 1.0);
  }
  #endif
  diffuseColor.rgb *= uFoliageTint;`);
      fs = fs.replace('#include <normal_fragment_begin>', NORMAL_BEGIN_NOFLIP);
    }
    // ---- Rauheit/Metall
    if (metalAttr) {
      fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = vMetal;`);
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.3, vMetal);`);
    }
    if (terrain && !pbrT) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = ${legacyStone ? 'clamp(roughnessFactor * (0.92 + aethRk.a * 0.15), 0.05, 1.0)' : 'mix(0.88 + aethRk.a * 0.08, mix(0.97, 0.8, aethCover), aethUp)'};`);
    }
    if (pbrT) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = aethRough;`);
    }
    // ---- Normalen
    let normalAdd = '';
    if (terrain && !pbrT) {
      normalAdd += `
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    vec3 bw = triW(wn);
    vec3 tx = texture2D(uRockN, wp.zy / ${rs.toFixed(2)}).xyz * 2.0 - 1.0;
    vec3 ty = texture2D(uRockN, wp.xz / ${rs.toFixed(2)}).xyz * 2.0 - 1.0;
    vec3 tz = texture2D(uRockN, wp.xy / ${rs.toFixed(2)}).xyz * 2.0 - 1.0;
    float k = ${legacyStone ? '0.8' : '1.25'};
    tx.xy *= k; tz.xy *= k; ty.xy *= k;
    ${legacyStone ? '' : 'vec3 tg = texture2D(uGroundN, wp.xz / 7.0).xyz * 2.0 - 1.0; ty = mix(ty, tg, aethUp);'}
    tx = vec3(tx.xy + wn.zy, abs(tx.z) * wn.x);
    ty = vec3(ty.xy + wn.xz, abs(ty.z) * wn.y);
    tz = vec3(tz.xy + wn.xy, abs(tz.z) * wn.z);
    vec3 wN = normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
    vec3 aethTN = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
    normal = ${metalAttr ? 'normalize(mix(aethTN, normal, vMetal))' : 'aethTN'};
  }`;
    }
    if (pbrT) {
      normalAdd += `
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    float nf = 1.0 - smoothstep(${far ? '200.0, 700.0' : '60.0, 260.0'}, length(vViewPosition));
    vec3 nC = triNrm(uCN, wp, wn, aethW, uCS, 1.3 * nf);
    vec3 nT = ${far ? 'wn' : 'topNrm(uGN, wp.xz * uGS, wn, 1.0 * nf)'};
    vec3 wN = normalize(mix(nC, nT, aethUp));
    normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
  }`;
    }
    if (stone) {
      normalAdd += `
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    float nf = 1.0 - smoothstep(60.0, 240.0, length(vViewPosition));
    vec3 wN = triNrm(uStN, wp, wn, aethW, uStS, 1.1 * nf);
    vec3 aethTN = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
    normal = ${metalAttr ? 'normalize(mix(aethTN, normal, vMetal))' : 'aethTN'};
  }`;
    }
    if (barkTex) {
      normalAdd += `
  {
    vec3 on = normalize(vBarkN);
    vec3 p = vBarkP * vec3(1.0, 0.55, 1.0);
    vec3 tx = texture2D(uBN, p.zy * uBS).xyz * 2.0 - 1.0, tz = texture2D(uBN, p.xy * uBS).xyz * 2.0 - 1.0;
    tx.xy *= 1.4; tz.xy *= 1.4;
    tx = vec3(tx.xy + on.zy, abs(tx.z) * on.x);
    tz = vec3(tz.xy + on.xy, abs(tz.z) * on.z);
    vec3 oN = normalize(tx.zyx * aethBarkW.x + tz.xyz * aethBarkW.z + on * 0.25);
    // Objekt- → Sichtraum (Basis aus dem Vertex-Shader: modelView × Instanzmatrix)
    normal = normalize(mat3(vInstM0, vInstM1, vInstM2) * oN);
  }`;
    }
    if (bump || (bark && !barkTex)) {
      normalAdd += `
  {
    float fade = 1.0 - smoothstep(30.0, 110.0, length(vViewPosition));
    normal = aethBump(normal, aethH, ${(bark ? 0.06 : 0.035 * (bump || 1)).toFixed(3)} * fade);
  }`;
    }
    if (normalAdd) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${normalAdd}`);
    if (barkTex) {
      // Instanz-Rotation an den Fragment-Shader weitergeben (für objekt-triplanare Normalen)
      vs = vs.replace('#include <common>', '#include <common>\nvarying vec3 vInstM0, vInstM1, vInstM2;');
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    mat3 bm = mat3(modelViewMatrix);
    #ifdef USE_INSTANCING
    bm = bm * mat3(instanceMatrix);
    #endif
    vInstM0 = bm[0]; vInstM1 = bm[1]; vInstM2 = bm[2];
  }`);
      fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vInstM0, vInstM1, vInstM2;');
    }
    if (emissiveAttr) {
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vEmit;`);
    }
    // ---- Durchscheinen (Laub/Gras) im Gegenlicht
    let trans = '';
    if (foliage || grass) {
      trans = `
  {
    vec3 vd = normalize(vHazeWorld - cameraPosition);
    float back = pow(max(dot(vd, uLightDir), 0.0), 2.5);
    float wrap = max(dot(normalize(vNormal), normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz)) * -0.5 + 0.5, 0.0);
    gl_FragColor.rgb += diffuseColor.rgb * uSunColor * (back * ${foliage ? '0.5' : '0.45'} + wrap * ${foliage ? '0.06' : '0.035'});
  }`;
    }
    fs = fs.replace('#include <fog_fragment>', `${trans}${extraFragment}
  gl_FragColor.rgb = applyHaze(gl_FragColor.rgb, vHazeWorld);`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return material;
}

export { f2 };
