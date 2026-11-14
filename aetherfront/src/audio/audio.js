/*
 * Aetherfront – Audio-Engine
 * ------------------------------------------------------------------
 * Alles wird live mit der Web Audio API synthetisiert – keine Audio-Dateien.
 *
 *  Signalfluss:
 *    Musik-Spuren ─┐                         ┌─ Hall (Convolver, ~3,2 s) ─┐
 *    SFX-Stimmen ──┼─ Kanal-Gains (music/sfx/ui) ─► Bus ─► Kompressor ─► Limiter ─► Master ─► Soft-Clip ─► Ausgang
 *    UI-Klänge ────┘                         └─ Raum (Convolver, ~1,6 s) ─┘
 *
 *  Musik: generativ, aber komponiert (d-Moll), Lookahead-Scheduler auf AudioContext-Zeit.
 *  SFX: Stimmenbegrenzung pro Name (max. gleichzeitig + Mindestabstand), Dichte-Ducking,
 *       automatisches Aufräumen aller Knoten nach dem Ausklingen.
 *
 *  Für Offline-Tests kann ein Kontext injiziert werden:
 *    const eng = new AudioEngine({ context: new OfflineAudioContext(2, n, 48000) });
 *    // Scheduler dann manuell über eng._tick() (z. B. in ctx.suspend()-Callbacks) treiben.
 */

/* ============================== Hilfen ============================== */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const hz = () => (Math.random() - 0.5) * 0.014; // Humanisierung (±7 ms)

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** Notenname → MIDI ('D4' = 62) */
const N = (s) => {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
  return PC[m[1]] + (Number(m[2]) + 1) * 12;
};
const QUAL = { m: [0, 3, 7], M: [0, 4, 7], dim: [0, 3, 6], sus4: [0, 5, 7], sus2: [0, 2, 7] };

function chord(name) {
  const m = /^([A-G][#b]?)(m|dim|sus4|sus2)?$/.exec(name);
  const r = PC[m[1]];
  const q = QUAL[m[2] || 'M'];
  return { name, r, pcs: q.map((i) => (r + i) % 12), fifth: q[2], bass: 33 + ((r - 9 + 12) % 12) };
}

/** Dreiklang mit möglichst kleiner Stimmführung zur vorherigen Lage setzen. */
function voiceTriad(pcs, prev, lo, hi) {
  let best = null;
  let bestD = Infinity;
  for (let inv = 0; inv < 3; inv++) {
    for (let base = lo; base < lo + 12; base++) {
      if (base % 12 !== pcs[inv]) continue;
      const notes = [base];
      for (let k = 1; k < 3; k++) {
        const pc = pcs[(inv + k) % 3];
        let x = notes[k - 1] + 1;
        while (x % 12 !== pc) x++;
        notes.push(x);
      }
      if (notes[2] > hi) continue;
      const d = prev ? notes.reduce((s, x, i) => s + Math.abs(x - prev[i]), 0) : Math.abs(notes[1] - (lo + hi) / 2);
      if (d < bestD) {
        bestD = d;
        best = notes;
      }
    }
  }
  return best;
}

function progression(names, lo = 57, hi = 76) {
  let prev = null;
  const out = names.map((nm) => {
    const c = chord(nm);
    c.v = voiceTriad(c.pcs, prev, lo, hi);
    prev = c.v;
    return c;
  });
  // Länge gleicher aufeinanderfolgender Akkorde (für gehaltene Flächen)
  for (let i = 0; i < out.length; i++) {
    out[i].start = i === 0 || out[i - 1].name !== out[i].name;
    let len = 1;
    while (i + len < out.length && out[i + len].name === out[i].name) len++;
    out[i].len = len;
  }
  return out;
}
const timpNote = (ch) => 38 + ((ch.r - 2 + 12) % 12); // D2 … C#3

/** Melodie-Notation: [Beat-Position, Note, Dauer in Beats] */
const mel = (rows) => rows.map((bar) => bar.map(([p, n, d]) => [p, typeof n === 'string' ? N(n) : n, d]));

/** Perkussive Hüllkurve (exponentiell, klickfrei). */
function perc(p, t, peak, atk, dec) {
  p.value = 0; // vor dem Einsatz stumm (Quellen können früher starten)
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
  p.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  return t + atk + dec;
}

/* ============================== Stimmen-Verwaltung ============================== */

class Voice {
  constructor(eng) {
    this.e = eng;
    this.nodes = [];
    this.pending = 0;
    this.dead = false;
    eng._live++;
  }
  n(node) {
    this.nodes.push(node);
    return node;
  }
  play(src, t0, t1, offset) {
    this.nodes.push(src);
    this.pending++;
    src.onended = () => {
      if (--this.pending <= 0) this.dispose();
    };
    if (offset !== undefined) src.start(Math.max(0, t0), offset);
    else src.start(Math.max(0, t0));
    src.stop(Math.max(t0, t1));
    return src;
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.e._live--;
    for (const nd of this.nodes) {
      try {
        nd.onended = null;
        nd.disconnect();
      } catch (_) {
        /* bereits getrennt */
      }
    }
    this.nodes.length = 0;
  }
}

/* ============================== Klang-Tabellen ============================== */

const FORMANTS = {
  a: [[800, 1, 5], [1150, 0.55, 6], [2900, 0.22, 8], [3900, 0.12, 9]],
  o: [[450, 1, 5], [800, 0.5, 6], [2830, 0.1, 8], [3800, 0.06, 9]],
};

// [max. gleichzeitig, Mindestabstand s, Tonhöhen-Variation, Pegel]
const LIMITS = {
  'sfx:build': [3, 0.06, 0.04, 1],
  'sfx:upgrade': [2, 0.08, 0, 1.8],
  'sfx:sell': [2, 0.1, 0.03, 1.2],
  'sfx:gold': [3, 0.045, 0.1, 1],
  'sfx:sword': [6, 0.022, 0.1, 1],
  'sfx:blunt': [5, 0.03, 0.1, 1],
  'sfx:arrow': [6, 0.022, 0.1, 1],
  'sfx:bolt': [5, 0.03, 0.08, 1],
  'sfx:magic': [5, 0.035, 0.08, 1],
  'sfx:fire': [4, 0.05, 0.08, 1],
  'sfx:lightning': [3, 0.06, 0.06, 1],
  'sfx:heal': [3, 0.08, 0.03, 1.4],
  'sfx:explosion': [4, 0.07, 0.08, 1],
  'sfx:death_creep': [5, 0.03, 0.18, 1.3],
  'sfx:death_unit': [3, 0.06, 0.08, 1],
  'sfx:leak': [1, 0.45, 0, 1],
  'sfx:king_hit': [2, 0.15, 0.05, 1],
  'sfx:wave_start': [1, 1.2, 0, 0.6],
  'sfx:wave_clear': [1, 0.6, 0, 1],
  'sfx:boss': [1, 1.5, 0, 0.6],
  'sfx:send': [3, 0.08, 0.06, 2.0],
  'sfx:income': [2, 0.15, 0, 1],
  'sfx:worker': [3, 0.08, 0.06, 1.6],
  'sfx:victory': [1, 1, 0, 0.75],
  'sfx:defeat': [1, 1, 0, 0.6],
  'sfx:countdown': [1, 0.2, 0, 1],
  'ui:hover': [2, 0.035, 0.04, 2.5],
  'ui:click': [3, 0.03, 0.02, 2.0],
  'ui:open': [2, 0.08, 0, 2.5],
  'ui:close': [2, 0.08, 0, 2.5],
  'ui:error': [1, 0.2, 0, 2.0],
  'ui:confirm': [2, 0.08, 0, 2.5],
};

/* ============================== Musik (Spuren) ============================== */

const HERO = mel([
  [[0, 'D4', 1.5], [1.5, 'A4', 0.5], [2, 'A4', 2]],
  [[0, 'G4', 1], [1, 'F4', 1], [2, 'D4', 2]],
  [[0, 'C5', 1.5], [1.5, 'A4', 0.5], [2, 'F4', 1], [3, 'A4', 1]],
  [[0, 'G4', 3], [3, 'E4', 1]],
  [[0, 'D4', 1.5], [1.5, 'A4', 0.5], [2, 'D5', 2]],
  [[0, 'D5', 1], [1, 'C5', 0.5], [1.5, 'Bb4', 0.5], [2, 'G4', 2]],
  [[0, 'F4', 1], [1, 'G4', 1], [2, 'A4', 1], [3, 'Bb4', 1]],
  [[0, 'A4', 2.5], [2.5, 'C#5', 0.5], [3, 'E5', 1]],
]);

const BATTLE_MEL = mel([
  [[0, 'D4', 1.5], [1.5, 'F4', 0.5], [2, 'A4', 1], [3, 'G4', 0.5], [3.5, 'F4', 0.5]],
  [[0, 'E4', 1], [1, 'D4', 1], [2, 'A3', 2]],
  [[0, 'Bb3', 1], [1, 'D4', 0.5], [1.5, 'F4', 0.5], [2, 'Bb4', 2]],
  [[0, 'A4', 1], [1, 'G4', 1], [2, 'E4', 1], [3, 'C4', 1]],
  [[0, 'D4', 1.5], [1.5, 'F4', 0.5], [2, 'A4', 1], [3, 'D5', 1]],
  [[0, 'C5', 1], [1, 'A4', 1], [2, 'F4', 1], [3, 'E4', 1]],
  [[0, 'D4', 1], [1, 'G4', 1], [2, 'Bb4', 1], [3, 'D5', 1]],
  [[0, 'C#5', 2], [2, 'E5', 1], [3, 'A4', 1]],
]);

const BOSS_MEL = mel([
  [[0, 'D3', 1.5], [1.5, 'D3', 0.5], [2, 'F3', 1], [3, 'E3', 1]],
  [[0, 'Eb3', 2], [2, 'D3', 2]],
  [[0, 'Eb3', 1.5], [1.5, 'Eb3', 0.5], [2, 'G3', 1], [3, 'F3', 1]],
  [[0, 'D3', 2], [2, 'Bb2', 2]],
  [[0, 'D3', 1.5], [1.5, 'D3', 0.5], [2, 'F3', 1], [3, 'A3', 1]],
  [[0, 'A3', 2], [2, 'G#3', 2]],
  [[0, 'F3', 1], [1, 'D3', 1], [2, 'Bb2', 2]],
  [[0, 'C#3', 2], [2, 'A2', 2]],
]);

const T_LOW = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
const T_MID = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1];
const T_HI = [0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1];
const B_LOW = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0];
const B_MID = [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1];

function playMel(eng, S, rows, bar, bi, t, fn) {
  const row = rows[bar % rows.length];
  for (const [pos, m, d] of row) {
    if (Math.floor(pos) !== bi) continue;
    fn(t + (pos - bi) * S.spb + hz(), m, d * S.spb);
  }
}

const TRACKS = {
  /* ---------- Hauptmenü: majestätisch, Chor + Streicher, Helden-Motiv ---------- */
  menu: {
    bpm: 66,
    setup(S) {
      S.prog = progression(['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Bb', 'A']);
      S.st = {
        str: this._strip(S, 0.85, 0, 0.5),
        low: this._strip(S, 0.75, -0.15, 0.35),
        choir: this._strip(S, 0.6, 0.1, 0.65),
        brass: this._strip(S, 0.85, -0.2, 0.45),
        harp: this._strip(S, 0.7, 0.3, 0.45),
        bell: this._strip(S, 0.4, 0.35, 0.65),
        bass: this._strip(S, 0.8, 0, 0.04),
        perc: this._strip(S, 0.8, 0, 0.35),
        cym: this._strip(S, 0.55, 0.05, 0.45),
      };
    },
    beat(S, b, t) {
      const spb = S.spb;
      const bar = Math.floor(b / 4);
      const bi = b % 4;
      const ch = S.prog[bar % 8];
      const B = bar % 16 >= 8;
      const st = S.st;
      if (bi === 0) {
        const L = 4 * spb + 0.2;
        for (const m of ch.v) this._strings(st.str, t + hz(), m, L, B ? 0.62 : 0.52, { atk: B ? 0.7 : 1.1, rel: 1.5, bright: B ? 0.9 : 0.7 });
        this._strings(st.low, t, ch.bass + 12, L, 0.6, { atk: 0.6, rel: 1.2, bright: 0.6 });
        this._bass(st.bass, t, ch.bass, L, 0.55, { atk: 0.3, rel: 0.9 });
        for (const m of ch.v) this._choir(st.choir, t + hz(), m, L, B ? 0.55 : 0.42, { atk: 1.1, rel: 1.8, vowel: 'a' });
        this._timp(st.perc, t, timpNote(ch), B ? 0.75 : 0.45);
        if (bar % 8 === 7) this._cymbal(st.cym, t, 0.45, { swell: 4 * spb });
        if (bar % 8 === 0 && bar > 0) this._cymbal(st.cym, t, B ? 0.5 : 0.32, { dec: 3.2 });
      }
      if (!B) {
        const arp = [ch.bass + 12, ch.v[0], ch.v[1], ch.v[2], ch.v[0] + 12, ch.v[1] + 12, ch.v[2] + 12, ch.v[1] + 12];
        for (let k = 0; k < 2; k++) {
          const i = bi * 2 + k;
          this._harp(st.harp, t + (k * spb) / 2 + hz(), arp[i], (i === 0 ? 0.5 : 0.36) + rnd(-0.05, 0.05));
        }
        if (bar % 2 === 1 && bi === 2) {
          [ch.v[2] + 12, ch.v[1] + 12, ch.v[0] + 12].forEach((m, i) => this._bell(st.bell, t + i * spb * 0.5 + hz(), m, 0.4 - i * 0.06));
        }
      } else {
        playMel(this, S, HERO, bar, bi, t, (tt, m, d) => {
          this._brass(st.brass, tt, m, d * 0.95, 0.72, { atk: 0.09, rel: 0.45 });
          this._strings(st.str, tt, m + 12, d, 0.38, { atk: 0.15, rel: 0.6, n: 4 });
        });
        this._harp(st.harp, t + hz(), ch.v[bi % 3] + 12, 0.3);
        if (bi === 0 || bi === 2) this._taiko(st.perc, t, bi === 0 ? 0.55 : 0.35, { f: 56, dec: 1.2 });
        if (bi === 3) this._taiko(st.perc, t + spb / 2, 0.25, { f: 68, dec: 0.6 });
        if (bar % 8 === 7 && bi === 3) for (let k = 0; k < 4; k++) this._snare(st.perc, t + (k * spb) / 4, 0.15 + k * 0.08);
      }
    },
  },

  /* ---------- Bauphase: ruhig, geheimnisvoll, Harfe + Flächen ---------- */
  build: {
    bpm: 80,
    setup(S) {
      S.prog = progression(['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'Asus4', 'A']);
      S.st = {
        pad: this._strip(S, 0.85, 0, 0.6),
        low: this._strip(S, 0.7, -0.2, 0.4),
        choir: this._strip(S, 0.55, 0.15, 0.75),
        harp: this._strip(S, 0.85, 0.2, 0.5),
        bell: this._strip(S, 0.45, -0.3, 0.75),
        bass: this._strip(S, 0.8, 0, 0.04),
        perc: this._strip(S, 0.7, 0, 0.45),
      };
    },
    beat(S, b, t) {
      const spb = S.spb;
      const bar = Math.floor(b / 4);
      const bi = b % 4;
      const ch = S.prog[bar % 8];
      const st = S.st;
      if (bi === 0 && ch.start) {
        const L = ch.len * 4 * spb + 0.3;
        for (const m of ch.v) this._strings(st.pad, t + hz(), m, L, 0.45, { atk: 1.8, rel: 2.0, bright: 0.55 });
        this._strings(st.low, t, ch.bass + 12, L, 0.5, { atk: 1.2, rel: 1.6, bright: 0.5 });
        for (const m of ch.v) this._choir(st.choir, t + 0.3 + hz(), m - 12 + (m < 62 ? 12 : 0), L, 0.38, { atk: 2.0, rel: 2.2, vowel: 'o' });
        this._bass(st.bass, t, ch.bass, L, 0.5, { atk: 0.6, rel: 1.2 });
      }
      const b0 = ch.bass + 12;
      const up = [b0, b0 + ch.fifth, ch.v[0], ch.v[1], ch.v[2], ch.v[0] + 12, ch.v[1] + 12, ch.v[2] + 12];
      const arp = bar % 2 === 0 ? up : [...up].reverse();
      for (let k = 0; k < 2; k++) {
        const i = bi * 2 + k;
        this._harp(st.harp, t + (k * spb) / 2 + hz(), arp[i], (i % 4 === 0 ? 0.42 : 0.3) + rnd(-0.04, 0.04), { bright: 0.8 });
      }
      if (bar % 4 === 1 && bi === 0) {
        [[0, 'D6'], [0.5, 'E6'], [1, 'F6'], [2, 'A5']].forEach(([p, n]) => this._bell(st.bell, t + p * spb + hz(), N(n), 0.32));
      }
      if (bar % 8 === 5 && bi === 1) {
        [[0, 'A5'], [0.5, 'Bb5'], [1, 'A5'], [2.5, 'E5']].forEach(([p, n]) => this._bell(st.bell, t + p * spb + hz(), N(n), 0.28));
      }
      if (bar % 2 === 0 && bi === 0) this._taiko(st.perc, t, 0.32, { f: 52, dec: 1.5 });
      if (bar % 4 === 3 && bi === 3) {
        this._taiko(st.perc, t, 0.16, { f: 64, dec: 0.6 });
        this._taiko(st.perc, t + spb / 2, 0.22, { f: 60, dec: 0.7 });
      }
    },
  },

  /* ---------- Kampf: treibende Taikos, Staccato-Streicher, Blechbläser ---------- */
  battle: {
    bpm: 126,
    setup(S) {
      S.prog = progression(['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A']);
      S.st = {
        pad: this._strip(S, 0.6, 0, 0.45),
        ost: this._strip(S, 0.9, -0.12, 0.25),
        hi: this._strip(S, 0.5, 0.25, 0.4),
        brass: this._strip(S, 0.8, 0.12, 0.4),
        mel: this._strip(S, 0.75, -0.18, 0.45),
        choir: this._strip(S, 0.5, 0, 0.6),
        bass: this._strip(S, 0.75, 0, 0.03),
        taiko: this._strip(S, 0.9, 0, 0.3),
        snare: this._strip(S, 0.45, 0.15, 0.4),
        cym: this._strip(S, 0.45, -0.05, 0.4),
        timp: this._strip(S, 0.6, 0, 0.35),
      };
    },
    beat(S, b, t) {
      const spb = S.spb;
      const s16 = spb / 4;
      const bar = Math.floor(b / 4);
      const bi = b % 4;
      const ch = S.prog[bar % 8];
      const I = S.I;
      const st = S.st;
      const root = ch.bass + 12;
      const ost = [0, 0, 12, 0, ch.fifth, 0, 12, ch.fifth];
      if (bi === 0) {
        for (const m of ch.v) this._strings(st.pad, t + hz(), m, 4 * spb, 0.32 + 0.22 * I, { atk: 0.35, rel: 0.6, bright: 0.75 });
        if (I > 0.15) this._timp(st.timp, t, timpNote(ch), 0.45 + 0.35 * I, { dec: 1.6 });
        if (I > 0.8) for (const m of ch.v) this._choir(st.choir, t + hz(), m, 4 * spb, 0.5, { atk: 0.4, rel: 0.8 });
        if (I > 0.5 && bar % 4 === 0) this._cymbal(st.cym, t, 0.35 + 0.25 * I, { dec: 2.4 });
        if (I > 0.6 && bar % 8 === 7) this._cymbal(st.cym, t, 0.4, { swell: 4 * spb });
      }
      for (let k = 0; k < 4; k++) {
        const s = bi * 4 + k;
        const tt = t + k * s16 + hz() * 0.6;
        const tv = 0.55 + 0.45 * I;
        if (T_LOW[s]) this._taiko(st.taiko, tt, (s % 8 === 0 ? 1 : 0.72) * tv, { f: 58, dec: 0.85 });
        if (I > 0.3 && T_MID[s]) this._taiko(st.taiko, tt, 0.62 * tv, { f: 92, dec: 0.5 });
        if (I > 0.65 && T_HI[s]) this._taiko(st.taiko, tt, 0.22 + 0.35 * (I - 0.65), { f: 150, dec: 0.28 });
        if (k % 2 === 0 || (I > 0.5 && k === 3)) {
          const e = (s / 2) | 0;
          this._strings(st.ost, tt, root + ost[e], 0, (k === 0 ? 0.62 : 0.48) + rnd(-0.05, 0.05), { stac: true, dec: 0.17, bright: 0.9, n: 4 });
        }
        if (k % 2 === 0) this._bass(st.bass, tt, ch.bass, s16 * 1.6, k === 0 ? 0.62 : 0.45, { atk: 0.008, rel: 0.08 });
        if (I > 0.4) {
          const hiN = [ch.v[0], ch.v[1], ch.v[2], ch.v[1]][k] + 12;
          this._strings(st.hi, tt, hiN, 0, 0.26 + (k === 0 ? 0.1 : 0) + 0.1 * I, { stac: true, dec: 0.12, n: 3, bright: 0.8 });
        }
        if (I > 0.55 && (s === 4 || s === 12)) this._snare(st.snare, tt, 0.45);
        if (I > 0.45 && bar % 4 === 3 && bi === 3) this._snare(st.snare, tt, 0.18 + k * 0.1);
        const stab = I > 0.3 && (s === 0 || (bar % 2 === 0 && s === 10) || (bar % 4 === 3 && s === 14));
        if (stab) {
          const v = 0.5 + 0.35 * I;
          this._brass(st.brass, tt, root, spb * 0.4, v, { atk: 0.025, rel: 0.18, bright: 1.1 });
          for (const m of ch.v) this._brass(st.brass, tt + hz() * 0.3, m - 12, spb * 0.4, v * 0.8, { atk: 0.03, rel: 0.18, bright: 1.1 });
        }
      }
      if (I > 0.7) {
        playMel(this, S, BATTLE_MEL, bar, bi, t, (tt, m, d) => this._brass(st.mel, tt, m, d * 0.92, 0.66, { atk: 0.06, rel: 0.3 }));
      }
    },
  },

  /* ---------- Boss: dunkler, schwerer, schneller ---------- */
  boss: {
    bpm: 138,
    setup(S) {
      S.prog = progression(['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'Bb', 'A'], 55, 72);
      S.st = {
        pad: this._strip(S, 0.6, 0, 0.45),
        ost: this._strip(S, 0.85, -0.12, 0.22),
        hi: this._strip(S, 0.45, 0.25, 0.4),
        brass: this._strip(S, 0.95, 0.08, 0.4),
        choir: this._strip(S, 0.6, 0, 0.6),
        bass: this._strip(S, 0.8, 0, 0.03),
        taiko: this._strip(S, 0.9, 0, 0.3),
        snare: this._strip(S, 0.45, 0.15, 0.4),
        cym: this._strip(S, 0.45, -0.05, 0.4),
        timp: this._strip(S, 0.7, 0, 0.35),
      };
    },
    beat(S, b, t) {
      const spb = S.spb;
      const s16 = spb / 4;
      const bar = Math.floor(b / 4);
      const bi = b % 4;
      const ch = S.prog[bar % 8];
      const I = Math.max(0.6, S.I);
      const st = S.st;
      const root = ch.bass + 12;
      if (bi === 0) {
        if (ch.start) {
          const L = ch.len * 4 * spb;
          for (const m of ch.v) this._strings(st.pad, t + hz(), m, L, 0.45, { atk: 0.5, rel: 0.8, bright: 0.55 });
          for (const m of ch.v) this._choir(st.choir, t + hz(), m - 12, L, 0.55, { atk: 0.6, rel: 1.0, vowel: 'o' });
          this._bass(st.bass, t, ch.bass, L, 0.55, { atk: 0.05, rel: 0.3 });
        }
        this._timp(st.timp, t, timpNote(ch), 0.85, { dec: 1.8 });
        if (bar % 4 === 0) this._cymbal(st.cym, t, 0.55, { dec: 2.6 });
        if (bar % 8 === 7) this._cymbal(st.cym, t, 0.45, { swell: 4 * spb });
      }
      if (bi === 2) this._timp(st.timp, t, timpNote(ch) - 5, 0.6, { dec: 1.2 });
      for (let k = 0; k < 4; k++) {
        const s = bi * 4 + k;
        const tt = t + k * s16 + hz() * 0.5;
        if (B_LOW[s]) this._taiko(st.taiko, tt, s % 8 === 0 ? 1 : 0.78, { f: 52, dec: 0.95 });
        if (B_MID[s]) this._taiko(st.taiko, tt, 0.62, { f: 86, dec: 0.5 });
        if (I > 0.7) this._taiko(st.taiko, tt, (k === 0 ? 0.32 : 0.18) * I, { f: 140, dec: 0.25 });
        if (k !== 1) {
          const m = root + (bi === 3 && k === 3 ? 12 : 0);
          this._strings(st.ost, tt, m, 0, (k === 0 ? 0.62 : 0.46) + rnd(-0.05, 0.05), { stac: true, dec: 0.15, bright: 0.75, n: 4 });
        }
        const tr = ch.v[2] + 12 + (k % 2);
        this._strings(st.hi, tt, tr, 0, 0.22 + (k === 0 ? 0.08 : 0), { stac: true, dec: 0.1, n: 3, bright: 0.7 });
        if (I > 0.75 && (s === 4 || s === 12)) this._snare(st.snare, tt, 0.42);
        if (bar % 2 === 1 && bi === 3) this._snare(st.snare, tt, 0.2 + k * 0.09);
      }
      playMel(this, S, BOSS_MEL, bar, bi, t, (tt, m, d) => {
        this._brass(st.brass, tt, m, d * 0.92, 0.75, { atk: 0.05, rel: 0.3, bright: 0.75 });
        if (this.q === 'high') this._brass(st.brass, tt, m - 12, d * 0.92, 0.55, { atk: 0.06, rel: 0.3, bright: 0.6 });
      });
    },
  },

  /* ---------- Sieg (einmalig, ~7 s) ---------- */
  victory: {
    bpm: 120,
    once: true,
    length: 7.5,
    setup(S) {
      S.st = {
        brass: this._strip(S, 0.9, -0.1, 0.45),
        str: this._strip(S, 0.75, 0.05, 0.55),
        choir: this._strip(S, 0.55, 0.1, 0.7),
        bell: this._strip(S, 0.45, 0.3, 0.7),
        harp: this._strip(S, 0.7, 0.25, 0.5),
        bass: this._strip(S, 0.75, 0, 0.04),
        perc: this._strip(S, 0.85, 0, 0.35),
        cym: this._strip(S, 0.5, 0, 0.5),
      };
    },
    play(S, t) {
      const st = S.st;
      for (let i = 0; i < 14; i++) this._timp(st.perc, t + i * 0.064, N('A2'), 0.12 + i * 0.035, { dec: 0.5 });
      this._cymbal(st.cym, t, 0.4, { swell: 0.9 });
      const T = t + 0.9;
      this._cymbal(st.cym, T, 0.6, { dec: 3.5 });
      this._timp(st.perc, T, N('D2'), 1, { dec: 2.4 });
      this._taiko(st.perc, T, 0.8, { f: 54, dec: 1.4 });
      const fan = [[0, 'D4', 0.16], [0.18, 'D4', 0.16], [0.36, 'D4', 0.16], [0.55, 'A4', 0.45], [1.05, 'F#4', 0.28], [1.35, 'A4', 0.28], [1.65, 'D5', 3.2]];
      for (const [p, n, d] of fan) this._brass(st.brass, T + p, N(n), d, 0.8, { atk: 0.03, rel: p > 1.6 ? 1.2 : 0.15, bright: 1.15 });
      for (const n of ['A4', 'F#4', 'D4', 'A3']) this._brass(st.brass, T + 1.65 + hz(), N(n), 3.2, 0.6, { atk: 0.08, rel: 1.2 });
      for (const n of ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']) this._strings(st.str, T + hz(), N(n), 4.8, 0.55, { atk: 0.6, rel: 1.6 });
      for (const n of ['A4', 'D5', 'F#5']) this._choir(st.choir, T + 1.5 + hz(), N(n), 3.3, 0.55, { atk: 0.5, rel: 1.8 });
      this._bass(st.bass, T, N('D2'), 4.8, 0.6, { atk: 0.05, rel: 1.2 });
      ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6', 'E6', 'F#6', 'A6'].forEach((n, i) => this._harp(st.harp, T + i * 0.045, N(n), 0.3 + i * 0.02, { dec: 1.4 }));
      ['D6', 'F#6', 'A6', 'D7'].forEach((n, i) => this._bell(st.bell, T + 1.7 + i * 0.13, N(n), 0.4));
      this._timp(st.perc, T + 1.65, N('D2'), 0.8, { dec: 2 });
      this._timp(st.perc, T + 4.5, N('D2'), 0.55, { dec: 2 });
      this._timp(st.perc, T + 4.5, N('A2'), 0.4, { dec: 2 });
    },
  },

  /* ---------- Niederlage (einmalig, ~7 s) ---------- */
  defeat: {
    bpm: 60,
    once: true,
    length: 7.5,
    setup(S) {
      S.st = {
        brass: this._strip(S, 0.8, -0.15, 0.5),
        str: this._strip(S, 0.85, 0.05, 0.6),
        choir: this._strip(S, 0.5, 0.1, 0.75),
        bell: this._strip(S, 0.4, 0.25, 0.75),
        bass: this._strip(S, 0.75, 0, 0.04),
        perc: this._strip(S, 0.8, 0, 0.4),
      };
    },
    play(S, t) {
      const st = S.st;
      const seg = [
        [0, ['D2', 'A2', 'D3', 'F3', 'A3'], 2.4, 'D2'],
        [2.4, ['Bb1', 'F2', 'D3', 'F3', 'Bb3'], 1.8, 'Bb1'],
        [4.2, ['D2', 'A2', 'D3', 'F3', 'A3'], 2.6, 'D2'],
      ];
      seg.forEach(([p, notes, d, b], i) => {
        for (const n of notes) this._strings(st.str, t + p + hz(), N(n) + 12 * (N(n) < 40 ? 1 : 0), d, i === 2 ? 0.42 : 0.5, { atk: i === 0 ? 0.8 : 0.5, rel: i === 2 ? 2.4 : 0.9, bright: 0.6 });
        this._brass(st.brass, t + p, N(notes[2]) - 12, d, 0.5, { atk: 0.4, rel: 0.8, bright: 0.6 });
        this._bass(st.bass, t + p, N(b), d, 0.55, { atk: 0.2, rel: i === 2 ? 2 : 0.6 });
        this._timp(st.perc, t + p, N(b) + 12, i === 1 ? 0.7 : 0.55, { dec: 2.2 });
      });
      const lament = [[0.4, 'A4', 0.6], [1.0, 'G4', 0.4], [1.4, 'F4', 0.6], [2.0, 'E4', 0.5], [2.5, 'D4', 0.8], [3.3, 'C#4', 0.9]];
      for (const [p, n, d] of lament) this._brass(st.brass, t + p, N(n), d, 0.62, { atk: 0.1, rel: 0.4, bright: 0.8 });
      this._strings(st.str, t + 4.2, N('D4'), 2.4, 0.4, { atk: 0.4, rel: 2.4, bright: 0.6 });
      for (const n of ['D4', 'F4', 'A4']) this._choir(st.choir, t + 4.2 + hz(), N(n), 2.4, 0.42, { atk: 0.8, rel: 2.2, vowel: 'o' });
      this._bell(st.bell, t + 4.35, N('D5'), 0.35, { ratio: 3.5, dec: 3 });
      this._bell(st.bell, t + 5.0, N('A4'), 0.25, { ratio: 3.5, dec: 3 });
    },
  },
};

/* ============================== Soundeffekte ============================== */
// Jede Funktion: (v, out, t, p) → { d: Dauer, r: Hall-Anteil }; `this` = Engine.

const SFX = {
  build(v, o, t, p) {
    this._tone(v, o, 'sine', t, 115 * p, 40 * p, 0.14, 0.004, 0.5, 0.9);
    this._nz(v, o, t, { type: 'lowpass', f: 700, f1: 140, q: 0.7, atk: 0.003, dec: 0.28, peak: 0.6 });
    this._nz(v, o, t, { type: 'bandpass', f: 1900 * p, f1: 800, q: 1.2, atk: 0.002, dec: 0.08, peak: 0.35 });
    [74, 78, 81, 86, 90].forEach((m, i) => {
      const pn = this._pan(v, o, i % 2 ? 0.45 : -0.45);
      this._fm(v, pn, t + 0.07 + i * 0.045, mtof(m) * p, { ratio: 4, index: 0.8, mdec: 0.2, dec: 0.9, peak: 0.1 });
    });
    this._nz(v, o, t + 0.05, { type: 'highpass', f: 6000, f1: 10000, q: 0.5, atk: 0.15, dec: 0.5, peak: 0.07 });
    return { d: 1.4, r: 0.35 };
  },
  upgrade(v, o, t, p) {
    ['D5', 'F#5', 'A5', 'D6'].forEach((n, i) => {
      const f = mtof(N(n)) * p;
      const tt = t + i * 0.075;
      const last = i === 3;
      this._pluckSaw(v, o, tt, f, last ? 0.9 : 0.4, 0.2, 6000);
      this._fm(v, o, tt, f * 2, { ratio: 3.01, index: 0.5, mdec: 0.15, dec: last ? 1.1 : 0.4, peak: 0.07 });
    });
    this._nz(v, o, t + 0.1, { type: 'highpass', f: 3000, f1: 11000, q: 0.6, atk: 0.35, dec: 0.4, peak: 0.08 });
    this._fm(v, o, t + 0.3, mtof(N('A6')) * p, { ratio: 2, index: 0.3, dec: 1.2, peak: 0.06 });
    return { d: 1.5, r: 0.35 };
  },
  sell(v, o, t, p) {
    for (let i = 0; i < 5; i++) {
      const pn = this._pan(v, o, rnd(-0.4, 0.4));
      this._coin(v, pn, t + i * 0.055 + rnd(0, 0.03), rnd(2200, 3100) * p, 0.17 - i * 0.015);
    }
    this._nz(v, o, t, { type: 'lowpass', f: 500, q: 0.7, atk: 0.003, dec: 0.1, peak: 0.25 });
    return { d: 0.8, r: 0.18 };
  },
  gold(v, o, t, p) {
    this._coin(v, o, t, 2650 * p, 0.085, 0.6);
    return { d: 0.3, r: 0.1 };
  },
  sword(v, o, t, p) {
    this._nz(v, o, t, { type: 'bandpass', f: 4200 * p, f1: 1400 * p, q: 1.5, atk: 0.04, dec: 0.08, peak: 0.22 });
    this._nz(v, o, t + 0.035, { type: 'highpass', f: 2500, q: 0.7, atk: 0.001, dec: 0.05, peak: 0.45 });
    this._metal(v, o, t + 0.035, 1150 * p, 0.35, 0.11, [1, 2.32, 3.86, 5.6]);
    this._tone(v, o, 'sine', t + 0.035, 190 * p, 80 * p, 0.06, 0.002, 0.09, 0.32);
    return { d: 0.45, r: 0.12 };
  },
  blunt(v, o, t, p) {
    this._tone(v, o, 'sine', t, 150 * p, 45 * p, 0.12, 0.002, 0.32, 0.9);
    this._nz(v, o, t, { type: 'lowpass', f: 1900, f1: 350, q: 0.8, atk: 0.002, dec: 0.18, peak: 0.55 });
    this._nz(v, o, t, { type: 'bandpass', f: 750 * p, q: 2, atk: 0.001, dec: 0.06, peak: 0.45 });
    this._nz(v, o, t + 0.01, { type: 'bandpass', f: 2200, q: 0.8, atk: 0.002, dec: 0.22, peak: 0.3, buf: this._crackle });
    return { d: 0.45, r: 0.12 };
  },
  arrow(v, o, t, p) {
    this._tone(v, o, 'triangle', t, 225 * p, 205 * p, 0.15, 0.002, 0.18, 0.28);
    this._pluckSaw(v, o, t, 225 * p, 0.12, 0.14, 1100);
    this._nz(v, o, t + 0.01, { type: 'bandpass', f: 2600 * p, f1: 700 * p, q: 2, atk: 0.06, dec: 0.22, peak: 0.26 });
    this._nz(v, o, t, { type: 'highpass', f: 5000, q: 0.7, atk: 0.002, dec: 0.1, peak: 0.05 });
    return { d: 0.35, r: 0.1 };
  },
  bolt(v, o, t, p) {
    this._nz(v, o, t, { type: 'highpass', f: 3000, q: 0.7, atk: 0.001, dec: 0.014, peak: 0.6 });
    this._tone(v, o, 'square', t, 1800 * p, 1500 * p, 0.01, 0.001, 0.012, 0.08);
    this._tone(v, o, 'triangle', t + 0.004, 340 * p, 300 * p, 0.08, 0.002, 0.1, 0.25);
    this._tone(v, o, 'sine', t, 170 * p, 90 * p, 0.05, 0.001, 0.08, 0.4);
    this._nz(v, o, t + 0.01, { type: 'bandpass', f: 3200 * p, f1: 1200 * p, q: 2, atk: 0.03, dec: 0.12, peak: 0.22 });
    return { d: 0.25, r: 0.1 };
  },
  magic(v, o, t, p) {
    this._fm(v, o, t, 520 * p, { f1: 1560 * p, glide: 0.18, ratio: 1.5, index: 0.8, mdec: 0.3, atk: 0.005, dec: 0.38, peak: 0.2, type: 'sine' });
    const l = this._pan(v, o, -0.5);
    const r = this._pan(v, o, 0.5);
    this._tone(v, l, 'sine', t + 0.03, 1046 * p, 1046 * p, 0, 0.02, 0.5, 0.07);
    this._tone(v, r, 'sine', t + 0.03, 1053 * p, 1053 * p, 0, 0.02, 0.5, 0.07);
    this._tone(v, o, 'sine', t + 0.06, 1568 * p, 1568 * p, 0, 0.02, 0.4, 0.05);
    this._nz(v, o, t, { type: 'bandpass', f: 3000 * p, f1: 6500 * p, q: 4, atk: 0.01, dec: 0.22, peak: 0.16 });
    this._tone(v, o, 'sine', t, 240 * p, 110 * p, 0.15, 0.003, 0.2, 0.2);
    return { d: 0.6, r: 0.3 };
  },
  fire(v, o, t, p) {
    const f = this._nz(v, o, t, { type: 'lowpass', f: 350, f1: 2600 * p, glide: 0.15, q: 1, atk: 0.14, dec: 0.45, peak: 0.45 });
    f.frequency.exponentialRampToValueAtTime(500, t + 0.6);
    this._nz(v, o, t + 0.12, { type: 'bandpass', f: 900 * p, q: 0.7, atk: 0.005, dec: 0.35, peak: 0.5 });
    this._nz(v, o, t + 0.1, { type: 'highpass', f: 1500, q: 0.7, atk: 0.01, dec: 0.5, peak: 0.35, buf: this._crackle });
    this._tone(v, o, 'sine', t + 0.11, 95 * p, 48 * p, 0.2, 0.004, 0.3, 0.55);
    return { d: 0.75, r: 0.22 };
  },
  lightning(v, o, t, p) {
    this._nz(v, o, t, { type: 'highpass', f: 1500, q: 0.6, atk: 0.001, dec: 0.035, peak: 0.75 });
    // elektrisches Brummen mit flackernder Hüllkurve
    const c = this.ctx;
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    const bp = v.n(c.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 1800 * p;
    bp.Q.value = 1;
    const g = v.n(c.createGain());
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 18; i++) {
      const tt = t + i * 0.018;
      saw.frequency.setValueAtTime(rnd(60, 160) * p, tt);
      g.gain.setValueAtTime(Math.random() < 0.65 ? 0.22 * (1 - i / 20) : 0.02, tt);
    }
    g.gain.setTargetAtTime(0, t + 0.33, 0.02);
    saw.connect(bp);
    bp.connect(g);
    g.connect(o);
    v.play(saw, t, t + 0.45);
    this._nz(v, o, t + 0.005, { type: 'highpass', f: 3000, q: 0.7, atk: 0.002, dec: 0.28, peak: 0.4, buf: this._crackle });
    this._nz(v, o, t + 0.01, { type: 'lowpass', f: 180, q: 0.7, atk: 0.03, dec: 1.1, peak: 0.55 });
    return { d: 1.2, r: 0.35 };
  },
  heal(v, o, t, p) {
    ['D6', 'A6', 'F#6'].forEach((n, i) => {
      const pn = this._pan(v, o, (i - 1) * 0.4);
      this._fm(v, pn, t + i * 0.08, mtof(N(n)) * p, { ratio: 1, index: 0.35, mdec: 0.3, atk: 0.012, dec: 1.3, peak: 0.12 });
    });
    this._nz(v, o, t, { type: 'bandpass', f: 5000, f1: 8000, q: 1, atk: 0.25, dec: 0.5, peak: 0.03 });
    return { d: 1.6, r: 0.5 };
  },
  explosion(v, o, t, p) {
    this._tone(v, o, 'sine', t, 95 * p, 28 * p, 0.5, 0.004, 1.1, 1.0);
    this._nz(v, o, t, { type: 'lowpass', f: 3500, f1: 140, glide: 0.8, q: 0.8, atk: 0.004, dec: 1.4, peak: 0.85 });
    this._nz(v, o, t, { type: 'highpass', f: 1000, q: 0.7, atk: 0.001, dec: 0.06, peak: 0.45 });
    this._nz(v, o, t + 0.05, { type: 'lowpass', f: 3000, q: 0.7, atk: 0.05, dec: 1.1, peak: 0.25, buf: this._crackle });
    this._tone(v, o, 'sine', t + 0.02, 46 * p, 42 * p, 1, 0.05, 1.2, 0.35);
    return { d: 1.7, r: 0.4 };
  },
  death_creep(v, o, t, p) {
    const c = this.ctx;
    const f0 = 680 * p;
    const sq = c.createOscillator();
    sq.type = 'sawtooth';
    sq.frequency.setValueAtTime(f0, t);
    sq.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + 0.06);
    sq.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.28);
    const lfo = c.createOscillator();
    lfo.frequency.value = rnd(26, 36);
    const lg = v.n(c.createGain());
    lg.gain.value = 70;
    lfo.connect(lg);
    lg.connect(sq.detune);
    const bp = v.n(c.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 1500 * p;
    bp.Q.value = 1.6;
    const g = v.n(c.createGain());
    perc(g.gain, t, 0.22, 0.01, 0.27);
    sq.connect(bp);
    bp.connect(g);
    g.connect(o);
    v.play(sq, t, t + 0.3);
    v.play(lfo, t, t + 0.3);
    this._nz(v, o, t, { type: 'bandpass', f: 1200, q: 1, atk: 0.001, dec: 0.07, peak: 0.4 });
    this._nz(v, o, t, { type: 'bandpass', f: 2500, q: 0.8, atk: 0.002, dec: 0.12, peak: 0.25, buf: this._crackle });
    this._tone(v, o, 'sine', t, 150 * p, 70 * p, 0.08, 0.002, 0.1, 0.25);
    return { d: 0.35, r: 0.1 };
  },
  death_unit(v, o, t, p) {
    this._nz(v, o, t, { type: 'bandpass', f: 1500, f1: 600, q: 0.9, atk: 0.03, dec: 0.25, peak: 0.16 });
    this._tone(v, o, 'sine', t + 0.08, 110 * p, 55 * p, 0.15, 0.003, 0.3, 0.45);
    this._nz(v, o, t + 0.08, { type: 'lowpass', f: 600, q: 0.7, atk: 0.003, dec: 0.15, peak: 0.25 });
    this._metal(v, o, t + 0.09, 1600 * p, 0.22, 0.035, [1, 2.4, 3.9]);
    return { d: 0.5, r: 0.15 };
  },
  leak(v, o, t, p) {
    [880, 698, 880, 698].forEach((f, i) => {
      const tt = t + i * 0.19;
      for (const det of [-7, 7]) {
        const c = this.ctx;
        const s = c.createOscillator();
        s.type = 'sawtooth';
        s.frequency.value = f * p;
        s.detune.value = det;
        const lp = v.n(c.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        const g = v.n(c.createGain());
        g.gain.value = 0;
        g.gain.value = 0;
      g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.09, tt + 0.012);
        g.gain.setValueAtTime(0.09, tt + 0.14);
        g.gain.linearRampToValueAtTime(0, tt + 0.165);
        s.connect(lp);
        lp.connect(g);
        g.connect(o);
        v.play(s, tt, tt + 0.17);
      }
    });
    this._tone(v, o, 'sine', t, 110, 110, 0, 0.01, 0.7, 0.25);
    return { d: 0.85, r: 0.15 };
  },
  king_hit(v, o, t, p) {
    this._tone(v, o, 'sine', t, 78 * p, 32 * p, 0.5, 0.003, 0.95, 1.0);
    this._nz(v, o, t, { type: 'lowpass', f: 1600, f1: 120, glide: 0.5, q: 0.8, atk: 0.003, dec: 0.8, peak: 0.75 });
    this._metal(v, o, t, 182 * p, 1.2, 0.15, [1, 2.1, 3.2, 4.7, 6.3]);
    this._nz(v, o, t, { type: 'highpass', f: 1200, q: 0.7, atk: 0.001, dec: 0.045, peak: 0.4 });
    this._nz(v, o, t + 0.02, { type: 'lowpass', f: 120, q: 0.7, atk: 0.05, dec: 1.4, peak: 0.4 });
    return { d: 1.8, r: 0.42 };
  },
  wave_start(v, o, t, p) {
    const horn = { v, atk: 0.28, rel: 0.6, scoop: 120, fall: 180, bright: 0.85, vib: 9 };
    this._brass(o, t, N('D3'), 1.5, 0.95, horn);
    this._brass(o, t, N('D2'), 1.5, 0.7, { ...horn, bright: 0.7 });
    this._brass(o, t + 0.02, N('A2'), 1.5, 0.45, horn);
    this._taiko(o, t, 1, { v, f: 54, dec: 1.4 });
    this._taiko(o, t + 0.42, 0.6, { v, f: 62, dec: 0.8 });
    this._taiko(o, t + 0.63, 0.95, { v, f: 54, dec: 1.3 });
    this._nz(v, o, t, { type: 'lowpass', f: 110, q: 0.7, atk: 0.4, dec: 1.4, peak: 0.3 });
    return { d: 2.6, r: 0.4 };
  },
  wave_clear(v, o, t, p) {
    const fan = [['D4', 0, 0.1], ['F#4', 0.11, 0.1], ['A4', 0.22, 0.1], ['D5', 0.33, 0.75]];
    for (const [n, dt, d] of fan) this._brass(o, t + dt, N(n), d, 0.7, { v, atk: 0.02, rel: dt > 0.3 ? 0.5 : 0.08, bright: 1.2 });
    for (const n of ['A4', 'F#4', 'D4']) this._brass(o, t + 0.33, N(n), 0.75, 0.5, { v, atk: 0.03, rel: 0.5 });
    this._fm(v, o, t + 0.34, mtof(N('D6')), { ratio: 3.5, index: 0.6, mdec: 0.3, dec: 1, peak: 0.07 });
    this._fm(v, o, t + 0.42, mtof(N('A6')), { ratio: 3.5, index: 0.6, mdec: 0.3, dec: 1, peak: 0.05 });
    this._cymbal(o, t + 0.33, 0.35, { v, dec: 1.4 });
    this._timp(o, t + 0.33, N('D2'), 0.65, { v, dec: 1.2 });
    return { d: 1.8, r: 0.35 };
  },
  boss(v, o, t, p) {
    const c = this.ctx;
    // Brüllen: Rauschen durch Formanten + knurrende Sägezahn-Grundschwingung (AM)
    const am = c.createOscillator();
    am.frequency.value = 27;
    const amG = v.n(c.createGain());
    amG.gain.value = 0.35;
    am.connect(amG);
    const roar = v.n(c.createGain());
    roar.gain.value = 0;
    roar.gain.setValueAtTime(0.0001, t);
    roar.gain.exponentialRampToValueAtTime(0.55, t + 0.3);
    roar.gain.setTargetAtTime(0.4, t + 0.3, 0.4);
    roar.gain.setTargetAtTime(0.0001, t + 1.4, 0.25);
    amG.connect(roar.gain);
    const ns = this._noiseSrc(v, t, t + 2.6, 0.8);
    for (const [f, q, g0] of [[320, 3, 1], [880, 4, 0.6], [2400, 5, 0.2]]) {
      const bp = v.n(c.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f * 0.8, t);
      bp.frequency.linearRampToValueAtTime(f, t + 0.4);
      bp.frequency.linearRampToValueAtTime(f * 0.7, t + 1.8);
      bp.Q.value = q;
      const g = v.n(c.createGain());
      g.gain.value = g0 * 1.6;
      ns.connect(bp);
      bp.connect(g);
      g.connect(roar);
    }
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(62, t);
    saw.frequency.exponentialRampToValueAtTime(44, t + 1.8);
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    const sg = v.n(c.createGain());
    sg.gain.value = 0.35;
    saw.connect(lp);
    lp.connect(sg);
    sg.connect(roar);
    roar.connect(o);
    v.play(am, t, t + 2.6);
    v.play(saw, t, t + 2.6);
    // tiefe Blechbläser-Cluster
    for (const [n, vel] of [['D2', 0.8], ['A1', 0.6], ['Eb2', 0.45], ['D3', 0.4]]) {
      this._brass(o, t + 0.25, N(n), 1.9, vel, { v, atk: 0.4, rel: 0.8, bright: 0.65 });
    }
    this._taiko(o, t, 1, { v, f: 50, dec: 1.6 });
    this._timp(o, t + 0.25, N('D2'), 0.9, { v, dec: 2.5 });
    this._tone(v, o, 'sine', t, 37, 34, 2, 0.4, 2.2, 0.45);
    return { d: 3.2, r: 0.45 };
  },
  send(v, o, t, p) {
    const c = this.ctx;
    const pn = v.n(c.createStereoPanner());
    pn.pan.setValueAtTime(-0.6, t);
    pn.pan.linearRampToValueAtTime(0.6, t + 0.7);
    pn.connect(o);
    this._nz(v, pn, t, { type: 'bandpass', f: 250 * p, f1: 3600 * p, glide: 0.6, q: 5, atk: 0.35, dec: 0.35, peak: 0.55 });
    this._nz(v, pn, t, { type: 'lowpass', f: 300, f1: 1500, glide: 0.5, q: 0.7, atk: 0.3, dec: 0.3, peak: 0.12 });
    this._fm(v, o, t, 180 * p, { f1: 720 * p, glide: 0.55, ratio: 2.01, index: 0.6, mdec: 0.5, atk: 0.2, dec: 0.4, peak: 0.1, type: 'sine' });
    this._fm(v, o, t + 0.55, mtof(N('A6')) * p, { ratio: 3.5, index: 0.4, mdec: 0.2, dec: 0.8, peak: 0.05 });
    return { d: 1.4, r: 0.4 };
  },
  income(v, o, t, p) {
    ['A5', 'D6', 'F#6'].forEach((n, i) => {
      const pn = this._pan(v, o, (i - 1) * 0.35);
      this._fm(v, pn, t + i * 0.085, mtof(N(n)) * p, { ratio: 3.5, index: 0.45, mdec: 0.25, dec: 0.9, peak: 0.1 });
      this._fm(v, pn, t + i * 0.085, mtof(N(n)) * p, { ratio: 1, index: 0.2, mdec: 0.2, dec: 0.6, peak: 0.06 });
    });
    this._coin(v, o, t + 0.02, 2900 * p, 0.07);
    this._coin(v, o, t + 0.1, 2500 * p, 0.06);
    return { d: 1.2, r: 0.3 };
  },
  worker(v, o, t, p) {
    const pent = [86, 88, 90, 93, 95, 98];
    for (let i = 0; i < 6; i++) {
      const pn = this._pan(v, o, i % 2 ? 0.4 : -0.4);
      this._fm(v, pn, t + i * 0.042 + rnd(0, 0.01), mtof(pent[(Math.random() * pent.length) | 0]) * p, { ratio: 4, index: 0.3, mdec: 0.1, dec: 0.28, peak: 0.055 });
    }
    this._nz(v, o, t, { type: 'highpass', f: 7000, q: 0.7, atk: 0.05, dec: 0.2, peak: 0.03 });
    return { d: 0.6, r: 0.35 };
  },
  victory(v, o, t, p) {
    const fan = [['D4', 0, 0.12], ['D4', 0.14, 0.12], ['A4', 0.28, 0.3], ['D5', 0.6, 1.2]];
    for (const [n, dt, d] of fan) this._brass(o, t + dt, N(n), d, 0.78, { v, atk: 0.025, rel: dt > 0.5 ? 0.8 : 0.1, bright: 1.15 });
    for (const n of ['A4', 'F#4', 'D4', 'D3']) this._brass(o, t + 0.6, N(n), 1.2, 0.5, { v, atk: 0.05, rel: 0.8 });
    ['D6', 'F#6', 'A6', 'D7'].forEach((n, i) => this._fm(v, o, t + 0.62 + i * 0.09, mtof(N(n)), { ratio: 3.5, index: 0.5, mdec: 0.3, dec: 1.2, peak: 0.06 }));
    this._timp(o, t + 0.6, N('D2'), 0.8, { v, dec: 1.6 });
    this._cymbal(o, t + 0.6, 0.4, { v, dec: 1.8 });
    return { d: 2.6, r: 0.4 };
  },
  defeat(v, o, t, p) {
    const line = [['A3', 0, 0.45], ['F3', 0.45, 0.45], ['D3', 0.9, 1.3]];
    for (const [n, dt, d] of line) {
      this._brass(o, t + dt, N(n), d, 0.7, { v, atk: 0.08, rel: dt > 0.5 ? 0.9 : 0.15, bright: 0.7 });
      this._brass(o, t + dt, N(n) - 12, d, 0.45, { v, atk: 0.1, rel: dt > 0.5 ? 0.9 : 0.15, bright: 0.6 });
    }
    this._timp(o, t + 0.9, N('D2'), 0.7, { v, dec: 2 });
    this._fm(v, o, t + 0.95, mtof(N('D4')), { ratio: 3.5, index: 0.8, mdec: 0.5, dec: 2.2, peak: 0.07 });
    return { d: 3, r: 0.45 };
  },
  countdown(v, o, t, p) {
    this._tone(v, o, 'sine', t, 1250 * p, 1180 * p, 0.04, 0.001, 0.05, 0.3);
    this._tone(v, o, 'triangle', t, 2500 * p, 2500 * p, 0, 0.001, 0.02, 0.07);
    this._nz(v, o, t, { type: 'bandpass', f: 3200, q: 3, atk: 0.001, dec: 0.015, peak: 0.25 });
    return { d: 0.12, r: 0.08 };
  },
};

const UI = {
  hover(v, o, t, p) {
    this._tone(v, o, 'sine', t, 1800 * p, 2050 * p, 0.03, 0.003, 0.04, 0.05);
    return { d: 0.06, r: 0.04 };
  },
  click(v, o, t, p) {
    this._tone(v, o, 'triangle', t, 950 * p, 820 * p, 0.04, 0.001, 0.06, 0.16);
    this._tone(v, o, 'sine', t, 460 * p, 420 * p, 0.04, 0.001, 0.05, 0.12);
    this._nz(v, o, t, { type: 'bandpass', f: 4200, q: 1.5, atk: 0.001, dec: 0.01, peak: 0.12 });
    return { d: 0.09, r: 0.05 };
  },
  open(v, o, t, p) {
    this._nz(v, o, t, { type: 'bandpass', f: 600, f1: 2600, q: 1.5, atk: 0.12, dec: 0.12, peak: 0.12 });
    this._fm(v, o, t + 0.04, mtof(N('A5')) * p, { ratio: 3.5, index: 0.35, mdec: 0.15, dec: 0.4, peak: 0.07 });
    this._fm(v, o, t + 0.1, mtof(N('D6')) * p, { ratio: 3.5, index: 0.35, mdec: 0.15, dec: 0.5, peak: 0.07 });
    return { d: 0.65, r: 0.15 };
  },
  close(v, o, t, p) {
    this._nz(v, o, t, { type: 'bandpass', f: 2600, f1: 600, q: 1.5, atk: 0.06, dec: 0.14, peak: 0.1 });
    this._fm(v, o, t + 0.02, mtof(N('D6')) * p, { ratio: 3.5, index: 0.3, mdec: 0.15, dec: 0.35, peak: 0.055 });
    this._fm(v, o, t + 0.08, mtof(N('A5')) * p, { ratio: 3.5, index: 0.3, mdec: 0.15, dec: 0.4, peak: 0.055 });
    return { d: 0.55, r: 0.12 };
  },
  error(v, o, t, p) {
    const c = this.ctx;
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.13;
      const lp = v.n(c.createBiquadFilter());
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = v.n(c.createGain());
      g.gain.value = 0;
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.12, tt + 0.01);
      g.gain.setValueAtTime(0.12, tt + 0.08);
      g.gain.linearRampToValueAtTime(0, tt + 0.1);
      lp.connect(g);
      g.connect(o);
      for (const f of [155, 164]) {
        const s = c.createOscillator();
        s.type = 'sawtooth';
        s.frequency.value = f * p;
        s.connect(lp);
        v.play(s, tt, tt + 0.11);
      }
    }
    return { d: 0.3, r: 0.05 };
  },
  confirm(v, o, t, p) {
    this._fm(v, o, t, mtof(N('D6')) * p, { ratio: 3.5, index: 0.4, mdec: 0.15, dec: 0.5, peak: 0.09 });
    this._fm(v, o, t + 0.08, mtof(N('A6')) * p, { ratio: 3.5, index: 0.4, mdec: 0.15, dec: 0.7, peak: 0.09 });
    this._tone(v, o, 'triangle', t, 1400 * p, 1300 * p, 0.02, 0.001, 0.03, 0.08);
    return { d: 0.8, r: 0.15 };
  },
};

/* ============================== Engine ============================== */

export class AudioEngine {
  /**
   * @param {{context?: BaseAudioContext, quality?: 'low'|'high'}} [opts]
   *   context: optional injizierter (z. B. Offline-)Kontext – dann wird der Scheduler
   *   nicht per Timer gestartet, sondern über _tick() getrieben.
   */
  constructor(opts = {}) {
    this.ctx = null;
    this.q = opts.quality === 'low' ? 'low' : 'high';
    this._vol = { master: 0.9, music: 0.75, sfx: 0.9, ui: 0.75 };
    this._muted = false;
    this._iTarget = 0.3;
    this._track = null;
    this._pending = undefined;
    this._fxState = new Map();
    this._live = 0;
    this._lookahead = 0.25;
    this._timer = null;
    this._offline = false;
    this._unlocking = null;
    if (opts.context) {
      this.ctx = opts.context;
      this._offline = typeof opts.context.startRendering === 'function';
      this._build();
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        // Hintergrund-Tabs drosseln Timer → größerer Vorlauf verhindert Aussetzer.
        this._lookahead = document.hidden ? 1.5 : 0.25;
        if (!document.hidden) this._tick();
      });
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
    if (!this._offline && !this._timer) this._timer = setInterval(() => this._tick(), 25);
    if (this._pending !== undefined) {
      const tr = this._pending;
      this._pending = undefined;
      this.playMusic(tr);
    }
    return this.ctx.state === 'running';
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

  playMusic(track) {
    const name = track && TRACKS[track] ? track : null;
    if (!this.ctx || !this._graph) {
      this._pending = name;
      return;
    }
    const cur = this._track;
    if (cur && cur.name === name && !cur.def.once) return;
    if (cur) this._stopTrack(cur, name && TRACKS[name].once ? 1.0 : 2.0);
    this._track = name ? this._startTrack(name, !!cur) : null;
    this._tick();
  }

  setIntensity(x) {
    this._iTarget = clamp(Number(x) || 0, 0, 1);
  }

  sfx(name, opts = {}) {
    return this._fx('sfx', name, opts || {});
  }

  ui(name) {
    return this._fx('ui', name, {});
  }

  setQuality(q) {
    const nq = q === 'low' ? 'low' : 'high';
    if (nq === this.q) return;
    this.q = nq;
    if (this._graph) this._buildReverbs();
  }

  /** Diagnose: aktive Stimmen, laufende Spur. */
  stats() {
    let fx = 0;
    for (const st of this._fxState.values()) fx += st.voices.length;
    return { liveVoices: this._live, fxVoices: fx, track: this._track ? this._track.name : null, quality: this.q, state: this.ctx ? this.ctx.state : 'none' };
  }

  /* ---------- Graph ---------- */

  _build() {
    const c = this.ctx;
    this._silent = c.createGain();
    this._silent.gain.value = 0;
    this._silent.connect(c.destination);

    this.musicIn = c.createGain();
    this.sfxIn = c.createGain();
    this.uiIn = c.createGain();
    this._bus = c.createGain();
    for (const g of [this.musicIn, this.sfxIn, this.uiIn]) g.connect(this._bus);

    // Bus-Kompressor („Glue“) + schneller Limiter
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 3.5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.25;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.0015;
    this.limiter.release.value = 0.12;
    this.master = c.createGain();
    // Sicherheits-Soft-Clipper: garantiert |y| < 1
    this._pre = c.createGain();
    this._pre.gain.value = 0.25;
    this._clip = c.createWaveShaper();
    const n = 8192;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = ((i / (n - 1)) * 2 - 1) * 4;
      const a = Math.abs(u);
      curve[i] = Math.sign(u) * (a < 0.8 ? a : 0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
    }
    this._clip.curve = curve;
    this._clip.oversample = this.q === 'high' ? '2x' : 'none';
    // DC-/Infraschall-Sperre vor der Dynamik
    this._dcBlock = c.createBiquadFilter();
    this._dcBlock.type = 'highpass';
    this._dcBlock.frequency.value = 24;
    this._dcBlock.Q.value = 0.707;
    this._bus.connect(this._dcBlock);
    this._dcBlock.connect(this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(this._pre);
    this._pre.connect(this._clip);
    this._clip.connect(c.destination);

    // Hall-Busse
    this.hallIn = c.createGain();
    this.roomIn = c.createGain();
    this._hall = c.createConvolver();
    this._room = c.createConvolver();
    const hallHp = c.createBiquadFilter();
    hallHp.type = 'highpass';
    hallHp.frequency.value = 160;
    const hallLp = c.createBiquadFilter();
    hallLp.type = 'lowpass';
    hallLp.frequency.value = 7500;
    this._hallRet = c.createGain();
    this.hallIn.connect(this._hall);
    this._hall.connect(hallHp);
    hallHp.connect(hallLp);
    hallLp.connect(this._hallRet);
    this._hallRet.connect(this.musicIn);
    const roomHp = c.createBiquadFilter();
    roomHp.type = 'highpass';
    roomHp.frequency.value = 180;
    this._roomRet = c.createGain();
    this.roomIn.connect(this._room);
    this._room.connect(roomHp);
    roomHp.connect(this._roomRet);
    this._roomRet.connect(this.sfxIn);

    // Rausch-Quellen (einmalig)
    const sr = c.sampleRate;
    this._nbuf = c.createBuffer(1, sr * 2, sr);
    const nd = this._nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this._crackle = c.createBuffer(1, sr * 2, sr);
    const cd = this._crackle.getChannelData(0);
    let env = 0;
    for (let i = 0; i < cd.length; i++) {
      if (Math.random() < 0.0016) env = rnd(0.3, 1) * (Math.random() < 0.5 ? -1 : 1);
      env *= 0.985;
      cd[i] = env * (Math.random() * 2 - 1) * 1.6;
    }

    this._graph = true;
    this._buildReverbs();
    for (const ch of ['master', 'music', 'sfx', 'ui']) this._applyVolume(ch, true);
  }

  _buildReverbs() {
    const hq = this.q === 'high';
    this._hall.normalize = true;
    this._hall.buffer = this._makeIR(hq ? 3.2 : 2.0, 0.022, 2.8);
    this._room.normalize = true;
    this._room.buffer = this._makeIR(hq ? 1.6 : 1.0, 0.008, 3.5);
    this._hallRet.gain.value = 0.9;
    this._roomRet.gain.value = hq ? 0.8 : 0.5;
    if (this._clip) this._clip.oversample = hq ? '2x' : 'none';
  }

  /** Stereo-Impulsantwort: exponentiell abklingendes, zunehmend gedämpftes Rauschen + frühe Reflexionen. */
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
        const a = Math.max(0.04, 0.92 * Math.exp(-x * damp));
        lp += a * (Math.random() * 2 - 1 - lp);
        const comp = Math.pow((2 - a) / a, 0.25);
        const fadeIn = Math.min(1, (i - p0) / (sr * 0.004));
        d[i] = lp * comp * Math.exp(-6.9 * x) * fadeIn;
      }
      // frühe Reflexionen
      for (let k = 0; k < 10; k++) {
        const pos = p0 + Math.floor(rnd(0.003, 0.075) * sr);
        if (pos < len) d[pos] += (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 0.8) * (1 - k / 12);
      }
    }
    return buf;
  }

  _applyVolume(ch, instant = false) {
    if (!this._graph) return;
    const node = { master: this.master, music: this.musicIn, sfx: this.sfxIn, ui: this.uiIn }[ch];
    let g = this._vol[ch];
    g = g * g; // wahrnehmungsgerechte Kurve
    if (ch === 'master' && this._muted) g = 0;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    if (instant) node.gain.setValueAtTime(g, now);
    else {
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.setTargetAtTime(g, now, 0.06);
    }
  }

  _voice() {
    return new Voice(this);
  }

  /** Callback nach `sec` Sekunden Audio-Zeit (funktioniert auch offline). */
  _after(sec, fn) {
    const c = this.ctx;
    const cs = c.createConstantSource();
    cs.offset.value = 0;
    cs.connect(this._silent);
    cs.onended = () => {
      cs.disconnect();
      fn();
    };
    cs.start(c.currentTime);
    cs.stop(c.currentTime + sec);
  }

  /* ---------- Musik-Steuerung ---------- */

  _strip(S, level, pan, send) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = level;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(S.dry);
    S.nodes.push(g, p);
    if (send > 0) {
      const s = c.createGain();
      s.gain.value = send;
      p.connect(s);
      s.connect(S.wet);
      S.nodes.push(s);
    }
    return g;
  }

  _startTrack(name, crossfade) {
    const c = this.ctx;
    const def = TRACKS[name];
    const now = c.currentTime;
    const S = { name, def, nodes: [], st: {}, beat: 0, spb: 60 / def.bpm, I: this._iTarget, active: true, disposed: false };
    S.dry = c.createGain();
    S.wet = c.createGain();
    S.dry.connect(this.musicIn);
    S.wet.connect(this.hallIn);
    const fade = def.once ? 0.02 : crossfade ? 2.0 : 1.0;
    for (const g of [S.dry, S.wet]) {
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + fade);
    }
    def.setup.call(this, S);
    S.nextT = now + 0.06;
    if (def.once) {
      def.play.call(this, S, S.nextT);
      this._after(def.length + 3.5, () => {
        if (this._track === S) this._track = null;
        this._disposeTrack(S);
      });
    }
    return S;
  }

  _stopTrack(S, fade) {
    if (!S.active) return;
    S.active = false;
    const now = this.ctx.currentTime;
    for (const g of [S.dry, S.wet]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
    }
    this._after(fade + 0.3, () => this._disposeTrack(S));
  }

  _disposeTrack(S) {
    if (S.disposed) return;
    S.disposed = true;
    S.active = false;
    for (const n of [S.dry, S.wet, ...S.nodes]) {
      try {
        n.disconnect();
      } catch (_) {
        /* egal */
      }
    }
    S.nodes.length = 0;
  }

  /** Lookahead-Scheduler (alle ~25 ms). */
  _tick() {
    if (!this.ctx || !this._graph) return;
    const S = this._track;
    if (!S || !S.active || S.def.once) return;
    const now = this.ctx.currentTime;
    if (S.nextT < now - 0.05) {
      // zurückgefallen (z. B. Tab im Hintergrund) → im Raster weiterspringen
      while (S.nextT < now) {
        S.nextT += S.spb;
        S.beat++;
      }
    }
    const until = now + this._lookahead;
    let guard = 0;
    while (S.nextT < until && guard++ < 64) {
      if (S.beat % 4 === 0) S.I += (this._iTarget - S.I) * 0.7;
      S.def.beat.call(this, S, S.beat, S.nextT);
      S.beat++;
      S.nextT += S.spb;
    }
  }

  /* ---------- SFX-Steuerung ---------- */

  _fx(bus, name, opts) {
    if (!this.ctx || !this._graph) return false;
    if (!this._offline && this.ctx.state !== 'running') return false;
    const fn = (bus === 'ui' ? UI : SFX)[name];
    if (!fn) return false;
    const c = this.ctx;
    const now = c.currentTime;
    const key = bus + ':' + name;
    const [max0, gap, vari, lvl] = LIMITS[key] || [4, 0.04, 0.04, 1];
    const max = this.q === 'low' ? Math.max(1, Math.ceil(max0 / 2)) : max0;
    let st = this._fxState.get(key);
    if (!st) {
      st = { last: -1e9, voices: [] };
      this._fxState.set(key, st);
    }
    if (now - st.last < gap) return false;
    st.voices = st.voices.filter((x) => x.end > now && !x.v.dead);
    // globale Obergrenze
    let total = 0;
    for (const s of this._fxState.values()) total += s.voices.length;
    if (total >= (this.q === 'high' ? 48 : 22)) return false;
    if (st.voices.length >= max) {
      const old = st.voices.shift();
      const g = old.out.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(0, now, 0.012);
    }
    st.last = now;
    const t = now + 0.006;
    const v = this._voice();
    const out = v.n(c.createGain());
    out.gain.value = (lvl * clamp(opts.volume ?? 1, 0, 1)) / (1 + 0.28 * st.voices.length);
    const pan = v.n(c.createStereoPanner());
    pan.pan.value = clamp(Number(opts.pan) || 0, -1, 1);
    out.connect(pan);
    pan.connect(bus === 'ui' ? this.uiIn : this.sfxIn);
    const p = clamp(Number(opts.pitch) || 1, 0.25, 4) * (1 + (Math.random() - 0.5) * vari);
    let res;
    try {
      res = fn.call(this, v, out, t, p);
    } catch (e) {
      v.dispose();
      return false;
    }
    if (res.r > 0 && (this.q === 'high' || res.r >= 0.3)) {
      const s = v.n(c.createGain());
      s.gain.value = res.r;
      pan.connect(s);
      s.connect(this.roomIn);
    }
    if (v.pending === 0) v.dispose();
    st.voices.push({ v, out, end: t + res.d });
    return true;
  }

  /* ---------- Instrumente (Musik + SFX) ---------- */

  /** Detunter Supersaw-Streichersatz (legato oder staccato/spiccato). */
  _strings(dest, t, m, dur, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f = mtof(m);
    const hq = this.q === 'high';
    const n = hq ? o.n || 6 : Math.min(3, o.n || 3);
    const stac = !!o.stac;
    const atk = stac ? 0.006 : o.atk ?? 0.4;
    const rel = stac ? 0 : o.rel ?? 0.9;
    const dec = o.dec ?? 0.16;
    const spread = o.spread ?? 13;
    const w = o.width ?? 0.6;
    const pl = v.n(c.createStereoPanner());
    const pr = v.n(c.createStereoPanner());
    pl.pan.value = -w;
    pr.pan.value = w;
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    const amp = v.n(c.createGain());
    pl.connect(lp);
    pr.connect(lp);
    lp.connect(amp);
    amp.connect(dest);
    const cut = Math.min(15000, (650 + vel * 2600) * (o.bright ?? 1) + f * 1.5);
    const peak = (vel * (o.gain ?? 1) * 0.42) / Math.sqrt(n);
    let tEnd;
    if (stac) {
      lp.frequency.setValueAtTime(cut * 1.5, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.45), t + dec);
      tEnd = perc(amp.gain, t, peak * 2.4, atk, dec) + 0.01;
    } else {
      const tr = t + Math.max(dur, atk);
      lp.frequency.setValueAtTime(cut * 0.4, t);
      lp.frequency.linearRampToValueAtTime(cut, t + atk * 1.2);
      amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + atk);
      amp.gain.setTargetAtTime(0, tr, rel / 5);
      tEnd = tr + rel;
    }
    let lfoG = null;
    if (!stac && hq && dur > 0.8) {
      const lfo = c.createOscillator();
      lfo.frequency.value = rnd(4.6, 5.6);
      lfoG = v.n(c.createGain());
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.linearRampToValueAtTime(o.vib ?? 6, t + Math.min(1.2, dur));
      lfo.connect(lfoG);
      v.play(lfo, t, tEnd);
    }
    for (let i = 0; i < n; i++) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0) + rnd(-2, 2);
      osc.connect(i % 2 ? pr : pl);
      if (lfoG) lfoG.connect(osc.detune);
      v.play(osc, t - Math.random() / f, tEnd);
    }
    return tEnd;
  }

  /** Warmes Blech: Sägezähne + Filterhüllkurve + verzögertes Vibrato, optional Scoop/Fall. */
  _brass(dest, t, m, dur, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f = mtof(m);
    const hq = this.q === 'high';
    const n = hq ? 3 : 2;
    const atk = o.atk ?? 0.06;
    const rel = o.rel ?? 0.25;
    const tr = t + Math.max(dur, atk);
    const tEnd = tr + rel;
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.Q.value = 1.5;
    const peakCut = Math.min(9000, (f * (2 + vel * 4.5) + 350) * (o.bright ?? 1));
    lp.frequency.setValueAtTime(Math.max(120, f * 1.1), t);
    lp.frequency.linearRampToValueAtTime(peakCut, t + atk * 1.3);
    lp.frequency.setTargetAtTime(peakCut * 0.6, t + atk * 1.3, 0.25);
    lp.frequency.setTargetAtTime(Math.max(120, f), tr, rel / 3);
    const amp = v.n(c.createGain());
    const peak = (vel * (o.gain ?? 1) * 0.36) / Math.sqrt(n);
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + atk);
    amp.gain.setTargetAtTime(peak * 0.78, t + atk, 0.3);
    amp.gain.setTargetAtTime(0, tr, rel / 5);
    const pl = v.n(c.createStereoPanner());
    const pr = v.n(c.createStereoPanner());
    pl.pan.value = -0.25;
    pr.pan.value = 0.25;
    pl.connect(lp);
    pr.connect(lp);
    lp.connect(amp);
    amp.connect(dest);
    let lfoG = null;
    if (dur > 0.45) {
      const lfo = c.createOscillator();
      lfo.frequency.value = rnd(4.8, 5.6);
      lfoG = v.n(c.createGain());
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.setValueAtTime(0, t + 0.3);
      lfoG.gain.linearRampToValueAtTime(o.vib ?? 7, t + 0.8);
      lfo.connect(lfoG);
      v.play(lfo, t, tEnd);
    }
    const dets = [-6, 6, 0];
    for (let i = 0; i < n; i++) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const d0 = dets[i] + rnd(-1.5, 1.5);
      if (o.scoop) {
        osc.detune.setValueAtTime(d0 - o.scoop, t);
        osc.detune.linearRampToValueAtTime(d0, t + atk * 1.4);
      } else osc.detune.setValueAtTime(d0, t);
      if (o.fall) {
        osc.detune.setValueAtTime(d0, tr);
        osc.detune.linearRampToValueAtTime(d0 - o.fall, tEnd);
      }
      osc.connect(i % 2 ? pr : pl);
      if (lfoG) lfoG.connect(osc.detune);
      v.play(osc, t - Math.random() / f, tEnd);
    }
    return tEnd;
  }

  /** Chor „aah/ooh“: Sägezahn-Ensemble durch parallele Formant-Bandpässe. */
  _choir(dest, t, m, dur, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f = mtof(m);
    const hq = this.q === 'high';
    const n = hq ? 3 : 2;
    const atk = o.atk ?? 0.7;
    const rel = o.rel ?? 1.2;
    const tr = t + Math.max(dur, atk);
    const tEnd = tr + rel;
    const pl = v.n(c.createStereoPanner());
    const pr = v.n(c.createStereoPanner());
    pl.pan.value = -0.5;
    pr.pan.value = 0.5;
    const mix = v.n(c.createGain());
    pl.connect(mix);
    pr.connect(mix);
    const amp = v.n(c.createGain());
    const forms = FORMANTS[o.vowel || 'a'].slice(0, hq ? 4 : 2);
    for (const [ff, g0, q] of forms) {
      const bp = v.n(c.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = q;
      const g = v.n(c.createGain());
      g.gain.value = g0;
      mix.connect(bp);
      bp.connect(g);
      g.connect(amp);
    }
    const body = v.n(c.createBiquadFilter());
    body.type = 'lowpass';
    body.frequency.value = Math.max(300, f * 1.6);
    const bg = v.n(c.createGain());
    bg.gain.value = 0.22;
    mix.connect(body);
    body.connect(bg);
    bg.connect(amp);
    amp.connect(dest);
    const peak = (vel * (o.gain ?? 1) * 1.1) / Math.sqrt(n);
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + atk);
    amp.gain.setTargetAtTime(0, tr, rel / 5);
    const lfo = c.createOscillator();
    lfo.frequency.value = rnd(5.0, 5.8);
    const lfoG = v.n(c.createGain());
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(11, t + Math.min(1.5, atk + 0.6));
    lfo.connect(lfoG);
    v.play(lfo, t, tEnd);
    for (let i = 0; i < n; i++) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (i - (n - 1) / 2) * 9 + rnd(-3, 3);
      osc.connect(i % 2 ? pr : pl);
      lfoG.connect(osc.detune);
      v.play(osc, t - Math.random() / f, tEnd);
    }
    return tEnd;
  }

  /** Harfe / weiches Klavier: Dreieck + Sägezahn mit schließendem Filter. */
  _harp(dest, t, m, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f = mtof(m);
    const dec = o.dec ?? clamp(3.0 - (m - 40) * 0.05, 0.6, 3);
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(Math.min(14000, 1500 + vel * 5000 * (o.bright ?? 1)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.5), t + dec * 0.35);
    const amp = v.n(c.createGain());
    const end = perc(amp.gain, t, vel * (o.gain ?? 1) * 0.45, 0.003, dec);
    lp.connect(amp);
    amp.connect(dest);
    const tri = c.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f;
    tri.connect(lp);
    v.play(tri, t, end + 0.01);
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    saw.detune.value = 4;
    const sg = v.n(c.createGain());
    sg.gain.value = 0.3;
    saw.connect(sg);
    sg.connect(lp);
    v.play(saw, t, end + 0.01);
    const h2 = c.createOscillator();
    h2.frequency.value = f * 2;
    const hg = v.n(c.createGain());
    perc(hg.gain, t, 0.25, 0.002, dec * 0.3);
    h2.connect(hg);
    hg.connect(lp);
    v.play(h2, t, t + dec * 0.3 + 0.01);
    return end;
  }

  /** Celesta / Glocke (FM). Für SFX-Glocken siehe _fm. */
  _bell(dest, t, m, vel, o = {}) {
    const v = o.v || this._voice();
    const f = mtof(m);
    const ratio = o.ratio ?? 4;
    this._fm(v, dest, t, f, { ratio, index: 1.2 * vel + 0.3, mdec: 0.35, dec: o.dec ?? 2.0, peak: vel * 0.5 });
    this._tone(v, dest, 'sine', t, f * 2, f * 2, 0, 0.002, 0.25, vel * 0.04);
  }

  /** Tiefer Sub-Bass. */
  _bass(dest, t, m, dur, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f = mtof(m);
    const atk = o.atk ?? 0.02;
    const rel = o.rel ?? 0.2;
    const tr = t + Math.max(dur, atk);
    const tEnd = tr + rel;
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 140 + f * 2.5;
    lp.Q.value = 0.7;
    const amp = v.n(c.createGain());
    const peak = vel * (o.gain ?? 1) * 0.45;
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + atk);
    amp.gain.setTargetAtTime(0, tr, rel / 5);
    lp.connect(amp);
    amp.connect(dest);
    const s = c.createOscillator();
    s.frequency.value = f;
    s.connect(lp);
    v.play(s, t, tEnd);
    const tri = c.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f * 2;
    const tg = v.n(c.createGain());
    tg.gain.value = 0.22;
    tri.connect(tg);
    tg.connect(lp);
    v.play(tri, t, tEnd);
    return tEnd;
  }

  /** Taiko: Sinus mit Tonhöhen-Abfall + Fell-Rauschen + Schlag-Transient. */
  _taiko(dest, t, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const f0 = (o.f ?? 60) * rnd(0.97, 1.03);
    const dec = o.dec ?? 0.9;
    const peak = vel * (o.gain ?? 1) * 0.55;
    const s = c.createOscillator();
    s.frequency.setValueAtTime(f0 * 1.9, t);
    s.frequency.exponentialRampToValueAtTime(f0, t + 0.045);
    s.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + dec);
    const g = v.n(c.createGain());
    const end = perc(g.gain, t, peak, 0.002, dec);
    s.connect(g);
    g.connect(dest);
    v.play(s, t, end + 0.01);
    if (this.q === 'high') {
      const s2 = c.createOscillator();
      s2.frequency.setValueAtTime(f0 * 1.6 * 1.5, t);
      s2.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.04);
      const g2 = v.n(c.createGain());
      perc(g2.gain, t, peak * 0.3, 0.002, dec * 0.35);
      s2.connect(g2);
      g2.connect(dest);
      v.play(s2, t, t + dec * 0.35 + 0.01);
    }
    this._nz(v, dest, t, { type: 'lowpass', f: 260, q: 0.7, atk: 0.002, dec: 0.18, peak: peak * 0.7 });
    this._nz(v, dest, t, { type: 'bandpass', f: 1100, q: 0.9, atk: 0.001, dec: 0.045, peak: peak * 0.4 });
    return end;
  }

  /** Pauke: gestimmte Teiltöne (Membran-Moden) + Schlägel-Geräusch. */
  _timp(dest, t, m, vel, o = {}) {
    const v = o.v || this._voice();
    const f = mtof(m);
    const dec = o.dec ?? 2.2;
    const ratios = [1, 1.504, 1.742, 2.0, 2.245];
    const amps = [1, 0.5, 0.3, 0.22, 0.14];
    const n = this.q === 'high' ? 5 : 3;
    const peak = vel * (o.gain ?? 1) * 0.45;
    for (let i = 0; i < n; i++) {
      this._tone(v, dest, 'sine', t, f * ratios[i] * 1.025, f * ratios[i], 0.09, 0.003, dec * (1 - i * 0.14), peak * amps[i]);
    }
    this._nz(v, dest, t, { type: 'lowpass', f: 900, q: 0.7, atk: 0.001, dec: 0.07, peak: peak * 0.45 });
    return t + dec;
  }

  /** Orchester-Snare. */
  _snare(dest, t, vel, o = {}) {
    const v = o.v || this._voice();
    const peak = vel * (o.gain ?? 1) * 2.4;
    this._nz(v, dest, t, { type: 'highpass', f: 1800, q: 0.7, atk: 0.001, dec: o.dec ?? 0.16, peak: peak * 0.5 });
    this._nz(v, dest, t, { type: 'bandpass', f: 5000, q: 0.7, atk: 0.001, dec: 0.08, peak: peak * 0.25 });
    this._tone(v, dest, 'triangle', t, 195, 165, 0.05, 0.001, 0.08, peak * 0.3);
  }

  /** Becken: Crash oder Swell (Rausch-Bänder + metallische Rechteck-Cluster). */
  _cymbal(dest, t, vel, o = {}) {
    const c = this.ctx;
    const v = o.v || this._voice();
    const swell = o.swell || 0;
    const dec = o.dec ?? 2.6;
    const peak = vel * (o.gain ?? 1) * 0.5;
    const amp = v.n(c.createGain());
    let end;
    if (swell) {
      amp.gain.value = 0;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(peak, t + swell);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + swell + 0.1);
      end = t + swell + 0.11;
    } else end = perc(amp.gain, t, peak, 0.003, dec) + 0.01;
    amp.connect(dest);
    const ns = this._noiseSrc(v, t, end);
    const hp = v.n(c.createBiquadFilter());
    hp.type = 'highpass';
    hp.frequency.value = 5500;
    ns.connect(hp);
    hp.connect(amp);
    const bp = v.n(c.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 1;
    const bg = v.n(c.createGain());
    bg.gain.value = 0.35;
    ns.connect(bp);
    bp.connect(bg);
    bg.connect(amp);
    if (this.q === 'high') {
      const mh = v.n(c.createBiquadFilter());
      mh.type = 'highpass';
      mh.frequency.value = 6500;
      const mg = v.n(c.createGain());
      mg.gain.value = 0.06;
      mh.connect(mg);
      mg.connect(amp);
      for (const fr of [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) {
        const s = c.createOscillator();
        s.type = 'square';
        s.frequency.value = fr * 2.3;
        s.connect(mh);
        v.play(s, t, end);
      }
    }
    return end;
  }

  /* ---------- SFX-Bausteine ---------- */

  _noiseSrc(v, t0, t1, rate = 1, buf = this._nbuf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    v.play(s, t0, t1, Math.random() * buf.duration * 0.9);
    return s;
  }

  _pan(v, dest, p) {
    const pn = v.n(this.ctx.createStereoPanner());
    pn.pan.value = p;
    pn.connect(dest);
    return pn;
  }

  _tone(v, dest, type, t, f0, f1, glide, atk, dec, peak) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0 && glide > 0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    const g = v.n(c.createGain());
    const end = perc(g.gain, t, peak, atk, dec);
    o.connect(g);
    g.connect(dest);
    v.play(o, t, end + 0.01);
    return o;
  }

  /** Gefiltertes Rauschen mit optionalem Filter-Sweep und perkussiver Hüllkurve. */
  _nz(v, dest, t, o) {
    const c = this.ctx;
    const atk = o.atk ?? 0.002;
    const end = t + atk + o.dec;
    const s = this._noiseSrc(v, t, end + 0.01, o.rate ?? 1, o.buf || this._nbuf);
    const fl = v.n(c.createBiquadFilter());
    fl.type = o.type || 'allpass';
    fl.Q.value = o.q ?? 0.7;
    fl.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide ?? atk + o.dec));
    const g = v.n(c.createGain());
    perc(g.gain, t, o.peak, atk, o.dec);
    s.connect(fl);
    fl.connect(g);
    g.connect(dest);
    return fl;
  }

  /** FM-Glocke/Celesta: Träger + Modulator (Index klingt ab). */
  _fm(v, dest, t, f, o) {
    const c = this.ctx;
    const car = c.createOscillator();
    car.type = o.type || 'sine';
    car.frequency.setValueAtTime(f, t);
    if (o.f1) car.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide ?? 0.2));
    const mod = c.createOscillator();
    mod.frequency.setValueAtTime(f * o.ratio, t);
    if (o.f1) mod.frequency.exponentialRampToValueAtTime(o.f1 * o.ratio, t + (o.glide ?? 0.2));
    const mg = v.n(c.createGain());
    const idx = (o.index ?? 1) * f;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.5, idx * 0.04), t + (o.mdec ?? 0.4));
    mod.connect(mg);
    mg.connect(car.frequency);
    const g = v.n(c.createGain());
    const end = perc(g.gain, t, o.peak, o.atk ?? 0.002, o.dec);
    car.connect(g);
    g.connect(dest);
    v.play(car, t, end + 0.01);
    v.play(mod, t, end + 0.01);
    return end;
  }

  /** Metallisches Klingen (inharmonische Teiltöne, höhere klingen schneller ab). */
  _metal(v, dest, t, f, dec, peak, ratios) {
    ratios.forEach((r, i) => this._tone(v, dest, 'sine', t, f * r, f * r, 0, 0.001, dec / (1 + i * 0.7), peak / (1 + i * 0.5)));
  }

  /** Münze: helle inharmonische Teiltöne + Klick. */
  _coin(v, dest, t, f, peak, len = 1) {
    const rs = [1, 1.47, 2.09, 2.56, 3.2];
    const as = [1, 0.7, 0.45, 0.3, 0.2];
    const ds = [0.32, 0.22, 0.16, 0.11, 0.08];
    const n = this.q === 'high' ? 5 : 3;
    for (let i = 0; i < n; i++) this._tone(v, dest, 'sine', t, f * rs[i], f * rs[i], 0, 0.001, ds[i] * len, peak * as[i]);
    this._nz(v, dest, t, { type: 'highpass', f: 6000, q: 0.7, atk: 0.001, dec: 0.006, peak: peak * 0.8 });
  }

  /** Gezupfter Sägezahn mit Filterhüllkurve (für Arpeggien / Bogensehne). */
  _pluckSaw(v, dest, t, f, dec, peak, cut) {
    const c = this.ctx;
    const s = c.createOscillator();
    s.type = 'sawtooth';
    s.frequency.value = f;
    const lp = v.n(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cut, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + dec);
    const g = v.n(c.createGain());
    const end = perc(g.gain, t, peak, 0.002, dec);
    s.connect(lp);
    lp.connect(g);
    g.connect(dest);
    v.play(s, t, end + 0.01);
  }
}

export default AudioEngine;
