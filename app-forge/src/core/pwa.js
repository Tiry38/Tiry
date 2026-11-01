'use strict';
/**
 * PWA packaging: manifest, offline service worker and a generated app icon.
 * Each generated app is a self-contained installable web app that can be
 * wrapped for Android/iOS with Capacitor (see exporter.js).
 */
const { resolvePalette } = require('./design');

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function iconSvg({ name, glyph, palette }) {
  const p = resolvePalette(palette);
  const letter = escapeXml((glyph || name || 'A').trim().slice(0, 2) || 'A');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.accent[0]}"/>
      <stop offset="1" stop-color="${p.accent[1]}"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.25" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <circle cx="400" cy="420" r="170" fill="${p.glow}" opacity="0.28"/>
  <circle cx="96" cy="80" r="120" fill="#ffffff" opacity="0.10"/>
  <rect width="512" height="512" rx="116" fill="url(#shine)"/>
  <text x="256" y="300" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${letter.length > 1 ? 180 : 230}" font-weight="800" fill="${p.onAccent}">${letter}</text>
</svg>`;
}

function manifest({ name, shortName, description, palette, lang }) {
  const p = resolvePalette(palette);
  return JSON.stringify(
    {
      name,
      short_name: (shortName || name).slice(0, 12),
      description: description || '',
      lang: lang || 'de',
      start_url: './index.html',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: p.bg[0],
      theme_color: p.bg[1],
      icons: [
        { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    null,
    2
  );
}

function serviceWorker({ appId, version }) {
  const cache = `${appId}-v${version}`;
  return `/* Offline-Cache. Neue Version = neuer Cache-Name => Handys holen Updates automatisch. */
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
`;
}

/** Snippet every app includes (offline templates inject it, AI prompts require it). */
const PWA_HEAD = `<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="./icon.svg" type="image/svg+xml">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">`;

const PWA_REGISTER = `if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { navigator.serviceWorker.register('./sw.js').catch(function () {}); }`;

/** All files of one app version except the PNG icons (rasterised separately). */
function buildFiles({ appId, version, html, name, glyph, description, palette, lang }) {
  return {
    'index.html': html,
    'manifest.webmanifest': manifest({ name, description, palette, lang }),
    'sw.js': serviceWorker({ appId, version }),
    'icon.svg': iconSvg({ name, glyph, palette })
  };
}

module.exports = { iconSvg, manifest, serviceWorker, buildFiles, PWA_HEAD, PWA_REGISTER };
