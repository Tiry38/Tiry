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

  function baue(daten) {
    var items = reihum((daten && daten.items) || []);
    if (!items.length) return null;
    var el = document.createElement('div');
    el.className = 'slide sr';
    el.innerHTML =
      '<div class="sr-stage">' +
        '<div class="sr-photo"></div><div class="sr-fog"></div><canvas class="sr-leaves"></canvas>' +
        '<div class="bands"><div class="band b">' + band(BAND_B) + '</div><div class="band a">' + band(BAND_A) + '</div></div>' +
        '<div class="sr-hero">' +
          '<div class="htxt">' +
            '<img class="biglogo" src="/assets/logo.svg" alt="Velocenter Hessert">' +
            '<p class="eyebrow"><i></i>Familienbetrieb seit 1995 · <b>Wörth am Rhein</b></p>' +
            '<h1 class="hh1">Dein E-Bike <span class="amp">&amp;</span> <span class="nw">E-Dreirad-Spezialist</span><br><span class="gt">mit eigener Werkstatt.</span></h1>' +
            '<p class="lead">Über 250 E-Bikes zum Probefahren, ehrliche Beratung und ein Bosch Service Center, in dem der Chef noch selbst schraubt.</p>' +
            '<div class="trust"><span class="tb"><i class="tic tg">G</i><b class="st">★</b><b>4,8</b> bei <b class="ggl"><i>G</i><i>o</i><i>o</i><i>g</i><i>l</i><i>e</i></b></span>' +
            '<span class="tb"><i class="tic tbo"></i><b class="bsh">Bosch</b> Service Center</span></div>' +
          '</div>' +
          '<div class="hvis">' +
            '<div class="hring"></div><img class="hlg" alt="">' +
            '<img class="hb off" alt=""><img class="hb off" alt="">' +
            '<div class="hfloor"></div>' +
          '</div>' +
          '<div class="deal">' +
            '<span class="dl-tag"><i></i>Angebot</span>' +
            '<span class="dl-txt"><b class="dl-m"></b><small class="dl-d"></small></span>' +
            '<span class="dl-p"><s class="dl-uvp"></s><b class="dl-ap"></b></span>' +
          '</div>' +
          '<div class="dl-dots"></div>' +
        '</div>' +
      '</div>';

    var stage = el.querySelector('.sr-stage');
    var bikes = el.querySelectorAll('.hb'), logo = el.querySelector('.hlg'), deal = el.querySelector('.deal');
    var dots = el.querySelector('.dl-dots');
    var i = -1, an = 0, timer = 0, aktiv = false, blaetter = null;

    function skalieren() {
      var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    }
    function punkte() {
      var n = Math.min(items.length, 24), k = i % n;
      var h = '';
      for (var j = 0; j < n; j++) h += '<i' + (j === k ? ' class="on"' : '') + '></i>';
      dots.innerHTML = h + (items.length > 1 ? '<span>' + (i + 1) + ' / ' + items.length + ' Angeboten</span>' : '');
    }
    function zeige() {
      if (!aktiv) return;
      i = (i + 1) % items.length;
      var x = items[i];
      var neu = bikes[an ^ 1], alt = bikes[an];
      var pre = new Image();
      var fertig = false;
      function los() {
        if (fertig || !aktiv) return; fertig = true;
        neu.src = x.img; neu.alt = x.marke + ' ' + x.modell;
        an ^= 1;
        alt.classList.add('off');
        logo.classList.add('swap');
        deal.classList.add('swap');
        setTimeout(function () {
          if (x.logo) { logo.src = x.logo; logo.style.opacity = ''; logo.style.setProperty('--wz', x.wz); logo.hidden = false; } else logo.hidden = true;
          el.querySelector('.dl-m').textContent = x.marke + ' ' + x.modell;
          el.querySelector('.dl-d').textContent = [x.farbe, x.gr, x.jahr ? 'Modell ' + x.jahr : ''].filter(Boolean).join(' · ');
          el.querySelector('.dl-uvp').innerHTML = '<em>UVP</em> ' + euro(x.preis);
          el.querySelector('.dl-ap').textContent = euro(x.angebot);
          stage.style.setProperty('--ac', x.akzent || '#8C9097');
          punkte();
          requestAnimationFrame(function () { neu.classList.remove('off'); logo.classList.remove('swap'); deal.classList.remove('swap'); });
        }, 320);
      }
      pre.onload = los; pre.onerror = los;
      pre.src = x.img;
      setTimeout(los, 2500);
      clearTimeout(timer);
      if (items.length > 1) timer = setTimeout(zeige, WECHSEL_MS);
    }

    el._start = function () {
      if (aktiv) return;
      aktiv = true;
      skalieren();
      window.addEventListener('resize', skalieren);
      if (window.VeloBlaetter) { blaetter = blaetter || window.VeloBlaetter(el.querySelector('.sr-leaves'), el); blaetter.start(); }
      zeige();
    };
    el._stop = function () {
      aktiv = false; clearTimeout(timer);
      window.removeEventListener('resize', skalieren);
      if (blaetter) blaetter.stop();
    };
    skalieren();
    return el;
  }

  window.VeloShowroom = {
    /** lädt die Angebote von der Zentrale und baut die Folie (null = keine Angebote) */
    laden: function () {
      return fetch('/api/showroom', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(baue);
    },
    baue: baue
  };
})();
