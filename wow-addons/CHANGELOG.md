# Changelog – Tiry's Zentrale

## 6.1.0 (11.11.2026)
**Item-Tooltip als Preis-Liste – wie Auctionator, nur stylischer.**
- Zweispaltig und sauber ausgerichtet: **Marktwert** (Median deiner Scan-Tage, max. 14), **Durchschnitt**, **Min · Max**.
- **Preis-Schieber:** zeigt, wo der aktuelle AH-Preis zwischen Min und Max liegt – mit Urteil **günstig / normaler Preis / teuer** und Abstand zum Marktwert in %.
- **Trend** (+/− % gegenüber den Vortagen), **Verkauft pro Tag**, **Im Angebot** (Stück + wie viele Tage das reicht, „Markt voll“ in Rot).
- **Deine Verkäufe:** Verkaufsquote und dein Ø-Erlös pro Stück aus dem Verkaufsbuch.
- **Netto nach Gebühr** pro Stück und für den vollen Stapel, **Nicht unter** (derselbe Wert wie im Craft-Planer).
- Look: Logo + Absatz-Klasse im Kopf, farbige Leuchtpunkte je Gruppe (Preis grün, Absatz türkis, deine Verkäufe blau, Verkaufen orange), Trennlinien als Neon-Verlauf. Nur Zeilen mit Daten werden gezeigt.
- Vorschau: `previews/Zentrale_Tooltip_6.1.png`.

## 6.0.0 (10.11.2026)
**Neues Design „Neon-Glas“ – chicer als LevelPilot.**
- **Dock-Navigation:** fünf runde Leuchtknöpfe oben (Start · Herstellen · Farmen · Handel · Mein Gold) mit Blizzard-Symbolen. Lernen (?) und Einstellungen (Zahnrad) sitzen als runde Knöpfe oben rechts neben Suche und „AH scannen“.
- **Leichter zu verstehen:** „Markt“ und „Auktionen“ sind jetzt ein Punkt **„Handel“** (Meine Auktionen zuerst). „Craften“ heißt **„Herstellen“**. Reiter als Pillen, die aktive leuchtet im Verlauf.
- **Glas überall:** Anthrazit-Glas, Neon-Grün/Türkis-Verläufe, weiche Glows, große Radien. Kennzahlen (Auktionen, Ergebnis, Taschen-Check, Farm-Session, Verkaufsbuch, Goldtagebuch) als **Glas-Pillen mit Leuchtpunkt**. Startseite mit Begrüßung, Gold und Berufs-Chips.
- **Einstellungen in Gruppen:** Automatik · Hinweise & Radar · Gold-Rechnung · Ansicht. Einkaufsfenster und Händler-Panel im selben Look.
- **Handel → Preise:** neue Spalte **„Pro Tag“** (gemessene Verkäufe) und Ansicht **„Schnäppchen“**.

**Gold-Logik neu durchdacht (Forever-Stand 10.11.2026).**
- **Einstellgebühr im Gewinn.** Forever verlangt je Angebot mindestens 1 Silber (Wowhead, 05.11.); sie kommt bei Verkauf zurück, verloren ist sie bei Ablauf oder Abbruch. Jeder Gewinn (Craft-Planer, Rezept-Tipps, Skill-Plan, Taschen-Check, Händler-Flips, Händler-Autopilot) zieht jetzt das **Risiko** ab: Gebühr je Stück × erwartete Fehlversuche (aus deiner Verkaufsquote bzw. dem gemessenen Absatz). Bei offenem AH nimmt das Addon Blizzards **exakten** Betrag und merkt ihn sich; vorher schätzt es (Minimum aus den Einstellungen, sonst Anteil am Händlerpreis).
- **Neu: Absatz-Messung („Verkäufe pro Tag“).** Bei jedem Komplett-Scan liest Tiry's Zentrale die Angebotsliste mit und vergleicht sie mit dem letzten Scan: Was vor Ablauf verschwunden ist, wurde gekauft (Umstellen desselben Verkäufers zählt nicht). Daraus: **Schnelldreher / verkauft sich / Ladenhüter** und „~35/Tag verkauft · 240 im Angebot“ – auch im Item-Tooltip. Zwei Scans im Abstand von 15 Min. bis 12 Std. reichen für den Start.
- **Kleinvieh macht auch Mist.** Craft-Empfehlungen sortieren nach **realistischem Gold pro Tag** (Gewinn × dein Anteil an den Tagesverkäufen): billige Massenware mit hohem Absatz steht vor teuren Ladenhütern; Ladenhüter fallen raus. Die empfohlene Herstell-Menge nutzt den gemessenen Markt, solange du selbst noch nichts verkauft hast.
- **Goldwege aktualisiert:** neu „Kleinvieh – Schnelldreher“ und „Handwerker-Aufträge (Writs)“ (seit Hotfix 09.11. auch in Dungeons, +50 % EP). Kisten, Kürschnern (Leder roh und zügig verkaufen, Gerbgestell ab 125), Wetzsteine, bekannter Unterbieten-Fehler im AH.
- **Schneller:** Das Verkaufsbuch wird pro Änderung einmal zusammengefasst – große Craft-Listen rechnen etwa 5× schneller.

**Goldmacher-Werkzeuge (aus Goldmacher-Praxis, auf Forever angepasst).**
- **Schnäppchen-Scan:** Jeder Komplett-Scan prüft JEDES Angebot. „Unter Händlerpreis“ = kaufen, beim Händler verkaufen, sicherer Gewinn (der Verkaufen-Knopf beim Händler nimmt sie danach mit). „Unter Marktwert“ = höchstens 65 % deines 14-Tage-Marktwerts, kein Ladenhüter, Gewinn nach AH-Gebühr und Einstellgebühr-Risiko. Liste per `/tz schnapp`, Suche mit einem Klick in Auctionator. Gekauft wird nie automatisch – das bleibt dein Klick.
- **Preis-Trend:** Steigt oder fällt ein Item gegenüber seinem 14-Tage-Mittel? „Verkaufen statt horten“ bzw. „halten lohnt“ im Taschen-Check und im Item-Tooltip.
- **Markt-Tiefe:** Für wie viele Tage reicht das aktuelle Angebot beim gemessenen Absatz? Über 2 Wochen = **„Markt voll“** – nicht nachlegen.
- **Beste Verkaufszeit:** Wann im AH am meisten gekauft wird (gemessen) bzw. wann deine Sachen weggehen, plus stärkster Wochentag. Tipp: kurz davor einstellen.
- **Rohstoff-Check:** Lohnt Verarbeiten (z. B. Leder zu Rüstungsset) mehr als roh verkaufen? Steht direkt am Item im Taschen-Check.
- **„Kaufen bis“ in der Einkaufsliste:** höchster Stückpreis je Material, bei dem dein Craft noch den Mindestgewinn bringt – auch über selbst hergestellte Zwischenprodukte. Liegt der AH-Preis drüber, warnt die Liste: lieber warten.
- **Neu einstellen mit Maß:** Empfohlene Menge = Verkäufe von ~3 Tagen (Markt nicht fluten, Preis halten). „Nicht unter“ rechnet jetzt auch das Einstellgebühr-Risiko mit ein – im Item-Tooltip, Craft-Planer und in Meine Auktionen derselbe Wert.

**Ein AH-Scan für alle Reiter.**
- Der Scan-Knopf startet bevorzugt den **Komplett-Scan** (alle 15 Min. erlaubt): Preise, Absatz, Markt-Tiefe, Schnäppchen und der Unterboten-Check deiner Stapelware kommen in **einem** Durchgang – kein Reiter muss einzeln neu gesucht werden. Ist der Komplett-Scan gesperrt, aktualisiert der Schnell-Scan trotzdem alle Preise. Abschaltbar: Einstellungen → „Komplett-Scan“.
- Die Knöpfe in den einzelnen Reitern heißen jetzt „Angebote zeigen“ – sie sind nur zum Kaufen da, nicht zum Aktualisieren.
- Schutz: Kommt ein Scan nur halb an (Blizzard drosselt), zählt Tiry's Zentrale das Fehlende **nicht** als verkauft.

**Aus den Goldmacher-Foren (Stand 10.11.).**
- **Ausrüstung ohne Kupfer:** Einzel-Items werden in ganzen Silbern vorgeschlagen (3g 45s 27c → 3g 45s). Blizzard bestätigt am 09.11.: „Kupfer weglassen hilft“ gegen den „Internen Auktionsfehler“.
- **Nie unter Händlerpreis:** „Nicht unter“ berücksichtigt jetzt auch den Händlerpreis (nach Gebühr und Gebühr-Risiko) – auch bei gefundenen, nicht hergestellten Items.
- **2× abgelaufen, nie verkauft:** Hinweis beim Neu-Einstellen „billiger oder zum Händler“ – jedes weitere Einstellen kostet Gebühr.
- **Goldwege:** neu „Vor dem Raid-Start auf Vorrat legen (ab 09.12.)“; Waylaid-Kisten: leere Kiste vs. Paket, günstigste Gunst.

**Texte auf Forever-Stand.**
- **AH-Schule** neu: eigener „AH scannen“-Knopf statt Auctionator-Reiter, Anzahlung 1 Silber (zurück bei Verkauf, weg bei Ablauf/Abbruch), Ausrüstung in ganzen Silbern, Unterboten über „Meine Auktionen“, Menge nach Verkäufen pro Tag.
- **Glossar:** Einstellgebühr und Scan aktualisiert. Befehle neu: `/tz handel`, `/tz schnapp`, `/tz buch`.

## 5.8.1 (08.11.2026)
- **Selbst herstellen nur noch bei Zwischenprodukten mit Zusatz** (z. B. Balg + Salz → Geschmeidiger Balg). Reine Umwandlungen aus einem einzigen Material (Lederfetzen → Leichtes Leder, Leichtes → Mittleres Leder) werden nicht mehr vorgeschlagen – Leder wird gekauft.

## 5.8.0 (08.11.2026)
**Herstellen mit echten Zahlen.**
- **Neu: Craften → „Ergebnis“.** Was dir Herstellen wirklich gebracht hat: hergestellt, verkauft, echter Gewinn pro Stück und gesamt (7/30/60 Tage). Materialkosten = was du im AH wirklich bezahlt hast (Ø 30 Tage), Erlös = Verkaufsbrief. Verlust-Rezepte sind rot markiert.
- **Empfohlene Menge („Je Rezept: auto“, neuer Standard).** Pro Rezept so viele, wie sich bei dir in einer Woche verkaufen, minus was schon in Taschen, Bank und im AH liegt. Ohne Verkaufsdaten vorsichtig: 2 Stück (Stapelware 5). Im Craft-Planer steht pro Rezept „mach 3×“ oder „schon 4 im Umlauf“.
- **Craft-Planer:** zeigt bei Rezepten mit Verkäufen den echten Gewinn pro Stück.
- **Neu einstellen (Auktionen):** unterbotene, abgelaufene und frisch hergestellte Items mit Preisvorschlag (günstigstes Angebot minus 1 Kupfer, nie unter „Nicht unter“). Liegt der Markt unter deinen Kosten: Hinweis „lieber warten“. „Neu einstellen: Suchliste“ legt alles als Auctionator-Liste an. Einstellen selbst bleibt ein Klick in Auctionator.
- **Skillen mit Gewinn (Was lernen?):** Der Skill-Plan rechnet netto – Material minus AH-Verkauf des Ergebnisses – und nimmt Material, das du günstiger selbst herstellst. Rezepte, die beim Skillen Gold bringen, gewinnen.
- **Startseite:** Wochenbilanz im Gold-Kreislauf („Diese Woche: +12g echt verdient · 8 verkauft · bestes: …“).

## 5.7.0 (08.11.2026)
**Craft-Planer sortieren:** Klick auf MATERIAL, VERKAUF oder GEWINN sortiert teuer zuerst, nochmal klicken günstig zuerst. Ein Pfeil zeigt die Richtung. Die Wahl bleibt gespeichert.

**Neues Rezept gelernt ohne aktuellen AH-Preis:** Hinweis im Chat, und beim nächsten Öffnen des Auktionshauses wird sofort gescannt (nicht erst nach 30 Minuten). Danach steht das Rezept automatisch im Craft-Planer, wenn es Gewinn bringt.

## 5.6.2 (08.11.2026)
**„Nächstes craften“ meldet sich, wenn die nächste Sorte dran ist.**
- Blizzard erlaubt pro Klick nur einen Herstell-Auftrag (eine Sorte, beliebig viele Stück). Ist eine Sorte fertig und du hast Material für die nächste: Der Knopf leuchtet grün, ein kurzer Ton kommt, oben steht „Fertig! Als Nächstes: 4× Dunkle Lederschultern“.
- Klick (oder die Taste aus der Tastaturbelegung) startet die nächste Sorte, das Leuchten geht aus.

## 5.6.1 (08.11.2026)
**Herstellungs-Balken: Gesamtdauer der ganzen Liste.**
- Oben wie bisher der aktuelle Craft mit Sekunden. Neu darunter: „Gesamt: 2:35 Min. · 12 Crafts“ – alles, was noch auf der Liste steht, inkl. selbst hergestellter Zwischenprodukte.
- Die Dauer je Rezept lernt das Addon beim Herstellen. Unbekannte Rezepte werden mit der aktuellen Dauer geschätzt („ca.“).

## 5.6.0 (08.11.2026)
**Selbst herstellen oder kaufen? Das Addon rechnet es für jedes Material aus.**
- Beispiel: Geschmeidiger mittlerer Balg. Ist Mittlerer Balg + Salz günstiger als der fertige Balg im AH, rechnet der Craft-Planer mit dem günstigeren Weg.
- Gilt für alle Zwischenprodukte (Bälge, Leder, Stoffballen, Barren …), auch mehrstufig – aber **nur mit Rezepten, die du selbst gelernt hast, in Berufen, die du hast**. Nie Rezepte fremder Berufe.
- Einkaufsliste: kauft die günstigeren Rohstoffe statt des fertigen Zwischenprodukts. Was du davon schon in den Taschen hast, wird zuerst verbraucht.
- „Du stellst her“ und „Nächstes craften“: erst die Zwischenprodukte (blau, „selbst, spart Gold“), dann die eigentlichen Crafts.
- Craft-Planer: Hinweis „… selbst herstellen“ am Rezept, im Material-Tooltip steht der Kaufpreis zum Vergleich.

## 5.5.1 (08.11.2026)
**Auktionen: Gold zeigt jetzt den echten Weg – unterwegs, im Briefkasten, abgeholt.**
- Nach einem Verkauf verschickt das Spiel das Gold mit Verzögerung (Blizzard-Code: die Auktion bleibt bis dahin als „Verkauft“ mit Restzeit in deiner Auktionsliste). Bisher stand sofort „im Briefkasten“ – falsch. Jetzt: **unterwegs** (mit Restzeit), dann **im Briefkasten**, dann **abgeholt**.
- „Im Briefkasten“ wird es erst, wenn der Brief wirklich da ist: Briefkasten geöffnet, Blizzard meldet neue Post vom Auktionshaus, oder die gemessene Lieferzeit ist um („sollte im Briefkasten sein“).
- Die Lieferzeit misst das Addon selbst (Verkauf → Brief) und nimmt den Mittelwert der letzten 10 Verkäufe. Am AH wird die Restzeit direkt aus der Auktionsliste übernommen.
- Verkäufe, während du offline warst, werden nachgetragen (aus der Auktionsliste am AH oder aus dem Verkaufsbrief).
- Betrag im Briefkasten = exakter Betrag aus dem Brief.
- „Gold abholen“ auf der Startseite erst, wenn das Gold angekommen ist.

**Craft-Planer: Mindestgewinn „alles“ zeigt jetzt wirklich alles mit Gewinn.**
- Bisher galt intern trotzdem ein Zuschlag von 15 % der Materialkosten – Rezepte mit kleinem Gewinn (z. B. 2 Silber bei 25 Silber Material) fehlten. Bei „alles“ zählt jetzt jeder Gewinn ab 1 Kupfer.

## 5.5.0 (08.11.2026)
**Hauptthema ist jetzt Gold durch Herstellen: Material kaufen, herstellen, teurer verkaufen.**
- **Startseite = Gold-Kreislauf** mit vier Schritten, je einem Knopf und Haken, wenn erledigt. Der orange Schritt ist dran.
  1. **Planen:** „X Rezepte bringen gerade Gold – bis zu Y pro Stück“ → **Liste erstellen** (für alle deine Berufe auf einmal).
  2. **Einkaufen:** fehlendes Material und Kosten → Einkaufsliste.
  3. **Herstellen:** wie viele Stück jetzt gehen → Nächstes craften.
  4. **Verkaufen:** hergestellte Items in der Tasche mit Wert → Verkaufsliste.
- **Startseite entrümpelt:** „Heute für dich“, „Top 3“ und „Schnellstart“ sind weg. Die Goldwege bleiben als Reiter. Ein Hinweis erscheint nur noch, wenn etwas außerhalb des Kreislaufs wichtig ist, z. B. Auctionator fehlt, Gold im Briefkasten oder alte Preise.
- **Neu im Craft-Planer: Schritt 4 „Verkaufen“.**
  - Liste deiner hergestellten Items mit AH-Preis, **„Nicht unter“** (deine Materialkosten pro Stück nach AH-Gebühr) und Wert. Liegt der AH-Preis unter deinen Kosten, steht dort „lieber warten“.
  - Knopf „Konkurrenz im AH prüfen“ und eine kurze Anleitung zum Einstellen mit Auctionator.
  - Gezählt wird nur, was du **wirklich hergestellt** hast (beim Abhaken gemerkt) oder was als Ergebnis auf deiner Liste steht. Material wie Leichtes Leder zählt nie.
- **Menü:** „Berufe“ heißt jetzt **„Craften“** und steht direkt unter Start. Der Berater-Reiter heißt **„Was lernen?“**.
- Ohne Herstellungsberuf schlägt der „nächste Schritt“ vor, einen zu lernen, statt nur Sammelberufe.

## 5.4.0 (08.11.2026)
- **Craft-Liste leert sich jetzt zuverlässig nach dem Herstellen.** Gemeldet von Tiry: 1× hergestellt, die Liste zeigte weiter 3×.
  - Vorher wurde nur über neue Items in der Tasche bei offenem Berufsfenster erkannt.
  - Jetzt gibt es **drei unabhängige Wege**: Blizzards Herstellungs-Meldung `TRADE_SKILL_ITEM_CRAFTED_RESULT` (Item + Menge), der gewirkte Rezept-Zauber `UNIT_SPELLCAST_SUCCEEDED` und als Rückfall das neue Item in der Tasche.
  - **Nie doppelt:** Pro kurzem Zeitfenster zählt das Maximum eines Weges. Der Taschen-Weg zählt nicht, wenn Blizzard dasselbe Rezept in den letzten 3 Sekunden schon gemeldet hat.
  - Im Chat steht „Hergestellt: 1× … – abgehakt, noch 2“. Craft-Liste und Einkaufsliste werden sofort kleiner.
- **Herstellungs-Balken in der Einkaufsliste:** Er zeigt Rezept, „noch N auf der Liste“, Fortschritt und Restzeit (z. B. „1,8 s“). Praktisch, wenn ein Fenster den Spiel-Balken verdeckt. Er erscheint nur bei Berufs-Zaubern (`UnitCastingInfo`: isTradeskill).

## 5.3.1 (08.11.2026)
- **Auktionen:** Jede Auktion zeigt jetzt Stückpreis **und Gesamtwert** (Menge × Preis). Darunter steht eine **Summenzeile**: „Zusammen: N Auktionen · X Stück“ mit Gesamtwert und „nach Gebühr ca. …“. Sie rechnet sich bei jedem Verkauf, jedem neuen Einstellen und jedem AH-Besuch neu. Abgelaufene zählen nicht mit.

## 5.3.0 (08.11.2026)
- **Eigener Menüpunkt „Auktionen“** (zwischen Markt und Mein Gold). Das Menü hat jetzt 8 Hauptpunkte.
  - **Kacheln:** Im AH (Anzahl) · **Wert im AH** · **Im Briefkasten** · Unterboten. Darunter „Heute verkauft“ und der Stand.
  - **Liste „Im Auktionshaus“:** Menge, dein Preis, günstigster fremder Preis, Status (unterboten / am günstigsten / abgelaufen – Post), Restzeit.
  - **Liste „Verkauft“:** Erlös nach AH-Gebühr und ob das Gold **im Briefkasten** liegt oder schon **abgeholt** ist.
- **Gold im Briefkasten**
  - **Verkauf (auch fern vom AH):** Die Auktion verschwindet aus „Im Auktionshaus“. Im Chat steht „Verkauft: … – ca. X kommt in deinen Briefkasten“, die Kachel „Im Briefkasten“ zählt hoch (geschätzt, „ca.“).
  - **Briefkasten öffnen:** Der genaue Betrag kommt aus den Verkaufsbelegen (GetInboxInvoiceInfo „seller“ mit Gold).
  - **Gold abgeholt:** Es verschwindet automatisch, und der Verkauf steht auf „abgeholt“.
  - **Beim Einloggen** kommt eine Erinnerung, wenn noch Gold im Briefkasten liegt. Auf der Startseite wird es zum „nächsten Schritt: Gold abholen“.

## 5.2.4 (08.11.2026)
- **Selbst gecraftet zählt als erledigt.** Stellst du im Berufsfenster etwas her, das auf der Craft-Liste steht, wird es abgehakt, auch ohne den Knopf „Nächstes craften“. Craft-Liste und Einkaufsliste schrumpfen sofort, und im Chat steht „Hergestellt: 2× … – abgehakt“. Vorher verlangte die Einkaufsliste danach das Material erneut.
- **Ruf-Rezepte komplett draußen.** 168 Rezepte gibt es nur mit Ruf bei einer Fraktion (aus den Spieldaten: MinFactionID des Rezept-Items). Sie erscheinen weder in „Lernen lohnt sich“ noch im Berufe-Berater.
- **Leere Liste nach versehentlichem ×:** Steht in der Liste nichts mehr, weil alles weggeklickt ist, erscheint dort der Knopf „Alle N ausgeblendeten Rezepte zurückholen“.

## 5.2.3 (08.11.2026)
- **× im Craft-Planer heißt jetzt: weg.** Die große „Ausgeblendet“-Chip-Wolke ist entfernt.
  - Nur das **zuletzt** ausgeblendete Rezept zeigt eine kleine Zeile „Rückgängig: …“, für ein Versehen.
  - Alle Ausgeblendeten auf einmal holst du still unter „Mehr Optionen“ > „Ausgeblendete (N)“ zurück.
- **Alte Platzhalter mit „OLD“ ausgefiltert**, z. B. „Muster: Doppelt genähte Lederhandschuhe OLD“. Das Rezept zeigt jetzt das echte Muster (Item 5974, Skill 160 statt fälschlich 125). Das gilt auch in der Item-Suche.

## 5.2.2 (08.11.2026)
- **AH-Scan und Unterboten-Prüfung laufen höchstens alle 30 Minuten**, statt bei jedem Öffnen. Wer oft am AH vorbeiläuft, kann sofort einstellen.
  - Den Abstand stellst du unter Einstellungen > „AH-Scan höchstens alle“ ein (5–240 Min., × setzt auf 30 zurück).
  - Eigene Auktionen lesen läuft weiter bei jedem Öffnen. Das ist eine einzige Abfrage, also sofort fertig.
  - „Jetzt prüfen“ unter Markt > Meine Auktionen geht jederzeit. Die Ansicht zeigt, in wie vielen Minuten die nächste automatische Prüfung fällig ist.

## 5.2.1 (08.11.2026)
- **Rezept-Empfehlungen passen jetzt genau zu deinem Skill.**
  - **Kaufbare Rezepte:** Die exakte Skill-Anforderung kommt aus den Spieldaten (ItemSparse.RequiredSkillRank, z. B. „Muster: Feine Lederhandschuhe“ = Lederverarbeitung 50). Sie werden als „jetzt lernbar“ gezeigt, oder als „ab Skill X (noch Y Punkte)“, wenn höchstens 10 Punkte fehlen. Vorher waren es bis zu ~40 Punkte darüber.
  - **Lehrer-Rezepte:** Die Lernstufe steht nicht in den Spieldaten. Als sicher lernbar gelten sie, wenn sie für dich schon gelb sind. Sonst steht dort „Lehrer: ab ca. Skill X“ (gelb minus 20, Median der 1.495 kaufbaren Rezepte; die Spanne reicht von 0 bis 40).
  - **„Lohnt sich“ ist strenger:** mindestens dein Mindestgewinn pro Craft, AH-Preis höchstens 3 Tage alt, kein Ladenhüter, Rezept nach höchstens 30 Crafts bezahlt. Jetzt lernbare Rezepte stehen zuerst.
  - Wie bisher nur für deine eigenen Berufe.

## 5.2.0 (08.11.2026)
- **Rezepte zum Kaufen werden als Rezept angezeigt** (Muster, Pläne, Formel, Rezept, Bauplan …), nicht mehr als das Item, das sie herstellen.
  - Die Zuordnung Rezept → Rezept-Item stammt **exakt aus den Forever-Spieldaten**: Ein Rezept-Item hat als zweiten Effekt den Rezept-Zauber (ItemXItemEffect/ItemEffect, Build 70862). Neuer Generator `tools/gen_recipe_items.py`, neue Datei `Data_RecipeItems.lua`.
  - Ergebnis: 1.496 von 1.967 Rezepten haben ein Rezept-Item. Die übrigen lernt man beim Lehrer und sie sind als „(Lehrer)“ markiert.
- **Craft-Planer → „Lernen lohnt sich“:**
  - Jede Zeile zeigt das Rezept-Item mit Gewinn pro Craft, Preis des Rezepts im AH und „nach X Crafts bezahlt“. Ein Hinweis „gibt dir Skill“ zeigt, ob es zum Skill-Plan passt.
  - **Klick** sucht das Rezept im AH. **Shift-Klick** legt es in die Auctionator-Suche.
  - Der Knopf heißt in dieser Ansicht „Rezepte suchen“: Bei offenem AH sucht er alle angezeigten Rezepte, sonst legt er die Auctionator-Liste „Zentrale: Rezepte“ an.
- **Berufe-Berater → „Hol dir diese Rezepte“:** die 8 lohnendsten Rezepte, die du noch nicht kannst, über alle deine Berufe. Spalten: Gewinn/Craft, Rezept im AH, Bezahlt nach. Dazu der Knopf „Alle Rezepte im AH suchen“.

## 5.1.0 (08.11.2026)
- **Neu: Markt → Meine Auktionen**
  - **Beim Öffnen des AH, ohne Klick:** Tiry's Zentrale liest deine eigenen Auktionen (`C_AuctionHouse.QueryOwnedAuctions`).
  - **Unterboten-Prüfung:** Für jedes Item werden die günstigsten **fremden** Angebote abgefragt, gedrosselt nach Blizzards Takt (`AUCTION_HOUSE_THROTTLED_SYSTEM_READY`). Ergebnis im Chat, als Zahl am Menüpunkt „Markt“ und als „nächster Schritt“ auf der Startseite.
  - **Verkäufe** erkennt das Addon **überall**, auch fern vom AH. Blizzard meldet sie mit `AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION` (laut Blizzard-Code „whether or not AH UI is shown“). Der Eintrag wandert dann sofort in „Verkauft“.
  - Abgelaufene Auktionen werden als „abgelaufen – Post“ markiert.
  - „Unterbotene als Suchliste“ für Auctionator. Verkaufte Einträge lassen sich per × entfernen.
  - Ehrlich: Ob du unterboten wurdest, sieht man nur **am AH**. Fremde Angebote liefert Blizzard nur dort.
- **AH automatisch scannen:** Nach der Unterboten-Prüfung startet beim Öffnen des AH von selbst der Preis-Scan von Auctionator. Auctionator erlaubt ihn alle 15 Minuten; ist er gesperrt, bleibt es still. Beides ist in den Einstellungen abschaltbar.
- **Craft-Planer: Knopf „Aktualisieren“.** Er liest Berufe und Rezepte neu (bei offenem Berufsfenster auch neu gelernte), rechnet mit aktuellen Preisen und scannt bei offenem AH.
- **Behoben:** `Guide.lua` stand doppelt in der .toc und wurde zweimal geladen. Ein neuer Test prüft jetzt, dass jede Datei genau einmal geladen wird und existiert.

## 5.0.2 (08.11.2026)
- **Fehleranzeige funktioniert jetzt auch in Forever.** Tirys Test zeigte, dass Forever Fehler nicht an eigene Fehler-Handler weiterreicht. Tiry's Zentrale fängt Fehler deshalb selbst ab, an diesen Stellen:
  - Ereignisse, Timer und Seitenaufbau
  - **alle Knöpfe**: Klick, Maus drüber, Ziehen (18 Knopf-Arten über `UI.SafeButton`/`UI.Guard`)

  Ein Fehler bricht nie das Fenster und steht rot im Chat. `/tz fehlertest` läuft jetzt über denselben Weg.

## 5.0.1 (08.11.2026)
- **Eigene Fehleranzeige:** Im WoW-Forever-Client erschien bei Tiry selbst mit `scriptErrors 1` kein Fehlerfenster. Fehler aus Tiry's Zentrale stehen jetzt direkt im Chat (rot, einmal pro Fehler) und werden gespeichert.
  - `/tz fehler` zeigt die letzten 10 gespeicherten Fehler.
  - `/tz fehler leeren` leert die Liste.
  - `/tz fehlertest` löst einen Testfehler aus, um die Anzeige zu prüfen.
  - Die Fehlerbehandlung anderer Addons und des Spiels läuft unverändert weiter.

## 5.0.0 (08.11.2026)

### Neu (jeweils mit Nutzen für Einsteiger)
- **Einsteiger-Assistent** beim ersten Öffnen, 3 Schritte: was erkannt wurde, Preis-Status, erster Goldweg. *Nutzen: Man weiß nach 30 Sekunden, was das Addon kann und was zu tun ist.* Erneut aufrufbar über `/tz assistent` oder die Einstellungen.
- **„Dein nächster Schritt“** oben auf der Startseite: genau eine Handlung mit Knopf. Beispiele: Auctionator fehlt → Post läuft ab → Preise alt → Preisalarm → einkaufen/craften → Taschen verkaufen → Liste erstellen → Sammelberuf lernen → farmen. *Nutzen: nie mehr „Was mache ich jetzt?“.*
- **Berufe-Berater:**
  - Welche Sammelberufe auf deinem Level gerade am meisten bringen, nach Live-AH-Preisen.
  - Passender Herstellungsberuf für deine Klasse.
  - **Skill-Plan:** der günstigste Weg zum nächsten Skill-Ziel mit deinen Rezepten, Erfolgschance nach Skill-Farbe eingerechnet, Materialliste dazu. Ein Klick legt den Plan in die Craft-Liste und die Einkaufsliste.
  - *Nutzen: Berufe wählen und skillen ohne Gold zu verschwenden.*
- **Farm-Session:** Start und Stopp, Gold und Beutewert live, Gold pro Stunde, Bestmarke, frühere Sessions mit × löschbar. Händler- und Post-Einnahmen werden nicht doppelt gezählt. *Nutzen: Man sieht ehrlich, welcher Spot sich lohnt.*
- **Preisalarm:** Item suchen, Wunschpreis eintragen. Meldung nach jedem Scan und bei jeder AH-Suche, dazu eine Zahl am Menüpunkt. *Nutzen: günstig einkaufen, ohne dauernd das AH abzusuchen.*
- **Globale Suche** über Items, Rezepte, Goldwege und Begriffe (Feld in der Seitenleiste, `/tz suche`, Tastenkürzel). Enter öffnet den ersten Treffer.
- **Glossar:** 20 Begriffe in einfacher Sprache.
- **„Neu in Forever – deine Chancen“** auf der Startseite: 12 neue seltene Materialien und Alchemie-Produkte mit Live-Preis. Deine Berufe stehen vorn, ein Klick sucht im AH.
- **Tastenkürzel** (Bindings.xml): Fenster, Suche, Einkaufsliste, Nächstes craften.
- **Fenster:** per Ziehgriff unten rechts skalierbar, rastet an Bildschirmrändern und in der Mitte ein, passt sich kleinen Bildschirmen automatisch an.
- **Experten-Modus** (Einstellungen): Die Preisformeln im Craft-Planer sind nur dort sichtbar.
- **Kampf-Sperre:** Kaufen, Verkaufen, Craften, Schrottverkauf und Reparatur passieren nie im Kampf.

### Ausgemistet / geändert (mit Grund)
- **Menü von 12 auf 7 Hauptpunkte:** Start · Farmen · Berufe · Markt · Mein Gold · Lernen · Einstellungen. Die bisherigen Seiten sind jetzt Reiter darunter. *Grund: Übersicht – 12 gleichrangige Punkte waren zu viel.* Der zuletzt benutzte Reiter wird gemerkt.
- **Fremde Markennamen aus der Oberfläche entfernt** („wie TSM“, „wie Leatrix Plus“, „Profi-Strings (wie TSM)“ → „Preisformeln“). *Grund: eigene Marke, keine Verwechslung.* Die Quellenangaben (QuestieDB, Spieldaten, Poppins) bleiben in `LIZENZ.txt` und in den Hinweisen.
- **Toter Code entfernt:**
  - `Recipes.SetMargin`, `Recipes.StyleText`, `Recipes.RequiredMargin`: Prozent-Filter, seit 4.x nicht mehr in Benutzung.
  - `ns.MoneyIcons`: nie aufgerufen.
  - Der Zweig `C_TradeSkillUI.GetAllRecipeIDs`: diese Funktion gibt es in Forever nicht.
- **Item-Datenbank umgebaut:** Sie wird nicht mehr komplett eingelesen, sondern über einen Index nach ID abgefragt. *Grund: 17,5 MB Speicher und 76 ms Ruckler beim ersten Tooltip.* Ein Load-on-Demand-Modul gibt es **nicht**, Begründung in `AUDIT.md` Abschnitt 5.
- **Item-Suche:** Ohne Suchwort wird nichts mehr komplett geladen. Interne Platzhalter („DNT“, „NYI“, „OBSOLETE“) werden ausgeblendet.
- **Mindestschriftgröße 12** überall (vorher teils 10 und 11).
- **Datenalter ehrlich beschriftet:** „Preise von vor X“ statt „Scan vor X“, weil Auctionator die Preise auch bei normalen Suchen aktualisiert.
- Wegpunkt- und Suchknopf sitzen jetzt in der Seitenleiste, weil sie im Kopfbereich mit langen Untertiteln kollidierten.

### Behoben (Details mit Datei:Zeile in AUDIT.md)
- Schnäppchen-Radar: Einzel-Auktionen wurden als Stückpreis gelesen, dadurch waren die Ersparnisse falsch.
- Bankbestand zählte die Taschenplätze der Bank statt der Fächer.
- Flip-Kauf: falsche Menge bei Händlerware im Bündel.
- AH-Scan-Knopf meldete „Scan läuft/fertig“, obwohl Auctionator den Scan in der 15-Minuten-Sperre abgelehnt hatte.
- Schrott wird nur noch verkauft, wenn der Händler Blizzards Schrott-Knopf anbietet. Reparatur und Schrottverkauf laufen in `pcall`.
- Berufe lesen klappt das Skill-Fenster des Spielers nicht mehr auf.
- Rezepte im Berufsfenster werden auch bei aktivem Suchfeld oder Filter gefunden.
- Kleinere Punkte:
  - Rückgabewerte von `RegisterEvent`, `OpenTradeSkill` und `SetUserWaypoint` werden geprüft.
  - `## Category` in der .toc ergänzt.
  - Falsche Listennamen in Chat-Meldungen korrigiert.
- Drei Zeichen, die es in der Schrift nicht gibt (★, ↺, →), sind ersetzt. Ein neuer Test verhindert das künftig.

### Prüfung
- `luacheck`: 0 Warnungen, 0 Fehler
- `busted`: 20/20
- `tests/run_tests.lua`: 816/816
- Layout-Prüfung: 0 Probleme

## 4.5.0 und früher
Siehe Git-Verlauf: Anthrazit/Neon-Grün-Design, Horde-Motive, orange Hervorhebungen, alles rückgängig machbar, Händler-Einkauf per Klick, Craft-Planer mit Einkaufsliste, Verkaufsbuch, Schnäppchen-Radar, Kürschner-Zentrale, komplette Item-Datenbank.
