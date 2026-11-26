import { describe, it, expect } from 'vitest';
import { SpeicherGmail } from '../src/core/speicherGmail';
import { Speicher } from '../src/core/db';
import { Postfach } from '../src/core/postfach';
import { baueMail, zerlegeVoll, betreffMit, dekodiere } from '../src/core/mime';
import type { Mail } from '../src/core/types';

function mail(id: string, von: string, betreff: string, labels = ['INBOX', 'UNREAD'], zeit = 1000): Mail {
  return { id, threadId: `t-${id}`, labelIds: labels, snippet: `Vorschau ${betreff}`, internalDate: zeit, headers: { from: von, to: 'tiry@gmail.com', subject: betreff, 'message-id': `<${id}@x>` } };
}
function aufbau() {
  const g = new SpeicherGmail(); const db = new Speicher(); const p = new Postfach(g, (id) => (db.db.prepare('SELECT kategorie FROM protokoll WHERE mail_id = ? ORDER BY id DESC LIMIT 1').get(id) as any)?.kategorie ?? null, () => 'Tiry <tiry@gmail.com>');
  g.hinzufuegen(mail('a', 'Amazon <shop@amazon.de>', 'Ihre Bestellung', ['INBOX', 'UNREAD'], 3000));
  g.hinzufuegen(mail('b', 'Mama <mama@web.de>', 'Sonntag?', ['INBOX'], 2000));
  g.hinzufuegen(mail('c', 'Alt <alt@x.de>', 'Archiviert', [], 1000));
  g.inhalte.set('a', { html: '<p>Hallo <b>Tiry</b></p>', text: 'Hallo Tiry' });
  return { g, db, p };
}

describe('Tiry’s Mails – Postfach', () => {
  it('Ordner: System-Ordner plus eigene Labels', async () => {
    const { g, p } = aufbau();
    await g.labelAnlegen('Amazon'); await g.labelAnlegen('Aufräumer'); await g.labelAnlegen('Aufräumer/Werbung');
    const o = await p.ordner();
    expect(o.slice(0, 6).map((x) => x.name)).toEqual(['Posteingang', 'Mit Stern', 'Gesendet', 'Alle Mails', 'Spam', 'Papierkorb']);
    expect(o.find((x) => x.name === 'Amazon')?.art).toBe('firma');
    expect(o.find((x) => x.name === 'Werbung')?.art).toBe('sorte');
    expect(o.some((x) => x.name === 'Aufräumer')).toBe(false);
    expect(o[0].ungelesen).toBe(1);
  });

  it('Liste: neueste zuerst, nur der Ordner, Suche', async () => {
    const { p } = aufbau();
    const r = await p.liste('INBOX');
    expect(r.zeilen.map((z) => z.id)).toEqual(['a', 'b']);
    expect(r.zeilen[0]).toMatchObject({ von: 'Amazon', ungelesen: true, betreff: 'Ihre Bestellung' });
    expect((await p.liste('ALLE')).zeilen).toHaveLength(3);
    expect((await p.liste('INBOX', 'sonntag')).zeilen.map((z) => z.id)).toEqual(['b']);
  });

  it('Lesen: HTML und Text, markiert als gelesen', async () => {
    const { g, p } = aufbau();
    const m = await p.lesen('a');
    expect(m.html).toContain('<b>Tiry</b>');
    expect(m.text).toBe('Hallo Tiry');
    expect(g.get('a').labelIds).not.toContain('UNREAD');
  });

  it('Aktionen und Rückgängig stellen exakt wieder her', async () => {
    const { g, p } = aufbau();
    const vorher = [...g.get('a').labelIds];
    await p.aktion(['a'], 'papierkorb');
    expect(g.get('a').labelIds).toContain('TRASH');
    expect(await p.rueckgaengig()).toBe(1);
    expect(new Set(g.get('a').labelIds)).toEqual(new Set(vorher));
    const id = await p.ordnerAnlegen('Amazon');
    await p.aktion(['a'], { ordner: id });
    expect(g.get('a').labelIds).toContain(id);
    expect(g.get('a').labelIds).not.toContain('INBOX');
    await p.aktion(['b'], 'stern');
    expect(g.get('b').labelIds).toContain('STARRED');
  });

  it('Antworten: Empfänger, Re:, Zitat, im selben Gespräch', async () => {
    const { g, p } = aufbau();
    const v = await p.vorlage('a', 'antworten');
    expect(v.an).toEqual(['Amazon <shop@amazon.de>']);
    expect(v.betreff).toBe('Re: Ihre Bestellung');
    expect(v.text).toContain('> Hallo Tiry');
    await p.senden({ ...v, text: 'Danke!' + v.text });
    const raw = g.gesendet[0];
    expect(raw).toMatch(/^To: Amazon <shop@amazon.de>/m);
    expect(raw).toMatch(/^In-Reply-To: <a@x>/m);
    expect(raw).toMatch(/multipart\/alternative/);
    expect(raw).toMatch(/Content-Type: text\/html; charset=UTF-8/);
    expect(g.get('gesendet1').threadId).toBe('t-a');
    await expect(p.senden({ an: ['kein-empfaenger'], betreff: 'x', text: 'y' })).rejects.toThrow(/keine gültige Adresse/);
  });
});

describe('MIME', () => {
  it('Umlaute in Betreff und Text, Anhang', () => {
    const raw = baueMail({ von: 'tiry@gmail.com', an: ['Jörg <j@x.de>'], betreff: 'Grüße aus Wörth', text: 'Schöne Grüße\nTiry',
      anhaenge: [{ name: 'rechnung.pdf', mime: 'application/pdf', daten: new Uint8Array([1, 2, 3]) }] });
    expect(raw).toMatch(/^Subject: =\?UTF-8\?B\?/m);
    expect(raw).toMatch(/multipart\/mixed/);
    expect(raw).toMatch(/filename="rechnung.pdf"/);
    expect(raw).not.toMatch(/\nBcc:/);
    expect(betreffMit('Re', 'AW: Hallo')).toBe('AW: Hallo');
    expect(betreffMit('Fwd', 'Hallo')).toBe('Fwd: Hallo');
  });
  it('Zerlegen: Zeichensatz ISO-8859-1 und Anhänge', () => {
    const latin = Buffer.from('Grüße', 'latin1').toString('base64url');
    const v = zerlegeVoll({ id: 'x', threadId: 't', labelIds: [], internalDate: '5', payload: { mimeType: 'multipart/mixed', headers: [{ name: 'Subject', value: 'Hi' }], parts: [
      { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=ISO-8859-1' }], body: { data: latin } },
      { mimeType: 'application/pdf', filename: 'a.pdf', headers: [], body: { attachmentId: 'att1', size: 1234 } },
    ] } });
    expect(v.text).toBe('Grüße');
    expect(v.anhaenge).toEqual([expect.objectContaining({ name: 'a.pdf', anhangId: 'att1', groesse: 1234 })]);
    expect(dekodiere(new Uint8Array([0xfc]), 'windows-1252')).toBe('ü');
  });
});
