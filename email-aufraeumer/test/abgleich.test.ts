import { describe, it, expect } from 'vitest';
import { Speicher } from '../src/core/db';
import { SpeicherGmail } from '../src/core/speicherGmail';
import { pcExport, pcImport, handyExport, handyImport, datenNachricht, PC_DATEN } from '../src/core/abgleich';

const eintrag = (mailId: string, zeit: number, durchlauf = 'lauf') => ({ zeit, durchlauf, mailId, absender: 'a@shop.de', betreff: 'x', kategorie: 'werbung' as const,
  sicherheit: 95, stufe: 'regeln', begruendung: 'test', aktionen: ['archivieren' as const], trocken: false, vorherLabels: ['INBOX'], nachherLabels: [], status: 'ok' as const, hinweis: null });

describe('Abgleich PC ⇄ Handy', () => {
  it('Handy übernimmt alles vom PC, schickt eigene Änderungen zurück – ohne Doppelte', async () => {
    const pc = new Speicher(), handy = new Speicher();
    pc.protokolliere(eintrag('m1', 1000)); pc.protokolliere(eintrag('m2', 2000));
    pc.regelMerken('schwarz', 'adresse', 'spam@x.de', 'spam', 1500);
    pc.kontakteSetzen(['mama@web.de']); pc.markiereVerarbeitet('m1', 1000);
    pc.speichereEinstellungen({ schwelle: 91 });
    // Transport über einen Entwurf mit Anhang
    const g = new SpeicherGmail();
    await g.standSpeichern!(datenNachricht(PC_DATEN, 'tiry@gmail.com', JSON.stringify(pcExport(pc, 5000))), null);
    const t = await g.entwurfDatei!(PC_DATEN);
    expect(pcImport(handy, JSON.parse(t!))).toBe(true);
    expect(handy.protokoll({}).map((e) => e.mailId).sort()).toEqual(['m1', 'm2']);
    expect(handy.istKontakt('mama@web.de')).toBe(true);
    expect(handy.einstellungen().schwelle).toBe(91);
    expect(handy.einstellungen().trockenlauf).toBe(true);            // Probelauf bleibt Sache des Handys
    // Handy arbeitet weiter …
    handy.protokolliere(eintrag('m3', 6000, 'handy-lauf'));
    handy.regelMerken('gelernt', 'adresse', 'news@shop.de', 'newsletter', 6000);
    const h = handyExport(handy, 7000)!;
    expect(h.protokoll.map((z) => z.mail_id)).toEqual(['m3']);
    expect(handyImport(pc, h)).toBe(1);
    expect(handyImport(pc, h)).toBe(0);                                // gleiche Daten nicht nochmal
    expect(pc.protokoll({}).map((e) => e.mailId).sort()).toEqual(['m1', 'm2', 'm3']);
    expect(pc.regeln().some((r) => r.wert === 'news@shop.de')).toBe(true);
    // nächster PC-Stand: Handy-Eintrag kommt nicht doppelt zurück
    expect(pcImport(handy, pcExport(pc, 8000))).toBe(true);
    expect(handy.protokoll({}).filter((e) => e.mailId === 'm3')).toHaveLength(1);
  });
});
