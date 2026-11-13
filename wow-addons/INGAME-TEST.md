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

## Neu in 6.2.1 (AH-Ruckeln, Chat-Spam, Suche)
- [ ] AH öffnen, Zentrale offen auf Craft-Planer: **kein Ruckeln** (auch nicht während/nach „AH scannen“)
- [ ] Nach einem Komplett-Scan steht „Schnäppchen-Scan: …“ **genau einmal** im Chat
- [ ] „Rezepte suchen“ im Craft-Planer → Auctionator zeigt die Treffer (oder „keine Ergebnisse“) statt endlos „Rufe Daten ab …“
- [ ] „Rezepte suchen“ direkt nach „AH scannen“: Chat „Auctionator scannt gerade – deine Suche startet automatisch …“, danach startet die Suche von selbst
- [ ] Ruckelt es weiter: Einstellungen → „AH automatisch scannen“ aus und erneut testen (Auctionators eigenes Einlesen eines Komplett-Scans braucht selbst Rechenzeit). Ergebnis notieren: ______

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

## Eigenes Berufsfenster (neu in 6.4)
- [ ] Beruf öffnen → **nur noch das Zentrale-Fenster** ist zu sehen, Blizzards Fenster ist unsichtbar. Klappt Herstellen trotzdem? (Blizzards Fenster bleibt intern offen.)
- [ ] Reiter oben rechts („Rezept / Top-Rezepte / Liste / Optionen“) in **einer** Zeile, nichts überdeckt? Menü-Knöpfe (Planer … Auktionen) mit Text oder als Symbole?
- [ ] Liste: Kategorien, Farben wie bei Blizzard, [Anzahl], Gewinn. Rechtsklick = Favorit (auch bei Blizzard sichtbar?), Shift-Klick = Link im Chat
- [ ] Filter Herstellbar/Skill-Up/Gewinn/Favoriten, Sortierung, Suche
- [ ] **Herstellen** mit Menge und **Alle (N)** → stellt her, Craft-Liste zählt runter
- [ ] Skill-Tipp passt (orange zuerst)? Skill-Balken stimmt?
- [ ] Rezept mit Station: „Erfordert: …“ richtig grün/rot?
- [ ] Zweiten Beruf oben anklicken → wechselt
- [ ] Menü-Knöpfe öffnen die Zentrale auf der richtigen Seite
- [ ] Verzauberkunst: „Im WoW-Fenster verzaubern“ → Blizzards Fenster mit dem Rezept. Beruf zu und wieder auf → wieder TZ
- [ ] „WoW“ → Blizzards Fenster normal (Größe, Position!). „TZ“ → wieder das eigene. × und ESC schließen den Beruf
- [ ] Fenster verschieben → Position bleibt nach /reload

## AH-Scan aktualisiert alles (6.4)
- [ ] Komplett-Scan, 1–2 Min. warten, Seiten durchschauen, dann „Aktualisieren“ (ohne neuen Scan) → **dieselben Einträge**
- [ ] Chat nach dem Scan: „Scan fertig!“ erst nach dem Ende von Auctionators Scan

## Craftfenster am Berufsfenster (6.3, durch 6.4 ersetzt)
- [ ] Beruf öffnen → rechts neben Blizzards Fenster (hinter den Berufs-Reitern) erscheint „Zentrale-Craft“; oben rechts über dem Berufsfenster „Ansicht WoW | TZ“. **Sitzt beides sauber, nichts überdeckt?**
- [ ] Links ein Rezept anklicken → Reiter „Rezept“ zeigt sofort dieses Rezept (Gewinn, Material mit „hast X“, Empfehlung)
- [ ] „Einplanen“ / „+1“ → Reiter „Liste“ und Craft-Planer zeigen die neue Menge
- [ ] „Top-Rezepte“: Zeile anklicken → Rezept wird links im Berufsfenster angewählt; „Alle in die Liste“ → Einkaufsfenster geht auf
- [ ] „Optionen“: Mindestgewinn ändern → Top-Rezepte und Craft-Planer ändern sich mit
- [ ] Unten „Nächstes craften“ stellt das richtige Rezept her
- [ ] „WoW“ anklicken → Craftfenster weg; Beruf zu und wieder auf → bleibt weg; „TZ“ → wieder da. `/tz cf` schaltet ebenso.
- [ ] Verzauberkunst (Rezepte ohne Gegenstand): Reiter „Rezept“ sagt ehrlich „keine Daten“, kein Fehler

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

# Ingame-Test – LevelPilot 6.0.3

## Neu in 6.0.3
- [ ] Elixier der Schmerzen im Log: Karte zeigt „Elixier der Schmerzen“ erledigen (nicht „ERST ERLEDIGEN … +1.4k XP“ für Teil 2).
- [ ] Stufe 28: Pfeil führt zu den wilden Berglöwen (~Stufe 28), nicht zu Stufe 23–24 und nicht zu Stufe 32+.
- [ ] Neue Live-Quests liegen höchstens 3 Stufen unter dir; `/lp warum` zählt aussortierte als „zu leicht“.

## Neu in 6.0.2
- [ ] Elixier der Schmerzen (Berglöwenblut) mit Stufe 28: Pfeil führt zu den **hungernden Berglöwen (Stufe 23–24)**, nicht zu Stufe-32-Löwen. Karte zeigt „nur Gegner ~St. 24 · St. 34 meiden“.
- [ ] Andere Sammelquests: Pfeil zeigt nie auf Gegner über deiner Stufe +1, solange es schwächere mit derselben Beute gibt.

## Neu in 6.0.1
- [ ] Tooltip einer Live-Quest: „du bist Stufe X: leicht, N Stufen drunter, volle Quest-XP“ – X = deine echte Stufe.

## Neu in 6.0 (Live-Modus: Quest-Gebiet statt fester Plan)
- [ ] Einloggen: Kopfzeile zeigt **LIVE · <Gebiet> · N Quests · +X XP**, das Band darunter eine Kapsel je Quest.
- [ ] Am Wegekreuz (Stufe ~24): mehrere Quests des Wegekreuzes zusammen (z. B. Serena Bloodfeather, Consumed by Hatred, Lost in Battle, Counterattack!) – nicht nur 1–2.
- [ ] Alle Live-Quests einfach: Quest und Gegner höchstens deine Stufe +1 (Tooltip der Quest), keine Elite/Gruppe/Dungeon.
- [ ] Pfeil: erst die Quests am Hub annehmen, dann die Ziele in der Nähe, dann abgeben – kein Hin und Her.
- [ ] Gebiet bleibt, bis seine Quests erledigt sind (kein Springen zwischen Gebieten).
- [ ] Questlog-Check: Quests, die zu deiner Stufe passen, stehen auf „passt · später dran“ statt löschen.
- [ ] `/lp warum` nennt das Live-Gebiet mit Quests, XP/Min und Weg, dazu bis zu 3 Alternativen. **Screenshot an Claude.**
- [ ] Klick aufs Band oder Menü → NEU BERECHNEN: Gebiet wird neu gewählt.
- [ ] `/lp live` (oder Schalter im Menü) aus → alter fester Plan, wieder an → Live.

# Ingame-Test – LevelPilot 5.1.9

## Neu in 5.1.9
- [ ] Beim Grinden `/lp warum` eingeben: Grind-Tempo, Schwelle, beste Quests mit XP/Min und Gründe im Chat. **Screenshot davon an Claude.**
- [ ] Maus über die Grind-Karte: Tooltip nennt die beste Quest und warum sie (noch) nicht kommt.
- [ ] Kommt jetzt öfter eine Quest statt Grinden?

# Ingame-Test – LevelPilot 5.1.8

## Neu in 5.1.8
- [ ] Knöpfe NEU BERECHNEN, ROUTE/QUESTS, AMBOSS/SCHLOSS: Schrift auf Grün klar lesbar.
- [ ] Weit weg vom Grind-Platz (z. B. Donnerfels): kommt eine Extra-Quest, wenn sie mit Weg schneller ist als Hinfliegen + Grinden?
- [ ] Früher ausgelassene Route-Quests in der Nähe tauchen als EXTRA auf.

# Ingame-Test – LevelPilot 5.1.7

## Neu in 5.1.7 (nur Solo)
- [ ] Steinkrallen: keine Arachnophobia (Besseleth) und keine Bloodfury Bloodline (Blutwut-Reißer) mehr im Plan – beide Elite.
- [ ] Tausend Nadeln: kein Hypercapacitor Gizmo (Enraged Panther, Elite) mehr bei den Aufhol-Quests.
- [ ] Während einer Begleitquest (z. B. Homeward Bound) Stufe aufsteigen: Pfeil bleibt beim Geleit, bis es fertig ist.

# Ingame-Test – LevelPilot 5.1.6

## Neu in 5.1.6 (Extra-Quests aus dem Quest-Pool)
- [ ] Stufe 27, Route sagt „Grinden bis 28“: nach spätestens 20 s kommt eine **EXTRA**-Quest („Passt zu deiner Stufe · +X XP“), z. B. Sacred Fire (Whitereach Post) oder King of the Foulweald (Eschental, nur wenn die Vorquest erledigt ist).
- [ ] Extra-Quest wird automatisch angenommen, Pfeil führt zu Ziel und Abgabe, danach die nächste Extra-Quest oder wieder der Plan.
- [ ] Keine Extra-Quest mit Gegnern über deiner Stufe +1, keine Dungeon-/Elite-/Begleitquest.
- [ ] Menü „Neu berechnen“ findet auch Extra-Quests; Questlog-Check sagt bei der Extra-Quest „ist dran“ (nicht löschen).
- [ ] Kein Ruckeln alle 20 s beim Grinden (Bewertung mit Flugzeiten läuft dann im Hintergrund).


## Neu in 5.1.5 (Quests passend zu deiner Stufe)
- [ ] Keine geplante Quest hat Gegner über **deiner Stufe +1** (Tooltip der Quest: „Gegner ~Stufe N“). Liegt eine drüber, steht sie auf „ab St. N“ und wird übersprungen, bis du so weit bist.
- [ ] Wartet der Plan, schlägt LevelPilot selbst eine nahe, machbare Quest vor: grüne Zeile **„Passt zu deiner Stufe · statt Warten“**.
- [ ] Grind-Schritte zeigen **„noch X XP · ~N Mobs“** bis zur Zielstufe.
- [ ] Stufe 27 in Tausend Nadeln: Schritt **„Grinden: Needles Cougar“** westlich vom Freiwindposten bis 28, danach weiter mit Rocket Car Parts.
- [ ] Hero-Zeile nicht abgeschnitten („ERST ERLEDIGEN · SCHRITT n“).


## Neu in 5.1.4 (Menü „Neu berechnen“, auch `/lp rechnen`)
- [ ] Menü (•••) → **NEU BERECHNEN**: Meldung „NEU BERECHNET · <Quest> lohnt mehr“ oder „PLAN BLEIBT“, im Chat mit XP/Min beider Wege.
- [ ] Gewählte Quest ist **nie schwerer** als dein Plan-Ziel (bzw. höchstens Stufe+1, wenn du wartest/grindest), keine Elite.
- [ ] Held-Karte zeigt „Abstecher · lohnt mehr“; nach dem Abgeben geht der Plan normal weiter.
- [ ] Werte prüfen: Rechnung = XP / (Weg Luftlinie × 1,25 bei 7 Yards/s + Arbeitszeit am Ziel). Wirkt eine Wahl unsinnig → Screenshot + Chatzeile.

## Neu in 5.1.3 (Aufhol-Quests gehen nicht mehr verloren)
- [ ] Stufe 27, Zeiger schon bei Raketenwagenteile (ab 28): nicht erledigte Aufhol-Quests (Hypercapacitor Gizmo, Protect Kanati Greycloud, Homeward Bound …) kommen **zurück** ans Ziel.
- [ ] Alle Aufhol-Quests erledigt: Karte zeigt **„WARTET · AB STUFE 28 · noch X XP · ~N Mobs“** – X = XP bis 28 laut Leiste (nicht bis 30, nicht „Grinden bis 30“).
- [ ] Kartenmarkierung (Blizzard-Wegpunkt) springt mit, sobald das Ziel wechselt – bleibt nicht an alter Stelle hängen.

## Neu in 5.1.2 (Aufhol-Quests nach echter XP)
- [ ] Stufe 27 mit wenig XP (z. B. 3 %): Aufhol-Karte zeigt **„Aufholen x/y XP · ~N Mobs“** – y = dir fehlende XP bis 28 (laut XP-Leiste), x = was die Quests bringen.
- [ ] Bei viel XP (z. B. 90 %+) kommen **weniger** Aufhol-Quests (nur so viele, wie bis 28 fehlen).
- [ ] Wartet ein Schritt trotzdem auf eine Stufe: Karte zeigt **„noch X XP · ~N Mobs“** statt nur „Stufe fehlt“.
- [ ] Mit 28 am Ende von Tausend Nadeln: neue Aufhol-Quests bis 30 (**Rocket Car Parts**, **A Bump in the Road**, **Load Lightening** – Shimmering Flats), mit 30 fallen sie weg.

## Aus 5.1.1 (Aufhol-Quests)
- [ ] Stufe 27 am Ende von Tausend Nadeln: statt „WARTET ab Stufe 28“ kommt **Grimmtotem-Spionage** (Freiwindposten), Hinweis „Aufhol-Quest“.
- [ ] Mit Stufe 28 geht es mit Gehärtete Schalen / Salziges Gift weiter; angenommene Aufhol-Quests bleiben in der Liste.

Einbau: alten Ordner `LevelPilot` löschen, ZIP entpacken, **WoW komplett neu starten** (neue Grafiken
`i_trash`, `i_flag`, `i_log`). Für Rückmeldungen hilft ein Screenshot vom Fenster **und** vom Questlog-Check.

## Start und Einstieg
- [ ] Einloggen ohne Lua-Fehler, Chat meldet „v5.1.0 bereit“
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

## Neu in 5.1.0 (Strahl ruht im Questgebiet)
- [ ] Zu einem Erledigen-Ziel laufen: Strahl führt hin. **Etwa 60 m vor den ersten Gegnern** blendet er weich aus, einmal der Ankunfts-Ton
- [ ] Im Gebiet questen, zwischen den Gruppen laufen: **kein Strahl, kein Springen**, Kartenpin (Karte/Minimap) bleibt stehen
- [ ] Am Rand kurz rausziehen (Gegner verfolgen): Strahl kommt **nicht** gleich wieder (Puffer bis ~120 m)
- [ ] Gebiet richtig verlassen: Strahl wächst wieder ein, **ohne** „Neues Ziel“-Ton
- [ ] Quest fertig, während du noch im Gebiet stehst: Strahl zeigt sofort zur Abgabe
- [ ] Grind-Schritt („Unter Stufe 23? Dann … grinden“): bei den Gegnern ebenfalls kein Strahl
- [ ] Quest im Blizzard-Questlog angeklickt (verfolgt): gleiches Verhalten
- [ ] Erkunden-Ziel (Ort finden): Strahl bleibt bis auf den Punkt
- [ ] Melden: Fühlen sich 60 m (rein) / 120 m (raus) richtig an? Gibt es Gebiete, in denen der Strahl trotzdem kommt/fehlt? (Questname)

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


# Ingame-Test – TotemTakt 1.1.0

## Totem-Uhr (neu in 1.1)
- [ ] Nach dem Einloggen liegt unter der Bildmitte eine Glas-Leiste mit 4 blassen Element-Ringen (Erde, Luft, Wasser, Feuer – deine Reihenfolge).
- [ ] Totem stellen → Ring leuchtet, echtes Totem-Symbol, dunkler Ablauf-Ring, Restzeit **m:ss**, letzte 10 s **rot** + pulsierender Ring.
- [ ] Totem läuft ab / wird ersetzt → Symbol verschwindet bzw. wechselt sofort.
- [ ] **Im Kampf (wichtigster Test):** Symbole, Ablauf-Ring und Zahl laufen weiter. Zeigt die Zahl im Kampf nur Sekunden (z. B. „287“), sind die Totem-Daten geheim – das ist so gewollt. Bitte melden: Zahl da? Ring da? Lua-Fehler?
- [ ] Ziehen verschiebt die Leiste, **Mausrad** und **Ecke unten rechts** ändern die Größe (0,5–2,5), Rechtsklick auf die Ecke = normal.
- [ ] `/takt uhr fest` → Leiste klickt durch, Ecke weg; `/takt uhr frei` → wieder verschiebbar.
- [ ] `/takt uhr senkrecht`, `/takt uhr leer`, `/takt uhr glas`, `/takt uhr reset`, `/takt uhr` (aus/an). Nach `/reload` bleibt alles so.
- [ ] Maus über ein Totem → Spiel-Tooltip des Totems.


## Start
- [ ] Nach dem Einloggen mit dem Schamanen steht im Chat einmal: Makro „TotemTakt“ liegt in deinen Charakter-Makros.
- [ ] `/takt` öffnet das Fenster: 4 Kugeln mit echten Totem-Symbolen, Zahl = Platz im Makro, Punkt grün/rot/gelb.
- [ ] Knopf **AUF LEISTE ZIEHEN** → Makro hängt am Cursor → auf eine Leiste legen, Taste belegen.

## Totems stellen (außerhalb des Kampfes)
- [ ] Keine Totems: 4× drücken (normal schnell) → alle 4 stehen, in deiner Reihenfolge.
- [ ] Wild drücken (auch in der Abklingzeit): es wird **kein Totem übersprungen**.
- [ ] Ein Totem auslaufen lassen / weglaufen (> 30 m) → **dieses** kommt beim nächsten Druck zuerst.
- [ ] Alles steht: 1× drücken → das älteste wird erneuert; Kugel-Zahlen und „Nächster Druck“ stimmen mit dem Symbol auf der Leiste.

## Im Kampf
- [ ] Kampf beginnen, Taste mehrfach drücken → Totems nacheinander, keine Fehlermeldung.
- [ ] 8 s nicht drücken → nächster Druck beginnt wieder vorne.
- [ ] Nach dem Kampf ordnet TotemTakt neu (fehlende zuerst).

## Fenster
- [ ] Kugel anklicken → Auswahl-Leiste mit deinen Totems des Elements + „aus“; Pfeile verschieben das Element.
- [ ] Kugel ziehen → Reihenfolge ändert sich, Makro passt sich an.
- [ ] Schalter „Fehlende zuerst“ und Neustart 8 s / 15 s / nie.

## Nur im Spiel prüfbar (ehrlich)
- /castsequence + Makro anlegen/ändern in Forever (Code folgt der Retail-API; WinduTotemMacro nutzt sie in Forever auch).
- Totem-/Buff-Daten außerhalb des Kampfes lesbar (im Kampf sind sie gesperrt → Makro bleibt fest).
- Uhr im Kampf: ob Forever die Totem-Plätze dort geheim macht und ob `SetCooldownFromDurationObject`/`SetFormattedText` die geheimen Werte so annehmen wie in der API-Doku beschrieben.
- Reichweite gibt es nur für Buff-Totems; Verbrennung/Magma/Erdbindung usw. gelten als „steht“, solange sie laufen.


# Ingame-Test – ChatHoch 1.5.0
- [ ] Ordner `ChatHoch` ersetzt, `/reload`. Das Freunde-Symbol mit der Zahl (Geselligkeits-Knopf) über dem Chat ist weg – auch nach Zonenwechsel/Ladebildschirm.
- [ ] `/chathoch gesellig` → Symbol wieder da, nochmal → weg. `/chathoch info` zeigt „ausgeblendet (sichtbar: false …)“.
- [ ] Freundesliste weiter mit **O** (Kontakte).

# Ingame-Test – WindBaem 1.2.0 (Windzorn-Ton)
- [ ] Ordner `WindBaem` entpackt, WoW **komplett neu gestartet**. Chat beim Einloggen: „WindBaem: 1.2.0 bereit (7 Windzorn-Auren)“.
- [ ] `/wb test` → kurzer, leiser Pling. Alternativen: `/wb ton tick` (unauffälligster), `/wb ton wusch` (Windhauch).
- [ ] Lautstärke folgt dem Regler **Effekte**. Immer noch zu laut/leise → Regler oder `/wb kanal dialog` (eigener Regler „Dialog“).
- [ ] **Im Kampf** mit Waffe des Windzorns: bei jedem Proc (zwei Extra-Schläge) kommt der Ton. Zur Kontrolle Kampflog/Schadenszahlen.
- [ ] Mit Totem des Windzorns (ohne Waffen-Windzorn auf der Haupthand) dasselbe.
- [ ] Kein Ton → `/wb diag` abfotografieren. „eingetragen: 7 von 7“ + kein Ton = Forever spielt Aura-Töne für unsichtbare Auren nicht → dann melde dich.
- [ ] Zu oft? `/wb pause 2` (höchstens alle 2 s).

# Ingame-Test – LevelPilot 7.0 (RXP-Modus)

## Einbau
- [ ] `LevelPilot` (7.0.0) und `RXPNeon` (2.2.0) neu entpackt, `RXPGuides` liegt daneben, WoW **komplett neu gestartet**.
- [ ] Nach dem Einloggen: nur **ein** Fenster – LevelPilot. RXPs eigenes Fenster und RXPs Pfeil sind unsichtbar, das Neon-Fenster von RXPNeon ist weg.
- [ ] Kopf: „RXP · <Guide-Name> · ohne Grinden“. Band: „RXP <Guide> · St. a–b“, rechts „SCHRITT x/y“, Kapseln füllen sich mit dem Guide-Fortschritt.

## Ablauf (genau das, was vorher „komisch“ war)
- [ ] **Annehmen:** Quest beim NPC annehmen → die JETZT-Karte springt sofort weiter (Abgleich hakt bei RXP ab).
- [ ] **Erledigen:** Karte zeigt Ziel-Fortschritt („3/8 …“) und RXPs Zusatz-Hinweis. Pfeil und Strahl führen zu RXPs Wegpunkt; bei mehreren Wegpunkten (Schleife) zum jeweils aktuellen.
- [ ] **Abgeben:** Ist die Quest noch nicht fertig, steht orange **ABGEBEN GEHT NOCH NICHT** mit dem offenen Ziel.
- [ ] Vorquest fehlt → **VORQUEST FEHLT** mit dem Namen. Quest nicht im Log → **QUEST NICHT IM LOG**.
- [ ] **Grinden:** Kommt ein „Grinde bis Stufe X“-Schritt, springt LevelPilot weiter; Chat: „Grind-Schritt (Stufe X) übersprungen“. `/lp grind an` zeigt sie wieder.
- [ ] Klick auf die JETZT-Karte = Haken bei RXP setzen/entfernen. **Rechtsklick** = Schritt überspringen. `/lp weiter` = RXP einen Schritt weiter. `/lp schritt 25` = RXP auf Schritt 25.
- [ ] Im Kampf passiert nichts davon, erst danach.

## Guide wählen
- [ ] Kein Guide geladen → „Kein RXP-Guide geladen“. Klick aufs Band lädt den Guide für deine Stufe (kein Dungeon-Guide).
- [ ] Guide passt → Klick aufs Band öffnet RXPs Guide-Menü. Stufen-Pille zeigt „UNTER GUIDE“, wenn du zu niedrig bist.

## Größe + Umschalten
- [ ] Unten rechts im LevelPilot-Fenster: grün-türkise Punkte. Ziehen = kleiner/größer (60–160 %), linke obere Ecke bleibt. Rechtsklick = normal. Nach `/reload` bleibt die Größe.
- [ ] `/lp rxp` → LevelPilots eigene Route (fester Plan/Live), RXPs Fenster wieder sichtbar. Nochmal `/lp rxp` → RXP-Modus.
- [ ] Questlog-Pille: Quests aus späteren Guides stehen auf „prüfen“, nicht auf „löschen“.

## Nur im Spiel prüfbar (ehrlich)
- Ob RXP nach unseren Haken-Klicks immer sauber weiterzählt (der Klick ist derselbe wie mit der Maus in RXPs Fenster).
- Nur mit RXPs klassischem Fenster: Beta-Fenster (v2) hat keine Haken-Knöpfe → Anzeige ja, Abgleich/Grind-Sprung nein.
- Ohne Grinden kannst du unter den Stufenbereich des nächsten Guides fallen (Pille „UNTER GUIDE“).

# Ingame-Test – RXPNeon 2.1.0

## Neu in 2.1: Größe, Grinden, Annahme/Abgabe
- [ ] Unten rechts im Fenster sitzen **grün-türkise Punkte** (Griff). Maus drauf → Hinweis „Größe ändern“.
- [ ] Griff mit linker Maustaste ziehen: Fenster wird **größer/kleiner**, die **linke obere Ecke bleibt stehen**. Grenzen: 60 % bis 160 %.
- [ ] `/reload`: Größe und Position bleiben. **Rechtsklick** auf den Griff = wieder normale Größe. Bei `/rxn fest` lässt sich nichts ziehen.
- [ ] **Grind-Schritte** („Grinde bis Stufe X“ / `.xp`) tauchen nicht mehr auf: Kommt einer, springt das Fenster weiter, im Chat steht „Grind-Schritt (Stufe X) übersprungen“. Steckt der Grind-Teil in einem Schritt mit Quests, bleiben die Quest-Zeilen stehen.
- [ ] `/rxn grind an` → Grind-Schritte wieder sichtbar („EP SAMMELN“); `/rxn grind aus` → wieder überspringen.
- [ ] Im Kampf wird nichts übersprungen, erst danach.
- [ ] Annehmen-Schritt, dessen Vorquest fehlt (RXP zeigt dann ein rotes Fehler-Symbol): Kasten **VORQUEST FEHLT** mit dem Namen der fehlenden Quest.
- [ ] Abgeben-Schritt für eine Quest, die du **nicht** im Log hast: Kasten **QUEST NICHT IM LOG** – annehmen oder mit „›“ überspringen.
- [ ] Ohne Grinden kann man **unter dem Stufenbereich** des nächsten Guides landen – dann Stufe im Kopf mit „STUFE a–b“ vergleichen.

## Aus 2.0.1

## Neu in 2.0.1: „Abgeben geht noch nicht“
- [ ] Ein Abgeben-Schritt für eine Quest, die du hast, die aber noch nicht fertig ist (z. B. „Die heilige Flamme“ bei Zangen mit „Gefüllte geätzte Phiole 0/1“): Die Abgeben-Zeile ist orange. Darunter steht der Kasten **ABGEBEN GEHT NOCH NICHT** mit dem offenen Ziel, bei der heiligen Flamme auch mit dem Ort (Mondbrunnen Eschental).
- [ ] Ist das Ziel erfüllt, verschwindet der Kasten. Nach dem Abgeben geht RXP wie gewohnt weiter.

## Start
- [ ] `RXPGuides` und `RXPNeon` liegen in `Interface\AddOns`, WoW **komplett neu gestartet**, beide in der Add-on-Liste an.
- [ ] Zygor aus (sonst zwei Pfeile gleichzeitig).
- [ ] Nach dem Einloggen: **Neon-Fenster** links (Glas, grün-türkiser Rand). Das alte RXP-Fenster ist **unsichtbar** (nicht weg: RXP arbeitet darunter weiter).
- [ ] Kopf: Stufen-Kugel mit deiner Stufe, Gebiet als Verlaufsschrift, darunter „STUFE a–b · SPEEDRUN …“.
- [ ] EP-Leiste: „x / y EP“, Prozent, blau „Erholt …%“ (nur mit Erholung); Leiste füllt sich beim Questen/Töten.
- [ ] „SCHRITT n / gesamt“ mit dünner Fortschrittsleiste.
- [ ] Kein passender Guide → im Fenster Knopf **GUIDE FÜR STUFE X LADEN**. Klick lädt ihn (nicht im Kampf).

## JETZT-Karte (das Wichtigste)
- [ ] Oben groß der aktuelle Schritt: farbiges Wort (**ANNEHMEN** gelb, **ABGEBEN** blau, **ERLEDIGEN** grün, **FLIEGEN** türkis …), „SCHRITT n“, Entfernung „N m“ zum Pfeil-Ziel.
- [ ] Zeilen mit Kreis = abhakbar; Punkt = Hinweis („Sprich mit …“). Erledigte Zeilen grau mit Haken.
- [ ] **Quest annehmen → Haken kommt sofort** (eigener Questlog-Abgleich). Genau der Fall vom Screenshot („Annehmen“ obwohl angenommen) prüfen.
- [ ] Alles erledigt → „ALLES ERLEDIGT“ + Knopf **ERLEDIGT · WEITER ›**; RXP springt normalerweise selbst weiter, der Knopf ist die Notbremse.
- [ ] Klick auf eine Zeile setzt/entfernt den Haken (wie bei RXP). Kleiner „›“-Knopf oben rechts = Schritt überspringen.
- [ ] Weitere aktive Schritte darunter als kleine Karte „AUCH AKTIV · …“.

## ALS NÄCHSTES + Fuß
- [ ] 4 kommende Schritte als runde Zeilen mit Symbol und „#Nummer“; Maus drauf zeigt alle Zeilen des Schritts.
- [ ] **GUIDE WÄHLEN** und „•••“ öffnen RXPs Guide-Menü. Pfeil-Knopf oben schaltet den Pfeil an/aus.
- [ ] Schalter DEUTSCH: aus = englische Originaltexte, an = deutsch.
- [ ] Fenster mit linker Maustaste verschieben, `/reload`: Position bleibt. Größe: Ecke ziehen oder `/rxn groesse 1.2`, `/rxn fest`, `/rxn reset`.

## Texte
- [ ] **Keine halben Übersetzungen mehr** („Annehmen The Sacred Flame“ war der Fehler): Quest-Titel deutsch, auch in RXPs Original-Fenster (`/rxn fenster rxp`).
- [ ] NPC- und Gegenstandsnamen in Farbe sind die deutschen Namen aus dem Spiel.
- [ ] Guide-Auswahlmenü: Guide-Namen deutsch („28-30 Tausend Nadeln“, „(Horde)“).

## Pfeil
- [ ] Größerer facettierter Neon-Pfeil auf ruhiger Glas-Scheibe mit Skala; Leuchten dreht mit.
- [ ] Darunter Kapsel „245 m“ und das Ziel auf Deutsch; RXPs alter Text ist weg.
- [ ] Pfeil-Größe über RXP-Optionen (Pfeil-Skalierung) wirkt weiter.

## Umschalten
- [ ] `/rxn fenster rxp` → RXPs Original-Fenster (mit Neon-Skin) zurück, Neon-Fenster weg; `/rxn fenster neon` → wieder Neon.
- [ ] `/rxn aus` → komplett RXP-Standard (Theme, Fenster, Pfeil); `/rxn an` → Neon wieder da.
- [ ] `/rxn abgleich aus` → Haken nur noch von RXP selbst.
- [ ] Guide wechseln, `/reload`, Kampf, Flugpfad: kein Lua-Fehler.

## Nur im Spiel prüfbar (ehrlich)
- Nur mit dem klassischen RXP-Fenster (v1): ist in den RXP-Einstellungen das Beta-Fenster (v2) an, bleibt das Neon-Fenster leer.
- Ob RXP das Abhaken selbst schafft, hängt von RXP ab; der Questlog-Abgleich fragt dasselbe Spiel (`C_QuestLog.IsOnQuest` / `IsQuestFlaggedCompleted`).
- Spielsymbole (Atlas) in den Kugeln: in der Vorschau eigene Ersatz-Symbole, im Spiel Blizzards Symbole, falls vorhanden.
- Freie Hinweissätze der Guides sind teils noch englisch (keine Vorlage für jeden Satz); Zaubernamen in [Klammern] bleiben englisch.
- Quest-Titel, die in der Namenstabelle fehlen, holt RXPNeon live vom Spiel (`C_QuestLog.GetTitleForQuestID`) – klappt nur, wenn das Spiel die Quest kennt.
- Klassen-Symbol im Kopf (rund) kommt aus Blizzards `UI-Classes-Circles` – in der Vorschau nicht darstellbar.
- Grind überspringen: RXPNeon hakt RXPs Grind-Zeile ab (wie ein Klick von dir); reiner Grind-Schritt → zusätzlich `RXP.SetStep(+1)`. Ob RXP dabei nie zurückspringt, zeigt erst das Spiel.
- „VORQUEST FEHLT“ liest RXPs eigene Prüfung (Fehler-Symbol + Liste im Tooltip) – nur so gut wie RXPs Daten.
