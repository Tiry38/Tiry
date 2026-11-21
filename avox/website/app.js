(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Reiter (Hash-Routing) ================= */
  const VIEWS = ['start', 'hoerprobe', 'funktionen', 'preise', 'fragen'];
  const glow = $('.tab-glow');
  const moveGlow = () => {
    const a = $('.tab[aria-current="page"]');
    if (!a || !glow || !a.offsetWidth) return;
    glow.style.width = a.offsetWidth + 'px';
    glow.style.transform = `translateX(${a.offsetLeft - 4}px)`;
  };
  const show = (first) => {
    const id = location.hash.slice(1);
    const view = VIEWS.includes(id) ? id : 'start';
    $$('.view').forEach((v) => {
      const on = v.dataset.view === view;
      if (on && v.hidden) { v.hidden = false; v.classList.remove('enter'); void v.offsetWidth; if (!first) v.classList.add('enter'); }
      else if (!on) v.hidden = true;
    });
    $$('.tab, .dock-i').forEach((a) => {
      if (a.getAttribute('href') === '#' + view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    moveGlow();
    if (!first) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    requestAnimationFrame(() => plasmas.forEach((p) => p.resize()));
  };
  addEventListener('hashchange', () => show(false));
  addEventListener('resize', moveGlow);
  document.fonts && document.fonts.ready.then(moveGlow);

  /* ================= Licht folgt der Maus ================= */
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - r.left) + 'px');
    el.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ================= Gespräch ================= */
  const SCRIPT = [
    { who: 'ki', name: 'AVOX', src: 'audio/l1.mp3', text: 'Fahrrad-Werkstatt am Markt, guten Tag! Hier spricht die digitale Assistenz. Ich bin eine künstliche Intelligenz. Wie kann ich Ihnen helfen?' },
    { who: 'anrufer', name: 'Anrufer', src: 'audio/l2.mp3', text: 'Hallo, guten Tag! Mein E-Bike braucht eine Inspektion. Geht diese Woche noch was?' },
    { who: 'ki', name: 'AVOX', src: 'audio/l3.mp3', text: 'Gerne. Am Donnerstag um halb elf ist noch frei. Soll ich den Termin für Sie eintragen?' },
    { who: 'anrufer', name: 'Anrufer', src: 'audio/l4.mp3', text: 'Ja, perfekt.' },
    { who: 'ki', name: 'AVOX', src: 'audio/l5.mp3', text: 'Erledigt. Sie bekommen gleich eine Bestätigung per E-Mail. Einen schönen Tag noch!', booked: true },
  ];
  const list = $('.script');
  SCRIPT.forEach((l) => {
    const li = document.createElement('li'); li.className = l.who;
    const w = document.createElement('span'); w.className = 'who'; w.textContent = l.name;
    const t = document.createElement('span'); t.className = 'txt'; t.textContent = l.text;
    li.append(w, t); list.appendChild(li);
  });
  const lis = $$('li', list);
  const caption = $('.caption'), capWho = $('.cap-who'), capText = $('.cap-text');
  const booked = $('.booked');

  /* Audio-Kette: Datei -> Analyser -> Lautsprecher */
  const audio = { ctx: null, analyser: null, freq: null, wave: null, els: [] };
  const level = { v: 0, bands: [0, 0, 0, 0, 0, 0], who: 'idle' };
  const ensureCtx = () => {
    if (audio.els.length) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AC();
      audio.analyser = audio.ctx.createAnalyser();
      audio.analyser.fftSize = 1024; audio.analyser.smoothingTimeConstant = 0.55;
      audio.analyser.connect(audio.ctx.destination);
      audio.freq = new Uint8Array(audio.analyser.frequencyBinCount);
      audio.wave = new Uint8Array(audio.analyser.fftSize);
    } catch (e) { audio.ctx = null; }
    audio.els = SCRIPT.map((l) => {
      const a = new Audio(l.src); a.preload = 'auto';
      if (audio.ctx) { try { audio.ctx.createMediaElementSource(a).connect(audio.analyser); } catch (e) { /* direkt */ } }
      return a;
    });
  };

  let run = 0, playing = false;
  const buttons = $$('.js-play');
  const setPressed = (on) => buttons.forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Beispielanruf stoppen' : 'Beispielanruf anhören');
  });
  const stop = () => {
    run++; playing = false; level.who = 'idle';
    audio.els.forEach((a) => { a.pause(); a.currentTime = 0; });
    setPressed(false); caption.classList.remove('live');
    lis.forEach((li) => li.classList.remove('now'));
  };
  const playLine = (i, id) => new Promise((resolve) => {
    const a = audio.els[i];
    const done = () => { a.removeEventListener('ended', done); resolve(); };
    a.addEventListener('ended', done);
    a.currentTime = 0;
    a.play().catch(() => setTimeout(done, SCRIPT[i].text.length * 60));
  });
  const start = async () => {
    ensureCtx();
    if (audio.ctx && audio.ctx.state === 'suspended') { try { await audio.ctx.resume(); } catch (e) { /* egal */ } }
    const id = ++run; playing = true; setPressed(true);
    booked.classList.remove('show'); lis.forEach((li) => li.classList.remove('now', 'done'));
    caption.classList.add('live');
    for (let i = 0; i < SCRIPT.length; i++) {
      if (id !== run) return;
      const l = SCRIPT[i];
      level.who = l.who;
      capWho.textContent = l.name; capText.textContent = l.text;
      lis.forEach((li, k) => { li.classList.toggle('now', k === i); li.classList.toggle('done', k < i); });
      await playLine(i, id);
      if (id !== run) return;
      if (l.booked) booked.classList.add('show');
      level.who = 'pause';
      await new Promise((r) => setTimeout(r, 380));
    }
    if (id === run) {
      lis.forEach((li) => { li.classList.remove('now'); li.classList.add('done'); });
      capWho.textContent = 'Termin eingetragen'; capText.textContent = 'Do · 10:30 · Inspektion E-Bike. Bestätigung ist raus.';
      playing = false; level.who = 'idle'; setPressed(false); caption.classList.remove('live');
    }
  };
  buttons.forEach((b) => b.addEventListener('click', () => (playing ? stop() : start())));

  /* Pegel aus dem Analyser lesen (oder simulieren, falls Web Audio fehlt) */
  const readLevel = (t) => {
    let target = 0; const bands = [0, 0, 0, 0, 0, 0];
    if (playing && level.who !== 'pause') {
      if (audio.analyser) {
        audio.analyser.getByteTimeDomainData(audio.wave);
        let sum = 0; for (let i = 0; i < audio.wave.length; i++) { const d = (audio.wave[i] - 128) / 128; sum += d * d; }
        target = Math.min(1, Math.sqrt(sum / audio.wave.length) * 6);
        audio.analyser.getByteFrequencyData(audio.freq);
        const edges = [2, 6, 12, 24, 48, 96, 180];
        for (let b = 0; b < 6; b++) { let s = 0; for (let i = edges[b]; i < edges[b + 1]; i++) s += audio.freq[i]; bands[b] = s / ((edges[b + 1] - edges[b]) * 255); }
      } else {
        target = 0.35 + 0.35 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.3));
        for (let b = 0; b < 6; b++) bands[b] = target * (0.5 + 0.5 * Math.sin(t * (4 + b * 2.7)));
      }
    }
    level.v += (target - level.v) * (target > level.v ? 0.45 : 0.12);
    for (let b = 0; b < 6; b++) level.bands[b] += (bands[b] - level.bands[b]) * 0.35;
  };

  /* ================= Stromlinie (Canvas) ================= */
  class Plasma {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d'); this.sparks = []; this.big = canvas.dataset.size === 'big';
      this.seed = Math.random() * 100; this.resize();
    }
    resize() {
      const d = Math.min(devicePixelRatio || 1, 2);
      const w = this.c.clientWidth, h = this.c.clientHeight;
      if (!w) return;
      this.d = d; this.w = w; this.h = h;
      this.c.width = Math.round(w * d); this.c.height = Math.round(h * d);
    }
    visible() { return this.c.offsetParent !== null && this.w; }
    path(t, amp, phase, sharp) {
      const { w, h } = this, mid = h / 2, n = Math.max(80, Math.floor(w / 5)), pts = [];
      const B = level.bands;
      for (let i = 0; i <= n; i++) {
        const x = i / n, env = Math.pow(Math.sin(Math.PI * x), 1.35);
        let y = 0;
        y += Math.sin(x * 9 + t * 2.1 + phase) * (0.12 + B[0] * 0.9);
        y += Math.sin(x * 23 - t * 3.7 + phase * 1.7) * (0.06 + B[1] * 0.7);
        y += Math.sin(x * 47 + t * 6.3 + phase * 2.3) * (0.03 + B[2] * 0.55);
        y += Math.sin(x * 91 - t * 9.1 + phase) * (B[3] * 0.4 + B[4] * 0.3);
        const crackle = (Math.random() - 0.5) * sharp;
        y = (y * amp + crackle * amp) * env * h * 0.42;
        pts.push([x * w, mid + y]);
      }
      return pts;
    }
    stroke(pts, width, color, alpha) {
      const g = this.g, { w } = this;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.12, color); grad.addColorStop(0.88, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha; g.strokeStyle = grad; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
    draw(t) {
      if (!this.visible()) return;
      const g = this.g, { w, h, d } = this;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      const talk = level.who === 'ki', caller = level.who === 'anrufer';
      const idle = reduce ? 0.06 : 0.07 + 0.03 * Math.sin(t * 0.8);
      const amp = idle + level.v * (talk ? 2.3 : 1.5);
      const sharp = talk ? 0.18 + level.v * 0.5 : caller ? 0.08 : 0.04;
      const core = caller ? 'rgba(255,236,214,1)' : 'rgba(225,246,255,1)';
      const halo = caller ? 'rgba(255,190,140,1)' : 'rgba(127,212,255,1)';
      const deep = caller ? 'rgba(255,140,90,1)' : 'rgba(58,141,255,1)';
      const tt = reduce ? t * 0.2 : t;
      const main = this.path(tt, amp, this.seed, sharp);
      this.stroke(main, (this.big ? 26 : 20) + level.v * 30, deep, 0.07 + level.v * 0.08);
      this.stroke(main, 9 + level.v * 10, halo, 0.22 + level.v * 0.2);
      this.stroke(main, 2.6, halo, 0.75);
      this.stroke(main, 1.2, core, 1);
      // Nebenstränge: elektrische Fäden um die Hauptlinie
      for (let k = 1; k <= 2; k++) {
        const p = this.path(tt * (1 + k * 0.13), amp * (0.7 + k * 0.25), this.seed + k * 2.1, sharp * 1.6);
        this.stroke(p, 1, halo, 0.28 + level.v * 0.3);
      }
      // Wandernder Signalpuls, solange niemand spricht
      if (!playing || level.who === 'pause') {
        const px = ((t * 0.18) % 1.4) - 0.2;
        if (px > 0.05 && px < 0.95) {
          const idx = Math.round(px * (main.length - 1)), [x, y] = main[idx];
          const r = 46, rg = g.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, 'rgba(230,248,255,.9)'); rg.addColorStop(0.25, 'rgba(127,212,255,.35)'); rg.addColorStop(1, 'rgba(58,141,255,0)');
          g.globalAlpha = 1; g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
      }
      // Funken bei lauter Stimme
      if (!reduce && level.v > 0.35 && Math.random() < level.v * 0.9) {
        const [x, y] = main[Math.floor(main.length * (0.15 + Math.random() * 0.7))];
        this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 3.2, life: 1 });
      }
      this.sparks = this.sparks.filter((s) => (s.life -= 0.035) > 0);
      for (const s of this.sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.04;
        g.globalAlpha = s.life; g.fillStyle = core;
        g.beginPath(); g.arc(s.x, s.y, 1.4, 0, Math.PI * 2); g.fill();
        g.globalAlpha = s.life * 0.35; g.fillStyle = halo;
        g.beginPath(); g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
  const plasmas = $$('.plasma').map((c) => new Plasma(c));
  addEventListener('resize', () => plasmas.forEach((p) => p.resize()));
  const loop = (now) => {
    const t = now / 1000;
    readLevel(t);
    plasmas.forEach((p) => p.draw(t));
    requestAnimationFrame(loop);
  };

  show(true);
  requestAnimationFrame(loop);
})();
