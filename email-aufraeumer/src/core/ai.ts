// Stufe 3 – optionale KI (Claude Haiku 5.5) nur für unsichere Fälle.
// Sicherheitsregel 7: Es gehen NUR Absender, Betreff und Snippet raus – nie der ganze Text, nie Anhänge.
import type { KiAntwort, KiEingabe, KiPort } from './pipeline';
import type { Kategorie } from './types';
import { KATEGORIEN } from './types';

export const KI_MODELL = 'claude-haiku-5-5';
// Preise laut Anthropic (USD je 1 Mio. Tokens, bis 100K Prompt-Tokens)
export const PREIS_EINGABE_USD = 0.10;
export const PREIS_AUSGABE_USD = 0.50;

const SYSTEM = `Du ordnest E-Mails eines privaten Gmail-Postfachs in Deutschland ein. Du siehst nur Absender, Anzeigename, Betreff und eine kurze Vorschau.
Kategorien: wichtig (Behörden, Verträge, Geld, Arbeit), persoenlich (echte Menschen schreiben persönlich), werbung (Verkauf, Rabatte, Angebote),
newsletter (regelmäßige Infos eines Verteilers), benachrichtigung (automatische Mitteilungen: Versand, Konto, Termine, soziale Netzwerke),
spam (unerwünschte Massenmail), phishing (gibt sich als Bank/Firma aus, will Daten/Klick/Zahlung, Absender passt nicht).
Sei vorsichtig: Im Zweifel niedrigere Sicherheit. Begründung: ein kurzer deutscher Satz.`;

const SCHEMA = {
  type: 'object',
  properties: {
    kategorie: { type: 'string', enum: KATEGORIEN },
    sicherheit: { type: 'integer', minimum: 0, maximum: 100 },
    begruendung: { type: 'string' },
  },
  required: ['kategorie', 'sicherheit', 'begruendung'],
  additionalProperties: false,
};

export function kostenUsd(eingabe: number, ausgabe: number): number {
  return (eingabe * PREIS_EINGABE_USD + ausgabe * PREIS_AUSGABE_USD) / 1_000_000;
}

/** Baut den Text, der an die KI geht – ausschließlich die drei erlaubten Felder. */
export function kiNachricht(e: KiEingabe): string {
  const kurz = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);
  return `Absender: ${kurz(e.name, 80)} <${kurz(e.absender, 120)}>\nBetreff: ${kurz(e.betreff, 200)}\nVorschau: ${kurz(e.snippet, 300)}`;
}

/** API-Key kommt aus der Umgebungsvariable ANTHROPIC_API_KEY – nie aus dem Code. */
export function erzeugeClaudeKi(): KiPort | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
  const client = new Anthropic({ maxRetries: 3, timeout: 30_000 });
  return {
    async klassifiziere(e: KiEingabe): Promise<KiAntwort> {
      const r = await client.messages.create({
        model: KI_MODELL,
        max_tokens: 256,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: kiNachricht(e) }],
      } as any);
      const kosten = kostenUsd(r.usage.input_tokens, r.usage.output_tokens);
      if (r.stop_reason === 'refusal') throw Object.assign(new Error('KI hat abgelehnt'), { kostenUsd: kosten });
      const text = r.content.find((b: any) => b.type === 'text') as any;
      const j = JSON.parse(text?.text ?? '{}');
      if (!KATEGORIEN.includes(j.kategorie)) throw new Error('Unbekannte Kategorie von der KI');
      return { kategorie: j.kategorie as Kategorie, sicherheit: Number(j.sicherheit) || 0, begruendung: String(j.begruendung ?? ''), kostenUsd: kosten };
    },
  };
}

/** Monatsbudget in Euro, Verbrauch im Speicher. */
export function kiBudget(get: () => { ausgegebenUsd: number; monat: string }, set: (v: { ausgegebenUsd: number; monat: string }) => void, budgetEuro: () => number, usdProEuro: () => number) {
  const monat = () => new Date().toISOString().slice(0, 7);
  const stand = () => { const s = get(); return s.monat === monat() ? s : { ausgegebenUsd: 0, monat: monat() }; };
  return {
    frei: () => stand().ausgegebenUsd / usdProEuro() < budgetEuro(),
    buchen: (usd: number) => { const s = stand(); set({ ausgegebenUsd: s.ausgegebenUsd + usd, monat: s.monat }); },
    ausgegebenEuro: () => stand().ausgegebenUsd / usdProEuro(),
  };
}
