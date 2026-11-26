// Abmelden – ausschließlich über den List-Unsubscribe-Header (Sicherheitsregel 4):
// RFC 8058 One-Click-POST oder mailto. Links aus dem Mail-Text werden NIE geöffnet.
import type { ListUnsubscribe } from './headers';
import type { GmailPort } from './gmail';

export type AbmeldeErgebnis =
  | { ok: true; weg: 'one-click' | 'mailto'; ziel: string }
  | { ok: false; grund: string };

export type HttpPost = (url: string, body: string) => Promise<{ status: number }>;

export const standardPost: HttpPost = async (url, body) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    // Keine Cookies, keine Weiterleitung folgen, kein Referer (RFC 8058 Abschnitt 3.1).
    const r = await fetch(url, {
      method: 'POST', body, redirect: 'manual', signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Email-Aufraeumer/1.0' },
    } as RequestInit);
    return { status: r.status };
  } finally { clearTimeout(t); }
};

export function baueMailtoNachricht(mailto: string, von: string): { an: string; raw: string } | null {
  let u: URL;
  try { u = new URL(mailto); } catch { return null; }
  const an = decodeURIComponent(u.pathname).trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(an)) return null;
  const betreff = (u.searchParams.get('subject') ?? 'unsubscribe').replace(/[\r\n]/g, ' ');
  const text = (u.searchParams.get('body') ?? 'unsubscribe').replace(/\r?\n/g, '\r\n');
  const betreffKodiert = /^[\x20-\x7e]*$/.test(betreff) ? betreff : `=?UTF-8?B?${Buffer.from(betreff, 'utf8').toString('base64')}?=`;
  const raw = [`From: ${von}`, `To: ${an}`, `Subject: ${betreffKodiert}`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', '', text].join('\r\n');
  return { an, raw };
}

export async function abmelden(lu: ListUnsubscribe | null, opt: { gmail: GmailPort; eigeneAdresse: string; phishing: boolean; post?: HttpPost }): Promise<AbmeldeErgebnis> {
  if (opt.phishing) return { ok: false, grund: 'Phishing-Verdacht – Abmelden würde die Adresse bestätigen.' };
  if (!lu) return { ok: false, grund: 'Kein List-Unsubscribe-Header vorhanden.' };
  if (lu.oneClick && lu.http.length) {
    const url = lu.http[0];
    try {
      const r = await (opt.post ?? standardPost)(url, 'List-Unsubscribe=One-Click');
      if (r.status >= 200 && r.status < 400) return { ok: true, weg: 'one-click', ziel: new URL(url).host };
      if (!lu.mailto.length) return { ok: false, grund: `One-Click-Abmeldung abgelehnt (HTTP ${r.status}).` };
    } catch (err) {
      if (!lu.mailto.length) return { ok: false, grund: `One-Click-Abmeldung nicht erreichbar: ${(err as Error).message}` };
    }
  }
  if (lu.mailto.length) {
    const n = baueMailtoNachricht(lu.mailto[0], opt.eigeneAdresse);
    if (!n) return { ok: false, grund: 'mailto-Adresse im Header ist ungültig.' };
    await opt.gmail.sendeMail(n.raw);
    return { ok: true, weg: 'mailto', ziel: n.an };
  }
  return { ok: false, grund: 'Nur ein Link ohne One-Click-Kennzeichnung – wird aus Sicherheitsgründen nicht geöffnet.' };
}
