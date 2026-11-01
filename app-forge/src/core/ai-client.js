'use strict';
/**
 * KI-Client für Claude (Anthropic SDK) mit Kosten-/Budget-Kontrolle.
 * - Streaming + finalMessage() (lange Ausgaben ohne HTTP-Timeout)
 * - Server-seitiger Fallback bei Ablehnungen (fallbacks: "default")
 * - Prompt-Caching auf dem stabilen System-Prompt
 * - Tagesbudget in US-Dollar und maximale Aufrufe pro Tag
 */
const fs = require('fs');
const { Anthropic } = require('@anthropic-ai/sdk');

// Preise in US-$ pro 1 Mio. Tokens (Stand Okt. 2026, Anthropic-Preisliste).
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-fable-5-1': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5': [2, 10]
};

const MODELS = [
  { value: 'claude-opus-5-5', label: 'Opus 5.5 – beste Qualität (Standard)' },
  { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5 – schneller & günstiger' },
  { value: 'claude-haiku-5-5', label: 'Haiku 5.5 – sehr günstig' }
];

class BudgetError extends Error {}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function costOf(model, usage) {
  const [pin, pout] = PRICES[model] || PRICES['claude-opus-5-5'];
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  return (input * pin + (usage.output_tokens || 0) * pout) / 1e6;
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new Error('API-Key ungültig oder abgelaufen.');
  if (err instanceof Anthropic.PermissionDeniedError) return new Error('Keine Berechtigung für dieses Modell/Feature.');
  if (err instanceof Anthropic.RateLimitError) return new Error('Rate-Limit erreicht – der Autopilot versucht es später erneut.');
  if (err instanceof Anthropic.APIConnectionError) return new Error('Keine Verbindung zur KI (Internet prüfen).');
  if (err instanceof Anthropic.APIError) return new Error(`KI-Fehler ${err.status || ''}: ${err.message}`);
  return err;
}

class AiClient {
  constructor({ apiKey, model = 'claude-opus-5-5', usageFile, limits = () => ({ dailyUsd: 5, dailyCalls: 60 }), emit = () => {}, baseURL } = {}) {
    this.apiKey = apiKey || '';
    this.model = model || 'claude-opus-5-5';
    this.usageFile = usageFile;
    this.limits = limits;
    this.emit = emit;
    this.useFallbacks = this.model !== 'claude-haiku-5-5';
    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey, ...(baseURL ? { baseURL } : {}), maxRetries: 3 }) : null;
    this.data = this._read();
  }

  isAvailable() {
    return !!this.client;
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.usageFile, 'utf8'));
    } catch {
      return { days: {} };
    }
  }

  _write() {
    if (!this.usageFile) return;
    const keys = Object.keys(this.data.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete this.data.days[k];
    fs.writeFileSync(this.usageFile, JSON.stringify(this.data, null, 2));
  }

  usage() {
    const day = this.data.days[today()] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const history = Object.entries(this.data.days).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, d]) => ({ date, calls: d.calls, costUsd: Math.round(d.costUsd * 1000) / 1000 }));
    return { available: this.isAvailable(), model: this.model, today: { date: today(), ...day, costUsd: Math.round(day.costUsd * 1000) / 1000 }, limits: this.limits(), history };
  }

  budgetLeft() {
    const { dailyUsd, dailyCalls } = this.limits();
    const day = this.data.days[today()] || { calls: 0, costUsd: 0 };
    return { usd: dailyUsd - day.costUsd, calls: dailyCalls - day.calls };
  }

  _checkBudget() {
    const left = this.budgetLeft();
    if (left.usd <= 0) throw new BudgetError('Tagesbudget (US-$) erreicht – weiter geht es morgen oder mit höherem Budget.');
    if (left.calls <= 0) throw new BudgetError('Maximale KI-Aufrufe für heute erreicht.');
  }

  _record(msg, purpose) {
    const model = PRICES[msg.model] ? msg.model : this.model;
    const usage = msg.usage || {};
    const cost = costOf(model, usage);
    const key = today();
    const day = this.data.days[key] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    day.calls += 1;
    day.inputTokens += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    day.outputTokens += usage.output_tokens || 0;
    day.costUsd += cost;
    this.data.days[key] = day;
    this._write();
    this.emit('ai.call', { model: msg.model, purpose, inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0, cacheRead: usage.cache_read_input_tokens || 0, costUsd: Math.round(cost * 10000) / 10000 });
  }

  async _call(params, { purpose = 'ki', signal } = {}) {
    if (!this.client) throw new Error('Kein API-Key hinterlegt.');
    this._checkBudget();
    const base = { model: this.model, ...params };
    const attempt = async (withFallback) => {
      const req = withFallback ? { ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : base;
      const stream = this.client.beta.messages.stream(req, signal ? { signal } : undefined);
      return stream.finalMessage();
    };
    let msg;
    try {
      msg = await attempt(this.useFallbacks);
    } catch (err) {
      if (this.useFallbacks && err instanceof Anthropic.BadRequestError && /fallback/i.test(String(err.message))) {
        this.useFallbacks = false; // Konto/Modell ohne Fallback-Unterstützung
        try {
          msg = await attempt(false);
        } catch (e2) {
          throw friendlyError(e2);
        }
      } else {
        throw friendlyError(err);
      }
    }
    this._record(msg, purpose);
    if (msg.stop_reason === 'refusal') throw new Error('Die KI hat diese Anfrage abgelehnt (Sicherheitsfilter). Neuer Versuch mit anderer Idee.');
    return msg;
  }

  static textOf(msg) {
    return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  static system(text) {
    return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
  }

  /** Lange Textausgabe (z. B. komplettes HTML). */
  async text({ system, prompt, maxTokens = 64000, effort = 'high', purpose, signal }) {
    const msg = await this._call(
      { max_tokens: maxTokens, system: AiClient.system(system), output_config: { effort }, messages: [{ role: 'user', content: prompt }] },
      { purpose, signal }
    );
    if (msg.stop_reason === 'max_tokens') throw new Error('KI-Antwort wurde abgeschnitten (zu lang).');
    return AiClient.textOf(msg);
  }

  /** Strukturierte JSON-Ausgabe gemäß Schema, optional mit Bild (Screenshot-Review). */
  async json({ system, prompt, schema, effort = 'medium', maxTokens = 16000, purpose, signal, imagePng }) {
    const content = imagePng
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(imagePng).toString('base64') } }, { type: 'text', text: prompt }]
      : prompt;
    const msg = await this._call(
      {
        max_tokens: maxTokens,
        system: AiClient.system(system),
        output_config: { effort, format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content }]
      },
      { purpose, signal }
    );
    const text = AiClient.textOf(msg);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('KI lieferte kein gültiges JSON.');
    }
  }

  /** Recherche mit Websuche (Trend-Radar). */
  async research({ system, prompt, maxUses = 6, effort = 'medium', signal }) {
    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxUses }];
    const messages = [{ role: 'user', content: prompt }];
    let msg = await this._call({ max_tokens: 32000, system: AiClient.system(system), tools, output_config: { effort }, messages }, { purpose: 'trends', signal });
    for (let i = 0; i < 4 && msg.stop_reason === 'pause_turn'; i++) {
      msg = await this._call(
        { max_tokens: 32000, system: AiClient.system(system), tools, output_config: { effort }, messages: [...messages, { role: 'assistant', content: msg.content }] },
        { purpose: 'trends', signal }
      );
    }
    return AiClient.textOf(msg);
  }

  async test() {
    const text = await this.text({ system: 'Du bist ein Verbindungstest.', prompt: 'Antworte nur mit: OK', maxTokens: 4000, effort: 'low', purpose: 'test' });
    return { ok: /ok/i.test(text), message: `Verbunden mit ${this.model}` };
  }
}

module.exports = { AiClient, BudgetError, PRICES, MODELS, costOf };
