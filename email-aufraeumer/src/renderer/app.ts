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
const KAT: Record<Kategorie, string> = { wichtig: 'Wichtig', persoenlich: 'Persönlich', werbung: 'Werbung', newsletter: 'Newsletter', benachrichtigung: 'Benachrichtigung', spam: 'Spam', phishing: 'Betrug' };
const AKT: Record<Aktion, string> = { behalten: 'Behalten', label: 'Etikett', archivieren: 'Archiv', gelesen: 'Gelesen', abmelden: 'Abmelden', papierkorb: 'Papierkorb' };

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
  if (e.status === 'zu_pruefen') return 'wartet auf dich';
  if (e.status === 'geschuetzt') return 'geschützt';
  if (e.status === 'fehler') return 'Fehler';
  if (e.aktionen.includes('papierkorb')) return 'in den Papierkorb';
  if (e.aktionen.includes('archivieren')) return e.aktionen.includes('abmelden') ? 'ins Archiv + abmelden' : 'ins Archiv';
  if (e.aktionen.includes('abmelden')) return 'abmelden';
  if (e.aktionen.includes('label')) return 'bleibt, mit Etikett';
  if (e.aktionen.includes('gelesen')) return 'als gelesen markiert';
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
  const t = s.status === 'fehler' ? 'Problem · siehe Übersicht' : s.status === 'startet' ? 'richtet sich ein …' : s.trockenlauf ? `Probelauf · Tag ${Math.min(7, 8 - s.trockenlaufRestTage)}/7` : s.status === 'laeuft' ? 'Läuft · räumt auf' : s.status === 'startet' ? 'startet …' : s.status;
  $('#zustand-text').textContent = t;
  $('#schiene-fuss').innerHTML = `${s.email ? h(s.email) + '<br>' : ''}${s.letzterLauf ? 'Zuletzt nachgeschaut ' + uhr(s.letzterLauf) : 'Noch nicht nachgeschaut'}`;
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
  const probe = z.einstellungen.trockenlauf;
  const rest = s.trockenlaufRestTage ?? 7;
  const tag = Math.min(7, 8 - rest);
  const liste: Eintrag[] = await api.rufe('protokoll', { limit: 12 });
  const lesezeit = st.lesezeitMinutenWoche >= 60 ? `${Math.floor(st.lesezeitMinutenWoche / 60)} Std. ${st.lesezeitMinutenWoche % 60} Min.` : `${st.lesezeitMinutenWoche} Min.`;

  // Die Ansage: ein Satz, was gerade los ist, und was Tiry tun muss
  let titel: string, text: string, schritt: string, knopf = '';
  if (s.status === 'fehler') {
    titel = 'Es hakt gerade.';
    text = `Google meldet: „${h(s.fehler)}“. Deine Mails sind sicher – es wurde nichts verändert.`;
    schritt = 'Drück auf „Nochmal versuchen“. Hilft das nicht, schick einen Screenshot.';
    knopf = '<button class="knopf voll gross" data-tat="pruefen">Nochmal versuchen</button>';
  } else if (s.status === 'startet') {
    titel = 'Ich richte mich ein …';
    text = 'Ich lese gerade, wem du schon geschrieben hast. Diese Leute fasse ich nie an. Das dauert 1–2 Minuten.';
    schritt = 'Du musst nichts tun.';
  } else if (probe) {
    titel = 'Alles läuft. Du musst nichts tun.';
    text = `Ich schaue jede Minute nach neuen Mails. Noch ist <b>Probelauf</b>: Ich zeige dir nur, was ich wegräumen würde – angefasst wird nichts.`;
    schritt = rest > 0 ? `In ${rest} ${rest === 1 ? 'Tag' : 'Tagen'} kannst du hier auf „Jetzt wirklich aufräumen“ drücken.` : 'Die 7 Probetage sind um. Wenn dir gefällt, was du unten siehst: los.';
    knopf = `<button class="knopf rot gross" data-tat="scharf" ${rest > 0 ? 'disabled' : ''}>Jetzt wirklich aufräumen</button>`;
  } else {
    titel = 'Alles läuft. Ich räume auf.';
    text = `Neue Mails sortiere ich innerhalb einer Minute. Rechnungen, Verträge und Leute, denen du schreibst, fasse ich nie an.`;
    schritt = 'Du musst nichts tun. Alles lässt sich unter „Verlauf“ 30 Tage lang zurückholen.';
  }

  el.innerHTML = `
    <h1 class="unsichtbar" id="h-cockpit">Übersicht</h1>
    ${z.demo ? '<span class="demo-band">Demo – dein echtes Postfach wird nicht berührt</span>' : ''}
    <section class="ansage ${s.status === 'fehler' ? 'fehler' : ''}" aria-live="polite">
      <h2 class="ansage-titel">${titel}</h2>
      <p class="ansage-text">${text}</p>
      ${probe && s.status !== 'fehler' ? `<div class="probetage" aria-label="Probelauf Tag ${tag} von 7">${Array.from({ length: 7 }, (_, i) => `<i class="${i < tag ? 'voll' : ''}"><span>${i + 1}</span></i>`).join('')}</div>` : ''}
      <div class="ansage-fuss"><p><span class="etikett">Was jetzt?</span> ${schritt}</p>${knopf}</div>
    </section>

    <div class="zahlen">
      <div class="zahl-gross"><b class="held-zahl ${st.heuteEntfernt ? '' : 'null'}" id="held-zahl">${zahl(heldWert)}</b>
        <span>${probe ? 'Mails hätte ich heute<br>weggeräumt' : 'Mails heute<br>weggeräumt'}</span></div>
      <dl class="zahlen-klein">
        <div><dt>Diese Woche</dt><dd id="z-woche">${zahl(st.wocheEntfernt)}</dd></div>
        <div><dt>Gesparte Lesezeit</dt><dd id="z-lesezeit">${lesezeit}</dd></div>
        <div class="${st.zuPruefen ? 'rot' : ''}"><dt>Wartet auf dich</dt><dd>${zahl(st.zuPruefen)}${st.zuPruefen ? ' <button class="knopf klein" data-tat="zu-pruefen">Ansehen</button>' : ''}</dd></div>
      </dl>
    </div>

    <h2 class="abschnitt">Was zuletzt passiert ist</h2>
    <ol class="strom-liste" id="strom-liste">${liste.map((e) => stromZeile(e)).join('') || '<li class="leer-zeile">Noch keine neue Mail angekommen. Sobald eine kommt, steht sie hier.</li>'}</ol>
    <dl class="legende">
      <div><dt>Archiv</dt><dd>raus aus dem Posteingang, aber nicht gelöscht – in Gmail unter „Alle Nachrichten“.</dd></div>
      <div><dt>Papierkorb</dt><dd>Gmail löscht nach 30 Tagen. Bis dahin holst du alles mit einem Klick zurück.</dd></div>
      <div><dt>Geschützt</dt><dd>Rechnungen, Verträge, Bank, Leute, denen du schreibst – fasse ich nie an.</dd></div>
    </dl>`;
  const zielZahl = st.heuteEntfernt;
  const zEl = $('#held-zahl');
  feder(heldWert, zielZahl, (v) => { zEl.textContent = zahl(Math.max(0, Math.round(v))); }, { k: 60, d: 14 });
  heldWert = zielZahl;
  el.querySelector('[data-tat="scharf"]')?.addEventListener('click', async () => {
    if (!(await bestaetigen('Jetzt wirklich aufräumen?', 'Ab jetzt räume ich Mails wirklich weg: ins Archiv oder in den Papierkorb. <b>Endgültig gelöscht wird nie etwas.</b> Unter „Verlauf“ holst du 30 Tage lang alles mit einem Klick zurück.', 'Ja, aufräumen', true))) return;
    const r = await api.rufe('scharfSchalten'); melde(r.ok ? 'Los geht’s – ab jetzt wird aufgeräumt.' : r.grund); await laden(); void zeichne();
  });
  el.querySelector('[data-tat="pruefen"]')?.addEventListener('click', async () => { await api.rufe('jetztPruefen'); await laden(); void zeichne(); });
  el.querySelector('[data-tat="zu-pruefen"]')?.addEventListener('click', () => zeigeAnsicht('pruefen', true));
}
/** Eine Zeile in Alltagssprache: „Newsletter von gamestar.de · Betreff … → würde ins Archiv“ */
function stromZeile(e: Eintrag, neu = false) {
  const weg = art(e) === 'weg';
  const probe = e.trocken && e.status === 'ok' && weg;
  return `<li class="${neu ? 'neu' : ''}"><span class="zeit">${uhr(e.zeit)}</span>
    <span class="wer"><b class="kat ${MUELL.includes(e.kategorie) && weg ? 'muell' : ''}">${KAT[e.kategorie]}</b> von ${h(e.absender)}<span class="betreff">${h(e.betreff || '(ohne Betreff)')}</span></span>
    <span class="tat ${weg ? 'weg' : ''}">${probe ? 'würde ' : ''}${h(tatText(e))}</span></li>`;
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
    try { await api.rufe('anmelden'); await laden(); void zeichne(); melde('Angemeldet. Der Probelauf startet.'); } catch (e) { melde((e as Error).message); }
  });
}

// ---------------- 2 Zu prüfen ----------------
async function pruefen() {
  const el = $('#ansicht-pruefen');
  const liste = await api.rufe('zuPruefen');
  el.innerHTML = `<div class="kopf"><h1 id="h-pruefen">Du entscheidest</h1><p>Bei diesen Mails war ich mir nicht sicher. Sag mir einmal, was du willst – <b>ich merke es mir</b> für alle Mails von diesem Absender.</p></div>
    ${liste.length ? `<ul class="pruef-liste">${liste.map((p: any) => `
      <li class="pruef" data-id="${h(p.mailId)}">
        <div><span class="von">${h(p.name || p.absender)} · ${h(p.absender)}</span><h3>${h(p.betreff || '(ohne Betreff)')}</h3>
          ${p.snippet ? `<p class="vorschau">${h(p.snippet)}</p>` : ''}
          <p class="warum">Ich glaube: <b>${KAT[p.kategorie as Kategorie]}</b>, bin mir aber nur zu ${p.sicherheit} % sicher. <span>${h(p.begruendung)}</span></p></div>
        <div class="pruef-knoepfe"><button class="knopf gross" data-wahl="behalten">Behalten</button><button class="knopf rot gross" data-wahl="weg">Weg damit</button></div>
      </li>`).join('')}</ul>` : '<p class="leer">Gerade nichts zu entscheiden. Alles, was reinkam, war eindeutig.</p>'}`;
  for (const b of $$('[data-wahl]', el)) b.addEventListener('click', async () => {
    const li = b.closest('.pruef') as HTMLElement; const wahl = b.dataset.wahl as 'behalten' | 'weg';
    $$('button', li).forEach((x) => ((x as HTMLButtonElement).disabled = true));
    try {
      const r = await api.rufe('entscheide', li.dataset.id, wahl);
      melde(wahl === 'weg' ? `Gemerkt: Mails von ${r.regel.wert} räume ich weg.` : `Gemerkt: Mails von ${r.regel.wert} bleiben.`);
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
  el.innerHTML = `<div class="kopf"><h1 id="h-absender">Wer schreibt dir?</h1><p>Die Absender mit den meisten Mails. Der Balken zeigt die Menge – der schwarze Teil, wie viele du davon geöffnet hast.</p></div>
    ${liste.length ? `<ul class="absender-liste">${liste.map((a: any) => `
      <li class="absender" data-adr="${h(a.adresse)}">
        <span class="menge">${zahl(a.anzahl)}</span>
        <div><div class="name">${h(a.name)}</div><div class="adr">${h(a.adresse)} · ${a.gelesen} von ${a.anzahl} gelesen${a.kategorie ? ' · ' + KAT[a.kategorie as Kategorie] : ''}${a.abgemeldet ? ' · abgemeldet' : ''}</div>
          <div class="balken" data-stil="width:${Math.max(6, (a.anzahl / max) * 100)}%"><u></u><i data-stil="width:${(a.gelesen / a.anzahl) * 100}%"></i></div></div>
        <div class="absender-knoepfe">
          <button class="knopf klein" data-akt="immer_behalten">Immer behalten</button>
          <button class="knopf klein weg" data-akt="immer_weg">Immer weg</button>
          <button class="knopf klein" data-akt="abmelden" ${!a.abmeldbar || a.abgemeldet || a.kategorie === 'phishing' ? 'disabled' : ''} title="${a.kategorie === 'phishing' ? 'Bei Phishing-Verdacht wird nie abgemeldet' : a.abmeldbar ? 'Über den List-Unsubscribe-Header' : 'Kein Abmelde-Header'}">Abmelden</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="leer">Noch keine Absender gezählt.</p>'}`;
  for (const b of $$('[data-akt]', el)) b.addEventListener('click', async () => {
    const adr = (b.closest('.absender') as HTMLElement).dataset.adr!;
    if (b.dataset.akt === 'abmelden' && !(await bestaetigen('Abmelden?', `Ich melde dich bei <b>${h(adr)}</b> ab – über den offiziellen Abmelde-Weg, nie über Links aus der Mail. <b>Das lässt sich nicht zurücknehmen.</b>`, 'Ja, abmelden'))) return;
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
  el.innerHTML = `<div class="kopf"><h1 id="h-regeln">Deine Regeln</h1><p>Was ich mir von dir gemerkt habe. Du musst hier nichts anlegen – Regeln entstehen von selbst, wenn du unter „Du entscheidest“ etwas wählst.</p></div>
    <form class="neue-regel" id="neue-regel">
      <label class="feld"><span class="etikett">Was soll passieren?</span><select name="art"><option value="schwarz">Immer wegräumen</option><option value="weiss">Nie anfassen</option></select></label>
      <label class="feld"><span class="etikett">Woran erkennen?</span><select name="feld"><option value="adresse">Absender-Adresse</option><option value="domain">ganze Firma (@…)</option><option value="stichwort">Wort im Betreff</option></select></label>
      <label class="feld"><span class="etikett">Adresse, Firma oder Wort</span><input name="wert" required placeholder="z. B. deals@shop.de"></label>
      <label class="feld"><span class="etikett">Als was?</span><select name="kat">${MUELL.map((k) => `<option value="${k}">${KAT[k]}</option>`).join('')}</select></label>
      <button class="knopf voll">Regel anlegen</button>
    </form>
    ${liste.length ? `<ul class="regel-liste">${liste.map((r: any) => `
      <li class="regel ${r.aktiv ? '' : 'aus'}" data-id="${r.id}">
        <div class="satz">Mails ${wer(r)} → <span class="${r.art === 'weiss' ? 'schutz' : 'ziel'}">${h(zielText(r.kategorie))}</span></div>
        <button class="schalter" role="switch" aria-checked="${r.aktiv}" aria-label="Regel ${r.aktiv ? 'ausschalten' : 'einschalten'}" data-tat="schalten"></button>
        <button class="knopf leise loeschen" data-tat="loeschen">Löschen</button>
        <div class="meta"><span>${r.art === 'weiss' ? 'Von dir: nie anfassen' : r.art === 'schwarz' ? 'Von dir: immer wegräumen' : `Gelernt – du hast es ${r.bestaetigt}× bestätigt`}</span>
          ${r.gmailFilterId ? '<span class="gmail-aktiv">wirkt auch, wenn der PC aus ist</span>' : kandidaten.includes(r.id) ? `<span>${z.einstellungen.trockenlauf ? 'wirkt nach dem Probelauf auch bei ausgeschaltetem PC' : z.einstellungen.filterExportFreigegeben ? 'wird gerade in Gmail eingetragen' : 'kann auch bei ausgeschaltetem PC wirken – Einstellungen'}</span>` : ''}</div>
      </li>`).join('')}</ul>` : '<p class="leer">Noch keine Regeln. Sie entstehen von selbst, wenn du unter „Du entscheidest“ etwas wählst.</p>'}`;
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
    el.innerHTML = `<div class="kopf"><h1 id="h-protokoll">Verlauf</h1><p>Alles, was ich gemacht habe, und warum. Etwas falsch? <b>„Zurückholen“</b> drücken – geht 30 Tage lang.</p></div>
      <div class="werkzeug">
        <label class="feld"><span class="etikett">Suchen</span><input type="search" id="suche" placeholder="z. B. amazon oder Rechnung"></label>
        <label class="feld"><span class="etikett">Nur zeigen</span><select id="kat-filter"><option value="">Alles</option>${Object.entries(KAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
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
    const name = lauf === 'fortlaufend' ? 'Neue Mails' : lauf.startsWith('altbestand') ? 'Alter Posteingang aufgeräumt' : lauf.startsWith('entscheidung') ? 'Deine Entscheidung' : lauf.startsWith('abmelden') ? 'Abmeldung' : 'Durchgang';
    return `<section class="lauf"><div class="lauf-kopf"><span class="etikett">${name} · ${datum(es[es.length - 1].zeit)} · ${es.length} ${es.length === 1 ? 'Mail' : 'Mails'}</span>
      ${offen > 1 && lauf !== 'fortlaufend' ? `<button class="knopf klein" data-lauf="${h(lauf)}">Alle ${offen} zurückholen</button>` : ''}</div>
      ${es.map((e) => `<div class="eintrag ${e.rueckgaengig ? 'zurueck' : ''}"><span class="zeit">${uhr(e.zeit)}</span><span class="kat ${MUELL.includes(e.kategorie) ? 'muell' : ''}">${KAT[e.kategorie]} ${e.sicherheit}%</span>
        <span class="wer"><b>${h(e.absender)}</b> <span>${h(e.betreff)}</span></span>
        <div class="rechts"><span class="tat ${e.trocken && art(e) === 'weg' && e.status === 'ok' ? 'trocken' : ''}">${h(tatText(e))}</span>
          ${e.rueckgaengig ? '<span class="etikett">zurückgeholt</span>' : rueckgaengigMoeglich(e) ? `<button class="knopf klein" data-id="${e.id}">Zurückholen</button>` : ''}</div>
        <span class="grund">${h(e.begruendung)}${e.hinweis ? ' ' + h(e.hinweis) : ''}</span></div>`).join('')}</section>`;
  }).join('') : '<p class="leer">Keine Einträge.</p>';
  for (const b of $$('[data-id]', ziel)) b.addEventListener('click', async () => {
    const r = await api.rufe('rueckgaengig', Number(b.dataset.id)); melde(r.ok ? 'Zurückgeholt – die Mail ist wieder genau wie vorher.' : r.grund); void protokollListe(); void laden();
  });
  for (const b of $$('[data-lauf]', ziel)) b.addEventListener('click', async () => {
    if (!(await bestaetigen('Alle zurückholen?', 'Alle Mails dieses Durchgangs kommen wieder genau so zurück, wie sie vorher waren.', 'Ja, zurückholen'))) return;
    const r = await api.rufe('durchlaufRueckgaengig', b.dataset.lauf); melde(`${r.ok} zurückgeholt${r.fehler ? `, ${r.fehler} ging nicht` : ''}.`); void protokollListe(); void laden();
  });
}

// ---------------- 6 Einstellungen ----------------
const schwelleZuRegler = (s: number) => Math.round((98 - s) / 0.4);
const reglerZuSchwelle = (r: number) => Math.round(98 - r * 0.4);
const strengText = (schwelle: number) => schwelle >= 90 ? 'Sehr vorsichtig' : schwelle >= 80 ? 'Vorsichtig' : schwelle >= 70 ? 'Mittel' : 'Streng';
const intervallText = (sek: number) => sek < 60 ? `alle ${sek} Sek.` : sek === 60 ? 'jede Minute' : sek % 60 === 0 ? `alle ${sek / 60} Min.` : `alle ${Math.floor(sek / 60)} Min. ${sek % 60} Sek.`;
async function einstellungen() {
  const el = $('#ansicht-einstellungen');
  await laden();
  const e = z.einstellungen; const ab = z.altbestand;
  const akt: Aktion[] = ['behalten', 'label', 'archivieren', 'gelesen', 'abmelden', 'papierkorb'];
  const rest = z.status?.trockenlaufRestTage ?? 7;
  el.innerHTML = `<div class="kopf"><h1 id="h-einstellungen">Einstellungen</h1><p>Normalerweise musst du hier nichts ändern. Alles wird sofort gespeichert.</p></div>
    <h2 class="abschnitt">Das Wichtigste</h2>
    <div class="einst"><div><h2>Probelauf</h2><p class="erkl">${e.trockenlauf ? `Gerade ist Probelauf: Ich zeige nur, was ich tun würde. Noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'}, dann kannst du in der Übersicht „Jetzt wirklich aufräumen“ drücken.` : 'Ich räume wirklich auf. Du kannst jederzeit zurück in den Probelauf.'}</p></div>
      <div class="zeile">${e.trockenlauf ? '<span class="etikett">Probelauf läuft – nichts wird verändert</span>' : '<button class="knopf" data-tat="trocken">Zurück in den Probelauf</button>'}</div></div>
    <div class="einst"><div><h2>Wie streng?</h2><p class="erkl"><b>Vorsichtig:</b> Ich räume nur weg, wenn ich mir ganz sicher bin – mehr landet bei „Du entscheidest“.<br><b>Streng:</b> Ich räume mehr selbst weg.</p></div>
      <div class="regler"><span class="regler-wert" id="schwelle-wert">${strengText(e.schwelle)}</span><input type="range" min="0" max="100" value="${schwelleZuRegler(e.schwelle)}" id="schwelle" aria-label="Wie streng">
      <div class="regler-enden"><span>vorsichtig</span><span>streng</span></div></div></div>
    <div class="einst"><div><h2>Alten Posteingang aufräumen</h2><p class="erkl">Ich sortiere einmal alles, was schon im Posteingang liegt. Zuerst siehst du nur eine Vorschau – angefasst wird erst, wenn du startest.</p></div>
      <div id="altbestand">${altbestandHtml(ab)}</div></div>

    <details class="profi">
      <summary><span>Mehr Einstellungen</span><span class="etikett">für Profis – musst du nicht anfassen</span></summary>
      <div class="einst"><div><h2>Was passiert womit?</h2><p class="erkl">Pro Sorte Mail, was ich mache. „Abmelden“ nur über den offiziellen Abmelde-Weg und nie bei Betrugs-Mails (Phishing).</p></div>
        <table class="matrix"><thead><tr><th>Sorte</th>${akt.map((a) => `<th>${AKT[a]}</th>`).join('')}</tr></thead><tbody>
        ${(Object.keys(KAT) as Kategorie[]).map((k) => `<tr><td>${KAT[k].replace('Benachrichtigung', 'Benachrich&shy;tigung')}</td>${akt.map((a) => `<td><button class="haken ${a === 'papierkorb' ? 'rot' : ''}" role="checkbox" aria-checked="${(e.aktionen[k] ?? []).includes(a)}" aria-label="${KAT[k]}: ${AKT[a]}" data-k="${k}" data-a="${a}" ${(a === 'abmelden' && k === 'phishing') ? 'disabled' : ''}></button></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
      <div class="einst"><div><h2>Schutzwörter</h2><p class="erkl">Mails mit diesen Wörtern fasse ich nie an – egal ob im Betreff, im Text-Anfang oder beim Absender. Ein Wort pro Zeile.</p></div>
        <label class="feld"><span class="unsichtbar">Schutzwörter</span><textarea id="schutz" rows="6">${h(e.schutzwoerter.join('\n'))}</textarea></label></div>
      <div class="einst"><div><h2>Wie oft nachschauen?</h2><p class="erkl">Standard: jede Minute.</p></div>
        <div class="regler"><span class="regler-wert" id="intervall-wert">${intervallText(e.intervallSek)}</span><input type="range" min="15" max="600" step="15" value="${e.intervallSek}" id="intervall" aria-label="Wie oft nachschauen">
        <div class="regler-enden"><span>alle 15 Sek.</span><span>alle 10 Min.</span></div></div></div>
      <div class="einst"><div><h2>Auch bei ausgeschaltetem PC</h2><p class="erkl">Absender, die du ${e.filterExportAb}× weggeräumt hast (oder auf „Immer weg“ gesetzt), trage ich als Filter direkt in Gmail ein. Dann räumt Google selbst auf, auch wenn dein PC aus ist.</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="filter" aria-checked="${e.filterExportFreigegeben}" aria-label="Filter in Gmail eintragen erlauben"></button><span>${e.filterExportFreigegeben ? 'Erlaubt' : 'Noch nicht erlaubt'}</span></div></div>
      <div class="einst"><div><h2>Mit Windows starten</h2><p class="erkl">Ich starte unsichtbar unten rechts im Infobereich.</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="autostart" aria-checked="${e.autostart}" aria-label="Mit Windows starten"></button></div></div>
      <div class="einst"><div><h2>KI-Hilfe</h2><p class="erkl">Nur für knifflige Fälle. Dafür gehen Absender, Betreff und die erste Zeile an Claude (Anthropic) – nie die ganze Mail, nie Anhänge. Braucht einen API-Schlüssel (siehe Anleitung).</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="ki" aria-checked="${e.kiAn}" aria-label="KI-Hilfe"></button>
          <label class="feld"><span class="etikett">Höchstens pro Monat (€)</span><input type="number" id="budget" min="0" step="0.5" value="${e.kiBudgetEuro}" data-stil="width:120px"></label>
          <span class="etikett">${z.ki.schluessel ? `diesen Monat ${z.ki.ausgegebenEuro.toFixed(2).replace('.', ',')} €` : 'kein API-Schlüssel eingerichtet'}</span></div></div>
    </details>`;

  const speichere = (teil: object) => api.rufe('speichereEinstellungen', teil).then((n: any) => { z.einstellungen = n; });
  const iv = $<HTMLInputElement>('#intervall', el); iv.addEventListener('input', () => { $('#intervall-wert').textContent = intervallText(Number(iv.value)); }); iv.addEventListener('change', () => speichere({ intervallSek: Number(iv.value) }));
  const sw = $<HTMLInputElement>('#schwelle', el); sw.addEventListener('input', () => { $('#schwelle-wert').textContent = strengText(reglerZuSchwelle(Number(sw.value))); }); sw.addEventListener('change', () => speichere({ schwelle: reglerZuSchwelle(Number(sw.value)) }));
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
  if (!ab || ab.phase === 'leer') return '<button class="knopf voll gross" data-ab="vorschau">Vorschau ansehen</button>';
  const prozent = ab.gesamt ? Math.round((ab.erledigt / ab.gesamt) * 100) : 0;
  const zaehler = `<div class="zaehler-liste">${Object.entries(ab.zaehler).map(([k, n]) => `<span><b>${zahl(n as number)}</b>${KAT[k as Kategorie]}</span>`).join('')}</div>`;
  if (ab.phase === 'vorschau') return `<span class="etikett">Ich schaue mir alles an … ${zahl(ab.erledigt)} von ${zahl(ab.gesamt)} Mails</span><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>${zaehler}`;
  if (ab.phase === 'bereit') return `<span class="etikett">Fertig angeschaut: ${zahl(ab.gesamt)} Mails – noch nichts verändert. Das habe ich gefunden:</span>${zaehler}
    ${ab.beispiele.length ? `<ul class="beispiele">${ab.beispiele.map((b: any) => `<li>${KAT[b.kategorie as Kategorie]} · ${h(b.absender)} – ${h(b.betreff)}</li>`).join('')}</ul>` : ''}
    <div class="zeile"><button class="knopf rot" data-ab="start">${z.einstellungen.trockenlauf ? 'Probeweise durchspielen' : 'Jetzt aufräumen'}</button><button class="knopf" data-ab="vorschau">Nochmal ansehen</button></div>`;
  if (ab.phase === 'laeuft') return `<span class="etikett">Ich räume auf … ${zahl(ab.erledigt)} von ${zahl(ab.gesamt)} Mails</span><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>`;
  return `<span class="etikett">Fertig – ${zahl(ab.gesamt)} Mails durchgesehen. Zurückholen geht unter „Verlauf“.</span>${zaehler}<div class="zeile"><button class="knopf" data-ab="vorschau">Nochmal ansehen</button></div>`;
}
function altbestandKnoepfe() {
  for (const b of $$('[data-ab]')) b.addEventListener('click', async () => {
    try {
      if (b.dataset.ab === 'vorschau') await api.rufe('altbestandVorschau');
      else if (await bestaetigen('Alten Posteingang aufräumen?', z.einstellungen.trockenlauf ? 'Probelauf: Ich trage nur in den Verlauf ein, was ich tun würde. Angefasst wird nichts.' : 'Ich räume jetzt den ganzen Posteingang auf. Geschützte und unsichere Mails bleiben liegen. Alles lässt sich 30 Tage lang zurückholen.', 'Starten', !z.einstellungen.trockenlauf)) await api.rufe('altbestandStarten');
    } catch (e) { melde((e as Error).message); }
  });
}

async function filterFrage(anzahl?: number): Promise<boolean> {
  const ok = await bestaetigen('Auch bei ausgeschaltetem PC aufräumen?', `${anzahl ? `${anzahl} ${anzahl === 1 ? 'Absender ist' : 'Absender sind'} eindeutig Müll. ` : ''}Darf ich dafür Filter direkt in dein Gmail eintragen? Dann räumt Google selbst auf, auch wenn dein PC aus ist. Mails mit Schutzwörtern bleiben trotzdem verschont. Schaltest du die Regel aus, lösche ich den Filter wieder.`, 'Ja, erlauben');
  if (ok) { const r = await api.rufe('filterFreigeben'); melde(`${r.angelegt} ${r.angelegt === 1 ? 'Filter' : 'Filter'} in Gmail eingetragen.`); await laden(); }
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
        const st = z.statistik; const m = st.lesezeitMinutenWoche;
        const w = document.getElementById('z-woche'); if (w) w.textContent = zahl(st.wocheEntfernt);
        const l = document.getElementById('z-lesezeit'); if (l) l.textContent = m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`;
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
