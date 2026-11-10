# Ingame-Test – Tiry's Zentrale 6.0.0

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
