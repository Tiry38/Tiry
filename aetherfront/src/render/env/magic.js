// Magische Materialien: Kristalle, Portal-Wirbel, Runenbänder, Siegel, Lichtsäule.
import * as THREE from 'three';
import { GLSL_SKY, GLSL_NOISE, GLSL_FOG } from './shaders.js';

/** Facettierter Kristall mit innerem Leuchten (HDR-Spitzen → Bloom). floating: wippt und dreht sich. */
export function createCrystalMaterial(U, { floating = false, intensity = 1.0, spire = false } = {}) {
  return new THREE.ShaderMaterial({
    defines: { FLOATING: floating ? 1 : 0, SPIRE: spire ? 1 : 0 },
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uLightDir: U.uLightDir, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog,
      uIntensity: { value: intensity }, uColor: { value: new THREE.Color(0.25, 0.9, 1.0) },
    },
    vertexShader: /* glsl */ `
      attribute float hgt;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vH;
      varying vec3 vCol;
      varying float vSeed;
      uniform vec3 uColor;
      void main() {
        vec3 p = position;
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
        im = instanceMatrix;
        #endif
        vec3 ip = im[3].xyz;
        float seed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vSeed = seed;
        vec4 wp;
        #if FLOATING == 1
          float a = uTime * (0.25 + seed * 0.5) + seed * 6.28;
          float c = cos(a), s = sin(a);
          p.xz = mat2(c, -s, s, c) * p.xz;
          wp = modelMatrix * im * vec4(p, 1.0);
          wp.y += sin(uTime * (0.7 + seed * 0.6) + seed * 20.0) * 0.45;
        #else
          wp = modelMatrix * im * vec4(p, 1.0);
        #endif
        vWorld = wp.xyz;
        vH = hgt;
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = uColor;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uLightDir;
      varying vec3 vWorld;
      varying float vH;
      varying vec3 vCol;
      varying float vSeed;
      ${GLSL_SKY}
      ${GLSL_FOG}
      ${GLSL_NOISE}
      void main() {
        vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 V = normalize(cameraPosition - vWorld);
        if (dot(N, V) < 0.0) N = -N;
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
        float diff = 0.35 + 0.65 * max(dot(N, uLightDir), 0.0);
        vec3 R = reflect(-V, N);
        float spec = pow(max(dot(R, uLightDir), 0.0), 48.0);
        vec3 deep = vCol * vec3(0.10, 0.08, 0.16);
        float inner = 0.55 + 0.45 * sin(vWorld.y * 1.7 + uTime * 1.4 + vSeed * 9.0);
        float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + vSeed * 30.0);
        vec3 col = mix(deep, vCol * 0.55, smoothstep(0.0, 0.9, vH)) * diff;
        col += vCol * (fres * 0.55 + pow(vH, 2.5) * 0.95 * pulse) * uIntensity;
        col += vCol * inner * 0.18 * uIntensity;
        #if SPIRE == 1
          float band = smoothstep(0.92, 1.0, sin(vWorld.y * 0.9 - uTime * 2.0) * 0.5 + 0.5);
          col += vCol * band * 0.7;
          col += vCol * 0.12;
        #endif
        col += vec3(1.0, 0.85, 0.7) * spec * 1.5;
        col = applyHaze(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Portal-Wirbel (senkrechte Scheiben) – Attribute: uv, seed. */
export function createPortalMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: /* glsl */ `
      attribute float seed;
      varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = seed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying float vSeed;
      ${GLSL_NOISE}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float t = uTime + vSeed * 13.0;
        float sw = a + r * 5.5 - t * 1.6;
        vec2 q = vec2(cos(sw), sin(sw)) * (1.2 + r * 2.5);
        float n = fbm(q + vec2(t * 0.2, -t * 0.35));
        float n2 = fbm(q * 2.3 - t * 0.5);
        float arms = pow(0.5 + 0.5 * sin(sw * 3.0 + n * 6.0), 3.0);
        vec3 violet = vec3(0.50, 0.08, 1.0);
        vec3 teal = vec3(0.0, 0.85, 0.95);
        vec3 col = mix(violet, teal, smoothstep(0.3, 0.8, n2));
        float edge = smoothstep(0.55, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        float core = 1.0 - smoothstep(0.0, 0.55, r);
        vec3 c = col * (arms * 0.6 * (0.25 + r) + edge * 0.9 * (0.6 + n));
        c += vec3(0.02, 0.0, 0.05) * core;
        c = mix(c, vec3(0.015, 0.0, 0.04), core * (0.75 - n * 0.3));
        c += vec3(0.9, 0.5, 1.6) * pow(1.0 - r, 10.0) * 0.35 * (0.6 + 0.4 * sin(t * 3.0));
        float alpha = smoothstep(1.0, 0.92, r);
        gl_FragColor = vec4(c, alpha);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Leuchtende Runenbänder am Boden – Attribute: uv (u entlang, v quer), flow, tint. */
export function createRuneMaterial(U, runeTex) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uTex: { value: runeTex } },
    vertexShader: /* glsl */ `
      attribute float flow; attribute vec3 tint;
      varying vec2 vUv; varying float vFlow; varying vec3 vTint;
      void main() { vUv = uv; vFlow = flow; vTint = tint; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uTex;
      varying vec2 vUv; varying float vFlow; varying vec3 vTint;
      void main() {
        float g = texture2D(uTex, vUv).r;
        float wave = pow(0.5 + 0.5 * sin(vFlow * 0.22 - uTime * 2.2), 10.0);
        float breathe = 0.75 + 0.25 * sin(uTime * 0.8 + vFlow * 0.03);
        float edgeFade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        vec3 c = vTint * g * (0.6 * breathe + 1.4 * wave) * edgeFade;
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

/** Runensiegel (Kreisdecals) – Attribute: uv, tint, spin. */
export function createSealMaterial(U, sealTex) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uTex: { value: sealTex } },
    vertexShader: /* glsl */ `
      attribute vec3 tint; attribute float spin;
      varying vec2 vUv; varying vec3 vTint; varying float vSpin;
      void main() { vUv = uv; vTint = tint; vSpin = spin; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uTex;
      varying vec2 vUv; varying vec3 vTint; varying float vSpin;
      void main() {
        vec2 p = vUv - 0.5;
        float a = uTime * 0.06 * vSpin;
        p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
        float g = texture2D(uTex, p + 0.5).r;
        float r = length(vUv - 0.5) * 2.0;
        float pulse = 0.8 + 0.2 * sin(uTime * 1.1 + vSpin * 3.0);
        vec3 c = vTint * (g * pulse + exp(-r * r * 3.0) * 0.08);
        c *= smoothstep(1.0, 0.95, r);
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
}

/** Lichtsäule (additiv, offener Zylinder). */
export function createBeamMaterial(U, color = new THREE.Color(0.35, 0.8, 1.0)) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uColor: { value: color } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${GLSL_NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float side = pow(abs(dot(normalize(vN), V)), 1.5);
        float n = fbm(vec2(vUv.x * 6.0, vUv.y * 10.0 - uTime * 0.6));
        float fadeY = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.6);
        float a = side * fadeY * (0.45 + 0.75 * n);
        gl_FragColor = vec4(uColor * a * 0.18, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
