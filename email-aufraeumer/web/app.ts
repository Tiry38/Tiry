// Tiry's Mails – Handy-App. Gleicher Kern wie am PC (src/core), Gmail direkt über das Netz.
import { Postfach, type Ordner, type Zeile, type Lesen } from '../src/core/postfach';
import type { GmailPort } from '../src/core/gmail';
import { KATEGORIE_NAME, type Kategorie } from '../src/core/types';
import { textZuHtml, bytesZuBase64 } from '../src/core/mime';
import { erzeugeWebGmail, AnmeldungAbgelaufen } from './gmailWeb';
import { STAND_BETREFF, standLesen, standNachricht, type Stand } from '../src/core/stand';
import * as an from './anmeldung';

// ---------- Grundlagen ----------
const $ = <T extends HTMLElement = HTMLElement>(s: string, w: ParentNode = document) => w.querySelector<T>(s)!;
const h = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEMO = new URLSearchParams(location.search).has('demo');
const app = $('#app');

const I = {
  ordner: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  suche: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  stift: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  sortieren: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  zurueck: '<path d="M15 5l-7 7 7 7"/>',
  zu: '<path d="M6 6l12 12M18 6L6 18"/>',
  archiv: '<path d="M4 5h16v4H4zM5 9v10h14V9M10 13h4"/>',
  muell: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  stern: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  verschieben: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 13h6M13 10l3 3-3 3"/>',
  ungelesen: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  antworten: '<path d="M10 8L4 13l6 5"/><path d="M4 13h10a6 6 0 0 1 6 6"/>',
  allen: '<path d="M8 8l-5 5 5 5"/><path d="M13 8l-5 5 5 5"/><path d="M8 13h7a6 6 0 0 1 6 6"/>',
  weiter: '<path d="M14 8l6 5-6 5"/><path d="M20 13H10a6 6 0 0 0-6 6"/>',
  klammer: '<path d="M16 7l-7.5 7.5a2.5 2.5 0 0 0 3.5 3.5L19.5 10.5a4.5 4.5 0 0 0-6.4-6.4L5.6 11.6a6.5 6.5 0 0 0 9.2 9.2L20 15.6"/>',
  senden: '<path d="M4 12l16-8-6 16-3-7z"/><path d="M11 13l9-9"/>',
  abmelden: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  neu: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>',
};
const ik = (n: keyof typeof I, label?: string) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>${label ? `<span class="unsichtbar">${h(label)}</span>` : ''}`;

/** Feder (Masse 1): Steifigkeit k, Dämpfung d. Bewegung mit Gewicht statt Easing. */
function feder(von: number, nach: number, setze: (v: number) => void, opt: { k?: number; d?: number; v0?: number; fertig?: () => void } = {}) {
  if (RUHIG) { setze(nach); opt.fertig?.(); return () => {}; }
  const k = opt.k ?? 260, d = opt.d ?? 24;
  let x = von, v = opt.v0 ?? 0, t0 = performance.now(), aus = false;
  const schritt = (t: number) => {
    if (aus) return;
    let dt = Math.min(0.032, (t - t0) / 1000); t0 = t;
    while (dt > 0) { const s = Math.min(dt, 0.004); v += (-k * (x - nach) - d * v) * s; x += v * s; dt -= s; }
    if (Math.abs(x - nach) < 0.4 && Math.abs(v) < 4) { setze(nach); opt.fertig?.(); return; }
    setze(x); requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
  return () => { aus = true; };
}

// Sortenfarben: wie am PC
const FARBE: Record<string, string> = {
  wichtig: 'var(--c-wichtig)', persoenlich: 'var(--c-persoenlich)', benachrichtigung: 'var(--c-benachrichtigung)',
  newsletter: 'var(--c-newsletter)', werbung: 'var(--c-werbung)', spam: 'var(--c-muell)', phishing: 'var(--c-muell)',
};
const SORTE_NAME: Record<string, string> = { ...KATEGORIE_NAME, phishing: 'Betrug', benachrichtigung: 'Info' };

// ---------- Zustand ----------
let gmail: GmailPort;
let post: Postfach;
let ich = '';
let ordnerListe: Ordner[] = [];
const labelName = new Map<string, string>();
let ordner = 'INBOX';
let suche = '';
let zeilen: Zeile[] = [];
let weiter: string | undefined;
let laedt = false;
let historyId = '';
let offen: Lesen | null = null;

const namenZuKat = new Map<string, Kategorie>(Object.entries(KATEGORIE_NAME).map(([k, v]) => [v, k as Kategorie]));
function kategorieVon(_id: string, labels: string[]): Kategorie | null {
  for (const l of labels) {
    const n = labelName.get(l);
    if (n?.startsWith('Aufräumer/')) { const k = namenZuKat.get(n.slice(10)); if (k) return k; }
  }
  return labels.includes('SPAM') ? 'spam' : null;
}

function toast(text: string, rueck?: () => void, knopf?: { text: string; tun: () => void }) {
  const t = $('#toast');
  const k = knopf ?? (rueck ? { text: 'Rückgängig', tun: rueck } : null);
  t.innerHTML = `<span>${h(text)}</span>${k ? `<button class="knopf">${h(k.text)}</button>` : ''}`;
  if (k) t.querySelector('button')!.addEventListener('click', () => { t.classList.remove('an'); k.tun(); });
  t.classList.add('an');
  clearTimeout((t as any)._t); (t as any)._t = setTimeout(() => t.classList.remove('an'), knopf ? 12000 : rueck ? 6500 : 3500);
}
const arbeitet = (an_: boolean) => document.body.classList.toggle('arbeitet', an_);
function blitz() { document.body.classList.remove('blitz'); void document.body.offsetWidth; document.body.classList.add('blitz'); }

async function sicher<T>(f: () => Promise<T>): Promise<T | undefined> {
  try { return await f(); } catch (e) {
    if (e instanceof AnmeldungAbgelaufen) { if (NATIV) nativStartSeite('Die Anmeldung ist abgelaufen – bitte einmal neu anmelden.'); else an.anmelden(true); return undefined; }
    toast(`Hat nicht geklappt: ${(e as Error).message}`); return undefined;
  } finally { arbeitet(false); }
}

// ---------- Logo-Balken: lebende Feder ----------
const BASIS = [30, 20, 26, 14, 22];
let balkenStand = [...BASIS];
function balkenSetzen(werte: number[]) {
  document.querySelectorAll<HTMLElement>('.marke i').forEach((el, i) => el.style.setProperty('--h', String(Math.max(4, werte[i]))));
}
/** Neue Mail: die Balken springen und schwingen aus. */
function balkenStoss(staerke = 1) {
  BASIS.forEach((b, i) => {
    feder(balkenStand[i], b, (v) => { balkenStand[i] = v; balkenSetzen(balkenStand); }, { k: 180, d: 7, v0: (i % 2 ? -1 : 1) * 260 * staerke * (0.6 + Math.random() * 0.6) });
  });
}
const marke = (gross = false) => `<span class="marke"${gross ? '' : ' aria-hidden="true"'}>${BASIS.map((b) => `<i style="--h:${gross ? b * 1.6 : b}"></i>`).join('')}</span>`;

// ---------- Datum ----------
function zeit(t: number) {
  const d = new Date(t), j = new Date();
  if (d.toDateString() === j.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date(Date.now() - 86400_000).toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (Date.now() - t < 6 * 86400_000) return d.toLocaleDateString('de-DE', { weekday: 'short' });
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
function tagGruppe(t: number) {
  const d = new Date(t), j = new Date(); const gestern = new Date(Date.now() - 86400_000);
  if (d.toDateString() === j.toDateString()) return 'Heute';
  if (d.toDateString() === gestern.toDateString()) return 'Gestern';
  if (Date.now() - t < 6 * 86400_000) return 'Diese Woche';
  return d.toLocaleDateString('de-DE', { month: 'long', year: d.getFullYear() === j.getFullYear() ? undefined : 'numeric' });
}

// ---------- Auf den Startbildschirm ----------
const NATIV = an.nativ();
const ALS_APP = !!NATIV || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as any).standalone === true;
let installAngebot: any = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installAngebot = e; document.querySelectorAll<HTMLElement>('[data-install]').forEach((b) => (b.hidden = false)); });
function installHinweis(): string {
  if (ALS_APP) return '<p class="app-ok">✓ Du bist schon in der App – sie liegt auf deinem Startbildschirm als <b>Tiry\'s Mails</b>.</p>';
  const ios = /iPhone|iPad/i.test(navigator.userAgent);
  return `<div class="app-hinweis"><button class="knopf voll" data-install ${installAngebot ? '' : 'hidden'}>Auf den Startbildschirm</button>
    <p>${ios ? 'In Safari: Teilen-Knopf (Viereck mit Pfeil) → <b>„Zum Home-Bildschirm“</b>.' : 'In Chrome: <b>⋮</b> oben rechts → <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b>.'} Danach die App über das neue Symbol öffnen und dort weitermachen.</p></div>`;
}
document.addEventListener('click', async (e) => {
  if (!(e.target as Element).closest?.('[data-install]') || !installAngebot) return;
  installAngebot.prompt(); await installAngebot.userChoice.catch(() => null); installAngebot = null;
  document.querySelectorAll<HTMLElement>('[data-install]').forEach((b) => (b.hidden = true));
});

// ---------- Einrichtung / Anmeldung ----------
function startSeite(fehler?: string) {
  document.body.dataset.ansicht = 'start';
  const id = an.clientId() ?? '';
  const rueck = an.rueckAdresse();
  const ursprung = location.origin;
  const schritt = id ? 3 : 1;
  void schritt;
  const zeile = (n: number, titel: string, inhalt: string) =>
    `<li class="schritt ${schritt > n ? 'fertig' : schritt === n ? 'jetzt' : ''}"><b>${n}</b><div><strong>${titel}</strong>${inhalt}</div></li>`;
  app.innerHTML = `<section class="start">
    ${marke(true)}
    <h1>Dein Post&shy;fach. <em>Jetzt auch hier.</em></h1>
    <p>Einmal einrichten, danach öffnest du Tiry's Mails wie eine App – live mit deinem Gmail.</p>
    ${installHinweis()}
    <ol class="schritte">
      ${zeile(1, 'Zugang bei Google anlegen', `<p>Erst <b>diese 7 Schritte merken</b> (oder Bildschirmfoto machen) – dann den gelben Knopf drücken. Der kopiert die Adresse für dich und öffnet Google.</p>
        <ol class="merk">
          <li><span>Oben links muss <b>dein Projekt vom PC-Programm</b> stehen.</span></li>
          <li><span><span class="g">Anwendungstyp</span> → <span class="g">Webanwendung</span></span></li>
          <li><span><span class="g">Name</span>: <b>Handy</b></span></li>
          <li><span>Bei <span class="g">Autorisierte JavaScript-Quellen</span> → <span class="g">+ URI hinzufügen</span> → nur das eintippen: <b class="mono">${h(ursprung)}</b> (ohne Schrägstrich, ohne Rest)</span></li>
          <li><span><b>Darunter</b> bei <span class="g">Autorisierte Weiterleitungs-URIs</span> – das <b>zweite</b> <span class="g">+ URI hinzufügen</span> → ins Feld <b>lange drücken → Einfügen</b></span></li>
          <li><span>Ganz unten <span class="g">Erstellen</span>. Im Fenster neben der <b>Client-ID</b> auf das <b>Kopier-Symbol</b> (zwei Blätter).</span></li>
          <li><span>Oben links auf <b>✕</b> – du bist wieder hier.</span></li>
        </ol>
        <button class="knopf voll gross" data-google>Adresse kopieren &amp; Google öffnen</button>
        <p class="tipp">Kopiert wird: <code>${h(rueck)}</code></p>`)}
      ${zeile(2, 'Client-ID einfügen', `<p>Zurück von Google? Dann einfach drücken – die kopierte Client-ID kommt von selbst ins Feld.</p>
        <button class="knopf voll" data-einfuegen>Client-ID einfügen</button>
        <input class="eingabe" id="client" inputmode="url" autocomplete="off" spellcheck="false" placeholder="123…-abc….apps.googleusercontent.com" value="${h(id)}">`)}
      ${zeile(3, 'Anmelden', `<p>Bei Google <b>dein Konto wählen</b> und alles erlauben. Kommt „Google hat diese App nicht überprüft“: <b>Weiter</b> – das ist deine eigene App.</p>
        <button class="knopf voll" id="los">Mit Google anmelden</button>`)}
    </ol>
    ${fehler ? `<p class="fehler" role="alert">${h(fehler)}</p>` : ''}
    <a class="demo-link" href="?demo">Erst mal ansehen (Vorschau ohne Konto)</a>
  </section>`;
  app.querySelector('[data-google]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(rueck); } catch { /* Feld zeigt die Adresse zum Abtippen */ }
    window.open('https://console.cloud.google.com/auth/clients/create', '_blank', 'noopener');
  });
  app.querySelector('[data-einfuegen]')?.addEventListener('click', async () => {
    const feld = $<HTMLInputElement>('#client');
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (an.gueltigeClientId(t)) { feld.value = t; feld.classList.add('ok'); $('#los').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      toast('In der Zwischenablage ist keine Client-ID. Bei Google neben „Client-ID“ aufs Kopier-Symbol drücken.');
    } catch { feld.focus(); toast('Lange ins Feld drücken → Einfügen.'); }
  });
  app.querySelectorAll<HTMLButtonElement>('[data-kopie]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.kopie!); b.textContent = 'Kopiert ✓'; } catch { b.textContent = 'Markieren & kopieren'; }
  }));
  $('#los').addEventListener('click', () => {
    const wert = $<HTMLInputElement>('#client').value.trim();
    if (!an.gueltigeClientId(wert)) { startSeite('Die Client-ID sieht nicht richtig aus. Sie endet auf „.apps.googleusercontent.com“.'); $<HTMLInputElement>('#client').value = wert; return; }
    an.clientIdSetzen(wert); an.anmelden(false);
  });
}

// ---------- Liste ----------
function listeGeruest() {
  document.body.dataset.ansicht = 'liste';
  app.innerHTML = `<section class="liste-ansicht">
    <header class="kopf">${marke()}<button class="ikon" id="suchen" aria-label="Suchen">${ik('suche')}</button><button class="ikon" id="konto" aria-label="Konto">${ik('abmelden')}</button></header>
    <div class="titel"><h1 id="titel"></h1><p><span class="live" id="live"></span><span id="unter"></span></p></div>
    <form class="suche" id="suchform" role="search" hidden><input id="suchfeld" type="search" enterkeyhint="search" placeholder="Absender, Betreff, Text" aria-label="Suchen"><button class="ikon" type="button" id="suche-zu" aria-label="Suche schließen">${ik('zu')}</button></form>
    <div class="zug" aria-hidden="true"><span class="zug-text" id="zug-text">Loslassen zum Aktualisieren</span></div>
    <ul class="zeilen" id="zeilen"></ul>
    <div class="mehr" id="mehr"></div>
  </section>
  <nav class="dock" aria-label="Hauptmenü">
    <button id="d-ordner">${ik('ordner')}Ordner</button>
    <button id="d-aufr">${ik('sortieren')}Aufräumer</button>
    <button id="d-suche">${ik('suche')}Suchen</button>
    <button class="schreiben" id="d-schreiben">${ik('stift')}Schreiben</button>
  </nav>`;
  balkenSetzen(balkenStand);
  $('#d-ordner').addEventListener('click', ordnerBogen);
  $('#d-aufr').addEventListener('click', () => void aufraeumerAnsicht());
  const sucheAuf = () => { $('#suchform').hidden = false; $<HTMLInputElement>('#suchfeld').focus(); };
  $('#d-suche').addEventListener('click', sucheAuf); $('#suchen').addEventListener('click', sucheAuf);
  $('#suchform').addEventListener('submit', (e) => { e.preventDefault(); suche = $<HTMLInputElement>('#suchfeld').value.trim(); void laden(true); $<HTMLInputElement>('#suchfeld').blur(); });
  $('#suche-zu').addEventListener('click', () => { $('#suchform').hidden = true; if (suche) { suche = ''; void laden(true); } });
  $('#d-schreiben').addEventListener('click', () => schreiben({}));
  $('#konto').addEventListener('click', kontoBogen);
  ziehenZumAktualisieren();
  new IntersectionObserver((e) => { if (e[0].isIntersecting && weiter && !laedt) void laden(false); }, { rootMargin: '400px' }).observe($('#mehr'));
  titelSetzen();
}

function titelSetzen() {
  const o = ordnerListe.find((x) => x.id === ordner);
  const t = document.getElementById('titel'); if (!t) return;
  t.textContent = suche ? `„${suche}“` : o?.name ?? 'Posteingang';
  const u = o?.id === 'INBOX' && o.ungelesen ? `${o.ungelesen.toLocaleString('de-DE')} ungelesen · live` : 'live mit Gmail';
  $('#unter').textContent = DEMO ? `${u} · Vorschau` : u;
}

function zeileHtml(z: Zeile) {
  const farbe = z.kategorie ? FARBE[z.kategorie] : 'var(--linie)';
  return `<li class="zeile" data-id="${h(z.id)}">
    <div class="zeile-unter"><span class="links">${ik('archiv')}Archiv</span><span class="rechts">Papierkorb${ik('muell')}</span></div>
    <button class="karte${z.ungelesen ? ' neu' : ''}" style="--farbe:${farbe}">
      <span class="von">${h(z.von)}<span class="zeichen">${z.stern ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'}"/></svg>` : ''}${z.anhang ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">${I.klammer}</svg>` : ''}</span></span>
      <time>${zeit(z.datum)}</time>
      <span class="betreff">${h(z.betreff || '(kein Betreff)')}</span>
      <span class="vorschau">${h(z.vorschau)}</span>
    </button></li>`;
}

function listeZeichnen() {
  const ul = document.getElementById('zeilen'); if (!ul) return;
  if (!zeilen.length) { ul.innerHTML = `<li class="leer"><b>${suche ? 'Nichts gefunden.' : 'Alles leer.'}</b>${suche ? 'Probier ein anderes Wort.' : 'Hier liegt gerade keine Mail.'}</li>`; return; }
  let html = '', gruppe = '';
  for (const z of zeilen) { const g = tagGruppe(z.datum); if (g !== gruppe) { gruppe = g; html += `<li class="tag" aria-hidden="true">${g}</li>`; } html += zeileHtml(z); }
  ul.innerHTML = html;
  ul.querySelectorAll<HTMLElement>('.zeile').forEach(wischbar);
  $('#mehr').textContent = weiter ? 'Lade weitere …' : zeilen.length > 12 ? 'Das war alles.' : '';
}

async function laden(neu: boolean, still = false) {
  if (laedt) return; laedt = true; if (!still) arbeitet(true);
  try {
    const r = await sicher(() => post.liste(ordner, suche, neu ? undefined : weiter));
    if (!r) return;
    zeilen = neu ? r.zeilen : [...zeilen, ...r.zeilen.filter((z) => !zeilen.some((x) => x.id === z.id))];
    weiter = r.weiter;
    listeZeichnen();
    void post.vorladen(zeilen.slice(0, 6).map((z) => z.id)); // die obersten Mails gleich mitladen → Öffnen ohne Warten
  } finally { laedt = false; arbeitet(false); }
}

async function ordnerLaden() {
  const o = await sicher(() => post.ordner());
  if (!o) return;
  ordnerListe = o;
  labelName.clear();
  for (const l of await gmail.labels()) labelName.set(l.id, l.name);
  titelSetzen();
  const inbox = o.find((x) => x.id === 'INBOX');
  if ('setAppBadge' in navigator) { try { inbox?.ungelesen ? await (navigator as any).setAppBadge(inbox.ungelesen) : await (navigator as any).clearAppBadge(); } catch { /* egal */ } }
}

// ---------- Wischen mit Federkraft (Signatur-Moment) ----------
function wischbar(li: HTMLElement) {
  const karte = li.querySelector<HTMLElement>('.karte')!;
  const unter = li.querySelector<HTMLElement>('.zeile-unter')!;
  let x0 = 0, y0 = 0, dx = 0, aktiv = false, entschieden = false, quer = false, t0 = 0, stop: () => void = () => {};
  const setze = (x: number) => {
    karte.style.transform = `translate3d(${x}px,0,0) rotate(${x / 90}deg)`;
    li.dataset.richtung = x > 0 ? 'rechts' : 'links';
    unter.style.setProperty('--sicht', String(Math.min(1, Math.abs(x) / 110)));
  };
  karte.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    void post.vorladen([li.dataset.id!]); // beim Antippen schon laden – bis der Finger oben ist, ist sie meist da
    stop(); x0 = e.clientX; y0 = e.clientY; dx = 0; aktiv = true; entschieden = false; quer = false; t0 = performance.now();
  });
  karte.addEventListener('pointermove', (e) => {
    if (!aktiv) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!entschieden && Math.hypot(mx, my) > 8) { entschieden = true; quer = Math.abs(mx) > Math.abs(my) * 1.2; if (quer) karte.setPointerCapture(e.pointerId); else aktiv = false; }
    if (quer) { dx = mx; setze(dx); e.preventDefault(); }
  });
  const ende = (e: PointerEvent) => {
    if (!aktiv) return; aktiv = false;
    if (!quer) return;
    const tempo = dx / Math.max(1, performance.now() - t0) * 1000;
    const breite = li.clientWidth;
    if (Math.abs(dx) > breite * 0.32 || (Math.abs(tempo) > 900 && Math.abs(dx) > 40)) {
      const richtung = Math.sign(dx);
      // weggeworfen: Schwung mitnehmen, dann Zeile zusammenfallen lassen
      stop = feder(dx, richtung * (breite + 80), setze, { k: 120, d: 14, v0: tempo, fertig: () => wegwerfen(li, richtung > 0 ? 'archiv' : 'papierkorb') });
      try { navigator.vibrate?.(12); } catch { /* egal */ }
    } else {
      stop = feder(dx, 0, setze, { k: 420, d: 22, v0: tempo });
    }
    void e;
  };
  karte.addEventListener('pointerup', ende); karte.addEventListener('pointercancel', ende);
  karte.addEventListener('click', (e) => { if (Math.abs(dx) > 6) { e.preventDefault(); return; } void lesen(li.dataset.id!); });
}

async function wegwerfen(li: HTMLElement, a: 'archiv' | 'papierkorb') {
  const id = li.dataset.id!;
  li.style.height = `${li.offsetHeight}px`; void li.offsetHeight;
  li.classList.add('weg'); li.style.height = '0px';
  setTimeout(() => li.remove(), 400);
  zeilen = zeilen.filter((z) => z.id !== id);
  const ok = await sicher(async () => { await post.aktion([id], a); return true; });
  if (ok) toast(a === 'archiv' ? 'Archiviert' : 'In den Papierkorb gelegt', async () => { await sicher(() => post.rueckgaengig()); await laden(true, true); });
  void ordnerLaden();
}

// ---------- Herunterziehen = Balken spannen ----------
function ziehenZumAktualisieren() {
  let y0 = 0, zug = 0, aktiv = false;
  const liste = $('#zeilen'), text = $('#zug-text');
  const setze = (v: number) => {
    zug = v;
    liste.style.transform = v ? `translate3d(0,${v}px,0)` : '';
    text.style.setProperty('--zug', String(Math.min(1, v / 90)));
    balkenSetzen(BASIS.map((b, i) => b + v * (0.2 + 0.12 * ((i * 3) % 5))));
  };
  addEventListener('touchstart', (e) => { if (scrollY <= 0 && document.body.dataset.ansicht === 'liste' && !document.querySelector('.ebene, .bogen')) { y0 = e.touches[0].clientY; aktiv = true; } }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!aktiv) return;
    const d = e.touches[0].clientY - y0;
    if (d <= 0 || scrollY > 0) { if (zug) setze(0); return; }
    setze(110 * (1 - Math.exp(-d / 160))); // Gummiband: je weiter, desto zäher
  }, { passive: true });
  addEventListener('touchend', () => {
    if (!aktiv) return; aktiv = false;
    const los = zug > 72;
    feder(zug, 0, setze, { k: 300, d: 18 });
    if (los) { balkenStoss(1.4); void Promise.all([laden(true), ordnerLaden()]); }
  });
}

// ---------- Bogen (Bottom-Sheet) ----------
function bogen(titel: string, inhalt: string): { el: HTMLElement; zu: () => void } {
  document.querySelector('.bogen')?.remove(); document.querySelector('.schleier')?.remove();
  const schleier = document.createElement('div'); schleier.className = 'schleier';
  const el = document.createElement('section'); el.className = 'bogen'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', titel);
  el.innerHTML = `<div class="bogen-griff"><i></i></div><h2>${h(titel)}</h2><div class="bogen-inhalt">${inhalt}</div>`;
  document.body.append(schleier, el);
  const hoehe = () => el.offsetHeight;
  const setze = (y: number) => { el.style.transform = `translate3d(0,${y}px,0)`; schleier.style.setProperty('--schleier', String(Math.max(0, 1 - y / hoehe()))); };
  setze(hoehe()); feder(hoehe(), 0, setze, { k: 320, d: 28 });
  let zuGemacht = false;
  const zu = (v0 = 0) => { if (zuGemacht) return; zuGemacht = true; feder(Number(/(-?[\d.]+)px,0/.exec(el.style.transform)?.[1] ?? 0), hoehe() + 20, setze, { k: 260, d: 26, v0, fertig: () => { el.remove(); schleier.remove(); } }); };
  schleier.addEventListener('click', () => zu());
  // am Griff oder Titel nach unten ziehen
  let y0 = 0, dy = 0, t0 = 0, zieht = false;
  for (const g of [el.querySelector<HTMLElement>('.bogen-griff')!, el.querySelector<HTMLElement>('h2')!]) {
    g.addEventListener('pointerdown', (e) => { zieht = true; y0 = e.clientY; t0 = performance.now(); g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointermove', (e) => { if (!zieht) return; dy = Math.max(-20, e.clientY - y0); setze(dy < 0 ? dy / 4 : dy); });
    g.addEventListener('pointerup', () => { if (!zieht) return; zieht = false; const v = dy / Math.max(1, performance.now() - t0) * 1000; if (dy > hoehe() * 0.3 || v > 700) zu(v); else feder(dy, 0, setze, { k: 380, d: 26, v0: v }); dy = 0; });
  }
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { zu(); removeEventListener('keydown', esc); } });
  return { el, zu: () => zu() };
}

function ordnerWahl(o: Ordner, aktuell: string) {
  const farbe = o.art === 'sorte' ? FARBE[namenZuKat.get(o.name) ?? ''] ?? 'var(--linie)' : o.art === 'firma' ? 'var(--text-3)' : '';
  return `<button class="wahl" data-o="${h(o.id)}" aria-current="${o.id === aktuell}">${farbe ? `<span class="punkt" style="--farbe:${farbe}"></span>` : ''}${h(o.name)}${o.ungelesen ? `<b>${o.ungelesen}</b>` : ''}</button>`;
}
function ordnerGruppen(aktuell: string, nurZiele = false) {
  const sys = ordnerListe.filter((o) => o.art === 'system' && (!nurZiele || ['INBOX'].includes(o.id)));
  const eigen = ordnerListe.filter((o) => o.art === 'firma' || o.art === 'eigen');
  const sorte = ordnerListe.filter((o) => o.art === 'sorte');
  return sys.map((o) => ordnerWahl(o, aktuell)).join('') +
    (eigen.length ? `<div class="gruppe">Deine Ordner</div>${eigen.map((o) => ordnerWahl(o, aktuell)).join('')}` : '') +
    (sorte.length ? `<div class="gruppe">Vom Aufräumer sortiert</div>${sorte.map((o) => ordnerWahl(o, aktuell)).join('')}` : '');
}

function ordnerBogen() {
  const b = bogen('Ordner', ordnerGruppen(ordner));
  b.el.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((x) => x.addEventListener('click', () => {
    ordner = x.dataset.o!; suche = ''; b.zu(); titelSetzen(); scrollTo(0, 0); void laden(true);
  }));
}

function kontoBogen() {
  const b = bogen('Konto', `<p class="erklaer">${DEMO ? 'Vorschau ohne Konto.' : `Angemeldet als <b>${h(ich)}</b>.`} Mails gehen nur zwischen diesem Handy und Google hin und her – kein Server dazwischen.</p>
    ${installHinweis().replace('class="app-ok"', 'class="app-ok erklaer"').replace('class="app-hinweis"', 'class="app-hinweis erklaer"')}
    ${NATIV ? '<button class="wahl" id="k-popups">Popups bei neuen Mails</button>' : ANDROID_BROWSER ? `<a class="wahl" href="${APK}">Echte Android-App mit Popups laden</a>` : ''}
    <button class="wahl" id="k-pc">Was macht der PC?</button>
    <button class="wahl" id="k-ab">${DEMO ? 'Vorschau beenden' : 'Abmelden'}</button>`);
  $('#k-pc', b.el).addEventListener('click', () => { b.zu(); void aufraeumerAnsicht(); });
  b.el.querySelector('#k-popups')?.addEventListener('click', () => { b.zu(); setTimeout(popupBogen, 250); });
  $('#k-ab', b.el).addEventListener('click', () => { an.abmelden(); location.href = location.pathname; });
}

// ---------- Echte Android-App: Einrichtung, Popups, Update ----------
const APK = 'https://github.com/Tiry38/Tiry/releases/download/tirys-mails-android/Tirys-Mails.apk';
const ANDROID_BROWSER = !NATIV && /Android/i.test(navigator.userAgent);

function nativStartSeite(fehler?: string) {
  document.body.dataset.ansicht = 'start';
  const datei = NATIV.hatZugangsdatei();
  const schritt = datei ? 3 : 1;
  const zeile = (n: number, titel: string, inhalt: string) =>
    `<li class="schritt ${schritt > n ? 'fertig' : schritt === n ? 'jetzt' : ''}"><b>${n}</b><div><strong>${titel}</strong>${inhalt}</div></li>`;
  app.innerHTML = `<section class="start">
    ${marke(true)}
    <h1>Fast <em>fertig.</em></h1>
    <p>Die echte App braucht einen eigenen Zugang bei Google – damit sie dauerhaft angemeldet bleibt und dir Popups schicken kann.</p>
    <ol class="schritte">
      ${zeile(1, 'Zugang bei Google anlegen', `<p>Erst <b>diese 5 Schritte merken</b> (oder Bildschirmfoto), dann den Knopf drücken.</p>
        <ol class="merk">
          <li><span>Oben links muss <b>dein Projekt vom PC-Programm</b> stehen.</span></li>
          <li><span><span class="g">Anwendungstyp</span> → <span class="g">Desktop-App</span></span></li>
          <li><span><span class="g">Name</span>: <b>Handy-App</b></span></li>
          <li><span>Unten <span class="g">Erstellen</span>. Im Fenster auf <span class="g">JSON herunterladen</span> drücken.</span></li>
          <li><span>Zurück zu Tiry's Mails (unten in der Leiste wischen oder über „Letzte Apps“).</span></li>
        </ol>
        <button class="knopf voll gross" data-n="google">Google öffnen</button>
        <p class="tipp">Keine Adressen eintragen nötig – bei „Desktop-App“ fragt Google nicht danach.</p>`)}
      ${zeile(2, 'Heruntergeladene Datei wählen', `<p>Die Datei heißt <b>client_secret_….json</b> und liegt in <b>Downloads</b>.</p>
        <button class="knopf voll" data-n="datei">${datei ? 'Datei gewählt ✓ – andere wählen' : 'Datei wählen'}</button>`)}
      ${zeile(3, 'Anmelden', `<p>Der Browser öffnet sich: <b>dein Konto wählen</b>. Kommt „Google hat diese App nicht überprüft“: <b>Weiter</b>. Dann <b>alle Haken setzen</b> und <b>Weiter</b>. Danach springst du von selbst hierher zurück.</p>
        <button class="knopf voll" data-n="los" ${datei ? '' : 'disabled'}>Mit Google anmelden</button>`)}
    </ol>
    ${fehler ? `<p class="fehler" role="alert">${h(fehler)}</p>` : ''}
  </section>`;
  $('[data-n="google"]').addEventListener('click', () => NATIV.extern('https://console.cloud.google.com/auth/clients/create'));
  $('[data-n="datei"]').addEventListener('click', () => NATIV.zugangsdateiWaehlen());
  $('[data-n="los"]').addEventListener('click', (e) => { (e.currentTarget as HTMLButtonElement).textContent = 'Warte auf Google …'; NATIV.anmelden(); });
}
(window as any).__nativeDatei = (fehler: string) => { if (fehler) nativStartSeite(fehler); else { nativStartSeite(); toast('Datei übernommen ✓ Jetzt anmelden.'); } };
(window as any).__nativeAngemeldet = (fehler: string) => { if (fehler) nativStartSeite(fehler); else location.replace(location.pathname + '?app=1'); };
(window as any).__oeffneMail = (id: string) => { if (document.querySelector('.schreib-ebene')) return; void lesen(id); };
(window as any).__schreibeAn = (adr: string) => schreiben({ an: [decodeURIComponent(adr.split('?')[0])] });
(window as any).__nativeUpdate = (name: string) => toast(`Neue App-Version ${name} ist da.`, undefined, { text: 'Installieren', tun: () => NATIV?.updateInstallieren() });
(window as any).__nativeUpdateFehler = (t: string) => toast(t);
(window as any).__nativeZustand = () => { if (document.querySelector('.bogen[aria-label="Popups"]')) popupBogen(); };

/** Popups einrichten: Erlaubnis, Wächter, Akku-Ausnahme – mit Live-Zustand. */
function popupBogen() {
  if (!NATIV) return;
  const erlaubt = NATIV.popupsErlaubt(), waechter = NATIV.waechterAn(), akku = NATIV.akkuFrei();
  const zeile = (ok: boolean, titel: string, text: string, knopf: string) => `<div class="pz ${ok ? 'ok' : ''}"><b>${ok ? '✓' : '!'}</b><div><strong>${titel}</strong><p>${text}</p>${ok ? '' : knopf}</div></div>`;
  const offen = document.querySelector('.bogen[aria-label="Popups"]');
  const inhalt = `
    ${zeile(erlaubt, 'Popups erlaubt', erlaubt ? 'Android darf dir Popups von Tiry\'s Mails zeigen.' : 'Android muss Popups für Tiry\'s Mails einmal erlauben.', '<button class="knopf voll" data-p="erlauben">Erlauben</button>')}
    ${zeile(akku, 'Läuft auch im Ruhezustand', akku ? 'Android schickt den Wächter nicht schlafen.' : 'Sonst kommen Popups bei ausgeschaltetem Bildschirm verspätet. Im nächsten Fenster <b>Zulassen</b> drücken.', '<button class="knopf voll" data-p="akku">Freigeben</button>')}
    <label class="schalter pz-schalter"><input type="checkbox" data-p="waechter" ${waechter ? 'checked' : ''}>Popups bei neuen wichtigen Mails</label>
    ${NATIV.dauerHinweisSichtbar?.() ? `<div class="pz"><b>i</b><div><strong>Dauer-Hinweis oben ausblenden</strong><p>Android verlangt für Apps, die im Hintergrund wach bleiben, einen Hinweis in der Leiste. Den kannst du abschalten – <b>Popups bei neuen Mails kommen trotzdem</b>. Im nächsten Fenster den Schalter <b>ausschalten</b>.</p><button class="knopf voll" data-p="hinweis">Hinweis ausblenden</button></div></div>` : ''}
    <p class="erklaer">Popups kommen nur für <b>wichtige und persönliche Mails</b> – Werbung, Newsletter, soziale Netzwerke und Spam bleiben still. Nur wenn eine neue Mail kommt, erscheint ein Popup.</p>
    <button class="wahl" data-p="einst">Ton & Vibration bei Popups ändern</button>`;
  if (offen) { offen.querySelector('.bogen-inhalt')!.innerHTML = inhalt; binden(offen as HTMLElement); return; }
  const b = bogen('Popups', inhalt);
  binden(b.el);
  function binden(el: HTMLElement) {
    el.querySelector('[data-p="erlauben"]')?.addEventListener('click', () => NATIV.popupsAnfragen());
    el.querySelector('[data-p="akku"]')?.addEventListener('click', () => NATIV.akkuAnfragen());
    el.querySelector('[data-p="einst"]')?.addEventListener('click', () => NATIV.popupEinstellungen());
    el.querySelector('[data-p="hinweis"]')?.addEventListener('click', () => NATIV.dauerHinweisAus());
    el.querySelector<HTMLInputElement>('[data-p="waechter"]')?.addEventListener('change', (e) => { NATIV.waechter((e.target as HTMLInputElement).checked); toast((e.target as HTMLInputElement).checked ? 'Popups an' : 'Popups aus'); });
  }
}

// ---------- Aufräumer heute ----------
const SORTIERT = [
  { name: 'Werbung', label: 'Werbung', was: 'Angebote, Rabatte, Shops', farbe: 'var(--c-werbung)' },
  { name: 'Newsletter', label: 'Newsletter', was: 'Rundschreiben, Abos', farbe: 'var(--c-newsletter)' },
  { name: 'Infos', label: 'Benachrichtigung', was: 'Pakete, Konten, Apps', farbe: 'var(--c-benachrichtigung)' },
];
// ---------- Aufräumer: dieselbe Übersicht wie am PC (aus dem Stand-Entwurf, den der PC alle 2 Min. schreibt) ----------
const FACH: Array<{ k: string; name: string; farbe: string; tat: string }> = [
  { k: 'wichtig', name: 'Wichtig', farbe: 'var(--c-wichtig)', tat: 'bleibt' }, { k: 'persoenlich', name: 'Persönlich', farbe: 'var(--c-persoenlich)', tat: 'bleibt' },
  { k: 'benachrichtigung', name: 'Info', farbe: 'var(--c-benachrichtigung)', tat: 'bleibt, Etikett' }, { k: 'newsletter', name: 'Newsletter', farbe: 'var(--c-newsletter)', tat: '→ Archiv' },
  { k: 'werbung', name: 'Werbung', farbe: 'var(--c-werbung)', tat: '→ Archiv' }, { k: 'muell', name: 'Spam & Betrug', farbe: 'var(--c-muell)', tat: '→ Papierkorb' },
];
const ZIEL: Record<string, string> = { papierkorb: '→ Papierkorb', archiv: '→ Archiv', bleibt: 'bleibt im Posteingang', pruefen: 'wartet auf dich (am PC)', geschuetzt: 'geschützt – nicht angefasst' };
const speicherText = (b: number) => b >= 1e9 ? `${(b / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB` : b >= 1e6 ? `${Math.round(b / 1e6).toLocaleString('de-DE')} MB` : b > 0 ? `${Math.max(1, Math.round(b / 1e3))} KB` : '0 MB';
const dauer = (min: number) => min >= 60 ? `${Math.floor(min / 60)} Std. ${min % 60} Min.` : `${min} Min.`;
const vor = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : `vor ${Math.round(m / 1440)} Tagen`; };

async function aufraeumerAnsicht() {
  history.pushState({ aufr: 1 }, '');
  const e = ebene('aufr-ebene', `<div class="ebene-kopf"><button class="ikon" data-z aria-label="Zurück">${ik('zurueck')}</button><span class="platz"></span>
      <button class="ikon" data-neu aria-label="Aktualisieren">${ik('neu')}</button></div>
    <div class="ebene-inhalt aufr" id="aufr"><p class="aufr-lade">Hole den Stand von deinem PC …</p></div>`);
  aufrEbene = e;
  e.el.querySelector('[data-z]')!.addEventListener('click', () => history.back());
  const zeichne = async () => {
    let stand: Stand | null = null;
    try { const t = await gmail.standText?.(STAND_BETREFF); stand = t ? standLesen(t) : null; } catch { /* unten Hinweis */ }
    if (!e.el.isConnected) return;
    $('#aufr', e.el).innerHTML = stand ? aufrHtml(stand) : `<section class="aufr-lage" data-art="aus"><h2>Noch kein Stand vom PC.</h2>
      <p>Damit du hier alles siehst wie am PC: Tiry's Mails am PC <b>aktualisieren</b> (unten links „Jetzt neu starten“). Danach schickt der PC alle 2 Minuten seinen Stand hierher.</p></section>`;
    e.el.querySelectorAll<HTMLButtonElement>('[data-ordnername]').forEach((b) => b.addEventListener('click', () => {
      const o = ordnerListe.find((x) => x.name === b.dataset.ordnername); if (!o) { toast('Den Ordner gibt es in Gmail noch nicht.'); return; }
      ordner = o.id; suche = ''; history.back(); titelSetzen(); scrollTo(0, 0); void laden(true);
    }));
  };
  e.el.querySelector('[data-neu]')!.addEventListener('click', () => { $('#aufr', e.el).classList.add('laedt'); void zeichne().then(() => $('#aufr', e.el).classList.remove('laedt')); });
  await zeichne();
}
let aufrEbene: { el: HTMLElement; zu: () => void } | null = null;

function aufrHtml(s: Stand) {
  const alt = Date.now() - s.zeit > 10 * 60_000;
  const probe = s.status === 'trockenlauf';
  const art = alt ? 'aus' : s.status === 'fehler' ? 'fehler' : probe ? 'probe' : 'laeuft';
  const titel = alt ? 'Dein PC ist gerade aus.' : art === 'fehler' ? 'Am PC hakt etwas.' : probe ? 'Probelauf.' : 'Läuft. Ich räume für dich auf.';
  const text = alt ? `Letzter Stand: ${vor(s.zeit)} – neue Werbung räumt Gmail trotzdem weg${s.gmailRegeln ? ` – ${s.gmailRegeln} Regeln arbeiten direkt bei Google` : ''}.`
    : probe ? 'Der PC zeigt nur, was er tun würde – angefasst wird noch nichts. Am PC „Jetzt wirklich aufräumen“ drücken.'
    : `Neue Mails sortiert der PC in Sekunden. Stand: ${vor(s.zeit)}`;
  const max = Math.max(1, ...FACH.map((f) => s.heute[f.k].echt + s.heute[f.k].probe));
  const sum = FACH.reduce((a, f) => a + s.heute[f.k].echt + s.heute[f.k].probe, 0);
  const st = s.statistik; const a = s.altbestand;
  return `
    <section class="aufr-lage" data-art="${art}"><h2>${titel}</h2><p>${text}</p></section>
    <section class="aufr-block"><div class="aufr-kopf"><h3>Heute sortiert</h3><p><b>${sum.toLocaleString('de-DE')}</b> Mails · ${st.heuteEntfernt.toLocaleString('de-DE')} ${probe ? 'würde ich wegräumen' : 'weggeräumt'}</p></div>
      <div class="maschine" role="img" aria-label="${FACH.map((f) => `${f.name} ${s.heute[f.k].echt + s.heute[f.k].probe}`).join(', ')}">
        ${FACH.map((f, i) => { const n = s.heute[f.k].echt + s.heute[f.k].probe; return `<div class="fach${s.heute[f.k].probe ? ' gestreift' : ''}"><b>${n.toLocaleString('de-DE')}</b><i style="--farbe:${f.farbe};--anteil:${n / max};--n:${i}"></i></div>`; }).join('')}
      </div>
      <div class="faecher-namen">${FACH.map((f) => `<span>${f.name}<small>${f.tat}</small></span>`).join('')}</div></section>
    <section class="aufr-block"><h3>Diese Woche</h3>
      <dl class="woche">
        <div><dt>${probe ? 'Würde ich wegräumen' : 'Weggeräumt'}</dt><dd>${st.wocheEntfernt.toLocaleString('de-DE')}</dd></div>
        <div><dt>Gesparte Lesezeit</dt><dd>${dauer(st.lesezeitMinutenWoche)}</dd></div>
        <div><dt>Wartet auf dich</dt><dd>${st.zuPruefen.toLocaleString('de-DE')}</dd></div>
        <div><dt>Insgesamt weggeräumt</dt><dd>${st.gesamtEntfernt.toLocaleString('de-DE')}</dd></div>
        <div><dt>Platz frei gemacht</dt><dd>${speicherText(st.platzWoche ?? 0)}</dd></div>
        <div><dt>Platz frei – insgesamt</dt><dd>${speicherText(st.platzGesamt ?? 0)}</dd></div>
      </dl><p class="erklaer klein">Platz: Mails im Papierkorb geben ihren Speicher frei, sobald Gmail den Papierkorb leert (nach 30 Tagen).</p>${st.zuPruefen ? '<p class="erklaer klein">„Wartet auf dich“ entscheidest du am PC unter „Du entscheidest“.</p>' : ''}</section>
    ${a && a.gesamt ? `<section class="aufr-block"><h3>Altes Postfach</h3>
      <p class="alt-zeile"><b>${a.erledigt.toLocaleString('de-DE')}</b> von ${a.gesamt.toLocaleString('de-DE')} · ${a.phase === 'fertig' ? 'fertig ✓' : a.phase === 'laeuft' ? (alt ? 'pausiert (PC aus)' : 'läuft') : a.phase === 'bereit' ? 'Vorschau fertig – am PC starten' : 'Vorschau läuft'}</p>
      <span class="fach-balken alt-balken"><i style="--farbe:var(--akzent);--anteil:${a.erledigt / a.gesamt}"></i></span>
      ${a.geschafft ? `<p class="erklaer klein">${a.geschafft.papierkorb.toLocaleString('de-DE')} in den Papierkorb · ${a.geschafft.archiv.toLocaleString('de-DE')} ins Archiv · ${a.geschafft.ordner.toLocaleString('de-DE')} in Firmen-Ordner${a.geschafft.freiBytes ? ` · ${(a.geschafft.freiBytes / 1_048_576).toLocaleString('de-DE', { maximumFractionDigits: 0 })} MB frei, sobald der Papierkorb leer ist` : ''}</p>` : ''}</section>` : ''}
    <section class="aufr-block"><h3>Was zuletzt passiert ist</h3>
      <ol class="aufr-liste">${s.letzte.map((x) => `<li style="--farbe:${FACH.find((f) => f.k === (x.kategorie === 'spam' || x.kategorie === 'phishing' ? 'muell' : x.kategorie))?.farbe ?? 'var(--linie)'}">
        <span class="wer">${h(x.absender)}</span><time>${zeit(x.zeit)}</time><span class="was">${h(x.betreff || '(kein Betreff)')}</span>
        <span class="wohin">${x.trocken && ['papierkorb', 'archiv', 'ordner'].includes(x.ziel) ? 'würde ' : ''}${x.ziel === 'ordner' ? `→ Ordner „${h(x.ordner)}“` : ZIEL[x.ziel]}</span></li>`).join('') || '<li class="leer-z">Noch nichts passiert.</li>'}</ol></section>
    ${s.ordner.length ? `<section class="aufr-block"><h3>Deine Firmen-Ordner</h3><div class="ordner-wolke">${s.ordner.map((o) => `<button data-ordnername="${h(o.name)}">${h(o.name)}<b>${o.anzahl.toLocaleString('de-DE')}</b></button>`).join('')}</div></section>` : ''}
    <section class="aufr-block"><h3>Auch ohne PC</h3><p class="erklaer">${s.gmailRegeln ? `<b>${s.gmailRegeln} Regeln</b> stehen direkt in deinem Gmail – Google räumt damit Werbung, Newsletter und Firmen-Mails rund um die Uhr weg, auch wenn PC und Handy aus sind.` : 'Noch keine Regeln in Gmail. Am PC unter Einstellungen „Auch bei ausgeschaltetem PC“ einschalten – dann räumt Google selbst weiter auf.'}</p></section>`;
}

// ---------- Lesen ----------
function ebene(klasse: string, html: string, vonRechts = true): { el: HTMLElement; zu: () => void } {
  const el = document.createElement('section'); el.className = `ebene ${klasse}`; el.innerHTML = html;
  document.body.append(el);
  const breite = innerWidth;
  const setze = (x: number) => { el.style.transform = vonRechts ? `translate3d(${x}px,0,0)` : `translate3d(0,${x}px,0)`; };
  const start = vonRechts ? breite : innerHeight;
  setze(start); feder(start, 0, setze, { k: 300, d: 30 });
  document.body.style.overflow = 'hidden';
  let zuGemacht = false;
  const zu = () => {
    if (zuGemacht) return; zuGemacht = true;
    document.body.style.overflow = '';
    feder(0, start, setze, { k: 300, d: 32, fertig: () => el.remove() });
  };
  // vom linken Rand nach rechts wischen = zurück (wie iOS)
  if (vonRechts) {
    let x0 = -1, dx = 0, t0 = 0;
    el.addEventListener('touchstart', (e) => { const x = e.touches[0].clientX; if (x < 28) { x0 = x; t0 = performance.now(); } }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (x0 < 0) return; dx = Math.max(0, e.touches[0].clientX - x0); setze(dx); }, { passive: true });
    el.addEventListener('touchend', () => { if (x0 < 0) return; x0 = -1; const v = dx / Math.max(1, performance.now() - t0) * 1000; if (dx > breite * 0.35 || v > 600) { zuGemacht = true; document.body.style.overflow = ''; feder(dx, breite, setze, { k: 260, d: 28, v0: v, fertig: () => el.remove() }); history.back(); } else feder(dx, 0, setze, { k: 380, d: 28 }); dx = 0; });
  }
  return { el, zu };
}

let lesenEbene: { el: HTMLElement; zu: () => void } | null = null;
function lesenSchliessen() { lesenEbene?.zu(); lesenEbene = null; offen = null; }

async function lesen(id: string) {
  const z = zeilen.find((x) => x.id === id);
  lesenEbene?.el.remove();
  history.pushState({ lesen: id }, '');
  const e = ebene('lesen-ebene', `<div class="ebene-kopf">
      <button class="ikon" data-a="zurueck" aria-label="Zurück">${ik('zurueck')}</button><span class="platz"></span>
      <button class="ikon" data-a="archiv" aria-label="Archivieren">${ik('archiv')}</button>
      <button class="ikon" data-a="papierkorb" aria-label="Papierkorb">${ik('muell')}</button>
      <button class="ikon" data-a="verschieben" aria-label="Verschieben">${ik('verschieben')}</button>
      <button class="ikon" data-a="stern" aria-label="Stern">${ik('stern')}</button>
      <button class="ikon" data-a="ungelesen" aria-label="Als ungelesen markieren">${ik('ungelesen')}</button>
    </div>
    <div class="ebene-inhalt"><div class="lesen-kopf"><h2>${h(z?.betreff ?? '')}</h2></div><div id="lesen-rest"></div></div>
    <div class="ebene-fuss">
      <button class="knopf" data-a="antworten">${ik('antworten')}Antworten</button>
      <button class="knopf" data-a="allen">${ik('allen')}Allen</button>
      <button class="knopf" data-a="weiter">${ik('weiter')}Weiter</button>
    </div>`);
  lesenEbene = e;
  e.el.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => lesenAktion(b.dataset.a!)));
  arbeitet(true);
  const m = await sicher(() => post.lesen(id));
  if (!m || !e.el.isConnected) return;
  offen = m;
  if (z?.ungelesen) { z.ungelesen = false; document.querySelector(`.zeile[data-id="${CSS.escape(id)}"] .karte`)?.classList.remove('neu'); void ordnerLaden(); }
  const farbe = m.kategorie ? FARBE[m.kategorie] : 'var(--flaeche-2)';
  e.el.querySelector('.lesen-kopf')!.innerHTML = `<h2>${h(m.betreff || '(kein Betreff)')}</h2>
    <div class="absender" style="--farbe:${farbe}${m.kategorie ? '' : ';--kreis-text:var(--text)'}"><span class="kreis">${h((m.von || '?').trim()[0]?.toUpperCase() ?? '?')}</span><b>${h(m.von)}</b>
      <small>${h(m.vonAdresse)} · ${new Date(m.datum).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
    ${m.kategorie ? `<span class="sorte" style="--farbe:${farbe}">${h(SORTE_NAME[m.kategorie])}</span>` : ''}`;
  const sterne = m.labelIds.includes('STARRED');
  const sb = e.el.querySelector<HTMLButtonElement>('[data-a="stern"]')!; sb.dataset.a = sterne ? 'sternWeg' : 'stern'; sb.style.color = sterne ? 'var(--akzent)' : '';
  const rest = $('#lesen-rest', e.el);
  rest.innerHTML = `${m.warnung ? `<p class="warnung" role="alert">${h(m.warnung)}</p>` : ''}<iframe class="mail-rahmen" title="Inhalt der Mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
    ${m.anhaenge.filter((a) => !a.inline || !a.cid).length ? `<div class="anhaenge">${m.anhaenge.filter((a) => !a.inline || !a.cid).map((a, i) => `<button class="anhang" data-anhang="${i}">
      <span class="typ">${h((a.name.split('.').pop() ?? '').slice(0, 4))}</span><span><b>${h(a.name)}</b><small>${groesse(a.groesse)}</small></span>${ik('archiv')}</button>`).join('')}</div>` : ''}`;
  const liste = m.anhaenge.filter((a) => !a.inline || !a.cid);
  rest.querySelectorAll<HTMLButtonElement>('[data-anhang]').forEach((b) => b.addEventListener('click', async () => {
    const a = liste[Number(b.dataset.anhang)]; arbeitet(true);
    const daten = await sicher(() => post.anhang(m.id, a)); if (!daten) return;
    if (NATIV) { const f = NATIV.speichern(a.name, a.mime, bytesZuBase64(daten)); toast(f ? `Nicht gespeichert: ${f}` : `„${a.name}“ liegt in Downloads`); return; }
    const url = URL.createObjectURL(new Blob([daten as BlobPart], { type: a.mime }));
    const l = document.createElement('a'); l.href = url; l.download = a.name; document.body.append(l); l.click(); l.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }));
  await mailZeigen(rest.querySelector('iframe')!, m);
}

function groesse(n: number) { return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }

/** Mail sicher anzeigen: keine Skripte, Links öffnen außerhalb, Bilder an (außer Spam/Betrug), eingebettete Bilder (cid:) direkt eingesetzt. */
async function mailZeigen(f: HTMLIFrameElement, m: Lesen) {
  const sperre = m.kategorie === 'spam' || m.kategorie === 'phishing';
  let html = m.html ?? textZuHtml(m.text ?? '');
  const cids = m.anhaenge.filter((a) => a.cid && a.groesse < 3_000_000);
  if (cids.length && !sperre) {
    const daten = await Promise.all(cids.map((a) => post.anhang(m.id, a).catch(() => null)));
    cids.forEach((a, i) => {
      const d = daten[i]; if (!d) return;
      const url = URL.createObjectURL(new Blob([d as BlobPart], { type: a.mime }));
      html = html.split(`cid:${a.cid}`).join(url);
    });
  }
  if (m.kategorie === 'phishing') html = html.replace(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' data-gesperrt="1"');
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${sperre ? 'data:' : 'https: http: data: blob:'}; font-src data:`;
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width">
    <base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#1d1a17}body{padding:14px;font:16px/1.5 -apple-system,system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;
  const anpassen = () => {
    const d = f.contentDocument; if (!d?.body) return;
    const breit = d.documentElement.scrollWidth, platz = f.clientWidth;
    if (breit > platz + 4) (d.body.style as any).zoom = String(platz / breit);
    f.style.height = `${Math.ceil(d.documentElement.scrollHeight * (Number((d.body.style as any).zoom) || 1)) + 4}px`;
  };
  f.addEventListener('load', () => {
    anpassen();
    const d = f.contentDocument!;
    d.querySelectorAll('img').forEach((i) => i.addEventListener('load', anpassen));
    // mailto-Links öffnen das eigene Schreibfenster
    d.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a'); if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('mailto:')) { e.preventDefault(); const u = new URL(href); schreiben({ an: [decodeURIComponent(u.pathname)], betreff: u.searchParams.get('subject') ?? '' }); }
    });
  }, { once: true });
}

async function lesenAktion(a: string) {
  if (a === 'zurueck') { history.back(); return; }
  if (!offen) return;
  const m = offen;
  if (a === 'antworten' || a === 'allen' || a === 'weiter') {
    const v = await sicher(() => post.vorlage(m.id, a as 'antworten' | 'allen' | 'weiter')); if (v) schreiben(v); return;
  }
  if (a === 'verschieben') { verschiebenBogen([m.id]); return; }
  if (a === 'archiv' || a === 'papierkorb') {
    // sofort zu und weg – Gmail bekommt es im Hintergrund
    void sicher(async () => { await post.aktion([m.id], a as any); return true; }).then((ok) => { if (!ok) void laden(true, true); });
    history.back();
    zeilen = zeilen.filter((z) => z.id !== m.id);
    const li = document.querySelector<HTMLElement>(`.zeile[data-id="${CSS.escape(m.id)}"]`);
    if (li) { li.style.height = `${li.offsetHeight}px`; void li.offsetHeight; li.classList.add('weg'); li.style.height = '0px'; setTimeout(() => li.remove(), 400); }
    toast(a === 'archiv' ? 'Archiviert' : 'In den Papierkorb gelegt', async () => { await sicher(() => post.rueckgaengig()); await laden(true, true); });
  } else if (!(await sicher(async () => { await post.aktion([m.id], a as any); return true; }))) { return;
  } else if (a === 'ungelesen') { history.back(); toast('Als ungelesen markiert'); void laden(true, true); }
  else { toast(a === 'stern' ? 'Stern gesetzt' : 'Stern entfernt'); const b = document.querySelector<HTMLButtonElement>('.lesen-ebene [data-a^="stern"]'); if (b) { b.dataset.a = a === 'stern' ? 'sternWeg' : 'stern'; b.style.color = a === 'stern' ? 'var(--akzent)' : ''; } void laden(true, true); }
  void ordnerLaden();
}

function verschiebenBogen(ids: string[]) {
  const b = bogen('Verschieben nach', ordnerGruppen('', true).replace(/aria-current="true"/g, '') + '<button class="wahl" id="neu-ordner">+ Neuer Ordner</button>');
  b.el.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((x) => x.addEventListener('click', async () => {
    b.zu();
    const ziel = x.dataset.o!;
    const ok = await sicher(async () => { await post.aktion(ids, ziel === 'INBOX' ? 'posteingang' : { ordner: ziel }); return true; });
    if (ok) { if (offen && ids.includes(offen.id)) history.back(); toast(`Verschoben nach „${x.textContent?.trim()}“`, async () => { await sicher(() => post.rueckgaengig()); await laden(true, true); }); void laden(true, true); }
  }));
  $('#neu-ordner', b.el).addEventListener('click', async () => {
    const name = prompt('Name des neuen Ordners:'); if (!name) return;
    const id = await sicher(() => post.ordnerAnlegen(name)); if (!id) return;
    await ordnerLaden(); b.zu();
    const ok = await sicher(async () => { await post.aktion(ids, { ordner: id }); return true; });
    if (ok) { if (offen && ids.includes(offen.id)) history.back(); toast(`Verschoben nach „${name}“`); void laden(true, true); }
  });
}

// ---------- Schreiben ----------
interface SchreibStart { an?: string[]; cc?: string[]; betreff?: string; text?: string; threadId?: string; inReplyTo?: string; references?: string }
const GRENZE = 24 * 1024 * 1024;

function schreiben(v: SchreibStart) {
  history.pushState({ schreiben: 1 }, '');
  const dateien: Array<{ name: string; mime: string; daten: Uint8Array }> = [];
  const e = ebene('schreib-ebene', `<div class="ebene-kopf">
      <button class="ikon" data-s="zu" aria-label="Verwerfen">${ik('zu')}</button><span class="platz"></span>
      <label class="ikon" aria-label="Datei anhängen">${ik('klammer')}<input type="file" multiple hidden id="s-datei"></label>
      <button class="knopf voll" data-s="senden">${ik('senden')}Senden</button>
    </div>
    <div class="ebene-inhalt">
      <div class="feld"><label for="s-an">An</label><input id="s-an" type="email" inputmode="email" autocomplete="email" multiple value="${h((v.an ?? []).join(', '))}"><button class="ikon" data-s="cc" aria-label="Kopie hinzufügen">Cc</button></div>
      <div class="feld" id="s-cc-feld" ${v.cc?.length ? '' : 'hidden'}><label for="s-cc">Cc</label><input id="s-cc" type="email" inputmode="email" multiple value="${h((v.cc ?? []).join(', '))}"></div>
      <div class="feld"><label for="s-betreff">Betreff</label><input id="s-betreff" value="${h(v.betreff ?? '')}" enterkeyhint="next"></div>
      <textarea class="text-feld" id="s-text" aria-label="Nachricht" placeholder="Schreib deine Nachricht …">${h(v.text ?? '')}</textarea>
      <div class="dateien" id="s-dateien"></div>
      <div class="schreib-optionen"><label class="schalter"><input type="checkbox" id="s-gestaltet" checked>Gestaltet senden (deine Vorlage)</label></div>
    </div>`, false);
  const t = $<HTMLTextAreaElement>('#s-text', e.el);
  const hoch = () => { t.style.height = 'auto'; t.style.height = `${Math.max(t.scrollHeight, innerHeight * 0.4)}px`; };
  t.addEventListener('input', hoch); hoch();
  setTimeout(() => (v.an?.length ? t : $<HTMLInputElement>('#s-an', e.el)).focus({ preventScroll: true }), 350);
  if (v.text && v.an?.length) { t.setSelectionRange(0, 0); }
  $('[data-s="cc"]', e.el).addEventListener('click', () => { $('#s-cc-feld', e.el).hidden = false; $<HTMLInputElement>('#s-cc', e.el).focus(); });
  const zeigeDateien = () => {
    $('#s-dateien', e.el).innerHTML = dateien.map((d, i) => `<div class="datei">${ik('klammer')}<span>${h(d.name)}</span><small>${groesse(d.daten.length)}</small><button class="ikon" data-weg="${i}" aria-label="${h(d.name)} entfernen">${ik('zu')}</button></div>`).join('');
    e.el.querySelectorAll<HTMLButtonElement>('[data-weg]').forEach((b) => b.addEventListener('click', () => { dateien.splice(Number(b.dataset.weg), 1); zeigeDateien(); }));
  };
  $<HTMLInputElement>('#s-datei', e.el).addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    for (const f of Array.from(input.files ?? [])) {
      const summe = dateien.reduce((a, d) => a + d.daten.length, 0) + f.size;
      if (summe > GRENZE) { toast(`„${f.name}“ ist zu groß fürs Handy (max. 24 MB zusammen). Große Dateien am PC senden – dort geht's über Google Drive.`); continue; }
      dateien.push({ name: f.name, mime: f.type || 'application/octet-stream', daten: new Uint8Array(await f.arrayBuffer()) });
    }
    input.value = ''; zeigeDateien();
  });
  const leer = () => !$<HTMLInputElement>('#s-an', e.el).value.trim() && !t.value.trim() && !dateien.length;
  $('[data-s="zu"]', e.el).addEventListener('click', () => { if (leer() || confirm('Nachricht verwerfen?')) history.back(); });
  $('[data-s="senden"]', e.el).addEventListener('click', async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement; b.disabled = true; arbeitet(true);
    const liste = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    const ok = await sicher(async () => {
      if (DEMO) { await new Promise((r) => setTimeout(r, 700)); }
      await post.senden({ an: liste($<HTMLInputElement>('#s-an', e.el).value), cc: liste($<HTMLInputElement>('#s-cc', e.el).value),
        betreff: $<HTMLInputElement>('#s-betreff', e.el).value, text: t.value, threadId: v.threadId, inReplyTo: v.inReplyTo, references: v.references,
        anhaenge: dateien, gestaltet: $<HTMLInputElement>('#s-gestaltet', e.el).checked, vonName: 'Tiry' });
      return true;
    });
    b.disabled = false;
    if (ok) { schreibEbene = null; history.back(); e.zu(); toast('Gesendet ✓'); blitz(); if (ordner === 'SENT') void laden(true, true); }
  });
  schreibEbene = e;
}
let schreibEbene: { el: HTMLElement; zu: () => void } | null = null;

// Zurück-Taste (Android) / Wischgeste schließt Ebenen in der richtigen Reihenfolge
addEventListener('popstate', () => {
  if (document.querySelector('.bogen')) { (document.querySelector('.schleier') as HTMLElement)?.click(); }
  if (schreibEbene) { schreibEbene.zu(); schreibEbene = null; return; }
  if (aufrEbene && !lesenEbene) { aufrEbene.zu(); aufrEbene = null; return; }
  if (lesenEbene) { lesenSchliessen(); }
});

// ---------- Live: alle 8 Sekunden bei Gmail nachfragen (nur wenn die App offen ist) ----------
async function abgleich() {
  if (document.hidden || !historyId) return;
  try {
    const r = await gmail.history(historyId);
    historyId = r.historyId;
    $('#live')?.classList.remove('aus');
    if (r.geaendert) {
      if (r.neueIds.length) { balkenStoss(); blitz(); try { navigator.vibrate?.(8); } catch { /* egal */ } }
      if (!document.querySelector('.ebene')) await laden(true, true);
      void ordnerLaden();
    }
  } catch (e) {
    if (e instanceof AnmeldungAbgelaufen) { if (NATIV) return; if (!document.querySelector('.schreib-ebene')) an.anmelden(true); return; }
    if ((e as any)?.code === 404) { const p = await gmail.profil(); historyId = p.historyId; }
    document.getElementById('live')?.classList.add('aus');
  }
}

// ---------- Demo-Postfach (Vorschau ohne Konto) ----------
async function demoGmail(): Promise<GmailPort> {
  const { erzeugeDemo } = await import('../src/main/demo');
  const d = erzeugeDemo();
  const g = d.gmail;
  const lab = async (n: string) => g.labelAnlegen(n);
  const amazon = await lab('Amazon'), dhl = await lab('DHL'); await lab('Aufräumer');
  const nl = await lab('Aufräumer/Newsletter'), wb = await lab('Aufräumer/Werbung'), ben = await lab('Aufräumer/Benachrichtigung'), wi = await lab('Aufräumer/Wichtig'), sp = await lab('Aufräumer/Spam');
  const jetzt = Date.now(); let i = 0;
  for (const m of g.mails.values()) {
    const s = `${m.headers.from} ${m.headers.subject}`;
    if (/newsletter|heise|GameStar|Medium/i.test(s)) m.labelIds.push(nl);
    else if (/Zalando|MediaMarkt|Angelplatz|Weko|Lieferando|Rocket/i.test(s)) m.labelIds.push(wb);
    else if (/DHL Paket|Hermes|Instagram/i.test(s)) m.labelIds.push(ben);
    else if (/Vodafone|ELSTER|Sabine|Mama/i.test(s)) m.labelIds.push(wi);
    else if (/bitprofit|paypa1|sk-online|paket-info/i.test(s)) m.labelIds.push(sp);
    if (/DHL Paket/.test(s)) m.labelIds.push(dhl);
    if (i % 4 === 0) m.labelIds = m.labelIds.filter((l) => l !== 'UNREAD');
    if (i === 3) m.labelIds.push('STARRED');
    m.internalDate = jetzt - i * 47 * 60_000; i++;
  }
  g.hinzufuegen({ id: 'amz1', threadId: 'amz1', labelIds: ['INBOX', 'UNREAD', amazon], snippet: 'Deine Bestellung ist unterwegs – Lieferung morgen.', internalDate: jetzt - 6 * 60_000, headers: { from: 'Amazon.de <versandbestaetigung@amazon.de>', subject: 'Versandt: Bissanzeiger-Set (2 Stück)' } }, false);
  for (const [id, m] of g.mails) {
    if (/Black Week|Rechnung|Sonntag|Versandt/.test(m.headers.subject ?? '')) g.inhalte.set(id, { html: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f3efe6;padding:24px 22px;font-family:system-ui"><h1 style="font-size:26px;margin:0 0 10px;color:#1d1a17">${m.headers.subject}</h1><p style="color:#3a3632">Hallo Tiry,</p><p style="color:#3a3632">${m.snippet || 'hier ist deine Nachricht.'}</p><p><a href="https://example.com" style="display:inline-block;background:#1d1a17;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Ansehen</a></p></td></tr></table>` });
  }
  const jetzt2 = Date.now();
  const demoStand: Stand = { v: 1, zeit: jetzt2 - 60_000, status: 'laeuft',
    heute: { wichtig: { echt: 6, probe: 0 }, persoenlich: { echt: 2, probe: 0 }, benachrichtigung: { echt: 9, probe: 0 }, newsletter: { echt: 14, probe: 0 }, werbung: { echt: 23, probe: 0 }, muell: { echt: 4, probe: 0 } },
    statistik: { heuteEntfernt: 41, wocheEntfernt: 312, gesamtEntfernt: 7180, heuteGeprueft: 58, lesezeitMinutenWoche: 104, zuPruefen: 3, platzWoche: 186_000_000, platzGesamt: 1_320_000_000 },
    letzte: [...g.mails.values()].slice(0, 12).map((m, i) => ({ zeit: m.internalDate, absender: (m.headers.from ?? '').replace(/<.*>/, '').trim(), betreff: m.headers.subject ?? '',
      kategorie: (['werbung', 'newsletter', 'benachrichtigung', 'wichtig', 'spam'] as const)[i % 5], trocken: false,
      ziel: (['archiv', 'archiv', 'ordner', 'bleibt', 'papierkorb'] as const)[i % 5], ordner: i % 5 === 2 ? 'DHL' : undefined })),
    altbestand: { phase: 'laeuft', gesamt: 25737, erledigt: 7100, geschafft: { papierkorb: 4210, archiv: 1830, ordner: 1060, freiBytes: 1_320_000_000 } },
    ordner: [{ name: 'Amazon', anzahl: 412 }, { name: 'DHL', anzahl: 188 }, { name: 'PayPal', anzahl: 141 }, { name: 'Vodafone', anzahl: 64 }, { name: 'eBay', anzahl: 57 }], gmailRegeln: 86 };
  await g.standSpeichern(standNachricht(demoStand, 'tiry@gmail.com'), null);
  setInterval(() => { d.tropfen(); }, 9000);
  return g;
}

// ---------- Immer die neueste Oberfläche ----------
// Die App bleibt oft tagelang offen (in der Android-App hält der Wächter sie wach) – dann lädt sie sich
// beim Zurückkommen selbst neu, sobald auf GitHub eine neuere Fassung liegt. Nie mitten im Schreiben.
let pruefteFassung = 0;
async function neueFassung() {
  if (DEMO || Date.now() - pruefteFassung < 60_000) return;
  pruefteFassung = Date.now();
  try {
    const jetzt = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ?? '';
    const html = await (await fetch(location.pathname, { cache: 'no-store' })).text();
    const neu = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1] ?? /src="(\.\/assets\/index-[^"]+\.js)"/.exec(html)?.[1];
    if (neu && jetzt && neu !== jetzt && !document.querySelector('.schreib-ebene')) location.reload();
  } catch { /* offline – später */ }
}

// ---------- Start ----------
async function start() {
  if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const r = an.rueckkehrAuswerten();
  if (DEMO) { gmail = await demoGmail(); ich = 'tiry@gmail.com'; }
  else if (NATIV) {
    if (!NATIV.angemeldet()) { nativStartSeite(); return; }
    gmail = erzeugeWebGmail(an.token);
  } else {
    if (r && !r.ok) { if (r.still) { an.anmelden(false); return; } startSeite(r.fehler); return; }
    if (!an.clientId()) { startSeite(); return; }
    if (!an.token()) { if (an.email()) { an.anmelden(true); return; } startSeite(); return; }
    gmail = erzeugeWebGmail(an.token);
  }
  post = new Postfach(gmail, kategorieVon, () => ich || 'ich');
  listeGeruest();
  if (r?.ok && !ALS_APP && !DEMO) setTimeout(() => toast('Fertig eingerichtet ✓ Ab jetzt öffnest du Tiry\'s Mails über das Symbol auf dem Startbildschirm.'), 600);
  arbeitet(true);
  const p = await sicher(() => gmail.profil());
  if (!p) return;
  ich = p.email; historyId = p.historyId; if (!DEMO) an.merkeEmail(ich);
  if (NATIV) { NATIV.merkeEmail(ich); if (!NATIV.popupsErlaubt() || !NATIV.akkuFrei() || NATIV.dauerHinweisSichtbar?.()) setTimeout(popupBogen, 900); }
  await ordnerLaden();
  await laden(true);
  balkenStoss(0.8);
  setInterval(abgleich, DEMO ? 4000 : 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { void abgleich(); void neueFassung(); } });
  setInterval(() => void neueFassung(), 30 * 60_000);
  (window as any).__bereit = true;
}
void start();
