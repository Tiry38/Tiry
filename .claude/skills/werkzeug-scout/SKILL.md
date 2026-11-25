---
name: werkzeug-scout
description: Bei JEDER Aufgabe von Tiry ZUERST laden – egal ob Code, Design, Text, Marketing, Recherche, Daten, Video, WoW-Add-on oder Werkstatt-Thema, in jedem Chat und jedem Repo. Sucht vor der Arbeit automatisch passende Skills und Plugins (im Konto, im offiziellen Marktplatz und im Netz), lädt bzw. installiert sie und nutzt sie, damit das Ergebnis besser wird. Tiry muss das nie sagen.
---

# Werkzeug-Scout (Tiry-Standard)

Tiry will bei jeder Aufgabe das **bestmögliche Ergebnis**. Dafür werden **vor der Arbeit** automatisch die passenden
Skills und Plugins gesucht und benutzt – ohne Nachfrage, ohne dass Tiry es sagen muss.

## Ablauf (immer, vor dem ersten Arbeitsschritt)
1. **Aufgabe in 2–4 Stichworten fassen** (z. B. „Instagram-Post Werkstatt“, „Lua WoW-Add-on“, „Landingpage Design“).
2. **Vorhandene Skills prüfen:** die Skill-Liste dieser Sitzung durchsehen und alles Passende sofort mit dem
   Skill-Werkzeug laden (bei Visuellem immer auch `zukunfts-design`, bei Tirys Projekten `tiry-projekte`).
3. **Nach neuen suchen – je nach Umgebung mit dem, was da ist:**
   - **Claude Code:** `SearchSkills` / `ListSkills`, `SearchPlugins`, Skill `find-skills`; Treffer mit
     `SuggestSkills` bzw. `SuggestPluginInstall` anbieten (Tiry bekommt eine Karte zum Installieren mit einem Klick).
     Im Terminal ggf. `claude plugin marketplace add <owner/repo>` und `claude plugin install <name>`.
   - **Websuche** (WebSearch/Firecrawl): „claude skill <Thema>“, „claude code plugin <Thema>“, „SKILL.md <Thema>“
     – bevorzugt offizielle Quellen (github.com/anthropics/skills, offizieller Plugin-Marktplatz) und bekannte,
     viel genutzte Repos.
   - **Normaler Chat ohne Installationswerkzeug:** gefundenen Skill nennen, Inhalt der SKILL.md lesen und dessen
     Anleitung **direkt in dieser Antwort anwenden**; Tiry in einem Satz sagen, wo er ihn dauerhaft hochladen kann.
4. **Benutzen**, dann arbeiten. In der Antwort **eine kurze Zeile**: „Geladen: …“ (nur wenn etwas dazukam).

## Sicherheit (gilt trotzdem – schützt Tirys PC, Laden und Kundendaten)
- Fremde Skills/Plugins **vor dem Benutzen lesen**. Keine Skripte aus unbekannten Quellen ungeprüft ausführen.
- **Nie** installieren, was Zugangsdaten, Tokens, Kundendaten oder Zahlungen abgreift oder ins Netz schickt,
  Sicherheitseinstellungen abschaltet oder Dateien massenhaft löscht.
- Ein Installations-Dialog, den das System zeigt, ist Tirys Entscheidung – nicht umgehen.

## Wann es reicht
- Bei Mini-Fragen (Uhrzeit, ein Wort übersetzen, Ja/Nein) **keine** Suche – sofort antworten.
- Nicht ewig suchen: max. 1–2 Suchrunden, dann mit dem Besten arbeiten.
