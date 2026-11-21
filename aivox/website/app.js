(() => {
  'use strict';
  if (!document.body.dataset.page) document.body.dataset.page = 'start'; // eingebettete Startseite ohne body-Attribute
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ohne Speicher */ } },
  };
  const SPEC = [[47, 140, 255], [127, 212, 255], [255, 255, 255], [255, 179, 64], [255, 74, 36]];
  const specAt = (t) => {
    t = Math.max(0, Math.min(1, t)) * (SPEC.length - 1);
    const i = Math.min(SPEC.length - 2, Math.floor(t)), f = t - i, a = SPEC[i], b = SPEC[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  /* ===================== Audio-Kern ===================== */
  const A = { ctx: null, analyser: null, wave: null, freq: null, sfxOut: null, noise: null, sfx: false, els: new Map() };
  const ensureCtx = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();
      A.analyser = A.ctx.createAnalyser(); A.analyser.fftSize = 1024; A.analyser.smoothingTimeConstant = 0.55;
      A.analyser.connect(A.ctx.destination);
      A.wave = new Uint8Array(A.analyser.fftSize); A.freq = new Uint8Array(A.analyser.frequencyBinCount);
      A.sfxOut = A.ctx.createGain(); A.sfxOut.gain.value = 0.55; A.sfxOut.connect(A.ctx.destination);
      const len = A.ctx.sampleRate; A.noise = A.ctx.createBuffer(1, len, len);
      const d = A.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { A.ctx = null; return false; }
  };
  const audioEl = (src) => {
    if (A.els.has(src)) return A.els.get(src);
    const a = new Audio(src); a.preload = 'auto';
    if (A.ctx) { try { A.ctx.createMediaElementSource(a).connect(A.analyser); } catch (e) { /* spielt direkt */ } }
    A.els.set(src, a); return a;
  };

  /* ===================== Klangeffekte ===================== */
  const SFX = {
    ok() { return A.sfx && A.ctx; },
    tone(f, dur, type = 'sine', gain = 0.04, f2 = null, delay = 0) {
      if (!this.ok()) return;
      const t = A.ctx.currentTime + delay, o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(A.sfxOut); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, type, f1, f2, gain, delay = 0, q = 1) {
      if (!this.ok()) return;
      const t = A.ctx.currentTime + delay, s = A.ctx.createBufferSource(), fl = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
      s.buffer = A.noise; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl).connect(g).connect(A.sfxOut); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    },
    hover() { this.tone(2100, 0.035, 'sine', 0.012); },
    tick() { this.tone(2600, 0.045, 'sine', 0.03); this.tone(1300, 0.06, 'triangle', 0.015); },
    whoosh() { this.noise(0.55, 'bandpass', 300, 2800, 0.07, 0, 1.4); },
    zap() { this.noise(0.09, 'highpass', 2500, 6000, 0.05); this.tone(1400, 0.08, 'square', 0.012, 180); },
    chime() { this.tone(1046.5, 1.1, 'sine', 0.035); this.tone(1568, 1.3, 'sine', 0.025, null, 0.09); this.tone(2093, 1.4, 'sine', 0.012, null, 0.18); },
    boot() {
      this.tone(34, 2.2, 'sine', 0.24, 72);
      this.tone(68, 2, 'triangle', 0.05, 140);
      this.tone(90, 1.6, 'sawtooth', 0.025, 900);
      this.noise(1.6, 'lowpass', 180, 5000, 0.06, 0, 0.8);
      this.zap(); setTimeout(() => this.zap(), 700); setTimeout(() => this.zap(), 1450);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 1.8, 'sine', 0.022, null, 1.5 + i * 0.07));
      this.noise(1.2, 'highpass', 6000, 9000, 0.015, 1.5);
    },
  };
  const sndBtn = $('.snd');
  const setSfx = (on) => { A.sfx = !!on; sndBtn.setAttribute('aria-pressed', String(A.sfx)); };
  sndBtn.addEventListener('click', () => { if (!A.sfx) ensureCtx(); setSfx(!A.sfx); SFX.tick(); });
  let lastHover = 0;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('a, button, .chip, input[type="range"]');
    if (!el || el.contains(e.relatedTarget)) return;
    const n = performance.now(); if (n - lastHover > 70) { lastHover = n; SFX.hover(); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('a, button:not(.snd):not(.js-enter)')) SFX.tick(); });

  /* ===================== Pegel ===================== */
  const level = { v: 0, bands: [0, 0, 0, 0, 0, 0], who: 'idle', speaking: false };
  const readLevel = (t) => {
    let target = 0; const bands = [0, 0, 0, 0, 0, 0];
    if (level.speaking) {
      if (A.analyser && !level.direct) {
        A.analyser.getByteTimeDomainData(A.wave);
        let sum = 0; for (let i = 0; i < A.wave.length; i++) { const d = (A.wave[i] - 128) / 128; sum += d * d; }
        target = Math.min(1, Math.sqrt(sum / A.wave.length) * 5);
        A.analyser.getByteFrequencyData(A.freq);
        const e = [2, 6, 12, 24, 48, 96, 180];
        for (let b = 0; b < 6; b++) { let s = 0; for (let i = e[b]; i < e[b + 1]; i++) s += A.freq[i]; bands[b] = s / ((e[b + 1] - e[b]) * 255); }
      } else {
        target = 0.35 + 0.35 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.3));
        for (let b = 0; b < 6; b++) bands[b] = target * (0.5 + 0.5 * Math.sin(t * (4 + b * 2.7)));
      }
    }
    level.v += (target - level.v) * (target > level.v ? 0.45 : 0.12);
    for (let b = 0; b < 6; b++) level.bands[b] += (bands[b] - level.bands[b]) * 0.35;
  };

  /* ===================== Zeiger, Leuchtcursor, Neigen, Magnet ===================== */
  const pointer = { x: -1e4, y: -1e4, t: 0 };
  const glowC = $('.glowcursor');
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now();
    if (fine && !reduce) { glowC.classList.add('on'); glowC.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }
  }, { passive: true });
  addEventListener('pointerdown', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now(); }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot');
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--x', (e.clientX - r.left) + 'px'); el.style.setProperty('--y', (e.clientY - r.top) + 'px');
      if (fine && !reduce && el.classList.contains('tilt')) {
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 7).toFixed(2) + 'deg');
      }
    }
    const m = e.target.closest && e.target.closest('.magnetic');
    if (m && fine && !reduce) {
      const r = m.getBoundingClientRect();
      m.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1) + 'px');
      m.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px');
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest && e.target.closest('.tilt, .magnetic');
    if (el && !el.contains(e.relatedTarget)) ['--rx', '--ry', '--mx', '--my'].forEach((p) => el.style.removeProperty(p));
  });

  /* ===================== Stromlinie ===================== */
  let lastZap = 0;
  class Plasma {
    constructor(c) {
      this.c = c; this.g = c.getContext('2d'); this.kind = c.dataset.size; this.sparks = []; this.seed = Math.random() * 100;
      this.span = this.kind === 'intro' ? 0 : 1; this.spanTarget = this.span; this.resize();
    }
    resize() {
      const d = Math.min(devicePixelRatio || 1, 2), w = this.c.clientWidth, h = this.c.clientHeight;
      if (!w) return; this.d = d; this.w = w; this.h = h; this.c.width = Math.round(w * d); this.c.height = Math.round(h * d);
    }
    visible() { return this.c.offsetParent !== null || this.kind === 'intro'; }
    path(t, amp, phase, sharp, rect) {
      const { w, h } = this, mid = h / 2, n = Math.max(80, Math.floor(w / 5)), pts = [], B = level.bands;
      let px = null, py = null, prox = 0;
      if (rect && this.kind !== 'intro' && performance.now() - pointer.t < 2500 && !reduce) {
        px = pointer.x - rect.left; py = pointer.y - rect.top;
        prox = (px > -40 && px < w + 40 && py > -h * 0.6 && py < h * 1.6) ? Math.exp(-Math.abs(py - mid) / (h * 0.9)) : 0;
      }
      const half = this.span / 2;
      for (let i = 0; i <= n; i++) {
        const x = i / n, dx = Math.abs(x - 0.5);
        const mask = dx <= half ? Math.min(1, (half - dx) / 0.06 + 0.001) : 0;
        const env = Math.pow(Math.sin(Math.PI * x), 1.35) * mask;
        let y = Math.sin(x * 9 + t * 2.1 + phase) * (0.12 + B[0] * 0.9)
          + Math.sin(x * 23 - t * 3.7 + phase * 1.7) * (0.06 + B[1] * 0.7)
          + Math.sin(x * 47 + t * 6.3 + phase * 2.3) * (0.03 + B[2] * 0.55)
          + Math.sin(x * 91 - t * 9.1 + phase) * (B[3] * 0.4 + B[4] * 0.3);
        y = Math.tanh((y * amp + (Math.random() - 0.5) * sharp * amp) * 1.15) * env * h * (this.kind === 'intro' ? 0.32 : 0.36);
        if (prox > 0) {
          const d = x * w - px, gk = Math.exp(-(d * d) / (2 * 110 * 110));
          y += Math.max(-h * 0.42, Math.min(h * 0.42, (py - mid) * 0.6)) * gk * prox * mask;
        }
        pts.push([x * w, mid + y]);
      }
      return { pts, px, py, prox };
    }
    grad(alpha, warm) {
      const g = this.g, w = this.w, a = Math.max(0, 0.5 - this.span / 2) * w, b = Math.min(1, 0.5 + this.span / 2) * w;
      const gr = g.createLinearGradient(a, 0, b, 0);
      const stops = warm ? [[255, 179, 64], [255, 120, 60], [255, 230, 200], [255, 120, 60], [255, 74, 36]] : SPEC;
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      stops.forEach((c, i) => gr.addColorStop(0.1 + (i / (stops.length - 1)) * 0.8, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      return gr;
    }
    white() {
      const g = this.g, w = this.w, a = Math.max(0, 0.5 - this.span / 2) * w, b = Math.min(1, 0.5 + this.span / 2) * w;
      const gr = g.createLinearGradient(a, 0, b, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.12, 'rgba(255,255,255,1)'); gr.addColorStop(0.88, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      return gr;
    }
    stroke(pts, width, style, alpha) {
      const g = this.g;
      g.globalAlpha = alpha; g.strokeStyle = style; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
    bolt(x1, y1, x2, y2, color) {
      const split = (a, b, depth) => {
        if (depth === 0) return [a, b];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const m = [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * len * 0.35, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * len * 0.35];
        const l = split(a, m, depth - 1), r = split(m, b, depth - 1); return l.concat(r.slice(1));
      };
      const pts = split([x1, y1], [x2, y2], 5), g = this.g;
      [[8, 0.15], [2.6, 0.55], [1, 1]].forEach(([wd, al], i) => {
        g.globalAlpha = al; g.strokeStyle = i === 2 ? '#ffffff' : color; g.lineWidth = wd;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
      });
    }
    draw(t) {
      if (!this.visible() || !this.w) return;
      this.span += (this.spanTarget - this.span) * 0.045;
      const g = this.g, { w, h, d } = this;
      g.setTransform(d, 0, 0, d, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      const talk = level.who === 'ki', caller = level.who === 'anrufer';
      const amp = (reduce ? 0.06 : 0.07 + 0.03 * Math.sin(t * 0.8)) + level.v * (talk ? 1.5 : 1.0);
      const sharp = talk ? 0.1 + level.v * 0.22 : caller ? 0.06 : 0.04;
      const tt = reduce ? t * 0.2 : t;
      const rect = this.c.getBoundingClientRect();
      const { pts: main, px, py, prox } = this.path(tt, amp, this.seed, sharp, rect);
      const cx = w / 2, cy = h / 2;
      if (this.span < 0.08) {
        const r = 60 + 30 * Math.sin(t * 3), rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, 'rgba(240,250,255,1)'); rg.addColorStop(0.12, 'rgba(127,212,255,.7)'); rg.addColorStop(0.5, 'rgba(255,74,36,.15)'); rg.addColorStop(1, 'rgba(58,141,255,0)');
        g.globalAlpha = 1; g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      }
      if (this.span > 0.01) {
        this.stroke(main, (this.kind === 'big' ? 26 : 20) + level.v * 30, this.grad(1, caller), 0.08 + level.v * 0.08);
        this.stroke(main, 9 + level.v * 10, this.grad(1, caller), 0.24 + level.v * 0.2);
        this.stroke(main, 2.6, this.grad(1, caller), 0.8);
        this.stroke(main, 1.2, this.white(), 0.95);
        for (let k = 1; k <= 2; k++) {
          const p = this.path(tt * (1 + k * 0.13), amp * (0.7 + k * 0.25), this.seed + k * 2.1, sharp * 0.8, null).pts;
          this.stroke(p, 1, this.grad(1, caller), 0.3 + level.v * 0.3);
        }
      }
      if (px !== null && prox > 0.25 && this.span > 0.5 && px > 30 && px < w - 30) {
        const idx = Math.round((px / w) * (main.length - 1)), lp = main[Math.max(0, Math.min(main.length - 1, idx))];
        const dist = Math.hypot(px - lp[0], py - lp[1]);
        if (dist > 16 && dist < 150 && Math.random() < 0.55) {
          const c = specAt(px / w); this.bolt(lp[0], lp[1], px, py, `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
          const n = performance.now(); if (n - lastZap > 380) { lastZap = n; SFX.zap(); }
        }
      }
      if (!level.speaking && this.span > 0.9) {
        const p = ((t * 0.18 + this.seed) % 1.4) - 0.2;
        if (p > 0.05 && p < 0.95) {
          const [x, y] = main[Math.round(p * (main.length - 1))], c = specAt(p), r = 50, rg = g.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(0.25, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},.45)`); rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = 1; g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
      }
      if (!reduce && level.v > 0.35 && Math.random() < level.v * 0.9 && this.span > 0.3) {
        const k = 0.15 + Math.random() * 0.7, [x, y] = main[Math.floor(main.length * k)];
        this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 3.2, life: 1, c: specAt(k) });
      }
      this.sparks = this.sparks.filter((s) => (s.life -= 0.035) > 0);
      for (const s of this.sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.04;
        g.globalAlpha = s.life; g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, 1.4, 0, Math.PI * 2); g.fill();
        g.globalAlpha = s.life * 0.45; g.fillStyle = `rgb(${s.c[0] | 0},${s.c[1] | 0},${s.c[2] | 0})`; g.beginPath(); g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
  const plasmas = $$('.plasma').map((c) => new Plasma(c));
  const introPlasma = plasmas.find((p) => p.kind === 'intro');
  addEventListener('resize', () => plasmas.forEach((p) => p.resize()));

  /* ===================== Partikel-Schriftzug (Begrüßung) ===================== */
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 444 100"><g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="square"><path d="M4 96 L42 6 L80 96"/><path d="M114 6 V96"/><path d="M148 6 L188 96 L228 6"/><path d="M287.4 9.4 A44 44 0 1 0 312.6 9.4"/><path d="M362 6 L392 46 M410 54 L440 96 M440 6 L410 46 M392 54 L362 96"/></g><g fill="#fff"><circle cx="300" cy="51" r="7"/><circle cx="401" cy="50" r="4"/><rect x="296" y="0" width="8" height="22" rx="2"/></g></svg>`;
  const FX = {
    c: $('.intro-fx'), g: null, parts: [], dust: [], state: 'off', t0: 0, ring: -1, wave: -1, flash: 0, ready: false,
    init() {
      this.g = this.c.getContext('2d');
      this.resize();
      for (let i = 0; i < 140; i++) this.dust.push({ x: Math.random(), y: Math.random(), z: Math.random(), c: specAt(Math.random()) });
    },
    resize() {
      const d = Math.min(devicePixelRatio || 1, 1.5); this.d = d;
      this.w = this.c.clientWidth; this.h = this.c.clientHeight; this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
    },
    build() {
      const box = $('.intro-logo-space').getBoundingClientRect(), self = this;
      const img = new Image();
      img.onload = () => {
        const W = Math.max(200, Math.round(box.width)), H = Math.round(W / 4.44);
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        const og = oc.getContext('2d'); og.drawImage(img, 0, 0, W, H);
        const data = og.getImageData(0, 0, W, H).data, step = Math.max(2, Math.round(W / 330)), pts = [];
        for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 120) pts.push([x, y]);
        const max = 5200; while (pts.length > max) pts.splice((Math.random() * pts.length) | 0, 1);
        const ox = box.left + (box.width - W) / 2, oy = box.top + (box.height - H) / 2;
        self.parts = pts.map(([x, y]) => {
          const a = Math.random() * Math.PI * 2, r = Math.max(self.w, self.h) * (0.6 + Math.random() * 0.5);
          return { x: self.w / 2 + Math.cos(a) * r, y: self.h / 2 + Math.sin(a) * r, vx: 0, vy: 0, tx: ox + x, ty: oy + y,
            delay: Math.random() * 0.9 + (x / W) * 0.5, c: specAt(x / W), s: 1 + Math.random() * 1.2, k: x / W };
        });
        self.state = 'assemble'; self.t0 = performance.now(); self.ready = true;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);
    },
    explode() {
      this.state = 'explode';
      for (const p of this.parts) { const a = Math.atan2(p.y - this.h * 0.4, p.x - this.w / 2); const s = 6 + Math.random() * 14; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; }
    },
    draw(now) {
      if (this.state === 'off') return;
      const g = this.g, { w, h, d } = this, el = (now - this.t0) / 1000;
      g.setTransform(d, 0, 0, d, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = 'rgba(1,2,3,0.34)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      // farbige Nebel
      const breathe = 0.5 + 0.5 * Math.sin(now / 1400);
      [[0.18, 0.35, [47, 140, 255]], [0.82, 0.62, [255, 74, 36]], [0.5, 0.2, [255, 179, 64]]].forEach(([x, y, c], i) => {
        const r = Math.max(w, h) * (0.42 + 0.06 * Math.sin(now / 2000 + i)), rg = g.createRadialGradient(w * x, h * y, 0, w * x, h * y, r);
        rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.05 + 0.03 * breathe + level.v * 0.05})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
      });
      // Hyperraum-Sprung: Sterne rasen auf den Betrachter zu und bremsen ab
      if (!this.stars) this.stars = Array.from({ length: 560 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), c: specAt(Math.random()) }));
      {
        const sp = reduce ? 0.0008 : (el < 1.8 ? 0.05 * (1 - el / 1.8) ** 2 : 0) + 0.0016 + level.v * 0.004;
        const cx0 = w / 2, cy0 = h / 2, f = Math.max(w, h) * 0.32;
        g.lineCap = 'round';
        for (const s of this.stars) {
          s.z -= sp;
          if (s.z <= 0.03) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; continue; }
          const x1 = cx0 + (s.x / s.z) * f, y1 = cy0 + (s.y / s.z) * f, zb = s.z + sp * 7, x0 = cx0 + (s.x / zb) * f, y0 = cy0 + (s.y / zb) * f;
          if (x1 < -50 || x1 > w + 50 || y1 < -50 || y1 > h + 50) { s.z = 1; continue; }
          const k = 1 - s.z;
          g.globalAlpha = Math.min(1, k * 1.3); g.strokeStyle = `rgb(${s.c[0] | 0},${s.c[1] | 0},${s.c[2] | 0})`; g.lineWidth = 0.4 + k * 2.2;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
      }
      // Sternenstaub
      for (const s of this.dust) {
        s.y -= 0.0004 * (0.3 + s.z); if (s.y < 0) s.y = 1;
        g.globalAlpha = 0.25 + s.z * 0.5; g.fillStyle = `rgb(${s.c[0] | 0},${s.c[1] | 0},${s.c[2] | 0})`;
        g.fillRect(s.x * w, s.y * h, 1 + s.z, 1 + s.z);
      }
      // Partikel
      const waveX = this.wave >= 0 ? ((now - this.wave) / 1100) : -1;
      for (const p of this.parts) {
        if (this.state === 'explode') { p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97; }
        else if (el > p.delay || reduce) {
          const k = reduce ? 1 : 0.075, damp = 0.8;
          p.vx = (p.vx + (p.tx - p.x) * k) * damp; p.vy = (p.vy + (p.ty - p.y) * k) * damp;
          p.x += p.vx; p.y += p.vy;
        } else { p.x += (w / 2 - p.x) * 0.002; p.y += (h / 2 - p.y) * 0.002; }
        let jx = 0, jy = 0;
        if (this.state !== 'explode' && el > 2) {
          const j = 0.25 + level.v * 3.2; jx = (Math.random() - 0.5) * j; jy = (Math.random() - 0.5) * j;
        }
        let boost = 0;
        if (waveX >= 0 && waveX < 1.4) boost = Math.max(0, 1 - Math.abs(p.k - waveX) * 6);
        const size = p.s + boost * 2.2 + level.v * 0.8;
        g.globalAlpha = Math.min(1, 0.55 + boost + level.v * 0.4);
        g.fillStyle = boost > 0.3 ? '#ffffff' : `rgb(${p.c[0] | 0},${p.c[1] | 0},${p.c[2] | 0})`;
        g.fillRect(p.x + jx, p.y + jy, size, size);
      }
      // Lichtblitz und Schockwelle nach dem Zusammensetzen
      if (this.state === 'assemble' && el > 1.9 && this.ring < 0) { this.ring = now; this.flash = 1; this.wave = now; $('.intro').classList.add('lock'); SFX.zap(); SFX.tone(70, 1.2, 'sine', 0.08, 38); }
      if (this.ring > 0) {
        const re = (now - this.ring) / 1400;
        if (re < 1) {
          const cx = w / 2, cy = $('.intro-logo-space').getBoundingClientRect().top + $('.intro-logo-space').getBoundingClientRect().height / 2, R = re * Math.max(w, h) * 0.75;
          const grd = g.createLinearGradient(cx - R, 0, cx + R, 0); SPEC.forEach((c, i) => grd.addColorStop(i / 4, `rgba(${c[0]},${c[1]},${c[2]},${(1 - re) * 0.8})`));
          g.globalAlpha = 1; g.strokeStyle = grd; g.lineWidth = 3 * (1 - re) + 0.5; g.beginPath(); g.ellipse(cx, cy, R, R * 0.38, 0, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 14 * (1 - re); g.globalAlpha = 0.12; g.stroke();
        }
      }
      if (this.flash > 0.01) {
        const b = $('.intro-logo-space').getBoundingClientRect(), cy = b.top + b.height / 2, lg = g.createLinearGradient(0, 0, w, 0);
        lg.addColorStop(0, 'rgba(47,140,255,0)'); lg.addColorStop(0.35, `rgba(127,212,255,${this.flash * 0.6})`); lg.addColorStop(0.5, `rgba(255,255,255,${this.flash})`); lg.addColorStop(0.65, `rgba(255,179,64,${this.flash * 0.6})`); lg.addColorStop(1, 'rgba(255,74,36,0)');
        g.globalAlpha = 1; g.fillStyle = lg; g.fillRect(0, cy - 1.5, w, 3);
        g.globalAlpha = this.flash * 0.25; g.fillRect(0, cy - 18, w, 36);
        this.flash *= 0.94;
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
  };

  /* ===================== Text-Dekodierung ===================== */
  const GLYPHS = 'AIVOX01<>/\\|#*+=:;ÄÖÜ';
  const decode = (el) => {
    if (reduce || !el) return;
    const nodes = []; const walk = (n) => n.childNodes.forEach((c) => (c.nodeType === 3 ? nodes.push(c) : walk(c)));
    walk(el);
    const orig = nodes.map((n) => (n.__o = n.__o || n.textContent));
    const total = orig.reduce((s, x) => s + x.length, 0), start = performance.now(), dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur), shown = Math.floor(k * total); let c = 0;
      nodes.forEach((n, i) => { n.textContent = [...orig[i]].map((ch) => { c++; return c <= shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]; }).join(''); });
      if (k < 1) requestAnimationFrame(step); else nodes.forEach((n, i) => { n.textContent = orig[i]; });
    };
    requestAnimationFrame(step);
  };

  /* ===================== Reiter + Menü ===================== */
  const VIEWS = ['start', 'ablauf', 'live', 'einrichtung', 'cockpit', 'sicherheit', 'preise', 'fragen'];
  const glow = $('.tab-glow'), scan = $('.scan'), menu = $('.menu'), menuBtn = $('.menu-btn');
  const moveGlow = () => {
    const a = $('.tab[aria-current="page"]'); if (!a || !a.offsetWidth) return;
    glow.style.width = a.offsetWidth + 'px'; glow.style.transform = `translateX(${a.offsetLeft - 4}px)`;
  };
  const setMenu = (open) => {
    menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) SFX.whoosh();
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  const show = (first) => {
    const id = location.hash.slice(1);
    if (VIEWS.includes(id)) {
      if (first) { const el = document.getElementById(id); if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto' })); }
      else { scan.classList.remove('go'); void scan.offsetWidth; if (!reduce) scan.classList.add('go'); SFX.whoosh(); }
    }
    requestAnimationFrame(() => plasmas.forEach((p) => p.resize()));
  };
  addEventListener('hashchange', () => show(false));
  addEventListener('resize', moveGlow);
  if (document.fonts) document.fonts.ready.then(moveGlow);

  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('hidden-r'); e.target.classList.add('show-r');
      decode($('[data-decode]', e.target)); io.unobserve(e.target);
    }), { threshold: 0.25 });
    $$('.reveal').forEach((b) => { b.classList.add('hidden-r'); io.observe(b); });
  }

  const clocks = $$('.js-clock');
  const tickClock = () => { const s = new Date().toLocaleTimeString('de-DE'); clocks.forEach((c) => { c.textContent = s; }); };
  tickClock(); setInterval(tickClock, 1000);

  /* ===================== Gespräche ===================== */
  const S = (who, src, text) => ({ who, name: who === 'ki' ? 'AIVOX' : 'Anrufer', src: 'audio/' + src + '.mp3', text });
  const SCN = [
    { title: 'Termin buchen', voiceKi: 'Leda', voiceAn: 'Achird', who: 'Herr Becker · entspannt', lines: [
      S('ki', 's1-1', 'Fahrrad-Werkstatt am Markt, guten Tag! Sie sprechen mit der digitalen Assistenz – ich bin eine künstliche Intelligenz. Was kann ich für Sie tun?'),
      S('anrufer', 's1-2', 'Ja, hallo! Mein E-Bike müsste mal wieder zur Inspektion. Geht diese Woche noch was?'),
      S('ki', 's1-3', 'Na klar, einen Moment … ich schau kurz nach. Am Donnerstag um halb elf wäre noch ein Platz frei. Passt Ihnen das?'),
      S('anrufer', 's1-4', 'Donnerstag, halb elf … ja, das passt super.'),
      S('ki', 's1-5', 'Wunderbar! Auf welchen Namen darf ich den Termin eintragen?'),
      S('anrufer', 's1-6', 'Bitte auf den Namen Becker.'),
      S('ki', 's1-7', 'Danke, Herr Becker. Ich schicke Ihnen gleich eine kurze Bestätigung aufs Handy, an die Nummer, mit der Sie gerade anrufen. Ist das in Ordnung?'),
      S('anrufer', 's1-8', 'Ja, gerne. Danke Ihnen!'),
      S('ki', 's1-9', 'Sehr gern! Dann bis Donnerstag – und gute Fahrt bis dahin.')],
      fields: [["Anliegen", "Inspektion E-Bike", 1], ["Freier Termin (aus deinem Kontingent)", "Donnerstag, 10:30 Uhr", 2], ["Name (erfragt)", "Becker", 5], ["Bestätigung", "SMS an die Anrufnummer (zugestimmt)", 7], ["Ergebnis", "Termin vergeben · SMS gesendet · Übergabe-Karte an dich", 8, 1]] },
    { title: 'Ist mein Rad fertig?', voiceKi: 'Enceladus', voiceAn: 'Aoede', who: 'Frau Meier · neugierig', lines: [
      S('anrufer', 's2-1', 'Hallo! Ich wollte nur mal kurz fragen, ob mein Fahrrad schon fertig ist?'),
      S('ki', 's2-2', 'Gern, ich schau sofort nach. Sie rufen von der Nummer aus Ihrem Reparaturauftrag an – spreche ich mit Frau Meier?'),
      S('anrufer', 's2-3', 'Ja, genau, das bin ich!'),
      S('ki', 's2-4', 'Gute Nachrichten, Frau Meier: Ihr Rad ist fertig! Sie können es ab sechzehn Uhr abholen. Die Rechnung liegt bei neunundachtzig Euro.'),
      S('anrufer', 's2-5', 'Oh, super! Vielen Dank, dann komm ich nachher vorbei.'),
      S('ki', 's2-6', 'Sehr gern! Bis später – wir freuen uns.')],
      fields: [["Anliegen", "Abholstatus", 0], ["Erkannt über", "Rufnummer im Reparaturauftrag", 1], ["Bestätigt", "Frau Meier", 2], ["Auskunft (Status aus dem Cockpit)", "Fertig ab 16:00 Uhr · 89 €", 3], ["Ergebnis", "Erledigt, kein Rückruf nötig", 5, 1]] },
    { title: 'Panne, eilig', voiceKi: 'Pulcherrima', voiceAn: 'Iapetus', who: 'Herr Schneider · gestresst', lines: [
      S('anrufer', 's3-1', 'Hallo, ja, ich hab einen Platten, und ich brauch mein Rad eigentlich morgen früh für die Arbeit!'),
      S('ki', 's3-2', 'Oh je, das ist ärgerlich. Aber keine Sorge – das kriegen wir hin. Wenn Sie das Rad heute bis achtzehn Uhr bringen, ist es morgen ab halb acht fertig. Wie ist Ihr Name?'),
      S('anrufer', 's3-3', 'Schneider. Ach, Gott sei Dank – das ist perfekt.'),
      S('ki', 's3-4', 'Sehr gern, Herr Schneider. Ich habe es für die Werkstatt notiert. Bis nachher – und Kopf hoch!')],
      fields: [["Anliegen", "Platten · Rad morgen früh gebraucht", 0], ["Lösung (deine Regel: Express)", "Abgabe bis 18:00 · fertig ab 7:30", 1], ["Name (erfragt)", "Schneider", 2], ["Ergebnis", "Auftrag für die Werkstatt notiert", 3, 1]] },
    { title: 'Nach Feierabend', voiceKi: 'Algenib', voiceAn: 'Laomedeia', who: 'Anruferin · am Abend, müde', lines: [
      S('anrufer', 's4-1', 'Ähm, … guten Abend. Haben Sie heute noch offen?'),
      S('ki', 's4-2', 'Guten Abend! Heute haben wir leider schon geschlossen. Morgen früh sind wir ab neun Uhr wieder für Sie da. Soll Sie jemand aus dem Team zurückrufen?'),
      S('anrufer', 's4-3', 'Ja … das wäre nett, danke.'),
      S('ki', 's4-4', 'Gern geschehen. Wir rufen Sie morgen früh an, unter der Nummer, mit der Sie gerade anrufen. Einen schönen Abend noch – und erholen Sie sich gut.')],
      fields: [["Uhrzeit", "Nach Ladenschluss", 0], ["Auskunft (aus deinem Profil)", "Morgen ab 9:00 Uhr geöffnet", 1], ["Rückrufnummer", "Übertragene Anrufnummer", 3], ["Ergebnis", "Rückruf für morgen früh in deiner Liste", 3, 1]] },
    { title: 'Schwieriger Kunde', voiceKi: 'Vindemiatrix', voiceAn: 'Charon', who: 'Herr Wagner · verärgert', lines: [
      S('anrufer', 's5-1', 'Hallo! Ich hab mein Rad gestern bei Ihnen zur Inspektion gehabt, und jetzt quietscht die Bremse schlimmer als vorher! Das kann doch nicht wahr sein!'),
      S('ki', 's5-2', 'Das tut mir wirklich leid. Das ist ärgerlich, gerade wenn man sich auf frisch gewartete Bremsen verlässt. Damit ich Ihnen schnell helfen kann: Wie ist Ihr Name?'),
      S('anrufer', 's5-3', 'Wagner. Und ich brauch das Rad jeden Tag, ich hab keine Zeit für so was!'),
      S('ki', 's5-4', 'Verstehe ich gut, Herr Wagner. Eine Nachkontrolle nach einer Inspektion ist bei uns selbstverständlich kostenlos. Ich kann Ihnen heute um siebzehn Uhr oder morgen früh um halb acht einen Platz freihalten. Dann sind Sie in zwanzig Minuten wieder unterwegs. Was passt Ihnen besser?'),
      S('anrufer', 's5-5', 'Nee. Ehrlich gesagt will ich das jetzt mit Ihrem Chef klären.'),
      S('ki', 's5-6', 'Das kann ich gut verstehen, Herr Wagner. Ich verbinde Sie jetzt direkt mit dem Werkstattleiter. Falls er gerade nicht rangehen kann, ruft er Sie innerhalb von dreißig Minuten zurück. Ich habe ihm Ihr Anliegen schon komplett notiert, Sie müssen nichts noch einmal erklären.'),
      S('anrufer', 's5-7', 'Hm. Okay. Danke.'),
      S('ki', 's5-8', 'Sehr gern. Einen kleinen Moment, ich verbinde Sie.')],
      fields: [["Stimmung", "Verärgert → beruhigt", 0], ["Anliegen", "Reklamation: Bremse quietscht nach Inspektion", 0], ["Name (erfragt)", "Wagner", 2], ["Angebot (deine Regel: Nacharbeit kostenlos)", "Nachkontrolle heute 17:00 oder morgen 7:30", 3], ["Übergabe (deine Regel: Chef-Wunsch)", "Durchstellen · sonst Rückruf in 30 Min, Priorität Rot", 5], ["Ergebnis", "Warm übergeben · Zusammenfassung liegt beim Chef", 7, 1]] },
  ];
  let sel = 0;
  const chips = $('.chips'), list = $('.script'), exList = $('.ex-list');
  const render = () => {
    const s = SCN[sel]; list.textContent = ''; exList.textContent = '';
    const vt = $('.voice-tag'); if (vt) { vt.innerHTML = ''; const b1 = document.createElement('b'), i1 = document.createElement('i'); b1.textContent = 'AIVOX · ' + s.voiceKi; i1.textContent = s.who + ' · ' + s.voiceAn; vt.append(b1, document.createTextNode('  ↔  '), i1); }
    s.lines.forEach((l) => {
      const li = document.createElement('li'); li.className = l.who;
      const w = document.createElement('span'); w.className = 'who'; w.textContent = l.name;
      const t = document.createElement('span'); t.className = 'txt'; t.textContent = l.text;
      li.append(w, t); list.appendChild(li);
    });
    s.fields.forEach(([k, v]) => { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); exList.appendChild(d); });
  };
  SCN.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; { const st = document.createElement('strong'), sp = document.createElement('span'); st.textContent = s.title; sp.textContent = 'AIVOX: ' + s.voiceKi; b.append(st, sp); }
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => { sel = i; $$('.chip').forEach((c, k) => c.setAttribute('aria-pressed', String(k === i))); render(); play(i); });
    if (chips) chips.appendChild(b);
  });
  if (list && exList) render();

  const capWho = $('.cap-who'), capText = $('.cap-text'), caption = $('.caption'), btns = $$('.js-play');
  let run = 0, playing = -1;
  const setPressed = (on) => btns.forEach((b) => b.setAttribute('aria-pressed', String(on)));
  const stopAll = () => {
    run++; playing = -1; level.speaking = false; level.who = 'idle';
    A.els.forEach((a) => { a.pause(); a.currentTime = 0; });
    setPressed(false); if (caption) caption.classList.remove('live'); if (list) $$('li', list).forEach((li) => li.classList.remove('now'));
  };
  const say = (src) => new Promise((resolve) => {
    const a = audioEl(src); let done = false;
    const fin = () => { if (!done) { done = true; a.removeEventListener('ended', fin); resolve(); } };
    a.addEventListener('ended', fin); a.currentTime = 0;
    a.play().then(() => { level.speaking = true; }).catch(() => setTimeout(fin, 2500));
  });
  const play = async (i) => {
    stopAll(); ensureCtx();
    const id = run, s = SCN[i]; playing = i; setPressed(true); if (caption) caption.classList.add('live');
    const lis = sel === i && list ? $$('li', list) : [], fs = sel === i && exList ? $$('div', exList) : [];
    fs.forEach((f) => f.classList.remove('on', 'done'));
    for (let k = 0; k < s.lines.length; k++) {
      if (id !== run) return;
      const l = s.lines[k];
      level.who = l.who; if (capWho) capWho.textContent = l.who === 'ki' ? 'AIVOX · ' + s.voiceKi : s.who.split(' · ')[0];
      { const dur = ((audioEl(l.src).duration || l.text.length / 14) * 1000) * 0.92; typeOut(capText, l.text, dur); if (lis[k]) typeOut($('.txt', lis[k]), l.text, dur); }
      lis.forEach((li, j) => { li.classList.toggle('now', j === k); li.classList.toggle('done', j < k); });
      s.fields.forEach(([, , at], j) => { if (at === k && fs[j]) fs[j].classList.add('on'); });
      await say(l.src);
      level.speaking = false;
      if (id !== run) return;
      s.fields.forEach(([, , at, fin], j) => { if (at === k && fin && fs[j]) { fs[j].classList.add('done'); SFX.chime(); } });
      level.who = 'pause';
      await new Promise((r) => setTimeout(r, 350));
    }
    if (id === run) {
      lis.forEach((li) => { li.classList.remove('now'); li.classList.add('done'); });
      if (capWho) capWho.textContent = 'Ergebnis'; if (capText) capText.textContent = s.fields[s.fields.length - 1][1];
      playing = -1; level.who = 'idle'; setPressed(false); if (caption) caption.classList.remove('live');
    }
  };
  btns.forEach((b) => b.addEventListener('click', () => { if (playing >= 0) return stopAll(); play(b.dataset.scn === 'sel' ? sel : Number(b.dataset.scn)); }));

  /* ===================== Rechner ===================== */
  const cCalls = $('#c-calls'), cRate = $('#c-rate'), cValue = $('#c-value'), res = $('.js-res'), factor = $('.js-factor');
  let shown = 0, anim = 0;
  const calc = (e) => {
    [cCalls, cRate, cValue].forEach((r) => {
      r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
      $(`output[for="${r.id}"]`).textContent = r === cRate ? r.value + ' %' : r === cValue ? r.value + ' €' : r.value;
    });
    const target = cCalls.value * 4.33 * (cRate.value / 100) * cValue.value;
    factor.textContent = target > 129 ? `Das ist das ${(target / 129).toLocaleString('de-DE', { maximumFractionDigits: 1 })}-Fache davon.` : '';
    const from = shown, t0 = performance.now(); cancelAnimationFrame(anim);
    const step = (n) => { const k = Math.min(1, (n - t0) / 600), ease = 1 - Math.pow(1 - k, 3); shown = from + (target - from) * ease; res.textContent = Math.round(shown).toLocaleString('de-DE'); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
    if (e) SFX.tone(500 + Math.min(target, 4000) / 6, 0.03, 'sine', 0.012);
  };
  if (cCalls && cRate && cValue) { [cCalls, cRate, cValue].forEach((r) => r.addEventListener('input', calc)); calc(); }

  /* ===================== Formular ===================== */
  const form = $('.join'), msg = $('.join-msg');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#f-name'), mail = $('#f-mail');
    const okName = name.value.trim().length > 1, okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim());
    name.setAttribute('aria-invalid', String(!okName)); mail.setAttribute('aria-invalid', String(!okMail));
    if (!okName || !okMail) { msg.textContent = !okName ? 'Bitte trag den Namen deiner Werkstatt ein.' : 'Bitte prüf deine E-Mail-Adresse.'; return; }
    msg.textContent = `Danke, ${name.value.trim()}! Dein Platz ist vorgemerkt. (Entwurf: Das Formular ist noch nicht angeschlossen, es wurde nichts verschickt.)`;
    SFX.chime();
  });

  /* ===================== Begrüßung ===================== */
  const intro = $('.intro'), cap = $('.intro-cap'), greetEl = $('.js-greet'), bootLog = $('.boot-log');
  const hour = new Date().getHours();
  const greet = hour < 11 ? ['Guten Morgen', 'g-morgen'] : hour < 18 ? ['Guten Tag', 'g-tag'] : ['Guten Abend', 'g-abend'];
  if (greetEl) greetEl.textContent = greet[0];
  const BOOT = ['Stromkreis prüfen', 'Stimme laden', 'Werkstattwissen laden', 'Leitung sichern'];
  const runBoot = () => {
    bootLog.textContent = '';
    BOOT.forEach((txt, i) => setTimeout(() => {
      const li = document.createElement('li'); li.textContent = '› ' + txt + ' … '; bootLog.appendChild(li);
      setTimeout(() => { const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = 'OK'; li.appendChild(ok); }, 320);
    }, 300 + i * 420));
  };
  let introDone = false;
  const leaveIntro = () => {
    if (introDone) return; introDone = true;
    A.els.forEach((a) => a.pause()); level.speaking = false; level.who = 'idle';
    store.set('aivox-intro', '1'); FX.explode(); SFX.whoosh();
    intro.classList.add('leaving'); document.body.classList.remove('booting');
    setTimeout(() => { intro.hidden = true; intro.classList.remove('leaving', 'playing', 'lock', 'booted'); FX.state = 'off'; show(true); decode($('#t-start')); }, reduce ? 50 : 1200);
  };
  const openIntro = () => {
    introDone = false; started = false; intro.hidden = false; intro.classList.remove('playing', 'leaving'); cap.textContent = '';
    document.body.classList.add('booting'); introPlasma.span = 0; introPlasma.spanTarget = 0.12; introPlasma.resize();
    intro.classList.remove('lock', 'booted'); soundBtn.hidden = true;
    FX.resize(); FX.ring = -1; FX.wave = -1; FX.flash = 0; FX.build(); runBoot();
    requestAnimationFrame(() => intro.classList.add('booted'));
    setTimeout(startIntro, 350);
  };
  let started = false;
  const soundBtn = $('.js-sound');
  // Spricht die Begrüßung. Blockiert der Browser den Ton, startet sie mit der ersten Berührung/Taste – ohne extra Knopf.
  const speakIntro = (a, text) => new Promise((resolve) => {
    let done = false, typed = false;
    const end = () => { if (done) return; done = true; cleanup(); resolve(); };
    const go = () => { level.speaking = true; soundBtn.hidden = true; if (!typed) { typed = true; typeOut(cap, text, ((a.duration || 7) * 1000) * 0.92); } };
    const onGesture = (e) => {
      if (e.target.closest && e.target.closest('.js-skip')) return;
      ensureCtx(); setSfx(true);
      a.play().then(go).catch(end);
    };
    const evs = ['pointerdown', 'keydown', 'touchend'];
    let tm = 0;
    const cleanup = () => { evs.forEach((t) => removeEventListener(t, onGesture, true)); clearTimeout(tm); a.removeEventListener('ended', end); };
    a.addEventListener('ended', end);
    a.play().then(go).catch(() => {
      soundBtn.hidden = false; typed = true; typeOut(cap, text, 6500);
      evs.forEach((t) => addEventListener(t, onGesture, true));
      tm = setTimeout(end, 14000);
    });
  });
  const startIntro = async () => {
    if (started || introDone) return; started = true;
    ensureCtx(); setSfx(true); SFX.boot();
    intro.classList.add('playing'); introPlasma.spanTarget = 1;
    await new Promise((r) => setTimeout(r, reduce ? 300 : 2400));
    if (introDone) return;
    FX.flash = 1; FX.wave = performance.now(); level.who = 'ki';
    const src = 'audio/' + greet[1] + '.mp3', running = !!(A.ctx && A.ctx.state === 'running');
    const a = running ? audioEl(src) : new Audio(src);
    level.direct = !running; a.currentTime = 0;
    await speakIntro(a, `${greet[0]}. Willkommen bei AIVOX. Ich bin die künstliche Intelligenz, die für deine Werkstatt ans Telefon geht. Tag und Nacht.`);
    level.speaking = false; level.direct = false; soundBtn.hidden = true;
    if (!introDone) setTimeout(leaveIntro, 900);
  };
  /* HUD: Spektrum + Messwerte */
  const specWrap = $('.hud-spec'), specBars = [];
  for (let i = 0; i < 44; i++) { const b = document.createElement('i'); specWrap.appendChild(b); specBars.push(b); }
  const drawHud = (t) => {
    const n = specBars.length;
    for (let i = 0; i < n; i++) {
      const m = Math.abs(i - n / 2) / (n / 2), band = level.bands[Math.min(5, Math.floor(m * 6))] || 0;
      const v = 3 + (band * 26 + level.v * 12) * (0.55 + 0.45 * Math.sin(t * 9 + i * 0.7)) + 2.5 * (1 + Math.sin(t * 2 + i * 0.4));
      specBars[i].style.height = Math.min(34, v).toFixed(1) + 'px';
    }
  };
  const d1 = $('.js-d1'), d2 = $('.js-d2');
  setInterval(() => { if (intro.hidden) return; d1.textContent = (97 + Math.random() * 3).toFixed(1).replace('.', ',') + ' %'; d2.textContent = '0,' + (14 + Math.floor(Math.random() * 9)) + ' s'; }, 160);
  intro.addEventListener('pointerdown', (e) => { if (!e.target.closest('.js-skip')) startIntro(); });
  addEventListener('keydown', (e) => { if (!intro.hidden && e.key !== 'Escape' && e.key !== 'Tab') startIntro(); });
  $('.js-skip').addEventListener('click', leaveIntro);
  $('.js-replay').addEventListener('click', () => { stopAll(); window.scrollTo(0, 0); openIntro(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!intro.hidden) leaveIntro(); else if (!menu.hidden) setMenu(false);
  });
  addEventListener('resize', () => { if (!intro.hidden) { FX.resize(); } });


  /* ===================== v8: WebGL-Lichthimmel ===================== */
  const sky = (() => {
    const c = document.createElement('canvas'); c.className = 'sky'; c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    const gl = c.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl || reduce) { c.remove(); return null; }
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision mediump float;uniform vec2 r;uniform float t;uniform float v;uniform float s;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,o=0.;for(int i=0;i<5;i++){o+=a*n(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return o;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv;q.x*=r.x/r.y;float tt=t*.04;
float y=uv.y+s*.15;
float band=fbm(vec2(q.x*1.2+tt*2.,y*2.5-tt))*1.2;
float curtain=smoothstep(.15,.95,band)*smoothstep(1.1,.2,abs(y-.55-.12*sin(q.x*1.6+tt*5.))*2.2);
vec3 blue=vec3(.18,.55,1.),ice=vec3(.5,.83,1.),amb=vec3(1.,.7,.25),emb=vec3(1.,.29,.14);
float k=clamp(uv.x+.15*sin(tt*3.+y*3.),0.,1.);
vec3 col=mix(mix(blue,ice,smoothstep(0.,.45,k)),mix(amb,emb,smoothstep(.6,1.,k)),smoothstep(.4,.7,k));
float glow=curtain*(.22+v*.25);
float stars=step(.9965,h(floor(gl_FragCoord.xy/2.)))*(.4+.6*sin(t*2.+h(floor(gl_FragCoord.xy))*40.));
gl_FragColor=vec4(col*glow+vec3(stars*.25),glow+stars*.2);}`;
    const mk = (ty, src) => { const sh = gl.createShader(ty); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { c.remove(); return null; }
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = { r: gl.getUniformLocation(pr, 'r'), t: gl.getUniformLocation(pr, 't'), v: gl.getUniformLocation(pr, 'v'), s: gl.getUniformLocation(pr, 's') };
    const size = () => { const sc = 0.5; c.width = Math.max(2, Math.round(innerWidth * sc)); c.height = Math.max(2, Math.round(innerHeight * sc)); gl.viewport(0, 0, c.width, c.height); };
    size(); addEventListener('resize', size);
    requestAnimationFrame(() => c.classList.add('on'));
    return {
      draw(t) {
        gl.uniform2f(U.r, c.width, c.height); gl.uniform1f(U.t, t); gl.uniform1f(U.v, level.v);
        gl.uniform1f(U.s, Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  })();

  /* ===================== v8: Scroll-Geschichte ===================== */
  const phone = $('.phone');
  if (phone && 'IntersectionObserver' in window) {
    const steps = $$('.ss-steps li');
    const so = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      steps.forEach((s) => s.classList.toggle('on', s === e.target));
      if (phone.dataset.step !== e.target.dataset.step) { phone.dataset.step = e.target.dataset.step; SFX.tone(880 + Number(e.target.dataset.step) * 220, 0.12, 'sine', 0.018); }
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => so.observe(s));
  }

  /* ===================== v8: Cockpit ===================== */
  const ck = $('.cockpit');
  if (ck && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ck.classList.add('go'); co.disconnect();
      $$('.ck-v', ck).forEach((el) => {
        const to = Number(el.dataset.to), t0 = performance.now();
        const st = (n) => { const k = Math.min(1, (n - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(st); };
        requestAnimationFrame(st);
      });
    }), { threshold: 0.3 });
    co.observe(ck);
  }


  /* ===================== v9: 3D-Stimmkern ===================== */
  const core = (() => {
    const c = $('.core'); if (!c) return null;
    const g = c.getContext('2d'); const P = [];
    for (let la = 1; la < 18; la++) {
      const th = (la / 18) * Math.PI, n = Math.max(8, Math.round(64 * Math.sin(th)));
      for (let k = 0; k < n; k++) { const ph = (k / n) * Math.PI * 2; P.push([th, ph, specAt(k / n)]); }
    }
    let rot = 0, tiltX = 0.35, tiltY = 0;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); c.width = c.clientWidth * d; c.height = c.clientHeight * d; };
    size(); addEventListener('resize', size);
    return {
      draw(t) {
        if (c.offsetParent === null) return;
        const w = c.width, h = c.height, R = Math.min(w, h) * 0.3, cx = w / 2, cy = h / 2;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
        rot += reduce ? 0.0008 : 0.004 + level.v * 0.02;
        if (performance.now() - pointer.t < 2500) {
          const r = c.getBoundingClientRect();
          tiltY += (((pointer.x - r.left) / r.width - 0.5) * 0.9 - tiltY) * 0.04;
          tiltX += (0.35 + ((pointer.y - r.top) / r.height - 0.5) * 0.6 - tiltX) * 0.04;
        }
        const cxr = Math.cos(tiltX), sxr = Math.sin(tiltX), cyr = Math.cos(rot + tiltY), syr = Math.sin(rot + tiltY);
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
        glow.addColorStop(0, `rgba(127,212,255,${0.1 + level.v * 0.2})`); glow.addColorStop(0.5, `rgba(255,74,36,${0.04 + level.v * 0.08})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow; g.fillRect(0, 0, w, h);
        for (const [th, ph, col] of P) {
          const wob = 1 + 0.035 * Math.sin(th * 5 + t * 1.3) + level.v * 0.22 * Math.sin(th * 9 + ph * 3 + t * 9);
          let x = Math.sin(th) * Math.cos(ph) * R * wob, y = Math.cos(th) * R * wob, z = Math.sin(th) * Math.sin(ph) * R * wob;
          const x1 = x * cyr - z * syr, z1 = x * syr + z * cyr;
          const y2 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr;
          const p = 900 / (900 + z2 * 1.2), sx = cx + x1 * p, sy = cy + y2 * p, depth = (z2 / R + 1) / 2;
          const a = 0.18 + (1 - depth) * 0.75, s = (1.2 + (1 - depth) * 1.8) * (w / 520);
          g.globalAlpha = a; g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
          g.fillRect(sx - s / 2, sy - s / 2, s, s);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      },
    };
  })();

  /* ===================== v9: Kapitel-Navigation (Scroll-Spy) ===================== */
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const v = e.target.dataset.view;
      if (document.body.dataset.page) return;
      $$('.tab, .menu a').forEach((a) => (a.getAttribute('href') === '#' + v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      moveGlow();
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('.view').forEach((s) => spy.observe(s));
  }

  /* ===================== v10: Stimmauswahl ===================== */
  $$('.vchip').forEach((b) => b.addEventListener('click', async () => {
    stopAll(); ensureCtx();
    $$('.vchip').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.classList.remove('playing'); });
    b.classList.add('playing'); level.who = 'ki';
    await say('audio/stimmen/' + b.dataset.voice + '.mp3');
    level.speaking = false; level.who = 'idle'; b.classList.remove('playing');
  }));


  /* ===================== v13: Zukunfts-Effekte ===================== */
  // Scroll-Fortschritt als Spektrum-Linie
  const prog = document.createElement('div'); prog.className = 'progress'; prog.setAttribute('aria-hidden', 'true'); document.body.appendChild(prog);
  const setProg = () => { const m = document.documentElement.scrollHeight - innerHeight; prog.style.transform = `scaleX(${m > 0 ? scrollY / m : 0})`; };
  addEventListener('scroll', setProg, { passive: true }); setProg();

  // Funkenspur am Mauszeiger
  const trail = (() => {
    if (!fine || reduce) return null;
    const c = document.createElement('canvas'); c.className = 'trail'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
    const g = c.getContext('2d'); let P = [], lx = null, ly = null;
    const size = () => { c.width = innerWidth; c.height = innerHeight; }; size(); addEventListener('resize', size);
    addEventListener('pointermove', (e) => {
      if (lx !== null) {
        const d = Math.hypot(e.clientX - lx, e.clientY - ly), n = Math.min(6, Math.floor(d / 6));
        for (let i = 0; i < n; i++) { const k = i / n; P.push({ x: lx + (e.clientX - lx) * k, y: ly + (e.clientY - ly) * k, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, l: 1, c: specAt((e.clientX / innerWidth + Math.random() * 0.1) % 1) }); }
      }
      lx = e.clientX; ly = e.clientY;
    }, { passive: true });
    return { draw() {
      g.clearRect(0, 0, c.width, c.height); if (!P.length) return;
      g.globalCompositeOperation = 'lighter';
      P = P.filter((p) => (p.l -= 0.045) > 0);
      if (P.length > 260) P.splice(0, P.length - 260);
      for (const p of P) { p.x += p.vx; p.y += p.vy; g.globalAlpha = p.l * 0.55; g.fillStyle = `rgb(${p.c[0] | 0},${p.c[1] | 0},${p.c[2] | 0})`; g.beginPath(); g.arc(p.x, p.y, 1 + p.l * 2.2, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } };
  })();

  // Lichtwelle beim Klicken
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('.btn, .chip, .vchip, .node, .tab');
    if (!el || reduce) return;
    const r = el.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple'; s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px';
    el.appendChild(s); setTimeout(() => s.remove(), 800);
  });

  // Holo-Schimmer folgt dem Zeiger
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot'); if (!el) return;
    el.style.setProperty('--hx', ((e.clientX / innerWidth) * 360).toFixed(0));
  }, { passive: true });

  // Neuronales Netz hinter dem Datenfluss
  const net = (() => {
    const host = $('.flowmap'); if (!host || reduce) return null;
    const c = document.createElement('canvas'); c.className = 'neural'; c.setAttribute('aria-hidden', 'true'); host.prepend(c);
    const g = c.getContext('2d'); let N = [], W = 0, H = 0;
    const size = () => { W = c.clientWidth; H = c.clientHeight; c.width = W; c.height = H; N = Array.from({ length: Math.round(W * H / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, c: specAt(Math.random()) })); };
    size(); addEventListener('resize', size);
    return { draw(t) {
      if (c.offsetParent === null || !W) return;
      const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const px = pointer.x - r.left, py = pointer.y - r.top;
      g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (const n of N) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; }
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
        const a = N[i], b = N[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          const near = Math.max(0, 1 - Math.hypot((a.x + b.x) / 2 - px, (a.y + b.y) / 2 - py) / 220);
          g.globalAlpha = (1 - d / 110) * (0.12 + near * 0.5 + level.v * 0.3);
          g.strokeStyle = `rgb(${a.c[0] | 0},${a.c[1] | 0},${a.c[2] | 0})`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          if (((t * 0.6 + i * 0.13) % 1) < 0.02) { const k = (t * 3 + j) % 1; g.globalAlpha = 0.9; g.fillStyle = '#fff'; g.fillRect(a.x + (b.x - a.x) * k - 1, a.y + (b.y - a.y) * k - 1, 2, 2); }
        }
      }
      for (const n of N) { g.globalAlpha = 0.7; g.fillStyle = `rgb(${n.c[0] | 0},${n.c[1] | 0},${n.c[2] | 0})`; g.fillRect(n.x - 1, n.y - 1, 2, 2); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } };
  })();

  // Wort-für-Wort-Mitschrift (wirkt wie Live-Erkennung)
  const typeOut = (el, text, ms) => {
    if (!el) return; if (reduce) { el.textContent = text; return; }
    const words = text.split(' '); let i = 0; el.textContent = '';
    const step = Math.max(40, ms / Math.max(1, words.length));
    const tick = () => { if (i >= words.length) return; el.textContent += (i ? ' ' : '') + words[i++]; el._t = setTimeout(tick, step); };
    clearTimeout(el._t); tick();
  };


  /* ===================== v14: Warp-Übergänge ===================== */
  const warp = (() => {
    const w = document.createElement('div'); w.className = 'warp'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<span class="warp-iris"></span><span class="warp-ring"></span><span class="warp-lines"></span><span class="warp-label"></span>';
    document.body.appendChild(w);
    const label = w.querySelector('.warp-label');
    let busy = false;
    const names = { start: 'START', ablauf: 'SO FUNKTIONIERT’S', live: 'LIVE-DEMO', einrichtung: 'EINRICHTUNG', cockpit: 'COCKPIT', sicherheit: 'SICHERHEIT', preise: 'PREISE', fragen: 'FRAGEN' };
    const go = (id, x, y) => {
      const target = document.getElementById(id); if (!target) return false;
      if (reduce || busy) { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + id); return true; }
      busy = true;
      w.style.setProperty('--cx', x + 'px'); w.style.setProperty('--cy', y + 'px');
      label.textContent = names[id] || id.toUpperCase();
      w.classList.remove('out'); w.classList.add('in'); document.body.classList.add('warping');
      SFX.whoosh(); setTimeout(() => SFX.zap(), 180);
      setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        target.scrollIntoView({ behavior: 'auto' });
        history.replaceState(null, '', '#' + id);
        document.documentElement.style.scrollBehavior = '';
        w.classList.remove('in'); w.classList.add('out'); document.body.classList.remove('warping');
        SFX.chime && SFX.tone(1320, 0.25, 'sine', 0.02);
        setTimeout(() => { w.classList.remove('out'); busy = false; plasmas.forEach((p) => p.resize()); }, 650);
      }, 520);
      return true;
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      const id = a.getAttribute('href').slice(1); if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      const r = a.getBoundingClientRect();
      go(id, e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
    return { go };
  })();


  /* ===================== v17: Seitenwechsel mit Warp ===================== */
  (() => {
    const w = $('.warp'); if (!w) return;
    const label = $('.warp-label', w);
    const names = { start: 'START', ablauf: 'SO FUNKTIONIERT’S', live: 'LIVE-DEMO', einrichtung: 'EINRICHTUNG', cockpit: 'COCKPIT', sicherheit: 'SICHERHEIT', preise: 'PREISE', fragen: 'FRAGEN' };
    const reset = () => { w.classList.remove('in', 'out', 'arrive'); document.body.classList.remove('warping'); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button || a.target === '_blank') return;
      const href = a.getAttribute('href'), m = href.match(/^([a-z]+)\.html(#.*)?$/); if (!m) return;
      const page = m[1] === 'index' ? 'start' : m[1];
      if (page === document.body.dataset.page && m[2]) return;
      e.preventDefault();
      if (reduce) { location.href = href; return; }
      const r = a.getBoundingClientRect();
      w.style.setProperty('--cx', (e.clientX || r.left + r.width / 2) + 'px'); w.style.setProperty('--cy', (e.clientY || r.top + r.height / 2) + 'px');
      label.textContent = names[page] || page.toUpperCase();
      w.classList.remove('out'); w.classList.add('in'); document.body.classList.add('warping');
      SFX.whoosh(); setTimeout(() => SFX.zap(), 180);
      store.set('aivox-warp', label.textContent);
      setTimeout(() => { location.href = href; }, 500);
    });
    addEventListener('pageshow', (e) => { if (e.persisted) reset(); });
    const arriving = store.get('aivox-warp');
    if (arriving && !reduce) {
      store.set('aivox-warp', '');
      label.textContent = arriving; w.classList.add('arrive');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        w.classList.remove('arrive'); w.classList.add('out');
        setTimeout(reset, 700);
      }));
    }
  })();

  /* ===================== Start ===================== */
  FX.init();
  show(true);
  if (store.get('aivox-intro') === '1' || (document.body.dataset.page && document.body.dataset.page !== 'start')) { intro.hidden = true; document.body.classList.remove('booting'); }
  else openIntro();
  const loop = (now) => { const t = now / 1000; readLevel(t); if (!intro.hidden) { FX.draw(now); drawHud(t); } plasmas.forEach((p) => p.draw(t)); if (sky) sky.draw(t); if (core) core.draw(t); if (trail) trail.draw(); if (net) net.draw(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
})();
