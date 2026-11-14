/* Durchzieher-Zentrale – Oberfläche */
(function () {
  'use strict';
  const E = window.DZEngine;
  const M = window.DZMeta;
  const KEY = 'dz-state-v1';
  const TOKEN_KEY = 'dz-token';
  const UI_KEY = 'dz-ui-v1';

  /* ---------- Speicher ---------- */
  function load() {
    try { const t = localStorage.getItem(KEY); if (t) return E.importJson(t); } catch (e) { /* leer */ }
    return E.emptyState();
  }
  function save() {
    try { localStorage.setItem(KEY, E.exportJson(state)); } catch (e) { toast('Speichern im Browser nicht möglich – bitte Daten exportieren.', 'bad'); }
  }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(v) { try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* leer */ } }
  function loadUi() { try { return Object.assign({ q: '', status: 'alle', sort: 'tage' }, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch (e) { return { q: '', status: 'alle', sort: 'tage' }; } }
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ status: ui.status, sort: ui.sort })); } catch (e) { /* leer */ } }

  let state = load();
  let res = E.compute(state);
  const ui = loadUi();
  let busy = false;

  function recompute() { res = E.compute(state); }
  function commit() { save(); recompute(); render(); }

  /* ---------- Helfer ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function h(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const nf = new Intl.NumberFormat('de-DE');
  const n = (x) => nf.format(x || 0);
  function initials(name) {
    const p = String(name || '?').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function hue(id) { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
  function fmtStamp(iso) {
    if (!iso) return 'noch nie';
    const p = E.berlinParts(iso);
    return E.fmtDateDe(p.date) + ' ' + p.time + ' Uhr';
  }
  const ICONS = {
    home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    people: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.6c2.6.1 4.4 1.7 5 4.9"/>',
    days: '<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="8.5" cy="14.5" r="1.2"/><circle cx="12" cy="14.5" r="1.2"/><circle cx="15.5" cy="14.5" r="1.2"/>',
    draw: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.5l3 2"/><path d="M12 3.5V2M12 22v-1.5"/>',
    joker: '<path d="M6 4h9l3 3v13H6z"/><path d="M9.5 11.5h5M12 9v5"/><circle cx="12" cy="17.5" r=".9"/>',
    data: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 16"/><path d="M20 20.5V16h-4.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="3"/><path d="M7 14h10v6.5H7z"/>',
    dl: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>',
    up: '<path d="M12 16V5M7 9.5l5-5 5 5"/><path d="M4.5 19.5h15"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="3"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  };
  function ic(name, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>'; }

  const VIEWS = [
    { id: 'uebersicht', label: 'Übersicht', short: 'Start', icon: 'home' },
    { id: 'teilnehmer', label: 'Teilnehmer', short: 'Leute', icon: 'people' },
    { id: 'tage', label: 'Tage', short: 'Tage', icon: 'days' },
    { id: 'auslosung', label: 'Auslosung', short: 'Los', icon: 'draw' },
    { id: 'joker', label: 'Joker', short: 'Joker', icon: 'joker' },
    { id: 'daten', label: 'Daten', short: 'Daten', icon: 'data' },
    { id: 'einstellungen', label: 'Einstellungen', short: 'Setup', icon: 'gear' },
  ];

  function route() {
    const raw = decodeURIComponent((location.hash || '#uebersicht').slice(1));
    const [view, arg] = raw.split('/');
    return { view: VIEWS.some((v) => v.id === view) || view === 'person' ? view : 'uebersicht', arg: arg || '' };
  }

  /* ---------- Rahmen ---------- */
  function renderNav(cur) {
    const active = cur === 'person' ? 'teilnehmer' : cur;
    const item = (v, mobile) => '<a href="#' + v.id + '" class="nav-i' + (v.id === active ? ' on' : '') + '"' + (v.id === active ? ' aria-current="page"' : '') + '>' + ic(v.icon) + '<span>' + h(mobile ? v.short : v.label) + '</span></a>';
    $('#nav').innerHTML = VIEWS.map((v) => item(v, false)).join('');
    $('#dock').innerHTML = VIEWS.map((v) => item(v, true)).join('');
    const t = res.today;
    const pct = t.phase === 'vor' ? 0 : t.phase === 'vorbei' ? 100 : Math.round(((t.current - 1) / 30) * 100);
    $('#sideFoot').innerHTML = ring(pct, 64, 7) + '<div><strong>' + dayLabel() + '</strong><small>' + h(phaseText()) + '</small></div>';
    $('#fetchInfo').textContent = 'Stand: ' + fmtStamp(state.lastFetch);
  }
  function dayLabel() {
    const t = res.today;
    if (t.phase === 'vor') return 'Start in ' + (1 - t.dayIndex) + ' Tag' + (1 - t.dayIndex === 1 ? '' : 'en');
    if (t.phase === 'vorbei') return 'Alle 30 Tage vorbei';
    return 'Tag ' + t.current + ' von 30';
  }
  function phaseText() {
    const s = res.settings;
    const range = E.fmtDateDe(s.startDate) + ' – ' + E.fmtDateDe(E.dayDate(s, 30));
    return (s.asOf ? 'Teststichtag ' + E.fmtDateDe(s.asOf) + ' · ' : '') + range;
  }
  function ring(pct, size, stroke) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><defs><linearGradient id="rg' + size + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E2232D"/><stop offset=".6" stop-color="#D08B52"/><stop offset="1" stop-color="#F2C66D"/></linearGradient></defs>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#rg' + size + ')" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '<text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-t">' + pct + '%</text></svg>';
  }
  function chip(status) {
    return '<span class="chip st-' + status + '">' + h(E.STATUS[status]) + '</span>';
  }
  function avatar(p, big) {
    return '<span class="av' + (big ? ' big' : '') + '" data-hue="' + hue(p.id) + '" aria-hidden="true">' + h(initials(p.name)) + '</span>';
  }
  function dots(p) {
    const t = res.today;
    let s = '<svg class="strip" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">';
    for (let d = 1; d <= 30; d++) {
      const x = (d - 1) * 10 + 5;
      let cls = 'o';
      if (p.done[d]) cls = 'd';
      else if (p.joker && p.joker.covers && p.joker.day === d) cls = 'j';
      else if (d <= t.closedUpTo) cls = 'm';
      s += '<circle class="s' + cls + '" cx="' + x + '" cy="6" r="4"/>';
    }
    return s + '</svg>';
  }
  function weekPills(p) {
    return '<span class="wk">' + E.WEEKS.map((w) => '<span class="wp w-' + p.weeks[w.key].replace('ä', 'ae') + '" title="' + w.label + ': ' + p.weeks[w.key] + '">' + w.key + '</span>').join('') + '</span>';
  }

  /* ---------- Ansichten ---------- */
  function viewOverview() {
    const c = res.counts, t = res.today;
    const pct = t.phase === 'vor' ? 0 : t.phase === 'vorbei' ? 100 : Math.round(((t.current - 1) / 30) * 100);
    const warn = res.warnings.map((w) => '<p class="note ' + (w.kind === 'anon' ? 'bad' : '') + '">' + h(w.text) + '</p>').join('');
    const empty = !state.comments.length ? '<div class="glass empty"><h2>Noch keine Daten</h2><p>Unter <a href="#einstellungen">Einstellungen</a> den Facebook-Token eintragen und „Jetzt abrufen“ drücken. Ohne Token: Kommentare unter <a href="#daten">Daten</a> von Hand eintragen. Zum Ausprobieren: <button type="button" class="btn btn-soft" data-act="demo">Demo-Daten laden</button></p></div>' : '';
    const orbs = [
      { k: 'Teilnehmer', v: c.participants, cls: 'o1' },
      { k: t.phase === 'vorbei' ? 'Am Tag 30 aktiv' : 'Heute aktiv', v: c.activeToday, cls: 'o2' },
      { k: 'Im Rennen', v: c.inRace, cls: 'o3' },
      { k: 'Raus', v: c.out, cls: 'o4' },
    ].map((o) => '<div class="orb ' + o.cls + '"><strong>' + n(o.v) + '</strong><span>' + h(o.k) + '</span></div>').join('');
    const top = res.persons.slice().sort((a, b) => b.streak - a.streak || b.fulfilled - a.fulfilled).slice(0, 5)
      .map((p) => '<li><a href="#person/' + encodeURIComponent(p.id) + '">' + avatar(p) + '<span class="tn">' + h(p.name) + '</span><span class="tv">' + p.streak + ' in Folge</span></a></li>').join('');
    const maxF = Math.max(1, res.funnel[0].n);
    const funnel = res.funnel.map((f, i) => '<div class="fn"><span class="fl">' + h(f.label) + '</span><span class="fbar"><span class="fill f' + i + '" data-w="' + Math.max(4, Math.round((f.n / maxF) * 100)) + '"></span></span><strong>' + n(f.n) + '</strong></div>').join('');
    return empty + warn +
      '<section class="hero glass">' +
      '<div class="hero-day">' + ring(pct, 132, 12) + '<div><p class="eyebrow">' + h(t.phase === 'vor' ? 'Vorbereitung' : t.phase === 'vorbei' ? 'Abgeschlossen' : 'Läuft') + '</p><h2>' + dayLabel() + '</h2><p class="muted">' + h(phaseText()) + '</p>' +
      '<p class="chips"><span class="chip st-durchzieher">' + n(c.finishers) + ' Durchzieher</span><span class="chip st-joker">' + n(c.jokerNeeded) + ' Joker nötig</span></p></div></div>' +
      '<div class="orbs">' + orbs + '</div></section>' +
      '<section class="glass panel"><div class="ph"><h2>Kommentare und Likes je Tag</h2><span class="legend"><i class="lg-c"></i>pünktliche Kommentare <i class="lg-l"></i>Likes</span></div>' + chart() + '</section>' +
      '<div class="two">' +
      '<section class="glass panel"><h2>Wer hält durch?</h2><div class="funnel">' + funnel + '</div></section>' +
      '<section class="glass panel"><h2>Längste Serien gerade</h2>' + (top ? '<ol class="toplist">' + top + '</ol>' : '<p class="muted">Noch niemand dabei.</p>') + '</section>' +
      '</div>' +
      '<p class="muted small">' + n(c.comments) + ' Kommentare · ' + n(c.likes) + ' Likes · ' + n(c.excluded) + ' ausgeschlossen (eigene Seite, Mitarbeiter, Sperrliste)</p>';
  }

  function chart() {
    const W = 900, H = 240, pad = 30, bw = (W - pad * 2) / 30;
    const maxC = Math.max(5, ...res.days.map((d) => d.onTime));
    const maxL = Math.max(5, ...res.days.map((d) => d.likes));
    let bars = '', line = '', pts = '';
    res.days.forEach((d, i) => {
      const x = pad + i * bw;
      const bh = ((H - 50) * d.onTime) / maxC;
      bars += '<rect class="bar" x="' + (x + bw * 0.18).toFixed(1) + '" y="' + (H - 26 - bh).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" rx="' + (bw * 0.32).toFixed(1) + '"><title>Tag ' + d.day + ': ' + d.onTime + ' Kommentare, ' + d.likes + ' Likes</title></rect>';
      const ly = H - 26 - ((H - 50) * d.likes) / maxL;
      line += (i ? 'L' : 'M') + (x + bw / 2).toFixed(1) + ' ' + ly.toFixed(1);
      pts += '<circle class="pt" cx="' + (x + bw / 2).toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="3.2"/>';
      if (d.day === 1 || d.day % 5 === 0) pts += '<text class="ax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.day + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Balkendiagramm: Kommentare und Likes je Tag"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A61"/><stop offset="1" stop-color="#CF1A2C"/></linearGradient></defs>' +
      bars + '<path class="ln" d="' + line + '"/>' + pts + '</svg>';
  }

  function filteredPersons() {
    const q = E.normName(ui.q);
    let list = res.persons.filter((p) => (ui.status === 'alle' || p.status === ui.status) && (!q || E.normName(p.name).includes(q) || String(p.id).includes(q)));
    const by = {
      tage: (a, b) => b.fulfilled - a.fulfilled || b.streak - a.streak,
      serie: (a, b) => b.streak - a.streak || b.fulfilled - a.fulfilled,
      likes: (a, b) => b.likes - a.likes,
      name: (a, b) => a.name.localeCompare(b.name, 'de'),
    }[ui.sort] || (() => 0);
    return list.slice().sort(by);
  }
  function personRows() {
    const list = filteredPersons();
    if (!list.length) return '<p class="muted pad">Keine Treffer.</p>';
    return list.map((p) => '<a class="prow" href="#person/' + encodeURIComponent(p.id) + '">' +
      '<span class="pc-name">' + avatar(p) + '<span><strong>' + h(p.name) + '</strong>' + chip(p.status) + (p.weeklyWin ? '<span class="chip st-win">' + ic('star') + p.weeklyWin + '</span>' : '') + '</span></span>' +
      '<span class="pc-strip">' + dots(p) + weekPills(p) + '</span>' +
      '<span class="pc-stats">' +
      '<span class="st"><strong>' + p.fulfilled + '</strong>/30<small>Tage</small></span>' +
      '<span class="st"><strong>' + p.streak + '</strong><small>in Folge</small></span>' +
      '<span class="st"><strong>' + p.longest + '</strong><small>längste</small></span>' +
      '<span class="st"><strong>' + p.likes + '</strong><small>Likes</small></span>' +
      '<span class="st"><strong>' + (p.joker ? h(p.joker.code.slice(3)) : '–') + '</strong><small>Joker</small></span>' +
      '</span></a>').join('');
  }
  function viewPeople() {
    const counts = { alle: res.persons.length };
    for (const p of res.persons) counts[p.status] = (counts[p.status] || 0) + 1;
    const filters = [['alle', 'Alle'], ['rennen', 'Im Rennen'], ['joker', 'Joker nötig'], ['durchzieher', 'Durchzieher'], ['raus', 'Raus']]
      .map(([k, l]) => '<button type="button" class="pill' + (ui.status === k ? ' on' : '') + '" data-act="filter" data-v="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + ' <b>' + (counts[k] || 0) + '</b></button>').join('');
    return '<div class="toolbar glass">' +
      '<label class="search">' + ic('eye') + '<span class="sr">Suchen</span><input id="q" type="search" placeholder="Name oder ID suchen" value="' + h(ui.q) + '" autocomplete="off"></label>' +
      '<label class="sel"><span>Sortieren</span><select id="sort"><option value="tage">nach Tagen</option><option value="serie">nach Serie</option><option value="likes">nach Likes</option><option value="name">nach Name</option></select></label>' +
      '<div class="pills">' + filters + '</div></div>' +
      '<div id="plist" class="plist">' + personRows() + '</div>' +
      '<p class="muted small">Grün = Kommentar pünktlich · Gold = Joker · Rot = verpasst · Grau = offen</p>';
  }

  function viewPerson(id) {
    const p = res.byId.get(id);
    if (!p) return '<div class="glass panel"><p>Person nicht gefunden.</p><a class="btn btn-soft" href="#teilnehmer">' + ic('back') + 'Zurück</a></div>';
    const t = res.today;
    let grid = '';
    for (let d = 1; d <= 30; d++) {
      let cls = 'open', lab = 'offen';
      const cm = p.comments.filter((c) => c.day === d);
      if (p.done[d]) { cls = 'done'; lab = 'erfüllt'; }
      else if (p.joker && p.joker.covers && p.joker.day === d) { cls = 'jok'; lab = 'Joker'; }
      else if (cm.length) { cls = 'late'; lab = 'nur zu spät'; }
      else if (d <= t.closedUpTo) { cls = 'miss'; lab = 'verpasst'; }
      const liked = p.likesByDay[d] > 0;
      grid += '<span class="dc ' + cls + '" title="Tag ' + d + ' (' + E.fmtDateDe(E.dayDate(res.settings, d)) + '): ' + lab + (liked ? ', geliked' : '') + '"><b>' + d + '</b>' + (liked ? '<i class="hz">' + ic('heart') + '</i>' : '') + '</span>';
    }
    const comments = p.comments.map((c) => '<li class="' + (c.late ? 'is-late' : '') + '"><span class="cd">' + c.day + '</span><div><p class="cm-h">' + E.fmtDateDe(c.date) + ' · ' + (c.time ? h(c.time) + ' Uhr' : 'Zeit unbekannt') + (c.late ? ' <span class="chip st-raus">zu spät</span>' : '') + (c.source === 'manuell' ? ' <span class="chip">manuell</span>' : '') + '</p><p>' + h(c.text || '–') + '</p></div></li>').join('');
    const notes = p.notes.map((x) => '<p class="note bad">' + h(x) + '</p>').join('');
    const stats = [['Tage', p.fulfilled + '/30'], ['In Folge', p.streak], ['Längste', p.longest], ['Likes', p.likes], ['Zu spät', p.lateCount]]
      .map(([k, v]) => '<div class="orb sm"><strong>' + h(v) + '</strong><span>' + k + '</span></div>').join('');
    return '<a class="btn btn-soft back" href="#teilnehmer">' + ic('back') + 'Alle Teilnehmer</a>' + notes +
      '<section class="glass hero person">' +
      '<div class="ph-id">' + avatar(p, true) + '<div><h2>' + h(p.name) + '</h2><p>' + chip(p.status) + (p.weeklyWin ? ' <span class="chip st-win">' + ic('star') + 'Wochensieger ' + p.weeklyWin + '</span>' : '') + '</p><p class="muted small">Facebook-ID ' + h(p.id) + '</p></div></div>' +
      '<div class="orbs">' + stats + '</div></section>' +
      '<section class="glass panel"><div class="ph"><h2>30 Tage</h2>' + weekPills(p) + '</div><div class="dgrid">' + grid + '</div>' +
      '<p class="muted small">Verpasst: ' + (p.missed.length ? p.missed.join(', ') : 'keine') + ' · Joker: ' + (p.joker ? h(p.joker.code) + ' auf Tag ' + p.joker.day : 'frei') + '</p></section>' +
      '<section class="glass panel"><h2>Kommentare</h2><ol class="clist">' + (comments || '<li>Keine Kommentare.</li>') + '</ol></section>';
  }

  function viewDays() {
    const t = res.today;
    const opts = (sel) => '<option value="">automatisch</option>' + Array.from({ length: 30 }, (_, i) => '<option value="' + (i + 1) + '"' + (Number(sel) === i + 1 ? ' selected' : '') + '>Tag ' + (i + 1) + '</option>').join('') + '<option value="0"' + (Number(sel) === 0 && sel !== null && sel !== '' ? ' selected' : '') + '>nicht zählen</option>';
    const rows = res.days.map((d) => {
      const state_ = d.day <= t.closedUpTo ? 'vorbei' : d.day === t.current ? 'heute' : 'offen';
      const post = d.posts[0];
      const title = post ? (post.message || '').split('\n')[0] : 'Kein Beitrag zugeordnet';
      const postCtl = d.posts.map((p) => '<label class="sel small"><span>Zuordnung</span><select data-act="override" data-id="' + h(p.id) + '">' + opts(p.dayOverride) + '</select></label>' + (p.permalink_url ? '<a class="btn btn-ghost" href="' + h(p.permalink_url) + '" target="_blank" rel="noopener noreferrer">' + ic('ext') + 'Beitrag</a>' : '')).join('');
      const people = d.comments.filter((c) => !c.anon).map((c) => '<li class="' + (c.late ? 'is-late' : '') + '"><a href="#person/' + encodeURIComponent(c.userId) + '">' + h(c.name) + '</a> <span class="muted">' + h(c.time) + (c.late ? ' · ' + E.fmtDateDe(c.date) + ' zu spät' : '') + '</span><br>' + h(c.text) + '</li>').join('');
      const likers = d.likers.map((l) => h(l.name)).join(', ');
      return '<details class="drow glass ' + state_ + '"><summary>' +
        '<span class="dnum">' + d.day + '</span>' +
        '<span class="dmeta"><strong>' + E.fmtDateDe(d.date) + (state_ === 'heute' ? ' · heute' : '') + '</strong><span class="muted">' + h(title) + '</span></span>' +
        '<span class="dstats"><span class="st"><strong>' + d.onTime + '</strong><small>pünktlich</small></span><span class="st"><strong>' + d.late + '</strong><small>zu spät</small></span><span class="st"><strong>' + d.likes + '</strong><small>Likes</small></span></span>' +
        '</summary><div class="dbody"><div class="dctl">' + (postCtl || '<span class="muted">Kein Beitrag. Kommentare dieses Tages können unter Daten von Hand eingetragen werden.</span>') + '</div>' +
        '<div class="two"><div><h3>Kommentare</h3><ul class="mini">' + (people || '<li class="muted">Keine</li>') + '</ul></div><div><h3>Likes</h3><p class="muted">' + (likers || 'Keine mit Namen') + '</p></div></div></div></details>';
    }).join('');
    const un = res.unassigned.map((p) => '<li class="glass urow"><span>' + h((p.message || '(ohne Text)').split('\n')[0]) + '<br><small class="muted">' + fmtStamp(p.created_time) + '</small></span><label class="sel small"><span>Zuordnung</span><select data-act="override" data-id="' + h(p.id) + '">' + opts(p.dayOverride) + '</select></label></li>').join('');
    return '<p class="muted">Ein Beitrag wird über „Türchen N/30“ am Textanfang einem Tag zugeordnet, sonst über das Datum. Falsch zugeordnet? Unten in der Zeile ändern.</p>' +
      '<div class="dlist">' + rows + '</div>' + (un ? '<h2 class="sec">Nicht zugeordnete Beiträge</h2><ul class="ulist">' + un + '</ul>' : '');
  }

  function drawCard(key, label, range, poolList, closed, extra) {
    const d = state.draws[key];
    const res_ = d ? '<div class="winners">' + d.winners.map((w) => '<a class="win" href="#person/' + encodeURIComponent(w.id) + '">' + ic('star') + h(w.name) + '</a>').join('') +
      (d.backups.length ? '<p class="muted small">Nachrücker: ' + d.backups.map((w, i) => (i + 1) + '. ' + h(w.name)).join(' · ') + '</p>' : '') +
      '<p class="muted small mono">Gezogen ' + fmtStamp(d.time) + ' · Lostopf ' + d.poolSize + ' · SHA-256 ' + h(d.poolHash.slice(0, 16)) + '…</p></div>' : '';
    const btn = closed ? '<button type="button" class="btn ' + (d ? 'btn-soft' : 'btn-grad') + '" data-act="draw" data-key="' + key + '"' + (poolList.length ? '' : ' disabled') + '>' + ic('draw') + (d ? 'Neu ziehen' : 'Jetzt auslosen') + '</button>' : '<span class="chip">läuft noch</span>';
    return '<section class="glass dcard' + (key === 'MAIN' ? ' main-prize' : '') + '"><div class="ph"><div><p class="eyebrow">' + h(range) + '</p><h2>' + h(label) + '</h2></div>' + btn + '</div>' +
      '<p class="pool"><strong>' + poolList.length + '</strong> im Lostopf ' + h(extra) + '</p>' + res_ + '</section>';
  }
  function viewDraw() {
    const s = res.settings;
    const weeks = E.WEEKS.map((w) => drawCard(w.key, w.label + ' · ' + s.weeklyWinners + ' Gewinner', E.fmtDateDe(E.dayDate(s, w.from)) + ' – ' + E.fmtDateDe(E.dayDate(s, w.to)), E.weekPool(res, state, w.key), E.weekClosed(res, w.key), '(alle 7 Tage erfüllt, noch kein Wochengewinn)')).join('');
    const main = drawCard('MAIN', 'Hauptpreis: das E-Bike', 'Auslosung nach Tag 30', E.mainPool(res), res.today.closedUpTo >= 30, '(alle Durchzieher, 30/30 inkl. Joker)');
    return '<div class="actions"><button type="button" class="btn btn-soft" data-act="protocol">' + ic('dl') + 'Protokoll herunterladen</button><button type="button" class="btn btn-soft" data-act="protocol-copy">' + ic('copy') + 'Protokoll kopieren</button></div>' +
      main + '<div class="dgrid2">' + weeks + '</div>' +
      '<p class="muted small">Zufall über den Zufallsgenerator des Browsers (crypto.getRandomValues). Der SHA-256-Wert belegt, welche Liste im Lostopf war. Pro Person höchstens ein Wochengewinn.</p>';
  }

  function viewJoker() {
    const all = state.jokers;
    const used = all.filter((j) => j.used);
    const needing = res.persons.filter((p) => p.status === 'joker');
    const others = res.persons.filter((p) => p.status !== 'joker' && !p.joker);
    const opt = (p) => '<option value="' + h(p.id) + '">' + h(p.name) + (p.gaps.length ? ' – verpasst Tag ' + p.gaps.join(', ') : '') + '</option>';
    const list = used.map((j) => '<li class="glass urow"><span><strong class="mono">' + h(j.code) + '</strong><br><a href="#person/' + encodeURIComponent(j.userId) + '">' + h(j.name) + '</a> · Tag ' + j.day + '</span><button type="button" class="btn btn-ghost" data-act="joker-free" data-code="' + h(j.code) + '">Freigeben</button></li>').join('');
    return '<section class="hero glass"><div class="orbs">' +
      '<div class="orb o1"><strong>' + all.length + '</strong><span>Codes</span></div><div class="orb o3"><strong>' + (all.length - used.length) + '</strong><span>frei</span></div><div class="orb o2"><strong>' + used.length + '</strong><span>benutzt</span></div><div class="orb o4"><strong>' + needing.length + '</strong><span>brauchen Joker</span></div></div>' +
      '<div class="actions"><button type="button" class="btn btn-grad" data-act="joker-gen">' + ic('plus') + (all.length ? '100 weitere Codes' : '100 Codes erzeugen') + '</button><button type="button" class="btn btn-soft" data-act="joker-print"' + (all.length ? '' : ' disabled') + '>' + ic('print') + 'Code-Karten drucken</button></div></section>' +
      '<section class="glass panel"><h2>Joker einlösen</h2><p class="muted">Die Person schickt den Code per Facebook-Nachricht. Code und Person wählen, Tag prüfen, buchen.</p>' +
      '<div class="form"><label class="fld"><span>Code</span><input id="jcode" type="text" placeholder="DZ-XXXX" autocomplete="off" spellcheck="false"></label>' +
      '<label class="fld"><span>Person</span><select id="jperson"><option value="">– wählen –</option>' + (needing.length ? '<optgroup label="Joker nötig">' + needing.map(opt).join('') + '</optgroup>' : '') + '<optgroup label="Alle anderen">' + others.map(opt).join('') + '</optgroup></select></label>' +
      '<label class="fld"><span>Verpasster Tag</span><select id="jday">' + Array.from({ length: 30 }, (_, i) => '<option value="' + (i + 1) + '">Tag ' + (i + 1) + '</option>').join('') + '</select></label>' +
      '<button type="button" class="btn btn-grad" data-act="joker-assign">' + ic('joker') + 'Joker buchen</button></div></section>' +
      '<section class="panel"><h2>Benutzte Codes</h2>' + (list ? '<ul class="ulist">' + list + '</ul>' : '<p class="muted">Noch keiner.</p>') + '</section>';
  }

  function viewSettings() {
    const s = res.settings;
    const tok = getToken();
    const f = (id, label, val, type, extra) => '<label class="fld"><span>' + label + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + h(val) + '" ' + (extra || '') + '></label>';
    return '<section class="glass panel"><h2>Facebook</h2>' +
      '<div class="form">' +
      '<label class="fld wide"><span>Token (Seiten-Zugangsschlüssel)</span><span class="pw"><input id="token" type="password" value="' + h(tok) + '" autocomplete="off" spellcheck="false" placeholder="Token einfügen"><button type="button" class="btn btn-ghost" data-act="toggle-token" aria-label="Token anzeigen">' + ic('eye') + '</button></span></label>' +
      f('pageId', 'Seiten-ID', s.pageId, 'text', 'inputmode="numeric"') + f('apiVersion', 'API-Version', s.apiVersion) +
      '</div><p class="muted small">Der Token bleibt nur in diesem Browser auf diesem PC. Er wird nie exportiert. Nötige Rechte: pages_read_engagement, pages_read_user_content. Die Live-Anbindung ist gegen das echte Facebook noch ungeprüft – erster Abruf zeigt es.</p>' +
      (tok ? '<button type="button" class="btn btn-ghost" data-act="token-clear">' + ic('trash') + 'Token löschen</button>' : '') + '</section>' +
      '<section class="glass panel"><h2>Gewinnspiel</h2><div class="form">' +
      f('startDate', 'Tag 1 (Start)', s.startDate, 'date') + f('weeklyWinners', 'Wochensieger pro Woche', s.weeklyWinners, 'number', 'min="1" max="10"') +
      f('weeklyBackups', 'Nachrücker pro Woche', s.weeklyBackups, 'number', 'min="0" max="5"') + f('mainBackups', 'Nachrücker Hauptpreis', s.mainBackups, 'number', 'min="0" max="5"') +
      '<label class="fld wide"><span>Mitarbeiter (ein Name oder eine Facebook-ID pro Zeile, nehmen nicht teil)</span><textarea id="staff" rows="3">' + h(s.staff.join('\n')) + '</textarea></label>' +
      '<label class="fld wide"><span>Sperrliste (Fake-Accounts, Regelverstöße)</span><textarea id="blocked" rows="3">' + h(s.blocked.join('\n')) + '</textarea></label>' +
      f('asOf', 'Teststichtag (leer = heute)', s.asOf, 'date') +
      '</div><button type="button" class="btn btn-grad" data-act="settings-save">Speichern</button></section>';
  }

  function viewData() {
    const manual = state.comments.filter((c) => c.source === 'manuell').length + state.reactions.filter((r) => r.source === 'manuell').length;
    const t = res.today;
    const defDay = Math.min(30, Math.max(1, t.phase === 'läuft' ? t.current : t.phase === 'vor' ? 1 : 30));
    return '<section class="glass panel"><h2>Von Facebook abrufen</h2><p class="muted">Holt alle Türchen-Beiträge, Kommentare und Likes. Dauert je nach Menge bis zu einer Minute.</p>' +
      '<button type="button" class="btn btn-grad" data-act="fetch">' + ic('sync') + 'Jetzt abrufen</button><ol id="flog" class="flog">' + (state.fetchLog || []).slice(-6).map((x) => '<li>' + h(x) + '</li>').join('') + '</ol></section>' +
      '<section class="glass panel"><h2>Von Hand eintragen</h2><p class="muted">Falls Facebook keine Namen liefert. Pro Zeile: <code>Name | Kommentar | HH:MM</code>. Uhrzeit optional.</p>' +
      '<div class="form"><label class="fld"><span>Tag</span><select id="mday">' + Array.from({ length: 30 }, (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === defDay ? ' selected' : '') + '>Tag ' + (i + 1) + ' · ' + E.fmtDateDe(E.dayDate(res.settings, i + 1)) + '</option>').join('') + '</select></label>' +
      '<label class="fld wide"><span>Kommentare</span><textarea id="mtext" rows="5" placeholder="Laura M. | Das Tretlager! | 18:42"></textarea></label>' +
      '<label class="fld wide"><span>Likes (ein Name pro Zeile)</span><textarea id="mlikes" rows="3"></textarea></label></div>' +
      '<div class="actions"><button type="button" class="btn btn-grad" data-act="manual-add">' + ic('plus') + 'Übernehmen</button><button type="button" class="btn btn-ghost" data-act="manual-clear"' + (manual ? '' : ' disabled') + '>' + ic('trash') + 'Manuelle Einträge des Tages löschen</button></div></section>' +
      '<section class="glass panel"><h2>Sichern und Austausch</h2><p class="muted">Export ohne Token. Damit kommen die Daten auf einen zweiten PC oder ins Handy.</p><div class="actions">' +
      '<button type="button" class="btn btn-soft" data-act="export">' + ic('dl') + 'Daten exportieren (JSON)</button>' +
      '<label class="btn btn-soft file">' + ic('up') + 'Daten importieren<input id="importFile" type="file" accept="application/json,.json"></label>' +
      '<button type="button" class="btn btn-soft" data-act="csv">' + ic('dl') + 'Teilnehmer als CSV</button>' +
      '<button type="button" class="btn btn-soft" data-act="demo">' + ic('play') + 'Demo-Daten laden</button>' +
      '<button type="button" class="btn btn-danger" data-act="wipe">' + ic('trash') + 'Alles löschen</button></div></section>';
  }

  /* ---------- Render ---------- */
  function render() {
    const r = route();
    renderNav(r.view);
    const v = VIEWS.find((x) => x.id === r.view);
    const title = r.view === 'person' ? (res.byId.get(r.arg) || {}).name || 'Teilnehmer' : v.label;
    $('#title').textContent = title;
    document.title = title + ' · Durchzieher-Zentrale';
    const html = {
      uebersicht: viewOverview, teilnehmer: viewPeople, person: () => viewPerson(r.arg), tage: viewDays,
      auslosung: viewDraw, joker: viewJoker, einstellungen: viewSettings, daten: viewData,
    }[r.view]();
    const view = $('#view');
    view.innerHTML = html;
    afterRender(view);
    const sort = $('#sort'); if (sort) sort.value = ui.sort;
  }
  function afterRender(root) {
    $$('[data-w]', root).forEach((el) => { el.style.width = el.getAttribute('data-w') + '%'; });
    $$('.av[data-hue]', root).forEach((el) => { el.style.setProperty('--h', el.getAttribute('data-hue')); });
    $$('.ic[data-ic]').forEach((el) => { el.outerHTML = ic(el.getAttribute('data-ic')); });
  }

  /* ---------- Rückmeldungen ---------- */
  let toastT = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast'; }, 4200);
  }
  function confirmBox(text, okLabel, danger) {
    return new Promise((resolve) => {
      const m = $('#modal');
      m.innerHTML = '<div class="mbox glass" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">Sicher?</h2><p>' + h(text) + '</p><div class="actions"><button type="button" class="btn btn-ghost" data-m="0">Abbrechen</button><button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-grad') + '" data-m="1">' + h(okLabel || 'Ja') + '</button></div></div>';
      m.hidden = false;
      const done = (v) => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', esc); resolve(v); };
      const esc = (e) => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', esc);
      m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) done(b.getAttribute('data-m') === '1'); else if (e.target === m) done(false); };
      $('[data-m="1"]', m).focus();
    });
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function rndU32() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
  function stamp() { const p = E.berlinParts(new Date()); return p.date + '_' + p.time.replace(':', '-'); }

  /* ---------- Aktionen ---------- */
  async function doFetch() {
    if (busy) return;
    const token = getToken();
    if (!token) { toast('Erst den Facebook-Token unter Einstellungen eintragen.', 'bad'); location.hash = '#einstellungen'; return; }
    busy = true;
    $$('[data-act="fetch"]').forEach((b) => { b.disabled = true; b.classList.add('spin'); });
    const log = (msg) => { const el = $('#flog'); if (el) { el.insertAdjacentHTML('beforeend', '<li>' + h(msg) + '</li>'); } $('#fetchInfo').textContent = msg; };
    try {
      const data = await M.fetchAll({ settings: res.settings, engine: E, token, onProgress: log });
      E.mergeMeta(state, data);
      const msg = fmtStamp(state.lastFetch) + ': ' + data.stats.posts + ' Beiträge, ' + data.stats.comments + ' Kommentare, ' + data.stats.reactions + ' Likes.';
      state.fetchLog = (state.fetchLog || []).concat([msg].concat(data.warnings)).slice(-20);
      commit();
      toast(data.warnings.length ? data.warnings[0] : 'Abgerufen: ' + data.stats.comments + ' Kommentare.', data.warnings.length ? 'bad' : 'ok');
    } catch (e) {
      const msg = e && e.name === 'MetaError' ? e.message : 'Abruf fehlgeschlagen.';
      state.fetchLog = (state.fetchLog || []).concat([fmtStamp(new Date().toISOString()) + ': ' + msg]).slice(-20);
      save();
      toast(msg, 'bad');
      render();
    } finally {
      busy = false;
      $$('[data-act="fetch"]').forEach((b) => { b.disabled = false; b.classList.remove('spin'); });
    }
  }

  async function doDraw(key) {
    const s = res.settings;
    const isMain = key === 'MAIN';
    const pool = isMain ? E.mainPool(res) : E.weekPool(res, state, key);
    if (!pool.length) { toast('Lostopf ist leer.', 'bad'); return; }
    const old = state.draws[key];
    if (old && !(await confirmBox('Für ' + (old.label || key) + ' wurde schon gezogen (' + fmtStamp(old.time) + '). Neu ziehen ersetzt die Gewinner. Nur bei triftigem Grund (z. B. Gewinner meldet sich nicht).', 'Neu ziehen', true))) return;
    const label = isMain ? 'Hauptpreis E-Bike' : E.WEEKS.find((w) => w.key === key).label;
    const d = E.draw(pool, isMain ? s.mainWinners : s.weeklyWinners, isMain ? s.mainBackups : s.weeklyBackups, rndU32, { key, label, redrawn: old ? (old.redrawn || 1) + 1 : 0 });
    state.draws[key] = d;
    commit();
    toast('Gezogen: ' + d.winners.map((w) => w.name).join(', '), 'ok');
  }

  function printCodes() {
    const free = state.jokers.filter((j) => !j.used);
    const area = $('#printArea');
    area.innerHTML = '<div class="pgrid">' + free.map((j) => '<div class="pcard"><p class="pk">Joker-Karte</p><p class="pt">Durchzieher · 30 Tage. 1 E-Bike.</p><p class="pc">' + h(j.code) + '</p><p class="ph2">Einen Tag verpasst? Schick uns diesen Code per Facebook-Nachricht mit dem verpassten Tag. Gilt einmal pro Person.</p><p class="pf">Velocenter Hessert · Hartmannstraße 25 · Wörth am Rhein</p></div>').join('') + '</div>';
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const act = b.getAttribute('data-act');
    if (act === 'fetch') doFetch();
    else if (act === 'demo') {
      if (state.comments.length && !(await confirmBox('Demo-Daten ersetzen alle aktuellen Daten (Token bleibt). Vorher exportieren?', 'Demo laden', true))) return;
      state = E.demoState(); commit(); toast('Demo-Daten geladen (Teststichtag 22.12.).', 'ok');
    } else if (act === 'filter') { ui.status = b.getAttribute('data-v'); saveUi(); render(); }
    else if (act === 'draw') doDraw(b.getAttribute('data-key'));
    else if (act === 'protocol') { const t = E.protocolText(state); download('Auslosungsprotokoll_' + stamp() + '.txt', t); }
    else if (act === 'protocol-copy') {
      try { await navigator.clipboard.writeText(E.protocolText(state)); toast('Protokoll kopiert.', 'ok'); } catch (err) { toast('Kopieren nicht möglich – bitte herunterladen.', 'bad'); }
    } else if (act === 'joker-gen') {
      state.jokers = state.jokers.concat(E.generateJokerCodes(100, rndU32, state.jokers)); commit(); toast('100 Codes erzeugt.', 'ok');
    } else if (act === 'joker-print') printCodes();
    else if (act === 'joker-assign') {
      const r = E.assignJoker(state, res, $('#jcode').value, $('#jperson').value, $('#jday').value);
      if (!r.ok) { toast(r.error, 'bad'); return; }
      commit(); toast('Joker ' + r.joker.code + ' für ' + r.joker.name + ', Tag ' + r.joker.day + ' gebucht.', 'ok');
    } else if (act === 'joker-free') {
      if (!(await confirmBox('Joker ' + b.getAttribute('data-code') + ' wieder freigeben?', 'Freigeben'))) return;
      E.releaseJoker(state, b.getAttribute('data-code')); commit();
    } else if (act === 'toggle-token') { const i = $('#token'); i.type = i.type === 'password' ? 'text' : 'password'; }
    else if (act === 'token-clear') { setToken(''); render(); toast('Token gelöscht.', 'ok'); }
    else if (act === 'settings-save') {
      const s = state.settings;
      setToken($('#token').value.trim());
      s.pageId = $('#pageId').value.trim() || s.pageId;
      s.apiVersion = $('#apiVersion').value.trim() || 'v23.0';
      if (/^\d{4}-\d{2}-\d{2}$/.test($('#startDate').value)) s.startDate = $('#startDate').value;
      const num = (id, min, max, def) => { const v = parseInt($('#' + id).value, 10); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
      s.weeklyWinners = num('weeklyWinners', 1, 10, 2);
      s.weeklyBackups = num('weeklyBackups', 0, 5, 1);
      s.mainBackups = num('mainBackups', 0, 5, 2);
      const lines = (id) => $('#' + id).value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      s.staff = lines('staff'); s.blocked = lines('blocked');
      s.asOf = $('#asOf').value || '';
      commit(); toast('Gespeichert.', 'ok');
    } else if (act === 'manual-add') {
      const r = E.addManual(state, $('#mday').value, $('#mtext').value, $('#mlikes').value);
      if (r.errors.length) toast(r.errors[0], 'bad');
      if (r.added || r.likes) { commit(); toast(r.added + ' Kommentare, ' + r.likes + ' Likes übernommen.', r.errors.length ? 'bad' : 'ok'); }
    } else if (act === 'manual-clear') {
      const d = Number($('#mday').value);
      if (!(await confirmBox('Alle von Hand eingetragenen Kommentare und Likes von Tag ' + d + ' löschen?', 'Löschen', true))) return;
      state.comments = state.comments.filter((c) => !(c.source === 'manuell' && Number(c.day) === d));
      state.reactions = state.reactions.filter((r) => !(r.source === 'manuell' && Number(r.day) === d));
      commit();
    } else if (act === 'export') download('Durchzieher-Daten_' + stamp() + '.json', E.exportJson(state), 'application/json');
    else if (act === 'csv') download('Durchzieher-Teilnehmer_' + stamp() + '.csv', E.participantsCsv(res), 'text/csv;charset=utf-8');
    else if (act === 'wipe') {
      if (!(await confirmBox('Alle Daten (Beiträge, Kommentare, Joker, Auslosungen) löschen? Der Token bleibt. Vorher exportieren!', 'Alles löschen', true))) return;
      const keep = state.settings; state = E.emptyState(); state.settings = Object.assign(E.defaultSettings(), keep, { asOf: '' }); commit(); toast('Gelöscht.', 'ok');
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { ui.q = e.target.value; $('#plist').innerHTML = personRows(); afterRender($('#plist')); }
  });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'sort') { ui.sort = t.value; saveUi(); $('#plist').innerHTML = personRows(); afterRender($('#plist')); }
    else if (t.getAttribute('data-act') === 'override') {
      const p = state.posts.find((x) => x.id === t.getAttribute('data-id'));
      if (p) { p.dayOverride = t.value === '' ? null : Number(t.value); commit(); toast('Zuordnung geändert.', 'ok'); }
    } else if (t.id === 'jperson') {
      const p = res.byId.get(t.value);
      if (p && p.gaps.length) $('#jday').value = String(p.gaps[0]);
    } else if (t.id === 'importFile' && t.files && t.files[0]) {
      try {
        const text = await t.files[0].text();
        const st = E.importJson(text);
        if (!(await confirmBox('Import ersetzt alle aktuellen Daten. Fortfahren?', 'Importieren', true))) return;
        state = st; commit(); toast('Importiert.', 'ok');
      } catch (err) { toast('Import fehlgeschlagen: ' + (err.message || 'Datei unlesbar'), 'bad'); }
      t.value = '';
    }
  });

  window.addEventListener('hashchange', () => { render(); const v = $('#view'); if (v) v.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); recompute(); render(); } });

  // Ohne Neuladen: Tageswechsel um Mitternacht mitnehmen
  setInterval(() => { const before = res.today.date; recompute(); if (res.today.date !== before) render(); }, 60000);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-Zwischenspeicher optional */ });
  }
  render();
})();
