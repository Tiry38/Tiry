# Tiry's Zentrale – Gold-Guide-Addon für WoW Forever

Addon für **World of Warcraft: Forever** (Client 1.60.1, Interface 16001). Zeigt Einsteigern Schritt für Schritt,
wie man schon mit Level 10–20 Gold macht – mit echten Preisen des eigenen Servers über **Auctionator**.

## Installation (Windows)
1. `dist/Tiry's Zentrale.zip` herunterladen und entpacken.
2. Den Ordner `Tiry's Zentrale` nach `World of Warcraft\_forever_\Interface\AddOns\` kopieren
   (danach muss es `...\AddOns\Tiry's Zentrale\TirysZentrale.toc` geben – kein doppelter Ordner).
3. Optional, aber empfohlen: **Auctionator** (Version für WoW Forever) installieren.
4. Spiel starten → `/gold` eingeben oder auf die Goldmünze an der Minikarte klicken.

## Was drin ist
| Seite | Funktion |
|---|---|
| Start | Persönlicher Goldplan: Top 3 Goldwege für Level, Berufe und aktuelle AH-Preise |
| Farm-Guide | Level 1–60: welche Materialgruppe gerade am meisten bringt (mit deinen Berufen abgeglichen) + 109 berechnete Farm-Hotspots – Klick setzt Wegpunkt mit Pfeil und öffnet die Karte |
| Goldwege | 16 Methoden als aufklappbare Anleitungen (Forever-bestätigt bzw. Classic-Wissen gekennzeichnet) |
| Marktpreise | Live-Preise der wichtigsten Gold-Materialien (126 kuratiert) inkl. neuer Forever-Materialien, Einkaufslisten, AH-Sofortsuche |
| Datenbank | **Alle 18.416 Gegenstände** von WoW Forever auf Deutsch: Suche (Name/ID), Filter nach Kategorie, Qualität, Level, Sortierung nach AH-/Händlerpreis |
| Scanner | Händler-Flips (automatisch beim Händler) und Taschen-Check (AH oder Händler?) |
| Craft-Planer | Wie TSM Crafting: 1.967 Rezepte aus den Forever-Spieldaten, gelernte Rezepte automatisch erkannt (ohne Berufsfenster), zwei Regler (% und Gold) mit Level-Empfehlung, "Lernen lohnt sich", Skill-Farben, herstellbare Menge, Warteschlange, fehlendes Material als Auctionator-Liste, Craften per Knopf |
| Gold-Autopilot | Schrott automatisch verkaufen, Händler-Panel (Händler-Ware verkaufen, Flips kaufen per Klick), Beute-Radar mit Warnung bei wertvoller Beute, AH-Hinweis |
| Goldtagebuch | Gold pro Sitzung, pro Stunde, 14-Tage-Verlauf |
| AH-Schule | Auktionshaus und Auctionator für Einsteiger |
| Einstellungen | Minikarten-Knopf, Chat-Hinweise, Animationen, AH-Anteil, Fenstergröße |

Befehle: `/gold`, `/gold farm`, `/gold craft`, `/gold suche`, `/gold wege`, `/gold markt`, `/gold scan`, `/gold rezepte`, `/gold tagebuch`, `/gold ah`, `/gold minimap`, `/gold reset`.

## AH-Scan
Knopf "AH scannen" oben im Fenster startet am offenen AH den Auctionator-Scan. Jeder Scan (auch direkt in Auctionator) wird automatisch erkannt; der Stand steht unter dem Knopf.

## Technik & Prüfung
- Alle verwendeten Spiel-Funktionen wurden gegen Blizzards Forever-UI-Quellcode (1.60.1) geprüft.
- `lua5.1 tests/run_tests.lua` – lädt das Addon in einem strengen Nachbau des Forever-Clients
  (nur Widget-Methoden und Ereignisse, die es in Forever gibt) und spielt alle Seiten und Abläufe durch.
- `python3 tools/make_media.py` – erzeugt alle Grafiken; `python3 tools/gen_items.py` – Item-Datenbank aus Wowhead-Forever-Daten.
- `python3 tools/gen_alldb.py <csv-ordner>` – komplette Item-Datenbank aus den Forever-Spieldaten (DB2 ItemSparse/Item/ItemClass/ItemSubClass, Build 1.60.1.70862, über wago.tools). 908 interne Platzhalter ("Monster - …", "Deprecated", "OLD…") werden ausgelassen.
- `python3 tools/gen_recipes.py <csv-ordner>` – Rezept-Datenbank (DB2 SkillLineAbility, SpellReagents, SpellEffect, SpellName).
- `python3 tools/gen_spots.py <spawns.tsv> <UiMap.csv> <questiedb>` – Farm-Hotspots aus QuestieDB-Fundorten (Daten werden nur gelesen, nie ausgeführt).
- Lizenz: GPL-3.0 (wegen der QuestieDB-Daten), siehe `TirysZentrale/LIZENZ.txt`.
- Schrift: Poppins (SIL Open Font License, siehe `TirysZentrale/Media/Fonts/OFL.txt`).

## Grenzen (ehrlich)
- Blizzard hat für Forever keine offiziellen Zahlen zu AH-Anteil und Laufzeiten veröffentlicht – der AH-Anteil ist einstellbar (Standard 5 %).
- Ohne Auctionator gibt es nur Händlerpreise; Händler-Flips brauchen Auctionator.
- Getestet im Nachbau, nicht im echten Spielclient. Bei einem Lua-Fehler bitte die Fehlermeldung schicken.
