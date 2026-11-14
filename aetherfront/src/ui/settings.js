// Einstellungen mit Speicherung (localStorage, fehlertolerant) und Änderungs-Benachrichtigung.
const KEY = 'aetherfront.settings.v1';
export const DEFAULTS = {
  quality: 'high', renderScale: 1, bloom: true, shadows: true, ao: true, antialias: true, particles: 1, filmGrain: true,
  showFps: false, damageNumbers: false,
  volMaster: 0.8, volMusic: 0.55, volSfx: 0.8, volUi: 0.7, muted: false,
  camSpeed: 1, edgeScroll: true,
  gameSpeed: 1, playerName: 'Tiry', faction: 'random', teamSize: 4, difficulty: 'normal',
  serverUrl: 'ws://localhost:7710', fullscreen: false,
};

export class Settings {
  constructor() {
    this.v = { ...DEFAULTS };
    this.listeners = [];
    try { Object.assign(this.v, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* Standardwerte */ }
  }
  get(k) { return this.v[k]; }
  set(k, val) {
    if (this.v[k] === val) return;
    this.v[k] = val;
    try { localStorage.setItem(KEY, JSON.stringify(this.v)); } catch { /* nicht speicherbar */ }
    for (const l of this.listeners) l(k, val);
  }
  onChange(fn) { this.listeners.push(fn); }
  reset() { for (const k of Object.keys(DEFAULTS)) this.set(k, DEFAULTS[k]); }
}
