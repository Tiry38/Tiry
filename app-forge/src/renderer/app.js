/* Tiry App Forge – Oberfläche (Vanilla JS). Spricht nur über window.forge mit dem Hub. */
(function () {
  'use strict';
  var F = window.forge;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/><path d="M9 15l-3-3a20 20 0 0 1 12-9 20 20 0 0 1-9 12z"/><circle cx="15" cy="9" r="1.5"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    minus: '<path d="M5 12h14"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24">' + (IC[n] || '') + '</svg>'; }

  var S = { view: 'studio', apps: [], stats: null, status: {}, usage: null, autopilot: null, jobs: [], feed: [], plugins: [], trends: null, lessons: [], settings: null, createType: 'any', createCount: 1, detail: null, detailTab: 'overview', readiness: null, netSel: null };
  var KIND_COLORS = { core: '#f472b6', ai: '#a78bfa', generator: '#fb923c', quality: '#34d399', evolution: '#22d3ee', storage: '#60a5fa', export: '#fbbf24', publish: '#f97316', integration: '#e879f9', api: '#2dd4bf', system: '#94a3b8', store: '#facc15' };
  var KIND_LABEL = { core: 'Kern', ai: 'KI', generator: 'Generator', quality: 'Qualität', evolution: 'Evolution', storage: 'Speicher', export: 'Export', publish: 'Veröffentlichen', integration: 'Integration', api: 'API', system: 'System', store: 'Store' };
  var KIND_ICON = {
    core: IC.bolt, ai: IC.spark, generator: IC.rocket, quality: IC.check, evolution: IC.refresh, storage: IC.folder, export: IC.box, publish: IC.phone,
    api: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    integration: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    store: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    system: '<rect x="6" y="6" width="12" height="12" rx="4"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'
  };
  var STATUS_LABEL = { running: 'aktiv', stopped: 'aus', error: 'Fehler', planned: 'geplant', unavailable: 'nicht verfügbar' };

  // ------------------------------------------------------------------ Helfer
  function call(action, args) {
    return F.invoke(action, args || {}).catch(function (e) { toast(e.message, 'error'); throw e; });
  }
  function safe(action, args) { return F.invoke(action, args || {}).catch(function () { return null; }); }
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = '<span class="ti">' + (kind === 'error' ? '!' : kind === 'success' ? '✓' : '✦') + '</span><span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, kind === 'error' ? 6000 : 3600);
  }
  function openSheet(html, onMount) {
    var s = $('#sheet'); s.innerHTML = html; s.classList.add('on'); $('#sheet-bg').classList.add('on');
    if (onMount) onMount(s);
  }
  function closeSheet() { $('#sheet').classList.remove('on'); $('#sheet-bg').classList.remove('on'); }
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      openSheet('<h3>' + esc(title) + '</h3><p class="muted">' + esc(text) + '</p><div class="row" style="margin-top:24px;justify-content:flex-end"><button class="btn ghost" data-no>Abbrechen</button><button class="btn ' + (danger ? 'danger' : '') + '" data-yes>' + esc(okLabel) + '</button></div>', function (s) {
        $('[data-no]', s).onclick = function () { closeSheet(); resolve(false); };
        $('[data-yes]', s).onclick = function () { closeSheet(); resolve(true); };
      });
    });
  }
  function rel(ts) {
    if (!ts) return '–';
    var d = (Date.now() - ts) / 1000;
    if (d < 0) { d = -d; return d < 60 ? 'in ' + Math.round(d) + ' s' : d < 3600 ? 'in ' + Math.round(d / 60) + ' Min.' : 'in ' + Math.round(d / 3600) + ' Std.'; }
    if (d < 45) return 'gerade eben';
    if (d < 3600) return 'vor ' + Math.round(d / 60) + ' Min.';
    if (d < 86400) return 'vor ' + Math.round(d / 3600) + ' Std.';
    return 'vor ' + Math.round(d / 86400) + ' Tagen';
  }
  function usd(v) { return (Number(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $'; }
  var ringSeq = 0;
  function ring(pct, size, stroke, label, cls) {
    var id = 'rg' + (++ringSeq); var r = (size - stroke) / 2; var c = 2 * Math.PI * r; var p = Math.max(0, Math.min(1, pct || 0));
    return '<div class="ring-wrap ' + (cls || '') + '" style="width:' + size + 'px;height:' + size + 'px"><svg class="ring" width="' + size + '" height="' + size + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".5" stop-color="#ec4899"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="' + stroke + '"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + id + ')" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - p) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg><div class="lbl">' + (label == null ? '' : label) + '</div></div>';
  }
  function appGrad(a) { var acc = (a && a.palette && a.palette.accent) || ['#8b5cf6', '#ec4899']; return 'linear-gradient(135deg,' + acc[0] + ',' + acc[1] + ')'; }
  var pending = {};
  function later(key, fn, ms) { clearTimeout(pending[key]); pending[key] = setTimeout(fn, ms || 120); }
  // Bild-Fallbacks (CSP erlaubt keine inline-Handler)
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-fallback')) {
      var d = document.createElement('div'); d.className = 'fallback'; d.style.background = t.getAttribute('data-fallback'); d.textContent = t.getAttribute('data-glyph') || '';
      t.replaceWith(d);
    }
  }, true);

  // ------------------------------------------------------------------ Navigation
  var RENDER = {};
  function go(view) {
    S.view = view;
    $$('.nav-item').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + view); });
    if (RENDER[view]) RENDER[view](true);
  }
  $$('.nav-item').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-view')); }); });

  // ------------------------------------------------------------------ Statusleiste
  function currentJob() { return S.jobs.filter(function (j) { return j.status === 'running'; })[0] || null; }
  function renderPills() {
    var st = S.status || {}; var u = S.usage; var ap = S.autopilot; var job = currentJob(); var queued = S.jobs.filter(function (j) { return j.status === 'queued'; }).length;
    var html = '';
    if (job) html += '<span class="pill"><span class="spinner"></span><b>' + esc(job.title) + '</b> ' + (job.progress || 0) + '%' + (queued ? ' · +' + queued : '') + '</span>';
    html += '<span class="pill clickable" data-go="settings"><span class="dot ' + (st.aiAvailable ? 'ai' : '') + '"></span>' + (st.aiAvailable ? 'API-Modus · <b>' + esc(modelName(st.model)) + '</b>' : st.aiMode === 'api' ? 'API-Key fehlt' : 'Gratis-Modus · <b>0 €</b>') + '</span>';
    html += '<span class="pill clickable" data-go="autopilot"><span class="dot ' + (ap && ap.enabled ? 'on' : '') + '"></span>Autopilot <b>' + (ap && ap.enabled ? 'an' : 'aus') + '</b></span>';
    if (u && u.available) html += '<span class="pill">Heute <b>' + usd(u.today.costUsd) + '</b> / ' + usd(u.limits.dailyUsd) + '</span>';
    $('#status-pills').innerHTML = html;
    $$('[data-go]', $('#status-pills')).forEach(function (p) { p.onclick = function () { go(p.getAttribute('data-go')); }; });
  }
  function modelName(m) { return { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' }[m] || m || ''; }
  function refreshStatus() {
    return Promise.all([safe('forge.status'), safe('ai.usage'), safe('autopilot.status'), safe('jobs.list')]).then(function (r) {
      S.status = r[0] || {}; S.usage = r[1]; S.autopilot = r[2]; S.jobs = r[3] || [];
      renderPills();
    });
  }

  // ------------------------------------------------------------------ Feed
  function addFeed(kind, text, ts) {
    S.feed.unshift({ kind: kind, text: text, ts: ts || Date.now() });
    S.feed = S.feed.slice(0, 80);
    if (S.view === 'studio') later('feed', renderFeed, 60);
  }
  function renderFeed() {
    var el = $('#feed'); if (!el) return;
    el.innerHTML = S.feed.length ? S.feed.slice(0, 40).map(function (f) { return '<div class="feed-item ' + f.kind + '">' + esc(f.text) + '<time>' + rel(f.ts) + '</time></div>'; }).join('') : '<p class="muted small">Hier erscheint live, was die Forge gerade tut.</p>';
    var jc = $('#jobcard'); if (!jc) return;
    var job = currentJob();
    jc.innerHTML = job ? '<div class="row"><b class="grow">' + esc(job.title) + '</b><button class="icon-btn" data-cancel="' + job.id + '" title="Abbrechen">' + ic('x') + '</button></div><p class="muted small" style="margin-top:4px">' + esc(job.message || 'läuft …') + '</p><div class="progress"><i style="width:' + Math.max(4, job.progress || 0) + '%"></i></div>' : '<p class="muted small">Gerade kein Auftrag. Erschaffe eine App oder schalte den Autopilot ein.</p>';
    var c = $('[data-cancel]', jc); if (c) c.onclick = function () { call('jobs.cancel', { id: c.getAttribute('data-cancel') }); };
  }

  // ------------------------------------------------------------------ Studio
  function loadApps() {
    return Promise.all([safe('apps.list'), safe('stats.get')]).then(function (r) { S.apps = r[0] || []; S.stats = r[1]; });
  }
  RENDER.studio = function (fresh) {
    if (fresh) loadApps().then(drawStudio);
    drawStudio();
  };
  function drawStudio() {
    var el = $('#view-studio'); var st = S.stats || {}; var u = S.usage; var job = currentJob();
    var today = st.last7Days && st.last7Days.length ? st.last7Days[st.last7Days.length - 1] : { created: 0, evolved: 0 };
    el.innerHTML =
      '<div class="hero">' +
        '<div class="hero-copy"><div class="small muted" style="font-weight:700;letter-spacing:.12em;text-transform:uppercase">App-Studio</div>' +
        '<h1 class="h-title">Erschaffe deine nächste <span class="grad-text">Hit-App</span></h1>' +
        '<p class="lead">Zufällige, aber sinnvolle Ideen – trendbasiert, automatisch gebaut, im Handy-Format getestet und von einer strengen Design-Jury bewertet. Danach verbessert sich jede App selbst weiter.</p>' +
        '<div class="hero-actions"><div class="seg" id="type-seg">' + [['any', 'Zufall'], ['game', 'Spiel'], ['tool', 'App']].map(function (t) { return '<button data-type="' + t[0] + '" class="' + (S.createType === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="seg"><button data-cnt="-1" aria-label="weniger">' + '−' + '</button><button class="on" style="min-width:44px">' + S.createCount + '</button><button data-cnt="1" aria-label="mehr">+</button></div>' +
        '<button class="btn xl" id="create-btn">' + ic('spark') + 'Neue App erschaffen</button></div>' +
        (S.status.aiAvailable ? '' : '<p class="small muted" style="margin-top:14px">Gratis-Modus: Hier entstehen Premium-Vorlagen. Völlig neue KI-Apps baut jede Nacht deine Claude-Sitzung – sie kommen automatisch über „Cloud-Apps holen“.</p>') +
        '</div>' +
        '<div class="hero-orb ' + (job ? 'busy' : '') + '"><div class="blob"></div><div class="blob b2"></div><div class="core"><div><b>' + S.apps.length + '</b><br><span>Apps</span></div></div></div>' +
      '</div>' +
      '<div class="bubbles sec">' +
        '<div class="bubble s1 accent"><b>' + (st.avgScore || 0) + '</b><span>Ø Score</span></div>' +
        '<div class="bubble s2"><b>' + (st.versions || 0) + '</b><span>Versionen</span></div>' +
        '<div class="bubble s3"><b>' + (today.created || 0) + '</b><span>neu heute</span></div>' +
        '<div class="bubble s2"><b>' + (today.evolved || 0) + '</b><span>verbessert heute</span></div>' +
        '<div class="bubble s3"><b>' + (st.rejected || 0) + '</b><span>verworfen</span></div>' +
        '<div class="bubble s1"><b style="font-size:20px">' + (u && u.available ? usd(u.today.costUsd) : '0 $') + '</b><span>KI-Kosten heute</span></div>' +
      '</div>' +
      '<div class="studio-grid sec">' +
        '<div><div class="sec-title">Deine Apps <span class="aside">' + S.apps.length + ' insgesamt</span></div>' +
        (S.apps.length ? '<div class="gallery">' + S.apps.map(appCard).join('') + '</div>' : emptyState()) + '</div>' +
        '<div class="side"><div class="pebble job"><div class="sec-title" style="margin-bottom:8px">Aktueller Auftrag</div><div id="jobcard"></div></div>' +
        '<div class="pebble" style="margin-top:18px"><div class="sec-title" style="margin-bottom:10px">Live-Aktivität</div><div class="feed" id="feed"></div></div></div>' +
      '</div>';
    $$('[data-type]', el).forEach(function (b) { b.onclick = function () { S.createType = b.getAttribute('data-type'); drawStudio(); }; });
    $$('[data-cnt]', el).forEach(function (b) { b.onclick = function () { S.createCount = Math.max(1, Math.min(5, S.createCount + Number(b.getAttribute('data-cnt')))); drawStudio(); }; });
    $('#create-btn').onclick = createApps;
    var e2 = $('#empty-create', el); if (e2) e2.onclick = createApps;
    $$('.app-card', el).forEach(function (c) { c.onclick = function () { openDetail(c.getAttribute('data-id')); }; });
    renderFeed();
  }
  function emptyState() {
    return '<div class="empty pebble"><div class="orb">' + ic('spark') + '</div><h3>Noch keine Apps</h3><p class="muted">Ein Klick – und die Forge erfindet, baut und testet deine erste App.</p><div style="margin-top:20px"><button class="btn" id="empty-create">' + ic('spark') + 'Erste App erschaffen</button></div></div>';
  }
  function appCard(a, i) {
    var shot = 'forge://' + a.id + '/v' + a.currentVersion + '/screenshot.png?u=' + (a.updatedAt || 0);
    var ready = a.readiness && a.readiness.ready;
    return '<div class="app-card edge" data-id="' + esc(a.id) + '" style="animation-delay:' + Math.min(i, 12) * 40 + 'ms"><div class="thumb"><img src="' + esc(shot) + '" alt="" loading="lazy" data-fallback="' + esc(appGrad(a)) + '" data-glyph="' + esc(a.glyph || (a.name || '?').charAt(0)) + '"><div class="score">' + ring((a.score || 0) / 100, 46, 4, a.score == null ? '–' : a.score, 'score-orb') + '</div></div>' +
      '<h3>' + esc(a.name) + '</h3><p>' + esc(a.tagline || '') + '</p><div class="meta"><span class="badge ' + (a.type === 'game' ? 'game' : 'tool') + '">' + (a.type === 'game' ? 'Spiel' : 'App') + '</span><span class="badge">v' + a.currentVersion + '</span>' + (ready ? '<span class="badge ready">Verkaufsbereit</span>' : '') + '<span class="small muted" style="margin-left:auto">' + rel(a.updatedAt) + '</span></div></div>';
  }
  function createApps() {
    call('forge.create', { count: S.createCount, type: S.createType }).then(function (r) {
      toast((r.jobIds || []).length > 1 ? r.jobIds.length + ' Apps in Arbeit' : 'Neue App in Arbeit …');
      refreshStatus();
    });
  }

  // ------------------------------------------------------------------ Detail
  function openDetail(id) {
    S.detailTab = S.detailTab || 'overview';
    Promise.all([call('apps.get', { id: id }), safe('apps.readiness', { id: id }), safe('apps.previewUrl', { id: id })]).then(function (r) {
      S.detail = r[0]; S.readiness = r[1]; S.preview = r[2];
      drawDetail();
      $('#detail').classList.add('on'); $('#detail-bg').classList.add('on');
    });
  }
  function closeDetail() { $('#detail').classList.remove('on'); $('#detail-bg').classList.remove('on'); S.detail = null; setTimeout(function () { if (!S.detail) $('#detail').innerHTML = ''; }, 500); }
  $('#detail-bg').addEventListener('click', closeDetail);
  function refreshDetail() {
    if (!S.detail) return;
    var id = S.detail.id;
    Promise.all([safe('apps.get', { id: id }), safe('apps.readiness', { id: id }), safe('apps.previewUrl', { id: id })]).then(function (r) {
      if (!r[0] || !S.detail || S.detail.id !== id) return;
      var versionChanged = r[0].currentVersion !== S.detail.currentVersion;
      S.detail = r[0]; S.readiness = r[1]; S.preview = r[2];
      drawDetail(!versionChanged);
    });
  }
  function drawDetail(keepPhone) {
    var a = S.detail; if (!a) return;
    var d = $('#detail');
    d.style.setProperty('--app-grad', appGrad(a));
    var phone = '<div class="detail-phone"><div class="phone">' + (S.preview ? '<iframe id="preview" src="' + esc(S.preview) + (S.preview.indexOf('forge://') === 0 ? '?t=' + Date.now() : '') + '" title="Live-Vorschau" sandbox="allow-scripts allow-same-origin"></iframe>' : '<div class="preview-fallback">Vorschau nicht verfügbar</div>') + '</div><div class="row" style="margin-top:18px"><button class="btn ghost sm" id="reload-prev">' + ic('refresh') + 'Neu laden</button><button class="btn ghost sm" id="phone-btn">' + ic('phone') + 'Aufs Handy</button></div></div>';
    var tabs = [['overview', 'Übersicht'], ['quality', 'Qualität'], ['versions', 'Versionen'], ['sale', 'Verkauf'], ['actions', 'Aktionen']];
    var body = '<div class="detail-body"><div class="detail-head"><img class="icon" src="forge://' + esc(a.id) + '/v' + a.currentVersion + '/icon.svg" alt="" data-fallback="' + esc(appGrad(a)) + '" data-glyph="' + esc(a.glyph || '') + '"><div class="grow"><h2 class="h-title" style="font-size:30px">' + esc(a.name) + '</h2><p class="muted">' + esc(a.tagline || '') + '</p><div class="row" style="margin-top:8px"><span class="badge ' + (a.type === 'game' ? 'game' : 'tool') + '">' + (a.type === 'game' ? 'Spiel' : 'App') + '</span><span class="badge">' + esc(a.category || '') + '</span><span class="badge">v' + a.currentVersion + '</span><span class="badge">' + (a.source === 'ai' ? 'KI-Original' : 'Premium-Vorlage') + '</span>' + (S.readiness && S.readiness.ready ? '<span class="badge ready">Verkaufsbereit</span>' : '') + '</div></div>' + ring((a.score || 0) / 100, 72, 7, '<span style="font-size:18px">' + (a.score == null ? '–' : a.score) + '</span>') + '<button class="icon-btn" id="close-detail" title="Schließen">' + ic('x') + '</button></div>' +
      '<div class="tabs seg" style="align-self:flex-start">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (S.detailTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div class="tab-body" id="tab-body">' + tabBody(a) + '</div></div>';
    if (keepPhone && $('.detail-phone', d)) {
      var b = $('.detail-body', d); var tmp = document.createElement('div'); tmp.innerHTML = body; b.replaceWith(tmp.firstChild);
    } else {
      d.innerHTML = phone + body;
    }
    wireDetail(a);
  }
  function tabBody(a) {
    var c = a.concept || {}; var v = (a.versions || []).filter(function (x) { return x.n === a.currentVersion; })[0] || {}; var rv = v.review;
    if (S.detailTab === 'overview') {
      return '<dl class="kv"><dt>Zielgruppe</dt><dd>' + esc(c.target_audience) + '</dd><dt>Problem / Spaß</dt><dd>' + esc(c.problem_or_fun) + '</dd><dt>Kern-Schleife</dt><dd>' + esc(c.core_loop) + '</dd><dt>Bindung</dt><dd>' + esc(c.retention_hook) + '</dd><dt>Monetarisierung</dt><dd>' + esc(c.monetization) + '</dd>' + (a.trend ? '<dt>Trend-Chance</dt><dd>' + esc(a.trend.direction) + ' <span class="muted">(' + esc(a.trend.why) + ')</span></dd>' : '') + '</dl>' +
        '<div class="sec"><div class="sec-title">Funktionen</div><div class="row">' + (c.features || []).map(function (f) { return '<span class="chip">' + esc(f) + '</span>'; }).join('') + '</div></div>' +
        '<div class="sec"><div class="sec-title">Store-Texte</div><div class="small muted">Kurzbeschreibung</div>' + copyBox(c.store_short_description) + '<div class="small muted" style="margin-top:14px">Beschreibung</div>' + copyBox(c.store_full_description) + '<div class="small muted" style="margin-top:14px">Keywords</div>' + copyBox((c.keywords || []).join(', ')) + '</div>';
    }
    if (S.detailTab === 'quality') {
      var t = a.lastTest || {};
      var bars = [['Technik', v.tech != null ? v.tech / 10 : (t.tech || 0) / 10]];
      if (rv) bars = bars.concat([['Design', rv.design], ['UX', rv.ux], ['Sinn', rv.sense], ['Feinschliff', rv.polish]]);
      return bars.map(function (b) { return '<div class="scorebar"><span>' + b[0] + '</span><div class="progress"><i style="width:' + Math.max(3, b[1] * 10) + '%"></i></div><b>' + (Math.round(b[1] * 10) / 10) + '</b></div>'; }).join('') +
        (rv ? '<div class="sec"><div class="sec-title">Urteil der Design-Jury</div><p>' + esc(rv.summary) + '</p>' + (rv.improvements && rv.improvements.length ? '<div class="row" style="margin-top:12px">' + rv.improvements.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '') + '</div>' : '<div class="hint info sec">Design-Jury bewertet KI-Apps per Screenshot. Premium-Vorlagen sind handgeprüft.</div>') +
        '<div class="sec"><div class="sec-title">Letzter Test <span class="aside">' + rel(t.at) + '</span></div>' + (t.errors && t.errors.length ? t.errors.map(function (e) { return '<div class="chip bad" style="margin:4px 0;height:auto;padding:8px 14px">' + esc(e) + '</div>'; }).join('') : '<span class="chip ok">' + ic('check') + 'Keine Fehler</span>') + (t.warnings && t.warnings.length ? '<div style="margin-top:10px">' + t.warnings.map(function (w) { return '<div class="small muted">• ' + esc(w) + '</div>'; }).join('') + '</div>' : '') + '</div>';
    }
    if (S.detailTab === 'versions') {
      var vs = (a.versions || []).slice().reverse();
      return '<div class="timeline">' + vs.map(function (x) { return '<div class="tl-item ' + (x.n === a.currentVersion ? 'current' : '') + '"><div class="row"><b>v' + x.n + ' · ' + esc(x.title) + '</b><span class="badge">' + esc({ create: 'Erstellt', fix: 'Fehlerbehebung', evolve: 'Weiterentwicklung', polish: 'Feinschliff' }[x.kind] || x.kind) + '</span><span class="badge">Score ' + (x.score == null ? '–' : x.score) + '</span><span class="small muted grow" style="text-align:right">' + rel(x.createdAt) + '</span>' + (x.n !== a.currentVersion ? '<button class="btn ghost sm" data-rollback="' + x.n + '">' + ic('undo') + 'Zurückrollen</button>' : '<span class="chip hot">aktuell</span>') + '</div>' + (x.description ? '<p class="small muted" style="margin-top:4px">' + esc(x.description) + '</p>' : '') + '</div>'; }).join('') +
        (a.rejected || []).slice(0, 8).map(function (r) { return '<div class="tl-item rejected"><div class="row"><span class="muted">Verworfen: ' + esc(r.title || 'Versuch') + '</span><span class="small muted grow" style="text-align:right">' + rel(r.at) + '</span></div><p class="small muted">' + esc(r.reason) + '</p></div>'; }).join('') + '</div>';
    }
    if (S.detailTab === 'sale') {
      var rd = S.readiness;
      if (!rd) return '<p class="muted">Prüfung nicht verfügbar.</p>';
      return '<div class="row" style="gap:24px;align-items:center">' + ring(rd.score / 100, 120, 10, '<span style="font-size:26px">' + rd.score + '%</span>') + '<div class="grow"><h3 style="font-size:22px">' + (rd.ready ? 'Bereit für den Store' : 'Fast bereit') + '</h3><p class="muted">Automatische Prüfung für Google Play und App Store. Manuelle Punkte sind orange markiert.</p><button class="btn" style="margin-top:14px" data-act="export">' + ic('box') + 'Store-Paket exportieren</button></div></div>' +
        '<div class="sec">' + rd.checks.map(function (k, i) { return '<div class="check"><span class="mark ' + (k.ok ? 'ok' : k.manual ? 'manual' : '') + '" style="animation-delay:' + i * 60 + 'ms">' + (k.ok ? ic('check') : k.manual ? '!' : ic('x')) + '</span><div><b>' + esc(k.label) + '</b>' + (k.ok ? '' : '<div class="small muted">' + esc(k.hint) + '</div>') + '</div></div>'; }).join('') + '</div>';
    }
    return '<div class="two"><div><div class="sec-title">Weiterentwickeln</div><p class="muted small">Die KI plant die wertvollste nächste Verbesserung, setzt sie um, testet und übernimmt sie nur, wenn die App besser wird.</p><div class="row" style="margin-top:14px"><button class="btn" data-act="evolve">' + ic('rocket') + 'Jetzt verbessern</button><button class="btn ghost" data-act="test">' + ic('flask') + 'Testen</button></div></div>' +
      '<div><div class="sec-title">Veröffentlichen</div><p class="muted small">Store-Paket mit Capacitor-Projekt, Store-Texten, Datenschutz-Vorlage und Anleitung.</p><div class="row" style="margin-top:14px"><button class="btn" data-act="export">' + ic('box') + 'Exportieren</button><button class="btn ghost" data-act="phone">' + ic('phone') + 'Aufs Handy</button></div></div>' +
      '<div><div class="sec-title">Dateien</div><div class="row"><button class="btn ghost" data-act="folder">' + ic('folder') + 'Ordner öffnen</button></div></div>' +
      '<div><div class="sec-title">Entfernen</div><div class="row"><button class="btn danger" data-act="delete">' + ic('trash') + 'App löschen</button></div></div></div>';
  }
  function copyBox(text) { return '<div class="copybox">' + esc(text || '') + '<button class="icon-btn" data-copy title="Kopieren">' + ic('copy') + '</button></div>'; }
  function wireDetail(a) {
    var d = $('#detail');
    var cl = $('#close-detail', d); if (cl) cl.onclick = closeDetail;
    $$('[data-tab]', d).forEach(function (b) { b.onclick = function () { S.detailTab = b.getAttribute('data-tab'); drawDetail(true); }; });
    var rp = $('#reload-prev', d); if (rp) rp.onclick = function () { var f = $('#preview', d); if (f) f.src = f.src.replace(/\?t=\d+$/, '') + (f.src.indexOf('forge://') === 0 ? '?t=' + Date.now() : ''); };
    var pb = $('#phone-btn', d); if (pb) pb.onclick = function () { showPhone(a); };
    $$('[data-copy]', d).forEach(function (b) { b.onclick = function () { navigator.clipboard.writeText(b.parentElement.textContent).then(function () { toast('Kopiert', 'success'); }); }; });
    $$('[data-rollback]', d).forEach(function (b) { b.onclick = function () { call('apps.rollback', { id: a.id, n: Number(b.getAttribute('data-rollback')) }).then(function () { toast('Zurückgerollt auf v' + b.getAttribute('data-rollback'), 'success'); refreshDetail(); loadApps().then(function () { if (S.view === 'studio') drawStudio(); }); }); }; });
    $$('[data-act]', d).forEach(function (b) {
      b.onclick = function () {
        var act = b.getAttribute('data-act');
        if (act === 'evolve') call('forge.evolve', { id: a.id }).then(function () { toast('Verbesserung gestartet – läuft im Hintergrund'); refreshStatus(); });
        if (act === 'test') call('forge.test', { id: a.id }).then(function () { toast('Test gestartet'); });
        if (act === 'phone') showPhone(a);
        if (act === 'folder') call('apps.openFolder', { id: a.id });
        if (act === 'export') call('export.app', { id: a.id }).then(function (r) {
          openSheet('<h3>Store-Paket fertig 📦</h3><p class="muted">Enthält PWA, Capacitor-Projekt (Android/iOS), Store-Texte, Datenschutz-Vorlage und Anleitung.</p><p class="code" style="display:inline-block;margin-top:12px">' + esc(r.dir) + '</p><div class="row" style="margin-top:22px;justify-content:flex-end"><button class="btn ghost" data-close>Schließen</button><button class="btn" data-open>' + ic('folder') + 'Ordner öffnen</button></div>', function (s) {
            $('[data-close]', s).onclick = closeSheet; $('[data-open]', s).onclick = function () { call('system.openPath', { path: r.dir }); closeSheet(); };
          });
        });
        if (act === 'delete') confirmSheet('„' + a.name + '“ löschen?', 'Alle Versionen dieser App werden endgültig entfernt.', 'Endgültig löschen', true).then(function (ok) { if (ok) call('apps.delete', { id: a.id }).then(function () { closeDetail(); toast('App gelöscht'); }); });
      };
    });
  }
  function showPhone(a) {
    call('lan.info', { id: a.id }).then(function (r) {
      openSheet('<h3>Auf dem Handy öffnen</h3><p class="muted">Handy ins gleiche WLAN, QR-Code scannen – dann im Browser-Menü „Zum Startbildschirm hinzufügen“.</p><div class="row" style="margin-top:18px;gap:22px;align-items:center">' + (r.qrDataUrl ? '<img class="qr" src="' + r.qrDataUrl + '" alt="QR-Code">' : '') + '<div class="grow"><div class="small muted">Adresse</div><p class="code" style="display:inline-block;margin-top:6px">' + esc(r.appUrl) + '</p><p class="small muted" style="margin-top:12px">Beim ersten Mal fragt Windows evtl. nach Firewall-Freigabe – „Private Netzwerke“ erlauben.</p></div></div><div class="row" style="margin-top:22px;justify-content:flex-end"><button class="btn ghost" data-close>Schließen</button></div>', function (s) { $('[data-close]', s).onclick = closeSheet; });
    });
  }

  // ------------------------------------------------------------------ Autopilot
  RENDER.autopilot = function () {
    Promise.all([safe('autopilot.status'), safe('ai.usage')]).then(function (r) { S.autopilot = r[0]; S.usage = r[1]; drawAutopilot(); });
    drawAutopilot();
  };
  function drawAutopilot() {
    var el = $('#view-autopilot'); var a = S.autopilot;
    if (!a) { el.innerHTML = '<div class="skeleton" style="height:300px"></div>'; return; }
    var ticks = S.feed.filter(function (f) { return f.auto; }).slice(0, 12);
    el.innerHTML = '<div class="hero" style="min-height:260px"><div class="hero-copy"><h1 class="h-title">Autopilot <span class="grad-text">' + (a.enabled ? 'arbeitet' : 'schläft') + '</span></h1><p class="lead">Erschafft neue Apps, prüft täglich alle Apps auf Fehler, repariert sie und entwickelt sie weiter – Version für Version. Schlechtere Versionen werden automatisch verworfen.</p>' +
      '<div class="hero-actions"><button class="switch ' + (a.enabled ? 'on' : '') + '" id="ap-switch" aria-label="Autopilot an/aus"></button><b>' + (a.enabled ? 'Eingeschaltet' : 'Ausgeschaltet') + '</b><button class="btn ghost" id="ap-now">' + ic('bolt') + 'Jetzt einen Schritt ausführen</button></div>' +
      '<p class="small muted" style="margin-top:14px">' + (a.enabled ? 'Nächster Schritt ' + rel(a.nextRunAt) : 'Tipp: Läuft auch minimiert im Tray weiter. Für „PC aus“: Cloud-Autopilot (Bereich Cloud).') + (a.lastRunAt ? ' · Letzter Schritt ' + rel(a.lastRunAt) : '') + '</p></div>' +
      '<div class="hero-orb ' + (a.enabled ? 'busy' : '') + '"><div class="blob"></div><div class="blob b2"></div><div class="core"><div><b>' + (a.intervalMin || 20) + '</b><br><span>Min. Takt</span></div></div></div></div>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">Einstellungen</div>' +
        '<div class="field"><label>Takt: alle <b id="iv-val">' + a.intervalMin + '</b> Minuten</label><input type="range" class="slider" id="iv" min="5" max="240" step="5" value="' + a.intervalMin + '"></div>' +
        '<div class="row" style="margin-top:18px"><button class="switch ' + (a.autoCreate ? 'on' : '') + '" data-sw="autoCreate"></button><span class="grow">Neue Apps automatisch erschaffen</span></div>' +
        '<div class="row" style="margin-top:12px"><button class="switch ' + (a.healthCheck ? 'on' : '') + '" data-sw="healthCheck"></button><span class="grow">Täglicher Gesundheitscheck aller Apps</span></div>' +
        '<div class="form-grid" style="margin-top:18px"><div class="field"><label>Maximale Anzahl Apps</label><input class="input" type="number" id="maxApps" min="1" max="500" value="' + a.maxApps + '"></div><div class="field"><label>Jeder n-te Schritt erschafft neu</label><input class="input" type="number" id="createEvery" min="1" max="20" value="' + a.createEvery + '"></div></div></div>' +
      '<div class="pebble"><div class="sec-title">Budget-Schutz</div>' + (S.usage && S.usage.available ? ring(Math.min(1, S.usage.today.costUsd / Math.max(0.01, S.usage.limits.dailyUsd)), 120, 10, '<span style="font-size:15px">' + usd(S.usage.today.costUsd) + '</span>') + '<p class="muted" style="margin-top:12px">von ' + usd(S.usage.limits.dailyUsd) + ' Tagesbudget · ' + S.usage.today.calls + ' / ' + S.usage.limits.dailyCalls + ' KI-Aufrufe. Bei Erreichen pausiert die KI bis morgen.</p>' : '<p class="muted">Gratis-Modus – 0 € KI-Kosten. Der Autopilot prüft Apps und erschafft Premium-Vorlagen; neue KI-Apps und Weiterentwicklungen liefert die nächtliche Claude-Sitzung über dein Abo.</p>') +
      '<div class="sec-title" style="margin-top:24px">Letzte Entscheidungen</div>' + (ticks.length ? ticks.map(function (f) { return '<div class="feed-item stage">' + esc(f.text) + '<time>' + rel(f.ts) + '</time></div>'; }).join('') : '<p class="muted small">Noch keine Autopilot-Schritte in dieser Sitzung.</p>') + '</div></div>';
    $('#ap-switch').onclick = function () { setAp({ enabled: !a.enabled }); };
    $('#ap-now').onclick = function () { call('autopilot.runNow').then(function () { toast('Autopilot-Schritt gestartet'); }); };
    var iv = $('#iv'); iv.oninput = function () { $('#iv-val').textContent = iv.value; }; iv.onchange = function () { setAp({ intervalMin: Number(iv.value) }); };
    $$('[data-sw]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-sw'); var p = {}; p[k] = !a[k]; setAp(p); }; });
    $('#maxApps').onchange = function () { setAp({ maxApps: Number($('#maxApps').value) }); };
    $('#createEvery').onchange = function () { setAp({ createEvery: Number($('#createEvery').value) }); };
  }
  function setAp(p) { call('autopilot.set', p).then(function (s) { S.autopilot = s; drawAutopilot(); renderPills(); }); }

  // ------------------------------------------------------------------ Trends
  RENDER.trends = function () { safe('trends.get').then(function (r) { S.trends = r; drawTrends(); }); drawTrends(); };
  function drawTrends() {
    var el = $('#view-trends'); var t = S.trends;
    var head = '<div class="row" style="align-items:flex-end"><div class="grow"><h1 class="h-title">Trend-<span class="grad-text">Radar</span></h1><p class="lead">Was sich gerade verkauft: App-Store-Charts plus KI-Websuche. Die Ideen-Engine richtet einen Teil der neuen Apps gezielt darauf aus – als eigene Konzepte, nie als Kopie.</p></div><button class="btn" id="tr-refresh">' + ic('refresh') + 'Jetzt aktualisieren</button></div>';
    if (!t) { el.innerHTML = head + '<div class="empty pebble sec"><div class="orb">' + ic('spark') + '</div><h3>Noch kein Trend-Bericht</h3><p class="muted">Aktualisiere den Radar, um die aktuellen Markttrends zu laden.</p></div>'; wireTr(); return; }
    el.innerHTML = head +
      '<div class="pebble sec"><div class="row"><span class="badge ' + (t.live ? 'ready' : '') + '">' + (t.live ? 'Live-Daten' : 'Basiswissen') + '</span><span class="small muted">Stand ' + new Date(t.updatedAt).toLocaleString('de-DE') + ' · ' + esc((t.country || 'de').toUpperCase()) + '</span></div><p style="margin-top:12px;font-size:15px">' + esc(t.summary) + '</p></div>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">Kategorien in den Charts</div>' + (t.topGenres && t.topGenres.length ? t.topGenres.map(function (g) { return '<div class="hbar"><span>' + esc(g.genre === 'game' ? 'Spiele' : g.genre) + '</span><div class="track"><i style="width:' + Math.min(100, g.share * 2.2) + '%"></i></div><b>' + g.share + '%</b></div>'; }).join('') : '<p class="muted small">Charts nicht erreichbar – Bericht nutzt Recherche/Basiswissen.</p>') + '</div>' +
      '<div class="pebble"><div class="sec-title">Heiße Themen</div><div class="row">' + (t.hotTopics || []).map(function (h) { return '<span class="chip hot">' + esc(h) + '</span>'; }).join('') + '</div><div class="sec-title" style="margin-top:22px">Was Geld bringt</div>' + (t.monetization || []).map(function (m) { return '<div class="feed-item success" style="margin-left:20px">' + esc(m) + '</div>'; }).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-title">Chancen für neue Apps</div><div class="opps">' + (t.opportunities || []).map(function (o, i) { return '<div class="opp edge" style="animation-delay:' + i * 60 + 'ms"><span class="badge ' + (o.type === 'game' ? 'game' : 'tool') + '">' + (o.type === 'game' ? 'Spiel' : 'App') + ' · ' + esc(o.category) + '</span><h4>' + esc(o.direction) + '</h4><p class="small muted">' + esc(o.why) + '</p></div>'; }).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-title">Quellen</div><div class="row">' + (t.sources || []).map(function (s) { return '<span class="chip ' + (s.ok ? 'ok' : 'bad') + '" title="' + esc(s.note) + '">' + (s.ok ? '●' : '○') + ' ' + esc(s.name) + '</span>'; }).join('') + '</div></div>';
    wireTr();
  }
  function wireTr() { $('#tr-refresh').onclick = function () { call('trends.refresh').then(function () { toast('Trend-Radar wird aktualisiert …'); }); }; }

  // ------------------------------------------------------------------ Netzwerk
  RENDER.network = function () { safe('plugins.list').then(function (p) { S.plugins = p || []; drawNetwork(); }); drawNetwork(); };
  var NET = { pos: {}, paths: {} };
  function drawNetwork() {
    var el = $('#view-network'); var ps = S.plugins;
    var cnt = { running: 0, stopped: 0, planned: 0 };
    ps.forEach(function (p) { if (p.status === 'running') cnt.running++; else if (p.status === 'planned') cnt.planned++; else cnt.stopped++; });
    el.innerHTML = '<div class="row" style="align-items:flex-end;margin-bottom:18px"><div class="grow"><h1 class="h-title">Das <span class="grad-text">Nervensystem</span></h1><p class="lead">Jeder Anschluss ist ein Kabel am Hub. Lichtimpulse zeigen live, welcher Anschluss gerade arbeitet. Klick auf einen Knoten zum Einstellen.</p></div></div>' +
      '<div class="net-wrap"><div class="net" id="net"><div class="net-count"><span class="pill"><span class="dot on"></span>' + cnt.running + ' aktiv</span><span class="pill"><span class="dot"></span>' + cnt.stopped + ' aus</span><span class="pill">◌ ' + cnt.planned + ' geplant</span></div>' +
      '<div class="legend"><span><i style="background:linear-gradient(90deg,#8b5cf6,#ec4899,#fb923c)"></i>aktiv</span><span><i style="background:rgba(255,255,255,.18)"></i>aus</span><span><i style="background:repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0 4px,transparent 4px 9px)"></i>geplant</span><span><i style="background:#fb7185"></i>Fehler</span><span><i style="background:rgba(34,211,238,.4)"></i>Abhängigkeit</span></div></div>' +
      '<div class="pebble side" id="net-side"></div></div>';
    layoutNet();
    drawNetSide();
  }
  // Beschriftung kollisionsfrei platzieren: Kandidaten (außen, unten, oben, innen) prüfen gegen Knoten, Kern, andere Labels und Rand
  function placeLabel(p, x, y, ang, out, w, h, cx, cy) {
    var name = p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name;
    var tw = name.length * 6.7 + 6; var ux = Math.cos(ang) * out;
    var side = ux >= 0 ? 1 : -1;
    var cands = [
      { x: x + 30 * side, y: y + 4, anchor: side > 0 ? 'start' : 'end' },
      { x: x, y: y + 40, anchor: 'middle' },
      { x: x, y: y - 30, anchor: 'middle' },
      { x: x - 30 * side, y: y + 4, anchor: side > 0 ? 'end' : 'start' }
    ];
    if (Math.abs(ux) < 0.45) cands = [cands[Math.sin(ang) * out > 0 ? 1 : 2], cands[Math.sin(ang) * out > 0 ? 2 : 1], cands[0], cands[3]];
    function box(c) { var x0 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - tw : c.x - tw / 2; return { x0: x0 - 3, x1: x0 + tw + 3, y0: c.y - 12, y1: c.y + 4 }; }
    function cost(b) {
      var k = 0;
      if (b.x0 < 4 || b.x1 > w - 4 || b.y0 < 4 || b.y1 > h - 34) k += 1000;
      NET.boxes.forEach(function (o) { var ix = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0), iy = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0); if (ix > 0 && iy > 0) k += ix * iy; });
      NET.dots.forEach(function (d) { var nx = Math.max(b.x0, Math.min(d.x, b.x1)), ny = Math.max(b.y0, Math.min(d.y, b.y1)); var dd = Math.hypot(d.x - nx, d.y - ny); if (dd < d.r) k += (d.r - dd) * 8; });
      return k;
    }
    var best = null;
    cands.forEach(function (c, ix) { var b = box(c); var k = cost(b) + ix * 0.5; if (!best || k < best.k) best = { k: k, c: c, b: b }; });
    NET.boxes.push(best.b);
    return best.c;
  }
  function layoutNet() {
    var host = $('#net'); if (!host) return;
    var w = host.clientWidth || 900; var h = host.clientHeight || 600; var cx = w / 2; var cy = h / 2 + 6;
    var order = ['core', 'ai', 'generator', 'quality', 'evolution', 'storage', 'export', 'publish', 'api', 'integration', 'store', 'system'];
    var ps = S.plugins.slice().sort(function (a, b) { return order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id); });
    var rx = w * 0.4; var ry = h * 0.38; var n = Math.max(1, ps.length);
    NET.pos = {}; NET.paths = {}; NET.boxes = []; NET.dots = [{ x: cx, y: cy, r: 66 }];
    ps.forEach(function (p, i) { var a = -Math.PI / 2 + (i / n) * Math.PI * 2; var wb = i % 2 ? 0.86 : 1; NET.dots.push({ x: cx + Math.cos(a) * rx * wb, y: cy + Math.sin(a) * ry * wb, r: 24 }); });
    var cables = ''; var nodes = ''; var links = '';
    ps.forEach(function (p, i) {
      var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var wob = (i % 2 ? 0.86 : 1);
      var x = cx + Math.cos(ang) * rx * wob; var y = cy + Math.sin(ang) * ry * wob;
      NET.pos[p.id] = { x: x, y: y };
      var dx = x - cx, dy = y - cy; var len = Math.sqrt(dx * dx + dy * dy) || 1; var nx = -dy / len, ny = dx / len; var bend = (i % 3 - 1) * 46 + 30;
      var c1x = cx + dx * 0.3 + nx * bend, c1y = cy + dy * 0.3 + ny * bend, c2x = cx + dx * 0.72 - nx * bend * 0.6, c2y = cy + dy * 0.72 - ny * bend * 0.6;
      var d = 'M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
      NET.paths[p.id] = d;
      cables += '<path class="cable ' + p.status + '" d="' + d + '"/>';
      var col = KIND_COLORS[p.kind] || '#94a3b8'; var dim = p.status !== 'running';
      var lb = placeLabel(p, x, y, ang, i % 2 ? -1 : 1, w, h, cx, cy, ps.length, i); var lx = lb.x, ly = lb.y, anchor = lb.anchor;
      nodes += '<g class="node ' + p.status + (S.netSel === p.id ? ' sel' : '') + '" data-id="' + esc(p.id) + '" tabindex="0"><circle class="halo" cx="' + x + '" cy="' + y + '" r="' + (S.netSel === p.id ? 34 : 28) + '" fill="' + col + '" opacity=".25" filter="url(#blur)"/><circle cx="' + x + '" cy="' + y + '" r="20" fill="' + (dim ? 'rgba(20,16,36,.95)' : col) + '" stroke="' + col + '" stroke-width="2" ' + (p.status === 'planned' ? 'stroke-dasharray="3 4"' : '') + '/><circle cx="' + (x + 14) + '" cy="' + (y - 14) + '" r="5" fill="' + ({ running: '#34d399', error: '#fb7185', planned: '#fbbf24' }[p.status] || '#475569') + '" stroke="#07070d" stroke-width="2"/><g class="kind-ic" transform="translate(' + (x - 9) + ' ' + (y - 9) + ') scale(.75)" style="stroke:' + (dim ? col : '#0b0b14') + '">' + (KIND_ICON[p.kind] || IC.spark) + '</g><text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '">' + esc(p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name) + '</text></g>';
    });
    // Abhängigkeiten
    ps.forEach(function (p) {
      (p.requires || []).forEach(function (cap) {
        ps.forEach(function (q) {
          if (q.id === p.id || (q.provides || []).indexOf(cap) < 0) return;
          var a = NET.pos[p.id], b = NET.pos[q.id]; if (!a || !b) return;
          var mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.35, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.35;
          links += '<path class="link" d="M' + a.x + ' ' + a.y + ' Q' + mx + ' ' + my + ' ' + b.x + ' ' + b.y + '"/>';
        });
      });
    });
    var svgEl = '<svg id="net-svg" viewBox="0 0 ' + w + ' ' + h + '"><defs><linearGradient id="cableGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".5" stop-color="#ec4899"/><stop offset="1" stop-color="#fb923c"/></linearGradient><radialGradient id="coreGrad"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#f472b6"/><stop offset="1" stop-color="#7c3aed"/></radialGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="blur"><feGaussianBlur stdDeviation="8"/></filter></defs>' +
      links + cables + '<g id="core"><circle cx="' + cx + '" cy="' + cy + '" r="70" fill="#ec4899" opacity=".18" filter="url(#blur)"><animate attributeName="r" values="62;78;62" dur="5s" repeatCount="indefinite"/></circle><circle id="core-orb" cx="' + cx + '" cy="' + cy + '" r="40" fill="url(#coreGrad)"/><text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" style="font-size:12px;font-weight:850;fill:#0b0b14">FORGE</text><text x="' + cx + '" y="' + (cy + 62) + '" text-anchor="middle" style="font-size:12px;font-weight:700;fill:#f4f6fb;paint-order:stroke;stroke:#07070d;stroke-width:4px">Forge Core</text></g><g id="sparks"></g>' + nodes + '</svg>';
    var old = $('#net-svg', host); if (old) old.remove();
    host.insertAdjacentHTML('afterbegin', svgEl);
    $$('.node', host).forEach(function (g) {
      g.addEventListener('click', function () { S.netSel = g.getAttribute('data-id'); $$('.node', host).forEach(function (x) { x.classList.toggle('sel', x === g); }); drawNetSide(); });
    });
  }
  window.addEventListener('resize', function () { if (S.view === 'network') later('net', layoutNet, 150); });
  function spark(source) {
    if (S.view !== 'network') return;
    var d = NET.paths[source]; var g = $('#sparks'); if (!d || !g) return;
    var ns = 'http://www.w3.org/2000/svg';
    var c = document.createElementNS(ns, 'circle'); c.setAttribute('r', '5'); c.setAttribute('fill', '#fff'); c.setAttribute('class', 'spark');
    var m = document.createElementNS(ns, 'animateMotion'); m.setAttribute('dur', '0.9s'); m.setAttribute('path', d); m.setAttribute('keyPoints', '1;0'); m.setAttribute('keyTimes', '0;1'); m.setAttribute('calcMode', 'linear'); m.setAttribute('fill', 'freeze'); m.setAttribute('begin', 'indefinite');
    c.appendChild(m); g.appendChild(c);
    try { m.beginElement(); } catch (e) { /* egal */ }
    var orb = $('#core-orb'); if (orb) { orb.setAttribute('r', '46'); setTimeout(function () { orb.setAttribute('r', '40'); }, 260); }
    setTimeout(function () { c.remove(); }, 1000);
  }
  function drawNetSide() {
    var side = $('#net-side'); if (!side) return;
    var p = S.plugins.filter(function (x) { return x.id === S.netSel; })[0];
    if (!p) {
      side.innerHTML = '<div class="sec-title">Anschlüsse</div><p class="muted small">Wähle einen Knoten im Netzwerk. Neue Kabel lassen sich jederzeit als Plugin-Datei andocken.</p><div style="margin-top:14px">' + S.plugins.map(function (x) { return '<div class="row" style="padding:6px 0;cursor:pointer" data-pick="' + esc(x.id) + '"><span style="width:10px;height:10px;border-radius:50%;background:' + (KIND_COLORS[x.kind] || '#94a3b8') + '"></span><span class="grow">' + esc(x.name) + '</span><span class="small muted">' + (STATUS_LABEL[x.status] || x.status) + '</span></div>'; }).join('') + '</div>';
      $$('[data-pick]', side).forEach(function (r) { r.onclick = function () { S.netSel = r.getAttribute('data-pick'); layoutNet(); drawNetSide(); }; });
      return;
    }
    var canToggle = p.status !== 'planned' && p.status !== 'unavailable';
    side.innerHTML = '<div class="row"><span class="badge" style="background:' + (KIND_COLORS[p.kind] || '#94a3b8') + '33;color:' + (KIND_COLORS[p.kind] || '#94a3b8') + '">' + esc(KIND_LABEL[p.kind] || p.kind) + '</span><span class="badge">' + esc(STATUS_LABEL[p.status] || p.status) + '</span><span class="grow"></span>' + (canToggle ? '<button class="switch ' + (p.enabled ? 'on' : '') + '" id="pl-toggle" title="An/Aus"></button>' : '') + '</div>' +
      '<h3 style="font-size:20px;margin:14px 0 6px">' + esc(p.name) + '</h3><p class="muted small">' + esc(p.description) + '</p>' + (p.error ? '<div class="hint" style="margin-top:12px">' + esc(p.error) + '</div>' : '') +
      ((p.provides || []).length ? '<div class="small muted" style="margin-top:14px">Bietet</div><div class="row" style="margin-top:6px">' + p.provides.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
      ((p.requires || []).length ? '<div class="small muted" style="margin-top:12px">Braucht</div><div class="row" style="margin-top:6px">' + p.requires.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
      ((p.settings || []).length ? '<div class="sec-title" style="margin-top:22px">Einstellungen</div><div id="pl-form">' + p.settings.map(settingField).join('') + '</div><div class="row" style="margin-top:14px"><button class="btn sm" id="pl-save">Speichern</button></div>' : '') +
      (p.status === 'running' ? '<div class="row" style="margin-top:16px"><button class="btn ghost sm" id="pl-health">' + ic('flask') + 'Zustand prüfen</button><span class="small muted" id="pl-health-out"></span></div>' : '') +
      '<div class="row" style="margin-top:18px"><button class="btn ghost sm" id="pl-back">Alle Anschlüsse</button></div>';
    var t = $('#pl-toggle'); if (t) t.onclick = function () { call('plugins.toggle', { id: p.id, enabled: !p.enabled }).then(function (np) { replacePlugin(np); toast(np.name + (np.enabled ? ' eingeschaltet' : ' ausgeschaltet'), np.status === 'error' ? 'error' : 'success'); }); };
    var sv = $('#pl-save'); if (sv) sv.onclick = function () { call('plugins.configure', { id: p.id, values: readForm($('#pl-form')) }).then(function (np) { replacePlugin(np); toast('Gespeichert', 'success'); }); };
    var hb = $('#pl-health'); if (hb) hb.onclick = function () { call('plugins.health', { id: p.id }).then(function (h) { $('#pl-health-out').textContent = (h.ok ? '✓ ' : '✗ ') + h.message; }); };
    $('#pl-back').onclick = function () { S.netSel = null; layoutNet(); drawNetSide(); };
  }
  function replacePlugin(np) { S.plugins = S.plugins.map(function (x) { return x.id === np.id ? np : x; }); layoutNet(); drawNetSide(); refreshStatus(); }
  function settingField(s) {
    var id = 'f-' + s.key;
    if (s.type === 'boolean') return '<div class="row" style="margin:10px 0"><button class="switch ' + (s.value ? 'on' : '') + '" data-key="' + esc(s.key) + '" data-bool></button><span class="grow">' + esc(s.label) + '</span></div>';
    var input = s.type === 'select'
      ? '<select class="input" id="' + id + '" data-key="' + esc(s.key) + '">' + (s.options || []).map(function (o) { var v = typeof o === 'string' ? o : o.value; var l = typeof o === 'string' ? o : o.label; return '<option value="' + esc(v) + '"' + (String(s.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'
      : '<input class="input" id="' + id + '" data-key="' + esc(s.key) + '" type="' + (s.type === 'password' ? 'password' : s.type === 'number' ? 'number' : 'text') + '" value="' + esc(s.value == null ? '' : s.value) + '" autocomplete="off">';
    return '<div class="field" style="margin:10px 0"><label for="' + id + '">' + esc(s.label) + '</label>' + input + (s.help ? '<span class="small muted" style="padding-left:6px">' + esc(s.help) + '</span>' : '') + '</div>';
  }
  function readForm(root) {
    var v = {};
    $$('[data-key]', root).forEach(function (el) { var k = el.getAttribute('data-key'); v[k] = el.hasAttribute('data-bool') ? el.classList.contains('on') : el.value; });
    return v;
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-bool]'); if (b) b.classList.toggle('on'); });

  // ------------------------------------------------------------------ Cloud
  RENDER.cloud = function () {
    Promise.all([safe('cloud.status'), safe('github.status'), safe('api.info'), safe('plugins.list')]).then(function (r) { S.cloud = r[0]; S.gh = r[1]; S.api = r[2]; S.plugins = r[3] || S.plugins; drawCloud(); });
    drawCloud();
  };
  function drawCloud() {
    var el = $('#view-cloud'); var c = S.cloud; var g = S.gh; var api = S.api;
    el.innerHTML = '<h1 class="h-title">Cloud &amp; <span class="grad-text">Fernsteuerung</span></h1><p class="lead">Dein PC darf aus sein: Der Cloud-Autopilot läuft auf GitHub Actions, die Apps landen live auf Firebase Hosting, und du steuerst alles vom Handy.</p>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">Firebase</div>' + (c ? '<div class="row"><span class="chip ' + (c.lastError ? 'bad' : 'ok') + '">' + (c.lastError ? 'Fehler' : 'Verbunden') + '</span><span class="small muted">Projekt ' + esc(c.projectId) + '</span></div>' + (c.lastError ? '<div class="hint" style="margin-top:12px">' + esc(c.lastError) + '</div>' : '') + '<p class="small muted" style="margin-top:12px">Letzte Synchronisierung ' + rel(c.lastSyncAt) + ' · ' + c.commandsHandled + ' Fernbefehle ausgeführt · ' + c.pendingCommands + ' offen</p><div class="row" style="margin-top:14px"><button class="btn sm" id="fb-sync">' + ic('refresh') + 'Jetzt synchronisieren</button><button class="btn ghost sm" id="fb-open">Galerie & Fernsteuerung öffnen</button></div>' : '<p class="muted">Noch nicht verbunden. Im <b>Netzwerk</b> den Knoten „Firebase“ öffnen, Projekt-ID + Service-Account eintragen und einschalten.</p><div class="row" style="margin-top:14px"><button class="btn sm" data-netgo="cloud.firebase">Firebase einrichten</button></div>') + '</div>' +
      '<div class="pebble"><div class="sec-title">GitHub · Cloud-Bibliothek</div>' + (g ? '<p class="muted small">Neue Apps der nächtlichen Gratis-Sitzung landen im Branch „forge-library“ und werden automatisch geholt.' + (g.lastPull ? ' Zuletzt ' + rel(g.lastPull.at) + ': ' + esc(g.lastPull.message) : '') + '</p><div class="row" style="margin:14px 0 10px"><button class="btn sm" id="gh-pull">' + ic('refresh') + 'Cloud-Apps holen</button>' +
        (g.canDispatch ? '<button class="btn ghost sm" data-dispatch="publish">' + ic('play') + 'Galerie veröffentlichen</button><button class="btn ghost sm" data-dispatch="autopilot">API-Lauf</button>' : '') + '</div>' +
        (g.canDispatch ? (g.lastRuns.length ? '<div class="feed" style="max-height:200px">' + g.lastRuns.map(function (r) { return '<div class="feed-item ' + (r.conclusion === 'success' ? 'success' : r.conclusion === 'failure' ? 'error' : 'stage') + '">' + esc(r.event) + ' · ' + esc(r.conclusion || r.status) + '<time>' + new Date(r.createdAt).toLocaleString('de-DE') + '</time></div>'; }).join('') + '</div>' : '<p class="muted small">Noch keine Cloud-Läufe.</p>') : '<p class="small muted">Optional: GitHub-Token im <b>Netzwerk</b> eintragen, um Cloud-Läufe von hier zu starten (bei privatem Repository auch zum Holen nötig).</p>')
        : '<p class="muted">GitHub-Anschluss ist aus. Im <b>Netzwerk</b> den Knoten „GitHub Cloud-Autopilot“ einschalten.</p><div class="row" style="margin-top:14px"><button class="btn sm" data-netgo="cloud.github">GitHub einrichten</button></div>') + '</div></div>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">So steuerst du alles vom Handy</div>' +
        '<div class="steps">' + [
          ['Claude Code App', 'Sitzung mit dem Repository starten und sagen, was am Programm verbessert werden soll. Claude arbeitet in der Cloud, dein PC kann aus sein.'],
          ['GitHub App', 'Actions → „Forge Cloud Autopilot“ → Run workflow. Oder in einem Issue <span class="code">@claude</span> erwähnen.'],
          ['Fernsteuerungs-Seite', 'Befehle an Cloud oder PC senden, Status live sehen (Firebase).'],
          ['Programm-Updates', 'Jede Änderung baut automatisch einen neuen Windows-Installer; dein PC aktualisiert sich selbst.']
        ].map(function (x, i) { return '<div class="step"><span class="step-n">' + (i + 1) + '</span><div><b>' + x[0] + '</b><div class="small muted">' + x[1] + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="pebble"><div class="sec-title">Lokale REST-API</div>' + (api ? '<p class="muted small">Steckdose für Automatisierungen (n8n, Skripte, Stream Deck). Alle Befehle per HTTP, Ereignisse live per SSE.</p><div class="field" style="margin-top:12px"><label>Adresse</label><p class="code">' + esc(api.baseUrl) + '</p></div><div class="field" style="margin-top:12px"><label>Token</label><div class="row"><span class="code" id="tok">••••••••••••</span><button class="icon-btn" id="tok-show" title="Anzeigen">' + ic('eye') + '</button><button class="icon-btn" id="tok-copy" title="Kopieren">' + ic('copy') + '</button></div></div><p class="small muted" style="margin-top:12px">Beispiel: <span class="code">POST /api/invoke/forge.create</span> mit Header <span class="code">Authorization: Bearer &lt;Token&gt;</span></p>' : '<p class="muted">API ist ausgeschaltet (Netzwerk → „Lokale REST-API“).</p>') + '</div></div>';
    var s = $('#fb-sync'); if (s) s.onclick = function () { call('cloud.syncNow').then(function () { toast('Synchronisiert', 'success'); RENDER.cloud(); }); };
    var o = $('#fb-open'); if (o && c) o.onclick = function () { window.open(c.hostingUrl + '/remote.html'); };
    var gp = $('#gh-pull', el); if (gp) gp.onclick = function () { gp.disabled = true; toast('Hole Cloud-Apps …'); call('github.pullLibrary').then(function (r) { toast(r.message, 'success'); reloadApps(); RENDER.cloud(); }).catch(function () { gp.disabled = false; }); };
    $$('[data-dispatch]', el).forEach(function (b) { b.onclick = function () { call('github.dispatch', { mode: b.getAttribute('data-dispatch'), count: 2 }).then(function () { toast('Cloud-Lauf gestartet – Ergebnis in ein paar Minuten', 'success'); setTimeout(RENDER.cloud, 5000); }); }; });
    $$('[data-netgo]', el).forEach(function (b) { b.onclick = function () { S.netSel = b.getAttribute('data-netgo'); go('network'); }; });
    var ts = $('#tok-show'); if (ts) ts.onclick = function () { $('#tok').textContent = api.token; };
    var tc = $('#tok-copy'); if (tc) tc.onclick = function () { navigator.clipboard.writeText(api.token).then(function () { toast('Token kopiert', 'success'); }); };
  }

  // ------------------------------------------------------------------ Lernspeicher
  RENDER.lessons = function () { safe('lessons.list').then(function (l) { S.lessons = l || []; drawLessons(); }); drawLessons(); };
  function drawLessons() {
    var el = $('#view-lessons'); var l = S.lessons;
    el.innerHTML = '<div class="row" style="align-items:flex-end"><div class="grow"><h1 class="h-title">Der <span class="grad-text">Lernspeicher</span></h1><p class="lead">So verbessert sich der Generator selbst: Jeder gefundene und behobene Fehler wird zu einer allgemeinen Regel. Diese Regeln fließen in jeden künftigen Bau ein – häufige Fehler verschwinden dauerhaft.</p></div>' + (l.length ? '<button class="btn ghost" id="ls-clear">' + ic('trash') + 'Alles vergessen</button>' : '') + '</div>' +
      '<div class="sec">' + (l.length ? l.map(function (x, i) { return '<div class="lesson" style="animation-delay:' + i * 40 + 'ms"><span class="hits" title="So oft bestätigt">' + x.hits + '</span><span class="grow">' + esc(x.text) + '</span><span class="small muted">' + rel(x.lastSeen) + '</span><button class="icon-btn" data-rm="' + esc(x.text) + '" title="Entfernen">' + ic('x') + '</button></div>'; }).join('') : '<div class="empty pebble"><div class="orb">' + ic('spark') + '</div><h3>Noch nichts gelernt</h3><p class="muted">Sobald die KI Fehler findet und behebt, entstehen hier Regeln.</p></div>') + '</div>';
    var c = $('#ls-clear'); if (c) c.onclick = function () { confirmSheet('Lernspeicher leeren?', 'Alle gelernten Regeln werden gelöscht.', 'Leeren', true).then(function (ok) { if (ok) call('lessons.clear').then(RENDER.lessons); }); };
    $$('[data-rm]', el).forEach(function (b) { b.onclick = function () { call('lessons.remove', { text: b.getAttribute('data-rm') }).then(RENDER.lessons); }; });
  }

  // ------------------------------------------------------------------ Einstellungen
  RENDER.settings = function () {
    Promise.all([safe('settings.get'), safe('plugins.list'), safe('updater.status'), safe('system.info')]).then(function (r) { S.settings = r[0]; S.plugins = r[1] || S.plugins; S.updater = r[2]; S.sys = r[3]; drawSettings(); });
    drawSettings();
  };
  function drawSettings() {
    var el = $('#view-settings'); var st = S.settings;
    if (!st) { el.innerHTML = '<div class="skeleton" style="height:400px"></div>'; return; }
    var aiP = S.plugins.filter(function (p) { return p.id === 'ai.anthropic'; })[0] || { settings: [] };
    var key = (aiP.settings.filter(function (s) { return s.key === 'apiKey'; })[0] || {}).value || '';
    var model = (aiP.settings.filter(function (s) { return s.key === 'model'; })[0] || {}).value || 'claude-opus-5-5';
    var aiMode = S.aiModeDraft || (aiP.settings.filter(function (s) { return s.key === 'mode'; })[0] || {}).value || 'free';
    var up = S.updater; var sys = S.sys;
    el.innerHTML = '<h1 class="h-title"><span class="grad-text">Einstellungen</span></h1>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">KI-Modus</div>' +
        '<div class="tabs seg" style="margin:4px 0 16px"><button data-aimode="free" class="' + (aiMode === 'free' ? 'on' : '') + '">Gratis · Claude-Abo</button><button data-aimode="api" class="' + (aiMode === 'api' ? 'on' : '') + '">API-Key</button></div>' +
        (aiMode === 'free'
          ? '<div class="steps"><div class="step"><span class="step-n">0€</span><div><b>Keine KI-Kosten</b><div class="small muted">Jede Nacht baut deine Claude-Code-Sitzung über dein Claude-Abo eine neue App und verbessert eine bestehende – getestet mit demselben Test-Labor und denselben Qualitäts-Gates.</div></div></div><div class="step"><span class="step-n">' + ic('refresh') + '</span><div><b>Kommt automatisch an</b><div class="small muted">Neue Apps holt das Programm alle paar Stunden aus der Cloud (Cloud → „Cloud-Apps holen“). Hier im Programm entstehen Premium-Vorlagen.</div></div></div></div>' +
            '<p class="small muted" style="margin-top:16px">Mehr Tempo? Auf „API-Key“ umstellen: Dauerbetrieb direkt im Programm, kostet API-Guthaben (grob 1–3 US$ pro neuer App mit Opus 5.5).</p>'
          : '<p class="muted small">Dauerbetrieb im Programm: Die KI erfindet, repariert, bewertet und entwickelt Apps rund um die Uhr. Kostet API-Guthaben – das Tagesbudget rechts begrenzt die Kosten. Key erstellen: console.anthropic.com → API Keys.</p>' +
            '<div class="field" style="margin-top:14px"><label>API-Key</label><input class="input" type="password" id="ai-key" placeholder="sk-ant-…" value="' + esc(key) + '" autocomplete="off"></div>' +
            '<div class="field" style="margin-top:12px"><label>Modell</label><select class="input" id="ai-model">' + [['claude-opus-5-5', 'Opus 5.5 – beste Qualität (Standard)'], ['claude-sonnet-5-5', 'Sonnet 5.5 – halber Preis'], ['claude-haiku-5-5', 'Haiku 5.5 – sehr günstig']].map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === model ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="row" style="margin-top:16px"><button class="btn" id="ai-save">Speichern</button><button class="btn ghost" id="ai-test">Verbindung testen</button></div>') + '</div>' +
      '<div class="pebble"><div class="sec-title">Budget &amp; Qualität</div><div class="form-grid">' +
        num('budget.dailyUsd', 'Tagesbudget (US-$)', st.budget.dailyUsd, 0, 1000, 0.5) + num('budget.dailyCalls', 'Max. KI-Aufrufe pro Tag', st.budget.dailyCalls, 1, 2000, 1) +
        num('core.maxFixRounds', 'Reparatur-Runden pro Build', st.core.maxFixRounds, 0, 6, 1) + num('core.minScore', 'Mindest-Score für neue Apps', st.core.minScore, 0, 100, 1) + '</div>' +
        '<div class="field" style="margin-top:14px"><label>Sprache der Apps</label><select class="input" data-set="core.language"><option value="de"' + (st.core.language === 'de' ? ' selected' : '') + '>Deutsch</option><option value="en"' + (st.core.language === 'en' ? ' selected' : '') + '>Englisch (internationaler Markt)</option></select></div></div></div>' +
      '<div class="two sec"><div class="pebble"><div class="sec-title">Windows</div>' +
        '<div class="row"><button class="switch ' + (sys && sys.autostart ? 'on' : '') + '" id="sw-auto"></button><span class="grow">Mit Windows starten (unsichtbar im Tray)</span></div>' +
        '<div class="row" style="margin-top:12px"><button class="switch ' + (st.app.minimizeToTray ? 'on' : '') + '" id="sw-tray"></button><span class="grow">Beim Schließen im Tray weiterarbeiten</span></div>' +
        '<div class="row" style="margin-top:18px"><button class="btn ghost sm" id="open-data">' + ic('folder') + 'Datenordner öffnen</button></div></div>' +
      '<div class="pebble"><div class="sec-title">Programm-Updates</div>' + (up ? '<p class="muted small">Version ' + esc(up.version) + ' · Status: ' + esc({ idle: 'aktuell', checking: 'prüfe …', downloading: 'lädt Update …', ready: 'Update bereit', error: 'Fehler', disabled: 'nur in installierter Version' }[up.state] || up.state) + (up.newVersion ? ' · neu: ' + esc(up.newVersion) : '') + '</p>' + (up.error && up.state !== 'disabled' ? '<div class="hint" style="margin-top:10px">' + esc(up.error) + '</div>' : '') + '<div class="row" style="margin-top:14px"><button class="btn ghost sm" id="up-check">' + ic('refresh') + 'Nach Updates suchen</button>' + (up.state === 'ready' ? '<button class="btn sm" id="up-install">Jetzt neu starten &amp; installieren</button>' : '') + '</div>' : '<p class="muted small">Update-Anschluss nicht aktiv.</p>') +
        (sys ? '<p class="small muted" style="margin-top:18px">Electron ' + esc(sys.electron) + ' · Daten: <span class="code">' + esc(sys.dataDir) + '</span></p>' : '') + '</div></div>';
    $$('[data-aimode]', el).forEach(function (b) {
      b.onclick = function () {
        var m = b.getAttribute('data-aimode');
        if (m === 'api') { S.aiModeDraft = 'api'; drawSettings(); return; }
        S.aiModeDraft = null;
        call('plugins.configure', { id: 'ai.anthropic', values: { mode: 'free' } }).then(function () { toast('Gratis-Modus aktiv – keine KI-Kosten', 'success'); refreshStatus(); RENDER.settings(); });
      };
    });
    var sv = $('#ai-save'); if (sv) sv.onclick = function () {
      var k = $('#ai-key').value.trim();
      if (!k) { toast('Bitte API-Key eintragen', 'error'); return; }
      call('plugins.configure', { id: 'ai.anthropic', values: { mode: 'api', apiKey: k, model: $('#ai-model').value } }).then(function () { S.aiModeDraft = null; toast('API-Modus aktiv', 'success'); refreshStatus(); RENDER.settings(); });
    };
    var tb = $('#ai-test'); if (tb) tb.onclick = function () { toast('Teste Verbindung …'); call('ai.test').then(function (r) { toast(r.message, r.ok ? 'success' : 'error'); }); };
    $$('[data-set]', el).forEach(function (inp) { inp.onchange = function () { var v = inp.type === 'number' ? Number(inp.value) : inp.value; call('settings.set', { key: inp.getAttribute('data-set'), value: v }).then(function (s) { S.settings = s; toast('Gespeichert', 'success'); }); }; });
    $('#sw-auto').onclick = function () { call('system.setAutostart', { enabled: !(sys && sys.autostart) }).then(RENDER.settings); };
    $('#sw-tray').onclick = function () { call('settings.set', { key: 'app.minimizeToTray', value: !st.app.minimizeToTray }).then(RENDER.settings); };
    $('#open-data').onclick = function () { call('system.openDataDir'); };
    var uc = $('#up-check'); if (uc) uc.onclick = function () { call('updater.check').then(RENDER.settings); };
    var ui = $('#up-install'); if (ui) ui.onclick = function () { call('updater.install'); };
  }
  function num(key, label, val, min, max, step) { return '<div class="field"><label>' + esc(label) + '</label><input class="input" type="number" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + esc(val) + '"></div>'; }

  // ------------------------------------------------------------------ Live-Ereignisse
  F.on(function (e) {
    var p = e.payload || {};
    if (e.source) spark(e.source);
    switch (e.type) {
      case 'pipeline.stage': addFeed('stage', p.message, e.ts); break;
      case 'log': addFeed(p.level === 'error' ? 'error' : p.level === 'warn' ? 'warn' : p.level === 'success' ? 'success' : '', p.message, e.ts); break;
      case 'app.created': addFeed('success', 'Neue App: ' + p.app.name, e.ts); toast('Neue App erschaffen: ' + p.app.name, 'success'); later('apps', reloadApps); break;
      case 'app.version.created': addFeed('success', 'Verbessert: ' + (p.name || p.appId) + ' – ' + p.version.title, e.ts); toast('Verbessert: ' + (p.name || '') + ' v' + p.version.n, 'success'); later('apps', reloadApps); if (S.detail && S.detail.id === p.appId) refreshDetail(); break;
      case 'app.version.rejected': addFeed('warn', 'Verworfen' + (p.title ? ' „' + p.title + '“' : '') + ': ' + p.reason, e.ts); if (S.detail && S.detail.id === p.appId) refreshDetail(); break;
      case 'app.deleted': case 'app.rolledback': later('apps', reloadApps); break;
      case 'test.finished': addFeed(p.ok ? 'success' : 'error', 'Test ' + (p.ok ? 'bestanden' : 'mit ' + p.errors.length + ' Fehler(n)') + ' · Technik ' + p.score, e.ts); if (S.detail && S.detail.id === p.appId) later('detail', refreshDetail, 400); break;
      case 'job.queued': case 'job.started': case 'job.progress': case 'job.done': case 'job.cancelled': case 'job.failed':
        S.jobs = S.jobs.filter(function (j) { return j.id !== p.id; }).concat([p]);
        if (e.type === 'job.failed') { addFeed('error', p.title + ': ' + p.error, e.ts); if (p.source !== 'autopilot') toast(p.error, 'error'); }
        later('pills', renderPills, 80); if (S.view === 'studio') later('feed', renderFeed, 80);
        if (e.type !== 'job.progress') later('status', refreshStatus, 300);
        break;
      case 'autopilot.tick': S.feed.unshift({ kind: 'stage', auto: true, text: 'Autopilot: ' + ({ create: 'neue App erschaffen', evolve: 'App weiterentwickeln', test: 'Gesundheitscheck', idle: 'nichts zu tun' }[p.action] || p.action) + (p.why ? ' (' + p.why + ')' : ''), ts: e.ts }); break;
      case 'autopilot.state': S.autopilot = p; renderPills(); if (S.view === 'autopilot') drawAutopilot(); break;
      case 'trends.updated': toast('Trend-Radar aktualisiert', 'success'); if (S.view === 'trends') RENDER.trends(); break;
      case 'lessons.added': addFeed('success', 'Gelernt: ' + (p.lessons || []).join(' · '), e.ts); if (S.view === 'lessons') RENDER.lessons(); break;
      case 'ai.call': later('usage', function () { safe('ai.usage').then(function (u) { S.usage = u; renderPills(); }); }, 500); break;
      case 'plugin.state': S.plugins = S.plugins.map(function (x) { return x.id === p.id ? p : x; }); if (S.view === 'network') later('net', function () { layoutNet(); drawNetSide(); }, 100); break;
      case 'cloud.command': addFeed('stage', 'Fernbefehl ' + p.command + ': ' + p.status, e.ts); break;
      case 'library.synced': if (p.imported || p.updated) addFeed('success', 'Cloud-Apps: ' + p.imported + ' neu, ' + p.updated + ' aktualisiert', e.ts); later('apps', reloadApps); break;
      case 'export.done': addFeed('success', 'Store-Paket exportiert', e.ts); break;
      case 'hub.error': addFeed('error', 'Systemfehler: ' + p.message, e.ts); break;
      default: break;
    }
  });
  function reloadApps() { loadApps().then(function () { if (S.view === 'studio') drawStudio(); }); }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if ($('#sheet').classList.contains('on')) closeSheet(); else if (S.detail) closeDetail(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); createApps(); }
  });
  $('#sheet-bg').addEventListener('click', closeSheet);
  setInterval(function () { if (S.view === 'studio') renderFeed(); if (S.view === 'autopilot' && S.autopilot && S.autopilot.enabled) { var p = $('#view-autopilot .hero-copy .small'); if (p) later('aptxt', drawAutopilot, 10); } }, 30000);

  // ------------------------------------------------------------------ Start
  safe('events.recent', { n: 60 }).then(function (evs) {
    (evs || []).forEach(function (e) { if (e.type === 'pipeline.stage' || e.type === 'log') S.feed.unshift({ kind: e.type === 'pipeline.stage' ? 'stage' : '', text: e.payload.message, ts: e.ts }); });
  });
  refreshStatus().then(function () { go('studio'); });
})();
