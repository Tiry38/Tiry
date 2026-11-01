'use strict';
/**
 * Prüft den echten Claude-Client (Anthropic SDK) gegen einen lokalen Fake-Server:
 * exakte Anfrage (Modell, effort, JSON-Schema, Fallback-Beta, Prompt-Caching, Bild),
 * automatisches Abschalten des Fallbacks, Budget-Bremse, Websuche mit pause_turn.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AiClient, BudgetError } = require('../src/core/ai-client');

function sse(text, { stopReason = 'end_turn', model = 'claude-opus-5-5', extraBlocks = [] } = {}) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  let out = ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 500 } } });
  let i = 0;
  for (const b of extraBlocks) {
    out += ev('content_block_start', { index: i, content_block: b });
    out += ev('content_block_stop', { index: i });
    i++;
  }
  out += ev('content_block_start', { index: i, content_block: { type: 'text', text: '' } });
  out += ev('content_block_delta', { index: i, delta: { type: 'text_delta', text } });
  out += ev('content_block_stop', { index: i });
  out += ev('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 2000 } });
  out += ev('message_stop', {});
  return out;
}

async function fakeServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const r = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
      requests.push(r);
      handler(r, res, requests.length);
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { requests, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok)) };
}

const sendSse = (res, payload) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(payload);
};
const usageFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-ai-')), 'usage.json');

test('Claude-Client: JSON-Anfrage hat Schema, effort, Fallback, Caching und Bild', async () => {
  const srv = await fakeServer((r, res) => sendSse(res, sse('{"design":9}')));
  try {
    const ai = new AiClient({ apiKey: 'sk-test', baseURL: srv.url, usageFile: usageFile() });
    const schema = { type: 'object', additionalProperties: false, required: ['design'], properties: { design: { type: 'integer' } } };
    const out = await ai.json({ system: 'Jury', prompt: 'Bewerte', schema, effort: 'medium', purpose: 'review', imagePng: Buffer.from([1, 2, 3]) });
    assert.deepEqual(out, { design: 9 });
    const { body, headers, url } = srv.requests[0];
    assert.match(url, /^\/v1\/messages/);
    assert.equal(body.model, 'claude-opus-5-5');
    assert.equal(body.stream, true);
    assert.equal(body.fallbacks, 'default');
    assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
    assert.deepEqual(body.output_config, { effort: 'medium', format: { type: 'json_schema', schema } });
    assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
    assert.equal(body.messages[0].content[0].type, 'image');
    assert.equal(body.messages[0].content[0].source.data, Buffer.from([1, 2, 3]).toString('base64'));
    assert.equal(body.thinking, undefined);
    assert.equal(body.temperature, undefined);
    const u = ai.usage();
    assert.equal(u.today.calls, 1);
    assert.ok(u.today.costUsd > 0);
  } finally {
    await srv.close();
  }
});

test('Claude-Client: Konto ohne Fallback-Beta → automatisch ohne weiter', async () => {
  const srv = await fakeServer((r, res) => {
    if (r.body.fallbacks) {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: not enabled for this account' } }));
    }
    sendSse(res, sse('OK'));
  });
  try {
    const ai = new AiClient({ apiKey: 'sk-test', baseURL: srv.url, usageFile: usageFile() });
    const t = await ai.test();
    assert.equal(t.ok, true);
    assert.equal(srv.requests.length, 2);
    assert.equal(srv.requests[1].body.fallbacks, undefined);
    assert.equal(ai.useFallbacks, false);
  } finally {
    await srv.close();
  }
});

test('Claude-Client: Budget-Bremse stoppt vor dem Aufruf', async () => {
  const srv = await fakeServer((r, res) => sendSse(res, sse('OK')));
  try {
    const ai = new AiClient({ apiKey: 'sk-test', baseURL: srv.url, usageFile: usageFile(), limits: () => ({ dailyUsd: 100, dailyCalls: 1 }) });
    await ai.text({ system: 's', prompt: 'p', purpose: 'build' });
    await assert.rejects(ai.text({ system: 's', prompt: 'p', purpose: 'build' }), BudgetError);
    assert.equal(srv.requests.length, 1);
  } finally {
    await srv.close();
  }
});

test('Claude-Client: abgeschnittene oder abgelehnte Antworten werden nicht als App übernommen', async () => {
  let n = 0;
  const srv = await fakeServer((r, res) => sendSse(res, sse('<!DOCTYPE html>…', { stopReason: ++n === 1 ? 'max_tokens' : 'refusal' })));
  try {
    const ai = new AiClient({ apiKey: 'sk-test', baseURL: srv.url, usageFile: usageFile() });
    await assert.rejects(ai.text({ system: 's', prompt: 'p' }), /abgeschnitten/);
    await assert.rejects(ai.text({ system: 's', prompt: 'p' }), /abgelehnt/);
  } finally {
    await srv.close();
  }
});

test('Claude-Client: Websuche setzt nach pause_turn fort', async () => {
  const srv = await fakeServer((r, res, n) => {
    if (n === 1) return sendSse(res, sse('', { stopReason: 'pause_turn', extraBlocks: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'top grossing apps' } }] }));
    sendSse(res, sse('Bericht fertig'));
  });
  try {
    const ai = new AiClient({ apiKey: 'sk-test', baseURL: srv.url, usageFile: usageFile() });
    const text = await ai.research({ system: 'Analyst', prompt: 'Trends?' });
    assert.equal(text, 'Bericht fertig');
    assert.equal(srv.requests.length, 2);
    assert.equal(srv.requests[0].body.tools[0].type, 'web_search_20260209');
    const second = srv.requests[1].body.messages;
    assert.equal(second.length, 2);
    assert.equal(second[1].role, 'assistant');
    assert.equal(second[1].content[0].type, 'server_tool_use');
  } finally {
    await srv.close();
  }
});

test('Claude-Client: ohne API-Key klare Meldung statt Absturz', async () => {
  const ai = new AiClient({ apiKey: '', usageFile: usageFile() });
  assert.equal(ai.isAvailable(), false);
  await assert.rejects(ai.text({ system: 's', prompt: 'p' }), /Kein API-Key/);
});
