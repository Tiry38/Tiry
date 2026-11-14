// Gemeinsame Shader-Bausteine: Himmelsfarbe, Dunst/Nebel, Rauschen, Material-Patches.
import * as THREE from 'three';

// Von allen Umgebungs-Shadern geteilte Uniform-Objekte (eine Aktualisierung wirkt überall).
export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.6, 0.18, -0.78).normalize() }, // sichtbare Sonne (tief)
    uLightDir: { value: new THREE.Vector3(0.5, 0.6, -0.6).normalize() }, // Lichtrichtung (höher)
    uFogDensity: { value: 0.0016 },
    uHeightFog: { value: 1.0 },
  };
}

export const GLSL_SKY = /* glsl */ `
uniform vec3 uSunDir;
vec3 skyColor(vec3 d) {
  vec3 s = uSunDir;
  float y = d.y;
  float sd = dot(d, s);
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(s.xz)) * 0.5 + 0.5;
  float warm = az * az;
  float yy = max(y, 0.0);
  vec3 zenith = mix(vec3(0.016, 0.022, 0.085), vec3(0.045, 0.040, 0.140), warm);
  vec3 high   = mix(vec3(0.060, 0.060, 0.215), vec3(0.300, 0.150, 0.220), warm);
  vec3 hor    = mix(vec3(0.230, 0.180, 0.400), vec3(0.980, 0.470, 0.230), warm);
  vec3 c = mix(hor, high, smoothstep(0.0, 0.30, yy));
  c = mix(c, zenith, smoothstep(0.22, 0.95, yy));
  c += vec3(1.0, 0.42, 0.22) * 0.22 * exp(-abs(y) * 16.0) * warm;
  vec3 below = mix(vec3(0.140, 0.120, 0.290), vec3(0.700, 0.380, 0.240), warm);
  c = mix(c, below, smoothstep(0.0, -0.10, y));
  float g = max(sd, 0.0);
  c += vec3(1.0, 0.55, 0.20) * (pow(g, 5.0) * 0.22 + pow(g, 40.0) * 0.45);
  return c;
}
// Dunstfarbe für Luftperspektive (Richtung zur Sonne wärmer, ohne grelle Sonnenkorona)
vec3 hazeColor(vec3 d) {
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  float az = dot(dxz, normalize(uSunDir.xz)) * 0.5 + 0.5;
  float warm = az * az;
  vec3 c = mix(vec3(0.20, 0.17, 0.38), vec3(0.85, 0.45, 0.26), warm);
  float g = max(dot(normalize(vec3(d.x, max(d.y, 0.0) * 0.5, d.z)), uSunDir), 0.0);
  c += vec3(0.9, 0.5, 0.25) * pow(g, 10.0) * 0.35;
  return c;
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

// Nebel: exponentiell + Höhennebel unter den Inseln, Farbe richtungsabhängig (warm zur Sonne).
export const GLSL_FOG = /* glsl */ `
uniform float uFogDensity;
uniform float uHeightFog;
vec3 applyHaze(vec3 col, vec3 worldPos) {
  vec3 v = worldPos - cameraPosition;
  float dist = length(v);
  vec3 d = v / max(dist, 1e-4);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  float hf = smoothstep(-14.0, -66.0, worldPos.y) * uHeightFog;
  f = clamp(max(f, hf * 0.55), 0.0, 1.0);
  vec3 hc = hazeColor(d);
  vec3 low = mix(hc, vec3(0.30, 0.17, 0.36), 0.45);
  return mix(col, mix(hc, low, hf), f);
}
`;

/**
 * Patcht ein Standard-/Lambert-Material: eigener Richtungs-Dunst (statt scene.fog-Farbe),
 * optional Wind (für Gras/Bäume) und Vertex-Emission/Metall.
 */
export function patchMaterial(material, U, opts = {}) {
  const { wind = 0, emissiveAttr = false, metalAttr = false, clampFar = false, extraFragment = '', detail = 0 } = opts;
  material.customProgramCacheKey = () => `aeth-${wind}-${emissiveAttr}-${metalAttr}-${clampFar}-${extraFragment.length}-${detail}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: U.uTime, uSunDir: U.uSunDir, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog });
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vHazeWorld;
${emissiveAttr ? 'attribute vec3 emit; varying vec3 vEmit;' : ''}
${metalAttr ? 'attribute float metal; varying float vMetal;' : ''}
`);
    let windCode = '';
    if (wind === 1) {
      // Gras: Spitzen schwingen, Phase aus Instanzposition
      windCode = `
  #ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  #else
  vec3 ip = vec3(0.0);
  #endif
  float hh = max(position.y, 0.0);
  float w = sin(uTime * 1.7 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uTime * 2.9 + ip.x * 0.5 - ip.z * 0.4) * 0.25;
  transformed.x += w * 0.16 * hh * hh;
  transformed.z += w * 0.09 * hh * hh;`;
    } else if (wind === 2) {
      // Bäume: Krone wiegt leicht
      windCode = `
  #ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  #else
  vec3 ip = vec3(0.0);
  #endif
  float hh = max(position.y - 1.2, 0.0);
  float w = sin(uTime * 0.9 + ip.x * 0.13 + ip.z * 0.11) + 0.4 * sin(uTime * 2.1 + ip.z * 0.3);
  transformed.x += w * 0.035 * hh;
  transformed.z += w * 0.02 * hh;`;
    }
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
${windCode}
${emissiveAttr ? 'vEmit = emit;' : ''}
${metalAttr ? 'vMetal = metal;' : ''}
`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 hw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    hw = instanceMatrix * hw;
    #endif
    vHazeWorld = (modelMatrix * hw).xyz;
  }
  ${clampFar ? 'gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);' : ''}
`);
    fs = fs.replace('#include <common>', `#include <common>
varying vec3 vHazeWorld;
${emissiveAttr ? 'varying vec3 vEmit;' : ''}
${metalAttr ? 'varying float vMetal;' : ''}
${GLSL_SKY}
${GLSL_FOG}
${detail ? GLSL_NOISE : ''}
`);
    if (detail) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 dp = vHazeWorld * ${(0.35 * detail).toFixed(3)};
    float dn = fbm3(dp) * 0.65 + vnoise3(dp * 4.0) * 0.35;
    diffuseColor.rgb *= 0.80 + 0.40 * dn;
  }`);
    }
    if (metalAttr) {
      fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = vMetal;`);
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.32, vMetal);`);
    }
    if (emissiveAttr) {
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vEmit;`);
    }
    fs = fs.replace('#include <fog_fragment>', `${extraFragment}
  gl_FragColor.rgb = applyHaze(gl_FragColor.rgb, vHazeWorld);`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return material;
}
