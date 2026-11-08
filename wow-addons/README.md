# Tiry's Zentrale – Gold- und Berufe-Addon für WoW Forever

Addon für **World of Warcraft: Forever** (Client 1.60.1, Interface 16001). Zeigt Einsteigern Schritt für Schritt,
wie man schon mit Level 10–20 Gold macht – mit echten Preisen des eigenen Servers über **Auctionator**.

## Installation (Windows)
1. `dist/TirysZentrale.zip` herunterladen und entpacken.
2. Den Ordner `TirysZentrale` nach `World of Warcraft\_forever_\Interface\AddOns\` kopieren
   (danach muss es `...\AddOns\TirysZentrale\TirysZentrale.toc` geben – kein doppelter Ordner).
3. Optional, aber empfohlen: **Auctionator** (Version für WoW Forever) installieren.
4. Spiel starten → `/tz` eingeben oder auf die Goldmünze an der Minikarte klicken.

## Was drin ist
| Seite | Funktion |
|---|---|
| Start | Persönlicher Goldplan: Top 3 Goldwege für Level, Berufe und aktuelle AH-Preise |
| Kürschner-Zentrale | Häuten-Rechner (bis welches Tierlevel dein Skill reicht), Leder nach Tierlevel mit Live-Preisen, beste Häut-Spots für dein Level (5er-Schritte, mit Tierlevel und Kartenpunkt), Spezial-Leder mit Fundorten, eigene gemerkte Fundorte |
| Farm-Guide | Level 1–60: welche Materialgruppe gerade am meisten bringt (mit deinen Berufen abgeglichen) + 109 berechnete Farm-Hotspots – Klick setzt Wegpunkt mit Pfeil und öffnet die Karte |
| Goldwege | 16 Methoden als aufklappbare Anleitungen (Forever-bestätigt bzw. Classic-Wissen gekennzeichnet) |
| Marktpreise | Live-Preise der wichtigsten Gold-Materialien (126 kuratiert) inkl. neuer Forever-Materialien, Einkaufslisten, AH-Sofortsuche |
| Datenbank | **Alle 18.416 Gegenstände** von WoW Forever auf Deutsch: Suche (Name/ID), Filter nach Kategorie, Qualität, Level, Sortierung nach AH-/Händlerpreis |
| Scanner | Händler-Flips (automatisch beim Händler) und Taschen-Check (AH oder Händler?) |
| Craft-Planer | Wie TSM Crafting: 1.967 Rezepte aus den Forever-Spieldaten, gelernte Rezepte automatisch erkannt (ohne Berufsfenster), zwei Regler (% und Gold): Empfehlung wächst mit jedem Level, eigener Stil wächst mit, teure Items brauchen weniger %, "Lernen lohnt sich", Skill-Farben, herstellbare Menge, Warteschlange, fehlendes Material als Auctionator-Liste, Craften per Knopf |
| Verkaufsbuch | Wie TSM Accounting/Journalator: Verkäufe, Käufe, abgelaufene Auktionen automatisch aus der Post; eigene Verkaufsquote pro Item (Ersatz für TSMs Region-Sale-Rate), Bestseller, Ladenhüter, Gold aller Charaktere |
| Schnäppchen-Radar | Prüft jede AH-Suche (auch Auctionator) gegen deinen Marktwert und meldet Angebote unter 65 % |
| Extras | Item-Tooltip (Rezepte, Farm-Ort, neu in Forever, Bestand aller Chars, Verkaufsquote, Mindest-Verkaufspreis), Post-Bilanz, Warnung vor ablaufender Post, "Heute für dich" auf der Startseite, automatisch reparieren |
| Gold-Autopilot | Schrott automatisch verkaufen, Händler-Panel (Händler-Ware verkaufen, Flips kaufen per Klick), Beute-Radar mit Warnung bei wertvoller Beute, AH-Hinweis |
| Goldtagebuch | Gold pro Sitzung, pro Stunde, 14-Tage-Verlauf |
| AH-Schule | Auktionshaus und Auctionator für Einsteiger |
| Einstellungen | Minikarten-Knopf, Chat-Hinweise, Animationen, AH-Anteil, Fenstergröße |

Befehle: `/tz` (oder `/zentrale`, `/gold`), `/tz leder`, `/tz farm`, `/tz craft`, `/tz suche`, `/tz wege`, `/tz markt`, `/tz scan`, `/tz rezepte`, `/tz tagebuch`, `/tz ah`, `/tz minimap`, `/tz reset`.

## Profi-Strings (wie TSM)
Im Craft-Planer: Materialpreis `first(vendorbuy, ahprice, market)`, Verkaufswert `min(ahprice, 125% market)`, Mindestgewinn `max(15% crafting, levelgold)`. `market` = eigener Marktwert (Median der Tagespreise der letzten 14 Tage aus deinen Scans). TSM-Namen (`dbmarket`, `dbminbuyout`) werden verstanden; Funktionen `min`, `max`, `first`, `avg`, Rechnen `+ - * /`, Zahlen wie `120% crafting`, `5g`, `1g50s`. Zusätzlich: nur frische Preise (max. 3 Tage).

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
