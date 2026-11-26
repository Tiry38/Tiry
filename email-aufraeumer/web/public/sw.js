// Tiry's Mails – Offline-Hülle. Gespeichert wird nur die App selbst (eigene Adresse), nie Mails oder Google-Antworten.
const CACHE = 'tm-huelle-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Seite: immer zuerst frisch aus dem Netz (so kommen Updates sofort), offline aus dem Speicher
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(CACHE).then((c) => c.put('./', k)); return r; }).catch(() => caches.match('./')));
    return;
  }
  // Dateien mit Prüfsumme im Namen ändern sich nie → aus dem Speicher, sonst nachladen
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const k = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, k)); } return r; })));
});
