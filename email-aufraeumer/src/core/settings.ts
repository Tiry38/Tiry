import type { Einstellungen } from './types';

export const SCHUTZWOERTER_STANDARD = [
  'Rechnung', 'Bestellung', 'Lieferung', 'Vertrag', 'Kündigung', 'Bank', 'Steuer', 'Versicherung', 'Termin', 'Veloport',
];

export const TROCKENLAUF_TAGE = 7;

export function standardEinstellungen(jetzt = Date.now()): Einstellungen {
  return {
    intervallSek: 5,
    schwelle: 85,
    schutzwoerter: [...SCHUTZWOERTER_STANDARD],
    kiAn: false,
    kiBudgetEuro: 2,
    trockenlauf: true,
    trockenlaufSeit: jetzt,
    autostart: true,
    aktionen: {
      wichtig: ['behalten'],
      persoenlich: ['behalten'],
      werbung: ['label', 'archivieren', 'gelesen', 'abmelden'],
      newsletter: ['label', 'archivieren'],
      benachrichtigung: ['label'],
      spam: ['papierkorb'],
      phishing: ['papierkorb'],
    },
    filterExportFreigegeben: false,
    filterExportAb: 3,
    kiUsdProEuro: 1.08,
    altPlatzSchaffen: true,
    ordnerAn: true,
    ordnerAb: 5,
    bilderAuto: true,
  };
}

/** Tage, die der Trockenlauf noch mindestens läuft (Scharf schalten ist erst danach möglich). */
export function trockenlaufRestTage(e: Einstellungen, jetzt = Date.now()): number {
  const rest = e.trockenlaufSeit + TROCKENLAUF_TAGE * 86400_000 - jetzt;
  return Math.max(0, Math.ceil(rest / 86400_000));
}
