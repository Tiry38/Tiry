-- Goldrausch – Guide-Inhalte (Stand: WoW Forever 1.60.1, November 2026)
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
      "Öffne Goldrausch > Scanner > Taschen-Check: jedes Item bekommt einen Tipp \"Ins AH\" oder \"Händler\".",
      "Unbekannte neue Items (z. B. grüne Ausrüstung) vor dem Verkaufen im AH nachschauen.",
      "Kleinkram, der nur ein paar Kupfer wert ist, NICHT ins AH: Die Mindestgebühr liegt aktuell bei 1 Silber pro Auktion.",
    },
    tips = { "Taschen, die du verkaufen willst, nicht anlegen – sie werden nicht mehr automatisch ausgerüstet und bleiben so verkaufbar." },
  },
  {
    key = "cloth", cat = "noprof", farm = "cloth", minLevel = 5, effort = 1, source = "classic", icon = "pin",
    items = { 2589, 2592, 4306 },
    title = "Stoff sammeln (geht nebenbei)",
    summary = "Humanoide Gegner (Menschen, Orcs, Gnolle, Trolle …) lassen Stoff fallen. Schneider und Erste-Hilfe-Spieler kaufen ihn ständig.",
    steps = {
      "Leinenstoff fällt bei niedrigen Humanoiden (etwa Level 5–15), Wollstoff etwa ab 15, Seidenstoff etwa ab 23.",
      "Beim Questen in Gebieten mit vielen Humanoiden jeden Gegner looten – nichts liegen lassen.",
      "Volle 20er-Stapel ins AH stellen, nie einzelne Stücke (wegen der Mindestgebühr).",
      "Liegt der AH-Preis unter dem Händlerpreis, verkauf ihn beim Händler – Goldrausch zeigt dir beides.",
    },
    where = {
      Alliance = "Beispiele: Defias in Westfall, Gnolle im Rotkammgebirge (Classic-Erfahrung).",
      Horde = "Beispiele: Stacheleber und Kentauren im Brachland (Classic-Erfahrung).",
    },
    tips = { "Forever-Bonus: Die neuen \"Waylaid Crates\" verlangen u. a. 40 Leinenstoff bzw. Leinenstoffballen – das erhöht die Nachfrage." },
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
    },
    tips = {
      "Perfektes Paar: Kürschnerei + Kräuterkunde oder Bergbau – zwei Sammelberufe = doppelte Beute.",
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
      "Kräuter im 20er-Stapel ins AH. Tipp: In Forever läuft die Kräutersuche gleichzeitig mit der Jäger-Fährtensuche.",
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
      "Einzeln oder in kleinen Stapeln einstellen – Käufer brauchen oft nur wenige Stück.",
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
      "Stell diese Materialien in genau diesen Mengen ein (z. B. 20er-Stapel) – Kisten-Sammler kaufen ganze Pakete.",
      "Mit \"Als Einkaufsliste\" holst du dir alle Preise auf einen Klick in Auctionator.",
    },
    tips = { "Die Mengen stammen aus Method.gg (Forever-Guide). Dass die Nachfrage steigt, ist eine Ableitung – prüf es an den Live-Preisen." },
  },
  {
    key = "flips", cat = "trade", minLevel = 1, effort = 1, source = "forever", icon = "scan",
    title = "Händler-Flips – kaufen und teurer verkaufen",
    summary = "Manche Händlerware (vor allem Rezepte mit begrenztem Vorrat) ist im AH viel mehr wert. Goldrausch findet sie automatisch.",
    steps = {
      "Auctionator einmal im AH scannen lassen (Reiter \"Auctionator\" > \"Scannen\").",
      "Danach jeden Händler ansprechen, an dem du vorbeikommst – Goldrausch meldet Flip-Chancen im Chat.",
      "Details im Scanner: Kaufpreis, AH-Erlös nach Gebühr und Gewinn pro Stück.",
      "Erst kaufen, wenn der Gewinn deutlich ist – und im AH kurz prüfen, ob es Käufer gibt.",
    },
    tips = { "Mit dem Legacy-Vorteil \"Bartering\" (Feilschen) kaufst du später bei Händlern günstiger – dann lohnen sich noch mehr Flips." },
  },
  {
    key = "cooking", cat = "craft", minLevel = 5, prof = P.COOKING, effort = 2, source = "forever", icon = "flask",
    items = { 2672, 769, 2673, 3173, 1015, 2924 },
    title = "Kochen – Essen mit Erfahrungs-Bonus",
    summary = "In Forever gibt jedes gekochte Essen mit Buff +5 % Erfahrung durch Kills. Levelnde Spieler wollen das.",
    steps = {
      "Kochkunst lernen (Nebenberuf – zählt nicht zu deinen zwei Hauptberufen).",
      "Fleisch beim Questen sammeln, am Lagerfeuer kochen.",
      "Prüf in \"Rezepte\" (nach einmal Berufsfenster öffnen), welches Essen über den Fleischkosten verkauft wird.",
      "Bonus: Ab Kochen-Skill 20 schaltest du Camping-Features frei (Lagerfeuer-Buffs für die Gruppe).",
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
      "Fische im 20er-Stapel ins AH, nur wenn der Preis klar über dem Händlerpreis liegt.",
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
    summary = "Neu in Forever: Heiltränke gehören jetzt zur Ersten Hilfe (nicht mehr Alchemie). Schwacher Heiltrank = Milde Gewürze + Friedensblume.",
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
    items = { 2862, 2863, 2835, 2836 },
    title = "Schmiedekunst – Wetzsteine",
    summary = "In Forever wirken Schamanen-Waffenverzauberungen jetzt zusätzlich zu Wetzsteinen und Ölen – mehr Spieler nutzen sie.",
    steps = {
      "Rauer Wetzstein aus Rauem Stein, Grober Wetzstein aus Grobem Stein herstellen.",
      "Rezepte-Seite: Gewinn gegenüber dem reinen Steinpreis prüfen.",
      "Kleine Stapel (5–10) einstellen.",
    },
    tips = { "Mit Bergbau sammelst du die Steine selbst." },
  },
  {
    key = "enchanting", cat = "craft", minLevel = 5, prof = P.ENCHANTING, effort = 2, source = "classic", icon = "star",
    items = { 10940, 10938, 10939, 10978 },
    title = "Verzauberkunst – Entzaubern",
    summary = "Grüne Ausrüstung entzaubern statt verkaufen: Seltsamer Staub und Magieessenzen sind oft mehr wert.",
    steps = {
      "Verzauberkunst lernen.",
      "Grüne Items (\"selten\") vor dem Verkauf mit Goldrausch prüfen: AH-Wert gegen Staubwert.",
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

-- Sparziele (für Motivation auf der Startseite)
ns.GOALS = {
  { level = 40, text = "Reiten lernen ab Level 40: 100 Gold (inklusive erstem Reittier)." },
  { level = 60, text = "Alle Klassen-Fähigkeiten von 1 bis 60 kosten zusammen etwa 206 Gold." },
}

-- AH-Schule (für Dummies)
ns.BASICS = {
  {
    title = "1. Auctionator einrichten (einmalig)",
    lines = {
      "Installiere Auctionator in der Version für WoW Forever (z. B. über CurseForge oder Wago).",
      "Geh zum Auktionator in einer Hauptstadt und öffne das Auktionshaus.",
      "Reiter \"Auctionator\" anklicken, dann \"Scannen\". Der Scan liest alle Preise deines Servers.",
      "Fertig: Goldrausch zeigt ab jetzt überall echte Preise. Scan alle 1–2 Tage wiederholen.",
    },
  },
  {
    title = "2. Verkaufen in 4 Klicks",
    lines = {
      "Reiter \"Verkaufen\" öffnen. Links siehst du deine Taschen.",
      "Item anklicken: Auctionator schlägt automatisch einen Preis knapp unter dem günstigsten Angebot vor.",
      "Menge prüfen (am besten volle Stapel) und \"Auktion erstellen\" klicken.",
      "Abgelaufene Auktionen kommen per Post zurück – einfach neu einstellen.",
    },
  },
  {
    title = "3. Die goldenen Regeln",
    lines = {
      "Nie unter Händlerpreis verkaufen – dann lieber direkt zum Händler.",
      "Mindestgebühr beachten: Aktuell kostet jede Auktion mindestens 1 Silber Anzahlung (Blizzard will das wieder auf 1 Kupfer senken). Kleinkram lohnt sich nicht.",
      "Das AH behält beim Verkauf einen Anteil ein. Goldrausch rechnet standardmäßig mit 5 % (Classic-Wert) – änderbar in den Einstellungen.",
      "Nicht panisch unterbieten: Wer 50 % billiger anbietet, verschenkt Gold. Wenige Kupfer darunter reichen.",
      "Viele Angebote, langsamer Markt? Lieber ein paar Tage warten oder Material weiterverarbeiten.",
    },
  },
  {
    title = "4. Unterboten? So reagierst du",
    lines = {
      "Reiter \"Unterboten\" öffnen und \"Scan\" klicken: Auctionator zeigt, wer dich unterboten hat.",
      "\"Unterbotene abbrechen\" holt die Auktion zurück – dann mit neuem Preis einstellen.",
      "Achtung: Abbrechen kostet die Anzahlung. Bei billigen Items lohnt es sich nicht.",
    },
  },
  {
    title = "5. Einkaufen mit Listen",
    lines = {
      "Goldrausch legt Einkaufslisten in Auctionator an (Knopf \"Als Auctionator-Einkaufsliste\").",
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
