// Einstellungen mit Speicherung (localStorage, fehlertolerant) und Änderungs-Benachrichtigung.
const KEY = 'aetherfront.settings.v1';
export const DEFAULTS = {
  quality: 'high', qualityAuto: true, renderScale: 1, bloom: true, shadows: true, ao: true, antialias: true, particles: 1, filmGrain: true,
  showFps: false, damageNumbers: false,
  volMaster: 0.8, volMusic: 0.55, volSfx: 0.8, volUi: 0.7, muted: false,
  camSpeed: 1, edgeScroll: true,
  gameSpeed: 1, playerName: 'Tiry', faction: 'random', teamSize: 4, difficulty: 'normal', allyDifficulty: 'normal',
  pickMode: 'ap', champions: false, waves: 30, campDifficulty: 'normal', campFaction: 'orden', campMission: 1,
  serverUrl: 'ws://localhost:7710', fullscreen: false,
};

export class Settings {
  constructor() {
    this.v = { ...DEFAULTS };
    this.listeners = [];
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      // Ältere Speicherstände ohne Automatik-Flag: eine vom Standard abweichende Stufe war eine bewusste Wahl
      if (!('qualityAuto' in saved) && saved.quality && saved.quality !== DEFAULTS.quality) saved.qualityAuto = false;
      Object.assign(this.v, saved);
    } catch { /* Standardwerte */ }
  }
  get(k) { return this.v[k]; }
  set(k, val) {
    // Wählt der Spieler die Grafikstufe selbst, endet die Automatik (Erkennung + Benchmark)
    if (k === 'quality' && !this._auto && this.v.qualityAuto) { this.v.qualityAuto = false; this.save(); }
    if (this.v[k] === val) return;
    this.v[k] = val;
    this.save();
    for (const l of this.listeners) l(k, val);
  }
  /** Setzt einen Wert durch die Automatik (beendet sie nicht). */
  setAuto(k, val) { this._auto = true; try { this.set(k, val); } finally { this._auto = false; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.v)); } catch { /* nicht speicherbar */ } }
  onChange(fn) { this.listeners.push(fn); }
  reset() { for (const k of Object.keys(DEFAULTS)) this.set(k, DEFAULTS[k]); }
}
