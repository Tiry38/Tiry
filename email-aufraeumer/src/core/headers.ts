// Header-Auswertung: Absender, List-Unsubscribe, Authentication-Results.

export interface Adresse { name: string; adresse: string; domain: string }

/** Zerlegt einen From-/To-Header in Name + Adresse. */
export function parseAdresse(wert: string | undefined): Adresse {
  const roh = (wert ?? '').trim();
  let name = '', adresse = '';
  const m = roh.match(/^(.*)<([^>]+)>\s*$/);
  if (m) {
    name = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').trim();
    adresse = m[2].trim();
  } else {
    adresse = roh.replace(/^"|"$/g, '');
  }
  adresse = adresse.toLowerCase();
  const domain = adresse.includes('@') ? adresse.split('@').pop()!.trim() : '';
  return { name: dekodiereMimeWort(name), adresse, domain };
}

/** Mehrere Adressen (To/Cc/Bcc), kommagetrennt – Kommas in Anführungszeichen werden ignoriert. */
export function parseAdressListe(wert: string | undefined): Adresse[] {
  if (!wert) return [];
  const teile: string[] = [];
  let akt = '', inZitat = false, inWinkel = false;
  for (const z of wert) {
    if (z === '"') inZitat = !inZitat;
    if (z === '<') inWinkel = true;
    if (z === '>') inWinkel = false;
    if (z === ',' && !inZitat && !inWinkel) { teile.push(akt); akt = ''; } else akt += z;
  }
  if (akt.trim()) teile.push(akt);
  return teile.map(parseAdresse).filter((a) => a.adresse.includes('@'));
}

/** RFC-2047-Wörter (=?UTF-8?B?...?=) – Gmail liefert meist schon dekodiert, das ist der Rückfall. */
export function dekodiereMimeWort(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, _cs, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8');
      return Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
    } catch { return text; }
  });
}

export interface ListUnsubscribe { http: string[]; mailto: string[]; oneClick: boolean }

/** List-Unsubscribe nach RFC 2369, One-Click nach RFC 8058. */
export function parseListUnsubscribe(wert: string | undefined, post: string | undefined): ListUnsubscribe | null {
  if (!wert) return null;
  const urls = [...wert.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
  const http = urls.filter((u) => /^https:\/\//i.test(u)); // nur HTTPS – http:// wird nie aufgerufen
  const mailto = urls.filter((u) => /^mailto:/i.test(u));
  if (!http.length && !mailto.length) return null;
  const oneClick = !!post && /List-Unsubscribe=One-Click/i.test(post) && http.length > 0;
  return { http, mailto, oneClick };
}

export interface AuthErgebnis { spf: string | null; dkim: string | null; dmarc: string | null }

/** Liest spf=, dkim=, dmarc= aus Authentication-Results (der oberste Header stammt von Google selbst). */
export function parseAuthResults(wert: string | undefined): AuthErgebnis {
  const res: AuthErgebnis = { spf: null, dkim: null, dmarc: null };
  if (!wert) return res;
  for (const k of ['spf', 'dkim', 'dmarc'] as const) {
    const m = wert.match(new RegExp(`\\b${k}=([a-z]+)`, 'i'));
    if (m) res[k] = m[1].toLowerCase();
  }
  return res;
}

/** Registrierbare Domain grob bestimmen (für Vergleiche wie news.shop.de ~ shop.de). */
export function basisDomain(domain: string): string {
  const teile = domain.toLowerCase().split('.').filter(Boolean);
  if (teile.length <= 2) return teile.join('.');
  const zweistufig = ['co.uk', 'com.au', 'co.at', 'or.at', 'gv.at', 'com.br', 'co.jp'];
  const letzte2 = teile.slice(-2).join('.');
  if (zweistufig.includes(letzte2)) return teile.slice(-3).join('.');
  return letzte2;
}
