# Tiry – Projektleitfaden für Claude

Repo von Tiry mit mehreren Projekten (siehe unten). UI-Sprache und Doku: **Deutsch**.

## Design-Regeln (Pflicht – für ALLES Visuelle in diesem Repo: Programme, Velo-TV, Webseiten)
- **Vor jeder visuellen Arbeit den Skill `zukunfts-design` laden** (`.claude/skills/zukunfts-design/SKILL.md`) und
  zusätzlich vorhandene Design-Skills (`design-taste-frontend`, `modern-awwwards-web-design`, `artifact-design` bei Artifacts).
  Tiry muss das nie extra sagen.
- Ziel: **Zukunfts-Design, 20 Jahre voraus** – nicht „modern 2026“. Milliarden-Test: Würde jede KI das so bauen? Dann verwerfen.
- **Verboten (KI-Einheitslook):** Glas-Karten/Glaspillen als Hauptstil, Lila-Pink-Verläufe, Aurora-Blobs als Tapete,
  Glows überall, Kachelraster, Kasten-in-Kasten, zentrierter Standard-Hero, Emoji-Icons, Fade-in-up auf allem.
- **Pflicht:** Konzept-Satz + Signatur-Moment vor dem Code; mind. 3 Zukunfts-Techniken (Räumlichkeit/WebGL, generative
  Shader-Oberflächen, Feder-Physik, Typografie als Architektur, gebrochenes Editorial-Raster, Material/Grain,
  morphende Übergänge, reaktive Umgebung). Farbe: ein Grundton + ein radikaler Akzent (oklch).
- Kontrast Text ≥ 4.5:1, Tipp-Flächen ≥ 44 px, `prefers-reduced-motion` beachten, kein horizontales Scrollen.
  **Ausnahme Homepage (Tiry 15.11.2026):** Dort laufen alle Animationen immer, auch bei „Bewegung reduzieren“ – keine Reduce-Regeln wieder einbauen.

## Arbeitsweise
- Änderungen klein und getestet; nach UI-Änderungen Smoke-Screenshots prüfen.
- Keine Geheimnisse committen (API-Keys, Service-Accounts). Secrets nur über GitHub-Secrets bzw. verschlüsselte Settings.

## Homepage (wichtigstes Thema aktuell)
- **„Homepage“ meint IMMER die neue Seite https://www.velo-center.de (früher tiry38.github.io/velo-center-web)** – nie die alte velo-center.de (Coco).
- Quelle: `velocenter-homepage/` (Regeln in `ENTSCHEIDUNGEN.md`, Ablauf in `LIVEGANG.md`), bauen mit
  `python3 tools/live_bauen.py <tmp>`, dann in Repo `Tiry38/velo-center-web` (`main`) kopieren (ohne `README.md`, `google.json`).
- **Eigene Domain seit 28.11.2026: https://www.velo-center.de** (IONOS-DNS → GitHub Pages). Die Datei **`CNAME` im Web-Repo nie löschen**
  (Tiry: „ganz wichtig“) – sonst ist die Seite weg. Bilder-Agent und Admin-Chat (`.github/workflows/homepage-*.yml`) lassen sie stehen.

- **Direkt live (Tiry 24.11.2026):** Fehlerbehebungen und von Tiry konkret bestellte Änderungen sofort live stellen und danach live prüfen – keine Vorschau-Seiten dafür. Vorschauen nur für neue Design-Vorschläge, danach wieder löschen.
- **Qualitäts-Regel für jeden Vorschlag (Tiry 15.11.2026, verbindlich):** Nie „Billo“-Entwürfe zeigen. Jeder Vorschlag muss auf dem Niveau der
  bestehenden Homepage oder darüber liegen: hochmodern wie bei einem Hightech-Unternehmen (Glas, Tiefe, Licht, saubere Bewegung, starke Funktionen).
  Vor dem Zeigen selbst vergrößert gegen die echte Seite prüfen; was dagegen abfällt, wird nicht gezeigt. Lieber ein ausgearbeiteter Vorschlag als mehrere schnelle.
  Verboten: flache/schlichte Notlösungen (Striche, Wellenlinien, bunte Blasen, Spielzeug-Effekte), Baukasten- oder Alt-Windows-Optik. Wenn nur ein Teil
  geändert werden soll (z. B. „nur das Menüband“), bleibt der Rest der Seite unangetastet.

## Weiteres Projekt im Repo
- **WoW-Forever-Add-ons** in `wow-addons/` – eigener Leitfaden `wow-addons/CLAUDE.md`, Stand in `wow-addons/UEBERGABE.md`.
  Für Arbeit dort gelten die Regeln aus `wow-addons/CLAUDE.md`.
  Arbeitsstand im Branch **`claude/wow-addons`**, bis Tiry ihn nach `main` holt. Skills dafür: `.claude/skills/wow-*`.
