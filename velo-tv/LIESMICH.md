# Velo-TV – Ladenfernseher für Velocenter Hessert

Windows-Programm (Electron). Dateien hineinziehen, sortieren, planen – der LG-Fernseher im Laden zeigt es per WLAN.
Alle PCs mit Velo-TV sehen jede Änderung sofort. Design wie die neue Homepage (tiry38.github.io/velo-center-web).

## So funktioniert es
- **Zentrale** (Kassen-PC): liefert dem Fernseher die Inhalte (Port **8833**), hält Programm, Papierkorb und Verlauf.
  Läuft im Hintergrund weiter (Symbol unten rechts), startet mit Windows, verhindert Standby.
- **Bedienplätze** (Büro-PCs): finden die Zentrale automatisch (UDP 8834) und koppeln sich einmalig mit der **PIN**
  (steht an der Zentrale unter „Fernseher“). Ändert sich die IP der Zentrale, ziehen Bedienplätze automatisch nach.
- **Fernseher**: Webbrowser öffnen, `http://<IP der Zentrale>:8833` eingeben, OK = Vollbild. Kein Zusatzgerät nötig.

## Funktionen
- Bilder (werden auf 2560×1440 optimiert), Videos (MP4/H.264 am sichersten), **PDF** und **PowerPoint**
  (eine Folie je Seite; PowerPoint über installiertes PowerPoint, sonst LibreOffice).
- **Live-Showroom** (Knopf „Live-Showroom“): Startseite der Homepage als Fernseher-Version – Laufbänder, Logo, Überschrift,
  Glas-Kreis mit Marken-Wasserzeichen, fallende Blätter; zeigt reihum **nur Angebotsräder** (Angebotspreis, auf Lager, eigenes Foto)
  aus dem Live-Bestand der Homepage (Firestore `bestand/aktuell` + Ausblendungen aus `pub/lager`, wie `admMerge`).
  Die Zentrale holt alle 30 min neu und speichert die Fotos lokal (`src/server/showroom.js`). Ohne Knöpfe/Aufrufe zum Tippen.
- **Text-Folien** in 5 Stilen (Herbst, Rot, Dunkel, Hell, Verlauf), `*Wort*` = roter Akzent.
- Je Beitrag: Dauer, „ganzes Video“, Ton, Bild füllen/ganz zeigen, **Zeitplan** (Wochentage, Uhrzeit, Datumsbereich).
- „Jetzt auf dem TV zeigen“, Live-Vorschau, Anzeige was der Fernseher gerade zeigt, Verlauf mit PC-Namen,
  Papierkorb (30 Tage), Uhr/Logo-Einblendung, Überblendungen.

## Entwicklung (Ordner `velo-tv/`)
- `npm test` – Zeitplan, Zentrale (Upload, Sync per SSE, Kopplung, Papierkorb, Neustart), Netzwerksuche.
- Smoke-Test mit Screenshots aller Ansichten und des Fernsehers:
  `VELOTV_DATA_DIR=<tmp> VELOTV_SMOKE_OUT=<tmp> xvfb-run -a -s "-screen 0 1600x1000x24" npx electron . --smoke --no-sandbox --disable-gpu`
- Installer: Workflow `.github/workflows/velo-tv.yml` baut bei Push auf `main` und legt ihn ins Release
  **velo-tv-latest** → https://github.com/Tiry38/Tiry/releases/download/velo-tv-latest/Velo-TV-Setup.exe
  Installierte Programme aktualisieren sich daraus selbst.

## Aufbau
- `src/server/server.js` – Zentrale (nur Node-Bordmittel): REST + Server-Sent-Events, Range-Streaming für Videos, `state.json`.
- `src/server/showroom.js` – Angebote aus dem Homepage-Bestand. `src/player/showroom.js|css` – Showroom-Folie (Bühne 1920×1080).
- `scripts/icon.js` – erzeugt Programm-Symbol (Velocenter-Fahrrad im Fernseher) als SVG/ICO/PNG.
- `src/server/discovery.js` – automatische Suche im Netz.
- `src/player/` – Fernseher-Player (ES2017, ohne Module, für TV-Browser).
- `src/shared/schedule.js` – Zeitplan-Logik für Player, Steuerung und Tests.
- `src/renderer/` – Steuerung (Vanilla JS, CSP ohne Inline-Skripte). `src/main/` – Electron-Hauptprozess.

## Offen
- Genaues LG-Modell prüfen (webOS-Version, Videoformate, Browser-Autostart nach dem Einschalten).
