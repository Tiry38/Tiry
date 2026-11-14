// Wolkenmeer: Höhenfeld-Raymarching in einer Wolkenschicht unter den Inseln (Relief, Selbstschatten,
// Silberränder, leuchtende Täler) + Dunst zum Horizont. Folgt der Kamera (unendliches Meer).
import * as THREE from 'three';
import { GLSL_SKY, GLSL_NOISE } from './shaders.js';

export const CLOUD_TOP = -50;
export const CLOUD_BOTTOM = -96;

function discGeometry(rMax = 2600, rings = 48, segs = 96) {
  const pos = [];
  const idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) {
    const rr = rMax * Math.pow(r / rings, 2.2);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs, a1 = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      idx.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createCloudSea(U, noiseTex, steps = 20) {
  const mat = new THREE.ShaderMaterial({
    defines: { STEPS: steps },
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uNoise: { value: noiseTex },
      uTop: { value: CLOUD_TOP }, uBottom: { value: CLOUD_BOTTOM }, uLightDir: U.uLightDir,
      uIsles: { value: [
        new THREE.Vector4(-70, -5.5, 50, 39), new THREE.Vector4(70, -5.5, 50, 39),
        new THREE.Vector4(-70, 53, 18, 16), new THREE.Vector4(70, 53, 18, 16), new THREE.Vector4(0, 6, 14, 14),
      ] },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uNoise;
      uniform float uTop;
      uniform float uBottom;
      varying vec3 vWorld;
      ${GLSL_SKY}
      ${GLSL_NOISE}
      float cloudH(vec2 p) {
        vec2 q = p * 0.0021 + vec2(uTime * 0.0012, uTime * 0.0005);
        vec4 a = texture2D(uNoise, q);
        vec4 b = texture2D(uNoise, q * 2.3 + vec2(0.37, 0.11) - vec2(uTime * 0.0021, 0.0));
        float h = a.g * 0.50 + a.b * 0.26 + a.r * 0.30 + b.g * 0.12;
        h = smoothstep(0.30, 1.08, h);
        return h;
      }
      uniform vec4 uIsles[5];
      uniform vec3 uLightDir;
      float isleShadow(vec3 p) {
        vec2 q = p.xz + uLightDir.xz * (-p.y / uLightDir.y);
        float s = 0.0;
        for (int i = 0; i < 5; i++) {
          vec2 d = abs(q - uIsles[i].xy) / uIsles[i].zw;
          float r = pow(pow(d.x, 3.0) + pow(d.y, 3.0), 0.3333);
          float wob = sin(atan(d.y, d.x) * 5.0 + uIsles[i].x) * 0.06;
          s = max(s, 1.0 - smoothstep(0.55, 1.25, r + wob));
        }
        return s;
      }
      float cloudHd(vec2 p) { // mit feinem Detail (Shading)
        vec2 q = p * 0.0021 + vec2(uTime * 0.0012, uTime * 0.0005);
        float d = texture2D(uNoise, q * 7.0 + vec2(uTime * 0.004, 0.0)).b;
        return cloudH(p) + (d - 0.5) * 0.05;
      }
      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorld - ro);
        float thick = uTop - uBottom;
        float distToTop = length(vWorld - ro);
        vec3 p = vWorld;
        float hit = 0.0;
        if (rd.y < -0.002) {
          float L = min(thick / -rd.y, 520.0);
          int n = int(STEPS);
          float dt = L / float(STEPS);
          float tPrev = 0.0;
          float tHit = L;
          for (int i = 1; i <= STEPS; i++) {
            float t = dt * float(i);
            vec3 q = vWorld + rd * t;
            float surf = uBottom + cloudH(q.xz) * thick;
            if (q.y < surf) {
              // Binärsuche
              float a = tPrev, b = t;
              for (int k = 0; k < 4; k++) {
                float m = 0.5 * (a + b);
                vec3 qm = vWorld + rd * m;
                if (qm.y < uBottom + cloudH(qm.xz) * thick) b = m; else a = m;
              }
              tHit = b; hit = 1.0; break;
            }
            tPrev = t;
          }
          p = vWorld + rd * tHit;
        }
        float h = clamp((p.y - uBottom) / thick, 0.0, 1.0);
        // Normale aus Gradient
        float e = 6.0;
        float hx = cloudHd(p.xz + vec2(e, 0.0)) - cloudHd(p.xz - vec2(e, 0.0));
        float hz = cloudHd(p.xz + vec2(0.0, e)) - cloudHd(p.xz - vec2(0.0, e));
        vec3 n = normalize(vec3(-hx * thick / (2.0 * e), 1.0, -hz * thick / (2.0 * e)));
        vec3 L = normalize(uSunDir + vec3(0.0, 0.25, 0.0));
        // weiches Selbstschatten-Sampling Richtung Sonne
        float sh = 0.0;
        vec2 sdir = normalize(uSunDir.xz);
        for (int k = 1; k <= 3; k++) {
          float dk = float(k) * 14.0;
          float hs = uBottom + cloudH(p.xz + sdir * dk) * thick;
          float rayY = p.y + dk * 0.28;
          sh += smoothstep(0.0, 6.0, hs - rayY);
        }
        float shadow = 1.0 - clamp(sh / 2.2, 0.0, 1.0) * 0.75;
        float ndl = clamp(dot(n, L) * 0.95 + 0.12, 0.0, 1.0);
        float sunAmt = max(dot(rd, uSunDir), 0.0);
        vec2 dxz = normalize(rd.xz + vec2(1e-5));
        float warm = dot(dxz, sdir) * 0.5 + 0.5;
        vec3 lit = mix(vec3(1.15, 1.12, 1.08), vec3(1.8, 1.32, 0.88), warm);
        vec3 shade = mix(vec3(0.12, 0.20, 0.36), vec3(0.27, 0.29, 0.34), warm);
        float isl = isleShadow(p);
        float lt = ndl * shadow * (1.0 - isl * 0.85);
        vec3 col = mix(shade, lit, smoothstep(0.0, 1.0, lt));
        // Höhe: Täler tiefer und kühler, Kuppen hell
        col *= mix(0.35, 1.0, smoothstep(0.0, 0.8, h));
        // Streulicht in den Tälern (bläulich)
        col += vec3(0.08, 0.14, 0.24) * pow(1.0 - h, 3.0) * 0.3;
        // Silberrand im Gegenlicht
        float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 4.0);
        col += vec3(1.4, 1.0, 0.65) * rim * pow(sunAmt, 4.0) * shadow * 0.8;
        // Sonnenglitzern auf Kuppen
        col += vec3(1.0, 0.75, 0.45) * pow(sunAmt, 24.0) * smoothstep(0.6, 1.0, h) * 0.45;
        col *= 0.88;
        col *= mix(1.0, 0.7, isl);
        // Dunst zum Horizont
        float dist = length(p - ro);
        float f = 1.0 - exp(-pow(dist * 0.00095, 1.6));
        vec3 hzc = skyColor(normalize(vec3(rd.x, min(rd.y, -0.015) * 0.6, rd.z)));
        col = mix(col, hzc, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(discGeometry(), mat);
  mesh.position.y = CLOUD_TOP;
  mesh.frustumCulled = false;
  mesh.name = 'aeth-cloudsea';
  mesh.renderOrder = -900;
  mesh.onBeforeRender = (r, s, camera) => {
    mesh.position.x = Math.round(camera.position.x / 50) * 50;
    mesh.position.z = Math.round(camera.position.z / 50) * 50;
    mesh.updateMatrixWorld();
  };
  return mesh;
}
