'use strict';
const { icon } = require('../base');

module.exports = {
  id: 'water',
  type: 'tool',
  category: 'Gesundheit & Fitness',
  word: 'Drops',
  keywords: ['gesund', 'fitness', 'wasser', 'trinken', 'sport', 'ernähr', 'achtsam'],
  concept(name) {
    return {
      name,
      tagline: 'Genug trinken – spielend leicht.',
      type: 'tool',
      category: 'Gesundheit & Fitness',
      target_audience: 'Berufstätige, Sportler und alle, die im Alltag das Trinken vergessen',
      problem_or_fun: 'Zu wenig trinken macht müde und unkonzentriert. Ein sichtbares Tagesziel macht Trinken zur Gewohnheit.',
      core_loop: 'Glas trinken → Tippen → die Welle steigt → Tagesziel erreichen → Serie wächst.',
      features: ['Animierte Wellen-Anzeige', 'Schnell-Buttons 150/250/500 ml', 'Eigene Menge und Rückgängig', 'Persönliches Tagesziel', '7-Tage-Verlauf und Serie'],
      screens: ['Heute', 'Verlauf'],
      retention_hook: 'Die steigende Welle und die Ziel-Serie belohnen jedes Glas.',
      monetization: 'Pro-Einmalkauf: Getränkearten, Themes, Wochen-Auswertung.',
      design_direction: 'Kreisrundes Glas mit animierter Verlaufs-Welle, schwebende Bubbles.',
      icon_glyph: name.charAt(0),
      store_short_description: 'Trink-Tracker mit animierter Welle, Tagesziel und Serie – ganz ohne Konto.',
      store_full_description: `${name} erinnert dich spielerisch daran, genug zu trinken. Jedes Glas lässt die animierte Welle in deinem Tageskreis steigen – bis dein Ziel erreicht ist.\n\nMit einem Fingertipp trägst du 150, 250 oder 500 ml ein oder wählst deine eigene Menge. Vertippt? Einfach rückgängig machen. Im Verlauf siehst du deine letzten 7 Tage und wie lange deine Ziel-Serie schon hält.\n\nFunktionen:\n• Animierte Wellen-Anzeige\n• Schnell-Buttons und eigene Mengen\n• Persönliches Tagesziel\n• 7-Tage-Verlauf und Serien\n• Offline, werbefrei, ohne Anmeldung\n\nMehr Energie, jeden Tag.`,
      keywords: ['Wasser', 'Trinken', 'Trink-Tracker', 'Hydration', 'Gesundheit', 'Erinnerung', 'Tagesziel']
    };
  },
  render() {
    const css = `
.glass{position:relative;width:240px;height:240px;border-radius:50%;overflow:hidden;background:var(--surface);border:1px solid var(--border);box-shadow:0 30px 60px -30px var(--shadow),inset 0 0 0 8px rgba(255,255,255,.04);isolation:isolate}
.water{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(180deg,var(--a1),var(--a2));transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.water svg{position:absolute;left:0;width:200%;height:22px;top:-21px;animation:wave 4.5s linear infinite}
.water svg.w2{opacity:.45;top:-17px;animation-duration:7s;animation-direction:reverse}
.water path{fill:var(--a1)}
@keyframes wave{to{transform:translateX(-50%)}}
.glass-label{position:absolute;inset:0;display:grid;place-items:center;z-index:2}
.glass-label>div{padding:14px 24px;border-radius:999px;background:color-mix(in srgb,var(--bg1) 78%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);text-align:center;box-shadow:0 14px 30px -18px var(--shadow)}
.ml{font-size:34px;font-weight:840;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1}
.quick{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.quick .btn{min-width:96px}
.drink{display:flex;align-items:center;gap:12px}`;
    const body = `
<header class="top"><div><div class="eyebrow" id="date"></div><h1 class="h1"><span class="grad-text" id="title"></span></h1></div>
<button class="icon-btn" id="goal-btn" aria-label="Tagesziel ändern">${icon('gear')}</button></header>
<section class="view on" id="v-today">
  <div class="hero-flow"><div class="blob"></div><div class="blob b2"></div>
    <div class="glass"><div class="water" id="water"><svg viewBox="0 0 400 22" preserveAspectRatio="none" aria-hidden="true"><path d="M0 11 Q 50 0 100 11 T 200 11 T 300 11 T 400 11 V22 H0 Z"/></svg><svg class="w2" viewBox="0 0 400 22" preserveAspectRatio="none" aria-hidden="true"><path d="M0 11 Q 50 22 100 11 T 200 11 T 300 11 T 400 11 V22 H0 Z"/></svg></div>
      <div class="glass-label"><div><div class="ml" id="ml">0</div><div class="muted small" id="goal-txt"></div></div></div></div>
    <p class="h2" id="msg" style="margin-top:18px"></p>
  </div>
  <div class="flow"><div class="quick"><button class="btn sm" data-add="150">+150 ml</button><button class="btn sm" data-add="250">+250 ml</button><button class="btn sm" data-add="500">+500 ml</button></div>
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost sm" id="custom">${icon('plus', 18)}Eigene Menge</button><button class="btn ghost sm" id="undo">${icon('undo', 18)}Rückgängig</button></div></div>
</section>
<section class="view" id="v-history">
  <div class="bubbles"><div class="bubble md"><b id="k-avg">0</b><span>Ø ml / Tag</span></div><div class="bubble lg accent"><b id="k-streak">0</b><span>Tage Serie</span></div><div class="bubble sm"><b id="k-pct">0%</b><span>heute</span></div></div>
  <div class="flow"><div class="section-title">Letzte 7 Tage</div><div class="bars" id="week"></div></div>
  <div class="flow"><div class="section-title">Heute getrunken</div><div class="list" id="today-list"></div></div>
</section>
<nav class="tabbar" role="tablist"><button class="tab on" data-view="v-today" aria-selected="true">${icon('drop')}Heute</button><button class="tab" data-view="v-history" aria-selected="false">${icon('chart')}Verlauf</button></nav>`;
    const script = `
var goal = num(store.get('goal', 2000), 500, 6000, 2000);
var log = store.get('log', {}); if (!log || typeof log !== 'object') log = {};
function entries(k) { return Array.isArray(log[k]) ? log[k] : []; }
function total(k) { return entries(k).reduce(function (s, x) { return s + (Number(x.ml) || 0); }, 0); }
function save() { store.set('log', log); store.set('goal', goal); }
function streak() { var n = 0; var d = new Date(); if (total(dayKey(d)) < goal) d = addDays(d, -1); while (total(dayKey(d)) >= goal && n < 3650) { n++; d = addDays(d, -1); } return n; }
function add(ml) { var k = dayKey(); var before = total(k); log[k] = entries(k).concat([{ ml: ml, at: Date.now() }]); save(); haptic(18); render(); if (before < goal && total(k) >= goal) toast('Tagesziel erreicht! 💧 Stark gemacht'); else toast('+' + ml + ' ml'); }
function render() {
  var k = dayKey(); var t = total(k); var pct = Math.min(1, t / goal);
  $('#date').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#water').style.height = Math.max(4, pct * 100) + '%';
  $('#ml').textContent = t.toLocaleString('de-DE') + ' ml'; $('#goal-txt').textContent = 'Ziel ' + goal.toLocaleString('de-DE') + ' ml';
  $('#msg').textContent = pct >= 1 ? 'Ziel erreicht – perfekt! 🎉' : pct >= 0.5 ? 'Mehr als die Hälfte geschafft' : t > 0 ? 'Guter Start, weiter so' : 'Zeit für das erste Glas';
  var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(new Date(), -i));
  var max = Math.max(goal, Math.max.apply(null, days.map(function (d) { return total(dayKey(d)); }))); var sum = 0;
  $('#week').innerHTML = days.map(function (d) { var v = total(dayKey(d)); sum += v; return '<div><small>' + (v ? (Math.round(v / 100) / 10).toLocaleString('de-DE') + 'l' : '') + '</small><i class="' + (v >= goal ? '' : 'dim') + '" style="height:' + Math.max(5, v / max * 80) + '%"></i><small>' + WD[d.getDay()] + '</small></div>'; }).join('');
  $('#k-avg').textContent = Math.round(sum / 7).toLocaleString('de-DE'); $('#k-streak').textContent = streak(); $('#k-pct').textContent = Math.round(pct * 100) + '%';
  var list = entries(k).slice().reverse();
  $('#today-list').innerHTML = list.length ? list.map(function (x) { var d = new Date(x.at); return '<div class="pill drink"><div class="orb-icon">💧</div><div class="grow"><b>' + x.ml + ' ml</b><div class="muted small">' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' Uhr</div></div></div>'; }).join('') : '<div class="empty"><div class="orb">${icon('drop', 38)}</div><div class="h2">Noch nichts getrunken</div><p class="muted small">Tippe auf eine Menge, um zu starten.</p></div>';
}
document.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-add]') : null; if (b) add(Number(b.getAttribute('data-add'))); });
$('#undo').addEventListener('click', function () { var k = dayKey(); var arr = entries(k); if (!arr.length) { toast('Heute gibt es nichts rückgängig zu machen'); return; } arr.pop(); log[k] = arr; save(); render(); toast('Letzter Eintrag entfernt'); });
$('#custom').addEventListener('click', function () {
  openSheet('<h3>Eigene Menge</h3><p class="muted small">Zwischen 10 und 2000 ml.</p><label class="label" for="ci">Milliliter</label><input class="input" id="ci" inputmode="numeric" placeholder="z. B. 330"><div class="row" style="margin-top:20px"><button class="btn grow" data-c>Hinzufügen</button></div>', function (b) {
    function go() { var v = num($('#ci', b).value, 10, 2000, NaN); if (isNaN(v)) { toast('Bitte eine Menge zwischen 10 und 2000 ml eingeben'); return; } closeSheet(); add(Math.round(v)); }
    $('[data-c]', b).addEventListener('click', go); $('#ci', b).addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  });
});
$('#goal-btn').addEventListener('click', function () {
  openSheet('<h3>Tagesziel</h3><p class="muted small">Empfehlung für Erwachsene: rund 1,5 bis 2 Liter Wasser pro Tag.</p><label class="label" for="gi">Ziel in ml</label><input class="input" id="gi" inputmode="numeric" value="' + goal + '"><div class="row" style="margin-top:20px"><button class="btn grow" data-g>Speichern</button></div>', function (b) {
    $('[data-g]', b).addEventListener('click', function () { var v = num($('#gi', b).value, 500, 6000, NaN); if (isNaN(v)) { toast('Bitte ein Ziel zwischen 500 und 6000 ml eingeben'); return; } goal = Math.round(v); save(); closeSheet(); render(); toast('Tagesziel gespeichert'); });
  });
});
$('#title').textContent = document.title;
setupTabs(); render();`;
    return { css, body, script };
  }
};
