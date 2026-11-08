# Tiry's Zentrale – Gold- und Berufe-Addon für WoW Forever

Addon für **World of Warcraft: Forever** (Client 1.60.1, Interface 16001). Zeigt Einsteigern Schritt für Schritt,
wie man schon mit Level 10–20 Gold macht – mit echten Preisen des eigenen Servers über **Auctionator**.

## Installation (Windows)
1. `dist/TirysZentrale.zip` herunterladen und entpacken.
2. Den Ordner `TirysZentrale` nach `World of Warcraft\_forever_\Interface\AddOns\` kopieren
   (danach muss es `...\AddOns\TirysZentrale\TirysZentrale.toc` geben – kein doppelter Ordner).
3. Optional, aber empfohlen: **Auctionator** (Version für WoW Forever) installieren.
4. Spiel starten → `/tz` eingeben oder auf die Goldmünze an der Minikarte klicken.

Anleitung für Einsteiger: **`ANLEITUNG.md`** · Prüfbericht: **`AUDIT.md`** · Änderungen: **`CHANGELOG.md`** · Ingame-Checkliste: **`INGAME-TEST.md`**

## Was drin ist (7 Menüpunkte, darunter Reiter)
| Menüpunkt | Reiter | Funktion |
|---|---|---|
| **Start** | Goldplan, Goldwege | „Dein nächster Schritt“ (genau eine Handlung), Heute für dich, Top 3, „Neu in Forever – deine Chancen“ mit Live-Preisen; 16 Goldwege als Anleitungen |
| **Farmen** | Farm-Guide, Kürschner, Farm-Session | Farm-Spots für dein Level mit Wegpunkt, Kürschner-Zentrale, Farm-Session (Gold pro Stunde live, Bestmarke, Verlauf) |
| **Berufe** | Craft-Planer, Berufe-Berater | Craft-Liste in 3 Schritten mit Einkaufsliste und „Nächstes craften“; Berater: beste Sammelberufe nach Live-Preisen + günstigster Skill-Plan |
| **Markt** | Preise, Preisalarm, Taschen & Händler, Item-Suche | Live-Preise, Wunschpreis-Alarm, Händler-Flips und Taschen-Check, alle 18.416 Items auf Deutsch |
| **Mein Gold** | Goldtagebuch, Verkaufsbuch | Gold pro Tag/Stunde, Verkäufe aus der Post, eigene Verkaufsquote, Gold aller Charaktere |
| **Lernen** | AH-Schule, Glossar | Auktionshaus einfach erklärt, 20 Begriffe |
| **Einstellungen** | – | Schalter, Experten-Modus (Preisformeln), Fenstergröße, alles auf Standard |

Dazu: Einsteiger-Assistent beim ersten Start, globale Suche (Seitenleiste, `/tz suche`), Einkaufsfenster mit Händler-Kauf per Klick, Händler-Panel, Schnäppchen-Radar, Beute-Radar, Item-Tooltip-Infos, Tastenkürzel, Fenster per Ziehgriff skalierbar und andockbar, Kampf-Sperre. Alles rückgängig machbar (×, Rückgängig, Zurückholen).

Design: Anthrazit + Neon-Grün, Hervorhebungen in Orange, dezente Horde-Motive, Schrift Poppins (min. 12).

Befehle: `/tz` (oder `/zentrale`, `/gold`), `/tz suche`, `/tz assistent`, `/tz wegpunkt`, `/tz leeren`, `/tz leder`, `/tz farm`, `/tz craft`, `/tz wege`, `/tz markt`, `/tz scan`, `/tz rezepte`, `/tz tagebuch`, `/tz buch`, `/tz ah`, `/tz minimap`, `/tz reset`.

## Preisformeln (Experten-Modus)
Im Craft-Planer unter „Mehr Optionen“, sobald der Experten-Modus an ist: Materialpreis `first(vendorbuy, ahprice, market)`, Verkaufswert `min(ahprice, 125% market)`, Mindestgewinn `max(15% crafting, levelgold)`. `market` = eigener Marktwert (Median der Tagespreise der letzten 14 Tage). Gängige Kurznamen (`dbmarket`, `dbminbuyout`) werden verstanden; Funktionen `min`, `max`, `first`, `avg`, Rechnen `+ - * /`, Zahlen wie `120% crafting`, `5g`, `1g50s`.

## AH-Scan
Knopf „AH scannen“ oben im Fenster startet am offenen AH den Auctionator-Scan (wenn Auctionator ihn gerade zulässt – sonst ehrliche Meldung). Neue Preise werden automatisch erkannt; „Preise von vor X“ steht unter dem Knopf.

## Technik & Prüfung
- `busted` (im Ordner `wow-addons`) – Tests mit/ohne Auctionator, ohne Scandaten, ohne Berufe, fehlende API, Kampf-Sperre, Rechnungen, Tastenkürzel, Schrift-Glyphen.
- `luacheck TirysZentrale` – statische Prüfung mit WoW-Globals-Liste (`.luacheckrc`).
- `lua5.1 tests/check_layout.lua <ordner>` – öffnet jede Seite, meldet überlappende oder abgeschnittene Texte (exakte Poppins-Maße) und exportiert sie; `python3 tools/render_pages.py <ordner>` zeichnet sie als PNG.
- Alle verwendeten Spiel-Funktionen wurden gegen Blizzards Forever-UI-Quellcode (1.60.1) geprüft.
- `lua5.1 tests/run_tests.lua` – lädt das Addon in einem strengen Nachbau des Forever-Clients
  (nur Widget-Methoden und Ereignisse, die es in Forever gibt) und spielt alle Seiten und Abläufe durch.
- `python3 tools/make_media.py` – erzeugt alle Grafiken; `python3 tools/gen_items.py` – Item-Datenbank aus Wowhead-Forever-Daten.
- `python3 tools/gen_alldb.py <csv-ordner>` – komplette Item-Datenbank aus den Forever-Spieldaten (DB2 ItemSparse/Item/ItemClass/ItemSubClass, Build 1.60.1.70862, über wago.tools). 908 interne Platzhalter ("Monster - …", "Deprecated", "OLD…") werden ausgelassen.
- `python3 tools/gen_recipes.py <csv-ordner>` – Rezept-Datenbank (DB2 SkillLineAbility, SpellReagents, SpellEffect, SpellName).
- `python3 tools/gen_recipe_items.py <csv-ordner>` – Rezept-Items (Muster/Pläne/Formel …) zu jedem Rezept (DB2 ItemXItemEffect, ItemEffect, ItemSparse).
- `python3 tools/gen_spots.py <spawns.tsv> <UiMap.csv> <questiedb>` – Farm-Hotspots aus QuestieDB-Fundorten (Daten werden nur gelesen, nie ausgeführt).
- Lizenz: GPL-3.0 (wegen der QuestieDB-Daten), siehe `TirysZentrale/LIZENZ.txt`.
- Schrift: Poppins (SIL Open Font License, siehe `TirysZentrale/Media/Fonts/OFL.txt`).

## Grenzen (ehrlich)
- Blizzard hat für Forever keine offiziellen Zahlen zu AH-Anteil und Laufzeiten veröffentlicht – der AH-Anteil ist einstellbar (Standard 5 %).
- Ohne Auctionator gibt es nur Händlerpreise; Händler-Flips brauchen Auctionator.
- Getestet im Nachbau, nicht im echten Spielclient – Checkliste in `INGAME-TEST.md`. Bei einem Lua-Fehler bitte die Fehlermeldung schicken.
- Für den Scan-Start gibt es keine öffentliche Auctionator-Funktion; der Knopf nutzt abgesichert Auctionators eigenen Scan-Code (Details: `AUDIT.md`).
