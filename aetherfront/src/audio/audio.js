/*
 * Aetherfront – Audio-Engine
 * ------------------------------------------------------------------
 * Musik: echte Orchester-Aufnahmen (CC0, siehe web/assets/LICENSES.md) als Opus-Dateien,
 *        nahtlose Schleifen, weiche Überblendungen zwischen den Stimmungen.
 * Effekte: CC0-Aufnahmen (Schwerter, Einschläge, Zauber, Hörner, Gong, Trommeln …), zur Laufzeit
 *        aus mehreren Schichten zusammengesetzt (z. B. Klirren + Luftzug + Körpertreffer), mit
 *        zufälliger Varianten-/Tonhöhenwahl, Stimmenbegrenzung, Entfernungsfilter und Panorama.
 *
 *  Signalfluss:
 *    Musik ─► Lautstärke ─► Ducking ─► Klangfarbe ─┐
 *    Effekte ─► Lautstärke ───────────────────────┼─► Bus ─► Kompressor ─► Limiter ─► Master ─► Soft-Clip ─► Ausgang
 *    Oberfläche ─► Lautstärke ────────────────────┤
 *    Hall (Faltung, erzeugte Impulsantwort) ──────┘
 *
 *  Für Offline-Tests/Hörproben kann ein Kontext injiziert werden:
 *    const eng = new AudioEngine({ context: new OfflineAudioContext(2, n, 48000), base: 'assets/audio/' });
 *    await eng.ready({ music: ['battle'] }); eng.playMusic('battle'); eng.sfx('sword'); …
 */
import { SFX_SPRITES, MUSIC_FILES } from './audio-manifest.js';

/* ============================== Hilfen ============================== */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

/* ============================== Musik ============================== */

// Stimmungen → Dateien (mehrere = abwechselnd pro Aufruf). gain: Feinabgleich, once: kein Loop.
const TRACKS = {
  menu: { files: ['menu'], gain: 0.95 },
  build: { files: ['build'], gain: 1.15 },
  battle: { files: ['battle', 'battle2'], gain: 1 },
  boss: { files: ['boss'], gain: 1 },
  arena: { files: ['arena'], gain: 1 },
  victory: { files: ['victory'], gain: 1, once: true },
  defeat: { files: ['defeat'], gain: 1, once: true },
};
// Was voraussichtlich als Nächstes kommt (wird im Hintergrund schon dekodiert)
const NEXT = { menu: ['build'], build: ['battle', 'battle2'], battle: ['build', 'boss'], battle2: ['build', 'boss'], boss: ['build'], arena: ['build'], victory: ['menu'], defeat: ['menu'] };
const MAX_DECODED = 4; // dekodierte Musikdateien im Speicher (je ~35–70 MB)

/* ============================== Effekte ============================== */

/** Schicht: Sample-Gruppe, Pegel, Verzögerung (s), Tonhöhenbereich, Extras {v: feste Variante, len: max. Länge s, lp: Tiefpass Hz} */
const L = (g, gain, delay = 0, p0 = 1, p1 = p0, x = {}) => ({ g, gain, delay, p0, p1, ...x });
/** Prozedurale Schicht */
const P = (proc, gain, delay = 0) => ({ proc, gain, delay });

/*
 * max: gleichzeitige Stimmen dieses Namens, gap: Mindestabstand (s), pr: Priorität (0 Kleinkram … 3 Ereignis),
 * rev: Hall-Anteil, duck: [Musikpegel 0..1, Haltezeit s], vol: Gesamtpegel
 */
const SFX = {
  // --- Nahkampf ---
  sword: { max: 6, gap: 0.025, pr: 1, rev: 0.1, vol: 0.9, layers: [L('clash', 0.5, 0, 0.82, 1.15), L('swish', 0.32, 0, 0.85, 1.2), L('body', 0.42, 0.004, 0.8, 1.05, { near: 1 })] },
  blunt: { max: 5, gap: 0.03, pr: 1, rev: 0.1, vol: 0.9, layers: [L('body', 0.85, 0, 0.68, 0.92, { near: 1 }), L('crush', 0.5, 0.008, 0.8, 1.1), L('swish', 0.28, 0, 0.65, 0.85)] },
  swing: { max: 4, gap: 0.04, pr: 0, rev: 0.05, vol: 0.8, layers: [L('swish', 0.6, 0, 0.8, 1.15)] },
  // --- Fernkampf ---
  arrow: { max: 6, gap: 0.025, pr: 1, rev: 0.08, vol: 0.85, layers: [P('twang', 0.4), L('swish_light', 0.62, 0.01, 0.9, 1.3), L('thunk', 0.45, 0.15, 0.85, 1.2)] },
  bolt: { max: 4, gap: 0.04, pr: 1, rev: 0.15, vol: 0.9, layers: [L('swish', 0.5, 0, 0.65, 0.85), L('magic', 0.45, 0.08, 1.1, 1.3, { len: 0.9 }), L('body', 0.5, 0.1, 0.8, 1)] },
  magic: { max: 5, gap: 0.04, pr: 1, rev: 0.2, vol: 0.85, layers: [L('magic', 0.55, 0, 0.88, 1.15, { len: 1.2 })] },
  fire: { max: 4, gap: 0.05, pr: 1, rev: 0.15, vol: 0.85, layers: [L('fire', 0.6, 0, 0.85, 1.1, { len: 1.3 }), L('sub', 0.25, 0, 1.2, 1.5, { near: 1 })] },
  lightning: { max: 3, gap: 0.07, pr: 2, rev: 0.22, vol: 0.9, layers: [P('crack', 0.45), L('lightning', 0.7, 0, 0.9, 1.1)] },
  heal: { max: 3, gap: 0.1, pr: 1, rev: 0.28, vol: 0.8, layers: [L('heal', 0.35, 0, 0.95, 1.06)] },
  // --- Belagerung / Einschläge ---
  explosion: { max: 4, gap: 0.07, pr: 2, rev: 0.25, vol: 1, duck: [0.6, 0.9], layers: [L('boom', 0.85, 0, 0.78, 1.05), L('sub', 0.9, 0, 0.85, 1.1, { near: 1 }), L('debris', 0.42, 0.07, 0.85, 1.15)] },
  king_hit: { max: 2, gap: 0.15, pr: 2, rev: 0.25, vol: 1, duck: [0.65, 0.6], layers: [L('boom', 0.55, 0, 0.7, 0.85), L('sub', 0.8, 0, 0.8, 0.95), L('debris', 0.5, 0.05, 0.75, 1)] },
  stomp: { max: 2, gap: 0.2, pr: 3, rev: 0.3, vol: 1, duck: [0.5, 1.1], layers: [L('drum', 1, 0, 0.78, 0.86), L('sub', 1, 0, 0.75, 0.9), L('quake', 0.7, 0.02, 0.9, 1.05), L('debris', 0.5, 0.06, 0.8, 1)] },
  shockwave: { max: 2, gap: 0.2, pr: 3, rev: 0.3, vol: 1, duck: [0.6, 0.9], layers: [L('swish', 0.75, 0, 0.5, 0.6), L('lightning', 0.6, 0.03, 0.75, 0.85, { len: 1.8 }), L('sub', 0.7, 0.02, 0.9, 1.1), P('crack', 0.35, 0.03)] },
  // --- Tod ---
  death_creep: { max: 4, gap: 0.045, pr: 0, rev: 0.1, vol: 0.75, layers: [L('creep_die', 0.5, 0, 0.62, 1.0)] },
  death_unit: { max: 3, gap: 0.06, pr: 1, rev: 0.12, vol: 0.8, layers: [L('unit_die', 0.5, 0, 0.88, 1.05), L('armor', 0.38, 0.12, 0.85, 1.1)] },
  // --- Ereignisse ---
  wave_start: { max: 1, gap: 1.2, pr: 3, rev: 0.35, vol: 0.95, duck: [0.45, 2.6], layers: [L('horn', 0.9, 0, 1, 1, { v: 0 }), L('drum', 1, 0, 1, 1, { v: 0 }), L('drum', 0.85, 0.42, 0.97, 0.97, { v: 1 }), L('drum', 0.95, 0.84, 0.9, 0.9, { v: 0 }), L('cymbal', 0.35, 0.84, 1, 1)] },
  boss: { max: 1, gap: 1.5, pr: 3, rev: 0.4, vol: 1, duck: [0.35, 3.2], layers: [L('roar', 1, 0, 0.72, 0.88, { v: 0 }), L('timp_roll', 0.6, 0), L('horn', 0.7, 0.1, 0.72, 0.72, { v: 1 }), L('gong', 0.7, 0.35, 0.82, 0.82, { v: 0 }), L('sub', 0.8, 0.35, 0.8, 0.8)] },
  leak: { max: 1, gap: 0.6, pr: 3, rev: 0.3, vol: 0.9, duck: [0.5, 1.6], layers: [L('horn', 0.75, 0, 0.84, 0.84, { v: 0, len: 2.2 }), L('anvil', 0.5, 0, 0.62, 0.62, { v: 0 }), L('anvil', 0.5, 0.3, 0.62, 0.62, { v: 1 }), L('anvil', 0.42, 0.6, 0.62, 0.62, { v: 0 }), L('drum', 0.75, 0, 0.82, 0.82)] },
  wave_clear: { max: 1, gap: 0.6, pr: 3, rev: 0.35, vol: 0.85, layers: [L('timp', 0.75, 0, 1, 1), L('gong', 0.35, 0.05, 1.15, 1.15, { v: 2 })] },
  gong: { max: 1, gap: 0.8, pr: 3, rev: 0.4, vol: 1, duck: [0.5, 2.2], layers: [L('gong', 1, 0, 1, 1, { v: 0 }), L('drum', 0.9, 0, 0.9, 0.9), L('timp', 0.55, 0.02, 0.9, 0.9)] },
  victory: { max: 1, gap: 1, pr: 3, rev: 0.4, vol: 0.9, layers: [L('gong', 0.85, 0, 1.06, 1.06, { v: 0 }), L('timp', 0.8, 0, 1, 1), L('drum', 0.8, 0, 1, 1), L('cymbal', 0.5, 0, 1, 1)] },
  defeat: { max: 1, gap: 1, pr: 3, rev: 0.45, vol: 0.9, layers: [L('gong', 0.95, 0, 0.7, 0.7, { v: 1 }), L('timp', 0.7, 0, 0.78, 0.78), L('drum', 0.7, 0.55, 0.75, 0.75)] },
  countdown: { max: 1, gap: 0.2, pr: 2, rev: 0.2, vol: 0.7, layers: [L('drum', 0.7, 0, 1.35, 1.35, { v: 2, len: 1.2 }), L('anvil', 0.12, 0, 1.5, 1.5, { v: 0, len: 0.6 })] },
  send: { max: 3, gap: 0.08, pr: 2, rev: 0.2, vol: 0.85, layers: [L('drum', 0.55, 0, 1.1, 1.3, { len: 1.4 }), L('swish', 0.4, 0, 0.6, 0.75)] },
  // --- Wirtschaft / Bauen ---
  build: { max: 3, gap: 0.06, pr: 2, rev: 0.12, vol: 0.85, layers: [L('hammer', 0.6, 0, 0.9, 1.05), L('hammer', 0.48, 0.17, 0.9, 1.05), L('body', 0.3, 0, 1, 1.2)] },
  upgrade: { max: 2, gap: 0.08, pr: 2, rev: 0.25, vol: 0.85, layers: [L('anvil', 0.5, 0, 0.95, 1.05), L('gem', 0.45, 0.05, 0.9, 1.1), L('magic', 0.22, 0.02, 1.3, 1.4, { len: 0.9 })] },
  sell: { max: 2, gap: 0.1, pr: 1, rev: 0.1, vol: 0.8, layers: [L('coins', 0.9, 0, 0.9, 1.1), L('coin_sack', 0.5, 0.05, 1, 1.1, { len: 0.8 })] },
  gold: { max: 3, gap: 0.05, pr: 0, rev: 0.06, vol: 0.7, layers: [L('coins', 0.8, 0, 0.92, 1.15, { len: 0.5 })] },
  income: { max: 2, gap: 0.15, pr: 1, rev: 0.12, vol: 0.85, layers: [L('coin_sack', 1, 0, 0.95, 1.05), L('gem', 0.45, 0.1, 1, 1.1)] },
  worker: { max: 3, gap: 0.08, pr: 1, rev: 0.1, vol: 0.85, layers: [L('hammer', 0.8, 0, 1.05, 1.2), L('coins', 0.55, 0.08, 1, 1.1)] },
  ether: { max: 3, gap: 0.08, pr: 1, rev: 0.25, vol: 0.8, layers: [L('gem', 0.5, 0, 0.8, 1), L('magic', 0.25, 0, 1.4, 1.6, { len: 0.8 })] },
  // --- Bewegung ---
  swoop: { max: 1, gap: 0.3, pr: 1, rev: 0.25, vol: 1, layers: [P('wind', 1)] },
  jump: { max: 2, gap: 0.08, pr: 0, rev: 0.05, vol: 0.7, layers: [L('body', 0.4, 0, 1.1, 1.3)] },
};

const UI = {
  hover: { max: 2, gap: 0.04, vol: 1, layers: [P('blip', 0.05)] },
  click: { max: 3, gap: 0.03, vol: 1, layers: [L('thunk', 0.22, 0, 1.7, 1.9, { len: 0.15 }), P('tick', 0.06)] },
  open: { max: 2, gap: 0.08, vol: 1, layers: [L('swish_light', 0.3, 0, 0.75, 0.8), L('gem', 0.1, 0.03, 1.2, 1.3, { len: 0.5 })] },
  close: { max: 2, gap: 0.08, vol: 1, layers: [L('swish_light', 0.26, 0, 0.6, 0.65)] },
  error: { max: 1, gap: 0.2, vol: 1, layers: [L('anvil', 0.16, 0, 0.5, 0.5, { v: 1, len: 0.5, lp: 1800 }), L('thunk', 0.25, 0.12, 0.7, 0.7, { len: 0.2 })] },
  confirm: { max: 2, gap: 0.08, vol: 1, layers: [L('drum', 0.3, 0, 1.4, 1.5, { len: 0.9 }), L('gem', 0.2, 0.02, 1.1, 1.2, { len: 0.6 })] },
};

/* ============================== Engine ============================== */

export class AudioEngine {
  /**
   * @param {{context?: BaseAudioContext, quality?: 'low'|'high', base?: string}} [opts]
   */
  constructor(opts = {}) {
    this.ctx = null;
    this.q = opts.quality === 'low' ? 'low' : 'high';
    this.base = opts.base ?? 'assets/audio/';
    this._vol = { master: 0.8, music: 0.55, sfx: 0.8, ui: 0.7 };
    this._muted = false;
    this._I = 0.3;
    this._want = null; // gewünschte Stimmung
    this._track = null; // laufende Musik {name, file, src, g}
    this._fading = new Set();
    this._battleIdx = 0;
    this._sprites = new Map(); // Gruppe → AudioBuffer
    this._spriteLoad = null;
    this._raw = new Map(); // Musikdatei → Promise<ArrayBuffer>
    this._dec = new Map(); // Musikdatei → {p: Promise<AudioBuffer>, buf, used}
    this._fx = new Map(); // Name → {last, voices[]}
    this._voices = [];
    this._lastVar = new Map();
    this._offline = false;
    this._unlocking = null;
    this._duckUntil = 0;
    this._duckDepth = 1;
    if (opts.context) {
      this.ctx = opts.context;
      this._offline = typeof opts.context.startRendering === 'function';
      this._build();
    }
  }

  /* ---------- öffentliche API ---------- */

  async unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch (_) {
        this.ctx = new AC();
      }
      this._build();
    }
    if (!this._offline && this.ctx.state !== 'running' && this.ctx.resume) {
      if (!this._unlocking) this._unlocking = this.ctx.resume().catch(() => {}).finally(() => (this._unlocking = null));
      await this._unlocking;
    }
    this._loadSprites();
    if (this._want) this._switch(this._want, true);
    this._prefetchAll();
    return this.ctx.state === 'running';
  }

  /** Lädt alle Effekte (+ optional Musikdateien vollständig dekodiert) – v. a. für Offline-Rendering/Tests. */
  async ready(opts = {}) {
    await this._loadSprites();
    for (const m of opts.music || []) {
      for (const f of TRACKS[m] ? TRACKS[m].files : [m]) await this._decode(f);
    }
    return this.stats();
  }

  setVolume(channel, v) {
    if (!(channel in this._vol)) return;
    this._vol[channel] = clamp(Number(v) || 0, 0, 1);
    this._applyVolume(channel);
  }

  getVolume(channel) {
    return this._vol[channel];
  }

  setMuted(b) {
    this._muted = !!b;
    this._applyVolume('master');
  }

  /** Stimmung wechseln: menu | build | battle | boss | arena | victory | defeat | null (Stille) */
  playMusic(track) {
    const name = track && TRACKS[track] ? track : null;
    if (name === this._want && name && !TRACKS[name].once) return;
    this._want = name;
    if (!this.ctx || !this._graph) return;
    this._switch(name, false);
  }

  /** Windzug für Kameraschwenks (dur Sekunden; up = Aufstieg in die Vogelperspektive) */
  wind(dur = 2, opts = {}) {
    this._windDur = dur;
    this._windUp = !!opts.up;
    return this._play('sfx', 'swoop', { volume: opts.volume ?? 0.9 });
  }

  /** Kampfintensität 0..1 – öffnet die Klangfarbe der Musik (heller, präsenter). */
  setIntensity(x) {
    this._I = clamp(Number(x) || 0, 0, 1);
    if (!this._graph) return;
    const now = this.ctx.currentTime;
    this._tone.frequency.setTargetAtTime(7000 + 13000 * Math.pow(this._I, 0.7), now, 0.8);
    this._musicLift.gain.setTargetAtTime(0.88 + 0.16 * this._I, now, 0.8);
  }

  /**
   * Effekt abspielen.
   * @param {string} name
   * @param {{volume?: number, pan?: number, pitch?: number, far?: number}} [opts] far: 0 (nah) … 1 (Rand der Hörweite)
   */
  sfx(name, opts = {}) {
    return this._play('sfx', name, opts || {});
  }

  ui(name) {
    return this._play('ui', name, {});
  }

  setQuality(q) {
    const nq = q === 'low' ? 'low' : 'high';
    if (nq === this.q) return;
    this.q = nq;
    if (this._graph) this._buildReverb();
  }

  /** Diagnose */
  stats() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this._voices = this._voices.filter((v) => v.end > now && !v.dead);
    return {
      liveVoices: this._voices.length,
      fxVoices: this._voices.length,
      track: this._track ? this._track.name : null,
      file: this._track ? this._track.file : null,
      sprites: this._sprites.size,
      decodedMusic: [...this._dec.values()].filter((d) => d.buf).length,
      quality: this.q,
      state: this.ctx ? this.ctx.state : 'none',
    };
  }

  /* ---------- Graph ---------- */

  _build() {
    const c = this.ctx;
    this.musicIn = c.createGain();
    this._duck = c.createGain();
    this._musicLift = c.createGain();
    this._musicLift.gain.value = 0.93;
    this._tone = c.createBiquadFilter();
    this._tone.type = 'lowpass';
    this._tone.frequency.value = 12000;
    this._tone.Q.value = 0.5;
    this.sfxIn = c.createGain();
    this.uiIn = c.createGain();
    this._bus = c.createGain();
    this._bus.gain.value = 1.5; // Aufholverstärkung vor Kompressor/Limiter
    this.musicIn.connect(this._duck);
    this._duck.connect(this._musicLift);
    this._musicLift.connect(this._tone);
    this._tone.connect(this._bus);
    this.sfxIn.connect(this._bus);
    this.uiIn.connect(this._bus);

    // Hall (für Effekte; die Musik bringt ihren eigenen Raum mit)
    this.roomIn = c.createGain();
    this._room = c.createConvolver();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 200;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this._roomRet = c.createGain();
    this.roomIn.connect(this._room);
    this._room.connect(hp);
    hp.connect(lp);
    lp.connect(this._roomRet);
    this._roomRet.connect(this.sfxIn);

    // Dynamik: DC-Sperre → „Glue“-Kompressor → Limiter → Master → Soft-Clip
    this._dc = c.createBiquadFilter();
    this._dc.type = 'highpass';
    this._dc.frequency.value = 25;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 8;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.22;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -4;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.master = c.createGain();
    this._pre = c.createGain();
    this._pre.gain.value = 0.25;
    this._clip = c.createWaveShaper();
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = ((i / (n - 1)) * 2 - 1) * 4;
      const a = Math.abs(u);
      curve[i] = Math.sign(u) * (a < 0.85 ? a : 0.85 + 0.14 * Math.tanh((a - 0.85) / 0.14));
    }
    this._clip.curve = curve;
    this._bus.connect(this._dc);
    this._dc.connect(this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(this._pre);
    this._pre.connect(this._clip);
    this._clip.connect(c.destination);

    // Rauschen für prozedurale Schichten
    const sr = c.sampleRate;
    this._nbuf = c.createBuffer(1, sr * 2, sr);
    const nd = this._nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this._graph = true;
    this._buildReverb();
    for (const ch of ['master', 'music', 'sfx', 'ui']) this._applyVolume(ch, true);
  }

  _buildReverb() {
    const hq = this.q === 'high';
    this._room.normalize = true;
    this._room.buffer = this._makeIR(hq ? 2.4 : 1.4, 0.012, 3.2);
    this._roomRet.gain.value = hq ? 0.9 : 0.6;
  }

  /** Stereo-Impulsantwort: zunehmend gedämpftes, exponentiell abklingendes Rauschen + frühe Reflexionen. */
  _makeIR(seconds, pre, damp) {
    const c = this.ctx;
    const sr = c.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = c.createBuffer(2, len, sr);
    const p0 = Math.floor(pre * sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = p0; i < len; i++) {
        const x = (i - p0) / (len - p0);
        const a = Math.max(0.04, 0.9 * Math.exp(-x * damp));
        lp += a * (Math.random() * 2 - 1 - lp);
        const fadeIn = Math.min(1, (i - p0) / (sr * 0.006));
        d[i] = lp * Math.pow((2 - a) / a, 0.25) * Math.exp(-6.9 * x) * fadeIn;
      }
      for (let k = 0; k < 12; k++) {
        const pos = p0 + Math.floor(rnd(0.004, 0.09) * sr);
        if (pos < len) d[pos] += (Math.random() < 0.5 ? -1 : 1) * rnd(0.2, 0.6) * (1 - k / 14);
      }
    }
    return buf;
  }

  _applyVolume(ch, instant = false) {
    if (!this._graph) return;
    const node = { master: this.master, music: this.musicIn, sfx: this.sfxIn, ui: this.uiIn }[ch];
    let g = Math.pow(this._vol[ch], 1.5); // wahrnehmungsgerechte Kurve
    if (ch === 'master' && this._muted) g = 0;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    if (instant) node.gain.setValueAtTime(g, now);
    else {
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.setTargetAtTime(g, now, 0.06);
    }
  }

  /* ---------- Laden ---------- */

  async _fetch(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.arrayBuffer();
  }

  _decodeData(ab) {
    // Promise-Form; ältere Implementierungen nur mit Callbacks
    return new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  _loadSprites() {
    if (this._spriteLoad) return this._spriteLoad;
    const names = Object.keys(SFX_SPRITES);
    this._spriteLoad = Promise.all(
      names.map(async (n) => {
        try {
          const buf = await this._decodeData(await this._fetch(`${this.base}sfx/${n}.ogg`));
          this._sprites.set(n, buf);
        } catch (e) {
          console.warn('Audio: Effekt-Gruppe nicht geladen', n, e && e.message);
        }
      }),
    );
    return this._spriteLoad;
  }

  _rawMusic(file) {
    let p = this._raw.get(file);
    if (!p) {
      p = this._fetch(`${this.base}music/${file}.ogg`);
      p.catch(() => this._raw.delete(file));
      this._raw.set(file, p);
    }
    return p;
  }

  /** Alle Musikdateien (komprimiert, ~9 MB) nacheinander im Hintergrund holen. */
  async _prefetchAll() {
    if (this._prefetching || this._offline) return;
    this._prefetching = true;
    for (const f of Object.keys(MUSIC_FILES)) {
      try {
        await this._rawMusic(f);
      } catch (_) {
        /* später erneut */
      }
    }
  }

  _decode(file) {
    let d = this._dec.get(file);
    if (d) {
      d.used = performance.now();
      return d.p;
    }
    d = { buf: null, used: performance.now() };
    d.p = this._rawMusic(file)
      .then((ab) => this._decodeData(ab.slice(0)))
      .then((buf) => {
        d.buf = buf;
        this._evict();
        return buf;
      })
      .catch((e) => {
        this._dec.delete(file);
        console.warn('Audio: Musik nicht geladen', file, e && e.message);
        return null;
      });
    this._dec.set(file, d);
    return d.p;
  }

  _evict() {
    const busy = new Set([this._track && this._track.file, ...[...this._fading].map((t) => t.file)]);
    const done = [...this._dec.entries()].filter(([f, d]) => d.buf && !busy.has(f)).sort((a, b) => a[1].used - b[1].used);
    let n = [...this._dec.values()].filter((d) => d.buf).length;
    for (const [f] of done) {
      if (n <= MAX_DECODED) break;
      this._dec.delete(f);
      n--;
    }
  }

  /* ---------- Musik-Steuerung ---------- */

  _switch(name, fromUnlock) {
    const c = this.ctx;
    const cur = this._track;
    const def = name ? TRACKS[name] : null;
    if (cur && cur.name === name && !def.once) return;
    const fadeOut = def && def.once ? 1.2 : 2.5;
    if (cur) this._fadeOut(cur, fadeOut);
    this._track = null;
    if (!def) return;
    let file = def.files[0];
    if (def.files.length > 1) file = def.files[this._battleIdx++ % def.files.length];
    const token = (this._token = (this._token || 0) + 1);
    this._decode(file).then((buf) => {
      if (!buf || token !== this._token || this._want !== name) return;
      const meta = MUSIC_FILES[file] || {};
      const now = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = buf;
      if (!def.once) {
        src.loop = true;
        src.loopStart = 0;
        src.loopEnd = Math.min(buf.duration, meta.sec || buf.duration);
      }
      const g = c.createGain();
      const fadeIn = def.once ? 0.05 : fromUnlock || !cur ? 1.5 : 2.5;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(def.gain, now + fadeIn);
      src.connect(g);
      g.connect(this.musicIn);
      src.start(now + 0.02);
      const T = { name, file, src, g };
      this._track = T;
      if (def.once) {
        src.onended = () => {
          if (this._track === T) this._track = null;
          try {
            g.disconnect();
          } catch (_) {
            /* egal */
          }
        };
      }
      // voraussichtlich nächste Stücke schon dekodieren (nach dem Einblenden)
      if (!this._offline) setTimeout(() => (NEXT[file] || []).forEach((f) => this._decode(f)), 3000);
    });
  }

  _fadeOut(T, fade) {
    const now = this.ctx.currentTime;
    const g = T.g.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    this._fading.add(T);
    try {
      T.src.onended = null;
      T.src.stop(now + fade + 0.05);
    } catch (_) {
      /* bereits gestoppt */
    }
    const end = () => {
      this._fading.delete(T);
      try {
        T.g.disconnect();
      } catch (_) {
        /* egal */
      }
    };
    T.src.onended = end;
  }

  /** Musik kurz absenken (große Einschläge, Hörner) – depth: Zielpegel 0..1, hold: Sekunden */
  _duckMusic(depth, hold) {
    const now = this.ctx.currentTime;
    if (now < this._duckUntil && depth >= this._duckDepth) {
      this._duckUntil = Math.max(this._duckUntil, now + hold);
    } else {
      this._duckDepth = depth;
      this._duckUntil = now + hold;
    }
    const g = this._duck.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(this._duckDepth, now, 0.04);
    g.setTargetAtTime(1, this._duckUntil, 0.7);
  }

  /* ---------- Effekte ---------- */

  _play(bus, name, opts) {
    if (!this.ctx || !this._graph) return false;
    if (!this._offline && this.ctx.state !== 'running') return false;
    const def = (bus === 'ui' ? UI : SFX)[name];
    if (!def) return false;
    const c = this.ctx;
    const now = c.currentTime;
    const key = bus + ':' + name;
    let st = this._fx.get(key);
    if (!st) this._fx.set(key, (st = { last: -1e9, voices: [] }));
    if (now - st.last < def.gap) return false;
    st.voices = st.voices.filter((v) => v.end > now && !v.dead);
    this._voices = this._voices.filter((v) => v.end > now && !v.dead);
    const pr = def.pr ?? 1;
    const cap = this.q === 'high' ? 40 : 20;
    const max = this.q === 'high' ? def.max : Math.max(1, Math.ceil(def.max / 2));
    // gleicher Name: älteste Stimme weich ausblenden
    if (st.voices.length >= max) this._kill(st.voices.shift(), now);
    // globale Obergrenze: unwichtigere/älteste Stimme opfern, sonst verwerfen
    if (this._voices.length >= cap) {
      let victim = null;
      for (const v of this._voices) if (v.pr < pr || (v.pr === pr && pr < 2)) if (!victim || v.pr < victim.pr || v.t0 < victim.t0) victim = v;
      if (!victim) return false;
      this._kill(victim, now);
    }
    st.last = now;
    const t = now + 0.005;
    const far = clamp(Number(opts.far) || 0, 0, 1);
    const pitch = clamp(Number(opts.pitch) || 1, 0.25, 4);
    const V = { nodes: [], srcs: 0, end: t, t0: now, pr, dead: false };
    const out = c.createGain();
    out.gain.value = (def.vol ?? 1) * clamp(opts.volume ?? 1, 0, 1.5) / (1 + 0.22 * st.voices.length);
    V.out = out;
    V.nodes.push(out);
    let tail = out;
    if (far > 0.08 || def.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.min(def.lp || 20000, 18000 * Math.pow(0.12, far));
      f.Q.value = 0.6;
      out.connect(f);
      tail = f;
      V.nodes.push(f);
    }
    const pan = c.createStereoPanner();
    pan.pan.value = clamp(Number(opts.pan) || 0, -1, 1);
    tail.connect(pan);
    pan.connect(bus === 'ui' ? this.uiIn : this.sfxIn);
    V.nodes.push(pan);
    const rev = (def.rev || 0) * (1 + far * 1.5);
    if (bus === 'sfx' && rev > 0 && (this.q === 'high' || rev >= 0.2)) {
      const s = c.createGain();
      s.gain.value = rev;
      pan.connect(s);
      s.connect(this.roomIn);
      V.nodes.push(s);
    }
    for (const ly of def.layers) {
      try {
        if (ly.proc) this._proc(V, out, ly.proc, t + ly.delay, ly.gain, pitch);
        else this._layer(V, out, ly, t, pitch, far);
      } catch (e) {
        /* einzelne Schicht fehlerhaft → Rest trotzdem spielen */
      }
    }
    if (V.srcs === 0) {
      this._dispose(V);
      return false;
    }
    if (def.duck && bus === 'sfx') this._duckMusic(def.duck[0] + (1 - def.duck[0]) * Math.max(far, 1 - clamp(opts.volume ?? 1, 0, 1)) * 0.8, def.duck[1]);
    st.voices.push(V);
    this._voices.push(V);
    return true;
  }

  _layer(V, out, ly, t, pitch, far = 0) {
    const buf = this._sprites.get(ly.g);
    const vars = SFX_SPRITES[ly.g];
    if (!buf || !vars || !vars.length) return;
    let vi = ly.v;
    if (vi === undefined) {
      // Zufallsvariante, nicht zweimal hintereinander dieselbe
      const last = this._lastVar.get(ly.g);
      vi = Math.floor(Math.random() * vars.length);
      if (vars.length > 1 && vi === last) vi = (vi + 1 + Math.floor(Math.random() * (vars.length - 1))) % vars.length;
      this._lastVar.set(ly.g, vi);
    }
    const [off, dur0] = vars[Math.min(vi, vars.length - 1)];
    const dur = ly.len ? Math.min(dur0, ly.len) : dur0;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    const rate = clamp(rnd(ly.p0, ly.p1) * pitch, 0.25, 4);
    src.playbackRate.value = rate;
    const g = c.createGain();
    const t0 = t + ly.delay;
    const real = dur / rate;
    // Körper-/Bassschichten nur aus der Nähe – ferne Kämpfe bleiben schlank (keine Bass-Suppe)
    const lg = ly.near ? ly.gain * (1 - far) * (1 - far) : ly.gain;
    if (lg < 0.01) return;
    g.gain.setValueAtTime(lg, t0);
    if (ly.len && ly.len < dur0) {
      // gekürzt → weich ausblenden
      g.gain.setValueAtTime(lg, t0 + real * 0.7);
      g.gain.linearRampToValueAtTime(0, t0 + real);
    }
    src.connect(g);
    let dst = out;
    if (ly.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = ly.lp;
      g.connect(f);
      f.connect(out);
      V.nodes.push(f);
    } else g.connect(dst);
    V.nodes.push(src, g);
    this._srcStart(V, src, t0, off, dur, real);
  }

  _srcStart(V, src, t0, off, dur, real) {
    V.srcs++;
    src.onended = () => {
      if (--V.srcs <= 0) this._dispose(V);
    };
    if (off !== undefined) src.start(t0, off, dur);
    else src.start(t0);
    if (off === undefined) src.stop(t0 + real);
    V.end = Math.max(V.end, t0 + real);
  }

  _kill(V, now) {
    if (!V || V.dead) return;
    const g = V.out.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(0, now, 0.015);
    } catch (_) {
      /* egal */
    }
    V.end = Math.min(V.end, now + 0.08);
    V.pr = -1;
    for (const n of V.nodes) {
      if (typeof n.stop === 'function') {
        try {
          n.stop(now + 0.1);
        } catch (_) {
          /* noch nicht gestartet oder schon gestoppt */
        }
      }
    }
  }

  _dispose(V) {
    if (V.dead) return;
    V.dead = true;
    for (const n of V.nodes) {
      try {
        n.onended = null;
        n.disconnect();
      } catch (_) {
        /* bereits getrennt */
      }
    }
    V.nodes.length = 0;
  }

  /* ---------- Prozedurale Schichten ---------- */

  _noise(V, t0, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._nbuf;
    s.loop = true;
    s.playbackRate.value = rate;
    V.nodes.push(s);
    V.srcs++;
    s.onended = () => {
      if (--V.srcs <= 0) this._dispose(V);
    };
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur);
    V.end = Math.max(V.end, t0 + dur);
    return s;
  }

  _osc(V, type, t0, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    V.nodes.push(o);
    V.srcs++;
    o.onended = () => {
      if (--V.srcs <= 0) this._dispose(V);
    };
    o.start(t0);
    o.stop(t0 + dur);
    V.end = Math.max(V.end, t0 + dur);
    return o;
  }

  _env(V, dest, t, peak, atk, dec) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    g.connect(dest);
    V.nodes.push(g);
    return g;
  }

  _filter(V, type, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    V.nodes.push(b);
    return b;
  }

  _proc(V, out, kind, t, gain, p) {
    const c = this.ctx;
    if (kind === 'twang') {
      // Bogensehne: tiefer, schnell abklingender Saitenton + Klick
      const o = this._osc(V, 'triangle', t, 0.25);
      o.frequency.setValueAtTime(rnd(105, 125) * p, t);
      o.frequency.exponentialRampToValueAtTime(rnd(80, 92) * p, t + 0.12);
      const lp = this._filter(V, 'lowpass', 900);
      o.connect(lp);
      lp.connect(this._env(V, out, t, gain, 0.003, 0.2));
      const n = this._noise(V, t, 0.05, 1);
      const bp = this._filter(V, 'bandpass', 2400, 1.2);
      n.connect(bp);
      bp.connect(this._env(V, out, t, gain * 0.6, 0.001, 0.03));
    } else if (kind === 'crack') {
      // Donnerknall: heller Rausch-Peitschenschlag + tiefes Grollen
      const n = this._noise(V, t, 1.4, 1);
      const hp = this._filter(V, 'highpass', 1800, 0.7);
      n.connect(hp);
      hp.connect(this._env(V, out, t, gain, 0.001, 0.09));
      const lp = this._filter(V, 'lowpass', 220, 0.8);
      n.connect(lp);
      lp.connect(this._env(V, out, t + 0.02, gain * 1.4, 0.04, 1.2));
    } else if (kind === 'wind') {
      const dur = Math.max(0.4, this._windDur || 2);
      const up = !!this._windUp;
      const n = this._noise(V, t, dur + 0.6, 1);
      const bus = c.createGain();
      V.nodes.push(bus);
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.5 * gain, t + dur * 0.45);
      bus.gain.exponentialRampToValueAtTime(0.2 * gain, t + dur * 0.8);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      bus.connect(out);
      for (const [k, pn] of [[1, -0.6], [1.27, 0.6]]) {
        const bp = this._filter(V, 'bandpass', 500, 2);
        const f0 = (up ? 800 : 380) * k * p, f1 = (up ? 340 : 1300) * k * p;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55);
        bp.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur + 0.4);
        const sp = c.createStereoPanner();
        sp.pan.value = pn;
        V.nodes.push(sp);
        n.connect(bp);
        bp.connect(sp);
        sp.connect(bus);
      }
      const lp = this._filter(V, 'lowpass', 240, 0.9);
      n.connect(lp);
      lp.connect(bus);
    } else if (kind === 'blip') {
      const o = this._osc(V, 'sine', t, 0.08);
      o.frequency.setValueAtTime(1500 * p, t);
      o.frequency.exponentialRampToValueAtTime(1700 * p, t + 0.03);
      o.connect(this._env(V, out, t, gain, 0.004, 0.05));
    } else if (kind === 'tick') {
      const n = this._noise(V, t, 0.04, 1);
      const bp = this._filter(V, 'bandpass', 3000, 2);
      n.connect(bp);
      bp.connect(this._env(V, out, t, gain, 0.001, 0.015));
    }
  }
}

export default AudioEngine;
