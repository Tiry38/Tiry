// Die Aufräumer-Datenbank auf dem Handy: dieselbe SQLite wie am PC, hier über sql.js (WebAssembly).
// Gespeichert wird nur auf dem Handy (IndexedDB) – nichts geht ins Netz.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqlDb } from '../src/core/db';

const IDB = 'tirys-mails', TABELLE = 'datenbank', SCHLUESSEL = 'aufraeumer';

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABELLE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}
async function lesen(): Promise<Uint8Array | null> {
  try {
    const d = await idb();
    return await new Promise((ok) => { const r = d.transaction(TABELLE).objectStore(TABELLE).get(SCHLUESSEL); r.onsuccess = () => ok(r.result ?? null); r.onerror = () => ok(null); });
  } catch { return null; }
}
async function schreiben(daten: Uint8Array) {
  try {
    const d = await idb();
    await new Promise<void>((ok) => { const t = d.transaction(TABELLE, 'readwrite'); t.objectStore(TABELLE).put(daten, SCHLUESSEL); t.oncomplete = () => ok(); t.onerror = () => ok(); });
  } catch { /* privat-modus – dann eben nur für diese Sitzung */ }
}

/** Werte so umwandeln, wie node:sqlite sie annimmt (true/false → 1/0, undefined → null). */
const wert = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'bigint' ? Number(v) : v);

export async function oeffneHandyDb(): Promise<SqlDb & { speichernJetzt(): Promise<void> }> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const alt = await lesen();
  const d = alt ? new SQL.Database(alt) : new SQL.Database();
  let geaendert = false, timer: ReturnType<typeof setTimeout> | null = null;
  const speichernJetzt = async () => { if (!geaendert) return; geaendert = false; await schreiben(d.export()); };
  const merken = () => { geaendert = true; if (!timer) timer = setTimeout(() => { timer = null; void speichernJetzt(); }, 1500); };
  addEventListener('pagehide', () => { if (geaendert) void schreiben(d.export()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void speichernJetzt(); });

  return {
    exec(sql: string) { d.exec(sql); merken(); },
    prepare(sql: string) {
      return {
        get(...a: unknown[]) {
          const s = d.prepare(sql);
          try { s.bind(a.map(wert) as any); return s.step() ? s.getAsObject() : undefined; } finally { s.free(); }
        },
        all(...a: unknown[]) {
          const s = d.prepare(sql); const out: any[] = [];
          try { s.bind(a.map(wert) as any); while (s.step()) out.push(s.getAsObject()); return out; } finally { s.free(); }
        },
        run(...a: unknown[]) {
          d.run(sql, a.map(wert) as any);
          const changes = d.getRowsModified();
          const id = d.exec('SELECT last_insert_rowid() AS i')[0]?.values[0][0] ?? 0;
          merken();
          return { lastInsertRowid: Number(id), changes };
        },
      };
    },
    close() { void speichernJetzt(); d.close(); },
    speichernJetzt,
  };
}
