#!/usr/bin/env node
/* Admin-Chat „Claude“ – Firestore-Zugriff für den GitHub-Lauf (.github/workflows/homepage-claude.yml).
   Anmeldung mit dem Bot-Konto claude@admin.velo-center.de; das Passwort steht NUR im GitHub-Secret FB_CLAUDE_PW.
   Befehle:
     start  <id>                         Auftrag lesen, Status „arbeitet“, schreibt typ/ziel/prompt nach $GITHUB_OUTPUT
     schritt <id> <text>                 Zwischenstand für den Admin-Chat
     ende   <id> <status> <datei|-> [commit]   Ergebnis eintragen (fertig | nichts | fehler)
*/
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live', 'firebase.json'), 'utf8'));
const MAIL = process.env.FB_MAIL || 'claude@admin.velo-center.de', PW = process.env.FB_PW;
const BASE = (process.env.FS_TEST || 'https://firestore.googleapis.com') + `/v1/projects/${CFG.projectId}/databases/(default)/documents`;
let TOK = '';

const TOKF = path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), 'fb-claude-tok.json');
async function login() {
  try { const c = JSON.parse(fs.readFileSync(TOKF, 'utf8')); if (c.t && Date.now() - c.at < 50 * 60e3) { TOK = c.t; return; } } catch (_) {}
  if (!PW) throw new Error('GitHub-Secret FB_CLAUDE_PW fehlt.');
  const r = await fetch((process.env.FS_TEST || 'https://identitytoolkit.googleapis.com') + '/v1/accounts:signInWithPassword?key=' + CFG.apiKey, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MAIL, password: PW, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Anmeldung Bot-Konto fehlgeschlagen: ' + (j.error && j.error.message));
  TOK = j.idToken;
  try { fs.writeFileSync(TOKF, JSON.stringify({ t: TOK, at: Date.now() }), { mode: 0o600 }); } catch (_) {}
}
function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = dec(x); return o; }
  return null;
}
const enc = v => v == null ? { nullValue: null } : typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
const felder = d => { const o = {}; for (const [k, x] of Object.entries(d.fields || {})) o[k] = dec(x); return o; };
const H = () => ({ authorization: 'Bearer ' + TOK, 'content-type': 'application/json' });

async function hole(id) {
  const r = await fetch(BASE + '/claude/' + id, { headers: H() });
  if (!r.ok) throw new Error('Auftrag ' + id + ' nicht lesbar (' + r.status + ')');
  return felder(await r.json());
}
async function setze(id, o) {
  const q = Object.keys(o).map(k => 'updateMask.fieldPaths=' + k).join('&');
  const f = {}; for (const [k, v] of Object.entries(o)) f[k] = enc(v);
  const r = await fetch(BASE + '/claude/' + id + '?' + q + '&currentDocument.exists=true', { method: 'PATCH', headers: H(), body: JSON.stringify({ fields: f }) });
  if (!r.ok) throw new Error('Schreiben fehlgeschlagen (' + r.status + '): ' + (await r.text()).slice(0, 300));
}
async function verlauf() {
  const r = await fetch(BASE + ':runQuery', { method: 'POST', headers: H(), body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'claude' }], orderBy: [{ field: { fieldPath: 'ts' }, direction: 'DESCENDING' }], limit: 9 } }) });
  if (!r.ok) return [];
  return (await r.json()).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split('/').pop() }, felder(x.document)));
}
function ausgabe(k, v) {
  const f = process.env.GITHUB_OUTPUT; if (!f) { console.log(k + '=' + v); return; }
  const d = 'ENDE_' + crypto.randomBytes(8).toString('hex');
  fs.appendFileSync(f, `${k}<<${d}\n${v}\n${d}\n`);
}
const zeit = t => new Date(t).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const runUrl = () => process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';

function taetigkeit(h) {
  const t = h.tool_name || '', i = h.tool_input || {}, f = x => path.basename(String(x || ''));
  const kurz = (x, n) => { x = String(x || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
  if (t === 'Read') return 'Liest ' + f(i.file_path) + (i.offset ? ' ab Zeile ' + i.offset : '');
  if (t === 'Grep') return 'Sucht „' + kurz(i.pattern, 50) + '“';
  if (t === 'Glob') return 'Sucht Dateien „' + kurz(i.pattern, 40) + '“';
  if (t === 'Edit' || t === 'MultiEdit') { const n = kurz(i.new_string, 60); return 'Ändert ' + f(i.file_path) + (n ? ': „' + n + '“' : ''); }
  if (t === 'Write') return f(i.file_path) === '.antwort.md' ? 'Schreibt die Antwort an dich' : 'Schreibt ' + f(i.file_path);
  if (t === 'TodoWrite') return 'Plant die Arbeitsschritte';
  return 'Arbeitet';
}
async function hook(id) {
  let raw = ''; for await (const c of process.stdin) raw += c;
  let h = {}; try { h = JSON.parse(raw); } catch (_) {}
  const lastF = path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), 'fb-claude-hook.txt');
  let last = 0; try { last = +fs.readFileSync(lastF, 'utf8') || 0; } catch (_) {}
  if (Date.now() - last < 1200) return;
  fs.writeFileSync(lastF, String(Date.now()));
  await login(); await setze(id, { schritt: ('Claude: ' + taetigkeit(h)).slice(0, 120) });
}
async function main() {
  const [cmd, id, a, b] = process.argv.slice(2);
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id || '')) throw new Error('Ungültige Auftrags-ID.');
  if (cmd === 'hook') { await hook(id).catch(() => {}); return; }
  await login();
  if (cmd === 'start') {
    const d = await hole(id);
    if (!['neu', 'gestartet'].includes(d.status)) { ausgabe('typ', 'schon'); return; }
    await setze(id, { status: 'arbeitet', schritt: 'Claude liest den Auftrag', run: runUrl(), start: Date.now() });
    ausgabe('typ', d.typ === 'zurueck' ? 'zurueck' : 'auftrag');
    const kurz = String(d.txt || '').replace(/\s+/g, ' ').trim();
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP || '.', 'msg.txt'),
      `Homepage per Admin-Chat (${d.von || 'Admin'}): ${kurz.length > 70 ? kurz.slice(0, 68) + ' …' : kurz}\n\nAuftrag ${id}\n`);
    if (d.typ === 'zurueck') {
      const z = await hole(String(d.ziel || ''));
      if (!/^[0-9a-f]{7,40}$/.test(z.commit || '')) throw new Error('Zu dieser Nachricht gibt es keine Änderung zum Zurücknehmen.');
      ausgabe('ziel', z.commit); return;
    }
    const alt = (await verlauf()).filter(x => x.id !== id && x.ts < d.ts).reverse().slice(-6);
    const regeln = fs.readFileSync(path.join(__dirname, 'claude_regeln.md'), 'utf8');
    const verl = alt.length ? alt.map(x => `- ${zeit(x.ts)} ${x.von || 'Admin'}: ${String(x.txt || '').slice(0, 600)}\n  → Ergebnis (${x.status}): ${String(x.antwort || '').slice(0, 600)}`).join('\n') : '(keine früheren Nachrichten)';
    ausgabe('prompt', `${regeln}\n\n## Bisheriger Chat-Verlauf (nur zur Einordnung)\n${verl}\n\n## AKTUELLER AUFTRAG von ${d.von || 'Admin'} (${zeit(d.ts)})\n${String(d.txt || '').slice(0, 6000)}\n`);
    return;
  }
  if (cmd === 'schritt') { await setze(id, { schritt: String(a || '').slice(0, 120) }); return; }
  if (cmd === 'ende') {
    const st = ['fertig', 'nichts', 'fehler'].includes(a) ? a : 'fehler', datei = b, sha = process.argv[6] || '';
    let t = datei && datei !== '-' && fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').trim() : '';
    if (!t) t = { fertig: 'Erledigt. Die Änderung ist in etwa einer Minute auf der Homepage.', nichts: 'Es wurde nichts geändert.', fehler: 'Das hat nicht geklappt. Die Homepage ist unverändert.' }[st];
    const o = { status: st, antwort: t.slice(0, 5000), fertig: Date.now(), schritt: '' };
    if (/^[0-9a-f]{7,40}$/.test(sha)) o.commit = sha;
    await setze(id, o); return;
  }
  throw new Error('Unbekannter Befehl.');
}
main().catch(e => { console.error('claude_fs: ' + e.message); process.exit(1); });
