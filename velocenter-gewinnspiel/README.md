# Durchzieher-Zentrale

Auswertung des Facebook-Gewinnspiels **„Durchzieher – 30 Tage. 1 E-Bike.“** von Velocenter Hessert.
Zeigt, wer mitmacht, wer wie viele Tage geschafft hat, wer wie oft in Folge dabei ist, Likes und Kommentare je Person und Tag.
Lost Wochensieger und Hauptpreis fair aus und verwaltet die Joker-Karten.

## Start am PC (Windows)
1. Ordner `velocenter-gewinnspiel` auf den PC kopieren.
2. Doppelklick auf **`Starten.bat`** – öffnet das Programm in Edge als eigenes Fenster.
   Alternativ `index.html` im Browser öffnen.
3. Zum Ausprobieren: **Daten → Demo-Daten laden**. Vor dem echten Start: **Daten → Alles löschen**.

Alle Daten bleiben in diesem Browser auf diesem PC. Sicherung: **Daten → Daten exportieren**.

## Facebook verbinden
1. **Einstellungen → Token** eintragen (Seiten-Zugangsschlüssel mit `pages_read_engagement` und `pages_read_user_content`;
   der Systemnutzer-Token aus der KI-Zentrale passt, wenn er diese Rechte hat). Seiten-ID ist voreingestellt (220020558190688).
2. **Jetzt abrufen** – holt alle Beiträge mit „Türchen N/30“, die Kommentare (oberste Ebene) und die Likes.
3. Der Token wird nie exportiert und nie angezeigt (Passwortfeld).

**Wichtig:** Die Live-Anbindung ist gegen das echte Facebook noch ungeprüft. Der erste Abruf zeigt es.
Liefert Facebook keine Namen, erscheint ein Hinweis – dann Kommentare unter **Daten → Von Hand eintragen**
(`Name | Kommentar | HH:MM`, eine Zeile pro Kommentar).

## Regeln, die das Programm anwendet
- Tag 1 = So 22.11.2026, Tag 30 = Mo 21.12.2026. Ein Kommentar zählt bis 23:59 Uhr (Berlin) am Tag des Beitrags.
  Spätere Kommentare werden angezeigt, zählen aber nicht.
- Beiträge werden über „Türchen N/30“ im Text einem Tag zugeordnet, sonst über das Datum. Korrektur unter **Tage**.
- 1 Joker pro Person, deckt genau einen verpassten Tag (Code-Karte aus dem Laden, Format `DZ-XXXX`).
- Status: **Im Rennen** · **Joker nötig** (1 Lücke, Joker frei) · **Raus** · **Durchzieher** (30/30 inkl. Joker).
- Wochen: W1 Tag 1–7, W2 Tag 8–14, W3 Tag 15–21, W4 Tag 22–28. Wochensieger: alle 7 Tage erfüllt,
  2 Gewinner pro Woche (einstellbar), höchstens ein Wochengewinn pro Person.
- Hauptpreis: unter allen Durchziehern, 1 Gewinner + 2 Nachrücker.
- Ausgeschlossen: die eigene Seite, Mitarbeiter und Sperrliste (Einstellungen).
- Auslosung mit `crypto.getRandomValues`, Protokoll mit Uhrzeit, Größe des Lostopfs und SHA-256 der Teilnehmerliste.

## Handy
Die Oberfläche passt sich ans Handy an. Auf dem Handy läuft sie, sobald der Ordner über eine https-Adresse
gehostet ist (z. B. Firebase Hosting); dann ist sie als App installierbar und offline nutzbar.
Daten vom PC kommen per Export/Import aufs Handy (jedes Gerät speichert für sich).

## Tests (Entwicklung)
```
node tests/engine.test.js   # Auswertung, Fristen, Joker, Auslosung, SHA-256
node tests/meta.test.js     # Facebook-Abruf mit nachgebauter Graph API
node tests/ui-check.js      # Oberfläche mit Playwright (PC + Handy), Screenshots
```
