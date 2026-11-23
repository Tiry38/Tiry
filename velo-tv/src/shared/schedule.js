/* Velo-TV – Zeitplan-Logik. Läuft im Fernseher-Player (Browser), in der Steuerung und in Node (Tests).
   Bewusst einfaches JavaScript (ES2017), damit auch ältere TV-Browser es verstehen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VeloSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function minuten(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return null;
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 24 || mi > 59) return null;
    return h * 60 + mi;
  }

  function datumZahl(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  function isoZahl(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : null;
  }

  /** Wochentag 1 = Montag … 7 = Sonntag */
  function wochentag(d) { var w = d.getDay(); return w === 0 ? 7 : w; }

  /** Ist der Beitrag zum Zeitpunkt `now` sichtbar? */
  function isActive(item, now) {
    if (!item || item.enabled === false) return false;
    now = now || new Date();
    var p = item.plan || {};
    var heute = datumZahl(now);
    var von = isoZahl(p.startDate), bis = isoZahl(p.endDate);
    if (von && heute < von) return false;
    if (bis && heute > bis) return false;
    if (p.days && p.days.length && p.days.length < 7 && p.days.indexOf(wochentag(now)) === -1) return false;
    var f = minuten(p.from), t = minuten(p.to);
    if (f !== null && t !== null && f !== t) {
      var jetzt = now.getHours() * 60 + now.getMinutes();
      if (f < t) { if (jetzt < f || jetzt >= t) return false; }
      else if (jetzt < f && jetzt >= t) return false; // über Mitternacht
    }
    return true;
  }

  /** Kurze, lesbare Beschreibung des Zeitplans für die Oberfläche. */
  function beschreibe(item) {
    var p = (item && item.plan) || {};
    var teile = [];
    if (p.days && p.days.length && p.days.length < 7) {
      var d = p.days.slice().sort();
      var zus = d.length > 2 && d[d.length - 1] - d[0] === d.length - 1;
      teile.push(zus ? TAGE[d[0] - 1] + '–' + TAGE[d[d.length - 1] - 1] : d.map(function (x) { return TAGE[x - 1]; }).join(', '));
    }
    if (minuten(p.from) !== null && minuten(p.to) !== null && p.from !== p.to) teile.push(p.from + '–' + p.to + ' Uhr');
    function de(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' : ''; }
    if (p.startDate && p.endDate) teile.push(de(p.startDate) + '–' + de(p.endDate));
    else if (p.startDate) teile.push('ab ' + de(p.startDate));
    else if (p.endDate) teile.push('bis ' + de(p.endDate));
    return teile.length ? teile.join(' · ') : 'Immer';
  }

  /** Ist der Zeitplan endgültig vorbei (Enddatum überschritten)? */
  function abgelaufen(item, now) {
    var bis = isoZahl(item && item.plan && item.plan.endDate);
    return !!bis && datumZahl(now || new Date()) > bis;
  }

  return { isActive: isActive, beschreibe: beschreibe, abgelaufen: abgelaufen, minuten: minuten, TAGE: TAGE };
});
