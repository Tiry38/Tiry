# AUDIT – Tiry's Zentrale 4.5.0 → 5.0.0

Geprüft am 08.11.2026 gegen **WoW: Forever 1.60.1.70862** (Interface 16001, Spieltyp „Camelot“, `WOW_PROJECT_ID = 18` – belegt in `Blizzard_ProjectConstants/Camelot/ProjectConstants.lua:1-2` der Forever-UI-Quellen, Gethe/wow-ui-source Branch `forever`).

Status je Befund: **behoben** (mit Datei:Zeile in 5.0.0) oder **bewusst gelassen** (mit Grund).
Ausführlicher API-Prüfbericht mit allen Belegen: `docs/AUDIT-API-Anhang.md`. Web-Recherche und Datenstichprobe: `docs/RECHERCHE-Anhang.md`.

---

## 1. API-Prüfung gegen Forever

**Umfang:** 158 Funktionen, Ereignisse, Konstanten und .toc-Felder, jeweils gegen `Blizzard_APIDocumentationGenerated` und die Nutzung im Blizzard-Code (Camelot/Mainline-Ordner) geprüft.

| Ergebnis | Anzahl |
|---|---|
| existiert, korrekt benutzt | 147 |
| kein Beleg gefunden (alle abgesichert/mit Rückfall) | 6 |
| Signatur anders | 0 |
| mit falscher Bedeutung benutzt | 1 (behoben) |
| Auctionator-Interna | 4 (abgesichert) |

Geprüfte Schwerpunkte (Details im Anhang):
- `C_TradeSkillUI.CraftRecipe(recipeID, numCasts, craftingReagents, recipeLevel, orderID, concentrating)`: Reihenfolge und Typen stimmen mit der Doku und Blizzards eigenem Aufruf überein.
- `C_AuctionHouse.*`: Das Addon liest nur Suchergebnisse. Es kauft, bietet und stellt nie selbst ein.
- `C_SkillInfo`, `C_SpellBook.IsSpellKnown`, `C_MerchantFrame`, `C_Map`/`C_SuperTrack`/`UiMapPoint`, `C_Item`, `C_Container`, `C_Bank`, `C_Texture.GetAtlasInfo`, `TooltipDataProcessor`.
- .toc-Felder `AddonCompartmentFunc*` und `IconTexture`.
- **Settings-API:** wird nicht benutzt (eigene Einstellungsseite).
- Alle 28 Ereignisse existieren, und alle Handler lesen die Nutzdaten in der dokumentierten Reihenfolge.

### Befunde und Status

| # | Befund (Stand 4.5.0) | Status 5.0.0 |
|---|---|---|
| A1 | `ItemSearchResultInfo.buyoutAmount` ist der Preis der **ganzen** Auktion. Das Schnäppchen-Radar hat ihn als Stückpreis behandelt, was zu falschen Ersparnissen führte. | **behoben** `Deals.lua:65`, ebenso im neuen Preisalarm `Alerts.lua:77` |
| A2 | `C_TradeSkillUI.GetAllRecipeIDs` gibt es in Forever nicht (toter Zweig). `GetFilteredRecipeIDs` hängt von Suchfeld und Filtern im Berufsfenster ab. | **behoben** `Scanner.lua:174`: gefilterte IDs **plus** eigene Rezept-IDs, die `GetRecipeInfo` kennt. Toter Zweig auch in `UI/PageRecipes.lua` entfernt. |
| A3 | Bankbestand las Container `-2` (`Enum.BagIndex.Characterbanktab`). Das sind in Forever die **Taschenplätze** der Bank, nicht die Fächer (`Camelot/BankFrame.lua:186,323`). | **behoben** `Inventory.lua:34`: Fächer über `C_Bank.FetchPurchasedBankTabData`, Rückfall 6–14 |
| A4 | `BuyFlips`: Menge in Händler-Bündeln statt Stück, nicht nach `GetMerchantItemMaxStack` aufgeteilt | **behoben** `Autopilot.lua:95` |
| A5 | `ns.On` ignorierte das `false` von `RegisterEvent` (ohne Fehler) | **behoben** `Core.lua:39` |
| A6 | Ergebnis von `OpenTradeSkill` ignoriert: Der Chat meldete „geöffnet“, obwohl nichts aufging | **behoben** `UI/PageRecipes.lua:408` |
| A7 | Ergebnis von `C_Map.SetUserWaypoint` (`wasSet`) ignoriert | **behoben** `Maps.lua:44` |
| A8 | `ExpandSkillHeader` klappte das Skill-Fenster des Spielers auf | **behoben** `Core.lua:191`: zuerst `C_SkillInfo.GetSkillLineInfoByID` (ändert nichts). Altes Verfahren nur noch als Rückfall. |
| A9 | Der Client liest nur `## Category` (`AddonList.lua:456`), nicht `Category-deDE` | **behoben** `TirysZentrale.toc:7` |
| A10 | Fünf Chat-Meldungen nannten falsche Listennamen („Tiry's Zentrale: …“ statt „Zentrale: …“) | **behoben** (alle UI-Seiten) |
| A11 | Beim Berufswechsel wurde der offene Beruf nicht neu gelesen | **behoben** `Scanner.lua:272` (`S.openProfKey`, Neulesen bei jedem Rescan) |
| A12 | Ohne Beleg, aber abgesichert: `GetMerchantItemInfo`, globales `GetItemInfo`/`GetItemIcon`, `AUCTION_EXPIRED_MAIL_SUBJECT` | **bewusst gelassen**: Nur Rückfall hinter `C_*`-Funktionen bzw. mit festem deutschem Text. Schadet nicht. |

### Nachtrag 5.1.0: neue AH-Funktionen (geprüft gegen `AuctionHouseDocumentation.lua`)
- `QueryOwnedAuctions(sorts)`, `GetNumOwnedAuctions()`, `GetOwnedAuctionInfo(i)` → `OwnedAuctionInfo` mit den Feldern `auctionID`, `itemKey`, `status` (Active/Sold), `quantity`, `timeLeftSeconds` und `buyoutAmount`.
- `SendSearchQuery(itemKey, sorts, separateOwnerItems)`, `IsThrottledMessageSystemReady()`, `GetItemKeyInfo(itemKey).isCommodity`, `MakeItemKey(itemID)`.
- Keine dieser Funktionen hat ein Einschränkungs-Flag (nur `SecretArguments = "AllowedWhenUntainted"`). Sie laufen also auch ohne Klick, so wie Auctionators eigener Auto-Scan.
- Ereignisse: `OWNED_AUCTIONS_UPDATED`, `AUCTION_HOUSE_THROTTLED_SYSTEM_READY`, `AUCTION_HOUSE_AUCTION_CREATED`, `AUCTION_CANCELED` und `AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION` (notification, text, auctionID).
  - Laut `Blizzard_ChatFrameUtil.lua:3` kommt diese Meldung „whether or not AH UI is shown“, also auch fern vom AH.
  - Werte laut `AuctionHouseEnumsDocumentation.lua:117-118`: AuctionSold = 4, AuctionExpired = 5.
- Preis pro Stück: Bei Stapelware ist `buyoutAmount` der Stückpreis, bei Einzel-Items der Preis der ganzen Auktion. Unterschieden wird über `isCommodity`, getestet in busted „Meine Auktionen“.

## 2. Auctionator

- **Öffentliche API v1 (Auctionator v342, 07.11.):** Genutzt werden 7 Funktionen, alle korrekt aufgerufen: `GetAuctionPriceByItemID`, `GetAuctionAgeByItemID`, `GetVendorPriceByItemID`, `ConvertToSearchString`, `CreateShoppingList`, `MultiSearchExact`, `RegisterForDBUpdate`.
- **Interna:**
  - Befund: `Market.lua` startete den Scan über `Auctionator.State.*ScanFrameRef:InitiateScan()`. Auctionator lehnt den Scan in der 15-Minuten-Sperre still ab. Das Addon meldete trotzdem „Scan läuft“ und später „Scan fertig“, beides falsch.
  - **Behoben** `Market.lua:187`:
    - Typen werden geprüft, `inProgress`/`doingFullScan` und `CanInitiate()` werden abgefragt.
    - Ehrliche Meldung, je nach Lage: Sperre, läuft schon oder Anleitung.
    - Alles läuft in `pcall`.
  - **Bewusst gelassen:** Für den Scan-Start gibt es **keine** öffentliche Funktion (geprüft: alle 21 Funktionen von API v1). Der Knopf ist für Einsteiger wichtig. Ändert Auctionator seine Interna, erscheint nur die Anleitung und kein Fehler.
- **Befund: „Scan vor X Min.“ war zu optimistisch.** `RegisterForDBUpdate` feuert auch nach normalen AH-Suchen. **Behoben** `Market.lua:165`:
  - Die Anzeige heißt jetzt „Preise von vor X“.
  - Ein echter Komplett-Scan wird getrennt gespeichert (`lastFullScan`).

## 3. Daten

- **Neuerer Build?** Nein. wago.tools listet für das Produkt `wowf` als neuesten Build **1.60.1.70862** (07.11.2026, 04:43). Davor kamen 70840 und zum Start (04.11.) 70790. Daten und Generator-Skripte (`tools/gen_alldb.py`, `tools/gen_recipes.py`, `tools/gen_spots.py`) sind auf diesem Stand. Bei einem Hotfix-Build: die CSVs von wago.tools neu laden und die Skripte erneut ausführen (Aufruf in `README.md`).
- **Stichprobe** (Wowhead Forever, Details im Recherche-Anhang):

  | Teil | Ergebnis |
  |---|---|
  | Items | **29/30 OK**. Abweichung: 279465 „Monster Chest (DNT)“ hat laut Wowhead 1 Kupfer Händlerpreis statt 0. Das ist ein interner Platzhalter. |
  | Rezepte | **20/20 OK** (Name, Ergebnis, Material). Skill-Grenzen und Mengen lassen sich auf Wowhead-Tooltips nicht prüfen. |
  | Farm-Spots | **5/15 bestätigt** (Kreaturen in genau dieser Zone), 0 Fehler. Bei den 10 Kräuter- und Erz-Spots stimmen die Namen und passen zur Zone. Koordinaten nennt Wowhead dafür nicht, deshalb sind sie nicht prüfbar. |

  Zur Item-Abweichung: Interne Platzhalter wie „(DNT)“, „NYI“ und „OBSOLETE“ blendet die Suche jetzt aus (`Database.lua`, `JUNK`).
- **Hinweis:** Zwei Items der Stichprobe (211323, 220682) stammen laut Wowhead aus Season of Discovery und „gibt es eventuell nicht in Forever“. Sie stehen trotzdem in den Forever-Spieldaten und bleiben deshalb drin.

## 4. Taint und Sicherheit

- **Kauf, Verkauf und Craften nur per Klick:** `BuyMerchantItem`, `C_Container.UseContainerItem`, `CraftRecipe`/`OpenTradeSkill`/`OpenRecipe` und die Auctionator-Suche laufen nur aus Klick-Handlern oder Tastenkürzeln (Hardware-Ereignis).
- **Automatik:** Zwei Dinge laufen automatisch, beide in den Einstellungen abschaltbar. Beides sind Blizzard-eigene Händler-Funktionen ohne Einschränkungs-Flag in der Doku.
  - Grauen Schrott verkaufen (`SellAllJunkItems`). Neu: nur wenn `C_MerchantFrame.IsSellAllJunkEnabled()` zustimmt, also wenn auch Blizzards Knopf da ist (`Autopilot.lua:22`).
  - Reparieren (`RepairAllItems(false)`, eigenes Gold, nicht die Gildenbank), abgesichert mit `pcall` (`Extras.lua:111`).
- **Kampf-Sperre (neu):** `ns.InCombat`/`ns.CombatBlocked` (`Core.lua:339`, `Core.lua:343`). Im Kampf passiert keins dieser Dinge:
  - Händlerkauf
  - Händlerverkauf
  - Flip-Kauf
  - Craften
  - Schrottverkauf
  - Reparatur

  busted-Test „Kampf-Sperre“ prüft das, einschließlich „nach dem Kampf geht es wieder“.
- **Keine geschützten Rahmen:** Das Addon nutzt keine sicheren Templates. Fenster öffnen und schließen ist im Kampf erlaubt.
- **Keine Automatisierung jenseits davon:** Das Addon postet, bietet und kauft nie im AH.
- **Globale Variablen:** `luac -l` zeigt genau 14 SETGLOBAL: `TirysZentrale`, die SavedVariables, `SLASH_*`, `BINDING_*` und die Addon-Fach-Funktionen.

## 5. Leistung

Gemessen mit Lua 5.1 im Forever-Nachbau. Speicherwerte enthalten die Nachbau-Objekte; im Spiel liegen Rahmen im C-Speicher, die echte Zahl misst `INGAME-TEST.md`.

| Messpunkt | 4.5.0 | 5.0.0 |
|---|---|---|
| Nach Login | 4,7 MB | 4,9 MB |
| Nach dem **ersten Item-Tooltip** | **19,6 MB** | **5,9 MB** |
| Alle Seiten geöffnet | 37,7 MB | **23,4 MB** |
| Ruckler beim ersten Tooltip (Datenbank einlesen) | 76 ms | 10 ms (Index) |

- **Ursache in 4.5.0:**
  - Die Item-Datenbank (18.416 Items) wurde beim ersten Tooltip komplett in Tabellen verwandelt (17,5 MB).
  - Die Item-Suche hielt bei leerem Suchfeld alle Treffer fest.
- **Lösung:**
  - `Database.lua:55`: ein Index ID → Textposition; gelesen wird nur die gebrauchte Zeile. Die Suche läuft direkt im Text, und nur Treffer werden zu Tabellen.
  - `UI/PageDatabase.lua:136`: kein Volllauf ohne Suchwort, das Ergebnis wird zwischengespeichert, behalten werden nur die angezeigten Zeilen.
- **Load-on-Demand-Modul (`TirysZentrale_Data`): bewusst nicht gemacht.**
  - Nach dem Umbau kostet die Datenbank nur noch ihren Rohtext (~1 MB).
  - Ein LoD-Modul bräuchte einen **zweiten Ordner** in `AddOns`. Das widerspricht der Lieferung als ein Ordner und ist eine Fehlerquelle für Einsteiger (Ordner vergessen → Funktionen fehlen).
  - Ersparnis ~1 MB gegen mehr Einrichtungsaufwand: lohnt nicht.
- **Ereignisse:**
  - `BAG_UPDATE_DELAYED` ist überall entprellt (0,3–1 s).
  - Der Taschen-Scanner rechnet nur, wenn seine Seite offen ist (`bagsWanted`).
  - Die Farm-Session aktualisiert sich nur bei offener Ansicht (1×/s).

## 6. Randfälle (busted, `spec/zentrale_spec.lua`)

| Fall | Ergebnis |
|---|---|
| Kein Auctionator | lädt, alle Ansichten öffnen, „Auctionator installieren“ als nächster Schritt, Scan-Knopf und Listen scheitern ohne Fehler |
| Keine Scandaten | „Preise holen“ als nächster Schritt |
| Keine Berufe, Stufe 1 | lädt, alle Ansichten öffnen, der Berater nennt den Grund |
| Fehlende API-Funktionen (CraftRecipe, OpenTradeSkill, C_MerchantFrame, SetUserWaypoint, C_Bank, C_Texture, InCombatLockdown, C_SuperTrack, GetMerchantItemMaxStack, C_SpellBook) | keine Fehler |
| Kampf | gesperrt, nach dem Kampf wieder frei |
| Allianz/Horde, deDE/enUS, leerer Item-Cache, kaputte SavedVariables | `tests/run_tests.lua` (4 Szenarien) |
| Volle Taschen | Händler-Kauf: Der Server lehnt Käufe ohne Platz ab; das Addon kauft nur fehlende Mengen. Nur im Spiel prüfbar → `INGAME-TEST.md` |
| Gildenreparatur | bewusst nicht automatisch (nur eigenes Gold), damit nie ungefragt Gildengold ausgegeben wird |

## 7. Lizenz

- `LIZENZ.txt` und `LICENSE-GPL-3.0.md` bleiben: GPL-3.0 wegen der aus QuestieDB berechneten Farm-Spots. Quelle steht auch in den Tooltips und Hinweisen der Farm- und Kürschner-Ansicht.
- `Media/Fonts/OFL.txt` (Poppins, SIL OFL 1.1) liegt bei.
- Auctionator wird **nicht** mitgeliefert, nur über seine öffentliche API angesprochen.

## Prüfergebnisse 5.0.0 (echte Zahlen)

| Prüfung | Ergebnis |
|---|---|
| `luac5.1 -p` alle 48 Lua-Dateien | 0 Fehler |
| `luacheck` (Lua 5.1, WoW-Globals in `.luacheckrc`) | **0 Warnungen / 0 Fehler** |
| Globale Schreibzugriffe (`luac -l`, SETGLOBAL) | 14, alle erlaubt |
| `busted` (`spec/`) | **20/20** |
| `lua5.1 tests/run_tests.lua` (4 Szenarien) | **816/816** |
| `lua5.1 tests/check_layout.lua` (alle 16 Ansichten + Craft-Planer mit Optionen + 3 Assistent-Schritte + Einkaufsliste, exakte Poppins-Maße) | **0 Layout-Probleme** |
| Glyphen-Test (jedes Sonderzeichen in Poppins vorhanden) | grün. Gegenprobe mit „★“ schlägt korrekt an. |

**Nur im Spiel prüfbar** (Checkliste: `INGAME-TEST.md`):
- echte Speicherzahl
- Darstellung im echten Client
- Auctionator-Scan-Start
- Horde-Wappen-Atlas
- Bankfächer
- `GetSkillLineInfoByID` mit echten Berufen
- Tastenkürzel-Menü
- Kauf bei vollen Taschen
