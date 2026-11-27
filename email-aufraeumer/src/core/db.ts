// SQLite-Speicher (eingebautes node:sqlite – keine native Zusatz-Abhängigkeit).
import { DatabaseSync } from 'node:sqlite';
import type { Aktion, Einstellungen, Kategorie, ProtokollEintrag, Regel } from './types';
import { standardEinstellungen } from './settings';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS protokoll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit INTEGER NOT NULL, durchlauf TEXT NOT NULL, mail_id TEXT NOT NULL,
  absender TEXT NOT NULL, betreff TEXT NOT NULL, kategorie TEXT NOT NULL, sicherheit INTEGER NOT NULL,
  stufe TEXT NOT NULL, begruendung TEXT NOT NULL, aktionen TEXT NOT NULL, trocken INTEGER NOT NULL,
  vorher TEXT NOT NULL, nachher TEXT NOT NULL, rueckgaengig INTEGER, status TEXT NOT NULL, hinweis TEXT
);
CREATE INDEX IF NOT EXISTS protokoll_zeit ON protokoll(zeit);
CREATE INDEX IF NOT EXISTS protokoll_lauf ON protokoll(durchlauf);
CREATE TABLE IF NOT EXISTS regeln (
  id INTEGER PRIMARY KEY AUTOINCREMENT, art TEXT NOT NULL, feld TEXT NOT NULL, wert TEXT NOT NULL,
  kategorie TEXT, aktiv INTEGER NOT NULL DEFAULT 1, bestaetigt INTEGER NOT NULL DEFAULT 1,
  gmail_filter_id TEXT, erstellt INTEGER NOT NULL, UNIQUE(art, feld, wert)
);
CREATE TABLE IF NOT EXISTS absender (
  adresse TEXT PRIMARY KEY, domain TEXT NOT NULL, name TEXT NOT NULL, anzahl INTEGER NOT NULL DEFAULT 0,
  gelesen INTEGER NOT NULL DEFAULT 0, letzte INTEGER NOT NULL DEFAULT 0, kategorie TEXT,
  abgemeldet INTEGER, listunsub TEXT
);
CREATE TABLE IF NOT EXISTS kontakte (adresse TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS verarbeitet (mail_id TEXT PRIMARY KEY, zeit INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pruefen (
  mail_id TEXT PRIMARY KEY, zeit INTEGER NOT NULL, absender TEXT NOT NULL, name TEXT NOT NULL,
  betreff TEXT NOT NULL, snippet TEXT NOT NULL, kategorie TEXT NOT NULL, sicherheit INTEGER NOT NULL,
  begruendung TEXT NOT NULL, erledigt INTEGER
);
CREATE TABLE IF NOT EXISTS quote (tag TEXT NOT NULL, methode TEXT NOT NULL, einheiten INTEGER NOT NULL,
  aufrufe INTEGER NOT NULL, PRIMARY KEY(tag, methode));
`;

export type NeuerEintrag = Omit<ProtokollEintrag, 'id' | 'rueckgaengig'>;

export class Speicher {
  readonly db: DatabaseSync;

  constructor(pfad = ':memory:') {
    this.db = new DatabaseSync(pfad);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
  }

  schliessen() { this.db.close(); }

  // ---------- Schlüssel/Wert ----------
  get<T>(k: string, standard: T): T {
    const r = this.db.prepare('SELECT v FROM kv WHERE k = ?').get(k) as { v: string } | undefined;
    return r ? (JSON.parse(r.v) as T) : standard;
  }
  set(k: string, v: unknown) {
    this.db.prepare('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v));
  }

  einstellungen(): Einstellungen {
    const std = standardEinstellungen();
    const gespeichert = this.get<Partial<Einstellungen> | null>('einstellungen', null);
    if (!gespeichert) { this.set('einstellungen', std); return std; }
    return { ...std, ...gespeichert, aktionen: { ...std.aktionen, ...(gespeichert.aktionen ?? {}) } };
  }
  speichereEinstellungen(teil: Partial<Einstellungen>): Einstellungen {
    const neu = { ...this.einstellungen(), ...teil };
    this.set('einstellungen', neu);
    return neu;
  }

  // ---------- Protokoll ----------
  protokolliere(e: NeuerEintrag): number {
    const r = this.db.prepare(`INSERT INTO protokoll(zeit, durchlauf, mail_id, absender, betreff, kategorie, sicherheit, stufe,
      begruendung, aktionen, trocken, vorher, nachher, status, hinweis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      e.zeit, e.durchlauf, e.mailId, e.absender, e.betreff, e.kategorie, Math.round(e.sicherheit), e.stufe, e.begruendung,
      JSON.stringify(e.aktionen), e.trocken ? 1 : 0, JSON.stringify(e.vorherLabels), JSON.stringify(e.nachherLabels),
      e.status, e.hinweis,
    );
    return Number(r.lastInsertRowid);
  }

  private zeile(r: any): ProtokollEintrag {
    return {
      id: r.id, zeit: r.zeit, durchlauf: r.durchlauf, mailId: r.mail_id, absender: r.absender, betreff: r.betreff,
      kategorie: r.kategorie as Kategorie, sicherheit: r.sicherheit, stufe: r.stufe, begruendung: r.begruendung,
      aktionen: JSON.parse(r.aktionen) as Aktion[], trocken: !!r.trocken, vorherLabels: JSON.parse(r.vorher),
      nachherLabels: JSON.parse(r.nachher), rueckgaengig: r.rueckgaengig ?? null, status: r.status, hinweis: r.hinweis ?? null,
    };
  }

  eintrag(id: number): ProtokollEintrag | null {
    const r = this.db.prepare('SELECT * FROM protokoll WHERE id = ?').get(id);
    return r ? this.zeile(r) : null;
  }

  protokoll(f: { suche?: string; kategorie?: string; durchlauf?: string; limit?: number; nurAktionen?: boolean } = {}): ProtokollEintrag[] {
    const bed: string[] = []; const par: any[] = [];
    if (f.suche) { bed.push('(absender LIKE ? OR betreff LIKE ? OR begruendung LIKE ?)'); const s = `%${f.suche}%`; par.push(s, s, s); }
    if (f.kategorie) { bed.push('kategorie = ?'); par.push(f.kategorie); }
    if (f.durchlauf) { bed.push('durchlauf = ?'); par.push(f.durchlauf); }
    if (f.nurAktionen) bed.push("status = 'ok'");
    const sql = `SELECT * FROM protokoll ${bed.length ? 'WHERE ' + bed.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
    par.push(f.limit ?? 200);
    return (this.db.prepare(sql).all(...par) as any[]).map((r) => this.zeile(r));
  }

  markiereRueckgaengig(id: number, zeit = Date.now()) {
    this.db.prepare('UPDATE protokoll SET rueckgaengig = ? WHERE id = ?').run(zeit, id);
  }

  // ---------- Verarbeitet ----------
  istVerarbeitet(mailId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM verarbeitet WHERE mail_id = ?').get(mailId);
  }
  markiereVerarbeitet(mailId: string, zeit = Date.now()) {
    this.db.prepare('INSERT OR REPLACE INTO verarbeitet(mail_id, zeit) VALUES(?, ?)').run(mailId, zeit);
  }
  vergiss(mailId: string) { this.db.prepare('DELETE FROM verarbeitet WHERE mail_id = ?').run(mailId); }

  // ---------- Regeln ----------
  private regelZeile(r: any): Regel {
    return { id: r.id, art: r.art, feld: r.feld, wert: r.wert, kategorie: r.kategorie ?? null, aktiv: !!r.aktiv,
      bestaetigt: r.bestaetigt, gmailFilterId: r.gmail_filter_id ?? null, erstellt: r.erstellt };
  }
  regeln(): Regel[] {
    return (this.db.prepare('SELECT * FROM regeln ORDER BY art, wert').all() as any[]).map((r) => this.regelZeile(r));
  }
  regel(id: number): Regel | null {
    const r = this.db.prepare('SELECT * FROM regeln WHERE id = ?').get(id);
    return r ? this.regelZeile(r) : null;
  }
  /** Legt eine Regel an oder erhöht die Bestätigungen einer vorhandenen. */
  regelMerken(art: Regel['art'], feld: Regel['feld'], wert: string, kategorie: Kategorie | null, zeit = Date.now()): Regel {
    wert = wert.trim().toLowerCase();
    this.db.prepare(`INSERT INTO regeln(art, feld, wert, kategorie, aktiv, bestaetigt, erstellt) VALUES(?,?,?,?,1,1,?)
      ON CONFLICT(art, feld, wert) DO UPDATE SET bestaetigt = bestaetigt + 1, aktiv = 1, kategorie = excluded.kategorie`)
      .run(art, feld, wert, kategorie, zeit);
    return this.regelZeile(this.db.prepare('SELECT * FROM regeln WHERE art = ? AND feld = ? AND wert = ?').get(art, feld, wert));
  }
  regelSchalten(id: number, aktiv: boolean) { this.db.prepare('UPDATE regeln SET aktiv = ? WHERE id = ?').run(aktiv ? 1 : 0, id); }
  regelFilter(id: number, filterId: string | null) { this.db.prepare('UPDATE regeln SET gmail_filter_id = ? WHERE id = ?').run(filterId, id); }
  regelLoeschen(id: number) { this.db.prepare('DELETE FROM regeln WHERE id = ?').run(id); }
  /** Entfernt eine gegenteilige Regel (z. B. gelernt „weg“, wenn Tiry „behalten“ sagt). */
  regelEntfernen(art: Regel['art'], feld: Regel['feld'], wert: string) {
    this.db.prepare('DELETE FROM regeln WHERE art = ? AND feld = ? AND wert = ?').run(art, feld, wert.toLowerCase());
  }

  // ---------- Absender ----------
  absenderZaehlen(a: { adresse: string; domain: string; name: string; gelesen: boolean; zeit: number; kategorie: Kategorie; listUnsub: string | null }) {
    this.db.prepare(`INSERT INTO absender(adresse, domain, name, anzahl, gelesen, letzte, kategorie, listunsub) VALUES(?,?,?,1,?,?,?,?)
      ON CONFLICT(adresse) DO UPDATE SET anzahl = anzahl + 1, gelesen = gelesen + excluded.gelesen,
      letzte = MAX(letzte, excluded.letzte), name = excluded.name, kategorie = excluded.kategorie,
      listunsub = COALESCE(excluded.listunsub, listunsub)`)
      .run(a.adresse, a.domain, a.name, a.gelesen ? 1 : 0, a.zeit, a.kategorie, a.listUnsub);
  }
  absenderHistorie(adresse: string): { anzahl: number; gelesen: number } | null {
    const r = this.db.prepare('SELECT anzahl, gelesen FROM absender WHERE adresse = ?').get(adresse) as any;
    return r ? { anzahl: r.anzahl, gelesen: r.gelesen } : null;
  }
  topAbsender(limit = 50): Array<{ adresse: string; domain: string; name: string; anzahl: number; gelesen: number; letzte: number; kategorie: string | null; abgemeldet: number | null; abmeldbar: boolean }> {
    return (this.db.prepare('SELECT * FROM absender ORDER BY anzahl DESC, letzte DESC LIMIT ?').all(limit) as any[])
      .map((r) => ({ adresse: r.adresse, domain: r.domain, name: r.name, anzahl: r.anzahl, gelesen: r.gelesen, letzte: r.letzte,
        kategorie: r.kategorie, abgemeldet: r.abgemeldet ?? null, abmeldbar: !!r.listunsub }));
  }
  /** Mails je Absender-Domain (für Ordner). */
  domainAnzahlen(): Array<{ domain: string; anzahl: number }> {
    return (this.db.prepare('SELECT domain, SUM(anzahl) AS anzahl FROM absender GROUP BY domain').all() as any[]).map((r) => ({ domain: r.domain, anzahl: r.anzahl }));
  }
  absenderListUnsub(adresse: string): string | null {
    const r = this.db.prepare('SELECT listunsub FROM absender WHERE adresse = ?').get(adresse) as any;
    return r?.listunsub ?? null;
  }
  absenderAbgemeldet(adresse: string, zeit = Date.now()) {
    this.db.prepare('UPDATE absender SET abgemeldet = ? WHERE adresse = ?').run(zeit, adresse);
  }
  istAbgemeldet(adresse: string): boolean {
    const r = this.db.prepare('SELECT abgemeldet FROM absender WHERE adresse = ?').get(adresse) as any;
    return !!r?.abgemeldet;
  }

  // ---------- Kontakte (aus in:sent) ----------
  kontakteSetzen(adressen: Iterable<string>) {
    const st = this.db.prepare('INSERT OR IGNORE INTO kontakte(adresse) VALUES(?)');
    for (const a of adressen) st.run(a.toLowerCase());
  }
  istKontakt(adresse: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM kontakte WHERE adresse = ?').get(adresse.toLowerCase());
  }
  /** Absender, die regelmäßig Werbung/Newsletter schicken (für Gmail-Filter, die auch ohne PC wirken). */
  vielschreiberMuell(ab: number, max = 300): Array<{ adresse: string; kategorie: string; anzahl: number }> {
    return this.db.prepare(`SELECT adresse, kategorie, anzahl FROM absender WHERE kategorie IN ('werbung','newsletter') AND anzahl >= ?
      AND adresse NOT IN (SELECT adresse FROM kontakte) ORDER BY anzahl DESC LIMIT ?`).all(ab, max) as any;
  }
  anzahlKontakte(): number { return (this.db.prepare('SELECT COUNT(*) AS n FROM kontakte').get() as any).n; }

  // ---------- Zu prüfen ----------
  zuPruefenMerken(p: { mailId: string; zeit: number; absender: string; name: string; betreff: string; snippet: string; kategorie: Kategorie; sicherheit: number; begruendung: string }) {
    this.db.prepare(`INSERT OR REPLACE INTO pruefen(mail_id, zeit, absender, name, betreff, snippet, kategorie, sicherheit, begruendung, erledigt)
      VALUES(?,?,?,?,?,?,?,?,?,NULL)`).run(p.mailId, p.zeit, p.absender, p.name, p.betreff, p.snippet, p.kategorie, Math.round(p.sicherheit), p.begruendung);
  }
  zuPruefen(): Array<{ mailId: string; zeit: number; absender: string; name: string; betreff: string; snippet: string; kategorie: Kategorie; sicherheit: number; begruendung: string }> {
    return (this.db.prepare('SELECT * FROM pruefen WHERE erledigt IS NULL ORDER BY zeit DESC').all() as any[]).map((r) => ({
      mailId: r.mail_id, zeit: r.zeit, absender: r.absender, name: r.name, betreff: r.betreff, snippet: r.snippet,
      kategorie: r.kategorie, sicherheit: r.sicherheit, begruendung: r.begruendung }));
  }
  pruefenErledigt(mailId: string, zeit = Date.now()) { this.db.prepare('UPDATE pruefen SET erledigt = ? WHERE mail_id = ?').run(zeit, mailId); }

  // ---------- Quote ----------
  quoteZaehlen(methode: string, einheiten: number, tag = new Date().toISOString().slice(0, 10)) {
    this.db.prepare(`INSERT INTO quote(tag, methode, einheiten, aufrufe) VALUES(?,?,?,1)
      ON CONFLICT(tag, methode) DO UPDATE SET einheiten = einheiten + excluded.einheiten, aufrufe = aufrufe + 1`).run(tag, methode, einheiten);
  }
  quoteHeute(tag = new Date().toISOString().slice(0, 10)): { einheiten: number; aufrufe: number; methoden: Record<string, number> } {
    const rows = this.db.prepare('SELECT methode, einheiten, aufrufe FROM quote WHERE tag = ?').all(tag) as any[];
    const methoden: Record<string, number> = {};
    let einheiten = 0, aufrufe = 0;
    for (const r of rows) { methoden[r.methode] = r.einheiten; einheiten += r.einheiten; aufrufe += r.aufrufe; }
    return { einheiten, aufrufe, methoden };
  }

  // ---------- Statistik ----------
  /** Freigemachten Speicher mitzählen (Mails im Papierkorb – Gmail gibt den Platz frei, sobald der Papierkorb geleert ist). */
  platzMerken(bytes: number, jetzt = Date.now()) {
    if (!bytes) return;
    const p = this.get<{ gesamt: number; tage: Record<string, number> }>('platz', { gesamt: 0, tage: {} });
    const tag = new Date(jetzt).toISOString().slice(0, 10);
    p.gesamt = Math.max(0, p.gesamt + bytes);
    p.tage[tag] = Math.max(0, (p.tage[tag] ?? 0) + bytes);
    for (const t of Object.keys(p.tage)) if (jetzt - Date.parse(t) > 60 * 86400_000) delete p.tage[t];
    this.set('platz', p);
  }
  platz(jetzt = Date.now()): { gesamt: number; woche: number; heute: number } {
    const p = this.get<{ gesamt: number; tage: Record<string, number> }>('platz', { gesamt: 0, tage: {} });
    const heute = new Date(jetzt).toISOString().slice(0, 10);
    const woche = Object.entries(p.tage).filter(([t]) => jetzt - Date.parse(t) < 7 * 86400_000).reduce((a, [, n]) => a + n, 0);
    return { gesamt: p.gesamt, woche, heute: p.tage[heute] ?? 0 };
  }

  statistik(jetzt = Date.now()) {
    const tagStart = new Date(jetzt); tagStart.setHours(0, 0, 0, 0);
    const wocheStart = jetzt - 7 * 86400_000;
    const entfernt = (ab: number) => (this.db.prepare(`SELECT COUNT(*) AS n FROM protokoll WHERE zeit >= ? AND status = 'ok'
      AND rueckgaengig IS NULL AND kategorie NOT IN ('wichtig','persoenlich')
      AND (aktionen LIKE '%archivieren%' OR aktionen LIKE '%papierkorb%')`).get(ab) as any).n as number;
    const geprueft = (ab: number) => (this.db.prepare('SELECT COUNT(*) AS n FROM protokoll WHERE zeit >= ?').get(ab) as any).n as number;
    const heute = entfernt(tagStart.getTime());
    const woche = entfernt(wocheStart);
    const gesamt = entfernt(0);
    return {
      heuteEntfernt: heute, wocheEntfernt: woche, gesamtEntfernt: gesamt,
      heuteGeprueft: geprueft(tagStart.getTime()),
      // Annahme: 20 Sekunden Lesezeit je weggeräumter Mail (Betreff erfassen, entscheiden, wegklicken)
      lesezeitMinutenWoche: Math.round((woche * 20) / 60),
      zuPruefen: (this.db.prepare('SELECT COUNT(*) AS n FROM pruefen WHERE erledigt IS NULL').get() as any).n as number,
      platzGesamt: this.platz(jetzt).gesamt, platzWoche: this.platz(jetzt).woche, platzHeute: this.platz(jetzt).heute,
    };
  }
}
