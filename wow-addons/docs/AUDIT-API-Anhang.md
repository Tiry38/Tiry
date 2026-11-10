> Anhang zu AUDIT.md. Automatisch erstellter Prüfbericht (Englisch) gegen **v4.5.0** – Zeilennummern beziehen sich auf 4.5.0. Alle Must-fix-Punkte sind in 5.0.0 behoben, siehe AUDIT.md.

# API audit: Tiry's Zentrale 4.5.0 vs. the WoW Forever 1.60.1.70862 client (Camelot, WOW_PROJECT_ID 18)

**Path abbreviations**
- `ADDON` = `TirysZentrale`
- `SRC` = `Interface/AddOns`
- `DOC` = `SRC/Blizzard_APIDocumentationGenerated`
- `AUC` = `ext/auct_dl/unz/Auctionator` (Auctionator v342, `## Interface: … 16001 …`)

**How this was checked**
- I read every non-data `.lua` file in full. That is all of `ADDON/*.lua` except the `Data*.lua` files, plus all of `ADDON/UI/*.lua`. I grepped the data files: they contain only `ns.*` tables and make no API calls.
- `luac5.1 -p` runs clean on every file. `luac -l` shows no accidental global writes. The only globals written are `TirysZentrale`, `TirysZentraleDB`, `TirysZentraleCharDB`, `SLASH_TIRYSZENTRALE1-3` and the three `TirysZentrale_OnAddonCompartment*` functions.
- I parsed the API docs as text and did not execute them. The script is at `scratchpad/tools/apidoc.py`, `flags.py` and `events.py`.
- **Camelot uses the mainline UI files.** 39 Blizzard `.toc` files carry `[ExcludeLoadGameType camelot]` on mainline-only lines, which only makes sense if camelot otherwise loads them. Example: `SRC/Blizzard_ChatFrame/Blizzard_ChatFrame.toc:26`. So `[Family]` resolves to `Mainline` and `[Game]` resolves to `Camelot`. "Mainline" evidence below therefore counts for Forever unless the line excludes camelot.

---

## MUST FIX (ordered by severity)

1. **Market.lua:174-197: `M.StartScan` drives Auctionator internals and reports a scan that may never start.**
   - It reaches into `Auctionator.State.FullScanFrameRef`, `Auctionator.State.IncrementalScanFrameRef`, `Auctionator.Config.Get` and `Auctionator.Config.Options.REPLICATE_SCAN`, then calls `:InitiateScan()`. None of these are public API.
   - `AuctionatorFullScanFrameMixin:InitiateScan()` (`AUC/Source_ModernAH/FullScan/Mixins/Frame.lua:19-31`) refuses quietly during its 15-minute cooldown (`CanInitiate`, lines 42-48). It only prints a message and raises no error, and the incremental scan refuses the same way when one is already running (`AUC/Source_ModernAH/IncrementalScan/Mixins/Frame.lua:61-74`).
   - So `pcall` returns ok, Market.lua:191 sets `M.scanRequested = true`, and the addon prints "Scan läuft …". The "Scan fertig!" message (Market.lua:163-166) then fires on the next unrelated price update.
   - **Fix:**
     - Before calling `InitiateScan`, check `frame.CanInitiate and not frame:CanInitiate()` (full scan) or `frame.doingFullScan` (incremental). If either says no, don't set `scanRequested`.
     - Wrap every internal access in `type(...)=="function"` checks.
     - Keep the fallback message from Market.lua:194.
     - Auctionator v342 has no public API to start a scan; see §4.

2. **Deals.lua:60-68: `ItemSearchResultInfo.buyoutAmount` is the price of the whole auction, not a unit price.**
   - The docs define `buyoutAmount` as a field of the auction (`DOC/AuctionHouseDocumentation.lua:1682`), next to `quantity` (`:1674`). Blizzard shows it as the auction's total price (`SRC/Blizzard_AuctionHouseUI/Shared/Blizzard_AuctionHouseTableBuilder.lua:306-309`) and buys the whole auction with it (`Shared/Blizzard_AuctionHouseItemBuyFrame.lua:121`).
   - The addon stores `price = r.buyoutAmount, qty = r.quantity`. Deals.lua:30-33 then computes `cost = price*qty` and compares `price` against a per-unit reference.
   - Result: auctions with more than one item are compared at the wrong price, and both cost and savings are wrong.
   - **Fix:** `price = math.floor(r.buyoutAmount / math.max(r.quantity or 1, 1))`.

3. **Extras.lua:104-116 and Autopilot.lua:17-34: auto-repair and auto-junk spend gold or sell items on `MERCHANT_SHOW`, with no click, and both are on by default.**
   - Defaults are at Core.lua:90 (`autoJunk`) and Core.lua:95 (`autoRepair`).
   - **Restriction status:**
     - `C_MerchantFrame.SellAllJunkItems` has no `HasRestrictions` or `IsProtectedFunction` flag (`DOC/MerchantFrameDocumentation.lua:86-88`).
     - `RepairAllItems`, `GetRepairAllCost` and `CanMerchantRepair` are not in the generated docs at all, so they carry no flags either.
     - No hardware-event requirement is documented for any of them, so the calls are probably allowed. I found no evidence either way.
   - **What Blizzard does:**
     - It calls `SellAllJunkItems` only from a confirmation-popup callback after a button click (`SRC/Blizzard_UIPanels_Game/Mainline/MerchantFrame.lua:1124-1133`, `MerchantFrame.xml:227`).
     - It shows that button only when `C_MerchantFrame.IsSellAllJunkEnabled()` is true (MerchantFrame.lua:482; doc `MerchantFrameDocumentation.lua:77`).
     - It calls `RepairAllItems()` only from `OnClick` (`MerchantFrame.xml:268`; `RepairAllItems(true)` at `:383` is the guild-bank repair).
   - **Problems:**
     - The addon never checks `IsSellAllJunkEnabled`.
     - Spending gold without a click contradicts the addon's own promise in Autopilot.lua:3 ("Alles, was Gold ausgibt … NUR nach deinem Klick").
     - MerchantHelper.lua:95 says "wird automatisch verkauft" even when the feature is unavailable.
   - **Fix:**
     - Add `if C_MerchantFrame.IsSellAllJunkEnabled and not C_MerchantFrame.IsSellAllJunkEnabled() then return end` before Autopilot.lua:20.
     - Change the default to `autoRepair = false`, or turn it into a panel button.
     - Wrap both calls in `pcall`.
     - Make the MerchantHelper text reflect `IsSellAllJunkEnabled()`.

4. **Inventory.lua:33: `BANK = { -2, 6..14 }` reads the wrong container.**
   - In this client, `-2` is `Enum.BagIndex.Characterbanktab` (`DOC/BagIndexConstantsDocumentation.lua`, `Characterbanktab = -2`, `CharacterBankTab_1..9 = 6..14`).
   - Camelot uses `(Characterbanktab, bagSlotID)` to address the bank **bag slots** themselves (`SRC/Blizzard_UIPanels_Game/Camelot/BankFrame.lua:186,323`), not stored items. The addon therefore counts the bank bags as stock.
   - **Fix:** `BANK = {6,7,8,9,10,11,12,13,14}`. Better: take the tab IDs from `C_Bank.FetchPurchasedBankTabData(Enum.BankType.Character)`, as Camelot BankFrame.lua:91-98 does.

5. **Scanner.lua:172-181 and UI/PageRecipes.lua:295-300: `C_TradeSkillUI.GetAllRecipeIDs` does not exist in this build.**
   - It is not in `DOC/TradeSkillUIDocumentation.lua` and no FrameXML file uses it. The call is guarded, so the addon always falls back to `GetFilteredRecipeIDs`.
   - `GetFilteredRecipeIDs` is undocumented but used by FrameXML (`SRC/Blizzard_ProfessionsTemplates/Blizzard_Professions.lua:847`). It honours the Professions window's search box and filters, and Camelot forces "show unlearned" off (`Camelot/Blizzard_Professions.lua:19,23-25`).
   - Result: the recipe scan and the second pass of `ResolveLive` depend on whatever filter or search the player has active.
   - **Fix:**
     - Remove the dead `GetAllRecipeIDs` branch, or keep it as documentation only.
     - For the fallback, loop over your own `ns.Recipes` spell IDs: `C_TradeSkillUI.GetRecipeInfo(id)` plus `C_TradeSkillUI.IsRecipeInSkillLine(id, skillLineID)` (`DOC/TradeSkillUIDocumentation.lua:1001`).
     - Alternatively, tell the user to clear the search box.

6. **Autopilot.lua:84-110 (`BuyFlips`): wrong purchase quantity, and no stack splitting.**
   - `BuyMerchantItem(index, n)` takes `n` in items. Blizzard computes it in items in `MerchantItemButton_BuyMultipleStacks` (`MerchantFrame.lua:713-720`, `canAfford = floor(GetMoney()/(price/stackCount))`) and splits purchases by `GetMerchantItemMaxStack` (MerchantFrame.lua:714 and 1207).
   - `numAvailable` counts merchant entries, and Shopping.lua:141 already treats it that way (`avail * stack`). Autopilot instead passes `f.available` directly as an item count and never splits by max stack.
   - **Fix:**
     - Set `qty = f.available * f.stack`, and compute cost as `unit * qty`.
     - Buy in chunks of `GetMerchantItemMaxStack(index)`, exactly like Shopping.lua:164-171.

7. **Core.lua:38: `ns.On` ignores the boolean that `RegisterEvent` returns.**
   - `Frame:RegisterEvent` returns `registered: bool` (`DOC/SimpleFrameAPIDocumentation.lua:1019-1031`). If it returns `false` without raising an error, the listener stays in the list but never fires.
   - **Fix:** `local ok, reg = pcall(...); if not ok or reg == false then listeners[event] = nil return false end`.

8. **UI/PageRecipes.lua:401: `C_TradeSkillUI.OpenTradeSkill` returns `opened: bool` (`DOC/TradeSkillUIDocumentation.lua:1098-1110`), and the addon ignores it.**
   - The chat says "Berufsfenster … geöffnet" even when nothing opened.
   - **Fix:** `local ok, opened = pcall(...)`, then use `ok and opened`.

9. **Wrong shopping-list name in the success messages (UX).**
   - The lists are created as `"Zentrale: …"`, but the chat tells the user to look for `"Tiry's Zentrale: …"`.
   - Affected lines: UI/PageRecipes.lua:272/273, UI/PageDatabase.lua:108/110, UI/PageFarm.lua:54/55, UI/PageMethods.lua:226/228, UI/PageScanner.lua:101/103.
   - **Fix:** print the same `name` variable that was passed to `M.CreateShoppingList`.

10. **Market.lua:157-171: the "Scan vor …" label actually shows the time of the last AH search.**
    - `RegisterForDBUpdate` fires on every `IncrementalScan.Events.PricesProcessed`. Auctionator fires that after **every** browse result is processed, not only after full scans (`AUC/Source_ModernAH/IncrementalScan/Mixins/Frame.lua:130-151`; registration at `AUC/Source_ModernAH/API/v1/RegisterForDBUpdate.lua:11-18`).
    - So `ns.db.lastScan` holds "last AH search", and the "Scan vor …" texts at Market.lua:199-208 and PageHome.lua:246-249 overstate how fresh the data is.
    - **Fix:** only stamp `lastScan` when `M.scanRequested` is set, or relabel it as "Preisdaten zuletzt aktualisiert".

11. **Core.lua:191-198: `C_SkillInfo.ExpandSkillHeader` changes the player's Skills-UI collapse state as a side effect.**
    - **Fix:** loop over `ns.PROF` and call `C_SkillInfo.GetSkillLineInfoByID(id)` (`DOC/SkillInfoDocumentation.lua:74-87`, returns `SkillLineAttributes` or nil). No expanding needed. Check in game that `rank > 0` for unlearned skills.

12. **Maps.lua:44: `C_Map.SetUserWaypoint` returns `wasSet: bool` (`DOC/MapDocumentation.lua:599-612`), and the addon ignores it.**
    - **Fix:** `if not C_Map.SetUserWaypoint(...) then error("map") end`.

13. **TirysZentrale.toc:8-9: the localized `## Category-enUS` / `## Category-deDE` fields may not be read.**
    - The only Blizzard reader is `C_AddOns.GetAddOnMetadata(i, "Category")` (`SRC/Blizzard_AddOnList/AddonList.lua:456`). The UI source shows no locale-suffix resolution; Auctionator v342 uses the same `Category-xxXX` pattern (`AUC/Auctionator.toc`), so it may well work, but there is no proof.
    - **Fix:** add a plain `## Category: Auctions` line as a fallback. It does no harm.

14. **Scanner.lua:258-265: `S.openProf` is only captured on `TRADE_SKILL_SHOW`.** Blizzard reacts to `TRADE_SKILL_DATA_SOURCE_CHANGED` as well (`SRC/Blizzard_Professions/Blizzard_ProfessionsCrafting.lua:58,304`).
    - **Fix:** re-read `C_TradeSkillUI.GetBaseProfessionInfo().professionName` inside `rescan()` too (Scanner.lua:252).

---

## 1–2. Every API the addon uses (status, evidence, call sites)

**Status legend**
- **OK**: exists and is called correctly.
- **OK\***: exists; there is a usage note.
- **NO EVIDENCE**: not found in this client's source.
- **USAGE**: exists, but the semantics are used wrongly.
- **INTERNAL**: exists in Auctionator v342 but is not public API.

### 1a. Global functions (engine and FrameXML)

| API | Addon file:line | Status | Evidence | Note |
|---|---|---|---|---|
| GetMoney | Tracker.lua:16,31,42,62; Autopilot.lua:22,26,105; Extras.lua:109; Shopping.lua:133; Inventory.lua:38,97; Deals.lua:82,87; UI/MerchantHelper.lua:97; UI/PageHome.lua:176 | OK | DOC/PlayerScriptDocumentation.lua:642 | |
| BuyMerchantItem(index, qty) | Autopilot.lua:107; Shopping.lua:169 | OK\* | Not in the docs. Used in SRC/Blizzard_UIPanels_Game/Mainline/MerchantFrame.lua:648,665,704,797,844,852 | No restriction flag; Blizzard calls it from clicks. The addon also calls it only from clicks (MerchantHelper.lua:47,67; ShopWindow.lua:60). `qty` is an item count, see Must-fix 6. |
| GetMerchantItemMaxStack | Shopping.lua:165 | OK | MerchantFrame.lua:714,1207 | |
| GetMerchantNumItems | Scanner.lua:31-32; Autopilot.lua:89; Shopping.lua:128,134 | OK | MerchantFrame.lua:253,278 | |
| GetMerchantItemID | Scanner.lua:31,34; Autopilot.lua:90; Shopping.lua:128,135 | OK | MerchantFrame.lua:359 | |
| GetMerchantItemInfo | Scanner.lua:20-21 (fallback only) | NO EVIDENCE for Camelot | Only in SRC/Blizzard_UIPanels_Game/Vanilla/MerchantFrame.lua:200 | Never reached, because `C_MerchantFrame.GetItemInfo` exists. Harmless. |
| CanMerchantRepair | Extras.lua:106 | OK | MerchantFrame.lua:988 | |
| GetRepairAllCost → cost, canRepair | Extras.lua:106-107 | OK | MerchantFrame.xml:255 (`local repairAllCost, canRepair = GetRepairAllCost()`) | Return positions are used correctly. |
| RepairAllItems() | Extras.lua:110 | OK\* | MerchantFrame.xml:268 (`RepairAllItems()`), :383 (`RepairAllItems(true)` = guild) | Called on MERCHANT_SHOW with no click, see Must-fix 3. Undocumented, so no flags. |
| GetInboxNumItems | Shopping.lua:190,193; Ledger.lua:57,61; Inventory.lua:48,51; Deals.lua:98,100 | OK | SRC/Blizzard_MailFrame/MailFrame.lua:317 | |
| GetInboxHeaderInfo | Ledger.lua:62 (`_,_,sender,subject,money,_,daysLeft,itemCount`); Deals.lua:101 | OK | MailFrame.lua:340: `packageIcon, stationeryIcon, sender, subject, money, CODAmount, daysLeft, itemCount, …` | Positions 3/4/5/7/8 are correct. |
| GetInboxInvoiceInfo | Ledger.lua:66 (`invoiceType,itemName,player,bid,…,count` in slot 11) | OK | MailFrame.lua:790: `invoiceType, itemName, playerName, bid, buyout, deposit, consignment, moneyDelay, etaHour, etaMin, count, commerceAuction` | Positions are correct. Blizzard also has a `"seller_temp_invoice"` type (MailFrame.lua:577), which the addon ignores; that is correct. |
| GetInboxItem(i, slot) → name, id, _, count | Shopping.lua:196; Inventory.lua:53 | OK | MailFrame.lua:712: `name, id, itemTexture, count, …` | |
| PlaySound(soundKitID) | Autopilot.lua:166; Deals.lua:44; UI/Main.lua:286,292; UI/Widgets.lua:300 | OK | DOC/SoundDocumentation.lua:52 (C_Sound.PlaySound); global used at MerchantFrame.lua:160 | |
| GetMoneyString(money, separateThousands) | Core.lua:316-317 | OK | SRC/Blizzard_SharedXML/FormattingUtil.lua:72 | |
| GetLocale | Market.lua:99 | OK | DOC/LocaleDocumentation.lua:49 | |
| GetRealmName | Inventory.lua:9 | OK | DOC/ConnectionDocumentation.lua:69 | |
| UnitName | Core.lua:153; Scanner.lua:67; Inventory.lua:12 | OK | DOC/UnitDocumentation.lua:2489 | |
| UnitLevel | Core.lua:154,169 | OK | DOC/UnitDocumentation.lua:2474 | |
| UnitClass → className, classFilename | Core.lua:156 (uses return #2) | OK | DOC/UnitDocumentation.lua:911 | |
| UnitFactionGroup → factionGroupTag | Core.lua:155 | OK | DOC/UnitDocumentation.lua:1207 | |
| InCombatLockdown | Extras.lua:93 | OK | DOC/RestrictedActionsDocumentation.lua:45 (`Namespace = ""`, so it is global) | |
| GetCursorPosition | UI/Widgets.lua:510,514; UI/Main.lua:457 | OK | DOC/InputDocumentation.lua:30 | |
| GetTime | Shopping.lua:158,161 | OK | DOC/SystemTimeDocumentation.lua:57 | |
| IsShiftKeyDown | UI/ItemList.lua:100; UI/PageFarm.lua:96; UI/ShopWindow.lua:119,151 | OK | DOC/InputDocumentation.lua:236 | |
| HandleModifiedItemClick(link) | Core.lua:349 | OK | SRC/Blizzard_ItemButton/Mainline/ItemButtonTemplate.lua:372 | |
| GetProfessions / GetProfessionInfo | Core.lua:205-208 (fallback only) | OK | SRC/Blizzard_ProfessionsBook/Camelot/Blizzard_ProfessionsBook.lua:55; Blizzard_ProfessionsBook.lua:52 | Return #7 = skillLine is correct. |
| GetItemInfo (global) | Core.lua:245 (fallback after C_Item) | NO EVIDENCE | Only `C_Item.GetItemInfo` is documented (DOC/ItemDocumentation.lua:626) | Never reached. |
| GetItemIcon (global) | Core.lua:246 (fallback) | NO EVIDENCE | Only C_Item variants | Never reached. |
| ChatEdit_InsertLink | Core.lua:352 (fallback) | OK | SRC/Blizzard_DeprecatedChatInfo/Deprecated_ChatFrame.lua:43 (shim) | |
| OpenWorldMap(mapID) | Maps.lua:50 | OK | SRC/Blizzard_WorldMap/Blizzard_WorldMap.lua:1413 | The FrameXML wrapper, not the restricted `C_Map.OpenWorldMap` (DOC/MapDocumentation.lua:580 `HasRestrictions`). It returns early under `GameRule.WorldMapDisabled`. |
| CreateFrame | everywhere | OK | e.g. SRC/Blizzard_SharedXMLBase/GlobalCallbackRegistry.lua:9 | |
| CreateColor | UI/Widgets.lua:204; UI/Main.lua:82,248 | OK | SRC/Blizzard_SharedXMLBase/Color.lua:3 | |
| geterrorhandler / strtrim / wipe / tinsert | Core.lua:16; UI/Main.lua:494; Scanner.lua:29,106; UI/PageRecipes.lua:357; UI/Main.lua:273; UI/ShopWindow.lua:86 | OK | RestrictedFrames.lua:697; RestrictedEnvironment.lua:52; SecureAuraHeader.lua:179; ChatConfigFrame.lua:2079 | Engine globals. |

### 1b. Namespaced (`C_*` and helper tables)

| API | Addon file:line | Status | Evidence | Note |
|---|---|---|---|---|
| C_AddOns.GetAddOnMetadata(name, field) | Core.lua:6 | OK | DOC/AddOnsDocumentation.lua:165 | |
| C_AuctionHouse.GetNumCommoditySearchResults(itemID) | Deals.lua:51,53 | OK | DOC/AuctionHouseDocumentation.lua:504 | |
| C_AuctionHouse.GetCommoditySearchResultInfo(itemID, idx) | Deals.lua:54 | OK | :240. Fields `unitPrice` :1626, `quantity` :1625, `containsOwnerItem` :1632 | |
| C_AuctionHouse.GetNumItemSearchResults(itemKey) | Deals.lua:61,63 | OK | :519 | |
| C_AuctionHouse.GetItemSearchResultInfo(itemKey, idx) | Deals.lua:64 | **USAGE** | :374. `buyoutAmount` :1682 is the total for the auction | See Must-fix 2. |
| C_Container.GetContainerNumSlots(bag) | Scanner.lua:112; Autopilot.lua:50,123; Inventory.lua:24 | OK | DOC/ContainerDocumentation.lua:313 | |
| C_Container.GetContainerItemInfo(bag, slot) | Scanner.lua:114; Autopilot.lua:51,124; Inventory.lua:25 | OK | :192. Fields used (`itemID, stackCount, quality, isBound, hasNoValue, hyperlink, isLocked`) all exist at :770-781 | |
| C_Container.UseContainerItem(bag, slot) | Autopilot.lua:75 | OK | :584 (`containerIndex, slotIndex, unitToken?, bankType?, reagentBankOpen=false`) | No restriction flag. Called only from a click (UI/MerchantHelper.lua:31-32) and only while `merchant.open`. |
| C_Item.GetItemInfo | Core.lua:245,253 | OK | DOC/ItemDocumentation.lua:626 | Returns 1/2/3/8/10/11 = name/link/quality/stack/texture/sellPrice, used correctly. |
| C_Item.GetItemIconByID | Core.lua:246,261 | OK | :611 | |
| C_Item.RequestLoadItemDataByID | Core.lua:247,267 | OK | :1710 | |
| C_Item.GetItemCount(item, includeBank) | Shopping.lua:20,94; Inventory.lua:80; UI/PageRecipes.lua:28 | OK | :451 | |
| C_Map.CanSetUserWaypointOnMap | Maps.lua:43 | OK | DOC/MapDocumentation.lua:11 | |
| C_Map.SetUserWaypoint(point) | Maps.lua:44 | OK\* | :599 (returns `wasSet`) | Return value ignored, see Must-fix 12. |
| C_Map.ClearUserWaypoint | Maps.lua:77 | OK | :26 | |
| C_Map.HasUserWaypoint | Maps.lua:70 | OK | :524 | |
| C_Map.GetMapInfo | Maps.lua:30 | OK | :312 | |
| C_Map.GetBestMapForUnit("player") | Skinning.lua:96 | OK | :49 | |
| C_Map.GetPlayerMapPosition(uiMapID, unit) | Skinning.lua:97 | OK | :437 (returns a vector2 with `GetXY`) | Argument order is correct. |
| C_SuperTrack.SetSuperTrackedUserWaypoint(bool) | Maps.lua:46 | OK | DOC/SuperTrackManagerDocumentation.lua:169; same pattern at SRC/Blizzard_UIPanels_Game/Mainline/QuestMapFrame.lua:2449 | The arrow frame `Blizzard_QuestNavigation/SuperTrackedFrame.xml` has no game-type restriction. |
| UiMapPoint.CreateFromCoordinates(map, x, y) | Maps.lua:44 | OK | SRC/Blizzard_ObjectAPI/Mainline/UiMapPoint.lua:3 (toc `[Family]\UiMapPoint.lua [AllowLoadGameType mainline]`) | |
| C_MerchantFrame.GetItemInfo(index) | Scanner.lua:15; Shopping.lua:119 | OK | DOC/MerchantFrameDocumentation.lua:27. Struct :126-141 (`price, stackCount, numAvailable, hasExtendedCost, name`) | `stackCount` defaults to 0; the addon clamps it with `math.max(…,1)`. Auctionator also uses -1 for unlimited stock (AUC/Source/CraftingInfo/Main.lua:17). |
| C_MerchantFrame.GetNumJunkItems | Autopilot.lua:20 | OK | :53 | |
| C_MerchantFrame.SellAllJunkItems | Autopilot.lua:23 | OK\* | :86 (no flags) | Called on MERCHANT_SHOW with no click; `IsSellAllJunkEnabled` (:77) is not checked. See Must-fix 3. |
| C_SkillInfo.GetNumSkillLines | Core.lua:192,199 | OK | DOC/SkillInfoDocumentation.lua:41 | |
| C_SkillInfo.GetSkillLineInfo(i) | Core.lua:193,200 | OK | :59. Struct :113-133 (`skillID, name, isHeader, isCollapsed, rank, maxRank`) | |
| C_SkillInfo.ExpandSkillHeader(i) | Core.lua:195 | OK\* | :31 | Side effect, see Must-fix 11. |
| C_SpellBook.IsSpellKnown(spellID) | Recipes.lua:66 | OK | DOC/SpellBookDocumentation.lua:738 (spellBank defaults to "Player") | No evidence that it returns true for tradeskill recipe spells. The addon falls back to the scan (Recipes.lua:69-70), which is good. |
| C_Texture.GetAtlasInfo | UI/Main.lua:161 | OK | DOC/TextureUtilsDocumentation.lua:75 | |
| C_Timer.After | 14 call sites (Core.lua:76,237; Autopilot.lua:24,178,210; …) | OK | DOC/UITimerDocumentation.lua:11 | |
| C_TradeSkillUI.GetRecipeSchematic(recipeSpellID, isRecraft) | Recipes.lua:51; Scanner.lua:196; UI/PageRecipes.lua:303 | OK | DOC/TradeSkillUIDocumentation.lua:753 (`recipeSpellID, isRecraft, recipeLevel?`) | Always called as `(id, false)`. Struct fields `outputItemID, reagentSlotSchematics, quantityMin/Max` are at TradeSkillUITypesDocumentation.lua:285-294. Slot fields `reagentType, reagents[].itemID, quantityRequired` are at :213-219 and :243-250. |
| C_TradeSkillUI.GetRecipeInfo(recipeSpellID) | Scanner.lua:194; UI/PageRecipes.lua:308; Recipes.lua:131 (existence check) | OK | :639. Fields `learned, isRecraft, relativeDifficulty, canSkillUp, name` at TradeSkillUITypesDocumentation.lua:386-428 | |
| C_TradeSkillUI.GetBaseProfessionInfo | Scanner.lua:187,261 | OK | :130. `professionName/skillLevel/maxSkillLevel` at TradeSkillUITypesDocumentation.lua:368-371 | |
| C_TradeSkillUI.GetAllRecipeIDs | Scanner.lua:174-175; UI/PageRecipes.lua:297 | **NO EVIDENCE** | Not in DOC, not in FrameXML | Guarded. See Must-fix 5. |
| C_TradeSkillUI.GetFilteredRecipeIDs | Scanner.lua:177-178; UI/PageRecipes.lua:298 | OK\* (undocumented) | SRC/Blizzard_ProfessionsTemplates/Blizzard_Professions.lua:847 | Depends on the window's filters. |
| C_TradeSkillUI.OpenTradeSkill(skillLineID) → opened | UI/PageRecipes.lua:401 | OK\* | :1098; SRC/Blizzard_FrameXMLUtil/ProfessionsUtil.lua:101 | Return value ignored, see Must-fix 8. Called only from a click. |
| C_TradeSkillUI.OpenRecipe(recipeID) | UI/PageRecipes.lua:422 | OK | :1088 | |
| C_TradeSkillUI.CraftRecipe(recipeSpellID, numCasts, craftingReagents?, recipeLevel?, orderID?, applyConcentration?) | UI/PageRecipes.lua:424 `CraftRecipe(liveID, n, {}, nil, nil, false)` | OK | :76-89. Blizzard calls it the same way: SRC/Blizzard_ProfessionsTemplates/Blizzard_ProfessionsTransaction.lua:352-356 | Argument order matches. Flag is only `SecretArguments=AllowedWhenUntainted`, with no `HasRestrictions`. Called only from clicks (UI/PageRecipes.lua:276 and UI/ShopWindow.lua:83). |
| TooltipDataProcessor.AddTooltipPostCall | Extras.lua:89-90 | OK | SRC/Blizzard_SharedXMLGame/Tooltip/TooltipDataHandler.lua:199. `data.id` is used at TooltipUtil.lua:28 | Same pattern as Blizzard_PTRFeedback_Tooltips.lua:87-92. |
| ChatFrameUtil.InsertLink | Core.lua:350-351 | OK | SRC/Blizzard_ChatFrameBase/Mainline/ChatFrameUtilOverrides.lua:14 | |

### 1c. Enums, FrameXML globals, constants, atlases, widget methods

| Item | Addon file:line | Status | Evidence | Note |
|---|---|---|---|---|
| Enum.CraftingReagentType.Basic (=1) | Scanner.lua:170 | OK | DOC/ProfessionConstantsDocumentation.lua:203 | |
| Enum.TooltipDataType.Item (=0) | Extras.lua:89-90 | OK | DOC/TooltipInfoSharedDocumentation.lua:96 | |
| UISpecialFrames | UI/Main.lua:273; UI/ShopWindow.lua:86 | OK | SRC/Blizzard_UIParentPanelManager/Shared/UIParentPanelManager.lua:21 | |
| GameTooltip / ItemRefTooltip | Extras.lua:92; many UI files | OK | SRC/Blizzard_GameTooltip/Mainline/GameTooltip.xml:249; SRC/Blizzard_UIPanels_Game/Mainline/ItemRef.xml:5 | |
| GameTooltip:SetItemByID | UI/ItemList.lua:83; UI/PageFarm.lua:92; UI/ShopWindow.lua:115,147 | OK | SRC/Blizzard_SharedXMLGame/Tooltip/TooltipDataHandler.lua:525 | Wrapped in pcall. |
| MerchantFrame | UI/MerchantHelper.lua:108-109 | OK | SRC/Blizzard_UIPanels_Game/Mainline/MerchantFrame.xml:94 | |
| Minimap | UI/Main.lua:411-458 | OK | SRC/Blizzard_Minimap/Mainline/Minimap.xml:56 (toc `[Family]\Minimap.xml`) | |
| UIParent, DEFAULT_CHAT_FRAME, SlashCmdList | UI/Main.lua:252; Core.lua:339; UI/Main.lua:493 | OK | ChatFrameUtil.lua:19; ClassTalentHelper.lua:57 | |
| GameFontNormal, STANDARD_TEXT_FONT | UI/Widgets.lua:104-105,697,748; UI/PageRecipes.lua:192 | OK | SRC/Blizzard_Fonts_Shared/Shared/FontStyles.xml:50; GameFonts.xml:5 | |
| ATTACHMENTS_MAX_RECEIVE | Shopping.lua:195; Inventory.lua:52 | OK | SRC/Blizzard_MailFrame/MailFrame.lua:7 (=16; the addon also falls back to 16) | |
| NUM_TOTAL_EQUIPPED_BAG_SLOTS / NUM_BAG_SLOTS | Scanner.lua:102; Autopilot.lua:42 | OK | SRC/Blizzard_FrameXMLBase/Constants.lua:168-170 | Gives bags 0..5 (5 = ReagentBag). Correct. |
| AUCTION_EXPIRED_MAIL_SUBJECT | Ledger.lua:48 | NO EVIDENCE | GlobalStrings are not part of the repo | Has a German/English fallback at Ledger.lua:53, so it is safe. |
| SOUNDKIT.AUCTION_WINDOW_OPEN / IG_BACKPACK_COIN_SELECT / IG_MAINMENU_OPEN / IG_MAINMENU_CLOSE / U_CHAT_SCROLL_BUTTON | Deals.lua:44; Autopilot.lua:166; UI/Main.lua:286,292; UI/Widgets.lua:299-300 | OK (5) | SRC/Blizzard_SharedXML/Mainline/SoundKitConstants.lua:76,54,42,43,68 (toc `[Family]\SoundKitConstants.lua`) | |
| Atlas `charactercreate-icon-horde` | UI/Main.lua:161,164 | OK | See §3 | Guarded by GetAtlasInfo. |
| Atlas `coin-gold/-silver/-copper` (inline `|A:`) | Core.lua:289 | OK | SRC/Blizzard_MoneyFrame/Shared/MoneyFrame.lua:348-350 | |
| Atlas `common-icon-checkmark` | UI/ShopWindow.lua:251 | OK | SRC/Blizzard_UIPanels_Game/Mainline/DressUpFrames.lua:678 | |
| Frame:RegisterEvent → registered | Core.lua:38 | OK\* | DOC/SimpleFrameAPIDocumentation.lua:1019 | Return value ignored, see Must-fix 7. |
| Texture:SetGradient(orient, colorMin, colorMax) | UI/Widgets.lua:203; UI/Main.lua:82,248 | OK | DOC/SimpleTextureBaseAPIDocumentation.lua:439 | |
| FontString:GetUnboundedStringWidth | UI/Widgets.lua:133,139 | OK | DOC/SimpleFontStringAPIDocumentation.lua:398 | |
| Frame:SetClipsChildren / CreateMaskTexture | UI/Widgets.lua:55,429; UI/Main.lua:41 | OK | DOC/SimpleFrameAPIDocumentation.lua:1218, :113 | |
| Texture:SetRotation / SetAtlas / SetDesaturated | UI/PageMethods.lua:130; UI/Main.lua:164,167 | OK | DOC/SimpleTextureBaseAPIDocumentation.lua:527, :368, :417 | |

### 1d. Events (28 registered via `ns.On`, Core.lua:34-46). Handlers receive `(event, ...payload)`.

| Event | Addon file:line | Status | Doc file:line | Payload (doc) | Handler correct? |
|---|---|---|---|---|---|
| ADDON_LOADED | Core.lua:128 | OK | AddOnsDocumentation.lua:391 | addOnName, containsBindings | yes (`_, name`) |
| PLAYER_LOGIN | Core.lua:140 | OK | SystemDocumentation.lua:153 | – | yes |
| PLAYER_LEVEL_UP | Core.lua:168 | OK | UnitDocumentation.lua:3832 | level, … | yes (`_, level`) |
| SKILL_LINES_CHANGED | Core.lua:233 | OK | SkillInfoDocumentation.lua:105 | – | yes |
| GET_ITEM_INFO_RECEIVED | Core.lua:280 | OK | ItemDocumentation.lua:1815 | itemID, success | yes |
| ITEM_DATA_LOAD_RESULT | Core.lua:281 | OK | ItemDocumentation.lua:1857 | itemID, success | yes |
| AUCTION_HOUSE_SHOW | Market.lua:147; Autopilot.lua:195,208 | OK | AuctionHouseDocumentation.lua:1237 | – | yes |
| AUCTION_HOUSE_CLOSED | Market.lua:151; Autopilot.lua:196 | OK | AuctionHouseDocumentation.lua:1159 | – | yes |
| COMMODITY_PURCHASED | Shopping.lua:180 | OK | AuctionHouseDocumentation.lua:1388 | itemID, quantity | yes |
| COMMODITY_SEARCH_RESULTS_UPDATED | Deals.lua:50 | OK | AuctionHouseDocumentation.lua:1415 (UniqueEvent) | itemID | yes |
| ITEM_SEARCH_RESULTS_UPDATED | Deals.lua:60 | OK | AuctionHouseDocumentation.lua:1465 (UniqueEvent) | itemKey, newAuctionID? | yes (price math wrong, Must-fix 2) |
| MERCHANT_SHOW | Scanner.lua:65; Autopilot.lua:17,187; Extras.lua:104 | OK | MerchantFrameDocumentation.lua:112 | – | yes |
| MERCHANT_UPDATE | Scanner.lua:82 | OK | MerchantFrameDocumentation.lua:118 | – | yes |
| MERCHANT_CLOSED | Scanner.lua:91; Autopilot.lua:188 | OK | MerchantFrameDocumentation.lua:96 | – | yes |
| BAG_UPDATE_DELAYED | Scanner.lua:157; Autopilot.lua:175; Shopping.lua:207; Inventory.lua:62; UI/MerchantHelper.lua:122 | OK | ContainerDocumentation.lua:677 | – | yes |
| BANKFRAME_OPENED / BANKFRAME_CLOSED | Autopilot.lua:193-194; Inventory.lua:69-70 | OK | BankDocumentation.lua:398 / :392 | – | yes |
| MAIL_SHOW | Autopilot.lua:189; Shopping.lua:205; Ledger.lua:101; Deals.lua:81 | OK | MailInfoDocumentation.lua:139 | – | yes |
| MAIL_INBOX_UPDATE | Shopping.lua:206; Ledger.lua:100; Inventory.lua:71; Deals.lua:97 | OK | MailInfoDocumentation.lua:102 | – | yes |
| MAIL_CLOSED | Autopilot.lua:190; Deals.lua:85 | OK | MailInfoDocumentation.lua:86 | – | yes |
| TRADE_SHOW / TRADE_CLOSED | Autopilot.lua:191-192 | OK | TradeInfoDocumentation.lua:143 / :78 | – | yes |
| PLAYER_MONEY | Tracker.lua:40; Inventory.lua:68 | OK | CurrencyInfoDocumentation.lua:637 | – | yes |
| TRADE_SKILL_SHOW | Scanner.lua:258 | OK | TradeSkillUIDocumentation.lua:1387 | – | yes |
| TRADE_SKILL_CLOSE | Scanner.lua:266 | OK | TradeSkillUIDocumentation.lua:1290 | – | yes |
| TRADE_SKILL_LIST_UPDATE | Scanner.lua:270 | OK | TradeSkillUIDocumentation.lua:1375 | – | yes |
| TRADE_SKILL_DATA_SOURCE_CHANGED | Scanner.lua:271 | OK | TradeSkillUIDocumentation.lua:1326 | – | yes |
| NEW_RECIPE_LEARNED | Recipes.lua:118 | OK | TradeSkillUIDocumentation.lua:1239 | recipeID, recipeLevel?, baseRecipeID? | yes (`_, recipeID`) |

The addon does **not** use CHAT_MSG_LOOT. Loot is detected by diffing bag contents (Autopilot.lua:138-173).

### 1e. TOC fields

| Field | Status | Evidence | Note |
|---|---|---|---|
| `## Interface: 16001` | OK | Auctionator v342 declares `16001` (AUC/Auctionator.toc:1). Blizzard tocs use `0`, so the UI source has no direct proof. | |
| `## IconTexture` | OK | SRC/Blizzard_Minimap/Mainline/AddonCompartment.lua:111; SRC/Blizzard_AddOnList/AddonList.lua:390 | `Media/logo.tga` exists. |
| `## AddonCompartmentFunc` | OK | AddonCompartment.lua:106. Called as `_G[f](addonName, buttonName)` (lines 124,128); Camelot loads `[Family]\AddonCompartment.lua` (Blizzard_Minimap.toc:48-49) | `TirysZentrale_OnAddonCompartmentClick(_, button)` (UI/Main.lua:535) matches. |
| `## AddonCompartmentFuncOnEnter / OnLeave` | OK | AddonCompartment.lua:131-142 (called with `(addonName, btn)`) | UI/Main.lua:543,550 match. |
| `## Category-enUS / Category-deDE` | NO EVIDENCE of locale-suffix lookup | AddonList.lua:456 reads only `"Category"` | Must-fix 13. |
| `## SavedVariables / SavedVariablesPerCharacter / OptionalDeps / Notes-deDE / Version` | OK | standard | `OptionalDeps: Auctionator` makes Auctionator load first, so `RegisterForDBUpdate` on LOGIN is safe. |

### 2. Protected or restricted functions, and whether a click is required

- **Restriction flags.** Of the functions this addon calls, none carries `HasRestrictions = true` or `IsProtectedFunction = true` in DOC. The full lists in DOC are 288 `HasRestrictions` and 74 `IsProtectedFunction` entries. The relevant restricted ones are `C_AuctionHouse.PlaceBid/PostItem/PostCommodity/StartCommoditiesPurchase/CancelAuction/Confirm*` (AuctionHouseDocumentation.lua:62-1081) and `C_Map.OpenWorldMap` (MapDocumentation.lua:580); the addon calls none of these.
- **Called only from a click (correct):**
  - `BuyMerchantItem`: UI/MerchantHelper.lua:47,67 and UI/ShopWindow.lua:60.
  - `C_Container.UseContainerItem`: UI/MerchantHelper.lua:31.
  - `C_TradeSkillUI.CraftRecipe`, `OpenTradeSkill`, `OpenRecipe`: UI/PageRecipes.lua:276 and UI/ShopWindow.lua:83.
  - Auctionator `MultiSearchExact`: UI/PageMarket.lua:88 and UI/ShopWindow.lua:68.
  - The Auctionator scan: UI/Main.lua:226 and the home-page row click.
- **Called without a click, on MERCHANT_SHOW:**
  - `C_MerchantFrame.SellAllJunkItems` (Autopilot.lua:23).
  - `RepairAllItems` (Extras.lua:110).
  - Blizzard calls both only after a user click or a confirmation popup (MerchantFrame.lua:1124-1133; MerchantFrame.xml:268). No hardware-event requirement is documented for either, so I expect them to work, but nothing in the source proves it.
  - See Must-fix 3 for the policy and gating fixes.
- **C_AuctionHouse.\*:** the addon only reads search results. It never buys, bids or posts.

---

## 3. Atlas `charactercreate-icon-horde`

- `SRC/Blizzard_CharacterCreate/Camelot/Blizzard_CharacterCreate.xml:420`: `<Texture parentKey="Logo" atlas="charactercreate-icon-horde" useAtlasSize="true">`. This is the Camelot faction header in character creation. The Alliance counterpart is at line 383.
- `SRC/Blizzard_CharacterCreate/Mainline/Blizzard_CharacterCreate.xml:391`: the same texture in Mainline.
- Related: `charactercreate-icon-hordebg` at `Camelot/Blizzard_CharacterCreate_Templates.lua:66,76`.
- These files load only in the Glue (login) environment (`## AllowLoad: Glue`). Atlases come from the client's atlas database, not from the addon that uses them, so in-game availability is probable but not proven by the source.
- The addon handles this safely: it calls `C_Texture.GetAtlasInfo` first (UI/Main.lua:160-171) and only creates the texture if info is returned.
- The crest is always the Horde one, regardless of the player's faction. That is a design choice, not an API issue.

---

## 4. Auctionator

### 4a. Every `Auctionator.*` access in the addon

| Addon file:line | Access | Class | Defined at (AUC) | Signature / note |
|---|---|---|---|---|
| Market.lua:8 | `Auctionator.API.v1` | public namespace | Source/Objects.lua:40-41 | |
| Market.lua:14,20-21 | `API.v1.GetAuctionPriceByItemID(ADDON, itemID)` | **public v1** | Source/API/v1/GetAuctionPrice.lua:1 | `(callerID:string, itemID:number) → copper|nil`. Called correctly. |
| Market.lua:29-30 | `API.v1.GetAuctionAgeByItemID(ADDON, itemID)` | **public v1** | Source/API/v1/GetAuctionAge.lua:4 | `→ days|nil` (nil when older than 21 days). Correct. |
| Market.lua:40-41 | `API.v1.GetVendorPriceByItemID(ADDON, itemID)` | **public v1** | Source/API/v1/GetVendorPrice.lua:1 | `→ copper|nil`. This is the per-unit price of unlimited merchant stock (Source/CraftingInfo/Main.lua:17-20). Correct. |
| Market.lua:106,114 | `API.v1.ConvertToSearchString(ADDON, {searchString=name, isExact=true})` | **public v1** | Source/API/v1/ShoppingLists.lua:22 | `(callerID, term:SearchTerm) → string`. Correct. |
| Market.lua:106,123 | `API.v1.CreateShoppingList(ADDON, listName, terms)` | **public v1** | Source/API/v1/ShoppingLists.lua:76 | `(callerID, name:string, searchStrings:string[])`. Replaces a list with the same name. Correct. |
| Market.lua:131,142 | `API.v1.MultiSearchExact(ADDON, names)` | **public v1** | Source/API/v1/MultiSearch.lua:56 | `(callerID, string[])`. Raises an error if the AH is closed (MultiSearch.lua:21-24); the addon pre-checks `M.ahOpen` and uses pcall. Correct. |
| Market.lua:159-160 | `API.v1.RegisterForDBUpdate(ADDON, fn)` | **public v1** | Source_ModernAH/API/v1/RegisterForDBUpdate.lua:1 (loaded for `mainline`, AUC/Auctionator.toc `Source_ModernAH\Manifest.xml [AllowLoadGameType cata, mists, mainline]`) | `(callerID, callback)`. Fires on IncrementalScan `PricesProcessed`, which happens after every browse, and on FullScan `ScanComplete`. See Must-fix 10. |
| Market.lua:183,187 | `Auctionator.State.FullScanFrameRef` / `.IncrementalScanFrameRef` | **INTERNAL** | Source_ModernAH/Core/Mixin.lua:13,37 | Created only once the AH frame is shown. |
| Market.lua:185-186 | `Auctionator.Config.Get(Auctionator.Config.Options.REPLICATE_SCAN)` | **INTERNAL** | Source/Config/Main.lua:219 and :12 (`"replicate_scan_3"`) | |
| Market.lua:188 | `frame:InitiateScan()` | **INTERNAL** | Source_ModernAH/FullScan/Mixins/Frame.lua:19; IncrementalScan/Mixins/Frame.lua:61 | Same logic as Auctionator's own button: Source_ModernAH/Tabs/Auctionator/Mixins/ScanButton.lua:3-9. |

**What breaks if Auctionator changes:**
- Renaming or restructuring `State.*ScanFrameRef`, the Config key (it already carries the version suffix `_3`) or `InitiateScan` makes `pcall` fail, and the user sees the manual-scan hint at Market.lua:194. That degradation is safe.
- The real bug is the silent refusal path: the 15-minute cooldown, or a scan already running. See Must-fix 1.

**Public alternatives in Auctionator v342:**
- **Start a full scan:** none. No v1 function triggers a scan.
- **Get notified of DB updates:** yes, `RegisterForDBUpdate`, already used.
- **Create shopping lists:** yes, `CreateShoppingList` and `ConvertToSearchString`, already used.
- **Search:** yes, `MultiSearch`, `MultiSearchExact` (used) and `MultiSearchAdvanced`.

### 4b. The complete Auctionator v342 public API v1

| Function | File:line | Signature |
|---|---|---|
| GetAuctionPriceByItemID | Source/API/v1/GetAuctionPrice.lua:1 | (callerID, itemID:number) → number? |
| GetAuctionPriceByItemLink | GetAuctionPrice.lua:18 | (callerID, itemLink:string) → number? |
| GetAuctionAgeByItemID | GetAuctionAge.lua:4 | (callerID, itemID) → days? (nil if >21 days or never seen) |
| GetAuctionAgeByItemLink | GetAuctionAge.lua:21 | (callerID, itemLink) → days? |
| IsAuctionDataExactByItemID | IsAuctionDataExact.lua:1 | (callerID, itemID) → bool? |
| IsAuctionDataExactByItemLink | IsAuctionDataExact.lua:18 | (callerID, itemLink) → bool |
| GetVendorPriceByItemID | GetVendorPrice.lua:1 | (callerID, itemID) → number? |
| GetVendorPriceByItemLink | GetVendorPrice.lua:14 | (callerID, itemLink) → number? |
| GetDisenchantPriceByItemID | GetDisenchantPrice.lua:1 | (callerID, itemID) → number? |
| GetDisenchantPriceByItemLink | GetDisenchantPrice.lua:21 | (callerID, itemLink) → number? |
| MultiSearch | MultiSearch.lua:51 | (callerID, searchTerms:string[]). AH must be open. |
| MultiSearchExact | MultiSearch.lua:56 | (callerID, searchTerms:string[]). AH must be open; terms are wrapped in `"…"`. |
| MultiSearchAdvanced | MultiSearch.lua:99 | (callerID, terms:SearchTerm[]) |
| ConvertToSearchString | ShoppingLists.lua:22 | (callerID, term:SearchTerm) → string |
| ConvertFromSearchString | ShoppingLists.lua:35 | (callerID, searchString) → SearchTerm |
| GetShoppingListItems | ShoppingLists.lua:48 | (callerID, listName) → string[] (raises an error if the list is missing) |
| CreateShoppingList | ShoppingLists.lua:76 | (callerID, name, searchStrings:string[]). Replaces an existing list. |
| DeleteShoppingListItem | ShoppingLists.lua:103 | (callerID, listName, itemSearchString) |
| AlterShoppingListItem | ShoppingLists.lua:133 | (callerID, listName, oldSearchString, newSearchString) |
| RegisterForDBUpdate | Source_ModernAH/API/v1/RegisterForDBUpdate.lua:1 (LegacyAH variant: Source_LegacyAH/API/v1/RegisterForDBUpdate.lua:1) | (callerID, callback). There is no unregister function. |
| (ShoppingListAPITests) | ShoppingLists.lua:165 | Internal self-test, not meant for callers. |

`SearchTerm` fields are listed at ShoppingLists.lua:1-16: `searchString, categoryKey, isExact, minLevel, maxLevel, minPrice, maxPrice, minItemLevel, maxItemLevel, minCraftedLevel, maxCraftedLevel, quality, tier, expansion, quantity`.

---

## 5. Lua 5.1 and defensive findings (beyond the Must-fix list)

- **No global leaks.** The only global writes are the intended ones.
- **Syntax.** Every file passes `luac5.1 -p`.
- **API-missing guards.** Every `C_*` access is behind an existence check, except where a caller already checked it. Specifically, `recipeIDs()` (Scanner.lua:172) and `liveIDs()` (UI/PageRecipes.lua:295) index `C_TradeSkillUI` directly, but they are only reached after a guarded check (Scanner.lua:184; UI/PageRecipes.lua:395 and :436). That is fine.
- **Event payloads.** All handlers match the documented payloads (§1d).
- **Ledger.lua:24-35 (locale).** It maps item names to IDs using the German DB names only, so on non-deDE clients the IDs stay nil and per-item sale rates disappear. Fall back to `C_Item.GetItemInfoInstant`, or skip silently.
- **Ledger.lua:63 (dedupe key).** The "arrived" hour is computed from the float `daysLeft`. A rounding drift across hour boundaries could double-count a mail in a later session. Consider adding `money` and `count` to the key and rounding to 6 hours.
- **Load hitches on first use.**
  - The first tooltip hover (Extras.lua:62,76), the first `ns.Item` call for an uncached item (Core.lua:258) and Ledger `IDByName` (Ledger.lua:28) each trigger `ns.DB.Load()`, which runs `gmatch` over a 1 MB string.
  - The first trigger happens about 8 seconds after login via `PS.RecordAll` (PriceString.lua:84).
  - It runs once, but it can cause a visible frame hitch.
- **Autopilot.lua:52-56.** `UseContainerItem` with class 15 (Miscellaneous) may include mount, pet or toy items. If it ever ran while the merchant window was not actually accepting sales, it would *use* the item. Today it only runs with `merchant.open` set. Consider also checking `MerchantFrame:IsShown()`.
- **Scanner.lua:17 / Shopping.lua:120.** `info.stackCount or 1` does not catch the documented default of `0`, but both places clamp with `math.max(…,1)` afterwards. Fine.
- **UI/Widgets.lua:822 (`UI.Pill`).** `SetScript("OnClick")` replaces the click handler set by `UI.Button`, including its `HookScript(playClick)` at :354. Pills then rely on the explicit `UI.PlayClick` call, and they have none. Cosmetic.
- **Extras.lua:93.** Skipping the tooltip in combat matches the 12.x secret-value rules, and the `pcall` around it is good.
- **Core.lua:23 (`ns.Safe`).** It forwards up to five return values, which is enough for all callers.

---

## Counts

158 APIs, events and fields checked:

| Status | Count | Details |
|---|---|---|
| OK | **147** | 12 of these are OK\*: they exist and are used correctly, with a usage note. |
| No evidence | **6** | `GetMerchantItemInfo`, global `GetItemInfo`, global `GetItemIcon`, `C_TradeSkillUI.GetAllRecipeIDs`, `AUCTION_EXPIRED_MAIL_SUBJECT`, `Category-xxXX` toc lookup. All six are guarded or have a fallback. |
| Signature differs | **0** | |
| Semantic misuse | **1** | `ItemSearchResultInfo.buyoutAmount` |
| Auctionator internals | **4** | Exist in v342 but are not public API. |
