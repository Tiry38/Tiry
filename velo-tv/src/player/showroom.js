/* Velo-TV – Live-Showroom: Startseite der Homepage als Fernseher-Version.
   Laufbänder, Logo, Überschrift, Glas-Kreis mit Marken-Wasserzeichen und wechselnden Angebotsrädern aus dem Live-Bestand.
   Ohne Knöpfe (am Fernseher kann niemand tippen). Feste Bühne 1920×1080, wird auf den Bildschirm skaliert. ES2017. */
(function () {
  'use strict';
  var WECHSEL_MS = 8000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function euro(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
  function mischen(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /** Marken im Wechsel (wie der Homepage-Showroom): je Marke gemischt, dann reihum */
  function reihum(liste) {
    var g = {}, keys = [];
    liste.forEach(function (x) { var k = x.markeKey || x.marke; if (!g[k]) { g[k] = []; keys.push(k); } g[k].push(x); });
    keys = mischen(keys); keys.forEach(function (k) { g[k] = mischen(g[k]); });
    var out = [], rest = true;
    while (rest) { rest = false; keys.forEach(function (k) { if (g[k].length) { out.push(g[k].shift()); rest = true; } }); }
    return out;
  }

  var GOOGLE = '<b class="tkg"><i>G</i><i>o</i><i>o</i><i>g</i><i>l</i><i>e</i></b>';
  var BAND_A = ['Seit 1995', '4,8 <b class="tks">★</b> bei ' + GOOGLE, '<b class="tkb">Bosch</b> Service Center', '<b class="tko">i:SY</b> Experte', 'Weltrekord 283 <b class="tko">i:SY\'s</b>', '0 % Finanzierung'];
  var BAND_B = ['Wörth am Rhein', 'Hartmannstraße 25', 'Familienbetrieb', 'Probefahrt', 'Ehrliche Beratung', 'Angebote im Laden'];
  function band(teile) {
    var eins = teile.map(function (t) { return '<span>' + t + '<em>✦</em></span>'; }).join('');
    return '<div class="tk">' + eins + eins + eins + eins + '</div>';
  }

  // Homepage-Hintergrund (WebGL) nur rechnen, solange ein Showroom sichtbar ist
  var hgZahl = 0;
  function hgAn(d) {
    hgZahl = Math.max(0, hgZahl + d);
    document.documentElement.classList.toggle('hg-an', hgZahl > 0);
    window.HG_PAUSE = hgZahl === 0 || !!window.HG_AUS;
  }

  window.VeloHG = hgAn;
  // Vorschau in der Steuerung: Verwandlung aus, damit der Büro-PC nicht unnötig rechnet
  if (/[?&]vorschau/.test(location.search) && window.VM) VM.on = false;

  /* opts (nur für das Video-Rendern): fest = Reihenfolge wie geliefert, start = Index des ersten Wechsels, manuell = Wechsel nur über el._wechsel() */
  function baue(daten, opts) {
    opts = opts || {};
    var items = opts.fest ? ((daten && daten.items) || []).slice() : reihum((daten && daten.items) || []);
    if (!items.length) return null;
    var el = document.createElement('div');
    el.className = 'slide sr';
    el.innerHTML =
      '<div class="sr-stage">' +
        '<div class="sr-fog"></div><div class="halo"></div>' +
        '<div class="bands"><div class="band b">' + band(BAND_B) + '</div><div class="band a">' + band(BAND_A) + '</div></div>' +
        '<div class="sr-hero">' +
          '<div class="htxt hello">' +
            '<img class="biglogo" src="/assets/logo.svg" alt="Velocenter Hessert">' +
            '<p class="eyebrow"><i></i>Familienbetrieb seit 1995 · <b>Wörth am Rhein</b></p>' +
            '<h1 class="hh1">Dein E-Bike <span class="amp">&amp;</span> <span class="nw">E-Dreirad-Spezialist</span><br><span class="gt">mit eigener Werkstatt.</span></h1>' +
            '<p class="lead">Über 250 E-Bikes zum Probefahren, ehrliche Beratung und ein Bosch Service Center, in dem der Chef noch selbst schraubt.</p>' +
            '<div class="soc">' +
              '<span class="ig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg></span>' +
              '<span class="fb"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.3H16l.4-3h-2.9V8.9c0-.9.3-1.4 1.5-1.4h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8v3h2.6V21z"/></svg></span>' +
              '<span class="wa"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg></span>' +
            '</div>' +
          '</div>' +
          '<div class="hvis hello" style="--d:.35s">' +
            '<div class="hring"></div><img class="hlg" alt="">' +
            '<img class="hb off" alt=""><img class="hb off" alt="">' +
            '<div class="hfloor"></div>' +
          '</div>' +
          '<div class="deal hello" style="--d:.6s">' +
            '<div class="dhalo"></div>' +
            '<h2 class="dl-m"></h2>' +
            '<p class="dl-uvp"><span class="stt">statt</span> <s></s></p>' +
            '<div class="dl-pz"><span class="dl-ap"></span><em class="sp-b"></em></div>' +
            '<p class="dl-chips"></p>' +
            '<p class="dl-hin">Angebotspreise gelten nicht bei Leasing &amp; 0&nbsp;% Finanzierung</p>' +
          '</div>' +
          '<div class="dl-prog"><span class="dl-bar"><i></i></span><span class="dl-n"></span></div>' +
        '</div>' +
      '</div>';

    var stage = el.querySelector('.sr-stage');
    var bikes = el.querySelectorAll('.hb'), logo = el.querySelector('.hlg'), deal = el.querySelector('.deal'), hvis = el.querySelector('.hvis');
    var prog = el.querySelector('.dl-prog'), spar = el.querySelector('.sp-b');
    var i = opts.start != null ? ((opts.start - 2) % items.length + items.length) % items.length : -1, an = 0, timer = 0, aktiv = false;

    function skalieren() {
      var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    }
    function punkte() {
      // Fortschritt: Balken läuft in der Zeit bis zum nächsten Rad voll, daneben „12 / 59“
      prog.hidden = items.length < 2;
      prog.querySelector('.dl-n').innerHTML = '<b>' + (i + 1) + '</b> / ' + items.length;
      var bar = prog.querySelector('.dl-bar');
      bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
    }
    function scale() { return Math.min(window.innerWidth / 1920, window.innerHeight / 1080); }
    function texte(x) {
            var nm = x.marke + ' ' + x.modell, dm = el.querySelector('.dl-m');
      dm.textContent = nm;
      dm.style.fontSize = nm.length > 26 ? '50px' : nm.length > 20 ? '58px' : '';
      el.querySelector('.dl-chips').textContent = [String(x.farbe || '').replace(/\s*\(.*?\)\s*/g, ' ').trim(), x.rahmen, x.gr].filter(Boolean).join(' · ');
      el.querySelector('.dl-uvp s').textContent = euro(x.preis);
      el.querySelector('.dl-ap').innerHTML = esc(euro(x.angebot)).replace(' €', '<i>€</i>');
      var gespart = Math.round(x.preis - x.angebot);
      spar.hidden = !(gespart >= 50);
      el.querySelector('.sp-b').innerHTML = '<small>Du sparst</small>' + esc(euro(gespart));
      stage.style.setProperty('--ac', x.akzent || '#8C9097');
      logo.style.setProperty('--wz', x.wz);
      punkte();
    }
    var erstes = true, busy = false;
    function zeige() {
      if (!aktiv) return;
      clearTimeout(timer);
      if (items.length > 1 && !opts.manuell) timer = setTimeout(zeige, WECHSEL_MS);
      if (busy) return;
      i = (i + 1) % items.length;
      var x = items[i];
      var alt = bikes[an], neu = bikes[an ^ 1];
      if (erstes) { // erstes Rad ohne Übergang
        erstes = false;
        alt.src = x.img; logo.src = x.logo || ''; logo.hidden = !x.logo; texte(x);
        alt.classList.remove('off');
        return;
      }
      busy = true;
      neu.src = x.img; neu.alt = x.marke + ' ' + x.modell;
      deal.classList.add('aus');   // Zeilen gleiten nach oben weg
      var fertig = function () { busy = false; };
      var dec = function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); };
      Promise.race([dec(neu), new Promise(function (r) { setTimeout(r, 2500); })]).then(function () {
        if (!aktiv) return fertig();
        an ^= 1;
        // neue Zeilen: unten bereitstellen (ohne Übergang), dann zeitversetzt nach oben hereingleiten
        setTimeout(function () {
          texte(x);
          deal.classList.add('unten'); deal.classList.remove('aus');
          void deal.offsetWidth;
          requestAnimationFrame(function () { deal.classList.remove('unten'); });
        }, 700);
        // Original-Verwandlung der Homepage: Rad zerfällt in Laub und setzt sich neu zusammen (nur ohne Skalierung, sonst stimmen die Maße nicht)
        if (window.VM && VM.on && VM.ok && x.logo && Math.abs(scale() - 1) < 0.02) {
          logo.hidden = false;
          logo.style.setProperty('--wz', x.wz); // Deckkraft der neuen Marke vor der Verwandlung (sonst Ruck am Ende)
          VM.run({ root: hvis, bike: { oldEl: alt, newEl: neu, to: neu.currentSrc || neu.src, alt: neu.alt }, logo: { el: logo, to: x.logo } }).then(fertig, fertig);
          return;
        }
        // einfacher Wechsel wie die Homepage ohne WebGL
        alt.classList.add('off'); logo.classList.add('swap');
        setTimeout(function () {
          if (x.logo) { logo.src = x.logo; logo.hidden = false; } else logo.hidden = true;
          requestAnimationFrame(function () { neu.classList.remove('off'); logo.classList.remove('swap'); fertig(); });
        }, 300);
      });
    }

    el._start = function () {
      if (aktiv) return;
      aktiv = true;
      skalieren();
      window.addEventListener('resize', skalieren);
      hgAn(1);
      zeige();
      if (window.VM && VM.warm) setTimeout(function () { VM.warm(hvis, bikes[0], logo); }, 1200);
    };
    el._wechsel = function () { zeige(); };
    el._stop = function () {
      aktiv = false; clearTimeout(timer);
      window.removeEventListener('resize', skalieren);
      hgAn(-1);
    };
    skalieren();
    return el;
  }

  // Fertig gerendertes Showroom-Video (aus der Cloud): absolut flüssig auf jedem Fernseher.
  // Die Stelle wird gemerkt – beim nächsten Mal geht es mit den nächsten Rädern weiter.
  var videoPos = {};
  function baueVideo(v, einziges) {
    var el = document.createElement('div');
    el.className = 'slide sr-video';
    var vid = document.createElement('video');
    vid.muted = true; vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
    vid.preload = 'auto'; vid.loop = true;
    vid.src = v.url;
    el.appendChild(vid);
    var start = videoPos[v.version] || 0;
    vid.addEventListener('loadedmetadata', function () { if (start && start < vid.duration - 2) vid.currentTime = start; });
    el._start = function () { var p = vid.play(); if (p && p.catch) p.catch(function () {}); };
    el._stop = function () { try { videoPos[v.version] = vid.currentTime || 0; vid.pause(); } catch (e) { /* egal */ } };
    el._dauer = v.dauer || 0;
    el._ganz = function () { start = 0; videoPos[v.version] = 0; try { if (vid.currentTime > 0.5) vid.currentTime = 0; } catch (e) { /* egal */ } };
    return el;
  }

  window.VeloShowroom = {
    /** lädt die Angebote von der Zentrale und baut die Folie: Video, wenn vorhanden – sonst Live-Showroom (null = keine Angebote) */
    laden: function () {
      return fetch('/api/showroom', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.video && d.video.url && !/[?&]live/.test(location.search)) return baueVideo(d.video);
        return baue(d);
      });
    },
    baue: baue
  };
})();
