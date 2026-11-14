// Himmel: Verlauf zur goldenen Stunde, Sonnenscheibe + Halo, Zirren, Nebel-Schleier, Sterne.
import * as THREE from 'three';
import { GLSL_SKY, GLSL_NOISE } from './shaders.js';

export function createSky(U, { forEnv = false } = {}) {
  const geo = new THREE.SphereGeometry(forEnv ? 500 : 10, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunDir: U.uSunDir, uEnv: { value: forEnv ? 1 : 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        ${forEnv ? 'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);' : `
        vec4 wp = vec4(position + cameraPosition, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w * 0.999999;`}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uEnv;
      varying vec3 vDir;
      ${GLSL_SKY}
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float sd = dot(d, uSunDir);
        float up = max(d.y, 0.0);
        vec2 dxz = normalize(d.xz + vec2(1e-5));
        float away = 1.0 - (dot(dxz, normalize(uSunDir.xz)) * 0.5 + 0.5);
        // Nebel-Schleier (violett/türkis) im hohen Himmel abseits der Sonne
        vec3 sp = d * 3.0;
        float neb = fbm3(sp * 1.3 + vec3(0.0, 0.0, uTime * 0.004));
        float neb2 = fbm3(sp * 2.7 - 11.0);
        float nebMask = smoothstep(0.12, 0.55, up) * (0.35 + 0.65 * away);
        vec3 nebCol = mix(vec3(0.35, 0.10, 0.45), vec3(0.06, 0.32, 0.45), neb2);
        col += nebCol * pow(smoothstep(0.42, 0.85, neb), 1.6) * 0.22 * nebMask;
        // Sterne
        if (uEnv < 0.5) {
          vec3 sc = d * 260.0;
          vec3 cell = floor(sc);
          float h = hash13(cell);
          vec3 fp = fract(sc) - 0.5 - (vec3(hash13(cell + 7.1), hash13(cell + 3.3), hash13(cell + 1.7)) - 0.5) * 0.6;
          float star = smoothstep(0.11, 0.0, length(fp)) * step(0.965, h);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
          float starMask = smoothstep(0.18, 0.6, up) * (0.25 + 0.75 * away);
          col += vec3(0.85, 0.9, 1.0) * star * tw * starMask * (0.6 + 2.2 * pow(h, 30.0));
        }
        // Zirren: lange, sonnenbeschienene Wolkenbänder
        vec2 cp = d.xz / (d.y + 0.18) * 1.2;
        float cir = fbm(cp * vec2(0.9, 3.2) + vec2(uTime * 0.01, 0.0));
        cir = smoothstep(0.52, 0.85, cir) * smoothstep(0.02, 0.18, d.y) * smoothstep(0.9, 0.3, d.y);
        vec3 cirCol = mix(vec3(0.38, 0.18, 0.40), vec3(1.15, 0.55, 0.32), pow(max(sd, 0.0), 3.0)) ;
        col = mix(col, cirCol, cir * 0.55);
        // Sonnenscheibe (HDR -> Bloom)
        float disc = smoothstep(0.99935, 0.99972, sd);
        col += vec3(16.0, 10.0, 5.0) * disc * (uEnv > 0.5 ? 0.15 : 1.0);
        col += vec3(1.0, 0.6, 0.3) * pow(max(sd, 0.0), 1200.0) * 1.6;
        // leichter Dither gegen Banding
        col += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: !forEnv ? true : false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'aeth-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
