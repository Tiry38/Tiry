// Minimap (Canvas 2D, ~12 Hz): Inseln/Bahnen der Partie, Einheiten als Punkte, Gegnerwellen, Könige, Arena und
// das Kamera-Sichtfeld. Klicken/Ziehen (linke Maustaste) bewegt die Kamera. Kartenbild aus mapLayout() (sim/layout.js).
import { laneCenterX, TEAM_CENTER_X, KING_Z, LANE_END_Z, LANE_WIDTH, BUILD_Z0, BUILD_Z1, GRID_COLS, CELL, ARENA } from '../sim/layout.js';

const TEAM = ['#6fb0ff', '#ff6a7c'];
const LANE_Z0 = -38.5, LANE_Z1 = LANE_END_Z + 2.5, PORTAL_Z = -35.4, HERO = { x: 0, z: 6, r: 14 };
const HZ = 12;

/** Welt → Minimap: „contain“-Einpassung des Kartenausschnitts in w×h (mit Rand). Gibt { s, ox, oz, toMap, toWorld } */
export function fitMap(rect, w, h, pad = 8) {
  const s = Math.min((w - pad * 2) / (rect.x1 - rect.x0), (h - pad * 2) / (rect.z1 - rect.z0));
  const ox = (w - (rect.x1 - rect.x0) * s) / 2 - rect.x0 * s;
  const oz = (h - (rect.z1 - rect.z0) * s) / 2 - rect.z0 * s;
  return { s, ox, oz, toMap: (x, z) => [ox + x * s, oz + z * s], toWorld: (mx, my) => ({ x: (mx - ox) / s, z: (my - oz) / s }) };
}

export class Minimap {
  /** @param el Container (#minimap) · onMove(x, z, dragging) bewegt die Kamera */
  constructor(el, { onMove }) {
    this.el = el;
    this.onMove = onMove;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.createElement('canvas');
    this.layout = null;
    this.acc = 1;
    this.dpr = 1;
    this.local = null;
    const pick = (e) => {
      if (!this.fit) return;
      const r = this.canvas.getBoundingClientRect();
      const p = this.fit.toWorld(((e.clientX - r.left) / r.width) * this.w, ((e.clientY - r.top) / r.height) * this.h);
      this.onMove(p.x, p.z, !!this.dragging);
    };
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      this.dragging = true; pick(e);
    });
    window.addEventListener('mousemove', (e) => { if (this.dragging) pick(e); });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('resize', () => { this.sized = false; });
  }

  /** Kartenbild der Partie (mapLayout) + lokaler Spieler { team, slot } */
  setLayout(layout, local) {
    this.layout = layout;
    this.local = local || null;
    this.sized = false;
    this.acc = 1;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // die Oberfläche ist per CSS-zoom skaliert → Pixelmaß aus der echten Bildschirmgröße
    this.w = Math.round(r.width * dpr); this.h = Math.round(r.height * dpr);
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.layer.width = this.w; this.layer.height = this.h;
    this.dpr = dpr * (r.width / (this.canvas.offsetWidth || r.width));
    this.fit = fitMap(this.layout.mapRect, this.w, this.h, 10 * this.dpr);
    this.drawStatic();
    this.sized = true;
    return true;
  }

  // ---------- statische Ebene: Inseln, Bahnen, Brücken, Plateaus, Arena ----------
  drawStatic() {
    const g = this.layer.getContext('2d');
    const L = this.layout, F = this.fit, s = F.s;
    g.clearRect(0, 0, this.w, this.h);
    const P = (x, z) => F.toMap(x, z);
    const pill = (x0, z0, x1, z1, r) => {
      const [a, b] = P(x0, z0), [c, d] = P(x1, z1);
      g.beginPath(); g.roundRect(a, b, c - a, d - b, Math.min(r * s, (c - a) / 2, (d - b) / 2));
    };
    const circle = (x, z, r) => { const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, r * s, 0, Math.PI * 2); };
    // Inseln: weiche Blobs mit Verlauf (Mittelinsel, Teaminseln über den belegten Bahnen, Königsinseln)
    const land = (path) => {
      path();
      const gr = g.createLinearGradient(0, 0, this.w, this.h);
      gr.addColorStop(0, 'rgba(70, 120, 92, 0.55)'); gr.addColorStop(0.5, 'rgba(52, 96, 110, 0.5)'); gr.addColorStop(1, 'rgba(84, 78, 120, 0.55)');
      g.fillStyle = gr; g.fill();
      g.lineWidth = Math.max(1, 1.2 * this.dpr); g.strokeStyle = 'rgba(190, 240, 255, 0.22)'; g.stroke();
    };
    land(() => circle(HERO.x, HERO.z, HERO.r));
    for (const t of [0, 1]) {
      const xs = L.lanes[t].map((sl) => laneCenterX(t, sl));
      if (!xs.length && !L.march[t]) continue;
      const cx = TEAM_CENTER_X[t];
      const x0 = Math.min(cx - 12, ...xs.map((x) => x - 12)), x1 = Math.max(cx + 12, ...xs.map((x) => x + 12));
      land(() => pill(x0, xs.length ? -41 : 14, x1, 33, 16));
      land(() => circle(cx, KING_Z + 3, 16));
    }
    if (L.arena) {
      circle(ARENA.x, ARENA.z, ARENA.r);
      g.fillStyle = 'rgba(232, 196, 122, 0.10)'; g.fill();
      g.setLineDash([3 * this.dpr, 3 * this.dpr]); g.lineWidth = 1.2 * this.dpr; g.strokeStyle = 'rgba(255, 210, 122, 0.55)'; g.stroke(); g.setLineDash([]);
    }
    // Brücken + Bahnen + Plateaus
    const stone = 'rgba(232, 222, 200, 0.62)';
    for (const t of [0, 1]) {
      const cx = TEAM_CENTER_X[t];
      const bridgeXs = L.lanes[t].map((sl) => laneCenterX(t, sl));
      if (L.march[t]) bridgeXs.push(cx);
      g.lineCap = 'round'; g.strokeStyle = 'rgba(232, 222, 200, 0.45)'; g.lineWidth = Math.max(2, 6 * s);
      for (const lx of bridgeXs) { const [a, b] = P(lx, LANE_END_Z - 2), [c, d] = P(cx, KING_Z); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
      for (const sl of L.lanes[t]) {
        const lx = laneCenterX(t, sl);
        const own = this.local && this.local.team === t && this.local.slot === sl;
        pill(lx - LANE_WIDTH / 2, LANE_Z0, lx + LANE_WIDTH / 2, LANE_Z1, 5);
        g.fillStyle = own ? 'rgba(255, 226, 160, 0.78)' : stone; g.fill();
        // Bauraster
        const gx = (GRID_COLS * CELL) / 2;
        pill(lx - gx, BUILD_Z0, lx + gx, BUILD_Z1, 2.5);
        g.fillStyle = own ? 'rgba(255, 196, 92, 0.85)' : 'rgba(150, 214, 255, 0.40)'; g.fill();
        // Portal
        circle(lx, PORTAL_Z, 3.2); g.fillStyle = 'rgba(190, 120, 255, 0.95)'; g.fill();
      }
      if (L.lanes[t].length || L.march[t]) { circle(cx, KING_Z, 10.5); g.fillStyle = 'rgba(240, 226, 196, 0.55)'; g.fill(); }
    }
  }

  // ---------- dynamisch: Einheiten, Könige, Sichtfeld ----------
  update(dt, sim, cam) {
    if (!this.layout || !sim || this.el.offsetParent === null) return;
    this.acc += dt;
    if (this.acc < 1 / HZ && !this.dragging) return;
    this.acc = 0;
    if (!this.sized && !this.resize()) return;
    const g = this.ctx, F = this.fit, d = this.dpr;
    g.clearRect(0, 0, this.w, this.h);
    g.drawImage(this.layer, 0, 0);
    const dot = (x, z, r, c) => { const [a, b] = F.toMap(x, z); g.fillStyle = c; g.beginPath(); g.arc(a, b, r, 0, Math.PI * 2); g.fill(); };
    // Könige / Rissfeste mit Lebensring
    for (const t of [0, 1]) {
      const k = sim.teams[t] && sim.teams[t].king;
      if (!k || (!this.layout.lanes[t].length && !this.layout.march[t])) continue;
      const [a, b] = F.toMap(k.x, k.z);
      const col = k.citadel ? '#ff4fa3' : TEAM[t];
      g.fillStyle = 'rgba(6, 9, 18, 0.75)'; g.beginPath(); g.arc(a, b, 5.5 * d, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2.2 * d; g.strokeStyle = 'rgba(255, 255, 255, 0.18)'; g.beginPath(); g.arc(a, b, 5.5 * d, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = col; g.beginPath(); g.arc(a, b, 5.5 * d, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k.hp / k.maxHp)); g.stroke();
      dot(k.x, k.z, 2.4 * d, k.alive ? '#ffe2a0' : '#555');
    }
    // Einheiten
    for (const e of sim.entities.values()) {
      if (!e.alive) continue;
      if (e.type === 'f') dot(e.x, e.z, 1.6 * d, TEAM[e.team] || '#fff');
      else if (e.type === 'c') {
        const boss = e.def && (e.def.boss || e.def.champion || e.def.leader);
        dot(e.x, e.z, (boss ? 3 : 1.7) * d, e.siege ? '#74f0a6' : e.isSend ? '#ff7ac3' : boss ? '#ff4d5e' : '#ffb85a');
      } else if (e.type === 'o') dot(e.x, e.z, 2 * d, '#ffe27a');
      else if (e.type === 'h') dot(e.x, e.z, 2.4 * d, '#ffffff');
    }
    // Kamera-Sichtfeld
    const q = cam && cam.viewQuad();
    if (q) {
      g.beginPath();
      q.forEach((p, i) => { const [a, b] = F.toMap(p.x, p.z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
      g.closePath();
      g.fillStyle = 'rgba(255, 244, 214, 0.08)'; g.fill();
      g.lineJoin = 'round'; g.lineWidth = 1.5 * d; g.strokeStyle = 'rgba(255, 244, 214, 0.9)'; g.stroke();
    }
  }
}
