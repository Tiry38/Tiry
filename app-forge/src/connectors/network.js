'use strict';
/**
 * Netzwerk-Anschlüsse: WLAN-Vorschau aufs Handy, lokale REST-API, Webhooks,
 * Backup, Firebase (Fernsteuerung + Sync), GitHub (Cloud-Autopilot) und geplante Kabel.
 */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Firestore } = require('../core/firestore');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function lanIp() {
  const all = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
  const pref = all.find((i) => /^192\.168\./.test(i.address)) || all.find((i) => /^10\./.test(i.address)) || all[0];
  return pref ? pref.address : '127.0.0.1';
}

function safeJoin(root, rel) {
  const p = path.normalize(path.join(root, rel));
  return p.startsWith(path.normalize(root + path.sep)) ? p : null;
}

const lan = {
  id: 'publish.lan',
  name: 'WLAN-Vorschau (Handy)',
  kind: 'publish',
  description: 'Öffnet jede App per QR-Code auf deinem Handy im gleichen WLAN – inklusive „Zum Startbildschirm hinzufügen“.',
  requires: ['library'],
  settings: [{ key: 'port', label: 'Port', type: 'number', default: 4317 }],
  start(ctx) {
    const lib = ctx.require('library');
    const port = Number(ctx.config.get('port')) || 4317;
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://x');
        const m = url.pathname.match(/^\/a\/([a-z0-9-]+)\/?$/);
        if (m && lib.exists(m[1])) {
          res.writeHead(302, { location: `/apps/${m[1]}/v${lib.readMeta(m[1]).currentVersion}/index.html` });
          return res.end();
        }
        if (url.pathname === '/' || url.pathname === '/index.html') {
          const apps = lib.list();
          res.writeHead(200, { 'content-type': MIME['.html'] });
          return res.end(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tiry App Forge – Apps</title><style>body{margin:0;font-family:system-ui,sans-serif;background:radial-gradient(60% 40% at 20% 0%,#7c3aed55,transparent),radial-gradient(50% 40% at 90% 20%,#ec489955,transparent),#07070d;color:#f8fafc;padding:28px 18px}h1{font-size:28px;margin:0 0 18px;background:linear-gradient(90deg,#a78bfa,#f472b6,#fb923c);-webkit-background-clip:text;color:transparent}a{display:flex;gap:14px;align-items:center;padding:12px 16px;margin:10px 0;border-radius:999px;background:#ffffff12;border:1px solid #ffffff1f;color:inherit;text-decoration:none}img{width:48px;height:48px;border-radius:50%}small{color:#a5adc4;display:block}</style></head><body><h1>Deine Apps</h1>${apps.map((a) => `<a href="/a/${a.id}/"><img src="/apps/${a.id}/v${a.currentVersion}/icon.svg" alt=""><div><b>${String(a.name).replace(/</g, '&lt;')}</b><small>${String(a.tagline || '').replace(/</g, '&lt;')}</small></div></a>`).join('')}</body></html>`);
        }
        const fm = url.pathname.match(/^\/apps\/(.+)$/);
        const file = fm ? safeJoin(ctx.paths.apps, decodeURIComponent(fm[1])) : null;
        if (!file || /meta\.json$|_stage-/.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.writeHead(404);
          return res.end('Nicht gefunden');
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    let running = false;
    server.on('error', (err) => ctx.log('warn', `WLAN-Vorschau: ${err.message}`));
    server.listen(port, '0.0.0.0', () => { running = true; });
    ctx.onStop(() => server.close());
    ctx.action('lan.info', async ({ id } = {}) => {
      const ip = lanIp();
      const baseUrl = `http://${ip}:${port}/`;
      const appUrl = id ? `${baseUrl}a/${id}/` : baseUrl;
      let qrDataUrl = null;
      try {
        qrDataUrl = await require('qrcode').toDataURL(appUrl, { margin: 1, width: 360, color: { dark: '#0b0b14', light: '#ffffff' } });
      } catch {
        qrDataUrl = null;
      }
      return { running, ip, baseUrl, appUrl, qrDataUrl };
    }, { description: 'Handy-Vorschau-Adresse + QR' });
  }
};

const api = {
  id: 'api.local',
  name: 'Lokale REST-API',
  kind: 'api',
  description: 'Steckdose für andere Programme (n8n, Skripte, Stream Deck …): alle Befehle per HTTP + Live-Ereignisse (SSE).',
  settings: [
    { key: 'port', label: 'Port', type: 'number', default: 4318 },
    { key: 'allowLan', label: 'Aus dem Heimnetz erreichbar', type: 'boolean', default: false },
    { key: 'token', label: 'Zugriffs-Token', type: 'password', secret: true, default: '' }
  ],
  start(ctx) {
    let token = ctx.config.get('token');
    if (!token) {
      token = crypto.randomBytes(18).toString('base64url');
      ctx.config.set('token', token);
    }
    const port = Number(ctx.config.get('port')) || 4318;
    const host = ctx.config.get('allowLan') ? '0.0.0.0' : '127.0.0.1';
    const authed = (req, url) => {
      const h = req.headers.authorization || '';
      const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
      return t && t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token));
    };
    const send = (res, code, data) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(data));
    };
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST' });
        return res.end();
      }
      if (url.pathname === '/api/health') return send(res, 200, { ok: true, name: 'Tiry App Forge' });
      if (!authed(req, url)) return send(res, 401, { error: 'Token fehlt oder falsch' });
      if (url.pathname === '/api/actions') return send(res, 200, ctx.hub.actions.list().filter((a) => a.expose));
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
        const off = ctx.hub.bus.on('*', (e) => res.write(`data: ${JSON.stringify(e)}\n\n`), { by: 'api.local' });
        req.on('close', off);
        return undefined;
      }
      const m = url.pathname.match(/^\/api\/invoke\/([a-zA-Z0-9_.]+)$/);
      if (m && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
        req.on('end', async () => {
          try {
            const args = body ? JSON.parse(body) : {};
            send(res, 200, { ok: true, result: await ctx.hub.actions.invoke(m[1], args, { caller: 'api' }) });
          } catch (err) {
            send(res, 400, { ok: false, error: String(err.message || err) });
          }
        });
        return undefined;
      }
      return send(res, 404, { error: 'Unbekannter Pfad' });
    });
    let running = false;
    server.on('error', (err) => ctx.log('warn', `REST-API: ${err.message}`));
    server.listen(port, host, () => { running = true; });
    ctx.onStop(() => server.close());
    ctx.action('api.info', () => ({ running, port, baseUrl: `http://${host === '0.0.0.0' ? lanIp() : '127.0.0.1'}:${port}/api`, token }), { description: 'API-Zugang', expose: false });
  }
};

const webhooks = {
  id: 'integration.webhooks',
  name: 'Webhooks',
  kind: 'integration',
  description: 'Schickt Ereignisse an andere Dienste (Discord, n8n, Make, Zapier, Slack-Workflows). Signiert mit HMAC-SHA256.',
  defaultEnabled: false,
  settings: [
    { key: 'url', label: 'Ziel-URL', type: 'text', default: '' },
    { key: 'events', label: 'Ereignisse (Komma-getrennt, * erlaubt)', type: 'text', default: 'app.created,app.version.created,app.version.rejected' },
    { key: 'secret', label: 'Signatur-Geheimnis', type: 'password', secret: true, default: '' }
  ],
  start(ctx) {
    const url = ctx.config.get('url');
    if (!url) throw new Error('Keine Ziel-URL eingetragen.');
    const patterns = String(ctx.config.get('events') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const secret = ctx.config.get('secret');
    const discord = /discord(app)?\.com\/api\/webhooks/.test(url);
    let sent = 0;
    let lastError = null;
    for (const p of patterns) {
      ctx.bus.on(p, async (e) => {
        const body = discord ? JSON.stringify({ content: `**Tiry App Forge** · ${e.type}\n${e.payload.app ? e.payload.app.name : e.payload.name || e.payload.appId || ''} ${e.payload.reason || ''}`.slice(0, 1900) }) : JSON.stringify(e);
        const headers = { 'content-type': 'application/json' };
        if (secret) headers['x-forge-signature'] = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
        try {
          const res = await fetch(url, { method: 'POST', headers, body });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          sent++;
        } catch (err) {
          lastError = err.message;
        }
      });
    }
    ctx.action('webhooks.status', () => ({ url, patterns, sent, lastError }), { description: 'Webhook-Status' });
  },
  health(ctx) {
    return ctx.invoke('webhooks.status').then((s) => ({ ok: !s.lastError, message: s.lastError ? `Fehler: ${s.lastError}` : `${s.sent} gesendet` }));
  }
};

const backup = {
  id: 'system.backup',
  name: 'Backup',
  kind: 'storage',
  description: 'Spiegelt alle Apps regelmäßig in einen Ordner (z. B. OneDrive/Google Drive) – nichts geht verloren.',
  defaultEnabled: false,
  settings: [
    { key: 'folder', label: 'Backup-Ordner', type: 'text', default: '' },
    { key: 'intervalHours', label: 'Intervall (Stunden)', type: 'number', default: 24 }
  ],
  start(ctx) {
    const folder = ctx.config.get('folder');
    if (!folder) throw new Error('Kein Backup-Ordner eingetragen.');
    let last = null;
    const run = () => {
      const dest = path.join(folder, 'TiryAppForge-Backup');
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(ctx.paths.apps, path.join(dest, 'apps'), { recursive: true, force: true, filter: (src) => !/_stage-/.test(src) });
      for (const f of ['lessons.json', 'trends.json', 'stats.json']) {
        const p = path.join(ctx.paths.data, f);
        if (fs.existsSync(p)) fs.copyFileSync(p, path.join(dest, f));
      }
      last = Date.now();
      ctx.bus.emit('backup.done', { folder: dest });
      return { folder: dest, at: last };
    };
    const timer = setInterval(() => { try { run(); } catch (err) { ctx.log('warn', `Backup: ${err.message}`); } }, Math.max(1, Number(ctx.config.get('intervalHours')) || 24) * 3600e3);
    if (timer.unref) timer.unref();
    ctx.onStop(() => clearInterval(timer));
    ctx.action('backup.now', () => run(), { description: 'Backup jetzt' });
    ctx.action('backup.status', () => ({ enabled: true, folder, lastBackupAt: last }), { description: 'Backup-Status' });
  }
};

/** Befehle, die per Fernsteuerung (Firebase) ausgelöst werden dürfen. */
const REMOTE_ALLOWED = new Set(['forge.create', 'forge.evolve', 'forge.test', 'autopilot.set', 'autopilot.runNow', 'trends.refresh', 'export.app']);

const firebase = {
  id: 'cloud.firebase',
  name: 'Firebase (Fernsteuerung & Sync)',
  kind: 'integration',
  description: 'Synchronisiert Apps/Status nach Firestore und führt Befehle aus, die du per Handy (Fernsteuerungs-Seite) sendest.',
  defaultEnabled: false,
  requires: ['library'],
  settings: [
    { key: 'projectId', label: 'Firebase-Projekt-ID', type: 'text', default: '' },
    { key: 'serviceAccount', label: 'Service-Account-JSON (Inhalt einfügen)', type: 'password', secret: true, default: '' },
    { key: 'hostingUrl', label: 'Hosting-URL (z. B. https://projekt.web.app)', type: 'text', default: '' },
    { key: 'pollSeconds', label: 'Befehle prüfen alle (Sekunden)', type: 'number', default: 20 },
    { key: 'target', label: 'Dieser Rechner verarbeitet', type: 'select', default: 'desktop', options: [{ value: 'desktop', label: 'Befehle für den PC' }, { value: 'cloud', label: 'Befehle für die Cloud' }] }
  ],
  start(ctx) {
    const raw = ctx.config.get('serviceAccount') || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Service-Account fehlt.');
    const db = new Firestore({ projectId: ctx.config.get('projectId') || process.env.FIREBASE_PROJECT_ID, serviceAccount: raw });
    const target = ctx.config.get('target') || 'desktop';
    const state = { lastSyncAt: null, lastError: null, handled: 0, pending: 0 };
    const lib = ctx.require('library');
    const appDoc = (a) => ({ name: a.name, tagline: a.tagline || '', type: a.type || '', category: a.category || '', score: a.score ?? 0, version: a.currentVersion, accent: (a.palette && a.palette.accent) || [], source: target, updatedAt: new Date(a.updatedAt || Date.now()) });
    const syncApp = async (id) => {
      try {
        if (lib.exists(id)) await db.set(`apps/${id}`, appDoc(lib.readMeta(id)));
      } catch (err) {
        state.lastError = err.message;
      }
    };
    ctx.bus.on('app.created', (e) => syncApp(e.payload.app.id));
    ctx.bus.on('app.version.created', (e) => syncApp(e.payload.appId));
    ctx.bus.on('app.version.rejected', (e) => db.add('events', { type: 'rejected', appId: e.payload.appId || '', reason: e.payload.reason || '', at: new Date() }).catch(() => {}));

    const processCommands = async () => {
      const list = (await db.where('commands', 'status', 'pending', 20)).filter((c) => !c.target || c.target === 'any' || c.target === target);
      state.pending = list.length;
      for (const cmd of list) {
        await db.update(`commands/${cmd.id}`, { status: 'running', startedAt: new Date(), handledBy: target });
        ctx.bus.emit('cloud.command', { command: cmd.action, status: 'running' });
        try {
          if (!REMOTE_ALLOWED.has(cmd.action)) throw new Error(`Befehl ${cmd.action} ist für Fernsteuerung nicht erlaubt.`);
          const result = await ctx.invoke(cmd.action, cmd.args || {});
          await db.update(`commands/${cmd.id}`, { status: 'done', finishedAt: new Date(), result: JSON.parse(JSON.stringify(result || {})) });
          state.handled++;
          ctx.bus.emit('cloud.command', { command: cmd.action, status: 'done' });
        } catch (err) {
          await db.update(`commands/${cmd.id}`, { status: 'failed', finishedAt: new Date(), error: String(err.message || err) });
          ctx.bus.emit('cloud.command', { command: cmd.action, status: 'failed' });
        }
      }
    };
    const heartbeat = async () => {
      const pilot = ctx.get('autopilot');
      const ai = ctx.get('ai');
      await db.set(`status/${target}`, { online: true, lastSeen: new Date(), apps: lib.list().length, autopilot: pilot ? !!pilot.status().enabled : false, mode: ai && ai.isAvailable() ? 'ai' : 'offline', busy: ctx.jobs.isBusy() });
    };
    const poll = async () => {
      try {
        await heartbeat();
        await processCommands();
        state.lastSyncAt = Date.now();
        state.lastError = null;
      } catch (err) {
        state.lastError = String(err.message || err);
      }
    };
    const timer = setInterval(poll, Math.max(10, Number(ctx.config.get('pollSeconds')) || 20) * 1000);
    if (timer.unref) timer.unref();
    ctx.onStop(() => clearInterval(timer));
    setTimeout(poll, 1500).unref?.();
    ctx.provide('cloud', { db, processCommands, syncApp, syncAll: async () => { for (const a of lib.list()) await syncApp(a.id); } });
    ctx.action('cloud.status', () => ({ configured: true, projectId: db.projectId, hostingUrl: ctx.config.get('hostingUrl') || `https://${db.projectId}.web.app`, lastSyncAt: state.lastSyncAt, lastError: state.lastError, pollSeconds: Number(ctx.config.get('pollSeconds')) || 20, pendingCommands: state.pending, commandsHandled: state.handled }), { description: 'Firebase-Status' });
    ctx.action('cloud.syncNow', async () => {
      for (const a of lib.list()) await syncApp(a.id);
      await poll();
      return { ok: !state.lastError, lastError: state.lastError };
    }, { description: 'Jetzt synchronisieren', expose: false });
  },
  async health(ctx) {
    const s = await ctx.invoke('cloud.status');
    return { ok: !s.lastError, message: s.lastError || (s.lastSyncAt ? `Synchron · ${s.commandsHandled} Befehle ausgeführt` : 'Verbinde …') };
  }
};

/** Holt Apps aus dem Cloud-Branch „forge-library“ (z. B. aus der nächtlichen Gratis-Sitzung) in die lokale Bibliothek. */
async function pullLibrary({ repo, token, lib, branch = 'forge-library', fetchImpl = fetch }) {
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  const treeRes = await fetchImpl(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, { headers: { ...auth, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } });
  if (treeRes.status === 404) return { imported: 0, updated: 0, skipped: 0, message: token ? 'Cloud-Bibliothek ist noch leer.' : 'Cloud-Bibliothek nicht gefunden – noch leer oder privates Repository (dann GitHub-Token eintragen).' };
  if (!treeRes.ok) throw new Error(`GitHub ${treeRes.status}: ${(await treeRes.text()).slice(0, 160)}`);
  const tree = (await treeRes.json()).tree || [];
  const raw = async (p) => {
    const r = await fetchImpl(`https://raw.githubusercontent.com/${repo}/${branch}/${p.split('/').map(encodeURIComponent).join('/')}`, { headers: auth });
    if (!r.ok) throw new Error(`Download ${p}: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  };
  const ids = tree.map((t) => (/^apps\/([a-z0-9][a-z0-9-]{2,62})\/meta\.json$/.exec(t.path) || [])[1]).filter(Boolean);
  const res = { imported: 0, updated: 0, skipped: 0, apps: [] };
  for (const id of ids) {
    const remote = JSON.parse((await raw(`apps/${id}/meta.json`)).toString('utf8'));
    if (remote.id !== id || !Number.isInteger(remote.currentVersion)) continue;
    const local = lib.exists(id) ? lib.readMeta(id) : null;
    if (local && (local.updatedAt || 0) >= (remote.updatedAt || 0)) {
      res.skipped++;
      continue;
    }
    const prefix = `apps/${id}/v${remote.currentVersion}/`;
    const files = tree.filter((t) => t.type === 'blob' && t.path.startsWith(prefix) && /^[\w.-]+$/.test(t.path.slice(prefix.length)));
    if (!files.some((f) => f.path.endsWith('/index.html'))) continue;
    const dir = lib.versionDir(id, remote.currentVersion);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(dir, f.path.slice(prefix.length)), await raw(f.path));
    lib.writeMeta(remote);
    res[local ? 'updated' : 'imported']++;
    res.apps.push({ id, name: remote.name, version: remote.currentVersion, isNew: !local, meta: remote });
  }
  res.message = `${res.imported} neue, ${res.updated} aktualisierte App(s) aus der Cloud.`;
  return res;
}

const github = {
  id: 'cloud.github',
  name: 'GitHub Cloud-Autopilot',
  kind: 'integration',
  description: 'Holt die Apps der nächtlichen Gratis-Sitzung aus der Cloud und startet Cloud-Läufe (GitHub Actions) – auch wenn dein PC aus ist.',
  requires: ['library'],
  settings: [
    { key: 'repo', label: 'Repository (besitzer/name)', type: 'text', default: 'Tiry38/Tiry' },
    { key: 'token', label: 'GitHub-Token (nur für private Repos und Cloud-Läufe nötig)', type: 'password', secret: true, default: '' },
    { key: 'autoPull', label: 'Cloud-Apps automatisch holen', type: 'boolean', default: true },
    { key: 'pullHours', label: 'Abgleich alle (Stunden)', type: 'number', default: 6 },
    { key: 'workflow', label: 'Workflow-Datei', type: 'text', default: 'forge-cloud.yml' },
    { key: 'ref', label: 'Branch', type: 'text', default: 'main' }
  ],
  start(ctx) {
    const token = ctx.config.get('token');
    const repo = ctx.config.get('repo');
    const wf = ctx.config.get('workflow');
    const lib = ctx.require('library');
    const gh = async (method, p, body) => {
      if (!token) throw new Error('Für Cloud-Läufe wird ein GitHub-Token benötigt (Netzwerk → GitHub).');
      const res = await fetch(`https://api.github.com/repos/${repo}${p}`, {
        method,
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return res.status === 204 ? {} : res.json();
    };
    let lastPull = null;
    const pull = async (source = 'ui') => {
      const r = await pullLibrary({ repo, token, lib });
      lastPull = { at: Date.now(), message: r.message };
      for (const a of r.apps) {
        if (a.isNew) ctx.bus.emit('app.created', { app: a.meta });
        else ctx.bus.emit('app.version.created', { appId: a.id, name: a.name, version: (a.meta.versions || []).find((v) => v.n === a.version) || { n: a.version, title: 'Cloud-Update' } });
      }
      ctx.bus.emit('library.synced', { imported: r.imported, updated: r.updated, source });
      return { imported: r.imported, updated: r.updated, skipped: r.skipped, message: r.message };
    };
    ctx.action('github.pullLibrary', () => pull('ui'), { description: 'Cloud-Apps holen' });
    ctx.action('github.status', async () => {
      const base = { repo, workflow: wf, lastPull, canDispatch: !!token, lastRuns: [] };
      if (!token) return { configured: false, ...base };
      const data = await gh('GET', `/actions/workflows/${wf}/runs?per_page=6`);
      return { configured: true, ...base, lastRuns: (data.workflow_runs || []).map((r) => ({ id: r.id, status: r.status, conclusion: r.conclusion, createdAt: r.created_at, url: r.html_url, event: r.event })) };
    }, { description: 'Cloud-Läufe' });
    ctx.action('github.dispatch', async ({ mode = 'autopilot', count = 1 } = {}) => {
      await gh('POST', `/actions/workflows/${wf}/dispatches`, { ref: ctx.config.get('ref') || 'main', inputs: { mode: String(mode), count: String(Math.max(1, Math.min(10, Number(count) || 1))) } });
      ctx.bus.emit('log', { level: 'success', message: `Cloud-Lauf gestartet (${mode})` });
      return { ok: true };
    }, { description: 'Cloud-Lauf starten', expose: false });
    if (ctx.config.get('autoPull') && !ctx.env.cloud) {
      const run = () => pull('auto').catch((err) => ctx.log('warn', `Cloud-Apps holen: ${err.message}`));
      const first = setTimeout(run, 20000);
      const timer = setInterval(run, Math.max(1, Number(ctx.config.get('pullHours')) || 6) * 3600e3);
      ctx.onStop(() => { clearTimeout(first); clearInterval(timer); });
    }
  }
};

const planned = [
  { id: 'store.googleplay', name: 'Google Play Upload', kind: 'store', status: 'planned', description: 'Automatischer Upload fertiger App-Bundles in die Play Console (Google Play Developer API, Service-Account).' },
  { id: 'store.appstore', name: 'App Store Connect', kind: 'store', status: 'planned', description: 'Upload und Store-Einträge über die App Store Connect API (benötigt Mac-Build oder Cloud-Build).' },
  { id: 'design.canva', name: 'Canva Marketing', kind: 'integration', status: 'planned', description: 'Store-Grafiken und Social-Media-Posts zu jeder App automatisch in Canva erzeugen.' },
  { id: 'ai.images', name: 'KI-Bilder', kind: 'ai', status: 'planned', description: 'Feature-Grafiken und Store-Screenshots mit Rahmen und Werbetext erzeugen.' }
];

module.exports = [lan, api, webhooks, backup, firebase, github, ...planned];
module.exports.pullLibrary = pullLibrary;
