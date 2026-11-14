// Kampagnen-Fortschritt (Sterne je Mission), lokal gespeichert.
const KEY = 'aetherfront.campaign.v1';
export class Progress {
  constructor() {
    this.stars = {};
    try { this.stars = JSON.parse(localStorage.getItem(KEY) || '{}').stars || {}; } catch { this.stars = {}; }
  }
  get total() { return Object.values(this.stars).reduce((a, b) => a + b, 0); }
  record(id, stars) {
    if (stars > (this.stars[id] || 0)) this.stars[id] = stars;
    try { localStorage.setItem(KEY, JSON.stringify({ stars: this.stars })); } catch { /* nicht speicherbar */ }
  }
  reset() { this.stars = {}; try { localStorage.removeItem(KEY); } catch { /* egal */ } }
}
