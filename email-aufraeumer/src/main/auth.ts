// OAuth 2.0 als „Desktop-App“ mit Loopback-Umleitung und PKCE.
// Scopes: gmail.modify + gmail.settings.basic. https://mail.google.com/ wird NIE angefordert (Sicherheitsregel 1).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { safeStorage, shell } from 'electron';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

export class Anmeldung {
  private client: any = null;
  constructor(private ordner: string) {}

  get credentialsPfad() { return path.join(this.ordner, 'credentials.json'); }
  get tokenPfad() { return path.join(this.ordner, 'tokens.bin'); }

  hatCredentials() { return fs.existsSync(this.credentialsPfad); }
  istAngemeldet() { return fs.existsSync(this.tokenPfad); }

  credentialsUebernehmen(quelle: string) {
    const j = JSON.parse(fs.readFileSync(quelle, 'utf8'));
    const c = j.installed ?? j.web;
    if (!c?.client_id || !c?.client_secret) throw new Error('Das ist keine OAuth-Client-Datei (client_id/client_secret fehlen).');
    if (!j.installed) throw new Error('Bitte einen OAuth-Client vom Typ „Desktop-App“ anlegen (die Datei hat keinen Abschnitt „installed“).');
    fs.mkdirSync(this.ordner, { recursive: true });
    fs.writeFileSync(this.credentialsPfad, JSON.stringify(j), { mode: 0o600 });
  }

  private neuerClient(redirect?: string) {
    const { google } = require('googleapis') as typeof import('googleapis');
    const c = JSON.parse(fs.readFileSync(this.credentialsPfad, 'utf8')).installed;
    return new google.auth.OAuth2(c.client_id, c.client_secret, redirect);
  }

  private speichereTokens(tokens: object) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows-Verschlüsselung (DPAPI) nicht verfügbar – Tokens werden nicht unverschlüsselt gespeichert.');
    fs.writeFileSync(this.tokenPfad, safeStorage.encryptString(JSON.stringify(tokens)), { mode: 0o600 });
  }
  private ladeTokens(): any {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(this.tokenPfad)));
  }

  /** Liefert einen OAuth2-Client mit gespeicherten Tokens (aktualisiert sich selbst). */
  client_(): any {
    if (this.client) return this.client;
    const c = this.neuerClient();
    c.setCredentials(this.ladeTokens());
    c.on('tokens', (t: any) => { this.speichereTokens({ ...this.ladeTokens(), ...t }); });
    this.client = c;
    return c;
  }

  abmelden() { try { fs.unlinkSync(this.tokenPfad); } catch { /* schon weg */ } this.client = null; }

  /** Browser öffnen, Zustimmung abholen, Code gegen Tokens tauschen. */
  async anmelden(): Promise<void> {
    if (!this.hatCredentials()) throw new Error('credentials.json fehlt – siehe LIESMICH, Schritt 3.');
    const state = crypto.randomBytes(16).toString('hex');
    const server = http.createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as any).port;
    const redirect = `http://127.0.0.1:${port}`;
    const client = this.neuerClient(redirect);
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const url = client.generateAuthUrl({
      access_type: 'offline', prompt: 'consent', scope: SCOPES, state,
      code_challenge_method: 'S256' as any, code_challenge: codeChallenge,
    });
    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => { server.close(); reject(new Error('Anmeldung abgebrochen (5 Minuten ohne Antwort).')); }, 5 * 60_000);
      server.on('request', (req, res) => {
        const u = new URL(req.url ?? '/', redirect);
        if (u.pathname !== '/') { res.writeHead(404).end(); return; }
        const fehler = u.searchParams.get('error');
        const ok = !fehler && u.searchParams.get('state') === state && u.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>Email-Aufräumer</title><body style="font:20px system-ui;background:#121417;color:#eef0f2;padding:60px">
          ${ok ? 'Angemeldet. Du kannst dieses Fenster schließen.' : 'Anmeldung fehlgeschlagen: ' + (fehler ?? 'ungültige Antwort')}</body>`);
        clearTimeout(timeout); server.close();
        if (ok) resolve(u.searchParams.get('code')!); else reject(new Error(fehler ?? 'Ungültige Antwort (state passt nicht).'));
      });
      void shell.openExternal(url);
    });
    const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirect });
    if (!tokens.refresh_token) throw new Error('Google hat kein Refresh-Token geliefert. App-Zugriff unter myaccount.google.com/permissions entfernen und neu anmelden.');
    const erteilt = String(tokens.scope ?? '').split(' ');
    for (const s of SCOPES) if (!erteilt.includes(s)) throw new Error(`Berechtigung fehlt: ${s}. Bitte bei der Anmeldung alle Haken setzen.`);
    this.speichereTokens(tokens);
    this.client = null;
  }
}
