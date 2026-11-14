// Sammlung: Profil (Stufe, Titel), Helden mit Meisterschaft & Skins, Völker mit Upgrade-Bäumen,
// Erfolge, tägliche/wöchentliche Herausforderungen, Wochen-Modifikator, Endlos-Bestenliste.
import { FACTIONS, FACTION_IDS, UNITS, ATTACK_TYPES, ARMOR_TYPES, factionUnits } from '../sim/data.js';
import { HEROES, HERO_IDS, abilityText } from '../sim/heroes.js';
import { ACHIEVEMENTS, SKINS, ACCOUNT_XP, MASTERY_XP, weeklyModifier } from '../meta/profile.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Collection {
  constructor(root, { profile, portraits, audio, onBack }) {
    Object.assign(this, { root, profile, portraits, audio, onBack });
    this.tab = 'profil';
    this.race = FACTION_IDS[0];
    this.hero = HERO_IDS[0];
  }

  unitImg(u) { return this.portraits ? this.portraits.get(`f|${u.id}`, u.model, FACTIONS[u.faction].palette, u.tier) : ''; }

  render() {
    const P = this.profile.d;
    const tabs = [['profil', 'Profil'], ['helden', 'Helden'], ['voelker', 'Völker'], ['erfolge', 'Erfolge'], ['aufgaben', 'Herausforderungen'], ['endlos', 'Endlos-Bestenliste']];
    let body = '';
    if (this.tab === 'profil') {
      const need = ACCOUNT_XP(P.level);
      body = `<div class="col-profile"><div class="col-lvl"><b>${P.level}</b><small>Stufe</small></div>
        <div><h3>${esc(this.profile.title)}</h3><div class="xpbar"><i style="width:${Math.round((P.xp / need) * 100)}%"></i></div><p class="fine">${P.xp} / ${need} Erfahrung · ${P.games} Partien · ${Object.keys(P.achievements).length}/${ACHIEVEMENTS.length} Erfolge</p>
        <p class="lead">Jede Partie bringt Erfahrung – Kampagne, Gefecht und Online. Auch Niederlagen zählen. Kein Kauf, keine Wartezeiten.</p>
        <p><b>Wochen-Modifikator:</b> ${esc(weeklyModifier().name)} – ${esc(weeklyModifier().desc)}</p></div></div>`;
    } else if (this.tab === 'helden') {
      const h = HEROES[this.hero];
      const m = this.profile.mastery(h.id);
      body = `<div class="seg">${HERO_IDS.map((id) => `<button class="${id === this.hero ? 'on' : ''}" data-hero="${id}">${HEROES[id].cls}</button>`).join('')}</div>
        <div class="col-hero"><div><h3>${esc(h.name)} <small>· ${esc(h.title)}</small></h3><p class="fine">${h.roleLabel} · ${h.cls} · Schwierigkeit ${'◆'.repeat(h.difficulty)}${'◇'.repeat(3 - h.difficulty)} · passt zu ${h.synergy.map((f) => FACTIONS[f].name).join(', ')}</p>
        <p class="lead">${esc(h.lore)}</p>
        <p>Meisterschaft <b>Stufe ${m.level}</b> (${m.xp}/${MASTERY_XP(m.level)})</p>
        <div class="col-skins">${(SKINS[h.id] || []).map((s) => `<span class="chip ${m.level >= s.lvl ? 'on' : 'off'}">${m.level >= s.lvl ? '✓' : '🔒'} ${esc(s.name)} <small>(Meisterschaft ${s.lvl})</small></span>`).join('')}</div></div>
        <ol class="col-abil">${h.abilities.map((a, i) => `<li><b>${i + 1} · ${esc(a.name)}</b>${a.cast ? ` <small>${a.cast}s Zauberzeit</small>` : ''}${a.cd ? ` <small>· ${a.cd}s Abklingzeit</small>` : ''}<br>${esc(abilityText(a, 1, i))}${a.ult ? `<br><small>Ab Stufe 6 Ultimate: ${esc(abilityText(a, 6, i))}</small>` : ''}</li>`).join('')}</ol></div>`;
    } else if (this.tab === 'voelker') {
      const f = FACTIONS[this.race];
      body = `<div class="seg">${FACTION_IDS.map((id) => `<button class="${id === this.race ? 'on' : ''}" data-race="${id}">${FACTIONS[id].name}</button>`).join('')}</div>
        <p class="lead">${esc(f.desc)} <i>„${esc(f.motto)}“</i></p>
        <div class="col-tree">${factionUnits(this.race).map((u) => {
          const [a2, b2] = u.upgrades.map((id) => UNITS[id]);
          const node = (x) => x ? `<div class="col-unit"><img src="${this.unitImg(x)}" alt=""><b>${esc(x.name)}</b><small>${x.roleLabel} · ${ATTACK_TYPES[x.atk].name} · ${ARMOR_TYPES[x.armorType].name} · ${x.cost} Gold</small></div>` : '';
          return `<div class="col-line">${node(u)}<div class="col-branch"><div>${node(a2)}${node(UNITS[a2?.upgrades[0]])}</div><div>${node(b2)}${node(UNITS[b2?.upgrades[0]])}</div></div></div>`;
        }).join('')}</div>`;
    } else if (this.tab === 'erfolge') {
      body = `<div class="col-ach">${ACHIEVEMENTS.map((a) => `<div class="col-a ${P.achievements[a.id] ? 'on' : ''}"><b>${P.achievements[a.id] ? '★' : '☆'} ${esc(a.name)}</b><small>${esc(a.desc)}${P.achievements[a.id] ? ` · ${P.achievements[a.id]}` : ''}</small></div>`).join('')}</div>`;
    } else if (this.tab === 'aufgaben') {
      const list = (t, l) => `<h3>${t}</h3>${l.map((c) => `<div class="col-ch ${c.done ? 'on' : ''}"><b>${c.done ? '✓' : '◇'} ${esc(c.name)}</b><div class="xpbar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></div><small>${Math.round(c.progress)} / ${c.goal} · ${c.xp} Erfahrung</small></div>`).join('')}`;
      body = list('Heute', P.daily.list) + list('Diese Woche', P.weekly.list);
    } else {
      body = P.endlessBest.length ? `<ol class="col-best">${P.endlessBest.map((r) => `<li><b>Welle ${r.wave}</b> · ${esc(HEROES[r.hero]?.name || '–')} · ${esc(FACTIONS[r.faction]?.name || r.faction || '–')} · ${r.date}</li>`).join('')}</ol>` : '<p class="fine">Noch keine Endlos-Partie gespielt. Starte sie unter Gefecht → Regeln „Endlos“.</p>';
    }
    this.root.innerHTML = `<header class="panel-head"><div class="ttl"><small>Fortschritt</small><h2>Sammlung</h2></div><button class="btn ghost back" data-col="back">Zurück</button></header>
      <div class="seg">${tabs.map(([k, n]) => `<button class="${k === this.tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
      <div class="col-body">${body}</div>`;
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.audio?.ui('click'); this.tab = b.dataset.tab; this.render(); }));
    this.root.querySelectorAll('[data-hero]').forEach((b) => b.addEventListener('click', () => { this.audio?.ui('click'); this.hero = b.dataset.hero; this.render(); }));
    this.root.querySelectorAll('[data-race]').forEach((b) => b.addEventListener('click', () => { this.audio?.ui('click'); this.race = b.dataset.race; this.render(); }));
    this.root.querySelector('[data-col="back"]').addEventListener('click', () => { this.audio?.ui('close'); this.onBack && this.onBack(); });
  }
}
