// Schreib-Hintergrund „Tinte im Strom“: farbige Tintenfäden in einem Strömungsfeld.
// Jeder Tastendruck schickt eine Welle von der Schreibstelle und gibt dem Strom Schwung; die Maus schiebt die Fäden weg.
// Canvas 2D mit reduzierter Auflösung → läuft auch auf schwachen PCs flüssig; pausiert, wenn unsichtbar.

interface Faden { x: number; y: number; px: number; py: number; farbe: number; leben: number }
interface Welle { x: number; y: number; r: number; farbe: number; a: number }

export class Tinte {
  private ctx: CanvasRenderingContext2D;
  private w = 1; private h = 1; private skala = 0.6;
  private faeden: Faden[] = [];
  private wellen: Welle[] = [];
  private farben: string[] = [];
  private grund = '#1d1a17';
  private energie = 0.2; private zeit = 0;
  private maus = { x: -9999, y: -9999 };
  private raf = 0; private laeuft = false; private letzte = 0;
  readonly ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    const cs = getComputedStyle(document.documentElement);
    this.farben = ['wichtig', 'benachrichtigung', 'newsletter', 'werbung', 'muell'].map((k) => cs.getPropertyValue(`--c-${k}`).trim());
    this.grund = cs.getPropertyValue('--grund').trim() || this.grund;
    new ResizeObserver(() => this.groesse()).observe(canvas);
    this.groesse();
    const anzahl = matchMedia('(max-width: 760px)').matches ? 140 : 320;
    for (let i = 0; i < anzahl; i++) this.faeden.push(this.neuerFaden(true));
    canvas.ownerDocument.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); this.maus = { x: e.clientX - r.left, y: e.clientY - r.top }; }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stopp() : this.start()));
  }

  private groesse() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(this.w * this.skala); this.canvas.height = Math.round(this.h * this.skala);
    this.ctx.setTransform(this.skala, 0, 0, this.skala, 0, 0);
    this.ctx.fillStyle = this.grund; this.ctx.fillRect(0, 0, this.w, this.h);
    if (this.ruhig) this.standbild();
  }

  private neuerFaden(verteilt = false): Faden {
    const x = Math.random() * this.w, y = verteilt ? Math.random() * this.h : (Math.random() < 0.5 ? -5 : this.h + 5);
    return { x, y, px: x, py: y, farbe: Math.floor(Math.random() * 5), leben: 200 + Math.random() * 400 };
  }

  /** Strömungsfeld: weiche Wirbel, die sich langsam verändern. */
  private winkel(x: number, y: number) {
    const t = this.zeit * 0.15;
    return Math.sin(x * 0.0032 + t) * 1.7 + Math.cos(y * 0.0041 - t * 0.8) * 1.3 + Math.sin((x + y) * 0.0017 + t * 0.5);
  }

  /** Tastendruck an Stelle (x, y) im Fenster. */
  impuls(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const fx = x - r.left, fy = y - r.top;
    const farbe = Math.floor(Math.random() * 5);
    this.wellen.push({ x: fx, y: fy, r: 4, farbe, a: 0.9 });
    if (this.wellen.length > 24) this.wellen.shift();
    this.energie = Math.min(2.2, this.energie + 0.12);
    for (let i = 0; i < 6; i++) {
      const f = this.faeden[Math.floor(Math.random() * this.faeden.length)];
      f.x = f.px = fx + (Math.random() - 0.5) * 60; f.y = f.py = fy + (Math.random() - 0.5) * 30; f.farbe = farbe; f.leben = 260;
    }
    if (this.ruhig) this.standbild();
  }

  start() {
    if (this.laeuft || this.ruhig || document.hidden) return;
    this.laeuft = true; this.letzte = performance.now();
    const schritt = (t: number) => {
      if (!this.laeuft) return;
      const dt = Math.min(0.05, (t - this.letzte) / 1000); this.letzte = t;
      this.zeichne(dt);
      this.raf = requestAnimationFrame(schritt);
    };
    this.raf = requestAnimationFrame(schritt);
  }
  stopp() { this.laeuft = false; cancelAnimationFrame(this.raf); }

  private zeichne(dt: number) {
    const c = this.ctx;
    this.zeit += dt;
    this.energie += (0.2 - this.energie) * dt * 0.6; // beruhigt sich langsam wieder
    // Nachleuchten: alte Spuren verblassen sanft
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.07; c.fillStyle = this.grund; c.fillRect(0, 0, this.w, this.h);
    c.globalAlpha = 1;
    c.lineCap = 'round';
    const tempo = 38 + this.energie * 70;
    for (const f of this.faeden) {
      f.px = f.x; f.py = f.y;
      const a = this.winkel(f.x, f.y);
      let vx = Math.cos(a) * tempo, vy = Math.sin(a) * tempo;
      // Maus schiebt weg
      const dx = f.x - this.maus.x, dy = f.y - this.maus.y, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) { const k = (1 - Math.sqrt(d2) / 140) * 260; const d = Math.sqrt(d2) || 1; vx += (dx / d) * k; vy += (dy / d) * k; }
      f.x += vx * dt; f.y += vy * dt; f.leben -= 60 * dt;
      if (f.leben <= 0 || f.x < -20 || f.x > this.w + 20 || f.y < -20 || f.y > this.h + 20) { Object.assign(f, this.neuerFaden()); continue; }
      c.strokeStyle = this.farben[f.farbe]; c.globalAlpha = 0.5 + Math.min(0.4, this.energie * 0.2);
      c.lineWidth = 1.4 + this.energie * 0.6;
      c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(f.x, f.y); c.stroke();
    }
    // Wellen vom Tippen
    for (const w of this.wellen) {
      w.r += dt * 260; w.a -= dt * 0.9;
      if (w.a <= 0) continue;
      c.globalAlpha = w.a * 0.6; c.strokeStyle = this.farben[w.farbe]; c.lineWidth = 2;
      c.beginPath(); c.arc(w.x, w.y, w.r, 0, Math.PI * 2); c.stroke();
    }
    this.wellen = this.wellen.filter((w) => w.a > 0);
    c.globalAlpha = 1;
  }

  /** Ruhige Variante (reduzierte Bewegung): ein stehendes Bild der Fäden. */
  private standbild() {
    const c = this.ctx; c.fillStyle = this.grund; c.fillRect(0, 0, this.w, this.h);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * this.w, y = Math.random() * this.h, a = this.winkel(x, y);
      c.strokeStyle = this.farben[i % 5]; c.globalAlpha = 0.35; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); c.stroke();
    }
    c.globalAlpha = 1;
  }
}
