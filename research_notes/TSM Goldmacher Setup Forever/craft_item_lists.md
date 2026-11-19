# TSM-Itemlisten für Horde-Char (Stufe 36, Kochen 225, Lederverarbeitung 175, Kürschnerei wahrscheinlich): WoW Forever

Datenbasis (lokal, exakte Forever-Spieldaten, Build 1.60.1.70862, deutsch):
- `wow-addons/tools/zentrale_src/Data_Recipes.lua`: alle 1967 Rezepte mit Ergebnis, Material, gelb/grau.
- `wow-addons/tools/zentrale_src/Data_RecipeItems.lua`: Rezept-Item und nötiger Skill. Rezepte ohne Eintrag lernt man beim Lehrer.
- `wow-addons/tools/zentrale_src/Data_AllItems.lua`: Name, Qualität, Händlerpreis (vk, Kupfer), Bindung (0 = frei, 1 = BoP, 2 = BoE).
- `wow-addons/addons/RezeptRadar/Data_Hotfix.lua`: Hotfix vom 06.11.2026, Gerbrahmen ab 125.
- QuestieDB Forever: `qdb/QuestieDB/data/Forever/foreverItemDB.lua` und `foreverNpcDB.lua` (Händler, Fraktion). Dazu `qdb/QuestieDB/src/corrections/Forever/generated/*` mit Händlern für neue Forever-Items und -NPCs.

Konventionen in diesen Notizen:
- „orange ab“ ist der Skill, den das Rezept-Item verlangt (Data_RecipeItems).
- Bei Lehrer-Rezepten steht der Lern-Skill nicht in den lokalen Daten. Dort sind nur gelb und grau angegeben.
- Grün ist nach Classic-Konvention als (gelb+grau)/2 gerechnet. Das ist eine Ableitung, nicht aus den Daten.
- „[H]“ heißt: laut QuestieDB ein Horde-freundlicher Händler. „[AH]“ heißt: neutral.
- Sammelquelle für alle lokalen Datenaussagen ist das Repo selbst ([lokal](file:///home/user/Tiry/wow-addons/tools/zentrale_src/)). Die Web-Quellen stehen jeweils dabei.

---

## Frage 1: Lederverarbeitungs-Produkte (Skill ≤ ~225), die an Spieler verkaufbar sind

### Takeaway
Die Gruppe „LW Verkauf“ sollte drei Teile haben:
- **Rüstungssets (Kits)**, auch die neuen Forever-Kits „Kraftvoll“ (Angriffskraft) und „Mystisch“ (Zaubermacht).
- **Verarbeitete Leder und Bälge**, also Zwischenprodukte, die andere LW kaufen.
- **BoE-Grünzeug** für die Stufen 25–40, vor allem Barbarisch, Wächter, Schwärzlich und Nachtschleicher.

Alle neuen Forever-Rüstungsteile der Commerce Authority (Aufseher, Heiler, Himmelsrufer, Pirscher, Scharmützler, Schleicher, Streuner) sind BoP. Sie gehören NICHT in eine Verkaufsgruppe.

### Cited Findings

**TSM-Gruppe „LW – Kits & Zwischenprodukte“ (frei handelbar, Bindung 0)**

| ID | Name (de) | Rolle | gelb/grau | Rezeptquelle (Horde) | Material |
|---|---|---|---|---|---|
| 4265 | Schweres Rüstungsset | Verkauf | 145/165 | Lehrer | 5× Schweres Leder 4234, 1× Feiner Faden 2321 |
| 252453 | Kraftvolles schweres Rüstungsset (Forever-neu, q2, Stufe 30) | Verkauf | 155/175, orange ab 135 | Muster 252812 bei **Mahu [H] Donnerfels**, Jangdor Swiftstrider [H] Feralas (Ally: Saenorion, Darnassus) | 4265 + 2× Seelenstaub 11083 + 2× Elixier des Riesenwuchses 6662 |
| 252452 | Mystisches schweres Rüstungsset (Forever-neu) | Verkauf | 155/175, orange ab 135 | Muster 252811, gleiche Händler | 4265 + 2× Seelenstaub 11083 + 2× Geringer Manatrank 3385 |
| 8173 | Dickes Rüstungsset | Verkauf (ab ~195) | 195/215 | Lehrer | 5× Dickes Leder 4304, 1× Seidenfaden 4291 |
| 252463 | Kraftvolles dickes Rüstungsset | Verkauf (nächstes Ziel) | 205/225, orange ab 185 | Muster 252834 bei **Pawani [H] Brachland** (Commerce Authority; Daniel Stitchsong für Ally) | 8173 + 2× Visionenstaub 11137 + 2× Elixier der Ogerstärke 3391 |
| 252462 | Mystisches dickes Rüstungsset | Verkauf (nächstes Ziel) | 205/225, orange ab 185 | Muster 252833. Laut Korrekturdaten bei „Gorhak“ (Desolace, Fraktion unbekannt) | 8173 + 2× Visionenstaub 11137 + 2× Manatrank 3827 |
| 2313 | Mittleres Rüstungsset | Verkauf (niedrig) | 90/105 | Lehrer | 4× 2319, 1× Grober Faden 2320 |
| 252437 / 252436 | Kraftvolles / Mystisches mittleres Rüstungsset | Verkauf (Twinks/Leveler) | 95/110, orange ab 80 | Muster 252784 / 252783 (Händler in QDB nicht gefunden) | 2313 + 2× Seltsamer Staub 10940 + 2× Elixier d. schwachen Stärke 2454 bzw. Schwacher Manatrank 2455 |
| 4234 | Schweres Leder | Verkauf / Zwischenprodukt | 125/135 | Lehrer | 5× Mittleres Leder 2319 |
| 4304 | Dickes Leder | Verkauf / Zwischenprodukt | 175/180 | Lehrer | 6× Schweres Leder 4234 |
| 4236 | Geschmeidiger schwerer Balg | Verkauf (gefragt für Barbarisch/Wächter) | 135/145 | Lehrer | 1× Schwerer Balg 4235 + 3× Salz 4289 |
| 8172 | Geschmeidiger dicker Balg | Verkauf | 175/175 | Lehrer | 1× Dicker Balg 8169 + 1× Tiefsteinsalz 8150 |
| 4233 | Geschmeidiger mittlerer Balg | Verkauf (für BoP-Forever-Rezepte gefragt) | 90/105 | Lehrer | 1× Mittlerer Balg 4232 + 1× Salz 4289 |
| 18662 | Schwerer Lederball | Nischenverkauf | 125/135 | Muster 18731 bei **Tamar [H] Orgrimmar** | 2× 4234, 1× 2321 |
| 7372 / 7371 | Schwerer Ledermunitionsbeutel / Schwerer Köcher (Jäger) | Verkauf | 145/165 | Lehrer | 8× 4234, 2× 2321 |
| 8218 / 8217 | Dicker Ledermunitionsbeutel / Schnellziehköcher | Verkauf (später) | 220/240 | Lehrer | 10 bzw. 12× 4304 + 8172 + Elixier + 4291 |

Ein Timesaver-Bericht (Medianpreise vom 11.11.2026) sagt Folgendes:
- Forever führt Kraftvolle (Angriffskraft) und Mystische (Zaubermacht) Kits für Mittel, Schwer, Dick und Unverwüstlich ein.
- Kraftvolles dickes Set: Material 50s, AH-Median 85s US / 70s EU, Marge 30s / 18s.
- Mystisches dickes Set: Material 54s, Median 89s / 77s, Marge 30s / 25s.
- Über 150 Stück je dickem Kit waren eingestellt. Ein Preisfall kann die Marge auffressen.

[Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold). Achtung: Die Seite gehört einem Goldhändler und ist interessengeleitet.

Weitere Belege:
- Laut Timesaver sind alle 76 geprüften Commerce-Authority-Rüstungsrezepte BoP. Die Muster kosten 30/60/90 Merchant's Favor bei Pawani (Brachland) bzw. Daniel Stitchsong (Rotkammgebirge). [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold). Die lokalen Daten zeigen dasselbe: Bindung 1 bei 2524xx/2525xx.
- Laut Timesaver verlangt das Mystische Muster zusätzlich „Honored“ bei der Commerce Authority. Das gilt mindestens für die Unverwüstlich-Stufe. [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)
- Die Wowhead-Forever-Seite des Musters 252812 nennt Händler in Darnassus, Donnerfels, Feralas und Hinterland. [Wowhead Forever](https://www.wowhead.com/forever/item=252812/pattern-forceful-heavy-armor-kit)

**TSM-Gruppe „LW – BoE-Grünzeug 25–40“ (Bindung 2, an Spieler verkaufbar; Händlerpreis als Untergrenze)**

| ID | Name | Stufe | gelb/grau | Rezeptquelle (Horde) | Hauptmaterial |
|---|---|---|---|---|---|
| 4254 | Barbarische Handschuhe | 25 | 150/170 (orange 125) | Muster 4297, nur Drop | 6× 4234, 2× Großer Fangzahn 5637 |
| 18948 | Barbarische Armschienen (q3 blau) | 27 | 155/175 (orange 130) | Muster 18949 bei **Joseph Moore [H] Unterstadt** | 8× 4234, 2× 4236, 4× Kl. irisierende Perle 5498, 1× Raptorbalg 4461, 4× 5637 |
| 5963 | Barbarische Gamaschen | 29 | 165/185 (orange 145) | Muster 5973 bei **Keena [H] Arathi**, **Jandia [H] Tausend Nadeln** | 10× 4234, 2× 2321, 1× Moosachat 1206 |
| 5964 | Barbarische Schultern | 30 | 170/190 | Lehrer | 8× 4234, 1× 4236, 2× 2321 |
| 5739 | Barbarischer Harnisch | 33 | 185/205 | Lehrer | 14× 4234, 2× 2321, 1× Eiserne Gürtelschnalle 7071 |
| 4264 | Barbarischer Gürtel | 35 | 195/215 (orange 175) | Muster 4301, nur Drop | u. a. 6× 4234, 2× 4236, 2× Grobes Gorillahaar 4096, Großer Wuttrank 5633 |
| 4455 | Raptorbalgharnisch | 28 | 160/180 (orange 140) | Muster 13287 bei **Tunkk [H] Arathi** | 6× Raptorbalg 4461, 4× 4234 |
| 4456 | Raptorbalggürtel | 28 | 160/180 (orange 140) | Muster 13288 nur bei Androd Fadran [A] Arathi. Für Horde nur über das AH | 4× 4461, 4× 4234 |
| 4255 | Grüne Lederrüstung | 26 | 150/170 (orange 130) | Muster 7613 bei **George Candarte [H] Hügellande** | 9× 4234, 2× Grüner Farbstoff 2605 |
| 4257 / 4259 | Grüner Ledergürtel / Grüne Lederarmschienen | 27 / 31 | 155/175, 175/195 | Lehrer | 4234, 4236, 2605 (Gürtel zusätzlich 7071) |
| 5962 | Wächterhose | 27 | 155/175 | Lehrer | 12× 4234, 2× Seidenstoffballen 4305 |
| 4256 | Wächterrüstung | 30 | 170/190 (orange 150) | Muster 4299, Drop | 12× 4234, 2× 4236, 1× Schattenöl 3824 |
| 5966 | Wächterhandschuhe | 33 | 185/205 | Lehrer | 4× 4234, 1× 4236, 1× Seidenfaden 4291 |
| 7374 | Schwärzliche Lederrüstung | 30 | 170/190 | Lehrer | 10× 4234, 1× Schattenöl 3824 |
| 7378 / 7387 | Schwärzliche Armschienen / Schwärzlicher Gürtel | 32 / 34 | 180/200, 190/210 | Lehrer | 4234, Schwarzer Farbstoff 2325, 4291 (Gürtel zusätzlich 7071 und 4305) |
| 5782 | Dicke Murlocrüstung | 29 | 165/185 (orange 145) | Muster 5788 bei **Christoph Jeffcoat [H] Hügellande**, Blixrez Goodstitch [AH] Schlingendorntal | 12× Dicke Murlocschuppe 5785, 4236, 4234 |
| 5783 | Murlocschuppenarmschienen | 33 | 185/205 (orange 165) | Muster 5789 bei **Blixrez Goodstitch [AH] Schlingendorntal (Beutebucht)** | 16× 5785, 4236, 14× 4234 |
| 7386 | Grünwelpenarmschienen | 33 | 185/205 (orange 165) | Muster 7451 bei **Jangdor Swiftstrider [H] Feralas** | 6× Grünwelpenschuppe 7392, 8× 4234 |
| 4262 | Edelsteinbesetzter Ledergürtel | 32 | 180/200 (orange 160) | Muster 14635 bei **Rikqiz [AH] Schlingendorntal** | 4× 4236, 2× Schillernde Perle 5500, 2× Jade 1529, Citrin 3864 |
| 18238 | Schattenhauthandschuhe | 35 | 185/205 (orange 175) | Muster 18239 bei **Rikqiz [AH] Schlingendorntal** | Dickes Leder, 8× Schattenkatzenbalg 7428, Schwarze Perle, Schattenedelstein |
| 8174 | Bequemer Lederhut | 35 | 195/215 (orange 175) | Muster 8384, Drop | 12× 4234, 2× 4236, 2× 4291 |
| 7391 | Hurtige Stiefel | 35 | 195/215 (orange 175) | Muster 7453, Drop | 10× 4234, 2× Hurtigkeitstrank 2459, 2× Dicke Spinnenseide 4337 |
| 8176 / 8175 | Stirnband / Tunika des Nachtschleichers | 36 | 200/220 | Lehrer | 5 bzw. 7× Dickes Leder 4304, 2× 4291 |
| 8192 | Schultern des Nachtschleichers | 37 | 205/225 (orange 185) | Muster 8409 bei **Jangdor Swiftstrider [H] Feralas** | 8× 4304, 6× Magiestoff 4338 |
| 8193 | Hose des Nachtschleichers | 41 | 225/245 | Lehrer (laut Guide nur bei Hahrana Ironhide, Camp Mojache, Feralas, Horde) | 14× 4304, 4× 4291 |
| 8187 | Schildkrötenschuppenhandschuhe | 36 | 200/220 (orange 180) | Muster 8385 bei **Jangdor Swiftstrider [H] Feralas** | 6× 4304, 8× Schildkrötenschuppe 8167, 8343 |
| 8198 / 8189 | Schildkrötenschuppenarmschienen / -brustplatte | 37 | 205/225 | Lehrer | 4304, 12× 8167, 8343 |
| 252449 | Lederstiefel des Hügelwächters (Forever-neu, BoE q2, Stufe 22) | 22 | 135/160 (orange 110) | Muster 252804, Händler in QDB nicht gefunden | 4233, 6× 2319, 2321 |

- Laut wow-professions (Forever) lehrt nur Hahrana Ironhide (Camp Mojache, Horde) bzw. Drakk Stonehand die Hose des Nachtschleichers. Das Fachmann-Training (>225) verlangt LW 200 und Stufe 35. [wow-professions](https://www.wow-professions.com/forever/leatherworking-leveling-guide)
- Laut wow-professions bekommt man Experten-LW (>150) bei Una in Donnerfels (Horde) für 50s. Voraussetzung sind LW 125 und Stufe 20. [wow-professions](https://www.wow-professions.com/forever/leatherworking-leveling-guide)
- Die Hotfix vom 06.11.2026 senkte den Gerbrahmen (Spell 1263031, Item 279941) auf 125/125/130. Lokal belegt durch [Data_Hotfix.lua](file:///home/user/Tiry/wow-addons/addons/RezeptRadar/Data_Hotfix.lua) und [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold).
- Leichte Lederreagenzientasche 277715 hat Bindung 2. Die Marge liegt nur bei ~2s US und 1s EU, deshalb nicht aufnehmen. Das Muster 277716 gibt es laut QDB nur bei Saenorion (Ally). [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)
- Ältere Guides (nicht Forever) halten Armor Kits für dauerhaft gut verkäuflich. [alteredgamer](https://www.alteredgamer.com/wow-gold/19223-the-ultimate-free-making-guide-leatherworking/)

### Inferences
- Bei Skill 175 kann der Char schon jetzt das Schwere und das Kraftvolle/Mystische schwere Rüstungsset herstellen. Dafür muss er das Muster bei Mahu in Donnerfels kaufen; die Daten zeigen 135 als nötigen Skill.
- Weitere aktuelle Kandidaten: Barbarisch-Teile, Wächter- und Schwärzlich-Teile, Geschmeidiger schwerer Balg.
- Nächste Lernziele 175–225: Dickes Leder/Set, dann Kraftvolles/Mystisches dickes Set (orange ab 185). Außerdem Nachtschleicher-Teile, Schildkrötenschuppe und Schultern des Nachtschleichers.
- Der Schwere Lederball ist ein Spaß-/Spielzeug-Item mit geringer Nachfrage. Nur als Nische führen.
- Forever-Kits verlangen Zutaten aus Verzauberkunst und Alchemie (Seelenstaub, Visionenstaub, Elixiere, Manatränke). TSM sollte diese als Material-Einkauf mit Höchstpreis führen.

### Gaps
- Die Werte der Forever-Kits (+X Angriffskraft bzw. Zaubermacht) wurden in keiner Quelle gefunden.
- Für 252784/252783 (mittlere Kits) und 252804 (Hügelwächter-Stiefel) liefern die lokalen QDB-Daten keine Händler.
- Händler „Gorhak“ (252833) hat in den Daten keine Fraktion.
- Bei Lehrer-Rezepten ist der Lern-Skill (orange) lokal nicht hinterlegt.
- Keine echten Forever-AH-Preise der Horde-Seite und keine Verkaufsraten pro Item gefunden. Die müssen per TSM-Scan kommen.

---

## Frage 2: Lederverarbeitungs-Materialien (Einkauf/Farm)

### Takeaway
Die Material-Gruppe besteht aus:
- Ledern und Bälgen in den Stufen Mittel, Schwer und Dick.
- Salz und Tiefsteinsalz.
- Fäden und Farbstoffen. Die kauft man beim Händler; sie sind kein Einkauf im AH, sondern nur eine Preisgrenze.
- Spezialmaterial wie Raptorbalg, Großer Fangzahn, Schildkrötenschuppe, Grünwelpenschuppe, Dicke Murlocschuppe, Eiserne Gürtelschnalle und Schattenöl.
- Den Zutaten der Forever-Kits.

### Cited Findings (lokale Daten; vk = Händler-Ankaufpreis in Kupfer, Stapelgröße)

**Leder/Bälge (Farm per Kürschnerei oder AH-Kauf)**
- 2319 Mittleres Leder (vk 50).
- 4234 Schweres Leder (vk 150).
- 4304 Dickes Leder (vk 300).
- 8170 Unverwüstliches Leder (vk 500).
- 4232 Mittlerer Balg (vk 125).
- 4235 Schwerer Balg (vk 200).
- 8169 Dicker Balg (vk 500).
- 8171 Unverwüstlicher Balg (vk 500).
- Hinweis: QDB nennt als Händler für 2319/4234/4304/8170 nur Lhara (Dunkelmond-Jahrmarkt, Mulgore-Standort). Das ist begrenzter Bestand.

**Salz**
- 4289 Salz (vk 12; Händler [H] u. a. Mahu TB, Tamar/Felika/Shimra OG, Joseph Moore UC).
- 8150 Tiefsteinsalz (nur Drop, vk 250).
- 15409 Raffiniertes Tiefsteinsalz (vk 1000).

**Fäden** (Horde-Händler: Mahu TB, Borya/Tamar/Felika/Shimra OG, Daniel Bartlett/Millie Gregorian/Joseph Moore/Felicia Doan UC, Shadi Mistrunner TB)
- 2320 Grober Faden.
- 2321 Feiner Faden.
- 4291 Seidenfaden.
- 8343 Schwerer Seidenfaden.
- 14341 Runenfaden.
- Data_VendorMats nennt Händler-Verkaufspreise: 2321 = 1s, 4291 = 5s, 8343 = 20s, 14341 = 50s.

**Farbstoffe**
- 2324 Bleiche.
- 2604 Roter Farbstoff.
- 2605 Grüner Farbstoff (Händlerpreis 1s).
- 4340 Grauer Farbstoff (3,5s).
- 2325 Schwarzer Farbstoff (10s).
- 6260 Blauer Farbstoff.
- 6261 Oranger Farbstoff (10s).
- Alle bei denselben Horde-Stadthändlern, außer 6261 (nur Hügellande/Schlingendorntal u. a.).

**Spezialmaterial (kein Händler, Drop/AH)**
- 7071 Eiserne Gürtelschnalle (Schmied, laut wow-professions am besten im AH kaufen [wow-professions](https://www.wow-professions.com/forever/leatherworking-leveling-guide)).
- 4461 Raptorbalg.
- 5637 Großer Fangzahn.
- 7392 Grünwelpenschuppe.
- 5785 Dicke Murlocschuppe.
- 8167 Schildkrötenschuppe.
- 7428 Schattenkatzenbalg.
- 4096 Grobes Gorillahaar.
- 3824 Schattenöl.
- 4305 Seidenstoffballen.
- 1210 Schattenedelstein.
- 1206 Moosachat.
- 5498 Kleine irisierende Perle.
- 5500 Schillernde Perle.

**Zutaten der Forever-Kits**
- 11083 Seelenstaub.
- 6662 Elixier des Riesenwuchses.
- 3385 Geringer Manatrank.
- 11137 Visionenstaub.
- 3391 Elixier der Ogerstärke.
- 3827 Manatrank.

**Forever-neu**
- 249427 Makelloses Leder (q2, vk 125). Wird für die BoP-Rezepte gebraucht.
- 249428 Makelloser Balg (q2).
- Laut Timesaver: Makelloses Leder kostet ~17s US, Makelloser Balg ~5s US. [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)

Der wow-professions-Guide (Forever) empfiehlt, Lederverarbeitung mit Kürschnerei zu kombinieren, weil Leder den Großteil der Kosten ausmacht. [wow-professions](https://www.wow-professions.com/forever/leatherworking-leveling-guide)

### Inferences
- Händler-Fäden und -Farbstoffe in TSM als „Händler-Material“ mit fixem Preis führen statt AH-Einkauf. Nur bei AH-Preis unter Händlerpreis snipen.
- Schwerer Balg plus Salz zu 4236 und Dicker Balg plus Tiefsteinsalz zu 8172 sind „Veredeln statt Rohverkauf“-Kandidaten. TSM-Crafting-Preisvergleich nutzen.

### Gaps
- Kein Forever-AH-Preisniveau für Horde-Server gefunden.

---

## Frage 3: Kochen 225: verkaufbare Produkte und Rohstoffe

### Takeaway
Mit Kochen 225 sind die wichtigsten verkaufbaren Rezepte (Lernstufe ≤ 225):
- Gewürzter Chilikrebs, Monsteromelett, Gekochter glänzender Machtfisch, Zartes Wolfsteak, Undermine-Muschelsuppe.
- Schwerer Kodoeintopf, Drachenodemchili, Spinnenwurst (Lehrer, +15 Ausdauer), Panzerfisch (+150 Rüstung).
- Die Forever-Neuheiten Pikante Hirschfrikadelle und Raptorrouladen.
- Tees (Heilkraft) und Smoothies (Willenskraft) der Commerce Authority.

Nachtflossensuppe und Gedünsteter Sonnenschuppenlachs verlangen 250 und sind noch nicht lernbar. Mit 225 aber bald.

### Cited Findings

**TSM-Gruppe „Kochen Verkauf“** (orange = Lern-Skill aus den Daten; alle Bindung 0)

| ID | Name | orange/gelb/grau | Rezept (Horde-Händler) | Material |
|---|---|---|---|---|
| 12216 | Gewürzter Chilikrebs | 225/265/305 | 16111: **Banalash [H] Sümpfe des Elends**, **Uthok [H] Schlingendorntal (Grom'gol)** | Zartes Krebsfleisch 12206, 2× Scharfe Gewürze 2692 |
| 12218 | Monsteromelett | 225/265/305 | 16110: **Bale [H] Teufelswald**, Himmik [AH] Winterquell | Riesenei 12207, 2× Feine Gewürze 3713 |
| 13927 | Gekochter glänzender Machtfisch | 225/265/305 | 13940: **Kelsey Yance [AH] Beutebucht** | Roher glänzender Machtfisch 13754, 3713 |
| 18045 | Zartes Wolfsteak | 225/265/305 | 18046: **Innkeeper Fizzgrimble / Dirge Quikcleave [AH] Tanaris** | Zartes Wolfsfleisch 12208, 3713 |
| 16766 | Undermine-Muschelsuppe | 225/265/305 | 16767: **Jabbey [AH] Tanaris** | 2× Scharfes Muschelfleisch 7974, 2692, Eiskalte Milch 1179 |
| 6887 | Tüpfelgelbschwanz | 225/265/305 | 13939: Gikkix [AH] Tanaris | Roher Tüpfelgelbschwanz 4603 |
| 13930 | Rotkiemenfilet (+18 Angeln) | 225/265/305 | 13941: Kelsey Yance [AH] | Roher Rotkiemen 13758 |
| 286152 | Panzerfisch (Forever, +150 Rüstung) | 225/245/255 | 286153 (Quelle in QDB unbekannt) | Roher Panzerfisch 13890, 3713 |
| 250065 | Pikante Hirschfrikadelle (Forever) | 225/230/245 | 250173 (Quelle in QDB unbekannt) | 2× Hirschfleisch 5471, 3× 2692 |
| 250076 | Raptorrouladen (Forever) | 225/230/245 | 250184 (Quelle in QDB unbekannt) | 2× Raptorfleisch 12184, 4× 2692 |
| 17222 | Spinnenwurst (+15 Ausdauer) | Lehrer, 240/280 | Lehrer | 2× Weißes Spinnenfleisch 12205 |
| 12215 | Schwerer Kodoeintopf | 200/240/280 | 12240: **Kireena [H] Desolace** | 2× Schweres Kodofleisch 12204, 3713, 159 |
| 12217 | Drachenodemchili | 200/240/280 | 12239: **Ogg'marr [H] Düstermarschen** | Eigenartiges Fleisch 12037, Kl. Flammenbeutel 4402, 2692 |
| 13851 | Scharfe Wolfrippchen | 175/215/255 | 12229: **Sheendra Tallgrass [H] Feralas** | Rotes Wolfsfleisch 12203, 2692 |
| 12210 | Gerösteter Raptor | 175/215/255 | 12228: **Nerrist [H] Schlingendorntal**, **Keena [H] Arathi**, **Ogg'marr [H]** | Raptorfleisch 12184, 2692 |
| 12212 | Dschungeleintopf | 175/215/255 | 12231: **Nerrist [H] Schlingendorntal** | Tigerfleisch 12202, 159, 2× Apfel 4536 |
| 12213 / 12214 | Aas Surprise / Eigenartiger Eintopf | 175/215/255 | 12232: **Banalash [H]**, **Ogg'marr [H]**, **Kireena [H]**; 12233 nur Ally-Händler (AH) | Eigenartiges Fleisch 12037 |
| 6038 | Riesenmuschelrisotto | 175/215/255 | 6039: Kelsey Yance [AH] | Riesenmuschelfleisch 4655, 2692 |
| 20074 | Schwerer Krokiliskeneintopf | 150/160/200 | 20075: **Ogg'marr [H] Düstermarschen** | 2× Zartes Krokiliskenfleisch 3667, 3713 |
| 21217 | Weisenfisch Supreme | 175/215/255 | 21219: viele Händler, u. a. **Naal Mistrunner [H] Donnerfels**, **Xen'to [H] Orgrimmar**, **Ronald Burch [H] Unterstadt** | Roher großer Weisenfisch 21153 |
| 4594 / 8364 | Steinschuppenkabeljau / Mithrilkopfforelle | 175/190/230 bzw. 175/215/255 | 6369 / 17062: **Shankys [H] Orgrimmar**, **Lizbeth Cromwell [H] Unterstadt**, Wulan [H] Desolace | Roh 6362 / 8365 |
| 249869 | Sonniger Tee (+33 Heilkraft) | 200/220/250 | 249883 (Commerce Authority) | Mondbeerensaft 1645, 2× Sonnengras 8838 |
| 249875 | Scharfer Smoothie (+15 Willenskraft) | 200/215/225 | 249889: **Aza'bek [H] Brachland** | 1645, 3× 3713, Kl. Flammenbeutel 4402 |
| 249868 / 249874 | Triagetee / Verkalkter Smoothie | 180/195/235 bzw. 180/185/195 | 249882 / 249888 (Aza'bek [H]) | 1708 + Blassblatt 3818 / 1708, 3× 2692, 5637 |

Bald erreichbar (250, noch nicht lernbar):
- Nachtflossensuppe 13931 (+22 Zaubermacht).
- Gedünsteter Sonnenschuppenlachs 13932 (+40 Angriffskraft).
- Tee des Weisen 249870 (+44 Heilkraft).
- Heftiger Smoothie 249876 (+20 Willenskraft).
- Filet aus der Flanke 238638, Morgengrauenomelett 238639, Pirschersteak 238637. Diese brauchen Weihsalz 239016 (Drop).

Belege aus dem Web:
- Method.gg listet folgende Forever-Werte:
  - Spinnenwurst +15 Ausdauer (200).
  - Panzerfisch +150 Rüstung (225).
  - Gegrillter Kalmar und Scharfer geräucherter Barsch +1 % Krit (240).
  - Nachtflossensuppe +22 Zaubermacht.
  - Gedünsteter Sonnenschuppenlachs +40 Angriffskraft (250).
  - Sonniger Tee +33 bzw. Tee des Weisen +44 Heilkraft.
  - Scharfer Smoothie +15 bzw. Heftiger Smoothie +20 Willenskraft.
  - Rotkiemenfilet +18 Angeln.

  Die Seite ist als „work in progress“ markiert und gibt für Chilikrebs/Monsteromelett/Machtfisch keine Buffs an. [Method.gg](https://www.method.gg/wow-forever/all-cooking-recipes-and-best-food-in-wow-forever)
- Laut Warcraft Tavern kommen die 6 Smoothies von NPCs der „Azeroth Commerce Authority“. Jedes Forever-„Satt“-Buff gibt zusätzlich einen EP-Bonus. [Warcraft Tavern](https://www.warcrafttavern.com/forever/news/new-cooking-recipes-for-world-of-warcraft-forever/)
- Die Tee-Leiter laut Suchergebnis-Zusammenfassung: Peace 2, Royal 7, Root 11, Triage 22, Sunny 33, Sage's 44 Heilkraft. [Method.gg](https://www.method.gg/wow-forever/all-cooking-recipes-and-best-food-in-wow-forever)

**Kochen-Rohstoffe (TSM „Kochen Material“)**

Händlerware (Horde-Städte):
- 2692 Scharfe Gewürze und 3713 Feine Gewürze: Naal Mistrunner TB, Felika/Xen'to/Shimra OG, Ronald Burch/Daniel Bartlett/Felicia Doan UC, Shadi Mistrunner TB.
- 2678 Milde Gewürze.
- 159 Quellwasser.
- 1179 Eiskalte Milch.
- 4536 Glänzender roter Apfel.
- 1645 Mondbeerensaft.
- 1708 Süßer Nektar.
- 8766 Trichterwindentau.
- 2596 Zwergisches Starkbier: Barkeep Morag, Orgrimmar.

Drop/AH:
- 12206 Zartes Krebsfleisch.
- 12207 Riesenei.
- 12208 Zartes Wolfsfleisch.
- 12204 Schweres Kodofleisch.
- 12037 Eigenartiges Fleisch.
- 12184 Raptorfleisch.
- 12202 Tigerfleisch.
- 12203 Rotes Wolfsfleisch.
- 12205 Weißes Spinnenfleisch.
- 3667 Zartes Krokiliskenfleisch.
- 5471 Hirschfleisch.
- 4655 Riesenmuschelfleisch.
- 7974 Scharfes Muschelfleisch.
- 4402 Kleiner Flammenbeutel.

Fisch (Angeln/AH):
- 13754 Roher glänzender Machtfisch.
- 13758 Roher Rotkiemen.
- 4603 Roher Tüpfelgelbschwanz.
- 6362 Roher Steinschuppenkabeljau.
- 8365 Rohe Mithrilkopfforelle.
- 21153 Roher großer Weisenfisch.
- 13890 Roher Panzerfisch.
- 13755 Roher Winterkalmar und 13756 Roher Sommerbarsch, beide für die 240er-Rezepte.

### Inferences
- Die Rezepte für Chilikrebs, Machtfisch, Zartes Wolfsteak und Undermine-Muschelsuppe gibt es in Beutebucht, Grom'gol und Tanaris. Für einen Stufe-36-Horde-Char ist das gut erreichbar.
- Monsteromelett (Bale, Teufelswald) ist auf Stufe 36 riskanter zu holen.
- Nur die Ausdauer/Willenskraft- bzw. Rüstungs-Buff-Essen und die Tees/Smoothies haben echte Spielernachfrage. „Plain-Food“ (Dschungeleintopf, Gerösteter Raptor) verkauft sich hauptsächlich als Heilnahrung an Leveler.

### Gaps
- Die genauen Forever-Buffwerte für Chilikrebs, Monsteromelett, Machtfisch, Zartes Wolfsteak, Kodoeintopf, Hirschfrikadelle, Raptorrouladen, Bärenbraten und Riesiges Rührei wurden nicht verifiziert. Classic-Werte (z. B. +12 Ausdauer/Willenskraft für Stufe-35-Essen) sind aus dem Gedächtnis und unbestätigt.
- Händler für die Forever-Rezepte 250173 / 250184 / 286153 / 249883 sind in QDB nicht vorhanden.
- Die Machtfisch-Rezeptquelle Kelsey Yance ist [AH]. Das Rezept ist also für die Horde kaufbar.

---

## Frage 4: Rohstoffe zum Weiterverkauf (Farm mit Stufe 30–40, Horde)

### Takeaway
Gute Farmkandidaten sind:
- Kürschnerei: Schweres und Dickes Leder, Schwerer und Dicker Balg, Raptorbalg, Schildkrötenschuppe, Grünwelpenschuppe.
- Kochfleisch für die Buff-Rezepte, z. B. Zartes Krebsfleisch, Riesenei und Zartes Wolfsfleisch.
- Fisch: Machtfisch und Rotkiemen.

### Cited Findings (lokale Daten)
- Die Leder- und Balg-IDs stehen bei Frage 2.
- Zartes Krebsfleisch 12206 hat laut QDB nur 3 droppende NPC-Typen, Schweres Kodofleisch 12204 ebenfalls nur 3. Das deutet auf knappes Angebot und damit gute AH-Preise hin. Das ist eine Ableitung.
- Riesenei 12207 hat 28 Drop-NPCs, Zartes Wolfsfleisch 12208 hat 48.
- Fertige Kits und Zwischenprodukte (4236, 4304) sind laut Rohstoff-Check-Logik des Projekts oft mehr wert als roh verkaufte Leder. Das ist in der Projektdoku (`wow-addons/CHANGELOG.md`) beschrieben, aber nicht mit Preisen belegt.

Empfohlene TSM-Gruppe „Rohstoffe Verkauf“:
- Leder und Bälge: 4234, 4304, 4235, 8169, 4232, 2319.
- Spezialmaterial: 4461, 8167, 7392, 5785, 7428.
- Fleisch: 12206, 12207, 12208, 12204, 12203, 12202, 12184, 3667.
- Fisch: 13754, 13758, 4603, 21153, 8365, 6362.

### Inferences
- Wo Kürschnern auf Stufe 30–40 als Horde lohnt: Raptoren im Sumpfland und in den Arathihochlanden (Raptorbalg) sowie Feralas und Hinterland. Diese Gebiete sind nur aus allgemeinem Spielwissen bekannt und nicht in den Daten geprüft.

### Gaps
- Keine Forever-spezifischen Farmguides oder Preisdaten gefunden.

---

## Frage 5: „Sniper/Deals“-Gruppe (für das Levelbereich-Segment oft unterpreisig)

### Takeaway
Für den Sniper eignen sich:
- Muster und Rezepte, die nur über Drop oder die Allianz zu bekommen sind.
- BoE-Blaue und Grünzeug unter Händlerpreis.
- Stark nachgefragte Zwischenmaterialien.

Eine geprüfte Quelle über Forever-„Deals“ wurde nicht gefunden.

### Cited Findings (IDs aus lokalen Daten)
- Muster nur aus Drop, für Horde nur über das AH: 4297, 4301, 4299, 4298, 8384, 7453, 7452, 5974, 4300, 7449, 7450, 8386, 8387, 8395, 8397, 8398, 8403, 8404, 8405.
- Nur Ally-Händler, im AH oft billig: 13288 (Raptorbalggürtel), 7290 (Rotwelpenhandschuhe), 7289 / 20576 (Schwarzwelpen), 3680, 2700, 3683, 3681 (Kendor Kabonka), 12233.
- Kochrezepte der Forever-Commerce-Authority und Forever-Muster mit unbekannter Quelle: 250173, 250184, 286153, 252804, 252784, 252783.
- Material für den Snipe unter Händlerpreis: 4236, 8172, 7071, 4461, 3824, 5637, 249427.
- Laut Timesaver ist das Material „Makellose Schuppe“ beim Händler Mister Graphed 52g 63s teuer, im AH aber nur 2g 20s (560 eingestellt). Das ist ein Beispiel für massive Händler-AH-Differenzen. [Timesaver](https://timesaver.gg/blog/wow-forever-leatherworking-recipes-gold)

### Inferences
- In TSM für den Sniper einen Schwellwert unter dem Händlerpreis (vk aus Data_AllItems) bzw. unter ~60 % des Marktwerts setzen. Das ist eine Ableitung, keine Quelle.

### Gaps
- Keine Forever-Quelle zu konkreten „unterpreisigen“ Items im Levelbereich gefunden.
- Kürschnerei beim Char ist nicht bestätigt.
