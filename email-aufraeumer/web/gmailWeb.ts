// Gmail direkt aus dem Browser (Handy-App): dieselbe Schnittstelle wie am PC (GmailPort),
// nur über fetch statt googleapis. Kein Server dazwischen – Mails gehen nur zwischen Handy und Google hin und her.
import type { GmailPort } from '../src/core/gmail';
import { zuMail, METADATEN_HEADER, Drossel } from '../src/core/gmail';
import { base64urlZuBytes, zerlegeVoll } from '../src/core/mime';
import type { Mail } from '../src/core/types';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class AnmeldungAbgelaufen extends Error { constructor() { super('Anmeldung abgelaufen'); } }

export function erzeugeWebGmail(token: () => string | null): GmailPort {
  const drossel = new Drossel(60, 150);
  const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Google erlaubt pro Nutzer und Minute nur eine bestimmte Menge – PC und Handy teilen sie sich.
  // Darum hält sich das Handy deutlich zurück (60 Einheiten/s) und wartet bei „Quota exceeded“ geduldig.
  const kostenVon = (pfad: string, m: string) => /\/send/.test(pfad) ? 100 : /batchModify/.test(pfad) ? 50 : /\/history/.test(pfad) ? 2 : /\/labels|\/profile/.test(pfad) && m === 'GET' ? 1 : /\/drafts/.test(pfad) ? (m === 'GET' ? 5 : 15) : 5;
  async function rufe(pfad: string, init: RequestInit = {}, basis = API): Promise<any> {
    await drossel.nimm(kostenVon(pfad, (init.method ?? 'GET').toUpperCase()));
    for (let i = 0; ; i++) {
      const t = token();
      if (!t) throw new AnmeldungAbgelaufen();
      const r = await fetch(basis + pfad, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.body && typeof init.body === 'string' && !(init.headers as any)?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
      if (r.status === 401) throw new AnmeldungAbgelaufen();
      if ((r.status === 429 || r.status >= 500 || r.status === 403) && i < 7) {
        const text = r.status !== 500 ? await r.clone().text() : '';
        if (r.status !== 403 || /rateLimit|quota/i.test(text)) {
          const nach = Number(r.headers.get('retry-after')) * 1000;
          await warte(Math.max(Number.isFinite(nach) ? nach : 0, Math.min(64_000, 1000 * 2 ** i)) + Math.random() * 500);
          continue;
        }
      }
      if (!r.ok) {
        let grund = `${r.status}`;
        try { const j = await r.json(); grund = j?.error?.message ?? grund; } catch { /* egal */ }
        throw Object.assign(new Error(grund), { code: r.status });
      }
      if (r.status === 204) return null;
      const typ = r.headers.get('content-type') ?? '';
      return typ.includes('json') ? r.json() : r.text();
    }
  }

  /** Viele Abrufe gleichzeitig, aber höchstens `n` auf einmal (schont die Google-Grenze). */
  async function parallel<T, R>(liste: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(liste.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, liste.length) }, async () => { while (i < liste.length) { const k = i++; out[k] = await f(liste[k]); } }));
    return out;
  }

  const kopfParam = METADATEN_HEADER.concat(['Content-Type', 'Message-ID', 'References']).map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join('&');

  const port: GmailPort = {
    async profil() { const p = await rufe('/profile'); return { email: p.emailAddress, historyId: String(p.historyId) }; },
    async liste(q, pageToken, max = 100) {
      const r = await rufe(`/messages?q=${encodeURIComponent(q)}&maxResults=${max}${pageToken ? `&pageToken=${pageToken}` : ''}`);
      return { ids: (r.messages ?? []).map((m: any) => m.id), nextPageToken: r.nextPageToken };
    },
    async holeMetadaten(ids) {
      const roh = await parallel(ids, 8, async (id) => { try { return await rufe(`/messages/${id}?format=metadata&${kopfParam}`); } catch (e: any) { if (e?.code === 404) return null; throw e; } });
      return roh.filter(Boolean).map(zuMail) as Mail[];
    },
    async history(start, pageToken) {
      const r = await rufe(`/history?startHistoryId=${start}${pageToken ? `&pageToken=${pageToken}` : ''}`);
      const neu = new Set<string>();
      for (const h of r.history ?? []) for (const x of h.messagesAdded ?? []) neu.add(x.message.id);
      return { neueIds: [...neu], historyId: String(r.historyId), nextPageToken: r.nextPageToken, geaendert: (r.history ?? []).length > 0 };
    },
    async modify(id, add, remove) { await rufe(`/messages/${id}/modify`, { method: 'POST', body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }) }); },
    async batchModify(ids, add, remove) { await rufe('/messages/batchModify', { method: 'POST', body: JSON.stringify({ ids, addLabelIds: add, removeLabelIds: remove }) }); },
    async trash(id) { await rufe(`/messages/${id}/trash`, { method: 'POST' }); },
    async untrash(id) { await rufe(`/messages/${id}/untrash`, { method: 'POST' }); },
    async labels() { const r = await rufe('/labels'); return (r.labels ?? []).map((l: any) => ({ id: l.id, name: l.name })); },
    async labelLoeschen(id) { await rufe(`/labels/${id}`, { method: 'DELETE' }); },
    async labelAnlegen(name) { const r = await rufe('/labels', { method: 'POST', body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) }); return r.id; },
    async filterListe() { throw new Error('Filter gibt es nur am PC.'); },
    async filterAnlegen() { throw new Error('Filter gibt es nur am PC.'); },
    async filterLoeschen() { throw new Error('Filter gibt es nur am PC.'); },
    async sendeMail(raw, threadId) {
      // Upload-Weg (bis 35 MB) statt JSON – so gehen auch Anhänge über 5 MB
      const grenze = `tmw${Date.now().toString(36)}`;
      const body = `--${grenze}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(threadId ? { threadId } : {})}\r\n--${grenze}\r\nContent-Type: message/rfc822\r\n\r\n${raw}\r\n--${grenze}--`;
      await rufe('/messages/send?uploadType=multipart', { method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${grenze}` } }, 'https://gmail.googleapis.com/upload/gmail/v1/users/me');
    },
    async listeOrdner(labelId, q, pageToken, max = 50) {
      const r = await rufe(`/messages?maxResults=${max}${labelId ? `&labelIds=${labelId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}${pageToken ? `&pageToken=${pageToken}` : ''}`);
      return { ids: (r.messages ?? []).map((m: any) => m.id), nextPageToken: r.nextPageToken, geschaetzt: r.resultSizeEstimate };
    },
    async holeVoll(id) { return rufe(`/messages/${id}?format=full`); },
    async anhang(mailId, anhangId) { const r = await rufe(`/messages/${mailId}/attachments/${anhangId}`); return base64urlZuBytes(r.data ?? ''); },
    async entwurfDatei(betreff) {
      const l = await rufe(`/drafts?maxResults=5&q=${encodeURIComponent(`subject:"${betreff.split('(')[0].trim()}"`)}`);
      const id = l.drafts?.[0]?.id; if (!id) return null;
      const d = await rufe(`/drafts/${id}?format=full`);
      const such = (p: any): any => { if (!p) return null; if (p.filename === 'daten.json') return p; for (const k of p.parts ?? []) { const t = such(k); if (t) return t; } return null; };
      const teil = such(d.message?.payload); if (!teil) return null;
      let daten: string | undefined = teil.body?.data;
      if (!daten && teil.body?.attachmentId) daten = (await rufe(`/messages/${d.message.id}/attachments/${teil.body.attachmentId}`)).data;
      return daten ? new TextDecoder().decode(base64urlZuBytes(daten)) : null;
    },
    async standSpeichern(raw, draftId) {
      // Entwurf anlegen/ersetzen (Upload-Weg, damit auch große Daten passen)
      const grenze = `tmw${Date.now().toString(36)}`;
      const meta = draftId ? { id: draftId, message: {} } : { message: {} };
      const body = `--${grenze}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${grenze}\r\nContent-Type: message/rfc822\r\n\r\n${raw}\r\n--${grenze}--`;
      const basis = 'https://gmail.googleapis.com/upload/gmail/v1/users/me';
      const kopf = { 'Content-Type': `multipart/related; boundary=${grenze}` };
      if (draftId) {
        try { await rufe(`/drafts/${draftId}?uploadType=multipart`, { method: 'PUT', body, headers: kopf }, basis); return draftId; }
        catch (e: any) { if (e?.code !== 404) throw e; }
      }
      const r = await rufe('/drafts?uploadType=multipart', { method: 'POST', body, headers: kopf }, basis);
      return r.id;
    },
    async standText(betreff) {
      const l = await rufe(`/drafts?maxResults=5&q=${encodeURIComponent(`subject:"${betreff.split('(')[0].trim()}"`)}`);
      const id = l.drafts?.[0]?.id;
      if (!id) return null;
      const d = await rufe(`/drafts/${id}?format=full`);
      const v = zerlegeVoll(d.message);
      return v.text ?? null;
    },
    async labelInfo(id) { const r = await rufe(`/labels/${id}`); return { ungelesen: r.messagesUnread ?? 0, gesamt: r.messagesTotal ?? 0 }; },
  };
  return port;
}
