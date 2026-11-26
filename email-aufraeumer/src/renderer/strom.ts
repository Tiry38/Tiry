// Signatur: Das Postfach als Strom durch eine Filteranlage.
// Jede echte Mail fällt als Tintentropfen durch drei Sieb-Membranen (Signale, Regeln, KI).
// Müll prallt an seiner Membran ab und wird rot in die Rinne gespült, Behaltenes setzt sich unten als Sediment ab,
// Unsicheres bleibt auf der letzten Membran liegen. Membranen sind Feder-Ketten (Masse/Steifigkeit/Dämpfung).

export type Art = 'weg' | 'bleibt' | 'pruefen';
type Stufe = 0 | 1 | 2;

interface Teilchen {
  x: number; y: number; vx: number; vy: number; r: number;
  art: Art | 'staub'; ziel: Stufe; phase: 'fall' | 'rinne' | 'liegt' | 'sediment' | 'weg';
  a: number; rot: number; durch: number; t: number; id?: number;
}

const TINTE = [0.07, 0.086, 0.114];
const AKZENT = [0.92, 0.13, 0.0];
const PAPIER = [0.957, 0.941, 0.906];
const KNOTEN = 56;

const VS = `#version 300 es
in vec2 p; in float s; in vec4 c;
uniform vec2 aufl; out vec4 farbe; out float groesse;
void main(){ vec2 q = p / aufl * 2.0 - 1.0; gl_Position = vec4(q.x, -q.y, 0.0, 1.0); gl_PointSize = s; farbe = c; groesse = s; }`;
const FS = `#version 300 es
precision highp float;
in vec4 farbe; in float groesse; uniform float punkte; uniform float zeit; out vec4 o;
// hash without sin (Dave Hoskins), stays finite on every GPU
float h(vec2 v){ vec3 p3 = fract(vec3(v.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  if (punkte < 0.5) { o = farbe; return; }
  vec2 d = gl_PointCoord - 0.5; float r = length(d);
  // ink drop: hard edge with frayed rim + grain
  float kante = 0.5 - 0.6 / max(groesse, 1.0);
  float rand = (h(floor(gl_FragCoord.xy) + floor(zeit * 6.0)) - 0.5) * 0.08;
  float m = 1.0 - smoothstep(kante - 0.06 + rand, kante + rand, r);
  float korn = 0.82 + 0.18 * h(floor(gl_FragCoord.xy * 0.7));
  o = vec4(farbe.rgb * korn, farbe.a * m);
}`;

export class Strom {
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private prog: WebGLProgram | null = null;
  private buf: WebGLBuffer | null = null;
  private loc: Record<string, any> = {};
  private teile: Teilchen[] = [];
  private membran: Array<{ d: Float32Array; v: Float32Array }> = [];
  private sediment = new Float32Array(48);
  private w = 1; private h = 1; private faktor = 1; private dpr = 1;
  private laeuft = false; private raf = 0; private letzte = 0; private zeit = 0;
  private fpsMittel = 60;
  private daten = new Float32Array(4096 * 7);
  readonly ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Wird aufgerufen, wenn ein Tropfen in der Rinne verschwindet / im Sediment ankommt (für Zähler-Puls). */
  beiAnkunft?: (art: Art) => void;

  constructor(private canvas: HTMLCanvasElement) {
    for (let i = 0; i < 3; i++) this.membran.push({ d: new Float32Array(KNOTEN), v: new Float32Array(KNOTEN) });
    const gl = new URLSearchParams(location.search).has('nur2d') ? null : canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false, alpha: true });
    if (gl && this.initGl(gl)) this.gl = gl;
    else {
      // Rückfall: frisches Canvas (auf einem WebGL-Canvas gibt es keinen 2D-Kontext mehr)
      if (gl) { const neu = canvas.cloneNode(false) as HTMLCanvasElement; canvas.replaceWith(neu); this.canvas = neu; }
      this.ctx2d = this.canvas.getContext('2d');
    }
    new ResizeObserver(() => this.groesse()).observe(this.canvas);
    this.groesse();
    for (let i = 0; i < 70; i++) this.staub(true);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.start()));
  }

  get technik() { return this.gl ? 'WebGL2' : '2D'; }

  private initGl(gl: WebGL2RenderingContext): boolean {
    const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    const p = gl.createProgram()!; gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
    this.prog = p; this.buf = gl.createBuffer();
    for (const a of ['p', 's', 'c']) this.loc[a] = gl.getAttribLocation(p, a);
    for (const u of ['aufl', 'punkte', 'zeit']) this.loc[u] = gl.getUniformLocation(p, u);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return this.probeTropfen(gl);
  }

  /** Selbsttest: zeichnet einen Probe-Tropfen und liest ihn zurück. Sieht die Grafikkarte nichts → Rückfall auf 2D. */
  private probeTropfen(gl: WebGL2RenderingContext): boolean {
    try {
      this.canvas.width = 32; this.canvas.height = 32;
      gl.viewport(0, 0, 32, 32); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.uniform2f(this.loc.aufl, 32, 32); gl.uniform1f(this.loc.zeit, 0); gl.uniform1f(this.loc.punkte, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([16, 16, 20, ...TINTE, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(this.loc.s); gl.vertexAttribPointer(this.loc.s, 1, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(this.loc.c); gl.vertexAttribPointer(this.loc.c, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.POINTS, 0, 1);
      const px = new Uint8Array(4);
      gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px[3] > 128;
    } catch { return false; }
  }

  private groesse() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.max(1, Math.min(1.5, devicePixelRatio || 1)) * this.faktor;
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.zeichne();
  }

  // Geometrie (CSS-Pixel)
  private my(i: number) { return this.h * (0.3 + i * 0.19); }
  /** Schmale Spalte (Unterseiten): Membranen über die ganze Breite, Müll verlässt das Bild nach rechts. */
  private get kompakt() { return this.w < 200; }
  private mx0() { return this.w * (this.kompakt ? 0.12 : 0.06); }
  private mx1() { return this.w * (this.kompakt ? 0.88 : 0.7); }
  private rinneX() { return this.w * (this.kompakt ? 1.4 : 0.86); }
  private boden() { return this.h * 0.965; }

  private staub(verteilt = false) {
    this.teile.push({ x: Math.random() * this.w * 0.66 + this.w * 0.05, y: verteilt ? Math.random() * this.h : -10, vx: 0, vy: 8 + Math.random() * 10,
      r: 1.2 + Math.random() * 1.2, art: 'staub', ziel: 2, phase: 'fall', a: 0.18 + Math.random() * 0.2, rot: 0, durch: 0, t: 0 });
  }

  /** Eine echte Mail kommt herein. stufe: 0 Signale, 1 Regeln, 2 KI/Schwelle. */
  mail(art: Art, stufe: Stufe = 0, id?: number) {
    const x = this.mx0() + (0.12 + Math.random() * 0.76) * (this.mx1() - this.mx0());
    const t: Teilchen = { x, y: -12, vx: 0, vy: 60 + Math.random() * 40, r: (art === 'bleibt' ? 6.5 : 6) * (this.w < 200 ? 0.6 : 1), art, ziel: art === 'pruefen' ? 2 : stufe,
      phase: 'fall', a: 1, rot: 0, durch: 0, t: 0, id };
    this.teile.push(t);
    if (this.ruhig) this.sofort(t);
    if (this.teile.length > 1400) this.teile.splice(0, this.teile.length - 1400);
    this.zeichne();
  }

  /** Liegende „Zu prüfen“-Tropfen an die tatsächliche Anzahl anpassen. */
  setzePruefen(n: number) {
    const liegend = this.teile.filter((t) => t.art === 'pruefen' && t.phase !== 'weg');
    for (let i = liegend.length; i < Math.min(n, 40); i++) this.mail('pruefen', 2);
    for (let i = n; i < liegend.length; i++) { liegend[i].phase = 'rinne'; liegend[i].art = 'weg'; liegend[i].vx = 220; liegend[i].vy = -40; }
  }

  private sofort(t: Teilchen) {
    if (t.art === 'weg') { t.phase = 'weg'; this.beiAnkunft?.('weg'); return; }
    if (t.art === 'pruefen') { t.y = this.my(2) - t.r; t.phase = 'liegt'; return; }
    this.absetzen(t);
  }

  private absetzen(t: Teilchen) {
    const bins = this.sediment.length;
    const i = Math.max(0, Math.min(bins - 1, Math.floor(((t.x - this.mx0()) / (this.mx1() - this.mx0())) * bins)));
    // Sediment flach halten: in Nachbarfach rollen, wenn das tiefer liegt
    let j = i;
    for (const k of [i - 1, i + 1]) if (k >= 0 && k < bins && this.sediment[k] < this.sediment[j] - 4) j = k;
    this.sediment[j] = Math.min(this.h * 0.12, this.sediment[j] + t.r * 0.55);
    t.x = this.mx0() + (j + 0.5) / bins * (this.mx1() - this.mx0()) + (Math.random() - 0.5) * 6;
    t.y = this.boden() - this.sediment[j];
    t.phase = 'sediment'; t.vx = t.vy = 0;
    this.beiAnkunft?.('bleibt');
    // altes Sediment verdichtet sich (bleibt flach, egal wie viele Mails kommen)
    const sed = this.teile.filter((x) => x.phase === 'sediment');
    if (sed.length > 260) { sed[0].phase = 'weg'; for (let k = 0; k < bins; k++) this.sediment[k] *= 0.985; }
  }

  private stoss(m: number, x: number, staerke: number) {
    const k = Math.round(((x - this.mx0()) / (this.mx1() - this.mx0())) * (KNOTEN - 1));
    if (k < 0 || k >= KNOTEN) return;
    this.membran[m].v[k] = Math.max(-400, Math.min(400, this.membran[m].v[k] + staerke));
  }

  start() {
    if (this.laeuft || this.ruhig) { this.zeichne(); return; }
    this.laeuft = true; this.letzte = performance.now();
    const schritt = (jetzt: number) => {
      if (!this.laeuft) return;
      const dt = Math.min(0.05, (jetzt - this.letzte) / 1000); this.letzte = jetzt;
      this.fpsMittel = this.fpsMittel * 0.97 + (1 / Math.max(dt, 0.001)) * 0.03;
      // Leistungsregler: schwacher PC → Auflösung runter
      if (this.fpsMittel < 38 && this.faktor > 0.55) { this.faktor -= 0.15; this.fpsMittel = 50; this.groesse(); }
      this.sim(dt); this.zeichne();
      this.raf = requestAnimationFrame(schritt);
    };
    this.raf = requestAnimationFrame(schritt);
  }
  pause() { this.laeuft = false; cancelAnimationFrame(this.raf); }

  private sim(dt: number) {
    this.zeit += dt;
    // Membranen: Federkette
    // feste Unterschritte (1/240 s, halb-implizit) – stabil auch bei Ruckeln oder langen Bildpausen
    const schritte = Math.ceil(dt * 240), h = dt / schritte;
    for (const m of this.membran) {
      for (let n = 0; n < schritte; n++) {
        for (let i = 1; i < KNOTEN - 1; i++) {
          const kraft = -m.d[i] * 140 + (m.d[i - 1] + m.d[i + 1] - 2 * m.d[i]) * 900 - m.v[i] * 7;
          m.v[i] += kraft * h;
        }
        for (let i = 1; i < KNOTEN - 1; i++) m.d[i] = Math.max(-28, Math.min(28, m.d[i] + m.v[i] * h));
      }
      m.d[0] = m.d[KNOTEN - 1] = 0;
    }
    const staubAnzahl = this.teile.reduce((n, t) => n + (t.art === 'staub' ? 1 : 0), 0);
    if (staubAnzahl < 70) this.staub();
    for (const t of this.teile) {
      t.t += dt;
      if (t.phase === 'sediment' || t.phase === 'weg') continue;
      if (t.phase === 'liegt') { t.x += Math.sin(this.zeit * 2 + t.x) * 0.05; t.y = this.my(2) - t.r + this.membranD(2, t.x); continue; }
      if (t.phase === 'rinne') {
        // in die Rinne gespült: nach rechts, dann nach unten, rot werden, verblassen
        t.vx += ((this.rinneX() - t.x) * 6 - t.vx * 2.2) * dt;
        t.vy += 260 * dt; t.vy *= 0.985;
        t.x += t.vx * dt; t.y += t.vy * dt;
        t.rot = Math.min(1, t.rot + dt * 3);
        if (t.y > this.h * 0.86) t.a -= dt * 1.6;
        if (t.a <= 0 || t.y > this.h + 20) { t.phase = 'weg'; if (t.art === 'weg') this.beiAnkunft?.('weg'); }
        continue;
      }
      // fallen, leichte Strömung
      const strom = Math.sin(t.y * 0.012 + this.zeit * 0.6 + t.x * 0.004) * (t.art === 'staub' ? 14 : 22);
      t.vx += (strom - t.vx) * dt * 2;
      t.vy += ((t.art === 'staub' ? 18 : 165) - t.vy) * dt * 1.5;
      const yAlt = t.y;
      t.x += t.vx * dt; t.y += t.vy * dt;
      t.x = Math.max(this.mx0() + 4, Math.min(this.mx1() - 4, t.x));
      for (let i = 0; i < 3; i++) {
        const my = this.my(i) + this.membranD(i, t.x);
        if (yAlt < my - t.r && t.y >= my - t.r) {
          if (t.art === 'staub') { if (Math.random() < 0.2) this.stoss(i, t.x, 6); continue; }
          if (t.art === 'weg' && i === t.ziel) {
            this.stoss(i, t.x, 120);
            t.y = my - t.r; t.phase = 'rinne'; t.vx = 160 + Math.random() * 80; t.vy = -70;
          } else if (t.art === 'pruefen' && i === 2) {
            this.stoss(i, t.x, 80); t.y = my - t.r; t.phase = 'liegt';
          } else {
            this.stoss(i, t.x, 45); t.durch++;
          }
        }
      }
      if (t.art === 'staub') { if (t.y > this.boden() - 4 - this.sedimentAn(t.x)) t.phase = 'weg'; continue; }
      // Müll, der seine Membran verpasst hat (Membran schwang gerade weg): trotzdem in die Rinne
      if (t.art === 'weg' && t.phase === 'fall' && t.y > this.my(t.ziel) + 24) { t.phase = 'rinne'; t.vx = 200; t.vy = -40; continue; }
      if (t.phase === 'fall' && t.y >= this.boden() - this.sedimentAn(t.x) - t.r) this.absetzen(t);
    }
    if (this.teile.length > 600) this.teile = this.teile.filter((t) => t.phase !== 'weg');
  }

  private membranD(i: number, x: number) {
    const f = ((x - this.mx0()) / (this.mx1() - this.mx0())) * (KNOTEN - 1);
    const k = Math.max(0, Math.min(KNOTEN - 2, Math.floor(f))); const u = f - k;
    const m = this.membran[i];
    return m.d[k] * (1 - u) + m.d[k + 1] * u;
  }
  private sedimentAn(x: number) {
    const i = Math.floor(((x - this.mx0()) / (this.mx1() - this.mx0())) * this.sediment.length);
    return this.sediment[Math.max(0, Math.min(this.sediment.length - 1, i))];
  }

  private zeichne() {
    if (this.gl) this.zeichneGl(); else this.zeichne2d();
  }

  private farbe(t: Teilchen): number[] {
    if (t.art === 'staub') return [...TINTE, t.a];
    const c = [0, 1, 2].map((k) => TINTE[k] * (1 - t.rot) + AKZENT[k] * t.rot);
    return [...c, t.a];
  }

  private zeichneGl() {
    const gl = this.gl!; const d = this.daten; let n = 0;
    const put = (x: number, y: number, s: number, c: number[]) => {
      if (n * 7 >= d.length) return;
      const o = n * 7; d[o] = x * this.dpr; d[o + 1] = y * this.dpr; d[o + 2] = s * this.dpr; d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = c[3]; n++;
    };
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog); gl.uniform2f(this.loc.aufl, this.canvas.width, this.canvas.height); gl.uniform1f(this.loc.zeit, this.zeit);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const attrib = () => {
      gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(this.loc.s); gl.vertexAttribPointer(this.loc.s, 1, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(this.loc.c); gl.vertexAttribPointer(this.loc.c, 4, gl.FLOAT, false, 28, 12);
    };
    // Linien: Membranen (je zwei Fäden für Gewebe-Optik), Rinne, Boden
    const strecken: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) {
      for (const versatz of [0, 0.8, 3]) {
        const start = n;
        for (let k = 0; k < KNOTEN; k++) {
          const x = this.mx0() + (k / (KNOTEN - 1)) * (this.mx1() - this.mx0());
          put(x, this.my(i) + this.membran[i].d[k] + versatz, 1, [...TINTE, versatz === 3 ? 0.3 : 0.95]);
        }
        strecken.push([start, n - start]);
      }
    }
    const rs = n;
    const rx = this.rinneX();
    const linie = (x1: number, y1: number, x2: number, y2: number, a: number) => {
      for (const o of [0, 0.8]) { put(x1 + o, y1 + o, 1, [...TINTE, a]); put(x2 + o, y2 + o, 1, [...TINTE, a]); }
    };
    void rx; // Rinnen-Wände zeichnet das HTML darüber (gestochen scharf)
    linie(this.mx0(), this.boden() + 1, this.mx1(), this.boden() + 1, 0.95);
    const re = n;
    const ps = n;
    for (const t of this.teile) {
      if (t.phase === 'weg') continue;
      const f = this.farbe(t);
      // Schweif: der Tropfen zieht eine Spur – man sieht die Strömung
      if (t.art !== 'staub' && (t.phase === 'fall' || t.phase === 'rinne') && !this.ruhig) {
        for (let k = 4; k >= 1; k--) put(t.x - t.vx * 0.016 * k, t.y - t.vy * 0.016 * k, t.r * 2 * (1 - k * 0.16), [f[0], f[1], f[2], f[3] * (0.5 - k * 0.1)]);
      }
      put(t.x, t.y, t.r * 2, f);
    }
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n * 7), gl.DYNAMIC_DRAW);
    attrib();
    gl.uniform1f(this.loc.punkte, 0);
    for (const [s, c] of strecken) gl.drawArrays(gl.LINE_STRIP, s, c);
    gl.drawArrays(gl.LINES, rs, re - rs);
    gl.uniform1f(this.loc.punkte, 1);
    gl.drawArrays(gl.POINTS, ps, n - ps);
  }

  private zeichne2d() {
    const c = this.ctx2d; if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.strokeStyle = `rgba(18,22,29,.85)`; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      for (let k = 0; k < KNOTEN; k++) { const x = this.mx0() + (k / (KNOTEN - 1)) * (this.mx1() - this.mx0()); const y = this.my(i) + this.membran[i].d[k]; k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
    c.beginPath(); c.moveTo(this.mx0(), this.boden() + 1); c.lineTo(this.mx1(), this.boden() + 1); c.stroke();
    for (const t of this.teile) {
      if (t.phase === 'weg') continue;
      const f = this.farbe(t);
      c.fillStyle = `rgba(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0},${f[3]})`;
      c.beginPath(); c.arc(t.x, t.y, t.r, 0, Math.PI * 2); c.fill();
    }
  }

  /** Positionen der Membranen in CSS-Pixeln (für die Beschriftung im HTML). */
  geometrie() { return { membranen: [0, 1, 2].map((i) => this.my(i)), rinne: this.rinneX(), mx1: this.mx1(), kompakt: this.kompakt, boden: this.boden(), breite: this.w, hoehe: this.h }; }
}

export const PAPIER_RGB = PAPIER;
