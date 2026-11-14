// Wasserfälle (fließende Bänder, die ins Wolkenmeer stürzen) und Nebelschwaden (Billboards).
import * as THREE from 'three';
import { GLSL_SKY, GLSL_NOISE, GLSL_FOG } from './shaders.js';
import { CLOUD_TOP } from './clouds.js';

/**
 * falls: [{ x, y, z, dx, dz, width, drop }] – Startpunkt an der Klippe, Richtung nach außen, Fallhöhe.
 */
export function createWaterfalls(U, falls) {
  const pos = [], uv = [], fall = [], idx = [];
  const segs = 44, across = 6;
  for (const f of falls) {
    for (let layer = 0; layer < 2; layer++) {
      const base = pos.length / 3;
      const d = new THREE.Vector2(f.dx, f.dz).normalize();
      const side = new THREE.Vector2(-d.y, d.x);
      const push = f.push ?? 3.2;
      const wid = f.width * (layer ? 0.72 : 1.0);
      const off = layer ? 0.35 : 0;
      for (let i = 0; i <= segs; i++) {
        const s = i / segs;
        // ballistische Kurve: erst nach außen, dann senkrecht
        const t = s;
        const out = push * Math.sqrt(t) * (1 - 0.25 * t) + off + 1.2 * t;
        const y = f.y - f.drop * t * t * 0.96 - 0.4 * t;
        const w = wid * (1 + 0.9 * t);
        for (let j = 0; j <= across; j++) {
          const u = j / across;
          const a = u * 2 - 1;
          const bulge = (1 - a * a) * 0.5 * (0.3 + t);
          const x = f.x + d.x * (out + bulge) + side.x * a * w * 0.5;
          const z = f.z + d.y * (out + bulge) + side.y * a * w * 0.5;
          pos.push(x, y, z);
          // v in Welteinheiten entlang der Strecke (für gleichmäßiges Strömen)
          uv.push(u + layer * 0.37, (f.drop * t * t + push * Math.sqrt(t)) / 6 + layer * 0.5);
          fall.push(t);
        }
      }
      for (let i = 0; i < segs; i++) {
        for (let j = 0; j < across; j++) {
          const a0 = base + i * (across + 1) + j, a1 = a0 + across + 1;
          idx.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('fall', new THREE.Float32BufferAttribute(fall, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunDir: U.uSunDir, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog },
    vertexShader: /* glsl */ `
      attribute float fall;
      varying vec2 vUv; varying float vFall; varying vec3 vW;
      void main() { vUv = uv; vFall = fall; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying float vFall; varying vec3 vW;
      ${GLSL_SKY}
      ${GLSL_FOG}
      ${GLSL_NOISE}
      void main() {
        float speed = 1.6;
        vec2 q = vec2(vUv.x * 7.0, vUv.y - uTime * speed);
        float streak = fbm(vec2(q.x * 1.6, q.y * 1.2));
        float streak2 = vnoise(vec2(q.x * 5.0, q.y * 3.0 - uTime * 0.7));
        float foam = smoothstep(0.45, 0.8, streak * 0.75 + streak2 * 0.4);
        float sideFade = smoothstep(0.0, 0.22, vUv.x - floor(vUv.x)) * smoothstep(1.0, 0.78, vUv.x - floor(vUv.x));
        vec3 deep = vec3(0.16, 0.34, 0.40);
        vec3 bright = vec3(1.05, 1.08, 1.1);
        vec3 col = mix(deep, bright, foam);
        // Sonnenlicht von oben/hinten, Lippe leuchtet
        float sunAmt = clamp(dot(normalize(vW - cameraPosition), uSunDir), 0.0, 1.0);
        col *= 0.8 + 0.6 * pow(sunAmt, 3.0);
        col += vec3(0.8, 1.0, 1.0) * smoothstep(0.12, 0.0, vFall) * 0.6;
        float a = sideFade * (0.55 + 0.45 * foam) * smoothstep(1.0, 0.55, vFall) * smoothstep(0.0, 0.02, vFall + 0.01);
        col = applyHaze(col, vW);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'aeth-waterfalls';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

/** Nebelschwaden: kamerazugewandte, weiche Wolkenfetzen. items: [{x,y,z,s,a,kind}] kind 0 Wolke, 1 Gischt */
export function createWisps(U, tex, items) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunDir: U.uSunDir, uTex: { value: tex }, uFogDensity: U.uFogDensity, uHeightFog: U.uHeightFog },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 wisp; // alpha, kind, seed, stretch
      varying vec2 vUv; varying vec4 vWisp; varying vec3 vW; varying float vSteep;
      void main() {
        vUv = uv; vWisp = wisp;
        vec3 c = instanceMatrix[3].xyz;
        float s = length(instanceMatrix[0].xyz);
        float seed = wisp.z;
        c.x += sin(uTime * 0.05 + seed * 6.28) * 6.0 * (1.0 - wisp.y);
        c.z += cos(uTime * 0.04 + seed * 3.1) * 3.0 * (1.0 - wisp.y);
        vW = c;
        // Wolkenbänke nur flach über dem Horizont sichtbar (kein Schleier über den Inseln von oben)
        vSteep = clamp(-normalize(c - cameraPosition).y, 0.0, 1.0);
        float rot = seed * 6.28 + uTime * 0.02 * (seed - 0.5);
        vec2 p = position.xy * vec2(wisp.w, 1.0);
        p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = c + (right * p.x + up * p.y) * s;
        wp.y = max(wp.y, ${(CLOUD_TOP + 1.5).toFixed(1)});
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uTime;
      varying vec2 vUv; varying vec4 vWisp; varying vec3 vW; varying float vSteep;
      ${GLSL_SKY}
      ${GLSL_FOG}
      void main() {
        float a = texture2D(uTex, vUv).a * vWisp.x;
        a *= mix(1.0 - smoothstep(0.18, 0.5, vSteep) * 0.85, 1.0, vWisp.y);
        if (a < 0.003) discard;
        vec3 d = normalize(vW - cameraPosition);
        float sunAmt = max(dot(d, uSunDir), 0.0);
        vec3 lit = mix(vec3(0.66, 0.74, 0.86), vec3(1.15, 0.95, 0.74), pow(sunAmt, 2.0));
        vec3 spray = vec3(0.85, 0.95, 1.0);
        vec3 col = mix(lit, spray, vWisp.y) * (0.75 + 0.25 * vUv.y);
        col = applyHaze(col, vW);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(quad, mat, items.length);
  const wisp = new Float32Array(items.length * 4);
  const m = new THREE.Matrix4();
  items.forEach((it, i) => {
    m.makeScale(it.s, it.s, it.s);
    m.setPosition(it.x, it.y, it.z);
    mesh.setMatrixAt(i, m);
    wisp[i * 4] = it.a; wisp[i * 4 + 1] = it.kind || 0; wisp[i * 4 + 2] = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.5 + 0.5; wisp[i * 4 + 3] = it.stretch || 1.6;
  });
  quad.setAttribute('wisp', new THREE.InstancedBufferAttribute(wisp, 4));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.name = 'aeth-wisps';
  return mesh;
}
