# Tiry

## Tiry App Forge → [`app-forge/`](app-forge/README.md)

Windows-Programm, das automatisch sinnvolle Handy-Apps im Premium-Design erschafft, testet, bewertet und dauerhaft selbst verbessert. Mit Trend-Radar, Autopilot, Cloud-Betrieb und Fernsteuerung vom Handy.

- Start: `cd app-forge && npm install && npm start`
- Cloud & Fernsteuerung: [`app-forge/cloud/README.md`](app-forge/cloud/README.md)
- Projektleitfaden für Claude: [`CLAUDE.md`](CLAUDE.md)

## WoW-Forever-Add-ons → Ordner `wow-addons/` (Arbeitsstand im Branch `claude/wow-addons`)

Eigene World-of-Warcraft-Add-ons (Tiry's Zentrale, LevelPilot, ProcAlarm, Schlaghagel u. a.) samt Routen-Werkzeugen
und Tests. Solange Tiry sie nicht nach `main` holt, liegen sie nur im Branch `claude/wow-addons`.

- Projektleitfaden für Claude: `wow-addons/CLAUDE.md` · Stand: `wow-addons/UEBERGABE.md` (beide im Branch)

### Claude-Werkzeuge für die Add-ons (Plugin „wow-werkstatt“)
Skills in [`.claude/skills/`](.claude/skills/) laden automatisch in jeder Claude-Code-Sitzung auf diesem Repo
(auch in der Cloud): `/wow-tests`, `/wow-release <Add-on> <Version>`, `/wow-forever`, `/wow-neues-addon`.
Optional für Claude Code auf dem PC: einmal in PowerShell `claude plugin marketplace add Tiry38/Tiry`, dann in der
Desktop-App „+“ neben dem Eingabefeld → „Add plugins“ → „wow-werkstatt“.
