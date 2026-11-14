// Spiel-Oberfläche (HUD): Ressourcen, Phase/Timer, Könige, Kommando-Konsole (Kämpfer, Söldner, Wirtschaft),
// Auswahlkarte, Königshalle, Punktetafel, Meldungen, Banner, Tooltips.
import { UNITS, SENDS, KING, ECON, FACTIONS, ATTACK_TYPES, ARMOR_TYPES, kingUpgradeCost } from '../sim/data.js';
import { I, stat } from './icons.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('de-DE');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const LANES_KEY = 'aetherfront.ui.lanesCollapsed';
const KUP_ICON = { hp: 'heart', dmg: 'sword', regen: 'heal' };

export function abilityText(ab) {
  const out = [];
  if (ab.heal) out.push(`Heilt Verbündete um ${ab.heal.amount} (alle ${ab.heal.cd}s)`);
  if (ab.splash) out.push(`Flächenschaden ${Math.round(ab.splash.pct * 100)} % (Radius ${ab.splash.radius})`);
  if (ab.chain) out.push(`Kettenblitz: springt ${ab.chain.jumps}×`);
  if (ab.multishot) out.push(`Trifft bis zu ${ab.multishot.targets} Ziele`);
  if (ab.crit) out.push(`${Math.round(ab.crit.chance * 100)} % Krit (×${ab.crit.mult})`);
  if (ab.stun) out.push(`${Math.round(ab.stun.chance * 100)} % Betäubung (${ab.stun.dur}s)`);
  if (ab.slow) out.push(`Verlangsamt um ${Math.round(ab.slow.pct * 100)} %`);
  if (ab.curse) out.push(`Fluch: Ziel erleidet +${Math.round(ab.curse.pct * 100)} % Schaden`);
  if (ab.lifesteal) out.push(`Lebensraub ${Math.round(ab.lifesteal * 100)} %`);
  if (ab.aura_armor) out.push(`Aura: +${ab.aura_armor.armor} Rüstung für Verbündete`);
  if (ab.aura_speed) out.push(`Aura: +${Math.round(ab.aura_speed.pct * 100)} % Angriffstempo`);
  if (ab.regen) out.push(`Regeneriert ${ab.regen} Leben/s`);
  if (ab.taunt) out.push('Spott: zieht Gegner auf sich');
  if (ab.thorns) out.push(`Dornen: wirft ${Math.round(ab.thorns * 100)} % Nahkampfschaden zurück`);
  return out;
}

/** Wertegitter für Einheiten-Tooltips und Auswahlkarte */
function statGrid(def, hpHtml) {
  return `<div class="stats">${stat('heart', hpHtml ?? `<b>${fmt(def.hp)}</b> Leben`, 'hp')}${stat('sword', `<b>${def.dmg}</b> / ${def.cd}s`, 'atk')}` +
    `${stat('type', `${ATTACK_TYPES[def.atk].name}`, 'atk')}${stat('shield', `${ARMOR_TYPES[def.armorType].name} ${def.armor ?? ''}`, 'arm')}` +
    `${def.range != null ? stat('range', `Reichweite ${def.range}`, 'rng') : ''}</div>`;
}

export class Hud {
  constructor({ portraits, submit, onPlace, onSelect, onFocusLane, onFocusKing, onPause, audio, settings }) {
    this.portraits = portraits;
    this.submit = submit;
    this.onPlace = onPlace;
    this.onSelect = onSelect;
    this.onFocusLane = onFocusLane;
    this.onFocusKing = onFocusKing;
    this.onPause = onPause || (() => {});
    this.audio = audio;
    this.settings = settings;
    this.acc = 0;
    this.selected = null;
    this.placing = null;
    this.last = {};
    this.tipFor = null;
  }

  unitPortrait(def) { return this.portraits.get(`f|${def.id}`, def.model, FACTIONS[def.faction].palette, def.tier); }
  sendPortrait(s) { return this.portraits.get(`c|${s.id}`, s.model, s.palette, 2); }

  /** Hover-Tooltip + Klang an ein Element binden */
  hover(el, html, sound = true) {
    el.addEventListener('mouseenter', () => { if (sound) this.audio.ui('hover'); this.tip(el, typeof html === 'function' ? html() : html); });
    el.addEventListener('mouseleave', () => this.tip(null));
  }

  build(session) {
    this.session = session;
    const sim = session.sim;
    const me = sim.players[session.localPid];
    this.me = me;
    this.camp = sim.campaign;
    this.last = {};
    this.phaseKey = null;
    // Ressourcen
    const rr = $('res-row');
    rr.innerHTML = '';
    for (const [k, label] of [['gold', 'Gold'], ['aether', 'Äther'], ['value', 'Armeewert']]) {
      const el = h('div', `res ${k}`, `<div class="ic">${I[k]}</div><div class="rv"><div class="v" id="r-${k}">0</div><div class="s" id="r-${k}-s">${label}</div></div>`);
      this.hover(el, () => this.resTip(k), false);
      rr.appendChild(el);
    }
    // Könige
    this.healMax = [KING.heals, KING.heals];
    for (const t of [0, 1]) {
      const el = $(`king-${t}`);
      const label = t === me.team ? 'Dein König' : sim.teams[t].king.citadel ? 'Rissfeste' : 'Feindkönig';
      el.innerHTML = `<div class="kb-crest">${sim.teams[t].king.citadel ? I.siege : I.crown}</div><div class="kb-body">
        <div class="kb-top"><b>${label}</b><span class="kb-pct" id="k-pct-${t}">100%</span></div>
        <div class="kb-bar"><i class="kb-ghost" id="k-ghost-${t}"></i><i class="kb-fill" id="k-fill-${t}"></i></div>
        <div class="kb-meta"><small id="k-meta-${t}"></small><span class="kb-heals" id="k-heals-${t}"></span></div></div>`;
      el.onclick = () => { this.audio.ui('click'); this.onFocusKing(t); };
      el.onmouseenter = () => this.tip(el, `<h5>${label} <span class="muted">Team ${t === 0 ? 'West' : 'Ost'}</span></h5>Fällt dieser König, verliert das Team.<div class="tt-foot">Klicken: Kamera zum König · <span class="key">Pos1</span> eigener König</div>`);
      el.onmouseleave = () => this.tip(null);
    }
    this.buildPhase();
    this.buildActions();
    this.buildBuildDock();
    this.buildRest(session);
  }

  buildPhase() {
    const ph = $('phase');
    ph.innerHTML = `<div class="ph-time"><b id="ph-time">0:00</b><small id="ph-tag">Bauphase</small></div><div class="ph-sep"></div>
      <div class="ph-main"><div class="ph-wave" id="ph-wave"></div><div class="ph-meta" id="ph-meta"></div></div>
      <div class="ph-bar"><i id="ph-fill"></i></div>
      <div class="ph-btns"><button class="btn small" id="btn-reroll" hidden>${I.dice} Neu würfeln</button><button class="btn small primary ready" id="btn-ready" hidden>Bereit <span class="key">↵</span></button></div>`;
    const rr = $('btn-reroll');
    rr.addEventListener('click', () => { this.audio.ui('confirm'); this.submit({ type: 'reroll' }); });
    this.hover(rr, '<h5>Neu würfeln <span class="muted">PR-Modus</span></h5>Einmal pro Partie in der ersten Bauphase: du bekommst eine andere zufällige Fraktion. Vorher alle Kämpfer verkaufen.');
    const rb = $('btn-ready');
    rb.addEventListener('click', () => { this.audio.ui('confirm'); this.submit({ type: 'ready' }); });
    this.hover(rb, '<h5>Bereit</h5>Startet die nächste Welle früher, sobald alle Spieler bereit sind.<div class="tt-foot">Taste <span class="key">↵</span></div>');
  }

  buildActions() {
    const box = $('hud-actions');
    box.innerHTML = '';
    const mk = (icon, kk, tip, fn) => {
      const b = h('button', 'icon-btn', `${I[icon]}<span class="kk">${kk}</span>`);
      b.setAttribute('aria-label', tip.replace(/<[^>]+>/g, ''));
      b.addEventListener('click', () => { this.audio.ui('click'); fn(); });
      this.hover(b, tip);
      box.appendChild(b);
      return b;
    };
    mk('board', 'Tab', '<h5>Punktetafel</h5>Alle Spieler, Armeewerte und Durchbrüche.<div class="tt-foot">Taste <span class="key">Tab</span> gedrückt halten</div>', () => this.showScoreboard(!$('scoreboard').classList.contains('show')));
    mk('menu', 'Esc', '<h5>Menü</h5>Pause, Einstellungen, Kodex.<div class="tt-foot">Taste <span class="key">Esc</span></div>', () => { this.tip(null); this.onPause(); });
  }

  buildBuildDock() {
    const me = this.me;
    const bd = $('build-dock');
    bd.innerHTML = '';
    this.buildCards = me.lines.map((id, i) => {
      const u = UNITS[id];
      const g = FACTIONS[u.faction].grad;
      const hk = ['Q', 'W', 'E', 'R', 'T'][i];
      const c = h('div', 'slot build', `<img src="${this.unitPortrait(u)}" alt=""/><span class="need"></span><span class="shine"></span><span class="hk">${hk}</span><span class="cost g">${I.gold}<b>${u.cost}</b></span>`);
      c.style.setProperty('--sc', `${g[0]}66`);
      c.addEventListener('click', () => { this.audio.ui('click'); this.onPlace(u); });
      this.hover(c, () => this.unitTip(u, hk));
      bd.appendChild(c);
      return { u, el: c, hk };
    });
  }

  buildRest(session) {
    const sim = session.sim;
    const me = this.me;
    // Söldner
    const sd = $('send-dock');
    sd.innerHTML = '';
    this.sendCards = SENDS.map((s) => {
      const c = h('div', 'slot sm merc', `<img src="${this.sendPortrait(s)}" alt=""/><span class="need"></span><span class="shine"></span><span class="hk">${s.hotkey}</span><span class="cost a">${I.aether}<b>${s.cost}</b></span><div class="lock" style="display:none"></div>`);
      c.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'send', send: s.id }); });
      this.hover(c, () => this.sendTip(s));
      sd.appendChild(c);
      return { s, el: c, cost: c.querySelector('.cost b'), lock: c.querySelector('.lock') };
    });
    // Wirtschaft & König
    const ed = $('eco-dock');
    ed.innerHTML = '';
    const mk = (cls, ico, hk, costHtml, onClick, tipFn) => {
      const c = h('div', `slot sm action ${cls}`, `<span class="ico">${I[ico]}</span><span class="cd"></span><span class="shine"></span><span class="hk">${hk}</span><span class="cost">${costHtml}</span>`);
      c.addEventListener('click', () => { this.audio.ui('click'); onClick(); });
      this.hover(c, tipFn);
      ed.appendChild(c);
      return c;
    };
    this.workerCard = mk('worker', 'worker', 'B', `${I.gold}<b></b>`, () => this.submit({ type: 'worker' }), () => `<h5>Äther-Funke <span class="muted">Arbeiter</span></h5>Ein Funke sammelt dauerhaft ${ECON.workerRate} Äther pro Sekunde. Äther brauchst du für Söldner und die Königshalle.<div class="tt-cost">${stat('gold', `<b class="g">${sim.workerCost(this.me)}</b> Gold`)}${stat('worker', `<b>${this.me.workers}</b> / ${ECON.maxWorkers} Funken`)}</div>`);
    this.workerCard.querySelector('.cost').classList.add('g');
    this.workerCard.appendChild(h('span', 'cnt'));
    this.kingCard = mk('hall', 'hall', 'K', '<b>Halle</b>', () => this.toggleKingPanel(), () => '<h5>Königshalle</h5>Verbessere deinen König mit Äther: Lebenskraft, Königsmacht und Erneuerung. Die Verbesserungen gelten für das ganze Team.<div class="tt-foot">Taste <span class="key">K</span></div>');
    this.healCard = mk('heal', 'heal', 'H', '<b></b>', () => this.submit({ type: 'heal' }), () => `<h5>König heilen</h5>Stellt sofort ${Math.round(KING.healPct * 100)} % Leben wieder her. Das Team hat nur ${KING.heals} Heilungen pro Partie (Abklingzeit ${KING.healCd}s).`);
    this.healCard.querySelector('.cost').classList.add('ok');
    // König-Panel
    this.buildKingPanel();
    // Bahnen
    const ln = $('lanes');
    ln.innerHTML = '';
    let collapsed = false;
    try { collapsed = localStorage.getItem(LANES_KEY) === '1'; } catch { /* egal */ }
    ln.classList.toggle('collapsed', collapsed);
    const head = h('div', 'lanes-head', `<span>Fronten</span>${I.chevron}`);
    head.addEventListener('click', () => {
      this.audio.ui('click');
      const c = !ln.classList.contains('collapsed');
      ln.classList.toggle('collapsed', c);
      try { localStorage.setItem(LANES_KEY, c ? '1' : '0'); } catch { /* egal */ }
    });
    ln.appendChild(head);
    let team = -1;
    this.laneRows = sim.players.slice().sort((a, b) => a.team - b.team || a.slot - b.slot).map((p) => {
      if (p.team !== team) { team = p.team; ln.appendChild(h('div', `lane-team t${team}`, team === 0 ? 'Team West' : 'Team Ost')); }
      const t1 = UNITS[p.lines[0]];
      const el = h('div', `lane-btn t${p.team}${p.id === me.id ? ' me' : ''}`, `<span class="dot" style="background-image:url(${this.unitPortrait(t1)})"></span><span class="nm">${escapeHtml(p.name)}</span><span class="lk"></span>`);
      el.addEventListener('click', () => { this.audio.ui('click'); this.onFocusLane(p.id); });
      this.hover(el, () => `<h5>${escapeHtml(p.name)} <span class="muted">${facName(p)}${p.randomed ? ' · Zufall' : ''}</span></h5>Team ${p.team === 0 ? 'West' : 'Ost'} · Bahn ${p.slot + 1}<div class="tt-cost">${stat('value', `<b>${fmt(sim.armyValue(p.id))}</b> Armeewert`)}${stat('leak', `<b>${p.stats.leaks}</b> Durchbrüche`)}</div><div class="tt-foot">Klicken: Kamera zur Bahn</div>`, false);
      ln.appendChild(el);
      return { p, el, lk: el.querySelector('.lk') };
    });
    $('feed').innerHTML = '';
    const ob = $('objective');
    ob.classList.toggle('show', !!this.camp);
    this.setSelected(null);
    this.refresh(true);
  }

  buildKingPanel() {
    const kp = $('king-panel');
    kp.innerHTML = `<h4>${I.crown} Königshalle <small>Äther-Verbesserungen</small></h4>`;
    this.kups = Object.entries(KING.upgrades).map(([k, u]) => {
      const el = h('div', 'kup', `<span class="kic">${I[KUP_ICON[k]] || I.up}</span><div class="t"><b>${u.name}</b><small>${u.desc}</small><div class="lvbar" style="--seg:${100 / u.max}%"><i></i></div><span class="lv"></span></div><span class="c"></span>`);
      el.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'king', up: k }); });
      kp.appendChild(el);
      return { k, u, el, lv: el.querySelector('.lv'), c: el.querySelector('.c'), bar: el.querySelector('.lvbar') };
    });
  }
  toggleKingPanel(force) {
    const kp = $('king-panel');
    const show = force ?? !kp.classList.contains('show');
    kp.classList.toggle('show', show);
    if (this.kingCard) this.kingCard.classList.toggle('open', show);
    this.audio.ui(show ? 'open' : 'close');
  }

  resTip(k) {
    const p = this.me;
    if (k === 'gold') return `<h5>Gold</h5>Für Kämpfer, Aufwertungen und Funken. Du erhältst Kopfgeld für jeden besiegten Gegner und nach jeder Welle dein Einkommen. Jeder gesendete Söldner erhöht das Einkommen dauerhaft.<div class="tt-cost">${stat('income', `<b class="ok">+${p.income}</b> Einkommen pro Welle`)}</div>`;
    if (k === 'aether') return `<h5>Äther</h5>Sammeln deine Funken. Damit schickst du Söldner zum Gegner und verbesserst den König.<div class="tt-cost">${stat('worker', `<b>${p.workers}</b> × ${ECON.workerRate}/s`)}</div>`;
    if (k === 'income') return '<h5>Einkommen</h5>Gold, das du nach jeder Welle bekommst. Jeder gesendete Söldner erhöht es dauerhaft.';
    return '<h5>Armeewert</h5>Gesamtwert deiner Kämpfer inklusive Aufwertungen.';
  }
  unitTip(u, hk) {
    const chain = [u];
    while (chain[chain.length - 1].upgradeTo) chain.push(UNITS[chain[chain.length - 1].upgradeTo]);
    return `<h5>${u.name} <span class="muted">${u.roleLabel}</span></h5>` + statGrid(u) +
      `${abilityText(u.abil).map((a) => `<div class="abil">${a}</div>`).join('')}` +
      `<div class="tt-cost">${stat('gold', `<b class="g">${u.cost}</b> Gold`)}${hk ? `<span class="stat"><span class="key">${hk}</span> bauen</span>` : ''}</div>` +
      `<div class="tt-foot">Aufwertung: <b>${chain.map((c) => c.name).join(' → ')}</b></div>`;
  }
  sendTip(s) {
    const sim = this.session.sim;
    return `<h5>${s.name} <span class="muted">Söldner</span></h5>${this.camp ? `Marschiert mit der nächsten Welle gegen die Rissfeste und rammt sie (${s.cost * (this.camp.impactMul || 14)} Wucht).` : 'Läuft mit der nächsten Welle in die Bahn deines Gegners.'}` +
      `<div class="stats" style="margin-top:8px">${stat('heart', `<b>${fmt(s.hp)}</b> Leben`, 'hp')}${stat('sword', `<b>${s.dmg}</b> / ${s.cd}s`, 'atk')}${stat('type', ATTACK_TYPES[s.atk].name, 'atk')}${stat('shield', ARMOR_TYPES[s.armorType].name, 'arm')}</div>` +
      `<div class="tt-cost">${stat('aether', `<b class="a">${sim.sendCost(s)}</b> Äther`)}${stat('income', `<b class="ok">+${s.income}</b> Einkommen`)}</div>` +
      (sim.wave < s.unlock ? `<div class="tt-foot">Verfügbar ab <b>Welle ${s.unlock}</b></div>` : `<div class="tt-foot">Taste <span class="key">${s.hotkey}</span></div>`);
  }

  tip(anchor, html) {
    const t = $('tooltip');
    if (!anchor) { t.classList.remove('show'); this.tipFor = null; return; }
    t.innerHTML = html;
    t.classList.add('show');
    const z = window.__uiZoom || 1;
    // Slots der Konsole: Tooltip über der ganzen Konsole, damit nichts verdeckt wird
    const dock = anchor.closest && anchor.closest('.console');
    const ar = anchor.getBoundingClientRect();
    const r = dock ? { left: ar.left, width: ar.width, top: Math.min(ar.top, dock.getBoundingClientRect().top), bottom: ar.bottom } : ar;
    const tw = t.offsetWidth * z, th = t.offsetHeight * z;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 12 * z;
    if (y < 8) y = r.bottom + 12 * z;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - th - 8, y));
    t.style.left = `${x / z}px`; t.style.top = `${y / z}px`;
    this.tipFor = anchor;
  }

  setPlacing(u) {
    this.placing = u;
    for (const c of this.buildCards || []) c.el.classList.toggle('active', !!u && c.u.id === u.id);
  }

  setSelected(entity) {
    this.selected = entity;
    const card = $('select-card');
    if (!entity) { card.classList.remove('show'); return; }
    card.classList.add('show');
    this.renderSelected(true);
  }

  renderSelected(force) {
    const e = this.selected;
    if (!e) return;
    const sim = this.session.sim;
    const card = $('select-card');
    const isF = e.type === 'f';
    const def = isF ? UNITS[e.def] : e.def;
    const key = `${isF ? e.def : def.id || def.n}|${Math.round(e.hp)}|${sim.phase}|${Math.floor(this.me.gold)}`;
    if (!force && key === this.lastSelKey) return;
    this.lastSelKey = key;
    const own = isF && e.owner === this.me.id;
    const ally = isF && sim.players[e.owner].team === this.me.team;
    const por = isF ? this.unitPortrait(def) : this.portraits.get(`c|${def.key || def.id}`, def.model, def.palette, def.boss || def.champion ? 3 : 2);
    const next = isF && def.upgradeTo ? UNITS[def.upgradeTo] : null;
    const refund = isF ? (e.fresh ? def.value : Math.floor(def.value * ECON.sellRefund)) : 0;
    const build = sim.phase === 'build';
    const grad = isF ? FACTIONS[def.faction].grad : ['#ff5d70', '#ff5d70', '#ff5d70'];
    const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
    card.innerHTML = `<div class="por" style="--pc:${grad[0]}88"><img src="${por}" alt=""/></div><div class="info">
      <div class="nm">${def.name} ${isF ? `<span class="stars">${'★'.repeat(def.tier)}</span>` : ''}</div>
      <div class="sub">${isF ? `${FACTIONS[def.faction].name} · ${def.roleLabel} · Wert ${def.value}` : (e.isSend ? 'Söldner' : `${def.champion ? 'Champion · ' : ''}Welle ${def.n}`)}${isF && !own ? ` · ${escapeHtml(sim.players[e.owner].name)}` : ''}</div>
      <div class="hpbar${ally ? '' : ' enemy'}" style="--p:${hpPct}%"><i></i><span>${fmt(e.hp)} / ${fmt(e.maxHp)}</span></div>
      ${statGrid(def, `<b>${fmt(e.maxHp)}</b> Leben`)}
      ${isF ? abilityText(def.abil).map((a) => `<div class="abil">${a}</div>`).join('') : ''}
      ${own ? `<div class="sel-actions">
        ${next ? `<button class="btn small primary" id="sel-up" ${!build || this.me.gold < next.cost ? 'disabled' : ''}>${I.up} Aufwerten ${next.cost} <span class="key">U</span></button>` : `<span class="maxed">${I.star} Höchste Stufe</span>`}
        <button class="btn small" id="sel-sell" ${!build ? 'disabled' : ''}>Verkaufen +${refund} <span class="key">X</span></button></div>` : ''}
    </div>`;
    const up = card.querySelector('#sel-up');
    if (up) {
      up.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'upgrade', id: e.id }); });
      up.addEventListener('mouseenter', () => this.tip(up, `<h5>Aufwerten → ${next.name}</h5>` + statGrid(next) + abilityText(next.abil).map((a) => `<div class="abil">${a}</div>`).join('') + `<div class="tt-cost">${stat('gold', `<b class="g">${next.cost}</b> Gold`)}<span class="stat"><span class="key">U</span></span></div>`));
      up.addEventListener('mouseleave', () => this.tip(null));
    }
    const sell = card.querySelector('#sel-sell');
    if (sell) {
      sell.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'sell', id: e.id }); });
      sell.addEventListener('mouseenter', () => this.tip(sell, `<h5>Verkaufen</h5>Erstattet <b class="g">${refund} Gold</b>${e.fresh ? ' (volle Erstattung – in dieser Bauphase gebaut)' : ` (${Math.round(ECON.sellRefund * 100)} %)`}.<div class="tt-foot">Taste <span class="key">X</span> oder <span class="key">Entf</span></div>`));
      sell.addEventListener('mouseleave', () => this.tip(null));
    }
  }

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 1700);
  }
  feed(msg, cls = '') {
    const f = $('feed');
    const icon = cls === 'bad' ? I.leak : cls === 'good' ? I.check : cls === 'send' ? I.swords : I.diamond;
    const m = h('div', `msg ${cls}`, `${icon}<span>${msg}</span>`);
    f.appendChild(m);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => { m.classList.add('out'); setTimeout(() => m.remove(), 500); }, 6500);
  }
  banner(title, sub, boss = false) {
    const b = $('banner');
    b.className = 'banner';
    b.innerHTML = `<div class="bl"></div><div class="t">${title}</div><div class="s">${sub}</div>`;
    void b.offsetWidth;
    b.className = `banner show${boss ? ' boss' : ''}`;
  }

  onEvent(e) {
    const sim = this.session.sim;
    const me = this.me;
    switch (e.e) {
      case 'error': if (e.pid === me.id) { this.toast(e.reason); this.audio.ui('error'); } break;
      case 'reroll': if (e.pid === me.id) { this.buildBuildDock(); this.feed(`Neu gewürfelt: ${FACTIONS[e.faction].name}`, 'good'); this.phaseKey = null; } break;
      case 'enemySend': this.feed(`Der Rissfürst schickt dir ${e.count}× ${SENDS.find((x) => x.id === e.send).name}!`, 'send'); break;
      case 'siege': this.feed(`${e.count} Söldner stürmen die Rissfeste`, 'good'); break;
      case 'waveStart': {
        const w = sim.waveDef(e.wave);
        this.banner(e.boss ? w.name.toUpperCase() : `WELLE ${e.wave}`, e.boss ? `Bosswelle ${e.wave}` : w.name, e.boss);
        break;
      }
      case 'waveEnd': {
        const myLeaks = e.leaks[me.id];
        this.feed(myLeaks ? `Welle ${e.wave} überstanden – ${myLeaks} Gegner durchgebrochen` : `Welle ${e.wave} sauber gehalten · +${me.income} Gold`, myLeaks ? 'bad' : 'good');
        break;
      }
      case 'leak': if (e.pid === me.id) this.feedOnce('leak', 'Durchbruch! Gegner laufen zu deinem König', 'bad'); break;
      case 'send': {
        const s = SENDS.find((x) => x.id === e.send);
        if (e.to === me.id) this.feed(`${escapeHtml(sim.players[e.pid].name)} schickt dir: ${s.name}`, 'send');
        else if (e.pid === me.id) this.feed(`${s.name} ${e.to < 0 ? 'rückt gegen die Rissfeste aus' : 'geschickt'} · Einkommen +${s.income}`, 'good');
        break;
      }
      case 'king': if (sim.players[e.pid].team === me.team) this.feed(`${escapeHtml(sim.players[e.pid].name)}: ${KING.upgrades[e.up].name} Stufe ${e.level}`, 'good'); break;
      case 'kingHeal': if (e.team === me.team) this.feed(`König geheilt (+${fmt(e.amount)})`, 'good'); break;
      case 'kingHit': if (e.team === me.team) { const k = $(`king-${e.team}`); if (k && !k.classList.contains('hurt')) { k.classList.add('hurt'); setTimeout(() => k.classList.remove('hurt'), 450); } } break;
      case 'rage': this.feed('Die Gegner geraten in Raserei und stürmen zum König!', 'bad'); break;
      case 'sell': case 'upgrade': if (this.selected && this.selected.id === e.id) { const ent = sim.entities.get(e.id); this.setSelected(ent || null); this.onSelect(ent || null); } break;
      default: break;
    }
  }
  feedOnce(key, msg, cls) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < 4000) return;
    this.last[key] = now;
    this.feed(msg, cls);
  }

  setValue(id, v) {
    const el = $(id);
    if (!el) return;
    const s = typeof v === 'number' ? fmt(v) : v;
    if (el.textContent !== s) {
      if (this.ready && typeof v === 'number' && el.textContent && v > (parseInt(el.textContent.replace(/\./g, ''), 10) || 0)) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      el.textContent = s;
    }
  }
  setHtml(el, key, html) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    this.refresh();
  }

  refresh() {
    const sim = this.session.sim;
    const me = this.me;
    const build = sim.phase === 'build';
    this.setValue('r-gold', me.gold);
    this.setValue('r-gold-s', `+${me.income} / Welle`);
    this.setValue('r-aether', me.aether);
    this.setValue('r-aether-s', `${me.workers} Funken`);
    this.setValue('r-income', me.income);
    this.setValue('r-value', sim.armyValue(me.id));
    this.ready = true;

    // Phase
    const w = sim.waveDef();
    const ph = $('phase');
    const tleft = Math.max(0, Math.ceil(sim.phaseTime));
    const total = sim.wave === sim.rules.startWave ? sim.rules.buildTimeFirst : sim.rules.buildTime;
    const canReroll = build && me.rerolls > 0 && sim.wave === sim.rules.startWave;
    const over = sim.phase === 'over';
    ph.classList.toggle('battle', !build && !over);
    ph.classList.toggle('urgent', build && tleft <= 5);
    this.setValue('ph-time', build ? mmss(tleft) : mmss(sim.battleTime || 0));
    this.setValue('ph-tag', build ? 'Bauphase' : over ? 'Ende' : sim.rage ? 'Raserei' : 'Kampf');
    $('ph-fill').style.transform = `scaleX(${build ? Math.max(0, Math.min(1, sim.phaseTime / total)) : Math.min(1, (sim.battleTime || 0) / ECON.battleRageTime)})`;
    const waveKey = `${sim.wave}|${sim.rules.maxWaves}|${w ? w.name : ''}`;
    if (waveKey !== this.phaseKey) {
      this.phaseKey = waveKey;
      $('ph-wave').innerHTML = `<small>Welle</small><b>${sim.wave}</b><span>/ ${sim.rules.maxWaves}</span>${w && w.boss ? `<span class="boss">${I.skull} Boss</span>` : ''}${w ? `<span class="nm">${w.name}</span>` : ''}`;
      $('ph-meta').innerHTML = w ? `${stat('count', `${w.count}×`, 'cnt')}${stat('shield', ARMOR_TYPES[w.armorType].name, 'arm')}${stat('sword', `${ATTACK_TYPES[w.atk].name}${w.ranged ? ' · Fern' : ''}`, 'atk')}` : '';
    }
    $('btn-reroll').hidden = !canReroll;
    $('btn-ready').hidden = !(build && !me.ready);

    // Könige
    for (const t of [0, 1]) {
      const k = sim.teams[t].king;
      const ratio = Math.max(0, k.hp / k.maxHp);
      this.healMax[t] = Math.max(this.healMax[t], k.heals);
      const kk = `${Math.round(ratio * 1000)}|${k.heals}|${Math.round(k.hp)}`;
      if (this.last[`king${t}`] !== kk) {
        this.last[`king${t}`] = kk;
        $(`k-fill-${t}`).style.transform = `scaleX(${ratio})`;
        $(`k-ghost-${t}`).style.transform = `scaleX(${ratio})`;
        $(`k-pct-${t}`).textContent = `${Math.ceil(ratio * 100)}%`;
        $(`k-meta-${t}`).textContent = `${fmt(k.hp)} / ${fmt(k.maxHp)}`;
        $(`k-heals-${t}`).innerHTML = Array.from({ length: this.healMax[t] }, (_, i) => `<i class="${i < k.heals ? '' : 'used'}"></i>`).join('');
        $(`king-${t}`).classList.toggle('low', ratio < 0.3);
      }
    }

    // Kämpfer-Slots
    for (const c of this.buildCards) {
      const poor = me.gold < c.u.cost;
      c.el.classList.toggle('off', !build);
      c.el.classList.toggle('poor', build && poor);
      c.el.style.setProperty('--need', build && poor ? (1 - me.gold / c.u.cost).toFixed(3) : 0);
    }
    for (const c of this.sendCards) {
      const locked = sim.wave < c.s.unlock;
      const cost = sim.sendCost(c.s);
      c.el.classList.toggle('off', locked);
      c.el.classList.toggle('poor', !locked && me.aether < cost);
      c.el.style.setProperty('--need', !locked && me.aether < cost ? (1 - me.aether / cost).toFixed(3) : 0);
      if (c.cost.textContent !== String(cost)) c.cost.textContent = cost;
      if (locked) this.setHtml(c.lock, `lock${c.s.id}`, `${I.lock}<span>W${c.s.unlock}</span>`);
      c.lock.style.display = locked ? 'grid' : 'none';
    }
    const wc = sim.workerCost(me);
    this.workerCard.querySelector('.cost b').textContent = wc;
    this.workerCard.querySelector('.cnt').textContent = `${me.workers}`;
    this.workerCard.classList.toggle('poor', me.gold < wc);
    this.workerCard.classList.toggle('off', me.workers >= ECON.maxWorkers);
    const k = sim.teams[me.team].king;
    this.healCard.querySelector('.cost b').textContent = k.healCd > 0 ? `${Math.ceil(k.healCd)}s` : `${k.heals}×`;
    this.healCard.style.setProperty('--cd', k.healCd > 0 ? (k.healCd / KING.healCd).toFixed(3) : 0);
    this.healCard.classList.toggle('off', k.heals <= 0 || k.hp >= k.maxHp);
    this.healCard.classList.toggle('poor', k.healCd > 0);
    for (const ku of this.kups) {
      const lv = k.levels[ku.k];
      const cost = kingUpgradeCost(ku.k, lv);
      const max = lv >= ku.u.max;
      const lvTxt = `Stufe ${lv} / ${ku.u.max}`;
      if (ku.lv.textContent !== lvTxt) { ku.lv.textContent = lvTxt; ku.bar.style.setProperty('--p', `${(lv / ku.u.max) * 100}%`); }
      this.setHtml(ku.c, `kup${ku.k}`, max ? 'Max' : `${I.aether}${cost}`);
      ku.el.classList.toggle('max', max);
      ku.el.classList.toggle('off', !max && me.aether < cost);
    }

    // Kampagnenziel
    if (this.camp) {
      const c = sim.teams[1].king;
      const left = sim.rules.maxWaves - sim.wave + (sim.phase === 'build' ? 1 : 0);
      const txt = this.camp.goal === 'siege'
        ? `${I.siege}<span>Ziel: Rissfeste zerstören · <b>${fmt(c.hp)}</b> Leben übrig · noch ${left} Welle${left === 1 ? '' : 'n'}</span>`
        : `${I.hold}<span>Ziel: bis Welle ${sim.rules.maxWaves} halten · noch <b>${left}</b> Welle${left === 1 ? '' : 'n'} · Rissfeste ${Math.round((c.hp / c.maxHp) * 100)} %</span>`;
      this.setHtml($('objective'), 'obj', txt);
    }
    // Bahnen
    for (const r of this.laneRows) {
      const v = sim.armyValue(r.p.id);
      const bad = (r.p.stats.leaksThisWave || 0) > 0;
      this.setHtml(r.lk, `lane${r.p.id}`, `<span>${fmt(v)}</span><span class="lkv">${I.leak}${r.p.stats.leaks}</span>`);
      r.lk.classList.toggle('bad', bad);
    }

    // Auswahl aktuell halten
    if (this.selected) {
      const ent = sim.entities.get(this.selected.id);
      if (!ent || (ent.type === 'c' && !ent.alive)) { this.setSelected(null); this.onSelect(null); }
      else { this.selected = ent; this.renderSelected(false); }
    }
    if ($('scoreboard').classList.contains('show')) this.renderScoreboard();
  }

  renderScoreboard() {
    const sim = this.session.sim;
    let team = -1;
    const rows = sim.players.slice().sort((a, b) => a.team - b.team || a.slot - b.slot).map((p) => {
      let sep = '';
      if (p.team !== team) { team = p.team; sep = `<tr class="sep t${team}"><td colspan="8">Team ${team === 0 ? 'West' : 'Ost'}</td></tr>`; }
      return `${sep}<tr class="t${p.team}${p.id === this.me.id ? ' me' : ''}"><td>${escapeHtml(p.name)}${p.bot ? ' <span class="muted">· Bot</span>' : ''}</td><td>${facName(p)}</td><td>${fmt(sim.armyValue(p.id))}</td><td>${p.income}</td><td>${p.workers}</td><td>${p.stats.sent}</td><td>${p.stats.kills}</td><td>${p.stats.leaks}</td></tr>`;
    }).join('');
    const html = `<h4>Punktetafel <small>Welle ${sim.wave} / ${sim.rules.maxWaves}</small></h4><table><tr><th>Spieler</th><th>Fraktion</th><th>Armeewert</th><th>Einkommen</th><th>Funken</th><th>Gesendet</th><th>Besiegt</th><th>Durchbrüche</th></tr>${rows}</table>`;
    this.setHtml($('scoreboard'), 'board', html);
  }
  showScoreboard(show) { $('scoreboard').classList.toggle('show', show); this.last.board = null; if (show) this.renderScoreboard(); }
}

function facName(p) { return p.faction === 'hybrid' ? 'Hybrid' : FACTIONS[p.faction].name; }

export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
