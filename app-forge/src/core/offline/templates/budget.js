'use strict';
const { icon } = require('../base');

module.exports = {
  id: 'budget',
  type: 'tool',
  category: 'Finanzen & Sparen',
  word: 'Budget',
  keywords: ['finanz', 'spar', 'geld', 'budget', 'ausgaben', 'haushalt'],
  concept(name) {
    return {
      name,
      tagline: 'Dein Monatsbudget – in 3 Sekunden im Griff.',
      type: 'tool',
      category: 'Finanzen & Sparen',
      target_audience: 'Sparfüchse, Studierende und Familien, die ohne Bankanbindung den Überblick behalten wollen',
      problem_or_fun: 'Am Monatsende ist das Geld weg und keiner weiß wofür. Schnelles Erfassen zeigt sofort, was noch übrig ist.',
      core_loop: 'Betrag tippen → Kategorie wählen → sofort sehen, wie viel vom Monatsbudget bleibt.',
      features: ['Monatsbudget mit Restbetrag', 'Ausgabe in Sekunden erfassen', 'Kategorien mit Symbolen', 'Verteilung als Ring-Diagramm', 'Liste nach Tagen, Einträge löschen'],
      screens: ['Übersicht', 'Ausgaben'],
      retention_hook: 'Der Restbetrag motiviert, jede Ausgabe sofort einzutragen.',
      monetization: 'Pro-Einmalkauf: eigene Kategorien, Sparziele, CSV-Export.',
      design_direction: 'Großer Restbetrag als Verlaufs-Schrift, schwebende Pillen, Donut-Diagramm.',
      icon_glyph: '€',
      store_short_description: 'Ausgaben blitzschnell erfassen und das Monatsbudget immer im Blick.',
      store_full_description: `${name} zeigt dir jederzeit, wie viel Geld in diesem Monat noch übrig ist – ohne Bankverbindung und ohne Anmeldung. Deine Daten bleiben auf deinem Handy.\n\nTippe einen Betrag ein, wähle eine Kategorie wie Essen, Einkauf oder Mobilität und fertig. Der Restbetrag und das Ring-Diagramm aktualisieren sich sofort, so siehst du, wohin dein Geld fließt.\n\nFunktionen:\n• Monatsbudget festlegen\n• Ausgaben in Sekunden erfassen\n• Sechs Kategorien mit Symbolen\n• Verteilung als Ring-Diagramm\n• Übersicht nach Tagen, Einträge löschen\n• 100 % offline und werbefrei\n\nMehr Überblick, weniger Stress am Monatsende.`,
      keywords: ['Budget', 'Ausgaben', 'Haushaltsbuch', 'Sparen', 'Finanzen', 'Geld', 'Kostenkontrolle']
    };
  },
  render() {
    const css = `
.amount{font-size:52px;font-weight:840;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
.amount.neg{background:none;color:var(--text);opacity:.9}
.spent{width:min(320px,100%);margin-top:18px}
.cats{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.donut-wrap{display:flex;align-items:center;gap:18px}
.donut{width:150px;height:150px;border-radius:50%;flex:none;position:relative;box-shadow:0 22px 40px -24px var(--shadow)}
.donut::after{content:"";position:absolute;inset:26px;border-radius:50%;background:var(--bg2)}
.legend{flex:1;min-width:0}
.legend div{display:flex;align-items:center;gap:8px;font-size:14px;padding:4px 0}
.legend i{width:12px;height:12px;border-radius:50%;flex:none}
.legend b{margin-left:auto;font-variant-numeric:tabular-nums}
.money{font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.exp .icon-btn{width:44px;height:44px;background:transparent;border-color:transparent;color:var(--muted)}`;
    const body = `
<header class="top"><div><div class="eyebrow" id="month"></div><h1 class="h1"><span class="grad-text" id="title"></span></h1></div>
<button class="icon-btn" id="budget-btn" aria-label="Budget ändern">${icon('wallet')}</button></header>
<section class="view on" id="v-home">
  <div class="hero-flow"><div class="blob"></div><div class="blob b2"></div><div class="eyebrow">Noch verfügbar</div><div class="amount grad-text" id="left"></div><p class="muted small" id="of" style="margin-top:8px"></p><div class="bar spent"><i id="spent-bar" style="width:0"></i></div></div>
  <div class="flow"><div class="section-title">Neue Ausgabe</div>
    <div class="row"><input class="input grow" id="amt" inputmode="decimal" placeholder="Betrag in €" aria-label="Betrag"><button class="btn" id="add" aria-label="Ausgabe hinzufügen">${icon('plus')}</button></div>
    <div class="cats" id="cats"></div>
    <input class="input" id="note" maxlength="40" placeholder="Notiz (optional)" aria-label="Notiz" style="margin-top:12px">
  </div>
  <div class="flow"><div class="section-title">Verteilung</div><div class="donut-wrap"><div class="donut" id="donut"></div><div class="legend" id="legend"></div></div></div>
</section>
<section class="view" id="v-list">
  <div class="bubbles"><div class="bubble md"><b id="k-count">0</b><span>Einträge</span></div><div class="bubble lg accent"><b id="k-spent">0 €</b><span>ausgegeben</span></div><div class="bubble sm"><b id="k-day">0 €</b><span>Ø pro Tag</span></div></div>
  <div class="list" id="days"></div>
</section>
<nav class="tabbar" role="tablist"><button class="tab on" data-view="v-home" aria-selected="true">${icon('wallet')}Übersicht</button><button class="tab" data-view="v-list" aria-selected="false">${icon('list')}Ausgaben</button></nav>`;
    const script = `
var CATS = [
  { id: 'food', label: 'Essen', emoji: '🍝', color: 'var(--a1)' },
  { id: 'shop', label: 'Einkauf', emoji: '🛒', color: 'var(--a2)' },
  { id: 'move', label: 'Mobilität', emoji: '🚲', color: 'var(--glow)' },
  { id: 'fun', label: 'Freizeit', emoji: '🎉', color: 'color-mix(in srgb, var(--a1) 50%, var(--a2))' },
  { id: 'home', label: 'Wohnen', emoji: '🏠', color: 'color-mix(in srgb, var(--a2) 55%, var(--text))' },
  { id: 'other', label: 'Sonstiges', emoji: '✨', color: 'color-mix(in srgb, var(--a1) 45%, var(--text))' }
];
var EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
var budget = num(store.get('budget', 800), 1, 1000000, 800);
var items = store.get('items', []); if (!Array.isArray(items)) items = [];
var cat = 'food';
function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function thisMonth() { var m = monthKey(new Date()); return items.filter(function (x) { return monthKey(new Date(x.at)) === m; }); }
function catOf(id) { return CATS.find(function (c) { return c.id === id; }) || CATS[5]; }
function save() { store.set('items', items); store.set('budget', budget); }
function render() {
  var now = new Date(); var list = thisMonth(); var spent = list.reduce(function (s, x) { return s + x.amount; }, 0); var left = budget - spent;
  $('#month').textContent = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  var l = $('#left'); l.textContent = EUR.format(left); l.classList.toggle('neg', left < 0);
  $('#of').textContent = EUR.format(spent) + ' von ' + EUR.format(budget) + ' ausgegeben';
  $('#spent-bar').style.width = Math.min(100, spent / budget * 100) + '%';
  $('#cats').innerHTML = CATS.map(function (c) { return '<button class="chip' + (c.id === cat ? ' on' : '') + '" data-cat="' + c.id + '">' + c.emoji + ' ' + c.label + '</button>'; }).join('');
  var sums = CATS.map(function (c) { return { c: c, sum: list.filter(function (x) { return x.cat === c.id; }).reduce(function (s, x) { return s + x.amount; }, 0) }; }).filter(function (x) { return x.sum > 0; });
  if (sums.length) { var acc = 0; var stops = sums.map(function (x) { var a = acc / spent * 360; acc += x.sum; var b = acc / spent * 360; return x.c.color + ' ' + a + 'deg ' + b + 'deg'; }); $('#donut').style.background = 'conic-gradient(' + stops.join(',') + ')'; }
  else $('#donut').style.background = 'conic-gradient(var(--surface-strong) 0deg 360deg)';
  $('#legend').innerHTML = sums.length ? sums.sort(function (a, b) { return b.sum - a.sum; }).map(function (x) { return '<div><i style="background:' + x.c.color + '"></i>' + x.c.emoji + ' ' + x.c.label + '<b>' + Math.round(x.sum / spent * 100) + '%</b></div>'; }).join('') : '<p class="muted small">Noch keine Ausgaben in diesem Monat. Trage oben deine erste ein.</p>';
  $('#k-count').textContent = list.length; $('#k-spent').textContent = EUR.format(spent).replace(/,\\d\\d/, ''); $('#k-day').textContent = EUR.format(spent / Math.max(1, now.getDate())).replace(/,\\d\\d/, '');
  var groups = {}; list.slice().sort(function (a, b) { return b.at - a.at; }).forEach(function (x) { var k = dayKey(new Date(x.at)); (groups[k] = groups[k] || []).push(x); });
  var keys = Object.keys(groups);
  $('#days').innerHTML = keys.length ? keys.map(function (k) { var d = new Date(k + 'T12:00:00'); var sum = groups[k].reduce(function (s, x) { return s + x.amount; }, 0);
    return '<div class="flow"><div class="section-title">' + d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' }) + '<span class="muted">' + EUR.format(sum) + '</span></div>' + groups[k].map(function (x) { var c = catOf(x.cat); return '<div class="pill exp"><div class="orb-icon">' + c.emoji + '</div><div class="grow"><b>' + esc(x.note || c.label) + '</b><div class="muted small">' + c.label + '</div></div><span class="money">' + EUR.format(x.amount) + '</span><button class="icon-btn" data-del="' + x.id + '" aria-label="Eintrag löschen">${icon('trash', 18)}</button></div>'; }).join('') + '</div>'; }).join('')
    : '<div class="empty"><div class="orb">${icon('wallet', 38)}</div><div class="h2">Alles im grünen Bereich</div><p class="muted small">Hier erscheinen deine Ausgaben, nach Tagen sortiert.</p></div>';
}
function add() {
  var v = num($('#amt').value, 0.01, 100000, NaN);
  if (isNaN(v)) { toast('Bitte einen Betrag zwischen 0,01 € und 100.000 € eingeben'); return; }
  items.push({ id: uid(), amount: Math.round(v * 100) / 100, cat: cat, note: ($('#note').value || '').trim().slice(0, 40), at: Date.now() });
  $('#amt').value = ''; $('#note').value = ''; save(); render(); haptic(15); toast('Gespeichert: ' + EUR.format(v));
  var l = $('#left'); l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop');
}
$('#add').addEventListener('click', add);
$('#amt').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
document.addEventListener('click', function (e) {
  var c = e.target.closest ? e.target.closest('[data-cat]') : null; if (c) { cat = c.getAttribute('data-cat'); render(); haptic(6); return; }
  var d = e.target.closest ? e.target.closest('[data-del]') : null; if (d) { var id = d.getAttribute('data-del'); confirmSheet('Eintrag löschen?', 'Die Ausgabe wird aus diesem Monat entfernt.', 'Löschen', function () { items = items.filter(function (x) { return x.id !== id; }); save(); render(); toast('Gelöscht'); }); }
});
$('#budget-btn').addEventListener('click', function () {
  openSheet('<h3>Monatsbudget</h3><p class="muted small">Wie viel möchtest du diesen Monat höchstens ausgeben?</p><label class="label" for="bi">Betrag in €</label><input class="input" id="bi" inputmode="decimal" value="' + budget + '"><div class="row" style="margin-top:20px"><button class="btn grow" data-b>Speichern</button></div>', function (b) {
    $('[data-b]', b).addEventListener('click', function () { var v = num($('#bi', b).value, 1, 1000000, NaN); if (isNaN(v)) { toast('Bitte einen gültigen Betrag eingeben'); return; } budget = Math.round(v * 100) / 100; save(); closeSheet(); render(); toast('Budget gespeichert'); });
  });
});
$('#title').textContent = document.title;
setupTabs(); render();`;
    return { css, body, script };
  }
};
