// Oberfläche des Email-Aufräumers. Vanilla TypeScript, kein Framework.
import { Sortierer, FAECHER, type Fach } from './sortierer.js';
import { PostfachUI } from './postfach.js';
type Art = 'weg' | 'bleibt' | 'pruefen';

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
let maschine: Sortierer;
let post: PostfachUI;
let postTimer: any;
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
const fachVon = (k: Kategorie): Fach => (k === 'spam' || k === 'phishing' ? 'muell' : k);
const FACH_KURZ: Record<Fach, string> = { wichtig: 'Wichtig', persoenlich: 'Privat', benachrichtigung: 'Info', newsletter: 'News', werbung: 'Werbung', muell: 'Müll' };
const FACH_NAME: Record<Fach, string> = { wichtig: 'Wichtig', persoenlich: 'Persönlich', benachrichtigung: 'Benachrich\u00ADtigung', newsletter: 'Newsletter', werbung: 'Werbung', muell: 'Spam & Betrug' };
function rueckgaengigMoeglich(e: Eintrag) {
  return !e.trocken && !e.rueckgaengig && e.status === 'ok' && !(e.aktionen.length === 1 && e.aktionen[0] === 'behalten') && Date.now() - e.zeit < 30 * 86400_000;
}

function melde(text: string, rueck?: () => void) {
  const m = $('#meldung');
  m.innerHTML = `<span>${h(text)}</span>${rueck ? '<button class="knopf klein">Rückgängig</button>' : ''}`;
  if (rueck) m.querySelector('button')!.addEventListener('click', () => { m.classList.remove('an'); rueck(); });
  m.classList.add('an');
  clearTimeout((m as any)._t); (m as any)._t = setTimeout(() => m.classList.remove('an'), rueck ? 7000 : 4200);
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
  const t = s.status === 'fehler' ? 'Problem · siehe Übersicht' : s.status === 'startet' ? 'richtet sich ein …' : s.trockenlauf ? 'Probelauf' : s.status === 'laeuft' ? 'Läuft · räumt auf' : s.status === 'startet' ? 'startet …' : s.status;
  $('#zustand-text').textContent = t;
  $('#schiene-fuss').innerHTML = `${s.email ? h(s.email) + '<br>' : ''}${s.letzterLauf ? 'Zuletzt nachgeschaut ' + uhr(s.letzterLauf) : 'Noch nicht nachgeschaut'}`;
}

// ---------------- Navigation ----------------
function zeigeAnsicht(ziel: string, fokus = false) {
  const wechsel = () => {
    ansicht = ziel;
    document.body.dataset.ansicht = ziel;
    (window as any).__navSetzen?.();
    for (const s of $$('.ansicht')) s.hidden = s.dataset.ansicht !== ziel;
    for (const b of $$('#nav button')) { if (b.dataset.ziel === ziel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    zeiger();
    void zeichne();
    if (fokus) { $('#inhalt').focus({ preventScroll: true }); $('#inhalt').scrollTop = 0; window.scrollTo(0, 0); }
  };
  const dvt = (document as any).startViewTransition;
  if (dvt && !RUHIG) dvt.call(document, wechsel); else wechsel();
}
function zeiger() { /* aktive Seite wird per aria-current hervorgehoben */ }

async function zeichne() {
  switch (ansicht) {
    case 'postfach': return z.angemeldet ? post.zeigen() : zeigeAnsicht('cockpit');
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
/** Was mit einer Sorte passiert, in drei Wörtern. */
function fachTat(f: Fach): string {
  const a: Aktion[] = z.einstellungen.aktionen[f === 'muell' ? 'spam' : f] ?? [];
  if (a.includes('papierkorb')) return '→ Papierkorb';
  if (a.includes('archivieren')) return '→ Archiv';
  if (a.includes('label')) return 'bleibt, mit Etikett';
  return 'bleibt';
}

async function cockpit() {
  const el = $('#ansicht-cockpit');
  const oben = $('#cockpit-oben'), unten = $('#cockpit-unten');
  $('#maschine-box').hidden = !z.angemeldet;
  if (!z.angemeldet) { unten.innerHTML = ''; return anmeldung(oben); }
  const st = z.statistik; const s = z.status ?? {};
  const probe = z.einstellungen.trockenlauf;
  const lesezeit = st.lesezeitMinutenWoche >= 60 ? `${Math.floor(st.lesezeitMinutenWoche / 60)} Std. ${st.lesezeitMinutenWoche % 60} Min.` : `${st.lesezeitMinutenWoche} Min.`;

  let art = '', titel: string, text: string, naechstes: string, knopf = '';
  if (s.status === 'fehler') {
    art = 'fehler'; titel = 'Es hakt gerade.';
    text = `Google meldet: „${h(s.fehler)}“. Deine Mails sind sicher – nichts wurde verändert.`;
    naechstes = 'Drück auf „Nochmal versuchen“. Hilft das nicht, schick mir einen Screenshot.';
    knopf = '<button class="knopf gross" data-tat="pruefen">Nochmal versuchen</button>';
  } else if (s.status === 'startet') {
    art = 'startet'; titel = 'Ich richte mich ein …';
    text = 'Ich lese, wem du schon geschrieben hast – diese Leute fasse ich nie an. Dauert 1–2 Minuten.';
    naechstes = 'Du musst nichts tun.';
  } else if (probe) {
    art = 'probe'; titel = 'Probelauf: Ich zeige nur, was ich tun würde.';
    text = 'Ich sortiere jede neue Mail – aber angefasst wird noch nichts. Gestreifte Fächer = würde ich wegräumen.';
    naechstes = 'Passt das? Dann los – ab dann räume ich echt auf.';
    knopf = '<button class="knopf gross" data-tat="scharf">Jetzt wirklich aufräumen</button>';
  } else {
    art = 'laeuft'; titel = 'Läuft. Ich räume für dich auf.';
    text = 'Neue Mails sortiere ich innerhalb weniger Sekunden. Rechnungen, Verträge und Leute, denen du schreibst, fasse ich nie an.';
    naechstes = 'Du musst nichts tun. Unter „Verlauf“ holst du alles 30 Tage lang zurück.';
  }
  oben.innerHTML = `${z.demo ? '<span class="demo-band">Demo – dein echtes Postfach wird nicht berührt</span>' : ''}
    <section class="lage" data-art="${art}" aria-live="polite">
      <div><h1 class="unsichtbar" id="h-cockpit">Übersicht</h1><h2>${titel}</h2><p>${text}</p><p class="naechstes">${naechstes}</p></div>
      ${knopf}
    </section>`;

  // Fächer: heutige Zahlen je Sorte
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const eintraege: Eintrag[] = (await api.rufe('protokoll', { limit: 3000 })).filter((e: Eintrag) => e.zeit >= heute.getTime());
  const echt = FAECHER.map(() => 0), probeZ = FAECHER.map(() => 0);
  for (const e of eintraege) { const i = FAECHER.indexOf(fachVon(e.kategorie)); if (e.trocken && art_(e) === 'weg') probeZ[i]++; else echt[i]++; }
  maschine.setzeStaende(echt, probeZ);
  $('#faecher').innerHTML = FAECHER.map((f, i) => `<li data-k="${f}"><b id="fach-${f}">${zahl(echt[i] + probeZ[i])}</b><span><span class="lang">${FACH_NAME[f]}</span><span class="kurz">${FACH_KURZ[f]}</span></span><small>${fachTat(f)}</small></li>`).join('');
  $('#maschine-summe').innerHTML = `<b>${zahl(eintraege.length)}</b>Mails heute · ${probe ? `${zahl(st.heuteEntfernt)} würde ich wegräumen` : `${zahl(st.heuteEntfernt)} weggeräumt`}`;

  const liste: Eintrag[] = await api.rufe('protokoll', { limit: 10 });
  unten.innerHTML = `<section class="karte alt-karte" data-k="werbung"><div class="alt-kopf"><div><h2>Altes Postfach aufräumen</h2>
      <p>Ich gehe einmal durch <b>alle</b> Mails, die schon da sind – auch Archiviertes. Erst siehst du nur, was passieren würde.</p></div></div>
      <div id="altbestand">${altbestandHtml(z.altbestand)}</div></section>
    <section class="karte alt-karte" data-k="benachrichtigung"><div class="alt-kopf"><div><h2>Posteingang entrümpeln</h2>
      <p>Für die ungelesenen Mails, die noch im Posteingang liegen: Alles, was <b>älter als 2 Wochen</b> ist, markiere ich als <b>gelesen</b> – verschoben oder gelöscht wird dabei nichts. <b>Infos</b> (Pakete, Konten, Apps), die älter als 30 Tage sind, kommen ins <b>Archiv</b>. Mit Stern bleibt unberührt. Ein Klick macht alles rückgängig.</p></div></div>
      <div id="entruempeln">${entruempelnHtml(z.entruempeln)}</div></section>
    <div class="zwei">
      <section class="karte"><h2>Was zuletzt passiert ist</h2>
        <ol class="strom-liste" id="strom-liste">${liste.map((e) => stromZeile(e)).join('') || '<li class="leer-zeile">Noch keine neue Mail angekommen. Sobald eine kommt, siehst du sie oben in die Maschine fallen.</li>'}</ol></section>
      <section class="karte"><h2>Diese Woche</h2>
        <dl class="zahlen-klein">
          <div><dt>${probe ? 'Würde ich wegräumen' : 'Weggeräumt'}</dt><dd id="z-woche">${zahl(st.wocheEntfernt)}</dd></div>
          <div><dt>Gesparte Lesezeit</dt><dd id="z-lesezeit">${lesezeit}</dd></div>
          <div><dt>Wartet auf dich</dt><dd>${zahl(st.zuPruefen)}${st.zuPruefen ? ' <button class="knopf klein voll" data-tat="zu-pruefen">Ansehen</button>' : ''}</dd></div>
        </dl>
        <dl class="legende">
          <div><dt>Archiv</dt><dd>Raus aus dem Posteingang, aber nicht gelöscht – in Gmail unter „Alle Nachrichten“.</dd></div>
          <div><dt>Papierkorb</dt><dd>Gmail löscht nach 30 Tagen. Bis dahin holst du alles mit einem Klick zurück.</dd></div>
          <div><dt>Geschützt</dt><dd>Rechnungen, Verträge, Bank, Leute, denen du schreibst – fasse ich nie an.</dd></div>
        </dl></section>
    </div>`;

  el.querySelector('[data-tat="scharf"]')?.addEventListener('click', async () => {
    if (!(await bestaetigen('Jetzt wirklich aufräumen?', 'Ab jetzt räume ich Mails wirklich weg – ins Archiv oder in den Papierkorb, auch die aus dem Probelauf. <b>Endgültig gelöscht wird nie etwas.</b> Rechnungen, Verträge und Leute, denen du schreibst, fasse ich nie an. Unter „Verlauf“ holst du 30 Tage lang alles mit einem Klick zurück.', 'Ja, aufräumen'))) return;
    const r = await api.rufe('scharfSchalten');
    melde(r.ok ? `Los geht’s – ab jetzt wird aufgeräumt.${r.nachgeholt ? ` ${r.nachgeholt} Mails aus dem Probelauf habe ich gleich mit erledigt.` : ''}` : r.grund);
    await laden(); void zeichne();
    if (r.ok && await bestaetigen('Auch den alten Posteingang?', 'Bisher räume ich nur neue Mails auf. Soll ich mir auch alles anschauen, was schon im Posteingang liegt? Du siehst zuerst eine Vorschau – angefasst wird erst, wenn du dort startest.', 'Ja, Vorschau zeigen')) {
      zeigeAnsicht('einstellungen', true);
      try { await api.rufe('altbestandVorschau'); } catch (e) { melde((e as Error).message); }
    }
  });
  el.querySelector('[data-tat="pruefen"]')?.addEventListener('click', async () => { await api.rufe('jetztPruefen'); await laden(); void zeichne(); });
  el.querySelector('[data-tat="zu-pruefen"]')?.addEventListener('click', () => zeigeAnsicht('pruefen', true));
  altbestandKnoepfe();
  entruempelnKnoepfe();
}
const art_ = (e: Eintrag) => art(e);

/** Eine Zeile in Alltagssprache: „Newsletter von gamestar.de · Betreff … → würde ins Archiv“ */
function stromZeile(e: Eintrag, neu = false) {
  const weg = art(e) === 'weg';
  const probe = e.trocken && e.status === 'ok' && weg;
  return `<li class="${neu ? 'neu' : ''}" data-k="${e.kategorie}"><i class="strich"></i><span class="zeit">${uhr(e.zeit)}</span>
    <span class="wer"><b class="kat">${KAT[e.kategorie]}</b> <span class="von">von ${h(e.absender)}</span><span class="betreff">${h(e.betreff || '(ohne Betreff)')}</span></span>
    <span class="tat">${probe ? 'würde ' : ''}${h(tatText(e))}</span></li>`;
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
      <li class="pruef" data-id="${h(p.mailId)}" data-k="${p.kategorie}"><i class="strich"></i>
        <div><span class="von">${h(p.name || p.absender)} · ${h(p.absender)}</span><h3>${h(p.betreff || '(ohne Betreff)')}</h3>
          ${p.snippet ? `<p class="vorschau">${h(p.snippet)}</p>` : ''}
          <p class="warum">Ich glaube: <b>${KAT[p.kategorie as Kategorie]}</b>, bin mir aber nur zu ${p.sicherheit} % sicher. <span>${h(p.begruendung)}</span></p></div>
        <div class="pruef-knoepfe"><button class="knopf gross" data-wahl="behalten">Behalten</button><button class="knopf voll gross" data-wahl="weg">Weg damit</button></div>
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
  el.innerHTML = `<div class="kopf"><h1 id="h-absender">Wer schreibt dir?</h1><p>Die Absender mit den meisten Mails. Der Balken zeigt die Menge – der kräftige Teil, wie viele du davon geöffnet hast.</p></div>
    ${liste.length ? `<ul class="absender-liste">${liste.map((a: any) => `
      <li class="absender" data-adr="${h(a.adresse)}" data-k="${a.kategorie ?? ''}">
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
  const ordner: any[] = await api.rufe('ordnerListe');
  el.insertAdjacentHTML('beforeend', `<h2 class="abschnitt">Deine Firmen-Ordner</h2>
    ${ordner.length ? `<ul class="regel-liste">${ordner.map((o) => `<li class="regel ${o.aktiv ? '' : 'aus'}" data-basis="${h(o.basis)}">
      <div class="satz">Mails von <em>@${h(o.basis)}</em> → Ordner <span class="schutz">„${h(o.name)}“</span></div>
      <button class="schalter" role="switch" aria-checked="${o.aktiv}" aria-label="Ordner ${h(o.name)}" data-ordner-an></button><span></span>
      <div class="meta"><span>${zahl(o.anzahl)} Mails</span><span>${o.ueberSchwelle ? 'Ordner aktiv' : `ab ${z.einstellungen.ordnerAb} Mails`}</span></div></li>`).join('')}</ul>`
      : '<p class="leer">Noch keine Firma schreibt oft genug. Sobald eine Firma 5 Mails geschickt hat, bekommt sie hier ihren Ordner.</p>'}`);
  for (const b of $$('[data-ordner-an]', el)) b.addEventListener('click', async () => {
    const li = b.closest('.regel') as HTMLElement; const an = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(an)); li.classList.toggle('aus', !an);
    await api.rufe('ordnerSchalten', li.dataset.basis, an);
  });
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
      ${es.map((e) => `<div class="eintrag ${e.rueckgaengig ? 'zurueck' : ''}" data-k="${e.kategorie}"><i class="strich"></i><span class="zeit">${uhr(e.zeit)}</span>
        <span class="wer"><b class="kat">${KAT[e.kategorie]}</b> <span class="von">von ${h(e.absender)}</span><span class="betreff">${h(e.betreff || '(ohne Betreff)')}</span></span>
        <div class="rechts"><span class="tat">${e.trocken && art(e) === 'weg' && e.status === 'ok' ? 'würde ' : ''}${h(tatText(e))}</span>
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
    <div class="einst-gruppe">
    <div class="einst"><div><h2>Konto</h2><p class="erkl">${h(z.status?.email || '')}${z.drive ? ' · große Dateien über Google Drive: bereit' : ' · große Dateien über Google Drive: noch nicht erlaubt – einmal neu anmelden (vorher in Google Cloud die Drive-API einschalten, siehe Anleitung).'}</p></div>
      <div class="zeile"><button class="knopf ${z.drive ? '' : 'voll'}" data-tat="neu-anmelden">Neu anmelden</button></div></div>
    <div class="einst"><div><h2>Updates</h2><p class="erkl">Das Programm hält sich selbst aktuell: Neue Versionen lädt es im Hintergrund und spielt sie beim nächsten Neustart ein. Du musst nie wieder etwas installieren.</p><p class="erkl" id="version-stand">${h(updateText(updateStand))}</p></div>
      <div class="zeile"><button class="knopf" data-tat="update-suchen">Jetzt nachsehen</button></div></div>
    <div class="einst"><div><h2>Aufs Handy</h2><p class="erkl">Tiry's Mails gibt es auch fürs Handy (iPhone und Android). Öffne auf dem Handy <b>tiry38.github.io/Tiry/mails</b> und tippe auf „Zum Home-Bildschirm“. Die App führt dich durch die Einrichtung.</p></div>
      <div class="zeile"><button class="knopf" data-tat="handy">Im Browser öffnen</button></div></div>
    <div class="einst"><div><h2>Probelauf</h2><p class="erkl">${e.trockenlauf ? 'Gerade ist Probelauf: Ich zeige nur, was ich tun würde. Zum Aufräumen in der Übersicht auf „Jetzt wirklich aufräumen“ drücken.' : 'Ich räume wirklich auf. Du kannst jederzeit zurück in den Probelauf.'}</p></div>
      <div class="zeile">${e.trockenlauf ? '<span class="etikett">Probelauf läuft – nichts wird verändert</span>' : '<button class="knopf" data-tat="trocken">Zurück in den Probelauf</button>'}</div></div>
    <div class="einst"><div><h2>Wie streng?</h2><p class="erkl"><b>Vorsichtig:</b> Ich räume nur weg, wenn ich mir ganz sicher bin – mehr landet bei „Du entscheidest“.<br><b>Streng:</b> Ich räume mehr selbst weg.</p></div>
      <div class="regler"><span class="regler-wert" id="schwelle-wert">${strengText(e.schwelle)}</span><input type="range" min="0" max="100" value="${schwelleZuRegler(e.schwelle)}" id="schwelle" aria-label="Wie streng">
      <div class="regler-enden"><span>vorsichtig</span><span>streng</span></div></div></div>
    <div class="einst"><div><h2>Bilder in Mails</h2><p class="erkl">Bilder werden automatisch angezeigt. Bei Spam und Betrug bleiben sie immer blockiert – sonst erfährt der Absender, dass deine Adresse echt ist.</p></div>
      <div class="zeile"><button class="schalter" role="switch" id="bilder" aria-checked="${e.bilderAuto !== false}" aria-label="Bilder automatisch anzeigen"></button><span>${e.bilderAuto !== false ? 'Immer anzeigen' : 'Erst auf Klick'}</span></div></div>
    <div class="einst"><div><h2>Firmen-Ordner</h2><p class="erkl">Schreibt eine Firma oft (z. B. Amazon, DHL), lege ich ihr einen eigenen Ordner an und sortiere ihre Mails dort ein – auch Bestellungen und Rechnungen. Privatadressen und Leute, denen du schreibst, nie.</p></div>
      <div class="zeile"><button class="schalter" role="switch" id="ordner-an" aria-checked="${e.ordnerAn !== false}" aria-label="Firmen-Ordner"></button>
        <label class="feld"><span class="etikett">Ab wie vielen Mails?</span><select id="ordner-ab">${[3, 5, 10, 20].map((n) => `<option value="${n}" ${n === e.ordnerAb ? 'selected' : ''}>${n} Mails</option>`).join('')}</select></label>
        <button class="knopf klein" data-tat="zu-regeln">Ordner ansehen</button></div></div></div>

    <details class="profi">
      <summary><span>Mehr Einstellungen</span><span class="etikett">für Profis – musst du nicht anfassen</span></summary>
      <div class="einst"><div><h2>Was passiert womit?</h2><p class="erkl">Pro Sorte Mail, was ich mache. „Abmelden“ nur über den offiziellen Abmelde-Weg und nie bei Betrugs-Mails (Phishing).</p></div>
        <table class="matrix"><thead><tr><th>Sorte</th>${akt.map((a) => `<th>${AKT[a]}</th>`).join('')}</tr></thead><tbody>
        ${(Object.keys(KAT) as Kategorie[]).map((k) => `<tr><td>${KAT[k].replace('Benachrichtigung', 'Benachrich&shy;tigung')}</td>${akt.map((a) => `<td><button class="haken ${a === 'papierkorb' ? 'rot' : ''}" role="checkbox" aria-checked="${(e.aktionen[k] ?? []).includes(a)}" aria-label="${KAT[k]}: ${AKT[a]}" data-k="${k}" data-a="${a}" ${(a === 'abmelden' && k === 'phishing') ? 'disabled' : ''}></button></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
      <div class="einst"><div><h2>Schutzwörter</h2><p class="erkl">Mails mit diesen Wörtern fasse ich nie an – egal ob im Betreff, im Text-Anfang oder beim Absender. Ein Wort pro Zeile.</p></div>
        <label class="feld"><span class="unsichtbar">Schutzwörter</span><textarea id="schutz" rows="6">${h(e.schutzwoerter.join('\n'))}</textarea></label></div>
      <div class="einst"><div><h2>Wie oft nachschauen?</h2><p class="erkl">Standard: alle 5 Sekunden – so siehst du neue Mails praktisch sofort.</p></div>
        <label class="feld"><span class="unsichtbar">Wie oft nachschauen</span><select id="intervall">${[3, 5, 10, 30, 60, 300].map((s) => `<option value="${s}" ${s === e.intervallSek ? 'selected' : ''}>${intervallText(s)}</option>`).join('')}</select></label></div>
      <div class="einst"><div><h2>Auch bei ausgeschaltetem PC</h2><p class="erkl">Ich trage Regeln direkt in dein Gmail ein – dann räumt Google selbst auf, rund um die Uhr, auch wenn PC und Handy aus sind: Werbung und Newsletter von Absendern, die ich schon oft weggeräumt habe, und deine Firmen-Ordner (Amazon, DHL …). Rechnungen und Verträge bleiben verschont.${z.autoFilter ? ` <b>${z.autoFilter} Regeln</b> arbeiten gerade in Gmail.` : ''}</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="filter" aria-checked="${e.filterExportFreigegeben}" aria-label="Filter in Gmail eintragen erlauben"></button><span>${e.filterExportFreigegeben ? 'Erlaubt' : 'Noch nicht erlaubt'}</span></div></div>
      <div class="einst"><div><h2>Mit Windows starten</h2><p class="erkl">Ich starte unsichtbar unten rechts im Infobereich.</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="autostart" aria-checked="${e.autostart}" aria-label="Mit Windows starten"></button></div></div>
      <div class="einst"><div><h2>KI-Hilfe</h2><p class="erkl">Nur für knifflige Fälle. Dafür gehen Absender, Betreff und die erste Zeile an Claude (Anthropic) – nie die ganze Mail, nie Anhänge. Braucht einen API-Schlüssel (siehe Anleitung).</p></div>
        <div class="zeile"><button class="schalter" role="switch" id="ki" aria-checked="${e.kiAn}" aria-label="KI-Hilfe"></button>
          <label class="feld"><span class="etikett">Höchstens pro Monat (€)</span><input type="number" id="budget" min="0" step="0.5" value="${e.kiBudgetEuro}" data-stil="width:120px"></label>
          <span class="etikett">${z.ki.schluessel ? `diesen Monat ${z.ki.ausgegebenEuro.toFixed(2).replace('.', ',')} €` : 'kein API-Schlüssel eingerichtet'}</span></div></div>
    </details>`;

  const speichere = (teil: object) => api.rufe('speichereEinstellungen', teil).then((n: any) => { z.einstellungen = n; });
  const iv = $<HTMLSelectElement>('#intervall', el); iv.addEventListener('change', () => speichere({ intervallSek: Number(iv.value) }));
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
  schalter('bilder', (an) => speichere({ bilderAuto: an }));
  schalter('ordner-an', (an) => speichere({ ordnerAn: an }));
  $('#ordner-ab', el).addEventListener('change', (ev) => speichere({ ordnerAb: Number((ev.target as HTMLSelectElement).value) }));
  el.querySelector('[data-tat="zu-regeln"]')?.addEventListener('click', () => zeigeAnsicht('regeln', true));
  schalter('autostart', (an) => speichere({ autostart: an }));
  schalter('filter', async (an) => {
    if (an && !(await filterFrage())) return false;
    if (!an) { await speichere({ filterExportFreigegeben: false }); const n = await api.rufe('autoFilterAus'); if (n) melde(`${n} Gmail-Regeln wieder gelöscht.`); }
  });
  el.querySelector('[data-tat="handy"]')?.addEventListener('click', () => { window.open('https://tiry38.github.io/Tiry/mails/', '_blank'); });
  el.querySelector('[data-tat="update-suchen"]')?.addEventListener('click', async () => {
    const v = document.getElementById('version-stand'); if (v) v.textContent = 'Suche nach Updates …';
    await api.rufe('updateSuchen'); zeigeUpdate(await api.rufe('updateStand'));
  });
  el.querySelector('[data-tat="neu-anmelden"]')?.addEventListener('click', async () => {
    melde('Browser geöffnet – bitte dort anmelden und alle Haken setzen.');
    try { await api.rufe('anmelden'); await laden(); void einstellungen(); melde('Neu angemeldet.'); } catch (e) { melde((e as Error).message); }
  });
  el.querySelector('[data-tat="trocken"]')?.addEventListener('click', async () => { await api.rufe('trockenlaufWieder'); await laden(); void einstellungen(); });
  altbestandKnoepfe();
}

function speicher(b: number) { return b > 1_073_741_824 ? `${(b / 1_073_741_824).toFixed(1).replace('.', ',')} GB` : `${Math.max(1, Math.round(b / 1_048_576))} MB`; }
function altbestandHtml(ab: any): string {
  const platz = z?.einstellungen?.altPlatzSchaffen !== false;
  const platzSchalter = `<label class="zeile alt-platz"><button class="schalter" role="switch" aria-checked="${platz}" data-ab="platz" aria-label="Platz schaffen"></button>
    <span><b>Platz schaffen:</b> alte Werbung und Newsletter in den Papierkorb (statt nur ins Archiv). Rechnungen, Bestellungen und Leute, denen du schreibst, bleiben.</span></label>`;
  if (!ab || ab.phase === 'leer') return `${platzSchalter}<div class="zeile"><button class="knopf voll gross" data-ab="vorschau">Postfach durchsehen</button></div>`;
  const prozent = ab.gesamt ? Math.round((ab.erledigt / ab.gesamt) * 100) : 0;
  if (ab.phase === 'vorschau') return `<p class="alt-status">Ich sehe mir alle Mails an … <b>${zahl(ab.erledigt)}</b> von ${zahl(ab.gesamt)}</p><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>`;
  if (ab.phase === 'laeuft') return `<p class="alt-status">Ich räume auf … <b>${zahl(ab.erledigt)}</b> von ${zahl(ab.gesamt)}</p><div class="fortschritt"><i data-stil="width:${prozent}%"></i></div>`;
  const zi = ab.ziele ?? {};
  const zahlen = `<div class="alt-zahlen">
      <div data-k="muell"><b>${zahl(zi.papierkorb ?? 0)}</b><span>in den Papierkorb</span><small>${ab.freiBytes ? `ca. ${speicher(ab.freiBytes)} frei` : ''}</small></div>
      <div data-k="newsletter"><b>${zahl(zi.archiv ?? 0)}</b><span>ins Archiv</span></div>
      <div data-k="benachrichtigung"><b>${zahl(zi.ordner ?? 0)}</b><span>in Firmen-Ordner</span></div>
      <div data-k="wichtig"><b>${zahl((zi.bleibt ?? 0) + (zi.pruefen ?? 0))}</b><span>bleibt</span><small>${zi.pruefen ? `${zahl(zi.pruefen)} fragst du selbst` : ''}</small></div>
    </div>`;
  const ordner = ab.ordner?.length ? `<p class="alt-ordner"><span class="etikett">Neue Ordner:</span> ${ab.ordner.slice(0, 12).map((o: any) => `<span>${h(o.name)} <small>${zahl(o.anzahl)}</small></span>`).join('')}${ab.ordner.length > 12 ? ` <span>+ ${ab.ordner.length - 12} weitere</span>` : ''}</p>` : '';
  if (ab.phase === 'bereit') {
    const probe = z.einstellungen.trockenlauf;
    return `<p class="alt-status">${zahl(ab.gesamt)} Mails angesehen – noch nichts verändert. So würde ich aufräumen:</p>${zahlen}${ordner}${platzSchalter}
      <div class="zeile"><button class="knopf voll gross" data-ab="${probe ? 'start-echt' : 'start'}">Jetzt aufräumen</button>
      ${probe ? '<button class="knopf" data-ab="start">Nur probeweise</button>' : ''}<button class="knopf leise" data-ab="vorschau">Nochmal durchsehen</button></div>`;
  }
  const g = ab.geschafft ?? {};
  return `<p class="alt-status"><b>Fertig.</b> ${zahl(g.papierkorb ?? 0)} im Papierkorb, ${zahl(g.archiv ?? 0)} im Archiv, ${zahl(g.ordner ?? 0)} in Firmen-Ordnern.
    ${g.freiBytes ? `Gmail gibt ca. <b>${speicher(g.freiBytes)}</b> frei, sobald der Papierkorb geleert ist – automatisch nach 30 Tagen oder sofort in Gmail unter „Papierkorb → Jetzt leeren“.` : ''} Zurückholen geht unter „Verlauf“.</p>
    <div class="zeile"><button class="knopf" data-ab="vorschau">Nochmal durchsehen</button></div>`;
}
function entruempelnHtml(en: any): string {
  const rueck = (z?.entruempelnRueck || en?.phase === 'fertig') ? '<button class="knopf leise" data-en="zurueck">Letztes Entrümpeln rückgängig machen</button>' : '';
  if (!en || en.phase === 'leer') return `<div class="zeile"><button class="knopf voll gross" data-en="vorschau">Nachzählen</button>${rueck}</div>`;
  if (en.phase === 'zaehlt') return '<p class="alt-status">Ich zähle nach … (dauert bei vielen Mails ein, zwei Minuten)</p>';
  const p = en.gesamt ? Math.round((en.erledigt / en.gesamt) * 100) : 0;
  if (en.phase === 'laeuft') return `<p class="alt-status">Ich entrümple … <b>${zahl(en.erledigt)}</b> von ${zahl(en.gesamt)}</p><div class="fortschritt"><i data-stil="width:${p}%"></i></div>`;
  const zahlen = `<div class="alt-zahlen">
      <div data-k="wichtig"><b>${zahl(en.gelesen)}</b><span>als gelesen markieren</span><small>bleiben, wo sie sind</small></div>
      <div data-k="benachrichtigung"><b>${zahl(en.archiv)}</b><span>alte Infos ins Archiv</span><small>über die Suche jederzeit da</small></div></div>`;
  if (en.phase === 'bereit') return `<p class="alt-status">So würde ich es machen – noch ist nichts verändert:</p>${zahlen}
    <div class="zeile">${en.gesamt ? '<button class="knopf voll gross" data-en="start">Jetzt entrümpeln</button>' : '<span>Nichts zu tun – dein Posteingang ist schon sauber.</span>'}<button class="knopf leise" data-en="vorschau">Neu zählen</button></div>`;
  return `<p class="alt-status"><b>Fertig.</b> ${zahl(en.gelesen)} als gelesen markiert, ${zahl(en.archiv)} alte Infos im Archiv.</p>
    <div class="zeile"><button class="knopf" data-en="vorschau">Nochmal nachzählen</button>${rueck}</div>`;
}
function entruempelnKnoepfe() {
  for (const b of $$('[data-en]')) b.addEventListener('click', async () => {
    try {
      const was = b.dataset.en;
      if (was === 'vorschau') await api.rufe('entruempelnVorschau');
      else if (was === 'start') {
        if (!(await bestaetigen('Posteingang entrümpeln?', 'Ich markiere die alten Mails als gelesen und lege alte Infos ins Archiv. <b>Gelöscht wird nichts.</b> Mit „Rückgängig machen“ ist alles mit einem Klick wieder wie vorher.', 'Ja, entrümpeln'))) return;
        await api.rufe('entruempelnStarten'); z.entruempelnRueck = true; melde('Posteingang entrümpelt.');
      } else if (was === 'zurueck') {
        if (!(await bestaetigen('Rückgängig machen?', 'Alle Mails vom letzten Entrümpeln werden wieder ungelesen bzw. kommen zurück in den Posteingang.', 'Ja, zurück'))) return;
        const n = await api.rufe('entruempelnRueckgaengig'); z.entruempelnRueck = false; melde(`${zahl(n)} Mails sind wieder wie vorher.`);
      }
    } catch (e) { melde((e as Error).message); }
  });
}

function altbestandKnoepfe() {
  for (const b of $$('[data-ab]')) b.addEventListener('click', async () => {
    try {
      const was = b.dataset.ab;
      if (was === 'platz') {
        const an = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(an));
        z.einstellungen = await api.rufe('speichereEinstellungen', { altPlatzSchaffen: an });
        if (z.altbestand?.phase === 'bereit') melde('Geändert – „Nochmal durchsehen“ zeigt die neuen Zahlen.');
      } else if (was === 'vorschau') await api.rufe('altbestandVorschau');
      else if (was === 'start-echt') {
        if (!(await bestaetigen('Jetzt wirklich aufräumen?', 'Ich räume dein ganzes Postfach so auf, wie oben gezeigt, und ab jetzt auch jede neue Mail. <b>Endgültig gelöscht wird nie etwas</b> – der Papierkorb leert sich erst nach 30 Tagen, und unter „Verlauf“ holst du alles mit einem Klick zurück.', 'Ja, aufräumen'))) return;
        await api.rufe('scharfSchalten'); await laden(); await api.rufe('altbestandStarten');
      } else if (was === 'start') {
        if (!(await bestaetigen(z.einstellungen.trockenlauf ? 'Nur probeweise?' : 'Postfach aufräumen?', z.einstellungen.trockenlauf ? 'Ich trage nur in den Verlauf ein, was ich tun würde. Angefasst wird nichts.' : 'Ich räume jetzt alles so auf, wie oben gezeigt. Alles lässt sich 30 Tage lang zurückholen.', 'Starten'))) return;
        await api.rufe('altbestandStarten');
      }
    } catch (e) { melde((e as Error).message); }
  });
}

async function filterFrage(anzahl?: number): Promise<boolean> {
  const ok = await bestaetigen('Auch bei ausgeschaltetem PC aufräumen?', `Darf ich Regeln direkt in dein Gmail eintragen? Dann räumt Google selbst auf – rund um die Uhr, auch wenn PC und Handy aus sind: Werbung und Newsletter von Absendern, die ich schon oft weggeräumt habe${anzahl ? ` (gerade ${anzahl})` : ''}, und deine Firmen-Ordner (Amazon, DHL …). Rechnungen und Verträge bleiben trotzdem verschont, Kontakte werden nie angefasst. Schaltest du es aus, lösche ich die Regeln wieder.`, 'Ja, erlauben');
  if (ok) { const r = await api.rufe('filterFreigeben'); melde(`${r.angelegt} ${r.angelegt === 1 ? 'Filter' : 'Filter'} in Gmail eingetragen.`); await laden(); }
  return ok;
}

// ---------------- Live-Ereignisse ----------------
let statistikTimer: any;
/** Update-Anzeige unten in der Seitenleiste: lädt (Spektrum füllt sich) → bereit (Knopf „Neu starten“). */
let updateStand: any = null;
function zeigeUpdate(s: any) {
  updateStand = s;
  const el = $('#update');
  if (!s || (s.stand !== 'laedt' && s.stand !== 'bereit')) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false; el.dataset.stand = s.stand;
  el.innerHTML = s.stand === 'laedt'
    ? `<span class="update-zeile"><b>Update ${h(s.neu)}</b><span>wird geladen</span></span><span class="update-balken"><i data-stil="width:${Math.max(4, s.prozent)}%"></i></span>`
    : `<span class="update-zeile"><b>Update ${h(s.neu)} ist da</b><span>Installiert sich beim nächsten Neustart von selbst.</span></span><button class="knopf klein voll" data-update="jetzt" title="Update ${h(s.neu)} jetzt einspielen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></svg><span>Jetzt neu starten</span></button>`;
  el.querySelector('[data-update]')?.addEventListener('click', () => { void api.rufe('updateJetzt'); });
  if (ansicht === 'einstellungen') { const v = document.getElementById('version-stand'); if (v) v.textContent = updateText(s); }
}
function updateText(s: any): string {
  if (!s) return '';
  return ({ aus: `Version ${s.version} · Updates nur im installierten Programm`, sucht: `Version ${s.version} · suche nach Updates …`, aktuell: `Version ${s.version} · du hast die neueste Version`,
    laedt: `Version ${s.version} · Update ${s.neu} wird geladen (${s.prozent} %)`, bereit: `Version ${s.version} · Update ${s.neu} ist bereit`, fehler: `Version ${s.version} · Update-Server gerade nicht erreichbar, ich versuche es später wieder` } as Record<string, string>)[s.stand] ?? '';
}

function ereignis(kanal: string, d: any) {
  if (kanal === 'update') { zeigeUpdate(d); return; }
  if (kanal === 'aktion' || (kanal === 'postfach' && d?.neu)) {
    // Spektrum-Leiste oben blitzt einmal auf: es ist gerade eine Mail angekommen
    document.body.classList.remove('blitz'); void document.body.offsetWidth; document.body.classList.add('blitz');
    clearTimeout((window as any).__blitz); (window as any).__blitz = setTimeout(() => document.body.classList.remove('blitz'), 1500);
  }
  if ((kanal === 'postfach' || kanal === 'aktion') && ansicht === 'postfach' && post) {
    clearTimeout(postTimer); postTimer = setTimeout(() => { void post.laden(); void post.ordnerLaden(); }, 300);
  }
  if (kanal === 'mailto' && typeof d === 'string') {
    const u = new URL(d); zeigeAnsicht('postfach');
    post.schreiben({ an: [decodeURIComponent(u.pathname)], betreff: u.searchParams.get('subject') ?? '', text: u.searchParams.get('body') ?? '' });
    return;
  }
  if (kanal === 'aktion' && d) {
    if (ansicht === 'cockpit') {
      maschine.mail(fachVon(d.kategorie), d.trocken && art(d) === 'weg');
      const ol = document.getElementById('strom-liste');
      if (ol) {
        ol.querySelector('.leer-zeile')?.remove();
        ol.insertAdjacentHTML('afterbegin', stromZeile(d, true));
        while (ol.children.length > 10) ol.lastElementChild!.remove();
      }
    }
    clearTimeout(statistikTimer);
    statistikTimer = setTimeout(async () => {
      await laden();
      if (ansicht === 'cockpit') {
        const st = z.statistik; const m = st.lesezeitMinutenWoche;
        const w = document.getElementById('z-woche'); if (w) w.textContent = zahl(st.wocheEntfernt);
        const l = document.getElementById('z-lesezeit'); if (l) l.textContent = m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`;
      }
    }, 400);
  } else if (kanal === 'status') { if (z) { const vorher = z.status?.status; z.status = d; setzeStatus(d); if (ansicht === 'cockpit' && vorher !== d.status) void cockpit(); } }
  else if (kanal === 'entruempeln') { if (z) z.entruempeln = d; const en = document.getElementById('entruempeln'); if (en) { en.innerHTML = entruempelnHtml(d); entruempelnKnoepfe(); } }
  else if (kanal === 'altbestand') { if (z) z.altbestand = d; const ab = document.getElementById('altbestand'); if (ab) { ab.innerHTML = altbestandHtml(d); altbestandKnoepfe(); } }
  else if (kanal === 'frage' && d?.art === 'filter') { void filterFrage(d.anzahl); }
  else if (kanal === 'senden' && typeof d === 'string') { (window as any).__sendeStatus?.(d); }
  else if (kanal === 'sichtbar') { d ? maschine.start() : maschine.pause(); }
}

// CSP erlaubt keine style-Attribute im HTML – Breiten u. ä. werden per CSSOM gesetzt.
function stile(wurzel: ParentNode) {
  for (const el of wurzel.querySelectorAll<HTMLElement>('[data-stil]')) { el.style.cssText = el.dataset.stil!; el.removeAttribute('data-stil'); }
}
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) { if (n.dataset.stil) stile(n.parentElement!); stile(n); } })
  .observe(document.body, { childList: true, subtree: true });

// ---------------- Start ----------------
async function start() {
  maschine = new Sortierer($<HTMLCanvasElement>('#maschine'));
  post = new PostfachUI($('#ansicht-postfach'), api, melde,
    () => ({ probe: !!z?.einstellungen?.trockenlauf, weg: z?.statistik?.heuteEntfernt ?? 0, pruefen: z?.statistik?.zuPruefen ?? 0 }),
    (a) => zeigeAnsicht(a, true));
  // Beschriftung beim Drüberfahren (wichtig, wenn die Leiste eingeklappt ist)
  for (const b of $$('#nav button')) b.title = b.querySelector('.nav-name')?.textContent ?? '';
  (window as any).__maschine = maschine;
  // Landet ein Umschlag, hüpft die Zahl unter dem Fach und zählt eins hoch
  maschine.beiKlick = (i) => {
    const f = FAECHER[i];
    protokollFilter = { suche: '', kategorie: f === 'muell' ? 'spam' : f };
    zeigeAnsicht('protokoll', true);
    setTimeout(() => { const sel = document.getElementById('kat-filter') as HTMLSelectElement | null; if (sel) sel.value = protokollFilter.kategorie; }, 50);
  };
  // Lichtkegel: Mausposition relativ zum Element unter der Maus (nur bei Bewegung, gedrosselt auf Bildwechsel)
  const LICHT = '.lage, .karte, .maschine, .pf-zeile, .absender, .regel, .eintrag, .pruef, .einst-gruppe, .leer, .pf-ordner button, .zaehler-liste span';
  let lichtRaf = 0, lichtEvt: PointerEvent | null = null;
  document.addEventListener('pointermove', (e) => {
    lichtEvt = e;
    if (lichtRaf) return;
    lichtRaf = requestAnimationFrame(() => {
      lichtRaf = 0;
      const el = (lichtEvt?.target as Element | null)?.closest?.(LICHT) as HTMLElement | null;
      if (!el || !lichtEvt) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${lichtEvt.clientX - r.left}px`); el.style.setProperty('--my', `${lichtEvt.clientY - r.top}px`);
    });
  }, { passive: true });
  maschine.beiLandung = (i) => {
    const b = document.getElementById(`fach-${FAECHER[i]}`);
    if (!b) return;
    b.textContent = zahl((Number(b.textContent?.replace(/\./g, '')) || 0) + 1);
    b.classList.toggle('hupf', false); void b.offsetWidth; b.classList.toggle('hupf', true);
    setTimeout(() => b.classList.toggle('hupf', false), 260);
  };
  for (const b of $$('#nav button')) b.addEventListener('click', () => zeigeAnsicht(b.dataset.ziel!, true));
  // Navigation ein-/ausklappen (Wahl merken; Standard: eingeklappt im Postfach)
  let navWahl: string | null = null;
  try { navWahl = localStorage.getItem('nav'); } catch { /* egal */ }
  const navSetzen = () => { document.body.dataset.nav = navWahl ?? (ansicht === 'postfach' ? 'klein' : 'gross'); };
  (window as any).__navSetzen = navSetzen;
  $('#nav-klappe').addEventListener('click', () => {
    navWahl = document.body.dataset.nav === 'klein' ? 'gross' : 'klein';
    try { localStorage.setItem('nav', navWahl); } catch { /* egal */ }
    navSetzen();
  });
  api.auf(ereignis);
  zeigeUpdate(await api.rufe('updateStand'));
  await laden();
  zeigeAnsicht(new URLSearchParams(location.search).get('ansicht') ?? (z.angemeldet ? 'postfach' : 'cockpit'));
  maschine.start();
  (window as any).__bereit = true;
}
void start();
