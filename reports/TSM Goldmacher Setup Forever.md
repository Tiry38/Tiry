# TSM auf Forever: Tirys Goldmacher-Setup steht

**Kurz, Tiry:** TSM läuft offiziell auf WoW Forever, und zwar ab Version 4.15. Nimm mindestens **4.15.6**; die neueste gefundene Version ist **4.15.8 vom 18.11.2026** ([TSM News](https://tradeskillmaster.com/news/tsm-4-15-brings-wow-forever-support-plus-new-desktop-app-1180); [CurseForge](https://www.curseforge.com/wow/addons/tradeskill-master/files/9546800)).

**Gruppen kannst du per Klartext-String einfügen** (unten fertig). **Operationen nicht.** Die legst du einmal von Hand an und exportierst sie danach als Sicherung.

**Ungeklärt ist, ob die TSM-App für Forever echte `DBMarket`-Werte liefert.** Deshalb hat jeder Preis-String Ersatzquellen: Auctionator (`AtrValue`), deine eigenen Verkäufe (`AvgSell`), Herstellkosten (`Crafting`) und Händlerpreis (`VendorSell`).

**Wirtschaftlich gilt am 19.11.:**
- Leder ist billig.
- Einfache Rüstungssets (Schwer, Dick) verkaufen sich **unter Materialwert**.
- Gewinn bringen die **Forever-Sets „Kraftvoll/Mystisch“**, die **Schwärzliche Lederrüstung** und Nischen-Essen.

Fast alle Preise stammen von **timesaver.gg**. Das ist **eine Goldverkäufer-Seite**, und die Zahlen sind **Mediane über alle Realms bzw. US-Allianz**, keine EU-Horde-Preise.

**Die 1-Kupfer-Einstellgebühr kam nicht am 10.11.** Sie kam erst mit der Wartung am **17./18.11.**, und auch das ist **nur durch Spieler bestätigt**, nicht durch Blizzard.

---

## TSM liest drei Formate, nur eines kannst du selbst schreiben

**Belegt im TSM-Quellcode (v4.14.77 aus einem Forever-AddOns-Ordner):** Beim Einfügen probiert TSM drei Formate nacheinander. Das erste ist das komprimierte Exportformat, das zweite das alte `^`-Format. Das dritte ist eine **Klartext-Liste**, und nur die kannst du von Hand schreiben ([GroupImport.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMTypes/Source/ImportExport/GroupImport.lua)).

Regeln für die Klartext-Liste:
- Die Teile werden **nur durch Kommas** getrennt.
- `group:Pfad` legt die Zielgruppe fest, **Untergruppen trennt ein Backtick** `` ` ``.
- Danach folgen die Items als `i:ID`.
- Ein unbekanntes Teil lässt den ganzen Import scheitern.
- Haben alle Einträge **denselben obersten Gruppennamen**, wird der zum Gruppennamen. Sonst heißt die Gruppe „Importierte Gruppe“.
- **Klartext enthält nie Operationen.** Der Decoder setzt `operations = {}`.

**Was du daraus mitnehmen musst:**
- Ich habe vier getrennte Strings mit je eigenem Hauptnamen gebaut. Jedes Item kommt nur einmal vor, damit die Checkbox „Bereits gruppierte Items verschieben?“ nichts durcheinanderbringt.
- **Alle IDs habe ich gegen die lokalen Forever-Spieldaten geprüft** (Build 1.60.1.70862, `wow-addons/tools/zentrale_src/Data_AllItems.lua`).
- Gruppennamen sind **ohne Umlaute** geschrieben. Umlaute gehen wahrscheinlich, sind aber nicht im Spiel getestet.
- **Den Import selbst habe ich nicht im Spiel getestet.** Das Format ist aus dem Lua-Code abgeleitet.

### String 1 – Lederverarbeitung (Verkauf)

Untergruppen:
- **Kits**: Schweres Set, Kraftvolles/Mystisches schweres Set, Dickes Set.
- **Zwischenprodukte**: Geschmeidiger mittlerer, schwerer und dicker Balg.
- **BoE Jetzt**: Lehrer-Rezepte bis ca. 185 gelb. Dazu gehören Schwärzlich, Barbarische Schultern und Harnisch, Wächter, Grünes Leder, Köcher und Munitionsbeutel.
- **BoE Spaeter**: Nachtschleicher, Schildkrötenschuppe und Muster aus Drops oder fernen Händlern.

**Alle Items darin sind handelbar** (Bindung 0 oder 2).

```
group:Gold LW`Kits,i:4265,i:252453,i:252452,i:8173,group:Gold LW`Zwischenprodukte,i:4233,i:4236,i:8172,group:Gold LW`BoE Jetzt,i:7374,i:7378,i:7387,i:5964,i:5739,i:5962,i:5966,i:4255,i:4257,i:4259,i:7371,i:7372,group:Gold LW`BoE Spaeter,i:8175,i:8176,i:8192,i:8187,i:4254,i:18948,i:5963,i:4264,i:4455,i:5782,i:7386
```

### String 2 – Kochen (Verkauf)

Untergruppen:
- **Buff**: Chilikrebs, Monsteromelett, Machtfisch, Zartes Wolfsteak, Undermine-Muschelsuppe, Kodoeintopf, Drachenodemchili, Spinnenwurst, Panzerfisch, Hirschfrikadelle, Raptorrouladen.
- **Tee und Smoothie**: die Commerce-Authority-Rezepte.
- **Leveler**: Scharfe Wolfrippchen, Gerösteter Raptor.

```
group:Gold Kochen`Buff,i:12216,i:12218,i:13927,i:18045,i:16766,i:12215,i:12217,i:17222,i:286152,i:250065,i:250076,group:Gold Kochen`Tee und Smoothie,i:249868,i:249869,i:249874,i:249875,group:Gold Kochen`Leveler,i:13851,i:12210
```

### String 3 – Material (Einkauf, Überschuss verkaufen)

Untergruppen:
- **Leder und Baelge**: inklusive Forever-Makelloses Leder und Makelloser Balg.
- **LW Spezial**: Raptorbalg, Schildkrötenschuppe, Grünwelpenschuppe, Dicke Murlocschuppe, Schattenkatzenbalg, Gürtelschnalle, Großer Fangzahn, Schattenöl, Seidenstoffballen, Tiefsteinsalz.
- **Kit Zutaten**: Seelenstaub, Visionenstaub, Elixiere, Manatränke.
- **Kochen Zutaten**: Fleisch, Flammenbeutel, Sonnengras, Blassblatt.
- **Fisch**
- **Haendlerware**: Salz, Fäden, Farbstoffe, Gewürze, Wasser, Milch, Saft, Nektar.

```
group:Gold Material`Leder und Baelge,i:2319,i:4234,i:4304,i:4232,i:4235,i:8169,i:249427,i:249428,group:Gold Material`LW Spezial,i:4461,i:8167,i:7392,i:5785,i:7428,i:7071,i:5637,i:3824,i:4305,i:8150,group:Gold Material`Kit Zutaten,i:11083,i:11137,i:6662,i:3391,i:3385,i:3827,group:Gold Material`Kochen Zutaten,i:12206,i:12207,i:12208,i:12204,i:12203,i:12202,i:12184,i:12205,i:12037,i:3667,i:5471,i:4655,i:7974,i:4402,i:8838,i:3818,group:Gold Material`Fisch,i:13754,i:13758,i:4603,i:21153,i:8365,i:6362,i:13890,i:13755,i:13756,group:Gold Material`Haendlerware,i:4289,i:2320,i:2321,i:4291,i:8343,i:2605,i:2325,i:2692,i:3713,i:159,i:1179,i:1645,i:1708
```

### String 4 – Muster und Rezepte (Sniper/Schnäppchen)

Untergruppen:
- **LW Drop**: Muster, die die Horde nur über das AH bekommt.
- **LW Allianz**: Muster von Allianz-Händlern.
- **Kochen**: Rezepte von fernen bzw. riskanten Händlern, etwa Monsteromelett im Teufelswald. Kauf sie hier nur, wenn sie günstiger sind als der Weg dorthin.

```
group:Gold Muster`LW Drop,i:4297,i:4301,i:4299,i:4298,i:8384,i:7453,i:7452,i:5974,i:4300,i:7449,i:7450,group:Gold Muster`LW Allianz,i:13288,i:7290,i:7289,i:20576,group:Gold Muster`Kochen,i:16110,i:16111,i:18046,i:13940
```

**Korrektur zu den Recherche-Notizen:** Diese Items sind laut lokalen Spieldaten **BoP (Bindung 1)** und deshalb **nicht im AH handelbar**:
- 8403, 8404, 8405 (Wildleder-Muster)
- 12233 (Eigenartiger Eintopf)
- 250173, 250184, 286153 (Forever-Kochrezepte)

Ich habe sie bewusst weggelassen.

**Nicht in den Strings**, weil ihre IDs nicht in den geprüften Listen stehen:
- Goldthorn Tea
- Spinefin Halibut
- Cured Rugged Hide

(Dusky Leather Armor ist dabei, als Schwärzliche Lederrüstung 7374.) Die fehlenden fügst du später per Shift-Klick auf das Item im Gruppenfenster hinzu. Laut TSM-Doku gehen auch Wowhead-„Copy IDs“ ([TSM Support](https://support.tradeskillmaster.com/tsm-website/how-do-i-filter-and-import-items-from-wowhead)).

---

## Neun Operationen tippst du einmal von Hand ein

**Die erlaubten Bausteine** stehen im Code ([Types.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMTypes/Source/CustomString/Classes/Types.lua); [TSM Funktionen](https://support.tradeskillmaster.com/custom-strings/which-functions-can-i-use-and-what-do-they-mean)):
- **`first(a, b, …)`** nimmt die **erste gültige** Quelle. Das ist dein Ersatzquellen-Baustein.
- **`check(a, b, c)`** liefert b, wenn a > 0 ist. Ist a ungültig, wird **der ganze Preis ungültig**, und TSM postet dann gar nicht, statt zu verramschen.
- **`min/max/avg`** überspringen ungültige Werte still.
- **`/ 0.95`** gleicht die **5 % AH-Gebühr** aus.
- Geld schreibst du **ohne Dezimalpunkt**: `1s`, `50s20c`. `1.5g` ist ungültig. Faktoren wie `1.5 * VendorSell` sind erlaubt.

Die Quellnamen `DBMarket`, `AtrValue`, `AvgSell`, `SmartAvgBuy`, `Crafting`, `MatPrice`, `VendorSell` und `VendorBuy` sind im Code registriert ([TradeSkillMaster.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/TradeSkillMaster.lua)). **`AtrValue` gibt es nur, wenn Auctionator geladen ist.**

**Ersatzquellen-Logik in allen Strings:**
1. `DBMarket`, wenn die App Forever-Daten liefert.
2. Sonst `AtrValue` aus deinem Auctionator-Scan.
3. Sonst `AvgSell` (deine Verkäufe) bzw. `Crafting`.
4. `VendorSell` ist die Untergrenze.

Die Werte unten sind **meine Ableitung**, also keine Community-Werte. Für Forever gibt es keine zitierfähige Sammlung ([Notizen](https://support.tradeskillmaster.com/tsm-addon-documentation/1072146-tsm-addon-auctioning-operations)). **Prüf jeden Wert einmal im Tooltip**, bevor du in Masse postest.

### Auctioning „Gold Craft“ → auf Gold LW und Gold Kochen

| Feld (EN / DE) | Eingabe |
|---|---|
| Minimum price / „Minimum price“ | `check(first(Crafting, DBMarket, AtrValue), max(1.1 * first(Crafting, DBMarket, AtrValue) / 0.95 + 1s, 1.5 * VendorSell))` |
| Normal price / „Normaler Preis“ | `check(first(Crafting, DBMarket, AtrValue), max(first(150% DBMarket, 150% AtrValue, 200% Crafting), 3 * VendorSell))` |
| Maximum price / „Maximaler Preis“ | `check(first(Crafting, DBMarket, AtrValue), max(first(300% DBMarket, 300% AtrValue, 400% Crafting), 12 * VendorSell))` |
| When below minimum / „Wenn unter Mindestpreis“ | „Don't Post Items“ / „Keine Items auktionieren“ |
| When above maximum / „Wenn über Höchstpreis“ | Standard lassen (Maximum price) |
| Undercut amount | **`0c`** (gleicher Preis, siehe Fehler-Abschnitt unten) |
| Post cap | `2` für Rüstung, `5` für Kits/Essen (oder zwei Kopien der Operation) |
| Auction duration / „Auktionsdauer“ | 48 h (weniger Neu-Einstellen) |
| Amount kept in bags / „Menge in der Tasche behalten“ | `0` |
| Don't post after this many expires | `5` |
| Cancel undercut auctions / „Unterbotene Auktionen abbrechen“ | an |
| Cancel to repost higher / „Abbrechen um höher einzustellen“ | aus |
| Repost threshold | `5s` |

**So rechnet das Minimum:** 10 % Aufschlag auf deine Herstellkosten, durch 0,95 für den AH-Anteil, plus `1s` Puffer für die Einstellgebühr. Blizzard hat **keine Gebührenformel für Forever veröffentlicht** ([kami-labs](https://kami-labs.fr/en/wow-forever/hotel-des-ventes-wow-forever-depot-1-cuivre/)).

### Auctioning „Gold Rohstoff“ → auf Gold Material (nur Überschuss verkaufen)

| Feld | Eingabe |
|---|---|
| Minimum price | `check(first(DBMarket, AtrValue, AvgSell), max(80% first(DBMarket, AtrValue, AvgSell), 1.5 * VendorSell))` |
| Normal price | `check(first(DBMarket, AtrValue, AvgSell), max(first(120% DBMarket, 120% AtrValue, 120% AvgSell), 2 * VendorSell))` |
| Maximum price | `check(first(DBMarket, AtrValue, AvgSell), max(first(300% DBMarket, 300% AtrValue, 300% AvgSell), 12 * VendorSell))` |
| Amount kept in bags | `20` (Reserve fürs eigene Herstellen) |
| Undercut / Post cap / Dauer / Max expires | `0c` / `5` / 48 h / `5` |

**Die Untergruppe „Haendlerware“ bekommt keine Auctioning-Operation.** Weise sie dort ab, über „Override Parent Operations“.

### Crafting (deDE „Herstellen“): zwei Operationen

| Feld | „Gold Ruestung“ → Gold LW`BoE Jetzt + BoE Spaeter | „Gold Stapel“ → Kits, Zwischenprodukte, Gold Kochen |
|---|---|---|
| Minimum restock quantity | `1` | `5` |
| Maximum restock quantity | `2` | `20` |
| Set min profit | an | an |
| Min profit amount | `max(10s, 20% Crafting)` | `max(2s, 15% Crafting)` |
| Override default craft value | an | an |
| Craft Value | `95% first(DBMarket, AtrValue, AvgSell)` | `95% first(DBMarket, AtrValue, AvgSell)` |

**Das ist ein Schutz:** Der „Craft Value“ zieht die 5 % AH-Gebühr schon ab. Restock legt deshalb nur Gewinnbringer in die Warteschlange. Min-Restock darf nie größer sein als Max-Restock, sonst meckert TSM ([CraftingOperation.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMSystem/Source/Operation/CraftingOperation.lua)).

### Shopping, Sniper, Vendoring

| Operation | Feld | Eingabe | Zuweisen auf |
|---|---|---|---|
| Shopping „Gold Einkauf“ | Maximum auction price | `first(90% DBMarket, 90% AtrValue, SmartAvgBuy)` | Gold Material (ohne Haendlerware) |
| | Show auctions above max price | aus | |
| | Maximum restock quantity | `0` | |
| Shopping „Gold Haendler-Snipe“ | Maximum auction price | `90% VendorBuy` | Gold Material`Haendlerware |
| Shopping „Gold Muster“ | Maximum auction price | `first(80% DBMarket, 80% AtrValue, 3 * VendorSell)` | Gold Muster |
| Sniper „Gold Sniper“ | Below price (interner Name `belowPrice`) | `max(VendorSell, first(60% DBMarket, 60% AtrValue))` | Gold Material, Gold Muster |
| Vendoring „Gold Nachkauf“ | Kaufen an, Nachkauf-Menge (`restockQty`) | `20` | Gold Material`Haendlerware |
| | Verkaufen (`enableSell`) | aus | |

**Wichtig zu `VendorBuy`:** Die Quelle füllt sich erst, **nachdem du einen Händler besucht hast**, der das Item verkauft. Sonst fehlt der Materialpreis für Fäden und Gewürze ([TSM Support](https://support.tradeskillmaster.com/en_US/addon/why-do-my-vendor-items-have-wrong-or-missing-material-prices)).

Die Sniper- und Vendoring-Felder habe ich nur als interne Feldnamen gefunden. Die genaue UI-Beschriftung kann deshalb abweichen ([VendoringOperation.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMSystem/Source/Operation/VendoringOperation.lua)).

**Mailing brauchst du nur mit Bank-Twink.** Ohne Twink lass es weg.

### Einstellgebühr, 5 % und „Internal auction error“

**Die Fehlermeldung „Internal auction error“ beim Unterbieten** kennen wir nur aus Drittanbieter-Guides. Ihr Workaround: **zum gleichen Preis einstellen** ([botwowforever](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)). Deshalb steht Undercut oben auf **`0c`**.

Laut Code nutzt TSM `0c` selbst dort, wo Unterbieten unter 1 Silber nicht geht ([AuctioningOperation.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMSystem/Source/Operation/AuctioningOperation.lua)).

**Meine Vermutung, unbelegt:** Der Fehler hängt mit Kupferbeträgen bei Nicht-Stapelware zusammen. **Test im Spiel:**
1. Einmal mit Undercut `1s` posten.
2. Kommt kein Fehler, behalte `1s`.
3. Kommt der Fehler, bleib bei `0c`.

Jedes Abbrechen und Neu-Einstellen kostet erneut Gebühr. Deshalb stehen oben **48 h Dauer**, **„Cancel to repost higher“ aus** und **5 Abläufe als Grenze**.

---

## Die 1-Kupfer-Gebühr kam eine Woche später als notiert

**Korrektur:** In `wow-addons/docs/GOLD-RECHERCHE-2026-11.md` steht „seit Hotfix 10.11. wieder 1 Kupfer“. **Das ist falsch.**

Der richtige Ablauf:

| Datum | Was passiert ist |
|---|---|
| 10.11. | Hotfix kündigt an: Mindestgebühr 1 Kupfer statt 1 Silber ([Warcraft Tavern](https://www.warcrafttavern.com/forever/news/class-economy-changes-wow-forever-hotfixes-for-november-10/)) |
| 12.11. | Kaivax: AH-Änderungen „temporarily removed“, neu angesetzt für die Wartung am 17.11. ([kami-labs](https://kami-labs.fr/en/wow-forever/hotel-des-ventes-wow-forever-depot-1-cuivre/)) |
| 14.11. | Spieler sehen weiterhin 1 Silber |
| 17.11. US / 18.11. EU | Spieler melden die Umstellung auf 1 Kupfer ([epiccarry](https://epiccarry.com/blogs/wow-forever-auction-house-deposit/)) |
| 19.11. | **Keine offizielle Blizzard-Bestätigung.** Bitte im Spiel prüfen. |

**Was das für dich bedeutet:**
- Gilt 1 Kupfer wirklich, lohnt sich das Einstellen billiger Ware wieder, etwa Rohfisch für 8–38 Kupfer oder leichtes Leder.
- Bis du das geprüft hast, behältst du den `+ 1s`-Puffer im Minimum.

---

## Einrichtung: Wo du was einfügst

**1. Add-on.** Lade TSM **4.15.6 oder neuer** in der Forever-Variante (1.60.1 / 16001) und entpacke es nach `World of Warcraft/_forever_/Interface/AddOns` ([foreverbase](https://foreverbase.org/en/addons/catalog/tsm/); [mmonster](https://mmonster.co/wow-forever/guides/addons/tradeskillmaster)). Grund für 4.15.6: Es behebt Forever-Fehler bei Entzauberungswerten und Bonus-IDs ([CurseForge](https://www.curseforge.com/wow/addons/tradeskill-master/files/9546800)).

**2. Desktop-App (Windows).**
1. Installieren und anmelden.
2. Bei der Realm-Abfrage den **„Forever“-Eintrag deiner Region (EU)** wählen. Die Gratis-Stufe reicht für 10 Realms ([botwowforever](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)).
3. Prüfen: Der Item-Tooltip muss eine AuctionDB-Zeit zeigen. Steht dort „No Recent AuctionDB Scan Data Found“, läuft die App nicht oder ist falsch eingestellt ([TSM Support](https://tradeskillmaster.helpjuice.com/en_US/tsm-addon-documentation)).

**Ungeklärt:** Welche `DB*`-Quellen für Forever wirklich gefüllt sind. Auch ob Stapelware (Commodities) überhaupt abgedeckt ist, steht nicht fest. Laut TSM gibt es Commodity-Dateien nur für Retail ([TSM Public Data](https://tradeskillmaster.com/public-data)). Genau dafür sind die Ersatzquellen in den Strings da.

**3. Auctionator daneben.** Die Guides raten: **nur ein AH-veränderndes Add-on gleichzeitig aktiv**, weil beide das AH-Fenster umbauen ([botwowforever](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)). `AtrValue` funktioniert aber nur mit geladenem Auctionator ([TSM Support](https://support.tradeskillmaster.com/en_US/custom-strings/which-external-sources-are-available-to-use)).

**Meine Empfehlung:**
- Solange die TSM-App keine Forever-Preise liefert, lass Auctionator installiert und mach damit den Scan. So bekommst du `AtrValue`.
- Gepostet wird mit TSM.
- Gibt es Fehler am AH, deaktiviere eines der beiden und teste einmal im Standard-UI.
- Liefert `DBMarket` Werte, kannst du Auctionator abschalten.

**4. Händler einmal besuchen.** Klapper je einen Faden-, Gewürz- und Salzhändler ab (z. B. Mahu in Donnerfels oder Händler in Orgrimmar), damit sich `VendorBuy` füllt.

**5. Gruppen importieren.** Mach das für jeden der vier Strings einzeln:
1. `/tsm` öffnen.
2. Reiter **Gruppen (Groups)** wählen.
3. Im Gruppenbaum oben auf **„Gruppe importieren“ (Import group)** klicken.
4. Im Dialog **„Gruppen & Operationen importieren“ (Import Groups & Operations)** den String ins Feld **„String Importieren“ (Import String)** einfügen.
5. Unter **„Zusammenfassung importieren“ (Import Summary)** die Zahlen prüfen.
6. Auf **„Importieren“ (Import)** klicken.

Im Chat steht danach „Imported group … with N items“. **Ungültige IDs werden still übersprungen und gezählt** ([Groups.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/Core/UI/MainUI/Groups.lua)).

**6. Operationen anlegen.**
1. `/tsm` öffnen.
2. **Operationen (Operations)** wählen.
3. Modul wählen: Auctioning, **Herstellen (Crafting)**, Shopping, Sniper oder Vendoring.
4. **„Neue Operation erstellen“ (Create New Operation)** klicken.
5. Felder laut Tabellen oben ausfüllen ([deDE.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/Locale/deDE.lua)).

**7. Operationen zuweisen.**
1. **Gruppen** öffnen und die Gruppe wählen.
2. Reiter **Operations** öffnen.
3. **„Operation hinzufügen“ (Add Operation)** bzw. **„Mehr Operationen hinzufügen“** klicken.

**Untergruppen erben automatisch.** Nur wo eine Untergruppe abweicht, setzt du **„Override Parent Operations“** (z. B. bei Haendlerware ohne Auctioning).

**8. Sichern.** Exportier die Gruppe danach mit Operationen. Dieser kodierte String ist dein Backup und lässt sich teilen ([TSM Groups](https://support.tradeskillmaster.com/tsm-addon-documentation/tsm-addon-groups)).

**9. Täglicher Ablauf.**
1. Berufsfenster öffnen.
2. Im TSM-Herstellfenster **„Restock TSM Groups“** klicken.
3. Material per Shopping besorgen.
4. **„Craft Next“** drücken.
5. Am AH **„Einstellungsscan“ (Post Scan)** starten.

Bleibt die Warteschlange leer, hilft `/tsm restock_help` plus Shift-Klick auf das Item ([TSM Support](https://support.tradeskillmaster.com/why-doesnt-my-crafted-item-get-restocked)).

---

## Goldplan: Kits veredeln statt Leder verkaufen

**Preisquellen-Hinweis:** Fast alles hier stammt von timesaver.gg (**Goldverkäufer, interessengeleitet**). Die Zahlen sind entweder **Mediane über alle Realms und beide Fraktionen** (Übersicht) oder **US-Allianz** (Rechner). **EU-Horde-Preise gibt es in keiner Quelle**, und Verkaufsraten fehlen ganz. Dein eigener TSM- oder Auctionator-Scan schlägt jede dieser Zahlen.

### Preise vom 19.11.2026

| Item | Preis | Quelle |
|---|---|---|
| Schweres Leder | 2s 39c US / 2s 48c EU | [timesaver Übersicht](https://timesaver.gg/wow-forever/auction-prices) |
| Dickes Leder | 7s 80c US / 6s 90c EU | ebd. |
| Geschmeidiger schwerer Balg | 14s 99c US / 14s EU | ebd. |
| Geschmeidiger dicker Balg | 11s 54c US / 11s 20c EU | ebd. |
| Dickes Rüstungsset | 18s 99c US (+23 % in 7 Tagen) / 13s 49c EU | ebd. |
| Schweres Rüstungsset | 8s 42c | [timesaver LW-Rechner](https://timesaver.gg/tools/wow-forever/professions/leatherworking?region=eu&faction=horde) |
| Schwärzliche Lederrüstung | Kosten 45s 89c → Verkauf 94s 5c, **+48s 16c** | ebd. |

Die Schwärzliche Lederrüstung ist der einzige Wert aus dem LW-Rechner (US-Allianz). Die übrigen Leder-, Balg- und Set-Preise sind Mediane über alle Realms.

**Selbst gerechnet aus diesen Preisen:**
- Ein Dickes Set braucht 5× Dickes Leder, also allein ca. **35–39s** Material. Verkauft wird es für **13–19s**. Ein Schweres Set braucht 5× Schweres Leder für ca. **12s** und bringt **8s 42c**.
- **Daraus folgt: Einfache Sets nie zum Verkauf herstellen.** Kauf sie im AH als Zutat für die Forever-Sets. Die Crafting-Operation erledigt das automatisch, weil der Materialpreis den günstigeren AH-Preis nimmt.

### Prioritäten für dich (Horde, Stufe 36, LW 175, Kochen 225)

**1. Sofort: Schwärzliche Lederrüstung (7374).**
- Lehrer-Rezept, gelb 170.
- Material: 10× Schweres Leder und 1× Schattenöl.
- Marge **+48s pro Stück** (US-Allianz, 19.11.). Das ist **die beste belegte LW-Marge in deinem Skillbereich** ([timesaver](https://timesaver.gg/tools/wow-forever/professions/leatherworking?region=eu&faction=horde)).
- Lass dir den Preis vorher durch deinen eigenen Scan bestätigen.

**2. Bis LW 185: Kraftvolles/Mystisches schweres Set (252453/252452).**
- Muster bei **Mahu in Donnerfels**.
- Das Rezept wird ab 135 orange und lohnt nur fürs Skillen. Mittlere und schwere Sets liegen bei 11–29s und dienen laut timesaver „mostly for skill-ups“ ([timesaver LW](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)).
- Überschuss verkauft nur die Operation, und nur über den Herstellkosten.

**3. Ab LW 185: Kraftvolles/Mystisches dickes Set (252463/252462).**
- Marge laut timesaver vom 11.11.: **30s US / 18s EU** (Kraftvoll) und **30s / 25s** (Mystisch).
- Aber: **über 150 Stück je Set** waren eingestellt ([timesaver LW](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)). Deshalb Post cap 5 und Undercut 0c.
- Bezugsquellen:
  - Kraftvolles Muster: **Pawani [H] im Brachland**, für 30/60/90 Merchant's Favor.
  - Mystisches Muster: laut timesaver mindestens auf der Unverwüstlich-Stufe **Wohlwollend** bei der Commerce Authority nötig. Die lokalen Daten nennen „Gorhak“ in Desolace, Fraktion unbekannt.
- **Diese zwei Sets fehlen im String 1**, weil du die Muster noch nicht hast. Ihre IDs (252463, 252462) sind geprüft. Sobald du sie herstellen kannst, zieh sie per **Shift-Klick in die bestehende Gruppe „Gold LW`Kits“**. Ein zweiter Import mit demselben Hauptnamen würde eine neue Gruppe „Gold LW 1“ anlegen statt die alte zu ergänzen ([GroupImport.lua](https://github.com/Industrial/nixos-dotfiles/blob/main/features/games/wow-forever/Interface/AddOns/TradeSkillMaster/LibTSMTypes/Source/ImportExport/GroupImport.lua)).

**4. Bälge veredeln statt roh verkaufen.**
- **Geschmeidiger schwerer Balg (4236)** bringt **14–15s**, braucht 1 Schweren Balg plus 3 Salz vom Händler. Für Rohbälge fehlen AH-Preise; vergleich sie im Spiel.
- Laut LW-Guide verkaufst du Bälge und Zwischenprodukte nicht, bevor du die Rezepte durch hast, die sie brauchen ([conquestcapped DE](https://conquestcapped.com/guides/de/wow-forever/wow-forever-leatherworking/)).

**5. Kochen: kleine Testchargen.**
- **Belegt profitabel** (US-Allianz, 19.11.):
  - **Spinefin Halibut** (210): **+59s 98c**, aber nur **35 Stück** eingestellt. Der Händler zahlt 2s, also wahrscheinlich ein dünner Ausreißer.
  - **Goldthorn Tea** (175, ergibt 4): **+8s 54c** bei ca. 2.045 Angeboten ([timesaver Kochen](https://timesaver.gg/tools/wow-forever/professions/cooking)).
- **Belegt Verlust:** Spinnenwurst (−1s), Wolf, Eber und Muscheln. **Zu deinen 225er-Rezepten (Chilikrebs, Machtfisch, Wolfsteak) gibt es keine Forever-Preise.**
- Die Rezepte kaufst du günstig auf deiner Route:
  - **Uthok in Grom'gol** (Chilikrebs)
  - **Kelsey Yance in Beutebucht** (Machtfisch)
  - Tanaris (Wolfsteak, Muschelsuppe)
- Danach entscheidet die Crafting-Operation mit Mindestgewinn.

**Ausblick.** Mit **LW 225** wartet der **Geschmeidige unverwüstliche Balg** (Cured Rugged Hide): Marge laut timesaver **75g US / 43g EU** pro Craft, dazu der **Salzstreuer-Cooldown** ([timesaver LW](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)). Dafür brauchst du aber Unverwüstlichen Balg (8171) aus Gebieten ab etwa Stufe 45. Die ID des fertigen Balgs steht nicht in den geprüften Listen; füg ihn später per Shift-Klick hinzu.

**Kürschnern und Farmen mit 36.** Leder ist billig (Schwer ca. 2,4s). Verarbeite es also selbst, statt es roh zu verkaufen. Laut conquestcapped ist **Weiterleveln bis zum Reittier mit 40 (100g) meist schneller als Farmen** ([conquestcapped](https://conquestcapped.com/guides/wow-forever/wow-forever-gold-making/)). Deine Käufer sind die Stufen 20–35, und die haben wenig Gold.

**Finger weg von:**
- **Allen Commerce-Authority-Rüstungen (BoP)**, unverkäuflich ([timesaver LW](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)).
- **Makellosem Leder und Balg** (über 3.000 Angebote, Leder ca. 5–17s).
- **Leichter Reagenzientasche** (1–2s Marge).
- **Schillernden Perlen** (über 1.300 Angebote).
- **Frostsäblerleder** (−90 % in 7 Tagen).
- **Normalem Levelessen** ([timesaver Übersicht](https://timesaver.gg/wow-forever/auction-prices); [conquestcapped](https://conquestcapped.com/guides/wow-forever/wow-forever-gold-making/)).

---

## Fazit

**Dein Vorteil liegt im Veredeln.** Einfache Rüstungssets kosten im AH weniger als das Leder darin. Wer sie kauft und zu Forever-Sets oder Schwärzlicher Rüstung weiterverarbeitet, verdient an der Lücke, und TSMs Materialpreis-Logik findet diese Lücke von selbst.

**Der größte Unsicherheitsfaktor ist die Datenquelle, nicht die Mechanik.** Ob `DBMarket` für Forever-EU gefüllt ist, entscheidet, wie viel TSM dir abnimmt. Bis das klar ist, machen die `first()`- und `check()`-Ketten das Setup sicher: Ohne gültige Quelle postet TSM nichts, statt zu verschleudern.

**Deine zwei Tests im Spiel:**
1. Steht die Einstellgebühr auf 1 Kupfer?
2. Löst Undercut `1s` den „Internal auction error“ aus?

Danach weißt du, ob du die Puffer in den Strings lockern kannst.
