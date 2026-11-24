/* Velo-TV Steuerung – läuft auf jedem PC (Zentrale und Bedienplätze) identisch. */
import { art, bildVerkleinern, videoInfo, pdfSeiten, hochladen } from './import.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = window.VeloSchedule;
const velo = window.velo;

let info = null;       // Verbindung (base, key, mode …)
let state = null;      // Programm von der Zentrale
let presence = { pcs: [], tv: null };
let es = null;
let editId = null;
let suchListe = [];

const ICON = {
  grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-8h6l2 8M10 8L8 5H6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  tv: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="3"/><path d="M8 20h8"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const media = (f) => info.base + '/media/' + encodeURIComponent(f);

function toast(text, fehler) {
  const t = document.createElement('div');
  t.className = 'toast' + (fehler ? ' err' : '');
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), fehler ? 7000 : 3500);
}

// ---------- API ----------
function kopf() { return { 'X-Key': info.key || '', 'X-PC': encodeURIComponent(info.pcName || 'PC') }; }
async function api(methode, pfad, body) {
  const r = await fetch(info.base + pfad, {
    method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, kopf()),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Fehler ' + r.status);
  return d;
}

// ---------- Start ----------
async function start() {
  info = await velo.info();
  velo.on('update-bereit', () => { $('#updateBar').hidden = false; });
  velo.on('zentrale-umgezogen', (neu) => { Object.assign(info, neu); verbinden(); toast('Zentrale hat eine neue Adresse – automatisch übernommen'); });
  if (!info.mode) return zeigeSetup();
  zeigeApp();
}

function zeigeApp() {
  $('#setup').hidden = true;
  $('#app').hidden = false;
  verbinden();
  einstellungenFuellen();
  vorschauLaden();
}

// ---------- Ersteinrichtung ----------
function zeigeSetup() {
  $('#app').hidden = true;
  $('#setup').hidden = false;
  $('#setupName').value = info.pcName || '';
  let gewaehlt = null;
  suchListe = info.gefunden || [];
  const fundRendern = () => {
    $('#pairSearch').textContent = suchListe.length ? suchListe.length + ' gefunden' : 'wird gesucht …';
    $('#foundList').innerHTML = suchListe.map((z, i) => `<button data-i="${i}" class="${gewaehlt === i ? 'on' : ''}"><i></i>${esc(z.name)} <span class="mut">· ${esc(z.host)}</span></button>`).join('');
    $$('#foundList button').forEach((b) => b.onclick = () => { gewaehlt = +b.dataset.i; $('#pairHost').value = suchListe[gewaehlt].host; fundRendern(); $('#pairPin').focus(); });
  };
  velo.on('discovery', (l) => { suchListe = l; if (suchListe.length === 1 && gewaehlt === null && !$('#pairHost').value) { gewaehlt = 0; $('#pairHost').value = suchListe[0].host; } fundRendern(); });
  fundRendern();

  $$('.role').forEach((b) => b.onclick = async () => {
    $$('.role').forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.role === 'zentrale') {
      $('#pairBox').hidden = true;
      try {
        await velo.setup({ mode: 'zentrale', pcName: $('#setupName').value });
        info = await velo.info();
        toast('Dieser PC ist jetzt die Zentrale');
        zeigeApp();
        zeigeView('fernseher');
      } catch (e) { toast(e.message, true); }
    } else {
      $('#pairBox').hidden = false;
      $('#pairHost').focus();
    }
  });
  $('#pairGo').onclick = async () => {
    const host = $('#pairHost').value.trim().replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    const pin = $('#pairPin').value.trim();
    if (!host) return toast('Bitte die Zentrale auswählen oder die Adresse eintippen', true);
    if (!/^\d{4}$/.test(pin)) return toast('Die PIN hat 4 Ziffern', true);
    const z = suchListe.find((x) => x.host === host);
    $('#pairGo').disabled = true;
    try {
      await velo.setup({ mode: 'bedienplatz', pcName: $('#setupName').value, host, port: z ? z.port : 8833, name: z ? z.name : host, pin });
      info = await velo.info();
      toast('Gekoppelt – alles ist jetzt synchron');
      zeigeApp();
    } catch (e) { toast(e.message, true); }
    $('#pairGo').disabled = false;
  };
}

// ---------- Live-Verbindung ----------
let verbindenTimer = null;
function verbinden() {
  if (es) es.close();
  clearTimeout(verbindenTimer);
  const url = info.base + '/api/events?kind=pc&pc=' + encodeURIComponent(info.pcName || 'PC') + '&key=' + encodeURIComponent(info.key || '');
  es = new EventSource(url);
  es.addEventListener('state', (e) => { $('#offline').hidden = true; state = JSON.parse(e.data); renderAlles(); });
  es.addEventListener('presence', (e) => { presence = JSON.parse(e.data); renderPresence(); });
  es.addEventListener('showroom', () => showroomLaden());
  es.addEventListener('tvsteuerung', (e) => tvstZeigen(JSON.parse(e.data)));
  api('GET', '/api/tvsteuerung').then(tvstZeigen).catch(() => { $('#tvstCard').hidden = true; });
  showroomLaden();
  es.onerror = () => {
    $('#offline').hidden = false;
    // 401 (Kopplung ungültig) erkennt EventSource nicht – einmal nachfragen
    fetch(info.base + '/api/pcs', { headers: kopf() }).then((r) => {
      if (r.status === 401) { es.close(); toast('Dieser PC ist nicht mehr gekoppelt – bitte unter Einstellungen neu einrichten', true); }
    }).catch(() => {});
  };
  es.onopen = () => { $('#offline').hidden = true; };
}

// ---------- Rendern ----------
function renderAlles() {
  if (!state) return;
  renderListe();
  renderTrash();
  renderLog();
  renderPresence();
  tvEinstellungenFuellen();
  if (editId) {
    const it = state.items.find((i) => i.id === editId);
    if (!it) schliesseSheet();
  }
}

function thumbHtml(it) {
  if (it.kind === 'showroom') {
    return `<div class="tthumb th-showroom"><small>Live · Angebote</small>Showroom</div><span class="kind">${ICON.shop}Live</span>`;
  }
  if (it.kind === 'text') {
    const t = it.text || {};
    return `<div class="tthumb th-${esc(t.theme)}">${t.badge ? `<small>${esc(t.badge)}</small>` : ''}${esc((t.title || '').replace(/\*/g, ''))}</div><span class="kind">${ICON.text}Text</span>`;
  }
  const src = it.kind === 'video' ? (it.thumb ? media(it.thumb) : '') : media(it.file);
  return `${src ? `<img src="${src}" alt="" loading="lazy">` : ''}<span class="kind">${it.kind === 'video' ? ICON.video + 'Video' : ICON.image + 'Bild'}</span>`;
}

function dauerText(it) {
  if (it.kind === 'showroom') return (it.duration >= 60 ? Math.floor(it.duration / 60) + ':' + String(it.duration % 60).padStart(2, '0') + ' Min.' : it.duration + ' s') + ' · Räder wechseln alle 8 s';
  if (it.kind === 'video') {
    if (!it.duration) return it.mediaLength ? 'Ganzes Video · ' + Math.round(it.mediaLength) + ' s' : 'Ganzes Video';
    return it.duration + ' s';
  }
  return it.duration + ' s';
}

function renderListe() {
  const now = new Date();
  const liste = $('#list');
  const showing = presence.tv && presence.tv.online ? presence.tv.showing : null;
  const aktiv = state.items.filter((i) => S.isActive(i, now)).length;
  $('#activeCount').textContent = aktiv + ' von ' + state.items.length + ' aktiv';
  $('#empty').hidden = state.items.length > 0;
  liste.innerHTML = state.items.map((it) => {
    const an = S.isActive(it, now);
    const abgelaufen = S.abgelaufen(it, now);
    const plan = S.beschreibe(it);
    const istLive = showing === it.id;
    return `<article class="item${it.enabled === false ? ' off' : ''}${istLive ? ' live' : ''}" data-id="${it.id}">
      <button class="grip" title="Ziehen zum Sortieren" aria-label="Verschieben">${ICON.grip}</button>
      <div class="thumb">${thumbHtml(it)}</div>
      <div class="meta">
        <h3>${esc(it.name)}</h3>
        <div class="pills">
          ${istLive ? '<span class="pill liveP"><i></i>Läuft gerade</span>' : ''}
          <span class="pill">${ICON.clock}${esc(dauerText(it))}</span>
          <span class="pill${plan !== 'Immer' ? ' plan' : ''}">${ICON.cal}${esc(plan)}</span>
          ${abgelaufen ? '<span class="pill warn">Zeitraum abgelaufen</span>' : (it.enabled !== false && !an ? '<span class="pill warn">gerade nicht im Zeitplan</span>' : '')}
          ${it.kind === 'video' && /\.(mov|mkv)$/i.test(it.file || '') ? '<span class="pill warn">Format prüfen (MP4 ist sicherer)</span>' : ''}
        </div>
        <div class="by">${esc(it.addedBy || '')}${it.group ? ' · aus ' + esc(it.group) : ''}</div>
      </div>
      <div class="acts">
        <button class="round" data-act="show" title="Jetzt auf dem Fernseher zeigen">${ICON.tv}</button>
        <input type="checkbox" class="sw" data-act="toggle" ${it.enabled !== false ? 'checked' : ''} title="Ein/Aus" aria-label="Ein oder aus">
      </div>
    </article>`;
  }).join('');
  $$('.item', liste).forEach((el) => {
    const id = el.dataset.id;
    el.onclick = (e) => { if (e.target.closest('.acts,.grip')) return; oeffneSheet(id); };
    $('[data-act=show]', el).onclick = () => api('POST', '/api/tv/show', { id }).then(() => toast('Wird jetzt auf dem Fernseher gezeigt')).catch((e) => toast(e.message, true));
    $('[data-act=toggle]', el).onchange = (e) => api('PATCH', '/api/items/' + id, { enabled: e.target.checked }).catch((er) => toast(er.message, true));
    $('.grip', el).onpointerdown = (e) => ziehen(e, el);
  });
}

// ---------- Sortieren per Ziehen ----------
function ziehen(e, el) {
  e.preventDefault();
  const liste = $('#list');
  const start = el.getBoundingClientRect();
  const versatz = e.clientY - start.top;
  const ph = document.createElement('div');
  ph.className = 'placeholder';
  ph.style.height = start.height + 'px';
  el.after(ph);
  el.classList.add('dragging');
  Object.assign(el.style, { position: 'fixed', left: start.left + 'px', top: start.top + 'px', width: start.width + 'px' });
  const bewege = (ev) => {
    el.style.top = (ev.clientY - versatz) + 'px';
    const andere = $$('.item:not(.dragging)', liste);
    let vor = null;
    for (const a of andere) { const r = a.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { vor = a; break; } }
    if (vor) liste.insertBefore(ph, vor); else liste.appendChild(ph);
    if (ev.clientY < 90) scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) scrollBy(0, 12);
  };
  const los = () => {
    removeEventListener('pointermove', bewege);
    removeEventListener('pointerup', los);
    ph.replaceWith(el);
    el.classList.remove('dragging');
    el.removeAttribute('style');
    const ids = $$('.item', liste).map((x) => x.dataset.id);
    if (ids.join() !== state.items.map((i) => i.id).join()) {
      state.items = ids.map((id) => state.items.find((i) => i.id === id));
      api('POST', '/api/order', { ids }).catch((er) => toast(er.message, true));
    }
  };
  addEventListener('pointermove', bewege);
  addEventListener('pointerup', los);
}

function renderTrash() {
  const n = state.trash.length;
  $('#trashCount').hidden = !n;
  $('#trashCount').textContent = n;
  $('#trashEmpty').hidden = !n;
  $('#trash').innerHTML = n ? state.trash.map((it) => `<article class="item" data-id="${it.id}">
      <span></span><div class="thumb">${thumbHtml(it)}</div>
      <div class="meta"><h3>${esc(it.name)}</h3><div class="by">Gelöscht von ${esc(it.deletedBy || '?')} · ${new Date(it.deletedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div></div>
      <div class="acts"><button class="ghost" data-act="restore">${ICON.undo} Zurückholen</button><button class="round" data-act="purge" title="Endgültig löschen">${ICON.trash}</button></div>
    </article>`).join('') : '<div class="empty glass"><b>Papierkorb ist leer.</b></div>';
  $$('#trash .item').forEach((el) => {
    el.style.cursor = 'default';
    $('[data-act=restore]', el).onclick = () => api('POST', '/api/trash/' + el.dataset.id + '/restore').then(() => toast('Wiederhergestellt')).catch((e) => toast(e.message, true));
    $('[data-act=purge]', el).onclick = () => { if (confirm('Endgültig löschen? Das lässt sich nicht rückgängig machen.')) api('DELETE', '/api/trash/' + el.dataset.id).catch((e) => toast(e.message, true)); };
  });
}

function renderLog() {
  $('#log').innerHTML = state.log.length ? state.log.slice(0, 150).map((l) => {
    const d = new Date(l.at);
    return `<div class="log"><time>${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time><div><b>${esc(l.pc)}</b> ${esc(l.text)}</div></div>`;
  }).join('') : '<div class="log"><span></span><div class="mut">Noch keine Änderungen.</div></div>';
}

function renderPresence() {
  const tv = presence.tv;
  const st = $('#tvStatus');
  const online = !!(tv && tv.online);
  st.classList.toggle('on', online);
  const name = online && tv.showingName ? tv.showingName : '';
  $('.status-tx', st).innerHTML = online ? `<b>TV live</b> · ${esc(name || 'Startbild')}` : (tv ? '<b>TV offline</b> · zuletzt ' + new Date(tv.lastSeen).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '<b>TV</b> · noch nicht verbunden');
  $('#nowShowing').textContent = online ? 'Fernseher zeigt: ' + (name || 'Startbild') : 'Fernseher nicht verbunden';
  $('#tvDot').classList.toggle('on', online);
  $('#tvNowTitle').textContent = online ? 'Fernseher verbunden' : (tv ? 'Fernseher getrennt' : 'Noch keine Verbindung');
  const dg = online && tv.diag;
  $('#tvDiag').hidden = !dg;
  if (dg) $('#tvDiag').innerHTML = `<b>${dg.fps || '–'}</b> Bilder/s · ${dg.vw}×${dg.vh} @${dg.dpr} · Laub-Wechsel ${dg.morph ? 'an' : 'aus'}${dg.hg ? ' · Hintergrund ' + esc(dg.hg) : ''}<br><small>${esc(dg.gpu)}</small>`;
  $('#tvNowSub').textContent = online ? 'Zeigt gerade: ' + (name || 'Startbild') + (tv.screen ? ' · ' + tv.screen : '') : (tv ? 'Zuletzt gesehen ' + new Date(tv.lastSeen).toLocaleString('de-DE') : 'Sobald der Fernseher die Adresse öffnet, erscheint er hier.');
  const ich = info.pcName;
  const pcs = [...new Map(presence.pcs.map((p) => [p.pc, p])).values()];
  $('#pcs').innerHTML = pcs.map((p) => `<span class="chip${p.pc === ich ? ' me' : ''}"><i>${esc(p.pc.slice(0, 1).toUpperCase())}</i>${esc(p.pc)}${p.pc === ich ? ' (dieser)' : ''}</span>`).join('') +
    (online ? `<span class="chip tv"><i>${ICON.tv.replace('<svg', '<svg style="width:11px;height:11px"')}</i>Fernseher</span>` : '');
  if (state && $$('#list .item').some((el) => (online && tv.showing === el.dataset.id) !== el.classList.contains('live'))) renderListe();
}

// ---------- Vorschau ----------
function skaliereFrames() {
  $$('.screen iframe, .sheet-prev iframe').forEach((f) => { const w = f.parentElement.clientWidth; f.style.transform = `scale(${w / 1920})`; });
}
addEventListener('resize', skaliereFrames);
function vorschauLaden() {
  $('#previewFrame').src = info.base + '/?vorschau=1';
  setTimeout(skaliereFrames, 50);
}

// ---------- Bearbeiten ----------
let entwurf = null;
function oeffneSheet(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  editId = id;
  entwurf = JSON.parse(JSON.stringify(it));
  entwurf.plan = Object.assign({ days: [], from: '', to: '', startDate: '', endDate: '' }, entwurf.plan);
  sheetFuellen(false);
}

function neueTextFolie() {
  editId = null;
  entwurf = { kind: 'text', name: 'Neue Text-Folie', duration: state ? state.settings.defaultDuration : 10, enabled: true, fit: 'contain',
    plan: { days: [], from: '', to: '', startDate: '', endDate: '' },
    text: { badge: 'Velocenter Hessert', title: 'Winter-Check *jetzt buchen.*', sub: 'Termin direkt hier an der Kasse.', theme: 'herbst' } };
  sheetFuellen(true);
}

function sheetFuellen(neu) {
  const it = entwurf;
  $('#sheetBg').hidden = false; $('#sheet').hidden = false;
  $('#sheetKind').textContent = neu ? 'Neue Text-Folie' : ({ image: 'Bild', video: 'Video', text: 'Text-Folie', showroom: 'Live-Showroom' }[it.kind]);
  $('#edName').value = it.name;
  $('#edName').hidden = it.kind === 'text' || it.kind === 'showroom';
  $('#edTextBlock').hidden = it.kind !== 'text';
  $('#edFitRow').hidden = it.kind === 'text' || it.kind === 'showroom';
  $('#edFullRow').hidden = it.kind !== 'video';
  $('#edSoundRow').hidden = it.kind !== 'video';
  $('#edShow').hidden = neu;
  $('#edDelete').hidden = neu;
  $('#edSave').firstChild.textContent = neu ? 'Hinzufügen ' : 'Speichern ';
  if (it.kind === 'text') {
    $('#edBadge').value = it.text.badge || '';
    $('#edTitle').value = it.text.title || '';
    $('#edSub').value = it.text.sub || '';
    $('#edTheme').innerHTML = ['herbst', 'rot', 'dunkel', 'hell', 'verlauf'].map((t) => `<button type="button" class="th-${t}${it.text.theme === t ? ' on' : ''}" data-t="${t}" title="${t}"></button>`).join('');
    $$('#edTheme button').forEach((b) => b.onclick = () => { it.text.theme = b.dataset.t; $$('#edTheme button').forEach((x) => x.classList.toggle('on', x === b)); textVorschau(); });
  }
  $('#edFull').checked = it.kind === 'video' && !it.duration;
  $('#edSound').checked = !!it.sound;
  const sr = it.kind === 'showroom';
  Object.assign($('#edDur'), sr ? { min: 20, max: 600, step: 10 } : { min: 3, max: 60, step: 1 });
  const d = it.duration || Math.min(60, Math.round(it.mediaLength || 10)) || 10;
  $('#edDur').value = sr ? Math.min(600, Math.max(20, d)) : Math.min(60, Math.max(3, d));
  durAnzeigen();
  $$('#edFitRow .seg button').forEach((b) => b.classList.toggle('on', b.dataset.fit === (it.fit || 'contain')));
  $('#edDays').innerHTML = S.TAGE.map((t, i) => `<button type="button" data-d="${i + 1}" class="${!it.plan.days.length || it.plan.days.includes(i + 1) ? 'on' : ''}">${t}</button>`).join('');
  $$('#edDays button').forEach((b) => b.onclick = () => { b.classList.toggle('on'); planAnzeigen(); });
  $('#edFrom').value = it.plan.from || ''; $('#edTo').value = it.plan.to || '';
  $('#edStart').value = it.plan.startDate || ''; $('#edEnd').value = it.plan.endDate || '';
  planAnzeigen();
  // Vorschau
  const p = $('#edPrev');
  if (it.kind === 'image') p.innerHTML = `<img src="${media(it.file)}" alt="" style="object-fit:${it.fit === 'cover' ? 'cover' : 'contain'}">`;
  else if (it.kind === 'video') p.innerHTML = `<video src="${media(it.file)}" muted autoplay loop playsinline style="object-fit:${it.fit === 'cover' ? 'cover' : 'contain'}"></video>`;
  else if (it.kind === 'showroom') { p.innerHTML = '<iframe tabindex="-1" title="Vorschau"></iframe>'; $('#edPrev iframe').src = info.base + '/?vorschau=1&probe=' + encodeURIComponent(JSON.stringify({ id: 'probe', kind: 'showroom' })); }
  else { p.innerHTML = '<iframe tabindex="-1" title="Vorschau"></iframe>'; textVorschau(); }
  setTimeout(skaliereFrames, 30);
}

let tvTimer = null;
function textVorschau() {
  clearTimeout(tvTimer);
  tvTimer = setTimeout(() => {
    const f = $('#edPrev iframe');
    if (!f) return;
    const probe = { id: 'probe', kind: 'text', text: { badge: $('#edBadge').value, title: $('#edTitle').value || 'Überschrift', sub: $('#edSub').value, theme: entwurf.text.theme } };
    f.src = info.base + '/?vorschau=1&probe=' + encodeURIComponent(JSON.stringify(probe));
    skaliereFrames();
  }, 250);
}
['#edBadge', '#edTitle', '#edSub'].forEach((s) => $(s).addEventListener('input', textVorschau));

function durAnzeigen() {
  const voll = !$('#edFullRow').hidden && $('#edFull').checked;
  $('#edDur').disabled = voll;
  const sek = +$('#edDur').value;
  $('#edDurShow').textContent = voll ? 'Ganzes Video' : sek >= 60 ? Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0') + ' Min.' : sek + ' Sekunden';
}
$('#edDur').oninput = durAnzeigen;
$('#edFull').onchange = durAnzeigen;
$$('#edFitRow .seg button').forEach((b) => b.onclick = () => {
  $$('#edFitRow .seg button').forEach((x) => x.classList.toggle('on', x === b));
  const m = $('#edPrev img, #edPrev video'); if (m) m.style.objectFit = b.dataset.fit;
});

function planLesen() {
  const tage = $$('#edDays button.on').map((b) => +b.dataset.d);
  return { days: tage.length === 7 ? [] : tage, from: $('#edFrom').value, to: $('#edTo').value, startDate: $('#edStart').value, endDate: $('#edEnd').value };
}
function planAnzeigen() { $('#edPlanShow').textContent = '· ' + S.beschreibe({ plan: planLesen() }); }
['#edFrom', '#edTo', '#edStart', '#edEnd'].forEach((s) => $(s).addEventListener('input', planAnzeigen));

function schliesseSheet() { editId = null; entwurf = null; $('#sheet').hidden = true; $('#sheetBg').hidden = true; $('#edPrev').innerHTML = ''; }
$('#sheetClose').onclick = schliesseSheet;
$('#sheetBg').onclick = schliesseSheet;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) schliesseSheet(); });

$('#edSave').onclick = async () => {
  const plan = planLesen();
  if ($$('#edDays button.on').length === 0) return toast('Mindestens einen Wochentag wählen', true);
  if (plan.startDate && plan.endDate && plan.startDate > plan.endDate) return toast('Das Enddatum liegt vor dem Startdatum', true);
  const voll = entwurf.kind === 'video' && $('#edFull').checked;
  const body = { plan, duration: voll ? 0 : +$('#edDur').value };
  if (entwurf.kind !== 'text') { body.name = $('#edName').value.trim() || entwurf.name; body.fit = $('.seg button.on', $('#edFitRow')).dataset.fit; }
  if (entwurf.kind === 'video') body.sound = $('#edSound').checked;
  if (entwurf.kind === 'text') {
    body.text = { badge: $('#edBadge').value.trim(), title: $('#edTitle').value.trim(), sub: $('#edSub').value.trim(), theme: entwurf.text.theme };
    if (!body.text.title) return toast('Bitte eine Überschrift eingeben', true);
  }
  try {
    if (editId) { await api('PATCH', '/api/items/' + editId, body); toast('Gespeichert – der Fernseher übernimmt es sofort'); }
    else { await api('POST', '/api/items', Object.assign({ kind: 'text' }, body)); toast('Text-Folie hinzugefügt'); }
    schliesseSheet();
  } catch (e) { toast(e.message, true); }
};
$('#edShow').onclick = () => editId && api('POST', '/api/tv/show', { id: editId }).then(() => toast('Wird jetzt auf dem Fernseher gezeigt')).catch((e) => toast(e.message, true));
$('#edDelete').onclick = async () => {
  if (!editId) return;
  try { await api('DELETE', '/api/items/' + editId); toast('In den Papierkorb gelegt'); schliesseSheet(); } catch (e) { toast(e.message, true); }
};
$('#textBtn').onclick = (e) => { e.stopPropagation(); if (state) neueTextFolie(); };
// Ein Klick: Showroom sofort auf dem Fernseher (legt ihn bei Bedarf an und schaltet ihn ein)
async function showroomJetzt(knopf) {
  if (!state) return toast('Noch keine Verbindung zur Zentrale', true);
  if (knopf) knopf.disabled = true;
  try {
    let it = state.items.find((i) => i.kind === 'showroom');
    if (!it) it = await api('POST', '/api/items', { kind: 'showroom', duration: 120 });
    else if (it.enabled === false) await api('PATCH', '/api/items/' + it.id, { enabled: true });
    await api('POST', '/api/tv/show', { id: it.id });
    const tvOn = presence.tv && presence.tv.online;
    toast(tvOn ? 'Showroom läuft jetzt auf dem Fernseher' : 'Showroom ist dran – der Fernseher ist gerade aber nicht verbunden', !tvOn);
  } catch (e) { toast(e.message, true); }
  if (knopf) knopf.disabled = false;
}
$('#srNow').onclick = (e) => showroomJetzt(e.currentTarget);
$('#srNow2').onclick = (e) => showroomJetzt(e.currentTarget);

$('#showroomBtn').onclick = async (e) => {
  e.stopPropagation();
  if (!state) return;
  if (state.items.some((i) => i.kind === 'showroom') && !confirm('Der Live-Showroom ist schon im Programm. Trotzdem ein zweites Mal hinzufügen?')) return;
  try { await api('POST', '/api/items', { kind: 'showroom', duration: 120 }); toast('Live-Showroom hinzugefügt – zeigt die Angebotsräder aus dem Bestand'); } catch (er) { toast(er.message, true); }
};

// ---------- Dateien hinzufügen ----------
function queueZeile(name) {
  const el = document.createElement('div');
  el.className = 'qitem';
  el.innerHTML = `<b>${esc(name)}</b><span class="qs mut">wartet …</span><div class="qbar"><i></i></div>`;
  $('#queue').appendChild(el);
  return {
    text: (t) => { $('.qs', el).textContent = t; },
    prog: (p) => { $('.qbar i', el).style.width = Math.round(p * 100) + '%'; },
    fertig: () => { $('.qs', el).textContent = 'fertig'; $('.qbar i', el).style.width = '100%'; setTimeout(() => el.remove(), 1500); },
    fehler: (t) => { el.classList.add('err'); $('.qs', el).textContent = t; setTimeout(() => el.remove(), 9000); }
  };
}

const uploadUrl = (q) => info.base + '/api/upload?' + new URLSearchParams(q).toString();

async function bildHoch(blob, name, gruppe, zeile, nach) {
  const q = { name, kind: 'image' };
  if (gruppe) q.group = gruppe;
  if (nach) q.after = nach;
  return hochladen(uploadUrl(q), kopf(), blob, zeile.prog);
}

let warteschlange = Promise.resolve();
function dateienHinzufuegen(files) {
  if (!state) return toast('Noch keine Verbindung zur Zentrale', true);
  for (const f of files) {
    const a = art(f);
    const zeile = queueZeile(f.name);
    if (!a) { zeile.fehler('Dateityp wird nicht unterstützt'); continue; }
    warteschlange = warteschlange.then(() => verarbeite(f, a, zeile)).catch(() => {});
  }
}

async function verarbeite(f, a, zeile) {
  try {
    if (a === 'image') {
      zeile.text('wird optimiert …');
      const blob = await bildVerkleinern(f);
      zeile.text('wird hochgeladen …');
      await bildHoch(blob, f.name, null, zeile);
    } else if (a === 'video') {
      zeile.text('wird geprüft …');
      const vi = await videoInfo(f);
      if (!vi.playable) toast(`„${f.name}“: Videoformat konnte hier nicht gelesen werden – der Fernseher spielt es evtl. nicht ab. MP4 (H.264) ist am sichersten.`, true);
      zeile.text('wird hochgeladen …');
      const q = { name: f.name, kind: 'video' };
      if (vi.duration) q.duration = vi.duration;
      const item = await hochladen(uploadUrl(q), kopf(), f, zeile.prog);
      if (vi.thumb) await hochladen(info.base + '/api/items/' + item.id + '/thumb', kopf(), vi.thumb).catch(() => {});
    } else if (a === 'pdf' || a === 'ppt') {
      let daten;
      if (a === 'ppt') {
        zeile.text('PowerPoint wird umgewandelt …');
        const pfad = velo.pfad(f);
        if (!pfad) throw new Error('Datei bitte direkt aus dem Explorer hineinziehen');
        daten = await velo.pptxZuPdf(pfad);
      } else daten = await f.arrayBuffer();
      zeile.text('Seiten werden erstellt …');
      const seiten = await pdfSeiten(daten, (i, n) => { zeile.text(`Seite ${i} von ${n} …`); zeile.prog(i / n / 2); });
      const basis = f.name.replace(/\.[^.]+$/, '');
      let nach = null;
      for (let i = 0; i < seiten.length; i++) {
        zeile.text(`Seite ${i + 1} von ${seiten.length} wird hochgeladen …`);
        const it = await bildHoch(seiten[i], `${basis} – Seite ${i + 1}.jpg`, f.name, { prog: (p) => zeile.prog(0.5 + (i + p) / seiten.length / 2) }, nach);
        nach = it.id;
      }
      toast(`„${f.name}“: ${seiten.length} Folien hinzugefügt`);
    }
    zeile.fertig();
  } catch (e) {
    zeile.fehler(e.message || 'Fehler');
    toast(`„${f.name}“: ${e.message}`, true);
  }
}

$('#drop').onclick = (e) => { if (e.target.closest('#textBtn')) return; $('#fileInput').click(); };
$('#drop').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } };
$('#addBtn').onclick = () => { zeigeView('programm'); $('#fileInput').click(); };
$('#fileInput').onchange = (e) => { dateienHinzufuegen([...e.target.files]); e.target.value = ''; };

let dragTiefe = 0;
addEventListener('dragenter', (e) => { if (!e.dataTransfer.types.includes('Files') || $('#app').hidden) return; dragTiefe++; $('#dragcover').hidden = false; });
addEventListener('dragleave', () => { dragTiefe = Math.max(0, dragTiefe - 1); if (!dragTiefe) $('#dragcover').hidden = true; });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault(); dragTiefe = 0; $('#dragcover').hidden = true;
  if ($('#app').hidden) return;
  const files = [...(e.dataTransfer.files || [])];
  if (files.length) { zeigeView('programm'); dateienHinzufuegen(files); }
});

// ---------- Ansichten ----------
function zeigeView(v) {
  $$('.view').forEach((x) => { x.hidden = x.id !== 'view-' + v; });
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'programm') setTimeout(skaliereFrames, 30);
}
$$('#nav button').forEach((b) => b.onclick = () => zeigeView(b.dataset.view));

// ---------- Fernseher & Einstellungen ----------
// ---------- Fernseher ein-/ausschalten ----------
const TAGNAMEN = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
function tvstZeigen(i) {
  if (!i) return;
  $('#tvstCard').hidden = false;
  const st = i.status || {};
  $('#tvstDot').classList.toggle('on', !!st.verbunden);
  $('#tvstTitel').textContent = st.frage ? 'Bitte am Fernseher „Zulassen“ drücken' : !i.host ? 'Fernseher noch nicht gefunden' : !st.gekoppelt ? 'Noch nicht gekoppelt' : st.verbunden ? 'Gekoppelt · Fernseher erreichbar' : 'Gekoppelt · Fernseher aus oder nicht erreichbar';
  $('#tvstSub').textContent = (i.host ? 'Fernseher ' + i.host : 'Erst die Velo-TV-Adresse am Fernseher öffnen') + (st.letzte ? ' · zuletzt: ' + st.letzte : '') + (st.fehler ? ' · ' + st.fehler : '');
  $('#tvstNext').textContent = i.an ? 'Nächste Aktion: ' + i.naechste : 'aus';
  if (document.activeElement !== $('#tvstAn')) $('#tvstAn').checked = !!i.an;
  $('#tvstMittag').checked = !!i.mittagBildschirm;
  $('#tvstKoppeln').textContent = st.gekoppelt ? 'Neu koppeln' : 'Fernseher koppeln';
  if (!$('#tvstZeiten').contains(document.activeElement)) {
    $('#tvstZeiten').innerHTML = [1, 2, 3, 4, 5, 6, 7].map((t) => {
      const z = i.zeiten[t] || [];
      const f = (k, j) => `<input type="time" data-t="${t}" data-k="${k}" data-j="${j}" value="${(z[k] || [])[j] || ''}">`;
      return `<div class="ztag${z.length ? '' : ' zu'}"><b>${TAGNAMEN[t]}</b><span>${f(0, 0)}–${f(0, 1)}</span><span>${f(1, 0)}–${f(1, 1)}</span></div>`;
    }).join('');
    document.querySelectorAll('#tvstZeiten input').forEach((inp) => { inp.onchange = tvstZeitenSpeichern; });
  }
}
function tvstZeitenSpeichern() {
  const z = {};
  for (let t = 1; t <= 7; t++) {
    z[t] = [0, 1].map((k) => [0, 1].map((j) => ($(`#tvstZeiten input[data-t="${t}"][data-k="${k}"][data-j="${j}"]`) || {}).value || '')).filter(([a, b]) => a && b);
  }
  api('PATCH', '/api/tvsteuerung', { zeiten: z }).then((i) => { tvstZeigen(i); toast('Öffnungszeiten gespeichert'); }).catch((e) => toast(e.message, true));
}
$('#tvstAn').onchange = (e) => api('PATCH', '/api/tvsteuerung', { an: e.target.checked }).then((i) => { tvstZeigen(i); toast(e.target.checked ? 'Fernseher schaltet sich jetzt nach den Öffnungszeiten' : 'Automatik aus'); }).catch((er) => toast(er.message, true));
$('#tvstMittag').onchange = (e) => api('PATCH', '/api/tvsteuerung', { mittagBildschirm: e.target.checked }).then(tvstZeigen).catch((er) => toast(er.message, true));
$('#tvstKoppeln').onclick = () => api('POST', '/api/tvsteuerung/koppeln').then((i) => { tvstZeigen(i); toast('Verbinde … bitte am Fernseher mit OK „Zulassen“ drücken'); }).catch((e) => toast(e.message, true));
$('#tvstAus').onclick = (e) => { e.target.disabled = true; api('POST', '/api/tvsteuerung/aus').then((i) => { tvstZeigen(i); toast('Fernseher ausgeschaltet'); }).catch((er) => toast(er.message, true)).finally(() => { e.target.disabled = false; }); };
$('#tvstEin').onclick = (e) => { e.target.disabled = true; toast('Fernseher wird eingeschaltet … das kann bis zu 1 Minute dauern'); api('POST', '/api/tvsteuerung/an').then((i) => { tvstZeigen(i); toast('Fernseher ist an, Velo-TV wird geöffnet'); }).catch((er) => toast(er.message, true)).finally(() => { e.target.disabled = false; }); };

// ---------- Live-Showroom ----------
async function showroomLaden() {
  try {
    const d = await (await fetch(info.base + '/api/showroom', { cache: 'no-store' })).json();
    $('#srCount').textContent = d.ts ? String(d.items.length) : '–';
    const wann = d.ts ? new Date(d.ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'noch nie';
    const v = d.video;
    const vText = v && v.version
      ? `Video: ${v.anzahl} Angebote · ${Math.floor(v.dauer / 60)}:${String(v.dauer % 60).padStart(2, '0')} Min · erstellt ${new Date(v.ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.`
      : 'Noch kein Video – bis es da ist, zeigt der Fernseher den Live-Showroom.';
    $('#srInfo').textContent = (d.fehler ? 'Letzter Abruf fehlgeschlagen: ' + d.fehler + '. ' : '') + vText +
      (v && v.fehler ? ' Video-Abruf: ' + v.fehler + '.' : '') +
      ' Bestand vom ' + (d.stand || '–') + ', geprüft ' + wann + '. Nur Angebotsräder auf Lager mit Foto. Neue Videos kommen automatisch.';
  } catch (e) { /* Zentrale gerade weg */ }
}
$('#srRefresh').onclick = async () => {
  $('#srRefresh').disabled = true;
  try { const d = await api('POST', '/api/showroom/refresh'); toast(d.fehler ? 'Abruf fehlgeschlagen: ' + d.fehler : d.anzahl + ' Angebotsräder geladen', !!d.fehler); showroomLaden(); }
  catch (e) { toast(e.message, true); }
  $('#srRefresh').disabled = false;
};

function tvEinstellungenFuellen() {
  const s = state.settings;
  if (document.activeElement !== $('#setDuration')) $('#setDuration').value = s.defaultDuration;
  $('#setTransition').value = s.transition;
  $('#setClock').checked = !!s.clock;
  $('#setLogo').checked = !!s.showLogo;
}
const setzen = (b) => api('PATCH', '/api/settings', b).then(() => toast('Fernseher übernimmt die Einstellung')).catch((e) => toast(e.message, true));
$('#setTransition').onchange = (e) => setzen({ transition: e.target.value });
$('#setDuration').onchange = (e) => setzen({ defaultDuration: +e.target.value });
$('#setClock').onchange = (e) => setzen({ clock: e.target.checked });
$('#setLogo').onchange = (e) => setzen({ showLogo: e.target.checked });
$('#tvReload').onclick = () => api('POST', '/api/tv/reload').then(() => toast('Fernseher lädt neu')).catch((e) => toast(e.message, true));

function einstellungenFuellen() {
  const z = info.mode === 'zentrale';
  $('#zentraleCard').hidden = !z;
  $('#pinShow').textContent = info.pin || '––––';
  const host = z ? ((info.adressen || [])[0] || {}).address : info.zentrale && info.zentrale.host;
  $('#tvAddr').textContent = host ? host + ':' + info.port : 'Keine Netzwerkverbindung';
  const weitere = z ? (info.adressen || []).slice(1).filter((a) => !a.virtuell).map((a) => a.address) : [];
  $('#tvAddrHint').innerHTML = (weitere.length ? 'Andere Adressen dieses PCs: ' + weitere.map(esc).join(', ') + '. ' : '') +
    'Tipp: Im Router dem Büro-PC (Zentrale) eine <b>feste IP-Adresse</b> geben, damit sich die Adresse nie ändert.';
  $('#pcName').value = info.pcName || '';
  $('#roleShow').textContent = z ? 'Zentrale (beliefert den Fernseher)' : 'Bedienplatz';
  $('#zentraleRow').hidden = z;
  $('#zentraleShow').textContent = info.zentrale ? info.zentrale.name + ' · ' + info.zentrale.host : '–';
  $('#autostartRow').hidden = info.platform !== 'win32';
  $('#autostart').checked = !!info.autostart;
  $('#versionShow').textContent = info.version;
}
$('#pcName').onchange = async (e) => { info.pcName = await velo.setPcName(e.target.value.trim()); toast('Name gespeichert'); verbinden(); };
$('#autostart').onchange = async (e) => { info.autostart = await velo.setAutostart(e.target.checked); };
$('#pinNew').onclick = async () => { info.pin = await velo.neuePin(); $('#pinShow').textContent = info.pin; toast('Neue PIN – bereits gekoppelte PCs bleiben gekoppelt'); };
$('#firewallBtn').onclick = async () => { const r = await velo.firewall(); toast(r.ok ? 'Firewall freigegeben' : r.error, !r.ok); };
$('#resetRole').onclick = async () => {
  if (!confirm('Diesen PC neu einrichten? ' + (info.mode === 'zentrale' ? 'Der Fernseher bekommt dann keine Inhalte mehr von diesem PC. Die Inhalte bleiben gespeichert.' : ''))) return;
  if (es) es.close();
  await velo.setup({ mode: null });
  info = await velo.info();
  zeigeSetup();
};
$('#trashEmpty').onclick = () => { if (confirm('Papierkorb endgültig leeren?')) api('DELETE', '/api/trash').catch((e) => toast(e.message, true)); };
$('#updateGo').onclick = () => velo.updateInstallieren();

// Zeitplan-Anzeige jede Minute aktualisieren (z. B. „gerade nicht im Zeitplan“)
setInterval(() => { if (state && $('#sheet').hidden) renderListe(); }, 60000);

start().catch((e) => toast(e.message, true));
