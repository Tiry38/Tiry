// Abgleich PC ⇄ Handy über dein Gmail (je ein Entwurf mit Datei-Anhang – kein fremder Server):
//  - PC → Handy: Verlauf, Regeln, Absender, Kontakte, „Du entscheidest“, Einstellungen, Statistik.
//    Das Handy übernimmt das als Grundlage und sieht damit alles, was der PC schon aufgeräumt hat.
//  - Handy → PC: was am Handy neu passiert ist (Verlauf, gelernte Regeln, Entscheidungen) – der PC fügt es ein.
import type { Speicher } from './db';
import { bytesZuBase64 } from './mime';

export const PC_DATEN = "Tiry's Mails · Daten vom PC (bitte nicht löschen)";
export const HANDY_DATEN = "Tiry's Mails · Daten vom Handy (bitte nicht löschen)";

type Zeile = Record<string, unknown>;
export interface PcDaten {
  v: 1; zeit: number; protokoll: Zeile[]; regeln: Zeile[]; absender: Zeile[]; kontakte: Zeile[]; pruefen: Zeile[]; verarbeitet: Zeile[];
  kv: Record<string, unknown>;
}
export interface HandyDaten { v: 1; zeit: number; protokoll: Zeile[]; regeln: Zeile[]; pruefen: Zeile[]; verarbeitet: Zeile[] }

/** Einstellungen & Zähler, die das Handy vom PC übernimmt (nicht: historyId, Entwurf-IDs, Probelauf-Zustand des Handys …). */
const KV_VOM_PC = ['einstellungen', 'platz', 'autoFilter', 'ordnerAus', 'kontakteStand', 'kiVerbrauch'];

const alle = (db: Speicher, sql: string, ...a: unknown[]) => db.db.prepare(sql).all(...a) as Zeile[];

function einfuegen(db: Speicher, tabelle: string, zeilen: Zeile[], art: 'INSERT OR REPLACE' | 'INSERT OR IGNORE' = 'INSERT OR REPLACE') {
  if (!zeilen.length) return;
  const spalten = Object.keys(zeilen[0]);
  const st = db.db.prepare(`${art} INTO ${tabelle}(${spalten.join(',')}) VALUES(${spalten.map(() => '?').join(',')})`);
  for (const z of zeilen) st.run(...spalten.map((s) => (z[s] === undefined ? null : z[s])));
}

// ---------------- PC → Handy ----------------
export function pcExport(db: Speicher, jetzt = Date.now()): PcDaten {
  const kv: Record<string, unknown> = {};
  for (const k of KV_VOM_PC) { const v = db.get<unknown>(k, undefined); if (v !== undefined) kv[k] = v; }
  return {
    v: 1, zeit: jetzt,
    protokoll: alle(db, 'SELECT * FROM protokoll ORDER BY id DESC LIMIT 6000'),
    regeln: alle(db, 'SELECT * FROM regeln'),
    absender: alle(db, 'SELECT * FROM absender ORDER BY anzahl DESC LIMIT 4000'),
    kontakte: alle(db, 'SELECT * FROM kontakte'),
    pruefen: alle(db, 'SELECT * FROM pruefen ORDER BY zeit DESC LIMIT 3000'),
    verarbeitet: alle(db, 'SELECT * FROM verarbeitet ORDER BY zeit DESC LIMIT 60000'),
    kv,
  };
}

/** Kennzahl, ob sich am PC etwas geändert hat (dann neuer Export). */
export function pcFingerabdruck(db: Speicher): string {
  const n = (sql: string) => JSON.stringify(db.db.prepare(sql).get());
  return [n('SELECT MAX(id) m, COUNT(*) c FROM protokoll'), n('SELECT COUNT(*) c, SUM(bestaetigt) b, SUM(aktiv) a FROM regeln'),
    n('SELECT COUNT(*) c FROM pruefen WHERE erledigt IS NULL'), JSON.stringify(db.get('einstellungen', null)), n('SELECT COUNT(*) c FROM kontakte')].join('|');
}

/** Handy übernimmt den PC-Stand. Eigene Einträge des Handys, die neuer sind als der PC-Stand, bleiben erhalten. */
export function pcImport(db: Speicher, d: PcDaten) {
  const vorher = db.get<number>('pcStand', 0);
  if (d.zeit <= vorher) return false;
  const eigene = alle(db, 'SELECT * FROM protokoll WHERE zeit > ? AND id > ?', d.zeit, db.get<number>('pcMaxId', 0));
  db.db.exec('BEGIN');
  try {
    for (const t of ['protokoll', 'regeln', 'absender', 'kontakte', 'pruefen', 'verarbeitet']) db.db.exec(`DELETE FROM ${t}`);
    einfuegen(db, 'protokoll', d.protokoll); einfuegen(db, 'regeln', d.regeln); einfuegen(db, 'absender', d.absender);
    einfuegen(db, 'kontakte', d.kontakte); einfuegen(db, 'pruefen', d.pruefen); einfuegen(db, 'verarbeitet', d.verarbeitet);
    // eigene neue Handy-Einträge wieder anhängen (neue IDs)
    einfuegen(db, 'protokoll', eigene.map(({ id: _id, ...rest }) => rest), 'INSERT OR IGNORE');
    db.db.exec('COMMIT');
  } catch (e) { db.db.exec('ROLLBACK'); throw e; }
  for (const [k, v] of Object.entries(d.kv)) {
    if (k === 'einstellungen') {
      // Probelauf-Zustand und Gmail-Regeln-Freigabe bleiben Sache des Handys
      const handy = db.einstellungen();
      db.set(k, { ...(v as object), trockenlauf: handy.trockenlauf, trockenlaufSeit: handy.trockenlaufSeit, filterExportFreigegeben: false });
    } else db.set(k, v);
  }
  db.set('pcStand', d.zeit);
  db.set('pcMaxId', (db.db.prepare('SELECT MAX(id) m FROM protokoll').get() as any)?.m ?? 0);
  return true;
}

// ---------------- Handy → PC ----------------
export function handyExport(db: Speicher, jetzt = Date.now()): HandyDaten | null {
  const seit = db.get<number>('pcStand', 0), maxPc = db.get<number>('pcMaxId', 0);
  const protokoll = alle(db, 'SELECT * FROM protokoll WHERE id > ?', maxPc).map(({ id: _id, ...rest }) => rest);
  const pruefen = alle(db, 'SELECT * FROM pruefen WHERE erledigt IS NOT NULL AND erledigt > ?', seit);
  const regeln = alle(db, 'SELECT art, feld, wert, kategorie, aktiv, bestaetigt, erstellt FROM regeln');
  const verarbeitet = alle(db, 'SELECT * FROM verarbeitet WHERE zeit > ?', seit);
  if (!protokoll.length && !pruefen.length && !verarbeitet.length && regeln.length === db.get<number>('regelnBeiImport', -1)) return null;
  return { v: 1, zeit: jetzt, protokoll, regeln, pruefen, verarbeitet };
}

/** PC fügt die Handy-Änderungen ein (doppelte Einträge werden erkannt). */
export function handyImport(db: Speicher, d: HandyDaten): number {
  if (d.zeit <= db.get<number>('handyStand', 0)) return 0;
  let neu = 0;
  db.db.exec('BEGIN');
  try {
    const gibts = db.db.prepare('SELECT 1 FROM protokoll WHERE mail_id = ? AND zeit = ? AND durchlauf = ?');
    for (const z of d.protokoll) if (!gibts.get(z.mail_id, z.zeit, z.durchlauf)) { einfuegen(db, 'protokoll', [z], 'INSERT OR IGNORE'); neu++; }
    // Regeln: neue übernehmen, bei bekannten das stärkere Wissen behalten (Gmail-Filter-ID des PCs bleibt)
    const regel = db.db.prepare('SELECT id, bestaetigt, aktiv FROM regeln WHERE art = ? AND feld = ? AND wert = ?');
    for (const r of d.regeln) {
      const da = regel.get(r.art, r.feld, r.wert) as any;
      if (!da) einfuegen(db, 'regeln', [r], 'INSERT OR IGNORE');
      else if (Number(r.bestaetigt) > Number(da.bestaetigt)) db.db.prepare('UPDATE regeln SET bestaetigt = ?, kategorie = ? WHERE id = ?').run(r.bestaetigt, r.kategorie ?? null, da.id);
    }
    const erl = db.db.prepare('UPDATE pruefen SET erledigt = ? WHERE mail_id = ? AND erledigt IS NULL');
    for (const p of d.pruefen) erl.run(p.erledigt, p.mail_id);
    einfuegen(db, 'verarbeitet', d.verarbeitet, 'INSERT OR IGNORE');
    db.db.exec('COMMIT');
  } catch (e) { db.db.exec('ROLLBACK'); throw e; }
  db.set('handyStand', d.zeit);
  return neu;
}

// ---------------- Transport: Entwurf mit Datei-Anhang ----------------
export function datenNachricht(betreff: string, an: string, json: string): string {
  const grenze = `tmd${Date.now().toString(36)}`;
  const b64 = (s: string) => bytesZuBase64(new TextEncoder().encode(s)).replace(/.{76}/g, '$&\r\n');
  return [`To: ${an}`, `Subject: =?UTF-8?B?${b64(betreff).replace(/\r\n/g, '')}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${grenze}"`, '',
    `--${grenze}`, 'Content-Type: text/plain; charset=UTF-8', '', "Diesen Entwurf hält Tiry's Mails von selbst aktuell (Abgleich PC ⇄ Handy). Bitte nicht löschen und nicht absenden.", '',
    `--${grenze}`, 'Content-Type: application/json; name="daten.json"', 'Content-Disposition: attachment; filename="daten.json"', 'Content-Transfer-Encoding: base64', '', b64(json),
    `--${grenze}--`].join('\r\n');
}
