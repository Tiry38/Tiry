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

## Arbeitsweise
- Änderungen klein und getestet; nach UI-Änderungen Smoke-Screenshots prüfen.
- Keine Geheimnisse committen (API-Keys, Service-Accounts). Secrets nur über GitHub-Secrets bzw. verschlüsselte Settings.

## Weiteres Projekt im Repo
- **WoW-Forever-Add-ons** in `wow-addons/` – eigener Leitfaden `wow-addons/CLAUDE.md`, Stand in `wow-addons/UEBERGABE.md`.
  Für Arbeit dort gelten die Regeln aus `wow-addons/CLAUDE.md`.
  Arbeitsstand im Branch **`claude/wow-addons`**, bis Tiry ihn nach `main` holt. Skills dafür: `.claude/skills/wow-*`.
