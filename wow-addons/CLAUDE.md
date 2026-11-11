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
  `nav.lua`, `fly.lua`, `route.lua`, `travel.lua` (Wegenetz, Flug-Rat, Rechenzeit; meldet „TRAVEL TESTS OK“),
  `plan.lua` (fester Plan, Einstieg, Sprung, Questlog-Check; „PLAN TESTS OK“), `playthrough.lua` (beide Routen
  komplett durchgespielt, Einstieg + Questlog-Check nach jedem Schritt, hinter Plan, Hexer; „PLAYTHROUGH OK“),
  `travel2.lua` (Klippen, Teilnetze, Aufzüge, Flug nur verbunden; „TRAVEL2 OK“), `fuzz.lua` (Zufalls-Stresstest;
  „FUZZ OK“), `regress.lua` (Fälle aus Prüfrunde 2 auf echten Routen/Netz, je Fall ein Skript in `tests/regress/`;
  „REGRESS OK“) (Exit-Code 0 = ok).
  Fenster-Vorschau LevelPilot: `lua5.1 tests/lp_layout.lua <ordner>` (aus `wow-addons/`, strenger Forever-Nachbau,
  meldet „LP LAYOUT OK“) → `python3 -I tools/render_pages.py <ordner>` → PNGs ansehen. Nach UI-Änderungen Pflicht. ProcAlarm/Schlaghagel: `cd addons && lua5.1 ../tests/proc.lua` bzw. `PROC_CLASS=SHAMAN|WARLOCK lua5.1 ../tests/hagel.lua`.
  Spell-Daten der Live-Version: github.com/simulationcraft/simc-forever (`SpellDataDump/allspells.txt`). Vor jeder Auslieferung alle laufen lassen + `luac5.1 -p` auf alle .lua.
- `weakauras/` – WeakAura-Importtexte und Generatoren.
- `previews/` – Vorschaubilder und Sound-Vorhördateien.
- `qdb/` – **nicht im Repo** (.gitignore): `git clone https://github.com/Questie/QuestieDB.git qdb/QuestieDB`
  (Questies Datenbank; Forever-Daten in `data/Forever/`) und
  `git clone https://github.com/JagTheHero/guidelime-pathfinder.git qdb/guidelime-pathfinder` (Navmesh-Wegdaten).
  Wird nur für die Routen-Werkzeuge gebraucht. Beide GPL-3.0 → LevelPilot und Tiry's Zentrale tragen `LIZENZ.txt` +
  `LICENSE-GPL-3.0.md` (Repo ist öffentlich; neue Datenquellen dort eintragen).

## Claude-Skills (Plugin „wow-werkstatt“)
`.claude/skills/` im Repo-Hauptordner: **`wow-tests`** (alle Tests: `bash wow-addons/tools/test_all.sh [ziel]`),
**`wow-release`** (Version + ZIP: `python3 -I wow-addons/tools/release.py <Add-on> <Version>`, nur auf Wunsch),
**`wow-forever`** (geprüftes Forever-/AH-Wissen), **`wow-neues-addon`** (Gerüst nach Standard).
Plugin-Manifest `.claude/.claude-plugin/plugin.json`, Marketplace `.claude-plugin/marketplace.json` („tiry“).
Prüfen: `claude plugin validate .claude` und `claude plugin validate .`.

## Ausliefern
Version + ZIP mit `python3 -I tools/release.py <Add-on> <Version>` (alle TOCs, `VERSION`, ZIP nach `dist/`), ZIP an Tiry schicken.
Einbau bei ihm: alten Ordner in `Interface\AddOns` löschen, entpacken, **WoW komplett neu starten** (bei neuen
Dateien/Sounds reicht `/reload` nicht). Version in allen 4 TOCs und in `VERSION` der Haupt-Lua hochzählen.

## Harte Grenzen von WoW Forever (geprüft)
- **Im Kampf** sind Aura-Daten „secret“: `C_UnitAuras.*` wirft Fehler, `UNIT_AURA`-Daten sind gesperrt.
  Ersatz-Signale (Zauberzeit, Leuchten, Kampftext) haben bei ProcAlarm 1.x im Kampf nicht ausgelöst (Tiry, 09.11.).
- **Funktioniert im Kampf (Blizzards offizieller Weg, Forever-Client-Code `Blizzard_AuraContainer`):**
  `CreateFrame("AuraContainer", nil, parent, "CustomAuraContainerTemplate")` + `AddAuraSlot(key, "HELPFUL",
  {candidateFilters = {includeSpellIDs = {[id] = true}}, initializeFrame = fn})` – das Spiel zeigt den Slot nur bei
  aktivem Buff; im `initializeFrame` eigene Optik als Kinder bauen und per `SetIcon`, `SetDurationCooldown`,
  `SetDurationText`, `SetApplicationCount`, `AddAuraShownAnimation` übergeben. Nur außerhalb des Kampfes aufbauen.
  Ton: `C_UnitAuras.AddAuraSound(Enum.UnitAuraSoundTrigger.Added, {unitToken, spellID, soundFileName, …})`.
  Blizzards Forever-UI-Code zum Nachlesen: github.com/reckhou/WoWBlzCode (Ordner `Forever/`).
- WeakAuras-Forever führt **keinen eigenen Custom-Code** aus → für Logik ein eigenes Add-on bauen.
- **Reittier erst ab Stufe 40** (Forever) – Routen bis 40 sind Fußwege; ausgeruhte XP verdoppeln Mob-XP.
- Add-ons zeichnen **nur flach über die 3D-Welt** – keine Verdeckung durch Gegenstände möglich.
- Kein Bot / keine Automatisierung des Spielens (abgelehnt, bleibt so). Keine 1:1-Kopien fremder Add-ons.

## Routen-Werkzeugkette (LevelPilot)
1. `fulldb.py` → `full.json` (Quests/NPCs/Objekte/Items aus QuestieDB-Forever), `nav.py` → `nav.json`,
   `qdb.py` → `forever.json` (für `verify.py`/`build.py`). Alle drei .gitignored, bei Bedarf neu erzeugen.
   `navmesh.py` (braucht `pip install numpy scipy`, ~25 s) → `addons/LevelPilot/Walk.lua` (Wegenetz + Flugnetz fürs
   Add-on) und `navmesh.json` (.gitignored, für den Planer); druckt einen Prüfbericht Grobnetz gegen exakten Navmesh-Weg.
   `zones.py` = Forever-Kartengrenzen je uiMap (Karte ↔ Welt-Yards), `tests/zones_mock.lua` ist daraus erzeugt.
2. `xpmodel.py` – XP-/Zeitmodell: Quest-XP aus `QuestieDB/support/Forever/QuestXP`, Dropchancen aus
   `support/Forever/DropTables`, Mob-XP-Formel Classic, Laufen 7 Yards/s (Reittier erst ab 40). Wege = echter
   Bodenweg aus `navmesh.json` (sonst Luftlinie × Faktor), Flug über bekannte Flugpunkte, wenn schneller.
3. `plan.py` – Planer: Abschnitte (Gebiet, Hub, kuratierte Quests + Auto-Pool), Stufen-Simulation (Quest ≤ Stufe+2),
   gierig nach Nähe + Or-Opt, Grenzkosten-Filter gegen Grind-Tempo, Grind-/Kontroll-Schritte.
4. `make_route.py [key]` – Routen in `ROUTES` (`horde_22_30`, `horde_30_40`), Einstiegsstufen per `tune()` →
   `gen_steps_<key>.json`. Dann `build.py [key]` → prüft gegen Forever-DB, schreibt `addons/LevelPilot/Routes/`.
   Neue Routendatei in alle 4 TOCs eintragen. `tests/route.lua` prüft Routenwahl + Dateien.
Quellen der Gebietsreihenfolge: Konsens freier Speedrun-Routen (Joana, Warcraft Tavern, Guidelime, WoW-Pro, Bustea),
danach per Modell verglichen; Gebiete mit nur 1–3 Quests werden gestrichen.
Die Reihenfolge **innerhalb** der Gebiete und die Wege berechnet der Planer – nicht von Speedrunnern übernommen;
Tiry gegenüber genau so benennen. Live gilt seit 5.0 ein **fester Plan** (`Route.lua`, `R.Plan`): gespeicherter Zeiger
je Route (`DB.plan`), nur vorwärts; Einstieg (`R.Entry`) aus angenommenen Quests am Ort, Sprung nur mit Beweis (umkehrbar
`/lp zurueck`), Questlog-Check `R.LogAdvice`. Keine Umsortierung nach Entfernung – Tiry will eine nachvollziehbare
Reihenfolge. Laufweg (Walk.lua) und Flugnetz (`Fly.lua`) liefern Entfernungen, Pfeil und Flug-Rat.
