'use strict';
/**
 * Baut die öffentliche Galerie (alle Apps als installierbare PWAs) und die
 * Fernsteuerungs-Seite für Firebase Hosting.
 */
const fs = require('fs');
const path = require('path');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STYLE = `
:root{--bg:#07070d;--text:#f8fafc;--muted:#a5adc4;--a1:#7c3aed;--a2:#ec4899;--a3:#06b6d4;--a4:#f97316}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;font-family:"Segoe UI Variable","SF Pro Display","Segoe UI",Inter,system-ui,sans-serif;color:var(--text);background:var(--bg);overflow-x:hidden}
body::before{content:"";position:fixed;inset:-20%;z-index:-1;background:radial-gradient(35% 30% at 15% 10%,#7c3aed66,transparent 70%),radial-gradient(30% 28% at 85% 15%,#ec489955,transparent 70%),radial-gradient(40% 35% at 60% 95%,#06b6d444,transparent 70%),linear-gradient(160deg,#07070d,#120a24);animation:drift 26s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate3d(-3%,2%,0) scale(1.07)}}
main{max-width:1100px;margin:0 auto;padding:48px 20px 80px}
h1{font-size:clamp(34px,6vw,58px);font-weight:850;letter-spacing:-.04em;line-height:1.02;background:linear-gradient(100deg,#a78bfa,#f472b6,#fb923c,#22d3ee,#a78bfa);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:flow 10s ease-in-out infinite}
@keyframes flow{50%{background-position:100% 50%}}
.lead{color:var(--muted);font-size:18px;max-width:620px;margin:14px 0 36px}
.grid{display:flex;flex-wrap:wrap;gap:22px;justify-content:center}
.app{position:relative;width:250px;padding:26px 22px 22px;border-radius:44px;background:#ffffff0d;border:1px solid #ffffff1a;backdrop-filter:blur(18px);text-decoration:none;color:inherit;text-align:center;transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s;box-shadow:0 30px 60px -40px #000}
.app:nth-child(3n+2){margin-top:34px}
.app:hover{transform:translateY(-6px) rotate(-.6deg);box-shadow:0 40px 70px -36px #7c3aed88}
.app img{width:96px;height:96px;border-radius:50%;box-shadow:0 18px 40px -16px #000c}
.app h2{font-size:20px;margin:14px 0 4px;letter-spacing:-.01em}
.app p{color:var(--muted);font-size:14px;min-height:40px}
.tag{display:inline-block;margin-top:12px;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;background:linear-gradient(120deg,var(--a1),var(--a2),var(--a4));color:#fff}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:999px;border:0;font:inherit;font-weight:750;color:#fff;background:linear-gradient(110deg,var(--a1),var(--a2),var(--a4),var(--a1));background-size:250% 100%;animation:flow 9s ease-in-out infinite;cursor:pointer;box-shadow:0 16px 34px -14px #ec4899aa;text-decoration:none}
.btn.ghost{background:#ffffff12;border:1px solid #ffffff22;box-shadow:none;animation:none}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
`;

function gallery(apps) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tiry App Forge – Galerie</title><meta name="theme-color" content="#07070d"><style>${STYLE}</style></head><body><main>
<h1>App-Galerie</h1><p class="lead">${apps.length} Apps, automatisch erschaffen, getestet und ständig verbessert. Antippen, öffnen, über „Zum Startbildschirm hinzufügen“ installieren.</p>
<div class="row" style="margin-bottom:34px"><a class="btn" href="remote.html">Fernsteuerung öffnen</a></div>
<div class="grid">${apps.map((a) => `<a class="app" href="apps/${esc(a.id)}/index.html"><img src="apps/${esc(a.id)}/icon.svg" alt=""><h2>${esc(a.name)}</h2><p>${esc(a.tagline)}</p><span class="tag">${a.type === 'game' ? 'Spiel' : 'App'} · v${a.currentVersion} · Score ${a.score ?? '–'}</span></a>`).join('')}</div>
</main></body></html>`;
}

function remote(webConfig) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tiry App Forge – Fernsteuerung</title><meta name="theme-color" content="#07070d"><style>${STYLE}
.panel{margin-top:22px;padding:22px;border-radius:40px;background:#ffffff0c;border:1px solid #ffffff1a;backdrop-filter:blur(18px)}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;background:#64748b;margin-right:8px}.dot.on{background:#22c55e;box-shadow:0 0 12px #22c55e}
.cmd{display:flex;justify-content:space-between;gap:10px;padding:10px 16px;border-radius:999px;background:#ffffff0a;margin-top:8px;font-size:14px}
.muted{color:var(--muted)} select{font:inherit;padding:12px 18px;border-radius:999px;background:#ffffff14;color:var(--text);border:1px solid #ffffff22}
</style></head><body><main>
<h1>Fernsteuerung</h1><p class="lead">Steuere deine App-Fabrik vom Handy – der PC muss dafür nicht laufen: Befehle mit Ziel „Cloud“ führt der nächste Cloud-Lauf (GitHub Actions) aus.</p>
<div id="login" class="panel"><p class="muted" style="margin-bottom:14px">Melde dich mit deinem Google-Konto an (nur der Besitzer hat Zugriff).</p><button class="btn" id="signin">Mit Google anmelden</button></div>
<div id="app" style="display:none">
 <div class="panel"><div class="row" style="justify-content:space-between"><b>Status</b><button class="btn ghost" id="signout">Abmelden</button></div><div id="status" style="margin-top:12px"></div></div>
 <div class="panel"><b>Befehl senden</b><div class="row" style="margin-top:14px"><select id="target"><option value="cloud">Ziel: Cloud (PC aus)</option><option value="desktop">Ziel: mein PC</option><option value="any">Ziel: egal</option></select></div>
  <div class="row" style="margin-top:14px"><button class="btn" data-a="forge.create" data-args='{"count":1}'>Neue App</button><button class="btn" data-a="forge.create" data-args='{"count":1,"type":"game"}'>Neues Spiel</button><button class="btn ghost" data-a="trends.refresh">Trends aktualisieren</button><button class="btn ghost" data-a="autopilot.set" data-args='{"enabled":true}'>Autopilot an (PC)</button><button class="btn ghost" data-a="autopilot.set" data-args='{"enabled":false}'>Autopilot aus (PC)</button></div></div>
 <div class="panel"><b>Letzte Befehle</b><div id="cmds"></div></div>
 <div class="panel"><b>Apps</b><div id="apps"></div></div>
</div>
<p class="muted" style="margin-top:26px"><a href="index.html" style="color:inherit">← Zur Galerie</a></p>
</main>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const config = ${webConfig || 'null'};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
if (!config) { $('#login').innerHTML = '<p>Firebase ist noch nicht eingerichtet (FIREBASE_WEB_CONFIG fehlt). Anleitung: app-forge/cloud/README.md</p>'; }
else {
  const app = initializeApp(config); const auth = getAuth(app); const db = getFirestore(app);
  $('#signin').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alert(e.message));
  $('#signout').onclick = () => signOut(auth);
  let subs = [];
  onAuthStateChanged(auth, (user) => {
    subs.forEach((u) => u()); subs = [];
    $('#login').style.display = user ? 'none' : ''; $('#app').style.display = user ? '' : 'none';
    if (!user) return;
    const stat = {};
    const renderStatus = () => { $('#status').innerHTML = ['desktop', 'cloud'].map((k) => { const s = stat[k]; const seen = s && s.lastSeen ? s.lastSeen.toDate() : null; const on = seen && Date.now() - seen.getTime() < 120000; return '<div style="margin:6px 0"><span class="dot ' + (on ? 'on' : '') + '"></span><b>' + (k === 'desktop' ? 'PC' : 'Cloud') + '</b> <span class="muted">' + (s ? (on ? 'online' : 'zuletzt ' + (seen ? seen.toLocaleString('de-DE') : '–')) + ' · ' + s.apps + ' Apps · ' + (s.mode === 'ai' ? 'KI-Modus' : 'Offline-Modus') + (k === 'desktop' ? ' · Autopilot ' + (s.autopilot ? 'an' : 'aus') : '') : 'noch keine Daten') + '</span></div>'; }).join(''); };
    ['desktop', 'cloud'].forEach((k) => subs.push(onSnapshot(doc(db, 'status', k), (d) => { stat[k] = d.exists() ? d.data() : null; renderStatus(); }, () => {})));
    subs.push(onSnapshot(query(collection(db, 'commands'), orderBy('createdAt', 'desc'), limit(10)), (snap) => { $('#cmds').innerHTML = snap.docs.map((d) => { const c = d.data(); return '<div class="cmd"><span>' + esc(c.action) + ' → ' + esc(c.target) + '</span><b>' + esc(c.status) + '</b></div>'; }).join('') || '<p class="muted" style="margin-top:8px">Noch keine Befehle.</p>'; }, () => {}));
    subs.push(onSnapshot(collection(db, 'apps'), (snap) => { $('#apps').innerHTML = snap.docs.map((d) => { const a = d.data(); return '<div class="cmd"><span>' + esc(a.name) + ' <span class="muted">' + esc(a.tagline) + '</span></span><b>v' + esc(a.version) + ' · ' + esc(a.score) + '</b></div>'; }).join('') || '<p class="muted" style="margin-top:8px">Noch keine Apps synchronisiert.</p>'; }, () => {}));
    document.querySelectorAll('[data-a]').forEach((b) => { b.onclick = async () => { const args = b.dataset.args ? JSON.parse(b.dataset.args) : {}; await addDoc(collection(db, 'commands'), { action: b.dataset.a, args, target: $('#target').value, status: 'pending', createdAt: serverTimestamp(), by: user.email }); b.textContent = '✓ gesendet'; setTimeout(() => location.reload(), 900); }; });
  });
}
</script></body></html>`;
}

function safeConfig(raw) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw)).replace(/</g, '\\u003c');
  } catch {
    return '';
  }
}

function buildSite({ library, outDir, webConfig }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'apps'), { recursive: true });
  const apps = library.list();
  for (const a of apps) {
    const src = library.versionDir(a.id, a.currentVersion);
    const dest = path.join(outDir, 'apps', a.id);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), gallery(apps));
  fs.writeFileSync(path.join(outDir, 'remote.html'), remote(safeConfig(webConfig)));
  return { dir: outDir, apps: apps.length };
}

module.exports = { buildSite };
