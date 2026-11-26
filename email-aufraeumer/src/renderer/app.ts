// Oberfläche des Email-Aufräumers. Vanilla TypeScript, kein Framework.
import { Strom, type Art } from './strom.js';

type Kategorie = 'wichtig' | 'persoenlich' | 'werbung' | 'newsletter' | 'benachrichtigung' | 'spam' | 'phishing';
type Aktion = 'behalten' | 'label' | 'archivieren' | 'gelesen' | 'abmelden' | 'papierkorb';
interface Eintrag {
  id: number; zeit: number; durchlauf: string; mailId: string; absender: string; betreff: string; kategorie: Kategorie; sicherheit: number;
  stufe: string; begruendung: string; aktionen: Aktion[]; trocken: boolean; rueckgaengig: number | null; status: string; hinweis: string | null;
}
interface Api { rufe(name: string, ...a: unknown[]): Promise<any>; auf(cb: (k: string, d: any) => void): () => void }
declare global { interface Window { aufraeumer: Api } }

const api = window.aufraeumer;
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MUELL: Kategorie[] = ['werbung', 'newsletter', 'spam', 'phishing', 'benachrichtigung'];
const KAT: Record<Kategorie, string> = { wichtig: 'Wichtig', persoenlich: 'Persönlich', werbung: 'Werbung', newsletter: 'Newsletter', benachrichtigung: 'Benachrichtigung', spam: 'Spam', phishing: 'Phishing' };
const AKT: Record<Aktion, string> = { behalten: 'Behalten', label: 'Label', archivieren: 'Archivieren', gelesen: 'Gelesen', abmelden: 'Abmelden', papierkorb: 'Papierkorb' };

let z: any = null;              // Zustand vom Hauptprozess
let ansicht = 'cockpit';
let strom: Strom;
let protokollFilter = { suche: '', kategorie: '' };

// ---------------- Hilfen ----------------
function h(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
const uhr = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const datum = (t: number) => new Date(t).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const zahl = (n: number) => n.toLocaleString('de-DE');

function tatText(e: Eintrag): string {
  if (e.status === 'zu_pruefen') return 'wartet · zu prüfen';
  if (e.status === 'geschuetzt') return 'geschützt';
  if (e.status === 'fehler') return 'Fehler';
  if (e.aktionen.includes('papierkorb')) return '→ Papierkorb';
  if (e.aktionen.includes('archivieren')) return e.aktionen.includes('abmelden') ? '→ Archiv + abmelden' : '→ Archiv';
  if (e.aktionen.includes('abmelden')) return 'abmelden';
  if (e.aktionen.includes('label')) return 'Label';
  if (e.aktionen.includes('gelesen')) return 'gelesen';
  return 'bleibt';
}
function art(e: Eintrag): Art {
  if (e.status === 'zu_pruefen') return 'pruefen';
  return e.aktionen.includes('papierkorb') || e.aktionen.includes('archivieren') ? 'weg' : 'bleibt';
}
function stufeNr(e: Eintrag): 0 | 1 | 2 { return e.stufe === 'regeln' ? 1 : e.stufe === 'ki' ? 2 : 0; }
function rueckgaengigMoeglich(e: Eintrag) {
  return !e.trocken && !e.rueckgaengig && e.status === 'ok' && !(e.aktionen.length === 1 && e.aktionen[0] === 'behalten') && Date.now() - e.zeit < 30 * 86400_000;
}

function melde(text: string) {
  const m = $('#meldung'); m.textContent = text; m.classList.add('an');
  clearTimeout((m as any)._t); (m as any)._t = setTimeout(() => m.classList.remove('an'), 4200);
}

/** Feder (Masse 1, Steifigkeit k, Dämpfung d) statt Easing. */
function feder(von: number, nach: number, setze: (v: number) => void, opt: { k?: number; d?: number; fertig?: () => void } = {}) {
  if (RUHIG) { setze(nach); opt.fertig?.(); return; }
  const k = opt.k ?? 170, d = opt.d ?? 20;
  let x = von, v = 0, letzte = performance.now();
  const s = (t: number) => {
    const dt = Math.min(0.032, (t - letzte) / 1000); letzte = t;
    const a = -k * (x - nach) - d * v; v += a * dt; x += v * dt;
    setze(x);
    if (Math.abs(x - nach) < 0.01 && Math.abs(v) < 0.01) { setze(nach); opt.fertig?.(); return; }
    requestAnimationFrame(s);
  };
  requestAnimationFrame(s);
}

async function bestaetigen(titel: string, text: string, ja: string, rot = false): Promise<boolean> {
  const d = $<HTMLDialogElement>('#dialog');
  d.innerHTML = `<h2 id="dialog-titel">${h(titel)}</h2><p>${text}</p><div class="zeile" data-stil="margin-top:22px">
    <button class="knopf ${rot ? 'rot' : 'voll'}" value="ja">${h(ja)}</button><button class="knopf" value="nein">Abbrechen</button></div>`;
  return new Promise((res) => {
    d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { d.close(); res(b.value === 'ja'); }));
    d.addEventListener('cancel', () => res(false), { once: true });
    d.showModal();
  });
}

async function laden() { z = await api.rufe('zustand'); setzeStatus(z.status); $('#nav-pruefen').textContent = z.statistik.zuPruefen ? String(z.statistik.zuPruefen) : ''; }

// ---------------- Status ----------------
function setzeStatus(s: any) {
  const b = document.body;
  if (!z?.angemeldet) { b.dataset.status = 'aus'; $('#zustand-text').textContent = 'Nicht angemeldet'; return; }
  if (!s) return;
  b.dataset.status = s.status === 'fehler' ? 'fehler' : s.trockenlauf ? 'trockenlauf' : s.status === 'laeuft' ? 'laeuft' : s.status;
  const t = s.status === 'fehler' ? `Fehler – ${s.fehler}` : s.trockenlauf ? `Trockenlauf · Tag ${Math.min(7, 8 - s.trockenlaufRestTage)}/7` : s.status === 'laeuft' ? 'Läuft · scharf' : s.status === 'startet' ? 'startet …' : s.status;
  $('#zustand-text').textContent = t;
  $('#schiene-fuss').innerHTML = `${s.email ? h(s.email) + '<br>' : ''}${s.letzterLauf ? 'Zuletzt geprüft ' + uhr(s.letzterLauf) + '<br>' : ''}alle ${s.intervallSek} s · Quote heute ${zahl(s.quote?.einheiten ?? 0)} E.`;
}

// ---------------- Navigation ----------------
function zeigeAnsicht(ziel: string, fokus = false) {
  const wechsel = () => {
    ansicht = ziel;
    document.body.dataset.ansicht = ziel;
    for (const s of $$('.ansicht')) s.hidden = s.dataset.ansicht !== ziel;
    for (const b of $$('#nav button')) { if (b.dataset.ziel === ziel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    zeiger();
    void zeichne();
    if (fokus) { $('#inhalt').focus({ preventScroll: true }); $('#inhalt').scrollTop = 0; window.scrollTo(0, 0); }
  };
  const dvt = (document as any).startViewTransition;
  if (dvt && !RUHIG) dvt.call(document, wechsel); else wechsel();
}
function zeiger() {
  const aktiv = $(`#nav button[aria-current='page']`);
  const z = $('#nav-zeiger');
  if (!aktiv) return;
  const li = aktiv.parentElement!;
  if (matchMedia('(max-width: 760px)').matches) z.style.setProperty('--x', `${li.offsetLeft}px`);
  else { z.style.setProperty('--y', `${li.offsetTop}px`); z.style.height = `${li.offsetHeight}px`; }
}

async function zeichne() {
  switch (ansicht) {
    case 'cockpit': return cockpit();
    case 'pruefen': return pruefen();
    case 'absender': return absender();
    case 'regeln': return regeln();
    case 'protokoll': return protokoll();
    case 'einstellungen': return einstellungen();
  }
}

// ---------------- 1 Cockpit ----------------
let heldWert = 0;
async function cockpit() {
  const el = $('#ansicht-cockpit');
  if (!z.angemeldet) return anmeldung(el);
  const st = z.statistik; const s = z.status ?? {};
  const trocken = z.einstellungen.trockenlauf;
  const rest = s.trockenlaufRestTage ?? 7;
  const liste: Eintrag[] = await api.rufe('protokoll', { limit: 14 });
  const lesezeit = st.lesezeitMinutenWoche >= 60 ? `${Math.floor(st.lesezeitMinutenWoche / 60)} h ${st.lesezeitMinutenWoche % 60} min` : `${st.lesezeitMinutenWoche} min`;
  el.innerHTML = `
    <h1 class="unsichtbar" id="h-cockpit">Cockpit</h1>
    <div class="held">
      <span class="etikett">${trocken ? 'Heute würde der Aufräumer wegräumen' : 'Heute aus dem Weg geräumt'}</span>
      <span class="held-zahl ${st.heuteEntfernt ? '' : 'null'}" id="held-zahl">${zahl(heldWert)}</span>
      <div class="held-unter"><strong>${trocken ? 'Mails, nur angezeigt' : 'Mails'}</strong><span class="etikett">${zahl(st.heuteGeprueft)} heute geprüft</span></div>
      ${z.demo ? '<span class="demo-band">Demo-Postfach – dein Konto wird nicht berührt</span>' : ''}
    </div>
    <div class="werte">
      <div class="wert"><span class="etikett">Diese Woche</span><b>${zahl(st.wocheEntfernt)}</b></div>
      <div class="wert"><span class="etikett">Lesezeit gespart</span><b>${lesezeit}</b></div>
      <div class="wert ${st.zuPruefen ? 'rot' : ''}"><span class="etikett">Zu prüfen</span><b>${zahl(st.zuPruefen)}</b></div>
    </div>
    <div class="betrieb">
      ${s.status === 'fehler' ? `<div><h2>Fehler</h2><p>${h(s.fehler)}</p></div><button class="knopf voll" data-tat="pruefen">Erneut versuchen</button>` :
        trocken ? `<div><h2>Trockenlauf – Tag ${Math.min(7, 8 - rest)} von 7</h2><p>Es wird nur angezeigt, was passieren würde. ${rest > 0 ? `„Scharf schalten“ geht in ${rest} ${rest === 1 ? 'Tag' : 'Tagen'}.` : 'Die 7 Tage sind um – du kannst scharf schalten.'}</p></div>
          <button class="knopf rot" data-tat="scharf" ${rest > 0 ? 'disabled' : ''}>Scharf schalten</button>
          <div class="trocken-skala" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i class="${i < 7 - rest ? 'voll' : ''}"></i>`).join('')}</div>` :
        `<div><h2>Läuft – scharf</h2><p>Neue Mails werden spätestens nach ${z.einstellungen.intervallSek} s eingeordnet. ${z.kontakte} Kontakte aus „Gesendet“ sind geschützt.</p></div>
          <button class="knopf" data-tat="pruefen">Jetzt prüfen</button>`}
    </div>
    <h2 class="etikett" data-stil="margin:34px 0 0">Live-Strom · letzte Aktionen</h2>
    <ol class="strom-liste" id="strom-liste">${liste.map((e) => stromZeile(e)).join('') || '<li><span></span><span></span><span class="wer"><span>Noch nichts eingeordnet.</span></span></li>'}</ol>`;
  const zielZahl = st.heuteEntfernt;
  const zEl = $('#held-zahl');
  feder(heldWert, zielZahl, (v) => { zEl.textContent = zahl(Math.max(0, Math.round(v))); }, { k: 60, d: 14 });
  heldWert = zielZahl;
  el.querySelector('[data-tat="scharf"]')?.addEventListener('click', async () => {
    if (!(await bestaetigen('Scharf schalten?', 'Ab jetzt werden Mails wirklich verschoben, archiviert und in den Papierkorb gelegt. Endgültig gelöscht wird nie etwas, und jede Aktion lässt sich 30 Tage lang rückgängig machen.', 'Scharf schalten', true))) return;
    const r = await api.rufe('scharfSchalten'); melde(r.ok ? 'Scharf geschaltet.' : r.grund); await laden(); void zeichne();
  });
  el.querySelector('[data-tat="pruefen"]')?.addEventListener('click', async () => { await api.rufe('jetztPruefen'); await laden(); void zeichne(); });
}
function stromZeile(e: Eintrag, neu = false) {
  return `<li class="${neu ? 'neu' : ''}"><span class="zeit">${uhr(e.zeit)}</span><span class="kat ${MUELL.includes(e.kategorie) && art(e) === 'weg' ? 'muell' : ''}">${KAT[e.kategorie]}</span>
    <span class="wer"><b>${h(e.absender)}</b> <span>${h(e.betreff)}</span></span><span class="tat ${e.trocken && e.status === 'ok' && art(e) === 'weg' ? 'trocken' : ''}">${h(tatText(e))}</span></li>`;
}

function anmeldung(el: HTMLElement) {
  el.innerHTML = `<div class="kopf"><h1 id="h-cockpit">Anmelden</h1><p>Einmal einrichten, dann läuft der Aufräumer allein im Hintergrund.</p></div>
    <ol class="anmelde-schritte">
      <li><div><b>Google-Cloud-Projekt anlegen</b><br>Wie das in 10 Minuten geht, steht in der LIESMICH (Gmail-API aktivieren, Zielgruppe „Extern“, Status „In Produktion“).</div></li>
      <li><div><b>OAuth-Client „Desktop-App“ herunterladen</b><br>Die Datei <code>client_secret_….json</code> hier auswählen – sie wird nur auf diesem PC gespeichert.<br>
        <button class="knopf ${z.credentials ? '' : 'voll'}" data-tat="cred" data-stil="margin-top:12px">${z.credentials ? 'Datei ist hinterlegt – ersetzen' : 'credentials.json auswählen'}</button></div></li>
      <li><div><b>Mit Google anmelden</b><br>Erlaubt werden nur „Mails lesen, verschieben, beschriften“ und „Filter verwalten“ – kein endgültiges Löschen.<br>
        <button class="knopf voll" data-tat="login" data-stil="margin-top:12px" ${z.credentials ? '' : 'disabled'}>Mit Google anmelden</button></div></li>
    </ol>`;
  el.querySelector('[data-tat="cred"]')!.addEventListener('click', async () => { try { if (await api.rufe('credentialsWaehlen')) { await laden(); void zeichne(); } } catch (e) { melde((e as Error).message); } });
  el.querySelector('[data-tat="login"]')!.addEventListener('click', async () => {
    melde('Browser geöffnet – bitte dort anmelden.');
    try { await api.rufe('anmelden'); await laden(); void zeichne(); melde('Angemeldet. Trockenlauf startet.'); } catch (e) { melde((e as Error).message); }
  });
}

// ---------------- 2 Zu prüfen ----------------
async function pruefen() {
  const el = $('#ansicht-pruefen');
  const liste = await api.rufe('zuPruefen');
  el.innerHTML = `<div class="kopf"><h1 id="h-pruefen">Zu prüfen</h1><p>Hier war sich der Aufräumer nicht sicher genug (unter ${z.einstellungen.schwelle}&nbsp;%). Jede Entscheidung trainiert eine Regel für diesen Absender.</p></div>
    ${liste.length ? `<ul class="pruef-liste">${liste.map((p: any) => `
      <li class="pruef" data-id="${h(p.mailId)}">
        <div><span class="von">${h(p.name || p.absender)} · ${h(p.absender)}</span><h3>${h(p.betreff || '(ohne Betreff)')}</h3>
          ${p.snippet ? `<p class="vorschau">${h(p.snippet)}</p>` : ''}
          <p class="warum"><b>${KAT[p.kategorie as Kategorie]} · ${p.sicherheit} %</b> – ${h(p.begruendung)}</p></div>
        <div class="pruef-knoepfe"><button class="knopf" data-wahl="behalten">Behalten</button><button class="knopf rot" data-wahl="weg">Weg damit</button></div>
      </li>`).join('')}</ul>` : '<p class="leer">Nichts offen. Alles, was reinkam, war eindeutig.</p>'}`;
  for (const b of $$('[data-wahl]', el)) b.addEventListener('click', async () => {
    const li = b.closest('.pruef') as HTMLElement; const wahl = b.dataset.wahl as 'behalten' | 'weg';
    $$('button', li).forEach((x) => ((x as HTMLButtonElement).disabled = true));
    try {
      const r = await api.rufe('entscheide', li.dataset.id, wahl);
      melde(wahl === 'weg' ? `Gelernt: ${r.regel.wert} → weg (${r.regel.bestaetigt}× bestätigt).` : `Gelernt: ${r.regel.wert} wird behalten.`);
      // Feder-Wurf: weg = nach rechts in die Rinne, behalten = sinkt ab
      feder(0, 1, (v) => {
        li.style.transform = wahl === 'weg' ? `translateX(${v * 110}%) rotate(${v * 4}deg)` : `translateY(${v * 18}px)`;
        li.style.opacity = String(1 - v);
      }, { k: 120, d: 16, fertig: () => { li.remove(); if (!$('.pruef', el)) void pruefen(); } });
      await laden();
    } catch (e) { melde((e as Error).message); $$('button', li).forEach((x) => ((x as HTMLButtonElement).disabled = false)); }
  });
}

// ---------------- 3 Absender ----------------
async function absender() {
  const el = $('#ansicht-absender');
  const liste = await api.rufe('absender');
  const max = Math.max(1, ...liste.map((a: any) => a.anzahl));
  el.innerHTML = `<div class="kopf"><h1 id="h-absender">Absender</h1><p>Wer am meisten schickt. Der Balken zeigt die Menge, schwarz = davon geöffnet.</p></div>
    ${liste.length ? `<ul class="absender-liste">${liste.map((a: any) => `
      <li class="absender" data-adr="${h(a.adresse)}">
        <span class="menge">${zahl(a.anzahl)}</span>
        <div><div class="name">${h(a.name)}</div><div class="adr">${h(a.adresse)} · ${a.gelesen} von ${a.anzahl} geöffnet${a.kategorie ? ' · ' + KAT[a.kategorie as Kategorie] : ''}${a.abgemeldet ? ' · abgemeldet' : ''}</div>
          <div class="balken" data-stil="width:${Math.max(6, (a.anzahl / max) * 100)}%"><u></u><i data-stil="width:${(a.gelesen / a.anzahl) * 100}%"></i></div></div>
        <div class="absender-knoepfe">
          <button class="knopf klein" data-akt="immer_behalten">Immer behalten</button>
          <button class="knopf klein weg" data-akt="immer_weg">Immer weg</button>
          <button class="knopf klein" data-akt="abmelden" ${!a.abmeldbar || a.abgemeldet || a.kategorie === 'phishing' ? 'disabled' : ''} title="${a.kategorie === 'phishing' ? 'Bei Phishing-Verdacht wird nie abgemeldet' : a.abmeldbar ? 'Über den List-Unsubscribe-Header' : 'Kein Abmelde-Header'}">Abmelden</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="leer">Noch keine Absender gezählt.</p>'}`;
  for (const b of $$('[data-akt]', el)) b.addEventListener('click', async () => {
    const adr = (b.closest('.absender') as HTMLElement).dataset.adr!;
    if (b.dataset.akt === 'abmelden' && !(await bestaetigen('Abmelden?', `Der Aufräumer meldet <b>${h(adr)}</b> über den Abmelde-Header der Mail ab (One-Click oder Abmelde-Mail). Links aus dem Mail-Text werden nie geöffnet. Abmelden lässt sich nicht rückgängig machen.`, 'Abmelden'))) return;
    melde(await api.rufe('absenderAktion', adr, b.dataset.akt)); await laden(); void absender();
  });
}

// ---------------- 4 Regeln ----------------
function zielText(kat: Kategorie | null): string {
  if (!kat) return 'nie angefasst';
  const a: Aktion[] = z.einstellungen.aktionen[kat] ?? [];
  if (a.includes('papierkorb')) return 'Papierkorb';
  if (a.includes('behalten') || !a.length) return 'behalten';
  return `${KAT[kat]}: ${a.filter((x) => x !== 'abmelden').map((x) => AKT[x].toLowerCase()).join(', ')}`;
}
async function regeln() {
  const el = $('#ansicht-regeln');
  const { regeln: liste, kandidaten } = await api.rufe('regeln');
  const wer = (r: any) => r.feld === 'adresse' ? `von <em>${h(r.wert)}</em>` : r.feld === 'domain' ? `von <em>@${h(r.wert)}</em>` : `mit <em>„${h(r.wert)}“</em>`;
  el.innerHTML = `<div class="kopf"><h1 id="h-regeln">Regeln</h1><p>Jede Regel als Satz. Eindeutige Regeln laufen zusätzlich als echter Gmail-Filter – auch wenn der PC aus ist.</p></div>
    <form class="neue-regel" id="neue-regel">
      <label class="feld"><span class="etikett">Liste</span><select name="art"><option value="schwarz">Schwarze Liste</option><option value="weiss">Weiße Liste</option></select></label>
      <label class="feld"><span class="etikett">Bedingung</span><select name="feld"><option value="adresse">Adresse</option><option value="domain">Domain</option><option value="stichwort">Stichwort</option></select></label>
      <label class="feld"><span class="etikett">Wert</span><input name="wert" required placeholder="z. B. deals@shop.de"></label>
      <label class="feld"><span class="etikett">Ziel</span><select name="kat">${MUELL.map((k) => `<option value="${k}">${KAT[k]}</option>`).join('')}</select></label>
      <button class="knopf voll">Regel anlegen</button>
    </form>
    ${liste.length ? `<ul class="regel-liste">${liste.map((r: any) => `
      <li class="regel ${r.aktiv ? '' : 'aus'}" data-id="${r.id}">
        <div class="satz">Mails ${wer(r)} → <span class="${r.art === 'weiss' ? 'schutz' : 'ziel'}">${h(zielText(r.kategorie))}</span></div>
        <button class="schalter" role="switch" aria-checked="${r.aktiv}" aria-label="Regel ${r.aktiv ? 'ausschalten' : 'einschalten'}" data-tat="schalten"></button>
        <button class="knopf leise loeschen" data-tat="loeschen">Löschen</button>
        <div class="meta"><span>${r.art === 'weiss' ? 'Weiße Liste' : r.art === 'schwarz' ? 'Schwarze Liste' : `Gelernt · ${r.bestaetigt}× bestätigt`}</span>
          ${r.gmailFilterId ? '<span class="gmail-aktiv">läuft auch in Gmail</span>' : kandidaten.includes(r.id) ? `<span>${z.einstellungen.trockenlauf ? 'wird Gmail-Filter, sobald scharf geschaltet' : z.einstellungen.filterExportFreigegeben ? 'Gmail-Filter wird angelegt' : 'Gmail-Filter wartet auf deine Zustimmung'}</span>` : ''}</div>
      </li>`).join('')}</ul>` : '<p class="leer">Noch keine Regeln. Sie entstehen, wenn du in „Zu prüfen“ entscheidest.</p>'}`;
  const form = $<HTMLFormElement>('#neue-regel');
  const artSel = form.elements.namedItem('art') as HTMLSelectElement;
  const katSel = form.elements.namedItem('kat') as HTMLSelectElement;
  artSel.addEventListener('change', () => { katSel.disabled = artSel.value === 'weiss'; });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    await api.rufe('regelAnlegen', f.get('art'), f.get('feld'), String(f.get('wert')), f.get('art') === 'weiss' ? null : f.get('kat'));
    melde('Regel angelegt.'); void regeln();
  });
  for (const b of $$('[data-tat]', el)) b.addEventListener('click', async () => {
    const li = b.closest('.regel') as HTMLElement; const id = Number(li.dataset.id);
    if (b.dataset.tat === 'schalten') {
      const an = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(an)); li.classList.toggle('aus', !an);
      await api.rufe('regelSchalten', id, an);
    } else if (await bestaetigen('Regel löschen?', 'Ein zugehöriger Gmail-Filter wird ebenfalls entfernt.', 'Löschen')) {
      await api.rufe('regelLoeschen', id); void regeln();
    }
  });
}

// ---------------- 5 Protokoll ----------------
async function protokoll() {
  const el = $('#ansicht-protokoll');
  if (!el.querySelector('#suche')) {
    el.innerHTML = `<div class="kopf"><h1 id="h-protokoll">Protokoll</h1><p>Jede Aktion mit Begründung. Rückgängig geht 30 Tage lang – einzeln oder für einen ganzen Durchlauf.</p></div>
      <div class="werkzeug">
        <label class="feld"><span class="etikett">Suche</span><input type="search" id="suche" placeholder="Absender, Betreff, Grund"></label>
        <label class="feld"><span class="etikett">Kategorie</span><select id="kat-filter"><option value="">Alle</option>${Object.entries(KAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div><div id="protokoll-liste"></div>`;
    let t: any;
    $('#suche', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { protokollFilter.suche = (e.target as HTMLInputElement).value; void protokollListe(); }, 220); });
    $('#kat-filter', el).addEventListener('change', (e) => { protokollFilter.kategorie = (e.target as HTMLSelectElement).value; void protokollListe(); });
  }
  await protokollListe();
}
async function protokollListe() {
  const ziel = $('#protokoll-liste');
  const liste: Eintrag[] = await api.rufe('protokoll', { ...protokollFilter, limit: 300 });
  const gruppen = new Map<string, Eintrag[]>();
  for (const e of liste) { if (!gruppen.has(e.durchlauf)) gruppen.set(e.durchlauf, []); gruppen.get(e.durchlauf)!.push(e); }
  // Einzelne Mails aus normalen Durchläufen laufen als fortlaufender Strom, nur echte Stapel bekommen einen eigenen Kopf
  const bloecke: Array<[string, Eintrag[]]> = [];
  for (const [lauf, es] of gruppen) {
    const einzeln = lauf.startsWith('lauf-') && es.length === 1;
    const letzter = bloecke[bloecke.length - 1];
    if (einzeln && letzter && letzter[0] === 'fortlaufend') letzter[1].push(...es);
    else bloecke.push([einzeln ? 'fortlaufend' : lauf, [...es]]);
  }
  ziel.innerHTML = liste.length ? bloecke.map(([lauf, es]) => {
    const offen = es.filter(rueckgaengigMoeglich).length;
    const name = lauf === 'fortlaufend' ? 'Laufend' : lauf.startsWith('altbestand') ? 'Altbestand' : lauf.startsWith('entscheidung') ? 'Deine Entscheidung' : lauf.startsWith('abmelden') ? 'Abmeldung' : 'Durchlauf';
    return `<section class="lauf"><div class="lauf-kopf"><span class="etikett">${name} · ${datum(es[es.length - 1].zeit)} · ${es.length} ${es.length === 1 ? 'Mail' : 'Mails'}</span>
      ${offen > 1 && lauf !== 'fortlaufend' ? `<button class="knopf klein" data-lauf="${h(lauf)}">Ganzen Durchlauf rückgängig (${offen})</button>` : ''}</div>
      ${es.map((e) => `<div class="eintrag ${e.rueckgaengig ? 'zurueck' : ''}"><span class="zeit">${uhr(e.zeit)}</span><span class="kat ${MUELL.includes(e.kategorie) ? 'muell' : ''}">${KAT[e.kategorie]} ${e.sicherheit}%</span>
        <span class="wer"><b>${h(e.absender)}</b> <span>${h(e.betreff)}</span></span>
        <div class="rechts"><span class="tat ${e.trocken && art(e) === 'weg' && e.status === 'ok' ? 'trocken' : ''}">${h(tatText(e))}</span>
          ${e.rueckgaengig ? '<span class="etikett">rückgängig gemacht</span>' : rueckgaengigMoeglich(e) ? `<button class="knopf klein leise" data-id="${e.id}">Rückgängig</button>` : ''}</div>
        <span class="grund">${h(e.begruendung)}${e.hinweis ? ' ' + h(e.hinweis) : ''}</span></div>`).join('')}</section>`;
  }).join('') : '<p class="leer">Keine Einträge.</p>';
  for (const b of $$('[data-id]', ziel)) b.addEventListener('click', async () => {
    const r = await api.rufe('rueckgaengig', Number(b.dataset.id)); melde(r.ok ? 'Wiederhergestellt – Labels, Ordner und gelesen-Status wie vorher.' : r.grund); void protokollListe(); void laden();
  });
  for (const b of $$('[data-lauf]', ziel)) b.addEventListener('click', async () => {
    if (!(await bestaetigen('Ganzen Durchlauf rückgängig?', 'Alle Mails dieses Durchlaufs werden exakt wiederhergestellt.', 'Rückgängig machen'))) return;
    const r = await api.rufe('durchlaufRueckgaengig', b.dataset.lauf); melde(`${r.ok} wiederhergestellt${r.fehler ? `, ${r.fehler} nicht möglich` : ''}.`); void protokollListe(); void laden();
  });
}

// ---------------- 6 Einstellungen ----------------
const schwelleZuRegler = (s: number) => Math.round((98 - s) / 0.4);
const reglerZuSchwelle = (r: number) => Math.round(98 - r * 0.4);
async function einstellungen() {
  const el = $('#ansicht-einstellungen');
  await laden();
  const e = z.einstellungen; const ab = z.altbestand;
  const akt: Aktion[] = ['behalten', 'label', 'archivieren', 'gelesen', 'abmelden', 'papierkorb'];
  el.innerHTML = `<div class="kopf"><h1 id="h-einstellungen">Einstellungen</h1><p>Alles wird sofort gespeichert.</p></div>
    <div class="einst"><div><h2>Betrieb</h2><p class="erkl">${e.trockenlauf ? `Trockenlauf – noch ${z.status?.trockenlaufRestTage ?? 7} Tage, dann kannst du im Cockpit scharf schalten.` : 'Scharf geschaltet.'}</p></div>
      <div class="zeile">${e.trockenlauf ? '<span class="etikett">Trockenlauf aktiv – es wird nichts verändert</span>' : '<button class="knopf" data-tat="trocken">Zurück in den Trockenlauf</button>'}</div></div>
    <div class="einst"><div><h2>Intervall</h2><p class="erkl">Wie oft nach neuen Mails geschaut wird.</p></div>
      <div class="regler"><span class="regler-wert" id="intervall-wert">${e.intervallSek} s</span><input type="range" min="15" max="600" step="15" value="${e.intervallSek}" id="intervall" aria-label="Intervall in Sekunden">
      <div class="regler-enden"><span>15 s</span><span>10 min</span></div></div></div>
    <div class="einst"><div><h2>Aggressivität</h2><p class="erkl">Bestimmt die Sicherheitsschwelle. Darunter wird nichts verschoben – die Mail landet in „Zu prüfen“.</p></div>
      <div class="regler"><span class="regler-wert" id="schwelle-wert">${e.schwelle} %</span><input type="range" min="0" max="100" value="${schwelleZuRegler(e.schwelle)}" id="schwelle" aria-label="Aggressivität">
      <div class="regler-enden"><span>vorsichtig</span><span>streng</span></div></div></div>
    <div class="einst"><div><h2>Aktionen</h2><p class="erkl">Was pro Kategorie passiert. „Abmelden“ nur über den Abmelde-Header und nur bei Absendern, deren Mails du nie öffnest – nie bei Phishing.</p></div>
      <table class="matrix"><thead><tr><th>Kategorie</th>${akt.map((a) => `<th>${AKT[a]}</th>`).join('')}</tr></thead><tbody>
      ${(Object.keys(KAT) as Kategorie[]).map((k) => `<tr><td>${KAT[k].replace('Benachrichtigung', 'Benachrich&shy;tigung')}</td>${akt.map((a) => `<td><button class="haken ${a === 'papierkorb' ? 'rot' : ''}" role="checkbox" aria-checked="${(e.aktionen[k] ?? []).includes(a)}" aria-label="${KAT[k]}: ${AKT[a]}" data-k="${k}" data-a="${a}" ${(a === 'abmelden' && k === 'phishing') ? 'disabled' : ''}></button></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
    <div class="einst"><div><h2>Schutzwörter</h2><p class="erkl">Mails mit diesen Wörtern in Betreff, Vorschau oder Absender werden nie angefasst. Ein Wort pro Zeile.</p></div>
      <label class="feld"><span class="unsichtbar">Schutzwörter</span><textarea id="schutz" rows="6">${h(e.schutzwoerter.join('\n'))}</textarea></label></div>
    <div class="einst"><div><h2>KI-Stufe</h2><p class="erkl">Nur für unsichere Fälle, mit Claude Haiku. Es gehen nur Absender, Betreff und Vorschau raus – nie der Text, nie Anhänge. Schlüssel über die Umgebungsvariable ANTHROPIC_API_KEY.</p></div>
      <div class="zeile"><button class="schalter" role="switch" id="ki" aria-checked="${e.kiAn}" aria-label="KI-Stufe"></button>
        <label class="feld"><span class="etikett">Budget pro Monat (€)</span><input type="number" id="budget" min="0" step="0.5" value="${e.kiBudgetEuro}" data-stil="width:120px"></label>
        <span class="etikett">${z.ki.schluessel ? `diesen Monat ${z.ki.ausgegebenEuro.toFixed(2).replace('.', ',')} €` : 'kein API-Schlüssel gefunden'}</span></div></div>
    <div class="einst"><div><h2>Gmail-Filter</h2><p class="erkl">Eindeutige Regeln (Schwarze Liste oder ${e.filterExportAb}× bestätigt) werden echte Gmail-Filter und wirken auch bei ausgeschaltetem PC. Schutzwörter werden im Filter ausgenommen.</p></div>
      <div class="zeile"><button class="schalter" role="switch" id="filter" aria-checked="${e.filterExportFreigegeben}" aria-label="Gmail-Filter anlegen erlauben"></button><span>${e.filterExportFreigegeben ? 'Erlaubt' : 'Noch nicht erlaubt'}</span></div></div>
    <div class="einst"><div><h2>Autostart</h2><p class="erkl">Startet mit Windows unsichtbar im Infobereich.</p></div>
      <div class="zeile"><button class="schalter" role="switch" id="autostart" aria-checked="${e.autostart}" aria-label="Autostart"></button></div></div>
    <div class="einst"><div><h2>Altbestand</h2><p class="erkl">Einmal den ganzen Posteingang aufräumen. Erst Vorschau, dann Start. Abgemeldet wird dabei nicht.</p></div>
      <div id="altbestand">${altbestandHtml(ab)}</div></div>`;

  const speichere = (teil: object) => api.rufe('speichereEinstellungen', teil).then((n: any) => { z.einstellungen = n; });
  const iv = $<HTMLInputElement>('#intervall', el); iv.addEventListener('input', () => { $('#intervall-wert').textContent = `${iv.value} s`; }); iv.addEventListener('change', () => speichere({ intervallSek: Number(iv.value) }));
  const sw = $<HTMLInputElement>('#schwelle', el); sw.addEventListener('input', () => { $('#schwelle-wert').textContent = `${reglerZuSchwelle(Number(sw.value))} %`; }); sw.addEventListener('change', () => speichere({ schwelle: reglerZuSchwelle(Number(sw.value)) }));
  for (const b of $$('.haken', el)) b.addEventListener('click', () => {
    const k = b.dataset.k as Kategorie; const a = b.dataset.a as Aktion;
    let liste: Aktion[] = [...(z.einstellungen.aktionen[k] ?? [])];
    if (liste.includes(a)) liste = liste.filter((x) => x !== a);
    else liste = a === 'behalten' ? ['behalten'] : [...liste.filter((x) => x !== 'behalten'), a];
    if (!liste.length) liste = ['behalten'];
    for (const x of $$(`.haken[data-k="${k}"]`, el)) x.setAttribute('aria-checked', String(liste.includes(x.dataset.a as Aktion)));
    void speichere({ aktionen: { ...z.einstellungen.aktionen, [k]: liste } });
  });
  $('#schutz', el).addEventListener('change', (ev) => speichere({ schutzwoerter: (ev.target as HTMLTextAreaElement).value.split('\n').map((s) => s.trim()).filter(Boolean) }));
  $('#budget', el).addEventListener('change', (ev) => speichere({ kiBudgetEuro: Math.max(0, Number((ev.target as HTMLInputElement).value) || 0) }));
  const schalter = (id: string, f: (an: boolean) => Promise<unknown> | void) => $(`#${id}`, el).addEventListener('click', async (ev) => {
    const b = ev.currentTarget as HTMLElement; const an = b.getAttribute('aria-checked') !== 'true';
    if ((await f(an)) === false) return; b.setAttribute('aria-checked', String(an));
  });
  schalter('ki', (an) => speichere({ kiAn: an }));
  schalter('autostart', (an) => speichere({ autostart: an }));
  schalter('filter', async (an) => {
    if (an && !(await filterFrage())) return false;
    if (!an) await speichere({ filterExportFreigegeben: false });
  });
  el.querySelector('[data-tat="trocken"]')?.addEventListener('click', async () => { await api.rufe('trockenlaufWieder'); await laden(); void einstellungen(); });
  altbestandKnoepfe();
}

function altbestandHtml(ab: any): string {
  if (!ab || ab.phase === 'leer') return '<button class="knopf voll" data-ab="vorschau">Vorschau erstellen</button>';
  const prozent = ab.gesamt ? Math.round((ab.erledigt / ab.gesamt) * 100) : 0;
  const zaehler = `<div class="zaehler-liste">${Object.entries(ab.zaehler).map(([k, n]) => `<span><b>${zahl(n as number)}</b>${KAT[k as Kategorie]}</span>`).join('')}</div>`;
  if (ab.phase === 'vorschau') return `<span class="etikett">Vorschau läuft – ${zahl(ab.erledigt)} von ${zahl(ab.gesamt)}</span><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>${zaehler}`;
  if (ab.phase === 'bereit') return `<span class="etikett">${zahl(ab.gesamt)} Mails im Posteingang eingeordnet – noch nichts verändert</span>${zaehler}
    ${ab.beispiele.length ? `<ul class="beispiele">${ab.beispiele.map((b: any) => `<li>${KAT[b.kategorie as Kategorie]} · ${h(b.absender)} – ${h(b.betreff)}</li>`).join('')}</ul>` : ''}
    <div class="zeile"><button class="knopf rot" data-ab="start">${z.einstellungen.trockenlauf ? 'Im Trockenlauf durchspielen' : 'Jetzt aufräumen'}</button><button class="knopf" data-ab="vorschau">Neu berechnen</button></div>`;
  if (ab.phase === 'laeuft') return `<span class="etikett">Räumt auf – ${zahl(ab.erledigt)} von ${zahl(ab.gesamt)}</span><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>`;
  return `<span class="etikett">Fertig – ${zahl(ab.gesamt)} Mails durchgesehen. Rückgängig im Protokoll unter „Altbestand“.</span>${zaehler}<div class="zeile"><button class="knopf" data-ab="vorschau">Erneut prüfen</button></div>`;
}
function altbestandKnoepfe() {
  for (const b of $$('[data-ab]')) b.addEventListener('click', async () => {
    try {
      if (b.dataset.ab === 'vorschau') await api.rufe('altbestandVorschau');
      else if (await bestaetigen('Altbestand aufräumen?', z.einstellungen.trockenlauf ? 'Trockenlauf: es wird nur protokolliert, was passieren würde.' : 'Die eingestellten Aktionen werden auf den ganzen Posteingang angewendet. Geschützte und unsichere Mails bleiben liegen. Alles ist 30 Tage rückgängig machbar.', 'Starten', !z.einstellungen.trockenlauf)) await api.rufe('altbestandStarten');
    } catch (e) { melde((e as Error).message); }
  });
}

async function filterFrage(anzahl?: number): Promise<boolean> {
  const ok = await bestaetigen('Gmail-Filter anlegen?', `${anzahl ? `${anzahl} eindeutige ${anzahl === 1 ? 'Regel ist' : 'Regeln sind'} bereit. ` : ''}Der Aufräumer legt dafür echte Filter in deinem Gmail an. Sie wirken auch, wenn der PC aus ist, nehmen Mails mit Schutzwörtern aus und verschwinden, wenn du die Regel ausschaltest.`, 'Filter erlauben');
  if (ok) { const r = await api.rufe('filterFreigeben'); melde(`${r.angelegt} Gmail-Filter angelegt.`); await laden(); }
  return ok;
}

// ---------------- Live-Ereignisse ----------------
let statistikTimer: any;
function ereignis(kanal: string, d: any) {
  if (kanal === 'aktion' && d) {
    strom.mail(art(d), stufeNr(d), d.id);
    const ol = document.getElementById('strom-liste');
    if (ol && ansicht === 'cockpit') {
      ol.insertAdjacentHTML('afterbegin', stromZeile(d, true));
      while (ol.children.length > 14) ol.lastElementChild!.remove();
    }
    clearTimeout(statistikTimer);
    statistikTimer = setTimeout(async () => {
      await laden(); strom.setzePruefen(z.statistik.zuPruefen);
      if (ansicht === 'cockpit') {
        const ziel = z.statistik.heuteEntfernt; const el = document.getElementById('held-zahl');
        if (el && ziel !== heldWert) { el.classList.toggle('null', !ziel); feder(heldWert, ziel, (v) => { el.textContent = zahl(Math.max(0, Math.round(v))); }, { k: 60, d: 14 }); heldWert = ziel; }
      }
    }, 400);
  } else if (kanal === 'status') { if (z) { z.status = d; setzeStatus(d); } }
  else if (kanal === 'altbestand') { if (z) z.altbestand = d; const ab = document.getElementById('altbestand'); if (ab) { ab.innerHTML = altbestandHtml(d); altbestandKnoepfe(); } }
  else if (kanal === 'frage' && d?.art === 'filter') { void filterFrage(d.anzahl); }
  else if (kanal === 'sichtbar') { d ? strom.start() : strom.pause(); }
}

// CSP erlaubt keine style-Attribute im HTML – Breiten u. ä. werden per CSSOM gesetzt.
function stile(wurzel: ParentNode) {
  for (const el of wurzel.querySelectorAll<HTMLElement>('[data-stil]')) { el.style.cssText = el.dataset.stil!; el.removeAttribute('data-stil'); }
}
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) { if (n.dataset.stil) stile(n.parentElement!); stile(n); } })
  .observe(document.body, { childList: true, subtree: true });

// ---------------- Start ----------------
async function start() {
  strom = new Strom($<HTMLCanvasElement>('#strom'));
  (window as any).__strom = strom;
  const beschriften = () => {
    const g = strom.geometrie();
    $$('[data-m]').forEach((s) => { s.style.top = `${g.membranen[Number(s.dataset.m)]}px`; });
    const r = $('[data-rinne]'); r.style.top = `${g.membranen[0] + 20}px`;
    const b = $('[data-boden]'); b.style.top = `${g.boden + 18}px`; b.style.display = g.hoehe > 260 ? '' : 'none';
    // Rinne: schräger Überlauf von der ersten Membran in einen senkrechten Schacht
    const y0 = g.membranen[0], xl = g.rinne - 22, xr = g.rinne + 24;
    const w = (k: string, css: string) => { $(`[data-wand="${k}"]`).style.cssText = css; };
    const dx = xl - (g.mx1 + 4), dy = 26;
    w('schraeg', `left:${g.mx1 + 4}px;top:${y0}px;width:${Math.hypot(dx, dy)}px;height:1.5px;transform:rotate(${Math.atan2(dy, dx)}rad)`);
    w('links', `left:${xl}px;top:${y0 + 26}px;bottom:0;width:1.5px`);
    w('rechts', `left:${xr}px;top:${y0 - 40}px;bottom:0;width:1.5px`);
  };
  new ResizeObserver(beschriften).observe($('#anlage'));
  addEventListener('resize', zeiger);
  for (const b of $$('#nav button')) b.addEventListener('click', () => zeigeAnsicht(b.dataset.ziel!, true));
  api.auf(ereignis);
  await laden();
  zeigeAnsicht(new URLSearchParams(location.search).get('ansicht') ?? 'cockpit');
  strom.start();
  // Bereits vorhandene Einträge als ruhiges Sediment/Rinne vorbefüllen
  const alt: Eintrag[] = await api.rufe('protokoll', { limit: 30 });
  alt.reverse().forEach((e, i) => setTimeout(() => strom.mail(art(e), stufeNr(e)), i * 90));
  setTimeout(() => strom.setzePruefen(z.statistik.zuPruefen), 3000);
  (window as any).__bereit = true;
}
void start();
