// Umgebungspartikel (eine Points-Geometrie, Bewegung komplett im Vertex-Shader):
// 0 Glühwürmchen, 1 Pollen/Staub im Sonnenlicht, 2 Portal-Funken, 3 Funken am Kristallturm.
import * as THREE from 'three';
import { rng } from './noise.js';

export function createParticles(U, { fixed = [], scalable = [] }) {
  const R = rng(77);
  // skalierbare Partikel mischen, damit drawRange beide Arten anteilig kürzt
  for (let i = scalable.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [scalable[i], scalable[j]] = [scalable[j], scalable[i]];
  }
  const all = fixed.concat(scalable);
  const n = all.length;
  const pos = new Float32Array(n * 3), data = new Float32Array(n * 4), col = new Float32Array(n * 3);
  all.forEach((p, i) => {
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    data[i * 4] = p.kind; data[i * 4 + 1] = R() * 100; data[i * 4 + 2] = p.size; data[i * 4 + 3] = p.range ?? 1;
    col[i * 3] = p.c[0]; col[i * 3 + 1] = p.c[1]; col[i * 3 + 2] = p.c[2];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('pdata', new THREE.BufferAttribute(data, 4));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: { value: 800 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute vec4 pdata; attribute vec3 color;
      varying vec3 vCol; varying float vA;
      void main() {
        float kind = pdata.x, ph = pdata.y, size = pdata.z, range = pdata.w;
        vec3 p = position;
        float a = 1.0;
        if (kind < 0.5) {
          float t = uTime * (0.25 + fract(ph) * 0.3);
          p += vec3(sin(t + ph) * 1.8 + sin(t * 2.3 + ph * 2.0) * 0.5, sin(t * 1.3 + ph * 3.0) * 0.7, cos(t * 0.9 + ph) * 1.8);
          a = smoothstep(0.2, 1.0, 0.5 + 0.5 * sin(uTime * (1.2 + fract(ph * 7.0)) + ph * 5.0));
        } else if (kind < 1.5) {
          float t = uTime * (0.4 + fract(ph) * 0.4);
          float up = mod(t * 0.5 + ph * 3.7, range);
          p += vec3(sin(t * 0.3 + ph) * 4.0, up, cos(t * 0.27 + ph) * 3.0);
          a = smoothstep(0.0, 0.15 * range, up) * smoothstep(range, range * 0.7, up) * (0.6 + 0.4 * sin(uTime * 2.0 + ph * 9.0));
        } else if (kind < 2.5) {
          // Portal: Funken quellen aus dem Rand und treiben nach vorn/oben
          float t = fract(uTime * (0.12 + fract(ph) * 0.15) + fract(ph * 3.1));
          float ang = ph * 6.28 + t * 2.5;
          float r = 4.4 + t * 1.2;
          p += vec3(cos(ang) * r, 5.2 + sin(ang) * r * 0.95 + t * 2.0, t * 7.0);
          a = smoothstep(0.0, 0.1, t) * (1.0 - t);
        } else {
          // Kristallturm: Spirale aufwärts
          float t = fract(uTime * (0.03 + fract(ph) * 0.03) + fract(ph * 5.3));
          float ang = ph * 6.28 + t * 9.0;
          float r = range * (0.6 + 0.4 * sin(ph * 4.0));
          p += vec3(cos(ang) * r, t * 40.0, sin(ang) * r);
          a = smoothstep(0.0, 0.1, t) * (1.0 - t);
        }
        vCol = color; vA = a;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(size * uScale / -mv.z, 0.0, 14.0);
        vA *= smoothstep(4.0, 12.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        float core = exp(-r2 * 7.0);
        float halo = exp(-r2 * 2.2) * 0.35;
        gl_FragColor = vec4(vCol * (core + halo) * vA, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.name = 'aeth-particles';
  points.renderOrder = 4;
  const fixedCount = fixed.length, scalableCount = scalable.length;
  const v = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(v);
    mat.uniforms.uScale.value = v.y * 0.5 * (camera.projectionMatrix.elements[5] || 1);
  };
  return {
    points,
    setFraction(f) { g.setDrawRange(0, fixedCount + Math.round(scalableCount * f)); },
  };
}
