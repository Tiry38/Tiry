// Render-Kern: WebGL-Renderer, Kamera und eine eigene HDR-Nachbearbeitungskette im Stil moderner Engines:
//   Szene (HDR, MSAA, Tiefentextur) → GTAO (Umgebungsverdeckung aus der Szenentiefe)
//   → Tiefenschärfe (optional, Menü-Kamerafahrten) → Lichtstrahlen (God Rays, nur wenn die Sonne im Bild ist)
//   → Bloom (nur helle/emissive Bereiche) → Filmisches Grading (Weißabgleich, Kontrast, Sättigung,
//   Split-Toning, ACES-Tonemapping) + CAS-Schärfung, Vignette, Korn, Treffer-Blitz.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------- Endbild: Grading + Tonemapping + Schärfen ----------
const CompositeShader = {
  uniforms: {
    tHDR: { value: null }, tRays: { value: null }, uRays: { value: 0 }, uRayColor: { value: new THREE.Color(1.0, 0.78, 0.5) },
    uTexel: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uExposure: { value: 1 }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1.12 }, uContrast: { value: 1.12 },
    uShadowTint: { value: new THREE.Vector3(-0.012, 0.0, 0.02) }, uHighTint: { value: new THREE.Vector3(0.018, 0.006, -0.016) },
    uLift: { value: 0.006 }, uSharpen: { value: 0.55 }, uVignette: { value: 0.2 }, uGrain: { value: 0.02 },
    uAberration: { value: 0.0009 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 0.3, 0.2) },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tHDR; uniform sampler2D tRays;
    uniform float uRays; uniform vec3 uRayColor;
    uniform vec2 uTexel; uniform float uTime;
    uniform float uExposure, uSat, uContrast, uLift, uSharpen, uVignette, uGrain, uAberration, uFlash;
    uniform vec3 uWB, uShadowTint, uHighTint, uFlashColor;
    varying vec2 vUv;

    // ACES (Stephen Hill: RRT+ODT-Fit, wie im UE4/UE5-Filmic-Tonemapper angenähert)
    const mat3 ACES_IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 ACES_OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c) { c = ACES_IN * c; c = rrtOdt(c); c = ACES_OUT * c; return clamp(c, 0.0, 1.0); }
    vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    vec3 grade(vec3 hdr) {
      vec3 c = max(hdr, 0.0) * uWB * (uExposure / 0.6);
      // Sättigung (szenenbezogen, Mitten kräftiger als Lichter)
      float l = luma(c);
      float satW = uSat * (1.0 - 0.18 * smoothstep(0.6, 4.0, l));
      c = max(mix(vec3(l), c, satW), 0.0);
      // Kontrast im Log-Raum um Mittelgrau 0.18
      c = 0.18 * pow(c / 0.18 + 1e-5, vec3(uContrast));
      c = aces(c);
      // Split-Toning (Schatten leicht kühl, Lichter leicht warm), Schwarz minimal angehoben
      float L = luma(c);
      c += uShadowTint * (1.0 - smoothstep(0.0, 0.32, L)) + uHighTint * smoothstep(0.45, 1.0, L);
      c = c * (1.0 - uLift) + uLift;
      return toSRGB(clamp(c, 0.0, 1.0));
    }
    vec3 hdrAt(vec2 uv) { return texture2D(tHDR, uv).rgb + texture2D(tRays, uv).rgb * uRayColor * uRays; }
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      // leichte chromatische Aberration nur zum Rand hin
      vec2 off = d * uAberration * r2 * 4.0;
      vec3 hc = vec3(texture2D(tHDR, vUv + off).r, texture2D(tHDR, vUv).g, texture2D(tHDR, vUv - off).b) + texture2D(tRays, vUv).rgb * uRayColor * uRays;
      // Kontrast-adaptive Schärfung (AMD-CAS-Prinzip) auf HDR, Gewichte aus wahrnehmungsnaher Luminanz
      if (uSharpen > 0.0) {
        vec3 a = hdrAt(vUv + vec2(0.0, -uTexel.y));
        vec3 b = hdrAt(vUv + vec2(-uTexel.x, 0.0));
        vec3 e = hdrAt(vUv + vec2(uTexel.x, 0.0));
        vec3 f = hdrAt(vUv + vec2(0.0, uTexel.y));
        vec4 L4 = vec4(luma(a), luma(b), luma(e), luma(f));
        L4 = L4 / (1.0 + L4);
        float lc = luma(hc); lc = lc / (1.0 + lc);
        float mn = min(min(min(L4.x, L4.y), min(L4.z, L4.w)), lc);
        float mx = max(max(max(L4.x, L4.y), max(L4.z, L4.w)), lc);
        float amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
        float w = amp * (-1.0 / mix(8.0, 4.6, uSharpen));
        hc = max((hc + (a + b + e + f) * w) / (1.0 + 4.0 * w), 0.0);
      }
      vec3 c = grade(hc);
      c *= 1.0 - uVignette * smoothstep(0.1, 0.62, r2 * 1.6);
      c += (hash(gl_FragCoord.xy + fract(uTime) * 917.0) - 0.5) * uGrain;
      c = mix(c, uFlashColor, uFlash * smoothstep(0.05, 0.5, r2));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// ---------- Tiefenschärfe (Gather-Bokeh mit Tiefen-Gewichtung, Autofokus auf Bildmitte) ----------
const DofShader = {
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.5 }, uFar: { value: 2500 }, uFocus: { value: -1 }, uAperture: { value: 14 }, uMaxBlur: { value: 14 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uTexel;
    uniform float uNear, uFar, uFocus, uAperture, uMaxBlur;
    varying vec2 vUv;
    float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    float coc(float z, float f) { return clamp(abs(z - f) / max(z, 1e-3) * uAperture, 0.0, uMaxBlur); }
    void main() {
      float f = uFocus > 0.0 ? uFocus : linZ(texture2D(tDepth, vec2(0.5, 0.45)).x);
      float zc = linZ(texture2D(tDepth, vUv).x);
      float cc = coc(zc, f);
      vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
      if (cc > 0.6) {
        const int N = 40;
        const float GA = 2.39996323;
        for (int i = 1; i < N; i++) {
          float fi = float(i);
          float r = sqrt(fi / float(N)) * uMaxBlur;
          vec2 o = vec2(cos(fi * GA), sin(fi * GA)) * r;
          vec2 uv = vUv + o * uTexel;
          float zs = linZ(texture2D(tDepth, uv).x);
          float cs = coc(zs, f);
          if (zs > zc) cs = min(cs, cc * 1.5);     // Hintergrund blutet nicht in scharfen Vordergrund
          float w = smoothstep(r - 1.5, r + 0.5, cs);
          acc += texture2D(tColor, uv).rgb * w; wsum += w;
        }
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};

// ---------- Lichtstrahlen: Himmels-Maske + radiale Unschärfe zur Sonne ----------
const RayMaskShader = {
  uniforms: { tColor: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAspect;
    varying vec2 vUv;
    void main() {
      float d = texture2D(tDepth, vUv).x;
      float sky = smoothstep(0.99990, 0.999995, d);
      vec3 c = texture2D(tColor, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
      float fall = exp(-dot(dv, dv) * 9.0);
      gl_FragColor = vec4(c * smoothstep(1.2, 6.0, l) * sky * fall, 1.0);
    }`,
};
const RayBlurShader = {
  uniforms: { tMask: { value: null }, uSun: { value: new THREE.Vector2() }, uLen: { value: 0.9 } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tMask; uniform vec2 uSun; uniform float uLen;
    varying vec2 vUv;
    void main() {
      const int N = 36;
      vec2 delta = (vUv - uSun) * uLen / float(N);
      vec2 uv = vUv;
      vec3 acc = vec3(0.0); float illum = 1.0, wsum = 0.0;
      for (int i = 0; i < N; i++) { acc += texture2D(tMask, uv).rgb * illum; wsum += illum; illum *= 0.965; uv -= delta; }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};

export const QUALITY = {
  low: { pixel: 0.75, shadows: false, bloom: true, ao: false, aoScale: 0.5, msaa: 0, particles: 0.4, rays: false, sharpen: 0.35 },
  medium: { pixel: 1, shadows: true, bloom: true, ao: false, aoScale: 0.5, msaa: 2, particles: 0.7, rays: true, sharpen: 0.5 },
  high: { pixel: 1.25, shadows: true, bloom: true, ao: true, aoScale: 0.5, msaa: 4, particles: 1, rays: true, sharpen: 0.55 },
  ultra: { pixel: 2, shadows: true, bloom: true, ao: true, aoScale: 1, msaa: 4, particles: 1.3, rays: true, sharpen: 0.55 },
};

const rt = (w, h, opts = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...opts });

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    // Tonemapping übernimmt der eigene Grading-Pass (ACES + Look); Szene wird linear in HDR gerendert.
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2500);
    this.camera.position.set(0, 120, 160);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;
    this.flash = 0;
    this.dof = { enabled: false, focus: -1 };
    this.stats = { sceneCalls: 0, calls: 0, triangles: 0 };
    // Look-Parameter (zur Laufzeit justierbar: window.__app.engine.look)
    this.look = { exposure: 1.0, temperature: 0.12, tint: 0.0, saturation: 1.12, contrast: 1.1, bloom: 0.3, bloomRadius: 0.3, bloomThreshold: 2.4, rays: 0.5, aoIntensity: 1.0, aoRadius: 2.0 };
    this.quad = new FullScreenQuad(null);
    this.compositeMat = new THREE.ShaderMaterial({ ...CompositeShader, uniforms: THREE.UniformsUtils.clone(CompositeShader.uniforms), depthTest: false, depthWrite: false });
    this.dofMat = new THREE.ShaderMaterial({ ...DofShader, uniforms: THREE.UniformsUtils.clone(DofShader.uniforms), depthTest: false, depthWrite: false });
    this.rayMaskMat = new THREE.ShaderMaterial({ ...RayMaskShader, uniforms: THREE.UniformsUtils.clone(RayMaskShader.uniforms), depthTest: false, depthWrite: false });
    this.rayBlurMat = new THREE.ShaderMaterial({ ...RayBlurShader, uniforms: THREE.UniformsUtils.clone(RayBlurShader.uniforms), depthTest: false, depthWrite: false });
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    this.buildComposer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get q() { return QUALITY[this.settings.get('quality')] || QUALITY.high; }

  disposeTargets() {
    for (const t of [this.sceneRT, this.rtA, this.rtB, this.rayA, this.rayB]) t?.dispose();
    this.bloom?.dispose();
    if (this.ao) { this.ao.dispose(); this.ao.gtaoMaterial?.dispose(); this.ao.blendMaterial?.dispose(); }
  }

  buildComposer() {
    const q = this.q;
    this.disposeTargets();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, size.x), h = Math.max(1, size.y);
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: this.settings.get('antialias') ? q.msaa : 0, depthBuffer: true, depthTexture,
    });
    this.rtA = rt(w, h);
    this.rtB = rt(w, h);
    this.rayA = rt(Math.ceil(w / 2), Math.ceil(h / 2));
    this.rayB = rt(Math.ceil(w / 2), Math.ceil(h / 2));
    this.ao = null;
    this._aoRadius = null;
    if (q.ao && this.settings.get('ao')) {
      const s = q.aoScale;
      this.ao = new GTAOPass(this.scene, this.camera, Math.ceil(w * s), Math.ceil(h * s));
      this.ao.setGBuffer(depthTexture, null);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), this.look.bloom, this.look.bloomRadius, this.look.bloomThreshold);
    this.bloom.enabled = this.settings.get('bloom') && q.bloom;
    this.size = { w, h };
  }

  applySettings() {
    const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows && this.settings.get('shadows');
    this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    this.buildComposer();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pixel) * (this.settings.get('renderScale') || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const bw = Math.max(1, size.x), bh = Math.max(1, size.y);
    if (!this.size || this.size.w !== bw || this.size.h !== bh) {
      if (this.sceneRT) {
        this.sceneRT.setSize(bw, bh);
        this.rtA.setSize(bw, bh); this.rtB.setSize(bw, bh);
        this.rayA.setSize(Math.ceil(bw / 2), Math.ceil(bh / 2)); this.rayB.setSize(Math.ceil(bw / 2), Math.ceil(bh / 2));
        if (this.ao) this.ao.setSize(Math.ceil(bw * this.q.aoScale), Math.ceil(bh * this.q.aoScale));
        this.bloom.setSize(bw, bh);
      }
      this.size = { w: bw, h: bh };
    }
  }

  /** Tiefenschärfe für Kamerafahrten (Menü). focusDistance in Welteinheiten; ohne Angabe Autofokus auf die Bildmitte. */
  setDof(enabled, focusDistance) {
    this.dof.enabled = !!enabled;
    this.dof.focus = focusDistance > 0 ? focusDistance : -1;
  }

  hitFlash(strength = 0.35, color = 0xff3a2a) {
    this.flash = Math.max(this.flash, strength);
    this.compositeMat.uniforms.uFlashColor.value.set(color);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render(dt) {
    const r = this.renderer, L = this.look, q = this.q;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 1.4);
    r.info.reset();
    const pre = this.scene.userData.aethPreRender;
    if (pre) pre(this.camera, this);

    // 1) Szene in HDR
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.scene, this.camera);
    this.stats.sceneCalls = r.info.render.calls;
    let src = this.sceneRT;
    const next = () => (src === this.rtA ? this.rtB : this.rtA);
    const depth = this.sceneRT.depthTexture;

    // 2) Umgebungsverdeckung
    if (this.ao) {
      this.ao.blendIntensity = L.aoIntensity;
      if (this._aoRadius !== L.aoRadius) {
        this._aoRadius = L.aoRadius;
        this.ao.updateGtaoMaterial({ radius: L.aoRadius, distanceExponent: 1.4, thickness: 2.5, scale: 1.7, samples: 12 });
      }
      const dst = next();
      this.ao.render(r, dst, src);
      src = dst;
    }

    // 3) Tiefenschärfe
    if (this.dof.enabled) {
      const u = this.dofMat.uniforms;
      u.tColor.value = src.texture; u.tDepth.value = depth;
      u.uTexel.value.set(1 / this.size.w, 1 / this.size.h);
      u.uNear.value = this.camera.near; u.uFar.value = this.camera.far; u.uFocus.value = this.dof.focus;
      const s = this.size.h / 900;
      u.uAperture.value = 12 * s; u.uMaxBlur.value = 11 * s;
      const dst = next();
      this.pass(this.dofMat, dst);
      src = dst;
    }

    // 4) Lichtstrahlen (nur wenn die Sonne vor der Kamera und nahe am Bild ist)
    let rays = 0;
    const sunDir = this.scene.userData.aethSunDir;
    if (q.rays && sunDir && L.rays > 0) {
      const cam = this.camera;
      const fwd = _v1.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const facing = fwd.dot(sunDir);
      if (facing > 0.15) {
        _v2.copy(cam.position).addScaledVector(sunDir, 1000).project(cam);
        const sx = _v2.x * 0.5 + 0.5, sy = _v2.y * 0.5 + 0.5;
        const outside = Math.max(0, Math.abs(sx - 0.5) - 0.5, Math.abs(sy - 0.5) - 0.5);
        rays = L.rays * THREE.MathUtils.smoothstep(facing, 0.15, 0.5) * (1 - THREE.MathUtils.smoothstep(outside, 0.0, 0.6));
        if (rays > 0.01) {
          const mu = this.rayMaskMat.uniforms;
          mu.tColor.value = src.texture; mu.tDepth.value = depth; mu.uSun.value.set(sx, sy); mu.uAspect.value = this.size.w / this.size.h;
          this.pass(this.rayMaskMat, this.rayA);
          const bu = this.rayBlurMat.uniforms;
          bu.uSun.value.set(sx, sy);
          bu.tMask.value = this.rayA.texture; bu.uLen.value = 0.85;
          this.pass(this.rayBlurMat, this.rayB);
          bu.tMask.value = this.rayB.texture; bu.uLen.value = 0.3;
          this.pass(this.rayBlurMat, this.rayA);
        } else rays = 0;
      }
    }

    // 5) Bloom (addiert auf src)
    if (this.bloom.enabled) {
      this.bloom.strength = L.bloom; this.bloom.radius = L.bloomRadius; this.bloom.threshold = L.bloomThreshold;
      this.bloom.render(r, null, src, dt, false);
    }

    // 6) Grading + Tonemapping + Schärfen → Bildschirm
    const u = this.compositeMat.uniforms;
    u.tHDR.value = src.texture;
    u.tRays.value = rays > 0 ? this.rayA.texture : this.black;
    u.uRays.value = rays;
    u.uTexel.value.set(1 / this.size.w, 1 / this.size.h);
    u.uTime.value = this.time % 100;
    u.uFlash.value = this.flash;
    u.uGrain.value = this.settings.get('filmGrain') ? 0.022 : 0;
    u.uExposure.value = L.exposure;
    u.uSat.value = L.saturation;
    u.uContrast.value = L.contrast;
    u.uSharpen.value = q.sharpen;
    // Weißabgleich: Temperatur (+ wärmer / − kühler), Tönung (+ magenta / − grün)
    u.uWB.value.set(1 + L.temperature * 0.1, 1 - L.tint * 0.05, 1 - L.temperature * 0.1);
    this.pass(this.compositeMat, null);
    this.stats.calls = r.info.render.calls;
    this.stats.triangles = r.info.render.triangles;
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
