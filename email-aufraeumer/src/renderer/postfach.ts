// Tiry's Mails – das Postfach: Ordner | Liste | Lesen, dazu Schreiben.
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

  constructor(private wurzel: HTMLElement, private api: Api, private melde: (t: string, rueck?: () => void) => void) {}

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
      return `${titel ? `<h2>${titel}</h2>` : ''}<ul>${os.map((o) => `<li><button data-ordner="${h(o.id)}" ${o.id === this.aktiv ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${SYMBOL[o.id] ?? SYMBOL.ordner}</svg><span>${h(o.name)}</span>${o.ungelesen ? `<b>${o.ungelesen}</b>` : ''}</button></li>`).join('')}</ul>`;
    };
    $('#pf-ordnerliste', this.wurzel).innerHTML = gruppe(['system'], '') + gruppe(['firma', 'eigen'], 'Deine Ordner') + gruppe(['sorte'], 'Sortiert');
    for (const b of this.wurzel.querySelectorAll<HTMLButtonElement>('button[data-ordner]')) b.addEventListener('click', () => this.ordnerWaehlen(b.dataset.ordner!));
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
  async laden(mehr = false) {
    if (this.laedt) return;
    this.laedt = true;
    const ol = $('#pf-zeilen', this.wurzel);
    const name = this.ordner.find((o) => o.id === this.aktiv)?.name ?? 'Posteingang';
    $('#pf-titel', this.wurzel).textContent = this.suche ? `Suche: „${this.suche}“` : name;
    if (!mehr) ol.innerHTML = '<li class="pf-lade">Lade Mails …</li>';
    try {
      const r = await this.api.rufe('pfListe', this.aktiv, this.suche, mehr ? this.weiter : undefined);
      this.zeilen = mehr ? [...this.zeilen, ...r.zeilen] : r.zeilen;
      this.weiter = r.weiter;
      this.listeZeichnen();
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
      return `${kopf}<li><button class="pf-zeile ${z.ungelesen ? 'neu' : ''} ${z.id === this.offen ? 'offen' : ''}" data-id="${h(z.id)}" data-k="${z.kategorie ?? ''}">
        <i class="strich"></i>
        <span class="pf-von">${h(z.von)}</span><span class="pf-zeit">${this.datum(z.datum)}</span>
        <span class="pf-betreff">${z.stern ? '<span class="pf-stern" aria-label="Stern">★</span> ' : ''}${h(z.betreff || '(ohne Betreff)')}</span>
        <span class="pf-vorschau">${h(z.vorschau)}</span>
        ${z.kategorie ? `<span class="pf-kat">${KAT[z.kategorie]}</span>` : ''}
      </button></li>`;
    }).join('');
    for (const b of ol.querySelectorAll<HTMLButtonElement>('.pf-zeile')) b.addEventListener('click', () => void this.oeffnen(b.dataset.id!));
    $('#pf-mehr', this.wurzel).hidden = !this.weiter;
  }

  async oeffnen(id: string) {
    this.offen = id;
    for (const b of this.wurzel.querySelectorAll<HTMLElement>('.pf-zeile')) b.classList.toggle('offen', b.dataset.id === id);
    const z = this.zeilen.find((x) => x.id === id); if (z && z.ungelesen) { z.ungelesen = false; this.wurzel.querySelector(`.pf-zeile[data-id="${CSS.escape(id)}"]`)?.classList.remove('neu'); }
    $('.pf', this.wurzel).dataset.offen = 'ja';
    const ziel = $('#pf-lesen', this.wurzel);
    ziel.innerHTML = '<div class="pf-leer"><b>Öffne Mail …</b></div>';
    let m: any;
    try { m = await this.api.rufe('pfLesen', id); } catch (e) { ziel.innerHTML = `<div class="pf-leer"><b>Konnte die Mail nicht öffnen.</b><span>${h((e as Error).message)}</span></div>`; return; }
    if (this.offen !== id) return;
    const sperre = m.kategorie === 'phishing';
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
      ${m.fernBilder ? '<p class="pf-bilder" id="pf-bilder">Bilder aus dem Internet sind blockiert – so merkt der Absender nicht, dass du die Mail geöffnet hast. <button class="knopf klein" data-tat="bilder">Bilder anzeigen</button></p>' : ''}
      ${anh.length ? `<ul class="pf-anhaenge">${anh.map((a: any, i: number) => `<li><button class="knopf klein" data-anhang="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l6-6a3 3 0 014 4l-8 8a5 5 0 01-7-7l7-7"/></svg>${h(a.name)} <small>${groesse(a.groesse)}</small></button></li>`).join('')}</ul>` : ''}
      <iframe class="pf-inhalt" id="pf-inhalt" title="Inhalt der Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" src="${m.anzeigeUrl}?sperre=${sperre ? 1 : 0}"></iframe>`;
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
    try {
      await this.api.rufe('pfAktion', ids, t);
      const text = ({ archiv: 'Ins Archiv verschoben.', papierkorb: 'In den Papierkorb gelegt.', stern: 'Stern gesetzt.', sternWeg: 'Stern entfernt.', ungelesen: 'Als ungelesen markiert.', posteingang: 'Zurück im Posteingang.' } as any)[t];
      this.melde(text, async () => { await this.api.rufe('pfRueckgaengig'); this.melde('Zurückgeholt.'); void this.laden(); });
      if (['archiv', 'papierkorb', 'posteingang'].includes(t)) this.weg(m.id);
      else void this.laden();
    } catch (e) { this.melde((e as Error).message); }
  }

  /** Mail aus der Liste nehmen und die nächste öffnen. */
  private weg(id: string) {
    const i = this.zeilen.findIndex((z) => z.id === id);
    this.zeilen = this.zeilen.filter((z) => z.id !== id);
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

  /** Schreibfenster (neu, Antwort, Weiterleitung). */
  schreiben(v: { an?: string[]; cc?: string[]; betreff?: string; text?: string; threadId?: string; inReplyTo?: string; references?: string }) {
    document.querySelector('.pf-schreiben')?.remove();
    const el = document.createElement('section');
    el.className = 'pf-schreiben'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Neue Mail');
    let anhaenge: Array<{ name: string; mime: string; daten: Uint8Array }> = [];
    el.innerHTML = `
      <header><h2>${v.inReplyTo ? 'Antworten' : v.betreff?.startsWith('Fwd') ? 'Weiterleiten' : 'Neue Mail'}</h2><button class="knopf klein" data-x aria-label="Schließen">✕</button></header>
      <label class="feld"><span class="etikett">An</span><input name="an" value="${h((v.an ?? []).join(', '))}" placeholder="name@beispiel.de" autocomplete="off"></label>
      <label class="feld"><span class="etikett">Cc</span><input name="cc" value="${h((v.cc ?? []).join(', '))}" autocomplete="off"></label>
      <label class="feld"><span class="etikett">Betreff</span><input name="betreff" value="${h(v.betreff ?? '')}"></label>
      <label class="feld pf-text"><span class="etikett">Text</span><textarea name="text">${h(v.text ?? '')}</textarea></label>
      <ul class="pf-anhaenge" id="pf-neu-anh"></ul>
      <footer><button class="knopf voll gross" data-senden>Senden</button><button class="knopf" data-anhang>Anhang</button><span></span><button class="knopf leise" data-x>Verwerfen</button></footer>`;
    document.body.append(el);
    const feld = (n: string) => el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${n}"]`)!;
    (v.an?.length ? feld('text') : feld('an')).focus();
    if (v.an?.length) (feld('text') as HTMLTextAreaElement).setSelectionRange(0, 0);
    const anhZeichnen = () => {
      el.querySelector('#pf-neu-anh')!.innerHTML = anhaenge.map((a, i) => `<li><button class="knopf klein" data-weg="${i}">${h(a.name)} ✕</button></li>`).join('');
      el.querySelectorAll<HTMLButtonElement>('[data-weg]').forEach((b) => b.addEventListener('click', () => { anhaenge.splice(Number(b.dataset.weg), 1); anhZeichnen(); }));
    };
    el.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => el.remove()));
    el.querySelector('[data-anhang]')!.addEventListener('click', async () => {
      try { anhaenge = [...anhaenge, ...(await this.api.rufe('pfAnhangWaehlen'))]; anhZeichnen(); } catch (e) { this.melde((e as Error).message); }
    });
    el.querySelector('[data-senden]')!.addEventListener('click', async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement; b.disabled = true; b.textContent = 'Sende …';
      const liste = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      try {
        await this.api.rufe('pfSenden', { an: liste(feld('an').value), cc: liste(feld('cc').value), betreff: feld('betreff').value, text: feld('text').value,
          threadId: v.threadId, inReplyTo: v.inReplyTo, references: v.references, anhaenge });
        el.remove(); this.melde('Gesendet.');
        if (this.aktiv === 'SENT') void this.laden();
      } catch (e) { this.melde((e as Error).message); b.disabled = false; b.textContent = 'Senden'; }
    });
  }
}
