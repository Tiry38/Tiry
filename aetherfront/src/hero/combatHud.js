// Kampf-Oberfläche im Heldenblick (WoW-Prinzip, im Aetherforge-Stil):
// Spielerrahmen (Porträt, Leben, Ressource, Stufe/EP-Ring, Buffs) · Zielrahmen (Porträt, Leben, Zauberleiste, Debuffs)
// Aktionsleiste 1–5 (Symbole, Abklingkreis + Sekunden, GCD-Kreis, Reichweite rot, Ressource fehlt = grau)
// Zauberleiste mit Kanalisierungs-Ticks · Namensplaketten · Minikarte · Wellenfortschritt · Kampftext · Fehlertext.
import * as THREE from 'three';
import { HEROES, HERO_STATS as HS, abilityAt, abilityText } from '../sim/heroes.js';
import { LANE_WIDTH, LANE_SPAWN_Z, LANE_END_Z, BUILD_Z0, BUILD_Z1 } from '../sim/layout.js';
import { AI, I } from '../ui/icons.js';
import { comboLabel } from './keybinds.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.max(0, Math.round(n)).toLocaleString('de-DE');
const sec = (s) => (s >= 10 ? `${Math.ceil(s)}` : s >= 1 ? `${Math.ceil(s)}` : s.toFixed(1).replace('.', ','));
const _v = new THREE.Vector3();
const RES_COL = {
  wut: ['#ff6a5a', '#b81e2a'], fokus: ['#ffc46a', '#d07a1e'], energie: ['#fff07a', '#d0b21e'], mana: ['#6ab8ff', '#1e4ed0'],
  dampf: ['#9ff3ff', '#2a8ab8'], seelen: ['#d08aff', '#6a1eb8'],
};
const BUFF_ICON = { hot: 'herb', guard: 'wall', taunt: 'roar', self: 'haste', shield: 'ward' };
const BUFF_NAME = { hot: 'Regeneration', guard: 'Bollwerk', taunt: 'Herausforderung', self: 'Kampfrausch', shield: 'Schild' };

export class CombatHud {
  constructor({ settings, audio, portraits, heroPreview, getSession, heroes, view }) {
    Object.assign(this, { settings, audio, portraits, heroPreview, getSession, heroes, view });
    this.root = $('combat');
    this.plates = $('nameplates');
    this.ctLayer = $('ctext');
    this.errBox = $('herr');
    this.platePool = [];
    this.ctPool = [];
    this.ct = [];
    this.errors = [];
    this.visible = false;
    this.acc = 0;
    this.mmAcc = 0;
    this.slots = [];
    this.waveTotal = 0;
    this.last = {};
    this.castFx = null;
    this.target = 0;
    this.controls = null;
  }
  get session() { return this.getSession(); }

  // ------------------------------------------------------------ Aufbau
  build(session) {
    const sim = session.sim;
    const h = sim.heroOf(session.localPid);
    this.heroEnt = h ? h.id : 0;
    if (!h) return;
    const def = HEROES[h.heroId];
    this.def = def;
    const rc = RES_COL[def.resource] || RES_COL.mana;
    const r = this.root;
    r.style.setProperty('--hglow', def.palette.glow);
    r.style.setProperty('--res1', rc[0]); r.style.setProperty('--res2', rc[1]);
    const por = this.heroPreview ? this.heroPreview.portrait(def.id) : '';
    $('cf-player').innerHTML = `
      <div class="uf-por"><svg class="xp-ring" viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="46"/><circle class="xp" id="cf-xp" cx="50" cy="50" r="46"/></svg>
        <div class="uf-img">${por ? `<img src="${por}" alt=""/>` : ''}</div><b class="uf-lv" id="cf-lv">1</b></div>
      <div class="uf-body"><div class="uf-name"><span>${def.name}</span><small>${def.cls || def.roleLabel}</small></div>
        <div class="uf-bar hp"><i class="ghost" id="cf-hpg"></i><i class="fill" id="cf-hp"></i><i class="shield" id="cf-sh"></i><span id="cf-hpt"></span></div>
        <div class="uf-bar res"><i class="fill" id="cf-res"></i><span id="cf-rest"></span></div>
        <div class="uf-auras" id="cf-buffs"></div></div>`;
    $('cf-target').innerHTML = `
      <div class="uf-body"><div class="uf-name"><span id="ct-name"></span><small id="ct-tag"></small></div>
        <div class="uf-bar hp enemy"><i class="ghost" id="ct-hpg"></i><i class="fill" id="ct-hp"></i><span id="ct-hpt"></span></div>
        <div class="uf-cast" id="ct-cast"><i></i><span></span></div>
        <div class="uf-auras" id="ct-debuffs"></div></div>
      <div class="uf-por tgt"><div class="uf-img" id="ct-img"></div><b class="uf-lv elite" id="ct-lv"></b></div>`;
    // Aktionsleiste
    const bar = $('cb-bar');
    bar.innerHTML = '';
    this.slots = def.abilities.map((raw, i) => {
      const el = document.createElement('div');
      el.className = 'ab';
      el.dataset.slot = i;
      el.innerHTML = `<span class="ab-bg"></span><span class="ico">${AI[raw.icon] || AI.light}</span><i class="cd"></i><i class="gcd"></i><span class="ab-shine"></span><b class="cdt"></b><span class="kb"></span><span class="cost"></span>`;
      el.style.setProperty('--ic2', '#fff6dc');
      el.addEventListener('mouseenter', () => { this.tipSlot = i; this.renderTip(); });
      el.addEventListener('mouseleave', () => { this.tipSlot = -1; this.renderTip(); });
      el.addEventListener('mousedown', (e) => { if (e.button === 0) { e.stopPropagation(); this.controls?.useAbility(i); } });
      bar.appendChild(el);
      return { el, cdEl: el.querySelector('.cd'), gcdEl: el.querySelector('.gcd'), cdt: el.querySelector('.cdt'), kb: el.querySelector('.kb'), cost: el.querySelector('.cost'), st: {} };
    });
    this.refreshKeys();
    this.waveTotal = 0;
    this.last = {};
    this.lastHp = h.hp;
    this.ghostHp = 1; this.ghostT = 1;
    this.setTarget(0);
    $('cb-cast').className = 'castbar';
    for (const p of this.platePool) p.el.style.display = 'none';
  }

  refreshKeys() {
    const b = this.controls ? this.controls.binds : null;
    this.slots.forEach((s, i) => { s.kb.textContent = b ? comboLabel(b[`ability${i + 1}`][0], true) : `${i + 1}`; });
  }

  show(on) {
    this.visible = on;
    document.body.classList.toggle('hero-view', on);
    this.root.classList.toggle('show', on);
    if (!on) { for (const p of this.platePool) p.el.style.display = 'none'; this.tipSlot = -1; this.renderTip(); }
  }

  // ------------------------------------------------------------ Meldungen
  error(msg) {
    const now = performance.now();
    const ex = this.errors.find((e) => e.msg === msg);
    if (ex) { ex.t = now; ex.el.classList.remove('pop'); void ex.el.offsetWidth; ex.el.classList.add('pop'); return; }
    const el = document.createElement('div');
    el.className = 'herr-line pop';
    el.textContent = msg;
    this.errBox.prepend(el);
    this.errors.unshift({ msg, el, t: now });
    while (this.errors.length > 3) this.errors.pop().el.remove();
    this.audio?.ui('error');
  }

  setTarget(id) {
    this.target = id || 0;
    $('cf-target').classList.toggle('show', !!id);
    this.last.tgtKey = null;
  }

  /** Rückmeldungen der Steuerung (Tastendruck → Aktionsleiste leuchtet auf usw.) */
  feedback(kind, data) {
    if (kind === 'target') this.setTarget(data);
    else if (kind === 'auto') this.setTarget(data);
    else if (kind === 'cast' && this.slots[data]) { const el = this.slots[data].el; el.classList.remove('press'); void el.offsetWidth; el.classList.add('press'); }
    else if (kind === 'placing') this.slots.forEach((s, i) => s.el.classList.toggle('placing', i === data));
  }

  // ------------------------------------------------------------ Kampftext
  ctext(x, y, z, str, cls) {
    if (!this.ctLayer) return;
    let it = this.ctPool.pop();
    if (!it) { const el = document.createElement('div'); this.ctLayer.appendChild(el); it = { el }; }
    it.el.className = `ct ${cls}`;
    it.el.textContent = str;
    it.el.style.display = '';
    Object.assign(it, { x, y, z, t: 0, life: cls.includes('crit') ? 1.35 : 1.05, dx: (Math.random() - 0.5) * 70, cls });
    this.ct.push(it);
    if (this.ct.length > 50) this.recycle(0);
  }
  recycle(i) { const it = this.ct.splice(i, 1)[0]; it.el.style.display = 'none'; this.ctPool.push(it); }

  /** Dargestellte (ggf. verzögerte) Sim-Ereignisse */
  onEvent(e) {
    const s = this.session;
    if (!s) return;
    const pid = s.localPid;
    const myHero = this.heroEnt;
    switch (e.e) {
      case 'hit': {
        if (e.hero === pid) {
          const p = this.view.pos(e.id) || e;
          this.ctext(p.x, 2.3, p.z, e.crit ? `${fmt(e.dmg)}` : fmt(e.dmg), e.crit ? 'dmg crit' : 'dmg');
        } else if (e.id === myHero && this.visible) {
          const p = this.heroes.posOf(myHero) || e;
          this.ctext(p.x, 2.0, p.z, `-${fmt(e.dmg)}`, 'taken');
        }
        break;
      }
      case 'heal': {
        if (e.tgt === myHero && e.amount > 0) { const p = this.heroes.posOf(myHero) || e; this.ctext(p.x, 2.1, p.z, `+${fmt(e.amount)}`, 'healme'); }
        else if (e.src === myHero && e.amount > 0) this.ctext(e.x, 2.0, e.z, `+${fmt(e.amount)}`, 'heal');
        break;
      }
      case 'heroLevel': if (e.pid === pid) { this.audio?.sfx('upgrade', { volume: 0.8 }); this.last.lv = null; } break;
      case 'heroCast': if (e.pid === pid) this.castFx = null; break;
      case 'castCancel': if (e.pid === pid) this.castFail('Unterbrochen'); break;
      case 'heroAbility': if (e.pid === pid) { const c = $('cb-cast'); if (c.classList.contains('on')) { c.classList.add('done'); this.castFx = { t: performance.now(), kind: 'done' }; } } break;
      case 'waveStart': this.waveTotal = 0; break;
      default: break;
    }
  }
  castFail(msg) {
    const c = $('cb-cast');
    c.className = 'castbar on fail';
    c.querySelector('.cn').textContent = msg;
    this.castFx = { t: performance.now(), kind: 'fail' };
  }

  // ------------------------------------------------------------ Bild
  update(dt, ctx) {
    const s = this.session;
    if (!s || !this.visible) return;
    const sim = s.sim;
    const h = sim.entities.get(this.heroEnt);
    if (!h) return;
    const C = this.controls;
    this.acc += dt;
    // Ziel aus der Steuerung
    if (C && C.target !== this.target) this.setTarget(C.target);
    this.updateActionBar(h, C);
    this.updateCast(h);
    if (this.acc >= 0.066) { this.acc = 0; this.updateFrames(h, sim); this.updateWave(sim, s.localPid); }
    this.mmAcc += dt;
    if (this.mmAcc >= 0.05) { this.mmAcc = 0; this.drawMinimap(sim, s.localPid, ctx); }
    this.updatePlates(sim, s.localPid, ctx.camera);
    this.updateCtext(dt, ctx.camera);
    const now = performance.now();
    for (let i = this.errors.length - 1; i >= 0; i--) {
      const e = this.errors[i];
      const age = now - e.t;
      if (age > 2600) { e.el.remove(); this.errors.splice(i, 1); } else e.el.style.opacity = age > 1800 ? String(1 - (age - 1800) / 800) : '1';
    }
  }

  updateActionBar(h, C) {
    const def = this.def;
    const gcdMax = Math.max(HS.gcdMin, HS.gcd / (1 + h.buffs.reduce((a, b) => a + (b.haste || 0), 0)));
    this.slots.forEach((sl, i) => {
      const ab = abilityAt(def.abilities[i], h.level, i);
      const cdMax = ab.cd || 0;
      const cd = h.cds[i];
      const onGcd = ab.gcd && h.gcd > 0 && cd < h.gcd;
      const st = {
        cd: cd > 0.05 ? cd : 0, gcd: onGcd ? h.gcd / gcdMax : 0, nores: h.res < ab.cost, oor: C ? C.outOfRange(i) : false,
        ult: i === 4 && h.level >= HS.ultLevel, queued: !!(h.queued && h.queued.slot === i), dead: !h.alive,
        casting: !!(h.cast && h.cast.slot === i),
      };
      sl.cdEl.style.setProperty('--cd', cdMax > 0 && st.cd > 0 ? (st.cd / cdMax).toFixed(3) : '0');
      sl.gcdEl.style.setProperty('--cd', st.gcd.toFixed(3));
      const txt = st.cd > 0 ? sec(st.cd) : '';
      if (sl.st.txt !== txt) { sl.cdt.textContent = txt; sl.st.txt = txt; }
      const cls = `ab${st.cd > 0 ? ' oncd' : ''}${st.nores ? ' nores' : ''}${st.oor ? ' oor' : ''}${st.ult ? ' ult' : ''}${st.queued ? ' queued' : ''}${st.casting ? ' casting' : ''}${sl.el.classList.contains('placing') ? ' placing' : ''}${sl.el.classList.contains('press') ? ' press' : ''}${st.dead ? ' dead' : ''}`;
      if (sl.st.cls !== cls) { sl.el.className = cls; sl.st.cls = cls; }
      // Abklingzeit vorbei → Aufblitzen
      if (sl.st.wasCd && !(st.cd > 0)) { sl.el.classList.remove('flash'); void sl.el.offsetWidth; sl.el.classList.add('flash'); sl.st.cls = null; }
      sl.st.wasCd = st.cd > 0.4;
      const cost = ab.cost ? `${ab.cost}` : '';
      if (sl.st.cost !== cost) { sl.cost.textContent = cost; sl.st.cost = cost; }
    });
    if (this.tipSlot >= 0 && (this.last.tipLv !== h.level)) this.renderTip();
  }

  renderTip() {
    const tip = $('cb-tip');
    const i = this.tipSlot;
    if (!(i >= 0) || !this.def) { tip.classList.remove('show'); return; }
    const s = this.session;
    const h = s && s.sim.entities.get(this.heroEnt);
    const lv = h ? h.level : 1;
    this.last.tipLv = lv;
    const raw = this.def.abilities[i];
    const ab = abilityAt(raw, lv, i);
    const castTxt = ab.channel ? `Kanalisiert (${((ab.ticks || 1) * (ab.tick || 1)).toFixed(1).replace('.', ',')} s)` : ab.cast > 0 ? `${String(ab.cast).replace('.', ',')} s Zauberzeit` : 'Spontan';
    const rangeTxt = ab.range ? `${ab.range} m Reichweite` : ab.radius ? `${ab.radius} m Umkreis` : '';
    tip.innerHTML = `<div class="tt-h"><span class="tt-ico">${AI[raw.icon] || ''}</span><div><b>${ab.name}${ab.isUlt ? ' <em>Ultimate</em>' : ''}</b><small>Taste ${this.slots[i].kb.textContent}</small></div></div>
      <div class="tt-row"><span>${ab.cost ? `${ab.cost} ${this.def.resName}` : 'Keine Kosten'}</span><span>${rangeTxt}</span></div>
      <div class="tt-row"><span>${castTxt}</span><span>${ab.cd ? `${ab.cd} s Abklingzeit` : ab.gcd ? '' : 'Kein globaler Cooldown'}</span></div>
      <p>${abilityText(raw, lv, i)}</p>${i === 4 && raw.ult && lv < HS.ultLevel ? `<p class="tt-ult">Ab Stufe ${HS.ultLevel}: Ultimate – deutlich stärker.</p>` : ''}`;
    tip.classList.add('show');
  }

  updateCast(h) {
    const c = $('cb-cast');
    const now = performance.now();
    if (this.castFx && now - this.castFx.t < 520) return; // Erfolg/Abbruch kurz stehen lassen
    // Sim-Zauber oder lokal vorhergesagter Zauber
    let cast = null;
    if (h.cast) cast = { slot: h.cast.slot, t: h.cast.t, total: h.cast.total, channel: h.cast.channel };
    else { const lc = this.heroes.localCast(); if (lc) cast = lc; }
    if (!cast) { if (c.classList.contains('on') || this.castFx) { c.className = 'castbar'; this.castFx = null; } return; }
    const raw = this.def.abilities[cast.slot];
    const p = Math.max(0, Math.min(1, cast.t / Math.max(0.01, cast.total)));
    const key = `${cast.slot}|${cast.channel}`;
    if (this.last.castKey !== key || !c.classList.contains('on')) {
      this.last.castKey = key;
      c.className = `castbar on${cast.channel ? ' channel' : ''}`;
      c.querySelector('.cn').textContent = raw.name;
      c.querySelector('.ci').innerHTML = AI[raw.icon] || '';
      const ticks = c.querySelector('.ticks');
      ticks.innerHTML = '';
      if (cast.channel) { const n = raw.ticks || 1; for (let k = 1; k < n; k++) { const t = document.createElement('i'); t.style.left = `${(k / n) * 100}%`; ticks.appendChild(t); } }
    }
    c.style.setProperty('--p', (cast.channel ? 1 - p : p).toFixed(4));
    c.querySelector('.ct').textContent = `${Math.max(0, cast.total - cast.t).toFixed(1).replace('.', ',')} s`;
  }

  updateFrames(h, sim) {
    const def = this.def;
    // Spieler
    const hpP = h.alive ? h.hp / h.maxHp : 0;
    if (hpP < this.ghostHp) { if (this.ghostT <= 0) this.ghostT = 0.5; } else this.ghostHp = hpP;
    this.ghostT -= 0.066;
    if (this.ghostT <= 0) this.ghostHp += (hpP - this.ghostHp) * 0.25;
    $('cf-hp').style.width = `${(hpP * 100).toFixed(2)}%`;
    $('cf-hpg').style.width = `${(Math.max(hpP, this.ghostHp) * 100).toFixed(2)}%`;
    $('cf-sh').style.width = `${(Math.min(1, (h.shield || 0) / h.maxHp) * 100).toFixed(2)}%`;
    $('cf-sh').style.left = `${(Math.min(1, hpP) * 100).toFixed(2)}%`;
    this.setText('cf-hpt', `${fmt(h.hp)} / ${fmt(h.maxHp)}`);
    $('cf-res').style.width = `${((h.res / h.resMax) * 100).toFixed(2)}%`;
    this.setText('cf-rest', `${fmt(h.res)} ${def.resName}`);
    this.setText('cf-lv', `${h.level}`);
    const next = HS.xpForLevel[h.level] ?? HS.xpForLevel[HS.xpForLevel.length - 1];
    const prev = HS.xpForLevel[h.level - 1] ?? 0;
    const xpP = h.level >= HS.maxLevel ? 1 : (h.xp - prev) / Math.max(1, next - prev);
    $('cf-xp').style.strokeDashoffset = `${(289 * (1 - Math.max(0, Math.min(1, xpP)))).toFixed(1)}`;
    $('cf-player').classList.toggle('low', hpP < 0.3 && h.alive);
    $('cb-xp').style.setProperty('--p', `${(xpP * 100).toFixed(1)}%`);
    this.setText('cb-xpt', h.level >= HS.maxLevel ? `Stufe ${h.level} · Höchststufe` : `Stufe ${h.level} · ${fmt(h.xp - prev)} / ${fmt(next - prev)} EP`);
    // Buffs
    const buffs = [];
    for (const b of h.buffs) buffs.push({ icon: BUFF_ICON[b.kind] || 'haste', t: b.t, name: BUFF_NAME[b.kind] || 'Stärkung', good: true });
    if (h.shield > 0) buffs.push({ icon: 'ward', t: h.shieldT, name: 'Schild', good: true });
    if (h.stun > 0) buffs.push({ icon: 'stun', t: h.stun, name: 'Betäubt', good: false });
    if (h.slowPct > 0) buffs.push({ icon: 'slow', t: h.slowT, name: 'Verlangsamt', good: false });
    this.renderAuras('cf-buffs', buffs, 'pb');
    // Ziel
    const t = this.target && sim.entities.get(this.target);
    if (t && t.alive) {
      const d = t.def;
      const key = `${t.id}`;
      if (this.last.tgtKey !== key) {
        this.last.tgtKey = key;
        const tier = d.boss || d.champion ? 3 : d.id ? 2 : 1 + (d.n > 10 ? 1 : 0) + (d.n > 20 ? 1 : 0);
        const pal = d.champion ? { ...d.palette, glow: '#ffd23a', metal: '#e8b84a' } : d.palette;
        const img = this.portraits ? this.portraits.get(`c|${d.key || d.id || `w${d.n}`}`, d.model, pal, tier) : '';
        $('ct-img').innerHTML = img ? `<img src="${img}" alt=""/>` : '';
        this.setText('ct-name', d.name);
        const tag = d.boss ? 'Boss' : d.leader ? 'Anführer' : d.champion ? 'Champion' : t.isSend ? 'Söldner' : 'Rissbrut';
        this.setText('ct-tag', tag);
        $('ct-lv').textContent = d.boss ? '☠' : d.champion || d.leader ? '◆' : `${sim.wave}`;
        $('cf-target').className = `uf target show${d.boss ? ' boss' : d.champion || d.leader ? ' elite' : ''}`;
        this.tHp = t.hp / t.maxHp; this.tGhost = this.tHp;
      }
      const p = t.hp / t.maxHp;
      this.tGhost = Math.max(p, this.tGhost - 0.03);
      $('ct-hp').style.width = `${(p * 100).toFixed(2)}%`;
      $('ct-hpg').style.width = `${(this.tGhost * 100).toFixed(2)}%`;
      this.setText('ct-hpt', `${fmt(t.hp)} · ${Math.ceil(p * 100)} %`);
      const deb = [];
      if (t.stun > 0) deb.push({ icon: 'stun', t: t.stun, name: 'Betäubt' });
      if (t.rootT > 0) deb.push({ icon: 'root', t: t.rootT, name: 'Festgehalten' });
      if (t.slowPct > 0) deb.push({ icon: 'slow', t: t.slowT, name: 'Verlangsamt' });
      if (t.cursePct > 0) deb.push({ icon: 'mark', t: t.curseT, name: 'Markiert' });
      if (t.fearT > 0) deb.push({ icon: 'fear', t: t.fearT, name: 'Furcht' });
      if (t.dots && t.dots.length) deb.push({ icon: 'bleed', t: t.dots[0].left * t.dots[0].every, name: 'Blutung' });
      this.renderAuras('ct-debuffs', deb, 'db');
      const tc = $('ct-cast');
      const aggro = t.target === h.id;
      tc.classList.toggle('show', aggro);
      if (aggro) tc.querySelector('span').textContent = 'Greift dich an';
    } else if (this.target) { this.setTarget(0); }
  }

  renderAuras(id, list, kind) {
    const key = list.map((b) => `${b.icon}${Math.ceil(b.t)}`).join(',');
    if (this.last[id] === key) return;
    this.last[id] = key;
    $(id).innerHTML = list.slice(0, 8).map((b) => `<span class="aura ${kind}${b.good === false ? ' bad' : ''}" title="${b.name}">${AI[b.icon] || ''}<b>${b.t > 0 && b.t < 99 ? Math.ceil(b.t) : ''}</b></span>`).join('');
  }

  setText(id, v) { if (this.last['t' + id] === v) return; this.last['t' + id] = v; $(id).textContent = v; }

  updateWave(sim, pid) {
    let n = 0;
    for (const e of sim.entities.values()) if (e.type === 'c' && e.alive && e.lane === pid && e.stage === 'lane') n++;
    if (n > this.waveTotal) this.waveTotal = n;
    const w = sim.waveDef(sim.wave);
    const key = `${sim.wave}|${n}|${this.waveTotal}|${Math.floor(sim.battleTime)}`;
    if (this.last.wave === key) return;
    this.last.wave = key;
    const t = sim.battleTime;
    $('cw-title').innerHTML = `<b>Welle ${sim.wave}</b><span>${w.name}</span>`;
    $('cw-count').textContent = n ? `${n} ${n === 1 ? 'Gegner' : 'Gegner'} in deiner Bahn` : 'Bahn gesäubert';
    $('cw-time').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    $('cw-bar').style.setProperty('--p', this.waveTotal ? `${((1 - n / this.waveTotal) * 100).toFixed(1)}%` : '0%');
    $('cf-wave').classList.toggle('boss', !!w.boss);
  }

  // ------------------------------------------------------------ Minikarte
  drawMinimap(sim, pid, ctx) {
    const cv = $('mm-canvas');
    if (!cv) return;
    const W = cv.width, H = cv.height;
    const g = cv.getContext('2d');
    const lx = sim.laneX(pid);
    const me = this.heroes.posOf(this.heroEnt) || sim.entities.get(this.heroEnt);
    const cx = me ? me.x : lx, cz = me ? me.z : 0;
    const scale = (W / 2) / 34; // 34 m Radius
    const X = (x) => W / 2 + (x - cx) * scale, Y = (z) => H / 2 + (z - cz) * scale;
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
    const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
    bg.addColorStop(0, '#1d2a2a'); bg.addColorStop(1, '#090c14');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // Nachbarbahnen schwach, eigene Bahn kräftig
    for (const p of sim.players) {
      const x = sim.laneX(p.id);
      if (Math.abs(x - cx) > 60) continue;
      const own = p.id === pid;
      g.fillStyle = own ? 'rgba(214, 196, 150, 0.20)' : 'rgba(214, 196, 150, 0.07)';
      g.fillRect(X(x - LANE_WIDTH / 2), Y(LANE_SPAWN_Z - 6), LANE_WIDTH * scale, (LANE_END_Z - LANE_SPAWN_Z + 8) * scale);
      if (own) {
        g.strokeStyle = 'rgba(232, 196, 122, 0.75)'; g.lineWidth = 1.5;
        g.strokeRect(X(x - LANE_WIDTH / 2), Y(LANE_SPAWN_Z - 6), LANE_WIDTH * scale, (LANE_END_Z - LANE_SPAWN_Z + 8) * scale);
        g.fillStyle = 'rgba(111, 227, 255, 0.10)';
        g.fillRect(X(x - 6), Y(BUILD_Z0), 12 * scale, (BUILD_Z1 - BUILD_Z0) * scale);
        // Portal
        g.fillStyle = '#c06bff'; g.beginPath(); g.arc(X(x), Y(LANE_SPAWN_Z - 4), 5, 0, Math.PI * 2); g.fill();
        // Weg zum König
        g.strokeStyle = 'rgba(232, 196, 122, 0.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(x), Y(LANE_END_Z)); g.lineTo(X(x), Y(LANE_END_Z + 30)); g.stroke(); g.setLineDash([]);
      }
    }
    const dot = (x, z, r, c, ring) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(z), r, 0, Math.PI * 2); g.fill(); if (ring) { g.strokeStyle = ring; g.lineWidth = 1.2; g.stroke(); } };
    for (const e of sim.entities.values()) {
      if (!e.alive || Math.abs(e.x - cx) > 40 || Math.abs(e.z - cz) > 40) continue;
      if (e.type === 'f') dot(e.x, e.z, 2.4, e.owner === pid ? '#74f0a6' : '#5aa2ff');
      else if (e.type === 'c') dot(e.x, e.z, e.def.boss ? 5 : e.def.champion || e.def.leader ? 3.6 : 2.6, e.def.boss ? '#ff3a4a' : e.def.champion || e.def.leader ? '#ffc83a' : '#ff5a5a', e.id === this.target ? '#fff' : null);
      else if (e.type === 'h' && e.id !== this.heroEnt) dot(e.x, e.z, 3.6, e.team === sim.players[pid].team ? '#6fc8ff' : '#ff7a8a', '#0a0c14');
    }
    // eigener Held: Pfeil in Blickrichtung
    if (me) {
      const f = this.controls && this.controls.enabled ? this.controls.yaw : (sim.entities.get(this.heroEnt)?.face ?? Math.PI);
      g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI - f);
      g.fillStyle = '#ffd27a'; g.strokeStyle = '#1a1206'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
      g.restore();
      // Kamera-Sichtkegel
      if (ctx.camYaw != null) {
        g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI - ctx.camYaw);
        const gr = g.createLinearGradient(0, 0, 0, -60); gr.addColorStop(0, 'rgba(255,240,200,0.18)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -60); g.lineTo(34, -60); g.closePath(); g.fill(); g.restore();
      }
    }
    g.restore();
    // König
    const k = sim.teams[sim.players[pid].team].king;
    const kp = k.hp / k.maxHp;
    $('mm-king').style.setProperty('--p', `${(kp * 100).toFixed(1)}%`);
    this.setText('mm-kingt', `${Math.ceil(kp * 100)} %`);
    $('mm-king').classList.toggle('low', kp < 0.35);
  }

  // ------------------------------------------------------------ Namensplaketten
  updatePlates(sim, pid, camera) {
    if (!this.plates) return;
    let n = 0;
    const W = innerWidth, H = innerHeight;
    const list = [];
    for (const e of sim.entities.values()) {
      if (e.type !== 'c' || !e.alive || e.lane !== pid || e.stage !== 'lane') continue;
      const d = this.view.pos(e.id);
      if (!d) continue;
      const dist = camera.position.distanceTo(_v.set(d.x, 1, d.z));
      if (dist > 48) continue;
      const hgt = (d.height || 2) * 1.2 * (e.def.size || 1) + 0.45;
      _v.set(d.x, hgt, d.z).project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
      list.push({ e, sx: (_v.x * 0.5 + 0.5) * W, sy: (-_v.y * 0.5 + 0.5) * H, dist });
    }
    list.sort((a, b) => b.dist - a.dist); // ferne zuerst (nahe liegen oben)
    for (const it of list) {
      if (n >= 40) break;
      let p = this.platePool[n];
      if (!p) {
        const el = document.createElement('div');
        el.className = 'np';
        el.innerHTML = '<span class="nm"></span><i class="bar"><i class="g"></i><i class="f"></i></i>';
        this.plates.appendChild(el);
        p = this.platePool[n] = { el, nm: el.querySelector('.nm'), f: el.querySelector('.f'), g: el.querySelector('.g'), st: {} };
      }
      n++;
      const e = it.e, d = e.def;
      const tgt = e.id === this.target;
      const aggro = e.target === this.heroEnt;
      const rank = d.boss ? 'boss' : d.champion || d.leader ? 'elite' : 'norm';
      const cls = `np ${rank}${tgt ? ' tgt' : ''}${aggro ? ' aggro' : ''}${e.isSend ? ' send' : ''}`;
      if (p.st.cls !== cls) { p.el.className = cls; p.st.cls = cls; }
      const nm = tgt || rank !== 'norm' ? d.name : '';
      if (p.st.nm !== nm) { p.nm.textContent = nm; p.st.nm = nm; }
      const hp = e.hp / e.maxHp;
      p.f.style.width = `${(hp * 100).toFixed(1)}%`;
      p.st.ghost = p.st.id === e.id ? Math.max(hp, (p.st.ghost ?? hp) - 0.02) : hp;
      p.st.id = e.id;
      p.g.style.width = `${(p.st.ghost * 100).toFixed(1)}%`;
      const sc = Math.max(0.62, Math.min(1.12, 14 / Math.max(6, it.dist) + 0.5)) * (tgt ? 1.12 : 1);
      p.el.style.transform = `translate(${it.sx.toFixed(1)}px, ${it.sy.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
      p.el.style.display = '';
      p.el.style.zIndex = tgt ? 50 : Math.round(40 - it.dist);
    }
    for (let i = n; i < this.platePool.length; i++) { const p = this.platePool[i]; if (p.el.style.display !== 'none') p.el.style.display = 'none'; }
  }

  updateCtext(dt, camera) {
    const W = innerWidth, H = innerHeight;
    for (let i = this.ct.length - 1; i >= 0; i--) {
      const it = this.ct[i];
      it.t += dt;
      if (it.t >= it.life) { this.recycle(i); continue; }
      _v.set(it.x, it.y, it.z).project(camera);
      if (_v.z > 1) { it.el.style.opacity = '0'; continue; }
      const a = it.t / it.life;
      const crit = it.cls.includes('crit');
      const rise = it.cls.includes('taken') ? -a * 40 : a * 70;
      const sc = crit ? (a < 0.12 ? 0.6 + a * 9 : a < 0.25 ? 1.68 - (a - 0.12) * 4 : 1.15) : (a < 0.1 ? 0.7 + a * 3 : 1);
      const x = (_v.x * 0.5 + 0.5) * W + it.dx * Math.min(1, a * 2.2) * (it.cls.includes('dmg') ? 1 : 0.4);
      const y = (-_v.y * 0.5 + 0.5) * H - rise;
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
      it.el.style.opacity = a > 0.72 ? String((1 - a) / 0.28) : '1';
    }
  }

  clear() {
    for (const it of this.ct) { it.el.style.display = 'none'; this.ctPool.push(it); }
    this.ct.length = 0;
    for (const p of this.platePool) p.el.style.display = 'none';
    for (const e of this.errors) e.el.remove();
    this.errors.length = 0;
  }
}
