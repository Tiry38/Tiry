// 36 Beispiel-Mails mit erwarteter Einordnung.
import type { Kategorie, Mail } from '../../src/core/types';

export interface Fall {
  name: string;
  mail: Mail;
  erwartet: Kategorie;
  /** darf auf keinen Fall in den Papierkorb */
  niePapierkorb?: boolean;
  geschuetzt?: boolean;
  kontakt?: boolean;
}

let n = 0;
const GUT = 'mx.google.com; dkim=pass header.i=@x; spf=pass smtp.mailfrom=x; dmarc=pass (p=REJECT) header.from=x';
const SCHLECHT = 'mx.google.com; dkim=fail header.i=@x; spf=softfail smtp.mailfrom=x; dmarc=fail (p=QUARANTINE) header.from=x';

function m(from: string, subject: string, opt: { labels?: string[]; snippet?: string; h?: Record<string, string> } = {}): Mail {
  n++;
  return {
    id: `m${n}`, threadId: `t${n}`, labelIds: opt.labels ?? ['INBOX', 'UNREAD'], snippet: opt.snippet ?? '',
    internalDate: Date.UTC(2026, 10, 20, 8, n), sizeEstimate: 4000,
    headers: { from, subject, 'authentication-results': GUT, ...Object.fromEntries(Object.entries(opt.h ?? {}).map(([k, v]) => [k.toLowerCase(), v])) },
  };
}
const NL = (url = 'https://news.example.de/u/abc') => ({ 'List-Unsubscribe': `<${url}>, <mailto:unsub@example.de?subject=unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

export const FAELLE: Fall[] = [
  // ---------- Spam ----------
  { name: 'Gmail-Spam Potenzmittel', erwartet: 'spam', mail: m('"Dr. Health" <promo@cheap-pills.xyz>', 'Nur heute 90% Rabatt auf Wundermittel', { labels: ['SPAM', 'UNREAD'], snippet: 'Bestellen Sie jetzt ohne Rezept' }) },
  { name: 'Gmail-Spam Krypto', erwartet: 'spam', mail: m('Crypto Profit <win@bitprofit.top>', 'Verdienen Sie 5.000 € pro Tag', { labels: ['SPAM', 'UNREAD'] }) },
  { name: 'Auth-Fehler + Gewinnspiel', erwartet: 'spam', mail: m('Gewinnzentrale <info@lotto-sieger.ru>', 'Sie haben gewonnen!', { snippet: 'Sie haben gewonnen – fordern Sie jetzt Ihren Preis an', h: { 'Authentication-Results': SCHLECHT } }) },
  { name: 'Gmail-Spam Dating', erwartet: 'spam', mail: m('Anna <anna1992@dating-hot.club>', 'Hallo, ich habe dein Profil gesehen', { labels: ['SPAM', 'UNREAD'] }) },
  { name: 'Gmail-Spam SEO', erwartet: 'spam', mail: m('SEO Expert <seo@rank-first.biz>', 'Platz 1 bei Google garantiert', { labels: ['SPAM'] }) },
  { name: 'Gmail-Spam Erbschaft', erwartet: 'spam', mail: m('Barrister James <james@lawfirm-intl.ng>', 'Erbschaft über 4,5 Mio USD', { labels: ['SPAM', 'UNREAD'] }) },

  // ---------- Phishing mit gefälschtem Anzeigenamen ----------
  { name: 'PayPal gefälscht', erwartet: 'phishing', mail: m('PayPal <service@paypa1-sicherheit.com>', 'Ihr Konto wurde eingeschränkt', { snippet: 'Bitte verifizieren Sie Ihre Daten innerhalb von 24 Stunden', h: { 'Authentication-Results': SCHLECHT } }) },
  { name: 'Sparkasse gefälscht', erwartet: 'phishing', mail: m('Sparkasse Online <noreply@sk-online-update.info>', 'Sicherheitswarnung: ungewöhnliche Aktivität', { snippet: 'Bestätigen Sie Ihre Identität sofort' }) },
  { name: 'DHL gefälscht', erwartet: 'phishing', mail: m('DHL Express <versand@paket-info-de.net>', 'Paket konnte nicht zugestellt werden', { snippet: 'Zollgebühr von 1,99 € offen – jetzt zahlen' }) },
  { name: 'Anzeigename mit fremder Adresse', erwartet: 'phishing', mail: m('"support@amazon.de" <x7@mailer-cheap.co>', 'Ihre Zahlung ist fehlgeschlagen', { snippet: 'Zahlung fehlgeschlagen. Aktualisieren Sie Ihre Zahlungsdaten.', h: { 'Authentication-Results': SCHLECHT } }) },
  { name: 'Netflix gefälscht mit Reply-To', erwartet: 'phishing', mail: m('Netflix <info@nflx-billing.org>', 'Ihr Abo wird pausiert', { snippet: 'Aktualisieren Sie die Zahlungsmethode', h: { 'Reply-To': 'help@gmx-support.ru' } }) },
  { name: 'Apple gefälscht', erwartet: 'phishing', mail: m('Apple ID <id@appleid-verify.help>', 'Ihre Apple-ID wurde gesperrt', { snippet: 'Konto wurde gesperrt, verifizieren Sie sich', h: { 'Authentication-Results': SCHLECHT } }) },

  // ---------- Newsletter ----------
  { name: 'Tech-Newsletter', erwartet: 'newsletter', mail: m('heise online <newsletter@heise.de>', 'Die Woche bei heise: KI-Chips und mehr', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'], h: { ...NL('https://heise.de/u/1'), Precedence: 'bulk' } }) },
  { name: 'Verein-Newsletter', erwartet: 'newsletter', mail: m('Radsportverein <info@rsv-woerth.de>', 'Monatsinfo November', { h: { 'List-Unsubscribe': '<mailto:abmelden@rsv-woerth.de>', Precedence: 'list' } }) },
  { name: 'Blog-Digest', erwartet: 'newsletter', mail: m('Medium Daily Digest <noreply@medium.com>', 'Stories for you', { labels: ['INBOX', 'UNREAD'], h: { ...NL('https://medium.com/u'), Precedence: 'bulk' } }) },
  { name: 'Substack', erwartet: 'newsletter', mail: m('Gaming Weekly <gaming@substack.com>', 'Diese Woche: Elden Ring DLC', { h: NL('https://substack.com/unsub/x') }) },
  { name: 'Spieleportal-Newsletter', erwartet: 'newsletter', mail: m('GameStar <newsletter@gamestar.de>', 'Die besten Spiele im November', { labels: ['INBOX'], h: { ...NL('https://gamestar.de/u'), Precedence: 'bulk' } }) },

  // ---------- Werbung ----------
  { name: 'Shop-Werbung', erwartet: 'werbung', mail: m('Zalando <info@service-mail.zalando.de>', 'Black Week: bis zu 70 % Rabatt', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], h: NL('https://zalando.de/u') }) },
  { name: 'Elektronik-Werbung', erwartet: 'werbung', mail: m('MediaMarkt <newsletter@mediamarkt.de>', 'Nur heute: PS5-Angebote', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], h: NL('https://mediamarkt.de/u') }) },
  { name: 'Angelshop-Werbung', erwartet: 'werbung', mail: m('Angelplatz <angebote@angelplatz.de>', 'Bissanzeiger-Sets reduziert', { labels: ['INBOX', 'CATEGORY_PROMOTIONS'], h: NL('https://angelplatz.de/u') }) },
  { name: 'Lieferdienst-Werbung', erwartet: 'werbung', mail: m('Lieferando <noreply@lieferando.de>', '20 % auf deine nächste Pizza', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], h: NL('https://lieferando.de/u') }) },
  { name: 'Werbung ohne Header', erwartet: 'werbung', mail: m('Möbelhaus Weko <werbung@weko.de>', 'Großer Räumungsverkauf', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'] }) },

  // ---------- Rechnungen / Wichtiges (geschützt) ----------
  { name: 'Rechnung Vodafone', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('Vodafone <rechnung@vodafone.de>', 'Ihre Rechnung für November', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'], h: NL('https://vodafone.de/u') }) },
  { name: 'Rechnung in Werbung-Kategorie', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('Amazon.de <bestellbestaetigung@amazon.de>', 'Ihre Bestellung #302-123 wurde versandt', { labels: ['INBOX', 'CATEGORY_PROMOTIONS'], h: NL('https://amazon.de/u') }) },
  { name: 'Veloport', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('Veloport <noreply@veloport.de>', 'Neue Händlerinfo', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'], h: { Precedence: 'bulk' } }) },
  { name: 'Versicherung', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('HUK-COBURG <service@huk.de>', 'Ihre Versicherung: Beitragsanpassung 2027', { labels: ['INBOX', 'CATEGORY_UPDATES'] }) },
  { name: 'Steuer Elster', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('ELSTER <noreply@elster.de>', 'Ihr Steuerbescheid liegt vor', { labels: ['INBOX', 'UNREAD'] }) },
  { name: 'Phishing mit Schutzwort bleibt unangetastet', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('Volksbank <kunde@vb-sicherheit.top>', 'Ihr Bank-Konto wurde gesperrt', { snippet: 'Bitte sofort verifizieren', h: { 'Authentication-Results': SCHLECHT } }) },
  { name: 'Mit Stern markiert', erwartet: 'wichtig', niePapierkorb: true, geschuetzt: true, mail: m('Rabatt-Shop <deals@shop-xy.de>', 'Ihr Gutschein', { labels: ['INBOX', 'STARRED', 'CATEGORY_PROMOTIONS'], h: NL() }) },

  // ---------- Private Mails ----------
  { name: 'Mama (Kontakt)', erwartet: 'persoenlich', niePapierkorb: true, geschuetzt: true, kontakt: true, mail: m('Mama <mama.thirolf@web.de>', 'Sonntag Essen?', { snippet: 'Kommst du am Sonntag zum Essen?' }) },
  { name: 'Kumpel Angeln (Kontakt)', erwartet: 'persoenlich', niePapierkorb: true, geschuetzt: true, kontakt: true, mail: m('Dennis <dennis.k@gmail.com>', 'Samstag Angeln am Altrhein', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'] }) },
  { name: 'Unbekannte Privatperson', erwartet: 'persoenlich', niePapierkorb: true, mail: m('Sabine Müller <sabine.mueller@t-online.de>', 'Frage zu deinem Fahrrad', { labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'], snippet: 'Hallo, ich hätte eine kurze Frage' }) },
  { name: 'Private Mail Gmail-wichtig', erwartet: 'wichtig', niePapierkorb: true, mail: m('René <rene.velo@gmail.com>', 'Schichtplan nächste Woche', { labels: ['INBOX', 'UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL'] }) },

  // ---------- Paketbenachrichtigungen ----------
  { name: 'DHL echt', erwartet: 'benachrichtigung', mail: m('DHL Paket <noreply@dhl.de>', 'Ihr Paket kommt heute', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'] }) },
  { name: 'Hermes echt', erwartet: 'benachrichtigung', mail: m('Hermes <noreply@myhermes.de>', 'Sendungsstatus: in Zustellung', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'] }) },
  { name: 'Social: Instagram', erwartet: 'benachrichtigung', mail: m('Instagram <no-reply@mail.instagram.com>', 'velocenter hat einen neuen Beitrag', { labels: ['INBOX', 'UNREAD', 'CATEGORY_SOCIAL'], h: NL('https://instagram.com/u') }) },
  { name: 'PayPal echt Benachrichtigung', erwartet: 'benachrichtigung', mail: m('PayPal <service@paypal.de>', 'Sie haben eine Zahlung gesendet', { labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'] }) },
];
