(() => {
  'use strict';
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
      if (A.analyser) {
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
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 100"><g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="square"><path d="M4 96 L42 6 L80 96"/><path d="M114 6 V96"/><path d="M148 6 L188 96 L228 6"/><path d="M287.4 9.4 A44 44 0 1 0 312.6 9.4"/><path d="M362 6 L392 46 M410 54 L440 96 M440 6 L410 46 M392 54 L362 96"/></g><g fill="#fff"><circle cx="300" cy="51" r="7"/><circle cx="401" cy="50" r="4"/><rect x="296" y="0" width="8" height="22" rx="2"/></g></svg>`;
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
        const W = Math.max(200, Math.round(box.width)), H = Math.round(W / 5.2);
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        const og = oc.getContext('2d'); og.drawImage(img, 0, 0, W, H);
        const data = og.getImageData(0, 0, W, H).data, step = Math.max(2, Math.round(W / 210)), pts = [];
        for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 120) pts.push([x, y]);
        const max = 2600; while (pts.length > max) pts.splice((Math.random() * pts.length) | 0, 1);
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
      if (this.state === 'assemble' && el > 1.9 && this.ring < 0) { this.ring = now; this.flash = 1; }
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
  const VIEWS = ['start', 'live', 'funktionen', 'sicherheit', 'branchen', 'preise', 'ueber', 'fragen'];
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
    let id = location.hash.slice(1); if (id === 'hoerprobe') id = 'live';
    const view = VIEWS.includes(id) ? id : 'start';
    $$('.view').forEach((v) => {
      const on = v.dataset.view === view;
      if (on && v.hidden) {
        v.hidden = false; v.classList.remove('enter'); void v.offsetWidth;
        if (!first) { v.classList.add('enter'); $$('[data-decode]', v).slice(0, 1).forEach(decode); }
      } else if (!on) v.hidden = true;
    });
    $$('.tab, .menu a').forEach((a) => (a.getAttribute('href') === '#' + view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    moveGlow();
    if (!first) { scan.classList.remove('go'); void scan.offsetWidth; if (!reduce) scan.classList.add('go'); SFX.whoosh(); window.scrollTo({ top: 0, behavior: 'auto' }); }
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
    { title: 'Termin buchen', lines: [
      S('ki', 's1-1', 'Fahrrad-Werkstatt am Markt, guten Tag! Hier spricht die digitale Assistenz. Ich bin eine künstliche Intelligenz. Wie kann ich Ihnen helfen?'),
      S('anrufer', 's1-2', 'Hallo, guten Tag! Mein E-Bike braucht eine Inspektion. Geht diese Woche noch was?'),
      S('ki', 's1-3', 'Gerne. Am Donnerstag um halb elf ist noch frei. Soll ich den Termin für Sie eintragen?'),
      S('anrufer', 's1-4', 'Ja, perfekt.'),
      S('ki', 's1-5', 'Erledigt. Sie bekommen gleich eine Bestätigung per E-Mail. Einen schönen Tag noch!')],
      fields: [['Anliegen', 'Inspektion E-Bike', 1], ['Freier Termin', 'Donnerstag, 10:30 Uhr', 2], ['Ergebnis', 'Im Kalender eingetragen · Bestätigung per E-Mail', 4, 1]] },
    { title: 'Ist mein Rad fertig?', lines: [
      S('anrufer', 's2-1', 'Guten Tag, hier spricht Meier. Ist mein Fahrrad schon fertig?'),
      S('ki', 's2-2', 'Guten Tag, Herr Meier. Ihr Trekkingrad ist fertig und kann ab 16 Uhr abgeholt werden. Die Rechnung beträgt 89 Euro.'),
      S('anrufer', 's2-3', 'Super, vielen Dank!'),
      S('ki', 's2-4', 'Sehr gern. Bis später in der Werkstatt!')],
      fields: [['Anrufer', 'Herr Meier', 0], ['Anliegen', 'Abholstatus', 0], ['Auskunft', 'Fertig ab 16:00 Uhr · 89 €', 1], ['Ergebnis', 'Erledigt, kein Rückruf nötig', 3, 1]] },
    { title: 'Panne, eilig', lines: [
      S('anrufer', 's3-1', 'Hallo! Ich habe einen Platten und brauche mein Rad morgen früh für die Arbeit.'),
      S('ki', 's3-2', 'Das bekommen wir hin. Wenn Sie das Rad heute bis 18 Uhr bringen, ist es morgen ab halb acht fertig. Soll ich das für Sie notieren?'),
      S('anrufer', 's3-3', 'Ja, bitte gerne.'),
      S('ki', 's3-4', 'Ist notiert. Bis gleich in der Werkstatt!')],
      fields: [['Anliegen', 'Platten · Rad wird morgen früh gebraucht', 0], ['Lösung', 'Abgabe heute bis 18:00 · fertig ab 7:30', 1], ['Ergebnis', 'Auftrag für die Werkstatt notiert', 3, 1]] },
    { title: 'Nach Feierabend', lines: [
      S('anrufer', 's4-1', 'Guten Abend! Haben Sie heute noch geöffnet?'),
      S('ki', 's4-2', 'Wir haben heute schon geschlossen. Morgen sind wir ab 9 Uhr für Sie da. Soll ich Ihnen einen Rückruf eintragen?'),
      S('anrufer', 's4-3', 'Ja, sehr gerne.'),
      S('ki', 's4-4', 'Erledigt. Unser Team ruft Sie morgen früh zurück. Einen schönen Abend!')],
      fields: [['Uhrzeit', 'Nach Ladenschluss', 0], ['Auskunft', 'Morgen ab 9:00 Uhr geöffnet', 1], ['Ergebnis', 'Rückruf für morgen früh eingetragen', 3, 1]] },
  ];
  let sel = 0;
  const chips = $('.chips'), list = $('.script'), exList = $('.ex-list');
  const render = () => {
    const s = SCN[sel]; list.textContent = ''; exList.textContent = '';
    s.lines.forEach((l) => {
      const li = document.createElement('li'); li.className = l.who;
      const w = document.createElement('span'); w.className = 'who'; w.textContent = l.name;
      const t = document.createElement('span'); t.className = 'txt'; t.textContent = l.text;
      li.append(w, t); list.appendChild(li);
    });
    s.fields.forEach(([k, v]) => { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); exList.appendChild(d); });
  };
  SCN.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = s.title;
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => { sel = i; $$('.chip').forEach((c, k) => c.setAttribute('aria-pressed', String(k === i))); render(); play(i); });
    chips.appendChild(b);
  });
  render();

  const capWho = $('.cap-who'), capText = $('.cap-text'), caption = $('.caption'), btns = $$('.js-play');
  let run = 0, playing = -1;
  const setPressed = (on) => btns.forEach((b) => b.setAttribute('aria-pressed', String(on)));
  const stopAll = () => {
    run++; playing = -1; level.speaking = false; level.who = 'idle';
    A.els.forEach((a) => { a.pause(); a.currentTime = 0; });
    setPressed(false); caption.classList.remove('live'); $$('li', list).forEach((li) => li.classList.remove('now'));
  };
  const say = (src) => new Promise((resolve) => {
    const a = audioEl(src); let done = false;
    const fin = () => { if (!done) { done = true; a.removeEventListener('ended', fin); resolve(); } };
    a.addEventListener('ended', fin); a.currentTime = 0;
    a.play().then(() => { level.speaking = true; }).catch(() => setTimeout(fin, 2500));
  });
  const play = async (i) => {
    stopAll(); ensureCtx();
    const id = run, s = SCN[i]; playing = i; setPressed(true); caption.classList.add('live');
    const lis = sel === i ? $$('li', list) : [], fs = sel === i ? $$('div', exList) : [];
    fs.forEach((f) => f.classList.remove('on', 'done'));
    for (let k = 0; k < s.lines.length; k++) {
      if (id !== run) return;
      const l = s.lines[k];
      level.who = l.who; capWho.textContent = l.name; capText.textContent = l.text;
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
      capWho.textContent = 'Ergebnis'; capText.textContent = s.fields[s.fields.length - 1][1];
      playing = -1; level.who = 'idle'; setPressed(false); caption.classList.remove('live');
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
  [cCalls, cRate, cValue].forEach((r) => r.addEventListener('input', calc));
  calc();

  /* ===================== Formular ===================== */
  const form = $('.join'), msg = $('.join-msg');
  form.addEventListener('submit', (e) => {
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
  greetEl.textContent = greet[0];
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
    setTimeout(() => { intro.hidden = true; intro.classList.remove('leaving', 'playing'); FX.state = 'off'; show(true); decode($('#t-start')); }, reduce ? 50 : 1200);
  };
  const openIntro = () => {
    introDone = false; intro.hidden = false; intro.classList.remove('playing', 'leaving'); cap.textContent = '';
    document.body.classList.add('booting'); introPlasma.span = 0; introPlasma.spanTarget = 0.12; introPlasma.resize();
    FX.resize(); FX.ring = -1; FX.wave = -1; FX.flash = 0; FX.build(); runBoot();
  };
  $$('.js-enter').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.sound !== '1') { setSfx(false); leaveIntro(); return; }
    ensureCtx(); setSfx(true); SFX.boot();
    intro.classList.add('playing'); FX.wave = performance.now(); introPlasma.spanTarget = 1;
    await new Promise((r) => setTimeout(r, 1500));
    if (introDone) return;
    FX.flash = 1; level.who = 'ki';
    cap.textContent = `${greet[0]}. Willkommen bei AIVOX. Ich bin die künstliche Intelligenz, die für deine Werkstatt ans Telefon geht. Tag und Nacht.`;
    await say('audio/' + greet[1] + '.mp3');
    level.speaking = false;
    if (!introDone) setTimeout(leaveIntro, 600);
  }));
  $('.js-skip').addEventListener('click', leaveIntro);
  $('.js-replay').addEventListener('click', () => { stopAll(); window.scrollTo(0, 0); openIntro(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!intro.hidden) leaveIntro(); else if (!menu.hidden) setMenu(false);
  });
  addEventListener('resize', () => { if (!intro.hidden) { FX.resize(); } });

  /* ===================== Start ===================== */
  FX.init();
  show(true);
  if (store.get('aivox-intro') === '1') { intro.hidden = true; document.body.classList.remove('booting'); }
  else openIntro();
  const loop = (now) => { const t = now / 1000; readLevel(t); if (!intro.hidden) FX.draw(now); plasmas.forEach((p) => p.draw(t)); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
})();
