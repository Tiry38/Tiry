// Gmail im Arbeitsspeicher: für Tests und den Demo-Modus (bildet Labels, Papierkorb und History nach).
import type { GmailPort, FilterAktion, FilterKriterien } from './gmail';
import { HistoryZuAlt } from './gmail';
import type { Mail } from './types';

export class SpeicherGmail implements GmailPort {
  mails = new Map<string, Mail>();
  labelListe: Array<{ id: string; name: string }> = [];
  filter: Array<{ id: string; criteria: FilterKriterien; action: FilterAktion }> = [];
  gesendet: string[] = [];
  aufrufe: string[] = [];
  historyId = 100;
  verlauf: Array<{ h: number; id: string }> = [];
  historyZuAlt = false;
  email = 'tiry@gmail.com';

  hinzufuegen(m: Mail, neu = true) {
    this.mails.set(m.id, structuredClone(m));
    if (neu) { this.historyId++; this.verlauf.push({ h: this.historyId, id: m.id }); }
  }
  get(id: string) { return this.mails.get(id)!; }

  async profil() { this.aufrufe.push('profil'); return { email: this.email, historyId: String(this.historyId) }; }
  async liste(q: string, pageToken?: string, max = 100) {
    this.aufrufe.push(`liste:${q}`);
    let alle = [...this.mails.values()];
    if (/(^|\s)in:sent/.test(q)) alle = alle.filter((m) => m.labelIds.includes('SENT'));
    else if (/(^|\s)in:inbox/.test(q)) alle = alle.filter((m) => m.labelIds.includes('INBOX'));
    else alle = alle.filter((m) => !m.labelIds.includes('SENT') && !m.labelIds.includes('TRASH'));
    const start = pageToken ? Number(pageToken) : 0;
    const ids = alle.slice(start, start + max).map((m) => m.id);
    return { ids, nextPageToken: start + max < alle.length ? String(start + max) : undefined };
  }
  async holeMetadaten(ids: string[]) { this.aufrufe.push(`get:${ids.length}`); return ids.map((i) => this.mails.get(i)).filter(Boolean).map((m) => structuredClone(m!)); }
  async history(start: string) {
    this.aufrufe.push('history');
    if (this.historyZuAlt) throw new HistoryZuAlt();
    const ids = this.verlauf.filter((v) => v.h > Number(start)).map((v) => v.id);
    return { neueIds: ids, historyId: String(this.historyId) };
  }
  async modify(id: string, add: string[], remove: string[]) {
    this.aufrufe.push(`modify:${id}`);
    const m = this.mails.get(id)!;
    m.labelIds = [...new Set([...m.labelIds.filter((l) => !remove.includes(l)), ...add])];
  }
  async batchModify(ids: string[], add: string[], remove: string[]) {
    this.aufrufe.push(`batchModify:${ids.length}`);
    for (const id of ids) { const m = this.mails.get(id)!; m.labelIds = [...new Set([...m.labelIds.filter((l) => !remove.includes(l)), ...add])]; }
  }
  // Wie Gmail: Papierkorb setzt TRASH und nimmt INBOX weg; untrash nimmt TRASH weg (INBOX kommt nicht automatisch zurück)
  async trash(id: string) { this.aufrufe.push(`trash:${id}`); const m = this.mails.get(id)!; m.labelIds = [...m.labelIds.filter((l) => l !== 'INBOX'), 'TRASH']; }
  async untrash(id: string) { this.aufrufe.push(`untrash:${id}`); const m = this.mails.get(id)!; m.labelIds = m.labelIds.filter((l) => l !== 'TRASH'); }
  async labels() { return [...this.labelListe]; }
  async labelAnlegen(name: string) {
    if (this.labelListe.some((l) => l.name === name)) throw new Error('exists');
    const id = `Label_${this.labelListe.length + 1}`; this.labelListe.push({ id, name }); return id;
  }
  async filterListe() { return [...this.filter]; }
  async filterAnlegen(criteria: FilterKriterien, action: FilterAktion) { const id = `f${this.filter.length + 1}`; this.filter.push({ id, criteria, action }); return id; }
  async filterLoeschen(id: string) { this.filter = this.filter.filter((f) => f.id !== id); }
  async sendeMail(raw: string) { this.gesendet.push(raw); }
}
