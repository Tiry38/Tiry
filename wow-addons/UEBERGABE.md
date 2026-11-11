# Übergabe – Stand 11.11.2026

Diese Arbeit lief bisher in einer Cloud-Sitzung, die am Repository Velocenter-Planer hing. Ab jetzt geht es
in Sitzungen auf **Tiry38/Tiry** weiter. Alle Dateien liegen in diesem Ordner, Projektleitfaden: `CLAUDE.md`.

## Add-ons – Stand

| Add-on | Version | Zweck | Stand |
|---|---|---|---|
| **Tiry's Zentrale** | 6.2.1 | Gold- und Berufe-Addon (`TirysZentrale/`, Doku `ZENTRALE.md`): Neon-Glas-Design mit Dock, **ein AH-Scan für alle Reiter**, Verkäufe pro Tag, Gold pro Tag, Schnäppchen, Kaufen bis, Neu einstellen mit Menge, Anzahlung im Gewinn (1 Kupfer seit 10.11.), Tooltip als Preis-Liste, **Sparziel, Unterwegs-Gold (mit LevelPilot-Route), Stationen/seelengebundene Rezepte (6.2)** | ausgeliefert, **Spieltest offen** (Checkliste `INGAME-TEST.md`) |
| **LevelPilot** | 5.1.8 | Levelrouten Horde **22–30 und 30–40** als **fester Plan** (Einstieg erkennt deinen Stand, Sprung nur mit Beweis, `/lp zurueck`), **Questlog-Check** mit Löschen-Knopf, Plan-Band + Status-Pillen, echte Laufwege, Flug-Rat, Pfeil, Lichtstrahl (**ruht im Questgebiet**, 5.1), **Aufhol-Quests statt Grinden, wenn du hinter dem Plan bist** (5.1.1: Tausend Nadeln; **5.1.2: Anzahl nach echter XP-Leiste**, Rest als „noch X XP · ~N Mobs“, zweiter Block 28→30; **5.1.3: verpasste Aufhol-Quests kommen zurück, Warten zeigt XP bis zur nächsten Stufe, Wegpunkt-Kontrolle**; **5.1.4: Menü „Neu berechnen“** – Abstecher zu einer nicht schwereren Quest mit mehr XP/Min; **5.1.5: alles auf deine Stufe** – Quests höchstens Stufe +1, Gegner höchstens Stufe +1 (Planer + live), langsameres Planer-Tempo, Auto-Vorschlag „Passt zu deiner Stufe“ statt Warten, Grind-Schritte mit XP/Mobs; **5.1.6: Quest-Pool** – 430 Solo-Quests aus der Forever-DB, statt Grinden kommt automatisch die beste machbare Extra-Quest nach XP/Min inkl. Flug; **5.1.7: nur Solo** – Elite-Quests auch aus den festen Routen raus (Arachnophobia, Bloodfury Bloodline, Hypercapacitor Gizmo), laufende Begleitquest wird zuerst zu Ende geführt; **5.1.8:** verpasste Route-Quests zählen als Extra-Quests, Weg zum Grind-Platz zählt beim Vergleich mit, dunkle Schrift auf Neon-Knöpfen ohne Kontur = lesbar), Auto-Quests, XP-Cockpit | ausgeliefert, **Spieltest offen** (Checkliste `INGAME-TEST.md`, Teil LevelPilot) |
| **TotemTakt** | 1.0.0 | **Tirys Verstärker**: alle Totems auf **einer Taste** (Makro „TotemTakt“, /castsequence). Jeder Druck = nächstes Totem, Druck in der Abklingzeit zählt nicht. Außerhalb des Kampfes **fehlende/auslaufende/zu weit weg zuerst** (Buff-Check), frisch gestellte hinten; im Kampf eingefroren (Neustart 8 s/15 s/nie). Fenster `/takt`: 4 Element-Kugeln, Klick = Totem wählen/aus, Ziehen = Reihenfolge | **Spieltest offen** (Checkliste `INGAME-TEST.md`, Teil TotemTakt) |
| **ProcAlarm** | 2.1.0 | **für Tirys Kollegen (Hexer)**: Schattentrance (17941) über Blizzard-Aura-Slot, auch im Kampf; violetter Glow + Blinken, ohne Ton, ohne grünen Ring | ausgeliefert, **Kampftest offen** |
| **Schlaghagel** | 1.0.0 | **Tirys Verstärker**: Schlaghagel-Buff (16257) über Blizzard-Aura-Slot, auch im Kampf; Ladungen groß, Restzeit, türkiser Glow + Blinken wie ProcAlarm, ohne Ton; `/hagel` | ausgeliefert, **Kampftest offen** |
| **EnhanceHUD** | 1.2.0 | Verstärker-Schamanen-HUD (Frost/Feuer-Design) | ausgeliefert |
| **Blitzschild** | 1.2.0 | Blitzschlagschild Ladungen/Zeit | im Kampf nicht möglich (secret values) → Cooldown-Manager „Verfolgte Leisten“ + WA nur außerhalb des Kampfes |
| **MiniPost** | – | Post-Symbol unter der Uhr, andere Minimap-Knöpfe unsichtbar | ausgeliefert, Test offen |
| **ChatHoch** | 1.4.0 | Chat höher, Reiter bündig (ClampRectInsets von ChatFrame1) | ausgeliefert; Tiry hatte noch 1.3.0 geladen |

## LevelPilot 5.1.0 – Strahl ruht im Questgebiet (11.11., Tirys Wunsch)
Tiry: „sobald ich das Questgebiet betreten habe, soll der Strahl weggehen und erst wiederkommen, wenn ich es verlassen
habe – im Gebiet springt er dauernd hin und her.“ Ursache: Erledigen-Ziel = Mitte der nächsten Gegnergruppe
(`objectiveTarget`, 55-m-Gruppe um den nächsten Spawn), alle 1,5 s neu → beim Laufen zwischen den Gruppen wandert die
Mitte, `SetBlizzPin` versetzt den Wegpunkt, Strahl und Kartenpin springen mit.
- **Questgebiet** (`R.InArea`, Route.lua) = Spawnpunkte der noch offenen Ziele (Gegner, Objekte, Beute-Quellen; Orte
  „event“ ausgenommen – dort führt der Strahl bis auf den Punkt) bzw. bei Grind-Schritten die Spawns des Grind-Gegners.
  **Drin ab 60 m** zum nächsten Spawn, **draußen erst ab 120 m** (`R.AREA_IN/AREA_OUT`, Puffer gegen Flackern am Rand).
- Gilt für Erledigen, Abgabe mit noch offener Quest, Grind und von Hand verfolgte Quests (Blizzard-Questverfolgung),
  im Questmodus für Quests ohne Abgabe-Status. Nicht für Questgeber/Abgabe-NPC, Flugmeister, `/way`-Punkte.
- Drin: Strahl, Symbol, Pinpoint und Rand-Navigator blenden in 0,3 s aus; einmal der Ankunfts-Ton (statt zufällig an der
  wandernden Mitte); **Kartenpin bleibt stehen** (je Ziel einmal gesetzt). Raus: Strahl wächst weich wieder ein, kein
  „neues Ziel“-Ton. Folgequest am selben Ort: bleibt sofort weg (kein Aufblitzen). Quest fertig → Strahl zur Abgabe sofort da.
- Pfeil bewusst unverändert (zeigt weiter zur nächsten Gruppe) – Tiry hat nur den Strahl genannt.
- Prüfung mit echten Daten (`full.json`, beide Routen): 102 Erledigen-Schritte mit Spawn-Daten, 65 davon ein
  zusammenhängendes Gebiet, 93 höchstens 3 Teilgebiete; Median-Abstand zwischen Nachbar-Spawns 62 m. Zwei Spawns
  ≤ 240 m auseinander → der Weg dazwischen bleibt im Gebiet. Ohne Spawn-Daten (Quests 882, 1535) bleibt alles wie bisher.
- Tests: `tests/v4.lua` Abschnitt J (21 Prüfungen; mit dem alten Code fallen die Kern-Prüfungen durch).
- Technik: Hauptteil von `LevelPilot.lua` hatte genau 200 Locals (Lua-5.1-Grenze) → Zustand liegt in `RT.area`.

## LevelPilot 5.0.2 – Prüfrunde 2 (11.11.)
Tirys Auftrag: nach Runde 1 „nochmal komplett alles prüfen“. Vorgehen: **Zufalls-Stresstest** der Plan-Engine
(`tests/fuzz.lua`, 12 × 1500 chaotische Aktionen auf beiden Routen), **Design-Szenarien** im strengen Forever-Nachbau
(Held-Karte „WARTET“, Questlog-Check ohne Route) und **zwei unabhängige Prüfer** nur auf die Änderungen von Runde 1
(Fenster/Ereignisse; Plan-Engine + Wegenetz + Flug). Alle Funde nachgestellt; jeder Fix hat einen Test, der an 5.0.1
scheitert und jetzt besteht (`plan.lua` G, neu `tests/regress.lua` mit 7 Fällen aus den echten Routen/dem echten Netz).

| Fund (nachgestellt) | Schwere | Fix |
|---|---|---|
| **Wegenetz:** Liegt ein Splitter (Dach, Fels, Mulde) dem Spieler am nächsten, warf die Klippen-Regel aus 5.0.1 das ganze Hauptnetz weg → Pfeil wieder Luftlinie (Östl. Königreiche 178 / Kalimdor 150 von je ~1480 Stichproben, auch an 2 Flugmeistern) | hoch | Bezug ist der nächste Knoten des **größten** Teilnetzes in Reichweite → 0 Verluste, Klippen-Fälle bleiben gelöst |
| **Kettenquests:** Lief der erste Plan-Durchlauf beim Login, bevor Questie geladen war, merkte sich der Titel-Abgleich den Namen ohne Doppelnamen-Prüfung → bei „Battle of Hillsbrad“ (527) galten die Folgeteile mit gleichem Titel als im Log, Erledigen/Abgeben von Teil 1 als erledigt | hoch | Titel erst merken, wenn die Doppelnamen-Prüfung lief (auch leere Titel nie merken) |
| **Hub-Wiederbesuch:** Eine Quest vom 1. Besuch (Trollbane, Grom'gol) blockierte beim 2. Besuch jeden Sprung → Plan hing in Arathi fest | mittel | „Heim-Regel“ zählt nur Quests aus dem aktuellen Abschnitt |
| **Quest per Gegenstand** (7 Schritte, z. B. Washte Pawne, Assassination Plot): Annehmen-Schritt ohne Koordinaten → Zeiger klebte für immer, wenn der Gegenstand nicht fällt | mittel | Bei Annehmen ohne Koordinaten zählen Beweise wieder (Erledigen ohne Koordinaten bleibt ohne Sprung) |
| **Einstieg aus dem Log:** 3 alte Brachland-Reste überstimmten 2 aktuelle Eschental-Quests → Einstieg bei Schritt 16 statt 114 | mittel | Log-Einstieg nimmt wieder den spätesten Abschnitt; **neu:** einzelne Quests > 3 Stufen über dir zählen nicht (sonst Einstieg 174 statt 8 – Fall `einstieg_ausreisser`) |
| **Pfeil-Hinweise** „über Großer Aufzug / Talondeep-Pfad“ fielen weg, weil die Pfeil-Glättung die Knoten vorher abschnitt (Donnerfels-Aufzug 0 von 5 Stellen) | mittel | Hinweise prüfen die ungekürzte Folge → 5/5; Orte 30 % → 78 %, Aufzüge 22 → 30 von 55 |
| Abgabe blieb offen, wenn du das Erledigen selbst übersprungen hast, während der Questlog-Check zum Löschen riet (Stresstest: 127 Widersprüche in 5.0.0) | mittel | Abgabe folgt dem übersprungenen Erledigen → 0 |
| Questlog-Check ohne passende Route (z. B. ab 40) gab Plan-Rat aus einem leeren Plan | niedrig | nur echte Platzzahl + „Kein Plan aktiv“ + welche Stufen die Routen abdecken; Farb-Legende aus |
| Questfenster ohne Quest-ID: Hinweis „nicht in deinem Plan“ nur einmal je Sitzung (alle teilten Schlüssel 0) | niedrig | Hinweis je Titel |
| Questlog-Check rechnete alle 2 s weiter, obwohl das Fenster ausgeblendet war | Tempo | nur, wenn Band oder Panel sichtbar sind; beim Einblenden sofort frisch |
| Strahl: Refresh und Cache-Ablauf im selben Bild → Ziel-Infos 0,24 s veraltet | niedrig | nach jedem Refresh im nächsten Bild frisch |
| Kurzweg-Speicher der Klippen-Prüfung ohne Deckel (bis 16 MB bei langer Sitzung) | Speicher | gedeckelt (1500 Knoten ≈ 2,5 MB, Neuberechnung < 1 ms) |
| Held-Karte „WARTET“: Unterzeile lief über den Kartenrand (349 > 236 px) | Design | „Nebenbei“ entfällt beim Warten, Text gekürzt |
| Absicherung | – | erzwungener Refresh am NPC per `pcall`; Symbol über dem Strahl nur bei Typwechsel neu gesetzt |

**Zahlen (Nachbau, Lua 5.1 ohne JIT):** Durchlauf 22–30 / 30–40 / Hexer: Einstieg nach jedem Schritt weiter **100 %
exakt** (180/180, 219/219, 175/175), **0 falsche Lösch-Tipps** in 598 Checks, R.Plan Ø 0,6–0,7 ms (max 1,6 ms), Stresstest
18 000 Aktionen 0 Fehler, Wegenetz je Sekunde Ø 1,0 ms, Kaltstart 53 ms. Tests: `plan.lua` 76 Prüfungen, `regress.lua` 7;
Suite **27/27** grün.
**Bewusst nicht geändert:** Pfeil-Glättung (60 yd) und Vorausschau (30 yd) haben verschiedene Toleranzen – der Pfeil kann
einen Knoten 30–60 yd neben der Linie auslassen (gewollt: weniger Zickzack). `otherRoute` kennt nur Routen mit Fraktion
(beide Routen sind Horde). Taxi-Daten Östl. Königreiche: Knoten 24, 85–87 ohne Verbindung, 36 ohne Position – nicht auf
den Routen. Höhen im Wegenetz weiter offen (s. 5.0.1).

## LevelPilot 5.0.1 – Komplett-Prüfung (11.11.)
Tirys Auftrag: „alles fertig machen, dann komplett prüfen – Fehler, Korrektheit, Effizienz, Schnelligkeit, Design –
verbessern, nochmal prüfen.“ Vorgehen: kompletter **Durchlauf beider Routen** (`tests/playthrough.lua`: jeder Schritt
bis zum Ende, Einstiegs-Probe nach jedem Schritt, Questlog-Check nach jedem Schritt, 2 Stufen hinter Plan, Hexenmeister)
+ drei unabhängige Code-Prüfungen (Plan-Engine, Fenster/Ereignisse, Wegenetz/Flug). **Jeder Fund nachgestellt**, jeder
Fix hat einen Test, der mit dem alten Code fehlschlägt und mit dem neuen besteht.

| Fund (nachgestellt) | Schwere | Fix |
|---|---|---|
| Hexenmeister: Schritt 1 (Schamanen-Lehrer) blieb ewig offen → Plan hing | hoch | Klassenschritt einer anderen Klasse = „übersprungen“ |
| Im Hub nimmt Auto-Annehmen eine spätere Hub-Quest mit → Plan sprang nach 3 s weg, eben angenommene Quests „verpasst“ + Lösch-Tipp | hoch | Kein Beweis an einem Ort, an dem du Quests angenommen hast, die der Plan vorher noch braucht; Ziel ohne Koordinaten = kein Sprung |
| Laufweg „durch die Klippe“: Punkt oben hing am Knoten unten (Arathi 190 statt 888 yd, Tausend Nadeln 282 statt > 8000 yd) | hoch | Anbindung nur an Knoten, die vom nächsten Knoten aus auf ≤ 1,3 × Luftlinie erreichbar sind |
| Flug-Rat über nicht verbundene Flugpunkte (Grom'gol → Hammerfall ohne Kargath) | hoch | Beide im Flugnetz, keine Verbindung → kein Flug |
| Questlog-Check riet, eine graue Quest zu löschen, deren Abgabe der Plan noch braucht (5763) | mittel | Plan schlägt Grau |
| Zeiger klebte auf einer verpassten Abgabe → Auto-Annehmen-Fenster, Band, Platzrechnung hingen fest | mittel | Zeiger läuft über Verpasstes weiter |
| Einstieg im Hub beim 1. Besuch mit einer Quest vom 2. Besuch → ganze Abschnitte „verpasst“ | mittel | Mehrheit der Abschnitte zählt, bei Gleichstand der zur Stufe passende |
| Spieler auf abgetrenntem Teilnetz → ~270 ms Rechnen je Sekunde | mittel | Teilnetze beim Laden markiert, Suche bricht sofort ab (jetzt ~2 ms) |
| Pfeil-Ziel ging bei Abgaben ohne Questziel-Daten jedes 2. Mal verloren | mittel | Cache-Treffer ohne Ziel → Abgabe-NPC |
| Plan + Questlog-Check jede Sekunde **und** bei jedem Questlog-Ereignis (Looten = Schwall) | mittel | Ereignisse gebündelt (≤ 1 Neuaufbau je 0,2 s, am NPC sofort), Questlog-Check ≤ 2/s, Kartenliste nur im Quest-Modus |
| Ziel + Flug-Rat für Strahl/Pfeil jedes Frame neu, Symbol jedes Frame gesetzt | mittel | Ziel-Cache 0,25 s (Refresh leert ihn), Symbol nur bei Typwechsel |
| Questlog-Check im Quest-Modus/ohne Route nie aktualisiert | mittel | aktualisiert, solange das Panel offen ist |
| `/lp reset` ließ Speed/Grau-Grenze der Engine auf altem Stand | mittel | Engine wird mitgesetzt |
| Klick aufs Plan-Band (`/lp einstieg`) nicht umkehrbar | mittel | Zeiger landet in der Rücknahme-Liste |
| Ruhestein-Zauber nie erkannt (Ereignis-Parameter um 1 verschoben) | niedrig | `unit, castGUID, spellID` |
| Toast-Flut beim ersten Login möglich | niedrig | erstes Questlog-Ereignis nach Login nur merken |
| `/lp neu` löschte die Rücknahme-Liste aller Routen | niedrig | nur die eigene Route |
| Questfenster ohne Quest-ID nahm im Routen-Modus alles an | niedrig | Abgleich über den Titel |
| Folgequest am selben NPC als „NICHT MEHR DA“ übersprungen, bevor die Vorquest abgegeben war | niedrig | Angebots-Prüfung erst, wenn der NPC nichts mehr zum Abgeben hat |
| `/lp log` bei ausgeblendetem Fenster unsichtbar | niedrig | Fenster wird mit eingeblendet |
| Spätere Quest ohne Vorquest „wartet auf Stufe“ statt „passt nicht“ | niedrig | Vorquest-Prüfung vor der Stufe |
| Quests der vorigen Route als „später im Plan“ behalten | niedrig | nur spätere Routen; sonst „aus der vorigen Route“ |
| Beweis-Wartezeit lief im Flug weiter → Sprung im ersten Tick nach der Landung | niedrig | Wartezeit startet nach Flug/Haltezeit neu |
| Aufzug mit zwei Anschlüssen (Unterstadt) kannte nur einen | niedrig | Verbindungen je Kante |
| Pfeil zeigte im offenen Gelände öfter seitlich auf einen Netzknoten | niedrig | ersten Knoten weglassen, wenn der Umweg kaum etwas bringt (Brachland: > 45° von 31 auf 8 Fälle) |
| Ruhestein-Rat in Grom'gol nie (Ortsname ≠ Flugmeister-Name) | niedrig | Ortsname vor dem Komma wird im Gasthaus-Ort gesucht |
| Questnamen-Abgleich jede Sekunde neu (122 Abfragen) | Tempo | dauerhaft gemerkt |

**Design:** wartende Schritte in der Held-Karte als „WARTET · AB STUFE n“ (statt wie ein normales Ziel), geplante
Folge-Schritte in der Liste mit Pille **„geplant“**.
**Zahlen (Nachbau, Lua 5.1 ohne JIT):** Durchlauf 22–30 / 30–40 / Hexer: Einstieg nach jedem Schritt **100 % exakt**
(180/180, 219/219, 175/175), **0 falsche Lösch-Tipps** in 598 Questlog-Checks, R.Plan Ø 0,5–0,7 ms (max 1,4 ms),
Questlog-Check max 0,2 ms, Wegenetz je Sekunde Ø 0,9 ms. Tests: `plan.lua` 72, `playthrough.lua` 17, `travel2.lua` 7
Prüfungen; Suite 25/25 grün.
**Offen (bewusst):** Das Wegenetz hat keine Höhen – die Klippen-Regel fängt die Fälle ab, die das Netz selbst kennt;
ein Punkt genau zwischen zwei Ebenen kann weiter falsch angebunden werden. Echte Lösung: Höhe je Knoten aus
`navmesh.py` + Spieler-Höhe (im Spiel prüfen, ob `UnitPosition` in Forever eine Höhe liefert).

## LevelPilot 5.0 – fester Plan, Einstieg, Questlog-Check (11.11.)
Tirys Kritik an 4.2: „fehlt noch immer die Logik“, „rafft nicht, wie der aktuelle Stand von einem selber ist und was
man dann am besten macht“, Wunsch: **Empfehlung, welche Quests aus dem Log raus sollen**, „ein **fester Plan**, in den
man da einspringt, wo er vorher gesehen hat“, „komplett überarbeiten“ + etwas mehr Style. Ursachen und Lösungen:

| Ursache (geprüft) | Lösung |
|---|---|
| 4.x wählte das Ziel **jede Sekunde neu** (nächster offener Schritt + nahe Extras mit Aufschlag) → Ziel sprang, Reihenfolge nicht nachvollziehbar | **Plan-Engine 5** (`Route.lua`): gespeicherter **Zeiger** je Route (`DB.plan`), läuft nur **vorwärts** über Erledigtes; keine Umsortierung nach Entfernung. Offenes hinter dem Zeiger = „verpasst“ |
| Kein Begriff vom eigenen Stand: wer mitten im Gebiet einloggt, bekam den Anfang der Route oder springende Ziele | **Einstieg** (`R.Entry`): 1. angenommene Plan-Quests, deren Geber bei dir steht (≤ 600 yd) 2. Abgaben bei dir (frühester Abschnitt) 3. frisch angenommen/abgegeben (2 h) 4. angenommene Quests im Log 5. Abgaben im Log 6. Stufe. Wartet, bis Questlog + Questie bereit sind (max. 20 s). Meldung „EINSTIEG“ + Chat mit Grund |
| Wer vom Plan abweicht, wurde zurückgeschickt | **Sprung** nur mit Beweis: Plan-Ziel > 900 yd weg **und** ein späterer Plan-Schritt (Quest angenommen bzw. frisch abgegeben) ≤ 450 yd bei dir, 3 s lang, nicht im Flug. Umkehrbar mit `/lp zurueck` (danach 30 Min. Sperre) |
| Questlog voll mit Altlasten, nichts sagte, was raus kann | **Questlog-Check** (`R.LogAdvice` + Panel): löschen / abgeben / prüfen / behalten mit Grund, Umweg-Rechnung gegen dein XP-Tempo, Platzbedarf der nächsten 80 Schritte („Log wird voll“), **LÖSCHEN** öffnet Blizzards Abbrechen-Dialog (`QuestMapQuestOptions_AbandonQuest`, Rückfall `SetAbandonQuest` + Popup) |
| Auto-Annehmen nahm alles, was irgendwo in der Route stand | nur Quests im Fenster **Zeiger … +60 Schritte** (`R.Wants`) |

**Einstiegs-Fehlgriff im Nachbau gefunden und behoben:** Eine in Sonnenfels angenommene Quest, die der Plan erst
100 Schritte später in Camp Taurajo abgibt, zog den Einstieg dorthin (Schritt 106 statt 74). Abgaben zählen jetzt nur
im selben Abschnitt mit; Testfall in `tests/plan.lua`.
**Fraktion:** `UnitFactionGroup` lieferte den **übersetzten** Namen statt „Horde“/„Alliance“ – auf deutschem Client
zufällig gleich, jetzt sauber das englische Kürzel.

**Oberfläche 5.0:** Plan-Band unter den Kennzahlen (Abschnitt x/y, Gebiet · Hub, Schritt n/m, Kapsel je Abschnitt
mit Verlauf, pulsierender Leuchtpunkt; Klick = neuer Einstieg), zwei Glas-Pillen (Stufe gegen Plan, Log x/25 mit
Handlungsbedarf), Held-Karte „ANNEHMEN · SCHRITT 74“, Liste in Plan-Reihenfolge inkl. **geplanter** Folge-Schritte
(Erledigen/Abgeben von Quests, die gleich erst angenommen werden), Questlog-Panel (rote Verlaufs-Knöpfe, Füllstand,
Legende). Neue Befehle: `/lp einstieg`, `/lp schritt <Nr>`, `/lp zurueck`, `/lp log`, `/lp plan`.
Routendateien tragen jetzt Abschnitte (`segs`, `seg` je Schritt) und ein Modell-Tempo (`xpm`) – `tools/build.py`.

**Fenster-Vorschau ohne Spiel (neu):** `lua5.1 tests/lp_layout.lua <ordner>` lädt LevelPilot im strengen
Forever-Nachbau (`tests/wow_mock.lua`, nur Widget-Methoden aus Blizzards Forever-API), Szenario Stufe 24 in Sonnenfels
mit Altlasten im Log, prüft Überlappungen/abgeschnittene Texte und exportiert Zeichendaten; `python3 -I
tools/render_pages.py <ordner>` zeichnet sie (Arial-Narrow-Maße, 9-Slice, Kreis-Maske, Drehung jetzt nachgebildet).
Bilder: `previews/LevelPilot_5.0_*.png`. Läuft in `tools/test_all.sh` mit.

**Nur im Spiel prüfbar:** Einstieg mit echten Questie-Daten, Sprung-Schwellen im Spielgefühl, Abbrechen-Dialog und
`GetMaxNumQuestsCanAccept`/`GetQuestTagInfo` in Forever (Rückfälle eingebaut), Schriftbreiten im Client.

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
1. Tirys Spieltest-Rückmeldung zu LevelPilot 5.1.0 abwarten (Einstieg-Schrittnummer, Sprung, Questlog-Check, Hexenmeister-Start, **Strahl im Questgebiet: Radien 60/120 m passend?**) und gezielt nachbessern.
2. **Routen 40–50, 50–60** mit derselben Kette (`make_route.py` neuen Schlüssel in `ROUTES` + Abschnitte).
3. Sobald Questie die neuen Forever-Quests führt (IDs 9xxxx): Pool neu rechnen – könnte den Grind-Anteil deutlich senken.
4. ProcAlarm nach `/proc diag`-Screenshot anpassen; ChatHoch 1.4.0 / MiniPost-Rückmeldung.
5. Tiry's Zentrale 6.2: Spieltest-Rückmeldung abwarten (Komplett-Scan, Absatz-Werte, Sparziel, Unterwegs-Gold, echte
   Reitkosten am Trainer, Anzahlung bei offenem AH). Danach evtl. Writs als Ware (AH-Preis vs. Kosten) und ein voller
   Gebiets-Index für Unterwegs-Gold (heute nur die Top-4-Stellen je Stufe aus `Data_Spots.lua`).

## Tiry's Zentrale 6.2.1 (11.11., Spieltest-Fix)
Tiry: „Rezepte suchen → Auctionator lädt nur“, „im AH laggt es brutal, egal ob er scannt oder nicht“, Chat voller
„Schnäppchen-Scan“-Zeilen. Ursachen (belegt mit Auctionators FullScanFrame-Code und Messung im Nachbau, 30.000 Angebote):
- `REPLICATE_ITEM_LIST_UPDATE` feuert wiederholt (Auctionator meldet sich deshalb nach der ersten Meldung ab). Die
  Zentrale las bei jeder Meldung neu (`ns.Debounce` ist eine Drossel, kein Entprellen). Fix: `hooksecurefunc(C_AuctionHouse,
  "ReplicateItems")` schaltet scharf, gelesen wird genau einmal (`D.WantsReplicate`), AH zu = unscharf.
- Snipe.Finish rechnete jeden Markt-Kandidaten genau (Hänger 80 ms) → Obergrenze + nur Top-Kandidaten.
- `exactDeposit` fragte Blizzard bei jedem Bildaufbau für hunderte Items und legte jedes Mal eine neue Tabelle an →
  Merkzettel je AH-Besuch (`M.ResetDepositMemo`).
- Neuzeichnen: `onItemData` nur noch für Platzhalter-Items, am AH höchstens 1×/s (`UI.RefreshDelay`), RecordAll ≤ 1×/min.
- Suche: `M.SearchNow` hält die Unterboten-Abfragen an (`AW.Pause`) und wartet, solange Auctionator scannt (`M.FullScanBusy`).
- Ob die hängende Auctionator-Suche damit weg ist, zeigt nur der Spieltest (Auctionators Such-Code war hier nicht
  einsehbar; die Ursache – Rechenlast + Anfragen der Zentrale während der Suche – ist abgestellt).
- Tests: `spec/zentrale_pruefung_spec.lua` A1–A5 (8 von 9 vorher rot); Nachbau kennt jetzt `hooksecurefunc`,
  `C_AuctionHouse.ReplicateItems`, `C_Item.IsItemDataCachedByID` (alle in Forevers API-Doku belegt).

## Tiry's Zentrale 6.2 (11.11.)
Wunsch: „dieselbe Anstrengung wie beim LevelPilot“ – kompletter Plan über die Zentrale: Effizienz, Design, alles
funktioniert, weitere sinnvolle gekoppelte Funktionen, komplett prüfen, was hergestellt wird und was Gold bringt.
- Prüfrunde 1: 4 unabhängige Prüfer (Gold-Rechnung, Markt-Datenfluss, UI, Spieldaten). Jeder Fund als Test in
  `spec/zentrale_pruefung_spec.lua` (F1–F12, M1–M8, U5/U8/U13, D1–D8), vorher auf dem alten Stand rot.
- Neu: `Goal.lua` (Sparziel), `ZoneGold.lua` (Unterwegs-Gold, liest LevelPilot nur), `UI/HomeCards.lua`,
  `Data_RecipeExtra.lua` (erzeugt: Stationen, Zufallsmengen, Rezept-Herkunft), `Data_Hotfix.lua` (von Hand, mit Quelle).
- Gebietsnamen: `ns.ZONE_NAMES` sind die Forever-deDE-Namen aus der DB2 (Ashenvale, Marschen von Dustwallow …).
  LevelPilot schreibt Eschental/Düstermarschen/Hügelland (eigene Schreibweise) → `ZoneGold.ALIAS`.
- Farm-Daten: `tools/export_spawns.lua` + `gen_spots.py --keep-npc` (Gegner-Stellen bleiben, weil die aktuelle
  QuestieDB viele Gegner mit Level 1 führt, z. B. Lavakrebs).
- Prüfrunde 2: 2 weitere Prüfer (Code, Gold-Rechnung/Texte) + Blizzard-Hotfix-Artikel wörtlich nachgelesen. 20 Funde,
  Tests P1–P7 in derselben Spec (Suche, ZoneGold, Sparziel, Hotfixes, Skill-Plan, Preis-Tooltip/Neu-Einstellen,
  Goldbarren), alle vorher rot. Wichtig für spätere Arbeit:
  - `ns.HOTFIX` (`Data_Hotfix.lua`: `recipes`, `sell`, `bind`) wirkt in `Database.build`, `ns.Item`, Snipe und
    `Recipes.Load` – neue Hotfixes nur dort eintragen.
  - `ns.NormNumber` (Shopping.lua): „1.200“ = 1200, „1,5“ = 1.5 – für jede Zahleneingabe benutzen.
  - Suche über sortierten Index (`Database.lua`, `searchIndex`), einmalig ~1,5 MB.
  - `ns.GATHER_SKILL` (Data_Farm.lua) + `ns.Skin` begrenzen Unterwegs-Gold auf den eigenen Skill.
  - `gen_spots.py` liest `SPECIAL_ITEMS` aus Data_Farm und hängt je Spezial-Stelle die echte Beute (`loot`) an.
  - Reitkosten: Guides (Method, timesaver) 100 g inkl. Reittier ab 40; Warcraft Tavern nennt 20 g extra fürs Reittier –
    Tirys Wert am Trainer abwarten.

## Tiry's Zentrale 6.0 (10.11.)
Wünsche: Logik neu durchdacht, Forever-Goldguides/Foren, „chicer als LevelPilot“, moderne leichte Menüs, Absatz sehen
(„Kleinvieh macht auch Mist“), viele Goldmacher-Funktionen, **ein Scan aktualisiert alle Reiter**.
- Recherche: `docs/GOLD-RECHERCHE-2026-11.md` (Anzahlung 1 Silber – überholt: seit Hotfix 10.11. wieder 1 Kupfer; Kupfer-Fehler bei Ausrüstung, Writs, Raid-Start 09.12.).
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
