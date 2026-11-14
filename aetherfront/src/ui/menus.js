// Menüs: Bildschirmwechsel, Gefecht einrichten, Einstellungen, Kodex, Mehrspieler-Lobby.
import { FACTIONS, FACTION_IDS, factionUnits, DAMAGE_TABLE, ATTACK_TYPES, ARMOR_TYPES, ECON, KING } from '../sim/data.js';
import { escapeHtml } from './hud.js';
import { PICK_MODES, MODIFIERS, modeCode } from '../sim/modes.js';
import { ACTS, MISSIONS, TALENTS, GOAL_TEXT, CAMPAIGN_DIFFICULTY, unlockedFactions, missionUnlocked, star3Text } from '../sim/campaign.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor({ settings, audio, portraits, progress, onStart, onStartMission, onResume, onSurrender, onRematch, onToMenu, onQuit, onApplyGraphics, onMultiplayerStart }) {
    Object.assign(this, { settings, audio, portraits, progress, onStart, onStartMission, onResume, onSurrender, onRematch, onToMenu, onQuit, onApplyGraphics, onMultiplayerStart });
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
    if (id === 'campaign') this.refreshCampaign();
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
    this.seg($('seg-ally'), [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']], 'allyDifficulty', () => this.refreshSummary());
    this.seg($('seg-pick'), Object.entries(PICK_MODES).map(([k, m]) => [k, m.code]), 'pickMode', () => this.refreshSetup());
    this.seg($('seg-cc'), [[false, 'Ohne Champions'], [true, 'CC – Champions']], 'champions', () => this.refreshSummary());
    this.seg($('seg-waves'), [[20, '20 Wellen'], [30, '30 Wellen']], 'waves', () => this.refreshSummary());
    this.seg($('seg-speed'), [[1, '1×'], [1.5, '1,5×'], [2, '2×']], 'gameSpeed', () => this.refreshSummary());
    const nm = $('inp-name');
    nm.value = this.settings.get('playerName');
    nm.addEventListener('input', () => this.settings.set('playerName', nm.value.trim() || 'Tiry'));
  }
  refreshSetup() {
    const box = $('factions');
    box.innerHTML = '';
    const list = [...FACTION_IDS, 'random'];
    const pick = this.settings.get('pickMode');
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
      el.classList.toggle('on', pick === 'ap' ? this.settings.get('faction') === id : id === 'random');
      if (pick !== 'ap' && id !== 'random') el.classList.add('locked');
      if (pick !== 'ap' && id === 'random') {
        el.querySelector('.name').textContent = pick === 'hp' ? 'Hybrid' : 'Zufall';
        el.querySelector('.desc').textContent = PICK_MODES[pick].desc;
      }
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
    const S = this.settings;
    const n = S.get('teamSize');
    const pick = S.get('pickMode');
    const f = FACTIONS[S.get('faction')];
    const code = modeCode({ pickMode: pick, champions: S.get('champions') });
    $('mode-code').textContent = code;
    $('mode-desc').textContent = `${PICK_MODES[pick].name}: ${PICK_MODES[pick].desc}${S.get('champions') ? ` · ${MODIFIERS.cc.desc}` : ''}`;
    const D = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
    $('setup-summary').textContent = `${code} · ${n} gegen ${n} · ${pick === 'ap' ? (f ? f.name : 'Zufallsfraktion') : PICK_MODES[pick].name} · Verbündete ${D[S.get('allyDifficulty')]} · Gegner ${D[S.get('difficulty')]} · ${S.get('waves')} Wellen`;
  }
  setupConfig() {
    const S = this.settings;
    return { teamSize: S.get('teamSize'), faction: S.get('faction'), difficulty: S.get('difficulty'), allyDifficulty: S.get('allyDifficulty'), name: S.get('playerName') || 'Tiry',
      rules: { pickMode: S.get('pickMode'), champions: !!S.get('champions'), maxWaves: S.get('waves') } };
  }

  // ---------- Kampagne ----------
  refreshCampaign() {
    const S = this.settings, P = this.progress;
    const sel = MISSIONS.find((m) => m.id === S.get('campMission')) || MISSIONS[0];
    const act = this.campAct || sel.act;
    this.campAct = act;
    $('star-total').textContent = `★ ${P.total} / ${MISSIONS.length * 3}`;
    const tabs = $('act-tabs');
    tabs.innerHTML = '';
    for (const a of ACTS) {
      const b = document.createElement('button');
      b.textContent = a.short;
      b.classList.toggle('on', a.id === act);
      b.addEventListener('click', () => { this.audio.ui('click'); this.campAct = a.id; const first = MISSIONS.find((m) => m.act === a.id); S.set('campMission', first.id); this.refreshCampaign(); });
      tabs.appendChild(b);
    }
    const A = ACTS[act - 1];
    const map = $('camp-map');
    map.style.setProperty('--a1', `${A.grad[0]}55`); map.style.setProperty('--a2', A.grad[1]); map.style.setProperty('--a3', `${A.grad[2]}55`);
    const ms = MISSIONS.filter((m) => m.act === act);
    const pos = ms.map((_, i) => [14 + (i * 72) / Math.max(1, ms.length - 1), i % 2 ? 66 : 34]);
    let d = `M ${pos[0][0]} ${pos[0][1]}`;
    for (let i = 1; i < pos.length; i++) { const [x0, y0] = pos[i - 1], [x1, y1] = pos[i]; d += ` C ${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`; }
    map.innerHTML = `<svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="${A.grad[0]}"/><stop offset=".5" stop-color="${A.grad[1]}"/><stop offset="1" stop-color="${A.grad[2]}"/></linearGradient></defs><path d="${d}" stroke="url(#pg)" stroke-width="0.8" fill="none" stroke-dasharray="2 1.6" opacity="0.7"/></svg>`;
    ms.forEach((m, i) => {
      const n = document.createElement('div');
      const stars = P.stars[m.id] || 0;
      const open = missionUnlocked(m.id, P.stars);
      n.className = `node-wrap${stars ? ' done' : ''}${open ? '' : ' locked'}${m.id === sel.id ? ' sel' : ''}`;
      n.style.left = `${pos[i][0]}%`; n.style.top = `${pos[i][1]}%`;
      n.innerHTML = `<div class="node-ring"></div><div class="node"><span class="num">${m.id}</span></div><span class="gl">${m.goal === 'siege' ? 'BELAGERUNG' : 'HALTEN'}</span><span class="st">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>`;
      n.addEventListener('click', () => { if (!open) { this.audio.ui('error'); return; } this.audio.ui('click'); S.set('campMission', m.id); this.refreshCampaign(); });
      n.addEventListener('mouseenter', () => this.audio.ui('hover'));
      map.appendChild(n);
    });
    // Details
    const m = sel.act === act ? sel : ms[0];
    const unlocked = unlockedFactions(P.stars);
    if (!unlocked.includes(S.get('campFaction'))) S.set('campFaction', unlocked.includes(m.faction) ? m.faction : unlocked[0]);
    const open = missionUnlocked(m.id, P.stars);
    const det = $('camp-detail');
    det.innerHTML = `<h3>Mission ${m.id} · Wellen ${m.startWave}–${m.endWave}</h3><div class="title">${m.title}</div>
      <div class="story">„${m.story}“</div>
      <div class="goal">${GOAL_TEXT[m.goal]}</div>
      ${m.mods ? `<div class="mods">${m.mods.map((x) => `<span class="chip">${x}</span>`).join('')}</div>` : ''}
      <div class="stars-list"><b>★</b> Mission gewinnen · <b>★★</b> König mit mind. 50 % Leben · <b>★★★</b> ${star3Text(m.star3)}</div>
      ${m.tips ? `<div class="tips">${m.tips.map((t) => `◆ ${t}`).join('<br>')}</div>` : ''}
      <h3>Fraktion</h3><div class="seg" id="camp-fac"></div>
      <h3>Schwierigkeit</h3><div class="seg" id="camp-diff"></div>
      <div class="row" style="margin-top:8px"><button class="pill big primary" id="btn-mission" ${open ? '' : 'disabled'}>Mission starten</button></div>`;
    const facSeg = $('camp-fac');
    for (const f of FACTION_IDS) {
      const b = document.createElement('button');
      const ok = unlocked.includes(f);
      b.textContent = ok ? FACTIONS[f].name : `🔒 ${FACTIONS[f].name}`;
      b.disabled = !ok;
      b.classList.toggle('on', S.get('campFaction') === f);
      b.title = ok ? FACTIONS[f].desc : `Wird mit ${ACTS.find((a) => a.unlock === f)?.name || 'der Kampagne'} freigeschaltet`;
      b.addEventListener('click', () => { this.audio.ui('click'); S.set('campFaction', f); facSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
      facSeg.appendChild(b);
    }
    this.seg($('camp-diff'), Object.entries(CAMPAIGN_DIFFICULTY).map(([k, v]) => [k, v.label]), 'campDifficulty');
    $('btn-mission').addEventListener('click', () => { this.audio.ui('confirm'); this.onStartMission(m, { faction: S.get('campFaction'), difficulty: S.get('campDifficulty') }); });
    $('talents').innerHTML = TALENTS.map((t) => `<span class="talent${P.total >= t.stars ? ' on' : ''}"><b>${t.stars}★</b> ${t.name}: ${t.desc}</span>`).join('');
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
          const c = m.config || {};
          const team = (t) => m.players.filter((p) => p.team === t).map((p) => `${p.id === m.host ? '♛ ' : ''}${escapeHtml(p.name)}${p.id === mp.myId ? ' (du)' : ''}`).join('<br>') || '<span class="muted">– frei –</span>';
          lobby.innerHTML = `Raum-Code <b style="letter-spacing:.2em">${m.room}</b> · Modus <span class="code-badge">${modeCode(c)}</span> · ${m.mode} gegen ${m.mode} · ${c.waves} Wellen · ${c.bots ? `Bots füllen auf (${{ easy: 'Leicht', normal: 'Normal', hard: 'Schwer' }[c.botDifficulty]})` : 'ohne Bots'}
            <div class="mp-team" style="margin-top:10px"><div><h5 style="color:var(--west)">Team West</h5>${team(0)}</div><div><h5 style="color:var(--east)">Team Ost</h5>${team(1)}</div></div>`;
          $('btn-mp-start').disabled = m.host !== mp.myId;
          this.renderHostControls(mp, m);
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
    $('btn-mp-team').addEventListener('click', () => {
      if (!this.mp || !this.mp.lobby) return;
      const me = this.mp.lobby.players.find((p) => p.id === this.mp.myId);
      sendWhenOpen(this.mp, { t: 'slot', team: me && me.team === 0 ? 1 : 0, faction: S.get('faction') });
    });
    this.sendWhenOpen = sendWhenOpen;
  }
}

Menus.prototype.renderHostControls = function renderHostControls(mp, lobby) {
  const box = $('mp-host');
  const isHost = lobby.host === mp.myId;
  if (!isHost) { box.innerHTML = '<p class="fine">Der Host legt Modus, Teamgröße, Wellen und Bots fest.</p>'; return; }
  const c = lobby.config;
  const send = (patch) => this.sendWhenOpen(mp, { t: 'config', config: { ...patch } });
  box.innerHTML = '';
  const mk = (label, opts, cur, key) => {
    const r = document.createElement('div'); r.className = 'row';
    const l = document.createElement('span'); l.textContent = label; r.appendChild(l);
    const sg = document.createElement('div'); sg.className = 'seg';
    for (const [v, t] of opts) {
      const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', cur === v);
      b.addEventListener('click', () => { this.audio.ui('click'); send({ [key]: v }); });
      sg.appendChild(b);
    }
    r.appendChild(sg); box.appendChild(r);
  };
  mk('Spielmodus', Object.entries(PICK_MODES).map(([k, m]) => [k, `${m.code} · ${m.name}`]), c.pickMode, 'pickMode');
  mk('Champions', [[false, 'Aus'], [true, 'CC an']], c.champions, 'champions');
  mk('Teams', [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']], lobby.mode, 'mode');
  mk('Wellen', [[10, '10'], [20, '20'], [30, '30']], c.waves, 'waves');
  mk('Bots', [[true, 'Leere Plätze mit Bots füllen'], [false, 'Keine Bots']], c.bots, 'bots');
  mk('Bot-Stärke', [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']], c.botDifficulty, 'botDifficulty');
};

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
