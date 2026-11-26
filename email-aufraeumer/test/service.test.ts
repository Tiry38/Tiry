import { describe, it, expect, beforeEach } from 'vitest';
import { SpeicherGmail as FakeGmail } from '../src/core/speicherGmail';
import { FAELLE } from './fixtures/mails';
import { Speicher } from '../src/core/db';
import { Aufraeumer } from '../src/core/service';
import { mitBackoff } from '../src/core/gmail';
import { abmelden, baueMailtoNachricht } from '../src/core/unsubscribe';
import { parseListUnsubscribe } from '../src/core/headers';
import type { Mail } from '../src/core/types';

const TAG = 86400_000;
const fall = (name: string) => structuredClone(FAELLE.find((f) => f.name === name)!.mail);

function aufbau() {
  let uhr = Date.UTC(2026, 10, 26, 9, 0);
  const gmail = new FakeGmail();
  const db = new Speicher(':memory:');
  const posts: Array<{ url: string; body: string }> = [];
  const dienst = new Aufraeumer({ gmail, db, jetzt: () => uhr, post: async (url, body) => { posts.push({ url, body }); return { status: 200 }; } });
  return { gmail, db, dienst, posts, vor: (ms: number) => { uhr += ms; }, uhr: () => uhr };
}

/** Kontakt-Mail im Gesendet-Ordner, damit „Mama“ und „Dennis“ geschützt sind. */
function gesendet(gmail: FakeGmail) {
  gmail.hinzufuegen({ id: 's1', threadId: 's1', labelIds: ['SENT'], snippet: '', internalDate: 0,
    headers: { from: 'tiry@gmail.com', to: 'Mama <mama.thirolf@web.de>, "Dennis K." <dennis.k@gmail.com>', subject: 'Hi' } }, false);
}

async function scharf(t: ReturnType<typeof aufbau>) {
  expect((await t.dienst.scharfSchalten()).ok).toBe(true);
}

describe('Trockenlauf', () => {
  it('verändert nichts und protokolliert, was passieren würde', async () => {
    const t = aufbau(); gesendet(t.gmail);
    await t.dienst.starten(); t.dienst.stoppen();
    for (const f of FAELLE) t.gmail.hinzufuegen(structuredClone(f.mail));
    const vorher = structuredClone([...t.gmail.mails.values()]);
    const n = await t.dienst.tick();
    expect(n).toBe(FAELLE.length);
    expect([...t.gmail.mails.values()]).toEqual(vorher);
    expect(t.gmail.aufrufe.some((a) => /modify|trash|batch/.test(a))).toBe(false);
    const p = t.db.protokoll({ limit: 1000 });
    expect(p.every((e) => e.trocken)).toBe(true);
    const spam = p.find((e) => e.betreff.startsWith('Nur heute 90%'))!;
    expect(spam.aktionen).toEqual(['papierkorb']);
    expect(spam.nachherLabels).toContain('TRASH');
    expect(t.posts.length + t.gmail.gesendet.length).toBe(0);
  });

  it('„Jetzt wirklich aufräumen“ geht sofort und räumt die Mails aus dem Probelauf mit auf', async () => {
    const t = aufbau(); gesendet(t.gmail);
    await t.dienst.starten(); t.dienst.stoppen();
    const spam = fall('Gmail-Spam Krypto'); const mama = fall('Mama (Kontakt)'); const rechnung = fall('Rechnung Vodafone');
    for (const m of [spam, mama, rechnung]) t.gmail.hinzufuegen(m);
    await t.dienst.tick();
    expect(t.gmail.get(spam.id).labelIds).not.toContain('TRASH'); // Probelauf: nichts angefasst
    const r = await t.dienst.scharfSchalten();
    expect(r).toMatchObject({ ok: true, nachgeholt: 1 });
    expect(t.db.einstellungen().trockenlauf).toBe(false);
    expect(t.gmail.get(spam.id).labelIds).toContain('TRASH');
    expect(t.gmail.get(mama.id).labelIds).toEqual(mama.labelIds);
    expect(t.gmail.get(rechnung.id).labelIds).toEqual(rechnung.labelIds);
  });
});

describe('Live-Betrieb', () => {
  let t: ReturnType<typeof aufbau>;
  beforeEach(async () => {
    t = aufbau(); gesendet(t.gmail);
    await t.dienst.starten(); t.dienst.stoppen();
    await scharf(t);
    for (const f of FAELLE) t.gmail.hinzufuegen(structuredClone(f.mail));
    await t.dienst.tick();
  });

  it('keine Rechnung und keine private Mail im Papierkorb oder archiviert', () => {
    for (const f of FAELLE.filter((x) => x.niePapierkorb)) {
      expect(t.gmail.get(f.mail.id).labelIds, f.name).toEqual(f.mail.labelIds);
    }
  });

  it('Spam und Phishing liegen im Papierkorb, Werbung ist archiviert, beschriftet und gelesen', () => {
    for (const f of FAELLE.filter((x) => x.erwartet === 'spam' || x.erwartet === 'phishing')) {
      if (f.niePapierkorb) continue;
      expect(t.gmail.get(f.mail.id).labelIds, f.name).toContain('TRASH');
    }
    const w = t.gmail.get(fall('Shop-Werbung').id).labelIds;
    expect(w).not.toContain('INBOX'); expect(w).not.toContain('UNREAD');
    const label = t.gmail.labelListe.find((l) => l.name === 'Aufräumer/Werbung')!;
    expect(w).toContain(label.id);
  });

  it('unsichere Werbung wartet in „Zu prüfen“ und bleibt unverändert', () => {
    const m = fall('Werbung ohne Header');
    expect(t.gmail.get(m.id).labelIds).toEqual(m.labelIds);
    expect(t.db.zuPruefen().map((p) => p.mailId)).toContain(m.id);
  });

  it('Rückgängig stellt Labels, Ordner und gelesen-Status exakt wieder her', async () => {
    for (const name of ['Shop-Werbung', 'Gmail-Spam Potenzmittel', 'PayPal gefälscht', 'Tech-Newsletter']) {
      const orig = fall(name);
      const e = t.db.protokoll({ limit: 1000 }).find((x) => x.mailId === orig.id)!;
      expect(t.gmail.get(orig.id).labelIds).not.toEqual(orig.labelIds);
      expect((await t.dienst.rueckgaengig(e.id)).ok).toBe(true);
      expect(new Set(t.gmail.get(orig.id).labelIds), name).toEqual(new Set(orig.labelIds));
      expect((await t.dienst.rueckgaengig(e.id)).ok).toBe(false); // nur einmal
    }
  });

  it('ganzen Durchlauf rückgängig machen', async () => {
    const lauf = t.db.protokoll({ limit: 1 })[0].durchlauf;
    const r = await t.dienst.durchlaufRueckgaengig(lauf);
    expect(r.ok).toBeGreaterThan(10); expect(r.fehler).toBe(0);
    for (const f of FAELLE) expect(new Set(t.gmail.get(f.mail.id).labelIds), f.name).toEqual(new Set(f.mail.labelIds));
  });

  it('nach 30 Tagen kein Rückgängig mehr', async () => {
    const e = t.db.protokoll({ limit: 1000 }).find((x) => x.aktionen.includes('papierkorb'))!;
    t.vor(31 * TAG);
    expect((await t.dienst.rueckgaengig(e.id)).ok).toBe(false);
  });
});

describe('Hintergrunddienst', () => {
  it('neue Mail wird beim nächsten Durchlauf (≤ 60 s) eingeordnet und gemeldet', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen();
    const gemeldet: any[] = []; t.dienst.on('aktion', (e) => gemeldet.push(e));
    t.gmail.hinzufuegen(fall('Gmail-Spam Krypto'));
    expect(t.db.einstellungen().intervallSek).toBe(5);
    await t.dienst.tick();
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]).toMatchObject({ kategorie: 'spam', trocken: true });
    await t.dienst.tick(); // nichts doppelt
    expect(gemeldet).toHaveLength(1);
  });

  it('verpasste Mails werden beim Start nachgeholt', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen();
    t.gmail.hinzufuegen(fall('Substack')); t.gmail.hinzufuegen(fall('DHL echt'));
    const t2 = new Aufraeumer({ gmail: t.gmail, db: t.db, jetzt: () => t.uhr() }); // „Neustart“
    await t2.starten(); t2.stoppen();
    expect(t.db.protokoll().length).toBe(2);
  });

  it('historyId zu alt (404) → letzte 14 Tage neu durchsuchen', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen();
    t.gmail.hinzufuegen(fall('Shop-Werbung'));
    t.gmail.historyZuAlt = true;
    await t.dienst.tick();
    expect(t.gmail.aufrufe.some((a) => a.startsWith('liste:newer_than:14d'))).toBe(true);
    expect(t.db.protokoll().length).toBe(1);
    expect(t.dienst.status).toBe('trockenlauf');
  });

  it('Kontakte aus „Gesendet“ schützen deren Mails', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen();
    expect(t.db.istKontakt('mama.thirolf@web.de')).toBe(true);
    expect(t.db.istKontakt('dennis.k@gmail.com')).toBe(true);
    expect(t.db.istKontakt('tiry@gmail.com')).toBe(false);
  });

  it('Quoten-Zähler und Backoff bei 429', async () => {
    let versuche = 0; const log: string[] = [];
    const r = await mitBackoff(async () => { if (++versuche < 3) throw { code: 429 }; return 'ok'; }, { warte: async () => {}, log: (s) => log.push(s) });
    expect(r).toBe('ok'); expect(versuche).toBe(3); expect(log).toHaveLength(2);
    await expect(mitBackoff(async () => { throw { code: 400 }; }, { warte: async () => {} })).rejects.toMatchObject({ code: 400 });
    const db = new Speicher(); db.quoteZaehlen('messages.get', 5); db.quoteZaehlen('messages.get', 5);
    expect(db.quoteHeute()).toMatchObject({ einheiten: 10, aufrufe: 2 });
  });
});

describe('Zu prüfen, Lernen und Gmail-Filter', () => {
  it('„Weg damit“ trainiert eine Regel; nach 3 Bestätigungen Filter – erst nach Zustimmung', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    const fragen: any[] = []; t.dienst.on('frage', (f) => fragen.push(f));
    for (let i = 0; i < 3; i++) {
      const m: Mail = { ...fall('Werbung ohne Header'), id: `weko${i}` };
      t.gmail.hinzufuegen(m); await t.dienst.tick();
      expect(t.db.zuPruefen().map((p) => p.mailId)).toContain(m.id);
      const r = await t.dienst.entscheide(m.id, 'weg');
      expect(r.regel.bestaetigt).toBe(i + 1);
      expect(t.gmail.get(m.id).labelIds).not.toContain('INBOX');
      if (i < 2) t.db.regelSchalten(r.regel.id, true);
      // ab der 2. Mail greift die gelernte Regel (86 % ≥ Schwelle) – trotzdem wird hier jede Mail einzeln bestätigt
      if (i === 0) { t.db.speichereEinstellungen({ schwelle: 99 }); }
    }
    expect(t.gmail.filter).toHaveLength(0);           // ohne Zustimmung kein Filter
    expect(fragen.length).toBeGreaterThan(0);
    t.db.speichereEinstellungen({ filterExportFreigegeben: true });
    const r = await t.dienst.filterExport();
    expect(r.angelegt).toBe(1);
    const f = t.gmail.filter[0];
    expect(f.criteria.from).toBe('werbung@weko.de');
    expect(f.criteria.negatedQuery).toContain('Rechnung');
    expect(f.action.removeLabelIds).toContain('INBOX');
    expect(t.db.regeln().find((x) => x.wert === 'werbung@weko.de')!.gmailFilterId).toBe(f.id);
    // Regel ausschalten löscht den Gmail-Filter
    await t.dienst.regelSchalten(t.db.regeln()[0].id, false);
    expect(t.gmail.filter).toHaveLength(0);
  });

  it('„Behalten“ lernt eine Behalten-Regel, Mail bleibt unverändert', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    const m = fall('Werbung ohne Header'); t.gmail.hinzufuegen(m); await t.dienst.tick();
    const r = await t.dienst.entscheide(m.id, 'behalten');
    expect(r.regel).toMatchObject({ art: 'gelernt', kategorie: 'persoenlich' });
    expect(t.gmail.get(m.id).labelIds).toEqual(m.labelIds);
    expect(t.db.zuPruefen()).toHaveLength(0);
  });

  it('im Trockenlauf werden keine Gmail-Filter angelegt', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen();
    t.db.speichereEinstellungen({ filterExportFreigegeben: true });
    await t.dienst.absenderAktion('deals@x.de', 'immer_weg');
    expect(t.gmail.filter).toHaveLength(0);
  });

  it('Papierkorb-Filter: Mails, die Gmail selbst weggeräumt hat, erscheinen im Protokoll und sind rückgängig machbar', async () => {
    const t = aufbau(); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    t.db.speichereEinstellungen({ filterExportFreigegeben: true });
    await t.dienst.absenderAktion('win@bitprofit.top', 'immer_weg');
    t.db.speichereEinstellungen({ aktionen: { ...t.db.einstellungen().aktionen, werbung: ['papierkorb'] } });
    const m = fall('Gmail-Spam Krypto'); m.labelIds = ['TRASH', 'UNREAD']; t.gmail.hinzufuegen(m);
    await t.dienst.tick();
    const e = t.db.protokoll()[0];
    expect(e.begruendung).toMatch(/Gmail-Filter/);
    expect((await t.dienst.rueckgaengig(e.id)).ok).toBe(true);
    expect(t.gmail.get(m.id).labelIds).toContain('INBOX');
  });
});

describe('Altbestand', () => {
  it('Vorschau zählt, Lauf nutzt batchModify und lässt Geschütztes in Ruhe', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    for (const f of FAELLE) t.gmail.hinzufuegen(structuredClone(f.mail), false);
    const v = await t.dienst.altbestandVorschau();
    expect(v.phase).toBe('bereit');
    expect(v.gesamt).toBe(FAELLE.length); // ganzes Postfach, nicht nur der Posteingang
    expect(v.ziele.papierkorb).toBeGreaterThan(0);
    expect(v.freiBytes).toBeGreaterThan(0);
    expect(v.zaehler.werbung).toBeGreaterThan(0);
    expect(t.gmail.aufrufe.some((a) => /modify|trash/.test(a))).toBe(false); // Vorschau ändert nichts
    await t.dienst.altbestandStarten();
    expect(t.gmail.aufrufe.some((a) => a.startsWith('batchModify'))).toBe(true);
    for (const f of FAELLE.filter((x) => x.niePapierkorb)) expect(t.gmail.get(f.mail.id).labelIds, f.name).toEqual(f.mail.labelIds);
    expect(t.posts).toHaveLength(0); // kein rückwirkendes Massen-Abmelden
    // Platz schaffen: alte Werbung und Newsletter liegen im Papierkorb, nicht nur im Archiv
    expect(t.gmail.get(fall('Shop-Werbung').id).labelIds).toContain('TRASH');
    expect(t.gmail.get(fall('Tech-Newsletter').id).labelIds).toContain('TRASH');
    expect(t.dienst.altbestand.geschafft!.papierkorb).toBeGreaterThan(0);
  });

  it('auch schon archivierte Mails werden gefunden; ohne „Platz schaffen“ kommt Werbung nur ins Archiv', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    t.db.speichereEinstellungen({ altPlatzSchaffen: false });
    const alt = fall('Shop-Werbung'); alt.labelIds = alt.labelIds.filter((l) => l !== 'INBOX'); // liegt schon im Archiv
    const neu = fall('Elektronik-Werbung');
    t.gmail.hinzufuegen(alt, false); t.gmail.hinzufuegen(neu, false);
    const v = await t.dienst.altbestandVorschau();
    expect(v.gesamt).toBe(2);
    await t.dienst.altbestandStarten();
    expect(t.gmail.get(neu.id).labelIds).not.toContain('INBOX');
    expect(t.gmail.get(neu.id).labelIds).not.toContain('TRASH');
  });
});

describe('Abmelden (Sicherheitsregel 4)', () => {
  const gmail = new FakeGmail();
  it('One-Click-POST nach RFC 8058', async () => {
    const posts: any[] = [];
    const lu = parseListUnsubscribe('<https://x.de/u/1>, <mailto:u@x.de>', 'List-Unsubscribe=One-Click');
    const r = await abmelden(lu, { gmail, eigeneAdresse: 'tiry@gmail.com', phishing: false, post: async (url, body) => { posts.push({ url, body }); return { status: 200 }; } });
    expect(r).toMatchObject({ ok: true, weg: 'one-click' });
    expect(posts[0]).toEqual({ url: 'https://x.de/u/1', body: 'List-Unsubscribe=One-Click' });
  });
  it('mailto als Rückfall', async () => {
    const lu = parseListUnsubscribe('<mailto:abmelden@verein.de?subject=Abmelden%20bitte>', undefined);
    const r = await abmelden(lu, { gmail, eigeneAdresse: 'tiry@gmail.com', phishing: false });
    expect(r).toMatchObject({ ok: true, weg: 'mailto', ziel: 'abmelden@verein.de' });
    expect(gmail.gesendet[0]).toMatch(/To: abmelden@verein.de/);
    expect(gmail.gesendet[0]).toMatch(/Subject: Abmelden bitte/);
  });
  it('reiner Link ohne One-Click wird NICHT geöffnet, http:// wird ignoriert', async () => {
    let aufgerufen = false;
    const post = async () => { aufgerufen = true; return { status: 200 }; };
    expect(await abmelden(parseListUnsubscribe('<https://x.de/u>', undefined), { gmail, eigeneAdresse: 'a@b.de', phishing: false, post })).toMatchObject({ ok: false });
    expect(parseListUnsubscribe('<http://x.de/u>', 'List-Unsubscribe=One-Click')).toBeNull();
    expect(aufgerufen).toBe(false);
  });
  it('bei Phishing nie', async () => {
    const lu = parseListUnsubscribe('<https://x.de/u>', 'List-Unsubscribe=One-Click');
    expect(await abmelden(lu, { gmail, eigeneAdresse: 'a@b.de', phishing: true })).toMatchObject({ ok: false });
  });
  it('mailto mit Header-Injection wird abgewiesen', () => {
    expect(baueMailtoNachricht('mailto:a@b.de%0ABcc:x@y.de', 'me@x.de')).toBeNull();
  });
});

describe('Quote: Drossel und Kontakte-Reihenfolge', () => {
  it('Drossel hält die Einheiten pro Sekunde ein und nutzt Retry-After', async () => {
    const { Drossel, retryAfterMs } = await import('../src/core/gmail');
    let uhr = 0; const gewartet: number[] = [];
    const d = new Drossel(50, 250, () => uhr, async (ms) => { gewartet.push(ms); uhr += ms; });
    for (let i = 0; i < 250; i++) await d.nimm(5); // 1250 Einheiten
    // 250 aus dem Eimer sofort, 1000 weitere bei 50/s → ≈ 20 s
    expect(uhr).toBeGreaterThanOrEqual(19_900);
    expect(uhr).toBeLessThanOrEqual(20_200);
    expect(retryAfterMs({ response: { headers: { 'retry-after': '30' } } })).toBe(30_000);
    expect(retryAfterMs({})).toBeNull();
  });

  it('Backoff wartet bei Minuten-Sperre mindestens so lange wie Google verlangt', async () => {
    let versuche = 0; const wartezeiten: number[] = [];
    const r = await mitBackoff(async () => { if (++versuche < 3) throw { code: 429, response: { headers: { 'retry-after': '45' } } }; return 'ok'; },
      { warte: async (ms) => { wartezeiten.push(ms); } });
    expect(r).toBe('ok');
    expect(Math.min(...wartezeiten)).toBeGreaterThanOrEqual(45_000);
  });

  it('schlägt das Laden der Kontakte fehl, wird keine Mail eingeordnet', async () => {
    const t = aufbau(); gesendet(t.gmail);
    await t.dienst.starten(); t.dienst.stoppen();
    t.db.set('kontakteStand', 0); // Kontakte veraltet
    const echteListe = t.gmail.liste.bind(t.gmail);
    t.gmail.liste = async (q: string, ...rest: any[]) => { if (q.includes('in:sent')) throw { code: 429 }; return (echteListe as any)(q, ...rest); };
    t.gmail.hinzufuegen(fall('Mama (Kontakt)'));
    await t.dienst.tick();
    expect(t.dienst.status).toBe('fehler');
    expect(t.db.protokoll()).toHaveLength(0);
    t.gmail.liste = echteListe as any; // Google wieder erreichbar
    await t.dienst.tick();
    expect(t.db.protokoll()[0]).toMatchObject({ status: 'geschuetzt' });
  });
});


describe('Ordner für Vielschreiber', () => {
  const amazon = (i: number, betreff: string, extra: Partial<Mail> = {}): Mail => ({
    id: `amz${i}`, threadId: `amz${i}`, labelIds: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'], snippet: '', internalDate: Date.UTC(2026, 10, 1, 8, i),
    headers: { from: `Amazon.de <${i % 2 ? 'bestellbestaetigung' : 'versandbestaetigung'}@amazon.de>`, subject: betreff, 'authentication-results': 'dkim=pass; spf=pass; dmarc=pass' }, ...extra,
  });

  it('ab 5 Mails einer Firma: eigener Ordner – auch Bestellungen kommen hinein, nichts wird gelöscht, alles zurückholbar', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    for (let i = 0; i < 4; i++) t.gmail.hinzufuegen(amazon(i, `Versand ${i}`));
    await t.dienst.tick();
    expect(t.gmail.labelListe.find((l) => l.name === 'Amazon')).toBeUndefined(); // erst 4 Mails
    const bestellung = amazon(9, 'Ihre Bestellung #302-9 wurde versandt');
    t.gmail.hinzufuegen(bestellung);
    await t.dienst.tick();
    const ordner = t.gmail.labelListe.find((l) => l.name === 'Amazon')!;
    expect(ordner).toBeDefined();
    const jetzt = t.gmail.get(bestellung.id).labelIds;
    expect(jetzt).toContain(ordner.id);
    expect(jetzt).not.toContain('INBOX');
    expect(jetzt).not.toContain('TRASH');
    const e = t.db.protokoll().find((x) => x.mailId === bestellung.id)!;
    expect(e.begruendung).toMatch(/Ordner „Amazon“/);
    expect((await t.dienst.rueckgaengig(e.id)).ok).toBe(true);
    expect(new Set(t.gmail.get(bestellung.id).labelIds)).toEqual(new Set(bestellung.labelIds));
  });

  it('nie für Privatadressen, Kontakte, Stern oder Spam', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    const privat = (i: number): Mail => ({ id: `p${i}`, threadId: `p${i}`, labelIds: ['INBOX'], snippet: '', internalDate: i,
      headers: { from: `Freund ${i} <freund${i}@gmail.com>`, subject: 'Hi', 'authentication-results': 'dkim=pass' } });
    for (let i = 0; i < 6; i++) t.gmail.hinzufuegen(privat(i));
    for (let i = 0; i < 6; i++) t.gmail.hinzufuegen({ ...fall('Mama (Kontakt)'), id: `mama${i}` });
    for (let i = 0; i < 6; i++) t.gmail.hinzufuegen({ ...amazon(20 + i, 'Angebot', { labelIds: ['INBOX', 'STARRED'] }) });
    await t.dienst.tick();
    for (let i = 0; i < 6; i++) {
      expect(t.gmail.get(`p${i}`).labelIds).toEqual(['INBOX']);
      expect(t.gmail.get(`mama${i}`).labelIds).toEqual(fall('Mama (Kontakt)').labelIds);
      expect(t.gmail.get(`amz${20 + i}`).labelIds).toEqual(['INBOX', 'STARRED']);
    }
    expect(t.gmail.labelListe.some((l) => ['Gmail', 'Example', 'Freund'].includes(l.name))).toBe(false);
  });

  it('Altbestand: Vorschau zählt Firmen und zeigt die Ordner, Start sortiert sie ein', async () => {
    const t = aufbau(); gesendet(t.gmail); await t.dienst.starten(); t.dienst.stoppen(); await scharf(t);
    for (let i = 0; i < 7; i++) t.gmail.hinzufuegen(amazon(30 + i, i === 0 ? 'Ihre Rechnung' : `Versand ${i}`), false);
    const v = await t.dienst.altbestandVorschau();
    expect(v.ordner).toEqual([{ name: 'Amazon', anzahl: 7 }]);
    expect(v.ziele.ordner).toBe(7);
    await t.dienst.altbestandStarten();
    const id = t.gmail.labelListe.find((l) => l.name === 'Amazon')!.id;
    for (let i = 0; i < 7; i++) expect(t.gmail.get(`amz${30 + i}`).labelIds).toEqual(expect.arrayContaining([id]));
    expect(t.gmail.get('amz30').labelIds).not.toContain('INBOX'); // auch die Rechnung liegt im Ordner
  });
});
