/* AEB PRO MY2027 – Konfigurator-Film. Deterministische Engine: seek(t) setzt jedes Bild allein aus der Zeit. */
(() => {
const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || 1920, H = +Q.get('h') || 1080, CUT = Q.get('cut') || 'main';
const DPR = +Q.get('dpr') || 1;
const D = window.VDV;
const $ = s => document.querySelector(s);
const film = $('#film'); film.style.width = W + 'px'; film.style.height = H + 'px';
const cv = $('#cv'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
const g = cv.getContext('2d');
const ASP = W / H; const V = ASP < 0.8, SQ = !V && ASP < 1.3;

/* ---------- Layout ---------- */
const L = V ? {
  stage: { x: 0, y: 620, w: 1080, h: 600 }, sc: { x: 540, y: 905 }, bw: 1040,
  panel: { x: 40, y: 1250, w: 1000, h: 520 }, tabs: { x: 40, y: 1812, w: 1000 },
  hd: { x: 60, y: 170, h1: 80, small: .62 }, cap: { x: 60, y: 1080 }, price: { x: 60, y: 1190, fs: 46 }, note: { x: 60, y: 600, w: 900 },
  giant: { x: -40, y: 420, fs: 420 }, motors: 'list', top: false, concept: { x: 60, y: 1880 }
} : SQ ? {
  stage: { x: 0, y: 200, w: 1080, h: 560 }, sc: { x: 540, y: 470 }, bw: 900,
  panel: { x: 40, y: 760, w: 1000, h: 250 }, tabs: { x: 40, y: 1020, w: 1000 },
  hd: { x: 50, y: 64, h1: 70, small: .55 }, cap: { x: 50, y: 560 }, price: { x: 50, y: 690, fs: 34 }, note: { x: 50, y: 560, w: 900 },
  giant: { x: -30, y: 200, fs: 330 }, motors: 'list', top: false, concept: { x: 50, y: 1052 }
} : {
  stage: { x: 0, y: 120, w: 1240, h: 820 }, sc: { x: 640, y: 560 }, bw: 1160,
  panel: { x: 1268, y: 118, w: 600, h: 840 }, tabs: { x: 120, y: 1010, w: 1720 },
  hd: { x: 80, y: 150, h1: 118, small: .42 }, cap: { x: 80, y: 760 }, price: { x: 80, y: 930, fs: 62 }, note: { x: 760, y: 150, w: 470 },
  giant: { x: -40, y: 240, fs: 520 }, motors: 'row', top: true, concept: { x: 56, y: 1052 }
};
const IW = 3312, IH = 2032; const S0 = L.bw / IW;
if (!L.top) $('#top').style.display = 'none';
const scale = SQ ? 0.82 : 1; // Text-Skalierung im Quadrat
{ const ce = $('#concept'); ce.style.top = L.concept.y + 'px'; ce.style.fontSize = (V ? 22 : 13) + 'px'; if (!V && !SQ) { ce.style.right = '56px'; } else ce.style.left = L.concept.x + 'px'; }

/* ---------- Mathe ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
function spring(t, f = 1.4, z = 0.72) { // Sprungantwort einer gedämpften Feder
  if (t <= 0) return 0; const w = 2 * Math.PI * f;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t));
}
function track(list, t, f, z, v0) { // Überlagerung von Federsprüngen
  let v = v0 !== undefined ? v0 : (list.length ? list[0].v : 0), prev = v;
  for (const e of list) { if (e.t > t) break; v += (e.v - prev) * spring(t - e.t, e.f || f, e.z || z); prev = e.v; }
  return v;
}
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const win = (t, a, b, fi = .4, fo = .4) => clamp((t - a) / fi) * clamp((b - t) / fo);
const euro = n => Math.round(n).toLocaleString('de-DE') + ' €';
function rng(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------- Zeitplan ---------- */
const PACE = {
  full: { head: 5.2, open: 1.5, pick: 1.0, hold: 2.3, note: 3.6, tail: .9, pk: 1.45 },
  mid: { head: 2.2, open: .8, pick: .6, hold: .9, note: 0, tail: .4, pk: 0 },
  fast: { head: .7, open: .25, pick: .3, hold: .15, note: 0, tail: .2, pk: 0 },
  turbo: { head: .3, open: .1, pick: .14, hold: .06, note: 0, tail: .05, pk: 0 }
};
const CUTS = {
  main: [['intro', 9], ['model', 9.5], ['motor', 22], ...D.tabs.map((x, i) => ['tab', i, 'full']), ['summary', 13], ['outro', 10]],
  c60: [['intro', 5], ['motor', 12], ['tab', 0, 'mid'], ['tab', 1, 'mid'], ['tab', 3, 'fast'], ['tab', 4, 'fast'], ['tab', 5, 'fast'], ['tab', 6, 'fast'], ['summary', 8], ['outro', 5.5]],
  c30: [['intro', 2.2], ['motor', 5.5], ['tab', 0, 'fast'], ['tab', 1, 'fast'], ['tab', 3, 'fast'], ['tab', 4, 'fast'], ['tab', 5, 'fast'], ['tab', 6, 'fast'], ['summary', 3], ['outro', 2.8]],
  c15: [['intro', 1.2], ['motor', 2.8], ['tab', 0, 'turbo'], ['tab', 1, 'turbo'], ['tab', 3, 'turbo'], ['tab', 4, 'turbo'], ['tab', 5, 'turbo'], ['tab', 6, 'turbo'], ['summary', 2], ['outro', 2.1]]
};
const plan = CUTS[CUT];
const scenes = []; let T = 0;
const ev = { cam: [], img: [], price: [], cur: [], clicks: [], open: {}, scroll: [], tab: [], sfx: [], caps: [], notes: [], heads: [], hover: [] };
const P = id => ev.open[id] || (ev.open[id] = []);

/* Panel-Modell: alle Reiter untereinander, wie im Original */
const ROW = 60, GAP = 10, OPT = 40, GRPH = 52, PKH = 92, GRPGAP = 34;
const rows = []; // {tab, qi, id, n, opts, pk}
D.tabs.forEach((tb, ti) => tb.q.forEach((q, qi) => rows.push({ ti, qi, id: tb.id + '/' + q.n, q, appear: q.appear ? tb.id + '/' + q.appear : null })));
const visible = {}; rows.forEach(r => visible[r.id] = r.appear ? [] : null); // null = immer sichtbar
function rowH(r, open) { if (r.q.pk) return PKH; return ROW + open * (r.q.o.length * OPT + 8); }
function panelLayout(t, settled) { // y-Positionen aller Zeilen
  let y = 24; const pos = {}; let lastTi = -1;
  for (const r of rows) {
    if (r.ti !== lastTi) { if (lastTi >= 0) y += GRPGAP; pos['G' + r.ti] = y; y += GRPH; lastTi = r.ti; }
    let vis = 1; if (r.appear) vis = settled ? (ev.appearAt[r.id] <= t ? 1 : 0) : clamp(spring(t - ev.appearAt[r.id], 1.6, .9));
    if (vis <= 0.001) { pos[r.id] = { y, h: 0, vis: 0 }; continue; }
    const op = settled ? (openAt(r.id, t) > .5 ? 1 : 0) : clamp(openAt(r.id, t), 0, 1.05);
    const h = rowH(r, op) * vis; pos[r.id] = { y, h, vis, op }; y += h + GAP * vis;
  }
  pos.total = y; return pos;
}
function openAt(id, t) { return track(P(id), t, 1.5, .86, 0); }
ev.appearAt = {}; rows.forEach(r => { if (r.appear) ev.appearAt[r.id] = 1e9; });

const pan = L.panel; const PS = V ? 1.45 : 1; const PH = pan.h / PS; // Panel-Skalierung (Handy lesbar)
function optScreen(id, oi, t) { // Bildschirmposition einer Option (eingeschwungen)
  const lay = panelLayout(t, true); const sc = track(ev.scroll, t + 5, 1, .9, 0);
  return { x: pan.x + pan.w * 0.56, y: pan.y + (lay[id].y + ROW + oi * OPT + OPT / 2 + 4 - sc) * PS };
}
function headScreen(id, t, sc) { const lay = panelLayout(t, true); return { x: pan.x + pan.w - 70, y: pan.y + (lay[id].y + ROW / 2 - sc) * PS }; }

let cam0 = { cx: .5, cy: .52, z: 1 };
let curPos = { x: W * .55, y: H * .55 };
const addCur = (t, x, y) => { ev.cur.push({ t, x, y }); curPos = { x, y }; };
const click = (t, kind) => { ev.clicks.push(t); ev.sfx.push({ t, k: kind || 'tick' }); };
let price = 0, img = 0, scrollV = 0;

for (const step of plan) {
  const [kind] = step; const s = { kind, t0: T };
  if (kind === 'tab') {
    const ti = step[1], pace = PACE[step[2]], tb = D.tabs[ti]; s.ti = ti; s.pace = step[2];
    ev.tab.push({ t: T, v: ti });
    // Scroll auf Gruppe
    const lay = panelLayout(T, true); scrollV = lay['G' + ti] - 6; ev.scroll.push({ t: T, v: scrollV });
    ev.heads.push({ t: T, ti, dock: T + pace.head, pace: step[2] });
    ev.sfx.push({ t: T, k: 'tab' });
    let t = T + pace.head;
    if (tb.id === 'AUSSTATTUNGSPAKETE' && pace.pk) { // erklären, nicht wählen
      tb.q.forEach((q, i) => { const id = tb.id + '/' + q.n; const l = panelLayout(t, true); const y = pan.y + (l[id].y + 40 - scrollV) * PS;
        addCur(t, pan.x + pan.w - 120, y); ev.hover.push({ t, id, until: t + pace.pk }); ev.sfx.push({ t: t + .25, k: 'hover' }); t += pace.pk; });
      t += .6;
    }
    if (tb.id === 'AUSSTATTUNGSPAKETE' && !pace.pk) t = T + pace.head * .7;
    if (tb.infoNote && pace.note) { // Frontzubehör aufklappen, nur zeigen
      const id = tb.id + '/' + tb.q[0].n; const hp = headScreen(id, t, scrollV); addCur(t, hp.x, hp.y); click(t + .55, 'tick');
      P(id).push({ t: t + .6, v: 1 }); ev.notes.push({ t: t + 1.0, until: t + 1.0 + pace.note + .6, k: tb.infoNote[0], v: tb.infoNote[1] });
      t += 1.0 + pace.note; P(id).push({ t, v: 0 }); t += .5;
    }
    for (const c of tb.clicks) {
      const id = tb.id + '/' + c.q;
      // 1 Kopfzeile anklicken -> öffnet
      const hp = headScreen(id, t, scrollV); addCur(t, hp.x, hp.y); const tc = t + pace.open * .55; click(tc, 'tick');
      const qk = (step[2] === 'fast' || step[2] === 'turbo') ? { f: 5, z: .95 } : {};
      P(id).push({ t: tc, v: 1, ...qk });
      const lay2 = panelLayout(tc + 3, true); const rowY = lay2[id].y; const nOpt = rows.find(r => r.id === id).q.o.length;
      let target = rowY - 14; const optY = rowY + ROW + c.o * OPT;
      if (optY + OPT + 30 - target > PH) target = optY - PH * .55;
      scrollV = target; ev.scroll.push({ t: tc + .05, v: scrollV, ...qk });
      ev.cam.push({ t: tc, cx: .5, cy: .52, z: 1 });
      t += pace.open;
      // 2 Option wählen
      const op = optScreen(id, c.o, t); addCur(t, op.x, op.y); const tp = t + pace.pick * .6; click(tp, 'select');
      ev.sel = ev.sel || []; ev.sel.push({ t: tp, id, o: c.o });
      ev.img.push({ t: tp + .05, v: c.img }); ev.price.push({ t: tp + .1, v: c.price });
      ev.cam.push({ t: tp + .1, cx: c.cam[0], cy: c.cam[1], z: step[2] === 'turbo' ? 1 : (step[2] === 'fast' ? 1 + (c.cam[2] - 1) * .5 : c.cam[2]) });
      ev.sfx.push({ t: tp + .1, k: c.event === 'color' ? 'color' : 'build' });
      if (c.q === 'SCHALTUNG') { ev.appearAt[D.tabs[ti].id + '/ANTRIEB'] = tp + .3; }
      if (c.q === 'RAHMENFARBE') { ev.appearAt[D.tabs[ti].id + '/DEKOR'] = tp + .3; }
      if (c.event) ev[c.event] = tp + .1;
      t += pace.pick + pace.hold;
      ev.caps.push({ t: tp + .25, until: t + .1, k: c.q, v: c.cap, s: c.capS, fast: step[2] !== 'full' && step[2] !== 'mid' });
      if (c.note && pace.note) { ev.cam.push({ t: t - .2, cx: .5, cy: .52, z: 1 }); ev.notes.push({ t, until: t + pace.note, k: c.note[0], v: c.note[1] }); t += pace.note; }
      P(id).push({ t: t - .15, v: 0, ...qk });
    }
    t += pace.tail; ev.cam.push({ t: t - pace.tail * .8, cx: .5, cy: .52, z: 1 });
    s.dur = t - T;
  } else {
    s.dur = step[1];
    if (kind === 'model') { addCur(T + 2.6, W * .3, H * .5); }
    if (kind === 'motor') { ev.sfx.push({ t: T + .2, k: 'rise' }); }
  }
  s.t1 = T + s.dur; scenes.push(s); T += s.dur;
}
const TOTAL = T;
ev.sel = ev.sel || [];

/* Motor-, Modell-, Summary-Klicks brauchen Szenen-Zeiten */
const sc = k => scenes.find(s => s.kind === k);
const sMotor = sc('motor'), sModel = sc('model'), sIntro = sc('intro'), sSum = sc('summary'), sOut = sc('outro');
const mFast = sMotor.dur < 15;
const MT = sMotor.dur < 6 ? { rise: 0, scan: .2, nm: .1, hl: 9e9, click: sMotor.dur * .55, morph: sMotor.dur * .66, ui: sMotor.dur * .9 }
  : mFast ? { rise: 0, scan: 1.2, nm: 1.0, hl: 9e9, click: sMotor.dur * .52, morph: sMotor.dur * .62, ui: sMotor.dur * .84 }
  : { rise: 1.4, scan: 3.6, nm: 3.8, hl: 6.6, click: 15.6, morph: 16.6, ui: 19.8 };
// Bike erscheint beim Motor-Morph
ev.img.unshift({ t: 0, v: 0 }); ev.price.unshift({ t: 0, v: 4049 });
ev.sfx.push({ t: sMotor.t0 + MT.click, k: 'select' }, { t: sMotor.t0 + MT.morph, k: 'hum' }, { t: sMotor.t0 + MT.ui, k: 'ui' });
ev.clicks.push(sMotor.t0 + MT.click);
if (sModel) { ev.clicks.push(sModel.t0 + 4.3); ev.sfx.push({ t: sModel.t0 + 4.3, k: 'select' }); }
ev.sfx.push({ t: sIntro.t0 + .5, k: 'scan' }, { t: sSum.t0 + .3, k: 'sum' }, { t: sOut.t0, k: 'free' });
ev.sfx.sort((a, b) => a.t - b.t); ev.cur.sort((a, b) => a.t - b.t); ev.cam.sort((a, b) => a.t - b.t);

/* ---------- DOM aufbauen ---------- */
const pin = $('#pin'); const rowEls = {};
if (PS !== 1) { pin.style.transform = `scale(${PS})`; pin.style.transformOrigin = '0 0'; pin.style.width = (pan.w / PS) + 'px'; pin.style.right = 'auto'; }
const panel = $('#panel'); Object.assign(panel.style, { left: pan.x + 'px', top: pan.y + 'px', width: pan.w + 'px', height: pan.h + 'px' });
D.tabs.forEach((tb, ti) => { const gEl = document.createElement('div'); gEl.className = 'grp'; gEl.textContent = tb.id; gEl.id = 'G' + ti; pin.appendChild(gEl); });
for (const r of rows) {
  const el = document.createElement('div'); el.className = 'row' + (r.q.pk ? ' pk' : '');
  if (r.q.pk) el.innerHTML = `<div class="h"><span class="n">${r.q.n}</span><span class="pp">${r.q.pk}</span><span class="box"></span></div><div class="dsc">${r.q.d}</div>`;
  else el.innerHTML = `<div class="h"><span class="n">${r.q.n}</span><span class="act"></span><span class="pr"></span><span class="chev"></span></div><div class="opts">${r.q.o.map(o => `<div class="opt"><span class="mk"></span><span class="on">${o[0]}</span><span class="op">${o[1]}</span><span class="d" style="background:${o[2] === 'g' ? 'var(--ok)' : 'var(--wait)'}"></span></div>`).join('')}</div>`;
  pin.appendChild(el); rowEls[r.id] = el;
}
const tabsEl = $('#tabs'); Object.assign(tabsEl.style, { left: L.tabs.x + 'px', top: L.tabs.y + 'px', width: L.tabs.w + 'px', justifyContent: 'space-between', fontSize: (V || SQ ? 13 : 15) + 'px' });
const tabEls = D.tabs.map((tb, i) => { const e = document.createElement('span'); e.className = 't mono'; e.textContent = (V || SQ) ? (tb.short || tb.id) : tb.id; tabsEl.appendChild(e); return e; });
if (!V && !SQ) { const f = document.createElement('span'); f.className = 'fin mono'; f.textContent = 'Fertigstellen'; tabsEl.appendChild(f); }
if (V) { tabEls.forEach(e => e.style.fontSize = '11px'); }

// Motoren
const motorsEl = $('#motors'); const mEls = [];
const mLay = L.motors === 'row' ? { x0: 110, y: 330, dx: 440, disc: 170, nm: 150 } : V ? { x0: 70, y: 600, dy: 290, disc: 150, nm: 120 } : { x0: 60, y: 210, dy: 205, disc: 120, nm: 92 };
function discSVG(nm, d) {
  const ticks = []; const n = 48; const on = Math.round(n * nm / 120);
  for (let i = 0; i < n; i++) { const a = -Math.PI * .75 + i / (n - 1) * Math.PI * 1.5; const r1 = d * .47, r2 = d * (i % 4 ? .43 : .41);
    ticks.push(`<line x1="${d / 2 + Math.cos(a) * r1}" y1="${d / 2 + Math.sin(a) * r1}" x2="${d / 2 + Math.cos(a) * r2}" y2="${d / 2 + Math.sin(a) * r2}" stroke="${i < on ? '#FF6F00' : '#3C3C42'}" stroke-width="${i % 4 ? 1.2 : 2}" data-i="${i}"/>`); }
  const bolts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; bolts.push(`<circle cx="${d / 2 + Math.cos(a) * d * .27}" cy="${d / 2 + Math.sin(a) * d * .27}" r="${d * .022}" fill="#0E0E10" stroke="#55555C" stroke-width="1"/>`); }
  return `<svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}"><defs><radialGradient id="mg${nm}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#4A4A50"/><stop offset=".55" stop-color="#232327"/><stop offset="1" stop-color="#141416"/></radialGradient></defs>
  <circle cx="${d / 2}" cy="${d / 2}" r="${d * .38}" fill="url(#mg${nm})" stroke="#4E4E55" stroke-width="1.2"/>
  <circle cx="${d / 2}" cy="${d / 2}" r="${d * .31}" fill="none" stroke="#2E2E33" stroke-width="${d * .03}"/>${bolts.join('')}
  <circle cx="${d / 2}" cy="${d / 2}" r="${d * .09}" fill="#0C0C0D" stroke="#66666E" stroke-width="1.5"/><circle cx="${d / 2}" cy="${d / 2}" r="${d * .035}" fill="#FF6F00"/>
  <g class="ticks">${ticks.join('')}</g><path class="glint" d="" fill="none" stroke="#F4F1EA" stroke-width="2" stroke-linecap="round" opacity="0"/></svg>`;
}
D.motors.forEach((m, i) => {
  const e = document.createElement('div'); e.className = 'mo';
  e.innerHTML = `<div class="disc" style="width:${mLay.disc}px;height:${mLay.disc}px">${discSVG(m.nm, mLay.disc)}</div><div class="txt"><div class="mn mono">${m.model}</div><div class="mm">${m.motor}</div><div class="nm" style="font-size:${mLay.nm}px"><span class="nv">0</span><small>Nm</small></div><div class="bar"><i></i></div><div class="use">${m.use}</div><div class="mp mono">${m.price}</div></div>`;
  if (L.motors !== 'row') { e.style.display = 'flex'; e.style.gap = '28px'; e.querySelector('.txt').style.width = (V ? 760 : 820) + 'px'; e.querySelector('.nm').style.display = 'none'; e.querySelector('.mm').innerHTML = `${m.motor} <span style="color:var(--acc);font-weight:600">${m.nm} Nm</span>`; }
  else e.style.width = '380px';
  motorsEl.appendChild(e); mEls.push(e);
});
// Übersicht
const ov = $('#ov'); ov.innerHTML = `<div class="cat mono">Allround</div>` + D.overview.map((r, i) => `<div class="ovr" data-i="${i}"><span class="n">${r.n}</span>${r.s.map(x => `<span class="s">${x}</span>`).join('')}</div>`).join('') +
  `<div class="mx" style="overflow:hidden;height:0"><div class="mono" style="font-size:12px;color:var(--acc);margin:18px 0 10px">Wähle deinen Motor</div>${D.motors.map(m => `<div style="display:flex;gap:30px;height:40px;align-items:center;font-size:15px;color:var(--ink2)"><span style="width:200px;color:var(--ink)">${m.model}</span><span style="width:110px">${m.price}</span><span>Bosch ${m.motor} (max. ${m.nm} Nm)</span></div>`).join('')}</div>`;
Object.assign(ov.style, V ? { left: '60px', top: '700px' } : SQ ? { left: '50px', top: '300px', transform: 'scale(.82)', transformOrigin: '0 0' } : { left: '80px', top: '330px' });
if (V) ov.querySelectorAll('.s').forEach((e, i) => { if (i % 4 > 1) e.style.display = 'none'; });
// Summary + Outro
const sumEl = $('#sum'); const labels = ['Motor', 'Akku', 'Schaltung + Antrieb', 'Display', 'Licht', 'Farbe'];
const SS = V ? { x: 60, y: 960, m: 96, li: 28 } : SQ ? { x: 560, y: 110, m: 50, li: 20 } : { x: 1150, y: 170, m: 120, li: 30 };
sumEl.innerHTML = `<div class="l mono" style="margin:0 0 14px">Deine Konfiguration</div><div class="m" style="font-size:${SS.m}px">AEB 990CX<br>PRO</div><ul style="font-size:${SS.li}px">${D.summary.map((x, i) => `<li><span>${labels[i]}</span>${x}</li>`).join('')}</ul><div class="pr" style="font-size:${SS.m * .62}px">${euro(D.finalPrice)}</div><div class="src mono">Preis laut Konfigurator · Stand 24.11.2026 · ${D.finalKg} (± 10 %)</div>`;
Object.assign(sumEl.style, { left: SS.x + 'px', top: SS.y + 'px', width: (V ? 960 : SQ ? 440 : 680) + 'px' });
if (SQ) sumEl.querySelector('ul').style.display = 'none';
const outEl = $('#out'); const OS = V ? { x: 60, y: 300, a: 150 } : SQ ? { x: 50, y: 70, a: 96 } : { x: 80, y: 190, a: 190 };
outEl.innerHTML = `<div class="a" style="font-size:${OS.a}px">Dein<br>AEB PRO.</div><div class="b mono">Konfiguriere deins</div><div class="c">konfigurator.velo-de-ville.com</div><div class="b" style="margin-top:14px;letter-spacing:.02em;text-transform:none;font-size:18px">Probefahrt bei deinem Fachhändler. Custom Made in Germany.</div>`;
Object.assign(outEl.style, { left: OS.x + 'px', top: OS.y + 'px' });
const introEl = $('#intro'); const IS = V ? { x: 60, y: 260, fs: 250 } : SQ ? { x: 50, y: 90, fs: 170 } : { x: 80, y: 150, fs: 300 };
Object.assign(introEl.style, { left: IS.x + 'px', top: IS.y + 'px' }); introEl.querySelector('.t').style.fontSize = IS.fs + 'px';
if (V) introEl.querySelector('.u').style.flexDirection = 'column';
// Headline
const hd = $('#hd'); Object.assign(hd.style, { left: L.hd.x + 'px', top: L.hd.y + 'px', transformOrigin: '0 0' });
hd.querySelector('h1').style.fontSize = L.hd.h1 + 'px';
if (SQ) { hd.querySelector('.warum').style.fontSize = '17px'; hd.querySelector('.was b').style.fontSize = '15px'; hd.querySelector('.warum').style.maxWidth = '520px'; }
if (V) { hd.querySelector('.warum').style.maxWidth = '900px'; hd.querySelector('.warum').style.fontSize = '30px'; hd.querySelector('.was b').style.fontSize = '24px'; }
const giant = $('#giant'); Object.assign(giant.style, { left: L.giant.x + 'px', top: L.giant.y + 'px', fontSize: L.giant.fs + 'px' });
Object.assign($('#cap').style, { left: L.cap.x + 'px', top: L.cap.y + 'px' });
Object.assign($('#price').style, { left: L.price.x + 'px', top: L.price.y + 'px' }); $('#price .p').style.fontSize = L.price.fs + 'px';
Object.assign($('#note').style, { left: L.note.x + 'px', top: L.note.y + 'px', width: L.note.w + 'px' });
if (V) { $('#cap .v').style.fontSize = '40px'; $('#cap .s').style.fontSize = '22px'; $('#note .v').style.fontSize = '26px'; }

/* ---------- Bilder ---------- */
const imgs = []; const lines = {};
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
const grains = [];
async function load() {
  for (let i = 0; i < 17; i++) imgs[i] = await loadImg(`assets/bike/b${String(i).padStart(2, '0')}.webp`);
  lines[0] = await loadImg('assets/bike/line0.webp'); lines[1] = await loadImg('assets/bike/line1.webp');
  for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const d = x.createImageData(256, 256); const r = rng(77 + k * 991);
    for (let p = 0; p < d.data.length; p += 4) { const v = r() * 255; d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 255; } x.putImageData(d, 0, 0); grains.push(c); }
  await document.fonts.ready;
}
const off = document.createElement('canvas'); off.width = W * DPR; off.height = H * DPR; const og = off.getContext('2d');

/* ---------- Zeichnen ---------- */
function bikeRect(cam) { const s = S0 * cam.z; return { x: L.sc.x - cam.cx * IW * s, y: L.sc.y - cam.cy * IH * s, w: IW * s, h: IH * s }; }
function drawBike(im, r, alpha = 1) { g.globalAlpha = alpha; g.drawImage(im, r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
function lightBand(im, r, x, width, strength) { // Licht nur auf dem Rad (reaktives Licht)
  og.setTransform(DPR, 0, 0, DPR, 0, 0); og.clearRect(0, 0, W, H); og.globalCompositeOperation = 'source-over'; og.drawImage(im, r.x, r.y, r.w, r.h);
  og.globalCompositeOperation = 'source-atop'; const gr = og.createLinearGradient(x - width, 0, x + width, 0);
  gr.addColorStop(0, 'rgba(255,170,90,0)'); gr.addColorStop(.5, `rgba(255,214,170,${strength})`); gr.addColorStop(1, 'rgba(255,170,90,0)'); og.fillStyle = gr; og.fillRect(0, 0, W, H);
  og.globalCompositeOperation = 'destination-in'; og.fillStyle = gr; og.fillRect(0, 0, W, H); og.globalCompositeOperation = 'source-over';
  g.globalCompositeOperation = 'lighter'; g.drawImage(off, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
}
function reflection(im, r, floorY, a) {
  g.save(); g.beginPath(); g.rect(0, floorY, W, H - floorY); g.clip();
  g.translate(0, floorY * 2); g.scale(1, -1); g.globalAlpha = a; g.drawImage(im, r.x, r.y, r.w, r.h); g.restore(); g.globalAlpha = 1;
  const gr = g.createLinearGradient(0, floorY, 0, floorY + r.h * .35); gr.addColorStop(0, 'rgba(18,18,20,0.35)'); gr.addColorStop(1, 'rgba(18,18,20,1)');
  g.fillStyle = gr; g.fillRect(0, floorY, W, H - floorY);
}

function seek(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  const fi = Math.round(t * 60);
  const S = scenes.find(s => t >= s.t0 && t < s.t1) || scenes[scenes.length - 1]; const lt = t - S.t0;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  // Grund
  g.fillStyle = '#121214'; g.fillRect(0, 0, W, H);
  // Kamera
  let cam = { cx: track(ev.cam.map(e => ({ t: e.t, v: e.cx })), t, .55, .92, .5), cy: track(ev.cam.map(e => ({ t: e.t, v: e.cy })), t, .55, .92, .52), z: track(ev.cam.map(e => ({ t: e.t, v: e.z })), t, .55, .92, 1) };
  cam.cx += Math.sin(t * .23) * .006; cam.cy += Math.cos(t * .17) * .004; cam.z *= 1 + Math.sin(t * .11) * .006;
  // Szenen-Verschiebungen
  const inSum = S.kind === 'summary' || S.kind === 'outro';
  const sumK = clamp(spring(t - sSum.t0, .5, .95));
  let shiftX = 0, shiftY = 0;
  if (!V && !SQ) shiftX = -sumK * 120; if (V) shiftY = -sumK * 300; else if (V) shiftY = -sumK * 0;
  if (S.kind === 'summary') { cam.z *= 1 + lt * .004; }
  const outK = clamp(spring(t - sOut.t0, .5, .95));
  const outK0 = clamp(spring(t - sOut.t0, .5, .95)); if (!V && !SQ) shiftX += outK0 * 640; if (V) shiftY += outK0 * 380; if (SQ) shiftY += outK0 * 140;
  const r = bikeRect(cam); r.x += shiftX; r.y += shiftY;
  if (SQ && inSum) { r.x -= sumK * 200; }
  const floorY = r.y + r.h * .955;
  // Lichtkegel/Showroom-Boden
  const showBike = t >= sMotor.t0 + MT.morph - .1;
  const spotA = S.kind === 'intro' ? clamp((lt - 1) / 3) * .8 : 1;
  const cx = r.x + r.w * .5, cy = floorY - r.h * .35;
  let warm = ev.color ? clamp(spring(t - ev.color, .45, .9)) : 0;
  const sp = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(r.w * .75, 300));
  sp.addColorStop(0, `rgba(${46 + warm * 14},${45 + warm * 8},${48 - warm * 6},${spotA})`); sp.addColorStop(1, 'rgba(18,18,20,0)');
  g.fillStyle = sp; g.fillRect(0, 0, W, H);
  // Boden-Linie
  const fl = g.createLinearGradient(r.x - r.w * .2, 0, r.x + r.w * 1.2, 0); fl.addColorStop(0, 'rgba(60,60,66,0)'); fl.addColorStop(.5, `rgba(70,70,78,${.6 * spotA})`); fl.addColorStop(1, 'rgba(60,60,66,0)');
  g.fillStyle = fl; g.fillRect(r.x - r.w * .2, floorY, r.w * 1.4, 1);

  // Bild-Wechsel
  const imL = ev.img; let cur = 0, prevI = 0, tch = -9; for (const e of imL) { if (e.t <= t) { prevI = cur; cur = e.v; tch = e.t; } }
  let nxt = 9e9; for (const e of imL) if (e.t > tch + 1e-6) { nxt = e.t; break; } const wd = clamp((nxt - tch) * .9, .2, .95); const wp = clamp((t - tch) / wd); const wx = r.x - r.w * .05 + ease(wp) * r.w * 1.1;

  // Intro: Licht-Linie zeichnet das Rad
  if (S.kind === 'intro') {
    const p = clamp((lt - S.dur * .07) / (S.dur * .42)); const sx = lerp(-50, W + 50, ease(p));
    const fade = clamp((S.dur - lt) / (S.dur * .2));
    g.save(); g.beginPath(); g.rect(0, 0, sx, H); g.clip(); g.globalAlpha = .55 * fade; g.drawImage(lines[0], r.x, r.y, r.w, r.h); g.restore(); g.globalAlpha = 1;
    if (p > 0 && p < 1) { const lg = g.createLinearGradient(sx - 3, 0, sx + 3, 0); lg.addColorStop(0, 'rgba(255,111,0,0)'); lg.addColorStop(.5, 'rgba(255,190,130,.95)'); lg.addColorStop(1, 'rgba(255,111,0,0)'); g.fillStyle = lg; g.fillRect(sx - 3, r.y - 40, 6, r.h + 80); }
  }
  if (S.kind === 'model') { g.globalAlpha = .18 * clamp(lt / .6) * clamp((S.dur - lt) / .8); g.drawImage(lines[0], r.x + (V ? 0 : r.w * .25), r.y, r.w, r.h); g.globalAlpha = 1; }

  if (showBike) {
    const mt = t - (sMotor.t0 + MT.morph); // Aufbau aus Licht, vom Motor aus
    const bx = r.x + r.w * .455, by = r.y + r.h * .765; const R = Math.hypot(r.w, r.h);
    const rad1 = clamp(mt / (mFast ? 1.0 : 1.6)) , rad2 = clamp((mt - (mFast ? .3 : .6)) / (mFast ? 1.0 : 1.6));
    const outFade = 1 - outK * .85;
    if (rad2 < 1) { g.save(); g.beginPath(); g.arc(bx, by, ease(rad1) * R, 0, 7); g.clip(); g.globalAlpha = .7; g.drawImage(lines[0], r.x, r.y, r.w, r.h); g.restore(); g.globalAlpha = 1; }
    g.save(); g.beginPath(); g.arc(bx, by, ease(rad2) * R + 1, 0, 7); g.clip();
    reflection(imgs[cur], r, floorY, .16 * outFade);
    if (wp < 1) { // altes Bild rechts, neues Bild links der Lichtkante
      g.save(); g.beginPath(); g.rect(wx, 0, W, H); g.clip(); drawBike(imgs[prevI], r, outFade); g.restore();
      g.save(); g.beginPath(); g.rect(0, 0, wx, H); g.clip(); drawBike(imgs[cur], r, outFade); g.restore();
      lightBand(imgs[cur], r, wx, r.w * .06, .75 * (1 - wp * .3));
    } else drawBike(imgs[cur], r, outFade);
    // Farb-Ereignis: Lichtflut über das Rad
    if (ev.color && t > ev.color && t < ev.color + 2.2) { const k = (t - ev.color) / 2.2; lightBand(imgs[cur], r, r.x + r.w * (-.2 + k * 1.4), r.w * .25, .55 * (1 - k)); }
    // Fernlicht-Ereignis
    if (ev.beam && t > ev.beam && t < ev.beam + 3.2) { const k = (t - ev.beam); const a = clamp(k / .25) * clamp((3.2 - k) / .8);
      const hx = r.x + r.w * .735, hy = r.y + r.h * .37; const bg2 = g.createRadialGradient(hx, hy, 2, hx, hy, r.w * .9);
      bg2.addColorStop(0, `rgba(255,248,230,${.55 * a})`); bg2.addColorStop(.25, `rgba(255,240,210,${.12 * a})`); bg2.addColorStop(1, 'rgba(255,240,210,0)');
      g.save(); g.beginPath(); g.moveTo(hx, hy); g.lineTo(W * 2, hy - r.h * .5); g.lineTo(W * 2, hy + r.h * 1.2); g.closePath(); g.fillStyle = bg2; g.fill(); g.restore(); }
    // Summary-Lichtlauf
    if (S.kind === 'summary' && lt > .8 && lt < 3.6) { const k = (lt - .8) / 2.8; lightBand(imgs[cur], r, r.x + r.w * (-.1 + k * 1.2), r.w * .08, .5); }
    g.restore();
    if (outK > 0) { g.globalAlpha = outK * .8; g.drawImage(lines[1], r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
  }
  { const tg = g.createLinearGradient(0, 0, 0, 150); tg.addColorStop(0, 'rgba(18,18,20,.92)'); tg.addColorStop(1, 'rgba(18,18,20,0)'); g.fillStyle = tg; g.fillRect(0, 0, W, 150);
    if (!V) { const bg3 = g.createLinearGradient(0, H * .62, 0, H); bg3.addColorStop(0, 'rgba(18,18,20,0)'); bg3.addColorStop(1, 'rgba(18,18,20,.92)'); g.fillStyle = bg3; g.fillRect(0, H * .62, W * .7, H * .38); } }
  // Vignette + Grain (Material)
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.globalAlpha = .045; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grains[fi % 6], 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.globalAlpha = .028; g.fillRect(0, 0, W, H); g.globalAlpha = 1;

  /* ----- DOM ----- */
  // Parallaxe: Ebenen folgen der Kamera unterschiedlich stark
  const px = (cam.cx - .5) * 60, py = (cam.cy - .52) * 40;
  $('#Lback').style.transform = `translate(${-px * .5}px,${-py * .5}px)`;
  // Intro
  { const a = S.kind === 'intro' ? clamp((lt - S.dur * .3) / .01) : 0; const rv = S.kind === 'intro' ? clamp((lt - S.dur * .3) / (S.dur * .25)) : 0; const o = S.kind === 'intro' ? clamp((S.dur - lt) / (S.dur * .12)) : 0;
    introEl.style.opacity = a * o; introEl.querySelector('.t').style.clipPath = `inset(0 ${100 - ease(rv) * 100}% 0 0)`; introEl.querySelector('.u').style.clipPath = `inset(0 ${100 - ease(clamp(rv * 1.3 - .3)) * 100}% 0 0)`;
    introEl.style.transform = `translateX(${-lt * 4}px)`; }
  // Übersicht
  ov.style.display = 'none'; if (sModel) { const on = S.kind === 'model'; ov.style.display = on ? 'block' : 'none';
    if (on) { const k = clamp(spring(lt - 4.4, 1.1, .85)); ov.querySelector('.mx').style.height = (k * 230) + 'px';
      ov.querySelectorAll('.ovr').forEach((e, i) => { const rv = clamp((lt - 2.9 - i * .12) / .5); e.style.clipPath = `inset(0 ${100 - ease(rv) * 100}% 0 0)`; e.style.opacity = i === 0 ? 1 : 1 - k * .7; });
      ov.style.opacity = clamp((S.dur - lt) / .5); } }
  // Motoren
  { const on = S.kind === 'motor'; motorsEl.style.display = on ? 'block' : 'none';
    if (on) {
      const tClick = MT.click, tm = MT.morph; const lead = Math.min(.9, tm - tClick - .05);
      mEls.forEach((e, i) => {
        const rf = sMotor.dur < 6 ? 2.6 : mFast ? 1.6 : .9; const rise = clamp(spring(lt - MT.rise - i * (sMotor.dur < 6 ? .1 : .22), rf, L.motors === 'row' ? .42 : .7), -.2, 1.3);
        const fall = i < 3 ? clamp(spring(lt - tClick - .15 - i * .06, .8, .9)) : 0;
        const zd = L.motors === 'row' ? 1600 : 500; const z = lerp(-zd, 0, rise) - fall * zd * .9, rx = lerp(38, 0, clamp(rise));
        let x, y;
        if (L.motors === 'row') { x = mLay.x0 + i * mLay.dx; y = mLay.y; } else { x = mLay.x0; y = mLay.y + i * mLay.dy; }
        let tr = `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg)`;
        e.style.opacity = clamp(rise * 1.5) * (1 - fall);
        // CX morpht in den Rahmen
        const disc = e.querySelector('.disc'), txt = e.querySelector('.txt');
        if (i === 3 && lt > tm - lead) { const k = ease(clamp((lt - tm + lead) / (lead + .1)));
          const bx = L.sc.x - (.5 - .455) * IW * S0, by = L.sc.y + (.765 - .52) * IH * S0; const d = mLay.disc;
          const tx = bx - d / 2 - x, ty = by - d / 2 - y; const sTarget = (IW * S0 * .062) / (d * .76);
          disc.style.transform = `translate(${tx * k}px,${ty * k}px) scale(${lerp(1, sTarget, k)})`; disc.style.transformOrigin = '50% 50%';
          disc.style.opacity = 1 - clamp((lt - tm - .15) / .5); txt.style.opacity = 1 - k * 1.5;
        } else { disc.style.transform = ''; disc.style.opacity = 1; txt.style.opacity = 1; }
        e.style.transform = tr;
        // Drehmoment-Skala
        const nk = clamp(spring(lt - MT.nm - i * .25, .7, .95)); e.querySelector('.nv').textContent = Math.round(m(i) * nk);
        e.querySelector('.bar i').style.width = (nk * m(i) / 120 * 100) + '%';
        e.querySelectorAll('.ticks line').forEach((l, j) => { l.style.opacity = j / 48 < nk ? 1 : .25; });
        // Scan-Licht
        const sx = lerp(-200, W + 200, clamp((lt - MT.scan) / 1.6)); const dx = Math.abs(sx - (x + mLay.disc / 2));
        e.querySelector('.glint').setAttribute('opacity', clamp(1 - dx / 120) * .9);
        const d = mLay.disc; const a0 = -2.3 + clamp((lt - MT.scan) / 1.6) * 2; e.querySelector('.glint').setAttribute('d', `M ${d / 2 + Math.cos(a0) * d * .38} ${d / 2 + Math.sin(a0) * d * .38} A ${d * .38} ${d * .38} 0 0 1 ${d / 2 + Math.cos(a0 + .9) * d * .38} ${d / 2 + Math.sin(a0 + .9) * d * .38}`);
        // nacheinander hervorheben
        const hl = MT.hl + i * 2.2; const isH = lt > hl && lt < hl + 2.2;
        const dim = (lt > MT.hl && lt < MT.hl + 8.8 && !isH) ? .45 : 1;
        txt.style.filter = ''; e.querySelector('.use').style.color = isH ? 'var(--ink)' : ''; e.querySelector('.txt').style.opacity = (i === 3 && lt > tm - lead) ? txt.style.opacity : dim;
      });
      // Scan-Linie
      const sp2 = clamp((lt - MT.scan) / 1.6); if (sp2 > 0 && sp2 < 1) { const sx = lerp(-200, W + 200, sp2); g.fillStyle = 'rgba(255,200,150,.55)'; g.fillRect(sx, (L.motors === 'row' ? mLay.y - 60 : mLay.y - 40), 1.5, L.motors === 'row' ? 720 : mLay.dy * 4 + 40); }
    } }
  function m(i) { return D.motors[i].nm; }

  // Headline-Block
  { let hs = null; for (const h of ev.heads) if (h.t <= t) hs = h;
    let txt = '', tag = '', was = '', warum = '', rev = 0, dockK = 0, a = 0, gi = '';
    if (S.kind === 'motor' && !mFast) { txt = 'Vier Motoren. Deine Kraft.'; tag = 'Motorstufe · 4 Optionen'; was = 'Motor · Drehmoment · Einsatzzweck'; warum = 'Das Drehmoment bestimmt, wie souverän du anfährst, kletterst und Gepäck ziehst.';
      rev = clamp((lt - .2) / .9); dockK = clamp(spring(lt - 1.5, .8, .9)); a = clamp((MT.ui - lt) / .5); gi = 'Nm'; }
    else if (S.kind === 'model') { txt = 'Allround. Neu gedacht.'; tag = 'Modell · AEB PRO MY2027'; was = 'Modellreihe · Motorstufe'; warum = 'Ein Rahmen, vier Motoren: Du wählst die Kraft, die zu deinen Wegen passt.'; rev = clamp((lt - .2) / 1.0); dockK = clamp(spring(lt - 2.6, .8, .9)); a = clamp((S.dur - lt) / .4); gi = 'AEB'; }
    else if (S.kind === 'tab' && hs) { const tb = D.tabs[hs.ti]; txt = tb.head; tag = `${String(hs.ti + 1).padStart(2, '0')} / 07 · ${tb.id}`; was = tb.was; warum = tb.warum;
      const lh = t - hs.t; rev = clamp((lh - .15) / (hs.pace === 'turbo' ? .25 : hs.pace === 'fast' ? .4 : .9)); dockK = clamp(spring(t - hs.dock, .8, .9)); a = 1; gi = tb.short || tb.id;
      if (hs.pace !== 'full' && hs.pace !== 'mid') { was = ''; warum = ''; } }
    if (S.kind === 'summary' || S.kind === 'outro' || S.kind === 'intro') a = 0;
    hd.style.opacity = a; hd.querySelector('.tag span').textContent = tag; hd.querySelector('.tx').textContent = txt;
    hd.querySelector('.was b').textContent = was; hd.querySelector('.warum em').textContent = warum;
    hd.querySelector('.was').style.display = was ? '' : 'none'; hd.querySelector('.warum').style.display = warum ? '' : 'none';
    const h1 = hd.querySelector('h1'); h1.style.clipPath = `inset(-10% ${100 - ease(rev) * 100}% -10% 0)`;
    hd.querySelector('.scan').style.left = (ease(rev) * 100) + '%'; hd.querySelector('.scan').style.opacity = rev > 0 && rev < 1 ? 1 : 0;
    const rv2 = ease(clamp(rev * 1.6 - .6)); hd.querySelector('.was').style.clipPath = `inset(0 ${100 - rv2 * 100}% 0 0)`; hd.querySelector('.warum').style.clipPath = `inset(0 ${100 - ease(clamp(rev * 1.6 - .9)) * 100}% 0 0)`;
    const sm = lerp(1, L.hd.small, dockK); hd.style.transform = `translate(${-px * .2}px,${-dockK * (V ? 60 : 50) - py * .2}px) scale(${sm})`;
    hd.querySelector('.was').style.opacity = 1 - dockK * 1.3; hd.querySelector('.warum').style.opacity = 1 - dockK * 1.3;
    giant.textContent = gi; giant.style.opacity = a * .9 * (1 - (S.kind === 'motor' ? clamp((lt - 1) / 1) : 0)); }

  // Konfigurator-UI ein
  const uiOn = t >= sMotor.t0 + MT.ui - .2 && !(t > sSum.t0 + .1);
  const uiK = clamp(spring(t - (sMotor.t0 + MT.ui), .9, .82)) * (1 - clamp((t - sSum.t0 + .45) / .4));
  panel.style.transform = `translateX(${(1 - uiK) * (V || SQ ? 0 : 680)}px) translateY(${(1 - uiK) * (V || SQ ? 600 : 0)}px)`; panel.style.opacity = clamp(uiK * 3);
  tabsEl.style.opacity = uiK; $('#uline').style.opacity = uiK; $('#top').style.opacity = clamp(uiK * 1.5) * (L.top ? 1 : 0);
  $('#price').style.opacity = uiOn ? uiK : 0;
  // Panel-Inhalt
  { const lay = panelLayout(t, false); const scr = track(ev.scroll, t, 1.0, .9, 0);
    D.tabs.forEach((tb, ti) => { const e = document.getElementById('G' + ti); e.style.transform = `translateY(${lay['G' + ti] - scr + 14}px)`; });
    let selNow = {}; for (const s of ev.sel) if (s.t <= t) selNow[s.id] = s;
    for (const rr of rows) { const e = rowEls[rr.id]; const p = lay[rr.id];
      e.style.transform = `translateY(${p.y - scr}px)`; e.style.height = p.h + 'px'; e.style.opacity = p.vis;
      if (rr.q.pk) { let hov = 0; for (const h of ev.hover) if (h.id === rr.id && t >= h.t && t < h.until + .2) hov = clamp((t - h.t) / .3) * clamp((h.until + .2 - t) / .3);
        e.style.boxShadow = hov ? `inset 2px 0 0 rgba(255,111,0,${hov})` : 'none'; e.style.background = hov ? '#26262B' : ''; continue; }
      const sel = selNow[rr.id] ? selNow[rr.id].o : rr.q.a; const o = rr.q.o[sel];
      e.querySelector('.act').textContent = o[0]; e.querySelector('.pr').textContent = o[1];
      e.querySelector('.chev').style.transform = `rotate(${45 + 180 * clamp(p.op || 0)}deg) translateY(-3px)`;
      const opts = e.querySelectorAll('.opt'); opts.forEach((oe, oi) => oe.classList.toggle('sel', oi === sel));
      const fl = selNow[rr.id] ? clamp(1 - (t - selNow[rr.id].t) / .6) : 0; if (fl > 0) opts[sel].style.background = `rgba(255,111,0,${fl * .18})`; else opts[sel].style.background = '';
    } }
  // Reiter-Linie (Feder)
  { const ti = track(ev.tab, t, 1.1, .7, 0); const i0 = Math.floor(clamp(ti, 0, 6)), i1 = Math.min(6, i0 + 1), k = ti - i0;
    const r0 = tabEls[i0], r1 = tabEls[i1]; const x0 = r0.offsetLeft, x1 = r1.offsetLeft, w0 = r0.offsetWidth, w1 = r1.offsetWidth;
    const ul = $('#uline'); Object.assign(ul.style, { left: (L.tabs.x + lerp(x0, x1, k)) + 'px', top: (L.tabs.y + r0.offsetHeight + 8) + 'px', width: lerp(w0, w1, k) + 'px' });
    const act = Math.round(clamp(ti, 0, 6)); tabEls.forEach((e, i) => e.style.color = i === act ? 'var(--acc)' : ''); }
  // Preis
  { const pv = track(ev.price, t, 1.2, 1, 4049); $('#price .p').textContent = euro(pv); $('#price .kg').textContent = 'AEB 990CX PRO'; }
  // Bauteil-Text
  { let c = null; for (const x of ev.caps) if (t >= x.t && t < x.until) c = x; const ce = $('#cap');
    if (c && !(c.fast && V === false && false)) { const k = clamp((t - c.t) / .35); const o = clamp((c.until - t) / .2);
      ce.querySelector('.k').textContent = c.k; ce.querySelector('.v').textContent = c.v; ce.querySelector('.s').textContent = c.s;
      ce.style.clipPath = `inset(-20% ${100 - ease(k) * 100}% -20% 0)`; ce.style.opacity = o; } else ce.style.opacity = 0; }
  // Hinweis (erklären statt wählen)
  { let n = null; for (const x of ev.notes) if (t >= x.t && t < x.until) n = x; const ne = $('#note');
    if (n) { const k = clamp((t - n.t) / .5); ne.querySelector('.k').textContent = n.k; ne.querySelector('.v').textContent = n.v; ne.style.clipPath = `inset(-10% ${100 - ease(k) * 100}% -10% 0)`; ne.style.opacity = clamp((n.until - t) / .3); } else ne.style.opacity = 0; }
  // Summary / Outro
  { const on = S.kind === 'summary'; sumEl.style.display = on ? 'block' : 'none';
    if (on) { const f = Math.min(1, S.dur / 8); const ch = sumEl.children; for (let i = 0; i < ch.length; i++) { const k = clamp((lt - (.5 + i * .25) * f) / (.6 * f)); ch[i].style.clipPath = `inset(-10% ${100 - ease(k) * 100}% -10% 0)`; }
      sumEl.querySelectorAll('li').forEach((li, i) => { const f = Math.min(1, S.dur / 8); const k = clamp((lt - (1.2 + i * .18) * f) / (.45 * f)); li.style.clipPath = `inset(-10% ${100 - ease(k) * 100}% -10% 0)`; });
      sumEl.style.opacity = clamp((S.dur - lt) / .5); }
    const o2 = S.kind === 'outro'; outEl.style.display = o2 ? 'block' : 'none';
    if (o2) { const f = Math.min(1, S.dur / 6); const ch = outEl.children; for (let i = 0; i < ch.length; i++) { const k = clamp((lt - (.3 + i * .35) * f) / (.6 * f)); ch[i].style.clipPath = `inset(-10% ${100 - ease(k) * 100}% -10% 0)`; } } }
  $('#concept').style.opacity = 1;
  // Cursor
  { const cx2 = track(ev.cur.map(e => ({ t: e.t, v: e.x })), t, 1.5, .8, W * .55), cy2 = track(ev.cur.map(e => ({ t: e.t, v: e.y })), t, 1.5, .8, H * .6);
    const curOn = (S.kind === 'model' && lt > 2) || (S.kind === 'motor' && lt > MT.hl - 1 && lt < MT.click + .8) || (S.kind === 'tab' && !(scenes.find(s => s === S).pace === 'turbo'));
    let mx = cx2, my = cy2;
    if (S.kind === 'motor') { const hlI = clamp(Math.floor((lt - MT.hl) / 2.2), 0, 3); const tgt = lt > MT.click - 1.2 ? 3 : hlI; const ex = L.motors === 'row' ? mLay.x0 + tgt * mLay.dx + mLay.disc / 2 : mLay.x0 + mLay.disc / 2; const ey = L.motors === 'row' ? mLay.y + mLay.disc / 2 : mLay.y + tgt * mLay.dy + mLay.disc / 2; mx = ex + 20; my = ey + 10; }
    if (S.kind === 'model') { mx = (V ? 60 : 80) + 160; my = parseFloat(ov.style.top) + 70; if (SQ) { mx = 180; my = 360; } }
    const ce = $('#cur'); ce.style.opacity = curOn ? 1 : 0; ce.style.transform = `translate(${mx}px,${my}px)`;
    let last = -9; for (const c of ev.clicks) if (c <= t) last = c; const ck = t - last;
    const press = ck < .25 ? Math.sin(ck / .25 * Math.PI) : 0; ce.querySelector('.ring').style.transform = `scale(${1 - press * .35})`;
    const rip = ce.querySelector('.rip'); if (ck < .7) { const rr = 13 + ck / .7 * 46; Object.assign(rip.style, { width: rr * 2 + 'px', height: rr * 2 + 'px', left: -rr + 'px', top: -rr + 'px', opacity: 1 - ck / .7 }); } else rip.style.opacity = 0;
    // sanfter Zoom auf die Klickstelle
    const zk = ck < 1.1 ? Math.sin(clamp(ck / 1.1) * Math.PI) * .035 : 0;
    $('#Lui').style.transformOrigin = `${mx}px ${my}px`; $('#Lui').style.transform = `scale(${1 + zk})`; }
}

window.__film = { W, H, TOTAL, scenes, ev, seek, ready: load().then(() => { seek(0); return true; }) };
})();
