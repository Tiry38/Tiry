// Demo-Modus (--demo): echtes Programm, aber mit einem Postfach im Arbeitsspeicher.
// Für Screenshots und zum Ausprobieren, ohne Tirys Konto zu berühren.
import { SpeicherGmail } from '../core/speicherGmail';
import type { Mail } from '../core/types';

const GUT = 'mx.google.com; dkim=pass; spf=pass; dmarc=pass';
const SCHLECHT = 'mx.google.com; dkim=fail; spf=softfail; dmarc=fail';
const NL = (d: string) => ({ 'list-unsubscribe': `<https://${d}/abmelden>, <mailto:abmelden@${d}>`, 'list-unsubscribe-post': 'List-Unsubscribe=One-Click' });

type Vorlage = [from: string, subject: string, labels: string[], extra?: Record<string, string>, snippet?: string];

const VORLAGEN: Vorlage[] = [
  ['Zalando <info@service-mail.zalando.de>', 'Black Week: bis zu 70 % Rabatt', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], NL('zalando.de')],
  ['MediaMarkt <newsletter@mediamarkt.de>', 'Nur heute: PS5-Bundles reduziert', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], NL('mediamarkt.de')],
  ['heise online <newsletter@heise.de>', 'Die Woche bei heise', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'], { ...NL('heise.de'), precedence: 'bulk' }],
  ['PayPal <service@paypa1-sicherheit.com>', 'Ihr Konto wurde eingeschränkt', ['INBOX', 'UNREAD'], { 'authentication-results': SCHLECHT }, 'Bitte verifizieren Sie Ihre Daten innerhalb von 24 Stunden'],
  ['DHL Paket <noreply@dhl.de>', 'Ihr Paket kommt heute zwischen 10 und 13 Uhr', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES']],
  ['Vodafone <rechnung@vodafone.de>', 'Ihre Rechnung für November', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES']],
  ['Crypto Profit <win@bitprofit.top>', 'Verdienen Sie 5.000 € pro Tag', ['SPAM', 'UNREAD']],
  ['Angelplatz <angebote@angelplatz.de>', 'Bissanzeiger-Sets reduziert', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], NL('angelplatz.de')],
  ['GameStar <newsletter@gamestar.de>', 'Die besten Spiele im November', ['INBOX', 'UNREAD'], { ...NL('gamestar.de'), precedence: 'bulk' }],
  ['Instagram <no-reply@mail.instagram.com>', 'Neue Beiträge von Leuten, denen du folgst', ['INBOX', 'UNREAD', 'CATEGORY_SOCIAL'], NL('instagram.com')],
  ['Möbelhaus Weko <werbung@weko.de>', 'Großer Räumungsverkauf', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS']],
  ['Lieferando <noreply@lieferando.de>', '20 % auf deine nächste Pizza', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], NL('lieferando.de')],
  ['Sparkasse Online <noreply@sk-online-update.info>', 'Sicherheitswarnung: ungewöhnliche Aktivität', ['INBOX', 'UNREAD'], {}, 'Bestätigen Sie Ihre Identität sofort'],
  ['Hermes <noreply@myhermes.de>', 'Sendungsstatus: in Zustellung', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES']],
  ['Medium Daily Digest <noreply@medium.com>', 'Stories for you', ['INBOX', 'UNREAD'], { ...NL('medium.com'), precedence: 'bulk' }],
  ['Sabine Müller <sabine.mueller@t-online.de>', 'Frage zu deinem Fahrrad', ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'], {}, 'Hallo, ich hätte eine kurze Frage'],
  ['Mama <mama@example.de>', 'Sonntag Essen?', ['INBOX', 'UNREAD'], {}, 'Kommst du am Sonntag?'],
  ['ELSTER <noreply@elster.de>', 'Ihr Steuerbescheid liegt vor', ['INBOX', 'UNREAD']],
  ['DHL Express <versand@paket-info-de.net>', 'Paket konnte nicht zugestellt werden', ['INBOX', 'UNREAD'], {}, 'Zollgebühr von 1,99 € offen'],
  ['Rocket League <news@psyonix.com>', 'Season 21 ist da', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], NL('psyonix.com')],
];

let zaehler = 0;
export function demoMail(v: Vorlage = VORLAGEN[zaehler % VORLAGEN.length], zeit = Date.now()): Mail {
  zaehler++;
  const [from, subject, labels, extra = {}, snippet = ''] = v;
  return { id: `demo${zaehler}`, threadId: `demo${zaehler}`, labelIds: [...labels], snippet, internalDate: zeit, sizeEstimate: 5000,
    headers: { from, subject, 'authentication-results': GUT, ...extra } };
}

export function erzeugeDemo(): { gmail: SpeicherGmail; tropfen: () => void } {
  const gmail = new SpeicherGmail();
  gmail.email = 'tiry@gmail.com';
  gmail.hinzufuegen({ id: 'sent1', threadId: 'sent1', labelIds: ['SENT'], snippet: '', internalDate: Date.now() - 86400_000,
    headers: { from: 'tiry@gmail.com', to: 'Mama <mama@example.de>', subject: 'Re: Sonntag' } }, false);
  // Altbestand: 120 Mails im Posteingang
  for (let i = 0; i < 120; i++) gmail.hinzufuegen(demoMail(VORLAGEN[(i * 7) % VORLAGEN.length], Date.now() - (i + 2) * 3600_000), false);
  return { gmail, tropfen: () => gmail.hinzufuegen(demoMail()) };
}
