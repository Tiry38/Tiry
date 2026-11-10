---
name: wow-neues-addon
description: Legt ein neues WoW-Forever-Add-on für Tiry nach Projektstandard an – Ordner mit vier TOCs, Haupt-Lua mit Version, Slash-Befehl und gespeicherten Einstellungen, Simulations-Test und Eintrag im Test-Skript. Verwenden, wenn Tiry ein neues Add-on möchte.
argument-hint: "<Name in CamelCase> <kurze Beschreibung>"
---

# Neues Add-on anlegen: $ARGUMENTS

> **Branch:** Die Add-ons liegen (bis Tiry sie nach `main` holt) im Branch `claude/wow-addons`. Fehlt der Ordner
> `wow-addons/TirysZentrale` im Arbeitsordner: `git fetch origin claude/wow-addons` und auf diesem Branch arbeiten.

Vorher Skill `wow-forever` laden (API-Grenzen, Design). Klären, ob es das schon als Funktion in einem
bestehenden Add-on gibt (`wow-addons/UEBERGABE.md`) – dann lieber dort einbauen.

## 1. Ordner `wow-addons/addons/<Name>/`
Vier TOCs mit identischem Inhalt: `<Name>.toc`, `<Name>_Forever.toc`, `<Name>_Camelot.toc`, `<Name>_Mainline.toc`:

```
## Interface: 16001
## Title: |cff39ff6b<Teil1>|r|cff2de2e6<Teil2>|r
## Notes: <ein Satz, Deutsch, ohne Umlaute-Probleme: ae/oe/ue sind in TOCs sicherer>
## Author: Tiry
## Version: 1.0.0
## SavedVariables: <Name>DB

<Name>.lua
```

## 2. `<Name>.lua` – Grundgerüst
- Kopf: `-- <Name> 1.0.0 (Tiry): <Zweck>` und `local VERSION = "1.0.0"` (wird von `tools/release.py` gepflegt).
- Chat-Ausgabe über eine Funktion `P(msg)` mit farbigem Präfix.
- `ADDON_LOADED` → Standardwerte in `<Name>DB` einmischen (nie überschreiben, was Tiry eingestellt hat).
- Slash-Befehl `/<kurz>` mit `hilfe`, `an`/`aus` und Versionsausgabe.
- Alles, was im Kampf gesperrt ist (Frames bauen/verschieben, geschützte Aufrufe), erst nach
  `PLAYER_REGEN_ENABLED` erledigen. Fehler mit `pcall` abfangen, nie Lua-Fehler ins Spiel werfen.
- Design nach Tirys Regeln: Glas-Fläche, Neon-Verlauf, runde Formen, Atlas-Symbole, große Klickflächen.

## 3. Test `wow-addons/tests/<kurz>.lua`
Nach dem Muster von `tests/mp.lua` bzw. `tests/proc.lua`: minimale WoW-API nachbauen, `dofile("<Name>.lua")`,
Ereignisse auslösen und das Verhalten prüfen. Bei Fehlern `os.exit(1)`, am Ende eine OK-Zeile ausgeben.

## 4. Test-Skript erweitern
In `wow-addons/tools/test_all.sh` ein Ziel ergänzen, z. B.:

```bash
if want <kurz>; then run "<Name>" "$A/<Name>" "<OK-Zeile>" lua5.1 "$T/<kurz>.lua"; fi
```

Dann `bash wow-addons/tools/test_all.sh` → `ALLES GRUEN`.

## 5. Doku
Zeile in der Add-on-Tabelle von `wow-addons/UEBERGABE.md` (Version, Zweck, Stand „Test offen“).
Ausliefern mit dem Skill `wow-release` – nur, wenn Tiry es will.
