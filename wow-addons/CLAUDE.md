# WoW-Forever-Add-ons – Projektleitfaden für Claude

Eigene World-of-Warcraft-Add-ons für Tiry. Gespielt wird **WoW Forever** (Blizzard-Client, Interface **16001**,
moderne Retail-API mit Classic-Inhalten). Charaktere: Horde, u. a. Verstärker-Schamane und Hexenmeister.
Aktueller Stand und offene Punkte: **[`UEBERGABE.md`](UEBERGABE.md)** – zuerst lesen.

## Kommunikation mit Tiry
- Immer **„Tiry“**, Deutsch, direkt, ehrlich, keine Floskeln/Entschuldigungen, kurze Absätze, **Fettdruck für Kernbotschaften**.
- 100 % faktenkorrekt; Unsicheres als unsicher benennen (vieles kann nur im Spiel getestet werden – das klar sagen).
- Er will **Mühe und Gründlichkeit** sehen („zu schnell fertig = keine Mühe“), aber trotzdem zügig liefern.
- Design-Anspruch: extrem modern, glatte Flächen, starke Farbverläufe, abgerundet, **nichts nach Baukasten/Windows 98**,
  echte Blizzard-Symbole (Atlas) statt selbstgemalter. Farbwelt: Anthrazit + Neon-Grün (#39FF6B) / Türkis.
- Am Ende jeder Antwort: kurze Empfehlung `/compact <Fokus>` bzw. `/clear`.

## Ordner
- `addons/<Name>/` – fertige Add-on-Ordner (so wie sie in `Interface\AddOns\` liegen). Je Add-on vier TOCs:
  `<Name>.toc`, `_Forever.toc`, `_Camelot.toc`, `_Mainline.toc` (Forever lädt die passende).
- `tools/` – Python-Werkzeuge (Routen, Grafiken, Sounds). Immer mit `python3 -I` starten.
- `tests/` – Lua-5.1-Simulationen der WoW-API (`lua5.1`). Aufruf aus dem Add-on-Ordner, z. B.
  `cd addons/LevelPilot && lua5.1 ../../tests/v4.lua` (muss „ALLE TESTS OK“ melden), außerdem `lp.lua`, `lp2.lua`,
  `nav.lua`, `fly.lua` (Exit-Code 0 = ok). Vor jeder Auslieferung alle laufen lassen + `luac5.1 -p` auf alle .lua.
- `weakauras/` – WeakAura-Importtexte und Generatoren.
- `previews/` – Vorschaubilder und Sound-Vorhördateien.
- `qdb/` – **nicht im Repo** (.gitignore): `git clone https://github.com/Questie/QuestieDB.git qdb/QuestieDB`
  (Questies Datenbank; Forever-Daten in `data/Forever/`). Wird nur für die Routen-Werkzeuge gebraucht.

## Ausliefern
Add-on-Ordner zippen (`cd addons && zip -qr ../LevelPilot.zip LevelPilot`), ZIP an Tiry schicken.
Einbau bei ihm: alten Ordner in `Interface\AddOns` löschen, entpacken, **WoW komplett neu starten** (bei neuen
Dateien/Sounds reicht `/reload` nicht). Version in allen 4 TOCs und in `VERSION` der Haupt-Lua hochzählen.

## Harte Grenzen von WoW Forever (geprüft)
- **Im Kampf** sind Aura-Daten „secret“: `C_UnitAuras.*` wirft Fehler, `UNIT_AURA`-Daten sind gesperrt.
  Lösungen: Blizzards Cooldown-Manager, Ersatz-Signale (Zauberzeit, Leuchten, Overlay), außerhalb des Kampfes Auren.
- WeakAuras-Forever führt **keinen eigenen Custom-Code** aus → für Logik ein eigenes Add-on bauen.
- Add-ons zeichnen **nur flach über die 3D-Welt** – keine Verdeckung durch Gegenstände möglich.
- Kein Bot / keine Automatisierung des Spielens (abgelehnt, bleibt so). Keine 1:1-Kopien fremder Add-ons.

## Routen-Werkzeugkette (LevelPilot)
1. `fulldb.py` → `full.json` (Quests/NPCs/Objekte/Items aus QuestieDB-Forever), `nav.py` → `nav.json` (NPC-Laufwege).
2. `make_route.py` → Abschnitte (Zone, Stufe, Quest-Liste), Qualitätsfilter `qual.py` (Ertrag/Zeit, streicht
   langsame Quests, markiert Begleit-/Elite-Quests als „slow“), Generator `gen_route.py` (gierig nach Nähe +
   Or-Opt-Wegoptimierung) → `gen_steps.json`, `auto_slow.json`.
3. `build.py` → prüft jeden Schritt gegen die Forever-DB (muss „0 Probleme“ melden), schreibt `Horde_22_30.lua`
   → nach `addons/LevelPilot/Routes/` kopieren.
Quellen der Questauswahl: Konsens freier Speedrun-Routen (Joana, Warcraft Tavern, Guidelime Ettern/Freezy3/
Sevenleaves/Milksmuggler, WoW-Pro); Quests, die mindestens 3 von 5 Quellen abgeben.
