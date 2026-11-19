# RezeptRadar 1.0 – Rezept-Berater (Kochkunst & Lederverarbeitung)

**Eine Aufgabe, ein Fenster:** Nach einem AH-Scan siehst du, welche Rezepte du **noch nicht kannst**, im
Auktionshaus **kaufen kannst** und deren **Hergestelltes Gold bringt** – bester Gewinn zuerst.

## Installation (Windows)
1. `RezeptRadar.zip` entpacken.
2. Den Ordner **`RezeptRadar`** nach `World of Warcraft\_forever_\Interface\AddOns\` kopieren.
   Richtig ist `...\AddOns\RezeptRadar\RezeptRadar.toc` (kein doppelter Ordner).
   **Den alten Ordner `TirysZentrale` löschen** – RezeptRadar ersetzt Tiry's Zentrale 7.0 (gleiche Funktion, neuer Name).
3. Spiel starten, unter „AddOns“ anhaken. Auctionator ist **nicht nötig** (wird für die Suche per Klick genutzt, wenn vorhanden).

## So geht's
1. `/rr` oder Klick auf den Knopf an der Minikarte → das Fenster öffnet sich.
2. **Berufsfenster einmal öffnen** (Kochkunst und Lederverarbeitung). Dann weiß RezeptRadar sicher, welche Rezepte du schon kannst.
   Die Fußzeile zeigt, für welchen Beruf das erkannt ist.
3. Zum **Auktionshaus**, im Fenster auf **„AH scannen“** klicken. Nach ein paar Sekunden steht die Liste.
   Blizzard erlaubt den Komplett-Scan nur **alle 15 Minuten** – der Knopf zeigt die Wartezeit.
   Startet Auctionator einen Komplett-Scan, liest RezeptRadar automatisch mit.
4. **Liste lesen** (bester Gewinn oben):
   - **Rezept** – günstigstes Angebot des Rezepts im AH
   - **+Gewinn je Herstellung** – Verkaufswert minus Material
   - **zurück** – nach so vielen Herstellungen hat sich das Rezept bezahlt
   - Punkt + Farbe = Skill-Farbe bei deinem Stand (orange/gelb/grün = gibt noch Punkte, grau = keine mehr)
5. **Klick auf eine Zeile** sucht das Rezept im AH (über Auctionator). **Shift-Klick** verlinkt es im Chat.
   **Maus drüber** zeigt die ganze Rechnung: Verkaufspreis, jede Zutat mit Quelle, Lernstufe, gelb/grau.

## Filter
- **Beide / Kochkunst / Leder**
- **Jetzt lernbar** (Standard) · **Bald (+25)** = bis 25 Skillpunkte über dir · **Alle**
- **Nur mit Skillpunkten** – blendet Rezepte aus, die bei dir schon grau sind

## So wird gerechnet
- **Verkaufswert:** günstigstes AH-Angebot des Ergebnisses × Menge, minus 5 % AH-Anteil. Bringt der Händler mehr
  (oder ist das Ergebnis seelengebunden), zählt der Händlerpreis.
- **Material:** je Zutat das Günstigere aus **Händler** (nur Zutaten mit unbegrenztem Vorrat, nur Händler deiner Fraktion;
  Preise, die du beim Händler siehst, lernt RezeptRadar automatisch) und **AH**. Beim AH wird für **5 Herstellungen**
  über die echten Preisstufen gerechnet – nicht nur das billigste Einzelstück. Reicht das Angebot nicht, steht „AH, knapp“.
- **Nicht in der Liste:** Rezepte, die du kannst, die gerade nicht im AH sind, die Ruf brauchen, bei denen eine Zutat
  nirgends zu haben ist, oder die gerade Verlust machen. Ist die Liste leer, steht darunter, wie viele es davon gibt.

## Befehle
`/rr` Fenster · `/rr scan` Scan (AH offen) · `/rr reset` Fensterposition · `/rr fehler` gespeicherte Fehler

## Was nur im Spiel prüfbar ist
- Ob der Komplett-Scan auf deinem Server vollständig ankommt (Angebotszahl in der Scan-Karte).
- Ob „Berufsfenster einmal öffnen“ alle gelernten Rezepte erkennt (Forever liefert manche Rezepte mit anderer Nummer – RezeptRadar ordnet dann über das hergestellte Item zu).
