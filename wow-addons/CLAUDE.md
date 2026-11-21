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
- **`LevelPilot.lua` steht an der Lua-5.1-Grenze von 200 Locals im Hauptteil** – neuen Zustand in vorhandene Tabellen
  (z. B. `RT.area`) oder in `do … end`-Blöcke legen, sonst bricht `luac` mit „more than 200 local variables“ ab.
- `weakauras/` – WeakAura-Importtexte und Generatoren.
- `previews/` – Vorschaubilder und Sound-Vorhördateien.
- `qdb/` – **nicht im Repo** (.gitignore): `git clone https://github.com/Questie/QuestieDB.git qdb/QuestieDB`
  (Questies Datenbank; Forever-Daten in `data/Forever/`) und
  `git clone https://github.com/JagTheHero/guidelime-pathfinder.git qdb/guidelime-pathfinder` (Navmesh-Wegdaten).
  Wird nur für die Routen-Werkzeuge gebraucht. Beide GPL-3.0 → LevelPilot und RezeptRadar tragen `LIZENZ.txt` +
  `LICENSE-GPL-3.0.md` (Repo ist öffentlich; neue Datenquellen dort eintragen).

## RezeptRadar 1.0 (bis 19.11. „Tiry's Zentrale 7.0“) – nur Rezept-Berater
`addons/RezeptRadar/` (4 TOCs), Globals `RezeptRadar`, `RezeptRadarDB`/`RezeptRadarCharDB`, `/rr` `/rezept` `/tz`.
Tests `bash tools/test_all.sh rezept` (Ziel `zentrale` geht auch), Spec `spec/rezeptradar_spec.lua`.
Tiry: „nur noch eine einzige Funktion … ein Fenster … lohnenswerte Rezepte für Kochen und Lederverarbeitung im AH …
Nicht das Rezept, sondern das, was ich crafte, soll Gold bringen … nur Rezepte, die ich noch nicht habe … für mein Skill,
am besten mit Skillpunkten, aber primär Gold.“
- **Keine weiteren Seiten/Funktionen wieder einbauen**, ohne dass Tiry es will. Aufbau und Rechenweg: `REZEPTRADAR.md`.
- Gewinn je Herstellung = max(AH-Min × Menge × 0,95, Händlerpreis) − Material; seelengebunden → nur Händler.
  Material = min(Händler mit unbegrenztem Vorrat + eigener Fraktion, AH über Preisstufen für `Advisor.CRAFTS` = 5).
- Sortierung **nur nach Gewinn**; Skill-Punkte sind Filter/Anzeige („Nur mit Skillpunkten“, Farbe), nicht Sortierung.
- Daten nur aus Spieldaten/QuestieDB über `tools/gen_zentrale7.py` / `tools/gen_vendor_mats.py`; Rohdaten in `tools/zentrale_src/`.
- `UI.Toggle` ist der Schalter-Baustein aus `Widgets.lua` – das Fenster heißt `UI.ToggleWindow` (Namenskollision!).

## Schlaghagel 1.5 (Schlaghagel + Waffe des Mahlstroms)
`addons/Schlaghagel/`: `PROFILES.SHAMAN` = Liste von Procs (`hagel` 16257, `mahl` 408505 – Forever-Talent 408498, Buff 30 s, 5 Stapel).
Je Proc eigener Anker (`<frame>Anchor`), Vorschau (`<frame>Preview`) und Aura-Container (`<frame>AuraContainer`); Position/Größe
von `hagel` direkt in `SchlaghagelDB` (1.0-kompatibel), andere in `DB[key]`. `fx = "strom"` baut seit 1.5 den Blitzsturm (s. u.) – jede Dauerschleife in eigener AnimationGroup (sonst steht die schnelle
still, bis die langsamste fertig ist). Alle Gruppen per `AddAuraShownAnimation` (Spiel startet/stoppt sie, auch im Kampf).
Grafiken: `python3 -I tools/strom_media.py`. Tests: `cd addons && lua5.1 ../tests/hagel.lua` („HAGEL TESTS OK“) und aus `wow-addons/`
`lua5.1 tests/hagel_strom.lua [ordner]` („STROM TESTS OK“; strenger Nachbau, `M.animState(group, t)` rechnet Alpha/Drehung/Skalierung
nach; mit Ordner 60 Einzelbilder → `render_pages.py` → GIF, heute `previews/Schlaghagel_1.3_Mahlstrom_ab5.gif`).
**1.2:** `hagel` hat `fx = "hagel"` (Hagelsturm): 3 Klingen-Schnitte (`CUTS`, X + flach, Takt 1,2 s = 3 Ladungen) mit Treffer-Funken,
2 Hagel-Lagen (Translation + Ein/Aus, eigener Takt), 2 flackernde Tempo-Striche, Einschlag. **Tiry will beim Schlaghagel keine
Kreise/Ringe/Drehungen** (Test prüft das). Grafiken `python3 -I tools/hagel_media.py` (nutzt Helfer aus `strom_media.py`, eigener Zufall).
Test `lua5.1 tests/hagel_sturm.lua [ordner]` („HAGELSTURM TESTS OK“, Mock rechnet jetzt auch Translation nach) → GIF
`previews/Schlaghagel_1.2_Hagelsturm.gif`. `/hagel effekte` (= `strom`) schaltet beide Effekt-Animationen.
**1.2.1:** Tiry will **keine Texte** in den Anzeigen (kein Titel/Hinweis) – nur Ladungen/Stapel + Sekunden; beide Strenge-Tests prüfen das.
**1.3 – Mahlstrom erst ab 5 Stapeln:** `pr.minStacks = 5`. Die ganze Optik hängt an einer unsichtbaren `StatusBar` (`gate`), die per
`button:SetApplicationBar(gate, {minApplications = 5, maxApplications = 5})` Blizzards Knopf übergeben wird – das Spiel macht
`SetShown(applications >= minApplications)` (`Blizzard_CustomAuraButton` `ApplyApplicationBar`), auch im Kampf. Keine Stapelzahl,
Restzeit groß mittig. Einschlag nicht über `AddAuraShownAnimation` (liefe schon bei Stapel 1), sondern `gate` `OnShow` → `strike:Play()`.
Schlägt `SetApplicationBar` fehl, bleibt `gate` sichtbar (Rückfall: ab 1 Stapel). `/hagel ab5` (`DB.mahl.ab5`) schaltet die Schwelle, ab `/reload`.
Vorschau-GIF `previews/Schlaghagel_1.3_Mahlstrom_ab5.gif`.
**1.4/1.5 – Animation bei 5 Stapeln:** WoW stoppt Animationen der versteckten `gate` (Stapel 1–4) → `gate` `OnShow` startet alle
Schleifen + Blinken neu (sonst „Kreis leuchtet nur“), `OnHide` stoppt. **1.5:** Tiry fand die Ring-/Kometen-Version 1.4 „billig“ – Mahlstrom
nutzt jetzt den **Blitzsturm im Stil des Hagelsturms**: beide Effekte über `sturm(V, icon, STYLES.hagel|STYLES.blitz)` (gleiche Mechanik,
nur Stil-Tabelle). Blitz: 5 Schnitte `blitz_slash` (Takt 1,5 s, = 5 Stapel), Funken `blitz_rise1/2` steigen (Translation +y), Tempo-Striche
blau, Einschlag. **Keine Ringe/Drehungen auch beim Mahlstrom** (Test prüft das). Grafiken `python3 -I tools/blitz_media.py`;
`strom_media.py` erzeugt nur noch `strom_glow` + Helfer. Vorschau `previews/Schlaghagel_1.5_Mahlstrom_Blitzsturm.gif`.

## ChatWerk 1.1 (ein Chatfenster mit Reitern)
- Dateien: `Core.lua` (Kategorien `ns.CATS`/`ns.GROUPS`, Ereignis → Kategorie `ns.EV`, Systemmeldungen per GlobalStrings-Muster
  `ns.Classify`, Formatierung, Spam, Stichwörter, `ns.Emit`), `Auction.lua` (AH/Post/Händler/Gold: Hooks auf Spieler-Klicks +
  Geld-„Grund“ gegen Doppelzeilen), `Blizzard.lua` (Blizzard-Chat in unsichtbaren Rahmen, Eingabezeile, `print`-Einsammeln über
  `hooksecurefunc(ChatFrameN, "AddMessage")`: ohne 5. Argument = Add-on-Ausgabe), `Window.lua` (ein Rahmen `ChatWerkFrame` = `ns.Main`, Reiterleiste; je Reiter eigener ScrollingMessageFrame in `ns.Windows[id]`, nur der aktive `DB.active` sichtbar, `unread`-Zähler),
  `Config.lua` (Auswahlliste), `UI/Widgets.lua` (Neon-Glas aus RezeptRadar).
- **Datenmodell 1.1:** `DB.windows` = Reiter (`id,name,cats,chans,newChannels`, Reihenfolge = Liste), `DB.frame` = Lage/Größe/Glas/Schrift/
  Ausblenden/Sperre des einen Fensters, `DB.active`. `DB.v = 110` stellt 1.0-Daten einmalig um. Kanalstil `name` = Herkunft ausgeschrieben.
- **Geheimwerte:** CHAT_MSG-Text/Name/GUID im Chat-Lockdown nie anfassen (`issecretvalue` zuerst), nur `AddMessage` durchreichen,
  nicht speichern. Ereignisname und Kanalnummer sind nie geheim.
- Neue Nachrichtenart = Eintrag in `ns.CATS` (+ `ns.EV` bzw. `SYS`/`LOOT`-Liste). Neue Arten werden in bestehenden Reitern
  **nicht** automatisch eingeschaltet. Test: `tests/cw.lua`, Mock kennt `ScrollingMessageFrame` (`W.SMF`).

## WindBaem (Windzorn-Ton)
`addons/WindBaem/`: meldet per `C_UnitAuras.AddAuraSound(Added, {unitToken="player", spellID, soundFileName, outputChannel,
throttleSeconds})` die 7 Windzorn-Proc-Auren an (Effekt „Extra Attacks“ in `allspells.txt`; Aura mit „No Aura Icon“). Nur außerhalb
von Kampf/Bosssperre, sonst `pending` bis `PLAYER_REGEN_ENABLED`/`ENCOUNTER_END`; vor jedem Neu-Eintragen `RemoveAuraSound`.
Sounds `tools/snd_wf.py` (Synthese, `Media/pling.ogg` Standard, `tick.ogg`, `wusch.ogg`, ≈ -26 dBFS RMS, Spitze ≤ -10; Vorhören
`previews/Sound_WindBaem_*.mp3`). Kanal Standard `SFX` (Effekte-Regler), `DB.ver` 110 stellt 1.0-Einstellungen um.
Test: `cd addons/WindBaem && lua5.1 ../../tests/wb.lua` („WB TESTS OK“).

## LevelPilot 7.0 – RXP-Modus
`addons/LevelPilot/RXP.lua` (`LP_RXP`, in den TOCs vor `LevelPilot.lua`): RestedXP-Guide → LevelPilot-Route `LevelPilot_Routes.rxp`
(`faction = "RXP"`, `min = 999` → `R.Pick` nimmt sie nie; Schritte `rx`, `rs`, `el`, `map/x/y` aus erstem `.goto`). `LP_RXP.Plan(n)`
liefert route, hero, list, info (`info.rxp` = cur/total/title/l0/l1/warn), state – gleiches Format wie `R.Plan`; `routeUpdate` nimmt
den Zweig, wenn `RT.UseRXP()` (DB.rxp ~= false, Routen-Ansicht, RXPGuides geladen). Pfeil-Ziel `LP_RXP.Waypoint` (RXP-Wegpunkt).
Abgleich/Grind/Haken = Klick auf RXPs CheckButton aus `RXPFrame.CurrentStepFrame.framePool` (nie im Kampf). RXP zählt Elemente mit
`textOnly` nicht → LevelPilot setzt sie aktiv auf „done“. Band `RT.RxpBand`, Kürzen `RT.Fit`, Größen-Griff `RT.ScaleBy`/`DB.scale`.
`R.LogAdvice`: bei `route.rxp` „prüfen“ statt „löschen“ (außer grau/gesperrt). RXPNeon ≥ 2.2 respektiert `RXPNeon.extern`.
Test: `lua5.1 tests/lp_rxp.lua [ordner]` aus `wow-addons/` („LP RXP OK“), danach `render_pages.py`.

## RXPNeon (Zusatz für RestedXP Guides)
`addons/RXPNeon/`: Theme „Tiry Neon“ über `RXP:RegisterTheme` + Skin per `hooksecurefunc` (RXPFrame:UpdateVisuals,
RXP.SetStep/LoadGuide/SetupArrow) und Live-Übersetzung (Hook auf `RXP.ReplaceNpcIds` und `RXP.settings.ReplaceColors`,
nur Schritte, nie Quest-Elemente). `Namen.lua` erzeugt `tools/rxn_names.py <RXPGuides-Pfad> [<CSV-Cache>]` (QuestieDB-l10n +
AreaTable/TaxiNodes), Grafiken `tools/rxn_media.py`, Satzregeln von Hand in `Phrasen.lua` (CC BY-NC-SA, RXP-Texte).
**Kein RXP- oder Zygor-Code/-Textur ins Repo.** Test: `cd addons/RXPNeon && lua5.1 ../../tests/rxn.lua [vorschau-ordner]`
(„RXN TESTS OK“); Vorschau mit `L.dump(…, {levels = true, noHover = true})` = Zeichenreihenfolge nach Strata/Frame-Level wie im
Spiel, ohne HIGHLIGHT-Ebene. **2.0:** `Fenster.lua` = eigenes Fenster, liest RXP-Daten (`RXPFrame.CurrentStepFrame.framePool`
mit `.step`/`.elements[j].button`, `RXP.GetGuideProgress`, `currentGuide.steps`); Haken = Klick auf RXPs CheckButton.
**RXPFrame nie `Hide()`** (setzt `addon.isHidden` → RXP pausiert Automatik) – nur Alpha 0 + Scale 0.01, per Hook erzwungen.
**2.0.1:** RXPs `.turnin` (ohne negative ID) wartet, bis die Quest abgegeben ist – hat Tiry die Quest, aber offene Ziele, zeigt `Missing(id)` (`C_QuestLog.GetQuestObjectives`) einen Hinweis-Kasten statt still zu hängen (Fall 1195: Phiole am Mondbrunnen Eschental füllen, laut RXP-Classic-Guide). **2.1:** Griff `MakeGrip` unten rechts → `ScaleBy` (Skala aus Cursor-X, linke obere Ecke fix, 0.6–1.6, `DB.scale`). Grind = `IsGrind` (`tag == "xp"`, nicht `skipstep`/textOnly; `.xp <N`/`>N` sind Skip-Marker und bleiben); `DB.grind` (Standard aus) → `SkipGrind` klickt RXPs Grind-Box (`el.rxnGrind`), reiner Grind-Schritt zusätzlich `RXP.SetStep(cur+1)`, nicht im Kampf. Hinweise: `PreReq` (RXP `icons.error` + Tooltip-Liste) → „VORQUEST FEHLT“, Turnin ohne Quest im Log und ohne `skipIfMissing` → „QUEST NICHT IM LOG“. `Pfeil.lua` = Skin auf `RXP.arrowFrame` (Text-Hook „Ziel\n(Nyd)“, Rotation-Hook, Größe 44). `RXP.ReplaceNpcIds` ohne Element
→ `N.ElementByText` sucht das Quest-Element der aktiven Schritte (sonst halbe Übersetzung).

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
- **Geheime Werte anzeigen statt rechnen (TotemTakt-Uhr 1.1):** Laut Forever-API-Doku nehmen nur Funktionen mit
  `SecretArguments = "AllowedWhenTainted"` geheime Werte von Add-ons an: `Texture:SetTexture`, `FontString:SetText`/
  `SetFormattedText`/`SetTextColor`, `Region`/`Frame:SetAlphaFromBoolean(bool, aTrue, aFalse)`. Gesperrt
  („AllowedWhenUntainted“): `SetShown`, `Cooldown:SetCooldown`. Ablauf-Ring über ein Dauer-Objekt:
  `cooldown:SetCooldownFromDurationObject(GetTotemDuration(slot), true)` (so macht es `Blizzard_CustomAuraButton`).
  Vor jedem Vergleich `issecretvalue(v)` prüfen (auch `v == nil` vermeiden). Test-Nachbau: `wow_mock` kennt
  `Cooldown` und meldet in `M.secretSeen`, welche erlaubten Funktionen geheime Werte bekamen (`tests/totem_uhr.lua`).
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
3. `plan.py` – Planer: Abschnitte (Gebiet, Hub, kuratierte Quests + Auto-Pool), Stufen-Simulation (Quest ≤ Stufe+1 `PLAN_ABOVE`, Gegner ≤ Stufe+1 `PLAN_MOB`, Tempo `T_KILL` 0.70 / `T_GRIND` 0.80 in `xpmodel.py`),
   gierig nach Nähe + Or-Opt, Grenzkosten-Filter gegen Grind-Tempo, Grind-/Kontroll-Schritte.
4. `make_route.py [key]` – Routen in `ROUTES` (`horde_22_30`, `horde_30_40`), Einstiegsstufen per `tune()` →
   `gen_steps_<key>.json`; danach setzt `fill.py` Aufhol-Quests ein (Schritte mit `fill = Stufe`: nur fuer Spieler
   hinter dem Plan, ab dieser Stufe uebersprungen; Grund: Planer-Grindtempo ~300 XP/Min ist optimistisch). Alle Annehmen-Schritte tragen `xp` (Quest + Mobs), `wm` (Arbeitsminuten) `ml` (höchste mittlere Gegnerstufe, `xpmodel.mob_level`) und ggf. `hard` (Elite) – Basis für `R.Rethink` (Menü „Neu berechnen“, `plan.detour`); `R.FillBudget` in
   `Route.lua` nimmt nur so viele Aufhol-Quests, wie laut `UnitXP`/`UnitXPMax` bis zur Stufe fehlen (Rest = Mobs, `R.fillInfo`). Dann `build.py [key]` → prüft gegen Forever-DB, schreibt `addons/LevelPilot/Routes/`.
   `pool.py` → `Routes/Pool_Horde.lua` (Quest-Pool, 5.1.6): alle Solo-Quests im Freien (keine Elite/Begleit/Dungeon/Klasse/Beruf/Ruf,
   Start nicht per Gegenstand, Fundorte bekannt) mit ql/rl/ml/xp/wm/pre/pres. Live (`Route.lua`): Pool-Schritte haengen per
   Metatabelle ab Index `R.POOL0` an `route.steps` (`#steps`/`ipairs` sehen sie nicht); ist das Ziel Warten/Grinden, waehlt
   `poolBest` alle 20 s die Quest mit den meisten XP/Min (Weg per `LP_Fly.TripSec`, Quest/Gegner <= Stufe+1), wenn sie
   mindestens `R.QUEST_PREF` (0.5) x Grind-Tempo (Grind inkl. Weg zum Grind-Platz) bringt → `plan.detour.pool`. UI zeigt sie als „EXTRA“.
   Neue Routendatei in alle 4 TOCs eintragen. `tests/route.lua` prüft Routenwahl + Dateien.
**Live-Modus (6.0, Standard, `R.live`/`DB.live`, `/lp live`):** am Ende von `R.Plan` waehlt `livePlan` aus Pool +
Questlog ein Quest-Gebiet: Kandidaten (`liveCands`: einfach, Vorquest da, im Log/fertig zaehlt mit), Hubs = Questgeber
innerhalb `R.LIVE_CORE` (350 yd, Single-Linkage), Mitglieder = Annehmen/Abgeben <= `R.LIVE_HUB` (700) und Ziel <=
`R.LIVE_FIELD` (2500) vom Hub + Grenzkosten >= `QUEST_PREF` x Grind; Rate = XP / (Weg + Arbeit + Rundtour); gewaehlt
wird das Gebiet mit den meisten XP unter denen >= `R.LIVE_BIG` (0.8) x beste Rate. Wechsel nur bei Ueberschneidung oder
>= `R.LIVE_STICK` (1.3) x. Tour: naechster erlaubter Schritt nach Naehe. Unter `QUEST_PREF` x Grind → fester Plan.
Fenster (6.0.3): neue Quests `ql >= Stufe - R.questBelow` (3), Gegner per `R.MobFit`/`R.MobPick` (Pool `mv` = alle Gegnerstufen) und Pfeil per `easyNpcs` bevorzugt Stufe-3..+1. Questlog per Name nur, wenn das Log zu dem Titel keine andere Quest-ID hat (Kettenteile gleichen Namens).
Test: `tests/regress/live.lua` (echte Karten/Pool). UI: Kopfzeile/Band/`/lp warum` zeigen das Gebiet.
**Nur Solo-Leveling** (Tiry 11.11.): keine Elite-/Gruppen-/Dungeonquests – `bad_quest` prueft Elite auch fuer kuratierte
Quests, `fill.py` bricht bei Elite-Aufhol-Quests ab. Speedrun-Daten liefern nur die Gebietsreihenfolge, keine Tempo-/Grind-Werte.
Quellen der Gebietsreihenfolge: Konsens freier Speedrun-Routen (Joana, Warcraft Tavern, Guidelime, WoW-Pro, Bustea),
danach per Modell verglichen; Gebiete mit nur 1–3 Quests werden gestrichen.
Die Reihenfolge **innerhalb** der Gebiete und die Wege berechnet der Planer – nicht von Speedrunnern übernommen;
Tiry gegenüber genau so benennen. Live gilt seit 5.0 ein **fester Plan** (`Route.lua`, `R.Plan`): gespeicherter Zeiger
je Route (`DB.plan`), nur vorwärts; Einstieg (`R.Entry`) aus angenommenen Quests am Ort, Sprung nur mit Beweis (umkehrbar
`/lp zurueck`), Questlog-Check `R.LogAdvice`. Keine Umsortierung nach Entfernung – Tiry will eine nachvollziehbare
Reihenfolge. Live: `R.maxAbove = 2`, `R.mobAbove = 1` (Schritt mit `ml` > Stufe+1 = „später“); wartet der Plan, setzt `R.Plan` alle 20 s einen Auto-Abstecher (`plan.detour.auto`, ≤ 2500 Yards, nur wenn besser als Grind-Tempo). Laufweg (Walk.lua) und Flugnetz (`Fly.lua`) liefern Entfernungen, Pfeil und Flug-Rat.
