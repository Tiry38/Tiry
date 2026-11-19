# TSM (TradeSkillMaster) on WoW Forever – support status and price sources (as of 2026-11-19)

Source-quality note: the only first-party sources found are TSM's own news post, TSM's CurseForge file pages, TSM's public-data page and TSM's support docs. Many "Forever addon wiki" sites (wowcalc.net, mmonster.co, foreverbase.org, botwowforever.com, wowforevertierlist.com) look like auto-generated aggregator pages; they contradict each other on version numbers and dates. Treat them as low-confidence, and older pages (before 2026-11-04) as outdated. No Reddit (r/woweconomy, r/classicwow) or TSM Discord material about Forever was found by search.

## 1. Is there an official TSM release for WoW Forever? (version, TOC, bugs)

### Takeaway
Yes. TSM 4.15 added official WoW Forever support for the 4 Nov 2026 launch. It ships as one multi-flavor package that includes Interface 1.60.1 (= 16001). The latest file found is v4.15.8 (18 Nov 2026), and v4.15.6 (10 Nov) contains Forever-specific fixes.

### Cited Findings
- TSM news, dated 1 Nov 2026: "TSM 4.15 brings WoW: Forever Support, plus New Desktop app". The 4.15 beta started 1 Nov, with the full release timed for the Forever launch on Nov 4. The post says 4.15 "does support WoW: Forever" from launch day. — [TSM News](https://tradeskillmaster.com/news/tsm-4-15-brings-wow-forever-support-plus-new-desktop-app-1180)
- New price sources in 4.15: **DBNumAuctions** (number of auctions, not number of items, at the last snapshot) and an "alternative market" set: **DBAltMarket, DBAltRecent, DBAltHistorical, DBAltMinBuyout, DBAltNumAuctions**. The alt-market sources need an alt realm added in the Desktop App and then chosen in addon settings. — [TSM News](https://tradeskillmaster.com/news/tsm-4-15-brings-wow-forever-support-plus-new-desktop-app-1180)
- 4.15 also brought a rebuilt TSM Desktop App (Windows/Mac/Linux) with guided setup, Discord login, auto-updates, automatic backups and a migration wizard. Fixes listed in the post: duplicate vendor ledger entries, Account Syncing setup, errors when buying from Shopping scans, and slow large Browse scans. The post lists no known issues. — [TSM News](https://tradeskillmaster.com/news/tsm-4-15-brings-wow-forever-support-plus-new-desktop-app-1180)
- CurseForge v4.15.6 (uploaded 10 Nov 2026) lists the flavors MoP Classic, Classic TBC, Classic, Retail and **Forever**, and the game versions 12.1.5, 5.5.4, 2.5.6, **1.60.1**, 1.15.9. Its changelog includes: "[Forever] Fixed disenchant values for green weapons ilvl 21-30 and blue items below ilvl 20"; "[Forever] Updated bonus ID data for the latest game builds"; "[Classic/Forever] Fixed Greater Nether Essence disenchant rate for ilvl 46-50 green armor"; "[All] importing groups sent from the TSM website through the desktop app"; "[All] fixed group import not creating the custom sources used by imported groups". — [CurseForge v4.15.6](https://www.curseforge.com/wow/addons/tradeskill-master/files/9546800)
- The same CurseForge page lists a newer **v4.15.8 (18 Nov 2026)** for Retail/Forever/MoP/Classic/TBC, with no changelog shown. It also lists v4.15.7 (13 Nov) as the main Retail file. — [CurseForge v4.15.6 page, Recent Files](https://www.curseforge.com/wow/addons/tradeskill-master/files/9546800)
- An aggregator page updated 19 Nov 2026 also names v4.15.8 (18 Nov) and says the addon file lists Interface 16001. — [mmonster.co](https://mmonster.co/wow-forever/guides/addons/tradeskillmaster)
- Install tips from aggregators: choose the file or flavor tagged Forever (1.60.1 / 16001), not the Classic one, and unpack it into `World of Warcraft/_forever_/Interface/AddOns`. Command: `/tsm`. — [foreverbase.org (checked 5 Nov, lists v4.15.3)](https://foreverbase.org/en/addons/catalog/tsm/); [mmonster.co](https://mmonster.co/wow-forever/guides/addons/tradeskillmaster)
- Outdated, conflicting claim: wowcalc.net (checks dated 29 Oct 2026) still says "There is no Forever version of TradeSkillMaster yet". It predates the 4 Nov release. — [wowcalc.net](https://wowcalc.net/en/forever/wiki/addons/tradeskillmaster); [TSM News](https://tradeskillmaster.com/news/tsm-4-15-brings-wow-forever-support-plus-new-desktop-app-1180)

### Inferences
- Build history on Forever, pieced together from several sources: 4.15.3 (~5 Nov) → 4.15.6 (10 Nov) → 4.15.8 (18 Nov). The 4.15.4, .5 and .7 steps were not seen in a Forever context (4.15.7 is only confirmed as a Retail main file).
- The Forever fixes concern disenchant tables and bonus IDs. This suggests the Destroy source (disenchant value) was wrong for some low-level items before 4.15.6, so update to at least 4.15.6.

### Gaps
- No official TSM "Currently Known Issues" entry for Forever was found. The v4.15.8 changelog was not visible.
- I could not confirm from a primary source that the TOC line is literally `## Interface: 16001`; CurseForge shows only "1.60.1".

## 2. Does the Desktop App / AuctionDB deliver realm and region data for Forever? What works without it?

### Takeaway
TSM's public-data site lists **Forever as a game version**, and several guides say the Desktop App delivers Forever market data: you pick the "Forever" entry for your region. However, **no source confirms which specific DB sources (DBMarket, DBRegionSaleRate, etc.) are filled on Forever**, or how Forever "rulesets" and factions map to TSM realms. Without the app, no AuctionDB prices exist. Only your own data works: Accounting, Vendor, Crafting/MatPrice and Destroy (the latter needs DB values of its outputs), plus Auctionator's AtrValue as an external source.

### Cited Findings
- TSM's public-data page has a game-version selector with **Retail, Classic, Mists of Pandaria, Forever**, and regions EU/NA/KR/TW. **Commodity files are published only for Retail regions**, and pet files only for Retail and MoP. Realm and commodity files update every few hours, region files daily. — [TSM Public Data](https://tradeskillmaster.com/public-data)
- The guessed URL `tradeskillmaster.com/public-data/forever` returned 404, so I could not verify the Forever file list. — [TSM Public Data](https://tradeskillmaster.com/public-data)
- A guide updated 9 Nov 2026 says: when the app asks for your realm, pick the **Forever entry for your region**. Forever uses rulesets rather than classic realms, and TSM's own pages "don't yet explain how rulesets and factions are split". — [botwowforever.com](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)
- Fix for "no AuctionDB time in tooltip": start the Desktop App, confirm you are signed in and that Forever is selected. The free tier covers up to 10 realms. — [botwowforever.com](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)
- "Market prices come from the TSM desktop app. Without it, the addon works only with your own auction house scans." — [foreverbase.org](https://foreverbase.org/en/addons/catalog/tsm/)
- TSM support: the message "No Recent AuctionDB Scan Data Found" appears when the Desktop App isn't installed, configured and running. — [TSM support docs (search snippet)](https://tradeskillmaster.helpjuice.com/en_US/tsm-addon-documentation)
- Definitions from TSM support (page last updated 19 Nov 2024; general, not Forever-specific):
  - **DBMarket**: 14-day weighted average of the realm's *listings*, favoring the last 3 days. It reflects listing prices, not sale prices.
  - **DBMinBuyout**: lowest buyout at the last update, which can be more than 30 minutes old. It is invalid if there are no auctions.
  - **DBRecent**: latest snapshot only.
  - **DBHistorical**: 60-day average of DBMarket.
  - **DBRegionMarketAvg**: average of DBMarket across the region.
  - **DBRegionHistorical**: 60-day average of DBRegionMarketAvg.
  - **DBRegionSaleAvg**: region sale price, built from TSM Accounting data that users upload through the Desktop App.

  — [TSM Support: Price Sources](https://support.tradeskillmaster.com/custom-strings/which-price-sources-can-i-use-and-what-do-they-mean)
- Internal sources that need no app:
  - **avgBuy/avgSell/minBuy/maxBuy/minSell/maxSell** (Accounting, your own trades).
  - **SmartAvgBuy**: average of your last X purchases, where X is the number you currently hold. Invalid if you hold none. Added in TSM 4.10.
  - **Crafting**: sum of matPrice. Requires the recipe.
  - **matPrice**.
  - **vendorSell**.
  - **vendorBuy**: only filled after you visit a vendor that sells the item.
  - **Destroy**: by default values the outputs with DBMarket, configurable in Tooltip Options.

  — [TSM Support: Price Sources](https://support.tradeskillmaster.com/custom-strings/which-price-sources-can-i-use-and-what-do-they-mean)
- **AtrValue** (Auctionator) is listed by TSM as an available external price source for custom strings once Auctionator is installed. It is based on your own Auctionator scans. — [TSM Support: Which external sources are available](https://support.tradeskillmaster.com/en_US/custom-strings/which-external-sources-are-available-to-use)
- Classic-era precedent, from Blizzard forums (not Forever): missing auction data on Era/Anniversary realms is a known gap in Blizzard's API. On r/woweconomy, users reported TSM gathering data "manually" for SoD/Fresh realms at first, then getting market values after reinstalling. These are anecdotes. — [Blizzard forum](https://us.forums.blizzard.com/en/blizzard/t/tbc-classic-anniversary-thunderstrike-auction-api/58703); [r/woweconomy weekly TSM thread mirror](https://lr.in.psf.lt/r/woweconomy/comments/1husdfx/weekly_tradeskillmaster_thread)
- Simple Market Value (a third-party addon) can show TSM region sale data in tooltips when the TSM app is running. This suggests the app delivers *some* region sale data for Forever, but the page is not explicit. — [CurseForge Simple Market Value](https://www.curseforge.com/wow/addons/simple-market-value)

### Inferences
- **Assumed for Forever, not verified:** since Forever appears in TSM's public-data selector and the app offers a Forever realm entry, DBMarket, DBMinBuyout, DBRecent and DBHistorical are probably filled. Region sources (DBRegion*, sale rate and sold per day) depend on the Accounting uploads of many users. In a 2-week-old economy, they are likely thin, and DBHistorical (60 days) and DBRegionHistorical are not yet meaningful.
- Forever runs the modern C_AuctionHouse API (our own verification). On Retail, TSM publishes commodity data region-wide. TSM's public-data page says commodity files exist only for Retail regions. Whether Forever's stackable goods (commodities) are covered by TSM data at all is **unverified**. This is a key risk for materials such as herbs, ore and cloth.
- For a fresh Horde-EU-DE realm with no app data, a robust fallback for the user's strings is `first(DBMarket, AtrValue, SmartAvgBuy, VendorSell*x)` or similar. `first()` returns the first valid value.
- DBMinBuyout and DBMarket on Forever reflect listings, not sales. For sale-based numbers, your own Accounting (avgSell, maxSell) is the reliable source in a new economy.

### Gaps
- Which DB* sources are actually populated for Forever EU (especially DBRegionSaleRate, DBRegionSoldPerDay, DBRegionSaleAvg), and whether Forever data is split per ruleset, realm or faction: no primary source found.
- Whether the full-scan data (ReplicateItems every 15 min) is used by TSM's backend for Forever: no source.

## 3. Default custom prices and their behavior with empty DB sources

### Takeaway
TSM's long-standing default material cost is `min(dbmarket, crafting, vendorbuy, convert(dbmarket))`. A newer variant `min(smartavgbuy, dbrecent, dbmarket, crafting, vendorbuy, convert(dbmarket))` has been proposed or seen, but I could not verify which default ships in 4.15. min() ignores invalid sources, so with empty DB sources the material cost falls back to crafting cost or vendorBuy, or ends up invalid. The Crafting cost then becomes invalid, and profit calculations show nothing.

### Cited Findings
- `min(dbmarket, crafting, vendorbuy, convert(dbmarket))` is described as TSM's "Default Material Cost Method". min() picks the lowest valid value. convert() uses a hard-coded conversion table, and vendorBuy applies only to items vendors sell without limit. — [Wowhead Economy Wrap-up 191](https://cn.wowhead.com/news/wowhead-economy-weekly-wrap-up-191-korthite-crystal-market-crash-323878)
- A later column cites `min(smartavgbuy, dbrecent, dbmarket, crafting, vendorbuy, convert(dbmarket))` as a proposal. It is unconfirmed whether TSM adopted it as default. — [Wowhead Economy Wrap-up 264](https://www.wowhead.com/news=331327/weekly-crafting-drops-dragon-shards-wowhead-economy-weekly-wrap-up-264)
- vendorBuy is only populated after visiting a vendor that sells the item. This causes "wrong or missing material prices" for vendor mats. — [TSM Support: vendor material prices](https://support.tradeskillmaster.com/en_US/addon/why-do-my-vendor-items-have-wrong-or-missing-material-prices)
- DBMinBuyout is invalid if the item has no auctions on the realm. — [TSM Support: Price Sources](https://support.tradeskillmaster.com/custom-strings/which-price-sources-can-i-use-and-what-do-they-mean)

### Inferences
- On Forever without app data: visit the vendors (thread, vials, flux) once on a character so vendorBuy fills. Otherwise matPrice for those items is invalid.
- Since the 4.15.6 fix, Destroy values for low-level disenchants should be correct. They still need DBMarket for the dusts and essences, unless the Destroy source is changed in Tooltip Options (for example to AtrValue).

### Gaps
- The exact default strings in TSM 4.15 (matPrice, Auctioning min/normal/max price, Shopping max price) were not verified from the addon source.

## 4. Community tips for TSM on Forever or new, low-population economies

### Takeaway
Little Forever-specific community material exists. The guides advise: use the Forever file, keep the app running with Forever selected, run only one AH-modifying addon at a time (TSM *or* Auctionator), and lean on your own scans and Accounting data while the market is young.

### Cited Findings
- Run only one auction addon at a time, since TSM and Auctionator both change the AH window. Test a failing purchase once in the default UI to rule out the addon. Check vendor prices before posting cheap items. TSM's strength is operations (post, cancel, restock), which "take an evening to learn". For a few stacks, Auctionator is simpler. — [botwowforever.com](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)
- Don't rely on October compatibility lists for Forever. — [foreverbase.org](https://foreverbase.org/en/addons/catalog/tsm/)
- The "Auctionator 9/10, verified working on Forever" rating comes from an aggregator. — [wowcalc.net](https://wowcalc.net/en/forever/wiki/addons/tradeskillmaster)
- Several Forever-only AH addons appeared: auxForever, Goblin Terminal, Forever AH, ForeverSell, Hammerprice, and Grimlight Auctions, which explicitly targets Interface 16001 / 1.60.1 and is an early test build. ForeverSell's page notes that SavedVariables "are not yet fully reliable in the current WoW Forever client". — [CurseForge Grimlight](https://www.curseforge.com/wow/addons/grimlight-auctions); [CurseForge ForeverSell](https://www.curseforge.com/wow/addons/foreversell); [CurseForge auxForever](https://www.curseforge.com/wow/addons/auxforever)

### Inferences
- If SavedVariables really are unreliable on Forever (one unverified addon-author claim), TSM Accounting history could be lost. The Desktop App's automatic backups (new in 4.15) are a mitigation.

### Gaps
- No r/woweconomy, r/classicwow or YouTube gold-maker material specific to TSM on Forever was found.

## 5. Interaction with Blizzard's modern AH on Forever (commodities, deposit, "Internal auction error")

### Takeaway
Reports of "Internal auction error" when undercutting on Forever exist only from third-party guides. The workaround they give is to post at the same price. Blizzard had not commented at the time of writing. Nothing TSM-specific about the 1-silver minimum deposit or commodity handling on Forever was found.

### Cited Findings
- "Internal auction error" when posting is reported when undercutting an existing listing. The workaround is to post at the same price; Blizzard had not responded (guide updated 9 Nov 2026). The same guide mentions "The item was not found" as a launch-week server-side issue, and an "Economy Hold" message as a possible reason the AH won't open. — [botwowforever.com](https://botwowforever.com/guides/auctionator-tsm-wow-forever-setup)
- Since the Forever launch on 4 Nov 2026, players have hit AH errors with no confirmed cause. The generic advice is to reload the UI and disable AH addons. — [allthings.how](https://allthings.how/?p=331396)
- Older pre-Forever Blizzard thread: an internal error when listing below the current lowest price. — [Blizzard forums](https://us.forums.blizzard.com/en/wow/t/internal-auction-error/988803)
- Icy Veins ran a Forever news piece about the AH deposit hurting margins. The fetch returned 403, so its contents are unverified. — [Icy Veins](https://www.icy-veins.com/wow-forever/news/if-youre-tired-of-the-auction-house-deposit-ruining-your-margins-youre-not-alone/)

### Inferences
- With TSM Auctioning, an undercut of 1 copper could trigger the error if the report is accurate. Setting the undercut to 0 (match price), or checking whether the error is tied to commodity posts, would be a workaround to test. This is not verified.
- With a deposit of at least 1 silver per listing (our own verification), TSM's Auctioning cancel/repost cycles cost money on every repost. Fewer reposts (a longer duration, and a "don't post below" threshold above deposit + 5% cut) are advisable. This is an inference, not from a TSM source.

### Gaps
- Whether TSM 4.15.x computes Forever deposits correctly (minimum 1 silver) in its profit and posting logic: no source.
- No primary Blizzard statement on "Internal auction error" on Forever.
- Whether TSM treats Forever stackables as commodities (region-wide AH) or item auctions: no source.
