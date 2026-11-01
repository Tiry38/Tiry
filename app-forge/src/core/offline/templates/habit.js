'use strict';
const { icon } = require('../base');

module.exports = {
  id: 'habit',
  type: 'tool',
  category: 'Gewohnheiten & Ziele',
  word: 'Habits',
  keywords: ['gewohn', 'habit', 'ziel', 'routine', 'lifestyle', 'achtsam'],
  concept(name) {
    return {
      name,
      tagline: 'Kleine Gewohnheiten, große Wirkung – jeden Tag.',
      type: 'tool',
      category: 'Gewohnheiten & Ziele',
      target_audience: 'Berufstätige und Studierende, die neue Routinen ohne Druck aufbauen wollen',
      problem_or_fun: 'Gute Vorsätze scheitern, weil Fortschritt unsichtbar bleibt. Die App macht jeden Tag sichtbar und motiviert mit Serien.',
      core_loop: 'Morgens Gewohnheiten sehen → im Laufe des Tages abhaken → Fortschrittsring füllt sich → Serie wächst.',
      features: ['Eigene Gewohnheiten mit Emoji anlegen', 'Abhaken mit einem Fingertipp', 'Serien-Zähler (Streaks) mit Flammen', 'Tagesfortschritt als Ring', 'Wochenübersicht und Bestwerte'],
      screens: ['Heute', 'Statistik', 'Gewohnheit anlegen/bearbeiten'],
      retention_hook: 'Die Serie will niemand verlieren – jeder Tag zählt sichtbar.',
      monetization: 'Freemium: 3 Gewohnheiten gratis, Pro-Einmalkauf für unbegrenzte Gewohnheiten, Themes und Export.',
      design_direction: 'Glas-Karten auf Aurora-Verlauf, Verlaufs-Ring, verspielte Häkchen-Animation.',
      icon_glyph: name.charAt(0),
      store_short_description: 'Gewohnheiten aufbauen mit Serien, Fortschrittsring und Wochenstatistik.',
      store_full_description: `${name} hilft dir, gute Gewohnheiten wirklich durchzuziehen – ohne Konto, ohne Werbung, komplett offline.\n\nLege in Sekunden deine Routinen an, etwa „10 Minuten lesen“, „Wasser trinken“ oder „Spaziergang“. Hake sie mit einem Fingertipp ab und sieh zu, wie sich dein Tagesring füllt. Für jede Gewohnheit wächst eine Serie – so bleibst du motiviert, auch an schwierigen Tagen.\n\nFunktionen:\n• Eigene Gewohnheiten mit Emoji\n• Serien-Zähler und Bestwerte\n• Tagesfortschritt als animierter Ring\n• Wochenübersicht auf einen Blick\n• Deine Daten bleiben auf deinem Gerät\n\nStarte heute – kleine Schritte, große Wirkung.`,
      keywords: ['Gewohnheiten', 'Habit Tracker', 'Routine', 'Ziele', 'Streak', 'Motivation', 'Selbstoptimierung']
    };
  },
  render() {
    const css = `
.habit{position:relative}
.habit .name{font-weight:720;font-size:16px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.habit .meta{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:4px;margin-top:2px}
.habit .icon-btn{width:44px;height:44px;background:transparent;border-color:transparent;color:var(--muted)}
.habit.done{background:linear-gradient(120deg,var(--a1-soft),var(--a2-soft));border-color:transparent}
.tick{width:52px;height:52px;border-radius:50%;border:2px solid var(--border);background:transparent;color:var(--on-accent);display:grid;place-items:center;cursor:pointer;flex:none;transition:all .35s cubic-bezier(.3,1.5,.5,1)}
.tick svg{opacity:0;transform:scale(.3) rotate(-30deg);transition:all .35s cubic-bezier(.3,1.5,.5,1)}
.done .tick{background:var(--grad);border-color:transparent;box-shadow:0 10px 24px -8px var(--a1-soft)}
.done .tick svg{opacity:1;transform:scale(1) rotate(0)}
.dots{display:flex;gap:6px;margin-top:8px}
.dots i{flex:1;height:10px;border-radius:99px;background:var(--surface-strong)}
.dots i.on{background:var(--grad);box-shadow:0 0 12px var(--a1-soft)}
.emojis{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.emojis button{width:52px;height:52px;border-radius:50%;border:1px solid var(--border);background:var(--surface);font-size:22px;cursor:pointer;transition:all .25s cubic-bezier(.3,1.5,.5,1)}
.emojis button.on{background:var(--grad);border-color:transparent;transform:scale(1.12)}
.flame{color:var(--a2)}
.per-item{padding:14px 18px;border-radius:30px;background:var(--surface);border:1px solid var(--border)}
.per-item+.per-item{margin-top:10px}`;
    const body = `
<header class="top"><div><div class="eyebrow" id="date"></div><h1 class="h1"><span class="grad-text" id="title"></span></h1></div>
<button class="icon-btn" id="add" aria-label="Gewohnheit hinzufügen">${icon('plus')}</button></header>
<section class="view on" id="v-today">
  <div class="hero-flow"><div class="blob"></div><div class="blob b2"></div><div id="ring"></div><div class="h2" id="headline" style="margin-top:16px"></div><p class="muted small" id="sub"></p></div>
  <div class="flow"><div class="section-title">Heute <span class="muted" id="count"></span></div><div class="list" id="list"></div></div>
</section>
<section class="view" id="v-stats">
  <div class="bubbles"><div class="bubble md"><b id="k-total">0</b><span>erledigt</span></div><div class="bubble lg accent"><b id="k-best">0</b><span>beste Serie</span></div><div class="bubble sm"><b id="k-week">0%</b><span>Woche</span></div></div>
  <div class="flow"><div class="section-title">Letzte 7 Tage</div><div class="bars" id="week"></div></div>
  <div class="flow"><div class="section-title">Pro Gewohnheit</div><div id="per"></div></div>
</section>
<nav class="tabbar" role="tablist"><button class="tab on" data-view="v-today" aria-selected="true">${icon('home')}Heute</button><button class="tab" data-view="v-stats" aria-selected="false">${icon('chart')}Statistik</button><button class="tab" id="tab-add">${icon('plus')}Neu</button></nav>`;
    const script = `
var EMOJIS = ['💧','📖','🚶','🧘','🏋️','🥗','😴','✍️','🎸','🧹','🌱','☀️','📵','🦷','💊','🚴','🧠','❤️'];
var habits = store.get('habits', null);
if (!Array.isArray(habits)) { habits = [{ id: uid(), name: 'Wasser trinken', emoji: '💧' }, { id: uid(), name: '10 Minuten lesen', emoji: '📖' }, { id: uid(), name: 'Spaziergang', emoji: '🚶' }]; store.set('habits', habits); }
var log = store.get('log', {}); if (!log || typeof log !== 'object') log = {};
function save() { store.set('habits', habits); store.set('log', log); }
function doneOn(id, key) { return Array.isArray(log[key]) && log[key].indexOf(id) >= 0; }
function streak(id) { var n = 0; var d = new Date(); if (!doneOn(id, dayKey(d))) d = addDays(d, -1); while (doneOn(id, dayKey(d)) && n < 3650) { n++; d = addDays(d, -1); } return n; }
function bestStreak(id) { var keys = Object.keys(log).filter(function (k) { return doneOn(id, k); }).sort(); var best = 0, cur = 0, prev = null; keys.forEach(function (k) { var d = new Date(k + 'T12:00:00'); if (prev && Math.round((d - prev) / 864e5) === 1) cur++; else cur = 1; best = Math.max(best, cur); prev = d; }); return best; }
function toggle(id) { var k = dayKey(); var arr = Array.isArray(log[k]) ? log[k] : []; var i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); else { arr.push(id); haptic(15); } log[k] = arr; save(); render(); var all = habits.length && habits.every(function (h) { return doneOn(h.id, k); }); if (i < 0 && all) toast('Stark! Alles für heute erledigt 🎉'); }
function render() {
  var k = dayKey(); var done = habits.filter(function (h) { return doneOn(h.id, k); }).length; var pct = habits.length ? done / habits.length : 0;
  $('#date').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#ring').innerHTML = ring(pct, 190, 16, '<div><b style="font-size:44px;font-weight:820;letter-spacing:-.04em">' + Math.round(pct * 100) + '%</b><div class="muted small" style="font-weight:650">heute</div></div>');
  $('#headline').textContent = pct === 1 ? 'Perfekter Tag!' : done === 0 ? 'Auf geht\\u2019s!' : 'Weiter so!';
  $('#sub').textContent = done + ' von ' + habits.length + ' Gewohnheiten erledigt';
  $('#count').textContent = habits.length + ' aktiv';
  var list = $('#list');
  if (!habits.length) { list.innerHTML = '<div class="empty"><div class="orb">${icon('spark', 38)}</div><div class="h2">Noch keine Gewohnheiten</div><p class="muted small" style="margin:6px 0 16px">Lege deine erste Routine an – klein anfangen wirkt.</p><button class="btn" data-new>Gewohnheit anlegen</button></div>'; }
  else list.innerHTML = habits.map(function (h, i) {
    var s = streak(h.id); var isDone = doneOn(h.id, k);
    return '<div class="pill habit' + (isDone ? ' done' : '') + '" style="animation-delay:' + i * 50 + 'ms"><div class="orb-icon">' + esc(h.emoji) + '</div><div class="grow"><div class="name">' + esc(h.name) + '</div><div class="meta"><span class="flame">${icon('flame', 14)}</span>' + s + (s === 1 ? ' Tag' : ' Tage') + ' Serie</div></div>' +
      '<button class="icon-btn" data-edit="' + h.id + '" aria-label="Bearbeiten">${icon('edit', 18)}</button><button class="tick" data-tick="' + h.id + '" aria-label="' + esc(h.name) + ' abhaken">${icon('check', 24)}</button></div>';
  }).join('');
  renderStats();
}
function renderStats() {
  var total = 0; Object.keys(log).forEach(function (k) { if (Array.isArray(log[k])) total += log[k].length; });
  $('#k-total').textContent = total;
  $('#k-best').textContent = habits.reduce(function (m, h) { return Math.max(m, bestStreak(h.id)); }, 0);
  var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(new Date(), -i));
  var possible = habits.length * 7; var weekDone = 0;
  $('#week').innerHTML = days.map(function (d) { var c = (log[dayKey(d)] || []).filter(function (id) { return habits.some(function (h) { return h.id === id; }); }).length; weekDone += c; var p = habits.length ? c / habits.length : 0; return '<div><i class="' + (p ? '' : 'dim') + '" style="height:' + Math.max(6, p * 100) + '%"></i><small>' + WD[d.getDay()] + '</small></div>'; }).join('');
  $('#k-week').textContent = (possible ? Math.round(weekDone / possible * 100) : 0) + '%';
  $('#per').innerHTML = habits.length ? habits.map(function (h) { return '<div class="per-item"><div class="row between"><b>' + esc(h.emoji) + ' ' + esc(h.name) + '</b><span class="muted small">Beste Serie ' + bestStreak(h.id) + '</span></div><div class="dots">' + days.map(function (d) { return '<i class="' + (doneOn(h.id, dayKey(d)) ? 'on' : '') + '"></i>'; }).join('') + '</div></div>'; }).join('') : '<p class="muted small" style="margin-top:8px">Noch keine Daten.</p>';
}
function editor(h) {
  var chosen = h ? h.emoji : EMOJIS[0];
  openSheet('<h3>' + (h ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit') + '</h3><p class="muted small">Klein und konkret funktioniert am besten.</p>' +
    '<label class="label" for="hn">Name</label><input class="input" id="hn" maxlength="40" placeholder="z. B. 10 Minuten dehnen" value="' + (h ? esc(h.name) : '') + '">' +
    '<label class="label">Symbol</label><div class="emojis">' + EMOJIS.map(function (e) { return '<button data-emo="' + e + '" class="' + (e === chosen ? 'on' : '') + '">' + e + '</button>'; }).join('') + '</div>' +
    '<div class="row" style="margin-top:22px">' + (h ? '<button class="btn ghost sm" data-del>${icon('trash', 18)}Löschen</button>' : '') + '<button class="btn grow" data-save>Speichern</button></div>', function (b) {
    $$('[data-emo]', b).forEach(function (x) { x.addEventListener('click', function () { chosen = x.getAttribute('data-emo'); $$('[data-emo]', b).forEach(function (y) { y.classList.toggle('on', y === x); }); }); });
    var inp = $('#hn', b);
    function doSave() { var name = inp.value.trim(); if (name.length < 2) { toast('Bitte einen Namen mit mindestens 2 Zeichen eingeben'); return; } if (h) { h.name = name; h.emoji = chosen; } else { habits.push({ id: uid(), name: name, emoji: chosen }); } save(); closeSheet(); render(); toast(h ? 'Gespeichert' : 'Gewohnheit angelegt'); }
    $('[data-save]', b).addEventListener('click', doSave);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSave(); });
    var del = $('[data-del]', b); if (del) del.addEventListener('click', function () { confirmSheet('Gewohnheit löschen?', '„' + h.name + '“ und ihre Serie werden entfernt.', 'Löschen', function () { habits = habits.filter(function (x) { return x.id !== h.id; }); save(); render(); toast('Gelöscht'); }); });
  });
}
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('[data-tick],[data-edit],[data-new]') : null; if (!t) return;
  if (t.hasAttribute('data-tick')) toggle(t.getAttribute('data-tick'));
  else if (t.hasAttribute('data-edit')) { var h = habits.find(function (x) { return x.id === t.getAttribute('data-edit'); }); if (h) editor(h); }
  else editor(null);
});
$('#add').addEventListener('click', function () { editor(null); });
$('#tab-add').addEventListener('click', function () { editor(null); });
$('#title').textContent = document.title;
setupTabs(); render();`;
    return { css, body, script };
  }
};
