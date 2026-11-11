-- Tiry's Zentrale – Guide-Inhalte (Stand: WoW Forever 1.60.1, November 2026)
-- Kennzeichnung: forever = für Forever bestätigt (Blizzard/große Guides), classic = bewährtes Classic-Wissen,
-- das in Forever noch nicht offiziell bestätigt ist. Live-Preise prüfen immer die Wirklichkeit deines Servers.
local _, ns = ...
local P = ns.PROF

ns.METHOD_CATS = {
  { value = "all", label = "Alle" },
  { value = "noprof", label = "Ohne Beruf" },
  { value = "gather", label = "Sammelberufe" },
  { value = "craft", label = "Handwerk" },
  { value = "trade", label = "Handel & AH" },
  { value = "class", label = "Klassen-Tricks" },
}

ns.METHODS = {
  {
    key = "junk", cat = "noprof", minLevel = 1, effort = 1, source = "forever", icon = "bag",
    title = "Taschen ausmisten – richtig verkaufen",
    summary = "Das einfachste Gold: Grauen Schrott zum Händler, Wertvolles ins AH. Viele verschenken hier täglich Silber.",
    steps = {
      "Beim Händler auf den Müll-Knopf \"Schrott verkaufen\" klicken – alles Graue ist sofort weg.",
      "Öffne Tiry's Zentrale > Scanner > Taschen-Check: jedes Item bekommt einen Tipp \"Ins AH\" oder \"Händler\".",
      "Unbekannte neue Items (z. B. grüne Ausrüstung) vor dem Verkaufen im AH nachschauen.",
      "Kleinkram, der nur ein paar Kupfer wert ist, bringt im AH kaum mehr als beim Händler: Die Anzahlung ist seit dem 10.11. zwar nur noch 1 Kupfer, aber 5 % AH-Gebühr und der Weg zum AH bleiben. Der Taschen-Check rechnet das für dich aus.",
    },
    tips = {
      "Taschen, die du verkaufen willst, nicht anlegen – sie werden nicht mehr automatisch ausgerüstet und bleiben so verkaufbar.",
      "Die Einstellgebühr bekommst du zurück, wenn das Item verkauft wird – verloren ist sie nur bei Ablauf. Tiry's Zentrale rechnet dieses Risiko in jeden Gewinn ein.",
      "Bekannter AH-Fehler (Blizzard-Forum, seit 06.11.): Einstellen UNTER dem günstigsten Angebot bricht teils mit \"Interner Auktionsfehler\" ab. Blizzard (09.11.): \"Kupfer weglassen hilft\" – betroffen ist vor allem Ausrüstung. Tiry's Zentrale schlägt für Einzel-Items deshalb nur ganze Silberbeträge vor.",
    },
  },
  {
    key = "cloth", cat = "noprof", farm = "cloth", minLevel = 5, effort = 1, source = "classic", icon = "pin",
    items = { 2589, 2592, 4306 },
    title = "Stoff sammeln (geht nebenbei)",
    summary = "Humanoide Gegner (Menschen, Orcs, Gnolle, Trolle …) lassen Stoff fallen. Schneider und Erste-Hilfe-Spieler kaufen ihn ständig.",
    steps = {
      "Leinenstoff fällt bei niedrigen Humanoiden (etwa Level 5–15), Wollstoff etwa ab 15, Seidenstoff etwa ab 23.",
      "Beim Questen in Gebieten mit vielen Humanoiden jeden Gegner looten – nichts liegen lassen.",
      "Stapelware (Stoff, Kräuter, Erz …) mit der ganzen Menge als ein Angebot einstellen: Das Forever-AH verkauft sie stückweise, die Stapelgröße spielt keine Rolle – ein Angebot heißt weniger Klicks.",
      "Liegt der AH-Preis unter dem Händlerpreis, verkauf ihn beim Händler – Tiry's Zentrale zeigt dir beides.",
    },
    where = {
      Alliance = "Beispiele: Defias in Westfall, Gnolle im Rotkammgebirge (Classic-Erfahrung).",
      Horde = "Beispiele: Stacheleber und Kentauren im Brachland (Classic-Erfahrung).",
    },
    tips = { "Forever-Bonus: Die neuen \"Waylaid Crates\" verlangen u. a. 40 Leinenstoff oder 20 Leinenstoffballen – das erhöht die Nachfrage (Method.gg, 03.11.)." },
  },
  {
    key = "skinning", cat = "gather", farm = "leather", minLevel = 1, prof = P.SKINNING, effort = 1, source = "forever", icon = "pin",
    items = { 2318, 783, 2319, 249427 },
    title = "Kürschnerei – das beste Start-Gold",
    summary = "Jedes erlegte Tier wird zu Leder. Laut Mein-MMO der stärkste Goldberuf für den Anfang – perfekt zum Questen.",
    steps = {
      "Kürschnerei beim Lehrer in der Hauptstadt oder im Startgebiet lernen, Kürschnermesser beim Handwerkswarenhändler kaufen.",
      "Beim Questen jedes Tier häuten (Wölfe, Eber, Katzen, Raptoren …). Dein Skill steigt automatisch mit.",
      "Leichtes Leder und Leichte Bälge ab ca. Level 5–20, Mittleres Leder ab ca. Level 20.",
      "Selten fällt \"Makelloses Leder\" (neues Forever-Material) – das gehört ins AH, nicht zum Händler!",
      "Leder roh und zügig verkaufen, nicht horten: In der Startwoche sind die Lederpreise schnell gefallen (z. B. Schweres Leder in 3 Tagen um mehr als die Hälfte, timesaver.gg).",
    },
    tips = {
      "Perfektes Paar: Kürschnerei + Kräuterkunde oder Bergbau – zwei Sammelberufe = doppelte Beute.",
      "Lederverarbeitung: Den Gerbrahmen (Lager-Station am Lagerfeuer) kannst du seit dem Hotfix vom 06.11. schon mit Skill 125 herstellen (vorher 140). 48 Leder-Rezepte brauchen ihn – ob sich das Gerben lohnt, zeigt die Rezepte-Seite.",
      "Jäger und Druiden töten ohnehin viele Tiere – ideale Kürschner.",
    },
  },
  {
    key = "herbalism", cat = "gather", farm = "herb", minLevel = 1, prof = P.HERBALISM, effort = 1, source = "forever", icon = "pin",
    items = { 2447, 765, 2449, 785, 2450, 2453, 249399 },
    title = "Kräuterkunde – Alchemisten brauchen Nachschub",
    summary = "Pflanzen an der Minikarte pflücken. Alchemisten kaufen Kräuter für Tränke – die Nachfrage hört nie auf.",
    steps = {
      "Kräuterkunde lernen, dann \"Kräutersuche\" aktivieren: Kräuter erscheinen als gelbe Punkte auf der Minikarte.",
      "Friedensblume und Silberblatt gleich am Anfang, später Erdwurzel, Maguskönigskraut, Wilddornrose, Beulengras.",
      "Neu in Forever: Aus Kräutern von Erdwurzel bis Königsblut kann \"Gekräuselte Flechte\" fallen – selten und gefragt.",
      "Kräuter mit der ganzen Menge als ein Angebot ins AH (Stapelware wird stückweise gekauft). Tipp: In Forever läuft die Kräutersuche gleichzeitig mit der Jäger-Fährtensuche – aber nicht zusammen mit der Mineraliensuche.",
    },
    tips = {
      "Tauren pflücken dank \"Cultivation\" ein Kraut doppelt – starker Vorteil.",
      "Die Wiedererscheinung (Respawn) ist laut Blizzard in Startgebieten zum Start schneller und wird später normalisiert: jetzt farmen lohnt sich.",
    },
  },
  {
    key = "mining", cat = "gather", farm = "ore", minLevel = 1, prof = P.MINING, effort = 2, source = "forever", icon = "pin",
    items = { 2770, 2771, 2835, 2836, 249391, 774, 818 },
    title = "Bergbau – Erz, Steine und Pyrit",
    summary = "Erzadern abbauen. Schmiede und Ingenieure brauchen Kupfer, Zinn und Steine in großen Mengen.",
    steps = {
      "Bergbau lernen, Spitzhacke beim Handwerkswarenhändler kaufen, \"Mineraliensuche\" aktivieren.",
      "Neu in Forever: \"Poor Copper Vein\" in Startgebieten – schon ab Bergbau 1 abbaubar (Kupfererz + Rauer Stein).",
      "Kupfer- und Zinnadern können das neue Forever-Material \"Pyrit\" geben – im AH verkaufen.",
      "Edelsteine (Malachit, Tigerauge) einzeln prüfen: oft viel mehr wert als das Erz.",
    },
    tips = { "Erz verkauft sich meist besser als Barren – vergleiche beides in den Marktpreisen." },
  },
  {
    key = "scarce", cat = "gather", farm = "herb", minLevel = 1, effort = 2, source = "forever", icon = "star",
    items = { 249399, 249391, 249427 },
    title = "Seltene Forever-Materialien",
    summary = "Jede Pflanze, Ader und jedes häutbare Tier kann ein seltenes \"Scarce\"-Material droppen. Händler zahlen dafür fast nichts – Spieler viel.",
    steps = {
      "Gekräuselte Flechte (Kräuter), Pyrit (Erz) und Makelloses Leder (Kürschnern) nie zum Händler bringen.",
      "In den Marktpreisen unter \"Selten\" den aktuellen AH-Wert prüfen.",
      "Nicht alles auf einmal einstellen: Käufer brauchen oft nur wenige Stück – lieber nachlegen, wenn verkauft, statt den Preis selbst zu drücken.",
    },
    tips = { "Der Schwarzmarkt-Händler in Powderfuse Port verkauft seltene Materialien zum Festpreis – das ist die Preis-Obergrenze." },
  },
  {
    key = "crates", cat = "trade", minLevel = 10, effort = 1, source = "forever", icon = "cart",
    items = { 2770, 2771, 2447, 765, 2449, 785, 2450, 2589, 2996, 2318, 4231, 10940 },
    title = "Waylaid-Kisten-Material verkaufen",
    summary = "Die neuen \"Waylaid Crates\" (ab Level 10) wollen feste Mengen Grundmaterial. Wer liefert, verkauft schneller und teurer.",
    steps = {
      "Gefragt sind u. a.: 20 Kupfer- oder Zinnerz, 20 Friedensblume oder Silberblatt, 10 Erdwurzel/Maguskönigskraut/Wilddornrose.",
      "Außerdem 40 Leinenstoff, 20 Leichtes Leder, 20 Leinenstoffballen, 2 Geschmeidige leichte Bälge, 20 Seltsamer Staub.",
      "Kisten-Sammler kaufen genau diese Mengen zusammen – Stapelware kauft man im AH stückweise, entscheidend ist ein guter Stückpreis.",
      "Mit \"Als Einkaufsliste\" holst du dir alle Preise auf einen Klick in Auctionator.",
    },
    tips = {
      "Leere Kiste prüfen: Bringt sie im AH mehr als das billigste passende Paket, verkauf sie leer (Beta-Scan: leere Kiste 20s43, billigstes Paket 2s60 – im Spiel gegenchecken).",
      "Günstigste Gunst laut Beta-Daten: 2 Geschmeidige leichte Bälge = 10 Gunst (rund 43 Kupfer je Punkt). Gunst lässt sich nicht direkt in Gold tauschen.",
      "Die Mengen stammen aus Method.gg (Forever-Guide). Dass die Nachfrage steigt, ist eine Ableitung – prüf es an den Live-Preisen.",
      "Seit dem Hotfix vom 09.11. fallen Kisten auch in Dungeons – mehr Kisten im Umlauf heißt mehr Nachfrage nach den Paketen.",
      "Laut Beta-Tabellen (wow.gg) bringen 2 geschmeidige Bälge doppelt so viel Händler-Gunst wie 20 Leder derselben Stufe – geschmeidige Bälge dürften deshalb besonders gefragt sein (Ableitung).",
    },
  },
  {
    key = "smallfry", cat = "trade", minLevel = 5, effort = 1, source = "forever", icon = "scan",
    items = { 1251, 2581, 3530, 4238, 2304, 2862, 7964 },
    title = "Kleinvieh macht auch Mist – Schnelldreher",
    summary = "Gerade jetzt leveln sehr viele Spieler. Billige Massenware (Verbände, Taschen, Rüstungssets, Wetzsteine) geht ständig weg – kleiner Gewinn mal viele Verkäufe schlägt den großen Ladenhüter.",
    steps = {
      "Im AH zweimal scannen (15 Min. bis 12 Std. Abstand). Tiry's Zentrale misst daraus, wie viel sich pro Tag wirklich verkauft.",
      "Rezepte-Seite und Rezept-Tipps sortieren nach Gold pro Tag: Schnelldreher oben, Ladenhüter unten.",
      "Kleine Mengen einstellen und lieber täglich nachlegen statt horten – dann bleibt dein Preis vorne.",
      "Was als \"Ladenhüter\" markiert ist, nicht nachproduzieren – die Einstellgebühr frisst sonst den Gewinn.",
    },
    tips = { "Die Messung ist eine Schätzung: Angebote, die zwischen zwei Scans eingestellt UND gekauft werden, sieht niemand. Je öfter du scannst, desto genauer." },
  },
  {
    key = "writs", cat = "trade", minLevel = 10, effort = 1, source = "forever", icon = "cart",
    title = "Handwerker-Aufträge (Writs) nutzen",
    summary = "Gegner ab Stufe 10 lassen versiegelte Handwerker-Aufträge fallen – seit dem Hotfix vom 09.11. auch in Dungeons. Aufträge sind handelbar.",
    steps = {
      "Versiegelten Auftrag öffnen: Du bekommst einen zufälligen Auftrag dieser Stufe (Geselle, Experte, Fachmann).",
      "Abliefern braucht laut Forever-Guides keinen Beruf – den verlangten Gegenstand kannst du auch im AH kaufen.",
      "Belohnung: Ruf und ein Münzbeutel. Ist der verlangte Gegenstand teurer als die Belohnung, verkauf den Auftrag lieber im AH.",
      "Mit Beruf: Gegenstände, die Aufträge oft verlangen, auf Vorrat herstellen – Auftrags-Besitzer kaufen sie.",
    },
    tips = {
      "Dungeons geben seit dem 09.11. außerdem +50 % Erfahrung – Leveln und Aufträge sammeln geht jetzt in einem.",
      "Die Details (Belohnungen, Handel) stammen aus Beta-Daten (forevermastery.com) – im Spiel prüfen.",
    },
  },
  {
    key = "raidprep", cat = "trade", minLevel = 20, effort = 1, source = "forever", icon = "star",
    items = { 4304, 8170, 8173, 15564, 4265, 4234 },
    title = "Vor dem Raid-Start auf Vorrat legen (ab 09.12.)",
    summary = "Laut Forever-Fanseiten öffnen am 09.12.2026 die ersten Raids. Dann brauchen viele Stufe-60-Spieler gleichzeitig Leder, Rüstungssets und Verbrauchsgüter.",
    steps = {
      "Ab Ende November Dickes und Unverwüstliches Leder sowie Rüstungssets günstig kaufen oder herstellen, solange viele noch leveln.",
      "In der Woche vor dem 09.12. die Preise in den Marktpreisen beobachten: Steigt der Trend, stückweise verkaufen statt alles auf einmal.",
      "Nur so viel horten, wie sich laut Absatz-Messung in ein paar Tagen verkaufen lässt – der Rest kostet bei Ablauf Einstellgebühr.",
    },
    tips = {
      "Ableitung aus Classic-Erfahrung, kein Blizzard-Versprechen: Ob die Preise wirklich steigen, zeigt erst der Trend in deinen Scans.",
      "Der wöchentliche Reset-Tag für Forever ist noch nicht angekündigt – deine stärksten Verkaufstage lernt Tiry's Zentrale aus deinen Verkäufen.",
    },
  },
  {
    key = "flips", cat = "trade", minLevel = 1, effort = 1, source = "forever", icon = "scan",
    title = "Händler-Flips – kaufen und teurer verkaufen",
    summary = "Manche Händlerware (z. B. Rezepte mit begrenztem Vorrat) ist im AH viel mehr wert. Viele Rezepte sind in Forever aber seelengebunden – Tiry's Zentrale zeigt nur handelbare Flips.",
    steps = {
      "Auctionator einmal im AH scannen lassen (Reiter \"Auctionator\" > \"Scannen\").",
      "Danach jeden Händler ansprechen, an dem du vorbeikommst – Tiry's Zentrale meldet Flip-Chancen im Chat.",
      "Details im Scanner: Kaufpreis, AH-Erlös nach Gebühr und Gewinn pro Stück.",
      "Erst kaufen, wenn der Gewinn deutlich ist – und im AH kurz prüfen, ob es Käufer gibt.",
    },
    tips = { "Mit dem Legacy-Vorteil \"Bartering\" (Feilschen) kaufst du später bei Händlern günstiger – dann lohnen sich noch mehr Flips." },
  },
  {
    key = "cooking", cat = "craft", minLevel = 5, prof = P.COOKING, effort = 2, source = "forever", icon = "flask",
    items = { 2672, 769, 2673, 3173, 1015, 2924 },
    title = "Kochen – Essen mit Erfahrungs-Bonus",
    summary = "In Forever geben die meisten gekochten Essen mit Buff +5 % Erfahrung durch Kills. Levelnde Spieler wollen das.",
    steps = {
      "Kochkunst lernen (Nebenberuf – zählt nicht zu deinen zwei Hauptberufen).",
      "Fleisch beim Questen sammeln, am Lagerfeuer kochen.",
      "Prüf in \"Rezepte\" (nach einmal Berufsfenster öffnen), welches Essen über den Fleischkosten verkauft wird.",
      "Bonus: Schon ab Kochen-Skill 1 baust du ein \"Einfaches Lagerfeuer\" (1 Einfaches Holz) – Lager-Buffs für die Gruppe, und Stationen wie Gerbrahmen oder Spinnrad stellt man daneben auf. Das \"Lagerfeuer des Gesellen\" stellst du seit dem Hotfix vom 10.11. schon ab Kochen 90 auf (vorher 140).",
    },
    tips = { "Dass sich XP-Essen gut verkauft, ist eine Ableitung aus dem neuen Buff – die Live-Preise zeigen, ob es auf deinem Server stimmt." },
  },
  {
    key = "fishing", cat = "noprof", minLevel = 5, prof = P.FISHING, effort = 2, source = "classic", icon = "pin",
    items = { 6291, 6303, 6289, 6358, 6359, 21071 },
    title = "Angeln – ruhiges Gold",
    summary = "Nebenberuf, den jeder lernen kann. Köche kaufen Fisch, einige Fische braucht man für Tränke.",
    steps = {
      "Angeln beim Lehrer lernen, Angel beim Angelhändler kaufen.",
      "Rohe Fische in Seen und Flüssen der Startgebiete angeln.",
      "Öliges Schwarzmaul und Feuerflossenschnapper (Küste) sind für Alchemie/Kochen gefragt (Classic-Erfahrung).",
      "Fische ins AH, nur wenn der Stückpreis klar über dem Händlerpreis liegt.",
    },
    tips = { "Forever hat neue Fische, die nur zu bestimmten Zeiten beißen – neue Fänge immer im AH prüfen." },
  },
  {
    key = "tailoring", cat = "craft", minLevel = 5, prof = P.TAILORING, effort = 2, source = "forever", icon = "bag",
    items = { 4238, 4240, 4241, 5762, 5763, 4245 },
    title = "Schneiderei – Taschen gehen immer",
    summary = "Jeder Spieler braucht Taschen. Aus Stoff werden Taschen, die im AH oft mehr bringen als der Stoff.",
    steps = {
      "Schneiderei lernen, Faden beim Handwerkswarenhändler kaufen.",
      "Rezepte-Seite: Berufsfenster einmal öffnen, dann siehst du für jede Tasche den Gewinn.",
      "Nur herstellen, was grünen Gewinn zeigt – sonst lieber den Stoff direkt verkaufen.",
      "Wichtig in Forever: Hergestellte Sachen bringen beim Händler fast nichts (Blizzard hat die Preise gesenkt). Nur fürs AH herstellen!",
    },
    tips = { "Taschen nicht anlegen, wenn du sie verkaufen willst." },
  },
  {
    key = "firstaid", cat = "craft", minLevel = 5, prof = P.FIRST_AID, effort = 1, source = "forever", icon = "flask",
    items = { 1251, 3530, 118, 2678, 2447 },
    title = "Erste Hilfe – jetzt mit Heiltränken",
    summary = "Neu in Forever: Heiltränke gehören jetzt zur Ersten Hilfe (nicht mehr Alchemie). Schwacher Heiltrank = Leere Phiole + Milde Gewürze + Friedensblume.",
    steps = {
      "Erste Hilfe lernen (Nebenberuf).",
      "Milde Gewürze beim Händler kaufen, Friedensblumen sammeln oder kaufen.",
      "Rezepte-Seite zeigt, ob Heiltränke oder Verbände gerade Gewinn bringen.",
    },
    tips = { "Mit Kräuterkunde sparst du dir die Friedensblumen – dann ist fast alles Gewinn." },
  },
  {
    key = "alchemy", cat = "craft", minLevel = 5, prof = P.ALCHEMY, effort = 2, source = "forever", icon = "flask",
    items = { 2455, 3385, 2459, 2457, 2458, 5997 },
    title = "Alchemie – Tränke & Elixiere",
    summary = "Kräuterkunde + Alchemie gilt als starkes Gold-Paar: eigene Kräuter rein, Tränke und Elixiere raus.",
    steps = {
      "Alchemie lernen, Leere Phiolen beim Händler kaufen.",
      "Rezepte-Seite: Gewinn pro Trank prüfen – Kräuter werden mit Marktwert gerechnet.",
      "Gefragt sind Manatränke und Elixiere, die beim Leveln und in Dungeons helfen.",
    },
    tips = { "Achtung: Heiltränke sind in Forever zur Ersten Hilfe gewandert." },
  },
  {
    key = "stones", cat = "craft", minLevel = 5, prof = P.BLACKSMITHING, effort = 2, source = "forever", icon = "bolt",
    items = { 2862, 2863, 7964, 7965, 2835, 2836 },
    title = "Schmiedekunst – Wetzsteine",
    summary = "In Forever wirken Schamanen-Waffenverzauberungen jetzt zusätzlich zu Wetzsteinen und Ölen – mehr Spieler nutzen sie.",
    steps = {
      "Rauer Wetzstein aus Rauem Stein, Grober Wetzstein aus Grobem Stein herstellen.",
      "Rezepte-Seite: Gewinn gegenüber dem reinen Steinpreis prüfen.",
      "Kleine Mengen (5–10) einstellen und nachlegen, wenn verkauft.",
    },
    tips = {
      "Mit Bergbau sammelst du die Steine selbst.",
      "Laut foreverecon (10.11., US-Allianz) brachten Robuster Wetzstein (+3s) und Robuster Gewichtsstein (+4s) Gewinn pro Craft – prüf es an deinen Live-Preisen.",
    },
  },
  {
    key = "enchanting", cat = "craft", minLevel = 5, prof = P.ENCHANTING, effort = 2, source = "classic", icon = "star",
    items = { 10940, 10938, 10939, 10978 },
    title = "Verzauberkunst – Entzaubern",
    summary = "Grüne Ausrüstung entzaubern statt verkaufen: Seltsamer Staub und Magieessenzen sind oft mehr wert.",
    steps = {
      "Verzauberkunst lernen.",
      "Grüne Items (\"selten\") vor dem Verkauf mit Tiry's Zentrale prüfen: AH-Wert gegen Staubwert.",
      "Seltsamer Staub ist auch für Waylaid-Kisten gefragt (20er-Pakete).",
    },
    tips = { "Lohnt nur, wenn du viele grüne Items findest – sonst lieber zwei Sammelberufe." },
  },
  {
    key = "rogue", cat = "class", minLevel = 15, class = "ROGUE", effort = 2, source = "classic", icon = "star",
    items = { 16882 },
    title = "Schurke – Taschendiebstahl",
    summary = "Humanoide vor dem Kampf bestehlen: Münzen und Plunderkisten. Mit Schlossknacken öffnest du die Kisten selbst.",
    steps = {
      "Im Verstohlenheitsmodus hinter humanoide Gegner schleichen, \"Taschendiebstahl\" nutzen.",
      "Ramponierte Plunderkisten mit Schlossknacken öffnen – Inhalt verkaufen.",
      "Danach den Gegner normal looten: doppelter Gewinn pro Kill.",
    },
    tips = { "Klassisches Classic-Wissen – in Forever nicht offiziell bestätigt, aber die Plunderkiste existiert im Spiel." },
  },
}

-- AH-Schule (für Dummies)
ns.BASICS = {
  {
    title = "1. Einrichten und scannen",
    lines = {
      "Installiere Auctionator in der Version für WoW Forever (z. B. über CurseForge oder Wago) – Tiry's Zentrale nutzt seine Preisdatenbank.",
      "Auktionshaus öffnen und oben rechts in der Zentrale auf \"AH scannen\" klicken: Der Komplett-Scan liest alle Angebote deines Servers – für alle Reiter auf einmal.",
      "Blizzard erlaubt den Komplett-Scan nur alle 15 Minuten. Dazwischen macht der Knopf einen Schnell-Scan.",
      "Bei jedem AH-Besuch einmal scannen: Je öfter, desto genauer werden Marktwert und \"Verkäufe pro Tag\".",
    },
  },
  {
    title = "2. Verkaufen in 4 Klicks",
    lines = {
      "In Auctionator den Reiter \"Verkaufen\" öffnen. Links siehst du deine Taschen.",
      "Item anklicken: Auctionator schlägt einen Preis knapp unter dem günstigsten Angebot vor.",
      "Mit \"Nicht unter\" aus der Zentrale vergleichen (Tooltip oder Handel > Meine Auktionen) und \"Auktion erstellen\" klicken.",
      "Abgelaufene Auktionen kommen per Post zurück – Handel > Meine Auktionen zeigt, was sich neu einstellen lohnt.",
    },
  },
  {
    title = "3. Die goldenen Regeln",
    lines = {
      "Nie unter Händlerpreis verkaufen – dann lieber direkt zum Händler.",
      "Anzahlung beachten: Jede Auktion kostet mindestens 1 Kupfer (seit 10.11.2026, vorher 1 Silber), teure Ware mehr. Bei Verkauf kommt sie zurück, bei Ablauf oder Abbruch ist sie weg.",
      "Das AH behält beim Verkauf einen Anteil ein. Tiry's Zentrale rechnet standardmäßig mit 5 % (Classic-Wert) – änderbar in den Einstellungen.",
      "Einzel-Items (Ausrüstung) zu ganzen Silberbeträgen einstellen: Krumme Kupferbeträge lösen oft den \"Internen Auktionsfehler\" aus.",
      "Nicht panisch unterbieten: Wer 50 % billiger anbietet, verschenkt Gold. Wenige Kupfer darunter reichen.",
      "Nur so viel einstellen, wie der Markt schluckt: Die Zentrale nennt dir die Menge (\"Verkäufe pro Tag\").",
    },
  },
  {
    title = "4. Unterboten? So reagierst du",
    lines = {
      "Handel > Meine Auktionen zeigt nach jedem Scan, wer dich unterboten hat – mit Preisvorschlag, nie unter \"Nicht unter\".",
      "Abbrechen geht im AH bzw. im Abbruch-Reiter von Auctionator (englisch \"Cancelling\") – dann mit neuem Preis einstellen.",
      "Achtung: Abbrechen kostet die Anzahlung. Bei billigen Items oft lieber auslaufen lassen.",
      "Zweimal abgelaufen und nie verkauft? Dann billiger einstellen oder beim Händler verkaufen.",
    },
  },
  {
    title = "5. Einkaufen mit Listen",
    lines = {
      "Tiry's Zentrale legt Einkaufslisten in Auctionator an (Knopf \"Als Auctionator-Einkaufsliste\").",
      "Im AH: Reiter \"Einkaufen\" > Liste wählen > \"Suche alles\".",
      "So prüfst du in Sekunden alle Preise einer Farm-Methode.",
    },
  },
  {
    title = "Wichtig zu wissen",
    lines = {
      "Gold kaufen ist verboten: Blizzard sperrt verdächtige Konten mit \"Temporary Economy Holds\" (kein Handel, keine Post, kein AH).",
      "GDKP-Schlachtzüge (Gold für Beute) sind in Forever nicht erlaubt.",
      "Es gibt keinen WoW-Token – alles Gold auf deinem Server ist erspielt. Darum zählt jeder clevere Verkauf.",
    },
  },
}
