// Hintergrunddienst: neue Mails über history.list, Nachholen, Altbestand, Lernen, Gmail-Filter-Export.
import { EventEmitter } from 'node:events';
import type { Aktion, Entscheidung, Kategorie, Mail, Regel, Signale } from './types';
import { KATEGORIE_NAME, KATEGORIEN } from './types';
import type { GmailPort } from './gmail';
import { HistoryZuAlt } from './gmail';
import type { Speicher } from './db';
import { Ausfuehrer, planeAktionen, LABEL_PREFIX, type Plan } from './actions';
import { ordneEin, beschreibeBedingung, type KiPort } from './pipeline';
import { parseAdressListe } from './headers';
import { abmelden, type HttpPost } from './unsubscribe';
import { kiBudget } from './ai';
import { standardEinstellungen, trockenlaufRestTage } from './settings';
import { ordnerBasis, ordnerName } from './ordner';
import { standNachricht, zielVon, fachVon, type Stand } from './stand';
import type { Schutz } from './types';

export type DienstStatus = 'nicht_angemeldet' | 'startet' | 'trockenlauf' | 'laeuft' | 'fehler' | 'angehalten';

const NACHHOL_TAGE = 14;
const KONTAKTE_ALLE_MS = 24 * 3600_000;
const MUELL: Kategorie[] = ['werbung', 'newsletter', 'spam', 'phishing', 'benachrichtigung'];

export interface DienstOptionen {
  gmail: GmailPort;
  db: Speicher;
  ki?: KiPort | null;
  post?: HttpPost;
  jetzt?: () => number;
}

export class Aufraeumer extends EventEmitter {
  readonly db: Speicher;
  private gmail: GmailPort;
  private ki: KiPort | null;
  private aus: Ausfuehrer;
  private post?: HttpPost;
  private timer: NodeJS.Timeout | null = null;
  private laeuftGerade = false;
  private jetzt: () => number;
  status: DienstStatus = 'startet';
  fehler: string | null = null;
  letzterLauf: number | null = null;
  email = '';
  altbestand: {
    phase: 'leer' | 'vorschau' | 'bereit' | 'laeuft' | 'fertig'; gesamt: number; erledigt: number; zaehler: Partial<Record<Kategorie, number>>;
    durchlauf: string | null; beispiele: Array<{ absender: string; betreff: string; kategorie: Kategorie }>;
    ziele: { papierkorb: number; archiv: number; bleibt: number; pruefen: number; ordner: number }; freiBytes: number;
    ordner: Array<{ name: string; anzahl: number }>;
    geschafft?: { papierkorb: number; archiv: number; ordner: number; freiBytes: number };
  } = { phase: 'leer', gesamt: 0, erledigt: 0, zaehler: {}, durchlauf: null, beispiele: [], ziele: { papierkorb: 0, archiv: 0, bleibt: 0, pruefen: 0, ordner: 0 }, freiBytes: 0, ordner: [] };
  private altIds: string[] = [];
  /** Mails je Firma aus der Altbestand-Vorschau – damit schon beim ersten Aufräumen Ordner entstehen. */
  private altZaehler = new Map<string, number>();

  constructor(o: DienstOptionen) {
    super();
    this.gmail = o.gmail; this.db = o.db; this.ki = o.ki ?? null; this.post = o.post;
    this.jetzt = o.jetzt ?? Date.now;
    if (!this.db.get('einstellungen', null)) this.db.set('einstellungen', standardEinstellungen(this.jetzt()));
    // Tiry's Mails ist live: alte Standard-Einstellung (60 s) einmalig auf 5 s umstellen
    if (!this.db.get('migrationLive', false)) {
      if (this.db.einstellungen().intervallSek === 60) this.db.speichereEinstellungen({ intervallSek: 5 });
      this.db.set('migrationLive', true);
    }
    this.aus = new Ausfuehrer(this.gmail, this.db, { eigeneAdresse: () => this.email, post: this.post, log: (s) => this.log(s) });
  }

  log(s: string) { this.emit('log', `${new Date(this.jetzt()).toISOString()} ${s}`); }
  private setStatus(s: DienstStatus, fehler: string | null = null) {
    this.status = s; this.fehler = fehler; this.emit('status', this.statusInfo());
  }
  statusInfo() {
    const e = this.db.einstellungen();
    return { status: this.status, fehler: this.fehler, letzterLauf: this.letzterLauf, email: this.email, trockenlauf: e.trockenlauf,
      trockenlaufRestTage: trockenlaufRestTage(e, this.jetzt()), intervallSek: e.intervallSek, quote: this.db.quoteHeute() };
  }

  // ---------------- Start / Schleife ----------------
  async starten() {
    this.setStatus('startet');
    try {
      const p = await this.gmail.profil();
      this.email = p.email;
      if (!this.db.get<string | null>('historyId', null)) this.db.set('historyId', p.historyId);
      await this.tick(); // holt zuerst die Kontakte, dann verpasste Mails
    } catch (err) {
      this.setStatus('fehler', (err as Error).message);
    }
    this.planeNaechsten();
  }

  stoppen() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.setStatus('angehalten'); }

  private planeNaechsten() {
    if (this.timer) clearTimeout(this.timer);
    const sek = Math.max(3, this.db.einstellungen().intervallSek);
    this.timer = setTimeout(async () => { await this.tick(); this.planeNaechsten(); }, sek * 1000);
    this.timer.unref?.();
  }

  /** Sofort prüfen (z. B. nach Änderung des Intervalls). */
  neuPlanen() { if (this.timer) this.planeNaechsten(); }

  /** Ein Durchgang: neue Mails seit der gespeicherten historyId einordnen. */
  async tick(): Promise<number> {
    if (this.laeuftGerade) return 0;
    this.laeuftGerade = true;
    const durchlauf = `lauf-${new Date(this.jetzt()).toISOString()}`;
    let anzahl = 0;
    try {
      // Sicherheitsregel 3: ohne aktuelle Kontaktliste wird nichts eingeordnet
      if (this.jetzt() - this.db.get<number>('kontakteStand', 0) > KONTAKTE_ALLE_MS) await this.kontakteAktualisieren();
      let start = this.db.get<string | null>('historyId', null);
      if (!start) { start = (await this.gmail.profil()).historyId; this.db.set('historyId', start); }
      let ids: string[] = [];
      try {
        let token: string | undefined; let neueHistory = start; let geaendert = false;
        do {
          const r = await this.gmail.history(start, token);
          ids.push(...r.neueIds); neueHistory = r.historyId; token = r.nextPageToken; geaendert ||= !!r.geaendert;
        } while (token);
        if (geaendert) this.emit('postfach', { neu: ids.length });
        anzahl = await this.verarbeiteIds(ids, durchlauf);
        this.db.set('historyId', neueHistory);
      } catch (err) {
        if (!(err instanceof HistoryZuAlt)) throw err;
        this.log(`historyId zu alt – durchsuche die letzten ${NACHHOL_TAGE} Tage neu.`);
        const profil = await this.gmail.profil();
        ids = await this.alleIds(`newer_than:${NACHHOL_TAGE}d -in:sent -in:drafts -in:chats`);
        anzahl = await this.verarbeiteIds(ids, durchlauf);
        this.db.set('historyId', profil.historyId);
      }
      this.letzterLauf = this.jetzt();
      this.setStatus(this.db.einstellungen().trockenlauf ? 'trockenlauf' : 'laeuft');
      // Alle 2 Minuten: Stand für die Handy-App in Gmail ablegen
      if (this.jetzt() - this.db.get<number>('standZeit', 0) > 2 * 60_000) { this.db.set('standZeit', this.jetzt()); void this.standSchreiben().catch((e) => this.log(`Stand fürs Handy: ${(e as Error).message}`)); }
      // Alle 30 Minuten: neue Gmail-Filter nachtragen, damit Google auch ohne PC aufräumt (einmal fragen, danach still)
      const einst = this.db.einstellungen();
      if (!einst.trockenlauf && this.jetzt() - this.db.get<number>('filterStand', 0) > 30 * 60_000) {
        this.db.set('filterStand', this.jetzt());
        if (einst.filterExportFreigegeben || !this.db.get<boolean>('filterGefragt', false)) {
          if (!einst.filterExportFreigegeben) this.db.set('filterGefragt', true);
          void this.filterExport().catch(() => {});
        }
      }
    } catch (err) {
      this.log(`Fehler im Durchlauf: ${(err as Error).message}`);
      this.setStatus('fehler', (err as Error).message);
    } finally {
      this.laeuftGerade = false;
    }
    return anzahl;
  }

  private async alleIds(q: string, grenze = 100_000): Promise<string[]> {
    const ids: string[] = []; let token: string | undefined;
    do { const r = await this.gmail.liste(q, token, 500); ids.push(...r.ids); token = r.nextPageToken; } while (token && ids.length < grenze);
    return ids;
  }

  private async verarbeiteIds(ids: string[], durchlauf: string): Promise<number> {
    const offen = [...new Set(ids)].filter((id) => !this.db.istVerarbeitet(id));
    let n = 0;
    for (let i = 0; i < offen.length; i += 50) {
      const mails = await this.gmail.holeMetadaten(offen.slice(i, i + 50));
      for (const m of mails) { if (await this.verarbeite(m, durchlauf)) n++; }
    }
    return n;
  }

  /** Kernablauf für eine Mail. true = eingeordnet. */
  async verarbeite(mail: Mail, durchlauf: string): Promise<boolean> {
    if (this.db.istVerarbeitet(mail.id)) return false;
    const lbl = new Set(mail.labelIds);
    if (lbl.has('SENT') || lbl.has('DRAFT') || lbl.has('CHAT')) { this.db.markiereVerarbeitet(mail.id, this.jetzt()); return false; }

    // Schon von einem exportierten Gmail-Filter in den Papierkorb gelegt (lief auf Googles Servern)
    if (lbl.has('TRASH')) {
      this.verbucheGmailFilter(mail, durchlauf);
      this.db.markiereVerarbeitet(mail.id, this.jetzt());
      return false;
    }

    const e = this.db.einstellungen();
    const budget = kiBudget(() => this.db.get('kiVerbrauch', { ausgegebenUsd: 0, monat: '' }), (v) => this.db.set('kiVerbrauch', v),
      () => this.db.einstellungen().kiBudgetEuro, () => this.db.einstellungen().kiUsdProEuro);
    const { signale: s, schutz, entscheidung } = await ordneEin(mail, {
      einstellungen: e, regeln: this.db.regeln(), ki: this.ki, kiBudget: budget,
      istKontakt: (a) => this.db.istKontakt(a), historie: (a) => this.db.absenderHistorie(a),
    });
    const zeit = this.jetzt();
    if (s.absender) {
      this.db.absenderZaehlen({ adresse: s.absender, domain: s.domain, name: s.anzeigename || s.absender, gelesen: !lbl.has('UNREAD'),
        zeit: mail.internalDate || zeit, kategorie: entscheidung.kategorie, listUnsub: s.listUnsubscribe ? JSON.stringify(s.listUnsubscribe) : null });
    }

    let id: number;
    const ordner = this.ordnerFuer(mail, s, schutz, entscheidung);
    if (ordner && (schutz.geschuetzt || !this.plan(mail, s, entscheidung).papierkorb)) {
      // Firmen-Ordner: auch Bestellungen/Rechnungen (Tirys Wunsch) – nur verschieben, nie löschen
      const plan = this.mitOrdner(schutz.geschuetzt ? null : this.plan(mail, s, entscheidung), mail, ordner.name);
      const grund = `${entscheidung.begruendung} Kommt in den Ordner „${ordner.name}“ (${ordner.anzahl} Mails von dieser Firma).`;
      id = await this.aus.ausfuehren(mail, s, { ...entscheidung, begruendung: grund }, plan, { durchlauf, trocken: e.trockenlauf, zeit });
    } else if (schutz.geschuetzt) {
      id = this.db.protokolliere({ zeit, durchlauf, mailId: mail.id, absender: s.absender, betreff: s.betreff, kategorie: entscheidung.kategorie,
        sicherheit: 100, stufe: 'schutz', begruendung: entscheidung.begruendung, aktionen: ['behalten'], trocken: e.trockenlauf,
        vorherLabels: mail.labelIds, nachherLabels: mail.labelIds, status: 'geschuetzt', hinweis: null });
    } else {
      const plan = this.plan(mail, s, entscheidung);
      const nurBehalten = plan.aktionen.length === 1 && plan.aktionen[0] === 'behalten';
      if (!nurBehalten && entscheidung.sicherheit < e.schwelle) {
        this.db.zuPruefenMerken({ mailId: mail.id, zeit, absender: s.absender, name: s.anzeigename, betreff: s.betreff, snippet: mail.snippet,
          kategorie: entscheidung.kategorie, sicherheit: entscheidung.sicherheit, begruendung: entscheidung.begruendung });
        id = this.db.protokolliere({ zeit, durchlauf, mailId: mail.id, absender: s.absender, betreff: s.betreff, kategorie: entscheidung.kategorie,
          sicherheit: entscheidung.sicherheit, stufe: entscheidung.stufe, begruendung: entscheidung.begruendung, aktionen: ['behalten'],
          trocken: e.trockenlauf, vorherLabels: mail.labelIds, nachherLabels: mail.labelIds, status: 'zu_pruefen',
          hinweis: `Sicherheit ${Math.round(entscheidung.sicherheit)} % liegt unter der Schwelle ${e.schwelle} % – wartet auf Tiry.` });
      } else {
        id = await this.aus.ausfuehren(mail, s, entscheidung, plan, { durchlauf, trocken: e.trockenlauf, zeit });
      }
    }
    this.db.markiereVerarbeitet(mail.id, zeit);
    this.emit('aktion', this.db.eintrag(id));
    return true;
  }

  // ---------------- Ordner für Vielschreiber ----------------
  /** Kommt diese Mail grundsätzlich für einen Firmen-Ordner in Frage (ohne Mengen-Schwelle)? */
  ordnerKandidat(mail: Mail, s: Signale, schutz: Schutz, e: Entscheidung): { basis: string; name: string } | null {
    if (!this.db.einstellungen().ordnerAn) return null;
    if (e.kategorie === 'spam' || e.kategorie === 'phishing' || s.phishingMerkmale.length) return null;
    if (mail.labelIds.includes('STARRED') || (s.absender && this.db.istKontakt(s.absender))) return null;
    if (schutz.geschuetzt && !String(schutz.grund ?? '').startsWith('Schutzwort')) return null; // Weiße Liste, Stern, Kontakt: nie
    const basis = ordnerBasis(s.domain);
    if (!basis || this.db.get<string[]>('ordnerAus', []).includes(basis)) return null;
    return { basis, name: ordnerName(basis) };
  }

  /** Mails je Firma (Datenbank + Altbestand-Vorschau). */
  private firmenAnzahl(): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of this.db.domainAnzahlen()) { const b = ordnerBasis(r.domain); if (b) m.set(b, (m.get(b) ?? 0) + r.anzahl); }
    for (const [b, n] of this.altZaehler) m.set(b, Math.max(m.get(b) ?? 0, n));
    return m;
  }

  ordnerFuer(mail: Mail, s: Signale, schutz: Schutz, e: Entscheidung, anzahl = this.firmenAnzahl()): { basis: string; name: string; anzahl: number } | null {
    const k = this.ordnerKandidat(mail, s, schutz, e);
    if (!k) return null;
    const n = anzahl.get(k.basis) ?? 0;
    return n >= this.db.einstellungen().ordnerAb ? { ...k, anzahl: n } : null;
  }

  /** Plan „in den Ordner verschieben“: Ordner-Etikett statt Sorten-Etikett, raus aus dem Posteingang. */
  private mitOrdner(plan: Plan | null, mail: Mail, name: string): Plan {
    const p: Plan = { aktionen: ['label'], add: [name], remove: [], papierkorb: false, abmelden: !!plan?.abmelden };
    if (mail.labelIds.includes('INBOX')) { p.remove.push('INBOX'); p.aktionen.push('archivieren'); }
    if (plan?.remove.includes('UNREAD')) { p.remove.push('UNREAD'); p.aktionen.push('gelesen'); }
    if (p.abmelden) p.aktionen.push('abmelden');
    return p;
  }

  /** Alle Firmen-Ordner mit Mengen (für die Oberfläche). */
  ordnerListe(): Array<{ basis: string; name: string; anzahl: number; aktiv: boolean; ueberSchwelle: boolean }> {
    const aus = this.db.get<string[]>('ordnerAus', []); const ab = this.db.einstellungen().ordnerAb;
    return [...this.firmenAnzahl()].filter(([, n]) => n >= Math.min(ab, 3))
      .sort((a, b) => b[1] - a[1]).slice(0, 60)
      .map(([basis, anzahl]) => ({ basis, name: ordnerName(basis), anzahl, aktiv: !aus.includes(basis), ueberSchwelle: anzahl >= ab }));
  }
  ordnerSchalten(basis: string, aktiv: boolean) {
    const aus = new Set(this.db.get<string[]>('ordnerAus', []));
    if (aktiv) aus.delete(basis); else aus.add(basis);
    this.db.set('ordnerAus', [...aus]);
  }

  private plan(mail: Mail, s: Signale, e: Entscheidung): Plan {
    const einst = this.db.einstellungen();
    const h = s.absender ? this.db.absenderHistorie(s.absender) : null;
    // Automatisch abmelden nur, wenn Tiry die Mails dieses Absenders nie öffnet (mind. 3 Stück) oder er ihn auf die Schwarze Liste gesetzt hat.
    const schwarz = this.db.regeln().some((r) => r.art === 'schwarz' && r.aktiv && r.feld === 'adresse' && r.wert === s.absender);
    const abmeldenErlaubt = !this.db.istAbgemeldet(s.absender) && (schwarz || (!!h && h.anzahl >= 3 && h.gelesen === 0));
    return planeAktionen(e.kategorie, einst.aktionen[e.kategorie] ?? ['behalten'], mail, s, { abmeldenErlaubt });
  }

  private verbucheGmailFilter(mail: Mail, durchlauf: string) {
    const von = (mail.headers['from'] ?? '').toLowerCase();
    const regel = this.db.regeln().find((r) => r.gmailFilterId && von.includes(r.wert));
    if (!regel) return;
    const vorher = [...new Set([...mail.labelIds.filter((l) => l !== 'TRASH'), 'INBOX'])];
    const id = this.db.protokolliere({ zeit: this.jetzt(), durchlauf, mailId: mail.id, absender: von.match(/[^<\s]+@[^>\s]+/)?.[0] ?? von,
      betreff: mail.headers['subject'] ?? '', kategorie: regel.kategorie ?? 'werbung', sicherheit: 100, stufe: 'regeln',
      begruendung: `Gmail-Filter (läuft auf Googles Servern): ${beschreibeBedingung(regel)} → Papierkorb.`, aktionen: ['papierkorb'], trocken: false,
      vorherLabels: vorher, nachherLabels: mail.labelIds, status: 'ok', hinweis: 'Von Gmail selbst erledigt, während der PC aus war.' });
    this.emit('aktion', this.db.eintrag(id));
  }

  // ---------------- Kontakte (Sicherheitsregel 3) ----------------
  async kontakteAktualisieren(grenze = 1000) {
    const ids = await this.alleIds('in:sent', grenze);
    const adressen = new Set<string>();
    for (let i = 0; i < ids.length; i += 100) {
      for (const m of await this.gmail.holeMetadaten(ids.slice(i, i + 100))) {
        for (const k of ['to', 'cc', 'bcc']) for (const a of parseAdressListe(m.headers[k])) adressen.add(a.adresse);
      }
    }
    if (this.email) adressen.delete(this.email.toLowerCase());
    this.db.kontakteSetzen(adressen);
    this.db.set('kontakteStand', this.jetzt());
    this.log(`${adressen.size} Kontakte aus „Gesendet“ geschützt.`);
  }

  // ---------------- Zu prüfen: Entscheidungen trainieren Regeln ----------------
  async entscheide(mailId: string, wahl: 'behalten' | 'weg'): Promise<{ regel: Regel; eintrag: number | null }> {
    const offen = this.db.zuPruefen().find((p) => p.mailId === mailId);
    if (!offen) throw new Error('Mail ist nicht (mehr) in „Zu prüfen“.');
    const einst = this.db.einstellungen();
    let regel: Regel; let eintrag: number | null = null;
    if (wahl === 'behalten') {
      this.db.regelEntfernen('gelernt', 'adresse', offen.absender);
      regel = this.db.regelMerken('gelernt', 'adresse', offen.absender, 'persoenlich', this.jetzt());
      eintrag = this.db.protokolliere({ zeit: this.jetzt(), durchlauf: `entscheidung-${this.jetzt()}`, mailId, absender: offen.absender,
        betreff: offen.betreff, kategorie: 'persoenlich', sicherheit: 100, stufe: 'regeln', begruendung: `Tiry: behalten – gelernt für ${offen.absender}.`,
        aktionen: ['behalten'], trocken: einst.trockenlauf, vorherLabels: [], nachherLabels: [], status: 'ok', hinweis: null });
    } else {
      const ziel: Kategorie = MUELL.includes(offen.kategorie) ? offen.kategorie : 'werbung';
      regel = this.db.regelMerken('gelernt', 'adresse', offen.absender, ziel, this.jetzt());
      const [mail] = await this.gmail.holeMetadaten([mailId]);
      if (mail) {
        const { signale } = await ordneEin(mail, { einstellungen: { ...einst, kiAn: false }, regeln: [], istKontakt: () => false, historie: () => null });
        const e: Entscheidung = { kategorie: ziel, sicherheit: 100, stufe: 'regeln', begruendung: `Tiry: weg damit → ${KATEGORIE_NAME[ziel]}. Regel gelernt.`, regelId: regel.id };
        const plan = planeAktionen(ziel, einst.aktionen[ziel], mail, signale, { abmeldenErlaubt: false });
        if (plan.aktionen.length === 1 && plan.aktionen[0] === 'behalten') { plan.aktionen = ['archivieren']; plan.remove = mail.labelIds.includes('INBOX') ? ['INBOX'] : []; }
        eintrag = await this.aus.ausfuehren(mail, signale, e, plan, { durchlauf: `entscheidung-${this.jetzt()}`, trocken: einst.trockenlauf });
      }
    }
    this.db.pruefenErledigt(mailId, this.jetzt());
    if (eintrag) this.emit('aktion', this.db.eintrag(eintrag));
    await this.filterExport();
    return { regel, eintrag };
  }

  // ---------------- Absender-Aktionen ----------------
  async absenderAktion(adresse: string, aktion: 'immer_behalten' | 'immer_weg' | 'abmelden'): Promise<string> {
    adresse = adresse.toLowerCase();
    if (aktion === 'immer_behalten') {
      this.db.regelEntfernen('schwarz', 'adresse', adresse); this.db.regelEntfernen('gelernt', 'adresse', adresse);
      this.db.regelMerken('weiss', 'adresse', adresse, null, this.jetzt());
      return `${adresse} steht jetzt auf der Weißen Liste.`;
    }
    if (aktion === 'immer_weg') {
      this.db.regelEntfernen('weiss', 'adresse', adresse);
      const info = this.db.topAbsender(100000).find((a) => a.adresse === adresse);
      const kat = (info?.kategorie && MUELL.includes(info.kategorie as Kategorie) ? info.kategorie : 'werbung') as Kategorie;
      this.db.regelMerken('schwarz', 'adresse', adresse, kat, this.jetzt());
      await this.filterExport();
      return `Mails von ${adresse} → ${KATEGORIE_NAME[kat]} (Schwarze Liste).`;
    }
    // abmelden
    const info = this.db.topAbsender(100000).find((a) => a.adresse === adresse);
    if (info?.kategorie === 'phishing') return 'Phishing-Verdacht – Abmelden würde die Adresse bestätigen. Nicht abgemeldet.';
    const lu = this.db.absenderListUnsub(adresse);
    if (!lu) return 'Kein List-Unsubscribe-Header bekannt – Abmelden nicht möglich.';
    if (this.db.einstellungen().trockenlauf) return `Trockenlauf: würde ${adresse} über den Abmelde-Header abmelden.`;
    const r = await abmelden(JSON.parse(lu), { gmail: this.gmail, eigeneAdresse: this.email, phishing: false, post: this.post });
    if (!r.ok) return `Nicht abgemeldet: ${r.grund}`;
    this.db.absenderAbgemeldet(adresse, this.jetzt());
    this.db.protokolliere({ zeit: this.jetzt(), durchlauf: `abmelden-${this.jetzt()}`, mailId: '-', absender: adresse, betreff: '(Abmeldung)',
      kategorie: (info?.kategorie as Kategorie) ?? 'newsletter', sicherheit: 100, stufe: 'regeln', begruendung: `Tiry: abmelden über ${r.weg}.`,
      aktionen: ['abmelden'], trocken: false, vorherLabels: [], nachherLabels: [], status: 'ok', hinweis: 'Abmeldung lässt sich nicht rückgängig machen.' });
    return `Abgemeldet per ${r.weg} (${r.ziel}).`;
  }

  // ---------------- Gmail-Filter-Export ----------------
  /** Regeln, die eindeutig genug für einen echten Gmail-Filter sind. */
  filterKandidaten(): Regel[] {
    const e = this.db.einstellungen();
    return this.db.regeln().filter((r) => r.aktiv && r.kategorie && MUELL.includes(r.kategorie) && r.feld !== 'stichwort' &&
      (r.art === 'schwarz' || (r.art === 'gelernt' && r.bestaetigt >= e.filterExportAb)));
  }

  filterAktion(kat: Kategorie): { addLabelIds: string[]; removeLabelIds: string[] } | null {
    const akt = this.db.einstellungen().aktionen[kat] ?? [];
    if (akt.includes('papierkorb')) return { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] };
    const remove: string[] = [];
    if (akt.includes('archivieren')) remove.push('INBOX');
    if (akt.includes('gelesen')) remove.push('UNREAD');
    if (!remove.length && !akt.includes('label')) return null;
    return { addLabelIds: [], removeLabelIds: remove };
  }

  /** Legt fehlende Filter an. Erst nach Tirys Zustimmung und nie im Trockenlauf. */
  async filterExport(): Promise<{ angelegt: number; wartet: number; frage: boolean }> {
    const e = this.db.einstellungen();
    const offen = this.filterKandidaten().filter((r) => !r.gmailFilterId);
    const autoOffen = this.autoFilterPlan().filter((p) => !this.db.get<Record<string, string>>('autoFilter', {})[p.schluessel]).length;
    if (!offen.length && !autoOffen) return { angelegt: 0, wartet: 0, frage: false };
    if (e.trockenlauf) return { angelegt: 0, wartet: offen.length, frage: false };
    if (!e.filterExportFreigegeben) { this.emit('frage', { art: 'filter', anzahl: offen.length + autoOffen }); return { angelegt: 0, wartet: offen.length + autoOffen, frage: true }; }
    const negatedQuery = e.schutzwoerter.filter(Boolean).map((w) => (/\s/.test(w) ? `"${w}"` : w)).join(' OR ');
    let angelegt = 0;
    for (const r of offen) {
      const akt = this.filterAktion(r.kategorie!);
      if (!akt) continue;
      if (this.db.einstellungen().aktionen[r.kategorie!].includes('label')) akt.addLabelIds.push(await this.aus.labelId(`${LABEL_PREFIX}/${KATEGORIE_NAME[r.kategorie!]}`));
      try {
        const id = await this.gmail.filterAnlegen({ from: r.wert, negatedQuery }, akt);
        this.db.regelFilter(r.id, id); angelegt++;
        this.log(`Gmail-Filter angelegt: ${beschreibeBedingung(r)}.`);
      } catch (err) { this.log(`Gmail-Filter für ${r.wert} fehlgeschlagen: ${(err as Error).message}`); }
    }
    const auto = await this.autoFilterExport(negatedQuery);
    return { angelegt: angelegt + auto, wartet: offen.length - angelegt, frage: false };
  }

  /**
   * Damit auch bei ausgeschaltetem PC aufgeräumt wird: Gmail-Filter, die Google selbst rund um die Uhr ausführt –
   * für Absender, die der Aufräumer schon oft als Werbung/Newsletter einsortiert hat, und für die Firmen-Ordner (Amazon, DHL …).
   * Schutzwörter (Rechnung, Bestellung …) bleiben bei Werbung/Newsletter ausgenommen; Firmen-Ordner nehmen Bestellungen mit (Tirys Wunsch).
   * Nie für Kontakte, Weiße Liste oder Privat-Adressen.
   */
  autoFilterPlan(): Array<{ schluessel: string; von: string; kategorie?: Kategorie; ordner?: string }> {
    const e = this.db.einstellungen();
    const weiss = new Set(this.db.regeln().filter((r) => r.art === 'weiss' && r.aktiv).map((r) => r.wert));
    const schonRegel = new Set(this.db.regeln().filter((r) => r.art !== 'weiss').map((r) => r.wert)); // eigene Regeln haben eigene Filter
    const ordner = this.ordnerListe().filter((o) => o.aktiv && o.ueberSchwelle && e.ordnerAn);
    const ordnerBasen = new Set(ordner.map((o) => o.basis));
    const liste: Array<{ schluessel: string; von: string; kategorie?: Kategorie; ordner?: string }> = [];
    for (const o of ordner) if (!weiss.has(o.basis)) liste.push({ schluessel: `ordner:${o.basis}`, von: o.basis, ordner: o.name });
    for (const a of this.db.vielschreiberMuell(Math.max(3, e.filterExportAb))) {
      const dom = a.adresse.split('@')[1] ?? '';
      if (weiss.has(a.adresse) || weiss.has(dom) || schonRegel.has(a.adresse) || !ordnerBasis(dom) || [...ordnerBasen].some((b) => dom === b || dom.endsWith(`.${b}`))) continue;
      liste.push({ schluessel: `absender:${a.adresse}`, von: a.adresse, kategorie: a.kategorie as Kategorie });
    }
    return liste.slice(0, 400); // Gmail erlaubt höchstens 1000 Filter
  }

  private async autoFilterExport(negatedQuery: string): Promise<number> {
    const bekannt = this.db.get<Record<string, string>>('autoFilter', {});
    let n = 0;
    for (const p of this.autoFilterPlan()) {
      if (bekannt[p.schluessel]) continue;
      try {
        let akt: { addLabelIds: string[]; removeLabelIds: string[] } | null;
        if (p.ordner) akt = { addLabelIds: [await this.aus.labelId(p.ordner)], removeLabelIds: ['INBOX'] };
        else {
          akt = this.filterAktion(p.kategorie!);
          if (akt && this.db.einstellungen().aktionen[p.kategorie!].includes('label')) akt.addLabelIds.push(await this.aus.labelId(`${LABEL_PREFIX}/${KATEGORIE_NAME[p.kategorie!]}`));
        }
        if (!akt) continue;
        bekannt[p.schluessel] = await this.gmail.filterAnlegen(p.ordner ? { from: p.von } : { from: p.von, negatedQuery }, akt);
        this.db.set('autoFilter', bekannt); n++;
        this.log(`Gmail-Filter (wirkt auch ohne PC): ${p.ordner ? `Mails von ${p.von} → Ordner „${p.ordner}“` : `${p.von} → ${KATEGORIE_NAME[p.kategorie!]}`}.`);
      } catch (err) { this.log(`Gmail-Filter für ${p.von} fehlgeschlagen: ${(err as Error).message}`); }
    }
    return n;
  }

  /** Tiry schaltet „Auch bei ausgeschaltetem PC“ aus: alle automatisch angelegten Gmail-Filter wieder löschen. */
  async autoFilterEntfernen(): Promise<number> {
    const bekannt = this.db.get<Record<string, string>>('autoFilter', {});
    let n = 0;
    for (const [k, id] of Object.entries(bekannt)) { try { await this.gmail.filterLoeschen(id); } catch { /* schon weg */ } delete bekannt[k]; n++; }
    this.db.set('autoFilter', bekannt);
    return n;
  }

  /** Übersicht fürs Handy (siehe stand.ts). */
  baueStand(): Stand {
    const tag = new Date(this.jetzt()); tag.setHours(0, 0, 0, 0);
    const heute: Stand['heute'] = {};
    for (const f of ['wichtig', 'persoenlich', 'benachrichtigung', 'newsletter', 'werbung', 'muell']) heute[f] = { echt: 0, probe: 0 };
    const alle = this.db.protokoll({ limit: 3000 });
    for (const e of alle) {
      if (e.zeit < tag.getTime() || e.mailId === '-') continue;
      const weg = e.aktionen.includes('papierkorb') || e.aktionen.includes('archivieren');
      heute[fachVon(e.kategorie)][e.trocken && weg ? 'probe' : 'echt']++;
    }
    const a = this.altbestand;
    return {
      v: 1, zeit: this.jetzt(), status: this.statusInfo().status, heute, statistik: this.db.statistik(this.jetzt()),
      letzte: alle.filter((e) => e.mailId !== '-').slice(0, 25).map((e) => ({ zeit: e.zeit, absender: e.absender, betreff: e.betreff.slice(0, 120), kategorie: e.kategorie, trocken: e.trocken, ...zielVon(e) })),
      altbestand: a && a.phase !== 'leer' ? { phase: a.phase, gesamt: a.gesamt, erledigt: a.erledigt, geschafft: a.geschafft } : null,
      ordner: this.ordnerListe().filter((o) => o.aktiv && o.ueberSchwelle).slice(0, 20).map((o) => ({ name: o.name, anzahl: o.anzahl })),
      gmailRegeln: this.autoFilterAnzahl(),
    };
  }

  async standSchreiben(): Promise<void> {
    if (!this.gmail.standSpeichern) return;
    const id = await this.gmail.standSpeichern(standNachricht(this.baueStand(), this.email || 'ich'), this.db.get<string | null>('standEntwurf', null));
    this.db.set('standEntwurf', id);
  }

  /** Wie viele Filter räumen schon ohne PC auf? */
  autoFilterAnzahl(): number { return Object.keys(this.db.get<Record<string, string>>('autoFilter', {})).length + this.db.regeln().filter((r) => r.gmailFilterId).length; }

  async regelSchalten(id: number, aktiv: boolean) {
    const r = this.db.regel(id);
    if (!r) return;
    this.db.regelSchalten(id, aktiv);
    if (!aktiv && r.gmailFilterId) { try { await this.gmail.filterLoeschen(r.gmailFilterId); } catch { /* schon weg */ } this.db.regelFilter(id, null); }
    if (aktiv) await this.filterExport();
  }

  async regelLoeschen(id: number) {
    const r = this.db.regel(id);
    if (r?.gmailFilterId) { try { await this.gmail.filterLoeschen(r.gmailFilterId); } catch { /* schon weg */ } }
    this.db.regelLoeschen(id);
  }

  // ---------------- Altbestand ----------------
  /** Ganzes Postfach: alle Ordner außer Gesendet/Entwürfe (Spam und Papierkorb schließt Gmail ohnehin aus). */
  static readonly ALT_SUCHE = '-in:sent -in:drafts -in:chats';

  /** Was mit einer alten Mail passiert. Platz schaffen: Werbung/Newsletter in den Papierkorb statt ins Archiv. */
  private async altEntscheiden(m: Mail, e: ReturnType<Speicher['einstellungen']>, anzahl: Map<string, number>) {
    const r = await ordneEin(m, { einstellungen: { ...e, kiAn: false }, regeln: this.db.regeln(), istKontakt: (a) => this.db.istKontakt(a), historie: (a) => this.db.absenderHistorie(a) });
    const kandidat = this.ordnerKandidat(m, r.signale, r.schutz, r.entscheidung);
    const ordner = kandidat && (anzahl.get(kandidat.basis) ?? 0) >= e.ordnerAb ? kandidat : null;
    if (ordner) {
      const grundPlan = r.schutz.geschuetzt ? null : this.plan(m, r.signale, r.entscheidung);
      const trash = !!grundPlan && (grundPlan.papierkorb || (e.altPlatzSchaffen && (r.entscheidung.kategorie === 'werbung' || r.entscheidung.kategorie === 'newsletter')));
      if (!trash) {
        const plan = this.mitOrdner(grundPlan, m, ordner.name); plan.abmelden = false; plan.aktionen = plan.aktionen.filter((x) => x !== 'abmelden');
        return { r, plan, ziel: 'ordner' as const, kandidat, ordnerName: ordner.name };
      }
    }
    if (r.schutz.geschuetzt) return { r, plan: null as Plan | null, ziel: 'bleibt' as const, kandidat };
    const k = r.entscheidung.kategorie;
    let plan = this.plan(m, r.signale, r.entscheidung);
    if (e.altPlatzSchaffen && (k === 'werbung' || k === 'newsletter')) {
      plan = planeAktionen(k, ['papierkorb'], m, r.signale, { abmeldenErlaubt: false });
    }
    // Altbestand: nie massenhaft rückwirkend abmelden
    plan.abmelden = false; plan.aktionen = plan.aktionen.filter((a) => a !== 'abmelden');
    if (!plan.aktionen.length) plan.aktionen = ['behalten'];
    const nurBehalten = plan.aktionen.length === 1 && plan.aktionen[0] === 'behalten';
    if (nurBehalten) return { r, plan: null, ziel: 'bleibt' as const, kandidat };
    if (r.entscheidung.sicherheit < e.schwelle) return { r, plan, ziel: 'pruefen' as const, kandidat };
    return { r, plan, ziel: plan.papierkorb ? 'papierkorb' as const : plan.remove.includes('INBOX') ? 'archiv' as const : 'bleibt' as const, kandidat };
  }

  async altbestandVorschau(grenze = 200_000) {
    this.altbestand = { phase: 'vorschau', gesamt: 0, erledigt: 0, zaehler: {}, durchlauf: null, beispiele: [], ziele: { papierkorb: 0, archiv: 0, bleibt: 0, pruefen: 0, ordner: 0 }, freiBytes: 0, ordner: [] };
    this.emit('altbestand', this.altbestand);
    this.altIds = (await this.alleIds(Aufraeumer.ALT_SUCHE, grenze)).filter((id) => !this.db.istVerarbeitet(id));
    this.altbestand.gesamt = this.altIds.length;
    this.emit('altbestand', this.altbestand);
    const e = this.db.einstellungen();
    const leer = new Map<string, number>();
    // Durchgang 1 (eine Abfrage je Mail): einordnen ohne Ordner und Firmen zählen
    const notiz: Array<{ ziel: 'papierkorb' | 'archiv' | 'bleibt' | 'pruefen'; basis: string | null; groesse: number; kat: Kategorie; ab: string; betreff: string }> = [];
    const firmen = new Map<string, number>();
    for (let i = 0; i < this.altIds.length; i += 100) {
      const mails = await this.gmail.holeMetadaten(this.altIds.slice(i, i + 100));
      for (const m of mails) {
        const x = await this.altEntscheiden(m, e, leer);
        const basis = ordnerBasis(x.r.signale.domain);
        if (basis) firmen.set(basis, (firmen.get(basis) ?? 0) + 1);
        notiz.push({ ziel: x.ziel as any, basis: x.kandidat?.basis ?? null, groesse: m.sizeEstimate ?? 0, kat: x.r.entscheidung.kategorie, ab: x.r.signale.absender, betreff: x.r.signale.betreff });
      }
      this.altbestand.erledigt = Math.min(this.altIds.length, i + 100);
      this.emit('altbestand', { ...this.altbestand });
    }
    // Firmen-Zählung merken (zusammen mit der Datenbank)
    this.altZaehler = firmen;
    const anzahl = this.firmenAnzahl();
    const ordner = new Map<string, number>();
    for (const n of notiz) {
      this.altbestand.zaehler[n.kat] = (this.altbestand.zaehler[n.kat] ?? 0) + 1;
      const inOrdner = e.ordnerAn && n.basis && (anzahl.get(n.basis) ?? 0) >= e.ordnerAb && n.ziel !== 'papierkorb';
      if (inOrdner) { this.altbestand.ziele.ordner++; ordner.set(n.basis!, (ordner.get(n.basis!) ?? 0) + 1); continue; }
      this.altbestand.ziele[n.ziel]++;
      if (n.ziel === 'papierkorb') {
        this.altbestand.freiBytes += n.groesse;
        if (this.altbestand.beispiele.length < 12) this.altbestand.beispiele.push({ absender: n.ab, betreff: n.betreff, kategorie: n.kat });
      }
    }
    this.altbestand.ordner = [...ordner].sort((a, b) => b[1] - a[1]).map(([basis, n]) => ({ name: ordnerName(basis), anzahl: n }));
    this.altbestand.phase = 'bereit'; this.altbestand.erledigt = 0;
    this.emit('altbestand', this.altbestand);
    return this.altbestand;
  }

  async altbestandStarten() {
    if (this.altbestand.phase !== 'bereit') throw new Error('Erst die Vorschau erstellen.');
    const durchlauf = `altbestand-${new Date(this.jetzt()).toISOString()}`;
    this.altbestand = { ...this.altbestand, phase: 'laeuft', erledigt: 0, durchlauf, geschafft: { papierkorb: 0, archiv: 0, ordner: 0, freiBytes: 0 } };
    this.emit('altbestand', this.altbestand);
    const e = this.db.einstellungen();
    const anzahl = this.firmenAnzahl();
    for (let i = 0; i < this.altIds.length; i += 100) {
      const mails = await this.gmail.holeMetadaten(this.altIds.slice(i, i + 100).filter((id) => !this.db.istVerarbeitet(id)));
      const stapel: Array<{ mail: Mail; s: Signale; e: Entscheidung; plan: Plan }> = [];
      for (const m of mails) {
        const { r, plan, ziel } = await this.altEntscheiden(m, e, anzahl);
        if (r.signale.absender) this.db.absenderZaehlen({ adresse: r.signale.absender, domain: r.signale.domain, name: r.signale.anzeigename || r.signale.absender,
          gelesen: !m.labelIds.includes('UNREAD'), zeit: m.internalDate, kategorie: r.entscheidung.kategorie, listUnsub: r.signale.listUnsubscribe ? JSON.stringify(r.signale.listUnsubscribe) : null });
        if (ziel === 'pruefen' && plan) {
          this.db.zuPruefenMerken({ mailId: m.id, zeit: this.jetzt(), absender: r.signale.absender, name: r.signale.anzeigename,
            betreff: r.signale.betreff, snippet: m.snippet, kategorie: r.entscheidung.kategorie, sicherheit: r.entscheidung.sicherheit, begruendung: r.entscheidung.begruendung });
        }
        if (!plan || ziel === 'pruefen' || ziel === 'bleibt' && !plan.add.length) { this.db.markiereVerarbeitet(m.id, this.jetzt()); continue; }
        if (ziel === 'papierkorb') { this.altbestand.geschafft!.papierkorb++; this.altbestand.geschafft!.freiBytes += m.sizeEstimate ?? 0; }
        if (ziel === 'archiv') this.altbestand.geschafft!.archiv++;
        if (ziel === 'ordner') this.altbestand.geschafft!.ordner++;
        stapel.push({ mail: m, s: r.signale, e: r.entscheidung, plan });
      }
      const ids = await this.aus.ausfuehrenStapel(stapel, { durchlauf, trocken: e.trockenlauf });
      for (const m of mails) this.db.markiereVerarbeitet(m.id, this.jetzt());
      for (const id of ids.slice(-12)) this.emit('aktion', this.db.eintrag(id));
      this.altbestand.erledigt = Math.min(this.altIds.length, i + 100);
      this.emit('altbestand', { ...this.altbestand });
    }
    this.altbestand.phase = 'fertig';
    this.emit('altbestand', this.altbestand);
    return this.altbestand;
  }

  // ---------------- Rückgängig ----------------
  rueckgaengig(id: number) { return this.aus.rueckgaengig(id, this.jetzt()); }
  durchlaufRueckgaengig(durchlauf: string) { return this.aus.durchlaufRueckgaengig(durchlauf); }

  // ---------------- Scharf schalten ----------------
  /** Probelauf beenden – geht jederzeit (Tirys Entscheidung, 26.11.2026). Mails, die im Probelauf nur
   *  angezeigt wurden, werden dabei jetzt wirklich eingeordnet. Gibt die Anzahl dieser Mails zurück. */
  async scharfSchalten(): Promise<{ ok: boolean; grund?: string; nachgeholt: number }> {
    this.db.speichereEinstellungen({ trockenlauf: false });
    this.setStatus('laeuft');
    const ids = [...new Set(this.db.protokoll({ limit: 100000 }).filter((e) => e.trocken && e.status === 'ok'
      && !(e.aktionen.length === 1 && e.aktionen[0] === 'behalten')).map((e) => e.mailId))];
    for (const id of ids) this.db.vergiss(id);
    const nachgeholt = await this.verarbeiteIds(ids, `nach-probelauf-${new Date(this.jetzt()).toISOString()}`);
    void this.filterExport();
    return { ok: true, nachgeholt };
  }
  trockenlaufWieder() {
    this.db.speichereEinstellungen({ trockenlauf: true, trockenlaufSeit: this.jetzt() });
    this.setStatus('trockenlauf');
  }
}

export { KATEGORIEN };
export type { Aktion };
