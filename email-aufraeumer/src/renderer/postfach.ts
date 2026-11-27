// Tiry's Mails – das Postfach: Ordner | Liste | Lesen, dazu Schreiben.
import { Tinte } from './tinte.js';
type Kat = 'wichtig' | 'persoenlich' | 'werbung' | 'newsletter' | 'benachrichtigung' | 'spam' | 'phishing';
interface Zeile { id: string; threadId: string; von: string; vonAdresse: string; betreff: string; vorschau: string; datum: number; ungelesen: boolean; stern: boolean; anhang: boolean; kategorie: Kat | null; labelIds: string[] }
interface Ordner { id: string; name: string; art: 'system' | 'firma' | 'sorte' | 'eigen'; ungelesen?: number }
interface Api { rufe(name: string, ...a: unknown[]): Promise<any> }

const KAT: Record<Kat, string> = { wichtig: 'Wichtig', persoenlich: 'Persönlich', werbung: 'Werbung', newsletter: 'Newsletter', benachrichtigung: 'Info', spam: 'Spam', phishing: 'Betrug' };
const h = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;

const SYMBOL: Record<string, string> = {
  INBOX: '<path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z"/>',
  STARRED: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
  SENT: '<path d="M4 12l16-8-6 16-3-7z"/>',
  ALLE: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  SPAM: '<path d="M12 3l9 16H3zM12 10v4M12 17v.5"/>',
  TRASH: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  ordner: '<path d="M3 7h7l2 2h9v10H3z"/>',
};

export class PostfachUI {
  private ordner: Ordner[] = [];
  private aktiv = 'INBOX';
  private suche = '';
  private zeilen: Zeile[] = [];
  private weiter?: string;
  private offen: string | null = null;
  private laedt = false;

  constructor(private wurzel: HTMLElement, private api: Api, private melde: (t: string, rueck?: () => void) => void,
    private aufraeumer: () => { probe: boolean; weg: number; pruefen: number } = () => ({ probe: true, weg: 0, pruefen: 0 }), private gehe: (ansicht: string) => void = () => {}) {}

  /** Grundgerüst einmal aufbauen. */
  async zeigen() {
    if (!this.wurzel.querySelector('.pf')) {
      this.wurzel.innerHTML = `
        <div class="pf" data-offen="nein">
          <aside class="pf-ordner" aria-label="Ordner">
            <button class="knopf voll gross pf-neu" data-pf="neu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Neue Mail</button>
            <nav id="pf-ordnerliste"></nav>
          </aside>
          <section class="pf-liste" aria-label="Mails">
            <div class="pf-kopf">
              <div class="pf-kopfzeile">
              <button class="einklappen pf-ordner-knopf" id="pf-ordner-knopf" aria-label="Ordner ein-/ausklappen" title="Ordner ein-/ausklappen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
              <label class="pf-suche"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>
                <span class="unsichtbar">Suchen</span><input type="search" id="pf-suche" placeholder="Suchen: Absender, Betreff, Text"></label>
              </div>
              <select id="pf-ordnerwahl" aria-label="Ordner"></select>
            </div>
            <h1 class="pf-titel" id="pf-titel">Posteingang</h1>
            <ol class="pf-zeilen" id="pf-zeilen"></ol>
            <button class="knopf pf-mehr" id="pf-mehr" hidden>Ältere Mails laden</button>
          </section>
          <section class="pf-lesen" id="pf-lesen" aria-label="Mail"><div class="pf-leer"><b>Wähl links eine Mail aus.</b><span>Sie erscheint hier.</span></div></section>
        </div>`;
      let t: any;
      $('#pf-suche', this.wurzel).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { this.suche = (e.target as HTMLInputElement).value.trim(); void this.laden(); }, 350); });
      $('#pf-ordnerwahl', this.wurzel).addEventListener('change', (e) => this.ordnerWaehlen((e.target as HTMLSelectElement).value));
      $('#pf-mehr', this.wurzel).addEventListener('click', () => void this.laden(true));
      // Ordner-Spalte ein-/ausklappen, Wahl merken
      const pf = $('.pf', this.wurzel);
      try { pf.dataset.spalte = localStorage.getItem('pf-ordner') ?? 'auf'; } catch { pf.dataset.spalte = 'auf'; }
      $('#pf-ordner-knopf', this.wurzel).addEventListener('click', () => {
        pf.dataset.spalte = pf.dataset.spalte === 'zu' ? 'auf' : 'zu';
        try { localStorage.setItem('pf-ordner', pf.dataset.spalte); } catch { /* egal */ }
      });
      this.wurzel.querySelector('[data-pf="neu"]')!.addEventListener('click', () => this.schreiben({}));
    }
    await this.ordnerLaden();
    await this.laden();
  }

  async ordnerLaden() {
    try { this.ordner = await this.api.rufe('pfOrdner'); } catch (e) { this.melde((e as Error).message); return; }
    const gruppe = (art: Ordner['art'][], titel: string) => {
      const os = this.ordner.filter((o) => art.includes(o.art));
      if (!os.length) return '';
      return `${titel ? `<h2>${titel}</h2>` : ''}<ul>${os.map((o) => `<li class="pf-oli"><button data-ordner="${h(o.id)}" ${o.id === this.aktiv ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${SYMBOL[o.id] ?? SYMBOL.ordner}</svg><span>${h(o.name)}</span>${o.ungelesen ? `<b>${o.ungelesen}</b>` : ''}</button>${o.art === 'firma' || o.art === 'eigen' ? `<button class="pf-oweg" data-oweg="${h(o.id)}" aria-label="Ordner ${h(o.name)} löschen" title="Ordner samt Mails löschen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>` : ''}</li>`).join('')}</ul>`;
    };
    const a = this.aufraeumer();
    $('#pf-ordnerliste', this.wurzel).innerHTML = gruppe(['system'], '') + gruppe(['firma', 'eigen'], 'Deine Ordner') + gruppe(['sorte'], 'Sortiert') + `
      <div class="pf-aufr"><div class="pf-aufr-kopf"><span class="marke-zeichen" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><b>Aufräumer</b></div>
        <p>${a.probe ? `Probelauf – heute würde ich <b>${a.weg}</b> Mails wegräumen.` : `Heute <b>${a.weg}</b> Mails weggeräumt.`}${a.pruefen ? ` <b>${a.pruefen}</b> warten auf dich.` : ''}</p>
        <button class="knopf klein voll" data-gehe="cockpit">Aufräumen öffnen</button></div>`;
    this.wurzel.querySelector<HTMLButtonElement>('[data-gehe]')?.addEventListener('click', () => this.gehe('cockpit'));
    for (const b of this.wurzel.querySelectorAll<HTMLButtonElement>('button[data-ordner]')) {
      b.addEventListener('click', () => this.ordnerWaehlen(b.dataset.ordner!));
      const ziel = b.dataset.ordner!;
      if (ziel === 'SENT' || ziel === this.aktiv) continue; // in „Gesendet“ oder den offenen Ordner nicht ablegen
      b.addEventListener('dragover', (e) => { if (!e.dataTransfer?.types.includes('text/x-tmail')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; b.classList.add('ablage'); });
      b.addEventListener('dragleave', () => b.classList.remove('ablage'));
      b.addEventListener('drop', (e) => {
        e.preventDefault(); b.classList.remove('ablage');
        const id = e.dataTransfer?.getData('text/x-tmail'); if (!id) return;
        b.classList.add('geschluckt'); setTimeout(() => b.classList.remove('geschluckt'), 600);
        void this.ablegen(id, ziel);
      });
    }
    for (const b of this.wurzel.querySelectorAll<HTMLButtonElement>('[data-oweg]')) b.addEventListener('click', (e) => { e.stopPropagation(); void this.ordnerLoeschen(b.dataset.oweg!); });
    $('#pf-ordnerwahl', this.wurzel).innerHTML = this.ordner.map((o) => `<option value="${h(o.id)}" ${o.id === this.aktiv ? 'selected' : ''}>${h(o.name)}${o.ungelesen ? ` (${o.ungelesen})` : ''}</option>`).join('');
  }

  private ordnerWaehlen(id: string) {
    this.aktiv = id; this.offen = null;
    for (const b of this.wurzel.querySelectorAll<HTMLButtonElement>('button[data-ordner]')) b.toggleAttribute('aria-current', b.dataset.ordner === id);
    (this.wurzel.querySelector('#pf-ordnerwahl') as HTMLSelectElement).value = id;
    $('.pf', this.wurzel).dataset.offen = 'nein';
    void this.laden();
  }

  /** Liste laden (mehr = nächste Seite anhängen). */
  /** Zuletzt gesehene Listen je Ordner/Suche – für sofortiges Umschalten. */
  private listen = new Map<string, { zeilen: any[]; weiter?: string }>();

  async laden(mehr = false) {
    if (this.laedt) return;
    this.laedt = true;
    const ol = $('#pf-zeilen', this.wurzel);
    const name = this.ordner.find((o) => o.id === this.aktiv)?.name ?? 'Posteingang';
    $('#pf-titel', this.wurzel).textContent = this.suche ? `Suche: „${this.suche}“` : name;
    // Sofort zeigen, was wir von diesem Ordner schon kennen – frische Liste kommt im Hintergrund nach
    const schluessel = `${this.aktiv}|${this.suche}`;
    const bekannt = this.listen.get(schluessel);
    if (!mehr) { if (bekannt) { this.zeilen = bekannt.zeilen; this.weiter = bekannt.weiter; this.listeZeichnen(); } else ol.innerHTML = '<li class="pf-lade">Lade Mails …</li>'; }
    try {
      const r = await this.api.rufe('pfListe', this.aktiv, this.suche, mehr ? this.weiter : undefined);
      if (`${this.aktiv}|${this.suche}` !== schluessel) return; // inzwischen anderer Ordner gewählt
      this.zeilen = mehr ? [...this.zeilen, ...r.zeilen] : r.zeilen;
      this.weiter = r.weiter;
      if (!mehr) this.listen.set(schluessel, { zeilen: r.zeilen, weiter: r.weiter });
      this.listeZeichnen();
      void this.api.rufe('pfVorladen', this.zeilen.slice(0, 8).map((z) => z.id)).catch(() => {});
    } catch (e) { ol.innerHTML = `<li class="pf-lade">Konnte nicht laden: ${h((e as Error).message)}</li>`; }
    finally { this.laedt = false; }
  }

  private datum(t: number) {
    const d = new Date(t), heute = new Date();
    if (d.toDateString() === heute.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const gestern = new Date(heute); gestern.setDate(heute.getDate() - 1);
    if (d.toDateString() === gestern.toDateString()) return 'Gestern';
    return d.toLocaleDateString('de-DE', d.getFullYear() === heute.getFullYear() ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  private gruppe(t: number) {
    const d = new Date(t), heute = new Date(); heute.setHours(0, 0, 0, 0);
    const tage = Math.floor((heute.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400_000);
    return tage <= 0 ? 'Heute' : tage === 1 ? 'Gestern' : tage < 7 ? 'Diese Woche' : tage < 31 ? 'Diesen Monat' : 'Älter';
  }

  listeZeichnen() {
    const ol = $('#pf-zeilen', this.wurzel);
    if (!this.zeilen.length) { ol.innerHTML = `<li class="pf-lade">${this.suche ? 'Nichts gefunden.' : 'Hier ist nichts. Aufgeräumt!'}</li>`; $('#pf-mehr', this.wurzel).hidden = true; return; }
    let letzte = '';
    ol.innerHTML = this.zeilen.map((z) => {
      const g = this.gruppe(z.datum); const kopf = g !== letzte ? `<li class="pf-gruppe">${g}</li>` : ''; letzte = g;
      return `${kopf}<li class="pf-li"><button class="pf-zeile ${z.ungelesen ? 'neu' : ''} ${z.id === this.offen ? 'offen' : ''}" data-id="${h(z.id)}" data-k="${z.kategorie ?? ''}" draggable="true" title="In einen Ordner links ziehen zum Verschieben">
        <i class="strich"></i>
        <span class="pf-von">${h(z.von)}</span><span class="pf-zeit">${this.datum(z.datum)}</span>
        <span class="pf-betreff">${z.stern ? '<span class="pf-stern" aria-label="Stern">★</span> ' : ''}${h(z.betreff || '(ohne Betreff)')}</span>
        <span class="pf-vorschau">${h(z.vorschau)}</span>
        ${z.kategorie ? `<span class="pf-kat">${KAT[z.kategorie]}</span>` : ''}
      </button>${this.aktiv === 'TRASH' ? '' : `<button class="pf-weg" data-weg="${h(z.id)}" aria-label="In den Papierkorb" title="In den Papierkorb"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>`}</li>`;
    }).join('');
    for (const b of ol.querySelectorAll<HTMLButtonElement>('.pf-zeile')) {
      b.addEventListener('click', () => void this.oeffnen(b.dataset.id!));
      b.addEventListener('mouseenter', () => void this.api.rufe('pfVorladen', [b.dataset.id!]).catch(() => {}));
      // Ziehen & Ablegen: Mail auf einen Ordner links ziehen
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/x-tmail', b.dataset.id!); e.dataTransfer!.effectAllowed = 'move';
        const z = this.zeilen.find((x) => x.id === b.dataset.id);
        const bild = document.createElement('div'); bild.className = 'pf-zieh-bild'; bild.textContent = z ? `${z.von} – ${z.betreff || '(ohne Betreff)'}` : 'Mail';
        document.body.append(bild); e.dataTransfer!.setDragImage(bild, 20, 20); setTimeout(() => bild.remove(), 0);
        b.classList.add('gezogen'); this.wurzel.classList.add('zieht');
      });
      b.addEventListener('dragend', () => { b.classList.remove('gezogen'); this.wurzel.classList.remove('zieht'); });
    }
    for (const b of ol.querySelectorAll<HTMLButtonElement>('[data-weg]')) b.addEventListener('click', (e) => { e.stopPropagation(); void this.wegwerfen(b.dataset.weg!); });
    $('#pf-mehr', this.wurzel).hidden = !this.weiter;
  }

  async oeffnen(id: string) {
    this.offen = id;
    for (const b of this.wurzel.querySelectorAll<HTMLElement>('.pf-zeile')) b.classList.toggle('offen', b.dataset.id === id);
    const z = this.zeilen.find((x) => x.id === id); if (z && z.ungelesen) { z.ungelesen = false; this.wurzel.querySelector(`.pf-zeile[data-id="${CSS.escape(id)}"]`)?.classList.remove('neu'); }
    $('.pf', this.wurzel).dataset.offen = 'ja';
    const ziel = $('#pf-lesen', this.wurzel);
    // Kopf sofort aus der Liste zeigen – der Inhalt kommt (meist schon vorgeladen) direkt hinterher
    ziel.innerHTML = z ? `<div class="pf-kopf-vorab"><h2>${h(z.betreff || '(ohne Betreff)')}</h2><p>${h(z.von)}</p></div>` : '';
    let m: any;
    try { m = await this.api.rufe('pfLesen', id); } catch (e) { ziel.innerHTML = `<div class="pf-leer"><b>Konnte die Mail nicht öffnen.</b><span>${h((e as Error).message)}</span></div>`; return; }
    if (this.offen !== id) return;
    const sperre = m.kategorie === 'phishing';
    // Bilder immer anzeigen – nur bei Spam/Betrug bleiben sie blockiert (sonst erfährt der Absender, dass die Adresse echt ist)
    const bilderAn = m.bilderAuto && m.kategorie !== 'spam' && m.kategorie !== 'phishing';
    const groesse = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
    const anh = m.anhaenge.filter((a: any) => !a.inline || !/^image\//.test(a.mime));
    const mehrere = (m.an.split(',').length + (m.cc ? m.cc.split(',').length : 0)) > 1;
    ziel.innerHTML = `
      <div class="pf-werkzeug" role="toolbar" aria-label="Aktionen">
        <button class="knopf klein pf-zurueck" data-tat="zurueck" aria-label="Zurück zur Liste" title="Zurück"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button class="knopf klein voll" data-tat="antworten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l-6 6 6 6M4 12h10a6 6 0 016 6"/></svg>Antworten</button>
        ${mehrere ? '<button class="knopf klein" data-tat="allen" title="Allen antworten">Allen</button>' : ''}
        <button class="knopf klein symbol" data-tat="weiter" title="Weiterleiten" aria-label="Weiterleiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l6 6-6 6M20 12H10a6 6 0 00-6 6"/></svg></button>
        <span class="pf-trenn"></span>
        ${this.aktiv === 'TRASH' || this.aktiv === 'SPAM'
          ? '<button class="knopf klein" data-tat="posteingang">In den Posteingang</button>'
          : '<button class="knopf klein symbol" data-tat="archiv" title="Archiv – raus aus dem Posteingang" aria-label="Archiv"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"/></svg></button>'}
        <button class="knopf klein symbol" data-tat="verschieben" title="In Ordner verschieben" aria-label="In Ordner verschieben"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3zM12 14h6M15 11l3 3-3 3"/></svg></button>
        <button class="knopf klein symbol ${m.labelIds.includes('STARRED') ? 'an' : ''}" data-tat="${m.labelIds.includes('STARRED') ? 'sternWeg' : 'stern'}" title="${m.labelIds.includes('STARRED') ? 'Stern entfernen' : 'Mit Stern markieren'}" aria-label="Stern" aria-pressed="${m.labelIds.includes('STARRED')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/></svg></button>
        <button class="knopf klein symbol" data-tat="ungelesen" title="Als ungelesen markieren" aria-label="Als ungelesen markieren"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h14v12H3zM3 7l7 5 7-5"/><circle cx="19.5" cy="5.5" r="2.5"/></svg></button>
        ${this.aktiv === 'TRASH' ? '' : '<button class="knopf klein symbol weg" data-tat="papierkorb" title="In den Papierkorb (30 Tage zurückholbar)" aria-label="In den Papierkorb"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>'}
      </div>
      <header class="pf-mailkopf" data-k="${m.kategorie ?? ''}">
        <h2>${h(m.betreff || '(ohne Betreff)')}</h2>
        <p><b>${h(m.von)}</b> <span>&lt;${h(m.vonAdresse)}&gt;</span></p>
        <p class="pf-an">${m.an ? `an ${h(m.an)} · ` : ''}${m.cc ? `Cc ${h(m.cc)} · ` : ''}${new Date(m.datum).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        ${m.kategorie ? `<span class="pf-kat">${KAT[m.kategorie as Kat]}</span>` : ''}
      </header>
      ${m.warnung ? `<p class="pf-warnung">${h(m.warnung)}${sperre ? ' Links sind gesperrt.' : ''}</p>` : ''}
      ${m.fernBilder && !bilderAn ? '<p class="pf-bilder" id="pf-bilder">Bilder aus dem Internet sind blockiert – so merkt der Absender nicht, dass du die Mail geöffnet hast. <button class="knopf klein" data-tat="bilder">Bilder anzeigen</button></p>' : ''}
      ${anh.length ? `<ul class="pf-anhaenge">${anh.map((a: any, i: number) => `<li><button class="knopf klein" data-anhang="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l6-6a3 3 0 014 4l-8 8a5 5 0 01-7-7l7-7"/></svg>${h(a.name)} <small>${groesse(a.groesse)}</small></button></li>`).join('')}</ul>` : ''}
      <iframe class="pf-inhalt" id="pf-inhalt" title="Inhalt der Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" src="${m.anzeigeUrl}?bilder=${bilderAn ? 1 : 0}&sperre=${sperre ? 1 : 0}"></iframe>`;
    ziel.querySelectorAll<HTMLButtonElement>('[data-tat]').forEach((b) => b.addEventListener('click', () => void this.tat(b.dataset.tat!, m)));
    ziel.querySelectorAll<HTMLButtonElement>('[data-anhang]').forEach((b) => b.addEventListener('click', async () => {
      try { await this.api.rufe('pfAnhangSpeichern', id, anh[Number(b.dataset.anhang)]); } catch (e) { this.melde((e as Error).message); }
    }));
  }

  private async tat(t: string, m: any) {
    const ids = [m.id];
    if (t === 'zurueck') { $('.pf', this.wurzel).dataset.offen = 'nein'; return; }
    if (t === 'bilder') { ($('#pf-inhalt', this.wurzel) as HTMLIFrameElement).src = `${m.anzeigeUrl}?bilder=1&sperre=${m.kategorie === 'phishing' ? 1 : 0}`; $('#pf-bilder', this.wurzel).remove(); return; }
    if (t === 'antworten' || t === 'allen' || t === 'weiter') {
      const v = await this.api.rufe('pfVorlage', m.id, t);
      return this.schreiben(v);
    }
    if (t === 'verschieben') return this.verschieben(ids);
    const text = ({ archiv: 'Ins Archiv verschoben.', papierkorb: 'In den Papierkorb gelegt.', stern: 'Stern gesetzt.', sternWeg: 'Stern entfernt.', ungelesen: 'Als ungelesen markiert.', posteingang: 'Zurück im Posteingang.' } as any)[t];
    const weg = ['archiv', 'papierkorb', 'posteingang'].includes(t);
    if (weg) this.weg(m.id); // sofort – Gmail bekommt es im Hintergrund
    this.melde(text, async () => { await this.api.rufe('pfRueckgaengig'); this.melde('Zurückgeholt.'); void this.laden(); });
    try {
      await this.api.rufe('pfAktion', ids, t);
      if (!weg) void this.laden();
    } catch (e) { this.melde(`Hat nicht geklappt: ${(e as Error).message}`); void this.laden(); }
  }

  /** Ordner samt Inhalt löschen – mit klarer Rückfrage, Fortschritt und Rückgängig. */
  private async ordnerLoeschen(id: string) {
    const d = $<HTMLDialogElement>('#dialog');
    d.innerHTML = '<h2 id="dialog-titel">Ordner löschen?</h2><p>Ich zähle die Mails …</p>';
    if (!d.open) d.showModal();
    let info: { name: string; gesamt: number; stern: number };
    try { info = await this.api.rufe('pfOrdnerInhalt', id); } catch (e) { d.close(); this.melde((e as Error).message); return; }
    const weg = Math.max(0, info.gesamt - info.stern);
    d.innerHTML = `<h2 id="dialog-titel">Ordner „${h(info.name)}“ löschen?</h2>
      <p><b>${weg.toLocaleString('de-DE')} ${weg === 1 ? 'Mail' : 'Mails'}</b> ${weg === 1 ? 'kommt' : 'kommen'} in den <b>Papierkorb</b> und der Ordner verschwindet. Gmail löscht den Papierkorb erst nach 30 Tagen – bis dahin holst du alles mit einem Klick zurück.${info.stern ? ` <b>${info.stern} ${info.stern === 1 ? 'Mail' : 'Mails'} mit Stern</b> ${info.stern === 1 ? 'bleibt' : 'bleiben'} erhalten.` : ''}</p>
      <div class="zeile" data-stil="margin-top:18px"><button class="knopf gefahr" data-ja>Ordner und ${weg.toLocaleString('de-DE')} ${weg === 1 ? 'Mail' : 'Mails'} löschen</button><button class="knopf" data-nein>Abbrechen</button></div>`;
    const ok = await new Promise<boolean>((fertig) => {
      d.querySelector('[data-ja]')!.addEventListener('click', () => fertig(true));
      d.querySelector('[data-nein]')!.addEventListener('click', () => fertig(false));
      d.addEventListener('cancel', () => fertig(false), { once: true });
    });
    if (!ok) { d.close(); return; }
    d.innerHTML = `<h2 id="dialog-titel">Lösche „${h(info.name)}“ …</h2><p class="alt-status" id="ol-stand">0 von ${weg.toLocaleString('de-DE')}</p><div class="fortschritt"><i id="ol-balken"></i></div>`;
    (window as any).__ordnerLoeschen = (s: { erledigt: number; gesamt: number }) => {
      const t = d.querySelector('#ol-stand'); if (t) t.textContent = `${s.erledigt.toLocaleString('de-DE')} von ${s.gesamt.toLocaleString('de-DE')}`;
      const b = d.querySelector<HTMLElement>('#ol-balken'); if (b) b.style.width = `${Math.round((s.erledigt / Math.max(1, s.gesamt)) * 100)}%`;
    };
    try {
      const r = await this.api.rufe('pfOrdnerLoeschen', id);
      d.close();
      this.melde(`Ordner „${r.name}“ gelöscht – ${r.papierkorb.toLocaleString('de-DE')} Mails im Papierkorb.`, async () => {
        const n = await this.api.rufe('pfOrdnerZurueck'); this.melde(`${n.toLocaleString('de-DE')} Mails und der Ordner sind zurück.`); void this.ordnerLaden();
      });
      if (this.aktiv === id) this.ordnerWaehlen('INBOX');
      void this.ordnerLaden();
    } catch (e) { d.close(); this.melde((e as Error).message); }
  }

  /** Papierkorb-Knopf direkt in der Liste. */
  private async wegwerfen(id: string) {
    const li = this.wurzel.querySelector<HTMLElement>(`.pf-zeile[data-id="${CSS.escape(id)}"]`)?.closest('li');
    li?.classList.add('fliegt');
    setTimeout(() => this.weg(id), 160);
    this.melde('In den Papierkorb gelegt.', async () => { await this.api.rufe('pfRueckgaengig'); this.melde('Zurückgeholt.'); void this.laden(); });
    try { await this.api.rufe('pfAktion', [id], 'papierkorb'); void this.ordnerLaden(); }
    catch (e) { this.melde(`Hat nicht geklappt: ${(e as Error).message}`); void this.laden(); }
  }

  /** Mail per Ziehen in einen Ordner legen (auch Posteingang, Papierkorb, Spam, Alle Mails = Archiv). */
  private async ablegen(id: string, ziel: string) {
    const name = this.ordner.find((o) => o.id === ziel)?.name ?? 'Ordner';
    const aktion: any = ziel === 'TRASH' ? 'papierkorb' : ziel === 'INBOX' ? 'posteingang' : ziel === 'ALLE' ? 'archiv' : ziel === 'STARRED' ? 'stern' : { ordner: ziel };
    if (ziel !== 'STARRED') this.weg(id);
    this.melde(ziel === 'STARRED' ? 'Stern gesetzt.' : `Verschoben nach „${name}“.`, async () => { await this.api.rufe('pfRueckgaengig'); this.melde('Zurückgeholt.'); void this.laden(); });
    try { await this.api.rufe('pfAktion', [id], aktion); if (ziel === 'STARRED') void this.laden(); void this.ordnerLaden(); }
    catch (e) { this.melde(`Hat nicht geklappt: ${(e as Error).message}`); void this.laden(); }
  }

  /** Mail aus der Liste nehmen und die nächste öffnen. */
  private weg(id: string) {
    const i = this.zeilen.findIndex((z) => z.id === id);
    this.zeilen = this.zeilen.filter((z) => z.id !== id);
    for (const l of this.listen.values()) l.zeilen = l.zeilen.filter((z) => z.id !== id);
    this.listeZeichnen();
    const naechste = this.zeilen[Math.min(i, this.zeilen.length - 1)];
    if (naechste && $('.pf', this.wurzel).dataset.offen === 'ja' && matchMedia('(min-width: 1100px)').matches) void this.oeffnen(naechste.id);
    else { $('#pf-lesen', this.wurzel).innerHTML = '<div class="pf-leer"><b>Erledigt.</b><span>Wähl die nächste Mail aus.</span></div>'; $('.pf', this.wurzel).dataset.offen = 'nein'; }
  }

  private verschieben(ids: string[]) {
    const d = $<HTMLDialogElement>('#dialog');
    const eigene = this.ordner.filter((o) => o.art === 'firma' || o.art === 'eigen' || o.art === 'sorte');
    d.innerHTML = `<h2 id="dialog-titel">In welchen Ordner?</h2>
      <ul class="pf-ordnerwahl">${eigene.map((o) => `<li><button class="knopf" data-ziel="${h(o.id)}">${h(o.name)}</button></li>`).join('') || '<li>Noch keine eigenen Ordner.</li>'}</ul>
      <form class="zeile" id="pf-neuer-ordner"><label class="feld"><span class="etikett">Neuer Ordner</span><input name="name" required placeholder="z. B. Werkstatt"></label><button class="knopf voll">Anlegen und verschieben</button></form>
      <div class="zeile" data-stil="margin-top:16px"><button class="knopf" value="nein" data-schliessen>Abbrechen</button></div>`;
    const fertig = async (ziel: string) => {
      d.close();
      await this.api.rufe('pfAktion', ids, { ordner: ziel });
      this.melde(`Verschoben nach „${this.ordner.find((o) => o.id === ziel)?.name ?? 'neuer Ordner'}“.`, async () => { await this.api.rufe('pfRueckgaengig'); void this.laden(); });
      ids.forEach((i) => this.weg(i));
    };
    d.querySelectorAll<HTMLButtonElement>('[data-ziel]').forEach((b) => b.addEventListener('click', () => void fertig(b.dataset.ziel!)));
    d.querySelector('[data-schliessen]')!.addEventListener('click', () => d.close());
    d.querySelector<HTMLFormElement>('#pf-neuer-ordner')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = String(new FormData(e.target as HTMLFormElement).get('name'));
      try { const id = await this.api.rufe('pfOrdnerAnlegen', name); await this.ordnerLaden(); await fertig(id); } catch (err) { this.melde((err as Error).message); }
    });
    d.showModal();
  }

  /** Geführte Einrichtung für große Dateien (Google Drive) – mit Live-Prüfung. true = fertig eingerichtet. */
  driveAssistent(start: { schritt?: number; grund?: string }): Promise<boolean> {
    const d = document.querySelector<HTMLDialogElement>('#dialog')!;
    return new Promise((fertig) => {
      const zeichnen = (st: { schritt?: number; grund?: string; ok?: boolean }) => {
        const schritt = st.ok ? 3 : st.schritt ?? 1;
        const zeile = (n: number, titel: string, text: string, knopf: string) => `<li class="${schritt > n ? 'erledigt' : schritt === n ? 'jetzt' : ''}">
          <b>${schritt > n ? '✓' : n}</b><div><strong>${titel}</strong><p>${text}</p>${schritt === n ? knopf : ''}</div></li>`;
        d.innerHTML = `<h2 id="dialog-titel">Große Dateien einrichten</h2>
          <p>Gmail nimmt pro Mail höchstens 25 MB an. Größere Dateien lege ich in dein Google Drive und schicke einen Download-Link – wie Gmail und Outlook es auch machen. Einmalig zwei Schritte:</p>
          <ol class="assistent">
            ${zeile(1, 'Drive bei Google einschalten', 'Öffnet die richtige Seite. Dort oben dein Projekt wählen und auf <b>Aktivieren</b> drücken.', '<button class="knopf voll" data-a="link">Seite öffnen</button> <button class="knopf" data-a="pruefen">Erledigt – prüfen</button>')}
            ${zeile(2, 'Einmal neu anmelden', 'Der Browser öffnet sich. Dort <b>alle Haken</b> setzen – ich sehe dann nur Dateien, die ich selbst hochlade.', '<button class="knopf voll" data-a="login">Neu anmelden</button>')}
          </ol>
          ${st.grund && !st.ok ? `<p class="assistent-hinweis">${h(st.grund)}</p>` : ''}
          ${st.ok ? '<p class="assistent-ok">Alles bereit. Große Dateien gehen ab jetzt als Download-Link.</p>' : ''}
          <div class="zeile" data-stil="margin-top:18px"><button class="knopf ${st.ok ? 'voll' : ''}" data-a="${st.ok ? 'weiter' : 'abbrechen'}">${st.ok ? 'Jetzt senden' : 'Abbrechen'}</button></div>`;
        const a = (n: string) => d.querySelector<HTMLButtonElement>(`[data-a="${n}"]`);
        a('link')?.addEventListener('click', () => { window.open('https://console.cloud.google.com/apis/library/drive.googleapis.com', '_blank'); });
        a('pruefen')?.addEventListener('click', async () => { const t = await this.api.rufe('driveTest'); zeichnen(t.ok ? t : { ...t, schritt: t.schritt === 1 ? 1 : 2, grund: t.schritt === 2 ? '' : t.grund }); });
        a('login')?.addEventListener('click', async () => {
          try { await this.api.rufe('anmelden'); zeichnen(await this.api.rufe('driveTest')); } catch (e) { zeichnen({ schritt: 2, grund: (e as Error).message }); }
        });
        a('abbrechen')?.addEventListener('click', () => { d.close(); fertig(false); });
        a('weiter')?.addEventListener('click', () => { d.close(); fertig(true); });
      };
      zeichnen(start);
      d.addEventListener('cancel', () => fertig(false), { once: true });
      if (!d.open) d.showModal();
    });
  }

  /** Schreibfenster (neu, Antwort, Weiterleitung): Vollbild mit Tinten-Hintergrund und Live-Vorschau. */
  schreiben(v: { an?: string[]; cc?: string[]; betreff?: string; text?: string; threadId?: string; inReplyTo?: string; references?: string }) {
    document.querySelector('.tm-schreiben')?.remove();
    const el = document.createElement('section');
    el.className = 'tm-schreiben'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mail schreiben');
    type Datei = { name: string; mime: string; groesse: number; pfad: string; gross?: boolean };
    let anhaenge: Datei[] = [];
    const titel = v.inReplyTo ? 'Antworten' : v.betreff?.startsWith('Fwd') ? 'Weiterleiten' : 'Neue Mail';
    el.innerHTML = `
      <canvas class="tm-tinte" aria-hidden="true"></canvas>
      <div class="tm-rahmen">
        <div class="tm-editor">
          <header><h2>${titel}</h2><button class="einklappen" data-x aria-label="Schließen" title="Schließen (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
          <label class="tm-feld"><span>An</span><input name="an" value="${h((v.an ?? []).join(', '))}" placeholder="name@beispiel.de" autocomplete="off"></label>
          <label class="tm-feld"><span>Cc</span><input name="cc" value="${h((v.cc ?? []).join(', '))}" autocomplete="off"></label>
          <label class="tm-feld"><span>Betreff</span><input name="betreff" value="${h(v.betreff ?? '')}" placeholder="Worum geht's?"></label>
          <label class="tm-text"><span class="unsichtbar">Text</span><textarea name="text" placeholder="Schreib einfach los …">${h(v.text ?? '')}</textarea></label>
          <ul class="tm-anhaenge" id="tm-anh"></ul>
          <footer>
            <button class="knopf voll gross" data-senden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z"/></svg>Senden</button>
            <button class="knopf" data-anhang><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l6-6a3 3 0 014 4l-8 8a5 5 0 01-7-7l7-7"/></svg>Dateien</button>
            <label class="tm-gestaltet"><button class="schalter" role="switch" aria-checked="true" data-gestaltet aria-label="Gestaltete Mail"></button><span>Gestaltet</span></label>
            <span class="tm-status" id="tm-status" role="status"></span>
            <button class="knopf leise" data-x>Verwerfen</button>
          </footer>
        </div>
        <div class="tm-vorschau">
          <div class="tm-vorschau-kopf"><b>So sieht es beim Empfänger aus</b>
            <div class="tm-geraet" role="group" aria-label="Gerät"><button class="knopf klein" aria-pressed="true" data-geraet="pc">PC</button><button class="knopf klein" aria-pressed="false" data-geraet="handy">Handy</button></div>
            <button class="knopf klein tm-nur-handy" data-vorschau-zu>Zurück zum Text</button></div>
          <div class="tm-buehne"><iframe class="tm-frame" title="Vorschau der Mail" sandbox></iframe></div>
        </div>
      </div>
      <button class="knopf tm-vorschau-knopf" data-vorschau-auf>Vorschau</button>`;
    document.body.append(el);
    const feld = (n: string) => el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${n}"]`)!;
    const text = feld('text') as HTMLTextAreaElement;
    const tinte = new Tinte(el.querySelector('canvas')!);
    tinte.start();
    let gestaltet = true;

    // Live-Vorschau (gedrosselt)
    const frame = el.querySelector<HTMLIFrameElement>('.tm-frame')!;
    let vt: any;
    const vorschau = () => { clearTimeout(vt); vt = setTimeout(async () => {
      if (!gestaltet) { frame.removeAttribute('src'); return; }
      frame.src = await this.api.rufe('pfVorschau', { betreff: feld('betreff').value, text: text.value, anhaenge });
    }, 220); };
    vorschau();

    // Tippen → Welle an der Schreibstelle
    const stelle = () => {
      const r = text.getBoundingClientRect(); const cs = getComputedStyle(text);
      const vor = text.value.slice(0, text.selectionStart ?? 0).split('\n');
      const zeile = vor.length - 1, spalte = vor[vor.length - 1].length;
      const lh = parseFloat(cs.lineHeight) || 24, cw = (parseFloat(cs.fontSize) || 16) * 0.52;
      return { x: r.left + parseFloat(cs.paddingLeft) + Math.min(r.width - 30, (spalte % 80) * cw), y: r.top + parseFloat(cs.paddingTop) + Math.min(r.height - 20, zeile * lh - text.scrollTop + lh / 2) };
    };
    el.addEventListener('input', (e) => {
      const t = e.target as HTMLElement;
      if (t === text) { const p = stelle(); tinte.impuls(p.x, p.y); }
      else { const r = t.getBoundingClientRect(); tinte.impuls(r.left + 40 + Math.random() * (r.width - 80), r.top + r.height / 2); }
      vorschau();
    });

    const schliessen = () => { tinte.stopp(); el.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) schliessen(); };
    document.addEventListener('keydown', esc);
    el.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', schliessen));
    (v.an?.length ? text : feld('an')).focus();
    if (v.an?.length) text.setSelectionRange(0, 0);

    // Gerät für die Vorschau, Vorschau auf dem Handy ein-/ausblenden
    el.querySelectorAll<HTMLButtonElement>('[data-geraet]').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('[data-geraet]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      el.dataset.geraet = b.dataset.geraet;
    }));
    el.querySelector('[data-vorschau-auf]')!.addEventListener('click', () => { el.dataset.ansicht = 'vorschau'; });
    el.querySelector('[data-vorschau-zu]')!.addEventListener('click', () => { el.dataset.ansicht = ''; });
    el.querySelector<HTMLButtonElement>('[data-gestaltet]')!.addEventListener('click', (ev) => {
      gestaltet = !gestaltet; (ev.currentTarget as HTMLElement).setAttribute('aria-checked', String(gestaltet));
      el.classList.toggle('schlicht', !gestaltet); vorschau();
    });

    // Anhänge: Größe zeigen, große Dateien gehen als Download-Link über Google Drive
    const GRENZE = 18 * 1024 * 1024;
    const mb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
    const anhZeichnen = () => {
      let summe = 0;
      for (const a of [...anhaenge].sort((x, y) => x.groesse - y.groesse)) { a.gross = summe + a.groesse > GRENZE; if (!a.gross) summe += a.groesse; }
      el.querySelector('#tm-anh')!.innerHTML = anhaenge.map((a, i) => `<li class="${a.gross ? 'gross' : ''}"><span>${h(a.name)}</span><small>${mb(a.groesse)}${a.gross ? ' · als Download-Link (Google Drive)' : ''}</small>
        <button class="einklappen" data-weg="${i}" aria-label="${h(a.name)} entfernen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join('');
      el.querySelectorAll<HTMLButtonElement>('[data-weg]').forEach((b) => b.addEventListener('click', () => { anhaenge.splice(Number(b.dataset.weg), 1); anhZeichnen(); vorschau(); }));
    };
    el.querySelector('[data-anhang]')!.addEventListener('click', async () => {
      try { anhaenge = [...anhaenge, ...(await this.api.rufe('pfAnhangWaehlen'))]; anhZeichnen(); vorschau(); } catch (e) { this.melde((e as Error).message); }
    });
    // Dateien auch per Ziehen & Ablegen? Nur über den Dialog – so bleiben die erlaubten Pfade unter Kontrolle.

    const status = el.querySelector('#tm-status')!;
    (window as any).__sendeStatus = (t: string) => { status.textContent = t; };
    el.querySelector('[data-senden]')!.addEventListener('click', async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement;
      // Große Dateien brauchen Google Drive – fehlt das, führt ein Assistent Schritt für Schritt durch die Einrichtung
      if (anhaenge.some((a) => a.gross)) {
        const t = await this.api.rufe('driveTest');
        if (!t.ok && !(await this.driveAssistent(t))) return;
      }
      b.disabled = true; status.textContent = 'Wird gesendet …';
      const liste = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      try {
        const r = await this.api.rufe('pfSenden', { an: liste(feld('an').value), cc: liste(feld('cc').value), betreff: feld('betreff').value, text: text.value,
          threadId: v.threadId, inReplyTo: v.inReplyTo, references: v.references, anhaenge, gestaltet });
        schliessen();
        this.melde(r.links ? `Gesendet – ${r.links} große ${r.links === 1 ? 'Datei' : 'Dateien'} als Download-Link.` : 'Gesendet.');
        if (this.aktiv === 'SENT') void this.laden();
      } catch (e) { this.melde((e as Error).message); b.disabled = false; status.textContent = ''; }
    });
  }
}
