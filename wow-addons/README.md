# Goldrausch – Gold-Guide-Addon für WoW Forever

Addon für **World of Warcraft: Forever** (Client 1.60.1, Interface 16001). Zeigt Einsteigern Schritt für Schritt,
wie man schon mit Level 10–20 Gold macht – mit echten Preisen des eigenen Servers über **Auctionator**.

## Installation (Windows)
1. `dist/Goldrausch.zip` herunterladen und entpacken.
2. Den Ordner `Goldrausch` nach `World of Warcraft\_forever_\Interface\AddOns\` kopieren
   (danach muss es `...\AddOns\Goldrausch\Goldrausch.toc` geben – kein doppelter Ordner).
3. Optional, aber empfohlen: **Auctionator** (Version für WoW Forever) installieren.
4. Spiel starten → `/gold` eingeben oder auf die Goldmünze an der Minikarte klicken.

## Was drin ist
| Seite | Funktion |
|---|---|
| Start | Persönlicher Goldplan: Top 3 Goldwege für Level, Berufe und aktuelle AH-Preise |
| Goldwege | 16 Methoden als aufklappbare Anleitungen (Forever-bestätigt bzw. Classic-Wissen gekennzeichnet) |
| Marktpreise | Live-Preise der wichtigsten Gold-Materialien (126 kuratiert) inkl. neuer Forever-Materialien, Einkaufslisten, AH-Sofortsuche |
| Datenbank | **Alle 18.416 Gegenstände** von WoW Forever auf Deutsch: Suche (Name/ID), Filter nach Kategorie, Qualität, Level, Sortierung nach AH-/Händlerpreis |
| Scanner | Händler-Flips (automatisch beim Händler) und Taschen-Check (AH oder Händler?) |
| Rezepte | Gewinn jedes gelernten Rezepts mit aktuellen Preisen |
| Goldtagebuch | Gold pro Sitzung, pro Stunde, 14-Tage-Verlauf |
| AH-Schule | Auktionshaus und Auctionator für Einsteiger |
| Einstellungen | Minikarten-Knopf, Chat-Hinweise, Animationen, AH-Anteil, Fenstergröße |

Befehle: `/gold`, `/gold suche`, `/gold wege`, `/gold markt`, `/gold scan`, `/gold rezepte`, `/gold tagebuch`, `/gold ah`, `/gold minimap`, `/gold reset`.

## Technik & Prüfung
- Alle verwendeten Spiel-Funktionen wurden gegen Blizzards Forever-UI-Quellcode (1.60.1) geprüft.
- `lua5.1 tests/run_tests.lua` – lädt das Addon in einem strengen Nachbau des Forever-Clients
  (nur Widget-Methoden und Ereignisse, die es in Forever gibt) und spielt alle Seiten und Abläufe durch.
- `python3 tools/make_media.py` – erzeugt alle Grafiken; `python3 tools/gen_items.py` – Item-Datenbank aus Wowhead-Forever-Daten.
- `python3 tools/gen_alldb.py <csv-ordner>` – komplette Item-Datenbank aus den Forever-Spieldaten (DB2 ItemSparse/Item/ItemClass/ItemSubClass, Build 1.60.1.70862, über wago.tools). 908 interne Platzhalter ("Monster - …", "Deprecated", "OLD…") werden ausgelassen.
- Schrift: Poppins (SIL Open Font License, siehe `Goldrausch/Media/Fonts/OFL.txt`).

## Grenzen (ehrlich)
- Blizzard hat für Forever keine offiziellen Zahlen zu AH-Anteil und Laufzeiten veröffentlicht – der AH-Anteil ist einstellbar (Standard 5 %).
- Ohne Auctionator gibt es nur Händlerpreise; Händler-Flips brauchen Auctionator.
- Getestet im Nachbau, nicht im echten Spielclient. Bei einem Lua-Fehler bitte die Fehlermeldung schicken.
