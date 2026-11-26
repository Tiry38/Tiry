// Tiry's Mails: das eigene Postfach – Ordner, Liste, Lesen, Schreiben, Aktionen.
// Gelöscht wird auch hier nie endgültig: „Löschen“ = Papierkorb (Gmail leert ihn nach 30 Tagen).
import type { GmailPort } from './gmail';
import type { Speicher } from './db';
import type { Kategorie, Mail } from './types';
import { parseAdresse, parseAdressListe } from './headers';
import { zerlegeVoll, baueMail, betreffMit, type VolleMail, type Anhang } from './mime';

export interface Ordner { id: string; name: string; art: 'system' | 'firma' | 'sorte' | 'eigen'; ungelesen?: number }
export interface Zeile {
  id: string; threadId: string; von: string; vonAdresse: string; betreff: string; vorschau: string; datum: number;
  ungelesen: boolean; stern: boolean; anhang: boolean; kategorie: Kategorie | null; labelIds: string[];
}
export interface Lesen extends VolleMail { von: string; vonAdresse: string; an: string; cc: string; betreff: string; kategorie: Kategorie | null; warnung: string | null }
export type PostAktion = 'archiv' | 'papierkorb' | 'stern' | 'sternWeg' | 'gelesen' | 'ungelesen' | 'posteingang' | { ordner: string };

const SYSTEM: Ordner[] = [
  { id: 'INBOX', name: 'Posteingang', art: 'system' },
  { id: 'STARRED', name: 'Mit Stern', art: 'system' },
  { id: 'SENT', name: 'Gesendet', art: 'system' },
  { id: 'ALLE', name: 'Alle Mails', art: 'system' },
  { id: 'SPAM', name: 'Spam', art: 'system' },
  { id: 'TRASH', name: 'Papierkorb', art: 'system' },
];

export class Postfach {
  private cache = new Map<string, { mail: Mail; zeit: number }>();
  private labelNamen = new Map<string, string>();
  /** Letzte Aktion für „Rückgängig“: Mail-IDs mit ihren Labels vorher. */
  private letzte: Array<{ id: string; vorher: string[] }> = [];

  constructor(private gmail: GmailPort, private db: Speicher, private eigeneAdresse: () => string) {}

  async ordner(): Promise<Ordner[]> {
    const labels = await this.gmail.labels();
    this.labelNamen.clear();
    for (const l of labels) this.labelNamen.set(l.id, l.name);
    // Eigene Labels haben IDs wie „Label_123“, System-Labels sind GROSSBUCHSTABEN (INBOX, CATEGORY_…)
    const eigen = labels.filter((l) => (l.id.startsWith('Label_') || !/^[A-Z_]+$/.test(l.id)) && l.name !== 'Aufräumer');
    const sorten = eigen.filter((l) => l.name.startsWith('Aufräumer/')).map((l) => ({ id: l.id, name: l.name.slice('Aufräumer/'.length), art: 'sorte' as const }));
    const rest = eigen.filter((l) => !l.name.startsWith('Aufräumer/')).map((l) => ({ id: l.id, name: l.name, art: 'firma' as const }));
    let ungelesen = 0;
    try { ungelesen = (await this.gmail.labelInfo('INBOX')).ungelesen; } catch { /* egal */ }
    const sys = SYSTEM.map((o) => (o.id === 'INBOX' ? { ...o, ungelesen } : o));
    return [...sys, ...rest.sort((a, b) => a.name.localeCompare(b.name, 'de')), ...sorten.sort((a, b) => a.name.localeCompare(b.name, 'de'))];
  }

  private zeile(m: Mail): Zeile {
    const von = parseAdresse(m.headers['from']);
    const k = this.kategorie(m.id);
    return {
      id: m.id, threadId: m.threadId, von: von.name || von.adresse, vonAdresse: von.adresse, betreff: m.headers['subject'] ?? '',
      vorschau: m.snippet, datum: m.internalDate, ungelesen: m.labelIds.includes('UNREAD'), stern: m.labelIds.includes('STARRED'),
      anhang: /multipart\/mixed/i.test(m.headers['content-type'] ?? ''), kategorie: k, labelIds: m.labelIds,
    };
  }

  private kategorie(mailId: string): Kategorie | null {
    const r = this.db.db.prepare('SELECT kategorie FROM protokoll WHERE mail_id = ? ORDER BY id DESC LIMIT 1').get(mailId) as any;
    return r?.kategorie ?? null;
  }

  /** Eine Seite eines Ordners (neueste zuerst). Metadaten werden 2 Minuten zwischengespeichert. */
  async liste(ordnerId: string, suche = '', pageToken?: string): Promise<{ zeilen: Zeile[]; weiter?: string; gesamt?: number }> {
    const label = ordnerId === 'ALLE' ? null : ordnerId;
    const r = await this.gmail.listeOrdner(label, suche, pageToken, 50);
    const jetzt = Date.now();
    const fehlt = r.ids.filter((id) => { const c = this.cache.get(id); return !c || jetzt - c.zeit > 120_000; });
    if (fehlt.length) for (const m of await this.gmail.holeMetadaten(fehlt)) this.cache.set(m.id, { mail: m, zeit: jetzt });
    if (this.cache.size > 3000) for (const k of [...this.cache.keys()].slice(0, 1000)) this.cache.delete(k);
    const zeilen = r.ids.map((id) => this.cache.get(id)?.mail).filter((m): m is Mail => !!m).map((m) => this.zeile(m));
    return { zeilen, weiter: r.nextPageToken, gesamt: r.geschaetzt };
  }

  /** Ganze Mail öffnen; ungelesene werden als gelesen markiert. */
  async lesen(id: string): Promise<Lesen> {
    const roh = await this.gmail.holeVoll(id);
    const v = zerlegeVoll(roh);
    if (v.labelIds.includes('UNREAD')) {
      await this.gmail.modify(id, [], ['UNREAD']);
      v.labelIds = v.labelIds.filter((l) => l !== 'UNREAD');
      const c = this.cache.get(id); if (c) c.mail.labelIds = c.mail.labelIds.filter((l) => l !== 'UNREAD');
    }
    const von = parseAdresse(v.headers['from']);
    const kategorie = this.kategorie(id);
    const warnung = kategorie === 'phishing' ? 'Achtung: Diese Mail sieht nach Betrug aus. Klick keine Links an und gib keine Daten ein.'
      : kategorie === 'spam' ? 'Diese Mail ist wahrscheinlich Spam.' : null;
    return { ...v, von: von.name || von.adresse, vonAdresse: von.adresse, an: v.headers['to'] ?? '', cc: v.headers['cc'] ?? '', betreff: v.headers['subject'] ?? '', kategorie, warnung };
  }

  async anhang(mailId: string, a: Pick<Anhang, 'anhangId'>): Promise<Uint8Array> { return this.gmail.anhang(mailId, a.anhangId); }

  /** Vorlage für Antworten/Weiterleiten. */
  async vorlage(id: string, art: 'antworten' | 'allen' | 'weiter') {
    const m = await this.lesen(id);
    const ich = this.eigeneAdresse().toLowerCase();
    const zitat = `\n\nAm ${new Date(m.datum).toLocaleString('de-DE')} schrieb ${m.von} <${m.vonAdresse}>:\n` +
      (m.text ?? (m.html ?? '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n'))
        .split('\n').map((z) => `> ${z}`).join('\n');
    const antwortAn = m.headers['reply-to'] || m.headers['from'] || '';
    let an: string[] = [], cc: string[] = [];
    if (art === 'antworten') an = [antwortAn];
    if (art === 'allen') {
      an = [antwortAn];
      cc = [...parseAdressListe(m.an), ...parseAdressListe(m.cc)].filter((x) => x.adresse !== ich && x.adresse !== parseAdresse(antwortAn).adresse)
        .map((x) => (x.name ? `${x.name} <${x.adresse}>` : x.adresse));
    }
    return {
      an, cc, betreff: betreffMit(art === 'weiter' ? 'Fwd' : 'Re', m.betreff),
      text: art === 'weiter' ? `\n\n---------- Weitergeleitete Nachricht ----------\nVon: ${m.von} <${m.vonAdresse}>\nDatum: ${new Date(m.datum).toLocaleString('de-DE')}\nBetreff: ${m.betreff}\n\n${m.text ?? ''}` : zitat,
      threadId: art === 'weiter' ? undefined : m.threadId,
      inReplyTo: art === 'weiter' ? undefined : m.headers['message-id'],
      references: art === 'weiter' ? undefined : [m.headers['references'], m.headers['message-id']].filter(Boolean).join(' '),
    };
  }

  async senden(e: { an: string[]; cc?: string[]; bcc?: string[]; betreff: string; text: string; threadId?: string; inReplyTo?: string; references?: string; anhaenge?: Array<{ name: string; mime: string; daten: Uint8Array }> }) {
    const an = e.an.flatMap((x) => x.split(/[,;]/)).map((x) => x.trim()).filter(Boolean);
    if (!an.length) throw new Error('Bitte mindestens einen Empfänger eintragen.');
    for (const x of [...an, ...(e.cc ?? []), ...(e.bcc ?? [])]) if (!/@[^@\s>]+\.[^@\s>]+/.test(x)) throw new Error(`„${x}“ ist keine gültige Adresse.`);
    const raw = baueMail({ von: this.eigeneAdresse(), an, cc: e.cc, bcc: e.bcc, betreff: e.betreff, text: e.text, inReplyTo: e.inReplyTo, references: e.references, anhaenge: e.anhaenge });
    await this.gmail.sendeMail(raw, e.threadId);
  }

  /** Aktionen auf eine oder mehrere Mails; merkt sich den Zustand vorher für „Rückgängig“. */
  async aktion(ids: string[], a: PostAktion): Promise<void> {
    const vorher = await this.gmail.holeMetadaten(ids);
    this.letzte = vorher.map((m) => ({ id: m.id, vorher: [...m.labelIds] }));
    for (const m of vorher) {
      if (a === 'papierkorb') await this.gmail.trash(m.id);
      else if (a === 'archiv') await this.gmail.modify(m.id, [], ['INBOX']);
      else if (a === 'posteingang') { if (m.labelIds.includes('TRASH')) await this.gmail.untrash(m.id); await this.gmail.modify(m.id, ['INBOX'], ['SPAM']); }
      else if (a === 'stern') await this.gmail.modify(m.id, ['STARRED'], []);
      else if (a === 'sternWeg') await this.gmail.modify(m.id, [], ['STARRED']);
      else if (a === 'gelesen') await this.gmail.modify(m.id, [], ['UNREAD']);
      else if (a === 'ungelesen') await this.gmail.modify(m.id, ['UNREAD'], []);
      else await this.gmail.modify(m.id, [a.ordner], ['INBOX']);
      this.cache.delete(m.id);
    }
  }

  /** Letzte Aktion zurücknehmen – Labels exakt wie vorher. */
  async rueckgaengig(): Promise<number> {
    let n = 0;
    for (const { id, vorher } of this.letzte) {
      let [ist] = await this.gmail.holeMetadaten([id]);
      if (!ist) continue;
      if (ist.labelIds.includes('TRASH') && !vorher.includes('TRASH')) { await this.gmail.untrash(id); [ist] = await this.gmail.holeMetadaten([id]); }
      const add = vorher.filter((l) => !ist.labelIds.includes(l) && l !== 'TRASH');
      const rem = ist.labelIds.filter((l) => !vorher.includes(l) && l !== 'TRASH');
      if (add.length || rem.length) await this.gmail.modify(id, add, rem);
      this.cache.delete(id); n++;
    }
    this.letzte = [];
    return n;
  }

  /** Neuen eigenen Ordner anlegen. */
  async ordnerAnlegen(name: string): Promise<string> {
    const sauber = name.trim().replace(/[\\]/g, ' ');
    if (!sauber) throw new Error('Name fehlt.');
    return this.gmail.labelAnlegen(sauber);
  }
}
