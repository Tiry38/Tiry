#!/bin/bash
# Läuft bei jeder Nachricht von Tiry. Geht es um etwas Visuelles, bekommt Claude
# automatisch den Auftrag, den Skill zukunfts-design und alle Design-Werkzeuge zu laden.
input="$(cat)"
if printf '%s' "$input" | grep -qiE 'design|oberfl|\bui\b|\bux\b|layout|webseite|website|homepage|seite|app|spiel|game|grafik|logo|icon|flyer|poster|plakat|banner|post|story|reel|video|präsentation|folie|dashboard|artifact|farbe|schrift|font|css|html|button|menü|modern|schön|hübsch|look|stil|aussehen|bild|visuell|animation|fernseher|velo-tv|bildschirm'; then
  cat <<'MSG'
DESIGN-AUTOMATIK (Tiry-Regel, gilt ohne Nachfrage): Diese Anfrage betrifft etwas Visuelles.
1. Lade ZUERST den Skill "zukunfts-design" und befolge ihn vollständig (Werkzeug-Automatik, Verbotsliste, Milliarden-Test, Technik-Show).
2. Lade zusätzlich alle passenden Design-Skills/Werkzeuge, die verfügbar sind (z. B. design-taste-frontend, modern-awwwards-web-design, artifact-design, canvas-design, hyperframes, dataviz, Canva).
3. Kein KI-Einheitslook: keine Glaspillen, keine Verlauf-Blobs, keine Kachelraster, kein zentrierter Standard-Hero.
4. Vor der Abgabe Screenshot (Handy + Desktop) machen und gegen die Verbotsliste prüfen.
MSG
fi
exit 0
