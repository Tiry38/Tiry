# Cloud & Fernsteuerung einrichten

**Ziel:** Die Forge arbeitet weiter, während dein PC aus ist. Du steuerst alles vom Handy.

Einmalig ca. 20 Minuten. Jeder Schritt ist optional; das Programm läuft auch ohne Cloud.

---

## 1. Gratis-Modus: Basis (0 €)

1. **Claude Zugriff auf das Repository geben:**
   - https://claude.ai/connect-github öffnen und GitHub verbinden.
   - Die Claude GitHub App für `Tiry38/Tiry` installieren.
2. **`main` als Standard-Branch:** Auto-Updates bauen aus `main`, Zeitpläne laufen nur auf dem Standard-Branch.
   - Im Browser (nicht in der GitHub-App) https://github.com/Tiry38/Tiry/settings öffnen.
   - Abschnitt **Default branch** → Pfeil-Symbol ⇄ → `main` → **Update** → bestätigen.
3. **Nächtliche Claude-Sitzung:** Sie wird als geplante Aufgabe eingerichtet und folgt [`docs/GRATIS-MODUS.md`](../docs/GRATIS-MODUS.md). Sie läuft über dein Claude-Abo und zählt nur gegen dein Nutzungslimit.
4. **Windows-Programm:** Es holt die Apps automatisch aus der Cloud (Cloud → „Cloud-Apps holen“).
   - Öffentliches Repository: kein Token nötig.
   - Privates Repository: unter Netzwerk → „GitHub Cloud-Autopilot“ einen GitHub-Token mit Lesezugriff eintragen.
5. Der GitHub-Ablauf **Forge Cloud Autopilot** veröffentlicht alle 6 Stunden Galerie und Fernsteuerung (Firebase, Schritt 2).
   - Öffentliches Repository: kostenlos.
   - Privates Repository: etwa 15 Minuten pro Tag; das liegt unter den 2.000 Freiminuten pro Monat.

**Umstellung auf API-Key (Dauerbetrieb, kostet):**
- **Cloud:** Repository → Settings → Secrets and variables → Actions → Secret `ANTHROPIC_API_KEY` anlegen.
  - Ab dann erschafft und verbessert der 6-Stunden-Lauf selbst Apps.
  - Optionale Variablen: `FORGE_MODEL` (z. B. `claude-sonnet-5-5`) und `FORGE_DAILY_USD` (Tagesbudget, Standard 5).
- **PC:** Einstellungen → KI-Modus → „API-Key“.
- Secret löschen bzw. „Gratis“ wählen: keine Kosten mehr.

## 2. Firebase: Galerie + Fernsteuerungs-Seite

1. console.firebase.google.com → **Projekt erstellen**.
2. **Firestore Database** → Datenbank erstellen (Produktionsmodus, Region `europe-west3` Frankfurt).
3. **Authentication** → Anmeldemethode **Google** aktivieren.
4. **Firestore → Regeln:** Inhalt von [`firestore.rules`](firestore.rules) einfügen, `DEINE-EMAIL@example.com` durch deine Google-Adresse ersetzen, **Veröffentlichen**.
5. **Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren** (JSON-Datei).
6. **Projekteinstellungen → Allgemein → Web-App hinzufügen** und das `firebaseConfig`-Objekt als JSON kopieren.
7. GitHub-Secrets anlegen:
   - `FIREBASE_SERVICE_ACCOUNT`: kompletter Inhalt der JSON-Datei aus Schritt 5.
   - `FIREBASE_PROJECT_ID`: Projekt-ID.
   - `FIREBASE_WEB_CONFIG`: das `firebaseConfig`-JSON aus Schritt 6.
8. Nächster Cloud-Lauf (auch im Gratis-Modus) → Galerie unter `https://<projekt-id>.web.app`, Fernsteuerung unter `https://<projekt-id>.web.app/remote`.

**Falls das Hosting-Deployment mit „permission denied“ scheitert:** In der Google Cloud Console (IAM) dem Dienstkonto die Rolle **Firebase Hosting Admin** geben.

**PC mit der Fernsteuerung verbinden:** Im Programm → Netzwerk → Knoten „Firebase (Fernsteuerung)“ → Projekt-ID und Service-Account-JSON eintragen → einschalten. Befehle mit Ziel „PC“ führt dann dein PC aus, Ziel „Cloud“ der nächste Cloud-Lauf.

---

## 3. Claude Code vom Handy

- **Claude Code App / claude.ai/code:** Neue Sitzung mit dem Repository `Tiry38/Tiry` starten und sagen, was am Programm verbessert werden soll. Claude arbeitet in der Cloud; `CLAUDE.md` erklärt ihm Projekt, Tests und Design-Regeln, und ein Start-Hook installiert alles automatisch.
- **GitHub-Issues:** `@claude` in einem Issue oder Kommentar erwähnen (`.github/workflows/claude.yml`). Benötigt das Secret `ANTHROPIC_API_KEY` oder `CLAUDE_CODE_OAUTH_TOKEN`; letzteres erzeugt `claude setup-token` im Terminal, wenn du ein Pro/Max-Abo hast.

---

## 4. Automatische Programm-Updates

`build-windows.yml` baut bei jeder Änderung auf `main` einen neuen Installer und veröffentlicht ihn als GitHub-Release. Das installierte Programm prüft beim Start und alle paar Stunden auf Updates.

**Wichtig:** Aus einem **privaten** Repository kann das Programm Releases nur mit Token lesen. Für Auto-Updates das Repository öffentlich machen, oder im Netzwerk-Knoten „Programm-Updates“ eine eigene Update-URL (generic) eintragen.
