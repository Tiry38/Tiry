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
  history(startHistoryId: string, pageToken?: string): Promise<{ neueIds: string[]; historyId: string; nextPageToken?: string }>;
  modify(id: string, add: string[], remove: string[]): Promise<void>;
  batchModify(ids: string[], add: string[], remove: string[]): Promise<void>;
  trash(id: string): Promise<void>;
  untrash(id: string): Promise<void>;
  labels(): Promise<Array<{ id: string; name: string }>>;
  labelAnlegen(name: string): Promise<string>;
  filterListe(): Promise<Array<{ id: string; criteria: FilterKriterien; action: FilterAktion }>>;
  filterAnlegen(criteria: FilterKriterien, action: FilterAktion): Promise<string>;
  filterLoeschen(id: string): Promise<void>;
  /** Für Abmelden per mailto: (RFC 2369). raw = komplette RFC-822-Nachricht. */
  sendeMail(raw: string): Promise<void>;
}

export const METADATEN_HEADER = [
  'From', 'To', 'Cc', 'Bcc', 'Subject', 'Date', 'Reply-To', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'Precedence',
  'Authentication-Results', 'List-Id',
];

/** Quoten-Einheiten laut Gmail-API-Doku (pro Methode). */
export const QUOTE: Record<string, number> = {
  getProfile: 1, 'messages.list': 5, 'messages.get': 5, 'history.list': 2, 'messages.modify': 5, 'messages.batchModify': 50,
  'messages.trash': 5, 'messages.untrash': 5, 'labels.list': 1, 'labels.create': 5, 'filters.list': 1, 'filters.create': 5,
  'filters.delete': 5, 'messages.send': 100,
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

export async function mitBackoff<T>(fn: () => Promise<T>, opt: { versuche?: number; basisMs?: number; warte?: (ms: number) => Promise<void>; log?: (s: string) => void } = {}): Promise<T> {
  const versuche = opt.versuche ?? 6;
  const basis = opt.basisMs ?? 1000;
  const warte = opt.warte ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      if (i >= versuche - 1 || !wiederholbar(err)) throw err;
      const ms = Math.min(64_000, basis * 2 ** i) + Math.floor(Math.random() * 500);
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

/** Echte Umsetzung über das offizielle googleapis-Paket. */
export function erzeugeGoogleGmail(auth: any, zaehle: (methode: string, einheiten: number) => void, log?: (s: string) => void): GmailPort {
  // Lazy-Import, damit Tests ohne googleapis-Initialisierung laufen.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { google } = require('googleapis') as typeof import('googleapis');
  const gmail = google.gmail({ version: 'v1', auth });
  const me = 'me';
  const ruf = async <T>(methode: string, fn: () => Promise<T>): Promise<T> =>
    mitBackoff(async () => { zaehle(methode, QUOTE[methode] ?? 5); return fn(); }, { log });

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
        const r = await ruf('history.list', () => gmail.users.history.list({ userId: me, startHistoryId, pageToken, historyTypes: ['messageAdded'], maxResults: 500 }));
        const ids: string[] = [];
        for (const h of r.data.history ?? []) for (const a of h.messagesAdded ?? []) if (a.message?.id) ids.push(a.message.id);
        return { neueIds: [...new Set(ids)], historyId: String(r.data.historyId ?? startHistoryId), nextPageToken: r.data.nextPageToken ?? undefined };
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
    async sendeMail(raw) {
      const b64 = Buffer.from(raw, 'utf8').toString('base64url');
      await ruf('messages.send', () => gmail.users.messages.send({ userId: me, requestBody: { raw: b64 } }));
    },
  };
}
