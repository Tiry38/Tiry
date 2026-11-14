// Render-Kern: WebGL-Renderer, Kamera, Nachbearbeitung (Bloom, Ambient Occlusion, Farb-Grading).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.035 },
    uSat: { value: 1.08 }, uContrast: { value: 1.05 }, uAberration: { value: 0.0018 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 0.3, 0.2) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uAberration, uFlash; uniform vec3 uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d,d);
      vec2 off = d * uAberration * r2 * 4.0;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      // sanfte Teal/Orange-Abstimmung
      c += vec3(0.012, 0.004, -0.01) * smoothstep(0.35, 0.9, l) + vec3(-0.008, 0.0, 0.014) * (1.0 - smoothstep(0.0, 0.35, l));
      c *= 1.0 - uVignette * smoothstep(0.08, 0.55, r2);
      c += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      c = mix(c, uFlashColor, uFlash * smoothstep(0.05, 0.5, r2));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export const QUALITY = {
  low: { pixel: 0.75, shadows: false, bloom: true, ao: false, msaa: 0, particles: 0.4 },
  medium: { pixel: 1, shadows: true, bloom: true, ao: false, msaa: 2, particles: 0.7 },
  high: { pixel: 1.25, shadows: true, bloom: true, ao: false, msaa: 4, particles: 1 },
  ultra: { pixel: 2, shadows: true, bloom: true, ao: true, msaa: 4, particles: 1.3 },
};

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2500);
    this.camera.position.set(0, 120, 160);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;
    this.flash = 0;
    this.buildComposer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get q() { return QUALITY[this.settings.get('quality')] || QUALITY.high; }

  buildComposer() {
    const q = this.q;
    if (this.composer) this.composer.dispose();
    const size = this.renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: this.settings.get('antialias') ? q.msaa : 0 });
    const c = (this.composer = new EffectComposer(this.renderer, rt));
    c.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (q.ao && this.settings.get('ao')) {
      this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.5, scale: 1 });
      c.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.62, 0.55, 0.86);
    this.bloom.enabled = this.settings.get('bloom') && q.bloom;
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
  }

  applySettings() {
    const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows && this.settings.get('shadows');
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
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
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
  }

  hitFlash(strength = 0.35, color = 0xff3a2a) {
    this.flash = Math.max(this.flash, strength);
    this.grade.uniforms.uFlashColor.value.set(color);
  }

  render(dt) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 1.4);
    const u = this.grade.uniforms;
    u.uTime.value = this.time % 100;
    u.uFlash.value = this.flash;
    u.uGrain.value = this.settings.get('filmGrain') ? 0.03 : 0;
    this.composer.render(dt);
  }
}
