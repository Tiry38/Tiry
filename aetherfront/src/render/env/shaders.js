// Gemeinsame Shader-Bausteine: Himmelsfarbe, Luftperspektive, Rauschen, Material-Patches
// (Triplanar-Gelände, Laub, Rinde, prozedurales Relief).
import * as THREE from 'three';

// Von allen Umgebungs-Shadern geteilte Uniform-Objekte (eine Aktualisierung wirkt überall).
export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.6, 0.18, -0.78).normalize() }, // sichtbare Sonne (tief)
    uLightDir: { value: new THREE.Vector3(0.5, 0.6, -0.6).normalize() }, // Lichtrichtung (höher)
    uSunColor: { value: new THREE.Color(1.0, 0.82, 0.60) },
    uFogDensity: { value: 0.0013 },
    uHeightFog: { value: 1.0 },
  };
}

// Himmel zur späten Nachmittagssonne: tiefes Blau im Zenit, heller, leicht warmer Horizont zur Sonne hin,
// kühler Horizont gegenüber, Mie-Schein um die Sonne. Werte linear/HDR.
export const GLSL_SKY = /* glsl */ `
uniform vec3 uSunDir;
vec3 skyColor(vec3 d) {
  vec3 s = uSunDir;
  float y = d.y;
  float sd = dot(d, s);
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(s.xz)) * 0.5 + 0.5;
  float warm = az * az * az;
  float yy = max(y, 0.0);
  vec3 zenith = vec3(0.030, 0.095, 0.34);
  vec3 mid    = vec3(0.070, 0.200, 0.56);
  vec3 horA   = vec3(0.30, 0.46, 0.74);
  vec3 horS   = vec3(0.95, 0.72, 0.50);
  vec3 hor = mix(horA, horS, warm);
  vec3 c = mix(hor, mid, pow(smoothstep(0.0, 0.42, yy), 0.75));
  c = mix(c, zenith, smoothstep(0.35, 1.0, yy));
  c += vec3(0.14, 0.15, 0.16) * exp(-abs(y) * 24.0) * (0.35 + 0.65 * warm);
  vec3 below = mix(vec3(0.30, 0.43, 0.66), vec3(0.85, 0.68, 0.50), warm);
  c = mix(c, below, smoothstep(0.0, -0.08, y));
  float g = max(sd, 0.0);
  c += vec3(1.0, 0.72, 0.42) * (pow(g, 8.0) * 0.22 + pow(g, 90.0) * 0.8);
  return c;
}
// Dunstfarbe für Luftperspektive: bläulich, zur Sonne hin warm (kein rosa Schleier)
vec3 hazeColor(vec3 d) {
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(uSunDir.xz)) * 0.5 + 0.5;
  float warm = az * az * az;
  vec3 c = mix(vec3(0.31, 0.46, 0.74), vec3(0.98, 0.78, 0.56), warm);
  float g = max(dot(normalize(vec3(d.x, max(d.y, 0.0) * 0.5, d.z)), uSunDir), 0.0);
  c += vec3(0.9, 0.62, 0.32) * pow(g, 10.0) * 0.2;
  return c * 0.78;
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
  float hf = smoothstep(-12.0, -70.0, worldPos.y) * uHeightFog;
  f = clamp(max(f, hf * 0.6), 0.0, 1.0);
  vec3 hc = hazeColor(d);
  vec3 low = mix(hc, vec3(0.30, 0.40, 0.56), 0.5);
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

const NORMAL_BEGIN_NOFLIP = THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '');

/**
 * Patcht ein Standard-Material: eigener Richtungs-Dunst (statt scene.fog-Farbe), optional Wind (Gras/Bäume),
 * Vertex-Emission/Metall, prozedurales Detail (Albedo + Relief), Triplanar-Gelände, Laub, Rinde.
 */
export function patchMaterial(material, U, opts = {}) {
  const {
    wind = 0, emissiveAttr = false, metalAttr = false, clampFar = false, extraFragment = '', detail = 0, bump = 0,
    terrain = null, foliage = false, bark = false, grass = false, floor = false,
  } = opts;
  material.customProgramCacheKey = () => `aeth2-${wind}-${emissiveAttr}-${metalAttr}-${clampFar}-${extraFragment.length}-${detail}-${bump}-${!!terrain}-${foliage}-${bark}-${grass}-${floor}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: U.uTime, uSunDir: U.uSunDir, uLightDir: U.uLightDir, uSunColor: U.uSunColor, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog,
    });
    if (terrain) {
      Object.assign(shader.uniforms, {
        uGround: { value: terrain.ground }, uGroundN: { value: terrain.groundN }, uRock: { value: terrain.rock }, uRockN: { value: terrain.rockN },
      });
    }
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vHazeWorld;
${terrain ? 'varying vec3 vTerrN;' : ''}
${bark ? 'varying vec3 vBarkP;' : ''}
${grass ? 'varying float vBladeH;' : ''}
${emissiveAttr ? 'attribute vec3 emit; varying vec3 vEmit;' : ''}
${metalAttr ? 'attribute float metal; varying float vMetal;' : ''}
`);
    let windCode = '';
    if (wind === 1) {
      // Gras: Spitzen schwingen, Phase aus Instanzposition, Böen wandern übers Feld
      windCode = `
  #ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  #else
  vec3 ip = vec3(0.0);
  #endif
  float hh = max(position.y, 0.0);
  float gust = 0.6 + 0.5 * sin(uTime * 0.6 + ip.x * 0.05 - ip.z * 0.04);
  float w = (sin(uTime * 1.7 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uTime * 2.9 + ip.x * 0.5 - ip.z * 0.4) * 0.25) * gust;
  transformed.x += w * 0.16 * hh * hh;
  transformed.z += w * 0.09 * hh * hh;`;
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
${bark ? 'vBarkP = position;' : ''}
${grass ? 'vBladeH = position.y;' : ''}
`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 hw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    hw = instanceMatrix * hw;
    #endif
    vHazeWorld = (modelMatrix * hw).xyz;
    ${terrain ? 'vTerrN = normalize(mat3(modelMatrix) * objectNormal);' : ''}
  }
  ${clampFar ? 'gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);' : ''}
`);
    fs = fs.replace('#include <common>', `#include <common>
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uSunColor;
varying vec3 vHazeWorld;
${terrain ? 'varying vec3 vTerrN; uniform sampler2D uGround, uGroundN, uRock, uRockN;' : ''}
${bark ? 'varying vec3 vBarkP;' : ''}
${grass ? 'varying float vBladeH;' : ''}
${emissiveAttr ? 'varying vec3 vEmit;' : ''}
${metalAttr ? 'varying float vMetal;' : ''}
${GLSL_SKY}
${GLSL_FOG}
${GLSL_NOISE}
${GLSL_BUMP}
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
    float m = fbm(vHazeWorld.xz * 0.045);
    float m2 = vnoise(vHazeWorld.xz * 0.21);
    diffuseColor.rgb *= 0.86 + 0.24 * m + 0.06 * m2;
  }`;
    }
    if (bark) {
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
    if (terrain) {
      colorAdd += `
  float aethUp, aethCover; vec4 aethRk;
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    aethUp = smoothstep(0.5, 0.82, wn.y);
    vec4 g = texture2D(uGround, wp.xz / 7.0);
    vec4 gm = texture2D(uGround, wp.xz / 29.0 + 0.37);
    vec4 gn = texture2D(uGroundN, wp.xz / 7.0);
    aethCover = clamp(g.a * 0.75 + gm.a * 0.55 - 0.18, 0.0, 1.0);
    vec3 grassCol = diffuseColor.rgb * (0.55 + 0.75 * gn.a);
    vec3 top = mix(g.rgb * mix(vec3(1.0), diffuseColor.rgb * 3.5, 0.25), grassCol, aethCover);
    vec3 bw = pow(abs(wn), vec3(4.0)); bw /= dot(bw, vec3(1.0));
    vec4 rx = texture2D(uRock, wp.zy / 14.0), ry = texture2D(uRock, wp.xz / 14.0), rz = texture2D(uRock, wp.xy / 14.0);
    aethRk = rx * bw.x + ry * bw.y + rz * bw.z;
    vec3 rockCol = diffuseColor.rgb * aethRk.rgb * 1.5 * (1.0 - aethRk.a * 0.5);
    diffuseColor.rgb = mix(rockCol, top, aethUp);
  }`;
    }
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
  #endif`);
      fs = fs.replace('#include <normal_fragment_begin>', NORMAL_BEGIN_NOFLIP);
    }
    // ---- Rauheit/Metall
    if (metalAttr) {
      fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = vMetal;`);
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.3, vMetal);`);
    }
    if (terrain) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(0.88 + aethRk.a * 0.08, mix(0.97, 0.8, aethCover), aethUp);`);
    }
    // ---- Normalen
    let normalAdd = '';
    if (terrain) {
      normalAdd += `
  {
    vec3 wp = vHazeWorld; vec3 wn = normalize(vTerrN);
    vec3 bw = pow(abs(wn), vec3(4.0)); bw /= dot(bw, vec3(1.0));
    vec3 tx = texture2D(uRockN, wp.zy / 14.0).xyz * 2.0 - 1.0;
    vec3 ty = texture2D(uRockN, wp.xz / 14.0).xyz * 2.0 - 1.0;
    vec3 tz = texture2D(uRockN, wp.xy / 14.0).xyz * 2.0 - 1.0;
    vec3 tg = texture2D(uGroundN, wp.xz / 7.0).xyz * 2.0 - 1.0;
    float k = 1.25;
    tx.xy *= k; tz.xy *= k; ty.xy *= k;
    ty = mix(ty, tg, aethUp);
    tx = vec3(tx.xy + wn.zy, abs(tx.z) * wn.x);
    ty = vec3(ty.xy + wn.xz, abs(ty.z) * wn.y);
    tz = vec3(tz.xy + wn.xy, abs(tz.z) * wn.z);
    vec3 wN = normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
    normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
  }`;
    }
    if (bump || bark) {
      normalAdd += `
  {
    float fade = 1.0 - smoothstep(30.0, 110.0, length(vViewPosition));
    normal = aethBump(normal, aethH, ${(bark ? 0.06 : 0.035 * (bump || 1)).toFixed(3)} * fade);
  }`;
    }
    if (normalAdd) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${normalAdd}`);
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
    gl_FragColor.rgb += diffuseColor.rgb * uSunColor * (back * ${foliage ? '0.45' : '0.4'} + wrap * ${foliage ? '0.05' : '0.03'});
  }`;
    }
    fs = fs.replace('#include <fog_fragment>', `${trans}${extraFragment}
  gl_FragColor.rgb = applyHaze(gl_FragColor.rgb, vHazeWorld);`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return material;
}
