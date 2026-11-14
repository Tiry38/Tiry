// Menüs: Bildschirmwechsel, Gefecht einrichten, Einstellungen, Kodex, Mehrspieler-Lobby.
import { FACTIONS, FACTION_IDS, factionUnits, DAMAGE_TABLE, ATTACK_TYPES, ARMOR_TYPES, ECON, KING } from '../sim/data.js';
import { escapeHtml } from './hud.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor({ settings, audio, portraits, onStart, onResume, onSurrender, onRematch, onToMenu, onQuit, onApplyGraphics, onMultiplayerStart }) {
    Object.assign(this, { settings, audio, portraits, onStart, onResume, onSurrender, onRematch, onToMenu, onQuit, onApplyGraphics, onMultiplayerStart });
    this.stack = [];
    this.current = 'splash';
    document.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => { this.audio.ui('click'); this.go(b.dataset.go, true); });
    });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { this.audio.ui('close'); this.back(); }));
    document.querySelectorAll('.pill').forEach((b) => b.addEventListener('mouseenter', () => this.audio.ui('hover')));
    document.querySelectorAll('.menu-nav .pill').forEach((b) => b.addEventListener('mouseenter', () => { $('menu-hint').textContent = b.dataset.hint || ''; }));
    $('btn-quit').addEventListener('click', () => this.onQuit());
    $('btn-start').addEventListener('click', () => { this.audio.ui('confirm'); this.onStart(this.setupConfig()); });
    $('btn-resume').addEventListener('click', () => { this.audio.ui('close'); this.onResume(); });
    $('btn-surrender').addEventListener('click', () => { this.audio.ui('click'); this.onSurrender(); });
    $('btn-rematch').addEventListener('click', () => { this.audio.ui('confirm'); this.onRematch(); });
    $('btn-tomenu').addEventListener('click', () => { this.audio.ui('click'); this.onToMenu(); });
    if (!window.aetherfront) $('btn-quit').style.display = 'none';
    this.buildSetup();
    this.buildSettings();
    this.buildCodex();
    this.buildMulti();
  }

  show(id) {
    document.querySelectorAll('#ui > .screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${id}` || (id === 'hud' && s.id === 'hud')));
    this.current = id;
  }
  /** push=true merkt sich den vorherigen Bildschirm für „Zurück“ */
  go(id, push = false) {
    if (push) this.stack.push(this.current);
    if (id === 'setup') this.refreshSetup();
    if (id === 'menu') this.stack = [];
    // Im Spiel bleibt das HUD sichtbar unter den Overlays
    const inGame = this.inGame;
    document.querySelectorAll('#ui > .screen').forEach((s) => {
      const on = s.id === `screen-${id}` || (!!inGame && s.id === 'hud');
      s.classList.toggle('active', on);
    });
    this.current = id;
  }
  back() { this.go(this.stack.pop() || (this.inGame ? 'pause' : 'menu')); }

  // ---------- Gefecht einrichten ----------
  seg(el, options, key, onChange) {
    el.innerHTML = '';
    for (const [val, label] of options) {
      const b = document.createElement('button');
      b.textContent = label;
      b.classList.toggle('on', this.settings.get(key) === val);
      b.addEventListener('click', () => {
        this.audio.ui('click');
        this.settings.set(key, val);
        el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        onChange && onChange(val);
      });
      el.appendChild(b);
    }
  }
  buildSetup() {
    this.seg($('seg-mode'), [[1, '1 gegen 1'], [2, '2 gegen 2'], [3, '3 gegen 3'], [4, '4 gegen 4']], 'teamSize', () => this.refreshSummary());
    this.seg($('seg-diff'), [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']], 'difficulty', () => this.refreshSummary());
    this.seg($('seg-speed'), [[1, '1×'], [1.5, '1,5×'], [2, '2×']], 'gameSpeed', () => this.refreshSummary());
    const nm = $('inp-name');
    nm.value = this.settings.get('playerName');
    nm.addEventListener('input', () => this.settings.set('playerName', nm.value.trim() || 'Tiry'));
  }
  refreshSetup() {
    const box = $('factions');
    box.innerHTML = '';
    const list = [...FACTION_IDS, 'random'];
    for (const id of list) {
      const f = FACTIONS[id];
      const el = document.createElement('div');
      el.className = 'faction';
      const grad = f ? f.grad : ['#ff8a3a', '#ff4fa3', '#7a5cff'];
      el.style.setProperty('--fgrad', `radial-gradient(circle at 40% 30%, ${grad[0]}, ${grad[1]} 55%, ${grad[2]})`);
      el.style.setProperty('--fglow', `${grad[1]}66`);
      let img = '';
      if (f) { const u = factionUnits(id)[0]; img = this.portraits.get(`f|${u.id}`, u.model, f.palette, 1); }
      el.innerHTML = `<div class="orb">${img ? `<img src="${img}" alt=""/>` : '<span style="font-size:58px">?</span>'}</div>
        <div class="name">${f ? f.name : 'Zufall'}</div><div class="motto">${f ? f.motto : `+${ECON.randomBonusGold} Gold Startbonus`}</div>
        <div class="desc">${f ? f.desc : 'Das Schicksal wählt deine Fraktion – dafür gibt es extra Gold.'}</div>`;
      el.classList.toggle('on', this.settings.get('faction') === id);
      el.addEventListener('click', () => {
        this.audio.ui('confirm');
        this.settings.set('faction', id);
        box.querySelectorAll('.faction').forEach((x) => x.classList.toggle('on', x === el));
        this.refreshSummary();
      });
      el.addEventListener('mouseenter', () => this.audio.ui('hover'));
      box.appendChild(el);
    }
    this.refreshSummary();
  }
  refreshSummary() {
    const n = this.settings.get('teamSize');
    const f = FACTIONS[this.settings.get('faction')];
    $('setup-summary').textContent = `${n} gegen ${n} · ${f ? f.name : 'Zufallsfraktion'} · Bots: ${{ easy: 'Leicht', normal: 'Normal', hard: 'Schwer' }[this.settings.get('difficulty')]} · ${ECON.maxWaves} Wellen`;
  }
  setupConfig() {
    return { teamSize: this.settings.get('teamSize'), faction: this.settings.get('faction'), difficulty: this.settings.get('difficulty'), name: this.settings.get('playerName') || 'Tiry' };
  }

  // ---------- Einstellungen ----------
  buildSettings() {
    const tabs = [['grafik', 'Grafik'], ['audio', 'Audio'], ['steuerung', 'Steuerung'], ['spiel', 'Spiel']];
    const tb = $('settings-tabs');
    tb.className = 'seg';
    tb.innerHTML = '';
    this.settingsTab = 'grafik';
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.textContent = label;
      b.classList.toggle('on', id === this.settingsTab);
      b.addEventListener('click', () => { this.audio.ui('click'); this.settingsTab = id; tb.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); this.renderSettings(); });
      tb.appendChild(b);
    }
    this.renderSettings();
  }
  renderSettings() {
    const body = $('settings-body');
    body.innerHTML = '';
    const S = this.settings;
    const row = (label, sub, ctrl) => {
      const r = document.createElement('div');
      r.className = 'set-row';
      r.innerHTML = `<div class="lbl"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
      r.appendChild(ctrl);
      body.appendChild(r);
    };
    const toggle = (key, after) => {
      const t = document.createElement('div');
      t.className = `toggle${S.get(key) ? ' on' : ''}`;
      t.addEventListener('click', () => { this.audio.ui('click'); S.set(key, !S.get(key)); t.classList.toggle('on', S.get(key)); after && after(); });
      return t;
    };
    const slider = (key, min, max, step, fmt, after) => {
      const w = document.createElement('div');
      w.className = 'row';
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = S.get(key);
      const val = document.createElement('span');
      val.className = 'set-val';
      const upd = () => { inp.style.setProperty('--p', `${((inp.value - min) / (max - min)) * 100}%`); val.textContent = fmt(+inp.value); };
      upd();
      inp.addEventListener('input', () => { S.set(key, +inp.value); upd(); after && after(); });
      inp.addEventListener('change', () => this.audio.ui('click'));
      w.append(inp, val);
      return w;
    };
    const segc = (key, opts, after) => { const d = document.createElement('div'); d.className = 'seg'; this.seg(d, opts, key, after); return d; };
    const pct = (v) => `${Math.round(v * 100)}%`;
    const gfx = () => this.onApplyGraphics();
    if (this.settingsTab === 'grafik') {
      row('Grafikqualität', 'Voreinstellung für Auflösung, Schatten, Umgebungsverdeckung und Effekte', segc('quality', [['low', 'Niedrig'], ['medium', 'Mittel'], ['high', 'Hoch'], ['ultra', 'Ultra']], gfx));
      row('Render-Auflösung', 'Unter 100 % = schneller, über 100 % = schärfer', slider('renderScale', 0.5, 1.5, 0.05, pct, () => { clearTimeout(this.rsT); this.rsT = setTimeout(gfx, 250); }));
      row('Bloom / Leuchten', 'Magisches Glühen von Effekten und Kristallen', toggle('bloom', gfx));
      row('Schatten', 'Weiche Echtzeitschatten', toggle('shadows', gfx));
      row('Umgebungsverdeckung (AO)', 'Nur in „Ultra“: plastische Tiefe in Ecken', toggle('ao', gfx));
      row('Kantenglättung (MSAA)', '', toggle('antialias', gfx));
      row('Partikeldichte', '', slider('particles', 0.2, 1.5, 0.1, pct));
      row('Filmkorn', 'Feines Kino-Rauschen', toggle('filmGrain'));
      row('FPS anzeigen', '', toggle('showFps'));
      if (window.aetherfront) row('Vollbild', '', toggle('fullscreen', () => window.aetherfront.setFullscreen(S.get('fullscreen'))));
    } else if (this.settingsTab === 'audio') {
      const vol = () => this.audio.applySettings && this.audio.applySettings();
      row('Gesamtlautstärke', '', slider('volMaster', 0, 1, 0.01, pct, vol));
      row('Musik', 'Dynamischer Orchester-Soundtrack', slider('volMusic', 0, 1, 0.01, pct, vol));
      row('Effekte', 'Kampf, Zauber, Bauen', slider('volSfx', 0, 1, 0.01, pct, vol));
      row('Oberfläche', 'Klicks und Menütöne', slider('volUi', 0, 1, 0.01, pct, vol));
      row('Stumm', '', toggle('muted', vol));
    } else if (this.settingsTab === 'steuerung') {
      row('Kamera-Tempo', '', slider('camSpeed', 0.4, 2.5, 0.1, (v) => `${v.toFixed(1)}×`));
      row('Randscrollen', 'Kamera bewegt sich, wenn die Maus den Bildschirmrand berührt', toggle('edgeScroll'));
      const keys = document.createElement('div');
      keys.className = 'keys';
      keys.style.padding = '12px 20px';
      keys.innerHTML = KEYS.map(([k, d]) => `<span>${k.split(' ').map((x) => `<span class="key">${x}</span>`).join(' ')}</span><span>${d}</span>`).join('');
      body.appendChild(keys);
    } else {
      row('Schadenszahlen', 'Zeigt jeden Treffer als Zahl (kritische Treffer immer)', toggle('damageNumbers'));
      row('Spieltempo (Einzelspieler)', '', segc('gameSpeed', [[1, '1×'], [1.5, '1,5×'], [2, '2×']]));
      const r = document.createElement('button');
      r.className = 'pill ghost';
      r.textContent = 'Alles zurücksetzen';
      r.addEventListener('click', () => { S.reset(); this.renderSettings(); gfx(); this.audio.applySettings && this.audio.applySettings(); });
      row('Standardwerte', '', r);
    }
  }

  // ---------- Kodex ----------
  buildCodex() {
    const atk = Object.keys(ATTACK_TYPES), arm = Object.keys(ARMOR_TYPES);
    const table = `<table><tr><th></th>${arm.map((a) => `<th>${ARMOR_TYPES[a].name}</th>`).join('')}</tr>${atk.map((a) => `<tr><th style="text-align:right">${ATTACK_TYPES[a].name}</th>${arm.map((r) => { const v = DAMAGE_TABLE[a][r]; return `<td class="${v > 1.05 ? 'hi' : v < 0.95 ? 'lo' : ''}">${Math.round(v * 100)}%</td>`; }).join('')}</tr>`).join('')}</table>`;
    $('codex-body').innerHTML = `
      <section><h4>Das Ziel</h4>Zwei Teams – <b>West</b> und <b>Ost</b> – verteidigen je einen <b>König</b>. Jeder Spieler hat eine eigene Bahn. Alle Bahnen werden gleichzeitig von Gegnerwellen angegriffen. Fällt dein König, verliert dein Team. Überstehen beide Könige alle ${ECON.maxWaves} Wellen, gewinnt das Team mit dem gesünderen König.</section>
      <section><h4>Bauphase &amp; Kampf</h4>Vor jeder Welle hast du <b>${ECON.buildTime} Sekunden</b> (erste Welle ${ECON.buildTimeFirst}s), um Kämpfer auf dein <b>Bauraster</b> zu setzen. Dann startet die Welle: Deine Kämpfer greifen automatisch an. Nach der Welle stehen alle Kämpfer wieder geheilt auf ihrem Platz – gefallene Kämpfer kehren zurück. Mit <span class="key">↵</span> „Bereit“ startest du die Welle früher.</section>
      <section><h4>Durchbrüche</h4>Gegner, die das Ende deiner Bahn erreichen, laufen zum <b>König deines Teams</b> und greifen ihn an. Der König wehrt sich mit Flächenschaden. Nach ${ECON.battleRageTime} Sekunden geraten übrige Gegner in <b>Raserei</b> und stürmen direkt zum König.</section>
      <section><h4>Gold &amp; Einkommen</h4>Jeder besiegte Gegner bringt <b>Kopfgeld</b>. Nach jeder Welle bekommst du zusätzlich dein <b>Einkommen</b>. Kämpfer lassen sich in mehreren Stufen <b>aufwerten</b> (stärker und platzsparend). Verkaufen erstattet ${Math.round(ECON.sellRefund * 100)} % – oder 100 %, wenn der Kämpfer in derselben Bauphase gebaut wurde.</section>
      <section><h4>Äther, Funken &amp; Söldner</h4><b>Funken</b> (Arbeiter) kosten Gold und sammeln dauerhaft <b>Äther</b>. Mit Äther schickst du <b>Söldner</b> in die Bahn deines Gegners – sie laufen mit der nächsten Welle mit. Jeder Söldner erhöht dein <b>Einkommen</b> dauerhaft. Mit Äther verbesserst du auch deinen König.</section>
      <section><h4>Der König</h4>Start: ${KING.hp} Leben, starker Flächenangriff. Verbesserungen: Lebenskraft, Königsmacht, Erneuerung. Dein Team hat <b>${KING.heals} Heilungen</b> (je ${Math.round(KING.healPct * 100)} %).</section>
      <section><h4>Angriff gegen Rüstung</h4>Jeder Kämpfer und Gegner hat eine Angriffs- und eine Rüstungsart. Wähle Kämpfer passend zur nächsten Welle (Wellenname und Typ siehst du oben).<br><br>${table}</section>
      <section><h4>Fraktionen</h4>${FACTION_IDS.map((f) => `<b>${FACTIONS[f].name}</b> – ${FACTIONS[f].desc}`).join('<br>')}<br><br>Zufällige Fraktion: <b>+${ECON.randomBonusGold} Gold</b> zum Start.</section>
      <section><h4>Steuerung</h4><div class="keys">${KEYS.map(([k, d]) => `<span>${k.split(' ').map((x) => `<span class="key">${x}</span>`).join(' ')}</span><span>${d}</span>`).join('')}</div></section>`;
  }

  // ---------- Mehrspieler (Vorschau) ----------
  buildMulti() {
    const S = this.settings;
    const srv = $('inp-server');
    srv.value = S.get('serverUrl');
    srv.addEventListener('change', () => S.set('serverUrl', srv.value.trim()));
    const lobby = $('mp-lobby');
    lobby.textContent = 'Nicht verbunden.';
    const connect = () => {
      if (this.mp && this.mp.ws.readyState <= 1) return this.mp;
      const ws = new WebSocket(S.get('serverUrl'));
      const mp = { ws, handlers: [] };
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: S.get('playerName') }));
      ws.onerror = () => { lobby.textContent = 'Server nicht erreichbar. Läuft „npm run server“?'; };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') mp.myId = m.id;
        if (m.t === 'lobby') {
          mp.lobby = m;
          lobby.innerHTML = `Raum <b>${m.room}</b> · ${m.mode} gegen ${m.mode}<br>` + m.players.map((p) => `${p.id === m.host ? '♛ ' : ''}${escapeHtml(p.name)} – Team ${p.team === 0 ? 'West' : 'Ost'}`).join('<br>');
          $('btn-mp-start').disabled = m.host !== mp.myId;
        }
        if (m.t === 'error') lobby.textContent = m.reason;
        if (m.t === 'start') this.onMultiplayerStart(mp, m);
        for (const h of mp.handlers) h(m);
      };
      this.mp = mp;
      return mp;
    };
    const sendWhenOpen = (mp, obj) => { if (mp.ws.readyState === 1) mp.ws.send(JSON.stringify(obj)); else mp.ws.addEventListener('open', () => mp.ws.send(JSON.stringify(obj)), { once: true }); };
    $('btn-mp-create').addEventListener('click', () => { const mp = connect(); sendWhenOpen(mp, { t: 'create', mode: S.get('teamSize') }); sendWhenOpen(mp, { t: 'slot', team: 0, faction: S.get('faction') }); });
    $('btn-mp-join').addEventListener('click', () => { const mp = connect(); sendWhenOpen(mp, { t: 'join', room: $('inp-room').value.trim() }); setTimeout(() => sendWhenOpen(mp, { t: 'slot', team: 1, faction: S.get('faction') }), 300); });
    $('btn-mp-start').addEventListener('click', () => { if (this.mp) sendWhenOpen(this.mp, { t: 'start' }); });
  }
}

export const KEYS = [
  ['Q W E R T', 'Kämpfer zum Bauen auswählen'],
  ['Linksklick', 'Platzieren / Einheit auswählen'],
  ['Shift + Klick', 'Mehrere gleiche Kämpfer setzen'],
  ['Rechtsklick', 'Bauen abbrechen / Auswahl aufheben'],
  ['U', 'Ausgewählten Kämpfer aufwerten'],
  ['X Entf', 'Ausgewählten Kämpfer verkaufen'],
  ['1 – 7', 'Söldner zum Gegner schicken'],
  ['B', 'Äther-Funken (Arbeiter) anwerben'],
  ['K', 'Königshalle öffnen'],
  ['H', 'König heilen'],
  ['↵', 'Bereit – Welle früher starten'],
  ['Leertaste', 'Kamera zur eigenen Bahn'],
  ['Pos1', 'Kamera zum eigenen König'],
  ['Pfeiltasten', 'Kamera bewegen (auch Bildschirmrand)'],
  ['Mausrad', 'Zoomen'],
  ['Mittlere Maustaste', 'Kamera drehen (mit Shift: verschieben)'],
  ['Tab', 'Punktetafel (gedrückt halten)'],
  ['Esc', 'Pause / Abbrechen'],
];
