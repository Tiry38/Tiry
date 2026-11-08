# Changelog – Tiry's Zentrale

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
