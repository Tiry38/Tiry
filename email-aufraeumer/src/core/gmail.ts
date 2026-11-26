// Gmail-Anbindung: schmale Schnittstelle (GmailPort) + Umsetzung mit googleapis,
// exponentiellem Backoff bei 429/5xx und Quoten-Zähler.
import type { Mail } from './types';

export class HistoryZuAlt extends Error { constructor() { super('historyId zu alt (404)'); } }

export interface FilterKriterien { from?: string; query?: string; negatedQuery?: string }
export interface FilterAktion { addLabelIds?: string[]; removeLabelIds?: string[] }

export interface GmailPort {
  profil(): Promise<{ email: string; historyId: string }>;
  liste(q: string, pageToken?: string, max?: number): Promise<{ ids: string[]; nextPageToken?: string }>;
  holeMetadaten(ids: string[]): Promise<Mail[]>;
  /** neueIds = neu angekommene Mails; geaendert = irgendetwas im Postfach hat sich geändert (gelesen, verschoben, gelöscht …). */
  history(startHistoryId: string, pageToken?: string): Promise<{ neueIds: string[]; historyId: string; nextPageToken?: string; geaendert?: boolean }>;
  modify(id: string, add: string[], remove: string[]): Promise<void>;
  batchModify(ids: string[], add: string[], remove: string[]): Promise<void>;
  trash(id: string): Promise<void>;
  untrash(id: string): Promise<void>;
  labels(): Promise<Array<{ id: string; name: string }>>;
  labelAnlegen(name: string): Promise<string>;
  filterListe(): Promise<Array<{ id: string; criteria: FilterKriterien; action: FilterAktion }>>;
  filterAnlegen(criteria: FilterKriterien, action: FilterAktion): Promise<string>;
  filterLoeschen(id: string): Promise<void>;
  /** Verschickt eine komplette RFC-822-Nachricht (Abmelden per mailto, Tirys eigene Mails). */
  sendeMail(raw: string, threadId?: string): Promise<void>;
  /** Postfach: Mails eines Ordners (Label) und/oder einer Suche, neueste zuerst. */
  listeOrdner(labelId: string | null, q: string, pageToken?: string, max?: number): Promise<{ ids: string[]; nextPageToken?: string; geschaetzt?: number }>;
  /** Ganze Mail (format: full) – roh, zerlegt wird in mime.ts. */
  holeVoll(id: string): Promise<any>;
  /** Anhang als Bytes. */
  anhang(mailId: string, anhangId: string): Promise<Uint8Array>;
  /** Ungelesene im Posteingang etc. */
  labelInfo(id: string): Promise<{ ungelesen: number; gesamt: number }>;
}

export const METADATEN_HEADER = [
  'From', 'To', 'Cc', 'Bcc', 'Subject', 'Date', 'Reply-To', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'Precedence',
  'Authentication-Results', 'List-Id',
];

/** Quoten-Einheiten laut Gmail-API-Doku (pro Methode). */
export const QUOTE: Record<string, number> = {
  getProfile: 1, 'messages.list': 5, 'messages.get': 5, 'history.list': 2, 'messages.modify': 5, 'messages.batchModify': 50,
  'messages.trash': 5, 'messages.untrash': 5, 'labels.list': 1, 'labels.create': 5, 'filters.list': 1, 'filters.create': 5,
  'filters.delete': 5, 'messages.send': 100, 'messages.attachments.get': 5, 'labels.get': 1,
};

export function wiederholbar(err: any): boolean {
  const status = err?.code ?? err?.status ?? err?.response?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true;
  if (status === 403) {
    const reason = err?.errors?.[0]?.reason ?? err?.response?.data?.error?.errors?.[0]?.reason;
    return reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
  }
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(err?.code);
}

/** Wartezeit, die Google selbst vorgibt (Retry-After-Header), in ms. */
export function retryAfterMs(err: any): number | null {
  const h = err?.response?.headers;
  const v = h?.get?.('retry-after') ?? h?.['retry-after'];
  if (v == null) return null;
  const sek = Number(v);
  if (Number.isFinite(sek)) return sek * 1000;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

export async function mitBackoff<T>(fn: () => Promise<T>, opt: { versuche?: number; basisMs?: number; warte?: (ms: number) => Promise<void>; log?: (s: string) => void } = {}): Promise<T> {
  // 8 Versuche: 1+2+4+8+16+32+64 s ≈ 2 min – länger als Googles Minuten-Fenster für die Nutzer-Quote
  const versuche = opt.versuche ?? 8;
  const basis = opt.basisMs ?? 1000;
  const warte = opt.warte ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      if (i >= versuche - 1 || !wiederholbar(err)) throw err;
      const ms = Math.max(retryAfterMs(err) ?? 0, Math.min(64_000, basis * 2 ** i)) + Math.floor(Math.random() * 500);
      opt.log?.(`API-Grenze/Fehler (${(err as any)?.code ?? (err as any)?.status}) – neuer Versuch in ${Math.round(ms / 1000)} s`);
      await warte(ms);
    }
  }
}

export function zuMail(m: any): Mail {
  const headers: Record<string, string> = {};
  for (const h of m.payload?.headers ?? []) {
    const k = String(h.name).toLowerCase();
    // Authentication-Results: nur den obersten (von Google gesetzten) behalten
    if (headers[k] === undefined) headers[k] = String(h.value ?? '');
  }
  return {
    id: m.id, threadId: m.threadId, labelIds: m.labelIds ?? [], snippet: m.snippet ?? '',
    internalDate: Number(m.internalDate ?? 0), sizeEstimate: m.sizeEstimate, headers,
  };
}

/**
 * Drossel (Token-Eimer): höchstens `proSekunde` Quoten-Einheiten pro Sekunde.
 * Gmail begrenzt die Einheiten pro Nutzer und Minute – die Drossel hält das Programm von sich aus deutlich darunter.
 */
export class Drossel {
  private vorrat: number;
  private stand: number;
  constructor(private proSekunde = 50, private eimer = 250, private jetzt: () => number = Date.now,
    private warte: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
    this.vorrat = eimer; this.stand = jetzt();
  }
  private auffuellen() {
    const t = this.jetzt();
    this.vorrat = Math.min(this.eimer, this.vorrat + ((t - this.stand) / 1000) * this.proSekunde);
    this.stand = t;
  }
  private kette: Promise<void> = Promise.resolve();
  /** Wartet, bis `einheiten` verfügbar sind (Aufrufe werden der Reihe nach bedient). */
  nimm(einheiten: number): Promise<void> {
    const schritt = this.kette.then(async () => {
      this.auffuellen();
      while (this.vorrat < einheiten) {
        await this.warte(Math.ceil(((einheiten - this.vorrat) / this.proSekunde) * 1000));
        this.auffuellen();
      }
      this.vorrat -= einheiten;
    });
    this.kette = schritt.catch(() => {});
    return schritt;
  }
}

/** Echte Umsetzung über das offizielle googleapis-Paket. */
export function erzeugeGoogleGmail(auth: any, zaehle: (methode: string, einheiten: number) => void, log?: (s: string) => void): GmailPort {
  // Lazy-Import, damit Tests ohne googleapis-Initialisierung laufen.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { google } = require('googleapis') as typeof import('googleapis');
  const gmail = google.gmail({ version: 'v1', auth });
  const me = 'me';
  // 150 Einheiten/s: zügig fürs ganze Postfach, aber unter Googles Nutzer-Grenze; 429 fängt zusätzlich der Backoff ab
  const drossel = new Drossel(150, 300);
  const ruf = async <T>(methode: string, fn: () => Promise<T>): Promise<T> =>
    mitBackoff(async () => {
      const e = QUOTE[methode] ?? 5;
      await drossel.nimm(e);
      zaehle(methode, e);
      return fn();
    }, { log });

  async function parallel<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await f(items[k]); }
    }));
    return out;
  }

  return {
    async profil() {
      const r = await ruf('getProfile', () => gmail.users.getProfile({ userId: me }));
      return { email: r.data.emailAddress ?? '', historyId: String(r.data.historyId ?? '') };
    },
    async liste(q, pageToken, max = 100) {
      const r = await ruf('messages.list', () => gmail.users.messages.list({ userId: me, q, pageToken, maxResults: max, includeSpamTrash: false }));
      return { ids: (r.data.messages ?? []).map((m) => m.id!), nextPageToken: r.data.nextPageToken ?? undefined };
    },
    async holeMetadaten(ids) {
      // höchstens 8 gleichzeitig – schont die Nutzer-Quote, 429 wird zusätzlich per Backoff abgefangen.
      const mails = await parallel(ids, 8, async (id) => {
        try {
          const r = await ruf('messages.get', () => gmail.users.messages.get({ userId: me, id, format: 'metadata', metadataHeaders: METADATEN_HEADER }));
          return zuMail(r.data);
        } catch (err: any) {
          if (err?.code === 404 || err?.status === 404) return null; // inzwischen gelöscht
          throw err;
        }
      });
      return mails.filter((m): m is Mail => !!m);
    },
    async history(startHistoryId, pageToken) {
      try {
        const r = await ruf('history.list', () => gmail.users.history.list({ userId: me, startHistoryId, pageToken, maxResults: 500 }));
        const ids: string[] = [];
        for (const h of r.data.history ?? []) for (const a of h.messagesAdded ?? []) if (a.message?.id) ids.push(a.message.id);
        return { neueIds: [...new Set(ids)], historyId: String(r.data.historyId ?? startHistoryId), nextPageToken: r.data.nextPageToken ?? undefined, geaendert: (r.data.history ?? []).length > 0 };
      } catch (err: any) {
        if (err?.code === 404 || err?.status === 404) throw new HistoryZuAlt();
        throw err;
      }
    },
    async modify(id, add, remove) {
      await ruf('messages.modify', () => gmail.users.messages.modify({ userId: me, id, requestBody: { addLabelIds: add, removeLabelIds: remove } }));
    },
    async batchModify(ids, add, remove) {
      for (let i = 0; i < ids.length; i += 1000) {
        const teil = ids.slice(i, i + 1000);
        await ruf('messages.batchModify', () => gmail.users.messages.batchModify({ userId: me, requestBody: { ids: teil, addLabelIds: add, removeLabelIds: remove } }));
      }
    },
    async trash(id) { await ruf('messages.trash', () => gmail.users.messages.trash({ userId: me, id })); },
    async untrash(id) { await ruf('messages.untrash', () => gmail.users.messages.untrash({ userId: me, id })); },
    async labels() {
      const r = await ruf('labels.list', () => gmail.users.labels.list({ userId: me }));
      return (r.data.labels ?? []).map((l) => ({ id: l.id!, name: l.name! }));
    },
    async labelAnlegen(name) {
      const r = await ruf('labels.create', () => gmail.users.labels.create({ userId: me, requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } }));
      return r.data.id!;
    },
    async filterListe() {
      const r = await ruf('filters.list', () => gmail.users.settings.filters.list({ userId: me }));
      return (r.data.filter ?? []).map((f) => ({ id: f.id!, criteria: (f.criteria ?? {}) as FilterKriterien, action: (f.action ?? {}) as FilterAktion }));
    },
    async filterAnlegen(criteria, action) {
      const r = await ruf('filters.create', () => gmail.users.settings.filters.create({ userId: me, requestBody: { criteria, action } }));
      return r.data.id!;
    },
    async filterLoeschen(id) { await ruf('filters.delete', () => gmail.users.settings.filters.delete({ userId: me, id })); },
    async sendeMail(raw, threadId) {
      const b64 = Buffer.from(raw, 'utf8').toString('base64url');
      await ruf('messages.send', () => gmail.users.messages.send({ userId: me, requestBody: { raw: b64, threadId } }));
    },
    async listeOrdner(labelId, q, pageToken, max = 50) {
      const r = await ruf('messages.list', () => gmail.users.messages.list({ userId: me, labelIds: labelId ? [labelId] : undefined, q: q || undefined,
        pageToken, maxResults: max, includeSpamTrash: labelId === 'TRASH' || labelId === 'SPAM' }));
      return { ids: (r.data.messages ?? []).map((m) => m.id!), nextPageToken: r.data.nextPageToken ?? undefined, geschaetzt: r.data.resultSizeEstimate ?? undefined };
    },
    async holeVoll(id) {
      const r = await ruf('messages.get', () => gmail.users.messages.get({ userId: me, id, format: 'full' }));
      return r.data;
    },
    async anhang(mailId, anhangId) {
      const r = await ruf('messages.attachments.get', () => gmail.users.messages.attachments.get({ userId: me, messageId: mailId, id: anhangId }));
      return new Uint8Array(Buffer.from(String(r.data.data ?? '').replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    },
    async labelInfo(id) {
      const r = await ruf('labels.get', () => gmail.users.labels.get({ userId: me, id }));
      return { ungelesen: r.data.messagesUnread ?? 0, gesamt: r.data.messagesTotal ?? 0 };
    },
  };
}
