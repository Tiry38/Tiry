// Einordnungs-Pipeline: Schutz → Stufe 1 Signale → Stufe 2 Regeln → Stufe 3 KI (optional).
import type { Einstellungen, Entscheidung, Kategorie, Mail, Regel, Schutz, Signale } from './types';
import { KATEGORIE_NAME } from './types';
import { ermittleSignale, dringlichkeit } from './signals';
import { basisDomain } from './headers';

export interface KiEingabe { absender: string; name: string; betreff: string; snippet: string }
export interface KiAntwort { kategorie: Kategorie; sicherheit: number; begruendung: string; kostenUsd: number }
export interface KiPort { klassifiziere(e: KiEingabe): Promise<KiAntwort> }

export interface Kontext {
  einstellungen: Einstellungen;
  regeln: Regel[];
  istKontakt(adresse: string): boolean;
  historie(adresse: string): { anzahl: number; gelesen: number } | null;
  ki?: KiPort | null;
  /** Prüft das Monatsbudget und bucht die Kosten. false = Budget erschöpft. */
  kiBudget?: { frei(): boolean; buchen(usd: number): void };
}

export interface Ergebnis {
  signale: Signale;
  schutz: Schutz;
  entscheidung: Entscheidung;
}

function enthaelt(text: string, wort: string): boolean {
  return text.toLowerCase().includes(wort.toLowerCase());
}

/** Sicherheitsregel 3: diese Mails werden NIEMALS angefasst. */
export function pruefeSchutz(mail: Mail, s: Signale, ctx: Kontext): Schutz {
  if (mail.labelIds.includes('STARRED')) return { geschuetzt: true, grund: 'Mail ist markiert (Stern).' };
  if (s.absender && ctx.istKontakt(s.absender)) return { geschuetzt: true, grund: `Tiry hat ${s.absender} schon selbst geschrieben.` };
  for (const r of ctx.regeln) {
    if (!r.aktiv || r.art !== 'weiss') continue;
    if (passt(r, mail, s)) return { geschuetzt: true, grund: `Weiße Liste: ${beschreibeBedingung(r)}.` };
  }
  const text = `${s.betreff}\n${mail.snippet}\n${s.anzeigename}\n${s.absender}`;
  for (const w of ctx.einstellungen.schutzwoerter) {
    if (w.trim() && enthaelt(text, w.trim())) return { geschuetzt: true, grund: `Schutzwort „${w.trim()}“ in Betreff, Vorschau oder Absender.` };
  }
  return { geschuetzt: false, grund: null };
}

export function passt(r: Regel, mail: Mail, s: Signale): boolean {
  const w = r.wert.toLowerCase();
  if (r.feld === 'adresse') return s.absender === w;
  if (r.feld === 'domain') return s.domain === w || s.domain.endsWith('.' + w) || basisDomain(s.domain) === w;
  return enthaelt(`${s.betreff}\n${mail.snippet}`, w);
}

export function beschreibeBedingung(r: Regel): string {
  if (r.feld === 'adresse') return `Absender ${r.wert}`;
  if (r.feld === 'domain') return `Domain ${r.wert}`;
  return `Stichwort „${r.wert}“`;
}

/** Stufe 1: Einordnung allein aus Signalen. */
export function stufeSignale(mail: Mail, s: Signale): Entscheidung {
  const e = (kategorie: Kategorie, sicherheit: number, begruendung: string): Entscheidung =>
    ({ kategorie, sicherheit: Math.max(0, Math.min(100, sicherheit)), stufe: 'signale', begruendung });

  const dringend = dringlichkeit(`${s.betreff} ${mail.snippet}`);
  const gefaelscht = s.phishingMerkmale.length > 0;
  if (gefaelscht) {
    const verstaerkt = s.authFehler || dringend.length > 0 || s.replyToAndereDomain;
    if (verstaerkt) {
      const warum = [s.phishingMerkmale[0], s.authFehler ? 'Echtheitsprüfung (SPF/DKIM/DMARC) fehlgeschlagen' : null,
        dringend.length ? `Druck-Formulierung „${dringend[0]}“` : null, s.replyToAndereDomain ? 'Antwortadresse zeigt auf fremde Domain' : null]
        .filter(Boolean).join('; ');
      return e('phishing', 92 + Math.min(6, (s.phishingMerkmale.length - 1) * 3 + (s.authFehler ? 3 : 0)), `Phishing-Verdacht: ${warum}.`);
    }
    return e('phishing', 70, `Möglicher Betrug: ${s.phishingMerkmale[0]}.`);
  }
  if (s.gmailSpam) return e('spam', 95, 'Gmail hat die Mail selbst als Spam erkannt.');
  if (s.authFehler && !s.listUnsubscribe && dringend.length) {
    return e('spam', 88, `Echtheitsprüfung fehlgeschlagen und Druck-Formulierung „${dringend[0]}“.`);
  }
  if (s.authFehler && !s.listUnsubscribe) return e('spam', 65, 'Echtheitsprüfung (SPF/DKIM/DMARC) fehlgeschlagen.');

  const h = s.historie;
  const nieGelesen = !!h && h.anzahl >= 3 && h.gelesen === 0;
  const oftGelesen = !!h && h.anzahl >= 3 && h.gelesen / h.anzahl >= 0.5;
  const leseHinweis = nieGelesen ? ` Tiry hat keine der letzten ${h!.anzahl} Mails dieses Absenders geöffnet.` : '';

  if (s.kategorieLabel === 'promotions') {
    let sich = s.listUnsubscribe ? 90 : 82;
    if (nieGelesen) sich += 6;
    if (oftGelesen) sich -= 25;
    return e('werbung', sich, `Gmail-Kategorie „Werbung“${s.listUnsubscribe ? ' mit Abmelde-Header' : ''}.${leseHinweis}${oftGelesen ? ' Tiry öffnet diese Mails aber oft.' : ''}`);
  }
  if (s.kategorieLabel === 'social') {
    return e('benachrichtigung', oftGelesen ? 70 : 88, 'Gmail-Kategorie „Soziale Netzwerke“ – automatische Benachrichtigung.');
  }
  if (s.listUnsubscribe || s.bulk) {
    let sich = s.listUnsubscribe && s.bulk ? 90 : 86;
    if (nieGelesen) sich += 6;
    if (oftGelesen) sich -= 25;
    if (s.kategorieLabel === 'updates' && !s.bulk) {
      return e('benachrichtigung', oftGelesen ? 65 : 86, `Automatische Mitteilung mit Abmelde-Header (Gmail-Kategorie „Benachrichtigungen“).${leseHinweis}`);
    }
    return e('newsletter', sich, `Verteiler-Mail (${s.listUnsubscribe ? 'Abmelde-Header' : 'Precedence: bulk'}).${leseHinweis}${oftGelesen ? ' Tiry öffnet diese Mails aber oft.' : ''}`);
  }
  if (s.kategorieLabel === 'updates' || s.kategorieLabel === 'forums') {
    const noreply = /^(no-?reply|noreply|donotreply|do-not-reply|notification|benachrichtigung|info|service)@/i.test(s.absender);
    return e('benachrichtigung', noreply ? 88 : 75, `Gmail-Kategorie „${s.kategorieLabel === 'forums' ? 'Foren' : 'Benachrichtigungen'}“${noreply ? ' von einer No-Reply-Adresse' : ''}.`);
  }
  if (mail.labelIds.includes('IMPORTANT')) return e('wichtig', 75, 'Gmail stuft die Mail als wichtig ein, kein Verteiler.');
  return e('persoenlich', 60, 'Kein Verteiler-, Werbe- oder Spam-Merkmal – sieht nach persönlicher Mail aus.');
}

/** Stufe 2: Tirys Regeln (Schwarze Liste, gelernte Regeln). */
export function stufeRegeln(mail: Mail, s: Signale, regeln: Regel[]): Entscheidung | null {
  const treffer = regeln.filter((r) => r.aktiv && r.art !== 'weiss' && r.kategorie && passt(r, mail, s));
  if (!treffer.length) return null;
  // Genauere Regel gewinnt: Adresse vor Domain vor Stichwort; schwarz vor gelernt.
  const rang = (r: Regel) => (r.feld === 'adresse' ? 0 : r.feld === 'domain' ? 1 : 2) * 2 + (r.art === 'schwarz' ? 0 : 1);
  treffer.sort((a, b) => rang(a) - rang(b));
  const r = treffer[0];
  const sicherheit = r.art === 'schwarz' ? 99 : Math.min(98, 80 + 6 * r.bestaetigt);
  const quelle = r.art === 'schwarz' ? 'Schwarze Liste' : `Gelernte Regel (${r.bestaetigt}× von Tiry bestätigt)`;
  return { kategorie: r.kategorie!, sicherheit, stufe: 'regeln', regelId: r.id,
    begruendung: `${quelle}: ${beschreibeBedingung(r)} → ${KATEGORIE_NAME[r.kategorie!]}.` };
}

export async function ordneEin(mail: Mail, ctx: Kontext): Promise<Ergebnis> {
  const vorab = ermittleSignale(mail, null);
  const signale = ermittleSignale(mail, vorab.absender ? ctx.historie(vorab.absender) : null);
  const schutz = pruefeSchutz(mail, signale, ctx);
  if (schutz.geschuetzt) {
    // Die Kategorie wird trotzdem bestimmt (fürs Protokoll), angefasst wird nichts.
    const sig = stufeSignale(mail, signale);
    const kat: Kategorie = ctx.istKontakt(signale.absender) ? 'persoenlich' : 'wichtig';
    const hinweis = sig.kategorie === 'phishing' ? ` Achtung: ${sig.begruendung}` : '';
    return { signale, schutz, entscheidung: { kategorie: kat, sicherheit: 100, stufe: 'schutz', begruendung: `Geschützt – ${schutz.grund}${hinweis}` } };
  }

  let entscheidung = stufeSignale(mail, signale);
  const regel = stufeRegeln(mail, signale, ctx.regeln);
  if (regel) {
    // Phishing-Erkennung wird von „behalten“-Regeln nicht überstimmt (Weiße Liste ist der Weg zum Freigeben).
    if (!(entscheidung.kategorie === 'phishing' && entscheidung.sicherheit >= 90 && ['wichtig', 'persoenlich'].includes(regel.kategorie))) {
      entscheidung = regel;
    }
  }

  const schwelle = ctx.einstellungen.schwelle;
  if (entscheidung.sicherheit < schwelle && ctx.einstellungen.kiAn && ctx.ki && (!ctx.kiBudget || ctx.kiBudget.frei())) {
    try {
      const a = await ctx.ki.klassifiziere({ absender: signale.absender, name: signale.anzeigename, betreff: signale.betreff, snippet: mail.snippet });
      ctx.kiBudget?.buchen(a.kostenUsd);
      // Phishing aus Stufe 1 darf die KI nicht zu „harmlos“ umdeuten.
      if (!(entscheidung.kategorie === 'phishing' && a.kategorie !== 'phishing' && a.kategorie !== 'spam')) {
        entscheidung = { kategorie: a.kategorie, sicherheit: Math.max(0, Math.min(100, a.sicherheit)), stufe: 'ki', begruendung: `KI: ${a.begruendung}` };
      }
    } catch (err) {
      entscheidung = { ...entscheidung, begruendung: `${entscheidung.begruendung} (KI nicht erreichbar: ${(err as Error).message})` };
    }
  }
  return { signale, schutz, entscheidung };
}
