// Signatur: die Sortiermaschine.
// Jede echte Mail fährt als farbiger Umschlag über das Förderband und fällt in das Fach ihrer Sorte.
// Fächer federn beim Aufprall (Masse/Steifigkeit/Dämpfung) und füllen sich sichtbar.
// Im Probelauf landen weggeräumte Mails nur als Umriss („würde“).

export type Fach = 'wichtig' | 'persoenlich' | 'benachrichtigung' | 'newsletter' | 'werbung' | 'muell';
export const FAECHER: Fach[] = ['wichtig', 'persoenlich', 'benachrichtigung', 'newsletter', 'werbung', 'muell'];

interface Umschlag { x: number; y: number; vx: number; vy: number; fach: number; phase: 'band' | 'fall' | 'drin'; probe: boolean; dreh: number; t: number }
interface Feder { y: number; v: number }

export class Sortierer {
  private ctx: CanvasRenderingContext2D;
  private w = 1; private h = 1; private dpr = 1;
  private umschlaege: Umschlag[] = [];
  private federn: Feder[] = FAECHER.map(() => ({ y: 0, v: 0 }));
  private stand: number[] = FAECHER.map(() => 0);       // Anzahl je Fach (für die Füllhöhe)
  private probeStand: number[] = FAECHER.map(() => 0);
  private farben: string[] = [];
  private tinte = '#fff'; private flaeche = '#333'; private linie = '#555';
  private bandPhase = 0; private laeuft = false; private raf = 0; private letzte = 0;
  readonly ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Wird aufgerufen, wenn ein Umschlag im Fach landet. */
  beiLandung?: (fach: number) => void;
  /** Klick auf ein Fach. */
  beiKlick?: (fach: number) => void;
  private zuletzt = -1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.farbenLesen();
    new ResizeObserver(() => this.groesse()).observe(canvas);
    this.groesse();
    // Maus über einem Fach: es federt kurz an (einmal pro Betreten)
    canvas.addEventListener('pointermove', (e) => {
      const i = this.fachBei(e.offsetX);
      if (i !== this.zuletzt && i >= 0 && e.offsetY > this.fachOben() - 20) { this.federn[i].v -= 60; this.start(); }
      this.zuletzt = e.offsetY > this.fachOben() - 20 ? i : -1;
    });
    canvas.addEventListener('pointerleave', () => { this.zuletzt = -1; });
    canvas.addEventListener('click', (e) => { const i = this.fachBei(e.offsetX); if (i >= 0) this.beiKlick?.(i); });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.start()));
  }

  farbenLesen() {
    const cs = getComputedStyle(document.documentElement);
    this.farben = FAECHER.map((f) => cs.getPropertyValue(`--c-${f}`).trim() || '#888');
    this.tinte = cs.getPropertyValue('--text').trim() || '#fff';
    this.flaeche = cs.getPropertyValue('--flaeche-2').trim() || '#333';
    this.linie = cs.getPropertyValue('--linie').trim() || '#555';
  }

  private groesse() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width; this.h = r.height;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.zeichne();
  }

  // ---- Geometrie ----
  private get bandY() { return Math.max(34, this.h * 0.16); }
  private fachBreite() { return (this.w - 24) / FAECHER.length; }
  private fachBei(x: number) { const i = Math.floor((x - 12) / this.fachBreite()); return i >= 0 && i < FAECHER.length ? i : -1; }
  private fachX(i: number) { return 12 + i * this.fachBreite() + this.fachBreite() / 2; }
  private fachOben() { return this.h * 0.42; }
  private fachUnten() { return this.h - 8; }

  /** Stände setzen (z. B. heutige Zahlen je Fach), ohne Animation. */
  setzeStaende(echt: number[], probe: number[]) { this.stand = [...echt]; this.probeStand = [...probe]; this.zeichne(); }

  /** Eine echte Mail kommt herein. */
  mail(fach: Fach, probe: boolean) {
    const i = FAECHER.indexOf(fach);
    if (i < 0) return;
    if (this.ruhig) { (probe ? this.probeStand : this.stand)[i]++; this.zeichne(); this.beiLandung?.(i); return; }
    this.umschlaege.push({ x: -30, y: this.bandY - 13, vx: 0, vy: 0, fach: i, phase: 'band', probe, dreh: 0, t: 0 });
    if (this.umschlaege.length > 60) this.umschlaege.splice(0, this.umschlaege.length - 60);
    this.start();
  }

  start() {
    if (this.laeuft || this.ruhig || document.hidden) { this.zeichne(); return; }
    this.laeuft = true; this.letzte = performance.now();
    const schritt = (t: number) => {
      if (!this.laeuft) return;
      const dt = Math.min(0.05, (t - this.letzte) / 1000); this.letzte = t;
      this.sim(dt); this.zeichne();
      this.raf = requestAnimationFrame(schritt);
    };
    this.raf = requestAnimationFrame(schritt);
  }
  pause() { this.laeuft = false; cancelAnimationFrame(this.raf); }

  private sim(dt: number) {
    this.bandPhase = (this.bandPhase + dt * 60) % 24;
    // Federn der Fächer (halb-implizit, feste Unterschritte → stabil)
    const n = Math.ceil(dt * 240), h = dt / n;
    for (const f of this.federn) for (let k = 0; k < n; k++) { f.v += (-f.y * 320 - f.v * 14) * h; f.y += f.v * h; }
    for (const u of this.umschlaege) {
      u.t += dt;
      if (u.phase === 'band') {
        const ziel = this.fachX(u.fach);
        u.x += 260 * dt;
        if (u.x >= ziel) { u.x = ziel; u.phase = 'fall'; u.vx = (Math.random() - 0.5) * 30; u.vy = 20; }
      } else if (u.phase === 'fall') {
        u.vy += 1400 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.dreh += u.vx * dt * 0.02;
        const fuell = this.fuellHoehe(u.fach);
        if (u.y >= this.fachUnten() - fuell - 10) {
          u.phase = 'drin';
          (u.probe ? this.probeStand : this.stand)[u.fach]++;
          this.federn[u.fach].v += 90;
          this.beiLandung?.(u.fach);
        }
      }
    }
    this.umschlaege = this.umschlaege.filter((u) => u.phase !== 'drin');
    if (!this.umschlaege.length && this.federn.every((f) => Math.abs(f.y) < 0.05 && Math.abs(f.v) < 0.05)) {
      // Ruhe: nur noch das Band läuft – mit reduzierter Bildrate
      this.bandPhase += 0;
    }
  }

  private fuellHoehe(i: number) {
    const max = Math.max(8, ...this.stand.map((s, k) => s + this.probeStand[k]));
    const innen = this.fachUnten() - this.fachOben() - 14;
    return ((this.stand[i] + this.probeStand[i]) / max) * innen * 0.9;
  }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx; c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  private umschlag(x: number, y: number, farbe: string, probe: boolean, dreh: number) {
    const c = this.ctx; const b = 26, hh = 18;
    c.save(); c.translate(x, y); c.rotate(dreh);
    this.rr(-b / 2, -hh / 2, b, hh, 4);
    if (probe) { c.lineWidth = 2; c.strokeStyle = farbe; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]); }
    else { c.fillStyle = farbe; c.fill(); }
    c.beginPath(); c.moveTo(-b / 2 + 3, -hh / 2 + 3); c.lineTo(0, 2); c.lineTo(b / 2 - 3, -hh / 2 + 3);
    c.lineWidth = 1.6; c.strokeStyle = probe ? farbe : 'rgba(0,0,0,.45)'; c.stroke();
    c.restore();
  }

  private zeichne() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const fb = this.fachBreite();
    // Förderband: Rollen + laufende Gurtsegmente
    const by = this.bandY;
    c.fillStyle = this.flaeche; this.rr(8, by - 2, this.w - 16, 12, 6); c.fill();
    c.save(); this.rr(8, by - 2, this.w - 16, 12, 6); c.clip();
    c.fillStyle = this.linie;
    for (let x = 8 - 24 + this.bandPhase; x < this.w; x += 24) c.fillRect(x, by - 2, 10, 12);
    c.restore();
    // Fächer
    for (let i = 0; i < FAECHER.length; i++) {
      const x = 12 + i * fb + 5, w = fb - 10;
      const f = this.federn[i];
      const oben = this.fachOben() + f.y * 0.25, unten = this.fachUnten();
      const farbe = this.farben[i];
      // Füllung (echte Mails voll, Probelauf schraffiert)
      const max = Math.max(8, ...this.stand.map((s, k) => s + this.probeStand[k]));
      const innen = unten - oben - 14;
      const hEcht = (this.stand[i] / max) * innen * 0.9;
      const hProbe = (this.probeStand[i] / max) * innen * 0.9;
      c.save(); this.rr(x, oben, w, unten - oben, 14); c.clip();
      c.fillStyle = farbe; c.globalAlpha = 0.16; c.fillRect(x, oben, w, unten - oben); c.globalAlpha = 1;
      // Füllung als Verlauf: unten die eigene Farbe, nach oben in die Nachbarfarbe
      const verlauf = c.createLinearGradient(0, unten, 0, unten - Math.max(hEcht, 40));
      verlauf.addColorStop(0, farbe); verlauf.addColorStop(1, this.farben[(i + 1) % this.farben.length]);
      c.fillStyle = verlauf; c.fillRect(x, unten - hEcht, w, hEcht);
      if (hProbe > 0) {
        const y0 = unten - hEcht - hProbe;
        c.save(); c.beginPath(); c.rect(x, y0, w, hProbe); c.clip();
        c.strokeStyle = farbe; c.lineWidth = 3;
        for (let s = -this.h; s < w + this.h; s += 9) { c.beginPath(); c.moveTo(x + s, y0 + hProbe); c.lineTo(x + s + hProbe, y0); c.stroke(); }
        c.restore();
      }
      c.restore();
      // Rand des Fachs, oben offen, federt
      c.strokeStyle = farbe; c.lineWidth = 3; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(x, oben); c.lineTo(x, unten - 14); c.arcTo(x, unten, x + 14, unten, 14);
      c.lineTo(x + w - 14, unten); c.arcTo(x + w, unten, x + w, unten - 14, 14); c.lineTo(x + w, oben); c.stroke();
      // Trichter-Lippe
      c.beginPath(); c.moveTo(x - 4, oben - 6); c.lineTo(x, oben); c.moveTo(x + w + 4, oben - 6); c.lineTo(x + w, oben); c.stroke();
    }
    for (const u of this.umschlaege) this.umschlag(u.x, u.y, this.farben[u.fach], u.probe, u.dreh);
  }
}
