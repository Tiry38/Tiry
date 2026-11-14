// Himmel: echtes HDRI (Poly Haven, CC0) im oberen Halbraum, nahtlos in den biomgesteuerten Dunst-Verlauf am
// Horizont übergeblendet (Wolkenmeer und Luftperspektive nutzen dieselben, aus dem HDRI gemessenen Farben).
// Ohne HDRI: prozeduraler Verlauf mit Zirren und Haufenwolken. Sonnenscheibe + Halo in HDR (→ Bloom/God Rays).
import * as THREE from 'three';
import { GLSL_SKY, GLSL_NOISE, skyU } from './shaders.js';

/** Gemeinsame HDRI-Uniforms (ein Objekt für Himmel + Umgebungs-Erfassung). */
export function createSkyUniforms() {
  return {
    uHdri: { value: null }, uHasHdri: { value: 0 }, uHdriRot: { value: 0 }, uHdriScale: { value: 1 },
    uHdriTint: { value: new THREE.Color(1, 1, 1) }, uHdriSat: { value: 1 }, uSunDisc: { value: 1 },
  };
}

export function createSky(U, S, { forEnv = false } = {}) {
  const geo = new THREE.SphereGeometry(forEnv ? 500 : 10, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, ...skyU(U), ...S, uEnv: { value: forEnv ? 1 : 0 } },
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
      uniform sampler2D uHdri;
      uniform float uHasHdri, uHdriRot, uHdriScale, uHdriSat, uSunDisc;
      uniform vec3 uHdriTint;
      varying vec3 vDir;
      ${GLSL_SKY}
      ${GLSL_NOISE}
      vec3 hdri(vec3 d) {
        float phi = atan(d.z, d.x) + uHdriRot;
        vec2 uv = vec2(phi * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 c = textureLod(uHdri, uv, 0.0).rgb * uHdriScale;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(l), c, uHdriSat), 0.0) * uHdriTint;
        // Sonne im HDRI begrenzen (eigene Sonnenscheibe + Richtungslicht übernehmen)
        return min(c, vec3(uEnv > 0.5 ? 3.0 : 24.0));
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float sd = dot(d, uSunDir);
        if (uHasHdri > 0.5) {
          // Horizont: HDRI-Horizontlinie verschwindet im Dunst (passt zu Wolkenmeer und Luftperspektive)
          float k = smoothstep(0.004, 0.12, d.y);
          vec3 h = hdri(vec3(d.x, max(d.y, 0.004), d.z));
          col = mix(col, h, k);
          // Dunst über dem Horizont (Luftperspektive auch am Himmel)
          col = mix(col, hazeColor(d) * 1.12, (1.0 - smoothstep(0.0, 0.2, d.y)) * 0.35);
        } else {
          vec2 sdir = normalize(uSunDir.xz);
          // Zirren: hohe, gestreckte Schleier
          vec2 cp = d.xz / (d.y + 0.12) * 0.9;
          float cir = fbm(cp * vec2(0.7, 2.6) + vec2(uTime * 0.006, 0.0));
          cir = smoothstep(0.55, 0.9, cir) * smoothstep(0.03, 0.2, d.y) * smoothstep(0.95, 0.35, d.y);
          vec3 cirCol = mix(uSkyHorA * 1.6, uSunGlow * 1.7, pow(max(sd, 0.0), 4.0));
          col = mix(col, cirCol, cir * 0.45);
          // Haufenwolken in Horizontnähe (Licht von der Sonnenseite)
          if (d.y > -0.02) {
            vec2 q = d.xz / (d.y + 0.035) * 0.55 + vec2(uTime * 0.004, 0.0);
            vec2 wq = q + vec2(fbm(q * 0.6 + 3.0), fbm(q * 0.6 - 7.0)) * 1.2;
            float dens = fbm(wq * 0.9) * 0.75 + fbm(wq * 2.7) * 0.25;
            float band = smoothstep(-0.01, 0.03, d.y) * smoothstep(0.32, 0.05, d.y);
            float cov = smoothstep(0.50, 0.72, dens) * band;
            float ds = fbm((wq + sdir * 0.35) * 0.9) * 0.75 + fbm((wq + sdir * 0.35) * 2.7) * 0.25;
            float lit = clamp(0.5 + (dens - ds) * 6.0, 0.0, 1.0);
            float toward = pow(max(dot(normalize(d.xz + 1e-5), sdir), 0.0), 3.0);
            vec3 cLit = mix(uCloudLit, uCloudLit * vec3(1.7, 1.2, 0.8), toward) * 1.05;
            vec3 cSh = mix(uSkyHorA * 1.05, uSkyHorS * 0.7, toward);
            vec3 cc = mix(cSh, cLit, lit);
            cc += uSunGlow * 1.8 * pow(max(sd, 0.0), 24.0) * (1.0 - smoothstep(0.5, 0.8, dens)) * 3.0;
            cc = mix(cc, col, smoothstep(0.08, 0.0, d.y) * 0.55);
            col = mix(col, cc, cov * 0.92);
          }
        }
        // Sonnenscheibe (HDR -> Bloom), in der Umgebungs-Erfassung abgeschwächt (Richtungslicht übernimmt)
        float disc = smoothstep(0.99935, 0.99972, sd);
        col += vec3(16.0, 10.0, 5.0) * disc * (uEnv > 0.5 ? 0.15 : 1.0) * uSunDisc;
        col += uSunGlow * pow(max(sd, 0.0), 1200.0) * 1.6 * uSunDisc;
        // leichter Dither gegen Banding
        col += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: !forEnv,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'aeth-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
