# Übergabe – Stand 11.11.2026

Diese Arbeit lief bisher in einer Cloud-Sitzung, die am Repository Velocenter-Planer hing. Ab jetzt geht es
in Sitzungen auf **Tiry38/Tiry** weiter. Alle Dateien liegen in diesem Ordner, Projektleitfaden: `CLAUDE.md`.

## Add-ons – Stand

| Add-on | Version | Zweck | Stand |
|---|---|---|---|
| **Tiry's Zentrale** | 6.1.0 | Gold- und Berufe-Addon (`TirysZentrale/`, Doku `ZENTRALE.md`): Neon-Glas-Design mit Dock, **ein AH-Scan für alle Reiter**, Verkäufe pro Tag, Gold pro Tag, Schnäppchen, Markt-Tiefe, Kaufen bis, Neu einstellen mit Menge, Anzahlung im Gewinn, **Tooltip als Preis-Liste (6.1)** | ausgeliefert, **Spieltest offen** (Checkliste `INGAME-TEST.md`) |
| **LevelPilot** | 4.2.0 | Levelrouten Horde **22–30 und 30–40**, **echte Laufwege (Navmesh) statt Luftlinie** für Zielwahl, Pfeil, Entfernungen und Flug-Rat, Flugnetz mit Umsteigen, Pfeil, Lichtstrahl, Auto-Quests, XP-Cockpit | ausgeliefert, **Spieltest offen** (Checkliste `INGAME-TEST.md`, Teil LevelPilot) |
| **ProcAlarm** | 2.1.0 | **für Tirys Kollegen (Hexer)**: Schattentrance (17941) über Blizzard-Aura-Slot, auch im Kampf; violetter Glow + Blinken, ohne Ton, ohne grünen Ring | ausgeliefert, **Kampftest offen** |
| **Schlaghagel** | 1.0.0 | **Tirys Verstärker**: Schlaghagel-Buff (16257) über Blizzard-Aura-Slot, auch im Kampf; Ladungen groß, Restzeit, türkiser Glow + Blinken wie ProcAlarm, ohne Ton; `/hagel` | ausgeliefert, **Kampftest offen** |
| **EnhanceHUD** | 1.2.0 | Verstärker-Schamanen-HUD (Frost/Feuer-Design) | ausgeliefert |
| **Blitzschild** | 1.2.0 | Blitzschlagschild Ladungen/Zeit | im Kampf nicht möglich (secret values) → Cooldown-Manager „Verfolgte Leisten“ + WA nur außerhalb des Kampfes |
| **MiniPost** | – | Post-Symbol unter der Uhr, andere Minimap-Knöpfe unsichtbar | ausgeliefert, Test offen |
| **ChatHoch** | 1.4.0 | Chat höher, Reiter bündig (ClampRectInsets von ChatFrame1) | ausgeliefert; Tiry hatte noch 1.3.0 geladen |

## LevelPilot 4.2 – echte Laufwege statt Luftlinie (11.11.)
Tirys Kritik an 4.1 (Screenshot Zoram'gar-Flugpunkt): Quests am Flugpunkt angenommen, der Pfeil schickt ihn „den
übelsten Weg“ Richtung Steinkrallengipfel, **kein Flug-Vorschlag**, „wurde das wirklich von einem Speedrunner so
vorgeschlagen?“ Ursachen (alle geprüft) und Lösungen:

| Ursache | Lösung |
|---|---|
| Schrittwahl, Pfeil, Entfernung je Zeile und Flug-Rat rechneten mit **Luftlinie**: Zoram'gar → Gipfel 844 yd Luftlinie, echter Weg **7063 yd** (Talondeep-Pfad; Navmesh exakt 6747) | **Wegenetz `Walk.lua`** aus dem Forever-Navmesh (Kalimdor 9705 Knoten/48443 Kanten, Östl. Königreiche 7758/36415), Dijkstra fortsetzbar und zwischengespeichert. Zielwahl (Branch-and-Bound), Zeilen-Entfernung, Pfeil (Wegpunkte, „über Talondeep-Pfad“) und Flug-Rat nutzen den Laufweg |
| Flug-Rat kannte nur Direktflüge, Laufzeit = Luftlinie × 1,45 | **Flugnetz** mit allen Strecken und Zeiten (Umsteigen, +5 s je Zwischenlandung), nur bekannte Flugpunkte; Laufen zum/vom Flugmeister per Wegenetz. Zoram'gar → Sonnenfels 363 s (2 Flüge) |
| Quests im Log am Standort wurden ignoriert, wenn die Route woanders weiterging | Schrittwahl nimmt spätere „Erledigen/Abgeben“-Schritte von Quests im Log mit (≤ 1800 yd, mit Aufschlag) |
| Planer (`xpmodel.py`/`plan.py`) mit Luftlinie, Hügelland-/Mulgore-Größe falsch | Bodenweg aus `navmesh.json`, Flüge mit bekannten Flugpunkten, Gebietsgrößen aus `zones.py`; Routen neu gebaut (beide „0 Probleme“) |

**Zahlen (Szenario-Test `tests/travel.lua`, Laufweg aus dem Netz):** Zoram'gar-Flugmeister → Steinkrallengipfel zu
Fuß 1009 s (16,8 Min), per Flug über Sonnenfels 716 s (11,9 Min) → **Flug spart ~5 Min** (7 yd/s). Mit Geisterwolf
(9,8 yd/s) 721 s gegen 622 s → spart ~1,5 Min, Rat kommt trotzdem. Reine Lauf-/Flugzeit ohne Gegner und Quests.

**Speedrun-Wahrheit (ehrlich):** Die **Gebietsreihenfolge** ist Speedrun-Konsens. Die Reihenfolge **innerhalb** der
Gebiete und die Wege dazwischen hat mein Planer berechnet – bis 4.1 mit Luftlinie, also **nicht** von einem
Speedrunner. Speedrunner (RXP-Forever-Guide) laufen Steinkrallen → Talondeep-Pfad → Eschental/Zoram'gar (Flugpunkt
holen) und Sonnenfels ↔ Gipfel zu Fuß über den Mirkfallonsee; **niemand läuft Zoram'gar → Gipfel**. In der 4.2-Route
werden die Zoram'gar-Quests im Eschental erledigt; steht man mit Steinkrallen-Zielen am Zoram'gar-Flugmeister, rät
LevelPilot jetzt zum Flug nach Sonnenfels.

**Modell (neue Reisekosten):** 22–30: 872 Min (alte Reihenfolge im neuen Modell 885); 30–40: 1616 Min (alt 1615 –
gleichauf, die alte Reihenfolge war dort schon passend).

**Rechenzeit (Lua 5.1, gemessen):** Netz auspacken ~55 ms einmal je Kontinent (~4 MB), erste komplette Liste ~56 ms,
danach **unter 1 ms pro Sekunde** im Mittel (Wegsuchen starten an Zielen/Flugmeistern und bleiben gespeichert; der
Spieler wird nur angebunden). Speicher-Deckel für Wegsuchen: 40 Suchen bzw. 60 000 Knoten.

**Lizenz:** `Walk.lua` ist aus Guidelime Pathfinder (GPL-3.0) abgeleitet, `Nav.lua`/Routen aus QuestieDB (GPL-3.0).
LevelPilot hat deshalb jetzt wie Tiry's Zentrale `LIZENZ.txt` + `LICENSE-GPL-3.0.md` (das Repo ist öffentlich =
Weitergabe). Generator `tools/navmesh.py` liegt im Repo.

## LevelPilot 4.1 – Routen neu geplant (10.11.)
Tirys Kritik an 4.0: „Effizienz 0“, „schickt mich an den Arsch der Welt“, „Greif falsch“, „Quests, die ewig dauern“,
„oft nur 1–2 Quests, dann anderes Gebiet“. Ursachen (geprüft) und Lösungen:

| Ursache | Lösung |
|---|---|
| Routenstufen ~2 Stufen zu optimistisch → Quests „später“ → Sprung ins nächste Gebiet | Planer simuliert die echte Stufe (Quest- + Mob-XP) und setzt Grind-Schritte, wo Quests fehlen |
| Langsame Quests in der Route, live übersprungen → XP-Löcher | Grenzkosten-Filter: Quest bleibt nur, wenn XP/Min (inkl. Umweg) ≥ 85 % Grind-Tempo; max. 35 Min Arbeit; Drop < 15 % raus |
| Bei Stufe 29 schickte die 22–30-Route zurück ins Brachland | Vorausregel: alte Annehmen-Schritte (2+ Stufen unter dir) fallen weg, **sobald die Route schon weiter ist** – ein neues Gebiet wird nie übersprungen |
| Routenwahl nahm Route außerhalb ihres Bereichs | `R.Pick` nimmt nur passende Route (oder eine, die max. 2 Stufen höher beginnt) |
| Flugrat nutzte unbekannte Flugpunkte, Flugzeit zu kurz | nur bekannte Punkte (erst nach einmal Flugmeister ansprechen), Umweg ×1,45 + 30 s, echte Flugdauer wird gemessen |

**Forever-Fakten (Recherche, Stand 10.11.):** Reittier erst ab Stufe 40 → 22–40 alles zu Fuß (7 Yards/s);
XP-Kurve unverändert; ausgeruhte XP verdoppeln Mob-XP; Dungeon-Quest-XP > 2× Classic, Dungeon-Mob-XP gekürzt;
kein Dungeonfinder; ~1000 neue Forever-Quests sind noch **nicht** in Questies Forever-DB → nicht routbar.

**Ergebnis laut Modell** (Durchschnittsspieler ohne ausgeruhte XP, zu Fuß – absolute Zeiten pessimistisch, Vergleiche belastbar):
- 22–30: 885 Min, 7 Blöcke (Orgrimmar → Brachland → Steinkrallen → Brachland → Eschental → Hügelland → Tausend Nadeln), Rest-Grind am Ende ~1 Stufe.
- 30–40: 1561 Min, 7 Blöcke (Tausend Nadeln → Hügelland → Arathi → Schlingendorntal → Desolace → Düstermarschen → Arathi);
  2. Schlingendorntal-Besuch (3 Quests) und Ödland (5 Quests, Weg durch Allianz-Gebiet) gestrichen – brachten ~0 Min.
- Ehrlich: 30–40 braucht laut Modell ~40 % Grind-XP – die soloeffizienten Classic-Quests reichen nicht. Dungeons
  (verdoppelte Quest-XP) wären schneller, gehen aber nur in Gruppe.

### Design 4.1 „Neon Glass“ (LevelPilot.lua)
Glas-Fenster mit Neon-Verlaufskante, Stufenring + XP-Kapsel (inkl. Erholt), Hero-Karte für den aktuellen Schritt,
Zeitleiste der nächsten Schritte, Grind-Schritte „bis St. X“, Flug-Kapsel, ROUTE|QUESTS-Umschalter, Einstellungs-Panel
(`···` bzw. `/lp menu`), Glas-Tooltips, gleitende Fertig-Meldung. Vorschau (Mock): `previews/LevelPilot_Design_4.1.png`.
Ohne passende Route (z. B. ab 40) zeigt das Fenster automatisch die angenommenen Quests.

### Werkzeugkette (neu)
`python3 -I make_route.py [key]` (Planer `plan.py` + Modell `xpmodel.py`, schreibt `gen_steps_<key>.json`) →
`python3 -I build.py [key]` (prüft gegen Forever-DB, schreibt `Routes/<Datei>.lua`, muss „0 Probleme“ melden).
„Hinweis: Vorquest vor Routenbeginn“ = Kette beginnt vor der Route; fehlt die Vorquest, überspringt die Engine die Quest.
Bewertung einer fertigen Route: `python3 -I xpmodel.py gen_steps_<key>.json`.

## LevelPilot 4.0 – was davor gebaut wurde (09.11.)
Tirys Auftrag: „überarbeite das ganze Add-on in allen Bereichen – Funktionen, Sinn, Logik, Übersichtlichkeit,
Design, Netzpunkte, Schnelligkeits-Logik, Verfolgungs-Logik, keine Dauer-Sounds, Strahl wie Waypoint UI, epischer
Amboss-/Schloss-Sound (max. 1–2 s)“.

- **Route.lua (Engine 4):** Zwischenspeicher pro Durchlauf; Questlog-Erkennung fünffach (eigenes Gedächtnis
  `qmem`, Logliste über zwei APIs, `GetLogIndexForQuestID`, `IsOnQuest`, eindeutiger Questname) + Abgleich, wenn
  das Log vollständig gelesen wurde; **stabile Schritt-Schlüssel** (`StepKey`) statt Nummern; Reise-Schritte gelten
  als erledigt, sobald im Abschnitt schon etwas angenommen/abgegeben wurde; Live-Auswahl mit **Hysterese**
  (Wechsel nur bei ≥ 40 m bzw. 25 % besser); „Erledigen“-Ziel = **Mitte der nächsten Gegnergruppe** aus Questie,
  erfüllte Ziel-Arten fallen weg; Wegenetz mit Glättung, im Gelände nur ≤ 20 % Umweg.
- **LevelPilot.lua:** Auto-Annehmen **nur Routen-Quests** (Hinweis im Chat sonst); Liste gruppiert gleiche NPC-
  Aufgaben („2 QUESTS ANNEHMEN“), „Nebenbei“-Hinweis, Entfernung je Zeile, Gehzeit; Fenster im Kampf dezent;
  neuer Strahl (Säule wächst mit der Nähe, Symbol im Leuchtring, Pinpoint nah, Navigator am Rand); Ton-Regeln:
  nur bei neuem Ziel, nie im Kampf/Flug, Ruhe nach Kampf/Landung/Laden, je Ziel einmal, ≥ 4 s Abstand.
- **Fly.lua:** Fliegen gegen Laufen (Flugpunkte aus `C_TaxiMap`, bekannte Punkte gemerkt, Flug am Flugmeister
  automatisch), **Ruhestein-Rat** (gebundener Ort ≈ gleichnamiger Flugpunkt).
- **Sounds:** `Media/beam.ogg` (Amboss, 1,5 s), `lock.ogg` (Schloss), `arrive.ogg`; Generator `tools/snd2.py`.
- **Texturen:** Strahl `wb_*`, Symbolring `ctx_*`; Generator `tools/beam2.py`.
- Befehle: `/lp` (Liste), u. a. `weiter`, `zurueck`, `neu`, `speed`, `gruen`, `flug`, `ton`, `kampf`, `strahl`,
  `marker`, `wege`, `punkt`, `export/import`, `entsperren`; `/way x y Titel`.

### Bekannte Unsicherheiten (nur im Spiel prüfbar)
- Ob Forever `C_TaxiMap.GetTaxiNodesForMap`, Item-Abklingzeit (Ruhestein 6948) und `GetBindLocation` freigibt.
- Flugzeiten stammen aus den Pathfinder-Daten (Strecken + Sekunden) und werden im Spiel nachgemessen; Ruhestein-Zeit geschätzt.
- 4.2: `C_Map.GetMapPosFromWorldPos` (Vector2D) im Forever-Client, TaxiMap-Knoten-IDs = Daten-IDs, Ebenen-Anbindung auf
  Hochplateaus (Donnerfels; Aufzüge Großer Aufzug/Freiwindposten sind als Verbindung ergänzt), `GetUnitSpeed` in
  Geisterwolf, spürbarer Ruckler beim ersten Auspacken des Netzes (~55 ms gemessen, hier ohne Spiel).
- Questbewertung (`xpmodel.py`): XP aus Questies Forever-XP-Tabelle, Dropchancen aus Questies Droptabellen; Kill-/Laufzeiten sind Annahmen.
- 30–40-Reisehinweise (Brackenwall, Schattenflucht) setzen voraus, dass Tiry die Flugpunkte erst zu Fuß holt.
- ProcAlarm 2.1: ob Forever Blinken/Restzeit am Aura-Slot annimmt (`/proc diag` → „Teile“).

## Nächste Schritte
1. Tirys Spieltest-Rückmeldung zu LevelPilot 4.2 abwarten (Zoram'gar → Steinkrallen: Flug-Rat, Pfeil über Talondeep) und gezielt nachbessern.
2. **Routen 40–50, 50–60** mit derselben Kette (`make_route.py` neuen Schlüssel in `ROUTES` + Abschnitte).
3. Sobald Questie die neuen Forever-Quests führt (IDs 9xxxx): Pool neu rechnen – könnte den Grind-Anteil deutlich senken.
4. ProcAlarm nach `/proc diag`-Screenshot anpassen; ChatHoch 1.4.0 / MiniPost-Rückmeldung.
5. Tiry's Zentrale 6.0: Spieltest-Rückmeldung abwarten (Komplett-Scan, Absatz-Werte, Design im echten Client).

## Tiry's Zentrale 6.0 (10.11.)
Wünsche: Logik neu durchdacht, Forever-Goldguides/Foren, „chicer als LevelPilot“, moderne leichte Menüs, Absatz sehen
(„Kleinvieh macht auch Mist“), viele Goldmacher-Funktionen, **ein Scan aktualisiert alle Reiter**.
- Recherche: `docs/GOLD-RECHERCHE-2026-11.md` (Anzahlung 1 Silber live, Kupfer-Fehler bei Ausrüstung, Writs, Raid-Start 09.12.).
- Menü: 5 Hauptpunkte im Dock (Start, Herstellen, Farmen, Handel, Mein Gold), Lernen (?) und Einstellungen oben rechts.
- Nur im Spiel prüfbar: Atlas-Namen/Glow/Masken, ob `Auctionator.State.FullScanFrameRef` in Tirys Auctionator-Version
  existiert (sonst Schnell-Scan), Absatz-Werte nach echten Scans, Tooltip-Zeilen, exakte Anzahlung bei offenem AH.

## Verlauf der wichtigsten Rückmeldungen (Kurzfassung)
- Strahl alt = „Kindergrafik“, Sound alt = „wie Kirby, der Luft einsaugt“ → beides neu (4.0).
- Route schickte zu Orten, an denen er schon war / zu Quests, die er schon hatte → Engine 4.
- „Kackquests“ → Qualitätsfilter + Auto-Annehmen nur Routen-Quests + Rechtsklick sperrt eine Quest dauerhaft.
- „Effizienz 0 / Arsch der Welt / 1–2 Quests, dann anderes Gebiet“ → Routen neu geplant (4.1).
- Wunsch: Strahl hinter Gegenständen → technisch nicht möglich (so mitgeteilt); umgesetzt: Punkt immer sichtbar,
  Strahl wächst mit der Nähe.
