// Sammlung: Profil (Stufe, Titel), Völker mit Meisterschaft, Bannern & Aufwertungs-Bäumen,
// Erfolge, tägliche/wöchentliche Herausforderungen, Wochen-Modifikator, Endlos-Bestenliste.
import { FACTIONS, FACTION_IDS, UNITS, ATTACK_TYPES, ARMOR_TYPES, factionUnits } from '../sim/data.js';
import { ACHIEVEMENTS, SKINS, ACCOUNT_XP, MASTERY_XP, TITLES, weeklyModifier } from '../meta/profile.js';
import { I } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bar = (p) => `<div class="col-bar"><i style="width:${Math.max(0, Math.min(100, Math.round(p * 100)))}%"></i></div>`;

export class Collection {
  constructor(root, { profile, portraits, audio, onBack }) {
    Object.assign(this, { root, profile, portraits, audio, onBack });
    this.tab = 'profil';
    this.race = FACTION_IDS[0];
  }

  unitImg(u) { return this.portraits ? this.portraits.get(`f|${u.id}`, u.model, FACTIONS[u.faction].palette, u.tier) : ''; }

  render() {
    const P = this.profile.d;
    const tabs = [['profil', 'Profil'], ['voelker', 'Völker'], ['erfolge', 'Erfolge'], ['aufgaben', 'Herausforderungen'], ['endlos', 'Endlos-Bestenliste']];
    let body = '';
    if (this.tab === 'profil') {
      const need = ACCOUNT_XP(P.level);
      const wk = weeklyModifier();
      const nextTitle = TITLES.find(([l]) => l > P.level);
      body = `<div class="col-profile">
        <div class="col-lvl"><b>${P.level}</b><small>Stufe</small></div>
        <div class="col-main"><h3 class="col-title">${esc(this.profile.title)}</h3>${bar(P.xp / need)}
          <p class="fine">${P.xp.toLocaleString('de-DE')} / ${need.toLocaleString('de-DE')} Erfahrung · ${P.games} Partien · ${Object.keys(P.achievements).length}/${ACHIEVEMENTS.length} Erfolge${nextTitle ? ` · nächster Titel „${esc(nextTitle[1])}“ ab Stufe ${nextTitle[0]}` : ''}</p>
          <p class="lead">Jede Partie bringt Erfahrung – Kampagne, Gefecht und Online. Auch Niederlagen zählen. Kein Kauf, keine Wartezeiten.</p></div>
      </div>
      <div class="col-cards">
        <div class="col-card"><small>Wochen-Modifikator</small><b>${esc(wk.name)}</b><p>${esc(wk.desc)}</p></div>
        <div class="col-card"><small>Völker-Siege</small><b>${Object.keys(P.raceWins || {}).length} / ${FACTION_IDS.length}</b><p>${FACTION_IDS.map((f) => `${esc(FACTIONS[f].name)} ${P.raceWins?.[f] || 0}`).join(' · ')}</p></div>
        <div class="col-card"><small>Bestes Endlos-Spiel</small><b>${P.endlessBest[0] ? `Welle ${P.endlessBest[0].wave}` : '–'}</b><p>${P.endlessBest[0] ? esc(FACTIONS[P.endlessBest[0].faction]?.name || 'Hybrid') : 'Gefecht → Endlos „An“'}</p></div>
      </div>`;
    } else if (this.tab === 'voelker') {
      const f = FACTIONS[this.race];
      const m = this.profile.mastery(this.race);
      body = `<div class="seg col-seg">${FACTION_IDS.map((id) => `<button class="${id === this.race ? 'on' : ''}" data-race="${id}">${esc(FACTIONS[id].name)}</button>`).join('')}</div>
        <div class="col-race" style="--g1:${f.grad[0]};--g2:${f.grad[1]};--g3:${f.grad[2]}">
          <div class="col-race-head"><div><h3 class="col-title">${esc(f.name)}</h3><p class="lead">${esc(f.desc)} <i>„${esc(f.motto)}“</i></p></div>
            <div class="col-mastery"><small>Meisterschaft</small><b>Stufe ${m.level}</b>${bar(m.xp / MASTERY_XP(m.level))}<span>${m.xp} / ${MASTERY_XP(m.level)}</span></div></div>
          <div class="col-skins">${(SKINS[this.race] || []).map((s) => `<span class="col-chip ${m.level >= s.lvl ? 'on' : ''}">${m.level >= s.lvl ? I.check : I.lock}${esc(s.name)} <small>Meisterschaft ${s.lvl}</small></span>`).join('')}</div>
        </div>
        <div class="col-tree">${factionUnits(this.race).map((u) => {
          const [a2, b2] = u.upgrades.map((id) => UNITS[id]);
          const node = (x) => (x ? `<div class="col-unit"><img src="${this.unitImg(x)}" alt=""><div><b>${esc(x.name)}</b><small>${esc(x.roleLabel)} · ${ATTACK_TYPES[x.atk].name} · ${ARMOR_TYPES[x.armorType].name} · ${x.cost} Gold</small></div></div>` : '');
          return `<div class="col-line">${node(u)}<div class="col-branch"><div>${node(a2)}${node(UNITS[a2?.upgrades[0]])}</div><div>${node(b2)}${node(UNITS[b2?.upgrades[0]])}</div></div></div>`;
        }).join('')}</div>`;
    } else if (this.tab === 'erfolge') {
      body = `<div class="col-ach">${ACHIEVEMENTS.map((a) => `<div class="col-a ${P.achievements[a.id] ? 'on' : ''}"><span class="col-a-ic">${P.achievements[a.id] ? I.star : I.lock}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}${P.achievements[a.id] ? ` · ${P.achievements[a.id]}` : ''}</small></div></div>`).join('')}</div>`;
    } else if (this.tab === 'aufgaben') {
      const list = (t, l) => `<div class="col-chs"><h3>${t}</h3>${l.map((c) => `<div class="col-ch ${c.done ? 'on' : ''}"><div class="col-ch-top"><b>${c.done ? I.check : I.diamond}${esc(c.name)}</b><small>${c.xp} Erfahrung</small></div>${bar(c.progress / c.goal)}<small>${Math.round(c.progress).toLocaleString('de-DE')} / ${c.goal.toLocaleString('de-DE')}</small></div>`).join('')}</div>`;
      body = `<div class="col-two">${list('Heute', P.daily.list)}${list('Diese Woche', P.weekly.list)}</div>`;
    } else {
      body = P.endlessBest.length
        ? `<ol class="col-best">${P.endlessBest.map((r, i) => `<li><span class="col-rank">${i + 1}</span><b>Welle ${r.wave}</b><span>${esc(FACTIONS[r.faction]?.name || (r.faction === 'hybrid' ? 'Hybrid' : '–'))}</span><small>${r.date}</small></li>`).join('')}</ol>`
        : '<p class="fine">Noch keine Endlos-Partie gespielt. Starte sie unter Gefecht → Endlos „An“ und halte über die letzte Welle hinaus durch.</p>';
    }
    this.root.innerHTML = `<header class="panel-head"><div class="ttl"><small>Fortschritt</small><h2>Sammlung</h2></div><button class="btn ghost back" data-col="back">Zurück</button></header>
      <div class="seg tabs-rail">${tabs.map(([k, n]) => `<button class="${k === this.tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
      <div class="col-body">${body}</div>`;
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.audio?.ui('click'); this.tab = b.dataset.tab; this.render(); }));
    this.root.querySelectorAll('[data-race]').forEach((b) => b.addEventListener('click', () => { this.audio?.ui('click'); this.race = b.dataset.race; this.render(); }));
    this.root.querySelector('[data-col="back"]').addEventListener('click', () => { this.audio?.ui('close'); this.onBack && this.onBack(); });
  }
}
