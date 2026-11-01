'use strict';
const { icon } = require('../base');

const SYMBOLS = {
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-11A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 2.9c0 6.1-8 11-8 11z" fill="currentColor"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="currentColor"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15zm0 0 7-7" fill="currentColor"/>',
  drop: '<path d="M12 2.7s7 7.5 7 12.3a7 7 0 0 1-14 0C5 10.2 12 2.7 12 2.7z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor"/>',
  note: '<path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="6.5" cy="18" r="3" fill="currentColor"/><circle cx="17.5" cy="16" r="3" fill="currentColor"/>',
  flame: '<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.3-2.2-5.5-3.6-7.6-.6 1.8-1.7 2.9-2.9 3.3.3-3-1-6.2-3.5-8.1.2 3.1-1.6 5.3-3.2 7.4C4.5 12.2 5 13.6 5 15.4 5 19.1 7.6 22 12 22z" fill="currentColor"/>'
};

module.exports = {
  id: 'memory',
  type: 'game',
  category: 'Gedächtnis',
  word: 'Pairs',
  keywords: ['gedächtnis', 'memory', 'puzzle', 'logik', 'muster', 'game', 'spiel'],
  concept(name) {
    return {
      name,
      tagline: 'Finde die Paare – entspannt und knifflig zugleich.',
      type: 'game',
      category: 'Gedächtnis',
      target_audience: 'Alle, die ihr Gedächtnis spielerisch trainieren wollen – von Pendlern bis Senioren',
      problem_or_fun: 'Ein elegantes Gedächtnisspiel mit schwebenden Bubble-Karten statt starrem Raster.',
      core_loop: 'Zwei Bubbles aufdecken → Paar merken → alle Paare finden → mit weniger Zügen den Rekord schlagen.',
      features: ['Drei Schwierigkeitsstufen', 'Schwebende Bubble-Karten mit 3D-Flip', 'Züge und Zeit messen', 'Bestwerte je Stufe', 'Entspannende Animationen'],
      screens: ['Spielfeld', 'Ergebnis'],
      retention_hook: 'Bestwerte pro Stufe laden dazu ein, sich Runde für Runde zu verbessern.',
      monetization: 'Gratis mit Einmalkauf für zusätzliche Symbol-Welten und einen Zeitrennen-Modus.',
      design_direction: 'Bubble-Karten in Wellenformation, Verlaufs-Rückseiten, weiche 3D-Flips.',
      icon_glyph: name.charAt(0),
      store_short_description: 'Gedächtnisspiel mit schwebenden Bubble-Karten, 3 Stufen und Bestwerten.',
      store_full_description: `${name} ist das Gedächtnisspiel, das sich anders anfühlt: Statt starrer Kacheln schweben runde Bubble-Karten in einer sanften Wellenformation. Decke jeweils zwei auf und finde alle passenden Paare.\n\nWähle zwischen Leicht, Mittel und Schwer. Jede Runde zählt deine Züge und die Zeit, und deine Bestwerte werden gespeichert. So siehst du, wie dein Gedächtnis immer besser wird.\n\nFunktionen:\n• Drei Schwierigkeitsstufen\n• Schwebende Bubble-Karten mit 3D-Flip\n• Züge, Zeit und Bestwerte\n• Ruhige, hochwertige Animationen\n• Offline spielbar, ohne Werbung, ohne Anmeldung\n\nTrainiere dein Gedächtnis – mit Stil.`,
      keywords: ['Memory', 'Gedächtnis', 'Paare', 'Denkspiel', 'Gehirnjogging', 'Puzzle', 'Offline Spiel']
    };
  },
  render() {
    const css = `
.levels{display:flex;gap:8px;justify-content:center;margin:4px 0 18px}
.meta{display:flex;gap:10px;justify-content:center;margin-bottom:12px}
.board{display:grid;gap:12px 10px;justify-items:center;padding:10px 4px 30px;perspective:900px}
.mc{width:100%;max-width:84px;aspect-ratio:1;border:0;background:none;padding:0;cursor:pointer;margin-top:var(--dy,0);animation:float 6s ease-in-out infinite;animation-delay:var(--delay,0s)}
.mc .in{position:relative;display:block;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.3,1.3,.5,1)}
.mc.open .in,.mc.done .in{transform:rotateY(180deg)}
.mc .face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.mc .back{background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.35),transparent 55%),var(--grad-3);box-shadow:0 14px 26px -14px var(--a1-soft),inset 0 0 0 2px rgba(255,255,255,.18)}
.mc .back::after{content:"";width:28%;height:28%;border-radius:50%;border:2px solid rgba(255,255,255,.55)}
.mc .front{transform:rotateY(180deg);background:var(--surface-strong);border:1px solid var(--border);color:var(--a1);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.mc .front svg{width:46%;height:46%;filter:drop-shadow(0 4px 10px var(--a1-soft))}
.mc.alt .front{color:var(--a2)}
.mc.done .front{background:linear-gradient(135deg,var(--a1-soft),var(--a2-soft));border-color:transparent}
.mc.done{animation:none;opacity:.88}
.mc.shake .in{animation:shake .4s}
@keyframes shake{25%{transform:rotateY(180deg) translateX(-5px)}75%{transform:rotateY(180deg) translateX(5px)}}`;
    const body = `
<header class="top"><div><div class="eyebrow">Gedächtnis-Training</div><h1 class="h1"><span class="grad-text" id="title"></span></h1></div>
<button class="icon-btn" id="restart" aria-label="Neues Spiel">${icon('reset')}</button></header>
<div class="levels" id="levels"></div>
<div class="meta"><div class="kpi"><b id="moves">0</b><span>Züge</span></div><div class="kpi"><b id="time">0:00</b><span>Zeit</span></div><div class="kpi"><b id="bestv">–</b><span>Bestwert</span></div></div>
<div class="board" id="board" aria-label="Spielfeld"></div>`;
    const script = `
var SYM = ${JSON.stringify(SYMBOLS)};
var KEYS = Object.keys(SYM);
var LEVELS = [{ id: 'easy', label: 'Leicht', pairs: 6, cols: 4 }, { id: 'mid', label: 'Mittel', pairs: 8, cols: 4 }, { id: 'hard', label: 'Schwer', pairs: 10, cols: 5 }];
var level = store.get('level', 'easy'); if (!LEVELS.some(function (l) { return l.id === level; })) level = 'easy';
var best = store.get('best', {}); if (!best || typeof best !== 'object') best = {};
var s = { cards: [], open: [], moves: 0, found: 0, start: 0, lock: false, timer: null, done: false };
function L() { return LEVELS.find(function (l) { return l.id === level; }) || LEVELS[0]; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function fmtT(ms) { var t = Math.floor(ms / 1000); return Math.floor(t / 60) + ':' + pad(t % 60); }
function newGame() {
  clearInterval(s.timer); var lv = L(); var keys = shuffle(KEYS.slice()).slice(0, lv.pairs);
  s = { cards: shuffle(keys.concat(keys)).map(function (k, i) { return { k: k, i: i, open: false, done: false }; }), open: [], moves: 0, found: 0, start: 0, lock: false, timer: null, done: false };
  var b = $('#board'); b.style.gridTemplateColumns = 'repeat(' + lv.cols + ', 1fr)';
  b.innerHTML = s.cards.map(function (c, i) { var col = i % lv.cols; var dy = col % 2 ? 22 : 0; return '<button class="mc' + (KEYS.indexOf(c.k) % 2 ? ' alt' : '') + '" data-i="' + i + '" style="--dy:' + dy + 'px;--delay:' + (-(i % 5) * 0.9) + 's" aria-label="Karte ' + (i + 1) + '"><span class="in"><span class="face back"></span><span class="face front"><svg viewBox="0 0 24 24" aria-hidden="true">' + SYM[c.k] + '</svg></span></span></button>'; }).join('');
  $('#levels').innerHTML = LEVELS.map(function (l) { return '<button class="chip' + (l.id === level ? ' on' : '') + '" data-level="' + l.id + '">' + l.label + '</button>'; }).join('');
  hud();
}
function hud() { $('#moves').textContent = s.moves; $('#time').textContent = s.start ? fmtT(Date.now() - s.start) : '0:00'; var b = best[level]; $('#bestv').textContent = b ? b.moves + ' Z.' : '–'; }
function flip(i) {
  var c = s.cards[i]; if (!c || s.lock || c.open || c.done || s.done) return;
  if (!s.start) { s.start = Date.now(); s.timer = setInterval(hud, 500); }
  c.open = true; s.open.push(c); cls(i, 'open', true); haptic(6);
  if (s.open.length < 2) return;
  s.moves++; var a = s.open[0], b = s.open[1]; s.open = []; var game = s;
  if (a.k === b.k) { a.done = b.done = true; s.found++; setTimeout(function () { if (s !== game) return; cls(a.i, 'done', true); cls(b.i, 'done', true); haptic(20); }, 250); if (s.found === L().pairs) win(); }
  else { s.lock = true; setTimeout(function () { if (s !== game) return; [a, b].forEach(function (x) { x.open = false; cls(x.i, 'shake', true); cls(x.i, 'open', false); setTimeout(function () { if (s === game) cls(x.i, 'shake', false); }, 400); }); s.lock = false; }, 750); }
  hud();
}
function el(i) { return $('[data-i="' + i + '"]'); }
function cls(i, c, on) { var e = el(i); if (e) e.classList.toggle(c, on); }
function win() {
  s.done = true; clearInterval(s.timer); var ms = Date.now() - s.start; var prev = best[level]; var rec = !prev || s.moves < prev.moves || (s.moves === prev.moves && ms < prev.ms);
  if (rec) { best[level] = { moves: s.moves, ms: ms }; store.set('best', best); }
  hud(); var game = s;
  setTimeout(function () {
    if (s !== game) return;
    openSheet('<div class="center"><div class="empty" style="padding-top:6px"><div class="orb">${icon('trophy', 40)}</div></div><h3>' + (rec ? 'Neuer Bestwert!' : 'Geschafft!') + '</h3><p class="muted">' + s.moves + ' Züge · ' + fmtT(ms) + ' · Stufe ' + L().label + '</p></div><div class="row" style="margin-top:22px"><button class="btn ghost sm grow" data-close>Schließen</button><button class="btn sm grow" data-again>Nochmal</button></div>', function (b) { $('[data-again]', b).addEventListener('click', function () { closeSheet(); newGame(); }); });
  }, 650);
}
document.addEventListener('click', function (e) {
  var c = e.target.closest ? e.target.closest('[data-i]') : null; if (c) { flip(Number(c.getAttribute('data-i'))); return; }
  var l = e.target.closest ? e.target.closest('[data-level]') : null; if (l) { level = l.getAttribute('data-level'); store.set('level', level); newGame(); }
});
$('#restart').addEventListener('click', function () { newGame(); toast('Neues Spiel – viel Erfolg!'); });
document.addEventListener('visibilitychange', function () { if (document.hidden) clearInterval(s.timer); else if (s.start && !s.done) { clearInterval(s.timer); s.timer = setInterval(hud, 500); } });
$('#title').textContent = document.title;
newGame();`;
    return { css, body, script };
  }
};
