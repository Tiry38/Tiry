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
        vec2 sdir = normalize(uSunDir.xz);
        // Zirren: hohe, gestreckte Schleier
        vec2 cp = d.xz / (d.y + 0.12) * 0.9;
        float cir = fbm(cp * vec2(0.7, 2.6) + vec2(uTime * 0.006, 0.0));
        cir = smoothstep(0.55, 0.9, cir) * smoothstep(0.03, 0.2, d.y) * smoothstep(0.95, 0.35, d.y);
        vec3 cirCol = mix(vec3(0.62, 0.70, 0.86), vec3(1.7, 1.25, 0.85), pow(max(sd, 0.0), 4.0));
        col = mix(col, cirCol, cir * 0.45);
        // Haufenwolken in Horizontnähe (projiziert auf eine Wolkenschicht, Licht von der Sonnenseite)
        if (d.y > -0.02) {
          vec2 q = d.xz / (d.y + 0.035) * 0.55 + vec2(uTime * 0.004, 0.0);
          vec2 wq = q + vec2(fbm(q * 0.6 + 3.0), fbm(q * 0.6 - 7.0)) * 1.2;
          float dens = fbm(wq * 0.9) * 0.75 + fbm(wq * 2.7) * 0.25;
          float band = smoothstep(-0.01, 0.03, d.y) * smoothstep(0.32, 0.05, d.y);
          float cov = smoothstep(0.50, 0.72, dens) * band;
          // Selbstschatten: Dichte in Richtung Sonne
          float ds = fbm((wq + sdir * 0.35) * 0.9) * 0.75 + fbm((wq + sdir * 0.35) * 2.7) * 0.25;
          float lit = clamp(0.5 + (dens - ds) * 6.0, 0.0, 1.0);
          float toward = pow(max(dot(normalize(d.xz + 1e-5), sdir), 0.0), 3.0);
          vec3 cLit = mix(vec3(1.05, 1.0, 0.96), vec3(1.9, 1.35, 0.85), toward) * 1.1;
          vec3 cSh = mix(vec3(0.34, 0.42, 0.58), vec3(0.62, 0.48, 0.42), toward);
          vec3 cc = mix(cSh, cLit, lit);
          // Silberrand im Gegenlicht
          cc += vec3(1.6, 1.2, 0.8) * pow(max(sd, 0.0), 24.0) * (1.0 - smoothstep(0.5, 0.8, dens)) * 3.0;
          // Ferne Wolken verschwimmen mit dem Horizont
          cc = mix(cc, col, smoothstep(0.08, 0.0, d.y) * 0.55);
          col = mix(col, cc, cov * 0.92);
        }
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
