---
name: wow-release
description: Liefert ein WoW-Forever-Add-on an Tiry aus – Tests, Version in allen TOCs hochzählen, Changelog, ZIP bauen, auf den Arbeits-Branch pushen und das ZIP schicken. Nur auf ausdrücklichen Wunsch starten.
argument-hint: "<Add-on> <Version>  (z. B. zentrale 6.0.0)"
disable-model-invocation: true
---

# Add-on ausliefern: $ARGUMENTS

> **Branch:** Die Add-ons liegen (bis Tiry sie nach `main` holt) im Branch `claude/wow-addons`. Fehlt der Ordner
> `wow-addons/TirysZentrale` im Arbeitsordner: `git fetch origin claude/wow-addons` und auf diesem Branch arbeiten.

Feste Regeln (gelten immer):
- **Nie nach `main` mergen oder pushen**, außer Tiry beauftragt es ausdrücklich in dieser Sitzung.
- Gepusht wird nur auf den Arbeits-Branch der Sitzung (bei WoW-Arbeit `claude/wow-addons`):
  `git push -u origin <branch>` (bei Netzfehlern bis zu 4× mit 2/4/8/16 s Pause wiederholen).
- Keine Zwischenstände ausliefern, wenn Tiry „erst komplett“ will.

## Ablauf
1. **Tests:** `bash wow-addons/tools/test_all.sh` – muss `ALLES GRUEN` melden. Sonst erst reparieren
   (siehe Skill `wow-tests`).
2. **Version + ZIP:** `python3 -I wow-addons/tools/release.py <Add-on> <Version>`
   - setzt `## Version:` in allen TOCs des Add-ons und `local VERSION = "…"` in der Haupt-Lua,
   - baut `wow-addons/dist/<Add-on>.zip` (Ordner so, wie er in `Interface\AddOns\` liegt).
   - Kurznamen: `zentrale`, `lp`, `proc`, `hagel`. Erst mit `--dry-run` ansehen, wenn unsicher.
3. **Changelog / Doku:**
   - Zentrale: neuer Abschnitt oben in `wow-addons/CHANGELOG.md` (`## X.Y.Z (TT.MM.JJJJ)`, fett gesetzte
     Kernpunkte), bei neuen Funktionen auch `ZENTRALE.md` / `ANLEITUNG.md`.
   - Alle Add-ons: Stand in `wow-addons/UEBERGABE.md` (Versionstabelle) nachziehen.
4. **Prüfen:** Tests nach dem Versionswechsel noch einmal (`bash wow-addons/tools/test_all.sh syntax`
   genügt, wenn nur Versionen geändert wurden). Bei UI-Änderungen der Zentrale die Vorschaubilder ansehen.
5. **Commit + Push:** klare deutsche Commit-Nachricht (`<Add-on> X.Y.Z: <Kern der Änderung>`), danach
   Push auf den Arbeits-Branch (siehe Regeln oben).
6. **An Tiry:** das ZIP senden (bei Bedarf eine Vorschau aus `wow-addons/previews/`) und den Einbau nennen:
   alten Ordner in `Interface\AddOns` löschen, ZIP entpacken, **WoW komplett neu starten** (bei neuen
   Dateien, Bildern oder Sounds reicht `/reload` nicht).

## Bericht
Deutsch, direkt, „Tiry“: Version, was neu ist (fett), was **nur im Spiel prüfbar** ist, Dateipfad des ZIPs.
