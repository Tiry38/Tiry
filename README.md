# Tiry

## Tiry App Forge → [`app-forge/`](app-forge/README.md)

Windows-Programm, das automatisch sinnvolle Handy-Apps im Premium-Design erschafft, testet, bewertet und dauerhaft selbst verbessert. Mit Trend-Radar, Autopilot, Cloud-Betrieb und Fernsteuerung vom Handy.

- Start: `cd app-forge && npm install && npm start`
- Cloud & Fernsteuerung: [`app-forge/cloud/README.md`](app-forge/cloud/README.md)
- Projektleitfaden für Claude: [`CLAUDE.md`](CLAUDE.md)

## WoW-Forever-Add-ons → [`wow-addons/`](wow-addons/README.md)

Eigene World-of-Warcraft-Add-ons (LevelPilot, ProcAlarm, EnhanceHUD u. a.) samt Routen-Werkzeugen und Tests.

- Projektleitfaden für Claude: [`wow-addons/CLAUDE.md`](wow-addons/CLAUDE.md) · Stand: [`wow-addons/UEBERGABE.md`](wow-addons/UEBERGABE.md)

### Claude-Werkzeuge für die Add-ons (Plugin „wow-werkstatt“)
Skills in [`.claude/skills/`](.claude/skills/) – laden automatisch in jeder Claude-Code-Sitzung auf diesem Repo
(auch in der Cloud): `/wow-tests`, `/wow-release <Add-on> <Version>`, `/wow-forever`, `/wow-neues-addon`.
Dieselben Skills als Plugin für Claude Code (Desktop/Terminal), solange sie nur im Branch `claude/wow-addons` liegen:

```
/plugin marketplace add Tiry38/Tiry#claude/wow-addons
/plugin install wow-werkstatt@tiry
```
