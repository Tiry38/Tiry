# Gratis-Modus – Ablauf der nächtlichen Claude-Sitzung

Diese Sitzung ersetzt den kostenpflichtigen API-Key: **Du (Claude) bist die KI der Forge.**
Ziel pro Nacht: **1 neue App + 1 Verbesserung einer bestehenden App + Bibliothek sichern**.
Qualität vor Menge. Alles auf Deutsch. Arbeitsordner: `app-forge/`.

## 0. Vorbereitung
```bash
cd app-forge
npm install --no-audit --no-fund          # falls der Start-Hook es nicht schon erledigt hat
bash scripts/library-sync.sh pull         # Bibliothek → ../forge-data (Branch forge-library)
node scripts/forge-cli.js list            # Bestand ansehen
```
Wenn `app-forge/` fehlt oder `npm test` rot ist: nichts erschaffen. Kurz berichten und beenden.

## 1. Neue App erschaffen
1. `node scripts/forge-cli.js brief > /tmp/brief.md` und den Auftrag lesen. Er enthält Zufallsimpulse, Trend, Palette, alle Regeln und gelernte Regeln.
2. Optional, aber empfohlen: per Websuche kurz prüfen, was in der Kategorie gerade gefragt ist. Nur zur Inspiration, niemals kopieren.
3. `/tmp/concept.json` schreiben (Pflichtfelder siehe Auftrag). Den Sinn-Check **ehrlich** bewerten. Liegt ein Wert unter 7, ein besseres Konzept entwickeln.
4. `/tmp/app.html` bauen: eine Datei, offline, Premium-Design.
   - Organische Formen, keine Baukasten-Kästen.
   - Mehrfarbige, sanft animierte Verläufe.
   - Alle Features voll funktionsfähig.
5. Testen, bis 0 Fehler:
   ```bash
   node scripts/forge-cli.js check /tmp/app.html --concept /tmp/concept.json
   ```
   Fehler beheben und erneut testen. Warnungen möglichst auch beheben.
6. **Design-Jury:** `node scripts/forge-cli.js review-guide` lesen, dann den Screenshot (Pfad aus `check`) mit dem Read-Werkzeug ansehen.
   - Streng bewerten.
   - Bei Design unter 8 nachbessern, neu testen und neu ansehen.
   - Danach `/tmp/review.json` schreiben.
7. Übergeben:
   ```bash
   node scripts/forge-cli.js import /tmp/app.html --concept /tmp/concept.json --review /tmp/review.json
   ```
   Wird die App abgelehnt, den Grund beheben und es erneut versuchen (höchstens 3 Versuche).

## 2. Eine bestehende App verbessern
1. Aus `list` die App mit dem niedrigsten Score oder der ältesten Weiterentwicklung wählen. Apps mit `testOk: false` haben Vorrang.
2. `node scripts/forge-cli.js html <id> --out /tmp/cur.html`
3. **Eine** wertvolle Verbesserung planen, in dieser Reihenfolge:
   1. Fehler,
   2. Design/UX,
   3. ein passendes neues Feature,
   4. Inhalte.
   Keine Überladung, Kernidee beibehalten, bestehende Funktionen und gespeicherte Daten (localStorage) nicht brechen.
4. Umsetzen, mit `check` testen, Screenshot bewerten, `/tmp/review2.json` schreiben.
5. Übergeben:
   ```bash
   node scripts/forge-cli.js evolve <id> /tmp/new.html --title "Kurzer Titel" --description "Was und warum" --kind feature --review /tmp/review2.json
   ```
   Die Forge übernimmt die Version nur, wenn sie nicht schlechter ist. Sonst wird sie verworfen, das ist in Ordnung.

## 3. Lernen
Für jede Fehlerart, die heute aufgetreten ist, eine kurze, allgemeine Regel speichern:
```bash
node scripts/forge-cli.js lesson "Vor DOM-Zugriffen prüfen, ob das Element existiert."
```

## 4. Sichern
```bash
bash scripts/library-sync.sh push "Nacht $(date -u +%Y-%m-%d): <App-Name> neu, <App> verbessert"
```
Schlägt der Push fehl: einmal `pull` und dann `push` wiederholen. Klappt es dann immer noch nicht, im Bericht melden.

## 5. Programm verbessern (optional, nur wenn Zeit bleibt)
Höchstens **eine** kleine, sichere Verbesserung am Programm selbst (Bugfix, Design, Test).
- `npm test` muss grün sein.
- Bei UI-Änderungen den Smoke-Test mit Screenshots laut `CLAUDE.md` ausführen.
- Auf einem eigenen Branch `claude/nacht-<datum>` committen und pushen, dann einen Pull Request nach `main` mit deutscher Beschreibung öffnen.
- Niemals direkt auf `main` pushen.

## 6. Bericht (kurz, Deutsch)
- Neue App: Name, Idee, Score.
- Verbesserung: welche App, was, übernommen oder verworfen.
- Gelernte Regeln.
- Probleme.
