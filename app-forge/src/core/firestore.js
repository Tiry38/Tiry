'use strict';
/**
 * Schlanker Firestore-REST-Client (ohne SDK-Abhängigkeiten) mit Service-Account-Login.
 * Funktioniert im Desktop (Electron) und in GitHub Actions.
 */
const crypto = require('crypto');

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) out[k] = encode(v);
  return out;
}

function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decode(v);
  return out;
}

function parseServiceAccount(raw) {
  if (!raw) return null;
  const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!sa.client_email || !sa.private_key) throw new Error('Service-Account-JSON unvollständig (client_email/private_key fehlen).');
  return sa;
}

class Firestore {
  constructor({ projectId, serviceAccount, fetchImpl = globalThis.fetch }) {
    this.sa = parseServiceAccount(serviceAccount);
    this.projectId = projectId || (this.sa && this.sa.project_id);
    if (!this.projectId) throw new Error('Firebase-Projekt-ID fehlt.');
    this.fetch = fetchImpl;
    this.base = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    this._token = null;
    this._exp = 0;
  }

  async token() {
    if (this._token && Date.now() < this._exp - 60000) return this._token;
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: this.sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const jwt = `${header}.${claims}.${b64url(signer.sign(this.sa.private_key))}`;
    const res = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Firebase-Login fehlgeschlagen: ${data.error_description || data.error || res.status}`);
    this._token = data.access_token;
    this._exp = Date.now() + (data.expires_in || 3600) * 1000;
    return this._token;
  }

  async request(method, url, body) {
    const res = await this.fetch(url, {
      method,
      headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${(data.error && data.error.message) || text.slice(0, 200)}`);
    return data;
  }

  docUrl(docPath) {
    return `${this.base}/${docPath.split('/').map(encodeURIComponent).join('/')}`;
  }

  async set(docPath, obj) {
    return this.request('PATCH', this.docUrl(docPath), { fields: encodeFields(obj) });
  }

  async update(docPath, obj) {
    const mask = Object.keys(obj).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    return this.request('PATCH', `${this.docUrl(docPath)}?${mask}`, { fields: encodeFields(obj) });
  }

  async get(docPath) {
    try {
      const d = await this.request('GET', this.docUrl(docPath));
      return { id: d.name.split('/').pop(), ...decodeFields(d.fields) };
    } catch (err) {
      if (/Firestore 404/.test(err.message)) return null;
      throw err;
    }
  }

  async add(collection, obj) {
    const d = await this.request('POST', `${this.base}/${encodeURIComponent(collection)}`, { fields: encodeFields(obj) });
    return d.name.split('/').pop();
  }

  async where(collection, field, value, limit = 25) {
    const rows = await this.request('POST', `${this.base}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } },
        limit
      }
    });
    return (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields) }));
  }
}

module.exports = { Firestore, encode, decode, encodeFields, decodeFields };
