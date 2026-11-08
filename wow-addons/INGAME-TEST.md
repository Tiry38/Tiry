# Ingame-Test – Tiry's Zentrale 5.0.0

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
- [ ] **Start:** Goldplan mit „Dein nächster Schritt“ (der Knopf tut etwas Sinnvolles), Goldwege
- [ ] **Farmen:** Farm-Guide (Klick auf einen Spot setzt einen Wegpunkt mit Pfeil), Kürschner, Farm-Session
- [ ] **Berufe:** Craft-Planer, Berufe-Berater (Skill-Plan erscheint, wenn du einen Herstellungsberuf hast)
- [ ] **Markt:** Preise, Preisalarm, Taschen & Händler, Item-Suche
- [ ] **Mein Gold:** Goldtagebuch, Verkaufsbuch
- [ ] **Lernen:** AH-Schule, Glossar
- [ ] **Einstellungen:** Schalter umlegen, Regler-× setzt zurück, „Alle Einstellungen auf Standard“ fragt erst nach
- [ ] Unten in der Seitenleiste ist das **Horde-Wappen** dezent zu sehen. Fehlt es, ist das kein Fehler (der Atlas steht nur im Code der Charaktererstellung).
- [ ] Schrift überall gut lesbar, nichts überlappt, nichts ragt aus Karten

## Fenster
- [ ] Unten rechts am Griff ziehen → Fenster wird größer oder kleiner
- [ ] Fenster nah an einen Bildschirmrand ziehen → rastet dort ein
- [ ] Suche in der Seitenleiste: „leder“ eintippen → Items, Rezepte, Begriffe. Enter öffnet den ersten Treffer.
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
