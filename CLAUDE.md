# Tiry App Forge – Projektleitfaden für Claude

Windows-Programm (Electron), das automatisch sinnvolle, hochwertige Handy-Apps (Spiele + Werkzeuge) erschafft,
testet, bewertet und dauerhaft selbst weiterentwickelt. Besitzer: Tiry. UI-Sprache und Doku: **Deutsch**.

## Befehle (alle im Ordner `app-forge/`)
- `npm test` – Unit-, Pipeline- (simulierte KI) und Claude-Client-Tests. **Muss vor jedem Commit grün sein.**
- `npm run selftest -- --quick` – baut alle Premium-Vorlagen und testet sie im Handy-Format (Playwright).
- `xvfb-run -a -s "-screen 0 1600x1000x24" npx electron . --smoke --no-sandbox --disable-gpu`
  mit `FORGE_DATA_DIR=<tmp>` und `FORGE_SMOKE_OUT=<tmp>` – End-to-End der echten Windows-Oberfläche,
  speichert Screenshots aller Ansichten. **Nach UI-Änderungen ausführen und die Screenshots ansehen.**
- `node scripts/cloud-run.js` – Kopfloser Lauf (wie GitHub Actions), Modus über `FORGE_MODE`.
- `npm start` – Programm starten (Windows). `npm run dist` – Installer bauen.

## Gratis-Modus (Standard) vs. API-Modus
- **Gratis (Standard):** Keine API-Kosten. Die KI-Arbeit erledigt eine nächtliche Claude-Code-Sitzung über das
  Claude-Abo – Ablauf exakt nach `app-forge/docs/GRATIS-MODUS.md`, Werkzeug `node scripts/forge-cli.js`
  (brief / check / import / evolve / list / html / lesson), Bibliothek per `bash scripts/library-sync.sh pull|push`
  im Branch `forge-library`. Das Windows-Programm holt die Apps automatisch („Cloud-Apps holen“).
- **API-Modus:** Einstellungen → KI-Modus → „API-Key“ (Desktop) bzw. Secret `ANTHROPIC_API_KEY` (Cloud).
  Ein gespeicherter Key wird im Gratis-Modus nie benutzt.

## Architektur: Hub + Kabel
- `src/hub/` – Nervensystem: EventBus (`x.y`, `x.*`, `*`), Registry (Fähigkeiten), Actions (gemeinsame
  Befehlsschicht für UI, REST-API, Autopilot, Firebase), Hooks (Wasserfall + `veto`), JobQueue, Settings, PluginManager.
- `src/connectors/` – jedes „Kabel“ ist ein Plugin `{ id, name, kind, provides, requires, env, settings, start(ctx) }`.
  Neue Anbindung = neues Plugin-Objekt in `core.js`/`network.js`/`desktop.js` + Eintrag in `index.js`.
  `env: 'electron' | 'cloud'` beschränkt auf Desktop bzw. Cloud; `available(env)` für Laufzeit-Verfügbarkeit.
- `src/core/forge.js` – Pipeline: Idee (Zufall + Trend) → Konzept mit Sinn-Check → Bau → Test → KI-Fix-Schleife
  → Design-Jury per Screenshot → Feinschliff → Design-Gate (≥ 7/10) → Version → Lernspeicher.
  Weiterentwicklung übernimmt nur Versionen, die nicht schlechter sind; sonst automatisch verworfen.
- `src/core/ai-client.js` – Claude über `@anthropic-ai/sdk` (Streaming, JSON-Schema-Ausgabe, Prompt-Caching,
  serverseitiger Fallback, Budget). Standardmodell `claude-opus-5-5`. Keine `temperature`, kein `budget_tokens`.
- `src/core/offline/` – 6 Premium-Vorlagen für den Betrieb ohne API-Key.
- `src/testers/` – Test-Labor: Electron-Offscreen (Desktop) bzw. Playwright (Cloud/CI), Monkey-Test in `core/monkey.js`.
- `src/renderer/` – Oberfläche (Vanilla JS, CSP ohne Inline-Skripte). `src/main/` – Electron-Hauptprozess.
- `scripts/cloud-run.js` + `.github/workflows/forge-cloud.yml` – Cloud-Autopilot, Bibliothek im Branch `forge-library`.
- `cloud/` – Firebase Hosting (Galerie + Fernsteuerung) und Firestore-Regeln.

## Design-Regeln (Pflicht – für das Programm UND für erzeugte Apps)
- „Bombenmäßig“, Premium 2026. **Keine Baukasten-Formen**: keine Kasten-in-Kasten, keine eckigen Kachelraster.
  Organisch: Kreise, Pillen, Blobs, Wellen, große Radien, gestaffelte Layouts.
- **Coole Farbverläufe** überall (3+ Farben, sanft animiert), Glas-Effekte, weiche Glows.
- Kontrast Text ≥ 4.5:1, Tipp-Flächen ≥ 44 px, `prefers-reduced-motion` beachten, kein horizontales Scrollen.
- Erzeugte Apps: eine HTML-Datei, offline, keine externen Ressourcen/Google Fonts, keine Tracker.

## Arbeitsweise
- Änderungen klein und getestet; nach UI-Änderungen Smoke-Screenshots prüfen.
- Keine Geheimnisse committen (API-Keys, Service-Accounts). Secrets nur über GitHub-Secrets bzw. verschlüsselte Settings.
- Keine Kopien bestehender Apps/Spiele, keine Markennamen in erzeugten Apps.

## Weiteres Projekt im Repo
- **WoW-Forever-Add-ons** in `wow-addons/` – eigener Leitfaden `wow-addons/CLAUDE.md`, Stand in `wow-addons/UEBERGABE.md`.
  Für Arbeit dort gelten die Regeln aus `wow-addons/CLAUDE.md` (die App-Forge-Befehle oben betreffen nur `app-forge/`).
  Arbeitsstand im Branch **`claude/wow-addons`**, bis Tiry ihn nach `main` holt. Skills dafür: `.claude/skills/wow-*`.

## Drittes Projekt im Repo: Aetherfront (Spiel)
- **Aetherfront** in `aetherfront/` – 3D-Lane-Defense-Spiel (Electron + Three.js), Doku in `aetherfront/README.md`.
- Befehle dort: `npm test` (Regeln, Determinismus, Online-Sync – vor jedem Commit grün), `npm run build`,
  `npm run smoke` (Playwright-Screenshots, nach UI-/Grafikänderungen ansehen), `npm start`, `npm run server`.
- Simulation (`src/sim/`) muss deterministisch bleiben: kein `Math.random`, keine Zeit/Rendering-Abhängigkeit,
  alle Aktionen als Befehle über `applyCommand` – sonst bricht das spätere Online-Spiel (Lockstep).
- Keine fremden Assets, Markennamen oder Figuren bestehender Spiele; Modelle, Musik und Effekte werden prozedural erzeugt.
