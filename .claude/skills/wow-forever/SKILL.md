---
name: wow-forever
description: Geprüftes Wissen über WoW Forever (Interface 16001) für Add-on-Code – harte API-Grenzen (Kampf-Auren, Aura-Slots), Auktionshaus-API (Komplett-Scan, Einstellgebühr), Auctionator-Anbindung, Testumgebung und Tirys Design-Regeln. Laden, bevor Code in wow-addons/ geschrieben oder bewertet wird.
---

# WoW Forever – Wissen für Add-on-Code

> **Branch:** Die Add-ons liegen (bis Tiry sie nach `main` holt) im Branch `claude/wow-addons`. Fehlt der Ordner
> `wow-addons/TirysZentrale` im Arbeitsordner: `git fetch origin claude/wow-addons` und auf diesem Branch arbeiten.

Projektleitfaden: `wow-addons/CLAUDE.md`, Stand und offene Punkte: `wow-addons/UEBERGABE.md` (zuerst lesen).
Unsicheres immer als unsicher benennen – vieles ist nur im Spiel prüfbar.

## Client
- Blizzard-Client **WoW Forever**, `## Interface: 16001`, moderne Retail-API mit Classic-Inhalten.
- Jedes Add-on unter `wow-addons/addons/<Name>/` hat **vier TOCs** (`<Name>.toc`, `_Forever`, `_Camelot`,
  `_Mainline`), alle mit Interface 16001 und gleicher `## Version:`. Ausnahme: `wow-addons/TirysZentrale/` (eine TOC).
- Blizzards Forever-UI-Code zum Nachlesen: github.com/reckhou/WoWBlzCode (Ordner `Forever/`).
  Spell-Daten: github.com/simulationcraft/simc-forever (`SpellDataDump/allspells.txt`).

## Harte Grenzen (geprüft)
- **Im Kampf sind Aura-Daten „secret“:** `C_UnitAuras.*` wirft Fehler, `UNIT_AURA`-Daten gesperrt. Ersatz-Signale
  (Zauberzeit, Leuchten, Kampftext) lösten im Kampf nicht aus.
- **Funktioniert im Kampf:** `CreateFrame("AuraContainer", nil, parent, "CustomAuraContainerTemplate")` +
  `AddAuraSlot(key, "HELPFUL", {candidateFilters = {includeSpellIDs = {[id] = true}}, initializeFrame = fn})`.
  Optik als Kinder im `initializeFrame`, Daten per `SetIcon`, `SetDurationCooldown`, `SetDurationText`,
  `SetApplicationCount`, `AddAuraShownAnimation`. Nur außerhalb des Kampfes aufbauen.
  Ton: `C_UnitAuras.AddAuraSound(Enum.UnitAuraSoundTrigger.Added, {unitToken, spellID, soundFileName, …})`.
- WeakAuras-Forever führt keinen eigenen Code aus → Logik als eigenes Add-on.
- Reittier erst ab Stufe 40; Add-ons zeichnen nur flach über die 3D-Welt.
- **Kein Bot, keine Automatisierung des Spielens.** Kaufen/Einstellen im AH bleibt immer ein Klick des Spielers.
  Keine 1:1-Kopien fremder Add-ons.

## Auktionshaus (Forever)
- Moderne API: `C_AuctionHouse` (Stapelware = Commodities, Stückpreis; Einzel-Items = Preis der ganzen Auktion).
- **Komplett-Scan:** `C_AuctionHouse.ReplicateItems()` → Ereignis `REPLICATE_ITEM_LIST_UPDATE` →
  `GetNumReplicateItems()`, `GetReplicateItemInfo(i)` (Index **ab 0**): Rückgabe 3 = Anzahl, 10 = Sofortkauf
  gesamt, 14 = Verkäufer, 17 = itemID, 18 = hasAllInfo. `GetReplicateItemTimeLeft(i)` = Band 0–3,
  Dauer per `GetTimeLeftBandInfo(band)` (Ersatz-Minima {0, 1800, 7200, 43200} s). Nur alle 15 Min. erlaubt.
- **Einstellgebühr:** mind. 1 Silber je Angebot (live seit Anfang 11/2026), bei Verkauf zurück, bei Ablauf weg.
  Exakt: `C_AuctionHouse.CalculateCommodityDeposit(itemID, duration, qty)` /
  `CalculateItemDeposit(ItemLocation, duration, qty)`; Dauer aus CVar `auctionHouseDurationDropdown` (1–3).
  Formel 5/20/60 % vom Händlerpreis ist **unbestätigt**. AH-Gebühr 5 %.
- Bekannter Fehler: „Interner Auktionsfehler“ beim Einstellen unter dem günstigsten Angebot.
- **Auctionator:** Preise über `Auctionator.API.v1` (`GetAuctionPriceByItemID`, `GetAuctionAgeByItemID`,
  `MultiSearchExact`, `CreateShoppingList`, `RegisterForDBUpdate`). Kein öffentlicher Scan-Start; die Zentrale
  nutzt abgesichert `Auctionator.State.FullScanFrameRef:InitiateScan()` (Replicate, 15-Min.-Sperre `CanInitiate`).

## Tests
- Strenger Nachbau `wow-addons/tests/wow_mock.lua`: Widget-Methoden nur, wenn sie in Blizzards Forever-API
  stehen (`tests/forever_widget_api.lua`), Ereignisse nur aus `tests/forever_events.lua`.
- Alles prüfen mit dem Skill `wow-tests` (`bash wow-addons/tools/test_all.sh`); `luac5.1 -p` auf alle .lua.
- Neue Logik in der Zentrale immer mit Spec in `wow-addons/spec/zentrale_spec.lua` (`E.load(opts)` aus
  `spec/addon_env.lua`: itemInfo, prices, bags, known; `W.now` = Mock-Zeit, `W.flush()` = Timer).

## Design (Tirys Anspruch)
- Extrem modern, glatte Flächen, starke Farbverläufe, abgerundet, Glas + Neon-Glow; **nichts nach Baukasten /
  Windows 98**, keine kleinen gestapelten Knöpfe. Farbwelt Anthrazit + Neon-Grün `#39FF6B` / Türkis.
- Echte Blizzard-Symbole (Atlas) statt selbstgemalter. Text kurz, Deutsch, Tipp-/Klickflächen groß.

## Kommunikation
„Tiry“, Deutsch, direkt, ohne Floskeln, kurze Absätze, **Fettdruck für Kernaussagen**, am Ende
`/compact <Fokus>`-Empfehlung. Nie nach `main` mergen ohne Tirys ausdrücklichen Auftrag.
