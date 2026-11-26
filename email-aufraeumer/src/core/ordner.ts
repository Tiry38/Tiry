// Ordner für Vielschreiber: Firmen, die oft schreiben (z. B. Amazon, DHL), bekommen einen eigenen Gmail-Ordner (Label).
// Erkannt wird an der Firmen-Domain, nicht an der einzelnen Adresse: bestellung@amazon.de und versand@amazon.de → „Amazon“.
import { basisDomain } from './headers';

/** Private Mail-Anbieter: hier steckt keine Firma dahinter → nie ein Ordner. */
export const PRIVAT_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'web.de', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 't-online.de', 'freenet.de', 'posteo.de', 'mailbox.org',
  'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de', 'live.com', 'live.de', 'msn.com', 'yahoo.com', 'yahoo.de', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'aol.de', 'arcor.de', 'online.de', 'protonmail.com', 'proton.me', 'ymail.com', 'email.de', 'vodafonemail.de', 'kabelmail.de',
]);

/** Schöne Namen für bekannte Firmen. */
const NAMEN: Record<string, string> = {
  'amazon.de': 'Amazon', 'amazon.com': 'Amazon', 'amazonses.com': 'Amazon', 'dhl.de': 'DHL', 'dhl.com': 'DHL', 'deutschepost.de': 'Deutsche Post',
  'paypal.de': 'PayPal', 'paypal.com': 'PayPal', 'ebay.de': 'eBay', 'ebay.com': 'eBay', 'zalando.de': 'Zalando', 'otto.de': 'Otto',
  'myhermes.de': 'Hermes', 'hermesworld.com': 'Hermes', 'dpd.de': 'DPD', 'gls-group.eu': 'GLS', 'ups.com': 'UPS', 'vodafone.de': 'Vodafone',
  'telekom.de': 'Telekom', 'instagram.com': 'Instagram', 'facebookmail.com': 'Facebook', 'linkedin.com': 'LinkedIn', 'netflix.com': 'Netflix',
  'spotify.com': 'Spotify', 'apple.com': 'Apple', 'google.com': 'Google', 'youtube.com': 'YouTube', 'mediamarkt.de': 'MediaMarkt', 'saturn.de': 'Saturn',
  'lieferando.de': 'Lieferando', 'ikea.com': 'IKEA', 'ikea.de': 'IKEA', 'lidl.de': 'Lidl', 'aldi-sued.de': 'Aldi', 'kaufland.de': 'Kaufland',
  'playstation.com': 'PlayStation', 'battle.net': 'Battle.net', 'blizzard.com': 'Blizzard', 'steampowered.com': 'Steam', 'epicgames.com': 'Epic Games',
  'veloport.de': 'Veloport', 'elster.de': 'ELSTER', 'heise.de': 'heise', 'gamestar.de': 'GameStar', 'temu.com': 'Temu', 'shein.com': 'SHEIN',
};

/** Ordnername aus der Firmen-Domain: bekannte Firmen schön, sonst „dr-abc.de“ → „Dr Abc“, kurze Kürzel groß („dpd“ → „DPD“). */
export function ordnerName(basis: string): string {
  if (NAMEN[basis]) return NAMEN[basis];
  const teil = basis.split('.')[0] ?? basis;
  const name = teil.split(/[-_]+/).filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
  return name.replace(/[\/\\]/g, ' ').trim() || basis;
}

export function ordnerBasis(domain: string): string | null {
  if (!domain) return null;
  const b = basisDomain(domain);
  return PRIVAT_DOMAINS.has(b) ? null : b;
}
