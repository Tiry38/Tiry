// Mehrspieler-Lobby: Verbinden/Hosten, öffentliche Räume, Schnellsuche, Plätze (Mensch/Bot/geschlossen),
// Host-Einstellungen (Modus, Teams, Wellen, Bots, Ausgleich), Volk/Held/Bereit, Chat, Einladungscode.
import { FACTIONS, FACTION_IDS } from '../sim/data.js';
import { HEROES, HERO_IDS } from '../sim/heroes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIFF = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer', extreme: 'Extrem' };
const PICK = { ap: 'AP · Alle wählen', ar: 'AR · Alle zufällig', pr: 'PR · Zufall + Neu würfeln', hp: 'HP · Hybrid', mirror: 'Gespiegelte Auswahl' };
const GAMEMODE = { normal: 'Normal', fast: 'Schnell (20 Wellen + Endwellen)', long: 'Lang (+2 Heilungen)', hard: 'Hart (+25 % Wellen)' };

export class Lobby {
  /** root: Container-Element; settings: Settings; audio; onStart(mp, startMsg) */
  constructor(root, { settings, audio, onStart }) {
    this.root = root; this.settings = settings; this.audio = audio; this.onStart = onStart;
    this.mp = null; this.state = null; this.rooms = []; this.chat = [];
    this.render();
  }

  // ---------- Verbindung ----------
  connect() {
    if (this.mp && this.mp.ws.readyState <= 1) return this.mp;
    const url = this.settings.get('serverUrl') || 'ws://localhost:7710';
    let ws;
    try { ws = new WebSocket(url); } catch { this.status('Ungültige Server-Adresse'); return null; }
    const mp = { ws, handlers: [], myId: null, token: null };
    ws.onopen = () => { this.send({ t: 'hello', name: this.settings.get('playerName') || 'Tiry' }); this.status('Verbunden'); this.send({ t: 'list' }); };
    ws.onerror = () => this.status('Server nicht erreichbar – läuft er? (Spiel hosten oder SERVER-EINRICHTEN.md)');
    ws.onclose = () => { if (this.mp === mp && !this.inGame) this.status('Verbindung getrennt'); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'welcome') { mp.myId = m.id; mp.token = m.token; }
      else if (m.t === 'lobby') { this.state = m; this.render(); }
      else if (m.t === 'rooms') { this.rooms = m.rooms; this.render(); }
      else if (m.t === 'error') this.status(m.reason, true);
      else if (m.t === 'chat') { this.chat.push(m); this.chat = this.chat.slice(-40); this.renderChat(); }
      else if (m.t === 'start') {
        this.inGame = true;
        try { localStorage.setItem('aetherfront.rejoin', JSON.stringify({ url: this.settings.get('serverUrl'), room: this.state?.room, token: m.token })); } catch { /* egal */ }
        this.onStart(mp, m);
      }
      for (const h of mp.handlers) h(m);
    };
    this.mp = mp;
    return mp;
  }
  send(obj) {
    const mp = this.mp || this.connect();
    if (!mp) return;
    if (mp.ws.readyState === 1) mp.ws.send(JSON.stringify(obj));
    else mp.ws.addEventListener('open', () => mp.ws.send(JSON.stringify(obj)), { once: true });
  }
  status(text, bad = false) { const el = this.root.querySelector('#lb-status'); if (el) { el.textContent = text; el.classList.toggle('bad', bad); } }
  get isHost() { return this.state && this.mp && this.state.host === this.mp.myId; }
  get me() { return this.state && this.mp ? this.state.players.find((p) => p.id === this.mp.myId) : null; }

  async host() {
    this.audio?.ui('confirm');
    if (window.aetherfront && window.aetherfront.hostServer) {
      const r = await window.aetherfront.hostServer(7710);
      if (r && r.ok) {
        this.settings.set('serverUrl', 'ws://localhost:7710');
        this.hostInfo = r;
        this.status(`Server läuft auf deinem PC (Port ${r.port}).`);
      } else { this.status(r?.error || 'Server konnte nicht gestartet werden', true); return; }
    } else {
      this.status('Im Browser kann kein Server gestartet werden – bitte `npm run server` ausführen oder die Windows-Version nutzen.', true);
    }
    this.mp = null;
    this.send({ t: 'create', mode: this.settings.get('teamSize') || 2, public: false, name: `${this.settings.get('playerName') || 'Tiry'}s Spiel` });
    this.render();
  }

  rejoinLast() {
    try {
      const r = JSON.parse(localStorage.getItem('aetherfront.rejoin') || 'null');
      if (!r) return this.status('Kein laufendes Spiel gespeichert', true);
      this.settings.set('serverUrl', r.url); this.mp = null;
      this.send({ t: 'rejoin', room: r.room, token: r.token });
    } catch { this.status('Wiederverbinden fehlgeschlagen', true); }
  }

  // ---------- Darstellung ----------
  render() {
    const S = this.settings;
    const st = this.state;
    const ipInfo = this.hostInfo ? `<div class="lb-ips">Freunde verbinden sich mit: ${this.hostInfo.addresses.map((a) => `<code>ws://${esc(a)}:${this.hostInfo.port}</code>`).join(' · ')}</div>` : '';
    this.root.innerHTML = `
      <header class="panel-head"><div class="ttl"><small>Online</small><h2>Mehrspieler</h2></div><button class="btn ghost back" data-lb="back">Zurück</button></header>
      <div class="lb">
        <div class="lb-col">
          <h3>Verbindung</h3>
          <label class="fg">Dein Name<input class="field" id="lb-name" maxlength="16" value="${esc(S.get('playerName'))}"></label>
          <label class="fg">Server-Adresse<input class="field" id="lb-url" value="${esc(S.get('serverUrl'))}"></label>
          <div class="row"><button class="btn primary" data-lb="host">Spiel hosten</button><button class="btn" data-lb="refresh">Räume suchen</button></div>
          ${ipInfo}
          <div class="row"><input class="field short" id="lb-code" placeholder="CODE" maxlength="5"><button class="btn" data-lb="join">Beitreten</button><button class="btn ghost" data-lb="rejoin">Wiederverbinden</button></div>
          <h3>Schnellsuche</h3>
          <div class="seg">${[1, 2, 3, 4].map((n) => `<button data-lb="quick" data-n="${n}">${n} gegen ${n}</button>`).join('')}</div>
          <h3>Öffentliche Räume</h3>
          <div class="lb-rooms">${this.rooms.length ? this.rooms.map((r) => `<button class="lb-room" data-lb="joinroom" data-code="${r.room}"><b>${esc(r.name)}</b><span>${r.mode} gegen ${r.mode} · ${r.players} Spieler · ${r.free} frei</span></button>`).join('') : '<p class="fine">Keine offenen Räume – erstelle einen oder nutze die Schnellsuche.</p>'}</div>
          <p class="lb-status" id="lb-status">${this.mp ? '' : 'Nicht verbunden.'}</p>
        </div>
        <div class="lb-col wide">${st ? this.roomHtml(st) : '<div class="lb-empty"><h3>Kein Raum</h3><p class="fine">Hoste ein Spiel, tritt mit Code bei oder nutze die Schnellsuche. Leere Plätze können Bots übernehmen.</p></div>'}</div>
      </div>`;
    this.bind();
    this.renderChat();
  }

  roomHtml(st) {
    const host = this.isHost;
    const me = this.me;
    const c = st.config;
    const slotHtml = (team) => {
      const humans = st.players.filter((p) => p.team === team);
      return st.slots[team].slice(0, 4).map((s, i) => {
        const h = humans[i];
        if (i >= st.mode && !h) return '';
        if (h) {
          const hero = HEROES[h.hero];
          return `<div class="lb-slot human${h.id === this.mp?.myId ? ' me' : ''}"><span class="lb-dot ${h.ready ? 'ready' : ''}"></span><b>${st.host === h.id ? '♛ ' : ''}${esc(h.name)}</b><small>${FACTIONS[h.faction] ? FACTIONS[h.faction].name : 'Zufall'} · ${hero ? hero.cls : 'Held: Auto'}${h.connected === false ? ' · getrennt' : ''}</small></div>`;
        }
        const label = s.kind === 'bot' ? `Bot · ${DIFF[s.difficulty]}` : s.kind === 'closed' ? 'Geschlossen' : c.bots ? 'Offen (sonst Bot)' : 'Offen';
        return `<button class="lb-slot ${s.kind}" ${host ? `data-lb="slot" data-team="${team}" data-i="${i}"` : 'disabled'}><b>${label}</b><small>${host ? 'Klicken: Offen → Bot (Stärke) → Geschlossen' : ''}</small></button>`;
      }).join('');
    };
    const sel = (key, opts, cur, dis) => `<select class="field" data-cfg="${key}" ${dis ? 'disabled' : ''}>${Object.entries(opts).map(([v, t]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    return `
      <div class="lb-head"><h3>Raum <span class="code-badge">${st.room}</span></h3><button class="btn ghost" data-lb="copy">Einladung kopieren</button></div>
      <div class="lb-teams">
        <div><h4 class="west">Team West</h4>${slotHtml(0)}</div>
        <div><h4 class="east">Team Ost</h4>${slotHtml(1)}</div>
      </div>
      <div class="lb-me">
        <label class="fg">Volk${sel('_faction', { random: 'Zufall (+Gold)', ...Object.fromEntries(FACTION_IDS.map((f) => [f, FACTIONS[f].name])) }, me?.faction || 'random')}</label>
        <label class="fg">Held${sel('_hero', Object.fromEntries(HERO_IDS.map((h) => [h, `${HEROES[h].name} · ${HEROES[h].cls}`])), me?.hero || HERO_IDS[0])}</label>
        <div class="row"><button class="btn" data-lb="team">Team wechseln</button><button class="btn ${me?.ready ? 'primary' : ''}" data-lb="ready">${me?.ready ? 'Bereit ✓' : 'Bereit?'}</button></div>
      </div>
      <div class="lb-cfg">
        <label class="fg">Spielmodus${sel('pickMode', PICK, c.pickMode, !host)}</label>
        <label class="fg">Regeln${sel('gameMode', GAMEMODE, c.gameMode, !host)}</label>
        <label class="fg">Teamgröße${sel('mode', { 1: '1 gegen 1', 2: '2 gegen 2', 3: '3 gegen 3', 4: '4 gegen 4' }, st.mode, !host)}</label>
        <label class="fg">Wellen${sel('waves', { 10: '10', 20: '20', 30: '30 (+ Endwellen)' }, c.waves, !host)}</label>
        <label class="fg">Champions (CC)${sel('champions', { false: 'Aus', true: 'An' }, c.champions, !host)}</label>
        <label class="fg">Leere Plätze${sel('bots', { true: 'Bots füllen auf', false: 'bleiben leer' }, c.bots, !host)}</label>
        <label class="fg">Bot-Stärke${sel('botDifficulty', DIFF, c.botDifficulty, !host)}</label>
        <label class="fg">Ungleiche Teams${sel('autobalance', { true: 'automatisch ausgleichen', false: 'kein Ausgleich' }, c.autobalance, !host)}</label>
        <label class="fg">Sichtbarkeit${sel('public', { false: 'Privat (nur mit Code)', true: 'Öffentlich' }, st.public, !host)}</label>
      </div>
      <div class="lb-chat"><div class="lb-log" id="lb-log"></div><input class="field" id="lb-msg" placeholder="Nachricht … (Enter)" maxlength="200"></div>
      <div class="row end">${host ? '<button class="btn primary big" data-lb="start">Spiel starten</button>' : '<span class="fine">Der Host startet das Spiel.</span>'}</div>`;
  }

  renderChat() {
    const log = this.root.querySelector('#lb-log');
    if (!log) return;
    log.innerHTML = this.chat.map((m) => `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  bind() {
    const S = this.settings;
    const q = (sel) => this.root.querySelector(sel);
    q('#lb-name')?.addEventListener('change', (e) => { S.set('playerName', e.target.value.trim() || 'Tiry'); this.send({ t: 'hello', name: S.get('playerName') }); });
    q('#lb-url')?.addEventListener('change', (e) => { S.set('serverUrl', e.target.value.trim()); if (this.mp) { try { this.mp.ws.close(); } catch { /* egal */ } this.mp = null; } });
    q('#lb-msg')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { this.send({ t: 'chat', text: e.target.value }); e.target.value = ''; } });
    this.root.querySelectorAll('[data-cfg]').forEach((el) => el.addEventListener('change', () => {
      const k = el.dataset.cfg; let v = el.value;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^\d+$/.test(v)) v = +v;
      if (k === '_faction') { S.set('faction', v); this.send({ t: 'slot', faction: v }); return; }
      if (k === '_hero') { S.set('hero', v); this.send({ t: 'slot', hero: v }); return; }
      this.send({ t: 'config', config: { [k]: v } });
    }));
    this.root.querySelectorAll('[data-lb]').forEach((el) => el.addEventListener('click', () => {
      this.audio?.ui('click');
      const a = el.dataset.lb;
      if (a === 'back') this.onBack && this.onBack();
      else if (a === 'host') this.host();
      else if (a === 'refresh') { this.connect(); this.send({ t: 'list' }); }
      else if (a === 'join') { const code = q('#lb-code').value.trim(); if (code) this.send({ t: 'join', room: code }); }
      else if (a === 'joinroom') this.send({ t: 'join', room: el.dataset.code });
      else if (a === 'rejoin') this.rejoinLast();
      else if (a === 'quick') this.send({ t: 'quick', mode: +el.dataset.n });
      else if (a === 'team') this.send({ t: 'slot', team: this.me?.team === 0 ? 1 : 0 });
      else if (a === 'ready') this.send({ t: 'slot', ready: !this.me?.ready, faction: S.get('faction'), hero: S.get('hero') });
      else if (a === 'start') this.send({ t: 'start' });
      else if (a === 'copy') {
        const txt = `Aetherfront – komm in mein Spiel! Server: ${S.get('serverUrl')} · Code: ${this.state.room}`;
        try { navigator.clipboard.writeText(txt); this.status('Einladung kopiert'); } catch { this.status(txt); }
      } else if (a === 'slot') {
        const s = this.state.slots[+el.dataset.team][+el.dataset.i];
        const order = [['open', 'normal'], ['bot', 'easy'], ['bot', 'normal'], ['bot', 'hard'], ['bot', 'extreme'], ['closed', 'normal']];
        const idx = order.findIndex(([k, d]) => k === s.kind && (k !== 'bot' || d === s.difficulty));
        const [kind, difficulty] = order[(idx + 1) % order.length];
        this.send({ t: 'slotKind', team: +el.dataset.team, index: +el.dataset.i, kind, difficulty });
      }
    }));
    if (this.state && this.me && (this.me.faction !== S.get('faction') || (S.get('hero') && this.me.hero !== S.get('hero')))) {
      this.send({ t: 'slot', faction: S.get('faction'), hero: S.get('hero') });
    }
  }
}
