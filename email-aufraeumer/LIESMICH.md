# Email-Aufräumer

Windows-Programm (Electron), das Tirys Gmail-Postfach vollautomatisch aufräumt. Neue Mails werden spätestens nach
60 Sekunden eingeordnet: **behalten**, **als Werbung archivieren**, **abmelden** oder **als Spam/Phishing in den Papierkorb**.
Läuft unsichtbar im Infobereich (Tray), startet mit Windows, arbeitet weiter, wenn das Fenster zu ist.

## Sicherheitsregeln (fest eingebaut)
1. **Nie endgültig löschen** – nur Papierkorb (Gmail leert ihn nach 30 Tagen). Der Vollzugriff `https://mail.google.com/` wird nie angefordert.
2. **Jede Aktion steht im Protokoll** und lässt sich 30 Tage lang mit einem Klick rückgängig machen (Labels, Ordner, gelesen-Status exakt wie vorher).
   Ausnahme, die das Programm auch so anzeigt: eine erfolgte **Abmeldung** kann man nicht zurücknehmen.
3. **Nie angefasst:** markierte Mails (Stern), Absender, an die Tiry selbst geschrieben hat (aus „Gesendet“), Weiße Liste,
   Mails mit Schutzwörtern (Rechnung, Bestellung, Lieferung, Vertrag, Kündigung, Bank, Steuer, Versicherung, Termin, Veloport – in den Einstellungen änderbar).
4. **Abmelden nur über den `List-Unsubscribe`-Header** (RFC 8058 One-Click-POST oder mailto). Links aus dem Mail-Text werden nie geöffnet,
   ein Link ohne One-Click-Kennzeichnung auch nicht. Bei Phishing-Verdacht wird nie abgemeldet.
5. **7 Tage Trockenlauf:** Es wird nur angezeigt, was passieren würde. „Scharf schalten“ geht erst nach 7 Tagen und nur per Klick.
6. **Keine Zugangsdaten im Repo.** `credentials.json` und die Tokens liegen nur auf dem PC (`%APPDATA%\Email-Aufräumer`), die Tokens
   verschlüsselt mit Windows-DPAPI (Electron `safeStorage`).
7. **KI nur auf Wunsch** (standardmäßig aus) und dann nur Absender, Betreff und Vorschau-Snippet – nie der Text, nie Anhänge.

## Einrichtung in 10 Minuten
### 1. Google-Cloud-Projekt
1. <https://console.cloud.google.com/> öffnen, mit dem Gmail-Konto anmelden, oben **Projekt auswählen → Neues Projekt**, Name z. B. `Email-Aufraeumer`.
2. **APIs & Dienste → Bibliothek** → „Gmail API“ suchen → **Aktivieren**.
3. **Google Auth Platform** (früher „OAuth-Zustimmungsbildschirm“) → **Jetzt starten**:
   App-Name `Email-Aufräumer`, Support-E-Mail = eigene Adresse, Zielgruppe **Extern**, Kontakt-Mail = eigene Adresse → Erstellen.
4. **Datenzugriff → Bereiche hinzufügen**: `.../auth/gmail.modify` und `.../auth/gmail.settings.basic` → Aktualisieren → Speichern.

### 2. Die 7-Tage-Falle vermeiden (wichtig)
Laut Google-Doku (<https://developers.google.com/identity/protocols/oauth2#expiration>, geprüft am 26.11.2026):
„Ein Projekt mit Zielgruppe *Extern* und Veröffentlichungsstatus *Testing* bekommt Refresh-Tokens, die nach 7 Tagen ablaufen“
(außer man fragt nur Name/E-Mail/Profil ab – das reicht hier nicht). Dann müsste man sich jede Woche neu anmelden.

So vermeidet man es für den privaten Gebrauch:
1. **Google Auth Platform → Zielgruppe → „App veröffentlichen“** → Status **„In Produktion“**.
2. Eine Prüfung durch Google ist **nicht nötig**: Ohne Prüfung zeigt Google beim Anmelden „Google hat diese App nicht überprüft“
   und erlaubt höchstens 100 Nutzer (<https://support.google.com/cloud/answer/15549945>). Für eine einzige Person ist das egal.
   Beim Anmelden: **Erweitert → „Zu Email-Aufräumer wechseln (unsicher)“** – „unsicher“ heißt hier nur „nicht von Google geprüft“; es ist dein eigenes Projekt.
3. **Erst danach** im Programm anmelden. Tokens aus der Testing-Zeit laufen trotzdem nach 7 Tagen ab – wer schon im Testing angemeldet war,
   meldet sich nach dem Umstellen einmal neu an.
4. Ein Refresh-Token verfällt außerdem, wenn es 6 Monate nicht benutzt wird oder du den Zugriff unter <https://myaccount.google.com/permissions> entfernst.

### 3. OAuth-Client herunterladen
**Google Auth Platform → Clients → Client erstellen → Anwendungstyp „Desktop-App“** → Erstellen → **JSON herunterladen**
(`client_secret_….json`). Diese Datei **nie** ins Repo legen.

### 4. Programm
1. `Email-Aufraeumer-Setup.exe` installieren und starten.
2. Cockpit: **„credentials.json auswählen“** → die heruntergeladene Datei wählen (wird nach `%APPDATA%\Email-Aufräumer` kopiert).
3. **„Mit Google anmelden“** → Browser öffnet sich → beide Häkchen setzen → fertig. Der Trockenlauf beginnt.
4. Optional, **nur lesen** (Phase-1-Test): `"%LOCALAPPDATA%\Programs\email-aufraeumer\Email-Aufräumer.exe" --lesetest` zeigt die letzten 50 Mails
   mit Einordnung in der Konsole und verändert nichts.
5. Nach 7 Tagen im Cockpit **„Scharf schalten“**. Ab dann werden Aktionen ausgeführt.

### 5. KI-Stufe (optional)
API-Schlüssel von <https://console.anthropic.com/> als Umgebungsvariable setzen (nie in eine Datei im Repo):
```bash
setx ANTHROPIC_API_KEY "sk-ant-..."
```
Programm neu starten → Einstellungen → KI-Stufe an, Monatsbudget in Euro festlegen. Modell: `claude-haiku-5-5`
(0,10 $/1 Mio. Eingabe-, 0,50 $/1 Mio. Ausgabe-Tokens) – eine Einordnung kostet rund 0,00003 $. Ist das Budget erschöpft, wird die KI bis Monatsende nicht mehr gefragt.

## So entscheidet das Programm
| Stufe | Was | Beispiele |
|---|---|---|
| Schutz | Stern, Kontakt aus „Gesendet“, Weiße Liste, Schutzwörter in Betreff/Vorschau/Absender | Rechnung, Mama, Veloport |
| 1 Signale | Gmail-Labels (SPAM, Werbung, Soziale Netzwerke, Benachrichtigungen), `List-Unsubscribe`, `Precedence: bulk`, SPF/DKIM/DMARC, Anzeigename gegen Domain, Reply-To, Druck-Formulierungen, öffnet Tiry diesen Absender je? | „PayPal“ von `paypa1-sicherheit.com` → Phishing |
| 2 Regeln | Schwarze Liste, gelernte Regeln aus „Zu prüfen“ (jede Bestätigung +6 % Sicherheit) | `werbung@weko.de` → Werbung |
| 3 KI | nur bei Sicherheit unter der Schwelle, nur wenn eingeschaltet | |

Ergebnis: Kategorie + Sicherheit 0–100 % + ein Satz Begründung im Protokoll. **Unter der Schwelle (Standard 85 %) wird nichts verschoben** –
die Mail landet in „Zu prüfen“. Standard-Aktionen (änderbar): Werbung = Label + archivieren + gelesen (+ abmelden, wenn der Absender
mindestens 3 Mails geschickt hat und Tiry keine geöffnet hat), Newsletter = Label + archivieren, Benachrichtigung = Label, Spam/Phishing = Papierkorb.
Beim Altbestand wird nie abgemeldet.

**Gmail-Filter (läuft auch bei ausgeschaltetem PC):** Regeln der Schwarzen Liste und gelernte Regeln mit ≥ 3 Bestätigungen werden echte Gmail-Filter
(`users.settings.filters`). Schutzwörter stehen im Filter als Ausnahme (`negatedQuery`). Erst nach deiner Zustimmung, nie im Trockenlauf.
Regel ausschalten/löschen entfernt auch den Gmail-Filter. Mails, die Gmail so weggeräumt hat, erscheinen beim nächsten Start im Protokoll und sind rückgängig machbar.

## Fehlerbehebung
| Meldung | Ursache / Lösung |
|---|---|
| `invalid_grant` nach ~7 Tagen | App steht noch auf „Testing“ → Abschnitt 2, dann neu anmelden. |
| „Google hat kein Refresh-Token geliefert“ | Zugriff unter myaccount.google.com/permissions entfernen, neu anmelden. |
| „Berechtigung fehlt“ | Bei der Anmeldung nicht alle Häkchen gesetzt → neu anmelden. |
| „historyId zu alt“ im Log | Normal nach langer Pause: die letzten 14 Tage werden automatisch neu durchsucht. |
| 429 / „API-Grenze“ im Log | Gmail bremst kurz; das Programm wartet automatisch (exponentielles Backoff) und macht weiter. |
| „Windows-Verschlüsselung nicht verfügbar“ | Tokens werden absichtlich nicht unverschlüsselt gespeichert – mit normalem Windows-Benutzerkonto starten. |
| Status „Fehler“ im Cockpit | Text lesen, „Erneut versuchen“. Protokolldatei: `%APPDATA%\Email-Aufräumer\aufraeumer.log`. |

Quoten-Zähler: Fußzeile links („Quote heute … E.“, Einheiten laut Gmail-API-Doku je Methode). Das Programm fragt höchstens 8 Mails
gleichzeitig ab und nutzt `batchModify` beim Altbestand (bis 1000 Mails pro Aufruf); bei 429/5xx wartet es mit exponentiellem Backoff.

## Entwicklung (Ordner `email-aufraeumer/`)
```bash
npm install
```
```bash
npm test
```
```bash
npm run demo
```
- `npm test` – 67 Tests (Vitest): 36 Beispiel-Mails, Trockenlauf, Rückgängig, history/404, Kontakte, Backoff, Lernen, Filter-Export, Altbestand, Abmelden. Gmail ist gemockt.
- `npm run demo` – echtes Programm mit Postfach im Arbeitsspeicher (dein Konto wird nicht berührt), neue Mails tröpfeln alle 6 s herein.
- Screenshots aller 6 Bereiche bei 1440 px und 390 px: `npm run build && xvfb-run -a node scripts/screenshots.mjs` (liegen in `screens/`).
- Symbole: `node scripts/icon.mjs`. Installer: `npm run dist` **auf Windows** (unter Linux braucht electron-builder Wine).

### Aufbau
- `src/core/` – Logik ohne Electron: `pipeline.ts` (Einordnung), `signals.ts`, `headers.ts`, `actions.ts` (Ausführen/Trockenlauf/Rückgängig),
  `service.ts` (Hintergrunddienst, history, Altbestand, Lernen, Filter-Export), `unsubscribe.ts`, `gmail.ts` (googleapis + Backoff + Quote),
  `ai.ts` (Claude Haiku), `db.ts` (SQLite), `speicherGmail.ts` (Gmail im Arbeitsspeicher für Tests/Demo).
- `src/main/` – Electron: `main.ts` (Fenster, Tray, Autostart, IPC), `auth.ts` (OAuth Desktop-App, Loopback + PKCE, Tokens per `safeStorage`), `preload.ts`, `demo.ts`.
- `src/renderer/` – Oberfläche (Vanilla TS, strenge CSP ohne Inline-Code). `strom.ts` = Signatur-Moment.

### Gestaltung
Konzept: **„Technische Zeichnung einer Filteranlage, die lebt.“** Papier + Tinte als Grundton, ein Akzent: Zinnoberrot = ausgesiebt.
Signatur: rechts fällt jede echte Mail als Tintentropfen (WebGL2, eigener Shader mit Körnung) durch drei federnde Sieb-Membranen
(Signale, Regeln, KI); Müll prallt ab und wird rot in die Rinne gespült, Behaltenes setzt sich unten als Sediment ab, Unsicheres bleibt auf
der dritten Membran liegen. Auf den Unterseiten schrumpft die Anlage zu einer schmalen Spalte und läuft weiter.
Leistung: Auflösung sinkt automatisch unter 38 fps, Pause bei minimiertem/verstecktem Fenster, Rückfall auf Canvas 2D ohne WebGL,
`prefers-reduced-motion` = keine Bewegung.

### Abhängigkeiten (mit Begründung)
- `googleapis` – offizielles Google-Paket für Gmail-API und OAuth (Vorgabe).
- `@anthropic-ai/sdk` – offizielles Anthropic-Paket für die optionale KI-Stufe.
- Entwicklung: `electron`, `electron-builder` (Windows-Installer), `typescript`, `vitest`, `@types/node`.
- **SQLite ohne Zusatzpaket:** eingebautes `node:sqlite` (in Electron 45 / Node 24 enthalten) – keine native Kompilierung, kein Ärger beim Installer.
- Schriften lokal eingebettet (SIL Open Font License, Lizenztexte in `src/renderer/fonts/`): Archivo (variable Breite/Stärke), JetBrains Mono.
- Screenshots/Symbole nutzen das vorinstallierte Playwright (keine Projekt-Abhängigkeit).
