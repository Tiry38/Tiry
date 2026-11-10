---
name: wow-tests
description: Führt alle Tests der WoW-Forever-Add-ons in wow-addons/ aus (Tiry's Zentrale, LevelPilot, ProcAlarm, Schlaghagel, Blitzschild, ChatHoch, MiniPost, EnhanceHUD, Syntax) und meldet das Ergebnis. Nach jeder Änderung an einem Add-on und vor jedem Commit oder Release verwenden.
argument-hint: "[zentrale|levelpilot|proc|hagel|blitzschild|chathoch|minipost|enhancehud|syntax]"
---

# WoW-Add-on-Tests

> **Branch:** Die Add-ons liegen (bis Tiry sie nach `main` holt) im Branch `claude/wow-addons`. Fehlt der Ordner
> `wow-addons/TirysZentrale` im Arbeitsordner: `git fetch origin claude/wow-addons` und auf diesem Branch arbeiten.

Ein Befehl für alle Tests (Lua 5.1 gegen den Forever-Nachbau, busted, luacheck, Layout, Syntax):

```bash
bash wow-addons/tools/test_all.sh $ARGUMENTS
```

Ohne Argument laufen alle Ziele (~25 s). Mit Ziel nur dieses, z. B. `zentrale` oder `levelpilot syntax`.
Exit-Code 0 und die letzte Zeile `ALLES GRUEN` = bestanden.

## Bei Fehlern
1. Die Zeilen unter `FEHLER` zeigen die letzten 20 Ausgabezeilen des Tests. Den Test einzeln nachstellen:
   - Zentrale: aus `wow-addons/`: `lua5.1 tests/run_tests.lua`, `busted`, `luacheck TirysZentrale`,
     `lua5.1 tests/check_layout.lua <ordner>` (Bilder: `python3 -I tools/render_pages.py <ordner>`)
   - LevelPilot: `cd wow-addons/addons/LevelPilot && lua5.1 ../../tests/v4.lua` (muss „ALLE TESTS OK“ melden),
     ebenso `lp.lua`, `lp2.lua`, `nav.lua`, `fly.lua`, `route.lua`
   - ProcAlarm / Schlaghagel: `cd wow-addons/addons && lua5.1 ../tests/proc.lua` bzw.
     `PROC_CLASS=SHAMAN lua5.1 ../tests/hagel.lua` (auch `WARLOCK`)
2. Die Ursache im Add-on beheben. Tests nie abschwächen, überspringen oder Erwartungen „passend machen“,
   nur weil sie rot sind – außer die Erwartung ist nachweislich durch eine gewollte Änderung überholt
   (dann im Commit begründen).
3. Danach erneut den kompletten Lauf starten.

## Bericht an Tiry
Kurz und auf Deutsch: Anzahl ok/fehlgeschlagen, was repariert wurde, und **klar sagen, was nur im Spiel
prüfbar ist** (Kampf-Auren, echte AH-Antworten, Blizzard-Drosselung, Optik in 4K) – die Tests bilden die
WoW-API nur nach.
