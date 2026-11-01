'use strict';
const { icon } = require('../base');

module.exports = {
  id: 'pulse',
  type: 'game',
  category: 'Reaktion & Timing',
  word: 'Puls',
  keywords: ['reaktion', 'timing', 'rhythmus', 'arcade', 'einhand', 'game', 'spiel'],
  concept(name) {
    return {
      name,
      tagline: 'Triff den Puls im perfekten Moment.',
      type: 'game',
      category: 'Reaktion & Timing',
      target_audience: 'Gelegenheits-Gamer, Pendler und alle, die kurze, intensive Runden lieben',
      problem_or_fun: 'Ein Ein-Finger-Timing-Spiel: Ein Lichtring dehnt sich aus – tippe genau dann, wenn er die Zielzone trifft.',
      core_loop: 'Ring wächst → im richtigen Moment tippen → Perfekt/Gut → Combo steigt → Tempo zieht an → 3 Fehler = Ende.',
      features: ['Ein-Finger-Steuerung', 'Perfekt/Gut-Bewertung mit Combo-Multiplikator', 'Steigendes Tempo und wandernde Zielzone', 'Partikel-Effekte und Vibration', 'Highscore wird gespeichert'],
      screens: ['Start', 'Spiel', 'Ergebnis'],
      retention_hook: 'Nur noch eine Runde – der Highscore ist immer zum Greifen nah.',
      monetization: 'Gratis mit optionalem Einmalkauf für Farbwelten und einen Zen-Modus.',
      design_direction: 'Leuchtende Verlaufs-Ringe auf Aurora-Hintergrund, Glow und Partikel.',
      icon_glyph: name.charAt(0),
      store_short_description: 'Ein-Finger-Timing-Spiel: Triff den Lichtring im perfekten Moment!',
      store_full_description: `${name} ist das schnelle Timing-Spiel für zwischendurch. Ein leuchtender Ring dehnt sich aus – tippe genau in dem Moment, in dem er die Zielzone berührt.\n\nPerfekte Treffer bringen Extrapunkte und lassen deine Combo wachsen. Mit jedem Treffer wird das Tempo höher und die Zielzone wandert. Drei Fehlversuche, und die Runde ist vorbei. Schaffst du einen neuen Rekord?\n\nFunktionen:\n• Steuerung mit nur einem Finger\n• Perfekt/Gut-Bewertung mit Combo-Multiplikator\n• Steigendes Tempo, wandernde Zielzone\n• Glow- und Partikel-Effekte\n• Highscore, offline spielbar, keine Anmeldung\n\nEin Tipp. Ein Moment. Ein Rekord.`,
      keywords: ['Timing', 'Reaktion', 'Arcade', 'Casual Game', 'Highscore', 'Ein-Finger-Spiel', 'Offline Spiel']
    };
  },
  render() {
    const css = `
.app{padding-bottom:calc(env(safe-area-inset-bottom) + 24px)}
.hud{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.score{font-size:46px;font-weight:850;letter-spacing:-.05em;font-variant-numeric:tabular-nums;line-height:1}
.lives{display:flex;gap:6px}
.lives i{width:14px;height:14px;border-radius:50%;background:var(--grad-3);box-shadow:0 0 12px var(--a1-soft);transition:all .3s}
.lives i.off{background:var(--surface-strong);box-shadow:none;transform:scale(.7)}
.arena{position:relative;width:100%;touch-action:none;user-select:none;-webkit-user-select:none}
canvas{display:block;width:100%;height:100%;cursor:pointer}
.overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;transition:opacity .35s;isolation:isolate;background:radial-gradient(closest-side,color-mix(in srgb,var(--bg1) 82%,transparent),transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:50%}
.overlay.hide{opacity:0;pointer-events:none}
.overlay .h1{font-size:36px}
.overlay p{max-width:280px;margin:10px 0 22px}
.feedback{position:absolute;left:0;right:0;top:16%;text-align:center;font-size:24px;font-weight:850;letter-spacing:.04em;pointer-events:none;opacity:0;transition:opacity .2s,transform .4s;transform:translateY(8px)}
.feedback.on{opacity:1;transform:translateY(0)}
.best{display:inline-flex;align-items:center;gap:6px}`;
    const body = `
<header class="hud"><div><div class="eyebrow">Punkte</div><div class="score grad-text" id="score">0</div></div>
<div style="text-align:right"><div class="kpi best">${icon('trophy', 18)}<b id="best">0</b></div><div class="lives" id="lives" style="justify-content:flex-end;margin-top:10px"><i></i><i></i><i></i></div></div></header>
<div class="arena" id="arena"><canvas id="cv" aria-label="Spielfeld – tippen, wenn der Ring die Zielzone trifft"></canvas>
  <div class="feedback grad-text" id="fb"></div>
  <div class="overlay" id="start"><div class="blob"></div><div class="blob b2"></div><h1 class="h1"><span class="grad-text" id="title"></span></h1><p class="muted">Tippe, wenn der wachsende Ring genau die leuchtende Zielzone trifft. Je genauer, desto mehr Punkte.</p><button class="btn" id="go">${icon('play', 20)}Spiel starten</button></div>
  <div class="overlay hide" id="over"><div class="blob"></div><div class="eyebrow">Runde vorbei</div><div class="score grad-text" id="final" style="font-size:64px;margin:6px 0"></div><p class="muted" id="over-msg"></p><button class="btn" id="again">${icon('reset', 20)}Nochmal</button></div>
</div>
<p class="muted small center" id="combo" style="margin-top:10px">Combo x1</p>`;
    const script = `
var cv = $('#cv'); var ctx = cv.getContext('2d'); var arena = $('#arena');
var W = 0, H = 0, DPR = 1, colors = {};
var best = num(store.get('best', 0), 0, 1e9, 0);
var g = { state: 'idle', score: 0, lives: 3, combo: 1, r: 0, speed: 90, target: 0.62, tol: 0.11, last: 0, parts: [], hitFlash: 0, misses: 0 };
function readColors() { var cs = getComputedStyle(document.documentElement); ['--a1', '--a2', '--glow', '--text', '--muted', '--border'].forEach(function (k) { colors[k] = cs.getPropertyValue(k).trim() || '#ffffff'; }); }
function resize() { var w = arena.clientWidth || 360; var h = Math.max(320, Math.min(window.innerHeight * 0.66, 560)); arena.style.height = h + 'px'; DPR = Math.min(window.devicePixelRatio || 1, 3); W = w; H = h; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
function maxR() { return Math.min(W, H) * 0.44; }
function newRound() { g.r = 0; g.target = 0.42 + Math.random() * 0.45; g.tol = Math.max(0.045, 0.11 - g.score * 0.0012); }
function hud() { $('#score').textContent = g.score; $('#best').textContent = best; $$('#lives i').forEach(function (el, i) { el.classList.toggle('off', i >= g.lives); }); $('#combo').textContent = 'Combo x' + g.combo + (g.state === 'play' ? ' · Tempo ' + Math.round(g.speed) : ''); }
function feedback(t) { var f = $('#fb'); f.textContent = t; f.classList.add('on'); clearTimeout(feedback.t); feedback.t = setTimeout(function () { f.classList.remove('on'); }, 450); }
function burst(n, rad) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2; var s = 60 + Math.random() * 160; g.parts.push({ x: W / 2 + Math.cos(a) * rad, y: H / 2 + Math.sin(a) * rad, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 }); } if (g.parts.length > 260) g.parts.splice(0, g.parts.length - 260); }
function start() { readColors(); g.state = 'play'; g.score = 0; g.lives = 3; g.combo = 1; g.speed = 90; g.parts = []; newRound(); $('#start').classList.add('hide'); $('#over').classList.add('hide'); hud(); haptic(10); }
function miss(text) { g.lives--; g.combo = 1; haptic([40, 40, 40]); feedback(text); if (g.lives <= 0) return gameOver(); newRound(); hud(); }
function gameOver() { g.state = 'over'; var rec = g.score > best; if (rec) { best = g.score; store.set('best', best); } $('#final').textContent = g.score; $('#over-msg').textContent = rec ? 'Neuer Rekord! 🎉' : 'Rekord: ' + best + ' – fast!'; $('#over').classList.remove('hide'); hud(); }
function tap() {
  if (g.state !== 'play') return;
  var R = maxR(); var diff = Math.abs(g.r / R - g.target);
  if (diff <= g.tol * 0.35) { g.score += 3 * g.combo; g.combo = Math.min(9, g.combo + 1); feedback('PERFEKT'); burst(28, g.r); haptic(25); g.hitFlash = 1; }
  else if (diff <= g.tol) { g.score += 1 * g.combo; feedback('GUT'); burst(12, g.r); haptic(12); g.hitFlash = 0.6; }
  else { miss('DANEBEN'); return; }
  g.speed = Math.min(320, g.speed + 6); newRound(); hud();
}
function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  var cx = W / 2, cy = H / 2, R = maxR();
  var grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); grad.addColorStop(0, colors['--a1']); grad.addColorStop(0.5, colors['--glow']); grad.addColorStop(1, colors['--a2']);
  ctx.lineWidth = Math.max(10, g.tol * R * 2); ctx.strokeStyle = grad; ctx.globalAlpha = 0.22 + g.hitFlash * 0.4; ctx.beginPath(); ctx.arc(cx, cy, g.target * R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, g.target * R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.strokeStyle = colors['--muted']; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (g.state === 'play') { ctx.globalAlpha = 1; ctx.shadowColor = colors['--glow']; ctx.shadowBlur = 24; ctx.lineWidth = 6; ctx.strokeStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, g.r), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
  var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34); core.addColorStop(0, colors['--glow']); core.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.85; ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
  for (var i = g.parts.length - 1; i >= 0; i--) { var p = g.parts[i]; p.life -= dt * 1.6; if (p.life <= 0) { g.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = p.life; ctx.fillStyle = i % 2 ? colors['--a1'] : colors['--a2']; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 + p.life * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function frame(t) {
  var dt = g.last ? Math.min(0.05, (t - g.last) / 1000) : 0; g.last = t;
  if (g.state === 'play' && !document.hidden) { g.r += g.speed * dt; if (g.r / maxR() > g.target + g.tol) miss('ZU SPÄT'); }
  g.hitFlash = Math.max(0, g.hitFlash - dt * 2.5);
  draw(dt); requestAnimationFrame(frame);
}
cv.addEventListener('pointerdown', function (e) { e.preventDefault(); tap(); });
document.addEventListener('keydown', function (e) { if (e.code === 'Space') { e.preventDefault(); if (g.state === 'play') tap(); else start(); } });
document.addEventListener('visibilitychange', function () { g.last = 0; });
$('#go').addEventListener('click', start); $('#again').addEventListener('click', start);
window.addEventListener('resize', function () { resize(); });
$('#title').textContent = document.title;
readColors(); resize(); hud(); requestAnimationFrame(frame);`;
    return { css, body, script };
  }
};
