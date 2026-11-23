/* Velo-TV Player – läuft im Browser des Fernsehers (LG webOS) und als Vorschau in der Steuerung.
   Bewusst ES2017 ohne Module, damit auch ältere TV-Browser mitspielen. */
(function () {
  'use strict';
  var VERSION = '1.0';
  var qs = new URLSearchParams(location.search);
  var VORSCHAU = qs.has('vorschau');
  var stage = document.getElementById('stage');
  var idle = document.getElementById('idle');
  var clockEl = document.getElementById('clock');
  var cornerLogo = document.getElementById('cornerLogo');
  var hint = document.getElementById('hint');
  var offlineDot = document.getElementById('offline');

  var state = null;
  var aktuell = null;      // { item, el, timer }
  var naechsterId = null;  // Sprungziel
  var zeiger = null;       // zuletzt gewählter Beitrag { id, index } – auch wenn er defekt war
  var laeuft = false;
  var gestartet = Date.now();
  var NEULADEN_NACH = 8 * 3600 * 1000; // Speicher des TV-Browsers frisch halten

  function aktive() {
    if (!state) return [];
    var now = new Date();
    return state.items.filter(function (i) { return VeloSchedule.isActive(i, now); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // *Wort* in der Überschrift = Akzentfarbe wie auf der Homepage
  function akzent(s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }

  function naechstes() {
    var liste = aktive();
    if (!liste.length) return null;
    if (naechsterId) {
      var z = state.items.filter(function (i) { return i.id === naechsterId; })[0];
      naechsterId = null;
      if (z) return z;
    }
    if (!zeiger) return liste[0];
    // nächster aktiver Beitrag nach dem zuletzt gewählten in der Gesamtreihenfolge
    var idx = -1;
    for (var k = 0; k < state.items.length; k++) if (state.items[k].id === zeiger.id) idx = k;
    if (idx === -1) idx = zeiger.index - 1;
    for (var s = 1; s <= state.items.length; s++) {
      var kand = state.items[(idx + s + state.items.length) % state.items.length];
      if (kand && liste.indexOf(kand) !== -1) return kand;
    }
    return liste[0];
  }

  function baueFolie(item) {
    var el = document.createElement('div');
    el.className = 'slide' + (item.fit === 'cover' ? ' fit-cover' : '');
    return new Promise(function (resolve) {
      var fertig = false;
      function ok(x) { if (!fertig) { fertig = true; resolve(x); } }
      setTimeout(function () { ok(item.kind === 'video' ? null : el); }, 12000);

      if (item.kind === 'text') {
        var t = item.text || {};
        el.innerHTML = '<div class="txt th-' + esc(t.theme || 'herbst') + '"><div class="inner">' +
          (t.badge ? '<span class="eyebrow"><i></i>' + esc(t.badge) + '</span>' : '') +
          '<h1>' + akzent(t.title) + '</h1>' + (t.sub ? '<p>' + esc(t.sub) + '</p>' : '') +
          '</div><img class="logo" src="/assets/logo.svg" alt=""></div>';
        return ok(el);
      }
      var src = '/media/' + encodeURIComponent(item.file);
      if (item.kind === 'image') {
        var img = new Image();
        img.className = 'fg';
        img.onload = function () {
          if (item.fit !== 'cover') {
            var bg = document.createElement('div');
            bg.className = 'bgblur';
            bg.style.backgroundImage = 'url("' + src + '")';
            el.appendChild(bg);
          }
          el.appendChild(img);
          ok(el);
        };
        img.onerror = function () { ok(null); };
        img.src = src;
        return;
      }
      if (item.kind === 'video') {
        var v = document.createElement('video');
        v.className = 'fg';
        v.muted = true;
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        v.preload = 'auto';
        v.loop = false;
        v.oncanplay = function () { ok(el); };
        v.onerror = function () { ok(null); };
        el.appendChild(v);
        v.src = src;
        v.load();
        return;
      }
      ok(null);
    });
  }

  function zeigeLeerlauf(an) {
    idle.hidden = !an;
    if (window.VeloIdle) { if (an) window.VeloIdle.start(); else window.VeloIdle.stop(); }
  }

  function weiter(sofort) {
    if (!state) return;
    var item = naechstes();
    if (!item) {
      if (aktuell) { entferne(aktuell); aktuell = null; }
      zeigeLeerlauf(true);
      planeNeu(15000);
      herzschlag();
      return;
    }
    zeigeLeerlauf(false);
    // einzelnes Bild/Text: nicht neu überblenden, nur später neu prüfen
    if (aktuell && aktuell.item.id === item.id && item.kind !== 'video' && aktive().length === 1 && !sofort && aktuell.rev === itemRev(item)) {
      planeNeu(item.duration * 1000);
      return;
    }
    var index = state.items.indexOf(item);
    zeiger = { id: item.id, index: index };
    baueFolie(item).then(function (el) {
      if (!el) { // defekte Datei überspringen
        fehlerZaehler++;
        planeNeu(fehlerZaehler > 5 ? 10000 : 300);
        return;
      }
      fehlerZaehler = 0;
      stage.appendChild(el);
      var alt = aktuell;
      aktuell = { item: item, el: el, index: index, rev: itemRev(item) };
      // zwei Frames warten, damit die Überblendung greift
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        el.classList.add('on');
        if (alt) { alt.el.classList.remove('on'); alt.el.classList.add('off'); setTimeout(function () { entferne(alt); }, 1300); }
      }); });
      if (item.kind === 'video') starteVideo(el.querySelector('video'), item);
      else planeNeu(Math.max(2, item.duration || 10) * 1000);
      herzschlag();
    });
  }
  var fehlerZaehler = 0;

  function itemRev(i) { return JSON.stringify([i.file, i.fit, i.text, i.duration, i.sound]); }

  function starteVideo(v, item) {
    var maxMs = item.duration > 0 ? item.duration * 1000 : ((item.mediaLength || 600) + 10) * 1000;
    planeNeu(maxMs);
    v.onended = function () { weiter(); };
    if (item.sound && !VORSCHAU) v.muted = false;
    var p = v.play();
    if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () { weiter(); }); });
  }

  var timer = null;
  function planeNeu(ms) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!VORSCHAU && Date.now() - gestartet > NEULADEN_NACH) return location.reload();
      weiter();
    }, ms);
  }

  function entferne(a) {
    if (!a || !a.el) return;
    var v = a.el.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) { /* egal */ } }
    if (a.el.parentNode) a.el.parentNode.removeChild(a.el);
  }

  function anwenden(neu) {
    var erster = !state;
    state = neu;
    var s = state.settings || {};
    stage.className = 't-' + (s.transition || 'fade');
    clockEl.hidden = !s.clock;
    cornerLogo.hidden = !s.showLogo;
    if (erster || !laeuft) { laeuft = true; weiter(); return; }
    // läuft gerade etwas, das gelöscht, pausiert oder geändert wurde? → sofort weiter
    if (aktuell) {
      var jetzt = state.items.filter(function (i) { return i.id === aktuell.item.id; })[0];
      if (!jetzt || !VeloSchedule.isActive(jetzt, new Date()) || itemRev(jetzt) !== aktuell.rev) { weiter(true); return; }
      aktuell.item = jetzt;
    } else {
      weiter();
    }
  }

  // ---------- Verbindung zur Zentrale ----------
  var es = null;
  function verbinden() {
    try { if (es) es.close(); } catch (e) { /* egal */ }
    es = new EventSource('/api/events?kind=tv&pc=' + encodeURIComponent(VORSCHAU ? 'Vorschau' : 'Fernseher'));
    es.addEventListener('state', function (e) { offlineDot.hidden = true; anwenden(JSON.parse(e.data)); });
    es.addEventListener('jump', function (e) { naechsterId = JSON.parse(e.data).id; weiter(true); });
    es.addEventListener('reload', function () { if (!VORSCHAU) location.reload(); });
    es.onerror = function () { offlineDot.hidden = VORSCHAU ? true : false; };
    es.onopen = function () { offlineDot.hidden = true; };
  }

  var letzterHerzschlag = 0;
  function herzschlag() {
    if (VORSCHAU) return;
    if (Date.now() - letzterHerzschlag < 3000) return;
    letzterHerzschlag = Date.now();
    var body = JSON.stringify({
      showing: aktuell ? aktuell.item.id : '',
      showingName: aktuell ? aktuell.item.name : (idle.hidden ? '' : 'Startbild (nichts geplant)'),
      screen: screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1),
      agent: navigator.userAgent,
      active: aktive().length,
      version: VERSION
    });
    fetch('/api/tv/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
      .then(function (r) { return r.json(); })
      .catch(function () { /* Zentrale gerade weg – Player läuft weiter */ });
  }
  setInterval(function () { letzterHerzschlag = 0; herzschlag(); }, 10000);

  // Uhr
  function uhr() {
    var d = new Date();
    clockEl.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  uhr(); setInterval(uhr, 5000);

  // Zeitplan auch ohne Änderungen regelmäßig prüfen (z. B. 18:00 → Abendprogramm)
  setInterval(function () {
    if (!state) return;
    var liste = aktive();
    if (!aktuell && liste.length) weiter();
    else if (aktuell && liste.indexOf(aktuell.item) === -1 && !VeloSchedule.isActive(aktuell.item, new Date())) weiter(true);
  }, 30000);

  // Vollbild (Browser verlangt einen Tastendruck)
  function vollbild() {
    var d = document.documentElement;
    var f = d.requestFullscreen || d.webkitRequestFullscreen;
    if (f && !document.fullscreenElement && !document.webkitFullscreenElement) { try { f.call(d); } catch (e) { /* egal */ } }
    hint.hidden = true;
  }
  if (!VORSCHAU && !qs.get('probe')) {
    hint.hidden = false;
    setTimeout(function () { hint.hidden = true; }, 12000);
    document.addEventListener('keydown', vollbild);
    document.addEventListener('click', vollbild);
  }

  // Probe-Modus (Text-Folien-Editor): genau einen Beitrag zeigen, ohne Verbindung
  if (qs.get('probe')) {
    try { anwenden({ items: [Object.assign({ enabled: true, plan: {}, duration: 3600 }, JSON.parse(qs.get('probe')))], settings: {} }); } catch (e) { /* egal */ }
    return;
  }
  // Erststart ohne SSE-Unterstützung: Zustand einmal holen
  fetch('/api/state').then(function (r) { return r.json(); }).then(function (s) { if (!state) anwenden(s); }).catch(function () {});
  verbinden();
})();
