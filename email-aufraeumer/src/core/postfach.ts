// Tiry's Mails: das eigene Postfach – Ordner, Liste, Lesen, Schreiben, Aktionen.
// Gelöscht wird auch hier nie endgültig: „Löschen“ = Papierkorb (Gmail leert ihn nach 30 Tagen).
import type { GmailPort } from './gmail';
import type { Kategorie, Mail } from './types';
import { parseAdresse, parseAdressListe, dekodiereMimeWort } from './headers';
import { zerlegeVoll, baueMail, betreffMit, type VolleMail, type Anhang } from './mime';
import { vorlageHtml } from './vorlage';

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
  /** Vollständige Mails (vorgeladen), damit das Öffnen sofort geht. */
  private volle = new Map<string, { roh: any; zeit: number }>();
  private laeuft = new Map<string, Promise<any>>();
  private labelNamen = new Map<string, string>();
  /** Letzte Aktion für „Rückgängig“: Mail-IDs mit ihren Labels vorher. */
  private letzte: Array<{ id: string; vorher: string[]; groesse?: number }> = [];
  /** Wird mit der Größe aufgerufen, wenn Mails in den Papierkorb gehen (negativ beim Zurückholen) – für „Platz frei gemacht“. */
  platz: (bytes: number) => void = () => {};

  /** kategorieVon: am PC aus dem Verlauf (Datenbank), in der Handy-App aus den Gmail-Labels „Aufräumer/…“. */
  constructor(private gmail: GmailPort, private kategorieVon: (id: string, labelIds: string[]) => Kategorie | null, private eigeneAdresse: () => string) {}

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
    const k = this.kategorieVon(m.id, m.labelIds);
    return {
      id: m.id, threadId: m.threadId, von: von.name || von.adresse, vonAdresse: von.adresse, betreff: dekodiereMimeWort(m.headers['subject'] ?? ''),
      vorschau: m.snippet, datum: m.internalDate, ungelesen: m.labelIds.includes('UNREAD'), stern: m.labelIds.includes('STARRED'),
      anhang: /multipart\/mixed/i.test(m.headers['content-type'] ?? ''), kategorie: k, labelIds: m.labelIds,
    };
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

  /** Eine ganze Mail holen – aus dem Vorrat, wenn schon vorgeladen (höchstens 10 Min. alt). */
  private holeVoll(id: string): Promise<any> {
    const v = this.volle.get(id);
    if (v && Date.now() - v.zeit < 600_000) return Promise.resolve(v.roh);
    const l = this.laeuft.get(id); if (l) return l;
    const p = this.gmail.holeVoll(id).then((roh) => {
      this.volle.set(id, { roh, zeit: Date.now() });
      if (this.volle.size > 150) for (const k of [...this.volle.keys()].slice(0, 50)) this.volle.delete(k);
      return roh;
    }).finally(() => this.laeuft.delete(id));
    this.laeuft.set(id, p);
    return p;
  }

  /** Mails im Hintergrund vorladen (die oberen der Liste, die unter dem Mauszeiger/Finger) – Fehler sind egal. */
  async vorladen(ids: string[]): Promise<void> {
    const offen = ids.filter((id) => !this.volle.has(id)).slice(0, 12);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(3, offen.length) }, async () => {
      while (i < offen.length) { const id = offen[i++]; try { await this.holeVoll(id); } catch { /* egal */ } }
    }));
  }

  /** Ganze Mail öffnen; ungelesene werden als gelesen markiert (im Hintergrund – das Öffnen wartet nicht darauf). */
  async lesen(id: string): Promise<Lesen> {
    const roh = await this.holeVoll(id);
    const v = zerlegeVoll(roh);
    if (v.labelIds.includes('UNREAD')) {
      void this.gmail.modify(id, [], ['UNREAD']).catch(() => {});
      v.labelIds = v.labelIds.filter((l) => l !== 'UNREAD');
      roh.labelIds = (roh.labelIds ?? []).filter((l: string) => l !== 'UNREAD');
      const c = this.cache.get(id); if (c) c.mail.labelIds = c.mail.labelIds.filter((l) => l !== 'UNREAD');
    }
    const von = parseAdresse(v.headers['from']);
    const kategorie = this.kategorieVon(id, v.labelIds);
    const warnung = kategorie === 'phishing' ? 'Achtung: Diese Mail sieht nach Betrug aus. Klick keine Links an und gib keine Daten ein.'
      : kategorie === 'spam' ? 'Diese Mail ist wahrscheinlich Spam.' : null;
    return { ...v, von: von.name || von.adresse, vonAdresse: von.adresse, an: v.headers['to'] ?? '', cc: v.headers['cc'] ?? '', betreff: dekodiereMimeWort(v.headers['subject'] ?? ''), kategorie, warnung };
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

  async senden(e: { an: string[]; cc?: string[]; bcc?: string[]; betreff: string; text: string; threadId?: string; inReplyTo?: string; references?: string;
    anhaenge?: Array<{ name: string; mime: string; daten: Uint8Array }>; links?: Array<{ name: string; groesse: number; link: string }>; gestaltet?: boolean; vonName?: string }) {
    const an = e.an.flatMap((x) => x.split(/[,;]/)).map((x) => x.trim()).filter(Boolean);
    if (!an.length) throw new Error('Bitte mindestens einen Empfänger eintragen.');
    for (const x of [...an, ...(e.cc ?? []), ...(e.bcc ?? [])]) if (!/@[^@\s>]+\.[^@\s>]+/.test(x)) throw new Error(`„${x}“ ist keine gültige Adresse.`);
    const html = e.gestaltet === false ? undefined : vorlageHtml({ betreff: e.betreff, text: e.text, vonName: e.vonName ?? 'Tiry', links: e.links,
      anhaenge: e.anhaenge?.map((a) => ({ name: a.name, groesse: a.daten.length })) });
    const raw = baueMail({ von: this.eigeneAdresse(), an, cc: e.cc, bcc: e.bcc, betreff: e.betreff, text: e.text, inReplyTo: e.inReplyTo, references: e.references, anhaenge: e.anhaenge, html });
    await this.gmail.sendeMail(raw, e.threadId);
  }

  /** Aktionen auf eine oder mehrere Mails; merkt sich den Zustand vorher für „Rückgängig“. */
  async aktion(ids: string[], a: PostAktion): Promise<void> {
    // Zustand vorher aus dem Zwischenspeicher (spart eine Abfrage) – nur was fehlt, wird geholt
    const bekannt = ids.map((id) => this.cache.get(id)?.mail).filter((m): m is Mail => !!m);
    const fehlt = ids.filter((id) => !this.cache.has(id));
    const vorher = [...bekannt.map((m) => structuredClone(m)), ...(fehlt.length ? await this.gmail.holeMetadaten(fehlt) : [])];
    this.letzte = vorher.map((m) => ({ id: m.id, vorher: [...m.labelIds], groesse: m.sizeEstimate ?? 0 }));
    if (a === 'papierkorb') this.platz(vorher.filter((m) => !m.labelIds.includes('TRASH')).reduce((s, m) => s + (m.sizeEstimate ?? 0), 0));
    await Promise.all(vorher.map(async (m) => {
      if (a === 'papierkorb') await this.gmail.trash(m.id);
      else if (a === 'archiv') await this.gmail.modify(m.id, [], ['INBOX']);
      else if (a === 'posteingang') { if (m.labelIds.includes('TRASH')) await this.gmail.untrash(m.id); await this.gmail.modify(m.id, ['INBOX'], ['SPAM']); }
      else if (a === 'stern') await this.gmail.modify(m.id, ['STARRED'], []);
      else if (a === 'sternWeg') await this.gmail.modify(m.id, [], ['STARRED']);
      else if (a === 'gelesen') await this.gmail.modify(m.id, [], ['UNREAD']);
      else if (a === 'ungelesen') await this.gmail.modify(m.id, ['UNREAD'], []);
      else await this.gmail.modify(m.id, [a.ordner], ['INBOX']);
      this.cache.delete(m.id); this.volle.delete(m.id);
    }));
  }

  /** Letzte Aktion zurücknehmen – Labels exakt wie vorher. */
  async rueckgaengig(): Promise<number> {
    let n = 0;
    for (const { id, vorher, groesse } of this.letzte) {
      let [ist] = await this.gmail.holeMetadaten([id]);
      if (!ist) continue;
      if (ist.labelIds.includes('TRASH') && !vorher.includes('TRASH')) { await this.gmail.untrash(id); this.platz(-(groesse ?? 0)); [ist] = await this.gmail.holeMetadaten([id]); }
      const add = vorher.filter((l) => !ist.labelIds.includes(l) && l !== 'TRASH');
      const rem = ist.labelIds.filter((l) => !vorher.includes(l) && l !== 'TRASH');
      if (add.length || rem.length) await this.gmail.modify(id, add, rem);
      this.cache.delete(id); n++;
    }
    this.letzte = [];
    return n;
  }

  /** Wie viele Mails liegen in einem Ordner (für die Rückfrage vor dem Löschen)? */
  async ordnerInhalt(id: string): Promise<{ name: string; gesamt: number; stern: number }> {
    if (!this.labelNamen.size) await this.ordner();
    const name = this.labelNamen.get(id) ?? id;
    const stern = (await this.alleIds(id, 'is:starred')).length;
    return { name, gesamt: (await this.gmail.labelInfo(id)).gesamt, stern };
  }

  private async alleIds(labelId: string, q = ''): Promise<string[]> {
    const ids: string[] = []; let token: string | undefined;
    do { const r = await this.gmail.listeOrdner(labelId, q, token, 500); ids.push(...r.ids); token = r.nextPageToken; } while (token);
    return [...new Set(ids)];
  }

  /**
   * Ordner löschen samt Inhalt: alle Mails in den Papierkorb (Gmail löscht erst nach 30 Tagen – bis dahin zurückholbar),
   * danach den Ordner selbst. Mails mit Stern bleiben unberührt (Sicherheitsregel). Nur eigene/Firmen-Ordner, nie System-Ordner.
   */
  async ordnerLoeschen(id: string, fortschritt: (erledigt: number, gesamt: number) => void = () => {}): Promise<{ name: string; papierkorb: string[]; stern: number; bytes?: number }> {
    if (/^[A-Z_]+$/.test(id)) throw new Error('System-Ordner (Posteingang, Gesendet …) kann man nicht löschen.');
    if (!this.labelNamen.size) await this.ordner();
    const name = this.labelNamen.get(id) ?? id;
    const ids = await this.alleIds(id, '-is:starred');
    const stern = (await this.alleIds(id, 'is:starred')).length;
    let bytes = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const teil = ids.slice(i, i + 100);
      for (const m of await this.gmail.holeMetadaten(teil)) bytes += m.sizeEstimate ?? 0; // für „Platz frei gemacht“
      for (let k = 0; k < teil.length; k++) { await this.gmail.trash(teil[k]); this.cache.delete(teil[k]); if ((i + k) % 10 === 9 || i + k === ids.length - 1) fortschritt(i + k + 1, ids.length); }
    }
    this.platz(bytes);
    if (this.gmail.labelLoeschen) await this.gmail.labelLoeschen(id);
    return { name, papierkorb: ids, stern, bytes };
  }

  /** Gelöschten Ordner zurückholen: Ordner neu anlegen, Mails aus dem Papierkorb holen und wieder hineinlegen. */
  async ordnerWiederherstellen(name: string, ids: string[]): Promise<number> {
    let id: string;
    try { id = await this.gmail.labelAnlegen(name); } catch { id = (await this.gmail.labels()).find((l) => l.name === name)?.id ?? ''; }
    let n = 0;
    for (const m of ids) { try { await this.gmail.untrash(m); if (id) await this.gmail.modify(m, [id], []); n++; } catch { /* endgültig weg */ } }
    return n;
  }

  /** Neuen eigenen Ordner anlegen. */
  async ordnerAnlegen(name: string): Promise<string> {
    const sauber = name.trim().replace(/[\\]/g, ' ');
    if (!sauber) throw new Error('Name fehlt.');
    return this.gmail.labelAnlegen(sauber);
  }
}
