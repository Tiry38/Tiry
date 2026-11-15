# Entwurf Kopf & Hintergrund (15.11.2026, noch nicht eingebaut)

Vorschau: https://claude.ai/artifact/Cwm48SmDw5KVUMfCXgnaXG

- Hintergründe: H1 Seide (ruhig) · H2 Aurora (lebendig) · H3 Wellen (organisch). Basis `base-bg.css` blendet sky/blobs/ribbons/smoke aus und braucht `<div id="vxbg">` mit 5×`<i>` (H3: Wellen-SVG aus `var.js`).
- Menüs: N1 Dock (ganzer Kopf in einer Glas-Kapsel) · N2 Glas-Leiste mit Leuchtlinie · N3 Graphit-Kapsel (dunkel, rote Pille).
- Empfehlung: H1 + N3, dazu gleitende Markierung des aktiven Reiters und schlankere Leiste beim Scrollen.
- `var.js` = Playwright-Skript, legt die Varianten über index.html (lokaler Server Port 8765, UTF-8) und macht Screenshots.
- Wartet auf Tirys Wahl. Danach sauber in index.html einbauen und diesen Ordner löschen.
