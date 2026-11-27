// Aktionen ausführen (oder im Trockenlauf nur protokollieren) und exakt rückgängig machen.
import type { Aktion, Entscheidung, Kategorie, Mail, ProtokollEintrag, Signale } from './types';
import { KATEGORIE_NAME } from './types';
import type { GmailPort } from './gmail';
import type { Speicher } from './db';
import { abmelden, type HttpPost } from './unsubscribe';

export const LABEL_PREFIX = 'Aufräumer';
export const RUECKGAENGIG_TAGE = 30;

export interface Plan {
  aktionen: Aktion[];
  add: string[];      // Label-Namen (nicht IDs) bzw. System-IDs
  remove: string[];
  papierkorb: boolean;
  abmelden: boolean;
}

/** Leitet aus den eingestellten Aktionen den konkreten Plan ab. Wirkt nur auf Label-Ebene, nichts wird gelöscht. */
export function planeAktionen(kategorie: Kategorie, aktionen: Aktion[], mail: Mail, s: Signale, opt: { abmeldenErlaubt: boolean }): Plan {
  const a = new Set(aktionen);
  const plan: Plan = { aktionen: [], add: [], remove: [], papierkorb: false, abmelden: false };
  if (a.has('behalten') || a.size === 0) { plan.aktionen = ['behalten']; return plan; }
  if (a.has('papierkorb')) {
    plan.papierkorb = true; plan.aktionen.push('papierkorb');
  } else {
    if (a.has('label')) { plan.add.push(`${LABEL_PREFIX}/${KATEGORIE_NAME[kategorie]}`); plan.aktionen.push('label'); }
    if (a.has('archivieren') && mail.labelIds.includes('INBOX')) { plan.remove.push('INBOX'); plan.aktionen.push('archivieren'); }
    if (a.has('gelesen') && mail.labelIds.includes('UNREAD')) { plan.remove.push('UNREAD'); plan.aktionen.push('gelesen'); }
  }
  // Abmelden: nie bei Phishing, nur mit Header und nur, wenn erlaubt (z. B. Absender wird nie geöffnet)
  if (a.has('abmelden') && kategorie !== 'phishing' && s.listUnsubscribe && opt.abmeldenErlaubt) {
    plan.abmelden = true; plan.aktionen.push('abmelden');
  }
  if (!plan.aktionen.length) plan.aktionen = ['behalten'];
  return plan;
}

export class Ausfuehrer {
  private labelCache = new Map<string, string>();

  constructor(private gmail: GmailPort, private db: Speicher, private opt: { eigeneAdresse: () => string; post?: HttpPost; log?: (s: string) => void } ) {}

  async labelId(name: string): Promise<string> {
    if (/^[A-Z_]+$/.test(name)) return name; // System-Label wie INBOX/UNREAD
    if (this.labelCache.has(name)) return this.labelCache.get(name)!;
    const alle = await this.gmail.labels();
    for (const l of alle) this.labelCache.set(l.name, l.id);
    if (!this.labelCache.has(name)) {
      // Elternlabel zuerst, damit Gmail die Ordnerstruktur sauber anzeigt
      if (name.includes('/') && !this.labelCache.has(LABEL_PREFIX)) {
        try { this.labelCache.set(LABEL_PREFIX, await this.gmail.labelAnlegen(LABEL_PREFIX)); } catch { /* existiert evtl. schon */ }
      }
      this.labelCache.set(name, await this.gmail.labelAnlegen(name));
    }
    return this.labelCache.get(name)!;
  }

  /** Führt den Plan aus bzw. protokolliert ihn im Trockenlauf. Gibt die Protokoll-ID zurück. */
  async ausfuehren(mail: Mail, s: Signale, e: Entscheidung, plan: Plan, kontext: { durchlauf: string; trocken: boolean; zeit?: number }): Promise<number> {
    const zeit = kontext.zeit ?? Date.now();
    const vorher = [...mail.labelIds];
    let nachher = [...vorher];
    const hinweise: string[] = [];
    let status: ProtokollEintrag['status'] = 'ok';

    if (plan.aktionen.length === 1 && plan.aktionen[0] === 'behalten') {
      // nichts zu tun
    } else if (kontext.trocken) {
      nachher = simuliere(vorher, plan);
      hinweise.push('Trockenlauf – nichts verändert.');
    } else {
      try {
        if (plan.papierkorb) {
          await this.gmail.trash(mail.id);
          this.db.platzMerken(mail.sizeEstimate ?? 0);
          nachher = simuliere(vorher, plan);
        } else if (plan.add.length || plan.remove.length) {
          const add = await Promise.all(plan.add.map((n) => this.labelId(n)));
          await this.gmail.modify(mail.id, add, plan.remove);
          nachher = [...new Set([...vorher.filter((l) => !plan.remove.includes(l)), ...add])];
        }
        if (plan.abmelden && !this.db.istAbgemeldet(s.absender)) {
          const r = await abmelden(s.listUnsubscribe, { gmail: this.gmail, eigeneAdresse: this.opt.eigeneAdresse(), phishing: e.kategorie === 'phishing', post: this.opt.post });
          if (r.ok) { this.db.absenderAbgemeldet(s.absender, zeit); hinweise.push(`Abgemeldet per ${r.weg} (${r.ziel}) – lässt sich nicht rückgängig machen.`); }
          else hinweise.push(`Nicht abgemeldet: ${r.grund}`);
        }
      } catch (err) {
        status = 'fehler';
        hinweise.push(`Fehler: ${(err as Error).message}`);
        this.opt.log?.(`Aktion für ${mail.id} fehlgeschlagen: ${(err as Error).message}`);
      }
    }

    return this.db.protokolliere({
      zeit, durchlauf: kontext.durchlauf, mailId: mail.id, absender: s.absender, betreff: s.betreff,
      kategorie: e.kategorie, sicherheit: e.sicherheit, stufe: e.stufe, begruendung: e.begruendung,
      aktionen: plan.aktionen, trocken: kontext.trocken, vorherLabels: vorher, nachherLabels: nachher, status,
      hinweis: hinweise.join(' ') || null,
    });
  }

  /**
   * Stapel-Ausführung (Altbestand): gleiche Label-Änderungen werden per messages.batchModify
   * in einem Aufruf erledigt (bis 1000 Mails), Papierkorb und Abmelden einzeln.
   */
  async ausfuehrenStapel(posten: Array<{ mail: Mail; s: Signale; e: Entscheidung; plan: Plan }>, kontext: { durchlauf: string; trocken: boolean }): Promise<number[]> {
    const ids: number[] = [];
    const gruppen = new Map<string, typeof posten>();
    const einzeln: typeof posten = [];
    for (const p of posten) {
      const nurLabels = !p.plan.papierkorb && !p.plan.abmelden && (p.plan.add.length || p.plan.remove.length);
      if (kontext.trocken || !nurLabels) { einzeln.push(p); continue; }
      const k = `${p.plan.add.join(',')}|${p.plan.remove.join(',')}`;
      if (!gruppen.has(k)) gruppen.set(k, []);
      gruppen.get(k)!.push(p);
    }
    for (const gruppe of gruppen.values()) {
      const plan = gruppe[0].plan;
      let status: ProtokollEintrag['status'] = 'ok';
      let hinweis: string | null = `Stapel mit ${gruppe.length} Mails (batchModify).`;
      let add: string[] = [];
      try {
        add = await Promise.all(plan.add.map((n) => this.labelId(n)));
        await this.gmail.batchModify(gruppe.map((p) => p.mail.id), add, plan.remove);
      } catch (err) { status = 'fehler'; hinweis = `Fehler: ${(err as Error).message}`; }
      for (const p of gruppe) {
        const vorher = [...p.mail.labelIds];
        ids.push(this.db.protokolliere({
          zeit: Date.now(), durchlauf: kontext.durchlauf, mailId: p.mail.id, absender: p.s.absender, betreff: p.s.betreff,
          kategorie: p.e.kategorie, sicherheit: p.e.sicherheit, stufe: p.e.stufe, begruendung: p.e.begruendung, aktionen: p.plan.aktionen,
          trocken: false, vorherLabels: vorher,
          nachherLabels: status === 'ok' ? [...new Set([...vorher.filter((l) => !plan.remove.includes(l)), ...add])] : vorher,
          status, hinweis,
        }));
      }
    }
    for (const p of einzeln) ids.push(await this.ausfuehren(p.mail, p.s, p.e, p.plan, kontext));
    return ids;
  }

  /** Stellt Labels, Ordner und gelesen-Status exakt wie vorher her. */
  async rueckgaengig(id: number, jetzt = Date.now()): Promise<{ ok: boolean; grund?: string }> {
    const e = this.db.eintrag(id);
    if (!e) return { ok: false, grund: 'Eintrag nicht gefunden.' };
    if (e.rueckgaengig) return { ok: false, grund: 'Schon rückgängig gemacht.' };
    if (e.trocken) return { ok: false, grund: 'Trockenlauf – es wurde nichts verändert.' };
    if (e.status !== 'ok') return { ok: false, grund: 'Für diesen Eintrag wurde nichts verändert.' };
    if (jetzt - e.zeit > RUECKGAENGIG_TAGE * 86400_000) return { ok: false, grund: 'Älter als 30 Tage – Gmail hat den Papierkorb bereits geleert.' };
    if (e.aktionen.length === 1 && e.aktionen[0] === 'behalten') return { ok: false, grund: 'Es gab nichts rückgängig zu machen.' };

    let [aktuell] = await this.gmail.holeMetadaten([e.mailId]);
    if (!aktuell) return { ok: false, grund: 'Mail existiert nicht mehr in Gmail.' };
    if (aktuell.labelIds.includes('TRASH') && !e.vorherLabels.includes('TRASH')) {
      await this.gmail.untrash(e.mailId);
      this.db.platzMerken(-(aktuell.sizeEstimate ?? 0));
      [aktuell] = await this.gmail.holeMetadaten([e.mailId]);
    }
    const ist = new Set(aktuell.labelIds);
    const soll = new Set(e.vorherLabels);
    const add = [...soll].filter((l) => !ist.has(l) && l !== 'TRASH');
    const remove = [...ist].filter((l) => !soll.has(l) && l !== 'TRASH');
    if (add.length || remove.length) await this.gmail.modify(e.mailId, add, remove);
    this.db.markiereRueckgaengig(id, jetzt);
    return { ok: true };
  }

  async durchlaufRueckgaengig(durchlauf: string): Promise<{ ok: number; fehler: number }> {
    let ok = 0, fehler = 0;
    for (const e of this.db.protokoll({ durchlauf, limit: 100000 })) {
      if (e.trocken || e.rueckgaengig || e.status !== 'ok' || (e.aktionen.length === 1 && e.aktionen[0] === 'behalten')) continue;
      try { (await this.rueckgaengig(e.id)).ok ? ok++ : fehler++; } catch { fehler++; }
    }
    return { ok, fehler };
  }
}

/** Was ein Plan mit den Labels machen würde (für Trockenlauf und Papierkorb). */
export function simuliere(vorher: string[], plan: Plan): string[] {
  if (plan.papierkorb) return [...vorher.filter((l) => l !== 'INBOX'), 'TRASH'];
  return [...new Set([...vorher.filter((l) => !plan.remove.includes(l)), ...plan.add])];
}
