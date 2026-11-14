// Spiel-Oberfläche (HUD): Ressourcen, Phase/Timer, Könige, Bau-Leiste, Söldner, Wirtschaft,
// Auswahlkarte, König-Verbesserungen, Punktetafel, Meldungen, Banner, Tooltips.
import { UNITS, SENDS, KING, ECON, FACTIONS, ATTACK_TYPES, ARMOR_TYPES, WAVES, factionUnits, kingUpgradeCost } from '../sim/data.js';
import { TEAM_COLORS } from '../render/units.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('de-DE');
const ICON = {
  gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="#5a3200" stroke-width="2"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" stroke="#5a3200" stroke-width="1.6" fill="none"/></svg>',
  aether: '<svg viewBox="0 0 24 24"><path d="M12 3l5 9-5 9-5-9z" fill="none" stroke="#06305a" stroke-width="2"/><path d="M12 7l2.6 5L12 17l-2.6-5z" fill="#06305a"/></svg>',
  income: '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 4 3 7-8" fill="none" stroke="#063a1a" stroke-width="2.4" stroke-linecap="round"/><path d="M15 7h5v5" fill="none" stroke="#063a1a" stroke-width="2.4" stroke-linecap="round"/></svg>',
  value: '<svg viewBox="0 0 24 24"><path d="M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z" fill="none" stroke="#2a0a4a" stroke-width="2"/></svg>',
};

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

function ringSvg(ratio, color, size = 52, stroke = 5) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,0.12)" stroke-width="${stroke}" fill="none"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, ratio)))}" style="filter:drop-shadow(0 0 6px ${color})"/></svg>`;
}

export class Hud {
  constructor({ portraits, submit, onPlace, onSelect, onFocusLane, onFocusKing, audio, settings }) {
    this.portraits = portraits;
    this.submit = submit;
    this.onPlace = onPlace;
    this.onSelect = onSelect;
    this.onFocusLane = onFocusLane;
    this.onFocusKing = onFocusKing;
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

  build(session) {
    this.session = session;
    const sim = session.sim;
    const me = sim.players[session.localPid];
    this.me = me;
    const fac = FACTIONS[me.faction];
    // Ressourcen
    const rr = $('res-row');
    rr.innerHTML = '';
    for (const [k, label] of [['gold', 'Gold'], ['aether', 'Äther'], ['income', 'Einkommen'], ['value', 'Armeewert']]) {
      const el = h('div', `res ${k} pe`, `<div class="ic">${ICON[k]}</div><div><div class="v" id="r-${k}">0</div><div class="s" id="r-${k}-s">${label}</div></div>`);
      el.addEventListener('mouseenter', () => this.tip(el, this.resTip(k)));
      el.addEventListener('mouseleave', () => this.tip(null));
      rr.appendChild(el);
    }
    // Könige
    const ks = $('kings');
    ks.innerHTML = '';
    for (const t of [0, 1]) {
      const el = h('div', 'king', `<div class="ring" id="k-ring-${t}"></div><div class="meta"><b>${t === me.team ? 'Dein König' : 'Feindkönig'}</b><small id="k-meta-${t}"></small></div>`);
      el.addEventListener('click', () => this.onFocusKing(t));
      ks.appendChild(el);
    }
    // Bau-Leiste
    const bd = $('build-dock');
    bd.innerHTML = '';
    this.buildCards = factionUnits(me.faction).map((u) => {
      const c = h('div', 'card', `<span class="hk">${u.hotkey}</span><img src="${this.unitPortrait(u)}" alt=""/><span class="cost g">${u.cost}</span>`);
      c.style.setProperty('--cbg', `radial-gradient(circle at 50% 30%, ${fac.grad[0]}55, ${fac.grad[2]}33 70%)`);
      c.addEventListener('click', () => { this.audio.ui('click'); this.onPlace(u); });
      c.addEventListener('mouseenter', () => { this.audio.ui('hover'); this.tip(c, this.unitTip(u)); });
      c.addEventListener('mouseleave', () => this.tip(null));
      bd.appendChild(c);
      return { u, el: c };
    });
    // Söldner
    const sd = $('send-dock');
    sd.innerHTML = '';
    this.sendCards = SENDS.map((s) => {
      const c = h('div', 'card sm', `<span class="hk">${s.hotkey}</span><img src="${this.sendPortrait(s)}" alt=""/><span class="cost a">${s.cost}</span><div class="lock" style="display:none"></div>`);
      c.style.setProperty('--cbg', 'radial-gradient(circle at 50% 30%, rgba(255,58,138,0.35), rgba(60,10,40,0.6) 70%)');
      c.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'send', send: s.id }); });
      c.addEventListener('mouseenter', () => { this.audio.ui('hover'); this.tip(c, this.sendTip(s)); });
      c.addEventListener('mouseleave', () => this.tip(null));
      sd.appendChild(c);
      return { s, el: c };
    });
    // Wirtschaft & König
    const ed = $('eco-dock');
    ed.innerHTML = '';
    const mk = (ico, hk, costCls, onClick, tipFn) => {
      const c = h('div', 'card sm action', `<span class="hk">${hk}</span><span class="ico">${ico}</span><span class="cost ${costCls}"></span>`);
      c.addEventListener('click', () => { this.audio.ui('click'); onClick(); });
      c.addEventListener('mouseenter', () => { this.audio.ui('hover'); this.tip(c, tipFn()); });
      c.addEventListener('mouseleave', () => this.tip(null));
      ed.appendChild(c);
      return c;
    };
    this.workerCard = mk('✦', 'B', 'g', () => this.submit({ type: 'worker' }), () => `<h5>Äther-Funke anwerben</h5>Ein Arbeiter sammelt ${ECON.workerRate} Äther pro Sekunde. Äther brauchst du für Söldner und den König.<br><span class="muted">Aktuell: ${this.me.workers} Funken</span>`);
    this.kingCard = mk('♛', 'K', 'a', () => this.toggleKingPanel(), () => '<h5>Königshalle</h5>Verbessere deinen König mit Äther: Leben, Angriffskraft, Erneuerung. Die Verbesserungen gelten für das ganze Team.');
    this.healCard = mk('✚', 'H', 'a', () => this.submit({ type: 'heal' }), () => `<h5>König heilen</h5>Stellt sofort ${Math.round(KING.healPct * 100)} % Leben wieder her. Das Team hat nur ${KING.heals} Heilungen pro Partie (Abklingzeit ${KING.healCd}s).`);
    this.kingCard.querySelector('.cost').textContent = 'Halle';
    // König-Panel
    this.buildKingPanel();
    // Bahnen
    const ln = $('lanes');
    ln.innerHTML = '';
    this.laneRows = sim.players.slice().sort((a, b) => a.team - b.team || a.slot - b.slot).map((p) => {
      const t1 = factionUnits(p.faction)[0];
      const el = h('div', `lane-btn${p.id === me.id ? ' me' : ''}`, `<div class="dot" style="background-image:url(${this.unitPortrait(t1)});box-shadow:0 0 0 2px ${TEAM_COLORS[p.team]}"></div><span class="nm">${escapeHtml(p.name)}</span><span class="lk"></span>`);
      el.addEventListener('click', () => { this.audio.ui('click'); this.onFocusLane(p.id); });
      el.addEventListener('mouseenter', () => this.tip(el, `<h5>${escapeHtml(p.name)}</h5>${FACTIONS[p.faction].name}${p.randomed ? ' (Zufall)' : ''} · Team ${p.team === 0 ? 'West' : 'Ost'}<br><span class="muted">Klicken: Kamera zur Bahn</span>`));
      el.addEventListener('mouseleave', () => this.tip(null));
      ln.appendChild(el);
      return { p, el, lk: el.querySelector('.lk') };
    });
    $('feed').innerHTML = '';
    this.setSelected(null);
    this.refresh(true);
  }

  buildKingPanel() {
    const kp = $('king-panel');
    kp.innerHTML = '<h4>Königshalle</h4>';
    this.kups = Object.entries(KING.upgrades).map(([k, u]) => {
      const el = h('div', 'kup', `<div class="t"><b>${u.name}</b><small>${u.desc}</small></div><span class="lv"></span><span class="c"></span>`);
      el.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'king', up: k }); });
      kp.appendChild(el);
      return { k, u, el };
    });
  }
  toggleKingPanel(force) {
    const kp = $('king-panel');
    const show = force ?? !kp.classList.contains('show');
    kp.classList.toggle('show', show);
    this.audio.ui(show ? 'open' : 'close');
  }

  resTip(k) {
    const p = this.me;
    if (k === 'gold') return `<h5>Gold</h5>Für Kämpfer, Aufwertungen und Arbeiter. Du erhältst Kopfgeld für jeden besiegten Gegner und nach jeder Welle dein Einkommen (+${p.income}).`;
    if (k === 'aether') return `<h5>Äther</h5>Sammeln deine Funken (${p.workers} × ${ECON.workerRate}/s). Damit schickst du Söldner zum Gegner und verbesserst den König.`;
    if (k === 'income') return '<h5>Einkommen</h5>Gold, das du nach jeder Welle bekommst. Jeder gesendete Söldner erhöht es dauerhaft.';
    return '<h5>Armeewert</h5>Gesamtwert deiner Kämpfer (inkl. Aufwertungen).';
  }
  unitTip(u) {
    const chain = [u];
    while (chain[chain.length - 1].upgradeTo) chain.push(UNITS[chain[chain.length - 1].upgradeTo]);
    return `<h5>${u.name} <span class="muted">· ${u.roleLabel}</span></h5>` +
      `<div class="stats"><span class="chip">❤ <b>${u.hp}</b></span><span class="chip">⚔ <b>${u.dmg}</b> / ${u.cd}s</span><span class="chip">${ATTACK_TYPES[u.atk].name}</span><span class="chip">🛡 ${ARMOR_TYPES[u.armorType].name} ${u.armor}</span><span class="chip">↔ ${u.range}</span></div>` +
      `${abilityText(u.abil).map((a) => `<div class="abil">◆ ${a}</div>`).join('')}` +
      `<div class="muted" style="margin-top:6px">Aufwertung: ${chain.map((c) => c.name).join(' → ')}</div>`;
  }
  sendTip(s) {
    return `<h5>${s.name} <span class="muted">· Söldner</span></h5>Läuft mit der nächsten Welle in die Bahn deines Gegners.<br>` +
      `<div class="stats"><span class="chip">❤ <b>${s.hp}</b></span><span class="chip">⚔ <b>${s.dmg}</b></span><span class="chip">${ATTACK_TYPES[s.atk].name}</span><span class="chip">🛡 ${ARMOR_TYPES[s.armorType].name}</span></div>` +
      `<div style="margin-top:6px">Kosten <b style="color:var(--aether)">${s.cost} Äther</b> · Einkommen <b style="color:var(--good)">+${s.income}</b></div>` +
      (this.session.sim.wave < s.unlock ? `<div class="muted">Verfügbar ab Welle ${s.unlock}</div>` : '');
  }

  tip(anchor, html) {
    const t = $('tooltip');
    if (!anchor) { t.classList.remove('show'); this.tipFor = null; return; }
    t.innerHTML = html;
    t.classList.add('show');
    const r = anchor.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 14;
    if (y < 8) y = r.bottom + 14;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    t.style.left = `${x}px`; t.style.top = `${y}px`;
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
    const por = isF ? this.unitPortrait(def) : this.portraits.get(`c|${def.id || `w${def.n}`}`, def.model, def.palette, def.boss ? 3 : 2);
    const next = isF && def.upgradeTo ? UNITS[def.upgradeTo] : null;
    const refund = isF ? (e.fresh ? def.value : Math.floor(def.value * ECON.sellRefund)) : 0;
    const build = sim.phase === 'build';
    card.innerHTML = `<div class="por"><img src="${por}" alt=""/></div><div class="info">
      <div class="nm">${def.name} ${isF ? `<span class="stars">${'★'.repeat(def.tier)}</span>` : ''}</div>
      <div class="sub">${isF ? `${FACTIONS[def.faction].name} · ${def.roleLabel} · Wert ${def.value}` : (e.isSend ? 'Söldner' : `Welle ${def.n}`)}${isF && !own ? ` · ${escapeHtml(sim.players[e.owner].name)}` : ''}</div>
      <div class="stats"><span class="chip">❤ <b>${fmt(e.hp)}</b>/${fmt(e.maxHp)}</span><span class="chip">⚔ <b>${def.dmg}</b> / ${def.cd}s</span><span class="chip">${ATTACK_TYPES[def.atk].name}</span><span class="chip">🛡 ${ARMOR_TYPES[def.armorType].name} ${def.armor}</span></div>
      ${isF ? abilityText(def.abil).map((a) => `<div class="abil">◆ ${a}</div>`).join('') : ''}
      ${own ? `<div class="sel-actions">
        ${next ? `<button class="pill primary" id="sel-up" ${!build || this.me.gold < next.cost ? 'disabled' : ''}>Aufwerten → ${next.name} · ${next.cost} <span class="key">U</span></button>` : '<span class="chip">Höchste Stufe</span>'}
        <button class="pill" id="sel-sell" ${!build ? 'disabled' : ''}>Verkaufen +${refund} <span class="key">X</span></button></div>` : ''}
    </div>`;
    const up = card.querySelector('#sel-up');
    if (up) {
      up.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'upgrade', id: e.id }); });
      up.addEventListener('mouseenter', () => this.tip(up, this.unitTip(next)));
      up.addEventListener('mouseleave', () => this.tip(null));
    }
    const sell = card.querySelector('#sel-sell');
    if (sell) sell.addEventListener('click', () => { this.audio.ui('click'); this.submit({ type: 'sell', id: e.id }); });
  }

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 1600);
  }
  feed(msg, cls = '') {
    const f = $('feed');
    const m = h('div', `msg ${cls}`, msg);
    f.appendChild(m);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => { m.classList.add('out'); setTimeout(() => m.remove(), 500); }, 6500);
  }
  banner(title, sub, boss = false) {
    const b = $('banner');
    b.className = 'banner';
    b.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div>`;
    void b.offsetWidth;
    b.className = `banner show${boss ? ' boss' : ''}`;
  }

  onEvent(e) {
    const sim = this.session.sim;
    const me = this.me;
    switch (e.e) {
      case 'error': if (e.pid === me.id) { this.toast(e.reason); this.audio.ui('error'); } break;
      case 'waveStart': {
        const w = WAVES[e.wave - 1];
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
        else if (e.pid === me.id) this.feed(`${s.name} geschickt · Einkommen +${s.income}`, 'good');
        break;
      }
      case 'king': if (sim.players[e.pid].team === me.team) this.feed(`${escapeHtml(sim.players[e.pid].name)}: ${KING.upgrades[e.up].name} Stufe ${e.level}`, 'good'); break;
      case 'kingHeal': if (e.team === me.team) this.feed(`König geheilt (+${fmt(e.amount)})`, 'good'); break;
      case 'kingHit': if (e.team === me.team) { const k = $('kings').children[e.team]; if (k && !k.classList.contains('hurt')) { k.classList.add('hurt'); setTimeout(() => k.classList.remove('hurt'), 400); } } break;
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
    this.setValue('r-gold-s', `Gold · +${me.income}/Welle`);
    this.setValue('r-aether', me.aether);
    this.setValue('r-aether-s', `Äther · ${me.workers} Funken`);
    this.setValue('r-income', me.income);
    this.setValue('r-value', sim.armyValue(me.id));
    this.ready = true;

    // Phase
    const w = WAVES[sim.wave - 1];
    const ph = $('phase');
    const tleft = Math.max(0, Math.ceil(sim.phaseTime));
    const total = sim.wave === 1 ? ECON.buildTimeFirst : ECON.buildTime;
    const key = `${sim.wave}|${sim.phase}|${build ? tleft : Math.floor(sim.battleTime)}|${me.ready}`;
    if (key !== this.phaseKey) {
      this.phaseKey = key;
      ph.innerHTML = `<div class="wave"><b>Welle ${sim.wave} / ${ECON.maxWaves}</b><small>${w ? w.name : ''}${w && w.boss ? ' · BOSS' : ''}${w ? ` · ${w.count}× · 🛡 ${ARMOR_TYPES[w.armorType].name} · ⚔ ${ATTACK_TYPES[w.atk].name}${w.ranged ? ' (Fernkampf)' : ''}` : ''}</small></div>
        <span class="tag ${build ? 'build' : 'battle'}">${build ? 'Bauphase' : sim.phase === 'over' ? 'Ende' : 'Kampf'}</span>
        <div class="timer">${build ? ringSvg(tleft / total, '#7ae8ff', 54, 4) : ringSvg(1, '#ff5a6a', 54, 4)}<span>${build ? tleft : '⚔'}</span></div>
        ${build && !me.ready ? '<button class="pill primary ready" id="btn-ready">Bereit <span class="key">↵</span></button>' : ''}`;
      const rb = ph.querySelector('#btn-ready');
      if (rb) rb.addEventListener('click', () => { this.audio.ui('confirm'); this.submit({ type: 'ready' }); });
    }

    // Könige
    for (const t of [0, 1]) {
      const k = sim.teams[t].king;
      const ratio = k.hp / k.maxHp;
      const kk = `${Math.round(ratio * 100)}|${k.heals}`;
      if (this.last[`king${t}`] !== kk) {
        this.last[`king${t}`] = kk;
        $(`k-ring-${t}`).innerHTML = `${ringSvg(ratio, TEAM_COLORS[t])}<span>${Math.round(ratio * 100)}%</span>`;
        $(`k-meta-${t}`).textContent = `${fmt(k.hp)} Leben · ${k.heals} Heilungen`;
      }
    }

    // Karten
    for (const c of this.buildCards) c.el.classList.toggle('off', !build || me.gold < c.u.cost);
    for (const c of this.sendCards) {
      const locked = sim.wave < c.s.unlock;
      c.el.classList.toggle('off', locked || me.aether < c.s.cost);
      const l = c.el.querySelector('.lock');
      l.style.display = locked ? 'grid' : 'none';
      if (locked) l.textContent = `ab W${c.s.unlock}`;
    }
    const wc = sim.workerCost(me);
    this.workerCard.querySelector('.cost').textContent = `${wc} · ${me.workers}`;
    this.workerCard.classList.toggle('off', me.gold < wc || me.workers >= ECON.maxWorkers);
    const k = sim.teams[me.team].king;
    this.healCard.querySelector('.cost').textContent = k.healCd > 0 ? `${Math.ceil(k.healCd)}s` : `${k.heals}×`;
    this.healCard.classList.toggle('off', k.heals <= 0 || k.healCd > 0 || k.hp >= k.maxHp);
    for (const ku of this.kups) {
      const lv = k.levels[ku.k];
      const cost = kingUpgradeCost(ku.k, lv);
      ku.el.querySelector('.lv').textContent = `Stufe ${lv}/${ku.u.max}`;
      ku.el.querySelector('.c').textContent = lv >= ku.u.max ? 'max' : `${cost} Ä`;
      ku.el.classList.toggle('off', lv >= ku.u.max || me.aether < cost);
    }

    // Bahnen
    for (const r of this.laneRows) {
      const v = sim.armyValue(r.p.id);
      r.lk.textContent = `${fmt(v)} · ${r.p.stats.leaks} ⇣`;
      r.lk.classList.toggle('bad', (r.p.stats.leaksThisWave || 0) > 0);
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
    const rows = sim.players.slice().sort((a, b) => a.team - b.team || a.slot - b.slot).map((p) =>
      `<tr class="t${p.team}${p.id === this.me.id ? ' me' : ''}"><td>${escapeHtml(p.name)}${p.bot ? ' <span class="muted">(Bot)</span>' : ''}</td><td>${FACTIONS[p.faction].name}</td><td>${fmt(sim.armyValue(p.id))}</td><td>${p.income}</td><td>${p.workers}</td><td>${p.stats.sent}</td><td>${p.stats.kills}</td><td>${p.stats.leaks}</td></tr>`).join('');
    $('scoreboard').innerHTML = `<table><tr><th>Spieler</th><th>Fraktion</th><th>Armeewert</th><th>Einkommen</th><th>Funken</th><th>Gesendet</th><th>Besiegt</th><th>Durchbrüche</th></tr>${rows}</table>`;
  }
  showScoreboard(show) { $('scoreboard').classList.toggle('show', show); if (show) this.renderScoreboard(); }
}

export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
