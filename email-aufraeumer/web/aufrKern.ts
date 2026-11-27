// Der Aufräumer im Handy: derselbe Kern wie am PC (src/core/service.ts), mit eigener Datenbank auf dem Handy.
// Läuft, solange die App offen ist. Stellt dieselben Aufrufe bereit wie das PC-Programm (für die Aufräumer-Seite).
import { Speicher } from '../src/core/db';
import { Aufraeumer } from '../src/core/service';
import { Postfach } from '../src/core/postfach';
import { KATEGORIE_NAME } from '../src/core/types';
import type { GmailPort } from '../src/core/gmail';
import { oeffneHandyDb } from './sqlSpeicher';
import { pcImport, handyExport, datenNachricht, PC_DATEN, HANDY_DATEN, type PcDaten } from '../src/core/abgleich';

type Hoerer = (kanal: string, daten: unknown) => void;

export interface HandyKern {
  db: Speicher; dienst: Aufraeumer; postfach: Postfach;
  rufe(name: string, ...args: any[]): Promise<any>;
  auf(f: Hoerer): () => void;
  /** Datenbank sofort sichern (vor dem Seitenwechsel). */
  sichern(): Promise<void>;
}

let kern: Promise<HandyKern> | null = null;

export function handyKern(gmail: GmailPort): Promise<HandyKern> {
  if (!kern) kern = baue(gmail);
  return kern;
}

async function baue(gmail: GmailPort): Promise<HandyKern> {
  const roh = await oeffneHandyDb();
  const db = new Speicher(roh);
  // Gmail-Regeln trägt nur der PC ein (sonst entstünden sie doppelt) – am Handy nie fragen
  db.set('filterGefragt', true);
  if (db.einstellungen().filterExportFreigegeben) db.speichereEinstellungen({ filterExportFreigegeben: false });

  // Abmelden per One-Click (RFC 8058): im Browser nur „blind“ möglich (no-cors) – Antwort ist nicht lesbar
  const post = async (url: string, body: string) => { await fetch(url, { method: 'POST', mode: 'no-cors', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); return { status: 200 }; };
  const dienst = new Aufraeumer({ gmail, db, post } as any);
  dienst.ohneGmailRegeln = true;
  const postfach = new Postfach(gmail, (id) => (db.db.prepare('SELECT kategorie FROM protokoll WHERE mail_id = ? ORDER BY id DESC LIMIT 1').get(id) as any)?.kategorie ?? null, () => dienst.email || 'ich');
  postfach.platz = (b) => db.platzMerken(b);

  const hoerer = new Set<Hoerer>();
  const sende = (k: string, d: unknown) => { for (const f of hoerer) { try { f(k, d); } catch { /* egal */ } } };
  const logZeilen: string[] = [];
  for (const k of ['aktion', 'status', 'altbestand', 'frage', 'postfach', 'entruempeln']) dienst.on(k, (d: unknown) => sende(k, d));
  dienst.on('log', (s: string) => { logZeilen.push(s); if (logZeilen.length > 300) logZeilen.shift(); sende('log', s); });

  const API: Record<string, (...a: any[]) => any> = {
    updateStand: () => ({ stand: 'aus', version: 'Handy' }), updateJetzt: () => {}, updateSuchen: () => {},
    zustand: () => ({
      demo: false, handy: true, credentials: true, angemeldet: true,
      status: dienst.statusInfo(), statistik: db.statistik(), einstellungen: db.einstellungen(),
      altbestand: dienst.altbestand, entruempeln: dienst.entruempeln, entruempelnRueck: !!db.get('entruempelnLetzter', null),
      autoFilter: 0, kontakte: db.anzahlKontakte(), ki: { schluessel: false, ausgegebenEuro: 0 }, autostart: false, kategorien: KATEGORIE_NAME, drive: false,
    }),
    protokoll: (f) => db.protokoll(f ?? {}),
    zuPruefen: () => db.zuPruefen(),
    entscheide: (id, wahl) => dienst.entscheide(id, wahl),
    absender: () => db.topAbsender(60),
    absenderAktion: (a, akt) => dienst.absenderAktion(a, akt),
    regeln: () => ({ regeln: db.regeln(), kandidaten: [] }),
    regelSchalten: (id, an) => dienst.regelSchalten(id, an),
    regelLoeschen: (id) => dienst.regelLoeschen(id),
    regelAnlegen: (art, feld, wert, kat) => { db.regelMerken(art, feld, wert, kat ?? null); },
    speichereEinstellungen: (teil) => { const neu = db.speichereEinstellungen(teil); if ('intervallSek' in teil) dienst.neuPlanen(); return neu; },
    scharfSchalten: () => dienst.scharfSchalten(),
    trockenlaufWieder: () => dienst.trockenlaufWieder(),
    entruempelnVorschau: () => dienst.entruempelnVorschau(),
    entruempelnStarten: () => dienst.entruempelnStarten(),
    entruempelnRueckgaengig: () => dienst.entruempelnRueckgaengig(),
    autoFilterAus: () => 0,
    filterFreigeben: () => ({ angelegt: 0, wartet: 0, frage: false }),
    rueckgaengig: (id) => dienst.rueckgaengig(id),
    durchlaufRueckgaengig: (lauf) => dienst.durchlaufRueckgaengig(lauf),
    altbestandVorschau: () => dienst.altbestandVorschau(),
    altbestandStarten: () => dienst.altbestandStarten(),
    jetztPruefen: () => dienst.tick(),
    log: () => logZeilen.slice(-200),
    ordnerListe: () => dienst.ordnerListe(),
    ordnerSchalten: (basis, an) => dienst.ordnerSchalten(basis, an),
    credentialsWaehlen: () => false, anmelden: () => true, driveBereit: () => false, driveTest: () => ({ ok: false, schritt: 0, grund: 'Am Handy nicht nötig.' }),
    // Postfach (für die Aufräumer-Karte und Zähler)
    pfOrdner: () => postfach.ordner(),
    pfListe: (o, s, t) => postfach.liste(o, s ?? '', t ?? undefined),
    pfAktion: (ids, a) => postfach.aktion(ids, a),
    pfRueckgaengig: () => postfach.rueckgaengig(),
    pfVorladen: (ids) => postfach.vorladen(ids),
  };

  // Abgleich mit dem PC: beim Öffnen und alle 3 Minuten PC-Daten holen; eigene Änderungen kurz nach jeder Aktion zurückschicken
  const vomPc = async () => {
    try {
      const t = await gmail.entwurfDatei?.(PC_DATEN); if (!t) return;
      if (pcImport(db, JSON.parse(t) as PcDaten)) { db.set('regelnBeiImport', (db.db.prepare('SELECT COUNT(*) c FROM regeln').get() as any).c); await roh.speichernJetzt(); sende('abgleich', null); sende('status', dienst.statusInfo()); }
    } catch (e) { dienst.log(`Abgleich vom PC: ${(e as Error).message}`); }
  };
  let zumPcTimer: ReturnType<typeof setTimeout> | null = null;
  const zumPc = () => {
    if (zumPcTimer) clearTimeout(zumPcTimer);
    zumPcTimer = setTimeout(async () => {
      try {
        const d = handyExport(db); if (!d || !gmail.standSpeichern) return;
        db.set('handyDatenEntwurf', await gmail.standSpeichern(datenNachricht(HANDY_DATEN, dienst.email || 'ich', JSON.stringify(d)), db.get<string | null>('handyDatenEntwurf', null)));
      } catch (e) { dienst.log(`Abgleich zum PC: ${(e as Error).message}`); }
    }, 8000);
  };
  dienst.on('aktion', () => zumPc());
  await vomPc();
  setInterval(() => void vomPc(), 3 * 60_000);

  void dienst.starten();
  return {
    db, dienst, postfach,
    async rufe(name, ...args) { const f = API[name]; if (!f) throw new Error(`Am Handy nicht verfügbar: ${name}`); return f(...args); },
    auf(f) { hoerer.add(f); return () => hoerer.delete(f); },
    sichern: () => roh.speichernJetzt(),
  };
}
