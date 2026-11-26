import { describe, it, expect } from 'vitest';
import { FAELLE } from './fixtures/mails';
import { ordneEin, type Kontext } from '../src/core/pipeline';
import { standardEinstellungen } from '../src/core/settings';
import { planeAktionen } from '../src/core/actions';
import { parseAdresse } from '../src/core/headers';
import type { Regel } from '../src/core/types';

function kontext(teil: Partial<Kontext> = {}, kontakte: string[] = []): Kontext {
  const set = new Set(kontakte.map((k) => k.toLowerCase()));
  return { einstellungen: standardEinstellungen(), regeln: [], istKontakt: (a) => set.has(a), historie: () => null, ...teil };
}
const KONTAKTE = FAELLE.filter((f) => f.kontakt).map((f) => parseAdresse(f.mail.headers.from).adresse);

describe('Einordnung der 36 Beispiel-Mails', () => {
  it('hat mindestens 30 Fixtures', () => expect(FAELLE.length).toBeGreaterThanOrEqual(30));

  for (const f of FAELLE) {
    it(`${f.name} → ${f.erwartet}`, async () => {
      const r = await ordneEin(f.mail, kontext({}, KONTAKTE));
      expect(r.entscheidung.kategorie).toBe(f.erwartet);
      expect(r.entscheidung.begruendung.length).toBeGreaterThan(10);
      if (f.geschuetzt !== undefined) expect(r.schutz.geschuetzt).toBe(f.geschuetzt);
    });
  }

  it('keine Rechnung und keine private Mail landet im Papierkorb – auch bei strengster Einstellung', async () => {
    const e = standardEinstellungen();
    e.schwelle = 0; // „streng“: alles wird ausgeführt
    for (const k of Object.keys(e.aktionen) as Array<keyof typeof e.aktionen>) e.aktionen[k] = ['papierkorb'];
    e.aktionen.wichtig = ['behalten']; e.aktionen.persoenlich = ['behalten'];
    for (const f of FAELLE.filter((x) => x.niePapierkorb)) {
      const r = await ordneEin(f.mail, kontext({ einstellungen: e }, KONTAKTE));
      const plan = r.schutz.geschuetzt ? null : planeAktionen(r.entscheidung.kategorie, e.aktionen[r.entscheidung.kategorie], f.mail, r.signale, { abmeldenErlaubt: true });
      expect(plan?.papierkorb ?? false, f.name).toBe(false);
    }
  });

  it('Phishing wird nie abgemeldet', async () => {
    for (const f of FAELLE.filter((x) => x.erwartet === 'phishing')) {
      const r = await ordneEin(f.mail, kontext());
      const plan = planeAktionen('phishing', ['label', 'archivieren', 'abmelden'], f.mail, { ...r.signale, listUnsubscribe: { http: ['https://x.de'], mailto: [], oneClick: true } }, { abmeldenErlaubt: true });
      expect(plan.abmelden).toBe(false);
    }
  });

  it('Weiße Liste schützt, Schwarze Liste überstimmt Signale', async () => {
    const f = FAELLE.find((x) => x.name === 'Shop-Werbung')!;
    const weiss: Regel = { id: 1, art: 'weiss', feld: 'domain', wert: 'zalando.de', kategorie: null, aktiv: true, bestaetigt: 1, gmailFilterId: null, erstellt: 0 };
    const r1 = await ordneEin(f.mail, kontext({ regeln: [weiss] }));
    expect(r1.schutz.geschuetzt).toBe(true);
    const p = FAELLE.find((x) => x.name === 'Unbekannte Privatperson')!;
    const schwarz: Regel = { ...weiss, id: 2, art: 'schwarz', feld: 'adresse', wert: 'sabine.mueller@t-online.de', kategorie: 'spam' };
    const r2 = await ordneEin(p.mail, kontext({ regeln: [schwarz] }));
    expect(r2.entscheidung).toMatchObject({ kategorie: 'spam', stufe: 'regeln', sicherheit: 99 });
  });

  it('gelernte Regel wird mit jeder Bestätigung sicherer', async () => {
    const f = FAELLE.find((x) => x.name === 'Werbung ohne Header')!;
    const base = await ordneEin(f.mail, kontext());
    expect(base.entscheidung.sicherheit).toBeLessThan(85); // landet in „Zu prüfen“
    const r = (b: number): Regel => ({ id: 3, art: 'gelernt', feld: 'adresse', wert: 'werbung@weko.de', kategorie: 'werbung', aktiv: true, bestaetigt: b, gmailFilterId: null, erstellt: 0 });
    expect((await ordneEin(f.mail, kontext({ regeln: [r(1)] }))).entscheidung.sicherheit).toBe(86);
    expect((await ordneEin(f.mail, kontext({ regeln: [r(3)] }))).entscheidung.sicherheit).toBe(98);
  });

  it('Absender-Historie: nie geöffnet erhöht, oft geöffnet senkt die Sicherheit', async () => {
    const f = FAELLE.find((x) => x.name === 'Shop-Werbung')!;
    const nie = await ordneEin(f.mail, kontext({ historie: () => ({ anzahl: 10, gelesen: 0 }) }));
    const oft = await ordneEin(f.mail, kontext({ historie: () => ({ anzahl: 10, gelesen: 8 }) }));
    expect(nie.entscheidung.sicherheit).toBeGreaterThan(90);
    expect(oft.entscheidung.sicherheit).toBeLessThan(85);
  });

  it('KI wird nur bei unsicheren Fällen gefragt und bekommt nur Absender, Betreff, Snippet', async () => {
    const gesehen: any[] = [];
    const ki = { async klassifiziere(e: any) { gesehen.push(e); return { kategorie: 'werbung' as const, sicherheit: 93, begruendung: 'Verkaufsangebot.', kostenUsd: 0.00002 }; } };
    const e = { ...standardEinstellungen(), kiAn: true };
    let gebucht = 0;
    const budget = { frei: () => true, buchen: (u: number) => { gebucht += u; } };
    const sicher = FAELLE.find((x) => x.name === 'Shop-Werbung')!;
    await ordneEin(sicher.mail, kontext({ einstellungen: e, ki, kiBudget: budget }));
    expect(gesehen.length).toBe(0);
    const unsicher = FAELLE.find((x) => x.name === 'Werbung ohne Header')!;
    const r = await ordneEin(unsicher.mail, kontext({ einstellungen: e, ki, kiBudget: budget }));
    expect(r.entscheidung).toMatchObject({ stufe: 'ki', kategorie: 'werbung', sicherheit: 93 });
    expect(Object.keys(gesehen[0]).sort()).toEqual(['absender', 'betreff', 'name', 'snippet']);
    expect(gebucht).toBeGreaterThan(0);
    // Budget erschöpft → keine KI
    gesehen.length = 0;
    await ordneEin(unsicher.mail, kontext({ einstellungen: e, ki, kiBudget: { frei: () => false, buchen: () => {} } }));
    expect(gesehen.length).toBe(0);
  });
});
