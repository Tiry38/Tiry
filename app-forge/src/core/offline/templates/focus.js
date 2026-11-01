'use strict';
const { icon } = require('../base');

module.exports = {
  id: 'focus',
  type: 'tool',
  category: 'Produktivität & Fokus',
  word: 'Fokus',
  keywords: ['produktiv', 'fokus', 'lernen', 'arbeit', 'konzentration', 'business'],
  concept(name) {
    return {
      name,
      tagline: 'Tiefe Konzentration in klaren Sessions.',
      type: 'tool',
      category: 'Produktivität & Fokus',
      target_audience: 'Studierende, Homeoffice-Arbeitende und alle, die sich leicht ablenken lassen',
      problem_or_fun: 'Ablenkung frisst Stunden. Feste Fokus-Sessions mit Pausen machen Arbeit planbar und messbar.',
      core_loop: 'Aufgabe eintippen → Session starten → Ring läuft ab → Pause → Fokus-Minuten wachsen in der Statistik.',
      features: ['Pomodoro-Vorlagen 25/5, 50/10, 15/3', 'Animierter Fortschrittsring', 'Aufgabenname pro Session', 'Sanfter Signalton und Vibration', 'Tages- und Wochenstatistik'],
      screens: ['Timer', 'Statistik'],
      retention_hook: 'Die tägliche Fokus-Zeit sichtbar wachsen sehen motiviert zur nächsten Session.',
      monetization: 'Pro-Einmalkauf: eigene Zeiten, Fokus-Klänge, detaillierte Monatsstatistik.',
      design_direction: 'Großer leuchtender Ring im Zentrum, ruhige Verläufe, klare Ziffern.',
      icon_glyph: name.charAt(0),
      store_short_description: 'Pomodoro-Timer mit schönem Fokus-Ring und Statistik – ohne Ablenkung.',
      store_full_description: `${name} bringt dich in den Flow. Wähle eine Session-Länge, gib deiner Aufgabe einen Namen und starte – der leuchtende Ring zeigt dir, wie viel Fokus-Zeit noch bleibt.\n\nNach jeder Session folgt automatisch eine kurze Pause, damit du frisch bleibst. Ein sanfter Ton und eine kurze Vibration sagen dir Bescheid.\n\nFunktionen:\n• Vorlagen 25/5, 50/10 und 15/3 Minuten\n• Aufgabenname pro Session\n• Fokus-Minuten heute und in den letzten 7 Tagen\n• Session-Zähler und Tagesziel\n• Komplett offline, keine Werbung, keine Anmeldung\n\nWeniger Ablenkung, mehr geschafft.`,
      keywords: ['Pomodoro', 'Fokus', 'Timer', 'Konzentration', 'Lernen', 'Produktivität', 'Deep Work']
    };
  },
  render() {
    const css = `
.timer{padding-top:18px}
.time{font-size:56px;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1}
.mode{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:8px}
.controls{display:flex;gap:14px;align-items:center;margin-top:22px}
.play{width:76px;height:76px;border-radius:50%;padding:0}
.presets{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px}
.glow-ring{filter:drop-shadow(0 0 22px var(--a1-soft))}
.goal{padding:18px 22px;border-radius:999px;background:var(--surface);border:1px solid var(--border);backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur))}
.hist{display:flex;align-items:center;gap:12px}`;
    const body = `
<header class="top"><div><div class="eyebrow">Fokus-Studio</div><h1 class="h1"><span class="grad-text" id="title"></span></h1></div>
<div class="kpi"><b id="today-min">0</b><span>Min. heute</span></div></header>
<section class="view on" id="v-timer">
  <div class="hero-flow timer"><div class="blob"></div><div class="blob b2"></div><div class="glow-ring" id="ring"></div>
    <div class="controls"><button class="icon-btn" id="reset" aria-label="Zurücksetzen">${icon('reset')}</button><button class="btn play" id="play" aria-label="Start">${icon('play', 30)}</button><button class="icon-btn" id="skip" aria-label="Phase überspringen">${icon('skip')}</button></div>
    <div class="presets" id="presets"></div>
  </div>
  <div class="flow"><input class="input" id="task" maxlength="60" placeholder="Woran arbeitest du? z. B. Präsentation" aria-label="Aufgabe"></div>
  <div class="flow goal"><div class="row between"><div><b>Tagesziel</b> <span class="muted small" id="goal-text"></span></div><button class="btn ghost sm" id="goal-btn">Ändern</button></div><div class="bar" style="margin-top:12px"><i id="goal-bar" style="width:0"></i></div></div>
</section>
<section class="view" id="v-stats">
  <div class="bubbles"><div class="bubble md"><b id="k-today">0</b><span>Min. heute</span></div><div class="bubble lg accent"><b id="k-sessions">0</b><span>Sessions heute</span></div><div class="bubble sm"><b id="k-week">0</b><span>Std. Woche</span></div></div>
  <div class="flow"><div class="section-title">Fokus-Minuten · 7 Tage</div><div class="bars" id="week"></div></div>
  <div class="flow"><div class="section-title">Letzte Sessions</div><div class="list" id="history"></div></div>
</section>
<nav class="tabbar" role="tablist"><button class="tab on" data-view="v-timer" aria-selected="true">${icon('timer')}Timer</button><button class="tab" data-view="v-stats" aria-selected="false">${icon('chart')}Statistik</button></nav>`;
    const script = `
var PRESETS = [{ id: 'p25', label: '25 / 5', work: 25, rest: 5 }, { id: 'p50', label: '50 / 10', work: 50, rest: 10 }, { id: 'p15', label: '15 / 3', work: 15, rest: 3 }];
var cfg = store.get('cfg', { preset: 'p25', goal: 120 }); if (!cfg || typeof cfg !== 'object') cfg = { preset: 'p25', goal: 120 };
var minutes = store.get('minutes', {}); var sessions = store.get('sessions', []);
if (!Array.isArray(sessions)) sessions = []; if (!minutes || typeof minutes !== 'object') minutes = {};
var state = { mode: 'work', running: false, endAt: 0, remaining: 0, total: 0, tick: null };
var audio = null;
function preset() { return PRESETS.find(function (p) { return p.id === cfg.preset; }) || PRESETS[0]; }
function setPhase(mode) { state.mode = mode; state.total = (mode === 'work' ? preset().work : preset().rest) * 60; state.remaining = state.total; }
function fmt(s) { s = Math.max(0, Math.ceil(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
function chime() {
  try { var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; audio = audio || new Ctx();
    [660, 880, 990].forEach(function (f, i) { var o = audio.createOscillator(); var g = audio.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, audio.currentTime + i * 0.16); g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + i * 0.16 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + i * 0.16 + 0.5); o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + i * 0.16); o.stop(audio.currentTime + i * 0.16 + 0.55); });
  } catch (e) {}
}
function logWork(mins) { if (mins <= 0) return; var k = dayKey(); minutes[k] = (minutes[k] || 0) + mins; sessions.unshift({ at: Date.now(), mins: mins, task: ($('#task').value || '').trim().slice(0, 60) }); sessions = sessions.slice(0, 50); store.set('minutes', minutes); store.set('sessions', sessions); }
function finish(skipped) {
  stop();
  if (state.mode === 'work') { var done = Math.round((state.total - (skipped ? state.remaining : 0)) / 60); logWork(done); if (!skipped) { chime(); haptic(120); toast('Session geschafft! Zeit für eine Pause ☕'); } setPhase('rest'); }
  else { if (!skipped) { chime(); haptic(80); toast('Pause vorbei – bereit für die nächste Runde?'); } setPhase('work'); }
  render();
}
function loop() { state.remaining = (state.endAt - Date.now()) / 1000; if (state.remaining <= 0) { finish(false); return; } renderTimer(); }
function start() { state.running = true; state.endAt = Date.now() + state.remaining * 1000; clearInterval(state.tick); state.tick = setInterval(loop, 250); try { var Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx && !audio) audio = new Ctx(); } catch (e) {} haptic(10); render(); }
function stop() { state.running = false; clearInterval(state.tick); state.tick = null; }
function renderTimer() {
  var pct = state.total ? 1 - state.remaining / state.total : 0;
  $('#ring').innerHTML = ring(pct, 236, 14, '<div><div class="time">' + fmt(state.remaining) + '</div><div class="mode">' + (state.mode === 'work' ? 'Fokus' : 'Pause') + '</div></div>');
  $('#play').innerHTML = state.running ? '${icon('pause', 30)}' : '${icon('play', 30)}';
  $('#play').setAttribute('aria-label', state.running ? 'Pause' : 'Start');
}
function render() {
  renderTimer();
  $('#presets').innerHTML = PRESETS.map(function (p) { return '<button class="chip' + (p.id === cfg.preset ? ' on' : '') + '" data-preset="' + p.id + '">' + p.label + '</button>'; }).join('');
  var today = minutes[dayKey()] || 0; $('#today-min').textContent = today; $('#k-today').textContent = today;
  $('#k-sessions').textContent = sessions.filter(function (s) { return dayKey(new Date(s.at)) === dayKey(); }).length;
  $('#goal-text').textContent = today + ' von ' + cfg.goal + ' Minuten'; $('#goal-bar').style.width = Math.min(100, today / Math.max(1, cfg.goal) * 100) + '%';
  var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(new Date(), -i));
  var max = Math.max(30, Math.max.apply(null, days.map(function (d) { return minutes[dayKey(d)] || 0; }))); var week = 0;
  $('#week').innerHTML = days.map(function (d) { var m = minutes[dayKey(d)] || 0; week += m; return '<div><small>' + (m || '') + '</small><i class="' + (m ? '' : 'dim') + '" style="height:' + Math.max(5, m / max * 80) + '%"></i><small>' + WD[d.getDay()] + '</small></div>'; }).join('');
  $('#k-week').textContent = (Math.round(week / 6) / 10).toLocaleString('de-DE');
  $('#history').innerHTML = sessions.length ? sessions.slice(0, 8).map(function (s) { var d = new Date(s.at); return '<div class="pill hist"><div class="orb-icon">${icon('timer', 22)}</div><div class="grow"><b>' + esc(s.task || 'Fokus-Session') + '</b><div class="muted small">' + d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</div></div><span class="chip on" style="min-height:40px;display:inline-flex;align-items:center">' + s.mins + ' Min.</span></div>'; }).join('') : '<div class="empty"><div class="orb">${icon('timer', 38)}</div><div class="h2">Noch keine Sessions</div><p class="muted small">Starte deine erste Fokus-Runde.</p></div>';
}
document.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-preset]') : null; if (!b) return; if (state.running) { toast('Erst pausieren, dann Vorlage wechseln'); return; } cfg.preset = b.getAttribute('data-preset'); store.set('cfg', cfg); setPhase('work'); render(); });
$('#play').addEventListener('click', function () { if (state.running) { stop(); state.remaining = Math.max(0, (state.endAt - Date.now()) / 1000); render(); } else start(); });
$('#reset').addEventListener('click', function () { stop(); setPhase(state.mode); render(); });
$('#skip').addEventListener('click', function () { finish(true); });
$('#goal-btn').addEventListener('click', function () {
  openSheet('<h3>Tagesziel</h3><p class="muted small">Wie viele Fokus-Minuten willst du pro Tag schaffen?</p><label class="label" for="gi">Minuten</label><input class="input" id="gi" inputmode="numeric" value="' + cfg.goal + '"><div class="row" style="margin-top:20px"><button class="btn grow" data-g>Speichern</button></div>', function (b) {
    $('[data-g]', b).addEventListener('click', function () { var v = num($('#gi', b).value, 10, 960, NaN); if (isNaN(v)) { toast('Bitte eine Zahl zwischen 10 und 960 eingeben'); return; } cfg.goal = Math.round(v); store.set('cfg', cfg); closeSheet(); render(); toast('Tagesziel gespeichert'); });
  });
});
document.addEventListener('visibilitychange', function () { if (!document.hidden && state.running) loop(); });
$('#title').textContent = document.title;
setPhase('work'); setupTabs(); render();`;
    return { css, body, script };
  }
};
