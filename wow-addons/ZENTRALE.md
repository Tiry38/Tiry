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

**Hauptthema: Gold durch Herstellen.** Die Startseite führt durch den Gold-Kreislauf: Planen → Einkaufen → Herstellen → Verkaufen.

## Was drin ist (5 Hauptpunkte im Dock + Lernen und Einstellungen oben rechts)
| Menüpunkt | Reiter | Funktion |
|---|---|---|
| **Start** | Goldplan, Goldwege | Gold-Kreislauf (Planen/Einkaufen/Herstellen/Verkaufen, je ein Knopf), Gold-abholen-Hinweis, „Neu in Forever – deine Chancen“; 19 Goldwege als Anleitungen |
| **Herstellen** | Craft-Planer, Was lernen?, Ergebnis | Craft-Liste in 4 Schritten, sortiert nach **Gold pro Tag** (Gewinn × realistischer Absatz); Verkaufen mit „Nicht unter“; Berater für lohnende Rezepte und Skill-Plan; echter Gewinn aus Verkäufen |
| **Farmen** | Farm-Guide, Kürschner, Farm-Session | Farm-Spots für dein Level mit Wegpunkt, Kürschner-Zentrale, Farm-Session (Gold pro Stunde live, Bestmarke, Verlauf) |
| **Handel** | Meine Auktionen, Preise, Preisalarm, Taschen & Händler, Item-Suche | Eigene Auktionen (unterboten?, unterwegs, Briefkasten, **Neu einstellen mit Menge und Preis**), Live-Preise mit **Verkäufe pro Tag** und **Schnäppchen**, Wunschpreis-Alarm, Händler-Flips, Taschen-Check mit Trend und Rohstoff-Check, alle 18.416 Items auf Deutsch |
| **Mein Gold** | Goldtagebuch, Verkaufsbuch | Gold pro Tag/Stunde, Verkäufe aus der Post, eigene Verkaufsquote, Bestseller, Ladenhüter, Gold aller Charaktere |
| **?** (Lernen) | AH-Schule, Glossar | Auktionshaus einfach erklärt, 20 Begriffe |
| **Zahnrad** | Einstellungen | Schalter in Gruppen (Automatik, Hinweise & Radar, Gold-Rechnung, Ansicht), Experten-Modus, Fenstergröße, alles auf Standard |

Dazu: Einsteiger-Assistent beim ersten Start, globale Suche (Lupe, `/tz suche`), Einkaufsfenster mit „Kaufen bis“ und Händler-Kauf per Klick, Händler-Panel, Schnäppchen-Radar, Beute-Radar, Item-Tooltip (Verwendung, Absatz, „Nicht unter“), Tastenkürzel, Fenster per Ziehgriff skalierbar und andockbar, Kampf-Sperre. Alles rückgängig machbar (×, Rückgängig, Zurückholen).

Design 6.0 „Neon-Glas“: Anthrazit-Glas mit Neon-Grün/Türkis-Verläufen, Dock-Navigation mit runden Leuchtknöpfen, Reiter als Pillen, Kennzahlen als Glas-Pillen mit Leuchtpunkt, Horde-Motive dezent im Hintergrund, Schrift Poppins (min. 12). Vorschau: `previews/Zentrale_Design_6.0.png`.

Befehle: `/tz` (oder `/zentrale`, `/gold`), `/tz suche`, `/tz assistent`, `/tz wegpunkt`, `/tz leeren`, `/tz leder`, `/tz farm`, `/tz craft`, `/tz wege`, `/tz markt`, `/tz handel`, `/tz schnapp`, `/tz scan`, `/tz rezepte`, `/tz tagebuch`, `/tz buch`, `/tz ah`, `/tz minimap`, `/tz reset`.

## Goldmacher-Werkzeuge (6.0)
- **Verkäufe pro Tag (Absatz):** Jeder Komplett-Scan liest die Angebotsliste mit. Was zwischen zwei Scans vor Ablauf verschwindet, gilt als gekauft (Umstellen desselben Verkäufers zählt nicht). Klassen: Schnelldreher / verkauft sich / Ladenhüter. Start: zwei Scans im Abstand von 15 Min. bis 12 Std.
- **Gold pro Tag:** Craft-Empfehlungen = Gewinn je Stück × dein realistischer Anteil an den Tagesverkäufen. Kleinvieh mit hohem Absatz schlägt teure Ladenhüter.
- **Markt-Tiefe:** Angebot ÷ Absatz = Tage Vorrat; über 14 Tage = „Markt voll“.
- **Schnäppchen-Scan:** jedes Angebot des Komplett-Scans; „unter Händlerpreis“ (sicherer Gewinn) oder ≤ 65 % des 14-Tage-Marktwerts (kein Ladenhüter, nach Gebühr und Anzahlungs-Risiko). Kaufen bleibt Spieler-Klick.
- **Preis-Trend, beste Verkaufszeit, Rohstoff-Check** (verarbeiten oder roh verkaufen) im Taschen-Check und Tooltip.
- **„Kaufen bis“** je Material in der Einkaufsliste (auch über selbst hergestellte Zwischenprodukte).
- **Neu einstellen mit Maß:** Menge = Verkäufe von ca. 3 Tagen; Preis = günstigstes Angebot minus 1 Kupfer, **Einzel-Items in ganzen Silbern** (Blizzard 09.11.: „Kupfer weglassen hilft“ gegen den „Internen Auktionsfehler“); nie unter „Nicht unter“.
- **„Nicht unter“** = max(Materialkosten, Händlerpreis) pro Stück plus Anzahlungs-Risiko, geteilt durch (1 − AH-Anteil).
- **Anzahlung:** mindestens 1 Silber je Angebot (Forever, seit Anfang 11/2026), bei Verkauf zurück, bei Ablauf weg. Bei offenem AH nimmt das Addon Blizzards exakten Betrag (`C_AuctionHouse.CalculateCommodityDeposit` / `CalculateItemDeposit`).

## Preisformeln (Experten-Modus)
Im Craft-Planer unter „Mehr Optionen“, sobald der Experten-Modus an ist: Materialpreis `first(vendorbuy, ahprice, market)`, Verkaufswert `min(ahprice, 125% market)`, Mindestgewinn `max(15% crafting, levelgold)`. `market` = eigener Marktwert (Median der Tagespreise der letzten 14 Tage). Gängige Kurznamen (`dbmarket`, `dbminbuyout`) werden verstanden; Funktionen `min`, `max`, `first`, `avg`, Rechnen `+ - * /`, Zahlen wie `120% crafting`, `5g`, `1g50s`.

## AH-Scan
**Ein Scan für alle Reiter.** Knopf „AH scannen“ oben rechts (oder automatisch beim Öffnen des AH) startet am offenen AH bevorzugt den **Komplett-Scan** (Blizzard: alle 15 Min.). In einem Durchgang kommen Preise, Absatz, Markt-Tiefe, Schnäppchen und der Unterboten-Check deiner Stapelware. Ist der Komplett-Scan gesperrt, aktualisiert der Schnell-Scan von Auctionator trotzdem alle Preise. Die Knöpfe in den Reitern heißen „Angebote zeigen“ – sie sind nur zum Kaufen da.
Schutz: Kommt ein Komplett-Scan nur teilweise an (unter 40 % des letzten), zählt das Fehlende nicht als verkauft. Abschaltbar: Einstellungen → „Komplett-Scan“. „Preise von vor X · gilt für alle Reiter“ steht unter dem Knopf.

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
- Absatz-Messung ist eine Schätzung aus Angebots-Differenzen: Abbrüche anderer Spieler zählen mit, solange sie vor Ablauf passieren. Mehr Scans = genauer.
- Die 5-%-Gebühr ist für Forever nicht offiziell bestätigt (einstellbar).
