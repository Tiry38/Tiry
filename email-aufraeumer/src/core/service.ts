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
  altbestand: { phase: 'leer' | 'vorschau' | 'bereit' | 'laeuft' | 'fertig'; gesamt: number; erledigt: number; zaehler: Partial<Record<Kategorie, number>>; durchlauf: string | null; beispiele: Array<{ absender: string; betreff: string; kategorie: Kategorie }> } =
    { phase: 'leer', gesamt: 0, erledigt: 0, zaehler: {}, durchlauf: null, beispiele: [] };
  private altIds: string[] = [];

  constructor(o: DienstOptionen) {
    super();
    this.gmail = o.gmail; this.db = o.db; this.ki = o.ki ?? null; this.post = o.post;
    this.jetzt = o.jetzt ?? Date.now;
    if (!this.db.get('einstellungen', null)) this.db.set('einstellungen', standardEinstellungen(this.jetzt()));
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
    const sek = Math.max(15, this.db.einstellungen().intervallSek);
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
        let token: string | undefined; let neueHistory = start;
        do {
          const r = await this.gmail.history(start, token);
          ids.push(...r.neueIds); neueHistory = r.historyId; token = r.nextPageToken;
        } while (token);
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
    if (schutz.geschuetzt) {
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
    if (!offen.length) return { angelegt: 0, wartet: 0, frage: false };
    if (e.trockenlauf) return { angelegt: 0, wartet: offen.length, frage: false };
    if (!e.filterExportFreigegeben) { this.emit('frage', { art: 'filter', anzahl: offen.length }); return { angelegt: 0, wartet: offen.length, frage: true }; }
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
    return { angelegt, wartet: offen.length - angelegt, frage: false };
  }

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
  async altbestandVorschau(grenze = 100_000) {
    this.altbestand = { phase: 'vorschau', gesamt: 0, erledigt: 0, zaehler: {}, durchlauf: null, beispiele: [] };
    this.emit('altbestand', this.altbestand);
    this.altIds = (await this.alleIds('in:inbox', grenze)).filter((id) => !this.db.istVerarbeitet(id));
    this.altbestand.gesamt = this.altIds.length;
    const e = this.db.einstellungen();
    const zaehler: Partial<Record<Kategorie, number>> = {};
    for (let i = 0; i < this.altIds.length; i += 100) {
      const mails = await this.gmail.holeMetadaten(this.altIds.slice(i, i + 100));
      for (const m of mails) {
        const r = await ordneEin(m, { einstellungen: { ...e, kiAn: false }, regeln: this.db.regeln(), istKontakt: (a) => this.db.istKontakt(a), historie: (a) => this.db.absenderHistorie(a) });
        const k = r.entscheidung.kategorie;
        zaehler[k] = (zaehler[k] ?? 0) + 1;
        if (this.altbestand.beispiele.length < 12 && !r.schutz.geschuetzt && MUELL.includes(k)) this.altbestand.beispiele.push({ absender: r.signale.absender, betreff: r.signale.betreff, kategorie: k });
      }
      this.altbestand.erledigt = Math.min(this.altIds.length, i + 100);
      this.altbestand.zaehler = { ...zaehler };
      this.emit('altbestand', this.altbestand);
    }
    this.altbestand.phase = 'bereit'; this.altbestand.erledigt = 0;
    this.emit('altbestand', this.altbestand);
    return this.altbestand;
  }

  async altbestandStarten() {
    if (this.altbestand.phase !== 'bereit') throw new Error('Erst die Vorschau erstellen.');
    const durchlauf = `altbestand-${new Date(this.jetzt()).toISOString()}`;
    this.altbestand = { ...this.altbestand, phase: 'laeuft', erledigt: 0, durchlauf };
    this.emit('altbestand', this.altbestand);
    const e = this.db.einstellungen();
    for (let i = 0; i < this.altIds.length; i += 100) {
      const mails = await this.gmail.holeMetadaten(this.altIds.slice(i, i + 100).filter((id) => !this.db.istVerarbeitet(id)));
      const stapel: Array<{ mail: Mail; s: Signale; e: Entscheidung; plan: Plan }> = [];
      for (const m of mails) {
        const r = await ordneEin(m, { einstellungen: { ...e, kiAn: false }, regeln: this.db.regeln(), istKontakt: (a) => this.db.istKontakt(a), historie: (a) => this.db.absenderHistorie(a) });
        if (r.signale.absender) this.db.absenderZaehlen({ adresse: r.signale.absender, domain: r.signale.domain, name: r.signale.anzeigename || r.signale.absender,
          gelesen: !m.labelIds.includes('UNREAD'), zeit: m.internalDate, kategorie: r.entscheidung.kategorie, listUnsub: r.signale.listUnsubscribe ? JSON.stringify(r.signale.listUnsubscribe) : null });
        const plan = r.schutz.geschuetzt ? null : this.plan(m, r.signale, r.entscheidung);
        // Altbestand: Abmelden nur bei neuen Mails, nicht massenhaft rückwirkend
        if (plan) { plan.abmelden = false; plan.aktionen = plan.aktionen.filter((a) => a !== 'abmelden'); if (!plan.aktionen.length) plan.aktionen = ['behalten']; }
        const nurBehalten = !plan || (plan.aktionen.length === 1 && plan.aktionen[0] === 'behalten');
        if (r.schutz.geschuetzt || nurBehalten || r.entscheidung.sicherheit < e.schwelle) {
          if (!r.schutz.geschuetzt && !nurBehalten) this.db.zuPruefenMerken({ mailId: m.id, zeit: this.jetzt(), absender: r.signale.absender, name: r.signale.anzeigename,
            betreff: r.signale.betreff, snippet: m.snippet, kategorie: r.entscheidung.kategorie, sicherheit: r.entscheidung.sicherheit, begruendung: r.entscheidung.begruendung });
          this.db.markiereVerarbeitet(m.id, this.jetzt());
          continue;
        }
        stapel.push({ mail: m, s: r.signale, e: r.entscheidung, plan: plan! });
      }
      const ids = await this.aus.ausfuehrenStapel(stapel, { durchlauf, trocken: e.trockenlauf });
      for (const m of mails) this.db.markiereVerarbeitet(m.id, this.jetzt());
      for (const id of ids.slice(-20)) this.emit('aktion', this.db.eintrag(id));
      this.altbestand.erledigt = Math.min(this.altIds.length, i + 100);
      this.emit('altbestand', this.altbestand);
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
