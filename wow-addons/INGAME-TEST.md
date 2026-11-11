# Ingame-Test – Tiry's Zentrale 6.2.0

Zum Abhaken im Spiel. Vorher einmal eingeben:
```
/console scriptErrors 1
/reload
```
Bei jeder roten Fehlermeldung: Screenshot machen und den Punkt notieren.
Zeigt dein Client keine Fehlerfenster: Tiry's Zentrale schreibt eigene Fehler rot in den Chat. `/tz fehler` listet alle gespeicherten Fehler, `/tz fehlertest` prüft, ob die Anzeige funktioniert.

## Start
- [ ] Im Charakterauswahl-Bildschirm unter „AddOns“: **Tiry's Zentrale** ist aktiviert und nicht als „veraltet“ markiert
- [ ] Nach dem Einloggen kommt im Chat die Willkommensmeldung (nur beim allerersten Mal)
- [ ] `/tz` öffnet das Fenster, und der **Einsteiger-Assistent** erscheint (nur beim ersten Mal)
- [ ] Assistent: Schritt 1 zeigt Fraktion, Level und Berufe richtig, Schritt 2 den Auctionator-Status, Schritt 3 einen Knopf. „Überspringen“ schließt ihn.
- [ ] ESC schließt das Fenster
- [ ] Minikarten-Münze: Linksklick öffnet, Rechtsklick zeigt „Taschen & Händler“, Ziehen verschiebt sie
- [ ] Addon-Fach der Minikarte: Eintrag „Tiry's Zentrale“ vorhanden

## Menü und Seiten (jede einmal anklicken)
- [ ] **Dock oben:** fünf runde Knöpfe Start · Herstellen · Farmen · Handel · Mein Gold, jeweils mit **Blizzard-Symbol** (keine leeren Kreise); der aktive leuchtet
- [ ] **Start:** Goldplan mit Gold-Kreislauf (der orange Schritt-Knopf tut etwas Sinnvolles), Goldwege (19)
- [ ] **Herstellen:** Craft-Planer, Was lernen? (Skill-Plan, wenn du einen Herstellungsberuf hast), Ergebnis
- [ ] **Farmen:** Farm-Guide (Klick auf einen Spot setzt einen Wegpunkt mit Pfeil), Kürschner, Farm-Session
- [ ] **Handel:** Meine Auktionen, Preise (Spalte „Pro Tag“), Preisalarm, Taschen & Händler, Item-Suche
- [ ] **Mein Gold:** Goldtagebuch, Verkaufsbuch (Kennzahlen als Glas-Pillen)
- [ ] **? oben rechts:** AH-Schule, Glossar · **Zahnrad:** Einstellungen in Gruppen; Schalter umlegen, Regler-× setzt zurück, „Alle Einstellungen auf Standard“ fragt erst nach
- [ ] Glas-Flächen, Neon-Verläufe und Leuchtpunkte sehen sauber aus (keine eckigen Kanten, keine Pixel-Treppen)
- [ ] Horde-Motive dezent im Hintergrund. Fehlen sie, ist das kein Fehler (Atlas nur im Code der Charaktererstellung).
- [ ] Schrift überall gut lesbar, nichts überlappt, nichts ragt aus Pillen oder Karten

## Ein Scan für alle Reiter (neu in 6.0)
- [ ] AH öffnen → „AH scannen“: Chat meldet **„Komplett-Scan läuft … für alle Reiter auf einmal“**. Fehlt der Komplett-Scan in deiner Auctionator-Version, kommt „Schnell-Scan läuft“ – bitte melden, welcher.
- [ ] Nach dem Scan: „Scan fertig! Alle Reiter rechnen jetzt mit den neuen Preisen.“ – Preise, Craft-Planer, Meine Auktionen, Schnäppchen ändern sich **ohne** extra Suche
- [ ] Sofort nochmal „AH scannen“: Meldung, dass der Komplett-Scan nur alle 15 Minuten geht (dann Schnell-Scan)
- [ ] 15 Min. bis 12 Std. später erneut scannen → im Item-Tooltip steht „Absatz: … ~X/Tag verkauft · Y im Angebot“
- [ ] `/tz schnapp` öffnet Handel → Preise → Schnäppchen; Klick sucht das Item in Auctionator, **kauft nichts**
- [ ] Meine Auktionen → Neu einstellen: Menge „Nur N einstellen“, Ausrüstung in **ganzen Silbern**, nie unter „Nicht unter“
- [ ] Item-Tooltip „Nicht unter“ = derselbe Wert wie im Craft-Planer (Schritt 4) und in Meine Auktionen
- [ ] Einkaufsfenster: Tooltip eines Materials zeigt „Kaufen bis: …“

## Item-Tooltip (neu in 6.1)
- [ ] Maus über ein gescanntes Material (z. B. Makelloses Leder): Block „Tiry's Zentrale“ mit Logo, zweispaltig, Werte rechtsbündig
- [ ] Leuchtpunkte farbig (grün/türkis/blau/orange), Trennlinien als Neon-Verlauf, Preis-Schieber mit farbigem Punkt
- [ ] Nach ein paar Scan-Tagen: Marktwert, Durchschnitt, Min · Max, Urteil günstig/normal/teuer
- [ ] Werden Punkte oder Linien weiß statt farbig angezeigt: Screenshot schicken (dann färbt dein Client Inline-Grafiken nicht)

## Neu in 6.2
**Sparziel (Startseite)**
- [ ] Unter Stufe 40 steht „Reiten lernen – Vorschlag“ mit 100 Gold; Balken = Gold in der Tasche + Post + halber Auktionswert
- [ ] **Ab Stufe 40 ohne Reiten** bleibt „Reiten lernen“ stehen; nach dem Lernen (und ab 60) wechselt der Vorschlag auf „Schnelles Reiten“ mit 1.200 Gold. Falls nicht: `/run print(C_SpellBook.IsSpellKnown(33388))` notieren: ______
- [ ] Eigenes Ziel „1.200“ eintippen → Ziel 1.200 Gold (nicht 1 Gold); Unsinn eintippen → Hinweis nennt Gold-Beispiele
- [ ] Liegt genug Gold in der Post: „Post abholen – dann geschafft!“; „alle Charaktere“ erscheint, sobald ein Twink Gold hat
- [ ] „+“/„−“ ändern das Ziel in 10/25/100-Gold-Schritten, „Anderes Ziel“ schaltet durch, „×“ blendet es aus (Klick auf die Leiste holt es zurück)
- [ ] „Schneller ans Ziel“: Klick auf eine Pille öffnet die richtige Seite; Beträge passen ungefähr zum Taschen-Check bzw. zur Craft-Liste
- [ ] Nach 1–2 Spieltagen erscheint „ca. N Spieltage · Ø X/Tag“
- [ ] Ziel klein einstellen (z. B. 1 Gold unter deinem Gold): Chat „Sparziel erreicht“ + Ton, nur einmal
- [ ] **Am Reitlehrer den echten Preis notieren** (Guides: 100 g inkl. Reittier ab 40, 1.000 g + 200 g ab 60): ______

**Unterwegs-Gold**
- [ ] Startseite zeigt „Unterwegs-Gold: <dein Gebiet>“ mit deinen Sammel-Materialien und Preisen; „Hinführen“ setzt einen Kartenpunkt
- [ ] Mit niedrigem Sammel-Skill: nur Kräuter/Erze, die du schon sammeln kannst; Tooltip „ab Skill X: …“ nennt das wertvollere. Stimmt die Grenze mit dem Spiel überein (Erz/Kraut wird rot)? ______
- [ ] Gebiet wechseln bei offener Startseite: Karte springt auf das neue Gebiet; in einer Hauptstadt steht der Stadtname
- [ ] Mit LevelPilot: „Als Nächstes auf deiner Route“ nennt die nächsten Gebiete deiner Route
- [ ] Gebiet wechseln: einmal Chat-Hinweis „Unterwegs-Gold in …“ (nicht bei jedem Wechsel erneut); Einstellungen → „Unterwegs-Gold im Chat“ schaltet ihn ab
- [ ] In Höhlen/Unterkarten zeigt die Karte das übergeordnete Gebiet

**Rezepte, Stationen, Hotfixes**
- [ ] Craft-Planer / „Was lernen?“: ein Leder-Rezept mit Gerbrahmen zeigt „braucht Gerbrahmen (Lager-Station am Lagerfeuer …)“
- [ ] Seelengebundenes Rezept (z. B. Rezept: Schattenöl): „Rezept nur selbst holen – beim Händler“, Klick sucht NICHT im AH
- [ ] Einstellungen → „Einstellgebühr je Angebot“ steht auf **1 Kupfer** (auch nach „Zurücksetzen“)
- [ ] Tooltip Eisengranate / Schwaches Arkanelixier / Milde Gewürze: Händlerpreis 1 s 25 c / 5 c / 1 c (Hotfix 10.11. bzw. 05.11.). Meldet das Spiel selbst schon den neuen Preis? ______
- [ ] Suche: schnell tippen („kupfer“) – kein Ruckeln
- [ ] Neu einstellen, wenn schon genug von dir im AH liegt: „Liegt schon genug von dir im AH …“ statt „Nur 0“
- [ ] Bei offenem AH: Taschen-Item einstellen – Blizzards Anzahlung notieren (für die Schätzung ohne offenes AH): Item ______ Anzahlung ______
- [ ] Händler mit Rezepten: kein Flip-Hinweis für seelengebundene Rezepte
- [ ] `/tz KÜRSCHNER` (Großbuchstaben) öffnet die Kürschner-Seite

## Fenster
- [ ] Unten rechts am Griff ziehen → Fenster wird größer oder kleiner
- [ ] Fenster nah an einen Bildschirmrand ziehen → rastet dort ein
- [ ] Suche (Lupe oben rechts): „leder“ eintippen → Items, Rezepte, Begriffe. Enter öffnet den ersten Treffer.
- [ ] Optionen > Tastaturbelegung: Abschnitt „Tiry's Zentrale“ mit 4 Einträgen. Einen belegen und testen.

## Händler
- [ ] Händler öffnen: grauer Schrott wird verkauft (nur wenn Blizzards Knopf „Schrott verkaufen“ da ist), Chat-Meldung mit Betrag
- [ ] Beschädigte Ausrüstung wird repariert, mit eigenem Gold (Einstellung „Automatisch reparieren“)
- [ ] Händler-Panel rechts neben dem Händler: „Händler-Ware verkaufen“, „Flip-Schnäppchen kaufen“, „Craft-Material kaufen“
- [ ] Craft-Liste mit Material vom Händler (z. B. Faden): „Beim Händler kaufen“ kauft genau die fehlende Menge
- [ ] Bündelware (z. B. 5er-Pack) wird richtig gekauft
- [ ] **Volle Taschen:** „Beim Händler kaufen“ → das Spiel lehnt ab, und es erscheint keine Fehlermeldung des Addons
- [ ] Im Kampf (z. B. am Trainingsdummy) einen Kauf-Knopf drücken → Chat: „Im Kampf gesperrt“

## Auktionshaus (mit Auctionator)
- [ ] AH öffnen → oben „AH scannen“ → Auctionator startet den Scan. Bei Sperre steht im Chat „nur alle 15 Minuten“, nicht „Scan läuft“.
- [ ] Nach dem Scan: „Preise von vor X“ aktualisiert sich, Marktpreise zeigen Zahlen
- [ ] Item im AH suchen, das deutlich unter dem Marktwert liegt → Schnäppchen-Meldung mit **richtigem Stückpreis**
- [ ] Preisalarm setzen (Wunschpreis über dem aktuellen Preis) → nach Scan oder Suche Chat-Meldung + Zahl am Menüpunkt „Markt“
- [ ] Einkaufsliste: „Im AH suchen“ startet die Auctionator-Suche, Gekauftes verschwindet aus der Liste

## Meine Auktionen (neu in 5.1)
- [ ] Ein paar Items einstellen, AH schließen und wieder öffnen. Im Chat steht „... am günstigsten“ oder „X Auktionen unterboten“, darunter der automatische Scan.
- [ ] Markt → Meine Auktionen: Alle eingestellten Items stehen dort mit Menge, deinem Preis und dem günstigsten fremden Preis. **Ist der Stückpreis richtig?** (bei Stapelware und bei Einzel-Items)
- [ ] Fern vom AH wartest du, bis etwas verkauft wird. Das Item wandert in „Verkauft“, „Heute verkauft“ zählt hoch.
- [ ] Craft-Planer: „Aktualisieren“ → Chat „Craft-Planer aktualisiert“

## Auktionen & Briefkasten (neu in 5.3)
- [ ] Menüpunkt **Auktionen** links: Anzahl und **Wert im AH** stimmen ungefähr mit dem AH-Reiter „Auktionen“ überein
- [ ] Etwas verkauft sich, während du unterwegs bist: Chat „Verkauft: … kommt in deinen Briefkasten“, die Auktion verschwindet aus der Liste, „Im Briefkasten“ zeigt ca. den Erlös
- [ ] Briefkasten öffnen: Der Betrag wird genau (ohne „ca.“). Gold herausnehmen → „Im Briefkasten“ wird leer, der Verkauf steht auf „abgeholt“
- [ ] Ausloggen mit Gold im Briefkasten, wieder einloggen: Chat-Erinnerung

## Auctionator aus
- [ ] Auctionator deaktivieren, `/reload` → Addon startet ohne Fehler, Status „Auctionator fehlt“, nächster Schritt „Auctionator installieren“

## Berufsfenster
- [ ] Beruf öffnen (z. B. Lederverarbeitung) → Craft-Planer zeigt gelernte Rezepte. Auch mit Text im Suchfeld des Berufsfensters.
- [ ] Craft-Liste erstellen → „Nächstes craften“ stellt **genau das Rezept aus der Liste** her
- [ ] Berufsfenster zu, „Nächstes craften“ → das Fenster geht auf (oder der Chat sagt ehrlich, dass es nicht ging)
- [ ] Skill-Fenster (Charakter > Fertigkeiten) bleibt so auf- und zugeklappt, wie du es eingestellt hast

## Post und Bank
- [ ] Briefkasten öffnen und schließen → Post-Bilanz im Chat, Verkaufsbuch zeigt Verkäufe
- [ ] Bank öffnen → Tooltip eines Items zeigt „Bestand alle Chars“ inklusive Bank (Inhalt der **Fächer**, nicht die Taschen selbst)

## Farm-Session
- [ ] Session starten, ein paar Tiere looten → Gold, Beutewert und „pro Stunde“ steigen
- [ ] Beim Händler Beute verkaufen → „Gold bekommen“ steigt **nicht** (sonst doppelt gezählt)
- [ ] `/reload` mitten in der Session → die Session läuft weiter
- [ ] Stopp → Eintrag in „Frühere Sessions“, × löscht ihn

## Speicher
```
/run UpdateAddOnMemoryUsage() print(GetAddOnMemoryUsage("TirysZentrale"))
```
Ausgabe in KB. Bitte notieren:
- [ ] direkt nach dem Einloggen: ______ KB
- [ ] nach 10 Minuten spielen, mit Tooltips: ______ KB (erwartet: wenige MB, nicht 20+ MB)

## Was nur im Spiel geprüft werden kann (ehrlich)
Alles oben ist im Forever-Nachbau getestet, aber nicht im echten Client. Besonders unsicher:
- Auctionator-Scan-Start (nutzt Auctionator-Interna, abgesichert)
- Horde-Wappen-Atlas
- Bankfächer-IDs
- Berufe über `GetSkillLineInfoByID`
- echte Speicherwerte
- Reitkosten (Guide-Angaben, nicht von Blizzard bestätigt) und die Anzahlungs-Formel ohne offenes AH (5/20/60 % vom Händlerpreis, unbestätigt)
- Ob die Stationen-Hinweise im Spiel genau den Fehlermeldungen des Berufsfensters entsprechen
- `C_Map.GetBestMapForUnit` in Höhlen/Instanzen (Unterwegs-Gold)

---

# Ingame-Test – LevelPilot 5.0.2
Einbau: alten Ordner `LevelPilot` löschen, ZIP entpacken, **WoW komplett neu starten** (neue Grafiken
`i_trash`, `i_flag`, `i_log`). Für Rückmeldungen hilft ein Screenshot vom Fenster **und** vom Questlog-Check.

## Start und Einstieg
- [ ] Einloggen ohne Lua-Fehler, Chat meldet „v5.0.2 bereit“
- [ ] Nach wenigen Sekunden (Questlog + Questie geladen): Meldung **„EINSTIEG“** oben und im Chat
  „Plan: Einstieg bei Schritt N von M (Gebiet · Hub) – erkannt an …“
- [ ] Der Einstieg passt zu deinem Stand (Gebiet, in dem du gerade Quests hast) – **Schrittnummer notieren**
- [ ] Falsch? `/lp schritt <Nr>` setzt ihn von Hand, `/lp einstieg` sucht neu (bitte melden, was falsch war)

## Fester Plan (das Herzstück von 5.0)
- [ ] Das Ziel springt **nicht** mehr hin und her, nur weil eine andere Quest näher ist – die Reihenfolge bleibt
- [ ] Erledigst du etwas früher nebenbei, rückt der Plan von selbst weiter (nie zurück)
- [ ] Liste zeigt den Ablauf in Plan-Reihenfolge: Annehmen → Erledigen → Abgeben – auch für Quests, die du gleich erst annimmst
- [ ] Held-Karte: „ANNEHMEN · SCHRITT 74“ o. ä.; bei nicht fertiger Abgabe „ERST ERLEDIGEN, DANN ABGEBEN“ mit Weg zum Questziel
- [ ] **Plan-Band** unter den Kennzahlen: „3/7 Gebiet · Hub“, „SCHRITT n/m“, Leiste je Abschnitt, Leuchtpunkt am aktuellen Platz;
  Tooltip zeigt Abschnitt, nächstes Gebiet, übersprungene Schritte; Klick sucht den Einstieg neu
- [ ] **Stufen-Pille**: IM PLAN / VORAUS +x / HINTER PLAN −x; Klick = Plan-Stand im Chat (`/lp plan`)
- [ ] **Sprung**: Bist du nachweislich weiter (Plan-Quests woanders angenommen, Plan-Ziel > ~900 m weg), meldet
  LevelPilot nach ~3 s „PLAN SPRINGT MIT“ + Chatzeile mit der Zahl übersprungener Schritte
- [ ] `/lp zurueck` macht den letzten Sprung (oder das letzte Überspringen) rückgängig; danach 30 Min. kein neuer Sprung
- [ ] Im Flug kein Sprung
- [ ] Auto-Annehmen nur für Quests, die im Plan bald dran sind (Rest: Chat-Hinweis „gerade nicht in deinem Plan“)

## Questlog-Check
- [ ] Log-Pille rechts: „LOG x/25 · N LÖSCHEN“ (bzw. ABGEBEN / PRÜFEN / WIRD VOLL) – Klick oder `/lp log` öffnet das Panel
- [ ] **Rot = löschen** mit Grund (grau – bringt kaum noch XP / nicht im Plan / übersprungener Teil des Plans / fertig, aber Abgabe zu weit); Klassenquests bleiben immer
- [ ] **Gelb = prüfen** (z. B. Dungeon-/Gruppenquest, nicht im Plan) – Löschen-Knopf gedämpft
- [ ] **LÖSCHEN** öffnet Blizzards Abbrechen-Dialog – gelöscht wird erst mit deinem Klick auf „Annehmen“
- [ ] **Grün = abgeben**: fertige Quests mit Abgabe in der Nähe, wenn sich der Umweg lohnt
- [ ] **Blau = behalten** mit „Schritt N“, fertige Quests mit „fertig“
- [ ] Warnung „Log wird voll“, bevor der Plan mehr Plätze braucht, als frei sind

## Neu in 5.0.1 (Prüfrunde)
- [ ] **Hexenmeister** auf Stufe 22 in Orgrimmar: Plan startet **nicht** beim Schamanen-Lehrer
- [ ] Im Hub alle Quests annehmen (Auto-Annehmen nimmt auch spätere Hub-Quests mit): Plan bleibt beim aktuellen Schritt, **kein** „PLAN SPRINGT MIT“
- [ ] Beim Looten (viele Questlog-Ereignisse) kein Ruckeln; Fenster aktualisiert trotzdem flüssig
- [ ] Liste: Erledigen/Abgeben von Quests, die gleich erst angenommen werden, tragen die Pille „geplant“
- [ ] Ruhestein benutzen: Ruhestein-Schritt/Flug-Rat reagiert (Zauber wird jetzt erkannt)
- [ ] `/lp aus`, dann `/lp log`: Fenster + Questlog-Check erscheinen
- [ ] Klick aufs Plan-Band, danach `/lp zurueck`: alter Schritt ist wieder da
- [ ] Pfeil an Klippen/Schluchten (z. B. Arathi ↔ Sumpfland, Tausend Nadeln): zeigt den Weg außen herum, nicht über den Abhang

## Neu in 5.0.2 (Prüfrunde 2)
- [ ] Pfeil auf Dächern, Felsen, in Mulden oder direkt am Flugmeister: zeigt den Laufweg („über …“), nicht die Luftlinie
- [ ] Donnerfels: auf dem Weg zum Aufzug steht „über Großer Aufzug“ schon von Weitem
- [ ] Hügelland-Kette „Battle of Hillsbrad“ (527, im deutschen Client mit deutschem Titel): Teil 1 annehmen → Teil 2 wird **nicht** als „im Log“ abgehakt
- [ ] Zweiter Besuch in einem Hub (Camp Taurajo, Hammerfall, Grom'gol) mit alten Quests vom 1. Besuch: Plan springt trotzdem mit
- [ ] Quest, die ein Gegenstand startet (z. B. Washte Pawne), und der Gegenstand fällt nicht: Plan geht nach ~3 s weiter, sobald du woanders Plan-Quests annimmst
- [ ] Einstieg am nächsten Tag mit alten Resten im Log: Plan startet im aktuellen Gebiet, nicht bei den Resten
- [ ] Ab Stufe 40 (keine Route): `/lp log` zeigt „Kein Plan aktiv“ + echte Platzzahl, **keine** Lösch-Tipps
- [ ] Fenster mit `/lp` ausblenden, eine Weile questen, wieder einblenden: Questlog-Check sofort aktuell

## Aus 4.2 weiter gültig
- [ ] Pfeil und Entfernungen über echten Laufweg („über Talondeep-Pfad“, Aufzüge), Flug-Rat nur mit bekannten Flugpunkten
- [ ] Erstes Öffnen: höchstens ein kurzer Ruckler (Wegenetz), danach kein Ruckeln durch LevelPilot

## Speicher
```
/run UpdateAddOnMemoryUsage() print(GetAddOnMemoryUsage("LevelPilot"))
```
- [ ] nach 10 Minuten Questen: ______ KB (erwartet: grob 6–12 MB, nicht 30+ MB)

## Was nur im Spiel geprüft werden kann (ehrlich)
Plan, Einstieg, Sprung und Questlog-Check sind im Lua-Nachbau getestet (`tests/plan.lua` 76 Prüfungen, kompletter Durchlauf beider Routen `tests/playthrough.lua`, Stresstest `tests/fuzz.lua`, Regressionen `tests/regress.lua`), das Fenster im
strengen Forever-Nachbau gezeichnet (`tests/lp_layout.lua` → `previews/LevelPilot_5.0_*.png`) – aber nicht im Client.
Unsicher: Einstieg mit **echten** Questie-Daten (Nachbau mit nachgestellten Questgebern), wie sich die Sprung-Schwellen
(900/450 m, 3 s) anfühlen, ob Forever `QuestMapQuestOptions_AbandonQuest`, `C_QuestLog.GetMaxNumQuestsCanAccept` und
`C_QuestLog.GetQuestTagInfo` (Dungeon/Gruppe) liefert (Rückfälle sind eingebaut), Schriftbreiten im echten Client.
Aus 4.2 weiter offen: `C_Map.GetMapPosFromWorldPos`, Flugmeister-IDs, Hochplateaus (Donnerfels), `GetUnitSpeed` im Geisterwolf.
