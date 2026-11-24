/* Velo-TV – animiertes Startbild („Herbstallee“): fallende Blätter in drei Tiefenebenen.
   Leistung für TV-Browser: Blätter werden einmal als Sprites vorgezeichnet, danach nur drawImage.
   Wird langsam der Rechner, reduziert sich die Blattzahl selbst. ES2017, keine Module. */
(function () {
  'use strict';
  var FARBEN = [
    ['#F59F00', '#E8590C'], ['#FAB005', '#F08C00'], ['#E8590C', '#C92A2A'], ['#D9480F', '#862E12'],
    ['#FFD43B', '#F59F00'], ['#C92A2A', '#7A1526'], ['#B87333', '#6B3A1E'], ['#F76707', '#A61E1E']
  ];
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sprites = [];

  // ---------- Blattformen ----------
  function ahorn(c, s) { // 5-zipfliges Ahornblatt
    c.beginPath();
    var pkt = [[0, -1], [.18, -.55], [.55, -.72], [.42, -.32], [.95, -.25], [.6, .05], [.78, .42], [.3, .3], [.08, .62],
      [0, .5], [-.08, .62], [-.3, .3], [-.78, .42], [-.6, .05], [-.95, -.25], [-.42, -.32], [-.55, -.72], [-.18, -.55]];
    for (var i = 0; i < pkt.length; i++) {
      var p = pkt[i], n = pkt[(i + 1) % pkt.length];
      if (i === 0) c.moveTo(p[0] * s, p[1] * s);
      c.quadraticCurveTo(p[0] * s * 1.02, p[1] * s * 1.02, (p[0] + n[0]) / 2 * s, (p[1] + n[1]) / 2 * s);
    }
    c.closePath();
  }
  function oval(c, s) { // Birke/Buche
    c.beginPath();
    c.moveTo(0, -s);
    c.bezierCurveTo(s * .62, -s * .55, s * .55, s * .45, 0, s * .82);
    c.bezierCurveTo(-s * .55, s * .45, -s * .62, -s * .55, 0, -s);
    c.closePath();
  }
  function eiche(c, s) { // gewellter Rand
    c.beginPath();
    c.moveTo(0, -s);
    for (var i = 0; i <= 10; i++) {
      var t = i / 10, y = -s + t * 1.75 * s, r = Math.sin(t * Math.PI) * s * .5 * (i % 2 ? 1.25 : .85);
      c.quadraticCurveTo(r * 1.1, y - s * .08, r, y);
    }
    for (var j = 10; j >= 0; j--) {
      var t2 = j / 10, y2 = -s + t2 * 1.75 * s, r2 = Math.sin(t2 * Math.PI) * s * .5 * (j % 2 ? 1.25 : .85);
      c.quadraticCurveTo(-r2 * 1.1, y2 + s * .08, -r2, y2);
    }
    c.closePath();
  }
  var FORMEN = [ahorn, ahorn, oval, eiche];

  function baueSprite(form, farbe) {
    var g = 96, cv = document.createElement('canvas');
    cv.width = cv.height = g * 2;
    var c = cv.getContext('2d');
    c.translate(g, g);
    var s = g * .82;
    var grad = c.createLinearGradient(-s, -s, s, s);
    grad.addColorStop(0, farbe[0]); grad.addColorStop(1, farbe[1]);
    c.shadowColor = 'rgba(40,20,5,.35)'; c.shadowBlur = 10; c.shadowOffsetY = 5;
    form(c, s); c.fillStyle = grad; c.fill();
    c.shadowColor = 'transparent';
    // Glanz + Adern
    var licht = c.createRadialGradient(-s * .3, -s * .4, 2, -s * .2, -s * .3, s * 1.1);
    licht.addColorStop(0, 'rgba(255,255,220,.38)'); licht.addColorStop(1, 'rgba(255,255,220,0)');
    form(c, s); c.fillStyle = licht; c.fill();
    c.strokeStyle = 'rgba(90,35,10,.35)'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -s * .85); c.lineTo(0, s * .95); c.stroke();
    c.lineWidth = 1.3;
    for (var i = 1; i <= 3; i++) {
      var y = -s * .55 + i * s * .3;
      c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(s * .2, y - s * .12, s * .38, y - s * .3); c.stroke();
      c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(-s * .2, y - s * .12, -s * .38, y - s * .3); c.stroke();
    }
    return cv;
  }

  function sprites_() {
    if (sprites.length) return;
    for (var f = 0; f < FORMEN.length; f++) for (var k = 0; k < FARBEN.length; k++) sprites.push(baueSprite(FORMEN[f], FARBEN[k]));
  }

  /** Blätter-Animation auf einer Leinwand. leichtEl bekommt die Klasse „leicht“, wenn der Fernseher zu langsam ist. */
  function Blaetter(canvas, leichtEl) {
    var ctx = canvas.getContext('2d'), blaetter = [], laeuft = false, raf = 0, letzte = 0, w = 0, h = 0, dpr = 1;
    var wind = 0, windZiel = 0, windT = 0, zeitMittel = 16, ziel = 46, startZeit = 0, leicht = false;

    // Tiefe: 0 = fern (klein, blass, langsam), 2 = nah (groß, schnell)
    function neuesBlatt(oben) {
      var r = Math.random(), tiefe = r < .5 ? 0 : (r < .85 ? 1 : 2);
      var groesse = [20, 38, 70][tiefe] * (0.75 + Math.random() * .5) * Math.min(1.6, Math.max(.7, w / 1920));
      return {
        x: Math.random() * w * 1.2 - w * .1,
        y: oben ? -groesse * 2 - Math.random() * h * .3 : Math.random() * h,
        s: groesse, tiefe: tiefe,
        vy: [26, 46, 88][tiefe] * (0.7 + Math.random() * .6),
        sway: 18 + Math.random() * 46, swayF: .4 + Math.random() * .9, phase: Math.random() * 6.3,
        rot: Math.random() * 6.3, vr: (Math.random() - .5) * 1.6,
        flip: Math.random() * 6.3, vf: .8 + Math.random() * 2.2,
        alpha: [.55, .82, .95][tiefe],
        img: sprites[(Math.random() * sprites.length) | 0]
      };
    }
    function groesseAnpassen() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = canvas.clientWidth || window.innerWidth; h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function bild(t) {
      if (!laeuft) return;
      raf = requestAnimationFrame(bild);
      var dt = Math.min(.05, (t - (letzte || t)) / 1000);
      zeitMittel = zeitMittel * .95 + (t - (letzte || t)) * .05;
      letzte = t;
      // Leistung (nach 4 s Anlauf): erst Licht/Nebel anhalten, dann weniger Blätter
      if (!startZeit) startZeit = t;
      if (t - startZeit > 4000 && zeitMittel > 36) {
        if (!leicht) { leicht = true; if (leichtEl) leichtEl.classList.add('leicht'); zeitMittel = 20; }
        else if (ziel > 16) ziel -= 1;
      }
      while (blaetter.length > ziel) blaetter.pop();
      while (blaetter.length < ziel) blaetter.push(neuesBlatt(true));
      windT -= dt;
      if (windT <= 0) { windZiel = (Math.random() - .35) * 70; windT = 4 + Math.random() * 6; }
      wind += (windZiel - wind) * dt * .5;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < blaetter.length; i++) {
        var b = blaetter[i];
        b.phase += dt * b.swayF;
        b.y += b.vy * dt;
        b.x += (Math.sin(b.phase) * b.sway + wind * (0.5 + b.tiefe * .45)) * dt;
        b.rot += b.vr * dt + Math.sin(b.phase) * dt * .6;
        b.flip += b.vf * dt;
        if (b.y > h + b.s * 2 || b.x < -w * .2 || b.x > w * 1.2) { blaetter[i] = neuesBlatt(true); continue; }
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(Math.cos(b.flip) * .85 + .15 * (Math.cos(b.flip) < 0 ? -1 : 1), 1); // Taumeln (3D-Wende)
        ctx.drawImage(b.img, -b.s, -b.s, b.s * 2, b.s * 2);
        ctx.restore();
      }
    }
    function onResize() { groesseAnpassen(); }
    return {
      start: function () {
        if (laeuft || ruhig) return;
        sprites_();
        groesseAnpassen();
        if (!blaetter.length) for (var i = 0; i < ziel; i++) blaetter.push(neuesBlatt(false));
        laeuft = true; letzte = 0; startZeit = 0;
        window.addEventListener('resize', onResize);
        raf = requestAnimationFrame(bild);
      },
      stop: function () { laeuft = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); }
    };
  }

  var idleEngine = null;
  function start() {
    var c = document.getElementById('leaves');
    if (!c) return;
    idleEngine = idleEngine || Blaetter(c, document.getElementById('idle'));
    idleEngine.start();
  }
  function stop() { if (idleEngine) idleEngine.stop(); }

  // Uhr + Datum im Startbild
  var TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function uhr() {
    var el = document.getElementById('idleTime'), d = new Date();
    if (!el) return;
    el.innerHTML = '<b>' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '</b>' +
      TAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MON[d.getMonth()];
  }
  uhr(); setInterval(uhr, 10000);

  window.VeloIdle = { start: start, stop: stop };
  window.VeloBlaetter = Blaetter;
})();
