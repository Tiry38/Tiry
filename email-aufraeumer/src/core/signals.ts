// Stufe 1 – Signale aus Labels und Headern.
import type { Mail, Signale } from './types';
import { basisDomain, parseAdresse, parseAuthResults, parseListUnsubscribe } from './headers';

/** Marken, die gern im Anzeigenamen gefälscht werden → erlaubte Anfänge der echten Basis-Domain
 *  (z. B. „paypal.“ passt auf paypal.de/paypal.com, nicht auf paypal-sicherheit.com). */
export const MARKEN: Record<string, string[]> = {
  paypal: ['paypal.'], amazon: ['amazon.', 'amazonses.'], sparkasse: ['sparkasse', 's-'], volksbank: ['volksbank', 'vrbank', 'vr.'],
  'deutsche bank': ['db.', 'deutsche-bank.'], commerzbank: ['commerzbank.'], postbank: ['postbank.'], ing: ['ing.', 'ing-diba.'],
  n26: ['n26.'], comdirect: ['comdirect.'], dkb: ['dkb.'], dhl: ['dhl.'], 'deutsche post': ['deutschepost.', 'dhl.'],
  dpd: ['dpd.'], hermes: ['hermes', 'myhermes.'], gls: ['gls-', 'gls.'], ups: ['ups.'], apple: ['apple.', 'icloud.'],
  microsoft: ['microsoft.', 'outlook.', 'live.', 'office.'], netflix: ['netflix.'], telekom: ['telekom.', 't-online.'],
  vodafone: ['vodafone.'], ebay: ['ebay.'], google: ['google.', 'youtube.'], elster: ['elster.'], finanzamt: ['elster.', 'finanzamt'],
  dazn: ['dazn.'], disney: ['disney', 'disneyplus.'], spotify: ['spotify.'], klarna: ['klarna.'],
};

const DRINGLICH = [
  'konto gesperrt', 'konto wurde gesperrt', 'eingeschränkt', 'verifizieren', 'bestätigen sie ihre', 'ungewöhnliche aktivität',
  'sicherheitswarnung', 'letzte mahnung', 'zahlung fehlgeschlagen', 'sofort handeln', 'innerhalb von 24 stunden', 'verify your account',
  'account suspended', 'unusual activity', 'paket konnte nicht zugestellt', 'zollgebühr', 'gewonnen', 'passwort läuft ab',
];

export function dringlichkeit(text: string): string[] {
  const t = text.toLowerCase();
  return DRINGLICH.filter((w) => t.includes(w));
}

function enthaeltMarkeDomain(domain: string, teile: string[]): boolean {
  const d = basisDomain(domain);
  return teile.some((t) => d.startsWith(t));
}

export function ermittleSignale(mail: Mail, historie: { anzahl: number; gelesen: number } | null): Signale {
  const h = mail.headers;
  const von = parseAdresse(h['from']);
  const labels = new Set(mail.labelIds);
  const kategorieLabel = labels.has('CATEGORY_PROMOTIONS') ? 'promotions'
    : labels.has('CATEGORY_SOCIAL') ? 'social'
    : labels.has('CATEGORY_UPDATES') ? 'updates'
    : labels.has('CATEGORY_FORUMS') ? 'forums'
    : labels.has('CATEGORY_PERSONAL') ? 'personal' : null;
  const auth = parseAuthResults(h['authentication-results']);
  const authFehler = auth.dmarc === 'fail' || auth.dkim === 'fail' || auth.spf === 'fail';

  const merkmale: string[] = [];
  const nameKlein = von.name.toLowerCase();
  // Anzeigename enthält eine andere E-Mail-Adresse als den echten Absender
  const nameMail = nameKlein.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/);
  if (nameMail && basisDomain(nameMail[1]) !== basisDomain(von.domain)) {
    merkmale.push(`Anzeigename zeigt ${nameMail[0]}, gesendet aber von ${von.domain}`);
  }
  // Anzeigename gibt sich als Marke aus, Domain passt nicht
  for (const [marke, teile] of Object.entries(MARKEN)) {
    const re = new RegExp(`(^|[^a-z])${marke.replace(/ /g, '\\s*')}([^a-z]|$)`, 'i');
    if (re.test(nameKlein) && !enthaeltMarkeDomain(von.domain, teile)) {
      merkmale.push(`Anzeigename „${von.name}“ passt nicht zur Domain ${von.domain}`);
      break;
    }
  }
  const replyTo = h['reply-to'] ? parseAdresse(h['reply-to']) : null;
  const replyToAndereDomain = !!replyTo && !!replyTo.domain && basisDomain(replyTo.domain) !== basisDomain(von.domain);

  return {
    absender: von.adresse,
    domain: von.domain,
    anzeigename: von.name,
    betreff: h['subject'] ?? '',
    gmailSpam: labels.has('SPAM'),
    kategorieLabel,
    listUnsubscribe: parseListUnsubscribe(h['list-unsubscribe'], h['list-unsubscribe-post']),
    bulk: /\b(bulk|list|junk)\b/i.test(h['precedence'] ?? ''),
    auth,
    authFehler,
    phishingMerkmale: merkmale,
    replyToAndereDomain,
    historie,
  };
}
