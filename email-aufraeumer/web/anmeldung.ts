// Google-Anmeldung für die Handy-App – ganz ohne Server:
// Weiterleitung zu Google, zurück kommt ein Zugangs-Schlüssel (1 Stunde gültig) im #-Teil der Adresse.
// Läuft er ab, holt die App still einen neuen (prompt=none) – Tiry merkt davon nur ein kurzes Aufblitzen.
// Gespeichert wird nur auf dem Handy (localStorage). Keine Passwörter, keine Mails.

export const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const K = { client: 'tm.client', token: 'tm.token', ablauf: 'tm.ablauf', email: 'tm.email', state: 'tm.state' };

const lies = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const schreib = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privat-modus */ } };

/** Die Adresse, die in Google als „Autorisierte Weiterleitungs-URI“ eingetragen wird. */
export const rueckAdresse = () => location.origin + location.pathname.replace(/index\.html$/, '');

export const clientId = () => lies(K.client);
export function clientIdSetzen(id: string) { schreib(K.client, id.trim()); }
export const gueltigeClientId = (id: string) => /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(id.trim());

export function token(): string | null {
  const t = lies(K.token), a = Number(lies(K.ablauf) ?? 0);
  return t && Date.now() < a - 60_000 ? t : null;
}
export const merkeEmail = (e: string) => schreib(K.email, e);
export const email = () => lies(K.email);

/** Nach der Rückkehr von Google: Schlüssel aus der Adresse übernehmen. Liefert Fehlertext, falls Google abgelehnt hat. */
export function rueckkehrAuswerten(): { ok: boolean; fehler?: string; still?: boolean } | null {
  if (!location.hash.includes('access_token') && !location.hash.includes('error')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const erwartet = sessionStorage.getItem(K.state) ?? '';
  const [state, still] = (p.get('state') ?? '').split('.');
  if (!state || state !== erwartet.split('.')[0]) return { ok: false, fehler: 'Anmeldung nicht bestätigt – bitte noch einmal.' };
  if (p.get('error')) return { ok: false, fehler: p.get('error') ?? 'Fehler', still: still === 's' };
  schreib(K.token, p.get('access_token'));
  schreib(K.ablauf, String(Date.now() + Number(p.get('expires_in') ?? 3600) * 1000));
  return { ok: true };
}

/** Zu Google wechseln. still = ohne Nachfrage (klappt, wenn schon einmal zugestimmt). */
export function anmelden(still = false) {
  const id = clientId();
  if (!id) throw new Error('Client-ID fehlt');
  const state = crypto.getRandomValues(new Uint32Array(2)).join('');
  sessionStorage.setItem(K.state, state);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', id);
  u.searchParams.set('redirect_uri', rueckAdresse());
  u.searchParams.set('response_type', 'token');
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', `${state}.${still ? 's' : 'n'}`);
  const e = email(); if (e) u.searchParams.set('login_hint', e);
  if (still) u.searchParams.set('prompt', 'none');
  location.assign(u.toString());
}

export function abmelden() { schreib(K.token, null); schreib(K.ablauf, null); }
