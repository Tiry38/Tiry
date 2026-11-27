// „Stand“ des Aufräumers für die Handy-App: der PC legt alle paar Minuten eine kleine Übersicht
// (Zahlen, letzte Aktionen, Altbestand, Firmen-Ordner) als EINEN Gmail-Entwurf ab und aktualisiert ihn.
// Das Handy liest ihn – so sieht es dieselben Zahlen wie das Cockpit am PC, ohne eigenen Server.
import type { Kategorie, ProtokollEintrag } from './types';

export const STAND_BETREFF = "Tiry's Mails · Stand vom Aufräumer (bitte nicht löschen)";
const ANFANG = '----- TIRYS-MAILS-STAND -----';
const ENDE = '----- ENDE -----';

export interface Stand {
  v: 1;
  zeit: number;
  status: string;            // laeuft | trockenlauf | fehler | startet …
  heute: Record<string, { echt: number; probe: number }>; // je Fach: wichtig, persoenlich, benachrichtigung, newsletter, werbung, muell
  statistik: { heuteEntfernt: number; wocheEntfernt: number; gesamtEntfernt: number; heuteGeprueft: number; lesezeitMinutenWoche: number; zuPruefen: number; platzGesamt?: number; platzWoche?: number; platzHeute?: number };
  letzte: Array<{ zeit: number; absender: string; betreff: string; kategorie: Kategorie; ziel: 'papierkorb' | 'archiv' | 'ordner' | 'bleibt' | 'pruefen' | 'geschuetzt'; ordner?: string; trocken: boolean }>;
  altbestand: { phase: string; gesamt: number; erledigt: number; geschafft?: { papierkorb: number; archiv: number; ordner: number; freiBytes: number } } | null;
  ordner: Array<{ name: string; anzahl: number }>;
  gmailRegeln: number;
}

export const fachVon = (k: Kategorie): string => (k === 'spam' || k === 'phishing' ? 'muell' : k);

/** Aus einem Verlaufs-Eintrag: wohin ist die Mail gegangen? */
export function zielVon(e: ProtokollEintrag): { ziel: Stand['letzte'][number]['ziel']; ordner?: string } {
  if (e.status === 'zu_pruefen') return { ziel: 'pruefen' };
  if (e.status === 'geschuetzt') return { ziel: 'geschuetzt' };
  if (e.aktionen.includes('papierkorb')) return { ziel: 'papierkorb' };
  const ordner = /Ordner „([^“]+)“/.exec(e.begruendung)?.[1];
  if (ordner) return { ziel: 'ordner', ordner };
  if (e.aktionen.includes('archivieren')) return { ziel: 'archiv' };
  return { ziel: 'bleibt' };
}

/** Als RFC-822-Nachricht (für drafts.create/update). Base64 hält die Daten sauber, egal welche Umlaute. */
export function standNachricht(s: Stand, an: string): string {
  const json = JSON.stringify(s);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/.{76}/g, '$&\n');
  const text = `Diesen Entwurf schreibt dein PC-Programm Tiry's Mails – die Handy-App liest daraus die Aufräum-Übersicht.\nBitte nicht löschen und nicht absenden (er wird von selbst aktuell gehalten).\n\n${ANFANG}\n${b64}\n${ENDE}\n`;
  return [`To: ${an}`, `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(STAND_BETREFF)))}?=`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', text].join('\r\n');
}

/** Liest den Stand aus dem Text des Entwurfs. */
export function standLesen(text: string): Stand | null {
  const i = text.indexOf(ANFANG), j = text.indexOf(ENDE);
  if (i < 0 || j < i) return null;
  try {
    const bin = atob(text.slice(i + ANFANG.length, j).replace(/\s+/g, ''));
    const s = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return s?.v === 1 ? s as Stand : null;
  } catch { return null; }
}
