// Gemeinsame Typen des Email-Aufräumers.

export type Kategorie =
  | 'wichtig'
  | 'persoenlich'
  | 'werbung'
  | 'newsletter'
  | 'benachrichtigung'
  | 'spam'
  | 'phishing';

export const KATEGORIEN: Kategorie[] = [
  'wichtig', 'persoenlich', 'werbung', 'newsletter', 'benachrichtigung', 'spam', 'phishing',
];

export const KATEGORIE_NAME: Record<Kategorie, string> = {
  wichtig: 'Wichtig',
  persoenlich: 'Persönlich',
  werbung: 'Werbung',
  newsletter: 'Newsletter',
  benachrichtigung: 'Benachrichtigung',
  spam: 'Spam',
  phishing: 'Phishing',
};

/** Aktionen, die pro Kategorie eingestellt werden können. */
export type Aktion = 'behalten' | 'label' | 'archivieren' | 'gelesen' | 'abmelden' | 'papierkorb';
export const AKTIONEN: Aktion[] = ['behalten', 'label', 'archivieren', 'gelesen', 'abmelden', 'papierkorb'];

/** Das, was der Aufräumer von einer Mail kennt (nur Metadaten + Snippet). */
export interface Mail {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: number; // ms
  sizeEstimate?: number;
  headers: Record<string, string>; // Kleinbuchstaben-Schlüssel, z. B. 'from', 'subject'
}

export interface Signale {
  absender: string;          // Adresse, klein
  domain: string;            // Absender-Domain
  anzeigename: string;
  betreff: string;
  gmailSpam: boolean;
  kategorieLabel: 'promotions' | 'social' | 'updates' | 'forums' | 'personal' | null;
  listUnsubscribe: { http: string[]; mailto: string[]; oneClick: boolean } | null;
  bulk: boolean;
  auth: { spf: string | null; dkim: string | null; dmarc: string | null };
  authFehler: boolean;       // SPF/DKIM/DMARC ausdrücklich fehlgeschlagen
  phishingMerkmale: string[];
  replyToAndereDomain: boolean;
  historie: { anzahl: number; gelesen: number } | null; // öffnet Tiry diese Mails?
}

export interface Schutz {
  geschuetzt: boolean;
  grund: string | null;
}

export interface Entscheidung {
  kategorie: Kategorie;
  sicherheit: number;   // 0..100
  stufe: 'signale' | 'regeln' | 'ki' | 'schutz';
  begruendung: string;  // ein Satz fürs Protokoll
  regelId?: number;
}

export interface Regel {
  id: number;
  art: 'weiss' | 'schwarz' | 'gelernt';
  feld: 'adresse' | 'domain' | 'stichwort';
  wert: string;
  kategorie: Kategorie | null; // bei schwarz/gelernt: Zielkategorie; weiss: null
  aktiv: boolean;
  bestaetigt: number;          // wie oft Tiry das bestätigt hat
  gmailFilterId: string | null;
  erstellt: number;
}

export interface Einstellungen {
  intervallSek: number;
  schwelle: number;                // 0..100 Mindest-Sicherheit
  schutzwoerter: string[];
  kiAn: boolean;
  kiBudgetEuro: number;
  trockenlauf: boolean;
  trockenlaufSeit: number;         // ms
  autostart: boolean;
  aktionen: Record<Kategorie, Aktion[]>;
  filterExportFreigegeben: boolean; // Tiry hat dem ersten Gmail-Filter zugestimmt
  filterExportAb: number;          // ab so vielen Bestätigungen wird ein Filter angelegt
  kiUsdProEuro: number;
  /** Altbestand: Werbung und Newsletter in den Papierkorb statt ins Archiv (schafft Speicherplatz). */
  altPlatzSchaffen: boolean;
  /** Ordner für Vielschreiber (z. B. „Amazon“, „DHL“). */
  ordnerAn: boolean;
  /** Ab so vielen Mails einer Firma wird ein Ordner angelegt. */
  ordnerAb: number;
}

export interface ProtokollEintrag {
  id: number;
  zeit: number;
  durchlauf: string;
  mailId: string;
  absender: string;
  betreff: string;
  kategorie: Kategorie;
  sicherheit: number;
  stufe: string;
  begruendung: string;
  aktionen: Aktion[];
  trocken: boolean;
  vorherLabels: string[];
  nachherLabels: string[];
  rueckgaengig: number | null;  // Zeitpunkt des Rückgängig-Machens
  status: 'ok' | 'zu_pruefen' | 'geschuetzt' | 'fehler';
  hinweis: string | null;
}
