# Tiry App Forge

**Windows-Programm, das automatisch sinnvolle, hochwertige Handy-Apps erschafft, testet, bewertet und dauerhaft selbst weiterentwickelt.**

Spiele und Werkzeuge, zufällig, aber mit Sinn-Check. Modernes, organisches Design mit Farbverläufen. Automatisch im Handy-Format getestet, von einer KI-Design-Jury per Screenshot bewertet und Version für Version verbessert. Schlechtere Versionen werden automatisch verworfen.

---

## Schnellstart (Windows)

1. **Node.js 22** installieren (nodejs.org).
2. Im Ordner `app-forge`:
   ```
   npm install
   npm start
   ```
3. **Installer bauen:** `npm run dist` → `dist/Tiry App Forge Setup x.y.z.exe`.

**Ohne API-Key** läuft das Programm im Offline-Modus: Es erschafft Apps aus 6 Premium-Vorlagen (Gewohnheiten, Fokus, Budget, Wasser, Timing-Spiel, Memory) mit zufälligen Paletten, Stilen und Namen.

**Mit API-Key** (Einstellungen → KI) erfindet Claude völlig neue Apps, repariert Fehler, bewertet das Design und entwickelt die Apps weiter. Key erstellen: console.anthropic.com → API Keys.

---

## Was passiert beim Erschaffen einer App?

1. **Idee:** Zufalls-Impuls (Kategorie, Zielgruppe, Twist, Stimmung) plus Trend-Radar (was sich gerade verkauft).
2. **Konzept + Sinn-Check:** Nutzen, Klarheit, Originalität, Machbarkeit und Marktchance müssen jeweils mindestens 7/10 erreichen. Sonst wird nachgeschärft (bis zu 3 Versuche).
3. **Bau:** eine vollständige, offline-fähige App (PWA) mit Icon, Manifest und Service-Worker.
4. **Test-Labor:** Die App läuft im Handy-Format (390×844). Ein Monkey-Test tippt, wischt und gibt Unsinn ein. Geprüft werden Abstürze, Layout, Tipp-Flächen und Kontrast.
5. **KI-Fix-Schleife:** Fehler gefunden → Claude repariert → erneuter Test.
6. **Design-Jury:** bewertet Screenshot und Code (Design, UX, Sinn, Feinschliff). Unter 8,5 folgt eine Feinschliff-Runde. Unter 7/10 Design wird die App verworfen.
7. **Lernspeicher:** Jeder reparierte Fehler wird zu einer Regel, die künftige Builds befolgen. So wird der Generator selbst besser.

**Autopilot:** erschafft neue Apps, prüft alle Apps regelmäßig, repariert sie und entwickelt die schwächste weiter. Eine neue Version wird nur übernommen, wenn sie nicht schlechter ist. Jede Version bleibt erhalten (Rollback per Klick).

---

## Das Nervensystem (Hub + Kabel)

Alles hängt als „Kabel“ (Plugin) am zentralen Hub. Die Ansicht **Netzwerk** zeigt alle Anschlüsse live.

| Bereich | Anschlüsse |
|---|---|
| Kern | App-Bibliothek, Lernspeicher, Forge-Pipeline, Statistik |
| KI | Claude (Opus 5.5 / Sonnet 5.5 / Haiku 5.5), Trend-Radar (App-Store-Charts + Websuche) |
| Qualität | Test-Labor (Electron offscreen bzw. Chromium in der Cloud) |
| Evolution | Autopilot |
| Veröffentlichen | Store-Export (Capacitor-Projekt, Store-Texte, Datenschutz, Anleitung), WLAN-Vorschau aufs Handy (QR-Code) |
| Integration | Lokale REST-API + Live-Ereignisse (SSE), Webhooks (Discord/n8n), Backup, Firebase-Fernsteuerung, GitHub-Cloud-Autopilot |
| System | Windows-Benachrichtigungen, Auto-Update, Autostart |
| Geplant | Google-Play-Upload, App Store Connect, Canva, KI-Bilder |

**Neues Kabel anschließen:** Plugin-Objekt `{ id, name, kind, provides, requires, settings, start(ctx) }` in `src/connectors/` anlegen und in `src/connectors/index.js` eintragen. Die Einstellungsmaske im Netzwerk erscheint automatisch.

---

## Cloud: läuft ohne deinen PC

- **GitHub Actions** (`.github/workflows/forge-cloud.yml`): alle 6 Stunden ein Autopilot-Lauf. Die Bibliothek liegt im Branch `forge-library`.
- **Firebase Hosting:** Galerie aller Apps plus Fernsteuerungs-Seite (Google-Login, nur deine E-Mail).
- **Claude Code App:** Sitzung mit diesem Repository starten. Claude arbeitet in der Cloud am Programm, `CLAUDE.md` erklärt ihm das Projekt.
- **Auto-Update:** Jede Änderung auf dem Hauptzweig baut einen neuen Installer (`build-windows.yml`). Das Programm aktualisiert sich selbst.

Einrichtung Schritt für Schritt: **[cloud/README.md](cloud/README.md)**.

---

## Verkaufen – technisch und rechtlich

**Technisch:** Jede App lässt sich mit einem Klick als Store-Paket exportieren. Das Paket enthält ein Capacitor-Projekt für Android/iOS, Store-Texte, Datenschutzerklärung, Icons und eine Anleitung. Die Ansicht **Verkauf** prüft die Store-Reife automatisch.

**Rechtlich (Deutschland, Stand 2026 – keine Rechtsberatung):**
- **Rechte an den Apps:** Laut den kommerziellen Bedingungen von Anthropic gehören die KI-Ausgaben dem Kunden. Rein KI-erzeugter Code ist in Deutschland nach herrschender Meinung aber **nicht urheberrechtlich geschützt**, weil eine menschliche Schöpfung fehlt. Andere dürften ihn also kopieren. Eigene Anpassungen, Marke und Store-Auftritt sind dein Schutz.
- **Gewerbe:** Regelmäßiger App-Verkauf ist gewerblich → Gewerbeanmeldung. Kleinunternehmerregelung (§ 19 UStG) möglich, solange der Umsatz im Vorjahr höchstens 25.000 € und im laufenden Jahr höchstens 100.000 € beträgt. Die Umsatzsteuer gegenüber Endkunden in der EU führen Apple und Google ab; Einkommensteuer fällt trotzdem an. Steuerberater fragen.
- **Pflichtangaben:** Für den EU-Vertrieb musst du dich in beiden Stores als „Trader“ (Händler) erklären. Adresse, Telefon und E-Mail werden dann öffentlich angezeigt; eine Geschäftsadresse ist sinnvoll. Außerdem brauchst du ein Impressum (§ 5 DDG) und eine Datenschutzerklärung (Vorlage wird mit exportiert; die Apps speichern nur lokal).
- **Namen:** Vor dem Upload den App-Namen in den Markenregistern prüfen (DPMA, EUIPO). Die Verkaufsprüfung markiert diesen Punkt als manuell.
- **Store-Regeln:**
  - **Google Play:** einmalig 25 US$. Neue private Entwicklerkonten müssen vor der Veröffentlichung 14 Tage lang mit mindestens 12 Testern geschlossen testen.
  - **Apple:** 99 €/Jahr. Richtlinie 4.2 verlangt echten App-Mehrwert, keine verpackte Webseite. Richtlinie 4.3 verbietet viele sehr ähnliche Apps (Spam). Also nur die besten, klar unterschiedlichen Apps einreichen.
  - **Provision:** 15 % im Small-Business-Programm bzw. auf die erste Mio. US$ pro Jahr.
- **Updates:** Für digitale Produkte an Verbraucher gilt eine Aktualisierungspflicht (§§ 327 ff. BGB). Die Weiterentwicklung der Forge hilft dabei.

---

## Entwicklung

```
npm test                       # 28 Tests: Hub, Kern, KI-Pipeline (simuliert), Claude-Client (Fake-Server)
npm run selftest -- --quick    # alle Vorlagen im Handy-Format testen (Playwright)
node scripts/cloud-run.js      # kopfloser Lauf wie in der Cloud (FORGE_MODE=autopilot|create|evolve|trends|commands)
```

End-to-End-Test der echten Oberfläche mit Screenshots aller Ansichten (Linux/CI):
```
FORGE_DATA_DIR=/tmp/fd FORGE_SMOKE_OUT=/tmp/shots xvfb-run -a npx electron . --smoke --no-sandbox --disable-gpu
```

Daten (Windows): `%APPDATA%\Tiry App Forge\forge\` enthält Apps, Versionen, Lernspeicher, Einstellungen (API-Keys verschlüsselt) und Exporte.
